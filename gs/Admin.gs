// Admin.gs — password reset/set, rename auth, admin flag, offboarding, leave add/remove.
// Talks to Supabase only. Does NOT touch the timesheet tabs.

// ════════════════════════════════════════════════════════════════
// PASSWORD / AUTH ADMIN OPERATIONS
// ════════════════════════════════════════════════════════════════
// ── Security-question password reset → sets the REAL Supabase Auth password ──
function handleResetPasswordViaSQ(data){
  try{
    const name = (data.staff || '').trim();
    const a1 = data.a1hash, a2 = data.a2hash, newPw = data.newPassword;
    if(!name || !a1 || !a2 || !newPw) return { ok:false, error:'missing fields' };
    if(String(newPw).length < 8) return { ok:false, error:'password too short' };
    const sb = _sbService();
    if(!sb.key) return { ok:false, error:'server not configured' };
    const credUrl = sb.url + '/rest/v1/staff_credentials?staff_name=eq.' +
      encodeURIComponent(name) + '&select=auth_uid,sq1_answer_hash,sq2_answer_hash';
    const credResp = UrlFetchApp.fetch(credUrl, {
      method:'get', headers:{ 'apikey':sb.key, 'Authorization':'Bearer '+sb.key }, muteHttpExceptions:true
    });
    if(credResp.getResponseCode() !== 200) return { ok:false, error:'lookup failed' };
    const rows = JSON.parse(credResp.getContentText());
    if(!rows.length) return { ok:false, error:'account not found' };
    const r = rows[0];
    if(r.sq1_answer_hash !== a1 || r.sq2_answer_hash !== a2) return { ok:false, error:'incorrect answers' };
    if(!r.auth_uid) return { ok:false, error:'account not migrated to auth' };
    const upResp = UrlFetchApp.fetch(sb.url + '/auth/v1/admin/users/' + r.auth_uid, {
      method:'put',
      headers:{ 'apikey':sb.key, 'Authorization':'Bearer '+sb.key, 'Content-Type':'application/json' },
      payload: JSON.stringify({ password: String(newPw), email_confirm:true }),
      muteHttpExceptions:true
    });
    const c = upResp.getResponseCode();
    if(c < 200 || c >= 300) return { ok:false, error:'auth update failed ('+c+')' };
    UrlFetchApp.fetch(sb.url + '/rest/v1/staff_credentials?staff_name=eq.' + encodeURIComponent(name), {
      method:'patch',
      headers:{ 'apikey':sb.key, 'Authorization':'Bearer '+sb.key, 'Content-Type':'application/json', 'Prefer':'return=minimal' },
      payload: JSON.stringify({ must_reset:false }), muteHttpExceptions:true
    });
    return { ok:true };
  }catch(e){ return { ok:false, error: e.message }; }
}

