/* ============ Fog Signal Proposals — app shell, home, editor chrome ============ */
'use strict';

/* =================== HOME =================== */
/* A small status pill (Draft / Submitted / Won / Lost / Archived) — the friendly
   surface over the proposal's triageState, shared with the CLEATUS pipeline. */
function statusPillHtml(triage) {
  const t = tagForTriage(triage);
  return `<span class="status-pill sp-${t.tone}" title="${esc(t.desc)}">${esc(t.label)}</span>`;
}

function renderHome() {
  App.view = 'home';
  App.doc = null;
  let list = Store.index();
  const deduped = dedupeIndexById(list);
  if (deduped.length !== list.length) {
    Store.writeIndex(deduped);
    list = deduped;
  }

  // Count each filter across every proposal, then narrow to the active chip.
  if (!STATUS_FILTERS.some(f => f.key === App.homeFilter)) App.homeFilter = 'active';
  const counts = {};
  STATUS_FILTERS.forEach(f => { counts[f.key] = 0; });
  list.forEach(m => {
    const tag = tagForTriage(m.triageState || 'building');
    STATUS_FILTERS.forEach(f => { if (f.match(tag)) counts[f.key] += 1; });
  });
  const activeFilter = STATUS_FILTERS.find(f => f.key === App.homeFilter);
  const shown = list.filter(m => activeFilter.match(tagForTriage(m.triageState || 'building')));

  const cardHtml = (m) => {
    const days = daysUntil(m.deadline);
    const tag = tagForTriage(m.triageState || 'building');
    return `<div class="prop-card ${tag.key === 'archived' ? 'is-archived' : ''}" data-id="${m.id}">
      <div class="prop-card-top">
        <span class="prop-card-chips">
          <span class="client-badge ct-${m.clientType}">${esc((CLIENTS[m.clientType] || {}).label || m.clientType)}</span>
          ${statusPillHtml(m.triageState)}
          ${m.source === 'cleatus' ? `<span class="cleatus-chip" title="Linked to a CLEATUS pursuit — its status follows the CLEATUS pipeline">${icon('bolt', 10)} Cleatus</span>` : ''}
        </span>
        <button class="iconbtn prop-menu" title="Status &amp; actions">${icon('dots', 16)}</button>
      </div>
      <div class="prop-card-title">${esc(m.title)}</div>
      <div class="prop-card-agency">${esc(m.agency || '—')}${m.rfpNumber ? ' · ' + esc(m.rfpNumber) : ''}</div>
      ${m.needsRfp ? `<button class="btn tiny primary prop-rfp-cta" title="Upload the RFP document — Claude drafts the sections and pulls out the submission checklist">${icon('doc', 12)} Upload RFP &amp; start drafting</button>` : ''}
      <div class="prop-card-foot">
        <span>Edited ${timeAgo(m.updatedAt)}</span>
        ${days != null && !tag.terminal ? `<span class="deadline ${days < 7 ? 'hot' : ''}">${days >= 0 ? days + ' days to submit' : 'past deadline'}</span>` : ''}
      </div>
    </div>`;
  };

  let body;
  if (!list.length) {
    body = `<div class="home-empty">
      <div class="home-empty-icn">${icon('doc', 40, 1.4)}</div>
      <h3>No proposals yet</h3>
      <p>Start a new proposal and the block library will curate pre-written content for that client type.</p>
    </div>`;
  } else if (!shown.length) {
    body = `<div class="home-empty">
      <div class="home-empty-icn">${icon('doc', 40, 1.4)}</div>
      <h3>No ${esc(activeFilter.label.toLowerCase())} proposals</h3>
      <p>Nothing here yet — pick a different status filter above.</p>
    </div>`;
  } else {
    body = `<div class="prop-grid">${shown.map(cardHtml).join('')}</div>`;
  }

  $('#app').innerHTML = `
  <div class="home">
    <div class="home-top">
      <img src="assets/logo-horizontal-blue.png" class="home-logo" alt="Fog Signal Strategies">
      <div class="home-top-right">
        ${Settings.isAdmin() ? `<button class="btn ghost" id="adminBtn" title="Workspace settings — templates, colors, fonts, blocks, pricing">${icon('gear', 14)} Workspace Settings</button>` : ''}
      </div>
    </div>
    <div class="home-head">
      <div>
        <h1 class="home-title">Proposals</h1>
        <p class="home-sub">End-to-end workspace for formal RFP responses — draft, collaborate, price, and export.</p>
      </div>
      <button class="btn primary lg" id="newProposal">${icon('plus', 16)} New Proposal</button>
    </div>
    ${list.length ? `<div class="home-filters">
      ${STATUS_FILTERS.map(f => `<button class="ct-chip lg ${App.homeFilter === f.key ? 'on' : ''}" data-filter="${f.key}">${esc(f.label)}<span class="chip-count">${counts[f.key]}</span></button>`).join('')}
    </div>` : ''}
    ${body}
  </div>`;

  $('#newProposal').addEventListener('click', newProposalWizard);
  const adminBtn = $('#adminBtn');
  if (adminBtn) adminBtn.addEventListener('click', () => { location.hash = 'admin'; });

  $$('.home-filters .ct-chip').forEach(chip => chip.addEventListener('click', () => {
    App.homeFilter = chip.dataset.filter;
    renderHome();
  }));

  $$('.prop-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.prop-menu')) return;
      if (e.target.closest('.prop-rfp-cta')) return;
      openEditor(card.dataset.id);
    });
    const rfpCta = card.querySelector('.prop-rfp-cta');
    if (rfpCta) rfpCta.addEventListener('click', () => uploadRfpIntoProposal(card.dataset.id));
    card.querySelector('.prop-menu').addEventListener('click', (e) => {
      e.stopPropagation();
      const m = list.find(x => x.id === card.dataset.id);
      openProposalMenu(e.currentTarget, m);
    });
  });
}

/* Per-card actions: set the status tag, open the CLEATUS pursuit, delete. Shared
   status-setting logic with the editor lives in setProposalStatus(). */
function openProposalMenu(anchor, m) {
  const current = tagForTriage(m.triageState || 'building');
  const rows = STATUS_TAGS.map(t => `
    <div class="menu-row ${t.key === current.key ? 'on' : ''}" data-tag="${t.key}">
      <span class="status-dot sp-${t.tone}"></span>
      <div><b>${esc(t.label)}</b><small>${esc(t.desc)}</small></div>
      ${t.key === current.key ? `<span class="check">${icon('check', 13, 3)}</span>` : ''}
    </div>`).join('');
  const card = popover(anchor, `
    <div class="menu-kicker">Set status</div>
    ${rows}
    <div class="menu-sep"></div>
    ${m.cleatusUrl ? `<div class="menu-row" data-act="cleatus"><span class="status-dot sp-submitted"></span><div><b>View in CLEATUS</b><small>Open the linked pursuit</small></div></div>` : ''}
    <div class="menu-row danger" data-act="delete"><span class="menu-ic">${icon('trash', 14)}</span><div><b>Delete proposal</b><small>Removes it and its history</small></div></div>`,
    { width: 288, align: 'right', maxHeight: '78vh' });

  card.querySelectorAll('[data-tag]').forEach(row => row.addEventListener('click', () => {
    const tag = row.dataset.tag;
    closePopovers();
    if (triageForTag(tag) === (m.triageState || 'building')) return;
    setProposalStatus(m.id, tag, { onDone: renderHome });
  }));
  const cle = card.querySelector('[data-act="cleatus"]');
  if (cle) cle.addEventListener('click', () => { closePopovers(); window.open(m.cleatusUrl, '_blank'); });
  card.querySelector('[data-act="delete"]').addEventListener('click', () => {
    closePopovers();
    confirmDeleteProposal(m);
  });
}

/* Apply a status tag to a proposal, with a friendly toast and CLEATUS caveat. */
function setProposalStatus(id, tag, { onDone } = {}) {
  const triage = triageForTag(tag);
  if (!triage) return;
  const label = (STATUS_BY_KEY[tag] || {}).label || tag;
  Promise.resolve(setProposalTriage(id, triage)).then(() => {
    toast(`Marked ${label}`);
    if (onDone) onDone();
  }).catch((e) => {
    toast(e.message || 'Could not update status');
    if (onDone) onDone();
  });
}

function confirmDeleteProposal(m) {
  const c = modal(`
    <div class="pophead"><b>Delete “${esc(m.title)}”?</b></div>
    <div class="popbody"><p class="set-hint" style="font-size:13px">This permanently removes the proposal, its comments, and its version history. To keep it out of the way without deleting, use <b>Archive</b> instead.</p>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn" id="delNo">Cancel</button><button class="btn danger" id="delYes">Delete</button></div></div>`, { width: 420 });
  c.querySelector('#delNo').onclick = closePopovers;
  c.querySelector('#delYes').onclick = () => { Store.remove(m.id); closePopovers(); renderHome(); toast('Proposal deleted'); };
}

/* Editor topbar status menu — set the open proposal's tag, with a CLEATUS note
   and deep-link when the proposal is linked to a pursuit. */
function openStatusMenu(anchor) {
  const d = App.doc;
  if (!d) return;
  const current = tagForTriage(d.triageState);
  const cleatusUrl = (d.cleatus && d.cleatus.rfpUrl) || (d.rfp && d.rfp.cleatusUrl) || null;
  const rows = STATUS_TAGS.map(t => `
    <div class="menu-row ${t.key === current.key ? 'on' : ''}" data-tag="${t.key}">
      <span class="status-dot sp-${t.tone}"></span>
      <div><b>${esc(t.label)}</b><small>${esc(t.desc)}</small></div>
      ${t.key === current.key ? `<span class="check">${icon('check', 13, 3)}</span>` : ''}
    </div>`).join('');
  const card = popover(anchor, `
    <div class="menu-kicker">Proposal status</div>
    ${rows}
    ${d.source === 'cleatus' ? `<div class="menu-sep"></div>
      <div class="menu-note">${icon('bolt', 11)} Linked to a CLEATUS pursuit — a later CLEATUS sync can move this status to match the pipeline.</div>
      ${cleatusUrl ? `<div class="menu-row" data-act="cleatus"><span class="status-dot sp-submitted"></span><div><b>View in CLEATUS</b><small>Open the linked pursuit</small></div></div>` : ''}` : ''}`,
    { width: 300, maxHeight: '78vh' });

  card.querySelectorAll('[data-tag]').forEach(row => row.addEventListener('click', () => {
    const tag = row.dataset.tag;
    closePopovers();
    if (triageForTag(tag) === d.triageState) return;
    setProposalStatus(d.id, tag, { onDone: refreshStatusBadge });
  }));
  const cle = card.querySelector('[data-act="cleatus"]');
  if (cle) cle.addEventListener('click', () => { closePopovers(); if (cleatusUrl) window.open(cleatusUrl, '_blank'); });
}

