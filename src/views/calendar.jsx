import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ModuleModal, ModuleForm, initialForm, buildBody, formatDate, formatDateTime,
} from "./ModuleList.jsx";
import { calendarApi, calendarFeedsApi, proposalsMetaApi, withClient, ApiError } from "../lib/api.js";
import { useApi } from "../lib/useApi.js";
import { realClients } from "../lib/clients.js";
import { Icon } from "../components/ui.jsx";
import { Loading } from "../components/Loading.jsx";

const FIELDS = [
  { name: "title", label: "Title", required: true },
  { name: "startsAt", label: "Starts", type: "datetime", required: true },
  { name: "endsAt", label: "Ends", type: "datetime" },
  { name: "kind", label: "Kind", type: "select", defaultValue: "meeting", options: [
    { value: "meeting", label: "Meeting" },
    { value: "deadline", label: "Deadline" },
    { value: "event", label: "Event" },
    { value: "call", label: "Call" },
  ] },
  { name: "location", label: "Location" },
  { name: "clientId", label: "Client", type: "client" },
];

const KEEL_SOURCE = "keel";
const KEEL_COLOR = "#1a3a5c";
const PROPOSALS_SOURCE = "proposals";
const PROPOSALS_COLOR = "#E4181E";
const FEED_COLORS = ["#2f6fb2", "#c05b2e", "#3d8a5f", "#7d5ba6", "#b3822f", "#b23a48", "#3a7ca5", "#5f6b7a"];
const TOGGLES_KEY = "calendarSources";
const VIEW_KEY = "calendarView";
const HOUR_PX = 52;
const HOURS = 24;
const MONTH_EVENT_CAP = 3;
const VIEWS = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
];

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PROPOSAL_TAG_LABELS = {
  draft: "Draft",
  submitted: "Submitted",
  won: "Won",
  lost: "Lost",
  archived: "Archived",
};

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const raw = String(dateStr);
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const due = m ? new Date(+m[1], +m[2] - 1, +m[3], 17, 0, 0) : new Date(raw);
  if (Number.isNaN(due.getTime())) return null;
  return Math.ceil((due - today) / 86400000);
}

function proposalToEvent(m) {
  if (!m?.deadline) return null;
  const date = String(m.deadline).match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  if (!date) return null;
  return {
    id: `prop:${m.id}`,
    title: m.title || "Untitled proposal",
    startsAt: date,
    allDay: true,
    kind: "deadline",
    _proposal: true,
    _proposalId: m.id,
    _proposalMeta: m,
  };
}

function loadToggles() {
  try { return JSON.parse(localStorage.getItem(TOGGLES_KEY) || "{}"); } catch { return {}; }
}

function loadView() {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return VIEWS.some((x) => x.id === v) ? v : "week";
  } catch { return "week"; }
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function addMonths(d, n) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

