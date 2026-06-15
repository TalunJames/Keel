import React, { useState, useEffect } from "react";
import { Icon } from "../components/ui.jsx";
import { ET } from "./data.js";
import { ThresholdGauge, statusFor } from "./gauge.jsx";
import { fmtDate } from "./fmt.js";

function liveFrame(m, progress) {
  const s = m.liveSeed;
  const reporting = Math.min(100, s.reporting + (100 - s.reporting) * progress);
  const yesPct = s.yesPctStart + (s.yesPctEnd - s.yesPctStart) * progress;
  const counted = Math.round(s.totalBallotsEst * (reporting / 100));
  const yesVotes = Math.round(counted * (yesPct / 100));
  const noVotes = counted - yesVotes;
  const outstanding = Math.max(0, s.totalBallotsEst - counted);
  const mail = Math.round(counted * s.mailShare);
  const eday = Math.round(counted * s.edayShare);
  const lateMail = Math.max(0, counted - mail - eday);
  return { reporting, yesPct, counted, yesVotes, noVotes, outstanding, modes: { mail, eday, lateMail } };
}

function autoCall(frame, m, band) {
  if (frame.reporting < 22) return { key: "early", label: "Too Early to Call" };
  const sKey = statusFor(frame.yesPct, m.threshold.value, band);
  if (frame.reporting >= 85) {
    if (sKey === "pass") return { key: "pass", label: "Projected · Passes" };
    if (sKey === "fail") return { key: "fail", label: "Projected · Fails" };
    return { key: "watch", label: "Too Close to Call" };
  }
  return { key: sKey, label: sKey === "pass" ? "Lean Yes" : sKey === "fail" ? "Lean No" : "Too Close" };
}

const CALL_TONE = {
  early: { color: "rgba(255,255,255,0.65)", bg: "rgba(255,255,255,0.08)", icon: "clock" },
  pass: { color: "#5CC394", bg: "rgba(92,195,148,0.16)", icon: "check" },
  watch: { color: "#F0B23E", bg: "rgba(240,178,62,0.16)", icon: "alert" },
  fail: { color: "#EA7458", bg: "rgba(234,116,88,0.16)", icon: "x" },
};

const OVERRIDES = [
  { key: "auto", label: "Auto" },
  { key: "pass", label: "Call Yes" },
  { key: "watch", label: "Too Close" },
  { key: "fail", label: "Call No" },
  { key: "early", label: "Hold" },
];

function useSim(speed, playing) {
  const [progress, setProgress] = useState(() => {
    const v = parseFloat(localStorage.getItem("keel_sim_progress"));
    return Number.isNaN(v) ? 0.18 : v;
  });
  useEffect(() => {
    localStorage.setItem("keel_sim_progress", String(progress));
  }, [progress]);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setProgress((p) => Math.min(1, p + 0.011 * speed));
    }, 700);
    return () => clearInterval(t);
  }, [playing, speed]);
  return [progress, setProgress];
}

function CallChip({ call, manual, big }) {
  const t = CALL_TONE[call.key];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: big ? "8px 16px" : "5px 11px", borderRadius: 999, background: t.bg, color: t.color, border: `1px solid ${t.color}40`, fontFamily: "var(--fs-font-sans)", fontSize: big ? 14 : 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", lineHeight: 1 }}>
      <Icon name={t.icon} size={big ? 16 : 13} />
      {call.label}
      {manual && <span style={{ fontSize: 9.5, opacity: 0.8, borderLeft: `1px solid ${t.color}55`, paddingLeft: 7, marginLeft: 2 }}>MANUAL</span>}
    </span>
  );
}

function BoardTile({ m, frame, band, overrideKey, isWatch, onFocus }) {
  const call = overrideKey && overrideKey !== "auto"
    ? { key: overrideKey, label: { pass: "Called Yes", fail: "Called No", watch: "Too Close", early: "On Hold" }[overrideKey] }
    : autoCall(frame, m, band);
  return (
    <button type="button" onClick={() => onFocus(m.id)} className="boardtile" style={{
      textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: 14,
      padding: "20px 22px", borderRadius: 6, border: `1px solid ${isWatch ? "rgba(240,178,62,0.55)" : "rgba(255,255,255,0.12)"}`,
      background: isWatch ? "rgba(240,178,62,0.06)" : "rgba(255,255,255,0.035)",
      boxShadow: isWatch ? "0 0 0 1px rgba(240,178,62,0.25)" : "none",
      animation: isWatch ? "etwatch 2.4s ease-in-out infinite" : "none",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "var(--fs-font-sans)", fontSize: 12, color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.client}</div>
          <div style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 18, color: "#fff", marginTop: 2, lineHeight: 1.15 }}>{m.code} · {m.jurisdiction.split(",")[1] ? m.jurisdiction.split(",")[0] : m.jurisdiction}</div>
        </div>
        {isWatch && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "var(--fs-font-sans)", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#F0B23E", textTransform: "uppercase" }}>
            <Icon name="eye" size={13} />Watch
          </span>
        )}
      </div>
      <ThresholdGauge yesPct={frame.yesPct} threshold={m.threshold} band={band} size="md" theme="dark" animate hideStatusPill />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
        <CallChip call={call} manual={overrideKey && overrideKey !== "auto"} />
        <span style={{ fontFamily: "var(--fs-font-sans)", fontSize: 12.5, color: "rgba(255,255,255,0.7)" }}>
          <strong style={{ color: "#fff" }}>{frame.reporting.toFixed(0)}%</strong> reporting
        </span>
      </div>
    </button>
  );
}

