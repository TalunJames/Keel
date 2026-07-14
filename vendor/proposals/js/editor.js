/* ============ Fog Signal Proposals — document canvas ============
   Paged canvas with measured pagination, Squarespace-style drag & drop,
   per-block chrome, and contenteditable wiring.                        */
'use strict';

const blockEls = new Map();     // blockId -> .blockwrap element
const blockPageMap = new Map(); // blockId -> page number (1-based), filled by paginate()

/* ---------- page numbering config ---------- */
function pageNumCfg() {
  if (!App.doc.pageNums) {
    App.doc.pageNums = { show: true, format: 'pageXofY', pos: 'br', font: 'sans', size: 10, color: '#8A8F94', skipFirst: true };
  }
  return App.doc.pageNums;
}
function pageNumText(cfg, n, total) {
  switch (cfg.format) {
    case 'n':    return String(n);
    case 'nofy': return `${n} of ${total}`;
    case 'dash': return `— ${n} —`;
    default:     return `Page ${n} of ${total}`;
  }
}
function stylePageNumEl(el, cfg) {
  el.style.cssText = 'position:absolute;user-select:none;';
  el.style.font = `600 ${cfg.size}px ${cfg.font === 'serif' ? "'Baskerville Brand',Baskerville,serif" : "'Source Sans 3',sans-serif"}`;
  el.style.color = cfg.color;
  const v = cfg.pos[0], h = cfg.pos[1];             // 't'/'b' + 'l'/'c'/'r'
  el.style[v === 't' ? 'top' : 'bottom'] = '13px';
  if (h === 'l') el.style.left = '20px';
  else if (h === 'r') el.style.right = '20px';
  else { el.style.left = '0'; el.style.right = '0'; el.style.textAlign = 'center'; }
}

/* ---------- content sync ---------- */
function syncEditable(ed) {
  if (!ed || !ed.dataset || !ed.dataset.key) return;
  App.doc.content[ed.dataset.key] = ed.innerHTML;
}

const scheduleAfterEdit = debounce(() => {
  paginate();
  positionCommentCards();
  updatePageMeta();
  renderOutline();
}, 350);

/* ---------- block DOM ---------- */
function buildBlockEl(b) {
  const wrap = htmlToEl(`<div class="blockwrap" data-bid="${b.id}" data-type="${b.type}">
    <div class="btool bt-left" contenteditable="false">
      <button class="bt-handle" draggable="true" title="Drag to move">${icon('drag', 15)}</button>
    </div>
    <div class="btool bt-right" contenteditable="false">
      <span class="bt-label">${esc(catalogItem(b.type).label)}</span>
      ${blockHasSettings(b.type) ? `<button class="bt-btn" data-bact="settings" title="Block settings">${icon('gear', 14)}</button>` : ''}
      <button class="bt-btn" data-bact="assign" title="Assign this section">${icon('users', 14)}</button>
      <button class="bt-btn" data-bact="comment" title="Comment on block">${icon('comment', 14)}</button>
      <button class="bt-btn" data-bact="dup" title="Duplicate">${icon('copy', 14)}</button>
      <button class="bt-btn danger" data-bact="del" title="Delete block">${icon('trash', 14)}</button>
    </div>
    <div class="block-body">${renderBlockBody(b)}</div>
  </div>`);
  bindBlockEvents(wrap, b);
  updateAssignTag(b, wrap);
  refreshProofChip(b, wrap);
  return wrap;
}

/* ---------- proofing chip (per-section sign-off; never exported) ---------- */
function refreshProofChip(b, wrapEl) {
  const wrap = wrapEl || blockEls.get(b.id);
  if (!wrap) return;
  wrap.querySelector('.proof-chip')?.remove();
  if (b.type === 'pagebreak') return;
  const list = (App.doc.proofing && App.doc.proofing.signoffs && App.doc.proofing.signoffs[b.id]) || [];
  const mine = list.some(s => s.uid === ME.id);
  const chip = htmlToEl(`<div class="proof-chip ${mine ? 'signed' : ''} ${list.length ? 'has-signs' : ''}" contenteditable="false"
    title="${mine ? 'You initialed this section — click to withdraw' : 'Initial this section as reviewed & approved'}">
    ${list.map(s => `<span class="avatar sm" title="${esc(s.name)} · ${fmtDate(s.ts)}" style="background:${s.color}">${s.initials}</span>`).join('')}
    <span class="proof-chip-label">${mine ? '✓ Reviewed' : 'Initial ' + esc(ME.initials)}</span>
  </div>`);
  chip.addEventListener('mousedown', (e) => e.stopPropagation());
  chip.addEventListener('click', (e) => { e.stopPropagation(); toggleSignoff(b); });
  wrap.appendChild(chip);
}

