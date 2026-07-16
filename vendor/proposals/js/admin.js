/* ============ Fog Signal Proposals — Workspace Settings (admin panel) ============
   Back-office for the sysadmin and their selected users: manage who has
   access, brand color palettes, uploaded fonts, the block library (types,
   titles, and per-client-type content), cover templates, document
   templates, and the cost calculator's pricing defaults.

   Everything edits Settings.data and funnels through Settings.save(),
   which mirrors to localStorage and PUTs to the server (live-synced to
   every open client over SSE).                                          */
'use strict';

const ADMIN_SECTIONS = [
  ['access',    'Users & Access',      'users',       'Choose which users can open this panel'],
  ['colors',    'Brand Colors',        'highlighter', 'Text & highlight palettes in the toolbar'],
  ['fonts',     'Fonts',               'textbox',     'Upload fonts for the editor & PDF export'],
  ['blocks',    'Blocks & Titles',     'blocks',      'Library blocks, titles & content per client type'],
  ['team',      'Team & Bios',         'users',       'Staff bios, tailored per client type'],
  ['covers',    'Cover Templates',     'image',       'Shared cover art & saved cover layouts'],
  ['templates', 'Document Templates',  'doc',         'What “New Proposal” can start from'],
  ['pricing',   'Pricing & Calculator','calc',        'Cost calculator defaults & suggested prices'],
  ['firm',      'Firm Context (AI)',   'bolt',        'Context Claude uses to draft & answer'],
];

function renderAdmin() {
  App.view = 'admin';
  App.doc = null;
  App.adminTab = App.adminTab || 'access';
  $('#app').innerHTML = `
  <div class="admin">
    <div class="topbar">
      <button class="btn ghost back" id="adminBack" title="Back to proposal workspace">${icon('back', 15)} Workspace</button>
      <img src="assets/logo-horizontal-blue.png" class="topbar-logo" alt="FSS">
      <div class="vr"></div>
      <div class="title-wrap">
        <div class="doc-title" style="cursor:default">Workspace Settings</div>
        <div class="title-meta"><span class="muted">Changes apply to every user and sync live</span></div>
      </div>
      <div class="flex1"></div>
      <span class="admin-role-tag">${Settings.isOwner() ? 'Sysadmin' : 'Selected user'}</span>
      <span class="avatar" style="background:${ME.color}" title="${esc(ME.name)}">${esc(ME.initials)}</span>
    </div>
    <div class="admin-row">
      <nav class="admin-nav">
        ${ADMIN_SECTIONS.map(([k, label, icn, sub]) => `
          <button class="admin-navbtn ${App.adminTab === k ? 'on' : ''}" data-atab="${k}">
            ${icon(icn, 15)}<span><b>${label}</b><small>${sub}</small></span>
          </button>`).join('')}
      </nav>
      <div class="admin-body" id="adminBody"></div>
    </div>
  </div>`;
  $('#adminBack').addEventListener('click', () => { location.hash = ''; });
  $$('.admin-navbtn').forEach(b => b.addEventListener('click', () => {
    App.adminTab = b.dataset.atab;
    $$('.admin-navbtn').forEach(x => x.classList.toggle('on', x === b));
    renderAdminBody();
  }));
  renderAdminBody();
}

function renderAdminBody() {
  const host = $('#adminBody');
  if (!host) return;
  host.scrollTop = 0;
  ({
    access: adminAccessSection,
    colors: adminColorsSection,
    fonts: adminFontsSection,
    blocks: adminBlocksSection,
    team: adminTeamSection,
    covers: adminCoversSection,
    templates: adminTemplatesSection,
    pricing: adminPricingSection,
    firm: adminFirmSection,
  }[App.adminTab] || adminAccessSection)(host);
}

function adminHead(title, sub) {
  return `<div class="admin-sec-head"><h2>${title}</h2><p>${sub}</p></div>`;
}

/* =================== USERS & ACCESS =================== */
function adminAccessSection(host) {
  const S = Settings.data;
  const canEdit = Settings.isOwner();
  host.innerHTML = `
  ${adminHead('Users & Access', 'The system administrator chooses who can open Workspace Settings. Selected users get the full panel — everyone else only sees the proposal workspace. Accounts sync from the FSS dashboard user directory once connected.')}
  <div class="admin-card">
    ${USERS.map(u => {
      const owner = Settings.isOwner(u.id);
      const on = Settings.isAdmin(u.id);
      return `<div class="admin-user-row">
        <span class="avatar" style="background:${u.color}">${esc(u.initials)}</span>
        <span class="staff-txt"><b>${esc(u.name)}${u.id === ME.id ? ' (you)' : ''}</b>
          <small>${owner ? 'System administrator — always has access' : (on ? 'Selected user — can edit workspace settings' : 'Workspace only')}</small></span>
        ${owner
          ? `<span class="admin-role-tag">Sysadmin</span>`
          : `<label class="switch" title="${canEdit ? 'Allow this user to edit workspace settings' : 'Only the sysadmin can change access'}">
              <input type="checkbox" data-uadmin="${u.id}" ${on ? 'checked' : ''} ${canEdit ? '' : 'disabled'}><span></span></label>`}
      </div>`;
    }).join('')}
  </div>
  <p class="set-hint">${canEdit ? 'Toggles save instantly and apply the next time that user loads the workspace.' : 'You have settings access as a selected user. Only the sysadmin can change who is selected.'}</p>`;

  host.querySelectorAll('[data-uadmin]').forEach(t => t.addEventListener('change', () => {
    const id = t.dataset.uadmin;
    const list = S.access.admins || (S.access.admins = []);
    S.access.admins = t.checked ? [...new Set([...list, id])] : list.filter(x => x !== id);
    Settings.save();
    const u = USERS.find(x => x.id === id);
    toast(t.checked ? `${u.name} can now edit workspace settings` : `${u.name}’s settings access removed`);
    adminAccessSection(host);
  }));
}

/* =================== BRAND COLORS =================== */
function adminColorsSection(host) {
  const S = Settings.data;
  const paletteEditor = (key, title, sub, builtin) => {
    const custom = S.colors[key];
    const palette = (custom && custom.length) ? custom : builtin;
    return `
    <div class="admin-card" data-palette="${key}">
      <div class="admin-card-h"><b>${title}</b><small>${sub}</small>
        <span class="flex1"></span>
        ${custom ? `<button class="btn tiny" data-act="reset">Reset to brand defaults</button>` : `<span class="muted" style="font-size:12px">Brand defaults</span>`}
        <button class="btn tiny" data-act="add">${icon('plus', 12)} Add color</button>
      </div>
      <div class="admin-color-list">
        ${palette.map(([c, n], i) => `
        <div class="admin-color-row" data-ci="${i}">
          <input type="color" class="pn-custom" data-f="hex" value="${c === 'transparent' ? '#ffffff' : esc(c)}" ${c === 'transparent' ? 'disabled title="The “None” swatch clears the highlight"' : ''}>
          <input class="set-input slim" data-f="name" value="${esc(n)}" placeholder="Color name">
          <code class="admin-hex">${esc(c)}</code>
          <button class="iconbtn danger" data-act="del" title="Remove color">${icon('trash', 13)}</button>
        </div>`).join('')}
      </div>
    </div>`;
  };

  host.innerHTML = `
  ${adminHead('Brand Colors', 'These palettes are what every user sees in the toolbar’s text-color and highlight pickers. Changes don’t touch colors already applied in documents.')}
  ${paletteEditor('text', 'Text colors', 'Toolbar “A” color picker', BRAND_TEXT_COLORS)}
  ${paletteEditor('highlight', 'Highlight colors', 'Toolbar highlighter picker', BRAND_HIGHLIGHT_COLORS)}`;

  host.querySelectorAll('[data-palette]').forEach(card => {
    const key = card.dataset.palette;
    const builtin = key === 'text' ? BRAND_TEXT_COLORS : BRAND_HIGHLIGHT_COLORS;
    /* first edit forks the built-in palette into settings */
    const work = () => (S.colors[key] && S.colors[key].length) ? S.colors[key]
      : (S.colors[key] = builtin.map(x => [...x]));
    card.querySelectorAll('.admin-color-row').forEach(row => {
      const i = parseInt(row.dataset.ci);
      const hex = row.querySelector('[data-f="hex"]');
      hex.addEventListener('input', () => {
        work()[i][0] = hex.value;
        row.querySelector('.admin-hex').textContent = hex.value;
        Settings.save();
      });
      row.querySelector('[data-f="name"]').addEventListener('change', (e) => {
        work()[i][1] = e.target.value.trim() || 'Color';
        Settings.save();
      });
      row.querySelector('[data-act="del"]').addEventListener('click', () => {
        work().splice(i, 1);
        Settings.save(); adminColorsSection(host);
      });
    });
    card.querySelector('[data-act="add"]').addEventListener('click', () => {
      work().push(['#1A3A5C', 'New color']);
      Settings.save(); adminColorsSection(host);
    });
    const reset = card.querySelector('[data-act="reset"]');
    if (reset) reset.addEventListener('click', () => {
      S.colors[key] = null;
      Settings.save(); adminColorsSection(host);
      toast('Palette reset to the brand defaults');
    });
  });
}

