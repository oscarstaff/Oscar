'use strict';
/* pl-firstaid.js · YatraLine · First Aid and CPR class days and the seat map.
   One of the YatraLine files loaded by nex.html (list and order: PL_FILES in the loader). All of them share one global scope. */
/* =========================================================
   First Aid and CPR
   ========================================================= */
route(/^\/firstaid(?:\/([0-9a-f-]{36}))?$/, async m => {
  const today = sydToday();
  const back = new Date(Date.now() - 21 * 864e5).toLocaleDateString('en-CA', { timeZone: TZ });
  let sessions = await sel('nex_class_sessions', 'select=*&class_date=gte.' + back + '&order=class_date.asc,kind.asc&limit=60');
  let want = m[1];
  if (want && !sessions.find(s => s.id === want)) { const one = await sel('nex_class_sessions', 'select=*&id=eq.' + want); if (one[0]) sessions = [one[0]].concat(sessions).sort((a, b) => a.class_date.localeCompare(b.class_date)); }
  const cur = sessions.find(s => s.id === want) || sessions.find(s => s.class_date >= today) || sessions[sessions.length - 1] || null;
  const cnt = {};
  if (sessions.length) { const rows = await selAll('nex_class_bookings', 'select=session_id,status&session_id=in.' + inList(sessions.map(s => s.id))); rows.forEach(b => { if (!bkOff(b.status)) cnt[b.session_id] = (cnt[b.session_id] || 0) + 1; }); }
  let books = [];
  if (cur) books = await sel('nex_class_bookings', 'select=*,nex_students(id,first_name,last_name)&session_id=eq.' + cur.id + '&order=seat_no.asc.nullslast,created_at.asc');
  afterRender(() => bindFirstAid(cur, books));
  const head = pageHead('aid', 'Evershine', 'First Aid and CPR', '<button class="nx-btn" id="faJump">Past classes</button><button class="nx-btn primary" id="faNew">' + ico('plus') + 'New class day</button>');
  if (!cur) return head + '<div class="nx-card">' + empty('No classes scheduled', 'Add the next class day to start taking bookings.') + '</div>';
  const live = books.filter(b => !bkOff(b.status));
  /* the booking and the payment are separate things: a booking is confirmed whether or not anything is paid, and each payment has its own status */
  const payBy = {}; const sids = live.map(b => b.student_id).filter(Boolean);
  if (sids.length) (await sel('nex_payments', 'select=student_id,amount,method,verify_status,handover_status&student_id=in.' + inList(sids)).catch(() => [])).forEach(p => (payBy[p.student_id] = payBy[p.student_id] || []).push(p));
  const offs = books.filter(b => bkOff(b.status));
  const moved = offs.length ? await bkMovedMap(offs).catch(() => ({})) : {};
  const d = fmtDay(cur.class_date);
  const seated = live.filter(b => b.seat_no);
  const showSeats = canFlag();   /* the seat numbers are where people sit on the day: only the Evershine team (and admins) see them */
  const walk = live.filter(b => b.booking_type !== 'student').length;
  return head + '<div class="nx-card"><div class="nx-card-b"><div class="nx-days" id="faDays">' + sessions.map(s => { const dd = fmtDay(s.class_date); const n = cnt[s.id] || 0; return '<button class="nx-day" data-id="' + s.id + '" aria-pressed="' + (s.id === cur.id) + '"><b>' + dd.wd + ' ' + dd.dm + '</b><span>' + (s.kind === 'renewal' ? 'Renewal' : 'Full class') + ' · ' + n + ' / ' + s.seats + '</span></button>'; }).join('') + '</div></div></div>' +
    '<div class="nx-card"><div class="nx-card-h"><div><div class="nx-eyebrow">' + (cur.kind === 'renewal' ? 'Renewal and signature day' : 'Full class day') + '</div><h3 style="font-size:18px">' + d.wd + ' ' + d.dm + (cur.trainer ? ' · ' + esc(cur.trainer) : '') + '</h3></div><div class="nx-btnrow"><button class="nx-btn sm" id="faEdit">' + ico('edit') + 'Edit class</button></div></div><div class="nx-card-b" style="display:flex;flex-direction:column;gap:12px">' +
    '<div style="display:flex;justify-content:space-between;align-items:baseline"><span class="nx-big">' + live.length + ' <span class="nx-muted" style="font-size:16px">of ' + cur.seats + ' seats</span></span><span class="nx-muted">' + (showSeats ? (cur.seats - seated.length) + ' seats free' : Math.max(0, cur.seats - live.length) + ' places left') + (walk ? ' · ' + walk + ' walk-in or agent' : '') + (cur.start_time ? ' · ' + esc(cur.start_time) + (cur.end_time ? '–' + esc(cur.end_time) : '') : '') + '</span></div>' +
    (showSeats ? '<div class="nx-cap"><i class="a" style="width:' + Math.min(100, seated.length / cur.seats * 100) + '%"></i></div>' : '') +
    (live.length > cur.seats ? '<div class="nx-warnbox">This class has more bookings than seats. Move some people to another day.</div>' : '') +
    (showSeats ? '<div class="nx-seats" id="faSeats" role="list" aria-label="Seat map. Display only.">' + Array.from({ length: cur.seats }, (_, i) => { const n = i + 1; const b = live.find(x => x.seat_no === n); return '<div role="listitem" class="nx-seat ' + (b ? (b.booking_type !== 'student' ? 'walk' : 'booked') : '') + '" title="' + esc(b ? 'Seat ' + n + ': ' + b.name : 'Seat ' + n + ': free') + '"><span>' + (b ? esc((b.name || '').split(' ')[0].slice(0, 7)) : n) + '</span></div>'; }).join('') + '</div>' +
    '<div class="nx-legend"><span><i></i>Free</span><span><i class="booked"></i>Student</span><span><i class="walk"></i>Walk-in or agent group</span></div>' : '') + '</div></div>' +
    '<div class="nx-card" id="faBook"><div class="nx-card-h"><h3>Bookings</h3><div class="nx-btnrow">' + (canFlag() && cur.kind !== 'renewal' && live.length ? '<button class="nx-btn sm" id="faMail">' + ico('mail') + 'Email confirmations</button>' : '') + '<button class="nx-btn primary sm" id="faAdd">' + ico('plus') + 'Add booking</button></div></div>' +
    (live.length ? '<div class="nx-tablewrap"><table class="nx-table tight"><thead><tr>' + (showSeats ? '<th>Seat</th>' : '') + '<th>Name</th><th>Phone</th><th>Type</th><th>Booked by</th><th>Payment</th><th>Attendance</th><th>Flags</th><th></th></tr></thead><tbody>' +
      live.map(b => '<tr class="nx-tr" data-b="' + b.id + '">' + (showSeats ? '<td class="nx-num">' + (b.seat_no || '<span class="nx-muted">–</span>') + '</td>' : '') + '<td><b>' + (b.nex_students ? '<a href="#/students/' + b.nex_students.id + '">' + esc(b.name) + '</a>' : esc(b.name)) + '</b><div class="nx-muted" style="font-size:12px">' + esc(b.email || '') + '</div></td><td class="nx-num">' + esc(fmtPhone(b.phone)) + '</td><td>' + (b.booking_type === 'student' ? '<span class="nx-tag">Student</span>' : '<span class="nx-tag walk">' + (b.booking_type === 'walk_in' ? 'Walk-in' : 'Agent group') + '</span>') + (b.agent_id ? ' <span class="nx-muted">' + esc(agentName(b.agent_id)) + '</span>' : '') + '</td><td>' + esc(b.created_by || '') + '</td><td>' + bookingPayCell(b, payBy[b.student_id]) + '</td><td>' + attCell(b) + '</td>' +
        '<td><div class="nx-flags">' + bookingFlags(cur, b) + '</div></td><td><div class="nx-btnrow">' + (canFlag() && cur.kind !== 'renewal' && !bkOff(b.status) ? '<button class="nx-btn sm" data-conf="' + b.id + '">Email confirmation</button>' : '') + '<button class="nx-btn sm" data-edit="' + b.id + '">Edit</button></div></td></tr>').join('') + '</tbody></table></div>' : empty('No bookings yet', 'Press Add booking to add the first one.')) + (live.length ? '<div class="nx-legend nx-flaglegend"><span><b>QS</b> quiz sent</span><span><b>QD</b> quiz done</span><span><b>$</b> paid</span>' + (cur.kind !== 'renewal' ? '<span><b>PP</b> placement plan yes or done</span><span><b>EP</b> education plan yes or RTO done</span>' : '<span><b>SG</b> signature done</span>') + '</div>' : '') + '</div>' +
    (offs.length ? '<div class="nx-card" id="faOff"><div class="nx-card-h"><div><h3>No show, cancelled and rescheduled <span class="nx-count">' + offs.length + '</span></h3><div class="nx-muted">Not counted in the seats. Each one has a follow-up task for the next working day.</div></div></div>' + bkFollowTable(offs, moved) + '</div>' : '');
});

