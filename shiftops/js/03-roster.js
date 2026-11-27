// ── ROSTER ────────────────────────────────────────────────────────────────
function staffHoursWeek(id){
  let h=0;if(!shifts[id])return h;
  for(let d=0;d<7;d++)if(shifts[id][d])shifts[id][d].forEach(s=>{if(s.type!=='leave')h+=shiftHours(s);});
  return h;
}

function staffHoursDay(id,day){
  let h=0;if(!shifts[id]||!shifts[id][day])return h;
  shifts[id][day].forEach(s=>{if(s.type!=='leave')h+=shiftHours(s);});
  return h;
}


function toggleToolsMenu(){
  const m=document.getElementById('toolsMenu');
  m.classList.toggle('open');
  if(m.classList.contains('open')){
    setTimeout(()=>document.addEventListener('click',closeToolsMenuOutside,{once:true}),0);
  }
}
function closeToolsMenu(){ document.getElementById('toolsMenu').classList.remove('open'); }
function closeToolsMenuOutside(e){ if(!e.target.closest('.tools-dropdown'))closeToolsMenu(); }


/* ── SHIFT-CHANGE NOTICES (manager side) ──────────────────────────────────
   The database writes a notice when a shift in a PUBLISHED week changes (see
   roster_change_notices.sql). Here: warn the manager it happened, mark shifts
   whose change the person hasn't confirmed yet, and list them in Tools → Changes. */
