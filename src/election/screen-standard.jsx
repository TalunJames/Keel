import React, { useState } from "react";
import { ET } from "./data.js";
import { fmtDate, daysUntil, selStyle, navArrow } from "./fmt.js";
import { ThresholdGauge, STATUS, statusFor } from "./gauge.jsx";
import { PROOF, ProofTag } from "./screen-detail.jsx";
import { FathomIcon as Icon } from "./icon.jsx";
import { PageHeader, Panel, TrendChart, EmptyState, Btn } from "./atoms.jsx";

export function PollingScreen({ tw, onOpen }) {
  const tracked = ET.measures.filter((m) => m.phase !== "closed");
  const [selId, setSel] = useState(tracked[0]?.id);
  const closed = ET.measures.filter((m) => m.phase === "closed");
  const sel = ET.byId(selId);

  if (!sel) return null;

  return (
    <>
      <PageHeader eyebrow="Polling" title="Polling Tracker" sub="Latest modeled support for every active and upcoming measure, read against its real passage threshold — plus how past models held up against certified results." />
      <div style={{ padding: "28px 40px 56px", flex: 1, display: "grid", gridTemplateColumns: "minmax(360px, 440px) 1fr", gap: 28, alignItems: "start" }}>
        <div style={{ background: "var(--fs-paper)", border: "1px solid var(--fs-border)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--fs-border)", fontFamily: "var(--fs-font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--fs-fg-subtle)" }}>Latest support vs threshold</div>
          {tracked.map((m) => {
            const last = m.polls[m.polls.length - 1];
            const sKey = statusFor(last.support, m.threshold.value, tw.band);
            const on = selId === m.id;
            return (
              <button key={m.id} type="button" onClick={() => setSel(m.id)} className="trow" style={{ width: "100%", textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: 9, padding: "15px 18px", border: "none", borderBottom: "1px solid var(--fs-border)", borderLeft: `3px solid ${on ? "var(--fs-gold)" : "transparent"}`, background: on ? "var(--fs-bone-50)" : "var(--fs-paper)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                  <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "var(--fs-font-sans)", fontSize: 14.5, fontWeight: 600, color: "var(--fs-ink)" }}>{m.code} · {m.jurisdiction.split(",")[0]}</span>
                  <span style={{ flexShrink: 0, fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 18, color: STATUS[sKey].color }}>{last.support}%</span>
                </div>
                <ThresholdGauge yesPct={last.support} threshold={m.threshold} band={tw.band} size="sm" />
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <Panel title={`${sel.code} · ${sel.title}`} right={<Btn kind="ghost" icon="arrow-up-right" sm onClick={() => onOpen.measure(sel.id)}>Open measure</Btn>}>
            {sel.polls.length > 1 ? <TrendChart polls={sel.polls} threshold={sel.threshold} height={240} /> :
              <p style={{ fontFamily: "var(--fs-font-sans)", color: "var(--fs-fg-muted)", margin: 0 }}>Baseline only — a trend line appears after the second wave.</p>}
          </Panel>
          <Panel title="Benchmark · modeled vs certified" right={<span style={{ fontFamily: "var(--fs-font-sans)", fontSize: 12.5, color: "var(--fs-fg-subtle)" }}>Closed measures</span>}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {closed.map((m) => {
                const delta = m.result.finalYes - m.result.modeledYes;
                return (
                  <div key={m.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7, gap: 12 }}>
                      <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "var(--fs-font-sans)", fontSize: 13.5, fontWeight: 600, color: "var(--fs-ink)" }}>{m.code} · {m.jurisdiction.split(",")[0]}</span>
                      <span style={{ flexShrink: 0, fontFamily: "var(--fs-font-sans)", fontSize: 13, fontWeight: 700, color: delta >= 0 ? "#2F6B4F" : "#A8341E" }}>{delta >= 0 ? "+" : ""}{delta.toFixed(1)} vs model {m.result.passed ? "· passed" : "· failed"}</span>
                    </div>
                    <BenchmarkBar modeled={m.result.modeledYes} final={m.result.finalYes} threshold={m.threshold.value} passed={m.result.passed} />
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function BenchmarkBar({ modeled, final, threshold, passed }) {
  const max = 80;
  const pos = (v) => `${(v / max) * 100}%`;
  return (
    <div style={{ position: "relative", height: 30, background: "var(--fs-navy-50)", borderRadius: 2, border: "1px solid var(--fs-border)" }}>
      <div style={{ position: "absolute", top: -3, bottom: -3, left: pos(threshold), width: 2, marginLeft: -1, background: "var(--fs-navy-800)", zIndex: 3 }} />
      <div title={`Modeled ${modeled}%`} style={{ position: "absolute", top: "50%", left: pos(modeled), transform: "translate(-50%,-50%)", width: 12, height: 12, borderRadius: 999, background: "#fff", border: "2px solid var(--fs-ink-400)", zIndex: 2 }} />
      <div title={`Final ${final}%`} style={{ position: "absolute", top: "50%", left: pos(final), transform: "translate(-50%,-50%)", width: 14, height: 14, borderRadius: 999, background: passed ? "#2F6B4F" : "#A8341E", border: "2px solid #fff", boxShadow: "var(--fs-shadow-xs)", zIndex: 4 }} />
    </div>
  );
}

const DTYPE = [
  { match: ["Resolution"], color: "#1A3A5C", label: "Resolution" },
  { match: ["Ballot argument", "pamphlet", "language"], color: "#B0741A", label: "Ballot argument" },
  { match: ["Rebuttal"], color: "#3F6A99", label: "Rebuttal" },
  { match: ["finance", "C-4", "disclosure", "lobbying"], color: "#2F6B4F", label: "Finance / disclosure" },
  { match: ["TABOR", "notice", "conflict", "referral", "certification"], color: "#A8341E", label: "Filing / notice" },
];

function dtype(t) {
  for (const d of DTYPE) if (d.match.some((k) => t.toLowerCase().includes(k.toLowerCase()))) return d;
  return { color: "var(--fs-ink-400)", label: "Other" };
}

function allDeadlines() {
  const out = [];
  ET.measures.forEach((m) => m.deadlines.forEach((d) => out.push({ ...d, measure: m })));
  ET.firmDeadlines.forEach((d) => out.push({ ...d, measure: null }));
  return out;
}

export function CalendarScreen() {
  const [month, setMonth] = useState(5);
  const [year] = useState(2026);
  const [measureFilter, setMeasureFilter] = useState("all");
  const [vmode, setVmode] = useState("month");

  let dls = allDeadlines();
  if (measureFilter !== "all") dls = dls.filter((d) => d.measure && d.measure.id === measureFilter);

  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const iso = (d) => `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const dlsFor = (d) => dls.filter((x) => x.date === iso(d));

  const upcoming = dls.filter((d) => daysUntil(d.date, ET.TODAY) >= 0).sort((a, b) => a.date.localeCompare(b.date));
  const measuresWithDl = ET.measures.filter((m) => m.deadlines.length);

  return (
    <>
      <PageHeader eyebrow="Compliance" title="Deadline Calendar" sub="Statutory deadlines auto-derive from each election date; manual entries are added by the team. Filter to one measure or watch the whole portfolio."
        actions={
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <select value={measureFilter} onChange={(e) => setMeasureFilter(e.target.value)} style={selStyle}>
              <option value="all">All measures</option>
              {measuresWithDl.map((m) => <option key={m.id} value={m.id}>{m.code} · {m.jurisdiction.split(",")[0]}</option>)}
            </select>
            <div style={{ display: "flex", border: "1px solid var(--fs-border-strong)", borderRadius: 4, overflow: "hidden" }}>
              {[["month", "calendar"], ["list", "list"]].map(([k, ic]) => (
                <button key={k} type="button" onClick={() => setVmode(k)} style={{ display: "grid", placeItems: "center", width: 34, height: 34, border: "none", cursor: "pointer", background: vmode === k ? "var(--fs-navy)" : "var(--fs-paper)", color: vmode === k ? "#fff" : "var(--fs-fg-muted)" }}><Icon name={ic} style={{ width: 16, height: 16 }} /></button>
              ))}
            </div>
          </div>
        } />
      <div style={{ padding: "26px 40px 56px", flex: 1 }}>
        <LegendDtypes />
        {vmode === "month" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, marginTop: 18 }}>
            <div style={{ background: "var(--fs-paper)", border: "1px solid var(--fs-border)", borderRadius: 4, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <button type="button" onClick={() => setMonth((m) => Math.max(0, m - 1))} style={navArrow}><Icon name="chevron-left" style={{ width: 18, height: 18 }} /></button>
                <h3 style={{ margin: 0, fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 22, color: "var(--fs-navy)" }}>{["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][month]} {year}</h3>
                <button type="button" onClick={() => setMonth((m) => Math.min(11, m + 1))} style={navArrow}><Icon name="chevron-right" style={{ width: 18, height: 18 }} /></button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1 }}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} style={{ textAlign: "center", fontFamily: "var(--fs-font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fs-fg-subtle)", padding: "6px 0" }}>{d}</div>)}
                {cells.map((d, i) => {
                  const items = d ? dlsFor(d) : [];
                  const isToday = d && iso(d) === ET.TODAY;
                  return (
                    <div key={i} style={{ minHeight: 78, background: d ? "var(--fs-paper)" : "transparent", border: "1px solid var(--fs-border)", padding: 6, position: "relative" }}>
                      {d && <div style={{ fontFamily: "var(--fs-font-sans)", fontSize: 12, fontWeight: isToday ? 700 : 500, color: isToday ? "#fff" : "var(--fs-fg-muted)", background: isToday ? "var(--fs-navy)" : "transparent", width: 22, height: 22, borderRadius: 999, display: "grid", placeItems: "center" }}>{d}</div>}
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
                        {items.slice(0, 3).map((x, j) => {
                          const dt = dtype(x.type);
                          return (
                            <div key={j} title={x.type} style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--fs-font-sans)", fontSize: 10.5, color: "var(--fs-ink-700)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              <span style={{ width: 7, height: 7, borderRadius: 999, background: dt.color, flexShrink: 0, boxShadow: x.source === "manual" ? `inset 0 0 0 1.5px #fff, 0 0 0 1.5px ${dt.color}` : "none" }} />{x.type}
                            </div>
                          );
                        })}
                        {items.length > 3 && <div style={{ fontFamily: "var(--fs-font-sans)", fontSize: 10, color: "var(--fs-fg-subtle)" }}>+{items.length - 3} more</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--fs-font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--fs-fg-subtle)", marginBottom: 12 }}>Upcoming</div>
              <DeadlineList items={upcoming.slice(0, 10)} />
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 18, maxWidth: 720 }}><DeadlineList items={upcoming} /></div>
        )}
      </div>
    </>
  );
}