/* the payment next to a booking: what is confirmed, what still waits for Accounts, and a button to enter a payment (cash for the Evershine team) */
function bookingPayCell(b, list) {
  list = list || [];
  const ok = sumPaid(list), pend = sumPending(list);
  let h = ok ? '<span class="nx-pill ok">Paid ' + money(ok) + '</span>' : (pend ? '' : '<span class="nx-muted">No payment yet</span>');
  if (pend) h += (h ? ' ' : '') + '<span class="nx-pill warn">' + money(pend) + ' pending verification</span>';
  if (b.student_id && canCash()) h += ' <button class="nx-btn sm quiet" data-pay="' + b.id + '">+ Payment</button>';
  return '<div class="nx-att-cell">' + h + '</div>';
}
function attCell(b) {
  if (b.status === 'attended') return '<div class="nx-att-cell"><span class="nx-pill ok">Attended</span><span class="nx-att-by">' + esc(b.attendance_by || '') + (b.attendance_at ? ' · ' + esc(fmtDT(b.attendance_at)) : '') + '</span><button class="nx-btn sm quiet" data-ud="' + b.id + '">Undo</button></div>';
  return '<div class="nx-att-cell">' + (b.status === 'booked' || !b.status ? '' : pill('booking', b.status)) + '<button class="nx-btn sm" data-at="' + b.id + '">Attended</button><button class="nx-btn sm quiet" data-mk="' + b.id + '">No show or cancelled</button></div>';
}

