'use strict';
/* pl-firstaid.js · YatraLine · First Aid and CPR class days and the seat map.
   One of the YatraLine files loaded by nex.html (list and order: PL_FILES in the loader). All of them share one global scope. */
/* =========================================================
   First Aid and CPR
   ========================================================= */
/* Which class days the day strip shows, and how the booking list under it is sorted. They stay as set while you move around.
   The booking list is A to Z by name until someone picks another order. */
const CF = { kind: '', trainer: '', from: '', to: '' };
const CB = { q: '', sort: 'name', type: '', att: '' };
const FB_SORTS = [['name', 'Name A to Z'], ['name_desc', 'Name Z to A'], ['seat', 'Seat number'], ['new', 'Newest booking']];
const FB_TYPES = [['student', 'Student'], ['walk_in', 'Walk-in'], ['agent_group', 'Agent group']];
function fbRows(live) {
  const q = CB.q.trim().toLowerCase(), qd = q.replace(/\D/g, '');
  const list = live.filter(b => (!CB.type || b.booking_type === CB.type) && (!CB.att || (CB.att === 'attended') === (b.status === 'attended')) &&
    (!q || (b.name || '').toLowerCase().includes(q) || (b.email || '').toLowerCase().includes(q) || (qd.length >= 3 && (b.phone || '').replace(/\D/g, '').includes(qd))));
  const nm = (a, c) => (a.name || '').localeCompare(c.name || '', 'en', { sensitivity: 'base' });
  const by = { name: nm, name_desc: (a, c) => nm(c, a), seat: (a, c) => ((a.seat_no || 1e9) - (c.seat_no || 1e9)) || nm(a, c), new: (a, c) => String(c.created_at || '').localeCompare(String(a.created_at || '')) || nm(a, c) };
  return list.sort(by[CB.sort] || nm);
}
function fbTable(cur, live, payBy, showSeats) {
  const list = fbRows(live);
  if (!list.length) return empty(live.length ? 'Nobody matches' : 'No bookings yet', live.length ? 'Try clearing a filter.' : 'Press Add booking to add the first one.');
  return '<div class="nx-tablewrap"><table class="nx-table tight"><thead><tr>' + (showSeats ? '<th>Seat</th>' : '') + '<th>Name</th><th>Type</th><th>Payment</th><th>Attendance</th><th>Flags</th><th><span class="nx-sr">Actions</span></th></tr></thead><tbody>' +
    list.map(b => '<tr class="nx-tr" data-b="' + b.id + '">' + (showSeats ? '<td class="nx-num">' + (b.seat_no || '<span class="nx-muted">–</span>') + '</td>' : '') + '<td><b>' + (b.nex_students ? '<a href="#/students/' + b.nex_students.id + '">' + esc(b.name) + '</a>' : esc(b.name)) + '</b><span class="nx-sub">' + esc([fmtPhone(b.phone), b.email].filter(Boolean).join(' · ') || 'No contact details') + '</span></td>' +
      '<td>' + (b.booking_type === 'student' ? '<span class="nx-tag">Student</span>' : '<span class="nx-tag walk">' + (b.booking_type === 'walk_in' ? 'Walk-in' : 'Agent group') + '</span>') + (b.agent_id ? '<span class="nx-sub">' + esc(agentName(b.agent_id)) + '</span>' : '') + (b.created_by ? '<span class="nx-sub">Booked by ' + esc(b.created_by) + '</span>' : '') + '</td>' +
      '<td>' + bookingPayCell(b, payBy[b.student_id]) + '</td><td>' + attCell(b) + '</td>' +
      '<td><div class="nx-flags">' + bookingFlags(cur, b) + '</div></td><td class="nx-actcell"><div class="nx-btnrow">' + (canFlag() && cur.kind !== 'renewal' && !bkOff(b.status) ? '<button class="nx-btn sm icon" data-conf="' + b.id + '" title="Email confirmation" aria-label="Email confirmation to ' + esc(b.name) + '">' + ico('mail') + '</button>' : '') + '<button class="nx-btn sm" data-edit="' + b.id + '">Edit</button></div></td></tr>').join('') + '</tbody></table></div>';
}

