// ═══ TEAM LEAD READ-ONLY ENFORCEMENT ═══
// A team lead = has ShiftOps access AND is NOT a hub admin. They may browse
// every tab but cannot edit, and see only their own team. Identity comes from
// so_me (the verified signed-in name) matched against the loaded staff array —
// never from the URL or client-settable state.
let AM_TEAM_LEAD=false;
let MY_TEAM=null;
let _tlResolved=false;   // once we know the signed-in user's role, latch it
function computeTeamLeadState(){
  // Authoritative answer first. At launch (and on every staff reload) the server was asked is_current_user_hub_admin with
  // the person's own session, after has_app_access had already let them in. "In ShiftOps but not a hub admin" is a team
  // lead, full stop. This does not depend on the staff_settings / app_access reads or on the name matching, so a blocked,
  // empty or mismatched read can no longer leave a lead sitting on the admin view. Only an explicit '0' counts: '1' (admin)
  // and '' (server did not answer) fall through to the careful logic below, so an admin is never demoted by a failed call.
  var _v=''; try{ _v=sessionStorage.getItem('so_is_admin')||''; }catch(e){}
  if(_v==='0'){
    var _m=''; try{ _m=(sessionStorage.getItem('so_me')||'').trim().toLowerCase(); }catch(e){}
    var _r=_m?(staff||[]).find(function(s){ return ((s.first||'')+' '+(s.last||'')).trim().toLowerCase()===_m; }):null;
    AM_TEAM_LEAD=true; _tlResolved=true;
    var _t=(_r&&_r.team)||((typeof _meProfile!=='undefined'&&_meProfile&&_meProfile.team)||null);
    if(_t) MY_TEAM=_t;
    return;
  }
  // Never set or change a role from failed, partial or anonymous data: wait for a pass where the role fetches succeeded
  // with a live session and real rows (see _roleDataOk in loadStaffFromSupabase).
  if(!_roleDataOk) return;

  let me='';
  try{ me=(sessionStorage.getItem('so_me')||'').trim(); }catch(e){}
  if(!me) return;
  const meRec=(staff||[]).find(function(s){
    return ((s.first||'')+' '+(s.last||'')).trim().toLowerCase()===me.toLowerCase();
  });
  if(!meRec) return;                 // staff not loaded yet, try again next render
  // A confirmed hub admin always wins, even if an earlier pass had latched Team Lead from bad data.
  if(meRec.isHubAdmin){ AM_TEAM_LEAD=false; MY_TEAM=null; _tlResolved=true; return; }
  // Latched: keep a confirmed team lead (the blob load strips isTeamLead before the Supabase rebuild restores it).
  if(_tlResolved) return;
  if(meRec.isTeamLead){ AM_TEAM_LEAD=true; MY_TEAM=meRec.team||null; _tlResolved=true; return; }
  // meRec exists but flags not populated yet: don't latch, don't downgrade.
}
function applyTeamLeadLock(){
  computeTeamLeadState();
  // Only ever show the read-only team-lead view once the role is POSITIVELY
  // resolved AND confirmed team-lead. Until then (data still loading, or an
  // admin whose flags haven't arrived), default to the full admin view rather
  // than flashing the locked view — which is the "first login shows Team Lead"
  // bug. An admin should never briefly see the restricted UI.
  const confirmedLead = _tlResolved && AM_TEAM_LEAD === true;
  document.body.classList.toggle('tl-readonly', confirmedLead);
  if(!confirmedLead) return;

  // Hide any staff-list / roster / team-view / availability row that isn't the
  // team lead's own team. We tag rows by scanning their visible team label.
  const mine=(MY_TEAM||'').trim().toLowerCase();

  // Staff list rows: tagged with data-team at render — reliable exact match.
  document.querySelectorAll('#staffList .staff-list-row').forEach(function(row){
    const rowTeam=(row.getAttribute('data-team')||'').trim().toLowerCase();
    row.setAttribute('data-tl-hide', (rowTeam===mine)?'0':'1');
  });

  // Roster: header block + each member row tagged with data-team at render.
  document.querySelectorAll('#rosterGrid [data-team]').forEach(function(node){
    const t=(node.getAttribute('data-team')||'').trim().toLowerCase();
    node.setAttribute('data-tl-hide', (t===mine)?'0':'1');
  });

  // Team View cards tagged with data-team.
  document.querySelectorAll('#subsection-teamview [data-team], .role-view-card[data-team]').forEach(function(node){
    const t=(node.getAttribute('data-team')||'').trim().toLowerCase();
    node.setAttribute('data-tl-hide', (t===mine)?'0':'1');
  });

  // Availability rows: member rows tagged with data-team at render; the header
  // row has no data-team so it always stays visible.
  document.querySelectorAll('#availGrid .avail-row[data-team]').forEach(function(row){
    const t=(row.getAttribute('data-team')||'').trim().toLowerCase();
    row.setAttribute('data-tl-hide', (t===mine)?'0':'1');
  });

  // Submitted Availability cards tagged with data-team at render.
  document.querySelectorAll('#submittedAvailContent [data-team]').forEach(function(card){
    const t=(card.getAttribute('data-team')||'').trim().toLowerCase();
    card.setAttribute('data-tl-hide', (t===mine)?'0':'1');
  });
}

document.querySelectorAll('.modal-overlay').forEach(o=>{o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('open');});});


