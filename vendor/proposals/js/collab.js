/* ============ Fog Signal Proposals — collaboration ============
   Suggesting mode (track changes) + anchored comments with assignees.
   Suggestions live in the document HTML as <ins>/<del data-sid> so they
   survive save/reload and export can resolve them.                    */
'use strict';

/* =================== MODE =================== */
function setMode(mode) {
  App.mode = mode;
  document.body.dataset.mode = mode;
  $$('.ed, .ed-float', $('#canvas')).forEach(ed => { ed.contentEditable = (mode !== 'viewing'); });
  const badge = $('#modeBtn');
  if (badge) {
    const map = { editing: ['Editing', 'mode-edit'], suggesting: ['Suggesting', 'mode-sugg'], proofing: ['Proofing', 'mode-proof'], viewing: ['Viewing', 'mode-view'] };
    const [label, cls] = map[mode] || map.editing;
    badge.className = 'btn mode-btn ' + cls;
    badge.innerHTML = `<span class="dot"></span>${label} <span class="caret">▾</span>`;
  }
  if (typeof updateProofBar === 'function') updateProofBar();
  if (mode === 'suggesting') toast('Suggesting on — edits become tracked suggestions');
  if (mode === 'proofing') toast('Proofing — initial each section; any edit becomes a suggestion and resets sign-offs');
}

/* =================== PROOFING SIGN-OFFS =================== */
function proofState() {
  if (!App.doc.proofing) App.doc.proofing = { signoffs: {} };
  if (!App.doc.proofing.signoffs) App.doc.proofing.signoffs = {};
  return App.doc.proofing;
}
function proofableBlocks() { return App.doc.blocks.filter(b => b.type !== 'pagebreak'); }

function toggleSignoff(b) {
  if (App.mode !== 'proofing') { toast('Switch the mode picker to Proofing to initial sections'); return; }
  const so = proofState().signoffs;
  const list = so[b.id] || [];
  const i = list.findIndex(s => s.uid === ME.id);
  if (i >= 0) list.splice(i, 1);
  else list.push({ uid: ME.id, initials: ME.initials, name: ME.name, color: ME.color, ts: Date.now() });
  so[b.id] = list;
  saveDoc();
  refreshProofChip(b);
  updateProofBar();
  const mine = proofableBlocks().filter(x => (so[x.id] || []).some(s => s.uid === ME.id)).length;
  if (mine === proofableBlocks().length) toast('Every section initialed — proofing complete 🎉');
}

/* Any content change invalidates that section's sign-offs. */
function clearSignoffs(blockId, quiet) {
  const so = App.doc.proofing && App.doc.proofing.signoffs;
  if (!so || !so[blockId] || !so[blockId].length) return;
  delete so[blockId];
  const b = App.doc.blocks.find(x => x.id === blockId);
  if (b) refreshProofChip(b);
  updateProofBar();
  if (!quiet) toast('Section changed — its review sign-offs were reset');
}

/* =================== SUGGESTING (track changes) =================== */
function closestTag(node, selector) {
  const el = node.nodeType === 1 ? node : node.parentElement;
  return el ? el.closest(selector) : null;
}
function unwrapEl(el) {
  const p = el.parentNode;
  while (el.firstChild) p.insertBefore(el.firstChild, el);
  el.remove();
  p.normalize && p.normalize();
}
function setCaret(node, before) {
  const sel = document.getSelection();
  const r = document.createRange();
  if (before) r.setStartBefore(node); else r.setStartAfter(node);
  r.collapse(true);
  sel.removeAllRanges(); sel.addRange(r);
}

