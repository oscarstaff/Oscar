async function loadHomeAttention(){
  const wrap = document.getElementById('homeAttention');
  if(!wrap) return;
  const items = [];
  try{
    try{
      const av = await sbGet('staff_availability','?staff_name=eq.'+encodeURIComponent(me)+'&limit=1');
      if(av && av.length){
        const row = av[0];
        if(!row.is_ongoing && row.valid_until){
          const today = new Date(); today.setHours(0,0,0,0);
          const until = new Date(row.valid_until+'T00:00:00');
          if(!isNaN(until.getTime()) && until < today){
            items.push({
              color:'#dc2626', icon:'alert',
              title:'Your availability has expired',
              sub:'Expired '+fmtF(row.valid_until)+' · tap to update it',
              action: function(){
                goTo('schedule');
                setTimeout(function(){
                  if(typeof showSchedTab==='function') showSchedTab('availability');
                  if(typeof showAvailForm==='function') showAvailForm();
                }, 120);
              }
            });
          }
        }
      }
    }catch(e){}

    try{
      const [quizzes, results] = await Promise.all([
        sbGet('custom_quizzes','?order=created_at.desc'),
        sbGet('custom_quiz_results','?staff_name=eq.'+encodeURIComponent(me)+'&select=quiz_id,passed')
      ]);
      const passedIds = new Set((results||[]).filter(r=>r.passed).map(r=>r.quiz_id));
      const pending = (quizzes||[]).filter(function(q){
        if(passedIds.has(q.id)) return false;
        if(q.teams && q.teams.length && myTeam && !q.teams.includes(myTeam)) return false;
        return true;
      });
      if(pending.length){
        items.push({
          color:'#8b5cf6', icon:'quiz',
          title: pending.length===1 ? '1 training quiz to complete' : pending.length+' training quizzes to complete',
          sub: 'Tap to open your training',
          action: function(){ goTo('training'); }
        });
      }
    }catch(e){}

    try{
      const lv = await sbGet('leave_submissions','?staff_name=eq.'+encodeURIComponent(me)+'&order=submitted_at.desc&limit=5');
      const decided = (lv||[]).filter(function(r){ return r.status==='approved' || r.status==='declined'; });
      const seen = JSON.parse(localStorage.getItem('nexus_seen_leave_'+me)||'[]');
      const fresh = decided.filter(function(r){ return !seen.includes(r.id); });
      if(fresh.length){
        const r = fresh[0];
        const ok = r.status==='approved';
        items.push({
          color: ok?'#22c55e':'#ef4444', icon: ok?'check':'cross',
          title: 'Leave '+(ok?'approved':'declined')+': '+fmtF(r.from_date)+(r.from_date!==r.to_date?(' – '+fmtF(r.to_date)):''),
          sub: 'Tap to view your leave',
          action: function(){
            const all = JSON.parse(localStorage.getItem('nexus_seen_leave_'+me)||'[]');
            fresh.forEach(function(f){ if(!all.includes(f.id)) all.push(f.id); });
            localStorage.setItem('nexus_seen_leave_'+me, JSON.stringify(all));
            goTo('schedule'); setTimeout(function(){ if(typeof showSchedTab==='function') showSchedTab('leave'); }, 100);
          }
        });
      }
    }catch(e){}


    if(typeof myIsAdmin!=='undefined' && myIsAdmin){
      try{
        const pend = await sbGet('leave_submissions','?status=eq.pending&select=id&limit=50');
        if(pend && pend.length){
          items.push({
            color:'#3b82f6', icon:'inbox',
            title: pend.length===1 ? '1 leave request to review' : pend.length+' leave requests to review',
            sub: 'Manage in ShiftOps',
            action: function(){ if(typeof goTo==='function') goTo('hub'); }
          });
        }
      }catch(e){}
    }
  }catch(e){}

  if(!items.length){ wrap.style.display='none'; return; }

  const iconSvg = {
    quiz:'<path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>',
    check:'<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>',
    cross:'<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>',
    clock:'<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/>',
    inbox:'<path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm2 0v8h12V6H4z"/>',
    alert:'<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>'
  };

  wrap.innerHTML = items.map(function(it, i){
    return '<div class="attn-row" data-i="'+i+'" style="display:flex;align-items:center;gap:12px;background:var(--ui-surface,#fff);border:1px solid var(--ui-line,#e2e8f0);border-left:3px solid '+it.color+';border-radius:12px;padding:12px 14px;margin-bottom:8px;cursor:pointer;">'+
      '<div style="width:32px;height:32px;border-radius:10px;background:'+it.color+'1a;display:flex;align-items:center;justify-content:center;flex-shrink:0;">'+
        '<svg width="17" height="17" viewBox="0 0 20 20" fill="'+it.color+'">'+(iconSvg[it.icon]||'')+'</svg>'+
      '</div>'+
      '<div style="flex:1;min-width:0;">'+
        '<div style="font-size:13.5px;font-weight:700;color:var(--ui-ink,#0f172a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(it.title)+'</div>'+
        '<div style="font-size:11.5px;color:var(--ui-ink-3,#64748b);margin-top:1px;">'+esc(it.sub)+'</div>'+
      '</div>'+
      '<svg width="16" height="16" viewBox="0 0 20 20" fill="#cbd5e1"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>'+
    '</div>';
  }).join('');
  Array.prototype.forEach.call(wrap.querySelectorAll('.attn-row'), function(row){
    row.onclick = function(){ const it = items[parseInt(row.dataset.i)]; if(it && it.action) it.action(); };
  });
  wrap.style.display = 'block';
}

const NEXUS_WHATS_NEW = [
];

function _whatsNewSeenKey(){
  try{ return 'nexus_whatsnew_seen_' + ((typeof me!=='undefined'&&me)?me:'anon'); }
  catch(e){ return 'nexus_whatsnew_seen_anon'; }
}
function _whatsNewLatestDate(){
  return NEXUS_WHATS_NEW.reduce(function(mx,e){ return e.date>mx?e.date:mx; }, '');
}
function _whatsNewUnseenCount(){
  let seen='';
  try{ seen = localStorage.getItem(_whatsNewSeenKey()) || ''; }catch(e){}
  return NEXUS_WHATS_NEW.filter(function(e){ return e.date > seen; }).length;
}

function loadWhatsNew(){
  const card = document.getElementById('homeWhatsNew');
  if(!card) return;
  if(!NEXUS_WHATS_NEW.length){ card.style.display='none'; return; }
  card.style.display = 'block';
  const unseen = _whatsNewUnseenCount();
  const badge = document.getElementById('whatsNewBadge');
  const sub   = document.getElementById('whatsNewSub');
  if(badge) badge.style.display = unseen>0 ? 'inline-block' : 'none';
  if(sub){
    const latest = NEXUS_WHATS_NEW.slice().sort(function(a,b){return b.date<a.date?-1:1;})[0];
    sub.textContent = unseen>0
      ? (unseen + ' new update' + (unseen>1?'s':''))
      : ('Latest: ' + (latest?latest.title:''));
  }
}

