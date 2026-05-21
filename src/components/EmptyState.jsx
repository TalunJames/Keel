import { Icon } from "./ui.jsx";

export function EmptyState({ title, description, actionLabel, onAction, icon = "folder" }) {
  return (
    <div className="card card-pad" style={{ maxWidth: 520, margin: "24px 0" }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{
          width: 44, height: 44, borderRadius: 4,
          background: "var(--fs-bone-50)", border: "1px solid var(--fs-border)",
          display: "grid", placeItems: "center", color: "var(--fs-navy)", flexShrink: 0,
        }}>
          <Icon name={icon} size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: "0 0 6px", fontFamily: "var(--fs-font-display)", color: "var(--fs-navy)", fontSize: 18 }}>{title}</h3>
          {description && <p className="mut" style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.55 }}>{description}</p>}
          {actionLabel && onAction && (
            <button type="button" className="btn primary" onClick={onAction}>{actionLabel}</button>
          )}
        </div>
      </div>
    </div>
  );
}
