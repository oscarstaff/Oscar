'use strict';
/* pl-batches.js · Yatra · Placement batches: a batch is a start date, each aged care is a card with AM / PM / Night quotas,
   and students are placed on a card with a shift.
   One of the Yatra files loaded by nex.html (list and order: PL_FILES in the loader). All of them share one global scope.

   Rules (the database enforces them too; see migration nex_placement_batches):
   - a student needs at least the "placement_min_paid" amount received (default $500) before going in a batch; hub admins are exempt
   - one live place per person per batch; withdrawing frees the place
   - quotas are a guide: going over shows in red but does not block
   - all placement documents must be received (nex_placement_docs); the 3-week wait counts from the day the last one arrived
   - only hub admins can delete a batch or a card */
const BT = { id: null, min: null };
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
function btRefresh() { const b = $('#plBody'); if (b && PL.tab === 'batches') return renderBatches(b).catch(e => { b.innerHTML = empty('Could not load', e.message); }); }

async function renderBatches(body) {
  const batches = await sel('nex_batches', 'select=*&order=starts_on.desc&limit=80');
  if (!batches.length) {
    body.innerHTML = '<div class="nx-card-b">' + empty('No batches yet', 'A batch is a start date. Create one, add the aged cares taking students that week, then place students on each card.', '<button class="nx-btn primary" id="btNew">' + ico('plus') + 'New batch</button>') + '</div>';
    $('#btNew').onclick = () => batchNew();
    return;
  }
  if (!BT.id || !batches.find(b => b.id === BT.id)) {
    const today = sydToday(), upcoming = batches.filter(b => b.starts_on >= today);
    BT.id = (upcoming.length ? upcoming[upcoming.length - 1] : batches[0]).id;      /* the batch nearest to today */
  }
  const batch = batches.find(b => b.id === BT.id);
  const [cards, places, asked] = await Promise.all([
    sel('nex_batch_facilities', 'select=*,nex_facilities(name,suburb)&batch_id=eq.' + batch.id + '&limit=500'),
    sel('nex_placements', 'select=id,status,shift,batch_facility_id,enrolment_id,facility_text,start_date,note,nex_enrolments(student_id,nex_students(id,first_name,last_name))&batch_id=eq.' + batch.id + '&limit=2000'),
    ppAskedRows(batch)
  ]);
  cards.sort((a, b) => (b.is_others - a.is_others) || btCardName(a).localeCompare(btCardName(b)));
  const live = places.filter(btLive);
  const quota = cards.reduce((n, c) => n + c.quota_am + c.quota_pm + c.quota_night, 0);
  const hasOthers = cards.some(c => c.is_others);
  const head = '<div class="nx-toolbar" style="border-top:0">' +
    '<select class="nx-sel sm" id="btPick" aria-label="Batch">' + batches.map(b => '<option value="' + b.id + '"' + (b.id === batch.id ? ' selected' : '') + '>' + esc(btDate(b.starts_on) + (b.name ? ' · ' + b.name : '')) + '</option>').join('') + '</select>' +
    '<span class="nx-muted">' + live.length + ' placed · ' + cards.filter(c => !c.is_others).length + ' aged cares' + (quota ? ' · ' + quota + ' places in quota' : '') + '</span>' +
    '<span class="nx-btnrow" style="margin-left:auto"><button class="nx-btn sm" id="btEdit">Edit batch</button>' +
    (hasOthers ? '' : '<button class="nx-btn sm" id="btOthers">+ Others confirmed</button>') +
    '<button class="nx-btn sm" id="btNew">' + ico('plus') + 'New batch</button><button class="nx-btn sm primary" id="btAdd">' + ico('plus') + 'Add aged care</button></span></div>' +
    (batch.note ? '<div class="nx-card-b nx-muted" style="padding-top:0">' + esc(batch.note) + '</div>' : '');
  const grid = cards.length ? '<div class="nx-bgrid">' + cards.map(c => {
    const chips = c.is_others
      ? '<span>' + btCount(places, c.id) + ' students</span>'
      : BT_SHIFTS.map(([k, l]) => { const q = c['quota_' + k], n = btCount(places, c.id, k); return q || n ? '<span class="' + (n > q ? 'over' : (n === q ? 'full' : '')) + '">' + l + ' ' + n + '/' + q + '</span>' : ''; }).join('') || '<span>No quota set</span>';
    const chk = c.is_others ? '' :
      (c.starts_on && c.starts_on !== batch.starts_on ? '<span class="nx-pill warn" title="This aged care starts on a different day from the rest of the batch">Starts ' + esc(btDate(c.starts_on).replace(/ 20\d\d$/, '')) + '</span>' : '') +
      '<span class="nx-pill ' + (c.docs_sent_on ? 'ok' : '') + '">Docs ' + (c.docs_sent_on ? 'sent' : 'not sent') + '</span>' +
      '<span class="nx-pill ' + (c.info_sent_on ? 'ok' : '') + '">Info ' + (c.info_sent_on ? 'sent' : 'not sent') + '</span>' +
      (c.logbook ? '<span class="nx-pill ' + (c.logbook === 'sent' ? 'ok' : (c.logbook === 'scheduled' ? 'info' : 'warn')) + '">Logbook ' + esc(c.logbook.replace('_', ' ')) + '</span>' : '');
    return '<button type="button" class="nx-bcard' + (c.is_others ? ' others' : '') + '" data-bf="' + c.id + '">' +
      '<span class="nx-bcard-h"><b>' + esc(btCardName(c)) + '</b>' + (c.is_others ? '<small>Students who found their own aged care</small>' : (((c.nex_facilities || {}).suburb) ? '<small>' + esc(c.nex_facilities.suburb) + '</small>' : '')) + '</span>' +
      '<span class="nx-bq">' + chips + (ppAskedFor(batch, c, asked).length ? '<span>' + ppAskedFor(batch, c, asked).length + ' asked for this</span>' : '') + '</span>' + (chk ? '<span class="nx-bchk">' + chk + '</span>' : '') +
      (c.orientation_note ? '<small class="nx-muted">' + esc(c.orientation_note.slice(0, 80)) + '</small>' : '') + '</button>';
  }).join('') + '</div>' : '<div class="nx-card-b">' + empty('No aged cares in this batch yet', 'Add the aged cares taking students this week, with their AM / PM / Night quota.') + '</div>';
  body.innerHTML = head + grid;
  $('#btPick').onchange = e => { BT.id = e.target.value; btRefresh(); };
  $('#btNew').onclick = () => batchNew(batches);
  $('#btAdd').onclick = () => batchCardNew(batch, cards);
  $('#btEdit').onclick = () => formModal('Edit batch', [{ k: 'name', label: 'Name (optional)', value: batch.name, full: true }, { k: 'note', label: 'Note', type: 'textarea', value: batch.note, full: true }], async v => { await upd('nex_batches', 'id=eq.' + batch.id, v); toast('Saved'); btRefresh(); });
  if ($('#btOthers')) $('#btOthers').onclick = async () => { try { await ins('nex_batch_facilities', { batch_id: batch.id, is_others: true }, true); btRefresh(); } catch (e) { toast(e.message, true); } };
  $$('.nx-bcard', body).forEach(b => b.onclick = () => batchCardOpen(batch, cards.find(c => c.id === b.dataset.bf)));
}

