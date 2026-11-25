'use strict';
/* pl-payments.js · Yatra · Payments and the payment queue.
   One of the Yatra files loaded by nex.html (list and order: PL_FILES in the loader). All of them share one global scope. */
/* =========================================================
   Payments and First Aid
   ========================================================= */
const PY = { view: 'toprocess', q: '', qs: '', page: 0, size: 50, sel: null };   /* qs = the Queue status filter ('' = all, '__none' = not set) */

route(/^\/payments(?:\?(.*))?$/, async m => {
  const qs = new URLSearchParams(m[1] || '');
  if (qs.get('view')) { PY.view = qs.get('view'); PY.page = 0; PY.sel = null; history.replaceState(null, '', '#/payments'); }
  if (PY.view === 'attention') PY.view = 'toprocess';   /* the old Needs attention tab is now the Queue status filter */
  if (PY.view === 'cash' && !ME.admin) PY.view = 'toprocess';   /* the cash receipts go to the admins */
  const [cTo, cDone, cUnm, cVer, cCash] = await Promise.all([
    count('nex_payment_queue', 'processing_step=neq.processed'),
    count('nex_payment_queue', 'processing_step=eq.processed'),
    count('nex_payments', 'student_id=is.null'),
    count('nex_payments', 'verify_status=eq.pending_verification'),
    ME.admin ? count('nex_payments', 'handover_status=eq.awaiting') : 0
  ]);
  afterRender(() => bindPayments());
  const seg = [['toprocess', 'To process', cTo], ['processed', 'Processed', cDone], ['verify', 'To verify', cVer]].concat(ME.admin ? [['cash', 'Cash receipts', cCash]] : [], [['unmatched', 'Unmatched', cUnm], ['all', 'All payments', null]]);
  return pageHead('cash', 'Payments', 'Payment queue', '<button class="nx-btn primary" id="pyAdd">' + ico('plus') + 'Record payment</button>') +
    '<div class="nx-split"><div class="nx-card"><div class="nx-toolbar" style="border-top:0"><div class="nx-seg" id="pySeg">' + seg.map(([k, l, n]) => '<button data-v="' + k + '" aria-pressed="' + (PY.view === k) + '">' + l + (n != null ? ' <span class="nx-count">' + n + '</span>' : '') + '</button>').join('') + '</div><input class="nx-in sm" id="pyQ" style="min-width:220px" placeholder="Search name or reference" value="' + esc(PY.q) + '"><select class="nx-sel sm" id="pyQs" aria-label="Queue status"' + (['toprocess', 'processed'].indexOf(PY.view) < 0 ? ' hidden' : '') + '><option value="">All queue statuses</option><option value="__none"' + (PY.qs === '__none' ? ' selected' : '') + '>Not set</option>' + selectOpts(opts('payment_queue'), PY.qs) + '</select></div>' +
    '<div id="pyBody"></div><div class="nx-foot" id="pyFoot"><span></span></div></div><div class="nx-drawer" id="pyDrawer" hidden></div></div>';
});

/* A payment on an enrolment that already has earlier payments is an instalment, so it goes to the queue as one rather than as a problem. */
async function queuePayment(enrolmentId, paymentId) {
  let later = false; try { later = (await count('nex_payments', 'enrolment_id=eq.' + enrolmentId + '&id=neq.' + paymentId)) > 0; } catch (e) {}
  const row = { enrolment_id: enrolmentId, payment_id: paymentId, processing_step: 'draft_not_made', updated_by: ME.name };
  if (later) row.queue_status = 'instalment';
  await ins('nex_payment_queue', row, true).catch(() => {});
}

/* The Payments search. The database does the filtering, never the 50 rows on screen. Typing a name finds payments and queue
   rows by who paid, the reference, and the student's name or email (every word typed must match the first name, last name or
   email, so "sam kar" works). Returns { filter, capped }: filter is the "&or=(...)" to add to the query (null = nothing matches);
   capped is true when more people matched than one query can carry, so the page can tell the person to type more. */
