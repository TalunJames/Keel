/* ============ Fog Signal Proposals — export ============
   Word: genuine .docx built by js/docx.js (real OOXML — opens in Word,
   Pages, LibreOffice; converts cleanly in Google Drive; page numbers are
   live PAGE/NUMPAGES fields).
   PDF: prints the app's actual paginated sheets (WYSIWYG, incl. page
   numbers) from a hidden same-origin iframe — popup- and CSP-proof.
   Google Docs: the .docx converts in Drive; rich-clipboard copy also
   carries inline styles + embedded images for direct pasting.            */
'use strict';

/* Unified document typeface — Arial across body and headings, matching the
   editor. Both constants point to the same stack; the names are kept so the
   page-number "serif/sans" toggle and existing rules keep working. */
const W_SERIF = "Arial,Helvetica,sans-serif";
const W_SANS = "Arial,Helvetica,sans-serif";

/* ---------- shared: cleaned document root ---------- */
function exportCleanRoot() {
  const root = document.createElement('div');
  App.doc.blocks.forEach(b => {
    const wrap = blockEls.get(b.id);
    if (!wrap) return;
    if (b.type === 'pagebreak') {
      root.appendChild(htmlToEl(`<br clear="all" style="page-break-before:always">`));
      return;
    }
    const clone = wrap.querySelector('.block-body').cloneNode(true);
    clone.querySelectorAll('.btool,.dz,.cost-open-hint,.img-placeholder,.cover-custom-hint,.sig-placeholder,.assign-tag,.pdf-page-tag').forEach(n => n.remove());
    clone.querySelectorAll('ins[data-sid]').forEach(n => unwrapEl(n));      // suggestions → accepted
    clone.querySelectorAll('del[data-sid]').forEach(n => n.remove());
    clone.querySelectorAll('.cmk').forEach(n => unwrapEl(n));               // strip comment marks
    clone.querySelectorAll('[contenteditable]').forEach(n => n.removeAttribute('contenteditable'));
    clone.querySelectorAll('[data-ph]').forEach(n => { if (!n.textContent.trim()) n.remove(); });

    const div = document.createElement('div');
    div.className = `xblock x-${b.type}`;
    div.dataset.xbid = b.id;
    if (blockBreaksBefore(b) && root.children.length) div.style.pageBreakBefore = 'always';
    div.innerHTML = clone.innerHTML;
    root.appendChild(div);
    if (FULLPAGE_TYPES.includes(b.type)) root.appendChild(htmlToEl(`<br clear="all" style="page-break-before:always">`));
  });

  // floating objects degrade to inline elements after the last block of their page
  (App.doc.floats || []).slice().sort((a, b) => a.page - b.page || a.y - b.y).forEach(f => {
    const lastOnPage = App.doc.blocks.filter(b => (blockPageMap.get(b.id) || 1) === f.page).pop();
    const anchor = lastOnPage ? root.querySelector(`[data-xbid="${lastOnPage.id}"]`) : root.lastElementChild;
    let el = null;
    const wpt = Math.round(f.w * 0.75);
    if (f.type === 'text' && (f.html || '').trim()) {
      el = htmlToEl(`<div class="x-float" style="border:1pt solid #C8C7C1;border-radius:2pt;padding:6pt 8pt;width:${wpt}pt;margin:8pt 0">${f.html}</div>`);
    } else if (f.type === 'signature' && SigStore.get(f.staffId)) {
      el = htmlToEl(`<div class="x-float" style="margin:8pt 0"><img src="${SigStore.get(f.staffId)}" width="${Math.round(f.w)}"></div>`);
    } else if (f.type === 'image' && f.src) {
      el = htmlToEl(`<div class="x-float" style="margin:8pt 0"><img src="${f.src}" width="${Math.round(f.w)}"></div>`);
    }
    if (!el) return;
    if (anchor) anchor.insertAdjacentElement('afterend', el);
    else root.appendChild(el);
  });
  root.querySelectorAll('[data-xbid]').forEach(n => n.removeAttribute('data-xbid'));
  refreshLiveDates(root);   // cover dates re-stamp to the day of export
  return root;
}

