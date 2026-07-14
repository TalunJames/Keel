// Monthly AI spend limit — a hard budget enforced BEFORE each AI call, based
// on the token log in ai_usage (see recordUsage in claude.js).
//
// Cost is estimated from per-model list prices. Note recordUsage folds cached
// input tokens (billed at ~0.1x) into input_tokens, so the estimate slightly
// OVERSTATES real spend — the cap trips a little early, never late.

const KEY = "ai_spend_limit";

// Enabled at $30/month out of the box; the stored setting (Admin →
// Integrations) overrides this once saved.
export const DEFAULT_SPEND_LIMIT = { enabled: true, monthlyUsd: 30 };

// USD per million tokens.
const PRICES = {
  "claude-opus-4-8": { in: 5, out: 25 },
  "claude-haiku-4-5": { in: 1, out: 5 },
};
const FALLBACK_PRICE = { in: 5, out: 25 }; // unknown model → assume Opus pricing (conservative)

export function getSpendLimit(db) {
  try {
    const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(KEY);
    if (!row?.value) return { ...DEFAULT_SPEND_LIMIT };
    const parsed = JSON.parse(row.value);
    const monthlyUsd = Number(parsed.monthlyUsd);
    return {
      enabled: !!parsed.enabled,
      monthlyUsd: Number.isFinite(monthlyUsd) && monthlyUsd > 0 ? monthlyUsd : DEFAULT_SPEND_LIMIT.monthlyUsd,
    };
  } catch {
    return { ...DEFAULT_SPEND_LIMIT };
  }
}

export function setSpendLimit(db, { enabled, monthlyUsd }) {
  const value = JSON.stringify({
    enabled: !!enabled,
    monthlyUsd: Math.min(10000, Math.max(1, Number(monthlyUsd) || DEFAULT_SPEND_LIMIT.monthlyUsd)),
  });
  db.prepare(
    `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).run(KEY, value);
  return getSpendLimit(db);
}

/** Estimated calendar-month-to-date AI spend in USD (UTC month boundary). */
export function monthToDateSpendUsd(db) {
  try {
    const rows = db.prepare(
      `SELECT model, SUM(input_tokens) AS i, SUM(output_tokens) AS o
       FROM ai_usage
       WHERE created_at >= datetime('now', 'start of month')
       GROUP BY model`
    ).all();
    let usd = 0;
    for (const r of rows) {
      const p = PRICES[r.model] || FALLBACK_PRICE;
      usd += ((r.i || 0) * p.in + (r.o || 0) * p.out) / 1_000_000;
    }
    return usd;
  } catch {
    return 0; // ai_usage table not created yet → nothing spent
  }
}

/**
 * Budget status for gating + display.
 * `allowed` is false only when the limit is enabled AND month-to-date spend
 * has reached it.
 */
export function checkAiBudget(db) {
  const limit = getSpendLimit(db);
  const spentUsd = monthToDateSpendUsd(db);
  return {
    enabled: limit.enabled,
    limitUsd: limit.monthlyUsd,
    spentUsd: Math.round(spentUsd * 100) / 100,
    allowed: !limit.enabled || spentUsd < limit.monthlyUsd,
  };
}