let _rcnRecent=[], _rcnPending={};
function _rcnT(t){ const m=/^(\d{1,2}):(\d{2})/.exec(String(t||'')); return m?(m[1].padStart(2,'0')+':'+m[2]):''; }
function _rcnD(d){ try{ return new Date(d+'T00:00:00').toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'}); }catch(e){ return String(d||''); } }
function _rcnWarn(who){
  try{
    if(!_pubWeeks || !_pubWeeks.has(_curWeekISO())) return;
    setTimeout(function(){ showToast((who||'Staff')+' will be notified — this week is published'); }, 1000);
  }catch(e){}
}
async function loadChangeNotices(){
  try{
    const since=new Date(Date.now()-14*864e5).toISOString();
    const r=await fetch(SUPABASE_URL+'/rest/v1/roster_change_notices?select=id,shift_id,staff_name,kind,old_date,old_start,old_end,new_date,new_start,new_end,created_at,seen_at'+
      '&created_at=gte.'+encodeURIComponent(since)+'&order=created_at.desc&limit=300',
      {headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY}});
    if(!r.ok) return;                       // table not created yet / no access: stay quiet
    const rows=await r.json(); if(!Array.isArray(rows)) return;
    const pend={}; rows.forEach(function(n){ if(!n.seen_at && n.shift_id) pend[n.shift_id]=n; });
    const changed=JSON.stringify(Object.keys(pend).sort())!==JSON.stringify(Object.keys(_rcnPending).sort());
    _rcnRecent=rows; _rcnPending=pend;
    if(changed && typeof renderRoster==='function') renderRoster();
    if(_rcnCur==='changes' && document.getElementById('rtModal').classList.contains('open')) _rtRenderChanges();
  }catch(e){ console.warn('loadChangeNotices',e); }
}
var _rcnCur='';

/* ── ROSTER MINI TOOLS ────────────────────────────────────────────────────
   Check: problems in the visible week. Find cover: who can take a gap.
   Hours: who is under/over their hours. All read the grid already on screen,
   so they match exactly what the manager is looking at. */
function _rtEsc(v){ return String(v==null?'':v).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
function _rtMin(t){ var m=/^(\d{1,2}):(\d{2})/.exec(String(t||'')); return m?(+m[1])*60+(+m[2]):null; }
function _rtName(s){ return ((s.first||'')+' '+(s.last||'')).trim(); }
function _rtPeople(){ return (staff||[]).filter(function(s){return !s.isOfficeManager&&s.isManager!=='office';}); }
function _rtLeave(sid,d){ return ((shifts[sid]||{})[d]||[]).some(function(x){return x.type==='leave';}); }
function _rtWork(sid,d){ return ((shifts[sid]||{})[d]||[]).filter(function(x){return x.type!=='leave';}); }
var _rtCur='check';
function rtOpen(t){ rtTab(t||'check'); openModal('rtModal'); }
function rtTab(t){
  _rtCur=t;
  document.querySelectorAll('#rtTabs button').forEach(function(b){ b.classList.toggle('btn-primary',b.getAttribute('data-t')===t); b.classList.toggle('btn-ghost',b.getAttribute('data-t')!==t); });
  var wk=fmtDate(currentWeekStart)+' – '+fmtDate(addDays(currentWeekStart,6));
  document.getElementById('rtTitle').textContent={check:'Roster check',cover:'Find cover',hours:'Hours balance',changes:'Shift changes'}[t]+' · '+wk;
  _rcnCur=t; ({check:_rtRenderCheck,cover:_rtRenderCover,hours:_rtRenderHours,changes:_rtRenderChanges})[t]();
  if(t==='changes') loadChangeNotices();
}
function _rtRenderCheck(){
  var issues=[], ppl=_rtPeople();
  ppl.forEach(function(s){
    var nm=_rtName(s);
    for(var d=0;d<7;d++){
      var list=_rtWork(s.id,d), av=getAvail(s.id,d), day=DAYS[d];
      if(list.length && _rtLeave(s.id,d)) issues.push({sev:2,sid:s.id,d:d,i:0,t:nm+' · '+day,m:'rostered on a day of approved leave'});
      list.forEach(function(sh,i){
        var a=_rtMin(sh.start), b=_rtMin(sh.end);
        if(av.type==='no') issues.push({sev:2,sid:s.id,d:d,i:i,t:nm+' · '+day,m:'rostered but marked unavailable'});
        else if(av.type==='custom' && a!=null && b!=null){
          var as=_rtMin(av.start), ae=_rtMin(av.end);
          if(as!=null&&ae!=null&&(a<as||b>ae)) issues.push({sev:1,sid:s.id,d:d,i:i,t:nm+' · '+day,m:'shift '+sh.start+'–'+sh.end+' is outside availability '+av.start+'–'+av.end});
        }
        for(var j=i+1;j<list.length;j++){
          var c=_rtMin(list[j].start), e=_rtMin(list[j].end);
          if(a!=null&&b!=null&&c!=null&&e!=null&&a<e&&c<b) issues.push({sev:2,sid:s.id,d:d,i:i,t:nm+' · '+day,m:'two shifts overlap ('+sh.start+'–'+sh.end+' and '+list[j].start+'–'+list[j].end+')'});
        }
      });
      if(staffHoursDay(s.id,d)>10) issues.push({sev:1,sid:s.id,d:d,i:0,t:nm+' · '+day,m:Math.round(staffHoursDay(s.id,d)*10)/10+'h in one day'});
    }
    var wkH=staffHoursWeek(s.id), mx=Number(s.maxHours)||0;
    if(mx && wkH>mx+0.01) issues.push({sev:1,t:nm,m:'over weekly hours: '+(Math.round(wkH*10)/10)+'h of '+mx+'h'});
  });
  for(var d2=0;d2<5;d2++){
    var tot=0; ppl.forEach(function(s){ tot+=staffHoursDay(s.id,d2); });
    if(!tot) issues.push({sev:1,t:DAYS[d2],m:'nobody rostered'});
  }
  issues.sort(function(x,y){return y.sev-x.sev;});
  var h='';
  if(!issues.length) h='<div style="padding:22px;text-align:center;font-weight:700">No problems found in this week.</div>';
  else{
    h='<div style="font-size:12px;opacity:.7;margin:0 0 8px">'+issues.length+' thing'+(issues.length>1?'s':'')+' to look at</div>';
    issues.forEach(function(x){
      var col=x.sev>=2?'#fb7185':'#fbbf24';
      h+='<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;margin:0 0 6px;border:1px solid var(--border);border-left:3px solid '+col+';border-radius:8px">'+
         '<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:13px">'+_rtEsc(x.t)+'</div><div style="font-size:12px;opacity:.8">'+_rtEsc(x.m)+'</div></div>'+
         (x.sid!=null?'<button class="btn btn-ghost" style="padding:4px 10px" onclick="closeModal(\'rtModal\');editShift('+x.sid+','+x.d+','+x.i+')">Open</button>':'')+'</div>';
    });
  }
  document.getElementById('rtBody').innerHTML=h;
}
function _rtRenderCover(){
  var opts=DAYS.map(function(n,i){return '<option value="'+i+'"'+(i===(window._rtDay||0)?' selected':'')+'>'+n+' '+fmtDate(addDays(currentWeekStart,i))+'</option>';}).join('');
  document.getElementById('rtBody').innerHTML=
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin:0 0 12px">'+
    '<div><label class="form-label">Day</label><select class="form-input" id="rtDay" onchange="window._rtDay=+this.value;_rtCoverList()">'+opts+'</select></div>'+
    '<div><label class="form-label">From</label><input class="form-input" type="time" id="rtFrom" value="'+(window._rtFrom||'09:00')+'" onchange="window._rtFrom=this.value;_rtCoverList()"></div>'+
    '<div><label class="form-label">To</label><input class="form-input" type="time" id="rtTo" value="'+(window._rtTo||'17:00')+'" onchange="window._rtTo=this.value;_rtCoverList()"></div>'+
    '<div><label class="form-label">Team</label><select class="form-input" id="rtTeam" onchange="_rtCoverList()"><option value="">All teams</option>'+
      Array.from(new Set(_rtPeople().map(function(s){return s.team;}).filter(Boolean))).sort().map(function(t){return '<option>'+_rtEsc(t)+'</option>';}).join('')+'</select></div>'+
    '</div><div id="rtCoverOut"></div>';
  _rtCoverList();
}
function _rtCoverList(){
  var d=+document.getElementById('rtDay').value, f=document.getElementById('rtFrom').value, t=document.getElementById('rtTo').value, team=document.getElementById('rtTeam').value;
  var a=_rtMin(f), b=_rtMin(t), out=document.getElementById('rtCoverOut');
  if(a==null||b==null||b<=a){ out.innerHTML='<div style="opacity:.7;padding:10px">Pick a start and end time.</div>'; return; }
  var need=(b-a)/60, rows=[];
  _rtPeople().forEach(function(s){
    if(team && s.team!==team) return;
    if(_rtLeave(s.id,d)) return;
    var av=getAvail(s.id,d);
    if(av.type==='no') return;
    var why='', ok=true;
    if(av.type==='custom'){ var as=_rtMin(av.start), ae=_rtMin(av.end); if(as!=null&&ae!=null&&(a<as||b>ae)){ ok=false; why='only '+av.start+'–'+av.end; } }
    if(av.type==='unset'){ why='availability not set'; }
    if(ok && _rtWork(s.id,d).some(function(sh){ var c=_rtMin(sh.start), e=_rtMin(sh.end); return c!=null&&e!=null&&a<e&&c<b; })){ ok=false; why='already rostered then'; }
    var left=(Number(s.maxHours)||0)?Math.max(0,(Number(s.maxHours)||0)-staffHoursWeek(s.id)):null;
    if(ok && left!=null && left+0.01<need){ why=(why?why+' · ':'')+'only '+(Math.round(left*10)/10)+'h left this week'; }
    rows.push({s:s,ok:ok,why:why,left:left});
  });
  rows.sort(function(x,y){ return (y.ok-x.ok) || ((y.left==null?99:y.left)-(x.left==null?99:x.left)); });
  if(!rows.length){ out.innerHTML='<div style="opacity:.7;padding:10px">Nobody is available that day.</div>'; return; }
  out.innerHTML=rows.map(function(r){
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;margin:0 0 6px;border:1px solid var(--border);border-radius:8px;'+(r.ok?'':'opacity:.55')+'">'+
      '<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:13px">'+_rtEsc(_rtName(r.s))+' <span style="font-weight:400;opacity:.65">· '+_rtEsc(r.s.team||'')+'</span></div>'+
      '<div style="font-size:12px;opacity:.8">'+(r.left!=null?(Math.round(r.left*10)/10)+'h left this week':'no hours cap')+(r.why?' · '+_rtEsc(r.why):'')+'</div></div>'+
      (r.ok?'<button class="btn btn-primary" style="padding:4px 10px" onclick="rtAssign('+r.s.id+','+d+',\''+f+'\',\''+t+'\')">Assign</button>':'')+'</div>';
  }).join('');
}
function rtAssign(sid,d,f,t){
  closeModal('rtModal');
  clickCell(sid,d);
  document.getElementById('shiftStart').value=f;
  document.getElementById('shiftEnd').value=t;
}
function _rtRenderHours(){
  var rows=_rtPeople().map(function(s){
    var h=staffHoursWeek(s.id), mx=Number(s.maxHours)||0, onLeaveAll=0;
    for(var d=0;d<7;d++) if(_rtLeave(s.id,d)) onLeaveAll++;
    return {s:s,h:h,mx:mx,leave:onLeaveAll};
  });
  rows.sort(function(x,y){ return (x.h===0)!==(y.h===0) ? (x.h===0?-1:1) : ((y.mx-y.h)-(x.mx-x.h)); });
  var none=rows.filter(function(r){return r.h===0;}).length;
  var h='<div style="font-size:12px;opacity:.7;margin:0 0 8px">'+none+' with no shifts this week · sorted by hours still available</div>';
  rows.forEach(function(r){
    var pct=r.mx?Math.min(100,r.h/r.mx*100):0, over=r.mx&&r.h>r.mx+0.01;
    var col=over?'#fb7185':(r.h===0?'#fbbf24':'var(--accent,#0a84ff)');
    h+='<div style="display:flex;align-items:center;gap:10px;padding:7px 10px;margin:0 0 5px;border:1px solid var(--border);border-radius:8px">'+
      '<div style="width:170px;min-width:0"><div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+_rtEsc(_rtName(r.s))+'</div><div style="font-size:11px;opacity:.65">'+_rtEsc(r.s.team||'')+(r.leave?' · leave '+r.leave+'d':'')+'</div></div>'+
      '<div style="flex:1;height:7px;border-radius:4px;background:var(--border);overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+col+'"></div></div>'+
      '<div style="width:78px;text-align:right;font-size:12px;font-weight:700;font-family:var(--mono)">'+(Math.round(r.h*10)/10)+(r.mx?' / '+r.mx:'')+'h</div></div>';
  });
  document.getElementById('rtBody').innerHTML=h;
}

function _rtRenderChanges(){
  _rcnCur='changes';
  const rows=_rcnRecent||[], unseen=rows.filter(function(n){return !n.seen_at;});
  let h='<div style="font-size:12px;opacity:.7;margin:0 0 8px">'+unseen.length+' not yet seen · last 14 days · staff must tap “Got it” in Nexus</div>';
  if(!rows.length) h+='<div style="padding:22px;text-align:center;opacity:.75">No changes to published rosters.</div>';
  rows.forEach(function(n){
    const oldT=n.old_date?_rcnD(n.old_date)+' '+_rcnT(n.old_start)+'–'+_rcnT(n.old_end):'';
    const newT=n.new_date?_rcnD(n.new_date)+' '+_rcnT(n.new_start)+'–'+_rcnT(n.new_end):'';
    const what=n.kind==='published'?'roster published · week of '+_rtEsc(_rcnD(n.new_date)):(n.kind==='changed'?_rtEsc(oldT)+' → <b>'+_rtEsc(newT)+'</b>':(n.kind==='cancelled'?'removed: '+_rtEsc(oldT):'added: <b>'+_rtEsc(newT)+'</b>'));
    const when=new Date(n.created_at).toLocaleString('en-AU',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});
    const status=n.seen_at?'<span style="color:#10b981;font-weight:700">Seen '+_rtEsc(new Date(n.seen_at).toLocaleString('en-AU',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}))+'</span>':'<span style="color:#f59e0b;font-weight:700">Not seen yet</span>';
    h+='<div style="padding:8px 10px;margin:0 0 6px;border:1px solid var(--border);border-radius:8px"><div style="display:flex;justify-content:space-between;gap:10px"><b style="font-size:13px">'+_rtEsc(n.staff_name)+'</b><span style="font-size:11px;opacity:.65">'+_rtEsc(when)+'</span></div><div style="font-size:12px;margin:2px 0">'+what+'</div><div style="font-size:11.5px">'+status+'</div></div>';
  });
  document.getElementById('rtBody').innerHTML=h;
}

