// ── Download the Staff Availability weekly grid as a PDF ──
// Exports what the grid shows right now: the team pill that is selected, every row that is
// visible (a team lead only gets their own team), and cells exactly as drawn (hours, Off, Not set).
function _av2Text(av,day){
  const t=av&&av.type;
  if(t==='all') return _av2Fmt('09:00')+' – '+_av2Fmt(day>=5?'16:00':'19:00');
  if(t==='custom'&&av.start&&av.end) return _av2Fmt(av.start)+' – '+_av2Fmt(av.end);
  if(t==='no') return 'Off';
  return 'Not set';
}
function downloadAvailabilityGrid(){
  if(typeof window.jspdf==='undefined' || !window.jspdf || !window.jspdf.jsPDF){
    showToast('PDF library not loaded — check connection');return;
  }
  const DAYS_SHORT=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const cards=Array.from(document.querySelectorAll('#availGrid .av2-card'));
  const groups=[];
  cards.forEach(card=>{
    const team=card.getAttribute('data-team')||'Unassigned';
    const members=[];
    card.querySelectorAll('.avail-row[data-avail-staff]').forEach(row=>{
      if(row.getAttribute('data-tl-hide')==='1') return;
      const s=staff.find(x=>String(x.id)===row.getAttribute('data-avail-staff'));
      if(s) members.push(s);
    });
    if(members.length) groups.push({team,members});
  });
  if(!groups.length){showToast('Nothing on the grid to download');return;}

  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  const pageW=doc.internal.pageSize.getWidth(), pageH=doc.internal.pageSize.getHeight();
  const weekLabel=fmtDate(currentWeekStart)+' – '+fmtDate(addDays(currentWeekStart,6));
  const title='Staff Availability'+(_availTeamFilter?(' — '+_availTeamFilter):'');
  doc.setFontSize(15);doc.setFont(undefined,'bold');doc.text(title,14,15);
  doc.setFontSize(9);doc.setFont(undefined,'normal');
  doc.text('Week of '+weekLabel+'  ·  Generated '+new Date().toLocaleString('en-AU',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}),14,21);

  const head=['Staff',...DAYS_SHORT.map((n,d)=>n+'\n'+fmtDate(addDays(currentWeekStart,d)))];
  let cursorY=28;
  groups.forEach(g=>{
    const perDay=[0,0,0,0,0,0,0];
    const body=g.members.slice().sort((a,b)=>a.first.localeCompare(b.first)||a.last.localeCompare(b.last)).map(m=>{
      const cells=[];
      for(let d=0;d<7;d++){
        const av=getAvail(m.id,d);
        if(av&&(av.type==='all'||av.type==='custom')) perDay[d]++;
        cells.push(_av2Text(av,d));
      }
      return [m.first+' '+m.last,...cells];
    });
    body.push(['Available',...perDay.map(n=>n+' / '+g.members.length)]);

    if(cursorY>pageH-45){ doc.addPage(); cursorY=18; }
    doc.setFontSize(11);doc.setFont(undefined,'bold');doc.setTextColor(0,150,120);
    doc.text(g.team+'  ('+g.members.length+')',14,cursorY);doc.setTextColor(0,0,0);
    cursorY+=3;
    doc.autoTable({
      startY:cursorY,head:[head],body:body,
      styles:{fontSize:8,cellPadding:2,halign:'center',valign:'middle'},
      headStyles:{fillColor:[0,150,120],textColor:255,fontStyle:'bold'},
      columnStyles:{0:{halign:'left',fontStyle:'bold',cellWidth:38}},
      alternateRowStyles:{fillColor:[245,247,250]},
      margin:{left:14,right:14,bottom:12},
      didParseCell:function(data){
        if(data.section!=='body') return;
        const t=String(data.cell.raw);
        if(data.row.index===body.length-1){ data.cell.styles.fontStyle='bold'; data.cell.styles.fillColor=[232,240,238]; return; }
        if(data.column.index===0) return;
        if(t==='Off') data.cell.styles.textColor=[200,40,40];
        else if(t==='Not set') data.cell.styles.textColor=[150,150,150];
        else data.cell.styles.textColor=[0,120,95];
      }
    });
    cursorY=doc.lastAutoTable.finalY+10;
  });
  const pages=doc.internal.getNumberOfPages();
  for(let i=1;i<=pages;i++){ doc.setPage(i); doc.setFontSize(7);doc.setTextColor(120,120,120);doc.text('Oscar Roster — Confidential, Internal Use Only',14,pageH-6);doc.text('Page '+i+' of '+pages,pageW-14,pageH-6,{align:'right'}); }
  const fname='Oscar-Availability-'+weekLabel.replace(/[^a-zA-Z0-9]/g,'-')+(_availTeamFilter?('-'+String(_availTeamFilter).replace(/[^\w\-]+/g,'')):'')+'.pdf';
  doc.save(fname);
  showToast('Availability PDF downloaded');
}

