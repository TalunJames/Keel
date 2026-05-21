/* global React */
const { useState: useStatePro } = React;

function ProposalsView({ user, role, client, clientId }) {
  const [tab, setTab] = useStatePro("editor"); // editor | library

  // Template definitions
  const templates = [
    { id: "boutique",   name: "Boutique scope memo",         desc: "Short-form scope of work for a single retainer, single quarter.",
      defaultBlocks: ["cover","summary","scope","deliverables","timeline","fees","signoff"] },
    { id: "campaign",   name: "Campaign engagement proposal", desc: "Comprehensive proposal for political campaigns — strategy, mail, polling.",
      defaultBlocks: ["cover","aboutfirm","situation","approach","scope","team","caseStudy","timeline","fees","signoff"] },
    { id: "publicaff",  name: "Public-affairs RFP response", desc: "Formal response to a state-government RFP. Compliance-forward.",
      defaultBlocks: ["cover","executive","approach","methodology","team","compliance","references","fees","signoff"] },
    { id: "coalition",  name: "Coalition build-out plan",    desc: "Multi-party coalition with stakeholder map and rollout phases.",
      defaultBlocks: ["cover","summary","situation","stakeholders","approach","timeline","fees","signoff"] },
  ];

  // Block library
  const blockTypes = {
    cover:       { label: "Cover page",        icon: "image",     group: "Front matter" },
    summary:     { label: "Executive summary", icon: "comment",   group: "Front matter" },
    aboutfirm:   { label: "About Fog Signal",  icon: "lighthouse",group: "Front matter" },
    situation:   { label: "The situation",     icon: "alert",     group: "Strategy" },
    approach:    { label: "Our approach",      icon: "compass",   group: "Strategy" },
    methodology: { label: "Methodology",       icon: "book",      group: "Strategy" },
    scope:       { label: "Scope of work",     icon: "check",     group: "Engagement" },
    deliverables:{ label: "Deliverables",      icon: "folder",    group: "Engagement" },
    stakeholders:{ label: "Stakeholder map",   icon: "stakeholders", group: "Strategy" },
    team:        { label: "Team & roles",      icon: "users",     group: "Engagement" },
    caseStudy:   { label: "Case study",        icon: "newspaper", group: "Proof" },
    references:  { label: "References",        icon: "users",     group: "Proof" },
    timeline:    { label: "Timeline",          icon: "calendar",  group: "Engagement" },
    compliance:  { label: "Compliance & filings", icon: "shield", group: "Proof" },
    fees:        { label: "Fees & retainer",   icon: "key",       group: "Engagement" },
    executive:   { label: "Executive summary", icon: "comment",   group: "Front matter" },
    signoff:     { label: "Sign-off",          icon: "pen",       group: "Engagement" },
  };

  const [tplId, setTplId] = useStatePro("campaign");
  const tpl = templates.find(t => t.id === tplId);
  const [blocks, setBlocks] = useStatePro(tpl.defaultBlocks.map((b, i) => ({ id: b + "-" + i, type: b })));

  // When template changes, replace block list
  React.useEffect(() => {
    setBlocks(tpl.defaultBlocks.map((b, i) => ({ id: b + "-" + i, type: b })));
  }, [tplId]);

  const [draggingFromIndex, setDraggingFromIndex] = useStatePro(null);
  const [draggingType, setDraggingType] = useStatePro(null);

  const addBlock = (type) => {
    setBlocks(bs => [...bs, { id: type + "-" + Date.now(), type }]);
  };
  const removeBlock = (id) => setBlocks(bs => bs.filter(b => b.id !== id));
  const moveBlock = (from, to) => {
    if (from === to || to < 0 || to >= blocks.length) return;
    setBlocks(bs => {
      const next = [...bs];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  // ------ Past proposals ------
  if (tab === "library") return (
    <ProposalsLibrary onOpenEditor={() => setTab("editor")} client={client} clientId={clientId} />
  );

  // ------ Editor ------
  // Group block types by group label for palette
  const grouped = {};
  Object.entries(blockTypes).forEach(([id, t]) => {
    if (id === "executive") return; // dedupe
    if (!grouped[t.group]) grouped[t.group] = [];
    grouped[t.group].push({ id, ...t });
  });

  return (
    <div>
      <PageHead
        eyebrow={clientId === "all" ? "Proposals · All accounts" : (client?.name + " · Proposals")}
        title="Build a proposal"
        sub="Pick a template, drag blocks into the canvas, edit content inline, export to PDF or send for sign-off."
        actions={
          <>
            <button className="btn ghost" onClick={() => setTab("library")}><Icon name="folder" size={13} /> Past proposals</button>
            <button className="btn secondary"><Icon name="download" size={13} /> Export PDF</button>
            <button className="btn primary"><Icon name="check" size={13} /> Send for sign-off</button>
          </>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr 280px", gap: 18, alignItems: "flex-start" }}>
        {/* LEFT: template + block palette */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card">
            <div className="card-head"><h3>Template</h3></div>
            <div style={{ padding: 8 }}>
              {templates.map(t => (
                <button key={t.id} onClick={() => setTplId(t.id)} style={{
                  width: "100%", textAlign: "left",
                  padding: "10px 12px",
                  background: tplId === t.id ? "var(--fs-navy-50)" : "transparent",
                  border: "1px solid " + (tplId === t.id ? "var(--fs-navy)" : "transparent"),
                  borderRadius: 4, cursor: "pointer", marginBottom: 4,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)", marginBottom: 3 }}>{t.name}</div>
                  <div className="mut" style={{ fontSize: 11, lineHeight: 1.4 }}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Block Library</h3></div>
            <div className="mut" style={{ padding: "8px 14px 4px", fontSize: 11 }}>Drag onto canvas, or click to append.</div>
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group} style={{ padding: "8px 8px 4px" }}>
                <div className="lbl" style={{ margin: "6px 6px 6px" }}>{group}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {items.map(b => (
                    <button key={b.id}
                      draggable
                      onDragStart={() => { setDraggingType(b.id); setDraggingFromIndex(null); }}
                      onDragEnd={() => setDraggingType(null)}
                      onClick={() => addBlock(b.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "7px 10px",
                        background: "var(--fs-bone-50)", border: "1px solid var(--fs-border)",
                        borderRadius: 4, cursor: "grab",
                        fontSize: 12, color: "var(--fs-ink)",
                        textAlign: "left",
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = "var(--fs-navy)"}
                      onMouseLeave={e => e.currentTarget.style.borderColor = "var(--fs-border)"}>
                      <Icon name="grip" size={11} color="var(--fs-fg-subtle)" />
                      <Icon name={b.icon} size={13} color="var(--fs-navy)" />
                      <span style={{ flex: 1 }}>{b.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* CENTER: proposal canvas */}
        <div>
          <div className="row between" style={{ marginBottom: 10 }}>
            <div className="mut" style={{ fontSize: 12 }}>
              <strong style={{ color: "var(--fs-navy)" }}>{blocks.length}</strong> blocks · est. {Math.ceil(blocks.length * 1.4)} pages
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn ghost sm">Preview</button>
              <button className="btn ghost sm"><Icon name="more" size={13} /></button>
            </div>
          </div>

          <div style={{
            background: "var(--fs-paper)",
            border: "1px solid var(--fs-border)",
            borderRadius: 4,
            padding: "32px 40px",
            minHeight: 400,
          }}
          onDragOver={e => e.preventDefault()}
          onDrop={() => {
            if (draggingType !== null) {
              addBlock(draggingType);
              setDraggingType(null);
            }
          }}>
            {blocks.length === 0 ? (
              <div style={{ padding: "60px 0", textAlign: "center", color: "var(--fs-fg-muted)" }}>
                <Icon name="layout" size={32} color="var(--fs-fg-subtle)" />
                <div style={{ fontSize: 14, marginTop: 12 }}>Drag blocks here, or pick a template to start.</div>
              </div>
            ) : (
              blocks.map((b, i) => (
                <BlockNode key={b.id}
                  block={b} index={i} blockTypes={blockTypes}
                  client={client}
                  isLast={i === blocks.length - 1}
                  onRemove={() => removeBlock(b.id)}
                  onMoveUp={() => moveBlock(i, i - 1)}
                  onMoveDown={() => moveBlock(i, i + 1)}
                  draggingFromIndex={draggingFromIndex}
                  onDragStart={() => { setDraggingFromIndex(i); setDraggingType(null); }}
                  onDragEnd={() => setDraggingFromIndex(null)}
                  onDropAt={() => {
                    if (draggingFromIndex !== null) moveBlock(draggingFromIndex, i);
                    else if (draggingType !== null) {
                      setBlocks(bs => {
                        const next = [...bs];
                        next.splice(i, 0, { id: draggingType + "-" + Date.now(), type: draggingType });
                        return next;
                      });
                    }
                    setDraggingFromIndex(null);
                    setDraggingType(null);
                  }}
                />
              ))
            )}
          </div>
        </div>

        {/* RIGHT: proposal meta */}
        <aside className="card card-pad" style={{ position: "sticky", top: 0 }}>
          <Eyebrow>Proposal Details</Eyebrow>
          <div className="field" style={{ marginTop: 14 }}>
            <label>Title</label>
            <input className="input" defaultValue={"Engagement Proposal — " + (client?.name || "[Client]")} />
          </div>
          <div className="field">
            <label>Client</label>
            <input className="input" defaultValue={client?.name || "—"} readOnly />
          </div>
          <div className="field">
            <label>Engagement type</label>
            <select className="input"><option>Retainer · monthly</option><option>Retainer · quarterly</option><option>Project · one-time</option></select>
          </div>
          <div className="field">
            <label>Owner</label>
            <input className="input" defaultValue={user.name} />
          </div>
          <div className="field">
            <label>Status</label>
            <select className="input"><option>Draft</option><option>Internal review</option><option>Sent</option><option>Signed</option></select>
          </div>
          <div className="divider" />
          <div className="row between">
            <span className="mut" style={{ fontSize: 12 }}>Last saved</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fs-success)" }}><Icon name="circle-check" size={11} /> 2 min ago</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ---- Block node renderer ---------------------------------------------------
function BlockNode({ block, index, blockTypes, client, isLast, onRemove, onMoveUp, onMoveDown, onDragStart, onDragEnd, onDropAt, draggingFromIndex }) {
  const meta = blockTypes[block.type] || { label: block.type, icon: "layout" };
  const [hover, setHover] = useStatePro(false);
  const [over, setOver] = useStatePro(false);
  const dragging = draggingFromIndex === index;

  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={() => { setOver(false); onDropAt(); }}
      style={{ position: "relative", marginBottom: 8 }}
    >
      {/* Drop indicator */}
      {over && <div style={{ position: "absolute", top: -4, left: 0, right: 0, height: 2, background: "var(--fs-gold)", borderRadius: 1 }} />}

      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          border: "1px solid " + (hover ? "var(--fs-navy)" : "var(--fs-border)"),
          borderRadius: 4,
          background: "var(--fs-paper)",
          padding: "16px 18px",
          opacity: dragging ? 0.4 : 1,
          transition: "border-color 160ms",
          position: "relative",
        }}
      >
        {/* Toolbar */}
        <div className="row between" style={{ marginBottom: 10 }}>
          <div className="row" style={{ gap: 8 }}>
            <Icon name="grip" size={12} color="var(--fs-fg-subtle)" />
            <Icon name={meta.icon} size={13} color="var(--fs-navy)" />
            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600, color: "var(--fs-fg-muted)" }}>
              {meta.label}
            </span>
          </div>
          <div className="row" style={{ gap: 2, opacity: hover ? 1 : 0, transition: "opacity 160ms" }}>
            <button className="btn ghost sm" style={{ padding: 4 }} onClick={onMoveUp}><Icon name="chevron-up" size={12} /></button>
            <button className="btn ghost sm" style={{ padding: 4 }} onClick={onMoveDown}><Icon name="chevron-down" size={12} /></button>
            <button className="btn ghost sm" style={{ padding: 4, color: "var(--fs-danger)" }} onClick={onRemove}><Icon name="x" size={12} /></button>
          </div>
        </div>

        {/* Block preview content */}
        <BlockPreview type={block.type} client={client} />
      </div>
    </div>
  );
}

function BlockPreview({ type, client }) {
  const cname = client?.name || "Client";
  switch (type) {
    case "cover": return (
      <div style={{ padding: "30px 16px 20px", background: "var(--ks-ink-surface)", color: "var(--ks-on-ink)", borderRadius: 4, position: "relative", overflow: "hidden" }}>
        <svg width="240" height="240" viewBox="0 0 240 240" style={{ position: "absolute", right: -50, top: -50, opacity: 0.10 }}>
          <g fill="none" stroke="var(--fs-gold)" strokeWidth="1"><circle cx="120" cy="120" r="40"/><circle cx="120" cy="120" r="70"/><circle cx="120" cy="120" r="100"/></g>
        </svg>
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--fs-gold)", fontWeight: 600 }}>Engagement Proposal · May 2026</div>
        <div style={{ fontFamily: "var(--fs-font-display)", fontSize: 30, fontWeight: 700, margin: "10px 0 8px", letterSpacing: "-0.01em" }}>{cname}</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Prepared by Fog Signal Strategies</div>
      </div>
    );
    case "summary": case "executive": return (
      <>
        <p className="fs-body-serif" style={{ fontSize: 15, lineHeight: 1.6, margin: 0 }}>
          We propose a focused engagement to advance <strong>{cname}</strong>'s priority objectives over the next two quarters — combining senior counsel, original research, and a tightly-scoped creative program.
        </p>
        <p className="fs-body-serif" style={{ fontSize: 15, lineHeight: 1.6, margin: "10px 0 0" }}>
          The work is structured to deliver an audible signal in three months and a defensible record before year-end.
        </p>
      </>
    );
    case "aboutfirm": return (
      <div className="row" style={{ gap: 18, alignItems: "flex-start" }}>
        <img src="design-system/assets/logo-stacked-blue.png" alt="" style={{ height: 56 }} />
        <div>
          <h4 style={{ fontFamily: "var(--fs-font-display)", margin: 0, color: "var(--fs-navy)", fontWeight: 700, fontSize: 17 }}>Fog Signal Strategies</h4>
          <p className="mut" style={{ fontSize: 13, margin: "6px 0 0", lineHeight: 1.55, maxWidth: 540 }}>
            A senior-only public-affairs firm. We move policy and protect reputations for general counsels, advocacy organizations, and statewide campaigns.
          </p>
        </div>
      </div>
    );
    case "situation": return (
      <>
        <h4 className="serif-h" style={{ fontSize: 18, margin: "0 0 8px" }}>The situation</h4>
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          {cname} faces a near-term inflection: a primary in 12 weeks, a fragmenting coalition, and a press environment that has cooled. Polling suggests the underlying support is there — but the message needs new edges and the surrogate roster needs lift.
        </p>
      </>
    );
    case "approach": return (
      <>
        <h4 className="serif-h" style={{ fontSize: 18, margin: "0 0 10px" }}>Our approach</h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          {[
            { n: "01", t: "Listen first", b: "60-min stakeholder interviews + 800-n statewide IVR." },
            { n: "02", t: "Sharpen the signal", b: "Single-page messaging architecture + two test creative concepts." },
            { n: "03", t: "Hold the lighthouse", b: "Weekly delivery cadence, race-night protocols, escalation paths." },
          ].map(s => (
            <div key={s.n}>
              <div className="kicker">{s.n}</div>
              <div style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 16, color: "var(--fs-navy)", margin: "6px 0 4px" }}>{s.t}</div>
              <p className="mut" style={{ fontSize: 13, margin: 0, lineHeight: 1.5 }}>{s.b}</p>
            </div>
          ))}
        </div>
      </>
    );
    case "scope": return (
      <>
        <h4 className="serif-h" style={{ fontSize: 18, margin: "0 0 10px" }}>Scope of work</h4>
        <table className="tbl" style={{ borderTop: "1px solid var(--fs-border)" }}>
          <thead><tr><th>Workstream</th><th>What we'll do</th><th style={{ textAlign: "right" }}>Cadence</th></tr></thead>
          <tbody>
            <tr><td style={{ fontWeight: 600, color: "var(--fs-navy)" }}>Strategic counsel</td><td>Weekly partner-led calls, ad-hoc memos, scenario planning.</td><td className="mut" style={{ textAlign: "right" }}>Ongoing</td></tr>
            <tr><td style={{ fontWeight: 600, color: "var(--fs-navy)" }}>Original research</td><td>One statewide poll, two focus groups, monthly tracker.</td><td className="mut" style={{ textAlign: "right" }}>Q1–Q2</td></tr>
            <tr><td style={{ fontWeight: 600, color: "var(--fs-navy)" }}>Creative production</td><td>Two TV concepts to first proof, mail series, digital cutdowns.</td><td className="mut" style={{ textAlign: "right" }}>Q1</td></tr>
            <tr><td style={{ fontWeight: 600, color: "var(--fs-navy)" }}>Coalition</td><td>Stakeholder map, surrogate strategy, faith-leader engagement.</td><td className="mut" style={{ textAlign: "right" }}>Q1</td></tr>
          </tbody>
        </table>
      </>
    );
    case "deliverables": return (
      <>
        <h4 className="serif-h" style={{ fontSize: 18, margin: "0 0 10px" }}>Deliverables</h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {["Strategy memo (week 2)","Statewide topline poll","Messaging architecture","Two TV concepts to first proof","Direct mail series (4 pieces)","Surrogate roster + briefing kit"].map(d => (
            <div key={d} className="row" style={{ gap: 8, padding: "6px 0", fontSize: 13 }}>
              <Icon name="check" size={13} color="var(--fs-gold-700)" /> {d}
            </div>
          ))}
        </div>
      </>
    );
    case "team": return (
      <>
        <h4 className="serif-h" style={{ fontSize: 18, margin: "0 0 12px" }}>Your team</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {[
            { n: "Margaret Voss", r: "Lead strategist" },
            { n: "Jonas Reiter", r: "Engagement principal" },
            { n: "Eli Park", r: "Data & polling" },
            { n: "Drew Cole", r: "Creative director" },
          ].map(p => (
            <div key={p.n}>
              <Avatar name={p.n} size={44} />
              <div style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 14, color: "var(--fs-navy)", marginTop: 8 }}>{p.n}</div>
              <div className="mut" style={{ fontSize: 12 }}>{p.r}</div>
            </div>
          ))}
        </div>
      </>
    );
    case "timeline": return (
      <>
        <h4 className="serif-h" style={{ fontSize: 18, margin: "0 0 10px" }}>Timeline</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 0, fontSize: 11 }}>
          {["Week 1","Week 2","Week 3","Week 4","Week 5","Week 6"].map((w, i) => (
            <div key={w} style={{ padding: 8, textAlign: "center", borderRight: i < 5 ? "1px solid var(--fs-border)" : "none", color: "var(--fs-fg-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>{w}</div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
          {[
            { lbl: "Listening + research", start: 0, span: 2, c: "var(--fs-navy)" },
            { lbl: "Messaging architecture", start: 1, span: 2, c: "var(--fs-gold)" },
            { lbl: "Creative production",   start: 2, span: 3, c: "var(--fs-navy-500)" },
            { lbl: "Field-test + revise",   start: 4, span: 2, c: "#2F6B4F" },
          ].map(b => (
            <div key={b.lbl} className="row" style={{ alignItems: "center", gap: 10 }}>
              <div style={{ width: 140, fontSize: 12, fontWeight: 600, color: "var(--fs-navy)" }}>{b.lbl}</div>
              <div style={{ flex: 1, position: "relative", height: 18, background: "var(--fs-bone-50)", borderRadius: 2 }}>
                <div style={{ position: "absolute", left: (b.start/6*100) + "%", width: (b.span/6*100) + "%", height: "100%", background: b.c, opacity: 0.7, borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
      </>
    );
    case "fees": return (
      <>
        <h4 className="serif-h" style={{ fontSize: 18, margin: "0 0 10px" }}>Fees & retainer</h4>
        <table className="tbl">
          <tbody>
            <tr><td>Monthly retainer (strategic counsel, ongoing)</td><td className="num" style={{ textAlign: "right", fontWeight: 700 }}>$28,500 / mo</td></tr>
            <tr><td>Statewide poll (one-time)</td><td className="num" style={{ textAlign: "right", fontWeight: 700 }}>$42,000</td></tr>
            <tr><td>Two focus groups (one-time)</td><td className="num" style={{ textAlign: "right", fontWeight: 700 }}>$24,000</td></tr>
            <tr><td>Creative production (capped)</td><td className="num" style={{ textAlign: "right", fontWeight: 700 }}>$65,000</td></tr>
            <tr><td style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 16, color: "var(--fs-navy)" }}>Six-month total</td><td className="num" style={{ textAlign: "right", fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 20, color: "var(--fs-gold-700)" }}>$302,000</td></tr>
          </tbody>
        </table>
      </>
    );
    case "signoff": return (
      <>
        <h4 className="serif-h" style={{ fontSize: 18, margin: "0 0 14px" }}>Sign-off</h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div>
            <div className="mut" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em" }}>Fog Signal</div>
            <div style={{ height: 38, borderBottom: "1px solid var(--fs-border-strong)", margin: "26px 0 6px" }}></div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)" }}>Jonas Reiter</div>
            <div className="mut" style={{ fontSize: 12 }}>Director of Operations</div>
          </div>
          <div>
            <div className="mut" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em" }}>{cname}</div>
            <div style={{ height: 38, borderBottom: "1px solid var(--fs-border-strong)", margin: "26px 0 6px" }}></div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)" }}>[Authorized signatory]</div>
            <div className="mut" style={{ fontSize: 12 }}>Date</div>
          </div>
        </div>
      </>
    );
    default: return (
      <div className="mut" style={{ fontSize: 13, padding: 6 }}>
        <em>{type}</em> — content placeholder. Click to edit.
      </div>
    );
  }
}

// ---- Past proposals library -----------------------------------------------
function ProposalsLibrary({ onOpenEditor, client, clientId }) {
  const rows = [
    { id: "P-118", t: "Aoki for U.S. Senate — Q3 retainer", client: "Aoki for Senate",            who: "M. Voss",  date: "May 12", status: "Signed", value: "$302,000" },
    { id: "P-116", t: "Coastal Renewal — coalition build",  client: "Citizens for Coastal Renewal", who: "M. Voss",  date: "May 04", status: "Sent",   value: "$148,000" },
    { id: "P-114", t: "Hughes for Governor — comms scope",  client: "Hughes for Governor",         who: "J. Reiter",date: "Apr 28", status: "Internal review", value: "$210,000" },
    { id: "P-112", t: "Patel for OH-12 — launch sprint",    client: "Patel for Congress (OH-12)",  who: "M. Voss",  date: "Apr 18", status: "Signed", value: "$96,000"  },
    { id: "P-110", t: "State of OH — public-affairs RFP",   client: "Public Affairs / state contract", who: "J. Reiter", date: "Apr 09", status: "Declined", value: "$540,000" },
  ];
  const filtered = clientId === "all" ? rows : rows.filter(r => r.client === client?.account || r.client === client?.name);
  const tones = { "Signed": "success", "Sent": "navy", "Internal review": "warning", "Declined": "danger" };

  return (
    <div>
      <PageHead
        eyebrow="Proposals · Library"
        title={clientId === "all" ? "Past proposals" : client?.name + " proposals"}
        sub="Search, fork, and re-use any past proposal as a starting point."
        actions={<button className="btn primary" onClick={onOpenEditor}><Icon name="plus" size={14} /> New proposal</button>}
      />
      <div className="card">
        <table className="tbl">
          <thead><tr><th>ID</th><th>Title</th><th>Client</th><th>Owner</th><th>Date</th><th>Status</th><th style={{ textAlign: "right" }}>Value</th></tr></thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} style={{ cursor: "pointer" }} onClick={onOpenEditor}>
                <td className="num mut">{r.id}</td>
                <td style={{ fontWeight: 600, color: "var(--fs-navy)" }}>{r.t}</td>
                <td className="mut">{r.client}</td>
                <td className="mut">{r.who}</td>
                <td className="mut num">{r.date}</td>
                <td><Tag tone={tones[r.status]}>{r.status}</Tag></td>
                <td className="num" style={{ textAlign: "right", fontWeight: 700, color: "var(--fs-navy)" }}>{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

window.ProposalsView = ProposalsView;
