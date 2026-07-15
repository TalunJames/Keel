// Proposal library — the "learning" system behind the proposal-editor AI.
//
// Staff upload FINISHED proposals (PDF or pasted text). Each upload is queued
// and processed in the background:
//   1. Claude distills the document into structured insights (structure,
//      voice, persuasion moves, reusable language, pricing shape).
//   2. The firm PLAYBOOK is re-synthesized from all distilled insights.
// The playbook (and, for drafting, the most relevant per-document insights)
// is injected into every AI prompt via buildLibraryContext() — so drafts get
// measurably better as the library grows, without retraining any model.
//
// All processing respects the monthly AI budget and is logged to ai_usage.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { MODELS, runJSON, recordUsage, writePlaybook, clearPlaybook, aiConfigured } from "./claude.js";
import { LIBRARY_SCHEMA, PLAYBOOK_SCHEMA } from "./schemas.js";
import { checkAiBudget } from "./spend-limit.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIBRARY_DIR = process.env.PROPOSAL_LIBRARY_DIR
  || path.join(__dirname, "..", "..", "data", "proposal-library");

const MAX_PDF_BASE64 = 20 * 1024 * 1024;  // ~15 MB binary
const MAX_TEXT_CHARS = 400_000;

function ensureTable(db) {
  db.prepare(
    `CREATE TABLE IF NOT EXISTS proposal_library (
       id TEXT PRIMARY KEY,
       title TEXT NOT NULL DEFAULT '',
       agency TEXT NOT NULL DEFAULT '',
       client_type TEXT NOT NULL DEFAULT '',
       file_name TEXT,
       file_path TEXT,
       media_type TEXT,
       raw_text TEXT,
       status TEXT NOT NULL DEFAULT 'pending',
       error TEXT,
       insights_json TEXT,
       created_by TEXT,
       created_at TEXT NOT NULL DEFAULT (datetime('now')),
       updated_at TEXT NOT NULL DEFAULT (datetime('now'))
     )`
  ).run();
}

/* ---------- sequential background queue ----------
   One job at a time: distillation calls are big, and serializing them keeps
   prompt-cache hits warm and avoids hammering the API or the budget. */
let chain = Promise.resolve();
function enqueue(job) {
  chain = chain.then(job).catch((e) => {
    console.error("[ai-library]", e?.message || e);
  });
  return chain;
}

const touch = (db, id, fields) => {
  const keys = Object.keys(fields);
  db.prepare(
    `UPDATE proposal_library SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = datetime('now') WHERE id = ?`
  ).run(...keys.map((k) => fields[k]), id);
};

/** Readable failure reasons instead of raw API error JSON. */
function humanizeAiError(e) {
  const status = e?.status;
  if (status === 401) return "The Claude API key was rejected — check it in Admin → Integrations, then Retry.";
  if (status === 403) return "The Claude API key lacks permission (403) — check the key in Admin → Integrations.";
  if (status === 429) return "Claude API rate limit hit — Retry in a minute.";
  if (status === 529 || status >= 500) return "The Claude API is temporarily unavailable — Retry shortly.";
  return String(e?.message || e).slice(0, 300);
}

const DISTILL_SYSTEM =
  "You are analyzing a FINISHED, successful proposal from Fog Signal Strategies (a public-affairs and " +
  "campaign-services firm) so future proposals can learn from it. Extract only what is transferable: how the " +
  "document is structured, the voice and style, the persuasive moves that make it effective, short verbatim " +
  "passages worth reusing, and how pricing is framed. Be concrete and specific — vague observations " +
  "(\"professional tone\") are useless. Do not invent content that is not in the document.";

