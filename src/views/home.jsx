import React, { useMemo, useRef, useState } from "react";
import { Icon } from "../components/ui.jsx";
import { useApi } from "../lib/useApi.js";
import { usePref } from "../lib/usePref.js";
import { withClient, api } from "../lib/api.js";
import { Loading } from "../components/Loading.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { HOME_STAT_CATALOG, DEFAULT_HOME_STATS, normalizeHomeStats } from "../lib/homeStats.js";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const QUICK_LINKS = {
  staff: [
    { label: "Request a design job", icon: "pen", to: "design" },
    { label: "Open Election Night", icon: "tv", to: "election" },
    { label: "Voter file explorer", icon: "users", to: "voter" },
    { label: "Resource library", icon: "book", to: "resources" },
  ],
  admin: [
    { label: "Admin console", icon: "shield", to: "admin" },
    { label: "Election Night", icon: "tv", to: "election" },
    { label: "Manage clients", icon: "key", to: "admin" },
    { label: "Resource library", icon: "book", to: "resources" },
  ],
  client: [
    { label: "Polling", icon: "trend-up", to: "polling" },
    { label: "Design proofs", icon: "image", to: "design" },
    { label: "Resources", icon: "book", to: "resources" },
  ],
};

function useClickOutside(ref, onClose) {
  React.useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [ref, onClose]);
}

