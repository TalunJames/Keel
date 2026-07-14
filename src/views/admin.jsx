import React, { useEffect, useRef, useState } from "react";
import { PageHead, Icon } from "../components/ui.jsx";
import { api, loginAnnouncementApi } from "../lib/api.js";
import { useApi } from "../lib/useApi.js";
import { AdminUsersTab } from "./admin-users.jsx";
import { AdminModulesTab } from "./admin-modules.jsx";
import { AdminClientsTab } from "./admin-clients.jsx";
import { AdminIntegrationsTab } from "./admin-integrations.jsx";

export function AdminView({ user, modules, onChangeModules, allRoles }) {
  const isSystemAdmin = !!user?.systemAdmin;
  const [tab, setTab] = useState("users");
  const { data: usersData, loading: usersLoading, reload: reloadUsers } = useApi("/admin/users");
  const { data: clientsData, loading: clientsLoading, reload: reloadClients } = useApi("/admin/clients");
  const { data: auditData, reload: reloadAudit } = useApi("/admin/audit");

  const [voterForm, setVoterForm] = useState({ clientId: "", source: "", recordCount: "" });
  const [announceForm, setAnnounceForm] = useState({ title: "", body: "", tag: "" });
  const [loginAnn, setLoginAnn] = useState({ enabled: false, title: "", body: "", tone: "info" });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!isSystemAdmin) return;
    loginAnnouncementApi.get()
      .then((r) => r?.announcement && setLoginAnn(r.announcement))
      .catch(() => {});
  }, [isSystemAdmin]);

  // Track the timer so back-to-back flashes don't get wiped early by the
  // previous message's timeout.
  const flashTimer = useRef(null);
  const flash = (m) => {
    setMsg(m);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setMsg(null), 3000);
  };

  const saveLoginAnnouncement = async (e) => {
    e.preventDefault();
    try {
      const { announcement } = await loginAnnouncementApi.set(loginAnn);
      setLoginAnn(announcement);
      reloadAudit();
      flash("Login announcement updated");
    } catch (err) {
      flash(err?.message || "Could not update login announcement");
    }
  };

  const registerVoterFile = async (e) => {
    e.preventDefault();
    try {
      await api("/admin/voter-files", {
        method: "POST",
        body: JSON.stringify({
          clientId: voterForm.clientId,
          source: voterForm.source,
          recordCount: Number(voterForm.recordCount) || 0,
        }),
      });
      setVoterForm({ clientId: "", source: "", recordCount: "" });
      reloadAudit();
      flash("Voter file registered");
    } catch (err) {
      flash(err?.message || "Could not register voter file");
    }
  };

  const postAnnouncement = async (e) => {
    e.preventDefault();
    try {
      await api("/admin/announcements", {
        method: "POST",
        body: JSON.stringify({ title: announceForm.title, body: announceForm.body, tag: announceForm.tag, audience: ["staff", "admin", "client"] }),
      });
      setAnnounceForm({ title: "", body: "", tag: "" });
      reloadAudit();
      flash("Announcement posted");
    } catch (err) {
      flash(err?.message || "Could not post announcement");
    }
  };

  return (
    <div>
      <PageHead title="Admin Console" sub="Users, clients, voter files, and workspace settings." />
      {msg && (
        <div className="card card-pad" style={{
          // Float as a toast so appearing/disappearing never shifts the page.
          position: "fixed", top: 76, right: 24, zIndex: 1000, maxWidth: 420,
          fontSize: 13, color: "var(--fs-navy)",
          display: "flex", alignItems: "center", gap: 8,
          borderColor: "var(--fs-gold)", background: "var(--fs-bone-50)",
          boxShadow: "0 8px 24px rgba(16, 42, 67, 0.18)",
        }}>
          <Icon name="check" size={14} color="var(--fs-gold-700)" />
          {msg}
        </div>
      )}

      <div className="row" style={{ gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { id: "users", label: "Users" },
          { id: "clients", label: "Clients" },
          { id: "voter", label: "Voter" },
          { id: "announce", label: "Announce" },
          { id: "modules", label: "Modules" },
          ...(isSystemAdmin ? [{ id: "login", label: "Login Screen" }, { id: "integrations", label: "Integrations" }] : []),
          { id: "audit", label: "Audit" },
        ].map((t) => (
          <button key={t.id} type="button" className={"btn " + (tab === t.id ? "primary" : "secondary")} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <AdminUsersTab
          user={user}
          users={usersData?.users}
          usersLoading={usersLoading}
          clients={clientsData?.clients || []}
          isSystemAdmin={isSystemAdmin}
          onReload={() => { reloadUsers(); reloadAudit(); }}
          onFlash={flash}
        />
      )}

      {tab === "login" && isSystemAdmin && (
        <form className="card card-pad col" onSubmit={saveLoginAnnouncement} style={{ gap: 12, maxWidth: 620 }}>
          <h3 style={{ margin: 0, color: "var(--fs-navy)" }}>Login screen announcement</h3>
          <p className="mut" style={{ fontSize: 13, margin: 0 }}>
            Shown to every user on the sign-in page. Only system admins can edit this.
          </p>
          <label className="row" style={{ gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={!!loginAnn.enabled}
              onChange={(e) => setLoginAnn({ ...loginAnn, enabled: e.target.checked })} />
            Show on login page
          </label>
          <div className={"col" + (!loginAnn.enabled ? " disabled-fields" : "")} style={{ gap: 12 }}>
            <div className="field" style={{ margin: 0 }}>
              <label>Title</label>
              <input className="input" placeholder="Welcome to Keel" maxLength={120} disabled={!loginAnn.enabled}
                value={loginAnn.title} onChange={(e) => setLoginAnn({ ...loginAnn, title: e.target.value })} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Body</label>
              <textarea className="input" rows={3} maxLength={600} disabled={!loginAnn.enabled}
                value={loginAnn.body} onChange={(e) => setLoginAnn({ ...loginAnn, body: e.target.value })} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Tone</label>
              <select className="input" value={loginAnn.tone} disabled={!loginAnn.enabled}
                onChange={(e) => setLoginAnn({ ...loginAnn, tone: e.target.value })}>
                <option value="info">Info (navy)</option>
                <option value="warning">Warning (gold)</option>
                <option value="success">Success (green)</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn primary" style={{ alignSelf: "flex-start" }}>
            <Icon name="check" size={13} /> Save login announcement
          </button>
        </form>
      )}

      {tab === "integrations" && isSystemAdmin && (
        <AdminIntegrationsTab onFlash={flash} />
      )}

      {tab === "clients" && (
        <AdminClientsTab
          clients={clientsData?.clients || []}
          loading={clientsLoading}
          onReload={() => { reloadClients(); reloadAudit(); }}
          onFlash={flash}
        />
      )}

      {tab === "voter" && (
        <form className="card card-pad col" onSubmit={registerVoterFile} style={{ gap: 12, maxWidth: 480 }}>
          <h3 style={{ margin: 0, color: "var(--fs-navy)" }}>Register voter file</h3>
          <p className="mut" style={{ fontSize: 13, margin: 0 }}>After TargetSmart ingest completes on the server, register metadata here so the explorer shows counts.</p>
          <div className="field" style={{ margin: 0 }}>
            <label>Client</label>
            <select className="input" required value={voterForm.clientId}
              onChange={(e) => setVoterForm({ ...voterForm, clientId: e.target.value })}>
              <option value="">Select a client…</option>
              {(clientsData?.clients || []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Source</label>
            <input className="input" placeholder="e.g. TargetSmart 2026-05-19" required value={voterForm.source} onChange={(e) => setVoterForm({ ...voterForm, source: e.target.value })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Record count</label>
            <input className="input" type="number" min="0" placeholder="0" value={voterForm.recordCount} onChange={(e) => setVoterForm({ ...voterForm, recordCount: e.target.value })} />
          </div>
          <button type="submit" className="btn primary" style={{ alignSelf: "flex-start" }}>
            <Icon name="check" size={13} /> Register file
          </button>
        </form>
      )}

      {tab === "announce" && (
        <form className="card card-pad col" onSubmit={postAnnouncement} style={{ gap: 12, maxWidth: 560 }}>
          <h3 style={{ margin: 0, color: "var(--fs-navy)" }}>Post announcement</h3>
          <p className="mut" style={{ fontSize: 13, margin: 0 }}>Shown on every user's home dashboard — staff, admins, and clients.</p>
          <div className="field" style={{ margin: 0 }}>
            <label>Title</label>
            <input className="input" placeholder="e.g. Office closed Friday" required value={announceForm.title} onChange={(e) => setAnnounceForm({ ...announceForm, title: e.target.value })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Body</label>
            <textarea className="input" rows={4} required value={announceForm.body} onChange={(e) => setAnnounceForm({ ...announceForm, body: e.target.value })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Tag <span className="mut" style={{ fontWeight: 400 }}>(optional)</span></label>
            <input className="input" placeholder="e.g. Operations" value={announceForm.tag} onChange={(e) => setAnnounceForm({ ...announceForm, tag: e.target.value })} />
          </div>
          <button type="submit" className="btn primary" style={{ alignSelf: "flex-start" }}>
            <Icon name="check" size={13} /> Publish announcement
          </button>
        </form>
      )}

      {tab === "modules" && (
        <AdminModulesTab allRoles={allRoles} user={user} onFlash={flash} />
      )}

      {tab === "audit" && (
        <div className="card">
          <table className="tbl">
            <thead><tr><th>Who</th><th>What</th><th>When</th></tr></thead>
            <tbody>
              {(auditData?.items || []).map((a, i) => (
                <tr key={i}><td>{a.who}</td><td>{a.what}</td><td className="mut">{a.at}</td></tr>
              ))}
              {!(auditData?.items || []).length && (
                <tr><td colSpan={3} className="mut" style={{ textAlign: "center", padding: 24 }}>No admin activity recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