/* Repaint the topbar status pill after a change without a full re-render. */
function refreshStatusBadge() {
  const btn = $('#statusBtn');
  if (!btn || !App.doc) return;
  const t = tagForTriage(App.doc.triageState);
  btn.className = `status-pill sp-${t.tone} status-btn`;
  btn.innerHTML = `${esc(t.label)} <span class="caret">▾</span>`;
}

function newProposalWizard() {
  const defaultCover = Settings.coverFields();
  const coverTpls = Settings.coverTemplates();
  const card = modal(`
    <div class="pophead">${icon('plus', 16)}<b>New Proposal</b><button class="iconbtn close-pop">${icon('x', 15)}</button></div>
    <div class="popbody wizard">
      <div class="set-label">Client / agency name</div>
      <input class="set-input" id="wAgency" placeholder="e.g. Beaufort County, South Carolina">
      <div class="set-label">Client type <span class="muted">— curates the block library &amp; pre-written content</span></div>
      <div class="ct-grid">
        ${CLIENT_KEYS.map((k, i) => `<button class="ct-card ${i === 0 ? '' : ''}" data-ct="${k}">
          <b>${CLIENTS[k].label}</b><small>${CLIENTS[k].ex}</small></button>`).join('')}
      </div>
      <div class="wizard-2col">
        <div><div class="set-label">RFP number <span class="muted">(optional)</span></div>
        <input class="set-input" id="wRfp" placeholder="RFP #051326"></div>
        <div><div class="set-label">Submission deadline</div>
        <input class="set-input" id="wDeadline" type="date"></div>
      </div>
      <div class="set-label">Services title <span class="muted">— appears on the cover</span></div>
      <input class="set-input" id="wService" value="Public Education & Community Outreach Services">
      <div class="set-label">Start from</div>
      <div class="tpl-row">
        ${Settings.allTemplates().map((t, i) => `<button class="tpl-card ${i === 0 ? 'on' : ''}" data-tpl="${esc(t.key)}"><b>${esc(t.label)}</b><small>${esc(t.desc)}</small></button>`).join('')}
      </div>
      <div class="set-label">Cover <span class="muted">— used for Create and Claude drafts; change the workspace default in Admin → Cover Templates</span></div>
      <div class="tpl-row" id="wCoverRow" style="grid-template-columns:1fr 1fr 1fr">
        <button class="tpl-card ${defaultCover.layout === 'letterhead' && !defaultCover.templateId ? 'on' : ''}" data-cover="letterhead"><b>Letterhead</b><small>Navy sidebar, gold stripe &amp; lockup</small></button>
        <button class="tpl-card ${defaultCover.layout === 'standard' && !defaultCover.templateId ? 'on' : ''}" data-cover="standard"><b>Standard</b><small>Centered firm lockup on white</small></button>
        <button class="tpl-card ${defaultCover.layout === 'custom' && !defaultCover.templateId ? 'on' : ''}" data-cover="custom"><b>Custom art</b><small>Uploaded full-page cover</small></button>
      </div>
      ${coverTpls.length ? `<div class="ct-chips" id="wCoverTplRow" style="margin-top:8px;flex-wrap:wrap">
        ${coverTpls.map(t => `<button class="ct-chip ${defaultCover.templateId === t.id ? 'on' : ''}" data-covertpl="${t.id}">${esc(t.name)}</button>`).join('')}
      </div>` : ''}
      <button class="btn primary wide lg" id="wCreate">Create proposal</button>
      <div class="ai-wiz-or" id="wDraftWrap">
        <div class="ai-wiz-rule"><span>or</span></div>
        <button class="btn wide" id="wDraftAI">${icon('bolt', 14)} Draft from an RFP with Claude</button>
        <p class="set-hint" style="margin-top:6px">Upload the RFP (PDF, Word, or text). Claude drafts the narrative sections from your firm context and extracts the submission checklist. Pick a client type and agency above first.</p>
      </div>
    </div>`, { width: 620, sticky: true });

  let ct = null, tpl = 'full';
  let coverPref = { ...defaultCover };
  card.querySelector('.close-pop').onclick = closePopovers;
  card.querySelectorAll('.ct-card').forEach(b => b.addEventListener('click', () => {
    ct = b.dataset.ct;
    card.querySelectorAll('.ct-card').forEach(x => x.classList.toggle('on', x === b));
  }));
  card.querySelectorAll('.tpl-card[data-tpl]').forEach(b => b.addEventListener('click', () => {
    tpl = b.dataset.tpl;
    card.querySelectorAll('.tpl-card[data-tpl]').forEach(x => x.classList.toggle('on', x === b));
  }));
  const syncCoverUi = () => {
    card.querySelectorAll('.tpl-card[data-cover]').forEach(x =>
      x.classList.toggle('on', x.dataset.cover === coverPref.layout && !coverPref.templateId));
    card.querySelectorAll('[data-covertpl]').forEach(x =>
      x.classList.toggle('on', x.dataset.covertpl === coverPref.templateId));
  };
  card.querySelectorAll('.tpl-card[data-cover]').forEach(b => b.addEventListener('click', () => {
    coverPref = Settings.coverFields({ layout: b.dataset.cover });
    syncCoverUi();
  }));
  card.querySelectorAll('[data-covertpl]').forEach(b => b.addEventListener('click', () => {
    coverPref = Settings.coverFields({ templateId: b.dataset.covertpl });
    syncCoverUi();
  }));
  const agencyInput = card.querySelector('#wAgency');
  if (window.KeelBridge?.ready) KeelBridge.bindAgencyInput(agencyInput);
  if (window.KEEL_CLIENT_ID && window.KEEL_CLIENT_ID !== 'all') {
    const preset = (window.KEEL_CLIENTS || []).find((c) => c.id === window.KEEL_CLIENT_ID);
    if (preset && !agencyInput.value) agencyInput.value = preset.name;
  }

  card.querySelector('#wCreate').addEventListener('click', () => {
    const agency = agencyInput.value.trim();
    if (!ct) { toast('Pick a client type — it curates the content library'); return; }
    const keelCtx = window.KeelBridge?.ready
      ? KeelBridge.resolveClientForWizard(agencyInput, ct)
      : { clientId: null, clientType: ct };
    if (window.__KEEL_EMBED__ && !keelCtx.clientId) {
      toast('Select a Keel client from the switcher or pick a matching agency name');
      return;
    }
    const doc = Store.create({
      title: (agency ? agency.split(',')[0] : 'Untitled') + ' — ' + (CLIENTS[keelCtx.clientType || ct].ex.split('&')[0].trim()) + ' Proposal',
      agency, clientType: keelCtx.clientType || ct,
      keelClientId: keelCtx.clientId,
      rfpNumber: card.querySelector('#wRfp').value.trim(),
      deadline: card.querySelector('#wDeadline').value,
      serviceTitle: card.querySelector('#wService').value.trim() || 'Public Education & Community Outreach Services',
      template: tpl,
      cover: coverPref,
    });
    closePopovers();
    openEditor(doc.id);
    toast(`Library curated for ${CLIENTS[ct].label} clients`);
  });

  /* ---- Draft from RFP with Claude ---- */
  const draftBtn = card.querySelector('#wDraftAI');
  const draftWrap = card.querySelector('#wDraftWrap');
  if (draftBtn && window.AI && AI.available === false && draftWrap) draftWrap.style.display = 'none';
  if (draftBtn) draftBtn.addEventListener('click', async () => {
    if (!ct) { toast('Pick a client type first — it curates the template'); return; }
    const keelCtx = window.KeelBridge?.ready
      ? KeelBridge.resolveClientForWizard(agencyInput, ct)
      : { clientId: null, clientType: ct };
    if (window.__KEEL_EMBED__ && !keelCtx.clientId) {
      toast('Select a Keel client from the switcher or pick a matching agency name');
      return;
    }
    const f = await pickFile('.pdf,.docx,.txt,.md,application/pdf');
    if (!f) return;
    const prog = importProgress('Claude is drafting your proposal');
    try {
      prog.set('Reading the RFP…', 0.15);
      const payload = {
        clientId: keelCtx.clientId,
        clientType: keelCtx.clientType || ct,
        fileName: f.name,
        cover: coverPref,
      };
      const name = f.name.toLowerCase();
      if (name.endsWith('.pdf')) {
        payload.pdfBase64 = await fileToBase64(f);
        payload.mediaType = 'application/pdf';
      } else {
        payload.rfpText = await extractFileText(f);
      }
      prog.set('Drafting sections & extracting requirements… this can take a minute.', 0.55);
      const r = await AI.draft(payload);
      prog.done();
      openEditor(r.id);
      toast('Draft created from the RFP — review and refine');
    } catch (e) {
      prog.done();
      toast(e.message || 'Could not draft from that RFP');
    }
  });
}

/* "Upload RFP & start drafting" on a Cleatus-created card: pick the RFP file,
   have Claude draft sections + extract the checklist INTO the existing
   proposal (its client, triage state, and Cleatus links are preserved). */
