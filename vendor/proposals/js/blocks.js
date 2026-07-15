/* ============ Fog Signal Proposals — block renderers ============ */
'use strict';

const PAGE_SIZES = {
  letter: { w: 816, h: 1056, label: 'Letter', dim: '8.5 × 11 in' },
  a4:     { w: 794, h: 1123, label: 'A4', dim: '210 × 297 mm' },
  legal:  { w: 816, h: 1344, label: 'Legal', dim: '8.5 × 14 in' },
};
const PAGE_MARGIN = 84;                       // default: 0.875in at 96dpi
function pageDims() { return PAGE_SIZES[App.doc?.pageSize] || PAGE_SIZES.letter; }
function pageMargin() { return (App.doc && App.doc.marginPx) || PAGE_MARGIN; }

/* Editable region helper — stored content wins over the generated default. */
function edRegion(key, defaultHTML, cls = '') {
  const stored = App.doc.content[key];
  return `<div class="ed ${cls}" data-key="${key}">${stored != null ? stored : defaultHTML}</div>`;
}

/* Editable section title — its own content key (`<id>.h`) so it survives
   library rebuilds (team/experience "Apply" only clears the body key).
   Admin-set titles (Workspace Settings → Blocks, per client type) win
   over the built-in default. */
function edTitle(b, text) {
  const t = (typeof Settings !== 'undefined' && Settings.data)
    ? Settings.blockTitle(b.type, App.doc.clientType) : null;
  return edRegion(b.id + '.h', `<h2 data-ph="Section heading">${t != null ? esc(t) : text}</h2>`);
}

/* Default body copy for a section — the admin's rewrite for this client
   type (with {{tokens}} merged) when one exists, else the built-in. */
function libBody(type, fallbackHTML) {
  const o = (typeof Settings !== 'undefined' && Settings.data)
    ? Settings.blockBody(type, App.doc.clientType) : null;
  return o != null ? o : fallbackHTML;
}

/* Blocks that should always start on / own a fresh page. */
const FULLPAGE_TYPES = ['cover', 'divider', 'blankpage', 'pdfpage'];
/* Blocks whose art must reach the page edges. Their sheet gets a .bleed
   class (see paginate) that removes the page padding and lifts the drop
   zones out of the flow — negative margins alone can't cancel those. */
const BLEED_TYPES = ['cover', 'pdfpage'];
const BREAK_BEFORE = ['cover', 'divider', 'pagebreak', 'blankpage', 'pdfpage'];
function blockBreaksBefore(b) {
  if (b.type === 'toc') return b.pageBreak !== false;
  return BREAK_BEFORE.includes(b.type) && b.type !== 'pagebreak';
}

function staffBioHTML(st, variant) {
  const tail = (st.bio[variant] || '').trim();
  return `<div class="bio-entry"><h4 class="bio-name">${esc(st.name)}, ${esc(st.role)}</h4><p>${esc(st.bio.base)}${tail ? ' ' + esc(tail) : ''}</p></div>`;
}

function caseHTML(cs) {
  return `<div class="case-entry">
<h4>${esc(cs.title)}</h4>
<p class="case-sub"><i>${esc(cs.sub)}</i></p>
<p><b>Measure Type:</b> ${esc(cs.type)}</p>
<p><b>Demographics:</b> ${esc(cs.demo)}</p>
<p><b>Scope of Work:</b> ${esc(cs.scope)}</p>
<p><b>Outcome:</b> ${esc(cs.outcome)}</p>
</div>`;
}

function casesFor(ct) {
  const hit = CASES.filter(c => c.tags.includes(ct));
  if (hit.length >= 3) return hit.slice(0, 3);
  const rest = CASES.filter(c => !c.tags.includes(ct));
  return [...hit, ...rest].slice(0, 3);
}