function edBeforeInput(e) {
  if (App.mode === 'viewing') { e.preventDefault(); return; }
  if (App.mode !== 'suggesting' && App.mode !== 'proofing') return;
  const t = e.inputType;
  if (t.startsWith('format') || t === 'historyUndo' || t === 'historyRedo') return;

  // proofing: the edit is recorded as a suggestion, the section's sign-offs
  // reset, and the doc drops back into review (suggesting) mode
  if (App.mode === 'proofing') {
    const wrap = e.currentTarget.closest('.blockwrap');
    if (wrap) clearSignoffs(wrap.dataset.bid, true);
    setMode('suggesting');
    toast('Change suggested — sign-offs reset; back in Suggesting for review');
  }

  e.preventDefault();
  const sel = document.getSelection();
  if (!sel.rangeCount) return;

  if (t === 'insertText' || t === 'insertFromPaste' || t === 'insertParagraph' || t === 'insertLineBreak') {
    let text = '';
    if (t === 'insertText') text = e.data || '';
    if (t === 'insertFromPaste') text = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || '';
    suggestInsert(text, t === 'insertParagraph' || t === 'insertLineBreak');
  } else if (t.startsWith('delete')) {
    const trs = e.getTargetRanges();
    if (trs && trs.length) {
      const r = document.createRange();
      r.setStart(trs[0].startContainer, trs[0].startOffset);
      r.setEnd(trs[0].endContainer, trs[0].endOffset);
      suggestDelete(r, t.includes('Backward'));
    }
  }
  syncEditable(e.currentTarget);
  saveDoc({ history: historyKindFromInput(e) }); // preventDefault suppresses the input event that normally saves
  scheduleAfterEdit();
  renderRail();
}

function suggestInsert(text, isBreak) {
  const sel = document.getSelection();
  let range = sel.getRangeAt(0);

  if (!range.collapsed) {           // replacing a selection = delete suggestion first
    const delEl = markRangeDeleted(range.cloneRange());
    if (delEl) { setCaret(delEl, false); range = document.getSelection().getRangeAt(0); }
    else range.collapse(false);
  }

  const node = isBreak ? document.createElement('br') : document.createTextNode(text);
  const host = closestTag(range.startContainer, 'ins[data-sid]');

  if (host && host.dataset.author === ME.name) {
    range.insertNode(node);                       // extend own pending insertion
  } else {
    const ins = document.createElement('ins');
    ins.dataset.sid = uid('sg'); ins.dataset.author = ME.name; ins.dataset.ts = Date.now();
    ins.appendChild(node);
    range.insertNode(ins);
  }
  const r2 = document.createRange();
  r2.setStartAfter(node); r2.collapse(true);
  sel.removeAllRanges(); sel.addRange(r2);
}

function suggestDelete(range, backward) {
  if (range.collapsed) return;

  // Deleting inside a pending deletion: just hop the caret over it.
  const inDel = closestTag(range.startContainer, 'del[data-sid]');
  if (inDel && inDel === closestTag(range.endContainer, 'del[data-sid]')) {
    setCaret(inDel, backward);
    return;
  }
  // Deleting your own pending insertion: actually remove it.
  const inIns = closestTag(range.startContainer, 'ins[data-sid]');
  if (inIns && inIns === closestTag(range.endContainer, 'ins[data-sid]') && inIns.dataset.author === ME.name) {
    range.deleteContents();
    if (!inIns.textContent && !inIns.querySelector('br,img')) inIns.remove();
    return;
  }
  const delEl = markRangeDeleted(range);
  if (delEl) setCaret(delEl, backward);
}

function markRangeDeleted(range) {
  try {
    const frag = range.extractContents();
    // Pending insertions inside the deleted span simply disappear.
    [...frag.querySelectorAll ? frag.querySelectorAll('ins[data-sid]') : []].forEach(ins => {
      if (ins.dataset.author === ME.name) ins.remove(); else unwrapEl(ins);
    });
    if (!frag.textContent && !frag.querySelector('br,img')) return null;
    const del = document.createElement('del');
    del.dataset.sid = uid('sg'); del.dataset.author = ME.name; del.dataset.ts = Date.now();
    del.appendChild(frag);
    range.insertNode(del);
    // merge with an adjacent deletion by the same author
    const prev = del.previousSibling;
    if (prev && prev.nodeType === 1 && prev.matches && prev.matches('del[data-sid]') && prev.dataset.author === del.dataset.author) {
      while (del.firstChild) prev.appendChild(del.firstChild);
      del.remove();
      return prev;
    }
    return del;
  } catch (err) { return null; }
}

