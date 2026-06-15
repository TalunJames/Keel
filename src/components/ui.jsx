import React, { useState, useEffect, useMemo, useRef } from "react";

// ============================================================
// Icons — tiny inline SVG set, 1.75 stroke (Lucide-ish vibe)
// We inline our own so the prototype works offline / no flash.
// ============================================================
const Icon = ({ name, size = 18, stroke = 1.75, style = {}, color = "currentColor" }) => {
  const s = { width: size, height: size, color, ...style };
  const c = { fill: "none", stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "home":     return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M3 11l9-8 9 8"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/></svg>;
    case "pen":      return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M14 4l6 6-11 11H3v-6L14 4z"/><path d="M13 5l6 6"/></svg>;
    case "vote":     return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M3 21h18"/><path d="M5 21V8l7-4 7 4v13"/><path d="M9 21v-6h6v6"/><path d="M12 10v3"/></svg>;
    case "users":    return <svg style={s} viewBox="0 0 24 24" {...c}><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14c2.5 0 5 1.5 5 4"/></svg>;
    case "book":     return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5v-17z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/></svg>;
    case "compass":  return <svg style={s} viewBox="0 0 24 24" {...c}><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 6-6 2 2-6 6-2z"/></svg>;
    case "search":   return <svg style={s} viewBox="0 0 24 24" {...c}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>;
    case "bell":     return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2H4.5L6 16z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>;
    case "settings": return <svg style={s} viewBox="0 0 24 24" {...c}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4.6 15a1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9 4.6 1.6 1.6 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8 1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>;
    case "chevron-down": return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M6 9l6 6 6-6"/></svg>;
    case "chevron-up": return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M6 15l6-6 6 6"/></svg>;
    case "chevron-right": return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M9 6l6 6-6 6"/></svg>;
    case "chevron-left": return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M15 6l-6 6 6 6"/></svg>;
    case "arrow-right": return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M5 12h14"/><path d="M13 5l7 7-7 7"/></svg>;
    case "plus":     return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M12 5v14M5 12h14"/></svg>;
    case "check":    return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M4 12l5 5L20 6"/></svg>;
    case "x":        return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M18 6L6 18M6 6l12 12"/></svg>;
    case "upload":   return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M4 17v3h16v-3"/><path d="M12 15V3"/><path d="M7 8l5-5 5 5"/></svg>;
    case "download": return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M4 17v3h16v-3"/><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/></svg>;
    case "filter":   return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M3 5h18l-7 9v6l-4-2v-4L3 5z"/></svg>;
    case "calendar": return <svg style={s} viewBox="0 0 24 24" {...c}><rect x="3" y="5" width="18" height="16" rx="1.5"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>;
    case "map":      return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>;
    case "external": return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>;
    case "comment":  return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z"/></svg>;
    case "folder":   return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>;
    case "image":    return <svg style={s} viewBox="0 0 24 24" {...c}><rect x="3" y="3" width="18" height="18" rx="1.5"/><circle cx="8.5" cy="9" r="1.5"/><path d="M21 17l-6-6-9 9"/></svg>;
    case "circle-check": return <svg style={s} viewBox="0 0 24 24" {...c}><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>;
    case "circle":   return <svg style={s} viewBox="0 0 24 24" {...c}><circle cx="12" cy="12" r="9"/></svg>;
    case "dot":      return <svg style={s} viewBox="0 0 24 24" {...c}><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>;
    case "tv":       return <svg style={s} viewBox="0 0 24 24" {...c}><rect x="3" y="5" width="18" height="13" rx="1.5"/><path d="M8 21h8"/></svg>;
    case "flag":     return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M5 21V4"/><path d="M5 4h12l-2 4 2 4H5"/></svg>;
    case "alert":    return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18v.5"/></svg>;
    case "lock":     return <svg style={s} viewBox="0 0 24 24" {...c}><rect x="4" y="11" width="16" height="10" rx="1.5"/><path d="M8 11V7a4 4 0 1 1 8 0v4"/></svg>;
    case "menu":     return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M4 6h16M4 12h16M4 18h16"/></svg>;
    case "more":     return <svg style={s} viewBox="0 0 24 24" {...c}><circle cx="6" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="18" cy="12" r="1.4" fill="currentColor"/></svg>;
    case "pin":      return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1 3-6z"/></svg>;
    case "trend-up": return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>;
    case "loading":  return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>;
    case "logout":   return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M14 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-2"/><path d="M9 12h12"/><path d="M17 8l4 4-4 4"/></svg>;
    case "sun":      return <svg style={s} viewBox="0 0 24 24" {...c}><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4"/></svg>;
    case "moon":     return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>;
    case "stakeholders": return <svg style={s} viewBox="0 0 24 24" {...c}><circle cx="9" cy="7" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 21c0-3.5 3-6 7-6s7 2.5 7 6"/><path d="M15 16c3 0 6 1.5 6 4"/></svg>;
    case "newspaper":return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M4 4h14v16H4z"/><path d="M18 8h2v10a2 2 0 0 1-2 2"/><path d="M7 8h8M7 12h8M7 16h5"/></svg>;
    case "grip":     return <svg style={s} viewBox="0 0 24 24" {...c}><circle cx="9" cy="6" r="1.4" fill="currentColor"/><circle cx="15" cy="6" r="1.4" fill="currentColor"/><circle cx="9" cy="12" r="1.4" fill="currentColor"/><circle cx="15" cy="12" r="1.4" fill="currentColor"/><circle cx="9" cy="18" r="1.4" fill="currentColor"/><circle cx="15" cy="18" r="1.4" fill="currentColor"/></svg>;
    case "layout":   return <svg style={s} viewBox="0 0 24 24" {...c}><rect x="3" y="3" width="18" height="18" rx="1.5"/><path d="M3 9h18M9 9v12"/></svg>;
    case "play":     return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M6 4v16l14-8L6 4z"/></svg>;
    case "pause":    return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M7 5h3v14H7zM14 5h3v14h-3z"/></svg>;
    case "clock":    return <svg style={s} viewBox="0 0 24 24" {...c}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>;
    case "eye":      return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="2.5"/></svg>;
    case "rotate-ccw": return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>;
    case "key":      return <svg style={s} viewBox="0 0 24 24" {...c}><circle cx="8" cy="15" r="5"/><path d="M11.5 11.5L21 2"/><path d="M18 5l3 3"/><path d="M15 8l3 3"/></svg>;
    case "shield":   return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z"/></svg>;
    case "lighthouse": return <svg style={s} viewBox="0 0 24 24" {...c}><path d="M12 3l-1.5 3h3L12 3z"/><path d="M11 6h2v3h-2z"/><path d="M9 9h6l-1 12h-4L9 9z"/><path d="M5 12l4-1M19 12l-4-1M6 15l3 0M18 15l-3 0"/></svg>;
    default: return null;
  }
};

