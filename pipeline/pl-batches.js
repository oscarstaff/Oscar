'use strict';
/* pl-batches.js · Yatra · Placement batches: a batch is a start date (made behind the scenes), each aged care is a card with AM / PM / Night quotas,
   and students are placed on a card with a shift. The Batches tab lists the cards; a card opens its own page (#/placement/aged-care/<id>).
   One of the Yatra files loaded by nex.html (list and order: PL_FILES in the loader). All of them share one global scope.

   Rules (the database enforces them too; see migration nex_placement_batches):
   - a student needs at least the "placement_min_paid" amount received (default $500) before going in a batch; hub admins are exempt
   - one live place per person per batch; withdrawing frees the place
   - quotas are a guide: going over shows in red but does not block
   - all placement documents must be received (nex_placement_docs); the 3-week wait counts from the day the last one arrived
   - only hub admins can delete a batch or a card */
const BT = { min: null, past: false };
const BT_OFF = ['withdrawn', 'cancelled', 'denied', 'not_accommodated', 'rejected'];   /* placements that no longer use a place */
const BT_SHIFTS = [['am', 'AM'], ['pm', 'PM'], ['night', 'Night']];
const BT_SHIFT_L = { am: 'AM', pm: 'PM', night: 'Night' };
const BT_WAIT_DAYS = 21;
const BT_LOGBOOK = [{ id: 'not_scheduled', label: 'Not scheduled' }, { id: 'scheduled', label: 'Scheduled' }, { id: 'sent', label: 'Sent' }];

