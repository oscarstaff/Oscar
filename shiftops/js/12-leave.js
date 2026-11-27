// ── LEAVE REQUESTS ────────────────────────────────────────────────────────
function updateLeaveBadge(){
  const pending=leaveRequests.filter(r=>r.status==='pending').length;
  const subBadge=document.getElementById('leaveSubBadge');
  if(subBadge){
    if(pending>0){subBadge.textContent=pending;subBadge.style.display='inline';}
    else{subBadge.style.display='none';}
  }
}



// Count leave days excluding Sundays and days staff are unavailable
// Same counting rule as countLeaveDays, but with the real numbers: how many days the person would have worked, and how many
// calendar days the request covers (no "at least 1" floor).
function leaveDayInfo(fromStr, toStr, staffId){
  const from=new Date(fromStr+'T00:00:00'), to=new Date(toStr+'T00:00:00');
  if(isNaN(from)||isNaN(to)) return {work:1,span:1};
  let work=0, span=0; const cur=new Date(from);
  while(cur<=to){
    const dow=cur.getDay(); span++;
    if(dow!==0){
      const dayIdx=dow-1;
      const avail=staffId!=null?(availability[staffId]||{})[dayIdx]:null;
      if(!(avail&&avail.type==='no')) work++;
    }
    cur.setDate(cur.getDate()+1);
  }
  return {work:work, span:span};
}
function countLeaveDays(fromStr, toStr, staffId){
  const from=new Date(fromStr+'T00:00:00');
  const to=new Date(toStr+'T00:00:00');
  if(isNaN(from)||isNaN(to))return 1;
  let count=0;
  const cur=new Date(from);
  while(cur<=to){
    const dow=cur.getDay(); // 0=Sun, 1=Mon...
    if(dow!==0){ // skip Sundays
      // Check availability — day index Mon=0..Sat=5
      const dayIdx=dow===0?6:dow-1;
      const avail=staffId!=null?(availability[staffId]||{})[dayIdx]:null;
      const isUnavail=avail&&avail.type==='no';
      if(!isUnavail)count++;
    }
    cur.setDate(cur.getDate()+1);
  }
  return Math.max(1,count);
}

// The 8 leave types, with short labels + colours for the breakdown chips.
const LV_REASONS = [
  {key:'Time off / away',        short:'Time off',    col:'#64748b'},
  {key:'Sick leave',             short:'Sick',        col:'#be1e6d'},
  {key:'Medical appointment',    short:'Medical',     col:'#0369a1'},
  {key:"Family / carer's",       short:'Family',      col:'#c2410c'},
  {key:'Study / exam',           short:'Study',       col:'#6d28d9'},
  {key:'Travel',                 short:'Travel',      col:'#0f766e'},
  {key:'Family loss / funeral',  short:'Bereavement', col:'#475569'},
  {key:'Other',                  short:'Other',       col:'#8b93a3'}
];
function _lvReasonMeta(rt){
  return LV_REASONS.find(function(x){ return x.key===rt; }) ||
         {key:'Uncategorised', short:'Uncategorised', col:'#8b93a3'};
}
// Which reason is the summary filtered to ('' = all reasons).
window._leaveReasonFilter = window._leaveReasonFilter || '';
function setLeaveReasonFilter(rt){ window._leaveReasonFilter = rt; renderLeaveSummary(); }

function renderLeaveSummary(){
  const el=document.getElementById('leaveSummaryContent');
  if(!el)return;

  const reasonFilter = window._leaveReasonFilter || '';

  // Build per-staff summary keyed by name, now including a per-reason day tally.
  const summary={};
  staff.forEach(s=>{
    const name=`${s.first} ${s.last}`;
    summary[name]={name,color:s.color,approved:0,pending:0,declined:0,days:0,byReason:{}};
  });

  leaveRequests.forEach(r=>{
    let name=r.staffName||r.staff_name||'';
    if(!name&&r.staffId){
      const s=staff.find(x=>x.id===r.staffId);
      if(s)name=`${s.first} ${s.last}`;
    }
    if(!name)return;
    const existingKey=Object.keys(summary).find(k=>k.toLowerCase()===name.toLowerCase());
    const key=existingKey||name;
    if(!summary[key]){
      summary[key]={name:key,color:'#94a3b8',approved:0,pending:0,declined:0,days:0,byReason:{}};
    }
    const days=countLeaveDays(r.from||r.from_date||'',(r.to||r.to_date||''),(r.staffId||null));
    const status=r.status||'pending';
    // The reason label — untyped/old leave is grouped as 'Uncategorised'.
    const rt=(r.reason_type||'').trim()||'Uncategorised';
    summary[key][status]=(summary[key][status]||0)+1;
    if(status==='approved'){
      summary[key].days+=days;                                   // full total (all reasons)
      summary[key].byReason[rt]=(summary[key].byReason[rt]||0)+days;
    }
  });

  // When a reason filter is active, the "days" shown is that reason's days only,
  // so the bar and the number reflect exactly what you're focused on.
  const rows=Object.values(summary).map(function(r){
    const shownDays = reasonFilter ? (r.byReason[reasonFilter]||0) : r.days;
    return Object.assign({}, r, {shownDays:shownDays});
  }).sort((a,b)=>b.shownDays-a.shownDays||a.name.localeCompare(b.name));
  const maxDays=Math.max.apply(null,[1].concat(rows.map(r=>r.shownDays)));

  let html=`<div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
    <div>
      <div class="section-title">Leave Summary</div>
      <div style="font-family:var(--mono);font-size:9px;color:var(--text-dim);margin-top:3px">Approved days taken per staff member${reasonFilter?(' — showing '+_lvReasonMeta(reasonFilter).short+' only'):', broken down by reason'}</div>
    </div>
    <button class="btn btn-save" onclick="syncLeaveRequests()" style="font-size:11.5px">Sync from Staff</button>
  </div>`;

  // ── Reason filter chips: All + each reason ──
  html+=`<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
    <span style="font-family:var(--mono);font-size:9px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;padding:4px 2px">Reason:</span>`;
  html+=`<button onclick="setLeaveReasonFilter('')" style="padding:4px 11px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;background:${reasonFilter===''?'var(--accent)':'var(--surface)'};color:${reasonFilter===''?'#fff':'var(--text-dim)'};border:1px solid ${reasonFilter===''?'var(--accent-deep)':'var(--border)'}">All</button>`;
  LV_REASONS.forEach(function(rm){
    const on=reasonFilter===rm.key;
    html+=`<button onclick="setLeaveReasonFilter('${rm.key.replace(/'/g,"\\'")}')" style="padding:4px 11px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:5px;background:${on?rm.col:'var(--surface)'};color:${on?'#fff':'var(--text-dim)'};border:1px solid ${on?rm.col:'var(--border)'}"><i style="width:7px;height:7px;border-radius:50%;background:${on?'#fff':rm.col};display:inline-block"></i>${rm.short}</button>`;
  });
  html+=`</div>`;

  // Year filter (unchanged)
  const currentYear=new Date().getFullYear();
  html+=`<div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap">
    <div style="font-size:11px;font-weight:600;color:var(--text-dim);align-self:center">Year:</div>
    ${[currentYear,currentYear-1].map(y=>`<button onclick="filterLeaveSummaryYear(${y})" id="lsy-${y}" style="padding:4px 12px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:var(--mono);background:${y===currentYear?'var(--accent-dim)':'rgba(255,255,255,.04)'};color:${y===currentYear?'var(--accent)':'var(--text-dim)'};border:1px solid ${y===currentYear?'var(--accent-border)':'var(--border)'}">${y}</button>`).join('')}
  </div>`;

  if(!rows.some(r=>r.approved||r.pending)){
    html+=`<div style="text-align:center;padding:48px 20px;color:var(--text-dim)"><div style="font-size:14px;font-weight:600">No leave data yet</div><div style="font-size:12px;margin-top:6px;color:var(--muted)">Sync leave requests from the Staff Hub to see summaries</div></div>`;
    el.innerHTML=html;return;
  }

  html+=`<div style="background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:12px;overflow:hidden">`;
  html+=`<div style="display:grid;grid-template-columns:180px 1fr 70px 70px 70px;gap:8px;padding:10px 16px;background:rgba(255,255,255,.025);border-bottom:1px solid var(--border)">
    <div style="font-family:var(--mono);font-size:8px;font-weight:700;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase">Staff Member</div>
    <div style="font-family:var(--mono);font-size:8px;font-weight:700;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase">${reasonFilter?(_lvReasonMeta(reasonFilter).short+' days'):'Days Taken · by reason'}</div>
    <div style="font-family:var(--mono);font-size:8px;font-weight:700;letter-spacing:1.5px;color:var(--accent);text-transform:uppercase;text-align:center">Approved</div>
    <div style="font-family:var(--mono);font-size:8px;font-weight:700;letter-spacing:1.5px;color:#f9a825;text-transform:uppercase;text-align:center">Pending</div>
    <div style="font-family:var(--mono);font-size:8px;font-weight:700;letter-spacing:1.5px;color:var(--warn);text-transform:uppercase;text-align:center">Declined</div>
  </div>`;

  rows.forEach(r=>{
    const pct=maxDays>0?(r.shownDays/maxDays)*100:0;
    const ava=r.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    // Per-reason breakdown line: "60 Time off · 30 Sick · 10 Study", coloured.
    // Ordered biggest first so the dominant reason reads immediately.
    const parts=Object.keys(r.byReason)
      .map(function(rt){ return {rt:rt, d:r.byReason[rt], meta:_lvReasonMeta(rt)}; })
      .filter(function(p){ return p.d>0 && (!reasonFilter || p.rt===reasonFilter); })
      .sort(function(a,b){ return b.d-a.d; });
    const breakdown = parts.length
      ? '<div style="display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:5px">'+
        parts.map(function(p){
          return '<span style="font-family:var(--mono);font-size:9.5px;color:'+p.meta.col+';font-weight:700;display:inline-flex;align-items:center;gap:4px"><i style="width:6px;height:6px;border-radius:50%;background:'+p.meta.col+';display:inline-block"></i>'+p.d+' '+p.meta.short+'</span>';
        }).join('')+
        '</div>'
      : '';
    html+=`<div style="display:grid;grid-template-columns:180px 1fr 70px 70px 70px;gap:8px;padding:11px 16px;border-bottom:1px solid var(--border);align-items:start" onmouseover="this.style.background='rgba(255,255,255,.025)'" onmouseout="this.style.background=''">
      <div style="display:flex;align-items:center;gap:8px;padding-top:2px">
        <div class="avatar" style="background:${r.color};width:26px;height:26px;font-size:8px;flex-shrink:0">${ava}</div>
        <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.name}</div>
      </div>
      <div style="padding-right:12px">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="flex:1;background:rgba(255,255,255,.06);border-radius:3px;height:6px;overflow:hidden">
            <div style="height:100%;border-radius:3px;background:${r.shownDays>15?'var(--warn)':r.shownDays>7?'var(--gold)':'var(--accent)'};width:${pct}%;transition:width .4s cubic-bezier(.25,.8,.4,1)"></div>
          </div>
          <div style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--text);min-width:28px">${r.shownDays}d</div>
        </div>
        ${breakdown}
      </div>
      <div style="text-align:center;font-family:var(--mono);font-size:12px;font-weight:700;color:${r.approved?'var(--accent)':'var(--muted)'};padding-top:2px">${r.approved||'—'}</div>
      <div style="text-align:center;font-family:var(--mono);font-size:12px;font-weight:700;color:${r.pending?'#f9a825':'var(--muted)'};padding-top:2px">${r.pending||'—'}</div>
      <div style="text-align:center;font-family:var(--mono);font-size:12px;font-weight:700;color:${r.declined?'var(--warn)':'var(--muted)'};padding-top:2px">${r.declined||'—'}</div>
    </div>`;
  });
  html+=`</div>`;

  el.innerHTML=html;
}

