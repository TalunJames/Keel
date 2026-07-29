// AI proxy routes for the proposal editor. Mounted onto the already-auth'd
// `/proposals/app/api` router, so every route here is authenticated; staff-only
// routes additionally use the passed-in requireStaff.

import {
  MODELS,
  aiConfigured,
  buildContext,
  buildLibraryContext,
  buildCoverLetterContext,
  readFirmContext,
  writeFirmContext,
  recordUsage,
  runJSON,
  streamText,
} from "./claude.js";
import { registerAiLibraryRoutes } from "./library.js";
import { randomUUID } from "crypto";
import {
  DRAFT_SCHEMA, BLOCK_SCHEMA, COST_SCHEMA, PROOFREAD_SCHEMA, COVER_LETTER_SCHEMA,
  DRAFT_BLOCK_TYPES, HTML_BLOCK_TYPES,
} from "./schemas.js";
import { checkAiBudget } from "./spend-limit.js";

const DRAFT_TYPE_SET = new Set(DRAFT_BLOCK_TYPES);
const HTML_TYPE_SET = new Set(HTML_BLOCK_TYPES);
// Matches the firm's standard team page (see buildFullTemplateBlocks).
const TEAM_DEFAULT_STAFF = ["carter", "luke", "digital", "earned", "designer", "coord"];
const SETTINGS_KEY = "proposal_workspace_settings";
const COVER_LAYOUTS = new Set(["letterhead", "standard", "custom"]);

const bid = () => "b_" + randomUUID().slice(0, 8);

/** Resolve cover block fields from a request preference and/or workspace default. */
function resolveCoverFields(db, pref) {
  let settings = {};
  try {
    const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(SETTINGS_KEY);
    if (row?.value) settings = JSON.parse(row.value);
  } catch { /* ignore */ }
  const d = settings.defaultCover || {};
  const templates = Array.isArray(settings.coverTemplates) ? settings.coverTemplates : [];
  let src = pref && typeof pref === "object" ? pref : null;
  if (src?.templateId) {
    const tpl = templates.find((t) => t.id === src.templateId);
    if (tpl) src = { ...tpl, ...src };
  } else if (!src && d.templateId) {
    const tpl = templates.find((t) => t.id === d.templateId);
    src = tpl ? { ...d, ...tpl } : d;
  } else if (!src) {
    src = d;
  }
  let layout = src?.layout || d.layout || "letterhead";
  if (!COVER_LAYOUTS.has(layout)) layout = "letterhead";
  const out = { layout };
  if (layout === "custom" && (src?.bgId || d.bgId)) out.bgId = src?.bgId || d.bgId;
  if (layout === "standard") {
    out.marginPx = src?.marginPx != null ? src.marginPx : (d.marginPx != null ? d.marginPx : 84);
  }
  return out;
}

/**
 * Turn Claude's ordered block plan into REAL editor-v1 blocks + content.
 * Structural blocks (cover/toc/team/experience/cost/signature) are created with
 * the same minimal fields the template uses, so the client renders them with
 * full defaults (team bios, cost calculator, case studies) — never plain text.
 */