async function uploadRfpIntoProposal(id) {
  if (window.AI && AI.available === false) {
    openEditor(id);
    toast('AI drafting isn’t configured — opening the template. You can insert the RFP from the Pages panel.');
    return;
  }
  const coverPref = await pickCoverForDraft();
  if (coverPref === null) return; // cancelled
  const f = await pickFile('.pdf,.docx,.txt,.md,application/pdf');
  if (!f) return;
  const prog = importProgress('Claude is drafting from your RFP');
  try {
    prog.set('Reading the RFP…', 0.15);
    const payload = { proposalId: id, fileName: f.name, cover: coverPref };
    const name = f.name.toLowerCase();
    if (name.endsWith('.pdf')) {
      payload.pdfBase64 = await fileToBase64(f);
      payload.mediaType = 'application/pdf';
    } else {
      payload.rfpText = await extractFileText(f);
    }
    prog.set('Drafting sections & extracting requirements… this can take a minute.', 0.55);
    const r = await AI.draft(payload);
    prog.done();
    openEditor(r.id);
    toast('Draft created from the RFP — review and refine');
  } catch (e) {
    prog.done();
    toast(e.message || 'Could not draft from that RFP');
  }
}

/* Small cover picker shown before Claude drafts into an existing proposal.
   Resolves with cover fields, or null if the user cancels. */
function pickCoverForDraft() {
  return new Promise((resolve) => {
    const defaultCover = Settings.coverFields();
    const coverTpls = Settings.coverTemplates();
    const card = modal(`
      <div class="pophead">${icon('bolt', 16)}<b>Cover for this draft</b><button class="iconbtn close-pop">${icon('x', 15)}</button></div>
      <div class="popbody">
        <p class="set-hint" style="margin-top:0">Claude will use this cover when it builds the proposal. Change the workspace default anytime in Admin → Cover Templates.</p>
        <div class="tpl-row" style="grid-template-columns:1fr 1fr 1fr">
          <button class="tpl-card ${defaultCover.layout === 'letterhead' && !defaultCover.templateId ? 'on' : ''}" data-cover="letterhead"><b>Letterhead</b><small>Navy sidebar &amp; lockup</small></button>
          <button class="tpl-card ${defaultCover.layout === 'standard' && !defaultCover.templateId ? 'on' : ''}" data-cover="standard"><b>Standard</b><small>Centered firm lockup</small></button>
          <button class="tpl-card ${defaultCover.layout === 'custom' && !defaultCover.templateId ? 'on' : ''}" data-cover="custom"><b>Custom art</b><small>Uploaded full-page cover</small></button>
        </div>
        ${coverTpls.length ? `<div class="ct-chips" style="margin-top:8px;flex-wrap:wrap">
          ${coverTpls.map(t => `<button class="ct-chip ${defaultCover.templateId === t.id ? 'on' : ''}" data-covertpl="${t.id}">${esc(t.name)}</button>`).join('')}
        </div>` : ''}
        <button class="btn primary wide lg" id="wCoverGo" style="margin-top:14px">Continue — pick RFP</button>
      </div>`, { width: 480, sticky: true });
    let coverPref = { ...defaultCover };
    let settled = false;
    const done = (v) => { if (settled) return; settled = true; closePopovers(); resolve(v); };
    card.querySelector('.close-pop').onclick = () => done(null);
    const sync = () => {
      card.querySelectorAll('.tpl-card[data-cover]').forEach(x =>
        x.classList.toggle('on', x.dataset.cover === coverPref.layout && !coverPref.templateId));
      card.querySelectorAll('[data-covertpl]').forEach(x =>
        x.classList.toggle('on', x.dataset.covertpl === coverPref.templateId));
    };
    card.querySelectorAll('.tpl-card[data-cover]').forEach(b => b.addEventListener('click', () => {
      coverPref = Settings.coverFields({ layout: b.dataset.cover });
      sync();
    }));
    card.querySelectorAll('[data-covertpl]').forEach(b => b.addEventListener('click', () => {
      coverPref = Settings.coverFields({ templateId: b.dataset.covertpl });
      sync();
    }));
    card.querySelector('#wCoverGo').onclick = () => done(coverPref);
  });
}

/* Read a file as base64 (no data: prefix) for the AI draft upload. */
function fileToBase64(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(',')[1] || '');
    fr.onerror = () => rej(new Error('Could not read the file'));
    fr.readAsDataURL(file);
  });
}

/* =================== EDITOR =================== */
/* Older custom covers had a built-in text box; floating text boxes replaced
   it — carry any existing box content over so nothing is lost. */
function migrateCoverBoxes(doc) {
  (doc.blocks || []).forEach(b => {
    if (b.type !== 'cover' || b.layout !== 'custom' || b.boxMigrated) return;
    b.boxMigrated = true;
    const html = (doc.content || {})[b.id + '.box'];
    delete doc.content[b.id + '.box'];
    if (!html || !html.replace(/<[^>]+>/g, '').trim()) return;
    const dims = PAGE_SIZES[doc.pageSize] || PAGE_SIZES.letter;
    const inset = 56, w = 300;
    const pos = b.boxPos || 'br';
    const x = pos.includes('l') ? inset : pos.includes('r') ? dims.w - w - inset : (dims.w - w) / 2;
    const y = pos[0] === 't' ? inset : dims.h - inset - 190;
    (doc.floats = doc.floats || []).push({ id: uid('fl'), type: 'text', page: 1, x: Math.round(x), y: Math.round(y), w, html });
    toast('Cover text converted to a floating text box — drag it anywhere');
  });
}

async function openEditor(id) {
  const doc = await Sync.openDoc(id);
  if (!doc) { toast('Could not open that proposal'); location.hash = ''; renderHome(); return; }
  Store.normalize(doc);
  migrateCoverBoxes(doc);
  cleanOrphanCommentMarks(doc);
  App.doc = doc;
  App.view = 'editor';
  App.selectedBlock = null;
  App.pendingComment = null;
  // The comments/suggestions rail earns its space: start open only when the
  // document has an open thread or pending tracked changes. (Suggestions live
  // in the stored content as <ins/del data-sid> — checkable before render.)
  App.showRail = doc.comments.some(c => !c.resolved)
    || Object.values(doc.content || {}).some(h => typeof h === 'string' && h.includes('data-sid'));
  location.hash = 'doc/' + id;
  History.init(doc);
  Sync.connect(id);   // join the live room before rendering — a render error must not cost us presence/sync
  renderEditor();
}

