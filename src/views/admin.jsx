import React, { useState } from "react";
import { PageHead, Icon } from "../components/ui.jsx";
import { api } from "../lib/api.js";
import { useApi } from "../lib/useApi.js";
import { Loading } from "../components/Loading.jsx";
import { ALL_MODULES } from "../lib/modules.js";
import { modulesApi } from "../lib/api.js";

export function AdminView({ modules, onChangeModules, allRoles }) {
  const [tab, setTab] = useState("users");
  const { data: usersData, loading: usersLoading, reload: reloadUsers } = useApi("/admin/users");
  const { data: clientsData, loading: clientsLoading, reload: reloadClients } = useApi("/admin/clients");
  const { data: auditData, reload: reloadAudit } = useApi("/admin/audit");

  const [userForm, setUserForm] = useState({ email: "", password: "", name: "", team: "", role: "staff", clientId: "" });
  const [clientForm, setClientForm] = useState({ id: "", name: "", tag: "", initials: "", account: "", type: "" });
  const [voterForm, setVoterForm] = useState({ clientId: "", source: "", recordCount: "" });
  const [announceForm, setAnnounceForm] = useState({ title: "", body: "", tag: "" });
  const [msg, setMsg] = useState("");

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(null), 3000); };

  const createUser = async (e) => {
    e.preventDefault();
    await api("/admin/users", { method: "POST", body: JSON.stringify(userForm) });
    setUserForm({ email: "", password: "", name: "", team: "", role: "staff", clientId: "" });
    reloadUsers();
    reloadAudit();
    flash("User created");
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

  const [roleModules, setRoleModules] = useState(allRoles || {});

  const saveModules = async (role) => {
    await modulesApi.set(role, roleModules[role] || allRoles[role]);
    flash("Module settings saved for " + role);
  };

  return (
    <div>
      <PageHead eyebrow="Administration" title="Admin Console" sub="Users, clients, voter files, and workspace settings." />
      {msg && <div className="card card-pad" style={{ marginBottom: 16, fontSize: 13, color: "var(--fs-navy)" }}>{msg}</div>}

      <div className="row" style={{ gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {["users", "clients", "voter", "announce", "modules", "audit"].map((t) => (
          <button key={t} type="button" className={"btn " + (tab === t ? "primary" : "secondary")} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <form className="card card-pad col" onSubmit={createUser} style={{ gap: 10 }}>
            <h3 style={{ margin: 0, color: "var(--fs-navy)" }}>Add user</h3>
            <input className="input" placeholder="Email" required value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
            <input className="input" type="password" placeholder="Password" required value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
            <input className="input" placeholder="Full name" required value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} />
            <input className="input" placeholder="Team" value={userForm.team} onChange={(e) => setUserForm({ ...userForm, team: e.target.value })} />
            <select className="input" value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
              <option value="staff">staff</option>
              <option value="admin">admin</option>
              <option value="client">client</option>
            </select>
            {userForm.role === "client" && (
              <input className="input" placeholder="client id" value={userForm.clientId} onChange={(e) => setUserForm({ ...userForm, clientId: e.target.value })} />
            )}
            <button type="submit" className="btn primary">Create user</button>
          </form>
          <div className="card">
            {usersLoading ? <Loading /> : (
              <table className="tbl">
                <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
                <tbody>
                  {(usersData?.users || []).map((u) => (
                    <tr key={u.id}><td>{u.name}</td><td className="mut">{u.email}</td><td>{u.role}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
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
        <div className="card card-pad">
          <h3 style={{ margin: "0 0 12px", color: "var(--fs-navy)" }}>Module access by role</h3>
          {Object.keys(allRoles || {}).map((role) => (
            <div key={role} style={{ marginBottom: 16 }}>
              <div className="lbl">{role}</div>
              <div className="col" style={{ gap: 6 }}>
                {ALL_MODULES.map((m) => (
                  <label key={m.id} className="row" style={{ fontSize: 13 }}>
                    <input type="checkbox" checked={!!(roleModules[role] || {})[m.id] || m.mandatory}
                      disabled={m.mandatory}
                      onChange={(e) => setRoleModules((prev) => ({
                        ...prev,
                        [role]: { ...(prev[role] || allRoles[role]), [m.id]: e.target.checked },
                      }))} />
                    {m.label}
                  </label>
                ))}
              </div>
              <button type="button" className="btn secondary sm" style={{ marginTop: 8 }} onClick={() => saveModules(role)}>Save {role}</button>
            </div>
          ))}
        </div>
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
