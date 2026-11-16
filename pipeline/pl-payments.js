'use strict';
/* pl-payments.js · Pipe-Line · Payments and the payment queue.
   One of the Pipe-Line files loaded by nex.html (list and order: PL_FILES in the loader). All of them share one global scope. */
/* =========================================================
   Payments and First Aid
   ========================================================= */
const PY = { view: 'toprocess', q: '', page: 0, size: 50, sel: null };
const PROBLEM = ['no_docs', 'not_found', 'issues', 'less_payment', 'no_plc_issues', 'yes_plc_less_payment', 'confirmed_no_plc_less'];

route(/^\/payments(?:\?(.*))?$/, async m => {
  const qs = new URLSearchParams(m[1] || '');
  if (qs.get('view')) { PY.view = qs.get('view'); PY.page = 0; PY.sel = null; history.replaceState(null, '', '#/payments'); }
  const [cTo, cProb, cDone, cUnm] = await Promise.all([
    count('nex_payment_queue', 'processing_step=neq.processed'),
    count('nex_payment_queue', 'queue_status=in.(' + PROBLEM.join(',') + ')'),
    count('nex_payment_queue', 'processing_step=eq.processed'),
    count('nex_payments', 'student_id=is.null')
  ]);
  afterRender(() => bindPayments());
  const seg = [['toprocess', 'To process', cTo], ['attention', 'Needs attention', cProb], ['processed', 'Processed', cDone], ['unmatched', 'Unmatched', cUnm], ['all', 'All payments', null]];
  return pageHead('cash', 'Payments', 'Payment queue', (canPay() ? '<button class="nx-btn primary" id="pyAdd">' + ico('plus') + 'Record payment</button>' : '')) +
    '<div class="nx-split"><div class="nx-card"><div class="nx-toolbar" style="border-top:0"><div class="nx-seg" id="pySeg">' + seg.map(([k, l, n]) => '<button data-v="' + k + '" aria-pressed="' + (PY.view === k) + '">' + l + (n != null ? ' <span class="nx-count">' + n + '</span>' : '') + '</button>').join('') + '</div><input class="nx-in sm" id="pyQ" style="min-width:220px" placeholder="Search name or reference" value="' + esc(PY.q) + '"></div>' +
    '<div id="pyBody"></div><div class="nx-foot" id="pyFoot"><span></span></div></div><div class="nx-drawer" id="pyDrawer" hidden></div></div>';
});

