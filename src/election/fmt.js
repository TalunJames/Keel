const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtDate(iso, opts = {}) {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00");
  const s = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return opts.year ? `${s}, ${d.getFullYear()}` : s;
}

export function fmtMoney(n) {
  if (n >= 1e9) return "$" + (n / 1e9).toFixed(n % 1e9 ? 1 : 0) + "B";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + "M";
  if (n >= 1e3) return "$" + Math.round(n / 1e3) + "K";
  return "$" + n;
}

export function daysUntil(iso, todayIso) {
  const d = new Date(iso + "T12:00:00");
  const now = new Date((todayIso || "2026-06-02") + "T12:00:00");
  return Math.round((d - now) / 86400000);
}

export const selStyle = {
  fontFamily: "var(--fs-font-sans)",
  fontSize: 13.5,
  color: "var(--fs-ink)",
  padding: "8px 10px",
  border: "1px solid var(--fs-border-strong)",
  borderRadius: 4,
  background: "var(--fs-paper)",
  minWidth: 128,
  cursor: "pointer",
};

export const navArrow = {
  display: "grid",
  placeItems: "center",
  width: 32,
  height: 32,
  border: "1px solid var(--fs-border)",
  borderRadius: 4,
  background: "var(--fs-paper)",
  cursor: "pointer",
  color: "var(--fs-navy)",
};
