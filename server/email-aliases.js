/** Domains treated as the same mailbox for login / uniqueness checks. */
const EQUIVALENT_DOMAINS = [
  ["fogsignalstrategies.com", "fogsignal.com"],
];

const domainAliasMap = new Map();
for (const pair of EQUIVALENT_DOMAINS) {
  for (let i = 0; i < pair.length; i++) {
    const others = pair.filter((_, j) => j !== i);
    domainAliasMap.set(pair[i].toLowerCase(), others.map((d) => d.toLowerCase()));
  }
}

/** Local@domain variants to try when resolving an email (exact first). */
export function emailLookupCandidates(email) {
  const trimmed = String(email || "").trim();
  if (!trimmed) return [];
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return [trimmed];

  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1).toLowerCase();
  const candidates = [`${local}@${domain}`];
  for (const alt of domainAliasMap.get(domain) || []) {
    candidates.push(`${local}@${alt}`);
  }
  return candidates;
}

/**
 * Find a user by email, accepting equivalent Fog Signal domains.
 * Exact domain match wins when both aliases somehow exist.
 */
export function findUserByEmail(db, email, selectSql) {
  const candidates = emailLookupCandidates(email);
  if (!candidates.length) return null;

  let fallback = null;
  const stmt = db.prepare(`${selectSql} WHERE email = ? COLLATE NOCASE`);
  for (const candidate of candidates) {
    const row = stmt.get(candidate);
    if (!row) continue;
    const storedDomain = String(row.email || "").split("@").pop()?.toLowerCase();
    const askedDomain = candidate.split("@").pop()?.toLowerCase();
    if (storedDomain === askedDomain) return row;
    if (!fallback) fallback = row;
  }
  return fallback;
}
