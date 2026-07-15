/* ============ Fog Signal Proposals — writing tools ============
   Find & replace, proofreader (mechanical grammar/style checks), and the
   native browser spell-check toggle. Spell-check underlines come from
   Chrome's built-in dictionary on the contenteditable regions.          */
'use strict';

/* ---------- spell check ---------- */
function spellcheckEnabled() { return Pref.get('spellcheck', true); }
function toggleSpellcheck() {
  const on = !spellcheckEnabled();
  Pref.set('spellcheck', on);
  $$('#canvas .ed').forEach(ed => { ed.spellcheck = on; });
  // re-focus to force Chrome to (re)paint squiggles
  const ae = document.activeElement;
  if (ae && ae.blur) { ae.blur(); }
  toast(on ? 'Spell check on — misspellings underline as you type' : 'Spell check off');
}

/* ---------- find & replace ---------- */
function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function docTextNodes() {
  const out = [];
  $$('#canvas .ed').forEach(ed => {
    const tw = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = tw.nextNode())) out.push({ node: n, ed });
  });
  return out;
}

function findMatches(q, matchCase) {
  if (!q) return [];
  const re = new RegExp(escRe(q), matchCase ? 'g' : 'gi');
  const out = [];
  docTextNodes().forEach(({ node, ed }) => {
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(node.nodeValue))) out.push({ node, ed, start: m.index, end: m.index + m[0].length });
  });
  return out;
}

function selectMatch(m) {
  const r = document.createRange();
  r.setStart(m.node, m.start); r.setEnd(m.node, m.end);
  const sel = document.getSelection();
  sel.removeAllRanges(); sel.addRange(r);
  const el = m.node.parentElement;
  const sc = $('#canvasScroll');
  if (el && sc) {
    const d = el.getBoundingClientRect().top - sc.getBoundingClientRect().top;
    if (d < 80 || d > sc.clientHeight - 120) sc.scrollBy({ top: d - sc.clientHeight / 2, behavior: 'smooth' });
  }
}

function openFindReplace() {
  const card = modal(`
    <div class="pophead">${icon('search', 15)}<b>Find &amp; replace</b><button class="iconbtn close-pop">${icon('x', 15)}</button></div>
    <div class="popbody">
      <div class="fr-grid">
        <input class="set-input" id="frFind" placeholder="Find…">
        <input class="set-input" id="frRepl" placeholder="Replace with…">
      </div>
      <label class="set-toggle" style="padding:2px 0 8px"><input type="checkbox" id="frCase" style="width:15px;height:15px"> Match case</label>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn" id="frNext">Find next</button>
        <button class="btn" id="frOne">Replace</button>
        <button class="btn primary" id="frAll">Replace all</button>
        <span class="muted" id="frStatus" style="font-size:12px;margin-left:auto"></span>
      </div>
    </div>`, { width: 430 });
  card.querySelector('.close-pop').onclick = closePopovers;

  const S = { idx: -1 };
  const status = (t) => { card.querySelector('#frStatus').textContent = t; };
  const q = () => card.querySelector('#frFind').value;
  const mc = () => card.querySelector('#frCase').checked;

  const findNext = () => {
    const ms = findMatches(q(), mc());
    if (!ms.length) { status(q() ? 'No matches' : ''); S.idx = -1; return null; }
    S.idx = (S.idx + 1) % ms.length;
    selectMatch(ms[S.idx]);
    status(`${S.idx + 1} of ${ms.length}`);
    return ms[S.idx];
  };
  card.querySelector('#frNext').addEventListener('click', findNext);
  card.querySelector('#frFind').addEventListener('keydown', (e) => { if (e.key === 'Enter') findNext(); });
  card.querySelector('#frFind').addEventListener('input', () => { S.idx = -1; status(''); });

  card.querySelector('#frOne').addEventListener('click', () => {
    if (App.mode === 'viewing') { toast('Switch to Editing to replace'); return; }
    const ms = findMatches(q(), mc());
    if (!ms.length) { status('No matches'); return; }
    if (S.idx < 0 || S.idx >= ms.length) { S.idx = -1; findNext(); return; }
    const m = ms[S.idx];
    const repl = card.querySelector('#frRepl').value;
    m.node.nodeValue = m.node.nodeValue.slice(0, m.start) + repl + m.node.nodeValue.slice(m.end);
    syncEditable(m.ed); saveDoc({ history: 'seal' }); scheduleAfterEdit();
    S.idx--;
    findNext();
  });

  card.querySelector('#frAll').addEventListener('click', () => {
    if (App.mode === 'viewing') { toast('Switch to Editing to replace'); return; }
    const term = q();
    if (!term) return;
    const re = new RegExp(escRe(term), mc() ? 'g' : 'gi');
    const repl = card.querySelector('#frRepl').value;
    let count = 0;
    const touched = new Set();
    docTextNodes().forEach(({ node, ed }) => {
      re.lastIndex = 0;
      if (!re.test(node.nodeValue)) return;
      re.lastIndex = 0;
      node.nodeValue = node.nodeValue.replace(re, () => { count++; return repl; });
      touched.add(ed);
    });
    touched.forEach(ed => syncEditable(ed));
    if (count) { saveDoc({ history: 'seal' }); scheduleAfterEdit(); }
    status(count ? `Replaced ${count}` : 'No matches');
    S.idx = -1;
  });

  setTimeout(() => card.querySelector('#frFind').focus(), 60);
}

