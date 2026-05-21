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

export function Sidebar({
  active, onNavigate, collapsed, onToggleCollapse, role, user, onLogout, modules, badges = {},
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

  const roleLabel = { staff: "Staff", admin: "Admin", client: "Client" }[role];

  return (
    <aside className="sb" style={{ position: "relative" }}>
      <button type="button" className="sb-collapse" style={{ right: -11, top: 50 }} onClick={onToggleCollapse} aria-label="Collapse sidebar">
        <Icon name={collapsed ? "chevron-right" : "chevron-left"} size={13} />
      </button>

      <div className="sb-logo">
        <div style={{
          width: 40, height: 40, borderRadius: 4,
          background: "var(--fs-gold)", color: "var(--fs-navy-900)",
          display: "grid", placeItems: "center", fontWeight: 800, fontSize: 14,
        }}>FS</div>
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
        <button type="button" className="sb-user" onClick={onLogout} style={{ width: "100%", border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}>
          <Avatar name={user.name} size={32} />
          {!collapsed && (
            <>
              <div className="meta">
                <div className="name">{user.name}</div>
                <div className="role">{roleLabel} · {user.team}</div>
              </div>
              <span className="chev" style={{ marginLeft: "auto", color: "rgba(255,255,255,0.4)" }}>
                <Icon name="logout" size={15} />
              </span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

function ClientSwitcher({ clients, selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const close = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

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

export function TopBar({ section, crumbs, role, theme, onToggleTheme, clients, selectedClient, onSelectClient, onNew }) {
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
      <div className="search">
        <Icon name="search" size={15} />
        <input placeholder="Search Keel — people, races, files…" aria-label="Search" />
      </div>
      {role !== "client" && (
        <button type="button" className="btn primary" onClick={onNew}>
          <Icon name="plus" size={14} /> New Request
        </button>
      )}
      <button type="button" className="theme-toggle" onClick={onToggleTheme}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
        <span className="knob">
          <Icon name={theme === "dark" ? "moon" : "sun"} size={12} />
        </span>
      </button>
      <button type="button" className="icon-btn" aria-label="Notifications">
        <Icon name="bell" size={16} /><span className="dot" />
      </button>
    </header>
  );
}
