import React, { useState } from "react";
import { ET } from "./data.js";
import { fmtDate, daysUntil } from "./fmt.js";
import { ThresholdGauge } from "./gauge.jsx";
import { measureStatus } from "./measureStatus.js";
import { FathomIcon as Icon } from "./icon.jsx";
import { Chip, Kpi, TrendChart, EmptyState, Panel } from "./atoms.jsx";

export const PROOF = {
  draft: { label: "Draft", color: "var(--fs-ink-400)", bg: "var(--fs-bone-100)", icon: "pencil-line" },
  "in-proofing": { label: "In Proofing", color: "#B0741A", bg: "rgba(176,116,26,0.12)", icon: "loader" },
  approved: { label: "Approved", color: "var(--fs-navy)", bg: "var(--fs-navy-50)", icon: "check" },
  delivered: { label: "Delivered", color: "#2F6B4F", bg: "rgba(47,107,79,0.10)", icon: "check-check" },
};

export function ProofTag({ status }) {
  const p = PROOF[status] || PROOF.draft;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: p.bg, color: p.color, fontFamily: "var(--fs-font-sans)", fontSize: 11.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", border: `1px solid ${p.color}2e` }}>
      <Icon name={p.icon} style={{ width: 13, height: 13 }} />{p.label}
    </span>
  );
}

const DEADLINE_ICON = {
  Resolution: "gavel", "Ballot argument": "scroll-text", Rebuttal: "reply",
  "Finance report (pre-election)": "receipt", "Finance report (C-4)": "receipt",
  "Semi-annual finance report": "receipt", "Final finance report": "receipt",
};

function deadlineIcon(t) {
  for (const k in DEADLINE_ICON) if (t.includes(k.split(" (")[0])) return DEADLINE_ICON[k];
  return "calendar";
}

function DetailHeader({ m, band, onBack }) {
  const st = measureStatus(m, band);
  return (
    <div style={{ background: "var(--fs-paper)", borderBottom: "1px solid var(--fs-border)" }}>
      <div style={{ padding: "26px 40px 0" }}>
        <button type="button" onClick={onBack} className="linkbtn" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--fs-fg-muted)", cursor: "pointer", fontFamily: "var(--fs-font-sans)", fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 16 }}>
          <Icon name="arrow-left" style={{ width: 15, height: 15 }} /> Back to Portfolio
        </button>
      </div>
      <div style={{ padding: "0 40px 28px", display: "grid", gridTemplateColumns: "1fr 380px", gap: 48, alignItems: "start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 15, color: "var(--fs-gold-700)", letterSpacing: "0.04em" }}>{m.code}</span>
            <span style={{ color: "var(--fs-fg-subtle)" }}>·</span>
            <span style={{ fontFamily: "var(--fs-font-sans)", fontSize: 13, color: "var(--fs-fg-muted)" }}>{m.client}</span>
          </div>
          <h1 style={{ margin: 0, fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 40, lineHeight: 1.08, letterSpacing: "-0.015em", color: "var(--fs-navy)" }}>{m.title}</h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
            <Chip tone="bone">{m.type}</Chip>
            <Chip tone="soft">{m.category}</Chip>
            <Chip tone="outline">{m.state}</Chip>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, auto)", gap: "0 40px", marginTop: 24, justifyContent: "start" }}>
            {[["Jurisdiction", m.jurisdiction], ["The ask", m.amount], ["Election", fmtDate(m.electionDate, { year: true })], ["Consultant", m.consultant]].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontFamily: "var(--fs-font-sans)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--fs-fg-subtle)", marginBottom: 5 }}>{k}</div>
                <div style={{ fontFamily: "var(--fs-font-sans)", fontSize: 15, fontWeight: 600, color: "var(--fs-ink)" }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: "var(--fs-bone-50)", border: "1px solid var(--fs-border)", borderRadius: 4, padding: "22px 24px" }}>
          <div style={{ fontFamily: "var(--fs-font-sans)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--fs-fg-subtle)", marginBottom: 4 }}>Passage threshold</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 18 }}>
            <span style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 34, color: "var(--fs-navy)", lineHeight: 1 }}>{m.threshold.short}</span>
            <span style={{ fontFamily: "var(--fs-font-sans)", fontSize: 14, color: "var(--fs-fg-muted)" }}>{m.threshold.label}</span>
          </div>
          <div style={{ fontFamily: "var(--fs-font-sans)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--fs-fg-subtle)", marginBottom: 12 }}>
            {m.phase === "closed" ? "Final result" : m.phase === "active" ? "Live · provisional" : "Latest poll"}
          </div>
          <ThresholdGauge yesPct={m.yesPct} threshold={m.threshold} band={band} size="md" statusOverride={st.override} labelOverride={m.phase === "closed" ? st.label : null} />
        </div>
      </div>
    </div>
  );
}

