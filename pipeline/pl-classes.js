'use strict';
/* pl-classes.js · YatraLine · Class attendance, booking a lead into a class, no-show follow-ups.
   One of the YatraLine files loaded by nex.html (list and order: PL_FILES in the loader). All of them share one global scope. */
/* =========================================================
   Class attendance, booking a lead into a class, and the no show follow-up list
   ========================================================= */
const BK_OFF = ['no_show', 'cancelled', 'rescheduled'];
const bkOff = s => BK_OFF.indexOf(s) >= 0;
const BK_WORD = { no_show: 'No show', cancelled: 'Cancelled', rescheduled: 'Rescheduled', attended: 'Attended', booked: 'Booked' };

/* upcoming class days to move or book into. A renewal booking only moves to renewal days; everything else goes to full class days. */
async function bkKindOf(b) {
  if (b.nex_class_sessions && b.nex_class_sessions.kind) return b.nex_class_sessions.kind;
  try { const r = await sel('nex_class_sessions', 'select=kind&id=eq.' + b.session_id); return (r[0] && r[0].kind) || 'full'; } catch (e) { return 'full'; }
}
async function bkUpcoming(excludeSession, kind) {
  const today = sydToday();
  const ss = await sel('nex_class_sessions', 'select=id,class_date,kind,seats&kind=' + (kind === 'renewal' ? 'eq.renewal' : 'neq.renewal') + '&class_date=gte.' + today + '&order=class_date.asc,kind.asc&limit=40');
  if (!ss.length) return [];
  const rows = await selAll('nex_class_bookings', 'select=session_id,status&session_id=in.' + inList(ss.map(s => s.id)));
  const n = {}; rows.forEach(b => { if (!bkOff(b.status)) n[b.session_id] = (n[b.session_id] || 0) + 1; });
  return ss.filter(s => s.id !== excludeSession).map(s => Object.assign({ taken: n[s.id] || 0 }, s));
}
function bkDayLabel(s) { const d = fmtDay(s.class_date); return d.wd + ' ' + d.dm + ' · ' + (s.kind === 'renewal' ? 'Renewal' : 'Full class') + ' · ' + Math.max(0, s.seats - s.taken) + ' seats left'; }
function bkMark(b, status, newSession, note) {
  return api('rpc/nex_mark_attendance', { method: 'POST', body: { p_booking: b.id, p_status: status, p_new_session: newSession || null, p_note: note || null } });
}

