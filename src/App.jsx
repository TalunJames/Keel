import React, { useState, useEffect } from "react";
import { authApi, clientsApi, modulesApi, badgesApi, api, withClient } from "./lib/api.js";
import { usePref } from "./lib/usePref.js";
import { ALL_MODULES } from "./lib/modules.js";
import { Sidebar, TopBar } from "./components/shell.jsx";
import { PageHead, Icon } from "./components/ui.jsx";
import { LoginView } from "./views/login.jsx";
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

export default function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [clients, setClients] = useState([]);
  const [modules, setModules] = useState(DEFAULT_MODULES_FALLBACK.staff);
  const [badges, setBadges] = useState({});
  const [announcements, setAnnouncements] = useState([]);
  const [theme, setTheme] = usePref("theme", "light");
  const [collapsed, setCollapsed] = usePref("collapsed", false);
  const [clientId, setClientId] = usePref("client", "all");
  const [section, setSection] = useState("home");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    authApi.me()
      .then(({ user: u }) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setBooting(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    clientsApi.list().then((r) => {
      const list = r.clients || [];
      setClients(list);
      if (user.role === "client" && list[0]) setClientId(list[0].id);
    });
    modulesApi.get().then((r) => setModules(r.modules || DEFAULT_MODULES_FALLBACK[user.role]));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    badgesApi.get(clientId).then(setBadges).catch(() => setBadges({}));
    api(withClient("/home", clientId))
      .then((r) => setAnnouncements(r?.announcements || []))
      .catch(() => setAnnouncements([]));
  }, [user, clientId]);

  const handleLogin = (u) => {
    setUser(u);
    setSection("home");
  };

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    setUser(null);
  };

  if (booting) {
    return <div style={{ display: "grid", placeItems: "center", height: "100vh", color: "var(--fs-fg-muted)" }}>Loading…</div>;
  }

  if (!user) return <LoginView onLogin={handleLogin} />;

  const visibleModules = ALL_MODULES.filter(
    (m) => (modules[m.id] || m.mandatory) && !(m.staffOnly && user.role === "client")
  );

  const selectedClient = clients.find((c) => c.id === clientId) || clients[0] || { id: "all", name: "All Clients", initials: "ALL", color: "var(--fs-navy)" };

  const viewProps = {
    user,
    role: user.role,
    clientId: selectedClient?.id || "all",
    client: selectedClient,
    onNavigate: setSection,
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
  };

  const electionBadges = {};
  if (badges.election) electionBadges.election = badges.election;
  if (badges.design) electionBadges.design = badges.design;
  if (badges.media) electionBadges.media = badges.media;

  return (
    <div className={"app" + (collapsed ? " collapsed" : "")}>
      <Sidebar
        active={section}
        onNavigate={setSection}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        role={user.role}
        user={user}
        onLogout={handleLogout}
        modules={visibleModules}
        badges={electionBadges}
        theme={theme}
        onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}
      />
      <main className="main" data-screen-label={"Keel · " + (titles[section] || "Home")}>
        <TopBar
          section={titles[section] || "Home"}
          crumbs={"Keel" + (selectedClient?.id && selectedClient.id !== "all" ? " · " + selectedClient.name : "")}
          role={user.role}
          clients={clients}
          selectedClient={selectedClient}
          onSelectClient={setClientId}
          onNew={() => setSection(user.role === "client" ? "home" : "design")}
          announcements={announcements}
        />
        <div className={"content" + (section === "election" ? " no-pad" : "") + (section !== "election" ? " chart-bg" : "")}>
          {section === "home" && <HomeView {...viewProps} />}
          {section === "calendar" && <CalendarView {...viewProps} />}
          {section === "design" && <DesignView {...viewProps} />}
          {section === "proposals" && (user.role === "client" ? <ClientLockOut /> : <ProposalsView {...viewProps} />)}
          {section === "media" && (user.role === "client" ? <ClientLockOut /> : <MediaView {...viewProps} />)}
          {section === "election" && <ElectionView {...viewProps} />}
          {section === "voter" && (user.role === "client" ? <ClientLockOut /> : <VoterView {...viewProps} />)}
          {section === "polling" && <PollingView {...viewProps} />}
          {section === "stakeholders" && (user.role === "client" ? <ClientLockOut /> : <StakeholdersView {...viewProps} />)}
          {section === "resources" && <ResourcesView {...viewProps} />}
          {section === "onboarding" && (user.role === "client" ? <ClientLockOut /> : <OnboardingView {...viewProps} />)}
          {section === "admin" && (user.role === "admin" ? (
            <AdminView user={user} modules={modules} onChangeModules={setModules} allRoles={DEFAULT_MODULES_FALLBACK} />
          ) : <ClientLockOut />)}
          {section === "account" && <AccountView user={user} onUserUpdate={setUser} />}
        </div>
      </main>
    </div>
  );
}