route(/^\/firstaid(?:\/([0-9a-f-]{36}))?$/, async m => {
  const today = sydToday();
  const back = CF.from || today;   /* a class closes once its date has passed: the day strip starts today unless you ask for earlier dates; older days are also reached with Past classes */
  const [sess0, trs, used] = await Promise.all([
    sel('nex_class_sessions', 'select=*&class_date=gte.' + back + (CF.to ? '&class_date=lte.' + CF.to : '') + (CF.kind ? '&kind=eq.' + CF.kind : '') + (CF.trainer ? '&trainer=eq.' + encodeURIComponent(CF.trainer) : '') + '&order=class_date.asc,kind.asc&limit=' + (CF.from || CF.to ? 200 : 60)),
    sel('nex_trainers', 'select=*&order=name').catch(() => REF.trainers || []),
    sel('nex_class_sessions', 'select=trainer&trainer=not.is.null&limit=2000').catch(() => [])
  ]);
  let sessions = sess0; REF.trainers = trs;
  const trainerNames = Array.from(new Set(trs.filter(t => t.active).map(t => t.name).concat(used.map(x => x.trainer).filter(Boolean)))).sort((a, c) => a.localeCompare(c, 'en', { sensitivity: 'base' }));
  let want = m[1];
  if (want && !sessions.find(s => s.id === want)) { const one = await sel('nex_class_sessions', 'select=*&id=eq.' + want); if (one[0]) sessions = [one[0]].concat(sessions).sort((a, b) => a.class_date.localeCompare(b.class_date)); }
  const cur = sessions.find(s => s.id === want) || sessions.find(s => s.class_date >= today) || sessions[sessions.length - 1] || null;
  const cnt = {};
  if (sessions.length) { const rows = await selAll('nex_class_bookings', 'select=session_id,status&session_id=in.' + inList(sessions.map(s => s.id))); rows.forEach(b => { if (!bkOff(b.status)) cnt[b.session_id] = (cnt[b.session_id] || 0) + 1; }); }
  let books = [];
  if (cur) books = await sel('nex_class_bookings', 'select=*,nex_students(id,first_name,last_name)&session_id=eq.' + cur.id + '&order=created_at.asc');
  const o = (v, cur, l) => '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>' + esc(l) + '</option>';
  const filtered = !!(CF.kind || CF.trainer || CF.from || CF.to);
  const bar = '<div class="nx-card"><div class="nx-toolbar" style="border-top:0;flex-wrap:wrap"><select class="nx-sel sm" id="cfKind" aria-label="Class type">' + o('', CF.kind, 'All class types') + o('full', CF.kind, 'Full class') + o('renewal', CF.kind, 'Renewal and signature') + '</select>' +
    '<select class="nx-sel sm" id="cfTrainer" aria-label="Trainer">' + o('', CF.trainer, 'All trainers') + trainerNames.map(n => o(n, CF.trainer, n)).join('') + '</select>' +
    '<label class="nx-muted" style="display:flex;align-items:center;gap:4px">From <input class="nx-in sm" type="date" id="cfFrom" value="' + esc(CF.from) + '"> to <input class="nx-in sm" type="date" id="cfTo" value="' + esc(CF.to) + '"></label>' +
    (filtered ? '<button class="nx-btn sm" id="cfClear">Clear</button>' : '') + '<span class="nx-muted" style="margin-left:auto">' + (CF.from || CF.to ? 'Showing class days in this date range' : 'Showing today and later. Pick a From date to look back.') + '</span></div></div>';
  afterRender(() => bindFirstAid(cur, books, { payBy, live }));
  const head = pageHead('aid', 'First Aid and CPR', 'Class', (canFlag() ? '<button class="nx-btn" id="faExport">' + ico('download') + 'Export to Sheets</button>' : '') + '<button class="nx-btn" id="faJump">Past classes</button><button class="nx-btn primary" id="faNew">' + ico('plus') + 'New class day</button>');
  if (!cur) return head + bar + '<div class="nx-card">' + (filtered ? empty('No class days match', 'Try clearing a filter or widening the dates.') : empty('No classes scheduled', 'Add the next class day to start taking bookings.')) + '</div>';
  var live = books.filter(b => !bkOff(b.status));
  /* the booking and the payment are separate things: a booking is confirmed whether or not anything is paid, and each payment has its own status */
  var payBy = {}; const sids = live.map(b => b.student_id).filter(Boolean);
  if (sids.length) (await sel('nex_payments', 'select=student_id,amount,method,verify_status,handover_status&student_id=in.' + inList(sids)).catch(() => [])).forEach(p => (payBy[p.student_id] = payBy[p.student_id] || []).push(p));
  const offs = books.filter(b => bkOff(b.status));
  const moved = offs.length ? await bkMovedMap(offs).catch(() => ({})) : {};
  const d = fmtDay(cur.class_date);
  const closed = cur.class_date < today;   /* the database refuses new bookings into a class that has passed (admins can still add) */
  const seated = live.filter(b => b.seat_no);
  const showSeats = canFlag();   /* the seat numbers are where people sit on the day: only the Evershine team (and admins) see them */
  const walk = live.filter(b => b.booking_type !== 'student').length;
  return head + bar + '<div class="nx-card"><div class="nx-card-b"><div class="nx-days" id="faDays">' + sessions.map(s => { const dd = fmtDay(s.class_date); const n = cnt[s.id] || 0; return '<button class="nx-day" data-id="' + s.id + '" aria-pressed="' + (s.id === cur.id) + '"><b>' + dd.wd + ' ' + dd.dm + '</b><span>' + (s.kind === 'renewal' ? 'Renewal' : 'Full class') + ' · ' + n + ' / ' + s.seats + '</span></button>'; }).join('') + '</div></div></div>' +
    '<div class="nx-card"><div class="nx-card-h"><div><div class="nx-eyebrow">' + (cur.kind === 'renewal' ? 'Renewal and signature day' : 'Full class day') + '</div><h3 style="font-size:18px">' + d.wd + ' ' + d.dm + (cur.trainer ? ' · ' + esc(cur.trainer) : '') + '</h3></div><div class="nx-btnrow"><button class="nx-btn sm" id="faEdit">' + ico('edit') + 'Edit class</button></div></div><div class="nx-card-b" style="display:flex;flex-direction:column;gap:12px">' +
    '<div style="display:flex;justify-content:space-between;align-items:baseline"><span class="nx-big">' + live.length + ' <span class="nx-muted" style="font-size:16px">of ' + cur.seats + ' seats</span></span><span class="nx-muted">' + (showSeats ? (cur.seats - seated.length) + ' seats free' : Math.max(0, cur.seats - live.length) + ' places left') + (walk ? ' · ' + walk + ' walk-in or agent' : '') + (cur.start_time ? ' · ' + esc(cur.start_time) + (cur.end_time ? '–' + esc(cur.end_time) : '') : '') + '</span></div>' +
    (showSeats ? '<div class="nx-cap"><i class="a" style="width:' + Math.min(100, seated.length / cur.seats * 100) + '%"></i></div>' : '') +
    (live.length > cur.seats ? '<div class="nx-warnbox">This class has more bookings than seats. Move some people to another day.</div>' : '') +
    (showSeats ? '<div class="nx-seats" id="faSeats" role="list" aria-label="Seat map. Display only.">' + Array.from({ length: cur.seats }, (_, i) => { const n = i + 1; const b = live.find(x => x.seat_no === n); return '<div role="listitem" class="nx-seat ' + (b ? (b.booking_type !== 'student' ? 'walk' : 'booked') : '') + '" title="' + esc(b ? 'Seat ' + n + ': ' + b.name : 'Seat ' + n + ': free') + '"><span>' + (b ? esc((b.name || '').split(' ')[0].slice(0, 7)) : n) + '</span></div>'; }).join('') + '</div>' +
    '<div class="nx-legend"><span><i></i>Free</span><span><i class="booked"></i>Student</span><span><i class="walk"></i>Walk-in or agent group</span></div>' : '') + '</div></div>' +
    '<div class="nx-card" id="faBook"><div class="nx-card-h"><h3>Bookings</h3><div class="nx-btnrow">' + (canFlag() && cur.kind !== 'renewal' && live.length ? '<button class="nx-btn sm" id="faMail">' + ico('mail') + 'Email confirmations</button>' : '') + (closed && !ME.admin ? '<span class="nx-pill">Closed</span>' : '<button class="nx-btn primary sm" id="faAdd">' + ico('plus') + (closed ? 'Add booking (admin)' : 'Add booking') + '</button>') + '</div></div>' +
    (closed ? '<div class="nx-card-b nx-muted" style="padding-bottom:0">This class has passed, so it is closed. Attendance and notes can still be updated' + (ME.admin ? '; as an admin you can still add a booking.' : '.') + '</div>' : '') +
    (live.length ? '<div class="nx-toolbar" style="border-top:0;flex-wrap:wrap"><input class="nx-in sm" id="fbQ" placeholder="Search name, phone or email" value="' + esc(CB.q) + '" style="min-width:200px"><select class="nx-sel sm" id="fbSort" aria-label="Sort bookings">' + FB_SORTS.map(([k, l]) => o(k, CB.sort, l)).join('') + '</select><select class="nx-sel sm" id="fbType" aria-label="Booking type">' + o('', CB.type, 'All booking types') + FB_TYPES.map(([k, l]) => o(k, CB.type, l)).join('') + '</select><select class="nx-sel sm" id="fbAtt" aria-label="Attendance">' + o('', CB.att, 'Any attendance') + o('attended', CB.att, 'Attended') + o('open', CB.att, 'Not marked attended') + '</select><span class="nx-muted" id="fbCount" style="margin-left:auto"></span></div>' : '') +
    '<div id="fbRows">' + fbTable(cur, live, payBy, showSeats) + '</div>' + (live.length ? '<div class="nx-legend nx-flaglegend"><span><b>QS</b> quiz sent</span><span><b>QD</b> quiz done</span><span><b>$</b> paid</span>' + (cur.kind !== 'renewal' ? '<span><b>PP</b> placement plan yes or done</span><span><b>EP</b> education plan yes or RTO done</span>' : '<span><b>SG</b> signature done</span>') + '</div>' : '') + '</div>' +
    (offs.length ? '<div class="nx-card" id="faOff"><div class="nx-card-h"><div><h3>No show, cancelled and rescheduled <span class="nx-count">' + offs.length + '</span></h3><div class="nx-muted">Not counted in the seats. Each one has a follow-up task for the next working day.</div></div></div>' + bkFollowTable(offs, moved) + '</div>' : '');
});