const btLive = p => !BT_OFF.includes(p.status);
function btDate(d) { return d ? new Date(d + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ }) : ''; }
function btAddDays(d, n) { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
async function btMin() {
  if (BT.min != null) return BT.min;
  try { BT.min = Number(await (await api('rpc/nex_placement_min_paid', { method: 'POST', body: {} })).json()); } catch (e) { BT.min = 500; }
  if (!(BT.min >= 0)) BT.min = 500;
  return BT.min;
}
/* the day an aged care actually starts: its own date when it has one (holidays), otherwise the batch's */
const btStart = (batch, card) => (card && card.starts_on) || batch.starts_on;
function btCardName(c) { return c.is_others ? 'Others confirmed' : ((c.nex_facilities || {}).name || '(aged care)'); }
function btCount(places, cardId, shift) { return places.filter(p => p.batch_facility_id === cardId && btLive(p) && (!shift || p.shift === shift)).length; }
function btStudent(p) { return (p.nex_enrolments || {}).nex_students || null; }
function btRefresh() { const b = $('#plBody'); if (b && PL.tab === 'batches') return renderBatches(b, null).catch(e => { b.innerHTML = empty('Could not load', e.message); }); }

/* ---------- the Batches tab: one card per aged care, soonest start first ----------
   Nobody makes a batch by hand any more. "Add aged care" picks an aged care and its target start date; the batch for that day
   (the thing placements and the database rules hang on) is found or created behind the scenes. */
function btTime(t) { const m = /^(\d{1,2}):(\d{2})/.exec(t || ''); if (!m) return ''; const h = +m[1]; return (h % 12 || 12) + (m[2] === '00' ? '' : ':' + m[2]) + ' ' + (h >= 12 ? 'PM' : 'AM'); }
function btShort(d) { return d ? new Date(d + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ }) : ''; }
function btParts(d) { const x = new Date(d + 'T12:00:00'); return { mon: x.toLocaleDateString('en-AU', { month: 'short', timeZone: TZ }), day: x.toLocaleDateString('en-AU', { day: 'numeric', timeZone: TZ }), wd: x.toLocaleDateString('en-AU', { weekday: 'short', timeZone: TZ }) }; }
/* how close the start is: the colour of the card and the line under the name */
function acWhen(start, today) {
  const n = Math.round((new Date(start + 'T12:00:00Z') - new Date(today + 'T12:00:00Z')) / 864e5), pl = k => k + (k === 1 ? ' day' : ' days');
  if (n > 7) return { tone: 'later', text: 'Starts in ' + pl(n) };
  if (n > 1) return { tone: 'soon', text: 'Starts in ' + pl(n) };
  if (n === 1) return { tone: 'soon', text: 'Starts tomorrow' };
  if (n === 0) return { tone: 'now', text: 'Starts today' };
  if (n >= -14) return { tone: 'now', text: 'Started ' + pl(-n) + ' ago' };
  return { tone: 'past', text: 'Started ' + pl(-n) + ' ago' };
}
function acOrient(c) { const t = [c.orientation_on ? btShort(c.orientation_on) : '', btTime(c.orientation_time)].filter(Boolean).join(' · '); return t || c.orientation_note || ''; }
async function btBatchFor(date) {   /* the batch that starts on this day (made when it does not exist yet) */
  const f = (await sel('nex_batches', 'select=*&starts_on=eq.' + date))[0];
  return f || await ins('nex_batches', { starts_on: date });
}
function acDateTile(start, big) { const d = btParts(start); return '<span class="nx-ac-date' + (big ? ' big' : '') + '"><small>' + esc(d.mon) + '</small><b>' + esc(d.day) + '</b><i>' + esc(d.wd) + '</i></span>'; }
/* the operator's logo colour (nex_facilities.brand_color); no colour set = the timing colours as before */
function acBrand(c) { const k = (c.nex_facilities || {}).brand_color; return /^#[0-9a-f]{6}$/i.test(k || '') ? ' data-brand style="--brand:' + k + '"' : ''; }
function acFact(icon, label, val) { return '<span class="nx-ac-f">' + ico(icon) + '<span><small>' + esc(label) + '</small><b' + (val ? '' : ' class="nx-muted"') + '>' + (val ? esc(val) : 'Not set') + '</b></span></span>'; }

function acCardHtml(c, places, today, asked) {
  const b = c.nex_batches, start = btStart(b, c), w = acWhen(start, today);
  const mine = places.filter(p => p.batch_facility_id === c.id && btLive(p));
  const quota = c.quota_am + c.quota_pm + c.quota_night;
  const bars = c.is_others ? '' : BT_SHIFTS.map(([k, l]) => { const q = c['quota_' + k], n = mine.filter(p => p.shift === k).length; if (!q && !n) return '';
    return '<span class="nx-ac-sh ' + (n > q ? 'over' : (q && n === q ? 'full' : '')) + '"><span>' + l + '</span><i><u style="width:' + (q ? Math.min(100, Math.round(n / q * 100)) : 100) + '%"></u></i><b>' + n + '/' + q + '</b></span>'; }).join('');
  const nAsked = c.is_others ? 0 : ppAskedFor(b, c, asked).length;
  const pills = c.is_others ? '' :
    '<span class="nx-pill ' + (c.docs_sent_on ? 'ok' : '') + '">Docs ' + (c.docs_sent_on ? 'sent' : 'not sent') + '</span>' +
    '<span class="nx-pill ' + (c.info_sent_on ? 'ok' : '') + '">Info ' + (c.info_sent_on ? 'sent' : 'not sent') + '</span>' +
    (c.logbook ? '<span class="nx-pill ' + (c.logbook === 'sent' ? 'ok' : (c.logbook === 'scheduled' ? 'info' : 'warn')) + '">Logbook ' + esc(c.logbook.replace('_', ' ')) + '</span>' : '') +
    (nAsked ? '<span class="nx-pill accent">' + nAsked + ' asked for this</span>' : '');
  return '<button type="button" class="nx-bcard' + (c.is_others ? ' others' : '') + '" data-bf="' + c.id + '" data-tone="' + w.tone + '"' + acBrand(c) + '>' +
    '<span class="nx-ac-top">' + acDateTile(start) + '<span class="nx-ac-name"><b>' + esc(btCardName(c)) + '</b>' +
      '<small>' + esc(c.is_others ? 'Students who found their own aged care' : ((c.nex_facilities || {}).suburb || '')) + '</small><em>' + esc(w.text) + '</em></span></span>' +
    '<span class="nx-ac-body">' +
      (c.is_others ? acFact('users', 'Placed', mine.length + (mine.length === 1 ? ' student' : ' students')) :
        '<span class="nx-ac-facts">' + acFact('clock', 'Start time', btTime(c.start_time)) + acFact('calendar', 'Orientation', acOrient(c)) +
        acFact('list', 'Shift times', c.shift_note) + acFact('users', 'Placed', mine.length + (quota ? ' of ' + quota : '')) + '</span>') +
      (bars ? '<span class="nx-ac-shifts">' + bars + '</span>' : '') +
      (pills ? '<span class="nx-bchk">' + pills + '</span>' : '') +
    '</span></button>';
}

async function renderBatches(body, stale) {
  const today = sydToday();
  const [cards, places, asked] = await Promise.all([
    sel('nex_batch_facilities', 'select=*,nex_facilities(name,suburb,brand_color),nex_batches(id,starts_on,name,note)&limit=1000'),
    sel('nex_placements', 'select=id,status,shift,batch_facility_id&batch_facility_id=not.is.null&limit=5000'),
    sel('nex_placement_queue', 'select=*&has_placement=eq.false&hold=eq.false&want_start=gte.' + btAddDays(today, -40) + '&order=enrolment_id&limit=1000').catch(() => [])
  ]);
  if ((stale && stale()) || PL.tab !== 'batches' || !body.isConnected) return;   /* the person went to another tab while this loaded */
  const startOf = c => btStart(c.nex_batches, c);
  const othersIds = new Set(cards.filter(c => c.is_others).map(c => c.id)), othersPlaces = places.filter(p => othersIds.has(p.batch_facility_id) && btLive(p));
  cards.splice(0, cards.length, ...cards.filter(c => !c.is_others));   /* every Others confirmed card is shown as the one standing card below: those students start on their own dates */
  cards.sort((a, b) => startOf(a).localeCompare(startOf(b)) || (a.is_others - b.is_others) || btCardName(a).localeCompare(btCardName(b)));
  const cut = btAddDays(today, -14), shown = cards.filter(c => BT.past || startOf(c) >= cut), hidden = cards.length - cards.filter(c => startOf(c) >= cut).length;
  const live = places.filter(btLive).length, nCare = cards.filter(c => !c.is_others && startOf(c) >= cut).length;
  const head = '<div class="nx-toolbar" style="border-top:0">' +
    '<span class="nx-muted">' + nCare + (nCare === 1 ? ' aged care' : ' aged cares') + ' coming up or just started · ' + live + ' students placed in all</span>' +
    '<span class="nx-btnrow" style="margin-left:auto">' + (hidden || BT.past ? '<button class="nx-btn sm" id="btPast" aria-pressed="' + !!BT.past + '">' + (BT.past ? 'Hide earlier' : 'Show earlier (' + hidden + ')') + '</button>' : '') +
    '<button class="nx-btn sm primary" id="btAdd">' + ico('plus') + 'Add aged care</button></span></div>';
  const grid = '<div class="nx-bgrid">' + othersCardHtml(othersPlaces, today) + shown.map(c => acCardHtml(c, places, today, asked)).join('') + '</div>' + (shown.length ? ''
    : '<div class="nx-card-b">' + empty('No aged cares yet', 'Add an aged care and the date you want students to start. Each one gets its own card, and you add students inside it.', '<button class="nx-btn primary" id="btAdd2">' + ico('plus') + 'Add aged care</button>') + '</div>');
  body.innerHTML = head + grid;
  $('#btAdd').onclick = () => agedCareNew();
  if ($('#btAdd2')) $('#btAdd2').onclick = () => agedCareNew();
  if ($('#btPast')) $('#btPast').onclick = () => { BT.past = !BT.past; btRefresh(); };
  $$('.nx-bcard', body).forEach(b => b.onclick = () => go('#/placement/aged-care/' + b.dataset.bf));
}

/* ---------- Others confirmed: students who found their own aged care ----------
   One standing card. Each student has their OWN start date (it is on their placement), so the card is not tied to a day. */
function othersCardHtml(list, today) {
  const next = list.map(p => p.start_date).filter(d => d && d >= today).sort()[0], n = list.length;
  return '<button type="button" class="nx-bcard others" data-bf="others" data-tone="later">' +
    '<span class="nx-ac-top"><span class="nx-ac-date"><small>Others</small><b>' + n + '</b><i>' + (n === 1 ? 'student' : 'students') + '</i></span><span class="nx-ac-name"><b>Others confirmed</b>' +
    '<small>Students who found their own aged care</small><em>' + (next ? 'Next start ' + esc(btShort(next)) : 'Each student has their own start date') + '</em></span></span></button>';
}
/* the Others confirmed card for the batch that starts on this day (batch and card are made when they do not exist yet) */
async function btOthersFor(date) {
  const b = await btBatchFor(date);
  let card = (await sel('nex_batch_facilities', 'select=*&is_others=eq.true&batch_id=eq.' + b.id))[0];
  if (!card) card = await ins('nex_batch_facilities', { batch_id: b.id, is_others: true });
  return { batch: b, card };
}
/* A self-placement request was just set to Request granted: ask for the start date and notes, then move the student into Others confirmed. */
function othersConfirmedAsk(r, after) {
  const s = (r.nex_enrolments || {}).nex_students, name = s ? fullName(s) : '', fac = (r.nex_facilities || {}).name || r.facility_text || '';
  if (!r.enrolment_id) { toast('Link this request to a student first, then you can move them to Others confirmed.', true); return; }
  formModal('Move to Others confirmed', [
    { k: 'start_date', label: 'Start date', type: 'date', required: true, full: true },
    { k: 'note', label: 'Notes / Orientation', type: 'textarea', full: true, placeholder: 'Orientation date and time, who to see, anything else to remember' }
  ], async v => {
    const { batch, card } = await btOthersFor(v.start_date);
    if ((await sel('nex_placements', 'select=id,status&enrolment_id=eq.' + r.enrolment_id + '&batch_id=eq.' + batch.id)).some(btLive)) throw new Error('This student is already placed for that week. Open Others confirmed to change them.');
    await ins('nex_placements', { enrolment_id: r.enrolment_id, batch_id: batch.id, batch_facility_id: card.id, facility_id: r.facility_id || null, facility_text: r.facility_text || (r.nex_facilities || {}).name || null, status: 'site_date_allocated', start_date: v.start_date, note: v.note }, true);
    toast((name || 'Student') + ' moved to Others confirmed'); if (after) await after(); else render();
  }, 'Move to Others confirmed', '<div class="nx-card-b" style="padding:0 0 10px"><b>' + esc(name || 'This student') + '</b>' + (fac ? ' at <b>' + esc(fac) + '</b>' : '') + ': request granted. Each student has their own start date.</div>');
}

route(/^\/placement\/aged-care\/others$/, async () => {
  PL.tab = 'batches';
  const cards = await sel('nex_batch_facilities', 'select=id&is_others=eq.true&limit=1000'), ids = cards.map(c => c.id), today = sydToday();
  const places = ids.length ? await sel('nex_placements', 'select=*,nex_enrolments(student_id,nex_students(id,first_name,last_name))&batch_facility_id=in.(' + ids.join(',') + ')&order=start_date.asc.nullslast,created_at.asc&limit=1000') : [];
  const live = places.filter(btLive), gone = places.filter(p => !btLive(p)), next = live.map(p => p.start_date).filter(d => d && d >= today).sort()[0];
  const row = p => { const s = btStudent(p); return '<li><div>' + (s ? '<a href="#/students/' + s.id + '"><b>' + esc(fullName(s)) + '</b></a>' : '–') + ' <span class="nx-pill ' + (p.start_date && p.start_date >= today ? 'accent' : '') + '">' + (p.start_date ? 'Starts ' + esc(btDate(p.start_date)) : 'No start date') + '</span>' +
    '<small>' + esc([p.facility_text, statusLabel('placement_stage', p.status), p.note].filter(Boolean).join(' · ')) + '</small></div>' +
    '<span class="nx-btnrow"><button class="nx-btn sm" data-ed="' + p.id + '">Edit</button>' + (btLive(p) ? '<button class="nx-btn sm" data-wd="' + p.id + '">Withdraw</button>' : '') + '</span></li>'; };
  afterRender(() => {
    $('#acAdd').onclick = () => formModal('Add a student to Others confirmed', [{ k: 'start_date', label: 'Their start date', type: 'date', required: true, full: true }], async v => {
      const { batch, card } = await btOthersFor(v.start_date);
      const mine = await sel('nex_placements', 'select=*&batch_facility_id=eq.' + card.id);
      setTimeout(() => batchAddStudent(batch, card, mine, async () => { render(); }), 350);
    }, 'Continue');
    $$('#acStu [data-ed]').forEach(b => b.onclick = () => placementEdit(places.find(x => x.id === b.dataset.ed), { is_others: true }, async () => { render(); }));
    $$('#acStu [data-wd]').forEach(b => b.onclick = async () => {
      const p = places.find(x => x.id === b.dataset.wd), s = btStudent(p);
      if (!await confirmBox('Withdraw from Others confirmed', (s ? fullName(s) : 'This student') + ' will be marked withdrawn.', 'Withdraw', true)) return;
      try { await upd('nex_placements', 'id=eq.' + p.id, { status: 'withdrawn' }); render(); } catch (e) { toast(e.message, true); }
    });
  });
  return '<div class="nx-crumbs"><a href="#/placement">Placement</a> / <a href="#/placement">Batches</a> / <span>Others confirmed</span></div>' +
    '<div class="nx-card nx-achead" data-tone="later"><span class="nx-ac-date big"><small>Others</small><b>' + live.length + '</b><i>' + (live.length === 1 ? 'student' : 'students') + '</i></span>' +
    '<div class="nx-achead-t"><div class="nx-eyebrow">Students who found their own aged care' + (next ? ' · next start ' + esc(btShort(next)) : '') + '</div><h1 class="nx-title">Others confirmed</h1><div class="nx-muted">Every student has their own start date. A student arrives here when their self-placement request is set to Request granted.</div></div></div>' +
    '<div class="nx-card" id="acStu"><div class="nx-card-h"><h3>Students (' + live.length + ')</h3><button type="button" class="nx-btn sm primary" id="acAdd">' + ico('plus') + 'Add student</button></div><div style="padding:6px 16px 16px">' +
    (live.length ? '<ul class="nx-list">' + live.map(row).join('') + '</ul>' : '<div class="nx-help">Nobody is here yet.</div>') +
    (gone.length ? '<details style="margin-top:10px"><summary class="nx-muted">Withdrawn or closed (' + gone.length + ')</summary><ul class="nx-list">' + gone.map(row).join('') + '</ul></details>' : '') + '</div></div>';
});

/* the fields of an aged care: used by Add (pick the aged care first) and by Edit details on its own page */
function acFields(c, adding) {
  c = c || {};
  return [
    { k: 'starts_on', label: 'Target placement start date', type: 'date', value: c.starts_on, required: true },
    { k: 'start_time', label: 'Start time', type: 'time', value: c.start_time },
    { k: 'orientation_on', label: 'Orientation date', type: 'date', value: c.orientation_on },
    { k: 'orientation_time', label: 'Orientation time', type: 'time', value: c.orientation_time },
    { k: 'orientation_note', label: 'Orientation notes', value: c.orientation_note, placeholder: 'e.g. bring ID, meet at reception', full: true },
    { k: 'quota_am', label: 'AM places', type: 'number', value: c.quota_am || 0 }, { k: 'quota_pm', label: 'PM places', type: 'number', value: c.quota_pm || 0 }, { k: 'quota_night', label: 'Night places', type: 'number', value: c.quota_night || 0 },
    { k: 'shift_note', label: 'Shift times', value: c.shift_note, placeholder: 'e.g. AM 7-3, PM 2-10', full: true }
  ].concat(adding ? [] : [
    { k: 'docs_sent_on', label: 'Documents sent to the aged care on', type: 'date', value: c.docs_sent_on }, { k: 'info_sent_on', label: 'Information sent to students on', type: 'date', value: c.info_sent_on },
    { k: 'logbook', label: 'Logbook', type: 'select', options: BT_LOGBOOK, value: c.logbook, blank: 'Not set' },
    { k: 'note', label: 'Note', type: 'textarea', value: c.note, full: true }]);
}
const btQuotas = v => { for (const k of ['quota_am', 'quota_pm', 'quota_night']) if (k in v) v[k] = Math.max(0, Math.round(v[k] || 0)); return v; };

async function agedCareNew(facilityId) {
  const fac = await facilityOptions();
  if (!fac.length) { toast('There are no aged cares yet. Add one on the Facilities tab first.', true); return; }
  const f = [{ k: 'facility_id', label: 'Aged care', type: 'select', options: fac, value: facilityId || '', blank: 'Choose one', required: true, full: true }].concat(acFields({ starts_on: sydToday() }, true));
  const m = formModal('Add an aged care', f, async v => {
    btQuotas(v);
    const b = await btBatchFor(v.starts_on);
    if ((await sel('nex_batch_facilities', 'select=id&batch_id=eq.' + b.id + '&facility_id=eq.' + v.facility_id)).length) throw new Error('This aged care already has a card for that start date. Open it from the list.');
    const { starts_on, ...rest } = v;   /* the day is the batch's own; a card only keeps a date of its own when it is changed later */
    await ins('nex_batch_facilities', Object.assign({ batch_id: b.id }, rest), true); toast('Aged care added'); btRefresh();
  }, 'Add aged care', '<div class="nx-help" style="margin:0 0 10px">Pick the aged care and the day you want students to start. You add the students inside its card afterwards. <button type="button" class="nx-linkbtn" id="acNewFac">Not in the list? Add a new aged care</button></div>');
  const nf = $('#acNewFac', m.el); if (nf) nf.onclick = () => { m.close(); facilityForm(null, row => agedCareNew(row.id)); };
}

/* ---------- one aged care: its own page ---------- */
route(/^\/placement\/aged-care\/([0-9a-f-]{36})$/, async m => {
  PL.tab = 'batches';   /* "Back" lands on the Batches tab */
  const id = m[1], today = sydToday();
  const card = (await sel('nex_batch_facilities', 'select=*,nex_facilities(name,suburb,address,contact_name,phone,brand_color),nex_batches(id,starts_on,name,note)&id=eq.' + id))[0];
  if (!card) return pageHead('pin', 'Placement', 'Aged care', '') + '<div class="nx-card"><div class="nx-card-b">' + empty('This aged care is not here any more', 'It may have been removed from the list.', '<a class="nx-btn primary" href="#/placement">Back to Batches</a>') + '</div></div>';
  const batch = card.nex_batches, fac = card.nex_facilities || {}, start = btStart(batch, card), w = acWhen(start, today);
  const [places, askedAll] = await Promise.all([
    sel('nex_placements', 'select=*,nex_enrolments(student_id,nex_students(id,first_name,last_name))&batch_facility_id=eq.' + card.id + '&order=created_at.asc&limit=500'),
    card.is_others ? Promise.resolve([]) : ppAskedRows(batch)
  ]);
  const asked = card.is_others ? [] : ppAskedFor(batch, card, askedAll);
  const live = places.filter(btLive), gone = places.filter(p => !btLive(p));
  const fact = (k, v) => '<div><dt>' + esc(k) + '</dt><dd>' + (v ? esc(v) : '<span class="nx-muted">Not set</span>') + '</dd></div>';
  const where = [fac.suburb, fac.address].filter(Boolean).join(' · '), who = [fac.contact_name, fac.phone].filter(Boolean).join(' · ');
  const shiftsLine = card.is_others ? '' : '<div class="nx-help" style="padding:0 16px">' + BT_SHIFTS.map(([k, l]) => l + ' ' + live.filter(p => p.shift === k).length + ' of ' + (card['quota_' + k] || 0)).join(' · ') + '</div>';
  const row = p => { const s = btStudent(p); return '<li><div>' + (s ? '<a href="#/students/' + s.id + '"><b>' + esc(fullName(s)) + '</b></a>' : '–') + ' <span class="nx-pill info">' + esc(BT_SHIFT_L[p.shift] || '') + '</span>' +
    '<small>' + esc([card.is_others ? p.facility_text : '', statusLabel('placement_stage', p.status), p.start_date && p.start_date !== start ? 'Starts ' + btDate(p.start_date) : '', p.note].filter(Boolean).join(' · ')) + '</small></div>' +
    '<span class="nx-btnrow"><button class="nx-btn sm" data-ed="' + p.id + '">Edit</button>' + (btLive(p) ? '<button class="nx-btn sm" data-wd="' + p.id + '">Withdraw</button>' : '') + '</span></li>'; };
  const stu = '<div class="nx-card-h"><h3>Students (' + live.length + ')</h3><button type="button" class="nx-btn sm primary" id="acAdd">' + ico('plus') + 'Add student</button></div>' + shiftsLine +
    '<div style="padding:6px 16px 16px">' + (live.length ? '<ul class="nx-list">' + live.map(row).join('') + '</ul>' : '<div class="nx-help">Nobody is placed here yet. Press + Add student to start.</div>') +
    (asked.length ? '<h3 style="font-size:15px;margin:16px 0 4px">Asked for this aged care (' + asked.length + ')</h3><div class="nx-help">They asked for this aged care around this date. Pick a shift and add them.</div><ul class="nx-list">' + asked.map(r => '<li><div><b>' + esc(fullName(r)) + '</b> ' + (r.placement_docs_missing > 0 ? '<span class="nx-pill bad">Missing ' + r.placement_docs_missing + ' documents</span>' : (r.paid_ok ? '<span class="nx-pill ok">Ready</span>' : '<span class="nx-pill bad">Needs more payment</span>')) + ' ' + ppPills(r) + '<small>' + esc([r.want_start ? 'Wants ' + fmtDate(r.want_start) : '', ppShiftText(r), r.want_note].filter(Boolean).join(' · ')) + '</small></div><span class="nx-btnrow"><select class="nx-sel sm" data-ashift="' + r.enrolment_id + '" aria-label="Shift">' + BT_SHIFTS.map(([k, l]) => '<option value="' + k + '"' + (((r.pref_shifts || [])[0] || 'am') === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select><button type="button" class="nx-btn sm primary" data-aadd="' + r.enrolment_id + '">Add</button></span></li>').join('') + '</ul>' : '') +
    (gone.length ? '<details style="margin-top:10px"><summary class="nx-muted">Withdrawn or closed (' + gone.length + ')</summary><ul class="nx-list">' + gone.map(row).join('') + '</ul></details>' : '') + '</div>';
  const details = card.is_others ? '<dl class="nx-facts">' + fact('Note', card.note) + '</dl>' :
    '<dl class="nx-facts">' + fact('Start date', btDate(start)) + fact('Start time', btTime(card.start_time)) + fact('Orientation', acOrient(card)) + fact('Orientation notes', card.orientation_on || card.orientation_time ? card.orientation_note : '') + fact('Shift times', card.shift_note) +
    fact('Documents sent to the aged care', card.docs_sent_on ? fmtDate(card.docs_sent_on) : '') + fact('Information sent to students', card.info_sent_on ? fmtDate(card.info_sent_on) : '') + fact('Logbook', card.logbook ? card.logbook.replace('_', ' ') : '') + fact('Note', card.note) + '</dl>';
  afterRender(() => {
    $('#acAdd').onclick = () => batchAddStudent(batch, card, places, async () => { render(); });
    $('#acEdit').onclick = () => {
      const F = card.is_others ? [{ k: 'note', label: 'Note', type: 'textarea', value: card.note, full: true }] : acFields(Object.assign({}, card, { starts_on: start }));
      formModal('Edit ' + btCardName(card), F, async v => {
        btQuotas(v);
        if ('starts_on' in v) v.starts_on = v.starts_on && v.starts_on !== batch.starts_on ? v.starts_on : null;   /* the batch's own day is stored as "no date of its own" */
        await upd('nex_batch_facilities', 'id=eq.' + card.id, v); toast('Saved'); render();
      });
    };
    $$('[data-aadd]').forEach(b => b.onclick = async () => {
      const r = asked.find(x => x.enrolment_id === b.dataset.aadd); if (!r) return; b.disabled = true;
      if (await ppPlace(batch, card, r, $('[data-ashift="' + r.enrolment_id + '"]').value)) render(); else b.disabled = false;
    });
    $$('#acStu [data-ed]').forEach(b => b.onclick = () => placementEdit(places.find(x => x.id === b.dataset.ed), card, async () => { render(); }));
    $$('#acStu [data-wd]').forEach(b => b.onclick = async () => {
      const p = places.find(x => x.id === b.dataset.wd), s = btStudent(p);
      if (!await confirmBox('Withdraw from this aged care', (s ? fullName(s) : 'This student') + ' will be marked withdrawn and their place is freed.', 'Withdraw', true)) return;
      try { await upd('nex_placements', 'id=eq.' + p.id, { status: 'withdrawn' }); render(); } catch (e) { toast(e.message, true); }
    });
    const dl = $('#acDel'); if (dl) dl.onclick = async () => {
      if (places.length) { toast('This card has placement history, so it cannot be removed. Set its places to 0 instead.', true); return; }
      if (!await confirmBox('Remove this aged care', 'Remove ' + btCardName(card) + ' from the list?', 'Remove', true)) return;
      try { await del('nex_batch_facilities', 'id=eq.' + card.id); toast('Removed'); go('#/placement'); } catch (e) { toast(e.message, true); }
    };
  });
  return '<div class="nx-crumbs"><a href="#/placement">Placement</a> / <a href="#/placement">Batches</a> / <span>' + esc(btCardName(card)) + '</span></div>' +
    '<div class="nx-card nx-achead" data-tone="' + w.tone + '"' + acBrand(card) + '>' + acDateTile(start, true) +
    '<div class="nx-achead-t"><div class="nx-eyebrow">' + esc(card.is_others ? 'Others confirmed' : 'Aged care') + ' · ' + esc(w.text) + '</div><h1 class="nx-title">' + esc(btCardName(card)) + '</h1>' +
    ((where || who) ? '<div class="nx-muted">' + esc([where, who].filter(Boolean).join(' · ')) + '</div>' : '') + '</div>' +
    '<div class="nx-btnrow"><button class="nx-btn" id="acEdit">' + ico('edit') + 'Edit details</button></div></div>' +
    '<div class="nx-card"><div class="nx-card-h"><h3>Details</h3></div><div style="padding:4px 16px 16px">' + details + '</div></div>' +
    '<div class="nx-card" id="acStu">' + stu + '</div>' +
    (ME.admin ? '<div style="margin:14px 0"><button type="button" class="nx-btn sm" id="acDel">Remove this aged care from the list</button></div>' : '');
});

function placementEdit(p, card, done) {
  if (!p) return;
  const f = [{ k: 'shift', label: 'Shift', type: 'select', options: BT_SHIFTS.map(([id, label]) => ({ id, label })), value: p.shift, required: !card.is_others },   /* Others confirmed students come in without a shift */
    { k: 'status', label: 'Stage', type: 'select', options: opts('placement_stage', true), value: p.status, blank: 'Not set' },
    { k: 'start_date', label: 'Start date', type: 'date', value: p.start_date }];
  if (card.is_others) f.push({ k: 'facility_text', label: 'Aged care they found', value: p.facility_text, full: true });
  f.push({ k: 'note', label: 'Note', type: 'textarea', value: p.note, full: true });
  formModal('Update placement', f, async v => { await upd('nex_placements', 'id=eq.' + p.id, v); toast('Saved'); await done(); });
}

/* the add-student dialog: students who are ready (documents complete and enough received), longest-waiting and most-in-touch first */
async function batchAddStudent(batch, card, places, done) {
  const need = await btMin(), today = sydToday();
  let rows = [];
  const m = openModal({ title: 'Add a student to ' + btCardName(card), wide: true, footer: false, noFocus: true,
    body: '<div class="nx-form"><div><label class="nx-lbl" for="ba_shift">Shift</label><select class="nx-sel" id="ba_shift">' + BT_SHIFTS.map(([k, l]) => '<option value="' + k + '">' + l + (card.is_others ? '' : ' (' + btCount(places, card.id, k) + ' of ' + (card['quota_' + k] || 0) + ')') + '</option>').join('') + '</select></div>' +
      (card.is_others ? '<div><label class="nx-lbl" for="ba_other">Aged care they found *</label><input class="nx-in" id="ba_other" placeholder="Name of the aged care"></div>' : '') +
      '<div class="full"><label class="nx-lbl" for="ba_q">Find in the ready list</label><input class="nx-in" id="ba_q" placeholder="Type a name" autocomplete="off"></div></div>' +
      '<div class="nx-help" style="margin:8px 0">Ready means all placement documents received and at least ' + esc(money(need)) + ' received. Ordered: waited the 3 weeks first, then most calls. Students still missing documents are last and cannot be added until their documents are ticked.</div><div id="ba_list"><div class="nx-help">Loading…</div></div>' +
      '<div style="margin-top:12px"><button type="button" class="nx-btn sm" id="ba_find">' + ico('search') + 'Find someone who is not on this list</button></div>' });
  const assign = async (enrolmentId, who, flags) => {
    const shift = $('#ba_shift', m.el).value; let other = null;
    if (card.is_others) { other = ($('#ba_other', m.el).value || '').trim(); if (!other) { showErr(m, fieldError('#ba_other', 'Type the aged care they found first.')); return false; } }
    if (flags !== undefined && !await ppGate(flags, who, { facility_id: card.facility_id, start: btStart(batch, card) })) return false;     /* hold, English, irregular availability, asked for another date or aged care */
    try {
      await ins('nex_placements', { enrolment_id: enrolmentId, batch_id: batch.id, batch_facility_id: card.id, facility_id: card.facility_id || null, facility_text: other, shift, status: 'site_date_allocated', start_date: btStart(batch, card) }, true);
      toast((who || 'Student') + ' added'); await done(); return true;
    } catch (e) { toast(e.message, true); return false; }
  };
  const draw = () => {
    const q = ($('#ba_q', m.el).value || '').trim().toLowerCase(), box = $('#ba_list', m.el);
    const shown = rows.filter(r => !q || fullName(r).toLowerCase().includes(q)).slice(0, 60);
    box.innerHTML = shown.length ? '<ul class="nx-list">' + shown.map(r => {
      const due = r.docs_complete_on ? btAddDays(r.docs_complete_on, BT_WAIT_DAYS) : null;
      const st = !due ? '<span class="nx-pill bad">' + (r.placement_docs_missing > 0 ? 'Missing ' + r.placement_docs_missing + (r.placement_docs_missing === 1 ? ' document' : ' documents') : 'No documents recorded') + '</span>' : (due <= today ? '<span class="nx-pill ok">Ready</span>' : '<span class="nx-pill warn">From ' + esc(fmtDate(due)) + '</span>');
      return '<li><div><b>' + esc(fullName(r)) + '</b> ' + st + ' ' + ppPills(r) + '<small>' + esc([qualName(r.qualification_id), money(r.paid_total) + ' received', r.docs_complete_on ? 'documents complete ' + fmtDate(r.docs_complete_on) : '', r.calls + (r.calls === 1 ? ' call' : ' calls')].filter(Boolean).join(' · ')) + '</small></div>' +
        '<button type="button" class="nx-btn sm primary" data-add="' + r.enrolment_id + '">Add</button></li>'; }).join('') + '</ul>' : '<div class="nx-help">' + (rows.length ? 'Nobody matches.' : 'Nobody is ready and unplaced right now.') + '</div>';
    $$('[data-add]', box).forEach(b => b.onclick = async () => { const r = rows.find(x => x.enrolment_id === b.dataset.add); b.disabled = true; if (await assign(r.enrolment_id, fullName(r), r)) { rows = rows.filter(x => x !== r); draw(); } else b.disabled = false; });
  };
  try {
    rows = await sel('nex_placement_ready', 'select=*&has_placement=eq.false&stage=in.(docs_completed,processed,placement)&limit=1000');
    const rank = r => { const due = r.docs_complete_on ? btAddDays(r.docs_complete_on, BT_WAIT_DAYS) : null; return due && due <= today ? 0 : (due ? 1 : 2); };
    rows.sort((a, b) => rank(a) - rank(b) || b.calls - a.calls || String(a.docs_complete_on || '9').localeCompare(String(b.docs_complete_on || '9')) || fullName(a).localeCompare(fullName(b)));
    draw();
  } catch (e) { $('#ba_list', m.el).innerHTML = '<div class="nx-err">' + esc(e.message) + '</div>'; }
  $('#ba_q', m.el).addEventListener('input', draw);
  $('#ba_find', m.el).onclick = () => pickStudent('Find a student', st => pickEnrolment('Which enrolment?', async en => {
    const paid = (await sel('nex_student_paid', 'select=paid_total&student_id=eq.' + st.id))[0], got = paid ? Number(paid.paid_total) : 0;
    if (got < need) {
      if (!ME.admin) { toast(fullName(st) + ' has ' + money(got) + ' received. A student needs at least ' + money(need) + ' before going in a batch.', true); return; }
      if (!await confirmBox('Below the minimum', fullName(st) + ' has only ' + money(got) + ' received (the minimum is ' + money(need) + '). Place them anyway?', 'Place anyway')) return;
    }
    if (await assign(en.id, fullName(st), (await ppLoad(st.id)) || {})) { rows = rows.filter(x => x.enrolment_id !== en.id); draw(); }
  }));
}
