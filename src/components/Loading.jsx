import { Icon } from "./ui.jsx";

export function Loading({ label = "Loading…" }) {
  return (
    <div className="card card-pad" style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--fs-fg-muted)", fontSize: 13 }}>
      <Icon name="loading" size={18} style={{ animation: "spin 1s linear infinite" }} />
      {label}
    </div>
  );
}
