// ── AUTO-ALLOCATE ─────────────────────────────────────────────────────────
function openAutoAllocate(){
  document.getElementById('allocDays').innerHTML=DAYS_FULL.map((d,i)=>`<div class="day-toggle${i<5?' on':''}" data-day="${i}" onclick="this.classList.toggle('on')">${d.slice(0,3)}</div>`).join('');
  let staffListHtml='';

  // Office managers first
  const officeManagers=staff.filter(s=>s.isOfficeManager||s.isManager==='office');
  if(officeManagers.length){
    staffListHtml+=`<div style="font-family:var(--mono);font-size:8.5px;color:#ffd700;letter-spacing:1.5px;text-transform:uppercase;padding:4px 2px;margin-top:4px">Office</div>`;
    officeManagers.forEach(s=>{
      staffListHtml+=`<label style="display:flex;align-items:center;gap:9px;padding:7px 9px;background:var(--bg);border-radius:6px;cursor:pointer;border:1px solid rgba(255,215,0,.25)">
        <input type="checkbox" checked data-sid="${s.id}" style="accent-color:var(--accent);width:14px;height:14px;flex-shrink:0">
        <div class="avatar" style="background:#ffd700;color:#3a2a00;width:22px;height:22px;font-size:8.5px;flex-shrink:0">${initials(s)}</div>
        <span style="font-size:12.5px;font-weight:600;color:#ffd700">${s.first} ${s.last}</span>
        <span style="font-family:var(--mono);font-size:9px;color:var(--text-dim);margin-left:auto">Office Mgr</span>
      </label>`;
    });
  }

  // Then team staff
  const sortedTeams=[...new Set(staff.filter(s=>!s.isOfficeManager&&s.isManager!=='office').map(s=>s.team))].sort();
  sortedTeams.forEach(team=>{
    const teamMembers=staff.filter(s=>s.team===team&&!s.isOfficeManager&&s.isManager!=='office').sort((a,b)=>a.first.localeCompare(b.first)||a.last.localeCompare(b.last));
    staffListHtml+=`<div style="font-family:var(--mono);font-size:8.5px;color:var(--accent);letter-spacing:1.5px;text-transform:uppercase;padding:4px 2px;margin-top:4px">${team}</div>`;
    teamMembers.forEach(s=>{
      staffListHtml+=`<label style="display:flex;align-items:center;gap:9px;padding:7px 9px;background:var(--bg);border-radius:6px;cursor:pointer;border:1px solid var(--border)">
        <input type="checkbox" checked data-sid="${s.id}" style="accent-color:var(--accent);width:14px;height:14px;flex-shrink:0">
        <div class="avatar" style="background:${s.color};width:22px;height:22px;font-size:8.5px;flex-shrink:0">${initials(s)}</div>
        <span style="font-size:12.5px;font-weight:600">${s.first} ${s.last}</span>
        <span style="font-family:var(--mono);font-size:9px;color:var(--text-dim);margin-left:auto">${s.type}</span>
      </label>`;
    });
  });

  document.getElementById('allocStaffList').innerHTML=staffListHtml;
  openModal('allocModal');
}

function toggleTypeFilter(el){
  el.classList.toggle('on');
  const type=el.dataset.type;
  const on=el.classList.contains('on');
  document.querySelectorAll('#allocStaffList input[type=checkbox]').forEach(cb=>{
    const sid=parseInt(cb.dataset.sid);
    const s=staff.find(x=>x.id===sid);
    if(s&&s.type===type)cb.checked=on;
  });
}


function setAllocAll(checked){
  document.querySelectorAll('#allocStaffList input[type=checkbox]').forEach(cb=>cb.checked=checked);
}