/* ---- suggestion inventory / resolution ---- */
function collectSuggestions() {
  const out = new Map();
  $$('#canvas .ed ins[data-sid], #canvas .ed del[data-sid]').forEach(el => {
    const sid = el.dataset.sid;
    const wrap = el.closest('.blockwrap');
    if (!out.has(sid)) out.set(sid, {
      sid, kind: el.tagName === 'INS' ? 'ins' : 'del',
      author: el.dataset.author || 'Unknown', ts: +el.dataset.ts || 0,
      text: '', blockId: wrap ? wrap.dataset.bid : null, el,
    });
    out.get(sid).text += el.textContent;
  });
  return [...out.values()].sort((a, b) => a.ts - b.ts);
}

function resolveSuggestion(sid, accept) {
  $$(`#canvas [data-sid="${sid}"]`).forEach(el => {
    const wrap = el.closest('.blockwrap');
    if (wrap && accept) clearSignoffs(wrap.dataset.bid, true);   // accepted change = re-review needed
    const ed = el.closest('.ed');
    const isIns = el.tagName === 'INS';
    if ((accept && isIns) || (!accept && !isIns)) unwrapEl(el);
    else el.remove();
    if (ed) syncEditable(ed);
  });
  saveDoc();
  scheduleAfterEdit();
  renderRail();
  toast(accept ? 'Suggestion accepted' : 'Suggestion rejected');
}
function resolveAllSuggestions(accept) {
  collectSuggestions().forEach(s => {
    $$(`#canvas [data-sid="${s.sid}"]`).forEach(el => {
      const ed = el.closest('.ed');
      const isIns = el.tagName === 'INS';
      if ((accept && isIns) || (!accept && !isIns)) unwrapEl(el); else el.remove();
      if (ed) syncEditable(ed);
    });
  });
  saveDoc(); scheduleAfterEdit(); renderRail();
  toast(accept ? 'All suggestions accepted' : 'All suggestions rejected');
}

/* =================== COMMENTS =================== */
function startComment() {
  if (App.mode === 'viewing') { toast('Comments are read-only in Viewing mode'); return; }
  const sel = document.getSelection();
  let blockId = App.selectedBlock, quote = '', cid = uid('c');

  if (sel.rangeCount && !sel.isCollapsed) {
    const range = sel.getRangeAt(0);
    const ed = closestTag(range.startContainer, '.ed');
    const wrap = closestTag(range.startContainer, '.blockwrap');
    if (ed && wrap && ed === closestTag(range.endContainer, '.ed')) {
      blockId = wrap.dataset.bid;
      quote = range.toString().slice(0, 120);
      try {
        const mark = document.createElement('span');
        mark.className = 'cmk pending'; mark.dataset.cid = cid;
        range.surroundContents(mark);
      } catch (err) { /* selection crosses elements — fall back to block anchor */ }
      syncEditable(ed);
    }
  }
  if (!blockId) { toast('Select text or click a block first, then comment'); return; }
  App.pendingComment = { cid, blockId, quote };
  App.showRail = true; App.railTab = 'comments';
  renderRailChrome(); renderRail();
  setTimeout(() => { const ta = $('#composerText'); if (ta) ta.focus(); }, 60);
}

function cancelPendingComment() {
  if (!App.pendingComment) return;
  const mark = $(`#canvas .cmk[data-cid="${App.pendingComment.cid}"]`);
  if (mark) { const ed = mark.closest('.ed'); unwrapEl(mark); if (ed) { syncEditable(ed); saveDoc({ silent: true }); } }
  App.pendingComment = null;
  renderRail();
}

/* Strip comment marks that no longer have a live comment — a composer
   abandoned before posting, or marks whose comment was deleted elsewhere —
   so text doesn't stay highlighted forever. */
function cleanOrphanCommentMarks(doc) {
  const live = new Set((doc.comments || []).map(c => c.id));
  Object.keys(doc.content || {}).forEach(k => {
    const html = doc.content[k];
    if (typeof html !== 'string' || html.indexOf('cmk') === -1) return;
    const t = document.createElement('div');
    t.innerHTML = html;
    let changed = false;
    t.querySelectorAll('.cmk').forEach(mk => {
      if (mk.classList.contains('pending') || !live.has(mk.dataset.cid)) { unwrapEl(mk); changed = true; }
    });
    if (changed) doc.content[k] = t.innerHTML;
  });
}

