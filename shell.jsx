/* global React */
const { useState: useStateShell, useEffect: useEffectShell, useRef: useRefShell } = React;

// ============================================================
// Sidebar — collapsible, role-aware nav, module-driven
// ============================================================
function Sidebar({ active, onNavigate, collapsed, onToggleCollapse, role, user, onSwitchRole, onLogout, modules }) {
  // Map module id → icon
  const icons = {
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
  const badges = {
    design:   role === "admin" ? 7 : 3,
    election: role !== "client" ? "LIVE" : null,
    media:    role !== "client" ? 12 : null,
  };

  const renderItem = (m) => {
    const isActive = active === m.id;
    return (
      <a key={m.id} className={"sb-item " + (isActive ? "active" : "")} onClick={() => onNavigate(m.id)}>
        <span className="ic"><Icon name={icons[m.id] || "circle"} size={18} /></span>
        <span>{m.label}</span>
        {badges[m.id] && <span className="badge">{badges[m.id]}</span>}
      </a>
    );
  };

  const roleLabel = { staff: "Staff", admin: "Admin", client: "Client" }[role];

  return (
    <aside className="sb" style={{ position: "relative" }}>
      <button className="sb-collapse" style={{ right: -11, top: 50 }} onClick={onToggleCollapse} aria-label="Collapse">
        <Icon name={collapsed ? "chevron-right" : "chevron-left"} size={13} />
      </button>

      <div className="sb-logo">
        <img src="design-system/assets/logo-stacked-white.png" alt="Fog Signal" />
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

        {role === "admin" && <>
          {!collapsed && <div className="sb-section-label">Administration</div>}
          <a className={"sb-item " + (active === "admin" ? "active" : "")} onClick={() => onNavigate("admin")}>
            <span className="ic"><Icon name="shield" size={18} /></span>
            <span>Admin Console</span>
          </a>
        </>}
      </nav>

      <div className="sb-footer">
        {/* Role switcher (prototype helper) */}
        {!collapsed && (
          <div style={{ display: "flex", gap: 4, padding: 4, background: "rgba(255,255,255,0.05)", borderRadius: 4, marginBottom: 10 }}>
            {["staff","admin","client"].map(r => (
              <button key={r} onClick={() => onSwitchRole(r)}
                style={{
                  flex: 1,
                  padding: "5px 6px", fontSize: 10,
                  textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600,
                  border: "none", borderRadius: 3, cursor: "pointer",
                  background: role === r ? "var(--fs-gold)" : "transparent",
                  color: role === r ? "var(--fs-navy-900)" : "rgba(255,255,255,0.6)",
                }}>
                {r}
              </button>
            ))}
          </div>
        )}
        <div className="sb-user" onClick={onLogout}>
          <Avatar name={user.name} size={32} />
          {!collapsed && <>
            <div className="meta">
              <div className="name">{user.name}</div>
              <div className="role">{roleLabel} · {user.team}</div>
            </div>
            <span className="chev" style={{ marginLeft: "auto", color: "rgba(255,255,255,0.4)" }}>
              <Icon name="logout" size={15} />
            </span>
          </>}
        </div>
      </div>
    </aside>
  );
}

// ============================================================
// Client switcher — pill + dropdown
// ============================================================
function ClientSwitcher({ clients, selected, onSelect }) {
  const [open, setOpen] = useStateShell(false);
  const wrapRef = useRefShell(null);

  useEffectShell(() => {
    const close = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  // When user has only one account (client role), render a static pill — no dropdown
  if (clients.length <= 1) {
    const single = selected;
    return (
      <div className="client-pill" style={{ cursor: "default" }}>
        <span className="swatch" style={{ background: single.color }}>{single.initials}</span>
        <span>{single.name.split(/[—·]/)[0].trim()}</span>
      </div>
    );
  }

  const isAll = selected.id === "all";

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button className={"client-pill " + (isAll ? "all" : "")} onClick={() => setOpen(o => !o)}>
        <span className="swatch" style={isAll ? {} : { background: selected.color }}>{selected.initials}</span>
        <span>{isAll ? "All Clients" : selected.name.split(/[—·]/)[0].trim()}</span>
        <Icon name={open ? "chevron-up" : "chevron-down"} size={13} />
      </button>
      {open && (
        <div className="client-pop">
          {clients.length > 1 && (
            <>
              <div className="head">Switch Client</div>
              {clients.filter(c => c.id === "all").map(c => (
                <button key={c.id} className={"row-item " + (selected.id === c.id ? "active" : "")} onClick={() => { onSelect(c.id); setOpen(false); }}>
                  <span style={{ width: 28, height: 28, borderRadius: "50%", background: c.color, color: "var(--fs-navy-900)", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700 }}>ALL</span>
                  <div style={{ flex: 1 }}>
                    <div className="nm">All Clients</div>
                    <div className="sub">Combined view across {clients.length - 1} accounts</div>
                  </div>
                  {selected.id === c.id && <Icon name="check" size={13} color="var(--fs-navy)" />}
                </button>
              ))}
              <div className="head">{clients.length - 1} retained accounts</div>
              {clients.filter(c => c.id !== "all").map(c => (
                <button key={c.id} className={"row-item " + (selected.id === c.id ? "active" : "")} onClick={() => { onSelect(c.id); setOpen(false); }}>
                  <span style={{ width: 28, height: 28, borderRadius: "50%", background: c.color, color: "var(--ks-on-ink)", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700 }}>{c.initials}</span>
                  <div style={{ flex: 1 }}>
                    <div className="nm">{c.name}</div>
                    <div className="sub">{c.type || c.account}</div>
                  </div>
                  {selected.id === c.id && <Icon name="check" size={13} color="var(--fs-navy)" />}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Top bar — client switcher, search, theme toggle, notifications
// ============================================================
function TopBar({ section, crumbs, role, theme, onToggleTheme, clients, selectedClient, onSelectClient, onNew }) {
  return (
    <header className="topbar">
      <div>
        {crumbs && <div className="crumbs">{crumbs}</div>}
        <h1 className="page-title">{section}</h1>
      </div>

      {/* Client switcher — to the right of the page title */}
      <div style={{ marginLeft: 12 }}>
        <ClientSwitcher clients={clients} selected={selectedClient} onSelect={onSelectClient} />
      </div>

      <div className="grow" />

      <div className="search">
        <Icon name="search" size={15} />
        <input placeholder="Search Keel — people, races, files…" />
        <span className="kbd">⌘K</span>
      </div>

      {role !== "client" && (
        <button className="btn primary" onClick={onNew}>
          <Icon name="plus" size={14} /> New Request
        </button>
      )}

      {/* Theme toggle */}
      <button className="theme-toggle" onClick={onToggleTheme} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
        <span className="knob">
          <Icon name={theme === "dark" ? "moon" : "sun"} size={12} />
        </span>
      </button>

      <button className="icon-btn" aria-label="Notifications">
        <Icon name="bell" size={16} /><span className="dot" />
      </button>
      <button className="icon-btn" aria-label="Settings">
        <Icon name="settings" size={16} />
      </button>
    </header>
  );
}

Object.assign(window, { Sidebar, TopBar, ClientSwitcher });
