import React from "react";

// Lightweight, dependency-free SVG charts sharing the Keel palette. All are
// theme-aware via CSS vars and scale to their container width.

const SERIES = ["#1A3A5C", "#B8932A", "#4A7BA7", "#A8341E", "#6C8B4B", "#8B9AAB", "#C77D3A", "#5B4C7A"];
export const PARTY_FILL = { D: "#1A3A5C", R: "#A8341E", I: "#8B9AAB" };

function colorFor(key, i, byParty) {
  if (byParty && PARTY_FILL[key]) return PARTY_FILL[key];
  return SERIES[i % SERIES.length];
}

export function ChartCard({ title, sub, children, right }) {
  return (
    <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="row between" style={{ alignItems: "baseline" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fs-navy)" }}>{title}</div>
          {sub && <div className="mut" style={{ fontSize: 11 }}>{sub}</div>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

export function Donut({ data = [], byParty = false, size = 150 }) {
  const total = data.reduce((a, d) => a + d.count, 0) || 1;
  const r = size / 2;
  const inner = r * 0.62;
  let angle = -Math.PI / 2;
  const arcs = data.map((d, i) => {
    const frac = d.count / total;
    const a0 = angle;
    const a1 = angle + frac * Math.PI * 2;
    angle = a1;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const x0 = r + r * Math.cos(a0), y0 = r + r * Math.sin(a0);
    const x1 = r + r * Math.cos(a1), y1 = r + r * Math.sin(a1);
    const xi0 = r + inner * Math.cos(a1), yi0 = r + inner * Math.sin(a1);
    const xi1 = r + inner * Math.cos(a0), yi1 = r + inner * Math.sin(a0);
    const path = `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} L ${xi0} ${yi0} A ${inner} ${inner} 0 ${large} 0 ${xi1} ${yi1} Z`;
    return { path, color: colorFor(d.key, i, byParty), ...d, frac };
  });
  return (
    <div className="row" style={{ gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        {arcs.map((a, i) => <path key={i} d={a.path} fill={a.color} />)}
        <text x={r} y={r - 2} textAnchor="middle" fontSize={20} fontWeight={700} fill="var(--fs-navy)">{total.toLocaleString()}</text>
        <text x={r} y={r + 16} textAnchor="middle" fontSize={10} fill="var(--fs-fg-muted)">voters</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 120 }}>
        {arcs.map((a, i) => (
          <div key={i} className="row" style={{ gap: 8, fontSize: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: a.color, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{a.key}</span>
            <span className="num mut">{a.count.toLocaleString()}</span>
            <span className="num" style={{ color: "var(--fs-navy)", fontWeight: 600, width: 38, textAlign: "right" }}>{Math.round(a.frac * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Horizontal bars — good for ranked categories (top precincts, cities, ethnicity).
export function BarList({ data = [], byParty = false, max = 10, unit = "" }) {
  const rows = data.slice(0, max);
  const peak = Math.max(1, ...rows.map((d) => d.count));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {rows.length === 0 && <div className="mut" style={{ fontSize: 12 }}>No data</div>}
      {rows.map((d, i) => (
        <div key={d.key} style={{ display: "grid", gridTemplateColumns: "96px 1fr 56px", gap: 8, alignItems: "center", fontSize: 12 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.key}>{d.key}</span>
          <div style={{ background: "var(--fs-border)", borderRadius: 3, height: 14, overflow: "hidden" }}>
            <div style={{ width: `${(d.count / peak) * 100}%`, height: "100%", background: colorFor(d.key, i, byParty), borderRadius: 3 }} />
          </div>
          <span className="num mut" style={{ textAlign: "right" }}>{d.count.toLocaleString()}{unit}</span>
        </div>
      ))}
    </div>
  );
}

// Vertical columns — good for ordered distributions (age bands, turnout bands, reg-by-year).
export function Columns({ data = [], height = 130, color = "#1A3A5C" }) {
  const peak = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="row" style={{ gap: 6, alignItems: "flex-end", height, paddingTop: 6 }}>
      {data.length === 0 && <div className="mut" style={{ fontSize: 12 }}>No data</div>}
      {data.map((d) => (
        <div key={d.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
          <span className="num" style={{ fontSize: 10, color: "var(--fs-fg-muted)" }}>{d.count >= 1000 ? (d.count / 1000).toFixed(1) + "k" : d.count}</span>
          <div title={`${d.key}: ${d.count.toLocaleString()}`} style={{
            width: "100%", maxWidth: 40, background: color, borderRadius: "3px 3px 0 0",
            height: `${Math.max(2, (d.count / peak) * (height - 34))}px`,
          }} />
          <span style={{ fontSize: 10, color: "var(--fs-fg-muted)", whiteSpace: "nowrap" }}>{d.key}</span>
        </div>
      ))}
    </div>
  );
}
