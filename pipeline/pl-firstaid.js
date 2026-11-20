'use strict';
/* pl-firstaid.js · YatraLine · First Aid and CPR class days and the seat map.
   One of the YatraLine files loaded by nex.html (list and order: PL_FILES in the loader). All of them share one global scope. */
/* =========================================================
   First Aid and CPR
   ========================================================= */
/* Which class days the day strip shows, and how the booking list under it is sorted. They stay as set while you move around.
   The booking list is A to Z by name until someone picks another order. */
const CF = { trainer: '', from: '', to: '' };
const CB = { q: '', sort: 'name', type: '', att: '' };
const FB_SEL = new Set(); let FB_SEL_SID = '';   /* bookings ticked for the Mass flag setter; cleared when you change class day */
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
function fbRow(cur, b, i, payBy, showSeats) {
  const off = bkOff(b.status);
  return '<tr class="nx-tr' + (b.conf_sent && !off ? ' nx-conf' : '') + '" data-b="' + b.id + '">' + (showSeats ? '<td class="nx-chk"><input type="checkbox" data-sel="' + b.id + '"' + (FB_SEL.has(b.id) ? ' checked' : '') + ' aria-label="Select ' + esc(b.name) + '"></td>' : '') + '<td class="nx-num">' + (i + 1) + '</td><td class="nx-namecell"><div class="nx-nameline"><b>' + (b.nex_students ? '<a href="#/students/' + b.nex_students.id + '">' + esc(b.name) + '</a>' : esc(b.name)) + '</b>' + (b.booking_type === 'student' ? '<span class="nx-tag"' + (b.created_by ? ' title="Booked by ' + esc(b.created_by) + '"' : '') + '>Student</span>' : '<span class="nx-tag walk" title="' + esc([b.agent_id ? agentName(b.agent_id) : '', b.created_by ? 'Booked by ' + b.created_by : ''].filter(Boolean).join(' · ')) + '">' + (b.booking_type === 'walk_in' ? 'Walk-in' : 'Agent group') + '</span>') + '</div><span class="nx-sub" title="' + esc([fmtPhone(b.phone), b.email].filter(Boolean).join(' · ')) + '">' + esc([fmtPhone(b.phone), b.email].filter(Boolean).join(' · ') || 'No contact details') + '</span></td>' +
      '<td>' + bookingPayCell(b, payBy[b.student_id]) + '</td><td>' + attCell(b) + '</td>' +
      '<td class="nx-flagcell"><div class="nx-flags">' + bookingFlags(cur, b, showSeats && !off) + '</div></td>' +
      (showSeats ? '<td class="nx-seatcell">' + (b.seat_no ? '<b>Seat ' + b.seat_no + '</b>' : (off ? '' : '<button class="nx-btn sm" data-seat="' + b.id + '" title="Give the next free seat">Allocate</button>')) + '</td>' : '') +
      '<td class="nx-actcell"><div class="nx-btnrow">' + (canFlag() && cur.kind !== 'renewal' && !off ? '<button class="nx-btn sm icon" data-conf="' + b.id + '" title="Email confirmation" aria-label="Email confirmation to ' + esc(b.name) + '">' + ico('mail') + '</button>' : '') + '<button class="nx-btn sm" data-edit="' + b.id + '">Edit</button></div></td></tr>';
}
function fbTable(cur, live, payBy, showSeats) {
  const list = fbRows(live);
  if (!list.length) return empty(live.length ? 'Nobody matches' : 'No bookings yet', live.length ? 'Try clearing a filter.' : 'Press Add booking to add the first one.');
  return '<div class="nx-tablewrap"><table class="nx-table tight"><thead><tr>' + (showSeats ? '<th class="nx-chk"><input type="checkbox" id="fbSelAll" aria-label="Select everyone shown"></th>' : '') + '<th class="nx-num" scope="col">#</th><th>Name</th><th>Payment</th><th>Attendance</th><th>Flags</th>' + (showSeats ? '<th>Seat</th>' : '') + '<th><span class="nx-sr">Actions</span></th></tr></thead><tbody>' +
    list.map((b, i) => fbRow(cur, b, i, payBy, showSeats)).join('') + '</tbody></table></div>';
}

