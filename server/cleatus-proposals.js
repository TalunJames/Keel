import { createEditorProposal, editorClientType } from "./proposals-app-routes.js";

// Pursuit-stage proposals need a client to attach to (proposals.client_id is
// NOT NULL), but the firm doesn't create a real Keel client until a contract is
// won. So unmatched pursuits land on a house/"internal" client — the same place
// the firm's own marketing lives — and get reassigned to the real client on win.
const INTERNAL_CLIENT_ID = "internal";
const INTERNAL_CLIENT_NAME = "Internal";
const FALLBACK_SETTING = "cleatus_fallback_client_id";

/**
 * Resolve the house/"Internal" client, creating it only if truly absent.
 * Matches an existing one by our stable id OR by the name "Internal" — the
 * live workspace already has an "Internal" client whose id was derived from
 * its tag (not literally "internal"), so a name check avoids making a
 * duplicate. Returns whatever id the existing/created client has.
 */
function ensureInternalClient(db) {
  const byId = db.prepare("SELECT id FROM clients WHERE id = ?").get(INTERNAL_CLIENT_ID);
  if (byId) return byId.id;
  const byName = db.prepare(
    "SELECT id FROM clients WHERE name = ? COLLATE NOCASE ORDER BY created_at LIMIT 1"
  ).get(INTERNAL_CLIENT_NAME);
  if (byName) return byName.id;
  db.prepare(
    `INSERT INTO clients (id, name, tag, initials, account, type, color, audience, active)
     VALUES (?, ?, 'INT', 'IN', '', 'Internal / House', 'var(--fs-navy)', '', 1)`
  ).run(INTERNAL_CLIENT_ID, INTERNAL_CLIENT_NAME);
  return INTERNAL_CLIENT_ID;
}

/**
 * Where unmatched pursuits attach. An admin can repoint this at any client via
 * the app_settings row `cleatus_fallback_client_id`; otherwise it's the
 * auto-created internal/house client.
 */
export function resolveFallbackClientId(db) {
  try {
    const override = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(FALLBACK_SETTING)?.value;
    if (override && db.prepare("SELECT id FROM clients WHERE id = ?").get(override)) return override;
  } catch { /* fall through to the house client */ }
  return ensureInternalClient(db);
}

/**
 * Map Cleatus triage labels / pursuit phases to Keel proposal triage_state
 * values (which the builder surfaces as Submitted / Won / Lost / Archived tags).
 * The column/phase label is the primary signal; `statusHint` is the pipeline
 * bucket the pursuit was fetched from (active | won | archived) and only
 * decides ambiguous cases.
 */
export function normalizeCleatusTriage(raw, statusHint) {
  const s = String(raw || "").toLowerCase().replace(/[\s_-]+/g, "_");
  if (s.includes("building") && s.includes("proposal")) return "building";
  if (s === "inbox" || s === "new" || s === "triage") return "inbox";
  if (s.includes("review")) return "internal_review";
  if (s === "preparing") return "building";
  if (s === "sent" || s === "submitted") return "sent";
  if (s === "signed" || s === "won" || s.includes("award")) return "signed";
  if (s === "declined" || s === "lost" || s.includes("reject")) return "declined";
  if (s.includes("archiv")) return "archived";
  // No decisive column label — fall back to the pipeline bucket.
  const hint = String(statusHint || "").toLowerCase();
  if (hint === "won") return "signed";
  if (hint === "archived") return "archived";
  return "inbox";
}

/**
 * Flatten a CLEATUS pursuit into the flat body createProposalFromCleatus
 * expects. Handles both shapes the service produces:
 *   - webhook / Zapier events: { id, event, timestamp, data: { …, contract } }
 *   - bare REST records from /v1/pipeline/search: { id, phase, …, contract }
 * Already-flat payloads (no contract/data) pass through unchanged.
 */
