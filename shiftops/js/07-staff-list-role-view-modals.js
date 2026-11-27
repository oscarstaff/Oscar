// ── STAFF LIST ────────────────────────────────────────────────────────────
function renderStaffList(){
  try{ _syncWeekLeavesToSubmissions(); }catch(e){}
  const el=document.getElementById('staffList');
  const tl={full:'Full-time',part:'Part-time',casual:'Casual'},tb={full:'badge-full',part:'badge-part',casual:'badge-casual'};
  let html=`<div class="staff-list-header">
    <div class="section-title">Employee Management <span style="color:var(--text-dim);font-weight:400">(${staff.length})</span></div>
    <div style="display:flex;align-items:center;gap:8px">
      <div style="display:flex;border:1px solid var(--border);border-radius:6px;overflow:hidden">
        <button onclick="setStaffSort('asc')" style="padding:5px 12px;font-size:11px;font-family:var(--mono);font-weight:600;cursor:pointer;border:none;transition:all .15s;background:${staffSortOrder==='asc'?'var(--accent-dim)':'transparent'};color:${staffSortOrder==='asc'?'var(--accent)':'var(--text-dim)'}">A ->Z</button>
        <button onclick="setStaffSort('desc')" style="padding:5px 12px;font-size:11px;font-family:var(--mono);font-weight:600;cursor:pointer;border:none;border-left:1px solid var(--border);transition:all .15s;background:${staffSortOrder==='desc'?'var(--accent-dim)':'transparent'};color:${staffSortOrder==='desc'?'var(--accent)':'var(--text-dim)'}">Z ->A</button>
      </div>
      <button class="btn btn-primary" onclick="openAddStaff()">Onboard New Employee</button>
    </div>
  </div>
  <div class="staff-list-head"><div class="col-head">ID</div><div class="col-head">Employee</div><div class="col-head">Type</div><div class="col-head">Max Hrs</div><div class="col-head">Scheduled</div><div class="col-head">Utilisation</div><div class="col-head">Actions</div></div>`;
  const sortedStaff=[...staff].sort((a,b)=>{
    const cmp=a.first.localeCompare(b.first)||a.last.localeCompare(b.last);
    return staffSortOrder==='asc'?cmp:-cmp;
  });
  let _rowNo=0;
  sortedStaff.forEach(s=>{
    _rowNo++;
    const hrs=staffHoursWeek(s.id),pct=Math.min(100,Math.round((hrs/s.maxHours)*100));
    const isAdmin=!!s.isHubAdmin;
    const isTeamLead=!isAdmin && !!s.isTeamLead;  // admin always wins; never both
    const roleBadge = isAdmin
      ? ` <span style="background:rgba(61,158,255,.2);color:var(--accent2);border:1px solid rgba(61,158,255,.4);border-radius:3px;padding:1px 5px;font-size:8px;font-weight:700;font-family:var(--mono)">ADMIN</span>`
      : (isTeamLead ? ` <span style="background:var(--accent-dim);color:var(--accent-text);border:1px solid var(--accent-border);border-radius:3px;padding:1px 5px;font-size:8px;font-weight:700;font-family:var(--mono)">TEAM LEAD</span>` : '');
    html+=`<div class="staff-list-row" data-team="${(s.team||'').replace(/"/g,'&quot;')}">
      <div class="emp-id">${_rowNo}</div>
      <div style="display:flex;align-items:center;gap:11px;cursor:pointer" onclick="openEmpProfile(${s.id})" title="Open profile"><div class="avatar" style="background:${s.color}">${initials(s)}</div><div><div class="emp-name">${s.first} ${s.last}${roleBadge}</div><div class="emp-team">${s.team||'No team'}</div></div></div>
      <div><span class="badge ${tb[s.type]}">${tl[s.type]}</span></div>
      <div style="font-family:var(--mono);font-size:12.5px">${s.maxHours}h</div>
      <div style="font-family:var(--mono);font-size:12.5px;color:${pct>100?'var(--warn)':'inherit'}">${hrs.toFixed(1)}h</div>
      <div style="display:flex;align-items:center;gap:7px"><div class="hours-bar-bg" style="width:58px"><div class="hours-bar-fill${pct>100?' warn':''}" style="width:${pct}%"></div></div><span style="font-family:var(--mono);font-size:9.5px;color:var(--text-dim)">${pct}%</span></div>
      <div style="display:flex;gap:6px;align-items:center;position:relative">
        <button class="btn btn-ghost" style="padding:5px 11px;font-size:10.5px" onclick="openEmpProfile(${s.id})">Profile</button>
        <button class="btn btn-warn" style="padding:5px 11px;font-size:10.5px" onclick="removeStaff(${s.id})">Remove</button>
      </div>
    </div>`;
  });
  el.innerHTML=html;
  try{ if(typeof applyTeamLeadLock==='function' && document.body.classList.contains('tl-readonly')) applyTeamLeadLock(); }catch(e){}
}