async function processEntry(db, id) {
  const row = db.prepare("SELECT * FROM proposal_library WHERE id = ?").get(id);
  if (!row || row.status === "ready") return;

  if (!aiConfigured()) {
    touch(db, id, { status: "error", error: "Claude API key is not configured (Admin → Integrations)." });
    return;
  }
  const budget = checkAiBudget(db);
  if (!budget.allowed) {
    touch(db, id, { status: "error", error: `Monthly AI budget reached ($${budget.spentUsd.toFixed(2)} of $${budget.limitUsd}) — reprocess after raising the limit or next month.` });
    return;
  }

  touch(db, id, { status: "processing", error: null });

  const content = [];
  if (row.file_path) {
    let data;
    try {
      data = fs.readFileSync(row.file_path).toString("base64");
    } catch (e) {
      touch(db, id, { status: "error", error: `Stored file unreadable: ${e.message}` });
      return;
    }
    content.push({
      type: "document",
      source: { type: "base64", media_type: row.media_type || "application/pdf", data },
    });
    content.push({ type: "text", text: "Analyze this finished proposal and extract its transferable knowledge." });
  } else {
    content.push({
      type: "text",
      text: "Finished proposal text:\n\n" + String(row.raw_text || "").slice(0, MAX_TEXT_CHARS) +
        "\n\nAnalyze this finished proposal and extract its transferable knowledge.",
    });
  }

  try {
    const { data, usage, stopReason } = await runJSON({
      system: DISTILL_SYSTEM,
      messages: [{ role: "user", content }],
      schema: LIBRARY_SCHEMA,
      maxTokens: 8000,
      effort: "medium",
    });
    recordUsage(db, { route: "library", model: MODELS.reason, userId: row.created_by, usage });
    if (stopReason === "refusal") {
      touch(db, id, { status: "error", error: "The document was declined by the AI safety filters." });
      return;
    }
    touch(db, id, {
      status: "ready",
      error: null,
      insights_json: JSON.stringify(data),
      // User-supplied metadata wins; Claude fills in whatever was left blank.
      title: row.title || String(data.title || "").slice(0, 200) || (row.file_name || "Untitled proposal"),
      agency: row.agency || String(data.agency || "").slice(0, 200),
      client_type: row.client_type || String(data.clientType || "").slice(0, 80),
    });
  } catch (e) {
    touch(db, id, { status: "error", error: humanizeAiError(e) });
    return;
  }

  await regeneratePlaybook(db);
}

/** Re-synthesize the firm playbook from all distilled insights. */
export async function regeneratePlaybook(db) {
  const rows = db.prepare(
    `SELECT title, agency, client_type, insights_json FROM proposal_library
     WHERE status = 'ready' AND insights_json IS NOT NULL
     ORDER BY updated_at DESC LIMIT 25`
  ).all();

  if (!rows.length) {
    clearPlaybook(db);
    return;
  }
  const budget = checkAiBudget(db);
  if (!budget.allowed) {
    console.warn("[ai-library] playbook refresh skipped — monthly AI budget reached");
    return; // keep the previous playbook; refresh will happen on a later ingest
  }

  const corpus = rows.map((r, i) => {
    let ins = {};
    try { ins = JSON.parse(r.insights_json); } catch { /* skip malformed */ }
    return `### Proposal ${i + 1}: ${r.title}${r.agency ? ` (for ${r.agency})` : ""}${r.client_type ? ` · ${r.client_type}` : ""}\n` +
      JSON.stringify(ins).slice(0, 6000);
  }).join("\n\n");

  try {
    const { data, usage } = await runJSON({
      system:
        "You maintain Fog Signal Strategies' proposal playbook. You are given structured insights distilled from " +
        "the firm's finished proposals. Synthesize them into ONE practical playbook (markdown, max ~1200 words) a " +
        "proposal writer — human or AI — should follow: recurring document structure, voice and style rules, the " +
        "persuasive moves that recur across winners, pricing framing guidance, and the strongest reusable language " +
        "(quote it). Prefer patterns seen in MULTIPLE proposals over one-offs. Ground every point in the provided " +
        "insights; do not invent.",
      messages: [{ role: "user", content: corpus }],
      schema: PLAYBOOK_SCHEMA,
      maxTokens: 6000,
      effort: "medium",
    });
    recordUsage(db, { route: "playbook", model: MODELS.reason, userId: null, usage });
    writePlaybook(db, { text: data.playbook, sourceCount: rows.length });
    console.log(`[ai-library] playbook refreshed from ${rows.length} proposal(s)`);
  } catch (e) {
    console.error("[ai-library] playbook refresh failed:", e?.message || e);
  }
}

