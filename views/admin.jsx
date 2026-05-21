/* global React */
const { useState: useStateAdmin } = React;

function AdminView({ modules, onChangeModules, allRoles }) {
  const [tab, setTab] = useStateAdmin("clients");
  const tabs = [
    { id: "clients",       label: "Clients" },
    { id: "modules",       label: "Modules & Tabs" },
    { id: "announcements", label: "Announcements" },
    { id: "users",         label: "People & Roles" },
    { id: "permissions",   label: "Polling Releases" },
    { id: "audit",         label: "Audit Log" },
  ];

  return (
    <div>
      <PageHead
        eyebrow="Administrator"
        title="Admin Console"
        sub="Manage what staff and clients see across Keel. All changes are audit-logged."
      />

      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--fs-border)", marginBottom: 24 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "10px 18px", background: "transparent", border: "none",
            borderBottom: "2px solid " + (tab === t.id ? "var(--fs-gold)" : "transparent"),
            color: tab === t.id ? "var(--fs-navy)" : "var(--fs-fg-muted)",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
            marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      {tab === "clients" && <AdminClients />}
      {tab === "modules" && <AdminModules modules={modules} onChange={onChangeModules} allRoles={allRoles} />}
      {tab === "announcements" && <AdminAnnouncements />}
      {tab === "users" && <AdminUsers />}
      {tab === "permissions" && <AdminPermissions />}
      {tab === "audit" && <AdminAudit />}
    </div>
  );
}

