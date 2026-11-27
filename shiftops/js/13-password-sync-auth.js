// ── PASSWORD MANAGEMENT ───────────────────────────────────────────────────
let resetPassTarget=null;




function resetStaffPasswordById(staffId){
  const s=staff.find(x=>x.id===staffId);
  if(!s)return;
  const name=`${s.first} ${s.last}`;
  resetStaffPassword(staffId,name);
}

function resetStaffPassword(staffId,name){
  resetPassTarget={staffId,name};
  document.getElementById('resetPassName').textContent='Staff: '+name;
  document.getElementById('resetPassNew').value='';
  document.getElementById('resetPassConfirm').value='';
  document.getElementById('resetPassMsg').style.display='none';
  openModal('resetPassModal');
}



async function doResetPassword(){
  const pass=document.getElementById('resetPassNew').value;
  const confirm=document.getElementById('resetPassConfirm').value;
  const msg=document.getElementById('resetPassMsg');
  msg.style.display='none';

  if(!pass||pass.length<8){
    msg.textContent='Password must be at least 8 characters.';
    msg.style.cssText='display:block;background:rgba(255,92,53,.1);border:1px solid rgba(255,92,53,.2);color:var(--warn);font-size:12px;padding:8px 12px;border-radius:8px;margin-bottom:8px';
    return;
  }
  if(pass!==confirm){
    msg.textContent='Passwords do not match.';
    msg.style.cssText='display:block;background:rgba(255,92,53,.1);border:1px solid rgba(255,92,53,.2);color:var(--warn);font-size:12px;padding:8px 12px;border-radius:8px;margin-bottom:8px';
    return;
  }

  const btn=document.getElementById('resetPassBtn');
  btn.disabled=true;btn.textContent='Saving…';

  try{
    const name=resetPassTarget.name;
    // 1C-4b: set the REAL Supabase Auth password via the secure server endpoint.
    // (The legacy password_hash is no longer used for login under auth-only mode.)
    const resp=await fetch(GAS_EXEC_URL,{
      method:'POST',headers:{'Content-Type':'text/plain'},
      body:JSON.stringify({action:'adminSetPw',staff:name,newPassword:pass,token:GAS_TOKEN,sbAccessToken:_soTok()})
    });
    const j=await resp.json().catch(()=>({}));
    if(j&&j.ok){
      closeModal('resetPassModal');
      showToast(` Password set for ${name} — they'll set their own on first login`);
    } else {
      throw new Error((j&&j.error)||'Failed');
    }
  }catch(e){
    msg.textContent='Failed to set password: '+_relayErrMsg(e.message||'connection error');
    msg.style.cssText='display:block;background:rgba(255,92,53,.1);border:1px solid rgba(255,92,53,.2);color:var(--warn);font-size:12px;padding:8px 12px;border-radius:8px;margin-bottom:8px';
  }finally{
    btn.disabled=false;btn.textContent='Set Password';
  }
}

// ── SUPABASE SYNC ─────────────────────────────────────────────────────────
// (SUPABASE_URL / SUPABASE_KEY / GAS_* are now declared at the TOP of this
//  script, before loadData runs — moving them here caused a temporal-dead-zone
//  crash where loadStaffFromSupabase ran before the consts existed.)

// ── AUTH TOKEN SWAP ──────────────────────────────────────────────────────
// ShiftOps inherits Nexus' Supabase session (passed in the launch token) so
// its writes run as an authenticated user. RLS-locked tables (staff_names,
// etc.) reject the anon key; this wrapper swaps in the session JWT on every
// Supabase REST call, keeping the anon key only as a fallback.
let _soAuthToken = null;
try{ _soAuthToken = sessionStorage.getItem('so_sb_at') || null; }catch(e){}
function _soTok(){
  if(_soAuthToken) return _soAuthToken;
  try{ _soAuthToken = sessionStorage.getItem('so_sb_at') || null; }catch(e){}
  return _soAuthToken;
}

/**
 * Is the inherited session token still valid?
 *
 * The token is a JWT with roughly an hour's life, stashed once at the gate.
 * Refresh only starts if a refresh token came through too — so a tab opened
 * without one, or left open past a failed refresh, ends up holding a dead
 * token. Every admin action then returns a bare "forbidden", which reads as
 * "you don't have permission" when it actually means "your session aged out".
 */