async function batchNew(known) {
  const batches = known || await sel('nex_batches', 'select=*&order=starts_on.desc&limit=80');
  const used = new Set(batches.map(b => b.starts_on));
  let d = sydToday(); while (used.has(d)) d = btAddDays(d, 1);
  const f = [{ k: 'starts_on', label: 'Starts on', type: 'date', value: d, required: true }, { k: 'name', label: 'Name (optional)', placeholder: 'e.g. November intake' }];
  if (batches.length) f.push({ k: 'copy', label: 'Copy the aged cares and quotas from an earlier batch', type: 'check', value: true, full: true, help: 'Quotas change every batch, so you can edit each card afterwards. Start dates, students and checklists are not copied.' },
    { k: 'copy_from', label: 'Copy from', type: 'select', options: batches.map(b => ({ id: b.id, label: btDate(b.starts_on) + (b.name ? ' · ' + b.name : '') })), value: batches[0].id, full: true });
  f.push({ k: 'note', label: 'Note', type: 'textarea', full: true });
  formModal('New batch', f, async v => {
    if (used.has(v.starts_on)) throw new Error('There is already a batch starting that day.');
    const row = await ins('nex_batches', { starts_on: v.starts_on, name: v.name, note: v.note });   /* copy / copy_from are not columns */
    if (v.copy && batches.length) {
      const src = batches.find(b => b.id === v.copy_from) || batches.find(b => b.starts_on < v.starts_on) || batches[0];
      const old = await sel('nex_batch_facilities', 'select=facility_id,is_others,quota_am,quota_pm,quota_night,orientation_note,shift_note&batch_id=eq.' + src.id + '&limit=500');
      if (old.length) await ins('nex_batch_facilities', old.map(o => Object.assign({ batch_id: row.id }, o)), true);
    }
    BT.id = row.id; toast('Batch created'); render();
  });
}