document.addEventListener('keydown',e=>{
  if(e.key==='Escape')document.querySelectorAll('.modal-overlay.open').forEach(o=>o.classList.remove('open'));
  if((e.metaKey||e.ctrlKey)&&e.key==='s'){e.preventDefault();saveData();}
});





// ── DEVICES ───────────────────────────────────────────────────────────────
// Devices are just a name list; assignment is per-shift (stored as deviceId on each shift)

function populateShiftDeviceSelect(selectedDeviceId){
  const sel=document.getElementById('shiftDevice');
  sel.innerHTML=`<option value="">— No device —</option>`
    +devices.map(d=>`<option value="${d.id}"${d.id===selectedDeviceId?' selected':''}>${d.name}</option>`).join('');
}


function refreshDevMgmtList(){
  const list=document.getElementById('devMgmtList');
  if(!list)return;
  if(!devices.length){list.innerHTML=`<div style="color:var(--text-dim);font-size:12px;padding:8px 0">No devices yet.</div>`;return;}
  list.innerHTML=devices.map(d=>`
    <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--bg);border:1px solid var(--border);border-radius:6px">
      <span style="font-size:14px"></span>
      <span style="flex:1;font-size:12.5px;font-weight:600">${d.name}</span>
      <button onclick="removeDeviceFromPanel(${d.id})" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:15px;padding:0 4px">×</button>
    </div>`).join('');
}


function removeDeviceFromPanel(id){
  devices=devices.filter(d=>d.id!==id);
  // Clear this device from any shifts
  staff.forEach(s=>{
    if(!shifts[s.id])return;
    for(let d=0;d<7;d++){
      if(shifts[s.id][d])shifts[s.id][d].forEach(sh=>{if(sh.deviceId===id)delete sh.deviceId;});
    }
  });
  markDirty();refreshDevMgmtList();renderAll();showToast('Device removed');
}

function getDeviceConflicts(){
  // Returns map of deviceId -> [{staffId, day}] for days where same device assigned to 2+ people
  const usage={}; // deviceId -> [{staffId,day}]
  staff.forEach(s=>{
    if(!shifts[s.id])return;
    for(let d=0;d<7;d++){
      const ds=(shifts[s.id][d]||[]);
      ds.forEach(sh=>{
        if(sh.deviceId){
          if(!usage[sh.deviceId])usage[sh.deviceId]=[];
          usage[sh.deviceId].push({staffId:s.id,day:d});
        }
      });
    }
  });
  const conflicts={};
  Object.entries(usage).forEach(([did,entries])=>{
    const byDay={};
    entries.forEach(e=>{if(!byDay[e.day])byDay[e.day]=[];byDay[e.day].push(e.staffId);});
    Object.entries(byDay).forEach(([day,sids])=>{if(sids.length>1)conflicts[`${did}-${day}`]={deviceId:parseInt(did),day:parseInt(day),staffIds:sids};});
  });
  return conflicts;
}


async function pickSharedFolder(){
  if(!window.shiftops)return;
  // Ask if they want to migrate existing data
  const migrate=confirm('Copy your current data to the shared folder?\n\nClick OK to bring your existing roster with you, or Cancel to start fresh in the shared folder.');
  const res=await window.shiftops.setSharedFolder(migrate);
  if(res.canceled)return;
  if(!res.ok){showToast('Could not set folder: '+(res.error||''));return;}
  // Reload data from new location
  document.getElementById('sharedFolderPath').textContent=res.folder+'/shiftops-data.json';
  document.getElementById('sharedFolderPath').style.color='var(--accent)';
  document.getElementById('sharedFolderClearBtn').style.display='';
  showToast('Shared folder set — saving here from now on');
  closeModal('sharedFolderModal');
  await loadData();renderAll();
}

async function clearSharedFolder(){
  if(!window.shiftops)return;
  await window.shiftops.clearSharedFolder();
  showToast('Reverted to local storage');
  closeModal('sharedFolderModal');
}



function applyDeviceAllocation(){
  let applied=0;
  document.querySelectorAll('#deviceAllocList [data-dev-sid]').forEach(sel=>{
    const sid=parseInt(sel.dataset.devSid);
    const did=sel.value?parseInt(sel.value):null;
    const startEl=document.querySelector(`[data-dev-start="${sid}"]`);
    const endEl=document.querySelector(`[data-dev-end="${sid}"]`);
    const devStart=startEl?startEl.value:'';
    const devEnd=endEl?endEl.value:'';
    if(!shifts[sid])return;
    for(let d=0;d<7;d++){
      if(shifts[sid][d])shifts[sid][d].forEach(sh=>{
        delete sh.deviceId;delete sh.deviceStart;delete sh.deviceEnd;
      });
    }
    if(did){
      for(let d=0;d<7;d++){
        if(shifts[sid][d])shifts[sid][d].forEach(sh=>{
          if(sh.type!=='leave'){
            sh.deviceId=did;
            if(devStart)sh.deviceStart=devStart;
            if(devEnd)sh.deviceEnd=devEnd;
            applied++;
          }
        });
      }
    }
  });

  const conflicts=getDeviceConflicts();
  const conflictCount=Object.keys(conflicts).length;
  closeModal('deviceAllocModal');
  markDirty();renderAll();
  if(conflictCount>0)showToast(` Devices applied ·  ${conflictCount} day conflict${conflictCount>1?'s':''} detected`);
  else showToast(` Devices applied to ${applied} shift${applied!==1?'s':''}`);
}