function updateProofBar() {
  const bar = $('#proofBar');
  if (!bar) return;
  if (App.mode !== 'proofing') { bar.hidden = true; return; }
  const so = proofState().signoffs;
  const blocks = proofableBlocks();
  const mine = blocks.filter(b => (so[b.id] || []).some(s => s.uid === ME.id)).length;
  bar.hidden = false;
  bar.innerHTML = `
    <span class="proof-bar-txt">${icon('check', 14, 2.4)} Proofing as <b>${esc(ME.name)}</b> — <b>${mine}</b> of <b>${blocks.length}</b> sections initialed</span>
    <span class="proof-bar-track"><span style="width:${blocks.length ? Math.round(mine / blocks.length * 100) : 0}%"></span></span>
    <button class="btn tiny" id="proofNext">Next unreviewed ↓</button>`;
  const next = bar.querySelector('#proofNext');
  next.addEventListener('click', () => {
    const target = blocks.find(b => !(so[b.id] || []).some(s => s.uid === ME.id));
    if (!target) { toast('Nothing left — every section is initialed'); return; }
    const el = blockEls.get(target.id);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); selectBlock(target.id); }
  });
  // refresh all chips so the "Initial XX" label matches the current identity
  blocks.forEach(b => refreshProofChip(b));
}

/* ---------- section assignment ---------- */
function openAssignMenu(b, anchor) {
  const card = popover(anchor, `
    <div class="menu-kicker">Assign “${esc(catalogItem(b.type).label)}” to</div>
    ${USERS.map(u => `<div class="menu-row ${b.assignee === u.id ? 'on' : ''}" data-uid="${u.id}">
      <span class="avatar sm" style="background:${u.color}">${u.initials}</span><div><b>${esc(u.name)}</b></div>
      ${b.assignee === u.id ? '<span class="check">✓</span>' : ''}</div>`).join('')}
    <div class="menu-sep"></div>
    <div class="menu-row" data-uid=""><div><b>Unassigned</b><small>Clear the assignment</small></div></div>`, { width: 235 });
  card.querySelectorAll('[data-uid]').forEach(r => r.addEventListener('click', () => {
    b.assignee = r.dataset.uid || null;
    saveDoc();
    updateAssignTag(b);
    closePopovers();
    const u = USERS.find(x => x.id === b.assignee);
    toast(u ? `Section assigned to ${u.name}` : 'Assignment cleared');
  }));
}

function updateAssignTag(b, wrapEl) {
  const wrap = wrapEl || blockEls.get(b.id);
  if (!wrap) return;
  wrap.querySelector('.assign-tag')?.remove();
  if (!b.assignee) return;
  const u = USERS.find(x => x.id === b.assignee);
  if (!u) return;
  const tag = htmlToEl(`<div class="assign-tag" contenteditable="false" title="Assigned to ${esc(u.name)} — click to change">
    <span class="avatar sm" style="background:${u.color}">${u.initials}</span><span class="assign-tag-name">${esc(u.name)}</span>
  </div>`);
  tag.addEventListener('mousedown', (e) => e.stopPropagation());
  tag.addEventListener('click', (e) => { e.stopPropagation(); openAssignMenu(b, tag); });
  wrap.appendChild(tag);
}

function bindBlockEvents(wrap, b) {
  wrap.addEventListener('mousedown', (e) => {
    if (e.target.closest('.bt-btn,.bt-handle')) return;
    selectBlock(b.id);
  });
  wrap.querySelectorAll('.ed').forEach(ed => bindEditable(ed));

  const handle = wrap.querySelector('.bt-handle');
  handle.addEventListener('dragstart', (e) => {
    App.drag = { kind: 'move', bid: b.id };
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', b.id); } catch (x) {}
    document.body.classList.add('dragging');
    wrap.classList.add('drag-src');
  });
  handle.addEventListener('dragend', () => endDrag());

  wrap.querySelector('[data-bact="del"]')?.addEventListener('click', () => removeBlock(b.id));
  wrap.querySelector('[data-bact="dup"]')?.addEventListener('click', () => duplicateBlock(b.id));
  wrap.querySelector('[data-bact="comment"]')?.addEventListener('click', () => { selectBlock(b.id); startComment(); });
  wrap.querySelector('[data-bact="assign"]')?.addEventListener('click', (e) => openAssignMenu(b, e.currentTarget));
  wrap.querySelector('[data-bact="settings"]')?.addEventListener('click', (e) => openBlockSettings(b, e.currentTarget));
}