// ── Admin set password (ShiftOps) → sets the REAL Supabase Auth password ──
function handleAdminSetPw(data){
  try{
    const name = (data.staff || '').trim();
    const newPw = data.newPassword;
    if(!name || !newPw) return { ok:false, error:'missing fields' };
    if(String(newPw).length < 8) return { ok:false, error:'password too short (min 8)' };
    const sb = _sbService();
    if(!sb.key) return { ok:false, error:'server not configured' };
    const credUrl = sb.url + '/rest/v1/staff_credentials?staff_name=eq.' +
      encodeURIComponent(name) + '&select=auth_uid';
    const credResp = UrlFetchApp.fetch(credUrl, {
      method:'get', headers:{ 'apikey':sb.key, 'Authorization':'Bearer '+sb.key }, muteHttpExceptions:true
    });
    if(credResp.getResponseCode() !== 200) return { ok:false, error:'lookup failed' };
    const rows = JSON.parse(credResp.getContentText());
    const local = String(name).trim().toLowerCase()
      .replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,'.').replace(/\.+/g,'.').replace(/^\.|\.$/g,'');
    const email = local + '@oscars.local';
    let authUid = rows.length ? rows[0].auth_uid : null;
    if(authUid){
      const upResp = UrlFetchApp.fetch(sb.url + '/auth/v1/admin/users/' + authUid, {
        method:'put',
        headers:{ 'apikey':sb.key, 'Authorization':'Bearer '+sb.key, 'Content-Type':'application/json' },
        payload: JSON.stringify({ password: String(newPw), email_confirm:true }),
        muteHttpExceptions:true
      });
      const c = upResp.getResponseCode();
      if(c < 200 || c >= 300) return { ok:false, error:'auth update failed ('+c+')' };
    } else {
      const crResp = UrlFetchApp.fetch(sb.url + '/auth/v1/admin/users', {
        method:'post',
        headers:{ 'apikey':sb.key, 'Authorization':'Bearer '+sb.key, 'Content-Type':'application/json' },
        payload: JSON.stringify({ email:email, password:String(newPw), email_confirm:true, user_metadata:{ staff_name:name } }),
        muteHttpExceptions:true
      });
      const c = crResp.getResponseCode();
      if(c < 200 || c >= 300) return { ok:false, error:'auth create failed ('+c+') '+crResp.getContentText().slice(0,100) };
      const u = JSON.parse(crResp.getContentText());
      authUid = u.id || (u.user && u.user.id);
      if(rows.length){
        UrlFetchApp.fetch(sb.url + '/rest/v1/staff_credentials?staff_name=eq.' + encodeURIComponent(name), {
          method:'patch',
          headers:{ 'apikey':sb.key, 'Authorization':'Bearer '+sb.key, 'Content-Type':'application/json', 'Prefer':'return=minimal' },
          payload: JSON.stringify({ auth_uid:authUid }), muteHttpExceptions:true
        });
      } else {
        UrlFetchApp.fetch(sb.url + '/rest/v1/staff_credentials', {
          method:'post',
          headers:{ 'apikey':sb.key, 'Authorization':'Bearer '+sb.key, 'Content-Type':'application/json', 'Prefer':'return=minimal' },
          payload: JSON.stringify({ staff_name:name, auth_uid:authUid, password_hash:'' }), muteHttpExceptions:true
        });
      }
    }
    UrlFetchApp.fetch(sb.url + '/rest/v1/staff_credentials?staff_name=eq.' + encodeURIComponent(name), {
      method:'patch',
      headers:{ 'apikey':sb.key, 'Authorization':'Bearer '+sb.key, 'Content-Type':'application/json', 'Prefer':'return=minimal' },
      payload: JSON.stringify({ must_reset:true }), muteHttpExceptions:true
    });
    return { ok:true };
  }catch(e){ return { ok:false, error: e.message }; }
}

function handleAdminRenameAuth(data){
  try{
    const oldName = (data.oldName || '').trim();
    const newName = (data.newName || '').trim();
    if(!newName) return { ok:false, error:'missing newName' };

    const sb = _sbService();
    if(!sb.key) return { ok:false, error:'server not configured' };

    function synth(n){
      const local = String(n).trim().toLowerCase()
        .replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,'.').replace(/\.+/g,'.').replace(/^\.|\.$/g,'');
      return local + '@oscars.local';
    }

    let authUid = null;
    [newName, oldName].forEach(function(nm){
      if(authUid || !nm) return;
      const url = sb.url + '/rest/v1/staff_credentials?staff_name=eq.' +
        encodeURIComponent(nm) + '&select=auth_uid';
      const resp = UrlFetchApp.fetch(url, {
        method:'get', headers:{ 'apikey':sb.key, 'Authorization':'Bearer '+sb.key }, muteHttpExceptions:true
      });
      if(resp.getResponseCode() === 200){
        const rows = JSON.parse(resp.getContentText());
        if(rows.length && rows[0].auth_uid) authUid = rows[0].auth_uid;
      }
    });

    if(!authUid) return { ok:false, error:'no auth account found for staff' };

    const upResp = UrlFetchApp.fetch(sb.url + '/auth/v1/admin/users/' + authUid, {
      method:'put',
      headers:{ 'apikey':sb.key, 'Authorization':'Bearer '+sb.key, 'Content-Type':'application/json' },
      payload: JSON.stringify({
        email: synth(newName),
        email_confirm: true,
        user_metadata: { staff_name: newName }
      }),
      muteHttpExceptions:true
    });
    const c = upResp.getResponseCode();
    if(c < 200 || c >= 300){
      return { ok:false, error:'auth email update failed ('+c+') '+upResp.getContentText().slice(0,120) };
    }

    // Keep staff_credentials.staff_name in sync with the new name, so later
    // auth_uid→name lookups (admin check, login) resolve to the CURRENT name.
    if(oldName && oldName !== newName){
      UrlFetchApp.fetch(sb.url + '/rest/v1/staff_credentials?auth_uid=eq.' + encodeURIComponent(authUid), {
        method:'patch',
        headers:{ 'apikey':sb.key, 'Authorization':'Bearer '+sb.key, 'Content-Type':'application/json', 'Prefer':'return=minimal' },
        payload: JSON.stringify({ staff_name: newName }),
        muteHttpExceptions:true
      });
    }

    return { ok:true, email: synth(newName) };
  }catch(e){
    return { ok:false, error: e.message };
  }
}

