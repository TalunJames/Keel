import React, { useMemo, useState } from "react";
import { Icon, Avatar, Tag } from "../components/ui.jsx";
import { api, ApiError, usersAdminApi } from "../lib/api.js";
import { Loading } from "../components/Loading.jsx";
import { useModalA11y } from "../lib/useModalA11y.js";

const ROLE_OPTIONS = [
  { value: "staff", label: "Staff" },
  { value: "admin", label: "Admin / Partner" },
  { value: "client", label: "Client" },
];

const EMPTY_FORM = { email: "", name: "", team: "", role: "staff", clientId: "", systemAdmin: false, isDesigner: false };

function roleTag(u) {
  const tones = { admin: "gold", client: "outline", staff: "navy" };
  const labels = { admin: "Admin / Partner", client: "Client", staff: "Staff" };
  if (u.pendingInvite) {
    return (
      <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        <Tag tone={tones[u.role] || "navy"}>{labels[u.role] || u.role}</Tag>
        <Tag tone={u.inviteExpired ? "outline" : "gold"}>
          {u.inviteExpired ? "Expired" : "Pending"}
        </Tag>
      </span>
    );
  }
  if (u.systemAdmin) return <Tag tone="gold">System admin</Tag>;
  return (
    <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>
      <Tag tone={tones[u.role] || "navy"}>{labels[u.role] || u.role}</Tag>
      {u.isDesigner && <Tag tone="gold">Designer</Tag>}
    </span>
  );
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function AdminModal({ title, children, onClose, wide }) {
  const dialogRef = useModalA11y(onClose);
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 150,
        background: "rgba(26,58,92,0.45)",
        display: "grid", placeItems: "center", padding: 24,
      }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ maxWidth: wide ? 520 : 480, width: "100%", padding: "22px 24px", maxHeight: "90vh", overflow: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row between" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: "var(--fs-navy)", fontSize: 16 }}>{title}</h3>
          <button type="button" className="btn ghost sm" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function UserForm({ mode, form, setForm, clients, isSystemAdmin, saving, error, onSubmit, onCancel, editingSelf, editingUser }) {
  const isEdit = mode === "edit";
  const isInvite = mode === "invite";
  return (
    <form className="col" style={{ gap: 0 }} onSubmit={onSubmit}>
      {isInvite && (
        <p className="mut" style={{ fontSize: 13, margin: "0 0 16px" }}>
          They'll receive an email with an overview of Keel, their role, and a link to create their account.
        </p>
      )}
      <div className="field">
        <label>Full name</label>
        <input className="input" required value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      {!isEdit && (
        <div className="field">
          <label>Email</label>
          <input className="input" type="email" required autoComplete="off"
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
      )}
      {!isInvite && (
        <div className="field">
          <label>{isEdit ? "New password" : "Password"}</label>
          <input className="input" type="password" required={!isEdit} autoComplete="new-password"
            placeholder={isEdit ? "Leave blank to keep current" : ""}
            value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          {isEdit && <div className="help">Only fill in to reset their password.</div>}
        </div>
      )}
      <div className="field">
        <label>Role</label>
        <select className="input" value={form.role} disabled={editingSelf || (isEdit && editingUser?.pendingInvite)}
          onChange={(e) => setForm({ ...form, role: e.target.value, systemAdmin: e.target.value === "admin" ? form.systemAdmin : false })}>
          {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        {editingSelf && <div className="help">You cannot change your own role.</div>}
      </div>
      {form.role === "client" ? (
        <div className="field">
          <label>Client account</label>
          <select className="input" required value={form.clientId}
            onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
            <option value="">Select client…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      ) : (
        <div className="field">
          <label>Team</label>
          <input className="input" placeholder="e.g. Public Affairs"
            value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })} />
        </div>
      )}
      {isSystemAdmin && form.role === "admin" && (
        <label className="row" style={{ gap: 8, fontSize: 13, marginBottom: 18 }}>
          <input type="checkbox" checked={!!form.systemAdmin} disabled={editingSelf}
            onChange={(e) => setForm({ ...form, systemAdmin: e.target.checked })} />
          Grant system admin (can edit login screen)
          {editingSelf && <span className="mut">— cannot revoke your own</span>}
        </label>
      )}
      {form.role !== "client" && (
        <label className="row" style={{ gap: 8, fontSize: 13, marginBottom: 18 }}>
          <input type="checkbox" checked={!!form.isDesigner}
            onChange={(e) => setForm({ ...form, isDesigner: e.target.checked })} />
          Designer — shows Designer Desk and design queue tools
        </label>
      )}
      {error && (
        <div style={{ fontSize: 13, color: "var(--fs-danger)", marginBottom: 12 }}>{error}</div>
      )}
      <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn primary" disabled={saving}>
          {saving ? "Saving…" : isInvite ? "Send invitation" : isEdit ? "Save changes" : "Create user"}
        </button>
      </div>
    </form>
  );
}

