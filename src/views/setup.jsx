import React, { useState } from "react";
import { Icon, Eyebrow } from "../components/ui.jsx";
import { setupApi, ApiError } from "../lib/api.js";

export function SetupView({ setup, onComplete }) {
  const [name, setName] = useState(setup?.name || "");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!token.trim()) {
      setError("Enter the setup token from the server console.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const { user } = await setupApi.complete({ password, name: name.trim(), setupToken: token.trim() });
      onComplete(user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Setup failed");
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
        <div style={{ position: "relative" }}>
          <img src="/logo-wordmark-white.png" alt="Fog Signal Strategies"
            style={{ height: 56, width: "auto", display: "block" }} />
        </div>
        <div style={{ position: "relative", maxWidth: 480 }}>
          <Eyebrow>First boot</Eyebrow>
          <h1 style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 48, lineHeight: 1.1, color: "var(--ks-on-ink)", margin: "16px 0 18px" }}>
            Welcome aboard.
          </h1>
          <p style={{ color: "rgba(255,255,255,0.72)", fontSize: 16, lineHeight: 1.6, margin: 0 }}>
            Enter the one-time setup token printed in the server console, then set your administrator password. This is a one-time step — the password is stored in the database and used for every sign-in afterward.
          </p>
        </div>
        <div style={{ position: "relative", fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
          © Fog Signal Strategies · {new Date().getFullYear()}
        </div>
      </div>

      <div style={{ padding: "80px 72px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <form onSubmit={submit} style={{ maxWidth: 380, width: "100%", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "var(--fs-font-display)", fontSize: 30, fontWeight: 700, color: "var(--fs-navy)", margin: "0 0 8px" }}>
            Set up Keel
          </h2>
          <p style={{ color: "var(--fs-fg-muted)", margin: "0 0 24px", fontSize: 14 }}>
            You are the system administrator for this deployment.
          </p>

          {error && (
            <div style={{ marginBottom: 16, padding: "10px 12px", background: "#fde8e4", border: "1px solid #e8b4ab", borderRadius: 4, fontSize: 13, color: "#7a2210" }}>
              {error}
            </div>
          )}

          <div className="field">
            <label htmlFor="setup-token">Setup token</label>
            <input id="setup-token" className="input" required autoComplete="off"
              placeholder="Printed in the server logs on first boot"
              value={token} onChange={(e) => setToken(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="setup-name">Your name</label>
            <input id="setup-name" className="input" required autoComplete="name"
              value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="setup-password">Password</label>
            <input id="setup-password" className="input" type="password" required autoComplete="new-password"
              placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="setup-confirm">Confirm password</label>
            <input id="setup-confirm" className="input" type="password" required autoComplete="new-password"
              placeholder="Repeat password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <button type="submit" className="btn primary" disabled={loading}
            style={{ width: "100%", padding: "12px 14px", justifyContent: "center", fontSize: 14, marginTop: 4 }}>
            {loading ? "Saving…" : <>Create password & sign in <Icon name="arrow-right" size={14} /></>}
          </button>
        </form>
      </div>
    </div>
  );
}