// Close menus when clicking outside
document.addEventListener('click',function(e){
  if(!e.target.closest('[id^="staffmenu-"]')&&!e.target.title?.includes('More')){
    document.querySelectorAll('[id^="staffmenu-"]').forEach(m=>m.style.display='none');
  }
});

function setStaffSort(order){staffSortOrder=order;renderStaffList();}

// ── ROLE VIEW ─────────────────────────────────────────────────────────────
function renderRoleView(){
  try{ _syncWeekLeavesToSubmissions(); }catch(e){}
  const teams=getUniqueTeams();
  const bar=document.getElementById('roleFilterBar');
  const content=document.getElementById('roleViewContent');
  let barHtml='';
  barHtml+=`<div class="role-pill${activeRoleFilter===null?' active':''}" onclick="setRoleFilter(null)">All Teams</div>`;
  teams.forEach(t=>{const enc=t.replace(/\\/g,'\\\\').replace(/'/g,"\\'");barHtml+=`<div class="role-pill${activeRoleFilter===t?' active':''}" onclick="setRoleFilter('${enc}')">${t}</div>`;});
  bar.innerHTML=barHtml;

  const showTeams=activeRoleFilter?[activeRoleFilter]:teams;
  let html='';
  showTeams.forEach(team=>{
    // Managers first, then workers
    const teamStaff=staff.filter(s=>s.team===team&&!s.isOfficeManager&&s.isManager!=='office').sort((a,b)=>a.first.localeCompare(b.first)||a.last.localeCompare(b.last));
    if(!teamStaff.length)return;
    const totalS=teamStaff.reduce((a,s)=>{let c=0;for(let d=0;d<7;d++)c+=((shifts[s.id]||{})[d]||[]).length;return a+c;},0);

    html+=`<div class="role-view-card" data-team="${(team||'').replace(/"/g,'&quot;')}"><div class="role-view-header">
      <div style="display:flex;align-items:center;gap:10px">
        <div class="role-view-title">${team}</div>
        <span class="pro-count">${teamStaff.length} staff</span>
      </div>
      <div class="role-view-count">${totalS} shifts this week</div>
    </div>`;

    // Column headers
    html+=`<div class="role-staff-row pro-hd-row"><div class="role-staff-name">Staff</div>`;
    for(let d=0;d<7;d++){const day=addDays(currentWeekStart,d);html+=`<div class="role-shift-cell"><b>${DAYS[d]}</b><span>${fmtDate(day)}</span></div>`;}
    html+='</div>';

    teamStaff.forEach(s=>{
      const ismgr=s.isManager;
      html+=`<div class="role-staff-row" style="${ismgr?'background:var(--accent-dim);':''}">
        <div class="role-staff-name">
          <div class="avail-dot" style="background:${s.color}"></div>
          <div style="min-width:0">
            <button type="button" class="name-link" style="font-size:12px;font-weight:${ismgr?700:500};white-space:nowrap;overflow:hidden;text-overflow:ellipsis" onclick="event.stopPropagation();openEmpProfile(${s.id})" title="Open ${s.first}'s profile" aria-label="Open ${s.first} ${s.last}'s profile">${s.first} ${s.last}</button>
            <div class="pro-sub">${s.team||'No team'}</div>
          </div>
        </div>`;
      for(let d=0;d<7;d++){
        const ds=(shifts[s.id]||{})[d]||[];
        const conflict=getAvail(s.id,d).type==='no'&&ds.some(sh=>sh.type!=='leave');
        html+=`<div class="role-shift-cell${conflict?' shift-conflict':''}">`;
        if(!ds.length)html+=`<span class="pro-empty">—</span>`;
        else ds.forEach((sh,i)=>{const il=sh.type==='leave';html+=`<div class="shift-badge ${il?'shift-leave':'shift-slot'}" style="font-size:8.5px;cursor:pointer" onclick="editShift(${s.id},${d},${i})">${il?'LEAVE':`${sh.start}–${sh.end}${sh._team?' · for '+sh._team:''}`}</div>`;});
        html+='</div>';
      }
      html+='</div>';
    });
    html+='</div>';
  });
  if(!html)html=`<div style="padding:40px;text-align:center;color:var(--text-dim);font-family:var(--mono);font-size:12px">No staff found.</div>`;
  content.innerHTML=html;
}
function setRoleFilter(role){activeRoleFilter=role;renderRoleView();}

// ── MODALS ────────────────────────────────────────────────────────────────
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}

function openAddShift(staffId,dayIdx){
  editingShift=null;
  document.getElementById('shiftModalTitle').textContent='Assign Shift';
  document.getElementById('shiftDeleteBtn').style.display='none';
  populateStaffSelect('shiftStaff',staffId);
  document.getElementById('shiftDay').value=dayIdx!==undefined?dayIdx:0;
  document.getElementById('shiftStart').value='09:00';
  document.getElementById('shiftEnd').value='19:00';
  document.getElementById('shiftType').value='shift';
  document.getElementById('shiftRole').value='';
  _shiftTeamFill(staffId,'');
  onShiftTypeChange(document.getElementById('shiftType'));
  renderShiftPickupBox(null);   // new shift: nothing to open for pickup yet
  openModal('shiftModal');
}
/* ── Shift pickup: manager controls ───────────────────────────────────────
   Opening a shift makes it claimable by the owner's team. The claim itself
   is atomic server-side (claim_shift), so two people tapping at once can't
   both win — this side only decides what becomes available.
   ──────────────────────────────────────────────────────────────────────── */



function renderShiftPickupBox(sh){
  const box=document.getElementById('shiftPickupBox');
  if(!box) return;
  const openBtn=document.getElementById('shiftOpenBtn');
  const unopenBtn=document.getElementById('shiftUnopenBtn');
  const state=document.getElementById('shiftPickupState');
  const note=document.getElementById('shiftPickupNote');

  // Only DB-backed, non-leave shifts can be opened for pickup.
  if(!sh || !sh._dbId || sh.type==='leave'){
    box.style.display='none';
    return;
  }
  box.style.display='';
  const st=sh._status||'assigned';
  if(st==='open'){
    state.textContent='Open for pickup';
    state.style.color='var(--warn)';
    note.textContent=sh._openTeam?('Visible to '+sh._openTeam):'Visible to the team';
    openBtn.style.display='none';
    unopenBtn.style.display='';
  }else if(st==='pending_release'){
    state.textContent='Release requested';
    state.style.color='var(--warn)';
    note.textContent=(sh._releaseBy||'Staff')+' asked to give this up';
    openBtn.style.display='';
    openBtn.textContent='Approve & open to team';
    unopenBtn.style.display='';
    unopenBtn.textContent='Decline request';
  }else{
    state.textContent='Assigned';
    state.style.color='var(--text-dim)';
    note.textContent='';
    openBtn.style.display='';
    openBtn.textContent='Open to team';
    unopenBtn.style.display='none';
  }
}

function _editingShiftBlock(){
  if(!editingShift) return null;
  const{staffId,dayIdx,shiftIdx}=editingShift;
  return (shifts[staffId]&&shifts[staffId][dayIdx])?shifts[staffId][dayIdx][shiftIdx]:null;
}

async function openShiftToTeam(){
  const sh=_editingShiftBlock();
  if(!sh||!sh._dbId){ showToast('Save the shift first'); return; }
  const who=_nameForStaffId(editingShift.staffId);
  // Open to EVERYONE: open_to_team stays null, which Nexus treats as
  // "anyone can claim". Keeping the column means we can still scope a shift
  // to one team later without a schema change.
  try{
    const r=await fetch(SUPABASE_URL+'/rest/v1/rpc/approve_shift_release',{
      method:'POST',headers:_DB_H,
      body:JSON.stringify({p_shift_id:sh._dbId,
        p_manager:(typeof currentUser!=='undefined'&&currentUser)?currentUser:'Manager',
        p_team:null})
    });
    if(!r.ok) throw new Error('HTTP '+r.status);
    const res=await r.json();
    if(!res||res.ok!==true){
      showToast('Could not open shift'+(res&&res.reason?(' — '+res.reason):''));
      return;
    }
    sh._status='open'; sh._openTeam=res.open_to_team||null;
    renderShiftPickupBox(sh);
    closeModal('shiftModal');
    renderAll();
    showToast('Shift opened for pickup');
    notifyShiftOpen(who, res);
  }catch(e){
    console.warn('openShiftToTeam',e);
    showToast('Could not open shift — check connection');
  }
}

async function cancelShiftOpening(){
  const sh=_editingShiftBlock();
  if(!sh||!sh._dbId) return;
  try{
    const r=await fetch(SUPABASE_URL+'/rest/v1/rpc/cancel_shift_open',{
      method:'POST',headers:_DB_H,
      body:JSON.stringify({p_shift_id:sh._dbId,
        p_actor:(typeof currentUser!=='undefined'&&currentUser)?currentUser:'Manager',
        p_note:null})
    });
    if(!r.ok) throw new Error('HTTP '+r.status);
    const res=await r.json();
    if(!res||res.ok!==true){ showToast('Could not cancel'+(res&&res.reason?(' — '+res.reason):'')); return; }
    sh._status='assigned'; sh._openTeam=null; sh._releaseBy=null;
    renderShiftPickupBox(sh);
    closeModal('shiftModal');
    renderAll();
    showToast('Shift is assigned again');
  }catch(e){
    console.warn('cancelShiftOpening',e);
    showToast('Could not cancel — check connection');
  }
}

/**
 * Tell the people most likely to take a shift that one is going: the owner's
 * OWN TEAM, and only those not on full-time hours — a full-timer already at
 * 38 can't pick it up without overtime, so mailing them is noise.
 *
 * Anyone can still claim it in Nexus; this narrows who gets *told*, not who
 * is allowed. It also keeps the send well inside the Gmail daily quota.
 * Best-effort throughout: a mail failure must never make an open shift look
 * un-opened.
 */
async function notifyShiftOpen(fromStaff, info){
  if(!MAIL_EXEC_URL || MAIL_EXEC_URL.indexOf('http')!==0) return;
  try{
    // The shift's team = the team of whoever is giving it up.
    let team='';
    try{
      const tr=await fetch(SUPABASE_URL+'/rest/v1/staff_credentials?staff_name=eq.'+encodeURIComponent(fromStaff)+'&select=team',
        {headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY}});
      if(tr.ok){ const t=await tr.json(); team=(t&&t[0]&&t[0].team)||''; }
    }catch(e){}
    if(!team){ console.warn('[NOTIFY] no team for '+fromStaff+' — no email sent'); return; }

    const [credRes, cfgRes] = await Promise.all([
      fetch(SUPABASE_URL+'/rest/v1/staff_credentials?team=eq.'+encodeURIComponent(team)+'&select=staff_name,email',
        {headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY}}),
      fetch(SUPABASE_URL+'/rest/v1/staff_roster_config?select=staff_name,employment_type',
        {headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY}})
    ]);
    if(!credRes.ok) return;
    const creds=await credRes.json();

    // Small teams don't get a broadcast — you'd just ask them directly.
    if((creds||[]).length<=MIN_TEAM_FOR_EMAIL){
      console.log('[NOTIFY] team "'+team+'" has '+(creds||[]).length+' members '+
                  '(threshold is >'+MIN_TEAM_FOR_EMAIL+') — no email sent');
      showToast('Shift opened — '+team+' is small, so no email sent');
      return;
    }

    const cfg=cfgRes.ok?await cfgRes.json():[];
    const typeByName={};
    (cfg||[]).forEach(function(c){ typeByName[c.staff_name]=(c.employment_type||'full'); });

    let to=(creds||[])
      .filter(function(x){
        if(!x.email || x.email.indexOf('@')<1) return false;   // no address
        if(x.staff_name===fromStaff) return false;             // don't mail the releaser
        const t=typeByName[x.staff_name]||'full';
        return t!=='full';                                     // part-time / casual only
      })
      .map(function(x){ return {name:x.staff_name, email:x.email}; });

    // Optional override for testing.
    if(SHIFT_MAIL_TEST_ONLY){
      to=to.filter(function(x){ return x.name===SHIFT_MAIL_TEST_ONLY; });
    }
    if(!to.length){
      console.warn('[NOTIFY] nobody to email for team "'+team+'" — no part-time/casual staff with an address. '+
                   'Set employment type in Staff → edit → Type.');
      showToast('Shift opened, but no part-time staff in '+team+' to notify');
      return;
    }
    console.log('[NOTIFY] emailing '+to.length+' part-time/casual in '+team+':', to.map(function(x){return x.name;}).join(', '));
    // Read the relay's reply rather than discarding it. Without this a
    // rejected send ("unknown action" from an un-redeployed relay, "bad
    // token", "quota") is indistinguishable from success — which is exactly
    // how a missing email turns into a guessing game.
    fetch(MAIL_EXEC_URL,{
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({
        action:'sendShiftOpen',
        recipients:to,
        team:team,
        shiftDate:info.shift_date,
        startTime:String(info.start_time||'').slice(0,5),
        endTime:String(info.end_time||'').slice(0,5),
        fromStaff:fromStaff
      })
    }).then(function(resp){
      return resp.text().then(function(txt){
        console.log('[PILOT] relay replied ('+resp.status+'):', txt);
        let j=null; try{ j=JSON.parse(txt); }catch(e){}
        if(j && j.ok===true){
          showToast('Notified '+(j.sent||to.length)+' teammate'+((j.sent||to.length)===1?'':'s'));
        }else if(j && j.error==='unknown action'){
          showToast('Relay is out of date — redeploy it as a NEW version');
        }else if(j && j.error==='quota'){
          showToast('Email quota reached ('+j.remaining+' left, needed '+j.needed+')');
        }else if(j && j.error){
          showToast('Email not sent: '+j.error);
        }
      });
    }).catch(function(err){
      // A blocked cross-origin read still means the POST was delivered, so
      // this is informational, not a failure.
      console.log('[PILOT] relay response unreadable (send may still have worked):', err);
    });
  }catch(e){ console.warn('notifyShiftOpen',e); }
}

