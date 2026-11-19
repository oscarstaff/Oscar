'use strict';
/* pl-readyq.js · YatraLine · Placement "Ready" list, "On hold" list, and each student's placement profile.
   One of the YatraLine files loaded by nex.html (list and order: PL_FILES in the loader). All of them share one global scope.

   The profile (table nex_placement_profile, one row per student) holds what the Placement team needs to know before sending someone out:
   preferred shift, irregular availability, English check, state / area they want, readiness, a hold, and a start date or aged care they asked for.
   The Ready list reads the view nex_placement_queue (everyone who has paid $200+, has no live placement, with their documents and profile),
   so a student appears there by themselves the moment their last placement document is ticked. */

const PP_STATES = ['NSW', 'NSW REGIONAL', 'ACT', 'VIC', 'QLD', 'WA', 'SA', 'NT', 'TAS'];
const PP_READY = [['desperate_ll', 'Desperate - LL'], ['desperate', 'Desperate'], ['can_go', 'Can go'], ['cant_go', "Can't go"]];
const PP_WAYS = [['call', 'By call'], ['email', 'By email'], ['both', 'By call and email'], ['other', 'Another way']];
const PP_ENDED = 'blended,certificate_issued,not_interested,issue';      /* enrolment stages that are over: never in the Ready list */
const PP_NEAR = 3;                                                       /* a batch counts as "their date" when it starts within this many days of the date they asked for */

function ppReadyLabel(k) { const x = PP_READY.find(r => r[0] === k); return x ? x[1] : ''; }
function ppWays(k) { const x = PP_WAYS.find(r => r[0] === k); return x ? x[1] : ''; }
function ppShiftText(r) {
  const s = (r.pref_shifts || []).map(k => (BT_SHIFTS.find(x => x[0] === k) || [0, k])[1]);
  const t = s.join(' + ') || '';
  return (t || r.availability !== 'irregular' ? (t || 'Not noted') : '') + (r.availability === 'irregular' ? (t ? ' + ' : '') + 'Irregular' : '');
}
function ppPills(r) {
  return (r.hold ? '<span class="nx-pill warn">On hold</span> ' : '') +
    (r.english_check === 'flagged' ? '<span class="nx-pill bad" title="' + esc(r.english_note || '') + '">English to be assessed</span> ' : '') +
    (r.availability === 'irregular' ? '<span class="nx-pill warn" title="' + esc(r.availability_note || '') + '">Irregular availability</span> ' : '') +
    (r.want_start || r.want_facility_id || r.want_facility_text ? '<span class="nx-pill info" title="Asked for a start date or aged care">Has a request</span> ' : '');
}
async function ppLoad(studentId) { const r = await sel('nex_placement_profile', 'select=*&student_id=eq.' + studentId); return r[0] || null; }
async function ppSave(studentId, patch) {
  const r = await api('nex_placement_profile?on_conflict=student_id', { method: 'POST', body: Object.assign({ student_id: studentId }, patch), headers: { Prefer: 'resolution=merge-duplicates,return=representation' } });
  const j = await r.json(); return Array.isArray(j) ? j[0] : j;
}

/* ---------- the check before someone is sent to placement ----------
   Shows what the team has noted about this student (on hold, English to be assessed, irregular availability, asked for another date or aged care).
   Resolves true to carry on. A student on hold can only be placed by an admin. `where` = { facility_id, start } of the place they are going into. */
