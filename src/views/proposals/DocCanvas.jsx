import React, { useLayoutEffect, useRef, useState } from "react";
import { BlockPreview } from "./blocks/BlockPreview.jsx";
import { BlockNode } from "./blocks/BlockNode.jsx";
import { InsertMenu } from "./richtext.jsx";

export const PAGE_W = 816;
export const PAGE_H = 1056;
const MARGIN_X = 72;
const MARGIN_TOP = 72;
const MARGIN_BOTTOM = 56;
const CONTENT_H = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM;
const BLOCK_GAP = 14;

/**
 * Google Docs–style paginated canvas: gray workspace, stacked letter pages,
 * blocks edited inline with minimal chrome.
 */
export function DocCanvas({
  blocks,
  blockTypes,
  client,
  grouped,
  mode,
  user,
  suggestionsByBlock,
  addSuggestions,
  commentCounts,
  suggestionBusy,
  activeBlockId,
  onInsertAt,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onComment,
  onAcceptSuggestion,
  onRejectSuggestion,
  onContentChange,
  onMoveBlock,
  onInsertBlockType,
  draggingFromIndex,
  setDraggingFromIndex,
  draggingType,
  setDraggingType,
  AddSuggestionCard,
}) {
  const measureRef = useRef(null);
  const [layout, setLayout] = useState(null);

  const measurable = blocks.filter((b) => b.type !== "pagebreak");

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const heights = {};
    for (const node of el.querySelectorAll("[data-measure-id]")) {
      heights[node.dataset.measureId] = node.offsetHeight;
    }

    const pages = [];
    let current = { blocks: [], fullBleed: false };
    let used = 0;

    const flush = () => {
      if (current.blocks.length) pages.push(current);
      current = { blocks: [], fullBleed: false };
      used = 0;
    };

    for (const b of blocks) {
      if (b.type === "pagebreak") {
        flush();
        continue;
      }
      if (b.type === "cover") {
        flush();
        pages.push({ blocks: [b], fullBleed: true });
        continue;
      }
      const h = (heights[b.id] || 48) + (current.blocks.length ? BLOCK_GAP : 0);
      if (current.blocks.length && used + h > CONTENT_H) flush();
      current.blocks.push(b);
      used += h;
    }
    flush();

    setLayout({ pages: pages.length ? pages : [{ blocks: [], fullBleed: false }] });
  }, [blocks]);

  const renderBlock = (b, i) => {
    const globalIndex = blocks.findIndex((x) => x.id === b.id);
    return (
      <React.Fragment key={b.id}>
        <InsertMenu compact grouped={grouped} onInsert={(type) => onInsertAt(type, globalIndex)} className="doc-insert-zone" />
        {addSuggestions.filter((s) => (s.proposed?.index ?? 0) === globalIndex).map((s) => (
          <AddSuggestionCard key={s.id} s={s} blockTypes={blockTypes} client={client} busy={suggestionBusy}
            onAccept={() => onAcceptSuggestion(s, "accept")}
            onReject={() => onRejectSuggestion(s, "reject")} />
        ))}
        <BlockNode
          block={b}
          index={globalIndex}
          variant="doc"
          active={activeBlockId === b.id}
          blockTypes={blockTypes}
          client={client}
          allBlocks={blocks}
          mode={mode}
          currentUserId={user?.id}
          suggestions={suggestionsByBlock[b.id] || []}
          commentCount={commentCounts[b.id] || 0}
          suggestionBusy={suggestionBusy}
          onRemove={() => onRemove(b)}
          onDuplicate={() => onDuplicate(b, globalIndex)}
          onMoveUp={() => onMoveUp(globalIndex)}
          onMoveDown={() => onMoveDown(globalIndex)}
          onComment={() => onComment(b.id)}
          onAcceptSuggestion={(s) => onAcceptSuggestion(s, "accept")}
          onRejectSuggestion={(s) => onRejectSuggestion(s, "reject")}
          draggingFromIndex={draggingFromIndex}
          onDragStart={() => { setDraggingFromIndex(globalIndex); setDraggingType(null); }}
          onDragEnd={() => setDraggingFromIndex(null)}
          onDropAt={() => {
            if (draggingFromIndex !== null) onMoveBlock(draggingFromIndex, globalIndex);
            else if (draggingType) onInsertBlockType(draggingType, globalIndex);
            setDraggingFromIndex(null);
            setDraggingType(null);
          }}
          onContentChange={(content) => onContentChange(b, content)}
        />
      </React.Fragment>
    );
  };

  if (!blocks.length) {
    return (
      <div className="gdocs-canvas-scroll">
        <div className="gdocs-page gdocs-page-empty">
          <IconPlaceholder />
          <p>Start writing, or apply a template from <strong>File</strong>.</p>
          <InsertMenu grouped={grouped} onInsert={(type) => onInsertAt(type, 0)} />
        </div>
      </div>
    );
  }

  return (
    <>
      <div ref={measureRef} className="gdocs-measure" aria-hidden>
        {measurable.map((b) => (
          <div key={b.id} data-measure-id={b.id} style={{ width: PAGE_W - MARGIN_X * 2 }}>
            <BlockPreview type={b.type} client={client} content={b.content} allBlocks={blocks} blockTypes={blockTypes} />
          </div>
        ))}
      </div>

      <div
        className="gdocs-canvas-scroll"
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => {
          if (draggingType) {
            onInsertBlockType(draggingType, blocks.length);
            setDraggingType(null);
          }
        }}
      >
        <div className="gdocs-pages">
          {(layout?.pages || [{ blocks: measurable, fullBleed: false }]).map((page, pi) => (
            <div
              key={pi}
              className={"gdocs-page" + (page.fullBleed ? " gdocs-page-cover" : "")}
              style={{ width: PAGE_W, minHeight: PAGE_H }}
            >
              {page.fullBleed ? (
                <div className="gdocs-page-cover-inner">
                  {page.blocks.map((b) => renderBlock(b, blocks.indexOf(b)))}
                </div>
              ) : (
                <div className="gdocs-page-body" style={{ padding: `${MARGIN_TOP}px ${MARGIN_X}px ${MARGIN_BOTTOM}px` }}>
                  {page.blocks.map((b) => renderBlock(b, blocks.indexOf(b)))}
                </div>
              )}
            </div>
          ))}
          {addSuggestions.filter((s) => (s.proposed?.index ?? blocks.length) >= blocks.length).map((s) => (
            <div key={s.id} className="gdocs-page" style={{ width: PAGE_W, minHeight: 120 }}>
              <div className="gdocs-page-body" style={{ padding: `${MARGIN_TOP}px ${MARGIN_X}px` }}>
                <AddSuggestionCard s={s} blockTypes={blockTypes} client={client} busy={suggestionBusy}
                  onAccept={() => onAcceptSuggestion(s, "accept")}
                  onReject={() => onRejectSuggestion(s, "reject")} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function IconPlaceholder() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--fs-fg-subtle)" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