function bindFirstAid(cur, books) {
  const view = $('#view');
  if ($('#faNew')) $('#faNew').onclick = () => classForm(null);
  if ($('#faJump')) $('#faJump').onclick = () => formModal('Go to a past class', [{ k: 'd', label: 'Class date', type: 'date', required: true }], async v => {
    const r = await sel('nex_class_sessions', 'select=id&class_date=eq.' + v.d + '&limit=1'); if (!r[0]) throw new Error('No class on that date.'); go('#/firstaid/' + r[0].id); }, 'Go');
  if (!cur) return;
  $$('#faDays .nx-day').forEach(b => b.onclick = () => go('#/firstaid/' + b.dataset.id));
  $('#faEdit').onclick = () => classForm(cur);
  $('#faAdd').onclick = () => bookingForm(cur, null, books);
  $$('[data-pay]').forEach(b => b.onclick = e => { e.stopPropagation(); const x = books.find(y => y.id === b.dataset.pay); if (x && x.student_id) paymentForm({ student: { id: x.student_id, first_name: (x.nex_students || {}).first_name || x.name, last_name: (x.nex_students || {}).last_name || '' } }); });
  $$('[data-edit]').forEach(b => b.onclick = e => { e.stopPropagation(); bookingForm(cur, books.find(x => x.id === b.dataset.edit), books); });
  $$('[data-conf]').forEach(b => b.onclick = e => { e.stopPropagation(); const x = books.find(y => y.id === b.dataset.conf); if (x) confirmEmail(cur, books, x); });
  const fm = $('#faMail'); if (fm) fm.onclick = () => confirmEmail(cur, books);
  const by = id => books.find(x => x.id === id);
  $$('[data-at]').forEach(b => b.onclick = e => { e.stopPropagation(); bkAttended(by(b.dataset.at)); });
  $$('[data-mk]').forEach(b => b.onclick = e => { e.stopPropagation(); attendanceModal(by(b.dataset.mk)); });
  $$('#faBook [data-ud]').forEach(b => b.onclick = e => { e.stopPropagation(); bkUndo(by(b.dataset.ud)); });
  const off = $('#faOff'); if (off) bkBindFollow(off, books.filter(x => bkOff(x.status)), render);
}

function classForm(c) {
  c = c || {};
  const f = [{ k: 'class_date', label: 'Class date', type: 'date', value: c.class_date, required: true }, { k: 'kind', label: 'Type', type: 'select', options: [{ id: 'full', label: 'Full class (First Aid and CPR)' }, { id: 'renewal', label: 'Renewal and signature' }], value: c.kind || 'full' },
    { k: 'trainer', label: 'Trainer', value: c.trainer }, { k: 'seats', label: 'Seats', type: 'number', value: c.seats || 50, required: true },
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
