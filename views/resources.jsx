/* global React */
const { useState: useStateRes } = React;

function ResourcesView({ role, clientId, client }) {
  const [category, setCategory] = useStateRes("all");
  const [q, setQ] = useStateRes("");

  const categories = [
    { id: "all",       label: "Everything",   icon: "book" },
    { id: "design",    label: "Past creative", icon: "image" },
    { id: "memos",     label: "Memos & briefings", icon: "comment" },
    { id: "playbooks", label: "Playbooks & SOPs", icon: "compass" },
    { id: "compliance",label: "Compliance",   icon: "shield" },
    ...(role !== "client" ? [{ id: "templates", label: "Templates",      icon: "folder" }] : []),
  ];

  const baseItems = [
    { id: 1, cat: "design",   t: "Aoki — \"Lighthouse\" 30s TV (FINAL, May 18)", account: "Aoki for Senate", who: "Drew Cole", date: "May 18", kind: "Video", tags: ["TV","Brand"], thumb: "video" },
    { id: 2, cat: "design",   t: "Coastal Renewal — coalition launch one-pager", account: "Citizens for Coastal Renewal", who: "Priya Shah", date: "May 09", kind: "Print", tags: ["Print","Coalition"], thumb: "print" },
    { id: 3, cat: "design",   t: "Harden — direct mail series, primary closing", account: "Harden for Congress (NJ-3)", who: "Drew Cole", date: "May 02", kind: "Print", tags: ["Mail","GOTV"], thumb: "print" },
    { id: 4, cat: "design",   t: "Aoki — radio :60 \"Two coasts, one shore\"", account: "Aoki for Senate", who: "Drew Cole", date: "Apr 28", kind: "Audio", tags: ["Radio"], thumb: "audio" },
    { id: 5, cat: "memos",    t: "Coalition strategy memo — Coastal Renewal",   account: "Citizens for Coastal Renewal", who: "Margaret Voss", date: "May 18", kind: "Memo",   tags: ["Strategy","Coalition"], thumb: "doc" },
    { id: 6, cat: "memos",    t: "Polling brief — May 12–17 IVR topline",       account: "Aoki for Senate", who: "Eli Park",      date: "May 17", kind: "Memo",   tags: ["Polling"], thumb: "doc", clientVisible: true },
    { id: 7, cat: "playbooks",t: "Election Night War Room — protocol v4.2",     account: "Internal",       who: "Jonas Reiter",  date: "May 11", kind: "Playbook", tags: ["Ops"], thumb: "doc" },
    { id: 8, cat: "playbooks",t: "Voter file refresh — TargetSmart workflow",   account: "Internal",       who: "Eli Park",      date: "May 04", kind: "Playbook", tags: ["Data"], thumb: "doc" },
    { id: 9, cat: "compliance",t: "FEC Q2 filing — quick-reference checklist",  account: "Internal",       who: "Compliance",    date: "Apr 30", kind: "Checklist", tags: ["FEC"], thumb: "doc" },
    { id: 10, cat: "compliance",t: "State filings — Ohio + New Jersey",         account: "Internal",       who: "Compliance",    date: "Apr 22", kind: "Checklist", tags: ["State"], thumb: "doc" },
    { id: 11, cat: "templates",t: "Design intake brief — template",             account: "Internal",       who: "Drew Cole",     date: "Mar 14", kind: "Template", tags: ["Intake"], thumb: "doc" },
    { id: 12, cat: "templates",t: "Race manager — pre-flight checklist",        account: "Internal",       who: "Jonas Reiter",  date: "Mar 04", kind: "Template", tags: ["Ops"], thumb: "doc" },
  ];

  // Client view: only items that are explicitly client-visible OR design work for their account.
  const items = role === "client"
    ? baseItems.filter(i => i.clientVisible || i.account === "Aoki for Senate")
    : baseItems;

  const filtered = items
    .filter(i => category === "all" || i.cat === category)
    .filter(i => !q || (i.t + " " + i.account + " " + i.who).toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHead
        eyebrow="Resource Library"
        title={role === "client" ? "Memos & previous work" : "Resources"}
        sub={role === "client"
          ? "Memos, briefings, and approved creative for your campaign."
          : "Everything from past creative to the war-room protocol — searchable, taggable, in one place. Use this before you start something new."}
        actions={role !== "client" && <button className="btn primary"><Icon name="upload" size={14} /> Add to library</button>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 28, alignItems: "flex-start" }}>
        {/* Side categories */}
        <aside>
          <div className="search" style={{ width: "100%", padding: "6px 10px", marginBottom: 16 }}>
            <Icon name="search" size={13} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search resources" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {categories.map(c => (
              <button key={c.id} onClick={() => setCategory(c.id)} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px",
                background: category === c.id ? "var(--fs-navy-50)" : "transparent",
                border: "none", borderRadius: 4,
                color: category === c.id ? "var(--fs-navy)" : "var(--fs-fg)",
                fontSize: 13, fontWeight: category === c.id ? 600 : 500,
                cursor: "pointer", textAlign: "left",
              }}>
                <Icon name={c.icon} size={15} color={category === c.id ? "var(--fs-navy)" : "var(--fs-fg-muted)"} />
                <span style={{ flex: 1 }}>{c.label}</span>
                <span className="num mut" style={{ fontSize: 11 }}>{items.filter(i => c.id === "all" || i.cat === c.id).length}</span>
              </button>
            ))}
          </div>

          <div className="divider" />
          <Eyebrow>Popular tags</Eyebrow>
          <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {["Brand","TV","Mail","GOTV","Coalition","Polling","Ops","FEC","Strategy"].map(t => (
              <Tag key={t} tone="outline">{t}</Tag>
            ))}
          </div>
        </aside>

        {/* Grid of cards */}
        <div>
          {category === "design" || category === "all" ? (
            <>
              <h3 style={{ fontFamily: "var(--fs-font-display)", fontSize: 18, fontWeight: 700, color: "var(--fs-navy)", margin: "0 0 14px" }}>Recent creative</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, marginBottom: 30 }}>
                {filtered.filter(i => i.cat === "design").slice(0, 8).map(i => (
                  <a key={i.id} href="#" style={{
                    textDecoration: "none", color: "inherit",
                    border: "1px solid var(--fs-border)", borderRadius: 4,
                    overflow: "hidden", background: "var(--fs-paper)",
                    display: "block",
                    transition: "border-color 160ms, box-shadow 160ms",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--fs-navy)"; e.currentTarget.style.boxShadow = "var(--fs-shadow-sm)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--fs-border)"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    <Thumb kind={i.thumb} title={i.t} />
                    <div style={{ padding: "12px 14px" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)", marginBottom: 4, lineHeight: 1.35 }}>{i.t}</div>
                      <div className="mut" style={{ fontSize: 11 }}>{i.account} · {i.who} · {i.date}</div>
                    </div>
                  </a>
                ))}
              </div>
            </>
          ) : null}

          <h3 style={{ fontFamily: "var(--fs-font-display)", fontSize: 18, fontWeight: 700, color: "var(--fs-navy)", margin: "0 0 14px" }}>
            {category === "all" ? "All resources" : categories.find(c => c.id === category).label}
          </h3>
          <div className="card">
            <table className="tbl">
              <thead>
                <tr>
                  <th></th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Account</th>
                  <th>Owner</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {filtered.filter(i => category === "all" || i.cat !== "design" || true).map(i => (
                  <tr key={i.id}>
                    <td style={{ width: 28 }}>
                      <span style={{
                        width: 28, height: 28, display: "grid", placeItems: "center",
                        background: "var(--fs-bone-50)", borderRadius: 4, color: "var(--fs-navy)",
                      }}>
                        <Icon name={i.thumb === "video" ? "tv" : i.thumb === "audio" ? "play" : i.thumb === "print" ? "image" : "comment"} size={14} />
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--fs-navy)" }}>{i.t}</div>
                      <div className="row" style={{ gap: 4, marginTop: 4 }}>
                        {i.tags.map(t => <Tag key={t} tone="outline">{t}</Tag>)}
                      </div>
                    </td>
                    <td><Tag tone="navy">{i.kind}</Tag></td>
                    <td className="mut">{i.account}</td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <Avatar name={i.who} size={20} />
                        <span style={{ fontSize: 13 }}>{i.who.split(" ")[0]}</span>
                      </div>
                    </td>
                    <td className="mut num">{i.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Thumb({ kind, title }) {
  // tiny stylized thumbnail, no real imagery
  if (kind === "video") return (
    <div style={{ height: 120, background: "linear-gradient(180deg, #0e2238 0%, #1A3A5C 100%)", position: "relative", overflow: "hidden" }}>
      <svg viewBox="0 0 220 120" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <ellipse cx="100" cy="60" rx="100" ry="50" fill="#EFC53F" opacity="0.18"/>
        <rect x="105" y="55" width="6" height="20" fill="#D3D2C3"/>
        <path d="M 80 100 L 220 90 L 220 120 L 0 120 Z" fill="#0E2238"/>
        <text x="110" y="100" fontFamily="Baskerville Brand, serif" fill="#fff" fontSize="11" textAnchor="middle" letterSpacing="0">{title.slice(0, 28)}</text>
      </svg>
      <div style={{ position: "absolute", left: 10, top: 8, fontSize: 10, color: "rgba(255,255,255,0.85)", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 600 }}>:30 TV</div>
    </div>
  );
  if (kind === "audio") return (
    <div style={{ height: 120, background: "var(--fs-bone)", padding: "20px 18px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--fs-gold-700)", fontWeight: 600 }}>Radio :60</div>
      <div className="row" style={{ gap: 2, alignItems: "flex-end", height: 50 }}>
        {Array.from({ length: 26 }).map((_, i) => (
          <div key={i} style={{ flex: 1, height: (20 + Math.abs(Math.sin(i * 0.7) * 30)) + "px", background: "var(--fs-navy)" }} />
        ))}
      </div>
    </div>
  );
  if (kind === "print") return (
    <div style={{ height: 120, background: "var(--fs-paper)", borderBottom: "1px solid var(--fs-border)", padding: "16px 18px", position: "relative" }}>
      <div style={{ fontFamily: "var(--fs-font-display)", fontSize: 16, fontWeight: 700, color: "var(--fs-navy)", lineHeight: 1.1, marginBottom: 6 }}>{title.split("—")[0]}</div>
      <div style={{ width: 30, height: 2, background: "var(--fs-gold)", marginBottom: 6 }} />
      <div style={{ fontSize: 9, color: "var(--fs-fg-muted)", lineHeight: 1.3 }}>{title.split("—").slice(1).join(" — ")}</div>
      <div style={{ position: "absolute", right: 14, bottom: 14, width: 22, height: 22, background: "var(--fs-navy)", borderRadius: 2 }}></div>
    </div>
  );
  return (
    <div style={{ height: 120, background: "var(--fs-bone-50)", padding: "14px 18px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--fs-gold-700)", fontWeight: 600 }}>Memo</div>
      <div>
        <div style={{ height: 5, width: "85%", background: "var(--fs-navy)", marginBottom: 4 }} />
        <div style={{ height: 3, width: "70%", background: "var(--fs-ink-200)", marginBottom: 3 }} />
        <div style={{ height: 3, width: "75%", background: "var(--fs-ink-200)", marginBottom: 3 }} />
        <div style={{ height: 3, width: "60%", background: "var(--fs-ink-200)", marginBottom: 3 }} />
      </div>
    </div>
  );
}

window.ResourcesView = ResourcesView;
