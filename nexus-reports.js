let _reportTargetStaff = null;


async function runReport(){
  const startStr = document.getElementById('reportStart').value;
  const endStr = document.getElementById('reportEnd').value;
  const el = document.getElementById('reportResults');
  if(!startStr || !endStr){ el.innerHTML = '<div style="color:#dc2626;">Pick both dates.</div>'; return; }
  const start = new Date(startStr+'T00:00:00');
  const end = new Date(endStr+'T23:59:59');
  el.innerHTML = '<div style="color:var(--ui-ink-4,#94a3b8);text-align:center;padding:20px;">'+nxSkel('table',5)+'</div>';
  const targetStaff = _reportTargetStaff || me;
  let logs = [];
  try{
    logs = await sbGet('clock_log','?staff_name=eq.'+encodeURIComponent(targetStaff)+'&order=ts.asc&limit=1000');
  }catch(e){}
  logs = (logs||[]).filter(function(r){
    const t = new Date(r.ts);
    return t >= start && t <= end;
  });
  if(!logs.length){ el.innerHTML = '<div style="color:var(--ui-ink-4,#94a3b8);text-align:center;padding:30px;">No clock-ins in this range.</div>'; return; }
  logs.sort(function(a,b){return new Date(a.ts) - new Date(b.ts);});
  (function(){
    const seen = {};
    logs = logs.filter(function(r){
      const t = new Date(r.ts);
      const k = r.action+'|'+t.getFullYear()+'-'+(t.getMonth()+1)+'-'+t.getDate()+'|'+t.getHours()+':'+t.getMinutes();
      if(seen[k]) return false; seen[k]=1; return true;
    });
  })();
  const byDay = {};
  let openIn = null, openInId = null;
  logs.forEach(function(r){
    const t = new Date(r.ts);
    const dayKey = t.toLocaleDateString('en-AU',{day:'2-digit',month:'2-digit',year:'numeric'});
    if(!byDay[dayKey]) byDay[dayKey] = {date:t, in:null, out:null, hours:0, in_id:'', out_id:''};
    if(r.action === 'in'){
      if(!byDay[dayKey].in || t < byDay[dayKey].in){ byDay[dayKey].in = t; byDay[dayKey].in_id = r.id; }
      if(!openIn){ openIn = t; openInId = r.id; }
    }
    else if(r.action === 'out'){
      if(!byDay[dayKey].out || t > byDay[dayKey].out){ byDay[dayKey].out = t; byDay[dayKey].out_id = r.id; }
      if(openIn){
        const span = t - openIn;
        if(span > 0 && span < 24*60*60*1000){
          byDay[dayKey].hours += span/3600000;
        }
        openIn = null;
      }
    }
  });
  const days = Object.keys(byDay).sort(function(a,b){
    return byDay[a].date - byDay[b].date;
  });
  let totalHours = 0;
  const editCol = myIsAdmin ? '<th style="padding:8px 6px;border-bottom:1px solid var(--ui-line,#e2e8f0);text-align:right;"></th>' : '';
  let html = '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">'+
    '<thead><tr style="text-align:left;color:var(--ui-ink-4,#94a3b8);font-size:11px;text-transform:uppercase;letter-spacing:.05em;">'+
      '<th style="padding:8px 6px;border-bottom:1px solid var(--ui-line,#e2e8f0);">Date</th>'+
      '<th style="padding:8px 6px;border-bottom:1px solid var(--ui-line,#e2e8f0);">Day</th>'+
      '<th style="padding:8px 6px;border-bottom:1px solid var(--ui-line,#e2e8f0);">In</th>'+
      '<th style="padding:8px 6px;border-bottom:1px solid var(--ui-line,#e2e8f0);">Out</th>'+
      '<th style="padding:8px 6px;border-bottom:1px solid var(--ui-line,#e2e8f0);text-align:right;">Hours</th>'+editCol+
    '</tr></thead><tbody>';
  days.forEach(function(k){
    const d = byDay[k];
    const day = d.date.toLocaleDateString('en-AU',{weekday:'short'});
    const inS = d.in ? d.in.toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Australia/Sydney'}) : '—';
    const outS = d.out ? d.out.toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Australia/Sydney'}) : '—';
    totalHours += d.hours;
    const isoDate = d.date.toISOString().split('T')[0];
    const inHHMM = d.in ? (String(d.in.getHours()).padStart(2,'0')+':'+String(d.in.getMinutes()).padStart(2,'0')) : '';
    const outHHMM = d.out ? (String(d.out.getHours()).padStart(2,'0')+':'+String(d.out.getMinutes()).padStart(2,'0')) : '';
    const editBtn = myIsAdmin ? '<td style="padding:7px 6px;border-bottom:1px solid var(--ui-line-soft,#f1f5f9);text-align:right;"><button onclick="openPunchEdit(\''+targetStaff.replace(/\'/g,"\\'")+'\',\''+isoDate+'\',\''+inHHMM+'\',\''+outHHMM+'\',\''+d.in_id+'\',\''+d.out_id+'\')" style="background:var(--ui-surface-3,#f1f5f9);border:none;font-size:11px;padding:4px 10px;border-radius:6px;cursor:pointer;font-family:inherit;font-weight:600;color:var(--accent);">Edit</button></td>' : '';
    html += '<tr><td style="padding:7px 6px;border-bottom:1px solid var(--ui-line-soft,#f1f5f9);">'+k+'</td>'+
      '<td style="padding:7px 6px;border-bottom:1px solid var(--ui-line-soft,#f1f5f9);color:var(--ui-ink-3,#64748b);">'+day+'</td>'+
      '<td style="padding:7px 6px;border-bottom:1px solid var(--ui-line-soft,#f1f5f9);">'+inS+'</td>'+
      '<td style="padding:7px 6px;border-bottom:1px solid var(--ui-line-soft,#f1f5f9);">'+outS+'</td>'+
      '<td style="padding:7px 6px;border-bottom:1px solid var(--ui-line-soft,#f1f5f9);text-align:right;font-weight:600;font-variant-numeric:tabular-nums;">'+d.hours.toFixed(2)+'h</td>'+editBtn+'</tr>';
  });
  const totalEditCell = myIsAdmin ? '<td></td>' : '';
  html += '<tr><td colspan="4" style="padding:10px 6px;font-weight:700;color:var(--ui-ink,#0f172a);">Total</td>'+
    '<td style="padding:10px 6px;text-align:right;font-weight:800;color:var(--accent);font-size:15px;">'+totalHours.toFixed(2)+'h</td>'+totalEditCell+'</tr>';
  html += '</tbody></table></div>';
  el.innerHTML = html;
}



function updateGpsBypassBtn(){
  const btn = document.getElementById('gpsBypassBtn');
  if(!btn) return;
  const off = localStorage.getItem('oscars_gps_bypass') === '1';
  btn.textContent = off ? '⚠️ GPS off' : ' GPS on';
  btn.style.color = off ? '#dc2626' : '#10b981';
}

setTimeout(updateGpsBypassBtn, 500);

async function renderNotifsPage(){
  const el = document.getElementById('notifsPageList');
  if(!el) return;
  if(typeof NotifManager === 'undefined'){
    el.innerHTML = '<div style="padding:40px 16px;text-align:center;color:var(--ui-ink-4,#94a3b8);font-size:13px;">Notification system not ready.</div>';
    return;
  }
  const all = NotifManager.getAll() || [];
  if(!all.length){
    el.innerHTML = '<div style="padding:60px 16px;text-align:center;">'+
      '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 12px;display:block;"><path d="M15 17H20L18.5951 15.5951C18.2141 15.2141 18 14.6973 18 14.1585V11C18 8.38757 16.3304 6.16509 14 5.34142V5C14 3.89543 13.1046 3 12 3C10.8954 3 10 3.89543 10 5V5.34142C7.66962 6.16509 6 8.38757 6 11V14.1585C6 14.6973 5.78595 15.2141 5.40493 15.5951L4 17H9M15 17V18C15 19.6569 13.6569 21 12 21C10.3431 21 9 19.6569 9 18V17M15 17H9"/></svg>'+
      '<div style="font-size:15px;font-weight:700;color:var(--ui-ink-2b,#475569);margin-bottom:4px;">No notifications yet</div>'+
      '<div style="font-size:12.5px;color:var(--ui-ink-4,#94a3b8);">When something happens you\'ll see it here.</div>'+
      '</div>';
    return;
  }
  let html = '';
  all.forEach(function(n){
    const t = n.ts || Date.now();
    const diff = Math.max(0, Date.now() - t);
    let timeStr = 'just now';
    if(diff >= 60000 && diff < 3600000) timeStr = Math.floor(diff/60000) + 'm ago';
    else if(diff >= 3600000 && diff < 86400000) timeStr = Math.floor(diff/3600000) + 'h ago';
    else if(diff >= 86400000) timeStr = Math.floor(diff/86400000) + 'd ago';
    let icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>';
    let iconBg = '#f1f5f9';
    if(n.type && n.type.indexOf('reaction') >= 0){
      icon = '<span style="font-size:18px;">'+(n.title.match(/[\u{1F300}-\u{1FAFF}]/u) || ['👍'])[0]+'</span>';
      iconBg = '#faf5ff';
    } else if(n.type && n.type.indexOf('discussion') >= 0){
      icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
      iconBg = '#eff6ff';
    } else if(n.type && n.type.indexOf('reply') >= 0){
      icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>';
      iconBg = '#ecfeff';
    } else if(n.type && n.type.indexOf('leave-approved') >= 0){
      icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      iconBg = '#ecfdf5';
    } else if(n.type && n.type.indexOf('leave-declined') >= 0){
      icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      iconBg = '#fef2f2';
    } else if(n.type && n.type.indexOf('task') >= 0){
      icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>';
      iconBg = '#f0fdf4';
    }
    const unreadDot = n.read ? '' : '<span style="width:8px;height:8px;background:#3b82f6;border-radius:50%;flex-shrink:0;margin-top:7px;"></span>';
    html += '<div class="notif-row" data-nid="'+n.id+'" data-link="'+(n.link||'')+'" style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-bottom:1px solid var(--ui-line-soft,#f1f5f9);cursor:pointer;background:'+(n.read?'#fff':'#f8faff')+';transition:background .15s;" onclick="handleNotifClick(\''+n.id+'\',\''+(n.link||'')+'\')">'+
      '<div style="width:40px;height:40px;border-radius:50%;background:'+iconBg+';display:flex;align-items:center;justify-content:center;flex-shrink:0;">'+icon+'</div>'+
      '<div style="flex:1;min-width:0;">'+
        '<div style="font-size:13.5px;font-weight:'+(n.read?'600':'700')+';color:var(--ui-ink,#0f172a);margin-bottom:2px;">'+(n.title||'').replace(/</g,'&lt;')+'</div>'+
        '<div style="font-size:12.5px;color:var(--ui-ink-3,#64748b);line-height:1.4;margin-bottom:4px;">'+(n.body||'').replace(/</g,'&lt;')+'</div>'+
        '<div style="font-size:11px;color:var(--ui-ink-4,#94a3b8);font-weight:500;">'+timeStr+'</div>'+
      '</div>'+
      unreadDot+
    '</div>';
  });
  el.innerHTML = html;
  setTimeout(function(){
    if(document.querySelector('#page-notifs.active')){
      NotifManager.markAllRead();
    }
  }, 1500);
}

function handleNotifClick(id, link){
  if(typeof NotifManager !== 'undefined' && NotifManager.markRead) NotifManager.markRead(id);
  const validPages = ['home','schedule','leave','availability','shifts','myhours','teamreport','engagement','documents','training','calendar','myreports','notifs','profile'];
  if(link && validPages.indexOf(link) >= 0){
    goTo(link);
  } else if(link){
    console.warn('[notif] invalid link:', link);
  }
}

function markAllNotifsRead(){
  if(typeof markAllNotificationsRead === 'function'){ markAllNotificationsRead(); return; }
  if(typeof NotifManager !== 'undefined' && NotifManager.markAllRead){
    NotifManager.markAllRead();
    setTimeout(renderNotifsPage, 100);
    showToast('All notifications marked as read');
  }
}

const _origUpdateBadges = (function(){
  return null;
})();

const ONBOARDING_TASKS = [
  {
    id: 'dob',
    title: 'Set your date of birth',
    body: 'So we can wish you happy birthday — shown in the calendar.',
    cta: 'Set DOB',
    action: "goTo('profile');setTimeout(function(){showProfileSection('account');var el=document.getElementById('profBirthday');if(el)el.focus();},400)",
    check: async function(){
      try{
        const rows = await sbGet('staff_credentials','?staff_name=eq.'+encodeURIComponent(me)+'&select=birthday');
        return !!(rows && rows[0] && rows[0].birthday);
      }catch(e){ return false; }
    }
  },
  {
    id: 'security_questions',
    title: 'Set your security questions',
    body: 'So you can reset your own password if you forget it.',
    cta: 'Set questions',
    action: "goTo('profile');setTimeout(function(){showProfileSection('account');var el=document.getElementById('profSqSection');if(el){toggleSection('profSqSection');loadCurrentQuestions();}},400)",
    check: async function(){
      try{
        const rows = await sbGet('staff_credentials','?staff_name=eq.'+encodeURIComponent(me)+'&select=sq1_question,sq2_question');
        return !!(rows && rows[0] && rows[0].sq1_question && rows[0].sq2_question);
      }catch(e){ return false; }
    }
  },
  {
    id: 'availability',
    title: 'Set your availability',
    body: 'Tell us when you can work so shifts match your schedule.',
    cta: 'Set availability',
    page: 'availability',
    check: async function(){
      try{
        const rows = await sbGet('staff_availability','?staff_name=eq.'+encodeURIComponent(me)+'&select=staff_name&limit=1');
        return !!(rows && rows.length > 0);
      }catch(e){ return false; }
    }
  },
  {
    id: 'check_report',
    title: 'Check My Hours',
    body: 'See your fortnightly hours, breaks, and coffee allowances.',
    cta: 'View My Hours',
    page: 'myhours',
    check: function(){
      return localStorage.getItem('nexus_visited_reports_'+me) === '1';
    }
  }
];

const TOUR_STEPS = [
  {
    target: null,
    icon: '', title: 'Welcome to Nexus',
    body: 'This quick walkthrough shows you how to use your staff portal. Follow the highlights — it takes under a minute.',
    advance: 'next'
  },
  {
    target: '#clockBtn',
    title: 'Clock in & out',
    body: 'This is your time clock. Tap it to start your shift, and again to clock out when you leave. Give it a tap now.',
    advance: 'tap'
  },
  {
    target: '#mhUser',
    title: 'My Profile',
    body: 'Tap your name up here to open your Profile. Set your security questions and date of birth so you can reset your own password if you forget it.',
    advance: 'tap'
  },
  {
    target: '#bn-schedule',
    title: 'My Time',
    body: 'Tap here to open My Time. Shifts shows your roster and open shifts. My Hours shows your timesheet for any date range, and is where you set your Availability.',
    advance: 'tap',
    afterTap: function(){ /* navigation handled by the element's own onclick */ }
  },
  {
    target: '#bn-library',
    title: 'Library',
    body: 'Training quizzes, compliance checks, guides and documents all live in the Library. Tap to open it.',
    advance: 'tap'
  },
  {
    target: '#bn-leave',
    title: 'Leave',
    body: 'Request leave and check its status here. Tap to open Leave.',
    advance: 'tap'
  },
  {
    target: '#bn-notifs',
    title: 'Notifications',
    body: 'Replies, reactions, reminders, and leave decisions show up here. Tap to see your notifications.',
    advance: 'tap'
  },
  {
    target: null,
    icon: '', title: 'You\'re ready to go',
    body: 'That\'s it! Explore each tab at your own pace. Welcome to the team.',
    advance: 'next', last: true
  }
];
let _tourStep = 0;
let _tourCleanup = null;

function _tourEl(sel){
  if(!sel) return null;
  const el = document.querySelector(sel);
  if(!el) return null;
  const r = el.getBoundingClientRect();
  if(r.width === 0 || r.height === 0) return null;
  return el;
}

function showTour(){
  _tourStep = 0;
  let ov = document.getElementById('spotlightTour');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'spotlightTour';
    ov.innerHTML =
      '<div id="spotMask"></div>'+
      '<div id="spotRing"></div>'+
      '<div id="spotCard">'+
        '<div id="spotHeader">'+
          '<span id="spotKicker"></span>'+
          '<div style="display:flex;align-items:center;gap:10px;">'+
            '<span id="spotNum"></span>'+
          '</div>'+
        '</div>'+
        '<div id="spotIcon"></div>'+
        '<div id="spotTitle"></div>'+
        '<div id="spotBody"></div>'+
        '<div id="spotDots"></div>'+
        '<div id="spotBtns">'+
          '<button id="spotBack" type="button">Back</button>'+
          '<button id="spotNext" type="button">Next</button>'+
        '</div>'+
      '</div>';
    document.body.appendChild(ov);
    document.getElementById('spotBack').onclick = prevTourStep;
    document.getElementById('spotNext').onclick = nextTourStep;
    window.addEventListener('resize', _repositionTour);
    window.addEventListener('scroll', _repositionTour, true);
  }
  ov.style.display = 'block';
  ov.style.opacity = '1';
  renderTourStep();
}