/* ── LEAVE CLASH CHECK ────────────────────────────────────────────────────
   Approving goes through this screen: for each day of the leave it shows who
   else on the same team is off (approved or still pending) and who is
   rostered, so a manager doesn't approve the third person off on a busy day
   without seeing it. Approve here runs the normal approval. */
function _lcISO(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
async function openLeaveClash(id){
  const r=leaveRequests.find(function(x){return x.id===id;}); if(!r) return;
  const person=_staffForLeave(r);
  const name=r.staff_name||r.staffName||(person?_rtName(person):'');
  const fromS=r.from||r.from_date||'', toS=r.to||r.to_date||'';
  document.getElementById('lcTitle').textContent='Approve leave · '+name;
  document.getElementById('lcBody').innerHTML='<div style="padding:24px;text-align:center;opacity:.7">Checking the team roster…</div>';
  const btn=document.getElementById('lcApprove');
  btn.disabled=false; btn.textContent='Approve leave';
  btn.onclick=function(){ closeModal('leaveClashModal'); applyLeaveUpdate(id,'approved',''); };
  openModal('leaveClashModal');

  const team=person?person.team:'';
  const mates=(staff||[]).filter(function(s){ return team && s.team===team; });
  const mateNames={}; mates.forEach(function(s){ mateNames[_normName(_rtName(s))]=_rtName(s); });
  const myKey=_normName(name);

  // days of the leave (capped so a long leave can't flood the screen)
  const days=[]; const f=new Date(fromS+'T00:00:00'), t=new Date(toS+'T00:00:00');
  if(!isNaN(f)&&!isNaN(t)) for(let c=new Date(f); c<=t && days.length<31; c.setDate(c.getDate()+1)) days.push(_lcISO(c));

  // others off (same team, overlapping, approved or pending)
  const others=(leaveRequests||[]).filter(function(x){
    if(x.id===id) return false;
    const st=String(x.status||'').toLowerCase(); if(st!=='approved'&&st!=='pending') return false;
    const k=_normName(x.staff_name||x.staffName||''); if(!mateNames[k]||k===myKey) return false;
    const a=x.from||x.from_date||'', b=x.to||x.to_date||'';
    return a && b && a<=toS && b>=fromS;
  });

  let rows=[];
  try{
    if(days.length){
      const res=await fetch(SUPABASE_URL+'/rest/v1/roster_shifts?select=staff_name,shift_date,start_time,end_time,status'+
        '&shift_date=gte.'+days[0]+'&shift_date=lte.'+days[days.length-1]+'&order=start_time.asc',
        {headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY}});
      if(res.ok) rows=await res.json();
    }
  }catch(e){ console.warn('leave clash roster',e); }
  if(!document.getElementById('leaveClashModal').classList.contains('open')) return;

  const hm=function(x){ return String(x||'').slice(0,5); };
  let html='';
  if(!team) html+='<div style="padding:10px 12px;border-radius:8px;margin:0 0 10px;background:rgba(251,191,36,.12);font-size:12.5px">Couldn\'t match '+_rtEsc(name)+' to a team, so the team check is limited.</div>';
  html+='<div style="padding:10px 12px;border:1px solid var(--border);border-radius:8px;margin:0 0 12px;font-size:13px">'+
    '<div><b>'+_rtEsc(name)+'</b>'+(team?' · '+_rtEsc(team):'')+' · '+_rtEsc(fromS)+(toS!==fromS?' → '+_rtEsc(toS):'')+'</div>'+
    '<div style="margin-top:4px">'+(others.length
      ? '<span style="color:#f59e0b;font-weight:700">Also off:</span> '+others.map(function(x){ return _rtEsc(x.staff_name||x.staffName)+' ('+String(x.status).toLowerCase()+', '+_rtEsc(x.from||x.from_date)+(((x.to||x.to_date)!==(x.from||x.from_date))?' → '+_rtEsc(x.to||x.to_date):'')+')'; }).join(', ')
      : '<span style="color:#10b981;font-weight:700">Nobody else'+(team?' on '+_rtEsc(team):'')+' is off during this time.</span>')+'</div></div>';

  days.forEach(function(iso){
    const dlabel=new Date(iso+'T00:00:00').toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'});
    const dayRows=(rows||[]).filter(function(x){ return x.shift_date===iso; });
    const mine=dayRows.filter(function(x){ return _normName(x.staff_name)===myKey && x.status!=='open'; });
    const offToday=others.filter(function(x){ const a=x.from||x.from_date, b=x.to||x.to_date; return a<=iso && b>=iso; })
                         .map(function(x){ return _normName(x.staff_name||x.staffName); });
    const working=dayRows.filter(function(x){ const k=_normName(x.staff_name); return mateNames[k] && k!==myKey && x.status!=='open' && offToday.indexOf(k)<0; });
    const openShifts=dayRows.filter(function(x){ return x.status==='open' && mateNames[_normName(x.staff_name)]; }).length;
    const risk=(mine.length && !working.length) ? 2 : (offToday.length ? 1 : 0);
    const col=risk===2?'#fb7185':(risk===1?'#f59e0b':'var(--border)');
    if(!mine.length && !working.length && !offToday.length && !openShifts) {
      html+='<div style="padding:6px 10px;margin:0 0 5px;border:1px dashed var(--border);border-radius:8px;font-size:12px;opacity:.6">'+dlabel+' · no team shifts</div>';
      return;
    }
    html+='<div style="padding:8px 10px;margin:0 0 6px;border:1px solid var(--border);border-left:3px solid '+col+';border-radius:8px;font-size:12.5px">'+
      '<div style="font-weight:700;margin-bottom:3px">'+dlabel+(risk===2?' · <span style="color:#fb7185">nobody else on '+_rtEsc(team)+' rostered</span>':'')+'</div>'+
      (mine.length?'<div>'+_rtEsc(name)+' is rostered '+mine.map(function(x){return hm(x.start_time)+'–'+hm(x.end_time);}).join(', ')+' <span style="opacity:.7">— approving opens this for pickup</span></div>':'')+
      '<div><span style="opacity:.7">Working:</span> '+(working.length?working.map(function(x){ return _rtEsc(mateNames[_normName(x.staff_name)])+' '+hm(x.start_time)+'–'+hm(x.end_time); }).join(', '):'—')+'</div>'+
      (offToday.length?'<div><span style="color:#f59e0b">Off:</span> '+offToday.map(function(k){return _rtEsc(mateNames[k]||k);}).join(', ')+'</div>':'')+
      (openShifts?'<div style="opacity:.75">'+openShifts+' open shift'+(openShifts>1?'s':'')+' already waiting for cover</div>':'')+
    '</div>';
  });
  if(days.length===31) html+='<div style="font-size:11.5px;opacity:.65">Showing the first 31 days.</div>';
  document.getElementById('lcBody').innerHTML=html;
}

