import React, { useEffect, useRef, useState } from "react";
import { PageHead, Icon, Tag, Avatar, Eyebrow } from "../../components/ui.jsx";
import { designApi } from "../../lib/api.js";
import { statusTone, DESIGNER_TRANSITIONS, DESIGN_STATUSES } from "../../lib/design-status.js";
import { safeUrl, BLANK_REL } from "../../lib/safe-url.js";
import { Loading } from "../../components/Loading.jsx";

const MAIL_PROOF_ASSET = "Print — direct mail";

function parsePeriscopeShareId(input) {
  const raw = (input || "").trim().toLowerCase();
  if (!raw) return "";
  const pathMatch = raw.match(/\/s\/([a-z0-9]{6,32})/i);
  if (pathMatch) return pathMatch[1].toLowerCase();
  if (/^[a-z0-9]{6,32}$/.test(raw)) return raw;
  return "";
}

function PeriscopeProofPanel({ shareId, canDesign, requestId, proofId, onLinked }) {
  const [draft, setDraft] = useState(shareId || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setDraft(shareId || ""); }, [shareId]);

  const saveShare = async () => {
    const id = parsePeriscopeShareId(draft);
    if (!id) {
      setError("Paste a Periscope share link or id (e.g. abc123def4).");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await designApi.linkPeriscopeShare(requestId, proofId, id);
      onLinked?.();
    } catch (e) {
      setError(e.message || "Could not link share.");
    } finally {
      setSaving(false);
    }
  };

  if (shareId) {
    return (
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <iframe
          title="Mailer proof"
          src={`/periscope/s/${shareId}`}
          style={{ width: "100%", height: "min(72vh, 820px)", border: 0, display: "block", background: "#0a0c10" }}
        />
        {canDesign && (
          <div className="card-pad" style={{ borderTop: "1px solid var(--fs-border)" }}>
            <div className="row between" style={{ gap: 12, flexWrap: "wrap" }}>
              <span className="mut" style={{ fontSize: 12 }}>Share id: {shareId}</span>
              <a className="btn ghost sm" href={`/periscope/app`} target="_blank" rel="noopener noreferrer">
                Open Periscope editor
              </a>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card card-pad">
      <Eyebrow>Periscope mailer proof</Eyebrow>
      <p className="mut" style={{ fontSize: 13, lineHeight: 1.55, marginTop: 10 }}>
        Configure fold geometry and annotations in Periscope, then paste the share link here so clients see the interactive 3D mailer.
      </p>
      {canDesign ? (
        <div style={{ marginTop: 16 }}>
          <div className="row" style={{ gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <a className="btn primary" href="/periscope/app" target="_blank" rel="noopener noreferrer">
              <Icon name="external" size={13} /> Open Periscope
            </a>
          </div>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <input
              className="input"
              placeholder="Share link or id"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              style={{ flex: 1, minWidth: 200 }}
            />
            <button type="button" className="btn secondary" disabled={saving} onClick={saveShare}>
              {saving ? "Linking…" : "Attach share"}
            </button>
          </div>
          {error && <div className="flash danger" style={{ marginTop: 10 }}>{error}</div>}
        </div>
      ) : (
        <p className="mut" style={{ fontSize: 13, marginTop: 12 }}>Waiting for the design team to publish a Periscope proof.</p>
      )}
    </div>
  );
}

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
  const [proofFile, setProofFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const fileInputRef = useRef(null);

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
  const isMailerProof = request.assetType === MAIL_PROOF_ASSET;
  const periscopeShareId = currentProof?.periscopeShareId || null;

  const canDesign = isStaff || (isDesigner && isAssignee);
  const designerTransitions = DESIGNER_TRANSITIONS[request.status] || [];

  const runAction = async (fn) => {
    setActionError("");
    try {
      await fn();
      load();
      onUpdated?.();
    } catch (e) {
      setActionError(e.message || "Something went wrong. Try again.");
    }
  };

  const postComment = (marker = null) => {
    if (!draft.trim()) return;
    runAction(async () => {
      await designApi.addComment(requestId, { text: draft, proofId: currentProof?.id, marker });
      setDraft("");
    });
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
    setActionError("");
    try {
      let fileUrl = "";
      let mimeType = "";
      if (proofFile) {
        const uploaded = await designApi.upload(proofFile);
        fileUrl = uploaded.url;
        mimeType = uploaded.mimeType;
      }
      await designApi.addProof(requestId, {
        version: proofVersion,
        label: proofLabel || proofVersion,
        fileUrl,
        mimeType,
      });
      setProofVersion("");
      setProofLabel("");
      setProofFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      load();
      onUpdated?.();
    } catch (e) {
      setActionError(e.message || "Could not upload proof.");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = (status) => runAction(() => designApi.update(requestId, { status }));
  const readyForReview = () => runAction(() => designApi.update(requestId, { action: "ready_for_review" }));
  const clientAction = (action) => runAction(() => designApi.update(requestId, { action }));

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

      {actionError && (
        <div className="flash danger" style={{ marginBottom: 16 }}>{actionError}</div>
      )}

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

            {isMailerProof && currentProof ? (
              <PeriscopeProofPanel
                shareId={periscopeShareId}
                canDesign={canDesign}
                requestId={requestId}
                proofId={currentProof.id}
                onLinked={load}
              />
            ) : (
            <div
              style={{
                position: "relative", aspectRatio: "16/9",
                background: "linear-gradient(180deg, #0e2238 0%, #1A3A5C 60%, #2A527F 100%)",
                borderRadius: 2, overflow: "hidden", cursor: draft.trim() ? "crosshair" : "default",
              }}
              onClick={draft.trim() ? handleFrameClick : undefined}
            >
              {currentProof?.fileUrl && currentProof.mimeType?.startsWith("image/") ? (
                <img
                  src={currentProof.fileUrl}
                  alt={currentProof.label || currentProof.version}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", background: "var(--fs-paper)", pointerEvents: "none" }}
                />
              ) : currentProof?.fileUrl && currentProof.mimeType === "application/pdf" ? (
                <embed
                  src={currentProof.fileUrl}
                  type="application/pdf"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: draft.trim() ? "none" : "auto" }}
                />
              ) : (
                <div style={{
                  position: "absolute", inset: 0, display: "grid", placeItems: "center",
                  color: "rgba(255,255,255,0.7)", fontSize: 14,
                }}>
                  {currentProof ? `${currentProof.label || currentProof.version} — no file attached` : "No proof uploaded yet"}
                </div>
              )}
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
            )}
            {!isMailerProof && (
            <div className="mut" style={{ fontSize: 12, marginTop: 10 }}>
              {draft.trim() ? "Click the frame to place a comment marker." : "Type a comment below to enable click-to-place markers."}
            </div>
            )}
          </div>

          {canDesign && (
            <div className="card card-pad" style={{ marginTop: 16 }}>
              <Eyebrow>Upload proof version</Eyebrow>
              <div className="row" style={{ gap: 12, marginTop: 12, flexWrap: "wrap" }}>
                <input className="input" placeholder="Version (e.g. v3)" value={proofVersion}
                  onChange={(e) => setProofVersion(e.target.value)} style={{ maxWidth: 120 }} />
                <input className="input" placeholder="Label" value={proofLabel}
                  onChange={(e) => setProofLabel(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
                  onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                  style={{ display: "none" }}
                />
                <button type="button" className="btn secondary" disabled={saving} onClick={() => fileInputRef.current?.click()}>
                  <Icon name="upload" size={13} /> {proofFile ? proofFile.name : "Choose file"}
                </button>
                <button type="button" className="btn primary" disabled={saving || !proofVersion.trim()} onClick={uploadProof}>
                  {saving ? "Uploading…" : "Add version"}
                </button>
              </div>
              <div className="help" style={{ marginTop: 8 }}>PNG, JPG, GIF, WebP, or PDF up to 15 MB. File is optional — versions can track metadata only.</div>
            </div>
          )}

          {request.spec && (
            <div className="card card-pad" style={{ marginTop: 16 }}>
              <Eyebrow>Creative direction</Eyebrow>
              <p style={{ fontSize: 13, lineHeight: 1.55, marginTop: 10, whiteSpace: "pre-wrap" }}>{request.spec}</p>
            </div>
          )}

          {Array.isArray(request.attachments) && request.attachments.length > 0 && (
            <div className="card card-pad" style={{ marginTop: 16 }}>
              <Eyebrow>Reference files</Eyebrow>
              <div className="col" style={{ gap: 6, marginTop: 10 }}>
                {request.attachments.map((a, i) => {
                  const href = safeUrl(a.url);
                  return (
                    <div key={a.url || i} className="row" style={{ gap: 8, fontSize: 13 }}>
                      <Icon name="folder" size={13} color="var(--fs-navy)" />
                      {href ? (
                        <a href={href} target="_blank" rel={BLANK_REL} style={{ color: "var(--fs-navy)" }}>{a.name}</a>
                      ) : (
                        <span>{a.name}</span>
                      )}
                    </div>
                  );
                })}
              </div>
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
