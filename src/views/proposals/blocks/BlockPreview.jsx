import React from "react";
import { Avatar, Icon } from "../../../components/ui.jsx";
import { RichText } from "../richtext.jsx";

function EditableText({ value, onChange, tag: Tag = "p", style, multiline, placeholder }) {
  if (!onChange) return <Tag style={style}>{value}</Tag>;
  if (multiline) {
    return (
      <textarea
        className="input seamless"
        value={value || ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...style, width: "100%", border: "none", background: "transparent", resize: "vertical", minHeight: 60, padding: 0 }}
      />
    );
  }
  return (
    <input
      className="input seamless"
      value={value || ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...style, width: "100%", border: "none", background: "transparent", padding: 0 }}
    />
  );
}

/** Small "+ add" / remove-row affordances shown only while editing. */
function AddRowBtn({ onClick, label = "Add row" }) {
  if (!onClick) return null;
  return (
    <button type="button" className="btn ghost sm row-add" onClick={onClick}>
      <Icon name="plus" size={11} /> {label}
    </button>
  );
}

function RemoveRowBtn({ onClick }) {
  if (!onClick) return null;
  return (
    <button type="button" className="btn ghost sm row-remove" title="Remove" onClick={onClick}>
      <Icon name="x" size={11} />
    </button>
  );
}

/** Types whose content.title makes them a TOC section (plus explicit headings). */
const TOC_TYPES = new Set([
  "heading", "summary", "executive", "situation", "approach", "methodology",
  "stakeholders", "scope", "deliverables", "team", "timeline", "fees",
  "signoff", "caseStudy", "references", "compliance", "aboutfirm",
]);

export function tocEntries(blocks, blockTypes = {}) {
  return (blocks || [])
    .filter((b) => TOC_TYPES.has(b.type))
    .map((b) => ({
      blockId: b.id,
      title:
        b.content?.title ||
        (b.type === "aboutfirm" ? "About Fog Signal" : blockTypes[b.type]?.label || b.type),
    }));
}

const SECTION_TITLE_STYLE = { fontFamily: "var(--fs-font-serif)", fontSize: 18, margin: "0 0 10px" };