/* =================== FONTS =================== */
function adminFontsSection(host) {
  const S = Settings.data;
  host.innerHTML = `
  ${adminHead('Fonts', 'Uploaded fonts appear in every user’s toolbar font menu and render in the editor and PDF export. Word export falls back to the reader’s installed fonts.')}
  <div class="admin-card">
    <div class="admin-card-h"><b>Uploaded fonts</b><small>.ttf, .otf, .woff, .woff2 — stored in the shared workspace</small>
      <span class="flex1"></span>
      <button class="btn tiny primary" id="fontUpload">${icon('upload', 12)} Upload font</button>
    </div>
    ${S.fonts.length ? S.fonts.map(f => `
    <div class="admin-font-row" data-fid="${f.id}">
      <div class="admin-font-preview" style="font-family:'${esc(f.family)}'">Voters want to understand the why, the what &amp; the cost — AaBbGg 0123</div>
      <div class="admin-font-meta">
        <input class="set-input slim" data-f="name" value="${esc(f.name)}" title="Display name in the font menu">
        <span class="muted">${esc(f.format)}</span>
        <button class="iconbtn danger" data-act="del" title="Remove font">${icon('trash', 13)}</button>
      </div>
    </div>`).join('') : `<p class="set-hint" style="margin:8px 2px">No fonts uploaded yet. The built-ins (Arial, Baskerville, Calibri, Source Sans) are always available.</p>`}
  </div>`;

  $('#fontUpload').addEventListener('click', async () => {
    const f = await pickFile('.ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2');
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) { toast('Font is too large (4 MB max) — try a .woff2 version'); return; }
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    const format = { ttf: 'truetype', otf: 'opentype', woff: 'woff', woff2: 'woff2' }[ext];
    if (!format) { toast('Unsupported font format — use .ttf, .otf, .woff, or .woff2'); return; }
    const dataUrl = await new Promise(res => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.readAsDataURL(f);
    });
    const name = f.name.replace(/\.\w+$/, '').replace(/[-_]+/g, ' ').trim() || 'Custom font';
    S.fonts.push({ id: uid('font'), name, family: 'FSS ' + name, format, dataUrl });
    Settings.save();
    adminFontsSection(host);
    toast(`“${name}” uploaded — it’s in everyone’s font menu now`);
  });

  host.querySelectorAll('.admin-font-row').forEach(row => {
    const f = S.fonts.find(x => x.id === row.dataset.fid);
    row.querySelector('[data-f="name"]').addEventListener('change', (e) => {
      f.name = e.target.value.trim() || f.name;
      Settings.save();
    });
    row.querySelector('[data-act="del"]').addEventListener('click', () => {
      S.fonts = S.fonts.filter(x => x !== f);
      Settings.save(); adminFontsSection(host);
      toast('Font removed — text already using it falls back to system fonts');
    });
  });
}

/* =================== BLOCKS & TITLES =================== */
const ADMIN_CT_TABS = [['base', 'All types'], ...CLIENT_KEYS.map(k => [k, CLIENTS[k].short])];
/* One color per client type — the same dot marks a tailored version
   everywhere (block list, chips, team bios). */
const CT_DOT = { school: '#B8932A', city: '#3F6A99', county: '#1A3A5C', fire: '#A8341E', special: '#2F6B4F' };

const ctDotsHTML = (keys) =>
  keys.map(k => `<i class="vdot" style="background:${CT_DOT[k]}" title="Has a ${CLIENTS[k].label} version"></i>`).join('');

/* Built-in default body copy, with {{tokens}} where the block uses doc fields. */
function builtinBodyDefault(type, ct) {
  const c = ct === 'base' ? 'county' : ct;
  const tokenDoc = { agency: '{{agency}}', rfpNumber: '{{rfpNumber}}', serviceTitle: '{{serviceTitle}}', clientType: c };
  switch (type) {
    case 'about': return COPY.about(ct === 'base' ? '' : ct);
    case 'approach': return COPY.approach();
    case 'why': return COPY.why();
    case 'understanding': return COPY.understanding(tokenDoc);
    case 'workplan': return COPY.workplan();
    case 'schedule': return COPY.schedule();
    case 'terms': return COPY.terms();
    case 'conclusion': return COPY.conclusion(tokenDoc);
    case 'coverLetter': return `<p>{{date}}</p>` + COPY.coverLetter(tokenDoc);
    case 'exceptions': return `<p>Fog Signal Strategies takes no exceptions, qualifications, or exclusions to the requirements of {{rfpNumber}}. We have reviewed the scope of work, contractual standard clauses, insurance requirements, submission instructions, and evaluation criteria, and we are prepared to comply fully with all stated requirements.</p>`;
    default: return '';
  }
}

/* Client types that have their own version of this block (title or body). */
function blockVersionsOf(type) {
  const S = Settings.data;
  const cb = Settings.customBlock(type);
  const titles = S.blockTitles[type] || {};
  const content = cb ? (cb.content || {}) : (S.blockContent[type] || {});
  const has = (m, k) => !!(m[k] && String(m[k]).trim());
  return CLIENT_KEYS.filter(k => has(titles, k) || has(content, k));
}

function adminBlocksSection(host) {
  const S = Settings.data;
  const groups = Settings.catalog(true);
  const flat = groups.flatMap(g => g.items);
  if (!App.adminBlockOpen || !flat.some(it => it.type === App.adminBlockOpen))
    App.adminBlockOpen = (flat.find(it => CONTENT_TYPES.includes(it.type)) || flat[0]).type;
  const sel = flat.find(it => it.type === App.adminBlockOpen);
  const q = (App.adminBlockFilter || '').trim().toLowerCase();
  const match = (it) => !q || it.label.toLowerCase().includes(q) || (it.desc || '').toLowerCase().includes(q);

  const li = (it) => `
    <button class="admin-bitem ${it.type === sel.type ? 'on' : ''} ${it.hidden ? 'is-hidden' : ''}" data-bsel="${esc(it.type)}">
      <span class="admin-bitem-txt"><b>${esc(it.label)}</b>
        ${it.custom || it.hidden ? `<small>${[it.custom ? 'Custom block' : '', it.hidden ? 'Hidden' : ''].filter(Boolean).join(' · ')}</small>` : ''}</span>
      <span class="vdots" data-vdots="${esc(it.type)}">${ctDotsHTML(blockVersionsOf(it.type))}</span>
    </button>`;

  host.innerHTML = `
  ${adminHead('Blocks & Titles', 'Every block has one “All types” version that serves all five client types. Where the pitch should differ — a school district vs. a fire district — give the block a tailored version for just that type; the dots mark where one exists. Documents already written keep their text; new blocks drop in with yours.')}
  <div class="admin-split">
    <div class="admin-split-list">
      <div class="admin-bsearch">${icon('search', 13)}<input id="blockFilter" placeholder="Find a block…" value="${esc(App.adminBlockFilter || '')}"></div>
      ${groups.map(g => {
        const items = g.items.filter(match);
        return items.length ? `<div class="admin-bgroup">${esc(g.cat)}</div>${items.map(li).join('')}` : '';
      }).join('')}
      <button class="btn tiny admin-list-add" id="newBlockBtn">${icon('plus', 12)} New custom block</button>
    </div>
    <div class="admin-split-editor">${adminBlockEditor(sel)}</div>
  </div>`;

  const filter = $('#blockFilter');
  filter.addEventListener('input', () => {
    App.adminBlockFilter = filter.value;
    adminBlocksSection(host);
    const f = $('#blockFilter');
    f.focus();
    f.setSelectionRange(f.value.length, f.value.length);
  });

  $('#newBlockBtn').addEventListener('click', () => {
    const cb = {
      type: uid('custom'), label: 'New Custom Block', desc: 'Pre-written content block',
      cat: 'Content', curated: false,
      content: { base: '<p>Write the default content for this block here…</p>' },
    };
    (S.customBlocks = S.customBlocks || []).push(cb);
    App.adminBlockOpen = cb.type;
    App.adminBlockTab = 'base';
    App.adminBlockFilter = '';
    Settings.save(); adminBlocksSection(host);
    toast('Custom block created — name it and write its content');
  });

  host.querySelectorAll('[data-bsel]').forEach(b => b.addEventListener('click', () => {
    App.adminBlockOpen = b.dataset.bsel;
    adminBlocksSection(host);
  }));

  bindAdminBlockEditor(host, sel);
}