/* No show, cancelled or rescheduled. Rescheduled can pick the new class day straight away. */
async function attendanceModal(b, preset, after) {
  const kind = await bkKindOf(b);
  let days = []; try { days = await bkUpcoming(b.session_id, kind); } catch (e) { days = []; }
  const radio = (v, l, hint) => '<label><input type="radio" name="bkSt" value="' + v + '"' + (v === (preset || 'no_show') ? ' checked' : '') + '><span><b>' + l + '</b><small>' + hint + '</small></span></label>';
  const body = '<div class="nx-radios" role="radiogroup" aria-label="Attendance">' +
    radio('no_show', 'No show', 'Did not come. Goes on the follow-up list.') +
    radio('cancelled', 'Cancelled', 'Told us they cannot come. Goes on the follow-up list.') +
    radio('rescheduled', 'Rescheduled', 'Moving to another class day.') + '</div>' +
    '<div id="bkNewWrap"><label class="nx-lbl" for="bkNew">New class day</label><select class="nx-sel" id="bkNew">' + selectOpts(days.map(s => ({ id: s.id, label: bkDayLabel(s) })), '', 'Not decided yet (follow up)') + '</select></div>' +
    '<div style="margin-top:12px"><label class="nx-lbl" for="bkNote">Note</label><input class="nx-in" id="bkNote" autocomplete="off" placeholder="Optional"></div>' +
    '<div class="nx-help" style="margin-top:10px">A follow-up task is created for the next working day. Your name is kept as the person who marked it.</div>';
  const m = openModal({ title: 'Mark ' + esc(b.name || 'booking'), body, buttons: [{ label: 'Cancel', close: true }, { label: 'Save', primary: true, run: async mm => {
    const st = ($('input[name=bkSt]:checked', mm.el) || {}).value || 'no_show';
    const ns = st === 'rescheduled' ? $('#bkNew', mm.el).value : '';
    await bkMark(b, st, ns, $('#bkNote', mm.el).value.trim());
    toast(st === 'rescheduled' && ns ? 'Moved to the new class day' : BK_WORD[st] + ' saved'); if (after) after(); else render();
  } }] });
  const sync = () => { const st = ($('input[name=bkSt]:checked', m.el) || {}).value; $('#bkNewWrap', m.el).hidden = st !== 'rescheduled'; };
  $$('input[name=bkSt]', m.el).forEach(r => r.onchange = sync); sync();
  return m;
}
async function bkAttended(b, after) {
  try { await bkMark(b, 'attended'); toast('Marked attended'); if (after) after(); else render(); } catch (e) { toast(e.message, true); }
}
/* who made the booking, and when. A booking made by the system (an import or an automatic job) says so. */
function bkBookedBy(b) { return 'Booked by ' + (b.created_by || 'System (automatic)') + (b.created_at ? ' · ' + fmtDate(b.created_at) : ''); }
/* an attendance mark can be changed or undone by whoever made it, or by an admin; not by another person or team */
const bkCanChange = b => !!(ME.admin || !b || !b.attendance_by || b.attendance_by === ME.name);
const bkUndoBtn = (b, cls) => '<button class="nx-btn sm ' + (cls || '') + '" data-ud="' + b.id + '"' + (bkCanChange(b) ? '' : ' disabled title="Marked by ' + esc(b.attendance_by) + '. Only they or an admin can undo it."') + '>Undo</button>';
async function bkUndo(b, after) {
  if (!bkCanChange(b)) return toast('Marked by ' + b.attendance_by + '. Only they or an admin can undo it.', true);
  try { await bkMark(b, 'booked'); toast('Back to booked'); if (after) after(); else render(); } catch (e) { toast(e.message, true); }
}
async function bkHandled(b, after) {
  try { await upd('nex_class_bookings', 'id=eq.' + b.id, { followup_done_at: new Date().toISOString(), followup_done_by: ME.name }); toast('Marked handled'); if (after) after(); else render(); } catch (e) { toast(e.message, true); }
}