function onShiftTypeChange(sel){
  const isLeave=sel.value==='leave';
  const timeRow=document.getElementById('shiftTimeRow');
  timeRow.style.opacity=isLeave?'0.35':'1';
  timeRow.querySelectorAll('input').forEach(i=>i.disabled=isLeave);
  document.getElementById('shiftRole').closest('.form-group').style.opacity=isLeave?'0.35':'1';
  document.getElementById('shiftRole').disabled=isLeave;
  var _tg=document.getElementById('shiftTeamGroup'); if(_tg) _tg.style.display=isLeave?'none':'';
}
function deleteCurrentShift(){
  if(!editingShift)return;
  const{staffId,dayIdx,shiftIdx}=editingShift;
  const block=(shifts[staffId]&&shifts[staffId][dayIdx])?shifts[staffId][dayIdx][shiftIdx]:null;

  // If deleting a LEAVE block, it must be removed from the SOURCE
  // (leave_submissions) — otherwise the render re-derives it from the request
  // and it comes straight back. Find the matching approved submission for this
  // person on this calendar day and delete it (DB + local list).
  if(block && block.type==='leave'){
    const s=staff.find(x=>x.id===staffId);
    if(s){
      const theDay=new Date(currentWeekStart); theDay.setDate(theDay.getDate()+dayIdx); theDay.setHours(0,0,0,0);
      const nm=(s.first+' '+s.last).trim().toLowerCase();
      const matches=(leaveRequests||[]).filter(function(r){
        if((r.staffName||r.staff_name||'').trim().toLowerCase()!==nm) return false;
        const fromStr=r.from||r.from_date||'', toStr=r.to||r.to_date||'';
        if(!fromStr||!toStr) return false;
        const fromD=new Date(fromStr+'T00:00:00'), toD=new Date(toStr+'T00:00:00');
        return theDay>=fromD && theDay<=toD;
      });
      matches.forEach(function(r){
        // delete from Supabase source
        if(r.supabaseId){
          fetch(`${SUPABASE_URL}/rest/v1/leave_submissions?id=eq.${r.supabaseId}`,{
            method:'DELETE',
            headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`}
          }).catch(e=>console.warn('leave delete failed',e));
        }
        // A leave spanning multiple days: deleting the whole request removes it
        // from every day. That's the correct behaviour for a single-day request;
        // for a multi-day one, removing one day means splitting — which this
        // simple model treats as deleting the whole leave. (Rare; acceptable.)
      });
      const ids=matches.map(function(r){return r.id;});
      leaveRequests=leaveRequests.filter(function(r){return ids.indexOf(r.id)===-1;});
      if(typeof renderLeave==='function') renderLeave();
      if(typeof renderLeaveSummary==='function') renderLeaveSummary();
    }
  }

  // Remove from the DB before dropping it from memory — once it's spliced out
  // we've lost the _dbId and the row would be orphaned in roster_shifts.
  if(block && block.type!=='leave' && block._dbId) dbDeleteShift(block);

  shifts[staffId][dayIdx].splice(shiftIdx,1);
  closeModal('shiftModal');markDirty();renderAll();
  showToast(block&&block.type==='leave'?'Leave removed':'Shift deleted');
}
function populateStaffSelect(elId,selectedId){
  document.getElementById(elId).innerHTML=staff.map(s=>`<option value="${s.id}"${s.id==selectedId?' selected':''}>${s.first} ${s.last}</option>`).join('');
}
/* ── roster_shifts writes ─────────────────────────────────────────────────
   Deliberately per-mutation rather than a whole-week reconciler. A reconciler
   would also have to decide what to DELETE, and if the in-memory grid were
   ever empty (failed load, race during init) it would happily delete a real
   roster — the same failure mode that wiped ShiftOps before. These fail the
   other way: if something isn't wired up yet, the edit simply doesn't persist.
   Leave blocks are never written here; leave lives in leave_submissions.
   ──────────────────────────────────────────────────────────────────────── */
function _shiftDateFor(dayIdx){
  return _isoDate(addDays(new Date(currentWeekStart), dayIdx));
}
function _nameForStaffId(id){
  const s=(staff||[]).find(function(x){return x.id===id;});
  return s ? ((s.first||'').trim()+' '+(s.last||'').trim()).trim() : '';
}
const _DB_H={apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY,'Content-Type':'application/json'};

/* Bulk create. Auto-allocate can produce ~200 shifts in one press; firing
   that many individual POSTs is slow and, on failure, buries the screen in
   toasts. Collect them and write once. */
let _shiftQueue=[];
function queueShift(staffId, dayIdx, sh){
  const name=_nameForStaffId(staffId);
  if(!name || !sh || sh.type==='leave') return;
  _shiftQueue.push({ _sid:staffId, _day:dayIdx, _blk:sh,
    staff_name:name, shift_date:_shiftDateFor(dayIdx),
    start_time:sh.start, end_time:sh.end, role:sh.role||null, status:'assigned',
    created_by:(typeof currentUser!=='undefined'&&currentUser)?currentUser:null,
    updated_by:(typeof currentUser!=='undefined'&&currentUser)?currentUser:null });
}
async function flushShiftQueue(){
  if(!_shiftQueue.length) return 0;
  const batch=_shiftQueue.slice();
  _shiftQueue=[];
  const payload=batch.map(function(r){
    const o=Object.assign({},r); delete o._sid; delete o._day; delete o._blk; return o;
  });
  try{
    const r=await fetch(SUPABASE_URL+'/rest/v1/roster_shifts'+
      '?on_conflict=staff_name,shift_date,start_time,end_time',{
      method:'POST',
      headers:Object.assign({Prefer:'resolution=merge-duplicates,return=representation'},_DB_H),
      body:JSON.stringify(payload)
    });
    if(!r.ok){
      const t=await r.text().catch(function(){return '';});
      console.error('[ALLOC] bulk insert HTTP '+r.status, t);
      showToast('Shifts not saved ('+r.status+')');
      return 0;
    }
    const saved=await r.json().catch(function(){return [];});
    // Tag the in-memory blocks with their new ids so edit/delete work without
    // a reload.
    (saved||[]).forEach(function(row){
      const m=batch.find(function(b){
        return b.staff_name===row.staff_name && b.shift_date===row.shift_date &&
               String(b.start_time).slice(0,5)===String(row.start_time).slice(0,5);
      });
      if(m && m._blk){ m._blk._dbId=row.id; m._blk._status=row.status; }
    });
    showToast(saved.length+' shift'+(saved.length===1?'':'s')+' saved');
    return saved.length;
  }catch(e){
    console.warn('flushShiftQueue',e);
    showToast('Shifts not saved — check connection');
    return 0;
  }
}

async function dbCreateShift(staffId, dayIdx, sh){
  const name=_nameForStaffId(staffId);
  if(!name) return null;
  try{
    const r=await fetch(SUPABASE_URL+'/rest/v1/roster_shifts',{
      method:'POST',
      headers:Object.assign({Prefer:'return=representation'},_DB_H),
      body:JSON.stringify({
        staff_name:name, shift_date:_shiftDateFor(dayIdx),
        start_time:sh.start, end_time:sh.end,
        role:sh.role||null, works_for_team:sh._team||null,
        created_by:(typeof currentUser!=='undefined'&&currentUser)?currentUser:null,
        updated_by:(typeof currentUser!=='undefined'&&currentUser)?currentUser:null
      })
    });
    if(!r.ok){
      // 409 = the uniqueness constraint caught an exact duplicate.
      if(r.status===409){ showToast('That exact shift already exists'); return null; }
      throw new Error('HTTP '+r.status);
    }
    const rows=await r.json();
    if(rows&&rows[0]){ sh._dbId=rows[0].id; sh._status=rows[0].status; _rcnWarn(name); return rows[0].id; }
  }catch(e){
    console.warn('dbCreateShift',e);
    showToast('Shift not saved to server — check connection');
  }
  return null;
}

async function dbUpdateShift(sh, staffId, dayIdx){
  if(!sh||!sh._dbId) return false;
  const name=_nameForStaffId(staffId);
  try{
    const body={start_time:sh.start,end_time:sh.end,role:sh.role||null,works_for_team:sh._team||null,
                updated_by:(typeof currentUser!=='undefined'&&currentUser)?currentUser:null};
    if(name) body.staff_name=name;
    if(dayIdx!==undefined && dayIdx!==null) body.shift_date=_shiftDateFor(dayIdx);
    const r=await fetch(SUPABASE_URL+'/rest/v1/roster_shifts?id=eq.'+encodeURIComponent(sh._dbId),
      {method:'PATCH',headers:_DB_H,body:JSON.stringify(body)});
    if(!r.ok) throw new Error('HTTP '+r.status);
    _rcnWarn(name);
    return true;
  }catch(e){
    console.warn('dbUpdateShift',e);
    showToast('Change not saved to server — check connection');
    return false;
  }
}

async function dbDeleteShift(sh){
  if(!sh||!sh._dbId) return false;
  try{
    const r=await fetch(SUPABASE_URL+'/rest/v1/roster_shifts?id=eq.'+encodeURIComponent(sh._dbId),
      {method:'DELETE',headers:_DB_H});
    if(!r.ok) throw new Error('HTTP '+r.status);
    _rcnWarn('Staff');
    return true;
  }catch(e){
    console.warn('dbDeleteShift',e);
    showToast('Delete not saved to server — check connection');
    return false;
  }
}

function saveShift(){
  const staffId=parseInt(document.getElementById('shiftStaff').value);
  const day=parseInt(document.getElementById('shiftDay').value);
  const type=document.getElementById('shiftType').value;
  const role=document.getElementById('shiftRole').value;
  const deviceIdRaw=document.getElementById('shiftDevice').value;
  const deviceId=deviceIdRaw?parseInt(deviceIdRaw):null;
  const isLeave=type==='leave';
  const start=isLeave?'':document.getElementById('shiftStart').value;
  const end=isLeave?'':document.getElementById('shiftEnd').value;
  if(!isLeave&&(!start||!end||start>=end)){showToast('End time must be after start time');return;}
  if(!shifts[staffId])shifts[staffId]={};
  if(!shifts[staffId][day])shifts[staffId][day]=[];
  const sh={start,end,type,role:isLeave?'Leave':role};
  if(!isLeave){
    var _tv=(document.getElementById('shiftTeam')||{}).value||'';
    var _st=(staff||[]).find(function(x){return x.id===staffId;});
    if(_tv && _st && _st.team===_tv) _tv='';
    if(_tv) sh._team=_tv;
  }
  if(deviceId)sh.deviceId=deviceId;
  let _wasEdit=false, _prev=null;
  if(editingShift&&editingShift.staffId===staffId&&editingShift.dayIdx===day){
    _prev=shifts[staffId][day][editingShift.shiftIdx];
    // Carry the DB identity across an edit, or the update would orphan the row.
    if(_prev&&_prev._dbId){ sh._dbId=_prev._dbId; sh._status=_prev._status; sh._openTeam=_prev._openTeam; sh._releaseBy=_prev._releaseBy; _wasEdit=true; }
    shifts[staffId][day][editingShift.shiftIdx]=sh;
  }
  else shifts[staffId][day].push(sh);

  // Persist to roster_shifts. Leave is never stored here — it stays in
  // leave_submissions and is painted live.
  if(!isLeave){
    if(_wasEdit) dbUpdateShift(sh, staffId, day);
    else         dbCreateShift(staffId, day, sh);
  }

  // Check device conflicts on this day
  if(deviceId){
    const conflicts=[];
    staff.forEach(s=>{
      if(s.id===staffId)return;
      const ds=(shifts[s.id]||{})[day]||[];
      if(ds.some(x=>x.deviceId===deviceId)){
        const d=devices.find(x=>x.id===deviceId);
        conflicts.push(`${s.first} ${s.last}`);
      }
    });
    if(conflicts.length){
      const dname=devices.find(x=>x.id===deviceId)?.name||'Device';
      showToast(` ${dname} also assigned to: ${conflicts.join(', ')} on this day!`);
      markDirty();renderAll();return;
    }
  }

  closeModal('shiftModal');markDirty();renderAll();showToast(isLeave?' Leave marked':' Shift saved');
}

function onRoleChange(sel){
  const teamGroup=document.getElementById('staffTeam').closest('.form-group');
  teamGroup.style.opacity=sel.value==='office'?'0.4':'1';
  teamGroup.querySelector('select').disabled=sel.value==='office';
}

function openAddStaff(){
  try{ if(typeof _epReturnForm==='function') _epReturnForm(); }catch(e){}  // form may be mounted in a profile
  editingStaffId=null;
  document.getElementById('staffModalTitle').textContent='Add Employee';
  const _pp=document.getElementById('empProfilePanel');
  if(_pp){ _pp.style.display='none'; _pp.innerHTML=''; }
  const adminSec0=document.getElementById('staffAdminSection');
  if(adminSec0) adminSec0.style.display='none';
  ['staffFirstName','staffLastName','staffBirthday','staffPronouns','staffEmail'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  populateTeamSelect(null);
  document.getElementById('staffIsManager').value='false';
  document.getElementById('staffType').value='full';
  document.getElementById('staffMaxHours').value='38';
  onRoleChange(document.getElementById('staffIsManager'));
  const opt=document.querySelector('#staffIsManager option[value="office"]');
  if(opt)opt.textContent='Office Manager';
  openModal('staffModal');
}
