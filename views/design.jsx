/* global React */
const { useState: useStateDesign } = React;

function DesignView({ user, role, clientId, client }) {
  const [tab, setTab] = useStateDesign("queue"); // queue | new | proof
  const [activeReq, setActiveReq] = useStateDesign(null);

  // ---------------- Sample requests ----------------
  const baseRequests = [
    { id: "DR-241", title: "Aoki for Senate — \"Lighthouse\" 30s TV", account: "Aoki for Senate", type: "Video", status: "Proofing", assignee: "Drew Cole", requested: "May 18", due: "May 22", proofs: 3, version: "v3", odoo: "ODOO-4521" },
    { id: "DR-239", title: "Coastal Renewal — coalition launch one-pager", account: "Citizens for Coastal Renewal", type: "Print", status: "In Design", assignee: "Priya Shah", requested: "May 17", due: "May 23", proofs: 1, version: "v1", odoo: "ODOO-4518" },
    { id: "DR-237", title: "NJ-3 Harden — direct mail piece #4", account: "Harden for Congress", type: "Direct mail", status: "Approved", assignee: "Drew Cole", requested: "May 15", due: "May 20", proofs: 4, version: "Final", odoo: "ODOO-4501" },
    { id: "DR-236", title: "Aoki — social cut-downs (6 assets)", account: "Aoki for Senate", type: "Social", status: "In Design", assignee: "Priya Shah", requested: "May 15", due: "May 21", proofs: 2, version: "v2", odoo: "ODOO-4498" },
    { id: "DR-235", title: "Statewide PSA — coastal storm prep", account: "Public Affairs / state contract", type: "Video", status: "Brief Review", assignee: "—", requested: "May 14", due: "Jun 5", proofs: 0, version: "Brief", odoo: "ODOO-4490" },
    { id: "DR-232", title: "Memo cover series, June batch",       account: "Internal", type: "Print", status: "Intake", assignee: "—", requested: "May 12", due: "Jun 1", proofs: 0, version: "Brief", odoo: "—" },
  ];

  // Client only sees requests for their account.
  // Otherwise filter by the top-bar client switcher.
  const clientAccountMap = { aoki: "Aoki for Senate", coastal: "Citizens for Coastal Renewal", harden: "Harden for Congress (NJ-3)", hughes: "Hughes for Governor", patel: "Patel for Congress (OH-12)", okafor: "Okafor for SoS", state: "Public Affairs / state contract", trade: "Coastal Manufacturers Assoc." };
  const requests = role === "client"
    ? baseRequests.filter(r => r.account === "Aoki for Senate")
    : (clientId && clientId !== "all" ? baseRequests.filter(r => r.account === clientAccountMap[clientId]) : baseRequests);

  const statusTone = {
    "Intake": "outline", "Brief Review": "navy", "In Design": "warning", "Proofing": "gold", "Approved": "success", "Revisions": "danger",
  };

  // ---------------- New request form ----------------
  const [form, setForm] = useStateDesign({
    account: "Aoki for Senate",
    type: "Print — direct mail",
    title: "",
    audience: "",
    cta: "",
    deadline: "",
    priority: "Standard",
    spec: "",
    files: 0,
  });
  const updateForm = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ---------------- Proof state ----------------
  const [comments, setComments] = useStateDesign([
    { id: 1, author: "Margaret Voss", role: "Strategy lead", at: "Yesterday 4:12 PM", text: "Beam needs to read at thumbnail size — bump scale on the lighthouse 8%. Also can we test \"For Ohio.\" as a final card vs the current \"Steady. Trusted. Forward.\"?", marker: { x: 31, y: 24 } },
    { id: 2, author: "Drew Cole", role: "Designer", at: "Yesterday 5:40 PM", text: "Bumped the beam 10% — see v3. End card has both versions; flip via the Tweaks panel.", marker: null },
    { id: 3, author: "Senator Aoki", role: "Client", at: "Today 8:02 AM", text: "Love the new pacing. Last beat feels rushed — can we hold the wide shot a half-beat longer?", marker: { x: 78, y: 68 } },
  ]);
  const [draft, setDraft] = useStateDesign("");

  // ---------------------------- VIEWS ----------------------------
  if (tab === "new") return (
    <div>
      <PageHead
        eyebrow="Design Requests"
        title="Submit a Design Request"
        sub="Fill out the brief below. We'll create the Odoo task, set up the Drive folder, and route the request to the design team — usually within an hour."
        actions={<button className="btn ghost" onClick={() => setTab("queue")}><Icon name="chevron-left" size={14} /> Back to queue</button>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 28, alignItems: "flex-start" }}>
        <div className="card card-pad">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <div className="field">
              <label>Account</label>
              <select className="input" value={form.account} onChange={e => updateForm("account", e.target.value)}>
                <option>Aoki for Senate</option>
                <option>Citizens for Coastal Renewal</option>
                <option>Harden for Congress (NJ-3)</option>
                <option>Public Affairs / state contract</option>
                <option>Internal</option>
              </select>
            </div>
            <div className="field">
              <label>Asset type</label>
              <select className="input" value={form.type} onChange={e => updateForm("type", e.target.value)}>
                <option>Print — direct mail</option>
                <option>Print — one-pager / leave-behind</option>
                <option>Video — broadcast TV</option>
                <option>Video — digital / OTT</option>
                <option>Social — static</option>
                <option>Social — animated</option>
                <option>Web — landing page</option>
                <option>Other</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label>Working title</label>
            <input className="input" placeholder='e.g. "Aoki — Lighthouse 30s TV spot"' value={form.title} onChange={e => updateForm("title", e.target.value)} />
            <div className="help">Used to create the Odoo task name and the Drive folder.</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <div className="field">
              <label>Primary audience</label>
              <input className="input" placeholder="e.g. OH suburban women 35–54" value={form.audience} onChange={e => updateForm("audience", e.target.value)} />
            </div>
            <div className="field">
              <label>Single most important takeaway</label>
              <input className="input" placeholder="One sentence — what should they walk away knowing?" value={form.cta} onChange={e => updateForm("cta", e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>Spec / creative direction</label>
            <textarea className="input" rows={5} placeholder="Tone, must-include lines, must-avoid, references, format constraints, talent, locations, voice-over notes…" value={form.spec} onChange={e => updateForm("spec", e.target.value)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18 }}>
            <div className="field">
              <label>Needed by</label>
              <input className="input" type="date" value={form.deadline} onChange={e => updateForm("deadline", e.target.value)} />
            </div>
            <div className="field">
              <label>Priority</label>
              <select className="input" value={form.priority} onChange={e => updateForm("priority", e.target.value)}>
                <option>Standard</option>
                <option>Rush — within 48h</option>
                <option>Election critical</option>
              </select>
            </div>
            <div className="field">
              <label>Budget code</label>
              <input className="input" placeholder="Auto-filled from account" defaultValue="AOK-26-CRTV-002" />
            </div>
          </div>

          {/* Upload */}
          <div className="field">
            <label>Reference files</label>
            <div style={{
              border: "1.5px dashed var(--fs-border-strong)",
              borderRadius: 4,
              padding: "26px 20px",
              textAlign: "center",
              background: "var(--fs-bone-50)",
              cursor: "pointer",
            }}
              onClick={() => updateForm("files", form.files + 1)}
            >
              <Icon name="upload" size={22} color="var(--fs-navy)" />
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fs-navy)", marginTop: 8 }}>
                Drop scripts, scratch tracks, prior creative, or sketches
              </div>
              <div style={{ fontSize: 12, color: "var(--fs-fg-muted)", marginTop: 4 }}>
                or click to browse · max 250 MB · {form.files} file{form.files === 1 ? "" : "s"} attached
              </div>
            </div>
          </div>

          <div className="divider" />

          <div className="row between">
            <div className="mut" style={{ fontSize: 12 }}>
              Will create <code className="fs-mono">ODOO-####</code> · Drive folder · Slack thread in <code className="fs-mono">#design-{form.account.toLowerCase().split(" ")[0]}</code>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn ghost" onClick={() => setTab("queue")}>Cancel</button>
              <button className="btn secondary">Save as draft</button>
              <button className="btn primary" onClick={() => setTab("queue")}>Submit Request <Icon name="arrow-right" size={14} /></button>
            </div>
          </div>
        </div>

        {/* Side rail: where this goes */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card card-pad">
            <Eyebrow>What happens next</Eyebrow>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { ic: "circle-check", on: true,  title: "Odoo task created",         body: "Auto-filed in the Design pipeline with priority + due date." },
                { ic: "folder",       on: true,  title: "Drive folder provisioned",  body: <>Path: <code className="fs-mono">/{form.account || "Account"}/{form.title || "Working title"}/</code></> },
                { ic: "users",        on: false, title: "Designer assigned",         body: "Routed to next available designer; usually within an hour during business hours." },
                { ic: "comment",      on: false, title: "Slack thread opened",       body: "You'll be added to a project channel for fast turnaround on questions." },
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 12 }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: s.on ? "var(--fs-navy)" : "var(--fs-bone-100)",
                    color: s.on ? "var(--fs-paper)" : "var(--fs-fg-subtle)",
                    display: "grid", placeItems: "center", flexShrink: 0,
                  }}>
                    <Icon name={s.ic} size={14} />
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)" }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: "var(--fs-fg-muted)", marginTop: 2 }}>{s.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card card-pad" style={{ background: "var(--fs-bone-50)" }}>
            <Eyebrow>SLA reminder</Eyebrow>
            <p className="fs-body-serif" style={{ fontSize: 14, margin: "10px 0 0", lineHeight: 1.55 }}>
              Standard requests turn around in <strong>3 business days</strong>. Election-critical work is acknowledged within <strong>1 hour</strong> and reaches first proof within <strong>24 hours</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  if (tab === "proof" && activeReq) return (
    <div>
      <PageHead
        eyebrow={activeReq.id + " · " + activeReq.account}
        title={activeReq.title}
        sub={`Proofing ${activeReq.version} · Assigned to ${activeReq.assignee} · Drive folder ${activeReq.account.toLowerCase().split(" ")[0]}/${activeReq.id.toLowerCase()}/`}
        actions={
          <>
            <button className="btn ghost" onClick={() => { setActiveReq(null); setTab("queue"); }}><Icon name="chevron-left" size={14} /> Queue</button>
            <button className="btn secondary"><Icon name="external" size={13} /> Open in Drive</button>
            {role !== "client" && <button className="btn secondary"><Icon name="external" size={13} /> Odoo task</button>}
            <button className="btn primary"><Icon name="check" size={13} /> Approve</button>
          </>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, alignItems: "flex-start" }}>
        {/* Proof viewer */}
        <div>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div className="row" style={{ gap: 4 }}>
                {["v1","v2","v3"].map(v => (
                  <button key={v} className={"btn " + (v === "v3" ? "primary" : "ghost")} style={{ padding: "4px 12px", fontSize: 12 }}>{v}</button>
                ))}
                <div style={{ width: 1, height: 18, background: "var(--fs-border)", margin: "0 8px" }} />
                <Tag tone="gold">Proofing</Tag>
              </div>
              <div className="row" style={{ gap: 8, fontSize: 12, color: "var(--fs-fg-muted)" }}>
                <Icon name="image" size={13} /> 1920 × 1080 · :30 · Final mix
              </div>
            </div>

            {/* Mock video frame */}
            <div style={{
              position: "relative", aspectRatio: "16/9",
              background: "linear-gradient(180deg, #0e2238 0%, #1A3A5C 60%, #2A527F 100%)",
              borderRadius: 2, overflow: "hidden", cursor: "crosshair",
            }}>
              {/* Lighthouse silhouette */}
              <svg viewBox="0 0 800 450" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
                <defs>
                  <radialGradient id="beam" cx="0.45" cy="0.55" r="0.6">
                    <stop offset="0%" stopColor="#EFC53F" stopOpacity="0.5"/>
                    <stop offset="100%" stopColor="#EFC53F" stopOpacity="0"/>
                  </radialGradient>
                </defs>
                <ellipse cx="380" cy="240" rx="320" ry="180" fill="url(#beam)"/>
                {/* Cliff */}
                <path d="M 0 380 L 240 360 L 320 330 L 380 320 L 800 360 L 800 450 L 0 450 Z" fill="#0E2238"/>
                {/* Lighthouse */}
                <g transform="translate(340 200)">
                  <rect x="-3" y="0" width="6" height="14" fill="#EFC53F"/>
                  <rect x="-12" y="14" width="24" height="6" fill="#0E2238"/>
                  <rect x="-9" y="20" width="18" height="70" fill="#D3D2C3"/>
                  <rect x="-9" y="36" width="18" height="6" fill="#1A3A5C"/>
                  <rect x="-9" y="52" width="18" height="6" fill="#1A3A5C"/>
                  <rect x="-12" y="86" width="24" height="6" fill="#0E2238"/>
                  <rect x="-3" y="14" width="6" height="6" fill="#0E2238"/>
                </g>
                {/* Title card */}
                <text x="400" y="408" fontFamily="Baskerville Brand, Baskerville, serif" fontSize="34" fontWeight="700" textAnchor="middle" fill="#FFFFFF" letterSpacing="-0.5">For Ohio.</text>
                <text x="400" y="432" fontFamily="Source Sans 3, sans-serif" fontSize="11" textAnchor="middle" fill="rgba(255,255,255,0.55)" letterSpacing="3">PAID FOR BY AOKI FOR SENATE</text>
              </svg>

              {/* Comment markers */}
              {comments.filter(c => c.marker).map(c => (
                <div key={c.id} style={{
                  position: "absolute", left: `${c.marker.x}%`, top: `${c.marker.y}%`,
                  width: 26, height: 26, borderRadius: "50%",
                  background: "var(--fs-gold)", color: "var(--fs-navy-900)",
                  display: "grid", placeItems: "center", fontWeight: 700, fontSize: 12,
                  border: "2px solid var(--fs-paper)", boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                  transform: "translate(-50%, -50%)", cursor: "pointer",
                }}>{c.id}</div>
              ))}

              {/* Play bar */}
              <div style={{
                position: "absolute", left: 14, right: 14, bottom: 12,
                display: "flex", alignItems: "center", gap: 12,
                padding: "8px 14px", background: "rgba(14,34,56,0.55)", backdropFilter: "blur(8px)",
                borderRadius: 4, color: "var(--fs-paper)",
              }}>
                <Icon name="play" size={14} color="#fff" />
                <div style={{ flex: 1, height: 2, background: "rgba(255,255,255,0.25)", borderRadius: 2, position: "relative" }}>
                  <div style={{ width: "62%", height: "100%", background: "var(--fs-gold)" }} />
                </div>
                <div className="num" style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>0:18 / 0:30</div>
              </div>
            </div>
            <div className="mut" style={{ fontSize: 12, marginTop: 10 }}>Click anywhere on the frame to drop a timestamped comment.</div>
          </div>

          {/* Files in this folder */}
          <div className="card" style={{ marginTop: 24 }}>
            <div className="card-head">
              <h3>Drive Folder · {activeReq.id}</h3>
              <a className="card-link" href="#"><Icon name="external" size={11} /> Open in Drive</a>
            </div>
            <table className="tbl">
              <thead><tr><th>File</th><th>Version</th><th>Type</th><th>Updated</th><th></th></tr></thead>
              <tbody>
                {[
                  { f: "Aoki_Lighthouse_30s_v3_FinalMix.mp4", v: "v3", t: "Video", u: "Today 10:42 AM" },
                  { f: "Aoki_Lighthouse_30s_v2.mp4",         v: "v2", t: "Video", u: "May 19" },
                  { f: "Aoki_Lighthouse_script.docx",        v: "—",  t: "Doc",   u: "May 17" },
                  { f: "Aoki_Lighthouse_storyboard.pdf",     v: "—",  t: "PDF",   u: "May 16" },
                ].map(r => (
                  <tr key={r.f}>
                    <td><Icon name="image" size={13} style={{ marginRight: 8, color: "var(--fs-fg-muted)" }} /> {r.f}</td>
                    <td>{r.v}</td>
                    <td className="mut">{r.t}</td>
                    <td className="mut">{r.u}</td>
                    <td style={{ textAlign: "right" }}><button className="btn ghost sm"><Icon name="download" size={12} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Comments rail */}
        <div className="card" style={{ display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 220px)" }}>
          <div className="card-head">
            <h3>Proof Comments · {comments.length}</h3>
            {role === "client" && <Tag tone="navy">Client View</Tag>}
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {comments.map(c => (
              <div key={c.id} style={{ padding: "16px 18px", borderBottom: "1px solid var(--fs-border)" }}>
                <div className="row" style={{ alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
                  {c.marker && (
                    <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--fs-gold)", color: "var(--fs-navy-900)", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                      {c.id}
                    </span>
                  )}
                  {!c.marker && <Avatar name={c.author} size={20} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)" }}>{c.author}</div>
                    <div style={{ fontSize: 11, color: "var(--fs-fg-subtle)" }}>{c.role} · {c.at}</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--fs-ink)" }}>{c.text}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: 14, borderTop: "1px solid var(--fs-border)" }}>
            <textarea className="input" rows={2} placeholder="Add a comment, or click the frame to mark a point…" value={draft} onChange={e => setDraft(e.target.value)} />
            <div className="row between" style={{ marginTop: 8 }}>
              <span className="mut" style={{ fontSize: 11 }}>@mention to notify</span>
              <button className="btn primary sm" onClick={() => {
                if (!draft.trim()) return;
                setComments(cs => [...cs, { id: cs.length + 1, author: user.name, role: role[0].toUpperCase() + role.slice(1), at: "Just now", text: draft, marker: null }]);
                setDraft("");
              }}>Post comment</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ---------------- QUEUE ----------------
  return (
    <div>
      <PageHead
        eyebrow="Design Requests"
        title={role === "client" ? "Your Active Proofs" : "Design Queue"}
        sub={role === "client"
          ? "Active and recently approved creative for your campaign. Click any item to review and comment."
          : "Every brief lives here. Submitting creates an Odoo task and a Drive folder automatically."}
        actions={role !== "client" && <>
          <button className="btn secondary"><Icon name="filter" size={13} /> Filter</button>
          <button className="btn primary" onClick={() => setTab("new")}><Icon name="plus" size={14} /> New Request</button>
        </>}
      />

      {/* Status strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 1, background: "var(--fs-border)", border: "1px solid var(--fs-border)", borderRadius: 4, marginBottom: 24, overflow: "hidden" }}>
        {[
          { label: "Intake", count: 1, t: "outline" },
          { label: "Brief Review", count: 1, t: "navy" },
          { label: "In Design", count: 2, t: "warning" },
          { label: "Proofing", count: 1, t: "gold" },
          { label: "Approved this week", count: 4, t: "success" },
        ].map(s => (
          <div key={s.label} style={{ background: "var(--fs-paper)", padding: "16px 18px" }}>
            <div className="num" style={{ fontFamily: "var(--fs-font-display)", fontSize: 26, fontWeight: 700, color: "var(--fs-navy)" }}>{s.count}</div>
            <div className="mut" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 80 }}>ID</th>
              <th>Title</th>
              <th>Account</th>
              <th>Type</th>
              <th>Status</th>
              <th>Designer</th>
              <th>Due</th>
              <th style={{ textAlign: "right" }}>Proofs</th>
            </tr>
          </thead>
          <tbody>
            {requests.map(r => (
              <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => { setActiveReq(r); setTab("proof"); }}>
                <td className="num mut">{r.id}</td>
                <td>
                  <div style={{ fontWeight: 600, color: "var(--fs-navy)" }}>{r.title}</div>
                  <div className="mut" style={{ fontSize: 11, marginTop: 2 }}>{r.odoo !== "—" ? <>Odoo {r.odoo} · </> : null}requested {r.requested}</div>
                </td>
                <td className="mut">{r.account}</td>
                <td><Tag tone="outline">{r.type}</Tag></td>
                <td><Tag tone={statusTone[r.status]}>{r.status}</Tag></td>
                <td>
                  {r.assignee === "—" ? <span className="sub">Unassigned</span> : (
                    <div className="row" style={{ gap: 6 }}>
                      <Avatar name={r.assignee} size={22} />
                      <span style={{ fontSize: 13 }}>{r.assignee.split(" ")[0]}</span>
                    </div>
                  )}
                </td>
                <td className="num mut">{r.due}</td>
                <td className="num" style={{ textAlign: "right", color: "var(--fs-fg-muted)" }}>{r.proofs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

window.DesignView = DesignView;