/* The right-hand editor for one block: identity & flags up top, then its
   “All types” version and tailored per-client-type versions. */
function adminBlockEditor(it) {
  const S = Settings.data;
  const type = it.type;
  const cb = Settings.customBlock(type);
  const ct = App.adminBlockTab || 'base';
  const isBase = ct === 'base';
  const ctLabel = isBase ? '' : CLIENTS[ct].label;
  const titles = S.blockTitles[type] || {};
  const hasTitle = !!(cb || DEFAULT_TITLES[type]);
  const hasBody = !!(cb || CONTENT_TYPES.includes(type));
  const bodyMap = cb ? (cb.content || {}) : (S.blockContent[type] || {});
  const versions = blockVersionsOf(type);
  const defTitle = DEFAULT_TITLES[type] || it.label;

  const head = `
  <div class="admin-bed-head">
    <input class="set-input admin-bed-name" data-f="label" value="${esc(it.label)}" title="Block name shown in the library">
    <div class="admin-bed-meta">
      <input class="set-input slim admin-bed-desc" data-f="desc" value="${esc(it.desc || '')}" placeholder="One-line description shown in the library">
      <label class="admin-flag" title="Curated blocks are suggested first for every client type"><input type="checkbox" data-f="curated" ${it.curated ? 'checked' : ''}>Curated</label>
      ${cb
        ? `<select class="set-input slim" data-f="cat" title="Library category" style="width:128px;margin:0">${CATALOG.map(g => `<option ${cb.cat === g.cat ? 'selected' : ''}>${esc(g.cat)}</option>`).join('')}</select>
          <button class="iconbtn danger" data-act="delCustom" title="Delete this custom block">${icon('trash', 13)}</button>`
        : `<label class="admin-flag" title="Hidden blocks disappear from the library (existing documents keep theirs)"><input type="checkbox" data-f="hidden" ${it.hidden ? 'checked' : ''}>Hidden</label>`}
    </div>
  </div>`;

  if (!hasTitle && !hasBody) {
    return head + `<p class="set-hint" style="margin-top:14px">This block builds its page from its own on-page settings (the gear on the block in a document) — there’s no pre-written title or copy to manage here.</p>`;
  }

  const chip = ([k, l]) => {
    const has = k === 'base' || versions.includes(k);
    return `<button class="vchip ${ct === k ? 'on' : ''}" data-cttab="${k}" title="${k === 'base' ? 'The version every client type starts from' : (has ? CLIENTS[k].label + ' has its own tailored version' : CLIENTS[k].label + ' uses the “All types” version')}">
      <i class="vdot ${has ? '' : 'off'}" style="background:${k === 'base' ? 'var(--fs-navy)' : CT_DOT[k]}"></i>${l}</button>`;
  };

  /* what this client type would render today if no tailored body exists */
  const effBase = (bodyMap.base && bodyMap.base.trim()) ? bodyMap.base : (cb ? '' : builtinBodyDefault(type, ct));
  const ownBody = !isBase && !!(bodyMap[ct] && bodyMap[ct].trim());

  let panel = '';
  if (hasTitle) {
    panel += `
    <div class="set-label">Section title ${isBase ? '' : `<span class="muted">— in ${ctLabel} proposals; empty falls back to “All types”</span>`}</div>
    <input class="set-input" data-btitle placeholder="${esc(isBase ? defTitle : ((titles.base || '').trim() || defTitle))}" value="${esc(titles[ct] || '')}">`;
  }
  if (hasBody && (isBase || ownBody)) {
    panel += `
    <div class="set-label">Default content ${isBase ? '' : `<span class="muted">— replaces the “All types” copy in ${ctLabel} proposals</span>`}</div>
    <div class="admin-richtext" contenteditable="true" data-bbody spellcheck="false">${isBase ? (bodyMap.base || (cb ? '' : builtinBodyDefault(type, 'base'))) : bodyMap[ct]}</div>
    <div class="admin-editor-foot">
      <span class="set-hint" style="margin:0">Merge tags: <code>{{agency}}</code> <code>{{rfpNumber}}</code> <code>{{serviceTitle}}</code> <code>{{clientLabel}}</code> <code>{{date}}</code></span>
      <span class="flex1"></span>
      <span class="admin-savestate" data-savestate>All changes saved</span>
      ${isBase
        ? (!cb ? `<button class="btn tiny" data-act="revertBody" title="Discard the rewrite and use the built-in copy" ${bodyMap.base ? '' : 'style="display:none"'}>Revert to built-in</button>` : '')
        : `<button class="btn tiny" data-act="removeVersion" title="Drop this tailored version — ${esc(ctLabel)} proposals go back to the “All types” copy">Remove this version</button>`}
    </div>`;
  } else if (hasBody) {
    panel += `
    <div class="set-label">Default content</div>
    <div class="admin-inherit">
      <p><b>${esc(ctLabel)}</b> proposals currently use the “All types” version:</p>
      <div class="admin-richtext ghost" contenteditable="false">${effBase || '<p>No content yet — write the “All types” version first.</p>'}</div>
      <button class="btn tiny primary" data-act="makeVersion">${icon('plus', 12)} Create a ${esc(ctLabel)} version</button>
      <span class="set-hint" style="margin:0 0 0 10px">Starts as a copy — rewrite what should differ.</span>
    </div>`;
  } else {
    panel += `<p class="set-hint">This block’s body is generated from its own settings — only the title varies by client type.</p>
    <div class="admin-editor-foot"><span class="flex1"></span><span class="admin-savestate" data-savestate>All changes saved</span></div>`;
  }

  return head + `
  <div class="admin-bed-versions">
    <div class="set-label" style="margin-top:0">Versions <span class="muted">— one “All types” version, plus tailored ones where the pitch differs</span></div>
    <div class="vchips">${ADMIN_CT_TABS.map(chip).join('')}</div>
    ${panel}
  </div>`;
}

