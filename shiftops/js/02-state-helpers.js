// ── DEFAULT STATE ─────────────────────────────────────────────────────────
let staff=[]; // no seed/demo data — staff come only from the DB (loadData)
// availability[staffId][dayIndex] = {type:'all'|'custom'|'no', start?:'09:00', end?:'17:00'}
let availability={};
let availWeekKey=''; // tracks which week the availability is for
let shiftsStore={}; // shiftsStore[weekKey] = shifts for that week
let availStore={}; // availStore[weekKey] = availability for that week
let leaveRequests=[]; // [{id, staffId, from, to, reason, status:'pending'|'approved'|'declined'}]
let nextLeaveId=1;
let shifts={};
let nextStaffId=1; // was 6 to clear the 5 seed staff; no seed data now
let teams=['Enrolment','Processing','Placement','Evershine','Accounts','Education'];
let devices=[]; // [{id, name, assignedTo: staffId|null}]
let nextDeviceId=1;
// Which week the grid should open on. Normally the current week — but from
// Saturday 8am (Sydney) through Sunday, it jumps to NEXT week, so managers can
// see the upcoming week's availability and build that roster over the weekend.
// (Monday onward, that week is simply the current one again.) Manager can still
// click back to any week.
function _defaultRosterWeekStart(){
  // "now" in Sydney wall-clock, so the 8am boundary is correct on any device.
  const now = new Date(new Date().toLocaleString('en-US',{timeZone:'Australia/Sydney'}));
  const dow = now.getDay();           // 0=Sun, 6=Sat
  const thisMon = getMonday(now);
  const rollForward =
    (dow === 6 && now.getHours() >= 8) ||   // Saturday from 8am
    (dow === 0);                            // all of Sunday
  return rollForward ? addDays(thisMon, 7) : thisMon;
}
let currentWeekStart=_defaultRosterWeekStart();
let editingShift=null,editingStaffId=null,isDirty=false,activeRoleFilter=null,staffSortOrder='asc';

// ── PERSISTENCE ───────────────────────────────────────────────────────────
// Tracks whether the staff roster came from Supabase (the source of truth) vs
// the local desktop file. When staff is Supabase-backed we must NEVER let the
// Nexus sync prune the directory (see syncStaffToNexus), because ShiftOps is a
// VIEW of that data here, not its owner.
let _staffFromSupabase=false;