function _fmtWhatsNewDate(d){
  try{
    const dt = new Date(d+'T00:00:00');
    return dt.toLocaleDateString('en-AU',{day:'numeric',month:'short'});
  }catch(e){ return d; }
}

function renderWhatsNewBody(){
  const body = document.getElementById('whatsNewBody');
  if(!body) return;
  const tagColor = { 'New':'#16a34a', 'Fixed':'#3b82f6', 'Improved':'#7c3aed' };
  const rows = NEXUS_WHATS_NEW.slice().sort(function(a,b){ return b.date<a.date?-1:1; });
  body.innerHTML = rows.map(function(e){
    const c = tagColor[e.tag] || 'var(--accent,#3b82f6)';
    return '<div style="display:flex;gap:10px;padding:9px 0;border-bottom:1px solid var(--ui-line-soft,#f1f5f9);">'+
      '<div style="flex-shrink:0;width:52px;font-size:10px;color:var(--ui-ink-4,#94a3b8);font-weight:600;padding-top:2px;">'+_fmtWhatsNewDate(e.date)+'</div>'+
      '<div style="flex:1;min-width:0;">'+
        '<div style="display:flex;align-items:center;gap:7px;margin-bottom:2px;">'+
          '<span style="font-size:8.5px;font-weight:800;letter-spacing:.4px;color:#fff;background:'+c+';border-radius:6px;padding:1px 6px;text-transform:uppercase;">'+e.tag+'</span>'+
          '<span style="font-size:12.5px;font-weight:700;color:inherit;">'+e.title+'</span>'+
        '</div>'+
        '<div style="font-size:11.5px;color:var(--ui-ink-3,#64748b);line-height:1.45;">'+e.body+'</div>'+
      '</div>'+
    '</div>';
  }).join('');
  try{ localStorage.setItem(_whatsNewSeenKey(), _whatsNewLatestDate()); }catch(e){}
}

function toggleWhatsNew(){
  const body = document.getElementById('whatsNewBody');
  const chev = document.getElementById('whatsNewChevron');
  if(!body) return;
  const open = body.style.display !== 'none';
  if(open){
    body.style.display = 'none';
    if(chev) chev.style.transform = 'rotate(0deg)';
  }else{
    renderWhatsNewBody();
    body.style.display = 'block';
    if(chev) chev.style.transform = 'rotate(180deg)';
    loadWhatsNew();
  }
}




function renderTodayChip(){
  const el = document.getElementById('todayChipText');
  if(!el) return;
  el.textContent = new Date().toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long'});
}

