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



// ── ROSTER MAKER ──────────────────────────────────────────────────────────
// Builds a draft for the week that is open, for any week: everyone on the ticked teams is put on every day they are
// available (that week's availability, including a change that starts that week and one-off weeks), within the hours
// they gave. Leave and shifts already on the roster are kept as they are. Nothing reaches staff until the roster is
// published. Hours over a person's max are warned about, not blocked.
// People who are never rostered on a day by the maker (0 = Monday ... 6 = Sunday). Edit here to change.
const ENROL_RULES={ 'Baruna Poudel':{noDays:[4]} };
// Used when someone is "available" without set hours. Weekdays 9 to 7; Saturday and Sunday 9 to 4 (the same window the availability screen uses).
const ENROL_DEFAULT={start:'09:00',end:'19:00'};
const ENROL_WEEKEND={start:'09:00',end:'16:00'};
// Cross-team cover. Monday to Friday only (Saturday and Sunday are not topped up).
//   always:  this person is always on that team's side, on every shift the maker adds
//   helpers: people who step in for a team, in this order, only when it is short that day
//   min:     the number of people each team needs on a weekday
const ENROL_COVER={
  always:{ 'Sagun Pant':'Enrolment' },
  helpers:{ 'Placement':['Kushal Piya'], 'Enrolment':['Presna Aryal','Prabhushan KC'] },   // last resorts, only when the team is still short
  // Evershine keeps 4 people in. Anyone above that on a weekday is lent to Enrolment, taking turns through the week.
  lend:{ from:'Evershine', keep:4, to:'Enrolment', people:['Monica Kawadi','Prashna Sapkota'] },
  min:{ 'Placement':3, 'Enrolment':5 }   // Enrolment: 2 on Checklist + 2 on Front Desk + 1 on Email
};

