// ══════════════════════════════════════════════════════════════════════
// FULL-SCREEN EMPLOYEE PROFILE — Overview / Clock-ins / Punctuality /
// Call Logs / Leave / Details. Everything ShiftOps knows about a person,
// each list paged with "Load more".
// ══════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════
// ONBOARDING PANEL — opens as soon as "Add Employee" is saved and stays open
// until the admin closes it. Three steps run in order (roster → login → email);
// each shows its own result, a failed step can be retried on its own, and the
// temporary password stays on screen until it has been copied.
// The password is made fresh per person, lives only in this object, and is
// wiped when the panel closes. It is never logged or stored.
// ═══════════════════════════════════════════════════════════════════════
const OB={p:null,pw:'',st:null,copied:false,warned:false,pwShown:false,credSeen:false,flash:'',opener:null,open:false};
const OB_SIGNIN_URL='https://oscarstaff.github.io/Oscar/';
const OB_STEPS=['roster','account','email'];

function _obTmpPw(){
  // 15 characters from an alphabet with no look-alikes (no 0/O, 1/l/I) plus "!".
  // Rejection sampling so every character is equally likely.
  const c='abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const lim=256-(256%c.length);
  let out='';
  while(out.length<15){
    const b=new Uint8Array(24); crypto.getRandomValues(b);
    for(let i=0;i<b.length&&out.length<15;i++){ if(b[i]<lim) out+=c[b[i]%c.length]; }
  }
  return out+'!';
}
function _obNetMsg(e){
  if(e&&e.name==='AbortError') return 'The server did not answer in time. It may still have worked, so check before trying again.';
  return 'No connection. Check your internet and try again.';
}
function _obPost(body){
  const ctl=new AbortController(); const t=setTimeout(function(){ ctl.abort(); },45000);
  return fetch(GAS_EXEC_URL,{
    method:'POST',headers:{'Content-Type':'text/plain'},signal:ctl.signal,
    body:JSON.stringify(Object.assign({token:GAS_TOKEN,sbAccessToken:_soTok()},body))
  }).then(function(r){ return r.json().catch(function(){ return {}; }); })
    .finally(function(){ clearTimeout(t); });
}
function _obBusy(){ return OB_STEPS.some(function(k){ return OB.st[k].s==='run'; }); }
function _obNeedsPw(){ return !!OB.p && OB.st.account.s==='ok' && OB.st.email.s!=='ok'; }
function _obSet(step,s,msg){
  OB.st[step]={s:s,msg:msg||''};
  const names={roster:'Roster',account:'Login account',email:'Welcome email'};
  const live=document.getElementById('obLive');
  if(live && (s==='ok'||s==='fail'||s==='skip')) live.textContent=names[step]+': '+(s==='ok'?'done':s==='skip'?'skipped':'failed. '+(msg||''));
  _obRender();
}

