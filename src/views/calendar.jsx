import React, { useEffect, useMemo, useState } from "react";
import { ModuleListView, ModuleModal, cell, formatDate, formatDateTime } from "./ModuleList.jsx";
import { calendarApi, calendarFeedsApi, ApiError } from "../lib/api.js";
import { useApi } from "../lib/useApi.js";
import { Icon } from "../components/ui.jsx";

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
const FEED_COLORS = ["#2f6fb2", "#c05b2e", "#3d8a5f", "#7d5ba6", "#b3822f", "#b23a48", "#3a7ca5", "#5f6b7a"];
const TOGGLES_KEY = "calendarSources";

function loadToggles() {
  try { return JSON.parse(localStorage.getItem(TOGGLES_KEY) || "{}"); } catch { return {}; }
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

export function CalendarView(props) {
  const canManage = props.role !== "client";
  const feedsRes = useApi("/calendar/feeds", []);
  const feeds = feedsRes.data?.feeds || [];
  const feedsKey = feeds.map((f) => `${f.id}:${f.urlPreview}`).join("|");

  const [external, setExternal] = useState({ events: [], errors: [], loaded: false });
  const [toggles, setToggles] = useState(loadToggles);
  const [feedModal, setFeedModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  useEffect(() => {
    try { localStorage.setItem(TOGGLES_KEY, JSON.stringify(toggles)); } catch { /* private mode */ }
  }, [toggles]);

  useEffect(() => {
    if (!feedsRes.data) return;
    if (!feeds.length) { setExternal({ events: [], errors: [], loaded: true }); return; }
    let alive = true;
    const start = new Date();
    start.setDate(start.getDate() - 30);
    calendarFeedsApi.events(start.toISOString(), 270)
      .then((d) => alive && setExternal({ events: d.events || [], errors: d.errors || [], loaded: true }))
      .catch(() => alive && setExternal({ events: [], errors: [{ message: "Could not load attached calendars" }], loaded: true }));
    return () => { alive = false; };
  }, [feedsKey, feedsRes.data]);

  const isOn = (key) => toggles[key] !== false;
  const flip = (key) => setToggles((t) => ({ ...t, [key]: !(t[key] !== false) }));

  const feedById = useMemo(() => Object.fromEntries(feeds.map((f) => [f.id, f])), [feedsKey]);

  const extraItems = useMemo(
    () => external.events
      .filter((e) => feedById[e.feedId] && isOn("feed:" + e.feedId))
      .map((e) => ({ ...e, _external: true })),
    [external.events, toggles, feedById],
  );

  const closeModal = () => { setFeedModal(null); setModalError(""); };

  const submitFeed = async (form) => {
    if (saving) return;
    setSaving(true);
    setModalError("");
    try {
      const body = { name: form.name, visibility: form.visibility, color: form.color };
      if (form.url.trim() || feedModal.mode === "create") body.url = form.url.trim();
      if (feedModal.mode === "edit") await calendarFeedsApi.update(feedModal.feed.id, body);
      else await calendarFeedsApi.create(body);
      closeModal();
      feedsRes.reload();
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : "Could not save calendar");
    } finally {
      setSaving(false);
    }
  };

  const deleteFeed = async () => {
    if (saving) return;
    setSaving(true);
    setModalError("");
    try {
      await calendarFeedsApi.remove(feedModal.feed.id);
      closeModal();
      feedsRes.reload();
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : "Could not remove calendar");
    } finally {
      setSaving(false);
    }
  };

  const keyCard = (
    <div className="card cal-key">
      <span className="cal-key-title">Key</span>
      <SourceChip
        color="var(--fs-navy)"
        label="Keel events"
        on={isOn(KEEL_SOURCE)}
        onToggle={() => flip(KEEL_SOURCE)}
      />
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
                onClick={() => { setModalError(""); setFeedModal({ mode: "edit", feed: f }); }}>
                <Icon name="pen" size={12} />
              </button>
              <button type="button" className="btn ghost sm" aria-label={"Remove calendar " + f.name}
                onClick={() => { setModalError(""); setFeedModal({ mode: "delete", feed: f }); }}>
                <Icon name="x" size={12} />
              </button>
            </span>
          )}
        </SourceChip>
      ))}
      {canManage && (
        <button type="button" className="btn ghost sm" onClick={() => { setModalError(""); setFeedModal({ mode: "create" }); }}>
          <Icon name="plus" size={13} /> Attach calendar
        </button>
      )}
      {external.errors.map((err, i) => (
        <span key={i} className="cal-key-warn">
          <Icon name="alert" size={12} /> {err.name ? `${err.name}: ` : ""}{err.message}
        </span>
      ))}
    </div>
  );

  return (
    <>
      <ModuleListView
        {...props}
        title="Calendar"
        sub="Meetings, deadlines, and events across the firm."
        endpoint="/calendar/events"
        crud={calendarApi}
        fields={FIELDS}
        itemName="event"
        addLabel="Add event"
        columns={["Event", "Starts", "Kind", "Location"]}
        emptyTitle="No events"
        emptyDescription="Add meetings, deadlines, and events to keep the shared calendar current."
        emptyIcon="calendar"
        topContent={keyCard}
        extraItems={extraItems}
        transformItems={(items) => (isOn(KEEL_SOURCE) ? items : [])}
        sortItems={(a, b) => String(a.startsAt || "").localeCompare(String(b.startsAt || ""))}
        renderItem={(e) => {
          const feed = e._external ? feedById[e.feedId] : null;
          return (
            <>
              <td style={{ fontWeight: 600, color: "var(--fs-navy)" }}>
                <span className="cal-dot" style={{ background: feed ? feed.color : "var(--fs-navy)", marginRight: 8 }} />
                {e.title ?? "—"}
              </td>
              {cell(e.allDay ? formatDate(e.startsAt) + " · all day" : formatDateTime(e.startsAt), { mut: true })}
              {cell(feed ? feed.name : e.kind)}
              {cell(e.location, { mut: true })}
            </>
          );
        }}
      />

      {feedModal && feedModal.mode !== "delete" && (
        <ModuleModal
          title={feedModal.mode === "edit" ? "Edit attached calendar" : "Attach a Google calendar"}
          onClose={closeModal}
        >
          <FeedForm
            feed={feedModal.mode === "edit" ? feedModal.feed : null}
            saving={saving}
            error={modalError}
            onSubmit={submitFeed}
            onCancel={closeModal}
          />
        </ModuleModal>
      )}

      {feedModal?.mode === "delete" && (
        <ModuleModal title="Remove attached calendar" onClose={closeModal}>
          <p style={{ fontSize: 13, margin: "0 0 16px" }}>
            Remove <strong style={{ color: "var(--fs-navy)" }}>{feedModal.feed.name}</strong> from the calendar view?
            This only detaches the feed — nothing is deleted from Google Calendar.
          </p>
          {modalError && <div style={{ fontSize: 13, color: "var(--fs-danger)", marginBottom: 12 }}>{modalError}</div>}
          <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="btn secondary" onClick={closeModal}>Cancel</button>
            <button type="button" className="btn danger" disabled={saving} onClick={deleteFeed}>
              {saving ? "Removing…" : "Remove"}
            </button>
          </div>
        </ModuleModal>
      )}
    </>
  );
}
