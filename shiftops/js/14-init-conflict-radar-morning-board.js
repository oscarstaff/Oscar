// ── PUBLISH ROSTER ────────────────────────────────────────────────────────


// ═══════════════════════════════════════════════════════════════
// ACCESS & ADMIN — master control (writes app_access + staff_settings)
// ═══════════════════════════════════════════════════════════════
const AA_SB='https://jcfgldqrdbfkgbixszds.supabase.co';
const AA_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZmdsZHFyZGJma2diaXhzemRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1Nzc3NzEsImV4cCI6MjA5MDE1Mzc3MX0.Wj8cCpnlsoZOPj5sKWeEdfvgjG4Nc-UuTTYgbcrPfeI';
async function aaGet(path){const r=await fetch(AA_SB+'/rest/v1/'+path,{headers:{apikey:AA_KEY,Authorization:'Bearer '+AA_KEY}});if(!r.ok)return[];return r.json();}
let aaCurrent='formcraft';
let aaAllStaff=[];
let aaWork={formcraft:new Set(),slip:new Set(),nex:new Set(),dialtrac:new Set(),borekade:new Set(),shiftops:new Set(),admin:new Set()};
let aaOrig={formcraft:new Set(),slip:new Set(),nex:new Set(),dialtrac:new Set(),borekade:new Set(),shiftops:new Set(),admin:new Set()};

