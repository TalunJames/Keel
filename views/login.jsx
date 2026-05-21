/* global React */
const { useState: useStateLogin } = React;

function LoginView({ onLogin }) {
  const [email, setEmail] = useStateLogin("");
  const [password, setPassword] = useStateLogin("");
  const [role, setRole] = useStateLogin("staff");

  const accounts = [
    { role: "staff",  name: "Margaret Voss",   team: "Public Affairs", email: "mvoss@fogsignal.co" },
    { role: "admin",  name: "Jonas Reiter",    team: "Operations",     email: "jreiter@fogsignal.co" },
    { role: "client", name: "Senator Aoki",    team: "Aoki for Senate",email: "campaign@aoki26.org" },
  ];

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1.2fr 1fr",
      height: "100vh", width: "100vw",
      background: "var(--fs-paper)",
    }}>
      {/* Left: brand panel */}
      <div style={{
        background: "var(--ks-ink-surface)", color: "var(--ks-on-ink)",
        padding: "56px 64px",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        position: "relative", overflow: "hidden",
      }}>
        {/* Faint beam motif */}
        <svg width="900" height="900" viewBox="0 0 900 900" style={{ position: "absolute", right: -260, top: -180, opacity: 0.10, pointerEvents: "none" }}>
          <g fill="none" stroke="var(--fs-gold)" strokeWidth="1.2">
            <path d="M450 450 L900 200"/><path d="M450 450 L900 450"/><path d="M450 450 L900 700"/>
            <circle cx="450" cy="450" r="120"/><circle cx="450" cy="450" r="220"/><circle cx="450" cy="450" r="340"/>
          </g>
        </svg>

        <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative" }}>
          <img src="design-system/assets/logo-stacked-white.png" alt="Fog Signal" style={{ height: 56 }} />
          <div>
            <div style={{ fontFamily: "var(--fs-font-display)", fontSize: 28, fontWeight: 700, lineHeight: 1 }}>Keel</div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,0.55)", marginTop: 4 }}>Fog Signal Strategies</div>
          </div>
        </div>

        <div style={{ position: "relative", maxWidth: 480 }}>
          <Eyebrow>Sign in</Eyebrow>
          <h1 style={{
            fontFamily: "var(--fs-font-display)", fontWeight: 700,
            fontSize: 48, lineHeight: 1.1, letterSpacing: "-0.015em",
            color: "var(--ks-on-ink)",
            margin: "16px 0 18px",
          }}>
            A steady signal<br/>through noisy weeks.
          </h1>
          <p style={{ color: "rgba(255,255,255,0.72)", fontSize: 16, lineHeight: 1.6, margin: 0 }}>
            Keel is the internal portal for Fog Signal staff and retained clients — design jobs, election night, the voter file, and everything in between, in one place.
          </p>
        </div>

        <div style={{ position: "relative", fontSize: 12, color: "rgba(255,255,255,0.45)", display: "flex", justifyContent: "space-between" }}>
          <span>© Fog Signal Strategies · 2026</span>
          <span>Need help? <a style={{ color: "var(--fs-gold)", textDecoration: "none" }} href="#">support@fogsignal.co</a></span>
        </div>
      </div>

      {/* Right: form */}
      <div style={{ padding: "80px 72px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ maxWidth: 380, width: "100%", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "var(--fs-font-display)", fontSize: 30, fontWeight: 700, color: "var(--fs-navy)", margin: "0 0 8px" }}>Sign in to Keel</h2>
          <p style={{ color: "var(--fs-fg-muted)", margin: "0 0 32px", fontSize: 14 }}>
            Use your Fog Signal email or your client portal credentials.
          </p>

          <div className="field">
            <label>Email</label>
            <input className="input" placeholder="name@fogsignal.co" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label>Password</label>
            <input className="input" type="password" placeholder="••••••••••" value={password} onChange={e => setPassword(e.target.value)} />
            <a href="#" style={{ fontSize: 12, color: "var(--fs-fg-muted)", textDecoration: "none", display: "inline-block", marginTop: 6 }}>Forgot password →</a>
          </div>

          <button className="btn primary" style={{ width: "100%", padding: "12px 14px", justifyContent: "center", fontSize: 14, marginTop: 8 }} onClick={() => {
            const acct = accounts.find(a => a.role === role);
            onLogin(acct);
          }}>
            Continue <Icon name="arrow-right" size={14} />
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "28px 0 18px", color: "var(--fs-fg-subtle)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em" }}>
            <span style={{ flex: 1, height: 1, background: "var(--fs-border)" }} />
            <span>Demo Accounts</span>
            <span style={{ flex: 1, height: 1, background: "var(--fs-border)" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {accounts.map(a => (
              <button key={a.role}
                onClick={() => { setRole(a.role); onLogin(a); }}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 12px",
                  border: "1px solid var(--fs-border)",
                  borderRadius: 4,
                  background: "var(--fs-paper)",
                  cursor: "pointer", textAlign: "left",
                  transition: "background 160ms, border-color 160ms",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--fs-navy)"; e.currentTarget.style.background = "var(--fs-bone-50)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--fs-border)"; e.currentTarget.style.background = "var(--fs-paper)"; }}
              >
                <Avatar name={a.name} size={32} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)" }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: "var(--fs-fg-muted)" }}>{a.team}</div>
                </div>
                <span className={"tag " + (a.role === "admin" ? "gold" : a.role === "client" ? "outline" : "navy")}>{a.role}</span>
                <Icon name="arrow-right" size={14} color="var(--fs-fg-subtle)" />
              </button>
            ))}
          </div>

          <div style={{ marginTop: 32, padding: "14px 16px", background: "var(--fs-bone-50)", border: "1px solid var(--fs-border)", borderRadius: 4, fontSize: 12, color: "var(--fs-fg-muted)", display: "flex", gap: 10, alignItems: "flex-start" }}>
            <Icon name="lock" size={14} color="var(--fs-navy)" style={{ marginTop: 2, flexShrink: 0 }} />
            <div>Sessions on personal devices expire after <strong style={{ color: "var(--fs-navy)" }}>30 minutes</strong> of inactivity. SSO via Fog Signal Workspace is required for staff.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.LoginView = LoginView;
