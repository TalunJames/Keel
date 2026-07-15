import fs from "fs";
import path from "path";
import { createReadStream } from "fs";
import { parse } from "csv-parse";
import Database from "better-sqlite3";
import { detectVendor, mapTargetSmartRow } from "./targetsmart.js";
import { geocodeUniqueAddresses } from "./geocode.js";

const BATCH_SIZE = 2000;

const DEFAULT_MAP_CONFIG = {
  boundaryUrl: "/election-data/d11-boundary.geojson",
  precinctsUrl: "/election-data/overlay-precincts.geojson",
  center: [-104.8214, 38.8339],
  zoom: 11,
};

function voterDataRoot() {
  return process.env.VOTER_DATA_DIR || path.join(process.cwd(), "data", "voter");
}

function clientDir(clientId) {
  return path.join(voterDataRoot(), clientId);
}

function warehousePath(clientId) {
  return path.join(clientDir(clientId), "warehouse.db");
}

function manifestPath(clientId) {
  return path.join(clientDir(clientId), "manifest.json");
}

function sourceCsvPath(clientId) {
  return path.join(clientDir(clientId), "voters.csv");
}

// Path to the main Keel db, where user-curated annotations (tags, notes, bios)
// live so they survive a warehouse re-ingest (which atomically replaces
// warehouse.db). We ATTACH it read-only so tag filters and tag display can join
// against the warehouse without shuttling huge id lists across process boundary.
function keelDbPath() {
  return process.env.DATABASE_PATH || path.join(process.cwd(), "data", "keel.db");
}

