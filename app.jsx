/* global React */
const { useState: useStateApp, useEffect: useEffectApp } = React;

// ============================================================
// Persistent preferences (localStorage)
// ============================================================
function usePref(key, defaultValue) {
  const [v, setV] = useStateApp(() => {
    try {
      const stored = localStorage.getItem("keel:" + key);
      return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch { return defaultValue; }
  });
  useEffectApp(() => {
    try { localStorage.setItem("keel:" + key, JSON.stringify(v)); } catch {}
  }, [key, v]);
  return [v, setV];
}

// ============================================================
// Client roster — the firm's book of business
// ============================================================
const CLIENTS = [
  { id: "all",     name: "All Clients",                tag: "ALL", initials: "ALL", account: "—",                                 color: "linear-gradient(135deg, var(--fs-navy) 0%, var(--fs-gold) 100%)" },
  { id: "aoki",    name: "Aoki for U.S. Senate",       tag: "AOKI", initials: "MA", account: "Aoki for Senate",                    type: "Federal · Senate",      color: "var(--fs-navy)" },
  { id: "harden",  name: "Harden for Congress · NJ-3", tag: "HARDEN", initials: "LH", account: "Harden for Congress (NJ-3)",      type: "Federal · House",       color: "var(--fs-navy-600)" },
  { id: "coastal", name: "Citizens for Coastal Renewal", tag: "COASTAL", initials: "CR", account: "Citizens for Coastal Renewal", type: "501(c)(4) · Advocacy",   color: "#2F6B4F" },
  { id: "okafor",  name: "Okafor — OH Secretary of State", tag: "OKAFOR", initials: "CO", account: "Okafor for SoS",               type: "State · Statewide",     color: "#7A5AE0" },
  { id: "hughes",  name: "Hughes for Governor (OH)",   tag: "HUGHES", initials: "RH", account: "Hughes for Governor",              type: "State · Statewide",     color: "#A8341E" },
  { id: "state",   name: "Public Affairs · State of OH contract", tag: "STATE", initials: "OH", account: "Public Affairs / state contract", type: "Government affairs", color: "var(--fs-gold-700)" },
  { id: "trade",   name: "Coastal Manufacturers Assoc.", tag: "CMA",  initials: "CM", account: "Coastal Manufacturers Assoc.",     type: "Trade association",     color: "var(--fs-bone)" },
  { id: "patel",   name: "Patel for OH-12 House",      tag: "PATEL", initials: "AP", account: "Patel for Congress (OH-12)",       type: "Federal · House",       color: "var(--fs-navy-300)" },
];

// Client access by role
function clientsForRole(role) {
  if (role === "client") return CLIENTS.filter(c => c.id === "aoki"); // single account
  return CLIENTS; // staff + admin see all + "all"
}

// ============================================================
// Module feature flags — admin-controlled, persisted
// All modules ON by default for staff/admin; client gets a curated subset.
// ============================================================
const ALL_MODULES = [
  { id: "home",         label: "Home",            mandatory: true },
  { id: "calendar",     label: "Calendar" },
  { id: "design",       label: "Design Requests" },
  { id: "proposals",    label: "Proposals" },
  { id: "media",        label: "Media Monitoring" },
  { id: "election",     label: "Election Night",  gated: true },
  { id: "voter",        label: "Voter Data",      staffOnly: true },
  { id: "polling",      label: "Polling" },
  { id: "stakeholders", label: "Stakeholders" },
  { id: "resources",    label: "Resources" },
  { id: "onboarding",   label: "Onboarding",      staffOnly: true },
];

const DEFAULT_MODULES = {
  staff:  { home: true, calendar: true, design: true, proposals: true, media: true, election: false, voter: true,  polling: true, stakeholders: true, resources: true, onboarding: true },
  admin:  { home: true, calendar: true, design: true, proposals: true, media: true, election: true,  voter: true,  polling: true, stakeholders: true, resources: true, onboarding: true },
  client: { home: true, calendar: true, design: true, proposals: false, media: false, election: false, voter: false, polling: true, stakeholders: false, resources: true, onboarding: false },
};

// Default tweakable state
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "collapsed": false,
  "chartBg": true
}/*EDITMODE-END*/;