/* ---------- per-type renderers → inner HTML of .block-body ---------- */
const BlockRender = {
  cover(b) {
    const d = App.doc;
    const date = liveDateStr();
    /* the cover owns its margins — independent of the document's body margins */
    const cm = (b.marginPx != null) ? b.marginPx : 84;
    if (b.layout === 'custom') {
      const art = b.bgId ? AssetStore.bg(b.bgId) : null;
      return `<div class="cover-custom" style="${art ? `background-image:url(${art.src})` : ''}">
        ${art ? '' : `<div class="cover-custom-hint" contenteditable="false">${icon('image', 22)}<span>No cover art selected — open this block’s settings (gear) to upload or pick one.<br>For text on the cover, drop a floating text box from the toolbar.</span></div>`}
      </div>`;
    }
    if (b.layout === 'letterhead') {
      return `<div class="cover-fss">
        <img class="cover-fss-logo" src="assets/logo-horizontal-blue.png" alt="Fog Signal Strategies">
        ${edRegion(b.id + '.fssTitle', `<p class="cover-fss-kicker">Proposal For</p><h1 class="cover-fss-title">${esc(d.serviceTitle)}</h1>`, 'cover-fss-head')}
        <div class="cover-fss-spacer" contenteditable="false"></div>
        ${edRegion(b.id + '.fssMeta', `<div class="cfm-col"><p><b>Submitted to:</b><br>${esc(d.agency || '—')}</p></div><div class="cfm-col"><p><b>Submitted by:</b><br>Fog Signal Strategies Inc.</p><p><b>Date:</b> <span data-live-date>${date}</span></p></div>`, 'cover-fss-meta')}
      </div>`;
    }
    return `<div class="cover-page cover-bleed" style="padding:${cm}px">
      <img class="cover-logo" src="assets/logo-stacked-blue.png" alt="Fog Signal Strategies">
      ${edRegion(b.id + '.title', `<h1 class="cover-title">Proposal for ${esc(d.serviceTitle)}</h1>`, 'ed-center')}
      <div class="cover-rule"></div>
      ${edRegion(b.id + '.meta', `<p><b>Submitted to:</b><br>${esc(d.agency || '—')}</p><p><b>Submitted by:</b><br>Fog Signal Strategies</p><p><b>Date:</b> <span data-live-date>${date}</span></p>`, 'cover-meta ed-center')}
    </div>`;
  },
  coverLetter(b) {
    const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    return `<div class="letter">${edRegion(b.id, libBody('coverLetter', `<p>${esc(date)}</p>` + COPY.coverLetter(App.doc)))}</div>`;
  },
  divider(b) {
    return `<div class="divider-page">
      <div class="divider-eyebrow">Section ${b.num || ''}</div>
      ${edRegion(b.id, `<h1 class="divider-title">${esc(b.label || 'Section Title')}</h1>`, 'ed-center')}
      <div class="divider-beam"></div>
    </div>`;
  },
  about(b)    { return edTitle(b, 'About Fog Signal Strategies') + edRegion(b.id, libBody('about', COPY.about(App.doc.clientType))); },
  approach(b) { return edTitle(b, 'Our Approach') + edRegion(b.id, libBody('approach', COPY.approach())); },
  why(b)      { return edTitle(b, 'Why Measures Fail — and How We Fix It') + edRegion(b.id, libBody('why', COPY.why())); },
  understanding(b) { return edTitle(b, 'Project Understanding') + edRegion(b.id, libBody('understanding', COPY.understanding(App.doc))); },
  workplan(b) { return edTitle(b, 'Technical Approach &amp; Work Plan') + edRegion(b.id, libBody('workplan', COPY.workplan())); },
  schedule(b) { return edTitle(b, 'Preliminary Project Schedule') + edRegion(b.id, libBody('schedule', `<p>The preliminary schedule below provides a framework for the engagement. Specific dates for kickoff, deliverable reviews, and reporting cadence will be confirmed at the Stage 1 kickoff meeting.</p>` + COPY.schedule())); },
  terms(b)    { return edTitle(b, 'Additional Terms') + edRegion(b.id, libBody('terms', COPY.terms())); },
  exceptions(b) { return edTitle(b, 'Exceptions, Qualifications, or Exclusions') + edRegion(b.id, libBody('exceptions', `<p>Fog Signal Strategies takes no exceptions, qualifications, or exclusions to the requirements of ${esc(App.doc.rfpNumber || 'this RFP')}. We have reviewed the scope of work, contractual standard clauses, insurance requirements, submission instructions, and evaluation criteria, and we are prepared to comply fully with all stated requirements.</p>`)); },
  conclusion(b) { return edTitle(b, 'Conclusion') + edRegion(b.id, libBody('conclusion', COPY.conclusion(App.doc))); },

  team(b) {
    const sel = (b.staff || []).map(id => staffById(id)).filter(Boolean);
    const v = b.variant || App.doc.clientType;
    const body = sel.map(st => staffBioHTML(st, v)).join('') ||
      `<p class="placeholder-note">No staff selected — open this block’s settings (gear) to choose the team.</p>`;
    return edTitle(b, 'Project Team') + edRegion(b.id, body);
  },

  experience(b) {
    const list = (b.cases && b.cases.length ? b.cases.map(id => CASES.find(c => c.id === id)).filter(Boolean) : casesFor(App.doc.clientType));
    const intro = `<p>Provided below are recent examples of our ballot measure work for ${esc((CLIENTS[App.doc.clientType] || {}).label || 'public agencies').toLowerCase()} clients. We are happy to provide additional references and contact information upon request.</p>`;
    return edTitle(b, 'Relevant Experience') + edRegion(b.id, intro + list.map(caseHTML).join(''));
  },

  cost(b) {
    if (!b.cost) b.cost = defaultCostModel(App.doc.clientType);
    return edTitle(b, 'Cost Proposal') + renderCostBody(b);
  },

  toc(b) {
    return edRegion(b.id + '.title', `<h2>Table of Contents</h2>`) +
      `<div class="toc-list" contenteditable="false">${tocRowsHTML(b)}</div>`;
  },

  heading(b) {
    const rule = b.rule === false ? '--h2-rule-w:0;--h2-rule-pad:0'
      : (b.ruleColor ? `--h2-rule-c:${b.ruleColor}` : '');
    return `<div class="heading-scope"${rule ? ` style="${rule}"` : ''}>${edRegion(b.id, `<h2 data-ph="Section heading"></h2>`)}</div>`;
  },
  text(b)    { return edRegion(b.id, `<p data-ph="Start writing, or drop a pre-written block from the library…"></p>`); },
  quote(b)   { return edRegion(b.id, `<blockquote class="pullquote" data-ph="“A pull quote that earns attention.”"></blockquote>`); },
  twocol(b)  {
    return `<div class="twocol">${edRegion(b.id + '.l', `<p data-ph="Left column…"></p>`)}${edRegion(b.id + '.r', `<p data-ph="Right column…"></p>`)}</div>`;
  },
  image(b) {
    const w = b.width || 70;
    const align = b.align || 'center';
    const inner = b.src
      ? `<img src="${b.src}" style="width:100%" alt="">`
      : `<div class="img-placeholder">${icon('image', 26)}<span>Click to upload an image</span></div>`;
    return `<figure class="img-figure align-${align}" style="width:${w}%">
      <div class="img-frame" data-imgclick="${b.id}">${inner}
        ${b.src ? `<span class="img-resize" data-imgresize="${b.id}" contenteditable="false" title="Drag to resize"></span>` : ''}
      </div>
      ${edRegion(b.id + '.cap', `<figcaption data-ph="Add a caption (optional)"></figcaption>`)}
    </figure>`;
  },
  pagebreak() { return `<div class="pagebreak-line"><span>Page break</span></div>`; },
  pdfpage(b) {
    return `<div class="pdf-page" contenteditable="false">
      <img src="${b.src}" alt="${esc(b.fileName || 'Imported page')}" draggable="false">
      <span class="pdf-page-tag">${icon('doc', 11)} ${esc(b.fileName || 'PDF')} — ${b.pageNo}/${b.pageCount}</span>
    </div>`;
  },
  blankpage(b) {
    return `<div class="blank-page">${edRegion(b.id, `<p data-ph="A fresh page — write here, or drop blocks onto it."></p>`)}</div>`;
  },
  signature(b) {
    const st = staffById(b.staffId || 'carter') || staffAll()[0];
    const sig = SigStore.get(st.id);
    return `<div class="sig-block align-${b.align || 'left'}">
      ${sig
        ? `<img class="sig-img" src="${sig}" style="width:${b.width || 220}px" alt="Signature">`
        : `<div class="sig-placeholder" contenteditable="false" data-sigupload="${b.id}">${icon('image', 16)} Click to upload ${esc(st.name)}’s signature</div>`}
      <div class="sig-line" contenteditable="false" style="width:${b.width || 220}px"></div>
      ${edRegion(b.id, `<p class="sig-name"><b>${esc(st.name)}</b><br>${esc(st.role)}<br>Fog Signal Strategies</p>`)}
    </div>`;
  },
};