/* ---------- proofreader ---------- */
const PROOF_RULES = [
  { re: /  +/g,                              label: 'Double space' },
  { re: /\b(\w+)\s+\1\b/gi,                  label: 'Repeated word' },
  { re: /[,;][A-Za-z]/g,                     label: 'Missing space after punctuation' },
  { re: /\bTBD\b|\bTODO\b|\bXXX\b/g,         label: 'Placeholder text' },
  { re: /\[[^\]\n]{0,40}\]/g,                label: 'Bracketed placeholder' },
  { re: /\blorem ipsum\b/gi,                 label: 'Filler text' },
  { re: /\.\.(?!\.)/g,                       label: 'Double period' },
  { re: / ,| \.| ;/g,                        label: 'Space before punctuation' },
];

/* ---------- font consistency scan ----------
   Finds body text set in a different typeface than the rest of the
   document — the classic tell of pasted-in content. Headings, pull
   quotes, covers, and TOCs have their own intentional typography and
   are left alone. One finding per element, not per text node.          */
const FONT_KEY_LABELS = { arial: 'Arial', baskerville: 'Baskerville', calibri: 'Calibri', source: 'Source Sans' };
function fontDisplayName(el) {
  const key = detectFontKey(el);
  if (key) {
    if (FONT_KEY_LABELS[key]) return FONT_KEY_LABELS[key];
    const f = (typeof Settings !== 'undefined') && Settings.fonts().find(x => x.id === key);
    if (f) return f.name;
  }
  return (getComputedStyle(el).fontFamily || '').split(',')[0].replace(/["']/g, '').trim();
}

const FONTSCAN_SKIP = 'h1,h2,h3,h4,blockquote,.divider-eyebrow,.cover-page,.cover-custom,.toc-list,.pdf-page,.sig-block,.cost-open-hint,figcaption';

function runFontScan() {
  const runs = [];
  $$('#canvas .ed').forEach(ed => {
    const wrap = ed.closest('.blockwrap');
    if (wrap && ['cover', 'toc', 'pdfpage', 'divider', 'signature'].includes(wrap.dataset.type)) return;
    const blockLabel = wrap ? catalogItem(wrap.dataset.type).label : '';
    const tw = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = tw.nextNode())) {
      if (!n.nodeValue || n.nodeValue.trim().length < 2) continue;
      const el = n.parentElement;
      if (!el || el.closest(FONTSCAN_SKIP)) continue;
      runs.push({ node: n, ed, el, blockLabel, fam: fontDisplayName(el), len: n.nodeValue.trim().length });
    }
  });
  if (!runs.length) return [];

  /* the document's body font = whatever most characters are set in */
  const counts = {};
  runs.forEach(r => { counts[r.fam] = (counts[r.fam] || 0) + r.len; });
  const fams = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (fams.length < 2) return [];
  const dominant = fams[0][0];

  const issues = [];
  const seenEls = new Set();
  runs.forEach(r => {
    if (r.fam === dominant || seenEls.has(r.el)) return;
    seenEls.add(r.el);
    const t = r.node.nodeValue;
    issues.push({
      node: r.node, ed: r.ed, start: 0, end: t.length,
      label: `Font mismatch — ${r.fam}`, blockLabel: r.blockLabel,
      excerpt: t.trim().slice(0, 60) + (t.trim().length > 60 ? '…' : '') + `  (body text is ${dominant})`,
    });
  });
  return issues;
}