route(/^\/firstaid(?:\/([0-9a-f-]{36}))?$/, async m => {
  const today = sydToday();
  const back = CF.from || today;   /* a class closes once its date has passed: the day strip starts today unless you ask for earlier dates; older days are also reached with Past classes */
  const [sess0, trs] = await Promise.all([
    sel('nex_class_sessions', 'select=*&kind=neq.renewal&class_date=gte.' + back + (CF.to ? '&class_date=lte.' + CF.to : '') + (CF.trainer ? '&trainer=eq.' + encodeURIComponent(CF.trainer) : '') + '&order=class_date.asc,kind.asc&limit=' + (CF.from || CF.to ? 200 : 60)),
    sel('nex_trainers', 'select=*&order=name').catch(() => REF.trainers || []),
  ]);
  let sessions = sess0; REF.trainers = trs;
  const trainerNames = Array.from(new Set(trs.filter(t => t.active).map(t => t.name))).sort((a, c) => a.localeCompare(c, 'en', { sensitivity: 'base' }));
  let want = m[1];
  if (want && !sessions.find(s => s.id === want)) { const one = await sel('nex_class_sessions', 'select=*&id=eq.' + want); if (one[0]) sessions = [one[0]].concat(sessions).sort((a, b) => a.class_date.localeCompare(b.class_date)); }
  const cur = sessions.find(s => s.id === want) || sessions.find(s => s.class_date >= today) || sessions[sessions.length - 1] || null;
  const cnt = {};
  if (sessions.length) { const rows = await selAll('nex_class_bookings', 'select=session_id,status&session_id=in.' + inList(sessions.map(s => s.id))); rows.forEach(b => { if (!bkOff(b.status)) cnt[b.session_id] = (cnt[b.session_id] || 0) + 1; }); }
  let books = [];
  if (cur) books = await sel('nex_class_bookings', 'select=*,nex_students(id,first_name,last_name)&session_id=eq.' + cur.id + '&order=created_at.asc');
  const o = (v, cur, l) => '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>' + esc(l) + '</option>';
  const filtered = !!(CF.trainer || CF.from || CF.to);
  const bar = '<div class="nx-card"><div class="nx-toolbar" style="border-top:0;flex-wrap:wrap"><select class="nx-sel sm" id="cfTrainer" aria-label="Trainer">' + o('', CF.trainer, 'All trainers') + trainerNames.map(n => o(n, CF.trainer, n)).join('') + '</select>' +
    '<label class="nx-muted" style="display:flex;align-items:center;gap:4px">From <input class="nx-in sm" type="date" id="cfFrom" value="' + esc(CF.from) + '"> to <input class="nx-in sm" type="date" id="cfTo" value="' + esc(CF.to) + '"></label>' +
    (filtered ? '<button class="nx-btn sm" id="cfClear">Clear</button>' : '') + '<span class="nx-muted" style="margin-left:auto" title="Pick a From date to look back at earlier class days">' + (CF.from || CF.to ? 'Class days in this date range' : 'Today and later') + '</span></div></div>';
  afterRender(() => bindFirstAid(cur, books, { payBy, live }));
  const head = pageHead('aid', 'First Aid and CPR', 'Class', (canFlag() ? '<button class="nx-btn" id="faExport">' + ico('download') + 'Export to Sheets</button>' : '') + '<button class="nx-btn" id="faJump">Past classes</button><button class="nx-btn primary" id="faNew">' + ico('plus') + 'New class day</button>');
  if (!cur) return head + bar + '<div class="nx-card">' + (filtered ? empty('No class days match', 'Try clearing a filter or widening the dates.') : empty('No classes scheduled', 'Add the next class day to start taking bookings.')) + '</div>';
  var live = books.filter(b => !bkOff(b.status));
  /* the booking and the payment are separate things: a booking is confirmed whether or not anything is paid, and each payment has its own status */
  /* a booking whose confirmation email has been sent shows green (table nex_class_confirm_mail, status sent) */
  { const cm = live.length ? await sel('nex_class_confirm_mail', 'select=booking_id&status=eq.sent&booking_id=in.' + inList(live.map(b => b.id))).catch(() => []) : [], cs = new Set(cm.map(x => x.booking_id)); books.forEach(b => { b.conf_sent = cs.has(b.id); }); }
  var payBy = {}; const sids = live.map(b => b.student_id).filter(Boolean);
  if (sids.length) (await sel('nex_payments', 'select=student_id,amount,method,verify_status,handover_status&student_id=in.' + inList(sids)).catch(() => [])).forEach(p => (payBy[p.student_id] = payBy[p.student_id] || []).push(p));
  const offs = books.filter(b => bkOff(b.status));
  const d = fmtDay(cur.class_date);
  const closed = cur.class_date < today;   /* the database refuses new bookings into a class that has passed (admins can still add) */
  const seated = live.filter(b => b.seat_no);
  const showSeats = canFlag();   /* the seat numbers are where people sit on the day: only the Evershine team (and admins) see them */
  const walk = live.filter(b => b.booking_type !== 'student').length;
  return head + bar + '<div class="nx-card"><div class="nx-card-b" style="padding:10px 16px"><div class="nx-days" id="faDays">' + sessions.map(s => { const dd = fmtDay(s.class_date); const n = cnt[s.id] || 0; return '<button class="nx-day" data-id="' + s.id + '" aria-pressed="' + (s.id === cur.id) + '"><b>' + dd.wd + ' ' + dd.dm + '</b><span>' + (s.kind === 'renewal' ? 'Renewal' : 'Full class') + ' · ' + n + ' / ' + s.seats + '</span></button>'; }).join('') + '</div></div></div>' +
    '<div class="nx-card"><div class="nx-card-b" style="padding:10px 16px;display:flex;flex-direction:column;gap:8px">' +
    '<div style="display:flex;align-items:center;gap:6px 16px;flex-wrap:wrap"><div style="min-width:0"><div class="nx-eyebrow">' + (cur.kind === 'renewal' ? 'Renewal and signature day' : 'Full class day') + '</div><h3 style="font-size:16px">' + d.wd + ' ' + d.dm + (cur.trainer ? ' · ' + esc(cur.trainer) : '') + '</h3></div>' +
    '<span class="nx-muted" style="margin-left:auto"><b style="font-size:18px;color:var(--nx-ink)">' + live.length + '</b> of ' + cur.seats + ' seats · ' + (showSeats ? (cur.seats - seated.length) + ' free' : Math.max(0, cur.seats - live.length) + ' left') + (walk ? ' · ' + walk + ' walk-in or agent' : '') + (cur.start_time ? ' · ' + esc(cur.start_time) + (cur.end_time ? '–' + esc(cur.end_time) : '') : '') + '</span>' +
    '<button class="nx-btn sm" id="faEdit">' + ico('edit') + 'Edit class</button></div>' +
    (showSeats ? '<div class="nx-cap"><i class="a" style="width:' + Math.min(100, seated.length / cur.seats * 100) + '%"></i></div>' : '') +
    (live.length > cur.seats ? '<div class="nx-warnbox">This class has more bookings than seats. Move some people to another day.</div>' : '') +
    '</div></div>' +
    '<div class="nx-card" id="faBook"><div class="nx-card-h"><h3>Bookings</h3><div class="nx-btnrow">' + (canFlag() && cur.kind !== 'renewal' && live.length ? '<button class="nx-btn sm" id="faMail">' + ico('mail') + 'Email confirmations</button>' : '') + (canFlag() && live.length ? '<button class="nx-btn sm" id="faMass" disabled>Mass flag setter</button>' : '') + (closed && !ME.admin ? '<span class="nx-pill">Closed</span>' : '<button class="nx-btn primary sm" id="faAdd">' + ico('plus') + (closed ? 'Add booking (admin)' : 'Add booking') + '</button>') + '</div></div>' +
    (closed ? '<div class="nx-card-b nx-muted" style="padding-bottom:0">This class has passed, so it is closed. Attendance and notes can still be updated' + (ME.admin ? '; as an admin you can still add a booking.' : '.') + '</div>' : '') +
    (live.length ? '<div class="nx-toolbar" style="border-top:0;flex-wrap:wrap"><input class="nx-in sm" id="fbQ" placeholder="Search name, phone or email" value="' + esc(CB.q) + '" style="min-width:200px"><select class="nx-sel sm" id="fbSort" aria-label="Sort bookings">' + FB_SORTS.map(([k, l]) => o(k, CB.sort, l)).join('') + '</select><select class="nx-sel sm" id="fbType" aria-label="Booking type">' + o('', CB.type, 'All booking types') + FB_TYPES.map(([k, l]) => o(k, CB.type, l)).join('') + '</select><select class="nx-sel sm" id="fbAtt" aria-label="Attendance">' + o('', CB.att, 'Any attendance') + o('attended', CB.att, 'Attended') + o('open', CB.att, 'Not marked attended') + '</select><span class="nx-muted" id="fbCount" style="margin-left:auto"></span></div>' : '') +
    '<div id="fbRows">' + fbTable(cur, live, payBy, showSeats) + '</div>' + (live.length ? '<div class="nx-legend nx-flaglegend"><span><b>QS</b> quiz sent</span>' + (cur.kind !== 'renewal' ? '<span><b>PP</b> placement plan yes or done</span>' : '<span><b>SG</b> signature done</span>') + (canFlag() ? '<span class="nx-muted">Press a flag to change it.</span>' : '') + '<span class="nx-confkey"><i></i>Confirmation email sent</span>' + '</div>' : '') + '</div>' +
    (offs.length ? '<div class="nx-card"><div class="nx-card-b" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><span class="nx-muted"><b>' + offs.length + '</b> no show, cancelled or rescheduled on this day. They are not counted in the seats and now live in Leads, under Need to follow up.</span><a class="nx-btn sm" href="#/leads?view=follow">Open Need to follow up</a></div></div>' : '');
});