function renderRoster(){
  const grid=document.getElementById('rosterGrid');
  try{ waSync(); }catch(e){}
  // Derive this week's leaves straight from leave_submissions: match by name,
  // strip anything that doesn't belong, add every approved leave that does.
  // The grid is ALWAYS a true reflection of leave_submissions.
  try{ _syncWeekLeavesToSubmissions(); }catch(e){}
  // Deputy-style day totals: each column header carries the day's rostered
  // hours, so a thin day is visible before anyone reads a single cell.
  const dayTotals=[0,0,0,0,0,0,0];
  staff.forEach(function(s){
    for(let d=0;d<7;d++){
      ((shifts[s.id]||{})[d]||[]).forEach(function(sh){ dayTotals[d]+=shiftHours(sh); });
    }
  });
  let html='<div class="grid-header"><div class="grid-col-head">Staff</div>';
  for(let d=0;d<7;d++){
    const day=addDays(currentWeekStart,d);
    const t=dayTotals[d];
    html+=`<div class="grid-col-head${isToday(day)?' today':''}">${DAYS[d]}<br><span style="font-size:9px;opacity:.6">${fmtDate(day)}</span><span class="dh-total">${t?t.toFixed(1).replace('.0','')+'h':'·'}</span></div>`;
  }
  html+='</div>';
  const officeManager=staff.filter(s=>s.isOfficeManager||s.isManager==='office');
  if(officeManager.length>0){
    html+=`<div style="display:grid;grid-template-columns:var(--staffcol) repeat(7,1fr);background:rgba(255,215,0,.08);border-bottom:1px solid var(--border);"><div style="padding:6px 12px;font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#ffd700;border-right:1px solid var(--border)">&#9733; Office</div>${Array(7).fill(`<div style="border-right:1px solid var(--border)"></div>`).join('')}</div>`;
    officeManager.forEach(s=>{
      const hrs=staffHoursWeek(s.id),pct=Math.min(100,(hrs/s.maxHours)*100);
      html+=`<div class="grid-row" style="background:rgba(255,215,0,.04)"><div class="staff-cell"><div class="avatar" style="background:#ffd700;color:#3a2a00">${initials(s)}</div><div style="min-width:0;flex:1;overflow:hidden"><button type="button" class="staff-name name-link" style="color:#ffd700" onclick="event.stopPropagation();openEmpProfile(${s.id})" title="Open ${s.first}'s profile" aria-label="Open ${s.first} ${s.last}'s profile">${s.first} ${s.last} &#9733;</button><div class="staff-role" style="color:#c9a800">Office Manager</div><div class="hours-bar"><div class="hours-bar-bg"><div class="hours-bar-fill${pct>90?' warn':''}" style="width:${pct}%;background:#ffd700"></div></div></div></div></div>`;
      for(let d=0;d<7;d++){
        const av=getAvail(s.id,d),dayShifts=(shifts[s.id]||{})[d]||[];
        const hasNonLeave=dayShifts.some(sh=>sh.type!=='leave');
        const conflict=av.type==='no'&&hasNonLeave;
        html+=`<div class="shift-cell${dayShifts.length===0?' empty-clickable':''} ${conflict?' shift-conflict':''}" ${dayShifts.length===0?`onclick="clickCell(${s.id},${d})"`:''}>`;
        dayShifts.forEach((sh,i)=>{const il=sh.type==='leave';const dev=sh.deviceId?devices.find(x=>x.id===sh.deviceId):null;html+=`<div class="shift-badge ${il?'shift-leave':''}" style="${il?'':`background:rgba(255,215,0,.15);color:#ffd700;border:1px solid rgba(255,215,0,.3)`}" onclick="event.stopPropagation();editShift(${s.id},${d},${i})">${il?'LEAVE':`${sh.start}–${sh.end}`}${dev?`<br><span style="font-size:8px;opacity:.85"> ${dev.name}</span>`:`<br><span style="font-size:8px;opacity:.7">Office Mgr</span>`}</div>`;});
        html+='</div>';
      }
      html+='</div>';
    });
  }
  const sortedTeams=[...new Set(staff.filter(s=>!s.isOfficeManager&&s.isManager!=='office').map(s=>s.team))].sort();
  sortedTeams.forEach(team=>{
    const teamStaff=staff.filter(s=>s.team===team&&!s.isOfficeManager&&s.isManager!=='office');
    const ordered=teamStaff.sort((a,b)=>a.first.localeCompare(b.first)||a.last.localeCompare(b.last));
    if(!ordered.length)return;
    // Team roll-up: the week total for the team, and its hours per day. Reading
    // 33 individual rows to work out whether a team is over- or under-covered
    // was the missing piece — the numbers were all there, just never added up.
    const teamWeek=ordered.reduce((t,s)=>t+staffHoursWeek(s.id),0);
    const teamDay=[0,0,0,0,0,0,0];
    ordered.forEach(s=>{ for(let d=0;d<7;d++) teamDay[d]+=staffHoursDay(s.id,d); });
    const _h=n=>n?(Math.round(n*10)/10).toString().replace(/\.0$/,'')+'h':'·';
    html+=`<div data-team="${(team||'').replace(/"/g,'&quot;')}" style="display:grid;grid-template-columns:var(--staffcol) repeat(7,1fr);background:var(--accent-dim);border-bottom:1px solid var(--border);border-top:1px solid var(--border)"><div style="padding:7px 14px;font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--accent-deep);border-right:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:6px"><span>${team}</span><span style="opacity:.75;letter-spacing:.5px">${ordered.length}&middot;${_h(teamWeek)}</span></div>${teamDay.map(t=>`<div style="border-right:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:9px;font-weight:700;color:var(--accent-deep);opacity:.8">${_h(t)}</div>`).join('')}</div>`;
    ordered.forEach(s=>{
      const hrs=staffHoursWeek(s.id),pct=Math.min(100,(hrs/s.maxHours)*100);
      html+=`<div class="grid-row" data-team="${(s.team||'').replace(/"/g,'&quot;')}"><div class="staff-cell"><div class="avatar" style="background:${s.color}">${initials(s)}</div><div style="min-width:0;flex:1;overflow:hidden"><button type="button" class="staff-name name-link" onclick="event.stopPropagation();openEmpProfile(${s.id})" title="Open ${s.first}'s profile" aria-label="Open ${s.first} ${s.last}'s profile">${s.first} ${s.last}</button><div class="staff-role"><span class="sr-team">${s.team}</span><b class="hrs-num">${hrs?hrs.toFixed(1).replace('.0',''):0}h</b></div><div class="hours-bar"><div class="hours-bar-bg"><div class="hours-bar-fill${pct>90?' warn':''}" style="width:${pct}%"></div></div></div></div><div class="wk-tools"><button class="wk-btn" title="Copy this week" onclick="event.stopPropagation();copyStaffWeek(${s.id})">⧉</button><button class="wk-btn wk-paste" title="Paste copied week here" onclick="event.stopPropagation();pasteStaffWeek(${s.id})">⤓</button></div></div>`;
      for(let d=0;d<7;d++){
        const av=getAvail(s.id,d),dayShifts=(shifts[s.id]||{})[d]||[];
        const hasNonLeave=dayShifts.some(sh=>sh.type!=='leave');
        const conflict=av.type==='no'&&hasNonLeave;
        html+=`<div class="shift-cell${conflict?' shift-conflict':''} ${dayShifts.length===0?' empty-clickable':''}" data-sid="${s.id}" data-day="${d}" ondragover="cellDragOver(event,${s.id},${d})" ondragleave="cellDragLeave(event)" ondrop="cellDrop(event,${s.id},${d})" ${dayShifts.length===0?`onclick="clickCell(${s.id},${d})"`:''}>`;
        dayShifts.forEach((sh,i)=>{
          const il=sh.type==='leave';
          const dev=sh.deviceId?devices.find(x=>x.id===sh.deviceId):null;
          let devConflict=false;
          if(dev){
            staff.forEach(other=>{
              if(other.id===s.id)return;
              const ods=(shifts[other.id]||{})[d]||[];
              ods.forEach(osh=>{
                if(osh.deviceId!==sh.deviceId)return;
                // If both have time slots, check overlap
                if(sh.deviceStart&&sh.deviceEnd&&osh.deviceStart&&osh.deviceEnd){
                  // Overlap if start < other end AND end >other start
                  if(sh.deviceStart<osh.deviceEnd&&sh.deviceEnd>osh.deviceStart)devConflict=true;
                }else{
                  // No time slots — it's a conflict
                  devConflict=true;
                }
              });
            });
          }
          const stCls = sh._status==='open' ? ' shift-openpick' : (sh._status==='pending_release' ? ' shift-pendrel' : '');
          const stTag = sh._status==='open' ? '<br><span class="sb-tag">OPEN FOR PICKUP</span>'
                      : (sh._status==='pending_release' ? '<br><span class="sb-tag">RELEASE ASKED</span>' : '');
          html+=`<div class="shift-badge ${il?'shift-leave':'shift-slot'}${stCls}" ${il?'':`style="${sh._team?'background:rgba(245,158,11,.28);border-left:3px solid #f59e0b;box-shadow:0 0 0 1px rgba(245,158,11,.55) inset;':`background:${s.color}1a;border-left:3px solid ${s.color};`}" draggable="true" onmousedown="shiftBadgeDown(${s.id},${d},${i})" ondragstart="shiftDragStart(event,${s.id},${d},${i})" ondragend="shiftDragEnd(event)"`} onclick="event.stopPropagation();${il?'editShift':'shiftBadgeClick'}(${s.id},${d},${i})">${il?'LEAVE':`<b class="sb-time">${sh.start}–${sh.end}</b>`}${(!il&&sh._team)?`<span class="sb-xteam" title="Works for the ${sh._team} team">FOR ${String(sh._team).toUpperCase()}</span>`:''}${stTag}${(!il&&sh._dbId&&_rcnPending[sh._dbId])?'<span title="Change not yet seen by '+s.first+'" style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#f59e0b;margin-left:4px;vertical-align:middle"></span>':''}${dev?`<br><span style="font-size:8px;opacity:.85;color:${devConflict?'#ff6432':'inherit'}"> ${dev.name}${sh.deviceStart?` ${sh.deviceStart}–${sh.deviceEnd}`:''}${devConflict?' ':''}</span>`:`${staffRoleLabel(s)?`<br><span style="font-size:8px;opacity:.7">${staffRoleLabel(s)}</span>`:''}`}</div>`;
        });
        html+='</div>';
      }
      html+='</div>';
    });
  });
  // Keep the page still while the week changes. The grid is re-drawn several times in quick succession (once
  // straight away, again when availability and the shifts arrive), and a draw that is briefly shorter made the
  // browser pull the page up and then push it back. Hold the old height and scroll position until things settle.
  const _sc=(function(n){ while(n&&n!==document.body){ const o=getComputedStyle(n).overflowY; if((o==='auto'||o==='scroll')&&n.scrollHeight>n.clientHeight) return n; n=n.parentElement; } return document.scrollingElement; })(grid);
  const _top=_sc?_sc.scrollTop:0;
  const _h=grid.offsetHeight;
  if(_h>0){ grid.style.minHeight=Math.max(_h,parseFloat(grid.style.minHeight)||0)+'px'; }
  grid.innerHTML=html;
  if(_sc&&_sc.scrollTop!==_top) _sc.scrollTop=_top;
  clearTimeout(window.__rgHold);
  window.__rgHold=setTimeout(function(){ grid.style.minHeight=''; },900);
  // Totals must track every render — editing a shift changes them too.
  try{ if(typeof renderWeekTotal==='function') renderWeekTotal(); }catch(e){}
  const wl=`${fmtDate(currentWeekStart)} – ${fmtDate(addDays(currentWeekStart,6))}`;
  document.getElementById('weekLabel').textContent=wl;
  const tb=document.getElementById('topbarWeek');
  if(tb){tb.textContent=wl;tb.style.display='';}
  updateStats();
  try{ if(typeof applyTeamLeadLock==='function' && document.body.classList.contains('tl-readonly')) applyTeamLeadLock(); }catch(e){}
}

function _shiftTeamFill(staffId, value){
  var sel=document.getElementById('shiftTeam'); if(!sel) return;
  var own=''; try{ var st=(staff||[]).find(function(x){return x.id===staffId;}); own=(st&&st.team)||''; }catch(e){}
  var list=(teams||[]).slice(); if(value && list.indexOf(value)<0) list.push(value);
  sel.innerHTML='<option value="">'+(own?('Their own team ('+own+')'):'Their own team')+'</option>'+
    list.filter(function(t){return t!==own;}).sort().map(function(t){return '<option value="'+t+'"'+(t===value?' selected':'')+'>'+t+'</option>';}).join('');
  sel.value=value||'';
}
function clickCell(staffId,day){
  editingShift=null;
  document.getElementById('shiftModalTitle').textContent='Assign Shift';
  document.getElementById('shiftDeleteBtn').style.display='none';
  populateStaffSelect('shiftStaff',staffId);
  document.getElementById('shiftDay').value=day;
  document.getElementById('shiftStart').value='09:00';
  document.getElementById('shiftEnd').value='19:00';
  document.getElementById('shiftType').value='shift';
  document.getElementById('shiftRole').value='';
  _shiftTeamFill(staffId,'');
  document.getElementById('shiftWeek').value='w1';
  populateShiftDeviceSelect(null);
  onShiftTypeChange(document.getElementById('shiftType'));
  renderShiftPickupBox(null);   // new shift: nothing to open for pickup yet
  openModal('shiftModal');
}

function editShift(staffId,dayIdx,shiftIdx){
  editingShift={staffId,dayIdx,shiftIdx,week:'w1'};
  const sh=shifts[staffId][dayIdx][shiftIdx];
  document.getElementById('shiftModalTitle').textContent='Edit Shift';
  document.getElementById('shiftDeleteBtn').style.display='';
  populateStaffSelect('shiftStaff',staffId);
  document.getElementById('shiftDay').value=dayIdx;
  document.getElementById('shiftStart').value=sh.start||'09:00';
  document.getElementById('shiftEnd').value=sh.end||'19:00';
  document.getElementById('shiftType').value=sh.type==='leave'?'leave':'shift';
  document.getElementById('shiftRole').value=sh.role||'';
  _shiftTeamFill(staffId,sh._team||'');
  document.getElementById('shiftWeek').value='w1';
  populateShiftDeviceSelect(sh.deviceId||null);
  onShiftTypeChange(document.getElementById('shiftType'));
  renderShiftPickupBox(sh);
  openModal('shiftModal');
}

function weekKey(date){return fmtDate(getMonday(date));}

function saveCurrentWeek(){
  const key=_canonicalWeekKey(availWeekKey||weekKey(currentWeekStart));
  // Shifts are NOT written to the blob any more — roster_shifts is the source
  // of truth, and the grid is populated from it by loadWeekShiftsFromDB().
  // Copying them back here would build a second, stale copy of every roster
  // inside shiftops_data and re-inflate the history snapshots we just fixed.
  // Leave is likewise never stored: it's derived at render time from
  // leave_submissions by _syncWeekLeavesToSubmissions().
  availStore[key]=JSON.parse(JSON.stringify(availability));
}

// Canonicalize all shiftsStore / availStore keys to the short-month format that
// fmtDate() produces, so read (loadWeek) and write (saveCurrentWeek) always agree.
function _canonicalWeekKey(key){
  const monthsLong=['january','february','march','april','may','june','july','august','september','october','november','december'];
  const monthsShort=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const parts=String(key).trim().split(/\s+/);
  if(parts.length!==2) return key;
  const day=parts[0].replace(/\D/g,'');
  const mraw=parts[1].toLowerCase();
  let idx=monthsLong.indexOf(mraw);
  if(idx<0) idx=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(mraw.slice(0,3));
  if(idx<0 || !day) return key;
  return day+' '+monthsShort[idx];   // e.g. "29 Jun"
}
function _normalizeStoreKeys(){
  ['shiftsStore','availStore'].forEach(function(storeName){
    const store=(storeName==='shiftsStore')?shiftsStore:availStore;
    if(!store || typeof store!=='object') return;
    Object.keys(store).forEach(function(k){
      const canon=_canonicalWeekKey(k);
      if(canon===k) return;
      if(!store[canon]){
        // No canonical version yet — just move it.
        store[canon]=store[k];
      }else{
        // BOTH formats exist for the same week — DEEP MERGE so no data is lost.
        // Merge per-staff, per-day; keep any day that has data, prefer the
        // version that actually has shifts/leave for that day.
        const dst=store[canon], src=store[k];
        Object.keys(src||{}).forEach(function(sid){
          if(!dst[sid]){ dst[sid]=src[sid]; return; }
          Object.keys(src[sid]||{}).forEach(function(di){
            const srcDay=src[sid][di];
            const dstDay=dst[sid][di];
            const srcHas=Array.isArray(srcDay)&&srcDay.length;
            const dstHas=Array.isArray(dstDay)&&dstDay.length;
            if(srcHas && !dstHas){ dst[sid][di]=srcDay; }
            else if(srcHas && dstHas){
              // union, de-duped by start+end+type
              const seen={}; const merged=[];
              dstDay.concat(srcDay).forEach(function(sh){
                const key=(sh.type||'')+'|'+(sh.start||'')+'|'+(sh.end||'');
                if(!seen[key]){ seen[key]=1; merged.push(sh); }
              });
              dst[sid][di]=merged;
            }
          });
        });
      }
      delete store[k];
    });
  });
}
// Resolve a week key against shiftsStore tolerating month-format drift.// Legacy data mixed "29 Jun" (short) and "29 June" (long) — match either.
function _resolveStoreKey(key){
  // Collect ALL format-variants of this week that exist in the store, then pick
  // the one holding the most staff data. This is defensive: if duplicate keys
  // ("13 Jul" + "13 July") ever coexist, we must never return the emptier one
  // (that made the whole roster appear to vanish on load).
  const monthsLong=['january','february','march','april','may','june','july','august','september','october','november','december'];
  const monthsShort=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const norm=function(s){ return String(s).trim().toLowerCase().replace(/\s+/g,' '); };
  const want=norm(key);
  const wp=want.split(' ');
  const variants=[];
  if(shiftsStore[key]) variants.push(key);
  Object.keys(shiftsStore).forEach(function(k){
    if(k===key) return;
    const kn=norm(k); const kp=kn.split(' ');
    // same day + same month (first 3 letters) = same week, different format
    if(wp.length===2 && kp.length===2 && wp[0]===kp[0] && kp[1].slice(0,3)===wp[1].slice(0,3)){
      variants.push(k);
    }
  });
  if(!variants.length) return null;
  if(variants.length===1) return variants[0];
  // Multiple variants — return the one with the most ACTUAL SHIFT DATA.
  //
  // This used to count staff-ID keys, which is not the same thing and picked
  // exactly the wrong variant: saveCurrentWeek() writes an empty {} shell for
  // every staff member, so a week with no shifts still carries 33 keys, while
  // the legacy long-form key holding the real roster might carry only 6. The
  // count said 33 > 6 and the blank week won — the roster "vanished".
  // Count populated day arrays instead, and break ties toward the variant that
  // has any data at all.
  const dataCount=function(k){
    let n=0;
    const wkObj=shiftsStore[k]||{};
    Object.keys(wkObj).forEach(function(sid){
      const byDay=wkObj[sid]||{};
      Object.keys(byDay).forEach(function(d){
        if(Array.isArray(byDay[d]) && byDay[d].length) n++;
      });
    });
    return n;
  };
  let best=variants[0], bestCnt=-1;
  variants.forEach(function(k){
    const cnt=dataCount(k);
    if(cnt>bestCnt){ bestCnt=cnt; best=k; }
  });
  return best;
}
/* ── roster_shifts: the real shift source ─────────────────────────────────
   Shifts now live in the roster_shifts table (keyed by staff_name + a real
   date), not in the shiftsStore blob. The blob held no real shifts — only
   stale leave fossils — so this overlay is additive, not a migration.

   The grid renderer is unchanged: we just populate the same
   shifts[staffId][dayIndex] = [{start,end,type,role}] shape it already
   expects, tagging each block with its DB id so release/claim can act on it.
   ──────────────────────────────────────────────────────────────────────── */
function _isoDate(d){
  const p=new Date(d);
  return p.getFullYear()+'-'+String(p.getMonth()+1).padStart(2,'0')+'-'+String(p.getDate()).padStart(2,'0');
}
function _staffIdByName(){
  const m={};
  (staff||[]).forEach(function(s){
    const full=((s.first||'').trim()+' '+(s.last||'').trim()).trim();
    if(full) m[_normName(full)]=s.id;
  });
  return m;
}

let _dbShiftsLoading=false, _dbShiftsQueued=null, _dbShiftsFails=0;
/**
 * Keep the grid honest against changes made elsewhere.
 *
 * Shifts can change without ShiftOps doing anything: staff claim an open
 * shift in Nexus, or a leave approval releases one. Without this the grid
 * kept showing whatever it fetched on load — a claimed shift appeared to
 * vanish, or stayed under the old person's name until you switched weeks.
 * Refreshing on focus covers the realistic case (you tab away, something
 * happens, you come back) without polling.
 */
function startShiftAutoRefresh(){
  if(window._shiftRefreshBound) return;
  window._shiftRefreshBound=true;
  const refresh=function(){
    if(document.hidden) return;
    if(typeof currentWeekStart==='undefined') return;
    loadWeekShiftsFromDB(currentWeekStart);
  };
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', refresh);
  // Slow safety net for a window left open all day on the roster.
  setInterval(refresh, 120000);
}

function _rosterLoadBar(show){
  var el=document.getElementById('rosterLoadBar');
  if(!show){ if(el) el.remove(); return; }
  if(el) return;
  var grid=document.getElementById('rosterGrid'); if(!grid||!grid.parentNode) return;
  el=document.createElement('div'); el.id='rosterLoadBar'; el.setAttribute('role','alert');
  el.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 10px;padding:10px 14px;border-radius:10px;font-size:12.5px;font-weight:600;background:rgba(251,113,133,.12);border:1px solid rgba(251,113,133,.45);color:var(--text,inherit)';
  el.innerHTML='<span>Shifts didn\'t load for this week.</span><button class="btn btn-primary" style="padding:5px 12px" onclick="_dbShiftsFails=0;loadWeekShiftsFromDB(currentWeekStart)">Retry</button>';
  grid.parentNode.insertBefore(el,grid);
}
async function loadWeekShiftsFromDB(weekStart){
  // A load already running used to make this return silently, so switching week
  // mid-load (or a focus refresh landing at the wrong moment) left the new week
  // never fetched. Remember the latest request and run it when the current one ends.
  if(_dbShiftsLoading){ _dbShiftsQueued=weekStart; return; }
  _dbShiftsLoading=true;
  const wk=_isoDate(weekStart);
  try{
    // roster_shifts is readable by logged-in users only. With no live token the
    // anon key gets "200 OK, []" — which painted a blank roster until a reload.
    // Get a fresh token first, and treat "no live session" as a failure, not as
    // an empty week.
    let tok=null; try{ tok=await _soFreshTok(); }catch(e){}
    if(!tok || !_soTokAlive()) throw new Error('no live session');
    const from=wk, to=_isoDate(addDays(new Date(weekStart),6));
    const r=await fetch(SUPABASE_URL+'/rest/v1/roster_shifts'+
      '?select=id,staff_name,shift_date,start_time,end_time,role,works_for_team,status,open_to_team,release_requested_by'+
      '&shift_date=gte.'+from+'&shift_date=lte.'+to+'&order=shift_date.asc,start_time.asc',
      {headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+tok}});
    if(!r.ok) throw new Error('HTTP '+r.status);
    const rows=await r.json();
    if(!Array.isArray(rows)) throw new Error('bad response');
    // The user moved to another week while this was in flight: drop the result.
    if(_isoDate(currentWeekStart)!==wk) return;

    const byName=_staffIdByName();
    // Clear only non-leave blocks; leave is painted separately from
    // leave_submissions and must not be disturbed here.
    Object.keys(shifts||{}).forEach(function(sid){
      Object.keys(shifts[sid]||{}).forEach(function(di){
        const kept=(shifts[sid][di]||[]).filter(function(sh){return sh.type==='leave';});
        if(kept.length) shifts[sid][di]=kept; else delete shifts[sid][di];
      });
    });

    rows.forEach(function(row){
      const sid=byName[_normName(row.staff_name)];
      if(sid===undefined) return;                     // not on this roster
      const d=new Date(row.shift_date+'T00:00:00');
      const dow=d.getDay(); const di=(dow===0?6:dow-1);   // Mon=0 … Sun=6
      if(!shifts[sid]) shifts[sid]={};
      if(!shifts[sid][di]) shifts[sid][di]=[];
      shifts[sid][di].push({
        start:String(row.start_time||'').slice(0,5),
        end:String(row.end_time||'').slice(0,5),
        type:'shift',
        role:row.role||'',
        _team:row.works_for_team||'',
        _dbId:row.id,
        _status:row.status||'assigned',
        _openTeam:row.open_to_team||null,
        _releaseBy:row.release_requested_by||null
      });
    });

    _dbShiftsFails=0; _rosterLoadBar(false); _soSessionBanner(false);
    try{ loadChangeNotices(); }catch(_){}
    if(typeof renderRoster==='function') renderRoster();
    if(typeof updateStats==='function') updateStats();
    if(typeof renderPublishState==='function') renderPublishState();
  }catch(e){
    console.warn('loadWeekShiftsFromDB failed', e);
    _dbShiftsFails++;
    // Quietly retry a few times (token still settling, brief network drop)
    // before bothering anyone; then leave a visible Retry bar instead of a
    // blank grid that looks like an empty week.
    if(_dbShiftsFails<=3){ setTimeout(function(){ try{ loadWeekShiftsFromDB(currentWeekStart); }catch(_){} }, 1200*_dbShiftsFails); }
    else{
      _rosterLoadBar(true);
      if(String(e&&e.message).indexOf('no live session')>=0){ try{ _soSessionBanner(true); }catch(_){} }
    }
  }finally{
    _dbShiftsLoading=false;
    if(_dbShiftsQueued){ const q=_dbShiftsQueued; _dbShiftsQueued=null; loadWeekShiftsFromDB(q); }
  }
}

function loadWeek(key){
  // The grid starts empty: real shifts arrive from roster_shifts via
  // loadWeekShiftsFromDB(), and leave is added at render time from
  // leave_submissions. The old shiftsStore path is gone — it held nothing but
  // stale leave fossils, and reading it is what made blank weeks overwrite
  // real ones (see _resolveStoreKey).
  shifts={};
  staff.forEach(s=>{if(!shifts[s.id])shifts[s.id]={};if(!availability[s.id])availability[s.id]={};});
}

/* ── ROSTER PUBLISHING ────────────────────────────────────────────────────
   A week is invisible to staff until it's published. That gives the manager
   a real draft state: build, shuffle, delete freely — nobody sees the churn.
   Publishing is one deliberate act, and the week spine shows plainly which
   state the visible week is in. Unpublishing is allowed (mistakes happen).
   ──────────────────────────────────────────────────────────────────────── */
let _pubWeeks=null;   // Set of published week_start ISO dates; null = not loaded

async function loadPublishedWeeks(){
  try{
    const r=await fetch(SUPABASE_URL+'/rest/v1/roster_published?select=week_start',
      {headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY}});
    if(!r.ok) throw new Error('HTTP '+r.status);
    const rows=await r.json();
    _pubWeeks=new Set((rows||[]).map(function(x){return x.week_start;}));
  }catch(e){
    console.warn('loadPublishedWeeks',e);
    _pubWeeks=_pubWeeks||new Set();   // keep whatever we had
  }
  renderPublishState();
}

