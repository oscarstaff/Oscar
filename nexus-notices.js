/* ── SHIFT-CHANGE NOTICES ─────────────────────────────────────────────────
   When a shift in an already-PUBLISHED week is changed, moved, removed or
   added, the database (trigger on roster_shifts) writes a row to
   roster_change_notices for that person. Here we show it as a popup that stays
   until they tap "Got it", and drop a line in the bell. Reads fail soft: if the
   table is missing or the call fails we simply show nothing. */
let _rcnShown=new Set(), _rcnBusy=false;
function _rcnT(t){ const m=/^(\d{1,2}):(\d{2})/.exec(String(t||'')); if(!m) return ''; let h=+m[1]; const ap=h>=12?'pm':'am'; h=h%12||12; return h+':'+m[2]+' '+ap; }
function _rcnD(d){ try{ return new Date(d+'T00:00:00').toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'}); }catch(e){ return String(d||''); } }
function _rcnEsc(v){ return String(v==null?'':v).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
function _rcnAdd(iso,n){ const d=new Date(iso+'T00:00:00'); d.setDate(d.getDate()+n); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function _rcnHrs(list){ let m=0; (list||[]).forEach(function(x){ const a=/^(\d+):(\d+)/.exec(x.start_time||''), b=/^(\d+):(\d+)/.exec(x.end_time||''); if(a&&b) m+=Math.max(0,(+b[1]*60+ +b[2])-(+a[1]*60+ +a[2])); }); return Math.round(m/6)/10; }
function _rcnLine(r){
  const oldTxt=r.old_date?(_rcnD(r.old_date)+' · '+_rcnT(r.old_start)+' – '+_rcnT(r.old_end)):'';
  const newTxt=r.new_date?(_rcnD(r.new_date)+' · '+_rcnT(r.new_start)+' – '+_rcnT(r.new_end)):'';
  return {oldTxt:oldTxt,newTxt:newTxt};
}
async function checkShiftChangeNotices(){
  if(!me || _rcnBusy) return;
  _rcnBusy=true;
  try{
    const rows=await sbGet('roster_change_notices','?staff_name=eq.'+encodeURIComponent(me)+'&seen_at=is.null&order=created_at.asc&limit=30');
    if(!Array.isArray(rows)||!rows.length){ const el=document.getElementById('rcnModal'); if(el) el.remove(); return; }
    const pubs=rows.filter(function(r){ return r.kind==='published' && r.new_date; });
    if(pubs.length){
      const wks=pubs.map(function(r){return r.new_date;}).sort();
      let sh=[];
      try{ sh=await sbGet('roster_shifts','?staff_name=eq.'+encodeURIComponent(me)+'&shift_date=gte.'+wks[0]+'&shift_date=lte.'+_rcnAdd(wks[wks.length-1],6)+
        '&status=neq.open&select=shift_date,start_time,end_time,status&order=shift_date.asc,start_time.asc')||[]; }catch(e){}
      pubs.forEach(function(r){ const end=_rcnAdd(r.new_date,6); r._shifts=(sh||[]).filter(function(x){ return x.shift_date>=r.new_date && x.shift_date<=end; }); });
    }
    rows.sort(function(a,b){ return (a.kind==='published'?0:1)-(b.kind==='published'?0:1); });
    const fresh=rows.filter(function(r){ return !_rcnShown.has(r.id+'|'+(r.created_at||'')); });
    rows.forEach(function(r){ _rcnShown.add(r.id+'|'+(r.created_at||'')); });
    fresh.forEach(function(r){
      try{
        if(typeof NotifManager!=='undefined' && NotifManager.push){
          const l=_rcnLine(r);
          const isPub=r.kind==='published';
          NotifManager.push({ id:'rcn_'+r.id+'_'+(Date.parse(r.created_at)||0), type:'general',
            title: isPub?'Your roster is out':(r.kind==='cancelled'?'Shift removed':(r.kind==='added'?'New shift added':'Your shift changed')),
            body: isPub ? ('Week of '+_rcnD(r.new_date)+' · '+((r._shifts||[]).length)+' shift'+(((r._shifts||[]).length===1)?'':'s')+' · '+_rcnHrs(r._shifts)+'h')
                        : (r.kind==='changed'? (l.oldTxt+' → '+l.newTxt) : (l.newTxt||l.oldTxt)),
            ts: Date.parse(r.created_at)||Date.now(), link:null });
        }
      }catch(e){}
    });
    if(fresh.length || !document.getElementById('rcnModal')) _rcnRender(rows);
  }catch(e){ console.warn('checkShiftChangeNotices',e); }
  finally{ _rcnBusy=false; }
}
function _rcnRender(rows){
  let el=document.getElementById('rcnModal');
  if(el) el.remove();
  el=document.createElement('div'); el.id='rcnModal'; el.setAttribute('role','alertdialog'); el.setAttribute('aria-modal','true');
  el.style.cssText='position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px';
  const allPub=rows.every(function(r){ return r.kind==='published'; });
  const items=rows.map(function(r){
    if(r.kind==='published'){
      const list=r._shifts||[];
      const lines=list.length ? list.map(function(x){ return '<div style="display:flex;justify-content:space-between;gap:10px;padding:3px 0;font-size:14px"><span>'+_rcnEsc(_rcnD(x.shift_date))+'</span><b>'+_rcnT(x.start_time)+' – '+_rcnT(x.end_time)+'</b></div>'; }).join('')
                              : '<div style="font-size:13px;opacity:.75">No shifts for you this week.</div>';
      return '<div style="padding:11px 13px;margin:0 0 9px;border:1px solid var(--ui-line,#e2e8f0);border-left:4px solid #3b82f6;border-radius:10px;background:var(--ui-surface-2,transparent)">'+
             '<div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#3b82f6;margin-bottom:6px"><span>Week of '+_rcnEsc(_rcnD(r.new_date))+'</span>'+(list.length?'<span>'+_rcnHrs(list)+'h</span>':'')+'</div>'+lines+'</div>';
    }
    const l=_rcnLine(r);
    const label=r.kind==='cancelled'?'Shift removed':(r.kind==='added'?'New shift':'Shift changed');
    const col=r.kind==='cancelled'?'#ef4444':(r.kind==='added'?'#10b981':'#f59e0b');
    let body='';
    if(r.kind==='changed') body='<div style="text-decoration:line-through;opacity:.6;font-size:13px">'+_rcnEsc(l.oldTxt)+'</div><div style="font-weight:800;font-size:15px;margin-top:2px">'+_rcnEsc(l.newTxt)+'</div>';
    else if(r.kind==='cancelled') body='<div style="text-decoration:line-through;opacity:.7;font-size:14px">'+_rcnEsc(l.oldTxt)+'</div>';
    else body='<div style="font-weight:800;font-size:15px">'+_rcnEsc(l.newTxt)+'</div>';
    return '<div style="padding:11px 13px;margin:0 0 9px;border:1px solid var(--ui-line,#e2e8f0);border-left:4px solid '+col+';border-radius:10px;background:var(--ui-surface-2,transparent)">'+
           '<div style="font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:'+col+';margin-bottom:4px">'+label+'</div>'+body+'</div>';
  }).join('');
  el.innerHTML='<div style="width:min(440px,100%);max-height:86vh;overflow:auto;border-radius:18px;padding:20px;background:var(--ui-surface,#fff);color:var(--ui-ink,#0f172a);box-shadow:0 20px 60px rgba(0,0,0,.4)">'+
    (allPub ? '<div style="font-size:17px;font-weight:800;margin:0 0 4px">Your roster is out</div><div style="font-size:13px;opacity:.75;margin:0 0 14px">Here are your shifts. You\'ll get a message here if anything changes.</div>'
            : '<div style="font-size:17px;font-weight:800;margin:0 0 4px">Your roster was updated</div><div style="font-size:13px;opacity:.75;margin:0 0 14px">'+(rows.length>1?'These shifts changed':'This shift changed')+' after the roster was published.</div>')+
    items+
    '<button id="rcnAck" style="width:100%;margin-top:6px;padding:12px;border:0;border-radius:12px;font-size:14px;font-weight:800;cursor:pointer;background:var(--ui-accent,#2563eb);color:#fff">Got it</button></div>';
  document.body.appendChild(el);
  document.getElementById('rcnAck').onclick=function(){ _rcnAck(rows.map(function(r){return r.id;}), this); };
}
async function _rcnAck(ids, btn){
  if(btn){ btn.disabled=true; btn.textContent='Saving…'; }
  try{
    const r=await fetch(SB+'/rest/v1/roster_change_notices?id=in.('+ids.map(encodeURIComponent).join(',')+')',{
      method:'PATCH',
      headers:{apikey:KEY,Authorization:'Bearer '+_sbBearer(),'Content-Type':'application/json',Prefer:'return=minimal'},
      body:JSON.stringify({seen_at:new Date().toISOString()})
    });
    if(!r.ok) throw new Error('HTTP '+r.status);
    const el=document.getElementById('rcnModal'); if(el) el.remove();
    try{ if(typeof loadMyRoster==='function') loadMyRoster(); }catch(e){}
    try{ if(typeof loadHomeData==='function') loadHomeData(); }catch(e){}
  }catch(e){
    console.warn('rcn ack',e);
    if(btn){ btn.disabled=false; btn.textContent='Got it'; }
    try{ showToast('Couldn\'t save — try again'); }catch(_){}
  }
}
(function(){
  if(window._rcnBound) return; window._rcnBound=true;
  document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='visible') checkShiftChangeNotices(); });
  setInterval(function(){ if(!document.hidden) checkShiftChangeNotices(); }, 180000);
})();

/* ── STAFF NOTICES (must acknowledge) ─────────────────────────────────────
   Admin-posted notices live in staff_notices (active=true). Each person has to
   tap "I acknowledge", which writes a row to staff_notice_acks. Until then a
   full-screen box covers Nexus and the app behind it is inert. Posting is done
   in the database (see staff_notices_02_*.sql); setting active=false releases
   everyone straight away, because the box re-checks every 2 minutes and when
   the app comes back to the front.
   Fails open: if either read fails (offline, table missing, no session) nothing
   is shown and nothing already shown is removed. */
let _snBusy=false, _snKey='';
function _snEsc(v){ return String(v==null?'':v).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
function _snFmt(txt){
  const lines=String(txt||'').replace(/\r/g,'').split('\n'); let h='', inList=false;
  const close=function(){ if(inList){ h+='</ul>'; inList=false; } };
  lines.forEach(function(raw){
    const l=raw.replace(/\s+$/,'');
    let m;
    if(!l.trim()){ close(); return; }
    if((m=/^##\s+(.*)$/.exec(l))){ close(); h+='<div style="font-size:15px;font-weight:800;margin:16px 0 4px">'+_snEsc(m[1])+'</div>'; return; }
    if((m=/^\s*[•\-]\s+(.*)$/.exec(l))){ if(!inList){ h+='<ul style="margin:4px 0 6px;padding-left:20px">'; inList=true; } h+='<li style="margin:3px 0">'+_snEsc(m[1])+'</li>'; return; }
    close(); h+='<p style="margin:6px 0">'+_snEsc(l)+'</p>';
  });
  close(); return h;
}
async function _snFetch(path){
  try{
    const r=await fetch(SB+'/rest/v1/'+path,{headers:{apikey:KEY,Authorization:'Bearer '+_sbBearer()}});
    if(!r.ok) return null;
    const j=await r.json();
    return Array.isArray(j)?j:null;
  }catch(e){ return null; }
}
async function checkStaffNotices(){
  if(!me || _snBusy) return;
  _snBusy=true;
  try{
    const res=await Promise.all([
      _snFetch('staff_notices?active=eq.true&select=id,title,body,created_at&order=created_at.asc&limit=10'),
      _snFetch('staff_notice_acks?staff_name=eq.'+encodeURIComponent(me)+'&select=notice_id&limit=500')
    ]);
    const notices=res[0], acks=res[1];
    if(notices===null || acks===null) return;
    const done=new Set(acks.map(function(a){ return a.notice_id; }));
    const pending=notices.filter(function(n){ return !done.has(n.id); });
    const _pv=document.getElementById('snModal');
    if(!pending.length){ if(!(_pv && _pv.dataset.preview==='1')) _snClose(); return; }
    const key=pending.map(function(n){ return n.id; }).join(',');
    if(document.getElementById('snModal') && key===_snKey && !(_pv && _pv.dataset.preview==='1')) return;
    _snRender(pending, key);
  }catch(e){ console.warn('checkStaffNotices',e); }
  finally{ _snBusy=false; }
}
function _snClose(){
  const el=document.getElementById('snModal'); if(el) el.remove();
  _snKey='';
  try{ const hub=document.getElementById('hubLayer'); if(hub) hub.removeAttribute('inert'); }catch(e){}
  try{ document.body.style.overflow=''; }catch(e){}
}
function _snRender(list, key, opts){
  const preview=!!(opts&&opts.preview);
  const old=document.getElementById('snModal'); if(old) old.remove();
  if(!document.getElementById('snStyle')){
    const st=document.createElement('style'); st.id='snStyle';
    st.textContent='@keyframes snFade{from{opacity:0}to{opacity:1}}#snModal .sn-btn:focus-visible{outline:3px solid rgba(37,99,235,.45);outline-offset:2px}';
    document.head.appendChild(st);
  }
  _snKey=preview?'':key;
  const el=document.createElement('div'); el.id='snModal'; if(preview) el.dataset.preview='1'; el.setAttribute('role','alertdialog'); el.setAttribute('aria-modal','true'); el.setAttribute('aria-labelledby','snTitle0');
  el.style.cssText='position:fixed;inset:0;z-index:100500;background:rgba(15,23,42,.78);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;animation:snFade .18s ease-out';
  const cards=list.map(function(n,i){
    let when=''; try{ when=new Date(n.created_at).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric',timeZone:'Australia/Sydney'}); }catch(e){}
    return '<div'+(i?' style="margin-top:20px;padding-top:18px;border-top:1px solid var(--ui-line,#e2e8f0)"':'')+'>'+
      '<div style="font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#d97706;margin-bottom:6px">Important notice'+(when?' · '+_snEsc(when):'')+'</div>'+
      '<div id="snTitle'+i+'" style="font-size:19px;font-weight:800;line-height:1.25;margin:0 0 6px">'+_snEsc(n.title)+'</div>'+
      '<div style="font-size:14px;line-height:1.5">'+_snFmt(n.body)+'</div></div>';
  }).join('');
  el.innerHTML='<div style="width:min(520px,100%);max-height:calc(100dvh - 32px);display:flex;flex-direction:column;border-radius:18px;background:var(--ui-surface,#fff);color:var(--ui-ink,#0f172a);box-shadow:0 20px 60px rgba(0,0,0,.45);overflow:hidden">'+
    '<div id="snScroll" tabindex="0" style="outline:none;padding:20px 20px 8px;overflow:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain">'+cards+'</div>'+
    '<div style="padding:12px 20px 18px;border-top:1px solid var(--ui-line,#e2e8f0)">'+
      '<div id="snErr" role="alert" style="display:none;font-size:12.5px;color:#dc2626;margin:0 0 8px"></div>'+
      '<button id="snAck" class="sn-btn" type="button" style="width:100%;padding:13px;border:0;border-radius:12px;font-size:15px;font-weight:800;cursor:pointer;background:var(--ui-accent,#2563eb);color:#fff">'+(preview?'Close preview':'I acknowledge')+'</button>'+
      '<div style="font-size:11.5px;opacity:.65;text-align:center;margin-top:8px">'+(preview?'Preview only. Nothing has been posted.':'You need to acknowledge this to keep using Nexus.')+'</div>'+
    '</div></div>';
  document.body.appendChild(el);
  const btn=document.getElementById('snAck');
  if(preview){
    btn.onclick=function(){ const m=document.getElementById('snModal'); if(m) m.remove(); document.removeEventListener('keydown',_snPvKey); };
    document.addEventListener('keydown',_snPvKey);
    try{ btn.focus({preventScroll:true}); }catch(e){}
    return;
  }
  try{ const hub=document.getElementById('hubLayer'); if(hub) hub.setAttribute('inert',''); }catch(e){}
  try{ document.body.style.overflow='hidden'; }catch(e){}
  btn.onclick=function(){ _snAck(list.map(function(n){ return n.id; }), btn); };
  /* keep focus on the box; nothing behind it is reachable and Escape does nothing */
  el.addEventListener('keydown',function(ev){
    if(ev.key!=='Tab') return;
    ev.preventDefault();
    const sc=document.getElementById('snScroll');
    if(document.activeElement===btn && sc) sc.focus(); else btn.focus();
  });
  try{ btn.focus({preventScroll:true}); }catch(e){}
}
function _snPvKey(ev){ if(ev.key==='Escape'){ const m=document.getElementById('snModal'); if(m&&m.dataset.preview==='1'){ m.remove(); } document.removeEventListener('keydown',_snPvKey); } }
async function _snAck(ids, btn){
  const err=document.getElementById('snErr');
  if(err) err.style.display='none';
  btn.disabled=true; btn.textContent='Saving…';
  try{
    const r=await fetch(SB+'/rest/v1/staff_notice_acks?on_conflict=notice_id,staff_name',{
      method:'POST',
      headers:{apikey:KEY,Authorization:'Bearer '+_sbBearer(),'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'},
      body:JSON.stringify(ids.map(function(id){ return {notice_id:id, staff_name:me}; }))
    });
    if(!r.ok) throw new Error('HTTP '+r.status);
    _snClose();
  }catch(e){
    console.warn('staff notice ack',e);
    btn.disabled=false; btn.textContent='I acknowledge';
    if(err){ err.textContent='Couldn’t save your acknowledgement. Check your connection and tap again.'; err.style.display='block'; }
  }
}

/* ── STAFF NOTICES: admin page (Home > Reports & admin > Manager Tools > Staff notices) ────
   Hub admins write a notice, preview it, post it, and see who has acknowledged.
   Needs the admin policies from staff_notices_01_tables.sql; if the database
   refuses, the page says so instead of failing quietly. */
let _snpOpen=new Set(), _snpBusy=false;
function _snpWhen(iso, withTime){
  try{ return new Date(iso).toLocaleString('en-AU',withTime?{day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZone:'Australia/Sydney'}:{day:'numeric',month:'short',year:'numeric',timeZone:'Australia/Sydney'}); }catch(e){ return ''; }
}
function _snpErr(msg){ const e=document.getElementById('snpErr'); if(!e) return; e.textContent=msg||''; e.style.display=msg?'block':'none'; }
function _snpFail(status){
  return (status===401||status===403||status===404)
    ? 'The database didn’t allow that. Run staff_notices_01_tables.sql in Supabase (it’s safe to run again), then try again.'
    : 'Couldn’t save. Check your connection and try again.';
}
function snpPreview(){
  const t=(document.getElementById('snpTitle').value||'').trim(), b=(document.getElementById('snpBody').value||'').replace(/\s+$/,'');
  if(!t||!b){ _snpErr('Add a title and a message first.'); return; }
  _snpErr('');
  _snRender([{id:'preview',title:t,body:b,created_at:new Date().toISOString()}], 'preview', {preview:true});
}
async function snpPost(){
  if(_snpBusy) return;
  const tEl=document.getElementById('snpTitle'), bEl=document.getElementById('snpBody'), btn=document.getElementById('snpPost');
  const t=(tEl.value||'').trim(), b=(bEl.value||'').replace(/\s+$/,'');
  if(!t||!b){ _snpErr('Add a title and a message first.'); return; }
  if(!(await nxConfirm('Nexus will be blocked for everyone until they tap I acknowledge.',{title:'Post “'+t+'” to all staff?',okText:'Post notice'}))) return;
  _snpErr(''); _snpBusy=true; btn.disabled=true; btn.textContent='Posting…';
  try{
    const r=await fetch(SB+'/rest/v1/staff_notices',{method:'POST',
      headers:{apikey:KEY,Authorization:'Bearer '+_sbBearer(),'Content-Type':'application/json',Prefer:'return=representation'},
      body:JSON.stringify({title:t,body:b,created_by:me})});
    if(!r.ok){ _snpErr(_snpFail(r.status)); return; }
    const out=await r.json().catch(function(){return null;});
    const id=out&&out[0]&&out[0].id;
    if(!id){ _snpErr('The notice may not have saved. Refresh the list to check before trying again.'); return; }
    /* the person posting has read it, so they are not blocked by their own notice */
    try{ await fetch(SB+'/rest/v1/staff_notice_acks?on_conflict=notice_id,staff_name',{method:'POST',
      headers:{apikey:KEY,Authorization:'Bearer '+_sbBearer(),'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'},
      body:JSON.stringify([{notice_id:id,staff_name:me}])}); }catch(e){}
    tEl.value=''; bEl.value='';
    try{ showToast('Notice posted. Staff will see it within about 2 minutes.','success'); }catch(e){}
    await loadStaffNoticesAdmin(true);
  }catch(e){ _snpErr(_snpFail(0)); }
  finally{ _snpBusy=false; btn.disabled=false; btn.textContent='Post to all staff'; }
}
async function snpWithdraw(id){
  if(!(await nxConfirm('People who haven’t acknowledged it will no longer be blocked. The record of who acknowledged is kept.',{title:'Withdraw this notice?',okText:'Withdraw'}))) return;
  try{
    const r=await fetch(SB+'/rest/v1/staff_notices?id=eq.'+encodeURIComponent(id),{method:'PATCH',
      headers:{apikey:KEY,Authorization:'Bearer '+_sbBearer(),'Content-Type':'application/json',Prefer:'return=representation'},
      body:JSON.stringify({active:false})});
    const out=await r.json().catch(function(){return null;});
    if(!r.ok||!Array.isArray(out)||!out.length) throw new Error('x');
    try{ showToast('Notice withdrawn','success'); }catch(e){}
  }catch(e){ try{ showToast('Couldn’t withdraw it. Check your connection, and that staff_notices_01_tables.sql has been run.','error'); }catch(_){} return; }
  loadStaffNoticesAdmin(true);
}
async function snpDelete(id, live){
  const msg=live
    ? 'It stops blocking anyone straight away, and the record of who acknowledged it is deleted too. To keep the record, use Withdraw instead.'
    : 'The record of who acknowledged it is deleted too.';
  if(!(await nxConfirm(msg,{title:'Delete this notice for good?',okText:'Delete',danger:true}))) return;
  try{
    const r=await fetch(SB+'/rest/v1/staff_notices?id=eq.'+encodeURIComponent(id),{method:'DELETE',
      headers:{apikey:KEY,Authorization:'Bearer '+_sbBearer(),Prefer:'return=representation'}});
    const out=await r.json().catch(function(){return null;});
    if(!r.ok||!Array.isArray(out)||!out.length) throw new Error('x');
    _snpOpen.delete(id);
    try{ showToast('Notice deleted','success'); }catch(e){}
  }catch(e){ try{ showToast('Couldn\u2019t delete it. Check your connection, and run staff_notices_01_tables.sql again if you haven\u2019t since this update.','error'); }catch(_){} return; }
  loadStaffNoticesAdmin(true);
}
function snpToggle(id){
  if(_snpOpen.has(id)) _snpOpen.delete(id); else _snpOpen.add(id);
  const d=document.getElementById('snpd-'+id), b=document.getElementById('snpb-'+id);
  const open=_snpOpen.has(id);
  if(d) d.style.display=open?'block':'none';
  if(b) b.textContent=open?'Hide names':'Who’s acknowledged';
}
async function loadStaffNoticesAdmin(quiet){
  const host=document.getElementById('snpList'); if(!host) return;
  if(!host.innerHTML.trim()) host.innerHTML=(typeof nxSkel==='function')?nxSkel('cards',3):'';
  const notices=await _snFetch('staff_notices?select=id,title,active,created_at,created_by&order=created_at.desc&limit=10');
  if(notices===null){
    if(!host.querySelector('.snp-item')) host.innerHTML='<div class="snp-hint" style="padding:10px 0;">Couldn’t load notices. Run staff_notices_01_tables.sql in Supabase if you haven’t yet, then tap Refresh.</div>';
    return;
  }
  if(!notices.length){ host.innerHTML='<div class="snp-hint" style="padding:10px 0;">No notices yet. Write one above and post it.</div>'; host.dataset.sig='empty'; return; }
  const ids=notices.map(function(n){ return n.id; }).join(',');
  const res=await Promise.all([
    _snFetch('staff_notice_acks?notice_id=in.('+ids+')&select=notice_id,staff_name,acked_at&order=acked_at.asc&limit=3000'),
    _snFetch('staff_names?select=name&order=name.asc&limit=500')
  ]);
  const acks=res[0]||[], staff=res[1];
  const norm=function(v){ return String(v||'').trim().toLowerCase(); };
  const everyone=staff?staff.map(function(r){ return r.name; }).filter(Boolean):null;
  const html=notices.map(function(n){
    const mine=acks.filter(function(a){ return a.notice_id===n.id; });
    const doneSet=new Set(mine.map(function(a){ return norm(a.staff_name); }));
    const total=everyone?everyone.length:null;
    const doneInList=everyone?everyone.filter(function(nm){ return doneSet.has(norm(nm)); }).length:mine.length;
    const pct=total?Math.round(100*doneInList/total):0;
    const open=_snpOpen.has(n.id);
    const waiting=everyone?everyone.filter(function(nm){ return !doneSet.has(norm(nm)); }):[];
    const detail='<div class="snp-detail" id="snpd-'+_snEsc(n.id)+'" style="display:'+(open?'block':'none')+'">'+
      (everyone?('<div class="snp-sec">Not yet ('+waiting.length+')</div>'+(waiting.length?'<div class="snp-chips">'+waiting.map(function(nm){ return '<span class="snp-chip">'+_snEsc(nm)+'</span>'; }).join('')+'</div>':'<div class="snp-hint">Everyone has acknowledged.</div>')):'')+
      '<div class="snp-sec">Acknowledged ('+mine.length+')</div>'+
      (mine.length?mine.map(function(a){ return '<div class="snp-row"><span>'+_snEsc(a.staff_name)+'</span><span>'+_snEsc(_snpWhen(a.acked_at,true))+'</span></div>'; }).join(''):'<div class="snp-hint">Nobody yet.</div>')+
      '</div>';
    return '<div class="snp-item">'+
      '<div class="snp-top"><div class="snp-title">'+_snEsc(n.title)+'</div><span class="snp-pill '+(n.active?'live':'off')+'">'+(n.active?'Live':'Withdrawn')+'</span></div>'+
      '<div class="snp-meta">Posted '+_snEsc(_snpWhen(n.created_at,true))+(n.created_by?' by '+_snEsc(n.created_by):'')+'</div>'+
      (total?'<div class="snp-bar" aria-hidden="true"><i style="width:'+pct+'%"></i></div>':'')+
      '<div class="snp-count"><b>'+doneInList+'</b>'+(total?' of '+total:'')+' acknowledged</div>'+
      '<div class="snp-actions"><button type="button" class="btn btn-outline" id="snpb-'+_snEsc(n.id)+'" onclick="snpToggle(\''+_snEsc(n.id)+'\')">'+(open?'Hide names':'Who’s acknowledged')+'</button>'+
      (n.active?'<button type="button" class="btn btn-outline" onclick="snpWithdraw(\''+_snEsc(n.id)+'\')">Withdraw</button>':'')+
      '<button type="button" class="btn btn-outline snp-del" onclick="snpDelete(\''+_snEsc(n.id)+'\','+(n.active?'true':'false')+')">Delete</button></div>'+
      detail+'</div>';
  }).join('');
  if(host.dataset.sig!==html){ host.innerHTML=html; host.dataset.sig=html; }
}
(function(){
  if(window._snpBound) return; window._snpBound=true;
  setInterval(function(){
    const sec=document.getElementById('msec-notices');
    if(sec && sec.offsetParent!==null && !document.hidden) loadStaffNoticesAdmin(true);
  }, 30000);
})();

(function(){
  if(window._snBound) return; window._snBound=true;
  document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='visible') checkStaffNotices(); });
  setInterval(function(){ if(!document.hidden) checkStaffNotices(); }, 120000);
})();

async function checkNewNotifications(){
  if(!me) return;
  checkNewDiscussions();
  try{
    const rows=await sbGet('leave_submissions','?staff_name=eq.'+encodeURIComponent(me)+'&status=in.(approved,declined)&order=submitted_at.desc&limit=5');
    const read=JSON.parse(localStorage.getItem('oR_'+me)||'[]');
    const _MAXAGE=14*24*3600*1000;
    const _fresh=(ts)=>{ if(!ts) return true; const t=new Date(ts).getTime(); return isNaN(t)?true:(Date.now()-t)<_MAXAGE; };
    const unread=rows.filter(r=>!read.includes(r.id));
    if(unread.length){
      const r=unread[0];
      const bannerKey='banner_shown_'+me+'_'+r.id;
      if(!localStorage.getItem(bannerKey)){
        if(typeof triggerBellPulse === 'function') triggerBellPulse();
        const approved=r.status==='approved';
        const title=approved ? 'Leave Approved' : 'Leave Declined';
        showBanner(title, fmtF(r.from_date)+' - '+fmtF(r.to_date), approved ? 'success' : 'warning');
        if(typeof NotifManager !== 'undefined' && NotifManager.push){
          NotifManager.push({
            id: 'leave-'+r.id,
            type: approved ? 'leave-approved' : 'leave-declined',
            title: title,
            body: fmtF(r.from_date)+' - '+fmtF(r.to_date) + (r.decline_reason?' · '+r.decline_reason:''),
            ts: Date.now(),
            link: 'leave'
          });
        }
        localStorage.setItem(bannerKey,'1');
      }
    }
  }catch(e){console.warn(e);}
}



/* Training and quizzes now live in Yatra (Quizzes). */


const VAPID_PUBLIC_KEY = 'BM7i-tJCr4RLEfKLJmtdAfVvw0XQT0lsCgdlz6MXPZX9KNfmmpQUGAV0DLSD-fOo0vb-WYoy7BQjDq0qNwKJpkI';
const SEND_PUSH_URL = SB + '/functions/v1/send-push';

function urlBase64ToUint8Array(base64String){
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for(let i=0; i<raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function registerServiceWorker(){
  if(!('serviceWorker' in navigator)) return null;
  try{
    const reg = await navigator.serviceWorker.register('./sw.js');
    console.log('[SW] registered');
    return reg;
  }catch(e){
    console.warn('[SW] registration failed:', e);
    return null;
  }
}

async function isPushSubscribed(){
  if(!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  try{
    const reg = await navigator.serviceWorker.getRegistration();
    if(!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  }catch(e){ return false; }
}

async function subscribeToPush(){
  if(!('serviceWorker' in navigator) || !('PushManager' in window)){
    showToast('Push notifications not supported on this browser', 'warning');
    return false;
  }
  try{
    const perm = await Notification.requestPermission();
    if(perm !== 'granted'){
      showToast('Permission denied — enable in browser settings to receive push notifications', 'warning');
      return false;
    }
    let reg = await navigator.serviceWorker.getRegistration();
    if(!reg) reg = await registerServiceWorker();
    if(!reg){ showToast('Service worker not available', 'error'); return false; }
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if(!sub){
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    const subJson = sub.toJSON();
    try{ window._myEndpoint = sub.endpoint; }catch(e){}
    await sbPost('push_subscriptions', {
      staff_name: me,
      endpoint: sub.endpoint,
      p256dh: subJson.keys.p256dh,
      auth: subJson.keys.auth,
      user_agent: navigator.userAgent.slice(0,200)
    }, true);
    localStorage.setItem('push_enabled_'+me, '1');
    showToast('Push notifications enabled!', 'success');
    return true;
  }catch(e){
    console.warn('[push] subscribe failed:', e);
    showToast('Failed to enable push: '+e.message, 'error');
    return false;
  }
}

async function unsubscribeFromPush(){
  try{
    const reg = await navigator.serviceWorker.getRegistration();
    if(reg){
      const sub = await reg.pushManager.getSubscription();
      if(sub){
        await fetch(SB+'/rest/v1/push_subscriptions?endpoint=eq.'+encodeURIComponent(sub.endpoint),{
          method:'DELETE',
          headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}
        });
        await sub.unsubscribe();
      }
    }
    localStorage.removeItem('push_enabled_'+me);
    showToast('Push notifications disabled', 'info');
    return true;
  }catch(e){
    showToast('Failed to disable: '+e.message, 'error');
    return false;
  }
}

async function sendPushTo(staffName, title, body, options){
  options = options || {};
  try{
    const resp = await fetch(SEND_PUSH_URL,{
      method:'POST',
      headers:{
        'Authorization':'Bearer '+_sbBearer(),
        'apikey':KEY,
        'Content-Type':'application/json'
      },
      body: JSON.stringify({
        staff_name: staffName,
        title: title,
        body: body,
        url: options.url || './',
        tag: options.tag || ('nexus-'+Date.now()),
        broadcast: !!options.broadcast,
        exclude: options.exclude || null
      })
    });
    if(!resp.ok){
      console.warn('[push] send failed:', resp.status, await resp.text());
      return false;
    }
    return true;
  }catch(e){
    console.warn('[push] send error:', e);
    return false;
  }
}










let _sbClient = null;
let _notifSyncChannel = null;

function initNotifSync(){
  if(_sbClient || !window.supabase || !me) return;
  try{
    _sbClient = window.supabase.createClient(SB, KEY, {
      realtime: { params: { eventsPerSecond: 5 } }
    });
    _notifSyncChannel = _sbClient
      .channel('notif-sync-' + me)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notification_seen',
        filter: 'staff_name=eq.' + me
      }, function(payload){
        const row = payload.new;
        if(!row || !row.is_read) return;
        handleRemoteDismiss(row.notif_key);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notification_seen',
        filter: 'staff_name=eq.' + me
      }, function(payload){
        const row = payload.new;
        if(row && row.is_read) handleRemoteDismiss(row.notif_key);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'contacts'
      }, function(){
        try{ if(typeof window.clOnContactsChanged==='function') window.clOnContactsChanged(); }catch(e){}
      })
      .subscribe();
    console.log('[notif-sync] listening for', me);
  }catch(e){ console.warn('[notif-sync] init failed:', e); }
}

function handleRemoteDismiss(notifKey){
  if(!notifKey) return;
  try{
    if(typeof NotifManager !== 'undefined' && NotifManager.markRead){
      const localId = notifKey.replace('_', '-');
      NotifManager.markRead(localId);
    }
    const parts = notifKey.split('_');
    if(parts.length >= 2){
      const kind = parts[0], rid = parts.slice(1).join('_');
      let key = null;
      if(kind === 'leave') key = 'oR_'+me;
      else if(kind === 'reply') key = 'seen_replies_'+me;
      else if(kind === 'react') key = 'seen_reacts_'+me;
      else if(kind === 'task') key = 'seen_task_notifs_'+me;
      if(key){
        const arr = JSON.parse(localStorage.getItem(key) || '[]');
        if(!arr.includes(rid) && !arr.includes(parseInt(rid,10))){
          arr.push(rid);
          localStorage.setItem(key, JSON.stringify(arr.slice(-500)));
        }
      }
    }
  }catch(e){ console.warn('[notif-sync] dismiss handler:', e); }
  try{
    if(typeof loadNotifications === 'function') loadNotifications();
  }catch(e){}
}

async function markNotifReadEverywhere(notifKey){
  if(!me || !notifKey) return;
  try{
    await fetch(SB + '/rest/v1/notification_seen?on_conflict=staff_name,notif_key', {
      method: 'POST',
      headers: {
        'apikey': KEY,
        'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify({
        staff_name: me,
        notif_key: notifKey,
        is_read: true
      })
    });
    if(typeof SEND_PUSH_URL !== 'undefined'){
      fetch(SEND_PUSH_URL, {
        method: 'POST',
        headers: {
          'apikey': KEY,
          'Authorization': 'Bearer ' + _sbBearer(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          staff_name: me,
          action: 'dismiss',
          notif_key: notifKey,
          exclude_endpoint: window._myEndpoint || null
        })
      }).catch(function(){});
    }
  }catch(e){ console.warn('[notif-sync] mark failed:', e); }
}


async function captureMyPushEndpoint(){
  try{
    if(!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    if(!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if(sub && sub.endpoint){
      window._myEndpoint = sub.endpoint;
      console.log('[notif-sync] endpoint captured');
    }
  }catch(e){ console.warn('[notif-sync] endpoint capture failed:', e); }
}


function startNotifSyncWhenReady(){
  if(window.supabase && me){
    initNotifSync();
  } else {
    setTimeout(startNotifSyncWhenReady, 500);
  }
}

document.addEventListener('visibilitychange', function(){
  if(!document.hidden && _sbClient){
    if(typeof loadNotifications === 'function') loadNotifications();
  }
});

if('serviceWorker' in navigator){
  navigator.serviceWorker.addEventListener('message', function(event){
    if(event.data && event.data.type === 'notif-click' && event.data.notif_key){
      markNotifReadEverywhere(event.data.notif_key);
    }
  });
}



const NotifManager = (function(){
  const KEY_PREFIX = 'notif_local_';
  const MAX_STORED = 100;

  function key(){ 
    const u = window.me || (typeof me !== 'undefined' && me) || sessionStorage.getItem('ou') || 'anon';
    return KEY_PREFIX + u;
  }

  function load(){
    try{
      const list = JSON.parse(localStorage.getItem(key()) || '[]');
      const cleaned = list.filter(function(n){
        return n.type !== 'tasks' && n.type !== 'task' && n.link !== 'tasks';
      });
      if(cleaned.length !== list.length){
        try{ localStorage.setItem(key(), JSON.stringify(cleaned)); }catch(e){}
      }
      return cleaned;
    }
    catch(e){ return []; }
  }

  function save(list){
    try{
      const trimmed = list.slice(0, MAX_STORED);
      localStorage.setItem(key(), JSON.stringify(trimmed));
    }catch(e){}
  }

  function push(notif){
    if(!notif || !notif.id) return;
    const list = load();
    if(list.find(function(n){return n.id === notif.id;})) return false;
    if(typeof triggerBellPulse === 'function') triggerBellPulse();
    try{
      if(localStorage.getItem('oscars_notif_sound') !== '0' && typeof playNotifSound === 'function'){
        playNotifSound(notif.type || 'default');
      }
    }catch(e){}
    list.unshift({
      id: notif.id,
      type: notif.type || 'general',
      title: notif.title || '',
      body: notif.body || '',
      ts: notif.ts || Date.now(),
      link: notif.link || null,
      read: false
    });
    save(list);
    refreshUI();
    showBannerOnce(notif);
    return true;
  }

  function showBannerOnce(notif){
    if(typeof showBanner === 'function'){
      let cls = 'success';
      if(notif.type && notif.type.indexOf('declined') >= 0) cls = 'warning';
      else if(notif.type && notif.type.indexOf('mention') >= 0) cls = '';
      showBanner(notif.title, notif.body, cls);
    }
  }

  function markRead(id){
    const list = load();
    const item = list.find(function(n){return n.id === id;});
    if(!item) return;
    item.read = true;
    save(list);
    refreshUI();
  }

  function markAllRead(){
    const list = load();
    list.forEach(function(n){ n.read = true; });
    save(list);
    refreshUI();
  }

  function clearOne(id){
    let list = load();
    list = list.filter(function(n){return n.id !== id;});
    save(list);
    refreshUI();
  }

  function clearAll(){
    save([]);
    refreshUI();
  }

  function unreadCount(){
    return load().filter(function(n){return !n.read;}).length;
  }

  function getAll(){ return load(); }

  function refreshUI(){
    updateBadges();
    repaintDropdown();
  }

  function updateBadges(){
    const count = unreadCount();
    const display = count > 99 ? '99+' : String(count);
    ['mhBellBadge','sbBellBadge'].forEach(function(id){
      const b = document.getElementById(id);
      if(!b) return;
      if(count > 0){
        b.textContent = display;
        b.style.display = 'flex';
      } else {
        b.style.display = 'none';
      }
    });
    const bnBadge = document.getElementById('bnNotifBadge');
    if(bnBadge){
      if(count > 0){
        bnBadge.textContent = count > 9 ? '9+' : String(count);
        bnBadge.style.display = 'flex';
      } else {
        bnBadge.style.display = 'none';
      }
    }
    document.querySelectorAll('.bn-badge, .nav-badge').forEach(function(b){
      if(count > 0){ b.textContent = (count > 4 ? '4+' : String(count)); b.style.display = 'flex'; }
      else { b.textContent = ''; b.style.display = 'none'; }
    });
    if(typeof updateBellBadge === 'function') updateBellBadge(count);
  }

  const _ND_ICONS = {
    ok:   '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 10.5l3.5 3.5 7.5-8"/></svg>',
    no:   '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l8 8M14 6l-8 8"/></svg>',
    learn:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5.5C5.5 4.5 8 4.8 10 6.2c2-1.4 4.5-1.7 7-.7v9c-2.5-1-5-.7-7 .7-2-1.4-4.5-1.7-7-.7z"/><path d="M10 6.2v9"/></svg>',
    time: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="6.5"/><path d="M10 6.5V10l2.5 1.5"/></svg>',
    chat: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A1.5 1.5 0 015.5 4h9A1.5 1.5 0 0116 5.5v6a1.5 1.5 0 01-1.5 1.5H9l-3.5 3v-3h0A1.5 1.5 0 014 11.5z"/></svg>',
    bell: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 13.5V9a4.5 4.5 0 119 0v4.5l1 1.5h-11z"/><path d="M8.5 17h3"/></svg>'
  };
  function _ndKind(n){
    const t = String(n.type||'').toLowerCase();
    if(t.indexOf('declin')>=0 || t.indexOf('reject')>=0) return 'no';
    if(t.indexOf('approv')>=0) return 'ok';
    if(t.indexOf('quiz')>=0 || t.indexOf('train')>=0 || t.indexOf('learn')>=0) return 'learn';
    if(t.indexOf('avail')>=0 || t.indexOf('remind')>=0 || t.indexOf('expir')>=0) return 'time';
    if(t.indexOf('mention')>=0 || t.indexOf('reply')>=0 || t.indexOf('react')>=0 || t.indexOf('chat')>=0) return 'chat';
    return 'bell';
  }
  function _ndShort(ts){
    const d = Math.max(0, Date.now() - ts);
    if(d < 60000) return 'now';
    if(d < 3600000) return Math.floor(d/60000)+'m';
    if(d < 86400000) return Math.floor(d/3600000)+'h';
    if(d < 604800000) return Math.floor(d/86400000)+'d';
    return new Date(ts).toLocaleDateString('en-AU',{day:'numeric',month:'short'});
  }
  function listHtml(list){
    list = list || load();
    if(!list.length){
      return '<div class="nd-empty"><span class="nd-empty-ico">'+_ND_ICONS.bell+'</span><div class="nd-empty-t">You\'re all caught up</div><div class="nd-empty-s">New alerts will show up here.</div></div>';
    }
    return '<div class="nd-list" role="list">'+list.map(function(n){
      const kind = _ndKind(n);
      const id = String(n.id).replace(/'/g,"\\'").replace(/"/g,'&quot;');
      return '<div class="nd-row'+(n.read?' read':' unread')+'" role="listitem" tabindex="0" data-id="'+String(n.id).replace(/"/g,'&quot;')+'" '+
        'onclick="NotifManager._handleClick(\''+id+'\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();NotifManager._handleClick(\''+id+'\');}">'+
        '<span class="nd-dot" aria-hidden="true"></span>'+
        '<span class="nd-ico nd-ico-'+kind+'" aria-hidden="true">'+_ND_ICONS[kind]+'</span>'+
        '<span class="nd-main"><span class="nd-title">'+esc(n.title||'')+'</span>'+(n.body?'<span class="nd-body">'+esc(n.body)+'</span>':'')+'</span>'+
        '<span class="nd-meta"><span class="nd-time">'+_ndShort(n.ts||Date.now())+'</span>'+
          '<button type="button" class="nd-x" aria-label="Dismiss" title="Dismiss" onclick="event.stopPropagation();NotifManager.clearOne(\''+id+'\')"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 3l6 6M9 3l-6 6"/></svg></button></span>'+
      '</div>';
    }).join('')+'</div>';
  }

  function repaintDropdown(){
    const list = load();
    const html = listHtml(list);
    ['notifDropList','mhNotifDropList'].forEach(function(id){
      const el = document.getElementById(id);
      if(el) el.innerHTML = html;
    });
    document.querySelectorAll('.nd-acts').forEach(function(a){ a.style.visibility = list.length ? '' : 'hidden'; });
  }

  function _closePanels(){
    document.querySelectorAll('.notif-drop').forEach(function(d){ d.classList.remove('open'); d.style.display='none'; });
    const m = document.getElementById('mhNotifModal'); if(m) m.remove();
    const orig = document.getElementById('mhNotifDropList_orig'); if(orig) orig.id = 'mhNotifDropList';
  }

  function _handleClick(id){
    const item = load().find(function(n){return n.id === id;});
    if(!item) return;
    markRead(id);
    const validPages = ['home','schedule','leave','availability','shifts','myhours','teamreport','engagement','calendar','myreports','notifs','profile'];
    if(item.link && typeof goTo === 'function' && validPages.indexOf(item.link) >= 0){
      _closePanels();
      goTo(item.link);
    }
  }



  return {
    push: push,
    markRead: markRead,
    markAllRead: markAllRead,
    clearOne: clearOne,
    clearAll: clearAll,
    unreadCount: unreadCount,
    getAll: getAll,
    refresh: refreshUI,
    listHtml: listHtml,
    _handleClick: _handleClick
  };
})();



setTimeout(function(){ if(typeof NotifManager !== 'undefined') NotifManager.refresh(); }, 1000);

function handleMobileBell(e){
  if(e){ e.preventDefault(); e.stopPropagation(); }
  let overlay = document.getElementById('mhNotifModal');
  if(overlay){
    overlay.remove();
    const orig = document.getElementById('mhNotifDropList_orig');
    if(orig) orig.id = 'mhNotifDropList';
    return;
  }
  overlay = document.createElement('div');
  overlay.id = 'mhNotifModal';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.4);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:flex;align-items:flex-start;justify-content:flex-end;padding:60px 8px 8px;';
  overlay.addEventListener('click', function(ev){
    if(ev.target === overlay) overlay.remove();
  });
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const bg = isDark ? '#1e293b' : '#fff';
  const border = isDark ? '#2d3f55' : '#e5e7eb';
  const txtPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const originalMhList = document.getElementById('mhNotifDropList');
  if(originalMhList){ originalMhList.id = 'mhNotifDropList_orig'; }
  overlay.innerHTML = '<div style="background:'+bg+';border:1px solid '+border+';border-radius:14px;width:100%;max-width:380px;max-height:80vh;overflow-y:auto;-webkit-overflow-scrolling:touch;box-shadow:0 20px 50px rgba(15,23,42,.2);" onclick="event.stopPropagation()">'+
    '<div class="notif-drop-header" style="padding:14px 16px;font-size:14px;font-weight:700;color:'+txtPrimary+';border-bottom:1px solid '+border+';position:sticky;top:0;background:'+bg+';z-index:1;display:flex;align-items:center;justify-content:space-between;">'+
      '<span class="nd-title-h">Notifications</span><span class="nd-acts"><button type="button" onclick="NotifManager.markAllRead()">Mark all read</button><button type="button" class="nd-clear" onclick="NotifManager.clearAll()">Clear</button></span>'+
      '<button onclick="document.getElementById(\'mhNotifModal\') && (document.getElementById(\'mhNotifModal\').remove(), document.getElementById(\'mhNotifDropList_orig\') && (document.getElementById(\'mhNotifDropList_orig\').id=\'mhNotifDropList\'))" style="background:none;border:none;font-size:20px;line-height:1;color:var(--ui-ink-4,#94a3b8);cursor:pointer;padding:0 4px;">×</button>'+
    '</div>'+
    '<div id="mhNotifDropList"><div class="notif-drop-empty" style="color:var(--ui-ink-3,#64748b);padding:30px 16px;text-align:center;">'+nxSkel('list',4)+'</div></div>'+
  '</div>';
  document.body.appendChild(overlay);
  const restoreId = function(){
    const orig = document.getElementById('mhNotifDropList_orig');
    if(orig) orig.id = 'mhNotifDropList';
  };
  overlay.addEventListener('click', function(ev){
    if(ev.target === overlay){
      overlay.remove();
      restoreId();
    }
  });
  if(typeof loadNotifDrop === 'function') loadNotifDrop('mhNotifDrop');
}

function toggleNotifDrop(dropId){
  const id = dropId || 'notifDrop';
  const drop = document.getElementById(id);
  if(!drop){ console.warn('[notif] drop missing:', id); return; }
  document.querySelectorAll('.notif-drop').forEach(function(d){
    if(d.id !== id){
      d.classList.remove('open');
      d.style.display = 'none';
    }
  });
  const isOpen = drop.classList.contains('open');
  if(isOpen){
    drop.classList.remove('open');
    drop.style.display = 'none';
  } else {
    drop.classList.add('open');
    drop.style.display = 'block';
    loadNotifDrop(id);
    setTimeout(function(){
      function outsideHandler(e){
        if(!e.target.closest('.notif-drop-wrap') && !e.target.closest('.notif-drop')){
          drop.classList.remove('open');
          drop.style.display = 'none';
          document.removeEventListener('click', outsideHandler, true);
          document.removeEventListener('touchend', outsideHandler, true);
        }
      }
      document.addEventListener('click', outsideHandler, true);
      document.addEventListener('touchend', outsideHandler, true);
    }, 100);
  }
}

async function loadNotifDrop(dropId){
  const listId = dropId==='mhNotifDrop'?'mhNotifDropList':'notifDropList';
  let el = document.getElementById(listId);
  if(!el){
    const drop = document.getElementById(dropId);
    if(drop){
      console.log('[notif-drop] creating missing list element');
      el = document.createElement('div');
      el.id = listId;
      drop.appendChild(el);
    } else {
      console.warn('[notif-drop] BOTH drop and list missing:', dropId, listId);
      return;
    }
  }
  if(el && typeof NotifManager !== 'undefined' && NotifManager.getAll){
    try{
      const allNotifs = NotifManager.getAll();
      if(allNotifs && allNotifs.length){
        el.innerHTML = NotifManager.listHtml(allNotifs);
        return;
      }
    }catch(e){ console.warn('NotifManager render failed:', e); }
  }
  if(!el) return;
  el.innerHTML='<div class="notif-drop-empty" style="color:var(--ui-ink-3,#64748b);padding:30px 16px;text-align:center;">'+nxSkel('list',4)+'</div>';
  try{
    const _currentMe = me || sessionStorage.getItem('ou') || window.me;
    if(!_currentMe){ el.innerHTML='<div class="notif-drop-empty">Sign in to see notifications</div>'; return; }
    const rows=(await sbGet('leave_submissions','?staff_name=eq.'+encodeURIComponent(_currentMe)+'&status=in.(approved,declined)&order=submitted_at.desc&limit=10'))
      .filter(function(r){ return r.staff_name === _currentMe; });
    const read=JSON.parse(localStorage.getItem('oR_'+me)||'[]');

    let replyNotifsRaw=[];
    try{ 
      replyNotifsRaw=([])
        .filter(function(r){ return r.recipient === _currentMe; });
    }catch(e){}
    const seenReplies=JSON.parse(localStorage.getItem('seen_replies_'+me)||'[]');
    const newReplies=replyNotifsRaw.filter(r=>!seenReplies.includes(r.id)&&_fresh(r.created_at));
    const reactNotifsDrop=await loadReactNotifs();
    const seenReactsDrop=JSON.parse(localStorage.getItem('seen_reacts_'+me)||'[]');
    const newReactsDrop=(reactNotifsDrop||[]).filter(function(r){return !seenReactsDrop.includes(r.id)&&_fresh(r.created_at||r.reacted_at);});

    if(!rows.length&&!newReactsDrop.length&&!newReplies.length){
      el.innerHTML='<div class="notif-drop-empty">No notifications yet</div>';
      return;
    }

    let html='<div class="notif-drop-actions"><span style="font-size:11px;color:var(--ui-ink-4,#94a3b8);font-weight:600;">Recent</span><button class="notif-mark-all" onclick="markAllNotificationsRead()">Mark all as read</button></div>';

    newReplies.forEach(function(r){
      html+='<div class="notif-drop-item unread" onclick="closeAllNotifDrops();markReplySeen(\''+r.id+'\');">'+
        '<div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:2px;"> New Reply</div>'+
        '<div style="font-size:12px;color:var(--ui-ink-2b,#475569);">'+esc(r.replier)+' replied to your discussion</div>'+
        '<div style="font-size:11px;color:var(--ui-ink-4,#94a3b8);margin-top:2px;">'+esc(r.body)+'</div>'+
        '</div>';
    });

    newReactsDrop.forEach(function(r){
      html+='<div class="notif-drop-item unread" data-rid="'+r.id+'" onclick="markReactSeen(this.dataset.rid);closeAllNotifDrops();">'+
        '<div style="font-size:12px;font-weight:700;color:#7c3aed;margin-bottom:2px;">'+r.emoji+' Reaction on your post</div>'+
        '<div style="font-size:12px;color:var(--ui-ink-2b,#475569);">'+esc(r.staff_name)+' reacted to your '+(r.target_type==='disc'?'discussion':'announcement')+'</div>'+
        '</div>';
    });



    rows.filter(function(r){ return _fresh(r.submitted_at); }).forEach(function(r){
      const isRead=read.includes(r.id);
      const approved=r.status==='approved';
      const col=approved?'#16a34a':'#dc2626';
      const label=approved?'✓ Leave Approved':'✕ Leave Declined';
      html+='<div class="notif-drop-item'+(isRead?'':' unread')+'" data-nid="'+r.id+'" onclick="closeAllNotifDrops();markNotifRead(this.dataset.nid);goTo(\'schedule\');setTimeout(function(){showSchedTab(\'leave\');},120);">'+
        '<div style="font-size:12px;font-weight:700;color:'+col+';margin-bottom:2px;">'+label+'</div>'+
        '<div style="font-size:12px;color:var(--ui-ink-2b,#475569);">'+fmtF(r.from_date)+' - '+fmtF(r.to_date)+'</div>'+
        (r.reason?'<div style="font-size:11px;color:var(--ui-ink-4,#94a3b8);margin-top:2px;">'+esc(r.reason)+'</div>':'')+
        (r.status==='declined'&&r.decline_reason?'<div style="font-size:11px;color:#dc2626;margin-top:2px;">'+esc(r.decline_reason)+'</div>':'')+
        '<div style="font-size:10px;color:var(--ui-ink-4,#94a3b8);margin-top:3px;">Tap to view leave history</div>'+
        '</div>';
    });

    el.innerHTML=html;
    const otherId=listId==='notifDropList'?'mhNotifDropList':'notifDropList';
    const other=document.getElementById(otherId);
    if(other)other.innerHTML=html;
  }catch(e){
    el.innerHTML='<div class="notif-drop-empty">Could not load</div>';
  }
}

function closeAllNotifDrops(){
  document.querySelectorAll('.notif-drop.open').forEach(function(d){d.classList.remove('open');});
}




async function markNotifRead(id){
  const read=JSON.parse(localStorage.getItem('oR_'+me)||'[]');
  if(!read.includes(id)){read.push(id);localStorage.setItem('oR_'+me,JSON.stringify(read));}
  try{
    await fetch(SB+'/rest/v1/notification_seen?on_conflict=staff_name,notif_key',{
      method:'POST',
      headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'},
      body:JSON.stringify({staff_name:me, notif_key:'leave_'+id})
    });
  }catch(e){ console.warn('markNotifRead sync:',e); }
  if(typeof loadNotifications === 'function') loadNotifications();
}






let selectedMood=0;








function showToast(msg, variant){
  let v = variant || 'info';
  if(!variant){
    const m = String(msg).toLowerCase();
    if(/fail|error|wrong|invalid|cannot|⚠/i.test(msg)) v = 'error';
    else if(/saved|approved|done|wiped|deleted|sent|reset/i.test(msg)) v = 'success';
    else if(/warning|caution/i.test(msg)) v = 'warning';
  }
  let t=document.getElementById('_toast');
  if(!t){
    t=document.createElement('div');
    t.id='_toast';
    document.body.appendChild(t);
  }
  const styles = {
    success: {bg:'#10b981',icon:'<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>'},
    error: {bg:'#dc2626',icon:'<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>'},
    warning: {bg:'#f59e0b',icon:'<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>'},
    info: {bg:'#0f172a',icon:'<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clip-rule="evenodd"/></svg>'}
  };
  const s = styles[v] || styles.info;
  t.style.cssText='position:fixed;bottom:max(28px,calc(env(safe-area-inset-bottom,0px) + 90px));left:50%;transform:translateX(-50%) translateY(28px) scale(.95);background:'+s.bg+';color:#fff;padding:11px 18px 11px 14px;border-radius:14px;font-size:13px;font-weight:600;z-index:99999;opacity:0;transition:all .35s cubic-bezier(.34,1.4,.64,1);pointer-events:none;max-width:min(420px,90vw);text-align:left;display:flex;align-items:center;gap:10px;box-shadow:0 10px 30px rgba(15,23,42,.18),0 4px 12px rgba(15,23,42,.08);letter-spacing:-.005em;line-height:1.4;backdrop-filter:blur(8px);';
  t.innerHTML = '<div style="flex-shrink:0;display:flex;align-items:center;">'+s.icon+'</div><div style="flex:1;">'+msg+'</div>';
  requestAnimationFrame(function(){
    t.style.opacity='1';
    t.style.transform='translateX(-50%) translateY(0) scale(1)';
  });
  clearTimeout(t._timer);
  t._timer=setTimeout(function(){
    t.style.opacity='0';
    t.style.transform='translateX(-50%) translateY(28px) scale(.95)';
  }, v === 'error' ? 4000 : 2800);
}


let _autoRefreshTimer = null;
document.addEventListener('visibilitychange', function(){
  if(document.hidden) return;
  if(typeof clScheduleQueueRefresh === 'function'){ window._clQueueDirty = true; clScheduleQueueRefresh(); }
});
function startAutoRefresh(){
  stopAutoRefresh();
  _autoRefreshTimer = setInterval(function(){
    if(document.hidden) return;
    loadNotifications();
    checkFeedbackInvites();
    const active = document.querySelector('.page.active');
    if(!active) return;
    if(active.id === 'page-calllog' && typeof clScheduleQueueRefresh === 'function'){
      window._clQueueDirty = true; clScheduleQueueRefresh();
    }
  }, 60000);
}
function stopAutoRefresh(){
  if(_autoRefreshTimer){ clearInterval(_autoRefreshTimer); _autoRefreshTimer=null; }
}
document.addEventListener('visibilitychange', function(){
  if(document.hidden) stopAutoRefresh();
  else { startAutoRefresh(); loadNotifications(); }
});


const _seenCache = {};



async function markNotifSeen(key){
  _seenCache[key] = true;
  localStorage.setItem('seen_'+me+'_'+key, '1');
  try{
    await fetch(SB+'/rest/v1/notification_seen?on_conflict=staff_name,notif_key',{
      method:'POST',
      headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'},
      body:JSON.stringify({staff_name:me, notif_key:key})
    });
  }catch(e){ console.warn('markNotifSeen failed:',e); }
}












let _realtimeChannels = [];

async function initRealtime(){
  console.log('[Realtime] initRealtime called, alreadyInit=', !!window._realtimeInitialized);
  if(window._realtimeInitialized) return;
  window._realtimeInitialized = true;
  if(!window.supabase){
    try{
      await new Promise(function(res,rej){
        const s=document.createElement('script');
        s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
        s.onload=res;
        s.onerror=function(err){ console.error('[Realtime] CDN load FAILED:', err); rej(err); };
        document.head.appendChild(s);
      });
    }catch(e){ console.error('[Realtime] Could not load supabase-js:',e); return; }
  }
  if(!window.supabase || !window.supabase.createClient){
    console.error('[Realtime] window.supabase exists but createClient missing');
    return;
  }
  try{
    _realtimeClient = window.supabase.createClient(SB, KEY);
    try{ if(_realtimeClient.realtime && _realtimeClient.realtime.setAuth) _realtimeClient.realtime.setAuth(window._sbAuthToken || KEY); }catch(e){}
    setupRealtimeChannels();
  }catch(e){ console.error('[Realtime] init failed:', e); }
}

  if(typeof flushClockSyncQueue === 'function') setTimeout(flushClockSyncQueue, 2000);
function setupRealtimeChannels(){
  _realtimeChannels.forEach(function(ch){ try{ _realtimeClient.removeChannel(ch); }catch(e){} });
  _realtimeChannels = [];

  const callCh = _realtimeClient.channel('calllog-live')
    .on('postgres_changes', {event:'*', schema:'public', table:'call_log'}, function(){
      window._clQueueDirty = true;
      if(typeof clScheduleQueueRefresh==='function') clScheduleQueueRefresh();
    })
    .subscribe();
  _realtimeChannels.push(callCh);

  const hkCh = _realtimeClient.channel('housekeeping-live')
    .on('postgres_changes', {event:'*', schema:'public', table:'housekeeping_roster'}, function(payload){
      const row = payload.new || payload.old;
      if(!row || !me) return;
      if(row.staff_name !== me) return;
      if(typeof loadHousekeepingDuty === 'function') loadHousekeepingDuty();
    })
    .subscribe();
  _realtimeChannels.push(hkCh);



  const leaveCh = _realtimeClient.channel('leave-live')
    .on('postgres_changes', {event:'UPDATE', schema:'public', table:'leave_submissions'}, function(payload){
      if(!me || typeof me !== 'string') return;
      if(!payload.new || !payload.new.staff_name) return;
      if(payload.new.staff_name !== me) return;
      const l = payload.new;
      if(l.status === 'approved' || l.status === 'declined'){
        const fireKey = 'rt_leave_'+l.id+'_'+l.status;
        if(!sessionStorage.getItem(fireKey)){
          sessionStorage.setItem(fireKey, '1');
          if(typeof NotifManager !== 'undefined') NotifManager.push({
            id: 'leave-'+l.id,
            type: l.status === 'approved' ? 'leave-approved' : 'leave-declined',
            title: l.status === 'approved' ? 'Leave approved' : 'Leave declined',
            body: (l.from_date||'') + (l.to_date ? ' to '+l.to_date : '') + (l.reason ? ' · '+l.reason : ''),
            ts: Date.now(),
            link: 'leave'
          });
        }
      }
      loadNotifications();
    })
    .subscribe();
  _realtimeChannels.push(leaveCh);

  const reactCh = _realtimeClient.channel('reactions-live')
    .subscribe();
  _realtimeChannels.push(reactCh);

  const replyCh = _realtimeClient.channel('reply-notifs-live')
    .subscribe();
  _realtimeChannels.push(replyCh);
}

function teardownRealtime(){
  if(_msgRealtimeCh){ try{ _realtimeClient&&_realtimeClient.removeChannel(_msgRealtimeCh); }catch(e){} _msgRealtimeCh=null; }
  _realtimeChannels.forEach(function(ch){ try{ _realtimeClient&&_realtimeClient.removeChannel(ch); }catch(e){} });
  _realtimeChannels = [];
}

function setVH(){
  const h = window.innerHeight;
  document.documentElement.style.setProperty('--vh', (h*0.01)+'px');
  document.documentElement.style.setProperty('--vhFull', h+'px');
}
setVH();
window.addEventListener('orientationchange', function(){ setTimeout(setVH, 200); });
window.addEventListener('resize', function(){
  if(window.innerWidth !== (window._lastW||0) ||
     window.innerHeight !== (window._lastH||0)){
    window._lastW = window.innerWidth;
    window._lastH = window.innerHeight;
    setVH();
  }
});
