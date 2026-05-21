/* global React */
const { useState: useStatePolling } = React;

function PollingView({ role, clientId, client }) {
  const [poll, setPoll] = useStatePolling("statewide");

  const polls = [
    { id: "statewide", title: "Statewide topline",          n: 812, moe: "±3.4%", date: "May 12–17", unlocked: ["staff","admin","client"], tone: "Aoki leads +5.2" },
    { id: "issue",     title: "Issue battery — Coastal",    n: 812, moe: "±3.4%", date: "May 12–17", unlocked: ["staff","admin","client"], tone: "Clean water → 78% support" },
    { id: "adtest",    title: "Ad test — \"Lighthouse\" 30s", n: 401, moe: "±4.9%", date: "May 14",    unlocked: ["staff","admin"], tone: "Persuasion +4.1 net" },
    { id: "tracking",  title: "Final pre-primary tracking", n: 600, moe: "±4.0%", date: "May 18–19", unlocked: ["staff","admin"], tone: "Locked-in support 71%" },
  ];
  const visible = polls.filter(p => p.unlocked.includes(role));
  const sel = visible.find(p => p.id === poll) || visible[0];

  // Topline values for client view chart
  const topline = [
    { n: "Aoki",     v: 47.2, c: "var(--fs-navy)"      },
    { n: "Reyes",    v: 42.0, c: "var(--fs-navy-500)"  },
    { n: "Whitmore", v: 8.0,  c: "var(--fs-bone)"      },
    { n: "Undecided",v: 2.8,  c: "var(--fs-ink-300)"   },
  ];

  return (
    <div>
      <PageHead
        eyebrow={role === "client" ? "Released to you" : "Polling Library"}
        title={role === "client" ? "Polling — Aoki for Senate" : "Polling"}
        sub={role === "client"
          ? "Topline and issue numbers your Fog Signal team has released to you. Crosstabs and ad tests are held until further analysis."
          : "All polling for active retainers. Lock and release findings to client portals from each poll page."}
        actions={role === "admin" && <button className="btn primary"><Icon name="plus" size={14} /> Upload poll</button>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24, alignItems: "flex-start" }}>
        <aside className="card">
          <div className="card-head"><h3>Polls</h3></div>
          <div style={{ padding: 8 }}>
            {polls.map(p => {
              const locked = !p.unlocked.includes(role);
              const active = sel && sel.id === p.id;
              return (
                <button key={p.id} disabled={locked} onClick={() => setPoll(p.id)} style={{
                  width: "100%", textAlign: "left", padding: "12px 14px",
                  background: active ? "var(--fs-navy-50)" : "transparent",
                  border: "1px solid " + (active ? "var(--fs-navy)" : "transparent"),
                  borderRadius: 4, cursor: locked ? "not-allowed" : "pointer",
                  marginBottom: 4, opacity: locked ? 0.55 : 1,
                }}>
                  <div className="row" style={{ gap: 6, marginBottom: 4 }}>
                    {locked
                      ? <Icon name="lock" size={11} color="var(--fs-fg-muted)" />
                      : <Icon name="circle-check" size={11} color="var(--fs-success)" />}
                    <span style={{ fontSize: 11, color: "var(--fs-fg-muted)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
                      {locked ? (role === "client" ? "Not released" : "Internal only") : "Released"}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)", marginBottom: 2 }}>{p.title}</div>
                  <div className="mut" style={{ fontSize: 11 }}>n={p.n} · {p.moe} · {p.date}</div>
                </button>
              );
            })}
          </div>
        </aside>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Headline */}
          <div className="card card-pad" style={{ background: "var(--fs-bone)" }}>
            <Eyebrow>{sel.date} · n={sel.n} · {sel.moe}</Eyebrow>
            <h2 style={{ fontFamily: "var(--fs-font-display)", fontStyle: "italic", fontSize: 30, fontWeight: 500, color: "var(--fs-navy)", margin: "14px 0 0", lineHeight: 1.25 }}>
              {sel.tone}
            </h2>
          </div>

          {/* Topline bars */}
          <div className="card card-pad">
            <h3 style={{ fontFamily: "var(--fs-font-sans)", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--fs-navy)", margin: "0 0 18px" }}>
              "If the Democratic primary for U.S. Senate were held today…"
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {topline.map(t => (
                <div key={t.n}>
                  <div className="row between" style={{ marginBottom: 6 }}>
                    <span style={{ fontFamily: "var(--fs-font-display)", fontSize: 18, fontWeight: 700, color: "var(--fs-navy)" }}>{t.n}</span>
                    <span className="num" style={{ fontFamily: "var(--fs-font-display)", fontSize: 22, fontWeight: 700, color: "var(--fs-navy)" }}>{t.v.toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 12, background: "var(--fs-bone-100)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: t.v + "%", height: "100%", background: t.c }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Issue numbers (client friendly) */}
          <div className="card">
            <div className="card-head">
              <h3>Issue Battery · Coastal Renewal</h3>
              {role !== "client" && <a className="card-link" href="#">Open crosstabs →</a>}
            </div>
            <table className="tbl">
              <thead><tr><th>Issue</th><th style={{ textAlign: "right" }}>Support</th><th style={{ textAlign: "right" }}>Oppose</th><th style={{ textAlign: "right" }}>Net</th><th>Reads</th></tr></thead>
              <tbody>
                {[
                  { n: "Clean water investment",            s: 78, o: 12, r: "Universal — bipartisan" },
                  { n: "Coastal flood-prep infrastructure", s: 71, o: 16, r: "Strong; older voters lead" },
                  { n: "Tax on commercial fisheries",       s: 41, o: 44, r: "Polarizing — soften framing" },
                  { n: "State buyback of vulnerable land",  s: 58, o: 27, r: "Persuasion target" },
                  { n: "Federal aid to working ports",      s: 64, o: 18, r: "Strong" },
                ].map(r => (
                  <tr key={r.n}>
                    <td style={{ fontWeight: 500, color: "var(--fs-navy)" }}>{r.n}</td>
                    <td className="num" style={{ textAlign: "right", fontWeight: 700, color: "var(--fs-success)" }}>{r.s}%</td>
                    <td className="num" style={{ textAlign: "right", color: "var(--fs-danger)" }}>{r.o}%</td>
                    <td className="num" style={{ textAlign: "right", fontWeight: 600 }}>+{r.s - r.o}</td>
                    <td className="mut">{r.r}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Client access lock notice */}
          {role === "client" && (
            <div style={{ display: "flex", gap: 14, padding: "16px 20px", background: "var(--fs-bone-50)", border: "1px dashed var(--fs-border-strong)", borderRadius: 4, alignItems: "flex-start" }}>
              <Icon name="lock" size={18} color="var(--fs-navy)" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)", marginBottom: 4 }}>Some materials are held for now</div>
                <div className="mut" style={{ fontSize: 13, lineHeight: 1.5 }}>
                  Crosstabs, ad tests, and tracking polls remain internal until your senior strategist releases them — usually after the next strategy call. Reach out to <a href="#" style={{ color: "var(--fs-navy)" }}>Margaret Voss</a> if you'd like an early read.
                </div>
                <div className="row" style={{ gap: 12, marginTop: 10, fontSize: 12 }}>
                  <span><strong>Allowed exports:</strong> Topline PDF, Issue battery PDF</span>
                  <span className="mut">·</span>
                  <span><strong>Restricted:</strong> Raw banner, individual respondent records</span>
                </div>
              </div>
            </div>
          )}

          {/* Release controls — admin only */}
          {role === "admin" && (
            <div className="card card-pad">
              <Eyebrow>Release controls</Eyebrow>
              <p className="mut" style={{ fontSize: 13, margin: "10px 0 14px" }}>
                Control which slices of this poll are visible to clients. Changes are audit-logged.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                {[
                  { n: "Topline PDF", on: true },
                  { n: "Issue battery", on: true },
                  { n: "Ad-test results", on: false },
                  { n: "Banner / crosstabs", on: false },
                  { n: "Persuasion model", on: false },
                  { n: "Raw respondent data", on: false },
                ].map(r => (
                  <label key={r.n} className="row" style={{ padding: "8px 12px", border: "1px solid var(--fs-border)", borderRadius: 4, fontSize: 13, cursor: "pointer" }}>
                    <input type="checkbox" defaultChecked={r.on} style={{ accentColor: "var(--fs-gold)" }} />
                    {r.n}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

window.PollingView = PollingView;
