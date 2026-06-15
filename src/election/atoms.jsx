import React from "react";
import { FathomIcon as Icon } from "./icon.jsx";
import { fmtDate } from "./fmt.js";

export const NAV = [
  { id: "portfolio", label: "Portfolio", icon: "layout-grid" },
  { id: "election-night", label: "Election Night", icon: "radio", signature: true },
  { id: "polling", label: "Polling", icon: "trending-up" },
  { id: "calendar", label: "Calendar", icon: "calendar-clock" },
  { id: "pipeline", label: "Pipeline", icon: "kanban" },
  { id: "deliverables", label: "Deliverables", icon: "check-square" },
];

export function Sidebar({ route, onNav }) {
  return (
    <aside style={{
      width: 232, flexShrink: 0, background: "var(--fs-navy)", color: "#fff",
      display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100%",
      minHeight: "calc(100vh - 120px)",
    }}>
      <div style={{ padding: "26px 22px 22px" }}>
        <div style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 20, letterSpacing: "-0.02em" }}>Fathom</div>
        <div style={{ marginTop: 6, fontFamily: "var(--fs-font-sans)", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>
          Measure Tracker
        </div>
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 2, padding: "6px 12px", flex: 1 }}>
        {NAV.map((n) => {
          const active = route.screen === n.id;
          return (
            <button key={n.id} type="button" onClick={() => onNav(n.id)} className="navbtn" style={{
              display: "flex", alignItems: "center", gap: 11, padding: "10px 12px",
              background: active ? "rgba(255,255,255,0.10)" : "transparent",
              border: "none", borderLeft: `3px solid ${active ? "var(--fs-gold)" : "transparent"}`,
              color: active ? "#fff" : "rgba(255,255,255,0.74)", cursor: "pointer",
              fontFamily: "var(--fs-font-sans)", fontSize: 14.5, fontWeight: active ? 600 : 500,
              textAlign: "left", borderRadius: 3, transition: "background 160ms, color 160ms",
            }}>
              <Icon name={n.icon} style={{ width: 18, height: 18 }} />
              <span style={{ flex: 1 }}>{n.label}</span>
              {n.signature && (
                <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--fs-gold)", boxShadow: "0 0 0 3px rgba(239,197,63,0.25)" }} />
              )}
            </button>
          );
        })}
      </nav>
      <div style={{ padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.12)" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "9px 11px",
          background: "rgba(239,197,63,0.12)", border: "1px solid rgba(239,197,63,0.35)",
          borderRadius: 4,
        }}>
          <Icon name="flask-conical" style={{ width: 15, height: 15, color: "var(--fs-gold)" }} />
          <div>
            <div style={{ fontFamily: "var(--fs-font-sans)", fontSize: 11.5, fontWeight: 700, color: "var(--fs-gold-300)", letterSpacing: "0.04em" }}>SIMULATED DATA</div>
            <div style={{ fontFamily: "var(--fs-font-sans)", fontSize: 10.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.3 }}>All figures are placeholder</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function AppShell({ route, onNav, children }) {
  return (
    <div className="fathom-app" style={{ display: "flex", minHeight: "100%", background: "var(--fs-bone-50)" }}>
      <Sidebar route={route} onNav={onNav} />
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>{children}</main>
    </div>
  );
}