function bindEditable(ed) {
  ed.contentEditable = (App.mode !== 'viewing');
  ed.spellcheck = spellcheckEnabled();
  ed.addEventListener('beforeinput', edBeforeInput);
  ed.addEventListener('input', (e) => {
    syncEditable(ed);
    const wrap = ed.closest('.blockwrap');
    if (wrap) clearSignoffs(wrap.dataset.bid, true);
    saveDoc({ history: historyKindFromInput(e) });
    scheduleAfterEdit();
    if (App.railTab === 'suggestions') renderRail();
  });
  ed.addEventListener('blur', () => { syncEditable(ed); saveDoc({ history: 'seal' }); });
  ed.addEventListener('keydown', (e) => {
    // Tab / Shift+Tab inside a list = indent / outdent (sub-bullets)
    if (e.key !== 'Tab' || App.mode === 'viewing') return;
    const li = closestTag(document.getSelection().anchorNode, 'li');
    if (li && ed.contains(li)) {
      e.preventDefault();
      document.execCommand(e.shiftKey ? 'outdent' : 'indent');
      syncEditable(ed); saveDoc({ history: 'seal' }); scheduleAfterEdit();
    }
  });
}

function refreshBlock(b) {
  const wrap = blockEls.get(b.id);
  if (!wrap) return;
  wrap.querySelector('.block-body').innerHTML = renderBlockBody(b);
  wrap.querySelectorAll('.ed').forEach(ed => bindEditable(ed));
  scheduleAfterEdit();
}

function selectBlock(bid) {
  App.selectedBlock = bid;
  $$('#canvas .blockwrap').forEach(w => w.classList.toggle('sel', w.dataset.bid === bid));
  if (bid && App.selFloat && typeof selectFloat === 'function') selectFloat(null);
}

/* ---------- structure mutations ---------- */
function addBlock(type, index, extra = {}, opts = {}) {
  const b = { id: uid('b'), type, ...extra };
  if (type === 'team' && !b.staff) { b.staff = ['carter', 'luke', 'digital', 'earned', 'designer', 'coord']; b.variant = App.doc.clientType; }
  if (type === 'cost' && !b.cost) b.cost = defaultCostModel(App.doc.clientType);
  if (type === 'divider' && !b.num) b.num = (App.doc.blocks.filter(x => x.type === 'divider').length + 1);
  if (type === 'toc' && b.pageBreak === undefined) b.pageBreak = true;
  if (type === 'signature' && !b.staffId) b.staffId = 'carter';
  const at = (index == null || index < 0) ? App.doc.blocks.length : index;
  App.doc.blocks.splice(at, 0, b);
  saveDoc();
  renderCanvas();
  selectBlock(b.id);
  // dropped blocks stay put — the viewport doesn't jump; the cursor is ready to type
  setTimeout(() => {
    const wrap = blockEls.get(b.id);
    if (!wrap) return;
    if (opts.scroll !== false) wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const ed = wrap.querySelector('.ed');
    if (ed && App.mode !== 'viewing') ed.focus({ preventScroll: true });
  }, 80);
  toast(`Added “${catalogItem(type).label}”`);
  return b;
}

function removeBlock(bid) {
  const b = App.doc.blocks.find(x => x.id === bid);
  App.doc.blocks = App.doc.blocks.filter(x => x.id !== bid);
  App.doc.comments.filter(c => c.blockId === bid).forEach(c => { c.blockId = null; });
  if (App.selectedBlock === bid) App.selectedBlock = null;
  saveDoc();
  renderCanvas();
  toast(`Removed “${catalogItem(b ? b.type : '').label}”`);
}

function duplicateBlock(bid) {
  const i = App.doc.blocks.findIndex(x => x.id === bid);
  if (i < 0) return;
  const src = App.doc.blocks[i];
  const nb = JSON.parse(JSON.stringify(src));
  nb.id = uid('b');
  // carry edited content to the duplicate
  Object.keys(App.doc.content).forEach(k => {
    if (k === src.id || k.startsWith(src.id + '.')) {
      App.doc.content[k.replace(src.id, nb.id)] = App.doc.content[k];
    }
  });
  App.doc.blocks.splice(i + 1, 0, nb);
  saveDoc(); renderCanvas(); selectBlock(nb.id);
}