function bindAdminBlockEditor(host, it) {
  const S = Settings.data;
  const type = it.type;
  const cb = Settings.customBlock(type);
  const ct = App.adminBlockTab || 'base';
  const ed = host.querySelector('.admin-split-editor');
  if (!ed) return;

  const ss = ed.querySelector('[data-savestate]');
  let ssTimer = null;
  const flashSaved = () => {
    if (!ss) return;
    ss.textContent = 'Saved ✓'; ss.classList.add('on');
    clearTimeout(ssTimer);
    ssTimer = setTimeout(() => { ss.textContent = 'All changes saved'; ss.classList.remove('on'); }, 1800);
  };
  const refreshDots = () => {
    const el = host.querySelector(`[data-vdots="${CSS.escape(type)}"]`);
    if (el) el.innerHTML = ctDotsHTML(blockVersionsOf(type));
  };

  /* identity & flags — save on change */
  const ov = () => S.blockOverrides[type] || (S.blockOverrides[type] = {});
  ed.querySelectorAll('.admin-bed-head [data-f]').forEach(inp => inp.addEventListener('change', () => {
    const f = inp.dataset.f;
    const v = inp.type === 'checkbox' ? inp.checked : inp.value.trim();
    if (cb) cb[f] = v; else ov()[f] = v;
    Settings.save();
    if (f === 'label' || f === 'hidden' || f === 'cat') adminBlocksSection(host); else flashSaved();
  }));
  const delC = ed.querySelector('[data-act="delCustom"]');
  if (delC) delC.addEventListener('click', () => {
    S.customBlocks = S.customBlocks.filter(x => x.type !== type);
    delete S.blockTitles[type];
    App.adminBlockOpen = null;
    Settings.save(); adminBlocksSection(host);
    toast('Custom block deleted — copies already placed in documents remain editable');
  });

  /* version tabs */
  ed.querySelectorAll('[data-cttab]').forEach(t => t.addEventListener('click', () => {
    App.adminBlockTab = t.dataset.cttab;
    adminBlocksSection(host);
  }));

  /* section title — autosaves on change */
  const titleInp = ed.querySelector('[data-btitle]');
  if (titleInp) titleInp.addEventListener('change', () => {
    const m = S.blockTitles[type] || (S.blockTitles[type] = {});
    m[ct] = titleInp.value.trim();
    if (!m[ct]) delete m[ct];
    if (!Object.keys(m).length) delete S.blockTitles[type];
    Settings.save(); refreshDots(); flashSaved();
  });

  /* body — autosaves as you type */
  const bodyMapRef = () => cb ? (cb.content = cb.content || {}) : (S.blockContent[type] = S.blockContent[type] || {});
  const body = ed.querySelector('[data-bbody]');
  if (body) {
    const saveBody = debounce(() => {
      bodyMapRef()[ct] = body.innerHTML.trim();
      Settings.save(); refreshDots(); flashSaved();
      const revertBtn = ed.querySelector('[data-act="revertBody"]');
      if (revertBtn) revertBtn.style.display = '';
    }, 800);
    body.addEventListener('input', () => {
      if (ss) { ss.textContent = 'Saving…'; ss.classList.remove('on'); }
      saveBody();
    });
  }

  const mkV = ed.querySelector('[data-act="makeVersion"]');
  if (mkV) mkV.addEventListener('click', () => {
    const m = bodyMapRef();
    m[ct] = (m.base && m.base.trim()) ? m.base : (cb ? '<p></p>' : builtinBodyDefault(type, ct));
    Settings.save(); adminBlocksSection(host);
    toast(`${CLIENTS[ct].label} now has its own version — rewrite it freely`);
  });
  const rmV = ed.querySelector('[data-act="removeVersion"]');
  if (rmV) rmV.addEventListener('click', () => {
    const m = cb ? (cb.content || {}) : (S.blockContent[type] || {});
    delete m[ct];
    if (!cb && S.blockContent[type] && !Object.keys(S.blockContent[type]).length) delete S.blockContent[type];
    if (S.blockTitles[type]) {
      delete S.blockTitles[type][ct];
      if (!Object.keys(S.blockTitles[type]).length) delete S.blockTitles[type];
    }
    Settings.save(); adminBlocksSection(host);
    toast(`${CLIENTS[ct].label} proposals now use the “All types” version`);
  });
  const revert = ed.querySelector('[data-act="revertBody"]');
  if (revert) revert.addEventListener('click', () => {
    if (S.blockContent[type]) {
      delete S.blockContent[type].base;
      if (!Object.keys(S.blockContent[type]).length) delete S.blockContent[type];
    }
    Settings.save(); adminBlocksSection(host);
    toast('Reverted to the built-in copy');
  });
}

/* =================== TEAM & BIOS =================== */
function bioPreviewHTML(s, ct) {
  const tail = ct !== 'base' ? (s.bio[ct] || '').trim() : '';
  const base = (s.bio.base || '').trim();
  return `<h4>${esc(s.name)}, ${esc(s.role)}</h4>
  <p>${base ? esc(base) : '<i class="muted">No core bio yet.</i>'}${tail ? ' <mark>' + esc(tail) + '</mark>' : ''}</p>`;
}

function adminTeamSection(host) {
  const S = Settings.data;
  const list = Settings.staffList();
  if (!App.adminStaffSel || !list.some(s => s.id === App.adminStaffSel)) App.adminStaffSel = list[0].id;
  const sel = list.find(s => s.id === App.adminStaffSel);
  const ct = App.adminStaffTab || (App.adminStaffTab = 'base');
  const isBase = ct === 'base';
  const isCustom = (S.customStaff || []).some(c => c.id === sel.id);
  const tails = CLIENT_KEYS.filter(k => (sel.bio[k] || '').trim());
  const edited = !isCustom && S.staff[sel.id] && Object.keys(S.staff[sel.id]).length;

  const li = (s) => `
    <button class="admin-bitem ${s.id === sel.id ? 'on' : ''}" data-ssel="${s.id}">
      <span class="avatar sm" style="background:${s.color}">${esc(s.initials)}</span>
      <span class="admin-bitem-txt"><b>${esc(s.name)}</b><small>${esc(s.role)}</small></span>
      <span class="vdots" data-svdots="${s.id}">${ctDotsHTML(CLIENT_KEYS.filter(k => (s.bio[k] || '').trim()))}</span>
    </button>`;

  const chip = ([k, l]) => {
    const has = k === 'base' || tails.includes(k);
    return `<button class="vchip ${ct === k ? 'on' : ''}" data-cttab="${k}" title="${k === 'base' ? 'The bio every proposal starts with' : (has ? CLIENTS[k].label + ' proposals add tailored sentences' : 'No ' + CLIENTS[k].label + ' tailoring yet — the core bio runs as-is')}">
      <i class="vdot ${has ? '' : 'off'}" style="background:${k === 'base' ? 'var(--fs-navy)' : CT_DOT[k]}"></i>${l}</button>`;
  };

  host.innerHTML = `
  ${adminHead('Team & Bios', 'The bio library behind every “Team Bios” page. Each person has one core bio; where a client type deserves a different pitch, add tailoring sentences that are appended after the core bio in that type’s proposals. Dots mark tailored types. Team pages already placed in documents keep their text until someone hits “Apply — regenerate bios”.')}
  <div class="admin-split">
    <div class="admin-split-list">
      ${list.map(li).join('')}
      <button class="btn tiny admin-list-add" id="addStaffBtn">${icon('plus', 12)} Add team member</button>
    </div>
    <div class="admin-split-editor">
      <div class="admin-bed-head">
        <input class="set-input admin-bed-name" data-sf="name" value="${esc(sel.name)}" title="Name as it appears in proposals">
        <div class="admin-bed-meta">
          <input class="set-input slim admin-bed-desc" data-sf="role" value="${esc(sel.role)}" placeholder="Role / title shown after the name">
          ${isCustom
            ? `<button class="iconbtn danger" data-act="delStaff" title="Remove this team member">${icon('trash', 13)}</button>`
            : `<button class="btn tiny" data-act="resetStaff" title="Discard all edits and go back to the built-in bio" ${edited ? '' : 'style="display:none"'}>Reset to built-in</button>`}
        </div>
      </div>
      <div class="admin-bed-versions">
        <div class="set-label" style="margin-top:0">Bio versions <span class="muted">— one core bio, plus tailoring per client type where it helps</span></div>
        <div class="vchips">${ADMIN_CT_TABS.map(chip).join('')}</div>
        ${isBase ? `
        <div class="set-label">Core bio <span class="muted">— appears in every proposal</span></div>
        <textarea class="set-input admin-bio-text" data-bio="base" rows="6" placeholder="Background, credentials, track record…">${esc(sel.bio.base || '')}</textarea>` : `
        <div class="set-label">${esc(CLIENTS[ct].label)} tailoring <span class="muted">— appended after the core bio in ${esc(CLIENTS[ct].short)} proposals; empty runs the core bio as-is</span></div>
        <textarea class="set-input admin-bio-text" data-bio="${ct}" rows="3" placeholder="e.g. “${esc(sel.name.split(' ')[0])} brings direct ${esc(CLIENTS[ct].label.toLowerCase())} experience…”">${esc(sel.bio[ct] || '')}</textarea>`}
        <div class="admin-editor-foot">
          <span class="set-hint" style="margin:0">Hourly rates live under <b>Pricing &amp; Calculator</b>.</span>
          <span class="flex1"></span>
          <span class="admin-savestate" data-savestate>All changes saved</span>
        </div>
        <div class="set-label">How it reads${isBase ? '' : ` in a ${esc(CLIENTS[ct].label)} proposal <span class="muted">— tailoring highlighted</span>`}</div>
        <div class="admin-bio-preview" data-biopreview>${bioPreviewHTML(sel, ct)}</div>
      </div>
    </div>
  </div>`;

  host.querySelectorAll('[data-ssel]').forEach(b => b.addEventListener('click', () => {
    App.adminStaffSel = b.dataset.ssel;
    adminTeamSection(host);
  }));

  $('#addStaffBtn').addEventListener('click', () => {
    const m = { id: uid('staff'), name: 'New Team Member', role: 'Role / Title', initials: 'NT', color: '#3F6A99', rate: 150, bio: { base: '' } };
    (S.customStaff = S.customStaff || []).push(m);
    App.adminStaffSel = m.id;
    App.adminStaffTab = 'base';
    Settings.save(); adminTeamSection(host);
    toast('Team member added — name them and write their core bio');
  });

  host.querySelectorAll('[data-cttab]').forEach(t => t.addEventListener('click', () => {
    App.adminStaffTab = t.dataset.cttab;
    adminTeamSection(host);
  }));

  const ss = host.querySelector('[data-savestate]');
  let ssTimer = null;
  const flashSaved = () => {
    ss.textContent = 'Saved ✓'; ss.classList.add('on');
    clearTimeout(ssTimer);
    ssTimer = setTimeout(() => { ss.textContent = 'All changes saved'; ss.classList.remove('on'); }, 1800);
  };

  host.querySelectorAll('[data-sf]').forEach(inp => inp.addEventListener('change', () => {
    const o = Settings.staffOverride(sel.id);
    if (!o) return;
    o[inp.dataset.sf] = inp.value.trim();
    if (inp.dataset.sf === 'name') o.initials = initialsOf(inp.value) || 'TM';
    Settings.save(); adminTeamSection(host);
  }));

  const bioInp = host.querySelector('[data-bio]');
  if (bioInp) {
    const saveBio = debounce(() => {
      const o = Settings.staffOverride(sel.id);
      if (!o) return;
      (o.bio = o.bio || {})[bioInp.dataset.bio] = bioInp.value.trim();
      Settings.save(); flashSaved();
      const now = Settings.staffList().find(s => s.id === sel.id);
      const dots = host.querySelector(`[data-svdots="${CSS.escape(sel.id)}"]`);
      if (dots) dots.innerHTML = ctDotsHTML(CLIENT_KEYS.filter(k => (now.bio[k] || '').trim()));
      const reset = host.querySelector('[data-act="resetStaff"]');
      if (reset) reset.style.display = '';
    }, 700);
    bioInp.addEventListener('input', () => {
      ss.textContent = 'Saving…'; ss.classList.remove('on');
      const live = { ...sel, bio: { ...sel.bio, [bioInp.dataset.bio]: bioInp.value } };
      host.querySelector('[data-biopreview]').innerHTML = bioPreviewHTML(live, ct);
      saveBio();
    });
  }

  const delStaff = host.querySelector('[data-act="delStaff"]');
  if (delStaff) delStaff.addEventListener('click', () => {
    S.customStaff = S.customStaff.filter(c => c.id !== sel.id);
    App.adminStaffSel = null;
    Settings.save(); adminTeamSection(host);
    toast(`${sel.name} removed — team pages already in documents keep their text`);
  });
  const resetStaff = host.querySelector('[data-act="resetStaff"]');
  if (resetStaff) resetStaff.addEventListener('click', () => {
    delete S.staff[sel.id];
    Settings.save(); adminTeamSection(host);
    toast('Back to the built-in bio');
  });
}

