import React, { useState, useEffect, useCallback } from "react";
import { electionCollectorApi } from "../lib/api.js";

const eyebrowStyle = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "var(--fs-tracking-caps)",
  color: "var(--fs-fg-accent)",
  marginBottom: 10,
  marginTop: 8,
};

const btnStyle = {
  fontSize: 12,
  fontWeight: 600,
  padding: "8px 12px",
  borderRadius: "var(--fs-radius-md)",
  border: "1px solid var(--fs-border)",
  background: "var(--fs-paper)",
  color: "var(--fs-navy)",
  cursor: "pointer",
};

const btnPrimary = {
  ...btnStyle,
  background: "var(--fs-navy)",
  color: "#fff",
  borderColor: "var(--fs-navy)",
};

function Toggle({ label, value, onChange, hint }) {
  return (
    <div className="settings-row">
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)" }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: "var(--fs-fg-subtle)", marginTop: 2 }}>{hint}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        style={{
          width: 44, height: 24, borderRadius: 999, border: "none", cursor: "pointer",
          background: value ? "var(--fs-navy)" : "var(--fs-bone-200)",
          position: "relative", flexShrink: 0,
        }}
      >
        <span style={{
          position: "absolute", top: 3, left: value ? 23 : 3, width: 18, height: 18,
          borderRadius: 999, background: "#fff", transition: "left 150ms",
        }} />
      </button>
    </div>
  );
}