async function loadHomeCalendar(){
  const list = document.getElementById('homeCalList');
  if(!list) return;
  try{
    const todayStr = new Date().toISOString().slice(0,10);
    const rows = await sbGet('calendar_events','?event_date=gte.'+todayStr+'&order=event_date.asc&limit=4');
    if(!rows.length){
      list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--ui-ink-4,#94a3b8);font-size:12px;">No upcoming events.</div>';
      return;
    }
    const today = new Date(); today.setHours(0,0,0,0);
    list.innerHTML = rows.map(function(ev){
      const dd = new Date(ev.event_date+'T00:00:00');
      const diff = Math.round((dd - today)/86400000);
      const when = diff===0?'Today':diff===1?'Tomorrow':dd.toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'});
      const dayNum = dd.getDate();
      const monShort = dd.toLocaleDateString(undefined,{month:'short'});
      const accent = diff===0?'var(--accent-text,#f59e0b)':diff===1?'var(--m-ink,#3b82f6)':'var(--m-ink-3,#64748b)';
      return '<div style="display:flex;align-items:center;gap:12px;padding:9px 2px;border-bottom:1px solid var(--m-border,#f8fafc);">'+
        '<div style="width:42px;height:42px;border-radius:10px;background:var(--ui-surface-2,#f8fafc);border:1px solid var(--ui-line-soft,#f1f5f9);display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;">'+
          '<div style="font-size:15px;font-weight:800;color:'+accent+';line-height:1;">'+dayNum+'</div>'+
          '<div style="font-size:9px;font-weight:700;color:var(--ui-ink-4,#94a3b8);text-transform:uppercase;letter-spacing:.04em;">'+monShort+'</div>'+
        '</div>'+
        '<div style="flex:1;min-width:0;">'+
          '<div style="font-size:13.5px;font-weight:600;color:var(--ui-ink,#0f172a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(ev.title||'')+'</div>'+
          '<div style="font-size:11px;font-weight:600;color:'+accent+';margin-top:1px;">'+when+'</div>'+
          (ev.description?'<div style="font-size:11px;color:var(--ui-ink-4,#94a3b8);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(ev.description)+'</div>':'')+
        '</div>'+
      '</div>';
    }).join('');
  }catch(e){
    list.innerHTML = '<div style="padding:18px;text-align:center;color:var(--ui-ink-4,#94a3b8);font-size:12px;">Could not load events.</div>';
  }
}

async function loadHomeData(){
  const statsEl=document.getElementById("homeStats"),sumEl=document.getElementById("homeAvailSummary");if(!statsEl)return;
  return;
  try{
    const [ar,lr]=await Promise.all([
      sbGet("staff_availability","?staff_name=eq."+encodeURIComponent(me)+"&limit=1"),
      sbGet("leave_submissions","?staff_name=eq."+encodeURIComponent(me)+"&status=eq.pending")
    ]);
    const avDays=ar.length?Object.values(ar[0].availability).filter(a=>a.type!=="no"&&a.type!=="unset").length:0;
    statsEl.innerHTML=
      '<div class="stat-box"><div class="stat-val green">'+avDays+'</div><div class="stat-label">Available Days</div></div>'+
      '<div class="stat-box"><div class="stat-val blue">'+lr.length+'</div><div class="stat-label">Pending Leave</div></div>';
    if(!ar.length){
      if(sumEl)sumEl.innerHTML='<div style="text-align:center;padding:20px 0"><div style="font-size:13px;font-weight:600;color:var(--ui-ink-2b,#475569);margin-bottom:6px">No availability set</div><div style="font-size:12px;color:var(--ui-ink-4,#94a3b8);margin-bottom:16px">Set your availability so your manager can plan the roster.</div><button onclick="goTo(\'availability\')" class="btn btn-green" style="padding:10px 20px;font-size:13px">Set Availability</button></div>';
      return;
    }
    const av=ar[0].availability;
    const period=ar[0].is_ongoing?"Ongoing":(ar[0].valid_from?"From "+fmtF(ar[0].valid_from)+(ar[0].valid_until?" - "+fmtF(ar[0].valid_until):""):"");
    if(sumEl)sumEl.innerHTML='<div style="font-size:11px;color:var(--ui-ink-4,#94a3b8);margin-bottom:10px;font-weight:500;">'+period+'</div>'+
    DAYS.map((day,i)=>{
      const a=av[i]||av[String(i)]||{type:"unset"};
      const lbl=a.type==="custom"?(a.start+" \u2013 "+a.end):a.type==="all"?"Available":a.type==="no"?"Unavailable":"Not Set";
      const cls=a.type==="no"?"asr-red":a.type==="custom"?"asr-blue":a.type==="all"?"asr-green":"asr-grey";
      return '<div class="avail-summary-row"><div><div class="asr-day">'+DS[i]+'</div><div class="asr-date">'+fmt(addD(weekStart,i))+'</div></div><div class="asr-status '+cls+'">'+lbl+'</div></div>';
    }).join("");
  }catch(e){if(sumEl)sumEl.innerHTML='<div style="padding:12px 0;font-size:12px;color:var(--ui-ink-4,#94a3b8)">Could not load data.</div>';}
}

async function submitLeave(){
  const from=document.getElementById("leaveFrom").value;
  const to=document.getElementById("leaveTo").value;
  const sel=document.getElementById("leaveReason").value;
  const otherTxt=(document.getElementById("leaveOther").value||"").trim();
  const err=document.getElementById("leaveErr"),ok=document.getElementById("leaveOk");
  err.classList.remove("show");ok.classList.remove("show");
  document.getElementById("leaveReason").classList.remove("error");
  document.getElementById("leaveOther").classList.remove("error");
  if(!from||!to){err.textContent="Please select your leave dates.";err.classList.add("show");return;}
  if(from>to){err.textContent="End date must be on or after start date.";err.classList.add("show");return;}
  if(!sel){
    err.textContent="Please select a reason for your leave request — this is required.";
    err.classList.add("show");
    document.getElementById("leaveReason").classList.add("error");
    document.getElementById("leaveReason").focus();
    return;
  }
  if(sel==="Other" && !otherTxt){
    err.textContent="Please specify your reason.";
    err.classList.add("show");
    document.getElementById("leaveOther").classList.add("error");
    document.getElementById("leaveOther").focus();
    return;
  }
  const reasonType = sel;
  const reason = (sel==="Other") ? otherTxt : sel;
  const btn=document.getElementById("leaveBtn");btn.disabled=true;btn.innerHTML='<span class="sp"></span> Submitting...';
  try{
    const res=await sbPost("leave_submissions",{staff_name:me,from_date:from,to_date:to,reason,reason_type:reasonType,status:"pending",source:"Web"});
    if(res.ok||res.status===201){
      ok.textContent="Request submitted. Your manager will review it shortly.";ok.classList.add("show");
      document.getElementById("leaveReason").value="";
      document.getElementById("leaveOther").value="";
      document.getElementById("leaveOtherWrap").style.display="none";
      loadLeaveHistory();loadHomeData();
    }else throw new Error();
  }catch(e){err.textContent="Failed to submit. Please check your connection.";err.classList.add("show");}
  finally{btn.disabled=false;btn.textContent="Submit Leave Request";}
}
function onLeaveReasonChange(){
  const sel=document.getElementById("leaveReason").value;
  const wrap=document.getElementById("leaveOtherWrap");
  if(wrap) wrap.style.display = (sel==="Other") ? "block" : "none";
  document.getElementById("leaveReason").classList.remove("error");
}
/* ── Shift Pickup ─────────────────────────────────────────────────────────
   Shifts a manager has opened to your team. Claiming goes through the
   claim_shift() RPC, which locks the row server-side — so if two people tap
   at the same moment exactly one wins and the other is told cleanly rather
   than both believing they got it.
   ──────────────────────────────────────────────────────────────────────── */
/* ── My Roster ────────────────────────────────────────────────────────────
   The staff-facing view of roster_shifts: what you're actually working, and
   the way to hand a shift back. Asking to give one up sets it to
   pending_release; a manager approves, which opens it to everyone in Shift
   Pickup. Staff never release a shift unilaterally — there'd be no cover.
   ──────────────────────────────────────────────────────────────────────── */
/* ── Published-week gate ──────────────────────────────────────────────────
   A roster week is a DRAFT until the manager publishes it in ShiftOps.
   Staff-facing views (My Roster, Shift Pickup) only show shifts from
   published weeks, so nobody sees a half-built roster being shuffled.
   Fails OPEN on a fetch error: on a flaky connection it's better to show a
   possibly-draft roster than to make everyone's shifts vanish. */
async function _publishedWeeks(){
  try{
    const rows=await sbGet('roster_published','?select=week_start');
    return new Set((rows||[]).map(function(x){return x.week_start;}));
  }catch(e){
    console.warn('[PUBLISH-GATE] fetch failed — failing open', e);
    return null;
  }
}
function _weekMonISO(dateStr){
  const d=new Date(dateStr+'T00:00:00');
  d.setDate(d.getDate()-((d.getDay()+6)%7));
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function _filterPublished(rows, pub){
  if(pub===null) return rows;
  return (rows||[]).filter(function(r){ return pub.has(_weekMonISO(r.shift_date)); });
}

async function loadMyRoster(){
  const host=document.getElementById('myRosterList');
  if(!host) return;
  host.innerHTML='<div style="padding:26px 0;text-align:center;color:var(--ui-ink-4,#94a3b8);font-size:13px;">'+nxSkel('cards',3)+'</div>';
  try{
    const today=new Date(); today.setHours(0,0,0,0);
    const iso=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
    const rows=await sbGet('roster_shifts',
      '?staff_name=eq.'+encodeURIComponent(me)+
      '&shift_date=gte.'+iso+
      '&select=id,shift_date,start_time,end_time,role,status'+
      '&order=shift_date.asc,start_time.asc');
    const pub=await _publishedWeeks();
    const visible=_filterPublished(rows||[], pub);
    if(!visible.length && (rows||[]).length){
      const host2=document.getElementById('myRosterList');
      if(host2) host2.innerHTML='<div style="padding:30px 0;text-align:center;color:var(--ui-ink-4,#94a3b8);font-size:13px;">Your roster for the coming weeks hasn\'t been published yet.</div>';
      return;
    }
    renderMyRoster(visible);
  }catch(e){
    console.warn('loadMyRoster',e);
    host.innerHTML='<div style="padding:26px 0;text-align:center;color:var(--ui-ink-4,#94a3b8);font-size:13px;">Couldn\'t load your roster. Pull to refresh.</div>';
  }
}

function renderMyRoster(rows){
  const host=document.getElementById('myRosterList');
  if(!host) return;
  if(!rows.length){
    host.innerHTML='<div style="padding:30px 0;text-align:center;color:var(--ui-ink-4,#94a3b8);font-size:13px;">No upcoming shifts rostered.</div>';
    return;
  }
  const hhmm=function(t){ return String(t||'').slice(0,5); };
  const groups={};
  rows.forEach(function(r){
    const d=new Date(r.shift_date+'T00:00:00');
    const mon=new Date(d); mon.setDate(mon.getDate()-((d.getDay()+6)%7));
    const key=mon.toISOString().slice(0,10);
    (groups[key]=groups[key]||[]).push(r);
  });

  const thisMon=(function(){ const d=new Date(); d.setDate(d.getDate()-((d.getDay()+6)%7)); d.setHours(0,0,0,0); return d.toISOString().slice(0,10); })();

  host.innerHTML=Object.keys(groups).sort().map(function(wk){
    const mon=new Date(wk+'T00:00:00');
    const sun=new Date(mon); sun.setDate(sun.getDate()+6);
    const fmt=function(d){ return d.toLocaleDateString('en-AU',{day:'numeric',month:'short'}); };
    const label=(wk===thisMon?'This week':'Week of '+fmt(mon))+' · '+fmt(mon)+' – '+fmt(sun);
    const items=groups[wk].map(function(r){
      const d=new Date(r.shift_date+'T00:00:00');
      const day=d.toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'short'});
      let pill='', action='';
      if(r.status==='pending_release'){
        pill='<span style="font-size:11px;font-weight:700;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:999px;padding:3px 9px;">Awaiting approval</span>';
      }else if(r.status==='open'){
        pill='<span style="font-size:11px;font-weight:700;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:999px;padding:3px 9px;">Released — awaiting pickup</span>';
      }else{
        action='<button class="btn btn-ghost" style="font-size:12px;padding:6px 12px;" onclick="askReleaseShift(\''+r.id+'\',this)">Can\'t make it</button>';
      }
      return ''+
      '<div style="border:1px solid var(--ui-line,#e2e8f0);border-radius:12px;padding:13px 15px;margin-bottom:9px;background:var(--ui-surface,#fff);">'+
        '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">'+
          '<div style="flex:1;min-width:0;">'+
            '<div style="font-size:14.5px;font-weight:700;color:var(--ui-ink,#0f172a);">'+day+'</div>'+
            '<div style="font-size:13.5px;color:var(--ui-ink-2,#334155);margin-top:2px;">'+hhmm(r.start_time)+' – '+hhmm(r.end_time)+
              (r.role?' · '+esc(r.role):'')+'</div>'+
          '</div>'+pill+action+
        '</div>'+
      '</div>';
    }).join('');
    return '<div style="margin-bottom:18px;">'+
      '<div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ui-ink-4,#94a3b8);margin-bottom:8px;">'+label+'</div>'+
      items+'</div>';
  }).join('');
}