// ============================================================
// Avatar — initial badge with hash-derived hue
// ============================================================
function Avatar({ name = "?", size = 32, tone = "auto" }) {
  const initials = name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  // pick from a tight palette of brand-friendly tones
  const palette = [
    { bg: "var(--fs-navy)",      fg: "var(--fs-paper)" },
    { bg: "var(--fs-gold)",      fg: "var(--fs-navy-900)" },
    { bg: "var(--fs-navy-600)",  fg: "var(--fs-paper)" },
    { bg: "var(--fs-bone)",      fg: "var(--fs-navy)" },
    { bg: "var(--fs-navy-100)",  fg: "var(--fs-navy-900)" },
  ];
  const p = tone === "auto" ? palette[hash % palette.length] : palette[0];
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: p.bg, color: p.fg,
      display: "grid", placeItems: "center",
      fontWeight: 700, fontSize: Math.max(10, size * 0.38),
      flexShrink: 0,
      letterSpacing: 0,
    }}>{initials}</div>
  );
}

// ============================================================
// Small UI helpers
// ============================================================
function Stat({ figure, label, delta, deltaTone, gold }) {
  return (
    <div className="stat">
      <div className={"figure" + (gold ? " gold" : "")}>{figure}</div>
      <div className="label">{label}</div>
      {delta && <div className={"delta " + (deltaTone || "")}>{delta}</div>}
    </div>
  );
}

function Eyebrow({ children }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 10,
      fontSize: 11, fontWeight: 600,
      textTransform: "uppercase", letterSpacing: "var(--fs-tracking-caps)",
      color: "var(--fs-gold-700)",
    }}>
      <span style={{ width: 24, height: 2, background: "var(--fs-gold)" }} />
      {children}
    </div>
  );
}

function PageHead({ eyebrow, title, sub, actions }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="h-title">{title}</h1>
        {sub && <p className="h-sub">{sub}</p>}
      </div>
      {actions && <div className="row" style={{ gap: 8 }}>{actions}</div>}
    </div>
  );
}

function Tag({ tone, children, dot }) {
  return (
    <span className={"tag " + (tone || "")}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", opacity: 0.9 }} />}
      {children}
    </span>
  );
}

export { Icon, Avatar, Stat, Eyebrow, PageHead, Tag };