function _soTokAlive(margin){
  var t = _soTok();
  if(!t) return false;
  try{
    var p = t.split('.');
    if(p.length !== 3) return false;
    var b = p[1].replace(/-/g,'+').replace(/_/g,'/');
    while(b.length % 4) b += '=';
    var c = JSON.parse(atob(b));
    return !!(c.exp && (c.exp * 1000) > Date.now() + (margin==null ? 30000 : margin));   // default 30s margin
  }catch(e){ return false; }
}

/** Persistent notice when the inherited session is missing/expired: without it every read is anonymous and comes back
 *  empty, which used to look like "no admins" (admin shown as Team Lead) and a blank roster. */
function _soSessionBanner(show, msg){
  var el=document.getElementById('soSessionBanner');
  if(!show){ if(el) el.remove(); return; }
  var text = msg || 'Your session ended, so ShiftOps cannot load or save anything. Nothing you do now will be saved. Open Nexus (sign in again if it asks), then open ShiftOps from there.';
  if(!el){
    el=document.createElement('div'); el.id='soSessionBanner'; el.setAttribute('role','alert');
    el.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99999;padding:10px 16px;text-align:center;font-size:13px;font-weight:700;'+
      'background:#2a1620;color:#fda4af;border-bottom:1px solid #fb7185;';
    document.body.appendChild(el);
  }
  el.innerHTML='<span></span> <a href="./" style="margin-left:10px;padding:3px 12px;border-radius:7px;background:#fda4af;color:#2a1620;text-decoration:none;white-space:nowrap">Go to Nexus</a>';
  el.firstChild.textContent=text;
}

/* ---- Session: ShiftOps only ever holds an access token (about an hour). It never holds the Nexus refresh token:
   two tabs spending one refresh token ends the whole Nexus sign-in. To renew, it asks the open Nexus tab over a
   same-origin BroadcastChannel; if Nexus is closed or signed out, the session ends and says so. */
var _soBC=null; try{ if(typeof BroadcastChannel!=='undefined') _soBC=new BroadcastChannel('nexus-auth'); }catch(e){ _soBC=null; }
var _soHubWhy='', _soAsking=null;
function _soAskHub(minLife){
  return new Promise(function(resolve){
    if(!_soBC) return resolve({why:'silent'});
    var id=Math.random().toString(36).slice(2)+Date.now().toString(36), done=false, to=null;
    function finish(r){ if(done) return; done=true; clearTimeout(to); try{ _soBC.removeEventListener('message',on); }catch(e){} resolve(r); }
    function on(ev){ var m=ev&&ev.data; if(m&&m.id===id) finish(m.t==='tok'?{at:m.at}:{why:m.why||'failed'}); }
    to=setTimeout(function(){ finish({why:'silent'}); },5000);
    _soBC.addEventListener('message',on);
    try{ _soBC.postMessage({t:'req',id:id,app:'shiftops',minLife:minLife||0}); }catch(e){ finish({why:'silent'}); }
  });
}
function _soTakeToken(at){
  if(!at) return;
  _soAuthToken=at;
  try{ sessionStorage.setItem('so_sb_at',at); }catch(e){}
  _soHubWhy=''; _soSessionBanner(false);
}
if(_soBC) _soBC.addEventListener('message',function(ev){
  var m=ev&&ev.data; if(!m||m.id) return;
  if(m.t==='out'){ _soHubWhy='signed_out'; _soAuthToken=null; try{ sessionStorage.removeItem('so_sb_at'); }catch(e){} _soSessionBanner(true,'You were signed out of Nexus, so this ShiftOps session has ended. Nothing you do now will be saved. Sign in to Nexus again, then open ShiftOps from there.'); }
  else if(m.t==='tok' && m.at){ _soTakeToken(m.at); }
});
/** True when there is a live token to write with, renewing from Nexus if it is running low. Shows the ended notice when not. */
async function _soEnsureSession(){
  if(_soTokAlive(60000)) return true;
  await _soFreshTok();
  if(_soTokAlive(15000)) return true;
  _soSessionBanner(true);
  return false;
}

/** Guard admin actions with a message that says what to actually do. */
function _soAdminReady(){
  if(_soTokAlive()) return true;
  _soSessionBanner(true); showToast('Your session ended. Open ShiftOps again from Nexus.','error');
  return false;
}