function App() {
  // ---------- Auth & user identity ----------
  const [authed, setAuthed]     = useStateApp(false);
  const [user, setUser]         = useStateApp({ name: "Margaret Voss", team: "Public Affairs", role: "staff", email: "mvoss@fogsignal.co" });

  // ---------- Persistent prefs ----------
  const [theme, setTheme]       = usePref("theme", "light");        // light | dark
  const [clientId, setClientId] = usePref("client", "all");
  const [modules, setModules]   = usePref("modules:" + user.role, DEFAULT_MODULES[user.role]);

  // ---------- Session ----------
  const [section, setSection]   = useStateApp("home");
  const [t, setTweak]           = useTweaks(TWEAK_DEFAULTS);

  // Apply theme to root
  useEffectApp(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // When user role changes, reload that role's module set
  useEffectApp(() => {
    try {
      const raw = localStorage.getItem("keel:modules:" + user.role);
      setModules(raw ? JSON.parse(raw) : DEFAULT_MODULES[user.role]);
    } catch { setModules(DEFAULT_MODULES[user.role]); }
  }, [user.role]);

  // Client gets a single client filter automatically
  useEffectApp(() => {
    if (user.role === "client" && clientId !== "aoki") setClientId("aoki");
  }, [user.role]);

  const visibleModules = ALL_MODULES.filter(m =>
    (modules[m.id] || m.mandatory) && !(m.staffOnly && user.role === "client")
  );

  const handleLogin = (acct) => {
    setUser(acct);
    setAuthed(true);
  };

  const switchRole = (role) => {
    const accts = {
      staff:  { name: "Margaret Voss",  team: "Public Affairs",   role: "staff",  email: "mvoss@fogsignal.co" },
      admin:  { name: "Jonas Reiter",   team: "Operations",       role: "admin",  email: "jreiter@fogsignal.co" },
      client: { name: "Senator Aoki",   team: "Aoki for Senate",  role: "client", email: "campaign@aoki26.org" },
    };
    setUser(accts[role]);
    setSection("home");
  };

  if (!authed) return <LoginView onLogin={handleLogin} />;

  const titles = {
    home:         { title: user.role === "client" ? "Client Portal" : "Home" },
    calendar:     { title: "Calendar" },
    design:       { title: "Design Requests" },
    proposals:    { title: "Proposals" },
    media:        { title: "Media Monitoring" },
    election:     { title: "Election Night" },
    voter:        { title: "Voter Data" },
    polling:      { title: "Polling" },
    stakeholders: { title: "Stakeholders" },
    resources:    { title: "Resources" },
    onboarding:   { title: "Onboarding" },
    admin:        { title: "Admin Console" },
  };
  const pageInfo = titles[section] || titles.home;
  const noPad = section === "election";
  const chartBg = t.chartBg && !noPad;

  const selectedClient = CLIENTS.find(c => c.id === clientId) || CLIENTS[0];

  // Common props passed to all views — they can filter by clientId
  const viewProps = { user, role: user.role, clientId, client: selectedClient, onNavigate: setSection };

  return (
    <>
      <div className={"app" + (t.collapsed ? " collapsed" : "")}>
        <Sidebar
          active={section}
          onNavigate={setSection}
          collapsed={t.collapsed}
          onToggleCollapse={() => setTweak("collapsed", !t.collapsed)}
          role={user.role}
          user={user}
          onSwitchRole={switchRole}
          onLogout={() => setAuthed(false)}
          modules={visibleModules}
        />
        <main className="main" data-screen-label={"Keel · " + pageInfo.title}>
          <TopBar
            section={pageInfo.title}
            crumbs={"Keel" + (selectedClient.id === "all" ? "" : " · " + selectedClient.name)}
            role={user.role}
            theme={theme}
            onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}
            clients={clientsForRole(user.role)}
            selectedClient={selectedClient}
            onSelectClient={(id) => setClientId(id)}
            onNew={() => setSection(user.role === "client" ? "home" : "design")}
          />
          <div className={"content" + (noPad ? " no-pad" : "") + (chartBg ? " chart-bg" : "")}>
            {section === "home"         && <HomeView {...viewProps} />}
            {section === "calendar"     && <CalendarView {...viewProps} />}
            {section === "design"       && <DesignView {...viewProps} />}
            {section === "proposals"    && (user.role === "client" ? <ClientLockOut /> : <ProposalsView {...viewProps} />)}
            {section === "media"        && (user.role === "client" ? <ClientLockOut /> : <MediaView {...viewProps} />)}
            {section === "election"     && <ElectionView {...viewProps} />}
            {section === "voter"        && (user.role === "client" ? <ClientLockOut /> : <VoterView {...viewProps} />)}
            {section === "polling"      && <PollingView {...viewProps} />}
            {section === "stakeholders" && <StakeholdersView {...viewProps} />}
            {section === "resources"    && <ResourcesView {...viewProps} />}
            {section === "onboarding"   && (user.role === "client" ? <ClientLockOut /> : <OnboardingView {...viewProps} />)}
            {section === "admin"        && (user.role === "admin"  ? <AdminView modules={modules} onChangeModules={setModules} allRoles={DEFAULT_MODULES} /> : <ClientLockOut />)}
          </div>
        </main>
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Role">
          <TweakRadio
            label="View as"
            value={user.role}
            options={[
              { value: "staff",  label: "Staff" },
              { value: "admin",  label: "Admin" },
              { value: "client", label: "Client" },
            ]}
            onChange={switchRole}
          />
        </TweakSection>
        <TweakSection label="Appearance">
          <TweakRadio
            label="Theme"
            value={theme}
            options={[
              { value: "light", label: "Light" },
              { value: "dark",  label: "Dark" },
            ]}
            onChange={setTheme}
          />
          <TweakToggle
            label="Nautical chart background"
            value={t.chartBg}
            onChange={(v) => setTweak("chartBg", v)}
          />
          <TweakToggle
            label="Sidebar collapsed"
            value={t.collapsed}
            onChange={(v) => setTweak("collapsed", v)}
          />
        </TweakSection>
        <TweakSection label="Quick jump">
          {visibleModules.map(m => (
            <TweakButton key={m.id} label={m.label} onClick={() => setSection(m.id)} secondary={section !== m.id} />
          ))}
          {user.role === "admin" && (
            <TweakButton label="Admin Console" onClick={() => setSection("admin")} secondary={section !== "admin"} />
          )}
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

function ClientLockOut() {
  return (
    <div>
      <PageHead eyebrow="Restricted" title="Held for staff" sub="This area isn't part of your client portal. Your strategist will share anything you need from it." />
      <div className="card card-pad" style={{ display: "flex", alignItems: "center", gap: 16, maxWidth: 480 }}>
        <Icon name="lock" size={20} color="var(--fs-navy)" />
        <div className="mut" style={{ fontSize: 13 }}>If you think you should have access, contact your senior strategist.</div>
      </div>
    </div>
  );
}

// Make modules/clients available globally so views can read them without prop drilling
window.KEEL_CLIENTS = CLIENTS;
window.KEEL_MODULES = ALL_MODULES;
window.KEEL_DEFAULT_MODULES = DEFAULT_MODULES;

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