/* the payment next to a booking: what is confirmed, what still waits for Accounts, and a button to enter a payment (cash for the Evershine team) */
function bookingPayCell(b, list) {
  list = list || [];
  const ok = sumPaid(list), pend = sumPending(list);
  let h = ok ? '<span class="nx-pill ok">Paid ' + money(ok) + '</span>' : (pend ? '' : '<span class="nx-muted">No payment yet</span>');
  if (pend) h += '<span class="nx-pill warn" title="Waiting for verification">' + money(pend) + ' pending</span>';
  return '<div class="nx-paycell"><div class="nx-paytop">' + h + (b.student_id && canCash() ? '<button class="nx-btn sm icon" data-pay="' + b.id + '" title="Add a payment" aria-label="Add a payment for ' + esc(b.name) + '">' + ico('plus') + '</button>' : '') + '</div></div>';
}
function attCell(b) {
  if (b.status === 'attended') return '<div class="nx-stack-cell"><div class="nx-att-top"><span class="nx-pill ok">Attended</span><button class="nx-btn sm" data-ud="' + b.id + '">Undo</button></div><span class="nx-att-by">' + esc(b.attendance_by || '') + (b.attendance_at ? ' · ' + esc(fmtDT(b.attendance_at)) : '') + '</span></div>';
  return '<div class="nx-att-cell">' + (b.status === 'booked' || !b.status ? '' : pill('booking', b.status)) + '<select class="nx-sel sm" data-att="' + b.id + '" aria-label="Mark attendance for ' + esc(b.name) + '"><option value="">Mark attendance</option><option value="attended">Attended</option><option value="no_show">No show</option><option value="cancelled">Cancelled</option><option value="rescheduled">Rescheduled</option></select></div>';
}

