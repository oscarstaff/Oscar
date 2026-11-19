'use strict';
/* pl-ui.js · YatraLine · reference lists, status pill, toast / modal / form kit, student picker, existing-person lookup.
   One of the YatraLine files loaded by nex.html (list and order: PL_FILES in the loader). All of them share one global scope. */
/* ---------- reference data cache ---------- */
const REF = { status: {}, quals: [], agents: [], staff: [], loaded: false };
async function loadRef(force) {
  if (REF.loaded && !force) return;
  const [st, q, a, s, dt, tr] = await Promise.all([
    sel('nex_status_options', 'select=*&order=context,position'),
    sel('nex_qualifications', 'select=*&order=position,name'),
    sel('nex_agents', 'select=*&order=name'),
    sel('staff_names', 'select=name&order=name').catch(() => []),
    sel('nex_doc_types', 'select=*&active=eq.true&order=group_key,position').catch(() => []),
    sel('nex_trainers', 'select=*&order=name').catch(() => [])
  ]);
  REF.status = {}; st.forEach(o => { (REF.status[o.context] = REF.status[o.context] || []).push(o); });
  REF.quals = q; REF.agents = a; REF.staff = s.map(x => x.name); REF.docTypes = dt; REF.trainers = tr; REF.loaded = true;
}
function opts(ctx, activeOnly) { return (REF.status[ctx] || []).filter(o => !activeOnly || o.active); }
function statusLabel(ctx, key) { const o = (REF.status[ctx] || []).find(x => x.key === key); return o ? o.label : (key || ''); }
function statusObj(ctx, key) { return (REF.status[ctx] || []).find(x => x.key === key || x.label === key); }
function qualName(id) { const q = REF.quals.find(x => x.id === id); return q ? q.name : ''; }
function qualShort(id) {
  const n = qualName(id); if (!n) return '';
  return n.replace(/^Certificate /, 'Cert ').replace(/ in /, ': ').replace(/\(Ageing\/Disability\)/, '').replace(/ with Medication/, ' + Med').trim();
}
function agentName(id) { const a = REF.agents.find(x => x.id === id); return a ? a.name : ''; }

/* ---------- status pill ---------- */
const TONE = {
  enrolment: { docs_completed: 'info', processed: 'accent', placement: 'accent', certificate_issued: 'ok', hold: 'warn', issue: 'bad', not_interested: '', incomplete_docs: 'warn', blended: 'info' },
  payment_queue: { instalment: 'info', done_plc: 'ok', confirmed_no_plc: 'ok', yes_plc: 'accent', yes_plc_less_payment: 'warn', less_payment: 'warn', no_docs: 'bad', not_found: 'bad', issues: 'bad', no_plc_issues: 'bad' },
  processing: { processed: 'ok', ready_to_process: 'accent', draft_made: 'info', draft_not_made: 'warn' },
  placement: { replied_granted: 'ok', replied_refused: 'bad', request_sent: 'info', replied_additional_docs: 'warn', withdrawn: '' },
  placement_stage: { started: 'ok', completed: 'ok', denied: 'bad', not_accommodated: 'bad', rejected: 'bad', withdrawn: '', cancelled: 'bad' },
  booking: { attended: 'ok', no_show: 'bad', rescheduled: 'warn', booked: 'accent', info_only: 'info', cancelled: '' }
};
function pill(ctx, key) {
  if (!key) return '<span class="nx-muted">–</span>';
  const t = (TONE[ctx] || {})[key] || '';
  return '<span class="nx-pill ' + t + '">' + esc(statusLabel(ctx, key)) + '</span>';
}
/* Stages a person can be moved to by hand.
   Leads (paid under $200) can be at Checklist sent or Docs completed (documents can come in before any payment), with Hold and Lost as ways out.
   Incomplete docs (payment sheet Issues) and Placement (booked into a batch) are set by the system, so they are only listed
   while a record is already on them. Retired stages stay listed only on records that still have them. */
