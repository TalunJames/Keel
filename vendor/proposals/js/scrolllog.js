/* ============ Fog Signal Proposals — scroll flight recorder ============
   Hidden diagnostic for the "viewport jumps while typing" bug. Records the
   last ~500 scroll-related events (who moved #canvasScroll, from where in
   the code, and whether the user was scrolling) into an in-memory ring
   buffer. No UI, no network, nothing typed is ever recorded — only scroll
   positions, navigation keys, and code stack traces.

   To extract: press ⌘⌥L (Ctrl+Alt+L on Windows) inside the builder — a
   proposal-scroll-log-<time>.json file downloads. Or run
   window.__scrollLogDump() from the console. Suspicious jumps (big scroll
   delta with no recent user input and no code writing scrollTop) are also
   mirrored to console.warn as [scroll-jump].                            */
'use strict';

(function () {
  const MAX = 500;
  const buf = [];
  const t0 = Date.now();
  let lastUserInput = 0;      // last wheel / scrollbar-drag / nav-key, ms
  let lastProgrammatic = 0;   // last scrollTop set from code, ms
  let lastTop = null;

  function now() { return Date.now() - t0; }

  function push(type, data) {
    buf.push(Object.assign({ t: now(), type }, data));
    if (buf.length > MAX) buf.shift();
  }

  function shortStack() {
    return new Error().stack
      .split('\n').slice(3, 8)
      .map(s => s.trim().replace(/^at /, '').replace(location.origin + '/', ''))
      .join(' | ');
  }

  function ctx() {
    const ae = document.activeElement;
    return {
      active: ae ? (ae.dataset && ae.dataset.key) || ae.id || ae.className || ae.tagName : null,
      sel: (typeof App !== 'undefined' && App.selectedBlock) || null,
      sheets: document.querySelectorAll('#canvas .sheet').length,
    };
  }

  const isCanvasScroll = (el) => el && el.id === 'canvasScroll';
  const inCanvas = (el) => !!(el && el.closest && el.closest('#canvasScroll'));

  /* ---- programmatic writes to #canvasScroll.scrollTop, with stacks ---- */
  const desc = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
  Object.defineProperty(Element.prototype, 'scrollTop', {
    configurable: true,
    get() { return desc.get.call(this); },
    set(v) {
      if (isCanvasScroll(this)) {
        lastProgrammatic = Date.now();
        push('set', Object.assign({ from: Math.round(desc.get.call(this)), to: Math.round(v), stack: shortStack() }, ctx()));
      }
      return desc.set.call(this, v);
    },
  });

  ['scrollIntoView', 'scrollBy', 'scrollTo'].forEach((name) => {
    const orig = Element.prototype[name];
    Element.prototype[name] = function (...a) {
      if (isCanvasScroll(this) || inCanvas(this)) {
        lastProgrammatic = Date.now();
        push(name, Object.assign({
          el: (this.dataset && (this.dataset.key || this.dataset.bid)) || this.id || this.className || this.tagName,
          arg: (() => { try { return JSON.stringify(a[0]); } catch (e) { return String(a[0]); } })(),
          stack: shortStack(),
        }, ctx()));
      }
      return orig.apply(this, a);
    };
  });

  /* ---- observed scroll movement + jump heuristic ---- */
  function onScroll(e) {
    if (!isCanvasScroll(e.target)) return;
    const top = Math.round(e.target.scrollTop);
    const delta = lastTop == null ? 0 : top - lastTop;
    if (delta === 0) return;
    const sinceUser = Date.now() - lastUserInput;
    const sinceProg = Date.now() - lastProgrammatic;
    // Big move with no recent user input and no code writing scrollTop
    // = the browser moved the viewport on its own (caret reveal, anchor…).
    const suspicious = Math.abs(delta) > 150 && sinceUser > 500 && sinceProg > 120;
    push(suspicious ? 'JUMP?' : 'scroll', Object.assign({ top, delta, sinceUser, sinceProg }, suspicious ? ctx() : null));
    if (suspicious) console.warn('[scroll-jump]', JSON.stringify(buf[buf.length - 1]));
    lastTop = top;
  }
  document.addEventListener('scroll', onScroll, { capture: true, passive: true });
  // Scroll events don't bubble; renderEditor also rebuilds #canvasScroll, so
  // (re)attach a direct listener whenever we notice a fresh element.
  const attached = new WeakSet();
  function attachScrollListener() {
    const sc = document.getElementById('canvasScroll');
    if (!sc || attached.has(sc)) return;
    attached.add(sc);
    sc.addEventListener('scroll', onScroll, { passive: true });
    lastTop = Math.round(desc.get.call(sc));
  }

  window.addEventListener('wheel', (e) => {
    if (inCanvas(e.target) || isCanvasScroll(e.target)) lastUserInput = Date.now();
  }, { capture: true, passive: true });
  window.addEventListener('mousedown', () => { lastUserInput = Date.now(); }, { capture: true, passive: true });
  window.addEventListener('touchmove', () => { lastUserInput = Date.now(); }, { capture: true, passive: true });

  /* Navigation keys can legitimately scroll — record the key name only,
     never characters. */
  const NAV_KEYS = ['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', 'Enter', 'Backspace', 'Tab'];
  window.addEventListener('keydown', (e) => {
    if (NAV_KEYS.includes(e.key)) { lastUserInput = Date.now(); push('key', { key: e.key }); }
  }, { capture: true, passive: true });

  /* ---- lifecycle markers: wrap the interesting globals once loaded ---- */
  window.addEventListener('DOMContentLoaded', () => {
    attachScrollListener();
    ['paginate', 'renderCanvas', 'renderEditor', 'claimViewport'].forEach((name) => {
      const fn = window[name];
      if (typeof fn !== 'function') return;
      window[name] = function (...a) {
        const sc = document.getElementById('canvasScroll');
        const before = sc ? Math.round(desc.get.call(sc)) : null;
        const r = fn.apply(this, a);
        attachScrollListener();
        if (name !== 'claimViewport') {
          const sc2 = document.getElementById('canvasScroll');
          push(name, Object.assign({ before, after: sc2 ? Math.round(desc.get.call(sc2)) : null, caller: shortStack().split(' | ')[0] }, ctx()));
        }
        return r;
      };
    });
    if (typeof Sync !== 'undefined' && Sync._apply) {
      const orig = Sync._apply.bind(Sync);
      Sync._apply = function () { push('sync-apply', ctx()); return orig(); };
    }
  });

  /* ---- export: ⌘⌥L / Ctrl+Alt+L downloads the buffer ---- */
  function dump() {
    const payload = {
      exportedAt: new Date().toISOString(),
      sinceLoadMs: now(),
      ua: navigator.userAgent,
      zoom: (typeof App !== 'undefined' && App.zoom) || null,
      doc: (typeof App !== 'undefined' && App.doc && App.doc.id) || null,
      mode: (typeof App !== 'undefined' && App.mode) || null,
      events: buf,
    };
    const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'proposal-scroll-log-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    return payload.events.length + ' events exported';
  }
  window.__scrollLogDump = dump;
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.altKey && e.code === 'KeyL') { e.preventDefault(); dump(); }
  }, { capture: true });
})();