function ppGate(r, name, where) {
  r = r || {}; where = where || {};
  const items = [];
  if (r.hold) items.push('<b>On hold.</b> ' + esc([r.hold_reason, r.hold_contact ? 'told ' + ppWays(r.hold_contact).toLowerCase() : '', r.hold_until ? 'back around ' + fmtDate(r.hold_until) : ''].filter(Boolean).join(' · ')) + (r.hold_note ? '<br>' + esc(r.hold_note) : ''));
  if (r.english_check === 'flagged') items.push('<b>English needs to be assessed.</b>' + (r.english_note ? ' ' + esc(r.english_note) : ''));
  if (r.availability === 'irregular') items.push('<b>Irregular availability.</b>' + (r.availability_note ? ' ' + esc(r.availability_note) : ' Check the shift with them first.'));
  if (r.want_start && where.start && Math.abs((new Date(r.want_start) - new Date(where.start)) / 864e5) > PP_NEAR) items.push('<b>Asked to start on ' + esc(fmtDate(r.want_start)) + '</b>, not this date.');
  if (r.want_facility_id && where.facility_id && r.want_facility_id !== where.facility_id) items.push('<b>Asked for a different aged care</b>' + (r.want_facility_text ? ': ' + esc(r.want_facility_text) : '') + '.');
  if (!items.length) return Promise.resolve(true);
  const blocked = r.hold && !ME.admin;
  return new Promise(res => {
    let done = false;
    openModal({ title: (blocked ? 'Cannot place ' : 'Before you place ') + (name || 'this student'), noFocus: true, onClose() { if (!done) res(false); },
      body: '<ul class="nx-list">' + items.map(x => '<li><div>' + x + '</div></li>').join('') + '</ul>' + (blocked ? '<div class="nx-help" style="margin-top:8px">Take them off hold first (Placement, On hold), or ask an admin.</div>' : ''),
      buttons: blocked ? [{ label: 'OK', close: true }] : [{ label: 'Cancel', close: true }, { label: 'Place anyway', primary: true, run: () => { done = true; res(true); } }] });
  });
}

/* ---------- hold ---------- */
function ppHoldForm(stu, pp, done) {
  pp = pp || {};
  const f = [{ k: 'hold_reason', label: 'Why is the placement on hold?', value: pp.hold_reason, required: true, full: true },
    { k: 'hold_contact', label: 'How did they tell us / how were they told?', type: 'select', options: PP_WAYS.map(([id, label]) => ({ id, label })), value: pp.hold_contact, required: true },
    { k: 'hold_until', label: 'Expected back around (optional)', type: 'date', value: pp.hold_until },
    { k: 'hold_note', label: 'Note', type: 'textarea', value: pp.hold_note, full: true }];
  return formModal(pp.hold ? 'Update hold' : 'Put placement on hold: ' + fullName(stu), f, async v => {
    const row = await ppSave(stu.id, Object.assign({ hold: true }, v)); toast('Saved'); await done(row);
  });
}
async function ppUnhold(stu, done) {
  if (!await confirmBox('Take off hold', fullName(stu) + ' goes back to the Ready list.', 'Take off hold')) return;
  try { const row = await ppSave(stu.id, { hold: false }); toast(fullName(stu) + ' is off hold'); await done(row); } catch (e) { toast(e.message, true); }
}