function postPendingComment() {
  const p = App.pendingComment;
  const ta = $('#composerText');
  const as = $('#composerAssign');
  if (!p || !ta || !ta.value.trim()) return;
  const assignee = as && as.value !== '—' ? as.value : null;
  const mark = $(`#canvas .cmk[data-cid="${p.cid}"]`);
  if (mark) { mark.classList.remove('pending'); syncEditable(mark.closest('.ed')); }
  App.doc.comments.unshift({
    id: p.cid, blockId: p.blockId, quote: p.quote, text: ta.value.trim(),
    author: ME.name, initials: ME.initials, color: ME.color,
    assignee, resolved: false, ts: Date.now(), replies: [],
  });
  App.pendingComment = null;
  saveDoc();
  renderRail(); updateRailCounts();
  toast(assignee ? `Comment posted — assigned to ${assignee}` : 'Comment posted');
}

function resolveComment(id) {
  const c = App.doc.comments.find(x => x.id === id);
  if (!c) return;
  c.resolved = !c.resolved;
  const mark = $(`#canvas .cmk[data-cid="${id}"]`);
  if (mark) mark.classList.toggle('resolved', c.resolved);
  saveDoc(); renderRail(); updateRailCounts();
}
function deleteComment(id) {
  App.doc.comments = App.doc.comments.filter(c => c.id !== id);
  const mark = $(`#canvas .cmk[data-cid="${id}"]`);
  if (mark) { const ed = mark.closest('.ed'); unwrapEl(mark); if (ed) syncEditable(ed); }
  saveDoc(); renderRail(); updateRailCounts();
}
function replyToComment(id, text) {
  const c = App.doc.comments.find(x => x.id === id);
  if (!c || !text.trim()) return;
  c.replies.push({ author: ME.name, initials: ME.initials, color: ME.color, text: text.trim(), ts: Date.now() });
  saveDoc(); renderRail();
}
function assignComment(id, who) {
  const c = App.doc.comments.find(x => x.id === id);
  if (!c) return;
  c.assignee = who === '—' ? null : who;
  saveDoc(); renderRail();
  if (c.assignee) toast('Assigned to ' + c.assignee);
}

/* =================== RIGHT RAIL =================== */
function updateRailCounts() {
  const cCount = App.doc.comments.filter(c => !c.resolved).length;
  const cBtn = $('#commentCount');
  if (cBtn) cBtn.textContent = cCount;
  const tabs = $('#railTabs');
  let total = cCount;
  if (tabs) {
    const sCount = collectSuggestions().length;
    total += sCount;
    tabs.querySelector('[data-tab="comments"]').textContent = `Comments (${cCount})`;
    tabs.querySelector('[data-tab="suggestions"]').textContent = `Suggestions (${sCount})`;
  }
  // First comment/suggestion (yours or a collaborator's) opens the rail; a
  // deliberate collapse while threads exist is left alone.
  if (total > 0 && updateRailCounts._last === 0 && !App.showRail) {
    App.showRail = true;
    renderRailChrome();
  }
  updateRailCounts._last = total;
}

function renderRail() {
  const host = $('#railBody');
  if (!host) return;
  if (App.railTab === 'ai') renderChatRail(host);
  else if (App.railTab === 'suggestions') renderSuggestionRail(host);
  else renderCommentRail(host);
  updateRailCounts();
}

/* =================== ASK CLAUDE (chat) =================== */
/* Chat history lives per-doc in memory (App.aiChat[docId]). Read-only Q&A —
   the model answers about the RFP, this proposal, and the firm context; it
   never mutates the document. */
function chatHistory() {
  App.aiChat = App.aiChat || {};
  const id = App.doc ? App.doc.id : '_';
  if (!App.aiChat[id]) App.aiChat[id] = [];
  return App.aiChat[id];
}