/* Fetch same-origin images (e.g. the logo) into data: URLs so they embed. */
async function embedImages(root) {
  const imgs = [...root.querySelectorAll('img')].filter(im => !(im.getAttribute('src') || '').startsWith('data:'));
  await Promise.all(imgs.map(async im => {
    try {
      const r = await fetch(im.getAttribute('src'));
      const blob = await r.blob();
      const dataUrl = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
      im.setAttribute('src', dataUrl);
    } catch (e) { /* leave the original src */ }
  }));
}

/* ---------- Word: inline every style ---------- */
const WORD_RULES = [
  ['p',  `font-family:${W_SANS};font-size:12pt;line-height:1.5;margin:0 0 8pt;color:#0F0F0F`],
  ['li', `font-family:${W_SANS};font-size:12pt;line-height:1.5;margin:0 0 4pt;color:#0F0F0F`],
  ['ul', 'margin:0 0 8pt 22pt'], ['ol', 'margin:0 0 8pt 22pt'],
  ['a',  'color:#1A3A5C'],
  ['h1', `font-family:${W_SERIF};font-size:22pt;line-height:1.25;color:#1A3A5C;font-weight:bold;margin:0 0 12pt`],
  ['h2', `font-family:${W_SERIF};font-size:18pt;line-height:1.3;color:#1A3A5C;font-weight:bold;margin:16pt 0 8pt;padding-bottom:4pt;border-bottom:1.5pt solid #EFC53F`],
  ['h3', `font-family:${W_SERIF};font-size:15pt;color:#1A3A5C;font-weight:bold;margin:14pt 0 6pt`],
  ['h4', `font-family:${W_SANS};font-size:13pt;color:#1A3A5C;font-weight:bold;margin:10pt 0 4pt`],
  ['table.ptable', 'border-collapse:collapse;width:100%;margin:6pt 0 12pt'],
  ['table.ptable th', `background:#1A3A5C;color:#FFFFFF;text-align:left;padding:5pt 7pt;font-family:${W_SANS};font-size:9.5pt;font-weight:bold;border:0.75pt solid #1A3A5C`],
  ['table.ptable td', `border:0.75pt solid #C8C7C1;padding:5pt 7pt;vertical-align:top;font-family:${W_SANS};font-size:9.5pt;line-height:1.45;color:#0F0F0F`],
  ['td.num', 'text-align:right'], ['th.num', 'text-align:right'],
  ['tr.total-row td', 'background:#F1F0E8;border-top:1.5pt solid #1A3A5C;font-size:10pt'],
  ['blockquote.pullquote', `font-family:${W_SERIF};font-style:italic;font-size:16pt;line-height:1.4;color:#1A3A5C;border-left:2.5pt solid #EFC53F;padding:2pt 0 2pt 12pt;margin:10pt 0`],
  ['figcaption', `font-family:${W_SANS};font-size:8.5pt;color:#7A7975;margin-top:3pt;text-align:center`],
  ['.bio-name', 'margin:10pt 0 2pt;font-size:13pt'],
  ['.case-sub', 'color:#5B5B58;margin-bottom:4pt'],
  ['.muted', 'color:#7A7975;font-weight:normal'],
  ['.cover-page', 'text-align:center'],
  ['.cover-title', 'font-size:28pt;margin:24pt 0 0'],
  ['.cover-meta p', 'font-size:12pt;margin:9pt 0'],
  ['.cover-fss', 'text-align:left'],
  ['.cover-fss-kicker', `font-family:${W_SANS};font-size:13pt;color:#1A3A5C;font-weight:bold;margin:0 0 4pt`],
  ['.cover-fss-title', `font-family:${W_SANS};font-size:26pt;line-height:1.2;color:#1A3A5C;font-weight:bold;margin:0;border:none;padding:0`],
  ['.cover-fss-meta p', 'font-size:12pt;margin:0 0 9pt'],
  ['.divider-page', 'text-align:center'],
  ['.divider-eyebrow', `font-family:${W_SANS};font-size:9pt;letter-spacing:3pt;text-transform:uppercase;color:#B8932A;font-weight:bold;margin:170pt 0 10pt`],
  ['.divider-title', 'font-size:28pt;margin:0'],
  ['.toc-label', ''],
];