function moveBlock(from, to) {
  const blocks = App.doc.blocks;
  const [m] = blocks.splice(from, 1);
  if (to > from) to--;
  blocks.splice(to, 0, m);
  saveDoc();
  renderCanvas();
  selectBlock(m.id);
}

/* ---------- drag & drop ---------- */
function endDrag() {
  App.drag = null;
  App.dragOverIdx = null;
  document.body.classList.remove('dragging');
  $$('#canvas .drag-src').forEach(x => x.classList.remove('drag-src'));
  $$('#canvas .dz.over').forEach(x => x.classList.remove('over'));
}

/* Drop zones are pure indicators; the whole canvas computes the nearest gap. */
function makeDropzone(idx) {
  return htmlToEl(`<div class="dz" data-idx="${idx}" contenteditable="false"><div class="dz-line"></div></div>`);
}

/* Find the insertion index for a cursor position: before the first block
   whose vertical midpoint is below the cursor. */
function dropIndexAt(clientY) {
  const blocks = App.doc.blocks;
  for (let i = 0; i < blocks.length; i++) {
    const el = blockEls.get(blocks[i].id);
    if (!el || !el.isConnected) continue;
    const r = el.getBoundingClientRect();
    if (clientY < r.top + r.height / 2) return i;
  }
  return blocks.length;
}

function onCanvasDragOver(e) {
  if (!App.drag) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = App.drag.kind === 'move' ? 'move' : 'copy';
  const idx = dropIndexAt(e.clientY);
  App.dragOverIdx = idx;
  // two dropzones can mark the same gap (end of one page + top of the
  // next) — light up only the one nearest the cursor
  let best = null, bestD = Infinity;
  $$('#canvas .dz').forEach(d => {
    if (parseInt(d.dataset.idx) !== idx) { d.classList.remove('over'); return; }
    const r = d.getBoundingClientRect();
    const dist = Math.abs(r.top + r.height / 2 - e.clientY);
    if (dist < bestD) { bestD = dist; best = d; }
  });
  $$('#canvas .dz.over').forEach(d => { if (d !== best) d.classList.remove('over'); });
  if (best) best.classList.add('over');
  autoScrollWhileDragging(e.clientY);
}

function onCanvasDrop(e) {
  if (!App.drag) return;
  e.preventDefault();
  const idx = (App.dragOverIdx != null) ? App.dragOverIdx : dropIndexAt(e.clientY);
  if (App.drag.kind === 'lib') {
    addBlock(App.drag.type, idx, {}, { scroll: false });
  } else if (App.drag.kind === 'move') {
    const from = App.doc.blocks.findIndex(x => x.id === App.drag.bid);
    if (from >= 0 && idx !== from && idx !== from + 1) moveBlock(from, idx);
  }
  endDrag();
}

/* Nudge the document while dragging near the top/bottom edge. */
function autoScrollWhileDragging(clientY) {
  const sc = $('#canvasScroll');
  if (!sc) return;
  const r = sc.getBoundingClientRect();
  const EDGE = 70;
  if (clientY < r.top + EDGE) sc.scrollTop -= 14;
  else if (clientY > r.bottom - EDGE) sc.scrollTop += 14;
}

/* ---------- canvas & pagination ---------- */
function renderCanvas() {
  const canvas = $('#canvas');
  if (!canvas) return;
  const sc = $('#canvasScroll');
  const keepScroll = sc ? sc.scrollTop : 0;   // rebuilding must not move the viewport
  blockEls.clear();
  if (typeof floatEls !== 'undefined') floatEls.clear();   // drop refs from a previously open doc
  canvas.innerHTML = '';
  const dims = pageDims();
  canvas.style.setProperty('--pw', dims.w + 'px');
  canvas.style.setProperty('--ph', dims.h + 'px');
  canvas.style.setProperty('--pm', pageMargin() + 'px');
  canvas.style.setProperty('--contentH', (dims.h - 2 * pageMargin()) + 'px');

  // first pass: everything on one working sheet, then measure & split
  const sheet = makeSheet();
  canvas.appendChild(sheet);
  const inner = sheet.querySelector('.sheet-inner');
  App.doc.blocks.forEach(b => {
    const el = buildBlockEl(b);
    blockEls.set(b.id, el);
    inner.appendChild(el);
  });
  requestAnimationFrame(() => {
    paginate(); updatePageMeta(); renderOutline(); positionCommentCards();
    if (sc && keepScroll) sc.scrollTop = keepScroll;
  });
}