function renderChatRail(host) {
  const hist = chatHistory();
  const unavailable = window.AI && AI.available === false;
  host.innerHTML = `
  <div class="ai-chat">
    <div class="ai-chat-log" id="aiChatLog">
      ${unavailable
        ? `<div class="rail-empty">Claude isn’t configured on the server yet. An administrator can add an API key to enable this.</div>`
        : (hist.length
            ? hist.map(m => `<div class="ai-msg ai-${m.role}">${m.role === 'assistant' ? mdish(m.content) : esc(m.content)}</div>`).join('')
            : `<div class="rail-empty">Ask about the RFP, this proposal, or the firm. Claude sees the current document, its RFP notes, and your saved firm context.<br><br>Try: “What does the RFP require that we haven’t addressed yet?”</div>`)}
    </div>
    <div class="ai-chat-input">
      <textarea id="aiChatText" rows="2" placeholder="Ask Claude about this proposal…" ${unavailable ? 'disabled' : ''}></textarea>
      <button class="btn primary" id="aiChatSend" ${unavailable ? 'disabled' : ''} title="Send (Enter)">${icon('send', 15)}</button>
    </div>
  </div>`;

  const log = host.querySelector('#aiChatLog');
  const ta = host.querySelector('#aiChatText');
  const send = host.querySelector('#aiChatSend');
  if (!ta) return;
  const scrollDown = () => { log.scrollTop = log.scrollHeight; };
  scrollDown();

  let busy = false;
  const doSend = async () => {
    const text = ta.value.trim();
    if (!text || busy) return;
    busy = true;
    hist.push({ role: 'user', content: text });
    ta.value = '';
    // render the user turn + a streaming assistant bubble
    log.insertAdjacentHTML('beforeend', `<div class="ai-msg ai-user">${esc(text)}</div><div class="ai-msg ai-assistant" id="aiStreaming"><span class="ai-typing">…</span></div>`);
    scrollDown();
    const bubble = host.querySelector('#aiStreaming');
    try {
      const full = await AI.chat(hist.map(m => ({ role: m.role, content: m.content })), (_d, sofar) => {
        bubble.innerHTML = mdish(sofar);
        scrollDown();
      });
      bubble.innerHTML = mdish(full);
      bubble.removeAttribute('id');
      hist.push({ role: 'assistant', content: full });
    } catch (e) {
      bubble.innerHTML = `<span class="ai-err">${esc(e.message || 'Something went wrong')}</span>`;
      bubble.removeAttribute('id');
    } finally {
      busy = false;
      scrollDown();
    }
  };
  send.addEventListener('click', doSend);
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
  });
}

/* =================== PROOFREAD WITH CLAUDE =================== */
const CLAUDE_AUTHOR = { author: 'Claude', initials: 'AI', color: '#B8932A' };

async function runProofread() {
  if (window.AI && AI.available === false) { toast('Claude isn’t configured on the server'); return; }
  if (!App.doc) return;
  const btn = $('#proofreadBtn');
  const buttonContent = btn && btn.innerHTML;
  if (btn) {
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.innerHTML = '<span class="proofread-spinner" aria-hidden="true"></span> Proofreading…';
  }
  toast('Claude is proofreading the proposal…', 8000);
  try {
    const { edits } = await AI.proofread({});
    if (!edits || !edits.length) { toast('Claude found nothing to flag'); return; }
    setMode('suggesting');
    let applied = 0;
    const touched = new Set();
    edits.forEach((ed) => {
      const res = applyProofEdit(ed);
      if (res) {
        applied++;
        touched.add(res.blockId);
        addClaudeComment(res.blockId, ed.find, `[${ed.severity || 'edit'}] ${ed.reason || ''}`.trim());
      }
    });
    touched.forEach((bid) => {
      const b = App.doc.blocks.find((x) => x.id === bid);
      if (b) refreshBlock(b);
    });
    saveDoc();
    App.railTab = 'suggestions';
    renderRailChrome();
    renderRail();
    toast(applied
      ? `Claude suggested ${applied} change${applied === 1 ? '' : 's'} — review in Suggestions; rationale in Comments`
      : 'Claude’s edits could not be placed precisely (text may have changed)');
  } catch (e) {
    toast(e.message || 'Proofread failed');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.innerHTML = buttonContent;
    }
  }
}

/* Insert one find→replace as an atomic tracked change into a content region.
   Returns {sid, blockId} on success, or null if `find` wasn't located verbatim. */
