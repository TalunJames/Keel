import React, { useState, useEffect } from "react";
import { Icon, Tag } from "../components/ui.jsx";
import { clientsApi, teamApi, usersAdminApi } from "../lib/api.js";
import {
  STANDARD_TYPE_PRESETS,
  CUSTOM_TYPE_PRESET,
  STAFF_MODULE_OPTIONS,
  CLIENT_MODULE_OPTIONS,
  modulesForType,
  getPreset,
  enabledModuleLabels,
} from "../lib/client-type-presets.js";
import { extractColorsFromDataUrl, colorToHex } from "../lib/logo-colors.js";
import { ModuleToggle } from "../components/module-toggle.jsx";

const BRAND_COLORS = [
  "var(--fs-navy)", "var(--fs-navy-600)", "var(--fs-gold-700)",
  "#2F6B4F", "#7A5AE0", "#A8341E", "#1E6B82",
];

const STAFF_ROLES = [
  { key: "lead", label: "Lead strategist" },
  { key: "account", label: "Account lead" },
  { key: "designer", label: "Lead designer" },
  { key: "data", label: "Data & analytics" },
  { key: "other", label: "Team member" },
];

function personRoles(team, name) {
  const roles = STAFF_ROLES.filter((r) => r.key !== "other" && team[r.key] === name).map((r) => r.key);
  if (team.others.includes(name)) roles.push("other");
  return roles;
}

function isPersonAssigned(team, name) {
  return personRoles(team, name).length > 0;
}

function setPersonAssigned(team, name, assigned) {
  if (!assigned) {
    return {
      lead: team.lead === name ? "" : team.lead,
      account: team.account === name ? "" : team.account,
      designer: team.designer === name ? "" : team.designer,
      data: team.data === name ? "" : team.data,
      others: team.others.filter((x) => x !== name),
    };
  }
  if (isPersonAssigned(team, name)) return team;
  return { ...team, others: [...team.others, name] };
}

function togglePersonRole(team, name, roleKey) {
  if (roleKey === "other") {
    const has = team.others.includes(name);
    return { ...team, others: has ? team.others.filter((x) => x !== name) : [...team.others, name] };
  }
  if (team[roleKey] === name) {
    return { ...team, [roleKey]: "" };
  }
  return { ...team, [roleKey]: name };
}

const STEPS = [
  { id: "type", label: "Service line" },
  { id: "identity", label: "Identity & brand" },
  { id: "team", label: "Client staff" },
  { id: "contacts", label: "Portal contacts" },
  { id: "review", label: "Review & create" },
];

const defaultModules = modulesForType("Campaign Services");

const EMPTY_DRAFT = {
  name: "", tag: "", initials: "", color: "var(--fs-navy-600)",
  type: "Campaign Services", desc: "", logo: null,
  detectedColors: [], colorSource: "preset",
  driveFolderUrl: "",
  staffModules: defaultModules.staffModules,
  clientModules: defaultModules.clientModules,
  team: { lead: "", account: "", designer: "", data: "", others: [] },
  contacts: [{ name: "", email: "", role: "Principal", views: "Full client view" }],
};

