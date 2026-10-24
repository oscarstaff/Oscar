// Gate.gs — web-app entry (doPost), token gate, rate limiting, validation, admin check.
// Every request comes through here; it then calls a handler in another file.

// ════════════════════════════════════════════════════════════════
// AUTH — shared-secret token gate
// ════════════════════════════════════════════════════════════════
function __setApiSecret(){
  PropertiesService.getScriptProperties()
    .setProperty('API_SECRET', 'oscars_gas_83235a5f0c1f6ba32b18235e2b2d544ac137167d');
  Logger.log('API_SECRET set. Now delete the literal from __setApiSecret.');
}
function _getApiSecret(){
  return PropertiesService.getScriptProperties().getProperty('API_SECRET') || '';
}
function __disableGate(){
  PropertiesService.getScriptProperties().deleteProperty('API_SECRET');
  Logger.log('Gate DISABLED — endpoint open again. Re-run __setApiSecret to re-enable.');
}

// ════════════════════════════════════════════════════════════════
// SERVICE KEY (admin auth operations) — run __setServiceKey ONCE, then delete literal.
// ════════════════════════════════════════════════════════════════
function __setServiceKey(){
  PropertiesService.getScriptProperties().setProperty(
    'SB_SERVICE_KEY', 'PASTE_YOUR_SERVICE_ROLE_KEY_HERE'
  );
  Logger.log('SB_SERVICE_KEY set. Delete the literal now.');
}
function _sbService(){
  return {
    url: 'https://jcfgldqrdbfkgbixszds.supabase.co',
    key: PropertiesService.getScriptProperties().getProperty('SB_SERVICE_KEY') || ''
  };
}


// ════════════════════════════════════════════════════════════════
// INPUT VALIDATION HELPERS
// ════════════════════════════════════════════════════════════════
function _isNonEmptyStr(v){ return typeof v === 'string' && v.trim().length > 0; }
function _validStaffName(v){
  if(!_isNonEmptyStr(v)) return false;
  const s = v.trim();
  if(s.length > MAX_NAME_LEN) return false;
  return /^[\p{L}][\p{L} .'\-]{0,118}$/u.test(s);
}
function _validDateStr(v){ return _isNonEmptyStr(v) && /^\d{2}\/\d{2}\/\d{4}$/.test(v.trim()); }
function _validTimeStr(v){
  if(v === '' || v == null) return true;
  return typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v.trim());
}
function _validAction(a){ return /^[a-zA-Z]{1,32}$/.test(String(a || '')); }


// ════════════════════════════════════════════════════════════════
// RATE LIMITER (CacheService sliding window; fails OPEN for availability)
// ════════════════════════════════════════════════════════════════
function _rateKey(caller, action){
  return 'rl_' + action + '_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(caller))
  ).slice(0, 16);
}
function _checkRateLimit(caller, action){
  const cfg = RATE_LIMITS[action] || RATE_LIMITS._default;
  try{
    const cache = CacheService.getScriptCache();
    const key = _rateKey(caller, action);
    const now = Date.now();
    const raw = cache.get(key);
    let hits = raw ? JSON.parse(raw) : [];
    hits = hits.filter(function(t){ return now - t < cfg.windowMs; });
    if(hits.length >= cfg.max){
      return { ok:false, retryMs: cfg.windowMs - (now - hits[0]) };
    }
    hits.push(now);
    cache.put(key, JSON.stringify(hits), Math.ceil(cfg.windowMs / 1000));
    return { ok:true };
  }catch(e){
    Logger.log('[ratelimit] cache error, allowing: ' + e.message);
    return { ok:true };
  }
}


