import React, { useState, useRef } from "react";
import { PageHead, Icon } from "../components/ui.jsx";
import { useApi } from "../lib/useApi.js";
import { withClient, ApiError } from "../lib/api.js";
import { realClients } from "../lib/clients.js";
import { Loading } from "../components/Loading.jsx";
import { EmptyState } from "../components/EmptyState.jsx";

export function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + "T00:00:00" : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function toDatetimeLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function initialForm(fields, item, clientId) {
  const form = {};
  for (const f of fields) {
    const raw = item ? item[f.name] : undefined;
    if (f.type === "datetime") form[f.name] = toDatetimeLocal(raw);
    else if (f.type === "date") form[f.name] = raw ? String(raw).slice(0, 10) : "";
    else if (f.type === "tags") form[f.name] = Array.isArray(raw) ? raw.join(", ") : (raw || "");
    else if (raw !== undefined && raw !== null) form[f.name] = String(raw);
    else if (!item && f.type === "client" && clientId && clientId !== "all") form[f.name] = clientId;
    else form[f.name] = f.defaultValue != null ? String(f.defaultValue) : "";
  }
  return form;
}

function buildBody(fields, form) {
  const body = {};
  for (const f of fields) {
    let v = form[f.name];
    if (f.type === "datetime") v = v ? new Date(v).toISOString() : null;
    else if (f.type === "tags") v = String(v || "").split(",").map((t) => t.trim()).filter(Boolean);
    else if (f.type === "number") v = v === "" || v == null ? null : Number(v);
    else if (typeof v === "string") v = v.trim() || null;
    body[f.name] = v;
  }
  return body;
}

