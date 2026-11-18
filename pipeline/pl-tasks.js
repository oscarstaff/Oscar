'use strict';
/* pl-tasks.js · YatraLine · Task Manager: general tasks for the team (internal jobs and jobs about a student or lead).
   One of the YatraLine files loaded by nex.html (list and order: PL_FILES in the loader). All of them share one global scope.
   The 1st, 2nd and 3rd lead follow-ups are NOT here. They live on the Leads page (see pl-students.js and nex_lead_followup). */
const TK = { who: 'me', show: 'open', pri: '', kind: '', q: '', sort: 'due' };
const TK_PRI = [{ id: 'urgent', label: 'Urgent' }, { id: 'high', label: 'High' }, { id: 'normal', label: 'Normal' }, { id: 'low', label: 'Low' }];
const TK_STATUS = [{ id: 'todo', label: 'To do' }, { id: 'in_progress', label: 'In progress' }, { id: 'done', label: 'Done' }];
const TK_RANK = { urgent: 0, high: 1, normal: 2, low: 3 };
const TK_TONE = { urgent: 'bad', high: 'warn', normal: 'accent', low: '' };
const TK_STATUS_TONE = { todo: '', in_progress: 'info', done: 'ok' };
const tkLabel = (list, id) => (list.find(x => x.id === id) || {}).label || id || '';
const tkPriPill = p => '<span class="nx-pill ' + (TK_TONE[p] || '') + '">' + esc(tkLabel(TK_PRI, p)) + '</span>';
const tkStatusPill = s => '<span class="nx-pill ' + (TK_STATUS_TONE[s] || '') + '">' + esc(tkLabel(TK_STATUS, s)) + '</span>';
/* due date cell: overdue in red, today in bold */
function tkDueHtml(t, today) {
  if (!t.due_on) return '<span class="nx-muted">No date</span>';
  if (t.status === 'done') return esc(fmtDate(t.due_on));
  if (t.due_on < today) return '<span class="nx-neg">Overdue · ' + esc(fmtDate(t.due_on)) + '</span>';
  if (t.due_on === today) return '<span class="nx-money">Today</span>';
  return esc(fmtDate(t.due_on));
}
function tkSort(rows, how) {
  const dueKey = t => t.due_on || '9999-99-99', pri = t => TK_RANK[t.priority] != null ? TK_RANK[t.priority] : 2;
  const byNew = (a, b) => String(b.created_at).localeCompare(String(a.created_at));
  const cmp = {
    due: (a, b) => dueKey(a).localeCompare(dueKey(b)) || pri(a) - pri(b) || byNew(a, b),
    priority: (a, b) => pri(a) - pri(b) || dueKey(a).localeCompare(dueKey(b)) || byNew(a, b),
    newest: byNew,
    done: (a, b) => String(b.done_at || '').localeCompare(String(a.done_at || ''))
  }[how] || byNew;
  return rows.slice().sort(cmp);
}
route(/^\/tasks$/, async () => {
  afterRender(() => bindTasks());
  const staff = REF.staff || [];
  return pageHead('list', 'Internal and student tasks', 'Task Manager', '<button class="nx-btn primary" id="tkAdd">' + ico('plus') + 'New task</button>') +
    '<div class="nx-card"><div class="nx-toolbar" style="border-top:0">' +
    '<div class="nx-seg" id="tkShow" role="group" aria-label="Show"><button type="button" data-v="open" aria-pressed="' + (TK.show === 'open') + '">Open</button><button type="button" data-v="done" aria-pressed="' + (TK.show === 'done') + '">Done</button></div>' +
    '<select class="nx-sel sm" id="tkWho" aria-label="Assigned to"><option value="me"' + (TK.who === 'me' ? ' selected' : '') + '>Assigned to me</option><option value="all"' + (TK.who === 'all' ? ' selected' : '') + '>Everyone</option><option value="none"' + (TK.who === 'none' ? ' selected' : '') + '>Unassigned</option>' + staff.filter(n => n !== ME.name).map(n => '<option value="n:' + esc(n) + '"' + (TK.who === 'n:' + n ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select>' +
    '<select class="nx-sel sm" id="tkPri" aria-label="Priority">' + selectOpts(TK_PRI, TK.pri, 'Any priority') + '</select>' +
    '<select class="nx-sel sm" id="tkKind" aria-label="Type"><option value=""' + (TK.kind ? '' : ' selected') + '>Internal and student</option><option value="internal"' + (TK.kind === 'internal' ? ' selected' : '') + '>Internal only</option><option value="student"' + (TK.kind === 'student' ? ' selected' : '') + '>About a student or lead</option></select>' +
    '<input class="nx-in sm" id="tkQ" style="min-width:200px" placeholder="Search tasks" aria-label="Search tasks" value="' + esc(TK.q) + '">' +
    '<select class="nx-sel sm" id="tkSort" aria-label="Sort by"><option value="due">Sort: due date</option><option value="priority">Sort: priority</option><option value="newest">Sort: newest</option></select>' +
    '<button class="nx-btn quiet sm" id="tkClear">Clear</button></div>' +
    '<div id="tkSum" class="nx-toolbar" style="padding-top:0;border-top:0"></div><div id="tkBody"></div><div class="nx-foot" id="tkFoot"><span></span></div></div>';
});
/* the old Follow-ups address now opens the Task Manager */
route(/^\/followups$/, async () => { setTimeout(() => go('#/tasks'), 0); return null; });

function bindTasks() {
  const body = $('#tkBody'); let all = [];
  $('#tkSort').value = TK.sort;
  const apply = () => {
    const today = sydToday(), q = (TK.q || '').toLowerCase();
    let rows = all.filter(t => {
      if (TK.who === 'me' && t.assigned_to !== ME.name) return false;
      if (TK.who === 'none' && t.assigned_to) return false;
      if (TK.who.startsWith('n:') && t.assigned_to !== TK.who.slice(2)) return false;
      if (TK.pri && t.priority !== TK.pri) return false;
      if (TK.kind === 'internal' && t.student_id) return false;
      if (TK.kind === 'student' && !t.student_id) return false;
      if (q && !(String(t.title).toLowerCase().includes(q) || String(t.details || '').toLowerCase().includes(q) || (t.nex_students && fullName(t.nex_students).toLowerCase().includes(q)))) return false;
      return true;
    });
    rows = tkSort(rows, TK.show === 'done' ? 'done' : TK.sort);
    /* the summary chips count what the filters above leave, so the numbers match the list */
    const od = rows.filter(t => t.status !== 'done' && t.due_on && t.due_on < today).length, td = rows.filter(t => t.status !== 'done' && t.due_on === today).length, ur = rows.filter(t => t.status !== 'done' && t.priority === 'urgent').length;
    $('#tkSum').innerHTML = TK.show === 'open' ? '<span class="nx-pill ' + (od ? 'bad' : '') + '">' + od + ' overdue</span><span class="nx-pill ' + (td ? 'warn' : '') + '">' + td + ' due today</span><span class="nx-pill ' + (ur ? 'bad' : '') + '">' + ur + ' urgent</span>' : '';
    body.innerHTML = rows.length ? '<div class="nx-tablewrap"><table class="nx-table"><thead><tr><th>Task</th><th>Priority</th><th>Status</th><th>' + (TK.show === 'done' ? 'Done' : 'Due') + '</th><th>Assigned to</th><th></th></tr></thead><tbody>' + rows.map(t =>
      '<tr><td><b>' + esc(t.title) + '</b>' + (t.details ? '<div class="nx-muted" style="font-size:12px;white-space:pre-line">' + esc(t.details.length > 160 ? t.details.slice(0, 160) + '…' : t.details) + '</div>' : '') +
      '<div class="nx-muted" style="font-size:12px">' + (t.nex_students ? '<a href="#/students/' + t.nex_students.id + '">' + esc(fullName(t.nex_students)) + '</a>' : 'Internal') + (t.created_by ? ' · added by ' + esc(t.created_by) : '') + '</div></td>' +
      '<td>' + tkPriPill(t.priority) + '</td><td>' + tkStatusPill(t.status) + '</td>' +
      '<td>' + (t.status === 'done' ? esc(fmtDate(t.done_at)) + '<div class="nx-muted" style="font-size:12px">' + esc(t.done_by || '') + '</div>' : tkDueHtml(t, today)) + '</td>' +
      '<td>' + (t.assigned_to ? esc(t.assigned_to) : '<span class="nx-muted">Unassigned</span>') + '</td>' +
      '<td><div class="nx-btnrow">' + (t.status === 'todo' ? '<button class="nx-btn sm" data-st="in_progress" data-id="' + t.id + '">Start</button>' : '') + (t.status !== 'done' ? '<button class="nx-btn sm" data-st="done" data-id="' + t.id + '">Done</button>' : '<button class="nx-btn sm" data-st="todo" data-id="' + t.id + '">Reopen</button>') + '<button class="nx-btn sm quiet" data-ed="' + t.id + '">Edit</button></div></td></tr>').join('') + '</tbody></table></div>'
      : empty(TK.show === 'done' ? 'Nothing completed yet' : 'No open tasks', all.length ? 'Nothing matches these filters. Press Clear to see everything.' : 'Press New task to add one.', all.length ? '' : '<button class="nx-btn primary" id="tkAdd2">' + ico('plus') + 'New task</button>');
    $('#tkFoot').innerHTML = '<span>' + rows.length + (rows.length === 1 ? ' task' : ' tasks') + (all.length >= 500 ? ' (showing the first 500)' : '') + '</span>';
    $$('[data-st]', body).forEach(b => b.onclick = async () => {
      b.disabled = true;
      try { await upd('nex_tasks', 'id=eq.' + b.dataset.id, { status: b.dataset.st }); toast(b.dataset.st === 'done' ? 'Task done' : b.dataset.st === 'todo' ? 'Task reopened' : 'Task started'); await load(); }
      catch (e) { b.disabled = false; showError(e); }
    });
    $$('[data-ed]', body).forEach(b => b.onclick = () => taskForm(all.find(x => x.id === b.dataset.ed), load));
    const a2 = $('#tkAdd2'); if (a2) a2.onclick = () => taskForm(null, load);
  };
  const load = async () => {
    holdBody(body);
    try {
      all = await sel('nex_tasks', 'select=*,nex_students(id,first_name,last_name)&status=' + (TK.show === 'done' ? 'eq.done&order=done_at.desc' : 'neq.done&order=created_at.desc') + '&limit=500');
      apply();
    } catch (e) { body.innerHTML = empty('Could not load tasks', e.message); }
  };
  const on = (id, fn) => { const el = $(id); if (el) el.onchange = fn; };
  $$('#tkShow button').forEach(b => b.onclick = () => { TK.show = b.dataset.v; $$('#tkShow button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); load(); });
  on('#tkWho', e => { TK.who = e.target.value; apply(); });
  on('#tkPri', e => { TK.pri = e.target.value; apply(); });
  on('#tkKind', e => { TK.kind = e.target.value; apply(); });
  on('#tkSort', e => { TK.sort = e.target.value; apply(); });
  let t = 0; $('#tkQ').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { TK.q = e.target.value.trim(); apply(); }, 200); });
  $('#tkClear').onclick = () => { TK.who = 'me'; TK.pri = TK.kind = TK.q = ''; TK.sort = 'due'; $('#tkWho').value = 'me'; $('#tkPri').value = ''; $('#tkKind').value = ''; $('#tkQ').value = ''; $('#tkSort').value = 'due'; apply(); };
  $('#tkAdd').onclick = () => taskForm(null, load);
  viewWait(load());
}

/* New or edit task. o: an existing task row to edit, or null for a new one. o.student (new only) pre-fills the person; after() runs once it is saved. */
function taskForm(o, after, student) {
  o = o || {};
  let person = o.nex_students || student || null;
  const f = [
    { k: 'title', label: 'Task', required: true, full: true, placeholder: 'What needs doing' },
    { k: 'details', label: 'Details', type: 'textarea', full: true },
    { k: 'priority', label: 'Priority', type: 'select', options: TK_PRI, value: o.priority || 'normal' },
    { k: 'status', label: 'Status', type: 'select', options: TK_STATUS, value: o.status || 'todo' },
    { k: 'due_on', label: 'Due date', type: 'date' },
    { k: 'assigned_to', label: 'Assigned to', type: 'select', options: REF.staff, value: o.id ? o.assigned_to : ME.name, blank: 'Unassigned' }
  ];
  f[0].value = o.title; f[1].value = o.details; f[4].value = o.due_on;
  const who = '<div class="nx-form" style="margin-bottom:12px"><div class="full"><span class="nx-lbl">About a student or lead (optional)</span><div class="nx-btnrow" style="align-items:center"><span id="tkPerson"></span><button type="button" class="nx-btn sm" id="tkPick"></button><button type="button" class="nx-btn sm quiet" id="tkNoPerson">Remove</button></div><div class="nx-help">Leave this empty for an internal task.</div></div></div>';
  const m = formModal(o.id ? 'Edit task' : 'New task', f, async (v, mm) => {
    if (String(v.title).length > 200) throw fieldError('title', 'Keep the task under 200 characters. Put the rest in Details.');
    const row = { title: v.title, details: v.details, priority: v.priority, status: v.status, due_on: v.due_on, assigned_to: v.assigned_to, student_id: person ? person.id : null };
    if (o.id) await upd('nex_tasks', 'id=eq.' + o.id, row); else await ins('nex_tasks', row, true);
    toast(o.id ? 'Task saved' : 'Task added'); if (after) after(); else render();
  }, o.id ? 'Save' : 'Add task', who);
  const paint = () => {
    $('#tkPerson', m.el).innerHTML = person ? '<b>' + esc(fullName(person)) + '</b>' : '<span class="nx-muted">Nobody. Internal task.</span>';
    $('#tkPick', m.el).textContent = person ? 'Change' : 'Choose person';
    $('#tkNoPerson', m.el).hidden = !person;
  };
  paint();
  $('#tkPick', m.el).onclick = () => pickStudent('About a student or lead', st => { person = st; paint(); });
  $('#tkNoPerson', m.el).onclick = () => { person = null; paint(); };
  return m;
}