function applyProofEdit(edit) {
  const key = String(edit.blockKey || '');
  const find = String(edit.find || '');
  if (!key || !find) return null;
  let html = App.doc.content[key];
  if (html == null) {
    const ed = $(`#canvas .ed[data-key="${CSS.escape(key)}"]`);
    if (!ed) return null;
    html = ed.innerHTML;
  }
  // Skip if the change was already applied (e.g. duplicate edit) or the text
  // already sits inside a suggestion.
  const idx = html.indexOf(find);
  if (idx < 0) return null;
  const sid = uid('sg');
  const attrs = `data-sid="${sid}" data-author="${esc(ME.name)}" data-ts="${Date.now()}"`;
  const original = html.slice(idx, idx + find.length); // preserve exact bytes
  const del = `<del ${attrs}>${original}</del>`;
  const ins = `<ins ${attrs}>${esc(String(edit.replace || ''))}</ins>`;
  App.doc.content[key] = html.slice(0, idx) + del + ins + html.slice(idx + find.length);
  return { sid, blockId: key.split('.')[0] };
}

function addClaudeComment(blockId, quote, text) {
  if (!text) return;
  App.doc.comments.unshift({
    id: uid('c'),
    blockId,
    quote: String(quote || '').slice(0, 160),
    text,
    author: CLAUDE_AUTHOR.author,
    initials: CLAUDE_AUTHOR.initials,
    color: CLAUDE_AUTHOR.color,
    ts: Date.now(),
    resolved: false,
    replies: [],
    assignee: null,
  });
}

/* Tiny, safe markdown-ish renderer for assistant text (bold, code, lists, paras).
   Escapes first, so no HTML injection. */
