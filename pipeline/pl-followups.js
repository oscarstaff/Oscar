'use strict';
/* pl-followups.js · YatraLine · Follow-ups page and the follow-up form.
   One of the YatraLine files loaded by nex.html (list and order: PL_FILES in the loader). All of them share one global scope. */
/* ---------- Follow-ups ---------- */
const FU = { who: 'mine', done: false };
route(/^\/followups$/, async () => {
  afterRender(() => bindFollowups());
  return pageHead('bell', 'Follow-ups', 'Things to follow up', '<button class="nx-btn primary" id="fuAdd">' + ico('plus') + 'New follow-up</button>') +
    '<div class="nx-card"><div class="nx-toolbar" style="border-top:0"><div class="nx-seg" id="fuWho"><button data-v="mine" aria-pressed="' + (FU.who === 'mine') + '">Mine</button><button data-v="all" aria-pressed="' + (FU.who === 'all') + '">Everyone</button></div><div class="nx-seg" id="fuDone"><button data-v="open" aria-pressed="' + (!FU.done) + '">Open</button><button data-v="done" aria-pressed="' + FU.done + '">Done</button></div></div><div id="fuBody"></div></div>';
});
function bindFollowups() {
  const body = $('#fuBody');
  const load = async () => {
    holdBody(body);
    try {
      let q = 'select=*,nex_students(id,first_name,last_name)&order=due_at.asc.nullslast&limit=200';
      q += FU.done ? '&done_at=not.is.null' : '&done_at=is.null';
      if (FU.who === 'mine') q += '&assigned_to=eq.' + encodeURIComponent(ME.name);
      const rows = await sel('nex_followups', q); const today = sydToday();
      body.innerHTML = rows.length ? '<ul class="nx-list">' + rows.map(f => { const od = !f.done_at && f.due_at && f.due_at.slice(0, 10) < today; return '<li><span><b>' + esc(f.note) + '</b><small>' + (f.nex_students ? '<a href="#/students/' + f.nex_students.id + '">' + esc(fullName(f.nex_students)) + '</a> · ' : '') + (f.due_at ? (od ? '<span class="nx-neg">Overdue · </span>' : '') + 'Due ' + esc(fmtDate(f.due_at)) : 'No date') + (f.assigned_to ? ' · ' + esc(f.assigned_to) : '') + (f.done_at ? ' · done ' + esc(fmtDate(f.done_at)) + (f.done_by ? ' by ' + esc(f.done_by) : '') : '') + '</small></span>' + (f.done_at ? '' : '<button class="nx-btn sm" data-d="' + f.id + '">Done</button>') + '</li>'; }).join('') + '</ul>' : empty(FU.done ? 'Nothing completed yet' : 'All clear', FU.done ? '' : 'No open follow-ups' + (FU.who === 'mine' ? ' for you.' : '.'));
      $$('[data-d]', body).forEach(b => b.onclick = async () => { try { await upd('nex_followups', 'id=eq.' + b.dataset.d, { done_at: new Date().toISOString(), done_by: ME.name }); toast('Done'); load(); } catch (e) { toast(e.message, true); } });
    } catch (e) { body.innerHTML = empty('Could not load', e.message); }
  };
  $$('#fuWho button').forEach(b => b.onclick = () => { FU.who = b.dataset.v; $$('#fuWho button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); load(); });
  $$('#fuDone button').forEach(b => b.onclick = () => { FU.done = b.dataset.v === 'done'; $$('#fuDone button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); load(); });
  $('#fuAdd').onclick = () => pickStudentOptional();
  viewWait(load());
}
function pickStudentOptional() {
  const m = openModal({ title: 'New follow-up', footer: false, body: '<p style="margin-top:0">Is this about a student?</p><div class="nx-btnrow"><button class="nx-btn primary" id="fuS">Pick a student</button><button class="nx-btn" id="fuN">No, general</button></div>' });
  $('#fuS', m.el).onclick = () => { m.close(); pickStudent('Follow-up for', async st => { followupForm({ student: st, enrolments: await sel('nex_enrolments', 'select=id,qualification_id&student_id=eq.' + st.id) }); }); };
  $('#fuN', m.el).onclick = () => { m.close(); followupForm({}); };
}