// ── Offboard: remove the login + every identity record, keep the history ──
//
function handleSetAdminFlag(data){
  // Promote/demote a staff member's admin flag. The DB has a trigger
  // (guard_staff_admin_flags) that blocks admin-flag changes unless the caller
  // is the service_role OR an existing hub admin — which is exactly why the
  // client-side toggle (anon key) silently failed. Here we use the service key,
  // which the trigger bypasses. The caller is still gated: setAdminFlag is in
  // ADMIN_ACTIONS, so doPost already verified via _isAdminCaller that whoever
  // is making this request is themselves a hub admin.
  try{
    const name = (data.staff || '').trim();
    if(!name) return { ok:false, error:'missing staff' };
    const col = (data.flag === 'shift') ? 'is_shift_admin' : 'is_hub_admin';
    const val = !!data.value;
    const sb = _sbService();
    if(!sb.key) return { ok:false, error:'server not configured' };

    var body = {}; body[col] = val;
    // PATCH the existing staff_settings row.
    const patch = UrlFetchApp.fetch(
      sb.url + '/rest/v1/staff_settings?name=eq.' + encodeURIComponent(name),
      { method:'patch',
        headers:{ 'apikey':sb.key, 'Authorization':'Bearer '+sb.key,
                  'Content-Type':'application/json', 'Prefer':'return=representation' },
        payload: JSON.stringify(body), muteHttpExceptions:true });
    const pc = patch.getResponseCode();
    if(pc < 200 || pc >= 300) return { ok:false, error:'update failed ('+pc+') '+patch.getContentText().slice(0,120) };

    var rows = [];
    try{ rows = JSON.parse(patch.getContentText()); }catch(_){}
    // No row existed → INSERT one carrying the flag.
    if(!rows.length){
      var ins = {}; ins.name = name; ins[col] = val;
      const post = UrlFetchApp.fetch(sb.url + '/rest/v1/staff_settings',
        { method:'post',
          headers:{ 'apikey':sb.key, 'Authorization':'Bearer '+sb.key,
                    'Content-Type':'application/json', 'Prefer':'return=minimal' },
          payload: JSON.stringify(ins), muteHttpExceptions:true });
      const ic = post.getResponseCode();
      if(ic < 200 || ic >= 300) return { ok:false, error:'insert failed ('+ic+') '+post.getContentText().slice(0,120) };
    }
    return { ok:true, staff:name, flag:col, value:val };
  }catch(e){
    return { ok:false, error:'setAdminFlag: ' + e.message };
  }
}


