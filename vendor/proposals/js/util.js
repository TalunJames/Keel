/* ============ Fog Signal Proposals — utilities ============ */
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

let __uid = Date.now() % 100000;
const uid = (p = 'x') => `${p}_${(++__uid).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const fmtMoney = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
const fmtMoney2 = (n) => '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function debounce(fn, ms) {
  let t;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.cancel = () => clearTimeout(t);
  return d;
}

function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 86400 * 7) return Math.floor(s / 86400) + 'd ago';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T17:00:00');
  return Math.ceil((d - new Date()) / 86400000);
}

function initialsOf(name) {
  return (name || '?').split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

/* Build a DOM element from an HTML string (single root). */
function htmlToEl(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/* ---------- SVG icon set (stroke icons, 24 viewbox) ---------- */
const ICONS = {
  back: '<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>',
  blocks: '<path d="M4 4h7v7H4z"/><path d="M13 4h7v7h-7z"/><path d="M4 13h7v7H4z"/><path d="M13 13h7v7h-7z"/>',
  outline: '<path d="M4 6h16"/><path d="M8 12h12"/><path d="M8 18h12"/><path d="M4 12h.01"/><path d="M4 18h.01"/>',
  comment: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  rfp: '<path d="M8 3h8l3 3v15H5V3z"/><path d="M9 9h6M9 13h6M9 17h4"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  drag: '<circle cx="9" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.4" fill="currentColor" stroke="none"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="M21 16l-5-5L5 21"/>',
  link: '<path d="M9 15l6-6"/><path d="M11 6l1-1a4 4 0 0 1 6 6l-1 1"/><path d="M13 18l-1 1a4 4 0 0 1-6-6l1-1"/>',
  listUl: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="3.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="3.5" cy="18" r="1.3" fill="currentColor" stroke="none"/>',
  listOl: '<path d="M10 6h11M10 12h11M10 18h11"/><path d="M4 4v4M4 8h1M3 12h2l-2 2.5h2M3 20h2v-4"/>',
  alignL: '<path d="M3 6h18M3 12h12M3 18h15"/>',
  alignC: '<path d="M3 6h18M6 12h12M5 18h14"/>',
  alignR: '<path d="M3 6h18M9 12h12M6 18h15"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  eraser: '<path d="M20 20H8.5l-5-5a2 2 0 0 1 0-2.8l8.8-8.8a2 2 0 0 1 2.8 0l5 5a2 2 0 0 1 0 2.8L13 18"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 3.5a3 3 0 0 1 0 9"/><path d="M21 20a6 6 0 0 0-5-5.9"/>',
  doc: '<path d="M8 3h8l3 3v15H5V3z"/><path d="M9 12h6M9 16h6"/>',
  chevL: '<path d="M15 6l-6 6 6 6"/>',
  chevR: '<path d="M9 6l6 6-6 6"/>',
  panelL: '<path d="M15 6l-6 6 6 6"/><path d="M4 4v16"/>',
  panelR: '<path d="M9 6l6 6-6 6"/><path d="M20 4v16"/>',
  calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8"/><path d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01"/>',
  send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 7-20z" transform="scale(1)"/>',
  bolt: '<path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/>',
  dots: '<circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none"/>',
  textbox: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10h10M7 14h6"/>',
  stamp: '<path d="M9.5 8.5c0-3 1-5.5 2.5-5.5s2.5 2.5 2.5 5.5c0 2-.8 3-.8 4.5h-3.4c0-1.5-.8-2.5-.8-4.5z"/><path d="M6 17v-1.5c0-1.4 1.2-2.5 2.6-2.5h6.8c1.4 0 2.6 1.1 2.6 2.5V17z"/><path d="M5 20.5h14"/>',
  margins: '<rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="7" width="10" height="10" rx="1" stroke-dasharray="2.5 2.5"/>',
  upload: '<path d="M12 15V4"/><path d="M7 8l5-5 5 5"/><path d="M4 20h16"/>',
  indent: '<path d="M3 5h18M11 9h10M11 13h10M3 17h18"/><path d="M3 9l4 3-4 3"/>',
  outdent: '<path d="M3 5h18M11 9h10M11 13h10M3 17h18"/><path d="M7 9l-4 3 4 3"/>',
  listopts: '<path d="M9 6h12M9 12h12M9 18h6"/><circle cx="4" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="18.5" r="2.6"/><path d="M19 15v1M19 21v1M22 18.5h-1M17 18.5h-1"/>',
  highlighter: '<path d="M9 11l6.5-6.5a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 1 0 2.8L13 15z"/><path d="M9 11l-1.8 1.8a1.5 1.5 0 0 0 0 2.1l1.9 1.9a1.5 1.5 0 0 0 2.1 0L13 15"/><path d="M5 19l2.2-2.2"/>',
};
function icon(name, size = 16, sw = 1.9) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

/* ---------- file helpers ---------- */
function pickFile(accept) {
  return new Promise(res => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = accept || 'image/*';
    input.onchange = () => res(input.files[0] || null);
    input.click();
  });
}
/* Read an image file as a data URL, downscaled so localStorage stays small. */
function fileToDataURL(file, maxW = 1600) {
  return new Promise(res => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        if (img.width <= maxW) { res(fr.result); return; }
        const c = document.createElement('canvas');
        const k = maxW / img.width;
        c.width = maxW; c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const keepPng = /png|gif|svg/.test(file.type);
        res(c.toDataURL(keepPng ? 'image/png' : 'image/jpeg', 0.85));
      };
      img.onerror = () => res(fr.result);
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

/* App-level asset libraries (browser-local until the backend hookup). */
const AssetStore = {
  bgs() { try { return JSON.parse(localStorage.getItem('fss.assets.bgs')) || []; } catch (e) { return []; } },
  addBg(name, src) {
    const l = this.bgs();
    l.unshift({ id: uid('bg'), name: name || 'Cover art', src, ts: Date.now() });
    if (l.length > 12) l.length = 12;
    localStorage.setItem('fss.assets.bgs', JSON.stringify(l));
    if (typeof Sync !== 'undefined') Sync.pushAssets();
    return l[0];
  },
  bg(id) { return this.bgs().find(b => b.id === id) || null; },
  removeBg(id) { localStorage.setItem('fss.assets.bgs', JSON.stringify(this.bgs().filter(b => b.id !== id))); },
};
const SigStore = {
  all() { try { return JSON.parse(localStorage.getItem('fss.assets.sigs')) || {}; } catch (e) { return {}; } },
  get(staffId) { return this.all()[staffId] || null; },
  set(staffId, src) {
    const m = this.all(); m[staffId] = src;
    localStorage.setItem('fss.assets.sigs', JSON.stringify(m));
    if (typeof Sync !== 'undefined') Sync.pushAssets();
  },
};
const Pref = {
  get(k, dflt) { const v = localStorage.getItem('fss.pref.' + k); return v === null ? dflt : v === '1'; },
  set(k, v) { localStorage.setItem('fss.pref.' + k, v ? '1' : '0'); },
};

/* ---------- toast ---------- */
let __toastTimer = null;
function toast(msg, ms = 2600) {
  const host = $('#toasts');
  host.innerHTML = `<div class="toast pop"><span class="toast-dot"></span>${esc(msg)}</div>`;
  clearTimeout(__toastTimer);
  __toastTimer = setTimeout(() => { host.innerHTML = ''; }, ms);
}

/* ---------- generic popover / modal management ---------- */
function closePopovers() {
  $$('#overlays .pop-layer').forEach(n => n.remove());
}
/* Show a popover anchored to a button rect. content = HTML string. */
function popover(anchorEl, html, opts = {}) {
  closePopovers();
  const layer = htmlToEl(`<div class="pop-layer"></div>`);
  const card = htmlToEl(`<div class="popcard pop" style="width:${opts.width || 260}px">${html}</div>`);
  layer.appendChild(card);
  $('#overlays').appendChild(layer);
  const r = anchorEl.getBoundingClientRect();
  card.style.top = Math.min(r.bottom + 6, window.innerHeight - 80) + 'px';
  if (opts.align === 'left') card.style.left = Math.max(8, r.left) + 'px';
  else card.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
  if (opts.maxHeight) { card.style.maxHeight = opts.maxHeight; card.style.overflowY = 'auto'; }
  layer.addEventListener('mousedown', (e) => { if (e.target === layer) closePopovers(); });
  return card;
}
function modal(html, opts = {}) {
  closePopovers();
  const layer = htmlToEl(`<div class="pop-layer dim"></div>`);
  const card = htmlToEl(`<div class="modalcard pop" style="width:${opts.width || 520}px">${html}</div>`);
  layer.appendChild(card);
  $('#overlays').appendChild(layer);
  layer.addEventListener('mousedown', (e) => { if (e.target === layer && !opts.sticky) closePopovers(); });
  return card;
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePopovers();
});