async function askReleaseShift(shiftId, btn){
  if(!me) return;
  const reason=prompt('Optional — why can\'t you make this shift?');
  if(reason===null) return;
  if(btn){ btn.disabled=true; btn.textContent='Sending…'; }
  try{
    const res=await fetch(SB+'/rest/v1/rpc/request_shift_release',{
      method:'POST',
      headers:{apikey:KEY,Authorization:'Bearer '+(window._sbAuthToken||KEY),'Content-Type':'application/json'},
      body:JSON.stringify({p_shift_id:shiftId,p_staff_name:me,p_reason:reason||null})
    });
    if(!res.ok){
      const detail=await res.text().catch(function(){return '';});
      console.warn('[RELEASE] HTTP '+res.status, detail);
      if(res.status===404) showToast('Not available yet — try again in a moment');
      else                 showToast('Request failed ('+res.status+')');
      if(btn){ btn.disabled=false; btn.textContent='Can\'t make it'; }
      return;
    }
    const out=await res.json();
    if(out&&out.ok===true){
      showToast('Sent — your manager will review it');
      loadMyRoster();
      return;
    }
    const why=(out&&out.reason)||'unknown';
    if(why==='not_your_shift')   showToast('That isn\'t your shift');
    else if(why==='not_assigned')showToast('That shift is already being released');
    else                         showToast('Could not send the request');
    loadMyRoster();
  }catch(e){
    console.warn('askReleaseShift',e);
    showToast('Could not send — check your connection');
    if(btn){ btn.disabled=false; btn.textContent='Can\'t make it'; }
  }
}

async function loadShiftPickup(){
  const host=document.getElementById('pickupList');
  if(!host) return;
  host.innerHTML='<div style="padding:26px 0;text-align:center;color:var(--ui-ink-4,#94a3b8);font-size:13px;">'+nxSkel('cards',3)+'</div>';
  try{
    let team=myTeam||'';
    try{
      const creds=await sbGet('staff_credentials','?staff_name=eq.'+encodeURIComponent(me)+'&select=team');
      const fresh=(creds&&creds.length&&creds[0]&&creds[0].team)?creds[0].team:'';
      if(fresh){ team=fresh; myTeam=fresh; }
    }catch(e){ /* fall back to whatever we already had */ }

    if(!team){
      host.innerHTML='<div style="padding:26px 0;text-align:center;color:var(--ui-ink-4,#94a3b8);font-size:13px;">No team set on your profile, so there\'s nothing to show yet.</div>';
      updatePickupBadge(0);
      return;
    }
    const today=new Date(); today.setHours(0,0,0,0);
    const iso=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
    const rows=await sbGet('roster_shifts',
      '?status=eq.open'+
      '&or=(open_to_team.is.null,open_to_team.eq.'+encodeURIComponent(team)+')'+
      '&shift_date=gte.'+iso+
      '&select=id,staff_name,shift_date,start_time,end_time,role,open_to_team'+
      '&order=shift_date.asc,start_time.asc');
    const pub=await _publishedWeeks();
    const visible=_filterPublished(rows||[], pub);
    console.log('[PICKUP] team="'+team+'" rows='+((rows||[]).length)+' published='+visible.length);
    renderShiftPickup(visible);
    try{ refreshShiftsBadge(); }catch(e){}
  }catch(e){
    console.warn('loadShiftPickup',e);
    host.innerHTML='<div style="padding:26px 0;text-align:center;color:var(--ui-ink-4,#94a3b8);font-size:13px;">Couldn\'t load available shifts. Pull to refresh.</div>';
  }
}