export function registerAiLibraryRoutes(api, db, { requireStaff }) {
  ensureTable(db);

  // Resume anything interrupted by a restart (a crash mid-run leaves 'processing').
  db.prepare("UPDATE proposal_library SET status = 'pending' WHERE status = 'processing'").run();
  for (const r of db.prepare("SELECT id FROM proposal_library WHERE status = 'pending'").all()) {
    enqueue(() => processEntry(db, r.id));
  }

  api.get("/ai/library", requireStaff, (_req, res) => {
    const items = db.prepare(
      `SELECT id, title, agency, client_type AS clientType, file_name AS fileName,
              status, error, created_at AS createdAt, updated_at AS updatedAt,
              (insights_json IS NOT NULL) AS hasInsights
       FROM proposal_library ORDER BY created_at DESC LIMIT 200`
    ).all();
    let playbook = null;
    try {
      const row = db.prepare("SELECT value FROM app_settings WHERE key = 'proposal_playbook'").get();
      if (row?.value) playbook = JSON.parse(row.value);
    } catch { /* no playbook yet */ }
    res.json({ items, playbook });
  });

  api.post("/ai/library", requireStaff, (req, res) => {
    const { pdfBase64, mediaType, fileName, text, title, clientType, agency } = req.body || {};
    if (!pdfBase64 && !(typeof text === "string" && text.trim().length >= 200)) {
      return res.status(400).json({ error: "Provide a proposal PDF, or pasted text of at least 200 characters" });
    }
    if (pdfBase64 && String(pdfBase64).length > MAX_PDF_BASE64) {
      return res.status(413).json({ error: "PDF too large (15 MB max)" });
    }

    const id = randomUUID();
    let filePath = null;
    if (pdfBase64) {
      try {
        fs.mkdirSync(LIBRARY_DIR, { recursive: true });
        filePath = path.join(LIBRARY_DIR, `${id}.pdf`);
        fs.writeFileSync(filePath, Buffer.from(String(pdfBase64), "base64"));
      } catch (e) {
        return res.status(500).json({ error: `Could not store the file: ${e.message}` });
      }
    }

    db.prepare(
      `INSERT INTO proposal_library (id, title, agency, client_type, file_name, file_path, media_type, raw_text, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
    ).run(
      id,
      String(title || "").slice(0, 200),
      String(agency || "").slice(0, 200),
      String(clientType || "").slice(0, 80),
      String(fileName || "").slice(0, 200) || null,
      filePath,
      pdfBase64 ? (mediaType || "application/pdf") : null,
      pdfBase64 ? null : String(text).slice(0, MAX_TEXT_CHARS),
      String(req.user.id)
    );

    enqueue(() => processEntry(db, id));
    res.status(201).json({ ok: true, id });
  });

  api.post("/ai/library/:id/reprocess", requireStaff, (req, res) => {
    const row = db.prepare("SELECT id, status FROM proposal_library WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    if (row.status === "processing" || row.status === "pending") {
      return res.status(409).json({ error: "Already queued" });
    }
    touch(db, row.id, { status: "pending", error: null });
    enqueue(() => processEntry(db, row.id));
    res.json({ ok: true });
  });

  api.delete("/ai/library/:id", requireStaff, (req, res) => {
    const row = db.prepare("SELECT id, file_path AS filePath FROM proposal_library WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    db.prepare("DELETE FROM proposal_library WHERE id = ?").run(row.id);
    if (row.filePath) {
      try { fs.unlinkSync(row.filePath); } catch { /* already gone */ }
    }
    // Rebuild (or clear) the playbook so deleted knowledge actually leaves it.
    enqueue(() => regeneratePlaybook(db));
    res.json({ ok: true });
  });
}
