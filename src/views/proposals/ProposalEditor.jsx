import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHead, Icon } from "../../components/ui.jsx";
import { proposalsApi } from "../../lib/api.js";
import { useApi } from "../../lib/useApi.js";
import { Loading } from "../../components/Loading.jsx";
import { BlockPreview } from "./blocks/BlockPreview.jsx";
import { InsertMenu, htmlToText } from "./richtext.jsx";
import { CommentsPanel } from "./CommentsPanel.jsx";
import { HistoryPanel } from "./HistoryPanel.jsx";
import { ExportPreview } from "./ExportPreview.jsx";
import { ProposalOutline } from "./ProposalOutline.jsx";
import { DocToolbar } from "./DocToolbar.jsx";
import { DocCanvas } from "./DocCanvas.jsx";

function groupBlocks(blockTypes) {
  const grouped = {};
  for (const [id, meta] of Object.entries(blockTypes)) {
    if (id === "executive") continue;
    if (!grouped[meta.group]) grouped[meta.group] = [];
    grouped[meta.group].push({ id, ...meta });
  }
  return grouped;
}

function wordCount(blocks) {
  let words = 0;
  const countStr = (s) => {
    if (typeof s === "string" && s.trim()) words += s.trim().split(/\s+/).length;
  };
  const walk = (v) => {
    if (v == null) return;
    if (typeof v === "string") return countStr(v);
    if (Array.isArray(v)) return v.forEach(walk);
    if (typeof v === "object") {
      for (const [k, val] of Object.entries(v)) {
        if (k === "html") countStr(htmlToText(val));
        else walk(val);
      }
    }
  };
  blocks.forEach((b) => walk(b.content));
  return words;
}