let leaveSummaryYear=new Date().getFullYear();
function filterLeaveSummaryYear(yr){
  leaveSummaryYear=yr;
  // Update button styles
  [new Date().getFullYear(), new Date().getFullYear()-1].forEach(y=>{
    const btn=document.getElementById('lsy-'+y);
    if(!btn)return;
    const active=y===yr;
    btn.style.background=active?'var(--accent-dim)':'rgba(255,255,255,.04)';
    btn.style.color=active?'var(--accent)':'var(--text-dim)';
    btn.style.border=`1px solid ${active?'var(--accent-border)':'var(--border)'}`;
  });
  renderLeaveSummary();
}

function setLeaveStatusFilter(st){ window._leaveStatusFilter = st; renderLeave(); }
// Leave proof viewer. Full-screen, in the app. A separate file opens only from "Open file".
// Opens out of the button you pressed and closes back into it. Pinch, double-tap or scroll to zoom, drag to pan,
// drag down (or up) to dismiss. Every move is a spring that starts from where the picture is right now,
// so you can grab it mid-flight. The gateway returns the file only to the person who attached it or a hub admin.
let _lpUrl=null,_lpSeq=0,_lpOpen=false,_lpClosing=false,_lpKind='',_lpChromeOn=true,_lpSrcEl=null,_lpTapT=0,_lpLastTap=null,_lpG=null,_lpPrevFocus=null,_lpRetry=null;
let _lpReqId=null;
const _lpCache={},_lpOrder=[],_lpE={},_lpAnims={},_lpPtrs=new Map();
const _lpV={x:0,y:0,s:1,bg:0,ch:0,mo:0};
const _lpReduce=function(){ return !!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches); };
const _LP_SVG=function(d,n){ return '<svg width="'+(n||20)+'" height="'+(n||20)+'" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+d+'</svg>'; };
const _LP_IC={
  x:_LP_SVG('<path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/>'),
  open:_LP_SVG('<path d="M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3M11 4h5v5M16 4l-7 7"/>',17),
  warn:_LP_SVG('<path d="M10 6.2v4.6M10 13.6v.01"/><circle cx="10" cy="10" r="7.2"/>',26)
};

/* ---------- springs ---------- */
// response = seconds to reach the target. damping 1 = no bounce, below 1 bounces a little.
function _lpSpringTo(key,target,vel,o,done){
  if(_lpAnims[key]) _lpAnims[key]();
  if(_lpReduce()){ _lpV[key]=target; _lpRender(); if(done) done(); return; }
  const z=(o&&o.z!=null)?o.z:1, r=(o&&o.r)||.4, w=2*Math.PI/r, k=w*w, c=2*z*w;
  const px=(key==='x'||key==='y');
  const eps=(o&&o.eps)||(px?.3:.001), veps=(o&&o.veps)||(px?6:.02);
  let x=_lpV[key], v=vel||0, last=performance.now(), raf=0, dead=false;
  function step(t){
    if(dead) return;
    const dt=Math.min((t-last)/1000,.034); last=t;
    const n=Math.max(1,Math.ceil(dt/.004)), h=dt/n;
    for(let i=0;i<n;i++){ v+=(-k*(x-target)-c*v)*h; x+=v*h; }
    _lpV[key]=x; _lpRender();
    if(Math.abs(x-target)<eps && Math.abs(v)<veps){ _lpV[key]=target; _lpRender(); delete _lpAnims[key]; if(done) done(); return; }
    raf=requestAnimationFrame(step);
  }
  raf=requestAnimationFrame(step);
  _lpAnims[key]=function(){ dead=true; cancelAnimationFrame(raf); delete _lpAnims[key]; };
}
function _lpStop(keys){ (keys||Object.keys(_lpAnims)).forEach(function(k){ if(_lpAnims[k]) _lpAnims[k](); }); }
// where a flick would come to rest (scroll-style deceleration)
function _lpProject(v,d){ d=d||.998; return (v/1000)*d/(1-d); }
function _lpRub(o,dim){ const c=.55; return (o*dim*c)/(dim+c*Math.abs(o)); }
function _lpClamp(v,a,b){ return Math.max(a,Math.min(b,v)); }

function _lpRender(){
  if(!_lpE.bg) return;
  _lpE.bg.style.opacity=_lpV.bg;
  const c=_lpClamp(_lpV.ch,0,1);
  _lpE.top.style.opacity=c; _lpE.bar.style.opacity=c;
  const off=c<.05?'none':'';
  _lpE.top.style.pointerEvents=off; _lpE.bar.style.pointerEvents=off;
  const m=_lpE.media;
  if(m){ m.style.transform='translate3d('+_lpV.x+'px,'+_lpV.y+'px,0) scale('+_lpV.s+')'; m.style.opacity=_lpClamp(_lpV.mo,0,1); }
}

/* ---------- styles ---------- */
function _lpCss(){
  if(document.getElementById('lpStyle')) return;
  const s=document.createElement('style'); s.id='lpStyle';
  s.textContent=
  '#leaveProofOverlay{--lp-pad:104px;position:fixed;inset:0;z-index:99990;display:none;color:#fff;touch-action:none;overscroll-behavior:contain;-webkit-tap-highlight-color:transparent;-webkit-font-smoothing:antialiased;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter",system-ui,"Segoe UI",sans-serif;}'+
  '#leaveProofOverlay.open{display:block;}'+
  '#leaveProofOverlay.closing{pointer-events:none;}'+
  '#leaveProofOverlay.pdf{touch-action:auto;}'+
  '#leaveProofOverlay #lpBg{position:absolute;inset:0;background:rgba(0,0,0,.9);-webkit-backdrop-filter:blur(30px) saturate(150%);backdrop-filter:blur(30px) saturate(150%);opacity:0;}'+
  '#leaveProofOverlay .lp-stage{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;overflow:hidden;}'+
  '#leaveProofOverlay.pdf .lp-stage{pointer-events:none;}'+
  '#leaveProofOverlay.pdf .lp-stage .lp-media{pointer-events:auto;}'+
  '#leaveProofOverlay img.lp-media{max-width:calc(100% - 32px);max-height:calc(100% - var(--lp-pad) * 2);object-fit:contain;border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.5),0 0 0 .5px rgba(255,255,255,.1);cursor:grab;user-select:none;-webkit-user-select:none;-webkit-user-drag:none;will-change:transform,opacity;opacity:0;}'+
  '#leaveProofOverlay .lp-pdf{width:min(940px,calc(100% - 32px));height:calc(100% - var(--lp-pad) * 2);border-radius:14px;overflow:hidden;background:#fff;box-shadow:0 18px 50px rgba(0,0,0,.5);will-change:transform,opacity;opacity:0;}'+
  '#leaveProofOverlay .lp-pdf iframe{width:100%;height:100%;border:0;display:block;}'+
  /* chrome */
  '#leaveProofOverlay .lp-top{position:absolute;top:0;left:0;right:0;z-index:2;display:flex;align-items:center;gap:12px;padding:max(12px,env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) 28px max(14px,env(safe-area-inset-left));background:linear-gradient(rgba(0,0,0,.5),rgba(0,0,0,0));opacity:0;}'+
  '#leaveProofOverlay .lp-head{min-width:0;flex:1;}'+
  '#leaveProofOverlay .lp-title{font-size:17px;font-weight:600;letter-spacing:-.022em;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'+
  '#leaveProofOverlay .lp-sub{font-size:13px;font-weight:500;letter-spacing:-.006em;color:rgba(235,235,245,.66);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'+
  '#leaveProofOverlay .lp-chip{display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;font-size:11.5px;font-weight:600;letter-spacing:.01em;vertical-align:2px;}'+
  '#leaveProofOverlay .lp-chip.pending{background:rgba(255,214,10,.17);color:#ffd60a;}'+
  '#leaveProofOverlay .lp-chip.approved{background:rgba(48,209,88,.17);color:#32d74b;}'+
  '#leaveProofOverlay .lp-chip.declined{background:rgba(255,69,58,.17);color:#ff6961;}'+
  '#leaveProofOverlay .lp-mat,#leaveProofOverlay .lp-glass{background:rgba(58,58,60,.55);-webkit-backdrop-filter:blur(24px) saturate(180%);backdrop-filter:blur(24px) saturate(180%);box-shadow:inset 0 .5px 0 rgba(255,255,255,.22),0 0 0 .5px rgba(255,255,255,.1),0 6px 20px rgba(0,0,0,.28);}'+
  '#leaveProofOverlay .lp-glass{border:0;color:#fff;font-family:inherit;cursor:pointer;transition:transform .12s ease-out,background .2s;}'+
  '#leaveProofOverlay .lp-glass:hover{background:rgba(84,84,88,.62);}'+
  '#leaveProofOverlay .lp-glass:active{transform:scale(.94);background:rgba(110,110,116,.62);transition-duration:.06s;}'+
  '#leaveProofOverlay .lp-glass:focus-visible,#leaveProofOverlay .lp-act:focus-visible{outline:2px solid #64d2ff;outline-offset:2px;}'+
  '#leaveProofOverlay .lp-glass:disabled{opacity:.4;cursor:default;pointer-events:none;}'+
  '#leaveProofOverlay .lp-circle{width:44px;height:44px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex:none;padding:0;}'+
  '#leaveProofOverlay .lp-pill{height:44px;padding:0 16px 0 14px;border-radius:22px;display:inline-flex;align-items:center;gap:7px;font-size:15px;font-weight:600;letter-spacing:-.011em;flex:none;white-space:nowrap;}'+
  '#leaveProofOverlay .lp-bar{position:absolute;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:2;width:min(440px,calc(100% - 28px));display:flex;gap:6px;padding:6px;border-radius:28px;opacity:0;}'+
  '#leaveProofOverlay .lp-act{flex:1;height:46px;border-radius:22px;border:0;font-family:inherit;font-size:16px;font-weight:600;letter-spacing:-.011em;color:#fff;background:rgba(255,255,255,.1);cursor:pointer;white-space:nowrap;transition:transform .12s ease-out,background .2s,filter .2s;}'+
  '#leaveProofOverlay .lp-act:hover{background:rgba(255,255,255,.17);}'+
  '#leaveProofOverlay .lp-act:active{transform:scale(.95);transition-duration:.06s;}'+
  '#leaveProofOverlay .lp-act.no{background:rgba(255,69,58,.17);color:#ff6961;}'+
  '#leaveProofOverlay .lp-act.no:hover{background:rgba(255,69,58,.27);}'+
  '#leaveProofOverlay .lp-act.ok{background:#30d158;color:#04210c;}'+
  '#leaveProofOverlay .lp-act.ok:hover{background:#3ddc66;}'+
  '#leaveProofOverlay .lp-act.ok:active{background:#27b84c;}'+
  /* loading and error */
  '#leaveProofOverlay .lp-state{text-align:center;color:rgba(235,235,245,.62);font-size:14px;line-height:1.45;max-width:320px;padding:24px;}'+
  '#leaveProofOverlay .lp-state b{display:block;color:#fff;font-size:17px;font-weight:600;letter-spacing:-.022em;margin:10px 0 4px;}'+
  '#leaveProofOverlay .lp-state .lp-glass{margin-top:18px;}'+
  '#leaveProofOverlay .lp-spin{width:30px;height:30px;margin:0 auto 14px;border-radius:50%;border:2.5px solid rgba(255,255,255,.16);border-top-color:rgba(255,255,255,.85);animation:lpSpin .75s linear infinite;}'+
  '#leaveProofOverlay .lp-fadein{animation:lpFade .3s .18s both;}'+
  '@keyframes lpSpin{to{transform:rotate(360deg);}}@keyframes lpFade{from{opacity:0}to{opacity:1}}'+
  '@media (max-width:480px){#leaveProofOverlay .lp-pill span{display:none;}#leaveProofOverlay .lp-pill{width:44px;padding:0;justify-content:center;}}'+
  '@media (prefers-reduced-motion:reduce){#leaveProofOverlay.open #lpBg,#leaveProofOverlay.open .lp-top,#leaveProofOverlay.open .lp-bar,#leaveProofOverlay.open .lp-media{transition:opacity .2s;}#leaveProofOverlay .lp-spin{animation-duration:2s;}}'+
  '@media (prefers-reduced-transparency:reduce){#leaveProofOverlay #lpBg{background:#000;-webkit-backdrop-filter:none;backdrop-filter:none;}#leaveProofOverlay .lp-mat,#leaveProofOverlay .lp-glass{background:#2c2c2e;-webkit-backdrop-filter:none;backdrop-filter:none;}}'+
  '@media (prefers-contrast:more){#leaveProofOverlay .lp-mat,#leaveProofOverlay .lp-glass{background:#1c1c1e;box-shadow:0 0 0 1px rgba(255,255,255,.6);}#leaveProofOverlay .lp-sub{color:#fff;}}';
  document.head.appendChild(s);
}

/* ---------- overlay ---------- */
function _lpOverlay(){
  _lpCss();
  let ov=document.getElementById('leaveProofOverlay');
  if(ov) return ov;
  ov=document.createElement('div');
  ov.id='leaveProofOverlay'; ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true'); ov.setAttribute('aria-labelledby','lpTitle');
  ov.innerHTML='<div id="lpBg"></div>'
    +'<div class="lp-stage" id="lpStage"><div class="lp-state" id="lpState"></div></div>'
    +'<div class="lp-top" id="lpTop">'
    +'<button type="button" class="lp-glass lp-circle" id="lpClose" aria-label="Close" onclick="closeLeaveProof()">'+_LP_IC.x+'</button>'
    +'<div class="lp-head"><div class="lp-title"><span id="lpTitle">Leave proof</span><span id="lpChip"></span></div><div class="lp-sub" id="lpSub"></div></div>'
    +'<button type="button" class="lp-glass lp-pill" id="lpOpen" disabled aria-label="Open file in a new tab" onclick="openLeaveProofFile()">'+_LP_IC.open+'<span>Open file</span></button>'
    +'</div>'
    +'<div class="lp-mat lp-bar" id="lpBar"><button type="button" class="lp-act no" id="lpDecline" onclick="_lpAct(\'decline\')">Decline</button><button type="button" class="lp-act" id="lpEdit" onclick="_lpAct(\'edit\')">Edit</button><button type="button" class="lp-act ok" id="lpApprove" onclick="_lpAct(\'approve\')">Approve</button></div>';
  document.body.appendChild(ov);
  _lpE.ov=ov; _lpE.bg=ov.querySelector('#lpBg'); _lpE.stage=ov.querySelector('#lpStage'); _lpE.state=ov.querySelector('#lpState');
  _lpE.top=ov.querySelector('#lpTop'); _lpE.bar=ov.querySelector('#lpBar')||document.createElement('div'); _lpE.close=ov.querySelector('#lpClose'); _lpE.open=ov.querySelector('#lpOpen');
  _lpBind(_lpE.stage);
  document.addEventListener('keydown',function(e){ if(e.key==='Escape' && _lpOpen) closeLeaveProof(); });
  return ov;
}

/* ---------- gestures ---------- */
function _lpFC(e){ const r=_lpE.stage.getBoundingClientRect(); return {x:e.clientX-(r.left+r.width/2), y:e.clientY-(r.top+r.height/2)}; }
function _lpCentroid(p){ let x=0,y=0; p.forEach(function(q){x+=q.x;y+=q.y;}); return {x:x/p.length,y:y/p.length}; }
function _lpBounds(s){
  const m=_lpE.media; if(!m) return {mx:0,my:0};
  return {mx:Math.max(0,(m.offsetWidth*s-_lpE.stage.clientWidth)/2), my:Math.max(0,(m.offsetHeight*s-_lpE.stage.clientHeight)/2)};
}
// Keeps the point under your fingers fixed while you pan and pinch.
function _lpBase(){
  const pts=Array.from(_lpPtrs.values());
  if(!pts.length){ _lpG=null; return; }
  const c=_lpCentroid(pts), prev=_lpG;
  _lpG={
    s0:_lpV.s, x0:_lpV.x, y0:_lpV.y, c0:c, mode:'',
    q:{x:(c.x-_lpV.x)/_lpV.s, y:(c.y-_lpV.y)/_lpV.s},
    d0:pts.length>1?Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y):0,
    moved:prev?prev.moved:false, multi:pts.length>1||(prev?prev.multi:false), hist:[]
  };
}
function _lpBind(st){
  st.addEventListener('pointerdown',function(e){
    if(_lpKind!=='img'||!_lpE.media||_lpClosing) return;
    if(e.pointerType==='mouse'&&e.button!==0) return;
    _lpStop(['x','y','s','mo']);                    // grab it mid-flight
    try{ st.setPointerCapture(e.pointerId); }catch(_){}
    _lpPtrs.set(e.pointerId,_lpFC(e));
    _lpBase();
  });
  st.addEventListener('pointermove',function(e){
    const G=_lpG; if(!G||!_lpPtrs.has(e.pointerId)) return;
    _lpPtrs.set(e.pointerId,_lpFC(e));
    const pts=Array.from(_lpPtrs.values()), c=_lpCentroid(pts), now=performance.now();
    G.hist.push({t:now,x:c.x,y:c.y}); while(G.hist.length>2&&now-G.hist[0].t>100) G.hist.shift();
    const dx=c.x-G.c0.x, dy=c.y-G.c0.y;
    if(!G.moved){ if(Math.hypot(dx,dy)<=8&&pts.length<2) return; G.moved=true; }
    const H=_lpE.stage.clientHeight, W=_lpE.stage.clientWidth;
    if(pts.length>1){
      G.mode='zoom';
      let s=G.s0*Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y)/(G.d0||1);
      if(s>6) s=6+_lpRub(s-6,6); else if(s<1) s=1-_lpRub(1-s,1);
      _lpV.s=s; _lpV.x=c.x-G.q.x*s; _lpV.y=c.y-G.q.y*s; _lpV.bg=1;
    }else{
      if(!G.mode) G.mode=(G.s0>1.06)?'pan':(Math.abs(dy)>=Math.abs(dx)?'dismiss':'idle');
      if(G.mode==='pan'){
        let x=c.x-G.q.x*G.s0, y=c.y-G.q.y*G.s0;
        const b=_lpBounds(G.s0);
        if(Math.abs(x)>b.mx) x=Math.sign(x)*(b.mx+_lpRub(Math.abs(x)-b.mx,W));
        if(Math.abs(y)>b.my) y=Math.sign(y)*(b.my+_lpRub(Math.abs(y)-b.my,H));
        _lpV.x=x; _lpV.y=y;
      }else if(G.mode==='dismiss'){
        const y=G.y0+dy, p=Math.min(1,Math.abs(y)/(H*.5));
        _lpV.x=G.x0+dx; _lpV.y=y; _lpV.s=1-.3*p; _lpV.bg=1-p; _lpV.ch=_lpChromeOn?1-Math.min(1,p*3):0;
      }
    }
    _lpRender();
  });
  const up=function(e){
    if(!_lpPtrs.has(e.pointerId)) return;
    const G=_lpG;
    _lpPtrs.delete(e.pointerId);
    if(_lpPtrs.size>0){ _lpBase(); return; }
    _lpG=null; if(!G) return;
    let vx=0,vy=0; const h=G.hist;
    if(e.type!=='pointercancel'&&h.length>1&&performance.now()-h[h.length-1].t<120){
      const a=h[0],b=h[h.length-1],dt=Math.max(16,b.t-a.t)/1000; vx=(b.x-a.x)/dt; vy=(b.y-a.y)/dt;
    }
    if(!G.moved&&!G.multi){ if(e.type!=='pointercancel') _lpTap(G.c0); return; }
    if(G.mode==='dismiss'){
      const H=_lpE.stage.clientHeight, py=_lpV.y+_lpProject(vy,.99);
      if(Math.abs(py)>H*.3) _lpFinish({vx:vx,vy:vy}); else _lpSettle(vx,vy);
    }else _lpSettle(vx,vy);
  };
  st.addEventListener('pointerup',up); st.addEventListener('pointercancel',up);
  st.addEventListener('wheel',function(e){
    if(_lpKind!=='img'||!_lpE.media||_lpClosing) return;
    e.preventDefault(); _lpStop(['x','y','s']);
    const f=_lpFC(e), s=_lpV.s, sT=_lpClamp(s*Math.exp(-e.deltaY*(e.ctrlKey?.012:.0022)),1,6);
    const q={x:(f.x-_lpV.x)/s,y:(f.y-_lpV.y)/s}, b=_lpBounds(sT);
    _lpV.s=sT; _lpV.x=sT===1?0:_lpClamp(f.x-q.x*sT,-b.mx,b.mx); _lpV.y=sT===1?0:_lpClamp(f.y-q.y*sT,-b.my,b.my); _lpRender();
  },{passive:false});
}
// After pinch or pan: snap near 1x, clamp to 6x, glide into bounds carrying the flick.
function _lpSettle(vx,vy){
  const s=_lpV.s, sT=s<1.06?1:Math.min(6,s);
  let tx=_lpV.x, ty=_lpV.y, ms=_lpV.mo;
  if(sT===1){ tx=0; ty=0; }
  else{
    const b=_lpBounds(sT);
    if(sT===s){ tx+=_lpProject(vx,.99); ty+=_lpProject(vy,.99); } else { tx*=sT/s; ty*=sT/s; }
    tx=_lpClamp(tx,-b.mx,b.mx); ty=_lpClamp(ty,-b.my,b.my);
  }
  const bounce=Math.hypot(vx,vy)>400?.82:1;
  _lpSpringTo('x',tx,vx,{z:bounce,r:.4}); _lpSpringTo('y',ty,vy,{z:bounce,r:.4});
  _lpSpringTo('s',sT,0,{z:1,r:.36}); _lpSpringTo('bg',1,0,{z:1,r:.3}); _lpSpringTo('ch',_lpChromeOn?1:0,0,{z:1,r:.3});
}
function _lpTap(f){
  const now=performance.now();
  if(_lpLastTap&&now-_lpLastTap.t<300&&Math.hypot(f.x-_lpLastTap.x,f.y-_lpLastTap.y)<28){
    clearTimeout(_lpTapT); _lpLastTap=null; _lpZoomAt(f); return;
  }
  _lpLastTap={t:now,x:f.x,y:f.y};
  clearTimeout(_lpTapT);
  _lpTapT=setTimeout(function(){ _lpLastTap=null; _lpToggleChrome(); },260);
}
function _lpZoomAt(f){
  const s=_lpV.s, sT=s>1.05?1:2.6;
  let tx=0,ty=0;
  if(sT!==1){ const q={x:(f.x-_lpV.x)/s,y:(f.y-_lpV.y)/s}, b=_lpBounds(sT); tx=_lpClamp(f.x-q.x*sT,-b.mx,b.mx); ty=_lpClamp(f.y-q.y*sT,-b.my,b.my); }
  _lpSpringTo('x',tx,0,{z:1,r:.42}); _lpSpringTo('y',ty,0,{z:1,r:.42}); _lpSpringTo('s',sT,0,{z:1,r:.42});
}
function _lpToggleChrome(){ if(!_lpOpen||_lpKind!=='img') return; _lpChromeOn=!_lpChromeOn; _lpSpringTo('ch',_lpChromeOn?1:0,0,{z:1,r:.3}); }