function aaSwitch(app){
  aaCurrent=app;
  ['formcraft','slip','nex','borekade','shiftops','admin'].forEach(a=>{
    const t=document.getElementById('aatab-'+a);
    if(t)t.className='aa-tab'+(a===app?' aa-active':'');
  });
  // quick buttons
  const q=document.getElementById('aaQuick');
  q.innerHTML='<span style="font-size:11px;color:var(--text-dim);align-self:center;margin-right:4px;">Quick:</span>';
  const everyone=document.createElement('button');everyone.className='btn btn-ghost';everyone.style.cssText='padding:5px 11px;font-size:11px';everyone.textContent='Everyone';everyone.onclick=()=>{aaAllStaff.forEach(n=>aaWork[aaCurrent].add(n));aaRender(document.getElementById('aaSearch').value);};q.appendChild(everyone);
  // teams as quick-adds (from ShiftOps teams)
  try{(teams||[]).forEach(t=>{const b=document.createElement('button');b.className='btn btn-ghost';b.style.cssText='padding:5px 11px;font-size:11px';b.textContent=t;b.onclick=()=>{aaAddTeam(t);};q.appendChild(b);});}catch(e){}
  const clr=document.createElement('button');clr.className='btn btn-ghost';clr.style.cssText='padding:5px 11px;font-size:11px;color:#ff6b6b';clr.textContent='Clear';clr.onclick=()=>{aaWork[aaCurrent].clear();aaRender(document.getElementById('aaSearch').value);};q.appendChild(clr);
  document.getElementById('aaSearch').value='';
  aaRender('');
}
function aaAddTeam(team){
  // add all staff in this ShiftOps team (match by their full name)
  try{
    staff.filter(s=>s.team===team).forEach(s=>{
      const full=(s.first+' '+s.last).trim();
      // match against staff_names list if present, else add raw
      const match=aaAllStaff.find(n=>n.toLowerCase()===full.toLowerCase())||full;
      aaWork[aaCurrent].add(match);
    });
  }catch(e){}
  aaRender(document.getElementById('aaSearch').value);
}
function aaRender(filter){
  const c=document.getElementById('aaList');
  const f=(filter||'').toLowerCase();
  const sel=aaWork[aaCurrent];
  const list=aaAllStaff.filter(n=>n.toLowerCase().includes(f));
  const label=aaCurrent==='admin'?'Admin':aaCurrent;
  if(!list.length){c.innerHTML='<div style="text-align:center;color:var(--text-dim);padding:24px;font-size:13px;">No staff found in staff_names</div>';return;}
  c.innerHTML='';
  list.forEach(n=>{
    const on=sel.has(n);
    const row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:9px 12px;border-radius:9px;cursor:pointer;border:1px solid '+(on?'var(--accent)':'var(--border)')+';background:'+(on?'var(--accent-dim)':'transparent')+';';
    row.innerHTML='<span style="font-size:13px;font-weight:'+(on?'600':'400')+';">'+n+'</span><span style="font-size:16px;">'+(on?'':'')+'</span>';
    row.onclick=()=>{ if(sel.has(n))sel.delete(n); else sel.add(n); aaRender(filter); };
    c.appendChild(row);
  });
}
async function aaSave(){
  showToast('⏳ Saving…');
  const H={apikey:AA_KEY,Authorization:'Bearer '+AA_KEY};
  const HJ={...H,'Content-Type':'application/json'};
  const jobs=[];

  // ── app_access: formcraft, slip, dialtrac, borekade, shiftops ──
  for(const app of ['formcraft','slip','nex','borekade','shiftops']){
    const add=[...aaWork[app]].filter(n=>!aaOrig[app].has(n));
    const del=[...aaOrig[app]].filter(n=>!aaWork[app].has(n));
    add.forEach(n=>jobs.push(
      fetch(AA_SB+'/rest/v1/app_access',{method:'POST',headers:{...HJ,'Prefer':'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({app:app,staff_name:n})})
    ));
    del.forEach(n=>jobs.push(
      fetch(AA_SB+'/rest/v1/app_access?app=eq.'+encodeURIComponent(app)+'&staff_name=eq.'+encodeURIComponent(n),{method:'DELETE',headers:H})
    ));
  }

  // ── collect staff_settings changes per person, then ONE upsert each ──
  // (avoids racing two PATCH/POSTs on the same row for shift+hub)
  const settingsChanges={}; // name -> {is_hub_admin?, is_shift_admin?}
  const setFlag=(n,k,v)=>{ if(!settingsChanges[n])settingsChanges[n]={name:n}; settingsChanges[n][k]=v; };

  // ── ADMIN (merged): one Admin flag grants full rights —
  //    sets is_hub_admin + is_shift_admin true AND auto-grants ShiftOps access.
  const adminAdd=[...aaWork.admin].filter(n=>!aaOrig.admin.has(n));
  const adminDel=[...aaOrig.admin].filter(n=>!aaWork.admin.has(n));
  adminAdd.forEach(n=>{
    setFlag(n,'is_hub_admin',true); setFlag(n,'is_shift_admin',true);
    jobs.push(fetch(AA_SB+'/rest/v1/app_access',{method:'POST',headers:{...HJ,'Prefer':'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({app:'shiftops',staff_name:n})}));
    aaWork.shiftops.add(n);
  });
  adminDel.forEach(n=>{
    setFlag(n,'is_hub_admin',false); setFlag(n,'is_shift_admin',false);
  });

  // one write per changed person. PATCH the existing row (a POST upsert 409s
  // for anyone who already has a staff_settings row — see saveStaffAccess),
  // and only INSERT when there's no row to update.
  Object.values(settingsChanges).forEach(rec=>{
    jobs.push((async ()=>{
      const nm = rec.name;
      const body = {}; Object.keys(rec).forEach(k=>{ if(k!=='name') body[k]=rec[k]; });
      const pr = await fetch(AA_SB+'/rest/v1/staff_settings?name=eq.'+encodeURIComponent(nm),
        {method:'PATCH',headers:{...HJ,'Prefer':'return=representation'},body:JSON.stringify(body)});
      if(pr.ok){
        const rows = await pr.json().catch(()=>[]);
        if(rows && rows.length) return;
      }
      await fetch(AA_SB+'/rest/v1/staff_settings',{method:'POST',
        headers:{...HJ,'Prefer':'return=minimal'},body:JSON.stringify(rec)});
    })());
  });

  // ── fire all in parallel, wait for completion ──
  let failed=0;
  try{
    const results=await Promise.all(jobs.map(p=>p.then(r=>r.ok?true:r.text().then(t=>{console.warn('save fail',r.status,t);return false;})).catch(e=>{console.warn('save err',e);return false;})));
    failed=results.filter(x=>x===false).length;
  }catch(e){ failed=-1; }

  if(failed>0){
    showToast('Saved with '+failed+' error(s) — check staff_settings has a unique(name) constraint');
  }else{
    showToast('Access & admin updated');
  }

  // update originals to current so reopening reflects saved state (no false reverts)
  aaOrig={formcraft:new Set(aaWork.formcraft),slip:new Set(aaWork.slip),nex:new Set(aaWork.nex),dialtrac:new Set(aaWork.dialtrac),borekade:new Set(aaWork.borekade),shiftops:new Set(aaWork.shiftops),admin:new Set(aaWork.admin)};
  // re-render current tab so ticks reflect the (possibly cascaded) state
  aaRender(document.getElementById('aaSearch').value);
}

// ── INIT ──────────────────────────────────────────────────────────────────
/* ── Work allocation (Enrolment team) ─────────────────────────────────────
   Free-text desk / computer / role lines per day, typed like the weekly sheet.
   One row per (team, day, section) in work_allocations. Admins and the
   Enrolment team lead can edit (enforced by RLS, wa_can_write). Errors show
   inline in the card, never in a toast. */
var WA_TEAM='Enrolment';
var WA_SECS=[
  {k:'work',label:'Work allocation',ph:'One line per person, e.g.\nSupriya – Desk 1, PC 4, Enquiries\nNippu – Desk 2, PC 5, Follow-ups'},
  {k:'available',label:'Available',ph:'Who is free to help, one per line'},
  {k:'note',label:'Notes',ph:'Anything else for the day'}
];
var _wa={wk:null,rows:{},draft:{},sel:0,loading:false,err:'',msg:'',saving:false,failed:false};
function _waVisible(){ return true; }   // every ShiftOps user can read it
function _waCanEdit(){
  try{
    if(typeof AM_TEAM_LEAD!=='undefined' && AM_TEAM_LEAD && typeof _tlResolved!=='undefined' && _tlResolved){
      return String(MY_TEAM||'').trim().toLowerCase()===WA_TEAM.toLowerCase();
    }
  }catch(e){}
  return true;
}

function _waParse(body){
  /* "Front Desk - Baruna & Anurag" -> {role, names}. Lines with no separator keep names empty. */
  return String(body||'').split(/\r?\n/).map(function(l){return l.trim();}).filter(Boolean).map(function(l){
    var m=l.match(/^(.+?)\s*(?:[-–—:])\s+(.+)$/);
    if(!m) return {role:l,names:[],raw:l};
    var names=m[2].split(/\s*(?:&|,|\/|\+|\band\b)\s*/i).map(function(n){return n.trim();}).filter(Boolean);
    return {role:m[1].trim(),names:names,raw:l};
  });
}
function _waSame(a,b){
  a=String(a||'').trim().toLowerCase(); b=String(b||'').trim().toLowerCase();
  if(!a||!b) return false; if(a===b) return true;
  if(a.length<5||b.length<5||Math.abs(a.length-b.length)>1) return false;
  /* one typo allowed (Supria / Supriya) */
  var i=0; while(i<a.length&&i<b.length&&a[i]===b[i]) i++;
  if(a.length===b.length) return a.slice(i+1)===b.slice(i+1);
  var s=a.length<b.length?a:b, L=a.length<b.length?b:a;
  return s.slice(i)===L.slice(i+1);
}
function _waDate(i){ return _isoDate(addDays(new Date(currentWeekStart),i)); }
function _waKey(d,s){ return d+'|'+s; }
function _waEsc(t){ return String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _waDirtyKeys(){
  var out=[];
  Object.keys(_wa.draft).forEach(function(k){
    var cur=(_wa.rows[k]||'');
    if((_wa.draft[k]||'').replace(/\s+$/,'')!==cur.replace(/\s+$/,'')) out.push(k);
  });
  return out;
}
async function _waFetch(from,to){
  var tok=null; try{ tok=await _soFreshTok(); }catch(e){}
  if(!tok || !_soTokAlive()) throw new Error('You are not signed in right now. Refresh the page and sign in again.');
  var r=await fetch(SUPABASE_URL+'/rest/v1/work_allocations?select=alloc_date,section,body&team=eq.'+encodeURIComponent(WA_TEAM)+
    '&alloc_date=gte.'+from+'&alloc_date=lte.'+to,{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+tok}});
  if(!r.ok) throw new Error('Could not load work allocation (HTTP '+r.status+').');
  var rows=await r.json(); if(!Array.isArray(rows)) throw new Error('Could not load work allocation (bad response).');
  return rows;
}
async function waSync(force){
  var host=document.getElementById('waCard'); if(!host) return;
  if(!_waVisible()){ host.innerHTML=''; return; }
  var wk=_isoDate(currentWeekStart);
  if(!force && _wa.wk===wk && !_wa.failed){ if(!host.firstChild) waRender(); return; }
  if(_wa.loading) return;
  var weekChanged=_wa.wk!==wk;
  if(weekChanged){
    _wa.rows={}; _wa.err=''; _wa.msg='';
    var t=new Date(); var di=-1; for(var i=0;i<7;i++){ if(_waDate(i)===_isoDate(t)) di=i; }
    _wa.sel=di>=0?di:0;
  }
  _wa.wk=wk; _wa.loading=true; _wa.failed=false; waRender();
  try{
    var rows=await _waFetch(_waDate(0),_waDate(6));
    if(_wa.wk!==wk) return;
    var m={}; rows.forEach(function(r){ m[_waKey(r.alloc_date,r.section)]=r.body||''; });
    _wa.rows=m; _wa.err='';
  }catch(e){ _wa.err=String(e&&e.message||e); _wa.failed=true; }
  finally{ _wa.loading=false; waRender(); }
}
function waRender(){
  var host=document.getElementById('waCard'); if(!host) return;
  if(!_waVisible()){ host.innerHTML=''; return; }
  var d0=addDays(new Date(currentWeekStart),0), d6=addDays(new Date(currentWeekStart),6);
  var tabs='';
  for(var i=0;i<7;i++){
    var ds=_waDate(i), filled=false;
    WA_SECS.forEach(function(s){ var k=_waKey(ds,s.k); var v=(k in _wa.draft)?_wa.draft[k]:(_wa.rows[k]||''); if(v.trim()) filled=true; });
    tabs+='<button type="button" class="wa-tab'+(i===_wa.sel?' on':'')+'" onclick="waPick('+i+')">'+DAYS[i]+
      '<span class="wa-d">'+fmtDate(addDays(new Date(currentWeekStart),i))+'</span>'+(filled?'<i class="wa-dot" aria-label="has entries"></i>':'')+'</button>';
  }
  var ds=_waDate(_wa.sel), boxes='';
  WA_SECS.forEach(function(s){
    var k=_waKey(ds,s.k); var v=(k in _wa.draft)?_wa.draft[k]:(_wa.rows[k]||'');
    boxes+='<label class="wa-box"><span>'+s.label+'</span><textarea data-k="'+k+'" rows="'+(s.k==='work'?9:5)+'" placeholder="'+_waEsc(s.ph)+'" maxlength="6000" oninput="waType(this)"'+(_wa.loading?' disabled':'')+(_waCanEdit()?'':' readonly')+'>'+_waEsc(v)+'</textarea></label>';
  });
  var canEdit=_waCanEdit();
  var published=!!(_pubWeeks && _pubWeeks.has(_isoDate(currentWeekStart)));
  if(!canEdit && !published){
    host.innerHTML='<div class="wa-card"><div class="wa-title">Work allocation · '+WA_TEAM+' team</div><div class="wa-sub" style="margin-top:6px">It appears here once this week\'s roster is published.</div></div>';
    return;
  }
  var dirty=_waDirtyKeys().length;
  var status=_wa.err?'<div class="wa-err" role="alert">'+_waEsc(_wa.err)+(_wa.failed?' <button class="btn btn-ghost" style="padding:3px 10px" onclick="waSync(true)">Retry</button>':'')+'</div>'
    :(_wa.msg?'<div class="wa-ok">'+_waEsc(_wa.msg)+'</div>':'');
  host.innerHTML='<div class="wa-card"><div class="wa-head"><div><div class="wa-title">Work allocation · '+WA_TEAM+' team</div>'+
    '<div class="wa-sub">'+fmtDate(d0)+' – '+fmtDate(d6)+'. '+(canEdit?(published?'Staff can see it in Nexus on their shifts.':'<b>Staff can\'t see this yet.</b> It goes out when you publish the week.'):'Read only. The Enrolment lead and admins edit this.')+'</div></div>'+
    (canEdit?'<div class="wa-acts"><button class="btn btn-ghost" onclick="waCopyDay()">Copy from previous day</button>'+
    '<button class="btn btn-ghost" onclick="waCopyWeek()">Copy last week</button>'+
    '<button class="btn btn-primary" id="waSave" onclick="waSave()"'+((dirty&&!_wa.saving)?'':' disabled')+'>'+(_wa.saving?'Saving…':(dirty?'Save changes':'Saved'))+'</button></div>':'')+'</div>'+
    '<div class="wa-tabs">'+tabs+'</div>'+(_wa.loading?'<div class="wa-sub" style="padding:8px 0">Loading…</div>':'')+
    '<div class="wa-boxes">'+boxes+'</div>'+_waDigest(ds)+status+'</div>';
}
/* Digest for the selected day: by duty and by person, built from the lines as typed (drafts included). */
function _waDigest(ds){
  var k=_waKey(ds,'work'); var txt=(k in _wa.draft)?_wa.draft[k]:(_wa.rows[k]||'');
  var items=_waParse(txt).filter(function(x){return x.names.length;});
  if(!items.length) return '';
  var per={}, order=[];
  items.forEach(function(it){ it.names.forEach(function(n){ var key=n.toLowerCase(); if(!per[key]){ per[key]={n:n,r:[]}; order.push(key); } per[key].r.push(it.role); }); });
  order.sort();
  var byDuty=items.map(function(it){ return '<div class="wa-dg"><b>'+_waEsc(it.role)+'</b><span>'+_waEsc(it.names.join(' & '))+'</span></div>'; }).join('');
  var byPerson=order.map(function(key){ return '<div class="wa-dg"><b>'+_waEsc(per[key].n)+'</b><span>'+_waEsc(per[key].r.join(', '))+'</span></div>'; }).join('');
  return '<div class="wa-digest"><div><div class="wa-dh">By duty</div>'+byDuty+'</div><div><div class="wa-dh">By person</div>'+byPerson+'</div></div>';
}
function waPick(i){ _wa.sel=i; _wa.msg=''; waRender(); }
function waType(el){
  _wa.draft[el.getAttribute('data-k')]=el.value; _wa.msg='';
  var b=document.getElementById('waSave'); if(b && !_wa.saving){ var n=_waDirtyKeys().length; b.disabled=!n; b.textContent=n?'Save changes':'Saved'; }
}
function waCopyDay(){
  if(_wa.sel<1){ _wa.err='There is no previous day in this week to copy from. Use Copy last week instead.'; waRender(); return; }
  var from=_waDate(_wa.sel-1), to=_waDate(_wa.sel), n=0;
  WA_SECS.forEach(function(s){
    var fk=_waKey(from,s.k), tk=_waKey(to,s.k);
    var src=(fk in _wa.draft)?_wa.draft[fk]:(_wa.rows[fk]||'');
    var cur=(tk in _wa.draft)?_wa.draft[tk]:(_wa.rows[tk]||'');
    if(src.trim() && !cur.trim()){ _wa.draft[tk]=src; n++; }
  });
  _wa.err=''; _wa.msg=n?'Copied from '+DAYS[_wa.sel-1]+'. Press Save changes to keep it.':'Nothing to copy: '+DAYS[_wa.sel-1]+' is empty, or this day already has entries.';
  waRender();
}
async function waCopyWeek(){
  _wa.err=''; _wa.msg='';
  try{
    var prevMon=addDays(new Date(currentWeekStart),-7);
    var rows=await _waFetch(_isoDate(prevMon),_isoDate(addDays(prevMon,6)));
    var n=0;
    rows.forEach(function(r){
      var d=_isoDate(addDays(new Date(r.alloc_date+'T00:00:00'),7)), k=_waKey(d,r.section);
      var cur=(k in _wa.draft)?_wa.draft[k]:(_wa.rows[k]||'');
      if((r.body||'').trim() && !cur.trim()){ _wa.draft[k]=r.body; n++; }
    });
    _wa.msg=n?'Copied last week into the empty days. Press Save changes to keep it.':'Nothing to copy: last week has no entries, or this week is already filled.';
  }catch(e){ _wa.err=String(e&&e.message||e); }
  waRender();
}
async function waSave(){
  var keys=_waDirtyKeys(); if(!keys.length||_wa.saving) return;
  _wa.saving=true; _wa.err=''; _wa.msg=''; waRender();
  var up=[], del=[];
  keys.forEach(function(k){
    var p=k.split('|'), body=(_wa.draft[k]||'').replace(/\s+$/,'');
    if(body.trim()) up.push({team:WA_TEAM,alloc_date:p[0],section:p[1],body:body});
    else if(_wa.rows[k]) del.push(p);
  });
  var fail='';
  try{
    var tok=await _soFreshTok();
    if(!tok || !_soTokAlive()) throw new Error('You are not signed in right now. Refresh the page and sign in again.');
    var H={apikey:SUPABASE_KEY,Authorization:'Bearer '+tok,'Content-Type':'application/json'};
    if(up.length){
      var r=await fetch(SUPABASE_URL+'/rest/v1/work_allocations?on_conflict=team,alloc_date,section',
        {method:'POST',headers:Object.assign({Prefer:'resolution=merge-duplicates,return=minimal'},H),body:JSON.stringify(up)});
      if(!r.ok){ var t=await r.text().catch(function(){return '';});
        fail=(r.status===401||r.status===403)?'You do not have permission to edit the '+WA_TEAM+' work allocation. Only admins and the '+WA_TEAM+' team lead can.':'Could not save (HTTP '+r.status+'). '+t.slice(0,160); }
    }
    for(var i=0;i<del.length && !fail;i++){
      var rd=await fetch(SUPABASE_URL+'/rest/v1/work_allocations?team=eq.'+encodeURIComponent(WA_TEAM)+'&alloc_date=eq.'+del[i][0]+'&section=eq.'+del[i][1],{method:'DELETE',headers:H});
      if(!rd.ok) fail='Could not clear an emptied box (HTTP '+rd.status+').';
    }
  }catch(e){ fail=String(e&&e.message||e); }
  _wa.saving=false;
  if(fail){ _wa.err=fail; waRender(); return; }
  keys.forEach(function(k){ var b=(_wa.draft[k]||'').replace(/\s+$/,''); if(b.trim()) _wa.rows[k]=b; else delete _wa.rows[k]; });
  _wa.draft={}; _wa.msg='Saved. Enrolment staff can now see it in Nexus.'; waRender();
}

const SHIFTOPS_BUILD='2026-11-28-v58-enrolment-roster-maker';
console.log('%c[ShiftOps build '+SHIFTOPS_BUILD+' loaded]','background:#0071e3;color:#fff;padding:2px 8px;border-radius:4px;font-weight:700;');
// Start every session in the FULL (admin) view. The team-lead read-only lock is
// only ever added later, and only once the role is positively confirmed as team
// lead (see applyTeamLeadLock). This guarantees no team-lead flash at startup for
// admins whose role data hasn't finished loading yet.
try{ document.body.classList.remove('tl-readonly'); }catch(e){}
// Failsafe: never let the loading overlay trap the UI, even if boot throws.
setTimeout(function(){ try{ var b=document.getElementById('soBootLoading'); if(b) b.style.display='none'; }catch(e){} }, 12000);
(async()=>{
  await loadData();
  // Data's in — drop the loading screen so the dashboard shows its real state
  // instead of a blank/half-built view during the multi-second fetch+retry.
  try{ var _bl=document.getElementById('soBootLoading'); if(_bl) _bl.style.display='none'; }catch(e){}
  // Open on the week to work on: normally the week containing TODAY, but from
  // Saturday 8am through Sunday, jump to NEXT week so the upcoming availability
  // is visible and the roster can be built over the weekend. availWeekKey stays
  // in lockstep (derived from currentWeekStart below), avoiding the wrong-week
  // desync described above.
  currentWeekStart=_defaultRosterWeekStart();
  availWeekKey=weekKey(currentWeekStart);
  loadWeek(availWeekKey);
  renderAll();
  // Real shifts live in roster_shifts, not the blob — pull this week's.
  loadWeekShiftsFromDB(currentWeekStart);
  try{ startShiftAutoRefresh(); }catch(e){ console.warn('shift auto-refresh', e); }
  loadPublishedWeeks();
  // Payroll is Accounts-only. The nav entry stays hidden otherwise; the real
  // boundary is the RLS policy on payroll_rates, which returns nothing to
  // anyone whose auth_uid isn't on the Accounts team.
  // Runs once here AND again shortly after, because _canPayroll() resolves the
  // team from the `staff` array — if the roles/staff fetch hasn't settled yet
  // the first check fails and the tab stays hidden for someone entitled to it.
  window.refreshPayrollNav = function(){
    try{
      const pb=document.getElementById('navPayroll');
      if(!pb) return;
      const ok = (typeof _canPayroll==='function') && _canPayroll();
      pb.style.display = ok ? '' : 'none';
      if(ok) console.log('[PAYROLL] tab available');
    }catch(e){}
  };
  refreshPayrollNav();
  setTimeout(function(){ try{ refreshPayrollNav(); }catch(e){} }, 1500);
  try{ applyTeamLeadLock(); }catch(e){}
  // Open the section named in the URL hash, defaulting to Home (which starts
  // the Morning Board). Replaces the old unconditional board start.
  try{ applyHashNav(); }catch(e){ console.warn('hash nav', e); }
  // React to browser back/forward and manual hash edits.
  window.addEventListener('hashchange', function(){ try{ applyHashNav(); }catch(e){} });
  // Push staff names to Supabase for the web form
  pushStaffNames();
  updateSaveStatus();
  try{ startAutoAvailabilitySync(); }catch(e){ console.warn('auto avail sync', e); }
  // Populate the Health badge in the background so problems are visible without
  // opening the tab.
  setTimeout(function(){ try{ loadHealthChecks(); }catch(e){} }, 3000);
})();

/* ═══════════════════════════════════════════════════════════════════
   CONFLICT RADAR + DRAG/DROP + SMART PASTE
   ═══════════════════════════════════════════════════════════════════ */
let _drag = null;          // {sid, day, idx, shift}
const WEEK_HOUR_CAP = 38;  // full-time threshold for "overloaded" warning

/* Evaluate dropping onto (sid,day): returns 'ok' | 'warn' | 'block' + reason */
function radarCheck(sid, day, shift){
  const s = staff.find(x=>x.id===sid);
  if(!s) return {level:'block', why:'unknown staff'};

  // 1. Leave that day → hard block
  const dayShifts = (shifts[sid] && shifts[sid][day]) || [];
  if(dayShifts.some(x=>x.type==='leave')) return {level:'block', why:'on leave'};

  // 2. Marked unavailable → hard block
  const av = getAvail(sid, day);
  if(av && av.type==='no') return {level:'block', why:'unavailable'};

  // 3. Already has a shift that day → warn (double-booking)
  if(dayShifts.length>0) return {level:'warn', why:'already rostered'};

  // 4. Would exceed weekly cap → warn
  let hrs = 0;
  for(let d=0; d<7; d++){
    ((shifts[sid]&&shifts[sid][d])||[]).forEach(x=>{
      if(x.type==='leave'||!x.start||!x.end) return;
      hrs += shiftHours(x);
    });
  }
  const addHrs = shift && shift.start && shift.end ? shiftHours(shift) : 0;
  if(hrs + addHrs > WEEK_HOUR_CAP) return {level:'warn', why:`over ${WEEK_HOUR_CAP}h`};

  // 5. Custom availability window mismatch → warn
  if(av && av.type==='custom' && shift && shift.start && shift.end){
    if(shift.start < av.start || shift.end > av.end)
      return {level:'warn', why:`outside ${av.start}–${av.end}`};
  }
  return {level:'ok', why:'available'};
}
function shiftHours(x){
  if(!x.start||!x.end) return 0;
  const [h1,m1]=x.start.split(':').map(Number), [h2,m2]=x.end.split(':').map(Number);
  let h=(h2+m2/60)-(h1+m1/60); if(h<0)h+=24; return h;
}

/* Paint the whole grid with radar shading for the dragged shift */
function radarPaint(shift){
  document.querySelectorAll('.shift-cell[data-sid]').forEach(cell=>{
    const sid = parseInt(cell.dataset.sid,10), day = parseInt(cell.dataset.day,10);
    const r = radarCheck(sid, day, shift);
    cell.classList.remove('radar-ok','radar-warn','radar-block');
    cell.classList.add('radar-'+r.level);
    cell.setAttribute('data-why', r.why);
  });
  document.body.classList.add('radar-on');
}
function radarClear(){
  document.body.classList.remove('radar-on');
  document.querySelectorAll('.shift-cell').forEach(c=>{
    c.classList.remove('radar-ok','radar-warn','radar-block','radar-hover');
    c.removeAttribute('data-why');
  });
}

/* ── Drag handlers ── */
/* ── Shift badge gestures ─────────────────────────────────────────────────
   single click  → edit the shift (after a short pause, so a double-click
                   can be told apart)
   drag          → COPY to the cell you drop on; the original stays
   double-click  → pick the shift up for TRANSFER: the next cell you click
                   gets it and it leaves its old place (Esc cancels).
                   Double-click-and-drag also transfers. */
let _sbEditTimer=null, _sbEditKey=null, _sbLastDown={k:null,t:0}, _sbArmed=null, _pickup=null;
function _sbCancelEdit(){ if(_sbEditTimer){ clearTimeout(_sbEditTimer); _sbEditTimer=null; _sbEditKey=null; } }
function shiftBadgeDown(sid,day,idx){
  const k=sid+'|'+day+'|'+idx, now=Date.now();
  _sbArmed = (_sbLastDown.k===k && now-_sbLastDown.t<380) ? k : null;   // 2nd press of a double-click
  _sbLastDown={k:k,t:now};
}
function shiftBadgeClick(sid,day,idx){
  const k=sid+'|'+day+'|'+idx;
  if(_pickup){ _pickupDrop(sid,day); return; }            // dropping onto a cell that already has shifts
  if(_sbEditTimer && _sbEditKey===k){ _sbCancelEdit(); _sbArmed=null; _pickupStart(sid,day,idx); return; }
  _sbCancelEdit();
  _sbEditKey=k;
  _sbEditTimer=setTimeout(function(){ _sbEditTimer=null; _sbEditKey=null; editShift(sid,day,idx); }, 300);
}
function _pickupStart(sid,day,idx){
  if(document.body.classList.contains('tl-readonly')) return;
  const sh=((shifts[sid]||{})[day]||[])[idx];
  if(!sh || sh.type==='leave') return;
  _pickup={sid:sid,day:day,idx:idx,shift:JSON.parse(JSON.stringify(sh))};
  try{ radarPaint(_pickup.shift); }catch(e){}
  document.body.classList.add('so-pickup');
  showToast('Transferring '+sh.start+'–'+sh.end+' — click where it should go (Esc to cancel)');
}
function _pickupCancel(msg){
  _pickup=null; document.body.classList.remove('so-pickup');
  try{ radarClear(); }catch(e){}
  if(msg) showToast(msg);
}
function _pickupDrop(sid,day){
  const p=_pickup; if(!p) return;
  if(sid===p.sid && day===p.day){ _pickupCancel('Transfer cancelled'); return; }
  // reuse the drag-and-drop path exactly, as a MOVE
  _drag={sid:p.sid, day:p.day, idx:p.idx, shift:p.shift, copy:false};
  _pickup=null; document.body.classList.remove('so-pickup');
  cellDrop({preventDefault:function(){}}, sid, day);
}
// While a shift is picked up, a click on ANY roster cell drops it there
// (empty cells normally open "Assign shift", so intercept before that).
document.addEventListener('click',function(e){
  if(!_pickup) return;
  const cell=e.target.closest && e.target.closest('.shift-cell[data-sid]');
  if(!cell){ if(!(e.target.closest&&e.target.closest('.shift-badge'))) _pickupCancel('Transfer cancelled'); return; }
  e.stopPropagation(); e.preventDefault();
  _pickupDrop(parseInt(cell.getAttribute('data-sid'),10), parseInt(cell.getAttribute('data-day'),10));
}, true);
document.addEventListener('keydown',function(e){ if(e.key==='Escape' && _pickup) _pickupCancel('Transfer cancelled'); });

function shiftDragStart(e, sid, day, idx){
  if(document.body.classList.contains('tl-readonly')){ e.preventDefault(); return; }
  const shift = ((shifts[sid]||{})[day]||[])[idx];
  if(!shift || shift.type==='leave'){ e.preventDefault(); return; }
  // Plain drag COPIES (the original stays). Double-click-and-drag MOVES it.
  const _armed = _sbArmed===sid+'|'+day+'|'+idx;
  _sbCancelEdit(); _sbArmed=null;
  _drag = {sid, day, idx, shift:JSON.parse(JSON.stringify(shift)), copy:!_armed};
  e.dataTransfer.effectAllowed = 'copyMove';
  try{ e.dataTransfer.setData('text/plain', 'shift'); }catch(_){}
  e.target.classList.add('dragging');
  radarPaint(_drag.shift);
}
function shiftDragEnd(e){
  if(e && e.target) e.target.classList.remove('dragging');
  _drag=null; radarClear();
}
function cellDragOver(e, sid, day){
  if(!_drag) return;
  const r = radarCheck(sid, day, _drag.shift);
  if(r.level==='block'){ e.dataTransfer.dropEffect='none'; return; }  // can't drop
  e.preventDefault();
  e.dataTransfer.dropEffect = _drag.copy ? 'copy' : 'move';
  e.currentTarget.classList.add('radar-hover');
}
function cellDragLeave(e){ e.currentTarget.classList.remove('radar-hover'); }

function cellDrop(e, sid, day){
  e.preventDefault();
  if(!_drag){ radarClear(); return; }
  const r = radarCheck(sid, day, _drag.shift);
  if(r.level==='block'){ showToast(`Can't drop — ${r.why}`); radarClear(); _drag=null; return; }
  if(sid===_drag.sid && day===_drag.day){ radarClear(); _drag=null; return; }

  const isCopy = !!_drag.copy;
  if(!shifts[sid]) shifts[sid]={};
  if(!shifts[sid][day]) shifts[sid][day]=[];
  const _moved=JSON.parse(JSON.stringify(_drag.shift));
  if(isCopy){ delete _moved._dbId; delete _moved._status; }   // a copy is a NEW row
  shifts[sid][day].push(_moved);

  if(!isCopy){
    const src = (shifts[_drag.sid]||{})[_drag.day];
    if(src){ src.splice(_drag.idx,1); if(!src.length) delete shifts[_drag.sid][_drag.day]; }
  }

  // Persist: a move re-points the existing row at the new person/day, a copy
  // creates a new one. Leave blocks are never stored in roster_shifts.
  if(_moved.type!=='leave'){
    if(isCopy)            dbCreateShift(sid, day, _moved);
    else if(_moved._dbId) dbUpdateShift(_moved, sid, day);
    else                  dbCreateShift(sid, day, _moved);
  }
  const who = staff.find(x=>x.id===sid);
  showToast(`${isCopy?'Copied':'Moved'} shift → ${who?who.first:''} ${DAYS_SHORT[day]||''}${r.level==='warn'?` (${r.why})`:''}`);
  _drag=null; radarClear(); markDirty(); renderAll();
}
const DAYS_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

/* ── SMART PASTE: copy one staffer's whole week onto another ── */
let _copiedWeek = null;
function copyStaffWeek(sid){
  const src = shifts[sid]||{};
  _copiedWeek = JSON.parse(JSON.stringify(src));
  // never copy leave blocks — they belong to the person, not the pattern
  Object.keys(_copiedWeek).forEach(d=>{
    _copiedWeek[d] = (_copiedWeek[d]||[]).filter(x=>x.type!=='leave');
    // CRITICAL: strip the database identity. A copy must become NEW rows.
    // Carrying _dbId through meant a paste re-pointed the ORIGINAL row at the
    // new person — a copy that behaved like a cut.
    _copiedWeek[d].forEach(function(x){ delete x._dbId; delete x._status; delete x._openTeam; delete x._releaseBy; });
    if(!_copiedWeek[d].length) delete _copiedWeek[d];
  });
  const s = staff.find(x=>x.id===sid);
  const n = Object.values(_copiedWeek).reduce((a,b)=>a+b.length,0);
  showToast(n ? `Copied ${s?s.first:''}'s week (${n} shifts) — now paste onto someone` : 'That week has no shifts to copy');
  document.body.classList.toggle('paste-armed', n>0);
}
function pasteStaffWeek(sid){
  if(!_copiedWeek){ showToast('Nothing copied yet'); return; }
  const target = staff.find(x=>x.id===sid);
  let added=0, skipped=[];
  Object.keys(_copiedWeek).forEach(dk=>{
    const d = parseInt(dk,10);
    _copiedWeek[dk].forEach(sh=>{
      const r = radarCheck(sid, d, sh);
      if(r.level==='block'){ skipped.push(`${DAYS_SHORT[d]} (${r.why})`); return; }
      if(!shifts[sid]) shifts[sid]={};
      if(!shifts[sid][d]) shifts[sid][d]=[];
      const copy=JSON.parse(JSON.stringify(sh));
      delete copy._dbId; delete copy._status;      // belt and braces
      shifts[sid][d].push(copy);
      dbCreateShift(sid, d, copy);                  // persist — paste was memory-only
      added++;
    });
  });
  showToast(`Pasted ${added} shift${added===1?'':'s'} onto ${target?target.first:''}${skipped.length?` · skipped ${skipped.length} (${skipped.slice(0,2).join(', ')})`:''}`);
  document.body.classList.remove('paste-armed');
  _copiedWeek=null; markDirty(); renderAll();
}


/* ═══════════════════════════════════════════════════════════════════
   MORNING BOARD — today's reality vs the plan (live from clock_log)
   ═══════════════════════════════════════════════════════════════════ */
let _boardTimer = null;

function _todayIsoSydney(){
  // Sydney-local calendar date as YYYY-MM-DD
  const f = new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'});
  return f.format(new Date());
}
function _todayDayIndex(){
  // 0=Mon..6=Sun for Sydney today
  const wd = new Intl.DateTimeFormat('en-US',{timeZone:'Australia/Sydney',weekday:'short'}).format(new Date());
  return ({Mon:0,Tue:1,Wed:2,Thu:3,Fri:4,Sat:5,Sun:6})[wd] ?? 0;
}
function _hhmmSydney(iso){
  return new Intl.DateTimeFormat('en-GB',{timeZone:'Australia/Sydney',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(iso));
}
// Display clock times with the SAME 7-min / nearest-15 flexibility Nexus uses:
//   :00-07→:00  :08-22→:15  :23-37→:30  :38-52→:45  :53-59→next :00
// Applied to the Sydney wall-clock h:mm, so the board matches Nexus exactly.
function _hhmmFlexSydney(iso){
  const hhmm=_hhmmSydney(iso);            // "09:07" in Sydney time
  const parts=hhmm.split(':');
  let h=parseInt(parts[0],10), m=parseInt(parts[1],10);
  if(m<=7) m=0;
  else if(m<=22) m=15;
  else if(m<=37) m=30;
  else if(m<=52) m=45;
  else { m=0; h=(h+1)%24; }
  return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
}

/**
 * Dashboard strip — six numbers a manager wants before 9am.
 *
 * Deliberately NO percentage deltas. At 33 staff one person is 3%, so
 * "Present 23 ▲12.9%" would be noise dressed as insight; the reference design
 * leans on deltas because it's built for a 3,934-person company.
 *
 * Fed from the same lists the Morning Board builds, so the two can never
 * disagree with each other.
 */
function renderDashStrip(c){
  const el=document.getElementById('dashStrip');
  if(!el) return;
  // Team leads can't open the Employees/Leave area, so its cards shouldn't act
  // like buttons for them (the nav guard blocks it anyway — this avoids dead taps).
  const tlLocked=document.body.classList.contains('tl-readonly');
  const goRoster = "switchNav('roster',document.querySelectorAll('.nav-item')[1])";
  const goLeave  = tlLocked ? '' : "switchNav('staff',document.querySelectorAll('.nav-item')[3]);setTimeout(function(){showSubTab('leave');},80)";
  const tile=function(n,label,cls,go){
    return '<button class="ds-tile'+(n?(cls?' '+cls:''):' ds-zero')+'"'+(go?' onclick="'+go+'"':'')+'>'+
             '<div class="ds-num">'+n+'</div><div class="ds-lbl">'+label+'</div></button>';
  };
  el.innerHTML =
    tile(c.present,'On shift','',goRoster)+
    tile(c.late,'Late','ds-warn',goRoster)+
    tile(c.notIn,'Not clocked in','ds-warn','')+
    tile(c.leave,'On leave','',goLeave)+
    // Open shifts and Leave-to-action are centre-wide planning numbers a lead
    // can't action and can't be scoped to one team, so they're admin-only.
    (tlLocked ? '' :
      tile(c.open,'Open shifts','ds-gold',goRoster)+
      tile(c.pending,'Leave to action','ds-gold',goLeave));
  el.classList.toggle('strip-4', tlLocked);
}

/* ── DASHBOARD: FIND A PERSON ─────────────────────────────────────────────
   The most common HR action isn't reading a stat, it's "pull up Nabina" —
   what are they on this week, are they on leave, what's their number. This
   searches the staff you already have in memory (no round trip) and offers
   the three things you'd actually want next for that person.
   ──────────────────────────────────────────────────────────────────────── */
let _dfMatches = [];

function dashFindRun(q){
  const box=document.getElementById('dashFindResults');
  if(!box) return;
  q=(q||'').trim().toLowerCase();
  if(q.length<2){ box.innerHTML=''; box.classList.remove('show'); _dfMatches=[]; return; }

  const onLeaveNames=new Set((leaveRequests||[])
    .filter(function(r){
      if(r.status!=='approved') return false;
      const t=new Date(); t.setHours(0,0,0,0);
      const f=new Date((r.from||r.from_date||'')+'T00:00:00');
      const to=new Date((r.to||r.to_date||'')+'T00:00:00');
      return !isNaN(f)&&!isNaN(to)&&t>=f&&t<=to;
    })
    .map(function(r){ return _normName(r.staff_name||r.staffName||''); }));

  _dfMatches=(staff||[]).filter(function(s){
    // Team leads can only pull up their own team.
    if(typeof AM_TEAM_LEAD!=='undefined' && AM_TEAM_LEAD && MY_TEAM &&
       String(s.team||'').trim().toLowerCase()!==String(MY_TEAM).trim().toLowerCase()) return false;
    const full=(s.first+' '+s.last).toLowerCase();
    return full.indexOf(q)>-1 || (s.team||'').toLowerCase().indexOf(q)>-1;
  }).slice(0,6);

  if(!_dfMatches.length){
    box.innerHTML='<div class="df-empty">No one matches “'+_cdEsc(q)+'”.</div>';
    box.classList.add('show');
    return;
  }

  box.innerHTML=_dfMatches.map(function(s,i){
    const full=(s.first+' '+s.last).trim();
    const hrs=staffHoursWeek(s.id);
    const away=onLeaveNames.has(_normName(full));
    return '<div class="df-row'+(i===0?' df-first':'')+'">'+
      '<span class="avatar df-ava" style="background:'+(s.color||'#94a3b8')+'">'+initials(s)+'</span>'+
      '<span class="df-txt"><span class="df-name">'+_cdEsc(full)+'</span>'+
        '<span class="df-meta">'+_cdEsc(s.team||'No team')+' · '+
          (hrs?((Math.round(hrs*10)/10)+'h this week'):'nothing rostered')+
          (away?' · <b class="df-away">on leave today</b>':'')+'</span></span>'+
      '<span class="df-acts">'+
        '<button class="df-btn" onclick="dashFindGo(\'roster\',\''+_cdEsc(full)+'\')">Roster</button>'+
        (document.body.classList.contains('tl-readonly') ? '' :
          '<button class="df-btn" onclick="dashFindGo(\'leave\',\''+_cdEsc(full)+'\')">Leave</button>')+
        '<button class="df-btn df-btn-go" onclick="dashFindOpenProfile('+s.id+')">Profile</button>'+
      '</span>'+
    '</div>';
  }).join('');
  box.classList.add('show');
}

/** Enter opens the top match's roster; Escape clears. */
function dashFindKey(e){
  if(e.key==='Escape'){ e.target.value=''; dashFindRun(''); e.target.blur(); return; }
  if(e.key==='Enter' && _dfMatches.length){
    dashFindOpenProfile(_dfMatches[0].id);
  }
}

/** "Right now" coverage meter — present vs expected, as a glowing bar.
 *  present includes anyone clocked in (on-time or late); absent = expected,
 *  no punch. When nobody is expected yet (early morning, weekend) it hides. */
function renderCoverage(present, absent, late){
  const el=document.getElementById('coverage'); if(!el) return;
  const expected=present+absent;
  if(expected<=0){ el.hidden=true; el.innerHTML=''; return; }
  el.hidden=false;
  const pct=Math.round((present/expected)*100);
  // Full house is emerald; a gap is amber; a big gap glows rose.
  const state = absent===0 ? 'ok' : (pct>=80 ? 'ok' : (pct>=60 ? 'warn' : 'miss'));
  const lateBit = late>0 ? '<span class="cov-note">'+late+' clocked in late</span>' : '';
  el.className='coverage cov-'+state;
  el.innerHTML=
    '<div class="cov-top">'+
      '<span class="cov-h">On shift right now</span>'+
      '<span class="cov-count"><b>'+present+'</b> of '+expected+' expected'+
        (absent>0?' · <span class="cov-gap">'+absent+' not in</span>':'')+'</span>'+
    '</div>'+
    '<div class="cov-track"><div class="cov-fill" style="width:'+pct+'%"></div></div>'+
    '<div class="cov-foot"><span class="cov-pct">'+pct+'% covered</span>'+lateBit+'</div>';
}

/** Enter / the Profile button: open the employee profile overlay directly. */
function dashFindOpenProfile(id){
  const inp=document.getElementById('dashFind'); if(inp) inp.value='';
  const box=document.getElementById('dashFindResults');
  if(box){ box.innerHTML=''; box.classList.remove('show'); }
  _dfMatches=[];
  if(typeof openEmpProfile==='function') openEmpProfile(id);
}

/** Jump to the screen, already filtered to that person. */
function dashFindGo(where, name){
  const nav=document.querySelectorAll('.nav-item');
  if(where==='roster'){
    switchNav('roster',nav[1]);
    setTimeout(function(){
      const row=document.querySelector('#rosterGrid [data-staff-name="'+name+'"]')
             || Array.from(document.querySelectorAll('#rosterGrid .staff-name'))
                     .find(function(n){ return n.textContent.trim()===name; });
      if(row){ row.scrollIntoView({block:'center',behavior:'smooth'});
               const r=row.closest('.grid-row'); if(r){ r.classList.add('row-flash');
                 setTimeout(function(){ r.classList.remove('row-flash'); },1600); } }
    },260);
  }else if(where==='leave'){
    switchNav('staff',nav[3]);
    setTimeout(function(){ showSubTab('leave'); setTimeout(function(){ renderLeave(name); },80); },90);
  }else{
    switchNav('staff',nav[3]);
    setTimeout(function(){ showSubTab('list'); },90);
  }
  const inp=document.getElementById('dashFind');
  if(inp) inp.value='';
  const box=document.getElementById('dashFindResults');
  if(box){ box.innerHTML=''; box.classList.remove('show'); }
}

/** Switch between the dark Command Deck and the light Daylight theme. */
function toggleTheme(){
  const root=document.documentElement;
  const goLight = root.getAttribute('data-theme')!=='light';
  if(goLight) root.setAttribute('data-theme','light');
  else root.removeAttribute('data-theme');
  try{ localStorage.setItem('so_theme', goLight?'light':'dark'); }catch(e){}
}

// "/" focuses the finder from anywhere on the Dashboard.
document.addEventListener('keydown',function(e){
  if(e.key!=='/'||e.metaKey||e.ctrlKey) return;
  const t=e.target.tagName;
  if(t==='INPUT'||t==='TEXTAREA'||t==='SELECT') return;
  const home=document.getElementById('section-home');
  if(!home||!home.classList.contains('active')) return;
  const inp=document.getElementById('dashFind');
  if(inp){ e.preventDefault(); inp.focus(); }
});

// Open shifts aren't in any list the board builds, so fetch the count itself.
// Cheap (HEAD + count header) and cached on window for the strip to read.
async function _refreshOpenShiftCount(){
  try{
    const r=await fetch(SUPABASE_URL+'/rest/v1/roster_shifts?status=eq.open&select=id',
      {headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY,Prefer:'count=exact',Range:'0-0'}});
    const cr=r.headers.get('content-range')||'';
    const n=parseInt((cr.split('/')[1]||'0'),10);
    window._dashOpenShifts = isNaN(n)?0:n;
  }catch(e){ window._dashOpenShifts = window._dashOpenShifts||0; }
}

async function refreshMorningBoard(){
  // Resolve role first so the very first board render is already team-scoped for
  // a lead (it's latched, so this is a no-op once known).
  try{ if(typeof computeTeamLeadState==='function') computeTeamLeadState(); }catch(e){}
  try{ await _refreshOpenShiftCount(); }catch(e){}
  const host = document.getElementById('morningBoard');
  if(!host) return;
  const today = _todayIsoSydney();
  let punches = [];
  try{
    // IMPORTANT: append the Sydney offset (+10:00) so the lower bound is Sydney
    // midnight, not UTC midnight. Without it, PostgREST treats the bound as UTC,
    // which is 10:00 Sydney — silently hiding every clock-in before 10am.
    const r = await fetch(`${SUPABASE_URL}/rest/v1/clock_log?ts=gte.${today}T00:00:00%2B10:00&select=staff_name,action,ts&order=ts.asc&limit=500`,
      {headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY}});
    if(!r.ok) throw new Error('HTTP '+r.status);
    punches = await r.json();
  }catch(e){
    host.innerHTML = `<div class="mb-err">Live status unavailable — ${String(e.message||e)}</div>`;
    return;
  }

  // latest punch per person
  const last = {};
  punches.forEach(p=>{ last[_normName(p.staff_name)] = p; });

  // Class days still exist (the housekeeping roster uses them), but they no
  // longer affect punctuality — lateness is measured against the rostered shift
  // start for everyone, every day. So the board no longer needs to fetch the
  // class roster or per-date overrides here.
  const todayIso = today; // YYYY-MM-DD (Sydney)

  // Fresh availability per staff for TODAY, keyed by normalised name → day slot.
  // Fetched directly so the board never depends on the in-memory availability
  // object being populated yet. Used to skip people who are unavailable today.
  const availByName = {};
  try{
    const av = await _cdGet('staff_availability?select=staff_name,availability,is_ongoing,valid_from,valid_until');
    (av||[]).forEach(r=>{
      // Respect a date-ranged availability's validity window.
      if(r.is_ongoing===false){
        if(r.valid_from && todayIso < r.valid_from) return;
        if(r.valid_until && todayIso > r.valid_until) return;
      }
      availByName[_normName(r.staff_name)] = r.availability || null;
    });
  }catch(e){ /* fall back to in-memory availability below */ }

  const dayIdx = _todayDayIndex();

  // The board describes TODAY, so it must read the week that actually contains
  // today — not whatever week the roster happens to be parked on. Viewing next
  // week used to make the board index that week by today's day-of-week, so a
  // future leave landing on the same weekday showed as "on leave" right now
  // (e.g. leave on Fri 7 Aug displayed on Fri 31 Jul).
  // When the viewed week IS this week, keep using the live `shifts` object so
  // unsaved edits are reflected; otherwise read this week from the store.
  let _todayShifts = shifts;
  try{
    const _todayWk = _canonicalWeekKey(weekKey(new Date()));
    const _viewWk  = _canonicalWeekKey(availWeekKey || weekKey(currentWeekStart));
    if(_todayWk !== _viewWk){
      // Resolve through _resolveStoreKey, not a raw lookup: duplicate key
      // formats ("27 Jul" + "27 July") can coexist and the canonical one is
      // sometimes the emptier shell. The resolver picks whichever variant
      // actually holds data, which is what stops the roster "vanishing".
      const _k = (typeof _resolveStoreKey==='function') ? _resolveStoreKey(_todayWk) : _todayWk;
      _todayShifts = (shiftsStore && (shiftsStore[_k] || shiftsStore[_todayWk])) || {};
    }
  }catch(e){ /* fall back to the loaded week */ }

  const inNow=[], lateList=[], leaveList=[], notInList=[], doneList=[];

  // Team leads see their own team only, everywhere on the dashboard. Filtering
  // here narrows the tiles, all four name lists, and the coverage meter in one
  // place. Admins (MY_TEAM null) and the "not resolved" case see everyone.
  const _tlMine = (typeof AM_TEAM_LEAD!=='undefined' && AM_TEAM_LEAD && MY_TEAM)
    ? String(MY_TEAM).trim().toLowerCase() : null;

  staff.forEach(s=>{
    if(_tlMine && String(s.team||'').trim().toLowerCase()!==_tlMine) return;
    const key = _normName(s.first+' '+s.last);
    const dayShifts = (_todayShifts[s.id]||{})[dayIdx] || [];
    const onLeave = dayShifts.some(x=>x.type==='leave');
    const rostered = dayShifts.filter(x=>x.type!=='leave');
    const p = last[key];
    const clockedIn  = p && p.action==='in';
    const clockedOut = p && p.action==='out';
    let startTime  = rostered.length ? rostered.map(x=>x.start).sort()[0] : null;

    // This person's availability for today (0=Mon..6=Sun matches dayIdx).
    // Prefer the freshly-fetched map; fall back to the in-memory object.
    const avObj = availByName[key] || availability[s.id] || null;
    const avToday = avObj ? (avObj[dayIdx] || avObj[String(dayIdx)]) : null;
    const isUnavailable = avToday && avToday.type === 'no';

    // Lateness is always measured against the ROSTERED shift start (startTime
    // above), never a class-day start. Class days still exist for the
    // housekeeping roster, but they no longer change the punctuality "due" time.
    // If unavailable today, they're not expected — no due time, and they should
    // not be surfaced as "not clocked in".
    if(isUnavailable) startTime = null;

    if(onLeave){ leaveList.push({s}); return; }

    if(clockedIn){
      // Late only if the DISPLAYED (flex-rounded) time is strictly after the
      // rostered start — so what you see always matches the late/on-time call.
      // (Previously we compared real time but showed rounded time, which made
      // e.g. a 9:03 clock-in read "9:00 · due 09:00" yet sit under "Late".)
      const shown = _hhmmFlexSydney(p.ts);
      let late = null;
      if(startTime && shown > startTime){ late = {start:startTime, actual:shown}; }
      if(late) lateList.push({s, ...late}); else inNow.push({s, at:shown});
      return;
    }

    if(clockedOut){ doneList.push({s, at:_hhmmFlexSydney(p.ts)}); return; }

    // NOT CLOCKED IN — anyone with no punch today who IS expected.
    // Unavailable staff (marked 'no' today) are not expected → don't surface
    // them as absent. Rostered/expected staff show their due time.
    if(isUnavailable) return; // legitimately off today
    notInList.push({s, start:startTime, rostered:!!startTime});
  });
  // rostered-but-absent first, then everyone else
  notInList.sort((a,b)=> (b.rostered?1:0)-(a.rostered?1:0) || a.s.first.localeCompare(b.s.first));

  const chip = (cls,label,n) => `<span class="mb-chip ${cls}${n===0?' zero':''}"><b>${n}</b>${label}</span>`;
  const person = (o,meta='') => `<div class="mb-person"><i class="mb-dot" style="background:${o.s.color||'#94a3b8'}"></i><span>${o.s.first} ${o.s.last.charAt(0)}.</span>${meta?`<s class="mb-meta">${meta}</s>`:''}</div>`;
  const dateLbl = new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Sydney',weekday:'short',day:'numeric',month:'short'}).format(new Date());

  // Strip first — same source lists, so the numbers always agree with the board.
  try{
    renderDashStrip({
      present: inNow.length,
      late:    lateList.length,
      notIn:   notInList.length,
      leave:   leaveList.length,
      open:    (window._dashOpenShifts||0),
      pending: (leaveRequests||[]).filter(function(r){return r.status==='pending';}).length
    });
  }catch(e){ console.warn('dash strip', e); }

  // "Right now" coverage: of everyone expected on shift today, how many are
  // actually clocked in. inNow already includes people who clocked in late, so
  // this reads as attendance, not punctuality. Absent = expected but no punch.
  try{
    renderCoverage(inNow.length, notInList.length, lateList.length);
  }catch(e){ console.warn('coverage', e); }

  const anyone = lateList.length||notInList.length||inNow.length||leaveList.length||doneList.length;

  // ── By team ── one column per team, in the same order as the Teams list.
  // Inside a team, the people who need attention come first (late, not in),
  // then on shift, finished, and on leave last.
  const teamColumns = () => {
    const rows = [
      ...lateList.map(o=>({o,k:'warn', r:0, meta:`late ${o.actual}`})),
      ...notInList.map(o=>({o,k:'miss', r:1, meta:o.rostered?`due ${o.start}`:'not rostered'})),
      ...inNow.map(o=>({o,k:'ok',   r:2, meta:o.at})),
      ...doneList.map(o=>({o,k:'done', r:3, meta:`out ${o.at}`})),
      ...leaveList.map(o=>({o,k:'leave',r:4, meta:'leave'}))
    ];
    const norm = t => String(t||'').trim().toLowerCase();
    const order = (typeof teams!=='undefined' && Array.isArray(teams)) ? teams : [];
    const groups = new Map();
    rows.forEach(x=>{
      const key = norm(x.o.s.team) || '\u0000none';
      if(!groups.has(key)) groups.set(key, {name:(String(x.o.s.team||'').trim()||'No team'), rows:[]});
      groups.get(key).rows.push(x);
    });
    const rank = key => { const i = order.findIndex(t=>norm(t)===key); return i<0 ? (key==='\u0000none'?1e6:1e5) : i; };
    return [...groups.entries()]
      .sort((a,b)=> rank(a[0])-rank(b[0]) || a[1].name.localeCompare(b[1].name))
      .map(([key,g])=>{
        const named = order.find(t=>norm(t)===key);
        if(named) g.name = named;
        g.rows.sort((a,b)=> a.r-b.r || a.o.s.first.localeCompare(b.o.s.first));
        const nLate = g.rows.filter(x=>x.k==='warn').length, nMiss = g.rows.filter(x=>x.k==='miss').length;
        const flag = [nMiss?`${nMiss} not in`:'', nLate?`${nLate} late`:''].filter(Boolean).join(' · ');
        const flagCls = nMiss ? '' : ' w';
        return `<div class="mb-col"><div class="mb-lbl team"><span class="mb-tn">${g.name}</span><span class="mb-tc">${g.rows.length}</span></div>`+
          (flag?`<div class="mb-tflag${flagCls}">${flag}</div>`:'')+
          g.rows.map(x=>`<div class="mb-person${x.k==='leave'?' is-leave':''}"><i class="mb-dot ${x.k}"></i><span>${x.o.s.first} ${x.o.s.last.charAt(0)}.</span><s class="mb-meta ${x.k}">${x.meta}</s></div>`).join('')+
          `</div>`;
      }).join('');
  };

  const paint = () => {
  let view = 'team';
  try{ view = localStorage.getItem('so_board_view') || 'team'; }catch(e){}
  if(_tlMine) view = 'status';   // a lead only ever sees their own team, so there's nothing to group
  const seg = _tlMine ? '' : `<div class="mb-seg" role="group" aria-label="Group the board by">
        <button type="button" class="${view==='team'?'on':''}" onclick="setBoardView('team')">By team</button>
        <button type="button" class="${view==='status'?'on':''}" onclick="setBoardView('status')">By status</button>
      </div>`;
  host.innerHTML = `
    <div class="mb-head">
      <span class="mb-title">${dateLbl}</span>
      ${chip('ok','on shift',inNow.length)}
      ${chip('warn','late',lateList.length)}
      ${chip('miss','not in',notInList.length)}
      ${chip('done','finished',doneList.length)}
      ${chip('leave','leave',leaveList.length)}
      ${seg}
      <button class="mb-refresh" onclick="refreshMorningBoard()" title="Refresh now"${seg?'':' style="margin-left:auto"'}>↻</button>
    </div>
    ${anyone && view==='team' ? `<div class="mb-lists">${teamColumns()}</div>` : anyone?`<div class="mb-lists">
      ${lateList.length?`<div class="mb-col"><div class="mb-lbl warn">Late</div>${lateList.map(o=>person(o,`${o.actual} · due ${o.start}`)).join('')}</div>`:''}
      ${notInList.length?`<div class="mb-col"><div class="mb-lbl miss">Not clocked in</div>${notInList.map(o=>person(o, o.rostered?`due ${o.start}`:'not rostered')).join('')}</div>`:''}
      ${inNow.length?`<div class="mb-col"><div class="mb-lbl ok">On shift</div>${inNow.map(o=>person(o,o.at)).join('')}</div>`:''}
      ${doneList.length?`<div class="mb-col"><div class="mb-lbl done">Finished</div>${doneList.map(o=>person(o,`out ${o.at}`)).join('')}</div>`:''}
      ${leaveList.length?`<div class="mb-col"><div class="mb-lbl leave">On leave</div>${leaveList.map(o=>person(o)).join('')}</div>`:''}
    </div>`:`<div class="mb-empty">Nothing to report today.</div>`}`;
  };
  window._mbPaint = paint;
  paint();
}

// Switch the board between "By team" and "By status" without re-fetching.
function setBoardView(v){
  try{ localStorage.setItem('so_board_view', v==='status'?'status':'team'); }catch(e){}
  if(typeof window._mbPaint==='function') window._mbPaint(); else refreshMorningBoard();
}

function startMorningBoard(){
  const host=document.getElementById('morningBoard');
  if(!host || !host.offsetParent) return;   // only when the roster tab is visible
  refreshMorningBoard();
  if(_boardTimer) clearInterval(_boardTimer);
  _boardTimer = setInterval(function(){ if(!document.hidden) refreshMorningBoard(); }, 120000); // every 2 min, only while visible
}
function stopMorningBoard(){
  if(_boardTimer){ clearInterval(_boardTimer); _boardTimer=null; }   // don't poll off-tab
}