function AdminModules({ modules, onChange, allRoles }) {
  const [scope, setScope] = useStateAdmin("staff"); // staff | admin | client | byperson
  const [editingPerson, setEditingPerson] = useStateAdmin("mvoss@fogsignal.co");

  // Local per-person overrides (in-memory only for demo)
  const [perPerson, setPerPerson] = useStateAdmin({
    "mvoss@fogsignal.co": { ...allRoles.staff, election: true,  proposals: true,  media: true  },
    "epark@fogsignal.co": { ...allRoles.staff, election: false, voter: true,      polling: true },
    "dcole@fogsignal.co": { ...allRoles.staff, voter: false,    election: false },
    "pshah@fogsignal.co": { ...allRoles.staff, voter: false,    election: false },
    "hliu@fogsignal.co":  { ...allRoles.staff, voter: false,    election: false, onboarding: true },
  });

  const modulesList = window.KEEL_MODULES || [];

  const handleToggleRole = (role, modId) => {
    if (role !== "staff") return; // demo simplification: edit staff defaults via this UI
    const next = { ...modules, [modId]: !modules[modId] };
    onChange(next);
  };

  const staff = [
    { e: "mvoss@fogsignal.co",   n: "Margaret Voss",  t: "Public Affairs" },
    { e: "epark@fogsignal.co",   n: "Eli Park",       t: "Data & Analytics" },
    { e: "dcole@fogsignal.co",   n: "Drew Cole",      t: "Design" },
    { e: "pshah@fogsignal.co",   n: "Priya Shah",     t: "Design" },
    { e: "hliu@fogsignal.co",    n: "Hannah Liu",     t: "Public Affairs" },
  ];
  const personPrefs = perPerson[editingPerson] || allRoles.staff;
  const setPersonPref = (modId, on) => setPerPerson(p => ({ ...p, [editingPerson]: { ...(p[editingPerson] || allRoles.staff), [modId]: on } }));

  return (
    <div>
      <div className="card card-pad" style={{ marginBottom: 18, background: "var(--fs-bone-50)" }}>
        <div className="row between" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div style={{ maxWidth: 580 }}>
            <Eyebrow>Module access</Eyebrow>
            <p style={{ fontSize: 13, color: "var(--fs-ink)", margin: "8px 0 0", lineHeight: 1.55 }}>
              Toggle tabs on or off across a whole role (staff / admin / client) or for one specific person.
              <strong style={{ color: "var(--fs-navy)" }}> Election Night is off by default for staff</strong> — enable it for a specific consultant the week they need to track a race.
            </p>
          </div>
          <div className="row" style={{ gap: 4 }}>
            {[
              { id: "staff",   l: "Staff (default)" },
              { id: "admin",   l: "Admin" },
              { id: "client",  l: "Client" },
              { id: "byperson",l: "By person" },
            ].map(s => (
              <button key={s.id} onClick={() => setScope(s.id)}
                className={"btn " + (scope === s.id ? "primary" : "secondary")}
                style={{ padding: "6px 12px", fontSize: 12 }}>
                {s.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {scope !== "byperson" ? (
        <div className="card">
          <div className="card-head">
            <h3>{scope === "staff" ? "Staff defaults" : scope === "admin" ? "Admin defaults" : "Client defaults"} — applies to all {scope} accounts</h3>
            {scope !== "staff" && <span className="tag outline">Read-only (demo)</span>}
          </div>
          <table className="tbl">
            <thead><tr><th style={{ width: 50 }}></th><th>Module</th><th>Description</th><th style={{ textAlign: "right" }}>Status</th></tr></thead>
            <tbody>
              {modulesList.map(m => {
                const isOn = scope === "staff" ? !!modules[m.id] : !!allRoles[scope][m.id];
                const isMandatory = m.mandatory;
                const isStaffOnly = m.staffOnly && scope === "client";
                return (
                  <tr key={m.id}>
                    <td><Icon name={iconForModule(m.id)} size={16} color="var(--fs-navy)" /></td>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--fs-navy)" }}>{m.label}</div>
                      <div className="mut" style={{ fontSize: 11, marginTop: 2 }}>
                        {m.gated && <Tag tone="gold">Admin-gated</Tag>}{" "}
                        {m.staffOnly && <Tag tone="navy">Staff-only</Tag>}{" "}
                        {m.mandatory && <Tag tone="outline">Mandatory</Tag>}
                      </div>
                    </td>
                    <td className="mut" style={{ fontSize: 12 }}>{moduleDesc(m.id)}</td>
                    <td style={{ textAlign: "right" }}>
                      {isStaffOnly ? (
                        <span className="mut" style={{ fontSize: 11 }}>Not available to clients</span>
                      ) : isMandatory ? (
                        <Tag tone="success">Always on</Tag>
                      ) : (
                        <Toggle on={isOn} disabled={scope !== "staff"} onChange={() => handleToggleRole(scope, m.id)} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        // BY PERSON
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 18, alignItems: "flex-start" }}>
          <div className="card">
            <div className="card-head"><h3>People</h3></div>
            <div style={{ padding: 8 }}>
              {staff.map(p => (
                <button key={p.e} onClick={() => setEditingPerson(p.e)} style={{
                  width: "100%", textAlign: "left",
                  padding: "10px 12px",
                  background: editingPerson === p.e ? "var(--fs-navy-50)" : "transparent",
                  border: "1px solid " + (editingPerson === p.e ? "var(--fs-navy)" : "transparent"),
                  borderRadius: 4, cursor: "pointer", marginBottom: 4,
                  display: "flex", gap: 10, alignItems: "center",
                }}>
                  <Avatar name={p.n} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)" }}>{p.n}</div>
                    <div className="mut" style={{ fontSize: 11 }}>{p.t}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-head">
              <h3>Per-person overrides · {staff.find(s => s.e === editingPerson)?.n}</h3>
              <button className="btn ghost sm" onClick={() => setPerPerson(p => ({ ...p, [editingPerson]: { ...allRoles.staff } }))}>Reset to defaults</button>
            </div>
            <table className="tbl">
              <thead><tr><th style={{ width: 50 }}></th><th>Module</th><th>Default (staff)</th><th style={{ textAlign: "right" }}>For this person</th></tr></thead>
              <tbody>
                {modulesList.filter(m => !(m.staffOnly && false)).map(m => {
                  const def = !!allRoles.staff[m.id];
                  const person = !!personPrefs[m.id];
                  const overridden = def !== person;
                  return (
                    <tr key={m.id}>
                      <td><Icon name={iconForModule(m.id)} size={16} color="var(--fs-navy)" /></td>
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--fs-navy)" }}>{m.label}</div>
                        {overridden && <div style={{ fontSize: 10, color: "var(--fs-gold-700)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>Override</div>}
                      </td>
                      <td>{def ? <Tag tone="navy" dot>On</Tag> : <Tag tone="outline">Off</Tag>}</td>
                      <td style={{ textAlign: "right" }}>
                        {m.mandatory ? <Tag tone="success">Always on</Tag>
                          : <Toggle on={person} onChange={() => setPersonPref(m.id, !person)} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ on, onChange, disabled }) {
  return (
    <span onClick={() => !disabled && onChange()} style={{
      display: "inline-block",
      width: 34, height: 20,
      borderRadius: 999,
      background: on ? "var(--fs-gold)" : "var(--fs-bone-200)",
      position: "relative",
      transition: "background 160ms",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.6 : 1,
    }}>
      <span style={{
        position: "absolute", top: 2,
        left: on ? 16 : 2,
        width: 16, height: 16,
        background: on ? "var(--fs-navy-900)" : "var(--fs-paper)",
        borderRadius: "50%",
        transition: "left 160ms",
      }} />
    </span>
  );
}

function iconForModule(id) {
  return ({
    home: "home", calendar: "calendar", design: "pen", proposals: "compass",
    media: "comment", election: "tv", voter: "users", polling: "trend-up",
    stakeholders: "key", resources: "book", onboarding: "flag",
  })[id] || "circle";
}

function moduleDesc(id) {
  return ({
    home: "Dashboard. Always visible.",
    calendar: "Race + deadline calendar across accounts.",
    design: "Design brief intake, proofing, Drive folders.",
    proposals: "Drag-block proposal builder.",
    media: "Muck Rack feed — mentions, journalists, narratives.",
    election: "Live race manager, result strips, war room. Off by default.",
    voter: "Voter file explorer, crosstabs, precinct maps.",
    polling: "Topline + crosstabs library. Per-poll release controls in Permissions.",
    stakeholders: "Tiered outreach with status tracking & notes.",
    resources: "Memos, past creative, playbooks, templates.",
    onboarding: "First-two-weeks checklist + buddy. New staff only.",
  })[id] || "";
}

function AdminAnnouncements() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, alignItems: "flex-start" }}>
      <div className="card">
        <div className="card-head">
          <h3>Posts</h3>
          <button className="btn primary sm"><Icon name="plus" size={12} /> New post</button>
        </div>
        <table className="tbl">
          <thead><tr><th>Title</th><th>Audience</th><th>Status</th><th>Posted by</th><th>Date</th><th></th></tr></thead>
          <tbody>
            {[
              { t: "Election Night protocol — May 21 primaries", a: "Staff + Admin", s: "Pinned",   w: "Reiter", d: "2h ago" },
              { t: "New polling unlocked for Aoki for Senate",   a: "All",           s: "Live",     w: "Voss",   d: "Yesterday" },
              { t: "Voter file refresh — TargetSmart 5/19",      a: "Staff + Admin", s: "Live",     w: "Park",   d: "Yesterday" },
              { t: "Office closed Memorial Day",                  a: "All",          s: "Scheduled", w: "Ops",   d: "Posts May 24" },
              { t: "Q2 conflicts disclosure due",                 a: "Staff + Admin", s: "Draft",    w: "Reiter", d: "—" },
            ].map((r, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600, color: "var(--fs-navy)" }}>{r.t}</td>
                <td className="mut">{r.a}</td>
                <td><Tag tone={r.s === "Pinned" ? "gold" : r.s === "Live" ? "success" : r.s === "Scheduled" ? "navy" : "outline"}>{r.s}</Tag></td>
                <td className="mut">{r.w}</td>
                <td className="mut num">{r.d}</td>
                <td style={{ textAlign: "right" }}><button className="btn ghost sm"><Icon name="more" size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card card-pad">
        <Eyebrow>Compose post</Eyebrow>
        <div className="field" style={{ marginTop: 14 }}>
          <label>Title</label>
          <input className="input" placeholder="Short headline (≤10 words)" />
        </div>
        <div className="field">
          <label>Body</label>
          <textarea className="input" rows={4} placeholder="One sentence summary, then any links or details." />
        </div>
        <div className="field">
          <label>Audience</label>
          <select className="input"><option>All — staff, admin & client</option><option>Staff + Admin</option><option>Specific accounts…</option></select>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn secondary" style={{ flex: 1 }}>Save draft</button>
          <button className="btn primary" style={{ flex: 1 }}>Publish</button>
        </div>
        <label className="row" style={{ marginTop: 12, fontSize: 12, color: "var(--fs-fg-muted)" }}>
          <input type="checkbox" style={{ accentColor: "var(--fs-gold)" }} /> Pin to top of Home feed
        </label>
      </div>
    </div>
  );
}

function AdminUsers() {
  const users = [
    { n: "Margaret Voss",    r: "Staff", t: "Public Affairs",  e: "mvoss@fogsignal.co",    last: "Active now" },
    { n: "Jonas Reiter",     r: "Admin", t: "Operations",      e: "jreiter@fogsignal.co",  last: "Active now" },
    { n: "Eli Park",         r: "Staff", t: "Data & Analytics",e: "epark@fogsignal.co",    last: "12 min" },
    { n: "Drew Cole",        r: "Staff", t: "Design",          e: "dcole@fogsignal.co",    last: "1h" },
    { n: "Priya Shah",       r: "Staff", t: "Design",          e: "pshah@fogsignal.co",    last: "3h" },
    { n: "Hannah Liu",       r: "Staff", t: "Public Affairs",  e: "hliu@fogsignal.co",     last: "Yesterday" },
    { n: "Senator Aoki",     r: "Client", t: "Aoki for Senate",e: "campaign@aoki26.org",   last: "2h" },
    { n: "Robert Bishop",    r: "Client", t: "Coastal Renewal",e: "rbishop@coastalrenewal.org", last: "Yesterday" },
    { n: "Lena Harden",      r: "Client", t: "Harden NJ-3",    e: "lena@hardenfornj.com",  last: "May 18" },
  ];
  return (
    <div className="card">
      <div className="card-head">
        <h3>People · {users.length}</h3>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn secondary sm"><Icon name="filter" size={12} /> Filter</button>
          <button className="btn primary sm"><Icon name="plus" size={12} /> Invite</button>
        </div>
      </div>
      <table className="tbl">
        <thead><tr><th>Person</th><th>Role</th><th>Team / Account</th><th>Email</th><th>Last active</th><th></th></tr></thead>
        <tbody>
          {users.map(u => (
            <tr key={u.e}>
              <td>
                <div className="row" style={{ gap: 10 }}>
                  <Avatar name={u.n} size={26} />
                  <span style={{ fontWeight: 600, color: "var(--fs-navy)" }}>{u.n}</span>
                </div>
              </td>
              <td><Tag tone={u.r === "Admin" ? "gold" : u.r === "Client" ? "outline" : "navy"}>{u.r}</Tag></td>
              <td className="mut">{u.t}</td>
              <td className="mut" style={{ fontFamily: "var(--fs-font-mono)", fontSize: 12 }}>{u.e}</td>
              <td className="mut">{u.last}</td>
              <td style={{ textAlign: "right" }}><button className="btn ghost sm"><Icon name="more" size={14} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminPermissions() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
      {[
        { account: "Aoki for Senate", contact: "Senator Aoki", releases: [
          { n: "Topline polling",         on: true },
          { n: "Issue battery",           on: true },
          { n: "Ad-test results",         on: false },
          { n: "Banner / crosstabs",      on: false },
          { n: "Raw respondent data",     on: false },
          { n: "Active design proofs",    on: true },
          { n: "Memos & briefings",       on: true },
          { n: "PDF export",              on: true },
          { n: "CSV / banner export",     on: false },
        ]},
        { account: "Citizens for Coastal Renewal", contact: "Robert Bishop", releases: [
          { n: "Topline polling",         on: true },
          { n: "Issue battery",           on: true },
          { n: "Ad-test results",         on: false },
          { n: "Banner / crosstabs",      on: false },
          { n: "Raw respondent data",     on: false },
          { n: "Active design proofs",    on: true },
          { n: "Memos & briefings",       on: false },
          { n: "PDF export",              on: true },
          { n: "CSV / banner export",     on: false },
        ]},
      ].map(a => (
        <div key={a.account} className="card">
          <div className="card-head"><h3>{a.account}</h3><a className="card-link" href="#">View {a.contact} →</a></div>
          <div style={{ padding: "8px 16px" }}>
            {a.releases.map(r => (
              <label key={r.n} className="row between" style={{ padding: "10px 4px", borderBottom: "1px solid var(--fs-border)", cursor: "pointer" }}>
                <span style={{ fontSize: 13, color: r.on ? "var(--fs-navy)" : "var(--fs-fg)", fontWeight: r.on ? 600 : 400 }}>
                  {r.n}
                </span>
                <span style={{
                  width: 32, height: 18,
                  borderRadius: 999,
                  background: r.on ? "var(--fs-gold)" : "var(--fs-bone-200)",
                  position: "relative", transition: "background 160ms",
                }}>
                  <span style={{
                    position: "absolute", top: 2,
                    left: r.on ? 16 : 2,
                    width: 14, height: 14,
                    background: r.on ? "var(--fs-navy-900)" : "var(--fs-paper)",
                    borderRadius: "50%",
                    transition: "left 160ms",
                  }} />
                </span>
                <input type="checkbox" defaultChecked={r.on} style={{ display: "none" }} />
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminAudit() {
  const log = [
    { who: "Jonas Reiter", what: "Released \"Issue battery\" to Aoki for Senate",      cat: "Permissions", at: "10:42 AM today" },
    { who: "Eli Park",     what: "Imported TargetSmart 5/19 voter file (9.4M records)", cat: "Data",       at: "9:14 AM today" },
    { who: "Margaret Voss",what: "Approved design DR-237 — Harden direct mail #4",      cat: "Design",     at: "Yesterday 6:11 PM" },
    { who: "Jonas Reiter", what: "Invited user lena@hardenfornj.com (Client role)",     cat: "Users",       at: "Yesterday 4:52 PM" },
    { who: "System",       what: "Auto-locked session after 30 min inactivity (pshah@)",cat: "Security",   at: "Yesterday 3:30 PM" },
    { who: "Drew Cole",    what: "Uploaded v3 of Aoki Lighthouse 30s to Drive",         cat: "Design",     at: "Yesterday 10:42 AM" },
    { who: "Senator Aoki", what: "Viewed \"Statewide topline May 12–17\"",              cat: "Client view",at: "Yesterday 9:18 AM" },
  ];
  const cats = { "Permissions": "gold", "Data": "navy", "Design": "outline", "Users": "navy", "Security": "danger", "Client view": "success" };
  return (
    <div className="card">
      <div className="card-head"><h3>Audit log</h3>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn secondary sm"><Icon name="filter" size={12} /> Filter</button>
          <button className="btn secondary sm"><Icon name="download" size={12} /> Export</button>
        </div>
      </div>
      <table className="tbl">
        <thead><tr><th>Actor</th><th>Action</th><th>Category</th><th style={{ textAlign: "right" }}>When</th></tr></thead>
        <tbody>
          {log.map((l, i) => (
            <tr key={i}>
              <td>
                <div className="row" style={{ gap: 8 }}>
                  <Avatar name={l.who} size={22} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{l.who}</span>
                </div>
              </td>
              <td>{l.what}</td>
              <td><Tag tone={cats[l.cat]}>{l.cat}</Tag></td>
              <td className="mut num" style={{ textAlign: "right" }}>{l.at}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

window.AdminView = AdminView;