/* ---------- open / close ---------- */
function _lpResetMedia(){ if(_lpE.media){ _lpE.media.remove(); _lpE.media=null; } _lpKind=''; _lpUrl=null; }
function openLeaveProofFile(){ if(_lpUrl) window.open(_lpUrl,'_blank'); }
function _lpHideOverlay(){
  _lpStop(); _lpResetMedia(); _lpClosing=false;
  if(_lpE.ov){ _lpE.ov.classList.remove('open','pdf','closing'); }
  _lpV.x=0;_lpV.y=0;_lpV.s=1;_lpV.bg=0;_lpV.ch=0;_lpV.mo=0;
  if(_lpE.open) _lpE.open.disabled=true;
  _lpReqId=null;
  if(_lpPrevFocus&&_lpPrevFocus.isConnected){ try{ _lpPrevFocus.focus({preventScroll:true}); }catch(_){} }
  _lpPrevFocus=null;
}
// Leaves the way it came in: back into the button that opened it (or fades out if that is gone).
function _lpFinish(vel){ closeLeaveProof(vel); }
function closeLeaveProof(o){
  if(!_lpOpen) return;
  _lpOpen=false; _lpClosing=true; _lpE.ov.classList.add('closing'); clearTimeout(_lpTapT); _lpLastTap=null; _lpPtrs.clear(); _lpG=null;
  const tok=++_lpSeq, done=function(){ if(tok===_lpSeq) _lpHideOverlay(); };
  _lpStop();
  if(_lpReduce()){ _lpV.bg=0;_lpV.ch=0;_lpV.mo=0; _lpRender(); setTimeout(done,200); return; }
  const m=_lpE.media, vx=(o&&o.vx)||0, vy=(o&&o.vy)||0;
  if(m){
    let tx=_lpV.x, ty=_lpV.y, ts=_lpV.s*.94;
    if(!(o&&o.quick)){
      const p=_lpSrcPoint();
      if(p){ tx=p.x; ty=p.y; ts=.26; } else { ty=_lpV.y+(vy>=0?1:-1)*_lpE.stage.clientHeight*.35; ts=.8; }
    }
    _lpSpringTo('x',tx,vx,{z:1,r:.36}); _lpSpringTo('y',ty,vy,{z:1,r:.36}); _lpSpringTo('s',ts,0,{z:1,r:.36});
    _lpSpringTo('mo',0,0,{z:1,r:.3});
  }
  _lpSpringTo('ch',0,0,{z:1,r:.22});
  _lpSpringTo('bg',0,0,{z:1,r:.3,eps:.012,veps:.2},done);
}
function _lpSrcPoint(){
  if(!_lpSrcEl||!_lpSrcEl.isConnected) return null;
  const r=_lpSrcEl.getBoundingClientRect(); if(!r.width&&!r.height) return null;
  const st=_lpE.stage.getBoundingClientRect();
  return {x:r.left+r.width/2-(st.left+st.width/2), y:r.top+r.height/2-(st.top+st.height/2)};
}