/* =================== COVER TEMPLATES =================== */
function adminCoversSection(host) {
  const S = Settings.data;
  if (!S.defaultCover) S.defaultCover = { layout: 'letterhead', bgId: null, marginPx: 84, templateId: null };
  const dc = S.defaultCover;
  const bgs = AssetStore.bgs();
  const tpls = S.coverTemplates || [];
  host.innerHTML = `
  ${adminHead('Cover Templates', 'The shared cover-art library every proposal can use, plus saved cover layouts that users apply from the cover block’s settings in one click.')}
  <div class="admin-card">
    <div class="admin-card-h"><b>Default cover</b><small>Used for new proposals and Claude drafts unless overridden in the wizard</small></div>
    <div class="seg" style="max-width:420px">
      <button class="seg-btn ${dc.layout === 'letterhead' ? 'on' : ''}" data-deflayout="letterhead">Letterhead</button>
      <button class="seg-btn ${dc.layout !== 'custom' && dc.layout !== 'letterhead' ? 'on' : ''}" data-deflayout="standard">Standard</button>
      <button class="seg-btn ${dc.layout === 'custom' ? 'on' : ''}" data-deflayout="custom">Custom art</button>
    </div>
    ${dc.layout === 'custom' ? `
    <div class="bg-grid" style="margin-top:10px">
      ${bgs.map(g => `<button class="bg-thumb ${dc.bgId === g.id ? 'on' : ''}" data-defbg="${g.id}" style="background-image:url(${g.src})" title="${esc(g.name)}"></button>`).join('') || '<span class="set-hint">Upload art below first.</span>'}
    </div>` : dc.layout === 'standard' ? `
    <div class="seg" style="margin-top:10px;max-width:320px" title="Cover margins">
      ${[['None', 0], ['Narrow', 48], ['Normal', 84], ['Wide', 120]].map(([l, px]) => `<button class="seg-btn ${(dc.marginPx != null ? dc.marginPx : 84) === px ? 'on' : ''}" data-defmargin="${px}">${l}</button>`).join('')}
    </div>` : `
    <p class="set-hint" style="margin:10px 0 0">Navy sidebar, gold stripe, and horizontal lockup — the firm letterhead.</p>`}
    ${tpls.length ? `
    <div class="set-label" style="margin-top:14px">Or start from a saved template</div>
    <div class="ct-chips" style="flex-wrap:wrap">
      <button class="ct-chip ${!dc.templateId ? 'on' : ''}" data-deftpl="">None — use layout above</button>
      ${tpls.map(t => `<button class="ct-chip ${dc.templateId === t.id ? 'on' : ''}" data-deftpl="${t.id}">${esc(t.name)}</button>`).join('')}
    </div>` : ''}
  </div>
  <div class="admin-card">
    <div class="admin-card-h"><b>Cover art library</b><small>Shared with all users — also used for body-page backgrounds</small>
      <span class="flex1"></span>
      <button class="btn tiny primary" id="coverArtUpload">${icon('upload', 12)} Upload art</button>
    </div>
    <div class="bg-grid admin-bg-grid">
      ${bgs.map(g => `<div class="admin-bg-cell"><button class="bg-thumb" style="background-image:url(${g.src})" title="${esc(g.name)}"></button>
        <button class="iconbtn danger" data-delbg="${g.id}" title="Remove from library">${icon('trash', 12)}</button></div>`).join('')}
      ${bgs.length ? '' : '<p class="set-hint" style="margin:6px 2px">No cover art yet — upload full-page portrait designs (letterheads, photo covers, frames).</p>'}
    </div>
  </div>
  <div class="admin-card">
    <div class="admin-card-h"><b>Saved cover templates</b><small>Appear in the cover block’s settings for every user</small>
      <span class="flex1"></span>
      <button class="btn tiny primary" id="addCoverTpl">${icon('plus', 12)} New template</button>
    </div>
    ${S.coverTemplates.length ? S.coverTemplates.map(t => `
    <div class="admin-covertpl" data-tid="${t.id}">
      <div class="admin-covertpl-thumb ${t.layout === 'custom' ? '' : t.layout === 'letterhead' ? 'fss' : 'std'}" style="${t.layout === 'custom' && AssetStore.bg(t.bgId) ? `background-image:url(${AssetStore.bg(t.bgId).src})` : ''}">${t.layout === 'custom' || t.layout === 'letterhead' ? '' : 'Aa'}</div>
      <div class="admin-covertpl-body">
        <input class="set-input slim" data-f="name" value="${esc(t.name)}" placeholder="Template name">
        <div class="seg">
          <button class="seg-btn ${t.layout === 'letterhead' ? 'on' : ''}" data-layout="letterhead">Letterhead</button>
          <button class="seg-btn ${t.layout !== 'custom' && t.layout !== 'letterhead' ? 'on' : ''}" data-layout="standard">Standard</button>
          <button class="seg-btn ${t.layout === 'custom' ? 'on' : ''}" data-layout="custom">Custom art</button>
        </div>
        ${t.layout === 'custom' ? `
        <div class="bg-grid" style="margin-top:8px">
          ${bgs.map(g => `<button class="bg-thumb ${t.bgId === g.id ? 'on' : ''}" data-tplbg="${g.id}" style="background-image:url(${g.src})" title="${esc(g.name)}"></button>`).join('') || '<span class="set-hint">Upload art above first.</span>'}
        </div>` : t.layout === 'letterhead' ? `
        <p class="set-hint" style="margin:8px 0 0">The firm letterhead — navy sidebar, gold stripe, and horizontal lockup, drawn to fit the page.</p>` : `
        <div class="seg" style="margin-top:8px" title="Cover margins">
          ${[['None', 0], ['Narrow', 48], ['Normal', 84], ['Wide', 120]].map(([l, px]) => `<button class="seg-btn ${(t.marginPx != null ? t.marginPx : 84) === px ? 'on' : ''}" data-tplmargin="${px}">${l}</button>`).join('')}
        </div>`}
      </div>
      <button class="iconbtn danger" data-act="delTpl" title="Delete template">${icon('trash', 13)}</button>
    </div>`).join('') : '<p class="set-hint" style="margin:8px 2px">No saved templates yet. Create one and it shows up in every cover block’s settings.</p>'}
  </div>`;

  host.querySelectorAll('[data-deflayout]').forEach(b => b.addEventListener('click', () => {
    S.defaultCover.layout = b.dataset.deflayout;
    S.defaultCover.templateId = null;
    Settings.save(); adminCoversSection(host);
    toast('Default cover updated');
  }));
  host.querySelectorAll('[data-defbg]').forEach(b => b.addEventListener('click', () => {
    S.defaultCover.bgId = b.dataset.defbg;
    Settings.save(); adminCoversSection(host);
  }));
  host.querySelectorAll('[data-defmargin]').forEach(b => b.addEventListener('click', () => {
    S.defaultCover.marginPx = parseInt(b.dataset.defmargin, 10);
    Settings.save(); adminCoversSection(host);
  }));
  host.querySelectorAll('[data-deftpl]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.deftpl || null;
    if (!id) {
      S.defaultCover.templateId = null;
    } else {
      const t = tpls.find(x => x.id === id);
      if (!t) return;
      S.defaultCover.templateId = id;
      S.defaultCover.layout = t.layout;
      S.defaultCover.bgId = t.bgId || null;
      S.defaultCover.marginPx = t.marginPx != null ? t.marginPx : 84;
    }
    Settings.save(); adminCoversSection(host);
    toast('Default cover updated');
  }));

  $('#coverArtUpload').addEventListener('click', async () => {
    const f = await pickFile('image/*');
    if (!f) return;
    AssetStore.addBg(f.name.replace(/\.\w+$/, ''), await fileToDataURL(f, 1700));
    adminCoversSection(host);
    toast('Cover art added to the shared library');
  });
  host.querySelectorAll('[data-delbg]').forEach(b => b.addEventListener('click', () => {
    AssetStore.removeBg(b.dataset.delbg);
    if (typeof Sync !== 'undefined') Sync.pushAssets();
    adminCoversSection(host);
    toast('Removed from the library — covers already using it keep their art');
  }));
  $('#addCoverTpl').addEventListener('click', () => {
    S.coverTemplates.push({ id: uid('cvt'), name: 'New cover template', layout: 'letterhead', bgId: null, marginPx: 84 });
    Settings.save(); adminCoversSection(host);
  });
  host.querySelectorAll('.admin-covertpl').forEach(rowEl => {
    const t = S.coverTemplates.find(x => x.id === rowEl.dataset.tid);
    rowEl.querySelector('[data-f="name"]').addEventListener('change', (e) => {
      t.name = e.target.value.trim() || 'Cover template';
      Settings.save();
    });
    rowEl.querySelectorAll('[data-layout]').forEach(b => b.addEventListener('click', () => {
      t.layout = b.dataset.layout;
      Settings.save(); adminCoversSection(host);
    }));
    rowEl.querySelectorAll('[data-tplbg]').forEach(b => b.addEventListener('click', () => {
      t.bgId = b.dataset.tplbg;
      Settings.save(); adminCoversSection(host);
    }));
    rowEl.querySelectorAll('[data-tplmargin]').forEach(b => b.addEventListener('click', () => {
      t.marginPx = parseInt(b.dataset.tplmargin);
      Settings.save(); adminCoversSection(host);
    }));
    rowEl.querySelector('[data-act="delTpl"]').addEventListener('click', () => {
      S.coverTemplates = S.coverTemplates.filter(x => x !== t);
      if (S.defaultCover && S.defaultCover.templateId === t.id) S.defaultCover.templateId = null;
      Settings.save(); adminCoversSection(host);
    });
  });
}

