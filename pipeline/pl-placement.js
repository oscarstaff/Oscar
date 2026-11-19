'use strict';
/* pl-placement.js · YatraLine · Placement requests, placements, facilities, blacklist.
   One of the YatraLine files loaded by nex.html (list and order: PL_FILES in the loader). All of them share one global scope. */
/* =========================================================
   Placement, Follow-ups, Admin
   ========================================================= */
const PL = { tab: 'batches', status: '', q: '', page: 0, size: 50, fview: 'list' };

route(/^\/placement$/, async () => {
  afterRender(() => bindPlacement());
  const seg = [['ready', 'Ready'], ['batches', 'Batches'], ['requests', 'Requests'], ['placements', 'Started placement'], ['hold', 'On hold'], ['facilities', 'Facilities'], ['blacklist', 'Blacklist']];
  return pageHead('pin', 'Ready students, batches and placements', 'Placement', '<button class="nx-btn primary" id="plAdd">' + ico('plus') + '<span id="plAddL">New request</span></button>') +
    '<div class="nx-card"><div class="nx-toolbar" style="border-top:0"><div class="nx-seg" id="plSeg">' + seg.map(([k, l]) => '<button data-v="' + k + '" aria-pressed="' + (PL.tab === k) + '">' + l + '</button>').join('') + '</div><select class="nx-sel sm" id="plStatus"></select><input class="nx-in sm" id="plQ" style="min-width:220px" placeholder="Search" value="' + esc(PL.q) + '"></div><div id="plBody"></div><div class="nx-foot" id="plFoot"><span></span></div></div>';
});