function renderEditor() {
  const d = App.doc;
  $('#app').innerHTML = `
  <div class="editor">
    <!-- ===== top bar ===== -->
    <div class="topbar">
      <button class="btn ghost back" id="backHome" title="Back to proposal workspace">${icon('back', 15)} Workspace</button>
      <img src="assets/logo-horizontal-blue.png" class="topbar-logo" alt="FSS">
      <div class="vr"></div>
      <div class="title-wrap">
        <div class="doc-title" id="docTitle" contenteditable="true" spellcheck="false">${esc(d.title)}</div>
        <div class="title-meta">
          <span class="save-badge is-saved" id="saveBadge"><span class="dot"></span>All changes saved</span>
          <span class="sep">·</span>
          <span class="client-badge ct-${d.clientType}">${esc((CLIENTS[d.clientType] || {}).label || '')}</span>
          <span class="sep">·</span>
          <button class="status-pill sp-${tagForTriage(d.triageState).tone} status-btn" id="statusBtn" title="Set the proposal's status — Draft, Submitted, Won, Lost, or Archived">${esc(tagForTriage(d.triageState).label)} <span class="caret">▾</span></button>
          ${d.rfpNumber ? `<span class="sep">·</span><span class="muted">${esc(d.rfpNumber)}</span>` : ''}
        </div>
      </div>
      <div class="flex1"></div>
      <div class="presence" id="presenceWrap"></div>
      <button class="btn mode-btn mode-edit" id="modeBtn"><span class="dot"></span>Editing <span class="caret">▾</span></button>
      <button class="btn ghost" id="rfpBtn" title="RFP details & submission checklist">${icon('rfp', 15)} <span id="rfpBadge"></span></button>
      <button class="btn ghost sq" id="historyBtn" title="Version history">${icon('clock', 15)}</button>
      <button class="btn ghost" id="railToggle" title="Comments & suggestions">${icon('comment', 15)} <span id="commentCount">0</span></button>
      <button class="btn ghost" id="proofreadBtn" title="Proofread with Claude — flags issues as tracked changes">${icon('bolt', 15)} Proofread</button>
      <button class="btn ghost" id="shareBtn" title="Share">${icon('users', 15)} Share</button>
      <button class="btn ghost" id="saveBtn" title="Save now">${icon('check', 15)} Save</button>
      <button class="btn primary" id="exportBtn">Export <span class="caret">▾</span></button>
    </div>

    <!-- ===== proofing progress bar ===== -->
    <div class="proof-bar" id="proofBar" hidden></div>

    <!-- ===== toolbar ===== -->
    <div class="toolbar">
      <button class="tbtn" data-fmt="undo" title="Undo (⌘Z)">${icon('undo', 15)}</button>
      <button class="tbtn" data-fmt="redo" title="Redo (⌘⇧Z)">${icon('redo', 15)}</button>
      <div class="vr"></div>
      <div class="fontsize-ctl" title="Font size for the selected text">
        <button id="fontSizeDown" tabindex="-1">−</button>
        <input type="number" id="fontSizeInput" value="12" min="7" max="96">
        <button id="fontSizeUp" tabindex="-1">+</button>
      </div>
      <select class="style-sel font-sel" id="fontSel" title="Font for the selected text">
        <option value="">Font</option>
        ${Settings.fontOptionsHTML()}
      </select>
      <div class="vr"></div>
      <button class="tbtn" data-fmt="bold" title="Bold (⌘B)"><b class="serif">B</b></button>
      <button class="tbtn" data-fmt="italic" title="Italic (⌘I)"><i class="serif">I</i></button>
      <button class="tbtn" data-fmt="underline" title="Underline (⌘U)"><u>U</u></button>
      <button class="tbtn" data-fmt="strikeThrough" title="Strikethrough"><s>S</s></button>
      <button class="tbtn colorbtn" id="foreColorBtn" title="Text color"><span class="color-a">A</span><span class="color-bar" id="foreColorBar" style="background:#1A3A5C"></span></button>
      <button class="tbtn colorbtn" id="hiliteColorBtn" title="Highlight color"><span class="color-a hl-ico">${icon('highlighter', 13)}</span><span class="color-bar" id="hiliteColorBar" style="background:#FBECBF"></span></button>
      <div class="vr"></div>
      <button class="tbtn" data-fmt="insertUnorderedList" title="Bulleted list">${icon('listUl', 15)}</button>
      <button class="tbtn" data-fmt="insertOrderedList" title="Numbered list">${icon('listOl', 15)}</button>
      <button class="tbtn" data-fmt="outdent" title="Decrease indent (⇧Tab in a list)">${icon('outdent', 15)}</button>
      <button class="tbtn" data-fmt="indent" title="Increase indent — makes sub-bullets (Tab in a list)">${icon('indent', 15)}</button>
      <button class="tbtn" id="listOptsBtn" title="List & spacing options — bullet style, gaps, indent width">${icon('listopts', 15)}</button>
      <button class="tbtn" data-fmt="justifyLeft" title="Align left">${icon('alignL', 15)}</button>
      <button class="tbtn" data-fmt="justifyCenter" title="Align center">${icon('alignC', 15)}</button>
      <button class="tbtn" data-fmt="justifyRight" title="Align right">${icon('alignR', 15)}</button>
      <div class="vr"></div>
      <button class="tbtn" data-fmt="createLink" title="Insert link">${icon('link', 15)}</button>
      <button class="tbtn" id="insertImageBtn" title="Insert image block">${icon('image', 15)}</button>
      <button class="tbtn" id="insertTextboxBtn" title="Insert floating text box (drag anywhere)">${icon('textbox', 15)}</button>
      <button class="tbtn" id="stampSigBtn" title="Stamp a signature or floating image">${icon('stamp', 15)}</button>
      <button class="tbtn" data-fmt="removeFormat" title="Clear formatting">${icon('eraser', 15)}</button>
      <div class="vr"></div>
      <button class="tbtn wide-btn" id="commentToolBtn" title="Comment on selection (⌘⌥M)">${icon('comment', 15)} Comment</button>
      <button class="tbtn wide-btn" id="toolsBtn" title="Find & replace, proofread, spell check">${icon('bolt', 15)} Tools</button>
      <div class="flex1"></div>
      <span class="page-meta" id="pageMeta"></span>
      <button class="btn ghost" id="pageSizeBtn">${pageDims().label} <span class="caret">▾</span></button>
      <div class="zoomer">
        <button id="zoomOut">−</button><span id="zoomLabel">${Math.round(App.zoom * 100)}%</span><button id="zoomIn">+</button>
      </div>
    </div>

    <!-- ===== body ===== -->
    <div class="body-row">
      <div class="sidebar ${App.leftCollapsed ? 'collapsed' : ''}" id="sidebar">
        <div class="sidebar-rail-collapsed">
          <button class="railjump" data-jump="blocks" title="Open the block library">${icon('blocks', 16)}<span class="vtext">Blocks</span></button>
          <button class="railjump" data-jump="outline" title="Open the document outline">${icon('outline', 16)}<span class="vtext">Outline</span></button>
          <button class="railjump" data-jump="pages" title="Open page management">${icon('doc', 16)}<span class="vtext">Pages</span></button>
        </div>
        <div class="sidebar-full">
          <div class="sidebar-head">
            <div class="sidebar-tabs">
              <button class="sbtab on" data-sbtab="blocks">${icon('blocks', 14)} Blocks</button>
              <button class="sbtab" data-sbtab="outline">${icon('outline', 14)} Outline</button>
              <button class="sbtab" data-sbtab="pages">${icon('doc', 14)} Pages</button>
            </div>
            <button class="iconbtn" id="sidebarCollapse" title="Collapse">${icon('panelL', 16)}</button>
          </div>
          <div class="sidebar-body" id="sidebarBody"></div>
          <div class="sidebar-body" id="outlineBody" style="display:none"></div>
          <div class="sidebar-body" id="pagesBody" style="display:none"></div>
        </div>
      </div>

      <div class="canvas-scroll" id="canvasScroll">
        <div class="canvas-pad"><div id="canvas" style="zoom:${App.zoom}"></div></div>
      </div>

      <div class="rail ${App.showRail ? '' : 'collapsed'}" id="rail">
        <div class="rail-head">
          <div class="rail-tabs" id="railTabs">
            <button class="railtab ${App.railTab === 'comments' ? 'on' : ''}" data-tab="comments">Comments</button>
            <button class="railtab ${App.railTab === 'suggestions' ? 'on' : ''}" data-tab="suggestions">Suggestions</button>
            <button class="railtab ${App.railTab === 'ai' ? 'on' : ''}" data-tab="ai">Ask Claude</button>
          </div>
          <button class="iconbtn" id="railCollapse" title="Collapse">${icon('panelR', 16)}</button>
        </div>
        <div class="rail-body" id="railBody"></div>
      </div>
    </div>
  </div>`;

  bindTopbar();
  bindToolbar();
  bindSidebar();
  bindRail();
  bindCanvasChrome();
  renderLibrary();
  renderCanvas();
  renderPresence();
  setMode(App.mode === 'viewing' ? 'viewing' : App.mode);
  renderRail();
  updateRfpBadge();
  updateRailCounts();
}

/* ---------- presence & identity ---------- */
function renderPresence() {
  const host = $('#presenceWrap');
  if (!host) return;
  const others = Sync.remote
    ? (App.presence || [])
    : USERS.slice(1, 3).map(u => ({ ...u, ghost: true }));   // demo trio until a server is connected
  host.innerHTML = `
    ${others.map(u => `<span class="avatar ${u.ghost ? 'ghost' : ''}" style="background:${u.color}" title="${esc(u.name)}${u.ghost ? ' (demo — connect the server for live presence)' : ' — online now'}">${esc(u.initials)}</span>`).join('')}
    <button class="avatar me-avatar" style="background:${ME.color}" title="You are ${esc(ME.name)} — click to switch identity">${esc(ME.initials)}</button>`;
  host.querySelector('.me-avatar').addEventListener('click', (e) => {
    const card = popover(e.currentTarget, `
      <div class="menu-kicker">Working as</div>
      ${USERS.map(u => `<div class="menu-row ${ME.id === u.id ? 'on' : ''}" data-uid="${u.id}">
        <span class="avatar sm" style="background:${u.color}">${u.initials}</span><div><b>${esc(u.name)}</b></div>
        ${ME.id === u.id ? '<span class="check">✓</span>' : ''}</div>`).join('')}
      <p class="set-hint" style="padding:6px 10px 8px">Identity drives comments, suggestions, and proofing initials. Syncs with the dashboard login later.</p>`,
      { width: 240 });
    card.querySelectorAll('[data-uid]').forEach(r => r.addEventListener('click', () => {
      setCurrentUser(r.dataset.uid);
      closePopovers();
      renderPresence();
      if (App.doc && Sync.remote) Sync.connect(App.doc.id);   // re-announce with the new identity
      updateProofBar();
      toast('Now working as ' + ME.name);
    }));
  });
}

function goHome() {
  cancelPendingComment();
  saveDoc({ silent: true });
  location.hash = '';
  renderHome();
  Sync.connect('');            // rejoin the lobby for live index updates
}

/* ---------- top bar ---------- */
function bindTopbar() {
  $('#backHome').addEventListener('click', goHome);

  const title = $('#docTitle');
  title.addEventListener('blur', () => {
    App.doc.title = title.textContent.trim() || 'Untitled Proposal';
    saveDoc({ history: 'seal' });
  });
  title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); title.blur(); } });

  $('#modeBtn').addEventListener('click', (e) => {
    const modes = [
      ['editing', 'Editing', 'Edit the document directly', '#2F6B4F'],
      ['suggesting', 'Suggesting', 'Edits become tracked suggestions others review', '#B8932A'],
      ['proofing', 'Proofing', 'Final pass — initial each section as reviewed; edits become suggestions and reset sign-offs', '#3F6A99'],
      ['viewing', 'Viewing', 'Read-only — no edits or formatting', '#8AA7C2'],
    ];
    const card = popover(e.currentTarget, modes.map(([k, l, desc, dot]) => `
      <div class="menu-row ${App.mode === k ? 'on' : ''}" data-mode="${k}">
        <span class="dot" style="background:${dot}"></span>
        <div><b>${l}</b><small>${desc}</small></div>
      </div>`).join(''), { width: 260 });
    card.querySelectorAll('[data-mode]').forEach(r => r.addEventListener('click', () => {
      setMode(r.dataset.mode); closePopovers(); renderRail();
    }));
  });

  const statusBtn = $('#statusBtn');
  if (statusBtn) statusBtn.addEventListener('click', (e) => openStatusMenu(e.currentTarget));

  $('#rfpBtn').addEventListener('click', (e) => openRfpPanel(e.currentTarget));
  $('#historyBtn').addEventListener('click', (e) => openHistoryPanel(e.currentTarget));
  $('#railToggle').addEventListener('click', () => { App.showRail = !App.showRail; renderRailChrome(); });
  const proofBtn = $('#proofreadBtn');
  if (proofBtn) {
    const syncProofBtn = () => {
      proofBtn.style.display = (window.AI && AI.available === false) ? 'none' : '';
    };
    syncProofBtn();
    document.addEventListener('ai-ready', syncProofBtn);
    proofBtn.addEventListener('click', () => runProofread());
  }
  $('#shareBtn').addEventListener('click', openShareModal);
  $('#saveBtn').addEventListener('click', () => {
    if (!App.doc) return;
    saveDoc({ history: 'seal' });
    if (typeof Sync !== 'undefined' && Sync.remote) Sync._push.flush();
    toast('Saved');
  });
  $('#exportBtn').addEventListener('click', (e) => {
    const card = popover(e.currentTarget, `
      <div class="menu-kicker">Download as</div>
      <div class="menu-row" data-x="word"><span class="xbadge" style="background:#E7EEF6;color:#2A527F">W</span><div><b>Microsoft Word</b><small>.docx — opens in Word</small></div></div>
      <div class="menu-row" data-x="gdocs"><span class="xbadge" style="background:#E9F1EC;color:#2F6B4F">G</span><div><b>Google Docs</b><small>Convert or paste a copy</small></div></div>
      <div class="menu-row" data-x="pdf"><span class="xbadge" style="background:#F6E9E7;color:#A8341E">P</span><div><b>PDF Document</b><small>Print-ready</small></div></div>`, { width: 250 });
    card.querySelector('[data-x="word"]').addEventListener('click', () => { closePopovers(); exportWord(); });
    card.querySelector('[data-x="gdocs"]').addEventListener('click', () => { closePopovers(); exportGoogleDocs(); });
    card.querySelector('[data-x="pdf"]').addEventListener('click', () => { closePopovers(); exportPDF(); });
  });
}