// Remove a SQLite db file together with its -wal and -shm sidecars, so a stale
// WAL can't be recovered into a freshly written db (data corruption / mixing).
function removeDbFiles(dbPath) {
  for (const p of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

export function hasWarehouse(clientId) {
  return fs.existsSync(warehousePath(clientId));
}

export function readManifest(clientId) {
  const p = manifestPath(clientId);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function openWarehouse(clientId, { readonly = true, attachAnnotations = false } = {}) {
  const dbPath = warehousePath(clientId);
  if (!fs.existsSync(dbPath)) return null;
  const db = new Database(dbPath, { readonly });
  db.pragma("journal_mode = WAL");
  db.__annotated = false;
  if (attachAnnotations) {
    try {
      const keel = keelDbPath();
      if (fs.existsSync(keel)) {
        db.prepare("ATTACH DATABASE ? AS anno").run(keel);
        db.__annotated = true;
      }
    } catch {
      // Annotations are best-effort; a missing/locked keel.db just disables
      // tag joins for this query rather than failing the voter lookup.
      db.__annotated = false;
    }
  }
  return db;
}

// Full warehouse schema. Columns beyond the original TargetSmart set default to
// empty/NULL so a legacy ingest still works; the mock generator and richer
// vendors populate them. Kept flat + heavily indexed for fast filtering.
function initWarehouseSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS voters (
      id TEXT PRIMARY KEY,
      state_voter_id TEXT NOT NULL DEFAULT '',
      first_name TEXT NOT NULL DEFAULT '',
      middle_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      suffix TEXT NOT NULL DEFAULT '',
      party TEXT NOT NULL DEFAULT 'I',
      raw_party TEXT NOT NULL DEFAULT '',
      gender TEXT NOT NULL DEFAULT 'U',
      age INTEGER,
      birth_year INTEGER,
      county TEXT NOT NULL DEFAULT '',
      score REAL NOT NULL DEFAULT 0,
      support_score REAL,
      partisan_score REAL,
      precinct TEXT NOT NULL DEFAULT '',
      congressional TEXT NOT NULL DEFAULT '',
      state_senate TEXT NOT NULL DEFAULT '',
      state_house TEXT NOT NULL DEFAULT '',
      commissioner TEXT NOT NULL DEFAULT '',
      school_district TEXT NOT NULL DEFAULT '',
      zip TEXT NOT NULL DEFAULT '',
      voter_status TEXT NOT NULL DEFAULT '',
      registration_date TEXT NOT NULL DEFAULT '',
      age_range TEXT NOT NULL DEFAULT '',
      ethnicity TEXT NOT NULL DEFAULT '',
      language TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      cell_phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      general_votes INTEGER NOT NULL DEFAULT 0,
      primary_votes INTEGER NOT NULL DEFAULT 0,
      total_votes INTEGER NOT NULL DEFAULT 0,
      last_voted TEXT NOT NULL DEFAULT '',
      household_id TEXT NOT NULL DEFAULT '',
      household_size INTEGER NOT NULL DEFAULT 1,
      address_line TEXT NOT NULL DEFAULT '',
      address_city TEXT NOT NULL DEFAULT '',
      address_state TEXT NOT NULL DEFAULT '',
      address_key TEXT NOT NULL DEFAULT '',
      lat REAL,
      lng REAL
    );
    CREATE INDEX IF NOT EXISTS idx_voters_party ON voters(party);
    CREATE INDEX IF NOT EXISTS idx_voters_county ON voters(county);
    CREATE INDEX IF NOT EXISTS idx_voters_score ON voters(score);
    CREATE INDEX IF NOT EXISTS idx_voters_support ON voters(support_score);
    CREATE INDEX IF NOT EXISTS idx_voters_name ON voters(last_name, first_name);
    CREATE INDEX IF NOT EXISTS idx_voters_state_id ON voters(state_voter_id);
    CREATE INDEX IF NOT EXISTS idx_voters_precinct ON voters(precinct);
    CREATE INDEX IF NOT EXISTS idx_voters_senate ON voters(state_senate);
    CREATE INDEX IF NOT EXISTS idx_voters_house ON voters(state_house);
    CREATE INDEX IF NOT EXISTS idx_voters_gender ON voters(gender);
    CREATE INDEX IF NOT EXISTS idx_voters_age ON voters(age);
    CREATE INDEX IF NOT EXISTS idx_voters_ethnicity ON voters(ethnicity);
    CREATE INDEX IF NOT EXISTS idx_voters_coords ON voters(lat, lng);
    CREATE INDEX IF NOT EXISTS idx_voters_address_key ON voters(address_key);
    CREATE INDEX IF NOT EXISTS idx_voters_household ON voters(household_id);

    CREATE TABLE IF NOT EXISTS elections (
      key TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'general',
      year INTEGER,
      ord INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS vote_history (
      voter_id TEXT NOT NULL,
      election_key TEXT NOT NULL,
      method TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (voter_id, election_key)
    );
    CREATE INDEX IF NOT EXISTS idx_vote_history_election ON vote_history(election_key);
  `);
}

function mapRow(vendor, row) {
  if (vendor === "targetsmart") return mapTargetSmartRow(row);
  throw new Error(`Unsupported vendor: ${vendor}`);
}

function stageSourceFile(sourcePath, destPath, { link = false } = {}) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  if (path.resolve(sourcePath) === path.resolve(destPath)) {
    return "in-place";
  }
  if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
  if (link) {
    fs.symlinkSync(path.resolve(sourcePath), destPath);
    return "symlink";
  }
  fs.copyFileSync(sourcePath, destPath);
  return "copy";
}

// ---------- Filter engine ----------
//
// buildWhere translates a filter spec + free-text query into a parameterized
// WHERE clause. Column names are hard-coded (never taken from input); every
// value is bound as a named parameter, so filter input can't inject SQL.
// Accepts both the legacy flat shape ({party:'D', scoreMin, turnoutOnly,...})
// and the richer shape used by the new UI (arrays, ranges, vote history, tags).

function asArray(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v.filter((x) => x != null && x !== "" && x !== "All");
  if (v === "All" || v === "") return [];
  return [v];
}

// Build a parameterized `col IN (@k0,@k1,...)` fragment. Returns null if empty.
function inClause(col, values, prefix, params) {
  const vals = asArray(values);
  if (!vals.length) return null;
  const keys = vals.map((val, i) => {
    const k = `${prefix}${i}`;
    params[k] = val;
    return `@${k}`;
  });
  return `${col} IN (${keys.join(", ")})`;
}

function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function buildWhere(filters = {}, query = "", { bbox, annotated = false } = {}) {
  const f = filters || {};
  const clauses = ["1=1"];
  const params = {};
  const add = (c) => { if (c) clauses.push(c); };

  // Party — legacy single string or new array. 'All' means no constraint.
  const party = f.parties ?? f.party;
  add(inClause("party", party, "party", params));

  // Geography
  add(inClause("county", f.counties ?? f.county, "county", params));
  add(inClause("precinct", f.precincts ?? f.precinct, "precinct", params));
  add(inClause("address_city", f.cities ?? f.city, "city", params));
  add(inClause("zip", f.zips ?? f.zip, "zip", params));
  add(inClause("congressional", f.congressional, "cd", params));
  add(inClause("state_senate", f.senate, "sd", params));
  add(inClause("state_house", f.house, "hd", params));
  add(inClause("commissioner", f.commissioner, "comm", params));

  // Demographics
  add(inClause("gender", f.genders ?? f.gender, "gender", params));
  add(inClause("ethnicity", f.ethnicities ?? f.ethnicity, "eth", params));
  add(inClause("language", f.languages ?? f.language, "lang", params));

  const ageMin = numOrNull(f.ageMin);
  if (ageMin != null && ageMin > 0) { clauses.push("age >= @ageMin"); params.ageMin = ageMin; }
  const ageMax = numOrNull(f.ageMax);
  if (ageMax != null && ageMax > 0) { clauses.push("age <= @ageMax"); params.ageMax = ageMax; }

  // Status — 'A' active / 'I' inactive
  if (f.status && f.status !== "All") { clauses.push("voter_status = @status"); params.status = f.status; }

  // Registration date range (ISO yyyy-mm-dd string compare is chronological)
  if (f.regFrom) { clauses.push("registration_date >= @regFrom"); params.regFrom = String(f.regFrom); }
  if (f.regTo) { clauses.push("registration_date <= @regTo"); params.regTo = String(f.regTo); }

  // Scores — new range shape + legacy scoreMin/turnoutOnly
  const turnoutMin = numOrNull(f.turnoutMin ?? f.scoreMin);
  if (turnoutMin != null && turnoutMin > 0) { clauses.push("score >= @turnoutMin"); params.turnoutMin = turnoutMin; }
  const turnoutMax = numOrNull(f.turnoutMax);
  if (turnoutMax != null && turnoutMax < 100) { clauses.push("score <= @turnoutMax"); params.turnoutMax = turnoutMax; }
  if (f.turnoutOnly) clauses.push("score > 0");

  const supportMin = numOrNull(f.supportMin);
  if (supportMin != null && supportMin > 0) { clauses.push("support_score >= @supportMin"); params.supportMin = supportMin; }
  const supportMax = numOrNull(f.supportMax);
  if (supportMax != null && supportMax < 100) { clauses.push("support_score <= @supportMax"); params.supportMax = supportMax; }

  // Contact presence
  if (f.hasPhone) clauses.push("(phone != '' OR cell_phone != '')");
  if (f.hasCell) clauses.push("cell_phone != ''");
  if (f.hasEmail) clauses.push("email != ''");

  // Vote history — aggregate thresholds + specific-election membership
  const generalsMin = numOrNull(f.generalsMin);
  if (generalsMin != null && generalsMin > 0) { clauses.push("general_votes >= @generalsMin"); params.generalsMin = generalsMin; }
  const primariesMin = numOrNull(f.primariesMin);
  if (primariesMin != null && primariesMin > 0) { clauses.push("primary_votes >= @primariesMin"); params.primariesMin = primariesMin; }

  const votedIn = asArray(f.votedElections ?? f.votedElection);
  votedIn.forEach((key, i) => {
    const k = `voted${i}`;
    params[k] = key;
    clauses.push(`EXISTS (SELECT 1 FROM vote_history vh WHERE vh.voter_id = voters.id AND vh.election_key = @${k})`);
  });
  const notVotedIn = asArray(f.notVotedElections ?? f.notVotedElection);
  notVotedIn.forEach((key, i) => {
    const k = `nvoted${i}`;
    params[k] = key;
    clauses.push(`NOT EXISTS (SELECT 1 FROM vote_history vh2 WHERE vh2.voter_id = voters.id AND vh2.election_key = @${k})`);
  });

  // Tags — only when the annotations db is attached. tagClient scopes the join.
  if (annotated) {
    const tagsInclude = asArray(f.tagsInclude);
    const tagsExclude = asArray(f.tagsExclude);
    if ((tagsInclude.length || tagsExclude.length) && f.tagClient) {
      params.tagClient = f.tagClient;
    }
    tagsInclude.forEach((tagId, i) => {
      const k = `tagi${i}`;
      params[k] = tagId;
      clauses.push(`EXISTS (SELECT 1 FROM anno.voter_tag_map tm WHERE tm.voter_id = voters.id AND tm.client_id = @tagClient AND tm.tag_id = @${k})`);
    });
    tagsExclude.forEach((tagId, i) => {
      const k = `tagx${i}`;
      params[k] = tagId;
      clauses.push(`NOT EXISTS (SELECT 1 FROM anno.voter_tag_map tx WHERE tx.voter_id = voters.id AND tx.client_id = @tagClient AND tx.tag_id = @${k})`);
    });
  }

  // Free-text search across name / id / address
  const q = String(query || f.q || "").trim();
  if (q) {
    clauses.push(`(
      first_name LIKE @qLike ESCAPE '\\' OR
      last_name LIKE @qLike ESCAPE '\\' OR
      (first_name || ' ' || last_name) LIKE @qLike ESCAPE '\\' OR
      state_voter_id LIKE @qLike ESCAPE '\\' OR
      id LIKE @qLike ESCAPE '\\' OR
      address_line LIKE @qLike ESCAPE '\\'
    )`);
    params.qLike = `%${escapeLike(q)}%`;
  }

  // Map bounding box
  if (bbox && bbox.length === 4) {
    const [west, south, east, north] = bbox;
    clauses.push("lat IS NOT NULL AND lng IS NOT NULL");
    clauses.push("lng >= @west AND lng <= @east AND lat >= @south AND lat <= @north");
    Object.assign(params, { west, south, east, north });
  }

  return { where: clauses.join(" AND "), params };
}

function csvCell(value) {
  let s = String(value ?? "");
  // Neutralize spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function escapeLike(s) {
  return String(s).replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function fullName(r) {
  return [r.first_name, r.middle_name, r.last_name, r.suffix].map((s) => String(s || "").trim()).filter(Boolean).join(" ");
}
function bestPhone(r) {
  return r.cell_phone || r.phone || "";
}

// ---------- Export formats ----------
// Each format is a named column set + a sort order. Standard is the full dump;
// the others mirror common field-program deliverables.
const EXPORT_FORMATS = {
  standard: {
    label: "Standard voter export",
    order: "ORDER BY last_name COLLATE NOCASE, first_name COLLATE NOCASE",
    columns: [
      ["state_voter_id", (r) => r.state_voter_id],
      ["first_name", (r) => r.first_name],
      ["last_name", (r) => r.last_name],
      ["party", (r) => r.party],
      ["gender", (r) => r.gender],
      ["age", (r) => r.age ?? ""],
      ["turnout_score", (r) => r.score],
      ["support_score", (r) => r.support_score ?? ""],
      ["precinct", (r) => r.precinct],
      ["state_senate", (r) => r.state_senate],
      ["state_house", (r) => r.state_house],
      ["county", (r) => r.county],
      ["zip", (r) => r.zip],
      ["address", (r) => r.address_line],
      ["city", (r) => r.address_city],
      ["phone", (r) => bestPhone(r)],
      ["email", (r) => r.email],
      ["lat", (r) => r.lat ?? ""],
      ["lng", (r) => r.lng ?? ""],
      ["voter_status", (r) => r.voter_status],
      ["household_id", (r) => r.household_id],
    ],
  },
  walk: {
    label: "Walk list (canvassing)",
    // Grouped by turf then street so a canvasser walks a sensible route.
    order: "ORDER BY precinct COLLATE NOCASE, address_line COLLATE NOCASE, last_name COLLATE NOCASE",
    columns: [
      ["precinct", (r) => r.precinct],
      ["address", (r) => r.address_line],
      ["city", (r) => r.address_city],
      ["name", (r) => fullName(r)],
      ["age", (r) => r.age ?? ""],
      ["party", (r) => r.party],
      ["support_score", (r) => r.support_score ?? ""],
      ["household_size", (r) => r.household_size],
      ["contacted", () => ""],
      ["support_1_5", () => ""],
      ["notes", () => ""],
    ],
  },
  phone: {
    label: "Phone bank list",
    order: "ORDER BY support_score DESC, last_name COLLATE NOCASE",
    columns: [
      ["name", (r) => fullName(r)],
      ["phone", (r) => bestPhone(r)],
      ["party", (r) => r.party],
      ["age", (r) => r.age ?? ""],
      ["precinct", (r) => r.precinct],
      ["support_score", (r) => r.support_score ?? ""],
      ["result", () => ""],
      ["notes", () => ""],
    ],
  },
  mail: {
    label: "Mail merge",
    order: "ORDER BY zip, address_line COLLATE NOCASE",
    columns: [
      ["full_name", (r) => fullName(r)],
      ["address", (r) => r.address_line],
      ["city", (r) => r.address_city],
      ["state", (r) => r.address_state],
      ["zip", (r) => r.zip],
      ["party", (r) => r.party],
      ["household_id", (r) => r.household_id],
    ],
  },
};

function exportFormat(name) {
  return EXPORT_FORMATS[name] || EXPORT_FORMATS.standard;
}

export function exportFormatList() {
  return Object.entries(EXPORT_FORMATS).map(([id, f]) => ({ id, label: f.label }));
}

export function countVoterExport(clientId, { filters = {}, query = "", bbox } = {}) {
  const db = openWarehouse(clientId, { attachAnnotations: true });
  if (!db) return 0;
  try {
    const { where, params } = buildWhere(filters, query, { bbox, annotated: db.__annotated });
    return db.prepare(`SELECT COUNT(*) AS n FROM voters WHERE ${where}`).get(params).n;
  } finally {
    db.close();
  }
}

export function* iterateVoterExport(clientId, { filters = {}, query = "", bbox, format = "standard" } = {}) {
  const db = openWarehouse(clientId, { attachAnnotations: true });
  if (!db) return;
  try {
    const fmt = exportFormat(format);
    const { where, params } = buildWhere(filters, query, { bbox, annotated: db.__annotated });
    const rows = db.prepare(`
      SELECT * FROM voters WHERE ${where} ${fmt.order}
    `).iterate(params);
    for (const row of rows) yield row;
  } finally {
    db.close();
  }
}

export function voterExportCsvHeader(format = "standard") {
  return exportFormat(format).columns.map(([h]) => h).join(",");
}

export function voterExportCsvRow(row, format = "standard") {
  return exportFormat(format).columns.map(([, pick]) => csvCell(pick(row))).join(",");
}

export async function ingestVoterFile({
  clientId,
  sourcePath,
  source = null,
  link = false,
  mapConfig = null,
  onProgress = null,
}) {
  if (!clientId) throw new Error("clientId is required");
  const absSource = path.resolve(sourcePath);
  if (!fs.existsSync(absSource)) throw new Error(`Source file not found: ${absSource}`);

  const dir = clientDir(clientId);
  fs.mkdirSync(dir, { recursive: true });

  const staged = stageSourceFile(absSource, sourceCsvPath(clientId), { link });
  const dbPath = warehousePath(clientId);
  const tmpDbPath = `${dbPath}.tmp`;
  removeDbFiles(tmpDbPath);

  const db = new Database(tmpDbPath);
  db.pragma("journal_mode = WAL");
  initWarehouseSchema(db);

  const insert = db.prepare(`
    INSERT INTO voters (
      id, state_voter_id, first_name, last_name, party, raw_party,
      county, score, precinct, zip, voter_status, age_range, household_id,
      address_line, address_city, address_state, address_key
    ) VALUES (
      @id, @state_voter_id, @first_name, @last_name, @party, @raw_party,
      @county, @score, @precinct, @zip, @voter_status, @age_range, @household_id,
      @address_line, @address_city, @address_state, @address_key
    )
    ON CONFLICT(id) DO UPDATE SET
      state_voter_id = excluded.state_voter_id,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      party = excluded.party,
      raw_party = excluded.raw_party,
      county = excluded.county,
      score = excluded.score,
      precinct = excluded.precinct,
      zip = excluded.zip,
      voter_status = excluded.voter_status,
      age_range = excluded.age_range,
      household_id = excluded.household_id,
      address_line = excluded.address_line,
      address_city = excluded.address_city,
      address_state = excluded.address_state,
      address_key = excluded.address_key
  `);
  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });

  let vendor = null;
  let headers = null;
  let recordCount = 0;
  let batch = [];
  const counties = new Set();
  const precincts = new Set();
  const ageRanges = new Set();
  const partyMix = { D: 0, R: 0, I: 0 };

  try {
    await new Promise((resolve, reject) => {
    const parser = createReadStream(sourceCsvPath(clientId)).pipe(
      parse({
        columns: true,
        bom: true,
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true,
      })
    );

    parser.on("data", (row) => {
      try {
        if (!headers) {
          headers = Object.keys(row);
          vendor = detectVendor(headers);
          if (!vendor) {
            const err = new Error("Unrecognized voter file format — expected TargetSmart/RNC export headers.");
            parser.destroy(err);
            reject(err);
            return;
          }
        }

        const mapped = mapRow(vendor, row);
        if (!mapped.id) return;

        counties.add(mapped.county);
        if (mapped.precinct) precincts.add(mapped.precinct);
        if (mapped.age_range) ageRanges.add(mapped.age_range);
        partyMix[mapped.party] = (partyMix[mapped.party] || 0) + 1;

        batch.push(mapped);
        recordCount += 1;

        if (batch.length >= BATCH_SIZE) {
          parser.pause();
          insertMany(batch);
          batch = [];
          if (onProgress) onProgress(recordCount);
          parser.resume();
        }
      } catch (err) {
        parser.destroy(err);
        reject(err);
      }
    });

    parser.on("error", reject);
    parser.on("end", () => {
      try {
        if (!vendor) {
          reject(new Error("CSV file has no data rows — nothing to ingest."));
          return;
        }
        if (batch.length) insertMany(batch);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
    });
  } catch (err) {
    db.close();
    removeDbFiles(tmpDbPath);
    throw err;
  }

  let uniqueAddresses = 0;
  try {
    uniqueAddresses = db.prepare(
      "SELECT COUNT(DISTINCT address_key) AS n FROM voters WHERE address_key != ''"
    ).get().n;
  } finally {
    db.close();
  }

  removeDbFiles(dbPath);
  fs.renameSync(tmpDbPath, dbPath);

  const manifest = {
    clientId,
    vendor,
    source: source || path.basename(absSource),
    sourceFile: path.basename(absSource),
    stagedAs: staged,
    recordCount,
    counties: [...counties].filter(Boolean).sort(),
    precincts: [...precincts].filter(Boolean).sort(),
    ageRanges: [...ageRanges].filter(Boolean).sort(),
    partyMix,
    uniqueAddresses,
    geocodedCount: 0,
    ingestedAt: new Date().toISOString(),
    columns: headers,
    map: { ...DEFAULT_MAP_CONFIG, ...(mapConfig || {}) },
  };

  fs.writeFileSync(manifestPath(clientId), JSON.stringify(manifest, null, 2));
  return manifest;
}

const GEOCODE_CHUNK = 5000;

export async function geocodeClientVoters(clientId, { onProgress } = {}) {
  const db = openWarehouse(clientId, { readonly: false });
  if (!db) throw new Error("No warehouse found for client");

  const update = db.prepare("UPDATE voters SET lat = ?, lng = ? WHERE address_key = ? AND (lat IS NULL OR lng IS NULL)");
  const apply = db.transaction((rows) => {
    for (const row of rows) {
      if (row.lat != null && row.lng != null) {
        update.run(row.lat, row.lng, row.address_key);
      }
    }
  });

  const iter = db.prepare(`
    SELECT DISTINCT address_key, address_line, address_city, address_state, zip
    FROM voters
    WHERE address_key != '' AND (lat IS NULL OR lng IS NULL)
  `).iterate();

  let uniqueAddresses = 0;
  let chunk = [];
  for (const row of iter) {
    chunk.push(row);
    uniqueAddresses += 1;
    if (chunk.length >= GEOCODE_CHUNK) {
      const geocoded = await geocodeUniqueAddresses(chunk, { clientId, onProgress });
      apply(geocoded);
      chunk = [];
    }
  }
  if (chunk.length) {
    const geocoded = await geocodeUniqueAddresses(chunk, { clientId, onProgress });
    apply(geocoded);
  }

  const geocodedCount = db.prepare("SELECT COUNT(*) AS n FROM voters WHERE lat IS NOT NULL").get().n;
  db.close();

  const manifest = readManifest(clientId);
  if (manifest) {
    manifest.geocodedCount = geocodedCount;
    manifest.geocodedAt = new Date().toISOString();
    fs.writeFileSync(manifestPath(clientId), JSON.stringify(manifest, null, 2));
  }

  return { geocodedCount, uniqueAddresses };
}

// Aggregate tag counts for a page of voters, from the attached annotations db.
function tagsForVoters(db, clientId, ids) {
  if (!db.__annotated || !ids.length) return {};
  const keys = ids.map((_, i) => `@t${i}`).join(", ");
  const params = { tc: clientId };
  ids.forEach((id, i) => { params[`t${i}`] = id; });
  const rows = db.prepare(`
    SELECT tm.voter_id AS vid, t.id AS id, t.name AS name, t.color AS color
    FROM anno.voter_tag_map tm
    JOIN anno.voter_tags t ON t.id = tm.tag_id
    WHERE tm.client_id = @tc AND tm.voter_id IN (${keys})
  `).all(params);
  const out = {};
  for (const r of rows) {
    (out[r.vid] ||= []).push({ id: r.id, name: r.name, color: r.color });
  }
  return out;
}

export function queryVoters(clientId, { filters = {}, query = "", page = 1, pageSize = 50, sort = "name" } = {}) {
  const db = openWarehouse(clientId, { attachAnnotations: true });
  if (!db) return null;

  try {
    const scopedFilters = { ...filters, tagClient: clientId };
    const { where, params } = buildWhere(scopedFilters, query, { annotated: db.__annotated });
    const limit = Math.min(Math.max(Number(pageSize) || 50, 1), 200);
    const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

    const ORDER = {
      name: "last_name COLLATE NOCASE, first_name COLLATE NOCASE",
      score: "score DESC, last_name COLLATE NOCASE",
      support: "support_score DESC, last_name COLLATE NOCASE",
      age: "age DESC, last_name COLLATE NOCASE",
      precinct: "precinct COLLATE NOCASE, last_name COLLATE NOCASE",
    };
    const orderBy = ORDER[sort] || ORDER.name;

    const total = db.prepare(`SELECT COUNT(*) AS n FROM voters WHERE ${where}`).get(params).n;
    const rows = db.prepare(`
      SELECT id, state_voter_id, first_name, last_name, party, gender, age, county, score,
             support_score, precinct, state_senate, state_house, zip,
             address_line, address_city, phone, cell_phone, email,
             general_votes, primary_votes, lat, lng
      FROM voters
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT @limit OFFSET @offset
    `).all({ ...params, limit, offset });

    const tagMap = tagsForVoters(db, clientId, rows.map((r) => r.id));

    const stats = db.prepare(`
      SELECT
        ROUND(AVG(score), 1) AS avgScore,
        ROUND(AVG(support_score), 1) AS avgSupport,
        SUM(CASE WHEN party = 'D' THEN 1 ELSE 0 END) AS dCount,
        SUM(CASE WHEN party = 'R' THEN 1 ELSE 0 END) AS rCount,
        SUM(CASE WHEN party = 'I' THEN 1 ELSE 0 END) AS iCount
      FROM voters
      WHERE ${where}
    `).get(params);

    return {
      total,
      rows: rows.map((v) => ({
        id: v.state_voter_id || v.id,
        rowId: v.id,
        name: [v.first_name, v.last_name].filter(Boolean).join(" "),
        party: v.party,
        gender: v.gender,
        age: v.age,
        county: v.county,
        score: v.score,
        support: v.support_score,
        precinct: v.precinct,
        senate: v.state_senate,
        house: v.state_house,
        zip: v.zip,
        address: [v.address_line, v.address_city, v.zip].filter(Boolean).join(", "),
        phone: v.cell_phone || v.phone || "",
        email: v.email || "",
        generalVotes: v.general_votes,
        primaryVotes: v.primary_votes,
        lat: v.lat,
        lng: v.lng,
        tags: tagMap[v.id] || [],
      })),
      stats: {
        avgScore: stats?.avgScore || 0,
        avgSupport: stats?.avgSupport || 0,
        partyMix: {
          D: stats?.dCount || 0,
          R: stats?.rCount || 0,
          I: stats?.iCount || 0,
        },
      },
      page: Math.max(Number(page) || 1, 1),
      pageSize: limit,
    };
  } finally {
    db.close();
  }
}

// Full record for an individual voter page: profile + vote history + household
// + tags + notes/bio (notes/bio come from the attached annotations db).
export function getVoterPerson(clientId, voterId) {
  const db = openWarehouse(clientId, { attachAnnotations: true });
  if (!db) return null;
  try {
    const v = db.prepare(
      "SELECT * FROM voters WHERE id = @id OR state_voter_id = @id LIMIT 1"
    ).get({ id: String(voterId) });
    if (!v) return null;

    const history = db.prepare(`
      SELECT e.key, e.name, e.date, e.type, e.year, vh.method
      FROM vote_history vh
      JOIN elections e ON e.key = vh.election_key
      WHERE vh.voter_id = @id
      ORDER BY e.date DESC
    `).all({ id: v.id });

    const allElections = db.prepare("SELECT key, name, date, type, year FROM elections ORDER BY date DESC").all();
    const votedKeys = new Set(history.map((h) => h.key));
    const ballotHistory = allElections.map((e) => ({
      ...e,
      voted: votedKeys.has(e.key),
      method: history.find((h) => h.key === e.key)?.method || "",
    }));

    const household = v.household_id
      ? db.prepare(`
          SELECT id, state_voter_id, first_name, last_name, party, age, gender
          FROM voters WHERE household_id = @hid AND id != @id
          ORDER BY last_name, first_name LIMIT 25
        `).all({ hid: v.household_id, id: v.id })
      : [];

    let tags = [];
    let notes = [];
    let bio = "";
    if (db.__annotated) {
      tags = db.prepare(`
        SELECT t.id, t.name, t.color FROM anno.voter_tag_map tm
        JOIN anno.voter_tags t ON t.id = tm.tag_id
        WHERE tm.client_id = @c AND tm.voter_id = @id ORDER BY t.name
      `).all({ c: clientId, id: v.id });
      notes = db.prepare(`
        SELECT id, body, author_name AS author, created_at AS createdAt
        FROM anno.voter_notes WHERE client_id = @c AND voter_id = @id
        ORDER BY created_at DESC
      `).all({ c: clientId, id: v.id });
      const bioRow = db.prepare(
        "SELECT bio FROM anno.voter_bios WHERE client_id = @c AND voter_id = @id"
      ).get({ c: clientId, id: v.id });
      bio = bioRow?.bio || "";
    }

    return {
      id: v.id,
      stateVoterId: v.state_voter_id,
      name: fullName(v),
      firstName: v.first_name,
      lastName: v.last_name,
      party: v.party,
      rawParty: v.raw_party,
      gender: v.gender,
      age: v.age,
      birthYear: v.birth_year,
      county: v.county,
      precinct: v.precinct,
      congressional: v.congressional,
      senate: v.state_senate,
      house: v.state_house,
      commissioner: v.commissioner,
      schoolDistrict: v.school_district,
      status: v.voter_status,
      registrationDate: v.registration_date,
      ethnicity: v.ethnicity,
      language: v.language,
      phone: v.phone,
      cellPhone: v.cell_phone,
      email: v.email,
      turnoutScore: v.score,
      supportScore: v.support_score,
      partisanScore: v.partisan_score,
      generalVotes: v.general_votes,
      primaryVotes: v.primary_votes,
      totalVotes: v.total_votes,
      address: v.address_line,
      city: v.address_city,
      state: v.address_state,
      zip: v.zip,
      householdId: v.household_id,
      householdSize: v.household_size,
      lat: v.lat,
      lng: v.lng,
      voteHistory: ballotHistory,
      household,
      tags,
      notes,
      bio,
    };
  } finally {
    db.close();
  }
}

// Aggregations that power the demographics dashboard, all scoped to the current
// filter set so charts describe the active universe.
export function getVoterDemographics(clientId, { filters = {}, query = "" } = {}) {
  const db = openWarehouse(clientId, { attachAnnotations: true });
  if (!db) return null;
  try {
    const scopedFilters = { ...filters, tagClient: clientId };
    const { where, params } = buildWhere(scopedFilters, query, { annotated: db.__annotated });

    const groupBy = (col) => db.prepare(
      `SELECT ${col} AS k, COUNT(*) AS n FROM voters WHERE ${where} AND ${col} != '' GROUP BY ${col} ORDER BY n DESC`
    ).all(params).map((r) => ({ key: String(r.k), count: r.n }));

    const total = db.prepare(`SELECT COUNT(*) AS n FROM voters WHERE ${where}`).get(params).n;

    const ageBands = db.prepare(`
      SELECT CASE
        WHEN age < 25 THEN '18-24'
        WHEN age < 35 THEN '25-34'
        WHEN age < 45 THEN '35-44'
        WHEN age < 55 THEN '45-54'
        WHEN age < 65 THEN '55-64'
        WHEN age < 75 THEN '65-74'
        ELSE '75+' END AS band, COUNT(*) AS n
      FROM voters WHERE ${where} AND age IS NOT NULL
      GROUP BY band ORDER BY band
    `).all(params).map((r) => ({ key: r.band, count: r.n }));

    const turnoutBands = db.prepare(`
      SELECT CASE
        WHEN score >= 80 THEN '80-100'
        WHEN score >= 60 THEN '60-79'
        WHEN score >= 40 THEN '40-59'
        WHEN score >= 20 THEN '20-39'
        ELSE '0-19' END AS band, COUNT(*) AS n
      FROM voters WHERE ${where}
      GROUP BY band ORDER BY band DESC
    `).all(params).map((r) => ({ key: r.band, count: r.n }));

    const regByYear = db.prepare(`
      SELECT substr(registration_date, 1, 4) AS yr, COUNT(*) AS n
      FROM voters WHERE ${where} AND registration_date != ''
      GROUP BY yr ORDER BY yr
    `).all(params).map((r) => ({ key: r.yr, count: r.n }));

    const stats = db.prepare(`
      SELECT ROUND(AVG(score),1) AS avgScore, ROUND(AVG(support_score),1) AS avgSupport,
             ROUND(AVG(age),1) AS avgAge
      FROM voters WHERE ${where}
    `).get(params);

    return {
      total,
      party: groupBy("party"),
      gender: groupBy("gender"),
      ageBands,
      turnoutBands,
      ethnicity: groupBy("ethnicity"),
      language: groupBy("language"),
      senate: groupBy("state_senate"),
      house: groupBy("state_house"),
      precinct: groupBy("precinct").slice(0, 15),
      city: groupBy("address_city").slice(0, 15),
      regByYear,
      stats: {
        avgScore: stats?.avgScore || 0,
        avgSupport: stats?.avgSupport || 0,
        avgAge: stats?.avgAge || 0,
      },
    };
  } finally {
    db.close();
  }
}

function gridPrecision(zoom) {
  if (zoom >= 14) return 0;
  if (zoom >= 13) return 3;
  if (zoom >= 12) return 2;
  if (zoom >= 11) return 2;
  if (zoom >= 10) return 1;
  return 1;
}

export function queryVoterMap(clientId, { filters = {}, query = "", bbox, zoom = 11, limit = 8000 } = {}) {
  const db = openWarehouse(clientId, { attachAnnotations: true });
  if (!db) return null;

  try {
    const scopedFilters = { ...filters, tagClient: clientId };
    const { where, params } = buildWhere(scopedFilters, query, { annotated: db.__annotated });
    const coordWhere = `${where} AND lat IS NOT NULL AND lng IS NOT NULL`;
    const [west, south, east, north] = bbox || [-180, -90, 180, 90];
    const inBbox = `${coordWhere} AND lng >= @west AND lng <= @east AND lat >= @south AND lat <= @north`;
    const bboxParams = { ...params, west, south, east, north };

    const geocodedTotal = db.prepare(`SELECT COUNT(*) AS n FROM voters WHERE ${coordWhere}`).get(params).n;
    const matchingInView = db.prepare(`SELECT COUNT(*) AS n FROM voters WHERE ${inBbox}`).get(bboxParams).n;

    const z = Number(zoom) || 11;
    const maxFeatures = Math.min(Math.max(Number(limit) || 8000, 100), 15000);

    if (z < 14) {
      const prec = gridPrecision(z);
      const factor = 10 ** prec;
      const rows = db.prepare(`
        SELECT
          ROUND(lat * @factor) / @factor AS glat,
          ROUND(lng * @factor) / @factor AS glng,
          COUNT(*) AS count,
          ROUND(AVG(score), 1) AS avg_score,
          SUM(CASE WHEN party = 'D' THEN 1 ELSE 0 END) AS d_count,
          SUM(CASE WHEN party = 'R' THEN 1 ELSE 0 END) AS r_count,
          SUM(CASE WHEN party = 'I' THEN 1 ELSE 0 END) AS i_count
        FROM voters
        WHERE ${inBbox}
        GROUP BY glat, glng
        ORDER BY count DESC
        LIMIT @maxFeatures
      `).all({ ...bboxParams, factor, maxFeatures });

      return {
        mode: "cluster",
        geocodedTotal,
        matchingInView,
        features: rows.map((r) => {
          const total = r.count || 1;
          const dShare = (r.d_count || 0) / total;
          const rShare = (r.r_count || 0) / total;
          let dominant = "I";
          if (dShare >= 0.45 && dShare >= rShare) dominant = "D";
          else if (rShare >= 0.45 && rShare > dShare) dominant = "R";
          return {
            type: "Feature",
            geometry: { type: "Point", coordinates: [r.glng, r.glat] },
            properties: {
              count: r.count,
              avgScore: r.avg_score,
              party: dominant,
              dCount: r.d_count,
              rCount: r.r_count,
              iCount: r.i_count,
            },
          };
        }),
      };
    }

    const rows = db.prepare(`
      SELECT id, state_voter_id, first_name, last_name, party, score, support_score, precinct, zip,
             address_line, address_city, lat, lng, household_id
      FROM voters
      WHERE ${inBbox}
      ORDER BY score DESC
      LIMIT @maxFeatures
    `).all({ ...bboxParams, maxFeatures });

    return {
      mode: "points",
      geocodedTotal,
      matchingInView,
      features: rows.map((v) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [v.lng, v.lat] },
        properties: {
          id: v.state_voter_id || v.id,
          rowId: v.id,
          name: [v.first_name, v.last_name].filter(Boolean).join(" "),
          party: v.party,
          score: v.score,
          support: v.support_score,
          precinct: v.precinct,
          zip: v.zip,
          address: [v.address_line, v.address_city, v.zip].filter(Boolean).join(", "),
          householdId: v.household_id,
        },
      })),
    };
  } finally {
    db.close();
  }
}

export function getVoterMeta(clientId) {
  const manifest = readManifest(clientId);
  if (!manifest) return null;

  let geocodedCount = manifest.geocodedCount || 0;
  let facets = manifest.facets || null;
  if (hasWarehouse(clientId)) {
    const db = openWarehouse(clientId);
    if (db) {
      try {
        geocodedCount = db.prepare("SELECT COUNT(*) AS n FROM voters WHERE lat IS NOT NULL").get().n;
        // Low-cardinality facet lists for the filter UI + elections for the
        // vote-history filter. All cheap DISTINCT scans over indexed columns.
        const distinct = (col) =>
          db.prepare(`SELECT DISTINCT ${col} AS v FROM voters WHERE ${col} != '' ORDER BY ${col}`).all().map((r) => String(r.v));
        facets = {
          ...(facets || {}),
          cities: distinct("address_city"),
          senate: distinct("state_senate"),
          house: distinct("state_house"),
          commissioner: distinct("commissioner"),
          congressional: distinct("congressional"),
          ethnicities: distinct("ethnicity"),
          languages: distinct("language"),
          genders: distinct("gender"),
        };
        try {
          const elections = db.prepare("SELECT key, name, date, type, year FROM elections ORDER BY date DESC").all();
          facets.elections = elections;
        } catch { /* legacy warehouse without elections table */ }
      } finally {
        db.close();
      }
    }
  }

  return {
    counties: manifest.counties || [],
    precincts: manifest.precincts || [],
    ageRanges: manifest.ageRanges || [],
    partyMix: manifest.partyMix || { D: 0, R: 0, I: 0 },
    recordCount: manifest.recordCount || 0,
    geocodedCount,
    uniqueAddresses: manifest.uniqueAddresses || 0,
    source: manifest.source,
    ingestedAt: manifest.ingestedAt,
    geocodedAt: manifest.geocodedAt,
    vendor: manifest.vendor,
    map: manifest.map || DEFAULT_MAP_CONFIG,
    facets: facets || {},
    loaded: hasWarehouse(clientId),
  };
}

export function resolveVoterFile(db, clientId) {
  const manifest = readManifest(clientId);
  if (hasWarehouse(clientId) && manifest) {
    return {
      id: null,
      client_id: clientId,
      source: manifest.source,
      record_count: manifest.recordCount || 0,
      refreshed_at: manifest.ingestedAt || manifest.geocodedAt || null,
      warehouse: true,
    };
  }
  return db.prepare(
    "SELECT id, client_id, source, record_count, refreshed_at FROM voter_files WHERE client_id = ? AND active = 1 ORDER BY refreshed_at DESC LIMIT 1"
  ).get(clientId) || null;
}

export function registerVoterFileInDb(db, { clientId, manifest, storagePath = null }) {
  db.prepare("UPDATE voter_files SET active = 0 WHERE client_id = ?").run(clientId);
  db.prepare(
    `INSERT INTO voter_files (client_id, source, record_count, refreshed_at, storage_path, active)
     VALUES (?, ?, ?, ?, ?, 1)`
  ).run(
    clientId,
    manifest.source,
    manifest.recordCount,
    manifest.ingestedAt,
    storagePath || clientDir(clientId)
  );
}

// Exported so the mock generator can build a warehouse with the full schema.
export { initWarehouseSchema, warehousePath, clientDir, manifestPath, DEFAULT_MAP_CONFIG };
