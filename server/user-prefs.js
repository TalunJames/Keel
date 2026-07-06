/** @typedef {{ clientOrder?: string[] }} UserPreferences */

/** @returns {UserPreferences} */
export function parsePreferences(json) {
  if (!json) return {};
  try {
    const raw = typeof json === "string" ? JSON.parse(json) : json;
    if (!raw || typeof raw !== "object") return {};
    const clientOrder = Array.isArray(raw.clientOrder)
      ? raw.clientOrder.filter((id) => typeof id === "string" && id.length > 0)
      : undefined;
    return clientOrder?.length ? { clientOrder } : {};
  } catch {
    return {};
  }
}

/** @param {UserPreferences} prefs */
export function serializePreferences(prefs) {
  const out = {};
  if (Array.isArray(prefs?.clientOrder) && prefs.clientOrder.length) {
    out.clientOrder = prefs.clientOrder;
  }
  return JSON.stringify(out);
}

/** @param {import('better-sqlite3').Database} db @param {string} userId */
export function loadUserPreferences(db, userId) {
  const row = db.prepare("SELECT preferences_json FROM users WHERE id = ?").get(userId);
  return parsePreferences(row?.preferences_json);
}