function makeSheet() {
  return htmlToEl(`<div class="sheet"><div class="sheet-inner"></div><div class="page-num" contenteditable="false"></div></div>`);
}

function paginate() {
  const canvas = $('#canvas');
  if (!canvas || !App.doc) return;
  const dims = pageDims();
  const contentH = dims.h - 2 * pageMargin();
  const blocks = App.doc.blocks;

  // measure
  const heights = new Map();
  let ok = true;
  blocks.forEach(b => {
    const el = blockEls.get(b.id);
    if (!el) { ok = false; return; }
    heights.set(b.id, el.offsetHeight + 6);
  });
  if (!ok) return;

  // group into pages
  const pages = [];
  let cur = [], curH = 0;
  blocks.forEach(b => {
    const h = heights.get(b.id);
    if (cur.length && (blockBreaksBefore(b) || curH + h > contentH)) { pages.push(cur); cur = []; curH = 0; }
    cur.push(b);
    curH += h;
    if (FULLPAGE_TYPES.includes(b.type) || b.type === 'pagebreak') { pages.push(cur); cur = []; curH = 0; }
  });
  if (cur.length) pages.push(cur);
  if (!pages.length) pages.push([]);

  // record which page each block landed on (drives the reactive TOC)
  blockPageMap.clear();
  pages.forEach((pg, pi) => pg.forEach(b => blockPageMap.set(b.id, pi + 1)));

  // save caret (nodes survive the re-parenting below)
  const sel = document.getSelection();
  let saved = null;
  if (sel.rangeCount && $('#canvas').contains(sel.anchorNode)) {
    saved = { an: sel.anchorNode, ao: sel.anchorOffset, fn: sel.focusNode, fo: sel.focusOffset };
  }

  // rebuild sheets, moving block nodes (listeners survive)
  const frag = document.createDocumentFragment();
  pages.forEach((pg, pi) => {
    const sheet = makeSheet();
    const inner = sheet.querySelector('.sheet-inner');
    pg.forEach((b) => {
      const gIdx = blocks.indexOf(b);
      inner.appendChild(makeDropzone(gIdx));
      inner.appendChild(blockEls.get(b.id));
    });
    // every page gets a gap after its last block, so drops can target the
    // end of any page — not just the end of the document
    inner.appendChild(makeDropzone(pg.length ? blocks.indexOf(pg[pg.length - 1]) + 1 : blocks.length));
    const pn = sheet.querySelector('.page-num');
    const cfg = pageNumCfg();
    if (!cfg.show || (cfg.skipFirst && pi === 0)) pn.textContent = '';
    else { pn.textContent = pageNumText(cfg, pi + 1, pages.length); stylePageNumEl(pn, cfg); }
    applySheetBg(sheet, pi);
    frag.appendChild(sheet);
  });
  canvas.innerHTML = '';
  canvas.appendChild(frag);

  if (saved && saved.an && saved.an.isConnected) {
    try {
      const r = document.createRange();
      r.setStart(saved.an, saved.ao);
      r.setEnd(saved.fn && saved.fn.isConnected ? saved.fn : saved.an, saved.fn && saved.fn.isConnected ? saved.fo : saved.ao);
      sel.removeAllRanges(); sel.addRange(r);
    } catch (e) {}
  }
  if (App.selectedBlock) selectBlock(App.selectedBlock);
  updatePageMeta();

  if (App.sidebarTab === 'pages' && typeof renderPagesPanel === 'function') renderPagesPanel();
  if (typeof renderFloats === 'function') renderFloats();

  // sync TOC entries; if a TOC's height changed, run one corrective pass
  if (updateTocBlocks() && !paginate._tocPass) {
    paginate._tocPass = true;
    requestAnimationFrame(() => { paginate(); paginate._tocPass = false; });
  }
}