/* the payment next to a booking: what is confirmed, what still waits for Accounts, and a button to enter a payment (cash for the Evershine team) */
function bookingPayCell(b, list) {
  list = list || [];
  const ok = sumPaid(list), pend = sumPending(list);
  let h = ok ? '<span class="nx-pill ok">Paid ' + money(ok) + '</span>' : (pend ? '' : '<span class="nx-muted">No payment yet</span>');
  if (pend) h += '<span class="nx-pill warn">' + money(pend) + ' pending verification</span>';
  if (b.student_id && canCash()) h += '<button class="nx-btn sm" data-pay="' + b.id + '">' + ico('plus') + 'Payment</button>';
  return '<div class="nx-stack-cell">' + h + '</div>';
}
function attCell(b) {
  if (b.status === 'attended') return '<div class="nx-stack-cell"><span class="nx-pill ok">Attended</span><span class="nx-att-by">' + esc(b.attendance_by || '') + (b.attendance_at ? ' · ' + esc(fmtDT(b.attendance_at)) : '') + '</span><button class="nx-btn sm" data-ud="' + b.id + '">Undo</button></div>';
  return '<div class="nx-att-cell">' + (b.status === 'booked' || !b.status ? '' : pill('booking', b.status)) + '<button class="nx-btn sm" data-at="' + b.id + '">Attended</button><button class="nx-btn sm" data-mk="' + b.id + '">No show / cancelled</button></div>';
}

