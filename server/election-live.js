/**
 * Read El Paso ENR collector SQLite (Election Tracker) and adapt rows for
 * RaceDetailApp. Precinct IDs from Clarity (STATENUM) are mapped to the short
 * PRECINCT numbers used in overlay-precincts.geojson.
 *
 * Precinct scope (in-contest vs out-of-jurisdiction vs privacy-protected) is
 * resolved from the archived details.json for the promoted ingest version so
 * the map does not fall back to simulated reporting.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import { parse as parseCsvSync } from "csv-parse/sync";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

let statenumToPrecinct = null;
let overlayPrecinctIds = null;
let resultsDb = null;
let resultsDbPath = null;
let cachedResultsInode = null;
let replayCache = null;

function replayConfigured() {
  return Boolean(process.env.ELECTION_REPLAY_CSV?.trim());
}

/** Certified = final/canvassed data; provisional = election-night ENR still in flux. */
function resultsPhaseFor(mode, jurisdiction, contest) {
  if (mode === "replay") return "certified";
  const rep = jurisdiction?.reportedOnMap ?? contest?.precinctsReported ?? 0;
  const total = jurisdiction?.inContestOnMap ?? contest?.totalPrecincts ?? 0;
  if (total > 0 && rep >= total) return "certified";
  if (
    contest?.totalPrecincts > 0
    && contest.precinctsReported >= contest.totalPrecincts
  ) {
    return "certified";
  }
  return "provisional";
}

function replayLastUpdateAt() {
  const configured = process.env.ELECTION_REPLAY_UPDATED_AT?.trim();
  if (configured) return configured;
  // Default: typical Colorado canvass window after Nov 2024 general.
  return "2024-11-21T17:00:00-07:00";
}

function resolveReplayPath() {
  const configured = process.env.ELECTION_REPLAY_CSV?.trim();
  if (!configured) return null;
  return path.isAbsolute(configured) ? configured : path.join(root, configured);
}

function parseReplayCsv(text) {
  // Use csv-parse (RFC 4180) so quoted fields containing commas parse
  // correctly, rather than a naive comma split.
  let records;
  try {
    records = parseCsvSync(text, {
      columns: (header) => header.map((h) => String(h).trim().toLowerCase()),
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
      bom: true,
    });
  } catch (e) {
    console.error("[election-live] failed to parse replay CSV:", e.message);
    return [];
  }
  // Preserve prior behaviour: drop rows whose every value is blank.
  return records.filter((row) => Object.values(row).some((v) => v != null && String(v).trim() !== ""));
}