function HomeStatsCustomizer({ stats, onChange, onClose }) {
  const wrapRef = useRef(null);
  useClickOutside(wrapRef, onClose);

  const toggle = (id) => {
    onChange(stats.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
  };

  const relabel = (id, label) => {
    onChange(stats.map((s) => (s.id === id ? { ...s, label } : s)));
  };

  return (
    <div ref={wrapRef} className="home-stats-pop" role="dialog" aria-label="Customize home stats">
      <div className="home-stats-pop-head">Home stats</div>
      <p className="mut" style={{ fontSize: 12, margin: "0 0 12px", lineHeight: 1.45 }}>
        Choose which numbers appear on your home screen and rename them.
      </p>
      <div className="col" style={{ gap: 10 }}>
        {stats.map((s) => (
          <label key={s.id} className="row" style={{ gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={s.enabled}
              onChange={() => toggle(s.id)}
              style={{ accentColor: "var(--fs-navy)" }}
            />
            <input
              className="input"
              value={s.label}
              onChange={(e) => relabel(s.id, e.target.value)}
              style={{ flex: 1, fontSize: 13, padding: "6px 10px" }}
            />
          </label>
        ))}
      </div>
      <div className="row" style={{ gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
        <button type="button" className="btn secondary" onClick={() => onChange(DEFAULT_HOME_STATS)}>Reset</button>
        <button type="button" className="btn primary" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

export function HomeView({ user, role, onNavigate, client, clientId }) {
  const { data, loading, reload } = useApi(withClient("/home", clientId), [clientId]);
  const [rawHomeStats, setRawHomeStats] = usePref("homeStats", DEFAULT_HOME_STATS);
  const [customizing, setCustomizing] = useState(false);
  const links = QUICK_LINKS[role] || QUICK_LINKS.staff;
  const isStaff = role === "staff" || role === "admin";

  const homeStats = useMemo(() => normalizeHomeStats(rawHomeStats), [rawHomeStats]);
  const enabledStats = useMemo(
    () => homeStats.filter((s) => s.enabled),
    [homeStats],
  );

  const toggleTask = (id, done) => {
    api("/home/tasks/" + id, { method: "PATCH", body: JSON.stringify({ done: !done }) }).then(reload);
  };

  if (loading) return <Loading label="Loading workspace…" />;

  const announcements = data?.announcements || [];
  const tasks = data?.tasks || [];
  const races = data?.races || [];
  const stats = data?.stats || { openProofs: 0, tasksDue: 0, racesTonight: 0 };

  const statValues = Object.fromEntries(
    HOME_STAT_CATALOG.map((cat) => [cat.id, stats[cat.statKey] ?? 0]),
  );

  return (
    <div>
      <div style={{
        background: "var(--ks-ink-surface)", color: "var(--ks-on-ink)",
        margin: "-28px -32px 28px", padding: "28px 32px 24px", position: "relative", overflow: "hidden",
      }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, position: "relative" }}>
          <div>
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
                : "Your workspace — announcements, tasks, and quick links."}
            </p>
          </div>
          {isStaff && (
            <div style={{ position: "relative" }}>
              {enabledStats.length > 0 && (
                <div style={{ display: "flex", gap: 20, padding: "12px 24px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 4 }}>
                  {enabledStats.map((s) => (
                    <StatBlock key={s.id} value={statValues[s.id]} label={s.label} />
                  ))}
                </div>
              )}
              {role === "staff" && (
                <button
                  type="button"
                  className="home-stats-edit"
                  onClick={() => setCustomizing((o) => !o)}
                  aria-label="Customize home stats"
                  title="Customize stats"
                  style={enabledStats.length === 0 ? { position: "static" } : undefined}
                >
                  <Icon name="sliders" size={14} />
                </button>
              )}
              {customizing && role === "staff" && (
                <HomeStatsCustomizer
                  stats={homeStats}
                  onChange={setRawHomeStats}
                  onClose={() => setCustomizing(false)}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <section>
            <div className="row between" style={{ marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontFamily: "var(--fs-font-display)", color: "var(--fs-navy)" }}>Announcements</h3>
            </div>
            {announcements.length === 0 ? (
              <EmptyState title="No announcements" description="Admins can post updates from the Admin Console." icon="pin" />
            ) : (
              <div className="col" style={{ gap: 10 }}>
                {announcements.map((a) => (
                  <article key={a.id} className="card card-pad">
                    <div className="row between" style={{ marginBottom: 6 }}>
                      <span className="tag navy">{a.tag || "Update"}</span>
                      <span className="mut" style={{ fontSize: 11 }}>{a.time}</span>
                    </div>
                    <h4 style={{ margin: "0 0 6px", color: "var(--fs-navy)", fontSize: 15 }}>{a.title}</h4>
                    <p className="mut" style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>{a.body}</p>
                    <div className="mut" style={{ fontSize: 11, marginTop: 8 }}>From {a.from}</div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {role !== "client" && races.length > 0 && (
            <section className="card card-pad">
              <h3 style={{ margin: "0 0 12px", fontFamily: "var(--fs-font-display)", color: "var(--fs-navy)" }}>Your races</h3>
              <div className="col" style={{ gap: 8 }}>
                {races.map((r, i) => (
                  <div key={i} className="row between" style={{ fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: "var(--fs-navy)" }}>{r.name}</span>
                    <span className="mut">{r.next || r.when || ""}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card card-pad">
            <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--fs-navy)" }}>My tasks</h3>
            {tasks.length === 0 ? (
              <p className="mut" style={{ fontSize: 13, margin: 0 }}>No tasks assigned.</p>
            ) : (
              <div className="col" style={{ gap: 8 }}>
                {tasks.map((t) => (
                  <label key={t.id} className="row" style={{ fontSize: 13, cursor: "pointer", gap: 8 }}>
                    <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id, t.done)} style={{ accentColor: "var(--fs-navy)" }} />
                    <span style={{ textDecoration: t.done ? "line-through" : "none", color: t.done ? "var(--fs-fg-muted)" : "var(--fs-ink)" }}>{t.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="card card-pad">
            <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--fs-navy)" }}>Quick links</h3>
            <div className="col" style={{ gap: 6 }}>
              {links.map((l) => (
                <button key={l.to} type="button" className="btn secondary" style={{ justifyContent: "flex-start" }}
                  onClick={() => onNavigate(l.to)}>
                  <Icon name={l.icon} size={14} /> {l.label}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function StatBlock({ value, label }) {
  return (
    <div style={{ minWidth: 70 }}>
      <div style={{ fontFamily: "var(--fs-font-display)", fontSize: 28, fontWeight: 700, color: "var(--fs-gold)" }}>{value}</div>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>{label}</div>
    </div>
  );
}