export function PageHeader({ eyebrow, title, sub, actions, onBack }) {
  return (
    <div style={{ padding: "30px 40px 22px", borderBottom: "1px solid var(--fs-border)", background: "var(--fs-paper)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24 }}>
        <div style={{ minWidth: 0 }}>
          {onBack && (
            <button type="button" onClick={onBack} className="linkbtn" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--fs-fg-muted)", cursor: "pointer", fontFamily: "var(--fs-font-sans)", fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 12 }}>
              <Icon name="arrow-left" style={{ width: 15, height: 15 }} /> Back to Portfolio
            </button>
          )}
          {eyebrow && <div className="fs-eyebrow" style={{ marginBottom: 8 }}>{eyebrow}</div>}
          <h1 style={{ margin: 0, fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 38, lineHeight: 1.1, letterSpacing: "-0.015em", color: "var(--fs-navy)" }}>{title}</h1>
          {sub && <p style={{ margin: "10px 0 0", maxWidth: 640, fontFamily: "var(--fs-font-sans)", fontSize: 15, color: "var(--fs-fg-muted)", lineHeight: 1.5 }}>{sub}</p>}
        </div>
        {actions && <div style={{ display: "flex", gap: 10, flexShrink: 0, alignItems: "center" }}>{actions}</div>}
      </div>
    </div>
  );
}

export function Kpi({ label, value, unit, foot, accent }) {
  return (
    <div style={{ padding: "20px 22px", background: "var(--fs-paper)", border: "1px solid var(--fs-border)", borderRadius: 4, borderTop: `3px solid ${accent ? "var(--fs-gold)" : "var(--fs-navy)"}` }}>
      <div style={{ fontFamily: "var(--fs-font-sans)", fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--fs-fg-subtle)" }}>{label}</div>
      <div style={{ marginTop: 12, display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 42, lineHeight: 1, color: "var(--fs-navy)" }}>{value}</span>
        {unit && <span style={{ fontFamily: "var(--fs-font-sans)", fontSize: 15, color: "var(--fs-fg-muted)", fontWeight: 600 }}>{unit}</span>}
      </div>
      {foot && <div style={{ marginTop: 10, fontFamily: "var(--fs-font-sans)", fontSize: 12.5, color: "var(--fs-fg-muted)" }}>{foot}</div>}
    </div>
  );
}

export function Chip({ children, tone = "bone" }) {
  const tones = {
    bone: { bg: "var(--fs-bone-200)", fg: "var(--fs-navy)", bd: "transparent" },
    soft: { bg: "var(--fs-navy-50)", fg: "var(--fs-navy)", bd: "transparent" },
    outline: { bg: "transparent", fg: "var(--fs-navy)", bd: "var(--fs-border-strong)" },
    navy: { bg: "var(--fs-navy)", fg: "#fff", bd: "transparent" },
  }[tone];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999,
      background: tones.bg, color: tones.fg, border: `1px solid ${tones.bd}`,
      fontFamily: "var(--fs-font-sans)", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
    }}>{children}</span>
  );
}

export function MetaRow({ items }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontFamily: "var(--fs-font-sans)", fontSize: 13.5, color: "var(--fs-fg-muted)" }}>
      {items.filter(Boolean).map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span style={{ color: "var(--fs-fg-subtle)" }}>·</span>}
          <span>{it}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