function _curWeekISO(){ return _isoDate(currentWeekStart); }

function renderPublishState(){
  const pill=document.getElementById('pubPill');
  const btn=document.getElementById('pubBtn');
  if(!pill||!btn) return;
  if(_pubWeeks===null){ pill.textContent='…'; pill.className='ws-pill'; btn.style.display='none'; return; }
  const wk=_curWeekISO();
  const pub=_pubWeeks.has(wk);
  pill.textContent=pub?'Published':'Draft';
  pill.className='ws-pill '+(pub?'ws-pub':'ws-draft');
  btn.style.display='';
  // Deputy behaviour: the publish button tells you how much you're about to
  // release, and draft shifts render striped until you do.
  let n=0;
  try{ Object.values(shifts||{}).forEach(function(byDay){ Object.values(byDay||{}).forEach(function(arr){ (arr||[]).forEach(function(sh){ if(sh.type!=='leave') n++; }); }); }); }catch(e){}
  btn.textContent=pub?'Unpublish':(n?('Publish · '+n+' shift'+(n===1?'':'s')):'Publish week');
  btn.className='btn ws-publish '+(pub?'ws-publish-off':'ws-publish-on');
  const grid=document.getElementById('rosterGrid');
  if(grid) grid.classList.toggle('grid-draft', !pub);
  renderWeekTotal();
  try{ if(typeof waRender==='function' && document.getElementById('waCard') && _wa.wk===_isoDate(currentWeekStart) && !_wa.loading) waRender(); }catch(e){}
}