const PY_CAP = { people: 60, pays: 60, enrols: 100 };
async function pySearchFilter(q, view) {
  const enc = encodeURIComponent, list = ids => '(' + ids.join(',') + ')';
  const words = q.split(/\s+/).filter(Boolean).slice(0, 4);
  const who = 'payer_name.ilike.*' + enc(q) + '*,reference.ilike.*' + enc(q) + '*';
  const tableView = ['unmatched', 'all', 'verify', 'cash'].indexOf(view) >= 0;
  let capped = false, people = [];
  if (view !== 'unmatched') {   /* an unmatched payment has no student, so only who paid and the reference can match there */
    const and = words.map(w => 'or(first_name.ilike.*' + enc(w) + '*,last_name.ilike.*' + enc(w) + '*,email.ilike.*' + enc(w) + '*)').join(',');
    people = await sel('nex_students', 'select=id&and=(' + and + ')&limit=' + (PY_CAP.people + 1));
    if (people.length > PY_CAP.people) { capped = true; people = people.slice(0, PY_CAP.people); }
  }
  const pids = people.map(p => p.id);
  if (tableView) return { filter: '&or=(' + who + (pids.length ? ',student_id.in.' + list(pids) : '') + ')', capped };
  /* the queue is keyed by payment and enrolment, so turn the matches into those ids */
  let pays = await sel('nex_payments', 'select=id&or=(' + who + ')&limit=' + (PY_CAP.pays + 1));
  if (pays.length > PY_CAP.pays) { capped = true; pays = pays.slice(0, PY_CAP.pays); }
  let enrols = pids.length ? await sel('nex_enrolments', 'select=id&student_id=in.' + list(pids) + '&limit=' + (PY_CAP.enrols + 1)) : [];
  if (enrols.length > PY_CAP.enrols) { capped = true; enrols = enrols.slice(0, PY_CAP.enrols); }
  const parts = [];
  if (pays.length) parts.push('payment_id.in.' + list(pays.map(x => x.id)));
  if (enrols.length) parts.push('enrolment_id.in.' + list(enrols.map(x => x.id)));
  return { filter: parts.length ? '&or=(' + parts.join(',') + ')' : null, capped };
}