function renderBlockBody(b) {
  const fn = BlockRender[b.type];
  if (fn) return fn(b);
  /* Admin-created custom blocks: section title + pre-written body for
     this client type, both editable in place like any curated block. */
  const cb = (typeof Settings !== 'undefined' && Settings.data) ? Settings.customBlock(b.type) : null;
  if (cb) {
    const body = Settings.blockBody(b.type, App.doc.clientType) || `<p data-ph="Start writing…"></p>`;
    return edTitle(b, esc(cb.label)) + edRegion(b.id, body);
  }
  return `<p>Unknown block: ${esc(b.type)}</p>`;
}

/* ---------- table of contents ---------- */
/* Blocks eligible to appear as TOC entries. */
const TOC_SECTION_TYPES = ['coverLetter', 'divider', 'about', 'approach', 'why', 'understanding',
  'workplan', 'schedule', 'terms', 'exceptions', 'conclusion', 'team', 'experience', 'cost', 'heading'];

function tocCandidates() {
  const out = [];
  App.doc.blocks.forEach(bl => {
    const isCustom = typeof Settings !== 'undefined' && Settings.data && Settings.customBlock(bl.type);
    if (!TOC_SECTION_TYPES.includes(bl.type) && !isCustom) return;
    let label = catalogItem(bl.type).label;
    const el = blockEls.get(bl.id);
    if (el) {
      const h = el.querySelector('h1,h2,h3');
      if (h && h.textContent.trim()) label = h.textContent.trim();
    }
    if (bl.type === 'heading' && label === 'Heading') return;   // empty custom heading
    out.push({ bid: bl.id, label: label.slice(0, 64), lvl: bl.type === 'divider' ? 0 : 1 });
  });
  return out;
}

