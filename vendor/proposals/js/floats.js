/* ============ Fog Signal Proposals — floating objects ============
   Free-floating text boxes, signature stamps (Acrobat-style), and images.
   Floats belong to a page (sheet), carry x/y/w[/h], and are dragged and
   resized directly. They ride along in PDF export exactly as placed and
   degrade to inline elements in Word export.                            */
'use strict';

const floatEls = new Map();   // floatId -> element

function docFloats() {
  if (!App.doc.floats) App.doc.floats = [];
  return App.doc.floats;
}

/* ---------- rendering (called at the end of every paginate) ---------- */
function renderFloats() {
  const sheets = $$('#canvas .sheet');
  if (!sheets.length || !App.doc) return;
  $$('#canvas .float-obj').forEach(el => {
    if (!docFloats().some(f => f.id === el.dataset.fid)) el.remove();
  });
  docFloats().forEach(f => {
    f.page = Math.min(Math.max(1, f.page || 1), sheets.length);
    const sheet = sheets[f.page - 1];
    let el = floatEls.get(f.id);
    if (el && el.isConnected && el.contains(document.activeElement)) {
      if (el.parentElement !== sheet) sheet.appendChild(el);   // keep the caret alive
      return;
    }
    if (el) el.remove();
    el = buildFloatEl(f);
    floatEls.set(f.id, el);
    sheet.appendChild(el);
  });
}

function buildFloatEl(f) {
  let inner = '';
  if (f.type === 'text') {
    inner = `<div class="float-text ed-float" contenteditable="${App.mode !== 'viewing'}" spellcheck="true">${f.html || '<p data-ph="Type here…"></p>'}</div>`;
  } else if (f.type === 'signature') {
    const sig = SigStore.get(f.staffId);
    inner = sig ? `<img class="float-img" src="${sig}" draggable="false" alt="Signature">`
                : `<div class="float-nosig">${icon('image', 14)} No signature on file for ${esc((staffById(f.staffId) || {}).name || 'this person')}</div>`;
  } else {
    inner = `<img class="float-img" src="${f.src}" draggable="false" alt="">`;
  }
  const el = htmlToEl(`<div class="float-obj ft-${f.type} ${App.selFloat === f.id ? 'sel' : ''}" data-fid="${f.id}"
    style="left:${f.x}px;top:${f.y}px;width:${f.w}px;${f.h ? `min-height:${f.h}px;` : ''}">
    <div class="float-grip" contenteditable="false" title="Drag to move">${icon('drag', 12)}</div>
    <div class="float-tools" contenteditable="false">
      ${f.type !== 'text' ? `<button class="fbtn" data-fact="pin" title="Pin into the text flow (becomes a normal block)">${icon('doc', 12)}</button>` : ''}
      <button class="fbtn danger" data-fact="del" title="Delete">${icon('trash', 12)}</button>
    </div>
    ${inner}
    ${['nw', 'ne', 'sw', 'se'].map(h => `<span class="fh fh-${h}" data-fh="${h}" contenteditable="false"></span>`).join('')}
  </div>`);
  bindFloat(el, f);
  return el;
}

function bindFloat(el, f) {
  el.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    if (App.mode === 'viewing') return;
    selectFloat(f.id);
    if (e.target.closest('.fbtn')) return;
    const fh = e.target.closest('[data-fh]');
    if (fh) { e.preventDefault(); startFloatResize(f, el, fh.dataset.fh, e); return; }
    const onText = e.target.closest('.ed-float');
    if (e.target.closest('.float-grip') || (f.type !== 'text' && !onText) || (f.type !== 'text' && onText)) {
      e.preventDefault();
      startFloatDrag(f, el, e);
    }
    // text floats: clicks in the body place the caret; drag via the grip
  });
  const ed = el.querySelector('.ed-float');
  if (ed) {
    ed.addEventListener('input', () => { f.html = ed.innerHTML; saveDoc(); });
    ed.addEventListener('blur', () => { f.html = ed.innerHTML; saveDoc(); });
  }
  el.querySelector('[data-fact="del"]')?.addEventListener('click', () => removeFloat(f.id));
  el.querySelector('[data-fact="pin"]')?.addEventListener('click', () => pinFloat(f));
}

function selectFloat(id) {
  App.selFloat = id;
  $$('#canvas .float-obj').forEach(el => el.classList.toggle('sel', el.dataset.fid === id));
  if (id) {
    App.selectedBlock = null;
    $$('#canvas .blockwrap.sel').forEach(w => w.classList.remove('sel'));
  }
}

function removeFloat(id) {
  App.doc.floats = docFloats().filter(f => f.id !== id);
  floatEls.get(id)?.remove();
  floatEls.delete(id);
  if (App.selFloat === id) App.selFloat = null;
  saveDoc();
  toast('Removed');
}

/* Convert a stamp / floating image back into a normal in-flow block. */
function pinFloat(f) {
  const contentW = pageDims().w - 2 * pageMargin();
  const lastOnPage = App.doc.blocks.filter(b => (blockPageMap.get(b.id) || 1) === f.page).pop();
  const idx = lastOnPage ? App.doc.blocks.indexOf(lastOnPage) + 1 : App.doc.blocks.length;
  if (f.type === 'signature') addBlock('signature', idx, { staffId: f.staffId, width: Math.min(360, f.w) }, { scroll: false });
  if (f.type === 'image') addBlock('image', idx, { src: f.src, width: Math.max(15, Math.min(100, Math.round(f.w / contentW * 100))) }, { scroll: false });
  removeFloat(f.id);
}

