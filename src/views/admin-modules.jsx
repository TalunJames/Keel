import React, { useEffect, useMemo, useState } from "react";
import { PageHead, Icon, Tag } from "../components/ui.jsx";
import { api, modulesApi } from "../lib/api.js";
import { ALL_MODULES } from "../lib/modules.js";
import {
  STAFF_MODULE_OPTIONS,
  CLIENT_MODULE_OPTIONS,
  CLIENT_TYPE_PRESETS,
  modulesForType,
} from "../lib/client-type-presets.js";
import { diffOverrides, ROLE_LABELS } from "../lib/access.js";
import { ModuleToggle } from "../components/module-toggle.jsx";
import { Loading } from "../components/Loading.jsx";

const ROLE_KEYS = ["staff", "admin", "client"];

function moduleOptionsForRole(role) {
  return role === "client" ? CLIENT_MODULE_OPTIONS : STAFF_MODULE_OPTIONS;
}

export function AdminModulesTab({ allRoles, user, onFlash }) {
  const [subTab, setSubTab] = useState("roles");
  const [roleModules, setRoleModules] = useState(allRoles || {});
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientStaffMods, setClientStaffMods] = useState({});
  const [clientPortalMods, setClientPortalMods] = useState({});
  const [savingClient, setSavingClient] = useState(false);

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [overrideClientId, setOverrideClientId] = useState("");
  const [overrideDraft, setOverrideDraft] = useState({});
  const [overrideBase, setOverrideBase] = useState({});
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [savingOverride, setSavingOverride] = useState(false);

  useEffect(() => {
    api("/admin/clients")
      .then((r) => {
        const list = (r.clients || []).filter((c) => c.id !== "all");
        setClients(list);
        if (list[0]) setSelectedClientId(list[0].id);
      })
      .finally(() => setClientsLoading(false));
    api("/admin/users")
      .then((r) => setUsers(r.users || []))
      .finally(() => setUsersLoading(false));
  }, []);

  // Seed the Role defaults editor from the server's persisted config for ALL
  // roles so it shows real saved state (not the hardcoded fallback). Otherwise
  // saving one role would overwrite the others with defaults.
  useEffect(() => {
    api("/admin/module-defaults")
      .then((r) => {
        if (r?.defaults) setRoleModules((prev) => ({ ...prev, ...r.defaults }));
      })
      .catch(() => {});
  }, []);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId),
    [clients, selectedClientId]
  );

  useEffect(() => {
    if (!selectedClient) return;
    const fromType = modulesForType(selectedClient.type || "");
    setClientStaffMods({ ...(selectedClient.staffModules || fromType.staffModules) });
    setClientPortalMods({ ...(selectedClient.clientModules || fromType.clientModules) });
  }, [selectedClient]);

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId),
    [users, selectedUserId]
  );

  useEffect(() => {
    if (!selectedUserId || !overrideClientId) return;
    setOverrideLoading(true);
    api(`/admin/users/${selectedUserId}/access?clientId=${encodeURIComponent(overrideClientId)}`)
      .then((r) => {
        setOverrideBase(r.base || {});
        const merged = { ...(r.base || {}), ...(r.overrides || {}) };
        setOverrideDraft(merged);
      })
      .catch(() => {
        setOverrideBase({});
        setOverrideDraft({});
      })
      .finally(() => setOverrideLoading(false));
  }, [selectedUserId, overrideClientId]);

  const saveRoleModules = async (role) => {
    try {
      await modulesApi.set(role, roleModules[role] || allRoles[role]);
      onFlash(`Role defaults saved for ${ROLE_LABELS[role] || role}`);
    } catch (e) {
      onFlash(e?.message || "Could not save role defaults");
    }
  };

  const saveClientModules = async () => {
    if (!selectedClientId) return;
    setSavingClient(true);
    try {
      await api(`/admin/clients/${selectedClientId}`, {
        method: "PATCH",
        body: JSON.stringify({
          payload: { staffModules: clientStaffMods, clientModules: clientPortalMods },
        }),
      });
      setClients((prev) => prev.map((c) => (
        c.id === selectedClientId
          ? { ...c, staffModules: clientStaffMods, clientModules: clientPortalMods }
          : c
      )));
      onFlash(`Workspace updated for ${selectedClient?.name || selectedClientId}`);
    } catch (e) {
      onFlash(e?.message || "Could not save workspace modules");
    } finally {
      setSavingClient(false);
    }
  };

  const applyClientPreset = (typeId) => {
    const { staffModules, clientModules } = modulesForType(typeId);
    setClientStaffMods({ ...staffModules });
    setClientPortalMods({ ...clientModules });
  };

  const saveUserOverrides = async () => {
    if (!selectedUserId || !overrideClientId || !selectedUser) return;
    setSavingOverride(true);
    try {
      const sparse = diffOverrides(overrideBase, overrideDraft);
      await api(`/admin/users/${selectedUserId}/access`, {
        method: "PUT",
        body: JSON.stringify({ clientId: overrideClientId, modules: sparse }),
      });
      onFlash(`Access overrides saved for ${selectedUser.name}`);
    } catch (e) {
      onFlash(e?.message || "Could not save access overrides");
    } finally {
      setSavingOverride(false);
    }
  };

  const resetUserOverrides = async () => {
    if (!selectedUserId || !overrideClientId) return;
    setSavingOverride(true);
    try {
      await api(`/admin/users/${selectedUserId}/access`, {
        method: "PUT",
        body: JSON.stringify({ clientId: overrideClientId, modules: {} }),
      });
      setOverrideDraft({ ...overrideBase });
      onFlash("Overrides cleared — back to client defaults");
    } catch (e) {
      onFlash(e?.message || "Could not clear overrides");
    } finally {
      setSavingOverride(false);
    }
  };

  const overrideOptions = selectedUser ? moduleOptionsForRole(selectedUser.role) : STAFF_MODULE_OPTIONS;

  return (
    <div>
      <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { id: "roles", label: "Role defaults" },
          { id: "clients", label: "Per client" },
          { id: "overrides", label: "Per person" },
        ].map((t) => (
          <button key={t.id} type="button" className={"btn " + (subTab === t.id ? "primary" : "secondary")} onClick={() => setSubTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "roles" && (
        <div className="card card-pad">
          <h3 style={{ margin: "0 0 8px", color: "var(--fs-navy)" }}>Global role ceilings</h3>
          <p className="mut" style={{ fontSize: 13, margin: "0 0 16px" }}>
            Maximum tabs each role can ever see. Per-client settings narrow this further when a client is selected.
          </p>
          {ROLE_KEYS.map((role) => (
            <div key={role} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--fs-border)" }}>
              <div className="lbl">{ROLE_LABELS[role] || role}</div>
              <div className="col" style={{ gap: 6 }}>
                {ALL_MODULES.map((m) => (
                  <label key={m.id} className="row" style={{ fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={!!(roleModules[role] || {})[m.id] || m.mandatory}
                      disabled={m.mandatory}
                      onChange={(e) => setRoleModules((prev) => ({
                        ...prev,
                        [role]: { ...(prev[role] || allRoles[role]), [m.id]: e.target.checked },
                      }))}
                    />
                    {m.label}
                    {m.gated && <Tag tone="gold" style={{ marginLeft: 6 }}>Gated</Tag>}
                    {m.staffOnly && <Tag tone="navy" style={{ marginLeft: 6 }}>Staff-only</Tag>}
                  </label>
                ))}
              </div>
              <button type="button" className="btn secondary sm" style={{ marginTop: 8 }} onClick={() => saveRoleModules(role)}>
                Save {ROLE_LABELS[role] || role}
              </button>
            </div>
          ))}
        </div>
      )}

      {subTab === "clients" && (
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 18, alignItems: "start" }}>
          <div className="card">
            <div className="card-head"><h3>Clients</h3></div>
            {clientsLoading ? <div style={{ padding: 16 }}><Loading /></div> : (
              <div style={{ padding: 8 }}>
                {clients.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedClientId(c.id)}
                    style={{
                      width: "100%", textAlign: "left", padding: "10px 12px",
                      background: selectedClientId === c.id ? "var(--fs-navy-50)" : "transparent",
                      border: "1px solid " + (selectedClientId === c.id ? "var(--fs-navy)" : "transparent"),
                      borderRadius: 4, cursor: "pointer", marginBottom: 4,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)" }}>{c.name}</div>
                    <div className="mut" style={{ fontSize: 11 }}>{c.type || "No type"}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedClient ? (
            <div className="col" style={{ gap: 16 }}>
              <div className="card card-pad">
                <div className="row between" style={{ marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, color: "var(--fs-navy)" }}>{selectedClient.name}</h3>
                    <p className="mut" style={{ fontSize: 13, margin: "4px 0 0" }}>
                      Workspace tabs when this client is selected in the switcher.
                    </p>
                  </div>
                  <button type="button" className="btn primary" disabled={savingClient} onClick={saveClientModules}>
                    {savingClient ? "Saving…" : "Save workspace"}
                  </button>
                </div>
                <div className="row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                  <span className="mut" style={{ fontSize: 12 }}>Apply preset:</span>
                  {CLIENT_TYPE_PRESETS.map((p) => (
                    <button key={p.id} type="button" className="btn ghost sm" onClick={() => applyClientPreset(p.id)}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                  <div className="card" style={{ background: "var(--fs-bone-50)" }}>
                    <div className="card-head"><h3>Staff / Partner workspace</h3></div>
                    <div style={{ padding: "8px 16px" }}>
                      {STAFF_MODULE_OPTIONS.map((m) => (
                        <ModuleToggle
                          key={m.id}
                          mod={m}
                          on={!!clientStaffMods[m.id]}
                          onChange={(v) => setClientStaffMods((prev) => ({ ...prev, [m.id]: v }))}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="card" style={{ background: "var(--fs-bone-50)" }}>
                    <div className="card-head"><h3>Client portal</h3></div>
                    <div style={{ padding: "8px 16px" }}>
                      {CLIENT_MODULE_OPTIONS.map((m) => (
                        <ModuleToggle
                          key={m.id}
                          mod={m}
                          on={!!clientPortalMods[m.id]}
                          onChange={(v) => setClientPortalMods((prev) => ({ ...prev, [m.id]: v }))}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card card-pad mut">Select a client to configure workspace tabs.</div>
          )}
        </div>
      )}

      {subTab === "overrides" && (
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 18, alignItems: "start" }}>
          <div className="card">
            <div className="card-head"><h3>People</h3></div>
            {usersLoading ? <div style={{ padding: 16 }}><Loading /></div> : (
              <div style={{ padding: 8 }}>
                {users.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setSelectedUserId(u.id);
                      if (!overrideClientId && clients[0]) setOverrideClientId(clients[0].id);
                    }}
                    style={{
                      width: "100%", textAlign: "left", padding: "10px 12px",
                      background: selectedUserId === u.id ? "var(--fs-navy-50)" : "transparent",
                      border: "1px solid " + (selectedUserId === u.id ? "var(--fs-navy)" : "transparent"),
                      borderRadius: 4, cursor: "pointer", marginBottom: 4,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)" }}>{u.name}</div>
                    <div className="mut" style={{ fontSize: 11 }}>{ROLE_LABELS[u.role] || u.role}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedUser ? (
            <div className="card card-pad">
              <div className="row between" style={{ marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h3 style={{ margin: 0, color: "var(--fs-navy)" }}>{selectedUser.name}</h3>
                  <p className="mut" style={{ fontSize: 13, margin: "4px 0 0" }}>
                    Grant or revoke individual tabs for one client without changing everyone else.
                  </p>
                </div>
                <div className="field" style={{ margin: 0, minWidth: 200 }}>
                  <label>Client</label>
                  <select className="input" value={overrideClientId}
                    onChange={(e) => setOverrideClientId(e.target.value)}>
                    <option value="">Select client…</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {overrideLoading ? (
                <Loading />
              ) : overrideClientId ? (
                <>
                  <div className="col" style={{ gap: 6, marginBottom: 16 }}>
                    {overrideOptions.map((m) => {
                      const def = !!overrideBase[m.id];
                      const cur = !!overrideDraft[m.id];
                      const overridden = def !== cur;
                      return (
                        <label key={m.id} className="row between" style={{ fontSize: 13, padding: "6px 0" }}>
                          <span className="row" style={{ gap: 8 }}>
                            <input
                              type="checkbox"
                              checked={cur || m.mandatory}
                              disabled={m.mandatory}
                              onChange={(e) => setOverrideDraft((prev) => ({ ...prev, [m.id]: e.target.checked }))}
                            />
                            {m.label}
                            {overridden && <Tag tone="gold">Override</Tag>}
                          </span>
                          <span className="mut" style={{ fontSize: 11 }}>
                            Default: {def ? "On" : "Off"}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <button type="button" className="btn primary" disabled={savingOverride} onClick={saveUserOverrides}>
                      {savingOverride ? "Saving…" : "Save overrides"}
                    </button>
                    <button type="button" className="btn secondary" disabled={savingOverride} onClick={resetUserOverrides}>
                      Reset to client default
                    </button>
                  </div>
                </>
              ) : (
                <p className="mut" style={{ fontSize: 13 }}>Pick a client to edit overrides.</p>
              )}
            </div>
          ) : (
            <div className="card card-pad mut">Select a person to configure per-client access.</div>
          )}
        </div>
      )}
    </div>
  );
}