function updateRfpBadge() {
  const items = App.doc.rfp.items;
  const done = items.filter(i => i.done).length;
  const b = $('#rfpBadge');
  if (b) b.textContent = `${done}/${items.length}`;
}

function openRfpPanel(anchor) {
  const d = App.doc;
  const items = d.rfp.items;
  const done = items.filter(i => i.done).length;
  const pct = items.length ? Math.round(done / items.length * 100) : 0;
  const days = daysUntil(d.deadline);
  const card = popover(anchor, `
    <div class="rfp-hero">
      <div class="rfp-num">${esc(d.rfpNumber || 'RFP')}</div>
      <div class="rfp-title">${esc(d.serviceTitle)}</div>
      <div class="rfp-agency">${esc(d.agency || '')}</div>
      <div class="rfp-stats">
        ${days != null ? `<div><b>${days}</b><small>days to submit</small></div>` : ''}
        <div><b>${pct}%</b><small>requirements met</small></div>
      </div>
      <div class="rfp-hero-links">
        <button class="rfp-hero-link" data-linkact="cleatus">${icon('bolt', 12)} View in Cleatus</button>
        <button class="rfp-hero-link" data-linkact="source">${icon('link', 12)} View source</button>
      </div>
    </div>
    <div class="rfp-bar"><div style="width:${pct}%"></div></div>
    <div class="menu-kicker" style="display:flex;align-items:center">Submission checklist
      <button class="iconbtn" id="rfpGear" style="width:22px;height:22px;margin-left:auto" title="Checklist settings — page limit">${icon('gear', 13)}</button>
    </div>
    <div class="rfp-limit-row" id="rfpLimitRow" ${d.rfp.pageLimit ? '' : 'hidden'}>
      <span>Page limit</span>
      <input type="number" id="rfpPageLimit" min="1" max="500" value="${d.rfp.pageLimit || ''}" placeholder="—">
      <span>pages</span>
      <button class="btn tiny" id="rfpLimitClear" ${d.rfp.pageLimit ? '' : 'hidden'}>Clear</button>
    </div>
    <div class="rfp-list">
      ${items.map(it => `<label class="rfp-item ${it.done ? 'done' : ''}" data-rid="${it.id}">
        <span class="checkbox">${it.done ? icon('check', 10, 3.4) : ''}</span>
        <span class="rfp-item-txt">${esc(it.label)}<small>RFP ${esc(it.section)}</small></span>
        <button class="iconbtn danger rfp-del" title="Remove">${icon('x', 12)}</button>
      </label>`).join('')}
    </div>
    <div class="rfp-add"><input placeholder="Add requirement…" id="rfpNewItem"><button class="btn tiny" id="rfpAddBtn">Add</button></div>`,
    { width: 330, maxHeight: '72vh' });

  /* page limit */
  card.querySelector('#rfpGear').addEventListener('click', () => {
    const row = card.querySelector('#rfpLimitRow');
    row.hidden = !row.hidden;
    if (!row.hidden) card.querySelector('#rfpPageLimit').focus();
  });
  const limitInput = card.querySelector('#rfpPageLimit');
  limitInput.addEventListener('change', () => {
    const v = parseInt(limitInput.value) || null;
    d.rfp.pageLimit = v;
    localStorage.removeItem('fss.limitsnooze.' + d.id);      // new limit → warning re-arms
    card.querySelector('#rfpLimitClear').hidden = !v;
    saveDoc(); updatePageMeta();
    toast(v ? `Page limit set to ${v} — you’ll be warned if the proposal runs over` : 'Page limit removed');
  });
  card.querySelector('#rfpLimitClear').addEventListener('click', () => {
    d.rfp.pageLimit = null; limitInput.value = '';
    card.querySelector('#rfpLimitClear').hidden = true;
    saveDoc(); updatePageMeta();
  });

  card.querySelectorAll('.rfp-hero-link').forEach(btn => btn.addEventListener('click', () => {
    const url = btn.dataset.linkact === 'cleatus' ? (d.rfp.cleatusUrl || null) : (d.rfp.sourceUrl || null);
    if (url) window.open(url, '_blank');
    else toast(btn.dataset.linkact === 'cleatus'
      ? 'Cleatus link not set yet — connects when the dashboard details are uploaded'
      : 'Source link not set yet — connects when the RFP documents are uploaded');
  }));
  card.querySelectorAll('.rfp-item').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.rfp-del')) return;
      e.preventDefault();
      const it = items.find(x => x.id === row.dataset.rid);
      it.done = !it.done;
      saveDoc(); closePopovers(); openRfpPanel(anchor); updateRfpBadge();
    });
    row.querySelector('.rfp-del').addEventListener('click', () => {
      d.rfp.items = d.rfp.items.filter(x => x.id !== row.dataset.rid);
      saveDoc(); closePopovers(); openRfpPanel(anchor); updateRfpBadge();
    });
  });
  const add = () => {
    const v = card.querySelector('#rfpNewItem').value.trim();
    if (!v) return;
    d.rfp.items.push({ id: uid('r'), label: v, section: '—', done: false });
    saveDoc(); closePopovers(); openRfpPanel(anchor); updateRfpBadge();
  };
  card.querySelector('#rfpAddBtn').addEventListener('click', add);
  card.querySelector('#rfpNewItem').addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
}

function openHistoryPanel(anchor) {
  const vs = App.doc.versions;
  const card = popover(anchor, `
    <div class="pophead slim"><b>Version history</b></div>
    <div class="menu-kicker" style="padding-top:2px">Checkpoints save automatically while you work</div>
    <div class="vh-list">
      <div class="vh-item current"><span class="vh-dot"></span><div><b>Current version</b><small>Editing now · ${esc(ME.name)}</small></div></div>
      ${vs.map(v => `<div class="vh-item" data-vid="${v.id}"><span class="vh-dot"></span>
        <div><b>${esc(v.label)}</b><small>${fmtDate(v.ts)}, ${new Date(v.ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · ${esc(v.author)}</small>
        <span class="vh-btns"><button class="btn tiny vh-diff">View changes</button><button class="btn tiny vh-restore">Restore</button></span></div></div>`).join('')}
      ${vs.length ? '' : '<div class="rail-empty">No checkpoints yet — they appear as you edit.</div>'}
    </div>
    <div class="rfp-add"><input placeholder="Name this version…" id="vhName"><button class="btn tiny" id="vhSave">Save</button></div>`,
    { width: 310, maxHeight: '72vh' });
  card.querySelectorAll('.vh-restore').forEach(btn => btn.addEventListener('click', (e) => {
    const vid = e.target.closest('.vh-item').dataset.vid;
    closePopovers();
    restoreVersion(vid);
  }));
  card.querySelectorAll('.vh-diff').forEach(btn => btn.addEventListener('click', (e) => {
    const vid = e.target.closest('.vh-item').dataset.vid;
    closePopovers();
    openVersionDiff(vid);
  }));
  card.querySelector('#vhSave').addEventListener('click', () => {
    const v = card.querySelector('#vhName').value.trim() || 'Named version';
    snapshotVersion(v);
    closePopovers();
    toast('Version saved: ' + v);
  });
}

function openShareModal() {
  const card = modal(`
    <div class="pophead">${icon('users', 16)}<b>Share “${esc(App.doc.title.slice(0, 40))}”</b><button class="iconbtn close-pop">${icon('x', 15)}</button></div>
    <div class="popbody">
      <div class="share-row">
        <input class="set-input" placeholder="Add teammates by email…" id="shareEmail" style="margin-bottom:0">
        <select class="set-input slim" id="shareRole" style="margin-bottom:0;width:120px">
          <option>Editor</option><option>Suggester</option><option>Viewer</option>
        </select>
        <button class="btn primary" id="shareSend">Invite</button>
      </div>
      <div class="menu-kicker" style="padding:14px 0 6px">People with access</div>
      ${USERS.slice(0, 3).map((u, i) => `<div class="share-person">
        <span class="avatar" style="background:${u.color}">${u.initials}</span>
        <span class="share-name">${esc(u.name)}${u.id === 'me' ? ' (you)' : ''}</span>
        <span class="muted">${u.id === 'me' ? 'Owner' : 'Editor'}</span>
      </div>`).join('')}
      <p class="set-hint" style="margin-top:12px">Roles map to the modes: Editors edit directly, Suggesters’ changes become tracked suggestions, Viewers are read-only. Accounts sync from the FSS dashboard user directory once connected.</p>
    </div>`, { width: 480 });
  card.querySelector('.close-pop').onclick = closePopovers;
  card.querySelector('#shareSend').addEventListener('click', () => {
    const em = card.querySelector('#shareEmail').value.trim();
    if (!em) return;
    toast(`Invite queued for ${em} — sends when the user directory is connected`);
    card.querySelector('#shareEmail').value = '';
  });
}

/* ---------- toolbar ---------- */
function bindToolbar() {
  $$('.toolbar [data-fmt]').forEach(btn => {
    btn.addEventListener('mousedown', (e) => e.preventDefault());   // keep text selection
    btn.addEventListener('click', () => {
      const f = btn.dataset.fmt;
      if (f === 'undo') return History.undo();   // native execCommand undo can't
      if (f === 'redo') return History.redo();   // survive the canvas re-renders
      execFmt(f);
    });
  });
  /* font size: +/- steppers keep the selection (no focus steal); the input
     saves the selection on focus and restores it before applying */
  const sizeInput = $('#fontSizeInput');
  let savedSizeRange = null;
  const currentSelSize = () => {
    const sel = document.getSelection();
    if (!sel.anchorNode || !closestTag(sel.anchorNode, '#canvas')) return null;
    const el = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
    return el ? Math.round(parseFloat(getComputedStyle(el).fontSize)) : null;
  };
  const stepSize = (d) => {
    const cur = parseInt(sizeInput.value) || currentSelSize() || 13;
    execFontSize(cur + d);
  };
  $('#fontSizeDown').addEventListener('mousedown', (e) => e.preventDefault());
  $('#fontSizeUp').addEventListener('mousedown', (e) => e.preventDefault());
  $('#fontSizeDown').addEventListener('click', () => stepSize(-1));
  $('#fontSizeUp').addEventListener('click', () => stepSize(1));
  sizeInput.addEventListener('focus', () => {
    const sel = document.getSelection();
    if (sel.rangeCount && !sel.isCollapsed && closestTag(sel.anchorNode, '#canvas')) savedSizeRange = sel.getRangeAt(0).cloneRange();
    else savedSizeRange = null;
  });
  const applyTypedSize = () => {
    const px = parseInt(sizeInput.value);
    if (!px) return;
    if (savedSizeRange) {
      const sel = document.getSelection();
      sel.removeAllRanges(); sel.addRange(savedSizeRange);
    }
    execFontSize(px);
  };
  sizeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyTypedSize(); sizeInput.blur(); } });
  sizeInput.addEventListener('change', applyTypedSize);

  /* brand color pickers */
  const bindColorBtn = (btnId, kind) => {
    const btn = $(btnId);
    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', () => openColorMenu(kind, btn));
  };
  bindColorBtn('#foreColorBtn', 'fore');
  bindColorBtn('#hiliteColorBtn', 'hilite');

  /* The select doubles as a live readout of the caret's current font
     (like Word) — so don't blank it after applying; selectionchange
     keeps it in sync. */
  $('#fontSel').addEventListener('change', (e) => { execFont(e.target.value); });
  $('#toolsBtn').addEventListener('click', (e) => openToolsMenu(e.currentTarget));
  $('#insertImageBtn').addEventListener('click', () => {
    const i = App.doc.blocks.findIndex(b => b.id === App.selectedBlock);
    const b = addBlock('image', i < 0 ? App.doc.blocks.length : i + 1);
    pickImage(b);
  });
  $('#listOptsBtn').addEventListener('mousedown', (e) => e.preventDefault());
  $('#listOptsBtn').addEventListener('click', (e) => openListOptions(e.currentTarget));
  $('#insertTextboxBtn').addEventListener('click', () => {
    if (App.mode === 'viewing') { toast('Switch to Editing first'); return; }
    addFloat('text');
  });
  $('#stampSigBtn').addEventListener('click', (e) => {
    if (App.mode === 'viewing') { toast('Switch to Editing first'); return; }
    openStampMenu(e.currentTarget);
  });
  $('#commentToolBtn').addEventListener('mousedown', (e) => e.preventDefault());
  $('#commentToolBtn').addEventListener('click', startComment);
  $('#zoomIn').addEventListener('click', () => setZoom(App.zoom + 0.08));
  $('#zoomOut').addEventListener('click', () => setZoom(App.zoom - 0.08));
  $('#pageSizeBtn').addEventListener('click', (e) => openPagesMenu(e.currentTarget));
}