// ════════════════════════════════════════════════════════════════
// CALLER IDENTITY + SUPABASE JWT VERIFICATION + ADMIN AUTHORIZATION
// ════════════════════════════════════════════════════════════════
function _callerId(data){
  if(_isNonEmptyStr(data.sbAccessToken)){
    const sub = _jwtSubject(data.sbAccessToken);
    if(sub) return 'uid:' + sub;
  }
  if(_isNonEmptyStr(data.staff))  return 'staff:'  + data.staff.trim().toLowerCase();
  if(_isNonEmptyStr(data.editor)) return 'editor:' + data.editor.trim().toLowerCase();
  return 'anon';
}
function _jwtSubject(token){
  try{
    const parts = String(token).split('.');
    if(parts.length !== 3) return null;
    const json = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[1])).getDataAsString();
    const claims = JSON.parse(json);
    return claims.sub || null;
  }catch(e){ return null; }
}
// Confirms the client's Supabase access token is valid (asks Supabase /auth/v1/user).
// Returns the user object or null. Requires client to send sbAccessToken.
function _verifySupabaseUser(token){
  if(!_isNonEmptyStr(token)) return null;
  try{
    const sb = _sbService();
    const resp = UrlFetchApp.fetch(sb.url + '/auth/v1/user', {
      method:'get',
      headers:{ 'apikey': sb.key, 'Authorization': 'Bearer ' + token },
      muteHttpExceptions:true
    });
    if(resp.getResponseCode() !== 200) return null;
    return JSON.parse(resp.getContentText());
  }catch(e){
    Logger.log('[jwt] verify error: ' + e.message);
    return null;
  }
}
// Admin status is read LIVE from staff_settings.is_hub_admin.
//
// ROBUST lookup (survives renames + older accounts):
//   1. Verify the caller's Supabase JWT (proves who they are).
//   2. Resolve their CURRENT staff name from staff_credentials via auth_uid
//      (auth_uid never changes, so a rename can't break this).
//   3. Fall back to the token's user_metadata.staff_name if step 2 finds nothing.
//   4. Check is_hub_admin in staff_settings for whichever name we resolved.
// Names come only from the VERIFIED token / server lookup, never from the
// client payload, so nobody can claim someone else's admin.
function _isAdminCaller(data){
  const props = PropertiesService.getScriptProperties();
  if(props.getProperty('ADMIN_OVERRIDE_OPEN') === '1') return true; // transitional only

  const user = _verifySupabaseUser(data.sbAccessToken);
  if(!user) return false;

  const sb = _sbService();
  if(!sb.key) return false;

  // ── resolve current name ──
  const names = [];
  // (a) by auth_uid → staff_credentials.staff_name (authoritative, rename-proof)
  if(user.id){
    try{
      const u = sb.url + '/rest/v1/staff_credentials?auth_uid=eq.' +
        encodeURIComponent(user.id) + '&select=staff_name&limit=1';
      const r = UrlFetchApp.fetch(u, { method:'get',
        headers:{ 'apikey':sb.key, 'Authorization':'Bearer '+sb.key }, muteHttpExceptions:true });
      if(r.getResponseCode() === 200){
        const rows = JSON.parse(r.getContentText());
        if(rows.length && _isNonEmptyStr(rows[0].staff_name)) names.push(rows[0].staff_name.trim());
      }
    }catch(e){ Logger.log('[admin] cred lookup: ' + e.message); }
  }
  // (b) fallback: token metadata name
  const metaName = user.user_metadata && user.user_metadata.staff_name;
  if(_isNonEmptyStr(metaName)) names.push(metaName.trim());

  if(!names.length) return false;

  // ── check is_hub_admin for any resolved name ──
  for(var i = 0; i < names.length; i++){
    try{
      const u = sb.url + '/rest/v1/staff_settings?name=eq.' +
        encodeURIComponent(names[i]) + '&select=is_hub_admin&limit=1';
      const r = UrlFetchApp.fetch(u, { method:'get',
        headers:{ 'apikey':sb.key, 'Authorization':'Bearer '+sb.key }, muteHttpExceptions:true });
      if(r.getResponseCode() !== 200) continue;
      const rows = JSON.parse(r.getContentText());
      if(rows.length && rows[0].is_hub_admin === true) return true;
    }catch(e){ Logger.log('[admin] settings lookup: ' + e.message); }
  }
  return false;   // fail CLOSED
}


