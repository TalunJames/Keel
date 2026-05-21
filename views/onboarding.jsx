/* global React */
const { useState: useStateOnb } = React;

function OnboardingView({ user, role, client, clientId }) {
  const stages = [
    { n: "01", t: "Sign documents",          done: 5, total: 5 },
    { n: "02", t: "Workspace & tooling",     done: 4, total: 6 },
    { n: "03", t: "Read the playbook",       done: 2, total: 4 },
    { n: "04", t: "Shadow an account",       done: 0, total: 3 },
    { n: "05", t: "First solo deliverable",  done: 0, total: 1 },
  ];

  const items = {
    "01": [
      { t: "Offer letter", s: "Signed via DocuSign May 13", done: true },
      { t: "Confidentiality agreement (FEC + state)", s: "Signed", done: true },
      { t: "Direct deposit (Gusto)", s: "Verified", done: true },
      { t: "Equipment policy", s: "Signed", done: true },
      { t: "Conflicts disclosure form", s: "Signed", done: true },
    ],
    "02": [
      { t: "Fog Signal Workspace SSO", s: "Connected · Margaret Voss", done: true },
      { t: "Slack — joined #all-fog-signal, #design, #ohio-2026", s: "Joined 3 channels", done: true },
      { t: "Odoo — design + project pipeline", s: "Logged in", done: true },
      { t: "TargetSmart VAN credentials", s: "Provisioned, awaiting client-side enable", done: true },
      { t: "1Password vault — campaigns folder", s: "Pending — sets up with Eli Wed 2 PM", done: false, due: "Tomorrow" },
      { t: "Two-factor on personal devices", s: "Pending self-attest", done: false, due: "Friday" },
    ],
    "03": [
      { t: "The Fog Signal Playbook (Notion)", s: "Read 2 of 4 chapters", done: false, due: "This week" },
      { t: "Voice & tone guide", s: "Complete", done: true },
      { t: "Visual identity overview", s: "Complete", done: true },
      { t: "Compliance 101 — FEC + state filings", s: "Not started", done: false, due: "May 30" },
    ],
    "04": [
      { t: "Sit in on Aoki strategy call", s: "Scheduled Wed 11:00 AM ET with M. Voss", done: false, due: "Wed" },
      { t: "Observe Election Night war room — OH primaries", s: "Tonight 6:00 PM ET", done: false, due: "Tonight" },
      { t: "Coffee chats with each partner (4 total)", s: "0 of 4 scheduled", done: false, due: "By Jun 6" },
    ],
    "05": [
      { t: "Draft a brief or memo, reviewed by your account lead", s: "Assigned with intake", done: false, due: "End of week 2" },
    ],
  };

  const [open, setOpen] = useStateOnb("02");
  const done = stages.reduce((a, s) => a + s.done, 0);
  const total = stages.reduce((a, s) => a + s.total, 0);

  return (
    <div>
      <PageHead
        eyebrow={`${user.name.split(" ")[0]} · Public Affairs · Started May 13`}
        title="Welcome to Fog Signal."
        sub={`You're ${Math.round(done/total * 100)}% through onboarding. Tonight is OH primaries — a great chance to watch the war room run.`}
      />

      {/* Progress strip */}
      <div className="card" style={{ marginBottom: 24, padding: "20px 24px" }}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <div className="lbl" style={{ margin: 0 }}>First two weeks</div>
          <div className="row" style={{ gap: 10, fontSize: 12 }}>
            <span className="mut">{done} of {total} complete</span>
            <span className="num" style={{ fontWeight: 700, color: "var(--fs-navy)" }}>{Math.round(done/total * 100)}%</span>
          </div>
        </div>
        <div style={{ height: 8, background: "var(--fs-bone-100)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: (done/total * 100) + "%", height: "100%", background: "var(--fs-navy)", transition: "width 600ms" }} />
        </div>
        <div className="row" style={{ marginTop: 16, gap: 0, overflowX: "auto" }}>
          {stages.map((s, i) => (
            <button key={s.n} onClick={() => setOpen(s.n)} style={{
              flex: 1, minWidth: 0,
              padding: "10px 14px",
              border: "none",
              background: open === s.n ? "var(--fs-bone-50)" : "transparent",
              borderBottom: "2px solid " + (open === s.n ? "var(--fs-gold)" : "transparent"),
              textAlign: "left", cursor: "pointer",
              borderRadius: 4,
            }}>
              <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: "var(--fs-font-display)", fontSize: 12, fontWeight: 700, color: s.done === s.total ? "var(--fs-success)" : "var(--fs-gold-700)", letterSpacing: "0.04em" }}>{s.n}</span>
                <span style={{ width: 24, height: 1, background: "var(--fs-border)" }} />
                <span className="num mut" style={{ fontSize: 11 }}>{s.done}/{s.total}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: open === s.n ? "var(--fs-navy)" : "var(--fs-ink)", whiteSpace: "nowrap" }}>{s.t}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "flex-start" }}>
        {/* Checklist for open stage */}
        <div className="card">
          <div className="card-head">
            <h3>{stages.find(s => s.n === open).t}</h3>
          </div>
          <div>
            {items[open].map((it, i) => (
              <div key={i} style={{ display: "flex", gap: 14, padding: "16px 20px", borderBottom: i < items[open].length - 1 ? "1px solid var(--fs-border)" : "none", alignItems: "flex-start" }}>
                <span style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: it.done ? "var(--fs-navy)" : "transparent",
                  border: it.done ? "none" : "1.5px solid var(--fs-border-strong)",
                  color: "var(--fs-paper)",
                  display: "grid", placeItems: "center", flexShrink: 0, marginTop: 1,
                }}>
                  {it.done && <Icon name="check" size={12} stroke={2.5} />}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: it.done ? "var(--fs-fg-subtle)" : "var(--fs-navy)", textDecoration: it.done ? "line-through" : "none" }}>
                    {it.t}
                  </div>
                  <div className="mut" style={{ fontSize: 12, marginTop: 3 }}>{it.s}</div>
                </div>
                {!it.done && it.due && <Tag tone="warning">{it.due}</Tag>}
              </div>
            ))}
          </div>
        </div>

        {/* Right rail: buddy, your team, key reads */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card card-pad">
            <Eyebrow>Your onboarding buddy</Eyebrow>
            <div className="row" style={{ gap: 12, marginTop: 14 }}>
              <Avatar name="Margaret Voss" size={48} />
              <div>
                <div style={{ fontFamily: "var(--fs-font-display)", fontSize: 17, fontWeight: 700, color: "var(--fs-navy)" }}>Margaret Voss</div>
                <div className="mut" style={{ fontSize: 12 }}>Senior strategist · Public affairs</div>
              </div>
            </div>
            <div className="row" style={{ gap: 6, marginTop: 14 }}>
              <button className="btn secondary sm" style={{ flex: 1 }}><Icon name="calendar" size={12} /> Book time</button>
              <button className="btn secondary sm" style={{ flex: 1 }}><Icon name="comment" size={12} /> Slack</button>
            </div>
          </div>

          <div className="card card-pad">
            <Eyebrow>Meet your immediate team</Eyebrow>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { n: "Jonas Reiter", r: "Director of Operations" },
                { n: "Eli Park", r: "Data & analytics lead" },
                { n: "Drew Cole", r: "Senior designer" },
                { n: "Priya Shah", r: "Designer" },
                { n: "Hannah Liu", r: "Associate, public affairs" },
              ].map(p => (
                <div key={p.n} className="row" style={{ gap: 10 }}>
                  <Avatar name={p.n} size={28} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)" }}>{p.n}</div>
                    <div className="mut" style={{ fontSize: 11 }}>{p.r}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card card-pad" style={{ background: "var(--ks-ink-surface)", color: "var(--ks-on-ink)" }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--fs-gold)", fontWeight: 600, marginBottom: 10 }}>
              Recommended first reads
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                "The Fog Signal Playbook — Chapter 1",
                "Voice & tone guide",
                "Election night war-room protocol",
                "Coalition memo, May 18 — Aoki/Coastal",
              ].map((t, i) => (
                <a key={i} href="#" style={{ color: "var(--ks-on-ink)", textDecoration: "none", fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 8 }}>
                  <span>{t}</span>
                  <Icon name="arrow-right" size={12} color="var(--fs-gold)" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.OnboardingView = OnboardingView;