function loadReplayBundle() {
  if (replayCache) return replayCache;
  const csvPath = resolveReplayPath();
  if (!csvPath || !fs.existsSync(csvPath)) return null;

  const yesField = (process.env.ELECTION_REPLAY_YES_FIELD || "yes_pct").toLowerCase();
  const noField = (process.env.ELECTION_REPLAY_NO_FIELD || "no_pct").toLowerCase();
  const overlayIds = loadOverlayPrecinctIds();
  const rows = parseReplayCsv(fs.readFileSync(csvPath, "utf8"));

  const precincts = {};
  let yesVotesTotal = 0;
  let noVotesTotal = 0;
  let registeredTotal = 0;
  let reportedOnMap = 0;

  for (const id of overlayIds) {
    precincts[id] = {
      inContest: false,
      reported: false,
      protected: false,
      yesVotes: 0,
      noVotes: 0,
      ballots: 0,
      yesPct: null,
    };
  }

  for (const row of rows) {
    const id = String(row.precinct || "").trim();
    if (!id || !overlayIds.has(id)) continue;

    const yesPct = row[yesField] !== "" && row[yesField] != null ? +row[yesField] : null;
    const noPct = row[noField] !== "" && row[noField] != null ? +row[noField] : null;
    if (yesPct == null || Number.isNaN(yesPct)) continue;

    const ballots = row.votes_cast != null && row.votes_cast !== ""
      ? +row.votes_cast
      : row.ballots != null && row.ballots !== ""
        ? +row.ballots
        : 1000;
    const yesVotes = Math.round(ballots * yesPct / 100);
    const noVotes = noPct != null && !Number.isNaN(noPct)
      ? Math.round(ballots * noPct / 100)
      : ballots - yesVotes;

    precincts[id] = {
      inContest: true,
      reported: true,
      protected: false,
      yesVotes,
      noVotes,
      ballots: yesVotes + noVotes,
      yesPct: +yesPct.toFixed(1),
      leaderPct: +yesPct.toFixed(1),
      leaderName: process.env.ELECTION_REPLAY_LEADER_LABEL?.trim() || "Leading candidate",
      registered: row.registered != null && row.registered !== "" ? +row.registered : null,
    };
    yesVotesTotal += yesVotes;
    noVotesTotal += noVotes;
    if (precincts[id].registered) registeredTotal += precincts[id].registered;
    reportedOnMap++;
  }

  const inContestOnMap = Object.values(precincts).filter((p) => p.inContest).length;
  const ballots = yesVotesTotal + noVotesTotal;
  const leaderPct = ballots > 0 ? +((yesVotesTotal / ballots) * 100).toFixed(1) : null;
  const leaderLabel = process.env.ELECTION_REPLAY_LEADER_LABEL?.trim() || "Leading candidate";

  replayCache = {
    csvPath,
    contestName:
      process.env.ELECTION_REPLAY_CONTEST_NAME
      || "Prior election replay (D11 precincts)",
    precincts,
    registeredTotal: registeredTotal || null,
    totals: {
      yesVotes: yesVotesTotal,
      noVotes: noVotesTotal,
      yesPct: leaderPct,
      leaderPct,
      leaderName: leaderLabel,
      ballots,
      isMeasure: false,
      choices: leaderPct != null
        ? [
            { name: leaderLabel, party: null, votes: yesVotesTotal, pct: leaderPct },
            { name: "Other", party: null, votes: noVotesTotal, pct: ballots > 0 ? +((noVotesTotal / ballots) * 100).toFixed(1) : null },
          ]
        : [],
    },
    jurisdiction: {
      mapPrecinctCount: overlayIds.size,
      inContestOnMap,
      reportedOnMap,
      protectedOnMap: inContestOnMap - reportedOnMap,
      outOfContestOnMap: overlayIds.size - inContestOnMap,
    },
  };
  return replayCache;
}

function getReplayResults() {
  const bundle = loadReplayBundle();
  if (!bundle) {
    return {
      available: false,
      mode: "replay",
      reason: process.env.ELECTION_REPLAY_CSV
        ? "replay CSV file not found"
        : "not_configured",
    };
  }

  const certifiedAt = replayLastUpdateAt();
  const resultsPhase = resultsPhaseFor("replay", bundle.jurisdiction, {
    precinctsReported: bundle.jurisdiction.reportedOnMap,
    totalPrecincts: bundle.jurisdiction.inContestOnMap,
  });

  return {
    available: true,
    mode: "replay",
    resultsPhase,
    source: path.basename(bundle.csvPath),
    heartbeat: {
      lastVersion: "replay",
      lastUpdateAt: certifiedAt,
      note: "certified prior-election replay (static CSV)",
    },
    contest: {
      contestKey: "replay",
      name: bundle.contestName,
      precinctsReported: bundle.jurisdiction.reportedOnMap,
      totalPrecincts: bundle.jurisdiction.inContestOnMap,
      registered: bundle.registeredTotal,
      ballotsCast: bundle.totals.ballots,
      totalVotes: bundle.totals.ballots,
      updatedAt: certifiedAt,
    },
    totals: bundle.totals,
    precincts: bundle.precincts,
    jurisdiction: bundle.jurisdiction,
    precinctRowCount: bundle.jurisdiction.reportedOnMap,
  };
}

