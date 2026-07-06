import React, { useMemo } from "react";
import { Icon } from "../components/ui.jsx";
import { useApi } from "../lib/useApi.js";
import { withClient } from "../lib/api.js";
import { EmptyState } from "../components/EmptyState.jsx";
import { formatDateTime } from "./ModuleList.jsx";
import { HOME_STAT_CATALOG } from "../lib/homeStats.js";

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

const OPEN_DESIGN_STATUSES = new Set([
  "Submitted", "Assigned", "In Design", "Final Proof", "Revisions", "Client Review",
]);

function WidgetShell({ title, children, action }) {
  return (
    <section className="card card-pad">
      <div className="row between" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontFamily: "var(--fs-font-display)", color: "var(--fs-navy)", fontSize: title.length > 20 ? 14 : 15 }}>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StatsStripWidget({ label, enabledStats, statValues }) {
  if (!enabledStats.length) return null;
  return (
    <div style={{ display: "flex", gap: 20, padding: "12px 24px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 4 }}>
      {enabledStats.map((s) => (
        <div key={s.id} style={{ minWidth: 70 }}>
          <div style={{ fontFamily: "var(--fs-font-display)", fontSize: 28, fontWeight: 700, color: "var(--fs-gold)" }}>
            {statValues[s.id] ?? 0}
          </div>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AnnouncementsWidget({ title, announcements }) {
  return (
    <section>
      <div className="row between" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontFamily: "var(--fs-font-display)", color: "var(--fs-navy)" }}>{title}</h3>
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
  );
}

export function YourRacesWidget({ title, races, onNavigate }) {
  if (!races.length) return null;
  return (
    <WidgetShell
      title={title}
      action={(
        <button type="button" className="btn ghost" style={{ fontSize: 12, padding: "4px 8px" }} onClick={() => onNavigate("election")}>
          Open <Icon name="arrow-right" size={12} />
        </button>
      )}
    >
      <div className="col" style={{ gap: 8 }}>
        {races.map((r, i) => (
          <div key={i} className="row between" style={{ fontSize: 13 }}>
            <span style={{ fontWeight: 600, color: "var(--fs-navy)" }}>{r.name}</span>
            <span className="mut">{r.next || r.when || ""}</span>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

export function UpcomingEventsWidget({ title, clientId, onNavigate }) {
  const start = useMemo(() => new Date().toISOString(), []);
  const { data, loading } = useApi(
    `/account/calendar?start=${encodeURIComponent(start)}&days=21`,
    [start],
  );
  const events = (data?.events || []).slice(0, 5);

  return (
    <WidgetShell
      title={title}
      action={(
        <button type="button" className="btn ghost" style={{ fontSize: 12, padding: "4px 8px" }} onClick={() => onNavigate("calendar")}>
          Calendar <Icon name="arrow-right" size={12} />
        </button>
      )}
    >
      {loading ? (
        <p className="mut" style={{ fontSize: 13, margin: 0 }}>Loading events…</p>
      ) : events.length === 0 ? (
        <p className="mut" style={{ fontSize: 13, margin: 0 }}>Nothing scheduled in the next three weeks.</p>
      ) : (
        <div className="col" style={{ gap: 8 }}>
          {events.map((e) => (
            <div key={e.id} className="row between" style={{ fontSize: 13, gap: 12 }}>
              <span style={{ fontWeight: 600, color: "var(--fs-navy)" }}>{e.title}</span>
              <span className="mut" style={{ whiteSpace: "nowrap" }}>{formatDateTime(e.startsAt)}</span>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

export function DesignQueueWidget({ title, role, clientId, onNavigate }) {
  const { data, loading } = useApi(withClient("/design/requests", clientId), [clientId]);
  const items = useMemo(() => {
    const rows = data?.items || [];
    return rows
      .filter((r) => OPEN_DESIGN_STATUSES.has(r.status))
      .slice(0, 5);
  }, [data]);

  return (
    <WidgetShell
      title={title}
      action={(
        <button type="button" className="btn ghost" style={{ fontSize: 12, padding: "4px 8px" }} onClick={() => onNavigate("design")}>
          {role === "client" ? "Proofs" : "Design"} <Icon name="arrow-right" size={12} />
        </button>
      )}
    >
      {loading ? (
        <p className="mut" style={{ fontSize: 13, margin: 0 }}>Loading requests…</p>
      ) : items.length === 0 ? (
        <p className="mut" style={{ fontSize: 13, margin: 0 }}>No open design requests.</p>
      ) : (
        <div className="col" style={{ gap: 8 }}>
          {items.map((r) => (
            <div key={r.id} className="row between" style={{ fontSize: 13, gap: 12 }}>
              <span style={{ fontWeight: 600, color: "var(--fs-navy)" }}>{r.title}</span>
              <span className="tag">{r.status}</span>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

function pollHeadline(poll) {
  if (poll.tone) return poll.tone;
  const t = poll.payload?.topline;
  if (t) return `${t.support}% support · ${t.oppose}% oppose`;
  return poll.date || "Latest results";
}

export function LatestPollWidget({ title, role, clientId, onNavigate }) {
  const { data, loading } = useApi(withClient("/polling/polls", clientId), [clientId]);
  const poll = (data?.polls || [])[0];

  return (
    <WidgetShell
      title={title}
      action={(
        <button type="button" className="btn ghost" style={{ fontSize: 12, padding: "4px 8px" }} onClick={() => onNavigate("polling")}>
          Polling <Icon name="arrow-right" size={12} />
        </button>
      )}
    >
      {loading ? (
        <p className="mut" style={{ fontSize: 13, margin: 0 }}>Loading polls…</p>
      ) : !poll ? (
        <p className="mut" style={{ fontSize: 13, margin: 0 }}>No polls published yet.</p>
      ) : (
        <div>
          <div style={{ fontWeight: 600, color: "var(--fs-navy)", fontSize: 14, marginBottom: 6 }}>{poll.title}</div>
          <div className="mut" style={{ fontSize: 13 }}>{pollHeadline(poll)}</div>
          {poll.n != null && (
            <div className="mut" style={{ fontSize: 11, marginTop: 8 }}>
              n={poll.n}{poll.moe != null ? ` · ±${poll.moe}%` : ""}
            </div>
          )}
        </div>
      )}
    </WidgetShell>
  );
}

export function TasksWidget({ title, tasks, onToggle }) {
  return (
    <WidgetShell title={title}>
      {tasks.length === 0 ? (
        <p className="mut" style={{ fontSize: 13, margin: 0 }}>No tasks assigned.</p>
      ) : (
        <div className="col" style={{ gap: 8 }}>
          {tasks.map((t) => (
            <label key={t.id} className="row" style={{ fontSize: 13, cursor: "pointer", gap: 8 }}>
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => onToggle(t.id, t.done)}
                style={{ accentColor: "var(--fs-navy)" }}
              />
              <span style={{ textDecoration: t.done ? "line-through" : "none", color: t.done ? "var(--fs-fg-muted)" : "var(--fs-ink)" }}>
                {t.label}
              </span>
            </label>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

export function QuickLinksWidget({ title, role, onNavigate }) {
  const links = QUICK_LINKS[role] || QUICK_LINKS.staff;
  return (
    <WidgetShell title={title}>
      <div className="col" style={{ gap: 6 }}>
        {links.map((l) => (
          <button
            key={l.label}
            type="button"
            className="btn secondary"
            style={{ justifyContent: "flex-start" }}
            onClick={() => onNavigate(l.to)}
          >
            <Icon name={l.icon} size={14} /> {l.label}
          </button>
        ))}
      </div>
    </WidgetShell>
  );
}

export { HOME_STAT_CATALOG };