// Pure planner (no page access) so it can be tested on its own.
//   people: [{id,name,maxHours}]   getAvail(id,day) -> {type:'all'|'custom'|'no'|'unset',start,end}
//   existing(id,day) -> [{type,start,end}]   rules: ENROL_RULES-shaped   overwrite: bool
function enrolPlan(o){
  const mins=function(t){const p=String(t).split(':');return (+p[0])*60+(+p[1]||0);};
  const hrs=function(b){return Math.max(0,(mins(b.end)-mins(b.start))/60);};
  const out={add:[],skipped:[],kept:[],short:[],hours:{},perDay:[0,0,0,0,0,0,0]};
  const cover=o.cover||{};
  o.people.forEach(function(p){
    let h=0;
    for(let d=0;d<7;d++){
      const rule=(o.rules&&o.rules[p.name])||{};
      const have=(o.existing(p.id,d)||[]);
      const leave=have.some(function(b){return b.type==='leave';});
      const real=have.filter(function(b){return b.type!=='leave';});
      if(leave){ out.skipped.push({p:p,d:d,why:'on leave'}); continue; }
      if(rule.noDays&&rule.noDays.indexOf(d)>-1){
        out.skipped.push({p:p,d:d,why:'not rostered on this day'});
        real.forEach(function(b){h+=hrs(b);out.perDay[d]++;});   // a shift already there still counts
        continue;
      }
      const av=o.getAvail(p.id,d)||{type:'unset'};
      if(av.type!=='all'&&av.type!=='custom'){
        out.skipped.push({p:p,d:d,why:av.type==='no'?'not available':'availability not set'});
        real.forEach(function(b){h+=hrs(b);out.perDay[d]++;});
        continue;
      }
      if(real.length&&!o.overwrite){
        out.kept.push({p:p,d:d});
        real.forEach(function(b){h+=hrs(b);}); out.perDay[d]++;
        continue;
      }
      const dflt=d>=5?ENROL_WEEKEND:ENROL_DEFAULT;
      const start=av.type==='custom'?av.start:dflt.start, end=av.type==='custom'?av.end:dflt.end;
      if(!start||!end||mins(start)>=mins(end)){ out.skipped.push({p:p,d:d,why:'availability hours are not valid'}); continue; }
      out.add.push({p:p,d:d,start:start,end:end,replaces:real.length>0,tag:(cover.always&&cover.always[p.name])||''});
      h+=hrs({start:start,end:end}); out.perDay[d]++;
    }
    out.hours[p.id]=h;
  });
  // Who is on which team on a weekday: an existing shift's "works for" tag, a tag the maker is adding, or their own team.
  const teamCount=function(team,d){
    let n=0;
    o.people.forEach(function(p){
      const have=(o.existing(p.id,d)||[]).filter(function(b){return b.type!=='leave';});
      const add=out.add.filter(function(a){return a.p.id===p.id&&a.d===d;})[0];
      if(!have.length&&!add) return;
      const tag=have.length?(have[0]._team||''):(add.tag||'');
      if((tag||p.team)===team) n++;
    });
    return n;
  };
  const teamIn={}; o.people.forEach(function(p){teamIn[p.team]=true;});
  out.lent=[[],[],[],[],[]]; out.lentByHand=[[],[],[],[],[]];
  // Top up the teams that are short on a weekday, Placement first so Kushal goes there before anything else.
  const topUp=function(T){
    const need=cover.min&&cover.min[T]; if(!need||!teamIn[T]) return;
    for(let d=0;d<5;d++){
      let n=teamCount(T,d);
      (cover.helpers&&cover.helpers[T]||[]).forEach(function(name){
        if(n>=need) return;
        const a=out.add.filter(function(x){return x.p.name===name&&x.d===d&&!x.tag;})[0];
        if(a){ a.tag=T; n=teamCount(T,d); }
      });
      if(n<need){
        const ready=(cover.helpers&&cover.helpers[T]||[]).filter(function(name){
          return o.people.some(function(p){return p.name===name&&(o.existing(p.id,d)||[]).some(function(b){return b.type!=='leave'&&!b._team;});});
        });
        out.short.push({team:T,d:d,have:n,need:need,ready:ready});
      }
    }
  };
  topUp('Placement');
  // Lend spare Evershine people to Enrolment (Mon to Fri). Monica and Prashna take turns.
  const L=cover.lend;
  if(L&&teamIn[L.to]){
    const turns={}; L.people.forEach(function(n){turns[n]=0;});
    for(let d=0;d<5;d++){
      const spare=teamCount(L.from,d)-L.keep; if(spare<=0) continue;
      const order=L.people.map(function(n,i){return {n:n,i:i};}).sort(function(a,b){return turns[a.n]-turns[b.n]||a.i-b.i;});
      order.forEach(function(c){
        if(out.lent[d].length>=spare) return;
        const p=o.people.filter(function(x){return x.name===c.n;})[0]; if(!p) return;
        const have=(o.existing(p.id,d)||[]).filter(function(b){return b.type!=='leave';});
        const add=out.add.filter(function(a){return a.p.id===p.id&&a.d===d;})[0];
        if(!have.length&&!add) return;
        if(have.length){ if(have[0]._team&&have[0]._team!==L.from) return; out.lentByHand[d].push(c.n); }
        else{ if(add.tag&&add.tag!==L.from) return; add.tag=L.to; }
        out.lent[d].push(c.n); turns[c.n]++;
      });
    }
  }
  topUp('Enrolment');
  out.over=o.people.filter(function(p){return p.maxHours&&out.hours[p.id]>p.maxHours+0.01;})
                   .map(function(p){return {p:p,h:out.hours[p.id],mx:p.maxHours};});
  return out;
}

