import React, { useMemo, useRef, useState } from "react";
import { Icon } from "../components/ui.jsx";
import { useApi } from "../lib/useApi.js";
import { useScopedPref } from "../lib/usePref.js";
import { withClient, api } from "../lib/api.js";
import { Loading } from "../components/Loading.jsx";
import { HOME_STAT_CATALOG, DEFAULT_HOME_STATS, normalizeHomeStats } from "../lib/homeStats.js";
import {
  DEFAULT_HOME_LAYOUT,
  HOME_WIDGET_SLOTS,
  normalizeHomeLayout,
  widgetsBySlot,
  moveWidget,
  toggleWidget,
  relabelWidget,
  widgetMeta,
} from "../lib/homeWidgets.js";
import {
  StatsStripWidget,
  AnnouncementsWidget,
  YourRacesWidget,
  UpcomingEventsWidget,
  DesignQueueWidget,
  LatestPollWidget,
  TasksWidget,
  QuickLinksWidget,
} from "./home-widgets.jsx";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function useClickOutside(ref, onClose) {
  React.useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [ref, onClose]);
}

const SLOT_LABELS = {
  hero: "Header",
  main: "Main column",
  aside: "Sidebar",
};

function HomeDashboardCustomizer({
  layout,
  onLayoutChange,
  stats,
  onStatsChange,
  onClose,
  role,
  effectiveModules,
}) {
  const wrapRef = useRef(null);
  useClickOutside(wrapRef, onClose);

  const normalized = useMemo(
    () => normalizeHomeLayout(layout, { role, effectiveModules }),
    [layout, role, effectiveModules],
  );

  const bySlot = useMemo(() => {
    const groups = { hero: [], main: [], aside: [] };
    for (const w of normalized) {
      const slot = widgetMeta(w.id)?.slot;
      if (slot) groups[slot].push(w);
    }
    for (const slot of HOME_WIDGET_SLOTS) {
      groups[slot].sort((a, b) => a.order - b.order);
    }
    return groups;
  }, [normalized]);

  const statsEnabled = normalized.find((w) => w.id === "statsStrip")?.enabled;

  return (
    <div ref={wrapRef} className="home-dash-pop" role="dialog" aria-label="Customize home dashboard">
      <div className="home-stats-pop-head">Customize home</div>
      <p className="mut" style={{ fontSize: 12, margin: "0 0 14px", lineHeight: 1.45 }}>
        Turn widgets on or off, rename them, and reorder within each column. Saved per client on this device.
      </p>

      {HOME_WIDGET_SLOTS.map((slot) => {
        const rows = bySlot[slot];
        if (!rows.length) return null;
        return (
          <div key={slot} className="home-dash-slot">
            <div className="home-dash-slot-label">{SLOT_LABELS[slot]}</div>
            <div className="col" style={{ gap: 8 }}>
              {rows.map((w, idx) => {
                const meta = widgetMeta(w.id);
                return (
                  <div key={w.id} className="home-dash-row">
                    <label className="row" style={{ gap: 8, alignItems: "center", flex: 1, minWidth: 0 }}>
                      <input
                        type="checkbox"
                        checked={w.enabled}
                        onChange={() => onLayoutChange(toggleWidget(normalized, w.id))}
                        style={{ accentColor: "var(--fs-navy)", flexShrink: 0 }}
                      />
                      <span style={{ width: 18, flexShrink: 0, color: "var(--fs-fg-muted)" }}>
                        <Icon name={meta?.icon || "sliders"} size={16} />
                      </span>
                      <input
                        className="input"
                        value={w.label}
                        onChange={(e) => onLayoutChange(relabelWidget(normalized, w.id, e.target.value))}
                        style={{ flex: 1, fontSize: 13, padding: "6px 10px", minWidth: 0 }}
                      />
                    </label>
                    <div className="row" style={{ gap: 2, flexShrink: 0 }}>
                      <button
                        type="button"
                        className="btn ghost"
                        style={{ padding: "4px 6px" }}
                        disabled={idx === 0}
                        onClick={() => onLayoutChange(moveWidget(normalized, w.id, -1))}
                        aria-label={`Move ${w.label} up`}
                      >
                        <Icon name="chevron-up" size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn ghost"
                        style={{ padding: "4px 6px" }}
                        disabled={idx === rows.length - 1}
                        onClick={() => onLayoutChange(moveWidget(normalized, w.id, 1))}
                        aria-label={`Move ${w.label} down`}
                      >
                        <Icon name="chevron-down" size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {statsEnabled && (role === "staff" || role === "admin") && (
        <div className="home-dash-slot">
          <div className="home-dash-slot-label">Stats in header</div>
          <div className="col" style={{ gap: 8 }}>
            {stats.map((s) => (
              <label key={s.id} className="row" style={{ gap: 10, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={s.enabled}
                  onChange={() => onStatsChange(stats.map((row) => (row.id === s.id ? { ...row, enabled: !row.enabled } : row)))}
                  style={{ accentColor: "var(--fs-navy)" }}
                />
                <input
                  className="input"
                  value={s.label}
                  onChange={(e) => onStatsChange(stats.map((row) => (row.id === s.id ? { ...row, label: e.target.value } : row)))}
                  style={{ flex: 1, fontSize: 13, padding: "6px 10px" }}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="row" style={{ gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
        <button
          type="button"
          className="btn secondary"
          onClick={() => {
            onLayoutChange(DEFAULT_HOME_LAYOUT);
            onStatsChange(DEFAULT_HOME_STATS);
          }}
        >
          Reset
        </button>
        <button type="button" className="btn primary" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

function renderWidget(id, props) {
  const { labels } = props;
  const title = labels[id] || widgetMeta(id)?.defaultLabel || id;

  switch (id) {
    case "statsStrip":
      return (
        <StatsStripWidget
          key={id}
          enabledStats={props.enabledStats}
          statValues={props.statValues}
        />
      );
    case "announcements":
      return <AnnouncementsWidget key={id} title={title} announcements={props.announcements} />;
    case "yourRaces":
      return (
        <YourRacesWidget
          key={id}
          title={title}
          races={props.races}
          onNavigate={props.onNavigate}
        />
      );
    case "upcomingEvents":
      return (
        <UpcomingEventsWidget
          key={id}
          title={title}
          clientId={props.clientId}
          onNavigate={props.onNavigate}
        />
      );
    case "designQueue":
      return (
        <DesignQueueWidget
          key={id}
          title={title}
          role={props.role}
          clientId={props.clientId}
          onNavigate={props.onNavigate}
        />
      );
    case "latestPoll":
      return (
        <LatestPollWidget
          key={id}
          title={title}
          role={props.role}
          clientId={props.clientId}
          onNavigate={props.onNavigate}
        />
      );
    case "tasks":
      return (
        <TasksWidget
          key={id}
          title={title}
          tasks={props.tasks}
          onToggle={props.toggleTask}
        />
      );
    case "quickLinks":
      return (
        <QuickLinksWidget
          key={id}
          title={title}
          role={props.role}
          onNavigate={props.onNavigate}
        />
      );
    default:
      return null;
  }
}

export function HomeView({ user, role, onNavigate, client, clientId, effectiveModules = {} }) {
  const { data, loading, error, reload } = useApi(withClient("/home", clientId), [clientId]);
  const prefScope = clientId || "all";
  const [rawHomeStats, setRawHomeStats] = useScopedPref("homeStats", prefScope, DEFAULT_HOME_STATS);
  const [rawHomeLayout, setRawHomeLayout] = useScopedPref("homeLayout", prefScope, DEFAULT_HOME_LAYOUT);
  const [customizing, setCustomizing] = useState(false);

  const layoutCtx = useMemo(() => ({ role, effectiveModules }), [role, effectiveModules]);
  const homeLayout = useMemo(() => normalizeHomeLayout(rawHomeLayout, layoutCtx), [rawHomeLayout, layoutCtx]);
  const slots = useMemo(() => widgetsBySlot(rawHomeLayout, layoutCtx), [rawHomeLayout, layoutCtx]);
  const labels = useMemo(
    () => Object.fromEntries(homeLayout.map((w) => [w.id, w.label])),
    [homeLayout],
  );

  const homeStats = useMemo(() => normalizeHomeStats(rawHomeStats), [rawHomeStats]);
  const enabledStats = useMemo(() => homeStats.filter((s) => s.enabled), [homeStats]);

  const toggleTask = (id, done) => {
    api("/home/tasks/" + id, { method: "PATCH", body: JSON.stringify({ done: !done }) })
      .then(reload)
      .catch(() => {});
  };

  if (loading) return <Loading label="Loading workspace…" />;
  if (error) {
    return (
      <div className="card card-pad" style={{ maxWidth: 480 }}>
        <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--fs-navy)" }}>
          Couldn't load your workspace{error.message ? ` — ${error.message}` : ""}.
        </p>
        <button type="button" className="btn secondary" onClick={reload}>Retry</button>
      </div>
    );
  }

  const announcements = data?.announcements || [];
  const tasks = data?.tasks || [];
  const races = data?.races || [];
  const stats = data?.stats || { openProofs: 0, tasksDue: 0, racesTonight: 0 };

  const statValues = Object.fromEntries(
    HOME_STAT_CATALOG.map((cat) => [cat.id, stats[cat.statKey] ?? 0]),
  );

  const widgetProps = {
    labels,
    announcements,
    tasks,
    races,
    statValues,
    enabledStats,
    role,
    clientId,
    onNavigate,
    toggleTask,
  };

  const showStatsStrip = slots.hero.some((w) => w.id === "statsStrip");
  const hasAside = slots.aside.length > 0;

  return (
    <div>
      <div style={{
        background: "var(--ks-ink-surface)", color: "var(--ks-on-ink)",
        margin: "-28px -32px 28px", padding: "28px 32px 24px", position: "relative", overflow: "visible",
      }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, position: "relative" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--fs-gold)", fontWeight: 600, marginBottom: 8 }}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              {client?.id && client.id !== "all" ? " · " + client.name : ""}
            </div>
            <h1 style={{ fontFamily: "var(--fs-font-display)", fontSize: 32, fontWeight: 700, margin: 0, color: "var(--ks-on-ink)" }}>
              {greeting()}, {user.name.split(" ")[0]}.
            </h1>
            <p style={{ color: "rgba(255,255,255,0.72)", margin: "8px 0 0", fontSize: 14, maxWidth: 560 }}>
              {role === "client"
                ? "What your Fog Signal team has shared with you."
                : "Your workspace — tailor the widgets below to match how you work."}
            </p>
          </div>

          <div style={{ position: "relative", flexShrink: 0 }}>
            {showStatsStrip && (
              <StatsStripWidget enabledStats={enabledStats} statValues={statValues} />
            )}
            <button
              type="button"
              className="home-stats-edit"
              onClick={() => setCustomizing((o) => !o)}
              aria-label="Customize home dashboard"
              title="Customize home"
              style={!showStatsStrip || enabledStats.length === 0 ? { position: "static", marginTop: 0 } : undefined}
            >
              <Icon name="sliders" size={14} />
            </button>
            {customizing && (
              <HomeDashboardCustomizer
                layout={rawHomeLayout}
                onLayoutChange={setRawHomeLayout}
                stats={homeStats}
                onStatsChange={setRawHomeStats}
                onClose={() => setCustomizing(false)}
                role={role}
                effectiveModules={effectiveModules}
              />
            )}
          </div>
        </div>
      </div>

      {slots.main.length === 0 && slots.aside.length === 0 ? (
        <div className="card card-pad" style={{ textAlign: "center", maxWidth: 420, margin: "0 auto" }}>
          <p style={{ margin: "0 0 12px", color: "var(--fs-navy)", fontSize: 14 }}>No widgets enabled.</p>
          <button type="button" className="btn primary" onClick={() => setCustomizing(true)}>
            Customize home
          </button>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: hasAside ? "1fr 320px" : "1fr",
          gap: 24,
          alignItems: "flex-start",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {slots.main.map((w) => renderWidget(w.id, widgetProps))}
          </div>
          {hasAside && (
            <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {slots.aside.map((w) => renderWidget(w.id, widgetProps))}
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