async function batchCardNew(batch, cards) {
  const have = new Set(cards.map(c => c.facility_id)), fac = (await facilityOptions()).filter(x => !have.has(x.id));
  if (!fac.length) { toast('No more aged cares to add. Add new ones on the Facilities tab first.', true); return; }
  formModal('Add an aged care to this batch', [
    { k: 'facility_id', label: 'Aged care', type: 'select', options: fac, blank: 'Choose one', required: true, full: true },
    { k: 'quota_am', label: 'AM places', type: 'number', value: 0 }, { k: 'quota_pm', label: 'PM places', type: 'number', value: 0 }, { k: 'quota_night', label: 'Night places', type: 'number', value: 0 },
    { k: 'orientation_note', label: 'Orientation', placeholder: 'e.g. Orientation 9-5', full: true },
    { k: 'shift_note', label: 'Shift times', placeholder: 'e.g. AM 7-3, PM 2-10', full: true }
  ], async v => {
    for (const k of ['quota_am', 'quota_pm', 'quota_night']) v[k] = Math.max(0, Math.round(v[k] || 0));
    await ins('nex_batch_facilities', Object.assign({ batch_id: batch.id }, v), true); toast('Added'); btRefresh();
  });
}

async function batchCardOpen(batch, card) {
  if (!card) return;
  let places = [];
  const loadPlaces = async () => { places = await sel('nex_placements', 'select=*,nex_enrolments(student_id,nex_students(id,first_name,last_name))&batch_facility_id=eq.' + card.id + '&order=created_at.asc&limit=500'); };
  await loadPlaces();
  let asked = card.is_others ? [] : ppAskedFor(batch, card, await ppAskedRows(batch));      /* students who asked for this aged care around this date */
  const F = card.is_others ? [{ k: 'note', label: 'Note', type: 'textarea', value: card.note, full: true }] : [
    { k: 'starts_on', label: 'Starts on', type: 'date', value: card.starts_on || batch.starts_on, help: 'Starts with the batch (' + btDate(batch.starts_on) + ') unless you change it, for example when this aged care starts after a holiday. Students on this card move with it.' },
    { k: 'quota_am', label: 'AM places', type: 'number', value: card.quota_am }, { k: 'quota_pm', label: 'PM places', type: 'number', value: card.quota_pm }, { k: 'quota_night', label: 'Night places', type: 'number', value: card.quota_night },
    { k: 'orientation_note', label: 'Orientation', value: card.orientation_note, full: true }, { k: 'shift_note', label: 'Shift times', value: card.shift_note, full: true },
    { k: 'docs_sent_on', label: 'Documents sent to the aged care on', type: 'date', value: card.docs_sent_on }, { k: 'info_sent_on', label: 'Information sent to students on', type: 'date', value: card.info_sent_on },
    { k: 'logbook', label: 'Logbook', type: 'select', options: BT_LOGBOOK, value: card.logbook, blank: 'Not set' },
    { k: 'note', label: 'Note', type: 'textarea', value: card.note, full: true }];
  const m = openModal({
    title: btCardName(card) + ' · ' + btDate(btStart(batch, card)), wide: true,
    body: '<div class="nx-form">' + F.map(f => fieldHtml(f, 'bc')).join('') + '</div><hr class="nx-hr"><div id="bcStu"></div>' +
      (ME.admin ? '<div style="margin-top:14px"><button type="button" class="nx-btn sm" id="bcDel">Remove this card from the batch</button></div>' : ''),
    buttons: [{ label: 'Close', close: true }, { label: 'Save details', primary: true, run: async mm => {
      const v = readFields(F, mm.el, 'bc');
      for (const k of ['quota_am', 'quota_pm', 'quota_night']) if (k in v) v[k] = Math.max(0, Math.round(v[k] || 0));
      if ('starts_on' in v) v.starts_on = v.starts_on && v.starts_on !== batch.starts_on ? v.starts_on : null;   /* the batch's own date is stored as "no own date" */
      Object.assign(card, await upd('nex_batch_facilities', 'id=eq.' + card.id, v)); toast('Saved'); await loadPlaces(); draw(); btRefresh(); return false;
    } }]
  });
  const draw = () => {
    const box = $('#bcStu', m.el); if (!box) return;
    const live = places.filter(btLive), gone = places.filter(p => !btLive(p));
    const line = card.is_others ? '' : '<div class="nx-muted" style="margin:2px 0 8px">' + BT_SHIFTS.map(([k, l]) => l + ' ' + live.filter(p => p.shift === k).length + ' of ' + (card['quota_' + k] || 0)).join(' · ') + '</div>';
    const row = p => { const s = btStudent(p); return '<li><div>' + (s ? '<a href="#/students/' + s.id + '"><b>' + esc(fullName(s)) + '</b></a>' : '–') + ' <span class="nx-pill info">' + esc(BT_SHIFT_L[p.shift] || '') + '</span>' +
      '<small>' + esc([card.is_others ? p.facility_text : '', statusLabel('placement_stage', p.status), p.start_date && p.start_date !== btStart(batch, card) ? 'Starts ' + btDate(p.start_date) : '', p.note].filter(Boolean).join(' · ')) + '</small></div>' +
      '<span class="nx-btnrow"><button class="nx-btn sm" data-ed="' + p.id + '">Edit</button>' + (btLive(p) ? '<button class="nx-btn sm" data-wd="' + p.id + '">Withdraw</button>' : '') + '</span></li>'; };
    box.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px"><h3 style="font-size:15px;margin:0">Students (' + live.length + ')</h3><button type="button" class="nx-btn sm primary" id="bcAdd">' + ico('plus') + 'Add student</button></div>' + line +
      (live.length ? '<ul class="nx-list">' + live.map(row).join('') + '</ul>' : '<div class="nx-help">Nobody is placed here yet.</div>') +
      (asked.length ? '<h3 style="font-size:15px;margin:16px 0 4px">Asked for this aged care (' + asked.length + ')</h3><div class="nx-help">They asked for this aged care around this date. Pick a shift and add them.</div><ul class="nx-list">' + asked.map(r => '<li><div><b>' + esc(fullName(r)) + '</b> ' + (r.placement_docs_missing > 0 ? '<span class="nx-pill bad">Missing ' + r.placement_docs_missing + ' documents</span>' : (r.paid_ok ? '<span class="nx-pill ok">Ready</span>' : '<span class="nx-pill bad">Needs more payment</span>')) + ' ' + ppPills(r) + '<small>' + esc([r.want_start ? 'Wants ' + fmtDate(r.want_start) : '', ppShiftText(r), r.want_note].filter(Boolean).join(' · ')) + '</small></div><span class="nx-btnrow"><select class="nx-sel sm" data-ashift="' + r.enrolment_id + '" aria-label="Shift">' + BT_SHIFTS.map(([k, l]) => '<option value="' + k + '"' + (((r.pref_shifts || [])[0] || 'am') === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select><button type="button" class="nx-btn sm primary" data-aadd="' + r.enrolment_id + '">Add</button></span></li>').join('') + '</ul>' : '') +
      (gone.length ? '<details style="margin-top:10px"><summary class="nx-muted">Withdrawn or closed (' + gone.length + ')</summary><ul class="nx-list">' + gone.map(row).join('') + '</ul></details>' : '');
    $('#bcAdd', box).onclick = () => batchAddStudent(batch, card, places, async () => { await loadPlaces(); draw(); btRefresh(); });
    $$('[data-aadd]', box).forEach(b => b.onclick = async () => {
      const r = asked.find(x => x.enrolment_id === b.dataset.aadd); if (!r) return; b.disabled = true;
      if (await ppPlace(batch, card, r, $('[data-ashift="' + r.enrolment_id + '"]', box).value)) { asked = asked.filter(x => x !== r); await loadPlaces(); draw(); btRefresh(); } else b.disabled = false;
    });
    $$('[data-ed]', box).forEach(b => b.onclick = () => placementEdit(places.find(x => x.id === b.dataset.ed), card, async () => { await loadPlaces(); draw(); btRefresh(); }));
    $$('[data-wd]', box).forEach(b => b.onclick = async () => {
      const p = places.find(x => x.id === b.dataset.wd), s = btStudent(p);
      if (!await confirmBox('Withdraw from this batch', (s ? fullName(s) : 'This student') + ' will be marked withdrawn and their place is freed.', 'Withdraw', true)) return;
      try { await upd('nex_placements', 'id=eq.' + p.id, { status: 'withdrawn' }); await loadPlaces(); draw(); btRefresh(); } catch (e) { toast(e.message, true); }
    });
  };
  draw();
  if ($('#bcDel', m.el)) $('#bcDel', m.el).onclick = async () => {
    if (places.length) { toast('This card has placement history, so it cannot be removed. Set its places to 0 instead.', true); return; }
    if (!await confirmBox('Remove from batch', 'Remove ' + btCardName(card) + ' from this batch?', 'Remove', true)) return;
    try { await del('nex_batch_facilities', 'id=eq.' + card.id); m.close(); toast('Removed'); btRefresh(); } catch (e) { toast(e.message, true); }
  };
}

function placementEdit(p, card, done) {
  if (!p) return;
  const f = [{ k: 'shift', label: 'Shift', type: 'select', options: BT_SHIFTS.map(([id, label]) => ({ id, label })), value: p.shift, required: true },
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