export function TrendChart({ polls, threshold, height = 220, dark = false }) {
  if (!polls || polls.length === 0) return null;
  const W = 720, H = height, padL = 40, padR = 16, padT = 16, padB = 34;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const yMin = 0, yMax = 80;
  const x = (i) => padL + (polls.length === 1 ? innerW / 2 : (i / (polls.length - 1)) * innerW);
  const y = (v) => padT + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  const series = [
    { key: "support", color: dark ? "#5CC394" : "#2F6B4F", label: "Support" },
    { key: "oppose", color: dark ? "#EA7458" : "#A8341E", label: "Oppose" },
    { key: "undecided", color: dark ? "rgba(255,255,255,0.5)" : "var(--fs-ink-300)", label: "Undecided", dash: "4 4" },
  ];
  const line = (k) => polls.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(" ");
  const grid = dark ? "rgba(255,255,255,0.10)" : "var(--fs-border)";
  const axisText = dark ? "rgba(255,255,255,0.55)" : "var(--fs-fg-subtle)";
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {[0, 20, 40, 60, 80].map((g) => (
          <g key={g}>
            <line x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} stroke={grid} strokeWidth="1" />
            <text x={padL - 8} y={y(g) + 4} textAnchor="end" fontFamily="var(--fs-font-sans)" fontSize="11" fill={axisText}>{g}</text>
          </g>
        ))}
        <line x1={padL} x2={W - padR} y1={y(threshold.value)} y2={y(threshold.value)} stroke={dark ? "var(--fs-gold)" : "var(--fs-navy-800)"} strokeWidth="1.5" strokeDasharray="6 4" />
        <text x={W - padR} y={y(threshold.value) - 6} textAnchor="end" fontFamily="var(--fs-font-sans)" fontSize="11" fontWeight="700" fill={dark ? "var(--fs-gold-300)" : "var(--fs-navy-800)"}>{threshold.short} threshold</text>
        {series.map((s) => (
          <g key={s.key}>
            <path d={line(s.key)} fill="none" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dash || ""} strokeLinejoin="round" />
            {polls.map((p, i) => <circle key={i} cx={x(i)} cy={y(p[s.key])} r="3.5" fill={s.color} />)}
          </g>
        ))}
        {polls.map((p, i) => (
          <text key={i} x={x(i)} y={H - 12} textAnchor="middle" fontFamily="var(--fs-font-sans)" fontSize="11" fill={axisText}>{fmtDate(p.date)}</text>
        ))}
      </svg>
      <div style={{ display: "flex", gap: 18, marginTop: 6, flexWrap: "wrap" }}>
        {series.map((s) => (
          <span key={s.key} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "var(--fs-font-sans)", fontSize: 12.5, color: dark ? "rgba(255,255,255,0.8)" : "var(--fs-fg-muted)" }}>
            <span style={{ width: 14, height: 3, background: s.color, borderRadius: 2 }} />{s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function EmptyState({ icon = "search-x", title, body, action }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 24px", textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: 999, background: "var(--fs-navy-50)", display: "grid", placeItems: "center", marginBottom: 18 }}>
        <Icon name={icon} style={{ width: 26, height: 26, color: "var(--fs-navy-500)" }} />
      </div>
      <h3 style={{ margin: 0, fontFamily: "var(--fs-font-display)", fontSize: 24, fontWeight: 700, color: "var(--fs-navy)" }}>{title}</h3>
      {body && <p style={{ margin: "10px 0 0", maxWidth: 380, fontFamily: "var(--fs-font-sans)", fontSize: 14.5, color: "var(--fs-fg-muted)", lineHeight: 1.5 }}>{body}</p>}
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  );
}

export function Btn({ children, kind = "secondary", icon, onClick, sm }) {
  const base = {
    display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer",
    fontFamily: "var(--fs-font-sans)", fontWeight: 600, letterSpacing: "0.02em",
    fontSize: sm ? 13 : 14, padding: sm ? "8px 14px" : "11px 18px", borderRadius: 4,
    border: "1px solid transparent", transition: "background 160ms, color 160ms",
  };
  const kinds = {
    primary: { background: "var(--fs-navy)", color: "#fff" },
    secondary: { background: "transparent", color: "var(--fs-navy)", borderColor: "var(--fs-border-strong)" },
    accent: { background: "var(--fs-gold)", color: "var(--fs-ink)" },
    ghost: { background: "transparent", color: "var(--fs-navy)", padding: 0 },
  };
  return (
    <button type="button" className={`btn-${kind}`} onClick={onClick} style={{ ...base, ...kinds[kind] }}>
      {icon && <Icon name={icon} style={{ width: sm ? 15 : 16, height: sm ? 15 : 16 }} />}
      {children}
    </button>
  );
}

export function Panel({ title, children, right }) {
  return (
    <div style={{ background: "var(--fs-paper)", border: "1px solid var(--fs-border)", borderRadius: 4, padding: "24px 26px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h3 style={{ margin: 0, fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 21, color: "var(--fs-navy)" }}>{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}