/* Body-page background art (letterhead / frame), configured in the Pages menu. */
function applySheetBg(sheet, pi) {
  const cfg = App.doc.pageBg;
  if (!cfg || !cfg.id || (cfg.skipFirst !== false && pi === 0)) { sheet.style.backgroundImage = ''; return; }
  const g = AssetStore.bg(cfg.id);
  if (!g) return;
  sheet.style.backgroundImage = `url(${g.src})`;
  sheet.style.backgroundSize = 'cover';
  sheet.style.backgroundPosition = 'center';
}

/* ---------- page management (Acrobat-style) ---------- */
function pageGroups() {
  const gs = [];
  App.doc.blocks.forEach(b => {
    const p = (blockPageMap.get(b.id) || 1) - 1;
    (gs[p] = gs[p] || []).push(b);
  });
  return gs.filter(g => g && g.length);
}
function movePage(pi, dir) {
  const gs = pageGroups();
  const t = pi + dir;
  if (t < 0 || t >= gs.length) return;
  [gs[pi], gs[t]] = [gs[t], gs[pi]];
  App.doc.blocks = gs.flat();
  saveDoc(); renderCanvas();
  toast(`Page ${pi + 1} moved ${dir < 0 ? 'up' : 'down'}`);
}
function deletePage(pi) {
  const gs = pageGroups();
  if (!gs[pi]) return;
  const ids = new Set(gs[pi].map(b => b.id));
  App.doc.blocks = App.doc.blocks.filter(b => !ids.has(b.id));
  App.doc.comments.forEach(c => { if (ids.has(c.blockId)) c.blockId = null; });
  saveDoc(); renderCanvas();
  toast(`Page ${pi + 1} deleted`);
}
function addBlankPageAfter(pi) {
  const gs = pageGroups();
  const last = gs[pi] ? gs[pi][gs[pi].length - 1] : null;
  const idx = last ? App.doc.blocks.indexOf(last) + 1 : App.doc.blocks.length;
  addBlock('blankpage', idx, {}, { scroll: true });
}

/* ---------- fonts ---------- */
const FONT_STACKS = {
  arial: 'Arial, Helvetica, sans-serif',
  baskerville: "'Baskerville Brand', Baskerville, Georgia, serif",
  calibri: "Calibri, 'Gill Sans', 'Segoe UI', sans-serif",
  source: "'Source Sans 3', sans-serif",
};
/* Reverse lookup: which font-menu entry is an element actually rendering?
   Matches on the first family of the computed stack, so both explicitly
   set fonts and inherited defaults (body sans, heading serif) resolve. */