function slugFromTag(tag) {
  return String(tag || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function clientToDraft(client) {
  if (!client) {
    return {
      ...EMPTY_DRAFT,
      staffModules: { ...defaultModules.staffModules },
      clientModules: { ...defaultModules.clientModules },
    };
  }
  const mods = modulesForType(client.type || "Campaign Services");
  return {
    name: client.name || "",
    tag: client.tag || "",
    initials: client.initials || "",
    color: client.color || "var(--fs-navy-600)",
    type: client.type || "Campaign Services",
    desc: client.desc || client.audience || "",
    logo: client.logo || null,
    detectedColors: [],
    colorSource: "preset",
    driveFolderUrl: client.driveFolderUrl || "",
    staffModules: client.staffModules ? { ...client.staffModules } : { ...mods.staffModules },
    clientModules: client.clientModules ? { ...client.clientModules } : { ...mods.clientModules },
    team: client.team ? { ...client.team, others: [...(client.team.others || [])] } : { ...EMPTY_DRAFT.team },
    contacts: client.contacts?.length
      ? client.contacts.map((c) => ({ ...c }))
      : [{ name: "", email: "", role: "Principal", views: "Full client view" }],
  };
}

function buildClientPayload(draft) {
  const {
    contacts, team, desc, logo, staffModules, clientModules, driveFolderUrl,
    detectedColors, colorSource,
    ...core
  } = draft;
  return {
    ...core,
    logo,
    account: team.account || team.lead || "",
    audience: desc || "",
    payload: {
      team,
      contacts,
      desc,
      staffModules,
      clientModules,
      driveFolderUrl: driveFolderUrl.trim() || null,
    },
  };
}

export function ClientWizard({ client, onCancel, onCreated, onSaved }) {
  const isEdit = !!client;
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(() => clientToDraft(client));
  const [staff, setStaff] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    teamApi.list().then((r) => setStaff(r.members || [])).catch(() => setStaff([]));
  }, []);

  useEffect(() => {
    if (!draft.name || isEdit) return;
    const initials = draft.name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
    const tag = draft.name.split(/\s+/)[0].toUpperCase().slice(0, 8);
    setDraft((d) => ({ ...d, initials, tag }));
  }, [draft.name, isEdit]);

  const upd = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const updTeam = (patch) => setDraft((d) => ({ ...d, team: { ...d.team, ...patch } }));
  const updMod = (which, key, on) => setDraft((d) => ({ ...d, [which]: { ...d[which], [key]: on } }));

  const selectType = (typeId) => {
    const { staffModules, clientModules } = modulesForType(typeId);
    upd({ type: typeId, staffModules, clientModules });
  };

  const isCustom = draft.type === "Custom";
  const preset = getPreset(draft.type);

  const canNext = (() => {
    if (step === 0) return !!draft.type;
    if (step === 1) return draft.name.trim().length > 1;
    return true;
  })();

  const onLogoPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 512 * 1024) {
      setError("Logo must be under 512 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      let detectedColors = [];
      try {
        detectedColors = await extractColorsFromDataUrl(dataUrl);
      } catch {
        detectedColors = [];
      }
      setDraft((d) => ({
        ...d,
        logo: dataUrl,
        detectedColors,
        color: detectedColors[0] || d.color,
        colorSource: detectedColors.length ? "logo" : d.colorSource,
      }));
    };
    reader.readAsDataURL(file);
    setError("");
    e.target.value = "";
  };

  const clearLogo = () => {
    upd({ logo: null, detectedColors: [], colorSource: "preset" });
  };

  const createClient = async () => {
    setSaving(true);
    setError("");
    try {
      const result = await clientsApi.create(buildClientPayload(draft));
      const clientId = result.id;
      const contacts = draft.contacts.filter((c) => c.email?.trim());
      for (const contact of contacts) {
        try {
          await usersAdminApi.invite({
            email: contact.email.trim(),
            name: contact.name.trim() || contact.email.trim(),
            role: "client",
            clientId,
          });
        } catch {
          // Client was created; individual invite failures are non-fatal.
        }
      }
      onCreated?.(clientId);
    } catch (err) {
      setError(err.message || "Could not create client.");
    } finally {
      setSaving(false);
    }
  };

  const saveClient = async () => {
    setSaving(true);
    setError("");
    try {
      await clientsApi.update(client.id, buildClientPayload(draft));
      onSaved?.(client.id);
    } catch (err) {
      setError(err.message || "Could not save client.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="row between" style={{ alignItems: "flex-start", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "var(--fs-font-display)", fontSize: 30, fontWeight: 700, color: "var(--fs-navy)", margin: "0 0 4px", letterSpacing: "-0.01em" }}>
            {isEdit ? "Edit client" : "Set up a new client"}
          </h2>
          <p className="mut" style={{ fontSize: 14, margin: 0, maxWidth: 580 }}>
            {isEdit
              ? "Update service line, identity, team assignments, portal tabs, and contacts for this account."
              : "Choose a service line to configure Keel tabs, then walk through identity, team, and portal contacts."}
          </p>
        </div>
        <button type="button" className="btn ghost" onClick={onCancel}>
          <Icon name="x" size={14} /> Cancel
        </button>
      </div>

      <div className="card wizard-stepper">
        <div className="row" style={{ gap: 0, overflowX: "auto" }}>
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => (isEdit || i <= step) && setStep(i)}
              disabled={!isEdit && i > step}
              className={"wizard-step" + (i === step ? " active" : "") + (i < step ? " done" : "")}
            >
              <span className="wizard-step-num">
                {i < step ? <Icon name="check" size={12} /> : i + 1}
              </span>
              <span className="wizard-step-label">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card card-pad" style={{ minHeight: 360 }}>
        {step === 0 && (
          <StepServiceLine
            draft={draft}
            selectType={selectType}
            isCustom={isCustom}
            preset={preset}
            updMod={updMod}
          />
        )}
        {step === 1 && <StepIdentity draft={draft} upd={upd} onLogoPick={onLogoPick} onClearLogo={clearLogo} clientId={isEdit ? client.id : null} />}
        {step === 2 && <StepTeam draft={draft} updTeam={updTeam} staff={staff} />}
        {step === 3 && <StepContacts draft={draft} upd={upd} />}
        {step === 4 && <StepReview draft={draft} isEdit={isEdit} />}
      </div>

      {error && (
        <div className="card card-pad" style={{ marginTop: 12, borderColor: "rgba(168,52,30,0.35)", background: "rgba(168,52,30,0.06)", color: "#a8341e", fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="row between" style={{ marginTop: 18 }}>
        <button type="button" className="btn ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          <Icon name="chevron-left" size={14} /> Back
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn primary" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
            Continue <Icon name="chevron-right" size={14} />
          </button>
        ) : (
          <button type="button" className="btn accent" disabled={saving} onClick={isEdit ? saveClient : createClient}>
            <Icon name="check" size={14} /> {saving ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save changes" : "Create client")}
          </button>
        )}
      </div>
    </div>
  );
}

function StepServiceLine({ draft, selectType, isCustom, preset, updMod }) {
  const custom = CUSTOM_TYPE_PRESET;
  const customSelected = draft.type === custom?.id;

  return (
    <div>
      <h3 style={{ fontFamily: "var(--fs-font-display)", margin: "0 0 6px", color: "var(--fs-navy)" }}>What kind of engagement is this?</h3>
      <p className="mut" style={{ fontSize: 13, margin: "0 0 22px" }}>
        Your selection sets which Keel tabs are enabled for staff and the client portal.
      </p>

      <div className="type-card-picker">
        <div className="type-card-grid">
          {STANDARD_TYPE_PRESETS.map((p) => {
            const selected = draft.type === p.id;
            return (
              <button
                key={p.id}
                type="button"
                className={"type-card" + (selected ? " selected" : "")}
                onClick={() => selectType(p.id)}
              >
                <span className="type-card-icon">
                  <Icon name={p.icon} size={28} />
                </span>
                <span className="type-card-body">
                  <span className="type-card-label">{p.label}</span>
                  <span className="type-card-desc">{p.desc}</span>
                </span>
                {selected && (
                  <span className="type-card-check" aria-hidden="true">
                    <Icon name="check" size={13} />
                  </span>
                )}
              </button>
            );
          })}

          {custom && (
            <button
              type="button"
              className={"type-card type-card-custom" + (customSelected ? " selected" : "")}
              onClick={() => selectType(custom.id)}
            >
              <span className="type-card-icon">
                <Icon name={custom.icon} size={24} />
              </span>
              <span className="type-card-body">
                <span className="type-card-label">{custom.label}</span>
                <span className="type-card-desc">{custom.desc}</span>
              </span>
              {customSelected && (
                <span className="type-card-check" aria-hidden="true">
                  <Icon name="check" size={13} />
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {!isCustom && preset && (
        <div className="type-modules-preview">
          <div className="type-modules-col">
            <div className="lbl">Staff workspace</div>
            <div className="type-module-tags">
              {enabledModuleLabels(draft.staffModules, STAFF_MODULE_OPTIONS).map((label) => (
                <Tag key={label} tone="navy">{label}</Tag>
              ))}
            </div>
          </div>
          <div className="type-modules-col">
            <div className="lbl">Client portal</div>
            <div className="type-module-tags">
              {enabledModuleLabels(draft.clientModules, CLIENT_MODULE_OPTIONS).map((label) => (
                <Tag key={label} tone="gold">{label}</Tag>
              ))}
            </div>
          </div>
        </div>
      )}

      {isCustom && (
        <div className="type-custom-modules">
          <p className="mut" style={{ fontSize: 13, margin: "0 0 16px" }}>
            Toggle which tabs each side can access. Home is always on.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <div className="card" style={{ background: "var(--fs-bone-50)" }}>
              <div className="card-head"><h3>Staff workspace</h3></div>
              <div style={{ padding: "8px 16px" }}>
                {STAFF_MODULE_OPTIONS.map((m) => (
                  <ModuleToggle
                    key={m.id}
                    mod={m}
                    on={!!draft.staffModules[m.id]}
                    onChange={(v) => updMod("staffModules", m.id, v)}
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
                    on={!!draft.clientModules[m.id]}
                    onChange={(v) => updMod("clientModules", m.id, v)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StepIdentity({ draft, upd, onLogoPick, onClearLogo, clientId }) {
  const pickColor = (color, source) => upd({ color, colorSource: source });

  return (
    <div>
      <h3 style={{ fontFamily: "var(--fs-font-display)", margin: "0 0 6px", color: "var(--fs-navy)" }}>Who is this client?</h3>
      <p className="mut" style={{ fontSize: 13, margin: "0 0 22px" }}>
        {draft.type} · This name appears in the client switcher, on proposals, and across Keel.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="field">
            <label>Client name</label>
            <input className="input" value={draft.name} onChange={(e) => upd({ name: e.target.value })} placeholder='e.g. "Citizens for Coastal Renewal"' />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="field">
              <label>Short tag</label>
              <input className="input" value={draft.tag} onChange={(e) => upd({ tag: e.target.value.toUpperCase() })} maxLength={8} placeholder="COASTAL" />
              <div className="help">Used in URLs and channels.</div>
            </div>
            <div className="field">
              <label>Client id</label>
              <input className="input" value={clientId || slugFromTag(draft.tag)} readOnly style={{ opacity: 0.7 }} />
              <div className="help">{clientId ? "Client id cannot be changed." : "Auto-generated from tag."}</div>
            </div>
          </div>
        </div>

        <div className="field">
          <label>Client logo</label>
          <label className="logo-upload" htmlFor="client-logo-input">
            {draft.logo ? (
              <img src={draft.logo} alt="" className="logo-upload-preview" />
            ) : (
              <div className="logo-upload-placeholder">
                <Icon name="image" size={24} color="var(--fs-fg-subtle)" />
                <span>Upload logo</span>
                <span className="mut" style={{ fontSize: 11 }}>PNG or JPG · max 512 KB</span>
              </div>
            )}
          </label>
          <input id="client-logo-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={onLogoPick} style={{ display: "none" }} />
          {draft.logo && (
            <button type="button" className="btn ghost sm" style={{ marginTop: 8 }} onClick={onClearLogo}>
              Remove logo
            </button>
          )}
        </div>
      </div>

      <div className="field">
        <label>Brand color</label>
        <p className="help" style={{ margin: "0 0 12px" }}>
          {draft.detectedColors.length
            ? "We pulled these from your logo — pick one, use a preset, or choose your own."
            : "Upload a logo to auto-detect brand colors, or pick from the palette below."}
        </p>

        {draft.detectedColors.length > 0 && (
          <div className="brand-color-group">
            <div className="brand-color-group-label">From logo</div>
            <div className="brand-color-swatches">
              {draft.detectedColors.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={"brand-color-swatch" + (draft.color === c && draft.colorSource === "logo" ? " selected" : "")}
                  onClick={() => pickColor(c, "logo")}
                  aria-label={"Logo color " + c}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        )}

        <div className="brand-color-group">
          <div className="brand-color-group-label">Presets</div>
          <div className="brand-color-swatches">
            {BRAND_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={"brand-color-swatch" + (draft.color === c && draft.colorSource === "preset" ? " selected" : "")}
                onClick={() => pickColor(c, "preset")}
                aria-label={c}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>

        <div className="brand-color-group">
          <div className="brand-color-group-label">Custom</div>
          <div className="brand-color-custom">
            <label className="brand-color-picker-wrap" aria-label="Pick custom brand color">
              <input
                type="color"
                className="brand-color-picker"
                value={colorToHex(draft.colorSource === "custom" ? draft.color : draft.detectedColors[0] || "#1a2744")}
                onChange={(e) => pickColor(e.target.value, "custom")}
              />
              <span className="brand-color-picker-preview" style={{ background: draft.color }} />
            </label>
            <input
              className="input brand-color-hex"
              value={draft.colorSource === "custom" && draft.color.startsWith("#") ? draft.color : ""}
              placeholder="#1A2744"
              onChange={(e) => {
                const v = e.target.value.trim();
                if (/^#[0-9a-fA-F]{6}$/.test(v)) pickColor(v, "custom");
              }}
            />
          </div>
        </div>
      </div>

      <div className="field">
        <label>Google Drive folder</label>
        <div className="drive-folder-field">
          <span className="drive-folder-icon"><Icon name="folder" size={18} /></span>
          <input
            className="input"
            type="url"
            value={draft.driveFolderUrl}
            onChange={(e) => upd({ driveFolderUrl: e.target.value })}
            placeholder="https://drive.google.com/drive/folders/…"
          />
        </div>
        <div className="help">
          Paste a shared Drive folder link. Keel will link it in Resources for this client&apos;s team.
        </div>
      </div>

      <div className="field">
        <label>Description</label>
        <textarea className="input" rows={2} value={draft.desc} onChange={(e) => upd({ desc: e.target.value })} placeholder="One sentence about the engagement and goals." />
      </div>
    </div>
  );
}

function StepTeam({ draft, updTeam, staff }) {
  return (
    <div>
      <h3 style={{ fontFamily: "var(--fs-font-display)", margin: "0 0 6px", color: "var(--fs-navy)" }}>Assign your team</h3>
      <p className="mut" style={{ fontSize: 13, margin: "0 0 22px" }}>
        Select staff on this account and toggle their role. Assigned staff see the client in their workspace switcher.
      </p>

      {staff.length > 0 ? (
        <div className="staff-assign-list">
          {staff.map((member) => {
            const name = member.name;
            const assigned = isPersonAssigned(draft.team, name);
            const roles = personRoles(draft.team, name);

            return (
              <div key={name} className={"staff-assign-row" + (assigned ? " assigned" : "")}>
                <label className="staff-assign-name">
                  <input
                    type="checkbox"
                    checked={assigned}
                    onChange={(e) => updTeam(setPersonAssigned(draft.team, name, e.target.checked))}
                  />
                  <span>
                    <span className="staff-assign-name-text">{name}</span>
                    {member.title && <span className="mut staff-assign-title">{member.title}</span>}
                  </span>
                </label>
                {assigned && (
                  <div className="staff-role-toggles">
                    {STAFF_ROLES.map((r) => {
                      const on = roles.includes(r.key);
                      return (
                        <button
                          key={r.key}
                          type="button"
                          className={"btn sm " + (on ? "primary" : "secondary")}
                          onClick={() => updTeam(togglePersonRole(draft.team, name, r.key))}
                        >
                          {on && <Icon name="check" size={11} />}
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mut" style={{ fontSize: 13, padding: 16, background: "var(--fs-bone-50)", borderRadius: 4 }}>
          No staff members found. You can skip this step and assign team members later from Admin Console.
        </div>
      )}
    </div>
  );
}

function StepContacts({ draft, upd }) {
  const updC = (i, p) => upd({ contacts: draft.contacts.map((c, j) => (j === i ? { ...c, ...p } : c)) });
  const addC = () => upd({ contacts: [...draft.contacts, { name: "", email: "", role: "Staff contact", views: "Full client view" }] });
  const rmC = (i) => upd({ contacts: draft.contacts.filter((_, j) => j !== i) });

  const hasContacts = draft.contacts.some((c) => c.email.trim());

  return (
    <div>
      <h3 style={{ fontFamily: "var(--fs-font-display)", margin: "0 0 6px", color: "var(--fs-navy)" }}>Who gets client portal access?</h3>
      <p className="mut" style={{ fontSize: 13, margin: "0 0 16px" }}>
        Each contact can be invited to the client portal scoped to this account. You can skip this step and add contacts later in Admin settings.
      </p>

      {!hasContacts && (
        <div className="wizard-skip-note">
          <Icon name="comment" size={14} />
          <span>No contacts added yet — click Continue to skip and set them up later.</span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
        {draft.contacts.map((c, i) => (
          <div key={i} className="contact-row">
            <input className="input" placeholder="Name" value={c.name} onChange={(e) => updC(i, { name: e.target.value })} />
            <input className="input" type="email" placeholder="email@example.com" value={c.email} onChange={(e) => updC(i, { email: e.target.value })} />
            <input className="input" placeholder="Role / title" value={c.role} onChange={(e) => updC(i, { role: e.target.value })} />
            <select className="input" value={c.views} onChange={(e) => updC(i, { views: e.target.value })}>
              <option>Full client view</option>
              <option>Read-only</option>
              <option>Polling only</option>
              <option>Design proofs only</option>
            </select>
            <button type="button" className="btn ghost sm" onClick={() => rmC(i)} aria-label="Remove contact">
              <Icon name="x" size={13} />
            </button>
          </div>
        ))}
        <button type="button" className="btn secondary sm" style={{ alignSelf: "flex-start" }} onClick={addC}>
          <Icon name="plus" size={12} /> Add contact
        </button>
      </div>
    </div>
  );
}

function StepReview({ draft, isEdit }) {
  const staffLabels = enabledModuleLabels(draft.staffModules, STAFF_MODULE_OPTIONS);
  const clientLabels = enabledModuleLabels(draft.clientModules, CLIENT_MODULE_OPTIONS);

  return (
    <div>
      <h3 style={{ fontFamily: "var(--fs-font-display)", margin: "0 0 6px", color: "var(--fs-navy)" }}>{isEdit ? "Ready to save" : "Ready to go live"}</h3>
      <p className="mut" style={{ fontSize: 13, margin: "0 0 22px" }}>
        {isEdit ? "Confirm the updates below before saving." : "Confirm the details below. You can edit everything later from Admin Console."}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <ReviewBlock title="Identity">
          <div className="row" style={{ gap: 12, marginBottom: 10 }}>
            {draft.logo ? (
              <img src={draft.logo} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }} />
            ) : (
              <span style={{ width: 40, height: 40, borderRadius: "50%", background: draft.color, color: "var(--ks-on-ink)", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700 }}>{draft.initials}</span>
            )}
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--fs-navy)" }}>{draft.name || "[Client name]"}</div>
              <div className="mut" style={{ fontSize: 12 }}>{draft.type} · {draft.tag || "—"}</div>
            </div>
          </div>
          <p className="mut" style={{ fontSize: 13, margin: 0 }}>{draft.desc || <em>No description.</em>}</p>
          {draft.driveFolderUrl && (
            <div className="row" style={{ gap: 8, marginTop: 12, fontSize: 12 }}>
              <Icon name="folder" size={14} color="var(--fs-gold-700)" />
              <span className="mut" style={{ wordBreak: "break-all" }}>{draft.driveFolderUrl}</span>
            </div>
          )}
        </ReviewBlock>

        <ReviewBlock title="Team">
          <Row k="Lead strategist" v={draft.team.lead || "—"} />
          <Row k="Account lead" v={draft.team.account || "—"} />
          <Row k="Designer" v={draft.team.designer || "—"} />
          <Row k="Data lead" v={draft.team.data || "—"} />
          <Row k="Others" v={draft.team.others.length ? draft.team.others.join(", ") : "—"} />
        </ReviewBlock>

        <ReviewBlock title="Staff tabs">
          <div className="type-module-tags" style={{ marginTop: 4 }}>
            {staffLabels.map((label) => <Tag key={label} tone="navy">{label}</Tag>)}
          </div>
        </ReviewBlock>

        <ReviewBlock title="Client portal tabs">
          <div className="type-module-tags" style={{ marginTop: 4 }}>
            {clientLabels.map((label) => <Tag key={label} tone="gold">{label}</Tag>)}
          </div>
        </ReviewBlock>

        <ReviewBlock title="Portal invites" style={{ gridColumn: "1 / -1" }}>
          {draft.contacts.filter((c) => c.email).length > 0 ? (
            draft.contacts.filter((c) => c.email).map((c, i) => (
              <div key={i} style={{ fontSize: 13, color: "var(--fs-navy)", marginBottom: 4 }}>
                <strong>{c.name || "(no name)"}</strong>
                {" · "}
                <span style={{ fontFamily: "var(--fs-font-mono)" }}>{c.email}</span>
                {c.role && <Tag tone="outline" style={{ marginLeft: 8 }}>{c.role}</Tag>}
              </div>
            ))
          ) : (
            <p className="mut" style={{ fontSize: 13, margin: 0 }}>None — add portal contacts later in Admin settings.</p>
          )}
        </ReviewBlock>
      </div>
    </div>
  );
}

function ReviewBlock({ title, children, style }) {
  return (
    <div style={{ padding: 16, border: "1px solid var(--fs-border)", borderRadius: 4, background: "var(--fs-paper)", ...style }}>
      <div className="lbl" style={{ marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="row between" style={{ padding: "5px 0", fontSize: 13, borderBottom: "1px solid var(--fs-border)" }}>
      <span className="mut">{k}</span>
      <span style={{ fontWeight: 600, color: "var(--fs-navy)", textAlign: "right" }}>{v}</span>
    </div>
  );
}

export function NewClientWizard(props) {
  return <ClientWizard {...props} />;
}
