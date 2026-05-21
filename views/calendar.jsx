/* global React */
const { useState: useStateCal, useMemo: useMemoCal } = React;

function CalendarView({ user, role, client, clientId }) {
  const today = new Date();
  const [cursor, setCursor] = useStateCal(new Date(today.getFullYear(), today.getMonth(), 1));

  const cat = {
    election:  { label: "Election",   c: "var(--fs-danger)" },
    design:    { label: "Design",     c: "var(--fs-gold-700)" },
    meeting:   { label: "Meeting",    c: "var(--fs-navy)" },
    deadline:  { label: "Deadline",   c: "var(--fs-success)" },
    client:    { label: "Client call",c: "#7A5AE0" },
    field:     { label: "Field",      c: "#2F6B4F" },
  };

  // ----- Sample event corpus across May–June -----
  const allEvents = [
    { d: "2026-05-21", t: "OH primaries — Election Night", cat: "election", time: "6:00 PM ET", client: "aoki",    who: "All staff",      priority: true },
    { d: "2026-05-21", t: "Aoki TV proof v3 review",        cat: "design",   time: "3:00 PM",    client: "aoki",    who: "M. Voss, D. Cole" },
    { d: "2026-05-21", t: "Aoki strategy call",             cat: "client",   time: "11:00 AM",   client: "aoki",    who: "Sen. Aoki, M. Voss" },
    { d: "2026-05-22", t: "Coastal Renewal one-pager due",  cat: "deadline", time: "EOD",        client: "coastal", who: "P. Shah" },
    { d: "2026-05-23", t: "Coastal coalition launch",       cat: "client",   time: "9:00 AM",    client: "coastal", who: "M. Voss" },
    { d: "2026-05-26", t: "Memorial Day — office closed",   cat: "deadline", time: "All day",    client: "all",     who: "—" },
    { d: "2026-05-27", t: "NJ-3 special election",          cat: "election", time: "Polls 6a–8p",client: "harden",  who: "All staff",      priority: true },
    { d: "2026-05-28", t: "Harden TV second flight",        cat: "design",   time: "Air begins", client: "harden",  who: "D. Cole" },
    { d: "2026-05-29", t: "Polling fielding window opens",  cat: "field",    time: "9:00 AM",    client: "aoki",    who: "E. Park" },
    { d: "2026-06-01", t: "Annual compliance training",     cat: "deadline", time: "EOD",        client: "all",     who: "All staff" },
    { d: "2026-06-02", t: "Q2 conflicts disclosure due",    cat: "deadline", time: "EOD",        client: "all",     who: "All staff" },
    { d: "2026-06-03", t: "TX-15 primary runoff",           cat: "election", time: "Polls 7a–7p",client: "all",     who: "Watching only" },
    { d: "2026-06-04", t: "Okafor strategy retreat",        cat: "client",   time: "All day",    client: "okafor",  who: "M. Voss, J. Reiter" },
    { d: "2026-06-08", t: "Hughes-for-Gov ad concept review", cat: "design", time: "2:00 PM",    client: "hughes",  who: "D. Cole" },
    { d: "2026-06-10", t: "Aoki — June bill push memo due",  cat: "deadline", time: "EOD",       client: "aoki",    who: "M. Voss" },
    { d: "2026-06-12", t: "All-hands · monthly",             cat: "meeting", time: "9:30 AM",    client: "all",     who: "Everyone" },
    { d: "2026-06-15", t: "Coastal Renewal field training",  cat: "field",   time: "All day",    client: "coastal", who: "Field team" },
    { d: "2026-06-17", t: "OK SD-12 special election",       cat: "election", time: "Polls",     client: "state",   who: "Watching only" },
    { d: "2026-06-18", t: "Patel for OH-12 launch kit due",  cat: "deadline", time: "EOD",       client: "patel",   who: "D. Cole" },
    { d: "2026-06-22", t: "Senior counsel offsite",          cat: "meeting", time: "All day",    client: "all",     who: "Voss, Reiter, Park" },
  ];

  // Filter events by client + role
  const events = allEvents.filter(e => {
    if (clientId !== "all" && e.client !== "all" && e.client !== clientId) return false;
    if (role === "client") {
      // client only sees: own client events that are meetings/deadlines/design/client cat (not internal field/election)
      if (e.client !== "aoki" && e.client !== "all") return false;
      if (["field"].includes(e.cat)) return false;
      if (e.t.includes("compliance") || e.t.includes("conflicts")) return false;
    }
    return true;
  });

  // ----- Build month grid -----
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const firstDay = new Date(year, month, 1).getDay();          // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();

  // 42 cells (6 weeks)
  const cells = [];
  for (let i = 0; i < 42; i++) {
    let dayNum, m = month, y = year, otherMonth = false;
    if (i < firstDay) {
      dayNum = prevDays - (firstDay - 1 - i);
      m = month - 1; if (m < 0) { m = 11; y -= 1; }
      otherMonth = true;
    } else if (i >= firstDay + daysInMonth) {
      dayNum = i - firstDay - daysInMonth + 1;
      m = month + 1; if (m > 11) { m = 0; y += 1; }
      otherMonth = true;
    } else {
      dayNum = i - firstDay + 1;
    }
    const iso = `${y}-${String(m+1).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`;
    const dayEvents = events.filter(e => e.d === iso);
    const isToday = iso === "2026-05-21"; // demo-fixed today
    cells.push({ dayNum, iso, otherMonth, events: dayEvents, isToday });
  }

  // ----- Sidebar agenda (next 7 days from "today") -----
  const upcoming = events
    .filter(e => e.d >= "2026-05-21")
    .sort((a,b) => a.d.localeCompare(b.d))
    .slice(0, 10);

  return (
    <div>
      <PageHead
        eyebrow={role === "client" ? "Your Calendar" : (clientId === "all" ? "All Accounts · Calendar" : (client?.name + " · Calendar"))}
        title={monthLabel}
        sub={role === "client"
          ? "Calls, deadlines, and election days relevant to your campaign."
          : "Race calendar, deadlines, client calls, and proofs across every retained account. Filter by client using the picker above."}
        actions={
          <>
            <button className="btn ghost" onClick={() => setCursor(new Date(year, month-1, 1))}><Icon name="chevron-left" size={14} /></button>
            <button className="btn secondary" onClick={() => setCursor(new Date(2026, 4, 1))}>Today</button>
            <button className="btn ghost" onClick={() => setCursor(new Date(year, month+1, 1))}><Icon name="chevron-right" size={14} /></button>
            {role !== "client" && <button className="btn primary"><Icon name="plus" size={14} /> Add event</button>}
          </>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 24, alignItems: "flex-start" }}>
        {/* Month grid */}
        <div className="card">
          <div className="card-head" style={{ padding: "10px 14px" }}>
            <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
              {Object.entries(cat).map(([k, v]) => (
                <span key={k} className="row" style={{ gap: 6, fontSize: 11, color: "var(--fs-fg-muted)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: v.c }} />
                  {v.label}
                </span>
              ))}
            </div>
            <div className="mut" style={{ fontSize: 12 }}>{events.length} events this view</div>
          </div>

          {/* Weekday headings */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderTop: "1px solid var(--fs-border)", borderBottom: "1px solid var(--fs-border)", background: "var(--fs-bone-50)" }}>
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
              <div key={d} style={{ padding: "8px 12px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 600, color: "var(--fs-fg-muted)" }}>{d}</div>
            ))}
          </div>

          {/* Cells */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gridAutoRows: "112px" }}>
            {cells.map((c, i) => (
              <div key={i} style={{
                borderRight: ((i % 7) !== 6) ? "1px solid var(--fs-border)" : "none",
                borderBottom: "1px solid var(--fs-border)",
                padding: "6px 8px",
                background: c.otherMonth ? "var(--fs-bone-50)" : (c.isToday ? "rgba(239,197,63,0.06)" : "var(--fs-paper)"),
                opacity: c.otherMonth ? 0.55 : 1,
                position: "relative",
                overflow: "hidden",
              }}>
                <div className="row between" style={{ marginBottom: 4 }}>
                  <span style={{
                    fontSize: 12,
                    fontWeight: c.isToday ? 700 : 500,
                    color: c.isToday ? "var(--ks-on-ink)" : (c.otherMonth ? "var(--fs-fg-subtle)" : "var(--fs-navy)"),
                    background: c.isToday ? "var(--fs-gold)" : "transparent",
                    width: 22, height: 22, borderRadius: "50%",
                    display: "grid", placeItems: "center",
                    fontVariantNumeric: "tabular-nums",
                  }}>{c.dayNum}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {c.events.slice(0, 3).map((e, j) => (
                    <div key={j} style={{
                      fontSize: 11,
                      padding: "2px 6px",
                      borderLeft: "2px solid " + cat[e.cat].c,
                      background: e.priority ? "rgba(239,197,63,0.12)" : "var(--fs-bone-50)",
                      color: "var(--fs-ink)",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      borderRadius: 2,
                    }} title={e.t + " · " + e.time}>
                      <span style={{ fontWeight: 600 }}>{e.time.split(" ")[0]}</span> <span style={{ color: "var(--fs-fg-muted)" }}>{e.t}</span>
                    </div>
                  ))}
                  {c.events.length > 3 && (
                    <div className="mut" style={{ fontSize: 11, fontWeight: 600, paddingLeft: 6 }}>+{c.events.length - 3} more</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Agenda rail */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="card-head"><h3>Up Next</h3></div>
            <div>
              {upcoming.map((e, i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "12px 16px", borderBottom: i < upcoming.length - 1 ? "1px solid var(--fs-border)" : "none" }}>
                  <div style={{ flexShrink: 0, width: 44, textAlign: "center" }}>
                    <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fs-fg-subtle)", fontWeight: 600 }}>
                      {new Date(e.d + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}
                    </div>
                    <div style={{ fontFamily: "var(--fs-font-display)", fontSize: 18, fontWeight: 700, color: cat[e.cat].c }}>
                      {e.d.split("-")[2]}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row" style={{ gap: 6, marginBottom: 3 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cat[e.cat].c }} />
                      <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fs-fg-muted)", fontWeight: 600 }}>{cat[e.cat].label} · {e.time}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)", lineHeight: 1.3 }}>{e.t}</div>
                    <div className="mut" style={{ fontSize: 11, marginTop: 2 }}>{e.who}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card card-pad" style={{ background: "var(--fs-bone)" }}>
            <Eyebrow>Subscribe</Eyebrow>
            <p style={{ fontSize: 13, color: "var(--fs-ink)", margin: "10px 0", lineHeight: 1.5 }}>
              Sync this calendar to your phone or desktop client.
            </p>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn secondary sm" style={{ flex: 1 }}><Icon name="calendar" size={12} /> Google</button>
              <button className="btn secondary sm" style={{ flex: 1 }}><Icon name="calendar" size={12} /> iCal</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.CalendarView = CalendarView;