function TabBar({ tabs, active, onTab }) {
  return (
    <div style={{ display: "flex", gap: 4, padding: "0 40px", background: "var(--fs-paper)", borderBottom: "1px solid var(--fs-border)", position: "sticky", top: 0, zIndex: 10 }}>
      {tabs.map((t) => {
        const on = active === t.id;
        return (
          <button key={t.id} type="button" onClick={() => onTab(t.id)} style={{
            background: "none", border: "none", cursor: "pointer", padding: "16px 16px 13px",
            fontFamily: "var(--fs-font-sans)", fontSize: 14.5, fontWeight: on ? 700 : 500,
            color: on ? "var(--fs-navy)" : "var(--fs-fg-muted)", borderBottom: `3px solid ${on ? "var(--fs-gold)" : "transparent"}`,
            display: "flex", alignItems: "center", gap: 7, marginBottom: -1,
          }}>
            <Icon name={t.icon} style={{ width: 16, height: 16 }} />{t.label}
            {t.count != null && <span style={{ fontSize: 11, fontWeight: 700, background: on ? "var(--fs-navy)" : "var(--fs-bone-200)", color: on ? "#fff" : "var(--fs-fg-muted)", borderRadius: 999, padding: "1px 7px" }}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

function PollingTab({ m }) {
  const last = m.polls[m.polls.length - 1];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 22 }}>
      <Panel title="Support trend across waves" right={<span style={{ fontFamily: "var(--fs-font-sans)", fontSize: 12.5, color: "var(--fs-fg-subtle)" }}>{m.polls.length} wave{m.polls.length !== 1 ? "s" : ""} · vs {m.threshold.short} line</span>}>
        {m.polls.length > 1 ? <TrendChart polls={m.polls} threshold={m.threshold} /> :
          <p style={{ fontFamily: "var(--fs-font-sans)", color: "var(--fs-fg-muted)", margin: 0 }}>Only a baseline wave so far — trend appears once a second wave lands.</p>}
      </Panel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        <Kpi label="Latest support" value={last.support} unit="%" foot={`${last.wave} · ${fmtDate(last.date, { year: true })}`} />
        <Kpi label="Latest oppose" value={last.oppose} unit="%" />
        <Kpi label="Undecided" value={last.undecided} unit="%" foot="Movement decides two-thirds measures" />
      </div>
    </div>
  );
}

function DeliverablesTab({ m }) {
  if (!m.deliverables.length) return <EmptyState icon="inbox" title="No deliverables yet" body="Produced items will appear here as the program spins up." />;
  return (
    <Panel title="Produced items">
      <div style={{ display: "flex", flexDirection: "column" }}>
        {m.deliverables.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 0", borderBottom: i < m.deliverables.length - 1 ? "1px solid var(--fs-border)" : "none" }}>
            <div>
              <div style={{ fontFamily: "var(--fs-font-sans)", fontSize: 15, fontWeight: 600, color: "var(--fs-ink)" }}>{d.item}</div>
              <div style={{ fontFamily: "var(--fs-font-sans)", fontSize: 12.5, color: "var(--fs-fg-muted)", marginTop: 3 }}>Owner: {d.owner} · Due {fmtDate(d.due, { year: true })}</div>
            </div>
            <ProofTag status={d.status} />
          </div>
        ))}
      </div>
    </Panel>
  );
}

function LegendAutoManual() {
  return (
    <div style={{ display: "flex", gap: 14, fontFamily: "var(--fs-font-sans)", fontSize: 12, color: "var(--fs-fg-muted)" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="zap" style={{ width: 12, height: 12, color: "var(--fs-navy-500)" }} />Auto-derived</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="hand" style={{ width: 12, height: 12, color: "var(--fs-gold-700)" }} />Manual</span>
    </div>
  );
}

function DeadlinesTab({ m }) {
  if (!m.deadlines.length) return <EmptyState icon="calendar-check" title="No deadlines on file" body="Statutory deadlines auto-derive from the election date; none are recorded for this measure yet." />;
  return (
    <Panel title="Compliance deadlines" right={<LegendAutoManual />}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {m.deadlines.map((d, i) => {
          const dd = daysUntil(d.date, ET.TODAY);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 0", borderBottom: i < m.deadlines.length - 1 ? "1px solid var(--fs-border)" : "none" }}>
              <div style={{ width: 34, height: 34, borderRadius: 4, background: d.done ? "var(--fs-navy-50)" : "var(--fs-bone-100)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Icon name={d.done ? "check" : deadlineIcon(d.type)} style={{ width: 17, height: 17, color: d.done ? "#2F6B4F" : "var(--fs-navy)" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "var(--fs-font-sans)", fontSize: 14.5, fontWeight: 600, color: "var(--fs-ink)" }}>{d.type}</div>
                <div style={{ fontFamily: "var(--fs-font-sans)", fontSize: 12.5, color: "var(--fs-fg-muted)" }}>{fmtDate(d.date, { year: true })}{!d.done && dd >= 0 ? ` · in ${dd} days` : d.done ? " · complete" : " · past"}</div>
              </div>
              <span style={{ fontFamily: "var(--fs-font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: d.source === "auto" ? "var(--fs-navy-500)" : "var(--fs-gold-700)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Icon name={d.source === "auto" ? "zap" : "hand"} style={{ width: 12, height: 12 }} />{d.source === "auto" ? "Auto-derived" : "Manual"}
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function ProvisionalNote() {
  return (
    <div style={{ display: "flex", gap: 10, padding: "12px 14px", background: "rgba(176,116,26,0.10)", border: "1px solid rgba(176,116,26,0.30)", borderRadius: 4, marginBottom: 20 }}>
      <Icon name="triangle-alert" style={{ width: 17, height: 17, color: "#B0741A", flexShrink: 0, marginTop: 1 }} />
      <span style={{ fontFamily: "var(--fs-font-sans)", fontSize: 13, color: "var(--fs-ink-700)", lineHeight: 1.4 }}>Night-of numbers are <strong>provisional</strong>. Late-mail ballots can shift the margin for days in late-counting states. Do not treat as final.</span>
    </div>
  );
}

function ResultsTab({ m, band }) {
  if (m.phase === "upcoming") return <EmptyState icon="hourglass" title="No results yet" body={`This measure is on the ${m.cycle} ballot. Results populate here on election night.`} />;
  const r = m.result;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 22 }}>
      <Panel title={m.phase === "active" ? "Live result · provisional" : "Certified result"}>
        {m.phase === "active" && <ProvisionalNote />}
        <ThresholdGauge yesPct={m.yesPct} threshold={m.threshold} band={band} size="lg" theme="light"
          statusOverride={m.phase === "closed" ? (r.passed ? "pass" : "fail") : null}
          labelOverride={m.phase === "closed" ? (r.passed ? "Passed" : "Failed") : null} />
      </Panel>
      {m.phase === "closed" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          <Kpi label="Final Yes" value={r.finalYes} unit="%" accent />
          <Kpi label="Modeled Yes" value={r.modeledYes} unit="%" foot={`Result beat model by ${(r.finalYes - r.modeledYes).toFixed(1)} pts`} />
          <Kpi label="Outcome" value={r.passed ? "Passed" : "Failed"} foot={r.passed ? "Cleared the threshold" : "Short of the threshold"} />
        </div>
      )}
      {m.phase === "closed" && m.result.note && (
        <div style={{ background: "var(--fs-navy-50)", border: "1px solid var(--fs-border)", borderRadius: 4, padding: "16px 18px", fontFamily: "var(--fs-font-sans)", fontSize: 13.5, color: "var(--fs-fg-muted)" }}>
          <Icon name="info" style={{ width: 15, height: 15, verticalAlign: "-2px", marginRight: 8, color: "var(--fs-navy-500)" }} />{m.result.note}
        </div>
      )}
    </div>
  );
}

function NotesTab({ m }) {
  const [general, setGeneral] = useState(m.notes.general || "");
  const [lessons, setLessons] = useState(m.notes.lessons || "");
  const ta = { width: "100%", boxSizing: "border-box", fontFamily: "var(--fs-font-sans)", fontSize: 14.5, lineHeight: 1.6, color: "var(--fs-ink)", padding: "14px 16px", border: "1px solid var(--fs-border-strong)", borderRadius: 4, background: "var(--fs-paper)", resize: "vertical", outline: "none" };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 22 }}>
      <Panel title="Working notes">
        <textarea value={general} onChange={(e) => setGeneral(e.target.value)} rows={4} placeholder="Strategy notes, opposition activity, client conversations…" style={ta} />
      </Panel>
      <Panel title="Lessons learned" right={<span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--fs-font-sans)", fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fs-gold-700)" }}><Icon name="pin" style={{ width: 13, height: 13 }} />Persists after close</span>}>
        <p style={{ margin: "0 0 12px", fontFamily: "var(--fs-font-sans)", fontSize: 13.5, color: "var(--fs-fg-muted)", lineHeight: 1.5 }}>Institutional memory for this jurisdiction and threshold type. This field stays with the measure permanently — it does not clear when the measure closes.</p>
        <textarea value={lessons} onChange={(e) => setLessons(e.target.value)} rows={4} placeholder="What would we tell ourselves before the next measure like this one?" style={{ ...ta, background: "var(--fs-bone-50)" }} />
      </Panel>
    </div>
  );
}

export function MeasureDetailScreen({ id, tw, onBack }) {
  const m = ET.byId(id);
  const [tab, setTab] = useState("polling");
  if (!m) return null;
  const tabs = [
    { id: "polling", label: "Polling", icon: "trending-up" },
    { id: "deliverables", label: "Deliverables", icon: "check-square", count: m.deliverables.length },
    { id: "deadlines", label: "Deadlines", icon: "calendar-clock", count: m.deadlines.length },
    { id: "results", label: "Results", icon: "flag" },
    { id: "notes", label: "Notes", icon: "notebook-pen" },
  ];
  return (
    <>
      <DetailHeader m={m} band={tw.band} onBack={onBack} />
      <TabBar tabs={tabs} active={tab} onTab={setTab} />
      <div style={{ padding: "28px 40px 56px", flex: 1, background: "var(--fs-bone-50)" }}>
        {tab === "polling" && <PollingTab m={m} />}
        {tab === "deliverables" && <DeliverablesTab m={m} />}
        {tab === "deadlines" && <DeadlinesTab m={m} />}
        {tab === "results" && <ResultsTab m={m} band={tw.band} />}
        {tab === "notes" && <NotesTab m={m} />}
      </div>
    </>
  );
}
