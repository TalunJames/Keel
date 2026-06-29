/**
 * Manage the bundled El Paso ENR Python collector as a child process.
 * Writes results.db under data/election/ for election-live.js to read.
 */
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const COLLECTOR_DIR = path.join(root, "election-collector");
const RUN_PY = path.join(COLLECTOR_DIR, "run.py");
const CONFIG_PATH = path.join(root, "data", "election", "collector-config.json");

let pollProc = null;
let wantRunning = false;
let restartTimer = null;
let autoEidTimer = null;
let activeConfig = null;
let lastLogLines = [];

const DEFAULTS = {
  eid: "124432",
  enforcePollsClose: false,
  pollSeconds: 7,
  watchdogMinutes: 20,
  pollsCloseUtc: "2026-07-01T01:00:00+00:00",
  autoStart: false,
  primaryFeedReady: false,
};

function electionDataDir() {
  return process.env.ELECTION_DATA_DIR
    ? (path.isAbsolute(process.env.ELECTION_DATA_DIR)
      ? process.env.ELECTION_DATA_DIR
      : path.join(root, process.env.ELECTION_DATA_DIR))
    : path.join(root, "data", "election");
}

function defaultDbPath() {
  return process.env.EP_DB_PATH
    || process.env.ELECTION_RESULTS_DB_PATH
    || path.join(electionDataDir(), "results.db");
}

function defaultRawDir() {
  return process.env.EP_RAW_DIR || path.join(electionDataDir(), "raw");
}

function loadPersistedConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    }
  } catch (e) {
    console.warn("[collector] could not read config:", e.message);
  }
  return {};
}

function savePersistedConfig(cfg) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

export function getCollectorConfig() {
  const persisted = loadPersistedConfig();
  const cfg = {
    ...DEFAULTS,
    eid: process.env.EP_EID || DEFAULTS.eid,
    enforcePollsClose: process.env.EP_ENFORCE_POLLS_CLOSE === "1",
    pollSeconds: Number(process.env.EP_POLL_SECONDS || DEFAULTS.pollSeconds),
    watchdogMinutes: Number(process.env.EP_WATCHDOG_MINUTES || DEFAULTS.watchdogMinutes),
    pollsCloseUtc: process.env.EP_POLLS_CLOSE_UTC || DEFAULTS.pollsCloseUtc,
    autoStart: process.env.ELECTION_COLLECTOR_AUTO_START === "1",
    dbPath: defaultDbPath(),
    rawDir: defaultRawDir(),
    ...persisted,
  };
  cfg.dbPath = cfg.dbPath || defaultDbPath();
  cfg.rawDir = cfg.rawDir || defaultRawDir();
  return cfg;
}

export function updateCollectorConfig(patch) {
  const current = getCollectorConfig();
  const next = {
    ...current,
    ...patch,
    dbPath: current.dbPath,
    rawDir: current.rawDir,
  };
  if (patch.eid != null) next.eid = String(patch.eid).trim();
  if (patch.enforcePollsClose != null) next.enforcePollsClose = !!patch.enforcePollsClose;
  if (patch.pollSeconds != null) next.pollSeconds = Math.max(3, Number(patch.pollSeconds) || 7);
  if (patch.watchdogMinutes != null) next.watchdogMinutes = Math.max(0, Number(patch.watchdogMinutes) || 20);
  if (patch.pollsCloseUtc != null) next.pollsCloseUtc = String(patch.pollsCloseUtc);
  if (patch.autoStart != null) next.autoStart = !!patch.autoStart;
  if (patch.primaryFeedReady != null) next.primaryFeedReady = !!patch.primaryFeedReady;
  const { dbPath, rawDir, ...toSave } = next;
  savePersistedConfig(toSave);
  activeConfig = next;
  process.env.ELECTION_RESULTS_DB_PATH = next.dbPath;
  process.env.EP_EID = next.eid;
  process.env.EP_ENFORCE_POLLS_CLOSE = next.enforcePollsClose ? "1" : "0";
  process.env.EP_POLL_SECONDS = String(next.pollSeconds);
  process.env.EP_WATCHDOG_MINUTES = String(next.watchdogMinutes);
  process.env.EP_POLLS_CLOSE_UTC = next.pollsCloseUtc;
  process.env.EP_DB_PATH = next.dbPath;
  process.env.EP_RAW_DIR = next.rawDir;
  return next;
}

function collectorEnv(cfg) {
  const config = cfg || getCollectorConfig();
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  fs.mkdirSync(config.rawDir, { recursive: true });
  return {
    ...process.env,
    EP_EID: String(config.eid),
    EP_ENFORCE_POLLS_CLOSE: config.enforcePollsClose ? "1" : "0",
    EP_POLL_SECONDS: String(config.pollSeconds),
    EP_WATCHDOG_MINUTES: String(config.watchdogMinutes),
    EP_POLLS_CLOSE_UTC: config.pollsCloseUtc,
    EP_DB_PATH: config.dbPath,
    EP_RAW_DIR: config.rawDir,
    ELECTION_RESULTS_DB_PATH: config.dbPath,
  };
}