/* ---------- drag / resize ---------- */
function clampFloat(f) {
  const dims = pageDims();
  f.x = Math.max(-20, Math.min(f.x, dims.w - Math.min(f.w, 80)));
  f.y = Math.max(0, Math.min(f.y, dims.h - 36));
}

function startFloatDrag(f, el, e) {
  const z = App.zoom || 1;
  const r0 = el.getBoundingClientRect();
  const gx = e.clientX - r0.left, gy = e.clientY - r0.top;
  el.classList.add('dragging');
  const move = (ev) => {
    const sheets = $$('#canvas .sheet');
    let si = sheets.findIndex(s => { const r = s.getBoundingClientRect(); return ev.clientY >= r.top && ev.clientY <= r.bottom; });
    if (si < 0) si = f.page - 1;
    const sr = sheets[si].getBoundingClientRect();
    f.page = si + 1;
    f.x = Math.round((ev.clientX - gx - sr.left) / z);
    f.y = Math.round((ev.clientY - gy - sr.top) / z);
    clampFloat(f);
    if (el.parentElement !== sheets[si]) sheets[si].appendChild(el);
    el.style.left = f.x + 'px'; el.style.top = f.y + 'px';
  };
  const up = () => {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
    el.classList.remove('dragging');
    saveDoc();
  };
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}

function startFloatResize(f, el, dir, e) {
  const z = App.zoom || 1;
  const sx = e.clientX, sy = e.clientY;
  const o = { x: f.x, y: f.y, w: f.w, h: f.h || el.offsetHeight };
  const move = (ev) => {
    const dx = (ev.clientX - sx) / z, dy = (ev.clientY - sy) / z;
    if (dir.includes('e')) f.w = Math.max(60, Math.round(o.w + dx));
    if (dir.includes('w')) { f.w = Math.max(60, Math.round(o.w - dx)); f.x = Math.round(o.x + (o.w - f.w)); }
    if (f.type === 'text') {
      if (dir.includes('s')) f.h = Math.max(30, Math.round(o.h + dy));
      if (dir.includes('n')) { f.h = Math.max(30, Math.round(o.h - dy)); f.y = Math.round(o.y + (o.h - f.h)); }
    }
    el.style.left = f.x + 'px'; el.style.top = f.y + 'px';
    el.style.width = f.w + 'px';
    if (f.h) el.style.minHeight = f.h + 'px';
  };
  const up = () => {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
    saveDoc();
  };
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}

/* ---------- insertion ---------- */
function currentPageIndex() {
  const sc = $('#canvasScroll');
  const probe = sc.getBoundingClientRect().top + 220;
  const sheets = $$('#canvas .sheet');
  const i = sheets.findIndex(s => s.getBoundingClientRect().bottom > probe);
  return i < 0 ? sheets.length - 1 : i;
}

function addFloat(type, extra = {}) {
  const dims = pageDims();
  const page = currentPageIndex() + 1;
  const n = docFloats().filter(f => f.page === page).length;
  const f = {
    id: uid('fl'), type, page,
    w: type === 'text' ? 280 : type === 'signature' ? 220 : 300,
    x: Math.round(dims.w / 2 - 140) + n * 18,
    y: 160 + n * 18,
    ...extra,
  };
  docFloats().push(f);
  saveDoc();
  renderFloats();
  selectFloat(f.id);
  if (type === 'text') setTimeout(() => floatEls.get(f.id)?.querySelector('.ed-float')?.focus(), 60);
  toast(type === 'text' ? 'Text box added — grip to move, corners to resize'
      : type === 'signature' ? 'Signature stamped — drag it anywhere' : 'Image placed — drag it anywhere');
  return f;
}

/* Stamp menu: pick whose signature to stamp (uploads if none on file). */
function openStampMenu(anchor) {
  const card = popover(anchor, `
    <div class="menu-kicker">Stamp a signature</div>
    ${staffAll().map(s => `<div class="menu-row" data-stamp="${s.id}">
      <span class="avatar sm" style="background:${s.color}">${s.initials}</span>
      <div><b>${esc(s.name)}</b><small>${SigStore.get(s.id) ? 'On file — stamps instantly' : 'No signature yet — you’ll upload one'}</small></div>
    </div>`).join('')}
    <div class="menu-sep"></div>
    <div class="menu-row" data-stamp-img="1"><span class="xbadge" style="background:var(--fs-bone-100);color:var(--fs-navy)">${icon('image', 14)}</span><div><b>Floating image</b><small>Place any picture freely on the page</small></div></div>`,
    { width: 265 });
  card.querySelectorAll('[data-stamp]').forEach(r => r.addEventListener('click', async () => {
    const staffId = r.dataset.stamp;
    closePopovers();
    if (!SigStore.get(staffId)) {
      const file = await pickFile('image/png,image/jpeg,image/webp');
      if (!file) return;
      SigStore.set(staffId, await fileToDataURL(file, 700));
      toast('Signature saved to the library');
    }
    addFloat('signature', { staffId });
  }));
  card.querySelector('[data-stamp-img]').addEventListener('click', async () => {
    closePopovers();
    const file = await pickFile('image/*');
    if (!file) return;
    addFloat('image', { src: await fileToDataURL(file, 1600) });
  });
}