/**
 * Ensure a FRESH access token before a privileged relay call.
 *
 * Root cause of the "forbidden" admin failures: _soTok() returned a cached
 * access token that had aged out (~1h life). The relay verifies it against
 * Supabase, which replies session_not_found, and the relay returns a bare
 * "forbidden" that reads like a permissions problem. This proactively refreshes
 * via the supabase-js client (if we have one + a refresh token) so the token
 * handed to the relay is current. Returns the fresh token, or the existing one
 * if refresh isn't possible (caller still guards with _soAdminReady()).
 */
/**
 * Turn a relay error string into a message that says what actually happened
 * and what to do. Previously these were swallowed (.catch(console.warn)) or
 * shown raw ("forbidden"), which read as "no permission" when the real cause
 * was usually an expired session.
 */
function _relayErrMsg(err){
  const e = String(err||'').toLowerCase();
  if(e.indexOf('forbidden')>=0 || e.indexOf('session')>=0 || e.indexOf('unauthorized')>=0){
    return 'Your session ended. Open ShiftOps again from Nexus, then try again.';
  }
  if(!e || e==='failed') return 'Something went wrong on the server. Try again.';
  return err;
}

async function _soFreshTok(){
  if(_soTokAlive(5*60*1000)) return _soTok();   // plenty of life left, no work needed
  if(!_soAsking){
    _soAsking=(async function(){
      try{
        var r=await _soAskHub(20*60*1000);
        if(r.at){ _soTakeToken(r.at); } else { _soHubWhy=r.why||'failed'; }
      }catch(e){ console.warn('[auth] token request failed',e); }
      finally{ setTimeout(function(){ _soAsking=null; },0); }
    })();
  }
  await _soAsking;
  return _soTok();
}

(function(){
  const _origFetch = window.fetch.bind(window);
  window.fetch = function(input, init){
    try{
      const url = (typeof input === 'string') ? input : (input && input.url) || '';
      const tok = _soTok();
      if(url.indexOf('/rest/v1/') >= 0 && url.indexOf(SUPABASE_URL) >= 0){
        const _m = ((init && init.method) || 'GET').toUpperCase();
        const _isWrite = (_m === 'POST' || _m === 'PATCH' || _m === 'PUT' || _m === 'DELETE');
        if(_isWrite){
          // Writes hit RLS: an aged-out token silently downgrades to anon and the
          // row is rejected (this is why leave reasons "didn't stick"). Refresh
          // first, then send with a live token.
          return (async function(){
            let ftok = tok;
            try{ ftok = await _soFreshTok(); }catch(e){}
            if(!_soTokAlive(0)){ try{ _soSessionBanner(true); }catch(e){} }   // an ended session must be visible, not a silent failed save
            init = init || {};
            const h = new Headers((init && init.headers) || (typeof input!=='string' && input.headers) || {});
            if(ftok) h.set('Authorization', 'Bearer ' + ftok);
            if(!h.has('apikey')) h.set('apikey', SUPABASE_KEY);
            init.headers = h;
            return _origFetch(input, init);
          })();
        }
        if(tok && !_soTokAlive()){
          // Aged-out token on a READ: refresh first, otherwise the read goes out
          // with a dead JWT (or silently as anon) and RLS tables come back empty.
          return (async function(){
            let ftok = tok;
            try{ ftok = await _soFreshTok(); }catch(e){}
            init = init || {};
            const h = new Headers((init && init.headers) || (typeof input!=='string' && input.headers) || {});
            h.set('Authorization', 'Bearer ' + (ftok||tok));
            if(!h.has('apikey')) h.set('apikey', SUPABASE_KEY);
            init.headers = h;
            return _origFetch(input, init);
          })();
        }
        if(tok){
          init = init || {};
          const h = new Headers((init && init.headers) || (typeof input!=='string' && input.headers) || {});
          h.set('Authorization', 'Bearer ' + tok);
          if(!h.has('apikey')) h.set('apikey', SUPABASE_KEY);
          init.headers = h;
        }
      }
      // Apps Script relay: attach the admin's Supabase login token so the relay
      // can verify they're an admin (needed for adminSetPw / offboardStaff /
      // adminRenameAuth). Without this the relay returns "forbidden".
      // The token must be FRESH: a cached, aged-out token makes the relay's
      // verification fail with session_not_found → "forbidden". So for relay
      // calls we refresh first (async), then inject the current token.
      if(url.indexOf('script.google.com/macros') >= 0 &&
         init && init.body && typeof init.body === 'string'){
        return (async function(){
          let freshTok = tok;
          try{ freshTok = await _soFreshTok(); }catch(e){ /* fall back to cached */ }
          try{
            const b = JSON.parse(init.body);
            if(b && typeof b === 'object' && b.sbAccessToken === undefined && freshTok){
              b.sbAccessToken = freshTok;
              init = Object.assign({}, init, { body: JSON.stringify(b) });
            }
          }catch(e){}
          return _origFetch(input, init);
        })();
      }
    }catch(e){}
    return _origFetch(input, init);
  };
})();
// Keep the session alive (access tokens last ~1h): top up from the Nexus tab while it is open, and say so clearly if it can't.
(function(){
  async function tick(){
    try{
      if(!_soTok()) return;
      if(_soTokAlive(10*60*1000)){ _soSessionBanner(false); return; }
      await _soFreshTok();
      if(_soTokAlive(10*60*1000)){ _soSessionBanner(false); return; }
      var left=0; try{ var p=_soTok().split('.')[1].replace(/-/g,'+').replace(/_/g,'/'); while(p.length%4) p+='='; left=JSON.parse(atob(p)).exp*1000-Date.now(); }catch(e){}
      if(left>30000){
        var mins=Math.max(1,Math.ceil(left/60000));
        _soSessionBanner(true,'Your session ends in about '+mins+' minute'+(mins===1?'':'s')+'. '+(_soHubWhy==='signed_out'?'Nexus has been signed out. ':'Nexus is not open in another tab. ')+'Finish what you are saving, then open ShiftOps again from Nexus.');
      }else{
        _soSessionBanner(true);
      }
    }catch(e){ console.warn('so session keeper',e); }
  }
  setInterval(tick, 60*1000);
  // Timers are throttled while a tab is in the background or the laptop sleeps, so also check when the tab comes back.
  document.addEventListener('visibilitychange', function(){ if(document.visibilityState==='visible') tick(); });
  setTimeout(tick, 4000);
})();