function bindFirstAid(cur, books, ctx) {
  ctx = ctx || {};
  /* which class days are shown */
  [['cfTrainer', 'trainer'], ['cfFrom', 'from'], ['cfTo', 'to']].forEach(([id, k]) => { const el = $('#' + id); if (el) el.onchange = () => { CF[k] = el.value; render(); }; });
  if ($('#cfClear')) $('#cfClear').onclick = () => { Object.assign(CF, { trainer: '', from: '', to: '' }); render(); };
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
  if (FB_SEL_SID !== cur.id) { FB_SEL.clear(); FB_SEL_SID = cur.id; }
  (ctx.live || []).length || FB_SEL.clear();
  [...FB_SEL].forEach(id => { if (!(ctx.live || []).some(x => x.id === id)) FB_SEL.delete(id); });   /* someone marked no show is no longer on the list */
  /* One row changes at a time (Attended, Undo, a flag, a seat, a payment): redraw just that row, in place, so the page does not reload and nothing moves. */
  const patchRow = async (id, noFetch) => {
    const x = by(id), box = $('#fbRows'); if (!x || !box) return render();
    if (!noFetch) { try { const r = await sel('nex_class_bookings', 'select=*,nex_students(id,first_name,last_name)&id=eq.' + id); if (!r[0]) return render(); Object.assign(x, r[0]); } catch (e) { return render(); } }
    const i = fbRows(ctx.live || []).findIndex(y => y.id === id), tr = $('tr[data-b="' + id + '"]', box);
    if (i < 0 || !tr) return redraw();
    const tb = document.createElement('tbody'); tb.innerHTML = fbRow(cur, x, i, ctx.payBy || {}, canFlag());
    tr.replaceWith(tb.firstElementChild); bindRows();
  };
  /* after a payment is saved: reload that student's payments only, then redraw their row */
  const payDone = async x => {
    try { const r = await sel('nex_payments', 'select=student_id,amount,method,verify_status,handover_status&student_id=eq.' + x.student_id); if (ctx.payBy) ctx.payBy[x.student_id] = r; } catch (e) { return render(); }
    patchRow(x.id, true);
  };
  /* flags: press QS or PP in the list. It always asks first, so a stray click changes nothing. */
  const setFlags = async (list, patch) => {
    await upd('nex_class_bookings', 'id=in.' + inList(list.map(x => x.id)), patch);
    list.forEach(x => Object.assign(x, patch));
    if (list.length === 1) patchRow(list[0].id, true); else redraw();
  };
  const planModal = x => {
    const cur_ = x.placement_plan || '';
    const radio = (v, l, h) => '<label><input type="radio" name="ppv" value="' + v + '"' + (v === cur_ ? ' checked' : '') + '><span><b>' + l + '</b><small>' + h + '</small></span></label>';
    openModal({ title: 'Placement plan: ' + esc(x.name), noFocus: true,
      body: '<div class="nx-radios" role="radiogroup" aria-label="Placement plan">' + radio('yes', 'Yes', 'Going ahead with placement.') + radio('done', 'Done', 'Placement sorted.') + radio('no', 'No', 'Not doing placement.') + radio('', 'Not set', 'Clear the flag.') + '</div>',
      buttons: [{ label: 'Cancel', close: true }, { label: 'Save', primary: true, run: async mm => {
        const v = ($('input[name=ppv]:checked', mm.el) || {}).value || '';
        if (v === cur_) return;
        await setFlags([x], { placement_plan: v || null }); toast('Placement plan saved');
      } }] });
  };
  const flagClick = async (x, key) => {
    if (key === 'quiz_sent') {
      const on = !x.quiz_sent;
      if (!(await confirmBox('Quiz sent', (on ? 'Mark the quiz as sent for ' : 'Clear "quiz sent" for ') + (x.name || 'this booking') + '?', on ? 'Yes, mark it sent' : 'Yes, clear it'))) return;
      try { await setFlags([x], { quiz_sent: on }); toast(on ? 'Marked quiz sent' : 'Quiz sent cleared'); } catch (e) { toast(e.message, true); }
    } else if (key === 'placement_plan') planModal(x);
  };
  /* Allocate seat: the lowest free seat on this class day */
  const allocSeat = async x => {
    for (let t = 0; t < 4; t++) {
      let taken;
      try { taken = new Set((await sel('nex_class_bookings', 'select=seat_no&session_id=eq.' + cur.id + '&seat_no=not.is.null&limit=1000')).map(r => r.seat_no)); } catch (e) { return toast(e.message, true); }
      let n = 1; while (taken.has(n) && n <= cur.seats) n++;
      if (n > cur.seats) return toast('No seats left on this class day', true);
      try { await upd('nex_class_bookings', 'id=eq.' + x.id, { seat_no: n }); x.seat_no = n; toast('Seat ' + n + ' allocated to ' + (x.name || 'booking')); return patchRow(x.id, true); }
      catch (e) { if (!/duplicate|unique/i.test(e.message)) return toast(e.message, true); }   /* somebody took that seat a moment ago: try the next one */
    }
    toast('Could not allocate a seat. Try again.', true);
  };
  /* Mass flag setter: tick bookings, then set a flag on all of them at once */
  const massBtn = () => { const bt = $('#faMass'); if (!bt) return; const n = FB_SEL.size; bt.disabled = !n; bt.textContent = n ? 'Mass flag setter (' + n + ')' : 'Mass flag setter'; };
  const massModal = () => {
    const picked = (ctx.live || []).filter(x => FB_SEL.has(x.id)); if (!picked.length) return;
    const sl = (id, label, opts) => '<div style="margin-bottom:12px"><label class="nx-lbl" for="' + id + '">' + label + '</label><select class="nx-sel" id="' + id + '">' + opts.map(([v, l]) => '<option value="' + v + '">' + l + '</option>').join('') + '</select></div>';
    openModal({ title: 'Mass flag setter', noFocus: true,
      body: '<p style="margin:0 0 12px">These flags will change on <b>' + picked.length + ' booking' + (picked.length === 1 ? '' : 's') + '</b>. Anything left on "No change" stays as it is.</p>' +
        sl('mfQs', 'Quiz sent (QS)', [['', 'No change'], ['on', 'Mark as sent'], ['off', 'Clear']]) +
        (cur.kind !== 'renewal' ? sl('mfPp', 'Placement plan (PP)', [['', 'No change'], ['yes', 'Yes'], ['done', 'Done'], ['no', 'No'], ['clear', 'Not set']]) : ''),
      buttons: [{ label: 'Cancel', close: true }, { label: 'Apply to ' + picked.length, primary: true, run: async mm => {
        const patch = {}, q = ($('#mfQs', mm.el) || {}).value, pp = ($('#mfPp', mm.el) || {}).value;
        if (q) patch.quiz_sent = q === 'on'; if (pp) patch.placement_plan = pp === 'clear' ? null : pp;
        if (!Object.keys(patch).length) throw new Error('Choose a flag to change, or press Cancel.');
        await setFlags(picked, patch); toast('Flags updated on ' + picked.length + ' booking' + (picked.length === 1 ? '' : 's'));
      } }] });
  };
  const bindRows = () => {
    const box = $('#fbRows'); if (!box) return;
    $$('[data-pay]', box).forEach(b => b.onclick = e => { e.stopPropagation(); const x = by(b.dataset.pay); if (x && x.student_id) paymentForm({ student: { id: x.student_id, first_name: (x.nex_students || {}).first_name || x.name, last_name: (x.nex_students || {}).last_name || '' }, after: () => payDone(x) }); });
    $$('[data-edit]', box).forEach(b => b.onclick = e => { e.stopPropagation(); bookingForm(cur, by(b.dataset.edit), books); });
    $$('[data-conf]', box).forEach(b => b.onclick = e => { e.stopPropagation(); const x = by(b.dataset.conf); if (x) confirmEmail(cur, books, x); });
    $$('[data-att]', box).forEach(sl => { sl.onclick = e => e.stopPropagation(); sl.onchange = e => { e.stopPropagation(); const x = by(sl.dataset.att), v = sl.value; sl.value = ''; if (!x || !v) return; if (v === 'attended') bkAttended(x, () => patchRow(x.id)); else attendanceModal(x, v); }; });
    $$('[data-ud]', box).forEach(b => b.onclick = e => { e.stopPropagation(); bkUndo(by(b.dataset.ud), () => patchRow(b.dataset.ud)); });
    $$('[data-flag]', box).forEach(b => b.onclick = e => { e.stopPropagation(); const x = by(b.dataset.fb); if (x) flagClick(x, b.dataset.flag); });
    $$('[data-seat]', box).forEach(b => b.onclick = e => { e.stopPropagation(); const x = by(b.dataset.seat); if (x) { b.disabled = true; allocSeat(x).then(() => { if (b.isConnected) b.disabled = false; }); } });
    $$('[data-sel]', box).forEach(c => c.onchange = () => { if (c.checked) FB_SEL.add(c.dataset.sel); else FB_SEL.delete(c.dataset.sel); selAllState(); massBtn(); });
    const all = $('#fbSelAll'); if (all) all.onchange = () => { const shown = fbRows(ctx.live || []).map(x => x.id); shown.forEach(id => all.checked ? FB_SEL.add(id) : FB_SEL.delete(id)); $$('[data-sel]', box).forEach(c => c.checked = FB_SEL.has(c.dataset.sel)); massBtn(); };
    selAllState(); massBtn();
  };
  const selAllState = () => { const all = $('#fbSelAll'); if (!all) return; const shown = fbRows(ctx.live || []); all.checked = !!shown.length && shown.every(x => FB_SEL.has(x.id)); all.indeterminate = !all.checked && shown.some(x => FB_SEL.has(x.id)); };
  if ($('#faMass')) $('#faMass').onclick = massModal;
  /* the booking list: search, sort and filter in place (nothing is fetched again, so nothing jumps) */
  const live = ctx.live || [], payBy = ctx.payBy || {}, showSeats = canFlag();
  const redraw = () => {
    const box = $('#fbRows'); if (!box) return;
    box.innerHTML = fbTable(cur, live, payBy, showSeats); bindRows();
    const n = fbRows(live).length, c = $('#fbCount'); if (c) c.textContent = n === live.length ? live.length + ' bookings' : n + ' of ' + live.length + ' bookings';
  };
  [['fbQ', 'q', 'input'], ['fbSort', 'sort'], ['fbType', 'type'], ['fbAtt', 'att']].forEach(([id, k, ev]) => { const el = $('#' + id); if (el) el.addEventListener(ev || 'change', () => { CB[k] = el.value; redraw(); }); });
  redraw();
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
    const head = ['Class date', 'Day', 'Class type', 'Trainer', 'Starts', 'Ends', 'Seats', 'Booked (not cancelled)', 'Attended', 'Name', 'Phone', 'Email', 'Booking type', 'Agent', 'Seat', 'Status', 'Attendance marked by', 'Attendance marked at', 'Quiz sent', 'Booked by', 'Note'];
    const yn = x => x ? 'Yes' : 'No', out = [head];
    const nm = (a, c) => (a.name || '').localeCompare(c.name || '', 'en', { sensitivity: 'base' });
    sess.forEach(s => {
      const mine = rows.filter(b => b.session_id === s.id).sort(nm), booked = mine.filter(b => !bkOff(b.status)).length, att = mine.filter(b => b.status === 'attended').length;
      const dd = fmtDay(s.class_date), kind = s.kind === 'renewal' ? 'Renewal and signature' : 'Full class';
      mine.forEach(b => out.push([s.class_date, dd.wd, kind, s.trainer || 'Not set', s.start_time || '', s.end_time || '', s.seats, booked, att, b.name, fmtPhone(b.phone) || '', b.email || '',
        b.booking_type === 'student' ? 'Student' : b.booking_type === 'walk_in' ? 'Walk-in' : 'Agent group', b.agent_id ? agentName(b.agent_id) : '', b.seat_no || '', b.status ? statusLabel('booking', b.status) : 'Booked',
        b.attendance_by || '', b.attendance_at ? fmtDT(b.attendance_at) : '', yn(b.quiz_sent), b.created_by || '', b.note || '']));
      if (!mine.length) out.push([s.class_date, dd.wd, kind, s.trainer || 'Not set', s.start_time || '', s.end_time || '', s.seats, 0, 0, '(no bookings)'].concat(Array(11).fill('')));
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
  const f = [{ k: 'class_date', label: 'Class date', type: 'date', value: c.class_date, required: true }, { k: 'trainer', label: 'Trainer', type: 'select', options: trainerOptions(c.trainer), value: c.trainer || '', blank: 'Not set', help: 'Chosen from the Trainers list so the name is always spelled the same. Not there? An admin adds trainers under Admin.' }, { k: 'seats', label: 'Seats', type: 'number', value: c.seats || 50, required: true },
    { k: 'start_time', label: 'Starts', type: 'time', value: c.start_time }, { k: 'end_time', label: 'Ends', type: 'time', value: c.end_time }, { k: 'note', label: 'Note', type: 'textarea', value: c.note, full: true }];
  return formModal(c.id ? 'Edit class day' : 'New class day', f, async v => {
    if (c.id) { await upd('nex_class_sessions', 'id=eq.' + c.id, v); toast('Saved'); render(); }
    else { const s = await ins('nex_class_sessions', v); toast('Class added'); go('#/firstaid/' + s.id); }
  });
}

/* one small marker per yes/no on a booking; screen readers get the full words, sighted users get a hover title and the legend under the table */
function flagHtml(on, abbr, label, value, key, bid) {
  const v = value || (on ? 'yes' : 'no');
  if (key) return '<button type="button" class="nx-flag nx-flagbtn ' + (on ? 'on' : '') + '" data-flag="' + key + '" data-fb="' + bid + '" aria-label="' + esc(label + ': ' + v + '. Press to change') + '" title="' + esc(label + ': ' + v + '. Press to change') + '">' + abbr + '</button>';
  return '<span class="nx-flag ' + (on ? 'on' : '') + '" role="img" aria-label="' + esc(label + ': ' + v) + '" title="' + esc(label + ': ' + v) + '">' + abbr + '</span>';
}
/* the flags are Quiz sent (QS) and Placement plan (PP). Evershine and admins can press one right in the list (it asks first). */
function bookingFlags(cur, b, click) {
  let h = flagHtml(b.quiz_sent, 'QS', 'Quiz sent', null, click ? 'quiz_sent' : '', b.id);
  if (cur.kind !== 'renewal') h += flagHtml(b.placement_plan === 'yes' || b.placement_plan === 'done', 'PP', 'Placement plan', PLAN_PL[b.placement_plan] ? PLAN_PL[b.placement_plan].toLowerCase() : 'not set', click ? 'placement_plan' : '', b.id);
  else h += flagHtml(b.signature_done, 'SG', 'Signature done');
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
const PLAN_PL = { yes: 'Yes', done: 'Done', no: 'No' };
function bookingForm(cur, b, books) {
  b = b || {}; let studentId = b.student_id || null;
  const takenBy = n => books.find(x => x.seat_no === n && !bkOff(x.status) && x.id !== b.id);
  const f = [{ k: 'name', label: 'Name', value: b.name, required: true }, { k: 'phone', label: 'Phone', type: 'tel', value: b.phone }, { k: 'email', label: 'Email', type: 'email', value: b.email },
    { k: 'seat_no', label: 'Seat', type: 'number', value: b.seat_no || '', help: 'Leave empty for the waiting list' },
    { k: 'booking_type', label: 'Booking type', type: 'select', options: [{ id: 'student', label: 'Student' }, { id: 'walk_in', label: 'Walk-in' }, { id: 'agent_group', label: 'Agent group' }], value: b.booking_type || 'student' },
    { k: 'agent_id', label: 'Agent', type: 'select', options: REF.agents.filter(a => a.active), value: b.agent_id, blank: 'None' },
    { k: 'status', label: 'Status', type: 'select', options: opts('booking', true), value: b.status || (b.id ? '' : 'booked'), blank: 'Not set', help: 'A booking is confirmed with or without payment. Payment is tracked on its own.' },
    { k: 'quiz_sent', label: 'Quiz link sent', type: 'check', value: b.quiz_sent }];
  if (cur.kind !== 'renewal') f.push({ k: 'placement_plan', label: 'Placement plan', type: 'select', options: Object.keys(PLAN_PL).map(k => ({ id: k, label: PLAN_PL[k] })), value: b.placement_plan, blank: 'Not set', help: 'Yes = going ahead with placement. Done = placement sorted. No = not doing placement.' });
  if (cur.kind === 'renewal') f.push({ k: 'signature_done', label: 'Signature done', type: 'check', value: b.signature_done });
  if (!canFlag()) for (let i = f.length - 1; i >= 0; i--) if (['quiz_sent', 'placement_plan', 'signature_done', 'seat_no'].includes(f[i].k)) f.splice(i, 1);   /* the flags and the seat numbers are Evershine's */
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
