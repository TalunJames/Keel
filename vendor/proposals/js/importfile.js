/* ============ Fog Signal Proposals — inline file import ============
   Insert a PDF or Word (.docx) file into the middle of a proposal.
   PDF: pages render to images (pdf.js, lazy-loaded from CDN) and insert
        as full-bleed pages — pixel-exact in the editor and PDF export.
   DOCX: unzipped in the browser (DecompressionStream) and converted to
        editable text blocks — headings, bold/italic/underline, lists,
        tables, and embedded images come across.                        */
'use strict';

/* ---------- entry point (used by the Pages panel) ---------- */
async function insertFileAfterPage(pi) {
  const file = await pickFile('.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  if (!file) return;
  const gs = pageGroups();
  const anchor = (pi != null && gs[pi]) ? gs[pi][gs[pi].length - 1] : null;
  const idx = anchor ? App.doc.blocks.indexOf(anchor) + 1 : App.doc.blocks.length;
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return importPDF(file, idx);
  if (name.endsWith('.docx')) return importDOCX(file, idx);
  if (name.endsWith('.doc')) { toast('Old .doc format isn’t supported — save it as .docx or PDF first'); return; }
  toast('Use a .pdf or .docx file');
}

function importProgress(title) {
  const card = modal(`
    <div class="pophead">${icon('doc', 15)}<b>${esc(title)}</b></div>
    <div class="popbody"><div class="rfp-bar" style="margin:2px 0 10px"><div id="impBar" style="width:4%"></div></div>
    <div class="set-hint" id="impMsg" style="margin:0">Reading file…</div></div>`, { width: 380, sticky: true });
  return {
    set(msg, frac) {
      const m = card.querySelector('#impMsg'), b = card.querySelector('#impBar');
      if (m) m.textContent = msg;
      if (b && frac != null) b.style.width = Math.round(frac * 100) + '%';
    },
    done() { closePopovers(); },
  };
}

/* =================== PDF =================== */
let _pdfjsPromise = null;
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (_pdfjsPromise) return _pdfjsPromise;
  _pdfjsPromise = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      res(window.pdfjsLib);
    };
    s.onerror = () => { _pdfjsPromise = null; rej(new Error('pdf.js failed to load')); };
    document.head.appendChild(s);
  });
  return _pdfjsPromise;
}

