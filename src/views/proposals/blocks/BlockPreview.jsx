import React from "react";
import { Avatar, Icon } from "../../../components/ui.jsx";

function EditableText({ value, onChange, tag: Tag = "p", style, multiline }) {
  if (!onChange) return <Tag style={style}>{value}</Tag>;
  if (multiline) {
    return (
      <textarea
        className="input"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...style, width: "100%", border: "none", background: "transparent", resize: "vertical", minHeight: 60, padding: 0 }}
      />
    );
  }
  return (
    <input
      className="input"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...style, width: "100%", border: "none", background: "transparent", padding: 0 }}
    />
  );
}

export function BlockPreview({ type, client, content = {}, onChange }) {
  const cname = client?.name || content.title || "Client";
  const patch = (key, val) => onChange?.({ ...content, [key]: val });

  switch (type) {
    case "cover":
      return (
        <div style={{ padding: "30px 16px 20px", background: "var(--ks-ink-surface)", color: "var(--ks-on-ink)", borderRadius: 4, position: "relative", overflow: "hidden" }}>
          <svg width="240" height="240" viewBox="0 0 240 240" style={{ position: "absolute", right: -50, top: -50, opacity: 0.10 }}>
            <g fill="none" stroke="var(--fs-gold)" strokeWidth="1"><circle cx="120" cy="120" r="40" /><circle cx="120" cy="120" r="70" /><circle cx="120" cy="120" r="100" /></g>
          </svg>
          <EditableText value={content.eyebrow || "Engagement Proposal"} onChange={(v) => patch("eyebrow", v)} style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--fs-gold)", fontWeight: 600 }} />
          <EditableText value={content.title || cname} onChange={(v) => patch("title", v)} style={{ fontFamily: "var(--fs-font-display)", fontSize: 30, fontWeight: 700, margin: "10px 0 8px", letterSpacing: "-0.01em", color: "#fff" }} />
          <EditableText value={content.subtitle || "Prepared by Fog Signal Strategies"} onChange={(v) => patch("subtitle", v)} style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }} />
        </div>
      );
    case "summary":
    case "executive": {
      const paragraphs = content.paragraphs || [
        `We propose a focused engagement to advance ${cname}'s priority objectives.`,
      ];
      return (
        <>
          {paragraphs.map((p, i) => (
            <EditableText
              key={i}
              multiline
              value={p}
              onChange={(v) => {
                const next = [...paragraphs];
                next[i] = v;
                patch("paragraphs", next);
              }}
              style={{ fontSize: 15, lineHeight: 1.6, margin: i ? "10px 0 0" : 0 }}
            />
          ))}
        </>
      );
    }
    case "aboutfirm":
      return (
        <div className="row" style={{ gap: 18, alignItems: "flex-start" }}>
          <img src="design-system/assets/logo-stacked-blue.png" alt="" style={{ height: 56 }} />
          <div>
            <h4 style={{ fontFamily: "var(--fs-font-display)", margin: 0, color: "var(--fs-navy)", fontWeight: 700, fontSize: 17 }}>Fog Signal Strategies</h4>
            <EditableText multiline value={content.body} onChange={(v) => patch("body", v)} style={{ fontSize: 13, margin: "6px 0 0", lineHeight: 1.55, maxWidth: 540, color: "var(--fs-fg-muted)" }} />
          </div>
        </div>
      );
    case "situation":
      return (
        <>
          <EditableText value={content.title || "The situation"} onChange={(v) => patch("title", v)} tag="h4" style={{ fontFamily: "var(--fs-font-serif)", fontSize: 18, margin: "0 0 8px" }} />
          <EditableText multiline value={content.body} onChange={(v) => patch("body", v)} style={{ margin: 0, lineHeight: 1.6 }} />
        </>
      );
    case "approach": {
      const steps = content.steps || [];
      return (
        <>
          <EditableText value={content.title || "Our approach"} onChange={(v) => patch("title", v)} tag="h4" style={{ fontFamily: "var(--fs-font-serif)", fontSize: 18, margin: "0 0 10px" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            {steps.map((s, i) => (
              <div key={i}>
                <div className="kicker">{s.n}</div>
                <EditableText value={s.title} onChange={(v) => { const next = [...steps]; next[i] = { ...s, title: v }; patch("steps", next); }} style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 16, color: "var(--fs-navy)", margin: "6px 0 4px" }} />
                <EditableText multiline value={s.body} onChange={(v) => { const next = [...steps]; next[i] = { ...s, body: v }; patch("steps", next); }} style={{ fontSize: 13, margin: 0, lineHeight: 1.5, color: "var(--fs-fg-muted)" }} />
              </div>
            ))}
          </div>
        </>
      );
    }
    case "scope": {
      const rows = content.rows || [];
      return (
        <>
          <EditableText value={content.title || "Scope of work"} onChange={(v) => patch("title", v)} tag="h4" style={{ fontFamily: "var(--fs-font-serif)", fontSize: 18, margin: "0 0 10px" }} />
          <table className="tbl" style={{ borderTop: "1px solid var(--fs-border)" }}>
            <thead><tr><th>Workstream</th><th>What we'll do</th><th style={{ textAlign: "right" }}>Cadence</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, color: "var(--fs-navy)" }}>{r.workstream}</td>
                  <td>{r.detail}</td>
                  <td className="mut" style={{ textAlign: "right" }}>{r.cadence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      );
    }
    case "deliverables": {
      const items = content.items || [];
      return (
        <>
          <EditableText value={content.title || "Deliverables"} onChange={(v) => patch("title", v)} tag="h4" style={{ fontFamily: "var(--fs-font-serif)", fontSize: 18, margin: "0 0 10px" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {items.map((d, i) => (
              <div key={i} className="row" style={{ gap: 8, padding: "6px 0", fontSize: 13 }}>
                <Icon name="check" size={13} color="var(--fs-gold-700)" />
                <EditableText value={d} onChange={(v) => { const next = [...items]; next[i] = v; patch("items", next); }} />
              </div>
            ))}
          </div>
        </>
      );
    }
    case "team": {
      const members = content.members || [];
      return (
        <>
          <EditableText value={content.title || "Your team"} onChange={(v) => patch("title", v)} tag="h4" style={{ fontFamily: "var(--fs-font-serif)", fontSize: 18, margin: "0 0 12px" }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {members.map((p) => (
              <div key={p.name}>
                <Avatar name={p.name} size={44} />
                <div style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 14, color: "var(--fs-navy)", marginTop: 8 }}>{p.name}</div>
                <div className="mut" style={{ fontSize: 12 }}>{p.role}</div>
              </div>
            ))}
          </div>
        </>
      );
    }
    case "fees": {
      const rows = content.rows || [];
      const total = content.total;
      return (
        <>
          <EditableText value={content.title || "Fees & retainer"} onChange={(v) => patch("title", v)} tag="h4" style={{ fontFamily: "var(--fs-font-serif)", fontSize: 18, margin: "0 0 10px" }} />
          <table className="tbl">
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}><td>{r.label}</td><td className="num" style={{ textAlign: "right", fontWeight: 700 }}>{r.amount}</td></tr>
              ))}
              {total && (
                <tr>
                  <td style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 16, color: "var(--fs-navy)" }}>{total.label}</td>
                  <td className="num" style={{ textAlign: "right", fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 20, color: "var(--fs-gold-700)" }}>{total.amount}</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      );
    }
    case "signoff":
      return (
        <>
          <EditableText value={content.title || "Sign-off"} onChange={(v) => patch("title", v)} tag="h4" style={{ fontFamily: "var(--fs-font-serif)", fontSize: 18, margin: "0 0 14px" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div>
              <div className="mut" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em" }}>Fog Signal</div>
              <div style={{ height: 38, borderBottom: "1px solid var(--fs-border-strong)", margin: "26px 0 6px" }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)" }}>{content.firmSignatory?.name || "Jonas Reiter"}</div>
            </div>
            <div>
              <div className="mut" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em" }}>{cname}</div>
              <div style={{ height: 38, borderBottom: "1px solid var(--fs-border-strong)", margin: "26px 0 6px" }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)" }}>{content.clientSignatory?.name || "[Authorized signatory]"}</div>
            </div>
          </div>
        </>
      );
    default:
      return (
        <EditableText multiline value={content.body || `${type} — click to edit.`} onChange={(v) => patch("body", v)} style={{ fontSize: 13, padding: 6, color: "var(--fs-fg-muted)" }} />
      );
  }
}