function bindPayments() {
  const body = $('#pyBody'); let rowsCache = [];
  const load = async () => {
    holdBody(body);
    try {
      const q = safeQ(PY.q); let rows, total;
      const from = PY.page * PY.size, to = from + PY.size - 1;
      if (PY.view === 'unmatched' || PY.view === 'all') {
        let query = 'select=*&order=paid_on.desc.nullslast,created_at.desc';
        if (PY.view === 'unmatched') query += '&student_id=is.null';
        if (q) query += '&or=(payer_name.ilike.*' + q + '*,reference.ilike.*' + q + '*)';
        ({ rows, total } = await selPage('nex_payments', query, from, to));
        rowsCache = rows;
        body.innerHTML = rows.length ? '<div class="nx-tablewrap"><table class="nx-table tight"><thead><tr><th>Date</th><th>Paid by</th><th>Amount</th><th>Method</th><th>Reference</th><th>Student</th><th></th></tr></thead><tbody>' +
          rows.map(p => '<tr><td>' + esc(fmtDate(p.paid_on)) + '</td><td>' + esc(p.payer_name || '–') + '</td><td class="nx-money">' + money(p.amount) + '</td><td>' + esc(p.method || '–') + '</td><td>' + esc(p.reference || '–') + '</td><td>' + (p.student_id ? '<a href="#/students/' + p.student_id + '">Open</a>' : '<span class="nx-pill warn">Unmatched</span>') + '</td><td>' + (p.student_id || !canPay() ? '' : '<button class="nx-btn sm" data-link="' + p.id + '">Link to student</button>') + '</td></tr>').join('') + '</tbody></table></div>' : empty(PY.view === 'unmatched' ? 'Every payment is linked to a student' : 'No payments found');
      } else {
        let query = 'select=*,nex_payments(id,amount,paid_on,payer_name,reference,method,student_id),nex_enrolments(id,student_id,qualification_id,fee,nex_students(id,first_name,last_name,email))&order=updated_at.desc';
        if (PY.view === 'toprocess') query += '&processing_step=neq.processed';
        else if (PY.view === 'attention') query += '&queue_status=in.(' + PROBLEM.join(',') + ')';
        else query += '&processing_step=eq.processed';
        ({ rows, total } = await selPage('nex_payment_queue', query, from, to));
        if (q) { const lq = q.toLowerCase(); rows = rows.filter(r => JSON.stringify([(r.nex_payments || {}).payer_name, (r.nex_payments || {}).reference, ((r.nex_enrolments || {}).nex_students || {}).first_name, ((r.nex_enrolments || {}).nex_students || {}).last_name]).toLowerCase().includes(lq)); }
        rowsCache = rows;
        const stepIdx = k => ['draft_not_made', 'draft_made', 'ready_to_process', 'processed'].indexOf(k);
        body.innerHTML = rows.length ? '<div class="nx-tablewrap"><table class="nx-table tight"><thead><tr><th>Student</th><th>Paid</th><th>Amount</th><th>Queue status</th><th>Processing</th><th>Updated</th></tr></thead><tbody>' +
          rows.map(r => { const p = r.nex_payments || {}, e = r.nex_enrolments || {}, s = e.nex_students || null; const si = stepIdx(r.processing_step);
            return '<tr class="nx-tr ' + (PY.sel === r.id ? 'sel' : '') + '" data-id="' + r.id + '"><td><div class="nx-who"><span class="nx-avatar">' + esc(initials(s ? fullName(s) : p.payer_name)) + '</span><div><b>' + esc(s ? fullName(s) : (p.payer_name || 'Unknown')) + '</b><span>' + esc(s ? s.email || '' : 'Not matched') + '</span></div></div></td><td>' + esc(fmtDate(p.paid_on)) + '</td><td class="nx-money">' + money(p.amount) + '</td><td>' + pill('payment_queue', r.queue_status) + '</td><td>' + '<div class="nx-stagecell">' + pill('processing', r.processing_step) + '<div class="nx-steps">' + [0, 1, 2, 3].map(i => '<i class="' + (i <= si ? 'on' : '') + '"></i>').join('') + '</div></div></td><td>' + esc(fmtDT(r.updated_at)) + '</td></tr>'; }).join('') + '</tbody></table></div>' : empty('Nothing here', PY.view === 'toprocess' ? 'The queue is clear.' : 'No entries in this list.');
        $$('.nx-tr', body).forEach(tr => tr.onclick = () => openQueueDrawer(rowsCache.find(x => x.id === tr.dataset.id), load));
      }
      const fromN = total ? from + 1 : 0, toN = from + rows.length;
      $('#pyFoot').innerHTML = '<span>' + (total != null ? (total ? fromN + '–' + toN + ' of ' + total.toLocaleString('en-AU') : '') : rows.length + ' shown') + '</span><span class="nx-btnrow"><button class="nx-btn sm" id="pyPrev"' + (PY.page ? '' : ' disabled') + '>Previous</button><button class="nx-btn sm" id="pyNext"' + (total != null && toN >= total ? ' disabled' : '') + '>Next</button></span>';
      $('#pyPrev').onclick = () => { PY.page--; load(); }; $('#pyNext').onclick = () => { PY.page++; load(); };
      $$('[data-link]', body).forEach(b => b.onclick = () => linkPayment(rowsCache.find(x => x.id === b.dataset.link)));
    } catch (e) { body.innerHTML = empty('Could not load payments', e.message); }
  };
  $$('#pySeg button').forEach(b => b.onclick = () => { PY.view = b.dataset.v; PY.page = 0; PY.sel = null; $('#pyDrawer').hidden = true; $$('#pySeg button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); load(); });
  let t = 0; $('#pyQ').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { PY.q = e.target.value; PY.page = 0; load(); }, 300); });
  if ($('#pyAdd')) $('#pyAdd').onclick = () => globalAddPayment();
  viewWait(load());
}