async function _obRunRoster(){
  _obSet('roster','run');
  try{
    const p=OB.p;
    await addStaffToSupabase(p.fullName,p.team);
    await saveRosterConfig(p.fullName,p.type,p.maxHours);
    // Contact details go to staff_credentials with the admin's own token (the
    // welcome email below reads the address from here).
    const tok=(typeof _soTok==='function'&&_soTok())?_soTok():SUPABASE_KEY;
    const r=await fetch(SUPABASE_URL+'/rest/v1/staff_credentials?staff_name=eq.'+encodeURIComponent(p.fullName),{
      method:'PATCH',
      headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+tok,'Content-Type':'application/json',Prefer:'return=minimal'},
      body:JSON.stringify({pronouns:p.pronouns||null,birthday:p.birthday||null,email:p.email||null})
    });
    if(!r.ok) throw new Error('Contact details were not saved (error '+r.status+').');
    _obSet('roster','ok');
  }catch(e){
    _obSet('roster','fail',(e&&e.message&&e.name!=='TypeError')?e.message:_obNetMsg(e));
  }
}
async function _obRunAccount(){
  _obSet('account','run');
  try{
    const j=await _obPost({action:'adminSetPw',staff:OB.p.fullName,newPassword:OB.pw});
    if(j&&j.ok) _obSet('account','ok');
    else _obSet('account','fail',_relayErrMsg(j&&j.error));
  }catch(e){ _obSet('account','fail',_obNetMsg(e)); }
}
async function _obRunEmail(){
  const p=OB.p;
  if(!p.email||p.email.indexOf('@')<1){ _obSet('email','skip'); return; }
  if(OB.st.account.s!=='ok'||OB.st.roster.s!=='ok'){ _obSet('email','wait'); return; }
  _obSet('email','run');
  try{
    const j=await _obPost({action:'sendWelcomeEmail',staff:p.fullName});
    if(j&&j.ok) _obSet('email','ok');
    else _obSet('email','fail',_relayErrMsg(j&&j.error));
  }catch(e){ _obSet('email','fail',_obNetMsg(e)); }
}
function _obAfter(){
  // When the password has to be handed over by hand, put the cursor on Copy.
  if(_obNeedsPw() && !OB.credSeen){
    OB.credSeen=true;
    _obRender();
    const b=document.querySelector('#obPanel [data-ob="copy"]'); if(b) b.focus();
  }
}
async function obStart(p){
  OB.p=p; OB.pw=_obTmpPw(); OB.copied=false; OB.warned=false; OB.pwShown=false; OB.credSeen=false; OB.flash='';
  OB.st={roster:{s:'wait',msg:''},account:{s:'wait',msg:''},email:{s:'wait',msg:''}};
  OB.opener=document.activeElement;
  const ov=document.getElementById('obOverlay'), pn=document.getElementById('obPanel');
  _obRender();
  ov.setAttribute('aria-hidden','false'); ov.classList.add('open'); OB.open=true;
  try{ pn.focus({preventScroll:true}); }catch(e){}
  await _obRunRoster();
  await _obRunAccount();
  await _obRunEmail();
  _obAfter();
}
async function obRetry(step){
  if(_obBusy()||!OB.p) return;
  if(step==='roster') await _obRunRoster();
  else if(step==='account'){ OB.pw=_obTmpPw(); OB.copied=false; OB.credSeen=false; await _obRunAccount(); }
  else await _obRunEmail();
  // Roster/login fixed after the email was waiting on them → send it now.
  if(step!=='email' && OB.st.email.s==='wait') await _obRunEmail();
  _obAfter();
}
function _obGroups(pw){
  const out=[]; for(let i=0;i<pw.length;i+=4) out.push(pw.slice(i,i+4));
  return out.map(function(g){ return '<span>'+_cdEsc(g)+'</span>'; }).join('');
}
function _obCopyText(text){
  if(navigator.clipboard&&navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
  return new Promise(function(res,rej){
    try{
      const t=document.createElement('textarea'); t.value=text; t.setAttribute('readonly',''); t.style.cssText='position:fixed;opacity:0';
      document.body.appendChild(t); t.select(); const ok=document.execCommand('copy'); document.body.removeChild(t);
      ok?res():rej(new Error('copy failed'));
    }catch(e){ rej(e); }
  });
}
async function obCopy(kind){
  const p=OB.p; if(!p||!OB.pw) return;
  const text = kind==='msg'
    ? 'Hi '+p.first+', here is your sign-in for Nexus.\nSite: '+OB_SIGNIN_URL+'\nPick your name, then enter this temporary password: '+OB.pw+'\nYou will be asked to choose your own password the first time you sign in.'
    : OB.pw;
  try{
    await _obCopyText(text);
    OB.copied=true; OB.warned=false; OB.flash=kind;
    const live=document.getElementById('obLive'); if(live) live.textContent=(kind==='msg'?'Sign-in message':'Password')+' copied';
  }catch(e){
    OB.flash='fail';
  }
  _obRender();
  setTimeout(function(){ if(OB.flash){ OB.flash=''; _obRender(); } },2200);
}
function obRequestClose(openProfile){
  if(!OB.p||_obBusy()) return;
  if(_obNeedsPw() && !OB.copied && !OB.warned){
    // Don't let the only copy of the password vanish by accident.
    OB.warned=true; OB._pendingProfile=!!openProfile; _obRender();
    const b=document.querySelector('#obPanel [data-ob="copy"]'); if(b) b.focus();
    return;
  }
  obClose(openProfile);
}
function obClose(openProfile){
  const p=OB.p;
  OB.pw=''; OB.p=null; OB.st=null; OB.open=false; OB._pendingProfile=false;
  const ov=document.getElementById('obOverlay'), pn=document.getElementById('obPanel');
  ov.classList.remove('open'); ov.setAttribute('aria-hidden','true');
  setTimeout(function(){ if(!OB.open) pn.innerHTML=''; },260);   // wipe the password from the page
  const live=document.getElementById('obLive'); if(live) live.textContent='';
  if(openProfile && p && p.s){
    openEmpProfile(p.s.id,'availability');
    // A brand-new person has no pattern yet — go straight to setting it.
    try{ _epAvEdit(); }catch(e){}
  } else if(OB.opener && OB.opener.focus){ try{ OB.opener.focus(); }catch(e){} }
  OB.opener=null;
}

function _obIco(){
  const ring='<circle cx="12" cy="12" r="9.5" fill="none" stroke-width="1.6"/>';
  return '<span class="ob-ico" aria-hidden="true">'+
    '<svg class="i-wait" viewBox="0 0 24 24" stroke="var(--muted)">'+ring+'</svg>'+
    '<svg class="i-run" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="none" stroke="var(--border)" stroke-width="2"/><circle class="ob-arc" cx="12" cy="12" r="9.5" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-dasharray="15 45"/></svg>'+
    '<svg class="i-ok" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="var(--success)"/><path class="ob-tick" d="M7.2 12.4l3.1 3.1 6.2-6.6" fill="none" stroke="var(--surface)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'+
    '<svg class="i-fail" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="var(--warn)"/><path d="M12 6.8v6" stroke="var(--surface)" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="16.8" r="1.3" fill="var(--surface)"/></svg>'+
    '<svg class="i-skip" viewBox="0 0 24 24" stroke="var(--muted)"><circle cx="12" cy="12" r="9.5" fill="none" stroke-width="1.6"/><path d="M8 12h8" stroke-width="1.8" stroke-linecap="round"/></svg>'+
  '</span>';
}
function _obRender(){
  const el=document.getElementById('obPanel'); if(!el||!OB.p) return;
  const p=OB.p, st=OB.st, e=_cdEsc;
  const prevFocus=(document.activeElement&&el.contains(document.activeElement))?document.activeElement.getAttribute('data-ob'):null;
  const busy=_obBusy();
  const failed=OB_STEPS.filter(function(k){ return st[k].s==='fail'; });
  // 'wait' only counts as still working while nothing has failed; after a failure the email step is just blocked.
  const waiting=!failed.length && OB_STEPS.some(function(k){ return st[k].s==='wait'; });
  let title, sub;
  if(busy||waiting){ title='Setting up '+p.first+'…'; sub='This usually takes a few seconds.'; }
  else if(st.account.s==='fail'){ title=p.first+' was added, but the login was not created'; sub='Try again below. If it keeps failing, use Set Password on the Employees page.'; }
  else if(failed.length){ title=p.first+' was added, but one step needs attention'; sub=st.account.s==='ok' ? 'The login exists. Fix the step below, or hand over the temporary password yourself.' : 'Fix the step below and the rest will carry on.'; }
  else if(st.email.s==='ok'){ title=p.first+' is all set'; sub='A welcome email is on its way to '+e(p.email)+'.'; }
  else { title=p.first+' is ready to sign in'; sub='No email was entered, so give '+e(p.first)+' the temporary password below.'; }

  const D={
    roster:{wait:'Waiting to start',run:'Saving team, hours and contact details…',ok:'Team, hours and contact details saved'},
    account:{wait:'Waiting to start',run:'Creating the sign-in…',ok:'Sign-in created with a temporary password'},
    email:{wait:'Waiting for the login',run:'Sending to '+e(p.email)+'…',ok:'Sent to '+e(p.email)+'. The set-password link works for 1 hour.',skip:'No email entered, so nothing was sent'}
  };
  const T={roster:'Added to the roster',account:'Login account',email:'Welcome email'};
  const rows=OB_STEPS.map(function(k){
    const s=st[k].s;
    const desc = s==='fail' ? e(st[k].msg||'Something went wrong.') : (D[k][s]||'');
    const retry = (s==='fail') ? '<div class="ob-act"><button type="button" class="btn btn-ghost" data-ob="retry-'+k+'">Try again</button></div>' : '<div></div>';
    return '<li class="ob-step" data-s="'+s+'">'+_obIco()+'<div><div class="ob-t">'+T[k]+'</div><div class="ob-d">'+desc+'</div></div>'+retry+'</li>';
  }).join('');

  let cred='';
  if(st.account.s==='ok' && !busy && !waiting){
    if(_obNeedsPw() || OB.pwShown){
      const flash = OB.flash==='pw' ? 'Copied' : 'Copy';
      const note = OB.warned
        ? '<div class="ob-note ob-warn">Copy it before you continue. It is not shown again.</div>'
        : '<div class="ob-note">'+e(p.first)+' will be asked to choose their own password the first time they sign in. It is not shown again after you close this.</div>';
      const msgBtn = '<button type="button" class="ob-link" data-ob="copymsg">'+(OB.flash==='msg'?'Sign-in message copied':'Copy as a sign-in message')+'</button>';
      const bad = OB.flash==='fail' ? '<div class="ob-note ob-warn">Could not copy automatically. Select the password and copy it by hand.</div>' : '';
      cred='<div class="ob-cred'+(OB.credShownOnce?'':' ob-enter')+'" role="group" aria-labelledby="obCredL">'+
        '<div class="ob-cred-l" id="obCredL">Temporary password</div>'+
        '<div class="ob-pw-row"><div class="ob-pw" tabindex="0" aria-label="Temporary password: '+e(OB.pw)+'">'+_obGroups(OB.pw)+'</div>'+
        '<button type="button" class="btn btn-ghost" data-ob="copy">'+flash+'</button></div>'+
        msgBtn+bad+note+'</div>';
      OB.credShownOnce=true;
    } else {
      cred='<div class="ob-reveal"><button type="button" class="ob-link" data-ob="reveal">Link expired or not received? Show the temporary password</button></div>';
    }
  }

  const needsPw=_obNeedsPw();
  const doneLabel = (needsPw&&!OB.copied) ? (OB.warned?'Close anyway':'I have saved it') : 'Done';
  const initialsTxt=(p.first[0]||'')+(p.last[0]||'');
  el.innerHTML=
    '<div class="ob-head"><div class="avatar" style="background:'+e(p.s.color)+';width:48px;height:48px;font-size:17px;flex-shrink:0;" aria-hidden="true">'+e(initialsTxt.toUpperCase())+'</div>'+
    '<div><h2 class="ob-title" id="obTitle">'+e(title)+'</h2><div class="ob-sub">'+sub+'</div></div></div>'+
    '<ol class="ob-steps">'+rows+'</ol>'+cred+
    '<div class="ob-foot">'+
      '<button type="button" class="btn btn-ghost" data-ob="profile"'+((busy||waiting)?' disabled':'')+'>Set availability</button>'+
      '<button type="button" class="btn btn-primary" data-ob="done"'+((busy||waiting)?' disabled':'')+'>'+doneLabel+'</button>'+
    '</div>';
  if(prevFocus){ const f=el.querySelector('[data-ob="'+prevFocus+'"]'); if(f&&!f.disabled) f.focus(); }
}
(function(){
  const ov=document.getElementById('obOverlay'); if(!ov) return;
  ov.addEventListener('click',function(ev){
    const b=ev.target.closest('[data-ob]'); if(!b) return;
    const a=b.getAttribute('data-ob');
    if(a==='copy') obCopy('pw');
    else if(a==='copymsg') obCopy('msg');
    else if(a==='reveal'){ OB.pwShown=true; _obRender(); const c=document.querySelector('#obPanel [data-ob="copy"]'); if(c) c.focus(); }
    else if(a==='done') obRequestClose(false);
    else if(a==='profile') obRequestClose(true);
    else if(a.indexOf('retry-')===0) obRetry(a.slice(6));
  });
  ov.addEventListener('keydown',function(ev){
    if(!OB.open) return;
    if(ev.key==='Escape'){ ev.preventDefault(); ev.stopPropagation(); obRequestClose(false); return; }
    if(ev.key==='Tab'){
      const f=Array.prototype.filter.call(ov.querySelectorAll('#obPanel button:not([disabled]),#obPanel [tabindex="0"]'),function(n){ return n.offsetParent!==null; });
      if(!f.length){ ev.preventDefault(); return; }
      const first=f[0], last=f[f.length-1];
      if(ev.shiftKey && (document.activeElement===first||document.activeElement===document.getElementById('obPanel'))){ ev.preventDefault(); last.focus(); }
      else if(!ev.shiftKey && document.activeElement===last){ ev.preventDefault(); first.focus(); }
    }
  });
})();

// ═══════════════════════════════════════════════════════════════════════
// PROFILE → AVAILABILITY TAB
// One person's usual week. Reads and writes the same store as the Availability
// grid (availability[staffId][day] → staff_availability), so the two always agree.
// Edits are held in a draft and only written when Save is pressed.
// ═══════════════════════════════════════════════════════════════════════
let _epAvDraft=null;       // null = viewing; object = editing (copy of the week)
let _epAvBase='';          // JSON of the week when editing began, to detect real changes
let _epAvSaving=false;
const _EP_DAYFULL=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

function _epAvWeek(id){
  const w={}; for(let d=0;d<7;d++){ const a=getAvail(id,d); if(a&&a.type&&a.type!=='unset') w[d]=JSON.parse(JSON.stringify(a)); }
  return w;
}
function _epAvDefWin(d){ return d>=5 ? ['09:00','16:00'] : ['09:00','19:00']; }
function _epAvKind(a,d){
  if(!a||!a.type||a.type==='unset') return 'unset';
  if(a.type==='no') return 'no';
  if(a.type==='all') return 'all';
  const w=_epAvDefWin(d);
  return (a.start===w[0]&&a.end===w[1]) ? 'all' : 'custom';
}
function _epAvDirty(){ return !!_epAvDraft && JSON.stringify(_epAvDraft)!==_epAvBase; }
function _epAvBadDays(){
  if(!_epAvDraft) return [];
  const bad=[];
  for(let d=0;d<7;d++){
    const a=_epAvDraft[d];
    if(a&&a.type==='custom'){
      const s=_av2Min(a.start), e=_av2Min(a.end);
      if(s===null||e===null||e<=s) bad.push(d);
    }
  }
  return bad;
}
// Called before the profile is closed or another tab opens. Returns true if it is fine to go on.
function _epAvGuard(){
  if(_epAvDraft && _epAvDirty() && !_epAvSaving){
    if(!window.confirm('You have unsaved availability changes. Discard them?')) return false;
  }
  _epAvDraft=null; _epAvBase='';
  return true;
}
function _epAvEdit(){
  if(!_epStaff) return;
  _epAvDraft=_epAvWeek(_epStaff.id); _epAvBase=JSON.stringify(_epAvDraft);
  _epAvRender(null,'kind-0');
}
function _epAvCancel(){
  _epAvDraft=null; _epAvBase='';
  _epAvRender(null,'edit');
}
function _epAvSetKind(d,kind){
  if(!_epAvDraft) return;
  if(kind==='no') _epAvDraft[d]={type:'no'};
  else if(kind==='all'){
    _epAvDraft[d] = d>=5 ? {type:'custom',start:'09:00',end:'16:00'} : {type:'all'};
  } else {
    const cur=_epAvDraft[d]; const w=_epAvDefWin(d);
    let s=w[0], e=(d>=5?'16:00':'17:00');
    if(cur&&cur.type==='custom'){ s=cur.start; e=cur.end; }
    else if(cur&&cur.type==='all'){ s=w[0]; e=w[1]; }
    _epAvDraft[d]={type:'custom',start:s,end:e};
  }
  _epAvRender(null,'kind-'+d+'-'+kind);
}
function _epAvTime(d,which,val){
  if(!_epAvDraft||!_epAvDraft[d]||_epAvDraft[d].type!=='custom') return;
  _epAvDraft[d][which]=val;
  _epAvSync();
}
// Update the pieces that depend on the draft without rebuilding (keeps typing focus).
function _epAvSync(){
  const bad=_epAvBadDays();
  for(let d=0;d<7;d++){
    const t=document.querySelector('.epav-times[data-d="'+d+'"]'); if(!t) continue;
    const isBad=bad.indexOf(d)>=0;
    t.classList.toggle('bad',isBad);
    const m=t.querySelector('.e'); if(m) m.textContent=isBad?'End must be after start':'';
    const bar=document.querySelector('.epav-row[data-d="'+d+'"] .epav-track i');
    const a=_epAvDraft[d];
    if(bar&&a&&a.type==='custom'&&!isBad){
      const T0=7*60,SPAN=14*60,x=Math.max(0,(_av2Min(a.start)-T0)/SPAN),y=Math.min(1,(_av2Min(a.end)-T0)/SPAN);
      bar.style.left=(x*100).toFixed(1)+'%'; bar.style.width=(Math.max(.04,y-x)*100).toFixed(1)+'%';
    }
  }
  const sv=document.getElementById('epAvSave'); if(sv) sv.disabled=(bad.length>0)||!_epAvDirty()||_epAvSaving;
}
function _epAvCopyMon(){
  if(!_epAvDraft||!_epAvDraft[0]) return;
  for(let d=1;d<5;d++) _epAvDraft[d]=JSON.parse(JSON.stringify(_epAvDraft[0]));
  _epAvRender(null,'copy');
}
async function _epAvSave(){
  if(!_epStaff||!_epAvDraft||_epAvSaving) return;
  if(_epAvBadDays().length) return;
  const id=_epStaff.id, prev=JSON.parse(JSON.stringify(availability[id]||{}));
  _epAvSaving=true; _epAvMsg('Saving…','');
  const sv=document.getElementById('epAvSave'); if(sv) sv.disabled=true;
  // Swap in the new week, then write it. If the write fails, put the old week back.
  const next={}; for(let d=0;d<7;d++){ if(_epAvDraft[d]) next[d]=JSON.parse(JSON.stringify(_epAvDraft[d])); }
  availability[id]=next;
  let ok=false;
  try{ ok=await _doPushAvail(id); }catch(e){ ok=false; }
  _epAvSaving=false;
  if(!_epStaff||_epStaff.id!==id) return;   // profile was closed while saving
  if(ok){
    _epAvDraft=null; _epAvBase='';
    try{ markDirty(); }catch(e){}
    try{ renderRoster(); }catch(e){}
    try{ if(document.getElementById('availGrid')&&document.getElementById('availGrid').innerHTML) renderAvailability(); }catch(e){}
    _epAvRender('Saved. The roster and the Availability grid are up to date.','edit');
    const m=document.getElementById('epAvMsg'); if(m) m.className='epav-msg ok';
  } else {
    availability[id]=prev;   // the write failed, so put the saved week back; the draft stays so nothing is lost
    _epAvRender('Not saved. Check your connection and press Save again. Your changes are still here.','save');
    const m=document.getElementById('epAvMsg'); if(m) m.className='epav-msg err';
  }
}
function _epAvMsg(text,cls){ const m=document.getElementById('epAvMsg'); if(m){ m.textContent=text; m.className='epav-msg'+(cls?' '+cls:''); } }

function _epAvTicks(){
  const lab=['7am','11am','3pm','7pm','9pm'], pos=[0,28.57,57.14,85.71,100];
  return '<div class="epav-ticks" aria-hidden="true">'+lab.map(function(t,i){ return '<span style="left:'+pos[i]+'%">'+t+'</span>'; }).join('')+'</div>';
}
function _epAvRender(message,focusKey){
  const b=document.getElementById('empProfBody'); if(!b||_epTab!=='availability'||!_epStaff) return;
  const s=_epStaff, editing=!!_epAvDraft, data=editing?_epAvDraft:_epAvWeek(s.id);
  const todayI=(new Date().getDay()+6)%7;
  let setN=0, unsetN=0;
  for(let d=0;d<7;d++){ const a=data[d]; if(!a) unsetN++; else if(a.type!=='no') setN++; }
  const sub = unsetN===7 ? e0(s.first)+' has no availability set yet.'
    : 'Available '+setN+' of 7 days'+(unsetN?'. <b>'+unsetN+' not set</b>':'.');
  function e0(x){ return _cdEsc(x); }
  let rows='';
  for(let d=0;d<7;d++){
    const a=data[d]||{type:'unset'}, k=_epAvKind(a,d);
    let start=null,end=null,label;
    if(a.type==='all'){ const w=_epAvDefWin(d); start=w[0]; end=w[1]; }
    else if(a.type==='custom'){ start=a.start; end=a.end; }
    if(start&&end&&_av2Min(end)>_av2Min(start)) label=_av2Fmt(start)+' – '+_av2Fmt(end);
    else label = a.type==='no' ? 'Off' : (a.type==='custom' ? 'Check times' : 'Not set');
    let bar='';
    if(start&&end&&_av2Min(end)>_av2Min(start)){
      const T0=7*60,SPAN=14*60,x=Math.max(0,(_av2Min(start)-T0)/SPAN),y=Math.min(1,(_av2Min(end)-T0)/SPAN);
      bar='<i style="left:'+(x*100).toFixed(1)+'%;width:'+(Math.max(.04,y-x)*100).toFixed(1)+'%"></i>';
    }
    const dayCls='epav-day'+(d===todayI?' today':'');
    if(!editing){
      rows+='<div class="epav-row" data-d="'+d+'" data-k="'+(k==='all'||k==='custom'?'yes':k)+'"><div class="'+dayCls+'">'+_EP_DAYFULL[d]+'</div><div class="epav-track" aria-hidden="true">'+bar+'</div><div class="epav-lbl">'+label+'</div></div>';
    } else {
      const seg=[['all','Available'],['custom','Hours'],['no','Off']].map(function(o){
        return '<button type="button" data-av="kind-'+d+'-'+o[0]+'" aria-pressed="'+(k===o[0])+'" onclick="_epAvSetKind('+d+',\''+o[0]+'\')">'+o[1]+'</button>';
      }).join('');
      let times='';
      if(a.type==='custom'){
        times='<div class="epav-times" data-d="'+d+'"><label>From <input type="time" value="'+_cdEsc(a.start||'')+'" step="900" onchange="_epAvTime('+d+',\'start\',this.value)" aria-label="'+_EP_DAYFULL[d]+' start time"></label>'+
              '<label>to <input type="time" value="'+_cdEsc(a.end||'')+'" step="900" onchange="_epAvTime('+d+',\'end\',this.value)" aria-label="'+_EP_DAYFULL[d]+' end time"></label><span class="e" role="alert"></span></div>';
      }
      rows+='<div class="epav-row epav-edit" data-d="'+d+'" data-k="'+k+'"><div class="'+dayCls+'">'+_EP_DAYFULL[d]+'</div><div><div class="epav-seg" role="group" aria-label="'+_EP_DAYFULL[d]+' availability">'+seg+'</div></div>'+times+
            '<div class="epav-track" aria-hidden="true">'+bar+'</div></div>';
    }
  }
  const btns = editing
    ? '<button type="button" class="btn btn-ghost" onclick="_epAvCancel()" data-av="cancel">Cancel</button><button type="button" class="btn btn-primary" id="epAvSave" onclick="_epAvSave()" disabled>Save availability</button>'
    : '<button type="button" class="btn btn-primary" data-av="edit" onclick="_epAvEdit()" data-tl-hide="1">'+(unsetN===7?'Set availability':'Edit')+'</button>';
  const copy = (editing && _epAvDraft[0]) ? '<div class="epav-foot"><button type="button" class="btn btn-ghost" style="padding:6px 12px;font-size:12px" onclick="_epAvCopyMon()">Use Monday for Tuesday to Friday</button></div>' : '';
  const foot = editing ? '' : '<div class="epav-foot">Weekday &ldquo;Available&rdquo; means 9am to 7pm, weekend means 9am to 4pm. Changes here also update the roster and the Availability grid.</div>';
  b.innerHTML='<div class="epav">'+
    '<div class="epav-top"><div><div class="epav-h">Usual week</div><div class="epav-s">'+sub+'</div></div><div class="epav-btns">'+btns+'</div></div>'+
    '<div class="epav-msg" id="epAvMsg" role="status" aria-live="polite"></div>'+
    '<div class="epav-list">'+(editing?'':'<div class="epav-axis"><span></span>'+_epAvTicks()+'<span></span></div>')+rows+'</div>'+copy+foot+'</div>';
  if(message){ _epAvMsg(message,''); }
  if(editing) _epAvSync();
  if(focusKey){
    let t=document.querySelector('[data-av="'+focusKey+'"]');
    if(!t && focusKey.indexOf('kind-')===0){ const p=focusKey.split('-'); t=document.querySelector('[data-av="kind-'+p[1]+'-'+(p[2]||'all')+'"]')||document.querySelector('[data-av="kind-'+p[1]+'-all"]'); }
    if(!t && focusKey==='save') t=document.getElementById('epAvSave');
    if(t&&t.focus){ try{ t.focus({preventScroll:true}); }catch(e){} }
  }
  try{ if(document.body.classList.contains('tl-readonly')&&typeof applyTeamLeadLock==='function') applyTeamLeadLock(); }catch(e){}
}

let _epStaff=null, _epTab='overview';
const _EP_PAGE=20;
let _epPage={clockins:0, calls:0, leave:0, punctuality:0};

function openEmpProfile(id,tab){
  const s=staff.find(x=>x.id===id); if(!s) return;
  if(_epStaff && _epStaff.id!==id && !_epAvGuard()) return;
  _epAvDraft=null; _epAvBase='';
  _epStaff=s; _epTab=tab||'overview';
  _epPage={clockins:0, calls:0, leave:0, punctuality:0};
  _epRenderHeader(); _epRenderStats(); _epRenderTabs(); _epRenderBody();
  const pg=document.getElementById('empProfilePage');
  if(pg){ pg.style.display='block'; pg.scrollTop=0; }
}
function closeEmpProfile(){
  if(!_epAvGuard()) return;
  try{ _epReturnForm(); }catch(e){}   // ensure the shared form is back in the modal
  const pg=document.getElementById('empProfilePage');
  if(pg) pg.style.display='none';
  _epStaff=null;
}

function _epRenderHeader(){
  const s=_epStaff; if(!s) return;
  const isAdmin=!!s.isHubAdmin, isLead=!isAdmin&&!!s.isTeamLead;
  const roleTxt=isAdmin?'Admin':(isLead?'Team Lead':'Team Member');
  const roleCol=isAdmin?'var(--accent-dim);color:var(--accent-text)':(isLead?'var(--accent-dim);color:var(--accent-text)':'rgba(127,127,127,.15);color:var(--text-dim)');
  document.getElementById('empProfHeader').innerHTML=
    '<div class="avatar" style="background:'+s.color+';width:64px;height:64px;font-size:22px;">'+initials(s)+'</div>'+
    '<div><div style="font-size:22px;font-weight:700;letter-spacing:-.01em;">'+_cdEsc(s.first+' '+s.last)+'</div>'+
    '<div style="display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap;">'+
      '<span style="font-family:var(--mono);font-size:12px;color:var(--text-dim);">'+_cdEsc(s.team||'')+'</span>'+
      '<span style="font-size:9px;font-weight:700;font-family:var(--mono);padding:2px 8px;border-radius:4px;background:'+roleCol+';">'+roleTxt.toUpperCase()+'</span>'+
    '</div></div>';
}

function _epRenderStats(){
  const s=_epStaff; if(!s) return;
  const hrs=staffHoursWeek(s.id);
  const pct=Math.min(100,Math.round((hrs/s.maxHours)*100));
  const tl={full:'Full-time',part:'Part-time',casual:'Casual'};
  const stat=(label,val,sub)=>
    '<div style="flex:1;min-width:120px;background:var(--card,rgba(127,127,127,.06));border:1px solid var(--border);border-radius:11px;padding:12px 15px;">'+
      '<div style="font-family:var(--mono);font-size:8.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--text-dim);">'+label+'</div>'+
      '<div style="font-size:19px;font-weight:700;margin-top:4px;">'+val+'</div>'+
      (sub?'<div style="font-size:10.5px;color:var(--text-dim);margin-top:1px;">'+sub+'</div>':'')+'</div>';
  document.getElementById('empProfStats').innerHTML=
    stat('This week', hrs.toFixed(1)+'h', pct+'% of '+s.maxHours+'h')+
    stat('Type', tl[s.type]||s.type, 'max '+s.maxHours+'h')+
    stat('Punctuality', '<span id="epStatPunc">…</span>', 'clock-ins, 30d')+
    stat('Next leave', '<span id="epStatLeave">…</span>', 'upcoming');
  _epFillHeaderStats();
}

async function _epFillHeaderStats(){
  const s=_epStaff, full=(s.first+' '+s.last).trim();
  try{
    const since=new Date(Date.now()-30*86400000).toISOString().slice(0,10);
    const rows=await _cdGet('clock_log?staff_name=eq.'+encodeURIComponent(full)+'&action=eq.in&ts=gte.'+since+'&select=ts');
    const el=document.getElementById('epStatPunc'); if(el) el.textContent=(rows?rows.length:0)+' days';
  }catch(e){}
  try{
    const today=_sydToday();
    const rows=await _cdGet('leave_submissions?staff_name=eq.'+encodeURIComponent(full)+'&status=eq.approved&to_date=gte.'+today+'&order=from_date.asc&select=from_date&limit=1');
    const el=document.getElementById('epStatLeave');
    if(el) el.textContent=(rows&&rows.length)?new Date(rows[0].from_date+'T00:00:00').toLocaleDateString('en-AU',{day:'numeric',month:'short'}):'None';
  }catch(e){}
}

function _epRenderTabs(){
  const tabs=[['overview','Overview'],['availability','Availability'],['clockins','Clock-ins'],['punctuality','Punctuality'],['calls','Call Logs'],['leave','Leave'],['details','Employee information']];
  document.getElementById('empProfTabs').innerHTML=tabs.map(function(t){
    const on=_epTab===t[0];
    return '<button data-eptab="'+t[0]+'" onclick="_epSwitch(\''+t[0]+'\')" style="padding:9px 16px;font-size:12.5px;font-weight:600;font-family:inherit;cursor:pointer;background:none;border:none;white-space:nowrap;color:'+(on?'var(--accent,#3d9eff)':'var(--text-dim)')+';border-bottom:2px solid '+(on?'var(--accent,#3d9eff)':'transparent')+';">'+t[1]+'</button>';
  }).join('');
}
function _epSwitch(tab){
  const prev=_epTab;
  if(prev===tab) return;   // already on this tab — no rebuild, no jump
  if(prev==='availability' && !_epAvGuard()) return;   // unsaved availability edits
  // Leaving the Details tab → put the edit form back in the modal shell.
  if(prev==='details' && tab!=='details') _epReturnForm();
  _epTab=tab;
  const strip=document.getElementById('empProfTabs');
  if(strip){
    Array.prototype.forEach.call(strip.children, function(btn){
      const on=(btn.getAttribute('data-eptab')===tab);
      btn.style.color = on ? 'var(--accent,#3d9eff)' : 'var(--text-dim)';
      btn.style.borderBottom = '2px solid '+(on ? 'var(--accent,#3d9eff)' : 'transparent');
    });
  }
  _epRenderBody();
  // Anchor the view at the top of the profile so switching tabs never strands
  // you mid-page or throws you to the bottom.
  try{
    const pg=document.getElementById('empProfilePage');
    if(pg) pg.scrollTop=0;
  }catch(e){}
}
// Details edits inline (no popup). Reuses the exact same fields + saveStaff()
// logic — nothing is duplicated. _epReturnForm() puts it back.
function _epMountForm(){
  const form=document.getElementById('staffFormMovable');
  const host=document.getElementById('epDetailsHost');
  if(form && host && form.parentNode!==host){ host.appendChild(form); }
  // Hide the modal's own Save/Cancel while inline — the tab has its own buttons.
  try{ const a=document.getElementById('staffModalActions'); if(a) a.style.display='none'; }catch(e){}
  const s=_epStaff; if(!s) return;
  // Populate the form for this employee. Each step is guarded so that if any
  // one helper throws on real data, the form still shows (just missing that
  // one field) instead of the whole tab collapsing.
  try{ editingStaffId=s.id; window._editingOldName=(s.first+' '+s.last).trim(); }catch(e){}
  try{ document.getElementById('staffFirstName').value=s.first; }catch(e){}
  try{ document.getElementById('staffLastName').value=s.last; }catch(e){}
  try{ populateTeamSelect(s.team); }catch(e){ console.warn('populateTeamSelect',e); }
  try{ document.getElementById('staffIsManager').value=(s.isOfficeManager||s.isManager==='office')?'office':'false'; }catch(e){}
  try{ document.getElementById('staffType').value=s.type; }catch(e){}
  try{ document.getElementById('staffMaxHours').value=s.maxHours; }catch(e){}
  try{ var _bd=document.getElementById('staffBirthday'); if(_bd) _bd.value=s.birthday? String(s.birthday).slice(0,10):''; }catch(e){}
  try{ var _pr=document.getElementById('staffPronouns'); if(_pr) _pr.value=s.pronouns||''; }catch(e){}
  try{ var _em=document.getElementById('staffEmail'); if(_em) _em.value=s.email||''; }catch(e){}
  try{ onRoleChange(document.getElementById('staffIsManager')); }catch(e){ console.warn('onRoleChange',e); }
  try{ const adminSec=document.getElementById('staffAdminSection'); if(adminSec) adminSec.style.display=''; }catch(e){}
  try{ const _pp=document.getElementById('empProfilePanel'); if(_pp){ _pp.style.display='none'; } }catch(e){}
  try{ loadStaffAccess(s); }catch(e){ console.warn('loadStaffAccess',e); }
  try{ loadStaffExtraTeams((s.first+' '+s.last).trim(), s.team); }catch(e){ console.warn('loadStaffExtraTeams',e); }
}
// Payroll block inside Employee information — Accounts-only (gated + RLS).
// Editable: structure, standard rate, premium rate, cap (48 / 76 / Custom).
// Writes go to payroll_rates via upsert; RLS restricts writes to the Accounts team.
var _epPayState=null; // {full, structure, std_rate, prem_rate, pay_cap}
async function _epDetailsPayroll(){
  const box=document.getElementById('epDetailsPayroll'); if(!box) return;
  const s=_epStaff; if(!s) return;
  const full=(s.first+' '+s.last).trim();
  const head='<div style="font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:10px;border-top:1px solid var(--border);padding-top:18px;">Payroll</div>';
  if(!(typeof _canPayroll==='function' && _canPayroll())){
    box.innerHTML=head+'<div style="color:var(--text-dim);font-size:12.5px;">Visible to the Accounts team only.</div>';
    return;
  }
  box.innerHTML=head+'<div style="color:var(--text-dim);font-size:12.5px;">Loading…</div>';
  try{
    const rows=await _cdGet('payroll_rates?staff_name=eq.'+encodeURIComponent(full)+'&select=structure,std_rate,prem_rate,pay_cap&limit=1');
    const r=(rows&&rows.length)?rows[0]:{structure:'flat',std_rate:0,prem_rate:0,pay_cap:48};
    const unset=!(rows&&rows.length);
    _epPayState={
      full:full,
      structure:(r.structure==='tiered'?'tiered':'flat'),
      std_rate:parseFloat(r.std_rate)||0,
      prem_rate:parseFloat(r.prem_rate)||0,
      pay_cap:(parseFloat(r.pay_cap)||48)
    };
    const cap=_epPayState.pay_cap, isPreset=(cap===48||cap===76), isCustom=!isPreset;
    const isFlat=(_epPayState.structure!=='tiered');
    box.innerHTML=head+
      (unset?'<div style="font-size:11px;color:var(--warn);font-weight:700;margin-bottom:10px;">No pay rate on file yet — set one below.</div>':'')+
      '<div class="ep-pay-card">'+
        '<div class="ep-pay-grid">'+
          '<div class="ep-pay-field">'+
            '<label>Structure</label>'+
            '<select id="epPayStruct" onchange="_epPayOnStruct(this)">'+
              '<option value="tiered"'+(!isFlat?' selected':'')+'>Tiered (standard + premium)</option>'+
              '<option value="flat"'+(isFlat?' selected':'')+'>Flat rate</option>'+
            '</select>'+
          '</div>'+
          '<div class="ep-pay-field">'+
            '<label>Cap (hrs / fortnight)</label>'+
            '<div class="ep-pay-caprow">'+
              '<select id="epPayCap" onchange="_epPayOnCap(this)">'+
                '<option value="48"'+(cap===48?' selected':'')+'>48</option>'+
                '<option value="76"'+(cap===76?' selected':'')+'>76</option>'+
                '<option value="__custom"'+(isCustom?' selected':'')+'>Custom…</option>'+
              '</select>'+
              '<input id="epPayCapCustom" type="number" step="0.01" min="0" placeholder="hrs" value="'+(isCustom?cap:'')+'" oninput="_epPayRecalc()" style="'+(isCustom?'':'display:none;')+'">'+
            '</div>'+
          '</div>'+
          '<div class="ep-pay-field">'+
            '<label>Standard $/h</label>'+
            '<input id="epPayStd" type="number" step="0.01" min="0" value="'+_epPayState.std_rate+'" oninput="_epPayRecalc()">'+
          '</div>'+
          '<div class="ep-pay-field" id="epPayPremWrap">'+
            '<label>Premium $/h ▲</label>'+
            '<input id="epPayPrem" type="number" step="0.01" min="0" value="'+_epPayState.prem_rate+'" oninput="_epPayRecalc()">'+
          '</div>'+
        '</div>'+
        '<div class="ep-pay-actions">'+
          '<button onclick="_epPaySave()" class="btn btn-green" style="padding:9px 18px;font-size:12px;">Save pay rate</button>'+
          '<span id="epPaySaveMsg" style="font-size:11.5px;color:var(--text-dim);"></span>'+
        '</div>'+
        '<div class="ep-pay-live" id="epPayLive"></div>'+
      '</div>';
    _epPayOnStruct(document.getElementById('epPayStruct'));
  }catch(e){ box.innerHTML=head+'<div style="color:var(--text-dim);font-size:12.5px;">Couldn\'t load payroll.</div>'; }
}
function _epPayOnCap(sel){
  const inp=document.getElementById('epPayCapCustom'); if(!inp) return;
  if(sel.value==='__custom'){ inp.style.display=''; inp.focus(); } else { inp.style.display='none'; }
  _epPayRecalc();
}
function _epPayOnStruct(sel){
  const flat=(sel.value!=='tiered');
  const card=sel.closest('.ep-pay-card');
  if(card) card.classList.toggle('ep-flat', flat);
  const pw=document.getElementById('epPayPremWrap'); if(pw) pw.style.opacity=flat?'.4':'1';
  const cap=document.getElementById('epPayCap'); const capC=document.getElementById('epPayCapCustom');
  if(cap) cap.disabled=flat; if(capC) capC.disabled=flat;
  _epPayRecalc();
}
function _epPayReadCap(){
  const sel=document.getElementById('epPayCap'); if(!sel) return 48;
  if(sel.value==='__custom'){ const c=parseFloat((document.getElementById('epPayCapCustom')||{}).value); return (!isNaN(c)&&c>0)?c:48; }
  return parseFloat(sel.value)||48;
}
function _epPayRecalc(){
  const live=document.getElementById('epPayLive'); if(!live||!_epStaff) return;
  const structure=(document.getElementById('epPayStruct')||{}).value==='tiered'?'tiered':'flat';
  const std=parseFloat((document.getElementById('epPayStd')||{}).value)||0;
  const prem=parseFloat((document.getElementById('epPayPrem')||{}).value)||0;
  const cap=_epPayReadCap();
  const hrs=staffHoursWeek(_epStaff.id);
  let stdHrs,premHrs,stdPay,premPay;
  if(structure==='flat'){ stdHrs=hrs;premHrs=0;stdPay=hrs*std;premPay=0; }
  else { stdHrs=Math.min(hrs,cap);premHrs=Math.max(0,hrs-cap);stdPay=stdHrs*std;premPay=premHrs*prem; }
  const m=v=>'$'+v.toFixed(2);
  const row=(k,v,cls)=>'<div class="row'+(cls?' '+cls:'')+'"><span style="color:var(--text-dim);">'+k+'</span><span'+(cls==='prem-line'?' class="prem"':'')+' style="font-weight:600;">'+v+'</span></div>';
  live.innerHTML=
    '<div style="font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-bottom:6px;">This week (live)</div>'+
    row('Standard', stdHrs.toFixed(1)+'h · '+m(stdPay))+
    (structure!=='flat'?row('Premium (over '+cap+'h)', premHrs>0?(premHrs.toFixed(1)+'h · '+m(premPay)):'—', 'prem-line'):'')+
    '<div class="row total"><span>Total this week</span><span>'+m(stdPay+premPay)+'</span></div>';
}
async function _epPaySave(){
  if(!(typeof _canPayroll==='function' && _canPayroll())) return;
  if(!_epPayState) return;
  const msg=document.getElementById('epPaySaveMsg');
  const btn=document.querySelector('#epDetailsPayroll .ep-pay-actions .btn-green');
  const payload={
    staff_name:_epPayState.full,
    structure:(document.getElementById('epPayStruct').value==='tiered'?'tiered':'flat'),
    std_rate:parseFloat(document.getElementById('epPayStd').value)||0,
    prem_rate:parseFloat(document.getElementById('epPayPrem').value)||0,
    pay_cap:_epPayReadCap(),
    updated_at:new Date().toISOString()
  };
  if(msg){ msg.style.color='var(--text-dim)'; msg.textContent='Saving…'; }
  if(btn) btn.disabled=true;
  try{
    const res=await fetch(SUPABASE_URL+'/rest/v1/payroll_rates',{
      method:'POST',
      headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify([payload])
    });
    if(res.ok){
      _epPayState.structure=payload.structure; _epPayState.std_rate=payload.std_rate; _epPayState.prem_rate=payload.prem_rate; _epPayState.pay_cap=payload.pay_cap;
      if(msg){ msg.style.color='var(--success)'; msg.textContent='Saved ✓'; }
      if(typeof showToast==='function') showToast('Pay rate saved');
    } else {
      const t=await res.text().catch(function(){return '';});
      if(msg){ msg.style.color='var(--warn)'; msg.textContent='Save failed ('+res.status+')'; }
      console.warn('_epPaySave', res.status, t);
    }
  }catch(e){ if(msg){ msg.style.color='var(--warn)'; msg.textContent='Save failed'; } console.warn(e); }
  finally{ if(btn) btn.disabled=false; }
}

function _epReturnForm(){
  const form=document.getElementById('staffFormMovable');
  const modal=document.querySelector('#staffModal .modal');
  const actions=document.getElementById('staffModalActions');
  if(form && modal && actions && form.parentNode!==modal){
    modal.insertBefore(form, actions);   // back to its original slot (before the modal actions)
  }
  try{ if(actions) actions.style.display=''; }catch(e){}  // restore modal's own Save/Cancel
}

// Save the inline Details edits — reuses the exact saveStaff() the modal used,
// then refreshes the profile header/stats and returns to Overview.
async function _epSaveDetails(){
  const id=_epStaff?_epStaff.id:null;
  try{ await saveStaff(); }catch(e){ console.warn('inline save',e); }
  _epReturnForm();                       // move the form back to the modal shell
  // Re-sync _epStaff to the updated record and re-render the page chrome.
  if(id!=null){ const s=staff.find(x=>x.id===id); if(s) _epStaff=s; }
  _epRenderHeader(); _epRenderStats();
  _epTab='overview'; _epRenderTabs(); _epRenderBody();
}

function _epRenderBody(){
  const b=document.getElementById('empProfBody'); if(!b) return;
  // Before wiping the body, always rescue the shared edit form back into the
  // modal shell — otherwise setting innerHTML destroys it (that's the "click
  // Employee information twice and it collapses to just Save/Cancel" bug).
  try{ _epReturnForm(); }catch(e){}
  if(_epTab==='overview'){ _epOverview(b); return; }
  if(_epTab==='availability'){ _epAvRender(); return; }
  if(_epTab==='clockins'){ b.innerHTML=_epLoading(); _epLoadClockins(true); return; }
  if(_epTab==='punctuality'){ b.innerHTML=_epLoading(); _epLoadPunctuality(true); return; }
  if(_epTab==='calls'){ b.innerHTML=_epLoading(); _epLoadCalls(true); return; }
  if(_epTab==='leave'){ b.innerHTML=_epLoading(); _epLoadLeave(true); return; }
  if(_epTab==='details'){
    b.innerHTML='<div id="epDetailsHost" style="max-width:640px;"></div>'+
      '<div id="epDetailsPayroll" style="max-width:640px;margin-top:22px;"></div>'+
      '<div style="display:flex;gap:10px;margin-top:20px;max-width:640px;">'+
        '<button class="btn btn-primary" style="padding:9px 20px;" onclick="_epSaveDetails()">Save changes</button>'+
        '<button class="btn btn-ghost" style="padding:9px 16px;" onclick="_epSwitch(\'overview\')">Cancel</button>'+
      '</div>';
    _epMountForm();
    _epDetailsPayroll();
    return;
  }
}
function _epLoading(){ return '<div style="padding:40px;text-align:center;color:var(--text-dim);font-size:13px;">Loading…</div>'; }
function _epEmpty(msg){ return '<div style="padding:40px;text-align:center;color:var(--text-dim);font-size:13px;">'+msg+'</div>'; }
function _epMoreBtn(kind){
  return '<div style="text-align:center;margin-top:14px;"><button onclick="_epMore(\''+kind+'\')" class="btn btn-ghost" style="padding:7px 18px;font-size:12px;">Load more</button></div>';
}
function _epMore(kind){
  _epPage[kind]++;
  if(kind==='clockins') _epLoadClockins(false);
  else if(kind==='calls') _epLoadCalls(false);
  else if(kind==='leave') _epLoadLeave(false);
  else if(kind==='punctuality') _epLoadPunctuality(false);
}

// Small helpers for formatting.
function _epDate(iso){ if(!iso) return ''; try{ return new Date(iso).toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short',year:'numeric'}); }catch(e){ return iso; } }
function _epTime(iso){ if(!iso) return ''; try{ return new Date(iso).toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'}); }catch(e){ return ''; } }
// Date of a timestamp in Sydney local time as YYYY-MM-DD — matches how
// roster_shifts.shift_date is stored, so clock-ins map to the right day.
function _epYmd(iso){ try{
  const p=new Date(iso).toLocaleDateString('en-CA',{timeZone:'Australia/Sydney'}); // en-CA → YYYY-MM-DD
  return p;
}catch(e){ return (iso||'').slice(0,10); } }
// "08:00:00" → "8:00 am"
function _epHm(t){ if(!t) return ''; try{
  const p=t.split(':'); const d=new Date(); d.setHours(+p[0],+p[1]||0,0,0);
  return d.toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'});
}catch(e){ return t; } }
function _epRow(cells){
  return '<div style="display:grid;grid-template-columns:'+cells.map(c=>c.w||'1fr').join(' ')+';gap:12px;align-items:center;padding:11px 14px;border-bottom:1px solid var(--border);font-size:12.5px;">'+
    cells.map(c=>'<div style="'+(c.style||'')+'">'+c.v+'</div>').join('')+'</div>';
}

function _epOverview(b){
  const s=_epStaff;
  b.innerHTML=
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;">'+
      '<div style="border:1px solid var(--border);border-radius:11px;padding:16px;">'+
        '<div style="font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-bottom:10px;">Employment</div>'+
        _epKV('Team', s.team||'—')+_epKV('Type', ({full:'Full-time',part:'Part-time',casual:'Casual'})[s.type]||s.type)+_epKV('Max hours', s.maxHours+'h/week')+
        _epKV('Role', s.isHubAdmin?'Admin':(s.isTeamLead?'Team Lead':'Team Member'))+
      '</div>'+
      '<div id="epOvPay" style="border:1px solid var(--border);border-radius:11px;padding:16px;">'+
        '<div style="font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-bottom:10px;">Payroll (this week)</div>'+
        '<div style="color:var(--text-dim);font-size:12.5px;">Loading…</div>'+
      '</div>'+
    '</div>'+
    '<div style="margin-top:16px;color:var(--text-dim);font-size:12px;">Use the tabs above to see full clock-in history, punctuality, call logs and leave.</div>';
  _epOverviewPay();
}
function _epKV(k,v){ return '<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12.5px;"><span style="color:var(--text-dim);">'+k+'</span><span style="font-weight:600;">'+_cdEsc(String(v))+'</span></div>'; }

async function _epOverviewPay(){
  const box=document.getElementById('epOvPay'); if(!box) return;
  const s=_epStaff, full=(s.first+' '+s.last).trim();
  if(!(typeof _canPayroll==='function' && _canPayroll())){
    box.innerHTML='<div style="font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-bottom:10px;">Payroll</div><div style="color:var(--text-dim);font-size:12px;">Visible to the Accounts team only.</div>';
    return;
  }
  try{
    const rows=await _cdGet('payroll_rates?staff_name=eq.'+encodeURIComponent(full)+'&select=structure,std_rate,prem_rate,pay_cap&limit=1');
    if(!rows||!rows.length){ box.innerHTML='<div style="font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-bottom:10px;">Payroll</div><div style="color:var(--text-dim);font-size:12px;">No pay rate set.</div>'; return; }
    const r=rows[0], hrs=staffHoursWeek(s.id), cap=Number(r.pay_cap||0), std=Number(r.std_rate||0), prem=Number(r.prem_rate||0);
    let stdHrs,premHrs,stdPay,premPay;
    if(r.structure==='flat'){ stdHrs=hrs;premHrs=0;stdPay=hrs*std;premPay=0; }
    else { stdHrs=Math.min(hrs,cap);premHrs=Math.max(0,hrs-cap);stdPay=stdHrs*std;premPay=premHrs*prem; }
    const m=v=>'$'+v.toFixed(2);
    box.innerHTML='<div style="font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-bottom:10px;">Payroll (this week)</div>'+
      _epKV((r.structure==='flat'?'Flat':'Standard')+' '+m(std)+'/h', stdHrs.toFixed(1)+'h · '+m(stdPay))+
      (r.structure!=='flat'?_epKV('Premium '+m(prem)+'/h (>'+cap+'h)', premHrs>0?premHrs.toFixed(1)+'h · '+m(premPay):'—'):'')+
      '<div style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px;">'+_epKV('Total', m(stdPay+premPay))+'</div>';
  }catch(e){ box.innerHTML='<div style="color:var(--text-dim);font-size:12px;">Couldn\'t load payroll.</div>'; }
}

async function _epLoadClockins(reset){
  const s=_epStaff, full=(s.first+' '+s.last).trim();
  const off=_epPage.clockins*_EP_PAGE;
  try{
    const rows=await _cdGet('clock_log?staff_name=eq.'+encodeURIComponent(full)+'&order=ts.desc&limit='+_EP_PAGE+'&offset='+off+'&select=action,ts,origin,edited_by');
    const b=document.getElementById('empProfBody');
    let html = (reset ? '<div style="border:1px solid var(--border);border-radius:11px;overflow:hidden;">'+_epRow([{v:'Date',w:'1.4fr',style:'font-weight:700;color:var(--text-dim);font-size:10px;text-transform:uppercase;letter-spacing:.5px;'},{v:'Action',style:'font-weight:700;color:var(--text-dim);font-size:10px;text-transform:uppercase;letter-spacing:.5px;'},{v:'Time',style:'font-weight:700;color:var(--text-dim);font-size:10px;text-transform:uppercase;letter-spacing:.5px;'},{v:'Source',style:'font-weight:700;color:var(--text-dim);font-size:10px;text-transform:uppercase;letter-spacing:.5px;'}])
                        : (document.getElementById('_epClkRows')? '' : '')) ;
    if(reset && (!rows||!rows.length)){ b.innerHTML=_epEmpty('No clock-ins recorded.'); return; }
    const rowsHtml=(rows||[]).map(function(r){
      const inOut = r.action==='in'
        ? '<span style="color:#10b981;font-weight:700;">● In</span>'
        : '<span style="color:#f59e0b;font-weight:700;">● Out</span>';
      const src = r.edited_by ? ('manual · '+_cdEsc(r.edited_by)) : (r.origin||'app');
      return _epRow([{v:_epDate(r.ts),w:'1.4fr'},{v:inOut},{v:_epTime(r.ts)},{v:'<span style="color:var(--text-dim);font-size:11px;">'+_cdEsc(src)+'</span>'}]);
    }).join('');
    if(reset){
      b.innerHTML='<div id="_epClkWrap" style="border:1px solid var(--border);border-radius:11px;overflow:hidden;"><div id="_epClkRows">'+
        _epRow([{v:'Date',w:'1.4fr',style:'font-weight:700;color:var(--text-dim);font-size:10px;text-transform:uppercase;letter-spacing:.5px;'},{v:'Status',style:'font-weight:700;color:var(--text-dim);font-size:10px;text-transform:uppercase;letter-spacing:.5px;'},{v:'Time',style:'font-weight:700;color:var(--text-dim);font-size:10px;text-transform:uppercase;letter-spacing:.5px;'},{v:'Source',style:'font-weight:700;color:var(--text-dim);font-size:10px;text-transform:uppercase;letter-spacing:.5px;'}])+
        rowsHtml+'</div></div>'+
        ((rows&&rows.length===_EP_PAGE)?_epMoreBtn('clockins'):'');
    }else{
      const cont=document.getElementById('_epClkRows'); if(cont) cont.insertAdjacentHTML('beforeend', rowsHtml);
      const oldBtn=document.querySelector('#empProfBody .btn'); // remove old load-more
      if(!rows||rows.length<_EP_PAGE){ if(oldBtn&&oldBtn.parentNode) oldBtn.parentNode.remove(); }
    }
  }catch(e){ const b=document.getElementById('empProfBody'); if(reset&&b) b.innerHTML=_epEmpty('Couldn\'t load clock-ins.'); }
}

async function _epLoadCalls(reset){
  const s=_epStaff, full=(s.first+' '+s.last).trim();
  const off=_epPage.calls*_EP_PAGE;
  try{
    const rows=await _cdGet('call_log?logged_by=eq.'+encodeURIComponent(full)+'&deleted_at=is.null&order=created_at.desc&limit='+_EP_PAGE+'&offset='+off+'&select=caller_name,phone_e164,reason,note,created_at,resolved_at,for_team');
    const b=document.getElementById('empProfBody');
    if(reset && (!rows||!rows.length)){ b.innerHTML=_epEmpty('No calls logged by this employee.'); return; }
    const rowsHtml=(rows||[]).map(function(r){
      const status=r.resolved_at?'<span style="color:#10b981;">Handled</span>':'<span style="color:#f59e0b;">Waiting</span>';
      return _epRow([
        {v:_epDate(r.created_at),w:'1.1fr'},
        {v:'<span style="font-weight:600;">'+_cdEsc(r.caller_name||'—')+'</span><div style="font-size:11px;color:var(--text-dim);">'+_cdEsc(r.reason||'')+'</div>',w:'1.4fr'},
        {v:'<span style="font-size:11px;color:var(--text-dim);">'+_cdEsc(r.for_team||r.team||'')+'</span>'},
        {v:status}
      ]);
    }).join('');
    if(reset){
      b.innerHTML='<div style="border:1px solid var(--border);border-radius:11px;overflow:hidden;"><div id="_epCallRows">'+
        _epRow([{v:'Date',w:'1.1fr',style:'font-weight:700;color:var(--text-dim);font-size:10px;text-transform:uppercase;letter-spacing:.5px;'},{v:'Caller / Reason',w:'1.4fr',style:'font-weight:700;color:var(--text-dim);font-size:10px;text-transform:uppercase;letter-spacing:.5px;'},{v:'Team',style:'font-weight:700;color:var(--text-dim);font-size:10px;text-transform:uppercase;letter-spacing:.5px;'},{v:'Status',style:'font-weight:700;color:var(--text-dim);font-size:10px;text-transform:uppercase;letter-spacing:.5px;'}])+
        rowsHtml+'</div></div>'+((rows&&rows.length===_EP_PAGE)?_epMoreBtn('calls'):'');
    }else{
      const cont=document.getElementById('_epCallRows'); if(cont) cont.insertAdjacentHTML('beforeend', rowsHtml);
      if(!rows||rows.length<_EP_PAGE){ const btn=document.querySelector('#empProfBody .btn'); if(btn&&btn.parentNode) btn.parentNode.remove(); }
    }
  }catch(e){ const b=document.getElementById('empProfBody'); if(reset&&b) b.innerHTML=_epEmpty('Couldn\'t load call logs.'); }
}

// "Added by …" / "Requested … · Approved by …" line under each leave, so every leave shows who put it there.
function _epLeaveAudit(r,full){
  const when=function(iso){ if(!iso) return ''; try{ return new Date(iso).toLocaleString('en-AU',{timeZone:'Australia/Sydney',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}); }catch(e){ return ''; } };
  const strip=function(n){ return String(n||'').replace(/\s*\(added in profile\)\s*$/i,'').trim(); };
  let line='';
  const adminAdded=(r.source==='ShiftOps'||r.source==='Admin'||/added in profile/i.test(r.resolved_by||''));
  if(adminAdded){
    let by=(r.created_by&&r.created_by!==full)?r.created_by:strip(r.resolved_by);
    if(!by||/^admin(\s*\(shiftops\))?$/i.test(by)) by='an admin (name not recorded)';
    line='Added by '+by+(when(r.resolved_at||r.submitted_at)?' · '+when(r.resolved_at||r.submitted_at):'');
  }else{
    line='Requested by '+full+(when(r.submitted_at)?' · '+when(r.submitted_at):'');
    if(r.status==='approved'||r.status==='declined'){
      const _by=strip(r.resolved_by), _bad=!_by||/^admin(\s*\(shiftops\))?$/i.test(_by);
      line+=' · '+(r.status==='approved'?'Approved':'Declined')+(_bad?' (approver not recorded)':' by '+_by)+(when(r.resolved_at)?' · '+when(r.resolved_at):'');
    }
  }
  return '<div style="font-size:10.5px;color:var(--text-dim);opacity:.8;margin-top:2px;">'+_cdEsc(line)+'</div>';
}

async function _epLoadLeave(reset){
  const s=_epStaff, full=(s.first+' '+s.last).trim();
  const off=_epPage.leave*_EP_PAGE;
  try{
    // created_by exists once security_08 is applied; until then ask without it so the list never breaks.
    const _lvBase='leave_submissions?staff_name=eq.'+encodeURIComponent(full)+'&order=from_date.desc&limit='+_EP_PAGE+'&offset='+off+'&select=from_date,to_date,reason,status,reason_type,source,resolved_by,resolved_at,submitted_at';
    let rows=null;
    try{
      const r1=await fetch(SUPABASE_URL+'/rest/v1/'+_lvBase+',created_by',{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY}});
      if(r1.ok) rows=await r1.json();
    }catch(e){}
    if(rows===null) rows=await _cdGet(_lvBase);
    const b=document.getElementById('empProfBody');
    // Note: even with no records we still render the add-leave form below.
    const badge=st=>{ const c={approved:'#10b981',pending:'#f59e0b',declined:'#ef4444'}[st]||'var(--text-dim)'; return '<span style="color:'+c+';font-weight:700;text-transform:capitalize;">'+(st||'—')+'</span>'; };
    const rowsHtml=(rows||[]).map(function(r){
      const range=r.from_date===r.to_date?_epDate(r.from_date):(_epDate(r.from_date)+' → '+_epDate(r.to_date));
      return _epRow([{v:range,w:'1.6fr'},{v:'<span style="color:var(--text-dim);">'+_cdEsc(r.reason||r.reason_type||'')+'</span>'+_epLeaveAudit(r,full)},{v:badge(r.status)}]);
    }).join('');
    if(reset){
      const addForm=
        '<div style="border:1px solid var(--border);border-radius:11px;padding:14px 16px;margin-bottom:14px;background:var(--panel,rgba(255,255,255,.02));">'+
          '<div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;" onclick="_epToggleAddLeave()">'+
            '<div style="font-size:12.5px;font-weight:700;color:var(--text,#e6e9ef);">Add leave for '+_cdEsc(full)+'</div>'+
            '<button class="btn btn-primary" style="padding:6px 14px;font-size:12px;font-weight:700;" onclick="event.stopPropagation();_epToggleAddLeave()"><span id="_epAddLvCaret">+ Add leave</span></button>'+
          '</div>'+
          '<div id="_epAddLvBody" style="display:none;margin-top:14px;">'+
            '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;">'+
              '<div style="flex:1;min-width:130px;"><label style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-dim);font-weight:700;">From</label>'+
                '<input type="date" id="_epLvFrom" class="form-input" style="width:100%;"></div>'+
              '<div style="flex:1;min-width:130px;"><label style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-dim);font-weight:700;">To</label>'+
                '<input type="date" id="_epLvTo" class="form-input" style="width:100%;"></div>'+
            '</div>'+
            '<div style="margin-bottom:10px;"><label style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-dim);font-weight:700;">Reason</label>'+
              '<select id="_epLvReason" class="form-input" style="width:100%;" onchange="_epLvReasonChange()">'+
                '<option value="">Select a reason…</option>'+
                '<option>Time off / away</option><option>Sick leave</option><option>Medical appointment</option>'+
                '<option>Family / carer\'s</option><option>Study / exam</option><option>Travel</option>'+
                '<option>Family loss / funeral</option><option>Other</option>'+
              '</select></div>'+
            '<div id="_epLvOtherWrap" style="display:none;margin-bottom:10px;"><label style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-dim);font-weight:700;">Please specify</label>'+
              '<input type="text" id="_epLvOther" class="form-input" maxlength="200" placeholder="Briefly describe the reason" style="width:100%;"></div>'+
            '<div id="_epLvMsg" style="font-size:12px;margin-bottom:8px;"></div>'+
            '<div style="display:flex;justify-content:flex-end;gap:8px;">'+
              '<button class="btn btn-ghost" style="padding:8px 16px;font-size:12px;" onclick="_epToggleAddLeave()">Cancel</button>'+
              '<button class="btn btn-primary" id="_epLvSaveBtn" style="padding:8px 18px;font-size:12px;font-weight:700;" onclick="_epAddLeave()">Add as approved</button>'+
            '</div>'+
          '</div>'+
        '</div>';
      b.innerHTML=addForm+'<div style="border:1px solid var(--border);border-radius:11px;overflow:hidden;"><div id="_epLvRows">'+
        _epRow([{v:'Dates',w:'1.6fr',style:'font-weight:700;color:var(--text-dim);font-size:10px;text-transform:uppercase;letter-spacing:.5px;'},{v:'Reason',style:'font-weight:700;color:var(--text-dim);font-size:10px;text-transform:uppercase;letter-spacing:.5px;'},{v:'Status',style:'font-weight:700;color:var(--text-dim);font-size:10px;text-transform:uppercase;letter-spacing:.5px;'}])+
        rowsHtml+'</div></div>'+((rows&&rows.length===_EP_PAGE)?_epMoreBtn('leave'):'');
    }else{
      const cont=document.getElementById('_epLvRows'); if(cont) cont.insertAdjacentHTML('beforeend', rowsHtml);
      if(!rows||rows.length<_EP_PAGE){ const btn=document.querySelector('#empProfBody .btn'); if(btn&&btn.parentNode) btn.parentNode.remove(); }
    }
  }catch(e){ const b=document.getElementById('empProfBody'); if(reset&&b) b.innerHTML=_epEmpty('Couldn\'t load leave.'); }
}

// Add-leave form controls (admin adds an already-approved leave for this staffer).
function _epToggleAddLeave(){
  const body=document.getElementById('_epAddLvBody');
  const caret=document.getElementById('_epAddLvCaret');
  if(!body) return;
  const open=body.style.display!=='none';
  body.style.display=open?'none':'block';
  if(caret) caret.textContent=open?'+ Add leave':'Close';
}
function _epLvReasonChange(){
  const sel=document.getElementById('_epLvReason');
  const wrap=document.getElementById('_epLvOtherWrap');
  if(sel&&wrap) wrap.style.display=(sel.value==='Other')?'block':'none';
}
// Who is signed in, as verified by the launch gate (derived server-side from the login).
// ShiftOps never defined `currentUser`, so audit fields used to fall back to 'Admin'/'Manager'/null.
function _soWho(){ try{ return (sessionStorage.getItem('so_me')||'').trim(); }catch(e){ return ''; } }
// "by Abhishek Karki · 27 Oct, 2:07 pm" under an approved / declined leave. Requests staff raised in Nexus only;
// admin-entered leave already says "Added".
function _lvDecisionLine(r){
  try{
    if(!(r.status==='approved'||r.status==='declined')) return '';
    if((r.source||'').toLowerCase()==='admin') return '';
    let by=String(r.resolved_by||'').replace(/\s*\(added in profile\)\s*$/i,'').trim();
    if(/^admin(\s*\(shiftops\))?$/i.test(by)) by='';
    let when='';
    if(r.resolved_at){ try{ when=new Date(r.resolved_at).toLocaleString('en-AU',{timeZone:'Australia/Sydney',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}); }catch(e){} }
    const txt=(by?'by '+by:'approver not recorded')+(when?' · '+when:'');
    return '<div class="lv-decided" style="font-size:10.5px;line-height:1.3;color:var(--text-dim);opacity:.85;margin-top:3px;white-space:nowrap;">'+_cdEsc(txt)+'</div>';
  }catch(e){ return ''; }
}

async function _epAddLeave(){
  const s=_epStaff; if(!s) return;
  const full=(s.first+' '+s.last).trim();
  const from=document.getElementById('_epLvFrom').value;
  const to=document.getElementById('_epLvTo').value;
  const sel=document.getElementById('_epLvReason').value;
  const otherTxt=(document.getElementById('_epLvOther').value||'').trim();
  const msg=document.getElementById('_epLvMsg');
  const setMsg=(t,c)=>{ if(msg){ msg.textContent=t; msg.style.color=c||'#ef4444'; } };
  if(!from||!to){ setMsg('Please choose both dates.'); return; }
  if(from>to){ setMsg('End date must be on or after start date.'); return; }
  if(!sel){ setMsg('Please choose a reason.'); return; }
  if(sel==='Other' && !otherTxt){ setMsg('Please specify the reason.'); return; }
  const reason=(sel==='Other')?otherTxt:sel;
  const who=_soWho();
  if(!who){ setMsg('Could not confirm who you are. Reopen ShiftOps from Nexus, then try again.'); return; }
  const btn=document.getElementById('_epLvSaveBtn');
  if(btn){ btn.disabled=true; btn.textContent='Adding…'; }
  try{
    // Admin-added → approved immediately. resolved_by/resolved_at record who and when; the database also
    // stamps created_by from the login itself (security_08), which the browser cannot fake.
    const res=await fetch(SUPABASE_URL+'/rest/v1/leave_submissions',{
      method:'POST',
      headers:{'apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify({
        staff_name:full, from_date:from, to_date:to, reason:reason, reason_type:sel,
        status:'approved', source:'ShiftOps', resolved_by:(who+' (added in profile)'), resolved_at:new Date().toISOString()
      })
    });
    if(!(res.ok||res.status===201)) throw new Error('insert failed '+res.status);
    setMsg('Leave added and approved.', '#10b981');
    // Reset + refresh the list so the new row shows immediately.
    document.getElementById('_epLvFrom').value='';
    document.getElementById('_epLvTo').value='';
    document.getElementById('_epLvReason').value='';
    const ow=document.getElementById('_epLvOtherWrap'); if(ow) ow.style.display='none';
    _epPage.leave=0;
    setTimeout(function(){ _epLoadLeave(true); }, 500);
  }catch(e){
    setMsg('Could not add leave — try again.');
    if(btn){ btn.disabled=false; btn.textContent='Add as approved'; }
  }
}

// Punctuality: pair each day's first clock-in against the rostered start isn't
// trivially available here, so we show each clock-in day with its first punch
// time and flag notably late mornings (after 9:30) as a light heuristic.
async function _epLoadPunctuality(reset){
  const s=_epStaff, full=(s.first+' '+s.last).trim();
  const off=_epPage.punctuality*_EP_PAGE;
  try{
    // Pull 'in' punches, newest first; each row is a day's clock-in.
    const rows=await _cdGet('clock_log?staff_name=eq.'+encodeURIComponent(full)+'&action=eq.in&order=ts.desc&limit='+_EP_PAGE+'&offset='+off+'&select=ts');
    const b=document.getElementById('empProfBody');
    if(reset && (!rows||!rows.length)){ b.innerHTML=_epEmpty('No clock-ins to assess.'); return; }
    // Fetch this person's rostered starts for the dates in view, so we compare
    // each clock-in against their ACTUAL rostered start — not a fixed 9am guess.
    const dates=(rows||[]).map(function(r){ return _epYmd(r.ts); });
    const uniqDates=Array.from(new Set(dates));
    let rosterByDate={};
    if(uniqDates.length){
      try{
        const inList=uniqDates.map(function(d){return '"'+d+'"';}).join(',');
        const rs=await _cdGet('roster_shifts?staff_name=eq.'+encodeURIComponent(full)+
          '&shift_date=in.('+inList+')&select=shift_date,start_time');
        (rs||[]).forEach(function(r){ if(r.shift_date && r.start_time) rosterByDate[r.shift_date]=r.start_time; });
      }catch(e){}
    }
    const rowsHtml=(rows||[]).map(function(r){
      const d=new Date(r.ts);
      const inMins=d.getHours()*60+d.getMinutes();
      const ymd=_epYmd(r.ts);
      const st=rosterByDate[ymd];
      let tag;
      if(!st){
        // No rostered shift on record for that day → can't assess honestly.
        tag='<span style="color:var(--text-dim);">No roster</span>';
      }else{
        const parts=st.split(':');
        const startMins=(+parts[0])*60+(+parts[1]);
        const late=inMins-startMins;           // minutes after rostered start
        if(late<=5) tag='<span style="color:#10b981;font-weight:700;">On time</span>';
        else if(late<=15) tag='<span style="color:#f59e0b;font-weight:700;">'+late+' min late</span>';
        else tag='<span style="color:#ef4444;font-weight:700;">'+late+' min late</span>';
      }
      const startLabel=st?(' · rostered '+_epHm(st)):'';
      return _epRow([{v:_epDate(r.ts),w:'1.4fr'},{v:_epTime(r.ts)+'<span style="color:var(--text-dim);font-size:10px;">'+startLabel+'</span>'},{v:tag}]);
    }).join('');
    if(reset){
      b.innerHTML='<div style="font-size:11.5px;color:var(--text-dim);margin-bottom:12px;">Each day\'s first clock-in compared against that person\'s rostered start (5-min grace). Days with no rostered shift on record show \u201cNo roster.\u201d</div>'+
        '<div style="border:1px solid var(--border);border-radius:11px;overflow:hidden;"><div id="_epPunRows">'+
        _epRow([{v:'Date',w:'1.4fr',style:'font-weight:700;color:var(--text-dim);font-size:10px;text-transform:uppercase;letter-spacing:.5px;'},{v:'Clock-in',style:'font-weight:700;color:var(--text-dim);font-size:10px;text-transform:uppercase;letter-spacing:.5px;'},{v:'Assessment',style:'font-weight:700;color:var(--text-dim);font-size:10px;text-transform:uppercase;letter-spacing:.5px;'}])+
        rowsHtml+'</div></div>'+((rows&&rows.length===_EP_PAGE)?_epMoreBtn('punctuality'):'');
    }else{
      const cont=document.getElementById('_epPunRows'); if(cont) cont.insertAdjacentHTML('beforeend', rowsHtml);
      if(!rows||rows.length<_EP_PAGE){ const btn=document.querySelector('#empProfBody .btn'); if(btn&&btn.parentNode) btn.parentNode.remove(); }
    }
  }catch(e){ const b=document.getElementById('empProfBody'); if(reset&&b) b.innerHTML=_epEmpty('Couldn\'t load punctuality.'); }
}

function editStaff(id){
  const s=staff.find(x=>x.id===id);if(!s)return;
  editingStaffId=id;
  window._editingOldName = (s.first+' '+s.last).trim();  // remember name BEFORE edit, to detect renames
  document.getElementById('staffFirstName').value=s.first;
  document.getElementById('staffLastName').value=s.last;
  populateTeamSelect(s.team);
  const roleVal=s.isOfficeManager||s.isManager==='office'?'office':'false';
  document.getElementById('staffIsManager').value=roleVal;
  document.getElementById('staffType').value=s.type;
  document.getElementById('staffMaxHours').value=s.maxHours;
  onRoleChange(document.getElementById('staffIsManager'));
  // Show access & admin section + load THIS person's access
  const adminSec = document.getElementById('staffAdminSection');
  if(adminSec) adminSec.style.display = '';
  loadStaffAccess(s);
  loadStaffExtraTeams((s.first+' '+s.last).trim(), s.team);
  // The full profile page now carries the summary — keep the modal as a pure
  // edit form. Hide the old in-modal profile panel if it exists.
  const _oldPanel=document.getElementById('empProfilePanel');
  if(_oldPanel){ _oldPanel.style.display='none'; _oldPanel.innerHTML=''; }
  document.getElementById('staffModalTitle').textContent='Edit Employee';
  openModal('staffModal');
}



// Multi-team ("Also on teams") removed — single team per staffer via staff_directory.
// Kept as a no-op so existing call sites don't error.
async function loadStaffExtraTeams(fullName, primaryTeam){ /* no-op: single-team model */ }

// Load one staff member's app access + admin flag into the edit panel
async function loadStaffAccess(s){
  const full = (s.first + ' ' + s.last).trim();
  const adminBox = document.getElementById('saAccess_admin');
  // Read the admin flag fresh from the DB (the in-memory staff object can be
  // stale, which left the Admin box unticked for real admins).
  if(adminBox){
    adminBox.checked = !!s.isHubAdmin; // optimistic, corrected below
    try{
      const arows = await aaGet('staff_settings?select=is_hub_admin,is_shift_admin&name=eq.'+encodeURIComponent(full));
      if(arows && arows.length){
        adminBox.checked = arows[0].is_hub_admin === true;
        // Remember the lead flag so the Team Lead box below can reflect it.
        window._saLeadFlag = arows[0].is_shift_admin === true;
      } else { window._saLeadFlag = false; }
    }catch(e){ console.warn('loadStaffAccess admin flag', e); window._saLeadFlag = false; }
  }
  // app access — read this person's rows from app_access
  ['formcraft','slip','nex','borekade','shiftops'].forEach(a=>{ const b=document.getElementById('saAccess_'+a); if(b) b.checked=false; });
  try{
    const rows = await aaGet('app_access?select=app&staff_name=eq.'+encodeURIComponent(full));
    (rows||[]).forEach(r=>{ const b=document.getElementById('saAccess_'+r.app); if(b) b.checked=true; });
  }catch(e){ console.warn('loadStaffAccess', e); }
  // Team Lead box reflects is_shift_admin (the flag both apps now use), not just
  // the raw app_access row — a lead may predate this and lack one or the other.
  { const so=document.getElementById('saAccess_shiftops'); if(so && window._saLeadFlag) so.checked=true; }
  // if admin, shiftops is implied + locked on
  if(adminBox && adminBox.checked){ onStaffAdminToggle(adminBox); }
  else{ const so=document.getElementById('saAccess_shiftops'); if(so){ so.disabled=false; so.parentElement.style.opacity='1'; } }
}

// Admin checkbox forces ShiftOps access on (and locks the box while Admin)
function onStaffAdminToggle(box){
  const so=document.getElementById('saAccess_shiftops');
  if(!so) return;
  if(box.checked){ so.checked=true; so.disabled=true; so.parentElement.style.opacity='.7'; }
  else{ so.disabled=false; so.parentElement.style.opacity='1'; }
}

// Persist the edit panel's access choices for one staff member
async function saveStaffAccess(fullName){
  if(!fullName) return;
  // RLS on app_access / staff_settings requires the AUTHENTICATED role. The
  // anon key alone is rejected, so admin/team-lead changes silently failed.
  // Use the signed-in user's token for Authorization (apikey stays the anon
  // public key, which is correct). Fall back to anon only if no token.
  const _tok = (typeof _soTok==='function' && _soTok()) ? _soTok() : AA_KEY;
  const H={apikey:AA_KEY,Authorization:'Bearer '+_tok};
  const HJ={...H,'Content-Type':'application/json'};
  const jobs=[];
  const isAdmin = !!(document.getElementById('saAccess_admin')||{}).checked;
  // Team Lead checkbox = ShiftOps read-only lead access. It also drives the
  // Nexus Team Report, which keys leads off staff_settings.is_shift_admin — so
  // ticking Team Lead must set that flag, not just app_access. Admins are always
  // leads too (is_shift_admin follows is_hub_admin).
  const wantLead = isAdmin || !!(document.getElementById('saAccess_shiftops')||{}).checked;
  // app_access for the 3 apps. Admin ALWAYS gets ShiftOps access, even if the
  // ShiftOps box is unticked — admin rights require it.
  for(const app of ['formcraft','slip','nex','borekade','shiftops']){
    let want = (document.getElementById('saAccess_'+app)||{}).checked;
    if(app==='shiftops' && isAdmin) want = true;
    if(want){
      jobs.push(fetch(AA_SB+'/rest/v1/app_access',{method:'POST',headers:{...HJ,'Prefer':'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({app:app,staff_name:fullName})}));
    }else{
      jobs.push(fetch(AA_SB+'/rest/v1/app_access?app=eq.'+encodeURIComponent(app)+'&staff_name=eq.'+encodeURIComponent(fullName),{method:'DELETE',headers:H}));
    }
  }
  // admin flag → is_hub_admin; lead flag → is_shift_admin (set by the Team Lead
  // box, and always true for admins).
  // NOTE: a plain POST upsert 409s for anyone who already has a staff_settings
  // row (the merge-duplicates upsert doesn't resolve to an UPDATE, it tries to
  // INSERT and hits unique(name)). Every existing staffer has a row, so admin
  // changes silently failed. PATCH the existing row; only POST if none exists.
  let _adminWriteFailed = null;
  jobs.push((async ()=>{
    const patchUrl = AA_SB+'/rest/v1/staff_settings?name=eq.'+encodeURIComponent(fullName);
    const pr = await fetch(patchUrl,{method:'PATCH',
      headers:{...HJ,'Prefer':'return=representation'},
      body:JSON.stringify({is_hub_admin:isAdmin,is_shift_admin:wantLead})});
    if(pr.ok){
      const rows = await pr.json().catch(()=>[]);
      if(rows && rows.length) return;           // updated existing row
    } else {
      _adminWriteFailed = 'HTTP '+pr.status+' '+(await pr.text().catch(()=>''));
    }
    // No row to update → insert one.
    const ir = await fetch(AA_SB+'/rest/v1/staff_settings',{method:'POST',
      headers:{...HJ,'Prefer':'return=minimal'},
      body:JSON.stringify({name:fullName,is_hub_admin:isAdmin,is_shift_admin:wantLead})});
    if(!ir.ok){ _adminWriteFailed = 'HTTP '+ir.status+' '+(await ir.text().catch(()=>'')); }
    else { _adminWriteFailed = null; }   // insert succeeded, clear the patch note
  })());
  try{ await Promise.all(jobs.map(p=>p.catch(e=>{console.warn('saveStaffAccess job',e); _adminWriteFailed = _adminWriteFailed || (e && e.message) || 'error';}))); }catch(e){ console.warn('saveStaffAccess',e); }
  // Surface an admin-flag write failure instead of swallowing it — this was the
  // "made them admin but nothing happened" bug.
  if(_adminWriteFailed){
    try{ showToast('Admin role not saved: '+_relayErrMsg(_adminWriteFailed)); }catch(e){}
  }
}

function modalSetPassword(){
  if(!editingStaffId) return;
  resetStaffPasswordById(editingStaffId);
}

function populateTeamSelect(selectedTeam){
  const sel=document.getElementById('staffTeam');
  const list=[...teams];
  if(selectedTeam && list.indexOf(selectedTeam)<0) list.push(selectedTeam);   // never show someone as another team
  sel.innerHTML=list.sort().map(t=>`<option value="${t}"${t===selectedTeam?' selected':''}>${t}</option>`).join('');
}
/**
 * Employment type drives who gets told about an open shift, so it needs a
 * durable home rather than living in the blob. Keyed by name so it survives
 * id churn and renames (renameStaffEverywhere handles the rename case).
 */
async function saveRosterConfig(fullName, type, maxHours){
  if(!fullName) return;
  try{
    await fetch(SUPABASE_URL+'/rest/v1/staff_roster_config',{
      method:'POST',
      headers:Object.assign({Prefer:'resolution=merge-duplicates,return=minimal'},_DB_H),
      body:JSON.stringify({staff_name:fullName,
                           employment_type:type||'full',
                           max_hours:(typeof maxHours==='number'&&!isNaN(maxHours))?maxHours:38})
    });
  }catch(e){ console.warn('saveRosterConfig',e); }
}

async function saveStaff(){
  const first=document.getElementById('staffFirstName').value.trim();
  const last=document.getElementById('staffLastName').value.trim();
  const team=document.getElementById('staffTeam').value;
  const roleVal=document.getElementById('staffIsManager').value;
  const isManager=false;
  const isOfficeManager=roleVal==='office';
  const type=document.getElementById('staffType').value;
  const maxHours=parseInt(document.getElementById('staffMaxHours').value);
  const birthday=(document.getElementById('staffBirthday')||{}).value||null;
  const pronouns=((document.getElementById('staffPronouns')||{}).value||'').trim();
  const email=((document.getElementById('staffEmail')||{}).value||'').trim();
  if(!first||!last){showToast('Please enter a full name');return;}
  // Multiple office managers allowed
  if(editingStaffId){
    const s=staff.find(x=>x.id===editingStaffId);
    const oldName = (window._editingOldName||'').trim();
    const newName = (first+' '+last).trim();
    if(s){s.first=first;s.last=last;s.team=team;s.isManager=isOfficeManager?'office':isManager;s.isOfficeManager=isOfficeManager;s.type=type;s.maxHours=maxHours;s.birthday=birthday;s.pronouns=pronouns;s.email=email;}
    // If the NAME changed, RENAME the existing rows instead of letting the sync
    // create a duplicate (the old Monika/Monica, Muhammad/Muahmmad bug).
    if(oldName && newName && oldName.toLowerCase() !== newName.toLowerCase()){
      await renameStaffEverywhere(oldName, newName);
    }
    window._editingOldName = null;
    await saveStaffAccess(newName);   // persist app access + admin flag for this person
    await addStaffToSupabase(newName, team); // persist team → staff_directory + staff_credentials (staff_teams retired)
    await saveRosterConfig(newName, type, maxHours);   // employment type → who gets shift-open emails
    // Personal details (DOB / pronouns / email) → staff_credentials only.
    // staff_directory is a VIEW over it, so writing there fails — the view
    // reflects the credentials automatically. Needs the AUTHENTICATED token
    // (admins can update any row via the sc_admin_write policy); the anon key
    // is rejected by RLS.
    try{
      const _ptok=(typeof _soTok==='function' && _soTok())?_soTok():SUPABASE_KEY;
      const _pH={apikey:SUPABASE_KEY, Authorization:'Bearer '+_ptok, 'Content-Type':'application/json'};
      const body=JSON.stringify({pronouns:pronouns||null, birthday:birthday||null, email:email||null});
      const _pr=await fetch(SUPABASE_URL+'/rest/v1/staff_credentials?staff_name=eq.'+encodeURIComponent(newName),
        {method:'PATCH',headers:{..._pH,'Prefer':'return=minimal'},body:body});
      if(!_pr.ok){ console.warn('personal details save HTTP', _pr.status, await _pr.text().catch(()=> '')); showToast('Personal details not saved'); }
    }catch(e){ console.warn('save personal details',e); }
    // keep local admin flag in sync so the row badge updates without a reload
    if(s){ const isAdmin=!!(document.getElementById('saAccess_admin')||{}).checked; s.isHubAdmin=isAdmin; s.isShiftAdmin=isAdmin; s.isTeamLead=(!!(document.getElementById('saAccess_shiftops')||{}).checked) && !isAdmin; }
    // Role may have changed (admin ↔ team lead). Clear the latch and re-resolve
    // so the read-only lock updates this session instead of only after reload.
    try{ _tlResolved=false; if(typeof applyTeamLeadLock==='function') applyTeamLeadLock(); }catch(e){}
    closeModal('staffModal');forceSave();renderAll();showToast('Staff updated');pushStaffNames();
  }else{
    const s={id:nextStaffId++,first,last,team,isManager:isOfficeManager?'office':isManager,isOfficeManager,type,maxHours,birthday,pronouns,email,color:COLORS[(nextStaffId-2)%COLORS.length]};
    staff.push(s);shifts[s.id]={};availability[s.id]={};
    const fullName=(first+' '+last).trim();
    closeModal('staffModal');forceSave();renderAll();
    // Roster + login + welcome email now run inside a panel that stays open until
    // the admin closes it, so the result (and any temporary password) can't be missed.
    obStart({s,fullName,first,last,team,type,maxHours,email,birthday,pronouns});
  }
}
// Insert ONE new staff member into the Nexus-facing tables. INSERT-ONLY — it
// never deletes/prunes, so it's safe to call even when the roster is
// Supabase-backed (unlike pushStaffNames, which prunes and is guarded off).
// Writes name ->staff_names, name+team ->staff_directory + staff_credentials,
// using merge-duplicates so re-adding an existing name just updates the team.
async function addStaffToSupabase(fullName, team){
  if(!fullName) return;
  const H={apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY,'Content-Type':'application/json'};
  const enc=encodeURIComponent;
  const t=(team==='Office')?null:(team||null);
  try{
    // staff_names (canonical roster that loadStaffFromSupabase reads on reload)
    await fetch(SUPABASE_URL+'/rest/v1/staff_names',{
      method:'POST',headers:Object.assign({Prefer:'resolution=merge-duplicates,return=minimal'},H),
      body:JSON.stringify({name:fullName})
    }).catch(function(){});

    // staff_directory (name + team) — update if present, else insert
    const up=await fetch(SUPABASE_URL+'/rest/v1/staff_directory?staff_name=eq.'+enc(fullName),{
      method:'PATCH',headers:Object.assign({Prefer:'return=representation'},H),
      body:JSON.stringify({team:t})
    });
    let rows=[]; try{ rows=await up.json(); }catch(e){}
    if(!Array.isArray(rows) || rows.length===0){
      await fetch(SUPABASE_URL+'/rest/v1/staff_directory',{
        method:'POST',headers:Object.assign({Prefer:'return=minimal'},H),
        body:JSON.stringify({staff_name:fullName,team:t})
      }).catch(function(){});
    }

    // staff_credentials — set team if a row exists (auth created separately via
    // adminSetPw); if none yet, insert a minimal row carrying name+team so the
    // directory shows them immediately. password_hash='' satisfies NOT NULL.
    const cu=await fetch(SUPABASE_URL+'/rest/v1/staff_credentials?select=staff_name&staff_name=eq.'+enc(fullName),{
      method:'PATCH',headers:Object.assign({Prefer:'return=representation'},H),
      body:JSON.stringify({team:t})
    });
    let crows=[]; try{ crows=await cu.json(); }catch(e){}
    if(!Array.isArray(crows) || crows.length===0){
      await fetch(SUPABASE_URL+'/rest/v1/staff_credentials',{
        method:'POST',headers:Object.assign({Prefer:'return=minimal'},H),
        body:JSON.stringify({staff_name:fullName,team:t,password_hash:''})
      }).catch(function(){});
    }
  }catch(e){ console.warn('addStaffToSupabase failed', e); }
}


function removeStaff(id){
  const s=staff.find(x=>x.id===id);
  if(!s)return;
  const name=`${s.first} ${s.last}`;
  if(!confirm(` Remove ${name}?\n\nThis removes them from the roster, deletes their login so they can no longer sign in, and revokes app access.\n\nWork records (hours, leave) are kept for payroll. This cannot be undone.`))return;
  staff=staff.filter(x=>x.id!==id);
  delete shifts[id];
  delete availability[id];
  forceSave();renderAll();showToast(`${name} removed`);
  pushStaffNames();
  // ── OFFBOARD: kill the login + revoke access (records kept) ──
  offboardStaffAccess(name);
}

// Deletes the Supabase Auth user (via Apps Script, which holds the service key)
// and revokes app access. Work history (clock_log, leave) is intentionally KEPT.
async function offboardStaffAccess(fullName){
  try{
    // 1. Delete the auth login + credentials (server-side, service key)
    const r = await fetch(GAS_EXEC_URL,{
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify({action:'offboardStaff', staff: fullName, token: GAS_TOKEN, sbAccessToken:_soTok()})
    });
    let ok=false, relayErr='';
    try{ const j=await r.json(); ok = j && j.ok; if(!ok) relayErr=(j&&j.error)||''; }catch(e){}
    // 2. Revoke app access (anon can delete app_access). The roster tables
    //    (staff_names/directory/settings/availability) are deleted server-side
    //    by the relay's offboardStaff handler, because RLS blocks anon DELETE
    //    on those — doing it here would silently fail and the staff would
    //    resurrect on reload. Work history (clock_log, leave) is KEPT.
    try{
      const H={apikey:AA_KEY,Authorization:'Bearer '+AA_KEY};
      await fetch(AA_SB+'/rest/v1/app_access?staff_name=eq.'+encodeURIComponent(fullName),{method:'DELETE',headers:H});
    }catch(e){}
    showToast(ok ? (fullName+' login disabled')
                 : (fullName+' — login delete failed: '+_relayErrMsg(relayErr)));
  }catch(e){
    showToast('Removed locally — login delete failed, check Apps Script');
  }
}