/* Brand color palette (admin-managed in Workspace Settings) + custom picker. */
function openColorMenu(kind, anchor) {
  const palette = kind === 'fore' ? Settings.textColors() : Settings.highlightColors();
  const card = popover(anchor, `
    <div class="menu-kicker">${kind === 'fore' ? 'Text color' : 'Highlight'} — brand colors</div>
    <div class="swatch-grid">
      ${palette.map(([c, n]) => `<button class="swatch ${c === 'transparent' ? 'none' : ''} ${c === '#FFFFFF' ? 'white' : ''}"
        data-color="${c}" title="${esc(n)}" style="${c === 'transparent' ? '' : `background:${c}`}"></button>`).join('')}
    </div>
    <div class="menu-sep"></div>
    <div class="swatch-custom">
      <span class="set-hint" style="margin:0">Custom</span>
      <input type="color" class="pn-custom" data-customcolor value="${kind === 'fore' ? '#1A3A5C' : '#FBECBF'}">
    </div>`, { width: 226, align: 'left' });
  card.querySelectorAll('.swatch').forEach(s => {
    s.addEventListener('mousedown', (e) => e.preventDefault());   // keep the text selection
    s.addEventListener('click', () => { closePopovers(); execColor(kind, s.dataset.color); });
  });
  const custom = card.querySelector('[data-customcolor]');
  custom.addEventListener('mousedown', (e) => e.stopPropagation());
  custom.addEventListener('change', () => { closePopovers(); execColor(kind, custom.value); });
}

