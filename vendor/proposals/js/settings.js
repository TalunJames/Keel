/* ============ Fog Signal Proposals — workspace settings ============
   Shared, admin-editable configuration for the whole workspace: brand
   palettes, uploaded fonts, block library overrides & custom blocks,
   per-client-type section titles and default content, cover & document
   templates, and pricing defaults for the cost calculator.

   Lives in data/settings.json on the server (synced live over SSE) with
   a localStorage mirror for static/offline use. Only the sysadmin and
   the users they select can edit it — see Settings.isAdmin(). When the
   dashboard's real auth arrives, replace the ME-based check.           */
'use strict';

const LS_SETTINGS = 'fss.settings';

/* Built-in default titles for the section blocks (used as placeholders
   in the admin editor and as the fallback when no override is set). */
const DEFAULT_TITLES = {
  about: 'About Fog Signal Strategies',
  approach: 'Our Approach',
  why: 'Why Measures Fail — and How We Fix It',
  understanding: 'Project Understanding',
  workplan: 'Technical Approach & Work Plan',
  schedule: 'Preliminary Project Schedule',
  terms: 'Additional Terms',
  exceptions: 'Exceptions, Qualifications, or Exclusions',
  conclusion: 'Conclusion',
  team: 'Project Team',
  experience: 'Relevant Experience',
  cost: 'Cost Proposal',
};

/* Blocks whose default body copy admins can rewrite (per client type). */
const CONTENT_TYPES = ['coverLetter', 'about', 'approach', 'why', 'understanding',
  'workplan', 'schedule', 'terms', 'exceptions', 'conclusion'];

