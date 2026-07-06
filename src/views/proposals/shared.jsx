import { Tag, Icon } from "../../components/ui.jsx";
import { triageTone, triageLabel } from "../../lib/proposal-status.js";

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

export function ProposalTable({ items, onOpen }) {
  if (!items?.length) {
    return (
      <div className="card card-pad mut" style={{ fontSize: 13, textAlign: "center", padding: 40 }}>
        No proposals yet. New Cleatus opportunities in &ldquo;building proposal&rdquo; triage appear here automatically.
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
            <th>Triage</th>
            <th>Source</th>
            <th>Due</th>
            <th style={{ textAlign: "right" }}>Value</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => onOpen(p)}>
              <td style={{ fontWeight: 600, color: "var(--fs-navy)" }}>{p.title}</td>
              <td className="mut">{p.clientName}</td>
              <td><Tag tone={triageTone(p.triageState)}>{triageLabel(p.triageState)}</Tag></td>
              <td className="mut">{p.source === "cleatus" ? "Cleatus" : "Manual"}</td>
              <td className="mut">{p.dueAt || "—"}</td>
              <td className="num" style={{ textAlign: "right", fontWeight: 700 }}>
                {p.amount != null ? "$" + Number(p.amount).toLocaleString() : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
