// Pipeline sync against the CLEATUS REST API.
//
// Pages through /v1/pipeline/search (the API-key surface — the event-style
// /v1/zapier/pursuits/* endpoints are OAuth-only) and reconciles every pursuit
// into Keel: new pursuits become proposals, known ones get their triage state
// refreshed. Runs on an interval once an API key is configured (Admin →
// Integrations or CLEATUS_API_KEY) and can be triggered manually via
// POST /api/integrations/cleatus/sync. Webhooks remain supported; the sync
// makes them optional.

import { cleatusConfigured, fetchPipelinePage, unwrapListResponse } from "./cleatus-api.js";
import {
  applyCleatusUpdate,
  createProposalFromCleatus,
  flattenPursuitEvent,
  normalizeCleatusTriage,
} from "./cleatus-proposals.js";

const LAST_SYNC_KEY = "cleatus:last_sync";
const SYNC_INTERVAL_MS = 5 * 60_000;
// Safety valve on pagination (50 pursuits/page). If a pipeline somehow exceeds
// this, the sync reports truncation instead of hammering the API.
const MAX_PAGES_PER_STATUS = 20;
// Pursuits can sit in active, won, or archived buckets — sweep all three so
// wins/losses recorded in CLEATUS reach Keel too.
const PIPELINE_STATUSES = ["active", "won", "archived"];

let syncTimer = null;
let syncing = false;

function readSetting(db, key) {
  return db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key)?.value || null;
}

function writeSetting(db, key, value) {
  db.prepare(
    `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).run(key, String(value));
}

export function getCleatusSyncState(db) {
  let lastSync = null;
  try { lastSync = JSON.parse(readSetting(db, LAST_SYNC_KEY) || "null"); } catch { /* corrupt */ }
  return { lastSync };
}

function processPursuit(db, pursuit, summary, pipelineStatus) {
  const body = flattenPursuitEvent(pursuit);
  const externalId = String(body?.id || "");
  if (!externalId) {
    summary.errors.push("pursuit missing id");
    return;
  }
  // The bucket this pursuit was fetched from (active|won|archived) disambiguates
  // wins/losses/archives when the column label alone isn't decisive.
  body.pipelineStatus = pipelineStatus;

  try {
    const updated = applyCleatusUpdate(db, body);
    if (updated) {
      if (updated.updated) summary.updated += 1;
      return;
    }
    // A pursuit only becomes a Keel proposal once it's moved to the
    // "Building a proposal" column in CLEATUS. Everything earlier (triage,
    // inbox) is watched but not created; once linked, updates flow above.
    if (normalizeCleatusTriage(body.triage, body.pipelineStatus) !== "building") {
      summary.watched += 1;
      return;
    }
    const wasUnassigned = db.prepare(
      "SELECT processing_error FROM cleatus_events WHERE external_id = ?"
    ).get(externalId)?.processing_error === "no_matching_client";
    const result = createProposalFromCleatus(db, body);
    if (result.duplicate) return;
    // Count a pursuit as newly unassigned once, not on every 5-minute sweep.
    if (result.unassigned) summary.unassigned += wasUnassigned ? 0 : 1;
    else summary.created += 1;
  } catch (err) {
    summary.errors.push(`${externalId}: ${err.message}`);
    try {
      db.prepare(
        `INSERT INTO cleatus_events (external_id, event_type, payload_json, processing_error)
         VALUES (?, 'pipeline.sync', ?, ?)
         ON CONFLICT(external_id) DO UPDATE SET
           payload_json = excluded.payload_json,
           processing_error = excluded.processing_error`
      ).run(externalId, JSON.stringify(pursuit), err.message || "processing_failed");
    } catch { /* best-effort error record */ }
  }
}

async function fetchAllPursuits(status, summary) {
  const items = [];
  let cursor = null;
  for (let page = 0; page < MAX_PAGES_PER_STATUS; page++) {
    const payload = await fetchPipelinePage({ status, cursor });
    const { items: pageItems, nextCursor } = unwrapListResponse(payload);
    items.push(...pageItems);
    if (!nextCursor || !pageItems.length) return items;
    cursor = nextCursor;
  }
  summary.errors.push(`${status}: pagination truncated after ${MAX_PAGES_PER_STATUS} pages`);
  return items;
}

export async function runCleatusSync(db, { who = "cleatus-sync" } = {}) {
  if (!cleatusConfigured()) return { skipped: true, reason: "not_configured" };
  if (syncing) return { skipped: true, reason: "already_running" };
  syncing = true;

  const startedAt = new Date();
  const summary = { created: 0, updated: 0, unassigned: 0, watched: 0, pursuits: 0, errors: [] };

  try {
    const seen = new Set();
    for (const status of PIPELINE_STATUSES) {
      for (const pursuit of await fetchAllPursuits(status, summary)) {
        const id = String(pursuit?.id ?? pursuit?.data?.id ?? "");
        if (id && seen.has(id)) continue; // a pursuit may appear under two status filters
        if (id) seen.add(id);
        summary.pursuits += 1;
        processPursuit(db, pursuit, summary, status);
      }
    }

    writeSetting(db, LAST_SYNC_KEY, JSON.stringify({
      at: startedAt.toISOString(),
      ok: true,
      ...summary,
      errors: summary.errors.slice(0, 10),
    }));

    if (summary.created || summary.updated || summary.unassigned) {
      db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(
        who,
        `CLEATUS sync: ${summary.created} created, ${summary.updated} updated, ${summary.unassigned} unassigned (${summary.pursuits} pursuits)`,
        "Data",
      );
    }
    return { ok: true, ...summary };
  } catch (err) {
    writeSetting(db, LAST_SYNC_KEY, JSON.stringify({
      at: startedAt.toISOString(),
      ok: false,
      error: err.message || "sync failed",
    }));
    throw err;
  } finally {
    syncing = false;
  }
}

/** Start the background poll. Safe to call once at startup; no-ops while unconfigured. */
export function startCleatusSync(db) {
  if (syncTimer) return;
  const tick = () => {
    if (!cleatusConfigured()) return;
    runCleatusSync(db).catch((err) => console.error("[cleatus sync]", err.message));
  };
  // Give the server a moment to settle, then poll on the interval.
  const kickoff = setTimeout(tick, 15_000);
  kickoff.unref?.();
  syncTimer = setInterval(tick, SYNC_INTERVAL_MS);
  syncTimer.unref?.();
}

export function stopCleatusSync() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}