export function AdminUsersTab({ user, users, usersLoading, clients, isSystemAdmin, onReload, onFlash }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showInvite, setShowInvite] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [inviteForm, setInviteForm] = useState(EMPTY_FORM);
  const [createForm, setCreateForm] = useState({ ...EMPTY_FORM, password: "" });
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM, password: "" });
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(null);
  const [formError, setFormError] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (users || []).filter((u) => {
      if (roleFilter === "admin" && !(u.role === "admin" || u.systemAdmin)) return false;
      if (roleFilter !== "all" && roleFilter !== "admin" && u.role !== roleFilter) return false;
      if (!q) return true;
      const hay = [u.name, u.email, u.team, u.clientName, u.role].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [users, search, roleFilter]);

  const openEdit = (u) => {
    setFormError("");
    setEditForm({
      email: u.email,
      password: "",
      name: u.name,
      team: u.team || "",
      role: u.role,
      clientId: u.clientId || "",
      systemAdmin: !!u.systemAdmin,
      isDesigner: !!u.isDesigner,
    });
    setEditing(u);
  };

  const closeModals = () => {
    setShowInvite(false);
    setShowCreate(false);
    setEditing(null);
    setInviteForm(EMPTY_FORM);
    setCreateForm({ ...EMPTY_FORM, password: "" });
    setFormError("");
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const result = await usersAdminApi.invite(inviteForm);
      closeModals();
      onReload();
      if (result.emailSent === false && result.mailError) {
        onFlash("Invite created but email failed — use Resend invite");
      } else {
        onFlash("Invitation sent to " + inviteForm.email);
      }
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not send invitation");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await api("/admin/users", { method: "POST", body: JSON.stringify(createForm) });
      closeModals();
      onReload();
      onFlash("User created");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not create user");
    } finally {
      setSaving(false);
    }
  };

  const handleResend = async (u) => {
    setResending(u.id);
    try {
      const result = await usersAdminApi.resendInvite(u.id);
      onReload();
      if (result.emailSent === false && result.mailError) {
        onFlash("Could not send email — check SMTP settings");
      } else {
        onFlash("Invitation resent to " + u.email);
      }
    } catch (err) {
      onFlash(err instanceof ApiError ? err.message : "Could not resend invitation");
    } finally {
      setResending(null);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setFormError("");
    const patch = {
      name: editForm.name,
      team: editForm.team,
      role: editForm.role,
      clientId: editForm.role === "client" ? editForm.clientId : null,
    };
    if (editForm.password) patch.password = editForm.password;
    if (isSystemAdmin && editForm.role === "admin") patch.systemAdmin = editForm.systemAdmin;
    if (editForm.role !== "client") patch.isDesigner = !!editForm.isDesigner;
    try {
      await api("/admin/users/" + editing.id, { method: "PATCH", body: JSON.stringify(patch) });
      closeModals();
      onReload();
      onFlash("User updated");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not update user");
    } finally {
      setSaving(false);
    }
  };

  const teamLabel = (u) => {
    if (u.role === "client") return u.clientName || u.clientId || "—";
    return u.team || "—";
  };

  return (
    <>
      <div className="card">
        <div className="card-head">
          <h3>People · {(users || []).length}</h3>
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="btn primary sm" onClick={() => { setFormError(""); setShowInvite(true); }}>
              <Icon name="plus" size={12} /> Invite user
            </button>
            <button type="button" className="btn secondary sm" onClick={() => { setFormError(""); setShowCreate(true); }}>
              Set password manually
            </button>
          </div>
        </div>

        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--fs-border)", display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 200px", position: "relative" }}>
            <Icon name="search" size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--fs-fg-muted)" }} />
            <input
              className="input"
              placeholder="Search name, email, team…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 32, fontSize: 13 }}
            />
          </div>
          <select className="input" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
            style={{ width: "auto", minWidth: 130, fontSize: 13 }}>
            <option value="all">All roles</option>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
            <option value="client">Client</option>
          </select>
        </div>

        {usersLoading ? (
          <div style={{ padding: 32 }}><Loading /></div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            <p className="mut" style={{ fontSize: 13, margin: 0 }}>
              {search || roleFilter !== "all" ? "No users match your filters." : "No users yet — invite someone to get started."}
            </p>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th>Team / Account</th>
                <th>Email</th>
                <th>Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} style={{ cursor: "pointer" }} onClick={() => openEdit(u)}>
                  <td>
                    <div className="row" style={{ gap: 10 }}>
                      <Avatar name={u.name} size={28} />
                      <span style={{ fontWeight: 600, color: "var(--fs-navy)" }}>
                        {u.name}
                        {u.id === user?.id && <span className="mut" style={{ fontWeight: 400, fontSize: 12 }}> (you)</span>}
                      </span>
                    </div>
                  </td>
                  <td>{roleTag(u)}</td>
                  <td className="mut">{teamLabel(u)}</td>
                  <td className="mut" style={{ fontFamily: "var(--fs-font-mono)", fontSize: 12 }}>{u.email}</td>
                  <td className="mut" style={{ fontSize: 12 }}>{formatDate(u.createdAt)}</td>
                  <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                    <div className="row" style={{ gap: 4, justifyContent: "flex-end" }}>
                      {u.pendingInvite && (
                        <button
                          type="button"
                          className="btn ghost sm"
                          disabled={resending === u.id}
                          onClick={() => handleResend(u)}
                          aria-label="Resend invitation"
                          title="Resend invitation email"
                        >
                          <Icon name="rotate-ccw" size={14} />
                        </button>
                      )}
                      <button type="button" className="btn ghost sm" onClick={() => openEdit(u)} aria-label="Edit user">
                        <Icon name="pen" size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showInvite && (
        <AdminModal title="Invite user" onClose={closeModals} wide>
          <UserForm
            mode="invite"
            form={inviteForm}
            setForm={setInviteForm}
            clients={clients}
            isSystemAdmin={isSystemAdmin}
            saving={saving}
            error={formError}
            onSubmit={handleInvite}
            onCancel={closeModals}
          />
        </AdminModal>
      )}

      {showCreate && (
        <AdminModal title="Create user with password" onClose={closeModals} wide>
          <p className="mut" style={{ fontSize: 13, margin: "0 0 16px" }}>
            Skip the email invite and set their password directly. They can sign in immediately.
          </p>
          <UserForm
            mode="create"
            form={createForm}
            setForm={setCreateForm}
            clients={clients}
            isSystemAdmin={isSystemAdmin}
            saving={saving}
            error={formError}
            onSubmit={handleCreate}
            onCancel={closeModals}
          />
        </AdminModal>
      )}

      {editing && (
        <AdminModal title={"Edit · " + editing.name} onClose={closeModals} wide>
          <p className="mut" style={{ fontSize: 13, margin: "0 0 16px" }}>{editing.email}</p>
          {editing.pendingInvite && (
            <div style={{ marginBottom: 16, padding: "10px 12px", background: "var(--fs-bone-50)", borderRadius: 4, fontSize: 13 }}>
              {editing.inviteExpired
                ? "Their invitation expired. Use the resend button to send a new link."
                : "Waiting for them to accept the invitation email."}
            </div>
          )}
          <UserForm
            mode="edit"
            form={editForm}
            setForm={setEditForm}
            clients={clients}
            isSystemAdmin={isSystemAdmin}
            saving={saving}
            error={formError}
            onSubmit={handleEdit}
            onCancel={closeModals}
            editingSelf={editing.id === user?.id}
            editingUser={editing}
          />
        </AdminModal>
      )}
    </>
  );
}