function bindFirstAid(cur, books, ctx) {
  ctx = ctx || {};
  /* which class days are shown */
  [['cfKind', 'kind'], ['cfTrainer', 'trainer'], ['cfFrom', 'from'], ['cfTo', 'to']].forEach(([id, k]) => { const el = $('#' + id); if (el) el.onchange = () => { CF[k] = el.value; render(); }; });
  if ($('#cfClear')) $('#cfClear').onclick = () => { Object.assign(CF, { kind: '', trainer: '', from: '', to: '' }); render(); };
  if ($('#faNew')) $('#faNew').onclick = () => classForm(null);
  if ($('#faExport')) $('#faExport').onclick = () => exportDay(cur);
  if ($('#faJump')) $('#faJump').onclick = () => formModal('Go to a past class', [{ k: 'd', label: 'Class date', type: 'date', required: true }], async v => {
    const r = await sel('nex_class_sessions', 'select=id&class_date=eq.' + v.d + '&limit=1'); if (!r[0]) throw new Error('No class on that date.'); go('#/firstaid/' + r[0].id); }, 'Go');
  if (!cur) return;
  $$('#faDays .nx-day').forEach(b => b.onclick = () => go('#/firstaid/' + b.dataset.id));
  $('#faEdit').onclick = () => classForm(cur);
  if ($('#faAdd')) $('#faAdd').onclick = () => bookingForm(cur, null, books);
  const fm = $('#faMail'); if (fm) fm.onclick = () => confirmEmail(cur, books);
  const by = id => books.find(x => x.id === id);
  const bindRows = () => {
    const box = $('#fbRows'); if (!box) return;
    $$('[data-pay]', box).forEach(b => b.onclick = e => { e.stopPropagation(); const x = by(b.dataset.pay); if (x && x.student_id) paymentForm({ student: { id: x.student_id, first_name: (x.nex_students || {}).first_name || x.name, last_name: (x.nex_students || {}).last_name || '' } }); });
    $$('[data-edit]', box).forEach(b => b.onclick = e => { e.stopPropagation(); bookingForm(cur, by(b.dataset.edit), books); });
    $$('[data-conf]', box).forEach(b => b.onclick = e => { e.stopPropagation(); const x = by(b.dataset.conf); if (x) confirmEmail(cur, books, x); });
    $$('[data-at]', box).forEach(b => b.onclick = e => { e.stopPropagation(); bkAttended(by(b.dataset.at)); });
    $$('[data-mk]', box).forEach(b => b.onclick = e => { e.stopPropagation(); attendanceModal(by(b.dataset.mk)); });
    $$('[data-ud]', box).forEach(b => b.onclick = e => { e.stopPropagation(); bkUndo(by(b.dataset.ud)); });
  };
  /* the booking list: search, sort and filter in place (nothing is fetched again, so nothing jumps) */
  const live = ctx.live || [], payBy = ctx.payBy || {}, showSeats = canFlag();
  const redraw = () => {
    const box = $('#fbRows'); if (!box) return;
    box.innerHTML = fbTable(cur, live, payBy, showSeats); bindRows();
    const n = fbRows(live).length, c = $('#fbCount'); if (c) c.textContent = n === live.length ? live.length + ' bookings' : n + ' of ' + live.length + ' bookings';
  };
  [['fbQ', 'q', 'input'], ['fbSort', 'sort'], ['fbType', 'type'], ['fbAtt', 'att']].forEach(([id, k, ev]) => { const el = $('#' + id); if (el) el.addEventListener(ev || 'change', () => { CB[k] = el.value; redraw(); }); });
  redraw();
  const off = $('#faOff'); if (off) bkBindFollow(off, books.filter(x => bkOff(x.status)), render);
}

