// ── AVAILABILITY ──────────────────────────────────────────────────────────
function getAvail(staffId,day){
  const dayAvail=availability[staffId]||{};
  // Handle both integer and string keys (Supabase returns string keys)
  return dayAvail[day]||dayAvail[String(day)]||{type:'unset'};
}
function setAvail(staffId,day,val){
  if(!availability[staffId])availability[staffId]={};
  // Weekend 'Available' means 9–4, not the weekday 9–7. Store it as explicit
  // custom 09:00–16:00 so every reader (labels, roster fill, saves) reflects the
  // real weekend window without needing day-aware logic elsewhere.
  if(val && val.type==='all' && (day===5 || day===6)){
    val={type:'custom',start:'09:00',end:'16:00'};
  }
  availability[staffId][day]=val;
  markDirty();
  // Buffer during edit mode — the write happens on Save, not on every click.
  // Outside edit mode the chips are locked, so this branch is the only path
  // and it must NOT auto-write (that was how a stray click silently changed
  // someone's pattern). Track who changed so Save only PATCHes those people.
  if(window._availEditMode){
    _availEditedIds.add(staffId);
    return;
  }
  // Per-row edit: if THIS staff row is the one being edited, buffer the change
  // and wait for the row's Save button — don't auto-write on each click.
  if(_availRowEditing===staffId){
    _availEditedIds.add(staffId);
    return;
  }
  // Write THROUGH to staff_availability, the source of truth.
  pushAvailToSource(staffId);
}
let _availRowEditing = null;   // staffId of the row currently in per-line edit, or null
// Unlock ONE staff row for editing (per-line availability).
let _availRowSnap = null;
function editOneAvail(staffId){
  if(_availRowEditing!==null && _availRowEditing!==staffId) cancelOneAvail(_availRowEditing, true);
  _availRowSnap = JSON.parse(JSON.stringify(availability[staffId]||{}));
  _availRowEditing = staffId;
  renderAvailability();
}
// Save just this one staff member's availability, then lock the row again.
async function saveOneAvail(staffId){
  try{
    _availEditedIds.add(staffId);
    await _doPushAvail(Number(staffId));   // immediate, awaited write for this person
    _availEditedIds.delete(staffId);
  }catch(e){ console.warn('saveOneAvail',e); showToast('Save failed — try again'); }
  _availRowEditing = null; _availRowSnap = null;
  renderAvailability(); renderRoster();
}
// Throw away this row's unsaved clicks and lock it again.
function cancelOneAvail(staffId, quiet){
  if(_availRowSnap) availability[staffId]=_availRowSnap;
  _availRowSnap=null; _availRowEditing=null;
  try{ _availEditedIds.delete(staffId); }catch(e){}
  if(!quiet){ renderAvailability(); renderRoster(); }
}
let _availEditedIds = new Set();

let _pushAvailTimers={};
/**
 * Debounced per-person write of the whole weekly pattern. Debounced because
 * setting Mon–Sun is seven rapid calls, and seven PATCHes for one person's
 * week is needless.
 */
function pushAvailToSource(staffId){
  clearTimeout(_pushAvailTimers[staffId]);
  _pushAvailTimers[staffId]=setTimeout(async function(){
    await _doPushAvail(staffId);
  },600);
}
// Immediate, awaitable push of one person (used by Save so it doesn't wait on
// the debounce). Shares the same write body as the debounced path.
async function _flushAvailPush(){
  const ids=Object.keys(_pushAvailTimers);
  ids.forEach(function(k){ clearTimeout(_pushAvailTimers[k]); });
  // Push everyone currently marked edited, awaited.
  const editList = (typeof _availEditedIds!=='undefined' && _availEditedIds.size)
    ? Array.from(_availEditedIds) : [];
  for(const id of editList){ await _doPushAvail(Number(id)); }
}
async function _doPushAvail(staffId){
    try{
      const s=(staff||[]).find(function(x){ return x.id===staffId; });
      if(!s) return false;
      const name=((s.first||'')+' '+(s.last||'')).trim();
      if(!name) return false;
      const week={};
      for(let d=0; d<7; d++){
        const v=(availability[staffId]||{})[d];
        if(v) week[String(d)]=v;
      }
      // on_conflict=staff_name is REQUIRED: the primary key here is `id`, and
      // PostgREST resolves merge-duplicates against the PK unless told
      // otherwise. Without it the upsert tried to INSERT, hit the UNIQUE
      // constraint on staff_name, and came back 409 — which surfaced as
      // "not saved" with nothing written.
      // staff_availability allows anon SELECT/UPDATE but NOT INSERT; the upsert
      // needs INSERT, which only the authenticated role has (sa_auth). Use the
      // signed-in user's token so the upsert isn't rejected. apikey stays anon.
      const _atok = (typeof _soTok==='function' && _soTok()) ? _soTok() : SUPABASE_KEY;
      const _avH = {apikey:SUPABASE_KEY, Authorization:'Bearer '+_atok, 'Content-Type':'application/json'};
      const r=await fetch(SUPABASE_URL+'/rest/v1/staff_availability?on_conflict=staff_name',{
        method:'POST',
        headers:Object.assign({Prefer:'resolution=merge-duplicates,return=representation'},_avH),
        body:JSON.stringify({staff_name:name, availability:week,
                             is_ongoing:true, valid_from:null, valid_until:null,
                             updated_at:new Date().toISOString(),
                             // Admin made this change here — stamp it reviewed so
                             // it doesn't light up its own "needs review" flag.
                             availability_reviewed_at:new Date().toISOString()})
      });
      if(!r.ok){
        const detail=await r.text().catch(function(){return '';});
        console.error('[AVAIL] save failed HTTP '+r.status, detail);
        throw new Error('HTTP '+r.status);
      }
      const saved=await r.json().catch(function(){return null;});
      if(!saved || !saved.length) throw new Error('nothing written');
      // Keep the sync signature fresh so our own write doesn't look like a
      // remote change and trigger a pointless re-apply.
      _lastAvailSig='';
      showToast('Availability saved for '+s.first);
      return true;
    }catch(e){
      console.warn('pushAvailToSource',e);
      showToast('Availability not saved — check connection');
      return false;
    }
}