function tocRowsHTML(b) {
  const ex = b.excluded || [];
  const entries = tocCandidates().filter(c => !ex.includes(c.bid));
  if (!entries.length) return `<p class="placeholder-note">Sections appear here as the document grows.</p>`;
  return entries.map(en => {
    const pg = (typeof blockPageMap !== 'undefined' && blockPageMap.get(en.bid)) || '–';
    return `<div class="toc-row lvl${en.lvl}" data-goto="${en.bid}" title="Jump to section">
      <span class="toc-label">${esc(en.label)}</span>
      ${b.dots !== false ? '<span class="toc-dots"></span>' : ''}
      ${b.nums !== false ? `<span class="toc-pg">${pg}</span>` : ''}
    </div>`;
  }).join('');
}

/* Called after every repagination so numbers stay in sync. Returns true if anything changed. */
function updateTocBlocks() {
  let changed = false;
  App.doc.blocks.filter(b => b.type === 'toc').forEach(b => {
    const wrap = blockEls.get(b.id);
    if (!wrap) return;
    const list = wrap.querySelector('.toc-list');
    if (!list) return;
    const html = tocRowsHTML(b);
    if (list.innerHTML !== html) { list.innerHTML = html; changed = true; }
  });
  return changed;
}

/* ---------- block settings (gear) ---------- */
function blockHasSettings(type) {
  return ['team', 'cost', 'image', 'divider', 'experience', 'toc', 'cover', 'signature', 'heading'].includes(type);
}

function openBlockSettings(b, anchorEl) {
  if (b.type === 'cost') { openCostCalculator(b); return; }
  let body = '';
  if (b.type === 'team') body = teamSettingsHTML(b);
  if (b.type === 'image') body = imageSettingsHTML(b);
  if (b.type === 'divider') body = dividerSettingsHTML(b);
  if (b.type === 'experience') body = experienceSettingsHTML(b);
  if (b.type === 'toc') body = tocSettingsHTML(b);
  if (b.type === 'cover') body = coverSettingsHTML(b);
  if (b.type === 'signature') body = signatureSettingsHTML(b);
  if (b.type === 'heading') body = headingSettingsHTML(b);
  const card = popover(anchorEl, `
    <div class="pophead">${icon('gear', 15)}<b>${esc(catalogItem(b.type).label)} Settings</b>
      <button class="iconbtn close-pop" title="Close">${icon('x', 15)}</button></div>
    <div class="popbody" data-settings="${b.id}">${body}</div>`, { width: 320, maxHeight: '68vh' });
  card.querySelector('.close-pop').onclick = closePopovers;
  bindBlockSettings(card, b);
}

function teamSettingsHTML(b) {
  const variants = { school: 'School District', city: 'City / Municipal', county: 'County', fire: 'Fire / Public Safety', special: 'Special District', base: 'Standard (no tailoring)' };
  const sel = b.staff || [];
  return `
  <div class="set-label">Tailor bios to</div>
  <select class="set-input" data-set="variant">
    ${Object.entries(variants).map(([k, l]) => `<option value="${k}" ${(b.variant || 'base') === k ? 'selected' : ''}>${l}</option>`).join('')}
  </select>
  <div class="set-label">Include staff <span class="muted">(${sel.length})</span></div>
  <div class="staff-list">
    ${staffAll().map(st => `
      <label class="staff-row ${sel.includes(st.id) ? 'on' : ''}" data-staff="${st.id}">
        <span class="avatar" style="background:${st.color}">${st.initials}</span>
        <span class="staff-txt"><b>${esc(st.name)}</b><small>${esc(st.role)}</small></span>
        <span class="checkbox">${sel.includes(st.id) ? icon('check', 11, 3.2) : ''}</span>
      </label>`).join('')}
  </div>
  <button class="btn primary wide" data-act="applyTeam">Apply — regenerate bios</button>
  <p class="set-hint">Applying rebuilds this page from the bio library for the chosen client type. Manual edits to the current bios will be replaced.</p>`;
}

function imageSettingsHTML(b) {
  return `
  <div class="set-label">Width — ${b.width || 70}%</div>
  <input type="range" min="25" max="100" step="5" value="${b.width || 70}" class="set-input" data-set="width">
  <div class="set-label">Alignment</div>
  <div class="seg">
    ${['left', 'center', 'right'].map(a => `<button class="seg-btn ${(b.align || 'center') === a ? 'on' : ''}" data-align="${a}">${a[0].toUpperCase() + a.slice(1)}</button>`).join('')}
  </div>
  <button class="btn wide" data-act="replaceImage">${icon('image', 14)} ${b.src ? 'Replace image' : 'Upload image'}</button>
  ${b.src ? `<button class="btn wide" data-act="floatImage">${icon('drag', 14)} Float freely on the page</button>
  <p class="set-hint">Floating takes it out of the text flow — drag and resize it anywhere, like an Acrobat stamp. Tip: you can also drag the corner handle on the image itself to resize in place.</p>` : ''}`;
}

