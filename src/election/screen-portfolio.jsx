import React, { useState } from "react";
import { ET } from "./data.js";
import { fmtDate, fmtMoney, daysUntil, selStyle } from "./fmt.js";
import { ThresholdGauge, statusFor } from "./gauge.jsx";
import { measureStatus, parseAmount } from "./measureStatus.js";
import { FathomIcon as Icon } from "./icon.jsx";
import { PageHeader, Kpi, Chip, MetaRow, EmptyState, Btn } from "./atoms.jsx";

function FilterBar({ filters, setFilters, layout, setLayout, count, total }) {
  const states = ["All", ...Array.from(new Set(ET.measures.map((m) => m.state))).sort()];
  const types = ["All", ...Array.from(new Set(ET.measures.map((m) => m.type)))];
  const phases = [["all", "All Status"], ["active", "On Ballot Tonight"], ["upcoming", "Upcoming"], ["closed", "Closed"]];
  const cycles = ["All", ...Array.from(new Set(ET.measures.map((m) => m.cycle)))];
  const consultants = ["All", ...ET.STAFF];

  const sel = (label, value, key, opts) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontFamily: "var(--fs-font-sans)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--fs-fg-subtle)" }}>{label}</span>
      <select value={value} onChange={(e) => setFilters({ ...filters, [key]: e.target.value })} style={selStyle}>
        {opts.map((o) => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o}</option>))}
      </select>
    </label>
  );

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap", padding: "18px 40px", background: "var(--fs-paper)", borderBottom: "1px solid var(--fs-border)", position: "sticky", top: 0, zIndex: 10 }}>
      {sel("State", filters.state, "state", states)}
      {sel("Type", filters.type, "type", types)}
      {sel("Status", filters.phase, "phase", phases)}
      {sel("Cycle", filters.cycle, "cycle", cycles)}
      {sel("Consultant", filters.consultant, "consultant", consultants)}
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontFamily: "var(--fs-font-sans)", fontSize: 13, color: "var(--fs-fg-muted)" }}>{count} of {total}</span>
        <div style={{ display: "flex", border: "1px solid var(--fs-border-strong)", borderRadius: 4, overflow: "hidden" }}>
          {[["cards", "layout-grid"], ["table", "table"]].map(([k, ic]) => (
            <button key={k} type="button" onClick={() => setLayout(k)} title={k} style={{
              display: "grid", placeItems: "center", width: 34, height: 34, border: "none", cursor: "pointer",
              background: layout === k ? "var(--fs-navy)" : "var(--fs-paper)", color: layout === k ? "#fff" : "var(--fs-fg-muted)",
            }}>
              <Icon name={ic} style={{ width: 16, height: 16 }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MeasureCard({ m, band, onOpen }) {
  const st = measureStatus(m, band);
  const dd = m.phase === "upcoming" ? daysUntil(m.electionDate, ET.TODAY) : null;
  return (
    <button type="button" onClick={() => onOpen(m.id)} className="measurecard" style={{
      textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: 14,
      padding: "20px 22px", background: "var(--fs-paper)", border: "1px solid var(--fs-border)",
      borderRadius: 4, transition: "box-shadow 200ms, transform 200ms", width: "100%",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "var(--fs-font-sans)", fontSize: 12.5, fontWeight: 600, color: "var(--fs-fg-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.client}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
            <span style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 14, color: "var(--fs-gold-700)", letterSpacing: "0.04em" }}>{m.code}</span>
          </div>
          <h3 style={{ margin: "2px 0 0", fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 19, lineHeight: 1.2, color: "var(--fs-navy)" }}>{m.title}</h3>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <Chip tone="bone">{m.type}</Chip>
        <Chip tone="soft">{m.category}</Chip>
      </div>
      <MetaRow items={[m.jurisdiction, m.amount, fmtDate(m.electionDate, { year: true })]} />
      <div style={{ marginTop: 2 }}>
        <ThresholdGauge yesPct={m.yesPct} threshold={m.threshold} band={band} size="sm" statusOverride={st.override} labelOverride={m.phase === "closed" ? st.label : null} />
      </div>
      {m.phase === "active" && (
        <div style={{ fontFamily: "var(--fs-font-sans)", fontSize: 11.5, color: "var(--fs-fg-subtle)", display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--fs-danger)", animation: "etpulse 1.8s infinite" }} />
          Counting tonight · provisional
        </div>
      )}
      {m.phase === "upcoming" && dd != null && (
        <div style={{ fontFamily: "var(--fs-font-sans)", fontSize: 11.5, color: "var(--fs-fg-subtle)" }}>Election in {dd} days · {m.polls.length} poll{m.polls.length !== 1 ? "s" : ""}</div>
      )}
    </button>
  );
}

function MeasureTable({ rows, band, onOpen, density }) {
  const pad = density === "compact" ? "9px 14px" : "13px 16px";
  const th = { textAlign: "left", fontFamily: "var(--fs-font-sans)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--fs-fg-subtle)", padding: "10px 16px", borderBottom: "1px solid var(--fs-border)", whiteSpace: "nowrap" };
  const td = { padding: pad, borderBottom: "1px solid var(--fs-border)", fontFamily: "var(--fs-font-sans)", fontSize: 13.5, color: "var(--fs-ink)", verticalAlign: "middle" };
  return (
    <div style={{ background: "var(--fs-paper)", border: "1px solid var(--fs-border)", borderRadius: 4, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>Measure</th><th style={th}>Client</th><th style={th}>Type</th><th style={th}>Jurisdiction</th>
            <th style={th}>Threshold</th><th style={{ ...th, width: 200 }}>Yes% vs line</th><th style={th}>Date</th><th style={th} />
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const st = measureStatus(m, band);
            return (
              <tr key={m.id} className="trow" onClick={() => onOpen(m.id)} style={{ cursor: "pointer" }}>
                <td style={td}><span style={{ color: "var(--fs-gold-700)", fontWeight: 700, fontFamily: "var(--fs-font-display)" }}>{m.code}</span><div style={{ fontSize: 12, color: "var(--fs-fg-muted)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</div></td>
                <td style={{ ...td, color: "var(--fs-fg-muted)" }}>{m.client}</td>
                <td style={td}>{m.type}</td>
                <td style={{ ...td, color: "var(--fs-fg-muted)" }}>{m.jurisdiction}</td>
                <td style={td}>{m.threshold.short}</td>
                <td style={{ ...td, width: 200 }}><ThresholdGauge yesPct={m.yesPct} threshold={m.threshold} band={band} size="sm" statusOverride={st.override} labelOverride={m.phase === "closed" ? st.label : null} /></td>
                <td style={{ ...td, color: "var(--fs-fg-muted)", whiteSpace: "nowrap" }}>{fmtDate(m.electionDate, { year: true })}</td>
                <td style={td}><Icon name="chevron-right" style={{ width: 16, height: 16, color: "var(--fs-fg-subtle)" }} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function PortfolioScreen({ tw, onOpen }) {
  const [filters, setFilters] = useState({ state: "All", type: "All", phase: "all", cycle: "All", consultant: "All" });
  const [layout, setLayout] = useState("cards");

  const rows = ET.measures.filter((m) =>
    (filters.state === "All" || m.state === filters.state) &&
    (filters.type === "All" || m.type === filters.type) &&
    (filters.phase === "all" || m.phase === filters.phase) &&
    (filters.cycle === "All" || m.cycle === filters.cycle) &&
    (filters.consultant === "All" || m.consultant === filters.consultant)
  );

  const active = ET.measures.filter((m) => m.phase === "active");
  const onBallotValue = active.reduce((s, m) => s + parseAmount(m.amount), 0);
  const states = new Set(ET.measures.filter((m) => m.phase !== "closed").map((m) => m.state));
  const upcomingDeadlines = ET.measures.flatMap((m) => m.deadlines).filter((d) => !d.done && daysUntil(d.date, ET.TODAY) >= 0 && daysUntil(d.date, ET.TODAY) <= 60).length;

  return (
    <>
      <PageHeader
        eyebrow={`Portfolio · ${ET.measures.length} measures`}
        title="Revenue Measure Portfolio"
        sub="Every active, upcoming, and closed measure across the firm. Election Night is live — figures below are simulated for design."
        actions={<Btn kind="primary" icon="radio" onClick={() => onOpen.go("election-night")}>Open Election Night</Btn>}
      />
      <div style={{ padding: "24px 40px 0", background: "var(--fs-paper)", borderBottom: "1px solid var(--fs-border)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, paddingBottom: 24 }}>
          <Kpi label="On the ballot tonight" value={active.length} foot={`${active.filter((m) => statusFor(m.yesPct, m.threshold.value, tw.band) === "watch").length} in the watch band`} accent />
          <Kpi label="Bond value on ballot" value={fmtMoney(onBallotValue)} foot="Aggregate GO bond / program ask, this cycle" />
          <Kpi label="States represented" value={states.size} foot={Array.from(states).sort().join(" · ")} />
          <Kpi label="Deadlines · next 60 days" value={upcomingDeadlines} foot="Across the active portfolio" />
        </div>
      </div>
      <FilterBar filters={filters} setFilters={setFilters} layout={layout} setLayout={setLayout} count={rows.length} total={ET.measures.length} />
      <div style={{ padding: "28px 40px 56px", flex: 1 }}>
        {rows.length === 0 ? (
          <EmptyState icon="filter-x" title="No measures match these filters" body="Nothing in the portfolio fits this combination of state, type, status, cycle, and consultant. Widen a filter to see results."
            action={<Btn kind="secondary" icon="rotate-ccw" onClick={() => setFilters({ state: "All", type: "All", phase: "all", cycle: "All", consultant: "All" })}>Reset filters</Btn>} />
        ) : layout === "cards" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
            {rows.map((m) => <MeasureCard key={m.id} m={m} band={tw.band} onOpen={onOpen.measure} />)}
          </div>
        ) : (
          <MeasureTable rows={rows} band={tw.band} onOpen={onOpen.measure} density={tw.density} />
        )}
      </div>
    </>
  );
}