function VoteModeBar({ modes }) {
  const total = modes.mail + modes.eday + modes.lateMail || 1;
  const segs = [
    { k: "Mail", v: modes.mail, c: "#5CC394" },
    { k: "Election-Day", v: modes.eday, c: "#7FA8D4" },
    { k: "Late Mail", v: modes.lateMail, c: "#F0B23E" },
  ];
  return (
    <div>
      <div style={{ display: "flex", height: 22, borderRadius: 3, overflow: "hidden", border: "1px solid rgba(255,255,255,0.14)" }}>
        {segs.map((s) => <div key={s.k} style={{ width: `${(s.v / total) * 100}%`, background: s.c }} />)}
      </div>
      <div style={{ display: "flex", gap: 18, marginTop: 12, flexWrap: "wrap" }}>
        {segs.map((s) => (
          <div key={s.k}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: "var(--fs-font-sans)", fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: s.c }} />{s.k}
            </div>
            <div style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 20, color: "#fff", marginTop: 3 }}>{s.v.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const dchip = { fontFamily: "var(--fs-font-sans)", fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", color: "rgba(255,255,255,0.78)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 999, padding: "5px 12px" };
const dpanel = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, padding: "18px 20px" };
const dpanelTitle = { fontFamily: "var(--fs-font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 10 };
const enBtnStyle = { display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer", fontFamily: "var(--fs-font-sans)", fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.06)", color: "#fff" };

function DStat({ label, value, accent }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--fs-font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 28, color: accent, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function FocusView({ m, frame, band, overrideKey, setOverride, onBack }) {
  const call = overrideKey && overrideKey !== "auto"
    ? { key: overrideKey, label: { pass: "Called Yes", fail: "Called No", watch: "Too Close", early: "On Hold" }[overrideKey] }
    : autoCall(frame, m, band);
  const big = (n) => n.toLocaleString();
  return (
    <div style={{ padding: "24px 40px 40px", flex: 1 }}>
      <button type="button" onClick={onBack} className="linkbtn-d" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontFamily: "var(--fs-font-sans)", fontSize: 13.5, fontWeight: 600, padding: 0, marginBottom: 20 }}>
        <Icon name="chevron-left" size={16} /> All measures
      </button>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 40, alignItems: "start" }}>
        <div>
          <div style={{ fontFamily: "var(--fs-font-sans)", fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{m.client}</div>
          <h2 style={{ margin: "4px 0 0", fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 40, lineHeight: 1.05, color: "#fff" }}>{m.code} · {m.title}</h2>
          <div style={{ display: "flex", gap: 8, marginTop: 14, marginBottom: 30 }}>
            <span style={dchip}>{m.type}</span>
            <span style={dchip}>{m.amount}</span>
            <span style={dchip}>{m.jurisdiction}</span>
          </div>
          <ThresholdGauge yesPct={frame.yesPct} threshold={m.threshold} band={band} size="lg" theme="dark" animate />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18, marginTop: 34 }}>
            <DStat label="Yes votes" value={big(frame.yesVotes)} accent="#5CC394" />
            <DStat label="No votes" value={big(frame.noVotes)} accent="#EA7458" />
            <DStat label="Est. ballots outstanding" value={"~" + big(frame.outstanding)} accent="rgba(255,255,255,0.85)" />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={dpanel}>
            <div style={dpanelTitle}>Reporting</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 46, color: "#fff", lineHeight: 1 }}>{frame.reporting.toFixed(0)}<span style={{ fontSize: 24, opacity: 0.6 }}>%</span></span>
              <span style={{ fontFamily: "var(--fs-font-sans)", fontSize: 13, color: "rgba(255,255,255,0.6)" }}>of precincts</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.12)", marginTop: 12, overflow: "hidden" }}>
              <div style={{ width: `${frame.reporting}%`, height: "100%", background: "var(--fs-gold)", transition: "width 800ms cubic-bezier(.2,.6,.2,1)" }} />
            </div>
          </div>
          <div style={dpanel}>
            <div style={dpanelTitle}>Vote-mode breakout</div>
            <VoteModeBar modes={frame.modes} />
          </div>
          <div style={dpanel}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={dpanelTitle}>Call status</div>
              <CallChip call={call} manual={overrideKey && overrideKey !== "auto"} big />
            </div>
            <div style={{ fontFamily: "var(--fs-font-sans)", fontSize: 11.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 9 }}>Override the algorithm</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {OVERRIDES.map((o) => {
                const on = (overrideKey || "auto") === o.key;
                return (
                  <button key={o.key} type="button" onClick={() => setOverride(m.id, o.key)} style={{
                    cursor: "pointer", fontFamily: "var(--fs-font-sans)", fontSize: 12.5, fontWeight: 600,
                    padding: "8px 13px", borderRadius: 4, border: `1px solid ${on ? "var(--fs-gold)" : "rgba(255,255,255,0.2)"}`,
                    background: on ? "rgba(239,197,63,0.16)" : "transparent", color: on ? "var(--fs-gold-300)" : "rgba(255,255,255,0.8)",
                  }}>{o.label}</button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ElectionNightScreen({ band = 2, simSpeed = 1 }) {
  const active = ET.active();
  const [focusId, setFocusId] = useState(null);
  const [playing, setPlaying] = useState(true);
  const [overrides, setOverrides] = useState({});
  const [progress, setProgress] = useSim(simSpeed, playing);

  const setOverride = (id, key) => setOverrides((o) => ({ ...o, [id]: key }));

  const tiles = active.map((m) => {
    const frame = liveFrame(m, progress);
    const isWatch = Math.abs(frame.yesPct - m.threshold.value) <= band;
    return { m, frame, isWatch };
  }).sort((a, b) => (b.isWatch - a.isWatch) || (Math.abs(a.frame.yesPct - a.m.threshold.value) - Math.abs(b.frame.yesPct - b.m.threshold.value)));

  const watchCount = tiles.filter((t) => t.isWatch).length;
  const focusM = focusId ? ET.byId(focusId) : null;

  return (
    <div style={{ background: "var(--fs-navy-900)", minHeight: "100%", display: "flex", flexDirection: "column", color: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, padding: "20px 40px", borderBottom: "1px solid rgba(255,255,255,0.1)", background: "var(--fs-navy)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--fs-font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fs-gold)" }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: "#EA7458", animation: "etpulse 1.4s infinite" }} />Live
          </span>
          <h2 style={{ margin: 0, fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 26, color: "#fff" }}>Election Night · {fmtDate(ET.TODAY, { year: true })}</h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontFamily: "var(--fs-font-sans)", fontSize: 13.5, color: "rgba(255,255,255,0.7)" }}>
            {active.length} measures · <span style={{ color: "#F0B23E", fontWeight: 700 }}>{watchCount} on watch</span>
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setPlaying((p) => !p)} className="enbtn" style={enBtnStyle}>
              <Icon name={playing ? "pause" : "play"} size={15} />{playing ? "Pause" : "Resume"}
            </button>
            <button type="button" onClick={() => setProgress(0.05)} className="enbtn" style={enBtnStyle}>
              <Icon name="rotate-ccw" size={15} />Restart
            </button>
          </div>
        </div>
      </div>

      <div style={{ height: 3, background: "rgba(255,255,255,0.08)" }}>
        <div style={{ width: `${(progress * 100).toFixed(1)}%`, height: "100%", background: "var(--fs-gold)", transition: "width 700ms linear" }} />
      </div>

      {focusM ? (
        <FocusView
          m={focusM}
          frame={liveFrame(focusM, progress)}
          band={band}
          overrideKey={overrides[focusM.id]}
          setOverride={setOverride}
          onBack={() => setFocusId(null)}
        />
      ) : (
        <div style={{ padding: "28px 40px 40px", flex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 20 }}>
            {tiles.map(({ m, frame, isWatch }) => (
              <BoardTile
                key={m.id}
                m={m}
                frame={frame}
                band={band}
                overrideKey={overrides[m.id]}
                isWatch={isWatch}
                onFocus={setFocusId}
              />
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 40px", background: "rgba(176,116,26,0.16)", borderTop: "1px solid rgba(240,178,62,0.4)", backdropFilter: "blur(8px)" }}>
        <Icon name="alert" size={18} color="#F0B23E" />
        <span style={{ fontFamily: "var(--fs-font-sans)", fontSize: 13.5, color: "rgba(255,255,255,0.9)", lineHeight: 1.4 }}>
          All numbers are <strong>provisional and simulated</strong>. Late-mail ballots drift for days in WA, OR, and CA — early margins routinely move 1–3 points. Do not report a call off election-night totals alone.
        </span>
      </div>
    </div>
  );
}