/* ---------- the Placement tab on a student ---------- */
function ppBadge(c) {
  const pp = c.pp || {}; let miss = 0, any = false;
  c.enr.forEach(e => { const st = placementDocState(c, e); if (st.rows.length) { any = true; miss += st.miss; } });
  return pp.hold ? ' · on hold' : (pp.english_check === 'flagged' ? ' · English check' : (any ? (miss ? ' · ' + miss + ' docs missing' : ' · docs complete') : ''));
}
function tabPlacement(c) {
  const pp = c.pp || {}, s = c.s;
  const chk = (k, l) => '<label class="nx-check"><input type="checkbox" data-pps="' + k + '"' + ((pp.pref_shifts || []).includes(k) ? ' checked' : '') + '> ' + l + '</label>';
  const facOpts = (c.facs || []).map(x => ({ id: x.id, label: x.label }));
  const form = [
    '<div class="full"><span class="nx-lbl">Preferred shift</span><div class="nx-btnrow">' + BT_SHIFTS.map(([k, l]) => chk(k, l)).join('') + '</div><div class="nx-help">Leave all empty if they have no preference.</div></div>',
    fieldHtml({ k: 'availability', label: 'Availability', type: 'select', options: [{ id: 'regular', label: 'Regular' }, { id: 'irregular', label: 'Irregular (flagged when booking)' }], value: pp.availability || 'regular' }, 'pp'),
    fieldHtml({ k: 'availability_note', label: 'What is irregular?', value: pp.availability_note, placeholder: 'e.g. only Tue to Thu, works weekends' }, 'pp'),
    fieldHtml({ k: 'english_check', label: 'English', type: 'select', options: [{ id: 'flagged', label: 'Needs to be assessed (flagged when placing)' }, { id: 'assessed', label: 'Assessed, no concern' }], value: pp.english_check, blank: 'Nothing noted' }, 'pp'),
    fieldHtml({ k: 'english_note', label: 'English note', value: pp.english_note, placeholder: 'What did you notice?' }, 'pp'),
    fieldHtml({ k: 'state', label: 'State', type: 'select', options: PP_STATES.map(x => ({ id: x, label: x })), value: pp.state, blank: 'Not set' }, 'pp'),
    fieldHtml({ k: 'interest_area', label: 'Interested area', value: pp.interest_area, placeholder: 'e.g. Strathfield' }, 'pp'),
    fieldHtml({ k: 'readiness', label: 'Readiness', type: 'select', options: PP_READY.map(([id, label]) => ({ id, label })), value: pp.readiness, blank: 'Not set' }, 'pp'),
    '<div></div>',
    fieldHtml({ k: 'want_start', label: 'Wants to start on', type: 'date', value: pp.want_start }, 'pp'),
    fieldHtml({ k: 'want_facility_id', label: 'Wants this aged care', type: 'select', options: facOpts, value: pp.want_facility_id, blank: 'No particular one' }, 'pp'),
    fieldHtml({ k: 'want_facility_text', label: 'Or type its name', value: pp.want_facility_text }, 'pp'),
    fieldHtml({ k: 'want_note', label: 'About their request', value: pp.want_note, placeholder: 'e.g. promised by an agent' }, 'pp'),
    fieldHtml({ k: 'placement_note', label: 'Placement note', type: 'textarea', value: pp.placement_note, full: true }, 'pp')].join('');
  const hold = pp.hold
    ? '<div class="nx-warnbox"><b>On hold</b> since ' + esc(fmtDate(pp.hold_on)) + (pp.hold_by ? ' (' + esc(pp.hold_by) + ')' : '') + '. ' + esc(pp.hold_reason || '') + (pp.hold_contact ? ' · ' + esc(ppWays(pp.hold_contact)) : '') + (pp.hold_until ? ' · back around ' + esc(fmtDate(pp.hold_until)) : '') + (pp.hold_note ? '<br>' + esc(pp.hold_note) : '') +
      '<div class="nx-btnrow" style="margin-top:8px"><button class="nx-btn sm" id="ppHoldEdit">Update hold</button><button class="nx-btn sm primary" id="ppUnhold">Take off hold</button></div></div>'
    : '<div style="padding:0 16px 16px"><button class="nx-btn" id="ppHold">' + ico('lock') + 'Put placement on hold</button><div class="nx-help">Use this when the student asks to wait and has been told by call or email. They move to Placement, On hold.</div></div>';
  const docs = c.enr.length ? c.enr.map(e => placementDocsSection(c, e, (qualName(e.qualification_id) || 'Enrolment') + (e.year ? ' · ' + e.year : ''))).join('') : section('Placement documents', '<div style="padding:16px" class="nx-muted">Add an enrolment to track the documents needed before placement.</div>');
  const reqs = (c.reqs || []).map(r => '<li><div><b>' + esc((r.nex_facilities || {}).name || r.facility_text || 'Request') + '</b> ' + pill('placement', r.status) + '<small>Request' + (r.emailed_on ? ' · emailed ' + esc(fmtDate(r.emailed_on)) : '') + '</small></div></li>');
  const plcs = (c.plcs || []).map(p => '<li><div><b>' + esc((p.nex_facilities || {}).name || p.facility_text || 'Placement') + '</b> ' + pill('placement_stage', p.status) + '<small>' + esc([p.start_date ? 'starts ' + fmtDate(p.start_date) : '', BT_SHIFT_L[p.shift] || ''].filter(Boolean).join(' · ')) + '</small></div></li>');
  return (hold.indexOf('nx-warnbox') > -1 ? hold : '') +
    section('Placement preferences and flags', '<div class="nx-form" id="ppForm" style="padding:16px">' + form + '</div><div style="padding:0 16px 16px"><button class="nx-btn primary" id="ppSave">Save</button> <span class="nx-muted" id="ppMsg"></span></div>') +
    (pp.hold ? '' : section('Hold', hold)) + docs +
    (reqs.length || plcs.length ? section('Placement requests and placements', '<ul class="nx-list">' + plcs.concat(reqs).join('') + '</ul>') : '');
}
function ppBindTab(c, root, redraw) {
  const stu = c.s, again = async row => { c.pp = row || (await ppLoad(stu.id)); redraw(); };
  const q = id => $(id, root);
  if (q('#ppHold')) q('#ppHold').onclick = () => ppHoldForm(stu, c.pp, again);
  if (q('#ppHoldEdit')) q('#ppHoldEdit').onclick = () => ppHoldForm(stu, c.pp, again);
  if (q('#ppUnhold')) q('#ppUnhold').onclick = () => ppUnhold(stu, again);
  const av = q('#pp_availability'), an = q('#pp_availability_note');
  const sync = () => { if (an) an.closest('div').hidden = av.value !== 'irregular'; };
  if (av) { av.onchange = sync; sync(); }
  const en = q('#pp_english_check'), enn = q('#pp_english_note');
  const sync2 = () => { if (enn) enn.closest('div').hidden = !en.value; };
  if (en) { en.onchange = sync2; sync2(); }
  if (q('#ppSave')) q('#ppSave').onclick = async () => {
    const btn = q('#ppSave'); btn.disabled = true;
    try {
      const get = k => { const el = q('#pp_' + k); const v = el ? el.value.trim() : ''; return v === '' ? null : v; };
      const patch = { pref_shifts: $$('[data-pps]', root).filter(x => x.checked).map(x => x.dataset.pps), availability: get('availability') || 'regular', availability_note: get('availability_note'),
        english_check: get('english_check'), english_note: get('english_note'), state: get('state'), interest_area: get('interest_area'), readiness: get('readiness'),
        want_start: get('want_start'), want_facility_id: get('want_facility_id'), want_facility_text: get('want_facility_text'), want_note: get('want_note'), placement_note: get('placement_note') };
      if (patch.want_facility_id) patch.want_facility_text = null;
      c.pp = await ppSave(stu.id, patch); toast('Saved'); redraw();
    } catch (e) { toast(e.message, true); btn.disabled = false; }
  };
}

