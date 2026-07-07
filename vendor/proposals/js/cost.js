/* ============ Fog Signal Proposals — cost proposal block ============
   The calculator is the internal tool; the document shows the formatted
   fee tables (matching the firm's submitted proposal format). "Suggested"
   prices are the seam for the future pricing database.                  */
'use strict';

function costFeeLabel(c) {
  if (c.kind === 'included') return 'Included';
  if (c.kind === 'monthly') return `${fmtMoney(c.fee)}/month`;
  return `${fmtMoney(c.fee)} (flat)`;
}
function costCatTotal(c) {
  if (c.kind === 'included') return 0;
  if (c.kind === 'monthly') return (c.fee || 0) * (c.months || 1);
  return c.fee || 0;
}
function costServicesTotal(m) {
  return m.cats.reduce((t, c) => t + costCatTotal(c), 0) +
         m.addOns.filter(a => a.on).reduce((t, a) => t + (a.fee || 0), 0);
}
function costEnvelopeTotal(m) {
  return costServicesTotal(m) + (m.showPassThroughs ? m.passThroughs.filter(p => p.on).reduce((t, p) => t + (p.fee || 0), 0) : 0);
}

/* ---------- document-facing render ---------- */
function renderCostBody(b) {
  const m = b.cost;
  const services = costServicesTotal(m);
  const introDefault = `<p>Fog Signal Strategies proposes the following fee structure. Our pricing reflects a comprehensive approach to delivering all scope-of-work requirements. Fog Signal Strategies operates on a flat-rate project fee model rather than hourly billing — providing cost certainty, eliminating the concern that reaching out to your consultant will result in an unexpected invoice, and keeping our team focused on outcomes rather than hours.</p>`;
  const offAddOns = m.addOns.filter(a => !a.on);

  let html = edRegion(b.id + '.intro', introDefault);

  html += `<h3>Fee Structure</h3>
  <table class="ptable cost-table"><thead><tr><th style="width:30%">Service Category</th><th>Description</th><th style="width:18%" class="num">Fee</th></tr></thead><tbody>
  ${m.cats.map(c => `<tr><td><b>${esc(c.name)}</b></td><td>${esc(c.desc)}</td><td class="num">${costFeeLabel(c)}</td></tr>`).join('')}
  ${m.addOns.filter(a => a.on).map(a => `<tr><td><b>${esc(a.name)}</b></td><td>${esc(a.desc)}</td><td class="num">${fmtMoney(a.fee)}</td></tr>`).join('')}
  <tr class="total-row"><td colspan="2"><b>TOTAL PROJECT FEE</b> <span class="muted">(Estimated ${esc(String(m.months))}-month engagement)</span></td><td class="num"><b>${fmtMoney(services)}</b></td></tr>
  </tbody></table>`;

  if (offAddOns.length) {
    html += `<h3>Optional Services</h3><p>The following services are available as add-ons should the need arise:</p><ul>
    ${offAddOns.map(a => `<li><b>${esc(a.name)}:</b> ${fmtMoney(a.fee)} — ${esc(a.desc)}</li>`).join('')}
    </ul><p><b>Total with all optional services:</b> ${fmtMoney(services + offAddOns.reduce((t, a) => t + a.fee, 0))}</p>`;
  }

  if (m.showPassThroughs && m.passThroughs.some(p => p.on)) {
    const ptOn = m.passThroughs.filter(p => p.on);
    html += `<h3>Pass-Through Costs (Client-Approved, No Agency Markup)</h3>
    <table class="ptable cost-table"><tbody>
    ${ptOn.map(p => `<tr><td style="width:30%"><b>${esc(p.name)}</b></td><td>${esc(p.desc)}</td><td style="width:18%" class="num">${fmtMoney(p.fee)}</td></tr>`).join('')}
    <tr class="total-row"><td colspan="2"><b>TOTAL BUDGET ENVELOPE</b> <span class="muted">(Professional services + pass-throughs)</span></td><td class="num"><b>${fmtMoney(costEnvelopeTotal(m))}</b></td></tr>
    </tbody></table>`;
  }

  if (m.showPersonnel && m.personnel.length) {
    html += `<h3>Personnel Cost Allocation</h3>
    <p>The table below provides a breakdown of labor costs by team member. These are flat project allocations, not hourly billing; each allocation reflects the anticipated level of involvement across all project stages.</p>
    <table class="ptable cost-table"><thead><tr><th style="width:30%">Component</th><th>Description</th><th style="width:18%" class="num">Amount</th></tr></thead><tbody>
    ${m.personnel.map(p => `<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.role)}</td><td class="num">${fmtMoney(p.amount)}</td></tr>`).join('')}
    </tbody></table>`;
  }

  if (m.showRates) {
    html += `<h3>Hourly Rate Schedule (Out-of-Scope Work Only)</h3>
    <p>The flat-rate fee above includes all in-scope work. For any requested work outside the defined scope, Fog Signal Strategies will provide a written change order in advance, estimated against the following schedule:</p>
    <table class="ptable cost-table" style="max-width:420px"><thead><tr><th>Role</th><th class="num">Hourly Rate</th></tr></thead><tbody>
    ${staffAll().map(s => `<tr><td>${esc(s.role)}</td><td class="num">$${(typeof Settings !== 'undefined' && Settings.data) ? Settings.staffRate(s.id) : s.rate}</td></tr>`).join('')}
    </tbody></table>`;
  }

  html += `<div class="cost-open-hint" data-costopen="${b.id}" contenteditable="false">${icon('calc', 14)} Open cost calculator</div>`;
  return html;
}