function dividerSettingsHTML(b) {
  return `
  <div class="set-label">Section number</div>
  <input type="number" class="set-input" data-set="num" value="${b.num || 1}" min="1" max="20">
  <p class="set-hint">The title text is edited directly on the page.</p>`;
}

function experienceSettingsHTML(b) {
  const sel = b.cases && b.cases.length ? b.cases : casesFor(App.doc.clientType).map(c => c.id);
  return `
  <div class="set-label">Case studies to include</div>
  <div class="staff-list">
    ${CASES.map(cs => `
      <label class="staff-row ${sel.includes(cs.id) ? 'on' : ''}" data-case="${cs.id}">
        <span class="staff-txt"><b>${esc(cs.title.split(',')[0])}</b><small>${esc(cs.sub)}</small></span>
        <span class="checkbox">${sel.includes(cs.id) ? icon('check', 11, 3.2) : ''}</span>
      </label>`).join('')}
  </div>
  <button class="btn primary wide" data-act="applyCases">Apply — rebuild section</button>
  <p class="set-hint">Case studies tagged “${esc((CLIENTS[App.doc.clientType] || {}).label || '')}” are suggested first in new documents.</p>`;
}

function tocSettingsHTML(b) {
  const ex = b.excluded || [];
  const cands = tocCandidates();
  return `
  <div class="set-label">Sections to feature</div>
  <div class="staff-list toc-picker">
    ${cands.map(c => `
      <label class="staff-row ${ex.includes(c.bid) ? '' : 'on'}" data-tocbid="${c.bid}">
        <span class="staff-txt"><b class="${c.lvl ? 'toc-pick-sub' : ''}">${esc(c.label)}</b><small>page ${(typeof blockPageMap !== 'undefined' && blockPageMap.get(c.bid)) || '–'}</small></span>
        <span class="checkbox">${ex.includes(c.bid) ? '' : icon('check', 11, 3.2)}</span>
      </label>`).join('')}
  </div>
  <div class="set-label">Appearance</div>
  <label class="set-toggle"><label class="switch"><input type="checkbox" data-tocset="nums" ${b.nums !== false ? 'checked' : ''}><span></span></label> Show page numbers</label>
  <label class="set-toggle"><label class="switch"><input type="checkbox" data-tocset="dots" ${b.dots !== false ? 'checked' : ''}><span></span></label> Dotted leader lines</label>
  <label class="set-toggle"><label class="switch"><input type="checkbox" data-tocset="pageBreak" ${b.pageBreak !== false ? 'checked' : ''}><span></span></label> Starts on its own page</label>
  <p class="set-hint">Entries and page numbers update automatically as sections move, grow, or shrink. Page numbers match the “Pages” settings in the toolbar.</p>`;
}

/* ---- cover page settings (layout templates + art library + text box) ---- */
function coverSettingsHTML(b) {
  const layout = b.layout || 'standard';
  const bgs = AssetStore.bgs();
  const cm = (b.marginPx != null) ? b.marginPx : 84;
  const tpls = (typeof Settings !== 'undefined' && Settings.data) ? Settings.coverTemplates() : [];
  return `
  ${tpls.length ? `<div class="set-label">Saved cover templates <span class="muted">— managed in Workspace Settings</span></div>
  <div class="ct-chips" style="margin-bottom:10px;flex-wrap:wrap">
    ${tpls.map(t => `<button class="ct-chip" data-cvtpl="${t.id}" title="Apply “${esc(t.name)}”">${esc(t.name)}</button>`).join('')}
  </div>` : ''}
  <div class="set-label">Layout</div>
  <div class="tpl-row" style="grid-template-columns:1fr 1fr 1fr">
    <button class="tpl-card ${layout === 'letterhead' ? 'on' : ''}" data-cvlayout="letterhead"><b>Letterhead</b><small>Navy sidebar, gold stripe & lockup</small></button>
    <button class="tpl-card ${layout === 'standard' ? 'on' : ''}" data-cvlayout="standard"><b>Standard</b><small>Centered firm lockup on white</small></button>
    <button class="tpl-card ${layout === 'custom' ? 'on' : ''}" data-cvlayout="custom"><b>Custom art</b><small>Your uploaded cover + a text box</small></button>
  </div>
  ${layout === 'letterhead' ? `<p class="set-hint">The firm letterhead cover — sidebar and stripe are drawn to fit any page size. Title and “Submitted to / by” text are edited directly on the page; the date re-stamps itself to today whenever the document is opened or exported.</p>` : ''}
  ${layout === 'standard' ? `
  <div class="set-label">Cover margins <span class="muted">— independent of body pages</span></div>
  <div class="seg">
    ${[['None', 0], ['Narrow', 48], ['Normal', 84], ['Wide', 120]].map(([l, px]) => `<button class="seg-btn ${cm === px ? 'on' : ''}" data-cvmargin="${px}">${l}</button>`).join('')}
  </div>
  <div class="pn-2col" style="margin-top:8px;grid-template-columns:1fr 84px;align-items:center">
    <span class="set-hint" style="margin:0">Custom (inches)</span>
    <input type="number" class="set-input slim" data-cvmargincustom value="${(cm / 96).toFixed(2)}" min="0" max="2" step="0.05" style="margin-bottom:0">
  </div>` : ''}
  ${layout === 'custom' ? `
  <div class="set-label">Cover art <span class="muted">— uploads stay in your library for reuse</span></div>
  <div class="bg-grid">
    ${bgs.map(g => `<button class="bg-thumb ${b.bgId === g.id ? 'on' : ''}" data-bgid="${g.id}" title="${esc(g.name)}" style="background-image:url(${g.src})"></button>`).join('')}
    <button class="bg-thumb add" data-act="uploadBg" title="Upload cover art">${icon('plus', 16)}</button>
  </div>
  <p class="set-hint">Upload art sized for the full page (portrait). For title text over the art, use the toolbar’s floating text box (${icon('textbox', 11)}) — drag it anywhere on the cover.</p>
  ` : layout === 'standard' ? `<p class="set-hint">Switch to “Custom art” to use an uploaded full-page cover design; add text over it with floating text boxes.</p>` : ''}`;
}

