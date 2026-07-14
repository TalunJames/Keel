// Central store for third-party API keys / connection secrets.
//
// Each secret can come from two places, checked in order:
//   1. The database (app_settings row `integration_secret:<key>`) — set once by a
//      system admin from Admin → Integrations. Survives restarts and deploys.
//   2. The server environment (.env) — the original mechanism, kept as a fallback
//      so existing deployments keep working without re-entering keys.
//
// Values are NEVER returned to the browser in full — the admin API only exposes
// a masked preview (last 4 characters) and where the value came from.

/** Registry of supported integrations. Add a row here to expose a new key in the UI. */
export const INTEGRATIONS = {
  anthropic_api_key: {
    label: "Claude (Anthropic) API key",
    env: "ANTHROPIC_API_KEY",
    help: "Powers the proposal editor AI (draft, chat, cost help, proofread). Get a key at console.anthropic.com.",
    placeholder: "sk-ant-...",
    testable: true,
  },
  zapier_design_webhook_url: {
    label: "Zapier design webhook URL",
    env: "ZAPIER_DESIGN_WEBHOOK_URL",
    help: "Zapier catch-hook URL that receives design request lifecycle events (submitted, closed).",
    placeholder: "https://hooks.zapier.com/hooks/catch/...",
    testable: false,
  },
  cleatus_webhook_secret: {
    label: "CLEATUS webhook signing secret",
    env: "CLEATUS_WEBHOOK_SECRET",
    help: "Shared secret used to verify inbound CLEATUS webhook signatures at /api/integrations/cleatus/webhook.",
    placeholder: "shared secret",
    testable: false,
  },
};

const SETTING_PREFIX = "integration_secret:";

let _db = null;

/** Call once at startup (registerRoutes) so getSecret() works everywhere. */
export function initIntegrationSettings(db) {
  _db = db;
}

function readDbValue(key) {
  if (!_db) return null;
  try {
    const row = _db
      .prepare("SELECT value, updated_at FROM app_settings WHERE key = ?")
      .get(SETTING_PREFIX + key);
    if (!row || !row.value) return null;
    return row;
  } catch {
    return null;
  }
}

/**
 * Resolve a secret: DB value first, then env fallback.
 * @returns {string} the secret value, or "" when unconfigured.
 */
export function getSecret(key) {
  const def = INTEGRATIONS[key];
  if (!def) return "";
  const row = readDbValue(key);
  if (row?.value) return row.value;
  return (process.env[def.env] || "").trim();
}

export function setSecret(db, key, value) {
  if (!INTEGRATIONS[key]) throw new Error(`Unknown integration: ${key}`);
  db.prepare(
    `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).run(SETTING_PREFIX + key, String(value));
}

export function clearSecret(db, key) {
  if (!INTEGRATIONS[key]) throw new Error(`Unknown integration: ${key}`);
  db.prepare("DELETE FROM app_settings WHERE key = ?").run(SETTING_PREFIX + key);
}

function maskPreview(value) {
  const v = String(value || "");
  if (!v) return "";
  if (v.length <= 8) return "••••";
  return "••••" + v.slice(-4);
}

/** Status list for the admin UI — masked previews only, never the raw value. */
export function listIntegrations() {
  return Object.entries(INTEGRATIONS).map(([key, def]) => {
    const row = readDbValue(key);
    const envValue = (process.env[def.env] || "").trim();
    const source = row?.value ? "settings" : envValue ? "env" : null;
    const active = row?.value || envValue || "";
    return {
      key,
      label: def.label,
      help: def.help,
      placeholder: def.placeholder,
      envVar: def.env,
      testable: !!def.testable,
      configured: !!active,
      source,
      preview: maskPreview(active),
      updatedAt: row?.updated_at || null,
    };
  });
}