/**
 * Total rostered hours for the visible week, shown in the spine so it's
 * readable without scrolling past 33 rows. Excludes leave, same as every
 * other hours figure on this screen.
 */
function renderWeekTotal(){
  const el=document.getElementById('wsTotal');
  if(!el) return;
  let total=0, people=0;
  try{
    (staff||[]).forEach(function(s){
      const h=staffHoursWeek(s.id);
      if(h>0){ total+=h; people++; }
    });
  }catch(e){ el.textContent='—'; return; }
  el.textContent = total
    ? ((Math.round(total*10)/10).toString().replace(/\.0$/,'')+'h · '+people+' rostered')
    : 'Nothing rostered';
  el.classList.toggle('ws-total-empty', !total);
}

async function togglePublishWeek(){
  if(document.body.classList.contains('tl-readonly')) return;   // read-only leads can't edit
  if(_pubWeeks===null) return;
  const wk=_curWeekISO();
  const pub=_pubWeeks.has(wk);
  const btn=document.getElementById('pubBtn');
  if(btn) btn.disabled=true;
  try{
    if(pub){
      if(!confirm('Unpublish this week? Staff will stop seeing these shifts in Nexus.')){ if(btn) btn.disabled=false; return; }
      const r=await fetch(SUPABASE_URL+'/rest/v1/roster_published?week_start=eq.'+wk,
        {method:'DELETE',headers:_DB_H});
      if(!r.ok){
        const d=await r.text().catch(function(){return '';});
        console.error('[PUBLISH] unpublish HTTP '+r.status, d);
        showToast('Could not unpublish ('+r.status+')');
        if(btn) btn.disabled=false;
        return;
      }
      _pubWeeks.delete(wk);
      showToast('Week unpublished — hidden from staff');
    }else{
      const r=await fetch(SUPABASE_URL+'/rest/v1/roster_published',{
        method:'POST',
        headers:Object.assign({Prefer:'resolution=merge-duplicates,return=representation'},_DB_H),
        body:JSON.stringify({week_start:wk,
          published_by:(typeof currentUser!=='undefined'&&currentUser)?currentUser:null})
      });
      // Verify the row actually landed. Previously any failure fell through to
      // a "Published" toast, so the UI claimed success while the table stayed
      // empty — the worst possible outcome for a publish button.
      if(!r.ok){
        const d=await r.text().catch(function(){return '';});
        console.error('[PUBLISH] HTTP '+r.status, d);
        if(r.status===404)      showToast('Publish unavailable — server not ready, try again shortly');
        else if(r.status===401||r.status===403) showToast('Not allowed to publish');
        else                    showToast('Publish failed ('+r.status+')');
        if(btn) btn.disabled=false;
        return;
      }
      const rows=await r.json().catch(function(){return null;});
      if(!rows || !rows.length){
        console.error('[PUBLISH] no row returned', rows);
        showToast('Publish did not save — nothing was written');
        if(btn) btn.disabled=false;
        return;
      }
      console.log('[PUBLISH] week '+wk+' published', rows[0]);
      _pubWeeks.add(wk);
      showToast('Published — staff can now see this week');
    }
  }catch(e){
    console.warn('togglePublishWeek',e);
    showToast('Could not update — check connection');
  }
  if(btn) btn.disabled=false;
  renderPublishState();
}