function _clearStepHandlers(){
  if(_tourCleanup){ try{ _tourCleanup(); }catch(e){} _tourCleanup = null; }
}

function renderTourStep(){
  _clearStepHandlers();
  const step = TOUR_STEPS[_tourStep];
  if(!step){ skipTour(); return; }
  const total = TOUR_STEPS.length;
  document.getElementById('spotKicker').textContent = step.last ? 'All done' : (_tourStep === 0 ? 'Welcome' : 'Step '+_tourStep);
  document.getElementById('spotNum').textContent = (_tourStep+1)+' / '+total;
  const iconEl = document.getElementById('spotIcon');
  iconEl.textContent = step.icon || '';
  iconEl.style.display = step.icon ? 'block' : 'none';
  document.getElementById('spotTitle').textContent = step.title;
  document.getElementById('spotBody').textContent = step.body;
  document.getElementById('spotDots').innerHTML = TOUR_STEPS.map(function(_,i){
    return '<span class="spot-dot'+(i===_tourStep?' active':'')+'"></span>';
  }).join('');
  document.getElementById('spotBack').style.visibility = _tourStep === 0 ? 'hidden' : 'visible';
  const nextBtn = document.getElementById('spotNext');

  const targetEl = _tourEl(step.target);
  if(step.target && targetEl && step.advance === 'tap'){
    nextBtn.textContent = 'Skip step';
    _spotlightOn(targetEl);
    const handler = function(){
      const ov = document.getElementById('spotlightTour');
      if(ov){ ov.style.opacity = '0'; }
      setTimeout(function(){
        if(ov) ov.style.display = 'none';
      }, 350);
      setTimeout(function(){
        _tourStep++;
        if(_tourStep >= TOUR_STEPS.length){ skipTour(); return; }
        if(ov){ ov.style.display = 'block'; renderTourStep(); requestAnimationFrame(function(){ ov.style.opacity = '1'; }); }
      }, 1700);
    };
    targetEl.addEventListener('click', handler, { once:true });
    _tourCleanup = function(){ targetEl.removeEventListener('click', handler); };
  } else {
    nextBtn.textContent = step.last ? 'Finish' : 'Next';
    _spotlightOff();
  }
}