// Adding a staff member writes to SIX places: the ShiftOps roster payload,
// staff_names, staff_directory, staff_credentials, staff_settings, and Auth.
// The old version of this cleaned two of them, which is why departed staff
// kept showing up in ShiftOps — staff_names is the list ShiftOps reads on
// load, so leaving a row there brings them straight back.
//
// clock_log and leave_submissions are deliberately KEPT: they are payroll
// and HR history, and deleting them would rewrite the record of work that
// actually happened.
function handleOffboardStaff(data){
  try{
    const name = (data.staff || '').trim();
    if(!name) return { ok:false, error:'missing staff name' };

    const sb = _sbService();
    if(!sb.key) return { ok:false, error:'server not configured' };

    const H   = { 'apikey': sb.key, 'Authorization': 'Bearer ' + sb.key };
    const enc = encodeURIComponent;
    const removed = [];
    const failed  = [];

    // 1. Auth login. Read auth_uid BEFORE deleting the row that holds it.
    let authUid = null;
    try{
      const credResp = UrlFetchApp.fetch(
        sb.url + '/rest/v1/staff_credentials?staff_name=eq.' + enc(name) + '&select=auth_uid',
        { method:'get', headers:H, muteHttpExceptions:true });
      if(credResp.getResponseCode() === 200){
        const rows = JSON.parse(credResp.getContentText());
        authUid = rows.length ? rows[0].auth_uid : null;
      }
    }catch(e){ Logger.log('[offboard] cred lookup: ' + e.message); }

    if(authUid){
      const delResp = UrlFetchApp.fetch(sb.url + '/auth/v1/admin/users/' + authUid, {
        method:'delete', headers:H, muteHttpExceptions:true });
      const c = delResp.getResponseCode();
      // 404 is fine — already gone.
      if(c === 200 || c === 204 || c === 404){ removed.push('auth'); }
      else { return { ok:false, error:'auth delete failed (' + c + ')' }; }
    }

    // 2. Identity + related tables. Each runs independently — one failure must
    //    not stop the rest, or you end up half-offboarded, which is worse than
    //    either outcome. Note the column name differs between tables.
    //    This list was previously incomplete (only the 4 identity tables),
    //    which is why departed staff left orphan rows in availability /
    //    roster_config / app_access and kept resurfacing. Now cleans them all.
    //    clock_log and leave_submissions are deliberately NOT here — they're
    //    payroll/HR history and must survive offboarding.
    [
      { table:'staff_credentials',          col:'staff_name' },
      { table:'staff_directory',            col:'staff_name' },
      { table:'staff_names',                col:'name'       },
      { table:'staff_settings',             col:'name'       },
      { table:'staff_availability',         col:'staff_name' },
      { table:'staff_availability_history', col:'staff_name' },
      { table:'staff_roster_config',        col:'staff_name' },
      { table:'app_access',                 col:'staff_name' }
    ].forEach(function(t){
      try{
        const r = UrlFetchApp.fetch(
          sb.url + '/rest/v1/' + t.table + '?' + t.col + '=eq.' + enc(name),
          { method:'delete',
            headers: Object.assign({ 'Prefer':'return=minimal' }, H),
            muteHttpExceptions:true });
        const c = r.getResponseCode();
        if(c >= 200 && c < 300){ removed.push(t.table); }
        else { failed.push(t.table + ' (' + c + ')'); Logger.log('[offboard] ' + t.table + ' → ' + c); }
      }catch(e){
        failed.push(t.table + ' (' + e.message + ')');
        Logger.log('[offboard] ' + t.table + ': ' + e.message);
      }
    });

    // 3. The ShiftOps roster payload is a single JSON blob, so it can't be
    //    deleted by name from here. Pruning it would mean read-modify-write on
    //    the whole 46 KB row, which would clobber a concurrent roster edit.
    //    ShiftOps already holds the roster in memory and knows the numeric id,
    //    so it prunes the payload client-side in the same forceSave() that
    //    handles every other roster change.

    return {
      ok: true,
      authDeleted: !!authUid,
      removed: removed,
      failed: failed.length ? failed : undefined,
      note: 'clock_log and leave_submissions kept as history'
    };
  }catch(e){ return { ok:false, error: e.message }; }
}
// ── Admin-entered leave → write to the shared leave_submissions table that the
//    staff portal (Nexus) reads. Service key bypasses RLS. Lands pre-approved.
function handleAddLeave(data){
  try{
    const name   = (data.staff || '').trim();
    const from   = (data.from  || '').trim();
    const to     = (data.to    || '').trim();
    const reason = (data.reason == null) ? null : String(data.reason).trim();
    if(!name || !from || !to) return { ok:false, error:'missing fields' };

    const sb = _sbService();
    if(!sb.key) return { ok:false, error:'server not configured' };

    // Idempotency guard: skip if an identical leave row already exists.
    const checkUrl = sb.url + '/rest/v1/leave_submissions?staff_name=eq.' +
      encodeURIComponent(name) + '&from_date=eq.' + encodeURIComponent(from) +
      '&to_date=eq.' + encodeURIComponent(to) + '&select=id&limit=1';
    const chk = UrlFetchApp.fetch(checkUrl, {
      method:'get',
      headers:{ 'apikey':sb.key, 'Authorization':'Bearer '+sb.key },
      muteHttpExceptions:true
    });
    if(chk.getResponseCode() === 200){
      const existing = JSON.parse(chk.getContentText());
      if(existing.length){ return { ok:true, duplicate:true, id:existing[0].id }; }
    }

    const payload = {
      staff_name:  name,
      from_date:   from,
      to_date:     to,
      reason:      reason || null,
      status:      'approved',
      resolved_by: 'Admin (ShiftOps)',
      resolved_at: new Date().toISOString()
    };

    const resp = UrlFetchApp.fetch(sb.url + '/rest/v1/leave_submissions', {
      method:'post',
      headers:{ 'apikey':sb.key, 'Authorization':'Bearer '+sb.key,
                'Content-Type':'application/json', 'Prefer':'return=representation' },
      payload: JSON.stringify(payload),
      muteHttpExceptions:true
    });
    const c = resp.getResponseCode();
    if(c < 200 || c >= 300){
      return { ok:false, error:'insert failed ('+c+') ' + resp.getContentText().slice(0,120) };
    }
    let row = null;
    try{ const arr = JSON.parse(resp.getContentText()); row = arr.length ? arr[0] : null; }catch(e){}
    return { ok:true, id: row && row.id };
  }catch(e){ return { ok:false, error: e.message }; }
}
// ── Admin-removed leave → hard-delete the matching row(s) from the shared
//    leave_submissions table that Nexus reads. Service key bypasses RLS.
//    Matched by staff_name + from_date + to_date (no supabaseId needed).
function handleRemoveLeave(data){
  try{
    const name = (data.staff || '').trim();
    const from = (data.from  || '').trim();
    const to   = (data.to    || '').trim();
    if(!name || !from || !to) return { ok:false, error:'missing fields' };

    const sb = _sbService();
    if(!sb.key) return { ok:false, error:'server not configured' };

    const url = sb.url + '/rest/v1/leave_submissions?staff_name=eq.' +
      encodeURIComponent(name) + '&from_date=eq.' + encodeURIComponent(from) +
      '&to_date=eq.' + encodeURIComponent(to);

    // Trash any attached leave proofs first. If one can't be trashed, keep the row
    // so the proof is never orphaned in Drive.
    const lookup = UrlFetchApp.fetch(url + '&proof_path=not.is.null&select=proof_path', {
      method:'get',
      headers:{ 'apikey':sb.key, 'Authorization':'Bearer '+sb.key },
      muteHttpExceptions:true
    });
    if(lookup.getResponseCode() < 200 || lookup.getResponseCode() >= 300){
      return { ok:false, error:'proof lookup failed' };
    }
    const proofRows = JSON.parse(lookup.getContentText()) || [];
    for(const pr of proofRows){
      if(!_trashLeaveProof(pr.proof_path)){
        return { ok:false, error:'could not remove an attached proof; leave not deleted' };
      }
    }

    const resp = UrlFetchApp.fetch(url, {
      method:'delete',
      headers:{ 'apikey':sb.key, 'Authorization':'Bearer '+sb.key,
                'Prefer':'return=representation' },
      muteHttpExceptions:true
    });
    const c = resp.getResponseCode();
    if(c < 200 || c >= 300){
      return { ok:false, error:'delete failed ('+c+') ' + resp.getContentText().slice(0,120) };
    }
    let deleted = 0;
    try{ const arr = JSON.parse(resp.getContentText()); deleted = arr.length; }catch(e){}
    return { ok:true, deleted: deleted };
  }catch(e){ return { ok:false, error: e.message }; }
}