function pushLog(line) {
  const text = String(line).trim();
  if (!text) return;
  lastLogLines.push(text);
  if (lastLogLines.length > 80) lastLogLines = lastLogLines.slice(-80);
}

function wipeResultsDb(dbPath) {
  if (!dbPath) return;
  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.unlinkSync(`${dbPath}${suffix}`); } catch { /* ok */ }
  }
}

function autoEidEnabled() {
  return process.env.EP_AUTO_EID !== "0";
}

function autoEidWindowActive() {
  const start = Date.parse(process.env.EP_AUTO_EID_START || "2026-06-29T06:00:00-06:00");
  const end = Date.parse(process.env.EP_AUTO_EID_END || "2026-07-01T08:00:00-06:00");
  const now = Date.now();
  return now >= start && now <= end;
}

function pollsCloseReached(pollsCloseUtc) {
  const close = Date.parse(pollsCloseUtc || DEFAULTS.pollsCloseUtc);
  return Number.isFinite(close) && Date.now() >= close;
}

export function pickPrimaryEid() {
  return runCollectorCommand("pick").then(({ output }) => {
    const line = output.trim().split("\n").filter(Boolean).pop() || "{}";
    return JSON.parse(line);
  });
}

async function autoResolvePrimaryEid() {
  if (!autoEidEnabled() || !autoEidWindowActive()) return null;
  try {
    const pick = await pickPrimaryEid();
    if (!pick?.primaryReady || !pick?.eid) {
      pushLog(`auto-EID: waiting — best ${pick?.eid || "?"} (score ${pick?.score ?? "?"})`);
      return pick;
    }
    const cfg = getCollectorConfig();
    if (cfg.primaryFeedReady && cfg.eid === pick.eid) return pick;

    const enforcePollsClose = cfg.enforcePollsClose || pollsCloseReached(cfg.pollsCloseUtc);
    const eidChanged = cfg.eid !== pick.eid;
    if (eidChanged || !cfg.primaryFeedReady) {
      wipeResultsDb(cfg.dbPath);
    }
    updateCollectorConfig({
      eid: pick.eid,
      enforcePollsClose,
      primaryFeedReady: true,
    });
    pushLog(`auto-EID: primary feed on ${pick.eid} (score ${pick.score})`);
    await runCollectorOnce({ eid: pick.eid, enforcePollsClose });

    const nextCfg = getCollectorConfig();
    if (nextCfg.autoStart || process.env.ELECTION_COLLECTOR_AUTO_START === "1") {
      startCollector();
    } else if (pollProc) {
      stopCollector();
      startCollector();
    }
    return pick;
  } catch (e) {
    pushLog(`auto-EID error: ${e.message}`);
    return null;
  }
}

function scheduleAutoEidResolver() {
  if (!autoEidEnabled()) return;
  const intervalMs = Math.max(60_000, Number(process.env.EP_AUTO_EID_INTERVAL_MS || 5 * 60 * 1000));
  autoResolvePrimaryEid();
  autoEidTimer = setInterval(() => {
    autoResolvePrimaryEid();
  }, intervalMs);
}

function readDbHeartbeat(dbPath) {
  if (!dbPath || !fs.existsSync(dbPath)) {
    return { available: false, contestCount: 0, heartbeat: null, recentIngest: [] };
  }
  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    const heartbeat = db.prepare("SELECT * FROM heartbeat WHERE id = 1").get() || null;
    const contestCount = db.prepare("SELECT COUNT(*) AS n FROM contests").get()?.n || 0;
    const recentIngest = db.prepare(
      "SELECT version, fetched_at AS fetchedAt, sum_rows AS sumRows, precinct_rows AS precinctRows, status "
      + "FROM ingest_log ORDER BY id DESC LIMIT 8"
    ).all();
    db.close();
    return { available: true, contestCount, heartbeat, recentIngest };
  } catch (e) {
    return { available: false, error: e.message, contestCount: 0, heartbeat: null, recentIngest: [] };
  }
}

export function getCollectorStatus() {
  const config = activeConfig || getCollectorConfig();
  const db = readDbHeartbeat(config.dbPath);
  return {
    supervisor: {
      status: pollProc ? "running" : (wantRunning ? "starting" : "stopped"),
      pid: pollProc?.pid ?? null,
      wantRunning,
      log: lastLogLines.slice(-20),
    },
    autoEid: {
      enabled: autoEidEnabled(),
      windowActive: autoEidWindowActive(),
      primaryFeedReady: !!config.primaryFeedReady,
    },
    config,
    db,
    python: fs.existsSync(RUN_PY),
    collectorDir: COLLECTOR_DIR,
  };
}