// Fetched once per file and kept for the session, so reopening is instant. Hovering or touching
// "View proof" starts the fetch early. The last 6 files are kept.
function _lpFetch(fileId){
  if(_lpCache[fileId]) return _lpCache[fileId];
  const p=(async function(){
    const r=await fetch(GAS_EXEC_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getLeaveProof',token:GAS_TOKEN,sbAccessToken:_soTok(),fileId:fileId})});
    let j=null; try{ j=await r.json(); }catch(_e){}
    if(!r.ok||!j||!j.ok){   // keep the real reason: the viewer shows it and the console logs it
      const why=(j&&(j.error||j.message))?String(j.error||j.message):(r.ok?'the Drive gateway sent back something unreadable':'the Drive gateway returned HTTP '+r.status);
      try{ console.warn('[leave proof]', why, j&&{ok:j.ok}); }catch(_e){}
      throw new Error(why);
    }
    const bin=atob(j.base64), u8=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);
    return {url:URL.createObjectURL(new Blob([u8],{type:j.mime})), mime:String(j.mime), kb:Math.max(1,Math.round(bin.length/1024))};
  })();
  _lpCache[fileId]=p;
  _lpOrder.push(fileId);
  p.catch(function(){ delete _lpCache[fileId]; const i=_lpOrder.indexOf(fileId); if(i>=0) _lpOrder.splice(i,1); });
  while(_lpOrder.length>6){
    const old=_lpOrder.shift(), op=_lpCache[old]; delete _lpCache[old];
    if(op) op.then(function(o){ if(o.url!==_lpUrl) URL.revokeObjectURL(o.url); }).catch(function(){});
  }
  return p;
}
function prefetchLeaveProof(fileId){ _lpFetch(fileId).catch(function(){}); }

function _lpShowState(html){ _lpE.state.style.display=''; _lpE.state.innerHTML=html; }
async function _lpMount(o,seq){
  const isImg=o.mime.indexOf('image/')===0;
  let el;
  if(isImg){ el=document.createElement('img'); el.src=o.url; el.alt='Leave proof'; el.draggable=false; el.className='lp-media'; try{ await el.decode(); }catch(_){} }
  else{ el=document.createElement('div'); el.className='lp-pdf lp-media'; el.innerHTML='<iframe src="'+o.url+'" title="Leave proof"></iframe>'; }
  if(seq!==_lpSeq) return;
  _lpKind=isImg?'img':'pdf'; _lpUrl=o.url; _lpE.ov.classList.toggle('pdf',!isImg);
  if(!isImg){ _lpChromeOn=true; _lpSpringTo('ch',1,0,{z:1,r:.3}); }
  _lpE.state.style.display='none';
  _lpE.stage.insertBefore(el,_lpE.stage.firstChild); _lpE.media=el;
  // start from the button that opened it, then spring to rest
  let sx=0,sy=0,ss=.92; const p=_lpSrcPoint(); if(p){ sx=p.x; sy=p.y; ss=.26; }
  _lpV.x=_lpReduce()?0:sx; _lpV.y=_lpReduce()?0:sy; _lpV.s=_lpReduce()?1:ss; _lpV.mo=0; _lpRender(); void el.offsetWidth;
  _lpSpringTo('x',0,0,{z:1,r:.46}); _lpSpringTo('y',0,0,{z:1,r:.46}); _lpSpringTo('s',1,0,{z:1,r:.46}); _lpSpringTo('mo',1,0,{z:1,r:.26});
  _lpE.open.disabled=false;
  _lpHead('ready',o);
}
async function _lpView(fileId){
  const ev=window.event;
  let src=null; if(ev&&ev.currentTarget&&ev.currentTarget.nodeType===1) src=ev.currentTarget; else if(ev&&ev.target&&ev.target.closest) src=ev.target.closest('button,a');
  const ov=_lpOverlay();
  if(src&&!ov.contains(src)) _lpSrcEl=src;
  const seq=++_lpSeq;
  if(!_lpOpen){
    _lpStop(); _lpResetMedia(); _lpClosing=false; _lpOpen=true;
    _lpPrevFocus=document.activeElement;
    ov.classList.remove('pdf','closing'); ov.classList.add('open');
    _lpChromeOn=true; _lpV.x=0;_lpV.y=0;_lpV.s=1;_lpV.bg=0;_lpV.ch=0;_lpV.mo=0; _lpRender(); void ov.offsetWidth;
    _lpSpringTo('bg',1,0,{z:1,r:.4}); _lpSpringTo('ch',1,0,{z:1,r:.5});
    try{ _lpE.close.focus({preventScroll:true}); }catch(_){}
  }else{ _lpResetMedia(); ov.classList.remove('pdf'); }
  _lpRetry=function(){ _lpView(fileId); };
  _lpE.open.disabled=true;
  _lpHead('loading');
  _lpShowState('<div class="lp-fadein"><div class="lp-spin"></div>Fetching from Drive</div>');
  try{
    const o=await _lpFetch(fileId);
    if(seq!==_lpSeq) return;
    await _lpMount(o,seq);
  }catch(e){
    if(seq!==_lpSeq) return;
    _lpHead('error');
    _lpShowState('<div style="color:#ff9f0a;">'+_LP_IC.warn+'</div><b>Can’t open this proof</b>It may have been removed, or only the person who attached it and hub admins can open it.<div style="margin-top:8px;font-size:11.5px;opacity:.75;word-break:break-word;">Reason: '+String((e&&e.message)||'unknown').replace(/[<>&]/g,'')+'</div><div><button type="button" class="lp-glass lp-pill" onclick="_lpRetry&&_lpRetry()"><span style="display:inline">Try again</span></button></div>');
  }
}

