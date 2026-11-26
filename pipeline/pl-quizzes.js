'use strict';
/* pl-quizzes.js · Yatra · Quizzes (taking them, and admins manage access, results and retakes).
   One of the Yatra files loaded by nex.html (list and order: PL_FILES in the loader). All of them share one global scope. */
/* ---------- Quizzes ---------- */
const STD_QUIZ = {
  id: 'checklist_v1',
  title: 'Standard Knowledge Quiz — Oscars',
  pass_pct: 80,
  questions: [
    {
      q: 'A student calls asking about Cert III Individual Support. What is the standard price you should quote?',
      type: 'single',
      options: ['$1000', '$1180', '$1300', '$1500'],
      correct: 2
    },
    {
      q: 'Maximum discount you can offer for Cert III Individual Support is:',
      type: 'single',
      options: ['$1100', '$1180', '$1280', 'Any amount if student insists'],
      correct: 1
    },
    {
      q: 'A student from Tasmania asks for a discount. What should you do?',
      type: 'single',
      options: [
        'Give the same discount as Sydney students',
        'NO discount — regional placement areas like Tasmania/Darwin/Canberra get no discount (except self-placement/groups or first aid done there)',
        'Give them 20% off',
        'Refer them to the placement team for pricing'
      ],
      correct: 1
    },
    {
      q: 'How many points of ID does a student need to provide for enrolment?',
      type: 'single',
      options: ['50 points', '75 points', '100 points', '150 points'],
      correct: 2
    },
    {
      q: 'When asking for visa documents, which group should you NOT ask?',
      type: 'single',
      options: ['Student visa holders', 'Bridging visa holders', 'Australian/New Zealand citizens', 'PR holders'],
      correct: 2
    },
    {
      q: 'How long is First AID certificate valid for?',
      type: 'single',
      options: ['1 year', '2 years', '3 years', '5 years'],
      correct: 2
    },
    {
      q: 'How long is CPR certificate valid for?',
      type: 'single',
      options: ['1 year', '2 years', '3 years', '5 years'],
      correct: 0
    },
    {
      q: 'When should you book a class for a Sydney-based student?',
      type: 'single',
      options: [
        'Wait for them to ask',
        'Book the earliest available class — try to book ASAP',
        'Only book after payment',
        'Only book after documents are completed'
      ],
      correct: 1
    },
    {
      q: 'A call is not answered. What is the correct follow-up?',
      type: 'single',
      options: [
        'Send one email and wait',
        'Call again within 1 hour, then again at 6-7 PM, record all attempts',
        'Wait 24 hours then try once more',
        'Mark them as uninterested'
      ],
      correct: 1
    },
    {
      q: 'Placement is required for which certificates?',
      type: 'single',
      options: [
        'All certifications',
        'Aged care & disability certifications only',
        'Only Cert IV',
        'No certificates require placement'
      ],
      correct: 1
    },
    {
      q: 'How long is the placement (in hours)?',
      type: 'single',
      options: ['80 hours', '100 hours', '120 hours', '160 hours'],
      correct: 2
    },
    {
      q: 'When is “conversion” considered complete for a lead?',
      type: 'single',
      options: [
        'When they reply to the email',
        'When they confirm interest',
        'When they take class AND make payment',
        'When they submit documents'
      ],
      correct: 2
    },
    {
      q: 'A student urgently needs their certificate before an interview. What do you do?',
      type: 'single',
      options: [
        'Promise them you will deliver it tomorrow',
        'Inform the processing team about the urgency immediately and keep a note',
        'Tell them it cannot be done faster',
        'Issue the certificate yourself'
      ],
      correct: 1
    },
    {
      q: 'After payment for First Aid CPR (cash), what must you do?',
      type: 'single',
      options: [
        'Just verbally confirm to the student',
        'Note in sheet only',
        'Count money, note student details (Name, number, email, amount, received by), send acknowledgement email, and note in first aid booking sheet',
        'Send a text message confirmation'
      ],
      correct: 2
    },
    {
      q: 'For online payment, what is COMPULSORY before you let the student leave?',
      type: 'single',
      options: [
        'A signed receipt',
        'A screenshot of the payment',
        'A bank statement',
        'A verbal confirmation'
      ],
      correct: 1
    }
  ]
};
const QZ = { filter: 'all', items: [] };
route(/^\/quizzes$/, async () => {
  const n = encodeURIComponent(ME.name);
  const [access, stdRes, custom, customRes, docs, ovr] = await Promise.all([
    sel('quiz_access', 'select=quiz_id&staff_name=eq.' + n),
    sel('training_quiz_results', 'select=score,total,passed,created_at&staff_name=eq.' + n + '&quiz_id=eq.' + STD_QUIZ.id + '&order=created_at.desc&limit=1'),
    sel('custom_quizzes', 'select=id,title,pass_pct,questions,document_id,status&order=created_at.desc'),
    sel('custom_quiz_results', 'select=quiz_id,score,total,passed,created_at&staff_name=eq.' + n + '&order=created_at.desc'),
    sel('documents', 'select=id,title,url'),
    sel('quiz_overrides', 'select=questions,pass_pct&quiz_id=eq.' + STD_QUIZ.id + '&limit=1').catch(() => [])
  ]);
  const has = new Set((access || []).map(a => a.quiz_id)), docBy = {}; (docs || []).forEach(d => docBy[d.id] = d);
  const items = [];
  if (has.has(STD_QUIZ.id) || ME.admin) {
    const o = (ovr && ovr[0]) || {};
    items.push({ kind: 'standard', id: STD_QUIZ.id, title: STD_QUIZ.title.replace(' — ', ': '), sub: has.has(STD_QUIZ.id) ? 'Required knowledge check for the Checklist team' : 'You see this as an admin. Use Manage to give access.', questions: Array.isArray(o.questions) && o.questions.length ? o.questions : STD_QUIZ.questions, pass_pct: o.pass_pct || STD_QUIZ.pass_pct, result: (stdRes && stdRes[0]) || null });
  }
  (custom || []).forEach(q => {
    if (!ME.admin && (!has.has(q.id) || q.status === 'draft')) return;
    const d = docBy[q.document_id];
    items.push({ kind: 'custom', id: q.id, title: q.title, sub: d ? 'Read the document before you start' : 'Compliance quiz', doc: d || null, draft: q.status === 'draft', questions: Array.isArray(q.questions) ? q.questions : [], pass_pct: q.pass_pct || 80, result: (customRes || []).find(r => r.quiz_id === q.id) || null });
  });
  QZ.items = items;
  const total = items.length, passed = items.filter(t => t.result && t.result.passed).length, todo = items.filter(t => !(t.result && t.result.passed)).length;
  const pct = total ? Math.round(passed / total * 100) : 0;
  afterRender(() => {
    const body = $('#qzBody');
    const paint = () => {
      const list = QZ.items.filter(t => QZ.filter === 'all' ? true : QZ.filter === 'todo' ? !(t.result && t.result.passed) : !!(t.result && t.result.passed));
      body.innerHTML = list.length ? '<ul class="nx-list nx-qzlist">' + list.map(t => {
        const r = t.result, st = !r ? '<span class="nx-pill warn">To do</span>' : r.passed ? '<span class="nx-pill ok">Passed ' + r.score + ' / ' + r.total + '</span>' : '<span class="nx-pill bad">Needs review ' + r.score + ' / ' + r.total + '</span>';
        const u = t.doc ? safeUrl(t.doc.url) : '';
        const canTake = t.questions.length && (!r || ME.admin);
        return '<li><div class="nx-qz"><b>' + esc(t.title) + (t.draft ? ' <span class="nx-tag">Draft</span>' : '') + '</b><small>' + esc(t.sub) + ' · ' + t.questions.length + (t.questions.length === 1 ? ' question' : ' questions') + ' · pass mark ' + t.pass_pct + '%' + (r && r.created_at ? ' · taken ' + esc(fmtDate(r.created_at)) : '') + '</small>' + (t.doc ? '<small>' + (u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc(t.doc.title) + '</a>' : esc(t.doc.title)) + '</small>' : '') + '</div><span class="nx-btnrow">' + st + (canTake ? '<button class="nx-btn sm ' + (r ? '' : 'primary') + '" data-take="' + esc(t.id) + '">' + (r ? 'Take again' : 'Start quiz') + '</button>' : '') + (ME.admin ? '<button class="nx-btn sm quiet" data-manage="' + esc(t.id) + '">Manage</button>' : '') + '</span></li>';
      }).join('') + '</ul>' : empty(QZ.filter === 'todo' ? 'Nothing left to do' : QZ.filter === 'done' ? 'No passed quizzes yet' : 'No quizzes assigned yet', QZ.filter === 'all' ? 'When a quiz is assigned to you it shows up here.' : '');
      $$('[data-manage]', body).forEach(b => b.onclick = () => { const t = QZ.items.find(x => String(x.id) === b.dataset.manage); if (t) manageQuiz(t); });
      $$('[data-take]', body).forEach(b => b.onclick = () => { const t = QZ.items.find(x => String(x.id) === b.dataset.take); if (t) takeQuiz(t); });
    };
    $$('#qzSeg button').forEach(b => b.onclick = () => { QZ.filter = b.dataset.v; $$('#qzSeg button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); paint(); });
    paint();
  });
  return pageHead('book', total ? passed + ' of ' + total + ' passed' : 'No quizzes yet', 'Quizzes', '') +
    (total ? '<div class="nx-card"><div class="nx-card-b nx-qzprog"><div><span class="nx-big">' + pct + '%</span> <span class="nx-muted">complete</span></div><div class="nx-meter-bar" role="img" aria-label="' + pct + ' percent complete"><i style="width:' + pct + '%"></i></div></div></div>' : '') +
    '<div class="nx-card"><div class="nx-toolbar" style="border-top:0"><div class="nx-seg" id="qzSeg" role="group" aria-label="Show">' + [['all', 'All', total], ['todo', 'To do', todo], ['done', 'Passed', passed]].map(([v, l, c]) => '<button type="button" data-v="' + v + '" aria-pressed="' + (QZ.filter === v) + '">' + l + ' <span class="nx-count">' + c + '</span></button>').join('') + '</div></div><div id="qzBody"></div></div>';
});
/* ---------- Manage a quiz (admins): who can take it, results, retakes, CSV report. Same tables Nexus used. ---------- */
const QM_RES = t => t.kind === 'standard' ? 'training_quiz_results' : 'custom_quiz_results';
function qmCsvCell(v) { let s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }
function qmCsv(t, access, latest) {
  const names = Array.from(new Set([...access, ...Object.keys(latest)])).sort();
  let csv = 'Staff Name,Has Access,Attempt Date,Score,Total,Percentage,Status\n';
  names.forEach(n => {
    const r = latest[n], a = access.has(n) ? 'Yes' : 'No';
    if (r) csv += [qmCsvCell(n), a, new Date(r.created_at).toISOString().slice(0, 16).replace('T', ' '), r.score, r.total, (r.total ? Math.round(r.score / r.total * 100) : 0) + '%', r.passed ? 'Passed' : 'Failed'].join(',') + '\n';
    else csv += qmCsvCell(n) + ',' + a + ',Not attempted,,,,Pending\n';
  });
  return csv;
}
function manageQuiz(t) {
  const S = { f: 'all', q: '', access: new Set(), latest: {}, names: [], view: 'list' };
  const m = openModal({ title: 'Manage: ' + t.title, wide: true, footer: false, body: '<div id="qmHost"><div class="nx-help">Loading…</div></div>' });
  const host = $('#qmHost', m.el);
  const load = async () => {
    const [acc, res, staff] = await Promise.all([
      sel('quiz_access', 'select=staff_name&quiz_id=eq.' + encodeURIComponent(t.id) + '&limit=5000'),
      sel(QM_RES(t), 'select=id,staff_name,score,total,passed,answers,created_at&quiz_id=eq.' + encodeURIComponent(t.id) + '&order=created_at.desc&limit=5000'),
      sel('staff_names', 'select=name&order=name.asc&limit=2000')
    ]);
    S.access = new Set((acc || []).map(a => a.staff_name)); S.latest = {};
    (res || []).forEach(r => { if (!S.latest[r.staff_name]) S.latest[r.staff_name] = r; });
    S.names = (staff || []).map(s => s.name).filter(Boolean);
  };
  const stateOf = n => { const r = S.latest[n]; return r ? (r.passed ? 'passed' : 'failed') : 'none'; };
  const act = async (fnc, okMsg) => { try { await fnc(); await load(); paint(); toast(okMsg); } catch (e) { toast(e.message || 'That did not work.', true); } };
  const detail = n => {
    const r = S.latest[n]; if (!r) return;
    const ans = r.answers || {};
    host.innerHTML = '<div class="nx-btnrow" style="margin-bottom:10px"><button class="nx-btn sm quiet" id="qmBack">← Back to list</button></div>' +
      '<div class="nx-qzres ' + (r.passed ? 'ok' : 'bad') + '"><div class="nx-big">' + r.score + ' / ' + r.total + '</div><b>' + esc(n) + ': ' + (r.passed ? 'Passed' : 'Needs review') + '</b><span class="nx-muted">Submitted ' + esc(fmtDate(r.created_at)) + '</span></div>' +
      '<ul class="nx-qzrev">' + t.questions.map((q, i) => {
        const a = ans[String(i)] !== undefined ? ans[String(i)] : ans[i], ok = a === q.correct;
        return '<li class="' + (ok ? 'ok' : 'bad') + '"><b>' + (i + 1) + '. ' + esc(q.q) + '</b><span>Their answer: ' + esc(a != null && (q.options || [])[a] != null ? q.options[a] : '(no answer)') + '</span>' + (ok ? '' : '<span>Correct answer: ' + esc((q.options || [])[q.correct] || '(unknown)') + '</span>') + '</li>';
      }).join('') + '</ul>';
    $('#qmBack', host).onclick = paint;
  };
  const paint = () => {
    const q = S.q.trim().toLowerCase();
    const counts = { all: S.names.length, access: S.names.filter(n => S.access.has(n)).length, noaccess: S.names.filter(n => !S.access.has(n)).length, passed: S.names.filter(n => stateOf(n) === 'passed').length, failed: S.names.filter(n => stateOf(n) === 'failed').length };
    const list = S.names.filter(n => (!q || n.toLowerCase().includes(q)) && (S.f === 'all' || (S.f === 'access' ? S.access.has(n) : S.f === 'noaccess' ? !S.access.has(n) : stateOf(n) === S.f)));
    host.innerHTML = '<div class="nx-muted" style="margin-bottom:8px"><b>' + counts.access + '</b> with access · <b>' + counts.passed + '</b> passed · <b>' + counts.failed + '</b> failed' + (t.draft ? ' · <span class="nx-tag">Draft</span>' : '') + '</div>' +
      '<div class="nx-btnrow" style="margin-bottom:10px"><button class="nx-btn sm" id="qmAll">Give access to all</button><button class="nx-btn sm" id="qmNone">Revoke all</button><button class="nx-btn sm" id="qmCsv">Download report (CSV)</button></div>' +
      '<div class="nx-toolbar" style="border-top:0;padding-left:0;padding-right:0"><div class="nx-seg" id="qmSeg" role="group" aria-label="Show">' + [['all', 'All'], ['access', 'Access'], ['noaccess', 'No access'], ['passed', 'Passed'], ['failed', 'Failed']].map(([v, l]) => '<button type="button" data-v="' + v + '" aria-pressed="' + (S.f === v) + '">' + l + ' <span class="nx-count">' + counts[v] + '</span></button>').join('') + '</div><span class="nx-grow"></span><input class="nx-in sm" id="qmQ" placeholder="Search staff" value="' + esc(S.q) + '"></div>' +
      '<div style="max-height:52vh;overflow:auto">' + (list.length ? '<table class="nx-table tight auto"><tbody>' + list.map(n => {
        const r = S.latest[n], has = S.access.has(n);
        return '<tr><td><b>' + esc(n) + '</b><div class="nx-muted">' + (has ? 'Access' + (r ? (r.passed ? ' · passed' : ' · failed') : ' · not taken') : 'No access') + '</div></td><td class="nx-right">' +
          (r ? '<button class="nx-pill ' + (r.passed ? 'ok' : 'bad') + '" data-det="' + esc(n) + '" title="See their answers" style="border:0;cursor:pointer">' + r.score + ' / ' + r.total + '</button> <button class="nx-btn sm quiet" data-retake="' + esc(n) + '">Allow retake</button> ' : '') +
          '<button class="nx-btn sm ' + (has ? '' : 'primary') + '" data-acc="' + esc(n) + '">' + (has ? 'Revoke' : 'Give access') + '</button></td></tr>';
      }).join('') + '</tbody></table>' : empty('No staff match', 'Try a different filter or name.')) + '</div>';
    $$('#qmSeg button', host).forEach(b => b.onclick = () => { S.f = b.dataset.v; paint(); });
    const qi = $('#qmQ', host); let tm = 0; qi.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { S.q = qi.value; paint(); const n = $('#qmQ', host); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 200); };
    $$('[data-det]', host).forEach(b => b.onclick = () => detail(b.dataset.det));
    $$('[data-acc]', host).forEach(b => b.onclick = () => { const n = b.dataset.acc; act(async () => { if (S.access.has(n)) await del('quiz_access', 'quiz_id=eq.' + encodeURIComponent(t.id) + '&staff_name=eq.' + encodeURIComponent(n)); else await ins('quiz_access', { staff_name: n, quiz_id: t.id, granted_by: ME.name }); }, S.access.has(n) ? 'Access revoked for ' + n : 'Access given to ' + n); });
    $$('[data-retake]', host).forEach(b => b.onclick = async () => { const n = b.dataset.retake, r = S.latest[n]; if (!r) return; if (!(await confirmBox('Allow ' + n + ' to retake?', 'Their latest attempt (' + r.score + ' / ' + r.total + ') is deleted so they can take the quiz again.', 'Allow retake', true))) return; act(() => del(QM_RES(t), 'id=eq.' + r.id), n + ' can retake the quiz'); });
    $('#qmAll', host).onclick = async () => {
      if (!(await confirmBox('Give everyone access?', 'Every staff member will be able to take this quiz.', 'Give access'))) return;
      const toAdd = S.names.filter(n => !S.access.has(n)); if (!toAdd.length) { toast('Everyone already has access'); return; }
      act(() => ins('quiz_access', toAdd.map(n => ({ staff_name: n, quiz_id: t.id, granted_by: ME.name }))), 'Access given to ' + toAdd.length + ' staff');
    };
    $('#qmNone', host).onclick = async () => { if (!(await confirmBox('Revoke everyone’s access?', 'Nobody will be able to take this quiz until access is given again. Results already saved stay.', 'Revoke all', true))) return; act(() => del('quiz_access', 'quiz_id=eq.' + encodeURIComponent(t.id)), 'Access revoked from all'); };
    $('#qmCsv', host).onclick = () => {
      const url = URL.createObjectURL(new Blob([qmCsv(t, S.access, S.latest)], { type: 'text/csv;charset=utf-8;' })), a = document.createElement('a');
      a.href = url; a.download = String(t.title).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) + '_' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Report downloaded', false, false);
    };
  };
  load().then(paint).catch(e => { host.innerHTML = '<div class="nx-err">Could not load: ' + esc(e.message || e) + '</div>'; });
  return m;
}
/* one question at a time; every question must be answered before Submit. The result is saved to the same tables Nexus reads. */
function takeQuiz(t) {
  const st = { i: 0, ans: {}, result: null, saving: false };
  const total = t.questions.length;
  const m = openModal({ title: t.title, wide: true, footer: false, body: '<div id="qzRun"></div>' });
  const host = $('#qzRun', m.el);
  const review = () => t.questions.map((q, i) => { const a = st.ans[i], ok = a === q.correct; return '<li class="' + (ok ? 'ok' : 'bad') + '"><b>' + (i + 1) + '. ' + esc(q.q) + '</b><span>Your answer: ' + esc(a != null && q.options[a] != null ? q.options[a] : 'none') + '</span>' + (ok ? '' : '<span>Correct answer: ' + esc(q.options[q.correct]) + '</span>') + '</li>'; }).join('');
  const paint = () => {
    if (st.result) {
      const r = st.result, pass = r.passed;
      host.innerHTML = '<div class="nx-qzres ' + (pass ? 'ok' : 'bad') + '"><div class="nx-big">' + r.score + ' / ' + total + '</div><b>' + (pass ? 'Passed' : 'Needs review') + '</b><span class="nx-muted">Pass mark ' + t.pass_pct + '%. You scored ' + Math.round(r.score / total * 100) + '%.</span></div><ol class="nx-qzrev">' + review() + '</ol><div class="nx-btnrow" style="justify-content:flex-end;margin-top:16px"><button class="nx-btn primary" id="qzClose">Done</button></div>';
      $('#qzClose', host).onclick = () => { m.close(); render(); };
      return;
    }
    const q = t.questions[st.i], answered = Object.keys(st.ans).length, last = st.i === total - 1;
    host.innerHTML = '<div class="nx-qztop"><span>Question ' + (st.i + 1) + ' of ' + total + '</span><div class="nx-meter-bar"><i style="width:' + Math.round(answered / total * 100) + '%"></i></div></div>' +
      '<h4 class="nx-qzq" id="qzQ">' + esc(q.q) + '</h4><div class="nx-qzopts" role="radiogroup" aria-labelledby="qzQ">' + (q.options || []).map((o, k) => '<button type="button" class="nx-pick nx-qzopt" role="radio" aria-checked="' + (st.ans[st.i] === k) + '" data-k="' + k + '"><i></i><span>' + esc(o) + '</span></button>').join('') + '</div>' +
      '<div class="nx-err" id="qzErr" role="alert" hidden></div><div class="nx-btnrow" style="justify-content:space-between;margin-top:18px"><button class="nx-btn quiet" id="qzBack"' + (st.i ? '' : ' disabled') + '>Back</button><button class="nx-btn primary" id="qzNext"' + (st.ans[st.i] == null ? ' disabled' : '') + '>' + (last ? 'Submit answers' : 'Next') + '</button></div>';
    $$('.nx-qzopt', host).forEach(b => b.onclick = () => { st.ans[st.i] = Number(b.dataset.k); $$('.nx-qzopt', host).forEach(x => x.setAttribute('aria-checked', String(x === b))); $('#qzNext', host).disabled = false; });
    $('#qzBack', host).onclick = () => { if (st.i) { st.i--; paint(); } };
    $('#qzNext', host).onclick = async e => {
      if (st.ans[st.i] == null) return;
      if (!last) { st.i++; paint(); return; }
      const miss = t.questions.findIndex((_, i) => st.ans[i] == null);
      if (miss >= 0) { st.i = miss; paint(); return; }
      if (st.saving) return; st.saving = true; const btn = e.currentTarget; btn.classList.add('busy'); btn.disabled = true;
      let score = 0; t.questions.forEach((qq, i) => { if (st.ans[i] === qq.correct) score++; });
      const passed = score / total * 100 >= t.pass_pct;
      try {
        if (t.kind === 'standard') await ins('training_quiz_results', { staff_name: ME.name, quiz_id: t.id, score, total, passed, answers: st.ans }, true);
        else await ins('custom_quiz_results', { quiz_id: t.id, staff_name: ME.name, score, total, passed, answers: st.ans }, true);
        st.result = { score, passed }; paint();
      } catch (err) { st.saving = false; btn.classList.remove('busy'); btn.disabled = false; const eb = $('#qzErr', host); eb.hidden = false; eb.textContent = 'Your answers were not saved. ' + err.message; }
    };
  };
  paint();
}