/* ---------- Placement > Ready ---------- */
const RD = { q: '', status: 'complete', from: '', to: '', st: '', area: '', shift: '', ready: '', wait: '', flag: '' };
function rdWaitOf(r, today) {
  if (r.placement_docs_missing > 0 || !r.docs_complete_on) return { k: 'none', due: null };
  const due = btAddDays(r.docs_complete_on, BT_WAIT_DAYS);
  return { k: due <= today ? 'over' : 'under', due };
}
function rdPay(r) {
  const paid = Number(r.paid_total || 0), fee = Number(r.fee || 0);
  if (!r.paid_ok) return '<span class="nx-pill bad">' + esc(money(paid)) + ' · needs ' + esc(money(Math.max(0, (Number(PL_MIN) || 500) - paid))) + ' more</span>';
  return fee > 0 && paid >= fee ? '<span class="nx-pill ok">Full ' + esc(money(paid)) + '</span>' : '<span class="nx-pill">Partial ' + esc(money(paid)) + (fee > 0 ? ' of ' + esc(money(fee)) : '') + '</span>';
}
let PL_MIN = 500;
function rdFilter(rows, today) {
  const q = RD.q.trim().toLowerCase(), area = RD.area.trim().toLowerCase();
  return rows.filter(r => {
    if (RD.status === 'complete' && r.placement_docs_missing !== 0) return false;
    if (RD.status === 'incomplete' && !(r.placement_docs_missing > 0)) return false;
    if (q && !(fullName(r).toLowerCase().includes(q))) return false;
    if (RD.from && !(r.docs_complete_on && r.docs_complete_on >= RD.from)) return false;
    if (RD.to && !(r.docs_complete_on && r.docs_complete_on <= RD.to)) return false;
    if (RD.st && r.state !== RD.st) return false;
    if (area && !([r.interest_area, r.suburb, r.postcode].filter(Boolean).join(' ').toLowerCase().includes(area))) return false;
    if (RD.shift === 'irregular') { if (r.availability !== 'irregular') return false; }
    else if (RD.shift && (r.pref_shifts || []).length && !r.pref_shifts.includes(RD.shift)) return false;
    if (RD.ready && r.readiness !== RD.ready) return false;
    if (RD.wait && rdWaitOf(r, today).k !== RD.wait) return false;
    if (RD.flag === 'eng' && r.english_check !== 'flagged') return false;
    if (RD.flag === 'irr' && r.availability !== 'irregular') return false;
    if (RD.flag === 'want' && !(r.want_start || r.want_facility_id || r.want_facility_text)) return false;
    return true;
  });
}
function rdSort(rows, today) {
  const rank = r => ({ over: 0, under: 1, none: 2 })[rdWaitOf(r, today).k], rr = r => { const i = ['desperate_ll', 'desperate', 'can_go', null, 'cant_go'].indexOf(r.readiness || null); return i < 0 ? 3 : i; };
  return rows.slice().sort((a, b) => (a.paid_ok && a.placement_docs_missing === 0 ? 0 : 1) - (b.paid_ok && b.placement_docs_missing === 0 ? 0 : 1) || rank(a) - rank(b) || rr(a) - rr(b) || String(a.docs_complete_on || '9').localeCompare(String(b.docs_complete_on || '9')) || b.calls - a.calls || fullName(a).localeCompare(fullName(b)));
}
async function renderReady(body) {
  const today = sydToday();
  const [rows, min] = await Promise.all([
    selAll('nex_placement_queue', 'select=*&has_placement=eq.false&hold=eq.false&stage=not.in.(' + PP_ENDED + ')'),
    btMin().catch(() => 500)
  ]);
  PL_MIN = min;
  const opt = (v, cur, l) => '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + esc(l) + '</option>';
  const bar = '<div class="nx-toolbar" style="border-top:0;flex-wrap:wrap">' +
    '<input class="nx-in sm" id="rdQ" placeholder="Search a name" value="' + esc(RD.q) + '" style="min-width:170px">' +
    '<select class="nx-sel sm" id="rdStatus" aria-label="Documents">' + opt('complete', RD.status, 'Docs complete') + opt('incomplete', RD.status, 'Docs incomplete') + opt('', RD.status, 'All') + '</select>' +
    '<label class="nx-muted" style="display:flex;align-items:center;gap:4px">Docs done from <input class="nx-in sm" type="date" id="rdFrom" value="' + esc(RD.from) + '"> to <input class="nx-in sm" type="date" id="rdTo" value="' + esc(RD.to) + '"></label>' +
    '<select class="nx-sel sm" id="rdWait" aria-label="Waiting time">' + opt('', RD.wait, 'Any waiting time') + opt('over', RD.wait, '3 weeks or more (priority)') + opt('under', RD.wait, 'Under 3 weeks') + '</select>' +
    '<select class="nx-sel sm" id="rdSt" aria-label="State">' + opt('', RD.st, 'Any state') + PP_STATES.map(x => opt(x, RD.st, x)).join('') + '</select>' +
    '<input class="nx-in sm" id="rdArea" placeholder="Area or suburb" value="' + esc(RD.area) + '" style="min-width:130px">' +
    '<select class="nx-sel sm" id="rdShift" aria-label="Shift">' + opt('', RD.shift, 'Any shift') + BT_SHIFTS.map(([k, l]) => opt(k, RD.shift, l)).join('') + opt('irregular', RD.shift, 'Irregular') + '</select>' +
    '<select class="nx-sel sm" id="rdReady" aria-label="Readiness">' + opt('', RD.ready, 'Any readiness') + PP_READY.map(([k, l]) => opt(k, RD.ready, l)).join('') + '</select>' +
    '<select class="nx-sel sm" id="rdFlag" aria-label="Flags">' + opt('', RD.flag, 'Any flags') + opt('eng', RD.flag, 'English to be assessed') + opt('irr', RD.flag, 'Irregular availability') + opt('want', RD.flag, 'Asked for a date or aged care') + '</select>' +
    '<button class="nx-btn sm" id="rdClear">Clear</button></div>';
  body.innerHTML = bar + '<div id="rdList"></div>';
  const draw = () => {
    const list = rdSort(rdFilter(rows, today), today), box = $('#rdList', body), cap = 300, shown = list.slice(0, cap);
    box.innerHTML = '<div class="nx-card-b nx-muted" style="padding-top:6px">' + list.length + ' of ' + rows.length + ' students' + (RD.status === 'complete' ? ' with all placement documents received' : '') + '. Students ready to place come first, and those waiting 3 weeks or more are at the top.</div>' +
      (shown.length ? '<div class="nx-tablewrap"><table class="nx-table tight"><thead><tr><th>Student</th><th>Documents</th><th>State and area</th><th>Shift</th><th>Readiness</th><th>Payment</th><th class="nx-num">Calls</th><th>Notes</th><th></th></tr></thead><tbody>' + shown.map(r => {
        const w = rdWaitOf(r, today), area = [r.interest_area || r.suburb, r.postcode && !r.interest_area ? r.postcode : ''].filter(Boolean).join(' ');
        return '<tr><td><a href="#/students/' + r.student_id + '" data-ppgo="1"><b>' + esc(fullName(r)) + '</b></a><div>' + ppPills(r) + '</div><div class="nx-muted" style="font-size:12px">' + esc(qualName(r.qualification_id) || '') + '</div></td>' +
          '<td>' + (r.placement_docs_missing > 0 ? '<span class="nx-pill bad" title="' + esc(r.placement_docs_missing_names || '') + '">Missing ' + r.placement_docs_missing + '</span>' : (r.docs_complete_on ? '<span class="nx-pill ok">Complete</span>' : '<span class="nx-muted">None needed</span>')) + (r.docs_complete_on ? '<div class="nx-muted" style="font-size:12px">' + esc(fmtDate(r.docs_complete_on)) + '</div>' : '') +
          (w.k === 'over' ? '<div><span class="nx-pill ok">3+ weeks · priority</span></div>' : (w.k === 'under' ? '<div><span class="nx-pill warn">From ' + esc(fmtDate(w.due)) + '</span></div>' : '')) + '</td>' +
          '<td>' + esc(r.state || '') + (area ? '<div class="nx-muted" style="font-size:12px">' + esc(area) + '</div>' : '') + '</td><td>' + esc(ppShiftText(r)) + '</td><td>' + esc(ppReadyLabel(r.readiness) || '') + '</td><td>' + rdPay(r) + '</td><td class="nx-num">' + r.calls + '</td>' +
          '<td class="nx-muted" style="max-width:240px">' + esc([r.want_start ? 'Wants ' + fmtDate(r.want_start) : '', r.want_facility_text || '', r.placement_note].filter(Boolean).join(' · ').slice(0, 120)) + '</td>' +
          '<td><button class="nx-btn sm" data-hold="' + r.student_id + '">Hold</button></td></tr>'; }).join('') + '</tbody></table></div>' +
        (list.length > cap ? '<div class="nx-card-b nx-muted">Showing the first ' + cap + '. Narrow the filters to see the rest.</div>' : '') : empty('Nobody matches', rows.length ? 'Try clearing a filter.' : 'Students appear here once they have paid and all their placement documents are in.'));
    $$('[data-ppgo]', box).forEach(a => a.addEventListener('click', () => { if (typeof SR !== 'undefined') SR.tab = 'placement'; }));
    $$('[data-hold]', box).forEach(b => b.onclick = () => { const r = rows.find(x => x.student_id === b.dataset.hold); ppHoldForm({ id: r.student_id, first_name: r.first_name, last_name: r.last_name }, null, async () => { await renderReady(body); }); });
  };
  const bindIn = (id, k, ev) => { const el = $('#' + id, body); el.addEventListener(ev || 'change', () => { RD[k] = el.value; draw(); }); };
  bindIn('rdQ', 'q', 'input'); bindIn('rdArea', 'area', 'input'); ['rdStatus:status', 'rdFrom:from', 'rdTo:to', 'rdWait:wait', 'rdSt:st', 'rdShift:shift', 'rdReady:ready', 'rdFlag:flag'].forEach(x => { const [i, k] = x.split(':'); bindIn(i, k); });
  $('#rdClear', body).onclick = () => { Object.assign(RD, { q: '', status: 'complete', from: '', to: '', st: '', area: '', shift: '', ready: '', wait: '', flag: '' }); renderReady(body); };
  draw();
}