function loadPrecinctMap() {
  if (statenumToPrecinct) return statenumToPrecinct;
  const geoPath = path.join(root, "public/election-data/Precincts.geojson");
  statenumToPrecinct = new Map();
  // A missing/corrupt geojson (e.g. a deploy that omits public/election-data)
  // must degrade to empty results, not 500 every /api/election/live call.
  try {
    const fc = JSON.parse(fs.readFileSync(geoPath, "utf8"));
    for (const f of fc.features) {
      const sn = String(f.properties.STATENUM);
      statenumToPrecinct.set(sn, String(f.properties.PRECINCT));
    }
  } catch (e) {
    console.error(`[election] could not load ${geoPath}:`, e?.message || e);
  }
  return statenumToPrecinct;
}

function loadOverlayPrecinctIds() {
  if (overlayPrecinctIds) return overlayPrecinctIds;
  const geoPath = path.join(root, "public/election-data/overlay-precincts.geojson");
  overlayPrecinctIds = new Set();
  try {
    const fc = JSON.parse(fs.readFileSync(geoPath, "utf8"));
    for (const f of fc.features) {
      overlayPrecinctIds.add(String(f.properties.PRECINCT));
    }
  } catch (e) {
    console.error(`[election] could not load ${geoPath}:`, e?.message || e);
  }
  return overlayPrecinctIds;
}

function clarityBaseId(label) {
  const s = String(label).trim();
  const dash = s.indexOf(" - ");
  return dash >= 0 ? s.slice(0, dash).trim() : s;
}

function resolveResultsDbPath() {
  const configured = process.env.ELECTION_RESULTS_DB_PATH?.trim();
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.join(root, configured);
  }
  return path.join(root, "data", "election", "results.db");
}

/**
 * Close and drop the cached results.db handle so the next openResultsDb()
 * reopens the (possibly recreated) file. Must be called whenever the file is
 * unlinked/recreated on disk — otherwise the cached handle keeps pointing at
 * the deleted inode and serves stale/frozen results until restart.
 */
export function invalidateResultsDb() {
  if (resultsDb) {
    try { resultsDb.close(); } catch { /* already closed */ }
  }
  resultsDb = null;
  resultsDbPath = null;
  cachedResultsInode = null;
}

function openResultsDb() {
  const resolved = resolveResultsDbPath();
  if (!fs.existsSync(resolved)) {
    // File is gone (e.g. wiped) — drop any stale handle to a deleted inode.
    invalidateResultsDb();
    return null;
  }
  if (resultsDb && resultsDbPath === resolved) {
    // Guard against the file being replaced (unlinked + recreated) at the same
    // path: if the inode changed, the cached handle is stale.
    try {
      const currentIno = fs.statSync(resolved).ino;
      if (cachedResultsInode != null && currentIno !== cachedResultsInode) {
        invalidateResultsDb();
      } else {
        return resultsDb;
      }
    } catch {
      invalidateResultsDb();
    }
  }
  if (resultsDb) {
    resultsDb.close();
    resultsDb = null;
  }
  resultsDbPath = resolved;
  resultsDb = new Database(resolved, { readonly: true, fileMustExist: true });
  try { cachedResultsInode = fs.statSync(resolved).ino; } catch { cachedResultsInode = null; }
  return resultsDb;
}

function isYesChoice(name, code) {
  if (code === "Y") return true;
  const n = (name || "").toLowerCase();
  return n.includes("yes") || n.includes("/for");
}

function isNoChoice(name, code) {
  if (code === "N") return true;
  const n = (name || "").toLowerCase();
  return n.includes("no") || n.includes("/against");
}

