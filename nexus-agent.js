/* ════════════════════════════════════════════════════════════════════════
   NEXUS · NEXI, the helper for everyone (phones and computers); team leads and admins also get report tools
   · phones: a round button in the top bar opens a bottom sheet; computers: a round button bottom-right opens a panel. "Hi {name}, I'm Nexi"
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
  var NEXI_IMG='data:image/png;base64,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';
  var SPARK='<img class="nxa-cat" src="'+NEXI_IMG+'" alt="" draggable="false">';

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

  /* ── team leads and admins ─────────────────────────────────────────────── */
  function isLead(){ try{ return (typeof trIsLead==='function') ? !!trIsLead() : amAdmin(); }catch(e){ return false; } }
  /* who the person can report on: admins = everyone, leads = their own team */
  async function scope(){
    var admin=amAdmin(), team=await myTeamName();
    var cr=await sbGet('staff_credentials','?select=staff_name,team');
    var rows=(cr||[]).filter(function(r){ return r.staff_name && (admin || (team && r.team===team)); });
    return {admin:admin, team:team, label: admin?'All staff':team+' team', staff:rows.map(function(r){ return r.staff_name; }), teamOf:rows.reduce(function(o,r){ o[r.staff_name]=r.team||''; return o; },{})};
  }
  function sydneyWeek(){
    var has=(typeof _tzKey==='function' && typeof _tzIso==='function');
    var base=has ? _tzKey(Date.now()) : isoOf(new Date());
    var p=base.split('-'), dt=new Date(Date.UTC(+p[0],+p[1]-1,+p[2]));
    dt.setUTCDate(dt.getUTCDate()-((dt.getUTCDay()+6)%7));
    function key(d){ return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate()); }
    var mon=key(dt); dt.setUTCDate(dt.getUTCDate()+6); var sun=key(dt); dt.setUTCDate(dt.getUTCDate()+1); var next=key(dt); dt.setUTCDate(dt.getUTCDate()+7); var after=key(dt);
    var s=has ? Date.parse(_tzIso(mon,'00:00')) : dayOf(mon).getTime(), e=has ? Date.parse(_tzIso(next,'00:00')) : dayOf(next).getTime();
    return {mon:mon,sun:sun,next:next,after:after,s:s,e:e};
  }
  /* pair each person's In/Out punches inside [s,e): same rules as My Hours (a span must be under 24h) */
  function weekHours(logs, s, e, now){
    var out={}, by={};
    logs.forEach(function(r){ (by[r.staff_name]=by[r.staff_name]||[]).push(r); });
    Object.keys(by).forEach(function(nm){
      var L=by[nm].sort(function(a,b){ return new Date(a.ts)-new Date(b.ts); }), openIn=null, ms=0, sessions=0, days={}, auto=0;
      L.forEach(function(r){
        var t=new Date(r.ts).getTime();
        if(r.action==='in'){ openIn=t; }
        else if(r.action==='out' && openIn!=null){
          if(r.notes && String(r.notes).indexOf('auto:')===0 && t>=s && t<e) auto++;
          var a=Math.max(openIn,s), b=Math.min(t,e);
          if(t-openIn<864e5 && b>a){ ms+=b-a; sessions++; days[(typeof _tzKey==='function')?_tzKey(a):isoOf(new Date(a))]=1; }
          openIn=null;
        }
      });
      var live=0, clockedIn=false;
      if(openIn!=null && now-openIn<864e5){ clockedIn=true; if(now>=s && now<e){ live=now-Math.max(openIn,s); days[(typeof _tzKey==='function')?_tzKey(Math.max(openIn,s)):isoOf(new Date())]=1; } }
      out[nm]={ms:ms+live, live:live, sessions:sessions+(live>0?1:0), days:Object.keys(days).length, clockedIn:clockedIn, since:openIn, auto:auto};
    });
    return out;
  }
  function csvCell(v){ v=String(v==null?'':v); return /[",\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; }
  function downloadText(name, text, type){
    var blob=new Blob([text],{type:type||'text/csv;charset=utf-8'}), a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },1000);
  }
  function copyText(t){
    if(navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t);
    var ta=document.createElement('textarea'); ta.value=t; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); }catch(e){} ta.remove(); return Promise.resolve();
  }
  var NOT_LEAD={text:'That one is for team leads and admins.'};

  async function teamReport(v){
    if(!isLead()) return NOT_LEAD;
    if(typeof trGenerateReport!=='function' || !document.getElementById('trWeekPick')) return {text:'Team Report isn’t ready yet. Open the Team Report page once and try again.', go:[{label:'Open Team Report', run:function(){ goTo('teamreport'); }}]};
    try{
      var team = (typeof myIsAdmin!=='undefined' && myIsAdmin && v.team) ? v.team : (typeof myTeam!=='undefined' ? myTeam : '');
      if(!team) return {text:'I couldn’t tell which team to report on.'};
      if(typeof trTeamHasReport==='function' && !trTeamHasReport(team)) return {text:team+' doesn’t have a Team Report.'};
      if(typeof myIsAdmin!=='undefined' && myIsAdmin){ _trViewTeam=team; }
      var base=_trToday(); if(v.week==='last') base=_trAddDays(_trMonday(base),-7);
      var mon=_trMonday(base), sun=_trAddDays(mon,TR_WEEK_DAYS-1);
      var inp=document.getElementById('trWeekPick'); inp.value=mon;
      window._trReportData=null;
      await trGenerateReport();
      var D=window._trReportData;
      if(!D) return {text:'I couldn’t build the '+team+' report. Try again, or open Team Report and press Generate.', go:[{label:'Open Team Report', run:function(){ goTo('teamreport'); }}]};
      var lines=[], title=team+' Team Report · '+fmtShortDate(mon)+' to '+fmtShortDate(sun);
      if(D.placement){ lines.push('Placement weekly report is ready.'); }
      else {
        var did={}; (D.tasks||[]).forEach(function(t){ if((t.days||[]).some(function(x){ return x && String(x).trim(); })) did[t.name]=1; });
        (D.metrics||[]).forEach(function(m){ if((m.calls||0)>0 || (D.metricKeys||[]).some(function(k){ return (m[k]||0)>0; })) did[m.name]=1; });
        var all=(D.metrics||[]).map(function(m){ return m.name; });
        lines.push(all.length+' staff in the report, '+Object.keys(did).length+' with entries this week.');
        if(D.shape==='metrics' && D.metricKeys && D.metricKeys.length){
          var tot={calls:0}; D.metricKeys.forEach(function(k){ tot[k]=0; });
          (D.metrics||[]).forEach(function(m){ tot.calls+=m.calls||0; D.metricKeys.forEach(function(k){ tot[k]+=m[k]||0; }); });
          lines.push('Team total: '+tot.calls+' calls'+D.metricKeys.map(function(k,i){ return ', '+tot[k]+' '+String(D.metricLabels[i]||k).toLowerCase(); }).join('')+'.');
        }
        var none=all.filter(function(n){ return !did[n]; });
        if(none.length) lines.push('No entries yet: '+none.slice(0,6).join(', ')+(none.length>6?' and '+(none.length-6)+' more':'')+'.');
      }
      return {text:title, lines:lines, go:[
        {label:'Download PDF', keep:true, done:'Downloaded', run:function(){ trDownloadPdf(); }},
        {label:'Open Team Report', run:function(){ goTo('teamreport'); }}
      ]};
    }catch(e){ return sorry(); }
  }
  function dIso(iso,n){ var d=dayOf(iso); d.setDate(d.getDate()+n); return isoOf(d); }
  function todayIso(){ return (typeof _tzKey==='function') ? _tzKey(Date.now()) : isoOf(new Date()); }
  function timeRange(r){ return fmtT(r.start_time)+(r.end_time?' – '+fmtT(r.end_time):''); }
  async function publishedRows(q){ var rows=await sbGet('roster_shifts',q); var pub=await _publishedWeeks(); return _filterPublished(rows||[],pub); }
  function startedAlready(r){ if(!r.start_time) return true; var p=String(r.start_time).split(':'), t=new Date(); t.setHours(+p[0],+p[1]||0,0,0); return t<=new Date(); }
  async function weeklyReport(){
    if(!isLead()) return NOT_LEAD;
    try{
      var sc=await scope(); if(!sc.staff.length) return {text:'I couldn’t find anyone in your scope to report on.'};
      var wk=sydneyWeek(), now=Date.now(), inScope=new Set(sc.staff);
      var logs=await sbGet('clock_log','?ts=gte.'+new Date(wk.s-864e5).toISOString()+'&ts=lt.'+new Date(wk.e).toISOString()+'&order=ts.asc&limit=5000');
      logs=(logs||[]).filter(function(r){ return inScope.has(r.staff_name); });
      var H=weekHours(logs,wk.s,wk.e,now);
      var rows=sc.staff.map(function(n){ var h=H[n]||{ms:0,live:0,sessions:0,days:0,clockedIn:false,auto:0}; return {name:n,team:sc.teamOf[n]||'',ms:h.ms,days:h.days,sessions:h.sessions,clockedIn:h.clockedIn,auto:h.auto}; });
      var worked=rows.filter(function(r){ return r.ms>0; }).sort(function(a,b){ return b.ms-a.ms; });
      var idle=rows.filter(function(r){ return r.ms<=0; }).map(function(r){ return r.name; });
      var total=rows.reduce(function(t,r){ return t+r.ms; },0), autos=rows.reduce(function(t,r){ return t+r.auto; },0), inNow=rows.filter(function(r){ return r.clockedIn; }).length;
      var res=await Promise.all([
        sbGet('leave_submissions','?or=(submitted_at.gte.'+new Date(wk.s).toISOString()+',status.eq.pending)&select=staff_name,status,submitted_at&order=submitted_at.desc&limit=500'),
        sbGet('leave_submissions','?status=eq.approved&from_date=lte.'+wk.sun+'&to_date=gte.'+wk.mon+'&select=staff_name'),
        sbGet('roster_shifts','?status=eq.open&shift_date=gte.'+wk.mon+'&shift_date=lt.'+wk.after+'&select=shift_date,open_to_team'),
        _publishedWeeks()
      ]);
      var lv=(res[0]||[]).filter(function(r){ return inScope.has(r.staff_name); });
      var newLv=lv.filter(function(r){ return new Date(r.submitted_at).getTime()>=wk.s; }).length, pend=lv.filter(function(r){ return r.status==='pending'; }).length;
      var onLv=new Set((res[1]||[]).filter(function(r){ return inScope.has(r.staff_name); }).map(function(r){ return r.staff_name; })).size;
      var opn=_filterPublished((res[2]||[]).filter(function(r){ return sc.admin || !r.open_to_team || r.open_to_team===sc.team; }),res[3]);
      var openThis=opn.filter(function(r){ return r.shift_date<wk.next; }).length, openNext=opn.length-openThis;
      var title='Week of '+fmtShortDate(wk.mon)+' to '+fmtShortDate(wk.sun)+' · '+sc.label;
      var lines=[];
      lines.push(hrs(total)+' worked by '+worked.length+' of '+rows.length+' staff so far.');
      if(worked.length) lines.push('Average '+hrs(total/worked.length)+' each for those who worked.');
      if(worked.length) lines.push('Most hours: '+worked.slice(0,3).map(function(r){ return r.name+' '+hrs(r.ms); }).join(', ')+'.');
      if(idle.length) lines.push('No hours yet: '+idle.slice(0,6).join(', ')+(idle.length>6?' and '+(idle.length-6)+' more':'')+'.');
      lines.push('Clocked in right now: '+inNow+'.');
      if(autos) lines.push('Auto clock-outs this week: '+autos+'.');
      lines.push('Leave: '+plural(newLv,'new request')+', '+pend+' waiting for a decision, '+plural(onLv,'person').replace('persons','people')+' on approved leave this week.');
      lines.push('Open shifts: '+openThis+' this week, '+openNext+' next week.');
      var plain=title+'\n'+lines.join('\n');
      var csv='Name,Team,Hours,Days worked,Shifts,Clocked in now\n'+rows.sort(function(a,b){ return b.ms-a.ms || a.name.localeCompare(b.name); }).map(function(r){ return [r.name,r.team,(r.ms/36e5).toFixed(2),r.days,r.sessions,r.clockedIn?'Yes':'No'].map(csvCell).join(','); }).join('\n')+'\n';
      return {text:title, lines:lines, go:[
        {label:'Download CSV', keep:true, done:'Downloaded', run:function(){ downloadText('nexus-week-'+wk.mon+'.csv',csv); }},
        {label:'Copy summary', keep:true, done:'Copied', run:function(){ return copyText(plain); }}
      ]};
    }catch(e){ return sorry(); }
  }
  async function absentToday(){
    if(!isLead()) return NOT_LEAD;
    try{
      var sc=await scope(), inScope=new Set(sc.staff), iso=todayIso();
      var rows=(await publishedRows('?shift_date=eq.'+iso+'&status=eq.assigned&select=staff_name,start_time,end_time,role,shift_date')).filter(function(r){ return inScope.has(r.staff_name); });
      if(!rows.length) return {text:'Nobody in '+sc.label.toLowerCase()+' is rostered today.'};
      var logs=await sbGet('clock_log','?ts=gte.'+new Date(Date.now()-864e5).toISOString()+'&action=eq.in&select=staff_name,ts&limit=2000');
      var startTs=(typeof _tzIso==='function')?Date.parse(_tzIso(iso,'00:00')):dayOf(iso).getTime();
      var came=new Set((logs||[]).filter(function(r){ return new Date(r.ts).getTime()>=startTs-36e5; }).map(function(r){ return r.staff_name; }));
      var due=rows.filter(function(r){ return startedAlready(r); }), miss=due.filter(function(r){ return !came.has(r.staff_name); });
      var later=rows.filter(function(r){ return !startedAlready(r); });
      var lines=[]; if(later.length) lines.push(plural(later.length,'shift')+' still to start today.');
      if(!miss.length) return {text: due.length?'Everyone whose shift has started today has clocked in.':'No shift has started yet today.', lines:lines};
      var L=miss.sort(function(a,b){ return String(a.start_time).localeCompare(String(b.start_time)); }).slice(0,12).map(function(r){ return r.staff_name+' · was due '+fmtT(r.start_time); });
      return {text:plural(miss.length,'person').replace('persons','people')+' rostered today and not clocked in yet.', lines:L.concat(lines)};
    }catch(e){ return sorry(); }
  }
  async function forgetful(){
    if(!isLead()) return NOT_LEAD;
    try{
      var sc=await scope(), inScope=new Set(sc.staff), today=todayIso(), from=dIso(today,-28);
      var res=await Promise.all([
        publishedRows('?shift_date=gte.'+from+'&shift_date=lt.'+today+'&status=eq.assigned&select=staff_name,shift_date,start_time&limit=3000'),
        sbGet('clock_log','?action=eq.in&ts=gte.'+new Date(Date.parse(_tzIso(from,'00:00'))-36e5).toISOString()+'&select=staff_name,ts&order=ts.asc&limit=5000'),
        sbGet('clock_log','?action=eq.out&notes=like.auto:*&ts=gte.'+new Date(Date.parse(_tzIso(from,'00:00'))).toISOString()+'&select=staff_name,ts&limit=2000'),
        sbGet('leave_submissions','?status=eq.approved&to_date=gte.'+from+'&from_date=lt.'+today+'&select=staff_name,from_date,to_date'),
        sbGet('push_subscriptions','?select=staff_name&limit=2000')
      ]);
      var shifts=(res[0]||[]).filter(function(r){ return inScope.has(r.staff_name) && r.start_time; });
      var firstIn={}; (res[1]||[]).forEach(function(r){ var k=r.staff_name+'|'+_tzKey(r.ts); if(!firstIn[k] || r.ts<firstIn[k]) firstIn[k]=r.ts; });
      var leave=res[3]||[], by={};
      function row(n){ return by[n]||(by[n]={late:0,missed:0,auto:0}); }
      var seen={};
      shifts.forEach(function(r){
        var k=r.staff_name+'|'+r.shift_date; if(seen[k]) return; seen[k]=1;
        if(leave.some(function(l){ return l.staff_name===r.staff_name && l.from_date<=r.shift_date && l.to_date>=r.shift_date; })) return;
        var t=firstIn[k];
        if(!t){ row(r.staff_name).missed++; return; }
        var due=Date.parse(_tzIso(r.shift_date,String(r.start_time).slice(0,5)));
        if(Date.parse(t)>due+15*6e4) row(r.staff_name).late++;
      });
      (res[2]||[]).forEach(function(r){ if(inScope.has(r.staff_name)) row(r.staff_name).auto++; });
      function sc2(b){ return 2*b.missed+2*b.auto+b.late; }
      var minScore=(typeof FORGET_MIN_SCORE==='number')?FORGET_MIN_SCORE:7;
      var names=Object.keys(by).filter(function(n){ return sc2(by[n])>0; });
      names.sort(function(a,b){ return sc2(by[b])-sc2(by[a]) || a.localeCompare(b); });
      var pushOn=new Set((res[4]||[]).map(function(r){ return r.staff_name; }));
      var lines=names.slice(0,12).map(function(n){ var b=by[n], bits=[];
        if(b.missed) bits.push(b.missed+' no clock-in'); if(b.late) bits.push(b.late+' late'); if(b.auto) bits.push(b.auto+' no clock-out');
        return n+' · '+bits.join(', ')+(pushOn.has(n)?'':(sc2(b)>=minScore?' · gets the popup':' · push off')); });
      var offCount=sc.staff.filter(function(n){ return !pushOn.has(n); }).length;
      lines.push('Push reminders are on for '+(sc.staff.length-offCount)+' of '+sc.staff.length+' staff, so the rest never get the late clock-in nudge.');
      if(!names.length) return {text:'Nobody in '+sc.label.toLowerCase()+' missed a clock-in or clock-out in the last 4 weeks.', lines:[lines[lines.length-1]]};
      return {text:'Who forgets to clock in or out · '+sc.label+' · last 4 weeks (late = 15+ min after the rostered start). Anyone scoring '+minScore+'+ with push off gets the start-up popup.', lines:lines};
    }catch(e){ return sorry(); }
  }
  function pushHelp(){
    var ok=(typeof subscribeToPush==='function') && ('Notification' in window) && ('PushManager' in window);
    if(!ok) return {text:'This browser can’t do push notifications. On an iPhone, add Nexus to the Home Screen first, then open it from there and ask me again.'};
    if(Notification.permission==='denied') return {text:'Notifications are blocked for Nexus on this device.', lines:['Allow them in the browser or phone settings for this site, then ask me again.']};
    return {text:'Push sends you the “Forgot to clock in?” reminder and roster updates on this device.', lines:['Tap below and allow notifications when asked.'],
      go:[{label:'Turn on push', keep:true, done:'Done', run:function(){ return subscribeToPush(); }}]};
  }
  async function whoOffWeek(){
    if(!isLead()) return NOT_LEAD;
    try{
      var sc=await scope(), inScope=new Set(sc.staff), wk=sydneyWeek();
      var rows=(await sbGet('leave_submissions','?status=eq.approved&from_date=lte.'+wk.sun+'&to_date=gte.'+wk.mon+'&select=staff_name,from_date,to_date&order=from_date.asc'))||[];
      rows=rows.filter(function(r){ return inScope.has(r.staff_name); });
      if(!rows.length) return {text:'Nobody in '+sc.label.toLowerCase()+' has approved leave this week.'};
      var lines=rows.slice(0,15).map(function(r){ return r.staff_name+' · '+(r.from_date===r.to_date?fmtShortDate(r.from_date):fmtShortDate(r.from_date)+' to '+fmtShortDate(r.to_date)); });
      return {text:plural(rows.length,'person').replace('persons','people')+' on approved leave this week ('+sc.label+').', lines:lines};
    }catch(e){ return sorry(); }
  }
  async function autoOuts(){
    if(!isLead()) return NOT_LEAD;
    try{
      var sc=await scope(), inScope=new Set(sc.staff), since=new Date(Date.now()-14*864e5).toISOString();
      var rows=(await sbGet('clock_log','?action=eq.out&notes=like.auto:*&ts=gte.'+since+'&select=staff_name,ts&order=ts.desc&limit=1000'))||[];
      rows=rows.filter(function(r){ return inScope.has(r.staff_name); });
      if(!rows.length) return {text:'No auto clock-outs in the last 14 days. Everyone is clocking out.'};
      var by={}; rows.forEach(function(r){ (by[r.staff_name]=by[r.staff_name]||[]).push(r.ts); });
      var names=Object.keys(by).sort(function(a,b){ return by[b].length-by[a].length || a.localeCompare(b); });
      var lines=names.slice(0,12).map(function(n){ return n+' · '+plural(by[n].length,'time')+' (last '+fmtShortDate(by[n][0])+')'; });
      return {text:plural(rows.length,'auto clock-out')+' in the last 14 days across '+plural(names.length,'person').replace('persons','people')+'.', lines:lines, go:[{label:'Open Manager Tools', run:function(){ goTo('myreports'); }}]};
    }catch(e){ return sorry(); }
  }
  async function teamFort(){
    if(!isLead()) return NOT_LEAD;
    try{
      var sc=await scope(), inScope=new Set(sc.staff), r=getPeriodRange('fortnight'), now=Date.now();
      var logs=await sbGet('clock_log','?ts=gte.'+new Date(r.start.getTime()-864e5).toISOString()+'&ts=lt.'+r.end.toISOString()+'&order=ts.asc&limit=5000');
      logs=(logs||[]).filter(function(x){ return inScope.has(x.staff_name); });
      var H=weekHours(logs,r.start.getTime(),r.end.getTime(),now);
      var rows=sc.staff.map(function(n){ return {name:n, ms:(H[n]&&H[n].ms)||0}; }).sort(function(a,b){ return b.ms-a.ms || a.name.localeCompare(b.name); });
      var total=rows.reduce(function(t,x){ return t+x.ms; },0), worked=rows.filter(function(x){ return x.ms>0; });
      var last=new Date(r.end); last.setDate(last.getDate()-1);
      var lines=worked.slice(0,15).map(function(x){ return x.name+' · '+hrs(x.ms); });
      if(rows.length>worked.length) lines.push('No hours yet: '+(rows.length-worked.length)+' of '+rows.length+' staff.');
      return {text:'Fortnight '+fmtShortDate(isoOf(r.start))+' to '+fmtShortDate(isoOf(last))+' · '+sc.label+': '+hrs(total)+' in total.', lines:lines,
        go:[{label:'Download CSV', keep:true, done:'Downloaded', run:function(){ downloadText('nexus-fortnight-'+isoOf(r.start)+'.csv','Name,Hours\n'+rows.map(function(x){ return csvCell(x.name)+','+(Math.round(x.ms/36e5*100)/100); }).join('\n')+'\n'); }}]};
    }catch(e){ return sorry(); }
  }
  async function noAck(){
    if(!amAdmin()) return NOT_LEAD;
    try{
      var ns=(await sbGet('staff_notices','?active=eq.true&order=created_at.desc&limit=1'))||[];
      if(!ns.length) return {text:'There is no live staff notice right now.'};
      var n=ns[0];
      var res=await Promise.all([ sbGet('staff_notice_acks','?notice_id=eq.'+n.id+'&select=staff_name'), sbGet('staff_credentials','?select=staff_name') ]);
      var acked=new Set((res[0]||[]).map(function(r){ return r.staff_name; })), all=(res[1]||[]).map(function(r){ return r.staff_name; }).filter(Boolean);
      var miss=all.filter(function(x){ return !acked.has(x); }).sort();
      if(!miss.length) return {text:'Everyone has acknowledged “'+n.title+'”.'};
      return {text:miss.length+' of '+all.length+' haven’t acknowledged “'+n.title+'” yet.', lines:[miss.slice(0,20).join(', ')+(miss.length>20?' and '+(miss.length-20)+' more':'')], go:[{label:'Open Manager Tools', run:function(){ goTo('myreports'); }}]};
    }catch(e){ return sorry(); }
  }
  async function whoIn(){
    if(!isLead()) return NOT_LEAD;
    try{
      var sc=await scope(), inScope=new Set(sc.staff), now=Date.now();
      var logs=await sbGet('clock_log','?ts=gte.'+new Date(now-864e5).toISOString()+'&order=ts.asc&limit=2000');
      var last={}; (logs||[]).forEach(function(r){ if(inScope.has(r.staff_name)) last[r.staff_name]=r; });
      var ins=Object.keys(last).filter(function(n){ return last[n].action==='in'; }).sort(function(a,b){ return new Date(last[a].ts)-new Date(last[b].ts); });
      if(!ins.length) return {text:'Nobody in '+sc.label.toLowerCase()+' is clocked in right now.'};
      return {text:plural(ins.length,'person').replace('persons','people')+' clocked in right now ('+sc.label+').', lines:listMore(ins.map(function(n){ return n+' since '+fmtClock(new Date(last[n].ts))+' ('+hrs(now-new Date(last[n].ts).getTime())+')'; }),15)};
    }catch(e){ return sorry(); }
  }
  async function leaveWaiting(){
    if(!isLead()) return NOT_LEAD;
    try{
      var sc=await scope(), inScope=new Set(sc.staff);
      var rows=(await sbGet('leave_submissions','?status=eq.pending&order=from_date.asc&select=staff_name,from_date,to_date,reason_type'))||[];
      rows=rows.filter(function(r){ return inScope.has(r.staff_name); });
      if(!rows.length) return {text:'No leave requests are waiting for a decision ('+sc.label+').'};
      return {text:plural(rows.length,'leave request')+' waiting for a decision ('+sc.label+').', lines:listMore(rows.map(function(r){ return r.staff_name+' · '+fmtShortDate(r.from_date)+(r.to_date&&r.to_date!==r.from_date?' – '+fmtShortDate(r.to_date):'')+(r.reason_type?' · '+r.reason_type:''); }),8).concat(['Approve or decline in ShiftOps.'])};
    }catch(e){ return sorry(); }
  }
  async function unfilled(){
    if(!isLead()) return NOT_LEAD;
    try{
      var sc=await scope(), wk=sydneyWeek();
      var iso=isoOf(new Date());
      var rows=await sbGet('roster_shifts','?status=eq.open&shift_date=gte.'+iso+'&shift_date=lt.'+wk.after+'&select=shift_date,start_time,end_time,role,open_to_team&order=shift_date.asc,start_time.asc');
      var pub=await _publishedWeeks();
      var vis=_filterPublished((rows||[]).filter(function(r){ return sc.admin || !r.open_to_team || r.open_to_team===sc.team; }),pub);
      if(!vis.length) return {text:'No open shifts from today to the end of next week.'};
      return {text:plural(vis.length,'open shift')+' not yet picked up.', lines:listMore(vis.map(function(r){ return fmtDay(r.shift_date)+', '+fmtT(r.start_time)+(r.end_time?' – '+fmtT(r.end_time):'')+(r.role?' · '+r.role:'')+(r.open_to_team?' · '+r.open_to_team:''); }),8), go:[{label:'Open Shifts', run:function(){ goTo('shifts'); }}]};
    }catch(e){ return sorry(); }
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
    {id:'payend', g:'Time', label:'When does this pay fortnight end?', run:function(){
      var r=getPeriodRange('fortnight'), last=new Date(r.end); last.setDate(last.getDate()-1);
      var t=new Date(); t.setHours(0,0,0,0); var left=Math.round((last-t)/864e5);
      return {text:'This pay fortnight runs '+fmtShortDate(isoOf(r.start))+' to '+fmtShortDate(isoOf(last))+'.', lines:[left<=0?'It ends today.':plural(left,'day')+' left after today.'], go:[goMyHours('fortnight')]};
    }},
    {id:'streak', g:'Time', label:'My shift streak', run:async function(){
      if(typeof _computeMyStreak!=='function') return {text:'I can’t read your streak right now.'};
      try{
        var s=await _computeMyStreak(), cur=(s&&s.current)||0, best=(s&&s.best)||0;
        if(!cur && !best) return {text:'No streak yet. It builds as you work your rostered shifts.'};
        return {text:cur?('You are on a streak of '+plural(cur,'shift')+'.'):'Your streak is at zero right now.', lines:[best?'Your best is '+plural(best,'shift')+'.':''].filter(Boolean), go:[{label:'See achievements', run:function(){ goTo('achievements'); }}]};
      }catch(e){ return sorry(); }
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
    {id:'myweek', g:'Shifts & leave', label:'My shifts this week', run:async function(){
      try{
        var wk=sydneyWeek();
        var rows=await publishedRows('?staff_name=eq.'+encodeURIComponent(who())+'&shift_date=gte.'+wk.mon+'&shift_date=lt.'+wk.next+'&status=eq.assigned&select=shift_date,start_time,end_time,role,status&order=shift_date.asc,start_time.asc');
        if(!rows.length) return {text:'You have no published shifts this week.', go:[{label:'See open shifts', run:function(){ goTo('shifts'); }}]};
        return {text:plural(rows.length,'shift')+' this week.', lines:rows.map(function(r){ return fmtDay(r.shift_date)+' · '+timeRange(r)+(r.role?' · '+r.role:''); }), go:[{label:'See my roster', run:function(){ goTo('shifts'); }}]};
      }catch(e){ return sorry(); }
    }},
    {id:'whotoday', g:'Shifts & leave', label:'Who’s working today?', run:async function(){
      try{
        var iso=todayIso();
        var rows=await publishedRows('?shift_date=eq.'+iso+'&status=eq.assigned&select=staff_name,start_time,end_time,role,shift_date&order=start_time.asc');
        if(!rows.length) return {text:'Nobody is rostered today.'};
        var lines=rows.slice(0,15).map(function(r){ return r.staff_name+' · '+timeRange(r); });
        if(rows.length>15) lines.push('and '+(rows.length-15)+' more');
        return {text:plural(rows.length,'person').replace('persons','people')+' rostered today.', lines:lines};
      }catch(e){ return sorry(); }
    }},
    {id:'leavedays', g:'Shifts & leave', label:'Leave days I’ve taken this year', run:async function(){
      try{
        var yr=new Date().getFullYear();
        var rows=(await sbGet('leave_submissions','?staff_name=eq.'+encodeURIComponent(who())+'&status=eq.approved&from_date=gte.'+yr+'-01-01&from_date=lte.'+yr+'-12-31&select=from_date,to_date,reason_type&order=from_date.asc'))||[];
        var days=rows.reduce(function(t,r){ return t+Math.round((dayOf(r.to_date)-dayOf(r.from_date))/864e5)+1; },0);
        if(!rows.length) return {text:'You have no approved leave so far in '+yr+'.', go:[{label:'Open Leave', run:function(){ goTo('leave'); }}]};
        return {text:'You have taken '+plural(days,'approved leave day')+' in '+yr+'.', lines:rows.slice(-4).map(function(r){ return fmtShortDate(r.from_date)+(r.from_date===r.to_date?'':' to '+fmtShortDate(r.to_date))+(r.reason_type?' · '+r.reason_type:''); }), go:[{label:'Open Leave', run:function(){ goTo('leave'); }}]};
      }catch(e){ return sorry(); }
    }},
    {id:'giveup', g:'Shifts & leave', label:'How do I give up a shift?', run:function(){
      return {text:'Open Shifts, find the shift and ask to give it up. A manager releases it to the team, and you stay on it until someone picks it up.', go:[{label:'Open Shifts', run:function(){ goTo('shifts'); }}]};
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
    {id:'bdays', g:'People', label:'Birthdays coming up', run:async function(){
      try{
        var rows=(await sbGet('staff_credentials','?select=staff_name,birthday&birthday=not.is.null'))||[];
        var t=new Date(); t.setHours(0,0,0,0);
        var up=rows.map(function(r){ var b=new Date(r.birthday+'T00:00:00'), n=new Date(t.getFullYear(),b.getMonth(),b.getDate()); if(n<t) n.setFullYear(n.getFullYear()+1); return {name:r.staff_name, d:n, diff:Math.round((n-t)/864e5)}; })
          .filter(function(x){ return x.diff<=30; }).sort(function(a,b){ return a.diff-b.diff || a.name.localeCompare(b.name); });
        if(!up.length) return {text:'No birthdays in the next 30 days.', go:[{label:'Open Calendar', run:function(){ goTo('calendar'); }}]};
        return {text:plural(up.length,'birthday')+' in the next 30 days.', lines:up.slice(0,10).map(function(x){ return x.name+' · '+(x.diff===0?'today':x.diff===1?'tomorrow':x.d.toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'})); }), go:[{label:'Open Calendar', run:function(){ goTo('calendar'); }}]};
      }catch(e){ return sorry(); }
    }},
    {id:'events', g:'Calendar', label:'Events and public holidays', run:async function(){
      try{
        var t=new Date(); t.setHours(0,0,0,0); var end=new Date(t); end.setDate(end.getDate()+30);
        var items=[];
        var ev=(await sbGet('calendar_events','?event_date=gte.'+isoOf(t)+'&event_date=lte.'+isoOf(end)+'&order=event_date.asc'))||[];
        ev.forEach(function(e){ items.push({iso:e.event_date, t:e.title}); });
        if(typeof AU_HOLIDAYS!=='undefined') Object.keys(AU_HOLIDAYS).forEach(function(k){ if(k>=isoOf(t) && k<=isoOf(end)) items.push({iso:k, t:AU_HOLIDAYS[k]+' (public holiday)'}); });
        items.sort(function(a,b){ return a.iso.localeCompare(b.iso); });
        if(!items.length) return {text:'No events or public holidays in the next 30 days.', go:[{label:'Open Calendar', run:function(){ goTo('calendar'); }}]};
        return {text:plural(items.length,'thing')+' coming up in the next 30 days.', lines:items.slice(0,10).map(function(x){ return fmtDay(x.iso)+' · '+x.t; }), go:[{label:'Open Calendar', run:function(){ goTo('calendar'); }}]};
      }catch(e){ return sorry(); }
    }},
    {id:'nepal', g:'Calendar', label:'Today’s date and time in Nepal', run:function(){
      var now=new Date(), o={timeZone:'Asia/Kathmandu'};
      var time=now.toLocaleTimeString('en-AU',{timeZone:'Asia/Kathmandu',hour:'numeric',minute:'2-digit',hour12:true});
      var greg=now.toLocaleDateString('en-AU',{timeZone:'Asia/Kathmandu',weekday:'long',day:'numeric',month:'long'});
      var bs=''; try{ if(typeof formatNepaliDate==='function') bs=formatNepaliDate(now); }catch(e){}
      var lines=[greg]; if(bs) lines.push('Nepali date: '+bs);
      return {text:'It is '+time+' in Kathmandu.', lines:lines};
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
    {id:'teamrep', g:'Leads & admins', lead:true, label:'Generate Team Report',
      form:{ intro:'Which week? I’ll build the Team Report and you can download the PDF.', submit:'Generate',
        fields:function(){
          var f=[{id:'week',label:'Week',options:[{v:'this',t:'This week'},{v:'last',t:'Last week'}],value:'this'}];
          if(typeof myIsAdmin!=='undefined' && myIsAdmin){
            var teams=['Processing','Enrolment','Placement','Evershine','Accounts','Education'].filter(function(t){ return typeof trTeamHasReport!=='function' || trTeamHasReport(t); });
            var cur=(typeof trActiveTeam==='function')?trActiveTeam():teams[0];
            f.unshift({id:'team',label:'Team',options:teams.map(function(t){ return {v:t,t:t}; }),value:teams.filter(function(t){ return t.toLowerCase()===String(cur).toLowerCase(); })[0]||teams[0]});
          }
          return f; },
        summary:function(v){ return (v.team?v.team+', ':'')+(v.week==='last'?'last week':'this week'); } },
      run:teamReport},
    {id:'report', g:'Leads & admins', lead:true, label:'Staff hours summary', run:weeklyReport},
    {id:'whoin', g:'Leads & admins', lead:true, label:'Who’s clocked in now?', run:whoIn},
    {id:'leavewait', g:'Leads & admins', lead:true, label:'Leave waiting for a decision', run:leaveWaiting},
    {id:'unfilled', g:'Leads & admins', lead:true, label:'Unfilled shifts', run:unfilled},
    {id:'absent', g:'Leads & admins', lead:true, label:'Rostered today, not clocked in', run:absentToday},
    {id:'whooff', g:'Leads & admins', lead:true, label:'Who’s on leave this week?', run:whoOffWeek},
    {id:'teamfort', g:'Leads & admins', lead:true, label:'Team hours this fortnight', run:teamFort},
    {id:'forgetful', g:'Leads & admins', lead:true, label:'Who forgets to clock in or out?', run:forgetful},
    {id:'autos', g:'Leads & admins', lead:true, label:'Auto clock-outs, last 14 days', run:autoOuts},
    {id:'noack', g:'Leads & admins', lead:true, admin:true, label:'Who hasn’t acknowledged the notice?', run:noAck},
    {id:'pushon', g:'Help', label:'Turn on push reminders', run:pushHelp},
    {id:'forgot', g:'Help', label:'I forgot to clock out', run:function(){
      return {text:'Nexus clocks you out automatically at 8pm. For the real time, ask an admin to fix your punch.', lines:['The auto clock-out shows in My Hours so you can tell them which day.'], go:[goMyHours(null)]};
    }},
    {id:'geo', g:'Help', label:'Clock in won’t work', run:function(){
      return {text:'Clocking in checks your location. Make sure Location is on for this browser and you are at your work place, then tap Try again on the clock.', lines:['If you are at work and it still fails, tell an admin so they can add your punch.'], go:[{label:'Open the clock', run:function(){ goTo('home'); }}]};
    }},
    {id:'unread', g:'Help', label:'Do I have unread alerts?', run:function(){
      var n=0; try{ n=(typeof NotifManager!=='undefined' && NotifManager.unreadCount)?NotifManager.unreadCount():0; }catch(e){}
      return {text:n?('You have '+plural(n,'unread alert')+'.'):'No unread alerts. You’re all caught up.', go:[{label:'Open Alerts', run:function(){ goTo('notifs'); }}]};
    }},
    {id:'profile', g:'Help', label:'Change my photo or password', run:function(){
      return {text:'It’s all in your profile: photo, bio, password, text size and theme.', go:[{label:'Open Profile', run:function(){ goTo('profile'); }}]};
    }}
  ];

  function css(){
    if(document.getElementById('nxAgentCss')) return;
    var s=document.createElement('style'); s.id='nxAgentCss';
    s.textContent=
'.nxa-ov,.nxa-fab,.nxa-fabd{display:none}'+
':root:not([data-nx-off]) .nxa-ov{display:block;position:fixed;inset:0;z-index:2500;visibility:hidden;pointer-events:none;background:rgba(0,0,0,0);transition:background 220ms ease-out,visibility 0s linear 260ms}'+
':root:not([data-nx-off]) .nxa-ov.is-open{visibility:visible;pointer-events:auto;background:rgba(0,0,0,.42);transition:background 220ms ease-out}'+
'.nxa-sheet{position:absolute;display:flex;flex-direction:column;background:var(--m-card,var(--ui-surface,#fff));color:var(--m-ink,var(--ui-ink,#0f172a));box-shadow:0 -12px 40px -12px rgba(0,0,0,.35);will-change:transform;font-family:var(--font,system-ui,sans-serif)}'+
'.nxa-sheet.is-drag{transition:none}'+
'.nxa-top{touch-action:none;cursor:grab;padding:8px 18px 6px;flex:0 0 auto}'+
'.nxa-grab{width:38px;height:5px;border-radius:3px;background:var(--m-border-hi,rgba(120,120,128,.35));margin:0 auto 10px}'+
'.nxa-hd{display:flex;align-items:center;gap:10px}'+
'.nxa-fab .nxa-cat,.nxa-fabd .nxa-cat{width:84%;height:84%}.nxa-cat{display:block;width:100%;height:100%;object-fit:contain;image-rendering:auto;pointer-events:none;-webkit-user-drag:none}'+
'.nxa-av{width:40px;height:40px;padding:3px;box-sizing:border-box;overflow:hidden;border-radius:50%;background:#eef0f4;color:var(--accent,#10b981);display:grid;place-items:center;flex:0 0 auto}'+
'.nxa-ttl{flex:1;min-width:0}.nxa-ttl b{display:block;font:700 17px/1.2 var(--font,system-ui);letter-spacing:-.01em}'+
'.nxa-ttl span{display:block;font:500 12.5px/1.3 var(--font,system-ui);color:var(--m-ink-3,#64748b)}'+
'.nxa-x{all:unset;box-sizing:border-box;width:44px;height:44px;margin:-6px -8px -6px 0;display:grid;place-items:center;color:var(--m-ink-3,#64748b);cursor:pointer;-webkit-tap-highlight-color:transparent}'+
'.nxa-x:active,.nxa-x:hover{color:var(--m-ink,#0f172a)}.nxa-x:focus-visible,.nxa-chip:focus-visible,.nxa-go:focus-visible,.nxa-fabd:focus-visible{outline:2px solid var(--accent,#10b981);outline-offset:2px}'+
'.nxa-thread{flex:1 1 auto;min-height:96px;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:6px 18px 10px;display:flex;flex-direction:column;gap:10px}'+
'.nxa-m{max-width:86%;font:500 15px/1.4 var(--font,system-ui);animation:nxaIn 220ms ease-out both}'+
'.nxa-m.w{max-width:94%;min-width:70%}'+
'.nxa-m.n{align-self:flex-start;background:var(--m-card-2,var(--ui-surface-2,#f1f5f9));border-radius:18px 18px 18px 6px;padding:10px 14px}'+
'.nxa-m.u{align-self:flex-end;background:var(--accent,#10b981);color:var(--on-accent,#fff);border-radius:18px 18px 6px 18px;padding:10px 14px;font-weight:600}'+
'.nxa-m .t{display:block;font-weight:600}.nxa-m .l{display:block;margin-top:4px;font-weight:500;font-size:14px;color:var(--m-ink-2,#475569)}'+
'.nxa-acts{display:flex;flex-wrap:wrap;gap:4px 16px;margin-top:8px}'+
'.nxa-go{all:unset;box-sizing:border-box;min-height:32px;display:inline-flex;align-items:center;gap:4px;font:700 14px/1 var(--font,system-ui);color:var(--accent-text,var(--accent,#059669));cursor:pointer;-webkit-tap-highlight-color:transparent}'+
'.nxa-go:active,.nxa-go:hover{opacity:.65}.nxa-go[disabled]{opacity:.4;pointer-events:none}'+
'.nxa-form{display:flex;flex-direction:column;gap:10px;margin-top:10px}.nxa-form label{display:block;font:700 11.5px/1 var(--font,system-ui);letter-spacing:.05em;text-transform:uppercase;color:var(--m-ink-3,#64748b)}'+
'.nxa-form input{box-sizing:border-box;width:100%;min-height:44px;margin-top:6px;padding:0 2px;border:0;border-bottom:1.5px solid var(--m-border-hi,rgba(120,120,128,.4));border-radius:0;background:transparent;color:var(--m-ink,var(--ui-ink,#0f172a));font:600 16px/1 var(--font,system-ui);-webkit-appearance:none;appearance:none;outline:none}'+
'.nxa-form select{box-sizing:border-box;width:100%;min-height:44px;margin-top:6px;padding:0 2px;border:0;border-bottom:1.5px solid var(--m-border-hi,rgba(120,120,128,.4));border-radius:0;background-color:transparent;color:inherit;font:600 16px/1.2 var(--font,system-ui);outline:none}'+
'.nxa-form select:focus{border-bottom-color:var(--accent,#10b981);box-shadow:0 1.5px 0 var(--accent,#10b981)}'+
'.nxa-form input:focus{border-bottom-color:var(--accent,#10b981);box-shadow:0 1.5px 0 var(--accent,#10b981)}'+
'.nxa-dots{display:inline-flex;gap:4px;align-items:center;height:20px}.nxa-dots i{width:7px;height:7px;border-radius:50%;background:var(--m-ink-3,#94a3b8);animation:nxaDot 1s ease-in-out infinite}'+
'.nxa-dots i:nth-child(2){animation-delay:.15s}.nxa-dots i:nth-child(3){animation-delay:.3s}'+
'.nxa-chips{flex:0 0 auto;padding:6px 18px 16px;display:flex;flex-wrap:wrap;gap:8px;max-height:36vh;overflow-y:auto;overscroll-behavior:contain}'+
'.nxa-lbl{flex:0 0 100%;font:700 11.5px/1 var(--font,system-ui);letter-spacing:.06em;text-transform:uppercase;color:var(--m-ink-3,#64748b);margin:8px 0 0}.nxa-lbl:first-child{margin-top:2px}'+
'.nxa-chip{all:unset;box-sizing:border-box;min-height:42px;padding:0 15px;display:inline-flex;align-items:center;border-radius:21px;background:var(--accent-dim,rgba(16,185,129,.12));color:var(--accent-text,var(--accent,#059669));font:650 14.5px/1 var(--font,system-ui);cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform 100ms ease-out,opacity 120ms}'+
'.nxa-chip:active{transform:scale(.97)}.nxa-chip:hover{filter:brightness(.96)}.nxa-chip[disabled]{opacity:.45;pointer-events:none}'+
'@keyframes nxaIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}'+
'@keyframes nxaDot{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}'+
/* phones: round button in the top bar, bottom sheet */
'@media (max-width:700px){'+
 ':root:not([data-nx-off]) .nxa-fab{display:grid;place-items:center;position:absolute;z-index:3;top:calc(env(safe-area-inset-top,0px) + 8px);left:calc(50% - 18px);width:36px;height:36px;padding:0;border:0;border-radius:50%;'+
   'background:#eef0f4;color:var(--accent,#10b981);cursor:pointer;box-shadow:0 0 0 1px rgba(0,0,0,.14),0 6px 16px -8px rgba(0,0,0,.55);-webkit-tap-highlight-color:transparent;transition:left 240ms cubic-bezier(.2,.8,.2,1),transform 120ms ease-out}'+
 ':root:not([data-nx-off]) .nxa-fab:active{transform:scale(.94)}.nxa-fab:focus-visible{outline:2px solid var(--accent,#10b981);outline-offset:2px}'+
 ':root:not([data-nx-off]) .nxa-fab.is-bubble{left:calc(100% - 106px)}'+
 '.nxa-sheet{left:0;right:0;bottom:0;max-height:86vh;max-height:86dvh;border-radius:22px 22px 0 0;padding-bottom:env(safe-area-inset-bottom,0px);transform:translateY(105%);transition:transform 360ms cubic-bezier(.2,.9,.25,1)}'+
 '.nxa-ov.is-open .nxa-sheet{transform:translateY(0)}'+
'}'+
/* computers: round button bottom-right, panel pops up above it */
'@media (min-width:701px){'+
 ':root:not([data-nx-off]) .nxa-fabd.is-on{display:grid;place-items:center;position:fixed;z-index:2400;right:24px;bottom:24px;width:52px;height:52px;padding:0;border:0;border-radius:50%;'+
   'background:#eef0f4;color:var(--accent,#10b981);cursor:pointer;box-shadow:0 0 0 1px rgba(0,0,0,.14),0 10px 28px -10px rgba(0,0,0,.6);transition:transform 140ms ease-out,opacity 160ms}'+
 ':root:not([data-nx-off]) .nxa-fabd.is-on:hover{transform:translateY(-2px)}.nxa-fabd.is-on:active{transform:scale(.95)}.nxa-fabd.is-hide{opacity:0;pointer-events:none}'+
 '.nxa-fabd svg{width:24px;height:24px}'+
 ':root:not([data-nx-off]) .nxa-ov.is-open{background:rgba(0,0,0,.14)}'+
 '.nxa-sheet{right:24px;bottom:24px;width:400px;max-width:calc(100vw - 48px);max-height:min(700px,calc(100vh - 48px));max-height:min(700px,calc(100dvh - 48px));border-radius:22px;box-shadow:0 24px 70px -16px rgba(0,0,0,.45),0 0 0 1px var(--m-border,rgba(120,120,128,.18));'+
   'opacity:0;transform:translateY(14px) scale(.98);transform-origin:100% 100%;transition:transform 240ms cubic-bezier(.2,.9,.25,1),opacity 180ms ease-out}'+
 '.nxa-ov.is-open .nxa-sheet{opacity:1;transform:none}'+
 '.nxa-grab{display:none}.nxa-top{cursor:default;touch-action:auto;padding-top:14px}'+
 '.nxa-chips{max-height:42vh}'+
'}'+
'@media (prefers-reduced-motion:reduce){.nxa-sheet{transition:opacity 160ms ease-out !important;transform:none !important;opacity:0}.nxa-ov.is-open .nxa-sheet{opacity:1}.nxa-m{animation:none}.nxa-dots i{animation:none;opacity:.7}.nxa-chip:active,.nxa-fab:active,.nxa-fabd:active{transform:none}.nxa-fab,.nxa-fabd{transition:none}}'+
'@media (prefers-reduced-transparency:reduce){.nxa-ov.is-open{background:rgba(0,0,0,.6)}}';
    document.head.appendChild(s);
  }

  /* the launcher: a round button in the top bar; steps aside to the right once the page title slides into the bar */
  var fabd=null;
  function buildFabD(){
    if(fabd||!document.body) return;
    css();
    fabd=document.createElement('button'); fabd.type='button'; fabd.className='nxa-fabd'; fabd.setAttribute('aria-label','Ask Nexi'); fabd.title='Ask Nexi'; fabd.innerHTML=SPARK;
    fabd.addEventListener('click',function(){ open(); });
    document.body.appendChild(fabd);
    /* only shown once someone is signed in, and tucked away while the panel is open */
    setInterval(function(){ fabd.classList.toggle('is-on', !!who()); fabd.classList.toggle('is-hide', !!(ov && ov.classList.contains('is-open'))); },400);
  }
  function buildFab(){
    buildFabD();
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
      if(e.target.closest('button') || window.innerWidth>700) return;
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
      if(a.lead && !isLead()) return;
      if(a.admin && !amAdmin()) return;
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
    bubble.querySelectorAll('.nxa-go').forEach(function(b){ b.addEventListener('click',function(){
      var g=r.go[+b.getAttribute('data-i')];
      if(g.keep){                                   /* does its job right here and leaves the sheet open */
        var label=b.firstChild; try{ Promise.resolve(g.run()).then(function(){ label.textContent=(g.done||'Done')+' '; setTimeout(function(){ label.textContent=g.label+' '; },1800); }); }catch(e){}
        return;
      }
      close(); setTimeout(function(){ try{ g.run(); }catch(e){} },120);
    }); });
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
    var a=ASK.filter(function(x){ return x.id===id; })[0]; if(!a || (a.lead && !isLead()) || (a.admin && !amAdmin())) return;
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
    fields.forEach(function(f){ if(f.options){ h+='<div><label for="nxaf_'+f.id+'">'+esc(f.label)+'</label><select id="nxaf_'+f.id+'" name="'+f.id+'">'+f.options.map(function(o){ return '<option value="'+esc(o.v)+'"'+(o.v===f.value?' selected':'')+'>'+esc(o.t)+'</option>'; }).join('')+'</select></div>'; return; }
      h+='<div><label for="nxaf_'+f.id+'">'+esc(f.label)+'</label><input id="nxaf_'+f.id+'" name="'+f.id+'" type="'+f.type+'" value="'+esc(f.value||'')+'" placeholder="'+esc(f.placeholder||'')+'" autocomplete="off"'+(f.type==='text'?' enterkeyhint="search" autocapitalize="none"':'')+'></div>'; });
    h+='<div class="nxa-acts"><button type="submit" class="nxa-go">'+esc(a.form.submit)+' <span aria-hidden="true">→</span></button></div></form>';
    var bubble=addMsg('n w',h), form=bubble.querySelector('form');
    form.addEventListener('submit',async function(e){
      e.preventDefault(); if(busy) return;
      var vals={}; fields.forEach(function(f){ vals[f.id]=form.elements[f.id].value; });
      busy=true; setChips(true);
      form.querySelectorAll('input,select,button').forEach(function(x){ x.disabled=true; });
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