function _lpDate(d){ return new Date(d).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'}); }
function _lpHead(phase){
  const r=(_lpReqId!=null)?leaveRequests.find(x=>x.id===_lpReqId):null;
  const g=function(id){ return document.getElementById(id); };
  g('lpDecline').style.display=(r && r.status!=='declined')?'':'none';
  g('lpApprove').style.display=(r && r.status!=='approved')?'':'none';
  g('lpEdit').style.display=r?'':'none';
  _lpE.bar.style.display=r?'':'none';
  if(r){
    const st=({approved:1,declined:1})[r.status]?r.status:'pending';
    g('lpTitle').textContent=r.staffName||r.staff_name||'Leave request';
    g('lpChip').innerHTML='<span class="lp-chip '+st+'">'+st.charAt(0).toUpperCase()+st.slice(1)+'</span>';
    g('lpSub').textContent=_lpDate(r.from||r.from_date)+' – '+_lpDate(r.to||r.to_date)+' · '+(r.reason||r.reason_type||'No reason given');
  }else{
    g('lpTitle').textContent='Leave proof'; g('lpChip').innerHTML=''; g('lpSub').textContent='';
  }
}
// Close the viewer, then run the normal handler so its modal opens as the viewer fades.
function _lpAct(kind){
  const id=_lpReqId;
  closeLeaveProof({quick:true});
  if(id==null) return;
  try{ if(navigator.vibrate) navigator.vibrate(kind==='edit'?0:8); }catch(_){}
  if(kind==='edit') openLeaveEdit(id);
  else updateLeave(id, kind==='approve' ? 'approved' : 'declined');
}
function viewLeaveProof(fileId, requestId){
  _lpReqId=(requestId!=null && requestId!=='')?requestId:null;
  return _lpView(fileId);
}


function renderLeave(filterName){
  const el=document.getElementById('leaveContentMain')||document.getElementById('leaveContent');if(!el)return;
  // If no filter passed, use current stored filter
  if(filterName!==undefined)window._leaveFilter=filterName;
  const activeFilter=window._leaveFilter||'';
  const getFrom=r=>r.from||r.from_date||'';
  const matchFilter=r=>{
    if(!activeFilter)return true;
    const s=staff.find(x=>x.id===r.staffId);
    const name=s?`${s.first} ${s.last}`:(r.staffName||'');
    return name.toLowerCase()===activeFilter.toLowerCase();
  };
  // Newest first. Sort by when it was RAISED where we know that (submitted_at),
  // falling back to the leave start date for older rows that predate it —
  // sorting purely on start date would bury a request made this morning for
  // next March beneath one made months ago for tomorrow.
  const _newest=(a,b)=>{
    const av=a.submitted_at||(getFrom(a)+'T00:00:00');
    const bv=b.submitted_at||(getFrom(b)+'T00:00:00');
    return String(bv).localeCompare(String(av));
  };
  const pending=leaveRequests.filter(r=>r.status==='pending'&&matchFilter(r)).sort(_newest);
  const approved=leaveRequests.filter(r=>r.status==='approved'&&matchFilter(r)).sort(_newest);
  const declined=leaveRequests.filter(r=>r.status==='declined'&&matchFilter(r)).sort(_newest);

  // ── LEAVE REFORM: status filter chips + upcoming/urgency awareness ──
  const statusFilter = window._leaveStatusFilter || 'all';
  const _today = new Date(); _today.setHours(0,0,0,0);
  const daysUntil = r => {
    const f = new Date((r.from||r.from_date||'')+'T00:00:00');
    return isNaN(f) ? 999 : Math.round((f-_today)/86400000);
  };
  // upcoming approved leave starting within 7 days (what a manager needs to see)
  const upcomingSoon = approved.filter(r=>{ const d=daysUntil(r); return d>=0 && d<=7; });
  const _staffNamesForFilter=[...new Set(leaveRequests.map(r=>{
    const s=staff.find(x=>x.id===r.staffId);
    return (r.staff_name||r.staffName||(s?`${s.first} ${s.last}`:'')).trim();
  }).filter(Boolean))].sort();

  const filterChips = `
    <div class="lv-filter-bar">
      <button class="lv-fchip ${statusFilter==='all'?'active':''}" onclick="setLeaveStatusFilter('all')">All<span class="lv-count">${pending.length+approved.length+declined.length}</span></button>
      <button class="lv-fchip ${statusFilter==='pending'?'active':''}" onclick="setLeaveStatusFilter('pending')">Pending<span class="lv-count">${pending.length}</span></button>
      <button class="lv-fchip ${statusFilter==='approved'?'active':''}" onclick="setLeaveStatusFilter('approved')">Approved<span class="lv-count">${approved.length}</span></button>
      <button class="lv-fchip ${statusFilter==='declined'?'active':''}" onclick="setLeaveStatusFilter('declined')">Declined<span class="lv-count">${declined.length}</span></button>
      <span class="lv-fdiv"></span>
      <select class="lv-fselect${activeFilter?' active':''}" onchange="renderLeave(this.value)">
        <option value="">Everyone</option>
        ${_staffNamesForFilter.map(n=>`<option value="${n}"${n===activeFilter?' selected':''}>${n}</option>`).join('')}
      </select>
      ${activeFilter?`<button class="lv-fclear" onclick="renderLeave('')">Clear</button>`:''}
      ${upcomingSoon.length?`<span class="lv-soon-note">${upcomingSoon.length} starting within 7 days</span>`:''}
    </div>`;

  const fmtLeaveDate=d=>new Date(d).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'});

  const _typeShort = t => ({
    'Time off / away':'Time off','Sick leave':'Sick','Medical appointment':'Medical',
    "Family / carer's":'Family','Study / exam':'Study','Travel':'Travel',
    'Family loss / funeral':'Bereavement','Other':'Other'
  })[t] || t || '';
  const _typeCls = t => ({
    'Sick leave':'lt-sick','Medical appointment':'lt-med',"Family / carer's":'lt-fam',
    'Study / exam':'lt-study','Travel':'lt-travel','Family loss / funeral':'lt-berv'
  })[t] || 'lt-other';

  const renderRow=(r,showActions)=>{
    // Resolve the staffer by NAME first — leave rows from the web form carry the
    // authoritative staff_name (snake_case) from Supabase, while staffId can be
    // missing or stale and collide with the wrong person's id. Fall back to
    // staffId only for legacy local rows that predate the web form.
    const rName=(r.staff_name||r.staffName||'').trim();
    let s=null;
    if(rName){
      s=staff.find(x=>`${x.first} ${x.last}`.trim().toLowerCase()===rName.toLowerCase());
    }
    if(!s && r.staffId!=null){
      s=staff.find(x=>x.id===r.staffId);
    }
    const name=rName||(s?`${s.first} ${s.last}`:'Unknown');
    const color=s?s.color:'#666';
    const _lvSid=(r.staffId||(s&&s.id)||null);
    // The Days column counts the days the person would actually have worked (Sundays and days they're marked unavailable don't
    // count). If that is fewer than the dates covered, say so, instead of showing a bare number that looks wrong.
    const _lvInfo=leaveDayInfo(r.from||r.from_date||'',(r.to||r.to_date||''),_lvSid);
    const daysHtml=(_lvInfo.work===_lvInfo.span)
      ? String(_lvInfo.work)
      : `<span title="${_lvInfo.span} day${_lvInfo.span===1?'':'s'} off in total. ${_lvInfo.work} of them ${_lvInfo.work===1?'is a day':'are days'} they would have worked; the rest are Sundays or days they are marked unavailable.">${_lvInfo.work}<span class="lv-of"> of ${_lvInfo.span}</span></span>`;
    // Where the request came from. Admin-added rows are stamped
    // resolved_by='Admin (ShiftOps)' by the relay; anything else came from a
    // staff member submitting in Nexus. "WEB" told you the transport; this
    // tells you whether a person asked for it or someone entered it for them,
    // which is the thing a manager actually needs to know.
    // Prefer the authoritative source column; fall back to the resolved_by
    // heuristic for rows entered before the column existed.
    const _src = (r.source||'').toLowerCase();
    const addedHere = _src ? (_src === 'admin')
                           : ((r.resolved_by||'') === 'Admin (ShiftOps)');
    const _du = (function(){ const f=new Date((r.from||r.from_date||'')+'T00:00:00'); const t=new Date(); t.setHours(0,0,0,0); return isNaN(f)?999:Math.round((f-t)/86400000); })();
    const soonCls = (r.status==='approved' && _du>=0 && _du<=7) ? ' lv-soon' : '';
    // A TABLE, not stacked cards: with every value in a column the eye can
    // compare rows down a line instead of re-reading each card's layout.
    const applied = r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('en-AU',{day:'numeric',month:'short'}) : '—';
    const ty = r.reason_type||'';
    return `<tr class="lv-tr lv-${r.status}${soonCls}">
      <td class="lv-td lv-td-who">
        <span class="avatar lv-ava" style="background:${color}">${s?initials(s):name.slice(0,2).toUpperCase()}</span>
        <span class="lv-who-txt">
          <span class="lv-name">${name}</span>
          <span class="lv-src ${addedHere?'lv-src-added':'lv-src-nexus'}">${addedHere?'Added':'Applied'}</span>
          ${r.reason?`<span class="lv-reason" title="${String(r.reason).replace(/"/g,'&quot;')}">${r.reason}</span>`:''}
          ${r.proof_path?`<button type="button" class="lv-btn" style="margin-top:4px;" onmouseenter="prefetchLeaveProof('${String(r.proof_path).replace(/[^A-Za-z0-9_\-\/.]/g,'')}')" ontouchstart="prefetchLeaveProof('${String(r.proof_path).replace(/[^A-Za-z0-9_\-\/.]/g,'')}')" onclick="viewLeaveProof('${String(r.proof_path).replace(/[^A-Za-z0-9_\-\/.]/g,'')}',${r.id})">View proof</button>`:''}
        </span>
      </td>
      <td class="lv-td lv-td-sm">${applied}</td>
      <td class="lv-td">${ty?`<span class="lv-type ${_typeCls(ty)}">${_typeShort(ty)}</span>`:'<span class="lv-dash">—</span>'}</td>
      <td class="lv-td lv-td-sm">${fmtLeaveDate(r.from||r.from_date)}</td>
      <td class="lv-td lv-td-sm">${fmtLeaveDate(r.to||r.to_date)}</td>
      <td class="lv-td lv-td-num">${daysHtml}</td>
      <td class="lv-td"><span class="lv-status lv-status-${r.status}">${r.status}</span>${_lvDecisionLine(r)}</td>
      <td class="lv-td lv-td-act">
        ${showActions?`<div class="lv-actions">
          <button class="lv-btn lv-edit" onclick="openLeaveEdit(${r.id})">Edit</button>
          ${r.status!=='approved'?`<button class="lv-btn lv-approve" onclick="updateLeave(${r.id},'approved')">Approve</button>`:''}
          ${r.status!=='declined'?`<button class="lv-btn lv-decline" onclick="updateLeave(${r.id},'declined')">Decline</button>`:''}
          <button class="lv-btn lv-del" onclick="deleteLeave(${r.id})" title="Delete this request">Delete</button>
        </div>`:''}
      </td>
    </tr>`;
  };

  // Header: the count line is dropped — the status chips below carry the same
  // numbers, and stating them twice made neither authoritative. Only one
  // toolbar action is primary; syncing is maintenance, adding is the job.
  let html=`<div class="lv-toolbar">
    <div class="section-title">Leave Requests</div>
    <div class="lv-toolbar-actions">
      <button class="btn btn-ghost lv-sync" onclick="syncLeaveRequests()">Sync from Staff</button>
      <button class="btn btn-primary" onclick="openLeaveModal()">+ Add Leave</button>
    </div>
  </div>`;

  // Staff and status filters now share ONE row and ONE visual language. They
  // were two separate mechanisms — a native select with a red text link, and a
  // chip bar — doing the same job while looking unrelated.
  html += filterChips;

  const showS = st => statusFilter==='all' || statusFilter===st;

  const THEAD = `<thead><tr>
      <th class="lv-th">Staff</th>
      <th class="lv-th">Applied</th>
      <th class="lv-th">Type</th>
      <th class="lv-th">From</th>
      <th class="lv-th">To</th>
      <th class="lv-th lv-td-num">Days</th>
      <th class="lv-th">Status</th>
      <th class="lv-th"></th>
    </tr></thead>`;
  const section=(label,colour,rows)=>
    `<div class="lv-section-hd" style="color:${colour}">${label} (${rows.length})</div>`+
    `<div class="lv-table-wrap"><table class="lv-table">${THEAD}<tbody>`+
    rows.map(r=>renderRow(r,true)).join('')+
    `</tbody></table></div>`;

  if(pending.length && showS('pending'))  html+=section('Pending','var(--gold)',pending);
  if(approved.length && showS('approved'))html+=section('Approved','var(--success)',approved);
  if(declined.length && showS('declined'))html+=section('Declined','var(--warn)',declined);
  // filtered to a status with no rows
  if(statusFilter!=='all' && leaveRequests.length &&
     ((statusFilter==='pending'&&!pending.length)||(statusFilter==='approved'&&!approved.length)||(statusFilter==='declined'&&!declined.length))){
    html+=`<div style="text-align:center;padding:36px 20px;color:var(--muted);font-size:12.5px">No ${statusFilter} requests.</div>`;
  }
  if(!leaveRequests.length){
    html+=`<div style="text-align:center;padding:48px 20px;color:var(--text-dim)"><div style="font-size:36px;margin-bottom:12px"></div><div style="font-size:14px;font-weight:600">No leave requests yet</div><div style="font-size:12px;margin-top:6px;color:var(--muted)">Staff can submit requests via the web form, or click + Add Leave</div></div>`;
  }

  el.innerHTML=html;
  updateLeaveBadge();
}

function openLeaveModal(){
  editingLeaveId = null;
  const saveBtn = document.querySelector('#leaveModal button.btn-primary');
  if(saveBtn){
    saveBtn.textContent = 'Submit Request';
    saveBtn.setAttribute('onclick', 'saveLeaveRequest()');
  }
  document.getElementById('leaveModalTitle').textContent='Add Leave';
  document.getElementById('leaveStaff').innerHTML=staff.sort((a,b)=>a.first.localeCompare(b.first)).map(s=>`<option value="${s.id}">${s.first} ${s.last}</option>`).join('');
  const today=_sydToday();
  document.getElementById('leaveFrom').value=today;
  document.getElementById('leaveTo').value=today;
  document.getElementById('leaveReason').value='';
  var _lt=document.getElementById('leaveType'); if(_lt) _lt.value='';
  var nb=document.getElementById('leaveNotify'); if(nb){ nb.checked=false; if(nb.parentElement) nb.parentElement.style.display=''; }
  openModal('leaveModal');
}

let editingLeaveId = null;

function openLeaveEdit(id){
  const r = leaveRequests.find(x =>x.id === id);
  if(!r) return;
  editingLeaveId = id;
  document.getElementById('leaveModalTitle').textContent = 'Edit Leave';
  // Populate staff dropdown
  document.getElementById('leaveStaff').innerHTML = staff
    .sort((a,b) =>a.first.localeCompare(b.first))
    .map(s => `<option value="${s.id}"${s.id===r.staffId?' selected':''}>${s.first} ${s.last}</option>`)
    .join('');
  document.getElementById('leaveFrom').value = r.from || r.from_date || '';
  document.getElementById('leaveTo').value = r.to || r.to_date || '';
  document.getElementById('leaveReason').value = r.reason || '';
  var _lte=document.getElementById('leaveType'); if(_lte) _lte.value = r.reason_type || '';
  var nbRow=document.getElementById('leaveNotify'); if(nbRow){ nbRow.checked=false; if(nbRow.parentElement) nbRow.parentElement.style.display='none'; }
  // Swap the save button onclick
  const saveBtn = document.querySelector('#leaveModal button.btn-primary');
  if(saveBtn){
    saveBtn.textContent = 'Save Changes';
    saveBtn.setAttribute('onclick', 'saveLeaveEdit()');
  }
  openModal('leaveModal');
}

function saveLeaveEdit(){
  if(!editingLeaveId) return;
  const r = leaveRequests.find(x =>x.id === editingLeaveId);
  if(!r){ closeModal('leaveModal'); return; }
  const newStaffId = parseInt(document.getElementById('leaveStaff').value);
  const newFrom = document.getElementById('leaveFrom').value;
  const newTo = document.getElementById('leaveTo').value;
  const newReason = document.getElementById('leaveReason').value.trim();
  const newReasonType = (document.getElementById('leaveType')||{}).value||'';
  if(!newFrom || !newTo){ showToast('Please select dates'); return; }
  if(newFrom >newTo){ showToast('End date must be after start date'); return; }

  const oldStaffId = r.staffId;
  const oldFrom = r.from || r.from_date || '';
  const oldTo = r.to || r.to_date || '';
  const wasApproved = r.status === 'approved';

  // If was approved, first REMOVE old LEAVE blocks
  if(wasApproved){
    const oldStaff = staff.find(x =>x.id === oldStaffId) ||
                     staff.find(x => `${x.first} ${x.last}`.toLowerCase() === (r.staffName||'').toLowerCase());
    if(oldStaff && oldFrom && oldTo){
      if(typeof saveCurrentWeek === 'function') saveCurrentWeek();
      const fromDate = new Date(oldFrom+'T00:00:00');
      const toDate = new Date(oldTo+'T00:00:00');
      for(let cur = new Date(fromDate); cur <= toDate; cur.setDate(cur.getDate()+1)){
        const wk = weekKey(new Date(cur));
        const dow = cur.getDay();
        const di = dow === 0 ? 6 : dow - 1;
        if(shiftsStore[wk] && shiftsStore[wk][oldStaff.id] && shiftsStore[wk][oldStaff.id][di]){
          shiftsStore[wk][oldStaff.id][di] = shiftsStore[wk][oldStaff.id][di].filter(sh =>sh.type !== 'leave');
          if(!shiftsStore[wk][oldStaff.id][di].length) delete shiftsStore[wk][oldStaff.id][di];
        }
      }
    }
  }

  // Update the record
  r.staffId = newStaffId;
  r.from = newFrom;
  r.to = newTo;
  if('from_date' in r) r.from_date = newFrom;
  if('to_date' in r) r.to_date = newTo;
  r.reason = newReason;
  r.reason_type = newReasonType;

  // If was approved, re-add LEAVE blocks for new range
  if(wasApproved){
    const newStaff = staff.find(x =>x.id === newStaffId);
    if(newStaff){
      const fromDate = new Date(newFrom+'T00:00:00');
      const toDate = new Date(newTo+'T00:00:00');
      for(let cur = new Date(fromDate); cur <= toDate; cur.setDate(cur.getDate()+1)){
        const wk = weekKey(new Date(cur));
        const dow = cur.getDay();
        const di = dow === 0 ? 6 : dow - 1;
        if(!shiftsStore[wk]) shiftsStore[wk] = {};
        if(!shiftsStore[wk][newStaff.id]) shiftsStore[wk][newStaff.id] = {};
        shiftsStore[wk][newStaff.id][di] = [{start:'09:00',end:'17:00',type:'leave',role:'Leave'}];
      }
    }
    // Refresh current week view
    const curKey = weekKey(currentWeekStart);
    shifts = JSON.parse(JSON.stringify(shiftsStore[curKey]||{}));
    staff.forEach(st => { if(!shifts[st.id]) shifts[st.id] = {}; });
  }

  // Push to supabase if from web. The fetch interceptor refreshes the auth
  // token for this write; we still confirm it landed so a failure isn't silent.
  if(r.supabaseId){
    (async function(){
      try{
        const resp = await fetch(
          `${SUPABASE_URL}/rest/v1/leave_submissions?id=eq.${r.supabaseId}`,
          {method:'PATCH', headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json','Prefer':'return=minimal'},
           body: JSON.stringify({from_date: newFrom, to_date: newTo, reason: newReason, reason_type: newReasonType})});
        if(!resp.ok){
          console.warn('Leave update rejected:', resp.status);
          showToast(resp.status===401||resp.status===403 ? 'Session expired — sign in again; change not saved' : 'Leave change may not have saved ('+resp.status+')');
        }
      }catch(e){ console.warn('Supabase update failed:', e); showToast('Leave change may not have saved — check connection'); }
    })();
  }

  // Reset modal back to "add" mode for next time
  const saveBtn = document.querySelector('#leaveModal button.btn-primary');
  if(saveBtn){
    saveBtn.textContent = 'Submit Request';
    saveBtn.setAttribute('onclick', 'saveLeaveRequest()');
  }
  editingLeaveId = null;
  closeModal('leaveModal');
  markDirty();
  renderAll();
  renderLeave();
  if(typeof renderLeaveSummary === 'function') renderLeaveSummary();
  showToast('Leave updated');
}

function saveLeaveRequest(){
  const staffId=parseInt(document.getElementById('leaveStaff').value);
  const from=document.getElementById('leaveFrom').value;
  const to=document.getElementById('leaveTo').value;
  const reason=document.getElementById('leaveReason').value.trim();
  const reasonType=(document.getElementById('leaveType')||{}).value||'';
  const notify=!!(document.getElementById('leaveNotify')&&document.getElementById('leaveNotify').checked);
  if(!from||!to){showToast('Please select dates');return;}
  if(from>to){showToast('End date must be after start date');return;}
  leaveRequests.push({id:nextLeaveId++,staffId,from,to,reason,reason_type:reasonType,status:'pending'});
  closeModal('leaveModal');markDirty();renderLeave();showToast('Leave request added');
  // Sync to the shared leave_submissions table so it appears on the staff's own
  // portal record (Nexus reads this table). Admin-entered leave lands pre-approved.
  // Best-effort: a failure here never blocks the local ShiftOps save above.
  syncLeaveToPortal(staffId,from,to,reason,reasonType);
  // Only email if the admin explicitly ticked "notify" — admin-entered leave is
  // often just recording something already agreed, so it's opt-in per entry.
  // The picked reason sets the email TONE, matching how Nexus self-submissions work.
  if(notify) sendAdminLeaveEmail(staffId,from,to,reason,reasonType);
}

// Email an admin-added leave using the APPROVED template (admin-entered leave is
// pre-approved). Mirrors the approve/decline email path: same relay, same payload,
// looks the recipient's address up from staff_credentials, best-effort/silent.
function sendAdminLeaveEmail(staffId,from,to,reason,reasonType){
  try{
    const s=staff.find(x=>x.id===staffId);
    if(!s) return;
    const nm=((s.first||'').trim()+' '+(s.last||'').trim()).trim();
    if(!nm) return;
    if(!MAIL_EXEC_URL || MAIL_EXEC_URL.indexOf('http')!==0) return;  // relay URL not set yet → skip
    fetch(`${SUPABASE_URL}/rest/v1/staff_credentials?staff_name=eq.`+encodeURIComponent(nm)+`&select=email`,{
      headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`}
    }).then(r=>r.ok?r.json():[]).then(function(rows){
      const to_email=(rows&&rows[0]&&rows[0].email||'').trim();
      if(!to_email || to_email.indexOf('@')<0) return;   // no email → skip
      fetch(MAIL_EXEC_URL,{
        method:'POST',
        headers:{'Content-Type':'text/plain;charset=utf-8'},
        body:JSON.stringify({
          action:'sendLeaveEmail',
          to:to_email,
          name:nm,
          status:'approved',
          fromDate:from,
          toDate:to,
          reason:(reason||''),
          reasonType:(reasonType||''),   // picked reason → matching email tone (same as Nexus)
          declineReason:'',
          decidedBy:(typeof currentUser!=='undefined'&&currentUser)?currentUser:''
        })
      }).catch(function(){});
    }).catch(function(){});
  }catch(_e){}
}

