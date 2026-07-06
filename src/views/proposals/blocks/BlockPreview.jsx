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

function SectionTitle({ value, onChange, style }) {
  return (
    <EditableText
      value={value}
      onChange={onChange}
      tag="h4"
      style={{ fontFamily: "var(--fs-font-serif)", fontSize: 18, fontWeight: 700, color: "var(--fs-navy)", margin: "0 0 10px", ...style }}
    />
  );
}

const TOC_TYPES = new Set([
  "heading", "summary", "executive", "situation", "approach", "methodology",
  "stakeholders", "scope", "deliverables", "team", "teamBio", "timeline", "projectSchedule",
  "fees", "feeProposal", "signoff", "caseStudy", "references", "compliance", "aboutfirm",
  "qualifications", "workPlan", "terms", "insurance", "exceptions", "conclusion",
]);

export function tocEntries(blocks, blockTypes = {}) {
  return (blocks || [])
    .filter((b) => TOC_TYPES.has(b.type))
    .map((b) => ({
      blockId: b.id,
      title:
        b.content?.title ||
        b.content?.client ||
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
          <EditableText multiline value={content.text} onChange={set("text")} style={{ fontFamily: "var(--fs-font-serif)", fontSize: 17, fontStyle: "italic", lineHeight: 1.55, margin: 0, color: "var(--fs-navy)" }} />
          <EditableText value={content.attribution} onChange={set("attribution")} placeholder={editable ? "— Attribution (optional)" : ""} style={{ fontSize: 12, color: "var(--fs-fg-muted)", marginTop: 6 }} />
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
    case "sectionHeader":
      return (
        <div className="proposal-section-divider">
          <div className="proposal-section-divider-num">SECTION {content.section || "—"}</div>
          <EditableText value={content.title} onChange={set("title")} tag="h2" style={{ fontFamily: "var(--fs-font-display)", fontSize: 26, fontWeight: 700, color: "var(--fs-navy)", margin: "8px 0 0" }} />
        </div>
      );
    case "toc": {
      const entries = tocEntries(allBlocks, blockTypes);
      return (
        <>
          <EditableText value={content.title || "Contents"} onChange={set("title")} tag="h4" style={SECTION_TITLE_STYLE} />
          {!entries.length && <p className="mut" style={{ fontSize: 13, margin: 0 }}>Sections appear here automatically as you add them.</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {entries.map((e, i) => (
              <div key={e.blockId + i} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 13.5 }}>
                <span style={{ color: "var(--fs-navy)", fontWeight: 500 }}>{e.title}</span>
                <span style={{ flex: 1, borderBottom: "1px dotted var(--fs-border-strong)" }} />
                <span className="num" style={{ color: "var(--fs-fg-muted)", fontSize: 12 }}>{tocPages?.[e.blockId] ?? "·"}</span>
              </div>
            ))}
          </div>
        </>
      );
    }
    case "cover":
      return (
        <div className="proposal-cover">
          <div className="proposal-cover-inner">
            <div className="proposal-cover-label">Proposal for</div>
            <EditableText
              multiline
              value={content.serviceTitle || "Public Outreach\nConsulting Services"}
              onChange={set("serviceTitle")}
              style={{ fontFamily: "var(--fs-font-display)", fontSize: 28, fontWeight: 700, lineHeight: 1.2, color: "#fff", margin: "12px 0 32px", whiteSpace: "pre-line" }}
            />
            <div className="proposal-cover-meta">
              <div>
                <div className="proposal-cover-meta-label">Submitted to:</div>
                <EditableText value={content.submittedTo || cname} onChange={set("submittedTo")} style={{ fontSize: 14, fontWeight: 600, color: "#fff" }} />
                {editable && (
                  <EditableText value={content.submittedToDetail || ""} onChange={set("submittedToDetail")} placeholder="Department or district (optional)" style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 }} />
                )}
                {!editable && content.submittedToDetail && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>{content.submittedToDetail}</div>}
              </div>
              <div>
                <div className="proposal-cover-meta-label">Submitted by:</div>
                <EditableText value={content.submittedBy || "Fog Signal Strategies"} onChange={set("submittedBy")} style={{ fontSize: 14, fontWeight: 600, color: "#fff" }} />
              </div>
              <div>
                <div className="proposal-cover-meta-label">Date:</div>
                <EditableText value={content.date} onChange={set("date")} style={{ fontSize: 14, fontWeight: 600, color: "#fff" }} />
              </div>
            </div>
          </div>
        </div>
      );
    case "coverLetter": {
      const paragraphs = content.paragraphs || [];
      const sig = content.signatory || {};
      return (
        <div className="proposal-cover-letter">
          <EditableText value={content.date} onChange={set("date")} style={{ fontSize: 13, marginBottom: 16 }} />
          <EditableText value={content.addressee || cname} onChange={set("addressee")} style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)" }} />
          {editable ? (
            <EditableText multiline value={content.addresseeLines || ""} onChange={set("addresseeLines")} placeholder="Address lines (optional)" style={{ fontSize: 13, margin: "4px 0 16px" }} />
          ) : content.addresseeLines ? (
            <div style={{ fontSize: 13, margin: "4px 0 16px", whiteSpace: "pre-line" }}>{content.addresseeLines}</div>
          ) : null}
          <EditableText value={content.salutation || "Dear Members of the Selection Committee,"} onChange={set("salutation")} style={{ fontSize: 14, marginBottom: 12 }} />
          {paragraphs.map((p, i) => (
            <div key={i} className="row-editable" style={{ marginBottom: 10 }}>
              <EditableText
                multiline
                value={p}
                onChange={patch ? (v) => { const next = [...paragraphs]; next[i] = v; patch("paragraphs", next); } : null}
                style={{ fontSize: 14, lineHeight: 1.65, flex: 1 }}
              />
              {paragraphs.length > 1 && <RemoveRowBtn onClick={patch ? () => patch("paragraphs", paragraphs.filter((_, j) => j !== i)) : null} />}
            </div>
          ))}
          <AddRowBtn label="Add paragraph" onClick={patch ? () => patch("paragraphs", [...paragraphs, ""]) : null} />
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 14 }}>Sincerely,</div>
            <EditableText value={sig.name} onChange={patch ? (v) => patch("signatory", { ...sig, name: v }) : null} style={{ fontSize: 14, fontWeight: 600, color: "var(--fs-navy)", marginTop: 24 }} />
            <EditableText value={sig.title} onChange={patch ? (v) => patch("signatory", { ...sig, title: v }) : null} style={{ fontSize: 13, color: "var(--fs-fg-muted)" }} />
            <div className="row" style={{ gap: 16, marginTop: 6, fontSize: 13 }}>
              <EditableText value={sig.phone} onChange={patch ? (v) => patch("signatory", { ...sig, phone: v }) : null} placeholder="Phone" />
              <EditableText value={sig.email} onChange={patch ? (v) => patch("signatory", { ...sig, email: v }) : null} placeholder="Email" />
            </div>
          </div>
        </div>
      );
    }
    case "summary":
    case "executive": {
      const paragraphs = content.paragraphs || [];
      return (
        <>
          {paragraphs.map((p, i) => (
            <div key={i} className="row-editable">
              <EditableText multiline value={p} onChange={patch ? (v) => { const next = [...paragraphs]; next[i] = v; patch("paragraphs", next); } : null} style={{ fontSize: 15, lineHeight: 1.6, margin: i ? "10px 0 0" : 0, flex: 1 }} />
              {paragraphs.length > 1 && <RemoveRowBtn onClick={patch ? () => patch("paragraphs", paragraphs.filter((_, j) => j !== i)) : null} />}
            </div>
          ))}
          <AddRowBtn label="Add paragraph" onClick={patch ? () => patch("paragraphs", [...paragraphs, ""]) : null} />
        </>
      );
    }
    case "qualifications": {
      const pillars = content.pillars || [];
      return (
        <>
          <SectionTitle value={content.title || "Qualifications and Experience"} onChange={set("title")} />
          <h5 style={{ fontFamily: "var(--fs-font-display)", fontSize: 15, color: "var(--fs-navy)", margin: "16px 0 6px" }}>
            <EditableText value={content.aboutTitle || "About Fog Signal Strategies"} onChange={set("aboutTitle")} style={{ fontFamily: "var(--fs-font-display)", fontSize: 15, fontWeight: 700, color: "var(--fs-navy)" }} />
          </h5>
          <EditableText multiline value={content.aboutBody} onChange={set("aboutBody")} style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }} />
          <h5 style={{ fontFamily: "var(--fs-font-display)", fontSize: 15, color: "var(--fs-navy)", margin: "18px 0 6px" }}>
            <EditableText value={content.approachTitle || "Our Approach"} onChange={set("approachTitle")} style={{ fontFamily: "var(--fs-font-display)", fontSize: 15, fontWeight: 700, color: "var(--fs-navy)" }} />
          </h5>
          <EditableText multiline value={content.approachBody} onChange={set("approachBody")} style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }} />
          <h5 style={{ fontFamily: "var(--fs-font-display)", fontSize: 15, color: "var(--fs-navy)", margin: "18px 0 6px" }}>
            <EditableText value={content.pillarsTitle || "Why Measures Fail and How We Fix It"} onChange={set("pillarsTitle")} />
          </h5>
          <EditableText multiline value={content.pillarsIntro} onChange={set("pillarsIntro")} style={{ fontSize: 13, lineHeight: 1.6, margin: "0 0 10px" }} />
          {pillars.map((p, i) => (
            <div key={i} className="row-editable" style={{ marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <EditableText value={p.title} onChange={patch ? (v) => { const next = pillars.map((x, j) => j === i ? { ...x, title: v } : x); patch("pillars", next); } : null} style={{ fontWeight: 700, fontSize: 13, color: "var(--fs-navy)" }} />
                <EditableText multiline value={p.body} onChange={patch ? (v) => { const next = pillars.map((x, j) => j === i ? { ...x, body: v } : x); patch("pillars", next); } : null} style={{ fontSize: 13, lineHeight: 1.55, margin: "4px 0 0" }} />
              </div>
              <RemoveRowBtn onClick={patch ? () => patch("pillars", pillars.filter((_, j) => j !== i)) : null} />
            </div>
          ))}
          <AddRowBtn label="Add pillar" onClick={patch ? () => patch("pillars", [...pillars, { title: "New pillar", body: "" }]) : null} />
          {(content.showConflicts || editable) && (
            <div style={{ marginTop: 16 }}>
              {editable && (
                <label className="row" style={{ gap: 8, fontSize: 12, marginBottom: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={!!content.showConflicts} onChange={(e) => patch("showConflicts", e.target.checked)} />
                  Include subcontractors & conflicts section
                </label>
              )}
              {content.showConflicts && (
                <>
                  <EditableText value={content.conflictsTitle} onChange={set("conflictsTitle")} style={{ fontWeight: 700, fontSize: 14, color: "var(--fs-navy)", marginBottom: 6 }} />
                  <EditableText multiline value={content.conflictsBody} onChange={set("conflictsBody")} style={{ fontSize: 13, lineHeight: 1.6 }} />
                </>
              )}
            </div>
          )}
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
          <SectionTitle value={content.title || "The situation"} onChange={set("title")} />
          <EditableText multiline value={content.body} onChange={set("body")} style={{ margin: 0, lineHeight: 1.6, fontSize: 14 }} />
        </>
      );
    case "approach": {
      const steps = content.steps || [];
      return (
        <>
          <SectionTitle value={content.title || "Our approach"} onChange={set("title")} />
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
          <AddRowBtn label="Add step" onClick={patch ? () => patch("steps", [...steps, { title: "New step", body: "" }]) : null} />
        </>
      );
    }
    case "teamBio": {
      const members = content.members || [];
      return (
        <>
          <SectionTitle value={content.title || "Project Team"} onChange={set("title")} style={{ textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 16 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {members.map((p, i) => (
              <div key={i} className="row-editable proposal-team-bio" style={{ display: "block", position: "relative" }}>
                <RemoveRowBtn onClick={patch ? () => patch("members", members.filter((_, j) => j !== i)) : null} />
                <div className="row" style={{ gap: 16, alignItems: "flex-start" }}>
                  <Avatar name={p.name || "?"} size={56} />
                  <div style={{ flex: 1 }}>
                    <EditableText value={p.name} onChange={patch ? (v) => { const next = [...members]; next[i] = { ...p, name: v }; patch("members", next); } : null} style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 15, color: "var(--fs-navy)" }} />
                    <EditableText value={p.title} onChange={patch ? (v) => { const next = [...members]; next[i] = { ...p, title: v }; patch("members", next); } : null} style={{ fontSize: 12, color: "var(--fs-gold-700)", fontWeight: 600, marginBottom: 6 }} />
                    <EditableText multiline value={p.bio} onChange={patch ? (v) => { const next = [...members]; next[i] = { ...p, bio: v }; patch("members", next); } : null} style={{ fontSize: 13, lineHeight: 1.55, margin: 0 }} />
                    {(p.hours || editable) && (
                      <EditableText value={p.hours} onChange={patch ? (v) => { const next = [...members]; next[i] = { ...p, hours: v }; patch("members", next); } : null} placeholder="Hours commitment (optional)" style={{ fontSize: 12, color: "var(--fs-fg-muted)", marginTop: 6, fontStyle: "italic" }} />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <AddRowBtn label="Add team member" onClick={patch ? () => patch("members", [...members, { name: "New member", title: "Role", bio: "", hours: "" }]) : null} />
          {(content.supportingNote || editable) && (
            <EditableText multiline value={content.supportingNote || ""} onChange={set("supportingNote")} placeholder="Supporting team note (optional)" style={{ fontSize: 12, color: "var(--fs-fg-muted)", marginTop: 14, lineHeight: 1.5, fontStyle: "italic" }} />
          )}
        </>
      );
    }
    case "team": {
      const members = content.members || [];
      return (
        <>
          <SectionTitle value={content.title || "Your team"} onChange={set("title")} />
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
    case "caseStudy":
      return (
        <div className="proposal-case-study">
          <div className="row" style={{ gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <EditableText value={content.client} onChange={set("client")} style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 15, color: "var(--fs-navy)" }} />
            <span className="mut" style={{ fontSize: 13 }}>·</span>
            <EditableText value={content.location} onChange={set("location")} style={{ fontSize: 13, color: "var(--fs-fg-muted)" }} />
          </div>
          <EditableText value={content.year} onChange={set("year")} placeholder="Year" style={{ fontSize: 12, fontWeight: 600, color: "var(--fs-gold-700)", marginBottom: 8 }} />
          {[
            ["Measure Type", "measureType"],
            ["Demographics", "demographics"],
            ["Scope of Work", "scope"],
            ["Outcome", "outcome"],
            ["Engagement Period", "engagementPeriod"],
            ["Project Budget", "budget"],
          ].map(([label, key]) => (
            (content[key] || editable) ? (
              <div key={key} style={{ marginBottom: 8, fontSize: 13, lineHeight: 1.55 }}>
                <span style={{ fontWeight: 600, color: "var(--fs-navy)" }}>{label}: </span>
                <EditableText multiline value={content[key] || ""} onChange={set(key)} placeholder={editable ? label : ""} style={{ fontSize: 13, display: "inline" }} />
              </div>
            ) : null
          ))}
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--fs-fg-muted)" }}>
            <span style={{ fontWeight: 600 }}>Contact: </span>
            <EditableText value={content.contact} onChange={set("contact")} style={{ fontSize: 12 }} />
          </div>
        </div>
      );
    case "workPlan": {
      const stages = content.stages || [];
      return (
        <>
          <SectionTitle value={content.title || "Scope of Work and Project Understanding"} onChange={set("title")} />
          <EditableText value={content.understandingTitle || "Project Understanding"} onChange={set("understandingTitle")} style={{ fontWeight: 700, fontSize: 14, color: "var(--fs-navy)", margin: "12px 0 6px" }} />
          <EditableText multiline value={content.understanding} onChange={set("understanding")} style={{ fontSize: 13, lineHeight: 1.6, margin: "0 0 16px" }} />
          <EditableText value={content.stagesTitle || "Our Approach: Three Stages"} onChange={set("stagesTitle")} style={{ fontWeight: 700, fontSize: 14, color: "var(--fs-navy)", margin: "0 0 10px" }} />
          {stages.map((stage, si) => (
            <div key={si} className="row-editable" style={{ marginBottom: 16, display: "block", position: "relative" }}>
              <RemoveRowBtn onClick={patch ? () => patch("stages", stages.filter((_, j) => j !== si)) : null} />
              <EditableText value={stage.title} onChange={patch ? (v) => { const next = stages.map((s, j) => j === si ? { ...s, title: v } : s); patch("stages", next); } : null} style={{ fontWeight: 700, fontSize: 13, color: "var(--fs-navy)", marginBottom: 4 }} />
              <EditableText multiline value={stage.intro} onChange={patch ? (v) => { const next = stages.map((s, j) => j === si ? { ...s, intro: v } : s); patch("stages", next); } : null} style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 8px" }} />
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.55 }}>
                {(stage.bullets || []).map((bullet, bi) => (
                  <li key={bi} className="row-editable" style={{ marginBottom: 4 }}>
                    <EditableText multiline value={bullet} onChange={patch ? (v) => {
                      const next = stages.map((s, j) => {
                        if (j !== si) return s;
                        const bullets = [...(s.bullets || [])];
                        bullets[bi] = v;
                        return { ...s, bullets };
                      });
                      patch("stages", next);
                    } : null} style={{ fontSize: 13, flex: 1 }} />
                    <RemoveRowBtn onClick={patch ? () => {
                      const next = stages.map((s, j) => j === si ? { ...s, bullets: (s.bullets || []).filter((_, k) => k !== bi) } : s);
                      patch("stages", next);
                    } : null} />
                  </li>
                ))}
              </ul>
              <AddRowBtn label="Add bullet" onClick={patch ? () => {
                const next = stages.map((s, j) => j === si ? { ...s, bullets: [...(s.bullets || []), ""] } : s);
                patch("stages", next);
              } : null} />
            </div>
          ))}
          <AddRowBtn label="Add stage" onClick={patch ? () => patch("stages", [...stages, { title: "STAGE N: Title", intro: "", bullets: [""] }]) : null} />
        </>
      );
    }
    case "projectSchedule": {
      const rows = content.rows || [];
      const setRow = patch ? (i, key) => (v) => {
        patch("rows", rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
      } : () => null;
      return (
        <>
          <SectionTitle value={content.title || "Preliminary Project Schedule"} onChange={set("title")} />
          <EditableText multiline value={content.intro} onChange={set("intro")} style={{ fontSize: 13, lineHeight: 1.6, margin: "0 0 12px" }} />
          <table className="tbl" style={{ borderTop: "1px solid var(--fs-border)" }}>
            <thead><tr><th>Phase</th><th>Timeframe</th><th>Key Activities</th>{editable && <th style={{ width: 30 }} />}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, color: "var(--fs-navy)", fontSize: 13 }}><EditableText value={r.phase} onChange={setRow(i, "phase")} style={{ fontWeight: 600, fontSize: 13 }} /></td>
                  <td className="mut" style={{ fontSize: 13 }}><EditableText value={r.timeframe} onChange={setRow(i, "timeframe")} style={{ fontSize: 13 }} /></td>
                  <td style={{ fontSize: 13 }}><EditableText multiline value={r.activities} onChange={setRow(i, "activities")} style={{ fontSize: 13 }} /></td>
                  {editable && <td><RemoveRowBtn onClick={() => patch("rows", rows.filter((_, j) => j !== i))} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
          <AddRowBtn onClick={patch ? () => patch("rows", [...rows, { phase: "New phase", timeframe: "", activities: "" }]) : null} />
        </>
      );
    }
    case "feeProposal": {
      const rows = content.rows || [];
      const setRow = patch ? (i, key) => (v) => {
        patch("rows", rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
      } : () => null;
      return (
        <>
          <SectionTitle value={content.title || "Fee Proposal"} onChange={set("title")} />
          <EditableText multiline value={content.intro} onChange={set("intro")} style={{ fontSize: 13, lineHeight: 1.6, margin: "0 0 14px" }} />
          <table className="tbl" style={{ borderTop: "1px solid var(--fs-border)" }}>
            <thead><tr><th>Service Category</th><th>Description</th><th style={{ textAlign: "right" }}>Fee</th>{editable && <th style={{ width: 30 }} />}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, color: "var(--fs-navy)", fontSize: 13, verticalAlign: "top" }}><EditableText multiline value={r.category} onChange={setRow(i, "category")} style={{ fontWeight: 600, fontSize: 13 }} /></td>
                  <td style={{ fontSize: 13, verticalAlign: "top" }}><EditableText multiline value={r.description} onChange={setRow(i, "description")} style={{ fontSize: 13 }} /></td>
                  <td className="num" style={{ textAlign: "right", fontWeight: 700, fontSize: 13, verticalAlign: "top", whiteSpace: "nowrap" }}><EditableText value={r.fee} onChange={setRow(i, "fee")} style={{ textAlign: "right", fontWeight: 700, fontSize: 13 }} /></td>
                  {editable && <td><RemoveRowBtn onClick={() => patch("rows", rows.filter((_, j) => j !== i))} /></td>}
                </tr>
              ))}
              <tr>
                <td colSpan={editable ? 2 : 2} style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 15, color: "var(--fs-navy)", paddingTop: 12 }}>
                  <EditableText value={content.totalLabel || "TOTAL PROJECT FEE"} onChange={set("totalLabel")} style={{ fontWeight: 700, fontSize: 15 }} />
                  {content.totalNote && <div className="mut" style={{ fontSize: 11, fontWeight: 400 }}><EditableText value={content.totalNote} onChange={set("totalNote")} style={{ fontSize: 11 }} /></div>}
                </td>
                <td className="num" style={{ textAlign: "right", fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 18, color: "var(--fs-gold-700)", paddingTop: 12 }}>
                  <EditableText value={content.totalAmount} onChange={set("totalAmount")} style={{ textAlign: "right", fontWeight: 700, fontSize: 18, color: "var(--fs-gold-700)" }} />
                </td>
                {editable && <td />}
              </tr>
            </tbody>
          </table>
          <AddRowBtn label="Add fee line" onClick={patch ? () => patch("rows", [...rows, { category: "New category", description: "", fee: "$0" }]) : null} />
        </>
      );
    }
    case "optionalServices": {
      const items = content.items || [];
      return (
        <>
          <SectionTitle value={content.title || "Optional Services"} onChange={set("title")} />
          <EditableText multiline value={content.intro} onChange={set("intro")} style={{ fontSize: 13, lineHeight: 1.6, margin: "0 0 10px" }} />
          {items.map((item, i) => (
            <div key={i} className="row-editable row between" style={{ marginBottom: 8, fontSize: 13, gap: 12 }}>
              <div style={{ flex: 1 }}>
                <EditableText value={item.label} onChange={patch ? (v) => { const next = items.map((x, j) => j === i ? { ...x, label: v } : x); patch("items", next); } : null} style={{ fontWeight: 600, color: "var(--fs-navy)" }} />
                <EditableText multiline value={item.description} onChange={patch ? (v) => { const next = items.map((x, j) => j === i ? { ...x, description: v } : x); patch("items", next); } : null} style={{ fontSize: 12, color: "var(--fs-fg-muted)" }} />
              </div>
              <EditableText value={item.amount} onChange={patch ? (v) => { const next = items.map((x, j) => j === i ? { ...x, amount: v } : x); patch("items", next); } : null} style={{ fontWeight: 700, whiteSpace: "nowrap" }} />
              <RemoveRowBtn onClick={patch ? () => patch("items", items.filter((_, j) => j !== i)) : null} />
            </div>
          ))}
          <AddRowBtn label="Add optional service" onClick={patch ? () => patch("items", [...items, { label: "New service", description: "", amount: "$0" }]) : null} />
          {(content.totalWithOption?.amount || editable) && (
            <div className="row between" style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--fs-border)", fontWeight: 700 }}>
              <EditableText value={content.totalWithOption?.label || "Total with options"} onChange={patch ? (v) => patch("totalWithOption", { ...(content.totalWithOption || {}), label: v }) : null} />
              <EditableText value={content.totalWithOption?.amount} onChange={patch ? (v) => patch("totalWithOption", { ...(content.totalWithOption || {}), amount: v }) : null} style={{ color: "var(--fs-gold-700)" }} />
            </div>
          )}
        </>
      );
    }
    case "personnelCosts": {
      const rows = content.rows || [];
      return (
        <>
          <SectionTitle value={content.title || "Personnel Cost Allocation"} onChange={set("title")} />
          <EditableText multiline value={content.intro} onChange={set("intro")} style={{ fontSize: 13, lineHeight: 1.6, margin: "0 0 12px" }} />
          <table className="tbl">
            <thead><tr><th>Component</th><th>Description</th><th style={{ textAlign: "right" }}>Amount</th>{editable && <th style={{ width: 30 }} />}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, fontSize: 13 }}><EditableText value={r.component} onChange={patch ? (v) => patch("rows", rows.map((x, j) => j === i ? { ...x, component: v } : x)) : null} /></td>
                  <td style={{ fontSize: 13 }}><EditableText value={r.description} onChange={patch ? (v) => patch("rows", rows.map((x, j) => j === i ? { ...x, description: v } : x)) : null} /></td>
                  <td className="num" style={{ textAlign: "right", fontWeight: 700 }}><EditableText value={r.amount} onChange={patch ? (v) => patch("rows", rows.map((x, j) => j === i ? { ...x, amount: v } : x)) : null} style={{ textAlign: "right", fontWeight: 700 }} /></td>
                  {editable && <td><RemoveRowBtn onClick={() => patch("rows", rows.filter((_, j) => j !== i))} /></td>}
                </tr>
              ))}
              <tr>
                <td colSpan={editable ? 2 : 2} style={{ fontWeight: 700, fontSize: 15, color: "var(--fs-navy)" }}>TOTAL</td>
                <td className="num" style={{ textAlign: "right", fontWeight: 700, fontSize: 16, color: "var(--fs-gold-700)" }}>
                  <EditableText value={content.total} onChange={set("total")} style={{ textAlign: "right", fontWeight: 700, fontSize: 16, color: "var(--fs-gold-700)" }} />
                </td>
                {editable && <td />}
              </tr>
            </tbody>
          </table>
          <AddRowBtn onClick={patch ? () => patch("rows", [...rows, { component: "New", description: "", amount: "$0" }]) : null} />
        </>
      );
    }
    case "hourlyRates": {
      const rows = content.rows || [];
      return (
        <>
          <SectionTitle value={content.title || "Hourly Rate Schedule"} onChange={set("title")} />
          <EditableText multiline value={content.intro} onChange={set("intro")} style={{ fontSize: 13, lineHeight: 1.6, margin: "0 0 12px" }} />
          <table className="tbl">
            <thead><tr><th>Role</th><th style={{ textAlign: "right" }}>Hourly Rate</th>{editable && <th style={{ width: 30 }} />}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 13 }}><EditableText value={r.role} onChange={patch ? (v) => patch("rows", rows.map((x, j) => j === i ? { ...x, role: v } : x)) : null} /></td>
                  <td className="num" style={{ textAlign: "right", fontWeight: 700 }}><EditableText value={r.rate} onChange={patch ? (v) => patch("rows", rows.map((x, j) => j === i ? { ...x, rate: v } : x)) : null} style={{ textAlign: "right", fontWeight: 700 }} /></td>
                  {editable && <td><RemoveRowBtn onClick={() => patch("rows", rows.filter((_, j) => j !== i))} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
          <AddRowBtn onClick={patch ? () => patch("rows", [...rows, { role: "New role", rate: "$0" }]) : null} />
        </>
      );
    }
    case "passThrough": {
      const rows = content.rows || [];
      return (
        <>
          <SectionTitle value={content.title || "Pass-Through Costs"} onChange={set("title")} />
          <EditableText multiline value={content.intro} onChange={set("intro")} style={{ fontSize: 13, lineHeight: 1.6, margin: "0 0 12px" }} />
          <table className="tbl">
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, fontSize: 13, verticalAlign: "top" }}><EditableText multiline value={r.label} onChange={patch ? (v) => patch("rows", rows.map((x, j) => j === i ? { ...x, label: v } : x)) : null} /></td>
                  <td style={{ fontSize: 13 }}><EditableText multiline value={r.description} onChange={patch ? (v) => patch("rows", rows.map((x, j) => j === i ? { ...x, description: v } : x)) : null} /></td>
                  <td className="num" style={{ textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}><EditableText value={r.amount} onChange={patch ? (v) => patch("rows", rows.map((x, j) => j === i ? { ...x, amount: v } : x)) : null} style={{ textAlign: "right", fontWeight: 700 }} /></td>
                  {editable && <td><RemoveRowBtn onClick={() => patch("rows", rows.filter((_, j) => j !== i))} /></td>}
                </tr>
              ))}
              <tr>
                <td colSpan={editable ? 2 : 2} style={{ fontWeight: 700, fontSize: 14 }}><EditableText value={content.totalLabel || "TOTAL"} onChange={set("totalLabel")} /></td>
                <td className="num" style={{ textAlign: "right", fontWeight: 700, fontSize: 16, color: "var(--fs-gold-700)" }}><EditableText value={content.totalAmount} onChange={set("totalAmount")} style={{ textAlign: "right", fontWeight: 700, fontSize: 16, color: "var(--fs-gold-700)" }} /></td>
                {editable && <td />}
              </tr>
            </tbody>
          </table>
          <AddRowBtn onClick={patch ? () => patch("rows", [...rows, { label: "New item", description: "", amount: "$0" }]) : null} />
        </>
      );
    }
    case "terms":
    case "insurance":
    case "exceptions":
      return (
        <>
          <SectionTitle value={content.title || type} onChange={set("title")} />
          <EditableText multiline value={content.body} onChange={set("body")} style={{ fontSize: 13, lineHeight: 1.65, margin: 0 }} />
        </>
      );
    case "conclusion": {
      const paragraphs = content.paragraphs || [];
      return (
        <>
          <SectionTitle value={content.title || "Conclusion"} onChange={set("title")} />
          {paragraphs.map((p, i) => (
            <div key={i} className="row-editable" style={{ marginBottom: 10 }}>
              <EditableText multiline value={p} onChange={patch ? (v) => { const next = [...paragraphs]; next[i] = v; patch("paragraphs", next); } : null} style={{ fontSize: 14, lineHeight: 1.65, flex: 1 }} />
              {paragraphs.length > 1 && <RemoveRowBtn onClick={patch ? () => patch("paragraphs", paragraphs.filter((_, j) => j !== i)) : null} />}
            </div>
          ))}
          <AddRowBtn label="Add paragraph" onClick={patch ? () => patch("paragraphs", [...paragraphs, ""]) : null} />
        </>
      );
    }
    case "scope": {
      const rows = content.rows || [];
      const setRow = patch ? (i, key) => (v) => {
        patch("rows", rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
      } : () => null;
      return (
        <>
          <SectionTitle value={content.title || "Scope of work"} onChange={set("title")} />
          <table className="tbl" style={{ borderTop: "1px solid var(--fs-border)" }}>
            <thead><tr><th>Workstream</th><th>What we&rsquo;ll do</th><th style={{ textAlign: "right" }}>Cadence</th>{editable && <th style={{ width: 30 }} />}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, color: "var(--fs-navy)" }}><EditableText value={r.workstream} onChange={setRow(i, "workstream")} style={{ fontWeight: 600, fontSize: 13 }} /></td>
                  <td><EditableText value={r.detail} onChange={setRow(i, "detail")} style={{ fontSize: 13 }} /></td>
                  <td className="mut" style={{ textAlign: "right" }}><EditableText value={r.cadence} onChange={setRow(i, "cadence")} style={{ fontSize: 13, textAlign: "right" }} /></td>
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
          <SectionTitle value={content.title || "Deliverables"} onChange={set("title")} />
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
    case "fees": {
      const rows = content.rows || [];
      const total = content.total;
      return (
        <>
          <SectionTitle value={content.title || "Fees & retainer"} onChange={set("title")} />
          <table className="tbl">
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td><EditableText value={r.label} onChange={patch ? (v) => patch("rows", rows.map((x, j) => j === i ? { ...x, label: v } : x)) : null} style={{ fontSize: 13 }} /></td>
                  <td className="num" style={{ textAlign: "right", fontWeight: 700 }}><EditableText value={r.amount} onChange={patch ? (v) => patch("rows", rows.map((x, j) => j === i ? { ...x, amount: v } : x)) : null} style={{ textAlign: "right", fontWeight: 700 }} /></td>
                  {editable && <td style={{ width: 30 }}><RemoveRowBtn onClick={() => patch("rows", rows.filter((_, j) => j !== i))} /></td>}
                </tr>
              ))}
              {(total || editable) && (
                <tr>
                  <td style={{ fontWeight: 700, fontSize: 16, color: "var(--fs-navy)" }}><EditableText value={total?.label || "Total"} onChange={patch ? (v) => patch("total", { ...(total || {}), label: v }) : null} /></td>
                  <td className="num" style={{ textAlign: "right", fontWeight: 700, fontSize: 20, color: "var(--fs-gold-700)" }}><EditableText value={total?.amount} onChange={patch ? (v) => patch("total", { ...(total || {}), amount: v }) : null} style={{ textAlign: "right", fontWeight: 700, fontSize: 20, color: "var(--fs-gold-700)" }} /></td>
                  {editable && <td />}
                </tr>
              )}
            </tbody>
          </table>
          <AddRowBtn label="Add line item" onClick={patch ? () => patch("rows", [...rows, { label: "New line item", amount: "$0" }]) : null} />
        </>
      );
    }
    case "timeline": {
      const weeks = content.weeks || [];
      const bars = content.bars || [];
      return (
        <>
          <SectionTitle value={content.title || "Timeline"} onChange={set("title")} />
          <div style={{ display: "grid", gridTemplateColumns: `120px repeat(${weeks.length || 1}, 1fr)`, gap: 4, fontSize: 11 }}>
            <div />
            {weeks.map((w, i) => <div key={i} className="mut" style={{ textAlign: "center" }}>{w}</div>)}
            {bars.map((bar, bi) => (
              <React.Fragment key={bi}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fs-navy)", paddingRight: 8 }}>{bar.label}</div>
                {weeks.map((_, wi) => (
                  <div key={wi} style={{ height: 20, background: wi >= bar.start && wi < bar.start + bar.span ? "var(--fs-gold-200)" : "var(--fs-bone-50)", borderRadius: 2 }} />
                ))}
              </React.Fragment>
            ))}
          </div>
        </>
      );
    }
    case "signoff":
      return (
        <>
          <SectionTitle value={content.title || "Sign-off"} onChange={set("title")} style={{ marginBottom: 14 }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div>
              <div className="mut" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em" }}>Fog Signal</div>
              <div style={{ height: 38, borderBottom: "1px solid var(--fs-border-strong)", margin: "26px 0 6px" }} />
              <EditableText value={content.firmSignatory?.name || "Carter James"} onChange={patch ? (v) => patch("firmSignatory", { ...(content.firmSignatory || {}), name: v }) : null} style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)" }} />
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