function buildBlocksFromOutline(outline, ct, coverFields = { layout: "letterhead" }) {
  const blocks = [];
  const content = {};
  let divNum = 1;
  let coverSeen = false;
  let tocSeen = false;
  const makeCover = () => ({ id: bid(), type: "cover", ...coverFields });

  for (const raw of Array.isArray(outline) ? outline : []) {
    const type = raw && raw.type;
    if (!DRAFT_TYPE_SET.has(type)) {
      if (raw && raw.html) { const id = bid(); blocks.push({ id, type: "text" }); content[id] = sanitizeHtml(raw.html); }
      continue;
    }
    if (type === "cover") { if (coverSeen) continue; coverSeen = true; blocks.push(makeCover()); continue; }
    if (type === "toc") { if (tocSeen) continue; tocSeen = true; blocks.push({ id: bid(), type: "toc", pageBreak: true }); continue; }
    if (type === "divider") { blocks.push({ id: bid(), type: "divider", num: ++divNum, label: String(raw.label || "Section").slice(0, 120) }); continue; }
    if (type === "team") { blocks.push({ id: bid(), type: "team", staff: TEAM_DEFAULT_STAFF.slice(), variant: ct }); continue; }
    if (type === "experience") { blocks.push({ id: bid(), type: "experience" }); continue; }
    if (type === "cost") { blocks.push({ id: bid(), type: "cost" }); continue; }
    if (type === "signature") { blocks.push({ id: bid(), type: "signature" }); continue; }
    if (type === "heading") {
      const id = bid();
      blocks.push({ id, type: "heading" });
      const h = String(raw.label || raw.html || "").replace(/<[^>]+>/g, "").trim();
      if (h) content[id] = `<h2>${h}</h2>`;
      continue;
    }
    // narrative / text / quote — carry drafted HTML; empty renders firm default copy
    const id = bid();
    blocks.push({ id, type });
    if (HTML_TYPE_SET.has(type) && raw.html) content[id] = sanitizeHtml(raw.html);
  }

  // Guarantee a single cover at the very top.
  const coverIdx = blocks.findIndex((b) => b.type === "cover");
  if (coverIdx < 0) blocks.unshift(makeCover());
  else if (coverIdx > 0) { const [cv] = blocks.splice(coverIdx, 1); blocks.unshift(cv); }

  return { blocks, content };
}

/**
 * Dedicated cover-letter pass — separate from narrative drafting so letter
 * structure/voice can be trained without section-essay habits leaking in.
 */
async function draftCoverLetterHtml({ db, ct, meta, userId }) {
  const letterCtx = buildCoverLetterContext(db, { clientType: ct, exemplars: 2 });
  const firm = readFirmContext(db);
  const system =
    "You write ONLY the cover letter for a Fog Signal Strategies proposal. " +
    "This is a formal business letter — not a proposal section. Rules:\n" +
    "- Output clean semantic HTML only: <p>, <br>, <b>, <i>. No headings, lists, tables, or dividers.\n" +
    "- Shape: optional date line, salutation (Dear …), 3–5 short body paragraphs, closing, then a signature block for Carter James / Managing Partner / Fog Signal Strategies.\n" +
    "- Keep it concise (roughly one page). Warm, confident, specific — not marketing-brochure copy.\n" +
    "- Ground claims in the firm context and letter guidance. Do NOT invent staff names, dollar figures, win rates, or references.\n" +
    "- Personalize to THIS agency / service / RFP number. Adapt trained snippets; do not paste them verbatim.\n" +
    "- Ignore proposal-body playbook habits (stage plans, fee tables, long section essays).\n" +
    (firm.text ? "\n\n=== FIRM CONTEXT ===\n" + firm.text.slice(0, 4000) : "") +
    (letterCtx ? "\n\n" + letterCtx : "");

  const user =
    `Write the cover letter for this proposal:\n` +
    `- Agency: ${meta.agency || "(from RFP)"}\n` +
    `- Service title: ${meta.serviceTitle || "Public Education & Community Outreach Services"}\n` +
    `- RFP number: ${meta.rfpNumber || "(none)"}\n` +
    `- Proposal title: ${meta.title || ""}\n` +
    `- Client type: ${ct || "county"}\n` +
    `Return only the letter HTML.`;

  const { data, usage, stopReason } = await runJSON({
    system,
    messages: [{ role: "user", content: user }],
    schema: COVER_LETTER_SCHEMA,
    model: MODELS.reason,
    maxTokens: 4000,
    effort: "medium",
  });
  recordUsage(db, { route: "cover-letter", model: MODELS.reason, userId, usage });
  if (stopReason === "refusal") return "";
  return sanitizeHtml(data.html || "");
}