/* Put a person into a class day. Leads become students on their own once they pay $200 or more. */
async function bookClassModal(p, enrolmentId, after) {
  let days = []; try { days = await bkUpcoming(null); } catch (e) { days = []; }
  if (!days.length) return openModal({ title: 'Book class', body: '<p>No upcoming class days yet. Add a class day on the First Aid and CPR page first.</p>', buttons: [{ label: 'Close', close: true }, { label: 'Go to First Aid and CPR', primary: true, run: async () => { go('#/firstaid'); } }] });
  const body = '<div class="nx-help" style="margin-bottom:10px">' + esc(fullName(p)) + (p.phone ? ' · ' + esc(fmtPhone(p.phone)) : '') + '</div>' +
    '<label class="nx-lbl" for="bkDay">Class day</label><select class="nx-sel" id="bkDay">' + selectOpts(days.map(s => ({ id: s.id, label: bkDayLabel(s) })), days.find(s => s.seats > s.taken) ? days.find(s => s.seats > s.taken).id : days[0].id) + '</select>' +
    '<div style="margin-top:12px"><label class="nx-lbl" for="bkNote">Note</label><input class="nx-in" id="bkNote" autocomplete="off" placeholder="Optional"></div>' +
    '<div class="nx-help" style="margin-top:10px">After the class, mark them Attended, No show, Cancelled or Rescheduled. Paying $200 or more makes them a student automatically.</div>';
  return openModal({ title: 'Book class', body, buttons: [{ label: 'Cancel', close: true }, { label: 'Book', primary: true, run: async mm => {
    const sid = $('#bkDay', mm.el).value; if (!sid) throw fieldError('#bkDay', 'Choose a class day.');
    const dup = await sel('nex_class_bookings', 'select=id,status&session_id=eq.' + sid + '&student_id=eq.' + p.id + '&limit=5');
    if (dup.some(x => !bkOff(x.status))) throw fieldError('#bkDay', fullName(p) + ' is already booked on that day.');
    const day = days.find(s => s.id === sid); if (day && day.taken >= day.seats && !(await confirmBox('Class is full', 'All ' + day.seats + ' seats are taken. Book them on the waiting list anyway?', 'Book anyway'))) return false;
    const row = { session_id: sid, student_id: p.id, name: fullName(p), phone: p.phone || null, email: p.email || null, booking_type: 'student', status: 'booked', note: $('#bkNote', mm.el).value.trim() || null, created_by: ME.name };
    if (enrolmentId) row.enrolment_id = enrolmentId;
    await ins('nex_class_bookings', row, true);
    toast('Booked into class'); if (after) after(); else render();
  } }] });
}
/* off-status booking: book a fresh class day, the old one is closed off as handled */
async function rebookModal(b, after) {
  const kind = await bkKindOf(b);
  let days = []; try { days = await bkUpcoming(null, kind); } catch (e) { days = []; }
  if (!days.length) { toast('No upcoming ' + (kind === 'renewal' ? 'renewal' : 'full class') + ' days. Add one on the First Aid and CPR page.', true); return; }
  return openModal({ title: 'Rebook ' + esc(b.name || ''), body: '<label class="nx-lbl" for="bkDay">New ' + (kind === 'renewal' ? 'renewal day' : 'class day') + '</label><select class="nx-sel" id="bkDay">' + selectOpts(days.map(s => ({ id: s.id, label: bkDayLabel(s) })), days[0].id) + '</select><div class="nx-help">' + (kind === 'renewal' ? 'This was a renewal booking, so it is rebooked onto a renewal day.' : 'Rebooked onto a full class day.') + (Array.isArray(b.sections) && b.sections.length ? ' They keep their sections (' + esc(bkSecText(b)) + ' only).' : '') + '</div>', buttons: [{ label: 'Cancel', close: true }, { label: 'Rebook', primary: true, run: async mm => {
    const sid = $('#bkDay', mm.el).value; if (!sid) throw fieldError('#bkDay', 'Choose a class day.');
    await bkMark(b, 'rescheduled', sid, null);
    toast('Rebooked'); if (after) after(); else render();
  } }] });
}

/* the sections a part-day booking attends, e.g. "FA + CPR" */
const bkSecText = b => FA_SECTIONS.filter(x => (b.sections || []).includes(x[0])).map(x => x[2]).join(' + ');