/**
 * Copy last week's roster into the week you're looking at.
 *
 * This is how most weeks actually get built — last week plus adjustments —
 * and doing it one shift at a time across 30+ people was never realistic.
 *
 * Reads the SOURCE straight from roster_shifts rather than the in-memory
 * grid, so it can't copy a half-loaded view. Shifts land as brand new rows
 * (no _dbId carried across) in 'assigned' state: an open or pending-release
 * shift from last week copies as a normal assigned shift, because its
 * release belonged to that week, not this one. Leave is never copied — it
 * comes from leave_submissions.
 */
async function fillFromPreviousWeek(){
  if(document.body.classList.contains('tl-readonly')) return;   // read-only leads can't edit
  const target=new Date(currentWeekStart);
  const source=addDays(new Date(currentWeekStart),-7);
  const srcFrom=_isoDate(source), srcTo=_isoDate(addDays(new Date(source),6));
  const tgtFrom=_isoDate(target), tgtTo=_isoDate(addDays(new Date(target),6));
  const fmt=function(d){ return new Date(d+'T00:00:00').toLocaleDateString('en-AU',{day:'numeric',month:'short'}); };

  try{
    const [srcRes,tgtRes]=await Promise.all([
      fetch(SUPABASE_URL+'/rest/v1/roster_shifts?select=staff_name,shift_date,start_time,end_time,role,works_for_team'+
        '&shift_date=gte.'+srcFrom+'&shift_date=lte.'+srcTo,
        {headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY}}),
      fetch(SUPABASE_URL+'/rest/v1/roster_shifts?select=id'+
        '&shift_date=gte.'+tgtFrom+'&shift_date=lte.'+tgtTo,
        {headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY}})
    ]);
    if(!srcRes.ok) throw new Error('HTTP '+srcRes.status);
    const srcRows=await srcRes.json();
    const tgtRows=tgtRes.ok?await tgtRes.json():[];

    if(!srcRows.length){
      showToast('Nothing to copy — week of '+fmt(srcFrom)+' has no shifts');
      return;
    }
    // Adding on top of an existing week is how you end up with everyone
    // double-rostered, so say exactly what's about to happen.
    const msg='Copy '+srcRows.length+' shift'+(srcRows.length===1?'':'s')+
      ' from week of '+fmt(srcFrom)+' into week of '+fmt(tgtFrom)+'?'+
      (tgtRows.length?('\n\nThis week already has '+tgtRows.length+
        ' shift'+(tgtRows.length===1?'':'s')+'. Copies will be ADDED alongside them.'):'');
    if(!confirm(msg)) return;

    const payload=srcRows.map(function(r){
      const d=new Date(r.shift_date+'T00:00:00');
      d.setDate(d.getDate()+7);
      return {
        staff_name:r.staff_name,
        shift_date:_isoDate(d),
        start_time:r.start_time,
        end_time:r.end_time,
        role:r.role||null,
        works_for_team:r.works_for_team||null,
        status:'assigned',
        created_by:(typeof currentUser!=='undefined'&&currentUser)?currentUser:'copy-week',
        updated_by:(typeof currentUser!=='undefined'&&currentUser)?currentUser:'copy-week'
      };
    });

    // merge-duplicates lets the unique constraint absorb exact repeats
    // instead of failing the whole batch.
    // on_conflict is REQUIRED: the primary key is `id`, and PostgREST resolves
    // merge-duplicates against the PK unless told otherwise. Without it the
    // upsert tried a plain INSERT, hit roster_shifts_no_exact_dupe, and came
    // back 409 — so nothing copied.
    const r=await fetch(SUPABASE_URL+'/rest/v1/roster_shifts'+
      '?on_conflict=staff_name,shift_date,start_time,end_time',{
      method:'POST',
      headers:Object.assign({Prefer:'resolution=merge-duplicates,return=representation'},_DB_H),
      body:JSON.stringify(payload)
    });
    if(!r.ok){
      const d=await r.text().catch(function(){return '';});
      console.error('[FILL-WEEK] HTTP '+r.status, d);
      showToast('Copy failed ('+r.status+')');
      return;
    }
    const made=await r.json().catch(function(){return [];});
    showToast('Copied '+(made.length||payload.length)+' shifts into week of '+fmt(tgtFrom));
    loadWeekShiftsFromDB(currentWeekStart);
  }catch(e){
    console.warn('fillFromPreviousWeek',e);
    showToast('Could not copy the week — check connection');
  }
}

