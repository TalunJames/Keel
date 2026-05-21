/* global React */
const { useState: useStateHome } = React;

function HomeView({ user, role, onNavigate, client, clientId }) {
  const [checklist, setChecklist] = useStateHome([
    { id: 1, label: "Submit time tracking for week of May 19", due: "Today", done: false, kind: "ops" },
    { id: 2, label: "Review Aoki TV spot v3 proofs", due: "Today",   done: false, kind: "design" },
    { id: 3, label: "Confirm precinct walk list — Ward 7", due: "Tomorrow", done: false, kind: "field" },
    { id: 4, label: "Read May 18 IE filings memo",        due: "This week", done: true,  kind: "memo" },
    { id: 5, label: "Annual compliance training",         due: "Jun 1",     done: false, kind: "compliance" },
  ]);

  const toggle = (id) => setChecklist(cl => cl.map(c => c.id === id ? { ...c, done: !c.done } : c));

  // ----- Announcements (role-filtered) -----
  const announcements = [
    { id: 1, pin: true, audience: ["staff","admin"], from: "Jonas Reiter", title: "Election Night protocol — May 21 primaries",
      body: "Call begins at 5:45 PM ET in the war room. Race manager opens to all staff at 6:00 PM. See the Election Night tab for assignments and the live result strip.",
      tag: "Ops", time: "2h ago" },
    { id: 2, pin: false, audience: ["staff","admin","client"], from: "Margaret Voss", title: "New polling unlocked for Aoki for Senate",
      body: "Crosstabs from May 12–17 IVR are now visible in the Polling tab. Statewide n=812, ±3.4%. Client view enabled for Topline + Issue Battery.",
      tag: "Polling", time: "Yesterday" },
    { id: 3, pin: false, audience: ["staff","admin"], from: "Eli Park", title: "Voter file refresh — TargetSmart 5/19",
      body: "Latest TargetSmart pull is live. New turnout flags through the May 6 special elections in OH-12, NC-08. Old extracts will deprecate June 1.",
      tag: "Data", time: "Yesterday" },
    { id: 4, pin: false, audience: ["staff","admin","client"], from: "Operations", title: "Office closed Memorial Day, Monday May 26",
      body: "On-call coverage rotates to Reiter. Election Night staffing for the May 27 NJ-3 special begins Tuesday at 7 AM.",
      tag: "Calendar", time: "2d ago" },
  ].filter(a => a.audience.includes(role));

  // ----- Quick links (role-aware) -----
  const quickLinks = {
    staff: [
      { label: "Request a design job",        icon: "pen",      to: "design" },
      { label: "Open Election Night",         icon: "tv",       to: "election" },
      { label: "Voter file explorer",         icon: "users",    to: "voter" },
      { label: "Resource library",            icon: "book",     to: "resources" },
      { label: "Submit a memo",               icon: "comment",  to: "memo", ext: true },
      { label: "Time tracking — Odoo",        icon: "calendar", to: "odoo", ext: true },
    ],
    admin: [
      { label: "Admin console",               icon: "shield",   to: "admin" },
      { label: "Manage announcements",        icon: "pin",      to: "admin" },
      { label: "Election Night war room",     icon: "tv",       to: "election" },
      { label: "User & role management",      icon: "key",      to: "admin" },
      { label: "Audit log",                   icon: "alert",    to: "admin" },
      { label: "Resource library",            icon: "book",     to: "resources" },
    ],
    client: [
      { label: "Polling — released to you",   icon: "trend-up", to: "polling" },
      { label: "Active design proofs",        icon: "image",    to: "design" },
      { label: "Memos & briefings",           icon: "book",     to: "resources" },
      { label: "Talk to your strategist",     icon: "comment",  to: "contact", ext: true },
    ],
  }[role];

  // Race assignments only for staff/admin — filter to selected client (if any)
  const allRaces = [
    { name: "Aoki for U.S. Senate (OH)",    role: "Lead strategist",  next: "TV proof review", when: "Today 3 PM", client: "aoki" },
    { name: "Citizens for Coastal Renewal", role: "Comms support",    next: "Coalition memo",  when: "Wed",        client: "coastal" },
    { name: "NJ-3 — Harden",                role: "Voter file lead",  next: "Cut universe v4", when: "Fri",        client: "harden" },
    { name: "Patel for OH-12",              role: "Account support",  next: "Launch kit",      when: "Jun 18",     client: "patel" },
    { name: "Hughes for Governor",          role: "Senior counsel",   next: "Ad concept",      when: "Jun 8",      client: "hughes" },
  ];
  const myRaces = (clientId && clientId !== "all") ? allRaces.filter(r => r.client === clientId) : allRaces.slice(0, 3);

  const upcomingElections = [
    { date: "May 21", name: "OH primaries", races: 14, status: "live" },
    { date: "May 27", name: "NJ-3 special", races: 1,  status: "soon" },
    { date: "Jun 3",  name: "TX-15 primary runoff", races: 1, status: "soon" },
    { date: "Jun 17", name: "OK SD-12 special", races: 1, status: "scheduled" },
  ];

  return (
    <div>
      {/* Hero strip */}
      <div style={{
        background: "var(--ks-ink-surface)",
        color: "var(--ks-on-ink)",
        margin: "-28px -32px 28px",
        padding: "28px 32px 24px",
        position: "relative", overflow: "hidden",
      }}>
        <svg width="540" height="540" viewBox="0 0 540 540" style={{ position: "absolute", right: -120, top: -120, opacity: 0.08, pointerEvents: "none" }}>
          <g fill="none" stroke="var(--fs-gold)" strokeWidth="1">
            <path d="M 270 270 L 540 120" /><path d="M 270 270 L 540 270" /><path d="M 270 270 L 540 420" />
            <circle cx="270" cy="270" r="80" /><circle cx="270" cy="270" r="140" /><circle cx="270" cy="270" r="220" />
          </g>
        </svg>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, position: "relative" }}>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--fs-gold)", fontWeight: 600, marginBottom: 8 }}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · {role === "admin" ? "Admin view" : role === "client" ? "Client portal" : "Staff workspace"}
            </div>
            <h1 style={{ fontFamily: "var(--fs-font-display)", fontSize: 32, fontWeight: 700, margin: 0, letterSpacing: "-0.01em", color: "var(--ks-on-ink)" }}>
              {greeting()}, {user.name.split(" ")[0]}.
            </h1>
            <p style={{ color: "rgba(255,255,255,0.72)", margin: "8px 0 0", fontSize: 14, maxWidth: 560 }}>
              {role === "client"
                ? "Here's what your Fog Signal team has shared with you this week."
                : role === "admin"
                ? "Three election nights this month. Five active retainers. Two onboarding cohorts in progress."
                : "OH primaries go live tonight at 6:00 PM ET. You have 3 proofs waiting and one cut universe to confirm."}
            </p>
          </div>
          {role !== "client" && (
            <div style={{ display: "flex", gap: 20, padding: "12px 24px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 4 }}>
              <div style={{ minWidth: 70 }}>
                <div style={{ fontFamily: "var(--fs-font-display)", fontSize: 28, fontWeight: 700, color: "var(--fs-gold)" }}>14</div>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>Races tonight</div>
              </div>
              <div style={{ minWidth: 80 }}>
                <div style={{ fontFamily: "var(--fs-font-display)", fontSize: 28, fontWeight: 700 }}>{role === "admin" ? 7 : 3}</div>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>Open proofs</div>
              </div>
              <div style={{ minWidth: 80 }}>
                <div style={{ fontFamily: "var(--fs-font-display)", fontSize: 28, fontWeight: 700 }}>{role === "admin" ? 12 : 5}</div>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>Tasks due</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 24 }}>
        {/* LEFT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Announcements */}
          <section className="card">
            <div className="card-head">
              <h3>Announcements</h3>
              {role === "admin" && <a className="card-link" href="#" onClick={(e) => { e.preventDefault(); onNavigate("admin"); }}>Manage →</a>}
            </div>
            <div>
              {announcements.map((a, i) => (
                <div key={a.id} style={{
                  padding: "16px 20px",
                  borderBottom: i < announcements.length - 1 ? "1px solid var(--fs-border)" : "none",
                  display: "flex", gap: 14,
                }}>
                  <div style={{ flexShrink: 0, marginTop: 2 }}>
                    <Avatar name={a.from} size={32} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <Tag tone="navy">{a.tag}</Tag>
                      {a.pin && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--fs-gold-700)", fontWeight: 600 }}>
                        <Icon name="pin" size={11} /> Pinned
                      </span>}
                      <span style={{ fontSize: 11, color: "var(--fs-fg-subtle)", marginLeft: "auto" }}>{a.time}</span>
                    </div>
                    <h4 style={{ fontFamily: "var(--fs-font-display)", fontSize: 17, fontWeight: 700, color: "var(--fs-navy)", margin: "0 0 4px", letterSpacing: "-0.005em" }}>{a.title}</h4>
                    <p style={{ fontSize: 13, color: "var(--fs-fg-muted)", margin: "0 0 6px", lineHeight: 1.55 }}>{a.body}</p>
                    <div style={{ fontSize: 11, color: "var(--fs-fg-subtle)" }}>{a.from}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Quick links */}
          <section className="card">
            <div className="card-head">
              <h3>Quick Links</h3>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", padding: 12, gap: 8 }}>
              {quickLinks.map(q => (
                <a key={q.label} onClick={() => !q.ext && onNavigate(q.to)} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px",
                  borderRadius: 4,
                  cursor: "pointer",
                  textDecoration: "none",
                  color: "var(--fs-navy)",
                  transition: "background 160ms, border-color 160ms",
                  border: "1px solid transparent",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--fs-bone-50)"; e.currentTarget.style.borderColor = "var(--fs-border)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}
                >
                  <span style={{ width: 32, height: 32, display: "grid", placeItems: "center", background: "var(--fs-navy-50)", borderRadius: 4, color: "var(--fs-navy)", flexShrink: 0 }}>
                    <Icon name={q.icon} size={16} />
                  </span>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--fs-ink)" }}>{q.label}</div>
                  {q.ext && <Icon name="external" size={12} color="var(--fs-fg-subtle)" />}
                </a>
              ))}
            </div>
          </section>

          {/* My races / Polling (varies by role) */}
          {role !== "client" ? (
            <section className="card">
              <div className="card-head">
                <h3>My Races</h3>
                <a className="card-link" href="#" onClick={(e) => { e.preventDefault(); onNavigate("election"); }}>All races →</a>
              </div>
              <table className="tbl">
                <thead>
                  <tr><th>Account</th><th>My role</th><th>Next action</th><th style={{ textAlign: "right" }}>When</th></tr>
                </thead>
                <tbody>
                  {myRaces.map(r => (
                    <tr key={r.name}>
                      <td style={{ fontWeight: 600, color: "var(--fs-navy)" }}>{r.name}</td>
                      <td className="mut">{r.role}</td>
                      <td>{r.next}</td>
                      <td style={{ textAlign: "right" }}><Tag tone="outline">{r.when}</Tag></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : (
            <section className="card">
              <div className="card-head">
                <h3>Released to you this week</h3>
                <a className="card-link" href="#" onClick={(e) => { e.preventDefault(); onNavigate("polling"); }}>Open polling →</a>
              </div>
              <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[
                  { title: "Statewide topline — May 12–17", n: 812, moe: "±3.4%", new: true },
                  { title: "Issue battery — Coastal Renewal", n: 812, moe: "±3.4%", new: true },
                  { title: "Ad test — \"Lighthouse\" 30s",   n: 401, moe: "±4.9%", new: false },
                  { title: "Final pre-primary tracking",     n: 600, moe: "±4.0%", new: false },
                ].map(p => (
                  <div key={p.title} style={{ border: "1px solid var(--fs-border)", borderRadius: 4, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                      <h4 style={{ fontFamily: "var(--fs-font-display)", fontSize: 15, fontWeight: 700, color: "var(--fs-navy)", margin: "0 0 6px" }}>{p.title}</h4>
                      {p.new && <Tag tone="gold">New</Tag>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--fs-fg-muted)" }}>n = {p.n} · {p.moe}</div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Point of contact — client view only, top of rail */}
          {role === "client" && (
            <section className="card" style={{ overflow: "hidden" }}>
              <div style={{ background: "var(--ks-ink-surface)", color: "var(--ks-on-ink)", padding: "16px 20px", position: "relative", overflow: "hidden" }}>
                <svg width="220" height="220" viewBox="0 0 220 220" style={{ position: "absolute", right: -60, top: -60, opacity: 0.10, pointerEvents: "none" }}>
                  <g fill="none" stroke="var(--fs-gold)" strokeWidth="1">
                    <circle cx="110" cy="110" r="40"/><circle cx="110" cy="110" r="70"/><circle cx="110" cy="110" r="100"/>
                  </g>
                </svg>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--fs-gold)", fontWeight: 700, position: "relative" }}>
                  Your senior strategist
                </div>
                <div className="row" style={{ gap: 14, marginTop: 12, alignItems: "flex-start", position: "relative" }}>
                  <Avatar name="Margaret Voss" size={56} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "var(--fs-font-display)", fontSize: 20, fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.005em" }}>Margaret Voss</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 3 }}>Partner · Public Affairs</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 4, fontStyle: "italic" }}>
                      "Reach out any time — phone first for anything time-sensitive."
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                <a href="tel:+12025550148" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", border: "1px solid var(--fs-border)", borderRadius: 4, textDecoration: "none", color: "var(--fs-navy)" }}>
                  <Icon name="bell" size={15} color="var(--fs-navy)" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: "var(--fs-fg-muted)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>Direct line</div>
                    <div style={{ fontFamily: "var(--fs-font-mono)", fontSize: 14, fontWeight: 600 }}>(202) 555-0148</div>
                  </div>
                  <Icon name="arrow-right" size={13} color="var(--fs-fg-subtle)" />
                </a>
                <a href="mailto:mvoss@fogsignal.co" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", border: "1px solid var(--fs-border)", borderRadius: 4, textDecoration: "none", color: "var(--fs-navy)" }}>
                  <Icon name="comment" size={15} color="var(--fs-navy)" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: "var(--fs-fg-muted)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>Email</div>
                    <div style={{ fontFamily: "var(--fs-font-mono)", fontSize: 13, fontWeight: 600 }}>mvoss@fogsignal.co</div>
                  </div>
                  <Icon name="arrow-right" size={13} color="var(--fs-fg-subtle)" />
                </a>
                <a href="#" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", border: "1px solid var(--fs-border)", borderRadius: 4, textDecoration: "none", color: "var(--fs-navy)", background: "var(--fs-bone-50)" }}>
                  <Icon name="calendar" size={15} color="var(--fs-navy)" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: "var(--fs-fg-muted)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>Book time</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>30-min call · 60-min strategy</div>
                  </div>
                  <Icon name="arrow-right" size={13} color="var(--fs-fg-subtle)" />
                </a>
              </div>

              <div style={{ padding: "12px 20px 16px", borderTop: "1px solid var(--fs-border)", background: "var(--fs-bone-50)" }}>
                <div className="lbl" style={{ marginBottom: 10 }}>Also on your team</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { n: "Eli Park",    r: "Polling & analytics", emerg: false },
                    { n: "Drew Cole",   r: "Creative",            emerg: false },
                    { n: "Jonas Reiter", r: "Operations",          emerg: true },
                  ].map(p => (
                    <div key={p.n} className="row" style={{ gap: 10 }}>
                      <Avatar name={p.n} size={26} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)" }}>{p.n}</div>
                        <div className="mut" style={{ fontSize: 11 }}>{p.r}</div>
                      </div>
                      {p.emerg && <Tag tone="gold">After hours</Tag>}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Checklist */}
          <section className="card">
            <div className="card-head">
              <h3>My Checklist</h3>
              <span className="mut" style={{ fontSize: 12 }}>{checklist.filter(c => !c.done).length} open</span>
            </div>
            <div style={{ padding: "4px 8px 12px" }}>
              {checklist.map(c => (
                <button key={c.id} onClick={() => toggle(c.id)}
                  style={{
                    width: "100%", display: "flex", alignItems: "flex-start", gap: 10,
                    padding: "10px 12px", border: "none", background: "transparent",
                    textAlign: "left", cursor: "pointer", borderRadius: 4,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--fs-bone-50)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <span style={{
                    width: 16, height: 16, marginTop: 2,
                    borderRadius: 3,
                    border: c.done ? "none" : "1.5px solid var(--fs-border-strong)",
                    background: c.done ? "var(--fs-navy)" : "transparent",
                    display: "grid", placeItems: "center",
                    flexShrink: 0,
                  }}>
                    {c.done && <Icon name="check" size={11} color="var(--fs-paper)" stroke={2.5} />}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13,
                      color: c.done ? "var(--fs-fg-subtle)" : "var(--fs-ink)",
                      textDecoration: c.done ? "line-through" : "none",
                      lineHeight: 1.4,
                    }}>{c.label}</div>
                    <div style={{ fontSize: 11, color: "var(--fs-fg-subtle)", marginTop: 2 }}>{c.due}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Election calendar */}
          {role !== "client" && (
            <section className="card">
              <div className="card-head">
                <h3>Election Calendar</h3>
              </div>
              <div style={{ padding: "4px 0" }}>
                {upcomingElections.map((e, i) => (
                  <div key={e.name} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 20px", borderBottom: i < upcomingElections.length - 1 ? "1px solid var(--fs-border)" : "none" }}>
                    <div style={{ minWidth: 56, textAlign: "center", padding: "4px 0", border: "1px solid var(--fs-border)", borderRadius: 4 }}>
                      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fs-fg-subtle)", fontWeight: 600 }}>{e.date.split(" ")[0]}</div>
                      <div style={{ fontFamily: "var(--fs-font-display)", fontSize: 18, fontWeight: 700, color: "var(--fs-navy)", lineHeight: 1 }}>{e.date.split(" ")[1]}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)" }}>{e.name}</div>
                      <div style={{ fontSize: 11, color: "var(--fs-fg-muted)" }}>{e.races} race{e.races > 1 ? "s" : ""}</div>
                    </div>
                    {e.status === "live" && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, color: "var(--fs-danger)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--fs-danger)" }} className="pulse-dot" />
                        Live
                      </span>
                    )}
                    {e.status === "soon" && <Tag tone="warning">Soon</Tag>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Today's note from comms (everyone) */}
          <section style={{
            background: "var(--fs-bone)",
            padding: "20px 22px",
            borderRadius: 4,
          }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--fs-gold-700)", fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 18, height: 2, background: "var(--fs-gold)" }} /> Today's signal
            </div>
            <p style={{ fontFamily: "var(--fs-font-display)", fontStyle: "italic", fontSize: 18, lineHeight: 1.45, color: "var(--fs-navy)", margin: "0 0 12px", fontWeight: 500 }}>
              "Polling errors compound the closer you are to election day. Trust the field program over the last tracker."
            </p>
            <div style={{ fontSize: 11, color: "var(--fs-fg-muted)", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 600 }}>— Senior counsel memo, May 19</div>
          </section>
        </div>
      </div>

      <style>{`
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        .pulse-dot { animation: pulse-dot 1.6s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

window.HomeView = HomeView;
