/* global React */
const { useState: useStateElect, useEffect: useEffectElect, useMemo: useMemoElect } = React;

function ElectionView({ role, clientId, client }) {
  if (role === "client") {
    return (
      <div>
        <PageHead eyebrow="Election Night" title="Live results aren't released to client view." sub="Your strategist will share post-election analysis once results are certified. Reach out if you need an early read." />
        <div className="card card-pad" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Icon name="lock" size={20} color="var(--fs-navy)" />
          <div className="mut" style={{ fontSize: 14 }}>This section is staff-only by default.</div>
        </div>
      </div>
    );
  }

  // ----- Race universe -----
  const races = [
    { id: "OH-SEN", name: "U.S. Senate — Ohio (D primary)", short: "OH U.S. Senate D", account: "Aoki for Senate", priority: true,
      reporting: 64, called: false, leader: "AOKI", margin: 7.4,
      candidates: [
        { name: "Maya Aoki",       party: "D", color: "var(--fs-navy)", pct: 48.6, votes: 412847, prev: 0,    poll: 47.2 },
        { name: "Daniel Reyes",    party: "D", color: "var(--fs-navy-500)", pct: 41.2, votes: 350113, prev: 0, poll: 42.0 },
        { name: "Sarah Whitmore",  party: "D", color: "var(--fs-bone)",  pct: 7.8,  votes: 66218,  prev: 0,    poll: 8.0 },
        { name: "Other / write-in",party: "D", color: "var(--fs-ink-300)", pct: 2.4,  votes: 20384, prev: 0,   poll: 2.8 },
      ]
    },
    { id: "OH-12", name: "OH-12 U.S. House (D primary)", short: "OH-12 D", account: "Internal", priority: false,
      reporting: 71, called: false, leader: "PATEL", margin: 2.9,
      candidates: [
        { name: "Anjali Patel",  party: "D", color: "var(--fs-navy)", pct: 51.4, votes: 38214, poll: 49 },
        { name: "Marc Donnelly", party: "D", color: "var(--fs-navy-500)", pct: 48.5, votes: 36063, poll: 51 },
      ]
    },
    { id: "OH-GOV", name: "Governor — Ohio (D primary)", short: "OH Gov D", account: "—", priority: false,
      reporting: 58, called: true, leader: "HUGHES", margin: 18.2,
      candidates: [
        { name: "Robert Hughes",  party: "D", color: "var(--fs-navy)", pct: 58.1, votes: 480209, poll: 55 },
        { name: "Allison Park",   party: "D", color: "var(--fs-navy-500)", pct: 39.9, votes: 329881, poll: 42 },
        { name: "Other",          party: "D", color: "var(--fs-ink-300)", pct: 2.0,  votes: 16511,  poll: 3 },
      ]
    },
    { id: "OH-SOS", name: "Secretary of State — OH (D)", short: "OH SoS D", account: "Internal", priority: false,
      reporting: 49, called: false, leader: "OKAFOR", margin: 11.8,
      candidates: [
        { name: "Chinwe Okafor", party: "D", color: "var(--fs-navy)", pct: 55.6, votes: 220114, poll: 52 },
        { name: "Mike Brennan",  party: "D", color: "var(--fs-navy-500)", pct: 43.8, votes: 173420, poll: 45 },
      ]
    },
    { id: "NJ-3", name: "NJ-3 special — general", short: "NJ-3 General", account: "Harden for Congress", priority: true, future: true,
      reporting: 0, called: false, leader: "—", margin: 0,
      candidates: [
        { name: "Lena Harden",   party: "D", color: "var(--fs-navy)", pct: 0, votes: 0, poll: 50.5 },
        { name: "Tom Bishop",    party: "R", color: "#A8341E", pct: 0, votes: 0, poll: 47.1 },
        { name: "Other",         party: "I", color: "var(--fs-ink-300)", pct: 0, votes: 0, poll: 2.4 },
      ]
    },
  ];

  const [selected, setSelected] = useStateElect("OH-SEN");
  const race = races.find(r => r.id === selected);

  // ----- Vote math / projection -----
  // Simple "what does it take" math: outstanding vote × candidate average yields projection.
  const totalVotes = race.candidates.reduce((a, b) => a + b.votes, 0);
  const projTotal = race.reporting > 0 ? totalVotes / (race.reporting / 100) : 0;
  const outstanding = Math.max(0, projTotal - totalVotes);

  // ----- Precinct list (mocked for OH-SEN) -----
  const precincts = useMemoElect(() => {
    if (race.id !== "OH-SEN") return null;
    return [
      { id: "FRANK-01", name: "Franklin — Linden",       reporting: 100, leader: "AOKI",  margin: +18.4, prev: +12.1, poll: +14, ev: 4210, weight: "key" },
      { id: "FRANK-09", name: "Franklin — Clintonville", reporting: 100, leader: "AOKI",  margin: +9.2,  prev: +6.8,  poll: +7,  ev: 5840 },
      { id: "CUYA-23",  name: "Cuyahoga — Lakewood",     reporting: 92,  leader: "AOKI",  margin: +12.5, prev: +14.2, poll: +13, ev: 7820, weight: "key" },
      { id: "CUYA-14",  name: "Cuyahoga — Garfield Hts", reporting: 88,  leader: "REYES", margin: -2.1,  prev: +4.8,  poll: +1,  ev: 3210, weight: "concern" },
      { id: "HAMI-04",  name: "Hamilton — Mt. Auburn",   reporting: 76,  leader: "AOKI",  margin: +21.4, prev: +18.0, poll: +18, ev: 2940 },
      { id: "HAMI-12",  name: "Hamilton — Western Hills",reporting: 41,  leader: "REYES", margin: -8.0,  prev: -10.2, poll: -6,  ev: 1840, weight: "concern" },
      { id: "MONT-08",  name: "Montgomery — Trotwood",   reporting: 84,  leader: "AOKI",  margin: +24.1, prev: +22.0, poll: +20, ev: 4520, weight: "key" },
      { id: "LUCAS-02", name: "Lucas — South Toledo",    reporting: 55,  leader: "AOKI",  margin: +6.4,  prev: +9.0,  poll: +5,  ev: 2210 },
      { id: "SUMM-11",  name: "Summit — Akron West",     reporting: 28,  leader: "REYES", margin: -1.2,  prev: +3.4,  poll: +2,  ev: 1410, weight: "concern" },
    ];
  }, [race.id]);

  // ----- Auto-rotating live strip -----
  const [tick, setTick] = useStateElect(0);
  useEffectElect(() => {
    const i = setInterval(() => setTick(t => t + 1), 4000);
    return () => clearInterval(i);
  }, []);

  return (
    <div style={{ margin: "-28px -32px -80px", display: "flex", flexDirection: "column", height: "calc(100vh - 60px)" }}>
      {/* Live result strip */}
      <div style={{
        background: "var(--ks-ink-surface)", color: "var(--ks-on-ink)",
        padding: "14px 32px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div className="row" style={{ gap: 12, marginBottom: 10 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 700, color: "var(--fs-danger)", textTransform: "uppercase", letterSpacing: "0.14em" }}>
            <span className="pulse-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--fs-danger)" }} />
            Live · OH Primaries · {new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} ET
          </span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", letterSpacing: "0.05em" }}>
            Sources: OH SoS · AP · NEP · TargetSmart county feed
          </span>
          <span className="grow" />
          <button className="btn ghost sm" style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}><Icon name="settings" size={12} /> Strip settings</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 1, background: "rgba(255,255,255,0.08)" }}>
          {races.map(r => {
            const top = [...r.candidates].sort((a,b) => b.pct - a.pct)[0];
            const isSel = r.id === selected;
            return (
              <button key={r.id} onClick={() => setSelected(r.id)} style={{
                background: isSel ? "var(--ks-ink-surface-2)" : "var(--ks-ink-surface)",
                border: "none",
                padding: "12px 14px",
                textAlign: "left",
                color: "var(--ks-on-ink)",
                cursor: "pointer",
                position: "relative",
              }}>
                {isSel && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "var(--fs-gold)" }} />}
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: r.priority ? "var(--fs-gold)" : "rgba(255,255,255,0.5)", fontWeight: 700, marginBottom: 5 }}>
                  {r.priority && "★ "}{r.short}
                </div>
                {r.future ? (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>Polls close May 27 · 8 PM ET</div>
                ) : (
                  <>
                    <div className="row" style={{ gap: 8, marginBottom: 3 }}>
                      <span style={{ fontFamily: "var(--fs-font-display)", fontSize: 18, fontWeight: 700, lineHeight: 1 }}>
                        {top.pct.toFixed(1)}%
                      </span>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
                        {top.name.split(" ").slice(-1)[0].toUpperCase()} {r.margin > 0 ? "+" + r.margin.toFixed(1) : ""}
                      </span>
                      {r.called && <Tag tone="gold">Called</Tag>}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
                      {r.reporting}% in
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Race manager */}
      <div style={{ flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 24, padding: 24 }}>
        {/* Main column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Race header */}
          <div className="card card-pad">
            <div className="row between" style={{ alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <Eyebrow>{race.account} · Race Manager</Eyebrow>
                <h2 style={{ fontFamily: "var(--fs-font-display)", fontSize: 28, fontWeight: 700, color: "var(--fs-navy)", margin: "10px 0 4px", letterSpacing: "-0.01em" }}>{race.name}</h2>
                <div className="mut" style={{ fontSize: 13 }}>
                  {race.future
                    ? "Race not yet open. Live data begins at poll close, 8:00 PM ET."
                    : `Last update ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} ET · ${race.reporting}% of precincts reporting`}
                </div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn secondary"><Icon name="download" size={13} /> Export</button>
                <button className="btn secondary"><Icon name="tv" size={13} /> War room view</button>
                {role === "admin" && <button className="btn primary"><Icon name="flag" size={13} /> Mark called</button>}
              </div>
            </div>

            {/* Candidate bars */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {race.candidates.map((c, i) => {
                const winning = i === 0 && !race.future;
                return (
                  <div key={c.name}>
                    <div className="row between" style={{ marginBottom: 6 }}>
                      <div className="row" style={{ gap: 10 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: c.color }} />
                        <span style={{ fontFamily: "var(--fs-font-display)", fontSize: 17, fontWeight: 700, color: "var(--fs-navy)" }}>
                          {c.name}
                        </span>
                        <Tag tone={c.party === "D" ? "navy" : c.party === "R" ? "danger" : "outline"}>{c.party}</Tag>
                        {winning && !race.called && <Tag tone="gold">Leading</Tag>}
                        {winning && race.called && <Tag tone="success" dot>Projected winner</Tag>}
                      </div>
                      <div className="row" style={{ gap: 18, fontVariantNumeric: "tabular-nums" }}>
                        <span className="mut" style={{ fontSize: 12 }}>{c.votes.toLocaleString()}</span>
                        <span style={{ fontFamily: "var(--fs-font-display)", fontSize: 22, fontWeight: 700, color: "var(--fs-navy)", minWidth: 64, textAlign: "right" }}>
                          {c.pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div style={{ height: 10, background: "var(--fs-bone-100)", borderRadius: 2, overflow: "hidden", position: "relative" }}>
                      <div style={{ width: `${c.pct}%`, height: "100%", background: c.color, transition: "width 600ms var(--fs-ease-standard)" }} />
                      {/* Final polling marker */}
                      <div title="Final polling avg" style={{
                        position: "absolute", left: `${c.poll}%`, top: -3, bottom: -3,
                        width: 0, borderRight: "2px dashed rgba(239,197,63,0.9)",
                      }} />
                    </div>
                    <div className="row" style={{ marginTop: 4, fontSize: 11, color: "var(--fs-fg-muted)", gap: 16 }}>
                      <span>Final polling avg: <strong style={{ color: "var(--fs-gold-700)" }}>{c.poll.toFixed(1)}%</strong></span>
                      {!race.future && <span>Δ vs poll: <strong style={{ color: c.pct >= c.poll ? "var(--fs-success)" : "var(--fs-danger)" }}>
                        {c.pct >= c.poll ? "+" : ""}{(c.pct - c.poll).toFixed(1)} pts
                      </strong></span>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="divider" />

            {/* Vote math */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
              <Stat figure={(totalVotes/1000).toFixed(0) + "k"} label="Votes counted" />
              <Stat figure={Math.round(outstanding/1000) + "k"} label="Est. outstanding" />
              <Stat figure={(race.margin).toFixed(1) + " pts"} label="Current margin" gold={race.priority} />
              <Stat figure="2026 Tracker" label="Vote model" />
            </div>
            <div className="mut" style={{ fontSize: 12, marginTop: 14, lineHeight: 1.55 }}>
              <strong style={{ color: "var(--fs-navy)" }}>Vote math:</strong> Reyes would need <strong style={{ color: "var(--fs-navy)" }}>59.2%</strong> of remaining ballots to overtake — Aoki has averaged <strong style={{ color: "var(--fs-navy)" }}>50.4%</strong> in last-90-minute reports. Path is narrow but live.
            </div>
          </div>

          {/* Comparison: precincts */}
          {precincts && (
            <div className="card">
              <div className="card-head">
                <h3>Precinct Comparison · {race.short}</h3>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn ghost sm"><Icon name="map" size={12} /> Map</button>
                  <button className="btn ghost sm"><Icon name="filter" size={12} /> Key precincts only</button>
                  <button className="btn ghost sm"><Icon name="download" size={12} /> CSV</button>
                </div>
              </div>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Precinct</th>
                    <th>Reporting</th>
                    <th>Leader</th>
                    <th style={{ textAlign: "right" }}>Margin now</th>
                    <th style={{ textAlign: "right" }}>vs 2022 D primary</th>
                    <th style={{ textAlign: "right" }}>vs Poll model</th>
                    <th style={{ textAlign: "right" }}>Est. votes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {precincts.map(p => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--fs-navy)" }}>{p.name}</div>
                        <div className="mut" style={{ fontSize: 11, marginTop: 2 }}>{p.id}</div>
                      </td>
                      <td>
                        <div style={{ width: 80 }}>
                          <div style={{ height: 4, background: "var(--fs-bone-100)", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ width: p.reporting + "%", height: "100%", background: p.reporting === 100 ? "var(--fs-success)" : "var(--fs-navy)" }} />
                          </div>
                          <div className="num mut" style={{ fontSize: 11, marginTop: 3 }}>{p.reporting}%</div>
                        </div>
                      </td>
                      <td>
                        <Tag tone={p.leader === "AOKI" ? "navy" : "danger"}>{p.leader}</Tag>
                      </td>
                      <td className="num" style={{ textAlign: "right", fontWeight: 600, color: p.margin >= 0 ? "var(--fs-success)" : "var(--fs-danger)" }}>
                        {p.margin > 0 ? "+" : ""}{p.margin.toFixed(1)}
                      </td>
                      <td className="num" style={{ textAlign: "right", color: "var(--fs-fg-muted)" }}>
                        {p.prev > 0 ? "+" : ""}{p.prev.toFixed(1)}
                      </td>
                      <td className="num" style={{ textAlign: "right", color: "var(--fs-fg-muted)" }}>
                        {p.poll > 0 ? "+" : ""}{p.poll}
                      </td>
                      <td className="num" style={{ textAlign: "right", color: "var(--fs-fg-muted)" }}>{p.ev.toLocaleString()}</td>
                      <td>
                        {p.weight === "key" && <Tag tone="gold">Key</Tag>}
                        {p.weight === "concern" && <Tag tone="danger">Watch</Tag>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Side rail */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Polling vs reality */}
          <div className="card card-pad">
            <Eyebrow>Polling vs Reality</Eyebrow>
            <h4 style={{ fontFamily: "var(--fs-font-display)", fontSize: 17, fontWeight: 700, color: "var(--fs-navy)", margin: "10px 0 14px" }}>
              Aoki running <span style={{ color: "var(--fs-gold-700)" }}>+1.4 pts</span> vs the final poll average.
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { lbl: "MoE on final poll", v: "±3.4%" },
                { lbl: "Margin now", v: race.margin.toFixed(1) + " pts" },
                { lbl: "Polling-implied margin", v: "+5.2 pts" },
                { lbl: "Z-score vs poll", v: "+0.41" },
              ].map(s => (
                <div key={s.lbl} className="row between" style={{ fontSize: 13 }}>
                  <span className="mut">{s.lbl}</span>
                  <span className="num" style={{ fontWeight: 600, color: "var(--fs-navy)" }}>{s.v}</span>
                </div>
              ))}
            </div>
            <div className="divider" />
            <div className="mut" style={{ fontSize: 12, lineHeight: 1.55 }}>
              Result is inside the margin of error. Watch Hamilton & Summit for late-report movement; both broke heavier for Reyes than the IVR model implied.
            </div>
          </div>

          {/* Compare history */}
          <div className="card card-pad">
            <Eyebrow>Historical Comparison</Eyebrow>
            <h4 style={{ fontFamily: "var(--fs-font-display)", fontSize: 17, fontWeight: 700, color: "var(--fs-navy)", margin: "10px 0 14px" }}>
              Turnout 8% above 2022 D primary
            </h4>
            <table className="tbl" style={{ fontSize: 12 }}>
              <thead><tr><th>Cycle</th><th>D primary turnout</th><th>Winner</th></tr></thead>
              <tbody>
                <tr><td className="mut">2018</td><td className="num">582k</td><td className="mut">Carmichael</td></tr>
                <tr><td className="mut">2020</td><td className="num">719k</td><td className="mut">Carmichael</td></tr>
                <tr><td className="mut">2022</td><td className="num">643k</td><td className="mut">Patel</td></tr>
                <tr><td style={{ color: "var(--fs-navy)", fontWeight: 600 }}>2026 (proj)</td><td className="num" style={{ fontWeight: 600 }}>~860k</td><td>—</td></tr>
              </tbody>
            </table>
          </div>

          {/* War room channel */}
          <div className="card card-pad" style={{ background: "var(--ks-ink-surface)", color: "var(--ks-on-ink)" }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--fs-gold)", fontWeight: 600, marginBottom: 10 }}>War Room · OH-SEN</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
              {[
                { who: "M. Voss", at: "8:34", text: "Holding Cuyahoga firm. Big drop incoming from Garfield Hts." },
                { who: "E. Park", at: "8:31", text: "Summit looks soft. We need 56% of remaining Akron West to hit the model." },
                { who: "J. Reiter", at: "8:24", text: "Print queues for victory speech ready — both versions." },
              ].map((m, i) => (
                <div key={i}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 2 }}>{m.who} · {m.at} PM</div>
                  <div style={{ color: "var(--ks-on-ink)" }}>{m.text}</div>
                </div>
              ))}
            </div>
            <input className="input" placeholder="Type in war-room…" style={{
              marginTop: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--ks-on-ink)",
            }} />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        .pulse-dot { animation: pulse-dot 1.6s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

window.ElectionView = ElectionView;