// ════════════════════════════════════════════════════════════════
// PER-ACTION INPUT VALIDATION
// ════════════════════════════════════════════════════════════════
function _validateInput(action, data){
  switch(action){
    case 'punch':
      if(!_validStaffName(data.staff)) return 'invalid staff name';
      if(data.type !== 'in' && data.type !== 'out') return 'invalid punch type';
      return null;
    case 'updatePunch':
      if(!_validStaffName(data.staff)) return 'invalid staff name';
      if(!_validDateStr(data.date)) return 'invalid date (dd/MM/yyyy)';
      if(data.timeIn  !== undefined && !_validTimeStr(data.timeIn))  return 'invalid timeIn';
      if(data.timeOut !== undefined && !_validTimeStr(data.timeOut)) return 'invalid timeOut';
      return null;
    case 'getReport':
      if(!_validStaffName(data.staff)) return 'invalid staff name';
      return null;
    case 'resetPwViaSQ':
      if(!_validStaffName(data.staff)) return 'invalid staff name';
      if(!_isNonEmptyStr(data.a1hash) || !_isNonEmptyStr(data.a2hash)) return 'missing answers';
      if(!_isNonEmptyStr(data.newPassword) || String(data.newPassword).length < 8) return 'password must be 8+ chars';
      return null;
    case 'adminSetPw':
      if(!_validStaffName(data.staff)) return 'invalid staff name';
      if(!_isNonEmptyStr(data.newPassword) || String(data.newPassword).length < 8) return 'password must be 8+ chars';
      return null;
    case 'adminRenameAuth':
      if(!_validStaffName(data.newName)) return 'invalid newName';
      return null;
    case 'offboardStaff':
      if(!_validStaffName(data.staff)) return 'invalid staff name';
      return null;
    case 'setAdminFlag':
      if(!_validStaffName(data.staff)) return 'invalid staff name';
      if(data.flag !== 'hub' && data.flag !== 'shift') return 'flag must be hub or shift';
      if(typeof data.value !== 'boolean') return 'value must be boolean';
      return null;
    case 'uploadLeaveProof':
      if(!_isNonEmptyStr(data.base64)) return 'missing base64';
      if(data.base64.length * 0.75 > MAX_LEAVE_PROOF_BYTES) return 'file too large';
      if(!Object.prototype.hasOwnProperty.call(LEAVE_PROOF_MIME, data.mime)) return 'file type not allowed';
      return null;
    case 'deleteLeaveProof':
      if(!_isNonEmptyStr(data.fileId) || !/^[A-Za-z0-9_-]{10,80}$/.test(data.fileId)) return 'invalid file id';
      return null;
    case 'getLeaveProof':
      if(!_isNonEmptyStr(data.fileId) || !/^[A-Za-z0-9_-]{10,80}$/.test(data.fileId)) return 'invalid file id';
      return null;
    case 'uploadDoc':
      if(!_isNonEmptyStr(data.base64)) return 'missing base64';
      if(data.base64.length * 0.75 > MAX_BASE64_BYTES) return 'file too large';
      if(data.filename && data.filename.length > MAX_NAME_LEN) return 'filename too long';
      return null;
    case 'uploadTemplate':
      if(!_isNonEmptyStr(data.name)) return 'name required';
      if(data.name.length > MAX_NAME_LEN) return 'name too long';
      if(!_isNonEmptyStr(data.pdfBase64)) return 'missing pdfBase64';
      if(data.pdfBase64.length * 0.75 > MAX_BASE64_BYTES) return 'file too large';
      return null;
    case 'fetchTemplate':
    case 'deleteTemplate':
    case 'fetchDoc':
      if(!_isNonEmptyStr(data.id)) return 'id required';
      return null;
    case 'renameTemplate':
      if(!_isNonEmptyStr(data.id) || !_isNonEmptyStr(data.newName)) return 'id + newName required';
      if(data.newName.length > MAX_NAME_LEN) return 'newName too long';
      return null;
    case 'removeLeave':
      if(!_validStaffName(data.staff)) return 'invalid staff name';
      if(!_isNonEmptyStr(data.from) || !/^\d{4}-\d{2}-\d{2}$/.test(data.from.trim())) return 'invalid from date (yyyy-MM-dd)';
      if(!_isNonEmptyStr(data.to)   || !/^\d{4}-\d{2}-\d{2}$/.test(data.to.trim()))   return 'invalid to date (yyyy-MM-dd)';
      return null;
    case 'listTemplates':
      return null;
    case 'addLeave':
      if(!_validStaffName(data.staff)) return 'invalid staff name';
      if(!_isNonEmptyStr(data.from) || !/^\d{4}-\d{2}-\d{2}$/.test(data.from.trim())) return 'invalid from date (yyyy-MM-dd)';
      if(!_isNonEmptyStr(data.to)   || !/^\d{4}-\d{2}-\d{2}$/.test(data.to.trim()))   return 'invalid to date (yyyy-MM-dd)';
      if(data.from.trim() > data.to.trim()) return 'from date after to date';
      if(data.reason !== undefined && data.reason !== null && String(data.reason).length > MAX_STR_LEN) return 'reason too long';
      return null;
    case 'sendResetEmail':
      if(!_isNonEmptyStr(data.email) || data.email.indexOf('@') < 1) return 'invalid email';
      return null;
    case 'consumeReset':
      if(!_isNonEmptyStr(data.resetToken) && !_isNonEmptyStr(data.token)) return 'missing token';
      if(!_isNonEmptyStr(data.newPassword) || String(data.newPassword).length < 8) return 'password must be 8+ chars';
      return null;
    case 'checkReset':
      if(!_isNonEmptyStr(data.resetToken) && !_isNonEmptyStr(data.token)) return 'missing token';
      return null;
      default:
      return null; // unknown actions rejected by the router
  }
}