function bindPlacement() {
  const body = $('#plBody');
  const labels = { batches: '', requests: 'New request', facilities: 'New facility', blacklist: 'Add to blacklist' };
  const load = async () => {
    const bt = PL.tab === 'batches' || PL.tab === 'ready' || PL.tab === 'hold';     /* these three draw their own toolbar */
    $('#plAdd').hidden = bt || PL.tab === 'placements'; $('#plQ').hidden = bt; $('#plFoot').hidden = bt;
    if (!bt) $('#plAddL').textContent = labels[PL.tab];
    const sf = $('#plStatus'); sf.hidden = !(PL.tab === 'requests' || PL.tab === 'placements');
    if (!sf.hidden) sf.innerHTML = selectOpts(opts(PL.tab === 'requests' ? 'placement' : 'placement_stage', true), PL.status, 'Any status');
    holdBody(body);
    try {
      if (PL.tab === 'ready') { await renderReady(body); return; }
      if (PL.tab === 'hold') { await renderHold(body); return; }
      if (bt) { await renderBatches(body); return; }
      const q = safeQ(PL.q), from = PL.page * PL.size, to = from + PL.size - 1; let rows, total, html;
      if (PL.tab === 'requests') {
        let query = 'select=*,nex_facilities(name),nex_enrolments(student_id,nex_students(id,first_name,last_name))&order=created_at.desc'; if (PL.status) query += '&status=eq.' + PL.status; if (q) query += '&facility_text=ilike.*' + q + '*';
        ({ rows, total } = await selPage('nex_placement_requests', query, from, to));
        html = rows.length ? '<div class="nx-tablewrap"><table class="nx-table tight"><thead><tr><th>Student</th><th>Facility</th><th>Type</th><th>Emailed</th><th>Status</th><th>Note</th><th></th></tr></thead><tbody>' + rows.map(r => { const s = (r.nex_enrolments || {}).nex_students; return '<tr><td>' + (s ? '<a href="#/students/' + s.id + '"><b>' + esc(fullName(s)) + '</b></a>' : '–') + '</td><td>' + esc((r.nex_facilities || {}).name || r.facility_text || '–') + '</td><td>' + (r.self_placement ? '<span class="nx-tag walk">Self placement</span>' : '<span class="nx-tag">Arranged</span>') + (safeUrl(r.form_url) ? ' <a href="' + esc(safeUrl(r.form_url)) + '" target="_blank" rel="noopener noreferrer">Form</a>' : '') + '</td><td>' + esc(fmtDate(r.emailed_on) || '–') + '</td><td>' + pill('placement', r.status) + '</td><td class="nx-muted">' + esc((r.note || '').slice(0, 60)) + '</td><td><button class="nx-btn sm" data-ed="' + r.id + '">Update</button></td></tr>'; }).join('') + '</tbody></table></div>' : empty('No placement requests');
        body._rows = rows; $$('[data-ed]', body).forEach(b => b.onclick = () => requestForm(rows.find(x => x.id === b.dataset.ed)));
      } else if (PL.tab === 'placements') {
        let query = 'select=*,nex_facilities(name),nex_enrolments(student_id,nex_students(id,first_name,last_name))&order=start_date.desc.nullslast,created_at.desc'; if (PL.status) query += '&status=eq.' + PL.status; if (q) query += '&facility_text=ilike.*' + q + '*';
        ({ rows, total } = await selPage('nex_placements', query, from, to));
        html = rows.length ? '<div class="nx-card-b nx-muted" style="padding-top:6px">Students are placed from the Batches tab, inside each aged care card. This list follows them once they are placed: update dates, hours and status here.</div><div class="nx-tablewrap"><table class="nx-table tight"><thead><tr><th>Student</th><th>Facility</th><th>Starts</th><th>Ends</th><th>Hours</th><th>Status</th><th></th></tr></thead><tbody>' + rows.map(r => { const s = (r.nex_enrolments || {}).nex_students; return '<tr><td>' + (s ? '<a href="#/students/' + s.id + '"><b>' + esc(fullName(s)) + '</b></a>' : '–') + '</td><td>' + esc((r.nex_facilities || {}).name || r.facility_text || '–') + '</td><td>' + esc(fmtDate(r.start_date) || '–') + '</td><td>' + esc(fmtDate(r.end_date) || '–') + '</td><td class="nx-num">' + esc(r.hours || '–') + '</td><td>' + pill('placement_stage', r.status) + '</td><td><button class="nx-btn sm" data-ed="' + r.id + '">Update</button></td></tr>'; }).join('') + '</tbody></table></div>' : empty('Nobody placed yet', 'Students are placed from a Batch: open an aged care card and add them there. They appear here once placed.');
        $$('[data-ed]', body).forEach(b => b.onclick = () => placementForm(rows.find(x => x.id === b.dataset.ed)));
      } else if (PL.tab === 'facilities') {
        const map = PL.fview === 'map';
        let query = 'select=*&order=name.asc'; if (q) query += '&name=ilike.*' + q + '*';
        if (map) query += '&limit=1000';
        if (map) { rows = await sel('nex_facilities', query); total = rows.length; } else ({ rows, total } = await selPage('nex_facilities', query, from, to));
        const bar = '<div class="nx-card-b" style="padding-bottom:0"><div class="nx-seg" id="plFv"><button data-v="list" aria-pressed="' + !map + '">List</button><button data-v="map" aria-pressed="' + map + '">Map</button></div></div>';
        html = map ? bar + '<div id="plMapHost"></div>' : rows.length ? bar + '<div class="nx-tablewrap"><table class="nx-table tight"><thead><tr><th>Facility</th><th>Suburb</th><th>Contact</th><th>Phone</th><th>Email</th><th></th></tr></thead><tbody>' + rows.map(r => '<tr><td><b>' + esc(r.name) + '</b></td><td>' + esc(r.suburb || '–') + '</td><td>' + esc(r.contact_name || '–') + '</td><td>' + esc(r.phone || '–') + '</td><td>' + esc(r.email || '–') + '</td><td><button class="nx-btn sm" data-ed="' + r.id + '">Edit</button></td></tr>').join('') + '</tbody></table></div>' : bar + empty('No facilities', 'Add the homes you place students with.');
        body.innerHTML = html;
        $$('#plFv button', body).forEach(b => b.onclick = () => { PL.fview = b.dataset.v; PL.page = 0; load(); });
        if (map) { $('#plFoot').hidden = true; plDrawFacilityMap($('#plMapHost', body), rows, facilityForm); }
        $$('[data-ed]', body).forEach(b => b.onclick = () => facilityForm(rows.find(x => x.id === b.dataset.ed)));
      } else {
        let query = 'select=*,nex_facilities(name)&order=added_at.desc'; if (q) query += '&or=(student_name.ilike.*' + q + '*,facility_text.ilike.*' + q + '*)';
        ({ rows, total } = await selPage('nex_blacklist', query, from, to));
        html = rows.length ? '<div class="nx-tablewrap"><table class="nx-table tight"><thead><tr><th>Student or facility</th><th>Where allocated</th><th>Reason</th><th>Added</th><th></th></tr></thead><tbody>' + rows.map(r => '<tr><td><b>' + esc(r.student_name || (r.nex_facilities || {}).name || r.facility_text || '–') + '</b><div class="nx-muted" style="font-size:12px">' + esc(r.email || '') + '</div></td><td>' + esc(r.allocated_at || '–') + '</td><td>' + esc(r.reason || '–') + '</td><td>' + esc(fmtDate(r.added_at)) + '<div class="nx-muted" style="font-size:12px">' + esc(r.added_by || '') + '</div></td><td>' + (ME.admin ? '<button class="nx-btn sm" data-rm="' + r.id + '">Remove</button>' : '') + '</td></tr>').join('') + '</tbody></table></div>' : empty('Blacklist is empty');
        body.innerHTML = html; $$('[data-rm]', body).forEach(b => b.onclick = async () => { if (await confirmBox('Remove from blacklist', 'Remove this entry?', 'Remove', true)) { try { await del('nex_blacklist', 'id=eq.' + b.dataset.rm); toast('Removed'); load(); } catch (e) { toast(e.message, true); } } });
      }
      if (PL.tab !== 'blacklist' && PL.tab !== 'facilities') body.innerHTML = html;   /* those two put their own markup in (facilities has to: the map is drawn into it) */
      if (PL.tab === 'blacklist') { /* already set */ }
      const fromN = total ? from + 1 : 0, toN = from + rows.length;
      $('#plFoot').innerHTML = '<span>' + (total != null ? (total ? fromN + '–' + toN + ' of ' + total.toLocaleString('en-AU') : '') : rows.length + ' shown') + '</span><span class="nx-btnrow"><button class="nx-btn sm" id="plPrev"' + (PL.page ? '' : ' disabled') + '>Previous</button><button class="nx-btn sm" id="plNext"' + (total != null && toN >= total ? ' disabled' : '') + '>Next</button></span>';
      $('#plPrev').onclick = () => { PL.page--; load(); }; $('#plNext').onclick = () => { PL.page++; load(); };
      if (PL.tab === 'facilities' && PL.fview === 'map') $('#plFoot').hidden = true;
    } catch (e) { body.innerHTML = empty('Could not load', e.message); }
  };
  $$('#plSeg button').forEach(b => b.onclick = () => { PL.tab = b.dataset.v; PL.page = 0; PL.status = ''; $$('#plSeg button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); load(); });
  $('#plStatus').onchange = e => { PL.status = e.target.value; PL.page = 0; load(); };
  let t = 0; $('#plQ').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { PL.q = e.target.value; PL.page = 0; load(); }, 300); });
  $('#plAdd').onclick = () => {
    if (PL.tab === 'requests') return pickEnrolment('New placement request', (en, st) => requestForm(null, en, st));
    if (PL.tab === 'facilities') return facilityForm(null);
    return blacklistForm();
  };
  viewWait(load());
}

