/* ═══════════════════════════════════════════════════════════════════════
   quizreview.js — post-quiz answer breakdown for Nexus
   Loaded by index.html:  <script src="quizreview.js?v=1"></script>

   Separate module by convention (see ARCHITECTURE.md): index.html is already
   ~1.2 MB and new features must not be added inline.

   Serves BOTH quiz systems — the built-in TRAINING_QUIZ (checklist_v1) and
   document-attached custom quizzes — because both use the same question
   shape: { q, options[], correct }.

   Exposes:
     window.quizReviewHtml(questions, answers)  → breakdown markup
     window.toggleQuizReview()                  → show/hide handler
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  /**
   * Per-question breakdown.
   *
   * Shows every question, marked right or wrong, with the person's answer and —
   * only where they got it wrong — the correct one. A quiz someone failed is a
   * teaching moment, so the wrong ones carry the detail and the right ones stay
   * compact enough to scan past.
   *
   * Unanswered questions are called out separately from wrong ones: "you skipped
   * this" and "you got this wrong" are different problems.
   */
  function quizReviewHtml(questions, answers){
    questions = questions || [];
    answers   = answers   || {};

    var wrong = [];
    questions.forEach(function(q, i){
      if(answers[i] !== q.correct) wrong.push(i);
    });

    var html = '';

    // Summary line — what to do next, before the detail.
    if(!wrong.length){
      html += '<div style="font-size:13px;color:#065f46;background:#f0fdf4;border:1px solid #bbf7d0;'+
              'border-radius:10px;padding:12px 14px;margin-bottom:14px;text-align:left;font-weight:600;">'+
              'Every answer correct — nothing to review.</div>';
    }else{
      html += '<div style="font-size:13px;color:#475569;background:#fffbeb;border:1px solid #fde68a;'+
              'border-radius:10px;padding:12px 14px;margin-bottom:14px;text-align:left;">'+
              '<strong>'+wrong.length+' to review</strong> — question'+(wrong.length===1?' ':'s ')+
              wrong.map(function(i){ return i+1; }).join(', ')+'.</div>';
    }

    questions.forEach(function(q, i){
      var picked  = answers[i];
      var skipped = (picked === undefined || picked === null);
      var ok      = (picked === q.correct);

      var accent  = ok ? '#10b981' : (skipped ? '#94a3b8' : '#dc2626');
      var tintBg  = ok ? '#f0fdf4' : (skipped ? '#f8fafc' : '#fef2f2');
      var tintBd  = ok ? '#bbf7d0' : (skipped ? '#e2e8f0' : '#fecaca');
      var label   = ok ? 'Correct' : (skipped ? 'Not answered' : 'Incorrect');

      html += '<div style="border:1px solid '+tintBd+';background:'+tintBg+';border-radius:12px;'+
              'padding:13px 15px;margin-bottom:9px;text-align:left;">';

      // Header: number + verdict
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px;">'+
                '<div style="width:20px;height:20px;border-radius:50%;background:'+accent+';color:#fff;'+
                  'font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;'+
                  'flex-shrink:0;">'+(i+1)+'</div>'+
                '<div style="font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;'+
                  'color:'+accent+';">'+label+'</div>'+
              '</div>';

      // The question
      html += '<div style="font-size:13.5px;font-weight:600;color:#0f172a;line-height:1.45;'+
              'margin-bottom:9px;">'+esc(q.q)+'</div>';

      var opts = q.options || [];

      if(ok){
        html += '<div style="font-size:12.5px;color:#065f46;line-height:1.4;">'+
                '<strong>Your answer:</strong> '+esc(opts[picked])+'</div>';
      }else{
        if(skipped){
          html += '<div style="font-size:12.5px;color:#64748b;line-height:1.4;margin-bottom:5px;">'+
                  'You didn\'t answer this one.</div>';
        }else{
          html += '<div style="font-size:12.5px;color:#b91c1c;line-height:1.4;margin-bottom:5px;">'+
                  '<strong>Your answer:</strong> '+esc(opts[picked])+'</div>';
        }
        html += '<div style="font-size:12.5px;color:#065f46;line-height:1.4;">'+
                '<strong>Correct answer:</strong> '+esc(opts[q.correct])+'</div>';
      }

      // Optional explanation, if the quiz author wrote one.
      if(q.explain || q.explanation){
        html += '<div style="font-size:12px;color:#475569;line-height:1.5;margin-top:8px;'+
                'padding-top:8px;border-top:1px dashed '+tintBd+';">'+
                esc(q.explain || q.explanation)+'</div>';
      }

      html += '</div>';
    });

    return html;
  }

  /**
   * Collapsible wrapper. The score stays the headline; the breakdown is one tap
   * away so the result screen isn't a wall of text before someone has taken in
   * whether they passed.
   */
  function quizReviewBlock(questions, answers){
    var wrongCount = 0;
    (questions || []).forEach(function(q, i){
      if((answers || {})[i] !== q.correct) wrongCount++;
    });
    var caption = wrongCount
      ? ('Review your answers (' + wrongCount + ' to check)')
      : 'Review your answers';

    return '<div style="margin-bottom:18px;text-align:left;">'+
             '<button type="button" onclick="toggleQuizReview()" id="quizReviewBtn" '+
               'style="width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;'+
               'padding:11px 14px;font-size:13px;font-weight:700;color:#334155;cursor:pointer;'+
               'display:flex;align-items:center;justify-content:space-between;gap:8px;">'+
               '<span>'+caption+'</span><span id="quizReviewChevron" style="font-size:11px;'+
               'color:#94a3b8;">Show</span>'+
             '</button>'+
             '<div id="quizReviewBody" style="display:none;margin-top:12px;max-height:46vh;'+
               'overflow-y:auto;padding-right:2px;">'+
               quizReviewHtml(questions, answers)+
             '</div>'+
           '</div>';
  }

  function toggleQuizReview(){
    var body = document.getElementById('quizReviewBody');
    var chev = document.getElementById('quizReviewChevron');
    if(!body) return;
    var open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'block';
    if(chev) chev.textContent = open ? 'Show' : 'Hide';
  }

  window.quizReviewHtml  = quizReviewHtml;
  window.quizReviewBlock = quizReviewBlock;
  window.toggleQuizReview = toggleQuizReview;
})();
