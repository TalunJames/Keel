import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const CENSUS_BATCH_URL = "https://geocoding.geo.census.gov/geocoder/locations/addressbatch";
const CENSUS_SINGLE_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
const BATCH_SIZE = 10000;
const FETCH_TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;

function backoff(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cachePath(clientId) {
  const root = process.env.VOTER_DATA_DIR || path.join(process.cwd(), "data", "voter");
  return path.join(root, clientId, "geocode-cache.db");
}

export function openGeocodeCache(clientId) {
  const p = cachePath(clientId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const db = new Database(p);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS geocode_cache (
      address_key TEXT PRIMARY KEY,
      address_line TEXT NOT NULL,
      city TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT '',
      zip TEXT NOT NULL DEFAULT '',
      lat REAL,
      lng REAL,
      match_type TEXT,
      geocoded_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_geocode_coords ON geocode_cache(lat, lng);
  `);
  return db;
}

export async function geocodeOneLine(address) {
  const url = new URL(CENSUS_SINGLE_URL);
  url.searchParams.set("address", address);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Geocoder HTTP ${res.status}`);
  const data = await res.json();
  const match = data?.result?.addressMatches?.[0];
  if (!match?.coordinates) return null;
  return {
    lat: match.coordinates.y,
    lng: match.coordinates.x,
    matchType: match.tigerLine ? "Exact" : "Match",
  };
}

function parseBatchLine(line) {
  const cols = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      // A doubled quote ("") inside a quoted field is a literal quote char.
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cols.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cols.push(cur);
  return cols.map((c) => c.trim());
}

export async function geocodeBatchCsv(csvBody) {
  let text;
  let lastErr;
  // Retry a bounded number of times with short backoff so a single hung
  // connection or transient non-2xx doesn't abort the whole run.
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const form = new FormData();
    form.append("addressFile", new Blob([csvBody], { type: "text/csv" }), "addresses.csv");
    form.append("benchmark", "Public_AR_Current");
    try {
      const res = await fetch(CENSUS_BATCH_URL, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`Batch geocoder HTTP ${res.status}`);
      text = await res.text();
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) await backoff(1000 * attempt);
    }
  }
  if (lastErr) throw lastErr;
  const results = new Map();
  for (const line of text.trim().split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cols = parseBatchLine(line);
    const id = cols[0];
    const coords = cols[5] || "";
    const [lng, lat] = coords.split(",").map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      results.set(id, null);
      continue;
    }
    results.set(id, { lat, lng, matchType: cols[3] || "Match" });
  }
  return results;
}

export function upsertGeocodeCache(db, rows) {
  const stmt = db.prepare(`
    INSERT INTO geocode_cache (address_key, address_line, city, state, zip, lat, lng, match_type, geocoded_at)
    VALUES (@address_key, @address_line, @city, @state, @zip, @lat, @lng, @match_type, datetime('now'))
    ON CONFLICT(address_key) DO UPDATE SET
      lat = excluded.lat,
      lng = excluded.lng,
      match_type = excluded.match_type,
      geocoded_at = excluded.geocoded_at
  `);
  const tx = db.transaction((items) => {
    for (const row of items) stmt.run(row);
  });
  tx(rows);
}

export async function geocodeUniqueAddresses(addresses, { onProgress, clientId } = {}) {
  // Cache PII per client so addresses aren't pooled across clients in one db.
  const cacheDb = openGeocodeCache(clientId || "_shared");
  const pending = [];
  const lookup = cacheDb.prepare("SELECT lat, lng, match_type FROM geocode_cache WHERE address_key = ?");

  for (const addr of addresses) {
    const cached = lookup.get(addr.address_key);
    if (cached?.lat != null) {
      addr.lat = cached.lat;
      addr.lng = cached.lng;
      addr.match_type = cached.match_type;
      continue;
    }
    pending.push(addr);
  }

  let done = addresses.length - pending.length;
  if (onProgress) onProgress({ done, total: addresses.length, phase: "cache" });

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const chunk = pending.slice(i, i + BATCH_SIZE);
    const lines = chunk.map((a, idx) => {
      const id = String(i + idx + 1);
      const street = a.address_line.replace(/"/g, '""');
      const city = (a.address_city || "").replace(/"/g, '""');
      const state = a.address_state || "CO";
      const zip = a.zip || "";
      return `${id},"${street}","${city}","${state}","${zip}"`;
    });
    const results = await geocodeBatchCsv(lines.join("\n") + "\n");
    const cacheRows = [];
    chunk.forEach((addr, idx) => {
      const id = String(i + idx + 1);
      const hit = results.get(id);
      if (hit) {
        addr.lat = hit.lat;
        addr.lng = hit.lng;
        addr.match_type = hit.matchType;
        cacheRows.push({
          address_key: addr.address_key,
          address_line: addr.address_line,
          city: addr.address_city,
          state: addr.address_state,
          zip: addr.zip,
          lat: hit.lat,
          lng: hit.lng,
          match_type: hit.matchType,
        });
      }
    });
    if (cacheRows.length) upsertGeocodeCache(cacheDb, cacheRows);
    done += chunk.length;
    if (onProgress) onProgress({ done, total: addresses.length, phase: "batch" });
  }

  cacheDb.close();
  return addresses;
}