function openQueueDrawer(r, reload) {
  if (!r) return;
  PY.sel = r.id; $$('#pyBody .nx-tr').forEach(tr => tr.classList.toggle('sel', tr.dataset.id === r.id));
  const p = r.nex_payments || {}, e = r.nex_enrolments || {}, s = e.nex_students || null;
  const d = $('#pyDrawer'); d.hidden = false;
  d.innerHTML = '<div class="nx-card"><div class="nx-card-h"><h3>' + esc(s ? fullName(s) : (p.payer_name || 'Payment')) + '</h3><button class="nx-btn quiet icon" id="pdX" aria-label="Close">' + ico('x') + '</button></div><div class="nx-card-b" style="display:flex;flex-direction:column;gap:14px">' +
    '<div><div class="nx-lbl">Payment</div><div class="nx-big">' + money(p.amount) + '</div><div class="nx-muted">' + esc(fmtDate(p.paid_on)) + (p.method ? ' · ' + esc(p.method) : '') + (p.reference ? ' · ' + esc(p.reference) : '') + '</div></div>' +
    (e.fee ? '<div class="nx-muted">Agreed fee ' + money(e.fee) + (Number(p.amount) < Number(e.fee) ? ' · this payment is ' + money(Number(e.fee) - Number(p.amount)) + ' short' : '') + '</div>' : '') +
    '<div><label class="nx-lbl" for="pdQs">Queue status</label><select class="nx-sel" id="pdQs">' + selectOpts(opts('payment_queue', true), r.queue_status, 'Not set') + '</select></div>' +
    '<div><label class="nx-lbl" for="pdSt">Processing step</label><select class="nx-sel" id="pdSt">' + selectOpts(opts('processing', true), r.processing_step) + '</select></div>' +
    '<div><label class="nx-lbl" for="pdAs">Assigned to</label><select class="nx-sel" id="pdAs">' + selectOpts(REF.staff, r.assigned_to, 'Nobody') + '</select></div>' +
    '<div><label class="nx-lbl" for="pdNote">Note</label><textarea class="nx-ta" id="pdNote">' + esc(r.note || '') + '</textarea></div>' +
    '<div class="nx-btnrow">' + (canPay() ? '<button class="nx-btn primary" id="pdSave">Save</button>' : '') + (s ? '<a class="nx-btn" href="#/students/' + s.id + '">Open student</a>' : (canPay() ? '<button class="nx-btn" id="pdLink">Link to student</button>' : '')) + '</div>' + (canPay() ? '' : '<div class="nx-help">Only the Processing and Accounts teams can change payments.</div>') + '<div class="nx-err" id="pdErr"></div></div></div>';
  if (!canPay()) $$('#pdQs, #pdSt, #pdAs, #pdNote', d).forEach(x => { x.disabled = true; });
  $('#pdX').onclick = () => { d.hidden = true; PY.sel = null; $$('#pyBody .nx-tr').forEach(tr => tr.classList.remove('sel')); };
  if ($('#pdSave')) $('#pdSave').onclick = async () => {
    try { await upd('nex_payment_queue', 'id=eq.' + r.id, { queue_status: $('#pdQs').value || null, processing_step: $('#pdSt').value || null, assigned_to: $('#pdAs').value || null, note: $('#pdNote').value.trim() || null, updated_by: ME.name }); toast('Saved'); d.hidden = true; PY.sel = null; render(); }
    catch (err) { $('#pdErr').textContent = err.message; }
  };
  const lk = $('#pdLink'); if (lk) lk.onclick = () => linkPayment(p, r);
}

