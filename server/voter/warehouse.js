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

function openWarehouse(clientId, { readonly = true } = {}) {
  const dbPath = warehousePath(clientId);
  if (!fs.existsSync(dbPath)) return null;
  const db = new Database(dbPath, { readonly });
  db.pragma("journal_mode = WAL");
  return db;
}

function initWarehouseSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS voters (
      id TEXT PRIMARY KEY,
      state_voter_id TEXT NOT NULL DEFAULT '',
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      party TEXT NOT NULL DEFAULT 'I',
      raw_party TEXT NOT NULL DEFAULT '',
      county TEXT NOT NULL DEFAULT '',
      score REAL NOT NULL DEFAULT 0,
      precinct TEXT NOT NULL DEFAULT '',
      zip TEXT NOT NULL DEFAULT '',
      voter_status TEXT NOT NULL DEFAULT '',
      age_range TEXT NOT NULL DEFAULT '',
      household_id TEXT NOT NULL DEFAULT '',
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
    CREATE INDEX IF NOT EXISTS idx_voters_name ON voters(last_name, first_name);
    CREATE INDEX IF NOT EXISTS idx_voters_state_id ON voters(state_voter_id);
    CREATE INDEX IF NOT EXISTS idx_voters_precinct ON voters(precinct);
    CREATE INDEX IF NOT EXISTS idx_voters_coords ON voters(lat, lng);
    CREATE INDEX IF NOT EXISTS idx_voters_address_key ON voters(address_key);
  `);
}

function mapRow(vendor, row) {
  if (vendor === "targetsmart") return mapTargetSmartRow(row);
  throw new Error(`Unsupported vendor: ${vendor}`);
}

function stageSourceFile(sourcePath, destPath, { link = false } = {}) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  // If the source IS the staged destination, don't unlink+copy — that would
  // delete the source and then fail the copy, destroying the voter file.
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

function buildWhere(filters = {}, query = "", { bbox } = {}) {
  const clauses = ["1=1"];
  const params = {};

  if (filters.party && filters.party !== "All") {
    clauses.push("party = @party");
    params.party = filters.party;
  }

  if (filters.county && filters.county !== "All") {
    clauses.push("county = @county");
    params.county = filters.county;
  }

  if (filters.precinct && filters.precinct !== "All") {
    clauses.push("precinct = @precinct");
    params.precinct = filters.precinct;
  }

  if (filters.ageRange && filters.ageRange !== "All") {
    clauses.push("age_range = @ageRange");
    params.ageRange = filters.ageRange;
  }

  if (filters.status && filters.status !== "All") {
    clauses.push("voter_status = @status");
    params.status = filters.status;
  }

  const scoreMin = Number(filters.scoreMin);
  if (Number.isFinite(scoreMin) && scoreMin > 0) {
    clauses.push("score >= @scoreMin");
    params.scoreMin = scoreMin;
  }

  if (filters.turnoutOnly) {
    clauses.push("score > 0");
  }

  const q = String(query || "").trim();
  if (q) {
    clauses.push(`(
      first_name LIKE @qLike ESCAPE '\\' OR
      last_name LIKE @qLike ESCAPE '\\' OR
      state_voter_id LIKE @qLike ESCAPE '\\' OR
      id LIKE @qLike ESCAPE '\\' OR
      address_line LIKE @qLike ESCAPE '\\'
    )`);
    params.qLike = `%${escapeLike(q)}%`;
  }

  if (bbox && bbox.length === 4) {
    const [west, south, east, north] = bbox;
    clauses.push("lat IS NOT NULL AND lng IS NOT NULL");
    clauses.push("lng >= @west AND lng <= @east AND lat >= @south AND lat <= @north");
    params.west = west;
    params.south = south;
    params.east = east;
    params.north = north;
  }

  return { where: clauses.join(" AND "), params };
}

function csvCell(value) {
  let s = String(value ?? "");
  // Neutralize spreadsheet formula injection: a cell beginning with one of
  // = + - @ (or a leading tab/CR) is treated as a formula by Excel/Sheets.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// Escape LIKE wildcards (% and _) and the escape char so user input can't
// inject wildcards / force full-table scans. Pair with ESCAPE '\' in the SQL.
function escapeLike(s) {
  return String(s).replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

const EXPORT_COLUMNS = [
  ["state_voter_id", (r) => r.state_voter_id],
  ["first_name", (r) => r.first_name],
  ["last_name", (r) => r.last_name],
  ["party", (r) => r.party],
  ["score", (r) => r.score],
  ["precinct", (r) => r.precinct],
  ["county", (r) => r.county],
  ["zip", (r) => r.zip],
  ["address_line", (r) => r.address_line],
  ["address_city", (r) => r.address_city],
  ["lat", (r) => r.lat ?? ""],
  ["lng", (r) => r.lng ?? ""],
  ["voter_status", (r) => r.voter_status],
  ["age_range", (r) => r.age_range],
  ["household_id", (r) => r.household_id],
];

export function countVoterExport(clientId, { filters = {}, query = "", bbox } = {}) {
  const db = openWarehouse(clientId);
  if (!db) return 0;
  try {
    const { where, params } = buildWhere(filters, query, { bbox });
    return db.prepare(`SELECT COUNT(*) AS n FROM voters WHERE ${where}`).get(params).n;
  } finally {
    db.close();
  }
}

export function* iterateVoterExport(clientId, { filters = {}, query = "", bbox } = {}) {
  const db = openWarehouse(clientId);
  if (!db) return;
  try {
    const { where, params } = buildWhere(filters, query, { bbox });
    const rows = db.prepare(`
      SELECT state_voter_id, first_name, last_name, party, score, precinct, county, zip,
             address_line, address_city, lat, lng, voter_status, age_range, household_id
      FROM voters
      WHERE ${where}
      ORDER BY last_name COLLATE NOCASE, first_name COLLATE NOCASE
    `).iterate(params);
    for (const row of rows) yield row;
  } finally {
    db.close();
  }
}

export function voterExportCsvHeader() {
  return EXPORT_COLUMNS.map(([h]) => h).join(",");
}

export function voterExportCsvRow(row) {
  return EXPORT_COLUMNS.map(([, pick]) => csvCell(pick(row))).join(",");
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
  // Build into a temp db and atomically rename over the live warehouse only
  // after a successful ingest, so a mid-ingest crash can never leave a
  // truncated warehouse.db that hasWarehouse()/resolveVoterFile() trust.
  const tmpDbPath = `${dbPath}.tmp`;
  removeDbFiles(tmpDbPath);

  const db = new Database(tmpDbPath);
  db.pragma("journal_mode = WAL");
  initWarehouseSchema(db);

  // Upsert on duplicate id so a repeated voter id updates rather than throwing
  // a UNIQUE-constraint error inside the stream handler (which would crash the
  // process and leave a partial warehouse).
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
      // Any error thrown per-row (mapping, UNIQUE, disk) must abort the stream
      // cleanly via reject() instead of crashing the process.
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

  // Compute distinct address count from the db instead of holding a Map of
  // every unique address in memory (OOM territory on statewide files).
  let uniqueAddresses = 0;
  try {
    uniqueAddresses = db.prepare(
      "SELECT COUNT(DISTINCT address_key) AS n FROM voters WHERE address_key != ''"
    ).get().n;
  } finally {
    // Fully close the tmp db (checkpointing/removing its WAL/SHM) before rename.
    db.close();
  }

  // Atomically swap the freshly built db over the live one; clear stale WAL/SHM.
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

  // Stream ungeocoded distinct addresses in chunks via .iterate() instead of
  // loading the entire result set (statewide files are OOM territory).
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

export function queryVoters(clientId, { filters = {}, query = "", page = 1, pageSize = 50 } = {}) {
  const db = openWarehouse(clientId);
  if (!db) return null;

  try {
    const { where, params } = buildWhere(filters, query);
    const limit = Math.min(Math.max(Number(pageSize) || 50, 1), 200);
    const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

    const total = db.prepare(`SELECT COUNT(*) AS n FROM voters WHERE ${where}`).get(params).n;
    const rows = db.prepare(`
      SELECT id, state_voter_id, first_name, last_name, party, county, score, precinct, zip,
             address_line, address_city, lat, lng
      FROM voters
      WHERE ${where}
      ORDER BY last_name COLLATE NOCASE, first_name COLLATE NOCASE
      LIMIT @limit OFFSET @offset
    `).all({ ...params, limit, offset });

    const stats = db.prepare(`
      SELECT
        ROUND(AVG(score), 1) AS avgScore,
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
        name: [v.first_name, v.last_name].filter(Boolean).join(" "),
        party: v.party,
        county: v.county,
        score: v.score,
        precinct: v.precinct,
        zip: v.zip,
        address: [v.address_line, v.address_city, v.zip].filter(Boolean).join(", "),
        lat: v.lat,
        lng: v.lng,
      })),
      stats: {
        avgScore: stats?.avgScore || 0,
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

function gridPrecision(zoom) {
  if (zoom >= 14) return 0;
  if (zoom >= 13) return 3;
  if (zoom >= 12) return 2;
  if (zoom >= 11) return 2;
  if (zoom >= 10) return 1;
  return 1;
}

export function queryVoterMap(clientId, { filters = {}, query = "", bbox, zoom = 11, limit = 8000 } = {}) {
  const db = openWarehouse(clientId);
  if (!db) return null;

  try {
    const { where, params } = buildWhere(filters, query);
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
      SELECT state_voter_id, first_name, last_name, party, score, precinct, zip,
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
          id: v.state_voter_id,
          name: [v.first_name, v.last_name].filter(Boolean).join(" "),
          party: v.party,
          score: v.score,
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
  if (hasWarehouse(clientId)) {
    const db = openWarehouse(clientId);
    if (db) {
      try {
        geocodedCount = db.prepare("SELECT COUNT(*) AS n FROM voters WHERE lat IS NOT NULL").get().n;
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
    loaded: hasWarehouse(clientId),
  };
}

/** Prefer ingested warehouse manifest over voter_files.active (bootstrap may register poll CSVs last). */
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