function runAutoAllocate(){
  const activeDays=[...document.querySelectorAll('#allocDays .day-toggle.on')].map(el=>parseInt(el.dataset.day));
  const startTime=document.getElementById('allocStart').value||'09:00';
  const endTime=document.getElementById('allocEnd').value||'19:00';
  const overwrite=document.getElementById('allocOverwrite').value==='yes';
  const selectedIds=new Set([...document.querySelectorAll('#allocStaffList input[type=checkbox]:checked')].map(el=>parseInt(el.dataset.sid)));

  if(!activeDays.length){showToast('Select at least one working day');return;}
  if(!startTime||!endTime||startTime>=endTime){showToast('Invalid shift times');return;}

  const startHr=parseInt(startTime.split(':')[0]);
  const shiftType=startHr<12?'morning':startHr<17?'afternoon':'evening';

  let allocated=0;
  let skipped=0;
  staff.filter(s=>selectedIds.has(s.id)).forEach(s=>{
    if(!shifts[s.id])shifts[s.id]={};

    // Only roster on explicitly available days — skip unavailable AND unset
    const availDays=activeDays.filter(d=>getAvail(s.id,d).type!=='no'&&getAvail(s.id,d).type!=='unset');
    const skippedDays=activeDays.filter(d=>getAvail(s.id,d).type==='no'||getAvail(s.id,d).type==='unset');
    skipped+=skippedDays.length;

    // Sort: custom hours first, then all-day available (unset excluded above)
    const ranked=[
      ...availDays.filter(d=>getAvail(s.id,d).type==='custom'),
      ...availDays.filter(d=>getAvail(s.id,d).type==='all'),
    ];

    ranked.forEach(d=>{
      const hasLeave=shifts[s.id][d]&&shifts[s.id][d].some(sh=>sh.type==='leave');
      if(hasLeave){skipped++;return;} // never overwrite leave
      const hasShift=shifts[s.id][d]&&shifts[s.id][d].length>0;
      if(overwrite||!hasShift){
        // Use custom hours if set, otherwise use the rostering menu times
        const av=getAvail(s.id,d);
        const shStart=av.type==='custom'?av.start:startTime;
        const shEnd=av.type==='custom'?av.end:endTime;
        const shType=parseInt(shStart.split(':')[0])<12?'morning':parseInt(shStart.split(':')[0])<17?'afternoon':'evening';
        const _blk={start:shStart,end:shEnd,type:shType,role:staffRoleLabel(s)};
        shifts[s.id][d]=[_blk];
        // Persist. Auto-allocate only ever filled the in-memory grid, so the
        // roster looked complete and then came back empty on reload — the
        // shifts were never in roster_shifts at all.
        if(shType!=='leave') queueShift(s.id, d, _blk);
        allocated++;
      }
    });
  });

  closeModal('allocModal');
  markDirty();renderAll();
  // One bulk write for everything the allocator just placed.
  flushShiftQueue().then(function(n){ if(n) loadWeekShiftsFromDB(currentWeekStart); });
  const msg=skipped>0?` ${allocated} shifts allocated · ${skipped} skipped (unavailable)`:` Allocated ${allocated} shifts`;
  showToast(msg);
}

function rosterByAvailability(){
  const startTime=document.getElementById('allocStart').value||'09:00';
  const endTime=document.getElementById('allocEnd').value||'19:00';
  const overwrite=document.getElementById('allocOverwrite').value==='yes';
  const selectedIds=new Set([...document.querySelectorAll('#allocStaffList input[type=checkbox]:checked')].map(el=>parseInt(el.dataset.sid)));

  if(!startTime||!endTime||startTime>=endTime){showToast('Invalid shift times');return;}

  let allocated=0;
  let skipped=0;

  staff.filter(s=>selectedIds.has(s.id)).forEach(s=>{
    if(!shifts[s.id])shifts[s.id]={};

    // Go through ALL 7 days based purely on availability
    for(let d=0;d<7;d++){
      const av=getAvail(s.id,d);

      // Skip unavailable AND unset days — only roster staff who explicitly set availability
      if(av.type==='no'||av.type==='unset'){skipped++;continue;}

      // Never overwrite an approved leave block
      const hasLeave=shifts[s.id][d]&&shifts[s.id][d].some(sh=>sh.type==='leave');
      if(hasLeave){skipped++;continue;}

      const hasShift=shifts[s.id][d]&&shifts[s.id][d].length>0;
      if(overwrite||!hasShift){
        // Use custom hours if staff specified them, otherwise default times
        const shStart=av.type==='custom'?av.start:startTime;
        const shEnd=av.type==='custom'?av.end:endTime;
        const shType=parseInt(shStart.split(':')[0])<12?'morning':parseInt(shStart.split(':')[0])<17?'afternoon':'evening';
        const _blk={start:shStart,end:shEnd,type:shType,role:staffRoleLabel(s)};
        shifts[s.id][d]=[_blk];
        // Persist. Auto-allocate only ever filled the in-memory grid, so the
        // roster looked complete and then came back empty on reload — the
        // shifts were never in roster_shifts at all.
        if(shType!=='leave') queueShift(s.id, d, _blk);
        allocated++;
      }
    }
  });

  closeModal('allocModal');
  markDirty();renderAll();
  // One bulk write for everything the allocator just placed.
  flushShiftQueue().then(function(n){ if(n) loadWeekShiftsFromDB(currentWeekStart); });

  if(allocated===0&&skipped===0){
    showToast('No availability found — ask staff to submit via the web form');
  } else {
    const msg=skipped>0
      ?` ${allocated} shifts rostered · ${skipped} days skipped (unavailable)`
      :` ${allocated} shifts rostered from availability`;
    showToast(msg);
  }
}

