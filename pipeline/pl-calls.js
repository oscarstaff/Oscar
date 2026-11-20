'use strict';
/* pl-calls.js · YatraLine · Call Log (copied from Nexus).
   One of the YatraLine files loaded by nex.html (list and order: PL_FILES in the loader). All of them share one global scope. */
/* ---------- Calls: the Nexus Call Log, copied into YatraLine ----------
   Logging a call for someone already in YatraLine adds it to their Activity. A number YatraLine has never seen starts an UNFINISHED lead,
   flagged to whoever logged the call. All of that happens in the database function nex_log_call, so it is one step.
   The "clocked in and inside office hours" lock is a convenience on this page only. The database does not enforce it. */
const CL = { view: 'wait', scope: 'team', q: '', today: false, rows: [], teams: null, gate: null };
const CL_DAYS = 60, CL_EDIT_MIN = 15, CL_MAX_WORDS = 8;

/* Australian numbers only. Same rule as the Nexus call log: +61 + nine digits, typed as 04xx, 4xx, 61 4xx or +61 4xx. */
function callE164(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.startsWith('61') && d.length >= 11) d = d.slice(2);
  if (d.length === 9 && d[0] !== '0') d = '0' + d;
  return /^0\d{9}$/.test(d) ? '+61' + d.slice(1) : null;
}
function callLocal(e) { return e && /^\+61\d{9}$/.test(e) ? '0' + e.slice(3) : (e || ''); }
function callPhoneFmt(e) { const l = callLocal(e); return /^0[2-9]\d{8}$/.test(l) ? (l[1] === '4' ? l.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3') : l.replace(/(\d{2})(\d{4})(\d{4})/, '$1 $2 $3')) : l; }
function callWords(t) { return String(t || '').trim().split(/\s+/).filter(Boolean); }
const callIsPlc = t => /^placement$/i.test(String(t || '').trim());

/* office hours in Sydney: Mon to Fri 9:00 to 19:00, Sat and Sun 9:00 to 16:00 */
function callOpenNow(now) {
  const p = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now || new Date());
  const g = t => (p.find(x => x.type === t) || {}).value || '';
  const wd = g('weekday').slice(0, 3), mins = (Number(g('hour')) % 24) * 60 + Number(g('minute'));
  const weekend = wd === 'Sat' || wd === 'Sun';
  return mins >= 9 * 60 && mins < (weekend ? 16 : 19) * 60;
}
async function callGate() {
  if (ME.admin) return { ok: true, admin: true };
  if (!callOpenNow()) return { ok: false, why: 'Calls are logged between 9:00 am and 7:00 pm on weekdays, and 9:00 am to 4:00 pm on weekends (Sydney time).' };
  try {
    const r = await sel('clock_log', 'select=action,ts&staff_name=eq.' + encodeURIComponent(ME.name) + '&order=ts.desc&limit=1');
    if (!r.length || r[0].action !== 'in') return { ok: false, why: 'Clock in on Nexus first, then you can log calls here.' };
  } catch (e) { return { ok: true, unsure: true }; }   /* if the clock cannot be read, do not block the work */
  return { ok: true };
}

async function callTeams() {
  if (CL.teams) return CL.teams;
  try { const r = await sel('staff_credentials', 'select=team'); CL.teams = Array.from(new Set((r || []).map(x => x.team).filter(Boolean))).sort(); }
  catch (e) { CL.teams = []; }
  return CL.teams;
}
async function callLoad() {
  const since = new Date(Date.now() - CL_DAYS * 86400000).toISOString();
  CL.rows = await sel('call_log', 'select=*&deleted_at=is.null&created_at=gte.' + encodeURIComponent(since) + '&order=created_at.desc&limit=600');
}
function callMyTeam() { return STAFF.team || ''; }
function callVisible() {
  const my = callMyTeam().toLowerCase(), q = CL.q.trim().toLowerCase(), today = sydToday();
  return CL.rows.filter(r => {
    if (CL.view === 'wait' && r.resolved_at) return false;
    if (CL.view === 'done' && !r.resolved_at) return false;
    if (CL.scope === 'mine' && r.logged_by !== ME.name) return false;
    if (CL.scope === 'team' && my && String(r.for_team || r.team || '').toLowerCase() !== my) return false;
    if (CL.today && new Date(r.created_at).toLocaleDateString('en-CA', { timeZone: TZ }) !== today) return false;
    if (q && ![r.caller_name, r.phone_e164, callLocal(r.phone_e164), r.reason, r.note, r.logged_by, r.for_team].join(' ').toLowerCase().includes(q)) return false;
    return true;
  });
}
function callCanEdit(r) { return r.logged_by === ME.name && Date.now() - new Date(r.created_at).getTime() < CL_EDIT_MIN * 60000; }

function callTable() {
  const rows = callVisible();
  if (!rows.length) return empty(CL.view === 'wait' ? 'Nobody is waiting for a call back' : 'No calls to show', 'Change the tabs or the search above to see more. Calls from the last ' + CL_DAYS + ' days are loaded.');
  return '<div class="nx-tablewrap"><table class="nx-table tight nx-calltable"><thead><tr><th>When</th><th>Caller</th><th>Reason</th><th>For</th><th>Logged by</th><th></th></tr></thead><tbody>' + rows.map(r => {
    const who = r.student_id ? '<a href="#/students/' + esc(r.student_id) + '">' + esc(r.caller_name || 'Open record') + '</a>' : esc(r.caller_name || '–');
    const acts = [];
    if (!r.resolved_at) acts.push('<button class="nx-btn sm primary" data-cb="' + esc(r.id) + '">' + ico('phone') + 'Called back</button>');
    if (callCanEdit(r)) acts.push('<button class="nx-btn sm" data-ce="' + esc(r.id) + '">' + ico('edit') + 'Edit</button>');
    if (ME.admin) acts.push('<button class="nx-btn sm quiet" data-cd="' + esc(r.id) + '" aria-label="Delete this call">' + ico('trash') + '</button>');
    return '<tr><td class="nx-nowrap">' + esc(fmtDT(r.created_at)) + '</td>' +
      '<td><div class="nx-who"><div><b>' + who + '</b><span>' + esc(callPhoneFmt(r.phone_e164) || 'No number') + '</span></div></div></td>' +
      '<td><span class="nx-dirtag">' + (r.direction === 'out' ? 'Out' : 'In') + '</span> ' + esc(r.reason) + (r.note ? '<div class="nx-muted nx-callnote">' + esc(r.note) + '</div>' : '') + (r.plc_offered ? '<div class="nx-muted">PLC offered' + (r.plc_remarks ? ': ' + esc(r.plc_remarks) : '') + '</div>' : '') + '</td>' +
      '<td>' + esc(r.for_team || r.team || '–') + '</td>' +
      '<td>' + esc(r.logged_by || '–') + '<div class="nx-muted">' + (r.resolved_at ? 'Done · ' + esc(r.resolved_by || '') : '<span class="nx-pill warn">Waiting</span>') + '</div></td>' +
      '<td><div class="nx-btnrow">' + acts.join('') + '</div></td></tr>';
  }).join('') + '</tbody></table></div>';
}
function callCounts() {
  const w = CL.rows.filter(r => !r.resolved_at).length;
  return { wait: w, done: CL.rows.length - w, all: CL.rows.length };
}

route(/^\/calls$/, async () => {
  await loadMe();
  const teams = await callTeams();
  CL.gate = await callGate();
  try { await callLoad(); } catch (e) { CL.rows = []; }
  afterRender(() => {
    const root = $('#clPage'); if (!root) return;
    const f = $('#clForm', root), phone = $('#clPhone'), name = $('#clName'), email = $('#clEmail'), reason = $('#clReason'), note = $('#clNote');
    const forTeam = $('#clFor'), plcBox = $('#clPlc'), notStu = $('#clNotStu'), save = $('#clSave'), cnt = $('#clWords');
    const lk = identityLookup({ el: f }, { ids: { phone: 'clPhone', name: 'clName', email: 'clEmail' }, newMsg: 'Not in YatraLine yet. Logging this will start an unfinished lead flagged to you.' });
    const sync = () => {
      const plc = callIsPlc(forTeam.value);
      plcBox.hidden = !plc;
      $('#clPhoneReq').textContent = plc ? '' : ' *';
      f.classList.toggle('nostu', notStu.checked);
      const n = callWords(reason.value).length;
      cnt.textContent = n + ' of ' + CL_MAX_WORDS + ' words' + (n > CL_MAX_WORDS ? '. The rest goes into the note.' : '');
      cnt.classList.toggle('over', n > CL_MAX_WORDS);
    };
    [forTeam, notStu, reason].forEach(e => { e.addEventListener('input', sync); e.addEventListener('change', sync); });
    sync();
    const reloadTable = async () => { try { await callLoad(); } catch (e) { toast(e.message, true); } paint(); };
    const paint = () => {
      const c = callCounts();
      $$('#clSeg button').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.v === CL.view)); const n = $('.nx-count', b); if (n) n.textContent = c[b.dataset.v]; });
      $('#clTable').innerHTML = callTable();
      bindRows();
    };
    const bindRows = () => {
      $$('[data-cb]').forEach(b => b.onclick = () => calledBack(CL.rows.find(r => String(r.id) === b.dataset.cb)));
      $$('[data-ce]').forEach(b => b.onclick = () => editCall(CL.rows.find(r => String(r.id) === b.dataset.ce)));
      $$('[data-cd]').forEach(b => b.onclick = () => deleteCall(CL.rows.find(r => String(r.id) === b.dataset.cd)));
    };
    const calledBack = r => {
      if (!r) return;
      const m = openModal({ title: 'Called back', body: '<p class="nx-muted" style="margin-top:0">' + esc(r.caller_name || '') + ' · ' + esc(callPhoneFmt(r.phone_e164)) + ' · ' + esc(r.reason) + '</p><label class="nx-lbl" for="cbNote">What happened? (optional)</label><textarea class="nx-ta" id="cbNote" placeholder="Spoke to them, sent the form"></textarea>', noFocus: false,
        buttons: [{ label: 'Cancel', close: true }, { label: 'Mark as called back', primary: true, run: async mm => {
          const n = $('#cbNote', mm.el).value.trim() || null, now = new Date().toISOString();
          await upd('call_log', 'id=eq.' + encodeURIComponent(r.id), { resolved_at: now, resolved_by: ME.name });
          await ins('call_log', { caller_name: r.caller_name, phone_e164: r.phone_e164, reason: 'Callback', note: n, logged_by: ME.name, direction: 'out', team: callMyTeam() || r.team, for_team: r.for_team, resolved_at: now, resolved_by: ME.name, student_id: r.student_id || null }, true);
          toast('Marked as called back'); await reloadTable();
        } }] });
      return m;
    };
    const editCall = r => {
      if (!r) return;
      if (!callCanEdit(r)) { toast('You can only change your own call in the first ' + CL_EDIT_MIN + ' minutes.', true); return; }
      openModal({ title: 'Edit call', body: '<div class="nx-form"><div class="full"><label class="nx-lbl" for="ecName">Caller name</label><input class="nx-in" id="ecName" value="' + esc(r.caller_name || '') + '"></div><div class="full"><label class="nx-lbl" for="ecReason">Reason (up to ' + CL_MAX_WORDS + ' words)</label><input class="nx-in" id="ecReason" value="' + esc(r.reason || '') + '"></div><div class="full"><label class="nx-lbl" for="ecNote">Note</label><textarea class="nx-ta" id="ecNote">' + esc(r.note || '') + '</textarea></div></div>',
        buttons: [{ label: 'Cancel', close: true }, { label: 'Save', primary: true, run: async mm => {
          const nm = $('#ecName', mm.el).value.trim(), ws = callWords($('#ecReason', mm.el).value);
          if (!nm) throw new Error('Caller name is required.');
          if (!ws.length) throw new Error('Reason is required.');
          if (ws.length > CL_MAX_WORDS) throw new Error('Keep the reason to ' + CL_MAX_WORDS + ' words. Put the rest in the note.');
          await upd('call_log', 'id=eq.' + encodeURIComponent(r.id), { caller_name: nm, reason: ws.join(' '), note: $('#ecNote', mm.el).value.trim() || null, edited_at: new Date().toISOString() });
          toast('Call updated'); await reloadTable();
        } }] });
    };
    const deleteCall = async r => {
      if (!r || !ME.admin) return;
      if (!(await confirmBox('Delete this call?', 'It is hidden from the queue and from the person’s Activity. An admin can still see it in the database.', 'Delete', true))) return;
      await upd('call_log', 'id=eq.' + encodeURIComponent(r.id), { deleted_at: new Date().toISOString(), deleted_by: ME.name });
      toast('Call deleted'); await reloadTable();
    };

    f.onsubmit = async e => {
      e.preventDefault();
      if (save.disabled) return;
      try {
        const g = await callGate(); CL.gate = g;
        if (!g.ok) { $('#clLock').textContent = g.why; $('#clLock').hidden = false; throw new Error(g.why); }
        const plc = callIsPlc(forTeam.value), raw = phone.value.trim(), e164 = raw ? callE164(raw) : null;
        const nm = name.value.trim(), ws = callWords(reason.value), em = email.value.trim();
        if (raw && !e164) { phone.setAttribute('aria-invalid', 'true'); phone.focus(); throw new Error('Phone must be an Australian number, like 0412 345 678.'); }
        if (!e164 && !plc) { phone.setAttribute('aria-invalid', 'true'); phone.focus(); throw new Error('Phone number is required (only Placement calls can go without one).'); }
        phone.removeAttribute('aria-invalid');
        if (!nm) { name.focus(); throw new Error('Caller name is required.'); }
        if (!ws.length) { reason.focus(); throw new Error('Reason is required.'); }
        if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { email.focus(); throw new Error('That email does not look right.'); }
        const rest = ws.slice(CL_MAX_WORDS).join(' ');
        const noteTxt = [rest, note.value.trim()].filter(Boolean).join(' · ') || null;
        const body = { p_name: nm, p_phone: e164, p_reason: ws.slice(0, CL_MAX_WORDS).join(' '), p_note: noteTxt, p_direction: $('#clDir').value, p_for_team: forTeam.value || null, p_callback: $('#clCb').checked,
          p_plc_offered: plc ? $('#clPlcOffered').checked : false, p_plc_remarks: plc ? ($('#clPlcRemarks').value.trim() || null) : null, p_student: lk.get() ? lk.get().id : null, p_email: em || null, p_make_lead: !notStu.checked };
        save.disabled = true; save.classList.add('busy');
        const r = await api('rpc/nex_log_call', { method: 'POST', body });
        const j = await r.json();
        const who = lk.get() ? fullName(lk.get()) : nm;
        let msg;
        if (j && j.created_student) msg = 'Call logged. New unfinished lead started for ' + nm + ', flagged to you.';
        else if (j && j.student_id) msg = 'Call logged and added to ' + who + '’s activity.';
        else msg = 'Call logged.';
        if (j && j.cleared) msg += ' ' + j.cleared + ' earlier call' + (j.cleared === 1 ? '' : 's') + ' from this number cleared.';
        toast(msg);
        f.reset(); lk.clear(); sync();
        await reloadTable();
      } catch (err) { toast(err.message || 'Could not log the call.', true); }
      finally { save.disabled = !(CL.gate && CL.gate.ok); save.classList.remove('busy'); }
    };

    $$('#clSeg button').forEach(b => b.onclick = () => { CL.view = b.dataset.v; paint(); });
    $('#clScope').onchange = e => { CL.scope = e.target.value; paint(); };
    $('#clSearch').oninput = e => { CL.q = e.target.value; paint(); };
    $('#clToday').onchange = e => { CL.today = e.target.checked; paint(); };
    $('#clRefresh').onclick = reloadTable;
    paint();
  });

  const c = callCounts(), g = CL.gate || { ok: true }, my = callMyTeam();
  const teamOpts = ['<option value=""' + (my ? '' : ' selected') + '>Not sure</option>'].concat(teams.map(t => '<option' + (t.toLowerCase() === my.toLowerCase() ? ' selected' : '') + '>' + esc(t) + '</option>')).join('');
  return pageHead('phone', 'Staff', 'Calls', '') +
    '<div id="clPage">' +
    '<div class="nx-card"><div class="nx-card-h"><div><h3>Log a call</h3><div class="nx-muted">Someone already in YatraLine gets the call on their Activity. A new number starts an unfinished lead flagged to you.</div></div></div><div class="nx-card-b">' +
    '<div class="nx-note nx-calllock" id="clLock"' + (g.ok ? ' hidden' : '') + ' role="status">' + esc(g.ok ? '' : g.why) + '</div>' +
    '<form id="clForm" class="nx-callform" novalidate><fieldset class="nx-fs" ' + (g.ok ? '' : 'disabled') + '><div class="nx-form">' +
    '<div><label class="nx-lbl" for="clName">Caller name *</label><input class="nx-in" id="clName" autocomplete="off"></div>' +
    '<div><label class="nx-lbl" for="clPhone">Phone<span id="clPhoneReq"> *</span></label><input class="nx-in" id="clPhone" type="tel" inputmode="tel" autocomplete="off" placeholder="0412 345 678"></div>' +
    '<div><label class="nx-lbl" for="clEmail">Email</label><input class="nx-in" id="clEmail" type="email" autocomplete="off" placeholder="Optional"></div>' +
    '<div class="full">' + idBoxHtml('') + '</div>' +
    '<div><label class="nx-lbl" for="clDir">Direction</label><select class="nx-sel" id="clDir"><option value="in">Incoming</option><option value="out">Outgoing</option></select></div>' +
    '<div class="full"><label class="nx-lbl" for="clReason">Reason *</label><input class="nx-in" id="clReason" autocomplete="off" placeholder="Wants to book first aid class"><div class="nx-help" id="clWords" aria-live="polite"></div></div>' +
    '<div><label class="nx-lbl" for="clFor">For team</label><select class="nx-sel" id="clFor">' + teamOpts + '</select></div>' +
    '<div><label class="nx-lbl" for="clNote">Note</label><input class="nx-in" id="clNote" autocomplete="off" placeholder="Optional"></div>' +
    '<div class="full" id="clPlc" hidden><div class="nx-form"><div><label class="nx-check"><input type="checkbox" id="clPlcOffered"> PLC offered</label></div><div><label class="nx-lbl" for="clPlcRemarks">PLC remarks</label><input class="nx-in" id="clPlcRemarks"></div></div></div>' +
    '<div class="full nx-callchecks"><label class="nx-check"><input type="checkbox" id="clCb"> Needs a call back</label><label class="nx-check"><input type="checkbox" id="clNotStu"> Not a student (agent, facility or other). Do not start a lead.</label></div>' +
    '</div><div class="nx-btnrow" style="margin-top:14px"><button class="nx-btn primary" id="clSave" type="submit"' + (g.ok ? '' : ' disabled') + '>' + ico('phone') + 'Log call</button></div></fieldset></form></div></div>' +
    '<div class="nx-card"><div class="nx-toolbar" style="border-top:0"><div class="nx-seg" id="clSeg" role="group" aria-label="Show">' + [['wait', 'Waiting'], ['done', 'Handled'], ['all', 'All']].map(([v, l]) => '<button type="button" data-v="' + v + '" aria-pressed="' + (CL.view === v) + '">' + l + ' <span class="nx-count">' + c[v] + '</span></button>').join('') + '</div>' +
    '<select class="nx-sel sm" id="clScope" aria-label="Whose calls"><option value="team"' + (CL.scope === 'team' ? ' selected' : '') + '>' + (my ? esc(my) + ' team' : 'My team') + '</option><option value="all"' + (CL.scope === 'all' ? ' selected' : '') + '>Everyone</option><option value="mine"' + (CL.scope === 'mine' ? ' selected' : '') + '>Only mine</option></select>' +
    '<input class="nx-in sm" id="clSearch" type="search" placeholder="Search name, number, reason" aria-label="Search calls" value="' + esc(CL.q) + '"><label class="nx-check"><input type="checkbox" id="clToday"' + (CL.today ? ' checked' : '') + '> Today</label><span class="nx-grow"></span><button class="nx-btn sm" id="clRefresh" type="button">' + ico('refresh') + 'Refresh</button></div>' +
    '<div id="clTable"></div></div></div>';
});
