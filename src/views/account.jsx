import React, { useEffect, useMemo, useState } from "react";
import { PageHead, Icon, Avatar, Eyebrow } from "../components/ui.jsx";
import { accountApi } from "../lib/api.js";

function firstOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function MiniMonth({ events = [], cursor, onShift }) {
  const today = new Date();
  const first = firstOfMonth(cursor);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const prevDays = new Date(cursor.getFullYear(), cursor.getMonth(), 0).getDate();

  const eventDates = useMemo(() => {
    const s = new Set();
    for (const e of events) {
      if (!e?.startsAt) continue;
      const d = new Date(e.startsAt);
      if (d.getMonth() === cursor.getMonth() && d.getFullYear() === cursor.getFullYear()) {
        s.add(d.getDate());
      }
    }
    return s;
  }, [events, cursor]);

  const cells = [];
  for (let i = 0; i < startWeekday; i++) {
    cells.push({ day: prevDays - startWeekday + 1 + i, muted: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      muted: false,
      today: sameDay(new Date(cursor.getFullYear(), cursor.getMonth(), d), today),
      hasEvent: eventDates.has(d),
    });
  }
  while (cells.length % 7 !== 0) cells.push({ day: cells.length - (startWeekday + daysInMonth) + 1, muted: true });

  return (
    <div>
      <div className="row between" style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)" }}>
          {cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </div>
        <div className="row" style={{ gap: 4 }}>
          <button type="button" className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => onShift(-1)} aria-label="Previous month">
            <Icon name="chevron-left" size={13} />
          </button>
          <button type="button" className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => onShift(1)} aria-label="Next month">
            <Icon name="chevron-right" size={13} />
          </button>
        </div>
      </div>
      <div className="cal-mini">
        {["S","M","T","W","T","F","S"].map((d, i) => (
          <div key={i} className="cal-mini-dow">{d}</div>
        ))}
        {cells.map((c, i) => (
          <div key={i}
            className={"cal-mini-cell"
              + (c.muted ? " muted" : "")
              + (c.today ? " today" : "")
              + (c.hasEvent ? " has-event" : "")}
            title={c.hasEvent ? `${eventDates.size ? "Events scheduled" : ""}` : ""}>
            {c.day}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AccountView({ user: parentUser, onUserUpdate }) {
  const [user, setUser] = useState(parentUser);
  const [clients, setClients] = useState([]);
  const [events, setEvents] = useState([]);
  const [cursor, setCursor] = useState(() => firstOfMonth(new Date()));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    accountApi.me().then((r) => {
      setUser(r.user);
      setClients(r.clients || []);
    });
  }, []);

  useEffect(() => {
    const start = firstOfMonth(cursor).toISOString();
    accountApi.calendar(start, 42).then((r) => setEvents(r?.events || [])).catch(() => setEvents([]));
  }, [cursor]);

  const upcoming = useMemo(() => {
    const now = new Date();
    return [...events]
      .filter((e) => new Date(e.startsAt) >= now)
      .slice(0, 5);
  }, [events]);

  const startEdit = () => {
    setDraft({
      name: user.name || "",
      title: user.title || "",
      team: user.team || "",
      location: user.location || "",
      phone: user.phone || "",
      about: user.about || "",
      photo: user.photo || "",
    });
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setDraft(null); };

  const save = async () => {
    setSaving(true);
    try {
      const { user: u } = await accountApi.update(draft);
      setUser(u);
      onUserUpdate?.(u);
      setEditing(false);
      setMsg("Saved");
      setTimeout(() => setMsg(""), 2200);
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  const roleLabel = {
    staff: "Staff",
    admin: user.systemAdmin ? "System Admin" : "Admin",
    client: "Client",
  }[user.role];

  return (
    <div>
      <PageHead
        eyebrow="Account"
        title="Account Settings"
        sub="Your profile, work location, calendar, and client access."
        actions={
          !editing ? (
            <button type="button" className="btn primary" onClick={startEdit}>
              <Icon name="pen" size={13} /> Edit profile
            </button>
          ) : (
            <>
              <button type="button" className="btn secondary" onClick={cancelEdit} disabled={saving}>Cancel</button>
              <button type="button" className="btn primary" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </>
          )
        }
      />

      {msg && <div className="card card-pad" style={{ marginBottom: 16, fontSize: 13, color: "var(--fs-navy)" }}>{msg}</div>}

      <div className="acct-grid">
        <div className="col" style={{ gap: 20 }}>
          <div className="card card-pad" style={{ textAlign: "center" }}>
            <div style={{ display: "grid", placeItems: "center", marginBottom: 12 }}>
              {user.photo
                ? <img src={user.photo} alt="" className="acct-photo" />
                : <div style={{ borderRadius: "50%", overflow: "hidden" }}><Avatar name={user.name} size={88} /></div>}
            </div>
            {editing ? (
              <input className="input" placeholder="Photo URL"
                value={draft.photo}
                onChange={(e) => setDraft({ ...draft, photo: e.target.value })}
                style={{ marginBottom: 10 }} />
            ) : null}
            <div style={{ fontFamily: "var(--fs-font-display)", fontSize: 20, fontWeight: 700, color: "var(--fs-navy)" }}>
              {user.name}
            </div>
            <div className="mut" style={{ fontSize: 13, marginTop: 4 }}>{user.title || roleLabel}</div>
            <div style={{ marginTop: 12, display: "inline-flex", padding: "3px 10px", background: "var(--fs-bone-50)", borderRadius: 999, fontSize: 11, fontWeight: 600, color: "var(--fs-navy)", textTransform: "uppercase", letterSpacing: "var(--fs-tracking-caps)" }}>
              {roleLabel}
            </div>
          </div>

          <div className="card card-pad">
            <Eyebrow>Calendar</Eyebrow>
            <div style={{ marginTop: 12 }}>
              <MiniMonth events={events} cursor={cursor} onShift={(n) => setCursor(addMonths(cursor, n))} />
            </div>
            <div className="user-pop-sep" style={{ margin: "14px 0" }} />
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fs-fg-subtle)", textTransform: "uppercase", letterSpacing: "var(--fs-tracking-caps)", marginBottom: 8 }}>
              Upcoming
            </div>
            {upcoming.length === 0 ? (
              <div className="mut" style={{ fontSize: 12 }}>Nothing scheduled.</div>
            ) : (
              <div className="col" style={{ gap: 8 }}>
                {upcoming.map((e) => (
                  <div key={e.id} className="row" style={{ gap: 10, alignItems: "flex-start" }}>
                    <div style={{
                      flexShrink: 0, width: 38, textAlign: "center",
                      padding: "4px 0", border: "1px solid var(--fs-border)", borderRadius: 4,
                      background: "var(--fs-bone-50)",
                    }}>
                      <div style={{ fontSize: 9, textTransform: "uppercase", color: "var(--fs-fg-subtle)", fontWeight: 600, letterSpacing: "var(--fs-tracking-caps)" }}>
                        {new Date(e.startsAt).toLocaleDateString("en-US", { month: "short" })}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--fs-navy)", lineHeight: 1 }}>
                        {new Date(e.startsAt).getDate()}
                      </div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {e.title}
                      </div>
                      <div className="mut" style={{ fontSize: 11 }}>
                        {new Date(e.startsAt).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}
                        {e.location ? " · " + e.location : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="col" style={{ gap: 20 }}>
          <div className="card card-pad">
            <Eyebrow>Profile</Eyebrow>
            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Full name" editing={editing}
                value={editing ? draft.name : user.name}
                onChange={(v) => setDraft({ ...draft, name: v })} />
              <Field label="Title" editing={editing}
                value={editing ? draft.title : (user.title || "—")}
                onChange={(v) => setDraft({ ...draft, title: v })} />
              <Field label="Team" editing={editing}
                value={editing ? draft.team : (user.team || "—")}
                onChange={(v) => setDraft({ ...draft, team: v })} />
              <Field label="Work location" editing={editing}
                value={editing ? draft.location : (user.location || "—")}
                onChange={(v) => setDraft({ ...draft, location: v })}
                placeholder="e.g. Boston, MA" />
              <Field label="Email" value={user.email} readOnly />
              <Field label="Phone" editing={editing}
                value={editing ? draft.phone : (user.phone || "—")}
                onChange={(v) => setDraft({ ...draft, phone: v })} />
            </div>
            <div style={{ marginTop: 18 }}>
              <div className="lbl" style={{ marginBottom: 6 }}>About</div>
              {editing ? (
                <textarea className="input" rows={4}
                  placeholder="A short bio for teammates."
                  value={draft.about}
                  onChange={(e) => setDraft({ ...draft, about: e.target.value })} />
              ) : (
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--fs-fg)" }}>
                  {user.about || <span className="mut">No bio added yet.</span>}
                </p>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Clients</h3>
              <span className="mut" style={{ fontSize: 11 }}>{clients.length} {clients.length === 1 ? "account" : "accounts"}</span>
            </div>
            {clients.length === 0 ? (
              <div className="card-pad mut" style={{ fontSize: 13 }}>No client access.</div>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {clients.map((c) => (
                  <li key={c.id} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 20px",
                    borderBottom: "1px solid var(--fs-border)",
                  }}>
                    <span style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: c.color || "var(--fs-navy)", color: "var(--ks-on-ink)",
                      display: "grid", placeItems: "center",
                      fontSize: 11, fontWeight: 700,
                    }}>{c.initials}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)" }}>{c.name}</div>
                      {c.type && <div className="mut" style={{ fontSize: 11 }}>{c.type}</div>}
                    </div>
                    <span className="tag">{c.tag}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, editing, readOnly, placeholder }) {
  return (
    <div>
      <div className="lbl" style={{ marginBottom: 6 }}>{label}</div>
      {editing && !readOnly ? (
        <input className="input" value={value || ""} placeholder={placeholder}
          onChange={(e) => onChange?.(e.target.value)} />
      ) : (
        <div style={{ fontSize: 13, color: "var(--fs-fg)" }}>{value || <span className="mut">—</span>}</div>
      )}
    </div>
  );
}