// Job roles (Work allocation). Front Desk 2, Checklist 2, Email 1, Follow-up is whoever is left.
// Email only goes to emailOk. lastResort people are used only when nobody else on the team can do Email, and only for Email.
const ENROL_ROLES={ team:'Enrolment', emailOk:['Kushal','Nidhi','Presna','Prabhushan'], lastResort:['Presna','Prabhushan'], front:2, check:2 };
const ENROL_ROLE_KEYS=['C','F','U','E'];
const ENROL_ROLE_NAMES={C:'Checklist',F:'Front Desk',U:'Follow-up',E:'Email'};
// Pure (no page access). o.days: [{pool:[first names], extra:[first names who could be pulled in for Email]}]
//   o.counts: {C:{name:n},...} turns done recently   o.prev: {C:[names],...} the day before   o.lastEmail: {name:order}
function enrolRoles(o){
  const cfg=o.cfg||ENROL_ROLES, cnt={}, prev={}, lastE=Object.assign({},o.lastEmail), out=[];
  ENROL_ROLE_KEYS.forEach(function(k){cnt[k]=Object.assign({},o.counts&&o.counts[k]);prev[k]=((o.prev&&o.prev[k])||[]).slice();});
  o.days.forEach(function(day,i){
    const P=day.pool.slice(), res={C:[],F:[],U:[],E:[],pulled:[]}, prevRole={};
    ENROL_ROLE_KEYS.forEach(function(k){prev[k].forEach(function(n){prevRole[n]=k;});});
    let el=P.filter(function(n){return cfg.emailOk.indexOf(n)>-1;});
    if(!el.length){
      const x=cfg.lastResort.filter(function(n){return (day.extra||[]).indexOf(n)>-1;})[0];
      if(x){ el=[x]; res.pulled.push(x); P.push(x); }
    }
    if(el.length){
      const sc=function(n){return (cnt.E[n]||0)+(prevRole[n]==='E'?5:0);}, lr=function(n){return lastE[n]===undefined?-9:lastE[n];};
      el.sort(function(a,b){return sc(a)-sc(b)||lr(a)-lr(b)||a.localeCompare(b);});
      res.E=[el[0]]; P.splice(P.indexOf(el[0]),1);
    }
    [['F',cfg.front],['C',cfg.check]].forEach(function(rn){
      const k=rn[0], sc=function(n){return (cnt[k][n]||0)*2+(prevRole[n]===k?5:0)+(prevRole[n]==='E'?2:0);};
      P.sort(function(a,b){return sc(a)-sc(b)||a.localeCompare(b);});
      res[k]=P.splice(0,rn[1]);
    });
    res.U=P.slice();
    ENROL_ROLE_KEYS.forEach(function(k){res[k].forEach(function(n){cnt[k][n]=(cnt[k][n]||0)+1;});prev[k]=res[k].slice();});
    res.E.forEach(function(n){lastE[n]=1000+i;});
    out.push(res);
  });
  return out;
}
function enrolRoleText(res){
  const line=function(k){return res[k].length?ENROL_ROLE_NAMES[k]+' - '+res[k].join(' & '):'';};
  return ['C','F','U','E'].map(line).filter(Boolean).join('\n');
}