function _spotlightOn(el){
  const ring = document.getElementById('spotRing');
  const mask = document.getElementById('spotMask');
  const card = document.getElementById('spotCard');
  const r = el.getBoundingClientRect();
  const pad = 8;
  const x = r.left - pad, y = r.top - pad, w = r.width + pad*2, h = r.height + pad*2;
  ring.style.display = 'block';
  ring.style.left = x+'px'; ring.style.top = y+'px';
  ring.style.width = w+'px'; ring.style.height = h+'px';
  mask.style.display = 'none';
  card.classList.add('anchored');
  card.style.left = '50%';
  const cardH = 220;
  if(r.top > cardH + 30){
    card.style.top = (r.top - 16)+'px';
    card.style.transform = 'translate(-50%,-100%)';
  } else {
    card.style.top = (r.bottom + 16)+'px';
    card.style.transform = 'translate(-50%,0)';
  }
}

function _spotlightOff(){
  document.getElementById('spotRing').style.display = 'none';
  document.getElementById('spotMask').style.display = 'block';
  const card = document.getElementById('spotCard');
  card.classList.remove('anchored');
  card.style.left = '50%'; card.style.top = '50%';
  card.style.transform = 'translate(-50%,-50%)';
}

function _repositionTour(){
  const ov = document.getElementById('spotlightTour');
  if(!ov || ov.style.display === 'none') return;
  const step = TOUR_STEPS[_tourStep];
  if(!step) return;
  const el = _tourEl(step.target);
  if(step.target && el && step.advance === 'tap'){ _spotlightOn(el); }
}