/* ---------- calculator modal ---------- */
function openCostCalculator(b) {
  const card = modal(`
    <div class="pophead">
      ${icon('calc', 16)}<div><b>Cost Proposal Calculator</b><small class="muted-block">Internal — not shown in the document. Suggested prices will come from the pricing database.</small></div>
      <button class="iconbtn close-pop" title="Close">${icon('x', 16)}</button>
    </div>
    <div class="popbody calcbody" id="calcBody"></div>
    <div class="calcfoot" id="calcFoot"></div>`, { width: 640 });
  card.querySelector('.close-pop').onclick = closePopovers;
  renderCalc(card, b);
}

function renderCalc(card, b) {
  const m = b.cost;
  const body = card.querySelector('#calcBody');

  const catRow = (c) => `
  <div class="calc-row" data-cid="${c.id}">
    <div class="calc-row-top">
      <input class="calc-name" data-f="name" value="${esc(c.name)}">
      <button class="iconbtn danger" data-act="delCat" title="Remove line">${icon('trash', 13)}</button>
    </div>
    <input class="calc-desc" data-f="desc" value="${esc(c.desc)}" placeholder="Description shown in the fee table">
    <div class="calc-row-ctl">
      <select data-f="kind" class="calc-kind">
        <option value="flat" ${c.kind === 'flat' ? 'selected' : ''}>Flat fee</option>
        <option value="monthly" ${c.kind === 'monthly' ? 'selected' : ''}>Monthly</option>
        <option value="included" ${c.kind === 'included' ? 'selected' : ''}>Included</option>
      </select>
      ${c.kind !== 'included' ? `<span class="calc-money">$<input type="number" data-f="fee" value="${c.fee}" min="0" step="250"></span>` : ''}
      ${c.kind === 'monthly' ? `<span class="calc-months">× <input type="number" data-f="months" value="${c.months || 1}" min="1" max="36"> mo</span>` : ''}
      <span class="calc-sub">${c.kind === 'included' ? '' : '= ' + fmtMoney(costCatTotal(c))}</span>
      ${c.rec && c.kind !== 'included' && c.rec !== c.fee ? `<button class="rec-chip" data-act="applyRec" title="Apply the suggested price">${icon('bolt', 11)} Suggested ${fmtMoney(c.rec)}</button>` : ''}
    </div>
  </div>`;

  const toggleRow = (list, item, moneyEditable = true) => `
  <div class="calc-row slim ${item.on ? '' : 'off'}" data-tid="${item.id}" data-list="${list}">
    <label class="switch"><input type="checkbox" data-f="on" ${item.on ? 'checked' : ''}><span></span></label>
    <div class="calc-tgl-txt"><b>${esc(item.name)}</b><small>${esc(item.desc)}</small></div>
    <span class="calc-money">$<input type="number" data-f="fee" value="${item.fee}" min="0" step="500" ${moneyEditable ? '' : 'disabled'}></span>
  </div>`;

  const perYear = m.households > 0 ? m.measureAnnual / m.households : 0;

  body.innerHTML = `
  <div class="calc-sec"><div class="calc-sec-h">Service categories <button class="btn tiny" data-act="addCat">${icon('plus', 12)} Add line</button></div>
    ${m.cats.map(catRow).join('')}
  </div>
  <div class="calc-sec"><div class="calc-sec-h">Optional add-ons <small class="muted">— toggled on = added to the fee table; off = listed as “Optional Services”</small></div>
    ${m.addOns.map(a => toggleRow('addOns', a)).join('')}
  </div>
  <div class="calc-sec"><div class="calc-sec-h"><label class="switch"><input type="checkbox" data-m="showPassThroughs" ${m.showPassThroughs ? 'checked' : ''}><span></span></label> Pass-through costs (media buys, direct mail)</div>
    ${m.showPassThroughs ? m.passThroughs.map(p => toggleRow('passThroughs', p)).join('') : ''}
  </div>
  <div class="calc-sec"><div class="calc-sec-h"><label class="switch"><input type="checkbox" data-m="showPersonnel" ${m.showPersonnel ? 'checked' : ''}><span></span></label> Personnel cost allocation table</div>
    ${m.showPersonnel ? m.personnel.map(p => `
      <div class="calc-row slim" data-pid="${p.id}">
        <div class="calc-tgl-txt"><input class="calc-name slim" data-f="name" value="${esc(p.name)}"><input class="calc-desc slim" data-f="role" value="${esc(p.role)}"></div>
        <span class="calc-money">$<input type="number" data-f="amount" value="${p.amount}" min="0" step="250"></span>
        <button class="iconbtn danger" data-act="delPers" title="Remove">${icon('trash', 13)}</button>
      </div>`).join('') + `<button class="btn tiny" data-act="addPers">${icon('plus', 12)} Add person</button>` : ''}
  </div>
  <div class="calc-sec"><div class="calc-sec-h"><label class="switch"><input type="checkbox" data-m="showRates" ${m.showRates ? 'checked' : ''}><span></span></label> Hourly rate schedule (out-of-scope work)</div></div>
  <div class="calc-sec impact">
    <div class="calc-sec-h">Taxpayer impact helper <small class="muted">— for cost-context messaging</small></div>
    <div class="impact-grid">
      <label>Measure raises / year <span class="calc-money">$<input type="number" data-m="measureAnnual" value="${m.measureAnnual}" step="100000" min="0"></span></label>
      <label>Households <span class="calc-money"><input type="number" data-m="households" value="${m.households}" step="1000" min="1"></span></label>
    </div>
    <div class="impact-out">≈ <b>${fmtMoney2(perYear)}</b> per household per year · <b>${fmtMoney2(perYear / 12)}</b> per month</div>
  </div>
  <div class="calc-sec"><div class="calc-sec-h">Engagement length</div>
    <div class="calc-row-ctl"><span class="calc-months"><input type="number" data-m="months" value="${m.months}" min="1" max="36"> months <span class="muted">(shown in the total row)</span></span></div>
  </div>`;

  card.querySelector('#calcFoot').innerHTML = `
    <div><small class="muted">Professional services</small><b>${fmtMoney(costServicesTotal(m))}</b></div>
    ${m.showPassThroughs && m.passThroughs.some(p => p.on) ? `<div><small class="muted">Budget envelope</small><b>${fmtMoney(costEnvelopeTotal(m))}</b></div>` : ''}
    <button class="btn primary" data-act="doneCalc">Done</button>`;

  const apply = () => { refreshBlock(b); saveDoc(); };
  const rerender = () => { renderCalc(card, b); apply(); };

  /* field bindings */
  body.querySelectorAll('.calc-row[data-cid]').forEach(row => {
    const c = m.cats.find(x => x.id === row.dataset.cid);
    row.querySelectorAll('[data-f]').forEach(inp => {
      const f = inp.dataset.f;
      inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => {
        c[f] = (inp.type === 'number') ? (parseFloat(inp.value) || 0) : inp.value;
        if (f === 'kind') { rerender(); return; }
        if (f === 'fee' || f === 'months') { row.querySelector('.calc-sub').textContent = c.kind === 'included' ? '' : '= ' + fmtMoney(costCatTotal(c)); updateCalcFoot(card, m); }
        apply();
      });
    });
    const rec = row.querySelector('[data-act="applyRec"]');
    if (rec) rec.addEventListener('click', () => { c.fee = c.rec; rerender(); toast('Applied suggested price'); });
    row.querySelector('[data-act="delCat"]').addEventListener('click', () => { m.cats = m.cats.filter(x => x !== c); rerender(); });
  });
  body.querySelectorAll('.calc-row[data-tid]').forEach(row => {
    const list = m[row.dataset.list];
    const item = list.find(x => x.id === row.dataset.tid);
    row.querySelectorAll('[data-f]').forEach(inp => {
      inp.addEventListener(inp.type === 'checkbox' ? 'change' : 'input', () => {
        if (inp.type === 'checkbox') { item.on = inp.checked; row.classList.toggle('off', !item.on); }
        else item[inp.dataset.f] = parseFloat(inp.value) || 0;
        updateCalcFoot(card, m); apply();
      });
    });
  });
  body.querySelectorAll('.calc-row[data-pid]').forEach(row => {
    const p = m.personnel.find(x => x.id === row.dataset.pid);
    row.querySelectorAll('[data-f]').forEach(inp => {
      inp.addEventListener('input', () => {
        p[inp.dataset.f] = (inp.type === 'number') ? (parseFloat(inp.value) || 0) : inp.value;
        apply();
      });
    });
    const del = row.querySelector('[data-act="delPers"]');
    if (del) del.addEventListener('click', () => { m.personnel = m.personnel.filter(x => x !== p); rerender(); });
  });
  body.querySelectorAll('[data-m]').forEach(inp => {
    inp.addEventListener(inp.type === 'checkbox' ? 'change' : 'input', () => {
      const k = inp.dataset.m;
      m[k] = inp.type === 'checkbox' ? inp.checked : (parseFloat(inp.value) || 0);
      if (inp.type === 'checkbox' || k === 'households' || k === 'measureAnnual') rerender(); else apply();
    });
  });
  const addCat = body.querySelector('[data-act="addCat"]');
  if (addCat) addCat.addEventListener('click', () => {
    m.cats.push({ id: uid('k'), name: 'New Service Category', desc: '', fee: 5000, kind: 'flat', rec: 0 });
    rerender();
  });
  const addPers = body.querySelector('[data-act="addPers"]');
  if (addPers) addPers.addEventListener('click', () => {
    m.personnel.push({ id: uid('k'), name: 'Team Member', role: '', amount: 5000 });
    rerender();
  });
  card.querySelector('[data-act="doneCalc"]').addEventListener('click', closePopovers);
}

function updateCalcFoot(card, m) {
  const foot = card.querySelector('#calcFoot');
  const bs = foot.querySelectorAll('div b');
  if (bs[0]) bs[0].textContent = fmtMoney(costServicesTotal(m));
  if (bs[1]) bs[1].textContent = fmtMoney(costEnvelopeTotal(m));
}