// Push an admin-entered leave to the shared leave_submissions table that the
// staff portal (Nexus) reads — via the Apps Script relay (service key bypasses
// RLS; direct anon writes are blocked by the table's authenticated-only policy).
// The staff_name MUST match what Nexus uses, so we build it the same way
// ShiftOps does everywhere else: `first last`. The fetch interceptor auto-adds
// sbAccessToken for the relay's admin gate.
function syncLeaveToPortal(staffId,from,to,reason,reasonType){
  try{
    const s=staff.find(x=>x.id===staffId);
    if(!s){return;}
    const fullName=((s.first||'').trim()+' '+(s.last||'').trim()).trim();
    if(!fullName){return;}

    // The relay's addLeave is admin-gated: it needs a LIVE Supabase session
    // token to verify the caller is an admin. Tokens age out after ~1h. Every
    // other admin action checks this first; this path used to skip it, so a
    // stale token produced a bare "forbidden" that surfaced as the misleading
    // "portal sync failed" — when the real cause was an expired session. Now we
    // make sure the token is fresh (refreshing if we can) before sending.
    const _send = function(){
      fetch(GAS_EXEC_URL,{
        method:'POST',
        headers:{'Content-Type':'text/plain;charset=utf-8'},
        body:JSON.stringify({
          action:'addLeave',
          staff:fullName,
          from:from,        // yyyy-MM-dd from the date inputs
          to:to,
          reason:reason||'',
          reasonType:reasonType||'',   // categorised leave type → leave_submissions.reason_type
          source:'Admin',   // stamps leave_submissions.source (relay must persist this)
          addedBy:_soWho(), // who added it; the relay should store this as created_by / resolved_by
          token:GAS_TOKEN
        })
      }).then(function(r){ return r.json().catch(function(){return {};}); })
        .then(function(res){
          if(!res || res.ok!==true){
            showToast('Leave saved locally, portal sync failed'+(res&&res.error?(' ('+res.error+')'):''));
          }
        }).catch(function(){
          showToast('Leave saved locally, portal sync failed (offline)');
        });
    };

    if(typeof _soTokAlive==='function' && _soTokAlive()){
      _send();                      // token good — send now
    } else {
      // Token stale/expired — try to refresh it, then send. If we can't get a
      // fresh one, tell the admin plainly instead of a vague sync failure.
      _soRefreshToken(function(ok){
        if(ok){ _send(); }
        else { _soSessionBanner(true); showToast('Your session ended, so the portal was not updated. Open ShiftOps again from Nexus, then re-add this leave.','error'); }
      });
    }
  }catch(e){ /* never block the local save */ }
}

