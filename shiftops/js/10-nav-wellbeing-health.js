// ── TABS & NAV ────────────────────────────────────────────────────────────
function showSubTab(id){
  ['list','teamview','manageteams','leave','leavesummary','health','wellbeing'].forEach(s=>{
    const el=document.getElementById(`subsection-${s}`);
    const tab=document.getElementById(`subtab-${s}`);
    if(el)el.style.display=s===id?'block':'none';
    if(tab)tab.classList.toggle('active',s===id);
  });
  if(id==='teamview')renderRoleView();
  if(id==='manageteams')renderTeams();
  if(id==='leave')renderLeave();
  if(id==='leavesummary')renderLeaveSummary();
  if(id==='health')loadHealthChecks();
  if(id==='wellbeing')loadWellbeingLog();
  try{ applyTeamLeadLock(); }catch(e){}
}

// ── WELLBEING LOG (admin) ──────────────────────────────────────────────────
// Reads wellbeing_popup_log (written by Nexus when a check-in popup is shown).
// RLS lets only hub admins read it, so anyone else just gets an empty list.
const _WBL_LABEL={late_some:'Late to a few shifts',late_a_lot:'More than an hour late',sick_calls:'Called in sick'};
let _wbLogRows=[], _wbLogRule='', _wbLogQ='';
async function loadWellbeingLog(){
  const box=document.getElementById('wbLogContent'); if(!box) return;
  box.innerHTML='<div style="font-size:12.5px;color:var(--text-dim);">Loading…</div>';
  try{
    const tok=(typeof _soTok==='function'&&_soTok())?_soTok():SUPABASE_KEY;
    const r=await fetch(SUPABASE_URL+'/rest/v1/wellbeing_popup_log?select=staff_name,rule,n,shown_at&order=shown_at.desc&limit=1000',
      {headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+tok}});
    if(!r.ok){
      box.innerHTML='<div style="font-size:13px;color:var(--text-dim);padding:18px 0;">'+(r.status===404
        ? 'The log table does not exist yet. Run scripts/sql/wellbeing-popup-log.sql in Supabase first.'
        : 'Could not load the log (error '+r.status+').')+'</div>';
      return;
    }
    _wbLogRows=await r.json().catch(function(){ return []; });
    if(!Array.isArray(_wbLogRows)) _wbLogRows=[];
  }catch(e){ box.innerHTML='<div style="font-size:13px;color:var(--text-dim);padding:18px 0;">Could not load the log. Check your connection and try again.</div>'; return; }
  _wbLogRender();
}
function _wbLogSetRule(k){ _wbLogRule=k; _wbLogRender(); }
function _wbLogSetQ(v){ _wbLogQ=v; _wbLogRender(true); }
function _wbLogRender(keepFocus){
  const box=document.getElementById('wbLogContent'); if(!box) return;
  const e=_cdEsc, q=_wbLogQ.trim().toLowerCase();
  const rows=_wbLogRows.filter(function(r){ return (!_wbLogRule||r.rule===_wbLogRule)&&(!q||String(r.staff_name||'').toLowerCase().indexOf(q)>=0); });
  const cnt={}; _wbLogRows.forEach(function(r){ cnt[r.rule]=(cnt[r.rule]||0)+1; });
  const pill=function(k,l,n){ return '<div class="role-pill'+(_wbLogRule===k?' active':'')+'" onclick="_wbLogSetRule(\''+k+'\')">'+l+' <span class="rp-n">'+n+'</span></div>'; };
  const fmt=function(t){ try{ return new Date(t).toLocaleString('en-AU',{timeZone:'Australia/Sydney',day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'}); }catch(x){ return ''; } };
  let h='<div class="role-filter-bar" role="group" aria-label="Filter by popup">'+pill('','All',_wbLogRows.length)+
    Object.keys(_WBL_LABEL).map(function(k){ return pill(k,_WBL_LABEL[k],cnt[k]||0); }).join('')+'</div>'+
    '<input id="wbLogQ" type="search" placeholder="Search by name" value="'+e(_wbLogQ)+'" oninput="_wbLogSetQ(this.value)" aria-label="Search by name" style="margin:10px 0 12px;padding:8px 12px;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--text);font:inherit;font-size:13px;width:min(320px,100%);">';
  if(!rows.length){
    h+='<div style="padding:28px 0;color:var(--text-dim);font-size:13px;">'+(_wbLogRows.length?'Nothing matches.':'No wellbeing popups have been shown yet.')+'</div>';
  } else {
    h+='<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;">'+
      '<div style="display:grid;grid-template-columns:minmax(120px,1.2fr) minmax(140px,1.4fr) minmax(130px,1fr);gap:12px;padding:9px 16px;font-size:11px;color:var(--text-dim);border-bottom:1px solid var(--border);"><span>Staff</span><span>Popup</span><span>Shown (Sydney time)</span></div>'+
      rows.map(function(r,i){
        return '<div style="display:grid;grid-template-columns:minmax(120px,1.2fr) minmax(140px,1.4fr) minmax(130px,1fr);gap:12px;padding:10px 16px;font-size:13px;align-items:center;'+(i?'border-top:1px solid var(--border);':'')+'">'+
          '<span style="font-weight:600;">'+e(r.staff_name)+'</span>'+
          '<span>'+e(_WBL_LABEL[r.rule]||r.rule)+(r.n?' <span style="color:var(--text-dim)">('+e(r.n)+')</span>':'')+'</span>'+
          '<span style="color:var(--text-dim);font-variant-numeric:tabular-nums;">'+e(fmt(r.shown_at))+'</span></div>';
      }).join('')+'</div>'+
      (_wbLogRows.length>=1000?'<div style="font-size:12px;color:var(--text-dim);margin-top:8px;">Showing the latest 1000.</div>':'');
  }
  box.innerHTML=h;
  if(keepFocus){ const i=document.getElementById('wbLogQ'); if(i){ i.focus(); try{ i.setSelectionRange(i.value.length,i.value.length); }catch(x){} } }
}

// ── SYSTEM HEALTH ──────────────────────────────────────────────
// Surfaces data problems (open shifts, missing availability, name drift,
// pending leave) so they're caught before they become mysteries.
async function loadHealthChecks(){
  const box=document.getElementById('healthContent');
  if(!box) return;
  box.innerHTML='<div style="font-size:12.5px;color:var(--text-dim);">Checking…</div>';
  let rows=[];
  try{
    const r=await fetch(SUPABASE_URL+'/rest/v1/rpc/admin_health_checks',{
      method:'POST',
      headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY,'Content-Type':'application/json'},
      body:'{}'
    });
    rows = r.ok ? await r.json() : [];
  }catch(e){
    box.innerHTML='<div style="font-size:12.5px;color:var(--danger,#e5484d);">Couldn\u2019t run health checks.</div>';
    return;
  }

  const badge=document.getElementById('healthBadge');
  const crit=rows.filter(r=>r.severity==='crit').length;
  const warn=rows.filter(r=>r.severity==='warn').length;
  if(badge){
    const n=crit+warn;
    badge.textContent=n; badge.style.display=n?'inline-block':'none';
    badge.style.background = crit?'#e5484d':'#f5a524';
  }

  if(!rows.length){
    box.innerHTML='<div style="padding:26px;text-align:center;border:1px solid var(--border);border-radius:12px;background:var(--surface2);">'+
      '<div style="font-size:26px;margin-bottom:6px;">\u2713</div>'+
      '<div style="font-size:14px;font-weight:700;">All clear</div>'+
      '<div style="font-size:12px;color:var(--text-dim);margin-top:3px;">No data problems detected.</div>'+
    '</div>';
    return;
  }

  const tone={crit:{c:'#e5484d',l:'Critical'},warn:{c:'#f5a524',l:'Warning'},info:{c:'#3d9eff',l:'Info'}};
  const order={crit:0,warn:1,info:2};
  rows.sort((a,b)=>(order[a.severity]??9)-(order[b.severity]??9));

  // Summary strip
  const summary='<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">'+
    ['crit','warn','info'].map(function(s){
      const n=rows.filter(r=>r.severity===s).length;
      if(!n) return '';
      return '<div style="display:flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;border:1px solid '+tone[s].c+'55;background:'+tone[s].c+'18;">'+
        '<span style="width:7px;height:7px;border-radius:50%;background:'+tone[s].c+';"></span>'+
        '<span style="font-size:11.5px;font-weight:700;color:'+tone[s].c+';">'+n+' '+tone[s].l.toLowerCase()+'</span>'+
      '</div>';
    }).join('')+'</div>';

  box.innerHTML = summary + rows.map(function(r){
    const t=tone[r.severity]||tone.info;
    return '<div style="display:flex;align-items:flex-start;gap:11px;padding:11px 13px;border:1px solid var(--border);border-left:3px solid '+t.c+';border-radius:10px;margin-bottom:7px;background:var(--surface2);">'+
      '<div style="flex:1;min-width:0;">'+
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'+
          '<span style="font-size:9px;font-family:var(--mono);font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:'+t.c+';">'+_cdEsc(r.category)+'</span>'+
          '<span style="font-size:13px;font-weight:700;">'+_cdEsc(r.staff_name||'')+'</span>'+
        '</div>'+
        '<div style="font-size:12px;color:var(--text-dim);margin-top:3px;line-height:1.45;">'+_cdEsc(r.detail)+'</div>'+
      '</div>'+
    '</div>';
  }).join('');
}

function showSection(id){
  // Payroll must be in this list — it's the list that adds .active, and
  // .tab-content is display:none without it. Omitting it meant the nav item
  // appeared and clicking it showed an empty page.
  ['home','roster','availability','staff','payroll'].forEach(s=>{
    const el=document.getElementById(`section-${s}`);
    if(el)el.classList.toggle('active',s===id);
    // tab elements may no longer exist — guard
    const tab=document.getElementById(`tab-${s}`);
    if(tab)tab.classList.toggle('active',s===id);
  });
  const crumbs={home:'Dashboard',roster:'Roster',availability:'Availability',staff:'Staff',payroll:'Payroll'};
  if(id==='payroll' && typeof initPayrollTab==='function'){ setTimeout(initPayrollTab,80); }
  const titleEl=document.getElementById('topbarTitle');
  if(titleEl)titleEl.innerHTML='<span style="color:var(--muted);font-weight:400">ShiftOps</span><span style="color:var(--muted);margin:0 6px;font-weight:400">></span>'+(crumbs[id]||'Home');
  // Morning Board lives on Home now.
  if(id==='home'){ try{ startMorningBoard(); }catch(e){} }
  else { try{ stopMorningBoard(); }catch(e){} }
  if(id==='roster')renderRoster();
  if(id==='availability')renderAvailability();
  if(id==='staff')renderStaffList();
  if(id==='leave')renderLeave();
  if(id==='leavesummary')renderLeaveSummary();
  try{ applyTeamLeadLock(); }catch(e){}
  // keep the URL hash in sync so each view is bookmarkable / refresh-safe
  try{ if(('#'+id)!==location.hash) history.replaceState(null,'','#'+id); }catch(e){}
}let _navSwitchPending=false;
/**
 * Hide the "NEW" pip on the Availability nav item.
 *
 * The nav item has always called this, but the function was never defined —
 * so every click on Availability threw "clearAvailBadge is not defined" and
 * aborted the rest of that onclick handler. Defensive: the badge element is
 * optional, so this is safe even if the markup is later removed.
 *
 * Note: nothing currently SHOWS this badge (no showAvailBadge counterpart and
 * the span is inline display:none), so the feature is dormant rather than
 * broken. Wiring it up would mean flipping it on when new availability is
 * submitted.
 */
function clearAvailBadge(){
  // No-op now: the badge reflects the live "changed since reviewed" count,
  // managed by setAvailBadge()/markAvailReviewed(). Clicking the nav must not
  // wipe a real count. Kept as a named function so the inline onclick is safe.
}

function switchNav(id,el){
  if(_navSwitchPending)return;
  // ACCESS GUARD: team leads (read-only) must not reach Employees or Payroll,
  // even via dashboard stat cards or find-a-person that call switchNav directly.
  // The Employees nav item is only *hidden* (data-tl-hide), so navigation itself
  // must enforce the lock centrally here — this covers every caller.
  if((id==='staff'||id==='payroll') && document.body.classList.contains('tl-readonly')){
    return;
  }
  _navSwitchPending=true;
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  if(el)el.classList.add('active');
  const crumbs={home:'Dashboard',roster:'Roster',availability:'Availability',staff:'Staff',payroll:'Payroll'};
  const titleEl=document.getElementById('topbarTitle');
  if(titleEl)titleEl.innerHTML='<span style="color:var(--muted);font-weight:400">ShiftOps</span><span style="color:var(--muted);margin:0 6px;font-weight:400">></span>'+(crumbs[id]||'Home');
  requestAnimationFrame(()=>{
    showSection(id);
    _navSwitchPending=false;
  });
}
// Open the section named in the URL hash (#home/#roster/#availability/#staff).
// Called on load; defaults to Home. Also highlights the matching nav item.
function applyHashNav(){
  // #payroll must be valid too, or a deep link or refresh lands on Home.
  var valid={home:1,roster:1,availability:1,staff:1,payroll:1};
  var h=(location.hash||'').replace(/^#/,'').toLowerCase();
  var id=valid[h]?h:'home';
  // Same access guard as switchNav: team leads can't deep-link to staff/payroll.
  if((id==='staff'||id==='payroll') && document.body.classList.contains('tl-readonly')){ id='home'; }
  var nav=document.querySelector('.nav-item[onclick*="switchNav(\''+id+'\'"]');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  if(nav)nav.classList.add('active');
  showSection(id);
}

function renderTeams(){
  const el=document.getElementById('teamsContent');
  let html=`<div class="staff-list" style="margin-bottom:20px">
    <div class="staff-list-header">
      <div class="section-title">Teams (${teams.length})</div>
      <div style="display:flex;gap:8px;align-items:center">
        <input type="text" id="newTeamInput" class="form-input" placeholder="New team name…" style="width:180px;padding:6px 10px;font-size:12.5px">
        <button class="btn btn-primary" onclick="addTeam()" style="padding:7px 16px">+ Add Team</button>
      </div>
    </div>`;

  teams.sort().forEach(team=>{
    const count=staff.filter(s=>s.team===team).length;
    const enc=team.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    html+=`<div class="staff-list-row" style="grid-template-columns:1fr auto auto auto;gap:14px">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:10px;height:10px;border-radius:50%;background:var(--accent);flex-shrink:0"></div>
        <div>
          <div style="font-weight:700;font-size:13px">${team}</div>
          <div style="font-family:var(--mono);font-size:9px;color:var(--text-dim);margin-top:2px">${count} staff member${count!==1?'s':''}</div>
        </div>
      </div>
      <div style="font-family:var(--mono);font-size:11px;color:var(--text-dim)">${count} staff</div>
      <div>
        <input type="text" value="${team}" onblur="renameTeam('${enc}',this.value)" style="background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--text);padding:5px 9px;font-family:var(--sans);font-size:12px;width:160px;outline:none" onfocus="this.style.borderColor='var(--accent)'" onblur2="this.style.borderColor='var(--border)'">
      </div>
      <button class="btn btn-warn" style="padding:4px 10px;font-size:10.5px" onclick="removeTeam('${enc}')">${count>0?'Remove':'Delete'}</button>
    </div>`;
  });
  html+='</div>';
  el.innerHTML=html;
}

function addTeam(){
  const input=document.getElementById('newTeamInput');
  const name=input.value.trim();
  if(!name){showToast('Enter a team name');return;}
  if(teams.includes(name)){showToast('Team already exists');return;}
  teams.push(name);
  input.value='';
  markDirty();renderTeams();showToast(` Team "${name}" added`);
}

function removeTeam(name){
  const count=staff.filter(s=>s.team===name).length;
  if(count>0){showToast(` Reassign ${count} staff before removing "${name}"`);return;}
  teams=teams.filter(t=>t!==name);
  markDirty();renderTeams();showToast(`Team "${name}" removed`);
}

function renameTeam(oldName,newName){
  newName=newName.trim();
  if(!newName||newName===oldName)return;
  if(teams.includes(newName)){showToast('That team name already exists');return;}
  teams=teams.map(t=>t===oldName?newName:t);
  staff.forEach(s=>{if(s.team===oldName)s.team=newName;});
  // CANONICAL: update staff_credentials — the base table (staff_directory is a
  // view of it). Writing the base table is what makes the rename stick on reload.
  try{
    fetch(SUPABASE_URL+'/rest/v1/staff_credentials?team=eq.'+encodeURIComponent(oldName),{
      method:'PATCH',
      headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify({team:newName})
    }).catch(function(){});
  }catch(e){}
  markDirty();renderTeams();renderAll();showToast(` Renamed to "${newName}"`);
}
// Debounced renderAll — batches rapid consecutive calls into one render
let _renderTimer=null;
function renderAll(){
  if(_renderTimer)clearTimeout(_renderTimer);
  _renderTimer=setTimeout(()=>{
    _renderTimer=null;
    // Only render the visible section to avoid doing unnecessary work
    const activeSection=document.querySelector('.tab-content.active');
    const id=activeSection?activeSection.id:'section-roster';
    if(id==='section-roster')renderRoster();
    if(id==='section-availability')renderAvailability();
    if(id==='section-staff')renderStaffList();
    updateStats();
    updateLeaveBadge();
    try{ applyTeamLeadLock(); }catch(e){ console.warn('tl lock', e); }
  });
}

