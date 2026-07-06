import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { createProposalFromCleatus } from "./proposal-routes.js";

function verifyCleatusSignature(rawBody, signature, secret) {
  // Fail closed: without a configured secret, a raw body, or a signature we cannot verify.
  if (!secret) return false;
  if (!Buffer.isBuffer(rawBody) && typeof rawBody !== "string") return false;
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const sig = String(signature).replace(/^sha256=/, "");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

const cleatusWebhookLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

export function registerCleatusRoutes(app, db, auth) {
  app.post("/api/integrations/cleatus/webhook", cleatusWebhookLimiter, (req, res) => {
    const secret = process.env.CLEATUS_WEBHOOK_SECRET || "";
    if (!secret) {
      return res.status(503).json({ error: "Webhook not configured" });
    }

    // HMAC must be computed over the exact received bytes, not a re-serialized body.
    const rawBody = req.rawBody;
    const signature = req.headers["x-cleatus-signature"] || req.headers["x-hub-signature-256"] || "";

    if (!verifyCleatusSignature(rawBody, signature, secret)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const body = req.body || {};
    const triage = String(body.triage || body.triageState || body.stage || "").toLowerCase();
    const isBuilding = triage.includes("building") && triage.includes("proposal");
    const isInbox = !triage || triage === "inbox" || triage === "new";

    if (!isBuilding && !isInbox && !body.force) {
      return res.json({ ok: true, skipped: true, reason: "triage_not_actionable" });
    }

    try {
      const result = createProposalFromCleatus(db, body);
      if (result.duplicate) {
        return res.json({ ok: true, duplicate: true, proposalId: result.proposalId });
      }
      if (result.unassigned) {
        return res.status(202).json({
          ok: true,
          unassigned: true,
          eventId: result.eventId,
          message: "Stored — no matching Keel client. Link manually in Proposals triage.",
        });
      }
      return res.status(201).json({
        ok: true,
        proposalId: result.proposalId,
        triageState: result.triageState,
      });
    } catch (err) {
      console.error("[cleatus webhook]", err);
      return res.status(400).json({ error: err.message || "Processing failed" });
    }
  });

  app.get("/api/integrations/cleatus/status", auth, (req, res) => {
    if (req.user.role !== "admin" && req.user.role !== "staff") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const last = db.prepare(
      "SELECT received_at, event_type, external_id, proposal_id, processing_error FROM cleatus_events ORDER BY received_at DESC LIMIT 1"
    ).get();
    const pending = db.prepare(
      "SELECT COUNT(*) AS n FROM cleatus_events WHERE processing_error IS NOT NULL AND proposal_id IS NULL"
    ).get()?.n || 0;

    res.json({
      configured: !!(process.env.CLEATUS_WEBHOOK_SECRET),
      webhookUrl: "/api/integrations/cleatus/webhook",
      lastEvent: last || null,
      pendingUnassigned: pending,
    });
  });
}
