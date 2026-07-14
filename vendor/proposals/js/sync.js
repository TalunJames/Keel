/* ============ Fog Signal Proposals — live sync layer ============
   Talks to server.py when it's there (REST + Server-Sent Events: live
   presence, doc updates, shared asset library). Falls back to pure
   localStorage when the app is served statically — same UX, no errors.
   When the dashboard's auth arrives, setCurrentUser() is the seam.     */
'use strict';

const Sync = {
  remote: false,
  cid: uid('client') + Math.random().toString(36).slice(2, 8),
  es: null,
  dirty: false,          // local changes not yet pushed — incoming updates wait
  _pendingApply: false,

  async init() {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 1800);
      const r = await fetch('api/health', { signal: ctl.signal });
      clearTimeout(t);
      this.remote = r.ok;
    } catch (e) { this.remote = false; }
    if (this.remote) {
      await this.pullAssets().catch(() => {});
      await this.pullSettings().catch(() => {});
    }
    return this.remote;
  },

  /* ---------- proposals ---------- */
  async refreshIndex() {
    if (!this.remote) return null;
    try {
      const list = await (await fetch('api/proposals')).json();
      const local = Store.index();
      if (!list.length && local.length) {
        // fresh server, existing local work → migrate up instead of hiding it
        for (const m of local) {
          const d = Store.read(m.id);
          if (d) await fetch('api/proposals?client=' + this.cid, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d),
          }).catch(() => {});
        }
        toast('Moved your local proposals onto the server — they’re shared now');
        return local;
      }
      Store.writeIndex(list);
      return list;
    } catch (e) { return null; }
  },

  async openDoc(id) {
    if (this.remote) {
      try {
        const r = await fetch('api/proposals/' + encodeURIComponent(id));
        if (r.ok) {
          const doc = await r.json();
          Store.writeDoc(doc);
          return doc;
        }
      } catch (e) { /* fall back to local copy */ }
    }
    return Store.read(id);
  },

  createRemote(doc) {
    if (!this.remote) return Promise.resolve(null);
    let q = 'client=' + encodeURIComponent(this.cid);
    if (window.KEEL_CLIENT_ID && window.KEEL_CLIENT_ID !== 'all') {
      q += '&clientId=' + encodeURIComponent(window.KEEL_CLIENT_ID);
    }
    return fetch('api/proposals?' + q, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doc),
    }).then(async (r) => {
      if (!r.ok) return null;
      const data = await r.json().catch(() => ({}));
      if (data.id && data.id !== doc.id) {
        const oldId = doc.id;
        doc.id = data.id;
        localStorage.removeItem(LS_DOC(oldId));
        Store.writeDoc(doc);
        const list = Store.index().map((m) => (m.id === oldId ? Store.metaOf(doc) : m));
        Store.writeIndex(list);
      }
      return data;
    }).catch(() => null);
  },
  removeRemote(id) {
    if (!this.remote) return;
    fetch('api/proposals/' + encodeURIComponent(id) + '?client=' + this.cid, { method: 'DELETE' }).catch(() => {});
  },

  /* Debounced full-document push. The doc is the unit of truth; the server
     fans out a light "changed" ping and peers re-fetch. */
  push() {
    if (!this.remote || !App.doc) return;
    this.dirty = true;
    this._push();
  },
  _push: debounce(async function () {
    const d = App.doc;
    if (!Sync.remote || !d) return;
    try {
      await fetch('api/proposals/' + encodeURIComponent(d.id) + '?client=' + Sync.cid, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d),
      });
      Sync.dirty = false;
      if (Sync._pendingApply) Sync.scheduleApply();
    } catch (e) { /* keep dirty; next save retries */ }
  }, 900),

  /* ---------- live events (one room per document) ---------- */
  connect(docId) {
    this.disconnect();
    if (!this.remote) return;
    const p = new URLSearchParams({ doc: docId, client: this.cid, name: ME.name, initials: ME.initials, color: ME.color });
    this.es = new EventSource('api/events?' + p.toString());
    this.es.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch (x) { return; }
      if (m.type === 'presence' && App.view === 'editor') {
        App.presence = (m.users || []).filter(u => u.cid !== this.cid);
        renderPresence();
      }
      if (m.type === 'doc' && App.doc && m.id === App.doc.id && m.by !== this.cid) this.scheduleApply();
      if (m.type === 'assets' && m.by !== this.cid) this.pullAssets().catch(() => {});
      if (m.type === 'settings' && m.by !== this.cid) {
        this.pullSettings().then(() => {
          if (App.view === 'home') renderHome();
          else if (App.view === 'editor') { renderLibrary(); toast('Workspace settings were updated by a teammate'); }
          else if (App.view === 'admin') toast('Workspace settings were updated by a teammate — reopen the section to see their changes');
        }).catch(() => {});
      }
      if (m.type === 'index' && App.view === 'home' && m.by !== this.cid) {
        this.refreshIndex().then(l => { if (l && App.view === 'home') renderHome(); });
      }
    };
  },
  disconnect() {
    if (this.es) { this.es.close(); this.es = null; }
    App.presence = [];
  },

  /* Apply a peer's update — but never clobber text mid-keystroke: wait until
     our own push settles and the cursor leaves the page. */
  scheduleApply: debounce(function () {
    Sync._apply();
  }, 500),
  async _apply() {
    if (!App.doc) return;
    if (this.dirty) { this._pendingApply = true; return; }
    const typing = document.activeElement && document.activeElement.closest && document.activeElement.closest('#canvas');
    if (typing) {
      this._pendingApply = true;
      setTimeout(() => { if (this._pendingApply) this._apply(); }, 2500);
      return;
    }
    this._pendingApply = false;
    try {
      const r = await fetch('api/proposals/' + encodeURIComponent(App.doc.id));
      if (!r.ok) return;
      const fresh = await r.json();
      if (!App.doc || fresh.id !== App.doc.id) return;         // navigated away mid-fetch
      if (this.dirty) { this._pendingApply = true; return; }   // raced with a local edit
      Store.normalize(fresh);
      const sc = $('#canvasScroll');
      const keep = sc ? sc.scrollTop : 0;
      App.doc = fresh;
      Store.writeDoc(fresh);
      renderEditor();
      if (typeof History !== 'undefined') History.onChange('seal');   // teammate's state becomes an undo step
      const sc2 = $('#canvasScroll');
      if (sc2) requestAnimationFrame(() => { sc2.scrollTop = keep; });
      toast('Updated with a teammate’s changes');
    } catch (e) { /* transient — next ping retries */ }
  },

  /* ---------- shared workspace settings ---------- */
  async pullSettings() {
    const r = await fetch('api/settings');
    if (!r.ok) return;
    const s = await r.json();
    if (s && typeof s === 'object' && !s.error && Object.keys(s).length) Settings.adopt(s);
  },

  /* ---------- shared asset library (cover art, signatures) ---------- */
  async pullAssets() {
    const r = await fetch('api/assets');
    if (!r.ok) return;
    const a = await r.json();
    if (a && Array.isArray(a.bgs)) localStorage.setItem('fss.assets.bgs', JSON.stringify(a.bgs));
    if (a && a.sigs) localStorage.setItem('fss.assets.sigs', JSON.stringify(a.sigs));
  },
  /* Flush an unpushed doc when the tab hides or closes — the debounced PUT
     would otherwise drop the last ~second of edits from the shared copy.
     sendBeacon caps out around 64KB, so large docs fall back to a fetch,
     which completes whenever the page is hidden rather than fully closed. */
  flushOnExit() {
    if (!this.remote || !this.dirty || !App.doc) return;
    const body = JSON.stringify(App.doc);
    const url = 'api/proposals/' + encodeURIComponent(App.doc.id) + '/flush?client=' + this.cid;
    let sent = false;
    if (navigator.sendBeacon) {
      try { sent = navigator.sendBeacon(url, new Blob([body], { type: 'application/json' })); } catch (e) {}
    }
    if (sent) { this.dirty = false; return; }
    fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    }).then(() => { Sync.dirty = false; }).catch(() => {});
  },

  pushAssets: debounce(function () {
    if (!Sync.remote) return;
    fetch('api/assets?client=' + Sync.cid, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bgs: AssetStore.bgs(), sigs: SigStore.all() }),
    }).catch(() => {});
  }, 800),
};

window.addEventListener('pagehide', () => Sync.flushOnExit());
document.addEventListener('visibilitychange', () => { if (document.hidden) Sync.flushOnExit(); });