let editingAvail={staffId:null,day:null};

function _av2Fmt(t){ const m=/^(\d{1,2}):(\d{2})/.exec(String(t||'')); if(!m) return ''; let h=+m[1]; const ap=h>=12?'pm':'am'; h=h%12||12; return h+(m[2]!=='00'?':'+m[2]:'')+ap; }
function _av2Min(t){ const m=/^(\d{1,2}):(\d{2})/.exec(String(t||'')); return m?(+m[1])*60+(+m[2]):null; }
/* One availability cell: a label plus a thin bar drawn on a 7am–9pm track, so
   the hours someone can work read at a glance without a wall of coloured boxes. */
function _av2Cell(av, day){
  let type=av.type, start=null, end=null, label='';
  if(type==='all'){ start=(day>=5)?'09:00':'09:00'; end=(day>=5)?'16:00':'19:00'; }
  else if(type==='custom'){ start=av.start; end=av.end; }
  if(start&&end) label=_av2Fmt(start)+' – '+_av2Fmt(end);
  else if(type==='no') label='Off';
  else label='Not set';
  let bar='';
  if(start&&end){
    const T0=7*60, SPAN=14*60, a=Math.max(0,(_av2Min(start)-T0)/SPAN), b=Math.min(1,(_av2Min(end)-T0)/SPAN);
    bar='<i style="left:'+(a*100).toFixed(1)+'%;width:'+(Math.max(.04,b-a)*100).toFixed(1)+'%"></i>';
  }
  const cls=(type==='all'||type==='custom')?'av2-yes':(type==='no'?'av2-no':'av2-unset');
  return {cls:cls, html:'<span class="av2-t">'+label+'</span><span class="av2-track">'+bar+'</span>'};
}
function renderAvailability(){
  const grid=document.getElementById('availGrid');
  const weekLabel=`${fmtDate(currentWeekStart)} – ${fmtDate(addDays(currentWeekStart,6))}`;
  let html=`<div class="avail-header">
    <div>
      <div class="section-title">Staff Availability</div>
      <div class="av-week">Week of ${weekLabel} · bars show the hours each person can work</div>
    </div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <button onclick="downloadAvailabilityGrid()" class="btn btn-ghost" style="gap:6px;display:flex;align-items:center;">
        <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>Download PDF
      </button>
      <button id="availSetBtn" class="btn btn-primary" onclick="enterAvailEdit()" style="display:none">Set Availability</button>
      <button id="availSaveBtn" class="btn btn-save" onclick="saveAvailEdit()" style="display:none">Save</button>
      <button id="availCancelBtn" class="btn" onclick="cancelAvailEdit()" style="display:none">Cancel</button>
    </div>
  </div>
  <div id="availEditHint" style="display:none;background:var(--accent-dim);border:1px solid var(--accent-bd);border-radius:8px;padding:8px 12px;margin:0 0 12px;font-size:12px;color:var(--accent-text)">
    <strong>Edit mode</strong> — click a day to change it. Nothing is saved until you press <strong>Save</strong>.
  </div>`;

  // ── Team filter pills ──
  const _teams = getUniqueTeams();
  const _teamCount = function(t){ return staff.filter(function(p){ return (p.team||'Unassigned')===t; }).length; };
  let fbar = `<div class="role-filter-bar avail-filter" role="group" aria-label="Filter by team">
    <div class="role-pill${_availTeamFilter===null?' active':''}" onclick="setAvailTeamFilter(null)">All teams <span class="rp-n">${staff.length}</span></div>`;
  _teams.forEach(t=>{ const enc=t.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    fbar += `<div class="role-pill${_availTeamFilter===t?' active':''}" onclick="setAvailTeamFilter('${enc}')">${t} <span class="rp-n">${_teamCount(t)}</span></div>`; });
  fbar += `</div>`;
  html += fbar;

  const _byTeam = {};
  [...staff].sort((a,b)=>a.first.localeCompare(b.first)||a.last.localeCompare(b.last))
    .forEach(p=>{ const t=p.team||'Unassigned'; (_byTeam[t]=_byTeam[t]||[]).push(p); });
  const _showTeams = _availTeamFilter ? [_availTeamFilter] : Object.keys(_byTeam).sort((a,b)=>a.localeCompare(b));

  _showTeams.forEach(team=>{
    const members = _byTeam[team]||[];
    if(!members.length) return;
    html += `<div class="role-view-card avail-team-card av2-card" data-team="${(team||'').replace(/"/g,'&quot;')}">
      <div class="role-view-header"><div class="role-view-title">${team}</div><span class="av2-count">${members.length} staff</span></div>`;

    html+=`<div class="avail-row avail-hd-row av2-row"><div class="avail-name avail-hd-name">Staff</div>`;
    for(let d=0;d<7;d++){
      const day=addDays(currentWeekStart,d);
      html+=`<div class="avail-cell avail-dh${isToday(day)?' avail-today':''}"><span class="avail-dh-d">${DAYS[d]}</span><span class="avail-dh-n">${fmtDate(day)}</span></div>`;
    }
    html+='</div>';

    const perDay=[0,0,0,0,0,0,0];
    members.forEach(s=>{
      const _editing = _availRowEditing===s.id;
      let _okDays=0,_unsetDays=0;
      for(let d=0;d<7;d++){ const _a=getAvail(s.id,d); if(_a.type==='all'||_a.type==='custom'){ _okDays++; perDay[d]++; } else if(_a.type!=='no') _unsetDays++; }
      const actions = _editing
        ? `<div class="av2-act-on"><button class="btn btn-save" onclick="saveOneAvail(${s.id})" data-tl-hide="1">Save</button><button class="btn btn-ghost" onclick="cancelOneAvail(${s.id})" data-tl-hide="1">Cancel</button></div>`
        : '';
      const editBtn = _editing ? '' : `<button class="av2-edit" onclick="editOneAvail(${s.id})" title="Edit ${s.first}'s availability" aria-label="Edit ${s.first}'s availability" data-tl-hide="1"><svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg></button>`;
      html+=`<div class="avail-row av2-row${_editing?' avail-row-editing':''}" data-avail-staff="${s.id}" data-team="${(s.team||'').replace(/"/g,'&quot;')}">
        <div class="avail-name"><div class="avail-dot" style="background:${s.color};flex-shrink:0"></div>
          <div class="avail-who"><button type="button" class="avail-who-n name-link" onclick="openEmpProfile(${s.id})" title="Open ${s.first}'s profile" aria-label="Open ${s.first} ${s.last}'s profile">${s.first} ${s.last}</button>
          ${_editing?actions:`<span class="avail-who-s">${_okDays} of 7 days${_unsetDays?` · <b class="av2-unset-n">${_unsetDays} not set</b>`:''}</span>`}</div>${editBtn}</div>`;
      for(let d=0;d<7;d++){
        const c=_av2Cell(getAvail(s.id,d), d);
        html+=`<div class="avail-cell${isToday(addDays(currentWeekStart,d))?' avail-today':''}"><div class="avail-chip av2 ${c.cls}" onclick="cycleAvail(${s.id},${d})">${c.html}</div>`+
              `<div class="avail-custom av2-custom" onclick="openCustomAvail(${s.id},${d})" title="Set custom hours" aria-label="Set custom hours"><svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg></div></div>`;
      }
      html+='</div>';
    });

    // per-day count: how many on this team can work that day
    html+=`<div class="avail-row av2-row av2-foot"><div class="avail-name"><span class="av2-foot-l">Available</span></div>`;
    for(let d=0;d<7;d++){
      const n=perDay[d];
      html+=`<div class="avail-cell${isToday(addDays(currentWeekStart,d))?' avail-today':''}"><span class="av2-foot-n${n===0?' av2-foot-zero':''}">${n}<span> / ${members.length}</span></span></div>`;
    }
    html+='</div></div>';
  });

  if(!_showTeams.length) html+=`<div style="padding:40px;text-align:center;color:var(--text-dim);font-size:13px">No staff found.</div>`;
  grid.innerHTML=html;
  try{ if(typeof applyTeamLeadLock==='function' && document.body.classList.contains('tl-readonly')) applyTeamLeadLock(); }catch(e){}
}

let _availTeamFilter = null;
function setAvailTeamFilter(t){ _availTeamFilter = t; renderAvailability(); }


// ── SUBMITTED AVAILABILITY VIEW ──