const STAGE_LEAD_OK = new Set(['checklist_sent', 'docs_completed', 'hold', 'blended']);
const STAGE_AUTO = new Set(['incomplete_docs', 'placement']);
function stageOpts(isStudent, cur) {
  return opts('enrolment', false).filter(o => o.key === cur || (o.active && (isStudent ? !STAGE_AUTO.has(o.key) : STAGE_LEAD_OK.has(o.key))));
}
/* for the list filters: everything that can be searched on, retired stages marked */
function stageFilterOpts(kind) {
  return opts('enrolment', false).filter(o => o.active ? (kind !== 'lead' || STAGE_LEAD_OK.has(o.key)) : kind !== 'lead').map(o => o.active ? o : Object.assign({}, o, { label: o.label + ' (old)' }));
}
function selectOpts(list, cur, blank) {
  return (blank != null ? '<option value="">' + esc(blank) + '</option>' : '') +
    list.map(o => { const v = typeof o === 'string' ? o : (o.key != null ? o.key : o.id); const l = typeof o === 'string' ? o : (o.label || o.name); return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('');
}

/* ---------- toast + modal + form ---------- */
/* A toast is for good news only. An error is never a toast: toast(msg, true) is routed to showError(), which puts it inline in the open dialog
   or, when no dialog is open, in an error dialog. */
function toast(msg, bad) {
  if (bad) { showError(msg); return; }
  const el = document.createElement('div'); el.className = 'toast' + (bad ? ' bad' : ''); el.textContent = msg; if (bad) el.setAttribute('role', 'alert');
  $('#toasts').appendChild(el); const life = 2600; setTimeout(() => el.classList.add('out'), life - 200); setTimeout(() => el.remove(), life);
}
let modalStack = [];
function openModal(opt) {
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = '<div class="modal ' + (opt.wide ? 'wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(opt.title) + '"><div class="modal-h"><h3>' + esc(opt.title) + '</h3><button class="nx-btn icon quiet" data-x aria-label="Close">' + ico('x') + '</button></div><div class="modal-b">' + opt.body + '</div>' + (opt.footer === false ? '' : '<div class="modal-f"></div>') + '</div>';
  $('#modalRoot').appendChild(bg);
  const opener = document.activeElement;
  const m = { el: bg, close() { if (m.gone) return; m.gone = true; modalStack = modalStack.filter(x => x !== m); if (!modalStack.length) { const a = $('#app'); if (a) a.inert = false; } bg.classList.add('is-closing'); setTimeout(() => bg.remove(), 140); if (opener && opener.isConnected && typeof opener.focus === 'function') { try { opener.focus({ preventScroll: true }); } catch (e) {} } if (opt.onClose) opt.onClose(); } };
  modalStack.push(m);
  { const a = $('#app'); if (a) a.inert = true; }
  bg.addEventListener('mousedown', e => { if (e.target === bg) m.close(); });
  $('[data-x]', bg).onclick = () => m.close();
  const f = $('.modal-f', bg);
  if (f && opt.buttons) {
    opt.buttons.forEach(b => {
      const btn = document.createElement('button'); btn.className = 'nx-btn ' + (b.primary ? 'primary' : ''); btn.textContent = b.label;
      btn.onclick = async () => {
        if (b.close) return m.close();
        btn.disabled = true; btn.classList.add('busy');
        try { const keep = await b.run(m); if (keep !== false) { if (typeof RENDER_P !== 'undefined') await Promise.race([RENDER_P, new Promise(res => setTimeout(res, 2500))]); m.close(); } } catch (e) { showErr(m, e); } finally { btn.disabled = false; btn.classList.remove('busy'); }
      };
      f.appendChild(btn);
    });
  }
  setTimeout(() => { const i = $('input:not([type=hidden]),select,textarea', bg); if (i && !opt.noFocus) i.focus(); }, 30);
  return m;
}
function showErr(m, e) {
  const msg = e && e.message ? e.message : (typeof e === 'string' && e ? e : 'Something went wrong.');
  if (m.isError) { const p = $('.modal-b p', m.el); if (p) p.textContent = msg; return; }
  clearErr(m);
  const fld = e && (e.fieldEl || (e.field && $(e.field.charAt(0) === '#' ? e.field : '#f_' + e.field, m.el)));
  if (fld) {
    /* a problem with one field: say it right under that field and put the cursor there */
    fld.setAttribute('aria-invalid', 'true');
    const b = document.createElement('div'); b.className = 'nx-ferr'; b.setAttribute('role', 'alert'); b.textContent = msg;
    fld.insertAdjacentElement('afterend', b);
    fld.addEventListener('input', () => clearErr(m), { once: true });
    try { fld.focus({ preventScroll: true }); } catch (x) {} try { b.scrollIntoView({ block: 'nearest' }); } catch (x) {}
    return;
  }
  const b = document.createElement('div'); b.className = 'nx-err'; b.setAttribute('role', 'alert'); b.textContent = msg; $('.modal-b', m.el).appendChild(b);
  try { b.scrollIntoView({ block: 'nearest' }); } catch (x) {}
}
function clearErr(m) {
  $$('.nx-err,.nx-ferr', m.el).forEach(x => x.remove());
  $$('[aria-invalid]', m.el).forEach(x => x.removeAttribute('aria-invalid'));
}
/* An error that belongs to one field: showErr() shows it under that field. key = the field's k in a form, or '#id' for any other field. */
function fieldError(key, msg) { const e = new Error(msg); e.field = key; return e; }
/* The one way to show an error. Inside an open dialog it goes inline in that dialog; with no dialog open it opens an error dialog. */
function showError(e, title) {
  const msg = e && e.message ? e.message : (typeof e === 'string' && e ? e : 'Something went wrong.');
  const top = modalStack[modalStack.length - 1];
  if (top && !top.gone) { showErr(top, e && e.message ? e : new Error(msg)); return top; }
  return errorModal(msg, title);
}
function errorModal(msg, title) {
  const m = openModal({ title: title || 'Something went wrong', body: '<p style="margin:0" role="alert">' + esc(msg) + '</p>', noFocus: true, buttons: [{ label: 'OK', primary: true, close: true }] });
  m.isError = true; setTimeout(() => { const ok = $('.modal-f .nx-btn', m.el); if (ok) ok.focus(); }, 30);
  return m;
}
document.addEventListener('keydown', e => {
  if (!modalStack.length) return;
  const top = modalStack[modalStack.length - 1];
  if (e.key === 'Escape') { top.close(); return; }
  if (e.key !== 'Tab') return;
  const f = [...top.el.querySelectorAll('a[href],button:not([disabled]),input:not([type=hidden]):not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(x => x.offsetParent !== null);
  if (!f.length) { e.preventDefault(); return; }
  const first = f[0], last = f[f.length - 1], at = document.activeElement;
  if (!top.el.contains(at)) { e.preventDefault(); first.focus(); }
  else if (e.shiftKey && at === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
});
function confirmBox(title, msg, okLabel, danger) {
  return new Promise(res => {
    let done = false;
    openModal({ title, body: '<p style="margin:0">' + esc(msg) + '</p>', noFocus: true, onClose() { if (!done) res(false); },
      buttons: [{ label: 'Cancel', close: true }, { label: okLabel || 'OK', primary: true, run: () => { done = true; res(true); } }] });
  });
}
/* ---------- Email dialog: one person or many ----------
   Opens at once at a fixed size (nothing resizes or stacks on top of it), loads the list and the mailbox's remaining sends in the
   background, previews inline, and sends with progress shown in place. A few emails go out at the same time, so a bulk send is not one slow wait.
   cfg: { title, fn: edge function name, load: async () => [{ id, name, sub, off, offNote, sentNote }], onDone, empty }
   The function is called as { booking_id, preview }, { booking_id, force } and { quota: true }. */
function mailDialog(cfg) {
  let didSend = false, sending = false, rows = [], quota = null, quotaErr = '';
  const picked = new Set(), previews = {};
  const m = openModal({ title: cfg.title, wide: true, noFocus: true, onClose() { if (didSend && cfg.onDone) cfg.onDone(); },
    body: '<div class="nx-md"><div class="nx-md-top nx-muted" data-md="top">Loading…</div><ul class="nx-list nx-md-list" data-md="list"></ul><div class="nx-md-prev' + (cfg.htmlPreview ? ' nx-md-html' : '') + '" data-md="prev"><span class="nx-muted">Press Preview next to a name to read the email.</span></div></div>' });
  const q = k => $('[data-md="' + k + '"]', m.el);
  const foot = $('.modal-f', m.el);
  const cancel = document.createElement('button'); cancel.className = 'nx-btn'; cancel.textContent = 'Cancel'; cancel.onclick = () => m.close();
  const go = document.createElement('button'); go.className = 'nx-btn primary'; go.textContent = 'Send'; go.disabled = true;
  foot.appendChild(cancel); foot.appendChild(go);
  const live = () => !m.gone && q('top');
  function chip(id, text, tone, title) { const c = $('[data-st="' + id + '"]', m.el); if (c) { c.className = 'nx-pill ' + (tone || ''); c.textContent = text; c.title = title || ''; c.hidden = !text; } }
  function top() {
    if (!live()) return;
    const n = picked.size;
    let t = rows.length ? n + ' of ' + rows.length + ' selected' : '';
    let warn = false;
    if (quotaErr) { t += (t ? ' · ' : '') + quotaErr; warn = true; }
    else if (typeof quota === 'number') { t += (t ? ' · ' : '') + 'The mailbox can send ' + quota + ' more email' + (quota === 1 ? '' : 's') + ' today'; if (n > quota) { t += '. Untick ' + (n - quota) + ' to send the rest tomorrow'; warn = true; } }
    q('top').textContent = t || 'Nothing to send.'; q('top').classList.toggle('nx-neg', warn);
    go.textContent = n ? 'Send to ' + n : 'Send'; go.disabled = sending || !n || (typeof quota === 'number' && n > quota) || !!quotaErr;
  }
  function draw() {
    if (!live()) return;
    q('list').innerHTML = rows.length ? rows.map(r => '<li><label class="nx-check"><input type="checkbox" data-pick="' + esc(r.id) + '"' + (picked.has(r.id) ? ' checked' : '') + (r.off ? ' disabled' : '') + '> <span><b>' + esc(r.name) + '</b><small data-sub="' + esc(r.id) + '">' + esc(r.off ? r.offNote || '' : r.sub || '') + (r.sentNote ? ' · ' + esc(r.sentNote) : '') + '</small></span></label><span class="nx-btnrow"><span class="nx-pill" data-st="' + esc(r.id) + '" hidden></span><button type="button" class="nx-btn sm quiet" data-pv="' + esc(r.id) + '">Preview</button></span></li>').join('')
      : '<li class="nx-muted">' + esc(cfg.empty || 'Nobody to email.') + '</li>';
    top();
  }
  q('list').addEventListener('change', e => { const c = e.target.closest('[data-pick]'); if (!c || sending) return; if (c.checked) picked.add(c.dataset.pick); else picked.delete(c.dataset.pick); top(); });
  q('list').addEventListener('click', async e => {
    const b = e.target.closest('[data-pv]'); if (!b) return;
    const id = b.dataset.pv, box = q('prev');
    box.textContent = 'Loading preview…';
    try {
      const pv = previews[id] || (previews[id] = await fn(cfg.fn, { booking_id: id, preview: true }));
      const files = pv.attachments || [];
      const head = '<div class="nx-muted nx-md-ph">To ' + esc(pv.to) + ' · ' + esc(pv.subject) + '</div>';
      const foot2 = '<div class="nx-muted nx-md-pf">' + (files.length ? 'Attached: ' + files.map(x => esc(x.file_name)).join(', ') : '<b>No file is attached.</b> A hub admin can add one in Admin.') + '</div>';
      if (pv.html) {
        /* the designed email, shown as the student will see it: a sandboxed frame (no scripts, no links followed) */
        box.innerHTML = head + '<iframe class="nx-md-frame" sandbox="" title="Email preview"></iframe>' + foot2;
        $('iframe', box).srcdoc = pv.html;
      } else {
        box.innerHTML = head.replace('nx-md-ph', 'nx-md-ph" style="margin-bottom:6px') + esc(pv.body) + foot2.replace('nx-md-pf', 'nx-md-pf" style="margin-top:10px');
      }
      box.scrollTop = 0;
    } catch (err) { box.textContent = err.message; }
  });
  async function run() {
    const ids = rows.filter(r => picked.has(r.id)).map(r => r.id); if (!ids.length) return;
    sending = true; go.disabled = true; cancel.disabled = true; $$('input[type=checkbox]', m.el).forEach(c => c.disabled = true);
    let next = 0, ok = 0, bad = 0, stop = '';
    const done = () => ok + bad;
    const tick = () => { if (live()) q('top').textContent = 'Sending ' + Math.min(done() + 1, ids.length) + ' of ' + ids.length + '…'; };
    tick();
    const worker = async () => {
      while (!stop) {
        const i = next++; if (i >= ids.length) return;
        const id = ids[i], row = rows.find(r => r.id === id); chip(id, 'Sending…', 'info');
        try { const r = await fn(cfg.fn, { booking_id: id, force: !!(row && row.sentNote) }); ok++; didSend = true; chip(id, 'Sent', 'ok'); if (typeof r.remaining === 'number') quota = r.remaining; }
        catch (err) {
          if (err.code === 'daily_limit' || err.code === 'not_configured') { stop = err.message; chip(id, 'Not sent', 'bad', err.message); }
          else { bad++; chip(id, 'Failed', 'bad', err.message); const sub = $('[data-sub="' + id + '"]', m.el); if (sub) { sub.textContent = err.message; sub.classList.add('nx-neg'); } }
        }
        tick();
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, ids.length) }, worker));
    ids.slice(Math.min(next, ids.length)).forEach(id => chip(id, 'Not sent', 'bad', stop));
    sending = false; cancel.disabled = false; cancel.textContent = 'Close'; go.hidden = true;
    const msg = (ok ? 'Sent ' + ok + (ok === 1 ? ' email' : ' emails') : 'Nothing was sent') + (bad ? ' · ' + bad + ' failed' : '') + (stop ? ' · ' + stop : '') + (typeof quota === 'number' ? ' · ' + quota + ' more can be sent today' : '');
    if (live()) { q('top').textContent = msg; q('top').classList.toggle('nx-neg', !!(bad || stop)); } else toast(msg, !!(bad || stop));
  }
  go.onclick = run;
  (async () => {
    try { rows = await cfg.load(); } catch (err) { if (live()) { q('top').textContent = err.message; q('top').classList.add('nx-neg'); } return; }
    rows.forEach(r => { if (!r.off && !r.sentNote) picked.add(r.id); });
    draw();
    try { const r = await fn(cfg.fn, { quota: true }); if (typeof r.remaining === 'number') quota = r.remaining; }
    catch (err) { if (err.code === 'not_configured') quotaErr = err.message; }
    top();
  })();
  return m;
}
/* field: {k,label,type:text|email|tel|date|number|select|textarea|check|time,options,value,full,help,required,placeholder} */
function fieldHtml(f, prefix) {
  const id = (prefix || 'f') + '_' + f.k, v = f.value == null ? '' : f.value;
  let c = '';
  if (f.type === 'help') return '<div class="full"><div class="nx-help" style="margin-top:-4px">' + esc(f.text) + '</div></div>';
  if (f.type === 'select') c = '<select class="nx-sel" id="' + id + '">' + selectOpts(f.options || [], v, f.blank != null ? f.blank : '') + '</select>';
  else if (f.type === 'textarea') c = '<textarea class="nx-ta" id="' + id + '" placeholder="' + esc(f.placeholder || '') + '">' + esc(v) + '</textarea>';
  else if (f.type === 'check') return '<div class="' + (f.full ? 'full' : '') + '"><label class="nx-check"><input type="checkbox" id="' + id + '"' + (v ? ' checked' : '') + '> ' + esc(f.label) + '</label>' + (f.help ? '<div class="nx-help">' + esc(f.help) + '</div>' : '') + '</div>';
  else c = '<input class="nx-in" id="' + id + '" type="' + (f.type || 'text') + '" value="' + esc(v) + '" placeholder="' + esc(f.placeholder || '') + '"' + (f.type === 'number' ? ' step="any"' : '') + (f.required ? ' aria-required="true"' : '') + '>';
  return '<div class="' + (f.full ? 'full' : '') + '"><label class="nx-lbl" for="' + id + '">' + esc(f.label) + (f.required ? ' *' : '') + '</label>' + c + (f.help ? '<div class="nx-help">' + esc(f.help) + '</div>' : '') + '</div>';
}
function readFields(fields, root, prefix) {
  const out = {};
  for (const f of fields) {
    const el = $('#' + (prefix || 'f') + '_' + f.k, root); if (!el) continue;
    let v = f.type === 'check' ? el.checked : el.value.trim();
    if (f.type === 'number') v = v === '' ? null : Number(v);
    else if (f.type !== 'check' && v === '') v = null;
    if (f.required && (v == null || v === '')) { const err = new Error(f.label + ' is required.'); err.fieldEl = el; throw err; }
    el.removeAttribute('aria-invalid');
    out[f.k] = v;
  }
  return out;
}
function formModal(title, fields, onSave, saveLabel, extraTop) {
  return openModal({
    title, body: (extraTop || '') + '<div class="nx-form">' + fields.map(f => fieldHtml(f)).join('') + '</div>',
    buttons: [{ label: 'Cancel', close: true }, { label: saveLabel || 'Save', primary: true, run: async m => { const v = readFields(fields, m.el); return onSave(v, m); } }]
  });
}

/* ---------- student picker (search the database) ---------- */
function pickStudent(title, onPick, initial) {
  const m = openModal({
    title: title || 'Find a student', footer: false,
    body: '<input class="nx-in" id="psq" placeholder="Name, email or phone (at least 2 letters)" autocomplete="off"><div class="nx-sel-opt" id="psr"><div class="nx-help">Start typing to search.</div></div>'
  });
  let timer = 0;
  const psq = $('#psq', m.el);
  const runSearch = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const q = safeQ(psq.value); const box = $('#psr', m.el);
      if (q.length < 2) { box.innerHTML = '<div class="nx-help">Start typing to search.</div>'; return; }
      box.innerHTML = '<div class="nx-help">Searching…</div>';
      try {
        const digits = cleanPhone(q);
        const parts = ['first_name.ilike.*' + q + '*', 'last_name.ilike.*' + q + '*', 'email.ilike.*' + q + '*'];
        if (digits.length >= 4) parts.push('phone.ilike.*' + digits + '*');
        const rows = await sel('nex_students', 'select=id,first_name,last_name,email,phone&deleted_at=is.null&or=(' + parts.join(',') + ')&order=first_name&limit=20');
        box.innerHTML = rows.length ? rows.map(s => '<button type="button" class="nx-pick" data-id="' + s.id + '"><span><b>' + esc(fullName(s)) + '</b><small>' + esc([s.email, fmtPhone(s.phone)].filter(Boolean).join(' · ') || 'No contact details') + '</small></span><span class="nx-tag">Choose</span></button>').join('') : '<div class="nx-help">No student found.</div>';
        $$('.nx-pick', box).forEach(b => b.onclick = () => { const s = rows.find(x => x.id === b.dataset.id); m.close(); onPick(s); });
      } catch (err) { box.innerHTML = '<div class="nx-err">' + esc(err.message) + '</div>'; }
    }, 250);
  };
  psq.addEventListener('input', runSearch);
  if (initial) { psq.value = initial; runSearch(); }
  return m;
}

/* ---------- existing-person lookup for add forms ----------
   Type a phone or email (or a name) in an add form. If that person is already in YatraLine their details fill in,
   the same way the call log does it, and the form saves against them instead of making a duplicate.
   cfg.ids maps first / last / name / phone / email to the field ids in the form; cfg.onChange(student|null) fires when the choice changes. */
function idBoxHtml(hint) { return '<div class="nx-idbox" aria-live="polite" data-hint="' + esc(hint || '') + '"></div>'; }
function identityLookup(m, cfg) {
  const root = m.el, box = $('.nx-idbox', root);
  const el = k => (cfg.ids[k] ? $('#' + cfg.ids[k], root) : null);
  const val = k => { const e = el(k); return e ? e.value.trim() : ''; };
  const put = (k, v, force) => { const e = el(k); if (e && v != null && v !== '' && (force || !e.value.trim())) e.value = v; };
  let chosen = null, timer = 0, token = 0; const refused = new Set();
  const keyOf = s => (s.phone || '') + '|' + (s.email || '');
  const show = html => { box.innerHTML = html; };
  const choose = (s, auto) => {
    chosen = s;
    put('first', s.first_name); put('last', s.last_name); put('name', fullName(s)); put('phone', s.phone); put('email', s.email);
    show('<div class="nx-idfound">' + ico('check') + '<span>' + (auto ? 'Already in YatraLine: ' : 'Using ') + '<b>' + esc(fullName(s)) + '</b>' + (s.phone || s.email ? ' · ' + esc([fmtPhone(s.phone), s.email].filter(Boolean).join(' · ')) : '') + '. Their details are filled in.</span><span class="nx-grow"></span><a href="#/students/' + s.id + '" target="_blank" rel="noopener">Open record</a><button type="button" class="nx-btn sm" data-notthem>Not them</button></div>');
    $('[data-notthem]', box).onclick = () => { refused.add(keyOf(s)); chosen = null; show(''); cfg.onChange && cfg.onChange(null); };
    cfg.onChange && cfg.onChange(s);
  };
  const run = async () => {
    const my = ++token;
    const phone = cleanPhone(val('phone')), email = val('email').toLowerCase();
    const nameTxt = cfg.ids.name ? val('name') : [val('first'), val('last')].filter(Boolean).join(' ');
    const goodPhone = phone.length >= 8, goodEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    if (chosen && ((goodPhone && (chosen.phone === phone || chosen.phone2 === phone)) || (goodEmail && chosen.email === email))) return;
    if (chosen) { chosen = null; show(''); cfg.onChange && cfg.onChange(null); }
    const F = 'select=id,first_name,last_name,email,phone,phone2&deleted_at=is.null';
    try {
      if (goodPhone || goodEmail) {
        const parts = []; if (goodEmail) parts.push('email.eq.' + encodeURIComponent(email)); if (goodPhone) parts.push('phone.eq.' + phone, 'phone2.eq.' + phone);
        const rows = (await sel('nex_students', F + '&or=(' + parts.join(',') + ')&limit=6')).filter(r => !refused.has(keyOf(r)));
        if (my !== token) return;
        if (rows.length === 1) return choose(rows[0], true);
        if (rows.length > 1) {
          show('<div class="nx-idpick"><div>More than one person has this phone or email. Who is it?</div>' + rows.map(r => '<button type="button" class="nx-pick" data-id="' + r.id + '"><span><b>' + esc(fullName(r)) + '</b><small>' + esc([fmtPhone(r.phone), r.email].filter(Boolean).join(' · ')) + '</small></span><span class="nx-btn sm">Use</span></button>').join('') + '</div>');
          $$('.nx-pick', box).forEach(b => b.onclick = () => choose(rows.find(x => x.id === b.dataset.id), false));
          return;
        }
      }
      const toks = safeQ(nameTxt).split(/\s+/).filter(t => t.length >= 2).slice(0, 2);
      if (nameTxt.length >= 3 && toks.length && !(goodPhone || goodEmail)) {
        const one = t => 'or(first_name.ilike.*' + encodeURIComponent(t) + '*,last_name.ilike.*' + encodeURIComponent(t) + '*)';
        const rows = await sel('nex_students', F + '&and=(' + toks.map(one).join(',') + ')&order=first_name&limit=5');
        if (my !== token) return;
        if (rows.length) {
          show('<div class="nx-idpick"><div>Already in YatraLine with a similar name. Tap to use their details.</div>' + rows.map(r => '<button type="button" class="nx-pick" data-id="' + r.id + '"><span><b>' + esc(fullName(r)) + '</b><small>' + esc([fmtPhone(r.phone), r.email].filter(Boolean).join(' · ') || 'No contact details') + '</small></span><span class="nx-btn sm">Use</span></button>').join('') + '</div>');
          $$('.nx-pick', box).forEach(b => b.onclick = () => choose(rows.find(x => x.id === b.dataset.id), false));
          return;
        }
      }
      show((goodPhone || goodEmail) ? '<div class="nx-idnew">' + esc(cfg.newMsg || 'Not in YatraLine yet. Saving will add a new person.') + '</div>' : (box.dataset.hint ? '<div class="nx-idnew">' + esc(box.dataset.hint) + '</div>' : ''));
    } catch (err) { if (my === token) show(''); }
  };
  const kick = () => { clearTimeout(timer); timer = setTimeout(run, 350); };
  ['first', 'last', 'name', 'phone', 'email'].forEach(k => { const e = el(k); if (e) { e.addEventListener('input', kick); e.addEventListener('change', kick); } });
  if (box.dataset.hint) show('<div class="nx-idnew">' + esc(box.dataset.hint) + '</div>');
  return { get: () => chosen, clear: () => { chosen = null; show(''); } };
}