let _enrolLast=null, _enrolOff={};   // _enrolOff: teams the user has un-ticked
function _enrolAll(){
  return staff.filter(function(s){return !s.isOfficeManager&&s.isManager!=='office';})
              .sort(function(a,b){return a.first.localeCompare(b.first)||a.last.localeCompare(b.last);});
}
function _enrolTeamOf(s){return s.team||'No team';}
function _enrolTeams(){
  const t=[]; _enrolAll().forEach(function(s){const n=_enrolTeamOf(s); if(t.indexOf(n)<0) t.push(n);});
  return t.sort(function(a,b){return a.localeCompare(b);});
}
function _enrolPeople(){return _enrolAll().filter(function(s){return !_enrolOff[_enrolTeamOf(s)];});}
function enrolToggleTeam(t){ _enrolOff[t]=!_enrolOff[t]; _enrolRun(); }
function _enrolEsc(x){return String(x).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function _enrolRun(){
  const overwrite=false;   // shifts already on the roster are never changed or replaced
  const people=_enrolPeople().map(function(s){return {id:s.id,name:s.first+' '+s.last,team:_enrolTeamOf(s),maxHours:Number(s.maxHours)||0};});
  _enrolLast=enrolPlan({people:people,rules:ENROL_RULES,cover:ENROL_COVER,overwrite:overwrite,
    getAvail:function(id,d){return getAvail(id,d);},
    existing:function(id,d){return (shifts[id]&&shifts[id][d])||[];}});
  const r=_enrolLast, f=function(n){return String(Math.round(n*10)/10);};
  const ws=currentWeekStart, we=addDays(ws,6), nm=function(p){return p.name.split(' ')[0];}, nmS=function(n){return String(n).split(' ')[0];};
  let h='<div style="font-size:13px;color:var(--text-dim);margin-bottom:10px">Week of '+fmtDate(ws)+' to '+fmtDate(we)+' · '+people.length+' staff. This is a draft: staff only see it once you publish the roster.</div>';
  h+='<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">'+_enrolTeams().map(function(t){
    return '<label style="display:flex;align-items:center;gap:6px;padding:5px 10px;background:var(--bg);border:1px solid var(--border);border-radius:16px;font-size:12px;cursor:pointer"><input type="checkbox" data-t="'+_enrolEsc(t)+'"'+(_enrolOff[t]?'':' checked')+' onchange="enrolToggleTeam(this.dataset.t)"> '+_enrolEsc(t)+'</label>';}).join('')+'</div>';
  h+='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:14px">'+DAYS_FULL.map(function(dn,i){
    return '<div style="text-align:center;padding:8px 2px;background:var(--bg);border:1px solid var(--border);border-radius:8px"><div style="font-size:10px;color:var(--text-dim)">'+dn.slice(0,3)+'</div><div style="font-size:18px;font-weight:700">'+r.perDay[i]+'</div></div>';}).join('')+'</div>';
  h+='<div class="alloc-section-title">What will be added</div><div style="display:flex;flex-direction:column;gap:4px;margin-bottom:12px;font-size:12.5px">';
  let lastTeam=null;
  people.slice().sort(function(a,b){return a.team.localeCompare(b.team)||a.name.localeCompare(b.name);}).forEach(function(p){
    if(p.team!==lastTeam){ lastTeam=p.team; h+='<div style="font-size:11px;font-weight:700;color:var(--text-dim);margin:8px 0 2px">'+_enrolEsc(p.team)+'</div>'; }
    const mine=r.add.filter(function(a){return a.p.id===p.id;});
    h+='<div style="display:flex;gap:10px;justify-content:space-between;padding:6px 9px;background:var(--bg);border-radius:6px"><b>'+_enrolEsc(p.name)+'</b><span style="color:var(--text-dim);text-align:right">'+
      (mine.length?mine.map(function(a){return DAYS_FULL[a.d].slice(0,3)+' '+a.start+'-'+a.end+(a.tag?' ('+_enrolEsc(a.tag)+')':'');}).join(' · '):'nothing new')+' · '+f(r.hours[p.id])+'h</span></div>';
  });
  h+='</div>';
  const notes=[];
  if(r.over.length) notes.push('<b>'+r.over.length+' of '+people.length+'</b> would be over their max hours this week: '+r.over.map(function(x){return nm(x.p)+' '+f(x.h)+'h';}).join(', ')+'.');
  r.skipped.filter(function(x){return x.why==='on leave'||x.why==='not rostered on this day';}).forEach(function(x){notes.push(_enrolEsc(nm(x.p))+': '+DAYS_FULL[x.d].slice(0,3)+' skipped ('+x.why+').');});
  r.short.forEach(function(x){notes.push('<b>'+_enrolEsc(x.team)+'</b> has only '+x.have+' of '+x.need+' on '+DAYS_FULL[x.d]+'.'+(x.ready.length?' '+_enrolEsc(x.ready.map(nmS).join(', '))+' already '+(x.ready.length===1?'has':'have')+' a shift that day: set it to '+_enrolEsc(x.team)+' by hand.':''));});
  if(r.kept.length) notes.push(r.kept.length+' day'+(r.kept.length===1?'':'s')+' already have a shift and are left as they are.');
  if(notes.length) h+='<div class="alloc-section-title">Worth a look</div><div style="font-size:12.5px;line-height:1.6;margin-bottom:10px">'+notes.join('<br>')+'</div>';
  h+='<div id="enrolRoles" style="margin-top:6px"></div>';
  document.getElementById('enrolBody').innerHTML=h;
  _enrolRoleOut=null; _enrolBtn();
  document.getElementById('enrolErr').textContent='';
  _enrolRolesRun();
}
let _enrolHist={wk:null,rows:null}, _enrolRoleOut=null;
function _enrolBtn(){
  const r=_enrolLast, b=document.getElementById('enrolGo'); if(!r||!b) return;
  const nr=(_enrolRoleOut||[]).filter(function(x){return x.text&&!x.skip;}).length, ns=r.add.length, bits=[];
  if(ns) bits.push(ns+' shift'+(ns===1?'':'s'));
  if(nr) bits.push('job roles for '+nr+' day'+(nr===1?'':'s'));
  b.disabled=!bits.length; b.textContent=bits.length?'Add '+bits.join(' and ')+' as a draft':'Nothing to add';
}
// Who is on Enrolment each weekday: Enrolment staff plus anyone set to work for Enrolment, after the draft is added.
function _enrolPool(d,r){
  const pool=[], extra=[], assumed=[], placeShort={};
  r.short.forEach(function(x){ if(x.team==='Placement'&&x.d===d) x.ready.forEach(function(n){placeShort[n]=true;}); });
  _enrolAll().forEach(function(s){
    const nm=s.first+' '+s.last, all=(shifts[s.id]&&shifts[s.id][d])||[];
    const blocks=all.filter(function(b){return b.type!=='leave';}), leave=all.some(function(b){return b.type==='leave';});
    const add=r.add.filter(function(a){return a.p.id===s.id&&a.d===d;})[0];
    if(leave||(!blocks.length&&!add)) return;
    if(ENROL_ROLES.lastResort.indexOf(s.first)>-1){ extra.push(s.first); return; }
    if(placeShort[nm]){ assumed.push(s.first+' is on Placement'); return; }
    if((r.lent&&r.lent[d]||[]).indexOf(nm)>-1){
      pool.push(s.first);
      if((r.lentByHand&&r.lentByHand[d]||[]).indexOf(nm)>-1) assumed.push(s.first+' is lent from Evershine');
      return;
    }
    const tag=blocks.length?(blocks[0]._team||''):(add?add.tag:'');
    const eff=(ENROL_COVER.always&&ENROL_COVER.always[nm])||tag||s.team;
    if(eff===ENROL_ROLES.team) pool.push(s.first);
  });
  return {pool:pool,extra:extra,assumed:assumed};
}
function _enrolCanon(n){
  const t=String(n||'').trim(); if(!t) return '';
  if(/^prabhu$/i.test(t)) return 'Prabhushan';
  const hit=_enrolAll().filter(function(s){return _waSame(s.first,t);})[0];
  return hit?hit.first:t;
}
async function _enrolRolesRun(){
  const host=document.getElementById('enrolRoles'), r=_enrolLast; if(!host||!r) return;
  host.innerHTML='<div style="font-size:12.5px;color:var(--text-dim)">Working out job roles...</div>';
  try{
    const ws=_isoDate(currentWeekStart);
    if(_enrolHist.wk!==ws){
      _enrolHist.rows=await _waFetch(_isoDate(addDays(new Date(currentWeekStart),-21)),_waDate(6)); _enrolHist.wk=ws;
    }
    if(document.getElementById('enrolRoles')!==host||_enrolLast!==r) return;
    const rows=(_enrolHist.rows||[]).filter(function(x){return x.section==='work';}).sort(function(a,b){return a.alloc_date<b.alloc_date?-1:1;});
    const counts={C:{},F:{},U:{},E:{}}, lastEmail={}; let prev={C:[],F:[],U:[],E:[]}, order=0;
    const mine={};
    rows.forEach(function(x){
      if(x.alloc_date>=ws){ mine[x.alloc_date]=(x.body||'').trim(); return; }
      const day={C:[],F:[],U:[],E:[]}; let any=false;
      _waParse(x.body).forEach(function(l){
        const k=({checklist:'C',frontdesk:'F',followup:'U',email:'E'})[String(l.role).toLowerCase().replace(/[^a-z]/g,'')];
        if(!k) return;
        l.names.forEach(function(n){ const c=_enrolCanon(n); if(!c) return; any=true; day[k].push(c); counts[k][c]=(counts[k][c]||0)+1; if(k==='E') lastEmail[c]=order; });
      });
      if(any){ prev=day; order++; }
    });
    const days=[], info=[];
    for(let d=0;d<5;d++){ const p=_enrolPool(d,r); days.push({pool:p.pool,extra:p.extra}); info.push(p); }
    const res=enrolRoles({days:days,counts:counts,prev:prev,lastEmail:lastEmail});
    _enrolRoleOut=res.map(function(x,d){
      const iso=_waDate(d), have=mine[iso]||'';
      return {d:d,text:days[d].pool.length?enrolRoleText(x):'',skip:!!have,have:have,res:x,info:info[d]};
    });
    let h='<div class="alloc-section-title">Job roles (Work allocation)</div><div style="font-size:12.5px;line-height:1.55">';
    _enrolRoleOut.forEach(function(x){
      h+='<div style="padding:6px 9px;background:var(--bg);border-radius:6px;margin-bottom:4px"><b>'+DAYS_FULL[x.d].slice(0,3)+'</b> ';
      if(x.skip) h+='<span style="color:var(--text-dim)">already has job roles, left alone</span>';
      else if(!x.text) h+='<span style="color:var(--text-dim)">nobody on Enrolment</span>';
      else{
        h+='<span style="color:var(--text-dim)">'+_enrolEsc(x.text).replace(/\n/g,'<br>')+'</span>';
        const nt=[];
        if(x.res.pulled.length) nt.push(_enrolEsc(x.res.pulled.join(', '))+' pulled in for Email only (nobody else on Enrolment can). Set the shift to Enrolment.');
        x.info.assumed.forEach(function(a){nt.push(_enrolEsc(a)+' that day (set the shift by hand).');});
        if(!x.res.E.length) nt.push('Nobody available can do Email.');
        if(nt.length) h+='<div style="font-size:11.5px;color:#b45309;margin-top:2px">'+nt.join('<br>')+'</div>';
      }
      h+='</div>';
    });
    host.innerHTML=h+'</div><div style="font-size:11.5px;color:var(--text-dim);margin-top:4px">These go into the Work allocation card as a draft for the empty days. Check them, then press Save changes there.</div>';
    _enrolBtn();
  }catch(e){ host.innerHTML='<div style="font-size:12.5px;color:#d33">Could not work out job roles: '+_enrolEsc(e&&e.message?e.message:e)+'. The shifts can still be added.</div>'; }
}
async function _enrolWriteRoles(){
  const out=(_enrolRoleOut||[]).filter(function(x){return x.text&&!x.skip;}); if(!out.length) return 0;
  try{ await waSync(true); }catch(e){}
  out.forEach(function(x){ const k=_waKey(_waDate(x.d),'work'); if(!(_wa.rows[k]||'').trim()) _wa.draft[k]=x.text; });
  _wa.msg='Job roles added as a draft for the empty days. Check them, then press Save changes.'; waRender();
  return out.length;
}
function openEnrolmentRoster(){
  if(document.body.classList.contains('tl-readonly')){ showToast('Team leads cannot change the roster'); return; }
  if(!_enrolAll().length){ showToast('No staff found'); return; }
  _enrolRun(); openModal('enrolModal');
}
async function enrolApply(){
  const r=_enrolLast, btn=document.getElementById('enrolGo'), err=document.getElementById('enrolErr');
  const roles=(_enrolRoleOut||[]).some(function(x){return x.text&&!x.skip;});
  if(!r||(!r.add.length&&!roles)) return;
  err.textContent=''; btn.disabled=true;
  try{
    if(r.add.length){
      for(const a of r.add){
        if(!shifts[a.p.id]) shifts[a.p.id]={};
        const blk={_team:a.tag||'',start:a.start,end:a.end,type:parseInt(a.start.split(':')[0])<12?'morning':parseInt(a.start.split(':')[0])<17?'afternoon':'evening',role:(a.tag&&ENROL_COVER.always&&ENROL_COVER.always[a.p.name])?a.tag:staffRoleLabel(staff.find(function(s){return s.id===a.p.id;}))};
        shifts[a.p.id][a.d]=[blk];
        queueShift(a.p.id,a.d,blk);
      }
      markDirty(); renderAll();
      const n=await flushShiftQueue();
      if(!n){ err.textContent='The shifts were not saved. Check your connection and try again.'; btn.disabled=false; try{loadWeekShiftsFromDB(currentWeekStart);}catch(e){} return; }
      loadWeekShiftsFromDB(currentWeekStart);
    }
    closeModal('enrolModal');
    if(roles) await _enrolWriteRoles();
  }catch(e){ err.textContent='Something went wrong: '+(e&&e.message?e.message:e); btn.disabled=false; }
}