/* Mechanical scan used by the Tools → Proofread modal. Named distinctly from
   collab.js `runProofread` (Claude AI topbar button) so load order cannot
   clobber that handler. */
function scanProofIssues() {
  const issues = [];
  $$('#canvas .ed').forEach(ed => {
    const wrap = ed.closest('.blockwrap');
    const blockLabel = wrap ? catalogItem(wrap.dataset.type).label : '';
    const tw = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = tw.nextNode())) {
      PROOF_RULES.forEach(rule => {
        rule.re.lastIndex = 0;
        let m;
        while ((m = rule.re.exec(n.nodeValue))) {
          const s = Math.max(0, m.index - 24), e = Math.min(n.nodeValue.length, m.index + m[0].length + 24);
          issues.push({
            node: n, ed, start: m.index, end: m.index + m[0].length,
            label: rule.label, blockLabel,
            excerpt: (s > 0 ? '…' : '') + n.nodeValue.slice(s, e).trim() + (e < n.nodeValue.length ? '…' : ''),
          });
          if (issues.length > 200) return;
        }
      });
    }
  });
  issues.push(...runFontScan());
  return issues.slice(0, 220);
}

function openProofread() {
  const issues = scanProofIssues();
  const card = modal(`
    <div class="pophead">${icon('check', 15)}<b>Proofread</b>
      <span class="muted" style="font-size:12px;margin-left:2px">${issues.length ? issues.length + ' finding' + (issues.length > 1 ? 's' : '') : 'clean'}</span>
      <button class="iconbtn close-pop">${icon('x', 15)}</button></div>
    <div class="popbody" style="max-height:58vh">
      ${issues.length ? `<div class="proof-list">
        ${issues.map((it, i) => `<div class="proof-item" data-pi="${i}">
          <span class="proof-badge ${it.label.startsWith('Font') ? 'font' : ''}">${esc(it.label)}</span>
          <div class="proof-txt">${esc(it.excerpt)}<small>${esc(it.blockLabel)}</small></div>
        </div>`).join('')}
      </div>` : `<div class="rail-empty">No mechanical issues found — double spaces, repeated words, stray placeholders, spacing around punctuation, and font consistency all look clean.</div>`}
      <p class="set-hint" style="margin-top:12px">Spelling is checked by Chrome as you type (red underlines) — toggle it under Tools. For deep grammar checks, the export-to-Word route runs Microsoft's full grammar engine.</p>
    </div>`, { width: 470 });
  card.querySelector('.close-pop').onclick = closePopovers;
  card.querySelectorAll('.proof-item').forEach(row => row.addEventListener('click', () => {
    const it = issues[parseInt(row.dataset.pi)];
    if (!it || !it.node.isConnected) { toast('That text changed — run Proofread again'); return; }
    closePopovers();
    selectMatch({ node: it.node, start: it.start, end: it.end });
  }));
}