export function flattenPursuitEvent(evt) {
  if (!evt || typeof evt !== "object") return evt;
  const d = evt.data && typeof evt.data === "object" ? evt.data : evt;
  const c = d.contract || d.opportunity;
  if (!c && d === evt) return evt; // flat payload — nothing to unwrap

  const contract = c || {};
  const notes = [
    d.matchReason ? `Match reason: ${d.matchReason}` : null,
    d.complianceScore != null ? `Compliance score: ${d.complianceScore}` : null,
    d.complianceSummary || null,
    d.pursuitChanges?.description ? `Latest change: ${d.pursuitChanges.description}` : null,
  ].filter(Boolean).join("\n\n");

  return {
    id: d.id || d.pursuitId || evt.id,
    event: evt.event || "pursuit.updated",
    // Pipeline column is the most specific signal; pursuit phase is the fallback.
    triage: d.columnTitle || d.column?.title || d.column?.label || d.phase || d.status || "",
    title: d.pursuitTitle || d.title || contract.title || "",
    clientName: contract.agencyName || null,
    rfp: {
      url: contract.sourceUrl || contract.providerUrl || null,
      summary: contract.summary || contract.overview || null,
      // Editor deadlines are date-only strings; trim CLEATUS's full ISO timestamp.
      dueDate: contract.deadlineDate ? String(contract.deadlineDate).slice(0, 10) : null,
      number: contract.solicitationNumber || null,
    },
    staffNotes: notes || null,
  };
}

function emailMatchesDomain(email, domain) {
  const at = String(email || "").toLowerCase().lastIndexOf("@");
  if (at < 0) return false;
  const host = String(email).toLowerCase().slice(at + 1);
  return host === domain || host.endsWith("." + domain);
}

function matchClientByCleatusPayload(db, body) {
  const name = body.client?.name || body.clientName || body.accountName;
  const domain = body.client?.domain || body.clientDomain;
  if (name) {
    const byName = db.prepare("SELECT id FROM clients WHERE name = ? COLLATE NOCASE LIMIT 1").get(name);
    if (byName) return byName.id;
  }
  if (domain) {
    const target = String(domain).toLowerCase().replace(/^@/, "");
    const clients = db.prepare("SELECT id, payload_json FROM clients").all();
    for (const c of clients) {
      if (!c.payload_json) continue;
      try {
        const p = JSON.parse(c.payload_json);
        const contacts = p.contacts || [];
        if (contacts.some((ct) => emailMatchesDomain(ct.email, target))) {
          return c.id;
        }
      } catch { /* skip */ }
    }
  }
  return null;
}

/**
 * Apply a pursuit.updated event to an existing Cleatus-linked proposal.
 * Returns null when no proposal is linked to the pursuit (caller may create one).
 */
export function applyCleatusUpdate(db, body) {
  const externalId = body.id || body.opportunityId || body.opportunity_id;
  if (!externalId) throw new Error("Missing Cleatus opportunity id");

  const row = db.prepare(
    "SELECT id, triage_state, payload_json FROM proposals WHERE source = 'cleatus' AND source_ref = ?"
  ).get(String(externalId));
  if (!row) return null;

  db.prepare(
    `INSERT INTO cleatus_events (external_id, event_type, payload_json, processed_at, proposal_id)
     VALUES (?, ?, ?, datetime('now'), ?)
     ON CONFLICT(external_id) DO UPDATE SET
       event_type = excluded.event_type,
       payload_json = excluded.payload_json,
       processed_at = excluded.processed_at,
       proposal_id = excluded.proposal_id,
       processing_error = NULL`
  ).run(String(externalId), body.event || "pursuit.updated", JSON.stringify(body), row.id);

  const triageState = normalizeCleatusTriage(body.triage || body.triageState || body.stage, body.pipelineStatus);
  if (triageState === row.triage_state) {
    return { proposalId: row.id, triageState, unchanged: true };
  }

  let payload = null;
  try { payload = row.payload_json ? JSON.parse(row.payload_json) : null; } catch { /* keep null */ }
  if (payload) {
    payload.triageState = triageState;
    db.prepare("UPDATE proposals SET triage_state = ?, payload_json = ? WHERE id = ?")
      .run(triageState, JSON.stringify(payload), row.id);
  } else {
    db.prepare("UPDATE proposals SET triage_state = ? WHERE id = ?").run(triageState, row.id);
  }
  return { proposalId: row.id, triageState, updated: true };
}

