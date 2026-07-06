import React, { useState } from "react";
import { Icon, Tag } from "../../../components/ui.jsx";
import { BlockPreview } from "./BlockPreview.jsx";

function timeAgo(iso) {
  if (!iso) return "";
  const then = new Date(iso.replace(" ", "T") + (iso.endsWith("Z") ? "" : "Z")).getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

function SuggestionCard({ suggestion, blockTypes, client, onAccept, onReject, busy }) {
  const isRemove = suggestion.kind === "remove";
  return (
    <div className="suggestion-card">
      <div className="row between" style={{ marginBottom: isRemove ? 0 : 8 }}>
        <div className="row" style={{ gap: 8 }}>
          <Icon name={isRemove ? "x" : "pen"} size={12} color="var(--fs-gold-700)" />
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fs-navy)" }}>
            {suggestion.authorName} {isRemove ? "suggests removing this section" : "suggests an edit"}
          </span>
          <span className="mut" style={{ fontSize: 11 }}>{timeAgo(suggestion.createdAt)}</span>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="btn secondary sm" disabled={busy} onClick={onReject}>Reject</button>
          <button type="button" className="btn primary sm" disabled={busy} onClick={onAccept}>Accept</button>
        </div>
      </div>
      {!isRemove && suggestion.proposed?.content && (
        <div className="suggestion-preview">
          <BlockPreview
            type={suggestion.blockType}
            client={client}
            content={suggestion.proposed.content}
            blockTypes={blockTypes}
          />
        </div>
      )}
    </div>
  );
}

export function BlockNode({
  block,
  index,
  variant = "card",
  active = false,
  blockTypes,
  client,
  allBlocks,
  mode = "edit",
  currentUserId,
  suggestions = [],
  commentCount = 0,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragEnd,
  onDropAt,
  draggingFromIndex,
  onContentChange,
  onComment,
  onAcceptSuggestion,
  onRejectSuggestion,
  suggestionBusy,
}) {
  const meta = blockTypes[block.type] || { label: block.type, icon: "layout" };
  const [hover, setHover] = useState(false);
  const [over, setOver] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const dragging = draggingFromIndex === index;
  const isDoc = variant === "doc";

  const mySuggestion = mode === "suggest"
    ? suggestions.find((s) => s.kind === "edit" && s.authorId === currentUserId)
    : null;
  const otherSuggestions = suggestions.filter((s) => s !== mySuggestion);
  const displayContent = mode === "suggest" && mySuggestion?.proposed?.content
    ? mySuggestion.proposed.content
    : block.content;

  const showGutter = isDoc && (hover || active || commentCount > 0 || menuOpen);

  return (
    <div
      data-block-id={block.id}
      className={
        "doc-block" +
        (isDoc ? "" : " card-block") +
        (active ? " active" : "") +
        (hover ? " hover" : "") +
        (mySuggestion && mode === "suggest" ? " suggesting" : "") +
        (dragging ? " dragging" : "")
      }
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={() => { setOver(false); onDropAt(); }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setMenuOpen(false); }}
    >
      {over && <div className="doc-drop-indicator" />}

      {isDoc && showGutter && (
        <div className="doc-gutter">
          <button type="button" className="doc-gutter-btn" title="Drag to reorder" draggable onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <Icon name="grip" size={14} />
          </button>
          <button type="button" className={"doc-gutter-btn" + (commentCount ? " has-comments" : "")} title="Comment" onClick={onComment}>
            <Icon name="comment" size={14} />
            {commentCount > 0 && <span className="doc-gutter-badge">{commentCount}</span>}
          </button>
          <div className="doc-gutter-more">
            <button type="button" className="doc-gutter-btn" title="More actions" onClick={() => setMenuOpen((o) => !o)}>
              <Icon name="more" size={14} />
            </button>
            {menuOpen && (
              <div className="doc-gutter-menu">
                <button type="button" onClick={() => { onMoveUp(); setMenuOpen(false); }}>Move up</button>
                <button type="button" onClick={() => { onMoveDown(); setMenuOpen(false); }}>Move down</button>
                <button type="button" onClick={() => { onDuplicate(); setMenuOpen(false); }}>Duplicate</button>
                <button type="button" className="danger" onClick={() => { onRemove(); setMenuOpen(false); }}>
                  {mode === "suggest" ? "Suggest remove" : "Remove"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className={isDoc ? "doc-block-body" : "card-block-inner"}>
        {!isDoc && (
          <div className="row between" style={{ marginBottom: 10 }}>
            <div className="row" style={{ gap: 8 }}>
              <span style={{ cursor: "grab", display: "inline-flex" }} title="Drag to reorder" draggable onDragStart={onDragStart} onDragEnd={onDragEnd}>
                <Icon name="grip" size={12} color="var(--fs-fg-subtle)" />
              </span>
              <Icon name={meta.icon} size={13} color="var(--fs-navy)" />
              <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600, color: "var(--fs-fg-muted)" }}>
                {meta.label}
              </span>
              {mode === "suggest" && mySuggestion && (
                <Tag tone="gold" style={{ fontSize: 10 }}>Your suggestion — pending</Tag>
              )}
            </div>
            <div className="row" style={{ gap: 2 }}>
              <button type="button" className="btn ghost sm" style={{ padding: 4, opacity: commentCount || hover ? 1 : 0 }} title="Comment" onClick={onComment}>
                <Icon name="comment" size={12} />
                {commentCount > 0 && <span className="comment-badge">{commentCount}</span>}
              </button>
              <span className="row" style={{ gap: 2, opacity: hover ? 1 : 0 }}>
                <button type="button" className="btn ghost sm" style={{ padding: 4 }} onClick={onMoveUp}><Icon name="chevron-up" size={12} /></button>
                <button type="button" className="btn ghost sm" style={{ padding: 4 }} onClick={onMoveDown}><Icon name="chevron-down" size={12} /></button>
                <button type="button" className="btn ghost sm" style={{ padding: 4 }} onClick={onDuplicate}><Icon name="layout" size={12} /></button>
                <button type="button" className="btn ghost sm" style={{ padding: 4, color: "var(--fs-danger)" }} onClick={onRemove}><Icon name="x" size={12} /></button>
              </span>
            </div>
          </div>
        )}

        {isDoc && mode === "suggest" && mySuggestion && (
          <div className="doc-suggest-pill">
            <Icon name="comment" size={11} /> Suggested edit — pending review
          </div>
        )}

        <BlockPreview
          type={block.type}
          client={client}
          content={displayContent}
          allBlocks={allBlocks}
          blockTypes={blockTypes}
          onChange={(content) => onContentChange?.(content)}
        />
      </div>

      {otherSuggestions.map((s) => (
        <SuggestionCard
          key={s.id}
          suggestion={{ ...s, blockType: block.type }}
          blockTypes={blockTypes}
          client={client}
          busy={suggestionBusy}
          onAccept={() => onAcceptSuggestion?.(s)}
          onReject={() => onRejectSuggestion?.(s)}
        />
      ))}
    </div>
  );
}
