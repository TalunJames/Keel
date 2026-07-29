/* ============ Keel integration bridge ============
   Wires dashboard auth, team directory, and client context into the
   vendored proposal builder. Loaded after data.js, before settings.js. */
'use strict';

/* This file only ships in the Keel shell (index-keel.html), so its presence IS
   the embed signal. Keel's CSP blocks inline scripts, so the flag must be set
   from an external script — not from the HTML. */
window.__KEEL_EMBED__ = true;

const KeelBridge = {
  ready: false,
  workspace: null,
  clients: [],
  clientId: null,

  async init() {
    if (!window.__KEEL_EMBED__) return false;
    try {
      const params = new URLSearchParams(location.search);
      const clientQ = params.get('clientId');
      const url = 'api/workspace' + (clientQ && clientQ !== 'all' ? '?clientId=' + encodeURIComponent(clientQ) : '');
      const r = await fetch(url, { credentials: 'same-origin' });
      if (!r.ok) throw new Error('workspace bootstrap failed');
      this.workspace = await r.json();
      this.clients = this.workspace.clients || [];
      this.clientId = this.workspace.clientId || clientQ || null;
      this.applyIdentity();
      this.patchSettings();
      this.ready = true;
      return true;
    } catch (e) {
      console.warn('[keel-bridge] init failed', e);
      return false;
    }
  },

  applyIdentity() {
    const ws = this.workspace;
    if (!ws?.me) return;

    USERS.length = 0;
    (ws.users || []).forEach((u) => USERS.push({
      id: u.id,
      name: u.name,
      initials: u.initials,
      color: u.color,
    }));

    const me = USERS.find((u) => u.id === ws.me.id) || {
      id: ws.me.id,
      name: ws.me.name,
      initials: ws.me.initials,
      color: ws.me.color,
    };
    if (!USERS.some((u) => u.id === me.id)) USERS.unshift(me);
    setCurrentUser(me.id);

    window.KEEL_CLIENTS = this.clients;
    window.KEEL_CLIENT_ID = this.clientId;
    window.KEEL_IS_ADMIN = !!ws.isAdmin;
  },

  patchSettings() {
    const origIsOwner = Settings.isOwner.bind(Settings);
    const origIsAdmin = Settings.isAdmin.bind(Settings);

    Settings.isOwner = (uid) => {
      if (window.__KEEL_EMBED__ && window.KEEL_IS_ADMIN) return true;
      return origIsOwner(uid);
    };

    Settings.isAdmin = (uid) => {
      if (window.__KEEL_EMBED__ && window.KEEL_IS_ADMIN) return true;
      const id = uid || ME.id;
      return origIsAdmin(id) || (Settings.data.access.admins || []).includes(id);
    };
  },

  bindAgencyInput(input) {
    if (!input || !this.clients.length) return;
    const listId = 'keel-agency-list';
    let dl = document.getElementById(listId);
    if (!dl) {
      dl = document.createElement('datalist');
      dl.id = listId;
      document.body.appendChild(dl);
    }
    dl.innerHTML = this.clients.map((c) => `<option value="${esc(c.name)}"></option>`).join('');
    input.setAttribute('list', listId);
    input.addEventListener('change', () => {
      const match = this.clients.find((c) => c.name.toLowerCase() === input.value.trim().toLowerCase());
      if (match) {
        input.dataset.keelClientId = match.id;
        input.dataset.keelClientType = match.editorClientType || 'county';
      } else {
        delete input.dataset.keelClientId;
        delete input.dataset.keelClientType;
      }
    });
  },

  resolveClientForWizard(agencyInput, selectedClientType) {
    const fromInput = agencyInput?.dataset?.keelClientId;
    if (fromInput) return { clientId: fromInput, clientType: agencyInput.dataset.keelClientType || selectedClientType };
    if (this.clientId && this.clientId !== 'all') {
      const c = this.clients.find((x) => x.id === this.clientId);
      return { clientId: this.clientId, clientType: c?.editorClientType || selectedClientType };
    }
    const byName = this.clients.find((c) => c.name.toLowerCase() === (agencyInput?.value || '').trim().toLowerCase());
    if (byName) return { clientId: byName.id, clientType: byName.editorClientType || selectedClientType };
    return { clientId: null, clientType: selectedClientType };
  },

  /* Tell the Keel shell whether the iframe is on the proposal list, an open
     document, or workspace admin — so the parent can hide its top bar. */
  notifyShell(view) {
    if (!window.__KEEL_EMBED__ || window.parent === window) return;
    try {
      window.parent.postMessage(
        { source: 'keel-proposals', type: 'view', view: view || 'home' },
        window.location.origin
      );
    } catch (e) { /* ignore */ }
  },
};

window.KeelBridge = KeelBridge;