// Rename a staff member IN PLACE across the DB so renaming doesn't create a
// duplicate credential row. PATCHes staff_credentials + staff_names by old name.
async function renameStaffEverywhere(oldName, newName){
  const H={'apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY,'Content-Type':'application/json','Prefer':'return=minimal'};
  try{
    // Guard: if a row with the NEW name already exists in credentials, don't clobber it.
    const clash=await fetch(SUPABASE_URL+'/rest/v1/staff_credentials?staff_name=eq.'+encodeURIComponent(newName)+'&select=staff_name',{headers:H});
    const clashRows=clash.ok?await clash.json():[];
    if(clashRows.length){
      showToast('"'+newName+'" already exists — not renaming to avoid a clash');
      return;
    }
    // 1. staff_credentials: rename the row (keeps password, auth_uid, SQ, team, admin)
    await fetch(SUPABASE_URL+'/rest/v1/staff_credentials?staff_name=eq.'+encodeURIComponent(oldName),{
      method:'PATCH', headers:H, body:JSON.stringify({staff_name:newName})
    });
    // 2. staff_names: rename (so pushStaffNames doesn't see it as delete-old + add-new)
    await fetch(SUPABASE_URL+'/rest/v1/staff_names?name=eq.'+encodeURIComponent(oldName),{
      method:'PATCH', headers:H, body:JSON.stringify({name:newName})
    });
    // 2b. clock_log + clock_overrides: rename the staff_name on all punch rows.
    //     CRITICAL — without this, old-name rows remain and the reconcile cron
    //     recreates a sheet tab under the OLD name (renamed staff "comes back").
    await fetch(SUPABASE_URL+'/rest/v1/clock_log?staff_name=eq.'+encodeURIComponent(oldName),{
      method:'PATCH', headers:H, body:JSON.stringify({staff_name:newName})
    });
    await fetch(SUPABASE_URL+'/rest/v1/clock_overrides?staff_name=eq.'+encodeURIComponent(oldName),{
      method:'PATCH', headers:H, body:JSON.stringify({staff_name:newName})
    }).catch(function(){});
    // (staff_teams retired — team follows the person via staff_directory/credentials)
    // 3. Update the auth account's email (firstname.lastname@oscars.local) + metadata
    //    to match the new name — otherwise login (which builds the email from the
    //    name) would break after a rename.
    try{
      const resp=await fetch(GAS_EXEC_URL,{
        method:'POST',headers:{'Content-Type':'text/plain'},
        body:JSON.stringify({action:'adminRenameAuth',oldName:oldName,newName:newName,token:GAS_TOKEN,sbAccessToken:_soTok()})
      });
      const j=await resp.json().catch(()=>({}));
      if(!(j&&j.ok)){
        showToast('Renamed, but auth email update failed: '+((j&&j.error)||'error')+'. Staff may need a password reset to log in.');
      }
    }catch(e){
      showToast('Renamed, but auth email update failed (network). Staff may need a password reset.');
    }
  }catch(e){ console.warn('renameStaffEverywhere failed',e); }
}

async function pushStaffNames(){
  try{
    // SAFETY: if the roster is empty or implausibly small, do NOT push — step 2
    // below deletes any staff_names row not in the local list, which would wipe
    // the real Nexus roster. Also skip when the roster is Supabase-backed: it
    // already mirrors Nexus, so there is nothing to push and pruning is unsafe.
    if(_staffFromSupabase){ return; }
    if(!Array.isArray(staff) || staff.length < 3){
      console.warn('[pushStaffNames] skipped — roster too small ('+(staff?staff.length:0)+'), refusing to prune staff_names');
      return;
    }

    const currentNames=staff.map(s=>`${s.first} ${s.last}`);

    // 1. Get what's currently in Supabase
    const existing=await fetch(`${SUPABASE_URL}/rest/v1/staff_names`,{
      headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`}
    });
    const existingRows=existing.ok?await existing.json():[];
    const existingNames=existingRows.map(r=>r.name);

    // 2. Delete names that no longer exist
    const toDelete=existingNames.filter(n=>!currentNames.includes(n));
    await Promise.all(toDelete.map(name=>fetch(`${SUPABASE_URL}/rest/v1/staff_names?name=eq.${encodeURIComponent(name)}`,{
        method:'DELETE',
        headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`}
      })
    ));

    // 3. Insert names that are new
    const toInsert=currentNames.filter(n=>!existingNames.includes(n)).map(n=>({name:n}));
    if(toInsert.length){
      await fetch(`${SUPABASE_URL}/rest/v1/staff_names`,{
        method:'POST',
        headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json','Prefer':'return=minimal'},
        body:JSON.stringify(toInsert)
      });
    }

    // 4. Sync each staff member's team to staff_credentials
    await Promise.all(staff.map(s=>{
      const fullName=s.first+' '+s.last;
      const team=s.team||'';
      return fetch(SUPABASE_URL+'/rest/v1/staff_credentials?staff_name=eq.'+encodeURIComponent(fullName),{
        method:'PATCH',
        headers:{'apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
        body:JSON.stringify({team:team})
      });
    }));

  }catch(e){console.warn('Could not sync staff names',e);}
}

