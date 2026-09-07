/* ═══════════════════════════════════════════════════════════════════════
   payroll.js — fortnightly payrun calculator (Reports → Payroll)
   Loaded by index.html:  <script src="payroll.js?v=1"></script>

   RECOVERED from git commit 07ef600 (29 Jul 2026). This feature was lost
   from index.html during a rebuild between 29 and 31 July — nothing errored,
   because nothing else referenced it. It is now a separate module precisely
   so an index.html rebuild cannot silently take it again (see ARCHITECTURE.md).

   Access is Accounts-team only, enforced twice: _canPayroll() hides the UI,
   and the payroll_rates table has an RLS policy checking the caller's
   auth_uid maps to a staff_credentials row with team = 'Accounts'. The UI
   guard is convenience; the RLS policy is the real boundary.
   ═══════════════════════════════════════════════════════════════════════ */
/* ── HOST SHIM ────────────────────────────────────────────────────────────
   This module now runs in ShiftOps as well as Nexus, and the two hosts name
   their Supabase globals differently (SB/KEY vs SUPABASE_URL/SUPABASE_KEY)
   and expose different helpers. Resolving them here keeps the payroll logic
   identical in both rather than maintaining two copies that can drift.
   ──────────────────────────────────────────────────────────────────────── */
function _pUrl(){
  if(typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL) return SUPABASE_URL;
  if(typeof SB !== 'undefined' && SB) return SB;
  return '';
}
function _pKey(){
  if(typeof SUPABASE_KEY !== 'undefined' && SUPABASE_KEY) return SUPABASE_KEY;
  if(typeof KEY !== 'undefined' && KEY) return KEY;
  return '';
}
/** Bearer: Nexus tracks the session itself; ShiftOps' fetch interceptor
 *  swaps it in, so the anon key here is replaced before the request leaves. */