// Refresh the inherited Supabase session token via supabase-js, then continue.
function _soRefreshToken(cb){
  _soFreshTok().then(function(){ cb(_soTokAlive(15000)); }).catch(function(){ cb(false); });
}

function updateLeave(id,status){
  const r=leaveRequests.find(x=>x.id===id);
  if(!r)return;

  if(status==='declined'){
    // Show in-app decline reason modal instead of prompt()
    pendingDeclineId=id;
    document.getElementById('declineReasonInput').value='';
    openModal('declineModal');
    return;
  }
  if(status==='approved' && typeof openLeaveClash==='function'){ openLeaveClash(id); return; }

  applyLeaveUpdate(id,status,'');
}

let pendingDeclineId=null;

async function confirmDecline(){
  const reason=document.getElementById('declineReasonInput').value.trim();
  if(!(await _soEnsureSession())){ showToast('Your session ended, so this was not saved. Open ShiftOps again from Nexus and redo it.','error'); return; }
  closeModal('declineModal');
  applyLeaveUpdate(pendingDeclineId,'declined',reason);
  pendingDeclineId=null;
}

// Paint EVERY approved leave onto the correct person's roster grid, keyed by the
// authoritative staff name. Also clears stray leave blocks so a previously
// mis-attributed leave (wrong person) is corrected. Safe to run repeatedly.
// Normalize a person's name for reliable matching: trim, lowercase, collapse
// any run of whitespace to a single space. Handles double-spaces / trailing
// whitespace / inconsistent spacing between the two data sources.
function _normName(v){ return String(v||'').trim().toLowerCase().replace(/\s+/g,' '); }
// Find the staff record for a leave request STRICTLY by normalized name.
// Returns null (never a guess) if there's no name or no exact normalized match.
function _staffForLeave(r){
  const nm=_normName(r.staff_name||r.staffName||'');
  if(!nm) return null;
  return staff.find(function(x){ return _normName(x.first+' '+x.last)===nm; }) || null;
}
// Make the CURRENT week's leave blocks exactly match approved leave_submissions:
// remove any leave that has no matching submission, and add any approved leave
// that's missing — all matched by staff NAME (authoritative). Called on every
// roster render so the grid is always derived from leave_submissions.
function _syncWeekLeavesToSubmissions(){
  if(typeof shifts!=='object'||!shifts) return;
  const weekStart=(typeof currentWeekStart!=='undefined')?new Date(currentWeekStart):null;
  if(!weekStart) return;
  weekStart.setHours(0,0,0,0);

  // valid[staffId][dayIndex] = true  when that person has an approved leave that day
  const valid={};
  (leaveRequests||[]).forEach(function(r){
    if((r.status||'')!=='approved') return;           // only approved
    const s=_staffForLeave(r);                         // strict normalized-name match
    if(!s) return;                                     // no name / no match → skip (no staffId fallback)
    const fromStr=r.from||r.from_date||'', toStr=r.to||r.to_date||'';
    if(!fromStr||!toStr) return;
    const fromD=new Date(fromStr+'T00:00:00'), toD=new Date(toStr+'T00:00:00');
    for(let di=0; di<7; di++){
      const day=new Date(weekStart); day.setDate(day.getDate()+di); day.setHours(0,0,0,0);
      if(day.getDay()===0) continue; // no Sunday roster
      if(day>=fromD && day<=toD){ (valid[s.id]=valid[s.id]||{})[di]=true; }
    }
  });

  // 1. Strip leave blocks that are NOT backed by a submission (wrong-person / phantom).
  Object.keys(shifts).forEach(function(sid){
    const byDay=shifts[sid]; if(!byDay) return;
    Object.keys(byDay).forEach(function(di){
      if(!Array.isArray(byDay[di])) return;
      byDay[di]=byDay[di].filter(function(sh){
        if(sh.type!=='leave') return true;
        return !!(valid[sid] && valid[sid][di]);
      });
      if(!byDay[di].length) delete byDay[di];
    });
  });

  // 2. Add leave blocks that SHOULD be there but aren't (so every approved leave shows).
  Object.keys(valid).forEach(function(sid){
    Object.keys(valid[sid]).forEach(function(di){
      if(!shifts[sid]) shifts[sid]={};
      const day=shifts[sid][di]||[];
      if(!day.some(function(sh){return sh.type==='leave';})){
        day.push({start:'09:00',end:'17:00',type:'leave',role:'Leave'});
      }
      shifts[sid][di]=day;
    });
  });
}
function repaintAllApprovedLeaves(){
  if(typeof saveCurrentWeek === 'function') saveCurrentWeek();

  // 1. Wipe all existing leave blocks everywhere (we'll re-add the correct ones).
  Object.keys(shiftsStore||{}).forEach(function(wk){
    const byStaff=shiftsStore[wk]; if(!byStaff) return;
    Object.keys(byStaff).forEach(function(sid){
      const byDay=byStaff[sid]; if(!byDay) return;
      Object.keys(byDay).forEach(function(di){
        if(Array.isArray(byDay[di])){
          byDay[di]=byDay[di].filter(function(sh){ return sh.type!=='leave'; });
          if(!byDay[di].length) delete byDay[di];
        }
      });
    });
  });

  // 2. Re-paint each approved leave onto its correct staffer, strictly by name.
  (leaveRequests||[]).forEach(function(r){
    if((r.status||'')!=='approved') return;
    const s=_staffForLeave(r);
    if(!s) return;                                     // no name / no match → skip (no staffId fallback)
    const fromStr=r.from||r.from_date||'', toStr=r.to||r.to_date||'';
    if(!fromStr||!toStr) return;
    const fromDate=new Date(fromStr+'T00:00:00'), toDate=new Date(toStr+'T00:00:00');
    for(let cur=new Date(fromDate); cur<=toDate; cur.setDate(cur.getDate()+1)){
      if(cur.getDay()===0) continue; // skip Sundays (no roster)
      const wk=weekKey(new Date(cur));
      const dow=cur.getDay(); const di=dow===0?6:dow-1;
      if(!shiftsStore[wk]) shiftsStore[wk]={};
      if(!shiftsStore[wk][s.id]) shiftsStore[wk][s.id]={};
      const day=shiftsStore[wk][s.id][di]||[];
      if(!day.some(function(sh){return sh.type==='leave';})){
        day.push({start:'09:00',end:'17:00',type:'leave',role:'Leave'});
      }
      shiftsStore[wk][s.id][di]=day;
    }
  });

  // 3. Refresh the visible week from the store.
  if(typeof availWeekKey!=='undefined' && typeof loadWeek==='function') loadWeek(availWeekKey);
  if(typeof renderRoster==='function') renderRoster();
}

/**
 * When leave is approved, any shift that person already has inside the leave
 * dates needs someone else. Open each one for pickup and notify.
 *
 * Only touches shifts still in 'assigned' state — one already open, or
 * mid-release, is left alone rather than being reset.
 */
async function releaseShiftsForLeave(s, fromStr, toStr){
  if(!s || !fromStr || !toStr) return;
  const name=((s.first||'').trim()+' '+(s.last||'').trim()).trim();
  if(!name) return;
  try{
    const rows=await (await fetch(SUPABASE_URL+'/rest/v1/roster_shifts'+
      '?staff_name=eq.'+encodeURIComponent(name)+
      '&shift_date=gte.'+fromStr+'&shift_date=lte.'+toStr+
      '&status=eq.assigned'+
      '&select=id,shift_date,start_time,end_time',
      {headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY}})).json();
    if(!rows || !rows.length) return;

    let opened=0, tooSoon=0;
    for(const row of rows){
      try{
        const r=await fetch(SUPABASE_URL+'/rest/v1/rpc/approve_shift_release',{
          method:'POST',headers:_DB_H,
          body:JSON.stringify({p_shift_id:row.id,
            p_manager:(typeof currentUser!=='undefined'&&currentUser)?currentUser:'Leave approval',
            p_team:null})
        });
        if(!r.ok) continue;
        const res=await r.json();
        if(res && res.ok===true){
          opened++;
          // Only email if there's real time to respond. Blasting the team about
          // a shift starting in two hours doesn't get it covered — people are
          // mid-shift or asleep — it just trains everyone to ignore the emails.
          // The shift still OPENS either way, so it's on the pickup list and
          // recorded properly; what changes is whether we shout about it.
          if(_hoursUntilShift(row.shift_date, row.start_time) >= SHIFT_NOTICE_HOURS){
            notifyShiftOpen(name, res);
          }else{
            tooSoon++;
            console.log('[SHIFT] '+row.shift_date+' '+row.start_time+
              ' opens in under '+SHIFT_NOTICE_HOURS+'h — no email, arrange cover directly');
          }
        }
      }catch(e){ console.warn('releaseShiftsForLeave row',e); }
    }
    if(opened){
      showToast(opened+' shift'+(opened===1?'':'s')+' opened for pickup (on leave)'+
        (tooSoon?(' — '+tooSoon+' within '+SHIFT_NOTICE_HOURS+'h, not emailed'):''));
      if(tooSoon){
        showToast(tooSoon+' shift'+(tooSoon===1?' starts':'s start')+' too soon to email — arrange cover directly');
      }
      loadWeekShiftsFromDB(currentWeekStart);
    }
  }catch(e){ console.warn('releaseShiftsForLeave',e); }
}

