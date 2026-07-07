import { createEditorProposal, editorClientType } from "./proposals-app-routes.js";

/** Map Cleatus triage labels to Keel proposal triage_state values. */
export function normalizeCleatusTriage(raw) {
  const s = String(raw || "").toLowerCase().replace(/[\s_-]+/g, "_");
  if (s.includes("building") && s.includes("proposal")) return "building";
  if (s === "inbox" || s === "new") return "inbox";
  if (s.includes("review")) return "internal_review";
  if (s === "sent") return "sent";
  if (s === "signed" || s === "won") return "signed";
  if (s === "declined" || s === "lost") return "declined";
  return "inbox";
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

export function createProposalFromCleatus(db, body, { userId } = {}) {
  const externalId = body.id || body.opportunityId || body.opportunity_id;
  if (!externalId) throw new Error("Missing Cleatus opportunity id");

  const existing = db.prepare("SELECT id, proposal_id FROM cleatus_events WHERE external_id = ?").get(String(externalId));
  if (existing?.proposal_id) {
    return { proposalId: existing.proposal_id, duplicate: true };
  }

  const triageState = normalizeCleatusTriage(body.triage || body.triageState || body.stage);
  const clientId = body.clientId || matchClientByCleatusPayload(db, body) || body.client_id;
  if (!clientId) {
    const eventResult = db.prepare(
      `INSERT INTO cleatus_events (external_id, event_type, payload_json, processing_error)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(external_id) DO UPDATE SET payload_json = excluded.payload_json, processing_error = excluded.processing_error`
    ).run(
      String(externalId),
      body.event || body.eventType || "opportunity.updated",
      JSON.stringify(body),
      "no_matching_client",
    );
    return { eventId: eventResult.lastInsertRowid, unassigned: true };
  }

  const client = db.prepare("SELECT name, type FROM clients WHERE id = ?").get(clientId);
  const title = body.title || body.opportunityTitle || `Proposal — ${client?.name || clientId}`;

  const cleatusMeta = {
    rfpUrl: body.rfp?.url || body.rfpUrl || null,
    rfpSummary: body.rfp?.summary || body.rfpSummary || body.rfpText || null,
    rfpDueDate: body.rfp?.dueDate || body.rfpDueDate || body.dueDate || null,
    staffNotes: body.staffNotes || body.staff_notes || body.notes || null,
    cleatusId: String(externalId),
    rawTriage: body.triage || body.triageState || body.stage,
  };

  const ct = editorClientType(client?.type);
  const { proposalId, doc } = createEditorProposal(db, {
    title,
    clientId,
    agency: client?.name || "",
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