/* ---------- Placement > On hold ---------- */
const HD = { q: '' };
async function renderHold(body) {
  const rows = await sel('nex_placement_profile', 'select=*,nex_students(id,first_name,last_name,phone,email,deleted_at)&hold=eq.true&order=hold_on.desc.nullslast&limit=500');
  const today = sydToday();
  body.innerHTML = '<div class="nx-toolbar" style="border-top:0"><input class="nx-in sm" id="hdQ" placeholder="Search a name or reason" value="' + esc(HD.q) + '" style="min-width:200px"><span class="nx-muted">' + rows.length + ' on hold</span>' +
    '<span class="nx-btnrow" style="margin-left:auto"><button class="nx-btn sm primary" id="hdAdd">' + ico('plus') + 'Put a student on hold</button></span></div><div id="hdList"></div>';
  const draw = () => {
    const q = HD.q.trim().toLowerCase();
    const list = rows.filter(r => r.nex_students && !r.nex_students.deleted_at && (!q || (fullName(r.nex_students) + ' ' + (r.hold_reason || '') + ' ' + (r.hold_note || '')).toLowerCase().includes(q)));
    $('#hdList', body).innerHTML = list.length ? '<div class="nx-tablewrap"><table class="nx-table tight"><thead><tr><th>Student</th><th>On hold since</th><th>Told</th><th>Reason and note</th><th>Back around</th><th>Shift</th><th></th></tr></thead><tbody>' + list.map(r => {
      const s = r.nex_students;
      return '<tr><td><a href="#/students/' + s.id + '" data-ppgo="1"><b>' + esc(fullName(s)) + '</b></a><div class="nx-muted" style="font-size:12px">' + esc([fmtPhone(s.phone), s.email].filter(Boolean).join(' · ')) + '</div></td>' +
        '<td>' + esc(fmtDate(r.hold_on) || '') + '<div class="nx-muted" style="font-size:12px">' + esc(r.hold_by || '') + '</div></td><td>' + esc(ppWays(r.hold_contact) || '–') + '</td>' +
        '<td>' + esc(r.hold_reason || '') + (r.hold_note ? '<div class="nx-muted" style="font-size:12px">' + esc(r.hold_note) + '</div>' : '') + '</td>' +
        '<td>' + (r.hold_until ? esc(fmtDate(r.hold_until)) + (r.hold_until <= today ? ' <span class="nx-pill warn">Check in</span>' : '') : '<span class="nx-muted">–</span>') + '</td><td>' + esc(ppShiftText(r)) + '</td>' +
        '<td><span class="nx-btnrow"><button class="nx-btn sm" data-ed="' + s.id + '">Update</button><button class="nx-btn sm primary" data-off="' + s.id + '">Take off hold</button></span></td></tr>'; }).join('') + '</tbody></table></div>' : empty('Nobody is on hold', 'When a student asks to wait for their placement, put them on hold here or from their Placement tab.');
    $$('[data-ppgo]', body).forEach(a => a.addEventListener('click', () => { if (typeof SR !== 'undefined') SR.tab = 'placement'; }));
    $$('[data-ed]', body).forEach(b => b.onclick = () => { const r = rows.find(x => x.nex_students && x.nex_students.id === b.dataset.ed); ppHoldForm(r.nex_students, r, () => renderHold(body)); });
    $$('[data-off]', body).forEach(b => b.onclick = () => { const r = rows.find(x => x.nex_students && x.nex_students.id === b.dataset.off); ppUnhold(r.nex_students, () => renderHold(body)); });
  };
  $('#hdQ', body).addEventListener('input', e => { HD.q = e.target.value; draw(); });
  $('#hdAdd', body).onclick = () => pickStudent('Put which student on hold?', async st => { const pp = await ppLoad(st.id); ppHoldForm(st, pp && pp.hold ? pp : null, () => renderHold(body)); });
  draw();
}