function bindPayments() {
  const body = $('#pyBody'); let rowsCache = [], seq = 0;
  const load = async () => {
    holdBody(body);
    const mine = ++seq;   /* a slow answer to an older search must not overwrite a newer one */
    try {
      const q = safeQ(PY.q); let rows, total, capNote = false;
      const from = PY.page * PY.size, to = from + PY.size - 1;
      if (['unmatched', 'all', 'verify', 'cash'].indexOf(PY.view) >= 0) {
        let query = 'select=*&order=paid_on.desc.nullslast,created_at.desc';
        if (PY.view === 'unmatched') query += '&student_id=is.null';
        if (PY.view === 'verify') query += '&verify_status=eq.pending_verification';
        if (PY.view === 'cash') query += '&handover_status=eq.awaiting';
        if (q) { const s = await pySearchFilter(q, PY.view); capNote = s.capped; query += s.filter; }
        ({ rows, total } = await selPage('nex_payments', query, from, to));
        if (mine !== seq) return;
        rowsCache = rows;
        body.innerHTML = rows.length ? '<div class="nx-tablewrap"><table class="nx-table tight"><thead><tr><th>Date</th><th>Paid by</th><th>Amount</th><th>Method</th><th>Reference</th><th>Student</th><th>Status</th><th></th></tr></thead><tbody>' +
          rows.map(p => '<tr><td>' + esc(fmtDate(p.paid_on)) + '</td><td>' + esc(p.payer_name || '–') + '</td><td class="nx-money">' + money(p.amount) + '</td><td>' + esc(p.method || '–') + '</td><td>' + esc(p.reference || '–') + '</td><td>' + (p.student_id ? '<a href="#/students/' + p.student_id + '">Open</a>' : '<span class="nx-pill warn">Unmatched</span>') + '</td><td>' + payStatusHtml(p) + '</td><td>' + payActions(p) + '</td></tr>').join('') + '</tbody></table></div>' : empty(PY.view === 'unmatched' ? 'Every payment is linked to a student' : PY.view === 'verify' ? 'Nothing waiting for verification' : PY.view === 'cash' ? 'No cash receipts waiting for a check' : 'No payments found');
      } else {
        let query = 'select=*,nex_payments(id,amount,paid_on,payer_name,reference,method,student_id),nex_enrolments(id,student_id,qualification_id,fee,nex_students(id,first_name,last_name,email),pays:nex_payments(id,amount,paid_on,created_at))&order=nex_payments(paid_on).asc.nullslast,created_at.asc,id.asc';
        if (PY.view === 'toprocess') query += '&processing_step=neq.processed';
        else query += '&processing_step=eq.processed';
        if (PY.qs === '__none') query += '&queue_status=is.null'; else if (PY.qs) query += '&queue_status=eq.' + encodeURIComponent(PY.qs);
        /* the search runs in the database (not on the 50 rows on screen), so the counts and the page buttons stay right */
        let noMatch = false;
        if (q) { const s = await pySearchFilter(q, PY.view); capNote = s.capped; if (s.filter) query += s.filter; else noMatch = true; }
        if (noMatch) { rows = []; total = 0; } else ({ rows, total } = await selPage('nex_payment_queue', query, from, to));
        if (mine !== seq) return;
        rowsCache = rows;
        const stepIdx = k => ['draft_not_made', 'draft_made', 'ready_to_process', 'processed'].indexOf(k);
        body.innerHTML = rows.length ? '<div class="nx-tablewrap"><table class="nx-table tight"><thead><tr><th>Student</th><th>Paid</th><th>Amount</th><th>Placement</th><th>Queue status</th><th>Processing</th><th>Updated</th></tr></thead><tbody>' +
          rows.map(r => { const p = r.nex_payments || {}, e = r.nex_enrolments || {}, s = e.nex_students || null; const si = stepIdx(r.processing_step);
            return '<tr class="nx-tr ' + (PY.sel === r.id ? 'sel' : '') + '" data-id="' + r.id + '"><td><div class="nx-who"><span class="nx-avatar">' + esc(initials(s ? fullName(s) : p.payer_name)) + '</span><div><b>' + esc(s ? fullName(s) : (p.payer_name || 'Unknown')) + '</b><span>' + esc(s ? s.email || '' : 'Not matched') + '</span></div></div></td><td>' + esc(fmtDate(p.paid_on)) + '</td><td class="nx-money">' + money(p.amount) + (e.fee && p.id ? (x => x ? '<div class="nx-muted nx-inst">' + esc(x.label) + '</div>' : '')(instalmentOf(e.fee, e.pays, p.id)) : '') + '</td><td>' + pill('placement_queue', r.placement_status) + '</td><td>' + pill('payment_queue', r.queue_status) + '</td><td>' + '<div class="nx-stagecell">' + pill('processing', r.processing_step) + '<div class="nx-steps">' + [0, 1, 2, 3].map(i => '<i class="' + (i <= si ? 'on' : '') + '"></i>').join('') + '</div></div></td><td>' + esc(fmtDT(r.updated_at)) + '</td></tr>'; }).join('') + '</tbody></table></div>' : empty('Nothing here', q || PY.qs ? 'No entries match your search or filter.' : PY.view === 'toprocess' ? 'The queue is clear.' : 'No entries in this list.');
        $$('.nx-tr', body).forEach(tr => tr.onclick = () => openQueueDrawer(rowsCache.find(x => x.id === tr.dataset.id), load));
      }
      const fromN = total ? from + 1 : 0, toN = from + rows.length;
      $('#pyFoot').innerHTML = '<span>' + (total != null ? (total ? fromN + '–' + toN + ' of ' + total.toLocaleString('en-AU') : '') : rows.length + ' shown') + (capNote ? ' · Many people match. Type more of the name to narrow it down.' : '') + '</span><span class="nx-btnrow"><button class="nx-btn sm" id="pyPrev"' + (PY.page ? '' : ' disabled') + '>Previous</button><button class="nx-btn sm" id="pyNext"' + (total != null && toN >= total ? ' disabled' : '') + '>Next</button></span>';
      $('#pyPrev').onclick = () => { PY.page--; load(); }; $('#pyNext').onclick = () => { PY.page++; load(); };
      $$('[data-link]', body).forEach(b => b.onclick = () => linkPayment(rowsCache.find(x => x.id === b.dataset.link)));
      $$('[data-vok]', body).forEach(b => b.onclick = () => verifyPayment(rowsCache.find(x => x.id === b.dataset.vok), 'confirmed', load));
      $$('[data-vno]', body).forEach(b => b.onclick = () => verifyPayment(rowsCache.find(x => x.id === b.dataset.vno), 'rejected', load));
      $$('[data-hand]', body).forEach(b => b.onclick = () => handoverCheck(rowsCache.find(x => x.id === b.dataset.hand), load));
    } catch (e) { body.innerHTML = empty('Could not load payments', e.message); }
  };
  $$('#pySeg button').forEach(b => b.onclick = () => { PY.view = b.dataset.v; PY.page = 0; PY.sel = null; $('#pyDrawer').hidden = true; $('#pyQs').hidden = ['toprocess', 'processed'].indexOf(PY.view) < 0; $$('#pySeg button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); load(); });
  let t = 0; $('#pyQ').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { PY.q = e.target.value; PY.page = 0; load(); }, 300); });
  $('#pyQs').onchange = e => { PY.qs = e.target.value; PY.page = 0; load(); };
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
    (e.fee ? '<div class="nx-muted">Agreed fee ' + money(e.fee) + (x => x ? ' · ' + esc(x.label) + ' · paid so far ' + money(x.paidTo) : '')(instalmentOf(e.fee, e.pays, p.id)) + '</div>' : '') +
    '<div><label class="nx-lbl" for="pdPl">Placement</label><select class="nx-sel" id="pdPl">' + selectOpts(opts('placement_queue', true), r.placement_status, 'Not set') + '</select><div class="nx-help">Follows the placement plan flag that Evershine sets on the class booking: Yes or not set = Plc Interested, No = PLC NYC, Done = Plc Completed.</div></div>' +
    '<div><label class="nx-lbl" for="pdQs">Queue status</label><select class="nx-sel" id="pdQs">' + selectOpts(opts('payment_queue', true), r.queue_status, 'Not set') + '</select></div>' +
    '<div><label class="nx-lbl" for="pdSt">Processing step</label><select class="nx-sel" id="pdSt">' + selectOpts(opts('processing', true), r.processing_step) + '</select></div>' +
    '<div><label class="nx-lbl" for="pdNote">Note</label><textarea class="nx-ta" id="pdNote">' + esc(r.note || '') + '</textarea></div>' +
    '<div class="nx-btnrow">' + (canPay() ? '<button class="nx-btn primary" id="pdSave">Save</button>' : '') + (s ? '<a class="nx-btn" href="#/students/' + s.id + '">Open student</a>' : (canPay() ? '<button class="nx-btn" id="pdLink">Link to student</button>' : '')) + '</div>' + (canPay() ? '' : '<div class="nx-help">Only the Processing and Accounts teams can change payments.</div>') + '<div class="nx-err" id="pdErr"></div></div></div>';
  if (!canPay()) $$('#pdPl, #pdQs, #pdSt, #pdAs, #pdNote', d).forEach(x => { x.disabled = true; });
  $('#pdX').onclick = () => { d.hidden = true; PY.sel = null; $$('#pyBody .nx-tr').forEach(tr => tr.classList.remove('sel')); };
  if ($('#pdSave')) $('#pdSave').onclick = async () => {
    try { await upd('nex_payment_queue', 'id=eq.' + r.id, { placement_status: $('#pdPl').value || null, queue_status: $('#pdQs').value || null, processing_step: $('#pdSt').value || null, note: $('#pdNote').value.trim() || null, updated_by: ME.name }); toast('Saved'); d.hidden = true; PY.sel = null; render(); }
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
  /* one form: type the student's phone or email (or name). If they are already in Yatra their details fill in and the payment goes against their enrolment. */
  const f = [
    { k: 'payer_name', label: 'Student name', placeholder: 'Start typing their name' }, { k: 'phone', label: 'Phone', type: 'tel' },
    { k: 'email', label: 'Email', type: 'email' }, { k: 'amount', label: 'Amount ($)', type: 'number', required: true },
    { k: 'enrolment_id', label: 'Enrolment', type: 'select', options: [], blank: 'Choose the enrolment', full: true },
    { k: 'paid_on', label: 'Payment date', type: 'date', value: sydToday(), required: true },
    { k: 'method', label: 'Method', type: 'select', options: payMethodOpts(), blank: 'Choose', required: true },
    { k: 'method_help', type: 'help', text: payMethodHelp() },
    { k: 'reference', label: 'Reference', placeholder: 'Bank reference or receipt' }, { k: 'note', label: 'Note' }];
  let lk = null, enr = [];
  const m = formModal('Record payment', f, async v => {
    const st = lk ? lk.get() : null;
    if (!st && !v.payer_name) throw new Error('Enter the name of the person paying, or find them by phone or email.');
    if (st && enr.length > 1 && !v.enrolment_id) { const e = $('#f_enrolment_id', m.el); if (e) e.setAttribute('aria-invalid', 'true'); throw new Error('This student has more than one enrolment. Choose which one the payment is for.'); }
    const enrolmentId = st ? (v.enrolment_id || (enr.length === 1 ? enr[0].id : null)) : null;
    const { phone, email, enrolment_id, ...pay } = v;
    const p = await ins('nex_payments', Object.assign(pay, { payer_name: pay.payer_name || fullName(st), student_id: st ? st.id : null, enrolment_id: enrolmentId, created_by: ME.name }));
    if (enrolmentId) await queuePayment(enrolmentId, p.id);
    toast(st ? payDoneMsg(v.method).replace(/^Payment recorded/, 'Payment recorded for ' + fullName(st)) : 'Payment recorded. Link it to a student later.'); render();
  }, 'Save payment', idBoxHtml('Start with the student’s name (or their phone or email). If they are already in Yatra, pick them and their details and enrolment fill in. Otherwise the payment is saved unmatched and can be linked later.'));
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

/* The buttons on a payment row: link it to a student, Accounts verify a bank payment, an admin checks a cash handover. */
function payActions(p) {
  const b = [];
  if (!p.student_id && canPay()) b.push('<button class="nx-btn sm" data-link="' + p.id + '">Link to student</button>');
  if (p.verify_status === 'pending_verification' && canVerify()) b.push('<button class="nx-btn sm primary" data-vok="' + p.id + '">Verify</button><button class="nx-btn sm" data-vno="' + p.id + '">Not found</button>');
  if (p.handover_status === 'awaiting' && ME.admin && p.student_id) b.push('<button class="nx-btn sm primary" data-hand="' + p.id + '">Handover checked</button>');
  return b.length ? '<div class="nx-btnrow">' + b.join('') + '</div>' : '';
}
/* Accounts check a bank payment against the bank statement: confirm it, or say the money was not found (a reason is needed). A confirmed payment counts as received. */
function verifyPayment(p, result, after) {
  if (!p) return;
  const who = esc(p.payer_name || 'this payer'), ok = result === 'confirmed';
  const body = '<p style="margin:0 0 12px">' + (ok ? 'Confirm that ' + money(p.amount) + ' from ' + who + ' (' + esc(fmtDate(p.paid_on)) + ') is on the bank statement.' : 'Say why ' + money(p.amount) + ' from ' + who + ' was not found on the bank statement. It will not count as received.') +
    '</p><label class="nx-lbl" for="vpNote">Note' + (ok ? '' : ' *') + '</label><input class="nx-in" id="vpNote" autocomplete="off" placeholder="' + (ok ? 'Optional, for example the statement line' : 'For example: not on the statement yet') + '">';
  return openModal({ title: ok ? 'Verify payment' : 'Money not found', body, buttons: [{ label: 'Cancel', close: true }, { label: ok ? 'Verify' : 'Not found', primary: true, run: async mm => {
    const note = $('#vpNote', mm.el).value.trim();
    if (!ok && !note) throw fieldError('#vpNote', 'Say why the money was not found.');
    await api('rpc/nex_verify_payment', { method: 'POST', body: { p_payment: p.id, p_result: result, p_note: note || null } });
    toast(ok ? 'Payment verified' : 'Marked as not received'); after();
  } }] });
}
/* An admin checks that the cash was handed over. The payment must already be on a student's profile, which is where it is recorded. */
function handoverCheck(p, after) {
  if (!p) return;
  return openModal({ title: 'Check cash handover', body: '<p style="margin:0 0 12px">Confirm you have received ' + money(p.amount) + ' in cash for ' + esc(p.payer_name || 'this student') + ' (' + esc(fmtDate(p.paid_on)) + '). It is then recorded as checked on their profile.</p><label class="nx-lbl" for="hoNote">Note</label><input class="nx-in" id="hoNote" autocomplete="off" placeholder="Optional">',
    buttons: [{ label: 'Cancel', close: true }, { label: 'Handover checked', primary: true, run: async mm => {
      await api('rpc/nex_verify_cash_handover', { method: 'POST', body: { p_payment: p.id, p_note: $('#hoNote', mm.el).value.trim() || null } });
      toast('Cash handover checked'); after();
    } }] });
}
