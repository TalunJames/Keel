import React, { useState, useEffect, useRef } from "react";
import { Icon, Avatar } from "./ui.jsx";
import { versionApi } from "../lib/api.js";
import { realClients } from "../lib/clients.js";
import { safeUrl } from "../lib/safe-url.js";

function VersionStamp({ show }) {
  const [v, setV] = useState(null);
  useEffect(() => {
    if (!show) return;
    versionApi.get().then(setV).catch(() => setV(null));
  }, [show]);
  if (!show || !v) return null;
  const built = v.builtAt && v.builtAt !== "unknown"
    ? new Date(v.builtAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null;
  const title = `build ${v.sha}\nbuilt ${v.builtAt}\nref ${v.ref}`;
  return (
    <div className="sb-version" title={title}>
      <span>v {v.shaShort}</span>
      {built && <span style={{ opacity: 0.6 }}> · {built}</span>}
    </div>
  );
}

const MODULE_ICONS = {
  home: "home",
  calendar: "calendar",
  design: "pen",
  proposals: "compass",
  media: "comment",
  election: "tv",
  voter: "users",
  polling: "trend-up",
  stakeholders: "key",
  resources: "book",
  onboarding: "flag",
};

// Closes the popover on an outside mousedown and (when open) on Escape, so the
// menus are keyboard-dismissible, not just mouse-dismissible.
function useClickOutside(ref, onClose, open = true) {
  useEffect(() => {
    const onMouseDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onMouseDown);
    if (open) document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [ref, onClose, open]);
}

function UserMenu({ user, role, theme, onToggleTheme, onNavigate, onLogout, collapsed, roleLabel }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useClickOutside(wrapRef, () => setOpen(false), open);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="sb-user"
        onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", border: "none", background: "transparent", cursor: "pointer", textAlign: collapsed ? "center" : "left" }}
        aria-haspopup="menu"
        aria-expanded={open}
        title={collapsed ? user.name : undefined}
      >
        {safeUrl(user?.photo)
          ? <img src={safeUrl(user.photo)} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
          : <Avatar name={user.name} size={32} />}
        {!collapsed && (
          <>
            <div className="meta">
              <div className="name">{user.name}</div>
              <div className="role">{roleLabel}{user.team ? " · " + user.team : ""}</div>
            </div>
            <span className="chev" style={{ marginLeft: "auto", color: "rgba(255,255,255,0.5)" }}>
              <Icon name={open ? "chevron-up" : "chevron-down"} size={14} />
            </span>
          </>
        )}
      </button>
      {open && (
        <div className="user-pop" role="menu">
          <div className="user-pop-head">
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)" }}>{user.name}</div>
            <div className="mut" style={{ fontSize: 11 }}>{user.email}</div>
          </div>
          <button type="button" className="user-pop-item" onClick={() => { setOpen(false); onNavigate("account"); }}>
            <Icon name="settings" size={15} />
            <span>Account settings</span>
          </button>
          <button type="button" className="user-pop-item" onClick={onToggleTheme}>
            <Icon name={theme === "dark" ? "sun" : "moon"} size={15} />
            <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
            <span className="user-pop-meta">{theme === "dark" ? "Day" : "Night"}</span>
          </button>
          <div className="user-pop-sep" />
          <button type="button" className="user-pop-item danger" onClick={() => { setOpen(false); onLogout(); }}>
            <Icon name="logout" size={15} />
            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  active, onNavigate, role, user, onLogout, modules, badges = {}, theme, onToggleTheme,
  collapsed, onToggleCollapse,
}) {
  // Buttons don't inherit the <a> defaults the .sb-item class relies on, so
  // normalize them inline (styles.css is outside the editable scope).
  const navBtnStyle = {
    width: "100%",
    textAlign: "left",
    border: "none",
    background: "transparent",
    font: "inherit",
    fontSize: 14,
    fontWeight: 500,
  };

  const renderItem = (m) => (
    <button
      key={m.id}
      type="button"
      className={"sb-item " + (active === m.id ? "active" : "")}
      onClick={() => onNavigate(m.id)}
      title={collapsed ? m.label : undefined}
      aria-current={active === m.id ? "page" : undefined}
      style={navBtnStyle}
    >
      <span className="ic"><Icon name={MODULE_ICONS[m.id] || "circle"} size={18} /></span>
      {!collapsed && <span>{m.label}</span>}
      {!collapsed && badges[m.id] != null && badges[m.id] !== 0 && (
        <span className="badge">{badges[m.id]}</span>
      )}
    </button>
  );

  const roleLabel = {
    staff: "Staff",
    admin: user?.systemAdmin ? "System Admin" : "Admin",
    client: "Client",
  }[role];

  return (
    <aside className={"sb" + (collapsed ? " collapsed" : "")}>
      <button
        type="button"
        className="sb-collapse"
        onClick={onToggleCollapse}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <Icon name={collapsed ? "chevron-right" : "chevron-left"} size={13} />
      </button>

      <div className="sb-logo">
        <img
          src="/logo-wordmark-white.png"
          alt="Fog Signal Strategies"
          style={{ width: "100%", maxWidth: collapsed ? 36 : 180, height: "auto", display: "block" }}
        />
      </div>

      <nav className="sb-nav">
        {!collapsed && <div className="sb-section-label">Workspace</div>}
        {modules.map(renderItem)}
        {role === "admin" && (
          <>
            {!collapsed && <div className="sb-section-label">Administration</div>}
            <button
              type="button"
              className={"sb-item " + (active === "admin" ? "active" : "")}
              onClick={() => onNavigate("admin")}
              title={collapsed ? "Admin Console" : undefined}
              aria-current={active === "admin" ? "page" : undefined}
              style={navBtnStyle}
            >
              <span className="ic"><Icon name="shield" size={18} /></span>
              {!collapsed && <span>Admin Console</span>}
            </button>
          </>
        )}
      </nav>

      <div className="sb-footer">
        <UserMenu
          user={user}
          role={role}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onNavigate={onNavigate}
          onLogout={onLogout}
          collapsed={collapsed}
          roleLabel={roleLabel}
        />
        <VersionStamp show={role === "admin"} />
      </div>
    </aside>
  );
}

function ClientAvatar({ client, size = 28 }) {
  if (!client) return null;
  const isAll = client.id === "all";

  if (client.logo && !isAll) {
    return (
      <span className="client-avatar client-avatar-logo" style={{ width: size, height: size }}>
        <img src={client.logo} alt="" />
      </span>
    );
  }

  return (
    <span
      className={"client-avatar" + (isAll ? " all" : "")}
      style={{
        width: size,
        height: size,
        background: isAll ? undefined : client.color,
      }}
    >
      {client.initials}
    </span>
  );
}

function ClientSwitcher({ clients, selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useClickOutside(wrapRef, () => setOpen(false), open);

  if (!clients.length) return null;

  const accounts = realClients(clients);
  if (accounts.length <= 1) {
    const single = accounts[0] || selected || clients[0];
    return (
      <div className="client-pill" style={{ cursor: "default" }}>
        <ClientAvatar client={single} size={22} />
        <span>{single.name.split(/[—·]/)[0].trim()}</span>
      </div>
    );
  }

  const isAll = selected?.id === "all";

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button type="button" className={"client-pill " + (isAll ? "all" : "")} onClick={() => setOpen((o) => !o)}>
        <ClientAvatar client={selected} size={22} />
        <span>{isAll ? "All Clients" : selected.name.split(/[—·]/)[0].trim()}</span>
        <Icon name={open ? "chevron-up" : "chevron-down"} size={13} />
      </button>
      {open && (
        <div className="client-pop">
          <div className="head">Switch Client</div>
          {clients.map((c) => (
            <button key={c.id} type="button" className={"row-item " + (selected?.id === c.id ? "active" : "")}
              onClick={() => { onSelect(c.id); setOpen(false); }}>
              <ClientAvatar client={c} size={28} />
              <div style={{ flex: 1 }}>
                <div className="nm">{c.name}</div>
                {c.type && <div className="sub">{c.type}</div>}
              </div>
              {selected?.id === c.id && <Icon name="check" size={13} color="var(--fs-navy)" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CollapsibleSearch() {
  const [expanded, setExpanded] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  useClickOutside(wrapRef, () => { if (!q) setExpanded(false); }, expanded);

  const expand = () => {
    setExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const onKey = (e) => {
    if (e.key === "Escape") { setQ(""); setExpanded(false); e.currentTarget.blur(); }
  };

  return (
    <div ref={wrapRef} className={"search " + (expanded ? "expanded" : "collapsed")}>
      {expanded ? (
        <>
          <Icon name="search" size={15} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search Keel — people, races, files…"
            aria-label="Search"
          />
          {q && (
            <button type="button" className="search-clear" onClick={() => setQ("")} aria-label="Clear search">
              <Icon name="x" size={12} />
            </button>
          )}
        </>
      ) : (
        <button type="button" className="search-trigger" onClick={expand} aria-label="Open search">
          <Icon name="search" size={15} />
        </button>
      )}
    </div>
  );
}

const NEW_ACTIONS = {
  design: { label: "Design request", icon: "pen", desc: "Submit a creative brief" },
  proposals: { label: "Proposal", icon: "compass", desc: "Start a new scope doc" },
  calendar: { label: "Calendar event", icon: "calendar", desc: "Schedule a meeting or deadline" },
  client: { label: "New client", icon: "users", desc: "Onboard a client account", adminOnly: true },
};

function NewMenu({ role, onAction }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const closeTimer = useRef(null);
  const isPartner = role === "admin";

  useClickOutside(wrapRef, () => setOpen(false), open);

  const show = () => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  };

  const hide = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  const pick = (action) => {
    setOpen(false);
    onAction?.(action);
  };

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const items = Object.entries(NEW_ACTIONS).filter(([, a]) => !a.adminOnly || isPartner);

  return (
    <div
      ref={wrapRef}
      className="new-menu-wrap"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <button
        type="button"
        className="btn primary new-menu-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Icon name="plus" size={14} />
        <span className="new-menu-label">New</span>
        <span className="new-menu-chev"><Icon name={open ? "chevron-up" : "chevron-down"} size={12} /></span>
      </button>
      {open && (
        <div className="new-pop" role="menu" onMouseEnter={show} onMouseLeave={hide}>
          <div className="head">Create</div>
          {items.map(([id, a]) => (
            <button key={id} type="button" className="new-pop-item" role="menuitem" onClick={() => pick(id)}>
              <span className="new-pop-icon"><Icon name={a.icon} size={15} /></span>
              <span className="new-pop-text">
                <span className="new-pop-label">{a.label}</span>
                <span className="new-pop-desc">{a.desc}</span>
              </span>
              <Icon name="chevron-right" size={13} color="var(--fs-fg-subtle)" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AnnouncementsBell({ announcements = [], unreadCount }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useClickOutside(wrapRef, () => setOpen(false), open);
  const count = unreadCount ?? announcements.length;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button type="button" className="icon-btn" aria-label="Announcements" onClick={() => setOpen((o) => !o)}>
        <Icon name="bell" size={16} />
        {count > 0 && <span className="dot" />}
      </button>
      {open && (
        <div className="ann-pop" role="dialog" aria-label="Announcements">
          <div className="ann-pop-head">
            <span>Announcements</span>
            {count > 0 && <span className="ann-count">{count}</span>}
          </div>
          <div className="ann-pop-body">
            {announcements.length === 0 ? (
              <div className="ann-empty">
                <Icon name="pin" size={16} color="var(--fs-fg-subtle)" />
                <div>No announcements yet.</div>
              </div>
            ) : (
              announcements.slice(0, 10).map((a) => (
                <article key={a.id} className="ann-item">
                  <div className="ann-item-head">
                    <span className="tag navy">{a.tag || "Update"}</span>
                    {a.time && <span className="mut" style={{ fontSize: 11 }}>{a.time}</span>}
                  </div>
                  <div className="ann-item-title">{a.title}</div>
                  {a.body && <p className="ann-item-body">{a.body}</p>}
                  {a.from && <div className="mut" style={{ fontSize: 11, marginTop: 6 }}>From {a.from}</div>}
                </article>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function TopBar({
  section, role, clients, selectedClient, onSelectClient, onNewAction,
  announcements,
}) {
  return (
    <header className="topbar">
      <div>
        <h1 className="page-title">{section}</h1>
      </div>
      <div style={{ marginLeft: 12 }}>
        <ClientSwitcher clients={clients} selected={selectedClient} onSelect={onSelectClient} />
      </div>
      <div className="grow" />
      <CollapsibleSearch />
      {role !== "client" && (
        <NewMenu role={role} onAction={onNewAction} />
      )}
      <AnnouncementsBell announcements={announcements} />
    </header>
  );
}
