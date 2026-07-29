/* ============ Fog Signal Proposals — Claude AI client ============
   Thin wrappers over the server-side AI proxy (/proposals/app/api/ai/*).
   The API key lives on the server only; this file never sees it. All calls
   are same-origin and cookie-authenticated, staff-only on the server.
   Loaded after keel-bridge.js. Gated on the Keel embed. */
'use strict';

const AI = {
  available: null, // null = unknown, true/false after health check

  _url(path) {
    return 'api/ai/' + path.replace(/^\//, '');
  },

  async init() {
    if (!window.__KEEL_EMBED__) { this.available = false; return false; }
    try {
      const r = await fetch(this._url('health'), { credentials: 'same-origin' });
      const j = await r.json();
      this.available = !!(j && j.ok && j.configured);
    } catch {
      this.available = false;
    }
    document.dispatchEvent(new CustomEvent('ai-ready', { detail: { available: this.available } }));
    return this.available;
  },

  ctx(extra = {}) {
    return {
      clientId: window.KEEL_CLIENT_ID || (App.doc && App.doc.keelClientId) || null,
      docId: (App.doc && App.doc.id) || null,
      ...extra,
    };
  },

  async _postJSON(path, body) {
    const r = await fetch(this._url(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body || {}),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || ('Request failed (' + r.status + ')'));
    return j;
  },

  /* ---------- firm context ---------- */
  getFirmContext() {
    return fetch(this._url('firm-context'), { credentials: 'same-origin' }).then((r) => r.json());
  },
  async setFirmContext({ text, coverLetterGuidance } = {}) {
    const body = {};
    if (typeof text === 'string') body.text = text;
    if (typeof coverLetterGuidance === 'string') body.coverLetterGuidance = coverLetterGuidance;
    const r = await fetch(this._url('firm-context'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Save failed');
    return j;
  },

  /* ---------- feature calls ---------- */
  draft(payload) { return this._postJSON('draft', payload); },
  block(payload) { return this._postJSON('block', this.ctx(payload)); },
  cost(payload) { return this._postJSON('cost', this.ctx(payload)); },
  proofread(payload) { return this._postJSON('proofread', this.ctx(payload)); },

  /* ---------- streaming chat ---------- */
  async chat(messages, onDelta) {
    const r = await fetch(this._url('chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(this.ctx({ messages })),
    });
    if (!r.ok || !r.body) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.error || ('Chat failed (' + r.status + ')'));
    }
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let full = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop(); // keep the incomplete tail
      for (const line of lines) {
        const s = line.trim();
        if (!s.startsWith('data:')) continue;
        let ev;
        try { ev = JSON.parse(s.slice(5).trim()); } catch { continue; }
        if (ev.error) throw new Error(ev.error);
        if (ev.done) return full;
        if (ev.t) { full += ev.t; onDelta && onDelta(ev.t, full); }
      }
    }
    return full;
  },
};

window.AI = AI;
document.addEventListener('DOMContentLoaded', () => { AI.init(); });