function updatePickupBadge(n){
  const b=document.getElementById('pickupBadge');
  if(!b) return;
  if(n>0){ b.textContent=n; b.style.display=''; } else b.style.display='none';
}

function renderShiftPickup(rows){
  const host=document.getElementById('pickupList');
  if(!host) return;
  updatePickupBadge(rows.length);
  if(!rows.length){
    host.innerHTML='<div style="padding:30px 0;text-align:center;color:var(--ui-ink-4,#94a3b8);font-size:13px;">No shifts available right now.</div>';
    return;
  }
  const fmtDay=function(iso){
    const d=new Date(iso+'T00:00:00');
    return d.toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'});
  };
  const hhmm=function(t){ return String(t||'').slice(0,5); };
  host.innerHTML=rows.map(function(r){
    const mine=(r.staff_name===me);
    return ''+
    '<div style="border:1px solid var(--ui-line,#e2e8f0);border-radius:12px;padding:14px 16px;margin-bottom:10px;background:var(--ui-surface,#fff);">'+
      '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">'+
        '<div style="flex:1;min-width:0;">'+
          '<div style="font-size:15px;font-weight:700;color:var(--ui-ink,#0f172a);">'+fmtDay(r.shift_date)+'</div>'+
          '<div style="font-size:14px;color:var(--ui-ink-2,#334155);margin-top:2px;">'+hhmm(r.start_time)+' – '+hhmm(r.end_time)+
            (r.role?' · '+esc(r.role):'')+'</div>'+
          '<div style="font-size:12px;color:var(--ui-ink-4,#94a3b8);margin-top:4px;">Rostered to '+esc(r.staff_name)+'</div>'+
        '</div>'+
        (mine
          ? '<span style="font-size:12px;color:var(--ui-ink-4,#94a3b8);">Your shift</span>'
          : '<button class="btn btn-green" onclick="claimShift(\''+r.id+'\',this)">Claim</button>')+
      '</div>'+
    '</div>';
  }).join('');
}

async function claimShift(shiftId, btn){
  if(!me){ showToast('Not signed in'); return; }
  if(btn){ btn.disabled=true; btn.textContent='Claiming…'; }
  try{
    const res=await fetch(SB+'/rest/v1/rpc/claim_shift',{
      method:'POST',
      headers:{apikey:KEY,Authorization:'Bearer '+(window._sbAuthToken||KEY),'Content-Type':'application/json'},
      body:JSON.stringify({p_shift_id:shiftId,p_staff_name:me})
    });
    if(!res.ok){
      const detail=await res.text().catch(function(){return '';});
      console.warn('[CLAIM] HTTP '+res.status, detail);
      if(res.status===404)      showToast('Claim unavailable — server not ready yet, try again in a moment');
      else if(res.status===401||res.status===403) showToast('Not allowed to claim — try signing out and back in');
      else                      showToast('Claim failed ('+res.status+')');
      if(btn){ btn.disabled=false; btn.textContent='Claim'; }
      return;
    }
    const out=await res.json();
    if(out&&out.ok===true){
      showToast('Shift is yours');
      loadShiftPickup();
      if(typeof loadHomeData==='function') loadHomeData();
      return;
    }
    const why=(out&&out.reason)||'unknown';
    if(why==='already_taken')          showToast('Just taken by '+((out&&out.current_owner)||'someone else'));
    else if(why==='overlaps_existing') showToast('You already have a shift that overlaps this one');
    else if(why==='own_shift')         showToast('This is already your shift');
    else                               showToast('Could not claim that shift');
    loadShiftPickup();
  }catch(e){
    console.warn('claimShift',e);
    showToast('Could not claim — check your connection');
    if(btn){ btn.disabled=false; btn.textContent='Claim'; }
  }
}

async function loadLeaveHistory(){
  const el=document.getElementById("leaveHistory");
  if(el && !el.children.length) el.innerHTML=nxSkel('cards',3);
  try{
    const rows=await sbGet("leave_submissions","?staff_name=eq."+encodeURIComponent(me)+"&order=submitted_at.desc");
    updateLeaveSummary(rows);
    if(!rows.length){el.innerHTML='<div style="text-align:center;padding:32px 20px;"><svg width="36" height="36" viewBox="0 0 20 20" fill="#e2e8f0" style="margin:0 auto 10px;display:block;"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg><div style="font-size:13px;font-weight:600;color:var(--ui-ink-2b,#475569);margin-bottom:6px;">No leave requests yet</div><div style="font-size:12px;color:var(--ui-ink-4,#94a3b8);">Submit a request using the form above.</div></div>';return;}
    el.innerHTML=rows.map(r=>{
      const days=Math.round((new Date(r.to_date)-new Date(r.from_date))/(864e5))+1;
      const st=(r.status||'pending');
      const sl={pending:"Pending",approved:"Approved",declined:"Declined"}[st]||"Pending";
      const barColor={pending:"#f59e0b",approved:"#22c55e",declined:"#ef4444"}[st]||"#f59e0b";
      const submitted=r.submitted_at?new Date(r.submitted_at).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}):'';
      return '<div class="lv-row">'+
        '<div class="lv-bar" style="background:'+barColor+';"></div>'+
        '<div class="lv-body">'+
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">'+
            '<div><div class="lv-dates">'+fmtF(r.from_date)+' \u2013 '+fmtF(r.to_date)+'</div>'+
            '<div class="lv-meta">'+days+' day'+(days!==1?'s':'')+(submitted?' · requested '+submitted:'')+'</div></div>'+
            '<div class="lv-pill '+st+'">'+sl+'</div>'+
          '</div>'+
          (r.reason?'<div class="lv-reason">'+esc(r.reason)+'</div>':'')+
          (st==="declined"&&r.decline_reason?'<div class="lv-note"><strong>Manager note:</strong> '+esc(r.decline_reason)+'</div>':'')+
        '</div>'+
      '</div>';
    }).join("");
  }catch(e){el.innerHTML='<div class="empty" style="padding:12px 0"><div class="empty-sub">Could not load history.</div></div>';}
}

function updateLeaveSummary(rows){
  const dEl=document.getElementById('leaveStatDays');
  const pEl=document.getElementById('leaveStatPending');
  const nEl=document.getElementById('leaveStatNext');
  if(!dEl) return;
  const yr=new Date().getFullYear();
  let daysThisYear=0, pending=0, nextApproved=null;
  const today=new Date(); today.setHours(0,0,0,0);
  (rows||[]).forEach(function(r){
    const from=new Date(r.from_date+'T00:00:00'), to=new Date(r.to_date+'T00:00:00');
    const days=Math.round((to-from)/86400000)+1;
    if(r.status==='approved' && from.getFullYear()===yr) daysThisYear+=days;
    if(r.status==='pending') pending++;
    if(r.status==='approved' && from>=today){
      if(!nextApproved || from<nextApproved) nextApproved=from;
    }
  });
  dEl.textContent=daysThisYear;
  pEl.textContent=pending;
  nEl.textContent=nextApproved?nextApproved.toLocaleDateString(undefined,{day:'numeric',month:'short'}):'None';
}