function cycleAvail(staffId,day){
  const av=getAvail(staffId,day);
  // A weekend day showing our 9–16 window is the weekend 'Available' state, so
  // it should cycle to 'no' next (same as a weekday 'all'), keeping Off reachable.
  const isWeekendAll = (day===5||day===6) && av.type==='custom' && av.start==='09:00' && av.end==='16:00';
  // Cycle: unset -> all -> no -> unset.
  // Custom is not part of the forward cycle (it's set via the Custom button),
  // but a day that IS custom must be able to leave it — otherwise clicking a
  // custom chip had no exit and the day was stuck on custom forever. Treating
  // custom like 'no' here sends the next click to unset, rejoining the loop.
  if(av.type==='unset')setAvail(staffId,day,{type:'all'});
  else if(av.type==='all' || isWeekendAll)setAvail(staffId,day,{type:'no'});
  else setAvail(staffId,day,{type:'unset'});   // covers 'no' AND 'custom'
  renderAvailability();renderRoster();
}

// ── Availability edit gate ──
// Chips are locked by default so a stray click can't change anyone's pattern.
// "Set Availability" enters edit mode (chips clickable, edits buffered);
// "Save" writes only the changed people to the DB; "Cancel" discards.
let _availEditMode = false;
window._availEditMode = false;
let _availSnapshot = null;

function enterAvailEdit(){
  // Deep-snapshot current availability so Cancel can restore it exactly.
  _availSnapshot = JSON.parse(JSON.stringify(availability||{}));
  _availEditedIds = new Set();
  _availEditMode = true; window._availEditMode = true;
  document.body.classList.add('avail-editing');
  const setB=document.getElementById('availSetBtn');
  const saveB=document.getElementById('availSaveBtn');
  const canB=document.getElementById('availCancelBtn');
  if(setB)setB.style.display='none';
  if(saveB)saveB.style.display='flex';
  if(canB)canB.style.display='inline-flex';
}

async function saveAvailEdit(){
  const saveB=document.getElementById('availSaveBtn');
  if(saveB)saveB.disabled=true;
  try{
    // Push each edited person's full weekly pattern to the source of truth.
    const ids=Array.from(_availEditedIds);
    for(const id of ids){
      try{ pushAvailToSource(id); }catch(e){ console.warn('push failed', id, e); }
    }
    // pushAvailToSource is debounced; flush now so Save is immediate.
    if(typeof _flushAvailPush==='function'){ try{ await _flushAvailPush(); }catch(e){} }
    showToast(ids.length? ('Saved '+ids.length+' change'+(ids.length>1?'s':'')) : 'No changes to save');
    _exitAvailEdit();
  }catch(e){
    console.warn(e);
    showToast('Save failed — changes kept, try again');
    if(saveB)saveB.disabled=false;
  }
}

function cancelAvailEdit(){
  // Restore the snapshot exactly, discarding buffered edits.
  if(_availSnapshot){ availability = JSON.parse(JSON.stringify(_availSnapshot)); }
  _exitAvailEdit();
  renderAvailability(); renderRoster();
  showToast('Changes discarded');
}

function _exitAvailEdit(){
  _availEditMode=false; window._availEditMode=false;
  _availSnapshot=null; _availEditedIds=new Set();
  document.body.classList.remove('avail-editing');
  const setB=document.getElementById('availSetBtn');
  const saveB=document.getElementById('availSaveBtn');
  const canB=document.getElementById('availCancelBtn');
  if(setB)setB.style.display='flex';
  if(saveB){saveB.style.display='none';saveB.disabled=false;}
  if(canB)canB.style.display='none';
}

function openCustomAvail(staffId,day){
  editingAvail={staffId,day};
  const av=getAvail(staffId,day);
  const s=staff.find(x=>x.id===staffId);
  document.getElementById('availTimeStaffLabel').textContent=`${s?s.first+' '+s.last:''} — ${DAYS_FULL[day]}`;
  document.getElementById('availTimeStart').value=av.start||'09:00';
  document.getElementById('availTimeEnd').value=av.end||'17:00';
  openModal('availTimeModal');
}

function saveCustomAvail(){
  const start=document.getElementById('availTimeStart').value;
  const end=document.getElementById('availTimeEnd').value;
  if(!start||!end||start>=end){showToast('End time must be after start time');return;}
  setAvail(editingAvail.staffId,editingAvail.day,{type:'custom',start,end});
  closeModal('availTimeModal');
  renderAvailability();renderRoster();
}