/** Ensure a coverLetter block exists and fill it with the dedicated letter draft. */
async function applyCoverLetterPass({ db, blocks, content, ct, meta, userId }) {
  let letter = blocks.find((b) => b.type === "coverLetter");
  if (!letter) {
    const coverIdx = blocks.findIndex((b) => b.type === "cover");
    letter = { id: bid(), type: "coverLetter" };
    blocks.splice(coverIdx >= 0 ? coverIdx + 1 : 0, 0, letter);
  }
  try {
    const html = await draftCoverLetterHtml({ db, ct, meta, userId });
    if (html && html.replace(/<[^>]+>/g, "").trim()) content[letter.id] = html;
  } catch (e) {
    console.warn("[ai] cover letter pass failed:", e?.message || e);
  }
  return { blocks, content };
}

/** Conservative HTML sanitizer for model-generated block bodies. */
function sanitizeHtml(html) {
  return String(html || "")
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"');
}

const jsonErr = (e) => {
  const m = String(e?.message || e || "AI request failed");
  if (/ANTHROPIC_API_KEY/.test(m)) return "AI is not configured on the server (missing API key).";
  return m;
};

export function registerAiRoutes(api, db, { requireStaff, createEditorProposal, editorClientType }) {
  // Hard monthly budget gate — runs before any tokens are spent. Returns true
  // when the request may proceed; otherwise it has already sent the 429.
  const withinBudget = (res) => {
    const budget = checkAiBudget(db);
    if (budget.allowed) return true;
    res.status(429).json({
      error: `Monthly AI budget reached ($${budget.spentUsd.toFixed(2)} of $${budget.limitUsd}). ` +
        "Raise or disable the limit in Admin → Integrations to continue.",
      budget,
    });
    return false;
  };

  api.get("/ai/health", (_req, res) => {
    res.json({ ok: true, configured: aiConfigured(), budget: checkAiBudget(db) });
  });

  // Proposal library — upload finished proposals; Claude learns from them in
  // the background (see server/ai/library.js).
  registerAiLibraryRoutes(api, db, { requireStaff });

  /* ---------- firm context ---------- */
  api.get("/ai/firm-context", requireStaff, (_req, res) => {
    res.json(readFirmContext(db));
  });

  api.put("/ai/firm-context", requireStaff, (req, res) => {
    const body = req.body || {};
    if (typeof body.text !== "string" && typeof body.coverLetterGuidance !== "string") {
      return res.status(400).json({ error: "text or coverLetterGuidance required" });
    }
    writeFirmContext(db, {
      text: typeof body.text === "string" ? body.text : undefined,
      coverLetterGuidance: typeof body.coverLetterGuidance === "string" ? body.coverLetterGuidance : undefined,
    });
    res.json({ ok: true, ...readFirmContext(db) });
  });

  /* ---------- #1 draft a proposal from an RFP ---------- */
  api.post("/ai/draft", requireStaff, async (req, res) => {
    if (!withinBudget(res)) return;
    const { pdfBase64, mediaType, rfpText, clientType, fileName, proposalId, cover } = req.body || {};
    if (!pdfBase64 && !rfpText) return res.status(400).json({ error: "Provide an RFP PDF or text" });

    // Drafting into an existing proposal (e.g. a Cleatus-created card): the
    // proposal supplies the client; the RFP draft replaces its template body.
    let targetRow = null;
    let clientId = req.body?.clientId;
    if (proposalId) {
      targetRow = db.prepare("SELECT * FROM proposals WHERE id = ?").get(proposalId);
      if (!targetRow) return res.status(404).json({ error: "Proposal not found" });
      clientId = targetRow.client_id;
    }
    if (!clientId) return res.status(400).json({ error: "clientId required — select a client first" });

    const ct = clientType || editorClientType(db.prepare("SELECT type FROM clients WHERE id = ?").get(clientId)?.type);
    const firm = readFirmContext(db);
    // Learned knowledge: the firm playbook plus the two most relevant finished
    // proposals from the library — this is where drafts improve over time.
    const learned = buildLibraryContext(db, { clientType: ct, exemplars: 2 });

    const system =
      "You are a proposal writer for Fog Signal Strategies, a public-affairs and campaign-services firm. " +
      "You are given an RFP (request for proposal). COMPOSE a response proposal as an ordered plan of blocks drawn " +
      "from the firm's real block library — do not produce one wall of text. Choose which blocks to include, in what " +
      "order, and add `divider` blocks to open each major section, so the structure mirrors what the RFP asks for. " +
      "Lead with cover, coverLetter, toc. Include team, experience, and a cost block where the RFP calls for them. " +
      "Write substantive multi-paragraph HTML for the narrative/text blocks; leave structural blocks' html empty " +
      "(cover, coverLetter, toc, team, experience, cost, signature — the app fills those; the cover letter is written in a dedicated follow-up pass). " +
      "Write in a confident, specific, professional voice grounded in the firm context. Do NOT invent staff names, dollar figures, dates, or references " +
      "not supported by the RFP or firm context — leave those for the human to fill." +
      (firm.text ? "\n\n=== FIRM CONTEXT ===\n" + firm.text : "") +
      (learned ? "\n\n" + learned +
        "\n\nApply the playbook's structure, voice, and persuasive moves; adapt reusable language to THIS RFP rather than copying it verbatim." : "");

    const userContent = [];
    if (pdfBase64) {
      userContent.push({
        type: "document",
        source: { type: "base64", media_type: mediaType || "application/pdf", data: pdfBase64 },
      });
    }
    userContent.push({
      type: "text",
      text:
        (rfpText ? "RFP text:\n" + rfpText + "\n\n" : "") +
        `Compose a proposal for this RFP as an ordered block plan. Available block types: ${DRAFT_BLOCK_TYPES.join(", ")}. ` +
        "Extract the submission-requirement checklist into rfpItems.",
    });

    try {
      const { data, usage, stopReason } = await runJSON({
        system,
        messages: [{ role: "user", content: userContent }],
        schema: DRAFT_SCHEMA,
        maxTokens: 32000,
        effort: "high",
      });
      recordUsage(db, { route: "draft", model: MODELS.reason, userId: req.user.id, usage });
      if (stopReason === "refusal") return res.status(422).json({ error: "The request was declined." });

      const meta = data.meta || {};
      // Build real editor blocks from Claude's ordered plan.
      const coverFields = resolveCoverFields(db, cover);
      let { blocks, content } = buildBlocksFromOutline(data.blocks, ct, coverFields);
      // Dedicated cover-letter pass — trained separately from body drafting.
      ({ blocks, content } = await applyCoverLetterPass({
        db, blocks, content, ct, meta, userId: req.user.id,
      }));

      if (targetRow) {
        // Replace the placeholder body of the existing proposal with the
        // drafted plan, keeping its identity: client, triage, Cleatus links.
        let existing = {};
        try { existing = JSON.parse(targetRow.payload_json || "{}"); } catch { /* template shell */ }
        const rfpItems = (Array.isArray(data.rfpItems) ? data.rfpItems : []).map((it, i) => ({
          id: `r_ai${i}`,
          label: String(it.label || "").slice(0, 300),
          section: String(it.section || ""),
          done: false,
        }));
        const doc = {
          ...existing,
          id: String(targetRow.id),
          format: "editor-v1",
          title: meta.title || targetRow.title,
          agency: meta.agency || existing.agency || "",
          clientType: ct,
          rfpNumber: meta.rfpNumber || existing.rfpNumber || "",
          deadline: meta.deadline || targetRow.due_at || existing.deadline || "",
          serviceTitle: meta.serviceTitle || existing.serviceTitle,
          blocks,
          content,
          floats: [],
          comments: [],
          template: "ai",
          updatedAt: Date.now(),
          keelClientId: targetRow.client_id,
          triageState: targetRow.triage_state || existing.triageState || "building",
          rfp: { ...(existing.rfp || {}), items: rfpItems },
          cleatus: existing.cleatus ? { ...existing.cleatus, needsRfp: false } : existing.cleatus,
        };
        db.prepare(
          `UPDATE proposals SET title = ?, payload_json = ?, due_at = ?, updated_at = datetime('now')
           WHERE id = ?`
        ).run(doc.title, JSON.stringify(doc), doc.deadline || null, targetRow.id);
        return res.json({ ok: true, id: String(targetRow.id) });
      }

      const { proposalId, doc } = createEditorProposal(db, {
        title: meta.title || `Proposal — ${fileName || "RFP"}`,
        clientId,
        agency: meta.agency || db.prepare("SELECT name FROM clients WHERE id = ?").get(clientId)?.name || "",
        clientType: ct,
        rfpNumber: meta.rfpNumber || "",
        deadline: meta.deadline || "",
        serviceTitle: meta.serviceTitle || undefined,
        template: "ai",
        blocks,
        content,
        triageState: "building",
        source: "ai-draft",
        ownerId: req.user.id,
      });

      if (Array.isArray(data.rfpItems) && data.rfpItems.length) {
        doc.rfp = doc.rfp || {};
        doc.rfp.items = data.rfpItems.map((it, i) => ({
          id: `r_ai${i}`,
          label: String(it.label || "").slice(0, 300),
          section: String(it.section || ""),
          done: false,
        }));
      }

      db.prepare("UPDATE proposals SET payload_json = ? WHERE id = ?")
        .run(JSON.stringify({ ...doc, format: "editor-v1", id: String(proposalId) }), proposalId);

      res.json({ ok: true, id: String(proposalId) });
    } catch (e) {
      res.status(500).json({ error: jsonErr(e) });
    }
  });

  /* ---------- #2 chat about the RFP / proposal / firm ---------- */
  api.post("/ai/chat", requireStaff, async (req, res) => {
    if (!withinBudget(res)) return;
    const { messages, clientId, docId } = req.body || {};
    if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: "messages required" });

    const context = buildContext(db, { docId, clientId });
    const system =
      "You are a helpful assistant embedded in Fog Signal Strategies' proposal editor. " +
      "Answer the user's questions about the RFP, the current proposal, and the firm using the context below. " +
      "Be concise and specific; if the context does not contain the answer, say so.\n\n" +
      context;

    const clean = messages
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content }))
      .slice(-20);

    try {
      const usage = await streamText(res, { system, messages: clean, model: MODELS.reason, maxTokens: 4000, effort: "medium" });
      recordUsage(db, { route: "chat", model: MODELS.reason, userId: req.user.id, usage });
    } catch (e) {
      if (!res.headersSent) return res.status(500).json({ error: jsonErr(e) });
      try {
        res.write(`data: ${JSON.stringify({ error: jsonErr(e) })}\n\n`);
        res.end();
      } catch { /* client gone */ }
    }
  });

  /* ---------- #3 tailor a single block ---------- */
  api.post("/ai/block", requireStaff, async (req, res) => {
    if (!withinBudget(res)) return;
    const { blockType, html, instruction, clientId, docId } = req.body || {};
    if (!instruction || typeof instruction !== "string") return res.status(400).json({ error: "instruction required" });

    const isLetter = blockType === "coverLetter";
    let system;
    if (isLetter) {
      const row = docId ? db.prepare("SELECT payload_json FROM proposals WHERE id = ?").get(docId) : null;
      let ct = null;
      let meta = {};
      try {
        const doc = row?.payload_json ? JSON.parse(row.payload_json) : null;
        ct = doc?.clientType || null;
        meta = {
          agency: doc?.agency || "",
          serviceTitle: doc?.serviceTitle || "",
          rfpNumber: doc?.rfpNumber || "",
          title: doc?.title || "",
        };
      } catch { /* ignore */ }
      const letterCtx = buildCoverLetterContext(db, { clientType: ct, exemplars: 2 });
      const firm = readFirmContext(db);
      system =
        "You are rewriting ONLY the cover letter of a Fog Signal Strategies proposal. " +
        "Keep it a formal business letter (date, salutation, short paragraphs, closing, signature). " +
        "No headings, bullet lists, tables, or section-essay structure. Follow the user's instruction while " +
        "honoring the firm-trained cover letter guidance and letter exemplars below. " +
        "Return clean semantic HTML for the letter body only.\n" +
        (firm.text ? "\n\n=== FIRM CONTEXT ===\n" + firm.text.slice(0, 3000) : "") +
        (letterCtx ? "\n\n" + letterCtx : "") +
        `\n\n=== LETTER META ===\nAgency: ${meta.agency || ""}\nService: ${meta.serviceTitle || ""}\nRFP #: ${meta.rfpNumber || ""}\nTitle: ${meta.title || ""}`;
    } else {
      const context = buildContext(db, { docId, clientId });
      system =
        "You are editing one section of a Fog Signal Strategies proposal. Rewrite the section body per the user's " +
        "instruction, keeping it professional and consistent with the rest of the proposal and firm voice. " +
        "Return clean semantic HTML for the body only.\n\n" +
        context;
    }

    const user =
      `Section type: ${blockType || "text"}\n\n` +
      `Current body HTML:\n${html || "(empty)"}\n\n` +
      `Instruction: ${instruction}`;

    try {
      const { data, usage } = await runJSON({
        system,
        messages: [{ role: "user", content: user }],
        schema: isLetter ? COVER_LETTER_SCHEMA : BLOCK_SCHEMA,
        maxTokens: isLetter ? 4000 : 6000,
        effort: "medium",
      });
      recordUsage(db, { route: isLetter ? "cover-letter-block" : "block", model: MODELS.reason, userId: req.user.id, usage });
      res.json({ html: sanitizeHtml(data.html || "") });
    } catch (e) {
      res.status(500).json({ error: jsonErr(e) });
    }
  });

  /* ---------- #4 cost help ---------- */
  api.post("/ai/cost", requireStaff, async (req, res) => {
    if (!withinBudget(res)) return;
    const { costModel, instruction, clientId, docId } = req.body || {};
    const context = buildContext(db, { docId, clientId });
    const system =
      "You help price a Fog Signal Strategies cost proposal. Given the current cost model and the project scope, " +
      "suggest reasonable flat/monthly fees per existing service category. Match each suggestion's `name` exactly to " +
      "an existing category name. Be realistic for a public-affairs / campaign-services engagement. " +
      "Do not fabricate constraints; explain each suggestion briefly.\n\n" +
      context;

    const user =
      `Current cost model (JSON):\n${JSON.stringify(costModel || {}, null, 2)}\n\n` +
      (instruction ? `Guidance: ${instruction}` : "Suggest prices for the categories that are missing or look off.");

    try {
      const { data, usage } = await runJSON({
        system,
        messages: [{ role: "user", content: user }],
        schema: COST_SCHEMA,
        maxTokens: 4000,
        effort: "medium",
      });
      recordUsage(db, { route: "cost", model: MODELS.reason, userId: req.user.id, usage });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: jsonErr(e) });
    }
  });

  /* ---------- #5 proofread → tracked-change edits ---------- */
  api.post("/ai/proofread", requireStaff, async (req, res) => {
    if (!withinBudget(res)) return;
    const { clientId, docId } = req.body || {};
    if (!docId) return res.status(400).json({ error: "docId required" });

    const context = buildContext(db, { docId, clientId });
    const system =
      "You are a meticulous proofreader for Fog Signal Strategies proposals. Review the CURRENT PROPOSAL below and " +
      "return precise find/replace edits. Only flag real issues: typos, grammar, punctuation, clarity, internal " +
      "consistency, and tone. Each `find` MUST be an exact plain-text substring of the block it targets, and short " +
      "enough to be unambiguous. Use the block ids shown in brackets as `blockKey`. Do not rewrite whole sections; " +
      "make surgical corrections.\n\n" +
      context;

    try {
      const { data, usage } = await runJSON({
        system,
        messages: [{ role: "user", content: "Proofread the current proposal and return the edits." }],
        schema: PROOFREAD_SCHEMA,
        maxTokens: 8000,
        effort: "high",
      });
      recordUsage(db, { route: "proofread", model: MODELS.reason, userId: req.user.id, usage });
      res.json({ edits: Array.isArray(data.edits) ? data.edits : [] });
    } catch (e) {
      res.status(500).json({ error: jsonErr(e) });
    }
  });
}