function ModuleModal({ title, children, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 150, background: "rgba(26,58,92,0.45)", display: "grid", placeItems: "center", padding: 24 }} onClick={onClose}>
      <div className="card" style={{ maxWidth: 480, width: "100%", padding: "22px 24px", maxHeight: "90vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
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

function ModuleForm({ fields, form, setForm, clients, saving, error, onSubmit, onCancel, submitLabel }) {
  const set = (name) => (e) => setForm({ ...form, [name]: e.target.value });
  return (
    <form className="col" style={{ gap: 0 }} onSubmit={onSubmit}>
      {fields.map((f) => (
        <div className="field" key={f.name}>
          <label>{f.label}</label>
          {f.type === "select" ? (
            <select className="input" required={f.required} value={form[f.name]} onChange={set(f.name)}>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : f.type === "client" ? (
            <select className="input" required={f.required} value={form[f.name]} onChange={set(f.name)}>
              <option value="">{f.required ? "Select client…" : "Firm-wide (no client)"}</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : f.type === "textarea" ? (
            <textarea className="input" rows={3} required={f.required} placeholder={f.placeholder}
              value={form[f.name]} onChange={set(f.name)} />
          ) : (
            <input
              className="input"
              type={f.type === "datetime" ? "datetime-local"
                : f.type === "date" ? "date"
                : f.type === "number" ? "number"
                : f.type === "url" ? "url"
                : f.type === "email" ? "email"
                : "text"}
              step={f.type === "number" ? "any" : undefined}
              required={f.required}
              placeholder={f.placeholder}
              value={form[f.name]}
              onChange={set(f.name)}
            />
          )}
          {f.help && <div className="help">{f.help}</div>}
        </div>
      ))}
      {error && (
        <div style={{ fontSize: 13, color: "var(--fs-danger)", marginBottom: 12 }}>{error}</div>
      )}
      <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn primary" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

/**
 * Generic API-backed list for the lighter modules. When `crud` and `fields`
 * are provided and the user is staff/admin, the view gains an Add button,
 * per-row edit/delete actions, and a shared modal form.
 */
export function ModuleListView({
  title, sub, endpoint, clientId, role, itemKey = "items",
  emptyTitle, emptyDescription, emptyIcon = "folder",
  renderItem, columns,
  crud, fields, itemName = "item", addLabel,
  actions,
}) {
  const canWrite = !!crud && !!fields && role !== "client";
  const path = withClient(endpoint, clientId);
  const { data, loading, error, reload } = useApi(path, [clientId]);
  const clientsRes = useApi("/clients", []);
  const clients = realClients(clientsRes.data?.clients);
  const items = data?.[itemKey] || [];

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const savingRef = useRef(false); // blocks double-submit before React re-renders

  const openCreate = () => {
    setForm(initialForm(fields, null, clientId));
    setFormError("");
    setModal({ mode: "create" });
  };
  const openEdit = (item) => {
    setForm(initialForm(fields, item, clientId));
    setFormError("");
    setModal({ mode: "edit", item });
  };
  const openDelete = (item) => {
    setFormError("");
    setModal({ mode: "delete", item });
  };
  const closeModal = () => {
    setModal(null);
    setFormError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setFormError("");
    try {
      const body = buildBody(fields, form);
      if (modal.mode === "edit") await crud.update(modal.item.id, body);
      else await crud.create(body);
      closeModal();
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not save " + itemName);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setFormError("");
    try {
      await crud.remove(modal.item.id);
      closeModal();
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not delete " + itemName);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const addButton = canWrite ? (
    <button type="button" className="btn primary" onClick={openCreate}>
      <Icon name="plus" size={14} /> {addLabel || "Add " + itemName}
    </button>
  ) : null;

  const itemLabel = (item) => item.title || item.name || item.headline || "this " + itemName;

  return (
    <div>
      <PageHead title={title} sub={sub} actions={(actions || addButton) && <>{actions}{addButton}</>} />
      {loading && <Loading />}
      {error && (
        <div className="card card-pad" style={{ color: "#7a2210", fontSize: 13 }}>{error.message}</div>
      )}
      {!loading && !error && items.length === 0 && (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          icon={emptyIcon}
          actionLabel={canWrite ? (addLabel || "Add " + itemName) : undefined}
          onAction={canWrite ? openCreate : undefined}
        />
      )}
      {!loading && !error && items.length > 0 && (
        <div className="card">
          <table className="tbl">
            {columns && (
              <thead>
                <tr>
                  {columns.map((c) => <th key={c}>{c}</th>)}
                  {canWrite && <th></th>}
                </tr>
              </thead>
            )}
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  {renderItem(item, { clients })}
                  {canWrite && (
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button type="button" className="btn ghost sm" onClick={() => openEdit(item)} aria-label={"Edit " + itemName}>
                        <Icon name="pen" size={14} />
                      </button>
                      <button type="button" className="btn ghost sm" onClick={() => openDelete(item)} aria-label={"Delete " + itemName}>
                        <Icon name="x" size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && modal.mode !== "delete" && (
        <ModuleModal title={(modal.mode === "edit" ? "Edit " : "Add ") + itemName} onClose={closeModal}>
          <ModuleForm
            fields={fields}
            form={form}
            setForm={setForm}
            clients={clients}
            saving={saving}
            error={formError}
            onSubmit={handleSubmit}
            onCancel={closeModal}
            submitLabel={modal.mode === "edit" ? "Save changes" : "Add " + itemName}
          />
        </ModuleModal>
      )}

      {modal?.mode === "delete" && (
        <ModuleModal title={"Delete " + itemName} onClose={closeModal}>
          <p style={{ fontSize: 13, margin: "0 0 16px" }}>
            Delete <strong style={{ color: "var(--fs-navy)" }}>{itemLabel(modal.item)}</strong>? This cannot be undone.
          </p>
          {formError && (
            <div style={{ fontSize: 13, color: "var(--fs-danger)", marginBottom: 12 }}>{formError}</div>
          )}
          <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="btn secondary" onClick={closeModal}>Cancel</button>
            <button type="button" className="btn danger" disabled={saving} onClick={handleDelete}>
              {saving ? "Deleting…" : "Delete"}
            </button>
          </div>
        </ModuleModal>
      )}
    </div>
  );
}

export function cell(text, opts = {}) {
  return <td className={opts.mut ? "mut" : ""} style={opts.style}>{text ?? "—"}</td>;
}