/* ---------- list & spacing options ---------- */
function openListOptions(anchor) {
  const sel = document.getSelection();
  const list = sel.anchorNode ? closestTag(sel.anchorNode, 'ul,ol') : null;
  const ed = list && closestTag(list, '.ed,.ed-float');
  if (!list || !ed) { toast('Click into a bulleted or numbered list first, then open list options'); return; }
  const isUl = list.tagName === 'UL';
  const lis = [...list.children].filter(n => n.tagName === 'LI');
  const first = lis[0];
  const cur = {
    style: list.style.listStyleType || getComputedStyle(list).listStyleType,
    gap: parseFloat(first && first.style.marginBottom) || parseFloat(first ? getComputedStyle(first).marginBottom : 9) || 0,
    indent: parseFloat(list.style.paddingLeft) || parseFloat(getComputedStyle(list).paddingLeft) || 22,
    lh: parseFloat(first && first.style.lineHeight) || 1.62,
  };
  const STYLES = isUl
    ? [['disc', '● Solid'], ['circle', '○ Open'], ['square', '■ Square'], ['none', '— None']]
    : [['decimal', '1. 2. 3.'], ['lower-alpha', 'a. b. c.'], ['lower-roman', 'i. ii. iii.'], ['upper-alpha', 'A. B. C.']];

  const card = popover(anchor, `
    <div class="menu-kicker">${isUl ? 'Bullet' : 'Number'} style — this list</div>
    <div class="pn-body">
      <div class="lo-styles">
        ${STYLES.map(([v, l]) => `<button class="lo-style ${cur.style === v ? 'on' : ''}" data-lostyle="${v}">${l}</button>`).join('')}
      </div>
      <div class="lo-grid">
        <label>Space between items <b data-loval="gap">${Math.round(cur.gap)}px</b>
          <input type="range" min="0" max="24" step="1" value="${Math.round(cur.gap)}" data-lo="gap"></label>
        <label>Indent width <b data-loval="indent">${Math.round(cur.indent)}px</b>
          <input type="range" min="12" max="72" step="2" value="${Math.round(cur.indent)}" data-lo="indent"></label>
        <label>Line spacing <b data-loval="lh">${cur.lh.toFixed(2)}</b>
          <input type="range" min="1" max="2.2" step="0.05" value="${cur.lh}" data-lo="lh"></label>
      </div>
      <label class="set-toggle" style="padding-top:8px"><input type="checkbox" data-lo-nested checked style="width:14px;height:14px"> Apply spacing to sub-lists too</label>
      <p class="set-hint">Tab / ⇧Tab inside a list makes sub-bullets — they get their own marker style automatically (○ then ■).</p>
    </div>`, { width: 258 });

  const nested = () => card.querySelector('[data-lo-nested]').checked;
  const targets = () => nested() ? [list, ...list.querySelectorAll('ul,ol')] : [list];
  const items = () => targets().flatMap(l => [...l.children].filter(n => n.tagName === 'LI'));
  const apply = () => { syncEditable(ed); saveDoc({ history: 'seal' }); scheduleAfterEdit(); };

  card.querySelectorAll('[data-lostyle]').forEach(b => b.addEventListener('click', () => {
    list.style.listStyleType = b.dataset.lostyle;
    card.querySelectorAll('[data-lostyle]').forEach(x => x.classList.toggle('on', x === b));
    apply();
  }));
  card.querySelectorAll('[data-lo]').forEach(inp => inp.addEventListener('input', () => {
    const k = inp.dataset.lo, v = parseFloat(inp.value);
    card.querySelector(`[data-loval="${k}"]`).textContent = k === 'lh' ? v.toFixed(2) : Math.round(v) + 'px';
    if (k === 'gap') items().forEach(li => { li.style.marginBottom = v + 'px'; });
    if (k === 'indent') targets().forEach(l => { l.style.paddingLeft = v + 'px'; });
    if (k === 'lh') items().forEach(li => { li.style.lineHeight = String(v); });
    syncEditable(ed); saveDoc(); scheduleAfterEdit();
  }));
}

/* ---------- version diff (Google-Docs-style "view changes") ---------- */
function htmlToText(html) {
  const t = document.createElement('div');
  t.innerHTML = html || '';
  return (t.textContent || '').replace(/\s+/g, ' ').trim();
}

/* Word-level LCS diff → HTML with <del>/<ins>. Bails out on huge inputs. */
function wordDiffHTML(a, b) {
  const A = a.split(' ').filter(Boolean), B = b.split(' ').filter(Boolean);
  if (A.length * B.length > 250000) return null;
  const n = A.length, m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  const flush = (arr, tag) => arr.length ? `<${tag}>${esc(arr.join(' '))}</${tag}> ` : '';
  let dels = [], inss = [], keeps = [];
  const emit = () => { out.push(flush(dels, 'del'), flush(inss, 'ins')); dels = []; inss = []; };
  while (i < n && j < m) {
    if (A[i] === B[j]) { emit(); keeps.push(A[i]); if (keeps.length > 14) { out.push(esc(keeps.slice(0, 6).join(' ')) + ' <span class="diff-skip">…</span> ' + esc(keeps.slice(-6).join(' ')) + ' '); keeps = []; } i++; j++; }
    else { if (keeps.length) { out.push(esc(keeps.join(' ')) + ' '); keeps = []; } if (dp[i + 1][j] >= dp[i][j + 1]) dels.push(A[i++]); else inss.push(B[j++]); }
  }
  if (keeps.length) out.push(esc(keeps.join(' ')) + ' ');
  while (i < n) dels.push(A[i++]);
  while (j < m) inss.push(B[j++]);
  emit();
  return out.join('');
}