function updateLeaveDayCount(){
  const f=document.getElementById('leaveFrom'), t=document.getElementById('leaveTo');
  const out=document.getElementById('leaveDayCount');
  if(!f||!t||!out) return;
  if(f.value && t.value){
    const from=new Date(f.value+'T00:00:00'), to=new Date(t.value+'T00:00:00');
    if(to>=from){
      const days=Math.round((to-from)/86400000)+1;
      out.textContent=days+' day'+(days!==1?'s':'');
      return;
    }
  }
  out.textContent='';
}


let _reactNotifsCache=null;
let _reactNotifsCacheTime=0;
async function loadReactNotifs(){ return []; }


function checkFeedbackInvites(){ /* removed */ }

function renderTimesheetPreview(){
}

async function loadNotifications(){
  const el=document.getElementById("notifList");
  const badge=document.getElementById("notifBadge");
  const bnBadge=document.getElementById("bnNotifBadge");
  try{
    const [rows, reactNotifs] = await Promise.all([
      sbGet("leave_submissions","?staff_name=eq."+encodeURIComponent(me)+"&status=in.(approved,declined)&order=submitted_at.desc&limit=20"),
      loadReactNotifs()
    ]);
    let serverSeen = [];
    try{
      const seenRows = await sbGet('notification_seen','?staff_name=eq.'+encodeURIComponent(me)+'&notif_key=like.leave_*&limit=200');
      serverSeen = (seenRows||[]).map(function(r){ return r.notif_key.replace('leave_',''); });
    }catch(e){}
    const read=JSON.parse(localStorage.getItem("oR_"+me)||"[]");
    const allRead = read.concat(serverSeen.filter(function(id){ return !read.includes(id); }));
    if(allRead.length !== read.length) localStorage.setItem('oR_'+me, JSON.stringify(allRead));
    const unread=rows.filter(r=>!allRead.includes(r.id));
    const NOTIF_MAX_AGE = 14*24*3600*1000;
    const freshEnough = (ts)=>{ if(!ts) return true; const t=new Date(ts).getTime(); return isNaN(t) ? true : (Date.now()-t) < NOTIF_MAX_AGE; };
    let replyNotifsList=[];
    try{ replyNotifsList=[]; }catch(e){}
    let serverReplies = [];
    try{
      const r2 = await sbGet('notification_seen','?staff_name=eq.'+encodeURIComponent(me)+'&notif_key=like.reply_*&limit=200');
      serverReplies = (r2||[]).map(function(r){ return r.notif_key.replace('reply_',''); });
    }catch(e){}
    const seenRepliesList=JSON.parse(localStorage.getItem('seen_replies_'+me)||'[]');
    const allSeenReplies = seenRepliesList.concat(serverReplies.filter(function(id){ return !seenRepliesList.includes(id); }));
    if(allSeenReplies.length !== seenRepliesList.length) localStorage.setItem('seen_replies_'+me, JSON.stringify(allSeenReplies));
    const newRepliesList=replyNotifsList.filter(r=>!allSeenReplies.includes(r.id) && freshEnough(r.created_at));
    let serverReacts = [];
    try{
      const r3 = await sbGet('notification_seen','?staff_name=eq.'+encodeURIComponent(me)+'&notif_key=like.react_*&limit=200');
      serverReacts = (r3||[]).map(function(r){ return r.notif_key.replace('react_',''); });
    }catch(e){}
    const seenReacts=JSON.parse(localStorage.getItem('seen_reacts_'+me)||'[]');
    const allSeenReacts = seenReacts.concat(serverReacts.filter(function(id){ return !seenReacts.includes(id); }));
    if(allSeenReacts.length !== seenReacts.length) localStorage.setItem('seen_reacts_'+me, JSON.stringify(allSeenReacts));
    const newReactNotifs=(reactNotifs||[]).filter(function(r){return !allSeenReacts.includes(r.id) && freshEnough(r.created_at||r.reacted_at);});
    const totalUnread = unread.filter(r=>freshEnough(r.submitted_at)).length + newRepliesList.length + newReactNotifs.length;
    if(badge){badge.style.display="none";}
    if(bnBadge){bnBadge.style.display="none";}
    updateBellBadge(totalUnread);
    if(!el)return;
    if(!rows.length&&!newReactNotifs.length&&!newRepliesList.length){
      el.innerHTML='<div style="text-align:center;padding:40px 20px;"><svg width="36" height="36" viewBox="0 0 20 20" fill="#e2e8f0" style="margin:0 auto 10px;display:block;"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/></svg><div style="font-size:13px;font-weight:600;color:var(--ui-ink-2b,#475569);margin-bottom:6px;">No alerts yet</div><div style="font-size:12px;color:var(--ui-ink-4,#94a3b8);">Leave approvals and declines will appear here.</div></div>';
      return;
    }
    let replyHtml='';
    const sysSeenKey = 'sys_notif_seen_'+me;
    const sysSeen = JSON.parse(localStorage.getItem(sysSeenKey)||'[]');
    let sysSeenChanged = false;
    newRepliesList.forEach(function(r){
      const isMention = (r.body && r.body.indexOf('mentioned you')>=0) || (r.reply_body && r.reply_body.indexOf('mention')===0);
      if(isMention && !sysSeen.includes(r.id) && typeof showSystemNotification==='function'){
        const fromName = r.replier || 'Someone';
        const bodyText = (r.body || r.reply_body || '').replace(/^mentioned you: ?/i,'').replace(/^mention in (announcement|discussion): ?/i,'');
        showSystemNotification(fromName+' mentioned you', bodyText.slice(0,140), 'mention-'+r.id, 'mentions');
        sysSeen.push(r.id);
        sysSeenChanged = true;
      }
    });
    if(sysSeenChanged) localStorage.setItem(sysSeenKey, JSON.stringify(sysSeen.slice(-100)));
    newRepliesList.forEach(function(r){
      const body = (r.body || r.reply_body || '');
      const isMention = (r.body && r.body.indexOf('mentioned you')>=0) || (r.reply_body && r.reply_body.indexOf('mention')===0);
      const isTaskDone = body.indexOf('task completed:')===0 || (r.reply_id && String(r.reply_id).indexOf('taskdone_')===0);
      if(isTaskDone){
        const who = r.replier || r.replied_by || 'Someone';
        const taskTitle = body.replace(/^task completed: ?/i,'') || (r.annoucement_title||'a task');
        replyHtml+='<div style="background:var(--accent-dim);border:1px solid var(--accent-bd);border-radius:12px;padding:14px;margin-bottom:10px;cursor:pointer;" data-rid="'+r.id+'" onclick="markReplySeen(this.dataset.rid);goTo(\'tasks\');">'+
          '<div style="width:7px;height:7px;border-radius:50%;background:var(--accent);margin-bottom:8px;"></div>'+
          '<div style="font-size:13px;font-weight:700;color:var(--accent-text);margin-bottom:4px;">\u2713 Task completed</div>'+
          '<div style="font-size:12.5px;color:var(--ui-ink-2b,#475569);">'+who+' completed a task you shared</div>'+
          '<div style="font-size:11px;color:var(--ui-ink-4,#94a3b8);margin-top:4px;font-style:italic;">'+taskTitle.slice(0,80)+(taskTitle.length>=80?'...':'')+'</div>'+
          '</div>';
        return;
      }
      const heading = isMention ? 'Mentioned you' : 'New reply';
      const bodyText = body.replace(/^mentioned you: ?/i,'').replace(/^mention in (announcement|discussion): ?/i,'');
      const subText = isMention
        ? r.replier + ' mentioned you'
        : r.replier + ' replied to your discussion';
    });
    if(newRepliesList.length){
      const allReplyIds=replyNotifsList.map(r=>r.id);
      localStorage.setItem('seen_replies_'+me,JSON.stringify(allReplyIds));
    }

    let reactHtml='';
    newReactNotifs.forEach(function(r){
      reactHtml+='<div style="background:#fdf4ff;border:1px solid #e9d5ff;border-radius:12px;padding:14px;margin-bottom:10px;cursor:pointer;" data-rid="'+r.id+'" data-target-id="'+(r.target_id||'')+'" data-target-type="'+(r.target_type||'')+'" onclick="markReactSeen(this.dataset.rid);">'+
        '<div style="font-size:13px;font-weight:700;color:#7c3aed;margin-bottom:4px;">'+r.emoji+' Reaction on your post</div>'+
        '<div style="font-size:12.5px;color:var(--ui-ink-2b,#475569);">'+esc(r.staff_name)+' reacted to your '+(r.target_type==='disc'?'discussion':'announcement')+'</div>'+
        '<div style="font-size:11px;color:var(--ui-ink-4,#94a3b8);margin-top:4px;">'+fmtF(r.created_at)+'</div>'+
        '</div>';
    });
    if(newReactNotifs.length){
      const allReactIds=(reactNotifs||[]).map(function(r){return r.id;});
      localStorage.setItem('seen_reacts_'+me,JSON.stringify(allReactIds));
      newReactNotifs.forEach(function(r){
        if(typeof markNotifReadEverywhere === 'function') markNotifReadEverywhere('react_'+r.id);
      });
    }
    const unreadLeave = rows.filter(r => !read.includes(r.id));
    if(!unreadLeave.length && !newReactNotifs.length && !newRepliesList.length){
      el.innerHTML='<div style="text-align:center;padding:40px 20px;"><svg width="36" height="36" viewBox="0 0 20 20" fill="#e2e8f0" style="margin:0 auto 10px;display:block;"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/></svg><div style="font-size:13px;font-weight:600;color:var(--ui-ink-2b,#475569);margin-bottom:6px;">All caught up</div><div style="font-size:12px;color:var(--ui-ink-4,#94a3b8);">No new notifications.</div></div>';
      return;
    }
    el.innerHTML=replyHtml+reactHtml+unreadLeave.map(r=>{
      const isApproved=r.status==="approved";
      const bg=isApproved?"var(--accent-dim)":"#fef2f2";
      const border=isApproved?"var(--accent-bd)":"#fecaca";
      const titleColor=isApproved?"var(--accent-text)":"#dc2626";
      const title=isApproved?"Leave Approved":"Leave Declined";
      return '<div class="notif-item" style="background:'+bg+';border:1px solid '+border+';border-radius:12px;padding:14px;margin-bottom:10px;cursor:pointer;" onclick="goTo(\'schedule\');setTimeout(function(){showSchedTab(\'leave\');},120);">'+
        '<div style="width:7px;height:7px;border-radius:50%;background:'+(isApproved?"var(--accent)":"#dc2626")+';margin-bottom:8px;"></div>'+
        '<div style="font-size:13px;font-weight:700;color:'+titleColor+';margin-bottom:4px;">'+title+'</div>'+
        '<div style="font-size:12.5px;color:var(--ui-ink-2b,#475569);">'+fmtF(r.from_date)+' \u2013 '+fmtF(r.to_date)+(r.reason?' \u00b7 '+r.reason:'')+'</div>'+
        (r.status==="declined"&&r.decline_reason?'<div style="font-size:12px;color:#dc2626;margin-top:6px;"><strong>Reason:</strong> '+esc(r.decline_reason)+'</div>':'')+
        '<div style="font-size:11px;color:var(--ui-ink-4,#94a3b8);margin-top:6px;">'+fmtF(r.submitted_at)+'</div>'+
        '</div>';
    }).join("");

    if(unreadLeave.length){
      const allLeaveIds = rows.map(r=>r.id);
      localStorage.setItem('oR_'+me, JSON.stringify(allLeaveIds));
      unreadLeave.forEach(function(r){
        if(typeof markNotifReadEverywhere === 'function') markNotifReadEverywhere('leave_'+r.id);
      });
    }
    if(newRepliesList.length){
      const allReplyIds = replyNotifsList.map(r=>r.id);
      localStorage.setItem('seen_replies_'+me, JSON.stringify(allReplyIds));
      newRepliesList.forEach(function(r){
        if(typeof markNotifReadEverywhere === 'function') markNotifReadEverywhere('reply_'+r.id);
      });
    }
    if(newReactNotifs.length){
      const allReactIds = (reactNotifs||[]).map(r=>r.id);
      localStorage.setItem('seen_reacts_'+me, JSON.stringify(allReactIds));
    }
    setTimeout(function(){ updateBellBadge(0); }, 50);
  }catch(e){console.warn(e);if(el)el.innerHTML='<div style="color:#dc2626;text-align:center;padding:16px;font-size:13px;">Could not load alerts.</div>';}
}