function contestPatternsFromEnv() {
  const raw = process.env.ELECTION_CONTEST_PATTERNS?.trim();
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function contestMatchesPatterns(name, patterns) {
  if (!patterns?.length) return true;
  const n = String(name || "").toLowerCase();
  return patterns.some((p) => n.includes(p.toLowerCase()));
}

function summarizeChoiceVotes(choiceVotes, choiceByName, isMeasure) {
  const entries = Object.entries(choiceVotes || {});
  const ballots = entries.reduce((s, [, v]) => s + v, 0);
  if (ballots <= 0) {
    return {
      ballots: 0,
      yesVotes: 0,
      noVotes: 0,
      yesPct: null,
      leaderName: null,
      leaderPct: null,
      choices: [],
      reported: false,
    };
  }

  let yesVotes = 0;
  let noVotes = 0;
  let leaderName = null;
  let leaderVotes = 0;
  const choices = entries.map(([name, votes]) => {
    const ch = choiceByName.get(name);
    if (isYesChoice(name, ch?.party_or_code)) yesVotes += votes;
    if (isNoChoice(name, ch?.party_or_code)) noVotes += votes;
    if (votes > leaderVotes) {
      leaderVotes = votes;
      leaderName = name;
    }
    return {
      name,
      party: ch?.party_or_code ?? null,
      votes,
      pct: +((votes / ballots) * 100).toFixed(1),
    };
  }).sort((a, b) => b.votes - a.votes);

  const leaderPct = +((leaderVotes / ballots) * 100).toFixed(1);
  const yesPct = isMeasure && yesVotes + noVotes > 0
    ? +((yesVotes / (yesVotes + noVotes)) * 100).toFixed(1)
    : leaderPct;

  return {
    ballots,
    yesVotes,
    noVotes,
    yesPct,
    leaderName,
    leaderPct,
    choices,
    reported: true,
  };
}

function precinctResultFromSummary(summary, isMeasure) {
  return {
    inContest: true,
    reported: summary.reported,
    protected: false,
    yesVotes: summary.yesVotes,
    noVotes: summary.noVotes,
    ballots: summary.ballots,
    yesPct: summary.yesPct,
    leaderName: summary.leaderName,
    leaderPct: summary.leaderPct,
    choices: summary.choices,
  };
}

function rawDirForVersion(conn, version) {
  const row = conn
    .prepare(
      `SELECT raw_path FROM ingest_log
       WHERE version = ? AND status = 'promoted'
       ORDER BY id DESC LIMIT 1`
    )
    .get(version);
  if (row?.raw_path && fs.existsSync(path.join(row.raw_path, "details.json"))) {
    return row.raw_path;
  }
  const candidate = path.join(path.dirname(resultsDbPath), "raw", version);
  if (fs.existsSync(path.join(candidate, "details.json"))) return candidate;
  return null;
}

function loadRawDetails(conn, version) {
  const dir = rawDirForVersion(conn, version);
  if (!dir) return null;
  try {
    const details = JSON.parse(
      fs.readFileSync(path.join(dir, "details.json"), "utf8")
    );
    const summary = JSON.parse(
      fs.readFileSync(path.join(dir, "sum.json"), "utf8")
    );
    return { details, summary };
  } catch {
    return null;
  }
}

function buildPrecinctScope(contestKey, choices, detailContest, summaryContest, overlayIds) {
  const pmap = loadPrecinctMap();
  const choiceByName = new Map(choices.map((c) => [c.name, c]));
  const yesChoice = choices.find((c) => isYesChoice(c.name, c.party_or_code));
  const noChoice = choices.find((c) => isNoChoice(c.name, c.party_or_code));
  const isMeasure = !!(yesChoice && noChoice);
  const names = summaryContest?.CH || choices.map((c) => c.name);
  const labels = detailContest?.P || [];
  const vmatrix = detailContest?.V || [];

  /** @type {Record<string, { choiceVotes: Record<string, number>, inContest: boolean, protected: boolean }>} */
  const agg = {};

  for (let i = 0; i < labels.length; i++) {
    const label = String(labels[i]);
    const precId = pmap.get(clarityBaseId(label));
    if (!precId) continue;

    const cells = vmatrix[i] || [];
    const hasNumeric = cells.some(
      (c) => c !== "protected" && c != null && c !== "" && !Number.isNaN(+c)
    );
    const allProtected =
      cells.length > 0 && cells.every((c) => c === "protected");

    if (!agg[precId]) {
      agg[precId] = {
        choiceVotes: {},
        inContest: true,
        protected: !hasNumeric,
      };
    }

    if (hasNumeric) {
      agg[precId].protected = false;
      for (let ci = 0; ci < cells.length; ci++) {
        const cell = cells[ci];
        if (cell === "protected" || cell == null) continue;
        const cname = names[ci] ?? `choice_${ci}`;
        const votes = +cell || 0;
        agg[precId].choiceVotes[cname] = (agg[precId].choiceVotes[cname] || 0) + votes;
      }
    } else if (allProtected) {
      agg[precId].protected = true;
    }
  }

  const precincts = {};
  let inContestOnMap = 0;
  let reportedOnMap = 0;
  let protectedOnMap = 0;
  let outOfContestOnMap = 0;

  for (const id of overlayIds) {
    const row = agg[id];
    if (!row) {
      precincts[id] = {
        inContest: false,
        reported: false,
        protected: false,
        yesVotes: 0,
        noVotes: 0,
        ballots: 0,
        yesPct: null,
        leaderName: null,
        leaderPct: null,
        choices: [],
      };
      outOfContestOnMap++;
      continue;
    }

    const summary = summarizeChoiceVotes(row.choiceVotes, choiceByName, isMeasure);
    if (row.protected && !summary.reported) {
      precincts[id] = {
        inContest: true,
        reported: false,
        protected: true,
        yesVotes: 0,
        noVotes: 0,
        ballots: 0,
        yesPct: null,
        leaderName: null,
        leaderPct: null,
        choices: [],
      };
      inContestOnMap++;
      protectedOnMap++;
      continue;
    }

    precincts[id] = precinctResultFromSummary(summary, isMeasure);
    inContestOnMap++;
    if (summary.reported) reportedOnMap++;
    else if (row.protected) protectedOnMap++;
  }

  return {
    precincts,
    isMeasure,
    jurisdiction: {
      mapPrecinctCount: overlayIds.size,
      inContestOnMap,
      reportedOnMap,
      protectedOnMap,
      outOfContestOnMap,
    },
  };
}

function resolveContestKey(conn, { contestKey, contestName } = {}) {
  if (contestKey) return String(contestKey);
  const envKey = process.env.ELECTION_CONTEST_KEY;
  if (envKey) return String(envKey);
  const filter = contestName || process.env.ELECTION_CONTEST_NAME;
  if (filter) {
    const row = conn
      .prepare(
        `SELECT contest_key FROM contests
         WHERE name LIKE ? COLLATE NOCASE
         ORDER BY CAST(contest_key AS INTEGER) LIMIT 1`
      )
      .get(`%${filter}%`);
    if (row) return String(row.contest_key);
  }
  const patterns = contestPatternsFromEnv();
  if (patterns.length) {
    const rows = conn
      .prepare(
        `SELECT contest_key, name FROM contests
         ORDER BY CAST(contest_key AS INTEGER)`
      )
      .all();
    const hit = rows.find((r) => contestMatchesPatterns(r.name, patterns));
    if (hit) return String(hit.contest_key);
  }
  return null;
}

export function getElectionLiveStatus() {
  if (replayConfigured()) {
    const bundle = loadReplayBundle();
    return {
      available: Boolean(bundle),
      mode: "replay",
      reason: bundle ? null : "replay CSV file not found",
      replayCsv: resolveReplayPath(),
      configuredContestName:
        process.env.ELECTION_REPLAY_CONTEST_NAME
        || "Prior election replay (D11 precincts)",
      heartbeat: bundle
        ? {
            lastVersion: "replay",
            lastUpdateAt: replayLastUpdateAt(),
            note: "certified prior-election replay (static CSV)",
          }
        : null,
      resultsPhase: bundle ? "certified" : null,
    };
  }

  const conn = openResultsDb();
  if (!conn) {
    return {
      available: false,
      reason: process.env.ELECTION_RESULTS_DB_PATH
        ? "results database file not found"
        : "ELECTION_RESULTS_DB_PATH not configured",
    };
  }
  const hb = conn.prepare("SELECT * FROM heartbeat WHERE id = 1").get();
  const contestCount = conn.prepare("SELECT COUNT(*) AS n FROM contests").get().n;
  return {
    available: true,
    mode: "live",
    heartbeat: hb
      ? {
          lastVersion: hb.last_version,
          lastUpdateAt: hb.last_update_at,
          note: hb.note,
        }
      : null,
    contestCount,
    configuredContestName: process.env.ELECTION_CONTEST_NAME || null,
    configuredContestPatterns: contestPatternsFromEnv(),
    configuredContestKey: process.env.ELECTION_CONTEST_KEY || null,
    dbPath: resultsDbPath,
  };
}

export function listElectionContests(patterns) {
  if (replayConfigured()) {
    const bundle = loadReplayBundle();
    if (!bundle) return [];
    return [{
      contestKey: "replay",
      name: bundle.contestName,
      precinctsReported: bundle.jurisdiction.reportedOnMap,
      totalPrecincts: bundle.jurisdiction.inContestOnMap,
      ballotsCast: bundle.totals.ballots,
      registered: bundle.registeredTotal,
      updatedAt: replayLastUpdateAt(),
    }];
  }
  const conn = openResultsDb();
  if (!conn) return [];
  const filterPatterns = patterns?.length ? patterns : contestPatternsFromEnv();
  const rows = conn
    .prepare(
      `SELECT contest_key AS contestKey, name, precincts_reported AS precinctsReported,
              total_precincts AS totalPrecincts, ballots_cast AS ballotsCast,
              registered, updated_at AS updatedAt
       FROM contests ORDER BY CAST(contest_key AS INTEGER)`
    )
    .all();
  if (!filterPatterns.length) return rows;
  return rows.filter((r) => contestMatchesPatterns(r.name, filterPatterns));
}

export function getElectionLiveResults({ contestKey, contestName } = {}) {
  if (replayConfigured()) {
    return getReplayResults();
  }

  const conn = openResultsDb();
  if (!conn) {
    return {
      available: false,
      reason: process.env.ELECTION_RESULTS_DB_PATH
        ? "results database file not found"
        : "not_configured",
    };
  }

  const key = resolveContestKey(conn, { contestKey, contestName });
  if (!key) {
    return {
      available: true,
      contest: null,
      reason: "contest_not_found",
      configuredContestName: process.env.ELECTION_CONTEST_NAME || null,
    configuredContestPatterns: contestPatternsFromEnv(),
    };
  }

  const contest = conn.prepare("SELECT * FROM contests WHERE contest_key = ?").get(key);
  if (!contest) {
    return { available: true, contest: null, reason: "contest_not_found" };
  }

  const choices = conn
    .prepare("SELECT * FROM choices WHERE contest_key = ? ORDER BY choice_idx")
    .all(key);

  const yesChoice = choices.find((c) => isYesChoice(c.name, c.party_or_code));
  const noChoice = choices.find((c) => isNoChoice(c.name, c.party_or_code));
  const isMeasure = !!(yesChoice && noChoice);

  const yesVotes = yesChoice?.votes ?? 0;
  const noVotes = noChoice?.votes ?? 0;
  const totalBallots = choices.reduce((s, c) => s + (c.votes || 0), 0);
  let yesPct = null;
  let leaderName = null;
  let leaderPct = null;
  const choiceTotals = choices.map((c) => ({
    name: c.name,
    party: c.party_or_code ?? null,
    votes: c.votes ?? 0,
    pct: totalBallots > 0 ? +(((c.votes ?? 0) / totalBallots) * 100).toFixed(1) : null,
  })).sort((a, b) => b.votes - a.votes);

  if (isMeasure && yesVotes + noVotes > 0) {
    yesPct = +((yesVotes / (yesVotes + noVotes)) * 100).toFixed(1);
    leaderName = yesChoice?.name ?? "Yes";
    leaderPct = yesPct;
  } else if (choiceTotals.length > 0 && totalBallots > 0) {
    leaderName = choiceTotals[0].name;
    leaderPct = choiceTotals[0].pct;
    yesPct = leaderPct;
  }

  const hb = conn.prepare("SELECT * FROM heartbeat WHERE id = 1").get();
  const version = hb?.last_version;
  const raw = version ? loadRawDetails(conn, version) : null;
  const overlayIds = loadOverlayPrecinctIds();

  let precincts = {};
  let jurisdiction = null;
  let scopeIsMeasure = isMeasure;

  if (raw?.details?.Contests) {
    const detailContest = raw.details.Contests.find((c) => String(c.K) === key);
    const summaryContest = raw.summary?.Contests?.find((c) => String(c.K) === key);
    if (detailContest) {
      const scope = buildPrecinctScope(
        key,
        choices,
        detailContest,
        summaryContest,
        overlayIds
      );
      precincts = scope.precincts;
      jurisdiction = scope.jurisdiction;
      scopeIsMeasure = scope.isMeasure;
    }
  }

  // Fall back to DB rows when details scope is unavailable (numeric cells only).
  if (!jurisdiction) {
    const pmap = loadPrecinctMap();
    const choiceByName = new Map(choices.map((c) => [c.name, c]));
    const prows = conn
      .prepare(
        "SELECT precinct, choice_name, votes FROM precinct_results WHERE contest_key = ?"
      )
      .all(key);

    const agg = {};
    for (const row of prows) {
      const precId = pmap.get(clarityBaseId(row.precinct));
      if (!precId) continue;
      if (!agg[precId]) agg[precId] = { choiceVotes: {} };
      agg[precId].choiceVotes[row.choice_name] =
        (agg[precId].choiceVotes[row.choice_name] || 0) + (row.votes || 0);
    }

    let inContestOnMap = 0;
    let reportedOnMap = 0;
    for (const id of overlayIds) {
      const row = agg[id];
      if (!row) {
        precincts[id] = {
          inContest: false,
          reported: false,
          protected: false,
          yesVotes: 0,
          noVotes: 0,
          ballots: 0,
          yesPct: null,
          leaderName: null,
          leaderPct: null,
          choices: [],
        };
        continue;
      }
      const summary = summarizeChoiceVotes(row.choiceVotes, choiceByName, isMeasure);
      precincts[id] = precinctResultFromSummary(summary, isMeasure);
      inContestOnMap++;
      if (summary.reported) reportedOnMap++;
    }

    jurisdiction = {
      mapPrecinctCount: overlayIds.size,
      inContestOnMap,
      reportedOnMap,
      protectedOnMap: 0,
      outOfContestOnMap: overlayIds.size - inContestOnMap,
    };
    scopeIsMeasure = isMeasure;
  }

  const contestDto = {
    contestKey: contest.contest_key,
    name: contest.name,
    precinctsReported: contest.precincts_reported,
    totalPrecincts: contest.total_precincts,
    registered: contest.registered,
    ballotsCast: contest.ballots_cast,
    totalVotes: contest.total_votes,
    updatedAt: contest.updated_at,
  };

  const meaningful = choiceTotals.filter((c) => {
    const n = (c.name || "").toLowerCase();
    return !/write.?in|undervote|overvote|blank|none of the above/.test(n);
  });
  const isUnopposed = !scopeIsMeasure && meaningful.length === 1;
  const turnoutPct = contest.registered > 0 && contest.ballots_cast > 0
    ? +((contest.ballots_cast / contest.registered) * 100).toFixed(1)
    : null;

  return {
    available: true,
    mode: "live",
    resultsPhase: resultsPhaseFor("live", jurisdiction, contestDto),
    heartbeat: hb
      ? {
          lastVersion: hb.last_version,
          lastUpdateAt: hb.last_update_at,
          note: hb.note,
        }
      : null,
    contest: contestDto,
    totals: {
      yesVotes,
      noVotes,
      yesPct,
      leaderName,
      leaderPct,
      choices: choiceTotals,
      ballots: scopeIsMeasure ? yesVotes + noVotes : totalBallots,
      isMeasure: scopeIsMeasure,
      isUnopposed,
      turnoutPct,
      nomineeName: isUnopposed ? meaningful[0]?.name ?? leaderName : null,
    },
    precincts,
    jurisdiction,
    precinctRowCount: Object.values(precincts).filter((p) => p.reported).length,
  };
}
