/* global React */
const { useState: useStateMedia } = React;

function MediaView({ user, role, client, clientId }) {
  const [tab, setTab] = useStateMedia("mentions"); // mentions | journalists | narratives
  const [sentimentFilter, setSentimentFilter] = useStateMedia("all");
  const [outletFilter, setOutletFilter] = useStateMedia("all");
  const [query, setQuery] = useStateMedia("");

  // ----- Mentions corpus -----
  const allMentions = [
    { id: 1, headline: "Aoki rallies Cleveland labor leaders in tight Senate primary",
      outlet: "Cleveland Plain Dealer",          journalist: "Maria Quintero", client: "aoki",
      date: "May 19 · 7:42 AM", sentiment: "pos", reach: 482000, type: "Article",
      excerpt: "The state senator drew an AFL-CIO endorsement Friday and signaled a sharper closing argument…" },
    { id: 2, headline: "Reyes hits Aoki on rural districts in new closing ad",
      outlet: "Columbus Dispatch",               journalist: "Daniel Strom",   client: "aoki",
      date: "May 19 · 6:15 AM", sentiment: "neg", reach: 312000, type: "Article",
      excerpt: "A new sixty-second spot from the Reyes campaign accuses the front-runner of \"leaving rural Ohio behind\"…" },
    { id: 3, headline: "What the Coastal Renewal coalition actually wants",
      outlet: "WHRO Public Media",               journalist: "Aisha Tatum",    client: "coastal",
      date: "May 18 · 4:30 PM", sentiment: "pos", reach: 218000, type: "Broadcast",
      excerpt: "The newly-launched coalition draws together watermen, faith leaders, and retired naval officers — a less obvious set of bedfellows…" },
    { id: 4, headline: "Harden picks up Sherrill backing in NJ-3 fight",
      outlet: "POLITICO New Jersey",             journalist: "Frank Liu",      client: "harden",
      date: "May 18 · 11:08 AM", sentiment: "pos", reach: 188000, type: "Article" },
    { id: 5, headline: "Op-ed: Ohio's primary turnout is a warning sign",
      outlet: "The Atlantic",                    journalist: "Sherelle Anwar", client: "aoki",
      date: "May 17 · 9:00 AM", sentiment: "neu", reach: 1900000, type: "Op-ed",
      excerpt: "Even in years where the Democratic ticket appears settled, primary participation tells you a great deal about general-election engagement…" },
    { id: 6, headline: "Harden under pressure from progressive groups on housing",
      outlet: "InsiderNJ",                       journalist: "Trish Halloran", client: "harden",
      date: "May 17 · 2:42 PM", sentiment: "neg", reach: 48000, type: "Article" },
    { id: 7, headline: "Coastal Renewal launch covered statewide; partners include AFL-CIO Ohio chapter",
      outlet: "Virginia Mercury",                journalist: "Cole Erickson",  client: "coastal",
      date: "May 16 · 6:10 AM", sentiment: "pos", reach: 92000,  type: "Article" },
    { id: 8, headline: "Five questions for Hughes as the governor's race tightens",
      outlet: "Toledo Blade",                    journalist: "Patricia Goss",  client: "hughes",
      date: "May 16 · 5:50 PM", sentiment: "neu", reach: 152000, type: "Article" },
    { id: 9, headline: "Patel mounts late surge in OH-12",
      outlet: "WCMH-NBC4",                       journalist: "James Verde",    client: "patel",
      date: "May 15 · 6:11 PM", sentiment: "pos", reach: 240000, type: "Broadcast" },
    { id:10, headline: "Aoki camp dismisses internal polling leak as \"noise\"",
      outlet: "Cleveland.com",                   journalist: "Maria Quintero", client: "aoki",
      date: "May 14 · 10:24 AM", sentiment: "neu", reach: 482000, type: "Article" },
    { id:11, headline: "Faith leaders side with Coastal Renewal coalition",
      outlet: "Religion News Service",           journalist: "Hugh Park",      client: "coastal",
      date: "May 13 · 8:20 AM", sentiment: "pos", reach: 410000, type: "Article" },
    { id:12, headline: "Aoki's ad budget pulls back from rural markets",
      outlet: "Cincinnati Enquirer",             journalist: "Dale Marsh",     client: "aoki",
      date: "May 12 · 7:15 AM", sentiment: "neg", reach: 198000, type: "Article" },
  ];

  // Filter by client + role
  const mentions = allMentions.filter(m => {
    if (clientId !== "all" && m.client !== clientId) return false;
    if (role === "client" && m.client !== "aoki") return false;
    return true;
  });

  const filtered = mentions
    .filter(m => sentimentFilter === "all" || m.sentiment === sentimentFilter)
    .filter(m => outletFilter === "all" || m.outlet === outletFilter)
    .filter(m => !query || (m.headline + " " + m.journalist).toLowerCase().includes(query.toLowerCase()));

  // Stats
  const total = mentions.length;
  const pos = mentions.filter(m => m.sentiment === "pos").length;
  const neg = mentions.filter(m => m.sentiment === "neg").length;
  const neu = mentions.filter(m => m.sentiment === "neu").length;
  const reach = mentions.reduce((a, m) => a + m.reach, 0);

  const outlets = Array.from(new Set(mentions.map(m => m.outlet)));

  return (
    <div>
      <PageHead
        eyebrow="Media Monitoring · Muck Rack feed"
        title={clientId === "all" ? "All Coverage" : (client?.name + " coverage")}
        sub="Live mentions across print, broadcast, and digital. Sentiment-tagged and filterable by outlet and journalist."
        actions={
          <>
            <button className="btn secondary"><Icon name="external" size={13} /> Open in Muck Rack</button>
            <button className="btn secondary"><Icon name="download" size={13} /> Clip report</button>
            {role !== "client" && <button className="btn primary"><Icon name="plus" size={14} /> New alert</button>}
          </>
        }
      />

      {/* Stat strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 1, background: "var(--fs-border)", border: "1px solid var(--fs-border)", borderRadius: 4, marginBottom: 22, overflow: "hidden" }}>
        <div style={{ background: "var(--fs-paper)", padding: "14px 18px" }}>
          <Stat figure={total} label="Mentions · 7 days" />
        </div>
        <button onClick={() => setSentimentFilter(sentimentFilter === "pos" ? "all" : "pos")} style={{ background: sentimentFilter === "pos" ? "rgba(47,107,79,0.10)" : "var(--fs-paper)", padding: "14px 18px", border: "none", cursor: "pointer", textAlign: "left" }}>
          <div className="num" style={{ fontFamily: "var(--fs-font-display)", fontSize: 32, fontWeight: 700, color: "var(--fs-success)" }}>{pos}</div>
          <div className="mut" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600 }}>Positive</div>
        </button>
        <button onClick={() => setSentimentFilter(sentimentFilter === "neu" ? "all" : "neu")} style={{ background: sentimentFilter === "neu" ? "var(--fs-bone-100)" : "var(--fs-paper)", padding: "14px 18px", border: "none", cursor: "pointer", textAlign: "left" }}>
          <div className="num" style={{ fontFamily: "var(--fs-font-display)", fontSize: 32, fontWeight: 700, color: "var(--fs-fg-muted)" }}>{neu}</div>
          <div className="mut" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600 }}>Neutral</div>
        </button>
        <button onClick={() => setSentimentFilter(sentimentFilter === "neg" ? "all" : "neg")} style={{ background: sentimentFilter === "neg" ? "rgba(168,52,30,0.10)" : "var(--fs-paper)", padding: "14px 18px", border: "none", cursor: "pointer", textAlign: "left" }}>
          <div className="num" style={{ fontFamily: "var(--fs-font-display)", fontSize: 32, fontWeight: 700, color: "var(--fs-danger)" }}>{neg}</div>
          <div className="mut" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600 }}>Negative</div>
        </button>
        <div style={{ background: "var(--fs-paper)", padding: "14px 18px" }}>
          <div className="num" style={{ fontFamily: "var(--fs-font-display)", fontSize: 32, fontWeight: 700, color: "var(--fs-navy)" }}>{(reach/1e6).toFixed(1)}M</div>
          <div className="mut" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600 }}>Total reach</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--fs-border)", marginBottom: 18 }}>
        {[
          { id: "mentions",    label: "Mentions feed", n: total },
          { id: "journalists", label: "Journalists",   n: outlets.length },
          { id: "narratives",  label: "Narratives",    n: 4 },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "10px 18px",
            background: "transparent",
            border: "none",
            borderBottom: "2px solid " + (tab === t.id ? "var(--fs-gold)" : "transparent"),
            color: tab === t.id ? "var(--fs-navy)" : "var(--fs-fg-muted)",
            fontSize: 13, fontWeight: 600,
            cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
            marginBottom: -1,
          }}>
            {t.label}
            <span className="tag outline" style={{ padding: "1px 6px", fontSize: 10 }}>{t.n}</span>
          </button>
        ))}
      </div>

      {tab === "mentions" && (
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 22, alignItems: "flex-start" }}>
          {/* Filter rail */}
          <aside className="card">
            <div className="card-head"><h3>Filters</h3></div>
            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div className="lbl">Search</div>
                <div className="search" style={{ width: "100%", padding: "6px 10px" }}>
                  <Icon name="search" size={13} />
                  <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Headline or journalist" />
                </div>
              </div>
              <div>
                <div className="lbl">Outlet</div>
                <select className="input" value={outletFilter} onChange={e => setOutletFilter(e.target.value)}>
                  <option value="all">All outlets</option>
                  {outlets.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <div className="lbl">Sentiment</div>
                <div className="row" style={{ gap: 4 }}>
                  {[
                    { v: "all", l: "All" },
                    { v: "pos", l: "Pos" },
                    { v: "neu", l: "Neu" },
                    { v: "neg", l: "Neg" },
                  ].map(s => (
                    <button key={s.v} onClick={() => setSentimentFilter(s.v)}
                      className={"btn " + (sentimentFilter === s.v ? "primary" : "secondary")}
                      style={{ flex: 1, padding: "5px 0", fontSize: 12 }}>
                      {s.l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="divider" style={{ margin: 0 }} />
              <div>
                <div className="lbl">Saved alerts</div>
                <div className="col" style={{ gap: 4 }}>
                  {[
                    { n: "Aoki + AFL-CIO",        on: true },
                    { n: "Reyes attack lines",    on: true },
                    { n: "Coastal Renewal launch",on: true },
                    { n: "Harden + Sherrill",     on: false },
                  ].map(a => (
                    <label key={a.n} className="row" style={{ gap: 8, padding: "5px 4px", fontSize: 13, cursor: "pointer" }}>
                      <input type="checkbox" defaultChecked={a.on} style={{ accentColor: "var(--fs-gold)" }} />
                      {a.n}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Mentions list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map(m => <MentionCard key={m.id} m={m} />)}
            {filtered.length === 0 && <div className="card card-pad mut" style={{ textAlign: "center" }}>No mentions match these filters.</div>}
          </div>
        </div>
      )}

      {tab === "journalists" && <JournalistsList mentions={mentions} clientId={clientId} />}

      {tab === "narratives" && <Narratives clientId={clientId} />}
    </div>
  );
}

function MentionCard({ m }) {
  const tones = { pos: { l: "Positive", c: "var(--fs-success)", bg: "rgba(47,107,79,0.10)" },
                  neu: { l: "Neutral",  c: "var(--fs-fg-muted)", bg: "var(--fs-bone-100)" },
                  neg: { l: "Negative", c: "var(--fs-danger)",   bg: "rgba(168,52,30,0.10)" } };
  const t = tones[m.sentiment];
  return (
    <div className="card" style={{ padding: 0, display: "flex" }}>
      {/* Outlet badge bar */}
      <div style={{ width: 4, background: t.c, flexShrink: 0 }} />
      <div style={{ padding: "16px 20px", flex: 1, minWidth: 0 }}>
        <div className="row" style={{ gap: 10, marginBottom: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--fs-font-display)", fontSize: 13, fontWeight: 700, color: "var(--fs-navy)", letterSpacing: 0 }}>{m.outlet}</span>
          <span className="mut" style={{ fontSize: 11 }}>· {m.journalist}</span>
          <span className="mut" style={{ fontSize: 11 }}>· {m.date}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, padding: "2px 8px", background: t.bg, color: t.c, borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: t.c }} />
            {t.l}
          </span>
          <Tag tone="outline">{m.type}</Tag>
          <div className="grow" />
          <span className="num mut" style={{ fontSize: 11 }}>{(m.reach/1000).toFixed(0)}k reach</span>
        </div>
        <h3 style={{ fontFamily: "var(--fs-font-display)", fontSize: 18, fontWeight: 700, color: "var(--fs-ink)", margin: "0 0 6px", letterSpacing: "-0.005em" }}>
          {m.headline}
        </h3>
        {m.excerpt && (
          <p className="mut" style={{ fontSize: 13, lineHeight: 1.55, margin: 0 }}>
            {m.excerpt}
          </p>
        )}
        <div className="row" style={{ gap: 14, marginTop: 12, fontSize: 12 }}>
          <a href="#" style={{ color: "var(--fs-navy)", textDecoration: "none", fontWeight: 600 }}><Icon name="external" size={11} /> Read</a>
          <a href="#" style={{ color: "var(--fs-fg-muted)", textDecoration: "none" }}>Forward to client</a>
          <a href="#" style={{ color: "var(--fs-fg-muted)", textDecoration: "none" }}>Add to clip report</a>
          <a href="#" style={{ color: "var(--fs-fg-muted)", textDecoration: "none" }}>Flag inaccuracy</a>
        </div>
      </div>
    </div>
  );
}

function JournalistsList({ mentions, clientId }) {
  // Aggregate by journalist
  const byJourno = {};
  mentions.forEach(m => {
    if (!byJourno[m.journalist]) byJourno[m.journalist] = { name: m.journalist, outlet: m.outlet, mentions: 0, reach: 0, sentiment: { pos: 0, neu: 0, neg: 0 } };
    byJourno[m.journalist].mentions++;
    byJourno[m.journalist].reach += m.reach;
    byJourno[m.journalist].sentiment[m.sentiment]++;
  });
  const rows = Object.values(byJourno).sort((a,b) => b.reach - a.reach);

  return (
    <div className="card">
      <table className="tbl">
        <thead>
          <tr><th>Journalist</th><th>Outlet</th><th>Mentions</th><th>Sentiment mix</th><th style={{ textAlign: "right" }}>Reach</th><th></th></tr>
        </thead>
        <tbody>
          {rows.map(j => {
            const total = j.sentiment.pos + j.sentiment.neu + j.sentiment.neg;
            return (
              <tr key={j.name}>
                <td>
                  <div className="row" style={{ gap: 10 }}>
                    <Avatar name={j.name} size={26} />
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--fs-navy)" }}>{j.name}</div>
                      <div className="mut" style={{ fontSize: 11 }}>Beat: politics, policy</div>
                    </div>
                  </div>
                </td>
                <td className="mut">{j.outlet}</td>
                <td className="num">{j.mentions}</td>
                <td>
                  <div className="row" style={{ gap: 2, width: 140, height: 8, background: "var(--fs-bone-100)", borderRadius: 999, overflow: "hidden" }}>
                    {j.sentiment.pos > 0 && <div style={{ width: (j.sentiment.pos/total*100)+"%", background: "var(--fs-success)" }} />}
                    {j.sentiment.neu > 0 && <div style={{ width: (j.sentiment.neu/total*100)+"%", background: "var(--fs-ink-300)" }} />}
                    {j.sentiment.neg > 0 && <div style={{ width: (j.sentiment.neg/total*100)+"%", background: "var(--fs-danger)" }} />}
                  </div>
                </td>
                <td className="num" style={{ textAlign: "right", fontWeight: 700, color: "var(--fs-navy)" }}>{(j.reach/1000).toFixed(0)}k</td>
                <td style={{ textAlign: "right" }}>
                  <button className="btn ghost sm"><Icon name="external" size={12} /></button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Narratives({ clientId }) {
  const narratives = [
    { t: "Aoki labor coalition holds",    delta: "+4 articles this week", trend: "up",   c: "var(--fs-success)",
      summary: "Frame: union backing as the closing argument. AFL-CIO Ohio endorsement is the anchor; education + faith leaders amplifying." },
    { t: "Reyes \"left rural behind\" attack",   delta: "+2 articles, paid amplification", trend: "up",   c: "var(--fs-danger)",
      summary: "Frame: front-runner ignoring non-urban Ohio. Cincinnati Enquirer ad-budget story is fuel. Response window 24–48h." },
    { t: "Coastal Renewal coalition launch", delta: "Steady; 4 outlets",     trend: "flat", c: "var(--fs-gold-700)",
      summary: "Frame: unusual-bedfellows story (watermen + naval officers + faith). Holding through earned-media cycle, paid coming." },
    { t: "Primary turnout vs 2022",        delta: "Macro analysis pieces",   trend: "up",   c: "var(--fs-navy)",
      summary: "Frame: ohio primary turnout running 8% above 2022 — pundit class is using to predict GE engagement. Atlantic op-ed is the marker." },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
      {narratives.map(n => (
        <div key={n.t} className="card card-pad">
          <div className="row between" style={{ marginBottom: 10 }}>
            <Eyebrow>Narrative</Eyebrow>
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 11, fontWeight: 600, color: n.c }}>
              <Icon name="trend-up" size={12} />
              {n.delta}
            </span>
          </div>
          <h3 style={{ fontFamily: "var(--fs-font-display)", fontSize: 20, fontWeight: 700, color: "var(--fs-navy)", margin: "0 0 8px", letterSpacing: "-0.005em" }}>
            {n.t}
          </h3>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--fs-ink)", margin: 0 }}>{n.summary}</p>
          <div className="row" style={{ gap: 12, marginTop: 14, fontSize: 12 }}>
            <a href="#" style={{ color: "var(--fs-navy)", textDecoration: "none", fontWeight: 600 }}>View clips →</a>
            <a href="#" style={{ color: "var(--fs-fg-muted)", textDecoration: "none" }}>Brief client</a>
            <a href="#" style={{ color: "var(--fs-fg-muted)", textDecoration: "none" }}>Plan response</a>
          </div>
        </div>
      ))}
    </div>
  );
}

window.MediaView = MediaView;