/* ---------- batches: students who asked for this aged care and date ---------- */
function ppAskedFor(batch, card, rows) {
  if (!card.facility_id) return [];
  return rows.filter(r => r.want_facility_id === card.facility_id && r.want_start && Math.abs((new Date(r.want_start) - new Date(batch.starts_on)) / 864e5) <= PP_NEAR);
}
async function ppAskedRows(batch) {
  const a = btAddDays(batch.starts_on, -PP_NEAR), b = btAddDays(batch.starts_on, PP_NEAR);
  return sel('nex_placement_queue', 'select=*&has_placement=eq.false&hold=eq.false&want_start=gte.' + a + '&want_start=lte.' + b + '&limit=500').catch(() => []);
}
/* place one student on a card (checks the flags first); used by the batch card's "asked for this aged care" list */
async function ppPlace(batch, card, r, shift) {
  if (!await ppGate(r, fullName(r), { facility_id: card.facility_id, start: batch.starts_on })) return false;
  try { await ins('nex_placements', { enrolment_id: r.enrolment_id, batch_id: batch.id, batch_facility_id: card.id, facility_id: card.facility_id || null, shift, status: 'site_date_allocated', start_date: batch.starts_on }, true); toast(fullName(r) + ' added'); return true; }
  catch (e) { toast(e.message, true); return false; }
}