const Settings = {
  /* Sysadmins — always have access and manage who else does. Maps to the
     dashboard's admin role later; 'me' is the default local identity. */
  OWNERS: ['carter', 'me'],

  data: null,

  defaults() {
    return {
      v: 1,
      access: { admins: [] },            // user ids selected by the sysadmin
      colors: { text: null, highlight: null },  // null → built-in brand palettes
      fonts: [],                         // {id, name, family, format, dataUrl}
      blockTitles: {},                   // type → {base, school, city, county, fire, special}
      blockContent: {},                  // type → {base, school, ...} default body HTML
      blockOverrides: {},                // type → {label, desc, curated, hidden}
      customBlocks: [],                  // {type, label, desc, cat, curated, content:{...}}
      coverTemplates: [],                // {id, name, layout, bgId, marginPx}
      docTemplates: [],                  // {id, label, desc, blocks:[{type, label?}]}
      pricing: {},                       // clientType → cost model defaults
      staffRates: {},                    // staffId → hourly rate override
      staff: {},                         // staffId → {name, role, initials, bio:{base, school, ...}}
      customStaff: [],                   // admin-added members {id, name, role, initials, color, rate, bio:{}}
    };
  },

  load() {
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(LS_SETTINGS)); } catch (e) {}
    this.data = Object.assign(this.defaults(), stored || {});
    this.apply();
  },

  /* Adopt a server copy (boot pull or a teammate's live update). */
  adopt(remote) {
    if (!remote || typeof remote !== 'object') return;
    this.data = Object.assign(this.defaults(), remote);
    localStorage.setItem(LS_SETTINGS, JSON.stringify(this.data));
    this.apply();
  },

  save() {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(this.data));
    this.apply();
    this._pushSoon();
  },
  _pushSoon: debounce(() => {
    if (typeof Sync === 'undefined' || !Sync.remote) return;
    fetch('api/settings?client=' + Sync.cid, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Settings.data),
    }).catch(() => {});
  }, 700),

  /* ---------- access ---------- */
  isOwner(uid) { return this.OWNERS.includes(uid || ME.id); },
  isAdmin(uid) {
    const id = uid || ME.id;
    return this.isOwner(id) || (this.data.access.admins || []).includes(id);
  },

  /* ---------- brand palettes ---------- */
  textColors()      { return (this.data.colors.text && this.data.colors.text.length) ? this.data.colors.text : BRAND_TEXT_COLORS; },
  highlightColors() { return (this.data.colors.highlight && this.data.colors.highlight.length) ? this.data.colors.highlight : BRAND_HIGHLIGHT_COLORS; },

  /* ---------- fonts ---------- */
  fonts() { return this.data.fonts || []; },
  fontFaceCSS() {
    return this.fonts().map(f =>
      `@font-face{font-family:'${f.family.replace(/'/g, '')}';src:url(${f.dataUrl}) format('${f.format}');font-display:swap;}`
    ).join('\n');
  },
  /* Options for the toolbar font <select> — built-ins plus uploads. */
  fontOptionsHTML() {
    const base = [
      ['arial', 'Arial', 'Arial'],
      ['baskerville', 'Baskerville', 'Baskerville,serif'],
      ['calibri', 'Calibri', "Calibri,'Gill Sans'"],
      ['source', 'Source Sans', "'Source Sans 3'"],
    ];
    return base.map(([v, l, fam]) => `<option value="${v}" style="font-family:${fam}">${l}</option>`).join('') +
      this.fonts().map(f => `<option value="${f.id}" style="font-family:'${esc(f.family)}'">${esc(f.name)}</option>`).join('');
  },

  /* Inject @font-face rules and register uploaded fonts with the editor. */
  apply() {
    let st = document.getElementById('fssCustomFonts');
    if (!st) {
      st = document.createElement('style');
      st.id = 'fssCustomFonts';
      document.head.appendChild(st);
    }
    st.textContent = this.fontFaceCSS();
    if (typeof FONT_STACKS !== 'undefined') {
      this.fonts().forEach(f => { FONT_STACKS[f.id] = `'${f.family.replace(/'/g, '')}', sans-serif`; });
    }
  },

  /* ---------- block library (overrides + custom blocks) ---------- */
  customBlock(type) { return (this.data.customBlocks || []).find(c => c.type === type) || null; },

  catalogItemOf(type) {
    const cb = this.customBlock(type);
    if (cb) return cb;
    const ov = this.data.blockOverrides[type];
    if (!ov) return null;
    return ov;   // partial — caller merges over the built-in item
  },

  /* The library as the app should see it: built-in groups with overrides
     applied, custom blocks appended to their category. includeHidden is
     for the admin panel, which manages hidden blocks too. */
  catalog(includeHidden = false) {
    const groups = CATALOG.map(g => ({
      cat: g.cat,
      items: g.items
        .map(it => Object.assign({}, it, this.data.blockOverrides[it.type] || {}))
        .filter(it => includeHidden || !it.hidden),
    }));
    (this.data.customBlocks || []).forEach(cb => {
      const g = groups.find(x => x.cat === cb.cat) || groups[groups.length - 1];
      g.items.push(Object.assign({ custom: true }, cb));
    });
    return groups.filter(g => g.items.length);
  },

  /* ---------- per-client-type titles & content ---------- */
  blockTitle(type, ct) {
    const m = this.data.blockTitles[type];
    if (!m) return null;
    const v = (ct && m[ct]) || m.base;
    return (v && v.trim()) ? v.trim() : null;
  },

  blockBody(type, ct) {
    let m = this.data.blockContent[type];
    if (!m) {
      const cb = this.customBlock(type);
      m = cb && cb.content;
    }
    if (!m) return null;
    const html = (ct && m[ct] && m[ct].trim()) ? m[ct] : m.base;
    if (!html || !html.trim() || !html.replace(/<[^>]+>|&nbsp;/g, '').trim()) return null;
    return this.mergeTokens(html);
  },

  /* {{agency}}, {{rfpNumber}}, {{serviceTitle}}, {{clientLabel}}, {{date}} */
  mergeTokens(html, doc) {
    const d = doc || (typeof App !== 'undefined' && App.doc) || {};
    const vals = {
      agency: esc(d.agency || ''),
      rfpNumber: esc(d.rfpNumber || ''),
      serviceTitle: esc(d.serviceTitle || ''),
      clientLabel: esc((CLIENTS[d.clientType] || {}).label || ''),
      date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    };
    return html.replace(/{{\s*(\w+)\s*}}/g, (m0, k) => (k in vals ? vals[k] : m0));
  },

  /* ---------- cover templates ---------- */
  coverTemplates() { return this.data.coverTemplates || []; },

  /* ---------- document templates ---------- */
  /* Built-ins plus admin-authored ones, for the New Proposal wizard. */
  allTemplates() {
    const out = Object.entries(TEMPLATES).map(([k, t]) => ({ key: k, label: t.label, desc: t.desc }));
    (this.data.docTemplates || []).forEach(t => out.push({
      key: t.id, label: t.label,
      desc: t.desc || t.blocks.map(b => catalogItem(b.type).label).slice(0, 6).join(', '),
    }));
    return out;
  },

  /* Build the block list for a custom template; null → not one of ours. */
  buildTemplate(key, doc) {
    const t = (this.data.docTemplates || []).find(x => x.id === key);
    if (!t) return null;
    let divNum = 1;
    return t.blocks.map(en => {
      const b = { id: uid('b'), type: en.type };
      if (en.type === 'team') { b.staff = this.staffList().map(s => s.id); b.variant = doc.clientType; }
      if (en.type === 'cost') b.cost = defaultCostModel(doc.clientType);
      if (en.type === 'divider') { b.num = ++divNum; if (en.label) b.label = en.label; }
      if (en.type === 'toc') b.pageBreak = true;
      if (en.type === 'signature') b.staffId = 'carter';
      return b;
    });
  },

  /* ---------- pricing (calculator backend) ---------- */
  /* A fresh cost model from the admin-set defaults for this client type,
     or null to fall back to the built-in model. Ids are regenerated so
     two documents never share row identity. */
  pricingModel(ct) {
    const m = this.data.pricing[ct];
    if (!m) return null;
    const c = JSON.parse(JSON.stringify(m));
    ['cats', 'addOns', 'passThroughs', 'personnel'].forEach(k => {
      (c[k] || []).forEach(row => { row.id = uid('k'); });
    });
    return c;
  },

  staffRate(staffId) {
    const v = this.data.staffRates[staffId];
    if (v != null && v !== '') return v;
    const s = this.staffList().find(x => x.id === staffId);
    return s ? (s.rate || 0) : 0;
  },

  /* ---------- team & bios ---------- */
  /* Built-in STAFF with admin overrides merged in, then admin-added
     members. Bio maps merge key-by-key so one rewritten variation
     doesn't clobber the others. */
  staffList() {
    const merged = STAFF.map(s => {
      const ov = this.data.staff[s.id];
      if (!ov) return s;
      return { ...s, ...ov, bio: { ...s.bio, ...(ov.bio || {}) } };
    });
    return merged.concat((this.data.customStaff || []).map(c =>
      ({ rate: 0, color: '#3F6A99', ...c, bio: { base: '', ...(c.bio || {}) } })));
  },

  /* The override slot for a built-in member (created on first edit),
     or the customStaff entry itself for added members. */
  staffOverride(id) {
    const custom = (this.data.customStaff || []).find(c => c.id === id);
    if (custom) return custom;
    if (!STAFF.some(s => s.id === id)) return null;
    return this.data.staff[id] || (this.data.staff[id] = {});
  },
};

Settings.load();