function openVersionDiff(vid) {
  const v = App.doc.versions.find(x => x.id === vid);
  if (!v) return;
  const snap = JSON.parse(v.snapshot);
  const entries = [];

  if ((snap.title || '') !== App.doc.title) {
    entries.push({ label: 'Document title', html: wordDiffHTML(snap.title || '', App.doc.title) || '' });
  }
  const curIds = new Set(App.doc.blocks.map(b => b.id));
  const snapIds = new Set((snap.blocks || []).map(b => b.id));
  (snap.blocks || []).forEach(b => {
    if (!curIds.has(b.id)) entries.push({ label: catalogItem(b.type).label, html: `<del>Section removed</del>` });
  });
  App.doc.blocks.forEach(b => {
    if (!snapIds.has(b.id)) { entries.push({ label: catalogItem(b.type).label, html: `<ins>Section added</ins>` }); return; }
    // text changes: compare stored content for this block's keys
    const keys = new Set([
      ...Object.keys(snap.content || {}), ...Object.keys(App.doc.content || {}),
    ].filter(k => k === b.id || k.startsWith(b.id + '.')));
    let oldT = '', newT = '';
    keys.forEach(k => {
      oldT += ' ' + htmlToText((snap.content || {})[k] || '');
      newT += ' ' + htmlToText((App.doc.content || {})[k] || '');
    });
    oldT = oldT.trim(); newT = newT.trim();
    const sb = (snap.blocks || []).find(x => x.id === b.id);
    const propsChanged = JSON.stringify({ ...sb, id: 0 }) !== JSON.stringify({ ...b, id: 0 });
    if (oldT !== newT) {
      const d = wordDiffHTML(oldT, newT);
      entries.push({ label: blockLabelFor(b), html: d != null ? d : '<i>Section rewritten (too large to diff word-by-word)</i>' });
    } else if (propsChanged) {
      entries.push({ label: blockLabelFor(b), html: '<i>Settings changed (staff, pricing, layout, or options)</i>' });
    }
  });

  const card = modal(`
    <div class="pophead">${icon('clock', 15)}<b>Changes since “${esc(v.label)}”</b>
      <span class="muted" style="font-size:11.5px">${fmtDate(v.ts)}</span>
      <button class="iconbtn close-pop">${icon('x', 15)}</button></div>
    <div class="popbody" style="max-height:60vh">
      ${entries.length ? `
        <div class="diff-legend"><del>removed since then</del> · <ins>added since then</ins></div>
        ${entries.map(en => `<div class="diff-entry"><div class="diff-entry-h">${esc(en.label)}</div><div class="diff-body">${en.html}</div></div>`).join('')}
      ` : `<div class="rail-empty">No text differences between that checkpoint and the current document.</div>`}
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        <button class="btn" id="vdClose">Close</button>
        <button class="btn primary" id="vdRestore">Restore this version</button>
      </div>
    </div>`, { width: 560 });
  card.querySelector('.close-pop').onclick = closePopovers;
  card.querySelector('#vdClose').onclick = closePopovers;
  card.querySelector('#vdRestore').onclick = () => { closePopovers(); restoreVersion(vid); };
}

function blockLabelFor(b) {
  const el = blockEls.get(b.id);
  const h = el && el.querySelector('h1,h2,h3');
  return (h && h.textContent.trim().slice(0, 48)) || catalogItem(b.type).label;
}

/* ---------- tools menu ---------- */
function openToolsMenu(anchor) {
  const card = popover(anchor, `
    <div class="menu-row" data-tool="find"><div><b>Find &amp; replace</b><small>⌘F — search the whole proposal</small></div></div>
    <div class="menu-row" data-tool="proof"><div><b>Proofread</b><small>Double spaces, repeated words, placeholders, font mismatches…</small></div></div>
    <div class="menu-sep"></div>
    <div class="menu-row" data-tool="spell"><div><b>Spell check</b><small>Chrome's dictionary, as you type</small></div><span class="check">${spellcheckEnabled() ? '✓' : ''}</span></div>`,
    { width: 265 });
  card.querySelector('[data-tool="find"]').addEventListener('click', () => { closePopovers(); openFindReplace(); });
  card.querySelector('[data-tool="proof"]').addEventListener('click', () => { closePopovers(); openProofread(); });
  card.querySelector('[data-tool="spell"]').addEventListener('click', () => { closePopovers(); toggleSpellcheck(); });
}