/* =================== DOCUMENT TEMPLATES =================== */
function adminTemplatesSection(host) {
  const S = Settings.data;
  const allTypes = [];
  Settings.catalog(true).forEach(g => g.items.forEach(it => { if (!it.hidden) allTypes.push(it); }));

  host.innerHTML = `
  ${adminHead('Document Templates', 'What users can start from in the “New Proposal” wizard. Built-in templates stay as-is; your templates are ordered lists of blocks — each block drops in pre-written for the proposal’s client type.')}
  <div class="admin-card">
    <div class="admin-card-h"><b>Built-in</b></div>
    ${Object.values(TEMPLATES).map(t => `<div class="admin-tpl-builtin"><b>${esc(t.label)}</b><small>${esc(t.desc)}</small></div>`).join('')}
  </div>
  <div class="admin-card">
    <div class="admin-card-h"><b>Your templates</b>
      <span class="flex1"></span>
      <button class="btn tiny primary" id="newDocTpl">${icon('plus', 12)} New template</button>
    </div>
    ${S.docTemplates.length ? S.docTemplates.map(t => `
    <div class="admin-doctpl" data-tid="${t.id}">
      <div class="admin-doctpl-head">
        <input class="set-input slim" data-f="label" value="${esc(t.label)}" placeholder="Template name" style="max-width:240px">
        <input class="set-input slim" data-f="desc" value="${esc(t.desc || '')}" placeholder="Short description shown in the wizard">
        <button class="iconbtn danger" data-act="delTpl" title="Delete template">${icon('trash', 13)}</button>
      </div>
      <div class="admin-doctpl-blocks">
        ${t.blocks.map((en, i) => `
        <div class="admin-tplblock" data-bi="${i}">
          <span class="admin-tplblock-n">${i + 1}</span>
          <b>${esc(catalogItem(en.type).label)}</b>
          ${en.type === 'divider' ? `<input class="set-input slim" data-f="divlabel" value="${esc(en.label || '')}" placeholder="Section title" style="max-width:200px;margin:0">` : ''}
          <span class="flex1"></span>
          <button class="iconbtn" data-act="up" ${i === 0 ? 'disabled' : ''} title="Move up">${icon('back', 12)}</button>
          <button class="iconbtn" data-act="down" ${i === t.blocks.length - 1 ? 'disabled' : ''} title="Move down">${icon('back', 12)}</button>
          <button class="iconbtn danger" data-act="rm" title="Remove">${icon('x', 12)}</button>
        </div>`).join('')}
        <div class="admin-tplblock add">
          <select class="set-input slim" data-addsel style="margin:0">
            ${allTypes.map(it => `<option value="${esc(it.type)}">${esc(it.label)}</option>`).join('')}
          </select>
          <button class="btn tiny" data-act="addBlock">${icon('plus', 12)} Add block</button>
        </div>
      </div>
    </div>`).join('') : '<p class="set-hint" style="margin:8px 2px">No custom templates yet — create one and it appears in the New Proposal wizard for everyone.</p>'}
  </div>`;

  $('#newDocTpl').addEventListener('click', () => {
    S.docTemplates.push({
      id: uid('tpl'), label: 'New Template', desc: '',
      blocks: TEMPLATES.full.build({ clientType: 'county' }).map(b => ({ type: b.type, ...(b.label ? { label: b.label } : {}) })),
    });
    Settings.save(); adminTemplatesSection(host);
    toast('Template created — it starts as a copy of the Full RFP Response');
  });

  host.querySelectorAll('.admin-doctpl').forEach(tplEl => {
    const t = S.docTemplates.find(x => x.id === tplEl.dataset.tid);
    tplEl.querySelectorAll('.admin-doctpl-head [data-f]').forEach(inp => inp.addEventListener('change', () => {
      t[inp.dataset.f] = inp.value.trim();
      Settings.save();
    }));
    tplEl.querySelector('[data-act="delTpl"]').addEventListener('click', () => {
      S.docTemplates = S.docTemplates.filter(x => x !== t);
      Settings.save(); adminTemplatesSection(host);
    });
    tplEl.querySelectorAll('.admin-tplblock[data-bi]').forEach(rowEl => {
      const i = parseInt(rowEl.dataset.bi);
      rowEl.querySelector('[data-act="up"]').addEventListener('click', () => {
        t.blocks.splice(i - 1, 0, t.blocks.splice(i, 1)[0]);
        Settings.save(); adminTemplatesSection(host);
      });
      rowEl.querySelector('[data-act="down"]').addEventListener('click', () => {
        t.blocks.splice(i + 1, 0, t.blocks.splice(i, 1)[0]);
        Settings.save(); adminTemplatesSection(host);
      });
      rowEl.querySelector('[data-act="rm"]').addEventListener('click', () => {
        t.blocks.splice(i, 1);
        Settings.save(); adminTemplatesSection(host);
      });
      const dl = rowEl.querySelector('[data-f="divlabel"]');
      if (dl) dl.addEventListener('change', () => {
        t.blocks[i].label = dl.value.trim();
        Settings.save();
      });
    });
    tplEl.querySelector('[data-act="addBlock"]').addEventListener('click', () => {
      t.blocks.push({ type: tplEl.querySelector('[data-addsel]').value });
      Settings.save(); adminTemplatesSection(host);
    });
  });
}

