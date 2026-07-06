import React, { useState } from "react";
import { Icon } from "../../../components/ui.jsx";
import { BlockPreview } from "./BlockPreview.jsx";

export function BlockNode({
  block,
  index,
  blockTypes,
  client,
  onRemove,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragEnd,
  onDropAt,
  draggingFromIndex,
  onContentChange,
}) {
  const meta = blockTypes[block.type] || { label: block.type, icon: "layout" };
  const [hover, setHover] = useState(false);
  const [over, setOver] = useState(false);
  const dragging = draggingFromIndex === index;

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={() => { setOver(false); onDropAt(); }}
      style={{ position: "relative", marginBottom: 8 }}
    >
      {over && <div style={{ position: "absolute", top: -4, left: 0, right: 0, height: 2, background: "var(--fs-gold)", borderRadius: 1 }} />}

      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          border: "1px solid " + (hover ? "var(--fs-navy)" : "var(--fs-border)"),
          borderRadius: 4,
          background: "var(--fs-paper)",
          padding: "16px 18px",
          opacity: dragging ? 0.4 : 1,
          transition: "border-color 160ms",
        }}
      >
        <div className="row between" style={{ marginBottom: 10 }}>
          <div className="row" style={{ gap: 8 }}>
            <Icon name="grip" size={12} color="var(--fs-fg-subtle)" />
            <Icon name={meta.icon} size={13} color="var(--fs-navy)" />
            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600, color: "var(--fs-fg-muted)" }}>
              {meta.label}
            </span>
          </div>
          <div className="row" style={{ gap: 2, opacity: hover ? 1 : 0, transition: "opacity 160ms" }}>
            <button type="button" className="btn ghost sm" style={{ padding: 4 }} onClick={onMoveUp}><Icon name="chevron-up" size={12} /></button>
            <button type="button" className="btn ghost sm" style={{ padding: 4 }} onClick={onMoveDown}><Icon name="chevron-down" size={12} /></button>
            <button type="button" className="btn ghost sm" style={{ padding: 4, color: "var(--fs-danger)" }} onClick={onRemove}><Icon name="x" size={12} /></button>
          </div>
        </div>

        <BlockPreview
          type={block.type}
          client={client}
          content={block.content}
          onChange={(content) => onContentChange?.(content)}
        />
      </div>
    </div>
  );
}