/* ---- signature settings ---- */
function signatureSettingsHTML(b) {
  const cur = b.staffId || 'carter';
  return `
  <div class="set-label">Signer</div>
  <select class="set-input" data-sigstaff>
    ${staffAll().map(s => `<option value="${s.id}" ${cur === s.id ? 'selected' : ''}>${esc(s.name)}${SigStore.get(s.id) ? ' ✓' : ''}</option>`).join('')}
  </select>
  <div class="set-label">Signature image ${SigStore.get(cur) ? '<span class="muted">— on file, auto-added</span>' : ''}</div>
  ${SigStore.get(cur) ? `<img src="${SigStore.get(cur)}" style="width:170px;display:block;margin:2px 0 8px;border:1px solid rgba(26,58,92,.14);border-radius:6px;padding:6px;background:#fff">` : ''}
  <button class="btn wide" data-act="uploadSig" style="margin-top:2px">${icon('image', 14)} ${SigStore.get(cur) ? 'Replace' : 'Upload'} signature (PNG)</button>
  <div class="set-label">Size — <span data-sigw>${b.width || 220}</span>px</div>
  <input type="range" min="120" max="360" step="10" value="${b.width || 220}" class="set-input" data-sigwidth>
  <div class="set-label">Alignment</div>
  <div class="seg">
    ${['left', 'center', 'right'].map(a => `<button class="seg-btn ${(b.align || 'left') === a ? 'on' : ''}" data-sigalign="${a}">${a[0].toUpperCase() + a.slice(1)}</button>`).join('')}
  </div>
  <button class="btn wide" data-act="stampSig">${icon('drag', 14)} Convert to floating stamp</button>
  <p class="set-hint">Signatures are stored once per person — every future signature block for them fills in automatically. A transparent PNG looks best. As a stamp it floats free of the text, Acrobat-style; pin it back any time.</p>`;
}

/* ---- heading settings (underline rule) ---- */
const HEADING_RULE_COLORS = [
  ['#EFC53F', 'Gold'], ['#B8932A', 'Gold 700'], ['#1A3A5C', 'Navy'],
  ['#0E2238', 'Navy 900'], ['#0F0F0F', 'Ink'], ['#D3D2C3', 'Bone'],
];
function headingSettingsHTML(b) {
  const on = b.rule !== false;
  const cur = (b.ruleColor || '#EFC53F').toLowerCase();
  return `
  <label class="set-toggle"><label class="switch"><input type="checkbox" data-hrule ${on ? 'checked' : ''}><span></span></label> Underline below heading</label>
  <div class="pn-controls ${on ? '' : 'disabled'}">
    <div class="set-label">Underline color</div>
    <div class="pn-colors">
      ${HEADING_RULE_COLORS.map(([c, l]) => `<button class="pn-swatch ${cur === c.toLowerCase() ? 'on' : ''}" data-hrulecolor="${c}" title="${l}" style="background:${c}"></button>`).join('')}
      <input type="color" class="pn-custom" data-hrulepick value="${b.ruleColor || '#EFC53F'}" title="Custom color">
    </div>
  </div>
  <p class="set-hint">Applies to this heading only — each heading block has its own setting. The heading text is edited directly on the page.</p>`;
}

