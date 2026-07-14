/* ============ Fog Signal Proposals — state & persistence ============
   Autosave is instant: every mutation writes to localStorage right away.
   When wired to the production backend, swap Store.write/read for API
   calls (the debounced status indicator already models network latency). */
'use strict';

const LS_INDEX = 'fss.proposals.index';
const LS_DOC = (id) => 'fss.proposals.doc.' + id;

const Store = {
  index() {
    try { return JSON.parse(localStorage.getItem(LS_INDEX)) || []; } catch (e) { return []; }
  },
  writeIndex(list) { localStorage.setItem(LS_INDEX, JSON.stringify(list)); },

  create(meta) {
    const doc = {
      id: uid('doc'),
      title: meta.title || 'Untitled Proposal',
      agency: meta.agency || '',
      clientType: meta.clientType || 'county',
      rfpNumber: meta.rfpNumber || '',
      serviceTitle: meta.serviceTitle || 'Public Education & Community Outreach Services',
      deadline: meta.deadline || '',
      pageSize: 'letter',
      createdAt: Date.now(), updatedAt: Date.now(),
      blocks: [], content: {},
      comments: [],
      rfp: { items: defaultRfpItems() },
      versions: [],
      keelClientId: meta.keelClientId || null,
    };
    doc.blocks = (typeof Settings !== 'undefined' && Settings.buildTemplate(meta.template, doc))
      || (TEMPLATES[meta.template] || TEMPLATES.full).build(doc);
    this.writeDoc(doc);
    const list = this.index();
    list.unshift(this.metaOf(doc));
    this.writeIndex(list);
    if (typeof Sync !== 'undefined' && Sync.remote) {
      Sync.createRemote(doc).then((res) => {
        if (res?.id && res.id !== doc.id) {
          const newId = res.id;
          const oldId = doc.id;
          doc.id = newId;
          this.writeDoc(doc);
          const ix = this.index().map((m) => (m.id === oldId ? this.metaOf(doc) : m));
          this.writeIndex(ix);
        }
      });
    } else if (typeof Sync !== 'undefined') Sync.createRemote(doc);
    return doc;
  },

  /* Docs can arrive from the server (Cleatus ingest, older builds, manual DB
     edits) missing collection fields the editor assumes exist. A single
     undefined `.replies` or `.rfp.items` would otherwise throw mid-render and
     abort openEditor before it joins the live-sync room — collaboration dies
     silently. Fill the gaps instead. */
  normalize(doc) {
    if (!doc || typeof doc !== 'object') return doc;
    if (!Array.isArray(doc.blocks)) doc.blocks = [];
    if (!doc.content || typeof doc.content !== 'object') doc.content = {};
    if (!Array.isArray(doc.comments)) doc.comments = [];
    doc.comments.forEach(c => { if (!Array.isArray(c.replies)) c.replies = []; });
    if (!Array.isArray(doc.floats)) doc.floats = [];
    if (!Array.isArray(doc.versions)) doc.versions = [];
    if (!doc.rfp || typeof doc.rfp !== 'object') doc.rfp = {};
    if (!Array.isArray(doc.rfp.items)) doc.rfp.items = [];
    if (!doc.proofing || typeof doc.proofing !== 'object') doc.proofing = {};
    if (!doc.proofing.signoffs || typeof doc.proofing.signoffs !== 'object') doc.proofing.signoffs = {};
    return doc;
  },

  metaOf(doc) {
    return { id: doc.id, title: doc.title, agency: doc.agency, clientType: doc.clientType,
      rfpNumber: doc.rfpNumber, deadline: doc.deadline, updatedAt: doc.updatedAt, createdAt: doc.createdAt };
  },

  read(id) {
    try { return JSON.parse(localStorage.getItem(LS_DOC(id))); } catch (e) { return null; }
  },
  writeDoc(doc) {
    try {
      localStorage.setItem(LS_DOC(doc.id), JSON.stringify(doc));
    } catch (e) {
      // imported PDFs can outgrow browser storage — the server copy stays intact
      if (!this._quotaWarned) {
        this._quotaWarned = true;
        const remote = typeof Sync !== 'undefined' && Sync.remote;
        toast(remote ? 'Document too big for the browser cache — the server copy is the master'
                     : 'Browser storage is full — connect the server (server.py) for large documents', 5000);
      }
    }
  },
  remove(id) {
    localStorage.removeItem(LS_DOC(id));
    this.writeIndex(this.index().filter(m => m.id !== id));
    if (typeof Sync !== 'undefined') Sync.removeRemote(id);
  },
  touch(doc) {
    doc.updatedAt = Date.now();
    const list = this.index();
    const i = list.findIndex(m => m.id === doc.id);
    if (i >= 0) list[i] = this.metaOf(doc); else list.unshift(this.metaOf(doc));
    list.sort((a, b) => b.updatedAt - a.updatedAt);
    this.writeIndex(list);
  },
};

/* ---------- app runtime state ---------- */
const App = {
  view: 'home',          // 'home' | 'editor'
  doc: null,
  mode: 'editing',       // 'editing' | 'suggesting' | 'viewing'
  zoom: 0.9,
  selectedBlock: null,
  showRail: true,
  railTab: 'comments',   // 'comments' | 'suggestions'
  sidebarTab: 'blocks',  // 'blocks' | 'outline'
  showAllBlocks: false,
  libCat: 'All',
  leftCollapsed: false,
  drag: null,            // {kind:'lib'|'move', type?, bid?}
  saveState: 'saved',
  pendingComment: null,  // {blockId, quote, range} while composing
};

