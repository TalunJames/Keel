import React, { useLayoutEffect, useRef, useState } from "react";
import { Icon } from "../../components/ui.jsx";
import { BlockPreview } from "./blocks/BlockPreview.jsx";

// US Letter at 96dpi.
const PAGE_W = 816;
const PAGE_H = 1056;
const MARGIN_X = 72;
const MARGIN_TOP = 60;
const FOOTER_H = 52;
const CONTENT_H = PAGE_H - MARGIN_TOP - FOOTER_H;
const BLOCK_GAP = 20;

/**
 * Splits blocks into US-Letter pages by measuring rendered heights, then shows
 * a print-ready preview: cover gets its own full-bleed page, explicit page
 * breaks are honored, every page gets a numbered footer, and the TOC picks up
 * real page numbers.
 */
export function ExportPreview({ proposal, blocks, blockTypes, onClose }) {
  const measureRef = useRef(null);
  const [layout, setLayout] = useState(null);

  const visibleBlocks = blocks.filter((b) => b.type !== "pagebreak" && b.type !== "cover");
  const client = { name: proposal?.clientName };

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
    const pageOf = {};

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
        pageOf[b.id] = pages.length;
        continue;
      }
      const h = (heights[b.id] || 40) + (current.blocks.length ? BLOCK_GAP : 0);
      if (current.blocks.length && used + h > CONTENT_H) flush();
      current.blocks.push(b);
      used += h;
      pageOf[b.id] = pages.length + 1;
    }
    flush();

    setLayout({ pages: pages.length ? pages : [{ blocks: [], fullBleed: false }], pageOf });
  }, [blocks]);

  const total = layout?.pages.length || 0;

  return (
    <div className="export-overlay">
      <div className="export-toolbar no-print">
        <div className="row" style={{ gap: 10 }}>
          <Icon name="download" size={15} color="var(--fs-gold)" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Export preview</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)" }}>
              {total} page{total === 1 ? "" : "s"} · US Letter · &ldquo;Save as PDF&rdquo; in the print dialog
            </div>
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn ghost sm" style={{ color: "rgba(255,255,255,0.8)" }} onClick={onClose}>
            <Icon name="x" size={12} /> Close
          </button>
          <button type="button" className="btn accent sm" onClick={() => window.print()}>
            <Icon name="download" size={12} /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* Hidden measuring pass at exact page-content width. */}
      {!layout && (
        <div
          ref={measureRef}
          style={{ position: "absolute", visibility: "hidden", width: PAGE_W - MARGIN_X * 2, left: -9999, top: 0 }}
        >
          {visibleBlocks.map((b) => (
            <div key={b.id} data-measure-id={b.id}>
              <BlockPreview type={b.type} client={client} content={b.content} allBlocks={blocks} blockTypes={blockTypes} />
            </div>
          ))}
        </div>
      )}

      {layout && (
        <div className="export-pages">
          {layout.pages.map((page, pi) => (
            <div key={pi} className="export-page" style={{ width: PAGE_W, height: PAGE_H }}>
              {page.fullBleed ? (
                <div className="export-cover">
                  {page.blocks.map((b) => (
                    <BlockPreview key={b.id} type={b.type} client={client} content={b.content} allBlocks={blocks} blockTypes={blockTypes} />
                  ))}
                </div>
              ) : (
                <>
                  <div style={{ padding: `${MARGIN_TOP}px ${MARGIN_X}px 0`, height: MARGIN_TOP + CONTENT_H, overflow: "hidden", boxSizing: "border-box" }}>
                    {page.blocks.map((b, bi) => (
                      <div key={b.id} style={{ marginTop: bi ? BLOCK_GAP : 0 }}>
                        <BlockPreview
                          type={b.type}
                          client={client}
                          content={b.content}
                          allBlocks={blocks}
                          blockTypes={blockTypes}
                          tocPages={layout.pageOf}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="export-footer" style={{ height: FOOTER_H, padding: `0 ${MARGIN_X}px` }}>
                    <span>{proposal?.title || "Proposal"}{proposal?.clientName ? ` · ${proposal.clientName}` : ""}</span>
                    <span className="num">Page {pi + 1} of {total}</span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
