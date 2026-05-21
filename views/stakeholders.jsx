/* global React */
const { useState: useStateStake, useMemo: useMemoStake } = React;

function StakeholdersView({ user, role, client, clientId }) {
  const [tab, setTab] = useStateStake("list");
  const [selected, setSelected] = useStateStake(null);
  const [tierFilter, setTierFilter] = useStateStake("all");
  const [statusFilter, setStatusFilter] = useStateStake("all");
  const [query, setQuery] = useStateStake("");

  const tiers = {
    1: { label: "Tier 1 · Priority targets",   c: "var(--fs-gold-700)" },
    2: { label: "Tier 2 · Supporting voices",  c: "var(--fs-navy)" },
    3: { label: "Tier 3 · Long-tail outreach", c: "var(--fs-ink-500)" },
  };

  const statuses = {
    "to-contact":  { label: "To contact",      c: "var(--fs-fg-subtle)",  bg: "var(--fs-bone-100)" },
    "outreach":    { label: "Outreach sent",   c: "var(--fs-navy)",       bg: "var(--fs-navy-50)" },
    "in-progress": { label: "In conversation", c: "var(--fs-gold-700)",   bg: "var(--fs-gold-100)" },
    "committed":   { label: "Committed",       c: "var(--fs-success)",    bg: "rgba(47,107,79,0.10)" },
    "declined":    { label: "Declined",        c: "var(--fs-danger)",     bg: "rgba(168,52,30,0.10)" },
    "followup":    { label: "Follow-up needed",c: "var(--fs-danger)",     bg: "rgba(239,197,63,0.16)" },
  };

  // ----- Stakeholder corpus (mocked across clients) -----
  const allStakeholders = [
    // Coastal Renewal coalition
    { id: 1, name: "Mayor Carla Whitfield",     org: "City of Newport News",            title: "Mayor",                  client: "coastal", tier: 1, status: "committed",   email: "cwhitfield@nnva.gov",   phone: "(757) 555-0142", owner: "M. Voss",  last: "May 18", followups: 0, support: "Public endorsement & op-ed" },
    { id: 2, name: "Sec. Henry Tomlinson",      org: "State Department of Resources",   title: "Secretary",              client: "coastal", tier: 1, status: "in-progress", email: "h.tomlinson@dnr.gov",    phone: "(804) 555-0231", owner: "M. Voss",  last: "May 17", followups: 1, support: "Reviewing draft policy" },
    { id: 3, name: "Dr. Mira Acosta",           org: "VIMS — Coastal Resilience Lab",   title: "Director",               client: "coastal", tier: 1, status: "committed",   email: "macosta@vims.edu",       phone: "(757) 555-0188", owner: "M. Voss",  last: "May 15", followups: 0, support: "Quoted in launch release" },
    { id: 4, name: "Rev. James Anhouse",        org: "Hampton Faith Coalition",         title: "Convener",               client: "coastal", tier: 2, status: "in-progress", email: "rev.anhouse@hfaith.org", phone: "(757) 555-0322", owner: "H. Liu",   last: "May 14", followups: 1, support: "Coalition partner ask" },
    { id: 5, name: "Naomi Park-Bowers",         org: "Working Watermen Alliance",       title: "Exec. Director",         client: "coastal", tier: 1, status: "followup",    email: "naomi@wwalliance.org",   phone: "(757) 555-0410", owner: "H. Liu",   last: "May 09", followups: 3, support: "Concerned about Tier-3 levy framing" },
    { id: 6, name: "Sen. Marisol Greaves",      org: "Virginia State Senate, D-08",     title: "State Senator",          client: "coastal", tier: 2, status: "outreach",    email: "sen.greaves@senate.va.gov", phone: "(804) 555-0612", owner: "M. Voss", last: "May 12", followups: 0, support: "Awaiting reply to outreach" },
    { id: 7, name: "Andrew Calo",               org: "Calo & Sons Seafood",             title: "Owner",                  client: "coastal", tier: 3, status: "to-contact",  email: "a.calo@caloseafood.com", phone: "(757) 555-0708", owner: "H. Liu",   last: "—",      followups: 0, support: "Small-business voice" },
    { id: 8, name: "Cmdr. Reed Falcone (Ret.)", org: "Naval Officers for Coast Safety", title: "Spokesperson",           client: "coastal", tier: 2, status: "committed",   email: "reed@nofcs.org",         phone: "(757) 555-0816", owner: "M. Voss",  last: "May 16", followups: 0, support: "Endorsed; willing to testify" },

    // Aoki — federal senate
    { id: 9, name: "Rep. Anjali Patel",         org: "OH-12 · U.S. House",              title: "Congresswoman",          client: "aoki",    tier: 1, status: "committed",   email: "patel@mail.house.gov",   phone: "(202) 555-1108", owner: "M. Voss",  last: "May 19", followups: 0, support: "Will appear at rallies" },
    { id: 10, name: "AFL-CIO Ohio",             org: "AFL-CIO · Ohio chapter",          title: "Endorsement committee",  client: "aoki",    tier: 1, status: "in-progress", email: "endorse@aflcio-oh.org",  phone: "(614) 555-1232", owner: "M. Voss",  last: "May 17", followups: 1, support: "Awaiting board vote May 24" },
    { id: 11, name: "Dr. Henrietta Walsh",      org: "Ohio Education Association",      title: "President",              client: "aoki",    tier: 1, status: "committed",   email: "h.walsh@oea.org",        phone: "(614) 555-1340", owner: "M. Voss",  last: "May 14", followups: 0, support: "Public endorsement issued" },
    { id: 12, name: "Sherrod Beecher",          org: "Beecher PAC",                     title: "Treasurer",              client: "aoki",    tier: 2, status: "followup",    email: "sbeecher@beecherpac.com",phone: "(216) 555-1488", owner: "J. Reiter",last: "May 04", followups: 4, support: "PAC commitment pending memo" },
    { id: 13, name: "Pastor Lin Ahmadi",        org: "Cleveland Interfaith Coalition",  title: "Convener",               client: "aoki",    tier: 2, status: "in-progress", email: "linahmadi@cic-oh.org",   phone: "(216) 555-1562", owner: "H. Liu",   last: "May 11", followups: 1, support: "Considering joint event" },
    { id: 14, name: "Dr. Marcus Frye",          org: "Ohio State Univ.",                title: "Faculty senate chair",   client: "aoki",    tier: 3, status: "outreach",    email: "m.frye@osu.edu",         phone: "(614) 555-1644", owner: "H. Liu",   last: "May 12", followups: 0, support: "Initial outreach sent" },
    { id: 15, name: "Cleveland Plain Dealer Ed. Board", org: "Cleveland Plain Dealer", title: "Editorial board",          client: "aoki",    tier: 2, status: "to-contact",  email: "ed.board@cleveland.com", phone: "(216) 555-1720", owner: "M. Voss",  last: "—",      followups: 0, support: "Endorsement interview to schedule" },

    // Harden NJ-3
    { id: 16, name: "Rep. Mikie Sherrill",      org: "NJ-11 · U.S. House",              title: "Congresswoman",          client: "harden",  tier: 1, status: "committed",   email: "sherrill@mail.house.gov",phone: "(202) 555-1812", owner: "M. Voss",  last: "May 15", followups: 0, support: "Co-fundraiser confirmed Jun 6" },
    { id: 17, name: "Burlington County Dems",   org: "Burlington Democratic Cmte.",     title: "Chair",                  client: "harden",  tier: 1, status: "committed",   email: "chair@burlcodems.org",   phone: "(609) 555-1908", owner: "H. Liu",   last: "May 18", followups: 0, support: "Endorsed; field support" },
    { id: 18, name: "Building Trades NJ",       org: "NJ State Building Trades",        title: "President",              client: "harden",  tier: 2, status: "in-progress", email: "president@njbt.org",     phone: "(732) 555-2030", owner: "M. Voss",  last: "May 13", followups: 2, support: "Labor walk discussion" },
  ];

  // Filter by client + role
  const stakeholders = allStakeholders.filter(s => {
    if (clientId !== "all" && s.client !== clientId) return false;
    if (role === "client" && s.client !== "aoki") return false;
    return true;
  });

  const filtered = stakeholders
    .filter(s => tierFilter === "all" || s.tier === +tierFilter)
    .filter(s => statusFilter === "all" || s.status === statusFilter)
    .filter(s => !query || (s.name + " " + s.org).toLowerCase().includes(query.toLowerCase()));

  // Counts by status
  const counts = Object.keys(statuses).reduce((a, k) => { a[k] = stakeholders.filter(s => s.status === k).length; return a; }, {});
  const total = stakeholders.length;
  const committed = counts["committed"] || 0;

  const sel = selected ? stakeholders.find(s => s.id === selected) : null;

  return (
    <div>
      <PageHead
        eyebrow={clientId === "all" ? "Across all accounts" : (client?.name)}
        title="Stakeholder Outreach"
        sub={role === "client"
          ? "Where your campaign's coalition stands. Updated by your Fog Signal team."
          : "Track recommended outreach by tier, log interactions, and never lose track of who has and hasn't been called."}
        actions={role !== "client" && (
          <>
            <button className="btn secondary"><Icon name="upload" size={13} /> Import list (CSV)</button>
            <button className="btn secondary"><Icon name="download" size={13} /> Export</button>
            <button className="btn primary"><Icon name="plus" size={14} /> Add stakeholder</button>
          </>
        )}
      />

      {/* Stat strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 1, background: "var(--fs-border)", border: "1px solid var(--fs-border)", borderRadius: 4, marginBottom: 22, overflow: "hidden" }}>
        <div style={{ background: "var(--fs-paper)", padding: "14px 16px" }}>
          <div className="num" style={{ fontFamily: "var(--fs-font-display)", fontSize: 24, fontWeight: 700, color: "var(--fs-navy)" }}>{total}</div>
          <div className="mut" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600, marginTop: 2 }}>Total</div>
        </div>
        {Object.entries(statuses).map(([k, v]) => (
          <button key={k} onClick={() => setStatusFilter(statusFilter === k ? "all" : k)} style={{
            background: statusFilter === k ? v.bg : "var(--fs-paper)",
            padding: "14px 16px",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
            transition: "background 160ms",
          }}>
            <div className="num" style={{ fontFamily: "var(--fs-font-display)", fontSize: 24, fontWeight: 700, color: v.c }}>{counts[k] || 0}</div>
            <div className="mut" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600, marginTop: 2 }}>{v.label}</div>
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: sel ? "minmax(0, 1fr) 360px" : "1fr", gap: 24, alignItems: "flex-start" }}>
        <div>
          {/* Filter row */}
          <div className="row" style={{ gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <div className="search" style={{ width: 240, padding: "6px 10px" }}>
              <Icon name="search" size={13} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name or org" />
            </div>
            <div className="row" style={{ gap: 4 }}>
              <span className="lbl" style={{ margin: 0, marginRight: 6 }}>Tier</span>
              {["all","1","2","3"].map(t => (
                <button key={t} className={"btn " + (tierFilter === t ? "primary" : "secondary")} style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => setTierFilter(t)}>
                  {t === "all" ? "All" : "Tier " + t}
                </button>
              ))}
            </div>
            <div className="grow" />
            <div className="mut" style={{ fontSize: 12 }}>{filtered.length} of {total} stakeholders</div>
          </div>

          {/* Group by tier */}
          {[1, 2, 3].filter(t => tierFilter === "all" || +tierFilter === t).map(t => {
            const group = filtered.filter(s => s.tier === t);
            if (group.length === 0) return null;
            return (
              <div key={t} style={{ marginBottom: 22 }}>
                <div className="row" style={{ gap: 10, marginBottom: 10 }}>
                  <span style={{ fontFamily: "var(--fs-font-display)", fontSize: 11, fontWeight: 700, color: tiers[t].c, letterSpacing: "0.04em" }}>0{t}</span>
                  <span style={{ width: 30, height: 1, background: tiers[t].c, opacity: 0.5 }} />
                  <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "var(--fs-tracking-caps)", fontWeight: 600, color: "var(--fs-fg-muted)" }}>{tiers[t].label}</span>
                  <span className="num mut" style={{ fontSize: 11 }}>· {group.length}</span>
                </div>
                <div className="card">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Stakeholder</th>
                        <th>Organization</th>
                        <th>Status</th>
                        <th>Owner</th>
                        <th>Last contact</th>
                        <th style={{ textAlign: "right" }}>Followups</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.map(s => {
                        const st = statuses[s.status];
                        return (
                          <tr key={s.id} className={selected === s.id ? "selected" : ""} style={{ cursor: "pointer" }} onClick={() => setSelected(s.id)}>
                            <td>
                              <div className="row" style={{ gap: 10 }}>
                                <Avatar name={s.name} size={26} />
                                <div>
                                  <div style={{ fontWeight: 600, color: "var(--fs-navy)" }}>{s.name}</div>
                                  <div className="mut" style={{ fontSize: 11 }}>{s.title}</div>
                                </div>
                              </div>
                            </td>
                            <td>{s.org}</td>
                            <td>
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: 5,
                                fontSize: 11, fontWeight: 600,
                                padding: "3px 9px",
                                background: st.bg, color: st.c,
                                borderRadius: 999,
                                textTransform: "uppercase", letterSpacing: "0.06em",
                              }}>
                                <span style={{ width: 5, height: 5, borderRadius: "50%", background: st.c }} />
                                {st.label}
                              </span>
                            </td>
                            <td className="mut">{s.owner}</td>
                            <td className="mut num">{s.last}</td>
                            <td className="num" style={{ textAlign: "right", color: s.followups > 0 ? "var(--fs-danger)" : "var(--fs-fg-subtle)", fontWeight: s.followups > 0 ? 600 : 400 }}>
                              {s.followups > 0 ? s.followups : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="card card-pad" style={{ textAlign: "center", color: "var(--fs-fg-muted)" }}>
              No stakeholders match these filters.
            </div>
          )}
        </div>

        {/* Detail rail */}
        {sel && <StakeholderDetail s={sel} statuses={statuses} tiers={tiers} role={role} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
}

function StakeholderDetail({ s, statuses, tiers, role, onClose }) {
  const st = statuses[s.status];
  const t = tiers[s.tier];
  return (
    <div style={{ position: "sticky", top: 0, display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="card">
        <div style={{ padding: "20px 22px", borderBottom: "1px solid var(--fs-border)", background: "var(--fs-bone-50)" }}>
          <div className="row between" style={{ alignItems: "flex-start" }}>
            <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
              <Avatar name={s.name} size={44} />
              <div>
                <div style={{ fontFamily: "var(--fs-font-display)", fontSize: 18, fontWeight: 700, color: "var(--fs-navy)", letterSpacing: "-0.005em" }}>{s.name}</div>
                <div className="mut" style={{ fontSize: 12 }}>{s.title} · {s.org}</div>
                <div className="row" style={{ gap: 6, marginTop: 8 }}>
                  <Tag tone="navy">Tier {s.tier}</Tag>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 9px", background: st.bg, color: st.c, borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: st.c }} />
                    {st.label}
                  </span>
                </div>
              </div>
            </div>
            <button className="btn ghost sm" onClick={onClose}><Icon name="x" size={14} /></button>
          </div>
        </div>

        <div style={{ padding: "16px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
          <DetailRow icon="comment" label="Email">{s.email}</DetailRow>
          <DetailRow icon="bell" label="Phone">{s.phone}</DetailRow>
          <DetailRow icon="users" label="Owner">{s.owner}</DetailRow>
          <DetailRow icon="calendar" label="Last contact">{s.last}</DetailRow>
        </div>

        <div style={{ padding: "0 22px 18px" }}>
          <div className="lbl">Notes & ask</div>
          <div style={{
            padding: "12px 14px", background: "var(--fs-bone-50)",
            border: "1px solid var(--fs-border)", borderRadius: 4,
            fontSize: 13, color: "var(--fs-ink)", lineHeight: 1.55,
          }}>
            {s.support}
          </div>
        </div>

        {role !== "client" && (
          <div style={{ padding: "12px 18px", borderTop: "1px solid var(--fs-border)", background: "var(--fs-bone-50)" }}>
            <div className="lbl">Quick update</div>
            <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              <button className="btn secondary sm"><Icon name="check" size={12} /> Mark contacted</button>
              <button className="btn secondary sm"><Icon name="calendar" size={12} /> Set followup</button>
              <button className="btn secondary sm">+ Note</button>
            </div>
          </div>
        )}
      </div>

      {/* Recent activity */}
      <div className="card">
        <div className="card-head"><h3>Activity</h3></div>
        <div style={{ padding: 4 }}>
          {[
            { who: s.owner, at: s.last, what: "Logged conversation: \"" + s.support + "\"" },
            { who: s.owner, at: "May 09", what: "Sent initial outreach email" },
            { who: "System", at: "May 02", what: "Added to outreach list, tagged Tier " + s.tier },
          ].map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "10px 14px", borderBottom: i < 2 ? "1px solid var(--fs-border)" : "none" }}>
              <Avatar name={a.who} size={22} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "var(--fs-fg-muted)" }}><strong style={{ color: "var(--fs-navy)" }}>{a.who}</strong> · {a.at}</div>
                <div style={{ fontSize: 13, marginTop: 2, color: "var(--fs-ink)", lineHeight: 1.4 }}>{a.what}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, children }) {
  return (
    <div className="row" style={{ alignItems: "flex-start", gap: 12 }}>
      <span style={{ width: 28, marginTop: 2 }}><Icon name={icon} size={14} color="var(--fs-fg-muted)" /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="lbl" style={{ margin: 0, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 13, color: "var(--fs-navy)", fontWeight: 500, wordBreak: "break-all" }}>{children}</div>
      </div>
    </div>
  );
}

window.StakeholdersView = StakeholdersView;