function applyWordInlineStyles(root) {
  // accumulate matching rules in order; existing inline styles win last
  WORD_RULES.forEach(([sel, css]) => {
    if (!css) return;
    root.querySelectorAll(sel).forEach(el => {
      el.dataset.xcss = (el.dataset.xcss || '') + css + ';';
    });
  });
  root.querySelectorAll('[data-xcss]').forEach(el => {
    el.setAttribute('style', el.dataset.xcss + (el.getAttribute('style') || ''));
    delete el.dataset.xcss;
  });

  // cover spacing: Word can't full-bleed, so drop the app's cover geometry
  // (its own padding/negative margin) and push content down the title page
  root.querySelectorAll('.cover-page').forEach(cp => {
    cp.style.padding = ''; cp.style.margin = ''; cp.style.height = '';
    const spacer = htmlToEl(`<p style="margin:0;font-size:1pt">&nbsp;</p>`);
    spacer.style.marginTop = '90pt';
    cp.insertBefore(spacer, cp.firstChild);
  });

  // letterhead cover: Word can't draw the full-bleed sidebar (it lives in
  // CSS pseudo-elements that never reach the export) — keep the left-aligned
  // logo/title/meta composition and let the spacer push the meta down.
  root.querySelectorAll('.cover-fss').forEach(cp => {
    cp.style.padding = ''; cp.style.margin = ''; cp.style.height = '';
    const spacer = htmlToEl(`<p style="margin:0;font-size:1pt">&nbsp;</p>`);
    spacer.style.marginTop = '50pt';
    cp.insertBefore(spacer, cp.firstChild);
    const gap = cp.querySelector('.cover-fss-spacer');
    if (gap) gap.outerHTML = `<p style="margin:0 0 260pt;font-size:1pt">&nbsp;</p>`;
  });
  root.querySelectorAll('img.cover-fss-logo').forEach(im => { im.setAttribute('width', '250'); im.removeAttribute('class'); });
  root.querySelectorAll('.cover-fss-meta').forEach(m => {
    const cols = [...m.querySelectorAll('.cfm-col')].map(c => `<td style="width:50%;vertical-align:top;padding-right:14pt;border:none">${c.innerHTML}</td>`).join('');
    if (cols) m.outerHTML = `<table width="100%" style="border-collapse:collapse;margin:0"><tr>${cols}</tr></table>`;
  });

  // gold rules (cover/divider) → centered table (Word-safe)
  root.querySelectorAll('.cover-rule,.divider-beam').forEach(el => {
    el.outerHTML = `<table align="center" style="border-collapse:collapse;margin:14pt auto"><tr><td style="width:60pt;border-bottom:2.5pt solid #EFC53F;font-size:2pt">&nbsp;</td></tr></table>`;
  });

  // custom cover: full-width art, then the text box content beneath it
  root.querySelectorAll('.cover-custom').forEach(cc => {
    const bg = (cc.getAttribute('style') || '').match(/background-image:url\((.*?)\)/)?.[1];
    const box = cc.querySelector('.cover-box');
    cc.outerHTML = `<div style="text-align:center">
      ${bg ? `<img src="${bg}" width="624" style="max-width:100%">` : ''}
      ${box ? `<div style="text-align:center;margin-top:14pt">${box.innerHTML}</div>` : ''}
    </div>`;
  });
  root.querySelectorAll('.cb-kicker').forEach(el => el.setAttribute('style', `font-family:${W_SANS};font-size:9pt;letter-spacing:2.5pt;text-transform:uppercase;color:#B8932A;font-weight:bold;margin:0 0 4pt`));
  root.querySelectorAll('.cb-title').forEach(el => el.setAttribute('style', `font-family:${W_SERIF};font-size:18pt;color:#1A3A5C;margin:0 0 6pt;border:none;padding:0`));
  root.querySelectorAll('.cb-meta').forEach(el => el.setAttribute('style', `font-family:${W_SANS};font-size:12pt;color:#0F0F0F;margin:0`));

  // per-block heading underline overrides (from the heading block's gear settings)
  root.querySelectorAll('.heading-scope').forEach(sc => {
    const st = sc.getAttribute('style') || '';
    const h = sc.querySelector('h2');
    if (!h) return;
    if (/--h2-rule-w:\s*0/.test(st)) { h.style.borderBottom = 'none'; h.style.paddingBottom = '0'; }
    else {
      const m = st.match(/--h2-rule-c:\s*([^;"]+)/);
      if (m) h.style.borderBottom = `1.5pt solid ${m[1].trim()}`;
    }
  });

  // imported PDF pages → full-width centered images, one per page
  root.querySelectorAll('.pdf-page').forEach(pp => {
    const img = pp.querySelector('img');
    pp.outerHTML = img ? `<div align="center"><img src="${img.getAttribute('src')}" width="648" style="max-width:100%"></div>` : '';
  });

  // signature: rule line → table; keep the image inline
  root.querySelectorAll('.sig-line').forEach(el => {
    const w = Math.round(parseInt((el.getAttribute('style') || '').match(/width:\s*(\d+)/)?.[1] || 220) * 0.75);
    el.outerHTML = `<table style="border-collapse:collapse;margin:2pt 0 4pt"><tr><td style="width:${w}pt;border-bottom:1pt solid #0F0F0F;font-size:2pt">&nbsp;</td></tr></table>`;
  });
  root.querySelectorAll('.sig-img').forEach(im => {
    const w = Math.round(parseInt((im.getAttribute('style') || '').match(/width:\s*(\d+)/)?.[1] || 220));
    im.setAttribute('width', String(w));
    im.removeAttribute('style');
  });
  root.querySelectorAll('.sig-block.align-center').forEach(el => el.setAttribute('align', 'center'));
  root.querySelectorAll('.sig-block.align-right').forEach(el => el.setAttribute('align', 'right'));

  // two columns → table
  root.querySelectorAll('.twocol').forEach(tc => {
    const cells = [...tc.children].map(c => `<td style="width:50%;vertical-align:top;padding-right:14pt">${c.innerHTML}</td>`).join('');
    tc.outerHTML = `<table width="100%" style="border-collapse:collapse;margin:0 0 8pt"><tr>${cells}</tr></table>`;
  });

  // figures → aligned divs with explicit pixel widths (Word needs width attrs)
  const CONTENT_PX = 624;   // ~6.5in printable width at 96dpi
  root.querySelectorAll('figure.img-figure').forEach(fig => {
    const pct = parseFloat((fig.getAttribute('style') || '').match(/width:\s*([\d.]+)%/)?.[1] || 70);
    const align = fig.className.includes('align-left') ? 'left' : fig.className.includes('align-right') ? 'right' : 'center';
    const img = fig.querySelector('img');
    const cap = fig.querySelector('figcaption');
    const w = Math.round(CONTENT_PX * pct / 100);
    fig.outerHTML = `<div align="${align}" style="margin:8pt 0">
      ${img ? `<img src="${img.getAttribute('src')}" width="${w}" style="max-width:100%">` : ''}
      ${cap && cap.textContent.trim() ? `<p style="font-family:${W_SANS};font-size:8.5pt;color:#7A7975;margin:3pt 0 0;text-align:${align}">${cap.innerHTML}</p>` : ''}
    </div>`;
  });

  // cover logo width
  root.querySelectorAll('img.cover-logo').forEach(im => { im.setAttribute('width', '190'); im.removeAttribute('class'); });

  // TOC rows (flex) → table with dotted leaders
  root.querySelectorAll('.toc-list').forEach(list => {
    const rows = [...list.querySelectorAll('.toc-row')].map(row => {
      const lvl0 = row.className.includes('lvl0');
      const label = row.querySelector('.toc-label')?.textContent || '';
      const pg = row.querySelector('.toc-pg')?.textContent || '';
      const labStyle = lvl0
        ? `font-family:${W_SERIF};font-size:13pt;font-weight:bold;color:#1A3A5C;padding:7pt 4pt 2pt 0;white-space:nowrap`
        : `font-family:${W_SANS};font-size:12pt;color:#0F0F0F;padding:3pt 4pt 2pt 14pt;white-space:nowrap`;
      return `<tr>
        <td style="${labStyle};border:none">${esc(label)}</td>
        <td style="width:100%;border:none;border-bottom:1pt dotted #A4A39E"></td>
        <td style="border:none;text-align:right;font-family:${W_SANS};font-size:12pt;color:#5B5B58;padding:3pt 0 2pt 6pt">${esc(pg)}</td>
      </tr>`;
    }).join('');
    list.outerHTML = `<table width="100%" style="border-collapse:collapse;margin:8pt 0 0">${rows}</table>`;
  });

  // nested list markers → Word-native type attributes
  root.querySelectorAll('ul ul').forEach(u => u.setAttribute('type', 'circle'));
  root.querySelectorAll('ul ul ul').forEach(u => u.setAttribute('type', 'square'));
  root.querySelectorAll('ol ol').forEach(o => o.setAttribute('type', 'a'));
  root.querySelectorAll('ol ol ol').forEach(o => o.setAttribute('type', 'i'));

  // tables: Word attribute hygiene
  root.querySelectorAll('table').forEach(t => { t.setAttribute('cellspacing', '0'); t.setAttribute('cellpadding', '0'); });
}

function suggestionWarning() {
  const n = collectSuggestions().length;
  if (n) toast(`Note: ${n} open suggestion${n > 1 ? 's were' : ' was'} exported as accepted`);
}
function docFilename(ext) {
  return (App.doc.title || 'Proposal').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') + '.' + ext;
}

async function exportWord() {
  toast('Preparing Word document…');
  try {
    const root = exportCleanRoot();
    await embedImages(root);
    const blob = await DocxExport.build(root, {
      title: App.doc.title,
      pageSize: App.doc.pageSize,
      marginPx: pageMargin(),
      pageNums: pageNumCfg(),
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = docFilename('docx');
    a.click();
    URL.revokeObjectURL(a.href);
    snapshotVersion('Exported to Word');
    suggestionWarning();
    toast('Word document downloaded — formatting, images & page numbers included');
  } catch (e) {
    console.error('docx export failed', e);
    toast('Word export hit a snag — see the console for details');
  }
}

function exportGoogleDocs() {
  exportWord();
  const card = modal(`
    <div class="pophead">${icon('doc', 16)}<b>Open in Google Docs</b><button class="iconbtn close-pop">${icon('x', 15)}</button></div>
    <div class="popbody">
      <p class="set-hint" style="font-size:13px;line-height:1.55">A Word copy was just downloaded. To open it as a Google Doc:</p>
      <ol style="font-size:13px;line-height:1.7;padding-left:18px;margin:8px 0 14px">
        <li>Go to <b>drive.google.com</b> and drag the file in</li>
        <li>Open it — Google converts it to an editable Google Doc</li>
      </ol>
      <p class="set-hint">For the most faithful transfer into an existing Doc, use “Copy for Google Docs” and paste — inline styles and images carry over.</p>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn" id="copyForGdocs">${icon('copy', 14)} Copy for Google Docs</button>
        <button class="btn primary" id="openDrive">Open Google Drive</button>
      </div>
    </div>`, { width: 460 });
  card.querySelector('#openDrive').onclick = () => { window.open('https://docs.google.com', '_blank'); closePopovers(); };
  card.querySelector('#copyForGdocs').onclick = copyRichToClipboard;
  card.querySelector('.close-pop').onclick = closePopovers;
}

async function copyRichToClipboard() {
  const root = exportCleanRoot();
  await embedImages(root);
  applyWordInlineStyles(root);
  try {
    await navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([root.innerHTML], { type: 'text/html' }),
      'text/plain': new Blob([root.innerText], { type: 'text/plain' }),
    })]);
    toast('Copied — paste into a Google Doc');
  } catch (e) {
    toast('Clipboard blocked by the browser — use the downloaded file instead');
  }
  closePopovers();
}

/* ---------- PDF: print the actual paginated sheets (WYSIWYG) ---------- */
function exportPDF() {
  const dims = pageDims();
  const pageCSS = { letter: '8.5in 11in', a4: '210mm 297mm', legal: '8.5in 14in' }[App.doc.pageSize] || '8.5in 11in';

  const pagesHTML = [...document.querySelectorAll('#canvas .sheet')].map(sheet => {
    const clone = sheet.cloneNode(true);
    clone.querySelectorAll('.btool,.dz,.cost-open-hint,.img-placeholder,.cover-custom-hint,.sig-placeholder,.assign-tag,.proof-chip,.float-grip,.float-tools,.fh,.img-resize,.float-nosig,.pdf-page-tag').forEach(n => n.remove());
    clone.querySelectorAll('ins[data-sid]').forEach(n => unwrapEl(n));
    clone.querySelectorAll('del[data-sid]').forEach(n => n.remove());
    clone.querySelectorAll('.cmk').forEach(n => unwrapEl(n));
    clone.querySelectorAll('[contenteditable]').forEach(n => n.removeAttribute('contenteditable'));
    clone.querySelectorAll('.blockwrap,.float-obj').forEach(n => n.classList.remove('sel'));
    refreshLiveDates(clone);   // cover dates re-stamp to the day of export
    return clone.outerHTML;
  }).join('');

  // Hidden same-origin iframe, printed from this window. A popup +
  // inline-script print breaks two ways here: blockers eat the popup
  // (especially inside the Keel iframe embed), and Keel's CSP has no
  // script-src 'unsafe-inline', which about:blank documents inherit —
  // so the popup's window.print() never ran.
  document.getElementById('fss-print-frame')?.remove();
  const frame = document.createElement('iframe');
  frame.id = 'fss-print-frame';
  frame.setAttribute('aria-hidden', 'true');
  // visibility:hidden, not display:none — Safari won't print a display:none frame
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;visibility:hidden;pointer-events:none';
  document.body.appendChild(frame);

  const d = frame.contentDocument;
  d.open();
  d.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><base href="${location.href.split('#')[0]}">
<title>${esc(App.doc.title)}</title>
<link rel="stylesheet" href="css/app.css">
<style>${Settings.fontFaceCSS()}</style>
<style>
html, body { margin:0; padding:0; background:#fff; overflow:visible; height:auto; }
@page { size:${pageCSS}; margin:0; }
#canvas { width:${dims.w}px; margin:0 auto; }
.sheet { margin:0 auto !important; box-shadow:none !important; height:${dims.h}px; overflow:hidden; page-break-after:always; }
.sheet:last-child { page-break-after:auto; }
.blockwrap:hover, .blockwrap.sel { box-shadow:none !important; }
.toc-row { cursor:default; }
.toc-row:hover { background:transparent; }
.float-obj { border-color:transparent !important; }
</style></head>
<body><div id="canvas" style="--pw:${dims.w}px;--ph:${dims.h}px;--pm:${pageMargin()}px;--contentH:${dims.h - 2 * pageMargin()}px">${pagesHTML}</div></body></html>`);
  d.close();

  toast('Preparing PDF — choose “Save as PDF” in the print dialog');
  printFrameWhenReady(frame);
  snapshotVersion('Exported to PDF');
  suggestionWarning();
}

/* Wait (bounded) for the print frame's stylesheet, fonts, and images,
   then open the print dialog for the frame's document. */
function printFrameWhenReady(frame) {
  const d = frame.contentDocument;
  const links = [...d.querySelectorAll('link[rel="stylesheet"]')].map(l => new Promise(res => {
    if (l.sheet) return res();
    l.addEventListener('load', res, { once: true });
    l.addEventListener('error', res, { once: true });
  }));
  const imgs = [...d.images].map(im => im.decode ? im.decode().catch(() => {}) : Promise.resolve());
  const fonts = (d.fonts && d.fonts.ready) ? d.fonts.ready : Promise.resolve();
  const timeout = new Promise(res => setTimeout(res, 5000));   // never hang the export
  Promise.race([Promise.all([...links, ...imgs, fonts]), timeout]).then(() => {
    setTimeout(() => {
      const w = frame.contentWindow;
      if (!w) return;   // frame replaced by a newer export before we got here
      w.addEventListener('afterprint', () => setTimeout(() => frame.remove(), 250), { once: true });
      w.focus();
      w.print();
    }, 250);   // one more beat for layout after resources settle
  });
}