function startOfWeek(d) {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function isToday(d) {
  return sameDay(d, new Date());
}

function minutesOfDay(d) {
  return d.getHours() * 60 + d.getMinutes();
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse a wall-clock instant. Date-only strings stay floating local midnights (not UTC). */
function parseInstant(iso) {
  if (!iso) return null;
  const raw = String(iso);
  const d = new Date(DATE_ONLY_RE.test(raw) ? `${raw}T00:00:00` : raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * All-day events are calendar dates, not UTC instants. Prefer YYYY-MM-DD; for legacy
 * UTC-midnight ISO payloads, rebuild the day from UTC Y/M/D so west-of-UTC clients
 * don't slip to the previous local day (and double-render on two days).
 */
function parseAllDayInstant(iso) {
  if (!iso) return null;
  const raw = String(iso);
  if (DATE_ONLY_RE.test(raw)) return parseInstant(raw);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  return startOfDay(d);
}

function parseEventStart(e) {
  return e.allDay ? parseAllDayInstant(e.startsAt) : parseInstant(e.startsAt);
}

function parseEventEnd(e, start) {
  if (e.endsAt) {
    const d = e.allDay ? parseAllDayInstant(e.endsAt) : parseInstant(e.endsAt);
    if (d) return d;
  }
  if (!start) return null;
  if (e.allDay) return addDays(start, 1);
  const d = new Date(start);
  d.setHours(d.getHours() + 1);
  return d;
}

function isAllDayEvent(e, start, end) {
  if (e.allDay) return true;
  if (!start) return false;
  const midnightStart = start.getHours() === 0 && start.getMinutes() === 0;
  if (!midnightStart) return false;
  if (!end) return true;
  const dur = end - start;
  return dur >= 20 * 60 * 60 * 1000;
}

function eventColor(e, feedById) {
  if (e._proposal) return PROPOSALS_COLOR;
  if (e._external) return feedById[e.feedId]?.color || FEED_COLORS[0];
  return KEEL_COLOR;
}

function formatTime(d) {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: d.getMinutes() ? "2-digit" : undefined });
}

function formatHourLabel(h) {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

function rangeLabel(anchor, view) {
  if (view === "month") {
    return anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  if (view === "day") {
    return anchor.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }
  const start = startOfWeek(anchor);
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.toLocaleDateString("en-US", { month: "long" })} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`;
  }
  if (sameYear) {
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${end.getFullYear()}`;
  }
  return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

function monthCells(anchor) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

function weekDays(anchor) {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Greedy column packing for overlapping timed events (Google-style). */
function layoutDayEvents(dayEvents, day) {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  const items = dayEvents
    .map((e) => {
      const start = parseEventStart(e);
      const end = parseEventEnd(e, start);
      if (!start || !end) return null;
      const clippedStart = start < dayStart ? dayStart : start;
      const clippedEnd = end > dayEnd ? dayEnd : end;
      const startMin = minutesOfDay(clippedStart);
      const endMin = Math.max(
        clippedEnd >= dayEnd ? HOURS * 60 : minutesOfDay(clippedEnd),
        startMin + 15,
      );
      return { e, start, end, startMin, endMin };
    })
    .filter(Boolean)
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

  const colEnds = [];
  for (const item of items) {
    let col = colEnds.findIndex((t) => t <= item.startMin);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(item.endMin);
    } else {
      colEnds[col] = item.endMin;
    }
    item.col = col;
  }
  const cols = Math.max(1, colEnds.length);
  return items.map((item) => ({
    ...item,
    cols,
    top: (item.startMin / (HOURS * 60)) * 100,
    height: Math.max(((item.endMin - item.startMin) / (HOURS * 60)) * 100, (30 / (HOURS * 60)) * 100),
    left: (item.col / cols) * 100,
    width: (1 / cols) * 100,
  }));
}

function eventsOnDay(events, day) {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  return events.filter((e) => {
    const start = parseEventStart(e);
    if (!start) return false;
    const end = parseEventEnd(e, start) || start;
    return start < dayEnd && end > dayStart;
  }).sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
}

function SourceChip({ color, label, on, onToggle, isPrivate, children }) {
  return (
    <div className={"cal-chip" + (on ? " on" : "")}>
      <button type="button" className="cal-chip-main" role="switch" aria-checked={on} onClick={onToggle}>
        <span className="cal-dot" style={{ background: color }} />
        <span className="cal-chip-label">{label}</span>
        {isPrivate && <Icon name="lock" size={11} />}
        <span className="cal-switch" aria-hidden="true" />
      </button>
      {children}
    </div>
  );
}

function FeedForm({ feed, saving, error, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    name: feed?.name || "",
    url: "",
    visibility: feed?.visibility || "public",
    color: feed?.color || FEED_COLORS[0],
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const isPublic = form.visibility === "public";
  return (
    <form className="col" style={{ gap: 0 }} onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>
      <div className="field">
        <label>Name</label>
        <input className="input" required value={form.name} onChange={set("name")} placeholder="e.g. Firm events" />
      </div>
      <div className="field">
        <label>Calendar type</label>
        <div className="col" style={{ gap: 6 }}>
          <label className="cal-radio">
            <input type="radio" name="visibility" value="public" checked={isPublic} onChange={set("visibility")} />
            <span><strong>Public calendar</strong> — a calendar shared publicly (public iCal address or calendar ID)</span>
          </label>
          <label className="cal-radio">
            <input type="radio" name="visibility" value="private" checked={!isPublic} onChange={set("visibility")} />
            <span><strong>Private calendar</strong> — your own calendar via its secret iCal address</span>
          </label>
        </div>
      </div>
      <div className="field">
        <label>{isPublic ? "Public address or calendar ID" : "Secret iCal address"}</label>
        <input
          className="input"
          type="text"
          required={!feed}
          value={form.url}
          onChange={set("url")}
          placeholder={feed ? "Leave blank to keep the current address" : isPublic
            ? "https://calendar.google.com/calendar/ical/…/public/basic.ics"
            : "https://calendar.google.com/calendar/ical/…/private-…/basic.ics"}
        />
        <div className="help">
          {isPublic
            ? <>Google Calendar → Settings → your calendar → <em>Integrate calendar</em> → “Public address in iCal format”. Pasting the Calendar ID or an embed link also works. The calendar must be made public in its sharing settings.</>
            : <>Google Calendar → Settings → your calendar → <em>Integrate calendar</em> → “Secret address in iCal format”. The secret link is stored on the Keel server and never shown again. Events will be visible to staff — private feeds are hidden from client logins.</>}
        </div>
      </div>
      <div className="field">
        <label>Color</label>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {FEED_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={"cal-swatch" + (form.color === c ? " selected" : "")}
              style={{ background: c }}
              aria-label={"Color " + c}
              aria-pressed={form.color === c}
              onClick={() => setForm({ ...form, color: c })}
            />
          ))}
        </div>
      </div>
      {error && <div style={{ fontSize: 13, color: "var(--fs-danger)", marginBottom: 12 }}>{error}</div>}
      <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn primary" disabled={saving}>
          {saving ? "Checking feed…" : feed ? "Save changes" : "Attach calendar"}
        </button>
      </div>
    </form>
  );
}

function EventBlock({ event, color, compact, style, onClick }) {
  const start = parseEventStart(event);
  const end = parseEventEnd(event, start);
  const allDay = isAllDayEvent(event, start, end);
  const timeLabel = !allDay && start ? formatTime(start) : null;
  return (
    <button
      type="button"
      className={"cal-event" + (compact ? " compact" : "")}
      style={{ ...style, "--cal-event-color": color }}
      onClick={(e) => { e.stopPropagation(); onClick(event); }}
      title={event.title}
    >
      <span className="cal-event-title">{event.title || "Untitled"}</span>
      {timeLabel && !compact && <span className="cal-event-time">{timeLabel}</span>}
    </button>
  );
}

function MonthView({ anchor, events, feedById, onSelectDay, onSelectEvent, onCreateDay }) {
  const cells = useMemo(() => monthCells(anchor), [anchor]);
  const month = anchor.getMonth();

  return (
    <div className="cal-month">
      <div className="cal-month-dow">
        {DOW.map((d) => <div key={d} className="cal-month-dow-cell">{d}</div>)}
      </div>
      <div className="cal-month-grid">
        {cells.map((day) => {
          const dayEvents = eventsOnDay(events, day);
          const visible = dayEvents.slice(0, MONTH_EVENT_CAP);
          const more = dayEvents.length - visible.length;
          const inMonth = day.getMonth() === month;
          return (
            <div
              key={day.toISOString()}
              className={
                "cal-month-cell"
                + (inMonth ? "" : " muted")
                + (isToday(day) ? " today" : "")
              }
              onClick={() => onCreateDay(day)}
              onDoubleClick={() => onSelectDay(day)}
            >
              <button
                type="button"
                className="cal-month-num"
                onClick={(e) => { e.stopPropagation(); onSelectDay(day); }}
              >
                {day.getDate()}
              </button>
              <div className="cal-month-events">
                {visible.map((ev) => (
                  <EventBlock
                    key={ev.id}
                    event={ev}
                    color={eventColor(ev, feedById)}
                    compact
                    onClick={onSelectEvent}
                  />
                ))}
                {more > 0 && (
                  <button
                    type="button"
                    className="cal-more"
                    onClick={(e) => { e.stopPropagation(); onSelectDay(day); }}
                  >
                    +{more} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimeGrid({ days, events, feedById, onSelectEvent, onCreateAt, canWrite }) {
  const scrollRef = useRef(null);
  const [nowTop, setNowTop] = useState(null);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = 7 * HOUR_PX - 8;
  }, [days[0]?.toDateString()]);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      if (!days.some((d) => sameDay(d, now))) {
        setNowTop(null);
        return;
      }
      setNowTop((minutesOfDay(now) / (HOURS * 60)) * 100);
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [days]);

  const onGridClick = (day, e) => {
    if (!canWrite) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutes = Math.round((y / rect.height) * HOURS * 60 / 15) * 15;
    const clamped = Math.max(0, Math.min(HOURS * 60 - 30, minutes));
    const start = startOfDay(day);
    start.setMinutes(clamped);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 60);
    onCreateAt(start, end);
  };

  return (
    <div className="cal-timegrid" style={{ "--cal-days": String(days.length) }}>
      <div className="cal-timegrid-head">
        <div className="cal-gutter-spacer" />
        {days.map((day) => (
          <div key={day.toISOString()} className={"cal-timegrid-dayhead" + (isToday(day) ? " today" : "")}>
            <span className="cal-timegrid-dow">{DOW[day.getDay()]}</span>
            <span className="cal-timegrid-date">{day.getDate()}</span>
          </div>
        ))}
      </div>

      <div className="cal-allday-row">
        <div className="cal-gutter-label">All day</div>
        {days.map((day) => {
          const allDay = eventsOnDay(events, day).filter((e) => {
            const s = parseEventStart(e);
            return isAllDayEvent(e, s, parseEventEnd(e, s));
          });
          return (
            <div key={day.toISOString()} className="cal-allday-cell">
              {allDay.map((ev) => (
                <EventBlock
                  key={ev.id}
                  event={ev}
                  color={eventColor(ev, feedById)}
                  compact
                  onClick={onSelectEvent}
                />
              ))}
            </div>
          );
        })}
      </div>

      <div className="cal-timegrid-scroll" ref={scrollRef}>
        <div className="cal-timegrid-body" style={{ height: HOURS * HOUR_PX }}>
          <div className="cal-hours">
            {Array.from({ length: HOURS }, (_, h) => (
              <div key={h} className="cal-hour" style={{ height: HOUR_PX }}>
                {h > 0 && <span>{formatHourLabel(h)}</span>}
              </div>
            ))}
          </div>
          <div className="cal-day-cols">
            {days.map((day) => {
              const timed = eventsOnDay(events, day).filter((e) => {
                const s = parseEventStart(e);
                return !isAllDayEvent(e, s, parseEventEnd(e, s));
              });
              const laid = layoutDayEvents(timed, day);
              const showNow = nowTop != null && isToday(day);
              return (
                <div
                  key={day.toISOString()}
                  className={"cal-day-col" + (isToday(day) ? " today" : "")}
                  onClick={(e) => onGridClick(day, e)}
                >
                  {Array.from({ length: HOURS }, (_, h) => (
                    <div key={h} className="cal-hour-line" style={{ top: h * HOUR_PX }} />
                  ))}
                  {showNow && (
                    <div className="cal-now" style={{ top: `${nowTop}%` }}>
                      <span className="cal-now-dot" />
                    </div>
                  )}
                  {laid.map((item) => (
                    <EventBlock
                      key={item.e.id}
                      event={item.e}
                      color={eventColor(item.e, feedById)}
                      onClick={onSelectEvent}
                      style={{
                        position: "absolute",
                        top: `${item.top}%`,
                        height: `${item.height}%`,
                        left: `calc(${item.left}% + 2px)`,
                        width: `calc(${item.width}% - 4px)`,
                      }}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CalendarView({ clientId, role, onOpenProposal }) {
  const canWrite = role !== "client";
  const canManage = role !== "client";
  const canOpenProposals = role !== "client";
  const path = withClient("/calendar/events", clientId);
  const eventsRes = useApi(path, [clientId]);
  const clientsRes = useApi("/clients", []);
  const clients = realClients(clientsRes.data?.clients);
  const feedsRes = useApi("/calendar/feeds", []);
  const feeds = feedsRes.data?.feeds || [];
  const feedsKey = feeds.map((f) => `${f.id}:${f.urlPreview}`).join("|");

  const [view, setView] = useState(loadView);
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [external, setExternal] = useState({ events: [], errors: [], loaded: false });
  const [proposals, setProposals] = useState({ list: [], loaded: false, error: null });
  // Workspace-wide admin switch; personal SourceChip toggle layers on top.
  const deadlinePrefRes = useApi("/calendar/proposal-deadlines", []);
  const deadlinesEnabled = deadlinePrefRes.data ? deadlinePrefRes.data.enabled !== false : true;
  const [toggles, setToggles] = useState(loadToggles);
  const [feedModal, setFeedModal] = useState(null);
  const [savingFeed, setSavingFeed] = useState(false);
  const [feedError, setFeedError] = useState("");
  const [eventModal, setEventModal] = useState(null);
  const [form, setForm] = useState({});
  const [savingEvent, setSavingEvent] = useState(false);
  const [eventError, setEventError] = useState("");
  const savingRef = useRef(false);

  useEffect(() => {
    try { localStorage.setItem(TOGGLES_KEY, JSON.stringify(toggles)); } catch { /* */ }
  }, [toggles]);

  useEffect(() => {
    try { localStorage.setItem(VIEW_KEY, view); } catch { /* */ }
  }, [view]);

  useEffect(() => {
    if (!feedsRes.data) return;
    if (!feeds.length) { setExternal({ events: [], errors: [], loaded: true }); return; }
    let alive = true;
    const start = addDays(startOfDay(new Date()), -45);
    calendarFeedsApi.events(start.toISOString(), 400)
      .then((d) => alive && setExternal({ events: d.events || [], errors: d.errors || [], loaded: true }))
      .catch(() => alive && setExternal({ events: [], errors: [{ message: "Could not load attached calendars" }], loaded: true }));
    return () => { alive = false; };
  }, [feedsKey, feedsRes.data]);

  useEffect(() => {
    if (!deadlinesEnabled) {
      setProposals({ list: [], loaded: true, error: null });
      return undefined;
    }
    let alive = true;
    proposalsMetaApi.list(clientId)
      .then((list) => alive && setProposals({ list: list || [], loaded: true, error: null }))
      .catch((err) => alive && setProposals({
        list: [],
        loaded: true,
        error: err instanceof ApiError ? err : new ApiError("Could not load proposal deadlines"),
      }));
    return () => { alive = false; };
  }, [clientId, deadlinesEnabled]);

  const isOn = (key) => toggles[key] !== false;
  const flip = (key) => setToggles((t) => ({ ...t, [key]: !(t[key] !== false) }));
  const feedById = useMemo(() => Object.fromEntries(feeds.map((f) => [f.id, f])), [feedsKey]);

  const events = useMemo(() => {
    const own = (eventsRes.data?.items || []).filter(() => isOn(KEEL_SOURCE));
    const ext = external.events
      .filter((e) => feedById[e.feedId] && isOn("feed:" + e.feedId))
      .map((e) => ({ ...e, _external: true }));
    const prop = deadlinesEnabled && isOn(PROPOSALS_SOURCE)
      ? proposals.list.map(proposalToEvent).filter(Boolean)
      : [];
    return [...own, ...ext, ...prop];
  }, [eventsRes.data, external.events, proposals.list, toggles, feedById, deadlinesEnabled]);

  const shift = (dir) => {
    if (view === "month") setAnchor((a) => addMonths(a, dir));
    else if (view === "week") setAnchor((a) => addDays(a, dir * 7));
    else setAnchor((a) => addDays(a, dir));
  };

  const goToday = () => setAnchor(startOfDay(new Date()));

  const openCreate = useCallback((start, end) => {
    if (!canWrite) return;
    let s = start;
    let e = end;
    if (!s) {
      s = new Date();
      s.setMinutes(0, 0, 0);
      s.setHours(s.getHours() + 1);
      e = new Date(s);
      e.setHours(e.getHours() + 1);
    } else if (!e) {
      e = new Date(s);
      e.setHours(e.getHours() + 1);
    }
    setForm(initialForm(FIELDS, { startsAt: s.toISOString(), endsAt: e.toISOString() }, clientId));
    setEventError("");
    setEventModal({ mode: "create" });
  }, [canWrite, clientId]);

  const openEdit = (item) => {
    if (item._proposal) {
      setEventError("");
      setEventModal({ mode: "proposal", item });
      return;
    }
    if (item._external) {
      setEventError("");
      setEventModal({ mode: "view", item });
      return;
    }
    if (!canWrite) return;
    setForm(initialForm(FIELDS, item, clientId));
    setEventError("");
    setEventModal({ mode: "edit", item });
  };

  const closeEventModal = () => {
    setEventModal(null);
    setEventError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSavingEvent(true);
    setEventError("");
    try {
      const body = buildBody(FIELDS, form);
      if (eventModal.mode === "edit") await calendarApi.update(eventModal.item.id, body);
      else await calendarApi.create(body);
      closeEventModal();
      eventsRes.reload();
    } catch (err) {
      setEventError(err instanceof ApiError ? err.message : "Could not save event");
    } finally {
      savingRef.current = false;
      setSavingEvent(false);
    }
  };

  const handleDelete = async () => {
    if (savingRef.current || eventModal?.mode !== "edit") return;
    savingRef.current = true;
    setSavingEvent(true);
    setEventError("");
    try {
      await calendarApi.remove(eventModal.item.id);
      closeEventModal();
      eventsRes.reload();
    } catch (err) {
      setEventError(err instanceof ApiError ? err.message : "Could not delete event");
    } finally {
      savingRef.current = false;
      setSavingEvent(false);
    }
  };

  const closeFeedModal = () => { setFeedModal(null); setFeedError(""); };

  const submitFeed = async (formData) => {
    if (savingFeed) return;
    setSavingFeed(true);
    setFeedError("");
    try {
      const body = { name: formData.name, visibility: formData.visibility, color: formData.color };
      if (formData.url.trim() || feedModal.mode === "create") body.url = formData.url.trim();
      if (feedModal.mode === "edit") await calendarFeedsApi.update(feedModal.feed.id, body);
      else await calendarFeedsApi.create(body);
      closeFeedModal();
      feedsRes.reload();
    } catch (err) {
      setFeedError(err instanceof ApiError ? err.message : "Could not save calendar");
    } finally {
      setSavingFeed(false);
    }
  };

  const deleteFeed = async () => {
    if (savingFeed) return;
    setSavingFeed(true);
    setFeedError("");
    try {
      await calendarFeedsApi.remove(feedModal.feed.id);
      closeFeedModal();
      feedsRes.reload();
    } catch (err) {
      setFeedError(err instanceof ApiError ? err.message : "Could not remove calendar");
    } finally {
      setSavingFeed(false);
    }
  };

  const selectDay = (day) => {
    setAnchor(startOfDay(day));
    setView("day");
  };

  const createOnDay = (day) => {
    if (!canWrite) return;
    const start = startOfDay(day);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start);
    end.setHours(10, 0, 0, 0);
    openCreate(start, end);
  };

  const loading = eventsRes.loading && !eventsRes.data;

  return (
    <div className="cal-app">
      <header className="cal-toolbar">
        <div className="cal-toolbar-left">
          <button type="button" className="btn secondary sm" onClick={goToday}>Today</button>
          <div className="cal-nav">
            <button type="button" className="btn ghost sm" aria-label="Previous" onClick={() => shift(-1)}>
              <Icon name="chevron-left" size={16} />
            </button>
            <button type="button" className="btn ghost sm" aria-label="Next" onClick={() => shift(1)}>
              <Icon name="chevron-right" size={16} />
            </button>
          </div>
          <h1 className="cal-range-title">{rangeLabel(anchor, view)}</h1>
        </div>
        <div className="cal-toolbar-right">
          <div className="cal-view-switch" role="tablist" aria-label="Calendar view">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={view === v.id}
                className={"cal-view-btn" + (view === v.id ? " on" : "")}
                onClick={() => setView(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
          {canWrite && (
            <button type="button" className="btn primary sm" onClick={() => openCreate()}>
              <Icon name="plus" size={14} /> Add event
            </button>
          )}
        </div>
      </header>

      <div className="cal-workspace">
        <aside className="cal-sidebar">
          <div className="cal-sidebar-title">Calendars</div>
          <SourceChip
            color={KEEL_COLOR}
            label="Keel events"
            on={isOn(KEEL_SOURCE)}
            onToggle={() => flip(KEEL_SOURCE)}
          />
          {deadlinesEnabled && (
            <SourceChip
              color={PROPOSALS_COLOR}
              label="Proposal deadlines"
              on={isOn(PROPOSALS_SOURCE)}
              onToggle={() => flip(PROPOSALS_SOURCE)}
            />
          )}
          {feeds.map((f) => (
            <SourceChip
              key={f.id}
              color={f.color}
              label={f.name}
              isPrivate={f.visibility === "private"}
              on={isOn("feed:" + f.id)}
              onToggle={() => flip("feed:" + f.id)}
            >
              {canManage && (
                <span className="cal-chip-actions">
                  <button type="button" className="btn ghost sm" aria-label={"Edit calendar " + f.name}
                    onClick={() => { setFeedError(""); setFeedModal({ mode: "edit", feed: f }); }}>
                    <Icon name="pen" size={12} />
                  </button>
                  <button type="button" className="btn ghost sm" aria-label={"Remove calendar " + f.name}
                    onClick={() => { setFeedError(""); setFeedModal({ mode: "delete", feed: f }); }}>
                    <Icon name="x" size={12} />
                  </button>
                </span>
              )}
            </SourceChip>
          ))}
          {canManage && (
            <button type="button" className="btn ghost sm cal-attach" onClick={() => { setFeedError(""); setFeedModal({ mode: "create" }); }}>
              <Icon name="plus" size={13} /> Attach calendar
            </button>
          )}
          {external.errors.map((err, i) => (
            <span key={i} className="cal-key-warn">
              <Icon name="alert" size={12} /> {err.name ? `${err.name}: ` : ""}{err.message}
            </span>
          ))}
          {proposals.error && (
            <span className="cal-key-warn">
              <Icon name="alert" size={12} /> {proposals.error.message}
            </span>
          )}
          {eventsRes.error && (
            <span className="cal-key-warn">
              <Icon name="alert" size={12} /> {eventsRes.error.message}
            </span>
          )}
        </aside>

        <div className="cal-surface">
          {loading ? <Loading /> : (
            view === "month" ? (
              <MonthView
                anchor={anchor}
                events={events}
                feedById={feedById}
                onSelectDay={selectDay}
                onSelectEvent={openEdit}
                onCreateDay={createOnDay}
              />
            ) : (
              <TimeGrid
                days={view === "day" ? [startOfDay(anchor)] : weekDays(anchor)}
                events={events}
                feedById={feedById}
                onSelectEvent={openEdit}
                onCreateAt={openCreate}
                canWrite={canWrite}
              />
            )
          )}
        </div>
      </div>

      {eventModal && eventModal.mode === "proposal" && (() => {
        const m = eventModal.item._proposalMeta || {};
        const days = daysUntil(eventModal.item.startsAt);
        const statusLabel = PROPOSAL_TAG_LABELS[m.tag] || m.tag || "Draft";
        const countdown = days == null
          ? null
          : days >= 0
            ? `${days} day${days === 1 ? "" : "s"} to submit`
            : `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} past deadline`;
        return (
          <ModuleModal title={eventModal.item.title || "Proposal deadline"} onClose={closeEventModal}>
            <div className="col" style={{ gap: 10, fontSize: 13 }}>
              <div>
                <div className="mut" style={{ fontSize: 11, marginBottom: 2 }}>Deadline</div>
                {formatDate(eventModal.item.startsAt)}
                {countdown && (
                  <span style={{ marginLeft: 8, color: days < 7 ? "var(--fs-danger)" : "var(--fs-fg-muted)" }}>
                    · {countdown}
                  </span>
                )}
              </div>
              {m.agency && (
                <div>
                  <div className="mut" style={{ fontSize: 11, marginBottom: 2 }}>Agency</div>
                  {m.agency}{m.rfpNumber ? ` · ${m.rfpNumber}` : ""}
                </div>
              )}
              <div>
                <div className="mut" style={{ fontSize: 11, marginBottom: 2 }}>Status</div>
                {statusLabel}
              </div>
              <div>
                <div className="mut" style={{ fontSize: 11, marginBottom: 2 }}>Calendar</div>
                Proposal deadlines
              </div>
              <p className="mut" style={{ margin: "4px 0 0", fontSize: 12 }}>
                {canOpenProposals
                  ? "This deadline comes from the proposal builder. Open the proposal there to edit it."
                  : "This deadline comes from your proposal submission schedule."}
              </p>
              {canOpenProposals && onOpenProposal && (
                <div className="row" style={{ gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    className="btn primary sm"
                    onClick={() => {
                      closeEventModal();
                      onOpenProposal(eventModal.item._proposalId);
                    }}
                  >
                    Open in Proposals
                  </button>
                </div>
              )}
            </div>
          </ModuleModal>
        );
      })()}

      {eventModal && eventModal.mode === "view" && (
        <ModuleModal title={eventModal.item.title || "Event"} onClose={closeEventModal}>
          <div className="col" style={{ gap: 10, fontSize: 13 }}>
            <div>
              <div className="mut" style={{ fontSize: 11, marginBottom: 2 }}>When</div>
              {eventModal.item.allDay
                ? formatDate(eventModal.item.startsAt) + " · all day"
                : formatDateTime(eventModal.item.startsAt)
                  + (eventModal.item.endsAt ? " – " + formatDateTime(eventModal.item.endsAt) : "")}
            </div>
            {eventModal.item.location && (
              <div>
                <div className="mut" style={{ fontSize: 11, marginBottom: 2 }}>Location</div>
                {eventModal.item.location}
              </div>
            )}
            <div>
              <div className="mut" style={{ fontSize: 11, marginBottom: 2 }}>Calendar</div>
              {feedById[eventModal.item.feedId]?.name || "Attached calendar"}
            </div>
            <p className="mut" style={{ margin: "4px 0 0", fontSize: 12 }}>
              This event comes from an attached calendar and can’t be edited in Keel.
            </p>
          </div>
        </ModuleModal>
      )}

      {eventModal && eventModal.mode !== "view" && eventModal.mode !== "delete" && eventModal.mode !== "proposal" && (
        <ModuleModal
          title={(eventModal.mode === "edit" ? "Edit " : "Add ") + "event"}
          onClose={closeEventModal}
        >
          <ModuleForm
            fields={FIELDS}
            form={form}
            setForm={setForm}
            clients={clients}
            saving={savingEvent}
            error={eventError}
            onSubmit={handleSubmit}
            onCancel={closeEventModal}
            submitLabel={eventModal.mode === "edit" ? "Save changes" : "Add event"}
          />
          {eventModal.mode === "edit" && (
            <button
              type="button"
              className="btn danger sm"
              style={{ marginTop: 12 }}
              disabled={savingEvent}
              onClick={handleDelete}
            >
              Delete event
            </button>
          )}
        </ModuleModal>
      )}

      {feedModal && feedModal.mode !== "delete" && (
        <ModuleModal
          title={feedModal.mode === "edit" ? "Edit attached calendar" : "Attach a Google calendar"}
          onClose={closeFeedModal}
        >
          <FeedForm
            feed={feedModal.mode === "edit" ? feedModal.feed : null}
            saving={savingFeed}
            error={feedError}
            onSubmit={submitFeed}
            onCancel={closeFeedModal}
          />
        </ModuleModal>
      )}

      {feedModal?.mode === "delete" && (
        <ModuleModal title="Remove attached calendar" onClose={closeFeedModal}>
          <p style={{ fontSize: 13, margin: "0 0 16px" }}>
            Remove <strong style={{ color: "var(--fs-navy)" }}>{feedModal.feed.name}</strong> from the calendar view?
            This only detaches the feed — nothing is deleted from Google Calendar.
          </p>
          {feedError && <div style={{ fontSize: 13, color: "var(--fs-danger)", marginBottom: 12 }}>{feedError}</div>}
          <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="btn secondary" onClick={closeFeedModal}>Cancel</button>
            <button type="button" className="btn danger" disabled={savingFeed} onClick={deleteFeed}>
              {savingFeed ? "Removing…" : "Remove"}
            </button>
          </div>
        </ModuleModal>
      )}
    </div>
  );
}
