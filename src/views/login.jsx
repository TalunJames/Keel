import React, { useState } from "react";
import { Icon, Avatar, Eyebrow } from "../components/ui.jsx";
import { authApi, ApiError } from "../lib/api.js";

export function LoginView({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { user } = await authApi.login(email.trim(), password);
      onLogin(user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

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
        <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative" }}>
          <div style={{
            width: 56, height: 56, borderRadius: 4, background: "var(--fs-gold)",
            color: "var(--fs-navy-900)", display: "grid", placeItems: "center",
            fontWeight: 800, fontSize: 18,
          }}>FS</div>
          <div>
            <div style={{ fontFamily: "var(--fs-font-display)", fontSize: 28, fontWeight: 700, lineHeight: 1 }}>Keel</div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,0.55)", marginTop: 4 }}>Fog Signal Strategies</div>
          </div>
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
          <p style={{ color: "var(--fs-fg-muted)", margin: "0 0 32px", fontSize: 14 }}>
            Use your Fog Signal email or client portal credentials issued by your strategist.
          </p>
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
          <button type="submit" className="btn primary" disabled={loading}
            style={{ width: "100%", padding: "12px 14px", justifyContent: "center", fontSize: 14, marginTop: 8 }}>
            {loading ? "Signing in…" : <>Continue <Icon name="arrow-right" size={14} /></>}
          </button>
          <div style={{ marginTop: 32, padding: "14px 16px", background: "var(--fs-bone-50)", border: "1px solid var(--fs-border)", borderRadius: 4, fontSize: 12, color: "var(--fs-fg-muted)", display: "flex", gap: 10 }}>
            <Icon name="lock" size={14} color="var(--fs-navy)" style={{ marginTop: 2, flexShrink: 0 }} />
            <div>First-time setup: run <code style={{ fontSize: 11 }}>npm run db:seed</code> after configuring <code style={{ fontSize: 11 }}>.env</code>.</div>
          </div>
        </form>
      </div>
    </div>
  );
}