async function markAllNotificationsRead(silent){
  try{
    const postSeen = async (key)=>{
      try{ await fetch(SB+'/rest/v1/notification_seen?on_conflict=staff_name,notif_key',{
        method:'POST',
        headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'},
        body:JSON.stringify({staff_name:me, notif_key:key})
      }); }catch(e){}
    };
    try{
      const rows = await sbGet("leave_submissions","?staff_name=eq."+encodeURIComponent(me)+"&status=in.(approved,declined)&limit=200");
      const ids = (rows||[]).map(r=>r.id);
      const cur = JSON.parse(localStorage.getItem("oR_"+me)||"[]");
      for(const id of ids){ if(!cur.includes(id)) cur.push(id); await postSeen('leave_'+id); }
      localStorage.setItem("oR_"+me, JSON.stringify(cur));
    }catch(e){}
    try{
      const rows = [];
      const ids = (rows||[]).map(r=>r.id);
      const cur = JSON.parse(localStorage.getItem('seen_replies_'+me)||'[]');
      for(const id of ids){ if(!cur.includes(id)) cur.push(id); await postSeen('reply_'+id); }
      localStorage.setItem('seen_replies_'+me, JSON.stringify(cur));
    }catch(e){}
    try{
      const reacts = (typeof loadReactNotifs==='function') ? await loadReactNotifs() : [];
      const ids = (reacts||[]).map(r=>r.id);
      const cur = JSON.parse(localStorage.getItem('seen_reacts_'+me)||'[]');
      for(const id of ids){ if(!cur.includes(id)) cur.push(id); await postSeen('react_'+id); }
      localStorage.setItem('seen_reacts_'+me, JSON.stringify(cur));
    }catch(e){}
    if(typeof _reactNotifsCache !== 'undefined'){ try{ _reactNotifsCache=null; }catch(e){} }
    updateBellBadge(0);
    if(typeof NotifManager!=='undefined' && NotifManager.markAllRead) NotifManager.markAllRead();
    if(typeof loadNotifications === 'function') loadNotifications();
    if(typeof loadNotifDrop === 'function'){ loadNotifDrop('notifDropList'); loadNotifDrop('mhNotifDrop'); }
    closeAllNotifDrops();
    if(!silent) showToast('All notifications marked as read');
  }catch(e){console.warn('markAllNotificationsRead',e);}
}