/* Pages menu: page size + page-number design (format, placement, font, size, color) */
function openPagesMenu(anchor) {
  const cfg = pageNumCfg();
  const POS = [['tl', 'Top left'], ['tc', 'Top center'], ['tr', 'Top right'], ['bl', 'Bottom left'], ['bc', 'Bottom center'], ['br', 'Bottom right']];
  const COLORS = [['#8A8F94', 'Gray'], ['#1A3A5C', 'Navy'], ['#0F0F0F', 'Ink'], ['#B8932A', 'Gold']];
  const card = popover(anchor, `
    <div class="menu-kicker">Page size</div>
    ${Object.entries(PAGE_SIZES).map(([k, p]) => `<div class="menu-row ${App.doc.pageSize === k ? 'on' : ''}" data-ps="${k}"><div><b>${p.label}</b><small>${p.dim}</small></div><span class="check">${App.doc.pageSize === k ? '✓' : ''}</span></div>`).join('')}
    <div class="menu-sep"></div>
    <div class="menu-kicker">Margins — body pages</div>
    <div class="pn-body">
      <p class="set-hint" style="margin:0 0 8px">The cover page has its own margins — set them in the cover block’s gear settings.</p>
      <div class="seg" id="marginSeg">
        ${[['Narrow', 48], ['Normal', 84], ['Wide', 120]].map(([l, px]) => `<button class="seg-btn ${pageMargin() === px ? 'on' : ''}" data-margin="${px}">${l}</button>`).join('')}
      </div>
      <div class="pn-2col" style="margin-top:8px;grid-template-columns:1fr 90px;align-items:center">
        <span class="set-hint" style="margin:0">Custom (inches)</span>
        <input type="number" class="set-input slim" id="marginCustom" value="${(pageMargin() / 96).toFixed(2)}" min="0.25" max="2" step="0.05">
      </div>
    </div>
    <div class="menu-sep"></div>
    <div class="menu-kicker">Page numbers</div>
    <div class="pn-body">
      <label class="set-toggle"><label class="switch"><input type="checkbox" data-pn="show" ${cfg.show ? 'checked' : ''}><span></span></label> Show page numbers</label>
      <div class="pn-controls ${cfg.show ? '' : 'disabled'}">
        <div class="set-label">Format</div>
        <select class="set-input slim" data-pn="format">
          <option value="pageXofY" ${cfg.format === 'pageXofY' ? 'selected' : ''}>Page 4 of 12</option>
          <option value="nofy" ${cfg.format === 'nofy' ? 'selected' : ''}>4 of 12</option>
          <option value="n" ${cfg.format === 'n' ? 'selected' : ''}>4</option>
          <option value="dash" ${cfg.format === 'dash' ? 'selected' : ''}>— 4 —</option>
        </select>
        <div class="set-label">Placement</div>
        <div class="pn-grid">
          ${POS.map(([k, l]) => `<button class="pn-pos ${cfg.pos === k ? 'on' : ''}" data-pnpos="${k}" title="${l}"><span></span></button>`).join('')}
        </div>
        <div class="pn-2col">
          <div><div class="set-label">Font</div>
          <div class="seg">
            <button class="seg-btn ${cfg.font === 'sans' ? 'on' : ''}" data-pnfont="sans">Sans</button>
            <button class="seg-btn ${cfg.font === 'serif' ? 'on' : ''}" data-pnfont="serif" style="font-family:var(--fs-font-serif)">Serif</button>
          </div></div>
          <div><div class="set-label">Size</div>
          <input type="number" class="set-input slim" data-pn="size" value="${cfg.size}" min="7" max="16"></div>
        </div>
        <div class="set-label">Color</div>
        <div class="pn-colors">
          ${COLORS.map(([c, l]) => `<button class="pn-swatch ${cfg.color === c ? 'on' : ''}" data-pncolor="${c}" title="${l}" style="background:${c}"></button>`).join('')}
          <input type="color" class="pn-custom" data-pn="colorpick" value="${cfg.color}" title="Custom color">
        </div>
        <label class="set-toggle"><label class="switch"><input type="checkbox" data-pn="skipFirst" ${cfg.skipFirst ? 'checked' : ''}><span></span></label> Don’t number the cover page</label>
      </div>
    </div>
    <div class="menu-sep"></div>
    <div class="menu-kicker">Body page letterhead</div>
    <div class="pn-body">
      <label class="set-toggle"><label class="switch"><input type="checkbox" data-pgbrand ${App.doc.pageBrand !== false ? 'checked' : ''}><span></span></label> Firm lockup, bottom-left</label>
      <p class="set-hint" style="margin-top:2px">The letterhead mark on every body page — never on the cover or imported PDF pages.</p>
    </div>
    <div class="menu-sep"></div>
    <div class="menu-kicker">Body page background</div>
    <div class="pn-body">
      <div class="bg-grid">
        <button class="bg-thumb none ${!(App.doc.pageBg && App.doc.pageBg.id) ? 'on' : ''}" data-pgbg="" title="No background">None</button>
        ${AssetStore.bgs().map(g => `<button class="bg-thumb ${(App.doc.pageBg && App.doc.pageBg.id) === g.id ? 'on' : ''}" data-pgbg="${g.id}" title="${esc(g.name)}" style="background-image:url(${g.src})"></button>`).join('')}
        <button class="bg-thumb add" data-act="uploadPgBg" title="Upload letterhead / frame art">${icon('plus', 16)}</button>
      </div>
      <label class="set-toggle"><label class="switch"><input type="checkbox" data-pgbgskip ${(App.doc.pageBg && App.doc.pageBg.skipFirst === false) ? '' : 'checked'}><span></span></label> Skip the cover page</label>
      <p class="set-hint" style="margin-top:2px">Shows in the editor and PDF export. Word export stays clean-paper.</p>
    </div>`,
    { width: 262, maxHeight: '76vh' });

  const apply = () => { saveDoc(); paginate(); };
  card.querySelectorAll('[data-ps]').forEach(r => r.addEventListener('click', () => {
    App.doc.pageSize = r.dataset.ps;
    saveDoc(); closePopovers(); renderCanvas();
    $('#pageSizeBtn').innerHTML = `${pageDims().label} <span class="caret">▾</span>`;
  }));
  /* margins — re-render the canvas so page geometry updates everywhere */
  const setMargin = (px) => {
    App.doc.marginPx = Math.max(24, Math.min(192, Math.round(px)));
    saveDoc();
    renderCanvas();
    card.querySelectorAll('[data-margin]').forEach(x => x.classList.toggle('on', parseInt(x.dataset.margin) === App.doc.marginPx));
    card.querySelector('#marginCustom').value = (App.doc.marginPx / 96).toFixed(2);
  };
  card.querySelectorAll('[data-margin]').forEach(b => b.addEventListener('click', () => setMargin(parseInt(b.dataset.margin))));
  card.querySelector('#marginCustom').addEventListener('change', (e) => setMargin((parseFloat(e.target.value) || 0.875) * 96));

  card.querySelector('[data-pn="show"]').addEventListener('change', (e) => {
    cfg.show = e.target.checked;
    card.querySelector('.pn-controls').classList.toggle('disabled', !cfg.show);
    apply();
  });
  card.querySelector('[data-pn="format"]').addEventListener('change', (e) => { cfg.format = e.target.value; apply(); });
  card.querySelector('[data-pn="size"]').addEventListener('input', (e) => { cfg.size = Math.max(7, Math.min(16, parseInt(e.target.value) || 10)); apply(); });
  card.querySelector('[data-pn="skipFirst"]').addEventListener('change', (e) => { cfg.skipFirst = e.target.checked; apply(); });
  card.querySelector('[data-pn="colorpick"]').addEventListener('input', (e) => {
    cfg.color = e.target.value;
    card.querySelectorAll('.pn-swatch').forEach(s => s.classList.remove('on'));
    apply();
  });
  card.querySelectorAll('[data-pnpos]').forEach(b => b.addEventListener('click', () => {
    cfg.pos = b.dataset.pnpos;
    card.querySelectorAll('[data-pnpos]').forEach(x => x.classList.toggle('on', x === b));
    apply();
  }));
  card.querySelectorAll('[data-pnfont]').forEach(b => b.addEventListener('click', () => {
    cfg.font = b.dataset.pnfont;
    card.querySelectorAll('[data-pnfont]').forEach(x => x.classList.toggle('on', x === b));
    apply();
  }));
  card.querySelectorAll('[data-pncolor]').forEach(b => b.addEventListener('click', () => {
    cfg.color = b.dataset.pncolor;
    card.querySelectorAll('.pn-swatch').forEach(x => x.classList.toggle('on', x === b));
    apply();
  }));
  /* body page background */
  card.querySelectorAll('[data-pgbg]').forEach(t => t.addEventListener('click', () => {
    App.doc.pageBg = App.doc.pageBg || { skipFirst: true };
    App.doc.pageBg.id = t.dataset.pgbg || null;
    card.querySelectorAll('[data-pgbg]').forEach(x => x.classList.toggle('on', x === t));
    apply();
  }));
  const upPgBg = card.querySelector('[data-act="uploadPgBg"]');
  if (upPgBg) upPgBg.addEventListener('click', async () => {
    const f = await pickFile('image/*');
    if (!f) return;
    const g = AssetStore.addBg(f.name.replace(/\.\w+$/, ''), await fileToDataURL(f, 1700));
    App.doc.pageBg = { id: g.id, skipFirst: App.doc.pageBg ? App.doc.pageBg.skipFirst !== false : true };
    apply(); closePopovers(); openPagesMenu(anchor);
    toast('Background added to your library');
  });
  const pgSkip = card.querySelector('[data-pgbgskip]');
  if (pgSkip) pgSkip.addEventListener('change', () => {
    App.doc.pageBg = App.doc.pageBg || { id: null };
    App.doc.pageBg.skipFirst = pgSkip.checked;
    apply();
  });
  const pgBrand = card.querySelector('[data-pgbrand]');
  if (pgBrand) pgBrand.addEventListener('change', () => {
    App.doc.pageBrand = pgBrand.checked;
    apply();
  });
}

/* ---------- sidebar (block library) ---------- */
function setSidebarTab(tab) {
  App.sidebarTab = tab;
  $$('.sbtab').forEach(x => x.classList.toggle('on', x.dataset.sbtab === tab));
  $('#sidebarBody').style.display = tab === 'blocks' ? '' : 'none';
  $('#outlineBody').style.display = tab === 'outline' ? '' : 'none';
  $('#pagesBody').style.display = tab === 'pages' ? '' : 'none';
  renderOutline();
  if (tab === 'pages') renderPagesPanel();
}

function bindSidebar() {
  $('#sidebarCollapse').addEventListener('click', () => { App.leftCollapsed = true; $('#sidebar').classList.add('collapsed'); });
  $$('.railjump').forEach(btn => btn.addEventListener('click', () => {
    App.leftCollapsed = false;
    $('#sidebar').classList.remove('collapsed');
    setSidebarTab(btn.dataset.jump);
  }));
  $$('.sbtab').forEach(t => t.addEventListener('click', () => setSidebarTab(t.dataset.sbtab)));
}

/* ---------- Pages panel (Acrobat-style page management) ---------- */
function renderPagesPanel() {
  const host = $('#pagesBody');
  if (!host || App.sidebarTab !== 'pages') return;
  const gs = pageGroups();
  let html = `
  <div class="lib-hint" style="margin-top:0">Reorder, delete, or insert pages. A page moves with everything on it.</div>
  <div class="pages-list">`;
  gs.forEach((g, pi) => {
    const labels = g.slice(0, 3).map(b => {
      const el = blockEls.get(b.id);
      const h = el && el.querySelector('h1,h2,h3');
      return (h && h.textContent.trim()) || catalogItem(b.type).label;
    });
    html += `
    <div class="page-card" data-pi="${pi}">
      <div class="page-thumb" data-act="goto" title="Jump to page ${pi + 1}">
        <span class="page-thumb-num">${pi + 1}</span>
        <div class="page-thumb-lines">${labels.map(l => `<span>${esc(l.slice(0, 30))}</span>`).join('')}${g.length > 3 ? `<span class="muted">+${g.length - 3} more</span>` : ''}</div>
      </div>
      <div class="page-card-actions">
        <button class="iconbtn" data-act="up" title="Move page up" ${pi === 0 ? 'disabled' : ''}>${icon('back', 13)}</button>
        <button class="iconbtn" data-act="down" title="Move page down" ${pi === gs.length - 1 ? 'disabled' : ''}>${icon('back', 13)}</button>
        <button class="iconbtn" data-act="blank" title="Insert blank page after">${icon('plus', 13)}</button>
        <button class="iconbtn" data-act="insfile" title="Insert PDF / Word file after this page">${icon('upload', 13)}</button>
        <button class="iconbtn danger" data-act="delpage" title="Delete page">${icon('trash', 13)}</button>
      </div>
    </div>`;
  });
  html += `</div>
  <button class="lib-showall" id="addPageEnd">${icon('plus', 13)} Add a blank page at the end</button>
  <button class="lib-showall" id="insertFileEnd">${icon('upload', 13)} Insert a PDF / Word file…</button>
  <p class="set-hint" style="margin-top:2px">PDF pages drop in exactly as designed. Word (.docx) files convert to editable sections.</p>`;
  host.innerHTML = html;

  host.querySelectorAll('.page-card').forEach(cardEl => {
    const pi = parseInt(cardEl.dataset.pi);
    cardEl.querySelector('[data-act="goto"]').addEventListener('click', () => {
      const sheet = $$('#canvas .sheet')[pi];
      if (sheet) sheet.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    cardEl.querySelector('[data-act="up"]').addEventListener('click', () => movePage(pi, -1));
    cardEl.querySelector('[data-act="down"]').addEventListener('click', () => movePage(pi, 1));
    cardEl.querySelector('[data-act="blank"]').addEventListener('click', () => addBlankPageAfter(pi));
    cardEl.querySelector('[data-act="insfile"]').addEventListener('click', () => insertFileAfterPage(pi));
    cardEl.querySelector('[data-act="delpage"]').addEventListener('click', () => {
      const c = modal(`
        <div class="pophead"><b>Delete page ${pi + 1}?</b></div>
        <div class="popbody"><p class="set-hint" style="font-size:13px">This removes every section on the page (${pageGroups()[pi].length} block${pageGroups()[pi].length > 1 ? 's' : ''}).</p>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
          <button class="btn" id="dpNo">Cancel</button><button class="btn danger" id="dpYes">Delete page</button></div></div>`, { width: 380 });
      c.querySelector('#dpNo').onclick = closePopovers;
      c.querySelector('#dpYes').onclick = () => { closePopovers(); deletePage(pi); };
    });
  });
  const addEnd = host.querySelector('#addPageEnd');
  if (addEnd) addEnd.addEventListener('click', () => addBlock('blankpage', App.doc.blocks.length));
  const insEnd = host.querySelector('#insertFileEnd');
  if (insEnd) insEnd.addEventListener('click', () => insertFileAfterPage(null));
}

function renderLibrary() {
  const host = $('#sidebarBody');
  const ct = App.doc.clientType;
  const catalog = Settings.catalog();     // overrides + custom blocks applied
  const curated = [];
  catalog.forEach(g => g.items.forEach(it => { if (it.curated) curated.push(it); }));

  const libItem = (it, isCurated) => `
    <div class="libitem" draggable="true" data-libtype="${it.type}">
      <div class="libitem-head">
        <span class="lib-grip">${icon('drag', 13)}</span>
        <b>${esc(it.label)}</b>
        ${isCurated ? `<span class="curated-tag">Curated</span>` : ''}
      </div>
      <small>${esc(it.desc)}</small>
    </div>`;

  let html = `
  <div class="lib-curated-head">
    <span class="lib-kicker">Curated for</span>
    <div class="ct-chips">
      ${CLIENT_KEYS.map(k => `<button class="ct-chip ${ct === k ? 'on' : ''}" data-ctchip="${k}" title="${CLIENTS[k].label}">${CLIENTS[k].short}</button>`).join('')}
    </div>
  </div>
  <div class="lib-hint">Drag a block into the document, or click to insert after the selected block. Curated blocks drop in pre-written for ${esc(CLIENTS[ct].label)} clients.</div>
  <div class="lib-group">
    <div class="lib-group-h">Suggested for ${esc(CLIENTS[ct].label)} clients</div>
    ${curated.map(it => libItem(it, true)).join('')}
  </div>
  <button class="lib-showall" id="showAllBlocks">${App.showAllBlocks ? '▾ Hide the full library' : '▸ Open the full library'}</button>`;

  if (App.showAllBlocks) {
    const cats = ['All', ...catalog.map(g => g.cat)];
    html += `<div class="lib-cats">${cats.map(c => `<button class="chip ${App.libCat === c ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>`;
    catalog.filter(g => App.libCat === 'All' || g.cat === App.libCat).forEach(g => {
      html += `<div class="lib-group"><div class="lib-group-h">${esc(g.cat)}</div>${g.items.map(it => libItem(it, !!it.curated)).join('')}</div>`;
    });
  }
  host.innerHTML = html;

  host.querySelectorAll('[data-ctchip]').forEach(chip => chip.addEventListener('click', () => {
    App.doc.clientType = chip.dataset.ctchip;
    saveDoc();
    renderLibrary();
    toast(`Library curated for ${CLIENTS[App.doc.clientType].label} clients — existing text is unchanged`);
  }));
  const showAll = host.querySelector('#showAllBlocks');
  if (showAll) showAll.addEventListener('click', () => { App.showAllBlocks = !App.showAllBlocks; renderLibrary(); });
  host.querySelectorAll('[data-cat]').forEach(c => c.addEventListener('click', () => { App.libCat = c.dataset.cat; renderLibrary(); }));

  host.querySelectorAll('.libitem').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      App.drag = { kind: 'lib', type: item.dataset.libtype };
      e.dataTransfer.effectAllowed = 'copy';
      try { e.dataTransfer.setData('text/plain', item.dataset.libtype); } catch (x) {}
      document.body.classList.add('dragging');
    });
    item.addEventListener('dragend', endDrag);
    item.addEventListener('click', () => {
      const i = App.doc.blocks.findIndex(b => b.id === App.selectedBlock);
      addBlock(item.dataset.libtype, i < 0 ? App.doc.blocks.length : i + 1);
    });
  });
}