// Approving or declining leave records WHO decided, taken from the signed-in session. With an ended session the save used to
// go through anonymously and showed "approver not recorded", so it is refused here with a clear message instead.
async function applyLeaveUpdate(id,status,declineReason){
  if(!(await _soEnsureSession())){
    showToast('Your session ended, so this was not saved. Open ShiftOps again from Nexus and redo it.','error');
    return;
  }
  _applyLeaveUpdateNow(id,status,declineReason);
}
function _applyLeaveUpdateNow(id,status,declineReason){
  const r=leaveRequests.find(x=>x.id===id);
  if(!r)return;

  const wasApproved = r.status === 'approved';
  r.status=status;
  if(declineReason)r.declineReason=declineReason;
  // Who decided and when. The database trigger stamps the same from the signed-in login; this keeps the screen current.
  const _decidedBy=_soWho(), _decidedAt=new Date().toISOString();
  if(status==='approved'||status==='declined'){ r.resolved_by=_decidedBy; r.resolved_at=_decidedAt; }
  else if(status==='pending'){ r.resolved_by=''; r.resolved_at=null; }

  // Resolve strictly by normalized NAME — staffId can be stale/colliding.
  const s=_staffForLeave(r);
  const fromStr=r.from||r.from_date||'';
  const toStr=r.to||r.to_date||'';

  // Helper: walk every day in the leave range
  function walkLeaveDays(callback){
    if(!s || !fromStr || !toStr) return;
    const fromDate=new Date(fromStr+'T00:00:00');
    const toDate=new Date(toStr+'T00:00:00');
    for(let cur=new Date(fromDate);cur<=toDate;cur.setDate(cur.getDate()+1)){
      const wk=weekKey(new Date(cur));
      const dow=cur.getDay();
      const di=dow===0?6:dow-1;
      callback(wk, di);
    }
  }

  // Save current week first so we don't lose in-progress edits
  if(typeof saveCurrentWeek === 'function') saveCurrentWeek();

  if(status==='approved'){
    // Add LEAVE blocks
    walkLeaveDays(function(wk, di){
      if(!shiftsStore[wk]) shiftsStore[wk]={};
      if(!shiftsStore[wk][s.id]) shiftsStore[wk][s.id]={};
      shiftsStore[wk][s.id][di]=[{start:'09:00',end:'17:00',type:'leave',role:'Leave'}];
    });
    // Approved leave on a day they're rostered means that shift now needs
    // covering — open it for pickup automatically rather than leaving a
    // silent hole in the roster that nobody notices until the morning.
    releaseShiftsForLeave(s, fromStr, toStr);
  } else if(status==='declined' && wasApproved){
    // Was previously approved ->now declined: REMOVE the LEAVE blocks
    walkLeaveDays(function(wk, di){
      if(!shiftsStore[wk] || !shiftsStore[wk][s.id] || !shiftsStore[wk][s.id][di]) return;
      shiftsStore[wk][s.id][di] = shiftsStore[wk][s.id][di].filter(sh =>sh.type !== 'leave');
      if(!shiftsStore[wk][s.id][di].length) delete shiftsStore[wk][s.id][di];
    });
  }

  // Refresh current week view from store
  if(s){
    const curKey=weekKey(currentWeekStart);
    shifts=JSON.parse(JSON.stringify(shiftsStore[curKey]||{}));
    staff.forEach(st=>{if(!shifts[st.id])shifts[st.id]={};});
  }

  // Push to Supabase if from web form
  if(r.supabaseId){
    const body={status};
    if(declineReason)body.decline_reason=declineReason;
    if(status==='approved'||status==='declined'){ body.resolved_by=_decidedBy||null; body.resolved_at=_decidedAt; }
    fetch(
      `${SUPABASE_URL}/rest/v1/leave_submissions?id=eq.${r.supabaseId}`,
      {method:'PATCH',headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json','Prefer':'return=minimal'},
       body:JSON.stringify(body)}
    ).then(function(resp){
      // Send web push to the staff member
      if(!resp.ok) return;
      const staffName = r.staffName || (s ? `${s.first} ${s.last}` : null);
      if(!staffName) return;
      const fromStr = r.from || r.from_date || '';
      const toStr = r.to || r.to_date || '';
      const dateRange = fromStr + (toStr && toStr !== fromStr ? ' to '+toStr : '');
      const msg = dateRange + (declineReason ? ' · '+declineReason : (r.reason ? ' · '+r.reason : ''));
      _soFreshTok().catch(function(){ return _soTok(); }).then(function(_pt){ return fetch(`${SUPABASE_URL}/functions/v1/send-push`,{
        method:'POST',
        headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${_pt||SUPABASE_KEY}`,'Content-Type':'application/json'},
        body:JSON.stringify({
          staff_name: staffName,
          title: status==='approved' ? 'Leave approved ' : 'Leave declined',
          body: msg,
          url: './#schedule',
          tag: 'leave-'+r.supabaseId
        })
      }); }).catch(function(){});

      // ── Email the staff member their leave decision ──────────────
      // Look up their address from staff_credentials, then send via the
      // Apps Script relay. Best-effort: never blocks the decision, and
      // silently no-ops if they have no email on file.
      (function(){
        try{
          const nm = staffName;
          if(!nm) return;
          fetch(`${SUPABASE_URL}/rest/v1/staff_credentials?staff_name=eq.`+encodeURIComponent(nm)+`&select=email`,{
            headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`}
          }).then(r=>r.ok?r.json():[]).then(function(rows){
            const to=(rows&&rows[0]&&rows[0].email||'').trim();
            if(!to || to.indexOf('@')<0) return;   // no/blank/invalid email → skip
            if(!MAIL_EXEC_URL || MAIL_EXEC_URL.indexOf('http')!==0) return;  // relay URL not set yet → skip
            fetch(MAIL_EXEC_URL,{
              method:'POST',
              headers:{'Content-Type':'text/plain;charset=utf-8'},
              body:JSON.stringify({
                action:'sendLeaveEmail',
                to:to,
                name:nm,
                status:status,
                fromDate:fromStr,
                toDate:toStr,
                reason:(r.reason||''),
                reasonType:(r.reason_type||''),
                declineReason:(declineReason||''),
                decidedBy:(typeof currentUser!=='undefined'&&currentUser)?currentUser:''
              })
            }).catch(function(){});
          }).catch(function(){});
        }catch(_e){}
      })();
    }).catch(e=>console.warn('Could not update leave in Supabase',e));
  }

  forceSave();
  renderAll();
  renderLeave();
  if(typeof renderLeaveSummary === 'function') renderLeaveSummary();
  if(status==='approved') showToast('Leave approved — roster updated');
  else if(status==='declined' && wasApproved) showToast('Leave declined — blocks removed from roster');
  else showToast('Leave declined');
}

async function deleteLeave(id){
  const r=leaveRequests.find(x=>x.id===id);
  // Trash the attached proof in Drive first. If that fails, keep the request so the file isn't orphaned.
  if(r && r.proof_path){
    let proofGone=false;
    try{
      const res=await fetch(GAS_EXEC_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'deleteLeaveProof',token:GAS_TOKEN,sbAccessToken:_soTok(),fileId:r.proof_path})});
      const j=res.ok?await res.json():null;
      proofGone=!!(j&&j.ok);
    }catch(e){}
    if(!proofGone){ showToast('Could not remove the attached proof, so the request was kept. Try again.'); return; }
  }
  leaveRequests=leaveRequests.filter(x=>x.id!==id);
  // Also remove from Supabase so it doesn't reappear on sync
  if(r&&r.supabaseId){
    fetch(`${SUPABASE_URL}/rest/v1/leave_submissions?id=eq.${r.supabaseId}`,{
      method:'DELETE',
      headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`}
    }).catch(e=>console.warn('Could not delete from Supabase',e));
  }
  // Also clear LEAVE blocks from shiftsStore so days reopen for scheduling
  if(r && r.status === 'approved'){
    const s = staff.find(x=>x.id===r.staffId) ||
              staff.find(x=>`${x.first} ${x.last}`.toLowerCase()===(r.staffName||'').toLowerCase());
    if(s && (r.from||r.from_date) && (r.to||r.to_date)){
      const fromDate = new Date((r.from||r.from_date)+'T00:00:00');
      const toDate = new Date((r.to||r.to_date)+'T00:00:00');
      for(let cur = new Date(fromDate); cur <= toDate; cur.setDate(cur.getDate()+1)){
        const wk = weekKey(new Date(cur));
        if(!shiftsStore[wk] || !shiftsStore[wk][s.id]) continue;
        const dow = cur.getDay();
        const di = dow === 0 ? 6 : dow - 1;
        if(shiftsStore[wk][s.id][di]){
          shiftsStore[wk][s.id][di] = shiftsStore[wk][s.id][di].filter(sh =>sh.type !== 'leave');
          if(!shiftsStore[wk][s.id][di].length) delete shiftsStore[wk][s.id][di];
        }
      }
      // Refresh current week view
      const curKey = weekKey(currentWeekStart);
      shifts = JSON.parse(JSON.stringify(shiftsStore[curKey]||{}));
      staff.forEach(st=>{if(!shifts[st.id])shifts[st.id]={};});
    }
  }
  markDirty();
  renderLeave();
  if(typeof renderLeaveSummary === 'function') renderLeaveSummary();
  if(typeof renderAll === 'function') renderAll();
  showToast('Leave request removed');
}

async function syncLeaveRequests(){
  showToast('Syncing leave requests…');
  try{
    const res=await fetch(
      `${SUPABASE_URL}/rest/v1/leave_submissions?order=submitted_at.desc`,
      {headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`}}
    );
    if(!res.ok)throw new Error('Fetch failed');
    const rows=await res.json();
    if(!rows.length){showToast('No leave submissions found');return;}

    let added=0,updated=0;
    rows.forEach(row=>{
      // Check if already imported (by supabaseId)
      const exists=leaveRequests.find(r=>r.supabaseId===row.id);
      if(exists){
        // The DB is authoritative — refresh reason/type/status from it, not just
        // status. Previously only status synced, so an approved leave's reason
        // went blank after "Sync from Staff" (it was never re-read from the row).
        if(row.reason!==undefined) exists.reason=row.reason||'';
        if(row.reason_type!==undefined) exists.reason_type=row.reason_type||'';
        if(exists.status!==row.status){ exists.status=row.status; updated++; }
        if(row.decline_reason) exists.declineReason=row.decline_reason;
        if(row.resolved_by!==undefined) exists.resolved_by=row.resolved_by||'';
        if(row.resolved_at!==undefined) exists.resolved_at=row.resolved_at||null;
        return;
      }
      // Don't re-import records that were deleted locally — skip if status is declined
      // (they may have been dismissed by the manager)
      const s=staff.find(x=>`${x.first} ${x.last}`.toLowerCase()===row.staff_name.toLowerCase());
      leaveRequests.push({
        id:nextLeaveId++,
        staffId:s?s.id:null,
        staffName:row.staff_name,
        from:row.from_date,
        to:row.to_date,
        reason:row.reason||'',
        reason_type:row.reason_type||'',
        proof_path:row.proof_path||'',
        status:row.status||'pending',  // use actual status from Supabase
        declineReason:row.decline_reason||'',
        resolved_by:row.resolved_by||'',
        resolved_at:row.resolved_at||null,
        supabaseId:row.id
      });
      added++;
    });

    // RECONCILE: drop any local leave that no longer exists in the DB (deleted
    // server-side) or that doesn't resolve to a current staff member. This is
    // what removes phantom entries (e.g. a "Nidhi Subedi" row with no DB record)
    // that were left behind by old buggy sessions.
    const dbIds={};
    rows.forEach(function(row){ dbIds[row.id]=true; });
    const before=leaveRequests.length;
    leaveRequests=leaveRequests.filter(function(r){
      // keep unsynced local-only rows (no supabaseId) only if they resolve to a real staffer
      if(!r.supabaseId){ return !!_staffForLeave(r); }
      // drop synced rows whose DB record is gone
      if(!dbIds[r.supabaseId]) return false;
      // drop rows that don't match any current staff by name
      return !!_staffForLeave(r);
    });
    const removed=before-leaveRequests.length;

    // Self-heal: re-resolve staffId from the authoritative name for ALL leave
    // rows (fixes stale/colliding ids that painted leaves on the wrong person),
    // then repaint every approved leave onto the correct grid.
    leaveRequests.forEach(function(r){
      const m=_staffForLeave(r);
      if(m) r.staffId=m.id;
    });
    try{ repaintAllApprovedLeaves(); }catch(e){ console.warn('repaint leaves', e); }

    markDirty();renderLeave();
    const msg=added>0||updated>0
      ?` ${added} new · ${updated} updated`
      :'All leave requests up to date';
    showToast(msg);
    await saveData();
  }catch(e){
    showToast('Sync failed: '+e.message);
  }
}







