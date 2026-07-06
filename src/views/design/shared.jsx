import { Tag, Avatar, Icon } from "../../components/ui.jsx";
import { statusTone } from "../../lib/design-status.js";

export function StatusStrip({ stats, onFilter, activeFilter }) {
  if (!stats) return null;
  const cards = [
    { key: "Submitted", label: "Submitted", count: stats.intake, tone: "outline" },
    { key: "Assigned", label: "Assigned", count: stats.briefReview, tone: "navy" },
    { key: "In Design", label: "In Design", count: stats.inDesign, tone: "warning" },
    { key: "Final Proof", label: "Final Proof", count: stats.proofing, tone: "gold" },
    { key: "approvedWeek", label: "Closed this week", count: stats.approvedWeek, tone: "success" },
  ];
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 1,
      background: "var(--fs-border)", border: "1px solid var(--fs-border)",
      borderRadius: 4, marginBottom: 24, overflow: "hidden",
    }}>
      {cards.map((s) => (
        <button
          key={s.key}
          type="button"
          className="btn ghost"
          style={{
            background: "var(--fs-paper)", padding: "16px 18px", borderRadius: 0,
            textAlign: "left", border: activeFilter === s.key ? "2px solid var(--fs-navy)" : "none",
          }}
          onClick={() => onFilter?.(activeFilter === s.key ? null : s.key)}
        >
          <div className="num" style={{ fontFamily: "var(--fs-font-display)", fontSize: 26, fontWeight: 700, color: "var(--fs-navy)" }}>
            {s.count}
          </div>
          <div className="mut" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600, marginTop: 2 }}>
            {s.label}
          </div>
        </button>
      ))}
    </div>
  );
}

export function DeskSummaryStrip({ stats }) {
  if (!stats) return null;
  const cards = [
    { label: "Due today", count: stats.dueToday },
    { label: "Overdue", count: stats.overdue },
    { label: "In design", count: stats.inDesign },
    { label: "Awaiting upload", count: stats.awaitingUpload },
    { label: "In proofing", count: stats.inProofing },
  ];
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 1,
      background: "var(--fs-border)", border: "1px solid var(--fs-border)",
      borderRadius: 4, marginBottom: 24, overflow: "hidden",
    }}>
      {cards.map((s) => (
        <div key={s.label} style={{ background: "var(--fs-paper)", padding: "16px 18px" }}>
          <div className="num" style={{ fontFamily: "var(--fs-font-display)", fontSize: 26, fontWeight: 700, color: "var(--fs-navy)" }}>
            {s.count}
          </div>
          <div className="mut" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600, marginTop: 2 }}>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PriorityBadge({ priority }) {
  if (priority === "Urgent") return <Tag tone="danger">Urgent</Tag>;
  if (priority === "Important") return <Tag tone="warning">Important</Tag>;
  if (priority === "Backburner") return <Tag tone="outline">Backburner</Tag>;
  return null;
}

export function RequestTable({ items, role, isDesigner, onOpen, onAssign, onClaim, designers, showAssignee = true }) {
  if (!items?.length) {
    return (
      <div className="card card-pad mut" style={{ fontSize: 13, textAlign: "center", padding: 40 }}>
        No requests match this view.
      </div>
    );
  }
  const isClient = role === "client";
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <table className="tbl">
        <thead>
          <tr>
            <th>Title</th>
            {!isClient && <th>Client</th>}
            <th>Type</th>
            <th>Status</th>
            {showAssignee && !isClient && <th>Assignee</th>}
            <th>Due</th>
            {!isClient && <th>Priority</th>}
            {!isClient && (onAssign || onClaim) && <th></th>}
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => onOpen(r)}>
              <td style={{ fontWeight: 600, color: "var(--fs-navy)" }}>{r.title}</td>
              {!isClient && <td className="mut">{r.clientName || r.clientId}</td>}
              <td className="mut">{r.assetType || "—"}</td>
              <td><Tag tone={statusTone(r.status)}>{r.status}</Tag></td>
              {showAssignee && !isClient && (
                <td>
                  {r.assigneeName ? (
                    <span className="row" style={{ gap: 8 }}>
                      <Avatar name={r.assigneeName} size={22} />
                      <span style={{ fontSize: 13 }}>{r.assigneeName}</span>
                    </span>
                  ) : <span className="mut">—</span>}
                </td>
              )}
              <td className="mut">{r.due || "—"}</td>
              {!isClient && (
                <td>
                  <PriorityBadge priority={r.priority} />
                  {!["Urgent", "Important", "Backburner"].includes(r.priority) && (
                    <span className="mut" style={{ fontSize: 12 }}>{r.priority || "Normal"}</span>
                  )}
                </td>
              )}
              {!isClient && (onAssign || onClaim) && (
                <td onClick={(e) => e.stopPropagation()}>
                  {onAssign ? (
                    <select
                      className="input"
                      style={{ fontSize: 12, padding: "4px 8px", minWidth: 120 }}
                      value={r.assigneeId || ""}
                      onChange={(e) => onAssign(r, e.target.value || null)}
                    >
                      <option value="">Unassigned</option>
                      {(designers || []).map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  ) : !r.assigneeId && onClaim ? (
                    <button type="button" className="btn primary sm" onClick={() => onClaim(r)}>
                      Claim
                    </button>
                  ) : null}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PoolTable({ items, onClaim, onOpen }) {
  if (!items?.length) {
    return (
      <div className="card card-pad mut" style={{ fontSize: 13, textAlign: "center", padding: 32 }}>
        No unassigned requests in the pool.
      </div>
    );
  }
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <table className="tbl">
        <thead>
          <tr>
            <th>Title</th>
            <th>Client</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Due</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id}>
              <td style={{ fontWeight: 600, color: "var(--fs-navy)", cursor: "pointer" }} onClick={() => onOpen?.(r)}>
                {r.title}
              </td>
              <td className="mut">{r.clientName}</td>
              <td><Tag tone={statusTone(r.status)}>{r.status}</Tag></td>
              <td><PriorityBadge priority={r.priority} /></td>
              <td className="mut">{r.due || "—"}</td>
              <td>
                <button type="button" className="btn primary sm" onClick={() => onClaim(r)}>
                  Claim
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TabRow({ tabs, active, onChange }) {
  return (
    <div className="row" style={{ gap: 4, marginBottom: 20, borderBottom: "1px solid var(--fs-border)", paddingBottom: 0 }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={"btn " + (active === t.id ? "primary" : "ghost")}
          style={{ borderRadius: "4px 4px 0 0", marginBottom: -1 }}
          onClick={() => onChange(t.id)}
        >
          {t.icon && <Icon name={t.icon} size={13} />}
          {t.label}
        </button>
      ))}
    </div>
  );
}
