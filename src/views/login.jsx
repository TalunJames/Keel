import React, { useEffect, useState } from "react";
import { Icon, Eyebrow } from "../components/ui.jsx";
import { authApi, loginAnnouncementApi, ApiError } from "../lib/api.js";

const TONE_STYLES = {
  info:    { bg: "rgba(168,194,221,0.12)", bd: "rgba(168,194,221,0.30)", ic: "var(--fs-navy-700)" },
  warning: { bg: "rgba(244,215,122,0.18)", bd: "rgba(244,215,122,0.42)", ic: "var(--fs-gold-500)" },
  success: { bg: "rgba(102,184,124,0.18)", bd: "rgba(102,184,124,0.36)", ic: "#7BC78A" },
};

export function LoginView({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(() => localStorage.getItem("keel_remember") === "1");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [announcement, setAnnouncement] = useState(null);

  useEffect(() => {
    loginAnnouncementApi.get()
      .then((r) => setAnnouncement(r?.announcement || null))
      .catch(() => setAnnouncement(null));
  }, []);

  const submit = async (e) => {
    e?.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { user } = await authApi.login(email.trim(), password, remember);
      localStorage.setItem("keel_remember", remember ? "1" : "0");
      try {
        const { user: verified } = await authApi.me();
        onLogin(verified);
      } catch {
        onLogin(user);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError(err.message + " Refresh the page to open the setup screen.");
      } else {
        setError(err instanceof ApiError ? err.message : "Sign in failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const tone = TONE_STYLES[announcement?.tone] || TONE_STYLES.info;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", height: "100vh", width: "100vw", background: "var(--fs-paper)" }}>
      <div style={{
        background: "var(--ks-ink-surface)", color: "var(--ks-on-ink)",
        padding: "56px 64px", display: "flex", flexDirection: "column", justifyContent: "space-between",
        position: "relative", overflow: "hidden",
      }}>
        <svg width="900" height="900" viewBox="0 0 900 900" style={{ position: "absolute", right: -260, top: -180, opacity: 0.1, pointerEvents: "none" }}>
          <g fill="none" stroke="var(--fs-gold)" strokeWidth="1.2">
            <path d="M450 450 L900 200"/><path d="M450 450 L900 450"/><path d="M450 450 L900 700"/>
            <circle cx="450" cy="450" r="120"/><circle cx="450" cy="450" r="220"/><circle cx="450" cy="450" r="340"/>
          </g>
        </svg>
        <div style={{ position: "relative" }}>
          <img src="/logo-wordmark-white.png" alt="Fog Signal Strategies"
            style={{ height: 56, width: "auto", display: "block" }} />
        </div>
        <div style={{ position: "relative", maxWidth: 480 }}>
          <Eyebrow>Sign in</Eyebrow>
          <h1 style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 48, lineHeight: 1.1, color: "var(--ks-on-ink)", margin: "16px 0 18px" }}>
            A steady signal<br />through noisy weeks.
          </h1>
          <p style={{ color: "rgba(255,255,255,0.72)", fontSize: 16, lineHeight: 1.6, margin: 0 }}>
            Keel is the internal portal for Fog Signal staff and retained clients — design jobs, election night, the voter file, and everything in between.
          </p>
        </div>
        <div style={{ position: "relative", fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
          © Fog Signal Strategies · {new Date().getFullYear()}
        </div>
      </div>

      <div style={{ padding: "80px 72px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <form onSubmit={submit} style={{ maxWidth: 380, width: "100%", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "var(--fs-font-display)", fontSize: 30, fontWeight: 700, color: "var(--fs-navy)", margin: "0 0 8px" }}>Sign in to Keel</h2>
          <p style={{ color: "var(--fs-fg-muted)", margin: "0 0 24px", fontSize: 14 }}>
            Use your Fog Signal email or client portal credentials issued by your strategist.
          </p>

          {announcement?.enabled && (announcement.title || announcement.body) && (
            <div className="login-announce"
              style={{
                marginBottom: 20, padding: "12px 14px",
                background: tone.bg, border: `1px solid ${tone.bd}`,
                borderRadius: 6, display: "flex", gap: 10, alignItems: "flex-start",
              }}>
              <Icon name={announcement.tone === "warning" ? "alert" : "pin"} size={14} color={tone.ic} style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--fs-fg)" }}>
                {announcement.title && <div style={{ fontWeight: 600, color: "var(--fs-navy)" }}>{announcement.title}</div>}
                {announcement.body && <div style={{ color: "var(--fs-fg-muted)", marginTop: 2 }}>{announcement.body}</div>}
              </div>
            </div>
          )}

          {error && (
            <div style={{ marginBottom: 16, padding: "10px 12px", background: "#fde8e4", border: "1px solid #e8b4ab", borderRadius: 4, fontSize: 13, color: "#7a2210" }}>
              {error}
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" autoComplete="username" required
              placeholder="name@fogsignal.co" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" className="input" type="password" autoComplete="current-password" required
              placeholder="••••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <label style={{
            display: "flex", alignItems: "center", gap: 8, margin: "4px 0 14px",
            fontSize: 13, color: "var(--fs-fg-muted)", cursor: "pointer", userSelect: "none",
          }}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
              style={{ accentColor: "var(--fs-navy)" }} />
            Remember me for 30 days
          </label>
          <button type="submit" className="btn primary" disabled={loading}
            style={{ width: "100%", padding: "12px 14px", justifyContent: "center", fontSize: 14, marginTop: 4 }}>
            {loading ? "Signing in…" : <>Continue <Icon name="arrow-right" size={14} /></>}
          </button>
        </form>
      </div>
    </div>
  );
}
