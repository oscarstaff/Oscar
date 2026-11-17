'use strict';
/* pl-logbooks.js · YatraLine · Logbook receipts.
   One of the YatraLine files loaded by nex.html (list and order: PL_FILES in the loader). All of them share one global scope. */
/* ---------- Logbook receipts: who received which student's logbook, and when ----------
   Replaces the sheet with the columns DATE, STUDENT NAME, EMAIL ADDRESS, LOGBOOK RECEIVER, COMMENTS.
   A receipt for someone in YatraLine is linked to them (it shows on their Activity). A name YatraLine does not know is saved by name only. */
const LB = { q: '', mine: false, days: '60', rows: [], staff: null };
async function lbStaff() {
  if (LB.staff) return LB.staff;
  try { LB.staff = (await sel('staff_credentials', 'select=staff_name&order=staff_name.asc')).map(r => r.staff_name).filter(Boolean); } catch (e) { LB.staff = []; }
  return LB.staff;
}
async function lbLoad() {
  let q = 'select=*&order=received_on.desc,created_at.desc&limit=500';
  if (LB.days !== 'all') { const d = new Date(Date.now() - Number(LB.days) * 86400000).toLocaleDateString('en-CA', { timeZone: TZ }); q += '&received_on=gte.' + d; }
  LB.rows = await sel('nex_logbook_receipts', q);
}
function lbVisible() {
  const q = LB.q.trim().toLowerCase();
  return LB.rows.filter(r => (!LB.mine || r.receiver === ME.name) && (!q || [r.student_name, r.email, r.receiver, r.comments].join(' ').toLowerCase().includes(q)));
}
function lbOpts(list, cur) { const l = list.slice(); if (cur && !l.includes(cur)) l.unshift(cur); return l.map(n => '<option' + (n === cur ? ' selected' : '') + '>' + esc(n) + '</option>').join(''); }
function lbTable() {
  const rows = lbVisible();
  if (!rows.length) return empty('No logbook receipts to show', LB.q || LB.mine ? 'Clear the search or the Mine filter to see more.' : 'Record the first one above.');
  return '<div class="nx-tablewrap"><table class="nx-table tight"><thead><tr><th>Date</th><th>Student name</th><th>Email address</th><th>Logbook receiver</th><th>Comments</th><th></th></tr></thead><tbody>' + rows.map(r => {
    const nm = r.student_id ? '<a href="#/students/' + esc(r.student_id) + '">' + esc(r.student_name) + '</a>' : esc(r.student_name);
    const acts = [];
    if (r.created_by === ME.name || ME.admin) acts.push('<button class="nx-btn sm" data-le="' + esc(r.id) + '">' + ico('edit') + 'Edit</button>');
    if (ME.admin) acts.push('<button class="nx-btn sm quiet" data-ld="' + esc(r.id) + '" aria-label="Delete this receipt">' + ico('trash') + '</button>');
    return '<tr><td class="nx-nowrap">' + esc(fmtDate(r.received_on)) + '</td><td><b>' + nm + '</b></td><td>' + esc(r.email || '–') + '</td><td>' + esc(r.receiver || '–') + '</td><td class="nx-lbcomment">' + esc(r.comments || '') + '</td><td><div class="nx-btnrow">' + acts.join('') + '</div></td></tr>';
  }).join('') + '</tbody></table></div>';
}
route(/^\/logbooks$/, async () => {
  const staff = await lbStaff();
  try { await lbLoad(); } catch (e) { LB.rows = []; }
  afterRender(() => {
    const f = $('#lbForm'), save = $('#lbSave');
    const lk = identityLookup({ el: f }, { ids: { name: 'lbName', email: 'lbEmail' }, newMsg: 'Not found in YatraLine. The receipt will be saved by name only.' });
    const paint = () => {
      $('#lbTable').innerHTML = lbTable();
      $('#lbCount').textContent = lbVisible().length + (lbVisible().length === 1 ? ' receipt' : ' receipts');
      $$('[data-le]').forEach(b => b.onclick = () => editRow(LB.rows.find(r => String(r.id) === b.dataset.le)));
      $$('[data-ld]').forEach(b => b.onclick = () => delRow(LB.rows.find(r => String(r.id) === b.dataset.ld)));
    };
    const reload = async () => { try { await lbLoad(); } catch (e) { toast(e.message, true); } paint(); };
    const editRow = r => {
      if (!r) return;
      openModal({ title: 'Edit logbook receipt', body: '<div class="nx-form"><div><label class="nx-lbl" for="leDate">Date</label><input class="nx-in" type="date" id="leDate" max="' + sydToday() + '" value="' + esc(r.received_on) + '"></div><div><label class="nx-lbl" for="leRecv">Logbook receiver</label><select class="nx-sel" id="leRecv">' + lbOpts(staff, r.receiver) + '</select></div><div><label class="nx-lbl" for="leName">Student name</label><input class="nx-in" id="leName" value="' + esc(r.student_name) + '"></div><div><label class="nx-lbl" for="leEmail">Email address</label><input class="nx-in" id="leEmail" type="email" value="' + esc(r.email || '') + '"></div><div class="full"><label class="nx-lbl" for="leCom">Comments</label><textarea class="nx-ta" id="leCom">' + esc(r.comments || '') + '</textarea></div></div>',
        buttons: [{ label: 'Cancel', close: true }, { label: 'Save', primary: true, run: async m => {
          const nm = $('#leName', m.el).value.trim(), d = $('#leDate', m.el).value, em = $('#leEmail', m.el).value.trim();
          if (!nm) throw new Error('Student name is required.');
          if (!d) throw new Error('Date is required.');
          if (d > sydToday()) throw new Error('The date cannot be in the future.');
          if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) throw new Error('That email does not look right.');
          await upd('nex_logbook_receipts', 'id=eq.' + encodeURIComponent(r.id), { received_on: d, student_name: nm, email: em || null, receiver: $('#leRecv', m.el).value, comments: $('#leCom', m.el).value.trim() || null });
          toast('Receipt updated'); await reload();
        } }] });
    };
    const delRow = async r => {
      if (!r || !ME.admin) return;
      if (!(await confirmBox('Delete this receipt?', r.student_name + ' · ' + fmtDate(r.received_on) + '. This cannot be undone, but it stays in the audit history.', 'Delete', true))) return;
      await api('nex_logbook_receipts?id=eq.' + encodeURIComponent(r.id), { method: 'DELETE' });
      toast('Receipt deleted'); await reload();
    };
    f.onsubmit = async e => {
      e.preventDefault();
      if (save.disabled) return;
      try {
        const nm = $('#lbName').value.trim(), em = $('#lbEmail').value.trim(), d = $('#lbDate').value, st = lk.get();
        if (!nm) { $('#lbName').focus(); throw new Error('Student name is required.'); }
        if (!d) { $('#lbDate').focus(); throw new Error('Date is required.'); }
        if (d > sydToday()) { $('#lbDate').focus(); throw new Error('The date cannot be in the future.'); }
        if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { $('#lbEmail').focus(); throw new Error('That email does not look right.'); }
        const dupe = LB.rows.find(r => r.received_on === d && ((st && r.student_id === st.id) || (!st && r.student_name.trim().toLowerCase() === nm.toLowerCase())));
        if (dupe && !(await confirmBox('Already recorded', nm + ' already has a receipt on ' + fmtDate(d) + ', received by ' + (dupe.receiver || 'someone') + '. Add another?', 'Add another'))) return;
        save.disabled = true; save.classList.add('busy');
        await ins('nex_logbook_receipts', { received_on: d, student_id: st ? st.id : null, student_name: nm, email: em || null, receiver: $('#lbRecv').value, comments: $('#lbCom').value.trim() || null }, true);
        toast('Logbook receipt saved' + (st ? ' and added to ' + fullName(st) + '’s activity' : ''));
        $('#lbName').value = ''; $('#lbEmail').value = ''; $('#lbCom').value = ''; lk.clear(); $('#lbName').focus();
        await reload();
      } catch (err) { toast(err.message || 'Could not save the receipt.', true); }
      finally { save.disabled = false; save.classList.remove('busy'); }
    };
    $('#lbSearch').oninput = e => { LB.q = e.target.value; paint(); };
    $('#lbMine').onchange = e => { LB.mine = e.target.checked; paint(); };
    $('#lbDays').onchange = async e => { LB.days = e.target.value; await reload(); };
    $('#lbRefresh').onclick = reload;
    paint();
  });
  const me = ME.name || '';
  return pageHead('notebook', 'Staff', 'Logbook receipts', '') +
    '<div class="nx-card"><div class="nx-card-h"><div><h3>Record a logbook</h3><div class="nx-muted">Type the student’s name or email. If they are in YatraLine the receipt is added to their Activity.</div></div></div><div class="nx-card-b">' +
    '<form id="lbForm" novalidate><div class="nx-form">' +
    '<div><label class="nx-lbl" for="lbName">Student name *</label><input class="nx-in" id="lbName" autocomplete="off"></div>' +
    '<div><label class="nx-lbl" for="lbEmail">Email address</label><input class="nx-in" id="lbEmail" type="email" autocomplete="off"></div>' +
    '<div class="full">' + idBoxHtml('') + '</div>' +
    '<div><label class="nx-lbl" for="lbDate">Date received *</label><input class="nx-in" type="date" id="lbDate" max="' + sydToday() + '" value="' + sydToday() + '"></div>' +
    '<div><label class="nx-lbl" for="lbRecv">Logbook receiver</label><select class="nx-sel" id="lbRecv">' + lbOpts(staff, me) + '</select></div>' +
    '<div class="full"><label class="nx-lbl" for="lbCom">Comments</label><textarea class="nx-ta" id="lbCom" placeholder="Optional. Anything the next person should know."></textarea></div>' +
    '</div><div class="nx-btnrow" style="margin-top:14px"><button class="nx-btn primary" id="lbSave" type="submit">' + ico('check') + 'Save receipt</button></div></form></div></div>' +
    '<div class="nx-card"><div class="nx-toolbar" style="border-top:0"><input class="nx-in sm" id="lbSearch" type="search" placeholder="Search name, email, comments" aria-label="Search logbook receipts" value="' + esc(LB.q) + '">' +
    '<select class="nx-sel sm" id="lbDays" aria-label="Period"><option value="30"' + (LB.days === '30' ? ' selected' : '') + '>Last 30 days</option><option value="60"' + (LB.days === '60' ? ' selected' : '') + '>Last 60 days</option><option value="180"' + (LB.days === '180' ? ' selected' : '') + '>Last 6 months</option><option value="all"' + (LB.days === 'all' ? ' selected' : '') + '>All</option></select>' +
    '<label class="nx-check"><input type="checkbox" id="lbMine"' + (LB.mine ? ' checked' : '') + '> Received by me</label><span class="nx-muted" id="lbCount"></span><span class="nx-grow"></span><button class="nx-btn sm" id="lbRefresh" type="button">' + ico('refresh') + 'Refresh</button></div><div id="lbTable"></div></div>';
});
