import React from "react";
import { Icon } from "../components/ui.jsx";

export const STATUS = {
  pass: { key: "pass", label: "Likely Pass", short: "Lean Pass", icon: "check", color: "#2F6B4F", colorDark: "#5CC394", soft: "rgba(47,107,79,0.10)", softDark: "rgba(92,195,148,0.16)" },
  watch: { key: "watch", label: "Too Close", short: "Watch", icon: "alert", color: "#B0741A", colorDark: "#F0B23E", soft: "rgba(176,116,26,0.12)", softDark: "rgba(240,178,62,0.16)" },
  fail: { key: "fail", label: "Likely Fail", short: "Lean Fail", icon: "x", color: "#A8341E", colorDark: "#EA7458", soft: "rgba(168,52,30,0.10)", softDark: "rgba(234,116,88,0.16)" },
};

export function statusFor(yesPct, thresholdValue, band) {
  const diff = yesPct - thresholdValue;
  if (diff >= band) return "pass";
  if (diff <= -band) return "fail";
  return "watch";
}

function distanceLabel(yesPct, thresholdValue) {
  const diff = yesPct - thresholdValue;
  const v = Math.abs(diff).toFixed(1);
  return diff >= 0 ? `+${v} above line` : `${v} below line`;
}

function StatusPill({ sKey, st, label, dark, compact, big }) {
  const color = dark ? st.colorDark : st.color;
  const soft = dark ? st.softDark : st.soft;
  const text = label || st.label;
  const sz = big ? 14 : compact ? 11 : 12;
  const pad = big ? "7px 14px" : compact ? "3px 8px" : "4px 10px";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: pad,
      background: soft, color, borderRadius: 999, fontFamily: "var(--fs-font-sans)",
      fontSize: sz, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
      lineHeight: 1, border: `1px solid ${color}33`,
    }}>
      <Icon name={st.icon} size={big ? 16 : 13} />
      {text}
    </span>
  );
}

export function ThresholdGauge({
  yesPct,
  threshold,
  band = 2,
  size = "md",
  theme = "light",
  statusOverride = null,
  labelOverride = null,
  animate = false,
  hideStatusPill = false,
}) {
  const dark = theme === "dark";
  const sKey = statusOverride || statusFor(yesPct, threshold.value, band);
  const st = STATUS[sKey];
  const fillColor = dark ? st.colorDark : st.color;
  const yes = Math.max(0, Math.min(100, yesPct));
  const thr = Math.max(0, Math.min(100, threshold.value));

  const cfg = {
    sm: { h: 9, radius: 2, marker: 2, showAxis: false, showFlag: false },
    md: { h: 16, radius: 2, marker: 2, showAxis: true, showFlag: true },
    lg: { h: 40, radius: 3, marker: 3, showAxis: true, showFlag: true },
  }[size];

  const trackBg = dark ? "rgba(255,255,255,0.10)" : "var(--fs-navy-50)";
  const trackBorder = dark ? "1px solid rgba(255,255,255,0.12)" : "1px solid var(--fs-border)";
  const axisColor = dark ? "rgba(255,255,255,0.55)" : "var(--fs-fg-subtle)";
  const thrColor = dark ? "var(--fs-gold)" : "var(--fs-navy-800)";
  const thrTextColor = dark ? "var(--fs-gold-300)" : "var(--fs-navy-800)";
  const transition = animate ? "width 900ms cubic-bezier(.2,.6,.2,1), background 400ms" : "none";

  return (
    <div className="gauge" data-mock="true" style={{ width: "100%" }}>
      {size === "lg" && (
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 64, lineHeight: 1, color: dark ? "#fff" : "var(--fs-ink)" }}>
              {yes.toFixed(1)}<span style={{ fontSize: 30, opacity: 0.6 }}>%</span>
            </span>
            <span style={{ fontFamily: "var(--fs-font-sans)", fontSize: 14, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: dark ? "rgba(255,255,255,0.7)" : "var(--fs-fg-muted)" }}>Yes</span>
          </div>
          <StatusPill sKey={sKey} st={st} label={labelOverride} dark={dark} big />
        </div>
      )}

      <div style={{ position: "relative", height: cfg.h, marginBottom: cfg.showFlag ? 22 : (size === "sm" ? 0 : 8) }}>
        <div style={{
          position: "absolute", inset: 0, background: trackBg, border: trackBorder,
          borderRadius: cfg.radius, overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0, width: `${yes}%`,
            background: fillColor, transition, borderRadius: `${cfg.radius}px 0 0 ${cfg.radius}px`,
          }} />
        </div>
        <div style={{ position: "absolute", top: -3, bottom: -3, left: `${thr}%`, width: cfg.marker, marginLeft: -cfg.marker / 2, background: thrColor, zIndex: 3 }} />
        <div style={{
          position: "absolute", top: -8, left: `${thr}%`, marginLeft: -4,
          width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent",
          borderTop: `5px solid ${thrColor}`, zIndex: 3,
        }} />
        {cfg.showFlag && (
          <div style={{
            position: "absolute", top: cfg.h + 6, left: `${thr}%`,
            transform: thr > 75 ? "translateX(-100%)" : "translateX(-50%)",
            whiteSpace: "nowrap", fontFamily: "var(--fs-font-sans)", fontSize: size === "lg" ? 13 : 11,
            fontWeight: 600, color: thrTextColor, letterSpacing: "0.02em",
          }}>
            {threshold.short} needed · {threshold.label}
          </div>
        )}
      </div>

      {(size === "md" || size === "lg") && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: size === "lg" ? 6 : 2 }}>
          <div style={{ display: "flex", gap: size === "lg" ? 4 : 3, alignItems: "center" }}>
            {size !== "lg" && !hideStatusPill && <StatusPill sKey={sKey} st={st} label={labelOverride} dark={dark} />}
            {size === "lg" && (
              <span style={{ fontFamily: "var(--fs-font-sans)", fontSize: 12, color: axisColor }}>0%</span>
            )}
          </div>
          <span style={{
            fontFamily: "var(--fs-font-sans)", fontSize: size === "lg" ? 16 : 13, fontWeight: 700,
            color: fillColor, letterSpacing: "0.01em",
          }}>
            {distanceLabel(yes, threshold.value)}
          </span>
          {size === "lg" && <span style={{ fontFamily: "var(--fs-font-sans)", fontSize: 12, color: axisColor }}>100%</span>}
        </div>
      )}

      {size === "sm" && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 7 }}>
          <StatusPill sKey={sKey} st={st} label={labelOverride} dark={dark} compact />
          <span style={{ fontFamily: "var(--fs-font-sans)", fontSize: 12, fontWeight: 700, color: fillColor }}>
            {distanceLabel(yes, threshold.value)}
          </span>
        </div>
      )}
    </div>
  );
}