/* =================== PRICING & CALCULATOR =================== */
function adminPricingSection(host) {
  const S = Settings.data;
  const ct = App.adminPricingCt || (App.adminPricingCt = 'school');
  const m = S.pricing[ct];

  const rowNum = (obj, f, step = 500, width = 110) =>
    `<span class="calc-money">$<input type="number" data-nf="${f}" value="${obj[f] || 0}" min="0" step="${step}" style="width:${width}px"></span>`;

  host.innerHTML = `
  ${adminHead('Pricing & Calculator', 'The cost calculator’s starting numbers for each client type — service categories, suggested prices, add-ons, pass-throughs, and personnel allocations. New cost blocks start from these; documents already priced don’t change.')}
  <div class="ct-chips" style="margin-bottom:14px">
    ${CLIENT_KEYS.map(k => `<button class="ct-chip lg ${ct === k ? 'on' : ''}" data-prct="${k}">${CLIENTS[k].label}${S.pricing[k] ? ' •' : ''}</button>`).join('')}
  </div>
  ${!m ? `
  <div class="admin-card">
    <div class="admin-card-h"><b>${esc(CLIENTS[ct].label)}</b><small>Currently using the built-in defaults</small>
      <span class="flex1"></span>
      <button class="btn tiny primary" id="customizePricing">Customize for ${esc(CLIENTS[ct].short)}</button>
    </div>
    <p class="set-hint" style="margin:6px 2px">Built-in defaults scale by engagement size (county/city run larger). Customize to set your own categories, fees, and suggested prices for ${esc(CLIENTS[ct].label)} proposals.</p>
  </div>` : `
  <div class="admin-card">
    <div class="admin-card-h"><b>Service categories</b><small>“Suggested” powers the ⚡ chips inside the calculator</small>
      <span class="flex1"></span>
      <button class="btn tiny" id="revertPricing">Revert to built-in</button>
      <button class="btn tiny" data-act="addCat">${icon('plus', 12)} Add line</button>
    </div>
    <div class="admin-price-grid-h"><span>Category & description</span><span>Kind</span><span>Fee</span><span>Suggested</span><span></span></div>
    ${m.cats.map(c => `
    <div class="admin-price-row" data-cid="${c.id}">
      <div><input class="set-input slim" data-f="name" value="${esc(c.name)}" placeholder="Category">
        <input class="set-input slim" data-f="desc" value="${esc(c.desc)}" placeholder="Description shown in the fee table"></div>
      <select class="set-input slim" data-f="kind"><option value="flat" ${c.kind === 'flat' ? 'selected' : ''}>Flat</option><option value="monthly" ${c.kind === 'monthly' ? 'selected' : ''}>Monthly</option><option value="included" ${c.kind === 'included' ? 'selected' : ''}>Included</option></select>
      <span class="calc-money">$<input type="number" data-f="fee" value="${c.fee || 0}" min="0" step="500"></span>
      <span class="calc-money">$<input type="number" data-f="rec" value="${c.rec || 0}" min="0" step="500" title="Suggested price"></span>
      <button class="iconbtn danger" data-act="delCat">${icon('trash', 13)}</button>
    </div>`).join('')}
    <div class="admin-price-foot">
      <label>Engagement <input type="number" data-mf="months" value="${m.months}" min="1" max="36" style="width:60px"> months</label>
      <label>Households ${rowNum(m, 'households', 1000, 90).replace('$', '')}</label>
      <label>Measure raises/yr ${rowNum(m, 'measureAnnual', 100000)}</label>
    </div>
  </div>
  <div class="admin-card">
    <div class="admin-card-h"><b>Optional add-ons</b><small>Toggled = included by default in new cost blocks</small>
      <span class="flex1"></span><button class="btn tiny" data-act="addAddon">${icon('plus', 12)} Add</button></div>
    ${m.addOns.map(a => `
    <div class="admin-price-row slim" data-aid="${a.id}">
      <label class="switch"><input type="checkbox" data-f="on" ${a.on ? 'checked' : ''}><span></span></label>
      <div><input class="set-input slim" data-f="name" value="${esc(a.name)}"><input class="set-input slim" data-f="desc" value="${esc(a.desc)}"></div>
      <span class="calc-money">$<input type="number" data-f="fee" value="${a.fee || 0}" min="0" step="500"></span>
      <button class="iconbtn danger" data-act="delRow">${icon('trash', 13)}</button>
    </div>`).join('')}
  </div>
  <div class="admin-card">
    <div class="admin-card-h"><b>Pass-through costs</b><small>Media buys, direct mail — no agency markup</small>
      <span class="flex1"></span>
      <label class="admin-flag"><input type="checkbox" data-mf="showPassThroughs" ${m.showPassThroughs ? 'checked' : ''}>Show by default</label>
      <button class="btn tiny" data-act="addPass">${icon('plus', 12)} Add</button></div>
    ${m.passThroughs.map(p => `
    <div class="admin-price-row slim" data-pid="${p.id}">
      <label class="switch"><input type="checkbox" data-f="on" ${p.on ? 'checked' : ''}><span></span></label>
      <div><input class="set-input slim" data-f="name" value="${esc(p.name)}"><input class="set-input slim" data-f="desc" value="${esc(p.desc)}"></div>
      <span class="calc-money">$<input type="number" data-f="fee" value="${p.fee || 0}" min="0" step="500"></span>
      <button class="iconbtn danger" data-act="delRow">${icon('trash', 13)}</button>
    </div>`).join('')}
  </div>
  <div class="admin-card">
    <div class="admin-card-h"><b>Personnel allocation</b><small>The “Personnel Cost Allocation” table</small>
      <span class="flex1"></span>
      <label class="admin-flag"><input type="checkbox" data-mf="showPersonnel" ${m.showPersonnel ? 'checked' : ''}>Show by default</label>
      <label class="admin-flag"><input type="checkbox" data-mf="showRates" ${m.showRates ? 'checked' : ''}>Rate schedule</label>
      <button class="btn tiny" data-act="addPers">${icon('plus', 12)} Add</button></div>
    ${m.personnel.map(p => `
    <div class="admin-price-row slim" data-perid="${p.id}">
      <div><input class="set-input slim" data-f="name" value="${esc(p.name)}"><input class="set-input slim" data-f="role" value="${esc(p.role)}"></div>
      <span class="calc-money">$<input type="number" data-f="amount" value="${p.amount || 0}" min="0" step="500"></span>
      <button class="iconbtn danger" data-act="delRow">${icon('trash', 13)}</button>
    </div>`).join('')}
  </div>`}
  <div class="admin-card">
    <div class="admin-card-h"><b>Hourly rate schedule</b><small>Used by the “out-of-scope work” table in every cost block (all client types)</small></div>
    ${staffAll().map(s => `
    <div class="admin-price-row slim" data-staffrate="${s.id}">
      <span class="avatar sm" style="background:${s.color}">${s.initials}</span>
      <div><b style="font-size:13px">${esc(s.name)}</b><small class="muted" style="display:block;font-size:11.5px">${esc(s.role)}</small></div>
      <span class="calc-money">$<input type="number" data-f="rate" value="${Settings.staffRate(s.id)}" min="0" step="5" style="width:80px"> /hr</span>
    </div>`).join('')}
  </div>`;

  host.querySelectorAll('[data-prct]').forEach(b => b.addEventListener('click', () => {
    App.adminPricingCt = b.dataset.prct;
    adminPricingSection(host);
  }));

  host.querySelectorAll('[data-staffrate]').forEach(rowEl => {
    rowEl.querySelector('[data-f="rate"]').addEventListener('change', (e) => {
      S.staffRates[rowEl.dataset.staffrate] = parseFloat(e.target.value) || 0;
      Settings.save();
    });
  });

  const customize = $('#customizePricing');
  if (customize) customize.addEventListener('click', () => {
    S.pricing[ct] = defaultCostModel(ct);   // settings has no entry yet → built-in
    Settings.save(); adminPricingSection(host);
    toast(`Pricing defaults for ${CLIENTS[ct].label} are now editable`);
  });
  if (!m) return;

  $('#revertPricing').addEventListener('click', () => {
    delete S.pricing[ct];
    Settings.save(); adminPricingSection(host);
    toast(`${CLIENTS[ct].label} pricing reverted to the built-in defaults`);
  });

  const saveNum = (obj, f, inp) => { obj[f] = inp.type === 'checkbox' ? inp.checked : (inp.type === 'number' ? (parseFloat(inp.value) || 0) : inp.value); Settings.save(); };
  host.querySelectorAll('[data-mf]').forEach(inp => inp.addEventListener('change', () => saveNum(m, inp.dataset.mf, inp)));

  const bindRows = (sel, list, addAct, delListKey) => {
    host.querySelectorAll(sel).forEach(rowEl => {
      const id = rowEl.dataset.cid || rowEl.dataset.aid || rowEl.dataset.pid || rowEl.dataset.perid;
      const item = list.find(x => x.id === id);
      rowEl.querySelectorAll('[data-f]').forEach(inp =>
        inp.addEventListener('change', () => saveNum(item, inp.dataset.f, inp)));
      const del = rowEl.querySelector('[data-act="delCat"], [data-act="delRow"]');
      if (del) del.addEventListener('click', () => {
        m[delListKey] = list.filter(x => x !== item);
        Settings.save(); adminPricingSection(host);
      });
    });
  };
  bindRows('.admin-price-row[data-cid]', m.cats, 'addCat', 'cats');
  bindRows('.admin-price-row[data-aid]', m.addOns, 'addAddon', 'addOns');
  bindRows('.admin-price-row[data-pid]', m.passThroughs, 'addPass', 'passThroughs');
  bindRows('.admin-price-row[data-perid]', m.personnel, 'addPers', 'personnel');

  const adders = {
    addCat: () => m.cats.push({ id: uid('k'), name: 'New Service Category', desc: '', fee: 5000, kind: 'flat', rec: 5000 }),
    addAddon: () => m.addOns.push({ id: uid('k'), name: 'New Add-on', desc: '', fee: 5000, on: false }),
    addPass: () => m.passThroughs.push({ id: uid('k'), name: 'New Pass-through', desc: '', fee: 10000, on: false }),
    addPers: () => m.personnel.push({ id: uid('k'), name: 'Team Member', role: '', amount: 5000 }),
  };
  Object.entries(adders).forEach(([act, fn]) => {
    const btn = host.querySelector(`[data-act="${act}"]`);
    if (btn) btn.addEventListener('click', () => { fn(); Settings.save(); adminPricingSection(host); });
  });
}

