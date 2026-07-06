import React, { useEffect, useState } from "react";
import { Icon, Eyebrow, Tag } from "../components/ui.jsx";
import { inviteApi, ApiError } from "../lib/api.js";

export function InviteView({ token, onComplete }) {
  const [invite, setInvite] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    inviteApi.get(token)
      .then((r) => {
        setInvite(r.invite);
        setName(r.invite?.name || "");
      })
      .catch((err) => {
        setLoadError(err instanceof ApiError ? err.message : "Invitation not found");
      })
      .finally(() => setBooting(false));
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
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
      const { user } = await inviteApi.accept(token, { password, name: name.trim() });
      const url = new URL(window.location.href);
      url.searchParams.delete("invite");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
      onComplete(user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create account");
    } finally {
      setLoading(false);
    }
  };

  if (booting) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100vh", color: "var(--fs-fg-muted)" }}>
        Loading invitation…
      </div>
    );
  }

  if (loadError || !invite) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100vh", padding: 24 }}>
        <div className="card card-pad" style={{ maxWidth: 420, textAlign: "center" }}>
          <Icon name="alert" size={24} color="var(--fs-danger)" />
          <h2 style={{ fontFamily: "var(--fs-font-display)", color: "var(--fs-navy)", margin: "16px 0 8px" }}>
            Invitation unavailable
          </h2>
          <p className="mut" style={{ fontSize: 14, margin: 0 }}>{loadError || "This link is invalid or has expired."}</p>
        </div>
      </div>
    );
  }

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
          <Eyebrow>You're invited</Eyebrow>
          <h1 style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 42, lineHeight: 1.1, color: "var(--ks-on-ink)", margin: "16px 0 18px" }}>
            Welcome to Keel.
          </h1>
          <p style={{ color: "rgba(255,255,255,0.72)", fontSize: 16, lineHeight: 1.6, margin: "0 0 20px" }}>
            {(invite.keelOverview || []).join(" ")}
          </p>
          <div style={{ marginBottom: 16 }}>
            <Tag tone="gold">{invite.roleLabel}</Tag>
            {invite.clientName && <Tag tone="outline" style={{ marginLeft: 8 }}>{invite.clientName}</Tag>}
          </div>
          <ul style={{ color: "rgba(255,255,255,0.72)", fontSize: 14, lineHeight: 1.7, paddingLeft: 18, margin: 0 }}>
            {(invite.roleDescription || []).map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </div>
        <div style={{ position: "relative", fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
          © Fog Signal Strategies · {new Date().getFullYear()}
        </div>
      </div>

      <div style={{ padding: "80px 72px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <form onSubmit={submit} style={{ maxWidth: 380, width: "100%", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "var(--fs-font-display)", fontSize: 30, fontWeight: 700, color: "var(--fs-navy)", margin: "0 0 8px" }}>
            Create your account
          </h2>
          <p style={{ color: "var(--fs-fg-muted)", margin: "0 0 24px", fontSize: 14 }}>
            {invite.invitedBy
              ? `${invite.invitedBy} invited ${invite.email} as ${invite.roleLabel.toLowerCase()}.`
              : `Set a password for ${invite.email}.`}
          </p>

          {error && (
            <div style={{ marginBottom: 16, padding: "10px 12px", background: "#fde8e4", border: "1px solid #e8b4ab", borderRadius: 4, fontSize: 13, color: "#7a2210" }}>
              {error}
            </div>
          )}

          <div className="field">
            <label htmlFor="invite-name">Your name</label>
            <input id="invite-name" className="input" required autoComplete="name"
              value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="invite-password">Password</label>
            <input id="invite-password" className="input" type="password" required autoComplete="new-password"
              placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="invite-confirm">Confirm password</label>
            <input id="invite-confirm" className="input" type="password" required autoComplete="new-password"
              placeholder="Repeat password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <button type="submit" className="btn primary" disabled={loading}
            style={{ width: "100%", padding: "12px 14px", justifyContent: "center", fontSize: 14, marginTop: 4 }}>
            {loading ? "Creating account…" : <>Create account & sign in <Icon name="arrow-right" size={14} /></>}
          </button>
        </form>
      </div>
    </div>
  );
}
