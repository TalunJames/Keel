// Allowlist for user/server-supplied URLs rendered into href/src attributes.
// Only http(s): absolute URLs and same-origin relative paths are permitted, so
// a stored value like `javascript:...` or `data:text/html,...` cannot execute.

const SAFE_ABSOLUTE = /^https?:\/\//i;

/**
 * Returns the URL if it is safe to use in an href/src, otherwise null.
 * - Absolute URLs must be http: or https:.
 * - Relative/root-relative and protocol-relative paths are treated as
 *   same-origin and allowed.
 */
export function safeUrl(url) {
  if (url == null) return null;
  const raw = String(url).trim();
  if (!raw) return null;

  // Root-relative, protocol-relative, or plain relative paths → same origin.
  if (raw.startsWith("/") || raw.startsWith("./") || raw.startsWith("../")) return raw;

  // Absolute URL: only allow http(s).
  if (SAFE_ABSOLUTE.test(raw)) return raw;

  // A value with no scheme and no leading slash (e.g. "example.com/page") is
  // ambiguous; resolve it against the current origin so it can't smuggle a
  // scheme. If it fails to parse or resolves to a non-http(s) scheme, reject.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    try {
      const resolved = new URL(raw, window.location.origin);
      return SAFE_ABSOLUTE.test(resolved.href) ? resolved.href : null;
    } catch {
      return null;
    }
  }

  // Any other explicit scheme (javascript:, data:, vbscript:, file:, …) → block.
  return null;
}

/**
 * Props to spread onto an <a target="_blank"> so it always carries a safe rel.
 */
export const BLANK_REL = "noopener noreferrer";
