/* ============ Fog Signal Proposals — .docx generation ============
   Converts the cleaned export DOM (exportCleanRoot) into a genuine
   Office Open XML .docx — no MHTML tricks, no dependencies. Opens
   natively in Word, Pages, LibreOffice, and converts cleanly in
   Google Drive. Page numbers are real PAGE/NUMPAGES fields placed
   per the document's page-number settings.

   Scope: exactly the HTML vocabulary the block renderers emit —
   covers (classic/custom/letterhead), dividers, headings, body text
   with inline formatting, lists, ptables, pull quotes, figures,
   TOC rows (dot leaders via real tab stops), signatures, two-column
   sections, imported PDF pages, and floating objects.             */
'use strict';

const DocxExport = (() => {

  /* ---------- geometry / palette ---------- */
  const TW_PER_PX = 15;                 // 96dpi px → twips
  const EMU_PER_PX = 9525;              // 96dpi px → EMU
  const PAGE_TWIPS = {
    letter: { w: 12240, h: 15840 },
    a4:     { w: 11906, h: 16838 },
    legal:  { w: 12240, h: 20160 },
  };
  const NAVY = '1A3A5C', GOLD = 'EFC53F', INK = '0F0F0F', GRAY = '7A7975',
        BORDER = 'C8C7C1', TOTALBG = 'F1F0E8', MUTED = '5B5B58', EYEBROW = 'B8932A';
  const FONT = 'Arial';

  const XE = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* ---------- CRC32 + stored ZIP ---------- */
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(u8) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  /* files: [{ name, data: Uint8Array }] → zip bytes (stored, UTF-8 names) */
  function zipStore(files) {
    const enc = new TextEncoder();
    const chunks = [], central = [];
    let offset = 0;
    const now = new Date();
    const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
    const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;

    files.forEach(f => {
      const name = enc.encode(f.name);
      const crc = crc32(f.data);
      const head = new DataView(new ArrayBuffer(30));
      head.setUint32(0, 0x04034b50, true);
      head.setUint16(4, 20, true);            // version needed
      head.setUint16(6, 0x0800, true);        // UTF-8 names
      head.setUint16(8, 0, true);             // stored
      head.setUint16(10, dosTime, true);
      head.setUint16(12, dosDate, true);
      head.setUint32(14, crc, true);
      head.setUint32(18, f.data.length, true);
      head.setUint32(22, f.data.length, true);
      head.setUint16(26, name.length, true);
      head.setUint16(28, 0, true);
      chunks.push(new Uint8Array(head.buffer), name, f.data);

      const cent = new DataView(new ArrayBuffer(46));
      cent.setUint32(0, 0x02014b50, true);
      cent.setUint16(4, 20, true);
      cent.setUint16(6, 20, true);
      cent.setUint16(8, 0x0800, true);
      cent.setUint16(10, 0, true);
      cent.setUint16(12, dosTime, true);
      cent.setUint16(14, dosDate, true);
      cent.setUint32(16, crc, true);
      cent.setUint32(20, f.data.length, true);
      cent.setUint32(24, f.data.length, true);
      cent.setUint16(28, name.length, true);
      cent.setUint32(42, offset, true);
      central.push(new Uint8Array(cent.buffer), name);
      offset += 30 + name.length + f.data.length;
    });

    let cdSize = 0;
    central.forEach(c => { cdSize += c.length; });
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true);
    end.setUint32(16, offset, true);
    const out = [...chunks, ...central, new Uint8Array(end.buffer)];
    let total = 0; out.forEach(c => { total += c.length; });
    const bytes = new Uint8Array(total);
    let p = 0; out.forEach(c => { bytes.set(c, p); p += c.length; });
    return bytes;
  }

  /* ---------- CSS helpers ---------- */
  function cssColorToHex(v) {
    if (!v) return null;
    v = v.trim();
    if (v === 'transparent' || v === 'inherit' || v === 'initial') return null;
    let m = v.match(/^#([0-9a-f]{3})$/i);
    if (m) return m[1].split('').map(c => c + c).join('').toUpperCase();
    m = v.match(/^#([0-9a-f]{6})/i);
    if (m) return m[1].toUpperCase();
    m = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i);
    if (m) {
      if (m[4] !== undefined && parseFloat(m[4]) === 0) return null;
      return [m[1], m[2], m[3]].map(n => (+n).toString(16).padStart(2, '0')).join('').toUpperCase();
    }
    return null;
  }
  const firstFontFamily = (v) => (v || '').split(',')[0].trim().replace(/^['"]|['"]$/g, '') || null;

  /* ---------- run / paragraph XML ---------- */
  /* fmt: { b,i,u,strike,sup,sub, color, shd, sz(half-pts), font, ls(20ths pt), caps, link } */
  /* NB: children must follow the CT_RPr schema sequence — Word/Pages are strict */
  function rPr(fmt) {
    let x = '';
    x += `<w:rFonts w:ascii="${XE(fmt.font || FONT)}" w:hAnsi="${XE(fmt.font || FONT)}" w:cs="${XE(fmt.font || FONT)}"/>`;
    if (fmt.b) x += '<w:b/>';
    if (fmt.i) x += '<w:i/>';
    if (fmt.strike) x += '<w:strike/>';
    const color = fmt.link ? NAVY : fmt.color;
    if (color) x += `<w:color w:val="${color}"/>`;
    if (fmt.ls) x += `<w:spacing w:val="${fmt.ls}"/>`;
    if (fmt.sz) x += `<w:sz w:val="${fmt.sz}"/><w:szCs w:val="${fmt.sz}"/>`;
    if (fmt.u || fmt.link) x += '<w:u w:val="single"/>';
    if (fmt.shd) x += `<w:shd w:val="clear" w:color="auto" w:fill="${fmt.shd}"/>`;
    if (fmt.sup) x += '<w:vertAlign w:val="superscript"/>';
    if (fmt.sub) x += '<w:vertAlign w:val="subscript"/>';
    return x ? `<w:rPr>${x}</w:rPr>` : '';
  }
  function textRun(text, fmt) {
    if (!text) return '';
    if (fmt.caps) text = text.toUpperCase();
    return `<w:r>${rPr(fmt)}<w:t xml:space="preserve">${XE(text)}</w:t></w:r>`;
  }
  /* popts: { jc, spacing:{before,after,line}, ind:{left,hanging}, pBdr, tabs,
              numPr:{ilvl,numId}, style, keepNext, pageBreakBefore, contextual } */
  function pPr(popts, defFmt) {
    let x = '';
    if (popts.style) x += `<w:pStyle w:val="${popts.style}"/>`;
    if (popts.keepNext) x += '<w:keepNext/>';
    if (popts.pageBreakBefore) x += '<w:pageBreakBefore/>';
    if (popts.numPr) x += `<w:numPr><w:ilvl w:val="${popts.numPr.ilvl}"/><w:numId w:val="${popts.numPr.numId}"/></w:numPr>`;
    if (popts.pBdr) x += `<w:pBdr>${popts.pBdr}</w:pBdr>`;
    if (popts.tabs) x += `<w:tabs>${popts.tabs}</w:tabs>`;
    const sp = popts.spacing;
    if (sp) x += `<w:spacing${sp.before != null ? ` w:before="${sp.before}"` : ''}${sp.after != null ? ` w:after="${sp.after}"` : ''}${sp.line ? ` w:line="${sp.line}" w:lineRule="auto"` : ''}/>`;
    if (popts.ind) x += `<w:ind${popts.ind.left != null ? ` w:left="${popts.ind.left}"` : ''}${popts.ind.hanging != null ? ` w:hanging="${popts.ind.hanging}"` : ''}/>`;
    if (popts.contextual) x += '<w:contextualSpacing/>';
    if (popts.jc) x += `<w:jc w:val="${popts.jc}"/>`;
    if (defFmt) x += rPr(defFmt);              // paragraph-mark formatting
    return x ? `<w:pPr>${x}</w:pPr>` : '';
  }
  const para = (popts, runsXml, defFmt) => `<w:p>${pPr(popts || {}, defFmt)}${runsXml || ''}</w:p>`;

  /* ---------- inline content ---------- */
  function normText(s) { return s.replace(/[ \t\n\r\f]+/g, ' '); }

  function inlineRuns(container, fmt, ctx) {
    let xml = '';
    for (const n of container.childNodes) {
      if (n.nodeType === 3) { xml += textRun(normText(n.textContent), fmt); continue; }
      if (n.nodeType !== 1) continue;
      const tag = n.tagName.toLowerCase();
      if (tag === 'br') { xml += `<w:r>${rPr(fmt)}<w:br/></w:r>`; continue; }
      if (tag === 'img') { xml += imageRun(n, ctx, { maxWpx: ctx.contentPx }); continue; }
      const f = Object.assign({}, fmt);
      if (tag === 'b' || tag === 'strong') f.b = true;
      if (tag === 'i' || tag === 'em') f.i = true;
      if (tag === 'u') f.u = true;
      if (tag === 's' || tag === 'strike' || tag === 'del') f.strike = true;
      if (tag === 'sup') f.sup = true;
      if (tag === 'sub') f.sub = true;
      if (tag === 'small') f.sz = 17;
      applyInlineStyle(n, f);
      if (tag === 'a' && n.getAttribute('href')) {
        const rid = ctx.addLink(n.getAttribute('href'));
        xml += `<w:hyperlink r:id="${rid}">${inlineRuns(n, Object.assign({}, f, { link: true }), ctx)}</w:hyperlink>`;
        continue;
      }
      xml += inlineRuns(n, f, ctx);
    }
    return xml;
  }
  function applyInlineStyle(el, f) {
    const st = el.style;
    if (!st) return;
    const c = cssColorToHex(st.color); if (c) f.color = c;
    const bg = cssColorToHex(st.backgroundColor); if (bg) f.shd = bg;
    if (st.fontSize) { const px = parseFloat(st.fontSize); if (px) f.sz = Math.round(px * 1.5); }
    if (st.fontFamily) { const fam = firstFontFamily(st.fontFamily); if (fam) f.font = fam; }
    if (st.fontWeight === 'bold' || parseInt(st.fontWeight) >= 600) f.b = true;
    if (st.fontStyle === 'italic') f.i = true;
    if (/underline/.test(st.textDecoration || '')) f.u = true;
    if (/line-through/.test(st.textDecoration || '')) f.strike = true;
    if (el.tagName === 'FONT' && el.getAttribute('color')) {
      const fc = cssColorToHex(el.getAttribute('color')); if (fc) f.color = fc;
    }
  }

  /* ---------- images ---------- */
  function dataUrlToBytes(src) {
    const m = /^data:([^;,]+);base64,(.*)$/s.exec(src);
    if (!m) return null;
    try {
      const bin = atob(m[2].replace(/\s+/g, ''));
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const mime = m[1].toLowerCase();
      const ext = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/jpg': 'jpeg', 'image/gif': 'gif', 'image/bmp': 'bmp' }[mime];
      return ext ? { u8, mime, ext } : null;   // skip formats Word can't place (svg, webp…)
    } catch (e) { return null; }
  }
  /* Inline drawing run. Width: explicit wPx, else natural, capped to maxWpx. */
  function imageRun(imgEl, ctx, opts = {}) {
    const src = imgEl.getAttribute('src') || '';
    const reg = ctx.addImage(src);
    if (!reg) return '';
    const nat = ctx.dims.get(src) || { w: 300, h: 200 };
    let wPx = opts.wPx || parseInt(imgEl.getAttribute('width')) ||
      parseFloat((imgEl.getAttribute('style') || '').match(/width:\s*([\d.]+)px/)?.[1]) || nat.w;
    if (opts.maxWpx && wPx > opts.maxWpx) wPx = opts.maxWpx;
    const hPx = Math.max(1, Math.round(wPx * nat.h / Math.max(1, nat.w)));
    const cx = Math.round(wPx * EMU_PER_PX), cy = Math.round(hPx * EMU_PER_PX);
    const id = ++ctx.drawingId;
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">
<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>
<wp:docPr id="${id}" name="Picture ${id}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>
<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<pic:nvPicPr><pic:cNvPr id="${id}" name="Picture ${id}"/><pic:cNvPicPr/></pic:nvPicPr>
<pic:blipFill><a:blip r:embed="${reg.rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  }
  function imagePara(imgEl, ctx, opts = {}) {
    const run = imageRun(imgEl, ctx, opts);
    if (!run) return '';
    return para({ jc: opts.jc || 'center', spacing: { before: opts.before ?? 120, after: opts.after ?? 120 }, pageBreakBefore: ctx.takeBreak() }, run);
  }

  /* ---------- shared visual pieces ---------- */
  const bdr = (side, szEighthPt, color, val = 'single') =>
    `<w:${side} w:val="${val}" w:sz="${szEighthPt}" w:space="0" w:color="${color}"/>`;

  /* short centered gold rule (cover + divider) as a fixed-width one-cell table */
  function goldRule(ctx, jc = 'center') {
    return `<w:tbl><w:tblPr><w:tblW w:w="1200" w:type="dxa"/><w:jc w:val="${jc}"/>
<w:tblBorders>${bdr('bottom', 20, GOLD)}</w:tblBorders></w:tblPr>
<w:tblGrid><w:gridCol w:w="1200"/></w:tblGrid>
<w:tr><w:tc><w:tcPr><w:tcW w:w="1200" w:type="dxa"/></w:tcPr>${para({ spacing: { after: 0 } }, '', { sz: 4 })}</w:tc></w:tr></w:tbl>`;
  }

  /* fixed-width signature line */
  function ruleTable(ctx, widthTw, color, szEighth, jc) {
    return `<w:tbl><w:tblPr><w:tblW w:w="${widthTw}" w:type="dxa"/>${jc && jc !== 'left' ? `<w:jc w:val="${jc}"/>` : ''}
<w:tblBorders>${bdr('bottom', szEighth, color)}</w:tblBorders></w:tblPr>
<w:tblGrid><w:gridCol w:w="${widthTw}"/></w:tblGrid>
<w:tr><w:tc><w:tcPr><w:tcW w:w="${widthTw}" w:type="dxa"/></w:tcPr>${para({ spacing: { after: 0 } }, '', { sz: 4 })}</w:tc></w:tr></w:tbl>`;
  }

  /* ---------- block walker ---------- */
  const BODY_FMT = { sz: 24, color: INK };
  const P_SPACING = { after: 160, line: 360 };

  function walkChildren(el, st, out, ctx) {
    for (const node of el.childNodes) {
      if (node.nodeType === 3) {
        const t = normText(node.textContent);
        if (t.trim()) out.push(para({ jc: st.jc, spacing: P_SPACING, pageBreakBefore: ctx.takeBreak() }, textRun(t, st.fmt)));
        continue;
      }
      if (node.nodeType !== 1) continue;
      blockEl(node, st, out, ctx);
    }
  }

  function headingPara(el, level, st, out, ctx, opts = {}) {
    const H = {
      1: { sz: 44, spacing: { before: 0, after: 240, line: 300 } },
      2: { sz: 36, spacing: { before: 320, after: 160, line: 312 } },
      3: { sz: 30, spacing: { before: 280, after: 120 } },
      4: { sz: 26, spacing: { before: 200, after: 80 } },
    }[level];
    const fmt = Object.assign({}, st.fmt, { b: true, color: NAVY, sz: H.sz }, opts.fmt || {});
    const popts = {
      style: `Heading${level}`, jc: opts.jc || st.jc, keepNext: true,
      spacing: opts.spacing || H.spacing, pageBreakBefore: ctx.takeBreak(),
    };
    if (level === 2 && opts.rule !== false) popts.pBdr = bdr('bottom', 12, opts.ruleColor || GOLD);
    out.push(para(popts, inlineRuns(el, fmt, ctx), fmt));
  }

  function blockEl(node, st, out, ctx) {
    const tag = node.tagName.toLowerCase();
    const cls = node.classList;

    /* page-break markers from exportCleanRoot */
    if (tag === 'br') {
      if (/page-break-before/.test(node.getAttribute('style') || '')) ctx.pendingBreak = true;
      return;
    }
    if (cls.contains('xblock')) {
      if (node.style.pageBreakBefore === 'always') ctx.pendingBreak = true;
      walkChildren(node, st, out, ctx);
      return;
    }

    /* full-page compositions */
    if (cls.contains('cover-page'))   { coverPage(node, st, out, ctx); return; }
    if (cls.contains('cover-custom')) { coverCustom(node, st, out, ctx); return; }
    if (cls.contains('cover-fss'))    { coverFss(node, st, out, ctx); return; }
    if (cls.contains('divider-page')) { dividerPage(node, st, out, ctx); return; }

    /* structural specials */
    if (cls.contains('toc-list'))  { tocList(node, st, out, ctx); return; }
    if (cls.contains('twocol'))    { twoColTable(node, st, out, ctx); return; }
    if (cls.contains('sig-block')) { sigBlock(node, st, out, ctx); return; }
    if (cls.contains('pdf-page'))  {
      const img = node.querySelector('img');
      if (img) out.push(imagePara(img, ctx, { wPx: ctx.contentPx, before: 0, after: 0 }));
      return;
    }
    if (cls.contains('x-float'))   { floatBox(node, st, out, ctx); return; }
    if (cls.contains('heading-scope')) {
      const h = node.querySelector('h1,h2,h3,h4');
      if (h) {
        const styleAttr = node.getAttribute('style') || '';
        const noRule = /--h2-rule-w:\s*0/.test(styleAttr);
        const rc = cssColorToHex((styleAttr.match(/--h2-rule-c:\s*([^;"]+)/) || [])[1] || '');
        headingPara(h, +h.tagName[1], st, out, ctx, { rule: !noRule, ruleColor: rc || undefined });
      }
      return;
    }

    switch (tag) {
      case 'h1': case 'h2': case 'h3': case 'h4':
        headingPara(node, +tag[1], st, out, ctx);
        return;
      case 'p': case 'small': {
        const fmt = Object.assign({}, st.fmt);
        const popts = { jc: st.jc, spacing: Object.assign({}, P_SPACING), pageBreakBefore: ctx.takeBreak() };
        if (tag === 'small' || cls.contains('placeholder-note')) { fmt.sz = 17; fmt.color = GRAY; }
        if (cls.contains('case-sub')) { fmt.color = MUTED; popts.spacing.after = 80; }
        if (cls.contains('muted')) fmt.color = GRAY;
        if (cls.contains('sig-name')) popts.spacing = { before: 60, after: 160, line: 300 };
        const ta = node.style.textAlign;
        if (ta === 'center' || ta === 'right' || ta === 'justify') popts.jc = ta === 'justify' ? 'both' : ta;
        applyInlineStyle(node, fmt);
        out.push(para(popts, inlineRuns(node, fmt, ctx), fmt));
        return;
      }
      case 'blockquote': {
        const fmt = Object.assign({}, st.fmt, { i: true, color: NAVY, sz: 32 });
        out.push(para({
          pBdr: bdr('left', 20, GOLD), ind: { left: 240 },
          spacing: { before: 200, after: 200, line: 336 }, jc: st.jc, pageBreakBefore: ctx.takeBreak(),
        }, inlineRuns(node, fmt, ctx), fmt));
        return;
      }
      case 'ul': case 'ol':
        listEl(node, 0, st, out, ctx);
        return;
      case 'table':
        tableEl(node, st, out, ctx);
        return;
      case 'figure': {
        const img = node.querySelector('img');
        const cap = node.querySelector('figcaption');
        const pct = parseFloat((node.getAttribute('style') || '').match(/width:\s*([\d.]+)%/)?.[1] || 70);
        const jc = cls.contains('align-left') ? 'left' : cls.contains('align-right') ? 'right' : 'center';
        if (img) out.push(imagePara(img, ctx, { wPx: Math.round(ctx.contentPx * pct / 100), jc, after: cap ? 40 : 120 }));
        if (cap && cap.textContent.trim()) {
          const cf = Object.assign({}, st.fmt, { sz: 17, color: GRAY });
          out.push(para({ jc, spacing: { after: 160 } }, inlineRuns(cap, cf, ctx), cf));
        }
        return;
      }
      case 'img':
        out.push(imagePara(node, ctx, { jc: st.jc || 'center', maxWpx: ctx.contentPx }));
        return;
      case 'hr':
        out.push(para({ pBdr: bdr('bottom', 6, BORDER), spacing: { before: 120, after: 240 } }, ''));
        return;
      default: {
        /* .ed regions, .letter, .blank-page, .bio-entry, .case-entry, generic divs */
        const sub = Object.assign({}, st);
        if (cls.contains('ed-center')) sub.jc = 'center';
        walkChildren(node, sub, out, ctx);
      }
    }
  }

  /* ---------- lists ---------- */
  function listEl(listNode, depth, st, out, ctx) {
    const ordered = listNode.tagName.toLowerCase() === 'ol';
    const numId = ordered
      ? (depth === 0 ? ctx.newOrderedNum() : ctx.currentOrderedNum())
      : 1;
    for (const li of listNode.children) {
      if (li.tagName.toLowerCase() !== 'li') continue;
      /* runs from li's inline content; nested lists walked after */
      const holder = li.cloneNode(true);
      holder.querySelectorAll(':scope > ul, :scope > ol').forEach(n => n.remove());
      const fmt = Object.assign({}, st.fmt);
      out.push(para({
        numPr: { ilvl: Math.min(depth, 2), numId },
        spacing: { after: 80, line: 360 }, contextual: true,
        jc: st.jc, pageBreakBefore: ctx.takeBreak(),
      }, inlineRuns(holder, fmt, ctx), fmt));
      for (const sub of li.children) {
        const t = sub.tagName ? sub.tagName.toLowerCase() : '';
        if (t === 'ul' || t === 'ol') listEl(sub, depth + 1, st, out, ctx);
      }
    }
  }

  /* ---------- tables ---------- */
  function tableEl(tbl, st, out, ctx) {
    if (ctx.pendingBreak) out.push(para({ pageBreakBefore: ctx.takeBreak(), spacing: { after: 0 } }, '', { sz: 4 }));
    const rows = [...tbl.querySelectorAll(':scope > thead > tr, :scope > tbody > tr, :scope > tr')];
    if (!rows.length) return;
    const CW = ctx.contentTw;

    /* column widths from declared % on the widest simple row */
    let nCols = 1;
    rows.forEach(r => { let n = 0; [...r.children].forEach(c => { n += (+c.getAttribute('colspan') || 1); }); nCols = Math.max(nCols, n); });
    const declared = new Array(nCols).fill(null);
    for (const r of rows) {
      const cells = [...r.children];
      if (cells.some(c => (+c.getAttribute('colspan') || 1) > 1)) continue;
      cells.forEach((c, i) => {
        const pct = parseFloat(((c.getAttribute('style') || '').match(/width:\s*([\d.]+)%/) || [])[1]);
        if (pct && declared[i] == null) declared[i] = pct;
      });
      if (declared.some(d => d != null)) break;
    }
    const usedPct = declared.reduce((t, d) => t + (d || 0), 0);
    const freeCols = declared.filter(d => d == null).length;
    const colTw = declared.map(d => Math.round(CW * ((d != null ? d : (Math.max(0, 100 - usedPct) / Math.max(1, freeCols))) / 100)));

    let xml = `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>
<w:tblLayout w:type="fixed"/>
<w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="140" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="140" w:type="dxa"/></w:tblCellMar></w:tblPr>
<w:tblGrid>${colTw.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;

    rows.forEach(row => {
      const isTotal = row.classList.contains('total-row');
      xml += '<w:tr>';
      let colIdx = 0;
      [...row.children].forEach(cell => {
        const isTH = cell.tagName.toLowerCase() === 'th';
        const span = +cell.getAttribute('colspan') || 1;
        let w = 0; for (let i = colIdx; i < colIdx + span && i < colTw.length; i++) w += colTw[i];
        colIdx += span;
        const borders = isTH
          ? `${bdr('top', 6, NAVY)}${bdr('left', 6, NAVY)}${bdr('bottom', 6, NAVY)}${bdr('right', 6, NAVY)}`
          : `${isTotal ? bdr('top', 12, NAVY) : bdr('top', 6, BORDER)}${bdr('left', 6, BORDER)}${bdr('bottom', 6, BORDER)}${bdr('right', 6, BORDER)}`;
        const shd = isTH ? NAVY : (isTotal ? TOTALBG : null);
        let tcPr = `<w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ''}<w:tcBorders>${borders}</w:tcBorders>${shd ? `<w:shd w:val="clear" w:color="auto" w:fill="${shd}"/>` : ''}<w:vAlign w:val="top"/></w:tcPr>`;

        const fmt = { sz: isTotal ? 20 : 19, color: isTH ? 'FFFFFF' : INK, b: isTH || undefined };
        const jc = cell.classList.contains('num') || /text-align:\s*right/.test(cell.getAttribute('style') || '') ? 'right' : undefined;
        const cellOut = [];
        const cellSt = { jc, fmt };
        if ([...cell.children].some(ch => /^(p|ul|ol|h[1-6]|div|table|blockquote|figure)$/i.test(ch.tagName))) {
          walkChildren(cell, cellSt, cellOut, ctx);
        } else {
          cellOut.push(para({ jc, spacing: { after: 0, line: 300 } }, inlineRuns(cell, fmt, ctx), fmt));
        }
        /* table cells must end with a paragraph */
        if (!cellOut.length || !/<w:p[ >][\s\S]*$/.test(cellOut[cellOut.length - 1])) cellOut.push(para({ spacing: { after: 0 } }, '', fmt));
        xml += `<w:tc>${tcPr}${cellOut.join('')}</w:tc>`;
      });
      xml += '</w:tr>';
    });
    xml += '</w:tbl>';
    out.push(xml);
    out.push(para({ spacing: { after: 120 } }, '', { sz: 4 }));   // breathing room after tables
  }

  /* ---------- two columns ---------- */
  function twoColTable(node, st, out, ctx) {
    const cols = [...node.children];
    if (!cols.length) return;
    const w = Math.floor(ctx.contentTw / cols.length);
    let xml = `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>
<w:tblLayout w:type="fixed"/>
<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="280" w:type="dxa"/></w:tblCellMar></w:tblPr>
<w:tblGrid>${cols.map(() => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid><w:tr>`;
    cols.forEach(col => {
      const cellOut = [];
      walkChildren(col, st, cellOut, ctx);
      if (!cellOut.length) cellOut.push(para({ spacing: { after: 0 } }, ''));
      xml += `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr>${cellOut.join('')}</w:tc>`;
    });
    xml += '</w:tr></w:tbl>';
    out.push(xml);
    out.push(para({ spacing: { after: 80 } }, '', { sz: 4 }));
  }

  /* ---------- table of contents ---------- */
  function tocList(node, st, out, ctx) {
    [...node.querySelectorAll('.toc-row')].forEach(row => {
      const lvl0 = row.classList.contains('lvl0');
      const label = row.querySelector('.toc-label')?.textContent?.trim() || '';
      const pg = row.querySelector('.toc-pg')?.textContent?.trim();
      const dots = !!row.querySelector('.toc-dots');
      const labFmt = lvl0 ? { b: true, color: NAVY, sz: 26 } : { color: INK, sz: 24 };
      let runs = textRun(label, labFmt);
      if (pg != null) runs += `<w:r>${rPr({ sz: 24, color: MUTED })}<w:tab/></w:r>` + textRun(pg, { sz: 24, color: MUTED });
      out.push(para({
        tabs: `<w:tab w:val="right"${dots ? ' w:leader="dot"' : ''} w:pos="${ctx.contentTw}"/>`,
        spacing: lvl0 ? { before: 140, after: 40 } : { before: 0, after: 40 },
        ind: lvl0 ? undefined : { left: 280 },
        pageBreakBefore: ctx.takeBreak(),
      }, runs, labFmt));
    });
  }

  /* ---------- signature block ---------- */
  function sigBlock(node, st, out, ctx) {
    const jc = node.classList.contains('align-center') ? 'center' : node.classList.contains('align-right') ? 'right' : 'left';
    const img = node.querySelector('img.sig-img');
    const line = node.querySelector('.sig-line');
    if (img) {
      const wPx = parseFloat((img.getAttribute('style') || '').match(/width:\s*([\d.]+)px/)?.[1] || 220);
      out.push(imagePara(img, ctx, { wPx, jc, before: 160, after: 20 }));
    }
    if (line) {
      const wPx = parseFloat((line.getAttribute('style') || '').match(/width:\s*([\d.]+)px/)?.[1] || 220);
      out.push(ruleTable(ctx, Math.round(wPx * TW_PER_PX), INK, 8, jc));
    }
    const sub = Object.assign({}, st, { jc: jc === 'left' ? undefined : jc });
    [...node.children].forEach(ch => {
      if (ch === img || ch === line) return;
      blockEl(ch, sub, out, ctx);
    });
  }

  /* ---------- floating text/image boxes ---------- */
  function floatBox(node, st, out, ctx) {
    const img = node.querySelector(':scope > img');
    if (img && node.children.length === 1) {
      out.push(imagePara(img, ctx, { maxWpx: ctx.contentPx, jc: 'left' }));
      return;
    }
    const wPt = parseFloat((node.getAttribute('style') || '').match(/width:\s*([\d.]+)pt/)?.[1] || 0);
    const w = wPt ? Math.round(wPt * 20) : Math.round(ctx.contentTw * 0.6);
    const inner = [];
    walkChildren(node, st, inner, ctx);
    if (!inner.length) return;
    out.push(`<w:tbl><w:tblPr><w:tblW w:w="${w}" w:type="dxa"/>
<w:tblBorders>${bdr('top', 6, BORDER)}${bdr('left', 6, BORDER)}${bdr('bottom', 6, BORDER)}${bdr('right', 6, BORDER)}</w:tblBorders>
<w:tblCellMar><w:top w:w="120" w:type="dxa"/><w:left w:w="160" w:type="dxa"/><w:bottom w:w="120" w:type="dxa"/><w:right w:w="160" w:type="dxa"/></w:tblCellMar></w:tblPr>
<w:tblGrid><w:gridCol w:w="${w}"/></w:tblGrid>
<w:tr><w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/></w:tcPr>${inner.join('')}</w:tc></w:tr></w:tbl>`);
    out.push(para({ spacing: { after: 80 } }, '', { sz: 4 }));
  }

  /* ---------- covers & dividers ---------- */
  function coverPage(node, st, out, ctx) {
    const sub = { jc: 'center', fmt: Object.assign({}, BODY_FMT) };
    out.push(para({ spacing: { before: 1800, after: 0 } }, '', { sz: 2 }));   // push content down the title page
    for (const ch of [...node.children]) {
      const cls = ch.classList;
      if (ch.tagName.toLowerCase() === 'img') { out.push(imagePara(ch, ctx, { wPx: 190, jc: 'center', before: 0, after: 240 })); continue; }
      if (cls.contains('cover-rule')) { out.push(goldRule(ctx)); continue; }
      if (cls.contains('cover-meta')) {
        /* meta paragraphs — centered, roomier */
        [...ch.querySelectorAll('p')].forEach(pEl => {
          const fmt = Object.assign({}, BODY_FMT);
          out.push(para({ jc: 'center', spacing: { before: 90, after: 90, line: 320 } }, inlineRuns(pEl, fmt, ctx), fmt));
        });
        continue;
      }
      const h1 = ch.tagName.toLowerCase() === 'h1' ? ch : ch.querySelector('h1');
      if (h1) {
        const fmt = { b: true, color: NAVY, sz: 56 };
        out.push(para({ jc: 'center', spacing: { before: 480, after: 160, line: 288 } }, inlineRuns(h1, fmt, ctx), fmt));
        continue;
      }
      blockEl(ch, sub, out, ctx);
    }
  }

  function coverCustom(node, st, out, ctx) {
    const bg = (node.getAttribute('style') || '').match(/background-image:\s*url\((['"]?)(.*?)\1\)/)?.[2];
    if (bg) {
      const fake = document.createElement('img');
      fake.setAttribute('src', bg);
      out.push(imagePara(fake, ctx, { wPx: ctx.contentPx, jc: 'center', before: 0, after: 240 }));
    }
    const box = node.querySelector('.cover-box');
    if (box) {
      [...box.children].forEach(ch => {
        const cls = ch.classList;
        if (cls.contains('cb-kicker')) {
          const fmt = { b: true, color: EYEBROW, sz: 18, ls: 50, caps: true };
          out.push(para({ jc: 'center', spacing: { before: 280, after: 80 } }, inlineRuns(ch, fmt, ctx), fmt));
        } else if (cls.contains('cb-title')) {
          const fmt = { b: true, color: NAVY, sz: 36 };
          out.push(para({ jc: 'center', spacing: { after: 120 } }, inlineRuns(ch, fmt, ctx), fmt));
        } else {
          const fmt = Object.assign({}, BODY_FMT);
          out.push(para({ jc: 'center', spacing: { after: 60 } }, inlineRuns(ch, fmt, ctx), fmt));
        }
      });
    }
  }

  function coverFss(node, st, out, ctx) {
    out.push(para({ spacing: { before: 1000, after: 0 } }, '', { sz: 2 }));
    for (const ch of [...node.children]) {
      const cls = ch.classList;
      if (ch.tagName.toLowerCase() === 'img') { out.push(imagePara(ch, ctx, { wPx: 250, jc: 'left', before: 0, after: 400 })); continue; }
      if (cls.contains('cover-fss-spacer')) { out.push(para({ spacing: { after: 5200 } }, '', { sz: 2 })); continue; }
      if (cls.contains('cover-fss-meta') || ch.querySelector?.('.cfm-col')) {
        const cols = [...ch.querySelectorAll('.cfm-col')];
        if (cols.length) {
          const w = Math.floor(ctx.contentTw / cols.length);
          let xml = `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="280" w:type="dxa"/></w:tblCellMar></w:tblPr>
<w:tblGrid>${cols.map(() => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid><w:tr>`;
          cols.forEach(col => {
            const cellOut = [];
            [...col.querySelectorAll(':scope > p')].forEach(pEl => {
              const fmt = Object.assign({}, BODY_FMT);
              cellOut.push(para({ spacing: { after: 180, line: 320 } }, inlineRuns(pEl, fmt, ctx), fmt));
            });
            if (!cellOut.length) cellOut.push(para({ spacing: { after: 0 } }, ''));
            xml += `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr>${cellOut.join('')}</w:tc>`;
          });
          xml += '</w:tr></w:tbl>';
          out.push(xml);
          continue;
        }
      }
      const kick = cls.contains('cover-fss-kicker') || ch.querySelector?.('.cover-fss-kicker');
      const ttl = cls.contains('cover-fss-title') || ch.querySelector?.('.cover-fss-title');
      if (kick || ttl) {
        const kEl = cls.contains('cover-fss-kicker') ? ch : ch.querySelector('.cover-fss-kicker');
        const tEl = cls.contains('cover-fss-title') ? ch : ch.querySelector('.cover-fss-title');
        if (kEl) {
          const fmt = { b: true, color: NAVY, sz: 26 };
          out.push(para({ spacing: { after: 80 } }, inlineRuns(kEl, fmt, ctx), fmt));
        }
        if (tEl) {
          const fmt = { b: true, color: NAVY, sz: 52 };
          out.push(para({ spacing: { after: 0, line: 288 } }, inlineRuns(tEl, fmt, ctx), fmt));
        }
        continue;
      }
      blockEl(ch, { jc: undefined, fmt: Object.assign({}, BODY_FMT) }, out, ctx);
    }
  }

  function dividerPage(node, st, out, ctx) {
    for (const ch of [...node.children]) {
      const cls = ch.classList;
      if (cls.contains('divider-eyebrow')) {
        const fmt = { b: true, color: EYEBROW, sz: 18, ls: 60, caps: true };
        out.push(para({ jc: 'center', spacing: { before: 3400, after: 200 } }, inlineRuns(ch, fmt, ctx), fmt));
        continue;
      }
      if (cls.contains('divider-beam')) { out.push(goldRule(ctx)); continue; }
      const h1 = ch.tagName.toLowerCase() === 'h1' ? ch : ch.querySelector?.('h1');
      if (h1) {
        const fmt = { b: true, color: NAVY, sz: 56 };
        out.push(para({ jc: 'center', spacing: { after: 200, line: 288 } }, inlineRuns(h1, fmt, ctx), fmt));
        continue;
      }
      blockEl(ch, { jc: 'center', fmt: Object.assign({}, BODY_FMT) }, out, ctx);
    }
  }

  /* ---------- page-number chrome ---------- */
  function fieldRun(instr, fmt) {
    return `<w:r>${rPr(fmt)}<w:fldChar w:fldCharType="begin"/></w:r>` +
      `<w:r>${rPr(fmt)}<w:instrText xml:space="preserve"> ${instr} </w:instrText></w:r>` +
      `<w:r>${rPr(fmt)}<w:fldChar w:fldCharType="separate"/></w:r>` +
      `<w:r>${rPr(fmt)}<w:t>1</w:t></w:r>` +
      `<w:r>${rPr(fmt)}<w:fldChar w:fldCharType="end"/></w:r>`;
  }
  function chromeXml(cfg) {
    const isHeader = cfg.pos[0] === 't';
    const jc = { l: 'left', c: 'center', r: 'right' }[cfg.pos[1]] || 'right';
    const fmt = { sz: Math.round(cfg.size * 1.5), color: cssColorToHex(cfg.color) || '8A8F94' };
    const PAGE = fieldRun('PAGE', fmt), NUM = fieldRun('NUMPAGES', fmt);
    const runs = {
      pageXofY: textRun('Page ', fmt) + PAGE + textRun(' of ', fmt) + NUM,
      nofy: PAGE + textRun(' of ', fmt) + NUM,
      n: PAGE,
      dash: textRun('— ', fmt) + PAGE + textRun(' —', fmt),
    }[cfg.format] || (textRun('Page ', fmt) + PAGE + textRun(' of ', fmt) + NUM);
    return {
      isHeader,
      para: `<w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="${jc}"/></w:pPr>${runs}</w:p>`,
    };
  }

  /* Header/footer parts get their own XML files; images inside them resolve
     through the part's OWN relationships file, so they carry namespaces for
     drawings too. */
  function chromePartXml(tag, paras) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:${tag} xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">
${paras}
</w:${tag}>`;
  }

  /* ---------- static parts ---------- */
  function stylesXml() {
    const h = (id, name, sz, extra = '') => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
<w:pPr><w:keepNext/><w:outlineLvl w:val="${+id.slice(-1) - 1}"/></w:pPr>
<w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}"/><w:b/><w:color w:val="${NAVY}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>${extra}</w:rPr></w:style>`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:color w:val="${INK}"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
${h('Heading1', 'heading 1', 44)}${h('Heading2', 'heading 2', 36)}${h('Heading3', 'heading 3', 30)}${h('Heading4', 'heading 4', 26)}
<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="${NAVY}"/><w:u w:val="single"/></w:rPr></w:style>
</w:styles>`;
  }

  function numberingXml(orderedCount) {
    const lvl = (i, fmtName, text, font) => `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${fmtName}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="${720 * (i + 1)}" w:hanging="360"/></w:pPr>${font ? `<w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:hint="default"/></w:rPr>` : ''}</w:lvl>`;
    let x = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>
${lvl(0, 'bullet', '•')}${lvl(1, 'bullet', '○')}${lvl(2, 'bullet', '▪')}</w:abstractNum>
<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>
${lvl(0, 'decimal', '%1.')}${lvl(1, 'lowerLetter', '%2.')}${lvl(2, 'lowerRoman', '%3.')}</w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>`;
    for (let i = 0; i < orderedCount; i++) {
      x += `<w:num w:numId="${2 + i}"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>`;
    }
    return x + '</w:numbering>';
  }

  /* ---------- image measurement ---------- */
  function collectImageSrcs(root) {
    const srcs = new Set();
    root.querySelectorAll('img').forEach(im => { const s = im.getAttribute('src'); if (s && s.startsWith('data:')) srcs.add(s); });
    root.querySelectorAll('.cover-custom').forEach(cc => {
      const bg = (cc.getAttribute('style') || '').match(/background-image:\s*url\((['"]?)(.*?)\1\)/)?.[2];
      if (bg && bg.startsWith('data:')) srcs.add(bg);
    });
    return [...srcs];
  }
  function measure(src) {
    return new Promise(res => {
      const im = new Image();
      im.onload = () => res({ w: im.naturalWidth || 300, h: im.naturalHeight || 200 });
      im.onerror = () => res({ w: 300, h: 200 });
      im.src = src;
    });
  }

  /* ---------- main ---------- */
  async function build(root, opts) {
    const pg = PAGE_TWIPS[opts.pageSize] || PAGE_TWIPS.letter;
    const marginTw = Math.round((opts.marginPx || 84) * TW_PER_PX);
    const ctx = {
      contentTw: pg.w - 2 * marginTw,
      contentPx: Math.round((pg.w - 2 * marginTw) / TW_PER_PX),
      dims: new Map(),
      images: [],            // {rid, name, ext, u8, contentType}
      links: [],             // {rid, href}
      imageBySrc: new Map(),
      drawingId: 0,
      orderedNums: 0,
      pendingBreak: false,
      takeBreak() { const b = this.pendingBreak; this.pendingBreak = false; return b || undefined; },
      addImage(src) {
        if (!src || !src.startsWith('data:')) return null;
        if (this.imageBySrc.has(src)) return this.imageBySrc.get(src);
        const dec = dataUrlToBytes(src);
        if (!dec) return null;
        const n = this.images.length + 1;
        const reg = { rid: `rIdImg${n}`, name: `media/image${n}.${dec.ext}`, ext: dec.ext, u8: dec.u8, contentType: dec.mime };
        this.images.push(reg);
        this.imageBySrc.set(src, reg);
        return reg;
      },
      addLink(href) {
        const rid = `rIdLink${this.links.length + 1}`;
        this.links.push({ rid, href });
        return rid;
      },
      newOrderedNum() { this.orderedNums += 1; this._curOrdered = 1 + this.orderedNums; return this._curOrdered; },
      currentOrderedNum() { return this._curOrdered || this.newOrderedNum(); },
    };

    const srcs = collectImageSrcs(root);
    await Promise.all(srcs.map(async s => { ctx.dims.set(s, await measure(s)); }));

    const out = [];
    walkChildren(root, { jc: undefined, fmt: Object.assign({}, BODY_FMT) }, out, ctx);
    if (!out.length) out.push(para({}, textRun(' ', BODY_FMT)));

    const cfg = opts.pageNums || { show: false };
    const chrome = cfg.show ? chromeXml(cfg) : null;

    /* Firm lockup at the bottom of every body page (mirrors the editor's
       body-page letterhead; the cover is skipped via <w:titlePg/>). */
    let brand = null;
    if (opts.brandDataUrl) {
      const dec = dataUrlToBytes(opts.brandDataUrl);
      if (dec) {
        const nat = await measure(opts.brandDataUrl);
        const wPx = 159;                                          // ≈ the editor's 19.5% of page width
        const hPx = Math.max(1, Math.round(wPx * nat.h / Math.max(1, nat.w)));
        const cx = Math.round(wPx * EMU_PER_PX), cy = Math.round(hPx * EMU_PER_PX);
        brand = {
          media: { name: `media/brand.${dec.ext}`, ext: dec.ext, u8: dec.u8, contentType: dec.mime },
          para: `<w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="left"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">
<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>
<wp:docPr id="9001" name="Letterhead"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>
<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
<pic:pic><pic:nvPicPr><pic:cNvPr id="9001" name="Letterhead"/><pic:cNvPicPr/></pic:nvPicPr>
<pic:blipFill><a:blip r:embed="rIdBrandImg"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`,
        };
      }
    }

    const hdrPara = chrome && chrome.isHeader ? chrome.para : null;
    const ftrParas = [];
    if (chrome && !chrome.isHeader) ftrParas.push(chrome.para);
    if (brand) ftrParas.push(brand.para);

    const sectPr = `<w:sectPr>
${hdrPara ? `<w:headerReference w:type="default" r:id="rIdHdr"/>` : ''}
${ftrParas.length ? `<w:footerReference w:type="default" r:id="rIdFtr"/>` : ''}
<w:pgSz w:w="${pg.w}" w:h="${pg.h}"/>
<w:pgMar w:top="${marginTw}" w:right="${marginTw}" w:bottom="${marginTw}" w:left="${marginTw}" w:header="648" w:footer="648" w:gutter="0"/>
<w:cols w:space="708"/>
${(chrome && cfg.skipFirst) || (!chrome && brand) ? '<w:titlePg/>' : ''}</w:sectPr>`;

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"
 xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">
<w:body>${out.join('')}${sectPr}</w:body></w:document>`;

    let rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>`;
    if (hdrPara) rels += `<Relationship Id="rIdHdr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>`;
    if (ftrParas.length) rels += `<Relationship Id="rIdFtr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>`;
    ctx.images.forEach(im => {
      rels += `<Relationship Id="${im.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${im.name}"/>`;
    });
    ctx.links.forEach(l => {
      rels += `<Relationship Id="${l.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${XE(l.href)}" TargetMode="External"/>`;
    });
    rels += '</Relationships>';

    const exts = [...new Set([...ctx.images.map(im => im.ext), ...(brand ? [brand.media.ext] : [])])];
    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
${exts.map(e => `<Default Extension="${e}" ContentType="image/${e === 'jpg' ? 'jpeg' : e}"/>`).join('')}
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
${hdrPara ? `<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>` : ''}
${ftrParas.length ? `<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>` : ''}
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

    const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

    const nowIso = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${XE(opts.title || 'Proposal')}</dc:title><dc:creator>Fog Signal Strategies</dc:creator>
<dcterms:created xsi:type="dcterms:W3CDTF">${nowIso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${nowIso}</dcterms:modified>
</cp:coreProperties>`;
    const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Fog Signal Proposals</Application></Properties>`;

    const enc = new TextEncoder();
    const files = [
      { name: '[Content_Types].xml', data: enc.encode(contentTypes) },
      { name: '_rels/.rels', data: enc.encode(rootRels) },
      { name: 'word/document.xml', data: enc.encode(documentXml) },
      { name: 'word/_rels/document.xml.rels', data: enc.encode(rels) },
      { name: 'word/styles.xml', data: enc.encode(stylesXml()) },
      { name: 'word/numbering.xml', data: enc.encode(numberingXml(ctx.orderedNums)) },
      { name: 'docProps/core.xml', data: enc.encode(coreXml) },
      { name: 'docProps/app.xml', data: enc.encode(appXml) },
    ];
    if (hdrPara) files.push({ name: 'word/header1.xml', data: enc.encode(chromePartXml('hdr', hdrPara)) });
    if (ftrParas.length) {
      files.push({ name: 'word/footer1.xml', data: enc.encode(chromePartXml('ftr', ftrParas.join('\n'))) });
      if (brand) {
        files.push({
          name: 'word/_rels/footer1.xml.rels',
          data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rIdBrandImg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${brand.media.name}"/>
</Relationships>`),
        });
        files.push({ name: `word/${brand.media.name}`, data: brand.media.u8 });
      }
    }
    ctx.images.forEach(im => files.push({ name: `word/${im.name}`, data: im.u8 }));

    return new Blob([zipStore(files)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  return { build };
})();
