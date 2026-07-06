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

/** Review card shown under a block for someone else's pending suggestion. */
function SuggestionCard({ suggestion, blockTypes, client, onAccept, onReject, busy }) {
  const isRemove = suggestion.kind === "remove";
  return (
    <div className="suggestion-card">
      <div className="row between" style={{ marginBottom: isRemove ? 0 : 8 }}>
        <div className="row" style={{ gap: 8 }}>
          <Icon name={isRemove ? "x" : "pen"} size={12} color="var(--fs-gold-700)" />
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fs-navy)" }}>
            {suggestion.authorName} {isRemove ? "suggests removing this block" : "suggests an edit"}
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
  const dragging = draggingFromIndex === index;

  // In suggesting mode your own pending edit is what you see and keep editing;
  // everyone else's suggestions render as review cards below the block. In
  // editing mode all pending suggestions (yours included) show as review cards.
  const mySuggestion = mode === "suggest"
    ? suggestions.find((s) => s.kind === "edit" && s.authorId === currentUserId)
    : null;
  const otherSuggestions = suggestions.filter((s) => s !== mySuggestion);
  const displayContent = mode === "suggest" && mySuggestion?.proposed?.content
    ? mySuggestion.proposed.content
    : block.content;

  return (
    <div
      data-block-id={block.id}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={() => { setOver(false); onDropAt(); }}
      style={{ position: "relative" }}
    >
      {over && <div style={{ position: "absolute", top: -4, left: 0, right: 0, height: 2, background: "var(--fs-gold)", borderRadius: 1, zIndex: 2 }} />}

      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          border: "1px solid " + (mySuggestion && mode === "suggest" ? "var(--fs-gold)" : hover ? "var(--fs-navy)" : "var(--fs-border)"),
          borderRadius: 4,
          background: "var(--fs-paper)",
          padding: "16px 18px",
          opacity: dragging ? 0.4 : 1,
          transition: "border-color 160ms",
        }}
      >
        <div className="row between" style={{ marginBottom: 10 }}>
          <div className="row" style={{ gap: 8 }}>
            <span style={{ cursor: "grab", display: "inline-flex" }} title="Drag to reorder">
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
            <button
              type="button"
              className="btn ghost sm"
              style={{ padding: 4, opacity: commentCount || hover ? 1 : 0, transition: "opacity 160ms", position: "relative" }}
              title="Comment on this block"
              onClick={onComment}
            >
              <Icon name="comment" size={12} />
              {commentCount > 0 && <span className="comment-badge">{commentCount}</span>}
            </button>
            <span className="row" style={{ gap: 2, opacity: hover ? 1 : 0, transition: "opacity 160ms" }}>
              <button type="button" className="btn ghost sm" style={{ padding: 4 }} title="Move up" onClick={onMoveUp}><Icon name="chevron-up" size={12} /></button>
              <button type="button" className="btn ghost sm" style={{ padding: 4 }} title="Move down" onClick={onMoveDown}><Icon name="chevron-down" size={12} /></button>
              <button type="button" className="btn ghost sm" style={{ padding: 4 }} title="Duplicate" onClick={onDuplicate}><Icon name="layout" size={12} /></button>
              <button type="button" className="btn ghost sm" style={{ padding: 4, color: "var(--fs-danger)" }} title={mode === "suggest" ? "Suggest removing" : "Remove"} onClick={onRemove}><Icon name="x" size={12} /></button>
            </span>
          </div>
        </div>

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
