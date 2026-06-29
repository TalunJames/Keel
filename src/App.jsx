import React, { useState, useEffect, useMemo } from "react";
import { authApi, clientsApi, modulesApi, badgesApi, api, withClient, setupApi } from "./lib/api.js";
import { usePref } from "./lib/usePref.js";
import { ALL_MODULES } from "./lib/modules.js";
import { computeEffectiveModules, visibleModuleList, canAccessModule } from "./lib/access.js";
import { Sidebar, TopBar } from "./components/shell.jsx";
import { PageHead, Icon } from "./components/ui.jsx";
import { LoginView } from "./views/login.jsx";
import { SetupView } from "./views/setup.jsx";
import { HomeView } from "./views/home.jsx";
import { CalendarView } from "./views/calendar.jsx";
import { DesignView } from "./views/design.jsx";
import { ProposalsView } from "./views/proposals.jsx";
import { MediaView } from "./views/media.jsx";
import { ElectionView } from "./views/election.jsx";
import { VoterView } from "./views/voter.jsx";
import { PollingView } from "./views/polling.jsx";
import { StakeholdersView } from "./views/stakeholders.jsx";
import { ResourcesView } from "./views/resources.jsx";
import { OnboardingView } from "./views/onboarding.jsx";
import { AdminView } from "./views/admin.jsx";
import { AccountView } from "./views/account.jsx";
import { NewClientWizard } from "./views/new-client-wizard.jsx";

const DEFAULT_MODULES_FALLBACK = {
  staff: { home: true, calendar: true, design: true, proposals: true, media: true, election: false, voter: true, polling: true, stakeholders: true, resources: true, onboarding: true },
  admin: { home: true, calendar: true, design: true, proposals: true, media: true, election: true, voter: true, polling: true, stakeholders: true, resources: true, onboarding: true },
  client: { home: true, calendar: true, design: true, proposals: false, media: false, election: false, voter: false, polling: true, stakeholders: false, resources: true, onboarding: false },
};

function ClientLockOut() {
  return (
    <div>
      <PageHead eyebrow="Restricted" title="Held for staff" sub="This area isn't part of your client portal." />
      <div className="card card-pad" style={{ display: "flex", alignItems: "center", gap: 16, maxWidth: 480 }}>
        <Icon name="lock" size={20} color="var(--fs-navy)" />
        <div className="mut" style={{ fontSize: 13 }}>Contact your senior strategist if you need access.</div>
      </div>
    </div>
  );
}

