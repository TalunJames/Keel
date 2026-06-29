import React, { useState, useEffect } from "react";
import { Icon, Eyebrow, Tag } from "../components/ui.jsx";
import { clientsApi, teamApi } from "../lib/api.js";
import {
  CLIENT_TYPE_PRESETS,
  STAFF_MODULE_OPTIONS,
  CLIENT_MODULE_OPTIONS,
  modulesForType,
  getPreset,
  enabledModuleLabels,
} from "../lib/client-type-presets.js";

const BRAND_COLORS = [
  "var(--fs-navy)", "var(--fs-navy-600)", "var(--fs-gold-700)",
  "#2F6B4F", "#7A5AE0", "#A8341E", "#1E6B82",
];

const STAFF_ROLES = [
  { key: "lead", label: "Lead strategist", help: "Primary point of contact and senior counsel." },
  { key: "account", label: "Account lead", help: "Owns delivery, billing, and weekly cadence." },
  { key: "designer", label: "Lead designer", help: "Owns creative briefs, proofs, and assets." },
  { key: "data", label: "Data & analytics lead", help: "Owns voter file, polling, and modeling." },
];

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
  staffModules: defaultModules.staffModules,
  clientModules: defaultModules.clientModules,
  team: { lead: "", account: "", designer: "", data: "", others: [] },
  contacts: [{ name: "", email: "", role: "Principal", views: "Full client view" }],
};

function slugFromTag(tag) {
  return String(tag || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function NewClientWizard({ onCancel, onCreated }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [staff, setStaff] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    teamApi.list().then((r) => setStaff(r.members || [])).catch(() => setStaff([]));
  }, []);

  useEffect(() => {
    if (!draft.name) return;
    const initials = draft.name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
    const tag = draft.name.split(/\s+/)[0].toUpperCase().slice(0, 8);
    setDraft((d) => ({ ...d, initials, tag }));
  }, [draft.name]);

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
    if (step === 2) return !!draft.team.lead;
    if (step === 3) return draft.contacts.some((c) => c.email.trim());
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
    reader.onload = () => upd({ logo: reader.result });
    reader.readAsDataURL(file);
    setError("");
  };

  const toggleOther = (name) => {
    const has = draft.team.others.includes(name);
    updTeam({ others: has ? draft.team.others.filter((x) => x !== name) : [...draft.team.others, name] });
  };

  const createClient = async () => {
    setSaving(true);
    setError("");
    try {
      const { contacts, team, desc, logo, staffModules, clientModules, ...core } = draft;
      const result = await clientsApi.create({
        ...core,
        logo,
        account: team.account || team.lead || "",
        audience: desc || "",
        payload: { team, contacts, desc, staffModules, clientModules },
      });
      onCreated?.(result.id);
    } catch (err) {
      setError(err.message || "Could not create client.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="row between" style={{ alignItems: "flex-start", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <div>
          <Eyebrow>New client onboarding</Eyebrow>
          <h2 style={{ fontFamily: "var(--fs-font-display)", fontSize: 30, fontWeight: 700, color: "var(--fs-navy)", margin: "10px 0 4px", letterSpacing: "-0.01em" }}>
            Set up a new client
          </h2>
          <p className="mut" style={{ fontSize: 14, margin: 0, maxWidth: 580 }}>
            Choose a service line to configure Keel tabs, then walk through identity, team, and portal contacts.
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
              onClick={() => i <= step && setStep(i)}
              disabled={i > step}
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
        {step === 1 && <StepIdentity draft={draft} upd={upd} onLogoPick={onLogoPick} />}
        {step === 2 && <StepTeam draft={draft} updTeam={updTeam} staff={staff} toggleOther={toggleOther} />}
        {step === 3 && <StepContacts draft={draft} upd={upd} />}
        {step === 4 && <StepReview draft={draft} />}
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
          <button type="button" className="btn accent" disabled={saving} onClick={createClient}>
            <Icon name="check" size={14} /> {saving ? "Creating…" : "Create client"}
          </button>
        )}
      </div>
    </div>
  );
}