function mdish(s) {
  let t = esc(String(s || ''));
  t = t.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const lines = t.split('\n');
  let html = '', inList = false;
  for (const ln of lines) {
    const li = ln.match(/^\s*[-*]\s+(.*)$/);
    if (li) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${li[1]}</li>`; }
    else { if (inList) { html += '</ul>'; inList = false; } if (ln.trim()) html += `<p>${ln}</p>`; }
  }
  if (inList) html += '</ul>';
  return html || '<p></p>';
}

function anchorYFor(blockId, cid) {
  const wrapRect = $('#canvasScroll').getBoundingClientRect();
  let el = cid ? $(`#canvas .cmk[data-cid="${cid}"]`) : null;
  if (!el) el = $(`#canvas .blockwrap[data-bid="${blockId}"]`);
  if (!el) return 14;
  return el.getBoundingClientRect().top - wrapRect.top + 4;
}

function renderCommentRail(host) {
  const comments = App.doc.comments;
  const showResolved = App.showResolved;
  const visible = comments.filter(c => showResolved || !c.resolved);
  const assignOptions = ['—', ...USERS.filter(u => u.id !== 'me').map(u => u.name)];

  let html = `<div class="rail-scrolltrap" id="commentLayer">`;
  if (!visible.length && !App.pendingComment) {
    html += `<div class="rail-empty">Select text on the page and press the comment button (or <b>⌘⌥M</b>) to start a thread. Comments anchor beside the text they mark — just like Google Docs.</div>`;
  }
  visible.forEach(c => {
    html += `<div class="ccard ${c.resolved ? 'resolved' : ''} ${App.activeComment === c.id ? 'active' : ''}" data-cid="${c.id}">
      <div class="ccard-head">
        <span class="avatar" style="background:${c.color}">${c.initials}</span>
        <span class="ccard-who"><b>${esc(c.author)}</b><small>${timeAgo(c.ts)}</small></span>
        <button class="iconbtn ok" data-act="resolve" title="${c.resolved ? 'Re-open' : 'Resolve'}">${icon('check', 13, 2.6)}</button>
        <button class="iconbtn danger" data-act="del" title="Delete">${icon('trash', 13)}</button>
      </div>
      ${c.quote ? `<div class="ccard-quote">“${esc(c.quote)}”</div>` : ''}
      <div class="ccard-text">${esc(c.text)}</div>
      ${c.replies.map(r => `<div class="ccard-reply"><span class="avatar sm" style="background:${r.color}">${r.initials}</span><div><b>${esc(r.author)}</b> <small>${timeAgo(r.ts)}</small><div>${esc(r.text)}</div></div></div>`).join('')}
      <div class="ccard-foot">
        <select class="assign-sel" data-act="assign" title="Assign to">
          ${assignOptions.map(a => `<option ${((c.assignee || '—') === a) ? 'selected' : ''}>${esc(a)}</option>`).join('')}
        </select>
        ${c.assignee ? `<span class="assign-chip">${icon('users', 11)} ${esc(c.assignee)}</span>` : ''}
      </div>
      <input class="reply-input" data-act="reply" placeholder="Reply…">
    </div>`;
  });
  if (App.pendingComment) {
    html += `<div class="ccard composer" data-composer="1">
      <div class="ccard-head"><span class="avatar" style="background:${ME.color}">${ME.initials}</span><span class="ccard-who"><b>New comment</b></span></div>
      ${App.pendingComment.quote ? `<div class="ccard-quote">“${esc(App.pendingComment.quote)}”</div>` : ''}
      <textarea id="composerText" rows="2" placeholder="Type a comment…"></textarea>
      <div class="ccard-foot">
        <select id="composerAssign" class="assign-sel" title="Assign to">${assignOptions.map(a => `<option>${esc(a)}</option>`).join('')}</select>
        <button class="btn tiny" data-act="cancelC">Cancel</button>
        <button class="btn tiny primary" data-act="postC">Post</button>
      </div>
    </div>`;
  }
  html += `</div>
  <label class="rail-showresolved"><input type="checkbox" id="showResolvedCb" ${showResolved ? 'checked' : ''}> Show resolved (${comments.filter(c => c.resolved).length})</label>`;
  host.innerHTML = html;

  /* bind */
  host.querySelectorAll('.ccard[data-cid]').forEach(card => {
    const id = card.dataset.cid;
    card.addEventListener('mousedown', (e) => {
      if (e.target.closest('[data-act],select,input')) return;
      App.activeComment = id;
      const c = App.doc.comments.find(x => x.id === id);
      if (c) scrollToAnchor(c.blockId, id);
      host.querySelectorAll('.ccard').forEach(x => x.classList.toggle('active', x === card));
      positionCommentCards();
    });
    card.querySelector('[data-act="resolve"]').addEventListener('click', () => resolveComment(id));
    card.querySelector('[data-act="del"]').addEventListener('click', () => deleteComment(id));
    card.querySelector('[data-act="assign"]').addEventListener('change', (e) => assignComment(id, e.target.value));
    card.querySelector('[data-act="reply"]').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { replyToComment(id, e.target.value); }
    });
  });
  const composer = host.querySelector('[data-composer]');
  if (composer) {
    composer.querySelector('[data-act="postC"]').addEventListener('click', postPendingComment);
    composer.querySelector('[data-act="cancelC"]').addEventListener('click', cancelPendingComment);
    composer.querySelector('#composerText').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postPendingComment();
    });
  }
  const cb = host.querySelector('#showResolvedCb');
  if (cb) cb.addEventListener('change', () => { App.showResolved = cb.checked; renderRail(); });

  positionCommentCards();
}

/* Word/Google-Docs-style alignment: each card tracks its text anchor as the
   document scrolls. Cards that would overlap are nudged apart; cards whose
   anchors have scrolled off the top leave the rail (negative top + overflow
   hidden) instead of piling up at y=0. */