let myCanEditAvail=true;
let myIsAdmin=false;
let myIsShiftAdmin=false;
let myHasShiftops=false;
let adminHasSetAvail=false;

async function loadMySettings(){
  try{
    const rows=await sbGet("staff_settings","?name=eq."+encodeURIComponent(me));
    try{ const _ap=await sbGet('app_access','?app=eq.shiftops&staff_name=eq.'+encodeURIComponent(me)+'&select=app&limit=1'); myHasShiftops=!!(_ap&&_ap.length); }catch(e){ myHasShiftops=false; }
    if(rows&&rows.length){
      myIsAdmin=rows[0].is_hub_admin===true;
      myIsShiftAdmin=rows[0].is_shift_admin===true;
      myCanEditAvail=myIsAdmin?true:(rows[0].can_edit_avail!==false);
      adminHasSetAvail=true;
      if(typeof maybeShowGeofenceAdjuster === 'function') maybeShowGeofenceAdjuster();
      if(typeof nxEarlyAdminInit === 'function') nxEarlyAdminInit();
      try{
        document.querySelectorAll('[data-admin-only]').forEach(function(el){ el.style.display = myIsAdmin ? '' : 'none'; });
      }catch(e){}
      try{
        var rp=document.getElementById('page-myreports');
        if(rp && rp.classList.contains('active') && typeof initReportsPage==='function'){ initReportsPage(); }
      }catch(e){}
    }else{
      myIsAdmin=false;
      myCanEditAvail=true;
    }
    try{ const _trs=document.getElementById('rsec-teamreport'); if(_trs && _trs.style.display!=='none' && typeof initTeamReport==='function') initTeamReport(); }catch(e){}
  }catch(e){
    myIsAdmin=false;
    myCanEditAvail=true;
  }

  const locked=adminHasSetAvail&&!myCanEditAvail;
  if(locked){
    document.getElementById("availLock").style.display="block";
    document.getElementById("availLock").textContent="Your availability has been locked by your manager.";
    document.getElementById("availBtnArea").style.display="none";
  }else{
    document.getElementById("availLock").style.display="none";
    document.getElementById("availBtnArea").style.display="block";
  }

  const navAdmin=document.getElementById("nav-admin");
  if(navAdmin)navAdmin.style.display=myIsAdmin?"flex":"none";
  const bnAdmin=document.getElementById("bn-admin");
  if(bnAdmin){
    bnAdmin.style.display=myIsAdmin?"flex":"none";
  }

  const adminTab=document.getElementById("ptab-adminpanel");
  if(adminTab)adminTab.style.display=myIsAdmin?"block":"none";

  const hbc=document.getElementById("homeBdayCard");if(hbc)hbc.style.display="block";
  setTimeout(()=>loadBirthdays(),100);
}








document.fonts.ready.then(function(){
  document.body.classList.add('ready');
  var splash = document.getElementById('splash');
  if(splash){
    splash.classList.add('fade');
    setTimeout(async function(){
      splash.style.display='none';
      if(await checkResetLink()){ /* landed on set-new-password from an email link */ }
      else if(await restoreAuthSession() || (!AUTH_ONLY_MODE && loadMe())){
        enterHub();
      }else{
        try{ sessionStorage.removeItem('ou'); }catch(e){}
        document.getElementById('authLayer').style.display='flex';
        showAuth('login');
      }
    }, 280);
  } else {
    (async function(){
      if(await checkResetLink()){ return; }
      if(await restoreAuthSession() || (!AUTH_ONLY_MODE && loadMe())){enterHub();}
      else{try{ sessionStorage.removeItem('ou'); }catch(e){} document.getElementById('authLayer').style.display='flex'; showAuth('login');}
    })();
  }
});




(function(){
  if(window.innerWidth <= 700 && localStorage.getItem('sb_mobile_hidden') === '1'){
    const sb = document.querySelector('.sidebar');
    if(sb) sb.classList.add('sb-hidden');
  }
})();


let _bannerTimer = null;

const _bannerFiredThisSession = new Set();
function showBanner(text, sub, type){
  return;
  const sig = String(text)+':'+String(sub);
  if(_bannerFiredThisSession.has(sig)) return;
  _bannerFiredThisSession.add(sig);

  const el=document.getElementById('notifBanner');
  const inner=document.getElementById('notifBannerInner');
  const textEl=document.getElementById('notifBannerText');
  const subEl=document.getElementById('notifBannerSub');
  if(!el)return;
  textEl.textContent=text;
  subEl.textContent=sub||'';
  inner.className='notif-banner-inner'+(type?' '+type:'');
  el.classList.add('show');
  clearTimeout(_bannerTimer);
  _bannerTimer=setTimeout(hideBanner, 5000);
}

function hideBanner(){
  const el=document.getElementById('notifBanner');
  if(el)el.classList.remove('show');
}

async function checkNewDiscussions(){ /* discussions retired */ }