function pickEnrolment(title, cb) {
  pickStudent(title, async st => {
    const en = await sel('nex_enrolments', 'select=*&student_id=eq.' + st.id + '&deleted_at=is.null&order=enrolled_on.desc.nullslast');
    if (!en.length) { toast(fullName(st) + ' has no enrolment yet. Add one on their record first.', true); return; }
    if (en.length === 1) return cb(en[0], st);
    const m = openModal({ title: 'Which enrolment?', footer: false, body: '<div class="nx-sel-opt">' + en.map(e => '<button type="button" class="nx-pick" data-id="' + e.id + '"><span><b>' + esc(qualName(e.qualification_id) || 'Enrolment') + '</b><small>' + esc(e.year || '') + ' · ' + esc(statusLabel('enrolment', e.stage)) + '</small></span><span class="nx-tag">Choose</span></button>').join('') + '</div>' });
    $$('.nx-pick', m.el).forEach(b => b.onclick = () => { m.close(); cb(en.find(x => x.id === b.dataset.id), st); });
  });
}
async function facilityOptions() { const f = await sel('nex_facilities', 'select=id,name&active=eq.true&order=name&limit=1000'); return f.map(x => ({ id: x.id, label: x.name })); }

async function requestForm(r, en, st) {
  r = r || {};
  if (!r.id && en && !await ppGate(await ppLoad(en.student_id), st ? fullName(st) : '', {})) return;   /* shows the team's flags (hold, English, irregular availability) before a request is sent */
  const fac = await facilityOptions();
  const f = [{ k: 'facility_id', label: 'Facility', type: 'select', options: fac, value: r.facility_id, blank: 'Type a name instead', full: true }, { k: 'facility_text', label: 'Facility name (if not in the list)', value: r.facility_text, full: true },
    { k: 'self_placement', label: 'Self placement (student found it)', type: 'check', value: r.self_placement }, { k: 'form_url', label: 'Self-sought form response (link)', type: 'url', value: r.form_url, placeholder: 'https://', full: true },
    { k: 'emailed_on', label: 'Email sent on', type: 'date', value: r.emailed_on, help: 'Recorded only. YatraLine does not send the email.' },
    { k: 'status', label: 'Status', type: 'select', options: opts('placement', true), value: r.status || 'request_sent', blank: 'Not set' }, { k: 'note', label: 'Note', type: 'textarea', value: r.note, full: true }];
  formModal(r.id ? 'Update placement request' : 'New placement request', f, async v => {
    if (r.id) await upd('nex_placement_requests', 'id=eq.' + r.id, v); else await ins('nex_placement_requests', Object.assign({ enrolment_id: en.id, created_by: ME.name }, v), true);
    toast('Saved'); render();
  });
}
async function placementForm(p, en, st) {
  p = p || {};
  if (!p.id && en && !await ppGate(await ppLoad(en.student_id), st ? fullName(st) : '', {})) return;
  const fac = await facilityOptions();
  const f = [{ k: 'facility_id', label: 'Facility', type: 'select', options: fac, value: p.facility_id, blank: 'Type a name instead', full: true }, { k: 'facility_text', label: 'Facility name (if not in the list)', value: p.facility_text, full: true },
    { k: 'start_date', label: 'Start date', type: 'date', value: p.start_date }, { k: 'end_date', label: 'End date', type: 'date', value: p.end_date }, { k: 'hours', label: 'Hours', type: 'number', value: p.hours },
    { k: 'status', label: 'Stage', type: 'select', options: opts('placement_stage', true), value: p.status, blank: 'Not set' }, { k: 'note', label: 'Note', type: 'textarea', value: p.note, full: true }];
  formModal(p.id ? 'Update placement' : 'New placement', f, async v => {
    if (p.id) await upd('nex_placements', 'id=eq.' + p.id, v); else await ins('nex_placements', Object.assign({ enrolment_id: en.id, created_by: ME.name }, v), true);
    toast('Saved'); render();
  });
}
function facilityForm(r) {
  r = r || {};
  formModal(r.id ? 'Edit facility' : 'New facility', [{ k: 'name', label: 'Name', value: r.name, required: true, full: true }, { k: 'address', label: 'Address', value: r.address, full: true }, { k: 'suburb', label: 'Suburb', value: r.suburb },
    { k: 'pin', label: 'Map pin', value: r.lat != null ? r.lat + ', ' + r.lng : '', placeholder: '-33.8688, 151.2093', help: 'Latitude, longitude. In Google Maps, right-click the building and click the numbers at the top of the menu to copy them. Leave empty for no pin.' },
    { k: 'contact_name', label: 'Contact person', value: r.contact_name }, { k: 'phone', label: 'Phone', type: 'tel', value: r.phone }, { k: 'email', label: 'Email', type: 'email', value: r.email },
    { k: 'active', label: 'Still placing students here', type: 'check', value: r.id ? r.active : true }, { k: 'notes', label: 'Notes', type: 'textarea', value: r.notes, full: true }], async v => {
    const pin = v.pin; delete v.pin;   /* "lat, lng" text -> the lat, lng and geo_exact columns; only touched when the box was changed */
    if ((pin || '') !== (r.lat != null ? r.lat + ', ' + r.lng : '')) {
      if (pin == null) { v.lat = null; v.lng = null; v.geo_exact = false; }
      else { const p = plParsePin(pin); if (!p) { const err = new Error('Map pin must be two numbers in Australia, like -33.8688, 151.2093.'); err.fieldEl = $('#f_pin'); throw err; } v.lat = p[0]; v.lng = p[1]; v.geo_exact = true; }
    }
    if (r.id) await upd('nex_facilities', 'id=eq.' + r.id, v); else await ins('nex_facilities', v, true);
    toast('Saved'); render();
  });
}
function blacklistForm() {
  let studentId = null;
  const m = formModal('Add to blacklist', [{ k: 'student_name', label: 'Student name', required: true }, { k: 'email', label: 'Email', type: 'email' }, { k: 'allocated_at', label: 'Where they were allocated', full: true }, { k: 'reason', label: 'Reason', type: 'textarea', required: true, full: true }], async v => {
    await ins('nex_blacklist', Object.assign({ student_id: studentId, added_by: ME.name }, v), true); toast('Added'); render();
  }, 'Add', '<div style="margin-bottom:14px"><button type="button" class="nx-btn" id="blFind">' + ico('search') + 'Find an existing student</button></div>');
  $('#blFind', m.el).onclick = () => pickStudent('Find a student', s => { studentId = s.id; $('#f_student_name', m.el).value = fullName(s); $('#f_email', m.el).value = s.email || ''; });
}