async function loadData(){
  // 1) Local desktop file (only place shifts/availability/devices live).
  //    Staff from the file is treated as a FALLBACK only — Supabase wins.
  if(window.shiftops){
    try{
      const res=await window.shiftops.loadData();
      if(res.ok&&res.data&&res.data!==null){
        if(res.data.staff){
          // Role identity (admin / team-lead) must come ONLY from Supabase
          // (staff_settings + app_access), never from the saved blob — a stale
          // blob was showing admins as TEAM LEAD. Keep scheduling fields, drop roles.
          staff=(res.data.staff||[]).map(function(s){
            const c=Object.assign({},s);
            delete c.isHubAdmin; delete c.isShiftAdmin; delete c.isTeamLead;
            return c;
          });
        }
        if(res.data.shiftsStore)shiftsStore=res.data.shiftsStore;
        if(res.data.availStore)availStore=res.data.availStore;
        // Normalize legacy week-key format drift ("29 June" → "29 Jun") so save
        // and load always agree. Re-key any store entry whose key doesn't match
        // the canonical fmtDate() output for its Monday.
        const _keysBefore = JSON.stringify(Object.keys(shiftsStore||{}).sort())+'|'+JSON.stringify(Object.keys(availStore||{}).sort());
        try{ _normalizeStoreKeys(); }catch(e){ console.warn('[WEEK-DEBUG] normalize failed', e); }
        const _keysAfter = JSON.stringify(Object.keys(shiftsStore||{}).sort())+'|'+JSON.stringify(Object.keys(availStore||{}).sort());
        // If normalization actually collapsed any duplicate/long-form keys, persist
        // the cleaned store back immediately so the DB can't keep re-serving stale
        // long-form keys (the roster-erasing bug). Deferred slightly so the rest of
        // load (staff, availWeekKey) settles first.
        if(_keysBefore!==_keysAfter){
          console.log('[WEEK-DEBUG] store keys normalized on load; scheduling cleanup save');
          setTimeout(function(){ try{ if(typeof forceSave==='function') forceSave(); }catch(e){} }, 1500);
        }
        // legacy support
        if(res.data.shifts&&!res.data.shiftsStore){shiftsStore[res.data.availWeekKey||'legacy']=res.data.shifts;}
        if(res.data.availability&&!res.data.availStore){availStore[res.data.availWeekKey||'legacy']=res.data.availability;}
        if(res.data.nextStaffId)nextStaffId=res.data.nextStaffId;
        if(res.data.teams)teams=res.data.teams;
        if(res.data.devices)devices=res.data.devices;
        if(res.data.nextDeviceId)nextDeviceId=res.data.nextDeviceId;
        if(res.data.availWeekKey)availWeekKey=_canonicalWeekKey(res.data.availWeekKey);
        if(res.data.leaveRequests)leaveRequests=res.data.leaveRequests;
        if(res.data.nextLeaveId)nextLeaveId=res.data.nextLeaveId;
        rekeyAll();
      }
      const path=await window.shiftops.getDataPath();
      const lbl=document.getElementById('dataPathLabel');
      if(lbl)lbl.textContent=path;
    }catch(e){console.warn('local load failed',e);}
  }

  // 2) Staff roster from Supabase — the real, authoritative list (same source
  //    Nexus uses). This replaces the local/seed staff whenever it succeeds, so
  //    running ShiftOps inside Nexus (no desktop bridge) shows real staff.
  //    Retry a few times on transient network failure — an empty staff list is
  //    what causes the "roster erased / everyone not clocked in" symptoms.
  for(let attempt=1; attempt<=3; attempt++){
    try{
      await loadStaffFromSupabase();
    }catch(e){console.warn('supabase staff load failed (attempt '+attempt+')',e);}
    if(Array.isArray(staff) && staff.length>=3) break; // got a real roster
    if(attempt<3){
      console.warn('[INIT] staff list still small ('+((staff||[]).length)+'), retrying in '+(attempt*800)+'ms');
      await new Promise(function(r){ setTimeout(r, attempt*800); });
    }
  }
  if(!Array.isArray(staff) || staff.length<3){
    console.error('[INIT] staff never loaded after retries — read-only until reload, saves are blocked to protect data');
    try{ showToast('Couldn\'t load staff — pull to refresh'); }catch(e){}
  }

  // Now that staff is loaded, rebuild leaveRequests from the DATABASE (the
  // authoritative source). Since Phase 0 the blob no longer carries a copy,
  // so this fetch is the ONLY source — a silent failure would leave approved
  // leaves unpainted with no explanation. Retry, then say so out loud.
  let _leaveOk=false;
  for(let attempt=1; attempt<=3 && !_leaveOk; attempt++){
    try{
      const lr=await fetch(`${SUPABASE_URL}/rest/v1/leave_submissions?order=submitted_at.desc`,
        {headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`}});
      if(lr.ok){
        const rows=await lr.json();
        leaveRequests=(rows||[]).map(function(row){
          const m=staff.find(function(x){return _normName(x.first+' '+x.last)===_normName(row.staff_name);});
          return {
            id:nextLeaveId++,
            staffId:m?m.id:null,
            staffName:row.staff_name,
            staff_name:row.staff_name,
            from:row.from_date, to:row.to_date,
            reason:row.reason||'',
            reason_type:row.reason_type||'',
            proof_path:row.proof_path||'',
            status:row.status||'pending',
            declineReason:row.decline_reason||'',
            // Carried so the list can show WHERE a request came from and WHEN
            // it was raised. Without resolved_by the origin badge silently
            // reported everything as "From Nexus".
            resolved_by:row.resolved_by||'',
            resolved_at:row.resolved_at||null,
            // Authoritative origin from the leave_submissions.source column:
            // 'Web'=staff self-request via Nexus, 'Admin'=entered in ShiftOps.
            // Older rows predate the column (null) — the badge falls back to
            // the resolved_by heuristic for those.
            source:row.source||'',
            submitted_at:row.submitted_at||null,
            supabaseId:row.id
          };
        });
        _leaveOk=true;
      }
    }catch(e){ console.warn('leave load failed (attempt '+attempt+')', e); }
    if(!_leaveOk && attempt<3) await new Promise(function(r){ setTimeout(r, attempt*700); });
  }
  try{ if(typeof repaintAllApprovedLeaves==='function') repaintAllApprovedLeaves(); }catch(_){}
  if(!_leaveOk){
    console.error('[INIT] leave_submissions never loaded — approved leave will not show on the grid until reload');
    try{ showToast('Couldn\'t load leave — approved leave may not show'); }catch(e){}
  }
}

// Build the ShiftOps `staff` array from Nexus's Supabase tables:
//   • staff_names      ->the canonical roster (names)
//   • staff_directory  ->team per person
//   • staff_settings   ->admin flags (is_hub_admin / is_shift_admin)
// Maps each into ShiftOps's shape. Preserves any existing per-person roster
// fields (type/maxHours/color/manager) from the local file when the name matches,
// so desktop-side scheduling settings aren't lost.
// True only when the role-source fetches (staff_settings + app_access) actually
// succeeded. Roles must never be latched from failed/partial data — that's what
// silently demoted admins to Team Lead on a flaky network.
let _roleDataOk=false;

async function loadStaffFromSupabase(){
  // Make sure the session token is live BEFORE reading. A stale token goes out as anon and RLS answers
  // "200 []" (no error), which used to leave every person's team as null on startup.
  try{ await _soFreshTok(); }catch(e){}
  // Use the signed-in session when there is one (the anon key now sees nothing on these tables).
  const H={apikey:SUPABASE_KEY,Authorization:'Bearer '+(function(){ try{ return _soTok()||SUPABASE_KEY; }catch(e){ return SUPABASE_KEY; } })()};
  async function get(path){
    const r=await fetch(SUPABASE_URL+'/rest/v1/'+path,{headers:H});
    if(!r.ok) throw new Error(path+' -> '+r.status);
    return r.json();
  }

  // Pull all three in parallel. Track which ones actually succeeded — a FAILED
  // fetch must not be treated as "no data", or an admin whose settings didn't
  // load gets silently demoted to Team Lead (and latched there for the session).
  let _settingsOk=true, _accessOk=true;
  let [names,dir,settings,access,rcfg]=await Promise.all([
    get('staff_names?select=name&order=name.asc').catch(function(){return [];}),
    get('staff_directory?select=staff_name,team,pronouns,birthday,email').catch(function(){return [];}),
    get('staff_settings?select=name,is_hub_admin,is_shift_admin').catch(function(e){ _settingsOk=false; console.warn('[ROLE] staff_settings fetch failed — roles unresolved', e); return []; }),
    get('app_access?select=staff_name&app=eq.shiftops').catch(function(e){ _accessOk=false; console.warn('[ROLE] app_access fetch failed — roles unresolved', e); return []; }),
    // Employment type / max hours now live in their own table. Reading them
    // from the blob meant the staff list showed a stale "Full-time" for
    // everyone, and saving that person wrote the stale value straight back
    // over their real setting.
    get('staff_roster_config?select=staff_name,employment_type,max_hours').catch(function(){return [];})
  ]);
  // staff_directory is the only source of team. An empty answer while signed in almost always means a transient
  // blip, not "nobody has a team", so ask again (with a refreshed token) before giving up.
  var _dirTries=0;
  while((!Array.isArray(dir)||dir.length===0) && _dirTries<3){
    _dirTries++;
    await new Promise(function(r){ setTimeout(r, _dirTries*450); });
    try{ await _soFreshTok(); }catch(e){}
    try{
      const H2={apikey:SUPABASE_KEY,Authorization:'Bearer '+(_soTok()||SUPABASE_KEY)};
      const r2=await fetch(SUPABASE_URL+'/rest/v1/staff_directory?select=staff_name,team,pronouns,birthday,email',{headers:H2});
      if(r2.ok) dir=await r2.json();
    }catch(e){ console.warn('[TEAM] directory retry '+_dirTries+' failed', e); }
  }
  // Last known teams (this browser), used only if the directory still can't be read.
  var _teamCache={};
  try{ _teamCache=JSON.parse(localStorage.getItem('so_team_cache')||'{}')||{}; }catch(e){}
  if(Array.isArray(dir)&&dir.length){
    var _fresh={}; dir.forEach(function(r){ if(r.staff_name&&r.team) _fresh[r.staff_name]=r.team; });
    try{ localStorage.setItem('so_team_cache', JSON.stringify(_fresh)); }catch(e){}
  } else {
    console.warn('[TEAM] staff_directory unavailable — using last known teams');
  }
  const cfgByName={};
  (rcfg||[]).forEach(function(c){ if(c.staff_name) cfgByName[c.staff_name]=c; });
  // Expose whether role data is trustworthy this pass.
  // An anonymous (token-less or expired-session) caller gets an EMPTY but successful answer from staff_settings,
  // which reads as "nobody is an admin" and demoted every admin with ShiftOps access to Team Lead, locked in for the
  // whole session. Role data therefore only counts when it came with a live session AND actually contains rows.
  var _tokOk=false; try{ _tokOk=_soTokAlive(); }catch(e){}
  _roleDataOk = _settingsOk && _accessOk && _tokOk && Array.isArray(settings) && settings.length>0;
  try{ _soSessionBanner(!_tokOk); }catch(e){}

  if(!Array.isArray(names)||names.length===0){
    // Supabase gave us nothing usable — keep whatever loaded locally, do NOT
    // wipe to empty, and mark roster as NOT supabase-backed.
    _staffFromSupabase=false;
    return;
  }

  const teamByName={};
  const dirExtras={};
  (dir||[]).forEach(function(r){ if(r.staff_name){ teamByName[r.staff_name]=r.team; dirExtras[r.staff_name]={pronouns:r.pronouns||'', birthday:r.birthday||'', email:r.email||''}; } });
  const adminByName={};
  (settings||[]).forEach(function(r){
    if(r.name) adminByName[r.name]={hub:r.is_hub_admin===true, shift:r.is_shift_admin===true};
  });
  const hasShiftopsByName={};
  (access||[]).forEach(function(r){ if(r.staff_name) hasShiftopsByName[r.staff_name]=true; });

  // Index existing roster (local file) by full name to preserve scheduling fields.
  const prevByName={};
  (staff||[]).forEach(function(s){
    const full=((s.first||'')+' '+(s.last||'')).trim();
    if(full) prevByName[full]=s;
  });

  let idc=1;
  const built=names.map(function(row){
    const full=String(row.name||'').trim();
    if(!full) return null;
    const parts=full.split(/\s+/);
    const first=parts.shift()||full;
    const last=parts.join(' ');
    const prev=prevByName[full]||{};
    const team=(full in teamByName && teamByName[full]) ? teamByName[full] : (prev.team||_teamCache[full]||null);
    const isOffice=(team==='Office');
    return {
      id: prev.id || idc++,
      first:first,
      last:last,
      team:team,
      isManager: false,
      isOfficeManager: false,
      isHubAdmin: !!(adminByName[full] && adminByName[full].hub),
      isShiftAdmin: !!(adminByName[full] && adminByName[full].shift),
      isTeamLead: (!!hasShiftopsByName[full]) && !(adminByName[full] && adminByName[full].hub),
      type: (cfgByName[full] && cfgByName[full].employment_type) || prev.type || 'full',
      maxHours: (cfgByName[full] && typeof cfgByName[full].max_hours==='number')
                  ? cfgByName[full].max_hours
                  : ((typeof prev.maxHours==='number')?prev.maxHours:38),
      color: prev.color || COLORS[(idc)%COLORS.length],
      pronouns: (dirExtras[full]&&dirExtras[full].pronouns)||prev.pronouns||'',
      birthday: (dirExtras[full]&&dirExtras[full].birthday)||prev.birthday||'',
      email: (dirExtras[full]&&dirExtras[full].email)||prev.email||''
    };
  }).filter(Boolean);

  // The saved team list can fall behind the real teams (a team created in the directory, e.g. Follow-Up, that
  // nobody added under Manage Teams). Every team someone is actually in must be pickable, or the Team dropdown
  // shows the first option for them and a Save would quietly move them. 'Office' is handled separately.
  built.forEach(function(s){
    if(s.team && s.team!=='Office' && teams.indexOf(s.team)<0) teams.push(s.team);
  });

  // Keep ids unique/co-herent for any preserved ids that collided with idc.
  const seen={};
  built.forEach(function(s){
    while(seen[s.id]){ s.id=idc++; }
    seen[s.id]=true;
  });

  // The signed-in person's own admin status is decided by the server (is_current_user_hub_admin), not by whether
  // the staff_settings list happened to include a matching row. Ask the server directly (and fall back to the
  // verdict stored at launch), so an admin can never be rebuilt as a Team Lead on refresh.
  try{
    var _meN=(sessionStorage.getItem('so_me')||'').trim().toLowerCase();
    var _hint=sessionStorage.getItem('so_is_admin')==='1';
    var _srvAdmin=null;
    try{
      var _tk=_soTok();
      if(_tk && _soTokAlive()){
        var _ar=await fetch(SUPABASE_URL+'/rest/v1/rpc/is_current_user_hub_admin',{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+_tk,'Content-Type':'application/json'},body:'{}'});
        if(_ar.ok) _srvAdmin=((await _ar.json())===true);
      }
    }catch(e){}
    var _isAdminNow=(_srvAdmin===null)?_hint:_srvAdmin;
    if(_srvAdmin!==null){ try{ sessionStorage.setItem('so_is_admin',_srvAdmin?'1':'0'); }catch(e){} }
    if(_meN && _isAdminNow){
      built.forEach(function(s){
        if(((s.first||'')+' '+(s.last||'')).trim().toLowerCase()===_meN){ s.isHubAdmin=true; s.isTeamLead=false; }
      });
    }
  }catch(e){ console.warn('[ROLE] self admin check failed', e); }

  staff=built;
  nextStaffId=Math.max.apply(null,[1].concat(built.map(function(s){return s.id;})))+1;
  _staffFromSupabase=true;

  // Roles are now authoritative on the staff array — resolve + latch team-lead
  // state here so the read-only lock can't be defeated by a later render that
  // runs before roles are populated. Then apply the lock immediately.
  _tlResolved=false;
  try{ computeTeamLeadState(); }catch(e){}
  try{ applyTeamLeadLock(); }catch(e){}
  try{ _renderWhoami(); }catch(e){}
}

function rekeyAll(){
  // Convert all string keys to integers
  [shifts,availability].forEach(obj=>{
    const keys=Object.keys(obj);
    keys.forEach(k=>{
      const ik=parseInt(k);
      if(!isNaN(ik)&&k!==String(ik)){obj[ik]=obj[k];delete obj[k];}
    });
  });
  // Also rekey nested shift day keys
  Object.keys(shifts).forEach(sid=>{
    const dayObj=shifts[sid];
    Object.keys(dayObj).forEach(dk=>{
      const idk=parseInt(dk);
      if(!isNaN(idk)&&dk!==String(idk)){dayObj[idk]=dayObj[dk];delete dayObj[dk];}
    });
  });
  // Same for availability day keys
  Object.keys(availability).forEach(sid=>{
    const dayObj=availability[sid];
    Object.keys(dayObj).forEach(dk=>{
      const idk=parseInt(dk);
      if(!isNaN(idk)&&dk!==String(idk)){dayObj[idk]=dayObj[dk];delete dayObj[dk];}
    });
  });
}

async function saveData(){
  if(!window.shiftops){showToast('Save only works in the desktop app');return;}
  // ── HARD WIPE GUARD ──────────────────────────────────────────────────────
  // If the staff list failed to load (e.g. a network error during init left
  // `staff` empty), saving would flush an EMPTY roster over the good data in
  // Supabase. Refuse. A real roster here is 30+ people; anything under 3 is a
  // load failure, not a legitimate state. This is the last line of defence
  // against the "roster erased on refresh" bug.
  if(!Array.isArray(staff) || staff.length < 3){
    console.warn('[SAVE-GUARD] refusing to save — staff list is empty/too small ('+((staff||[]).length)+'). Load likely failed; not overwriting good data.');
    try{ showToast('Save skipped — staff not loaded yet'); }catch(e){}
    return;
  }
  try{
    saveCurrentWeek(); // flush current week into the store
    const res=await window.shiftops.saveData(_buildSavePayload());
    if(res.ok){isDirty=false;updateSaveStatus();showToast('Saved');syncStaffToNexus();}
    else showToast('Save failed: '+res.error);
  }catch(e){showToast(''+e.message);}
}

// ── NEXUS SYNC ────────────────────────────────────────────────────────────
// ShiftOps is the source of truth for staff + teams; Nexus only reads them.
// After every save we push each staff member's team into the Nexus-facing
// tables (staff_credentials, staff_directory) and remove rows for anyone who
// no longer exists in ShiftOps. This keeps Nexus from showing "no team" or
// orphaned/ghost accounts. Runs fire-and-forget so it never blocks a save.
let _nexusSyncRunning=false;
let _lastSyncSig='';
async function syncStaffToNexus(){
  if(_nexusSyncRunning) return;            // avoid overlapping runs

  // SAFETY: when the roster was loaded FROM Supabase (ShiftOps running inside
  // Nexus), it is a VIEW of Nexus's data, not its owner — syncing back (and
  // especially pruneGhosts) could delete real staff. Skip sync entirely.
  if(_staffFromSupabase){ return; }
  // SAFETY: never sync an empty or near-empty roster. pruneGhosts would treat
  // every real Nexus staff member as a "ghost" and delete them. Require a
  // plausible roster size before any write/prune is allowed.
  if(!Array.isArray(staff) || staff.length < 3){ return; }

  // Only sync when the staff/team picture actually changed — saves fire every
  // couple of seconds during editing, but names/teams rarely change, so this
  // avoids hammering Supabase with redundant writes.
  const sig=JSON.stringify(staff.map(function(s){
    return [s.first,s.last,s.team,(s.isOfficeManager||s.isManager==='office')?1:0];
  }).sort());
  if(sig===_lastSyncSig) return;
  _nexusSyncRunning=true;
  const NX_SB='https://jcfgldqrdbfkgbixszds.supabase.co';
  const NX_KEY=(typeof SUPABASE_KEY!=='undefined')?SUPABASE_KEY:'';
  if(!NX_KEY){ _nexusSyncRunning=false; return; }
  const H={apikey:NX_KEY,Authorization:'Bearer '+NX_KEY,'Content-Type':'application/json'};
  const enc=encodeURIComponent;
  try{
    // Full name + team for every current ShiftOps staff member. Office managers
    // have no team; store them under 'Office' so Nexus still shows them placed.
    const current=staff.map(function(s){
      const name=((s.first||'').trim()+' '+(s.last||'').trim()).trim();
      const team=(s.isOfficeManager||s.isManager==='office')?'Office':(s.team||null);
      return {name:name, team:team};
    }).filter(function(x){return x.name;});

    // 1) Update team on existing staff_credentials rows (PATCH only the team
    //    field — never touch password/email/auth). If NO row exists yet (a brand
    //    new hire with no login set up), INSERT a minimal row carrying name +
    //    team, so Nexus shows their team immediately instead of "No team". The
    //    login/password fields stay empty until they migrate via admin set-pw.
    for(const c of current){
      try{
        const up=await fetch(NX_SB+'/rest/v1/staff_credentials?select=staff_name&staff_name=eq.'+enc(c.name),{
          method:'PATCH',headers:Object.assign({Prefer:'return=representation'},H),
          body:JSON.stringify({team:c.team})
        });
        let rows=[];
        try{ rows=await up.json(); }catch(e){}
        if(!Array.isArray(rows) || rows.length===0){
          await fetch(NX_SB+'/rest/v1/staff_credentials',{
            method:'POST',headers:Object.assign({Prefer:'return=minimal'},H),
            body:JSON.stringify({staff_name:c.name,team:c.team})
          });
        }
      }catch(e){}
    }

    // 2) Mirror name + team into staff_directory (the table Nexus reads for the
    //    staff list). Try an update first; if no row matched, insert. This avoids
    //    relying on a unique constraint we can't assume exists.
    for(const c of current){
      try{
        const up=await fetch(NX_SB+'/rest/v1/staff_directory?staff_name=eq.'+enc(c.name),{
          method:'PATCH',headers:Object.assign({Prefer:'return=representation'},H),
          body:JSON.stringify({team:c.team})
        });
        let rows=[];
        try{ rows=await up.json(); }catch(e){}
        if(!Array.isArray(rows) || rows.length===0){
          // no existing row ->insert one
          await fetch(NX_SB+'/rest/v1/staff_directory',{
            method:'POST',headers:Object.assign({Prefer:'return=minimal'},H),
            body:JSON.stringify({staff_name:c.name,team:c.team})
          });
        }
      }catch(e){}
    }

    // 3) Remove Nexus rows for staff no longer in ShiftOps (deleted accounts).
    //    Fetch existing names, diff against current, delete the leftovers.
    const keep={}; current.forEach(function(c){keep[c.name]=true;});
    async function pruneGhosts(table){
      try{
        const r=await fetch(NX_SB+'/rest/v1/'+table+'?select=staff_name',{headers:H});
        const rows=await r.json();
        if(!Array.isArray(rows)) return;
        for(const row of rows){
          const nm=row.staff_name;
          if(nm && !keep[nm]){
            try{
              await fetch(NX_SB+'/rest/v1/'+table+'?staff_name=eq.'+enc(nm),{
                method:'DELETE',headers:Object.assign({Prefer:'return=minimal'},H)
              });
            }catch(e){}
          }
        }
      }catch(e){}
    }
    await pruneGhosts('staff_directory');
    _lastSyncSig=sig;   // mark this staff/team snapshot as synced
    // NOTE: we deliberately do NOT auto-delete from staff_credentials here,
    // because that row also gates the person's login/auth. Removing a deleted
    // staff member's credentials (and their Supabase auth user) is a heavier
    // offboarding action handled separately, not on every roster save.
  }catch(e){
    console.warn('[syncStaffToNexus] failed:', e);
  }finally{
    _nexusSyncRunning=false;
  }
}

// Shared wipe-guard: true if it's SAFE to persist (staff actually loaded).
function _safeToSave(){
  if(!Array.isArray(staff) || staff.length < 3){
    console.warn('[SAVE-GUARD] blocked persist — staff empty/too small ('+((staff||[]).length)+')');
    return false;
  }
  return true;
}

/**
 * The ONE place the persisted payload is defined. Three code paths save
 * (saveData, forceSave, beforeunload) and they must never drift apart —
 * a stale copy in one of them silently re-introduces whatever the others
 * dropped.
 *
 * Phase 0: we deliberately do NOT persist data Supabase already owns —
 *   • leaveRequests → rebuilt wholesale from leave_submissions on load,
 *     so storing it wrote ~39% of every payload (and every history
 *     snapshot) for data that is thrown away on read.
 *   • role flags    → deleted on load and re-derived from staff_settings
 *     / app_access.
 * Everything else on `staff` stays: `id` keys both shiftsStore and
 * availStore, and type/maxHours/color exist in no other table.
 */
function _buildSavePayload(){
  const staffSlim=(staff||[]).map(function(s){
    return {
      id:s.id, first:s.first, last:s.last, team:s.team,
      type:s.type, maxHours:s.maxHours, color:s.color,
      isManager:s.isManager, isOfficeManager:s.isOfficeManager
    };
  });
  return {staff:staffSlim,availStore,nextStaffId,teams,
          devices,nextDeviceId,availWeekKey,nextLeaveId};
}

function markDirty(){isDirty=true;updateSaveStatus();debouncedAutoSave();}
// Final safeguard: flush any pending changes before window closes
window.addEventListener('beforeunload', function(e){
  if(isDirty && window.shiftops && _safeToSave()){
    try{
      saveCurrentWeek();
      window.shiftops.saveData(_buildSavePayload());
    }catch(err){}
  }
});

// Force-save NOW — used for critical operations (staff add/remove, leave decisions)
// where losing 2 seconds of dirty state could cost real data
async function forceSave(){
  isDirty=true;
  updateSaveStatus();
  if(_saveTimer){clearTimeout(_saveTimer);_saveTimer=null;}
  if(window.shiftops){
    if(!_safeToSave()){ try{ showToast('Save skipped — staff not loaded'); }catch(e){} return; }
    try{
      saveCurrentWeek();
      const res=await window.shiftops.saveData(_buildSavePayload());
      if(res && res.ok){isDirty=false;updateSaveStatus();syncStaffToNexus();}
    }catch(e){console.warn('[forceSave] failed:', e);}
  }
}
let _saveTimer=null;
function debouncedAutoSave(){
  if(_saveTimer)clearTimeout(_saveTimer);
  _saveTimer=setTimeout(()=>{_saveTimer=null;if(isDirty)saveData();},2000);
}
function updateSaveStatus(){
  const label = isDirty ? 'unsaved changes' : 'all saved';
  const cls = 'save-status' + (isDirty ? '' : ' saved');
  document.getElementById('saveLabel').textContent = label;
  document.getElementById('saveStatus').className = cls;
  const topbarLbl = document.getElementById('saveLabelTopbar');
  const topbarEl = document.getElementById('saveStatusTopbar');
  if(topbarLbl) topbarLbl.textContent = label;
  if(topbarEl) topbarEl.className = cls;
}

// ── HELPERS ───────────────────────────────────────────────────────────────
function getMonday(d){const day=d.getDay(),diff=day===0?-6:1-day;const m=new Date(d);m.setDate(d.getDate()+diff);m.setHours(0,0,0,0);return m;}
function addDays(d,n){const r=new Date(d);r.setDate(r.getDate()+n);return r;}
function fmtDate(d){return d.toLocaleDateString('en-AU',{day:'numeric',month:'short'});}
function isToday(d){const t=new Date();t.setHours(0,0,0,0);return d.getTime()===t.getTime();}
function shiftHours(s){if(!s.start||!s.end||s.type==='leave')return 0;const[sh,sm]=s.start.split(':').map(Number),[eh,em]=s.end.split(':').map(Number);if(isNaN(sh)||isNaN(sm)||isNaN(eh)||isNaN(em))return 0;return Math.max(0,(eh*60+em-sh*60-sm)/60);}
function initials(s){return(s.first[0]+s.last[0]).toUpperCase();}
function staffRoleLabel(s){
  if(s.isManager==='office'||s.isOfficeManager)return'Office Manager';
  return s.team;
}
function getUniqueTeams(){return[...teams].sort();}
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._to);t._to=setTimeout(()=>t.classList.remove('show'),2800);}

/**
 * Run an async action while showing a loading state on the button that
 * triggered it: spinner + disabled, restored when done (success or error).
 * Wrap a button's onclick with this so a save never looks like it did nothing.
 * Usage in markup: onclick="withBtnLoading(this, saveStaff)"
 */
async function withBtnLoading(btn, fn){
  if(!btn){ try{ return await fn(); }catch(e){ console.warn(e); } return; }
  if(btn.classList.contains('is-loading')) return;   // ignore double-clicks
  const prevDisabled = btn.disabled;
  btn.classList.add('is-loading');
  btn.disabled = true;
  try{
    return await fn();
  }catch(e){
    console.warn('[save] action failed:', e);
    try{ showToast('Save failed — check your connection and try again'); }catch(_){}
  }finally{
    btn.classList.remove('is-loading');
    btn.disabled = prevDisabled;
  }
}


// ── STATS ─────────────────────────────────────────────────────────────────
// Week watch. Flags who is over their max hours and who has nothing rostered; hides itself when the
// week is empty (still loading) so it never flashes a false alarm. Tapping a row opens Hours balance.
function renderWeekWatch(){
  const el=document.getElementById('weekWatch'); if(!el) return;
  const people=_rtPeople(), over=[], none=[]; let total=0;
  people.forEach(function(s){
    const h=staffHoursWeek(s.id), mx=Number(s.maxHours)||0, sw=shifts[s.id]||{};
    total+=h;
    if(mx && h>mx+0.01) over.push({s:s,h:h,mx:mx});
    let any=false; for(let d=0;d<7;d++){ if((sw[d]||[]).length){ any=true; break; } }
    if(!any) none.push(s);
  });
  if(!people.length || none.length===people.length){ el.hidden=true; el.innerHTML=''; return; }
  const f=function(n){ return String(Math.round(n*10)/10); };
  const list=function(arr,fn){ return arr.slice(0,3).map(fn).join(' \u00b7 ')+(arr.length>3?' \u00b7 +'+(arr.length-3)+' more':''); };
  const row=function(cls,n,label,who){
    return '<button type="button" class="ww-row '+cls+'" onclick="rtOpen(\'hours\')" title="Open Hours balance">'+
      '<span class="ww-dot"></span><span class="ww-n">'+n+'</span><span class="ww-l">'+label+'</span>'+
      '<span class="ww-who">'+who+'</span><span class="ww-go" aria-hidden="true">\u203a</span></button>';
  };
  over.sort(function(a,b){ return (b.h-b.mx)-(a.h-a.mx); });
  let html='';
  if(over.length) html+=row('ww-red',over.length,'over max hours',_rtEsc(list(over,function(o){ return (o.s.first||'')+' '+f(o.h)+'/'+f(o.mx)+'h'; })));
  if(none.length) html+=row('ww-amber',none.length,'with no shifts this week',_rtEsc(list(none,function(s){ return _rtName(s); })));
  if(!html) html='<div class="ww-row ww-ok"><span class="ww-dot"></span><span class="ww-l">Everyone is within their hours \u00b7 '+(people.length)+' staff rostered \u00b7 '+Math.round(total)+'h</span></div>';
  el.innerHTML=html; el.hidden=false;
}
function updateStats(){
  try{ renderWeekWatch(); }catch(e){ console.warn('weekWatch', e); }
  let conflict=false;
  staff.forEach(s=>{if(!shifts[s.id])return;for(let d=0;d<7;d++)if(shifts[s.id][d]&&shifts[s.id][d].some(sh=>sh.type!=='leave')&&getAvail(s.id,d).type==='no')conflict=true;});
  // Show straight away, but wait before hiding: while a week is loading the shifts are briefly empty, which used to
  // make this banner vanish and reappear and shove the whole roster up and down.
  (function(){
    const el=document.getElementById('conflictBanner'); if(!el) return;
    clearTimeout(window.__cbHide);
    if(conflict) el.classList.remove('cb-off');
    else window.__cbHide=setTimeout(function(){ el.classList.add('cb-off'); },800);
  })();
}