export function createProposalFromCleatus(db, body, { userId } = {}) {
  const externalId = body.id || body.opportunityId || body.opportunity_id;
  if (!externalId) throw new Error("Missing Cleatus opportunity id");

  const existing = db.prepare("SELECT id, proposal_id FROM cleatus_events WHERE external_id = ?").get(String(externalId));
  if (existing?.proposal_id) {
    return { proposalId: existing.proposal_id, duplicate: true };
  }

  const triageState = normalizeCleatusTriage(body.triage || body.triageState || body.stage, body.pipelineStatus);
  // A real client match wins; unmatched pursuits attach to the house/internal
  // client so the proposal can exist before the contract is won.
  const matchedClientId = body.clientId || matchClientByCleatusPayload(db, body) || body.client_id;
  const usingFallback = !matchedClientId;
  const clientId = matchedClientId || resolveFallbackClientId(db);

  const client = db.prepare("SELECT name, type FROM clients WHERE id = ?").get(clientId);
  const title = body.title || body.opportunityTitle || `Proposal — ${body.clientName || body.client?.name || client?.name || clientId}`;

  const cleatusMeta = {
    rfpUrl: body.rfp?.url || body.rfpUrl || null,
    rfpSummary: body.rfp?.summary || body.rfpSummary || body.rfpText || null,
    rfpDueDate: body.rfp?.dueDate || body.rfpDueDate || body.dueDate || null,
    staffNotes: body.staffNotes || body.staff_notes || body.notes || null,
    cleatusId: String(externalId),
    rawTriage: body.triage || body.triageState || body.stage,
    // True when this attached to the house client rather than a real one, so
    // these can be found and reassigned to the real client once the deal wins.
    pendingClient: usingFallback,
    // Shows the "upload RFP & start drafting" call to action on the home grid
    // until an RFP is drafted into this proposal (cleared by /ai/draft).
    needsRfp: true,
  };

  const ct = editorClientType(client?.type);
  const { proposalId, doc } = createEditorProposal(db, {
    title,
    clientId,
    agency: body.clientName || body.client?.name || client?.name || "",
    clientType: ct,
    rfpNumber: body.rfp?.number || body.rfpNumber || "",
    deadline: cleatusMeta.rfpDueDate || "",
    triageState,
    source: "cleatus",
    sourceRef: String(externalId),
    ownerId: userId || null,
    cleatus: cleatusMeta,
    amount: body.amount ?? body.value ?? null,
  });

  if (cleatusMeta.rfpSummary && doc?.blocks?.length) {
    const about = doc.blocks.find((b) => b.type === "about" || b.type === "understanding");
    if (about) {
      doc.content = doc.content || {};
      doc.content[about.id] = `<p>${String(cleatusMeta.rfpSummary).replace(/</g, "&lt;")}</p>`;
      db.prepare("UPDATE proposals SET payload_json = ? WHERE id = ?")
        .run(JSON.stringify({ ...doc, format: "editor-v1" }), proposalId);
    }
  }

  db.prepare(
    `INSERT INTO cleatus_events (external_id, event_type, payload_json, processed_at, proposal_id)
     VALUES (?, ?, ?, datetime('now'), ?)
     ON CONFLICT(external_id) DO UPDATE SET
       payload_json = excluded.payload_json,
       processed_at = excluded.processed_at,
       proposal_id = excluded.proposal_id,
       processing_error = NULL`
  ).run(
    String(externalId),
    body.event || body.eventType || "opportunity.updated",
    JSON.stringify(body),
    proposalId,
  );

  return { proposalId, triageState };
}
