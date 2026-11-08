/* ════════════════════════════════════════════════════════════════════════
   NEXUS · NEXI, the helper for everyone (phones)
   · a round button in the top bar (where the pet used to be) opens a bottom sheet "Hi {name}, I'm Nexi"
   · Nexi ONLY answers a fixed menu of questions (no free chat, no AI service, no key, no cost). Two of them
     (hours between two dates, search documents) show a tiny form first.
   · every answer is worked out by code from Nexus data the signed-in person can already see
     (clock log, roster, leave, team, documents, quizzes); nothing is stored and nothing is sent anywhere
   · add a question: push one entry into ASK below: {id, g:'group', label, run(vals) -> {text, lines?, go?}}
     optional form:{intro, fields:[{id,label,type,value,placeholder}], submit, summary(vals)}
   REVERT: remove the <script> for this file.
   ════════════════════════════════════════════════════════════════════════ */
var nxAgent = (function(){
  'use strict';
  var ov=null, sheet=null, thread=null, chipsEl=null, fab=null, lastFocus=null, busy=false;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var SPARK='<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 2.500l2.200 6.300 6.300 2.200-6.300 2.200L12 19.500l-2.200-6.300L3.500 11l6.300-2.200z"/><path d="M19 15.500l.9 2.600 2.600.9-2.600.9L19 22.500l-.9-2.600-2.600-.9 2.600-.9z" opacity=".85"/></svg>';

  function who(){ try{ return typeof me!=='undefined' && me ? me : ''; }catch(e){ return ''; } }
  function first(){ var n=(who().split(/\s+/)[0]||'').trim(); return n||'there'; }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function pad(n){ return String(n).padStart(2,'0'); }
  function isoOf(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
  function dayOf(iso){ return new Date(iso+'T00:00:00'); }
  function fmtDay(iso){
    var d=dayOf(iso), t=new Date(); t.setHours(0,0,0,0);
    var diff=Math.round((d-t)/864e5);
    if(diff===0) return 'Today'; if(diff===1) return 'Tomorrow';
    return d.toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'});
  }
  function fmtShortDate(iso){ return dayOf(String(iso).slice(0,10)).toLocaleDateString('en-AU',{day:'numeric',month:'short'}); }
  function fmtT(t){
    if(!t) return ''; var p=String(t).split(':'), h=+p[0], m=+p[1]||0, ap=h>=12?'pm':'am';
    h=h%12; if(h===0) h=12; return h+(m?':'+pad(m):'')+ap;
  }
  function fmtClock(d){ return fmtT(pad(d.getHours())+':'+pad(d.getMinutes())); }
  function hrs(ms){ return (typeof fmtHours==='function') ? fmtHours(ms) : Math.round(ms/36e5*10)/10+'h'; }
  function plural(n,w){ return n+' '+w+(n===1?'':'s'); }
  function sorry(){ return {text:'I couldn’t reach the server just now. Give it a moment and tap again.'}; }
  function listMore(arr,max){ var l=arr.slice(0,max); if(arr.length>max) l.push('and '+(arr.length-max)+' more'); return l; }
  function amAdmin(){ try{ return typeof myIsAdmin!=='undefined' && myIsAdmin===true; }catch(e){ return false; } }

  async function ensureLogs(){
    if(typeof _hoursLogs!=='undefined' && _hoursLogs.length) return;
    if(typeof loadAllClockLogs==='function') await loadAllClockLogs();
  }
  function goMyHours(period){ return {label:'Open My Hours', run:function(){ if(period && typeof setHoursPeriod==='function') try{ setHoursPeriod(period); }catch(e){} goTo('myhours'); }}; }
  function hoursAnswer(period, noun){
    return async function(){
      await ensureLogs();
      var r=getPeriodRange(period), c=calcHoursForRange(r.start,r.end), total=c.totalMs+c.liveMs;
      var lines=[];
      if(period==='fortnight') lines.push(r.label.replace('Fortnight: ',''));
      if(c.liveMs>0) lines.push('Includes your shift right now: '+hrs(c.liveMs)+' so far.');
      if(c.sessions) lines.push(plural(c.sessions + (c.liveMs>0?1:0),'shift')+' logged.');
      var text= total>0 ? 'You’ve worked '+hrs(total)+' '+noun+'.' : 'No hours logged '+noun+' yet.';
      return {text:text, lines:lines, go:[goMyHours(period)]};
    };
  }
  async function myTeamName(){
    var t=''; try{ t=(typeof myTeam!=='undefined' && myTeam) ? myTeam : ''; }catch(e){}
    if(t) return t;
    var c=await sbGet('staff_credentials','?staff_name=eq.'+encodeURIComponent(who())+'&select=team');
    return (c&&c[0]&&c[0].team)||'';
  }
  /* documents this person is allowed to see (same rule as the Documents page) */
  async function visibleDocs(){
    var team=await myTeamName();
    var docs=await sbGet('documents','?order=created_at.desc');
    return (docs||[]).filter(function(d){
      if(amAdmin()) return true;
      if(!d.teams || !d.teams.length) return true;
      return !!team && Array.isArray(d.teams) && d.teams.indexOf(team)>-1;
    });
  }
  async function quizState(){
    var res=await Promise.all([
      sbGet('custom_quizzes','?order=created_at.desc'),
      sbGet('custom_quiz_results','?staff_name=eq.'+encodeURIComponent(who())+'&order=created_at.desc'),
      amAdmin() ? Promise.resolve(null) : sbGet('quiz_access','?staff_name=eq.'+encodeURIComponent(who()))
    ]);
    var access = res[2] ? new Set(res[2].map(function(a){ return a.quiz_id; })) : null;
    var quizzes=(res[0]||[]).filter(function(q){
      if(q.status==='draft') return false;
      return !access || access.has(q.id);
    });
    return {quizzes:quizzes, results:res[1]||[]};
  }

  var ASK=[
    {id:'clock', g:'Time', label:'Am I clocked in?', run:function(){
      var st=(typeof _clockState!=='undefined')?_clockState:null;
      if(st==='in'){
        var since=null; try{ since=new Date(_clockSinceTs); }catch(e){}
        var ok=since && !isNaN(since);
        return {text:'Yes, you’re clocked in'+(ok?' since '+fmtClock(since)+'.':'.'),
                lines: ok?['That’s '+hrs(Date.now()-since.getTime())+' so far.']:[],
                go:[{label:'Open the clock', run:function(){ goTo('home'); }}]};
      }
      return {text:'No, you’re clocked out right now.', go:[{label:'Open the clock', run:function(){ goTo('home'); }}]};
    }},
    {id:'week', g:'Time', label:'Hours this week', run:hoursAnswer('week','this week')},
    {id:'fort', g:'Time', label:'Hours this fortnight', run:hoursAnswer('fortnight','this fortnight')},
    {id:'range', g:'Time', label:'Hours between two dates',
      form:{ intro:'Pick the dates. I’ll add up your hours.', submit:'Work it out',
        fields:function(){ var f=getPeriodRange('fortnight').start; return [{id:'from',label:'From',type:'date',value:isoOf(f)},{id:'to',label:'To',type:'date',value:isoOf(new Date())}]; },
        summary:function(v){ return fmtShortDate(v.from)+' to '+fmtShortDate(v.to); } },
      run:async function(v){
        if(!v.from||!v.to) return {text:'Pick both dates and try again.'};
        if(v.to<v.from) return {text:'The end date is before the start date. Try again with them the other way round.'};
        await ensureLogs();
        var s=dayOf(v.from), e=dayOf(v.to); e.setDate(e.getDate()+1);
        var c=calcHoursForRange(s,e), total=c.totalMs+c.liveMs, days=Object.keys(c.dayMap).length+(c.liveMs>0 && !c.dayMap[isoOf(new Date())]?1:0);
        var span=fmtShortDate(v.from)+(v.from!==v.to?' to '+fmtShortDate(v.to):'');
        var lines=[];
        if(total>0){ lines.push(plural(days,'day')+' worked.'); if(c.liveMs>0) lines.push('Includes your shift right now: '+hrs(c.liveMs)+' so far.'); }
        if(_hoursLogs.length>=2000 && _hoursLogs[0] && new Date(_hoursLogs[0].ts)>s) lines.push('Your oldest punches may not be loaded, so older dates can read low.');
        return {text: total>0 ? 'From '+span+' you worked '+hrs(total)+'.' : 'No hours logged from '+span+'.', lines:lines, go:[goMyHours(null)]};
      }},
    {id:'next', g:'Shifts & leave', label:'My next shift', run:async function(){
      try{
        var now=new Date(), iso=isoOf(now);
        var rows=await sbGet('roster_shifts','?staff_name=eq.'+encodeURIComponent(who())+'&shift_date=gte.'+iso+'&select=id,shift_date,start_time,end_time,role,status&order=shift_date.asc,start_time.asc');
        var pub=await _publishedWeeks();
        var vis=_filterPublished(rows||[],pub).filter(function(r){
          if(r.shift_date!==iso || !r.end_time) return true;       /* today's shifts that have already finished are skipped */
          var p=String(r.end_time).split(':'), e=new Date(); e.setHours(+p[0],+p[1]||0,0,0);
          return e>now;
        });
        if(!vis.length){
          return (rows||[]).length ? {text:'Your roster for the coming weeks hasn’t been published yet.'}
                                   : {text:'You don’t have any upcoming shifts on the roster.', go:[{label:'See open shifts', run:function(){ goTo('shifts'); }}]};
        }
        var n=vis[0], lines=[];
        lines.push(fmtT(n.start_time)+(n.end_time?' – '+fmtT(n.end_time):'')+(n.role?' · '+n.role:''));
        if(vis[1]) lines.push('After that: '+fmtDay(vis[1].shift_date)+', '+fmtT(vis[1].start_time)+(vis[1].end_time?' – '+fmtT(vis[1].end_time):''));
        var dl=fmtDay(n.shift_date); dl=(dl==='Today'||dl==='Tomorrow')?dl.toLowerCase():'on '+dl;
        return {text:'Your next shift is '+dl+'.', lines:lines, go:[{label:'See my roster', run:function(){ goTo('shifts'); }}]};
      }catch(e){ return sorry(); }
    }},
    {id:'open', g:'Shifts & leave', label:'Any open shifts?', run:async function(){
      try{
        var team=await myTeamName();
        if(!team) return {text:'You’re not on a team yet, so there’s nothing to pick up.'};
        var iso=isoOf(new Date());
        var rows=await sbGet('roster_shifts','?status=eq.open&or=(open_to_team.is.null,open_to_team.eq.'+encodeURIComponent(team)+')&shift_date=gte.'+iso+'&select=id,shift_date,start_time,end_time,role,staff_name&order=shift_date.asc,start_time.asc');
        var pub=await _publishedWeeks();
        var vis=_filterPublished((rows||[]).filter(function(r){ return r.staff_name!==who(); }),pub);
        if(!vis.length) return {text:'No open shifts right now. Check again later.'};
        var lines=listMore(vis.map(function(r){ return fmtDay(r.shift_date)+', '+fmtT(r.start_time)+(r.end_time?' – '+fmtT(r.end_time):'')+(r.role?' · '+r.role:''); }),3);
        return {text: vis.length===1 ? 'There’s 1 open shift you can pick up.' : 'There are '+vis.length+' open shifts you can pick up.', lines:lines, go:[{label:'Pick one up', run:function(){ goTo('shifts'); }}]};
      }catch(e){ return sorry(); }
    }},
    {id:'leave', g:'Shifts & leave', label:'My leave requests', run:async function(){
      try{
        var rows=await sbGet('leave_submissions','?staff_name=eq.'+encodeURIComponent(who())+'&order=submitted_at.desc&limit=5');
        if(!rows||!rows.length) return {text:'You haven’t sent any leave requests.', go:[{label:'Request leave', run:function(){ goTo('leave'); }}]};
        var pend=rows.filter(function(r){ return r.status==='pending'; }).length;
        var lines=rows.slice(0,3).map(function(r){
          var st=String(r.status||'pending'); st=st.charAt(0).toUpperCase()+st.slice(1);
          return fmtShortDate(r.from_date)+(r.to_date&&r.to_date!==r.from_date?' – '+fmtShortDate(r.to_date):'')+' · '+st;
        });
        return {text: pend ? plural(pend,'request')+' still waiting for a decision.' : 'Nothing is waiting on a decision.', lines:lines, go:[{label:'Open Leave', run:function(){ goTo('leave'); }}]};
      }catch(e){ return sorry(); }
    }},
    {id:'reqleave', g:'Shifts & leave', label:'How do I request leave?', run:function(){
      return {text:'Open Leave, pick your dates, choose a reason and send it. Your manager gets it straight away.',
              lines:['You’ll see the status there, and a notification when it’s decided.'],
              go:[{label:'Request leave', run:function(){ goTo('leave'); }}]};
    }},
    {id:'team', g:'People', label:'Who’s in my team?', run:async function(){
      try{
        var team=await myTeamName();
        if(!team) return {text:'You’re not on a team yet.'};
        var rows=await sbGet('staff_credentials','?team=eq.'+encodeURIComponent(team)+'&select=staff_name&order=staff_name.asc');
        var names=(rows||[]).map(function(r){ return r.staff_name; }).filter(Boolean);
        if(!names.length) return {text:'I couldn’t find anyone in '+team+' right now.'};
        var lines=listMore(names.map(function(n){ return n===who()?n+' (you)':n; }),12);
        return {text:team+' has '+(names.length===1?'1 person':names.length+' people')+'.', lines:lines, go:[{label:'Team Directory', run:function(){ if(typeof openStaffDirectory==='function') openStaffDirectory(); else goTo('profile'); }}]};
      }catch(e){ return sorry(); }
    }},
    {id:'admins', g:'People', label:'Who are the admins?', run:async function(){
      try{
        var rows=await sbGet('staff_settings','?select=name,is_hub_admin&is_hub_admin=eq.true&order=name.asc');
        var names=(rows||[]).map(function(r){ return r.name; }).filter(Boolean);
        if(!names.length) return {text:'I couldn’t find the admin list right now.'};
        return {text: names.length===1 ? 'There’s 1 admin.' : 'There are '+names.length+' admins.', lines:listMore(names.map(function(n){ return n===who()?n+' (you)':n; }),12)};
      }catch(e){ return sorry(); }
    }},
    {id:'docs', g:'Library', label:'Latest documents', run:async function(){
      try{
        var docs=await visibleDocs();
        if(!docs.length) return {text:'No documents have been shared with you yet.'};
        var lines=docs.slice(0,5).map(function(d){
          var isNew=(Date.now()-new Date(d.created_at))<3*864e5;
          return d.title+' · '+fmtShortDate(d.created_at)+(isNew?' · New':'');
        });
        return {text: docs.length===1 ? 'There’s 1 document for you.' : 'The latest of '+docs.length+' documents for you:', lines:lines, go:[{label:'Open Documents', run:function(){ goTo('documents'); }}]};
      }catch(e){ return sorry(); }
    }},
    {id:'docfind', g:'Library', label:'Find a document',
      form:{ intro:'What are you looking for?', submit:'Search',
        fields:function(){ return [{id:'q',label:'Word in the title',type:'text',value:'',placeholder:'e.g. leave, policy, form'}]; },
        summary:function(v){ return '“'+v.q+'”'; } },
      run:async function(v){
        var q=String(v.q||'').trim().toLowerCase();
        if(!q) return {text:'Type a word to search for and try again.'};
        try{
          var words=q.split(/\s+/);
          var hits=(await visibleDocs()).filter(function(d){ var hay=((d.title||'')+' '+(d.category||'')).toLowerCase(); return words.every(function(w){ return hay.indexOf(w)>-1; }); });
          if(!hits.length) return {text:'I couldn’t find a document matching “'+v.q+'”.', go:[{label:'Browse Documents', run:function(){ goTo('documents'); }}]};
          return {text: hits.length===1 ? 'I found 1 document.' : 'I found '+hits.length+' documents.', lines:listMore(hits.map(function(d){ return d.title+(d.category?' · '+d.category:''); }),6), go:[{label:'Open Documents', run:function(){ goTo('documents'); }}]};
        }catch(e){ return sorry(); }
      }},
    {id:'quizzes', g:'Library', label:'Quizzes I still need to do', run:async function(){
      try{
        var s=await quizState();
        var passed=new Set(s.results.filter(function(r){ return r.passed; }).map(function(r){ return r.quiz_id; }));
        var tried=new Set(s.results.map(function(r){ return r.quiz_id; }));
        var todo=s.quizzes.filter(function(q){ return !passed.has(q.id); });
        if(!todo.length) return {text: s.quizzes.length ? 'You’re all caught up. Every quiz is passed.' : 'No quizzes have been given to you.', go:s.quizzes.length?[{label:'Open Learnings', run:function(){ goTo('training'); }}]:null};
        return {text: todo.length===1 ? '1 quiz to do.' : todo.length+' quizzes to do.', lines:listMore(todo.map(function(q){ return q.title+(tried.has(q.id)?' · retake':''); }),5), go:[{label:'Open Learnings', run:function(){ goTo('training'); }}]};
      }catch(e){ return sorry(); }
    }},
    {id:'quizres', g:'Library', label:'My quiz results', run:async function(){
      try{
        var s=await quizState(), titles={};
        s.quizzes.forEach(function(q){ titles[q.id]=q.title; });
        var seen={}, latest=[];
        s.results.forEach(function(r){ if(!seen[r.quiz_id]){ seen[r.quiz_id]=1; latest.push(r); } });   /* newest first */
        if(!latest.length) return {text:'You haven’t taken a quiz yet.', go:[{label:'Open Learnings', run:function(){ goTo('training'); }}]};
        var pass=latest.filter(function(r){ return r.passed; }).length;
        var lines=listMore(latest.map(function(r){ return (titles[r.quiz_id]||'Quiz')+' · '+(r.total?r.score+'/'+r.total+' · ':'')+(r.passed?'Passed':'Not passed'); }),5);
        return {text:'You’ve passed '+pass+' of '+latest.length+'.', lines:lines, go:[{label:'Open Learnings', run:function(){ goTo('training'); }}]};
      }catch(e){ return sorry(); }
    }},
    {id:'profile', g:'Help', label:'Change my photo or password', run:function(){
      return {text:'It’s all in your profile: photo, bio, password, text size and theme.', go:[{label:'Open Profile', run:function(){ goTo('profile'); }}]};
    }}
  ];

  function css(){
    if(document.getElementById('nxAgentCss')) return;
    var s=document.createElement('style'); s.id='nxAgentCss';
    s.textContent=
'.nxa-ov,.nxa-fab{display:none}'+
'@media (max-width:700px){'+
 ':root:not([data-theme="win95"]) .nxa-fab{display:grid;place-items:center;position:absolute;z-index:3;top:calc(env(safe-area-inset-top,0px) + 8px);left:calc(50% - 18px);width:36px;height:36px;padding:0;border:0;border-radius:50%;'+
   'background:#0a0a0c;color:var(--accent,#10b981);cursor:pointer;box-shadow:0 0 0 1px rgba(255,255,255,.07),0 6px 16px -8px rgba(0,0,0,.55);-webkit-tap-highlight-color:transparent;'+
   'transition:left 240ms cubic-bezier(.2,.8,.2,1),transform 120ms ease-out}'+
 ':root:not([data-theme="win95"]) .nxa-fab:active{transform:scale(.94)}.nxa-fab:focus-visible{outline:2px solid var(--accent,#10b981);outline-offset:2px}'+
 ':root:not([data-theme="win95"]) .nxa-fab.is-bubble{left:calc(100% - 106px)}'+
 ':root:not([data-theme="win95"]) .nxa-ov{display:block;position:fixed;inset:0;z-index:2500;visibility:hidden;pointer-events:none;background:rgba(0,0,0,0);transition:background 220ms ease-out,visibility 0s linear 260ms}'+
 ':root:not([data-theme="win95"]) .nxa-ov.is-open{visibility:visible;pointer-events:auto;background:rgba(0,0,0,.42);transition:background 220ms ease-out}'+
 '.nxa-sheet{position:absolute;left:0;right:0;bottom:0;max-height:86vh;max-height:86dvh;display:flex;flex-direction:column;background:var(--m-card,#fff);color:var(--m-ink,#0f172a);'+
   'border-radius:22px 22px 0 0;box-shadow:0 -12px 40px -12px rgba(0,0,0,.35);padding-bottom:env(safe-area-inset-bottom,0px);transform:translateY(105%);'+
   'transition:transform 360ms cubic-bezier(.2,.9,.25,1);will-change:transform;font-family:var(--font,system-ui,sans-serif)}'+
 '.nxa-ov.is-open .nxa-sheet{transform:translateY(0)}'+
 '.nxa-sheet.is-drag{transition:none}'+
 '.nxa-top{touch-action:none;cursor:grab;padding:8px 18px 6px;flex:0 0 auto}'+
 '.nxa-grab{width:38px;height:5px;border-radius:3px;background:var(--m-border-hi,rgba(120,120,128,.35));margin:0 auto 10px}'+
 '.nxa-hd{display:flex;align-items:center;gap:10px}'+
 '.nxa-av{width:40px;height:40px;border-radius:50%;background:#0a0a0c;color:var(--accent,#10b981);display:grid;place-items:center;flex:0 0 auto}'+
 '.nxa-ttl{flex:1;min-width:0}.nxa-ttl b{display:block;font:700 17px/1.2 var(--font,system-ui);letter-spacing:-.01em}'+
 '.nxa-ttl span{display:block;font:500 12.5px/1.3 var(--font,system-ui);color:var(--m-ink-3,#64748b)}'+
 '.nxa-x{all:unset;box-sizing:border-box;width:44px;height:44px;margin:-6px -8px -6px 0;display:grid;place-items:center;color:var(--m-ink-3,#64748b);cursor:pointer;-webkit-tap-highlight-color:transparent}'+
 '.nxa-x:active{color:var(--m-ink,#0f172a)}.nxa-x:focus-visible,.nxa-chip:focus-visible,.nxa-go:focus-visible{outline:2px solid var(--accent,#10b981);outline-offset:2px}'+
 '.nxa-thread{flex:1 1 auto;min-height:96px;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:6px 18px 10px;display:flex;flex-direction:column;gap:10px}'+
 '.nxa-m{max-width:86%;font:500 15px/1.4 var(--font,system-ui);animation:nxaIn 220ms ease-out both}'+
 '.nxa-m.w{max-width:94%;min-width:70%}'+
 '.nxa-m.n{align-self:flex-start;background:var(--m-card-2,#f1f5f9);border-radius:18px 18px 18px 6px;padding:10px 14px}'+
 '.nxa-m.u{align-self:flex-end;background:var(--accent,#10b981);color:var(--on-accent,#fff);border-radius:18px 18px 6px 18px;padding:10px 14px;font-weight:600}'+
 '.nxa-m .t{display:block;font-weight:600}.nxa-m .l{display:block;margin-top:4px;font-weight:500;font-size:14px;color:var(--m-ink-2,#475569)}'+
 '.nxa-acts{display:flex;flex-wrap:wrap;gap:4px 16px;margin-top:8px}'+
 '.nxa-go{all:unset;box-sizing:border-box;min-height:32px;display:inline-flex;align-items:center;gap:4px;font:700 14px/1 var(--font,system-ui);color:var(--accent-text,var(--accent,#059669));cursor:pointer;-webkit-tap-highlight-color:transparent}'+
 '.nxa-go:active{opacity:.6}.nxa-go[disabled]{opacity:.4;pointer-events:none}'+
 '.nxa-form{display:flex;flex-direction:column;gap:10px;margin-top:10px}.nxa-form label{display:block;font:700 11.5px/1 var(--font,system-ui);letter-spacing:.05em;text-transform:uppercase;color:var(--m-ink-3,#64748b)}'+
 '.nxa-form input{box-sizing:border-box;width:100%;min-height:44px;margin-top:6px;padding:0 2px;border:0;border-bottom:1.5px solid var(--m-border-hi,rgba(120,120,128,.4));border-radius:0;background:transparent;color:var(--m-ink,#0f172a);font:600 16px/1 var(--font,system-ui);-webkit-appearance:none;appearance:none;outline:none}'+
 '.nxa-form input:focus{border-bottom-color:var(--accent,#10b981);box-shadow:0 1.5px 0 var(--accent,#10b981)}'+
 '.nxa-dots{display:inline-flex;gap:4px;align-items:center;height:20px}.nxa-dots i{width:7px;height:7px;border-radius:50%;background:var(--m-ink-3,#94a3b8);animation:nxaDot 1s ease-in-out infinite}'+
 '.nxa-dots i:nth-child(2){animation-delay:.15s}.nxa-dots i:nth-child(3){animation-delay:.3s}'+
 '.nxa-chips{flex:0 0 auto;padding:6px 18px 16px;display:flex;flex-wrap:wrap;gap:8px;max-height:36vh;overflow-y:auto;overscroll-behavior:contain}'+
 '.nxa-lbl{flex:0 0 100%;font:700 11.5px/1 var(--font,system-ui);letter-spacing:.06em;text-transform:uppercase;color:var(--m-ink-3,#64748b);margin:8px 0 0}.nxa-lbl:first-child{margin-top:2px}'+
 '.nxa-chip{all:unset;box-sizing:border-box;min-height:42px;padding:0 15px;display:inline-flex;align-items:center;border-radius:21px;background:var(--accent-dim,rgba(16,185,129,.12));color:var(--accent-text,var(--accent,#059669));font:650 14.5px/1 var(--font,system-ui);cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform 100ms ease-out,opacity 120ms}'+
 '.nxa-chip:active{transform:scale(.97)}.nxa-chip[disabled]{opacity:.45;pointer-events:none}'+
 '@keyframes nxaIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}'+
 '@keyframes nxaDot{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}'+
 '@media (prefers-reduced-motion:reduce){.nxa-sheet{transition:opacity 160ms ease-out;transform:none;opacity:0}.nxa-ov.is-open .nxa-sheet{opacity:1}.nxa-m{animation:none}.nxa-dots i{animation:none;opacity:.7}.nxa-chip:active,.nxa-fab:active{transform:none}.nxa-fab{transition:none}}'+
 '@media (prefers-reduced-transparency:reduce){.nxa-ov.is-open{background:rgba(0,0,0,.6)}}'+
'}';
    document.head.appendChild(s);
  }

  /* the launcher: a round button in the top bar; steps aside to the right once the page title slides into the bar */
  function buildFab(){
    var hdr=document.querySelector('.mobile-header'); if(!hdr||fab) return !!fab;
    css();
    fab=document.createElement('button'); fab.type='button'; fab.className='nxa-fab'; fab.setAttribute('aria-label','Ask Nexi'); fab.innerHTML=SPARK;
    fab.addEventListener('click',function(){ open(); });
    hdr.appendChild(fab);
    function sync(){ fab.classList.toggle('is-bubble', hdr.classList.contains('v3-title')); }
    new MutationObserver(sync).observe(hdr,{attributes:true,attributeFilter:['class']}); sync();
    return true;
  }

  function build(){
    if(ov) return;
    css();
    ov=document.createElement('div'); ov.className='nxa-ov';
    ov.innerHTML=
      '<div class="nxa-sheet" role="dialog" aria-modal="true" aria-labelledby="nxaTtl">'+
        '<div class="nxa-top"><div class="nxa-grab"></div><div class="nxa-hd">'+
          '<div class="nxa-av">'+SPARK+'</div>'+
          '<div class="nxa-ttl"><b id="nxaTtl"></b><span>Your Nexus helper</span></div>'+
          '<button type="button" class="nxa-x" aria-label="Close"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>'+
        '</div></div>'+
        '<div class="nxa-thread" aria-live="polite"></div>'+
        '<div class="nxa-chips"></div>'+
      '</div>';
    document.body.appendChild(ov);
    sheet=ov.querySelector('.nxa-sheet'); thread=ov.querySelector('.nxa-thread'); chipsEl=ov.querySelector('.nxa-chips');
    ov.addEventListener('click',function(e){ if(e.target===ov) close(); });
    ov.querySelector('.nxa-x').addEventListener('click',close);
    document.addEventListener('keydown',function(e){ if(e.key==='Escape' && ov.classList.contains('is-open')) close(); });
    dragInit(ov.querySelector('.nxa-top'));
  }

  /* drag the top of the sheet down to dismiss: 1:1 with the finger, release velocity decides */
  function dragInit(h){
    var y0=0, dy=0, last=0, lt=0, vel=0, on=false, id=null;
    h.addEventListener('pointerdown',function(e){
      if(e.target.closest('button')) return;
      on=true; id=e.pointerId; y0=e.clientY; dy=0; last=e.clientY; lt=performance.now(); vel=0;
      try{ h.setPointerCapture(id); }catch(_){}
      sheet.classList.add('is-drag');
    });
    h.addEventListener('pointermove',function(e){
      if(!on) return;
      var now=performance.now(); dy=Math.max(0,e.clientY-y0);
      var dt=now-lt; if(dt>0){ vel=(e.clientY-last)/dt*1000; last=e.clientY; lt=now; }
      sheet.style.transform='translateY('+dy+'px)';
    });
    function end(){
      if(!on) return; on=false; sheet.classList.remove('is-drag');
      var projected=dy+(vel/1000)*0.998/(1-0.998)*0.35;
      sheet.style.transform='';
      if(projected>sheet.offsetHeight*0.4 || vel>900) close();
    }
    h.addEventListener('pointerup',end); h.addEventListener('pointercancel',end);
  }

  function addMsg(cls, html){
    var d=document.createElement('div'); d.className='nxa-m '+cls; d.innerHTML=html; thread.appendChild(d);
    thread.scrollTo({top:thread.scrollHeight, behavior:reduce?'auto':'smooth'});
    return d;
  }
  function renderChips(){
    var h='', g=null;
    ASK.forEach(function(a){
      if(a.g!==g){ g=a.g; h+='<div class="nxa-lbl">'+esc(g)+'</div>'; }
      h+='<button type="button" class="nxa-chip" data-id="'+a.id+'">'+esc(a.label)+'</button>';
    });
    chipsEl.innerHTML=h;
    chipsEl.querySelectorAll('.nxa-chip').forEach(function(b){ b.addEventListener('click',function(){ ask(b.getAttribute('data-id')); }); });
  }
  function setChips(off){ chipsEl.querySelectorAll('.nxa-chip').forEach(function(b){ b.disabled=off; }); }
  function answerHtml(r){
    var h='<span class="t">'+esc(r.text)+'</span>';
    (r.lines||[]).forEach(function(l){ h+='<span class="l">'+esc(l)+'</span>'; });
    if(r.go && r.go.length){ h+='<div class="nxa-acts">'; r.go.forEach(function(g,i){ h+='<button type="button" class="nxa-go" data-i="'+i+'">'+esc(g.label)+' <span aria-hidden="true">→</span></button>'; }); h+='</div>'; }
    return h;
  }
  function showAnswer(bubble, r){
    bubble.innerHTML=answerHtml(r);
    bubble.querySelectorAll('.nxa-go').forEach(function(b){ b.addEventListener('click',function(){ var g=r.go[+b.getAttribute('data-i')]; close(); setTimeout(function(){ try{ g.run(); }catch(e){} },120); }); });
    thread.scrollTo({top:thread.scrollHeight, behavior:reduce?'auto':'smooth'});
  }
  /* run an answer behind a short typing beat so it reads as a reply, not a flash */
  async function reply(a, vals){
    var typing=addMsg('n','<span class="nxa-dots" aria-label="Nexi is thinking"><i></i><i></i><i></i></span>');
    var t0=Date.now(), r;
    try{ r=await a.run(vals||{}); }catch(e){ r=sorry(); }
    var wait=Math.max(0,420-(Date.now()-t0));
    await new Promise(function(res){ setTimeout(res,wait); });
    showAnswer(typing, r);
  }

  async function ask(id){
    if(busy) return;
    var a=ASK.filter(function(x){ return x.id===id; })[0]; if(!a) return;
    busy=true; setChips(true);
    addMsg('u',esc(a.label));
    try{
      if(a.form) await showForm(a); else await reply(a);
    } finally { busy=false; setChips(false); }
  }

  async function showForm(a){
    await new Promise(function(res){ setTimeout(res,300); });
    var fields=typeof a.form.fields==='function' ? a.form.fields() : a.form.fields;
    var h='<span class="t">'+esc(a.form.intro)+'</span><form class="nxa-form" novalidate>';
    fields.forEach(function(f){ h+='<div><label for="nxaf_'+f.id+'">'+esc(f.label)+'</label><input id="nxaf_'+f.id+'" name="'+f.id+'" type="'+f.type+'" value="'+esc(f.value||'')+'" placeholder="'+esc(f.placeholder||'')+'" autocomplete="off"'+(f.type==='text'?' enterkeyhint="search" autocapitalize="none"':'')+'></div>'; });
    h+='<div class="nxa-acts"><button type="submit" class="nxa-go">'+esc(a.form.submit)+' <span aria-hidden="true">→</span></button></div></form>';
    var bubble=addMsg('n w',h), form=bubble.querySelector('form');
    form.addEventListener('submit',async function(e){
      e.preventDefault(); if(busy) return;
      var vals={}; fields.forEach(function(f){ vals[f.id]=form.elements[f.id].value; });
      busy=true; setChips(true);
      form.querySelectorAll('input,button').forEach(function(x){ x.disabled=true; });
      addMsg('u',esc(a.form.summary(vals)));
      try{ await reply(a,vals); } finally { busy=false; setChips(false); }
    });
    var first=form.querySelector('input'); if(first && first.type==='text') try{ first.focus({preventScroll:true}); }catch(_){}
  }

  function open(){
    if(!who()) return false;
    build(); if(!ov) return false;
    lastFocus=document.activeElement; busy=false;
    ov.querySelector('.nxa-ttl b').textContent='Hi '+first()+', I’m Nexi';
    thread.innerHTML='';
    addMsg('n','<span class="t">What do you need?</span><span class="l">I can answer these. Tap one.</span>');
    renderChips();
    requestAnimationFrame(function(){ requestAnimationFrame(function(){
      ov.classList.add('is-open');
      var x=ov.querySelector('.nxa-x'); if(x) try{ x.focus({preventScroll:true}); }catch(e){}
    }); });
    return true;
  }
  function close(){
    if(!ov) return;
    ov.classList.remove('is-open');
    if(document.activeElement && document.activeElement.blur && ov.contains(document.activeElement)) document.activeElement.blur();
    if(lastFocus && lastFocus.focus) try{ lastFocus.focus({preventScroll:true}); }catch(e){}
  }

  function boot(){ buildFab(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  window.addEventListener('load',boot);
  return { open:open, close:close, ask:ask, ASK:ASK };
})();
