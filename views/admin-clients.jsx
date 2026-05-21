/* global React */
const { useState: useStateClients } = React;

// ============================================================
// AdminClients — list + Add wizard + Edit settings
// ============================================================
function AdminClients() {
  const [mode, setMode]       = useStateClients("list"); // list | add | edit
  const [editingId, setEditingId] = useStateClients(null);

  // Seed clients with full settings, derived from global CLIENTS list
  const seedClients = (window.KEEL_CLIENTS || []).filter(c => c.id !== "all").map(c => ({
    id: c.id, name: c.name, tag: c.tag, initials: c.initials, color: c.color,
    type: c.type || "Campaign",
    desc: "Retained 2026 — strategic counsel, creative, and data.",
    state: c.id === "harden" ? "NJ" : "OH",
    district: c.id === "harden" ? "NJ-3" : c.id === "patel" ? "OH-12" : "Statewide",
    office: c.type?.includes("Senate") ? "U.S. Senate" : c.type?.includes("House") ? "U.S. House" : "—",
    audience: "Likely Democratic primary voters, ages 35+, persuadable suburban women",
    start: "2026-01-01", end: "2026-12-31",
    electionDay: c.id === "aoki" ? "2026-05-21" : c.id === "harden" ? "2026-05-27" : c.id === "patel" ? "2026-11-03" : "",
    retainer: "Monthly",
    deadlines: c.id === "aoki" ? [
      { label: "Q1 FEC filing", date: "2026-04-15" },
      { label: "Primary day",   date: "2026-05-21" },
      { label: "General day",   date: "2026-11-03" },
    ] : [{ label: "Q1 FEC filing", date: "2026-04-15" }],
    team: {
      lead:     "Margaret Voss",
      account:  "Jonas Reiter",
      designer: "Drew Cole",
      data:     "Eli Park",
      others:   ["Hannah Liu","Priya Shah"],
    },
    staffModules: { home: true, calendar: true, design: true, proposals: true, media: true, election: c.id === "aoki", voter: true, polling: true, stakeholders: true, resources: true, onboarding: true },
    clientModules:{ home: true, calendar: true, design: true, polling: true, stakeholders: true, resources: true },
    polling: { topline: true, issue: true, adtest: false, banner: false, raw: false },
    exports: { pdf: true, csv: false },
    contacts: c.id === "aoki" ? [
      { name: "Senator Maya Aoki", email: "campaign@aoki26.org", role: "Principal", views: "Full client view" },
      { name: "James Carter",      email: "jcarter@aoki26.org",  role: "Campaign manager", views: "Full client view" },
    ] : [{ name: "Primary contact", email: "contact@" + c.id + ".org", role: "Principal", views: "Full client view" }],
    status: "Active",
    invited: "Apr 14, 2026",
  }));

  const [clients, setClients] = useStateClients(seedClients);

  const createClient = (draft) => {
    setClients(cs => [...cs, { ...draft, id: draft.tag.toLowerCase(), invited: "Just now", status: "Invited" }]);
    setMode("list");
  };
  const updateClient = (id, patch) => {
    setClients(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c));
  };

  if (mode === "add") {
    return <AddClientWizard onCancel={() => setMode("list")} onCreate={createClient} existing={clients} />;
  }
  if (mode === "edit" && editingId) {
    const c = clients.find(c => c.id === editingId);
    if (!c) { setMode("list"); return null; }
    return <ClientSettings client={c} onClose={() => { setMode("list"); setEditingId(null); }} onSave={(patch) => updateClient(editingId, patch)} />;
  }

  return (
    <>
      <div className="row between" style={{ marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <Eyebrow>Clients · {clients.length} accounts</Eyebrow>
          <p className="mut" style={{ fontSize: 13, margin: "8px 0 0", maxWidth: 580, lineHeight: 1.55 }}>
            Add new clients, set engagement details, choose which Keel tabs they and their consultants see, and edit any field after the client is invited.
          </p>
        </div>
        <button className="btn primary" onClick={() => setMode("add")}><Icon name="plus" size={14} /> Add Client</button>
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Client</th>
              <th>Type</th>
              <th>Lead strategist</th>
              <th>Election day</th>
              <th>Modules</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {clients.map(c => {
              const staffOn = Object.values(c.staffModules || {}).filter(Boolean).length;
              const clientOn = Object.values(c.clientModules || {}).filter(Boolean).length;
              return (
                <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => { setEditingId(c.id); setMode("edit"); }}>
                  <td>
                    <div className="row" style={{ gap: 10 }}>
                      <span style={{ width: 30, height: 30, borderRadius: "50%", background: c.color, color: "var(--ks-on-ink)", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700 }}>{c.initials}</span>
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--fs-navy)" }}>{c.name}</div>
                        <div className="mut" style={{ fontSize: 11 }}>{c.state}{c.district !== "Statewide" ? " · " + c.district : ""}</div>
                      </div>
                    </div>
                  </td>
                  <td><Tag tone="outline">{c.type}</Tag></td>
                  <td className="mut">{c.team.lead}</td>
                  <td className="mut num">{c.electionDay || "—"}</td>
                  <td>
                    <div style={{ fontSize: 12 }}>
                      <span style={{ color: "var(--fs-navy)", fontWeight: 600 }}>{staffOn}</span> <span className="mut">staff</span> · <span style={{ color: "var(--fs-gold-700)", fontWeight: 600 }}>{clientOn}</span> <span className="mut">client</span>
                    </div>
                  </td>
                  <td><Tag tone={c.status === "Active" ? "success" : c.status === "Invited" ? "gold" : "outline"}>{c.status}</Tag></td>
                  <td style={{ textAlign: "right" }}><Icon name="chevron-right" size={14} color="var(--fs-fg-subtle)" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ============================================================
// AddClientWizard — 7-step structured onboarding
// ============================================================
function AddClientWizard({ onCancel, onCreate, existing }) {
  const [step, setStep] = useStateClients(0);
  const steps = [
    { id: "identity",  label: "Identity & brand" },
    { id: "calendar",  label: "Calendar & dates" },
    { id: "district",  label: "Geography & district" },
    { id: "team",      label: "Assign consultants" },
    { id: "modules",   label: "Tabs & permissions" },
    { id: "contacts",  label: "Client contacts" },
    { id: "review",    label: "Review & invite" },
  ];

  const [draft, setDraft] = useStateClients({
    name: "", tag: "", initials: "", color: "var(--fs-navy-600)",
    type: "Campaign", desc: "",
    state: "OH", district: "", office: "", audience: "",
    start: "", end: "", electionDay: "", retainer: "Monthly",
    deadlines: [{ label: "", date: "" }],
    team: { lead: "Margaret Voss", account: "Jonas Reiter", designer: "Drew Cole", data: "Eli Park", others: [] },
    staffModules:  { home: true, calendar: true, design: true, proposals: true, media: true, election: false, voter: true, polling: true, stakeholders: true, resources: true, onboarding: true },
    clientModules: { home: true, calendar: true, design: true, polling: true, stakeholders: false, resources: true },
    polling: { topline: true, issue: true, adtest: false, banner: false, raw: false },
    exports: { pdf: true, csv: false },
    contacts: [{ name: "", email: "", role: "Principal", views: "Full client view" }],
  });

  const upd  = (patch) => setDraft(d => ({ ...d, ...patch }));
  const updT = (patch) => setDraft(d => ({ ...d, team: { ...d.team, ...patch } }));
  const updM = (which, key, on) => setDraft(d => ({ ...d, [which]: { ...d[which], [key]: on } }));

  // Auto-derive initials + tag from name
  React.useEffect(() => {
    if (!draft.name) return;
    const initials = draft.name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
    const tag = draft.name.split(/\s+/)[0].toUpperCase().slice(0, 8);
    setDraft(d => ({ ...d, initials, tag }));
  }, [draft.name]);

  const canNext = (() => {
    if (step === 0) return draft.name.trim().length > 1 && draft.type;
    if (step === 1) return !!draft.start;
    if (step === 3) return !!draft.team.lead;
    if (step === 5) return draft.contacts.some(c => c.email);
    return true;
  })();

  return (
    <div>
      <div className="row between" style={{ alignItems: "flex-start", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <div>
          <Eyebrow>Admin · Onboarding</Eyebrow>
          <h2 style={{ fontFamily: "var(--fs-font-display)", fontSize: 30, fontWeight: 700, color: "var(--fs-navy)", margin: "10px 0 4px", letterSpacing: "-0.01em" }}>
            Add a new client
          </h2>
          <p className="mut" style={{ fontSize: 14, margin: 0, maxWidth: 580 }}>
            A structured intake so every retainer has the same baseline of identity, calendar, team, and access. Editable later from the client's settings page.
          </p>
        </div>
        <button className="btn ghost" onClick={onCancel}><Icon name="x" size={14} /> Cancel</button>
      </div>

      {/* Stepper */}
      <div className="card" style={{ marginBottom: 18, padding: "16px 22px" }}>
        <div className="row" style={{ gap: 0, overflowX: "auto" }}>
          {steps.map((s, i) => (
            <button key={s.id} onClick={() => i <= step && setStep(i)} disabled={i > step}
              style={{
                flex: 1, minWidth: 120, padding: "8px 6px",
                background: "transparent", border: "none",
                borderBottom: "2px solid " + (i === step ? "var(--fs-gold)" : (i < step ? "var(--fs-success)" : "var(--fs-border)")),
                cursor: i <= step ? "pointer" : "not-allowed",
                textAlign: "left",
              }}>
              <div className="row" style={{ gap: 8, marginBottom: 3 }}>
                <span style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: i < step ? "var(--fs-success)" : (i === step ? "var(--fs-gold)" : "var(--fs-bone-100)"),
                  color: i < step ? "var(--fs-paper)" : (i === step ? "var(--fs-navy-900)" : "var(--fs-fg-muted)"),
                  display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700,
                }}>{i < step ? <Icon name="check" size={12} /> : i + 1}</span>
                <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, color: i === step ? "var(--fs-navy)" : "var(--fs-fg-muted)" }}>{s.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="card card-pad" style={{ minHeight: 360 }}>
        {step === 0 && <StepIdentity draft={draft} upd={upd} />}
        {step === 1 && <StepCalendar draft={draft} upd={upd} />}
        {step === 2 && <StepDistrict draft={draft} upd={upd} />}
        {step === 3 && <StepTeam     draft={draft} updT={updT} />}
        {step === 4 && <StepModules  draft={draft} updM={updM} upd={upd} />}
        {step === 5 && <StepContacts draft={draft} upd={upd} />}
        {step === 6 && <StepReview   draft={draft} />}
      </div>

      <div className="row between" style={{ marginTop: 18 }}>
        <button className="btn ghost" disabled={step === 0} onClick={() => setStep(s => Math.max(0, s - 1))}>
          <Icon name="chevron-left" size={14} /> Back
        </button>
        {step < steps.length - 1 ? (
          <button className="btn primary" disabled={!canNext} onClick={() => setStep(s => s + 1)}>
            Continue <Icon name="chevron-right" size={14} />
          </button>
        ) : (
          <button className="btn accent" onClick={() => onCreate(draft)}>
            <Icon name="check" size={14} /> Create client & send invites
          </button>
        )}
      </div>
    </div>
  );
}

// ----------- Step screens ----------------------------------------------
function StepIdentity({ draft, upd }) {
  const colors = ["var(--fs-navy)","var(--fs-navy-600)","var(--fs-gold-700)","#2F6B4F","#7A5AE0","#A8341E","#1E6B82"];
  return (
    <div>
      <Eyebrow>Step 1 · Identity & brand</Eyebrow>
      <h3 style={{ fontFamily: "var(--fs-font-display)", margin: "10px 0 6px", color: "var(--fs-navy)" }}>What are we calling them?</h3>
      <p className="mut" style={{ fontSize: 13, margin: "0 0 22px" }}>This name appears in the client switcher, on proposals, on memos. Use the formal name.</p>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18 }}>
        <div className="field">
          <label>Legal / display name</label>
          <input className="input" value={draft.name} onChange={e => upd({ name: e.target.value })} placeholder='e.g. "Citizens for Coastal Renewal"' />
        </div>
        <div className="field">
          <label>Short tag</label>
          <input className="input" value={draft.tag} onChange={e => upd({ tag: e.target.value.toUpperCase() })} maxLength={8} placeholder="COASTAL" />
          <div className="help">For URLs and Slack channels.</div>
        </div>
      </div>

      <div className="field">
        <label>Account type</label>
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          {["Campaign","Coalition","Trade association","Government affairs","Corporate","501(c)(4)"].map(t => (
            <button key={t} className={"btn " + (draft.type === t ? "primary" : "secondary")} style={{ padding: "6px 14px", fontSize: 12 }} onClick={() => upd({ type: t })}>{t}</button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Brand color</label>
        <div className="row" style={{ gap: 8 }}>
          {colors.map(c => (
            <button key={c} onClick={() => upd({ color: c })} aria-label={c} style={{
              width: 32, height: 32,
              background: c, borderRadius: "50%",
              border: draft.color === c ? "3px solid var(--fs-gold)" : "1px solid var(--fs-border)",
              cursor: "pointer",
            }} />
          ))}
        </div>
      </div>

      <div className="field">
        <label>One-line description</label>
        <textarea className="input" rows={2} value={draft.desc} onChange={e => upd({ desc: e.target.value })} placeholder="One sentence about the engagement and the client's goal." />
      </div>
    </div>
  );
}

function StepCalendar({ draft, upd }) {
  const addDeadline = () => upd({ deadlines: [...draft.deadlines, { label: "", date: "" }] });
  const updDeadline = (i, p) => upd({ deadlines: draft.deadlines.map((d, j) => j === i ? { ...d, ...p } : d) });
  const rmDeadline  = (i) => upd({ deadlines: draft.deadlines.filter((_, j) => j !== i) });
  return (
    <div>
      <Eyebrow>Step 2 · Calendar & dates</Eyebrow>
      <h3 style={{ fontFamily: "var(--fs-font-display)", margin: "10px 0 6px", color: "var(--fs-navy)" }}>The engagement window.</h3>
      <p className="mut" style={{ fontSize: 13, margin: "0 0 22px" }}>
        Election day is optional — if you set it, Keel will auto-enable the Election Night module for the assigned team 7 days before.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18 }}>
        <div className="field"><label>Engagement start</label><input className="input" type="date" value={draft.start} onChange={e => upd({ start: e.target.value })} /></div>
        <div className="field"><label>Engagement end</label><input className="input" type="date" value={draft.end} onChange={e => upd({ end: e.target.value })} /></div>
        <div className="field">
          <label>Retainer cadence</label>
          <select className="input" value={draft.retainer} onChange={e => upd({ retainer: e.target.value })}>
            <option>Monthly</option><option>Quarterly</option><option>Project</option><option>Non-retainer</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label>Election day(s)</label>
        <input className="input" type="date" value={draft.electionDay} onChange={e => upd({ electionDay: e.target.value })} />
        <div className="help">For multi-cycle clients (e.g. primary + general), add additional dates under Deadlines below.</div>
      </div>

      <div className="field">
        <label>Filing deadlines & key dates</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {draft.deadlines.map((d, i) => (
            <div key={i} className="row" style={{ gap: 8 }}>
              <input className="input" placeholder="Label (e.g. Q1 FEC filing)" value={d.label} onChange={e => updDeadline(i, { label: e.target.value })} style={{ flex: 2 }} />
              <input className="input" type="date" value={d.date} onChange={e => updDeadline(i, { date: e.target.value })} style={{ flex: 1 }} />
              <button className="btn ghost sm" onClick={() => rmDeadline(i)}><Icon name="x" size={13} /></button>
            </div>
          ))}
          <button className="btn secondary sm" style={{ alignSelf: "flex-start" }} onClick={addDeadline}>
            <Icon name="plus" size={12} /> Add deadline
          </button>
        </div>
      </div>
    </div>
  );
}

function StepDistrict({ draft, upd }) {
  return (
    <div>
      <Eyebrow>Step 3 · Geography & community</Eyebrow>
      <h3 style={{ fontFamily: "var(--fs-font-display)", margin: "10px 0 6px", color: "var(--fs-navy)" }}>Where are they fighting?</h3>
      <p className="mut" style={{ fontSize: 13, margin: "0 0 22px" }}>
        Used to scope voter file pulls, target precincts, and pre-load the polling explorer for the team.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18 }}>
        <div className="field">
          <label>State</label>
          <select className="input" value={draft.state} onChange={e => upd({ state: e.target.value })}>
            {["OH","NJ","VA","NY","PA","FL","TX","CA","WA","OR","NC","GA","AZ","NV","WI","MI","MN","CO"].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="field">
          <label>District / jurisdiction</label>
          <input className="input" value={draft.district} onChange={e => upd({ district: e.target.value })} placeholder="OH-12 or Statewide" />
        </div>
        <div className="field">
          <label>Office sought</label>
          <input className="input" value={draft.office} onChange={e => upd({ office: e.target.value })} placeholder="U.S. Senate, or n/a" />
        </div>
      </div>

      <div className="field">
        <label>Target voter universe / community</label>
        <textarea className="input" rows={3} value={draft.audience} onChange={e => upd({ audience: e.target.value })} placeholder="Who are the persuasion + GOTV targets? E.g. likely Democratic primary voters 35+, suburban women, persuadable indies." />
      </div>
    </div>
  );
}

function StepTeam({ draft, updT }) {
  const staff = ["Margaret Voss","Jonas Reiter","Eli Park","Drew Cole","Priya Shah","Hannah Liu"];
  const otherToggle = (n) => {
    const has = draft.team.others.includes(n);
    updT({ others: has ? draft.team.others.filter(x => x !== n) : [...draft.team.others, n] });
  };
  const roles = [
    { k: "lead",     l: "Lead strategist",        d: "Primary point of contact and senior counsel for the client." },
    { k: "account",  l: "Account lead / engagement principal", d: "Owns delivery, billing, weekly cadence." },
    { k: "designer", l: "Lead designer",          d: "Owns creative briefs, proofs, and Drive structure." },
    { k: "data",     l: "Data & analytics lead",  d: "Owns voter file pulls, polling fielding, and modeling." },
  ];
  return (
    <div>
      <Eyebrow>Step 4 · Assign consultants</Eyebrow>
      <h3 style={{ fontFamily: "var(--fs-font-display)", margin: "10px 0 6px", color: "var(--fs-navy)" }}>Who's on this account?</h3>
      <p className="mut" style={{ fontSize: 13, margin: "0 0 22px" }}>
        Anyone listed here gets the client in their workspace switcher and the matching Slack channels.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {roles.map(r => (
          <div key={r.k} className="field">
            <label>{r.l}</label>
            <select className="input" value={draft.team[r.k]} onChange={e => updT({ [r.k]: e.target.value })}>
              {staff.map(s => <option key={s}>{s}</option>)}
            </select>
            <div className="help">{r.d}</div>
          </div>
        ))}
      </div>

      <div className="field">
        <label>Additional team members</label>
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          {staff.map(s => {
            const on = draft.team.others.includes(s);
            return (
              <button key={s} onClick={() => otherToggle(s)} className={"btn " + (on ? "primary" : "secondary")}
                style={{ padding: "5px 10px", fontSize: 12 }}>
                {on && <Icon name="check" size={11} />} {s}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StepModules({ draft, updM, upd }) {
  const staffMods = [
    { id: "home", label: "Home", mandatory: true },
    { id: "calendar", label: "Calendar" },
    { id: "design", label: "Design Requests" },
    { id: "proposals", label: "Proposals" },
    { id: "media", label: "Media Monitoring" },
    { id: "election", label: "Election Night" },
    { id: "voter", label: "Voter Data" },
    { id: "polling", label: "Polling" },
    { id: "stakeholders", label: "Stakeholders" },
    { id: "resources", label: "Resources" },
    { id: "onboarding", label: "Onboarding" },
  ];
  const clientMods = [
    { id: "home", label: "Home dashboard", mandatory: true },
    { id: "calendar", label: "Calendar" },
    { id: "design", label: "Design proofs" },
    { id: "polling", label: "Polling (released items only)" },
    { id: "stakeholders", label: "Stakeholders" },
    { id: "resources", label: "Memos & resources" },
  ];

  return (
    <div>
      <Eyebrow>Step 5 · Tabs & permissions</Eyebrow>
      <h3 style={{ fontFamily: "var(--fs-font-display)", margin: "10px 0 6px", color: "var(--fs-navy)" }}>What can each side see?</h3>
      <p className="mut" style={{ fontSize: 13, margin: "0 0 22px" }}>
        Defaults shown below. You can change these later from the client's settings page.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div className="card" style={{ background: "var(--fs-bone-50)" }}>
          <div className="card-head"><h3>Staff working on this account</h3></div>
          <div style={{ padding: "8px 16px" }}>
            {staffMods.map(m => (
              <ModuleRow key={m.id} m={m}
                on={!!draft.staffModules[m.id]}
                onChange={(v) => updM("staffModules", m.id, v)} />
            ))}
          </div>
        </div>
        <div className="card" style={{ background: "var(--fs-bone-50)" }}>
          <div className="card-head"><h3>Client portal</h3></div>
          <div style={{ padding: "8px 16px" }}>
            {clientMods.map(m => (
              <ModuleRow key={m.id} m={m}
                on={!!draft.clientModules[m.id]}
                onChange={(v) => updM("clientModules", m.id, v)} />
            ))}
          </div>
        </div>
      </div>

      <div className="divider" />
      <Eyebrow>Polling release defaults</Eyebrow>
      <p className="mut" style={{ fontSize: 13, margin: "8px 0 14px" }}>What does the client see automatically when polling is uploaded? Toggle off anything that should stay internal until reviewed.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {[
          { id: "topline", l: "Topline numbers" },
          { id: "issue",   l: "Issue battery" },
          { id: "adtest",  l: "Ad test results" },
          { id: "banner",  l: "Banner / crosstabs" },
          { id: "raw",     l: "Raw respondent data" },
        ].map(p => (
          <label key={p.id} className="row" style={{ padding: "8px 12px", border: "1px solid var(--fs-border)", borderRadius: 4, fontSize: 13, cursor: "pointer", background: draft.polling[p.id] ? "var(--fs-navy-50)" : "transparent" }}>
            <input type="checkbox" checked={!!draft.polling[p.id]} onChange={(e) => upd({ polling: { ...draft.polling, [p.id]: e.target.checked } })} style={{ accentColor: "var(--fs-gold)" }} />
            {p.l}
          </label>
        ))}
      </div>

      <div className="divider" />
      <Eyebrow>Export permissions for client</Eyebrow>
      <div className="row" style={{ gap: 8, marginTop: 10 }}>
        {[{ id: "pdf", l: "PDF exports" }, { id: "csv", l: "CSV / raw exports" }].map(x => (
          <label key={x.id} className="row" style={{ padding: "8px 14px", border: "1px solid var(--fs-border)", borderRadius: 4, fontSize: 13, cursor: "pointer", background: draft.exports[x.id] ? "var(--fs-navy-50)" : "transparent" }}>
            <input type="checkbox" checked={!!draft.exports[x.id]} onChange={(e) => upd({ exports: { ...draft.exports, [x.id]: e.target.checked } })} style={{ accentColor: "var(--fs-gold)" }} />
            {x.l}
          </label>
        ))}
      </div>
    </div>
  );
}

function ModuleRow({ m, on, onChange }) {
  return (
    <label className="row between" style={{ padding: "9px 4px", borderBottom: "1px solid var(--fs-border)", cursor: m.mandatory ? "not-allowed" : "pointer" }}>
      <span style={{ fontSize: 13, color: "var(--fs-ink)", fontWeight: on || m.mandatory ? 600 : 400 }}>{m.label}</span>
      <span style={{
        width: 32, height: 18, borderRadius: 999,
        background: (on || m.mandatory) ? "var(--fs-gold)" : "var(--fs-bone-200)",
        position: "relative", transition: "background 160ms",
        opacity: m.mandatory ? 0.5 : 1,
      }}>
        <span style={{ position: "absolute", top: 2, left: (on || m.mandatory) ? 16 : 2, width: 14, height: 14, background: (on || m.mandatory) ? "var(--fs-navy-900)" : "var(--fs-paper)", borderRadius: "50%", transition: "left 160ms" }} />
      </span>
      <input type="checkbox" checked={on || m.mandatory} disabled={m.mandatory} onChange={(e) => onChange(e.target.checked)} style={{ display: "none" }} />
    </label>
  );
}

function StepContacts({ draft, upd }) {
  const updC = (i, p) => upd({ contacts: draft.contacts.map((c, j) => j === i ? { ...c, ...p } : c) });
  const addC = () => upd({ contacts: [...draft.contacts, { name: "", email: "", role: "Staff contact", views: "Full client view" }] });
  const rmC = (i) => upd({ contacts: draft.contacts.filter((_, j) => j !== i) });

  return (
    <div>
      <Eyebrow>Step 6 · Client contacts</Eyebrow>
      <h3 style={{ fontFamily: "var(--fs-font-display)", margin: "10px 0 6px", color: "var(--fs-navy)" }}>Who do we invite?</h3>
      <p className="mut" style={{ fontSize: 13, margin: "0 0 22px" }}>
        Each contact gets a magic-link invite to the client portal scoped to this account.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {draft.contacts.map((c, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 1fr 1fr 40px", gap: 8, alignItems: "center" }}>
            <input className="input" placeholder="Name" value={c.name} onChange={e => updC(i, { name: e.target.value })} />
            <input className="input" type="email" placeholder="email@example.com" value={c.email} onChange={e => updC(i, { email: e.target.value })} />
            <input className="input" placeholder="Role / title" value={c.role} onChange={e => updC(i, { role: e.target.value })} />
            <select className="input" value={c.views} onChange={e => updC(i, { views: e.target.value })}>
              <option>Full client view</option>
              <option>Read-only</option>
              <option>Polling only</option>
              <option>Design proofs only</option>
            </select>
            <button className="btn ghost sm" onClick={() => rmC(i)}><Icon name="x" size={13} /></button>
          </div>
        ))}
        <button className="btn secondary sm" style={{ alignSelf: "flex-start" }} onClick={addC}><Icon name="plus" size={12} /> Add contact</button>
      </div>
    </div>
  );
}

function StepReview({ draft }) {
  const onModules = (m) => Object.keys(m).filter(k => m[k]);
  return (
    <div>
      <Eyebrow>Step 7 · Review & invite</Eyebrow>
      <h3 style={{ fontFamily: "var(--fs-font-display)", margin: "10px 0 6px", color: "var(--fs-navy)" }}>Ready to send.</h3>
      <p className="mut" style={{ fontSize: 13, margin: "0 0 22px" }}>
        Hitting "Create" provisions the Drive folders, Slack channels, and sends the invites.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <ReviewBlock title="Identity">
          <div className="row" style={{ gap: 12, marginBottom: 10 }}>
            <span style={{ width: 40, height: 40, borderRadius: "50%", background: draft.color, color: "var(--ks-on-ink)", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700 }}>{draft.initials}</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--fs-navy)" }}>{draft.name || "[Client name]"}</div>
              <div className="mut" style={{ fontSize: 12 }}>{draft.type} · tag {draft.tag || "—"}</div>
            </div>
          </div>
          <p className="mut" style={{ fontSize: 13, margin: 0 }}>{draft.desc || <em>No description.</em>}</p>
        </ReviewBlock>

        <ReviewBlock title="Engagement">
          <Row k="Start" v={draft.start || "—"} />
          <Row k="End" v={draft.end || "—"} />
          <Row k="Election day" v={draft.electionDay || "—"} />
          <Row k="Retainer" v={draft.retainer} />
          <Row k="Key deadlines" v={draft.deadlines.filter(d => d.label).length + " set"} />
        </ReviewBlock>

        <ReviewBlock title="Geography">
          <Row k="State" v={draft.state} />
          <Row k="District" v={draft.district || "—"} />
          <Row k="Office" v={draft.office || "—"} />
          <Row k="Universe" v={draft.audience ? draft.audience.slice(0, 80) + "…" : "—"} />
        </ReviewBlock>

        <ReviewBlock title="Team">
          <Row k="Lead strategist" v={draft.team.lead} />
          <Row k="Account lead" v={draft.team.account} />
          <Row k="Designer" v={draft.team.designer} />
          <Row k="Data lead" v={draft.team.data} />
          <Row k="Others" v={draft.team.others.length > 0 ? draft.team.others.join(", ") : "—"} />
        </ReviewBlock>

        <ReviewBlock title="Tabs & permissions">
          <Row k="Staff modules" v={onModules(draft.staffModules).length + " of 11 on"} />
          <Row k="Client modules" v={onModules(draft.clientModules).length + " of 6 on"} />
          <Row k="Polling released" v={onModules(draft.polling).join(", ") || "none"} />
          <Row k="Exports" v={onModules(draft.exports).map(x => x.toUpperCase()).join(", ") || "none"} />
        </ReviewBlock>

        <ReviewBlock title="Invites">
          {draft.contacts.filter(c => c.email).map((c, i) => (
            <div key={i} style={{ fontSize: 13, color: "var(--fs-navy)", marginBottom: 4 }}>
              <strong>{c.name || "(no name)"}</strong> · <span style={{ fontFamily: "var(--fs-font-mono)" }}>{c.email}</span>
            </div>
          ))}
        </ReviewBlock>
      </div>
    </div>
  );
}

function ReviewBlock({ title, children }) {
  return (
    <div style={{ padding: 16, border: "1px solid var(--fs-border)", borderRadius: 4, background: "var(--fs-paper)" }}>
      <div className="lbl" style={{ marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
function Row({ k, v }) {
  return (
    <div className="row between" style={{ padding: "5px 0", fontSize: 13, borderBottom: "1px solid var(--fs-border)" }}>
      <span className="mut">{k}</span>
      <span style={{ fontWeight: 600, color: "var(--fs-navy)", textAlign: "right" }}>{v}</span>
    </div>
  );
}

// ============================================================
// ClientSettings — flat tabbed editor for an existing client
// ============================================================
function ClientSettings({ client, onClose, onSave }) {
  const [tab, setTab] = useStateClients("identity");
  const [c, setC] = useStateClients(client);
  const upd = (patch) => setC(prev => { const next = { ...prev, ...patch }; onSave(patch); return next; });
  const updM = (which, key, on) => upd({ [which]: { ...c[which], [key]: on } });

  const tabs = [
    { id: "identity", label: "Identity" },
    { id: "calendar", label: "Calendar" },
    { id: "district", label: "Geography" },
    { id: "team",     label: "Team" },
    { id: "modules",  label: "Tabs & permissions" },
    { id: "contacts", label: "Contacts" },
    { id: "danger",   label: "Status & archive" },
  ];

  return (
    <div>
      <div className="row between" style={{ alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div className="row" style={{ gap: 14, alignItems: "center" }}>
          <button className="btn ghost" onClick={onClose}><Icon name="chevron-left" size={14} /> All clients</button>
          <span style={{ width: 40, height: 40, borderRadius: "50%", background: c.color, color: "var(--ks-on-ink)", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700 }}>{c.initials}</span>
          <div>
            <Eyebrow>Client settings</Eyebrow>
            <h2 style={{ fontFamily: "var(--fs-font-display)", fontSize: 24, fontWeight: 700, color: "var(--fs-navy)", margin: "4px 0 0", letterSpacing: "-0.005em" }}>{c.name}</h2>
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Tag tone={c.status === "Active" ? "success" : c.status === "Invited" ? "gold" : "outline"}>{c.status}</Tag>
          <span className="mut" style={{ fontSize: 12 }}>Invited {c.invited}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--fs-border)", marginBottom: 22 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "10px 18px", background: "transparent", border: "none",
            borderBottom: "2px solid " + (tab === t.id ? "var(--fs-gold)" : "transparent"),
            color: tab === t.id ? "var(--fs-navy)" : "var(--fs-fg-muted)",
            fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      <div className="card card-pad">
        {tab === "identity" && <StepIdentity draft={c} upd={upd} />}
        {tab === "calendar" && <StepCalendar draft={c} upd={upd} />}
        {tab === "district" && <StepDistrict draft={c} upd={upd} />}
        {tab === "team"     && <StepTeam     draft={c} updT={(p) => upd({ team: { ...c.team, ...p } })} />}
        {tab === "modules"  && <StepModules  draft={c} updM={updM} upd={upd} />}
        {tab === "contacts" && <StepContacts draft={c} upd={upd} />}
        {tab === "danger"   && <DangerZone   c={c} upd={upd} />}
      </div>

      <div className="row" style={{ justifyContent: "flex-end", marginTop: 16, gap: 8 }}>
        <button className="btn secondary" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

function DangerZone({ c, upd }) {
  return (
    <div>
      <Eyebrow>Status & archive</Eyebrow>
      <h3 style={{ fontFamily: "var(--fs-font-display)", margin: "10px 0 18px", color: "var(--fs-navy)" }}>Lifecycle controls</h3>

      <div className="field">
        <label>Current status</label>
        <div className="row" style={{ gap: 6 }}>
          {["Invited","Active","Paused","Archived"].map(s => (
            <button key={s} onClick={() => upd({ status: s })} className={"btn " + (c.status === s ? "primary" : "secondary")} style={{ padding: "6px 12px", fontSize: 12 }}>{s}</button>
          ))}
        </div>
        <div className="help">
          <strong style={{ color: "var(--fs-navy)" }}>Invited</strong>: client emails sent, not yet activated.{" "}
          <strong style={{ color: "var(--fs-navy)" }}>Paused</strong>: portal hidden from client but assets retained.{" "}
          <strong style={{ color: "var(--fs-navy)" }}>Archived</strong>: read-only for staff, removed from client switcher.
        </div>
      </div>

      <div className="divider" />

      <div style={{ background: "rgba(168,52,30,0.06)", border: "1px solid rgba(168,52,30,0.2)", borderRadius: 4, padding: "16px 20px" }}>
        <div style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, color: "var(--fs-danger)", fontSize: 15, marginBottom: 6 }}>Permanently remove client</div>
        <p className="mut" style={{ fontSize: 13, margin: "0 0 12px", lineHeight: 1.55 }}>
          Wipes all Keel-side data for this account. Drive folders and Odoo records are preserved; the connection is just removed.
          Audit-logged. Requires partner-level confirmation.
        </p>
        <button className="btn danger">Remove from Keel…</button>
      </div>
    </div>
  );
}

window.AdminClients = AdminClients;