function LegendDtypes() {
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
      {DTYPE.map((d) => <span key={d.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--fs-font-sans)", fontSize: 12, color: "var(--fs-fg-muted)" }}><span style={{ width: 9, height: 9, borderRadius: 999, background: d.color }} />{d.label}</span>)}
      <span style={{ width: 1, height: 14, background: "var(--fs-border)" }} />
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--fs-font-sans)", fontSize: 12, color: "var(--fs-fg-muted)" }}><span style={{ width: 9, height: 9, borderRadius: 999, background: "var(--fs-navy)" }} />Auto-derived</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--fs-font-sans)", fontSize: 12, color: "var(--fs-fg-muted)" }}><span style={{ width: 9, height: 9, borderRadius: 999, background: "#fff", boxShadow: "inset 0 0 0 1.5px #fff, 0 0 0 1.5px var(--fs-navy)" }} />Manual entry</span>
    </div>
  );
}

function DeadlineList({ items }) {
  if (!items.length) return <EmptyState icon="calendar-check" title="Nothing upcoming" body="No deadlines fall in this window. Auto-derived deadlines appear once measures are placed on a ballot." />;
  return (
    <div style={{ background: "var(--fs-paper)", border: "1px solid var(--fs-border)", borderRadius: 4, overflow: "hidden" }}>
      {items.map((x, i) => {
        const dt = dtype(x.type);
        const dd = daysUntil(x.date, ET.TODAY);
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderBottom: i < items.length - 1 ? "1px solid var(--fs-border)" : "none" }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: dt.color, flexShrink: 0, boxShadow: x.source === "manual" ? `inset 0 0 0 2px #fff, 0 0 0 2px ${dt.color}` : "none" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--fs-font-sans)", fontSize: 14, fontWeight: 600, color: "var(--fs-ink)" }}>{x.type}</div>
              <div style={{ fontFamily: "var(--fs-font-sans)", fontSize: 12, color: "var(--fs-fg-muted)" }}>{x.measure ? `${x.measure.code} · ${x.measure.jurisdiction.split(",")[0]}` : "Firm-wide"}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "var(--fs-font-sans)", fontSize: 13, fontWeight: 600, color: "var(--fs-ink)" }}>{fmtDate(x.date, { year: true })}</div>
              <div style={{ fontFamily: "var(--fs-font-sans)", fontSize: 11.5, color: dd <= 7 ? "#A8341E" : "var(--fs-fg-subtle)" }}>{dd === 0 ? "Today" : `in ${dd} days`}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const STAGES = [
  { key: "lead", label: "Lead" },
  { key: "rfp", label: "RFP Out" },
  { key: "proposal", label: "Proposal Submitted" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];

export function PipelineScreen() {
  const fmtV = (n) => "$" + Math.round(n / 1000) + "K";
  return (
    <>
      <PageHeader eyebrow="Business Development" title="Pipeline" sub="Every opportunity from first contact to decision. Won and lost cards carry the reason so the next pursuit is smarter." />
      <div style={{ padding: "26px 40px 56px", flex: 1, overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${STAGES.length}, minmax(248px, 1fr))`, gap: 16, minWidth: 1240 }}>
          {STAGES.map((s) => {
            const cards = ET.pipeline.filter((p) => p.stage === s.key);
            const total = cards.reduce((a, c) => a + c.value, 0);
            const closed = s.key === "won" || s.key === "lost";
            return (
              <div key={s.key} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 4px" }}>
                  <span style={{ fontFamily: "var(--fs-font-sans)", fontSize: 12.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: s.key === "won" ? "#2F6B4F" : s.key === "lost" ? "#A8341E" : "var(--fs-navy)" }}>{s.label}</span>
                  <span style={{ flexShrink: 0, fontFamily: "var(--fs-font-sans)", fontSize: 12, color: "var(--fs-fg-subtle)", whiteSpace: "nowrap" }}>{cards.length} · {fmtV(total)}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, background: "var(--fs-bone-100)", borderRadius: 4, padding: 12, minHeight: 200 }}>
                  {cards.map((c) => (
                    <div key={c.id} style={{ background: "var(--fs-paper)", border: "1px solid var(--fs-border)", borderRadius: 4, padding: "14px 15px", borderLeft: `3px solid ${s.key === "won" ? "#2F6B4F" : s.key === "lost" ? "#A8341E" : "var(--fs-navy)"}` }}>
                      <div style={{ fontFamily: "var(--fs-font-sans)", fontSize: 14, fontWeight: 600, color: "var(--fs-ink)", lineHeight: 1.3 }}>{c.opportunity}</div>
                      <div style={{ fontFamily: "var(--fs-font-sans)", fontSize: 12.5, color: "var(--fs-fg-muted)", marginTop: 4 }}>{c.client} · {c.state}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                        <span style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 16, color: "var(--fs-navy)" }}>{fmtV(c.value)}</span>
                        <span style={{ fontFamily: "var(--fs-font-sans)", fontSize: 11.5, color: "var(--fs-fg-subtle)" }}>{fmtDate(c.decisionDate)}</span>
                      </div>
                      {closed && c.reason && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--fs-border)", fontFamily: "var(--fs-font-sans)", fontSize: 12, color: "var(--fs-fg-muted)", lineHeight: 1.4, display: "flex", gap: 6 }}>
                          <Icon name={s.key === "won" ? "trophy" : "info"} style={{ width: 13, height: 13, color: s.key === "won" ? "#2F6B4F" : "var(--fs-fg-subtle)", flexShrink: 0, marginTop: 2 }} />{c.reason}
                        </div>
                      )}
                    </div>
                  ))}
                  {!cards.length && <div style={{ fontFamily: "var(--fs-font-sans)", fontSize: 13, color: "var(--fs-fg-subtle)", textAlign: "center", padding: "24px 0" }}>No opportunities</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function FilterPill({ label, active, onClick, count, dot }) {
  return (
    <button type="button" onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "8px 14px", borderRadius: 999, border: `1px solid ${active ? "var(--fs-navy)" : "var(--fs-border-strong)"}`, background: active ? "var(--fs-navy)" : "var(--fs-paper)", color: active ? "#fff" : "var(--fs-fg-muted)", fontFamily: "var(--fs-font-sans)", fontSize: 13, fontWeight: 600 }}>
      {dot && <span style={{ width: 8, height: 8, borderRadius: 999, background: dot }} />}{label}
      <span style={{ fontSize: 11, fontWeight: 700, opacity: active ? 0.85 : 0.6 }}>{count}</span>
    </button>
  );
}

export function DeliverablesScreen({ onOpen }) {
  const [filter, setFilter] = useState("all");
  const rows = ET.measures.filter((m) => m.phase !== "closed").map((m) => ({ m, items: m.deliverables.filter((d) => filter === "all" || d.status === filter) })).filter((r) => r.items.length);
  const counts = { draft: 0, "in-proofing": 0, approved: 0, delivered: 0 };
  ET.measures.forEach((m) => m.deliverables.forEach((d) => { if (counts[d.status] != null) counts[d.status]++; }));

  return (
    <>
      <PageHeader eyebrow="Production" title="Deliverables & Proofing" sub="Program status at a glance — every produced item and where it sits in the proofing pipeline, by measure." />
      <div style={{ padding: "26px 40px 0", background: "var(--fs-paper)", borderBottom: "1px solid var(--fs-border)" }}>
        <div style={{ display: "flex", gap: 10, paddingBottom: 22, flexWrap: "wrap" }}>
          <FilterPill label="All" active={filter === "all"} onClick={() => setFilter("all")} count={Object.values(counts).reduce((a, b) => a + b, 0)} />
          {Object.keys(PROOF).map((k) => <FilterPill key={k} label={PROOF[k].label} active={filter === k} onClick={() => setFilter(k)} count={counts[k]} dot={PROOF[k].color} />)}
        </div>
      </div>
      <div style={{ padding: "26px 40px 56px", flex: 1, display: "flex", flexDirection: "column", gap: 22 }}>
        {rows.length === 0 ? <EmptyState icon="inbox" title="Nothing in this state" body="No deliverables match the selected proofing state right now." /> :
          rows.map(({ m, items }) => (
            <div key={m.id} style={{ background: "var(--fs-paper)", border: "1px solid var(--fs-border)", borderRadius: 4, overflow: "hidden" }}>
              <button type="button" onClick={() => onOpen.measure(m.id)} className="trow" style={{ width: "100%", textAlign: "left", cursor: "pointer", border: "none", borderBottom: "1px solid var(--fs-border)", background: "var(--fs-bone-50)", padding: "13px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 17, color: "var(--fs-navy)" }}>{m.code} · {m.title}</span>
                <span style={{ fontFamily: "var(--fs-font-sans)", fontSize: 12.5, color: "var(--fs-fg-muted)" }}>{items.length} item{items.length !== 1 ? "s" : ""} · {m.jurisdiction}</span>
              </button>
              {items.map((d, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "13px 18px", borderBottom: i < items.length - 1 ? "1px solid var(--fs-border)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 999, background: "var(--fs-bone-100)", display: "grid", placeItems: "center", fontFamily: "var(--fs-font-sans)", fontSize: 12, fontWeight: 700, color: "var(--fs-navy)" }}>{d.owner.split(".")[0]}</div>
                    <div>
                      <div style={{ fontFamily: "var(--fs-font-sans)", fontSize: 14.5, fontWeight: 600, color: "var(--fs-ink)" }}>{d.item}</div>
                      <div style={{ fontFamily: "var(--fs-font-sans)", fontSize: 12, color: "var(--fs-fg-muted)" }}>{d.owner} · due {fmtDate(d.due, { year: true })}</div>
                    </div>
                  </div>
                  <ProofTag status={d.status} />
                </div>
              ))}
            </div>
          ))}
      </div>
    </>
  );
}