async function clearWeek(){
  const existing=document.getElementById('clearWeekConfirm');
  if(existing){ dismissClearWeek(); return; }

  // Say what's actually at stake. "Clear all shifts" gives no sense of scale;
  // "47 shifts" is the difference between a considered click and a reflex one.
  let n=0;
  try{
    Object.keys(shifts||{}).forEach(function(sid){
      Object.keys(shifts[sid]||{}).forEach(function(d){
        (shifts[sid][d]||[]).forEach(function(sh){ if(sh.type!=='leave') n++; });
      });
    });
  }catch(e){}
  if(!n){ showToast('Nothing rostered this week'); return; }

  const wk=new Date(currentWeekStart);
  const end=addDays(new Date(currentWeekStart),6);
  const fmt=function(d){ return d.toLocaleDateString('en-AU',{day:'numeric',month:'short'}); };

  const el=document.createElement('div');
  el.id='clearWeekConfirm';
  el.className='cw-confirm';
  el.innerHTML=
    '<div class="cw-ico"><svg viewBox="0 0 20 20" fill="currentColor" width="17" height="17">'+
      '<path fill-rule="evenodd" d="M8.257 3.1c.765-1.36 2.72-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg></div>'+
    '<div class="cw-txt">'+
      '<div class="cw-title">Delete '+n+' shift'+(n===1?'':'s')+'?</div>'+
      '<div class="cw-sub">Week of '+fmt(wk)+' – '+fmt(end)+' · this removes them from the roster for everyone</div>'+
    '</div>'+
    '<button class="cw-btn cw-go" onclick="doClearWeek(this)">Delete</button>'+
    '<button class="cw-btn cw-no" onclick="dismissClearWeek()">Cancel</button>';
  document.body.appendChild(el);
  requestAnimationFrame(function(){ el.classList.add('cw-in'); });
  el._t=setTimeout(dismissClearWeek, 12000);
}

function dismissClearWeek(){
  const el=document.getElementById('clearWeekConfirm');
  if(!el) return;
  clearTimeout(el._t);
  el.classList.remove('cw-in');
  el.classList.add('cw-out');
  setTimeout(function(){ if(el.parentNode) el.remove(); }, 200);
}

/**
 * Actually clear the week — from roster_shifts, not just the grid.
 *
 * This only emptied the in-memory `shifts` object, so the week looked cleared
 * and every shift returned on the next load. The roster lives in the database
 * now; clearing has to happen there.
 */
async function doClearWeek(btn){
  if(btn){ btn.disabled=true; btn.textContent='Deleting…'; }
  const from=_isoDate(currentWeekStart);
  const to=_isoDate(addDays(new Date(currentWeekStart),6));
  try{
    const r=await fetch(SUPABASE_URL+'/rest/v1/roster_shifts'+
      '?shift_date=gte.'+from+'&shift_date=lte.'+to,
      {method:'DELETE',headers:Object.assign({Prefer:'return=representation'},_DB_H)});
    if(!r.ok){
      const t=await r.text().catch(function(){return '';});
      console.error('[CLEAR-WEEK] HTTP '+r.status, t);
      showToast('Could not clear ('+r.status+')');
      if(btn){ btn.disabled=false; btn.textContent='Delete'; }
      return;
    }
    const gone=await r.json().catch(function(){return [];});

    // Fade the grid out as it empties, so the change is seen rather than just
    // appearing — a week vanishing instantly reads like a glitch.
    const grid=document.getElementById('rosterGrid');
    if(grid){ grid.classList.add('grid-clearing'); }
    staff.forEach(function(s){ shifts[s.id]={}; });
    dismissClearWeek();
    setTimeout(function(){
      markDirty(); renderAll();
      if(grid) grid.classList.remove('grid-clearing');
      showToast((gone.length||0)+' shift'+((gone.length||0)===1?'':'s')+' deleted');
      loadWeekShiftsFromDB(currentWeekStart);
    }, 190);
  }catch(e){
    console.warn('doClearWeek',e);
    showToast('Could not clear — check connection');
    if(btn){ btn.disabled=false; btn.textContent='Delete'; }
  }
}