function switchWeek(newStart){
  console.log('[WEEK-DEBUG] switchWeek → from currentWeekStart="'+weekKey(currentWeekStart)+'" (availWeekKey="'+availWeekKey+'") to newStart="'+weekKey(newStart)+'"');
  saveCurrentWeek();
  currentWeekStart=newStart;
  availWeekKey=weekKey(currentWeekStart);
  console.log('[WEEK-DEBUG] switchWeek: after save, now availWeekKey="'+availWeekKey+'"');
  loadWeek(availWeekKey);
  // Re-pull availability for the newly-viewed week, so date-ranged windows are
  // validated against THIS week (not the week we were on before). Clear the
  // change-signature first so the guard doesn't skip the re-apply — the DB data
  // is the same, but the WEEK changed, which is what we need re-evaluated.
  if(typeof _syncAvailabilityCore==='function'){
    _lastAvailSig='';
    _syncAvailabilityCore(true).then(function(){ try{ renderRoster(); renderAvailability(); }catch(e){} });
  }
  // Shifts come from roster_shifts, not the blob — pull the new week.
  loadWeekShiftsFromDB(currentWeekStart);
  renderPublishState();
}

function prevWeek(){switchWeek(addDays(currentWeekStart,-7));renderRoster();updateStats();}
function nextWeek(){switchWeek(addDays(currentWeekStart,7));renderRoster();updateStats();}
function goToday(){console.log('[WEEK-DEBUG] === goToday clicked === today='+new Date().toString()+' getMonday(today)="'+weekKey(getMonday(new Date()))+'"');switchWeek(getMonday(new Date()));renderRoster();updateStats();}


