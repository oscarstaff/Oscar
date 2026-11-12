/* ════════════════════════════════════════════════════════════════════════
   NEXUS · CRM v1 — Training Centre pipeline board   (crm.js + crm.css)
   Students and employers move through editable stages (table crm_stages).

   ACCESS is decided by the database, not by this file. Every read and write
   goes through RLS that calls crm_open(): the person has a 'crm' row in
   app_access AND is clocked in AND it is inside the hours in app_settings
   key 'crm_hours' (Sydney time). Hub admins are always allowed. This file only
   asks crm_status() so it can show *why* the CRM is closed, and it drops all
   CRM data from the page the moment access ends or the person leaves the page.

   Tables: crm_stages, crm_records (contact_id -> contacts), crm_stage_log.
   Stage history is written by a trigger; the client never writes the log.
   Globals used: SB, KEY, _sbBearer, me, myIsAdmin, esc, showToast, nxConfirm.
   REVERT: remove the crm.js script tag, crm.css link, #nav-crm and #page-crm.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var S = {
    status: null, kind: 'student', stages: [], records: [], staff: [], agents: null,
    mine: false, q: '', timer: null, loaded: false, myId: null, openId: null, accessChecked: false
  };

  function $(id){ return document.getElementById(id); }
  function E(s){
    if(typeof esc === 'function') return esc(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; });
  }
  function isAdmin(){ return (typeof myIsAdmin !== 'undefined') && myIsAdmin === true; }
  function myName(){ return (typeof me !== 'undefined') ? me : null; }
  function toast(m, v){ try{ showToast(m, v); }catch(e){} }

  /* ── network ─────────────────────────────────────────────────────────── */
  function hdr(extra){
    var h = { apikey: KEY, Authorization: 'Bearer ' + _sbBearer(), 'Content-Type': 'application/json' };
    if(extra) for(var k in extra) h[k] = extra[k];
    return h;
  }
  async function api(method, path, body, prefer){
    var r = await fetch(SB + '/rest/v1/' + path, {
      method: method, headers: hdr(prefer ? { Prefer: prefer } : null),
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    var t = await r.text();
    if(!r.ok){ var err = new Error(t || ('HTTP ' + r.status)); err.status = r.status; err.body = t; throw err; }
    return t ? JSON.parse(t) : [];
  }
  async function getStatus(){
    try{
      var r = await fetch(SB + '/rest/v1/rpc/crm_status', { method: 'POST', headers: hdr(), body: '{}' });
      if(!r.ok) return { state: 'error' };
      return await r.json();
    }catch(e){ return { state: 'error' }; }
  }

  /* ── formatting ──────────────────────────────────────────────────────── */
  function fmtWhen(iso){
    try{ return new Date(iso).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); }
    catch(e){ return ''; }
  }
  function daysIn(iso){
    var d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    return d < 1 ? 'today' : d + 'd';
  }
  function initials(name){
    var p = String(name || '').trim().split(/\s+/);
    return ((p[0] || '').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase() || '?';
  }
  function staffName(id){
    for(var i = 0; i < S.staff.length; i++) if(S.staff[i].id === id) return S.staff[i].staff_name;
    return '';
  }
  function stagesFor(kind){ return S.stages.filter(function(s){ return s.kind === kind; }); }
  function stageLabel(kind, key){
    var l = stagesFor(kind).filter(function(s){ return s.key === key; })[0];
    return l ? l.label : key;
  }
  function rec(id){ for(var i = 0; i < S.records.length; i++) if(S.records[i].id === id) return S.records[i]; return null; }

  /* ── shell ───────────────────────────────────────────────────────────── */
  function shell(){
    var pg = $('page-crm'); if(!pg) return null;
    if(!pg.dataset.built){
      pg.innerHTML =
        '<div class="page-hd"><div class="page-title">CRM</div></div>' +
        '<div id="crmRoot"></div>';
      pg.dataset.built = '1';
    }
    return $('crmRoot');
  }
  function wipe(){
    closeDrawer(); closeModal();
    S.records = []; S.agents = null; S.openId = null; S.loaded = false;
    var root = $('crmRoot'); if(root) root.innerHTML = '';
  }
  function stopTimer(){ if(S.timer){ clearInterval(S.timer); S.timer = null; } }

  function renderClosed(st){
    var root = shell(); if(!root) return;
    var win = st && st.window ? st.window.replace('-', '–') : '';
    var t = 'The CRM is closed', m = '';
    if(st.state === 'no_access'){ t = 'No CRM access'; m = 'Ask an admin to add you to the CRM.'; }
    else if(st.state === 'not_clocked_in'){ t = 'Clock in to open the CRM'; m = 'The CRM only opens while you are clocked in' + (win ? ' (today ' + win + ').' : '.'); }
    else if(st.state === 'outside_hours'){ t = 'The CRM is closed right now'; m = 'It is open Monday to Friday 9am–7pm and Saturday to Sunday 9am–4pm, Sydney time' + (win ? ' (today ' + win + ').' : '.'); }
    else if(st.state === 'error'){ t = 'Could not check CRM access'; m = 'Check your connection and try again.'; }
    root.innerHTML =
      '<div class="crm-closed">' +
        '<div class="crm-closed-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></svg></div>' +
        '<div class="crm-closed-t">' + E(t) + '</div>' +
        '<div class="crm-closed-m">' + E(m) + '</div>' +
        '<button type="button" class="crm-btn" id="crmRetry">Check again</button>' +
      '</div>';
    $('crmRetry').onclick = function(){ open(); };
  }

  /* ── load ────────────────────────────────────────────────────────────── */
  var REC_SELECT = 'id,contact_id,kind,stage,owner_id,team,source,notes,org,stage_changed_at,created_at,agent_contact_id,' +
    'contact:contacts!crm_records_contact_id_fkey(id,name,phone_primary,phone_secondary,email),' +
    'agent:contacts!crm_records_agent_contact_id_fkey(id,name)';

  async function loadRecords(){
    S.records = await api('GET', 'crm_records?select=' + REC_SELECT + '&org=eq.training_centre&order=stage_changed_at.desc&limit=1000');
  }
  async function loadAll(){
    var res = await Promise.all([
      api('GET', 'crm_stages?select=kind,key,label,position,is_closed&active=eq.true&order=position'),
      api('GET', 'staff_credentials?select=id,staff_name&order=staff_name'),
      loadRecords()
    ]);
    S.stages = res[0]; S.staff = res[1];
    var n = myName();
    S.myId = null;
    for(var i = 0; i < S.staff.length; i++) if(S.staff[i].staff_name === n) S.myId = S.staff[i].id;
    S.loaded = true;
  }

  async function open(){
    var root = shell(); if(!root) return;
    root.innerHTML = '<div class="crm-loading">Checking access…</div>';
    S.status = await getStatus();
    if(S.status.state !== 'open'){ stopTimer(); wipe(); renderClosed(S.status); return; }
    try{
      await loadAll();
    }catch(e){
      console.warn('crm load', e);
      S.status = await getStatus();
      wipe(); renderClosed(S.status.state === 'open' ? { state: 'error' } : S.status);
      return;
    }
    render();
    startTimer();
  }

  function startTimer(){
    stopTimer();
    S.timer = setInterval(async function(){
      var pg = $('page-crm');
      if(!pg || !pg.classList.contains('active')){ stopTimer(); return; }
      var st = await getStatus();
      if(st.state !== 'open'){ stopTimer(); wipe(); renderClosed(st); return; }
      S.status = st;
      if(!S.openId && !$('crmModal')){ try{ await loadRecords(); renderBoard(); }catch(e){} }
    }, 45000);
  }

  /* ── board ───────────────────────────────────────────────────────────── */
  function visibleRecords(){
    var q = S.q.toLowerCase();
    return S.records.filter(function(r){
      if(r.kind !== S.kind) return false;
      if(S.mine && r.owner_id !== S.myId) return false;
      if(q){
        var c = r.contact || {};
        var hay = ((c.name || '') + ' ' + (c.phone_primary || '') + ' ' + (c.phone_secondary || '') + ' ' + (c.email || '')).toLowerCase();
        if(hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  function render(){
    var root = shell(); if(!root) return;
    var win = S.status && S.status.window ? S.status.window.replace('-', '–') : '';
    root.innerHTML =
      '<div class="crm-bar">' +
        '<div class="crm-tabs" role="tablist">' +
          '<button type="button" role="tab" class="crm-tab" data-kind="student">Students</button>' +
          '<button type="button" role="tab" class="crm-tab" data-kind="employer">Employers</button>' +
        '</div>' +
        '<input type="search" id="crmSearch" class="crm-search" placeholder="Search name, phone or email" autocomplete="off">' +
        '<button type="button" class="crm-chip" id="crmMine" aria-pressed="false">Mine</button>' +
        '<span class="crm-grow"></span>' +
        (win ? '<span class="crm-hours" title="Today’s CRM hours (Sydney)">Open ' + E(win) + '</span>' : '') +
        (isAdmin() ? '<button type="button" class="crm-btn crm-btn-quiet" id="crmAccess">Access</button>' : '') +
        '<button type="button" class="crm-btn" id="crmAdd">+ Add</button>' +
      '</div>' +
      '<div id="crmBoard" class="crm-board"></div>';

    var tabs = root.querySelectorAll('.crm-tab');
    Array.prototype.forEach.call(tabs, function(t){
      t.onclick = function(){ S.kind = t.dataset.kind; syncBar(); renderBoard(); };
    });
    $('crmSearch').value = S.q;
    $('crmSearch').oninput = function(){ S.q = this.value; renderBoard(); };
    $('crmMine').onclick = function(){ S.mine = !S.mine; syncBar(); renderBoard(); };
    $('crmAdd').onclick = openAdd;
    if($('crmAccess')) $('crmAccess').onclick = openAccess;
    syncBar(); renderBoard();
  }
  function syncBar(){
    Array.prototype.forEach.call(document.querySelectorAll('#crmRoot .crm-tab'), function(t){
      var on = t.dataset.kind === S.kind;
      t.classList.toggle('on', on); t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    var m = $('crmMine'); if(m){ m.classList.toggle('on', S.mine); m.setAttribute('aria-pressed', S.mine ? 'true' : 'false'); }
  }

  function cardHtml(r){
    var c = r.contact || {};
    var owner = staffName(r.owner_id);
    return '<div class="crm-card" draggable="true" tabindex="0" data-id="' + E(r.id) + '">' +
      '<div class="crm-card-name">' + E(c.name || 'Unnamed') + '</div>' +
      (c.phone_primary ? '<div class="crm-card-sub">' + E(c.phone_primary) + '</div>' : '') +
      '<div class="crm-card-meta">' +
        (owner ? '<span class="crm-av" title="' + E(owner) + '">' + E(initials(owner)) + '</span>' : '<span class="crm-av crm-av-none" title="No owner">–</span>') +
        (r.agent && r.agent.name ? '<span class="crm-tag">' + E(r.agent.name) + '</span>' : '') +
        '<span class="crm-age">' + E(daysIn(r.stage_changed_at)) + '</span>' +
      '</div></div>';
  }

  function renderBoard(){
    var board = $('crmBoard'); if(!board) return;
    var recs = visibleRecords();
    var stages = stagesFor(S.kind);
    if(!stages.length){ board.innerHTML = '<div class="crm-empty">No stages set up for this list.</div>'; return; }
    board.innerHTML = stages.map(function(st){
      var inCol = recs.filter(function(r){ return r.stage === st.key; });
      return '<section class="crm-col' + (st.is_closed ? ' is-closed' : '') + (inCol.length ? '' : ' is-empty') + '" data-stage="' + E(st.key) + '">' +
        '<header class="crm-col-hd"><span>' + E(st.label) + '</span><span class="crm-count">' + inCol.length + '</span></header>' +
        '<div class="crm-col-body">' + inCol.map(cardHtml).join('') + '</div></section>';
    }).join('');
    if(!recs.length){
      board.insertAdjacentHTML('beforeend', '<div class="crm-empty crm-empty-all">' +
        (S.q || S.mine ? 'Nothing matches.' : 'No ' + (S.kind === 'student' ? 'students' : 'employers') + ' here yet. Tap + Add to bring one in from your contacts.') + '</div>');
    }
    wireBoard(board);
  }

  function wireBoard(board){
    Array.prototype.forEach.call(board.querySelectorAll('.crm-card'), function(el){
      el.onclick = function(){ openDrawer(el.dataset.id); };
      el.onkeydown = function(e){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openDrawer(el.dataset.id); } };
      el.ondragstart = function(e){
        try{ e.dataTransfer.setData('text/plain', el.dataset.id); e.dataTransfer.effectAllowed = 'move'; }catch(x){}
        el.classList.add('is-drag');
      };
      el.ondragend = function(){ el.classList.remove('is-drag'); Array.prototype.forEach.call(board.querySelectorAll('.crm-col'), function(c){ c.classList.remove('is-over'); }); };
    });
    Array.prototype.forEach.call(board.querySelectorAll('.crm-col'), function(col){
      col.ondragover = function(e){ e.preventDefault(); col.classList.add('is-over'); };
      col.ondragleave = function(e){ if(!col.contains(e.relatedTarget)) col.classList.remove('is-over'); };
      col.ondrop = function(e){
        e.preventDefault(); col.classList.remove('is-over');
        var id = ''; try{ id = e.dataTransfer.getData('text/plain'); }catch(x){}
        if(id) moveTo(id, col.dataset.stage);
      };
    });
  }

  /* ── writes ──────────────────────────────────────────────────────────── */
  async function lostAccess(){
    var st = await getStatus();
    if(st.state !== 'open'){ stopTimer(); wipe(); renderClosed(st); return true; }
    return false;
  }
  async function patchRecord(id, fields){
    var out = await api('PATCH', 'crm_records?id=eq.' + encodeURIComponent(id), fields, 'return=representation');
    if(!out.length) return null;      // RLS refused (CRM closed) or row gone
    return out[0];
  }
  async function moveTo(id, stage){
    var r = rec(id); if(!r || r.stage === stage) return;
    var prev = { stage: r.stage, at: r.stage_changed_at };
    r.stage = stage; r.stage_changed_at = new Date().toISOString();
    renderBoard(); if(S.openId === id) renderDrawer();
    try{
      var row = await patchRecord(id, { stage: stage });
      if(!row) throw new Error('refused');
      r.stage_changed_at = row.stage_changed_at || r.stage_changed_at;
      renderBoard(); if(S.openId === id) renderDrawer();
    }catch(e){
      r.stage = prev.stage; r.stage_changed_at = prev.at;
      if(await lostAccess()) { toast('The CRM has closed, so that change was not saved', 'error'); return; }
      renderBoard(); if(S.openId === id) renderDrawer();
      toast('Could not move that card', 'error');
    }
  }

  /* ── drawer ──────────────────────────────────────────────────────────── */
  function closeDrawer(){
    var d = $('crmDrawer'); if(d) d.remove();
    var s = $('crmScrim'); if(s) s.remove();
    S.openId = null;
  }
  async function ensureAgents(){
    if(S.agents) return S.agents;
    try{ S.agents = await api('GET', 'contacts?type=eq.agent&select=id,name&order=name&limit=200'); }catch(e){ S.agents = []; }
    return S.agents;
  }
  async function openDrawer(id){
    if(!rec(id)) return;
    S.openId = id;
    await ensureAgents();
    if(!rec(id)) return;
    if(!$('crmDrawer')){
      var sc = document.createElement('div'); sc.id = 'crmScrim'; sc.className = 'crm-scrim'; sc.onclick = closeDrawer;
      var d = document.createElement('aside'); d.id = 'crmDrawer'; d.className = 'crm-drawer';
      d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', 'CRM record');
      document.body.appendChild(sc); document.body.appendChild(d);
      document.addEventListener('keydown', escClose);
    }
    renderDrawer();
    loadHistory(id);
  }
  function escClose(e){
    if(e.key !== 'Escape') return;
    if($('crmModal')) closeModal(); else if($('crmDrawer')) closeDrawer();
    if(!$('crmModal') && !$('crmDrawer')) document.removeEventListener('keydown', escClose);
  }

  function renderDrawer(){
    var d = $('crmDrawer'); var r = rec(S.openId); if(!d || !r) return;
    var c = r.contact || {};
    var stages = stagesFor(r.kind);
    var ownerOpts = '<option value="">No owner</option>' + S.staff.map(function(s){
      return '<option value="' + E(s.id) + '"' + (s.id === r.owner_id ? ' selected' : '') + '>' + E(s.staff_name) + '</option>';
    }).join('');
    var agentOpts = '<option value="">No agent</option>' + (S.agents || []).map(function(a){
      return '<option value="' + E(a.id) + '"' + (a.id === r.agent_contact_id ? ' selected' : '') + '>' + E(a.name) + '</option>';
    }).join('');
    var tel = c.phone_primary ? '<a class="crm-link" href="tel:' + E(String(c.phone_primary).replace(/[^\d+]/g, '')) + '">' + E(c.phone_primary) + '</a>' : '';
    var tel2 = c.phone_secondary ? '<a class="crm-link" href="tel:' + E(String(c.phone_secondary).replace(/[^\d+]/g, '')) + '">' + E(c.phone_secondary) + '</a>' : '';
    var mail = c.email ? '<a class="crm-link" href="mailto:' + E(c.email) + '">' + E(c.email) + '</a>' : '';
    d.innerHTML =
      '<div class="crm-dr-hd"><div><div class="crm-dr-name">' + E(c.name || 'Unnamed') + '</div>' +
        '<div class="crm-dr-sub">' + E(r.kind === 'student' ? 'Student' : 'Employer') + ' · in ' + E(stageLabel(r.kind, r.stage)) + ' for ' + E(daysIn(r.stage_changed_at)) + '</div></div>' +
        '<button type="button" class="crm-x" id="crmDrClose" aria-label="Close">×</button></div>' +
      '<div class="crm-dr-body">' +
        '<div class="crm-lines">' + [tel, tel2, mail].filter(Boolean).join('') + (tel || tel2 || mail ? '' : '<span class="crm-muted">No contact details on file</span>') + '</div>' +
        '<div class="crm-lbl">Stage</div>' +
        '<div class="crm-stagechips">' + stages.map(function(s){
          return '<button type="button" class="crm-sc' + (s.key === r.stage ? ' on' : '') + '" data-stage="' + E(s.key) + '">' + E(s.label) + '</button>';
        }).join('') + '</div>' +
        '<div class="crm-grid2">' +
          '<label class="crm-f"><span class="crm-lbl">Owner</span><select id="crmFOwner" class="crm-in">' + ownerOpts + '</select></label>' +
          '<label class="crm-f"><span class="crm-lbl">Agent</span><select id="crmFAgent" class="crm-in">' + agentOpts + '</select></label>' +
        '</div>' +
        '<label class="crm-f"><span class="crm-lbl">Source</span><input id="crmFSource" class="crm-in" type="text" maxlength="80" value="' + E(r.source || '') + '" placeholder="e.g. DialTrac, referral, walk-in"></label>' +
        '<label class="crm-f"><span class="crm-lbl">Notes</span><textarea id="crmFNotes" class="crm-in" rows="5" maxlength="4000" placeholder="Notes for the team">' + E(r.notes || '') + '</textarea></label>' +
        '<div class="crm-actions"><button type="button" class="crm-btn" id="crmFSave">Save</button>' +
          (isAdmin() ? '<button type="button" class="crm-btn crm-btn-danger" id="crmFRemove">Remove from pipeline</button>' : '') + '</div>' +
        '<div class="crm-lbl crm-hist-t">History</div><div id="crmHist" class="crm-hist"><span class="crm-muted">Loading…</span></div>' +
      '</div>';
    $('crmDrClose').onclick = closeDrawer;
    Array.prototype.forEach.call(d.querySelectorAll('.crm-sc'), function(b){ b.onclick = function(){ moveTo(r.id, b.dataset.stage); }; });
    $('crmFSave').onclick = function(){ saveDrawer(r.id); };
    if($('crmFRemove')) $('crmFRemove').onclick = function(){ removeRecord(r.id); };
    loadHistory(r.id);
  }

  async function loadHistory(id){
    var box = $('crmHist'); if(!box) return;
    try{
      var rows = await api('GET', 'crm_stage_log?record_id=eq.' + encodeURIComponent(id) + '&select=from_stage,to_stage,changed_by,changed_at&order=changed_at.desc&limit=30');
      var r = rec(id); var kind = r ? r.kind : S.kind;
      if(S.openId !== id || !$('crmHist')) return;
      $('crmHist').innerHTML = rows.length ? rows.map(function(h){
        return '<div class="crm-h"><span>' + (h.from_stage ? E(stageLabel(kind, h.from_stage)) + ' → ' : 'Added → ') + '<b>' + E(stageLabel(kind, h.to_stage)) + '</b></span>' +
          '<span class="crm-muted">' + E(h.changed_by || '') + ' · ' + E(fmtWhen(h.changed_at)) + '</span></div>';
      }).join('') : '<span class="crm-muted">No history yet</span>';
    }catch(e){ if($('crmHist')) $('crmHist').innerHTML = '<span class="crm-muted">History unavailable</span>'; }
  }

  async function saveDrawer(id){
    var r = rec(id); if(!r) return;
    var fields = {
      owner_id: $('crmFOwner').value || null,
      agent_contact_id: $('crmFAgent').value || null,
      source: $('crmFSource').value.trim() || null,
      notes: $('crmFNotes').value.trim() || null
    };
    var btn = $('crmFSave'); btn.disabled = true;
    try{
      var row = await patchRecord(id, fields);
      if(!row) throw new Error('refused');
      r.owner_id = fields.owner_id; r.agent_contact_id = fields.agent_contact_id; r.source = fields.source; r.notes = fields.notes;
      var ag = null; (S.agents || []).forEach(function(a){ if(a.id === fields.agent_contact_id) ag = a; });
      r.agent = ag ? { id: ag.id, name: ag.name } : null;
      renderBoard(); toast('Saved', 'success');
    }catch(e){
      if(await lostAccess()) { toast('The CRM has closed, so that was not saved', 'error'); return; }
      toast('Could not save', 'error');
    }
    if($('crmFSave')) $('crmFSave').disabled = false;
  }

  async function removeRecord(id){
    var ok = (typeof nxConfirm === 'function')
      ? await nxConfirm('Remove this person from the pipeline? Their contact stays in your contacts.', { title: 'Remove from pipeline', okText: 'Remove', danger: true })
      : true;
    if(!ok) return;
    try{
      var out = await api('DELETE', 'crm_records?id=eq.' + encodeURIComponent(id), undefined, 'return=representation');
      if(!out.length) throw new Error('refused');
      S.records = S.records.filter(function(r){ return r.id !== id; });
      closeDrawer(); renderBoard(); toast('Removed', 'success');
    }catch(e){ toast('Could not remove', 'error'); }
  }

  /* ── modal helpers ───────────────────────────────────────────────────── */
  function closeModal(){ var m = $('crmModal'); if(m) m.remove(); }
  function openModalShell(title, bodyHtml){
    closeModal();
    var m = document.createElement('div'); m.id = 'crmModal'; m.className = 'crm-modal';
    m.innerHTML = '<div class="crm-sheet" role="dialog" aria-modal="true" aria-label="' + E(title) + '">' +
      '<div class="crm-dr-hd"><div class="crm-dr-name">' + E(title) + '</div><button type="button" class="crm-x" id="crmMClose" aria-label="Close">×</button></div>' +
      '<div class="crm-dr-body">' + bodyHtml + '</div></div>';
    m.addEventListener('mousedown', function(e){ if(e.target === m) closeModal(); });
    document.body.appendChild(m);
    $('crmMClose').onclick = closeModal;
    document.addEventListener('keydown', escClose);
    return m;
  }

  /* ── add ─────────────────────────────────────────────────────────────── */
  var pick = null, searchTimer = null;
  function openAdd(){
    pick = null;
    var stages = stagesFor(S.kind);
    var ownerOpts = '<option value="">No owner</option>' + S.staff.map(function(s){
      return '<option value="' + E(s.id) + '"' + (s.id === S.myId ? ' selected' : '') + '>' + E(s.staff_name) + '</option>';
    }).join('');
    openModalShell('Add ' + (S.kind === 'student' ? 'a student' : 'an employer'),
      '<div class="crm-seg"><button type="button" class="crm-segb on" data-m="find">Find contact</button><button type="button" class="crm-segb" data-m="new">New contact</button></div>' +
      '<div id="crmAddFind">' +
        '<input id="crmASearch" type="search" class="crm-in" placeholder="Search your contacts by name or phone" autocomplete="off">' +
        '<div id="crmAResults" class="crm-results"><span class="crm-muted">Type at least 2 characters</span></div>' +
      '</div>' +
      '<div id="crmAddNew" hidden>' +
        '<label class="crm-f"><span class="crm-lbl">Name</span><input id="crmNName" class="crm-in" type="text" maxlength="120"></label>' +
        '<div class="crm-grid2"><label class="crm-f"><span class="crm-lbl">Phone</span><input id="crmNPhone" class="crm-in" type="tel" maxlength="30"></label>' +
        '<label class="crm-f"><span class="crm-lbl">Email</span><input id="crmNEmail" class="crm-in" type="email" maxlength="120"></label></div>' +
      '</div>' +
      '<div id="crmAPicked" class="crm-picked" hidden></div>' +
      '<div class="crm-grid2">' +
        '<label class="crm-f"><span class="crm-lbl">Stage</span><select id="crmAStage" class="crm-in">' + stages.map(function(s){ return '<option value="' + E(s.key) + '">' + E(s.label) + '</option>'; }).join('') + '</select></label>' +
        '<label class="crm-f"><span class="crm-lbl">Owner</span><select id="crmAOwner" class="crm-in">' + ownerOpts + '</select></label>' +
      '</div>' +
      '<label class="crm-f"><span class="crm-lbl">Source</span><input id="crmASource" class="crm-in" type="text" maxlength="80" placeholder="e.g. DialTrac, referral, walk-in"></label>' +
      '<label class="crm-f"><span class="crm-lbl">Notes</span><textarea id="crmANotes" class="crm-in" rows="3" maxlength="4000"></textarea></label>' +
      '<div class="crm-actions"><button type="button" class="crm-btn" id="crmASave">Add to pipeline</button></div>');

    var mode = 'find';
    Array.prototype.forEach.call(document.querySelectorAll('#crmModal .crm-segb'), function(b){
      b.onclick = function(){
        mode = b.dataset.m;
        Array.prototype.forEach.call(document.querySelectorAll('#crmModal .crm-segb'), function(x){ x.classList.toggle('on', x === b); });
        $('crmAddFind').hidden = mode !== 'find'; $('crmAddNew').hidden = mode !== 'new';
        $('crmAPicked').hidden = mode !== 'find' || !pick;
      };
    });
    $('crmASearch').oninput = function(){
      var q = this.value.replace(/[,()*%]/g, ' ').trim();
      clearTimeout(searchTimer);
      if(q.length < 2){ $('crmAResults').innerHTML = '<span class="crm-muted">Type at least 2 characters</span>'; return; }
      searchTimer = setTimeout(function(){ searchContacts(q); }, 250);
    };
    $('crmASave').onclick = function(){ submitAdd(function(){ return mode; }); };
    setTimeout(function(){ var i = $('crmASearch'); if(i) i.focus(); }, 30);
  }

  async function searchContacts(q){
    var box = $('crmAResults'); if(!box) return;
    try{
      var rows = await api('GET', 'contacts?select=id,name,phone_primary,email&or=(name.ilike.*' + encodeURIComponent(q) + '*,phone_primary.ilike.*' + encodeURIComponent(q) + '*)&order=name&limit=15');
      if(!$('crmAResults')) return;
      if(!rows.length){ box.innerHTML = '<span class="crm-muted">No contacts match. Use New contact.</span>'; return; }
      box.innerHTML = rows.map(function(c){
        return '<button type="button" class="crm-res" data-id="' + E(c.id) + '"><b>' + E(c.name) + '</b><span class="crm-muted">' + E(c.phone_primary || c.email || '') + '</span></button>';
      }).join('');
      Array.prototype.forEach.call(box.querySelectorAll('.crm-res'), function(b, i){
        b.onclick = function(){
          pick = rows[i];
          var p = $('crmAPicked'); p.hidden = false;
          p.innerHTML = 'Selected: <b>' + E(pick.name) + '</b>' + (pick.phone_primary ? ' · ' + E(pick.phone_primary) : '');
          Array.prototype.forEach.call(box.querySelectorAll('.crm-res'), function(x){ x.classList.toggle('on', x === b); });
        };
      });
    }catch(e){ box.innerHTML = '<span class="crm-muted">Search failed</span>'; }
  }

  async function submitAdd(getMode){
    var btn = $('crmASave'); if(!btn) return; btn.disabled = true;
    try{
      var contactId = null;
      if(getMode() === 'find'){
        if(!pick){ toast('Pick a contact first, or use New contact', 'error'); btn.disabled = false; return; }
        contactId = pick.id;
      }else{
        var name = $('crmNName').value.trim(), phone = $('crmNPhone').value.trim(), email = $('crmNEmail').value.trim();
        if(!name){ toast('Enter a name', 'error'); btn.disabled = false; return; }
        if(phone){
          var dup = await api('GET', 'contacts?select=id,name&phone_primary=eq.' + encodeURIComponent(phone) + '&limit=1');
          if(dup.length){ contactId = dup[0].id; toast('Used existing contact ' + dup[0].name); }
        }
        if(!contactId){
          var body = { name: name, phone_primary: phone || null, email: email || null, created_by: myName() };
          if(S.kind === 'student') body.type = 'student';
          var made = await api('POST', 'contacts', body, 'return=representation');
          contactId = made[0].id;
        }
      }
      var row = {
        contact_id: contactId, kind: S.kind, stage: $('crmAStage').value,
        owner_id: $('crmAOwner').value || null, source: $('crmASource').value.trim() || null,
        notes: $('crmANotes').value.trim() || null, org: 'training_centre', created_by: S.myId
      };
      var out = await api('POST', 'crm_records', row, 'return=representation');
      if(!out.length) throw new Error('refused');
      await loadRecords();
      closeModal(); renderBoard(); toast('Added to the pipeline', 'success');
    }catch(e){
      if(e && e.status === 409){ toast('That contact is already in this pipeline', 'error'); }
      else if(await lostAccess()){ toast('The CRM has closed, so that was not saved', 'error'); return; }
      else toast('Could not add that contact', 'error');
      if($('crmASave')) $('crmASave').disabled = false;
    }
  }

  /* ── admin: who can open the CRM ─────────────────────────────────────── */
  async function openAccess(){
    var rows;
    try{ rows = await api('GET', 'app_access?app=eq.crm&select=id,staff_name'); }catch(e){ toast('Could not load access list', 'error'); return; }
    var has = {}; rows.forEach(function(r){ has[String(r.staff_name).toLowerCase().trim()] = r.id; });
    openModalShell('CRM access',
      '<p class="crm-muted crm-pad">People ticked can open the CRM while they are clocked in during CRM hours. Admins can always open it.</p>' +
      '<div class="crm-acc">' + S.staff.map(function(s){
        var k = String(s.staff_name).toLowerCase().trim();
        return '<label class="crm-acc-row"><input type="checkbox" data-name="' + E(s.staff_name) + '"' + (has[k] ? ' checked data-id="' + E(has[k]) + '"' : '') + '><span>' + E(s.staff_name) + '</span></label>';
      }).join('') + '</div>');
    Array.prototype.forEach.call(document.querySelectorAll('#crmModal .crm-acc input'), function(cb){
      cb.onchange = async function(){
        cb.disabled = true;
        try{
          if(cb.checked){
            var out = await api('POST', 'app_access', { app: 'crm', staff_name: cb.dataset.name }, 'return=representation');
            if(out[0]) cb.dataset.id = out[0].id;
          }else{
            await api('DELETE', 'app_access?id=eq.' + encodeURIComponent(cb.dataset.id), undefined, 'return=minimal');
            delete cb.dataset.id;
          }
        }catch(e){ cb.checked = !cb.checked; toast('Could not change access', 'error'); }
        cb.disabled = false;
      };
    });
  }

  /* ── nav + routing ───────────────────────────────────────────────────── */
  function showNav(){ var n = $('nav-crm'); if(n) n.style.display = ''; }
  function gateNav(n){
    n = n || 0;
    var nav = $('nav-crm'); var name = myName();
    if(!nav || !name){ if(n < 12) setTimeout(function(){ gateNav(n + 1); }, 1500); return; }
    if(isAdmin()){ showNav(); return; }
    if(!S.accessChecked && window._sbAuthToken){
      S.accessChecked = true;
      fetch(SB + '/rest/v1/app_access?app=eq.crm&select=staff_name', { headers: hdr() })
        .then(function(r){ return r.ok ? r.json() : []; })
        .then(function(rows){
          var mine = String(name).toLowerCase().trim();
          if((rows || []).some(function(x){ return String(x.staff_name).toLowerCase().trim() === mine; })) showNav();
        }).catch(function(){ S.accessChecked = false; });
    }
    if(nav.style.display === 'none' && n < 12) setTimeout(function(){ gateNav(n + 1); }, 1500);
  }

  if(typeof window.goTo === 'function'){
    var _go = window.goTo;
    window.goTo = function(p){
      var r = _go.apply(this, arguments);
      try{
        if(p === 'crm'){
          document.title = 'Nexus · CRM';
          var pg = $('page-crm');
          if(pg && pg.classList.contains('active')) open();
        }else if(S.loaded || S.timer){
          stopTimer(); wipe();
        }
      }catch(e){ console.warn('crm goTo', e); }
      return r;
    };
  }
  if(typeof window.gateCallLog === 'function'){
    var _gate = window.gateCallLog;
    window.gateCallLog = function(){
      var r = _gate.apply(this, arguments);
      try{ gateNav(0); }catch(e){}
      return r;
    };
  }
  window.nxCrm = { open: open, gateNav: gateNav };
})();
