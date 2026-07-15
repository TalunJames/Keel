import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { applyCleatusUpdate, createProposalFromCleatus, flattenPursuitEvent, normalizeCleatusTriage } from "./cleatus-proposals.js";
import { cleatusConfigured } from "./cleatus-api.js";
import { getCleatusSyncState, runCleatusSync, startCleatusSync } from "./cleatus-sync.js";
import { getSecret } from "./integration-settings.js";

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
    const secret = getSecret("cleatus_webhook_secret");
    if (!secret) {
      return res.status(503).json({ error: "Webhook not configured" });
    }

    // HMAC must be computed over the exact received bytes, not a re-serialized body.
    const rawBody = req.rawBody;
    const signature = req.headers["x-cleatus-signature"] || req.headers["x-hub-signature-256"] || "";

    if (!verifyCleatusSignature(rawBody, signature, secret)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    // CLEATUS sends pursuit events as { id, event, timestamp, data: { …, contract } };
    // flatten them to the shape the ingest helpers expect. Flat payloads pass through.
    const body = flattenPursuitEvent(req.body || {});

    try {
      if ((body.event || "").startsWith("pursuit.updated")) {
        const updated = applyCleatusUpdate(db, body);
        if (updated) {
          return res.json({ ok: true, updated: !!updated.updated, proposalId: updated.proposalId });
        }
        // Not linked to a proposal yet — fall through to create.
      }

      // A pursuit only becomes a Keel proposal once it's moved to the
      // "Building a proposal" column in CLEATUS (body.force overrides).
      if (normalizeCleatusTriage(body.triage || body.triageState || body.stage) !== "building" && !body.force) {
        return res.json({ ok: true, skipped: true, reason: "not_building_yet" });
      }

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
      configured: !!getSecret("cleatus_webhook_secret"),
      apiConfigured: cleatusConfigured(),
      webhookUrl: "/api/integrations/cleatus/webhook",
      lastEvent: last || null,
      pendingUnassigned: pending,
      lastSync: getCleatusSyncState(db).lastSync,
    });
  });

  // Manual "sync now" — pulls pursuits from the CLEATUS API immediately.
  app.post("/api/integrations/cleatus/sync", auth, async (req, res) => {
    if (req.user.role !== "admin" && req.user.role !== "staff") {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (!cleatusConfigured()) {
      return res.status(400).json({ error: "No CLEATUS API key configured. Add one under Admin → Integrations." });
    }
    try {
      const result = await runCleatusSync(db, { who: req.user.email || "cleatus-sync" });
      res.json(result);
    } catch (err) {
      console.error("[cleatus sync]", err);
      res.status(502).json({ error: err.message || "Sync failed" });
    }
  });

  // Background poll — no-ops until an API key is configured.
  startCleatusSync(db);
}