function spawnPoll(cfg) {
  if (!fs.existsSync(RUN_PY)) {
    pushLog("collector run.py not found");
    wantRunning = false;
    return;
  }
  activeConfig = cfg;
  process.env.ELECTION_RESULTS_DB_PATH = cfg.dbPath;
  pollProc = spawn("python3", [RUN_PY, "poll"], {
    cwd: COLLECTOR_DIR,
    env: collectorEnv(cfg),
    stdio: ["ignore", "pipe", "pipe"],
  });
  pushLog(`poll started (pid ${pollProc.pid}, EID ${cfg.eid})`);
  pollProc.stdout?.on("data", (d) => {
    const msg = d.toString().trim();
    console.log("[collector]", msg);
    pushLog(msg);
  });
  pollProc.stderr?.on("data", (d) => {
    const msg = d.toString().trim();
    console.error("[collector]", msg);
    pushLog(msg);
  });
  pollProc.on("exit", (code, signal) => {
    pushLog(`poll exited (code=${code}, signal=${signal || "none"})`);
    pollProc = null;
    if (!wantRunning) return;
    restartTimer = setTimeout(() => {
      if (wantRunning) spawnPoll(activeConfig || getCollectorConfig());
    }, 5000);
  });
  pollProc.on("error", (err) => {
    pushLog(`spawn error: ${err.message}`);
    pollProc = null;
  });
}

export function startCollector(cfgPatch) {
  if (cfgPatch) updateCollectorConfig(cfgPatch);
  const cfg = getCollectorConfig();
  wantRunning = true;
  if (pollProc) return getCollectorStatus();
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
  spawnPoll(cfg);
  return getCollectorStatus();
}

export function stopCollector() {
  wantRunning = false;
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
  if (pollProc) {
    pollProc.kill("SIGTERM");
    pollProc = null;
    pushLog("poll stopped");
  }
  return getCollectorStatus();
}

function runCollectorCommand(command, cfgPatch) {
  if (cfgPatch) updateCollectorConfig(cfgPatch);
  const cfg = getCollectorConfig();
  if (!fs.existsSync(RUN_PY)) {
    return Promise.reject(new Error("Collector not installed (run.py missing)"));
  }
  return new Promise((resolve, reject) => {
    const proc = spawn("python3", [RUN_PY, command], {
      cwd: COLLECTOR_DIR,
      env: collectorEnv(cfg),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d) => { stdout += d.toString(); });
    proc.stderr?.on("data", (d) => { stderr += d.toString(); });
    proc.on("error", reject);
    proc.on("close", (code) => {
      const output = (stdout + stderr).trim();
      if (code === 0) {
        resolve({ output, status: getCollectorStatus() });
      } else {
        reject(new Error(output || `Collector ${command} failed (exit ${code})`));
      }
    });
  });
}

export function runCollectorOnce(cfgPatch) {
  return runCollectorCommand("once", cfgPatch);
}

export function discoverCollectorEids(cfgPatch) {
  return runCollectorCommand("discover", cfgPatch).then(({ output }) => {
    const eids = [];
    const match = output.match(/county index EIDs[^:]*:\s*(\[[^\]]*\]|[^\n]+)/i);
    if (match) {
      const chunk = match[1];
      const nums = chunk.match(/\d{5,}/g);
      if (nums) eids.push(...nums);
    }
    return pickPrimaryEid()
      .then((pick) => ({
        eids: [...new Set([...(pick.candidates || []).map((c) => c.eid), ...eids])],
        output,
        configuredEid: getCollectorConfig().eid,
        recommended: pick.primaryReady ? pick.eid : null,
        pick,
      }))
      .catch(() => ({ eids, output, configuredEid: getCollectorConfig().eid }));
  });
}

export function testCollector(cfgPatch) {
  return runCollectorCommand("test", cfgPatch);
}

export function initElectionCollector() {
  const cfg = getCollectorConfig();
  process.env.ELECTION_RESULTS_DB_PATH = cfg.dbPath;
  process.env.EP_DB_PATH = cfg.dbPath;
  process.env.EP_RAW_DIR = cfg.rawDir;
  activeConfig = cfg;
  scheduleAutoEidResolver();
  if (cfg.autoStart) {
    console.log("[collector] auto-start enabled");
    startCollector();
  } else {
    console.log("[collector] idle — start from Election Monitor or set ELECTION_COLLECTOR_AUTO_START=1");
  }
}

export function shutdownElectionCollector() {
  if (autoEidTimer) {
    clearInterval(autoEidTimer);
    autoEidTimer = null;
  }
  stopCollector();
}