/* the follow-up rows: a booking card line used on the First Aid section and the Leads tab */
function bkFollowRow(b, opt) {
  opt = opt || {}; const ss_ = b.nex_class_sessions || {}; const st = b.nex_students || {};
  const moved = b.rescheduled_to ? (opt.movedTo && opt.movedTo[b.rescheduled_to]) : null;
  const handled = !!b.followup_done_at;
  return '<tr class="nx-tr" data-bk="' + b.id + '"><td><b>' + (b.student_id ? '<a href="#/students/' + b.student_id + '">' + esc(b.name) + '</a>' : esc(b.name)) + '</b><div class="nx-muted" style="font-size:12px">' + esc(fmtPhone(b.phone) || b.email || '') + '</div><div class="nx-muted" style="font-size:12px">' + esc(bkBookedBy(b)) + '</div></td>' +
    '<td>' + pill('booking', b.status) + '</td><td>' + (ss_.class_date ? esc(fmtDate(ss_.class_date)) : '') + '<div class="nx-muted" style="font-size:12px">' + (ss_.kind === 'renewal' ? '<span class="nx-tag walk" title="A renewal booking. It is rebooked onto a renewal day.">Renewal only</span>' : 'Full class') + (Array.isArray(b.sections) && b.sections.length ? ' <span class="nx-tag part" title="Was attending only these sections. Kept when rebooked.">' + esc(bkSecText(b)) + ' only</span>' : '') + '</div></td>' +
    '<td><span class="nx-att-by">' + esc(b.attendance_by || '') + (b.attendance_at ? ' · ' + esc(fmtDT(b.attendance_at)) : '') + '</span></td>' +
    '<td>' + (moved ? '<span class="nx-pill ok">Moved to ' + esc(fmtDate(moved)) + '</span>' : handled ? '<span class="nx-pill ok">Handled' + (b.followup_done_by ? ' · ' + esc(b.followup_done_by) : '') + '</span>' : '<span class="nx-pill warn">To follow up</span>') + '</td>' +
    '<td><div class="nx-btnrow">' + (handled || moved ? '' : '<button class="nx-btn sm primary" data-rb="' + b.id + '">Rebook</button><button class="nx-btn sm" data-hd="' + b.id + '">Mark handled</button>') + '' + bkUndoBtn(b, 'quiet') + '</div></td></tr>';
}
async function bkMovedMap(rows) {
  const ids = rows.map(b => b.rescheduled_to).filter(Boolean); const out = {};
  if (!ids.length) return out;
  const r = await sel('nex_class_bookings', 'select=id,nex_class_sessions(class_date)&id=in.' + inList(ids));
  r.forEach(x => { out[x.id] = (x.nex_class_sessions || {}).class_date; });
  return out;
}
function bkFollowTable(rows, moved) {
  return '<div class="nx-tablewrap"><table class="nx-table tight"><thead><tr><th>Name</th><th>Status</th><th>Class day</th><th>Marked by</th><th>Follow-up</th><th></th></tr></thead><tbody>' + rows.map(b => bkFollowRow(b, { movedTo: moved })).join('') + '</tbody></table></div>';
}
function bkBindFollow(root, rows, after) {
  const by = id => rows.find(x => x.id === id);
  $$('[data-rb]', root).forEach(b => b.onclick = e => { e.stopPropagation(); rebookModal(by(b.dataset.rb), after); });
  $$('[data-hd]', root).forEach(b => b.onclick = e => { e.stopPropagation(); bkHandled(by(b.dataset.hd), after); });
  $$('[data-ud]', root).forEach(b => b.onclick = e => { e.stopPropagation(); bkUndo(by(b.dataset.ud), after); });
}

/* Leads, "Need to follow up" tab: everyone who was a no show, cancelled or rescheduled without a new class day (leads, students, walk-ins) */
const BK_FU_Q = '&status=in.(no_show,cancelled,rescheduled)&followup_done_at=is.null&rescheduled_to=is.null';
const bkFuLive = r => !r.nex_students || !r.nex_students.deleted_at;   /* people moved to the archive drop off the list; walk-ins have no student record and stay */
async function leadsFollowupLoad(body, foot, after) {
  const rows = (await selAll('nex_class_bookings', 'select=*,nex_class_sessions(class_date,kind),nex_students(id,deleted_at)' + BK_FU_Q + '&order=attendance_at.desc.nullslast')).filter(bkFuLive);
  if (!rows.length) { body.innerHTML = empty('Nobody to follow up', 'No shows, cancellations and reschedules without a new class day show up here.'); foot.innerHTML = '<span></span>'; return 0; }
  body.innerHTML = bkFollowTable(rows, {}); foot.innerHTML = '<span>' + rows.length + ' to follow up</span>';
  bkBindFollow(body, rows, after); $$('.nx-tr', body).forEach(tr => tr.onclick = e => { const b = rows.find(x => x.id === tr.dataset.bk); if (b && b.student_id) go('#/students/' + b.student_id); });
  return rows.length;
}
async function leadsFollowupCount() {
  try { const r = await sel('nex_class_bookings', 'select=id,nex_students(deleted_at)' + BK_FU_Q + '&limit=1000'); return r.filter(bkFuLive).length; } catch (e) { return null; }
}