function prevTourStep(){
  if(_tourStep > 0){ _tourStep--; renderTourStep(); }
}

function nextTourStep(){
  _tourStep++;
  if(_tourStep >= TOUR_STEPS.length){ skipTour(); return; }
  renderTourStep();
}

function skipTour(){
  _clearStepHandlers();
  const ov = document.getElementById('spotlightTour');
  if(ov) ov.style.display = 'none';
  markTourDone();
  setTimeout(function(){ if(typeof maybeShowProfilePrompt==='function') maybeShowProfilePrompt(); }, 400);
}

async function maybeShowTour(){
  if(!me) return;
  const localDone = localStorage.getItem('nexus_tour_done_'+me) === '1';
  try{
    const rows = await sbGet('staff_settings','?name=eq.'+encodeURIComponent(me)+'&select=nexus_tour_done');
    if(rows && rows.length){
      if(rows[0].nexus_tour_done === true){
        localStorage.setItem('nexus_tour_done_'+me,'1');
        if(typeof maybeShowProfilePrompt==='function') maybeShowProfilePrompt();
        return;
      }
      if(rows[0].nexus_tour_done === false){
        localStorage.removeItem('nexus_tour_done_'+me);
      }
    } else {
      if(localDone){ if(typeof maybeShowProfilePrompt==='function') maybeShowProfilePrompt(); return; }
    }
  }catch(e){
    if(localDone){ if(typeof maybeShowProfilePrompt==='function') maybeShowProfilePrompt(); return; }
  }
  const lock = document.getElementById('onboardLockOverlay');
  if(lock && lock.style.display !== 'none' && lock.style.display !== ''){ return; }
  if(typeof goTo === 'function'){ try{ goTo('home'); }catch(e){} }
  setTimeout(showTour, 900);
}

async function markTourDone(){
  if(!me) return;
  localStorage.setItem('nexus_tour_done_'+me,'1');
  try{
    await fetch(SB+'/rest/v1/staff_settings?name=eq.'+encodeURIComponent(me),{
      method:'PATCH',
      headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
      body: JSON.stringify({nexus_tour_done: true})
    });
  }catch(e){ /* localStorage fallback already written */ }
}

function showProfilePrompt(){
  let ov = document.getElementById('profilePromptOverlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'profilePromptOverlay';
    ov.innerHTML =
      '<div class="pp-mask"></div>'+
      '<div class="pp-card">'+
        '<div class="pp-icon">'+
          '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>'+
        '</div>'+
        '<div class="pp-title">Make your profile yours</div>'+
        '<div class="pp-body">Add a profile picture and a nickname so your teammates recognise you across the roster, call log, and directory. Takes about a minute.</div>'+
        '<div class="pp-btns">'+
          '<button class="pp-skip" onclick="dismissProfilePrompt()">Maybe later</button>'+
          '<button class="pp-go" onclick="goProfilePromptSetup()">Set it up</button>'+
        '</div>'+
      '</div>';
    document.body.appendChild(ov);
  }
  ov.style.display = 'block';
}

function goProfilePromptSetup(){
  markProfilePromptDone();
  const ov = document.getElementById('profilePromptOverlay');
  if(ov) ov.style.display = 'none';
  if(typeof goTo === 'function'){ try{ goTo('profile'); }catch(e){} }
  setTimeout(function(){
    if(typeof showProfileSection === 'function'){ try{ showProfileSection('account'); }catch(e){} }
    const f=document.getElementById('profNickname'); if(f){ try{ f.focus(); }catch(e){} }
  }, 350);
}

function dismissProfilePrompt(){
  const ov = document.getElementById('profilePromptOverlay');
  if(ov) ov.style.display = 'none';
  markProfilePromptDone();
}

async function markProfilePromptDone(){
  if(!me) return;
  localStorage.setItem('profile_prompt_done_'+me,'1');
  try{
    await fetch(SB+'/rest/v1/staff_settings?name=eq.'+encodeURIComponent(me),{
      method:'PATCH',
      headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
      body: JSON.stringify({profile_prompt_done: true})
    });
  }catch(e){ /* localStorage fallback already written */ }
}

async function maybeShowProfilePrompt(){
  if(!me) return;
  const localDone = localStorage.getItem('profile_prompt_done_'+me) === '1';
  try{
    const rows = await sbGet('staff_settings','?name=eq.'+encodeURIComponent(me)+'&select=profile_prompt_done');
    if(rows && rows.length){
      if(rows[0].profile_prompt_done === true){
        localStorage.setItem('profile_prompt_done_'+me,'1');
        return;
      }
      if(rows[0].profile_prompt_done === false){
        localStorage.removeItem('profile_prompt_done_'+me);
      }
    } else {
      if(localDone) return;
    }
  }catch(e){
    if(localDone) return;
  }
  const lock = document.getElementById('onboardLockOverlay');
  if(lock && lock.style.display !== 'none' && lock.style.display !== ''){ return; }
  setTimeout(showProfilePrompt, 500);
}


async function loadOnboardingProgress(){
  _onboardingProgress = {};
  for(const task of ONBOARDING_TASKS){
    try{
      const result = task.check.constructor.name === 'AsyncFunction' ? await task.check() : task.check();
      _onboardingProgress[task.id] = !!result;
    }catch(e){ _onboardingProgress[task.id] = false; }
  }
}

