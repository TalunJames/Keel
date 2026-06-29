import React, { useEffect, useState } from "react";
import { PageHead, Icon } from "../components/ui.jsx";
import { api, loginAnnouncementApi } from "../lib/api.js";
import { useApi } from "../lib/useApi.js";
import { Loading } from "../components/Loading.jsx";
import { AdminUsersTab } from "./admin-users.jsx";
import { AdminModulesTab } from "./admin-modules.jsx";

export function AdminView({ user, modules, onChangeModules, allRoles }) {
  const isSystemAdmin = !!user?.systemAdmin;
  const [tab, setTab] = useState("users");
  const { data: usersData, loading: usersLoading, reload: reloadUsers } = useApi("/admin/users");
  const { data: clientsData, loading: clientsLoading, reload: reloadClients } = useApi("/admin/clients");
  const { data: auditData, reload: reloadAudit } = useApi("/admin/audit");

  const [clientForm, setClientForm] = useState({ id: "", name: "", tag: "", initials: "", account: "", type: "" });
  const [voterForm, setVoterForm] = useState({ clientId: "", source: "", recordCount: "" });
  const [announceForm, setAnnounceForm] = useState({ title: "", body: "", tag: "" });
  const [loginAnn, setLoginAnn] = useState({ enabled: true, title: "", body: "", tone: "info" });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!isSystemAdmin) return;
    loginAnnouncementApi.get()
      .then((r) => r?.announcement && setLoginAnn(r.announcement))
      .catch(() => {});
  }, [isSystemAdmin]);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(null), 3000); };

  const saveLoginAnnouncement = async (e) => {
    e.preventDefault();
    const { announcement } = await loginAnnouncementApi.set(loginAnn);
    setLoginAnn(announcement);
    reloadAudit();
    flash("Login announcement updated");
  };

  const createClient = async (e) => {
    e.preventDefault();
    await api("/admin/clients", { method: "POST", body: JSON.stringify(clientForm) });
    setClientForm({ id: "", name: "", tag: "", initials: "", account: "", type: "" });
    reloadClients();
    reloadAudit();
    flash("Client created");
  };

  const registerVoterFile = async (e) => {
    e.preventDefault();
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
  };

  const postAnnouncement = async (e) => {
    e.preventDefault();
    await api("/admin/announcements", {
      method: "POST",
      body: JSON.stringify({ title: announceForm.title, body: announceForm.body, tag: announceForm.tag, audience: ["staff", "admin", "client"] }),
    });
    setAnnounceForm({ title: "", body: "", tag: "" });
    reloadAudit();
    flash("Announcement posted");
  };

  return (
    <div>
      <PageHead eyebrow="Administration" title="Admin Console" sub="Users, clients, voter files, and workspace settings." />
      {msg && (
        <div className="card card-pad" style={{
          marginBottom: 16, fontSize: 13, color: "var(--fs-navy)",
          display: "flex", alignItems: "center", gap: 8,
          borderColor: "var(--fs-gold)", background: "var(--fs-bone-50)",
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
          ...(isSystemAdmin ? [{ id: "login", label: "Login Screen" }] : []),
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
          <div className="field" style={{ margin: 0 }}>
            <label>Title</label>
            <input className="input" placeholder="Welcome to Keel" maxLength={120}
              value={loginAnn.title} onChange={(e) => setLoginAnn({ ...loginAnn, title: e.target.value })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Body</label>
            <textarea className="input" rows={3} maxLength={600}
              value={loginAnn.body} onChange={(e) => setLoginAnn({ ...loginAnn, body: e.target.value })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Tone</label>
            <select className="input" value={loginAnn.tone}
              onChange={(e) => setLoginAnn({ ...loginAnn, tone: e.target.value })}>
              <option value="info">Info (navy)</option>
              <option value="warning">Warning (gold)</option>
              <option value="success">Success (green)</option>
            </select>
          </div>
          <button type="submit" className="btn primary" style={{ alignSelf: "flex-start" }}>
            <Icon name="check" size={13} /> Save login announcement
          </button>
        </form>
      )}

      {tab === "clients" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <form className="card card-pad col" onSubmit={createClient} style={{ gap: 10 }}>
            <h3 style={{ margin: 0, color: "var(--fs-navy)" }}>Add client</h3>
            <input className="input" placeholder="id (slug)" required value={clientForm.id} onChange={(e) => setClientForm({ ...clientForm, id: e.target.value })} />
            <input className="input" placeholder="Display name" required value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })} />
            <input className="input" placeholder="Tag" required value={clientForm.tag} onChange={(e) => setClientForm({ ...clientForm, tag: e.target.value })} />
            <input className="input" placeholder="Initials" required value={clientForm.initials} onChange={(e) => setClientForm({ ...clientForm, initials: e.target.value })} />
            <input className="input" placeholder="Account label" value={clientForm.account} onChange={(e) => setClientForm({ ...clientForm, account: e.target.value })} />
            <input className="input" placeholder="Type" value={clientForm.type} onChange={(e) => setClientForm({ ...clientForm, type: e.target.value })} />
            <button type="submit" className="btn primary">Create client</button>
          </form>
          <div className="card">
            {clientsLoading ? <Loading /> : (
              <table className="tbl">
                <thead><tr><th>Client</th><th>Tag</th></tr></thead>
                <tbody>
                  {(clientsData?.clients || []).map((c) => (
                    <tr key={c.id}><td>{c.name}</td><td className="mut">{c.tag}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === "voter" && (
        <form className="card card-pad col" onSubmit={registerVoterFile} style={{ gap: 10, maxWidth: 480 }}>
          <h3 style={{ margin: 0, color: "var(--fs-navy)" }}>Register voter file</h3>
          <p className="mut" style={{ fontSize: 13, margin: 0 }}>After TargetSmart ingest completes on the server, register metadata here so the explorer shows counts.</p>
          <input className="input" placeholder="Client id" required value={voterForm.clientId} onChange={(e) => setVoterForm({ ...voterForm, clientId: e.target.value })} />
          <input className="input" placeholder="Source (e.g. TargetSmart 2026-05-19)" required value={voterForm.source} onChange={(e) => setVoterForm({ ...voterForm, source: e.target.value })} />
          <input className="input" type="number" placeholder="Record count" value={voterForm.recordCount} onChange={(e) => setVoterForm({ ...voterForm, recordCount: e.target.value })} />
          <button type="submit" className="btn primary">Register file</button>
        </form>
      )}

      {tab === "announce" && (
        <form className="card card-pad col" onSubmit={postAnnouncement} style={{ gap: 10, maxWidth: 560 }}>
          <h3 style={{ margin: 0, color: "var(--fs-navy)" }}>Post announcement</h3>
          <input className="input" placeholder="Title" required value={announceForm.title} onChange={(e) => setAnnounceForm({ ...announceForm, title: e.target.value })} />
          <textarea className="input" rows={4} placeholder="Body" required value={announceForm.body} onChange={(e) => setAnnounceForm({ ...announceForm, body: e.target.value })} />
          <input className="input" placeholder="Tag" value={announceForm.tag} onChange={(e) => setAnnounceForm({ ...announceForm, tag: e.target.value })} />
          <button type="submit" className="btn primary">Publish</button>
        </form>
      )}

      {tab === "modules" && (
        <AdminModulesTab allRoles={allRoles} onFlash={flash} />
      )}

      {tab === "audit" && (
        <div className="card">
          <table className="tbl">
            <thead><tr><th>Who</th><th>What</th><th>When</th></tr></thead>
            <tbody>
              {(auditData?.items || []).map((a, i) => (
                <tr key={i}><td>{a.who}</td><td>{a.what}</td><td className="mut">{a.at}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