/* =================== FIRM CONTEXT (AI) =================== */
/* Shared text extraction for firm-context uploads. Reuses the zip + pdf.js
   helpers from importfile.js (loaded earlier in the shell). */
async function extractFileText(file) {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.txt') || name.endsWith('.md') || file.type.startsWith('text/')) {
    return await file.text();
  }
  if (name.endsWith('.docx')) {
    const entries = zipEntries(await file.arrayBuffer());
    const xml = await zipText(entries, 'word/document.xml');
    if (!xml) throw new Error('Could not read the .docx');
    return xml
      .replace(/<\/w:p>/g, '\n')
      .replace(/<w:tab[^>]*\/>/g, '\t')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  if (name.endsWith('.pdf')) {
    const pdfjs = await loadPdfJs();
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    let out = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      out += tc.items.map((it) => it.str).join(' ') + '\n\n';
    }
    return out.trim();
  }
  throw new Error('Use a .txt, .md, .docx, or .pdf file');
}

function adminFirmSection(host) {
  host.innerHTML = `
  ${adminHead('Firm Context for Claude', 'A profile of Fog Signal Strategies — who we are, what we do, our voice, differentiators, and boilerplate. Claude uses this whenever it drafts a proposal, answers questions, tailors a block, or proofreads. Paste text or load it from a file. This is shared across the workspace.')}
  <div class="admin-card">
    <div class="set-label">Firm profile</div>
    <textarea id="firmCtxText" class="set-input" style="min-height:340px;line-height:1.5;font-size:13px" placeholder="Example:&#10;Fog Signal Strategies is a public-affairs and campaign-services firm specializing in ballot-measure and bond campaigns for public agencies…&#10;&#10;Voice: confident, specific, plain-spoken.&#10;Differentiators: …&#10;Standard terms / boilerplate: …"></textarea>
    <div class="pn-2col" style="grid-template-columns:auto auto 1fr auto;align-items:center;gap:10px;margin-top:10px">
      <button class="btn" id="firmCtxLoad">${icon('upload', 14)} Load from file</button>
      <span class="set-hint" id="firmCtxMeta" style="margin:0"></span>
      <span></span>
      <button class="btn primary" id="firmCtxSave">Save firm context</button>
    </div>
    <p class="set-hint" id="firmCtxStatus" style="margin-top:8px"></p>
  </div>`;

  const ta = host.querySelector('#firmCtxText');
  const meta = host.querySelector('#firmCtxMeta');
  const status = host.querySelector('#firmCtxStatus');
  const setMeta = () => { meta.textContent = (ta.value.length ? ta.value.length.toLocaleString() + ' characters' : 'Empty'); };

  ta.addEventListener('input', setMeta);

  if (typeof AI !== 'undefined') {
    AI.getFirmContext().then((fc) => {
      ta.value = (fc && fc.text) || '';
      setMeta();
      if (fc && fc.updatedAt) status.textContent = 'Last saved ' + timeAgo(fc.updatedAt);
    }).catch(() => { status.textContent = 'Could not load saved context.'; });
  }

  host.querySelector('#firmCtxLoad').addEventListener('click', async () => {
    const f = await pickFile('.txt,.md,.docx,.pdf');
    if (!f) return;
    status.textContent = 'Reading ' + f.name + '…';
    try {
      const text = await extractFileText(f);
      ta.value = ta.value ? (ta.value.trim() + '\n\n' + text) : text;
      setMeta();
      status.textContent = 'Loaded ' + f.name + ' — review, then Save.';
    } catch (e) {
      status.textContent = e.message || 'Could not read that file.';
    }
  });

  host.querySelector('#firmCtxSave').addEventListener('click', async () => {
    status.textContent = 'Saving…';
    try {
      const fc = await AI.setFirmContext(ta.value);
      status.textContent = 'Saved.' + (fc && fc.updatedAt ? ' (' + timeAgo(fc.updatedAt) + ')' : '');
      toast('Firm context saved');
    } catch (e) {
      status.textContent = e.message || 'Save failed.';
    }
  });
}
