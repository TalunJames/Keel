import React, { useState, useEffect, useRef } from "react";
import { Icon, Avatar } from "./ui.jsx";

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

function useClickOutside(ref, onClose) {
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [ref, onClose]);
}

function UserMenu({ user, role, collapsed, theme, onToggleTheme, onNavigate, onLogout }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useClickOutside(wrapRef, () => setOpen(false));

  const roleLabel = {
    staff: "Staff",
    admin: user?.systemAdmin ? "System Admin" : "Admin",
    client: "Client",
  }[role] || "User";

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="sb-user"
        onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {user?.photo
          ? <img src={user.photo} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
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
  active, onNavigate, collapsed, onToggleCollapse, role, user, onLogout,
  modules, badges = {}, theme, onToggleTheme,
}) {
  const renderItem = (m) => (
    <a key={m.id} className={"sb-item " + (active === m.id ? "active" : "")} onClick={() => onNavigate(m.id)}>
      <span className="ic"><Icon name={MODULE_ICONS[m.id] || "circle"} size={18} /></span>
      <span>{m.label}</span>
      {badges[m.id] != null && badges[m.id] !== 0 && (
        <span className="badge">{badges[m.id]}</span>
      )}
    </a>
  );

  const roleLabel = {
    staff: "Staff",
    admin: user?.systemAdmin ? "System Admin" : "Admin",
    client: "Client",
  }[role];

  return (
    <aside className="sb" style={{ position: "relative" }}>
      <button type="button" className="sb-collapse" style={{ right: -11, top: 50 }} onClick={onToggleCollapse} aria-label="Collapse sidebar">
        <Icon name={collapsed ? "chevron-right" : "chevron-left"} size={13} />
      </button>

      <div className="sb-logo">
        <img src="/truenaslogo.png" alt="Fog Signal Strategies"
          style={{
            width: 40, height: 40, borderRadius: 4,
            background: "var(--fs-gold)",
            objectFit: "contain", padding: 4, flexShrink: 0,
          }} />
        {!collapsed && (
          <div>
            <div className="keel-wm">Keel</div>
            <div className="keel-sub">Fog Signal · {roleLabel}</div>
          </div>
        )}
      </div>

      <nav className="sb-nav">
        {!collapsed && <div className="sb-section-label">Workspace</div>}
        {modules.map(renderItem)}
        {role === "admin" && (
          <>
            {!collapsed && <div className="sb-section-label">Administration</div>}
            <a className={"sb-item " + (active === "admin" ? "active" : "")} onClick={() => onNavigate("admin")}>
              <span className="ic"><Icon name="shield" size={18} /></span>
              <span>Admin Console</span>
            </a>
          </>
        )}
      </nav>

      <div className="sb-footer">
        <UserMenu
          user={user}
          role={role}
          collapsed={collapsed}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onNavigate={onNavigate}
          onLogout={onLogout}
        />
      </div>
    </aside>
  );
}

function ClientSwitcher({ clients, selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useClickOutside(wrapRef, () => setOpen(false));

  if (!clients.length) return null;

  if (clients.length <= 1) {
    const single = selected || clients[0];
    return (
      <div className="client-pill" style={{ cursor: "default" }}>
        <span className="swatch" style={{ background: single.color }}>{single.initials}</span>
        <span>{single.name.split(/[—·]/)[0].trim()}</span>
      </div>
    );
  }

  const isAll = selected?.id === "all";

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button type="button" className={"client-pill " + (isAll ? "all" : "")} onClick={() => setOpen((o) => !o)}>
        <span className="swatch" style={isAll ? {} : { background: selected.color }}>{selected.initials}</span>
        <span>{isAll ? "All Clients" : selected.name.split(/[—·]/)[0].trim()}</span>
        <Icon name={open ? "chevron-up" : "chevron-down"} size={13} />
      </button>
      {open && (
        <div className="client-pop">
          <div className="head">Switch Client</div>
          {clients.map((c) => (
            <button key={c.id} type="button" className={"row-item " + (selected?.id === c.id ? "active" : "")}
              onClick={() => { onSelect(c.id); setOpen(false); }}>
              <span style={{
                width: 28, height: 28, borderRadius: "50%",
                background: c.color, color: c.id === "all" ? "var(--fs-navy-900)" : "var(--ks-on-ink)",
                display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700,
              }}>{c.initials}</span>
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

  useClickOutside(wrapRef, () => { if (!q) setExpanded(false); });

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

function AnnouncementsBell({ announcements = [], unreadCount }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useClickOutside(wrapRef, () => setOpen(false));
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
  section, crumbs, role, clients, selectedClient, onSelectClient, onNew,
  announcements,
}) {
  return (
    <header className="topbar">
      <div>
        {crumbs && <div className="crumbs">{crumbs}</div>}
        <h1 className="page-title">{section}</h1>
      </div>
      <div style={{ marginLeft: 12 }}>
        <ClientSwitcher clients={clients} selected={selectedClient} onSelect={onSelectClient} />
      </div>
      <div className="grow" />
      <CollapsibleSearch />
      {role !== "client" && (
        <button type="button" className="btn primary" onClick={onNew}>
          <Icon name="plus" size={14} /> New Request
        </button>
      )}
      <AnnouncementsBell announcements={announcements} />
    </header>
  );
}
