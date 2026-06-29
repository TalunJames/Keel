import React, { useEffect, useState } from "react";
import { PageHead, Icon, Tag, Avatar, Eyebrow } from "../../components/ui.jsx";
import { designApi } from "../../lib/api.js";
import { statusTone, DESIGNER_TRANSITIONS, DESIGN_STATUSES } from "../../lib/design-status.js";
import { Loading } from "../../components/Loading.jsx";

function formatWhen(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function DesignProof({ requestId, user, role, onBack, onUpdated }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeProof, setActiveProof] = useState(null);
  const [draft, setDraft] = useState("");
  const [proofVersion, setProofVersion] = useState("");
  const [proofLabel, setProofLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const isClient = role === "client";
  const isStaff = role === "staff" || role === "admin";
  const isDesigner = !!user?.isDesigner;
  const isAssignee = data?.request?.assigneeId === user?.id;

  const load = () => {
    setLoading(true);
    designApi.get(requestId).then((d) => {
      setData(d);
      const proofs = d.proofs || [];
      setActiveProof(proofs[proofs.length - 1]?.id || null);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [requestId]);

  if (loading && !data) return <Loading />;
  if (!data?.request) {
    return (
      <div className="card card-pad">
        <p>Request not found.</p>
        <button type="button" className="btn ghost" onClick={onBack}>Back</button>
      </div>
    );
  }

  const { request, proofs, comments } = data;
  const currentProof = proofs.find((p) => p.id === activeProof) || proofs[proofs.length - 1];

  const canDesign = isStaff || (isDesigner && isAssignee);
  const designerTransitions = DESIGNER_TRANSITIONS[request.status] || [];

  const postComment = async (marker = null) => {
    if (!draft.trim()) return;
    await designApi.addComment(requestId, { text: draft, proofId: currentProof?.id, marker });
    setDraft("");
    load();
    onUpdated?.();
  };

  const handleFrameClick = (e) => {
    if (!draft.trim()) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    postComment({ x, y });
  };

  const uploadProof = async () => {
    if (!proofVersion.trim()) return;
    setSaving(true);
    try {
      await designApi.addProof(requestId, { version: proofVersion, label: proofLabel || proofVersion });
      setProofVersion("");
      setProofLabel("");
      load();
      onUpdated?.();
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status) => {
    await designApi.update(requestId, { status });
    load();
    onUpdated?.();
  };

  const readyForReview = async () => {
    await designApi.update(requestId, { action: "ready_for_review" });
    load();
    onUpdated?.();
  };

  const clientAction = async (action) => {
    await designApi.update(requestId, { action });
    load();
    onUpdated?.();
  };

  return (
    <div>
      <PageHead
        title={request.title}
        sub={`DR-${request.id} · ${request.clientName || request.clientId} · ${request.status} · ${request.assigneeName ? `Assigned to ${request.assigneeName}` : "Unassigned"}`}
        actions={
          <>
            <button type="button" className="btn ghost" onClick={onBack}>
              <Icon name="chevron-left" size={14} /> Queue
            </button>
            {canDesign && request.status === "In Design" && (
              <button type="button" className="btn secondary" onClick={readyForReview}>
                <Icon name="check" size={13} /> Ready for review
              </button>
            )}
            {isClient && request.status === "Proofing" && (
              <>
                <button type="button" className="btn secondary" onClick={() => clientAction("revisions")}>Request revisions</button>
                <button type="button" className="btn primary" onClick={() => clientAction("approve")}>
                  <Icon name="check" size={13} /> Approve
                </button>
              </>
            )}
            {isStaff && (
              <select
                className="input"
                style={{ fontSize: 13, padding: "6px 10px", width: "auto" }}
                value={request.status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {DESIGN_STATUSES.filter((s) => s !== "draft").map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
            {!isStaff && canDesign && designerTransitions.map((s) => (
              <button key={s} type="button" className="btn secondary" onClick={() => setStatus(s)}>{s}</button>
            ))}
          </>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, alignItems: "flex-start" }}>
        <div>
          <div className="card" style={{ padding: 24 }}>
            <div className="row between" style={{ marginBottom: 14 }}>
              <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
                {proofs.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={"btn " + (p.id === (currentProof?.id) ? "primary" : "ghost")}
                    style={{ padding: "4px 12px", fontSize: 12 }}
                    onClick={() => setActiveProof(p.id)}
                  >
                    {p.version}
                  </button>
                ))}
                <Tag tone={statusTone(request.status)}>{request.status}</Tag>
              </div>
            </div>

            <div
              style={{
                position: "relative", aspectRatio: "16/9",
                background: "linear-gradient(180deg, #0e2238 0%, #1A3A5C 60%, #2A527F 100%)",
                borderRadius: 2, overflow: "hidden", cursor: draft.trim() ? "crosshair" : "default",
              }}
              onClick={draft.trim() ? handleFrameClick : undefined}
            >
              <div style={{
                position: "absolute", inset: 0, display: "grid", placeItems: "center",
                color: "rgba(255,255,255,0.7)", fontSize: 14,
              }}>
                {currentProof ? `${currentProof.label || currentProof.version} preview` : "No proof uploaded yet"}
              </div>
              {(comments || []).filter((c) => c.marker).map((c, i) => (
                <div
                  key={c.id}
                  style={{
                    position: "absolute", left: `${c.marker.x}%`, top: `${c.marker.y}%`,
                    width: 26, height: 26, borderRadius: "50%",
                    background: "var(--fs-gold)", color: "var(--fs-navy-900)",
                    display: "grid", placeItems: "center", fontWeight: 700, fontSize: 12,
                    border: "2px solid var(--fs-paper)", transform: "translate(-50%, -50%)",
                  }}
                >
                  {i + 1}
                </div>
              ))}
            </div>
            <div className="mut" style={{ fontSize: 12, marginTop: 10 }}>
              {draft.trim() ? "Click the frame to place a comment marker." : "Type a comment below to enable click-to-place markers."}
            </div>
          </div>

          {canDesign && (
            <div className="card card-pad" style={{ marginTop: 16 }}>
              <Eyebrow>Upload proof version</Eyebrow>
              <div className="row" style={{ gap: 12, marginTop: 12, flexWrap: "wrap" }}>
                <input className="input" placeholder="Version (e.g. v3)" value={proofVersion}
                  onChange={(e) => setProofVersion(e.target.value)} style={{ maxWidth: 120 }} />
                <input className="input" placeholder="Label" value={proofLabel}
                  onChange={(e) => setProofLabel(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
                <button type="button" className="btn primary" disabled={saving} onClick={uploadProof}>Add version</button>
              </div>
              <div className="help" style={{ marginTop: 8 }}>Stores version metadata; file hosting is manual in v1.</div>
            </div>
          )}

          {request.spec && (
            <div className="card card-pad" style={{ marginTop: 16 }}>
              <Eyebrow>Creative direction</Eyebrow>
              <p style={{ fontSize: 13, lineHeight: 1.55, marginTop: 10, whiteSpace: "pre-wrap" }}>{request.spec}</p>
            </div>
          )}
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 220px)" }}>
          <div className="card-head">
            <h3>Comments · {(comments || []).length}</h3>
            {isClient && <Tag tone="navy">Client view</Tag>}
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {(comments || []).map((c) => (
              <div key={c.id} style={{ padding: "16px 18px", borderBottom: "1px solid var(--fs-border)" }}>
                <div className="row" style={{ gap: 10, marginBottom: 6 }}>
                  <Avatar name={c.authorName} size={20} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)" }}>{c.authorName}</div>
                    <div style={{ fontSize: 11, color: "var(--fs-fg-subtle)" }}>{c.role} · {formatWhen(c.createdAt)}</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.55 }}>{c.text}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: 14, borderTop: "1px solid var(--fs-border)" }}>
            <textarea className="input" rows={2} placeholder="Add a comment…" value={draft}
              onChange={(e) => setDraft(e.target.value)} />
            <div className="row between" style={{ marginTop: 8 }}>
              <span className="mut" style={{ fontSize: 11 }}>Client comments email the assignee</span>
              <button type="button" className="btn primary sm" onClick={() => postComment()}>Post</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