function bindBlockSettings(card, b) {
  /* heading underline */
  const hRule = card.querySelector('[data-hrule]');
  if (hRule) hRule.addEventListener('change', () => {
    if (hRule.checked) delete b.rule; else b.rule = false;
    card.querySelector('.pn-controls').classList.toggle('disabled', !hRule.checked);
    refreshBlock(b); saveDoc();
  });
  card.querySelectorAll('[data-hrulecolor]').forEach(s => s.addEventListener('click', () => {
    b.ruleColor = s.dataset.hrulecolor;
    card.querySelectorAll('[data-hrulecolor]').forEach(x => x.classList.toggle('on', x === s));
    card.querySelector('[data-hrulepick]').value = b.ruleColor;
    refreshBlock(b); saveDoc();
  }));
  const hPick = card.querySelector('[data-hrulepick]');
  if (hPick) hPick.addEventListener('input', () => {
    b.ruleColor = hPick.value;
    card.querySelectorAll('[data-hrulecolor]').forEach(x => x.classList.remove('on'));
    refreshBlock(b); saveDoc();
  });
  /* cover */
  card.querySelectorAll('[data-cvtpl]').forEach(btn => btn.addEventListener('click', () => {
    const t = Settings.coverTemplates().find(x => x.id === btn.dataset.cvtpl);
    if (!t) return;
    b.layout = t.layout || 'standard';
    if (t.layout === 'custom') b.bgId = t.bgId || null;
    if (t.marginPx != null) b.marginPx = t.marginPx;
    refreshBlock(b); saveDoc(); closePopovers();
    openBlockSettings(b, blockEls.get(b.id)?.querySelector('[data-bact="settings"]') || document.body);
    toast(`Cover template “${t.name}” applied`);
  }));
  card.querySelectorAll('[data-cvlayout]').forEach(btn => btn.addEventListener('click', () => {
    b.layout = btn.dataset.cvlayout;
    refreshBlock(b); saveDoc(); closePopovers();
    openBlockSettings(b, blockEls.get(b.id)?.querySelector('[data-bact="settings"]') || document.body);
  }));
  const setCoverMargin = (px) => {
    b.marginPx = Math.max(0, Math.min(192, Math.round(px)));
    card.querySelectorAll('[data-cvmargin]').forEach(x => x.classList.toggle('on', parseInt(x.dataset.cvmargin) === b.marginPx));
    const ci = card.querySelector('[data-cvmargincustom]');
    if (ci) ci.value = (b.marginPx / 96).toFixed(2);
    refreshBlock(b); saveDoc();
  };
  card.querySelectorAll('[data-cvmargin]').forEach(btn => btn.addEventListener('click', () => setCoverMargin(parseInt(btn.dataset.cvmargin))));
  const cvCustom = card.querySelector('[data-cvmargincustom]');
  if (cvCustom) cvCustom.addEventListener('change', () => setCoverMargin((parseFloat(cvCustom.value) || 0) * 96));

  card.querySelectorAll('[data-bgid]').forEach(t => t.addEventListener('click', () => {
    b.bgId = t.dataset.bgid;
    card.querySelectorAll('[data-bgid]').forEach(x => x.classList.toggle('on', x === t));
    refreshBlock(b); saveDoc();
  }));
  const upBg = card.querySelector('[data-act="uploadBg"]');
  if (upBg) upBg.addEventListener('click', async () => {
    const f = await pickFile('image/*');
    if (!f) return;
    const src = await fileToDataURL(f, 1700);
    const g = AssetStore.addBg(f.name.replace(/\.\w+$/, ''), src);
    b.bgId = g.id;
    refreshBlock(b); saveDoc(); closePopovers();
    openBlockSettings(b, blockEls.get(b.id)?.querySelector('[data-bact="settings"]') || document.body);
    toast('Cover art added to your library');
  });
  /* signature */
  const sigStaff = card.querySelector('[data-sigstaff]');
  if (sigStaff) sigStaff.addEventListener('change', () => {
    b.staffId = sigStaff.value;
    delete App.doc.content[b.id];              // regenerate the name/title line
    refreshBlock(b); saveDoc(); closePopovers();
    openBlockSettings(b, blockEls.get(b.id)?.querySelector('[data-bact="settings"]') || document.body);
  });
  const upSig = card.querySelector('[data-act="uploadSig"]');
  if (upSig) upSig.addEventListener('click', () => { closePopovers(); uploadSignature(b); });
  const sigW = card.querySelector('[data-sigwidth]');
  if (sigW) sigW.addEventListener('input', () => {
    b.width = parseInt(sigW.value);
    card.querySelector('[data-sigw]').textContent = b.width;
    refreshBlock(b); saveDoc();
  });
  card.querySelectorAll('[data-sigalign]').forEach(btn => btn.addEventListener('click', () => {
    b.align = btn.dataset.sigalign;
    card.querySelectorAll('[data-sigalign]').forEach(x => x.classList.toggle('on', x === btn));
    refreshBlock(b); saveDoc();
  }));

  card.querySelectorAll('[data-tocbid]').forEach(row => row.addEventListener('click', (e) => {
    e.preventDefault();
    const bid = row.dataset.tocbid;
    b.excluded = b.excluded || [];
    b.excluded = b.excluded.includes(bid) ? b.excluded.filter(x => x !== bid) : [...b.excluded, bid];
    row.classList.toggle('on');
    row.querySelector('.checkbox').innerHTML = row.classList.contains('on') ? icon('check', 11, 3.2) : '';
    updateTocBlocks(); saveDoc(); scheduleAfterEdit();
  }));
  card.querySelectorAll('[data-tocset]').forEach(inp => inp.addEventListener('change', () => {
    b[inp.dataset.tocset] = inp.checked;
    if (inp.dataset.tocset === 'pageBreak') { saveDoc(); paginate(); }
    else { updateTocBlocks(); saveDoc(); scheduleAfterEdit(); }
  }));
  card.querySelectorAll('[data-staff]').forEach(row => row.addEventListener('click', (e) => {
    e.preventDefault();
    const id = row.dataset.staff;
    b.staff = b.staff || [];
    b.staff = b.staff.includes(id) ? b.staff.filter(x => x !== id) : [...b.staff, id];
    row.classList.toggle('on');
    row.querySelector('.checkbox').innerHTML = row.classList.contains('on') ? icon('check', 11, 3.2) : '';
  }));
  card.querySelectorAll('[data-case]').forEach(row => row.addEventListener('click', (e) => {
    e.preventDefault();
    const id = row.dataset.case;
    b.cases = b.cases && b.cases.length ? b.cases : casesFor(App.doc.clientType).map(c => c.id);
    b.cases = b.cases.includes(id) ? b.cases.filter(x => x !== id) : [...b.cases, id];
    row.classList.toggle('on');
    row.querySelector('.checkbox').innerHTML = row.classList.contains('on') ? icon('check', 11, 3.2) : '';
  }));
  const variant = card.querySelector('[data-set="variant"]');
  if (variant) variant.addEventListener('change', () => { b.variant = variant.value; });
  const num = card.querySelector('[data-set="num"]');
  if (num) num.addEventListener('input', () => { b.num = parseInt(num.value) || 1; refreshBlock(b); saveDoc(); });
  const width = card.querySelector('[data-set="width"]');
  if (width) width.addEventListener('input', () => {
    b.width = parseInt(width.value);
    card.querySelectorAll('.set-label')[0].textContent = `Width — ${b.width}%`;
    refreshBlock(b); saveDoc();
  });
  card.querySelectorAll('[data-align]').forEach(btn => btn.addEventListener('click', () => {
    b.align = btn.dataset.align;
    card.querySelectorAll('[data-align]').forEach(x => x.classList.toggle('on', x === btn));
    refreshBlock(b); saveDoc();
  }));
  const applyTeam = card.querySelector('[data-act="applyTeam"]');
  if (applyTeam) applyTeam.addEventListener('click', () => {
    delete App.doc.content[b.id];        // discard edits; regenerate from library
    refreshBlock(b); saveDoc(); closePopovers();
    toast('Team bios rebuilt for ' + ((CLIENTS[b.variant] || {}).label || 'standard') + ' tailoring');
  });
  const applyCases = card.querySelector('[data-act="applyCases"]');
  if (applyCases) applyCases.addEventListener('click', () => {
    delete App.doc.content[b.id];
    refreshBlock(b); saveDoc(); closePopovers();
    toast('Experience section rebuilt');
  });
  const replaceImg = card.querySelector('[data-act="replaceImage"]');
  if (replaceImg) replaceImg.addEventListener('click', () => { closePopovers(); pickImage(b); });
  const floatImg = card.querySelector('[data-act="floatImage"]');
  if (floatImg) floatImg.addEventListener('click', () => {
    closePopovers();
    const contentW = pageDims().w - 2 * pageMargin();
    const page = blockPageMap.get(b.id) || 1;
    addFloat('image', { src: b.src, w: Math.round(contentW * (b.width || 70) / 100), page });
    removeBlock(b.id);
  });
  const stampSig = card.querySelector('[data-act="stampSig"]');
  if (stampSig) stampSig.addEventListener('click', () => {
    closePopovers();
    const page = blockPageMap.get(b.id) || 1;
    addFloat('signature', { staffId: b.staffId || 'carter', w: b.width || 220, page });
    removeBlock(b.id);
  });
}

async function pickImage(b) {
  const f = await pickFile('image/*');
  if (!f) return;
  b.src = await fileToDataURL(f, 1600);
  refreshBlock(b); saveDoc(); toast('Image added');
}

async function uploadSignature(b) {
  const st = staffById(b.staffId || 'carter') || staffAll()[0];
  const f = await pickFile('image/png,image/jpeg,image/webp');
  if (!f) return;
  SigStore.set(st.id, await fileToDataURL(f, 700));
  // refresh every signature block for this person, in case there are several
  App.doc.blocks.filter(x => x.type === 'signature' && (x.staffId || 'carter') === st.id).forEach(x => refreshBlock(x));
  saveDoc();
  toast(`${st.name}’s signature saved — it auto-fills from now on`);
}