function firstFamily(stack) {
  return (stack || '').split(',')[0].replace(/["']/g, '').trim().toLowerCase();
}
function detectFontKey(el) {
  const first = firstFamily(getComputedStyle(el).fontFamily);
  if (!first) return null;
  for (const k of Object.keys(FONT_STACKS)) {
    if (firstFamily(FONT_STACKS[k]) === first) return k;
  }
  return null;
}

function execFont(key) {
  const stack = FONT_STACKS[key];
  if (!stack) return;
  if (App.mode === 'viewing') { toast('Switch to Editing to format'); return; }
  document.execCommand('styleWithCSS', false, true);
  document.execCommand('fontName', false, stack);
  document.execCommand('styleWithCSS', false, false);
  const sel = document.getSelection();
  const ed = sel.anchorNode ? closestTag(sel.anchorNode, '.ed') : null;
  if (ed) { syncEditable(ed); saveDoc({ history: 'seal' }); scheduleAfterEdit(); }
}

function updatePageMeta() {
  const meta = $('#pageMeta');
  if (!meta) return;
  const n = $$('#canvas .sheet').length || 1;
  const words = ($('#canvas')?.innerText || '').trim().split(/\s+/).filter(Boolean).length;
  meta.textContent = `${n} ${n === 1 ? 'page' : 'pages'} · ${words.toLocaleString()} words · ${pageDims().label}`;
  updatePageLimitWarn(n);
}

/* ---------- RFP page-limit warning (snoozable) ---------- */
function limitSnoozeKey() { return 'fss.limitsnooze.' + App.doc.id; }
function updatePageLimitWarn(pages) {
  const limit = App.doc.rfp && App.doc.rfp.pageLimit;
  const snoozedUntil = +(localStorage.getItem(limitSnoozeKey()) || 0);
  const over = limit && pages > limit && snoozedUntil < Date.now();
  let warn = $('#pageLimitWarn');
  if (!over) { warn?.remove(); return; }
  const label = `${icon('rfp', 12)} ${pages - limit} page${pages - limit > 1 ? 's' : ''} over the ${limit}-page limit`;
  if (!warn) {
    warn = htmlToEl(`<button class="pagelimit-warn" id="pageLimitWarn" title="This RFP has a page limit — click for options"></button>`);
    $('#pageMeta').before(warn);
    warn.addEventListener('click', (e) => openPageLimitPopover(e.currentTarget));
  }
  warn.innerHTML = label;
}
function openPageLimitPopover(anchor) {
  const limit = App.doc.rfp.pageLimit;
  const pages = $$('#canvas .sheet').length;
  const card = popover(anchor, `
    <div class="pn-body" style="padding-top:10px">
      <p style="font:600 13px var(--fs-font-sans);color:#A8341E;margin:0 0 4px">${pages} pages — the RFP allows ${limit}</p>
      <p class="set-hint" style="margin:0 0 10px">Trim content, or snooze this warning while you work.</p>
      <div class="menu-kicker" style="padding-left:0">Snooze warning for</div>
      <div class="seg">
        ${[[1, '1 hour'], [4, '4 hours'], [24, '24 hours']].map(([h, l]) => `<button class="seg-btn" data-snooze="${h}">${l}</button>`).join('')}
      </div>
      <p class="set-hint" style="margin-top:10px">Change or clear the limit in the RFP panel (📄 button, gear icon).</p>
    </div>`, { width: 240 });
  card.querySelectorAll('[data-snooze]').forEach(b => b.addEventListener('click', () => {
    const h = parseInt(b.dataset.snooze);
    localStorage.setItem(limitSnoozeKey(), String(Date.now() + h * 3600 * 1000));
    closePopovers();
    updatePageMeta();
    toast(`Page-limit warning snoozed for ${h} hour${h > 1 ? 's' : ''}`);
  }));
}

function setZoom(z) {
  App.zoom = Math.max(0.5, Math.min(1.4, z));
  const c = $('#canvas');
  if (c) c.style.zoom = App.zoom;
  const lbl = $('#zoomLabel');
  if (lbl) lbl.textContent = Math.round(App.zoom * 100) + '%';
  positionCommentCards();
}

/* ---------- toolbar formatting ---------- */
function execFmt(cmd, val = null) {
  if (App.mode === 'viewing') { toast('Switch to Editing to format'); return; }
  if (cmd === 'createLink') {
    const u = prompt('Link URL');
    if (!u) return;
    document.execCommand('createLink', false, u);
  } else {
    document.execCommand(cmd, false, val);
  }
  const sel = document.getSelection();
  const ed = sel.anchorNode ? closestTag(sel.anchorNode, '.ed') : null;
  if (ed) { syncEditable(ed); saveDoc({ history: 'seal' }); scheduleAfterEdit(); }
}

/* Numeric font size on the current selection (font-tag hack → clean spans). */
function execFontSize(px) {
  if (App.mode === 'viewing') { toast('Switch to Editing to format'); return; }
  px = Math.max(7, Math.min(96, Math.round(px)));
  const sel = document.getSelection();
  if (!sel.rangeCount || sel.isCollapsed) { toast('Select some text first, then set the size'); return; }
  const ed = closestTag(sel.anchorNode, '.ed,.ed-float');
  if (!ed) return;
  document.execCommand('styleWithCSS', false, false);
  document.execCommand('fontSize', false, '7');
  $$('font[size="7"]', ed).forEach(f => {
    const span = document.createElement('span');
    span.style.fontSize = px + 'px';
    while (f.firstChild) span.appendChild(f.firstChild);
    f.replaceWith(span);
  });
  syncEditable(ed); saveDoc({ history: 'seal' }); scheduleAfterEdit();
  const inp = $('#fontSizeInput');
  if (inp) inp.value = px;
}

/* Brand text / highlight colors on the current selection. */
function execColor(kind, color) {
  if (App.mode === 'viewing') { toast('Switch to Editing to format'); return; }
  document.execCommand('styleWithCSS', false, true);
  document.execCommand(kind === 'fore' ? 'foreColor' : 'hiliteColor', false, color);
  document.execCommand('styleWithCSS', false, false);
  const sel = document.getSelection();
  const ed = sel.anchorNode ? closestTag(sel.anchorNode, '.ed,.ed-float') : null;
  if (ed) { syncEditable(ed); saveDoc({ history: 'seal' }); scheduleAfterEdit(); }
  const chip = $(kind === 'fore' ? '#foreColorBar' : '#hiliteColorBar');
  if (chip && color !== 'transparent') chip.style.background = color;
}

function applyParagraphStyle(styleKey) {
  const map = { title: 'h1', h1: 'h2', h2: 'h3', h3: 'h4', body: 'p', caption: 'small' };
  if (styleKey === 'caption') {
    execFmt('formatBlock', 'p');
    return;
  }
  execFmt('formatBlock', map[styleKey] || 'p');
}

/* ---------- outline (left rail tab) ---------- */
function renderOutline() {
  const host = $('#outlineBody');
  if (!host || App.sidebarTab !== 'outline') return;
  let html = '<div class="outline-list">';
  App.doc.blocks.forEach((b, i) => {
    const wrap = blockEls.get(b.id);
    let label = catalogItem(b.type).label;
    if (wrap) {
      const h = wrap.querySelector('h1,h2,h3');
      if (h && h.textContent.trim()) label = h.textContent.trim();
    }
    const lvl = FULLPAGE_TYPES.includes(b.type) ? 'lvl0' : 'lvl1';
    html += `<div class="outline-item ${lvl} ${App.selectedBlock === b.id ? 'on' : ''}" data-bid="${b.id}"><span>${esc(label.slice(0, 44))}</span></div>`;
  });
  html += '</div>';
  host.innerHTML = html;
  host.querySelectorAll('.outline-item').forEach(it => it.addEventListener('click', () => {
    const el = blockEls.get(it.dataset.bid);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); selectBlock(it.dataset.bid); }
  }));
}