async function syncAvailability(){
  showToast('Syncing availability…');
  const applied = await _syncAvailabilityCore();
  if(applied<0){ showToast('Sync failed'); return; }
  if(applied===0){ showToast('No availability found — staff haven\'t submitted yet'); return; }
  showToast(' Synced availability for '+applied+' staff member'+(applied!==1?'s':''));
}

// Core availability pull. Returns count applied, or -1 on error, 0 if none.
// `silent` skips the heavy save spam when called on the background timer.
let _lastAvailSig='';
async function _syncAvailabilityCore(silent){
  try {
    const res=await fetch(
      `${SUPABASE_URL}/rest/v1/staff_availability?select=*`,
      {headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`}}
    );
    if(!res.ok) return -1;
    const rows=await res.json();
    if(!rows.length){ if(typeof setAvailBadge==='function')setAvailBadge(0); return 0; }

    // One-off weeks ("For week starting"): a single Monday that overrides the standing pattern.
    // Table may not exist yet or may fail — then there are simply no one-offs.
    let _oneoffs={};
    try{
      const _or=await fetch(`${SUPABASE_URL}/rest/v1/availability_oneoffs?select=staff_name,week_start,availability,updated_at`,
        {headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`}});
      if(_or.ok){ (await _or.json()).forEach(function(o){ _oneoffs[String(o.staff_name).toLowerCase()+'|'+o.week_start]=o; }); }
    }catch(e){}
    // Update the "changed since reviewed" nav badge from this pull.
    try{
      let _nr=0;
      const _ooNewest={};
      Object.keys(_oneoffs).forEach(function(k){
        const o=_oneoffs[k], n=String(o.staff_name).toLowerCase(), t=o.updated_at?new Date(o.updated_at).getTime():0;
        if(t>(_ooNewest[n]||0)) _ooNewest[n]=t;
      });
      rows.forEach(function(r){
        const u=Math.max(r.updated_at?new Date(r.updated_at).getTime():0, _ooNewest[String(r.staff_name).toLowerCase()]||0);
        const v=r.availability_reviewed_at?new Date(r.availability_reviewed_at).getTime():0;
        if(u>v)_nr++;
      });
      if(typeof setAvailBadge==='function')setAvailBadge(_nr);
    }catch(e){}

    // Skip re-applying if nothing changed since last pull (avoids needless saves
    // on the auto-timer). Signature = staff_name+updated_at pairs.
    const sig=rows.map(function(r){return r.staff_name+'@'+(r.updated_at||'');}).sort().join('|')
      +'#'+Object.keys(_oneoffs).sort().map(function(k){return k+'@'+(_oneoffs[k].updated_at||'');}).join('|');
    if(silent && sig===_lastAvailSig) return 0;
    _lastAvailSig=sig;

    let applied=0;
    // Validate date-ranged availability against the WEEK BEING VIEWED, not today.
    // (Building next week's roster must use next week's window — otherwise an
    // availability that starts next week is skipped because today is before it,
    // and the grid shows the wrong window.) A window applies if it overlaps the
    // viewed Mon–Sun at all.
    const _wkStart=new Date(currentWeekStart); _wkStart.setHours(0,0,0,0);
    const _wkEnd=addDays(_wkStart,6); _wkEnd.setHours(23,59,59,999);
    rows.forEach(row=>{
      if(row.is_ongoing===false){
        if(row.valid_from){ const from=new Date(row.valid_from+'T00:00:00'); if(from>_wkEnd)return; }   // window starts after this week
        if(row.valid_until){ const until=new Date(row.valid_until+'T23:59:59'); if(until<_wkStart)return; } // window ended before this week
      }
      const s=staff.find(x=>`${x.first} ${x.last}`.toLowerCase()===row.staff_name.toLowerCase());
      if(!s)return;
      // Pick the version effective for the WEEK BEING VIEWED. Staff can queue a
      // future change (pending_availability, effective pending_from); once the
      // viewed week starts on/after that date, the grid must show the pending
      // version — otherwise it keeps drawing the old current one (the "shows
      // last week's availability" bug), even though the new one is effective.
      let av = row.availability || {};
      if(row.pending_availability && row.pending_from){
        const pf = new Date(row.pending_from + 'T00:00:00');
        if(pf <= _wkStart) av = row.pending_availability;   // effective from its week onward
      }
      // A one-off for exactly this week beats the standing pattern (and any pending change).
      const _wsIso=_wkStart.getFullYear()+'-'+String(_wkStart.getMonth()+1).padStart(2,'0')+'-'+String(_wkStart.getDate()).padStart(2,'0');
      const _oo=_oneoffs[row.staff_name.toLowerCase()+'|'+_wsIso];
      if(_oo && _oo.availability) av = _oo.availability;
      // Replace this person's availability WHOLESALE, don't merge into the old
      // object — otherwise a day they removed/changed lingers from the prior version.
      const fresh={};
      Object.keys(av).forEach(d=>{ fresh[parseInt(d)]=av[d]; });
      availability[s.id]=fresh;
      applied++;
    });

    markDirty();renderAvailability();renderRoster();
    try{ applyTeamLeadLock(); }catch(e){}
    await saveData();
    if(document.getElementById('availsec-submitted')&&document.getElementById('availsec-submitted').style.display!=='none'){
      loadSubmittedAvailability().then(function(){ try{ applyTeamLeadLock(); }catch(e){} });
    }
    return applied;
  } catch(e){ return -1; }
}

// Auto-sync: once shortly after load, then quietly every few minutes so new
// availability submissions flow into ShiftOps without anyone clicking Sync.
let _autoAvailTimer=null;
function startAutoAvailabilitySync(){
  if(_autoAvailTimer) return;
  // First pull ~4s after load (once staff list is settled).
  setTimeout(function(){ _syncAvailabilityCore(true); }, 4000);
  // Then every 3 minutes.
  _autoAvailTimer=setInterval(function(){
    if(document.hidden) return;          // don't sync a backgrounded tab
    _syncAvailabilityCore(true);
  }, 3*60*1000);
  // Also pull when the tab regains focus (someone likely just updated availability).
  document.addEventListener('visibilitychange', function(){
    if(!document.hidden) _syncAvailabilityCore(true);
  });
}