export function ElectionCollectorPanel({ open, onClose, onCollectorChange }) {
  const [status, setStatus] = useState(null);
  const [eid, setEid] = useState("");
  const [enforcePollsClose, setEnforcePollsClose] = useState(false);
  const [autoStart, setAutoStart] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [discovered, setDiscovered] = useState([]);

  const refresh = useCallback(() => {
    electionCollectorApi.status()
      .then((s) => {
        setStatus(s);
        if (s?.config) {
          setEid(s.config.eid || "");
          setEnforcePollsClose(!!s.config.enforcePollsClose);
          setAutoStart(!!s.config.autoStart);
        }
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    refresh();
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const run = async (label, fn) => {
    setBusy(label);
    setError(null);
    try {
      const result = await fn();
      if (result?.eids) setDiscovered(result.eids);
      refresh();
      onCollectorChange?.();
      return result;
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
    return null;
  };

  const saveConfig = () => run("save", () =>
    electionCollectorApi.updateConfig({
      eid,
      enforcePollsClose,
      autoStart,
    }));

  if (!open) return null;

  const running = status?.supervisor?.status === "running";
  const hb = status?.db?.heartbeat;
  const contests = status?.db?.contestCount ?? 0;

  return (
    <>
      <div className="settings-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="settings-panel" role="dialog" aria-label="ENR collector">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid var(--fs-border)", flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: "var(--fs-font-display)", fontSize: 18, fontWeight: 700, color: "var(--fs-navy)" }}>ENR Collector</div>
            <div style={{ fontSize: 11, color: "var(--fs-fg-subtle)", marginTop: 2 }}>El Paso County live results — runs inside Keel</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ background: "none", border: "none", fontSize: 22, lineHeight: 1, color: "var(--fs-ink-400)", cursor: "pointer" }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 18px 18px" }}>
          <div style={{
            padding: 12, borderRadius: "var(--fs-radius-md)", marginBottom: 12,
            background: running ? "rgba(47,107,79,0.08)" : "var(--fs-bone-100)",
            border: `1px solid ${running ? "rgba(47,107,79,0.35)" : "var(--fs-border)"}`,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: running ? "var(--fs-success, #2F6B4F)" : "var(--fs-ink-500)" }}>
              {running ? "Polling El Paso ENR" : "Collector stopped"}
              {status?.supervisor?.pid ? ` · pid ${status.supervisor.pid}` : ""}
            </div>
            {hb && (
              <div style={{ fontSize: 11, color: "var(--fs-fg-muted)", marginTop: 6, lineHeight: 1.45 }}>
                Version <b>{hb.last_version}</b> · {hb.last_update_at}
                <br />{hb.note} · {contests} contests in DB
              </div>
            )}
            {status?.autoEid?.enabled && (
              <div style={{ fontSize: 11, color: "var(--fs-fg-muted)", marginTop: 8, lineHeight: 1.45 }}>
                Auto-EID {status.autoEid.windowActive ? "watching" : "scheduled"} ·{" "}
                {status.autoEid.primaryFeedReady
                  ? "primary feed connected"
                  : "waiting for Governor contests in ENR"}
              </div>
            )}
            {!hb && (
              <div style={{ fontSize: 11, color: "var(--fs-fg-muted)", marginTop: 6 }}>
                No heartbeat yet — start the collector or run Fetch once.
              </div>
            )}
          </div>

          {error && (
            <div style={{ fontSize: 12, color: "var(--fs-danger)", marginBottom: 12, padding: 10, background: "rgba(168,52,30,0.08)", borderRadius: "var(--fs-radius-md)" }}>
              {error}
            </div>
          )}

          <div style={eyebrowStyle}>Election ID (EID)</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <input
              value={eid}
              onChange={(e) => setEid(e.target.value)}
              placeholder="124432"
              style={{
                flex: 1, minWidth: 120, fontSize: 13, padding: "8px 10px",
                border: "1px solid var(--fs-border)", borderRadius: "var(--fs-radius-md)",
              }}
            />
            <button type="button" style={btnStyle} disabled={!!busy}
              onClick={() => run("discover", () => electionCollectorApi.discover())}>
              {busy === "discover" ? "…" : "Discover"}
            </button>
            <button type="button" style={btnStyle} disabled={!!busy} onClick={saveConfig}>
              {busy === "save" ? "…" : "Save"}
            </button>
          </div>
          {discovered.length > 0 && (
            <div style={{ fontSize: 11, color: "var(--fs-fg-muted)", marginBottom: 12 }}>
              County index: {discovered.map((id) => (
                <button key={id} type="button" onClick={() => setEid(id)}
                  style={{ marginRight: 6, marginTop: 4, padding: "2px 8px", fontSize: 11, borderRadius: 999, border: "1px solid var(--fs-border)", background: id === eid ? "var(--fs-navy)" : "var(--fs-paper)", color: id === eid ? "#fff" : "var(--fs-navy)", cursor: "pointer" }}>
                  {id}
                </button>
              ))}
            </div>
          )}

          <Toggle label="Enforce polls close" value={enforcePollsClose} onChange={setEnforcePollsClose}
            hint="Reject pre-close test batches on election night" />
          <Toggle label="Auto-start on boot" value={autoStart} onChange={setAutoStart}
            hint="Start collector when Keel starts (Docker)" />

          <div style={eyebrowStyle}>Actions</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {!running ? (
              <button type="button" style={btnPrimary} disabled={!!busy}
                onClick={() => run("start", () => electionCollectorApi.start({ eid, enforcePollsClose, autoStart }))}>
                {busy === "start" ? "Starting…" : "Start polling"}
              </button>
            ) : (
              <button type="button" style={btnStyle} disabled={!!busy}
                onClick={() => run("stop", () => electionCollectorApi.stop())}>
                {busy === "stop" ? "…" : "Stop"}
              </button>
            )}
            <button type="button" style={btnStyle} disabled={!!busy}
              onClick={() => run("once", () => electionCollectorApi.once({ eid, enforcePollsClose }))}>
              {busy === "once" ? "Fetching…" : "Fetch once"}
            </button>
            <button type="button" style={btnStyle} disabled={!!busy}
              onClick={() => run("test", () => electionCollectorApi.test({ eid }))}>
              {busy === "test" ? "Testing…" : "Test feed"}
            </button>
          </div>

          {status?.supervisor?.log?.length > 0 && (
            <>
              <div style={eyebrowStyle}>Recent log</div>
              <pre style={{
                fontSize: 10, lineHeight: 1.45, padding: 10, margin: 0,
                background: "var(--fs-bone-50)", border: "1px solid var(--fs-border)",
                borderRadius: "var(--fs-radius-md)", overflow: "auto", maxHeight: 160,
                color: "var(--fs-fg-muted)", whiteSpace: "pre-wrap",
              }}>
                {status.supervisor.log.join("\n")}
              </pre>
            </>
          )}

          <div style={{ fontSize: 10, color: "var(--fs-ink-400)", marginTop: 14, lineHeight: 1.5 }}>
            DB: {status?.config?.dbPath || "data/election/results.db"}
            <br />Auto-EID polls Clarity every 5 min on election weekend and switches when Governor races appear.
            <br />Enable Auto-start on boot to poll continuously once the primary feed is live.
          </div>
        </div>
      </aside>
    </>
  );
}