// ── EXPORT PDF ────────────────────────────────────────────────────────────
function openExportModal(){
  openModal('exportModal');
}

function doExportPDF(){
  const val=document.getElementById('exportDaySelect').value;
  const dayFilter=val==='week'?null:parseInt(val);
  closeModal('exportModal');
  exportPDF(dayFilter);
}

async function exportPDF(dayFilter=null){
  // Ensure the PDF reflects leaves derived from leave_submissions (same as the
  // on-screen grid) — not stale in-memory blocks. Without this the export can
  // show phantom leaves for people who have no request.
  try{ _syncWeekLeavesToSubmissions(); }catch(e){}
  const isSingleDay=dayFilter!==null;
  const singleDayName=isSingleDay?DAYS_FULL[dayFilter]:'';
  const singleDate=isSingleDay?fmtDate(addDays(currentWeekStart,dayFilter)):'';
  const weekLabel=isSingleDay?`${singleDayName} — ${singleDate}`:`${fmtDate(currentWeekStart)} – ${fmtDate(addDays(currentWeekStart,6))}`;
  const daysToShow=isSingleDay?[dayFilter]:[0,1,2,3,4,5,6];
  const pdfFilename=`Oscar-Roster-${weekLabel.replace(/[^a-zA-Z0-9]/g,'-')}.pdf`;

  // Build a cell's text from a staff member's shifts that day
  function cellText(s,d){
    const ds=(shifts[s.id]||{})[d]||[];
    if(!ds.length) return '—';
    return ds.map(sh=>{
      if(sh.type==='leave') return 'LEAVE';
      let t=sh.start+'–'+sh.end;
      if(sh._team) t+='\nFOR '+String(sh._team).toUpperCase();   // worked for another team (ASCII only: the PDF font has no arrow)
      if(sh.deviceId){
        const dev=devices.find(x=>x.id===sh.deviceId);
        if(dev){ t+='\n'+dev.name+((sh.deviceStart&&sh.deviceEnd)?(' '+sh.deviceStart+'–'+sh.deviceEnd):''); }
      }
      return t;
    }).join('\n');
  }
  function cellKind(s,d){
    const ds=(shifts[s.id]||{})[d]||[];
    if(!ds.length) return 'empty';
    if(ds.some(sh=>sh.type==='leave')) return 'leave';
    if(ds.some(sh=>sh._team)) return 'xteam';
    return 'work';
  }

  // Assemble body rows: team banner rows + staff rows. Track styling per row/cell.
  const sortedTeams=[...new Set(staff.map(s=>s.team))].sort();
  const body=[];               // array of {cells:[...], banner?:team, leaveCols:[...], emptyCols:[...]}
  let totalHrs=0;

  // Office managers first
  let om=staff.filter(s=>s.isOfficeManager||s.isManager==='office');
  if(isSingleDay)om=om.filter(s=>((shifts[s.id]||{})[dayFilter]||[]).length>0);
  if(om.length){
    body.push({banner:'Office'});
    om.forEach(s=>{
      const hrs=isSingleDay?staffHoursDay(s.id,dayFilter):staffHoursWeek(s.id);
      totalHrs+=hrs;
      const cells=[`${s.first} ${s.last}\nOffice Manager · ${hrs.toFixed(1)}h`];
      const kinds=['name'];
      daysToShow.forEach(d=>{cells.push(cellText(s,d));kinds.push(cellKind(s,d));});
      body.push({cells,kinds});
    });
  }

  sortedTeams.forEach(team=>{
    let teamStaff=staff.filter(s=>s.team===team&&!s.isOfficeManager&&s.isManager!=='office').sort((a,b)=>a.first.localeCompare(b.first)||a.last.localeCompare(b.last));
    if(isSingleDay)teamStaff=teamStaff.filter(s=>((shifts[s.id]||{})[dayFilter]||[]).length>0);
    if(!teamStaff.length)return;
    body.push({banner:team});
    teamStaff.forEach(s=>{
      const hrs=isSingleDay?staffHoursDay(s.id,dayFilter):staffHoursWeek(s.id);
      totalHrs+=hrs;
      const cells=[`${s.first} ${s.last}\n${staffRoleLabel(s)} · ${hrs.toFixed(1)}h`];
      const kinds=['name'];
      daysToShow.forEach(d=>{cells.push(cellText(s,d));kinds.push(cellKind(s,d));});
      body.push({cells,kinds});
    });
  });

  if(typeof window.jspdf==='undefined' || !window.jspdf || !window.jspdf.jsPDF){
    showToast('PDF library not loaded — check connection');
    return;
  }
  showToast('⏳ Generating PDF…');
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:isSingleDay?'portrait':'landscape',unit:'mm',format:'a4'});
  const pageW=doc.internal.pageSize.getWidth();

  // header text
  const headLabels=['STAFF',...daysToShow.map(d=>DAYS_FULL[d].slice(0,3).toUpperCase()+'  '+fmtDate(addDays(currentWeekStart,d)))];

  // column widths
  const nameW=isSingleDay?60:34;
  const dayW=(pageW-10-nameW)/daysToShow.length;
  const colStyles={0:{cellWidth:nameW,halign:'left',fontStyle:'bold'}};
  for(let i=1;i<=daysToShow.length;i++) colStyles[i]={cellWidth:dayW,halign:'left'};

  doc.autoTable({
    head:[headLabels],
    body:body.map(r=>r.banner?[{content:r.banner.toUpperCase(),colSpan:daysToShow.length+1}]:r.cells),
    startY:18,
    margin:{left:5,right:5,top:14,bottom:10},
    theme:'grid',
    styles:{fontSize:6.5,cellPadding:1.3,overflow:'linebreak',valign:'top',lineColor:[230,230,230],lineWidth:0.1,textColor:[17,17,17]},
    headStyles:{fillColor:[13,27,42],textColor:[255,255,255],fontSize:6.5,fontStyle:'bold',cellPadding:1.5},
    columnStyles:colStyles,
    didParseCell:function(data){
      const row=body[data.row.index];
      if(!row) return;
      if(row.banner){
        data.cell.styles.fillColor=[13,27,42];
        data.cell.styles.textColor=[255,255,255];
        data.cell.styles.fontStyle='bold';
        data.cell.styles.fontSize=7;
        data.cell.styles.cellPadding=1.6;
        return;
      }
      if(data.section!=='body') return;
      const kind=row.kinds&&row.kinds[data.column.index];
      if(kind==='work'){ data.cell.styles.fillColor=[232,245,233]; data.cell.styles.textColor=[27,94,32]; }
      else if(kind==='xteam'){ data.cell.styles.fillColor=[255,224,160]; data.cell.styles.textColor=[120,53,15]; data.cell.styles.fontStyle='bold'; }
      else if(kind==='leave'){ data.cell.styles.fillColor=[255,235,238]; data.cell.styles.textColor=[198,40,40]; data.cell.styles.fontStyle='bold'; data.cell.styles.halign='center'; }
      else if(kind==='empty'){ data.cell.styles.textColor=[200,200,200]; data.cell.styles.halign='center'; }
      else if(kind==='name'){ data.cell.styles.fontStyle='bold'; data.cell.styles.fontSize=6.8; }
    },
    didDrawPage:function(data){
      doc.setFontSize(13);doc.setTextColor(13,27,42);doc.setFont(undefined,'bold');
      doc.text('Oscar Roster',5,11);
      doc.setFontSize(7);doc.setTextColor(80,80,80);doc.setFont(undefined,'normal');
      const sub=isSingleDay?(singleDayName+' — '+singleDate):('Week of '+weekLabel);
      doc.text(sub,5,15.5);
      const summary=`${staff.length} staff  ·  ${Math.round(totalHrs)}h total  ·  Generated ${new Date().toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric'})}`;
      doc.text(summary,pageW-5,11,{align:'right'});
      doc.setFontSize(6);doc.setTextColor(120,120,120);
      doc.text('Oscar Roster — Confidential, Internal Use Only',5,doc.internal.pageSize.getHeight()-5);
      doc.text('Page '+doc.internal.getNumberOfPages(),pageW-5,doc.internal.pageSize.getHeight()-5,{align:'right'});
    }
  });

  doc.save(pdfFilename);
  showToast('PDF downloaded');
}