/* ---------- "Send placement documents email" box on the Overview ----------
   Evershine sets Placement plan = Yes on a class booking; that student appears here for the Placement team to review.
   Untick anyone to hold them back, Skip to take them off for good, then Send. The email goes from the placement mailbox
   (edge function nex-send-placement-docs). Each send is recorded in nex_placement_doc_mail, so nobody is emailed twice by accident. */
async function placementMailLoad() {
  if (!(ME.admin || teamIs('Placement'))) return [];
  const bk = await sel('nex_class_bookings', 'select=id,name,email,student_id,created_at,nex_class_sessions(class_date),nex_students(first_name,last_name,email)&placement_plan=eq.yes&order=created_at.desc&limit=200');
  if (!bk.length) return [];
  const done = new Set((await sel('nex_placement_doc_mail', 'select=booking_id&booking_id=in.' + inList(bk.map(b => b.id)))).map(x => x.booking_id));
  return bk.filter(b => !done.has(b.id));
}
function placementMailCard(rows) {
  if (!rows || !rows.length) return '';
  const one = x => Array.isArray(x) ? x[0] : x;
  return '<div class="nx-card" id="pmBox"><div class="nx-card-h"><h3>Send placement documents email</h3><span class="nx-muted">' + rows.length + (rows.length === 1 ? ' student' : ' students') + ' set to Placement plan: Yes</span></div>' +
    '<div class="nx-card-b nx-muted" style="padding-bottom:6px">From the placement mailbox. Review and send to everyone, or untick anyone you are not ready to send to. Skip takes someone off the list.</div><ul class="nx-list">' +
    rows.map(b => { const st = one(b.nex_students), ses = one(b.nex_class_sessions), to = (b.email || (st && st.email) || '').trim(), nm = st ? fullName(st) : (b.name || '(no name)');
      return '<li><span><b>' + esc(nm) + '</b><small class="nx-muted" style="display:block">' + esc([ses && ses.class_date ? 'Class ' + fmtDate(ses.class_date) : '', to || 'No email address'].filter(Boolean).join(' · ')) + '</small></span>' +
        '<button type="button" class="nx-btn sm" data-pmskip="' + b.id + '">Skip</button></li>'; }).join('') +
    '</ul><div class="nx-card-b nx-btnrow"><button type="button" class="nx-btn primary" id="pmSend">' + ico('mail') + 'Review and send</button></div></div>';
}
function bindPlacementMail(rows) {
  const box = $('#pmBox'); if (!box) return;
  const one = x => Array.isArray(x) ? x[0] : x;
  $$('[data-pmskip]', box).forEach(btn => btn.onclick = async () => {
    const b = rows.find(x => x.id === btn.dataset.pmskip); if (!b) return;
    if (!await confirmBox('Skip this email', 'Take this student off the list without emailing them? You can still email them from their record later.', 'Skip')) return;
    try {
      await api('nex_placement_doc_mail?on_conflict=booking_id', { method: 'POST', body: { booking_id: b.id, student_id: b.student_id || null, to_email: b.email || null, status: 'skipped' }, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
      toast('Skipped'); render();
    } catch (e) { toast(e.message, true); }
  });
  $('#pmSend', box).onclick = () => mailDialog({ title: 'Send placement documents email', fn: 'nex-send-placement-docs', htmlPreview: true, empty: 'Nobody is waiting for this email.', onDone: () => render(),
    load: async () => rows.map(b => { const st = one(b.nex_students), ses = one(b.nex_class_sessions), to = (b.email || (st && st.email) || '').trim();
      return { id: b.id, name: st ? fullName(st) : (b.name || '(no name)'), sub: [ses && ses.class_date ? 'Class ' + fmtDate(ses.class_date) : '', to].filter(Boolean).join(' · '), off: !to, offNote: 'No email address' }; }) });
}