function StepServiceLine({ draft, selectType, isCustom, preset, updMod }) {
  return (
    <div>
      <Eyebrow>Step 1 · Service line</Eyebrow>
      <h3 style={{ fontFamily: "var(--fs-font-display)", margin: "10px 0 6px", color: "var(--fs-navy)" }}>What kind of engagement is this?</h3>
      <p className="mut" style={{ fontSize: 13, margin: "0 0 22px" }}>
        Your selection sets which Keel tabs are enabled for staff and the client portal. Choose Custom to configure manually.
      </p>

      <div className="type-card-grid">
        {CLIENT_TYPE_PRESETS.map((p) => {
          const selected = draft.type === p.id;
          return (
            <button
              key={p.id}
              type="button"
              className={"type-card" + (selected ? " selected" : "")}
              onClick={() => selectType(p.id)}
            >
              <span className="type-card-icon">
                <Icon name={p.icon} size={32} />
              </span>
              <span className="type-card-label">{p.label}</span>
              <span className="type-card-desc">{p.desc}</span>
              {selected && (
                <span className="type-card-check">
                  <Icon name="check" size={14} />
                </span>
              )}
            </button>
          );
        })}
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

function ModuleToggle({ mod, on, onChange }) {
  const active = on || mod.mandatory;
  return (
    <label className={"module-toggle" + (active ? " on" : "") + (mod.mandatory ? " locked" : "")}>
      <span className="module-toggle-icon">
        <Icon name={mod.icon} size={18} />
      </span>
      <span className="module-toggle-label">{mod.label}</span>
      <input
        type="checkbox"
        checked={active}
        disabled={mod.mandatory}
        onChange={(e) => onChange(e.target.checked)}
        className="module-toggle-input"
      />
      <span className="module-toggle-switch" aria-hidden="true" />
    </label>
  );
}

function StepIdentity({ draft, upd, onLogoPick }) {
  return (
    <div>
      <Eyebrow>Step 2 · Identity & brand</Eyebrow>
      <h3 style={{ fontFamily: "var(--fs-font-display)", margin: "10px 0 6px", color: "var(--fs-navy)" }}>Who is this client?</h3>
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
              <input className="input" value={slugFromTag(draft.tag)} readOnly style={{ opacity: 0.7 }} />
              <div className="help">Auto-generated from tag.</div>
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
            <button type="button" className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => upd({ logo: null })}>
              Remove logo
            </button>
          )}
        </div>
      </div>

      <div className="field">
        <label>Brand color</label>
        <div className="row" style={{ gap: 8 }}>
          {BRAND_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => upd({ color: c })} aria-label={c} style={{
              width: 32, height: 32, background: c, borderRadius: "50%",
              border: draft.color === c ? "3px solid var(--fs-gold)" : "1px solid var(--fs-border)",
              cursor: "pointer",
            }} />
          ))}
        </div>
      </div>

      <div className="field">
        <label>Description</label>
        <textarea className="input" rows={2} value={draft.desc} onChange={(e) => upd({ desc: e.target.value })} placeholder="One sentence about the engagement and goals." />
      </div>
    </div>
  );
}

function StepTeam({ draft, updTeam, staff, toggleOther }) {
  const names = staff.map((s) => s.name);

  return (
    <div>
      <Eyebrow>Step 3 · Client staff</Eyebrow>
      <h3 style={{ fontFamily: "var(--fs-font-display)", margin: "10px 0 6px", color: "var(--fs-navy)" }}>Assign your team</h3>
      <p className="mut" style={{ fontSize: 13, margin: "0 0 22px" }}>
        Choose who owns this account. Assigned staff see the client in their workspace switcher.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {STAFF_ROLES.map((r) => (
          <div key={r.key} className="field">
            <label>{r.label}</label>
            <select className="input" value={draft.team[r.key]} onChange={(e) => updTeam({ [r.key]: e.target.value })}>
              <option value="">Select…</option>
              {names.map((n) => <option key={n}>{n}</option>)}
            </select>
            <div className="help">{r.help}</div>
          </div>
        ))}
      </div>

      {names.length > 0 && (
        <div className="field">
          <label>Additional team members</label>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            {names.map((n) => {
              const on = draft.team.others.includes(n);
              if (STAFF_ROLES.some((r) => draft.team[r.key] === n)) return null;
              return (
                <button key={n} type="button" onClick={() => toggleOther(n)} className={"btn " + (on ? "primary" : "secondary")} style={{ padding: "5px 10px", fontSize: 12 }}>
                  {on && <Icon name="check" size={11} />} {n}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {names.length === 0 && (
        <div className="mut" style={{ fontSize: 13, padding: 16, background: "var(--fs-bone-50)", borderRadius: 4 }}>
          No staff members found. You can still continue — assign team members later from Admin Console.
        </div>
      )}
    </div>
  );
}

function StepContacts({ draft, upd }) {
  const updC = (i, p) => upd({ contacts: draft.contacts.map((c, j) => (j === i ? { ...c, ...p } : c)) });
  const addC = () => upd({ contacts: [...draft.contacts, { name: "", email: "", role: "Staff contact", views: "Full client view" }] });
  const rmC = (i) => upd({ contacts: draft.contacts.filter((_, j) => j !== i) });

  return (
    <div>
      <Eyebrow>Step 4 · Portal contacts</Eyebrow>
      <h3 style={{ fontFamily: "var(--fs-font-display)", margin: "10px 0 6px", color: "var(--fs-navy)" }}>Who gets client portal access?</h3>
      <p className="mut" style={{ fontSize: 13, margin: "0 0 22px" }}>
        Each contact can be invited to the client portal scoped to this account.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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

function StepReview({ draft }) {
  const staffLabels = enabledModuleLabels(draft.staffModules, STAFF_MODULE_OPTIONS);
  const clientLabels = enabledModuleLabels(draft.clientModules, CLIENT_MODULE_OPTIONS);

  return (
    <div>
      <Eyebrow>Step 5 · Review & create</Eyebrow>
      <h3 style={{ fontFamily: "var(--fs-font-display)", margin: "10px 0 6px", color: "var(--fs-navy)" }}>Ready to go live</h3>
      <p className="mut" style={{ fontSize: 13, margin: "0 0 22px" }}>
        Confirm the details below. You can edit everything later from Admin Console.
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
          {draft.contacts.filter((c) => c.email).map((c, i) => (
            <div key={i} style={{ fontSize: 13, color: "var(--fs-navy)", marginBottom: 4 }}>
              <strong>{c.name || "(no name)"}</strong>
              {" · "}
              <span style={{ fontFamily: "var(--fs-font-mono)" }}>{c.email}</span>
              {c.role && <Tag tone="outline" style={{ marginLeft: 8 }}>{c.role}</Tag>}
            </div>
          ))}
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