/* ---------- right rail chrome ---------- */
function bindRail() {
  $('#railCollapse').addEventListener('click', () => { App.showRail = false; renderRailChrome(); });
  $$('#railTabs .railtab').forEach(t => t.addEventListener('click', () => {
    App.railTab = t.dataset.tab;
    $$('#railTabs .railtab').forEach(x => x.classList.toggle('on', x === t));
    renderRail();
  }));
}
function renderRailChrome() {
  const rail = $('#rail');
  if (!rail) return;
  rail.classList.toggle('collapsed', !App.showRail);
  $$('#railTabs .railtab').forEach(x => x.classList.toggle('on', x.dataset.tab === App.railTab));
  if (App.showRail) renderRail();
  positionCommentCards();
}

/* Live font readout — show the caret's actual typeface in the toolbar
   select, Word-style. Known fonts select their menu entry; anything else
   (pasted text, imported docs) shows its family name on the placeholder. */
function updateFontReadout(el) {
  const selEl = $('#fontSel');
  if (!selEl || document.activeElement === selEl) return;
  const ph = selEl.querySelector('option[value=""]');
  const key = detectFontKey(el);
  if (key && selEl.querySelector(`option[value="${key}"]`)) {
    selEl.value = key;
    if (ph) ph.textContent = 'Font';
  } else {
    const fam = (getComputedStyle(el).fontFamily || '').split(',')[0].replace(/["']/g, '').trim();
    if (ph) ph.textContent = fam || 'Font';
    selEl.value = '';
  }
}

/* ---------- selection word count (toolbar meta) ---------- */
document.addEventListener('selectionchange', debounce(() => {
  if (App.view !== 'editor') return;
  const meta = $('#pageMeta');
  if (!meta) return;
  const sel = document.getSelection();
  // live font-size + font-family readout for the caret / selection
  const sizeInp = $('#fontSizeInput');
  if (sel && sel.anchorNode && closestTag(sel.anchorNode, '#canvas')) {
    const el = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
    if (el) {
      if (sizeInp && document.activeElement !== sizeInp) sizeInp.value = Math.round(parseFloat(getComputedStyle(el).fontSize));
      updateFontReadout(el);
    }
  }
  if (sel && !sel.isCollapsed && sel.anchorNode && closestTag(sel.anchorNode, '#canvas')) {
    const words = sel.toString().trim().split(/\s+/).filter(Boolean).length;
    const chars = sel.toString().length;
    if (words) {
      meta.textContent = `${words.toLocaleString()} word${words === 1 ? '' : 's'} selected · ${chars.toLocaleString()} characters`;
      meta.classList.add('hl');
      return;
    }
  }
  if (meta.classList.contains('hl')) { meta.classList.remove('hl'); updatePageMeta(); }
}, 140));

/* ---------- keyboard ---------- */
window.addEventListener('keydown', (e) => {
  if (App.view !== 'editor') return;
  const cmd = e.metaKey || e.ctrlKey;
  // undo/redo — but let form fields (find & replace, settings inputs,
  // comment composer) keep their own native undo
  const ae = document.activeElement;
  const inFormField = ae && (/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) ||
    (ae.isContentEditable && !ae.closest('#canvas') && ae.id !== 'docTitle'));
  if (cmd && !e.altKey && e.key.toLowerCase() === 'z' && !inFormField) {
    e.preventDefault();
    if (e.shiftKey) History.redo(); else History.undo();
  }
  if (cmd && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'y' && !inFormField) {
    e.preventDefault(); History.redo();
  }
  if (cmd && e.altKey && (e.code === 'KeyM')) { e.preventDefault(); startComment(); }
  if (cmd && !e.altKey && e.key === 's') { e.preventDefault(); saveDoc(); toast('Autosave is always on — saved'); }
  if (cmd && !e.altKey && !e.shiftKey && e.key === 'f') { e.preventDefault(); openFindReplace(); }
  if ((e.key === 'Delete' || e.key === 'Backspace') && App.selFloat) {
    const ae = document.activeElement;
    const editing = ae && (ae.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName));
    if (!editing) { e.preventDefault(); removeFloat(App.selFloat); }
  }
});

/* =================== BOOT =================== */
function seedSampleIfEmpty() {
  if (window.__KEEL_EMBED__) return;
  if (Store.index().length) return;
  const doc = Store.create({
    title: 'Beaufort County — Public Outreach Proposal',
    agency: 'Beaufort County, South Carolina',
    clientType: 'county',
    rfpNumber: 'RFP #051326',
    deadline: new Date(Date.now() + 39 * 86400000).toISOString().slice(0, 10),
    serviceTitle: 'Public Education & Community Outreach Services',
    template: 'full',
  });
  doc.comments.push({
    id: uid('c'), blockId: doc.blocks[1].id, quote: '',
    text: 'Let’s make sure we reference their prior penny program in the opening.',
    author: 'Carter James', initials: 'CJ', color: '#1A3A5C',
    assignee: 'Luke O’Connell', resolved: false, ts: Date.now() - 7200000, replies: [],
  });
  doc.rfp.items[0].done = true; doc.rfp.items[1].done = true; doc.rfp.items[2].done = true;
  Store.writeDoc(doc);
}

window.addEventListener('DOMContentLoaded', async () => {
  if (window.KeelBridge) await KeelBridge.init();
  await Sync.init();
  if (Sync.remote) {
    await Sync.refreshIndex();
    Sync.connect('');            // lobby connection: index/asset events while on home
  }
  seedSampleIfEmpty();
  const m = location.hash.match(/^#doc\/(.+)$/);
  if (m && (Store.read(m[1]) || Sync.remote)) openEditor(m[1]);
  else if (location.hash === '#admin') openAdmin();
  else renderHome();
});

function openAdmin() {
  if (!Settings.isAdmin()) {
    toast('Workspace settings are limited to selected users — ask the administrator for access');
    location.hash = '';
    renderHome();
    return;
  }
  location.hash = 'admin';
  renderAdmin();
}

/* Browser back / forward */
window.addEventListener('hashchange', () => {
  const m = location.hash.match(/^#doc\/(.+)$/);
  if (m) {
    if (!App.doc || App.doc.id !== m[1]) openEditor(m[1]);
  } else if (location.hash === '#admin') {
    if (App.view !== 'admin') openAdmin();
  } else if (App.view === 'editor') {
    goHome();
  } else if (App.view === 'admin') {
    renderHome();
  }
});