async function importPDF(file, insertIdx) {
  const prog = importProgress(`Inserting ${file.name}`);
  try {
    prog.set('Loading the PDF engine…', 0.05);
    const pdfjs = await loadPdfJs();
    const buf = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    const blocks = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      prog.set(`Rendering page ${i} of ${pdf.numPages}…`, 0.1 + 0.8 * (i / pdf.numPages));
      const page = await pdf.getPage(i);
      const vp1 = page.getViewport({ scale: 1 });
      const scale = 1224 / vp1.width;                       // ~1.5× letter width for crisp text
      const vp = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      blocks.push({ id: uid('b'), type: 'pdfpage', src: canvas.toDataURL('image/jpeg', 0.82), fileName: file.name, pageNo: i, pageCount: pdf.numPages });
    }
    prog.set('Placing pages…', 0.95);
    App.doc.blocks.splice(insertIdx, 0, ...blocks);
    saveDoc();
    renderCanvas();
    prog.done();
    toast(`Inserted ${pdf.numPages} page${pdf.numPages > 1 ? 's' : ''} from ${file.name}`);
    setTimeout(() => blockEls.get(blocks[0].id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  } catch (e) {
    prog.done();
    toast(e.message.includes('load') ? 'PDF import needs internet access the first time (loads pdf.js)' : 'Could not read that PDF');
  }
}

/* =================== DOCX =================== */
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/* Minimal ZIP reader — central directory + DecompressionStream('deflate-raw'). */
function zipEntries(buf) {
  const dv = new DataView(buf);
  let e = buf.byteLength - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('Not a zip');
  const count = dv.getUint16(e + 10, true);
  let off = dv.getUint32(e + 16, true);
  const out = new Map();
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break;
    const method = dv.getUint16(off + 10, true);
    const csize = dv.getUint32(off + 20, true);
    const nlen = dv.getUint16(off + 28, true), elen = dv.getUint16(off + 30, true), clen = dv.getUint16(off + 32, true);
    const lho = dv.getUint32(off + 42, true);
    const name = new TextDecoder().decode(new Uint8Array(buf, off + 46, nlen));
    const lnlen = dv.getUint16(lho + 26, true), lelen = dv.getUint16(lho + 28, true);
    out.set(name, { method, comp: new Uint8Array(buf, lho + 30 + lnlen + lelen, csize) });
    off += 46 + nlen + elen + clen;
  }
  return out;
}
async function zipData(entry) {
  if (!entry) return null;
  if (entry.method === 0) return entry.comp;
  const stream = new Blob([entry.comp]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function zipText(entries, name) {
  const d = await zipData(entries.get(name));
  return d ? new TextDecoder().decode(d) : null;
}

async function importDOCX(file, insertIdx) {
  const prog = importProgress(`Inserting ${file.name}`);
  try {
    const entries = zipEntries(await file.arrayBuffer());
    prog.set('Unpacking the document…', 0.2);
    const docXml = await zipText(entries, 'word/document.xml');
    if (!docXml) throw new Error('No document.xml');
    const relsXml = await zipText(entries, 'word/_rels/document.xml.rels');

    // relationship id -> media path
    const rels = {};
    if (relsXml) {
      const rdoc = new DOMParser().parseFromString(relsXml, 'application/xml');
      [...rdoc.getElementsByTagName('Relationship')].forEach(r => { rels[r.getAttribute('Id')] = r.getAttribute('Target'); });
    }
    const mediaCache = {};
    async function mediaDataURL(rid) {
      const target = rels[rid];
      if (!target) return null;
      const path = 'word/' + target.replace(/^\.?\//, '');
      if (mediaCache[path]) return mediaCache[path];
      const data = await zipData(entries.get(path));
      if (!data) return null;
      const ext = path.split('.').pop().toLowerCase();
      const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }[ext] || 'image/png';
      const url = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(new Blob([data], { type: mime })); });
      mediaCache[path] = url;
      return url;
    }

    prog.set('Converting formatting…', 0.45);
    const xml = new DOMParser().parseFromString(docXml, 'application/xml');
    const body = xml.getElementsByTagNameNS(W_NS, 'body')[0];
    if (!body) throw new Error('Malformed docx');

    const q = (el, tag) => el.getElementsByTagNameNS(W_NS, tag);
    const attr = (el, name) => el.getAttributeNS(W_NS, name) || el.getAttribute('w:val') || el.getAttribute(name);

    async function runHTML(r) {
      let t = '';
      for (const n of [...r.childNodes]) {
        if (n.localName === 't') t += esc(n.textContent);
        else if (n.localName === 'br') t += '<br>';
        else if (n.localName === 'tab') t += '&emsp;';
        else if (n.localName === 'drawing') {
          const blip = n.getElementsByTagNameNS(A_NS, 'blip')[0];
          const rid = blip && blip.getAttributeNS(R_NS, 'embed');
          const src = rid && await mediaDataURL(rid);
          if (src) {
            const ext = n.getElementsByTagName('wp:extent')[0] || n.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', 'extent')[0];
            const w = ext ? Math.min(648, Math.round(parseInt(ext.getAttribute('cx')) / 9525)) : 420;
            t += `<img src="${src}" style="max-width:100%;width:${w}px">`;
          }
        }
      }
      const rPr = q(r, 'rPr')[0];
      if (rPr && t) {
        const on = (tag) => { const el = q(rPr, tag)[0]; return el && attr(el, 'val') !== '0' && attr(el, 'val') !== 'false' && attr(el, 'val') !== 'none'; };
        if (on('b')) t = `<b>${t}</b>`;
        if (on('i')) t = `<i>${t}</i>`;
        if (on('u')) t = `<u>${t}</u>`;
      }
      return t;
    }

    async function paraHTML(p) {
      let inner = '';
      for (const r of [...q(p, 'r')]) inner += await runHTML(r);
      const styleEl = q(p, 'pStyle')[0];
      const style = styleEl ? (attr(styleEl, 'val') || '') : '';
      const isList = q(p, 'numPr').length > 0;
      if (isList) return { kind: 'li', html: `<li>${inner || '&nbsp;'}</li>` };
      const tag = /^Title/i.test(style) ? 'h1' : /Heading1/i.test(style) ? 'h2' : /Heading2/i.test(style) ? 'h3' : /Heading[3-6]/i.test(style) ? 'h4' : 'p';
      if (!inner.trim() && tag === 'p') return { kind: 'skip' };
      return { kind: tag.startsWith('h') ? 'heading' : 'p', html: `<${tag}>${inner || ''}</${tag}>` };
    }

    async function tableHTML(tbl) {
      let rows = '';
      for (const tr of [...q(tbl, 'tr')].filter(x => x.parentNode.parentNode === tbl || x.parentNode === tbl)) {
        let cells = '';
        for (const tc of [...q(tr, 'tc')]) {
          let cell = '';
          for (const p of [...q(tc, 'p')]) {
            const c = await paraHTML(p);
            if (c.kind !== 'skip') cell += c.html.replace(/^<li>|<\/li>$/g, '');
          }
          cells += `<td>${cell || '&nbsp;'}</td>`;
        }
        rows += `<tr>${cells}</tr>`;
      }
      return `<table class="ptable"><tbody>${rows}</tbody></table>`;
    }

    // walk top-level body children, group list items, split into chunks
    const chunks = [];
    let cur = [], curCount = 0, listBuf = [];
    const flushList = () => { if (listBuf.length) { cur.push(`<ul>${listBuf.join('')}</ul>`); listBuf = []; } };
    const flushChunk = () => { flushList(); if (cur.length) { chunks.push(cur.join('')); cur = []; curCount = 0; } };
    for (const node of [...body.children]) {
      if (node.localName === 'p') {
        const c = await paraHTML(node);
        if (c.kind === 'skip') continue;
        if (c.kind === 'li') { listBuf.push(c.html); curCount++; continue; }
        flushList();
        if (c.kind === 'heading' && curCount > 0) flushChunk();     // new section → new block
        cur.push(c.html); curCount++;
      } else if (node.localName === 'tbl') {
        flushList();
        cur.push(await tableHTML(node)); curCount += 3;
      }
      if (curCount >= 14) flushChunk();                              // keep blocks paginate-able
    }
    flushChunk();
    if (!chunks.length) throw new Error('Nothing readable found');

    prog.set('Placing content…', 0.9);
    const blocks = chunks.map(() => ({ id: uid('b'), type: 'text' }));
    blocks.forEach((b, i) => { App.doc.content[b.id] = chunks[i]; });
    App.doc.blocks.splice(insertIdx, 0, ...blocks);
    saveDoc();
    renderCanvas();
    prog.done();
    toast(`Inserted ${file.name} as ${blocks.length} editable section${blocks.length > 1 ? 's' : ''}`);
    setTimeout(() => blockEls.get(blocks[0].id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  } catch (e) {
    prog.done();
    toast('Could not read that Word file — try saving it as .docx (or PDF for exact pages)');
  }
}