export function BlockPreview({ type, client, content = {}, onChange, allBlocks, blockTypes, tocPages }) {
  const cname = client?.name || content.title || "Client";
  const patch = onChange ? (key, val) => onChange({ ...content, [key]: val }) : null;
  const set = patch ? (key) => (val) => patch(key, val) : () => null;
  const editable = !!onChange;

  switch (type) {
    case "text":
      return (
        <RichText
          value={content.html}
          readOnly={!editable}
          onChange={editable ? (html) => onChange({ ...content, html }) : undefined}
          style={{ fontSize: 14, lineHeight: 1.65 }}
        />
      );
    case "heading":
      return (
        <div style={{ borderBottom: "2px solid var(--fs-gold)", paddingBottom: 8 }}>
          <EditableText
            value={content.title}
            onChange={set("title")}
            tag="h3"
            placeholder="Section title…"
            style={{ fontFamily: "var(--fs-font-display)", fontSize: 22, fontWeight: 700, color: "var(--fs-navy)", margin: 0, letterSpacing: "-0.01em" }}
          />
        </div>
      );
    case "quote":
      return (
        <blockquote style={{ margin: 0, padding: "6px 0 6px 18px", borderLeft: "3px solid var(--fs-gold)" }}>
          <EditableText
            multiline
            value={content.text}
            onChange={set("text")}
            style={{ fontFamily: "var(--fs-font-serif)", fontSize: 17, fontStyle: "italic", lineHeight: 1.55, margin: 0, color: "var(--fs-navy)" }}
          />
          <EditableText
            value={content.attribution}
            onChange={set("attribution")}
            placeholder={editable ? "— Attribution (optional)" : ""}
            style={{ fontSize: 12, color: "var(--fs-fg-muted)", marginTop: 6 }}
          />
        </blockquote>
      );
    case "divider":
      return <hr style={{ border: "none", borderTop: "1px solid var(--fs-border-strong)", margin: "8px 0" }} />;
    case "pagebreak":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--fs-fg-subtle)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em" }}>
          <span style={{ flex: 1, borderTop: "1px dashed var(--fs-border-strong)" }} />
          Page break
          <span style={{ flex: 1, borderTop: "1px dashed var(--fs-border-strong)" }} />
        </div>
      );
    case "toc": {
      const entries = tocEntries(allBlocks, blockTypes);
      return (
        <>
          <EditableText value={content.title || "Contents"} onChange={set("title")} tag="h4" style={SECTION_TITLE_STYLE} />
          {!entries.length && (
            <p className="mut" style={{ fontSize: 13, margin: 0 }}>
              Sections appear here automatically as you add them.
            </p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {entries.map((e, i) => (
              <div key={e.blockId + i} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 13.5 }}>
                <span style={{ color: "var(--fs-navy)", fontWeight: 500 }}>{e.title}</span>
                <span style={{ flex: 1, borderBottom: "1px dotted var(--fs-border-strong)" }} />
                <span className="num" style={{ color: "var(--fs-fg-muted)", fontSize: 12 }}>
                  {tocPages?.[e.blockId] ?? "·"}
                </span>
              </div>
            ))}
          </div>
          {editable && (
            <p className="mut" style={{ fontSize: 11, marginTop: 10, marginBottom: 0 }}>
              Page numbers fill in automatically on export.
            </p>
          )}
        </>
      );
    }
    case "cover":
      return (
        <div style={{ padding: "30px 16px 20px", background: "var(--ks-ink-surface)", color: "var(--ks-on-ink)", borderRadius: 4, position: "relative", overflow: "hidden" }}>
          <svg width="240" height="240" viewBox="0 0 240 240" style={{ position: "absolute", right: -50, top: -50, opacity: 0.10 }}>
            <g fill="none" stroke="var(--fs-gold)" strokeWidth="1"><circle cx="120" cy="120" r="40" /><circle cx="120" cy="120" r="70" /><circle cx="120" cy="120" r="100" /></g>
          </svg>
          <EditableText value={content.eyebrow || "Engagement Proposal"} onChange={set("eyebrow")} style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--fs-gold)", fontWeight: 600 }} />
          <EditableText value={content.title || cname} onChange={set("title")} style={{ fontFamily: "var(--fs-font-display)", fontSize: 30, fontWeight: 700, margin: "10px 0 8px", letterSpacing: "-0.01em", color: "#fff" }} />
          <EditableText value={content.subtitle || "Prepared by Fog Signal Strategies"} onChange={set("subtitle")} style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }} />
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
            <div key={i} className="row-editable">
              <EditableText
                multiline
                value={p}
                onChange={patch ? (v) => {
                  const next = [...paragraphs];
                  next[i] = v;
                  patch("paragraphs", next);
                } : null}
                style={{ fontSize: 15, lineHeight: 1.6, margin: i ? "10px 0 0" : 0, flex: 1 }}
              />
              {paragraphs.length > 1 && (
                <RemoveRowBtn onClick={patch ? () => patch("paragraphs", paragraphs.filter((_, j) => j !== i)) : null} />
              )}
            </div>
          ))}
          <AddRowBtn label="Add paragraph" onClick={patch ? () => patch("paragraphs", [...paragraphs, ""]) : null} />
        </>
      );
    }
    case "aboutfirm":
      return (
        <div className="row" style={{ gap: 18, alignItems: "flex-start" }}>
          <img src="design-system/assets/logo-stacked-blue.png" alt="" style={{ height: 56 }} />
          <div style={{ flex: 1 }}>
            <h4 style={{ fontFamily: "var(--fs-font-display)", margin: 0, color: "var(--fs-navy)", fontWeight: 700, fontSize: 17 }}>Fog Signal Strategies</h4>
            <EditableText multiline value={content.body} onChange={set("body")} style={{ fontSize: 13, margin: "6px 0 0", lineHeight: 1.55, maxWidth: 540, color: "var(--fs-fg-muted)" }} />
          </div>
        </div>
      );
    case "situation":
      return (
        <>
          <EditableText value={content.title || "The situation"} onChange={set("title")} tag="h4" style={{ ...SECTION_TITLE_STYLE, margin: "0 0 8px" }} />
          <EditableText multiline value={content.body} onChange={set("body")} style={{ margin: 0, lineHeight: 1.6 }} />
        </>
      );
    case "approach": {
      const steps = content.steps || [];
      return (
        <>
          <EditableText value={content.title || "Our approach"} onChange={set("title")} tag="h4" style={SECTION_TITLE_STYLE} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {steps.map((s, i) => (
              <div key={i} className="row-editable" style={{ display: "block", position: "relative" }}>
                <RemoveRowBtn onClick={patch ? () => patch("steps", steps.filter((_, j) => j !== i)) : null} />
                <div className="kicker">{String(i + 1).padStart(2, "0")}</div>
                <EditableText value={s.title} onChange={patch ? (v) => { const next = [...steps]; next[i] = { ...s, title: v }; patch("steps", next); } : null} style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 16, color: "var(--fs-navy)", margin: "6px 0 4px" }} />
                <EditableText multiline value={s.body} onChange={patch ? (v) => { const next = [...steps]; next[i] = { ...s, body: v }; patch("steps", next); } : null} style={{ fontSize: 13, margin: 0, lineHeight: 1.5, color: "var(--fs-fg-muted)" }} />
              </div>
            ))}
          </div>
          <AddRowBtn label="Add step" onClick={patch ? () => patch("steps", [...steps, { n: String(steps.length + 1).padStart(2, "0"), title: "New step", body: "" }]) : null} />
        </>
      );
    }
    case "scope": {
      const rows = content.rows || [];
      const setRow = patch ? (i, key) => (v) => {
        const next = rows.map((r, j) => (j === i ? { ...r, [key]: v } : r));
        patch("rows", next);
      } : () => null;
      return (
        <>
          <EditableText value={content.title || "Scope of work"} onChange={set("title")} tag="h4" style={SECTION_TITLE_STYLE} />
          <table className="tbl" style={{ borderTop: "1px solid var(--fs-border)" }}>
            <thead><tr><th>Workstream</th><th>What we&rsquo;ll do</th><th style={{ textAlign: "right" }}>Cadence</th>{editable && <th style={{ width: 30 }} />}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, color: "var(--fs-navy)" }}>
                    <EditableText value={r.workstream} onChange={setRow(i, "workstream")} style={{ fontWeight: 600, color: "var(--fs-navy)", fontSize: 13 }} />
                  </td>
                  <td><EditableText value={r.detail} onChange={setRow(i, "detail")} style={{ fontSize: 13 }} /></td>
                  <td className="mut" style={{ textAlign: "right" }}>
                    <EditableText value={r.cadence} onChange={setRow(i, "cadence")} style={{ fontSize: 13, textAlign: "right" }} />
                  </td>
                  {editable && <td><RemoveRowBtn onClick={() => patch("rows", rows.filter((_, j) => j !== i))} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
          <AddRowBtn onClick={patch ? () => patch("rows", [...rows, { workstream: "New workstream", detail: "", cadence: "" }]) : null} />
        </>
      );
    }
    case "deliverables": {
      const items = content.items || [];
      return (
        <>
          <EditableText value={content.title || "Deliverables"} onChange={set("title")} tag="h4" style={SECTION_TITLE_STYLE} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {items.map((d, i) => (
              <div key={i} className="row row-editable" style={{ gap: 8, padding: "6px 0", fontSize: 13 }}>
                <Icon name="check" size={13} color="var(--fs-gold-700)" />
                <EditableText value={d} onChange={patch ? (v) => { const next = [...items]; next[i] = v; patch("items", next); } : null} />
                <RemoveRowBtn onClick={patch ? () => patch("items", items.filter((_, j) => j !== i)) : null} />
              </div>
            ))}
          </div>
          <AddRowBtn label="Add deliverable" onClick={patch ? () => patch("items", [...items, "New deliverable"]) : null} />
        </>
      );
    }
    case "team": {
      const members = content.members || [];
      return (
        <>
          <EditableText value={content.title || "Your team"} onChange={set("title")} tag="h4" style={{ ...SECTION_TITLE_STYLE, margin: "0 0 12px" }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {members.map((p, i) => (
              <div key={i} className="row-editable" style={{ display: "block", position: "relative" }}>
                <RemoveRowBtn onClick={patch ? () => patch("members", members.filter((_, j) => j !== i)) : null} />
                <Avatar name={p.name || "?"} size={44} />
                <EditableText value={p.name} onChange={patch ? (v) => { const next = [...members]; next[i] = { ...p, name: v }; patch("members", next); } : null} style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 14, color: "var(--fs-navy)", marginTop: 8 }} />
                <EditableText value={p.role} onChange={patch ? (v) => { const next = [...members]; next[i] = { ...p, role: v }; patch("members", next); } : null} style={{ fontSize: 12, color: "var(--fs-fg-muted)" }} />
              </div>
            ))}
          </div>
          <AddRowBtn label="Add member" onClick={patch ? () => patch("members", [...members, { name: "New member", role: "Role" }]) : null} />
        </>
      );
    }
    case "fees": {
      const rows = content.rows || [];
      const total = content.total;
      return (
        <>
          <EditableText value={content.title || "Fees & retainer"} onChange={set("title")} tag="h4" style={SECTION_TITLE_STYLE} />
          <table className="tbl">
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td><EditableText value={r.label} onChange={patch ? (v) => { const next = rows.map((x, j) => j === i ? { ...x, label: v } : x); patch("rows", next); } : null} style={{ fontSize: 13 }} /></td>
                  <td className="num" style={{ textAlign: "right", fontWeight: 700 }}>
                    <EditableText value={r.amount} onChange={patch ? (v) => { const next = rows.map((x, j) => j === i ? { ...x, amount: v } : x); patch("rows", next); } : null} style={{ textAlign: "right", fontWeight: 700, fontSize: 13 }} />
                  </td>
                  {editable && <td style={{ width: 30 }}><RemoveRowBtn onClick={() => patch("rows", rows.filter((_, j) => j !== i))} /></td>}
                </tr>
              ))}
              {(total || editable) && (
                <tr>
                  <td style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 16, color: "var(--fs-navy)" }}>
                    <EditableText value={total?.label || "Total"} onChange={patch ? (v) => patch("total", { ...(total || {}), label: v }) : null} style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 16, color: "var(--fs-navy)" }} />
                  </td>
                  <td className="num" style={{ textAlign: "right", fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 20, color: "var(--fs-gold-700)" }}>
                    <EditableText value={total?.amount} onChange={patch ? (v) => patch("total", { ...(total || {}), amount: v }) : null} style={{ textAlign: "right", fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 20, color: "var(--fs-gold-700)" }} />
                  </td>
                  {editable && <td style={{ width: 30 }} />}
                </tr>
              )}
            </tbody>
          </table>
          <AddRowBtn label="Add line item" onClick={patch ? () => patch("rows", [...rows, { label: "New line item", amount: "$0" }]) : null} />
        </>
      );
    }
    case "signoff":
      return (
        <>
          <EditableText value={content.title || "Sign-off"} onChange={set("title")} tag="h4" style={{ ...SECTION_TITLE_STYLE, margin: "0 0 14px" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div>
              <div className="mut" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em" }}>Fog Signal</div>
              <div style={{ height: 38, borderBottom: "1px solid var(--fs-border-strong)", margin: "26px 0 6px" }} />
              <EditableText value={content.firmSignatory?.name || "Jonas Reiter"} onChange={patch ? (v) => patch("firmSignatory", { ...(content.firmSignatory || {}), name: v }) : null} style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)" }} />
            </div>
            <div>
              <div className="mut" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em" }}>{cname}</div>
              <div style={{ height: 38, borderBottom: "1px solid var(--fs-border-strong)", margin: "26px 0 6px" }} />
              <EditableText value={content.clientSignatory?.name || "[Authorized signatory]"} onChange={patch ? (v) => patch("clientSignatory", { ...(content.clientSignatory || {}), name: v }) : null} style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)" }} />
            </div>
          </div>
        </>
      );
    default:
      return (
        <EditableText multiline value={content.body || `${type} — click to edit.`} onChange={set("body")} style={{ fontSize: 13, padding: 6, color: "var(--fs-fg-muted)" }} />
      );
  }
}
