'use strict';
/* pl-admin.js · Pipe-Line · Admin tab (status lists, qualifications, agents, audit).
   One of the Pipe-Line files loaded by nex.html (list and order: PL_FILES in the loader). All of them share one global scope. */
/* ---------- Admin ---------- */
const AD = { ctx: 'enrolment' };
const CTX_NAMES = { enrolment: 'Enrolment stages', payment_queue: 'Payment queue statuses', processing: 'Processing steps', placement: 'Placement request statuses', placement_stage: 'Placement stages', booking: 'First Aid booking statuses' };
route(/^\/admin$/, async () => {
  if (!ME.admin) { go('#/'); return null; }   /* Admin is for hub admins only */
  await loadRef(true);
  afterRender(() => bindAdmin());
  return pageHead('admin', 'Admin', 'Lists and settings', '') +
    '<div class="nx-card"><div class="nx-card-h"><div><h3>Status lists</h3><div class="nx-muted">Each list belongs to one part of Pipe-Line, so the same word can mean different things in different places.' + (ME.admin ? '' : ' Only admins can change these.') + '</div></div>' + (ME.admin ? '<button class="nx-btn primary sm" id="adNewStatus">' + ico('plus') + 'Add status</button>' : '') + '</div><div class="nx-toolbar" style="border-top:0"><div class="nx-seg" id="adCtx">' + Object.keys(CTX_NAMES).map(k => '<button data-v="' + k + '" aria-pressed="' + (AD.ctx === k) + '">' + CTX_NAMES[k] + '</button>').join('') + '</div></div><div id="adStatus"></div></div>' +
    '<div class="nx-two"><div class="nx-card"><div class="nx-card-h"><h3>Qualifications</h3><button class="nx-btn primary sm" id="adNewQual">' + ico('plus') + 'Add</button></div><ul class="nx-list">' + REF.quals.map(q => '<li><span><b>' + esc(q.name) + '</b><small>' + esc(q.code) + (q.default_fee ? ' · usual fee ' + money(q.default_fee) : '') + (q.active ? '' : ' · hidden') + '</small></span><button class="nx-btn sm" data-q="' + q.id + '">Edit</button></li>').join('') + '</ul></div>' +
    '<div class="nx-card"><div class="nx-card-h"><h3>Agents</h3><button class="nx-btn primary sm" id="adNewAgent">' + ico('plus') + 'Add</button></div>' + (REF.agents.length ? '<ul class="nx-list">' + REF.agents.map(a => '<li><span><b>' + esc(a.name) + '</b><small>' + esc([a.phone, a.email].filter(Boolean).join(' · ') || 'No contact details') + (a.active ? '' : ' · hidden') + '</small></span><button class="nx-btn sm" data-ag="' + a.id + '">Edit</button></li>').join('') + '</ul>' : empty('No agents yet', 'Add the agents students come through.')) + '</div></div>' +
    secCard() + '<div class="nx-card"><div class="nx-card-b"><b>Who can open Pipe-Line</b><div class="nx-muted">Access is the Pipe-Line card on the Nodes page. Admins give it to staff with the Pipe-Line tick in ShiftOps, on each person\'s edit panel.</div></div></div>' +
  (ME.admin ? '<div class="nx-card"><div class="nx-card-h"><div><h3>Who opened student records</h3><div class="nx-muted">The latest 100 times a staff member opened a student. A repeat look within 10 minutes is counted once. More than 150 different students in an hour (or 800 in a day) pauses a person\'s access to personal details and shows here as Blocked. Only admins can see this.</div></div></div><div id="adViews"><div class="nx-card-b"><div class="nx-skel" style="width:60%"></div></div></div></div>' : '');
});
function bindAdmin() {
  const showStatus = () => {
    $$('#adCtx button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === AD.ctx)));
    const list = REF.status[AD.ctx] || [];
    $('#adStatus').innerHTML = list.length ? '<div class="nx-tablewrap"><table class="nx-table auto tight"><thead><tr><th>Order</th><th>Status</th><th>What it means</th><th>Closes the item</th><th></th></tr></thead><tbody>' + list.map(o => '<tr><td class="nx-num">' + o.position + '</td><td><b>' + esc(o.label) + '</b>' + (o.active ? '' : ' <span class="nx-tag">Hidden</span>') + '<div class="nx-muted" style="font-size:12px">' + esc(o.key) + '</div></td><td>' + (o.meaning ? esc(o.meaning) : '<span class="nx-muted">Not written yet</span>') + '</td><td>' + (o.is_closed ? 'Yes' : 'No') + '</td><td>' + (ME.admin ? '<button class="nx-btn sm" data-s="' + o.id + '">Edit</button>' : '') + '</td></tr>').join('') + '</tbody></table></div>' : empty('No statuses in this list');
    $$('[data-s]', $('#adStatus')).forEach(b => b.onclick = () => statusForm(list.find(x => x.id === b.dataset.s)));
  };
  $$('#adCtx button').forEach(b => b.onclick = () => { AD.ctx = b.dataset.v; showStatus(); });
  if ($('#adNewStatus')) $('#adNewStatus').onclick = () => statusForm(null);
  $('#adNewQual').onclick = () => qualForm(null); $('#adNewAgent').onclick = () => agentForm(null);
  $$('[data-q]').forEach(b => b.onclick = () => qualForm(REF.quals.find(x => x.id === b.dataset.q)));
  $$('[data-ag]').forEach(b => b.onclick = () => agentForm(REF.agents.find(x => x.id === b.dataset.ag)));
  showStatus(); bindSec();
  if (ME.admin && $('#adViews')) {
    sel('nex_view_log', 'select=viewed_by,viewed_at,student_id,blocked,nex_students(first_name,last_name,student_no)&order=viewed_at.desc&limit=100').then(rows => {
      const box = $('#adViews'); if (!box) return;
      box.innerHTML = rows.length ? '<div class="nx-tablewrap"><table class="nx-table auto tight"><thead><tr><th>When</th><th>Staff member</th><th>Student</th></tr></thead><tbody>' + rows.map(r => '<tr><td>' + esc(fmtDT(r.viewed_at)) + '</td><td>' + esc(r.viewed_by) + (r.blocked ? ' <span class="nx-tag">Blocked: opened too many</span>' : '') + '</td><td>' + (r.nex_students ? '<a href="#/students/' + esc(r.student_id) + '">' + esc(fullName(r.nex_students)) + '</a>' : '<span class="nx-muted">Removed</span>') + '</td></tr>').join('') + '</tbody></table></div>' : empty('Nothing yet', 'Student record views will appear here.');
    }).catch(e => { const box = $('#adViews'); if (box) box.innerHTML = empty('Could not load', e.message); });
  }
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
function agentForm(a) {
  a = a || {};
  formModal(a.id ? 'Edit agent' : 'Add agent', [{ k: 'name', label: 'Name', value: a.name, required: true, full: true }, { k: 'phone', label: 'Phone', type: 'tel', value: a.phone }, { k: 'email', label: 'Email', type: 'email', value: a.email }, { k: 'notes', label: 'Notes', type: 'textarea', value: a.notes, full: true }, { k: 'active', label: 'Show in lists', type: 'check', value: a.id ? a.active : true }], async v => {
    if (a.id) await upd('nex_agents', 'id=eq.' + a.id, v); else await ins('nex_agents', v, true);
    toast('Saved'); await loadRef(true); render();
  });
}
