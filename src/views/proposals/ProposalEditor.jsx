import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHead, Icon, Eyebrow, Tag } from "../../components/ui.jsx";
import { proposalsApi } from "../../lib/api.js";
import { useApi } from "../../lib/useApi.js";
import { Loading } from "../../components/Loading.jsx";
import { triageLabel, triageTone } from "../../lib/proposal-status.js";
import { BlockNode } from "./blocks/BlockNode.jsx";

function groupBlocks(blockTypes) {
  const grouped = {};
  for (const [id, meta] of Object.entries(blockTypes)) {
    if (id === "executive") continue;
    if (!grouped[meta.group]) grouped[meta.group] = [];
    grouped[meta.group].push({ id, ...meta });
  }
  return grouped;
}

export function ProposalEditor({ proposalId, client, user, onBack, onSaved }) {
  const { data: proposal, loading, reload } = useApi(`/proposals/${proposalId}`, [proposalId]);
  const clientType = proposal?.clientType || client?.type || "";
  const { data: libData } = useApi(
    clientType ? `/proposals/blocks?type=${encodeURIComponent(clientType)}` : "/proposals/blocks",
    [clientType],
  );
  const { data: tplData } = useApi(
    clientType ? `/proposals/templates?type=${encodeURIComponent(clientType)}` : "/proposals/templates",
    [clientType],
  );
  const { data: notesData, reload: reloadNotes } = useApi(`/proposals/${proposalId}/notes`, [proposalId]);

  const [blocks, setBlocks] = useState([]);
  const [title, setTitle] = useState("");
  const [sideTab, setSideTab] = useState("details");
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [draggingFromIndex, setDraggingFromIndex] = useState(null);
  const [draggingType, setDraggingType] = useState(null);
  const saveTimer = useRef(null);

  const blockTypes = useMemo(() => {
    const map = {};
    for (const b of libData?.blocks || []) {
      map[b.type] = { label: b.label, icon: b.icon, group: b.group, recommended: b.recommended };
    }
    return map;
  }, [libData]);

  const grouped = useMemo(() => groupBlocks(blockTypes), [blockTypes]);
  const templates = tplData?.templates || [];
  const notes = notesData?.notes || [];

  useEffect(() => {
    if (!proposal) return;
    setTitle(proposal.title || "");
    setBlocks(proposal.blocks || []);
  }, [proposal]);

  const persist = useCallback(async (patch) => {
    setSaving(true);
    try {
      await proposalsApi.update(proposalId, patch);
      setLastSaved(new Date());
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }, [proposalId, onSaved]);

  const scheduleSave = useCallback((patch) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(patch), 800);
  }, [persist]);

  const addBlock = (type) => {
    const defaultContent = libData?.blocks?.find((b) => b.type === type)?.defaultContent || {};
    const next = [...blocks, { id: `${type}-${Date.now()}`, type, content: { ...defaultContent } }];
    setBlocks(next);
    scheduleSave({ blocks: next });
  };

  const removeBlock = (id) => {
    const next = blocks.filter((b) => b.id !== id);
    setBlocks(next);
    scheduleSave({ blocks: next });
  };

  const moveBlock = (from, to) => {
    if (from === to || to < 0 || to >= blocks.length) return;
    const next = [...blocks];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setBlocks(next);
    scheduleSave({ blocks: next });
  };

  const updateBlockContent = (id, content) => {
    const next = blocks.map((b) => (b.id === id ? { ...b, content } : b));
    setBlocks(next);
    scheduleSave({ blocks: next });
  };

  const applyTemplate = async (tplId) => {
    const tpl = templates.find((t) => t.id === tplId);
    if (!tpl) return;
    const next = tpl.defaultBlocks.map((type, i) => {
      const def = libData?.blocks?.find((b) => b.type === type)?.defaultContent || {};
      return { id: `${type}-${i}-${Date.now()}`, type, content: { ...def } };
    });
    setBlocks(next);
    await persist({ blocks: next, templateId: tplId });
    reload();
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    await proposalsApi.notes.add(proposalId, { text: noteText.trim() });
    setNoteText("");
    reloadNotes();
  };

  if (loading && !proposal) return <Loading />;

  const cleatus = proposal?.cleatus;
  const editorClient = { name: proposal?.clientName || client?.name };

  return (
    <div>
      <PageHead
        eyebrow={proposal?.clientName + " · Proposal"}
        title="Build a proposal"
        sub="Drag blocks onto the canvas, edit inline, and save automatically. Cleatus RFP context appears in the sidebar."
        actions={
          <>
            <button type="button" className="btn ghost" onClick={onBack}>
              <Icon name="arrow-left" size={13} /> Back
            </button>
            <button type="button" className="btn secondary" disabled>
              <Icon name="download" size={13} /> Export PDF
            </button>
            <button type="button" className="btn primary" disabled>
              <Icon name="check" size={13} /> Send for sign-off
            </button>
          </>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr 300px", gap: 18, alignItems: "flex-start" }}>
        <aside style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card">
            <div className="card-head"><h3>Templates</h3></div>
            <div style={{ padding: 8 }}>
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    background: proposal?.templateId === t.id ? "var(--fs-navy-50)" : "transparent",
                    border: "1px solid " + (proposal?.templateId === t.id ? "var(--fs-navy)" : "transparent"),
                    borderRadius: 4,
                    cursor: "pointer",
                    marginBottom: 4,
                  }}
                >
                  <div className="row between">
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)", marginBottom: 3 }}>{t.name}</div>
                    {t.recommended && <Tag tone="gold" style={{ fontSize: 10 }}>Recommended</Tag>}
                  </div>
                  <div className="mut" style={{ fontSize: 11, lineHeight: 1.4 }}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Block library</h3></div>
            <div className="mut" style={{ padding: "8px 14px 4px", fontSize: 11 }}>
              Drag onto canvas, or click to append. Gold dots = recommended for this client type.
            </div>
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group} style={{ padding: "8px 8px 4px" }}>
                <div className="lbl" style={{ margin: "6px 6px 6px" }}>{group}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {items.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      draggable
                      onDragStart={() => { setDraggingType(b.id); setDraggingFromIndex(null); }}
                      onDragEnd={() => setDraggingType(null)}
                      onClick={() => addBlock(b.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "7px 10px",
                        background: b.recommended ? "var(--fs-gold-50)" : "var(--fs-bone-50)",
                        border: "1px solid " + (b.recommended ? "var(--fs-gold-200)" : "var(--fs-border)"),
                        borderRadius: 4,
                        cursor: "grab",
                        fontSize: 12,
                        color: "var(--fs-ink)",
                        textAlign: "left",
                      }}
                    >
                      <Icon name="grip" size={11} color="var(--fs-fg-subtle)" />
                      <Icon name={b.icon} size={13} color="var(--fs-navy)" />
                      <span style={{ flex: 1 }}>{b.label}</span>
                      {b.recommended && <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--fs-gold)" }} />}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div>
          <div className="row between" style={{ marginBottom: 10 }}>
            <div className="mut" style={{ fontSize: 12 }}>
              <strong style={{ color: "var(--fs-navy)" }}>{blocks.length}</strong> blocks
              {saving && <span> · Saving…</span>}
              {!saving && lastSaved && <span> · Saved</span>}
            </div>
          </div>

          <div
            style={{
              background: "var(--fs-paper)",
              border: "1px solid var(--fs-border)",
              borderRadius: 4,
              padding: "32px 40px",
              minHeight: 400,
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (draggingType) {
                addBlock(draggingType);
                setDraggingType(null);
              }
            }}
          >
            {!blocks.length ? (
              <div style={{ padding: "60px 0", textAlign: "center", color: "var(--fs-fg-muted)" }}>
                <Icon name="layout" size={32} color="var(--fs-fg-subtle)" />
                <div style={{ fontSize: 14, marginTop: 12 }}>Drag blocks here, or pick a recommended template to start.</div>
              </div>
            ) : (
              blocks.map((b, i) => (
                <BlockNode
                  key={b.id}
                  block={b}
                  index={i}
                  blockTypes={blockTypes}
                  client={editorClient}
                  onRemove={() => removeBlock(b.id)}
                  onMoveUp={() => moveBlock(i, i - 1)}
                  onMoveDown={() => moveBlock(i, i + 1)}
                  draggingFromIndex={draggingFromIndex}
                  onDragStart={() => { setDraggingFromIndex(i); setDraggingType(null); }}
                  onDragEnd={() => setDraggingFromIndex(null)}
                  onDropAt={() => {
                    if (draggingFromIndex !== null) moveBlock(draggingFromIndex, i);
                    else if (draggingType) {
                      const next = [...blocks];
                      next.splice(i, 0, { id: `${draggingType}-${Date.now()}`, type: draggingType, content: {} });
                      setBlocks(next);
                      scheduleSave({ blocks: next });
                    }
                    setDraggingFromIndex(null);
                    setDraggingType(null);
                  }}
                  onContentChange={(content) => updateBlockContent(b.id, content)}
                />
              ))
            )}
          </div>
        </div>

        <aside className="card card-pad" style={{ position: "sticky", top: 0 }}>
          <div className="row" style={{ gap: 4, marginBottom: 14 }}>
            {["details", "cleatus", "notes"].map((t) => (
              <button
                key={t}
                type="button"
                className={"btn sm " + (sideTab === t ? "primary" : "ghost")}
                onClick={() => setSideTab(t)}
                style={{ textTransform: "capitalize" }}
              >
                {t === "cleatus" ? "RFP" : t}
              </button>
            ))}
          </div>

          {sideTab === "details" && (
            <>
              <Eyebrow>Proposal details</Eyebrow>
              <div className="field" style={{ marginTop: 14 }}>
                <label>Title</label>
                <input
                  className="input"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    scheduleSave({ title: e.target.value });
                  }}
                />
              </div>
              <div className="field">
                <label>Client</label>
                <input className="input" value={proposal?.clientName || "—"} readOnly />
              </div>
              <div className="field">
                <label>Triage</label>
                <Tag tone={triageTone(proposal?.triageState)}>{triageLabel(proposal?.triageState)}</Tag>
              </div>
              <div className="field">
                <label>Owner</label>
                <input className="input" value={proposal?.ownerName || user?.name || ""} readOnly />
              </div>
            </>
          )}

          {sideTab === "cleatus" && (
            <>
              <Eyebrow>Cleatus / RFP</Eyebrow>
              {cleatus ? (
                <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.55 }}>
                  {cleatus.rfpUrl && (
                    <div className="field">
                      <label>RFP link</label>
                      <a href={cleatus.rfpUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "var(--fs-navy)" }}>
                        Open in Cleatus
                      </a>
                    </div>
                  )}
                  {cleatus.rfpDueDate && (
                    <div className="field">
                      <label>Due date</label>
                      <div>{cleatus.rfpDueDate}</div>
                    </div>
                  )}
                  {cleatus.rfpSummary && (
                    <div className="field">
                      <label>RFP summary</label>
                      <div className="mut" style={{ whiteSpace: "pre-wrap" }}>{cleatus.rfpSummary}</div>
                    </div>
                  )}
                  {cleatus.staffNotes && (
                    <div className="field">
                      <label>Staff notes (from Cleatus)</label>
                      <div className="mut" style={{ whiteSpace: "pre-wrap" }}>{cleatus.staffNotes}</div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mut" style={{ fontSize: 13, marginTop: 12 }}>No Cleatus data on this proposal.</p>
              )}
            </>
          )}

          {sideTab === "notes" && (
            <>
              <Eyebrow>Staff notes</Eyebrow>
              <div style={{ marginTop: 12, maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                {notes.map((n) => (
                  <div key={n.id} style={{ fontSize: 13, padding: "8px 10px", background: "var(--fs-bone-50)", borderRadius: 4 }}>
                    <div className="mut" style={{ fontSize: 11, marginBottom: 4 }}>{n.authorName} · {n.createdAt?.slice(0, 10)}</div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{n.text}</div>
                  </div>
                ))}
                {!notes.length && <p className="mut" style={{ fontSize: 12 }}>No notes yet.</p>}
              </div>
              <div className="field" style={{ marginTop: 12 }}>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Add an internal note…"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                />
                <button type="button" className="btn secondary sm" style={{ marginTop: 8 }} onClick={handleAddNote}>
                  Add note
                </button>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
