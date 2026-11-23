'use strict';
/* pl-admin.js · Yatra · Admin tab (status lists, qualifications, agents, audit).
   One of the Yatra files loaded by nex.html (list and order: PL_FILES in the loader). All of them share one global scope. */
/* ---------- Admin ---------- */
const AD = { ctx: 'enrolment' };
const CTX_NAMES = { enrolment: 'Enrolment stages', payment_queue: 'Payment queue statuses', placement_queue: 'Payment queue placement statuses', processing: 'Processing steps', placement: 'Placement request statuses', placement_stage: 'Placement stages', booking: 'First Aid booking statuses' };
route(/^\/admin$/, async () => {
  if (!ME.admin) { go('#/'); return null; }   /* Admin is for hub admins only */
  await loadRef(true);
  afterRender(() => bindAdmin());
  return pageHead('admin', 'Admin', 'Lists and settings', '') +
    '<div class="nx-card"><div class="nx-card-h"><div><h3>Status lists</h3><div class="nx-muted">Each list belongs to one part of Yatra, so the same word can mean different things in different places.' + (ME.admin ? '' : ' Only admins can change these.') + '</div></div>' + (ME.admin ? '<button class="nx-btn primary sm" id="adNewStatus">' + ico('plus') + 'Add status</button>' : '') + '</div><div class="nx-toolbar" style="border-top:0"><div class="nx-seg" id="adCtx">' + Object.keys(CTX_NAMES).map(k => '<button data-v="' + k + '" aria-pressed="' + (AD.ctx === k) + '">' + CTX_NAMES[k] + '</button>').join('') + '</div></div><div id="adStatus"></div></div>' +
    '<div class="nx-two"><div class="nx-card"><div class="nx-card-h"><h3>Qualifications</h3><button class="nx-btn primary sm" id="adNewQual">' + ico('plus') + 'Add</button></div><ul class="nx-list">' + REF.quals.map(q => '<li><span><b>' + esc(q.name) + '</b><small>' + esc(q.code) + (q.default_fee ? ' · usual fee ' + money(q.default_fee) : '') + (q.active ? '' : ' · hidden') + '</small></span><button class="nx-btn sm" data-q="' + q.id + '">Edit</button></li>').join('') + '</ul></div>' +
    '<div class="nx-card"><div class="nx-card-h"><h3>Agents</h3><button class="nx-btn primary sm" id="adNewAgent">' + ico('plus') + 'Add</button></div>' + (REF.agents.length ? '<ul class="nx-list">' + REF.agents.map(a => '<li><span><b>' + esc(a.name) + '</b><small>' + esc([a.phone, a.email].filter(Boolean).join(' · ') || 'No contact details') + (a.active ? '' : ' · hidden') + '</small></span><button class="nx-btn sm" data-ag="' + a.id + '">Edit</button></li>').join('') + '</ul>' : empty('No agents yet', 'Add the agents students come through.')) + '</div></div>' +
    '<div class="nx-card"><div class="nx-card-h"><div><h3>Trainers</h3><div class="nx-muted">The Class page picks the trainer from this list, so every class day (and the pay history built from it) uses the same spelling. Renaming a trainer here renames them on their class days too.</div></div><button class="nx-btn primary sm" id="adNewTrainer">' + ico('plus') + 'Add</button></div>' + (REF.trainers.length ? '<ul class="nx-list">' + REF.trainers.map(t => '<li><span><b>' + esc(t.name) + '</b>' + (t.active ? '' : '<small>Hidden from the dropdown. Past class days keep the name.</small>') + '</span><button class="nx-btn sm" data-tr="' + t.id + '">Edit</button></li>').join('') + '</ul>' : empty('No trainers yet', 'Add the trainers who run the classes.')) + '</div>' +
    secCard() + mailFilesCard('placement') + mailFilesCard('class') + '<div class="nx-card"><div class="nx-card-b"><b>Who can open Yatra</b><div class="nx-muted">Access is the Yatra card on the Nodes page. Admins give it to staff with the Yatra tick in ShiftOps, on each person’s edit panel.</div></div></div>' +
  (ME.admin ? '<div class="nx-card"><div class="nx-card-h"><div><h3>Who opened student records</h3><div class="nx-muted">The latest 100 times a staff member opened a student. A repeat look within 10 minutes is counted once. More than 150 different students in an hour (or 800 in a day) pauses a person’s access to personal details and shows here as Blocked. Only admins can see this.</div></div></div><div id="adViews"><div class="nx-card-b"><div class="nx-skel" style="width:60%"></div></div></div></div>' : '');
});
function bindAdmin() {
  const showStatus = () => {
    $$('#adCtx button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === AD.ctx)));
    const list = REF.status[AD.ctx] || [];
    /* every list gets the same column widths and the same height, so switching lists moves nothing (the cards below stay where they are) */
    const most = Math.max(0, ...Object.values(REF.status || {}).map(l => (l || []).length));
    $('#adStatus').style.minHeight = (40 + most * 44) + 'px';
    $('#adStatus').innerHTML = list.length ? '<div class="nx-tablewrap"><table class="nx-table auto tight fixed"><colgroup><col style="width:72px"><col style="width:27%"><col><col style="width:130px"><col style="width:96px"></colgroup><thead><tr><th>Order</th><th>Status</th><th>What it means</th><th>Closes the item</th><th></th></tr></thead><tbody>' + list.map(o => '<tr><td class="nx-num">' + o.position + '</td><td><b>' + esc(o.label) + '</b>' + (o.active ? '' : ' <span class="nx-tag">Hidden</span>') + '<div class="nx-muted" style="font-size:12px">' + esc(o.key) + '</div></td><td>' + (o.meaning ? esc(o.meaning) : '<span class="nx-muted">Not written yet</span>') + '</td><td>' + (o.is_closed ? 'Yes' : 'No') + '</td><td>' + (ME.admin ? '<button class="nx-btn sm" data-s="' + o.id + '">Edit</button>' : '') + '</td></tr>').join('') + '</tbody></table></div>' : empty('No statuses in this list');
    $$('[data-s]', $('#adStatus')).forEach(b => b.onclick = () => statusForm(list.find(x => x.id === b.dataset.s)));
  };
  $$('#adCtx button').forEach(b => b.onclick = () => { AD.ctx = b.dataset.v; showStatus(); });
  if ($('#adNewStatus')) $('#adNewStatus').onclick = () => statusForm(null);
  $('#adNewTrainer').onclick = () => trainerForm(null); $$('[data-tr]').forEach(b => b.onclick = () => trainerForm(REF.trainers.find(x => x.id === b.dataset.tr)));
  $('#adNewQual').onclick = () => qualForm(null); $('#adNewAgent').onclick = () => agentForm(null);
  $$('[data-q]').forEach(b => b.onclick = () => qualForm(REF.quals.find(x => x.id === b.dataset.q)));
  $$('[data-ag]').forEach(b => b.onclick = () => agentForm(REF.agents.find(x => x.id === b.dataset.ag)));
  showStatus(); bindSec(); bindMailFiles();
  if (ME.admin && $('#adViews')) {
    sel('nex_view_log', 'select=viewed_by,viewed_at,student_id,blocked,nex_students(first_name,last_name,student_no)&order=viewed_at.desc&limit=100').then(rows => {
      const box = $('#adViews'); if (!box) return;
      box.innerHTML = rows.length ? '<div class="nx-tablewrap"><table class="nx-table auto tight"><thead><tr><th>When</th><th>Staff member</th><th>Student</th></tr></thead><tbody>' + rows.map(r => '<tr><td>' + esc(fmtDT(r.viewed_at)) + '</td><td>' + esc(r.viewed_by) + (r.blocked ? ' <span class="nx-tag">Blocked: opened too many</span>' : '') + '</td><td>' + (r.nex_students ? '<a href="#/students/' + esc(r.student_id) + '">' + esc(fullName(r.nex_students)) + '</a>' : '<span class="nx-muted">Removed</span>') + '</td></tr>').join('') + '</tbody></table></div>' : empty('Nothing yet', 'Student record views will appear here.');
    }).catch(e => { const box = $('#adViews'); if (box) box.innerHTML = empty('Could not load', e.message); });
  }
}
/* ---------- Files attached to the emails sent from Yatra (placement documents; First Aid and CPR class confirmation) ---------- */
const MF_TYPES = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx' };
const MF_ONE = 5 * 1024 * 1024, MF_ALL = 10 * 1024 * 1024;
const MF_KINDS = {
  placement: { purpose: 'placement_docs', bucket: 'placement-files', dir: 'placement/', title: 'Placement email attachments', note: 'Attached to the “documents required before placement” email. Add the help guide once and it goes out with every email.', none: 'The email goes out with no attachment until you add one. It says “please check the attachment”, so add the help guide.' },
  class: { purpose: 'class_confirm', bucket: 'class-files', dir: 'class/', title: 'First Aid and CPR confirmation attachments', note: 'Attached to the class confirmation email. Add the quiz access guide (PDF) once and it goes out with every confirmation.', none: 'The email goes out with no attachment until you add one. It says “please check the attached PDF”, so add the quiz guide.' }
};
function mfSize(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
function mailFilesCard(kind) {
  const k = MF_KINDS[kind];
  return '<div class="nx-card"><div class="nx-card-h"><div><h3>' + k.title + '</h3><div class="nx-muted">' + k.note + ' PDF, Word, PNG or JPG, up to 5 MB each and 10 MB together.</div></div>' +
    '<button class="nx-btn primary sm" id="mfAdd_' + kind + '">' + ico('plus') + 'Add file</button><input type="file" id="mfFile_' + kind + '" hidden accept=".pdf,.docx,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"></div><div id="mfList_' + kind + '">' + '<div class="nx-muted" style="padding:16px">Loading…</div>' + '</div></div>';
}
async function mfShow(kind) {
  const k = MF_KINDS[kind], box = $('#mfList_' + kind); if (!box) return;
  try {
    const rows = await sel('nex_mail_attachments', 'select=*&purpose=eq.' + k.purpose + '&order=created_at');
    box.innerHTML = rows.length ? '<ul class="nx-list">' + rows.map(r => '<li><span><b>' + esc(r.file_name) + '</b><small>' + esc(mfSize(r.size_bytes)) + ' · added ' + esc(fmtDate(r.created_at)) + (r.created_by ? ' by ' + esc(r.created_by) : '') + '</small></span><button class="nx-btn sm quiet" data-mfdel="' + esc(r.id) + '">Remove</button></li>').join('') + '</ul>'
      : empty('No file attached', k.none);
    $$('[data-mfdel]', box).forEach(b => b.onclick = async () => {
      const r = rows.find(x => x.id === b.dataset.mfdel); if (!r) return;
      if (!await confirmBox('Remove ' + r.file_name + '?', 'Emails sent from now on will not include it. Emails already sent are not changed.', 'Remove', true)) return;
      try {
        const tok = await bearer();
        await del('nex_mail_attachments', 'id=eq.' + encodeURIComponent(r.id));
        fetch(SB + '/storage/v1/object/' + k.bucket + '/' + String(r.storage_path).split('/').map(encodeURIComponent).join('/'), { method: 'DELETE', headers: { apikey: KEY, Authorization: 'Bearer ' + tok } }).catch(() => {});
        toast('Removed'); mfShow(kind);
      } catch (e) { toast(e.message, true); }
    });
    box._rows = rows;
  } catch (e) { box.innerHTML = empty('Could not load', e.message); }
}
function bindMailFiles() { Object.keys(MF_KINDS).forEach(bindMailFilesOf); }
function bindMailFilesOf(kind) {
  const k = MF_KINDS[kind], add = $('#mfAdd_' + kind), inp = $('#mfFile_' + kind); if (!add || !inp) return;
  add.onclick = () => inp.click();
  inp.onchange = async () => {
    const f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
    const ext = MF_TYPES[f.type];
    if (!ext) return toast('That file type is not allowed. Use a PDF, Word file, PNG or JPG.', true);
    if (f.size > MF_ONE) return toast('That file is over 5 MB.', true);
    const have = ($('#mfList_' + kind) && $('#mfList_' + kind)._rows || []).reduce((t, r) => t + Number(r.size_bytes || 0), 0);
    if (have + f.size > MF_ALL) return toast('The attached files would be over 10 MB together. Remove one first.', true);
    add.disabled = true;
    const path = k.dir + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    try {
      const tok = await bearer();
      let up; try { up = await fetch(SB + '/storage/v1/object/' + k.bucket + '/' + path, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + tok, 'Content-Type': f.type }, body: f }); } catch (e) { throw offlineError(); }
      if (!up.ok) throw new Error('The file store refused it (' + up.status + ').');
      try { await ins('nex_mail_attachments', { purpose: k.purpose, file_name: f.name.replace(/[\r\n"<>\\/]+/g, '_').slice(0, 200), content_type: f.type, size_bytes: f.size, storage_path: path, created_by: ME.name }); }
      catch (e) { fetch(SB + '/storage/v1/object/' + k.bucket + '/' + path, { method: 'DELETE', headers: { apikey: KEY, Authorization: 'Bearer ' + tok } }).catch(() => {}); throw e; }
      toast('File added'); mfShow(kind);
    } catch (e) { toast(e.message, true); }
    add.disabled = false;
  };
  mfShow(kind);
}
function statusForm(o) {
  o = o || {};
  formModal(o.id ? 'Edit status' : 'Add status to ' + CTX_NAMES[AD.ctx], [{ k: 'label', label: 'Name', value: o.label, required: true }, { k: 'position', label: 'Order', type: 'number', value: o.position != null ? o.position : ((REF.status[AD.ctx] || []).length + 1) },
    { k: 'meaning', label: 'What it means', type: 'textarea', value: o.meaning, full: true, help: 'Written by the team that uses it.' }, { k: 'is_closed', label: 'This status closes the item', type: 'check', value: o.is_closed }, { k: 'active', label: 'Show in lists', type: 'check', value: o.id ? o.active : true }], async v => {
    if (o.id) await upd('nex_status_options', 'id=eq.' + o.id, v);
    else await ins('nex_status_options', Object.assign({ context: AD.ctx, key: v.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') }, v), true);
    toast('Saved'); await loadRef(true); render();
  });
}
function qualForm(q) {
  q = q || {};
  formModal(q.id ? 'Edit qualification' : 'Add qualification', [{ k: 'name', label: 'Name', value: q.name, required: true, full: true }, { k: 'code', label: 'Code', value: q.code, required: true, help: 'The national course code, for example CHC33021' }, { k: 'default_fee', label: 'Usual fee ($)', type: 'number', value: q.default_fee, help: 'A hint only. Fees are agreed per student.' }, { k: 'active', label: 'Show in lists', type: 'check', value: q.id ? q.active : true }], async v => {
    if (q.id) await upd('nex_qualifications', 'id=eq.' + q.id, v); else await ins('nex_qualifications', v, true);
    toast('Saved'); await loadRef(true); render();
  });
}
function trainerForm(t) {
  t = t || {};
  formModal(t.id ? 'Edit trainer' : 'Add trainer', [{ k: 'name', label: 'Full name', value: t.name, required: true, full: true, help: 'Written the way you want it to appear on class days and in the pay export.' }, { k: 'active', label: 'Shows in the dropdown', type: 'check', value: t.id ? t.active : true }], async v => {
    v.name = (v.name || '').replace(/\s+/g, ' ').trim();
    try { if (t.id) await upd('nex_trainers', 'id=eq.' + t.id, v); else await ins('nex_trainers', v, true); }
    catch (e) { if (/duplicate|unique/i.test(e.message)) throw fieldError('name', 'That trainer is already in the list.'); throw e; }
    toast('Saved'); await loadRef(true); render();
  });
}
function agentForm(a) {
  a = a || {};
  formModal(a.id ? 'Edit agent' : 'Add agent', [{ k: 'name', label: 'Name', value: a.name, required: true, full: true }, { k: 'phone', label: 'Phone', type: 'tel', value: a.phone }, { k: 'email', label: 'Email', type: 'email', value: a.email }, { k: 'notes', label: 'Notes', type: 'textarea', value: a.notes, full: true }, { k: 'active', label: 'Show in lists', type: 'check', value: a.id ? a.active : true }], async v => {
    if (a.id) await upd('nex_agents', 'id=eq.' + a.id, v); else await ins('nex_agents', v, true);
    toast('Saved'); await loadRef(true); render();
  });
}