/* Save pipeline: write immediately, settle the indicator shortly after. */
const _settleSave = debounce(() => {
  App.saveState = 'saved';
  updateSaveBadge();
}, 600);

function saveDoc(opts = {}) {
  if (!App.doc) return;
  App.saveState = 'saving';
  updateSaveBadge();
  Store.writeDoc(App.doc);
  Store.touch(App.doc);
  if (typeof Sync !== 'undefined') Sync.push();
  _settleSave();
  if (!opts.silent) maybeAutoVersion();
  History.onChange();
}

/* ---------- undo / redo ----------
   Snapshot history over the editable doc state (title, blocks, content,
   floats). Every mutation funnels through saveDoc, which schedules a
   commit on a short debounce — so a typing burst collapses into a single
   undo step, while a drag/delete/settings change commits at its next
   quiet moment. Unchanged parts share the previous step's JSON string,
   so big docs (imported PDF pages) don't multiply in memory. */
const History = {
  stack: [], idx: -1, docId: null, LIMIT: 60,

  snap() {
    const d = App.doc, prev = this.stack[this.idx];
    const s = {
      t: d.title,
      b: JSON.stringify(d.blocks),
      c: JSON.stringify(d.content),
      f: JSON.stringify(d.floats || []),
    };
    if (prev) {
      if (s.b === prev.b) s.b = prev.b;
      if (s.c === prev.c) s.c = prev.c;
      if (s.f === prev.f) s.f = prev.f;
    }
    return s;
  },
  same(a, b) { return !!a && !!b && a.t === b.t && a.b === b.b && a.c === b.c && a.f === b.f; },

  init(doc) {
    this.docId = doc.id;
    this.commitSoon.cancel();
    this.stack = [];
    this.idx = -1;
    this.stack.push(this.snap());
    this.idx = 0;
  },

  onChange() {
    if (this._applying || !App.doc || App.doc.id !== this.docId) return;
    this.commitSoon();
  },

  commit() {
    this.commitSoon.cancel();
    if (!App.doc || App.doc.id !== this.docId) return;
    const s = this.snap();
    if (this.same(s, this.stack[this.idx])) return;
    this.stack.splice(this.idx + 1);
    this.stack.push(s);
    if (this.stack.length > this.LIMIT) this.stack.shift();
    this.idx = this.stack.length - 1;
  },

  undo() {
    if (App.mode === 'viewing') { toast('Switch to Editing to undo'); return; }
    this.commit();                     // flush any pending burst first
    if (this.idx <= 0) { toast('Nothing to undo'); return; }
    this.idx--;
    this.apply(this.stack[this.idx]);
  },
  redo() {
    if (App.mode === 'viewing') { toast('Switch to Editing to redo'); return; }
    this.commit();                     // a fresh edit clears the redo trail
    if (this.idx >= this.stack.length - 1) { toast('Nothing to redo'); return; }
    this.idx++;
    this.apply(this.stack[this.idx]);
  },

  apply(s) {
    const d = App.doc;
    d.title = s.t;
    d.blocks = JSON.parse(s.b);
    d.content = JSON.parse(s.c);
    d.floats = JSON.parse(s.f);
    App.selectedBlock = null;
    App.selFloat = null;
    this._applying = true;
    saveDoc({ silent: true });
    this._applying = false;
    this.commitSoon.cancel();
    closePopovers();
    const t = $('#docTitle');
    if (t && t.textContent !== d.title) t.textContent = d.title;
    if (typeof floatEls !== 'undefined') floatEls.clear();
    renderCanvas();
  },
};
History.commitSoon = debounce(() => History.commit(), 500);

function updateSaveBadge() {
  const b = $('#saveBadge');
  if (!b) return;
  const saved = App.saveState === 'saved';
  b.className = 'save-badge ' + (saved ? 'is-saved' : 'is-saving');
  b.innerHTML = `<span class="dot"></span>${saved ? 'All changes saved' : 'Saving…'}`;
}

/* ---------- version history ---------- */
let _lastAutoVersion = 0;
function snapshotVersion(label, author) {
  const d = App.doc;
  d.versions.unshift({
    id: uid('v'), label: label || 'Edit checkpoint', author: author || ME.name, ts: Date.now(),
    snapshot: JSON.stringify({ title: d.title, blocks: d.blocks, content: d.content }),
  });
  if (d.versions.length > 30) d.versions.length = 30;
  Store.writeDoc(d);
}
function maybeAutoVersion() {
  const now = Date.now();
  if (now - _lastAutoVersion > 5 * 60 * 1000) {  // checkpoint every 5 min of activity
    _lastAutoVersion = now;
    snapshotVersion('Auto checkpoint');
  }
}
function restoreVersion(vid) {
  const v = App.doc.versions.find(x => x.id === vid);
  if (!v) return;
  snapshotVersion('Before restore');
  const snap = JSON.parse(v.snapshot);
  App.doc.title = snap.title;
  App.doc.blocks = snap.blocks;
  App.doc.content = snap.content;
  saveDoc({ silent: true });
  renderEditor();
  toast('Restored: ' + v.label);
}
