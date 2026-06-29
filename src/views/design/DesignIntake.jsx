import React, { useEffect, useState } from "react";
import { PageHead, Icon, Eyebrow } from "../../components/ui.jsx";
import { designApi, clientsApi } from "../../lib/api.js";
import { ASSET_TYPES, PRIORITIES } from "../../lib/design-status.js";

const EMPTY = {
  clientId: "",
  assetType: ASSET_TYPES[0],
  title: "",
  audience: "",
  cta: "",
  spec: "",
  deadline: "",
  priority: "Standard",
  budgetCode: "",
  assigneeId: "",
  attachments: [],
};

export function DesignIntake({ clientId, client, onBack, onSubmitted }) {
  const [form, setForm] = useState({ ...EMPTY, clientId: clientId !== "all" ? clientId : "" });
  const [clients, setClients] = useState([]);
  const [designers, setDesigners] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    clientsApi.list().then((r) => {
      const list = (r.clients || []).filter((c) => c.id !== "all");
      setClients(list);
      if (!form.clientId && list[0]) {
        setForm((f) => ({ ...f, clientId: list[0].id }));
      }
    });
    designApi.designers().then((r) => setDesigners(r.designers || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (clientId && clientId !== "all") {
      setForm((f) => ({ ...f, clientId }));
      if (client?.team?.designer) {
        const match = designers.find((d) => d.name === client.team.designer);
        if (match) setForm((f) => ({ ...f, assigneeId: match.id }));
      }
    }
  }, [clientId, client, designers]);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (draft = false) => {
    setError("");
    if (!form.title.trim() || !form.clientId) {
      setError("Title and client are required.");
      return;
    }
    setSaving(true);
    try {
      await designApi.create({
        title: form.title,
        clientId: form.clientId,
        priority: form.priority,
        due: form.deadline || null,
        assigneeId: form.assigneeId || null,
        assetType: form.assetType,
        audience: form.audience,
        cta: form.cta,
        spec: form.spec,
        budgetCode: form.budgetCode,
        attachments: form.attachments,
        draft,
      });
      onSubmitted?.();
    } catch (e) {
      setError(e.message || "Could not submit request.");
    } finally {
      setSaving(false);
    }
  };

  const addAttachment = () => {
    upd("attachments", [...form.attachments, { name: `reference-${form.attachments.length + 1}.pdf`, size: "—" }]);
  };

  return (
    <div>
      <PageHead
        title="Submit a Design Request"
        sub="Fill out the brief below. We'll route the request to the design team."
        actions={
          <button type="button" className="btn ghost" onClick={onBack}>
            <Icon name="chevron-left" size={14} /> Back to queue
          </button>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 28, alignItems: "flex-start" }}>
        <div className="card card-pad">
          {error && <div className="flash danger" style={{ marginBottom: 16 }}>{error}</div>}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <div className="field">
              <label>Client</label>
              <select className="input" value={form.clientId} onChange={(e) => upd("clientId", e.target.value)}>
                <option value="">Select client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Asset type</label>
              <select className="input" value={form.assetType} onChange={(e) => upd("assetType", e.target.value)}>
                {ASSET_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Working title</label>
            <input className="input" placeholder='e.g. "Lighthouse 30s TV spot"' value={form.title}
              onChange={(e) => upd("title", e.target.value)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <div className="field">
              <label>Primary audience</label>
              <input className="input" placeholder="e.g. suburban voters 35–54" value={form.audience}
                onChange={(e) => upd("audience", e.target.value)} />
            </div>
            <div className="field">
              <label>Key takeaway</label>
              <input className="input" placeholder="One sentence" value={form.cta}
                onChange={(e) => upd("cta", e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>Spec / creative direction</label>
            <textarea className="input" rows={5} value={form.spec}
              onChange={(e) => upd("spec", e.target.value)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18 }}>
            <div className="field">
              <label>Needed by</label>
              <input className="input" type="date" value={form.deadline} onChange={(e) => upd("deadline", e.target.value)} />
            </div>
            <div className="field">
              <label>Priority</label>
              <select className="input" value={form.priority} onChange={(e) => upd("priority", e.target.value)}>
                {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Assign designer</label>
              <select className="input" value={form.assigneeId} onChange={(e) => upd("assigneeId", e.target.value)}>
                <option value="">Unassigned (pool)</option>
                {designers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Budget code</label>
            <input className="input" placeholder="Optional" value={form.budgetCode}
              onChange={(e) => upd("budgetCode", e.target.value)} />
          </div>

          <div className="field">
            <label>Reference files</label>
            <div
              style={{
                border: "1.5px dashed var(--fs-border-strong)", borderRadius: 4,
                padding: "26px 20px", textAlign: "center", background: "var(--fs-bone-50)", cursor: "pointer",
              }}
              onClick={addAttachment}
            >
              <Icon name="upload" size={22} color="var(--fs-navy)" />
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fs-navy)", marginTop: 8 }}>
                Drop scripts, scratch tracks, or prior creative
              </div>
              <div style={{ fontSize: 12, color: "var(--fs-fg-muted)", marginTop: 4 }}>
                Metadata only in v1 · {form.attachments.length} file{form.attachments.length === 1 ? "" : "s"} attached
              </div>
            </div>
          </div>

          <div className="divider" />
          <div className="row between">
            <div className="mut" style={{ fontSize: 12 }}>Submitting notifies the assigned designer by email.</div>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn ghost" onClick={onBack}>Cancel</button>
              <button type="button" className="btn secondary" disabled={saving} onClick={() => submit(true)}>Save as draft</button>
              <button type="button" className="btn primary" disabled={saving} onClick={() => submit(false)}>
                Submit Request <Icon name="arrow-right" size={14} />
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card card-pad">
            <Eyebrow>What happens next</Eyebrow>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { title: "Brief enters queue", body: "Status moves to Intake or routes to assigned designer." },
                { title: "Designer assigned", body: form.assigneeId ? designers.find((d) => d.id === form.assigneeId)?.name || "Selected" : "Available in the unassigned pool." },
                { title: "First proof", body: "Designer uploads and marks ready for client review." },
                { title: "Client review", body: "Client comments or approves in Keel." },
              ].map((s, i) => (
                <div key={i}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)" }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: "var(--fs-fg-muted)", marginTop: 2 }}>{s.body}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card card-pad" style={{ background: "var(--fs-bone-50)" }}>
            <Eyebrow>SLA reminder</Eyebrow>
            <p className="fs-body-serif" style={{ fontSize: 14, margin: "10px 0 0", lineHeight: 1.55 }}>
              Standard requests turn around in <strong>3 business days</strong>. Election-critical work reaches first proof within <strong>24 hours</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