function linkPayment(p, queueRow) {
  if (!p) return;
  pickStudent('Link payment to a student', async st => {
    try {
      const en = await sel('nex_enrolments', 'select=id,qualification_id,year,stage&student_id=eq.' + st.id + '&deleted_at=is.null&order=enrolled_on.desc.nullslast');
      const finish = async enrId => {
        await upd('nex_payments', 'id=eq.' + p.id, { student_id: st.id, enrolment_id: enrId });
        if (queueRow) await upd('nex_payment_queue', 'id=eq.' + queueRow.id, { enrolment_id: enrId, updated_by: ME.name });
        toast('Linked to ' + fullName(st)); render();
      };
      if (en.length <= 1) return finish(en[0] ? en[0].id : null);
      const m = openModal({ title: 'Which enrolment?', footer: false, body: '<div class="nx-sel-opt">' + en.map(e => '<button type="button" class="nx-pick" data-id="' + e.id + '"><span><b>' + esc(qualName(e.qualification_id) || 'Enrolment') + '</b><small>' + esc(e.year || '') + ' · ' + esc(statusLabel('enrolment', e.stage)) + '</small></span><span class="nx-tag">Choose</span></button>').join('') + '</div>' });
      $$('.nx-pick', m.el).forEach(b => b.onclick = async () => { m.close(); try { await finish(b.dataset.id); } catch (err) { toast(err.message, true); } });
    } catch (err) { toast(err.message, true); }
  }, p.payer_name || '');
}

function globalAddPayment() {
  /* one form: type the student's phone or email (or name). If they are already in Pipe-Line their details fill in and the payment goes against their enrolment. */
  const f = [
    { k: 'phone', label: 'Phone', type: 'tel' }, { k: 'email', label: 'Email', type: 'email' },
    { k: 'payer_name', label: 'Student name', placeholder: 'Or type a name to look them up' },
    { k: 'enrolment_id', label: 'Enrolment', type: 'select', options: [], blank: 'Choose the enrolment' },
    { k: 'amount', label: 'Amount ($)', type: 'number', required: true }, { k: 'paid_on', label: 'Payment date', type: 'date', value: sydToday(), required: true },
    { k: 'method', label: 'Method', type: 'select', options: ['Bank transfer', 'Cash', 'Card', 'Agent', 'Other'], blank: 'Not set' }, { k: 'reference', label: 'Reference', placeholder: 'Bank reference or receipt' },
    { k: 'note', label: 'Note', full: true }];
  let lk = null, enr = [];
  const m = formModal('Record payment', f, async v => {
    const st = lk ? lk.get() : null;
    if (!st && !v.payer_name) throw new Error('Enter the name of the person paying, or find them by phone or email.');
    if (st && enr.length > 1 && !v.enrolment_id) { const e = $('#f_enrolment_id', m.el); if (e) e.setAttribute('aria-invalid', 'true'); throw new Error('This student has more than one enrolment. Choose which one the payment is for.'); }
    const enrolmentId = st ? (v.enrolment_id || (enr.length === 1 ? enr[0].id : null)) : null;
    const { phone, email, enrolment_id, ...pay } = v;
    const p = await ins('nex_payments', Object.assign(pay, { payer_name: pay.payer_name || fullName(st), student_id: st ? st.id : null, enrolment_id: enrolmentId, created_by: ME.name }));
    if (enrolmentId) await ins('nex_payment_queue', { enrolment_id: enrolmentId, payment_id: p.id, processing_step: 'draft_not_made', updated_by: ME.name }, true).catch(() => {});
    toast(st ? 'Payment recorded for ' + fullName(st) : 'Payment recorded. Link it to a student later.'); render();
  }, 'Save payment', idBoxHtml('Start with the student\'s phone or email. If they are already in Pipe-Line, their details and enrolment fill in. Otherwise the payment is saved unmatched and can be linked later.'));
  const wrap = $('#f_enrolment_id', m.el).parentElement; wrap.hidden = true;
  lk = identityLookup(m, { ids: { phone: 'f_phone', email: 'f_email', name: 'f_payer_name' }, onChange: async st => {
    enr = []; const sel0 = $('#f_enrolment_id', m.el);
    if (!st) { wrap.hidden = true; sel0.innerHTML = ''; return; }
    try { enr = await sel('nex_enrolments', 'select=id,qualification_id,year,stage&student_id=eq.' + st.id + '&deleted_at=is.null&order=enrolled_on.desc.nullslast'); } catch (e) { enr = []; }
    if (lk.get() !== st) return;
    sel0.innerHTML = selectOpts(enr.map(e => ({ id: e.id, label: (qualName(e.qualification_id) || 'Enrolment') + (e.year ? ' · ' + e.year : '') })), enr.length === 1 ? enr[0].id : '', enr.length > 1 ? 'Choose the enrolment' : null);
    wrap.hidden = !enr.length;
  } });
  return m;
}