/** Next workflow action for the header button, keyed by current triage state. */
const WORKFLOW_NEXT = {
  inbox: { to: "building", label: "Start building" },
  building: { to: "internal_review", label: "Send for review" },
  internal_review: { to: "sent", label: "Mark sent to client" },
  sent: { to: "signed", label: "Mark signed" },
};

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
  const { data: commentsData, reload: reloadComments } = useApi(`/proposals/${proposalId}/comments`, [proposalId]);
  const { data: revisionsData, reload: reloadRevisions } = useApi(`/proposals/${proposalId}/revisions`, [proposalId]);
  const { data: teamData } = useApi("/team", []);

  const [blocks, setBlocks] = useState([]);
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState("edit");
  const [sideTab, setSideTab] = useState("details");
  const [commentTarget, setCommentTarget] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [draggingFromIndex, setDraggingFromIndex] = useState(null);
  const [draggingType, setDraggingType] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionBusy, setSuggestionBusy] = useState(false);
  const [activeBlockId, setActiveBlockId] = useState(null);
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [sideOpen, setSideOpen] = useState(false);
  const [toolbarInsertOpen, setToolbarInsertOpen] = useState(false);
  const saveTimer = useRef(null);
  const pendingPatch = useRef(null);
  const suggestTimers = useRef({});

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
  const comments = commentsData?.comments || [];
  const revisions = revisionsData?.revisions || [];
  const team = teamData?.members || [];
  const openComments = comments.filter((c) => c.status === "open").length;

  const commentCounts = useMemo(() => {
    const map = {};
    for (const c of comments) {
      if (c.blockId && c.status === "open") map[c.blockId] = (map[c.blockId] || 0) + 1;
    }
    return map;
  }, [comments]);

  useEffect(() => {
    if (!proposal) return;
    setTitle(proposal.title || "");
    setBlocks(proposal.blocks || []);
  }, [proposal]);

  const loadSuggestions = useCallback(async () => {
    try {
      const d = await proposalsApi.suggestions.list(proposalId);
      setSuggestions(d.suggestions || []);
    } catch { /* transient — retried on next action */ }
  }, [proposalId]);

  useEffect(() => { loadSuggestions(); }, [loadSuggestions]);

  const persist = useCallback(async (patch) => {
    setSaving(true);
    setSaveError(null);
    try {
      await proposalsApi.update(proposalId, patch);
      setLastSaved(new Date());
      onSaved?.();
    } catch (err) {
      // Surface the failure instead of silently swallowing it — the UI must not
      // keep claiming "Saved" when the write actually failed.
      setSaveError(err?.message || "Could not save changes. Retrying on your next edit.");
    } finally {
      setSaving(false);
    }
  }, [proposalId, onSaved]);

  // Merge queued fields so a second edit within the debounce window can't drop
  // the first field's change. Flush the merged patch when the timer fires.
  const scheduleSave = useCallback((patch) => {
    pendingPatch.current = { ...(pendingPatch.current || {}), ...patch };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const merged = pendingPatch.current;
      pendingPatch.current = null;
      saveTimer.current = null;
      if (merged) persist(merged);
    }, 800);
  }, [persist]);

  // Flush any pending debounced patch on unmount so an in-progress edit isn't lost.
  useEffect(() => () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (pendingPatch.current) {
      const merged = pendingPatch.current;
      pendingPatch.current = null;
      proposalsApi.update(proposalId, merged).catch(() => {});
    }
  }, [proposalId]);

  const defaultContentFor = (type) =>
    ({ ...(libData?.blocks?.find((b) => b.type === type)?.defaultContent || {}) });

  const setAndSave = (next) => {
    setBlocks(next);
    scheduleSave({ blocks: next });
  };

  // ---------- Suggesting mode ----------

  const suggestEdit = (block, content) => {
    // Optimistic local echo so typing feels immediate; debounce the API write.
    setSuggestions((prev) => {
      const idx = prev.findIndex(
        (s) => s.blockId === block.id && s.kind === "edit" && s.authorId === user?.id
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], proposed: { content } };
        return next;
      }
      return [...prev, {
        id: `local-${block.id}`,
        blockId: block.id,
        kind: "edit",
        authorId: user?.id,
        authorName: user?.name || "You",
        status: "pending",
        base: { content: block.content },
        proposed: { content },
        createdAt: new Date().toISOString(),
      }];
    });
    clearTimeout(suggestTimers.current[block.id]);
    suggestTimers.current[block.id] = setTimeout(async () => {
      try {
        await proposalsApi.suggestions.add(proposalId, {
          blockId: block.id,
          kind: "edit",
          base: { content: block.content },
          proposed: { content },
        });
        loadSuggestions();
      } catch (err) {
        setSaveError(err?.message || "Could not save suggestion.");
      }
    }, 800);
  };

  const suggestRemove = async (block) => {
    await proposalsApi.suggestions.add(proposalId, {
      blockId: block.id,
      kind: "remove",
      base: { content: block.content },
    });
    loadSuggestions();
  };

  const suggestAdd = async (type, index, content) => {
    const block = { id: `${type}-${Date.now()}`, type, content: content || defaultContentFor(type) };
    await proposalsApi.suggestions.add(proposalId, {
      blockId: block.id,
      kind: "add",
      proposed: { block, index },
    });
    loadSuggestions();
  };

  const resolveSuggestion = async (s, action) => {
    setSuggestionBusy(true);
    try {
      await (action === "accept"
        ? proposalsApi.suggestions.accept(proposalId, s.id)
        : proposalsApi.suggestions.reject(proposalId, s.id));
      await Promise.all([reload(), loadSuggestions(), reloadRevisions()]);
      onSaved?.();
    } finally {
      setSuggestionBusy(false);
    }
  };

  // ---------- Block operations (mode-aware) ----------

  const insertBlockAt = (type, index, content) => {
    if (mode === "suggest") return suggestAdd(type, index, content);
    const next = [...blocks];
    next.splice(index, 0, { id: `${type}-${Date.now()}`, type, content: content || defaultContentFor(type) });
    setAndSave(next);
  };

  const addBlock = (type) => insertBlockAt(type, blocks.length);

  const removeBlock = (block) => {
    if (mode === "suggest") return suggestRemove(block);
    setAndSave(blocks.filter((b) => b.id !== block.id));
  };

  const duplicateBlock = (block, index) =>
    insertBlockAt(block.type, index + 1, JSON.parse(JSON.stringify(block.content || {})));

  const moveBlock = (from, to) => {
    if (from === to || to < 0 || to >= blocks.length) return;
    const next = [...blocks];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setAndSave(next);
  };

  const updateBlockContent = (block, content) => {
    if (mode === "suggest") return suggestEdit(block, content);
    setAndSave(blocks.map((b) => (b.id === block.id ? { ...b, content } : b)));
  };

  const applyTemplate = async (tplId) => {
    const tpl = templates.find((t) => t.id === tplId);
    if (!tpl) return;
    if (blocks.length && !window.confirm("Replace the current blocks with this template? A version is kept in History.")) return;
    await proposalsApi.revisions.snapshot(proposalId, "Before template change").catch(() => {});
    const next = tpl.defaultBlocks.map((type, i) => {
      const def = libData?.blocks?.find((b) => b.type === type)?.defaultContent || {};
      return { id: `${type}-${i}-${Date.now()}`, type, content: { ...def } };
    });
    setBlocks(next);
    await persist({ blocks: next, templateId: tplId });
    reload();
    reloadRevisions();
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    await proposalsApi.notes.add(proposalId, { text: noteText.trim() });
    setNoteText("");
    reloadNotes();
  };

  const jumpToBlock = (blockId) => {
    setActiveBlockId(blockId);
    const el = document.querySelector(`[data-block-id="${blockId}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("block-flash");
    setTimeout(() => el.classList.remove("block-flash"), 1600);
  };

  const openCommentsFor = (blockId) => {
    setCommentTarget(blockId);
    setSideTab("comments");
    setSideOpen(true);
  };

  const advanceWorkflow = async () => {
    const next = WORKFLOW_NEXT[proposal?.triageState];
    if (!next) return;
    await persist({ triageState: next.to });
    reload();
  };

  if (loading && !proposal) return <Loading />;

  const cleatus = proposal?.cleatus;
  const editorClient = { name: proposal?.clientName || client?.name };
  const words = wordCount(blocks);
  const pendingCount = suggestions.length;
  const nextStep = WORKFLOW_NEXT[proposal?.triageState];

  const suggestionsByBlock = {};
  const addSuggestions = [];
  for (const s of suggestions) {
    if (s.kind === "add") addSuggestions.push(s);
    else (suggestionsByBlock[s.blockId] = suggestionsByBlock[s.blockId] || []).push(s);
  }

  const sideTabs = [
    { id: "details", label: "Details" },
    { id: "comments", label: "Comments", count: openComments },
    { id: "history", label: "History" },
    { id: "cleatus", label: "RFP" },
    { id: "notes", label: "Notes" },
  ];

  return (
    <div className="gdocs-editor">
      <DocToolbar
        title={title}
        onTitleChange={(v) => { setTitle(v); scheduleSave({ title: v }); }}
        onBack={onBack}
        mode={mode}
        onModeChange={setMode}
        saving={saving}
        saveError={saveError}
        lastSaved={lastSaved}
        words={words}
        outlineOpen={outlineOpen}
        onToggleOutline={() => setOutlineOpen((o) => !o)}
        sideOpen={sideOpen}
        onToggleSide={(force) => setSideOpen(typeof force === "boolean" ? force : (o) => !o)}
        onExport={() => setExporting(true)}
        onInsert={() => setToolbarInsertOpen(true)}
        templates={templates}
        activeTemplateId={proposal?.templateId}
        onApplyTemplate={applyTemplate}
        triageState={proposal?.triageState}
        nextStep={nextStep}
        onAdvanceWorkflow={advanceWorkflow}
        openComments={openComments}
        onOpenComments={() => setSideTab("comments")}
      />

      {saveError && (
        <div className="gdocs-alert">{saveError}</div>
      )}

      {mode === "suggest" && (
        <div className="gdocs-suggest-strip">
          <Icon name="comment" size={13} />
          Suggesting — edits become suggestions for the team to accept or reject.
        </div>
      )}

      {toolbarInsertOpen && (
        <div className="gdocs-insert-popup">
          <div className="gdocs-insert-popup-head">
            <span>Insert section</span>
            <button type="button" className="gdocs-icon-btn sm" onClick={() => setToolbarInsertOpen(false)}>
              <Icon name="x" size={14} />
            </button>
          </div>
          <InsertMenu grouped={grouped} onInsert={(type) => { insertBlockAt(type, blocks.length); setToolbarInsertOpen(false); }} />
        </div>
      )}

      <div className="gdocs-workspace">
        {outlineOpen && (
          <aside className="gdocs-outline-panel">
            <div className="gdocs-panel-head">Document outline</div>
            <ProposalOutline
              blocks={blocks}
              blockTypes={blockTypes}
              activeBlockId={activeBlockId}
              onJump={jumpToBlock}
            />
          </aside>
        )}

        <DocCanvas
          blocks={blocks}
          blockTypes={blockTypes}
          client={editorClient}
          grouped={grouped}
          mode={mode}
          user={user}
          suggestionsByBlock={suggestionsByBlock}
          addSuggestions={addSuggestions}
          commentCounts={commentCounts}
          suggestionBusy={suggestionBusy}
          activeBlockId={activeBlockId}
          onInsertAt={insertBlockAt}
          onRemove={removeBlock}
          onDuplicate={duplicateBlock}
          onMoveUp={(i) => moveBlock(i, i - 1)}
          onMoveDown={(i) => moveBlock(i, i + 1)}
          onComment={openCommentsFor}
          onAcceptSuggestion={resolveSuggestion}
          onRejectSuggestion={(s) => resolveSuggestion(s, "reject")}
          onContentChange={updateBlockContent}
          onMoveBlock={moveBlock}
          onInsertBlockType={insertBlockAt}
          draggingFromIndex={draggingFromIndex}
          setDraggingFromIndex={setDraggingFromIndex}
          draggingType={draggingType}
          setDraggingType={setDraggingType}
          AddSuggestionCard={AddSuggestionCard}
        />

        {sideOpen && (
          <aside className="gdocs-side-panel">
            <div className="gdocs-panel-head row between">
              <div className="side-tabs gdocs-side-tabs">
                {sideTabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={sideTab === t.id ? "on" : ""}
                    onClick={() => setSideTab(t.id)}
                  >
                    {t.label}
                    {t.count > 0 && <span className="side-tab-count">{t.count}</span>}
                  </button>
                ))}
              </div>
              <button type="button" className="gdocs-icon-btn sm" onClick={() => setSideOpen(false)} title="Close panel">
                <Icon name="x" size={14} />
              </button>
            </div>

            <div className="gdocs-side-body">
              {sideTab === "details" && (
                <>
                  <div className="field">
                    <label>Client</label>
                    <input className="input" value={proposal?.clientName || "—"} readOnly />
                  </div>
                  <div className="field">
                    <label>Owner</label>
                    <input className="input" value={proposal?.ownerName || user?.name || ""} readOnly />
                  </div>
                  <div className="field">
                    <label>Due date</label>
                    <input
                      type="date"
                      className="input"
                      defaultValue={proposal?.dueAt?.slice(0, 10) || ""}
                      onChange={(e) => scheduleSave({ dueAt: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Value (USD)</label>
                    <input
                      type="number"
                      className="input"
                      defaultValue={proposal?.amount ?? ""}
                      placeholder="e.g. 60500"
                      onChange={(e) => scheduleSave({ amount: e.target.value === "" ? null : Number(e.target.value) })}
                    />
                  </div>
                  {pendingCount > 0 && (
                    <p className="mut" style={{ fontSize: 12 }}>{pendingCount} pending suggestion{pendingCount === 1 ? "" : "s"}</p>
                  )}
                </>
              )}

              {sideTab === "comments" && (
                <CommentsPanel
                  proposalId={proposalId}
                  comments={comments}
                  user={user}
                  team={team}
                  blocks={blocks}
                  blockTypes={blockTypes}
                  targetBlockId={commentTarget}
                  onClearTarget={() => setCommentTarget(null)}
                  onChanged={reloadComments}
                  onJumpToBlock={jumpToBlock}
                />
              )}

              {sideTab === "history" && (
                <HistoryPanel
                  proposalId={proposalId}
                  revisions={revisions}
                  onChanged={() => { reloadRevisions(); reload(); }}
                />
              )}

              {sideTab === "cleatus" && (
                <>
                  {cleatus ? (
                    <div style={{ fontSize: 13, lineHeight: 1.55 }}>
                      {cleatus.rfpUrl && (
                        <div className="field">
                          <label>RFP link</label>
                          <a href={cleatus.rfpUrl} target="_blank" rel="noreferrer">Open in Cleatus</a>
                        </div>
                      )}
                      {cleatus.rfpDueDate && (
                        <div className="field"><label>Due date</label><div>{cleatus.rfpDueDate}</div></div>
                      )}
                      {cleatus.rfpSummary && (
                        <div className="field"><label>Summary</label><div className="mut" style={{ whiteSpace: "pre-wrap" }}>{cleatus.rfpSummary}</div></div>
                      )}
                      {cleatus.staffNotes && (
                        <div className="field"><label>Staff notes</label><div className="mut" style={{ whiteSpace: "pre-wrap" }}>{cleatus.staffNotes}</div></div>
                      )}
                    </div>
                  ) : (
                    <p className="mut" style={{ fontSize: 13 }}>No Cleatus data on this proposal.</p>
                  )}
                </>
              )}

              {sideTab === "notes" && (
                <>
                  <div className="gdocs-notes-list">
                    {notes.map((n) => (
                      <div key={n.id} className="gdocs-note">
                        <div className="mut" style={{ fontSize: 11, marginBottom: 4 }}>{n.authorName} · {n.createdAt?.slice(0, 10)}</div>
                        <div style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{n.text}</div>
                      </div>
                    ))}
                    {!notes.length && <p className="mut" style={{ fontSize: 12 }}>No notes yet.</p>}
                  </div>
                  <div className="field" style={{ marginTop: 12 }}>
                    <textarea className="input" rows={3} placeholder="Add an internal note…" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                    <button type="button" className="btn secondary sm" style={{ marginTop: 8 }} onClick={handleAddNote}>Add note</button>
                  </div>
                </>
              )}
            </div>
          </aside>
        )}
      </div>

      {exporting && (
        <ExportPreview
          proposal={proposal}
          blocks={blocks}
          blockTypes={blockTypes}
          onClose={() => setExporting(false)}
        />
      )}
    </div>
  );
}

/** Ghost card for a suggested block addition awaiting review. */
function AddSuggestionCard({ s, blockTypes, client, busy, onAccept, onReject }) {
  const meta = blockTypes[s.proposed?.block?.type] || {};
  return (
    <div className="suggestion-card add">
      <div className="row between" style={{ marginBottom: 8 }}>
        <div className="row" style={{ gap: 8 }}>
          <Icon name="plus" size={12} color="var(--fs-gold-700)" />
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fs-navy)" }}>
            {s.authorName} suggests adding {meta.label ? `“${meta.label}”` : "a block"} here
          </span>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="btn secondary sm" disabled={busy} onClick={onReject}>Reject</button>
          <button type="button" className="btn primary sm" disabled={busy} onClick={onAccept}>Accept</button>
        </div>
      </div>
      {s.proposed?.block && (
        <div className="suggestion-preview">
          <BlockPreview
            type={s.proposed.block.type}
            client={client}
            content={s.proposed.block.content}
            blockTypes={blockTypes}
          />
        </div>
      )}
    </div>
  );
}
