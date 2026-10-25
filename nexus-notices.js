/* ── SHIFT-CHANGE NOTICES ─────────────────────────────────────────────────
   When a shift in an already-PUBLISHED week is changed, moved, removed or
   added, the database (trigger on roster_shifts) writes a row to
   roster_change_notices for that person. Here we show it as a popup that stays
   until they tap "Got it", and drop a line in the bell. Reads fail soft: if the
   table is missing or the call fails we simply show nothing. */
let _rcnShown=new Set(), _rcnBusy=false;
function _rcnT(t){ const m=/^(\d{1,2}):(\d{2})/.exec(String(t||'')); if(!m) return ''; let h=+m[1]; const ap=h>=12?'pm':'am'; h=h%12||12; return h+':'+m[2]+' '+ap; }
function _rcnD(d){ try{ return new Date(d+'T00:00:00').toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'}); }catch(e){ return String(d||''); } }
function _rcnEsc(v){ return String(v==null?'':v).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
function _rcnAdd(iso,n){ const d=new Date(iso+'T00:00:00'); d.setDate(d.getDate()+n); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function _rcnHrs(list){ let m=0; (list||[]).forEach(function(x){ const a=/^(\d+):(\d+)/.exec(x.start_time||''), b=/^(\d+):(\d+)/.exec(x.end_time||''); if(a&&b) m+=Math.max(0,(+b[1]*60+ +b[2])-(+a[1]*60+ +a[2])); }); return Math.round(m/6)/10; }
function _rcnLine(r){
  const oldTxt=r.old_date?(_rcnD(r.old_date)+' · '+_rcnT(r.old_start)+' – '+_rcnT(r.old_end)):'';
  const newTxt=r.new_date?(_rcnD(r.new_date)+' · '+_rcnT(r.new_start)+' – '+_rcnT(r.new_end)):'';
  return {oldTxt:oldTxt,newTxt:newTxt};
}
async function checkShiftChangeNotices(){
  if(!me || _rcnBusy) return;
  _rcnBusy=true;
  try{
    const rows=await sbGet('roster_change_notices','?staff_name=eq.'+encodeURIComponent(me)+'&seen_at=is.null&order=created_at.asc&limit=30');
    if(!Array.isArray(rows)||!rows.length){ const el=document.getElementById('rcnModal'); if(el) el.remove(); return; }
    const pubs=rows.filter(function(r){ return r.kind==='published' && r.new_date; });
    if(pubs.length){
      const wks=pubs.map(function(r){return r.new_date;}).sort();
      let sh=[];
      try{ sh=await sbGet('roster_shifts','?staff_name=eq.'+encodeURIComponent(me)+'&shift_date=gte.'+wks[0]+'&shift_date=lte.'+_rcnAdd(wks[wks.length-1],6)+
        '&status=neq.open&select=shift_date,start_time,end_time,status&order=shift_date.asc,start_time.asc')||[]; }catch(e){}
      pubs.forEach(function(r){ const end=_rcnAdd(r.new_date,6); r._shifts=(sh||[]).filter(function(x){ return x.shift_date>=r.new_date && x.shift_date<=end; }); });
    }
    rows.sort(function(a,b){ return (a.kind==='published'?0:1)-(b.kind==='published'?0:1); });
    const fresh=rows.filter(function(r){ return !_rcnShown.has(r.id+'|'+(r.created_at||'')); });
    rows.forEach(function(r){ _rcnShown.add(r.id+'|'+(r.created_at||'')); });
    fresh.forEach(function(r){
      try{
        if(typeof NotifManager!=='undefined' && NotifManager.push){
          const l=_rcnLine(r);
          const isPub=r.kind==='published';
          NotifManager.push({ id:'rcn_'+r.id+'_'+(Date.parse(r.created_at)||0), type:'general',
            title: isPub?'Your roster is out':(r.kind==='cancelled'?'Shift removed':(r.kind==='added'?'New shift added':'Your shift changed')),
            body: isPub ? ('Week of '+_rcnD(r.new_date)+' · '+((r._shifts||[]).length)+' shift'+(((r._shifts||[]).length===1)?'':'s')+' · '+_rcnHrs(r._shifts)+'h')
                        : (r.kind==='changed'? (l.oldTxt+' → '+l.newTxt) : (l.newTxt||l.oldTxt)),
            ts: Date.parse(r.created_at)||Date.now(), link:null });
        }
      }catch(e){}
    });
    if(fresh.length || !document.getElementById('rcnModal')) _rcnRender(rows);
  }catch(e){ console.warn('checkShiftChangeNotices',e); }
  finally{ _rcnBusy=false; }
}
function _rcnRender(rows){
  let el=document.getElementById('rcnModal');
  if(el) el.remove();
  el=document.createElement('div'); el.id='rcnModal'; el.setAttribute('role','alertdialog'); el.setAttribute('aria-modal','true');
  el.style.cssText='position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px';
  const allPub=rows.every(function(r){ return r.kind==='published'; });
  const items=rows.map(function(r){
    if(r.kind==='published'){
      const list=r._shifts||[];
      const lines=list.length ? list.map(function(x){ return '<div style="display:flex;justify-content:space-between;gap:10px;padding:3px 0;font-size:14px"><span>'+_rcnEsc(_rcnD(x.shift_date))+'</span><b>'+_rcnT(x.start_time)+' – '+_rcnT(x.end_time)+'</b></div>'; }).join('')
                              : '<div style="font-size:13px;opacity:.75">No shifts for you this week.</div>';
      return '<div style="padding:11px 13px;margin:0 0 9px;border:1px solid var(--ui-line,#e2e8f0);border-left:4px solid #3b82f6;border-radius:10px;background:var(--ui-surface-2,transparent)">'+
             '<div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#3b82f6;margin-bottom:6px"><span>Week of '+_rcnEsc(_rcnD(r.new_date))+'</span>'+(list.length?'<span>'+_rcnHrs(list)+'h</span>':'')+'</div>'+lines+'</div>';
    }
    const l=_rcnLine(r);
    const label=r.kind==='cancelled'?'Shift removed':(r.kind==='added'?'New shift':'Shift changed');
    const col=r.kind==='cancelled'?'#ef4444':(r.kind==='added'?'#10b981':'#f59e0b');
    let body='';
    if(r.kind==='changed') body='<div style="text-decoration:line-through;opacity:.6;font-size:13px">'+_rcnEsc(l.oldTxt)+'</div><div style="font-weight:800;font-size:15px;margin-top:2px">'+_rcnEsc(l.newTxt)+'</div>';
    else if(r.kind==='cancelled') body='<div style="text-decoration:line-through;opacity:.7;font-size:14px">'+_rcnEsc(l.oldTxt)+'</div>';
    else body='<div style="font-weight:800;font-size:15px">'+_rcnEsc(l.newTxt)+'</div>';
    return '<div style="padding:11px 13px;margin:0 0 9px;border:1px solid var(--ui-line,#e2e8f0);border-left:4px solid '+col+';border-radius:10px;background:var(--ui-surface-2,transparent)">'+
           '<div style="font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:'+col+';margin-bottom:4px">'+label+'</div>'+body+'</div>';
  }).join('');
  el.innerHTML='<div style="width:min(440px,100%);max-height:86vh;overflow:auto;border-radius:18px;padding:20px;background:var(--ui-surface,#fff);color:var(--ui-ink,#0f172a);box-shadow:0 20px 60px rgba(0,0,0,.4)">'+
    (allPub ? '<div style="font-size:17px;font-weight:800;margin:0 0 4px">Your roster is out</div><div style="font-size:13px;opacity:.75;margin:0 0 14px">Here are your shifts. You\'ll get a message here if anything changes.</div>'
            : '<div style="font-size:17px;font-weight:800;margin:0 0 4px">Your roster was updated</div><div style="font-size:13px;opacity:.75;margin:0 0 14px">'+(rows.length>1?'These shifts changed':'This shift changed')+' after the roster was published.</div>')+
    items+
    '<button id="rcnAck" style="width:100%;margin-top:6px;padding:12px;border:0;border-radius:12px;font-size:14px;font-weight:800;cursor:pointer;background:var(--ui-accent,#2563eb);color:#fff">Got it</button></div>';
  document.body.appendChild(el);
  document.getElementById('rcnAck').onclick=function(){ _rcnAck(rows.map(function(r){return r.id;}), this); };
}
async function _rcnAck(ids, btn){
  if(btn){ btn.disabled=true; btn.textContent='Saving…'; }
  try{
    const r=await fetch(SB+'/rest/v1/roster_change_notices?id=in.('+ids.map(encodeURIComponent).join(',')+')',{
      method:'PATCH',
      headers:{apikey:KEY,Authorization:'Bearer '+_sbBearer(),'Content-Type':'application/json',Prefer:'return=minimal'},
      body:JSON.stringify({seen_at:new Date().toISOString()})
    });
    if(!r.ok) throw new Error('HTTP '+r.status);
    const el=document.getElementById('rcnModal'); if(el) el.remove();
    try{ if(typeof loadMyRoster==='function') loadMyRoster(); }catch(e){}
    try{ if(typeof loadHomeData==='function') loadHomeData(); }catch(e){}
  }catch(e){
    console.warn('rcn ack',e);
    if(btn){ btn.disabled=false; btn.textContent='Got it'; }
    try{ showToast('Couldn\'t save — try again'); }catch(_){}
  }
}
(function(){
  if(window._rcnBound) return; window._rcnBound=true;
  document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='visible') checkShiftChangeNotices(); });
  setInterval(function(){ if(!document.hidden) checkShiftChangeNotices(); }, 180000);
})();

async function checkNewNotifications(){
  if(!me) return;
  checkNewDiscussions();
  try{
    const rows=await sbGet('leave_submissions','?staff_name=eq.'+encodeURIComponent(me)+'&status=in.(approved,declined)&order=submitted_at.desc&limit=5');
    const read=JSON.parse(localStorage.getItem('oR_'+me)||'[]');
    const _MAXAGE=14*24*3600*1000;
    const _fresh=(ts)=>{ if(!ts) return true; const t=new Date(ts).getTime(); return isNaN(t)?true:(Date.now()-t)<_MAXAGE; };
    const unread=rows.filter(r=>!read.includes(r.id));
    if(unread.length){
      const r=unread[0];
      const bannerKey='banner_shown_'+me+'_'+r.id;
      if(!localStorage.getItem(bannerKey)){
        if(typeof triggerBellPulse === 'function') triggerBellPulse();
        const approved=r.status==='approved';
        const title=approved ? 'Leave Approved' : 'Leave Declined';
        showBanner(title, fmtF(r.from_date)+' - '+fmtF(r.to_date), approved ? 'success' : 'warning');
        if(typeof NotifManager !== 'undefined' && NotifManager.push){
          NotifManager.push({
            id: 'leave-'+r.id,
            type: approved ? 'leave-approved' : 'leave-declined',
            title: title,
            body: fmtF(r.from_date)+' - '+fmtF(r.to_date) + (r.decline_reason?' · '+r.decline_reason:''),
            ts: Date.now(),
            link: 'leave'
          });
        }
        localStorage.setItem(bannerKey,'1');
      }
    }
  }catch(e){console.warn(e);}
}



const TRAINING_QUIZ = {
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
      q: 'When is "conversion" considered complete for a lead?',
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

let _quizState = { 
  started: false,
  current: 0,
  answers: {},
  result: null
};

async function refreshQuizStrip(){
  const strip = document.getElementById('quizStrip');
  if(!strip) return;
  if(myIsAdmin){
    renderQuizAdminPanel();
  }
  if(myIsAdmin){
    strip.style.display = 'flex';
  } else {
    try{
      const access = await sbGet('quiz_access', '?staff_name=eq.'+encodeURIComponent(me)+'&quiz_id=eq.'+TRAINING_QUIZ.id);
      if(!access || !access.length){
        strip.style.display = 'none';
        return;
      }
    }catch(e){ strip.style.display = 'none'; return; }
    strip.style.display = 'flex';
  }
  const editBtn = document.getElementById('quizEditBtn');
  if(editBtn) editBtn.style.display = myIsAdmin ? 'inline-block' : 'none';
  const manageBtn = document.getElementById('quizManageBtn');
  if(manageBtn) manageBtn.style.display = myIsAdmin ? 'inline-block' : 'none';
  try{
    const results = await sbGet('training_quiz_results', '?staff_name=eq.'+encodeURIComponent(me)+'&quiz_id=eq.'+TRAINING_QUIZ.id+'&order=created_at.desc&limit=1');
    if(results && results.length){
      const r = results[0];
      const title = document.getElementById('quizStripTitle');
      const sub = document.getElementById('quizStripSub');
      const status = document.getElementById('quizStripStatus');
      const icon = document.getElementById('quizStripIcon');
      if(r.passed){
        title.textContent = 'Standard Knowledge Quiz: Passed ✓';
        sub.textContent = 'Score: '+r.score+'/'+r.total+' ('+Math.round(r.score/r.total*100)+'%) — Completed';
        status.textContent = 'Completed';
        status.style.background = '#10b981';
        icon.style.background = '#d1fae5';
        icon.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
        strip.style.cursor = 'default';
        strip.onclick = function(){ showToast('Already passed — speak with admin to retake', 'info'); };
      } else {
        title.textContent = 'Standard Knowledge Quiz: Needs review';
        sub.textContent = 'Score: '+r.score+'/'+r.total+' ('+Math.round(r.score/r.total*100)+'%) — Speak with your manager';
        status.textContent = 'Non-compliant';
        status.style.background = '#dc2626';
        icon.style.background = '#fee2e2';
        icon.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
        strip.style.cursor = 'default';
        strip.onclick = function(){ showToast('Quiz already submitted. Speak with your manager about retaking.', 'info'); };
      }
    }
  }catch(e){ console.warn('quiz strip:', e); }
}


async function renderQuizAdminPanel(){
  const panel = document.getElementById('quizAdminPanel');
  if(!panel || !myIsAdmin) return;
  panel.style.display = 'block';
  try{
    const results = await sbGet('training_quiz_results', '?quiz_id=eq.'+TRAINING_QUIZ.id+'&order=created_at.desc&limit=200');
    
    const latestByStaff = {};
    (results||[]).forEach(function(r){ if(!latestByStaff[r.staff_name]) latestByStaff[r.staff_name] = r; });
    const failed = Object.values(latestByStaff).filter(function(r){return !r.passed;});
    const passed = Object.values(latestByStaff).filter(function(r){return r.passed;});
    
    let html = '<div style="background:var(--ui-surface,#fff);border:1.5px solid var(--ui-line,#e2e8f0);border-radius:12px;padding:14px 16px;">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:'+(failed.length?'12':'0')+'px;flex-wrap:wrap;gap:10px;">'+
        '<div style="font-size:13.5px;font-weight:700;color:var(--ui-ink,#0f172a);">Standard Knowledge Quiz — Oscars</div>'+
        '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">'+
          '<div style="background:#d1fae5;color:#065f46;font-size:11px;font-weight:700;padding:3px 9px;border-radius:10px;">'+passed.length+' passed</div>'+
          '<div style="background:#fee2e2;color:#991b1b;font-size:11px;font-weight:700;padding:3px 9px;border-radius:10px;">'+failed.length+' need review</div>'+
          '<button onclick="openStaffDirectory()" style="background:#0f172a;color:#fff;border:none;border-radius:8px;padding:5px 12px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;">Manage access →</button>'+
        '</div>'+
      '</div>';
    if(failed.length){
      html += '<div style="max-height:200px;overflow-y:auto;">';
      failed.forEach(function(r){
        const dt = new Date(r.created_at).toLocaleDateString('en-AU',{day:'numeric',month:'short'});
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--ui-line-soft,#f1f5f9);">'+
          '<div><div style="font-size:12.5px;font-weight:600;color:var(--ui-ink,#0f172a);">'+esc(r.staff_name)+'</div>'+
          '<div style="font-size:10.5px;color:var(--ui-ink-3,#64748b);">Score '+r.score+'/'+r.total+' · '+dt+'</div></div>'+
          '<div style="display:flex;gap:5px;">'+
            '<button onclick="viewQuizAttemptDetail(\''+r.staff_name.replace(/'/g,"\\'")+'\','+r.id+')" style="background:#0f172a;color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:10px;font-weight:600;cursor:pointer;font-family:inherit;">Review</button>'+
            '<button onclick="resetStaffQuiz(\''+r.staff_name.replace(/'/g,"\\'")+'\','+r.id+')" style="background:#3b82f6;color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:10px;font-weight:600;cursor:pointer;font-family:inherit;">Allow retake</button>'+
          '</div>'+
        '</div>';
      });
      html += '</div>';
    }
    html += '</div>';
    panel.innerHTML = html;
  }catch(e){ console.warn('quiz admin:', e); panel.innerHTML = '<div style="padding:14px;background:#fee2e2;border-radius:10px;color:#991b1b;font-size:12px;">Failed to load: '+esc(e.message)+'</div>'; }
}



async function toggleQuizAccess(staffName, quizId, grant){
  try{
    if(grant){
      await sbPost('quiz_access', {staff_name: staffName, quiz_id: quizId, granted_by: me});
      showToast('Access granted to '+staffName);
    } else {
      await fetch(SB+'/rest/v1/quiz_access?staff_name=eq.'+encodeURIComponent(staffName)+'&quiz_id=eq.'+quizId, {
        method:'DELETE',
        headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}
      });
      showToast('Access revoked for '+staffName);
    }
    renderQuizAdminPanel();
  }catch(e){ showToast('Failed: '+e.message, 'error'); }
}

async function resetStaffQuiz(staffName, resultId){
  if(!confirm('Delete this quiz attempt for '+staffName+'? They will be able to retake.')) return;
  try{
    await fetch(SB+'/rest/v1/training_quiz_results?id=eq.'+resultId, {
      method:'DELETE',
      headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}
    });
    showToast(staffName+' can now retake the quiz');
    renderQuizAdminPanel();
  }catch(e){ showToast('Failed: '+e.message, 'error'); }
}

function openTrainingQuiz(){
  _quizState = { started: true, current: 0, answers: {}, result: null };
  let bd = document.getElementById('quizBack');
  if(!bd){
    bd = document.createElement('div');
    bd.id = 'quizBack';
    bd.style.cssText = 'position:fixed;inset:0;z-index:9700;background:rgba(15,23,42,.65);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:16px;';
    document.body.appendChild(bd);
  }
  renderQuizModal();
}

function renderQuizModal(){
  const bd = document.getElementById('quizBack');
  if(!bd) return;
  const total = TRAINING_QUIZ.questions.length;
  
  if(_quizState.result){
    const r = _quizState.result;
    const pct = Math.round(r.score/total*100);
    const passed = pct >= TRAINING_QUIZ.pass_pct;
    bd.innerHTML = '<div style="background:var(--ui-surface,#fff);border-radius:16px;width:100%;max-width:540px;padding:36px 28px;text-align:center;box-shadow:0 24px 60px rgba(15,23,42,.3);">'+
      (passed ?
        '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 12px;display:block;"><circle cx="12" cy="12" r="10"/><polyline points="9 12 12 15 17 10"/></svg>'+
        '<div style="font-size:22px;font-weight:800;color:#10b981;margin-bottom:6px;">Passed! </div>'
        :
        '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 12px;display:block;"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'+
        '<div style="font-size:22px;font-weight:800;color:#dc2626;margin-bottom:6px;">Needs review</div>'
      )+
      '<div style="font-size:30px;font-weight:900;color:var(--ui-ink,#0f172a);margin-bottom:6px;letter-spacing:-.02em;">'+r.score+' / '+total+'</div>'+
      '<div style="font-size:14px;color:var(--ui-ink-3,#64748b);margin-bottom:22px;">Score: '+pct+'% — Pass mark: '+TRAINING_QUIZ.pass_pct+'%</div>'+
      (passed ?
        '<div style="font-size:13px;color:var(--ui-ink-2b,#475569);background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;margin-bottom:18px;text-align:left;">Great work! You can now proceed with checklist team tasks. This result is recorded.</div>'
        :
        '<div style="font-size:13px;color:var(--ui-ink-2b,#475569);background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px;margin-bottom:18px;text-align:left;">Your manager has been notified to review the training material with you. They can re-open the quiz for you to retake once you\'re ready.</div>'
      )+
      (typeof quizReviewBlock === 'function'
         ? quizReviewBlock(TRAINING_QUIZ.questions, _quizState.answers) : '')+
      '<button onclick="closeQuizModal()" class="btn btn-green" style="padding:11px 28px;font-size:14px;">Done</button>'+
    '</div>';
    return;
  }
  
  const i = _quizState.current;
  const q = TRAINING_QUIZ.questions[i];
  const selected = _quizState.answers[i];
  const pct = Math.round((i+1)/total*100);
  
  let html = '<div style="background:var(--ui-surface,#fff);border-radius:16px;width:100%;max-width:600px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(15,23,42,.3);overflow:hidden;">';
  
  html += '<div style="padding:18px 22px;border-bottom:1px solid var(--ui-line-soft,#f1f5f9);">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">';
  html += '<div style="font-size:15px;font-weight:700;color:var(--ui-ink,#0f172a);">'+esc(TRAINING_QUIZ.title)+'</div>';
  html += '<div style="font-size:12px;color:var(--ui-ink-3,#64748b);font-weight:600;">Question '+(i+1)+' of '+total+'</div>';
  html += '</div>';
  html += '<div style="background:var(--ui-surface-3,#f1f5f9);height:5px;border-radius:4px;overflow:hidden;"><div style="background:#3b82f6;height:100%;width:'+pct+'%;transition:width .3s;"></div></div>';
  html += '</div>';
  
  html += '<div style="padding:24px 22px;overflow-y:auto;flex:1;">';
  html += '<div style="font-size:15px;font-weight:600;color:var(--ui-ink,#0f172a);line-height:1.5;margin-bottom:18px;">'+esc(q.q)+'</div>';
  
  q.options.forEach(function(opt, idx){
    const isSelected = selected === idx;
    html += '<div onclick="selectQuizAnswer('+idx+')" style="border:1.5px solid '+(isSelected?'#3b82f6':'#e2e8f0')+';background:'+(isSelected?'#eff6ff':'#fff')+';border-radius:10px;padding:13px 16px;margin-bottom:8px;cursor:pointer;transition:all .15s;display:flex;align-items:flex-start;gap:11px;">';
    html += '<div style="width:18px;height:18px;border-radius:50%;border:2px solid '+(isSelected?'#3b82f6':'#cbd5e1')+';flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;">';
    if(isSelected) html += '<div style="width:8px;height:8px;border-radius:50%;background:#3b82f6;"></div>';
    html += '</div>';
    html += '<div style="font-size:13.5px;color:var(--ui-ink,#0f172a);line-height:1.45;flex:1;">'+opt.replace(/</g,'&lt;')+'</div>';
    html += '</div>';
  });
  
  html += '</div>';
  
  html += '<div style="padding:14px 22px;border-top:1px solid var(--ui-line-soft,#f1f5f9);display:flex;justify-content:space-between;align-items:center;gap:8px;">';
  html += '<button onclick="closeQuizModal()" style="background:none;border:none;color:var(--ui-ink-3,#64748b);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">Cancel</button>';
  html += '<div style="display:flex;gap:8px;">';
  if(i > 0){
    html += '<button onclick="prevQuizQ()" class="btn btn-outline" style="padding:9px 18px;font-size:13px;">← Back</button>';
  }
  if(i < total - 1){
    html += '<button onclick="nextQuizQ()" '+(selected === undefined?'disabled':'')+' class="btn btn-green" style="padding:9px 18px;font-size:13px;'+(selected === undefined?'opacity:.5;cursor:not-allowed;':'')+'">Next →</button>';
  } else {
    html += '<button onclick="submitQuiz()" '+(selected === undefined?'disabled':'')+' class="btn btn-green" style="padding:9px 18px;font-size:13px;'+(selected === undefined?'opacity:.5;cursor:not-allowed;':'')+'">Submit</button>';
  }
  html += '</div></div>';
  
  html += '</div>';
  bd.innerHTML = html;
}

function selectQuizAnswer(idx){
  _quizState.answers[_quizState.current] = idx;
  renderQuizModal();
}

function nextQuizQ(){ if(_quizState.answers[_quizState.current] !== undefined){ _quizState.current++; renderQuizModal(); } }
function prevQuizQ(){ if(_quizState.current > 0){ _quizState.current--; renderQuizModal(); } }

async function submitQuiz(){
  let score = 0;
  TRAINING_QUIZ.questions.forEach(function(q, i){
    if(_quizState.answers[i] === q.correct) score++;
  });
  const total = TRAINING_QUIZ.questions.length;
  const pct = score/total*100;
  const passed = pct >= TRAINING_QUIZ.pass_pct;
  
  _quizState.result = { score: score, total: total };
  
  try{
    await sbPost('training_quiz_results', {
      staff_name: me,
      quiz_id: TRAINING_QUIZ.id,
      score: score,
      total: total,
      passed: passed,
      answers: _quizState.answers
    });
    if(!passed){
      try{
        if(typeof sendPushTo === 'function'){
        }
      }catch(e){}
    }
  }catch(e){
    console.warn('quiz save:', e);
    showToast('Failed to save results — please try again', 'error');
    return;
  }
  
  renderQuizModal();
  refreshQuizStrip();
}

function closeQuizModal(){
  const bd = document.getElementById('quizBack');
  if(bd) bd.remove();
}





function scrollToTrainingItem(quizId){
  const tryScroll = function(attempts){
    if(attempts <= 0) return;
    const card = document.querySelector('[data-quiz-id="'+quizId+'"]');
    if(card){
      card.scrollIntoView({behavior:'smooth', block:'center'});
      card.style.outline = '3px solid #3b82f6';
      card.style.outlineOffset = '4px';
      setTimeout(function(){ card.style.outline = ''; card.style.outlineOffset = ''; }, 2500);
    } else {
      setTimeout(function(){ tryScroll(attempts-1); }, 200);
    }
  };
  tryScroll(15);
}


let _lrnFilter='all';
function lrnSetFilter(f,btn){
  _lrnFilter=f;
  document.querySelectorAll('#lrnToolbar .lrn-chip').forEach(function(c){c.classList.remove('on');});
  if(btn) btn.classList.add('on');
  lrnRenderList();
}
function lrnRenderList(){
  const el=document.getElementById('trainingList');
  const items=window._lrnItems||[];
  if(!el) return;
  let rows=items.slice();
  if(_lrnFilter==='todo') rows=rows.filter(function(t){return !(t.result&&t.result.passed);});
  if(_lrnFilter==='done') rows=rows.filter(function(t){return t.result&&t.result.passed;});
  const rank=function(t){ if(!t.result) return 0; return t.result.passed?2:1; };
  rows.sort(function(a,b){ return rank(a)-rank(b); });

  if(!rows.length){
    el.innerHTML='<div class="lrn-empty"><div style="font-size:13.5px;font-weight:700;color:var(--ui-ink-2b,#475569);margin-bottom:4px;">Nothing here</div><div style="font-size:12px;color:var(--ui-ink-4,#94a3b8);">Try a different filter.</div></div>';
    return;
  }

  let html='';
  rows.forEach(function(t){
    const isComplete = t.result && t.result.passed;
    const isFailed = t.result && !t.result.passed;
    const state = isComplete?'done':(isFailed?'failed':'todo');

    const icons={
      todo:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
      done:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
      failed:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
    };

    let statusBadge='';
    if(isComplete){
      const p=t.result.total?Math.round(t.result.score/t.result.total*100):0;
      statusBadge='<span class="lrn-badge done"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Passed · '+t.result.score+'/'+t.result.total+' ('+p+'%)</span>';
    } else if(isFailed){
      statusBadge='<span class="lrn-badge failed">Failed '+t.result.score+'/'+t.result.total+'</span>';
    } else {
      statusBadge='<span class="lrn-badge todo">To do</span>';
    }

    let docBlock='';
    if(t.documentUrl){
      docBlock='<a href="#" onclick="event.preventDefault();downloadPrivateDoc(\''+String(t.documentUrl).replace(/'/g,"\\'")+'\',\''+esc(t.documentTitle||'document').replace(/'/g,"\\'")+'\')" rel="noopener" class="lrn-doc">'+
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'+
        '<div style="flex:1;min-width:0;"><div class="lrn-doc-t">'+esc(t.documentTitle)+'</div><div class="lrn-doc-s">Tap to download, then read before the quiz</div></div>'+
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'+
      '</a>';
    }

    let actionBtn='';
    if(t.action === 'take_standard'){
      actionBtn='<button onclick="openTrainingQuiz()" class="lrn-takebtn">Take quiz</button>';
    } else if(t.action === 'take_custom'){
      actionBtn='<button onclick="takeCustomQuiz(\''+t.id+'\')" class="lrn-takebtn">Take quiz</button>';
    } else if(isComplete){
      actionBtn='<button disabled class="lrn-statebtn done">✓ Complete</button>';
    } else if(isFailed){
      actionBtn='<button disabled class="lrn-statebtn failed">Locked — contact admin</button>';
    }

    let adminCard='';
    if(myIsAdmin){
      adminCard='<div class="lrn-admin">'+
        '<span class="lrn-admin-lbl">Admin</span>'+
        '<button onclick="openQuizAdminPanel(\''+t.id+'\')" class="lrn-abtn" style="background:#0f172a;color:#fff;">Manage access</button>'+
        '<button onclick="downloadQuizReport(\''+t.id+'\',\''+t.title.replace(/['\\\\]/g,"")+'\')" class="lrn-abtn" style="background:#3b82f6;color:#fff;">Report</button>'+
        (t.kind === 'custom' ? '<button onclick="deleteQuizFromAdmin(\''+t.id+'\');setTimeout(renderMyTraining,400);" class="lrn-abtn" style="background:#7f1d1d;color:#fff;">Delete</button>' : '<button onclick="openQuizEditor()" class="lrn-abtn" style="background:#475569;color:#fff;">Edit</button>')+
      '</div>';
    }

    html+='<div data-quiz-id="'+t.id+'" class="lrn-card '+state+'">'+
      '<div class="lrn-hd">'+
        '<div class="lrn-ico '+state+'">'+icons[state]+'</div>'+
        '<div style="flex:1;min-width:0;">'+
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">'+
            '<div class="lrn-title">'+esc(t.title)+'</div>'+statusBadge+
          '</div>'+
          '<div class="lrn-sub">'+t.subtitle+'</div>'+
        '</div>'+
      '</div>'+
      docBlock+
      (actionBtn?'<div style="margin-top:13px;display:flex;justify-content:flex-end;">'+actionBtn+'</div>':'')+
      adminCard+
    '</div>';
  });
  el.innerHTML=html;
}

async function renderMyTraining(){
  const el = document.getElementById('trainingList');
  if(!el || !me) return;
  el.innerHTML = '<div style="padding:40px 16px;text-align:center;color:var(--ui-ink-4,#94a3b8);font-size:13px;">'+nxSkel('cards',3)+'</div>';
  
  try{
    const [stdAccess, stdResults, customQuizzes, customResults, docs] = await Promise.all([
      sbGet('quiz_access', '?staff_name=eq.'+encodeURIComponent(me)+'&quiz_id=eq.checklist_v1'),
      sbGet('training_quiz_results', '?staff_name=eq.'+encodeURIComponent(me)+'&quiz_id=eq.checklist_v1&order=created_at.desc&limit=1'),
      sbGet('custom_quizzes', '?order=created_at.desc'),
      sbGet('custom_quiz_results', '?staff_name=eq.'+encodeURIComponent(me)+'&order=created_at.desc'),
      sbGet('documents', '?order=created_at.desc')
    ]);
    
    const trainingItems = [];
    
    if((stdAccess && stdAccess.length) || myIsAdmin){
      const result = stdResults && stdResults[0];
      const hasAccess = (stdAccess && stdAccess.length) > 0;
      trainingItems.push({
        kind: 'standard',
        id: 'checklist_v1',
        title: 'Standard Knowledge Quiz — Oscars',
        subtitle: hasAccess ? 'Required compliance check for the Checklist Team' : 'Admin view — grant access to staff via Manage button',
        documentTitle: null,
        documentUrl: null,
        result: result,
        action: ((hasAccess || myIsAdmin) && !result) ? 'take_standard' : null
      });
    }
    
    const docsById = {};
    (docs||[]).forEach(function(d){ docsById[d.id] = d; });
    
    let customAccessSet = null;
    if(!myIsAdmin){
      try{
        const customAccess = await sbGet('quiz_access', '?staff_name=eq.'+encodeURIComponent(me));
        customAccessSet = new Set((customAccess||[]).map(function(a){return a.quiz_id;}));
      }catch(e){ customAccessSet = new Set(); }
    }
    (customQuizzes||[]).forEach(function(q){
      if(!myIsAdmin){
        if(customAccessSet && !customAccessSet.has(q.id)) return;
        if(q.status && q.status === 'draft') return;
      }
      const linkedDoc = docsById[q.document_id];
      const myResult = (customResults||[]).find(function(r){return r.quiz_id===q.id;});
      trainingItems.push({
        kind: 'custom',
        id: q.id,
        title: q.title,
        subtitle: linkedDoc ? 'Read the document below before taking the quiz' : 'Compliance quiz',
        documentTitle: linkedDoc ? linkedDoc.title : null,
        documentUrl: linkedDoc ? linkedDoc.url : null,
        result: myResult,
        action: myResult ? null : 'take_custom'
      });
    });
    
    const total = trainingItems.length;
    const passed = trainingItems.filter(function(t){return t.result && t.result.passed;}).length;
    const pct = total ? Math.round(passed/total*100) : 0;
    const card = document.getElementById('trainingProgressCard');
    if(total > 0){
      card.style.display = 'block';
      document.getElementById('trainingPctText').textContent = pct + '% complete';
      document.getElementById('trainingFracText').textContent = passed + '/' + total;
      document.getElementById('trainingProgressBar').style.width = pct + '%';
      const allSet=document.getElementById('trainingAllSet');
      if(allSet) allSet.style.display = (pct===100)?'flex':'none';
    } else {
      card.style.display = 'none';
    }

    if(!total){
      const tb=document.getElementById('lrnToolbar'); if(tb) tb.style.display='none';
      el.innerHTML = '<div class="lrn-empty">'+
        '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 14px;display:block;"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 .39.21.74.55.93l5 2.78c.31.17.69.17 1 0l5-2.78c.34-.19.55-.54.55-.93v-5"/></svg>'+
        '<div style="font-size:15px;font-weight:700;color:var(--ui-ink,#0f172a);margin-bottom:4px;">No training assigned yet</div>'+
        '<div style="font-size:13px;color:var(--ui-ink-3,#64748b);">When your manager assigns a compliance quiz or training document, it will appear here.</div>'+
        '</div>';
      const badge = document.getElementById('trainingBadge');
      if(badge) badge.style.display = 'none';
      return;
    }

    window._lrnItems = trainingItems;
    const tb=document.getElementById('lrnToolbar'); if(tb) tb.style.display='flex';
    const ctA=document.getElementById('lrnCtAll'), ctT=document.getElementById('lrnCtTodo'), ctD=document.getElementById('lrnCtDone');
    if(ctA) ctA.textContent=total;
    if(ctT) ctT.textContent=trainingItems.filter(function(t){return !(t.result&&t.result.passed);}).length;
    if(ctD) ctD.textContent=passed;
    lrnRenderList();
    
    const pending = trainingItems.filter(function(t){return !t.result;}).length;
    const badge = document.getElementById('trainingBadge');
    if(badge){
      if(pending > 0){
        badge.textContent = pending;
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }
    }
  }catch(e){
    el.innerHTML = '<div style="padding:30px 16px;text-align:center;color:#dc2626;font-size:13px;">Failed to load training: '+esc(e.message)+'</div>';
  }
}

async function refreshTrainingBadge(){
  if(!me) return;
  try{
    const [stdAccess, stdResults, customQuizzes, customResults] = await Promise.all([
      sbGet('quiz_access', '?staff_name=eq.'+encodeURIComponent(me)+'&quiz_id=eq.checklist_v1'),
      sbGet('training_quiz_results', '?staff_name=eq.'+encodeURIComponent(me)+'&quiz_id=eq.checklist_v1&limit=1'),
      sbGet('custom_quizzes', '?select=id'),
      sbGet('custom_quiz_results', '?staff_name=eq.'+encodeURIComponent(me)+'&select=quiz_id')
    ]);
    let pending = 0;
    if(stdAccess && stdAccess.length && (!stdResults || !stdResults.length)) pending++;
    const takenIds = new Set((customResults||[]).map(function(r){return r.quiz_id;}));
    (customQuizzes||[]).forEach(function(q){ if(!takenIds.has(q.id)) pending++; });
    const badge = document.getElementById('trainingBadge');
    if(badge){
      if(pending > 0){
        badge.textContent = pending;
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }
    }
    const libBadge = document.getElementById('bnLibraryBadge');
    if(libBadge){
      if(pending > 0){ libBadge.textContent = pending; libBadge.style.display = 'block'; }
      else { libBadge.style.display = 'none'; }
    }
  }catch(e){}
}



async function openQuizAdminPanel(quizId, quizTitleOverride){
  if(!myIsAdmin) return;
  let bd = document.getElementById('quizAdminBack');
  if(!bd){
    bd = document.createElement('div');
    bd.id = 'quizAdminBack';
    bd.style.cssText = 'position:fixed;inset:0;z-index:9700;background:rgba(15,23,42,.65);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:16px;';
    bd.onclick = function(e){ if(e.target===bd) bd.remove(); };
    document.body.appendChild(bd);
  }
  bd.innerHTML = '<div style="background:var(--ui-surface,#fff);border-radius:16px;width:100%;max-width:680px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(15,23,42,.3);overflow:hidden;" onclick="event.stopPropagation()"><div id="qapBody" style="padding:20px;overflow-y:auto;flex:1;">'+nxSkel('lines',5)+'</div></div>';
  
  try{
    let quizMeta = {};
    let isStandard = (quizId === 'checklist_v1');
    if(isStandard){
      quizMeta = { id: 'checklist_v1', title: 'Standard Knowledge Quiz — Oscars', kind: 'standard' };
    } else {
      const cq = await sbGet('custom_quizzes', '?id=eq.'+quizId);
      if(!cq || !cq[0]) throw new Error('Quiz not found');
      quizMeta = { id: cq[0].id, title: cq[0].title, kind: 'custom', document_id: cq[0].document_id, questions: cq[0].questions, status: cq[0].status || 'published' };
    }
    
    const [accessRows, resultsRows, allStaff] = await Promise.all([
      sbGet('quiz_access', '?quiz_id=eq.'+encodeURIComponent(quizId)),
      isStandard 
        ? sbGet('training_quiz_results', '?quiz_id=eq.checklist_v1&order=created_at.desc')
        : sbGet('custom_quiz_results', '?quiz_id=eq.'+quizId+'&order=created_at.desc'),
      sbGet('staff_names', '?select=name&order=name.asc')
    ]);
    
    const accessSet = new Set((accessRows||[]).map(function(a){return a.staff_name;}));
    const latestByStaff = {};
    (resultsRows||[]).forEach(function(r){ if(!latestByStaff[r.staff_name]) latestByStaff[r.staff_name] = r; });
    
    const passedCount = Object.values(latestByStaff).filter(function(r){return r.passed;}).length;
    const failedCount = Object.values(latestByStaff).filter(function(r){return !r.passed;}).length;
    
    let html = '';
    const draftPill = (quizMeta.status === 'draft') ? '<span class="qap-draft-pill">Draft</span>' : '';
    html += '<div class="qap2-hero">';
    html += '<div style="flex:1;min-width:0;"><div class="qap2-kicker">Manage quiz</div>';
    html += '<div class="qap2-title">'+esc(quizMeta.title)+draftPill+'</div></div>';
    html += '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;position:relative;">';
    html += '<button onclick="qapToggleGear(event)" class="qap-gear" title="Quiz settings"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>';
    html += '<div id="qapGearMenu" class="qap-gear-menu" style="display:none;">';
    if(!isStandard && quizMeta.status === 'draft'){
      html += '<button onclick="publishQuiz(\''+quizId+'\')" class="qap-gear-item">Publish quiz</button>';
    }
    if(isStandard){
      html += '<button onclick="openQuizEditor()" class="qap-gear-item">Edit questions</button>';
      html += '<button onclick="deleteStandardQuiz()" class="qap-gear-item danger">Delete quiz</button>';
    } else {
      html += '<button onclick="openCustomQuizEditor(\''+quizId+'\')" class="qap-gear-item">Edit questions</button>';
      html += '<button onclick="deleteQuizFromAdmin(\''+quizId+'\')" class="qap-gear-item danger">Delete quiz</button>';
    }
    html += '</div>';
    html += '<button onclick="document.getElementById(\'quizAdminBack\').remove()" class="qap2-x">×</button>';
    html += '</div></div>';

    html += '<div class="qap2-statline">'+
      '<span><b>'+accessSet.size+'</b> access</span><span class="qap2-dot">·</span>'+
      '<span style="color:#16a34a;"><b>'+passedCount+'</b> passed</span><span class="qap2-dot">·</span>'+
      '<span style="color:#dc2626;"><b>'+failedCount+'</b> failed</span>'+
    '</div>';

    html += '<div class="qap2-bulk">';
    html += '<button onclick="bulkAccessForQuiz(\''+quizId+'\',true)" class="qap-link">Give access to all</button>';
    html += '<button onclick="bulkAccessForQuiz(\''+quizId+'\',false)" class="qap-link">Revoke all</button>';
    html += '<button onclick="downloadQuizReport(\''+quizId+'\',\''+quizMeta.title.replace(/[\'\\\\]/g,"")+'\')" class="qap-link">Download report (CSV)</button>';
    html += '</div>';

    const noAccessCount = (allStaff||[]).filter(function(s){return s.name && !accessSet.has(s.name);}).length;
    html += '<div class="qap2-toolbar">';
    html += '<div class="qap2-chips">';
    html += '<button class="qap2-chip on" data-f="all" onclick="qapSetFilter(\'all\',this)">All <span class="ct">'+(allStaff||[]).length+'</span></button>';
    html += '<button class="qap2-chip" data-f="access" onclick="qapSetFilter(\'access\',this)">Access <span class="ct">'+accessSet.size+'</span></button>';
    html += '<button class="qap2-chip" data-f="noaccess" onclick="qapSetFilter(\'noaccess\',this)">No access <span class="ct">'+noAccessCount+'</span></button>';
    html += '<button class="qap2-chip" data-f="passed" onclick="qapSetFilter(\'passed\',this)">Passed <span class="ct">'+passedCount+'</span></button>';
    html += '<button class="qap2-chip" data-f="failed" onclick="qapSetFilter(\'failed\',this)">Failed <span class="ct">'+failedCount+'</span></button>';
    html += '</div>';
    html += '<input type="search" id="qapSearch" placeholder="Search staff…" oninput="filterQuizAdminPanel(this.value)" class="qap2-search">';
    html += '</div>';

    html += '<div id="qapStaffList" style="max-height:360px;overflow-y:auto;">';
    const names = (allStaff||[]).map(function(s){return s.name;}).filter(Boolean).sort();
    names.forEach(function(n){
      const hasAccess = accessSet.has(n);
      const result = latestByStaff[n];
      const rState = result ? (result.passed?'passed':'failed') : 'none';
      let statusBadge = '';
      let actionBtns = '';
      if(result){
        const reviewBtn = 'onclick="event.stopPropagation();viewQuizAttemptDetail(\''+n.replace(/\\/g,"\\\\").replace(/\'/g,"\\\'")+'\','+result.id+',\''+quizId+'\')" title="Click to see which questions they got right/wrong"';
        if(result.passed){
          statusBadge = '<button '+reviewBtn+' style="font-size:10px;font-weight:700;color:#059669;background:#d1fae5;padding:3px 8px;border-radius:10px;border:none;cursor:pointer;font-family:inherit;">✓ '+result.score+'/'+result.total+'</button>';
        } else {
          statusBadge = '<button '+reviewBtn+' style="font-size:10px;font-weight:700;color:#991b1b;background:#fee2e2;padding:3px 8px;border-radius:10px;border:none;cursor:pointer;font-family:inherit;">✕ '+result.score+'/'+result.total+'</button>';
        }
        if(isStandard){
          actionBtns += '<button onclick="resetStaffQuiz(\''+n.replace(/\\/g,"\\\\").replace(/\'/g,"\\\'")+'\','+result.id+');setTimeout(function(){openQuizAdminPanel(\''+quizId+'\');},400);" class="qap-retake-btn" title="Clear this attempt so staff can retake">Allow retake</button>';
        } else {
          actionBtns += '<button onclick="resetCustomQuizAttempt('+result.id+',\''+quizId+'\',\''+quizMeta.title.replace(/[\'\\\\]/g,"")+'\');setTimeout(function(){openQuizAdminPanel(\''+quizId+'\');},400);" class="qap-retake-btn" title="Clear this attempt so staff can retake">Allow retake</button>';
        }
      }
      const toggleBtn = '<button onclick="togglePerQuizAccess(\''+n.replace(/\\/g,"\\\\").replace(/\'/g,"\\\'")+'\',\''+quizId+'\','+(!hasAccess)+');setTimeout(function(){openQuizAdminPanel(\''+quizId+'\');},300);" class="'+(hasAccess?"qap-revoke-btn":"qap-give-btn")+'">'+(hasAccess?'Revoke':'Give')+'</button>';

      const initials = n.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
      const avaColor = (typeof rtAvaColor==='function') ? rtAvaColor(n) : '#64748b';
      const subTxt = hasAccess ? (result ? (result.passed?'Access · passed':'Access · failed') : 'Access · not taken') : 'No access';

      html += '<div class="qap2-row qap-row" data-name="'+n.toLowerCase().replace(/"/g,"&quot;")+'" data-access="'+(hasAccess?1:0)+'" data-state="'+rState+'">'+
        '<div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">'+
          '<div class="qap2-rava" style="background:'+avaColor+';">'+initials+'</div>'+
          '<div style="min-width:0;"><div class="qap2-rname">'+n.replace(/</g,'&lt;')+'</div><div class="qap2-rsub">'+subTxt+'</div></div>'+
        '</div>'+
        '<div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">'+statusBadge+actionBtns+toggleBtn+'</div>'+
      '</div>';
    });
    html += '</div>';
    
    document.getElementById('qapBody').innerHTML = html;
  }catch(e){
    document.getElementById('qapBody').innerHTML = '<div style="color:#dc2626;font-size:13px;padding:20px;">Failed: '+esc(e.message)+'</div>';
  }
}

let _qapFilter='all';
function qapToggleGear(e){
  if(e) e.stopPropagation();
  const m = document.getElementById('qapGearMenu');
  if(!m) return;
  const open = m.style.display !== 'none';
  m.style.display = open ? 'none' : 'block';
  if(!open){
    setTimeout(function(){
      document.addEventListener('click', function close(){ m.style.display='none'; document.removeEventListener('click', close); });
    }, 0);
  }
}
function qapSetFilter(f,btn){
  _qapFilter=f;
  document.querySelectorAll('.qap2-chip').forEach(function(c){c.classList.remove('on');});
  if(btn) btn.classList.add('on');
  filterQuizAdminPanel((document.getElementById('qapSearch')||{}).value||'');
}
function filterQuizAdminPanel(q){
  q = (q||'').toLowerCase().trim();
  document.querySelectorAll('.qap-row').forEach(function(row){
    const name = row.dataset.name || '';
    const access = row.dataset.access === '1';
    const state = row.dataset.state || 'none';
    let ok = (!q || name.indexOf(q) >= 0);
    if(ok && _qapFilter==='access')   ok = access;
    if(ok && _qapFilter==='noaccess') ok = !access;
    if(ok && _qapFilter==='passed')   ok = state==='passed';
    if(ok && _qapFilter==='failed')   ok = state==='failed';
    row.style.display = ok ? 'flex' : 'none';
  });
}

async function togglePerQuizAccess(staffName, quizId, grant){
  try{
    if(grant){
      await sbPost('quiz_access', {staff_name: staffName, quiz_id: quizId, granted_by: me});
      showToast('Access granted');
    } else {
      await fetch(SB+'/rest/v1/quiz_access?staff_name=eq.'+encodeURIComponent(staffName)+'&quiz_id=eq.'+encodeURIComponent(quizId), {
        method:'DELETE',
        headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}
      });
      showToast('Access revoked');
    }
  }catch(e){ showToast('Failed: '+e.message,'error'); }
}

async function bulkAccessForQuiz(quizId, grant){
  const verb = grant ? 'GRANT access' : 'REVOKE access';
  if(!confirm('Are you sure you want to '+verb+' for ALL staff on this quiz?')) return;
  try{
    if(grant){
      const allStaff = await sbGet('staff_names', '?select=name');
      const existing = await sbGet('quiz_access', '?quiz_id=eq.'+encodeURIComponent(quizId));
      const existingSet = new Set((existing||[]).map(function(a){return a.staff_name;}));
      const toAdd = (allStaff||[]).map(function(s){return s.name;}).filter(function(n){return n && !existingSet.has(n);});
      if(toAdd.length){
        const payload = toAdd.map(function(n){return {staff_name:n, quiz_id:quizId, granted_by:me};});
        await fetch(SB+'/rest/v1/quiz_access', {
          method:'POST',
          headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},
          body: JSON.stringify(payload)
        });
      }
      showToast('Granted to '+toAdd.length+' staff');
    } else {
      await fetch(SB+'/rest/v1/quiz_access?quiz_id=eq.'+encodeURIComponent(quizId), {
        method:'DELETE',
        headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}
      });
      showToast('Access revoked from all');
    }
    setTimeout(function(){ openQuizAdminPanel(quizId); }, 400);
  }catch(e){ showToast('Failed: '+e.message,'error'); }
}

async function downloadQuizReport(quizId, quizTitle){
  try{
    const isStandard = quizId === 'checklist_v1';
    const [accessRows, resultsRows] = await Promise.all([
      sbGet('quiz_access', '?quiz_id=eq.'+encodeURIComponent(quizId)),
      isStandard
        ? sbGet('training_quiz_results', '?quiz_id=eq.checklist_v1&order=created_at.desc')
        : sbGet('custom_quiz_results', '?quiz_id=eq.'+quizId+'&order=created_at.desc')
    ]);
    
    const latestByStaff = {};
    (resultsRows||[]).forEach(function(r){ if(!latestByStaff[r.staff_name]) latestByStaff[r.staff_name] = r; });
    const accessSet = new Set((accessRows||[]).map(function(a){return a.staff_name;}));
    
    let csv = 'Staff Name,Has Access,Attempt Date,Score,Total,Percentage,Status\n';
    const allNames = new Set([...accessSet, ...Object.keys(latestByStaff)]);
    Array.from(allNames).sort().forEach(function(n){
      const r = latestByStaff[n];
      const safeN = '"'+(n||'').replace(/"/g,'""')+'"';
      if(r){
        const dt = new Date(r.created_at).toISOString().slice(0,16).replace('T',' ');
        const pct = r.total ? Math.round(r.score/r.total*100) : 0;
        csv += safeN+','+(accessSet.has(n)?'Yes':'No')+','+dt+','+r.score+','+r.total+','+pct+'%,'+(r.passed?'Passed':'Failed')+'\n';
      } else {
        csv += safeN+','+(accessSet.has(n)?'Yes':'No')+',Not attempted,,,,Pending\n';
      }
    });
    
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = quizTitle.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,60)+'_'+new Date().toISOString().slice(0,10)+'.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    showToast('Report downloaded');
  }catch(e){ showToast('Download failed: '+e.message, 'error'); }
}



async function openCustomQuizEditor(quizId){
  if(!myIsAdmin) return;
  try{
    const rows = await sbGet('custom_quizzes', '?id=eq.'+quizId);
    if(!rows || !rows[0]){ showToast('Quiz not found', 'error'); return; }
    const q = rows[0];
    _quizBuilder = {
      docId: q.document_id,
      isStandardQuiz: false,
      isEditing: true,
      editingId: quizId,
      title: q.title,
      pass_pct: q.pass_pct || 80,
      questions: q.questions || [],
      status: q.status || 'published'
    };
    const bd = document.getElementById('quizAdminBack');
    if(bd) bd.remove();
    renderQuizBuilder();
  }catch(e){ showToast('Failed: '+e.message, 'error'); }
}


async function publishQuiz(quizId){
  if(!confirm('Publish this quiz?\n\nIt will become visible to staff with access and they will get a notification.')) return;
  try{
    const pr = await fetch(SB+'/rest/v1/custom_quizzes?id=eq.'+quizId, {
      method:'PATCH',
      headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'return=representation'},
      body: JSON.stringify({ status: 'published' })
    });
    if(!pr.ok){
      const msg = await pr.text();
      showToast('Publish failed ('+pr.status+'): '+msg.slice(0,140), 'error');
      return;
    }
    let updated = [];
    try{ updated = await pr.json(); }catch(e){}
    if(!updated.length){
      showToast('Publish did not apply — check quiz update permissions (RLS).', 'error');
      return;
    }
    if(updated[0].status !== 'published'){
      showToast('Status did not change — still "'+updated[0].status+'".', 'error');
      return;
    }
    const [quizRows, accessRows] = await Promise.all([
      sbGet('custom_quizzes', '?id=eq.'+quizId),
      sbGet('quiz_access', '?quiz_id=eq.'+quizId)
    ]);
    const quiz = quizRows && quizRows[0];
    const recipients = (accessRows||[]).map(function(a){return a.staff_name;});
    
    if(quiz && recipients.length && typeof sendPushTo === 'function'){
      for(const name of recipients){
        try{
          sendPushTo(name, 'New quiz available', 'A new compliance quiz has been published: ' + quiz.title, {
            url: './#training',
            tag: 'quiz-published-'+quizId
          });
        }catch(e){}
      }
    }
    showToast('Quiz published - ' + recipients.length + ' staff notified');
    setTimeout(function(){ openQuizAdminPanel(quizId); }, 300);
  }catch(e){ showToast('Publish failed: '+e.message, 'error'); }
}

async function deleteStandardQuiz(){
  if(!confirm('Delete the Standard Knowledge Quiz?\n\nThis will:\n• Remove all staff access\n• Delete all attempt records\n• Reset any custom edits\n\nThis cannot be undone.')) return;
  try{
    await Promise.all([
      fetch(SB+'/rest/v1/training_quiz_results?quiz_id=eq.checklist_v1',{method:'DELETE',headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}}),
      fetch(SB+'/rest/v1/quiz_access?quiz_id=eq.checklist_v1',{method:'DELETE',headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}}),
      fetch(SB+'/rest/v1/quiz_overrides?quiz_id=eq.checklist_v1',{method:'DELETE',headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}})
    ]);
    showToast('Standard quiz deleted');
    const bd = document.getElementById('quizAdminBack');
    if(bd) bd.remove();
    if(typeof renderMyTraining === 'function') renderMyTraining();
  }catch(e){ showToast('Delete failed: '+e.message, 'error'); }
}

async function deleteQuizFromAdmin(quizId){
  if(!confirm('Delete this quiz permanently? All attempts will also be deleted. This cannot be undone.')) return;
  try{
    await Promise.all([
      fetch(SB+'/rest/v1/custom_quiz_results?quiz_id=eq.'+quizId, {method:'DELETE',headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}}),
      fetch(SB+'/rest/v1/quiz_access?quiz_id=eq.'+quizId, {method:'DELETE',headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}}),
      fetch(SB+'/rest/v1/custom_quizzes?id=eq.'+quizId, {method:'DELETE',headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}})
    ]);
    showToast('Quiz deleted');
    const bd = document.getElementById('quizAdminBack');
    if(bd) bd.remove();
    if(typeof loadDocuments === 'function') loadDocuments();
  }catch(e){ showToast('Delete failed: '+e.message, 'error'); }
}


const GENERATE_QUIZ_URL = SB + '/functions/v1/generate-quiz';

function showQuizModeChoice(docId, docTitle, docUrl){
  let bd = document.getElementById('quizModeBack');
  if(!bd){
    bd = document.createElement('div');
    bd.id = 'quizModeBack';
    bd.style.cssText = 'position:fixed;inset:0;z-index:9700;background:rgba(15,23,42,.65);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:16px;';
    document.body.appendChild(bd);
  }
  bd.innerHTML = '<div style="background:var(--ui-surface,#fff);border-radius:16px;width:100%;max-width:480px;padding:28px;box-shadow:0 24px 60px rgba(15,23,42,.3);">'+
    '<div style="font-size:16px;font-weight:800;color:var(--ui-ink,#0f172a);margin-bottom:6px;letter-spacing:-.01em;">Attach a quiz to this document</div>'+
    '<div style="font-size:13px;color:var(--ui-ink-3,#64748b);margin-bottom:20px;line-height:1.5;">Choose how you want to create questions for <b>'+docTitle.replace(/</g,"&lt;")+'</b></div>'+
    
    '<button onclick="autoGenerateQuizFromDoc(\''+docId+'\',\''+docTitle.replace(/\\/g,"\\\\").replace(/'/g,"\\'")+'\',\''+docUrl.replace(/\\/g,"\\\\").replace(/'/g,"\\'")+'\')" style="width:100%;display:flex;align-items:center;gap:12px;padding:14px;border:2px solid #3b82f6;background:#eff6ff;border-radius:12px;cursor:pointer;margin-bottom:10px;font-family:inherit;text-align:left;">'+
      '<div style="width:38px;height:38px;border-radius:10px;background:#3b82f6;display:flex;align-items:center;justify-content:center;flex-shrink:0;">'+
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 L13.5 8.5 L20 10 L13.5 11.5 L12 18 L10.5 11.5 L4 10 L10.5 8.5 Z"/></svg>'+
      '</div>'+
      '<div style="flex:1;"><div style="font-size:13.5px;font-weight:700;color:var(--ui-ink,#0f172a);">Auto-generate with AI</div>'+
      '<div style="font-size:11.5px;color:var(--ui-ink-3,#64748b);margin-top:2px;">Gemini reads the document and creates 10 questions. You can review &amp; edit before saving.</div></div>'+
    '</button>'+
    
    '<button onclick="closeQuizModeChoice();openQuizBuilder(\''+docId+'\',\''+docTitle.replace(/\\/g,"\\\\").replace(/'/g,"\\'")+'\')" style="width:100%;display:flex;align-items:center;gap:12px;padding:14px;border:2px solid var(--ui-line,#e2e8f0);background:var(--ui-surface,#fff);border-radius:12px;cursor:pointer;margin-bottom:10px;font-family:inherit;text-align:left;">'+
      '<div style="width:38px;height:38px;border-radius:10px;background:var(--ui-surface-3,#f1f5f9);display:flex;align-items:center;justify-content:center;flex-shrink:0;">'+
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'+
      '</div>'+
      '<div style="flex:1;"><div style="font-size:13.5px;font-weight:700;color:var(--ui-ink,#0f172a);">Write manually</div>'+
      '<div style="font-size:11.5px;color:var(--ui-ink-3,#64748b);margin-top:2px;">Build the quiz yourself in a step-by-step editor.</div></div>'+
    '</button>'+
    
    '<button onclick="closeQuizModeChoice()" style="width:100%;background:none;border:none;color:var(--ui-ink-4,#94a3b8);font-size:12px;font-weight:600;cursor:pointer;padding:10px;margin-top:6px;font-family:inherit;">Skip — no quiz</button>'+
    '</div>';
}

function closeQuizModeChoice(){
  const bd = document.getElementById('quizModeBack');
  if(bd) bd.remove();
}

async function autoGenerateQuizFromDoc(docId, docTitle, docUrl){
  closeQuizModeChoice();
  let bd = document.getElementById('quizGenBack');
  if(!bd){
    bd = document.createElement('div');
    bd.id = 'quizGenBack';
    bd.style.cssText = 'position:fixed;inset:0;z-index:9700;background:rgba(15,23,42,.65);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:16px;';
    document.body.appendChild(bd);
  }
  bd.innerHTML = '<div style="background:var(--ui-surface,#fff);border-radius:16px;width:100%;max-width:380px;padding:30px;text-align:center;box-shadow:0 24px 60px rgba(15,23,42,.3);">'+
    '<div style="width:54px;height:54px;border-radius:50%;background:#eff6ff;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;animation:spin 1.6s linear infinite;">'+
      '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 L13.5 8.5 L20 10 L13.5 11.5 L12 18 L10.5 11.5 L4 10 L10.5 8.5 Z"/></svg>'+
    '</div>'+
    '<div style="font-size:15px;font-weight:700;color:var(--ui-ink,#0f172a);margin-bottom:4px;">Reading your document…</div>'+
    '<div style="font-size:12.5px;color:var(--ui-ink-3,#64748b);line-height:1.5;">Gemini AI is analysing the content and generating questions. This usually takes 15–30 seconds.</div>'+
  '</div>';
  
  if(!document.getElementById('quizGenSpinCss')){
    const style = document.createElement('style');
    style.id = 'quizGenSpinCss';
    style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
  }
  
  try{
    let pdfBase64 = '';
    let docMime = '';
    const driveId = _driveIdFromUrl(docUrl);
    if(driveId){
      try{
        const j = await fetchDriveDocBase64(driveId);
        pdfBase64 = j.base64 || '';
        docMime = j.mime || '';
      }catch(e){
        closeQuizGenModal();
        showToast('Could not read document from Drive: '+e.message, 'error');
        openQuizBuilder(docId, docTitle);
        return;
      }
    }
    const resp = await fetch(GENERATE_QUIZ_URL, {
      method:'POST',
      headers:{
        'apikey':KEY,
        'Authorization':'Bearer '+KEY,
        'Content-Type':'application/json'
      },
      body: JSON.stringify({
        pdf_base64: pdfBase64,
        doc_mime: docMime,
        document_url: docUrl,
        document_title: docTitle,
        num_questions: 10,
        pass_pct: 80
      })
    });
    const data = await resp.json();
    closeQuizGenModal();
    if(!resp.ok || data.error){
      showToast('Auto-generation failed: '+(data.error || resp.status), 'error');
      openQuizBuilder(docId, docTitle);
      return;
    }
    if(!data.questions || !data.questions.length){
      showToast('No questions returned — try manual builder', 'warning');
      openQuizBuilder(docId, docTitle);
      return;
    }
    _quizBuilder = {
      docId: docId,
      title: 'Quiz: ' + docTitle,
      pass_pct: data.pass_pct || 80,
      questions: data.questions
    };
    renderQuizBuilder();
    showToast('Generated '+data.questions.length+' questions — review and save', 'success');
  }catch(e){
    closeQuizGenModal();
    showToast('Failed: '+e.message, 'error');
    openQuizBuilder(docId, docTitle);
  }
}

function closeQuizGenModal(){
  const bd = document.getElementById('quizGenBack');
  if(bd) bd.remove();
}



function openQuizBuilder(docId, docTitle){
  _quizBuilder = {
    docId: docId,
    title: 'Quiz: '+ (docTitle || 'Untitled'),
    pass_pct: 80,
    questions: [
      { q: '', options: ['', '', '', ''], correct: 0 }
    ]
  };
  renderQuizBuilder();
}

function renderQuizBuilder(){
  let bd = document.getElementById('quizBuilderBack');
  if(!bd){
    bd = document.createElement('div');
    bd.id = 'quizBuilderBack';
    bd.style.cssText = 'position:fixed;inset:0;z-index:9700;background:rgba(15,23,42,.65);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:16px;';
    document.body.appendChild(bd);
  }
  const qb = _quizBuilder;
  
  let html = '<div style="background:var(--ui-surface,#fff);border-radius:16px;width:100%;max-width:720px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(15,23,42,.3);overflow:hidden;">';
  
  html += '<div style="padding:16px 22px;border-bottom:1px solid var(--ui-line-soft,#f1f5f9);display:flex;justify-content:space-between;align-items:center;">';
  html += '<div><div style="font-size:15px;font-weight:700;color:var(--ui-ink,#0f172a);">Build Quiz</div><div style="font-size:11px;color:var(--ui-ink-3,#64748b);margin-top:2px;">Add questions for this document</div></div>';
  html += '<button onclick="closeQuizBuilder()" style="background:none;border:none;font-size:22px;color:var(--ui-ink-4,#94a3b8);cursor:pointer;line-height:1;padding:4px 10px;">×</button>';
  html += '</div>';
  
  html += '<div style="padding:18px 22px;overflow-y:auto;flex:1;">';
  
  html += '<div style="margin-bottom:18px;background:var(--ui-surface-2,#f8fafc);border:1px solid var(--ui-line-soft,#f1f5f9);border-radius:10px;padding:14px;">';
  html += '<div style="display:grid;grid-template-columns:1fr 110px;gap:10px;align-items:end;">';
  html += '<div><label style="font-size:11px;font-weight:700;color:var(--ui-ink-3,#64748b);text-transform:uppercase;letter-spacing:.06em;">Quiz title</label>';
  html += '<input type="text" value="'+esc(qb.title)+'" oninput="_quizBuilder.title=this.value" style="width:100%;border:1.5px solid var(--ui-line,#e2e8f0);border-radius:8px;padding:8px 12px;font-size:13px;font-family:inherit;outline:none;margin-top:4px;"></div>';
  html += '<div><label style="font-size:11px;font-weight:700;color:var(--ui-ink-3,#64748b);text-transform:uppercase;letter-spacing:.06em;">Pass %</label>';
  html += '<input type="number" min="50" max="100" value="'+qb.pass_pct+'" oninput="_quizBuilder.pass_pct=parseInt(this.value||80,10)" style="width:100%;border:1.5px solid var(--ui-line,#e2e8f0);border-radius:8px;padding:8px 12px;font-size:13px;font-family:inherit;outline:none;margin-top:4px;"></div>';
  html += '</div></div>';
  
  qb.questions.forEach(function(q, qi){
    html += '<div style="margin-bottom:16px;border:1.5px solid var(--ui-line,#e2e8f0);border-radius:12px;padding:14px;background:var(--ui-surface,#fff);">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
    html += '<div style="font-size:11px;font-weight:700;color:#3b82f6;text-transform:uppercase;letter-spacing:.08em;">Question '+(qi+1)+'</div>';
    if(qb.questions.length > 1){
      html += '<button onclick="removeQuizBuilderQ('+qi+')" style="background:none;border:none;color:#dc2626;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;">Remove</button>';
    }
    html += '</div>';
    html += '<textarea oninput="updateQuizBuilderQ('+qi+',\'q\',this.value)" placeholder="Enter the question..." rows="2" style="width:100%;border:1.5px solid var(--ui-line,#e2e8f0);border-radius:8px;padding:9px 12px;font-size:13.5px;font-family:inherit;outline:none;resize:vertical;margin-bottom:10px;">'+esc(q.q)+'</textarea>';
    
    q.options.forEach(function(opt, oi){
      const isCorrect = q.correct === oi;
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">';
      html += '<label style="display:flex;align-items:center;cursor:pointer;flex-shrink:0;" title="Mark as correct answer">';
      html += '<input type="radio" name="qb_correct_'+qi+'" '+(isCorrect?'checked':'')+' onchange="updateQuizBuilderQ('+qi+',\'correct\','+oi+')" style="width:18px;height:18px;cursor:pointer;accent-color:#10b981;">';
      html += '</label>';
      html += '<input type="text" value="'+opt.replace(/"/g,'&quot;')+'" placeholder="Option '+(oi+1)+'" oninput="updateQuizBuilderOpt('+qi+','+oi+',this.value)" style="flex:1;border:1.5px solid '+(isCorrect?'#10b981':'#e2e8f0')+';background:'+(isCorrect?'#f0fdf4':'#fff')+';border-radius:8px;padding:8px 12px;font-size:13px;font-family:inherit;outline:none;">';
      if(q.options.length > 2){
        html += '<button onclick="removeQuizBuilderOpt('+qi+','+oi+')" style="background:none;border:none;color:var(--ui-ink-4,#94a3b8);font-size:18px;cursor:pointer;padding:0 6px;line-height:1;">×</button>';
      }
      html += '</div>';
    });
    
    if(q.options.length < 4){
      html += '<button onclick="addQuizBuilderOpt('+qi+')" style="background:none;border:1px dashed var(--ui-line-hi,#cbd5e1);color:var(--ui-ink-3,#64748b);border-radius:6px;padding:5px 10px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;margin-top:4px;">+ Add option</button>';
    }
    html += '</div>';
  });
  
  html += '<button onclick="addQuizBuilderQ()" style="width:100%;background:#eff6ff;color:#3b82f6;border:1.5px dashed #93c5fd;border-radius:10px;padding:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">+ Add another question</button>';
  
  html += '</div>';
  
  html += '<div style="padding:12px 22px;border-top:1px solid var(--ui-line-soft,#f1f5f9);display:flex;justify-content:space-between;align-items:center;gap:8px;">';
  html += '<div style="font-size:11px;color:var(--ui-ink-3,#64748b);">'+qb.questions.length+' question'+(qb.questions.length===1?'':'s')+' · Pass at '+qb.pass_pct+'%</div>';
  html += '<div style="display:flex;gap:8px;">';
  html += '<button onclick="closeQuizBuilder()" class="btn btn-outline" style="padding:8px 16px;font-size:13px;">Cancel</button>';
  html += '<button onclick="saveCustomQuiz()" class="btn btn-green" style="padding:8px 18px;font-size:13px;">Save quiz</button>';
  html += '</div></div>';
  
  html += '</div>';
  const _prevBody = bd.querySelector('[data-qb-body]');
  const _prevScroll = _prevBody ? _prevBody.scrollTop : 0;
  html = html.replace('padding:18px 22px;overflow-y:auto;flex:1;"', 'padding:18px 22px;overflow-y:auto;flex:1;" data-qb-body');
  bd.innerHTML = html;
  const _newBody = bd.querySelector('[data-qb-body]');
  if(_newBody) _newBody.scrollTop = _prevScroll;
}

function updateQuizBuilderQ(qi, field, val){ _quizBuilder.questions[qi][field] = val; if(field==='correct') renderQuizBuilder(); }
function updateQuizBuilderOpt(qi, oi, val){ _quizBuilder.questions[qi].options[oi] = val; }
function addQuizBuilderQ(){ _quizBuilder.questions.push({q:'',options:['',''],correct:0}); renderQuizBuilder(); }
function removeQuizBuilderQ(qi){ if(_quizBuilder.questions.length > 1){ _quizBuilder.questions.splice(qi,1); renderQuizBuilder(); }}
function addQuizBuilderOpt(qi){ if(_quizBuilder.questions[qi].options.length < 4){ _quizBuilder.questions[qi].options.push(''); renderQuizBuilder(); }}
function removeQuizBuilderOpt(qi, oi){ 
  if(_quizBuilder.questions[qi].options.length > 2){ 
    _quizBuilder.questions[qi].options.splice(oi,1);
    if(_quizBuilder.questions[qi].correct >= _quizBuilder.questions[qi].options.length) _quizBuilder.questions[qi].correct = 0;
    renderQuizBuilder();
  }
}

async function saveCustomQuiz(){
  const qb = _quizBuilder;
  for(let i = 0; i < qb.questions.length; i++){
    const q = qb.questions[i];
    if(!q.q.trim()){ showToast('Question '+(i+1)+' is empty', 'warning'); return; }
    if(q.options.some(function(o){return !o.trim();})){ showToast('Question '+(i+1)+' has empty options', 'warning'); return; }
  }
  if(!qb.title.trim()){ showToast('Quiz title is required', 'warning'); return; }
  
  try{
    await sbPost('custom_quizzes', {
      document_id: qb.docId,
      title: qb.title,
      pass_pct: qb.pass_pct,
      questions: qb.questions,
      created_by: me
    });
    showToast('Quiz saved');
    closeQuizBuilder();
    loadDocuments();
  }catch(e){
    showToast('Save failed: '+e.message, 'error');
  }
}

function closeQuizBuilder(){
  const bd = document.getElementById('quizBuilderBack');
  if(bd) bd.remove();
  _quizBuilder = null;
}

async function takeCustomQuiz(quizId){
  try{
    const rows = await sbGet('custom_quizzes', '?id=eq.'+quizId);
    if(!rows || !rows[0]){ showToast('Quiz not found', 'error'); return; }
    const quiz = rows[0];
    if(!myIsAdmin){
      const prev = await sbGet('custom_quiz_results', '?quiz_id=eq.'+quizId+'&staff_name=eq.'+encodeURIComponent(me)+'&order=created_at.desc&limit=1');
      if(prev && prev.length){
        const r = prev[0];
        showToast(r.passed ? 'Already passed — speak with admin to retake' : 'Already attempted — speak with admin to retake', 'info');
        return;
      }
    }
    _customQuizState = {
      quizId: quizId,
      title: quiz.title,
      pass_pct: quiz.pass_pct,
      questions: quiz.questions,
      current: 0,
      answers: {},
      result: null
    };
    renderCustomQuizModal();
  }catch(e){ showToast('Failed to load: '+e.message, 'error'); }
}

let _customQuizState = null;

function renderCustomQuizModal(){
  let bd = document.getElementById('customQuizBack');
  if(!bd){
    bd = document.createElement('div');
    bd.id = 'customQuizBack';
    bd.style.cssText = 'position:fixed;inset:0;z-index:9700;background:rgba(15,23,42,.65);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:16px;';
    document.body.appendChild(bd);
  }
  const cq = _customQuizState;
  const total = cq.questions.length;
  
  if(cq.result){
    const r = cq.result;
    const pct = Math.round(r.score/total*100);
    const passed = pct >= cq.pass_pct;
    bd.innerHTML = '<div style="background:var(--ui-surface,#fff);border-radius:16px;width:100%;max-width:540px;padding:36px 28px;text-align:center;box-shadow:0 24px 60px rgba(15,23,42,.3);">'+
      (passed ?
        '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 12px;display:block;"><circle cx="12" cy="12" r="10"/><polyline points="9 12 12 15 17 10"/></svg>'+
        '<div style="font-size:22px;font-weight:800;color:#10b981;margin-bottom:6px;">Passed! </div>'
        :
        '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 12px;display:block;"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'+
        '<div style="font-size:22px;font-weight:800;color:#dc2626;margin-bottom:6px;">Needs review</div>'
      )+
      '<div style="font-size:30px;font-weight:900;color:var(--ui-ink,#0f172a);margin-bottom:6px;letter-spacing:-.02em;">'+r.score+' / '+total+'</div>'+
      '<div style="font-size:14px;color:var(--ui-ink-3,#64748b);margin-bottom:22px;">Score: '+pct+'% — Pass: '+cq.pass_pct+'%</div>'+
      (typeof quizReviewBlock === 'function'
         ? quizReviewBlock(cq.questions, cq.answers) : '')+
      '<button onclick="closeCustomQuiz()" class="btn btn-green" style="padding:11px 28px;font-size:14px;">Done</button>'+
    '</div>';
    return;
  }
  
  const i = cq.current;
  const q = cq.questions[i];
  const selected = cq.answers[i];
  const pct = Math.round((i+1)/total*100);
  
  let html = '<div style="background:var(--ui-surface,#fff);border-radius:16px;width:100%;max-width:600px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(15,23,42,.3);overflow:hidden;">';
  html += '<div style="padding:18px 22px;border-bottom:1px solid var(--ui-line-soft,#f1f5f9);">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">';
  html += '<div style="font-size:15px;font-weight:700;color:var(--ui-ink,#0f172a);">'+esc(cq.title)+'</div>';
  html += '<div style="font-size:12px;color:var(--ui-ink-3,#64748b);font-weight:600;">'+(i+1)+'/'+total+'</div>';
  html += '</div>';
  html += '<div style="background:var(--ui-surface-3,#f1f5f9);height:5px;border-radius:4px;overflow:hidden;"><div style="background:#3b82f6;height:100%;width:'+pct+'%;transition:width .3s;"></div></div>';
  html += '</div>';
  html += '<div style="padding:24px 22px;overflow-y:auto;flex:1;">';
  html += '<div style="font-size:15px;font-weight:600;color:var(--ui-ink,#0f172a);line-height:1.5;margin-bottom:18px;">'+esc(q.q)+'</div>';
  q.options.forEach(function(opt, idx){
    const isSel = selected === idx;
    html += '<div onclick="selectCustomQuizAnswer('+idx+')" style="border:1.5px solid '+(isSel?'#3b82f6':'#e2e8f0')+';background:'+(isSel?'#eff6ff':'#fff')+';border-radius:10px;padding:13px 16px;margin-bottom:8px;cursor:pointer;display:flex;align-items:flex-start;gap:11px;">';
    html += '<div style="width:18px;height:18px;border-radius:50%;border:2px solid '+(isSel?'#3b82f6':'#cbd5e1')+';flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;">';
    if(isSel) html += '<div style="width:8px;height:8px;border-radius:50%;background:#3b82f6;"></div>';
    html += '</div><div style="font-size:13.5px;color:var(--ui-ink,#0f172a);line-height:1.45;flex:1;">'+opt.replace(/</g,'&lt;')+'</div></div>';
  });
  html += '</div>';
  html += '<div style="padding:14px 22px;border-top:1px solid var(--ui-line-soft,#f1f5f9);display:flex;justify-content:space-between;align-items:center;gap:8px;">';
  html += '<button onclick="closeCustomQuiz()" style="background:none;border:none;color:var(--ui-ink-3,#64748b);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">Cancel</button>';
  html += '<div style="display:flex;gap:8px;">';
  if(i > 0) html += '<button onclick="prevCustomQuizQ()" class="btn btn-outline" style="padding:9px 18px;font-size:13px;">← Back</button>';
  if(i < total - 1) html += '<button onclick="nextCustomQuizQ()" '+(selected===undefined?'disabled':'')+' class="btn btn-green" style="padding:9px 18px;font-size:13px;'+(selected===undefined?'opacity:.5;cursor:not-allowed;':'')+'">Next →</button>';
  else html += '<button onclick="submitCustomQuiz()" '+(selected===undefined?'disabled':'')+' class="btn btn-green" style="padding:9px 18px;font-size:13px;'+(selected===undefined?'opacity:.5;cursor:not-allowed;':'')+'">Submit</button>';
  html += '</div></div></div>';
  bd.innerHTML = html;
}

function selectCustomQuizAnswer(idx){ _customQuizState.answers[_customQuizState.current] = idx; renderCustomQuizModal(); }
function nextCustomQuizQ(){ if(_customQuizState.answers[_customQuizState.current] !== undefined){ _customQuizState.current++; renderCustomQuizModal(); }}
function prevCustomQuizQ(){ if(_customQuizState.current > 0){ _customQuizState.current--; renderCustomQuizModal(); }}

async function submitCustomQuiz(){
  let score = 0;
  _customQuizState.questions.forEach(function(q, i){ if(_customQuizState.answers[i] === q.correct) score++; });
  const total = _customQuizState.questions.length;
  const passed = (score/total*100) >= _customQuizState.pass_pct;
  _customQuizState.result = { score: score, total: total };
  try{
    await sbPost('custom_quiz_results', {
      quiz_id: _customQuizState.quizId,
      staff_name: me,
      score: score,
      total: total,
      passed: passed,
      answers: _customQuizState.answers
    });
  }catch(e){ showToast('Save failed: '+e.message, 'error'); return; }
  renderCustomQuizModal();
}

function closeCustomQuiz(){ const bd = document.getElementById('customQuizBack'); if(bd) bd.remove(); _customQuizState = null; loadDocuments(); }




async function viewCustomQuizResults(quizId, quizTitle){
  let bd = document.getElementById('quizResultsBack');
  if(!bd){
    bd = document.createElement('div');
    bd.id = 'quizResultsBack';
    bd.style.cssText = 'position:fixed;inset:0;z-index:9650;background:rgba(15,23,42,.55);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;';
    bd.onclick = function(e){ if(e.target===bd){ bd.remove(); }};
    document.body.appendChild(bd);
  }
  bd.innerHTML = '<div style="background:var(--ui-surface,#fff);border-radius:14px;width:100%;max-width:520px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;" onclick="event.stopPropagation()"><div style="padding:14px 18px;border-bottom:1px solid var(--ui-line-soft,#f1f5f9);"><div style="font-size:14px;font-weight:700;color:var(--ui-ink,#0f172a);">Results — '+quizTitle.replace(/</g,'&lt;')+'</div></div><div id="qrBody" style="padding:18px;overflow-y:auto;flex:1;">'+nxSkel('list',4)+'</div></div>';
  try{
    const results = await sbGet('custom_quiz_results', '?quiz_id=eq.'+quizId+'&order=created_at.desc');
    let html = '';
    if(!results.length){
      html = '<div style="text-align:center;padding:30px;color:var(--ui-ink-4,#94a3b8);font-size:13px;">No one has attempted this quiz yet.</div>';
    } else {
      results.forEach(function(r){
        const dt = new Date(r.created_at).toLocaleDateString('en-AU',{day:'numeric',month:'short'});
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--ui-line-soft,#f1f5f9);">'+
          '<div><div style="font-size:13px;font-weight:600;color:var(--ui-ink,#0f172a);">'+esc(r.staff_name)+'</div><div style="font-size:11px;color:var(--ui-ink-3,#64748b);">'+dt+'</div></div>'+
          '<div style="display:flex;align-items:center;gap:8px;">'+
            (r.passed
              ? '<span style="font-size:11px;font-weight:700;color:#065f46;background:#d1fae5;padding:4px 10px;border-radius:8px;">'+r.score+'/'+r.total+' ✓</span>'
              : '<span style="font-size:11px;font-weight:700;color:#991b1b;background:#fee2e2;padding:4px 10px;border-radius:8px;">'+r.score+'/'+r.total+'</span>')+
            (!r.passed ? '<button onclick="resetCustomQuizAttempt('+r.id+',\''+quizId+'\',\''+quizTitle.replace(/'/g,"\\'")+'\')" style="background:#3b82f6;color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:10px;font-weight:600;cursor:pointer;font-family:inherit;">Allow retake</button>' : '')+
          '</div></div>';
      });
    }
    document.getElementById('qrBody').innerHTML = html;
  }catch(e){ document.getElementById('qrBody').innerHTML = '<div style="color:#dc2626;">Failed: '+esc(e.message)+'</div>'; }
}

async function resetCustomQuizAttempt(resultId, quizId, quizTitle){
  if(!confirm('Allow this staff to retake the quiz?')) return;
  try{
    await fetch(SB+'/rest/v1/custom_quiz_results?id=eq.'+resultId,{method:'DELETE',headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}});
    showToast('Retake allowed');
    viewCustomQuizResults(quizId, quizTitle);
  }catch(e){ showToast('Failed: '+e.message,'error'); }
}


async function openQuizEditor(){
  if(!myIsAdmin) return;
  let qs = JSON.parse(JSON.stringify(TRAINING_QUIZ.questions));
  let passPct = TRAINING_QUIZ.pass_pct;
  try{
    const rows = await sbGet('quiz_overrides', '?quiz_id=eq.'+TRAINING_QUIZ.id+'&limit=1');
    if(rows && rows[0] && rows[0].questions){
      qs = rows[0].questions;
      if(rows[0].pass_pct) passPct = rows[0].pass_pct;
    }
  }catch(e){}
  
  _quizBuilder = {
    docId: null,
    isStandardQuiz: true,
    title: TRAINING_QUIZ.title,
    pass_pct: passPct,
    questions: qs
  };
  renderQuizBuilder();
}

const _origSaveCustomQuiz = (typeof saveCustomQuiz === 'function') ? saveCustomQuiz : null;
async function saveCustomQuiz(){
  const qb = _quizBuilder;
  for(let i = 0; i < qb.questions.length; i++){
    const q = qb.questions[i];
    if(!q.q.trim()){ showToast('Question '+(i+1)+' is empty', 'warning'); return; }
    if(q.options.some(function(o){return !o.trim();})){ showToast('Question '+(i+1)+' has empty options', 'warning'); return; }
  }
  if(!qb.title.trim()){ showToast('Quiz title is required', 'warning'); return; }
  
  try{
    if(qb.isStandardQuiz){
      const existing = await sbGet('quiz_overrides', '?quiz_id=eq.'+TRAINING_QUIZ.id+'&limit=1');
      if(existing && existing[0]){
        await fetch(SB+'/rest/v1/quiz_overrides?id=eq.'+existing[0].id, {
          method:'PATCH',
          headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
          body: JSON.stringify({questions: qb.questions, pass_pct: qb.pass_pct, updated_at: new Date().toISOString(), updated_by: me})
        });
      } else {
        await sbPost('quiz_overrides', {
          quiz_id: TRAINING_QUIZ.id,
          questions: qb.questions,
          pass_pct: qb.pass_pct,
          updated_by: me
        });
      }
      TRAINING_QUIZ.questions = qb.questions;
      TRAINING_QUIZ.pass_pct = qb.pass_pct;
      showToast('Standard Knowledge Quiz updated');
    } else {
      if(qb.isEditing && qb.editingId){
        await fetch(SB+'/rest/v1/custom_quizzes?id=eq.'+qb.editingId, {
          method:'PATCH',
          headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
          body: JSON.stringify({
            title: qb.title,
            pass_pct: qb.pass_pct,
            questions: qb.questions
          })
        });
        showToast('Quiz updated');
      } else {
        await sbPost('custom_quizzes', {
          document_id: qb.docId,
          title: qb.title,
          pass_pct: qb.pass_pct,
          questions: qb.questions,
          created_by: me,
          status: 'draft'
        });
        showToast('Quiz saved as draft - publish it from My Training to notify staff');
      }
      loadDocuments();
      if(typeof renderMyTraining === 'function') renderMyTraining();
    }
    closeQuizBuilder();
  }catch(e){
    showToast('Save failed: '+e.message, 'error');
  }
}

async function loadStandardQuizOverride(){
  try{
    const rows = await sbGet('quiz_overrides', '?quiz_id=eq.'+TRAINING_QUIZ.id+'&limit=1');
    if(rows && rows[0]){
      if(rows[0].questions) TRAINING_QUIZ.questions = rows[0].questions;
      if(rows[0].pass_pct) TRAINING_QUIZ.pass_pct = rows[0].pass_pct;
    }
  }catch(e){}
}

async function viewQuizAttemptDetail(staffName, resultId, quizId){
  quizId = quizId || 'checklist_v1';
  const isStandard = (quizId === 'checklist_v1');
  
  let bd = document.getElementById('quizDetailBack');
  if(!bd){
    bd = document.createElement('div');
    bd.id = 'quizDetailBack';
    bd.style.cssText = 'position:fixed;inset:0;z-index:9750;background:rgba(15,23,42,.65);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:16px;';
    bd.onclick = function(e){ if(e.target===bd) bd.remove(); };
    document.body.appendChild(bd);
  }
  bd.innerHTML = '<div style="background:var(--ui-surface,#fff);border-radius:16px;width:100%;max-width:680px;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(15,23,42,.3);overflow:hidden;" onclick="event.stopPropagation()"><div style="padding:14px 18px;border-bottom:1px solid var(--ui-line-soft,#f1f5f9);display:flex;justify-content:space-between;align-items:center;"><div><div style="font-size:14px;font-weight:700;color:var(--ui-ink,#0f172a);">Quiz Review — '+staffName+'</div><div style="font-size:11px;color:var(--ui-ink-3,#64748b);margin-top:2px;">'+nxSkel('inline',1)+'</div></div><button onclick="document.getElementById(\'quizDetailBack\').remove()" style="background:none;border:none;font-size:22px;color:var(--ui-ink-4,#94a3b8);cursor:pointer;line-height:1;padding:4px 10px;">×</button></div><div id="qdBody" style="padding:18px;overflow-y:auto;flex:1;">'+nxSkel('lines',5)+'</div></div>';
  
  try{
    let r, questions;
    if(isStandard){
      const rows = await sbGet('training_quiz_results', '?id=eq.'+resultId);
      if(!rows || !rows[0]){ document.getElementById('qdBody').innerHTML = '<div style="color:#dc2626;">Result not found</div>'; return; }
      r = rows[0];
      questions = TRAINING_QUIZ.questions;
    } else {
      const [rows, quizRows] = await Promise.all([
        sbGet('custom_quiz_results', '?id=eq.'+resultId),
        sbGet('custom_quizzes', '?id=eq.'+quizId)
      ]);
      if(!rows || !rows[0]){ document.getElementById('qdBody').innerHTML = '<div style="color:#dc2626;">Result not found</div>'; return; }
      if(!quizRows || !quizRows[0]){ document.getElementById('qdBody').innerHTML = '<div style="color:#dc2626;">Quiz definition not found</div>'; return; }
      r = rows[0];
      questions = quizRows[0].questions || [];
    }
    
    const answers = r.answers || {};
    
    let html = '<div style="margin-bottom:16px;padding:12px 14px;background:'+(r.passed?'#f0fdf4':'#fef2f2')+';border:1px solid '+(r.passed?'#bbf7d0':'#fecaca')+';border-radius:10px;display:flex;justify-content:space-between;align-items:center;">'+
      '<div><div style="font-size:13px;font-weight:700;color:'+(r.passed?'#065f46':'#991b1b')+';">'+(r.passed?'Passed ✓':'Failed ✕')+'</div>'+
      '<div style="font-size:11px;color:'+(r.passed?'#065f46':'#991b1b')+';">Submitted '+new Date(r.created_at).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})+'</div></div>'+
      '<div style="font-size:22px;font-weight:900;color:'+(r.passed?'#10b981':'#dc2626')+';">'+r.score+'/'+r.total+'</div></div>';
    
    questions.forEach(function(q, i){
      const userAns = answers[String(i)] !== undefined ? answers[String(i)] : answers[i];
      const isCorrect = userAns === q.correct;
      const userOpt = (userAns !== undefined && q.options[userAns] !== undefined) ? q.options[userAns] : '(no answer)';
      const correctOpt = q.options[q.correct] || '(unknown)';
      html += '<div style="margin-bottom:14px;padding:12px 14px;border:1.5px solid '+(isCorrect?'#bbf7d0':'#fecaca')+';background:'+(isCorrect?'#f0fdf4':'#fef2f2')+';border-radius:10px;">'+
        '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;">'+
        '<div style="background:'+(isCorrect?'#10b981':'#dc2626')+';color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;margin-top:1px;">'+(isCorrect?'✓':'✕')+'</div>'+
        '<div style="font-size:13px;font-weight:600;color:var(--ui-ink,#0f172a);line-height:1.45;">Q'+(i+1)+'. '+esc(q.q)+'</div>'+
        '</div>'+
        '<div style="font-size:12px;color:var(--ui-ink-2b,#475569);margin-bottom:4px;padding-left:30px;"><b>Their answer:</b> '+esc(userOpt)+'</div>'+
        (!isCorrect ? '<div style="font-size:12px;color:#065f46;padding-left:30px;"><b>Correct answer:</b> '+esc(correctOpt)+'</div>' : '')+
        '</div>';
    });
    document.getElementById('qdBody').innerHTML = html;
  }catch(e){ document.getElementById('qdBody').innerHTML = '<div style="color:#dc2626;">Failed: '+esc(e.message)+'</div>'; }
}



async function bulkQuizAccess(grant){
  const action = grant ? 'GRANT access to ALL staff' : 'REVOKE access from ALL staff';
  if(!confirm('Are you sure you want to '+action+' for the Standard Knowledge Quiz?')) return;
  const btns = document.querySelectorAll('#sdQuizBulkBar button');
  btns.forEach(function(b){b.disabled=true;b.style.opacity='.5';});
  try{
    if(grant){
      const allNames = (_staffDirData||[]).map(function(p){return p.staff_name;}).filter(Boolean);
      const existing = window._sdQuizAccess || new Set();
      const toAdd = allNames.filter(function(n){return !existing.has(n);});
      if(toAdd.length){
        const payload = toAdd.map(function(n){return {staff_name:n, quiz_id:'checklist_v1', granted_by: me};});
        await fetch(SB+'/rest/v1/quiz_access',{
          method:'POST',
          headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},
          body: JSON.stringify(payload)
        });
      }
      showToast('Access granted to '+toAdd.length+' staff');
    } else {
      await fetch(SB+'/rest/v1/quiz_access?quiz_id=eq.checklist_v1',{
        method:'DELETE',
        headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}
      });
      showToast('Access revoked from all');
    }
    setTimeout(openStaffDirectory, 400);
  }catch(e){ showToast('Failed: '+e.message,'error'); }
  finally{ btns.forEach(function(b){b.disabled=false;b.style.opacity='';}); }
}






const VAPID_PUBLIC_KEY = 'BM7i-tJCr4RLEfKLJmtdAfVvw0XQT0lsCgdlz6MXPZX9KNfmmpQUGAV0DLSD-fOo0vb-WYoy7BQjDq0qNwKJpkI';
const SEND_PUSH_URL = SB + '/functions/v1/send-push';

function urlBase64ToUint8Array(base64String){
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for(let i=0; i<raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function registerServiceWorker(){
  if(!('serviceWorker' in navigator)) return null;
  try{
    const reg = await navigator.serviceWorker.register('./sw.js');
    console.log('[SW] registered');
    return reg;
  }catch(e){
    console.warn('[SW] registration failed:', e);
    return null;
  }
}

async function isPushSubscribed(){
  if(!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  try{
    const reg = await navigator.serviceWorker.getRegistration();
    if(!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  }catch(e){ return false; }
}

async function subscribeToPush(){
  if(!('serviceWorker' in navigator) || !('PushManager' in window)){
    showToast('Push notifications not supported on this browser', 'warning');
    return false;
  }
  try{
    const perm = await Notification.requestPermission();
    if(perm !== 'granted'){
      showToast('Permission denied — enable in browser settings to receive push notifications', 'warning');
      return false;
    }
    let reg = await navigator.serviceWorker.getRegistration();
    if(!reg) reg = await registerServiceWorker();
    if(!reg){ showToast('Service worker not available', 'error'); return false; }
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if(!sub){
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    const subJson = sub.toJSON();
    try{ window._myEndpoint = sub.endpoint; }catch(e){}
    await sbPost('push_subscriptions', {
      staff_name: me,
      endpoint: sub.endpoint,
      p256dh: subJson.keys.p256dh,
      auth: subJson.keys.auth,
      user_agent: navigator.userAgent.slice(0,200)
    }, true);
    localStorage.setItem('push_enabled_'+me, '1');
    showToast('Push notifications enabled!', 'success');
    return true;
  }catch(e){
    console.warn('[push] subscribe failed:', e);
    showToast('Failed to enable push: '+e.message, 'error');
    return false;
  }
}

async function unsubscribeFromPush(){
  try{
    const reg = await navigator.serviceWorker.getRegistration();
    if(reg){
      const sub = await reg.pushManager.getSubscription();
      if(sub){
        await fetch(SB+'/rest/v1/push_subscriptions?endpoint=eq.'+encodeURIComponent(sub.endpoint),{
          method:'DELETE',
          headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}
        });
        await sub.unsubscribe();
      }
    }
    localStorage.removeItem('push_enabled_'+me);
    showToast('Push notifications disabled', 'info');
    return true;
  }catch(e){
    showToast('Failed to disable: '+e.message, 'error');
    return false;
  }
}

async function sendPushTo(staffName, title, body, options){
  options = options || {};
  try{
    const resp = await fetch(SEND_PUSH_URL,{
      method:'POST',
      headers:{
        'Authorization':'Bearer '+KEY,
        'apikey':KEY,
        'Content-Type':'application/json'
      },
      body: JSON.stringify({
        staff_name: staffName,
        title: title,
        body: body,
        url: options.url || './',
        tag: options.tag || ('nexus-'+Date.now()),
        broadcast: !!options.broadcast,
        exclude: options.exclude || null
      })
    });
    if(!resp.ok){
      console.warn('[push] send failed:', resp.status, await resp.text());
      return false;
    }
    return true;
  }catch(e){
    console.warn('[push] send error:', e);
    return false;
  }
}










let _sbClient = null;
let _notifSyncChannel = null;

function initNotifSync(){
  if(_sbClient || !window.supabase || !me) return;
  try{
    _sbClient = window.supabase.createClient(SB, KEY, {
      realtime: { params: { eventsPerSecond: 5 } }
    });
    _notifSyncChannel = _sbClient
      .channel('notif-sync-' + me)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notification_seen',
        filter: 'staff_name=eq.' + me
      }, function(payload){
        const row = payload.new;
        if(!row || !row.is_read) return;
        handleRemoteDismiss(row.notif_key);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notification_seen',
        filter: 'staff_name=eq.' + me
      }, function(payload){
        const row = payload.new;
        if(row && row.is_read) handleRemoteDismiss(row.notif_key);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'contacts'
      }, function(){
        try{ if(typeof window.clOnContactsChanged==='function') window.clOnContactsChanged(); }catch(e){}
      })
      .subscribe();
    console.log('[notif-sync] listening for', me);
  }catch(e){ console.warn('[notif-sync] init failed:', e); }
}

function handleRemoteDismiss(notifKey){
  if(!notifKey) return;
  try{
    if(typeof NotifManager !== 'undefined' && NotifManager.markRead){
      const localId = notifKey.replace('_', '-');
      NotifManager.markRead(localId);
    }
    const parts = notifKey.split('_');
    if(parts.length >= 2){
      const kind = parts[0], rid = parts.slice(1).join('_');
      let key = null;
      if(kind === 'leave') key = 'oR_'+me;
      else if(kind === 'reply') key = 'seen_replies_'+me;
      else if(kind === 'react') key = 'seen_reacts_'+me;
      else if(kind === 'task') key = 'seen_task_notifs_'+me;
      if(key){
        const arr = JSON.parse(localStorage.getItem(key) || '[]');
        if(!arr.includes(rid) && !arr.includes(parseInt(rid,10))){
          arr.push(rid);
          localStorage.setItem(key, JSON.stringify(arr.slice(-500)));
        }
      }
    }
  }catch(e){ console.warn('[notif-sync] dismiss handler:', e); }
  try{
    if(typeof loadNotifications === 'function') loadNotifications();
  }catch(e){}
}

async function markNotifReadEverywhere(notifKey){
  if(!me || !notifKey) return;
  try{
    await fetch(SB + '/rest/v1/notification_seen?on_conflict=staff_name,notif_key', {
      method: 'POST',
      headers: {
        'apikey': KEY,
        'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify({
        staff_name: me,
        notif_key: notifKey,
        is_read: true
      })
    });
    if(typeof SEND_PUSH_URL !== 'undefined'){
      fetch(SEND_PUSH_URL, {
        method: 'POST',
        headers: {
          'apikey': KEY,
          'Authorization': 'Bearer ' + KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          staff_name: me,
          action: 'dismiss',
          notif_key: notifKey,
          exclude_endpoint: window._myEndpoint || null
        })
      }).catch(function(){});
    }
  }catch(e){ console.warn('[notif-sync] mark failed:', e); }
}


async function captureMyPushEndpoint(){
  try{
    if(!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    if(!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if(sub && sub.endpoint){
      window._myEndpoint = sub.endpoint;
      console.log('[notif-sync] endpoint captured');
    }
  }catch(e){ console.warn('[notif-sync] endpoint capture failed:', e); }
}


function startNotifSyncWhenReady(){
  if(window.supabase && me){
    initNotifSync();
  } else {
    setTimeout(startNotifSyncWhenReady, 500);
  }
}

document.addEventListener('visibilitychange', function(){
  if(!document.hidden && _sbClient){
    if(typeof loadNotifications === 'function') loadNotifications();
  }
});

if('serviceWorker' in navigator){
  navigator.serviceWorker.addEventListener('message', function(event){
    if(event.data && event.data.type === 'notif-click' && event.data.notif_key){
      markNotifReadEverywhere(event.data.notif_key);
    }
  });
}



const NotifManager = (function(){
  const KEY_PREFIX = 'notif_local_';
  const MAX_STORED = 100;

  function key(){ 
    const u = window.me || (typeof me !== 'undefined' && me) || sessionStorage.getItem('ou') || 'anon';
    return KEY_PREFIX + u;
  }

  function load(){
    try{
      const list = JSON.parse(localStorage.getItem(key()) || '[]');
      const cleaned = list.filter(function(n){
        return n.type !== 'tasks' && n.type !== 'task' && n.link !== 'tasks';
      });
      if(cleaned.length !== list.length){
        try{ localStorage.setItem(key(), JSON.stringify(cleaned)); }catch(e){}
      }
      return cleaned;
    }
    catch(e){ return []; }
  }

  function save(list){
    try{
      const trimmed = list.slice(0, MAX_STORED);
      localStorage.setItem(key(), JSON.stringify(trimmed));
    }catch(e){}
  }

  function push(notif){
    if(!notif || !notif.id) return;
    const list = load();
    if(list.find(function(n){return n.id === notif.id;})) return false;
    if(typeof triggerBellPulse === 'function') triggerBellPulse();
    try{
      if(localStorage.getItem('oscars_notif_sound') !== '0' && typeof playNotifSound === 'function'){
        playNotifSound(notif.type || 'default');
      }
    }catch(e){}
    list.unshift({
      id: notif.id,
      type: notif.type || 'general',
      title: notif.title || '',
      body: notif.body || '',
      ts: notif.ts || Date.now(),
      link: notif.link || null,
      read: false
    });
    save(list);
    refreshUI();
    showBannerOnce(notif);
    return true;
  }

  function showBannerOnce(notif){
    if(typeof showBanner === 'function'){
      let cls = 'success';
      if(notif.type && notif.type.indexOf('declined') >= 0) cls = 'warning';
      else if(notif.type && notif.type.indexOf('mention') >= 0) cls = '';
      showBanner(notif.title, notif.body, cls);
    }
  }

  function markRead(id){
    const list = load();
    const item = list.find(function(n){return n.id === id;});
    if(!item) return;
    item.read = true;
    save(list);
    refreshUI();
  }

  function markAllRead(){
    const list = load();
    list.forEach(function(n){ n.read = true; });
    save(list);
    refreshUI();
  }

  function clearOne(id){
    let list = load();
    list = list.filter(function(n){return n.id !== id;});
    save(list);
    refreshUI();
  }

  function clearAll(){
    save([]);
    refreshUI();
  }

  function unreadCount(){
    return load().filter(function(n){return !n.read;}).length;
  }

  function getAll(){ return load(); }

  function refreshUI(){
    updateBadges();
    repaintDropdown();
  }

  function updateBadges(){
    const count = unreadCount();
    const display = count > 99 ? '99+' : String(count);
    ['mhBellBadge','sbBellBadge'].forEach(function(id){
      const b = document.getElementById(id);
      if(!b) return;
      if(count > 0){
        b.textContent = display;
        b.style.display = 'flex';
      } else {
        b.style.display = 'none';
      }
    });
    const bnBadge = document.getElementById('bnNotifBadge');
    if(bnBadge){
      if(count > 0){
        bnBadge.textContent = count > 9 ? '9+' : String(count);
        bnBadge.style.display = 'flex';
      } else {
        bnBadge.style.display = 'none';
      }
    }
    document.querySelectorAll('.bn-badge, .nav-badge').forEach(function(b){
      if(count > 0){ b.textContent = (count > 4 ? '4+' : String(count)); b.style.display = 'flex'; }
      else { b.textContent = ''; b.style.display = 'none'; }
    });
    if(typeof updateBellBadge === 'function') updateBellBadge(count);
  }

  const _ND_ICONS = {
    ok:   '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 10.5l3.5 3.5 7.5-8"/></svg>',
    no:   '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l8 8M14 6l-8 8"/></svg>',
    learn:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5.5C5.5 4.5 8 4.8 10 6.2c2-1.4 4.5-1.7 7-.7v9c-2.5-1-5-.7-7 .7-2-1.4-4.5-1.7-7-.7z"/><path d="M10 6.2v9"/></svg>',
    time: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="6.5"/><path d="M10 6.5V10l2.5 1.5"/></svg>',
    chat: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A1.5 1.5 0 015.5 4h9A1.5 1.5 0 0116 5.5v6a1.5 1.5 0 01-1.5 1.5H9l-3.5 3v-3h0A1.5 1.5 0 014 11.5z"/></svg>',
    bell: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 13.5V9a4.5 4.5 0 119 0v4.5l1 1.5h-11z"/><path d="M8.5 17h3"/></svg>'
  };
  function _ndKind(n){
    const t = String(n.type||'').toLowerCase();
    if(t.indexOf('declin')>=0 || t.indexOf('reject')>=0) return 'no';
    if(t.indexOf('approv')>=0) return 'ok';
    if(t.indexOf('quiz')>=0 || t.indexOf('train')>=0 || t.indexOf('learn')>=0) return 'learn';
    if(t.indexOf('avail')>=0 || t.indexOf('remind')>=0 || t.indexOf('expir')>=0) return 'time';
    if(t.indexOf('mention')>=0 || t.indexOf('reply')>=0 || t.indexOf('react')>=0 || t.indexOf('chat')>=0) return 'chat';
    return 'bell';
  }
  function _ndShort(ts){
    const d = Math.max(0, Date.now() - ts);
    if(d < 60000) return 'now';
    if(d < 3600000) return Math.floor(d/60000)+'m';
    if(d < 86400000) return Math.floor(d/3600000)+'h';
    if(d < 604800000) return Math.floor(d/86400000)+'d';
    return new Date(ts).toLocaleDateString('en-AU',{day:'numeric',month:'short'});
  }
  function listHtml(list){
    list = list || load();
    if(!list.length){
      return '<div class="nd-empty"><span class="nd-empty-ico">'+_ND_ICONS.bell+'</span><div class="nd-empty-t">You\'re all caught up</div><div class="nd-empty-s">New alerts will show up here.</div></div>';
    }
    return '<div class="nd-list" role="list">'+list.map(function(n){
      const kind = _ndKind(n);
      const id = String(n.id).replace(/'/g,"\\'").replace(/"/g,'&quot;');
      return '<div class="nd-row'+(n.read?' read':' unread')+'" role="listitem" tabindex="0" data-id="'+String(n.id).replace(/"/g,'&quot;')+'" '+
        'onclick="NotifManager._handleClick(\''+id+'\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();NotifManager._handleClick(\''+id+'\');}">'+
        '<span class="nd-dot" aria-hidden="true"></span>'+
        '<span class="nd-ico nd-ico-'+kind+'" aria-hidden="true">'+_ND_ICONS[kind]+'</span>'+
        '<span class="nd-main"><span class="nd-title">'+esc(n.title||'')+'</span>'+(n.body?'<span class="nd-body">'+esc(n.body)+'</span>':'')+'</span>'+
        '<span class="nd-meta"><span class="nd-time">'+_ndShort(n.ts||Date.now())+'</span>'+
          '<button type="button" class="nd-x" aria-label="Dismiss" title="Dismiss" onclick="event.stopPropagation();NotifManager.clearOne(\''+id+'\')"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 3l6 6M9 3l-6 6"/></svg></button></span>'+
      '</div>';
    }).join('')+'</div>';
  }

  function repaintDropdown(){
    const list = load();
    const html = listHtml(list);
    ['notifDropList','mhNotifDropList'].forEach(function(id){
      const el = document.getElementById(id);
      if(el) el.innerHTML = html;
    });
    document.querySelectorAll('.nd-acts').forEach(function(a){ a.style.visibility = list.length ? '' : 'hidden'; });
  }

  function _closePanels(){
    document.querySelectorAll('.notif-drop').forEach(function(d){ d.classList.remove('open'); d.style.display='none'; });
    const m = document.getElementById('mhNotifModal'); if(m) m.remove();
    const orig = document.getElementById('mhNotifDropList_orig'); if(orig) orig.id = 'mhNotifDropList';
  }

  function _handleClick(id){
    const item = load().find(function(n){return n.id === id;});
    if(!item) return;
    markRead(id);
    const validPages = ['home','schedule','leave','availability','shifts','myhours','teamreport','engagement','documents','training','calendar','myreports','notifs','profile'];
    if(item.link && typeof goTo === 'function' && validPages.indexOf(item.link) >= 0){
      _closePanels();
      goTo(item.link);
    }
  }



  return {
    push: push,
    markRead: markRead,
    markAllRead: markAllRead,
    clearOne: clearOne,
    clearAll: clearAll,
    unreadCount: unreadCount,
    getAll: getAll,
    refresh: refreshUI,
    listHtml: listHtml,
    _handleClick: _handleClick
  };
})();



setTimeout(function(){ if(typeof NotifManager !== 'undefined') NotifManager.refresh(); }, 1000);

function handleMobileBell(e){
  if(e){ e.preventDefault(); e.stopPropagation(); }
  let overlay = document.getElementById('mhNotifModal');
  if(overlay){
    overlay.remove();
    const orig = document.getElementById('mhNotifDropList_orig');
    if(orig) orig.id = 'mhNotifDropList';
    return;
  }
  overlay = document.createElement('div');
  overlay.id = 'mhNotifModal';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.4);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:flex;align-items:flex-start;justify-content:flex-end;padding:60px 8px 8px;';
  overlay.addEventListener('click', function(ev){
    if(ev.target === overlay) overlay.remove();
  });
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const bg = isDark ? '#1e293b' : '#fff';
  const border = isDark ? '#2d3f55' : '#e5e7eb';
  const txtPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const originalMhList = document.getElementById('mhNotifDropList');
  if(originalMhList){ originalMhList.id = 'mhNotifDropList_orig'; }
  overlay.innerHTML = '<div style="background:'+bg+';border:1px solid '+border+';border-radius:14px;width:100%;max-width:380px;max-height:80vh;overflow-y:auto;-webkit-overflow-scrolling:touch;box-shadow:0 20px 50px rgba(15,23,42,.2);" onclick="event.stopPropagation()">'+
    '<div class="notif-drop-header" style="padding:14px 16px;font-size:14px;font-weight:700;color:'+txtPrimary+';border-bottom:1px solid '+border+';position:sticky;top:0;background:'+bg+';z-index:1;display:flex;align-items:center;justify-content:space-between;">'+
      '<span class="nd-title-h">Notifications</span><span class="nd-acts"><button type="button" onclick="NotifManager.markAllRead()">Mark all read</button><button type="button" class="nd-clear" onclick="NotifManager.clearAll()">Clear</button></span>'+
      '<button onclick="document.getElementById(\'mhNotifModal\') && (document.getElementById(\'mhNotifModal\').remove(), document.getElementById(\'mhNotifDropList_orig\') && (document.getElementById(\'mhNotifDropList_orig\').id=\'mhNotifDropList\'))" style="background:none;border:none;font-size:20px;line-height:1;color:var(--ui-ink-4,#94a3b8);cursor:pointer;padding:0 4px;">×</button>'+
    '</div>'+
    '<div id="mhNotifDropList"><div class="notif-drop-empty" style="color:var(--ui-ink-3,#64748b);padding:30px 16px;text-align:center;">'+nxSkel('list',4)+'</div></div>'+
  '</div>';
  document.body.appendChild(overlay);
  const restoreId = function(){
    const orig = document.getElementById('mhNotifDropList_orig');
    if(orig) orig.id = 'mhNotifDropList';
  };
  overlay.addEventListener('click', function(ev){
    if(ev.target === overlay){
      overlay.remove();
      restoreId();
    }
  });
  if(typeof loadNotifDrop === 'function') loadNotifDrop('mhNotifDrop');
}

function toggleNotifDrop(dropId){
  const id = dropId || 'notifDrop';
  const drop = document.getElementById(id);
  if(!drop){ console.warn('[notif] drop missing:', id); return; }
  document.querySelectorAll('.notif-drop').forEach(function(d){
    if(d.id !== id){
      d.classList.remove('open');
      d.style.display = 'none';
    }
  });
  const isOpen = drop.classList.contains('open');
  if(isOpen){
    drop.classList.remove('open');
    drop.style.display = 'none';
  } else {
    drop.classList.add('open');
    drop.style.display = 'block';
    loadNotifDrop(id);
    setTimeout(function(){
      function outsideHandler(e){
        if(!e.target.closest('.notif-drop-wrap') && !e.target.closest('.notif-drop')){
          drop.classList.remove('open');
          drop.style.display = 'none';
          document.removeEventListener('click', outsideHandler, true);
          document.removeEventListener('touchend', outsideHandler, true);
        }
      }
      document.addEventListener('click', outsideHandler, true);
      document.addEventListener('touchend', outsideHandler, true);
    }, 100);
  }
}

async function loadNotifDrop(dropId){
  const listId = dropId==='mhNotifDrop'?'mhNotifDropList':'notifDropList';
  let el = document.getElementById(listId);
  if(!el){
    const drop = document.getElementById(dropId);
    if(drop){
      console.log('[notif-drop] creating missing list element');
      el = document.createElement('div');
      el.id = listId;
      drop.appendChild(el);
    } else {
      console.warn('[notif-drop] BOTH drop and list missing:', dropId, listId);
      return;
    }
  }
  if(el && typeof NotifManager !== 'undefined' && NotifManager.getAll){
    try{
      const allNotifs = NotifManager.getAll();
      if(allNotifs && allNotifs.length){
        el.innerHTML = NotifManager.listHtml(allNotifs);
        return;
      }
    }catch(e){ console.warn('NotifManager render failed:', e); }
  }
  if(!el) return;
  el.innerHTML='<div class="notif-drop-empty" style="color:var(--ui-ink-3,#64748b);padding:30px 16px;text-align:center;">'+nxSkel('list',4)+'</div>';
  try{
    const _currentMe = me || sessionStorage.getItem('ou') || window.me;
    if(!_currentMe){ el.innerHTML='<div class="notif-drop-empty">Sign in to see notifications</div>'; return; }
    const rows=(await sbGet('leave_submissions','?staff_name=eq.'+encodeURIComponent(_currentMe)+'&status=in.(approved,declined)&order=submitted_at.desc&limit=10'))
      .filter(function(r){ return r.staff_name === _currentMe; });
    const read=JSON.parse(localStorage.getItem('oR_'+me)||'[]');

    let replyNotifsRaw=[];
    try{ 
      replyNotifsRaw=([])
        .filter(function(r){ return r.recipient === _currentMe; });
    }catch(e){}
    const seenReplies=JSON.parse(localStorage.getItem('seen_replies_'+me)||'[]');
    const newReplies=replyNotifsRaw.filter(r=>!seenReplies.includes(r.id)&&_fresh(r.created_at));
    const reactNotifsDrop=await loadReactNotifs();
    const seenReactsDrop=JSON.parse(localStorage.getItem('seen_reacts_'+me)||'[]');
    const newReactsDrop=(reactNotifsDrop||[]).filter(function(r){return !seenReactsDrop.includes(r.id)&&_fresh(r.created_at||r.reacted_at);});

    if(!rows.length&&!newReactsDrop.length&&!newReplies.length){
      el.innerHTML='<div class="notif-drop-empty">No notifications yet</div>';
      return;
    }

    let html='<div class="notif-drop-actions"><span style="font-size:11px;color:var(--ui-ink-4,#94a3b8);font-weight:600;">Recent</span><button class="notif-mark-all" onclick="markAllNotificationsRead()">Mark all as read</button></div>';

    newReplies.forEach(function(r){
      html+='<div class="notif-drop-item unread" onclick="closeAllNotifDrops();markReplySeen(\''+r.id+'\');">'+
        '<div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:2px;"> New Reply</div>'+
        '<div style="font-size:12px;color:var(--ui-ink-2b,#475569);">'+esc(r.replier)+' replied to your discussion</div>'+
        '<div style="font-size:11px;color:var(--ui-ink-4,#94a3b8);margin-top:2px;">'+esc(r.body)+'</div>'+
        '</div>';
    });

    newReactsDrop.forEach(function(r){
      html+='<div class="notif-drop-item unread" data-rid="'+r.id+'" onclick="markReactSeen(this.dataset.rid);closeAllNotifDrops();">'+
        '<div style="font-size:12px;font-weight:700;color:#7c3aed;margin-bottom:2px;">'+r.emoji+' Reaction on your post</div>'+
        '<div style="font-size:12px;color:var(--ui-ink-2b,#475569);">'+esc(r.staff_name)+' reacted to your '+(r.target_type==='disc'?'discussion':'announcement')+'</div>'+
        '</div>';
    });



    rows.filter(function(r){ return _fresh(r.submitted_at); }).forEach(function(r){
      const isRead=read.includes(r.id);
      const approved=r.status==='approved';
      const col=approved?'#16a34a':'#dc2626';
      const label=approved?'✓ Leave Approved':'✕ Leave Declined';
      html+='<div class="notif-drop-item'+(isRead?'':' unread')+'" data-nid="'+r.id+'" onclick="closeAllNotifDrops();markNotifRead(this.dataset.nid);goTo(\'schedule\');setTimeout(function(){showSchedTab(\'leave\');},120);">'+
        '<div style="font-size:12px;font-weight:700;color:'+col+';margin-bottom:2px;">'+label+'</div>'+
        '<div style="font-size:12px;color:var(--ui-ink-2b,#475569);">'+fmtF(r.from_date)+' - '+fmtF(r.to_date)+'</div>'+
        (r.reason?'<div style="font-size:11px;color:var(--ui-ink-4,#94a3b8);margin-top:2px;">'+esc(r.reason)+'</div>':'')+
        (r.status==='declined'&&r.decline_reason?'<div style="font-size:11px;color:#dc2626;margin-top:2px;">'+esc(r.decline_reason)+'</div>':'')+
        '<div style="font-size:10px;color:var(--ui-ink-4,#94a3b8);margin-top:3px;">Tap to view leave history</div>'+
        '</div>';
    });

    el.innerHTML=html;
    const otherId=listId==='notifDropList'?'mhNotifDropList':'notifDropList';
    const other=document.getElementById(otherId);
    if(other)other.innerHTML=html;
  }catch(e){
    el.innerHTML='<div class="notif-drop-empty">Could not load</div>';
  }
}

function closeAllNotifDrops(){
  document.querySelectorAll('.notif-drop.open').forEach(function(d){d.classList.remove('open');});
}




async function markNotifRead(id){
  const read=JSON.parse(localStorage.getItem('oR_'+me)||'[]');
  if(!read.includes(id)){read.push(id);localStorage.setItem('oR_'+me,JSON.stringify(read));}
  try{
    await fetch(SB+'/rest/v1/notification_seen?on_conflict=staff_name,notif_key',{
      method:'POST',
      headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'},
      body:JSON.stringify({staff_name:me, notif_key:'leave_'+id})
    });
  }catch(e){ console.warn('markNotifRead sync:',e); }
  if(typeof loadNotifications === 'function') loadNotifications();
}






let selectedMood=0;








function showToast(msg, variant){
  let v = variant || 'info';
  if(!variant){
    const m = String(msg).toLowerCase();
    if(/fail|error|wrong|invalid|cannot|⚠/i.test(msg)) v = 'error';
    else if(/saved|approved|done|wiped|deleted|sent|reset/i.test(msg)) v = 'success';
    else if(/warning|caution/i.test(msg)) v = 'warning';
  }
  let t=document.getElementById('_toast');
  if(!t){
    t=document.createElement('div');
    t.id='_toast';
    document.body.appendChild(t);
  }
  const styles = {
    success: {bg:'#10b981',icon:'<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>'},
    error: {bg:'#dc2626',icon:'<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>'},
    warning: {bg:'#f59e0b',icon:'<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>'},
    info: {bg:'#0f172a',icon:'<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clip-rule="evenodd"/></svg>'}
  };
  const s = styles[v] || styles.info;
  t.style.cssText='position:fixed;bottom:max(28px,calc(env(safe-area-inset-bottom,0px) + 90px));left:50%;transform:translateX(-50%) translateY(28px) scale(.95);background:'+s.bg+';color:#fff;padding:11px 18px 11px 14px;border-radius:14px;font-size:13px;font-weight:600;z-index:99999;opacity:0;transition:all .35s cubic-bezier(.34,1.4,.64,1);pointer-events:none;max-width:min(420px,90vw);text-align:left;display:flex;align-items:center;gap:10px;box-shadow:0 10px 30px rgba(15,23,42,.18),0 4px 12px rgba(15,23,42,.08);letter-spacing:-.005em;line-height:1.4;backdrop-filter:blur(8px);';
  t.innerHTML = '<div style="flex-shrink:0;display:flex;align-items:center;">'+s.icon+'</div><div style="flex:1;">'+msg+'</div>';
  requestAnimationFrame(function(){
    t.style.opacity='1';
    t.style.transform='translateX(-50%) translateY(0) scale(1)';
  });
  clearTimeout(t._timer);
  t._timer=setTimeout(function(){
    t.style.opacity='0';
    t.style.transform='translateX(-50%) translateY(28px) scale(.95)';
  }, v === 'error' ? 4000 : 2800);
}


let _autoRefreshTimer = null;
document.addEventListener('visibilitychange', function(){
  if(document.hidden) return;
  if(typeof clScheduleQueueRefresh === 'function'){ window._clQueueDirty = true; clScheduleQueueRefresh(); }
});
function startAutoRefresh(){
  stopAutoRefresh();
  _autoRefreshTimer = setInterval(function(){
    if(document.hidden) return;
    loadNotifications();
    checkFeedbackInvites();
    const active = document.querySelector('.page.active');
    if(!active) return;
    if(active.id === 'page-calllog' && typeof clScheduleQueueRefresh === 'function'){
      window._clQueueDirty = true; clScheduleQueueRefresh();
    }
  }, 60000);
}
function stopAutoRefresh(){
  if(_autoRefreshTimer){ clearInterval(_autoRefreshTimer); _autoRefreshTimer=null; }
}
document.addEventListener('visibilitychange', function(){
  if(document.hidden) stopAutoRefresh();
  else { startAutoRefresh(); loadNotifications(); }
});


const _seenCache = {};



async function markNotifSeen(key){
  _seenCache[key] = true;
  localStorage.setItem('seen_'+me+'_'+key, '1');
  try{
    await fetch(SB+'/rest/v1/notification_seen?on_conflict=staff_name,notif_key',{
      method:'POST',
      headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'},
      body:JSON.stringify({staff_name:me, notif_key:key})
    });
  }catch(e){ console.warn('markNotifSeen failed:',e); }
}












let _realtimeChannels = [];

async function initRealtime(){
  console.log('[Realtime] initRealtime called, alreadyInit=', !!window._realtimeInitialized);
  if(window._realtimeInitialized) return;
  window._realtimeInitialized = true;
  if(!window.supabase){
    try{
      await new Promise(function(res,rej){
        const s=document.createElement('script');
        s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
        s.onload=res;
        s.onerror=function(err){ console.error('[Realtime] CDN load FAILED:', err); rej(err); };
        document.head.appendChild(s);
      });
    }catch(e){ console.error('[Realtime] Could not load supabase-js:',e); return; }
  }
  if(!window.supabase || !window.supabase.createClient){
    console.error('[Realtime] window.supabase exists but createClient missing');
    return;
  }
  try{
    _realtimeClient = window.supabase.createClient(SB, KEY);
    try{ if(_realtimeClient.realtime && _realtimeClient.realtime.setAuth) _realtimeClient.realtime.setAuth(window._sbAuthToken || KEY); }catch(e){}
    setupRealtimeChannels();
  }catch(e){ console.error('[Realtime] init failed:', e); }
}

if(typeof loadStandardQuizOverride === 'function') loadStandardQuizOverride();
  if(typeof flushClockSyncQueue === 'function') setTimeout(flushClockSyncQueue, 2000);
if(typeof refreshTrainingBadge === 'function') setTimeout(refreshTrainingBadge, 1500);
function setupRealtimeChannels(){
  _realtimeChannels.forEach(function(ch){ try{ _realtimeClient.removeChannel(ch); }catch(e){} });
  _realtimeChannels = [];

  const callCh = _realtimeClient.channel('calllog-live')
    .on('postgres_changes', {event:'*', schema:'public', table:'call_log'}, function(){
      window._clQueueDirty = true;
      if(typeof clScheduleQueueRefresh==='function') clScheduleQueueRefresh();
    })
    .subscribe();
  _realtimeChannels.push(callCh);

  const hkCh = _realtimeClient.channel('housekeeping-live')
    .on('postgres_changes', {event:'*', schema:'public', table:'housekeeping_roster'}, function(payload){
      const row = payload.new || payload.old;
      if(!row || !me) return;
      if(row.staff_name !== me) return;
      if(typeof loadHousekeepingDuty === 'function') loadHousekeepingDuty();
    })
    .subscribe();
  _realtimeChannels.push(hkCh);



  const leaveCh = _realtimeClient.channel('leave-live')
    .on('postgres_changes', {event:'UPDATE', schema:'public', table:'leave_submissions'}, function(payload){
      if(!me || typeof me !== 'string') return;
      if(!payload.new || !payload.new.staff_name) return;
      if(payload.new.staff_name !== me) return;
      const l = payload.new;
      if(l.status === 'approved' || l.status === 'declined'){
        const fireKey = 'rt_leave_'+l.id+'_'+l.status;
        if(!sessionStorage.getItem(fireKey)){
          sessionStorage.setItem(fireKey, '1');
          if(typeof NotifManager !== 'undefined') NotifManager.push({
            id: 'leave-'+l.id,
            type: l.status === 'approved' ? 'leave-approved' : 'leave-declined',
            title: l.status === 'approved' ? 'Leave approved' : 'Leave declined',
            body: (l.from_date||'') + (l.to_date ? ' to '+l.to_date : '') + (l.reason ? ' · '+l.reason : ''),
            ts: Date.now(),
            link: 'leave'
          });
        }
      }
      loadNotifications();
    })
    .subscribe();
  _realtimeChannels.push(leaveCh);

  const reactCh = _realtimeClient.channel('reactions-live')
    .subscribe();
  _realtimeChannels.push(reactCh);

  const replyCh = _realtimeClient.channel('reply-notifs-live')
    .subscribe();
  _realtimeChannels.push(replyCh);
}

function teardownRealtime(){
  if(_msgRealtimeCh){ try{ _realtimeClient&&_realtimeClient.removeChannel(_msgRealtimeCh); }catch(e){} _msgRealtimeCh=null; }
  _realtimeChannels.forEach(function(ch){ try{ _realtimeClient&&_realtimeClient.removeChannel(ch); }catch(e){} });
  _realtimeChannels = [];
}

function setVH(){
  const h = window.innerHeight;
  document.documentElement.style.setProperty('--vh', (h*0.01)+'px');
  document.documentElement.style.setProperty('--vhFull', h+'px');
}
setVH();
window.addEventListener('orientationchange', function(){ setTimeout(setVH, 200); });
window.addEventListener('resize', function(){
  if(window.innerWidth !== (window._lastW||0) ||
     window.innerHeight !== (window._lastH||0)){
    window._lastW = window.innerWidth;
    window._lastH = window.innerHeight;
    setVH();
  }
});