function _pBearer(){
  if(typeof _sbBearer === 'function') return _sbBearer();
  try{ const t=sessionStorage.getItem('so_sb_at'); if(t) return t; }catch(e){}
  return _pKey();
}
async function _pGet(table, qs){
  if(typeof sbGet === 'function') return _pGet(table, qs);
  const r = await fetch(_pUrl()+'/rest/v1/'+table+(qs||''),
    {headers:{apikey:_pKey(), Authorization:'Bearer '+_pBearer()}});
  if(!r.ok){ console.warn('payroll _pGet', table, r.status); return []; }
  return r.json();
}
function _pEsc(s){
  if(typeof esc === 'function') return esc(s);
  return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
/** 7-minute flex rounding. Uses the host's version where there is one so the
 *  payrun can't drift from the timesheet; the fallback below is the same rule. */
function _pFlex(date){
  if(typeof flexClockTime === 'function') return _pFlex(date);
  const d=new Date(date), m=d.getMinutes();
  let nm, nh=d.getHours();
  if(m<=7) nm=0; else if(m<=22) nm=15; else if(m<=37) nm=30;
  else if(m<=52) nm=45; else { nm=0; nh=(nh+1)%24; }
  d.setHours(nh,nm,0,0); return d;
}
/** Break + coffee rules. MUST match _pExtras() in Nexus — if these two
 *  disagree, payroll and the timesheet report different hours for the same
 *  day, which is the worst possible failure for this feature. */
function _pExtras(rawHours, customBreak, customCoffee, dateObj){
  if(typeof calcDayExtras === 'function') return _pExtras(rawHours, customBreak, customCoffee, dateObj);
  let isWeekend=false;
  if(dateObj){ const d=(dateObj instanceof Date)?dateObj:new Date(dateObj);
    const dow=d.getDay(); isWeekend=(dow===0||dow===6); }
  const autoBreak = isWeekend ? 0 : (rawHours>5 ? 0.5 : 0);
  let breakHrs = (customBreak!==undefined&&customBreak!==null&&customBreak!=='')?parseFloat(customBreak):autoBreak;
  let coffee   = (customCoffee!==undefined&&customCoffee!==null&&customCoffee!=='')?parseFloat(customCoffee):(rawHours>=4?5:0);
  if(isNaN(breakHrs)) breakHrs=0;
  if(isNaN(coffee)) coffee=0;
  return { netHours: Math.max(0, rawHours-breakHrs), breakHrs:breakHrs, coffee:coffee };
}

(function(){
  'use strict';

  // Inject the module's own styles rather than adding them to index.html.
  if(!document.getElementById('payroll-styles')){
    var st = document.createElement('style');
    st.id = 'payroll-styles';
    st.textContent = `
#rsec-payroll{
  --pp-prem:#b45309; --pp-prem-ink:#7c2d12; --pp-prem-soft:#fff7ed; --pp-prem-bd:#fed7aa;
  --pp-ord:#64748b; --pp-line:#eef2f7; --pp-ink:#0f172a; --pp-mut:#64748b; --pp-mut2:#94a3b8;
}
:is([data-theme="dark"],[data-theme="midnight"]) #rsec-payroll{
  --pp-prem:#fbbf24; --pp-prem-ink:#fde68a; --pp-prem-soft:rgba(251,191,74,.10); --pp-prem-bd:rgba(251,191,74,.32);
  --pp-ord:#8aa1bb; --pp-line:#22304a; --pp-ink:#e8eef7; --pp-mut:#8aa1bb; --pp-mut2:#5f7690;
}
/* controls */
.pp-seg{display:inline-flex;background:var(--pp-prem-soft);border:1px solid var(--pp-prem-bd);border-radius:10px;padding:3px;gap:2px;}
.pp-seg button{border:none;background:transparent;font-family:inherit;font-size:11.5px;font-weight:700;color:var(--pp-prem);padding:6px 12px;border-radius:7px;cursor:pointer;transition:background .15s;}
.pp-seg button:hover{background:rgba(180,83,9,.08);}
/* summary band — premium leads */
.pp-summary{display:grid;grid-template-columns:1.7fr 1fr 1fr;gap:14px;margin-bottom:18px;}
@media(max-width:660px){.pp-summary{grid-template-columns:1fr;}}
.pp-hero{background:var(--pp-prem-soft);border:1px solid var(--pp-prem-bd);border-radius:14px;padding:18px 20px;position:relative;overflow:hidden;}
.pp-hero .lbl{font-size:11px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--pp-prem);}
.pp-hero .val{font-size:clamp(30px,6vw,40px);font-weight:900;letter-spacing:-.025em;color:var(--pp-prem-ink);font-variant-numeric:tabular-nums;line-height:1;margin-top:6px;}
.pp-hero .sub{font-size:12.5px;color:var(--pp-mut);margin-top:8px;font-weight:500;}
.pp-hero .sub b{color:var(--pp-prem);font-weight:800;}
.pp-stat{border:1px solid var(--pp-line);border-radius:14px;padding:16px 18px;display:flex;flex-direction:column;justify-content:center;}
.pp-stat .lbl{font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--pp-mut2);}
.pp-stat .val{font-size:23px;font-weight:800;color:var(--pp-ink);font-variant-numeric:tabular-nums;margin-top:4px;letter-spacing:-.015em;}
.pp-stat .val.grand{color:var(--accent);}
.pp-stat .note{font-size:11px;color:var(--pp-mut2);margin-top:3px;}
/* table */
.pp-scroll{overflow-x:auto;margin:0 -4px;}
.pp-table{width:100%;border-collapse:collapse;font-size:13px;min-width:640px;}
.pp-table thead th{font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--pp-mut2);font-weight:700;padding:9px 10px;border-bottom:1px solid var(--pp-line);text-align:left;white-space:nowrap;}
.pp-table thead th.r{text-align:right;}
.pp-table thead th.prem{color:var(--pp-prem);}
.pp-table tbody td{padding:11px 10px;border-bottom:1px solid var(--pp-line);}
.pp-table td.r{text-align:right;font-variant-numeric:tabular-nums;}
.pp-name{font-weight:700;color:var(--pp-ink);}
.pp-struct{font-size:11px;color:var(--pp-mut2);margin-top:1px;}
.pp-ord{color:var(--pp-ord);font-size:12.5px;font-variant-numeric:tabular-nums;}
.pp-prem-pill{display:inline-flex;align-items:baseline;gap:6px;background:var(--pp-prem-soft);border:1px solid var(--pp-prem-bd);border-radius:999px;padding:3px 11px;}
.pp-prem-pill .h{font-size:11px;font-weight:700;color:var(--pp-prem);font-variant-numeric:tabular-nums;}
.pp-prem-pill .d{font-size:13px;font-weight:900;color:var(--pp-prem-ink);font-variant-numeric:tabular-nums;}
.pp-prem-zero{color:var(--pp-mut2);font-size:12px;}
.pp-net{font-weight:600;color:var(--pp-ink);}
.pp-total{font-weight:900;color:var(--pp-ink);font-size:14px;font-variant-numeric:tabular-nums;}
.pp-coffee{color:#10b981;font-weight:600;font-variant-numeric:tabular-nums;}
.pp-coffee.zero{color:var(--pp-mut2);font-weight:400;}
.pp-coffee-note{color:#10b981;font-size:11px;font-weight:700;margin-left:4px;}
.pp-drag-th{width:26px;}
.pp-drag{width:26px;text-align:center;color:var(--pp-mut2);cursor:grab;user-select:none;font-size:15px;line-height:1;}
.pp-drag:active{cursor:grabbing;}
.pp-table tbody tr{transition:transform .16s cubic-bezier(.22,1,.36,1), background .12s, box-shadow .18s;}
.pp-table tbody tr.pp-dragging{opacity:.92;background:var(--pp-prem-soft);box-shadow:0 10px 26px -10px rgba(16,24,40,.4);position:relative;z-index:5;}
.pp-flagrow{background:#fef2f2;}
:is([data-theme="dark"],[data-theme="midnight"]) .pp-flagrow{background:rgba(239,68,68,.08);}
.pp-chip{font-size:10px;font-weight:800;padding:2px 7px;border-radius:6px;margin-left:6px;white-space:nowrap;}
.pp-chip.norate{background:#fee2e2;color:#b91c1c;}
.pp-chip.open{background:#fef3c7;color:#b45309;}
.pp-foot td{border-top:2px solid var(--pp-line);border-bottom:none;padding-top:15px;padding-bottom:4px;}
.pp-foot .lbl{font-weight:800;color:var(--pp-ink);}
.pp-foot .prem{font-weight:900;color:var(--pp-prem-ink);background:var(--pp-prem-soft);border-radius:8px;}
.pp-foot .grand{font-weight:900;color:var(--accent);font-size:16px;}
.pp-warn{margin-top:14px;padding:11px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;font-size:12px;color:#92400e;line-height:1.55;}
:is([data-theme="dark"],[data-theme="midnight"]) .pp-warn{background:rgba(251,191,74,.08);border-color:rgba(251,191,74,.28);color:#fbbf24;}
.pp-head-row{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;margin-bottom:14px;}
.pp-head-row .t{font-weight:800;font-size:15px;color:var(--pp-ink);letter-spacing:-.01em;}
.pp-head-row .c{font-size:12px;color:var(--pp-mut2);}
/* rates editor */
.pp-rates{width:100%;border-collapse:collapse;font-size:12.5px;}
.pp-rates th{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--pp-mut2);font-weight:700;padding:7px 6px;border-bottom:1px solid var(--pp-line);text-align:left;}
.pp-rates th.prem{color:var(--pp-prem);}
.pp-rates td{padding:6px;border-bottom:1px solid var(--pp-line);}
.pp-rates input,.pp-rates select{border:1px solid var(--pp-line);border-radius:7px;padding:5px 7px;font-family:inherit;font-size:12px;background:var(--card,#fff);color:var(--pp-ink);}
.pp-rates .pr-prem{border-color:var(--pp-prem-bd);background:var(--pp-prem-soft);color:var(--pp-prem-ink);font-weight:800;}
.pp-rates tr.is-flat .pr-prem{opacity:.35;}
.pp-rates tr.unset{background:#fef2f2;}
:is([data-theme="dark"],[data-theme="midnight"]) .pp-rates tr.unset{background:rgba(239,68,68,.08);}
/* motion */
@keyframes ppRise{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:none;}}
.pp-animate{animation:ppRise .5s cubic-bezier(.22,1,.36,1) both;}
.pp-table tbody tr{animation:ppRise .42s cubic-bezier(.22,1,.36,1) both;}
@media (prefers-reduced-motion:reduce){.pp-animate,.pp-table tbody tr{animation:none;}}
`;
    document.head.appendChild(st);
  }
})();

/* ══════════════ PAYROLL (Accounts team only) ══════════════
   Hours come live from clock_log and are computed with the SAME
   pairing + break/coffee logic as renderHoursTable() so the payrun
   reconciles with the timesheet. Rates live in the payroll_rates
   table (Accounts-only RLS). Keep _payHoursFor in sync with
   renderHoursTable if that ever changes. */

// Extra names allowed to see Payroll besides the Accounts team.
// (e.g. add 'Sanskar Pokharel' here temporarily to test as a non-Accounts admin.)
const PAYROLL_ALLOW = [];

/** Who am I? Nexus keeps `me`; ShiftOps stashes the name at the gate. */
function _pMe(){
  try{ if(typeof window.me === 'string' && window.me) return window.me; }catch(e){}
  try{ if(typeof me === 'string' && me) return me; }catch(e){}
  try{ const s=sessionStorage.getItem('so_me'); if(s) return s; }catch(e){}
  return '';
}
/** My team. Nexus has `myTeam`; in ShiftOps, look it up in the staff array. */
function _pTeam(){
  try{ if(typeof myTeam === 'string' && myTeam) return myTeam; }catch(e){}
  try{
    const n=_pMe().trim().toLowerCase();
    if(n && typeof staff !== 'undefined' && staff && staff.length){
      const s=staff.find(function(x){
        return ((x.first||'')+' '+(x.last||'')).trim().toLowerCase()===n; });
      if(s && s.team) return s.team;
    }
  }catch(e){}
  return '';
}
/**
 * Canonical staff-name list.
 *
 * Nexus keeps a flat `STAFF` array of names; ShiftOps keeps `staff` as objects
 * with first/last. Referencing STAFF directly threw a ReferenceError in
 * ShiftOps, which rejected the promise chain and left the rates editor stuck
 * on "Loading…" with no visible error.
 */
function _pStaffNames(){
  try{
    if(typeof STAFF !== 'undefined' && Array.isArray(STAFF) && STAFF.length) return STAFF.slice();
  }catch(e){}
  try{
    if(typeof staff !== 'undefined' && Array.isArray(staff) && staff.length){
      return staff.map(function(s){ return ((s.first||'')+' '+(s.last||'')).trim(); })
                  .filter(Boolean);
    }
  }catch(e){}
  return [];
}

function _canPayroll(){
  try{
    if(PAYROLL_ALLOW.indexOf(_pMe()) >= 0) return true;
    return _pTeam() === 'Accounts';
  }catch(e){ return false; }
}

let _payRates = {};    // staff_name -> rate row
let _payResults = [];  // last run, for CSV
let _payCredNames = null; // current staff from staff_credentials (source of truth)

// Names of CURRENT staff, straight from staff_credentials — the source of
// truth. Used to build the rates-editor list so offboarded people and
// misspelled rate rows never appear as phantom entries.
async function _payLoadCredNames(){
  try{
    const r = await fetch(_pUrl()+'/rest/v1/staff_credentials?select=staff_name',
      {headers:{apikey:_pKey(), Authorization:'Bearer '+_pBearer()}});
    if(!r.ok){ console.warn('[PAYROLL] cred names', r.status); _payCredNames=null; return; }
    const rows = await r.json();
    _payCredNames = (rows||[]).map(function(x){ return (x.staff_name||'').trim(); }).filter(Boolean);
  }catch(e){ console.warn('[PAYROLL] cred names failed', e); _payCredNames=null; }
}

function _payMondayOf(d){ const x = new Date(d); const dow = (x.getDay()+6)%7; x.setDate(x.getDate()-dow); x.setHours(0,0,0,0); return x; }
function _payFmt(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }

function payShiftFortnight(offset){
  const today = new Date();
  const start = _payMondayOf(today);
  start.setDate(start.getDate() + offset*14);
  const end = new Date(start); end.setDate(start.getDate()+13);
  document.getElementById('payStart').value = _payFmt(start);
  document.getElementById('payEnd').value = _payFmt(end);
  runPayroll();
}

function initPayrollTab(){
  const today = new Date();
  const start = _payMondayOf(today);
  const end = new Date(start); end.setDate(start.getDate()+13);
  const s = document.getElementById('payStart'), e = document.getElementById('payEnd');
  if(s && !s.value) s.value = _payFmt(start);
  if(e && !e.value) e.value = _payFmt(end);
  // Load rates + current-staff names (from credentials) before rendering.
  Promise.all([loadPayRates(), _payLoadCredNames()]).then(renderRatesEditor).catch(function(err){
    console.error('[PAYROLL] rates editor failed', err);
    const el=document.getElementById('payRatesEditor');
    if(el) el.innerHTML='<div style="color:#b91c1c;font-size:13px;">Couldn\'t load rates — see console.</div>';
  });
}

async function loadPayRates(){
  _payRates = {};
  try{
    const rows = await _pGet('payroll_rates','?select=*');
    (rows||[]).forEach(function(r){ _payRates[r.staff_name] = r; });
  }catch(e){ console.warn('loadPayRates', e); }
}

// Mirrors renderHoursTable pairing exactly → net hours + coffee for one staff.
async function _payHoursFor(staff, startStr, endStr){
  const start = new Date(startStr+'T00:00:00');
  const end   = new Date(endStr+'T23:59:59');
  let logs = [];
  try{ logs = await _pGet('clock_log','?staff_name=eq.'+encodeURIComponent(staff)+'&order=ts.asc&limit=2000'); }catch(e){}
  logs = (logs||[]).filter(function(r){ const t = new Date(r.ts); return t >= start && t <= end; });
  if(!logs.length) return {net:0, coffee:0, raw:0, open:0, days:0};
  logs.sort(function(a,b){ return new Date(a.ts) - new Date(b.ts); });
  // dedupe same action + same minute (historical pileup)
  (function(){
    const seen = {};
    logs = logs.filter(function(r){
      const t = new Date(r.ts);
      const k = r.action+'|'+t.getFullYear()+'-'+(t.getMonth()+1)+'-'+t.getDate()+'|'+t.getHours()+':'+t.getMinutes();
      if(seen[k]) return false; seen[k]=1; return true;
    });
  })();
  const byDay = {}; let openIn = null; let openCount = 0;
  logs.forEach(function(r){
    const t = new Date(r.ts);
    const ft = _pFlex(t);
    const dayKey = t.toLocaleDateString('en-AU',{day:'2-digit',month:'2-digit',year:'numeric'});
    if(!byDay[dayKey]) byDay[dayKey] = {date:t, hours:0};
    if(r.action === 'in'){
      if(openIn){ openCount++; }   // previous 'in' never got an 'out'
      else { openIn = ft; }
    } else if(r.action === 'out'){
      if(openIn){
        const span = ft - openIn;
        if(span > 0 && span < 24*60*60*1000){ byDay[dayKey].hours += span/3600000; }
        openIn = null;
      }
    }
  });
  if(openIn) openCount++;          // trailing unclosed 'in'
  // overrides (custom break/coffee per date)
  let overrides = {};
  try{
    const ov = await _pGet('clock_overrides','?staff_name=eq.'+encodeURIComponent(staff)+'&date=gte.'+startStr+'&date=lte.'+endStr);
    (ov||[]).forEach(function(r){ overrides[r.date] = r; });
  }catch(e){}
  let net = 0, coffee = 0, raw = 0;
  Object.keys(byDay).forEach(function(k){
    const d = byDay[k]; raw += d.hours;
    const iso = d.date.getFullYear()+'-'+String(d.date.getMonth()+1).padStart(2,'0')+'-'+String(d.date.getDate()).padStart(2,'0');
    const ov = overrides[iso] || {};
    const ex = _pExtras(d.hours, ov.break_hrs, ov.coffee, d.date);
    net += ex.netHours; coffee += ex.coffee;
  });
  return {net:net, coffee:coffee, raw:raw, open:openCount, days:Object.keys(byDay).length};
}

function _payCalc(rate, netHours){
  const structure = rate ? rate.structure : null;
  const std  = rate ? parseFloat(rate.std_rate)  || 0 : 0;
  const prem = rate ? parseFloat(rate.prem_rate) || 0 : 0;
  const cap  = rate ? parseFloat(rate.pay_cap)   || 0 : 0;
  let ordH, premH, ordG, premG;
  if(structure === 'tiered'){
    if(netHours > cap){ ordH = cap; premH = netHours - cap; }
    else { ordH = netHours; premH = 0; }
    ordG = ordH*std; premG = premH*prem;
  } else { // flat (or unknown)
    ordH = netHours; premH = 0; ordG = netHours*std; premG = 0;
  }
  return {structure:structure, ordH:ordH, premH:premH, ordG:ordG, premG:premG, gross:ordG+premG};
}

async function runPayroll(){
  if(!_canPayroll()){ return; }
  const startStr = document.getElementById('payStart').value;
  const endStr   = document.getElementById('payEnd').value;
  const el = document.getElementById('payResults');
  if(!startStr || !endStr){ el.innerHTML = '<div style="color:#dc2626;">Pick both dates.</div>'; return; }
  await loadPayRates();

  // Roster = everyone with a rate OR any punches in this range (canonical STAFF).
  const roster = Array.from(new Set([].concat(
    Object.keys(_payRates),
    _pStaffNames().filter(Boolean)
  ))).sort(function(a,b){ return a.localeCompare(b); });

  el.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:20px;">Running payrun for '+roster.length+' staff…</div>';

  _payResults = [];
  for(const name of roster){
    const h = await _payHoursFor(name, startStr, endStr);
    const rate = _payRates[name] || null;
    // skip people with neither hours nor a rate (not on payroll this run)
    if(!rate && h.net <= 0 && h.open === 0) continue;
    const calc = _payCalc(rate, h.net);
    // Coffee ($/day allowance) is added DIRECTLY into premium. After this,
    // premG already contains coffee, gross already contains coffee, and
    // total === gross (no separate coffee line anywhere).
    const premGWithCoffee = calc.premG + h.coffee;
    const grossWithCoffee = calc.ordG + premGWithCoffee;
    _payResults.push({
      name:name, rate:rate, net:h.net, coffee:h.coffee, open:h.open,
      structure: rate ? rate.structure : '—',
      ordH:calc.ordH, premH:calc.premH, ordG:calc.ordG, premG:premGWithCoffee,
      gross:grossWithCoffee, total: grossWithCoffee, noRate: !rate
    });
  }

  // Row order: use the admin's saved custom order if one exists (manual order
  // wins — flags do NOT jump to the top). Names with no saved position fall to
  // the bottom, alphabetically, until dragged into place. Falls back to the old
  // flag-first / total-desc sort only when no custom order has been set yet.
  await _payLoadOrder();
  _payApplyOrder();

  let totGross=0, totCoffee=0, totNet=0, totOrdG=0, totPremG=0, totPremH=0, paidCount=0, premEarners=0, flags=0;
  _payResults.forEach(function(r){
    if(!r.noRate){ totGross+=r.gross; totCoffee+=r.coffee; totNet+=r.net; totOrdG+=r.ordG; totPremG+=r.premG; totPremH+=r.premH; paidCount++; if(r.premH>0) premEarners++; }
    if(r.noRate || r.open) flags++;
  });
  const rows = _payRowsHtml();

  const warn = flags ? '<div class="pp-warn"><strong>'+flags+' row(s) need a look.</strong> NO RATE = excluded from totals until you set a rate below. ⚠ OPEN = clocked in with no matching clock-out, so hours may read low — fix the punch in Timesheet Manager, then re-run.</div>' : '';

  el.innerHTML =
    '<div class="pp-animate">'+
      '<div class="pp-summary">'+
        '<div class="pp-hero">'+
          '<div class="lbl">Premium payout</div>'+
          '<div class="val">$'+totPremG.toFixed(2)+'</div>'+
          '<div class="sub"><b>'+totPremH.toFixed(1)+' hrs</b> above cap · incl. <b>$'+totCoffee.toFixed(2)+'</b> coffee</div>'+
        '</div>'+
        '<div class="pp-stat"><div class="lbl">Total pay</div><div class="val grand">$'+totGross.toFixed(2)+'</div><div class="note">'+paidCount+' paid · '+totNet.toFixed(1)+'h net</div></div>'+
        '<div class="pp-stat"><div class="lbl">Ordinary</div><div class="val">$'+totOrdG.toFixed(2)+'</div><div class="note">standard-rate hours</div></div>'+
      '</div>'+
      '<div class="pp-head-row"><div class="t">Payrun · '+startStr+' → '+endStr+'</div><div class="c">'+_payResults.length+' listed · <span style="color:var(--pp-mut2,#94a3b8);">drag ≡ to reorder</span> <button onclick="_payResetOrder()" style="background:none;border:none;color:var(--accent);font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;padding:0 0 0 8px;">reset</button></div></div>'+
      '<div class="pp-scroll"><table class="pp-table">'+
      '<thead><tr>'+
        '<th class="pp-drag-th"></th>'+
        '<th>Staff</th>'+
        '<th class="r">Net hrs</th>'+
        '<th class="r">Ordinary</th>'+
        '<th class="r prem">Premium ▲ +☕</th>'+
        '<th class="r">Total pay</th>'+
      '</tr></thead><tbody id="payTbody">'+rows+'</tbody>'+
      '<tfoot><tr class="pp-foot">'+
        '<td></td>'+
        '<td class="lbl">Totals · '+paidCount+' paid</td>'+
        '<td class="r lbl">'+totNet.toFixed(2)+'h</td>'+
        '<td class="r pp-ord">$'+totOrdG.toFixed(2)+'</td>'+
        '<td class="r prem">'+totPremH.toFixed(2)+'h · $'+totPremG.toFixed(2)+'</td>'+
        '<td class="r grand">$'+totGross.toFixed(2)+'</td>'+
      '</tr></tfoot>'+
      '</table></div>'+warn+
    '</div>';
  _paySetupDrag();
}

// ── Custom row ordering (drag to reorder — SHARED for everyone, saved in
//    Supabase app_settings under key 'payroll_order'). One order, visible to
//    every admin on every device. Manual order wins; flags don't float up. ──
var _payOrder = null;   // cached array of names, loaded from app_settings

// Load the shared order from app_settings (anon can read). Called before render.
async function _payLoadOrder(){
  try{
    var r = await fetch(_pUrl()+"/rest/v1/app_settings?key=eq.payroll_order&select=value&limit=1",
      {headers:{apikey:_pKey(), Authorization:'Bearer '+_pBearer()}});
    if(!r.ok){ _payOrder=null; return null; }
    var rows = await r.json();
    if(rows && rows.length && rows[0].value){
      _payOrder = JSON.parse(rows[0].value);
    } else {
      _payOrder = null;
    }
  }catch(e){ console.warn('[PAYROLL] load order', e); _payOrder=null; }
  return _payOrder;
}
// Save the shared order to app_settings (authenticated write via upsert).
async function _paySaveOrder(){
  try{
    var names = _payResults.map(function(r){ return r.name; });
    _payOrder = names;
    var who = '';
    try{ who = (typeof _pMe==='function') ? (_pMe()||'') : ''; }catch(e){}
    var res = await fetch(_pUrl()+"/rest/v1/app_settings",{
      method:'POST',
      headers:{
        apikey:_pKey(), Authorization:'Bearer '+_pBearer(),
        'Content-Type':'application/json',
        'Prefer':'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify([{ key:'payroll_order', value:JSON.stringify(names), updated_by:who, updated_at:new Date().toISOString() }])
    });
    if(!res.ok){
      var t = await res.text().catch(function(){return '';});
      console.warn('[PAYROLL] save order', res.status, t);
      if(typeof showToast==='function') showToast('Order not saved ('+res.status+')');
    }
  }catch(e){ console.warn('[PAYROLL] save order failed', e); }
}
async function _payResetOrder(){
  try{
    // Clear the shared order row, then re-render with default sort.
    await fetch(_pUrl()+"/rest/v1/app_settings?key=eq.payroll_order",{
      method:'DELETE', headers:{apikey:_pKey(), Authorization:'Bearer '+_pBearer(), 'Prefer':'return=minimal'}
    });
  }catch(e){ console.warn('[PAYROLL] reset order', e); }
  _payOrder = null;
  _payApplyOrder(true);
  _payRerenderBody();
  if(typeof showToast==='function') showToast('Order reset for everyone');
}
// Order _payResults using the cached shared order (_payOrder). Manual order
// wins; unknown names appended alphabetically. forceDefault or no saved order
// → original flag-first / total-desc sort.
function _payApplyOrder(forceDefault){
  try{
    var saved = forceDefault ? null : _payOrder;
    if(saved && saved.length){
      var pos = {};
      saved.forEach(function(n,i){ pos[n]=i; });
      _payResults.sort(function(a,b){
        var pa = (a.name in pos) ? pos[a.name] : Infinity;
        var pb = (b.name in pos) ? pos[b.name] : Infinity;
        if(pa !== pb) return pa - pb;
        return a.name.localeCompare(b.name);
      });
      return;
    }
  }catch(e){ console.warn('[PAYROLL] custom order failed, using default', e); }
  _payResults.sort(function(a,b){
    var fa = (a.noRate?2:0)+(a.open?1:0), fb = (b.noRate?2:0)+(b.open?1:0);
    if(fa !== fb) return fb - fa;
    return b.total - a.total;
  });
}
// Build just the <tr> rows (used on first render and after each drag).
function _payRowsHtml(){
  var rows = '';
  _payResults.forEach(function(r, i){
    try{
    var chips = '';
    if(r.noRate) chips += '<span class="pp-chip norate">NO RATE</span>';
    if(r.open)   chips += '<span class="pp-chip open" title="'+r.open+' unclosed clock-in(s) — hours may be understated">⚠ '+r.open+' OPEN</span>';
    var structTxt = r.structure==='tiered' ? ('Tiered · '+(r.rate?parseFloat(r.rate.pay_cap):'')+'h cap') : (r.structure==='flat'?'Flat rate':'—');
    var premCell = (r.premG>0)
      ? '<span class="pp-prem-pill"><span class="h">'+(r.premH>0?r.premH.toFixed(2)+'h':'coffee')+'</span><span class="d">$'+r.premG.toFixed(2)+'</span></span>'+(r.coffee>0&&r.premH>0?'<span class="pp-coffee-note" title="Includes $'+r.coffee.toFixed(2)+' coffee"> +☕</span>':'')
      : '<span class="pp-prem-zero">—</span>';
    rows += '<tr'+(r.noRate?' class="pp-flagrow"':'')+' draggable="true" data-name="'+String(r.name).replace(/"/g,'&quot;')+'">'+
      '<td class="pp-drag" title="Drag to reorder">≡</td>'+
      '<td><div class="pp-name">'+r.name+chips+'</div><div class="pp-struct">'+structTxt+'</div></td>'+
      '<td class="r pp-net">'+r.net.toFixed(2)+'h</td>'+
      '<td class="r pp-ord">'+r.ordH.toFixed(2)+'h · $'+r.ordG.toFixed(2)+'</td>'+
      '<td class="r pp-prem-cell">'+premCell+'</td>'+
      '<td class="r"><span class="pp-total">'+(r.noRate?'—':'$'+r.total.toFixed(2))+'</span></td>'+
    '</tr>';
    }catch(e){
      console.warn('[PAYROLL] row render failed for', r&&r.name, e);
      rows += '<tr data-name="'+String((r&&r.name)||'?').replace(/"/g,'&quot;')+'"><td class="pp-drag">≡</td><td>'+((r&&r.name)||'?')+'</td><td class="r">—</td><td class="r">—</td><td class="r">—</td><td class="r">—</td></tr>';
    }
  });
  return rows;
}
function _payRerenderBody(){
  var tb = document.getElementById('payTbody');
  if(tb){ tb.innerHTML = _payRowsHtml(); _paySetupDrag(); }
}
// HTML5 drag-and-drop on the tbody rows. On drop, reorder _payResults to match
// the new DOM order and persist it.
function _paySetupDrag(){
  try{
  var tb = document.getElementById('payTbody');
  if(!tb) return;
  var dragEl = null;
  var rows = tb.querySelectorAll('tr[draggable="true"]');
  rows.forEach(function(tr){
    tr.addEventListener('dragstart', function(e){
      dragEl = tr; tr.classList.add('pp-dragging');
      try{ e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain', tr.getAttribute('data-name')||''); }catch(_e){}
    });
    tr.addEventListener('dragend', function(){
      if(dragEl) dragEl.classList.remove('pp-dragging');
      dragEl = null;
      _payCommitOrderFromDom();
    });
    tr.addEventListener('dragover', function(e){
      e.preventDefault();
      if(!dragEl || dragEl===tr) return;
      var rect = tr.getBoundingClientRect();
      var after = (e.clientY - rect.top) > rect.height/2;
      if(after){ tr.parentNode.insertBefore(dragEl, tr.nextSibling); }
      else { tr.parentNode.insertBefore(dragEl, tr); }
    });
  });
  }catch(e){ console.warn('[PAYROLL] drag setup failed', e); }
}
function _payCommitOrderFromDom(){
  var tb = document.getElementById('payTbody');
  if(!tb) return;
  var order = [];
  tb.querySelectorAll('tr[data-name]').forEach(function(tr){ order.push(tr.getAttribute('data-name')); });
  // Reorder _payResults to match the DOM
  var byName = {};
  _payResults.forEach(function(r){ byName[r.name]=r; });
  var reordered = [];
  order.forEach(function(n){ if(byName[n]) reordered.push(byName[n]); });
  // safety: keep any rows not captured (shouldn't happen)
  _payResults.forEach(function(r){ if(order.indexOf(r.name)<0) reordered.push(r); });
  _payResults = reordered;
  _paySaveOrder();
}

function exportPayrollCsv(){
  if(!_payResults.length){ if(typeof showToast==='function') showToast('Run a payrun first'); return; }
  const startStr = document.getElementById('payStart').value;
  const endStr   = document.getElementById('payEnd').value;
  const head = ['Staff','Structure','Cap','Std rate','Prem rate','Net hours','Ordinary hrs','Ordinary $','Premium hrs','Premium $ (incl coffee)','of which Coffee $','Total pay $','Open punches','Note'];
  const esc = function(v){ v = (v==null?'':String(v)); return /[",\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; };
  const lines = [head.join(',')];
  _payResults.forEach(function(r){
    lines.push([
      r.name, r.structure,
      r.rate?parseFloat(r.rate.pay_cap):'', r.rate?parseFloat(r.rate.std_rate):'', r.rate?parseFloat(r.rate.prem_rate):'',
      r.net.toFixed(2), r.ordH.toFixed(2), r.ordG.toFixed(2), r.premH.toFixed(2), r.premG.toFixed(2),
      r.coffee.toFixed(2), r.noRate?'':r.total.toFixed(2), r.open||0,
      r.noRate?'NO RATE SET':(r.open?'HAS OPEN PUNCHES':'')
    ].map(esc).join(','));
  });
  const blob = new Blob([lines.join('\n')], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'payrun_'+startStr+'_to_'+endStr+'.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
}

// ── Rates editor ──
function _prCapToggle(sel){
  var inp = sel.closest('td').querySelector('.pr-cap-custom');
  if(!inp) return;
  if(sel.value==='__custom'){ inp.style.display=''; inp.focus(); } else { inp.style.display='none'; }
}

function renderRatesEditor(){
  const el = document.getElementById('payRatesEditor');
  if(!el) return;
  // Roster comes from staff_credentials (current staff) so offboarded people
  // and misspelled leftover rate rows never show as phantoms. If the creds
  // fetch failed, fall back to the old union (rates + host staff list) so the
  // editor still works rather than showing nobody.
  let roster;
  if(Array.isArray(_payCredNames) && _payCredNames.length){
    roster = Array.from(new Set(_payCredNames)).sort(function(a,b){ return a.localeCompare(b); });
  } else {
    roster = Array.from(new Set([].concat(
      Object.keys(_payRates),
      _pStaffNames().filter(Boolean)
    ))).sort(function(a,b){ return a.localeCompare(b); });
  }
  let html = '<div style="overflow-x:auto;"><table class="pp-rates">'+
    '<thead><tr>'+
      '<th>Staff</th>'+
      '<th>Structure</th>'+
      '<th>Std $/h</th>'+
      '<th class="prem">Prem $/h ▲</th>'+
      '<th>Cap</th>'+
    '</tr></thead><tbody>';
  roster.forEach(function(n){
    const r = _payRates[n] || {structure:'flat', std_rate:0, prem_rate:0, pay_cap:48};
    const nn = n.replace(/"/g,'&quot;');
    const missing = !_payRates[n];
    const isFlat = (r.structure!=='tiered');
    html += '<tr class="'+(missing?'unset ':'')+(isFlat?'is-flat':'')+'" data-name="'+nn+'">'+
      '<td style="font-weight:600;color:var(--pp-ink,#0f172a);">'+n+(missing?' <span style="color:#b91c1c;font-size:10px;font-weight:800;">unset</span>':'')+'</td>'+
      '<td><select class="pr-struct" onchange="this.closest(\'tr\').classList.toggle(\'is-flat\', this.value!==\'tiered\')"><option value="tiered"'+(r.structure==='tiered'?' selected':'')+'>Tiered</option><option value="flat"'+(isFlat?' selected':'')+'>Flat</option></select></td>'+
      '<td><input class="pr-std" type="number" step="0.01" value="'+(parseFloat(r.std_rate)||0)+'" style="width:66px;"></td>'+
      '<td><input class="pr-prem" type="number" step="0.01" value="'+(parseFloat(r.prem_rate)||0)+'" style="width:66px;"></td>'+
      "<td>" + (function(){ var cap=parseFloat(r.pay_cap); var isPreset=(cap===48||cap===76); var isCustom=(!isNaN(cap)&&!isPreset); return '<select class="pr-cap" onchange="_prCapToggle(this)"><option value="48"'+(cap===48?' selected':'')+'>48</option><option value="76"'+(cap===76?' selected':'')+'>76</option><option value="__custom"'+(isCustom?' selected':'')+'>Custom\u2026</option></select><input class="pr-cap-custom" type="number" step="0.01" min="0" placeholder="hrs" value="'+(isCustom?cap:'')+'" style="width:66px;margin-left:6px;'+(isCustom?'':'display:none;')+'">'; })() + "</td>" +
    '</tr>';
  });
  html += '</tbody></table></div>'+
    '<button onclick="savePayRates()" class="btn btn-green" style="margin-top:14px;padding:10px 18px;font-size:12px;">Save all rates</button>';
  el.innerHTML = html;
}

async function savePayRates(){
  if(!_canPayroll()){ return; }
  const rows = document.querySelectorAll('#payRatesEditor tr[data-name]');
  const payload = [];
  rows.forEach(function(tr){
    payload.push({
      staff_name: tr.getAttribute('data-name'),
      structure: tr.querySelector('.pr-struct').value,
      std_rate: parseFloat(tr.querySelector('.pr-std').value) || 0,
      prem_rate: parseFloat(tr.querySelector('.pr-prem').value) || 0,
      pay_cap: (function(){ var sel=tr.querySelector('.pr-cap'); if(sel.value==='__custom'){ var c=parseFloat(tr.querySelector('.pr-cap-custom').value); return (!isNaN(c)&&c>0)?c:48; } return parseFloat(sel.value)||48; })(),
      updated_at: new Date().toISOString(),
      updated_by: _pMe()
    });
  });
  try{
    const res = await fetch(_pUrl()+'/rest/v1/payroll_rates',{
      method:'POST',
      headers:{'apikey':_pKey(),'Authorization':'Bearer '+_pBearer(),'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},
      body: JSON.stringify(payload)
    });
    if(res.ok){ if(typeof showToast==='function') showToast('Rates saved'); await loadPayRates(); renderRatesEditor(); }
    else { const t = await res.text().catch(function(){return '';}); if(typeof showToast==='function') showToast('Save failed ('+res.status+')'); console.warn('savePayRates', res.status, t); }
  }catch(e){ if(typeof showToast==='function') showToast('Save failed'); console.warn(e); }
}