/* ---------- Export to Sheets: one class day, with the trainer's name on every row, for working out trainer pay ---------- */
function csvCell(v) {
  v = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;   /* a spreadsheet would run text that starts like a formula */
  return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
function exportDay(cur) {
  formModal('Export a class day to Sheets', [{ k: 'd', label: 'Class day', type: 'date', value: cur ? cur.class_date : sydToday(), required: true, full: true,
    help: 'Every booking on that day (including no shows and cancellations, marked as such) with the class type and the trainer. Opens in Google Sheets or Excel. Pick any past day to build the pay history.' }], async v => {
    const sess = await sel('nex_class_sessions', 'select=*&class_date=eq.' + v.d + '&order=kind.asc');
    if (!sess.length) throw fieldError('d', 'There is no class on that day.');
    const rows = await selAll('nex_class_bookings', 'select=*&session_id=in.' + inList(sess.map(s => s.id)) + '&order=created_at.asc');
    const head = ['Class date', 'Day', 'Class type', 'Trainer', 'Starts', 'Ends', 'Seats', 'Booked (not cancelled)', 'Attended', 'Name', 'Phone', 'Email', 'Booking type', 'Agent', 'Seat', 'Status', 'Attendance marked by', 'Attendance marked at', 'Paid', 'Quiz sent', 'Quiz done', 'Booked by', 'Note'];
    const yn = x => x ? 'Yes' : 'No', out = [head];
    const nm = (a, c) => (a.name || '').localeCompare(c.name || '', 'en', { sensitivity: 'base' });
    sess.forEach(s => {
      const mine = rows.filter(b => b.session_id === s.id).sort(nm), booked = mine.filter(b => !bkOff(b.status)).length, att = mine.filter(b => b.status === 'attended').length;
      const dd = fmtDay(s.class_date), kind = s.kind === 'renewal' ? 'Renewal and signature' : 'Full class';
      mine.forEach(b => out.push([s.class_date, dd.wd, kind, s.trainer || 'Not set', s.start_time || '', s.end_time || '', s.seats, booked, att, b.name, fmtPhone(b.phone) || '', b.email || '',
        b.booking_type === 'student' ? 'Student' : b.booking_type === 'walk_in' ? 'Walk-in' : 'Agent group', b.agent_id ? agentName(b.agent_id) : '', b.seat_no || '', b.status ? statusLabel('booking', b.status) : 'Booked',
        b.attendance_by || '', b.attendance_at ? fmtDT(b.attendance_at) : '', yn(b.paid), yn(b.quiz_sent), yn(b.quiz_done), b.created_by || '', b.note || '']));
      if (!mine.length) out.push([s.class_date, dd.wd, kind, s.trainer || 'Not set', s.start_time || '', s.end_time || '', s.seats, 0, 0, '(no bookings)'].concat(Array(13).fill('')));
    });
    const blob = new Blob(['﻿' + out.map(r => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'class-bookings-' + v.d + '.csv'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Exported ' + (out.length - 1) + (out.length === 2 ? ' row' : ' rows') + ' for ' + fmtDate(v.d));
  }, 'Download');
}

/* the dropdown: active trainers, plus an older typed-in name kept as it is until someone changes it */
function trainerOptions(cur) {
  const list = (REF.trainers || []).filter(t => t.active).map(t => ({ id: t.name, label: t.name }));
  if (cur && !list.find(x => x.id === cur)) list.unshift({ id: cur, label: cur + ' (old entry)' });
  return list;
}
function classForm(c) {
  c = c || {};
  const f = [{ k: 'class_date', label: 'Class date', type: 'date', value: c.class_date, required: true }, { k: 'kind', label: 'Type', type: 'select', options: [{ id: 'full', label: 'Full class (First Aid and CPR)' }, { id: 'renewal', label: 'Renewal and signature' }], value: c.kind || 'full' },
    { k: 'trainer', label: 'Trainer', type: 'select', options: trainerOptions(c.trainer), value: c.trainer || '', blank: 'Not set', help: 'Chosen from the Trainers list so the name is always spelled the same. Not there? An admin adds trainers under Admin.' }, { k: 'seats', label: 'Seats', type: 'number', value: c.seats || 50, required: true },
    { k: 'start_time', label: 'Starts', type: 'time', value: c.start_time }, { k: 'end_time', label: 'Ends', type: 'time', value: c.end_time }, { k: 'note', label: 'Note', type: 'textarea', value: c.note, full: true }];
  return formModal(c.id ? 'Edit class day' : 'New class day', f, async v => {
    if (c.id) { await upd('nex_class_sessions', 'id=eq.' + c.id, v); toast('Saved'); render(); }
    else { const s = await ins('nex_class_sessions', v); toast('Class added'); go('#/firstaid/' + s.id); }
  });
}

/* one small marker per yes/no on a booking; screen readers get the full words, sighted users get a hover title and the legend under the table */
function flagHtml(on, abbr, label, value) {
  const v = value || (on ? 'yes' : 'no');
  return '<span class="nx-flag ' + (on ? 'on' : '') + '" role="img" aria-label="' + esc(label + ': ' + v) + '" title="' + esc(label + ': ' + v) + '">' + abbr + '</span>';
}
function bookingFlags(cur, b) {
  let h = flagHtml(b.quiz_sent, 'QS', 'Quiz sent') + flagHtml(b.quiz_done, 'QD', 'Quiz done') + flagHtml(b.paid, '$', 'Paid');
  if (cur.kind !== 'renewal') {
    h += flagHtml(b.placement_plan === 'yes' || b.placement_plan === 'done', 'PP', 'Placement plan', PLAN_PL[b.placement_plan] ? PLAN_PL[b.placement_plan].toLowerCase() : 'not set');
    h += flagHtml(b.education_plan === 'yes' || b.education_plan === 'rto_done', 'EP', 'Education plan', PLAN_ED[b.education_plan] ? PLAN_ED[b.education_plan].toLowerCase() : 'not set');
  } else h += flagHtml(b.signature_done, 'SG', 'Signature done');
  return h;
}
/* "Email confirmation": one booking from its row, or everyone booked on the class day, through the shared email dialog
   (edge function nex-send-class-confirm, from the First Aid and CPR team mailbox; Evershine team and admins only). */
function confirmEmail(cur, books, only) {
  const list = books.filter(b => !bkOff(b.status) && (!only || b.id === only.id));
  mailDialog({ title: only ? 'Email confirmation: ' + only.name : 'Email class confirmations', fn: 'nex-send-class-confirm', htmlPreview: true, empty: 'No bookings on this class day.', onDone: () => render(),
    load: async () => {
      const sent = list.length ? await sel('nex_class_confirm_mail', 'select=booking_id,created_by,updated_at&booking_id=in.' + inList(list.map(b => b.id))) : [];
      const by = {}; sent.forEach(x => { by[x.booking_id] = x; });
      return list.map(b => { const x = by[b.id]; return { id: b.id, name: b.name, sub: (b.seat_no ? 'Seat ' + b.seat_no + ' · ' : '') + (b.email || 'Email from their student record'), off: !b.email && !b.student_id, offNote: 'No email address', sentNote: x ? 'Already sent' + (x.created_by ? ' by ' + x.created_by : '') + ' on ' + fmtDate(x.updated_at) : '' }; });
    } });
}
const PLAN_PL = { yes: 'Yes', done: 'Done', no: 'No' }, PLAN_ED = { yes: 'Yes', rto_done: 'RTO done', no: 'No' };
function bookingForm(cur, b, books) {
  b = b || {}; let studentId = b.student_id || null;
  const takenBy = n => books.find(x => x.seat_no === n && !bkOff(x.status) && x.id !== b.id);
  const f = [{ k: 'name', label: 'Name', value: b.name, required: true }, { k: 'phone', label: 'Phone', type: 'tel', value: b.phone }, { k: 'email', label: 'Email', type: 'email', value: b.email },
    { k: 'seat_no', label: 'Seat', type: 'number', value: b.seat_no || '', help: 'Leave empty for the waiting list' },
    { k: 'booking_type', label: 'Booking type', type: 'select', options: [{ id: 'student', label: 'Student' }, { id: 'walk_in', label: 'Walk-in' }, { id: 'agent_group', label: 'Agent group' }], value: b.booking_type || 'student' },
    { k: 'agent_id', label: 'Agent', type: 'select', options: REF.agents.filter(a => a.active), value: b.agent_id, blank: 'None' },
    { k: 'status', label: 'Status', type: 'select', options: opts('booking', true), value: b.status || (b.id ? '' : 'booked'), blank: 'Not set', help: 'A booking is confirmed with or without payment. Payment is tracked on its own.' },
    { k: 'quiz_sent', label: 'Quiz link sent', type: 'check', value: b.quiz_sent }, { k: 'quiz_done', label: 'Quiz done', type: 'check', value: b.quiz_done }, { k: 'paid', label: 'Paid', type: 'check', value: b.paid }];
  if (cur.kind !== 'renewal') f.push({ k: 'placement_plan', label: 'Placement plan', type: 'select', options: Object.keys(PLAN_PL).map(k => ({ id: k, label: PLAN_PL[k] })), value: b.placement_plan, blank: 'Not set', help: 'Yes = going ahead with placement. Done = placement sorted. No = not doing placement.' },
    { k: 'education_plan', label: 'Education plan', type: 'select', options: Object.keys(PLAN_ED).map(k => ({ id: k, label: PLAN_ED[k] })), value: b.education_plan, blank: 'Not set', help: 'Yes = needs visa counselling. RTO done = RTO profile created. No = no counselling needed.' });
  if (cur.kind === 'renewal') f.push({ k: 'signature_done', label: 'Signature done', type: 'check', value: b.signature_done });
  if (!canFlag()) for (let i = f.length - 1; i >= 0; i--) if (['quiz_sent', 'quiz_done', 'paid', 'placement_plan', 'education_plan', 'signature_done', 'seat_no'].includes(f[i].k)) f.splice(i, 1);   /* the flags and the seat numbers are Evershine's */
  f.push({ k: 'note', label: 'Note', type: 'textarea', value: b.note, full: true });
  const top = b.id ? '' : idBoxHtml('Type a phone number or email. If they are already a student or lead, their details fill in. If they are not in YatraLine yet, they are added as a new lead when you save.');
  const m = formModal(b.id ? 'Edit booking' : 'Add booking', f, async v => {
    if (v.seat_no != null) { v.seat_no = Math.round(v.seat_no); if (v.seat_no < 1 || v.seat_no > cur.seats) throw fieldError('seat_no', 'Seat must be between 1 and ' + cur.seats + '.'); const t = takenBy(v.seat_no); if (t) throw fieldError('seat_no', 'Seat ' + v.seat_no + ' is already taken by ' + t.name + '.'); }
    if (v.phone) v.phone = cleanPhone(v.phone) || v.phone; if (v.email) v.email = v.email.toLowerCase();
    const newSt = v.status; if (b.id && newSt !== (b.status || '') && (bkOff(newSt) || newSt === 'attended' || (newSt === 'booked' && (bkOff(b.status) || b.status === 'attended')))) { delete v.status; v.seat_no = bkOff(newSt) ? null : v.seat_no; } else if (bkOff(v.status)) v.seat_no = null;
    let newLead = false;
    if (!b.id && !studentId && v.booking_type !== 'agent_group') {
      /* nobody found for this person: find them by email, phone or name, or add them as a lead ("From class booking") */
      const lead = await api('rpc/nex_find_or_create_lead', { method: 'POST', body: { p_name: v.name, p_phone: v.phone || null, p_email: v.email || null, p_note: 'From class booking' } }).then(r => r.json());
      studentId = lead.id; newLead = !!lead.created;
    }
    try {
      if (b.id) { await upd('nex_class_bookings', 'id=eq.' + b.id, Object.assign(v, { student_id: studentId })); if (newSt !== (b.status || '') && newSt && (bkOff(newSt) || newSt === 'attended' || (newSt === 'booked' && (bkOff(b.status) || b.status === 'attended')))) await bkMark(b, newSt); }
      else await ins('nex_class_bookings', Object.assign({ session_id: cur.id, student_id: studentId, created_by: ME.name }, v), true);
    } catch (e) { if (/duplicate|unique/i.test(e.message)) throw fieldError('seat_no', 'That seat was just taken. Choose another.'); throw e; }
    toast(newLead ? 'Booking saved. ' + v.name + ' was added as a new lead.' : 'Booking saved'); render();
  }, 'Save booking', top);
  if (b.id) {
    const foot = $('.modal-f', m.el); const cb = document.createElement('button'); cb.className = 'nx-btn'; cb.style.marginRight = 'auto'; cb.textContent = 'Cancel booking';
    cb.onclick = async () => { try { await bkMark(b, 'cancelled'); m.close(); toast('Booking cancelled. Follow-up task added.'); render(); } catch (e) { showErr(m, e); } };
    foot.prepend(cb);
    if (canFlag() && cur.kind !== 'renewal' && !bkOff(b.status)) { const eb = document.createElement('button'); eb.className = 'nx-btn'; eb.textContent = 'Email confirmation'; eb.onclick = () => { m.close(); confirmEmail(cur, books, b); }; foot.prepend(eb); }
  } else {
    identityLookup(m, { ids: { name: 'f_name', phone: 'f_phone', email: 'f_email' }, onChange: st => { studentId = st ? st.id : null; if (st) { const bt = $('#f_booking_type', m.el); if (bt) bt.value = 'student'; } } });
  }
}
