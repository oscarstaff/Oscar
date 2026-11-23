'use strict';
/* pl-quizzes.js · Yatra · Quizzes (copied from Nexus).
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
    items.push({ kind: 'standard', id: STD_QUIZ.id, title: STD_QUIZ.title.replace(' — ', ': '), sub: has.has(STD_QUIZ.id) ? 'Required knowledge check for the Checklist team' : 'You see this as an admin. Access is granted in Nexus.', questions: Array.isArray(o.questions) && o.questions.length ? o.questions : STD_QUIZ.questions, pass_pct: o.pass_pct || STD_QUIZ.pass_pct, result: (stdRes && stdRes[0]) || null });
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
        return '<li><div class="nx-qz"><b>' + esc(t.title) + (t.draft ? ' <span class="nx-tag">Draft</span>' : '') + '</b><small>' + esc(t.sub) + ' · ' + t.questions.length + (t.questions.length === 1 ? ' question' : ' questions') + ' · pass mark ' + t.pass_pct + '%' + (r && r.created_at ? ' · taken ' + esc(fmtDate(r.created_at)) : '') + '</small>' + (t.doc ? '<small>' + (u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc(t.doc.title) + '</a>' : esc(t.doc.title)) + '</small>' : '') + '</div><span class="nx-btnrow">' + st + (canTake ? '<button class="nx-btn sm ' + (r ? '' : 'primary') + '" data-take="' + esc(t.id) + '">' + (r ? 'Take again' : 'Start quiz') + '</button>' : '') + '</span></li>';
      }).join('') + '</ul>' : empty(QZ.filter === 'todo' ? 'Nothing left to do' : QZ.filter === 'done' ? 'No passed quizzes yet' : 'No quizzes assigned yet', QZ.filter === 'all' ? 'When a quiz is assigned to you in Nexus it shows up here as well.' : '');
      $$('[data-take]', body).forEach(b => b.onclick = () => { const t = QZ.items.find(x => String(x.id) === b.dataset.take); if (t) takeQuiz(t); });
    };
    $$('#qzSeg button').forEach(b => b.onclick = () => { QZ.filter = b.dataset.v; $$('#qzSeg button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); paint(); });
    paint();
  });
  return pageHead('book', total ? passed + ' of ' + total + ' passed' : 'Same quizzes as Nexus', 'Quizzes', '') +
    (total ? '<div class="nx-card"><div class="nx-card-b nx-qzprog"><div><span class="nx-big">' + pct + '%</span> <span class="nx-muted">complete</span></div><div class="nx-meter-bar" role="img" aria-label="' + pct + ' percent complete"><i style="width:' + pct + '%"></i></div></div></div>' : '') +
    '<div class="nx-card"><div class="nx-toolbar" style="border-top:0"><div class="nx-seg" id="qzSeg" role="group" aria-label="Show">' + [['all', 'All', total], ['todo', 'To do', todo], ['done', 'Passed', passed]].map(([v, l, c]) => '<button type="button" data-v="' + v + '" aria-pressed="' + (QZ.filter === v) + '">' + l + ' <span class="nx-count">' + c + '</span></button>').join('') + '</div></div><div id="qzBody"></div></div>';
});
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