/* Web fonts load after first paint and change block heights — repaginate. */
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    if (App.view === 'editor') { paginate(); positionCommentCards(); }
  });
}

/* ---------- canvas-level delegated events ---------- */
function bindCanvasChrome() {
  const scroll = $('#canvasScroll');
  scroll.addEventListener('scroll', positionCommentCards, { passive: true });
  scroll.addEventListener('click', (e) => {
    const tocRow = e.target.closest('.toc-row');
    if (tocRow) {
      const target = blockEls.get(tocRow.dataset.goto);
      if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); selectBlock(tocRow.dataset.goto); }
      return;
    }
    const img = e.target.closest('[data-imgclick]');
    if (img && !e.target.closest('[data-imgresize]')) {
      const b = App.doc.blocks.find(x => x.id === img.dataset.imgclick);
      if (b && App.mode !== 'viewing') pickImage(b);
      return;
    }
    if (e.target.closest('[data-imgresize]')) return;
    const sig = e.target.closest('[data-sigupload]');
    if (sig) {
      const b = App.doc.blocks.find(x => x.id === sig.dataset.sigupload);
      if (b && App.mode !== 'viewing') uploadSignature(b);
      return;
    }
    const costHint = e.target.closest('[data-costopen]');
    if (costHint) {
      const b = App.doc.blocks.find(x => x.id === costHint.dataset.costopen);
      if (b) openCostCalculator(b);
      return;
    }
    if (!e.target.closest('.float-obj') && App.selFloat) selectFloat(null);
    if (e.target === scroll || e.target.closest('.canvas-pad') === e.target) {
      App.selectedBlock = null;
      $$('#canvas .blockwrap.sel').forEach(w => w.classList.remove('sel'));
    }
  });
  // inline image free-transform: drag the corner handle to resize
  scroll.addEventListener('mousedown', (e) => {
    const handle = e.target.closest('[data-imgresize]');
    if (!handle || App.mode === 'viewing') return;
    e.preventDefault(); e.stopPropagation();
    const b = App.doc.blocks.find(x => x.id === handle.dataset.imgresize);
    const wrap = blockEls.get(b.id);
    const fig = wrap.querySelector('.img-figure');
    const cw = wrap.querySelector('.block-body').clientWidth;
    const z = App.zoom || 1;
    const sx = e.clientX, startPct = b.width || 70;
    let cur = startPct;
    const move = (ev) => {
      cur = Math.max(15, Math.min(100, Math.round(startPct + ((ev.clientX - sx) / z) / cw * 100)));
      fig.style.width = cur + '%';
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      b.width = cur;
      saveDoc();
      scheduleAfterEdit();
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
  // nearest-gap drag & drop across the whole canvas
  scroll.addEventListener('dragover', onCanvasDragOver);
  scroll.addEventListener('drop', onCanvasDrop);
}