async function renderOnboardingChecklist(){
  await loadOnboardingProgress();
  const el = document.getElementById('onboardingChecklist');
  if(!el) return;
  const total = ONBOARDING_TASKS.length;
  const done = ONBOARDING_TASKS.filter(t => _onboardingProgress[t.id]).length;
  const pct = Math.round((done/total)*100);
  let html = '<div style="margin-bottom:14px;">'+
    '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">'+
      '<div style="font-size:13px;font-weight:700;color:var(--ui-ink,#0f172a);">Setup progress</div>'+
      '<div style="font-size:11.5px;font-weight:600;color:var(--ui-ink-3,#64748b);font-variant-numeric:tabular-nums;">'+done+' of '+total+' · '+pct+'%</div>'+
    '</div>'+
    '<div style="background:var(--ui-surface-4,#e2e8f0);height:6px;border-radius:4px;overflow:hidden;">'+
      '<div style="background:linear-gradient(90deg,#10b981,#059669);height:100%;width:'+pct+'%;transition:width .4s ease;border-radius:4px;"></div>'+
    '</div>'+
  '</div>';
  ONBOARDING_TASKS.forEach(function(task){
    const isDone = _onboardingProgress[task.id];
    html += '<div style="display:flex;align-items:start;gap:11px;padding:11px 12px;border-radius:10px;margin-bottom:6px;background:'+(isDone?'rgba(16,185,129,.06)':'#f8fafc')+';border:1px solid '+(isDone?'rgba(16,185,129,.18)':'#e2e8f0')+';transition:all .2s;">'+
      '<div style="flex-shrink:0;width:22px;height:22px;border-radius:50%;background:'+(isDone?'#10b981':'#fff')+';border:2px solid '+(isDone?'#10b981':'#cbd5e1')+';display:flex;align-items:center;justify-content:center;margin-top:1px;">'+
        (isDone ? '<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6.5L4.5 9L10 3" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '')+
      '</div>'+
      '<div style="flex:1;min-width:0;">'+
        '<div style="font-size:13px;font-weight:'+(isDone?'600':'700')+';color:'+(isDone?'#64748b':'#0f172a')+';margin-bottom:2px;'+(isDone?'text-decoration:line-through;':'')+'">'+esc(task.title)+'</div>'+
        '<div style="font-size:11.5px;color:var(--ui-ink-4,#94a3b8);line-height:1.4;margin-bottom:'+(isDone?'0':'8px')+';">'+esc(task.body)+'</div>'+
        (isDone ? '' : '<button onclick="handleOnboardingAction(\''+task.id+'\')" style="background:#0f172a;color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;transition:background .15s;" onmouseover="this.style.background=\'#1e293b\'" onmouseout="this.style.background=\'#0f172a\'">'+task.cta+' →</button>')+
      '</div>'+
    '</div>';
  });
  if(done === total){
    html += '<div style="text-align:center;padding:18px 12px 4px;color:#10b981;font-size:14px;font-weight:700;">All set — welcome aboard!</div>'+
            '<div style="text-align:center;padding:0 12px 8px;color:var(--ui-ink-3,#64748b);font-size:11.5px;">You can dismiss this card anytime.</div>'+
            '<button onclick="dismissOnboardingCard()" style="margin:8px auto 0;display:block;background:none;border:1px solid var(--ui-line,#e2e8f0);color:var(--ui-ink-3,#64748b);border-radius:8px;padding:7px 16px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Dismiss card</button>';
  }
  el.innerHTML = html;
}

function showOnboardingConfetti(){
  const container = document.createElement('div');
  container.id = 'confettiContainer';
  container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99999;overflow:hidden;';
  document.body.appendChild(container);
  
  if(!document.getElementById('confettiStyle')){
    const style = document.createElement('style');
    style.id = 'confettiStyle';
    style.textContent = `
      @keyframes confettiFall {
        0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
        100% { transform: translateY(105vh) rotate(720deg); opacity: 0; }
      }
      @keyframes confettiSway {
        0%,100% { margin-left: 0; }
        50% { margin-left: 30px; }
      }
      .confetti-piece {
        position: absolute;
        top: -20px;
        width: 9px;
        height: 14px;
        border-radius: 2px;
        animation-name: confettiFall, confettiSway;
        animation-timing-function: ease-in, ease-in-out;
        animation-iteration-count: 1, infinite;
        animation-fill-mode: forwards;
      }
    `;
    document.head.appendChild(style);
  }
  
  const colors = ['#10b981','#3b82f6','#f59e0b','#ec4899','#8b5cf6','#ef4444','#06b6d4','#84cc16','#fbbf24','#f43f5e'];
  const count = 60;
  for(let i = 0; i < count; i++){
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = (Math.random() * 100) + 'vw';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.transform = 'rotate(' + (Math.random() * 360) + 'deg)';
    const fallDuration = 2.5 + Math.random() * 2;
    const swayDuration = 1 + Math.random() * 2;
    piece.style.animationDuration = fallDuration + 's,' + swayDuration + 's';
    piece.style.animationDelay = (Math.random() * 1.2) + 's,0s';
    piece.style.width = (7 + Math.random() * 5) + 'px';
    piece.style.height = (12 + Math.random() * 8) + 'px';
    container.appendChild(piece);
  }
  
  setTimeout(function(){
    if(container && container.parentNode) container.parentNode.removeChild(container);
  }, 6000);
}

async function maybeBirthdayCelebration(){
  try{
    if(!me) return;
    const today = new Date();
    const todayKey = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
    const seenKey = 'nx_bday_'+me;
    try{ if(localStorage.getItem(seenKey) === todayKey) return; }catch(e){}

    const rows = await sbGet('staff_credentials',
      '?staff_name=eq.'+encodeURIComponent(me)+'&select=birthday&birthday=not.is.null');
    if(!rows || !rows.length || !rows[0].birthday) return;

    const parts = String(rows[0].birthday).split('-');
    if(parts.length < 3) return;
    const bMonth = parseInt(parts[1],10);
    const bDay   = parseInt(parts[2],10);
    if(bMonth !== (today.getMonth()+1) || bDay !== today.getDate()) return;

    try{ localStorage.setItem(seenKey, todayKey); }catch(e){}

    const first = me.split(' ')[0];
    _showBirthdayBanner(first);
    if(typeof showOnboardingConfetti === 'function') showOnboardingConfetti();
  }catch(e){ console.warn('birthday check', e); }
}

function _showBirthdayBanner(firstName){
  const ov = document.createElement('div');
  ov.id = 'bdayOverlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:99998;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.45);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);animation:bdayFade .3s ease;';
  const card = document.createElement('div');
  card.style.cssText = 'background:var(--surface,var(--ui-surface,#fff));border-radius:20px;padding:30px 34px;max-width:340px;width:86%;text-align:center;box-shadow:0 24px 64px -16px rgba(16,24,40,.45);animation:bdayPop .4s cubic-bezier(.34,1.5,.6,1);';
  const safe = (firstName||'').replace(/[<>&]/g,'');
  card.innerHTML =
    '<div style="font-size:46px;line-height:1;margin-bottom:10px;">🎉</div>'+
    '<div style="font-size:22px;font-weight:800;color:var(--text,var(--ui-ink,#0f172a));letter-spacing:-.02em;margin-bottom:6px;">Happy Birthday, '+safe+'!</div>'+
    '<div style="font-size:14px;color:var(--text-2,var(--ui-ink-3,#64748b));line-height:1.5;margin-bottom:20px;">Hope you have a wonderful day. The whole team is celebrating you today.</div>'+
    '<button id="bdayCloseBtn" style="padding:11px 26px;font-size:14px;font-weight:700;color:#fff;background:var(--accent,#2563eb);border:none;border-radius:12px;cursor:pointer;font-family:inherit;">Thank you!</button>';
  ov.appendChild(card);
  if(!document.getElementById('bdayAnimStyle')){
    const st = document.createElement('style');
    st.id = 'bdayAnimStyle';
    st.textContent = '@keyframes bdayFade{from{opacity:0;}to{opacity:1;}}@keyframes bdayPop{from{opacity:0;transform:translateY(14px) scale(.95);}to{opacity:1;transform:none;}}';
    document.head.appendChild(st);
  }
  document.body.appendChild(ov);
  function close(){ if(ov&&ov.parentNode) ov.parentNode.removeChild(ov); }
  ov.addEventListener('click', function(e){ if(e.target===ov) close(); });
  const btn = document.getElementById('bdayCloseBtn');
  if(btn) btn.addEventListener('click', close);
  setTimeout(close, 12000);
}

function handleOnboardingAction(taskId){
  const task = ONBOARDING_TASKS.find(t => t.id === taskId);
  if(!task) return;
  closeOnboardingPanel();
  if(task.action){
    try{ eval(task.action); }catch(e){ console.warn('onboarding action:', e); }
  } else if(task.page){
    goTo(task.page);
  }
}

function closeOnboardingPanel(){
  const bd = document.getElementById('onboardingBack');
  if(bd) bd.style.display = 'none';
}

function openOnboardingPanel(){
  let bd = document.getElementById('onboardingBack');
  if(!bd){
    bd = document.createElement('div');
    bd.id = 'onboardingBack';
    bd.style.cssText = 'position:fixed;inset:0;z-index:9555;background:rgba(15,23,42,.55);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;';
    document.body.appendChild(bd);
    bd.addEventListener('click', function(e){ if(e.target===bd) closeOnboardingPanel(); });
  }
  bd.innerHTML = '<div style="background:var(--ui-surface,#fff);border-radius:16px;width:100%;max-width:480px;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 60px rgba(15,23,42,.3);" onclick="event.stopPropagation()">'+
    '<div style="padding:18px 22px;border-bottom:1px solid var(--ui-line-soft,#f1f5f9);display:flex;justify-content:space-between;align-items:flex-start;">'+
      '<div>'+
        '<div style="font-size:17px;font-weight:800;color:var(--ui-ink,#0f172a);letter-spacing:-.01em;">Get started with Nexus</div>'+
        '<div style="font-size:12px;color:var(--ui-ink-3,#64748b);margin-top:3px;">Complete these to make the most of your portal.</div>'+
      '</div>'+
      '<button onclick="closeOnboardingPanel()" style="background:none;border:none;font-size:22px;line-height:1;color:var(--ui-ink-4,#94a3b8);cursor:pointer;padding:0 0 0 12px;">×</button>'+
    '</div>'+
    '<div id="onboardingChecklist" style="padding:18px 22px;overflow-y:auto;flex:1;"></div>'+
  '</div>';
  bd.style.display = 'flex';
  renderOnboardingChecklist();
}

async function togglePushSubscription(){
  const btn = document.getElementById('pushToggleBtn');
  const status = document.getElementById('pushStatusText');
  if(!btn) return;
  btn.disabled = true;
  const subbed = await isPushSubscribed();
  if(subbed){
    const ok = await unsubscribeFromPush();
    if(ok){ btn.textContent = 'Enable'; if(status) status.textContent = 'Get alerted even when the portal is closed — works on your phone and this browser'; }
  } else {
    const ok = await subscribeToPush();
    if(ok){
      btn.textContent = 'Disable';
      if(status) status.textContent = 'Push is ON for this device — clock-in reminders, leave decisions, and new training';
    }
  }
  btn.disabled = false;
}

async function refreshPushToggleState(){
  const btn = document.getElementById('pushToggleBtn');
  const status = document.getElementById('pushStatusText');
  if(!btn) return;
  const subbed = await isPushSubscribed();
  btn.textContent = subbed ? 'Disable' : 'Enable';
  if(status){
    status.textContent = subbed
      ? 'Push is ON for this device — clock-in reminders, leave decisions, and new training'
      : 'Get alerted even when the portal is closed — works on your phone and this browser';
  }
}

function dismissOnboardingCard(){
  localStorage.setItem('nexus_onboarding_dismissed_'+me, '1');
  localStorage.setItem('nexus_onboarding_done_'+me, '1');
  const card = document.getElementById('homeOnboardingCard');
  if(card) card.style.display = 'none';
  closeOnboardingPanel();
  try{
    fetch(SB+'/rest/v1/staff_settings?name=eq.'+encodeURIComponent(me),{
      method:'PATCH',
      headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
      body: JSON.stringify({nexus_tour_done: true})
    }).catch(function(){});
  }catch(e){}
}

async function refreshHomeOnboardingCard(){
  const card = document.getElementById('homeOnboardingCard');
  if(card) card.style.display = 'none';
  return;
}


window.addEventListener('hashchange', function(){
  if(!me) return;
  const hash = location.hash.replace('#','');
  if(hash === 'reports') localStorage.setItem('nexus_visited_reports_'+me,'1');
  if(typeof refreshHomeOnboardingCard === 'function') refreshHomeOnboardingCard();
});

function openExtraBreakRequest(){
  let bd = document.getElementById('extraBreakBack');
  if(!bd){
    bd = document.createElement('div');
    bd.id = 'extraBreakBack';
    bd.style.cssText = 'position:fixed;inset:0;z-index:9550;background:rgba(15,23,42,.55);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:16px;';
    document.body.appendChild(bd);
    bd.addEventListener('click', function(e){ if(e.target===bd) bd.style.display='none'; });
  }
  const today = new Date().toISOString().split('T')[0];
  bd.innerHTML = '<div style="background:var(--ui-surface,#fff);border-radius:14px;width:100%;max-width:420px;display:flex;flex-direction:column;overflow:hidden;" onclick="event.stopPropagation()">'+
    '<div style="padding:16px 18px;border-bottom:1px solid var(--ui-line-soft,#f1f5f9);">'+
      '<div style="font-size:14px;font-weight:700;color:var(--ui-ink,#0f172a);">Request extra break</div>'+
      '<div style="font-size:12px;color:var(--ui-ink-3,#64748b);margin-top:2px;">Manager approval required.</div>'+
    '</div>'+
    '<div style="padding:18px;">'+
      '<label style="font-size:11px;font-weight:600;color:var(--ui-ink-3,#64748b);display:block;margin-bottom:6px;">Date</label>'+
      '<input type="date" id="ebrDate" value="'+today+'" style="width:100%;border:1.5px solid var(--ui-line,#e2e8f0);border-radius:8px;padding:9px 12px;font-size:14px;font-family:inherit;outline:none;margin-bottom:14px;">'+
      '<label style="font-size:11px;font-weight:600;color:var(--ui-ink-3,#64748b);display:block;margin-bottom:6px;">Extra break time</label>'+
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">'+
        '<input type="range" id="ebrSlider" min="15" max="180" step="15" value="15" oninput="updateExtraBreakLabel(this.value)" style="flex:1;accent-color:var(--accent);">'+
        '<div id="ebrLabel" style="font-size:14px;font-weight:700;color:var(--ui-ink,#0f172a);min-width:80px;text-align:right;font-variant-numeric:tabular-nums;">+15 min</div>'+
      '</div>'+
      '<div style="font-size:10.5px;color:var(--ui-ink-4,#94a3b8);margin-bottom:14px;">Adds to your standard 30-min break. Pick in 15-min steps.</div>'+
      '<label style="font-size:11px;font-weight:600;color:var(--ui-ink-3,#64748b);display:block;margin-bottom:6px;">Reason (optional)</label>'+
      '<textarea id="ebrReason" rows="2" placeholder="e.g. medical appointment, errand" style="width:100%;border:1.5px solid var(--ui-line,#e2e8f0);border-radius:8px;padding:9px 12px;font-size:13px;font-family:inherit;outline:none;resize:vertical;"></textarea>'+
    '</div>'+
    '<div style="padding:12px 18px;border-top:1px solid var(--ui-line-soft,#f1f5f9);display:flex;gap:8px;justify-content:flex-end;">'+
      '<button onclick="document.getElementById(\'extraBreakBack\').style.display=\'none\'" class="btn btn-outline" style="padding:8px 16px;font-size:13px;">Cancel</button>'+
      '<button onclick="submitExtraBreakRequest()" class="btn btn-green" style="padding:8px 18px;font-size:13px;" id="ebrSubmitBtn">Submit request</button>'+
    '</div>'+
    '<div id="ebrHistory" style="border-top:1px solid var(--ui-line-soft,#f1f5f9);padding:14px 18px;max-height:210px;overflow-y:auto;">'+
      '<div style="font-size:11px;font-weight:700;color:var(--ui-ink-3,#64748b);text-transform:uppercase;letter-spacing:.04em;margin-bottom:10px;">Your recent requests</div>'+
      '<div id="ebrHistoryBody" style="font-size:12.5px;color:var(--ui-ink-4,#94a3b8);">'+nxSkel('lines',3)+'</div>'+
    '</div>'+
  '</div>';
  bd.style.display = 'flex';
  loadMyBreakHistory();
}

async function loadMyBreakHistory(){
  const box = document.getElementById('ebrHistoryBody');
  if(!box) return;
  try{
    const rows = await sbGet('extra_break_requests',
      '?staff_name=eq.'+encodeURIComponent(me)+'&order=created_at.desc&limit=10');
    if(!rows || !rows.length){
      box.innerHTML = '<div style="color:var(--ui-ink-4,#94a3b8);">No requests yet. Your first one will show here with its outcome.</div>';
      return;
    }
    box.innerHTML = rows.map(function(r){
      var st = (r.status||'pending').toLowerCase();
      var pill = st==='approved'
        ? '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;background:rgba(22,163,74,.12);color:#16a34a;">Approved</span>'
        : st==='declined'
        ? '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;background:rgba(220,38,38,.1);color:#dc2626;">Declined</span>'
        : st==='voided'
        ? '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;background:rgba(100,116,139,.12);color:var(--ui-ink-3,#64748b);">Voided</span>'
        : '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;background:rgba(217,119,6,.12);color:#d97706;">Pending</span>';
      var dLabel = '';
      try{
        var p = String(r.request_date).split('-');
        var d = new Date(+p[0], +p[1]-1, +p[2]);
        dLabel = d.toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'});
      }catch(e){ dLabel = r.request_date || ''; }
      var who = (st==='approved'||st==='declined') && r.resolved_by
        ? '<div style="font-size:11px;color:var(--ui-ink-4,#94a3b8);margin-top:2px;">by '+esc(r.resolved_by)+'</div>'
        : st==='voided'
        ? '<div style="font-size:11px;color:var(--ui-ink-4,#94a3b8);margin-top:2px;">cleared automatically — timesheet was edited</div>' : '';
      var reason = r.reason
        ? '<div style="font-size:11px;color:var(--ui-ink-4,#94a3b8);margin-top:1px;">“'+esc(r.reason)+'”</div>' : '';
      return '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid #f4f6f9;">'+
        '<div style="min-width:0;">'+
          '<div style="font-size:13px;font-weight:600;color:var(--ui-ink,#0f172a);">+'+(r.minutes||0)+' min · '+dLabel+'</div>'+
          reason + who +
        '</div>'+
        '<div style="flex:none;">'+pill+'</div>'+
      '</div>';
    }).join('');
  }catch(e){
    box.innerHTML = '<div style="color:#dc2626;">Couldn\'t load your history right now.</div>';
  }
}

function updateExtraBreakLabel(val){
  const v = parseInt(val,10);
  const h = Math.floor(v/60);
  const m = v % 60;
  let label = '+';
  if(h && m) label += h+'h '+m+'m';
  else if(h) label += h+'h';
  else label += m+' min';
  document.getElementById('ebrLabel').textContent = label;
}

async function submitExtraBreakRequest(){
  const date = document.getElementById('ebrDate').value;
  const minutes = parseInt(document.getElementById('ebrSlider').value, 10);
  const reason = document.getElementById('ebrReason').value.trim();
  const btn = document.getElementById('ebrSubmitBtn');
  if(!date || !minutes){ showToast('Pick a date and duration'); return; }
  if(minutes % 15 !== 0 || minutes < 15 || minutes > 180){ showToast('Must be 15-min steps, 15 min to 3 hr'); return; }
  btn.disabled = true; btn.textContent = 'Submitting...';
  try{
    await fetch(SB+'/rest/v1/extra_break_requests',{
      method:'POST',
      headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
      body: JSON.stringify({
        staff_name: me,
        request_date: date,
        minutes: minutes,
        reason: reason || null,
        status: 'pending'
      })
    });
    showToast('Request sent to manager');
    document.getElementById('extraBreakBack').style.display = 'none';
  }catch(e){
    showToast('Failed to send request');
    btn.disabled = false; btn.textContent = 'Submit request';
  }
}

async function loadExtraBreakRequests(){
  const el = document.getElementById('ebrAdminList');
  if(!el) return;
  if(!myIsAdmin) return;
  try{
    const rows = await sbGet('extra_break_requests','?status=eq.pending&order=created_at.asc&limit=50');
    if(!rows || !rows.length){
      el.innerHTML = '<div style="padding:30px 20px;text-align:center;color:var(--ui-ink-4,#94a3b8);font-size:13px;">No pending requests.</div>';
      return;
    }
    let html = '';
    rows.forEach(function(r){
      const d = r.request_date ? new Date(r.request_date).toLocaleDateString('en-AU',{weekday:'short',day:'2-digit',month:'short'}) : '';
      const h = Math.floor(r.minutes/60);
      const m = r.minutes % 60;
      let dur = '';
      if(h && m) dur = h+'h '+m+'m';
      else if(h) dur = h+'h';
      else dur = m+' min';
      const safeStaff = String(r.staff_name||'').replace(/"/g,'&quot;');
      html += '<div style="padding:12px 14px;border-bottom:1px solid var(--ui-line-soft,#f1f5f9);display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start;">'+
        '<div style="flex:1;min-width:160px;">'+
          '<div style="font-size:13px;font-weight:700;color:var(--ui-ink,#0f172a);">'+safeStaff+' · +'+dur+'</div>'+
          '<div style="font-size:11.5px;color:var(--ui-ink-3,#64748b);margin-top:2px;">'+d+(r.reason?' · '+esc(r.reason):'')+'</div>'+
        '</div>'+
        '<div style="display:flex;gap:6px;">'+
          '<button data-id="'+r.id+'" data-staff="'+safeStaff+'" data-date="'+r.request_date+'" data-min="'+r.minutes+'" onclick="handleApproveBreak(this)" style="padding:6px 12px;background:#10b981;color:#fff;border:none;border-radius:8px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;">Approve</button>'+
          '<button data-id="'+r.id+'" onclick="handleDeclineBreak(this)" style="padding:6px 12px;background:#fee2e2;color:#991b1b;border:none;border-radius:8px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;">Decline</button>'+
        '</div>'+
      '</div>';
    });
        el.innerHTML = html;
  }catch(e){
    el.innerHTML = '<div style="padding:14px;color:#dc2626;">Failed to load.</div>';
  }
}

async function approveExtraBreak(id, staff, date, minutes){
  if(date && date.length > 10) date = date.slice(0, 10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){
    showToast('Bad date format: '+date);
    return;
  }
  if(!(await nxConfirm(minutes+' min extra break for '+staff+' on '+date+'.',{title:'Approve extra break?',okText:'Approve'}))) return;
  try{
    await fetch(SB+'/rest/v1/extra_break_requests?id=eq.'+encodeURIComponent(id),{
      method:'PATCH',
      headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
      body: JSON.stringify({status:'approved', resolved_by: me})
    });
    const existing = await sbGet('clock_overrides','?staff_name=eq.'+encodeURIComponent(staff)+'&date=eq.'+date);
    const _dow = new Date(date + 'T00:00:00').getDay();
    const _isWeekend = (_dow === 0 || _dow === 6);
    let rawHours = 0, clockedOut = false;
    try{
      const dayStart = new Date(date + 'T00:00:00');
      const dayEnd = new Date(date + 'T23:59:59');
      const dayLogs = await sbGet('clock_log','?staff_name=eq.'+encodeURIComponent(staff)+'&ts=gte.'+dayStart.toISOString()+'&ts=lte.'+dayEnd.toISOString()+'&order=ts.asc');
      const inTs = (dayLogs||[]).find(function(r){return r.action==='in';});
      const outTs = (dayLogs||[]).slice().reverse().find(function(r){return r.action==='out';});
      if(inTs && outTs){ rawHours = (new Date(outTs.ts) - new Date(inTs.ts)) / 3600000; clockedOut = true; }
    }catch(e){}
    const standardBreak = _isWeekend ? 0 : ((!clockedOut || rawHours > 5) ? 0.5 : 0);
    let currentBreak;
    if(existing && existing.length){
      const existingBreak = parseFloat(existing[0].break_hrs) || 0;
      currentBreak = Math.max(existingBreak, standardBreak);
    } else {
      currentBreak = standardBreak;
    }
    const newBreak = currentBreak + (minutes / 60);
    console.log('[approveBreak] staff:', staff, 'date:', date, 'standard:', standardBreak, 'clockedOut:', clockedOut, 'base:', currentBreak, 'add:', minutes/60, 'new:', newBreak);
    let writeRes;
    if(existing && existing.length){
      writeRes = await fetch(SB+'/rest/v1/clock_overrides?staff_name=eq.'+encodeURIComponent(staff)+'&date=eq.'+date,{
        method:'PATCH',
        headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'return=representation'},
        body: JSON.stringify({break_hrs: newBreak, edited_by: me})
      });
    } else {
      writeRes = await fetch(SB+'/rest/v1/clock_overrides',{
        method:'POST',
        headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'return=representation'},
        body: JSON.stringify({staff_name: staff, date: date, break_hrs: newBreak, edited_by: me})
      });
    }
    if(!writeRes.ok){
      const errTxt = await writeRes.text().catch(function(){return '?';});
      console.error('[approveBreak] supabase WRITE FAILED:', writeRes.status, errTxt);
      showToast('Supabase write failed: '+writeRes.status);
      return;
    }
    const verify = await sbGet('clock_overrides','?staff_name=eq.'+encodeURIComponent(staff)+'&date=eq.'+date);
    if(!verify || !verify.length || Math.abs(parseFloat(verify[0].break_hrs) - newBreak) > 0.001){
      console.error('[approveBreak] verify failed. Got:', verify);
      showToast('Write did not persist');
      return;
    }
    console.log('[approveBreak] verified break_hrs in supabase:', verify[0].break_hrs);
    const [y,mo,d] = date.split('-');
    const sheetDate = d+'/'+mo+'/'+y;
    fetch('https://script.google.com/macros/s/AKfycby0Bq97bCZAsmnruXFuJuCqXQE_kOxhYE2KFuJnVzLXtT5CV0Y12k5176dxZbdaYVGE/exec',{
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify({action:'updatePunch', staff:staff, date:sheetDate, breakHrs: newBreak, editor: me+' (extra break +'+minutes+'min)'})
    }).catch(function(){});
    showToast('Approved · break updated to '+newBreak+'h');
    loadExtraBreakRequests();
    const mgrStart = document.getElementById('mgrStart');
    const mgrEnd = document.getElementById('mgrEnd');
    if(mgrStart && mgrEnd){
      if(date < mgrStart.value) mgrStart.value = date;
      if(date > mgrEnd.value) mgrEnd.value = date;
      const mgrSel = document.getElementById('mgrStaffSel');
      if(mgrSel) mgrSel.value = staff;
    }
    setTimeout(async function(){
      if(typeof runHoursReport === 'function') await runHoursReport();
      if(typeof runManagerReport === 'function') await runManagerReport();
      if(typeof loadAllClockLogs === 'function') await loadAllClockLogs();
      if(typeof renderHours === 'function') renderHours();
    }, 400);
  }catch(e){ showToast('Approve failed'); }
}

function handleApproveBreak(btn){
  approveExtraBreak(btn.dataset.id, btn.dataset.staff, btn.dataset.date, parseInt(btn.dataset.min,10));
}
function handleDeclineBreak(btn){
  declineExtraBreak(btn.dataset.id);
}

async function declineExtraBreak(id){
  if(!(await nxConfirm('The staff member will see it was declined.',{title:'Decline this request?',okText:'Decline',danger:true}))) return;
  try{
    await fetch(SB+'/rest/v1/extra_break_requests?id=eq.'+encodeURIComponent(id),{
      method:'PATCH',
      headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
      body: JSON.stringify({status:'declined', resolved_by: me})
    });
    showToast('Request declined');
    loadExtraBreakRequests();
  }catch(e){ showToast('Decline failed'); }
}