function positionCommentCards() {
  const layer = $('#commentLayer');
  if (!layer) return;
  const cards = [...layer.querySelectorAll('.ccard')];
  if (!cards.length) return;

  const GAP = 8;
  const items = cards.map(card => {
    const cid = card.dataset.cid || (App.pendingComment && App.pendingComment.cid);
    const c = card.dataset.cid ? App.doc.comments.find(x => x.id === card.dataset.cid) : App.pendingComment;
    return {
      card,
      ideal: c ? anchorYFor(c.blockId, cid) : 14,
      h: card.offsetHeight || 0,
    };
  }).sort((a, b) => a.ideal - b.ideal);

  // Forward pass — push down to avoid overlap. Start at -Infinity so a card
  // whose anchor is above the viewport can keep a negative top and scroll
  // off with the document (the old `prevBottom = 6` pinned every past card
  // into a stack at the top of the rail).
  let prevBottom = -Infinity;
  items.forEach(it => {
    it.top = Math.max(it.ideal, prevBottom + GAP);
    prevBottom = it.top + it.h;
  });

  // Backward pass — pull cards back up toward their anchors when a later
  // card left slack, so a dense cluster doesn't drift permanently downward.
  let nextTop = Infinity;
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    it.top = Math.min(it.top, nextTop - it.h - GAP);
    nextTop = it.top;
  }

  items.forEach(it => { it.card.style.top = it.top + 'px'; });
}

function scrollToAnchor(blockId, cid) {
  const sc = $('#canvasScroll');
  let el = cid ? $(`#canvas .cmk[data-cid="${cid}"]`) : null;
  if (!el) el = $(`#canvas .blockwrap[data-bid="${blockId}"]`);
  if (!el || !sc) return;
  const d = el.getBoundingClientRect().top - sc.getBoundingClientRect().top;
  if (d < 80 || d > sc.clientHeight - 160) { if (typeof noteProgScroll === 'function') noteProgScroll(); sc.scrollBy({ top: d - 140, behavior: 'smooth' }); }
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 1200);
}

function renderSuggestionRail(host) {
  const suggs = collectSuggestions();
  let html = `<div class="rail-list">`;
  html += `<div class="sugg-banner ${App.mode === 'suggesting' ? 'on' : ''}">
    <b>${App.mode === 'suggesting' ? 'Suggesting mode is on.' : 'Suggesting mode is off.'}</b>
    Edits made while suggesting appear here for review — accept or reject each one.
  </div>`;
  if (suggs.length > 1) {
    html += `<div class="sugg-bulk"><button class="btn tiny" data-act="acceptAll">Accept all</button><button class="btn tiny" data-act="rejectAll">Reject all</button></div>`;
  }
  if (!suggs.length) html += `<div class="rail-empty">No open suggestions. Switch the mode picker to <b>Suggesting</b> and start typing — insertions and deletions become reviewable suggestions.</div>`;
  suggs.forEach(s => {
    html += `<div class="scard" data-sid="${s.sid}">
      <div class="scard-head">
        <span class="kind-badge ${s.kind}">${s.kind === 'ins' ? 'Insertion' : 'Deletion'}</span>
        <small>${esc(s.author)} · ${timeAgo(s.ts)}</small>
      </div>
      <div class="scard-text">${s.kind === 'ins' ? '' : '<s>'}${esc(s.text.slice(0, 160) || '(formatting)')}${s.kind === 'ins' ? '' : '</s>'}</div>
      <div class="scard-actions">
        <button class="btn tiny ok" data-act="accept">${icon('check', 12, 2.6)} Accept</button>
        <button class="btn tiny" data-act="reject">${icon('x', 12)} Reject</button>
      </div>
    </div>`;
  });
  html += `</div>`;
  host.innerHTML = html;

  host.querySelectorAll('.scard').forEach(card => {
    const sid = card.dataset.sid;
    card.addEventListener('mousedown', (e) => {
      if (e.target.closest('[data-act]')) return;
      const el = $(`#canvas [data-sid="${sid}"]`);
      if (el) {
        const wrap = el.closest('.blockwrap');
        scrollToAnchor(wrap && wrap.dataset.bid, null);
        el.classList.add('flash');
        setTimeout(() => el.classList.remove('flash'), 1200);
      }
    });
    card.querySelector('[data-act="accept"]').addEventListener('click', () => resolveSuggestion(sid, true));
    card.querySelector('[data-act="reject"]').addEventListener('click', () => resolveSuggestion(sid, false));
  });
  const aa = host.querySelector('[data-act="acceptAll"]');
  if (aa) aa.addEventListener('click', () => resolveAllSuggestions(true));
  const ra = host.querySelector('[data-act="rejectAll"]');
  if (ra) ra.addEventListener('click', () => resolveAllSuggestions(false));
}