function ModuleLockOut({ clientName }) {
  return (
    <div>
      <PageHead eyebrow="Restricted" title="Not enabled for this client" sub={clientName ? `${clientName} doesn't include this workspace tab.` : "This tab isn't enabled for the selected client."} />
      <div className="card card-pad" style={{ display: "flex", alignItems: "center", gap: 16, maxWidth: 480 }}>
        <Icon name="lock" size={20} color="var(--fs-navy)" />
        <div className="mut" style={{ fontSize: 13 }}>Switch clients or ask an admin if you need access here.</div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [setup, setSetup] = useState(null);
  const [booting, setBooting] = useState(true);
  const [clients, setClients] = useState([]);
  const [roleModules, setRoleModules] = useState(DEFAULT_MODULES_FALLBACK.staff);
  const [userOverrides, setUserOverrides] = useState({});
  const [badges, setBadges] = useState({});
  const [announcements, setAnnouncements] = useState([]);
  const [theme, setTheme] = usePref("theme", "light");
  const [clientId, setClientId] = usePref("client", "all");
  const [section, setSection] = useState("home");
  const [designInitialTab, setDesignInitialTab] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    Promise.all([
      setupApi.status().catch(() => ({ needsSetup: false })),
      authApi.me().catch(() => null),
    ]).then(async ([status, session]) => {
      setSetup(status);
      if (status.needsSetup) {
        setUser(null);
        try { await authApi.logout(); } catch { /* ignore */ }
      } else if (session?.user) {
        setUser(session.user);
      }
    }).finally(() => setBooting(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    clientsApi.list().then((r) => {
      const list = r.clients || [];
      setClients(list);
      if (user.role === "client" && list[0]) setClientId(list[0].id);
    });
    modulesApi.get(clientId).then((r) => {
      setRoleModules(r.modules || DEFAULT_MODULES_FALLBACK[user.role]);
      setUserOverrides(r.overrides || {});
    }).catch(() => {
      setRoleModules(DEFAULT_MODULES_FALLBACK[user.role]);
      setUserOverrides({});
    });
  }, [user]);

  useEffect(() => {
    if (!user || !clients.length) return;
    const ids = new Set(clients.map((c) => c.id));
    if (clientId !== "all" && !ids.has(clientId)) {
      const fallback = clients.find((c) => c.id !== "all")?.id || "all";
      setClientId(fallback);
    }
  }, [clients, clientId, user]);

  useEffect(() => {
    if (!user) return;
    modulesApi.get(clientId).then((r) => {
      if (r.modules) setRoleModules(r.modules);
      if (r.overrides) setUserOverrides(r.overrides);
    }).catch(() => {});
  }, [user, clientId]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId) || clients[0] || { id: "all", name: "All Clients", initials: "ALL", color: "var(--fs-navy)" },
    [clients, clientId]
  );

  const effectiveModules = useMemo(() => computeEffectiveModules({
    role: user?.role,
    roleModules,
    client: selectedClient,
    userOverrides: userOverrides[selectedClient?.id] || null,
  }), [user?.role, roleModules, selectedClient, userOverrides]);

  const visibleModules = useMemo(
    () => (user ? visibleModuleList(effectiveModules, user.role) : []),
    [effectiveModules, user]
  );

  useEffect(() => {
    if (!user) return;
    const workspaceSections = ALL_MODULES.map((m) => m.id);
    if (!workspaceSections.includes(section)) return;
    if (!canAccessModule(section, effectiveModules, user.role)) {
      setSection("home");
    }
  }, [clientId, effectiveModules, section, user]);

  useEffect(() => {
    if (!user) return;
    badgesApi.get(clientId).then(setBadges).catch(() => setBadges({}));
    api(withClient("/home", clientId))
      .then((r) => setAnnouncements(r?.announcements || []))
      .catch(() => setAnnouncements([]));
  }, [user, clientId]);

  const handleLogin = (u) => {
    setUser(u);
    setSetup({ needsSetup: false });
    setSection("home");
  };

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    setUser(null);
  };

  if (booting) {
    return <div style={{ display: "grid", placeItems: "center", height: "100vh", color: "var(--fs-fg-muted)" }}>Loading…</div>;
  }

  if (setup?.needsSetup) {
    return <SetupView setup={setup} onComplete={handleLogin} />;
  }

  if (!user) return <LoginView onLogin={handleLogin} />;

  const viewProps = {
    user,
    role: user.role,
    clientId: selectedClient?.id || "all",
    client: selectedClient,
    onNavigate: setSection,
  };

  const guardModule = (moduleId, content) => {
    if (!canAccessModule(moduleId, effectiveModules, user.role)) {
      return <ModuleLockOut clientName={selectedClient?.id !== "all" ? selectedClient?.name : null} />;
    }
    return content;
  };

  const titles = {
    home: user.role === "client" ? "Client Portal" : "Home",
    calendar: "Calendar",
    design: "Design Requests",
    proposals: "Proposals",
    media: "Media Monitoring",
    election: "Election Night",
    voter: "Voter Data",
    polling: "Polling",
    stakeholders: "Stakeholders",
    resources: "Resources",
    onboarding: "Onboarding",
    admin: "Admin Console",
    account: "Account Settings",
    "new-client": "New Client",
  };

  const handleNewAction = (action) => {
    if (action === "client") setSection("new-client");
    else if (action === "design") {
      setDesignInitialTab(user.role === "client" ? null : "new");
      setSection("design");
    }
    else if (action === "proposals") setSection("proposals");
    else if (action === "calendar") setSection("calendar");
  };

  const reloadClients = () => {
    clientsApi.list().then((r) => setClients(r.clients || [])).catch(() => {});
  };

  const handleClientCreated = (id) => {
    reloadClients();
    if (id) setClientId(id);
    setSection("home");
  };

  const electionBadges = {};
  if (badges.election) electionBadges.election = badges.election;
  if (badges.design) electionBadges.design = badges.design;
  if (badges.media) electionBadges.media = badges.media;

  return (
    <div className="app">
      <Sidebar
        active={section}
        onNavigate={setSection}
        role={user.role}
        user={user}
        onLogout={handleLogout}
        modules={visibleModules}
        badges={electionBadges}
        theme={theme}
        onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}
      />
      <main className={"main" + (section === "election" ? " election-immersive" : "")} data-screen-label={"Keel · " + (titles[section] || "Home")}>
        {section !== "election" && (
          <TopBar
            section={titles[section] || "Home"}
            crumbs={"Keel" + (selectedClient?.id && selectedClient.id !== "all" ? " · " + selectedClient.name : "")}
            role={user.role}
            clients={clients}
            selectedClient={selectedClient}
            onSelectClient={setClientId}
            onNewAction={handleNewAction}
            announcements={announcements}
          />
        )}
        <div className={"content" + (section === "election" ? " no-pad" : "") + (section !== "election" ? " chart-bg" : "")}>
          {section === "home" && guardModule("home", <HomeView {...viewProps} />)}
          {section === "calendar" && guardModule("calendar", <CalendarView {...viewProps} />)}
          {section === "design" && guardModule("design", (
            <DesignView
              {...viewProps}
              initialTab={designInitialTab}
              onNavigate={(s) => { setDesignInitialTab(null); setSection(s); }}
            />
          ))}
          {section === "proposals" && guardModule("proposals", user.role === "client" ? <ClientLockOut /> : <ProposalsView {...viewProps} />)}
          {section === "media" && guardModule("media", user.role === "client" ? <ClientLockOut /> : <MediaView {...viewProps} />)}
          {section === "election" && guardModule("election", <ElectionView {...viewProps} />)}
          {section === "voter" && guardModule("voter", user.role === "client" ? <ClientLockOut /> : <VoterView {...viewProps} />)}
          {section === "polling" && guardModule("polling", <PollingView {...viewProps} />)}
          {section === "stakeholders" && guardModule("stakeholders", user.role === "client" ? <ClientLockOut /> : <StakeholdersView {...viewProps} />)}
          {section === "resources" && guardModule("resources", <ResourcesView {...viewProps} />)}
          {section === "onboarding" && guardModule("onboarding", user.role === "client" ? <ClientLockOut /> : <OnboardingView {...viewProps} />)}
          {section === "admin" && (user.role === "admin" ? (
            <AdminView user={user} modules={roleModules} onChangeModules={setRoleModules} allRoles={DEFAULT_MODULES_FALLBACK} />
          ) : <ClientLockOut />)}
          {section === "account" && <AccountView user={user} onUserUpdate={setUser} />}
          {section === "new-client" && (user.role === "admin" ? (
            <NewClientWizard onCancel={() => setSection("home")} onCreated={handleClientCreated} />
          ) : <ClientLockOut />)}
        </div>
      </main>
    </div>
  );
}