// ════════════════════════════════════════════════════════════════
// HARDENED ROUTER
// ════════════════════════════════════════════════════════════════
function doPost(e){
  try{
    // 0. Payload size cap (before parsing).
    if(!e || !e.postData || !e.postData.contents){
      return respond({ error: 'empty request' });
    }
    if(e.postData.contents.length > MAX_PAYLOAD_BYTES){
      return respond({ error: 'payload too large' });
    }

    // 1. Parse (malformed JSON → clean reject).
    let data;
    try{ data = JSON.parse(e.postData.contents); }
    catch(_){ return respond({ error: 'malformed JSON' }); }
    if(typeof data !== 'object' || data === null){
      return respond({ error: 'invalid payload' });
    }

    // 2. Shared-token gate (fail-safe floor).
    const secret = _getApiSecret();
    if(secret && data.token !== secret){
      return respond({ error: 'unauthorized' });
    }

    // 3. Action shape.
    const action = data.action || 'punch';
    if(!_validAction(action)){
      return respond({ error: 'invalid action' });
    }

    // 4. Rate limit (per caller+action).
    const caller = _callerId(data);
    const rl = _checkRateLimit(caller, action);
    if(!rl.ok){
      return respond({ error: 'rate limited', retryAfterSec: Math.ceil(rl.retryMs / 1000) });
    }

    // 5. Admin authorization for sensitive actions.
    if(ADMIN_ACTIONS[action] && !_isAdminCaller(data)){
      return respond({ error: 'forbidden' });
    }

    // 6. Per-action input validation.
    const verr = _validateInput(action, data);
    if(verr){ return respond({ error: verr }); }

    // 7. Dispatch.
    if(action === 'punch')           return respond(handlePunch(data));
    if(action === 'getReport')       return respond(handleGetReport(data));
    if(action === 'updatePunch')     return respond(handleUpdatePunch(data));
    if(action === 'uploadDoc')       return respond(handleUploadDoc(data));
    if(action === 'uploadLeaveProof') return respond(handleUploadLeaveProof(data));
    if(action === 'getLeaveProof')    return respond(handleGetLeaveProof(data));
    if(action === 'deleteLeaveProof') return respond(handleDeleteLeaveProof(data));
    if(action === 'resetPwViaSQ')    return respond(handleResetPasswordViaSQ(data));
    if(action === 'adminSetPw')      return respond(handleAdminSetPw(data));
    if(action === 'adminRenameAuth') return respond(handleAdminRenameAuth(data));
    if(action === 'listTemplates')   return respond(handleListTemplates(data));
    if(action === 'uploadTemplate')  return respond(handleUploadTemplate(data));
    if(action === 'fetchTemplate')   return respond(handleFetchTemplate(data));
    if(action === 'deleteTemplate')  return respond(handleDeleteTemplate(data));
    if(action === 'renameTemplate')  return respond(handleRenameTemplate(data));
    if(action === 'fetchDoc')        return respond(handleFetchDoc(data));
    if(action === 'offboardStaff')   return respond(handleOffboardStaff(data));
    if(action === 'setAdminFlag')    return respond(handleSetAdminFlag(data));
    if(action === 'addLeave')        return respond(handleAddLeave(data));
    if(action === 'removeLeave')     return respond(handleRemoveLeave(data));
    if(action === 'sendResetEmail')  return respond(handleSendResetEmail(data));
    if(action === 'consumeReset')    return respond(handleConsumeReset(data));
    if(action === 'checkReset')      return respond(handleCheckReset(data));
    if(action === 'sendWelcomeEmail') return respond(handleSendWelcomeEmail(data));

    return respond({ error: 'Unknown action: ' + action });
  }catch(err){
    return respond({ error: err.message }); // never err.stack
  }
}
function respond(obj){
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
