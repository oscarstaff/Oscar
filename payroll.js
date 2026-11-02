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
  // NOTE: previously this delegated with `return _pGet(...)` which called ITSELF
  // (infinite recursion / stack overflow) whenever sbGet existed — that silently
  // blew up payroll fetches. Do the fetch directly and THROW on failure so the
  // caller can tell "no hours" apart from "the request failed".
  const r = await fetch(_pUrl()+'/rest/v1/'+table+(qs||''),
    {headers:{apikey:_pKey(), Authorization:'Bearer '+_pBearer()}});
  if(!r.ok){
    console.warn('payroll _pGet', table, r.status);
    var err = new Error('fetch failed '+r.status+' for '+table);
    err.status = r.status;
    throw err;
  }
  return r.json();
}
function _pEsc(s){
  if(typeof esc === 'function') return esc(s);
  return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
/* ── Sydney day boundaries ──────────────────────────────────────────────────
   Every timesheet day is a SYDNEY day, whatever timezone this browser is set to.
   (Sophiya's 9:35am Sydney clock-in is 10:35pm the day before in UTC, so a browser
   on any other clock filed it under the wrong date and the day showed no clock-in.)
   _tzKey  ts -> 'YYYY-MM-DD' (Sydney date)
   _tzWall ts -> Date whose local getters read the Sydney wall clock
   _tzIso  'YYYY-MM-DD','HH:MM' (Sydney) -> UTC ISO string
   _tzWide 'YYYY-MM-DD' -> {s,e} UTC ISO bounds wide enough to cover that Sydney day
   Identical copy lives in payroll.js. */
function _tzWallMs(ms){
  var p={}; new Intl.DateTimeFormat('en-GB',{timeZone:'Australia/Sydney',hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'})
    .formatToParts(new Date(ms)).forEach(function(x){ p[x.type]=x.value; });
  return Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);
}
function _tzKey(ts){ var w=new Date(_tzWallMs(new Date(ts).getTime())); return w.getUTCFullYear()+'-'+String(w.getUTCMonth()+1).padStart(2,'0')+'-'+String(w.getUTCDate()).padStart(2,'0'); }
function _tzWall(ts){ var w=new Date(_tzWallMs(new Date(ts).getTime())); return new Date(w.getUTCFullYear(),w.getUTCMonth(),w.getUTCDate(),w.getUTCHours(),w.getUTCMinutes(),w.getUTCSeconds()); }
function _tzIso(dateStr,hhmm){
  var d=String(dateStr).split('-'), t=String(hhmm||'00:00').split(':');
  var guess=Date.UTC(+d[0],+d[1]-1,+d[2],+t[0],+t[1]||0,0);
  var ms=guess-(_tzWallMs(guess)-guess); ms=guess-(_tzWallMs(ms)-ms);
  return new Date(ms).toISOString();
}
function _tzWide(dateStr){ return { s:new Date(Date.parse(_tzIso(dateStr,'00:00'))-864e5).toISOString(), e:new Date(Date.parse(_tzIso(dateStr,'23:59'))+864e5).toISOString() }; }

/** 7-minute flex rounding. Uses the host's version where there is one so the
 *  payrun can't drift from the timesheet; the fallback below is the same rule. */
function _pFlex(date){
  if(typeof flexClockTime === 'function') return flexClockTime(date);
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
  if(typeof calcDayExtras === 'function') return calcDayExtras(rawHours, customBreak, customCoffee, dateObj);
  let isWeekend=false;
  if(dateObj){
    let dow;
    if(typeof dateObj==='string' && /^\d{4}-\d{2}-\d{2}$/.test(dateObj)){ const q=dateObj.split('-'); dow=new Date(+q[0],+q[1]-1,+q[2]).getDay(); }
    else { const d=(dateObj instanceof Date)?dateObj:new Date(dateObj); dow=d.getDay(); }
    isWeekend=(dow===0||dow===6); }
  const autoBreak = isWeekend ? 0 : (rawHours>5 ? 0.5 : 0);
  let breakHrs = (customBreak!==undefined&&customBreak!==null&&customBreak!=='')?parseFloat(customBreak):autoBreak;
  let coffee   = (customCoffee!==undefined&&customCoffee!==null&&customCoffee!=='')?parseFloat(customCoffee):(rawHours>=4?5:0);
  if(isNaN(breakHrs)) breakHrs=0;
  if(isNaN(coffee)) coffee=0;
  return { netHours: Math.max(0, rawHours-breakHrs), breakHrs:breakHrs, coffee:coffee };
}

(function(){
  'use strict';

  // Flag the ShiftOps host so the dark palette can key off "not data-theme=light" there (its dark is the default, with no attribute).
  try{ if(typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL) document.documentElement.classList.add('pp-so'); }catch(e){}

  // Inject the module's own styles rather than adding them to index.html.
  if(!document.getElementById('payroll-styles')){
    var st = document.createElement('style');
    st.id = 'payroll-styles';
    st.textContent = `
#rsec-payroll{
  --pp-prem:#b45309; --pp-prem-ink:#7c2d12; --pp-prem-soft:#fff7ed; --pp-prem-bd:#fed7aa;
  --pp-ord:#475569; --pp-line:#e2e8f0; --pp-ink:#0f172a; --pp-mut:#3f4d60; --pp-mut2:#5a6a7e;
  --pp-good:#047857; --pp-field:#ffffff;
  --pp-bad:#b91c1c; --pp-bad-ink:#991b1b; --pp-bad-soft:#fef2f2; --pp-bad-bd:#fecaca;
  --pp-warn-ink:#92400e; --pp-warn-soft:#fffbeb; --pp-warn-bd:#fde68a;
  --pp-norate-bg:#fee2e2; --pp-norate-ink:#b91c1c; --pp-open-bg:#fef3c7; --pp-open-ink:#b45309;
  /* makeover tokens: neutral tints so one rule works on every theme */
  --pp-hair:rgba(100,116,139,.18); --pp-surf:rgba(100,116,139,.07); --pp-surf-hi:rgba(100,116,139,.12);
  --pp-thumb:#ffffff; --pp-thumb-sh:0 1px 2px rgba(15,23,42,.14),0 0 0 .5px rgba(15,23,42,.06);
  --pp-ring:rgba(37,99,235,.30); --pp-edge:rgba(255,255,255,.7);
  --pp-ease:cubic-bezier(.22,1,.36,1);
  color-scheme:light;
}
/* Dark palette. Applies to ALL of: ShiftOps dark (its default: no data-theme attribute; light is data-theme="light",
   flagged by the pp-so class set below) and every dark Nexus theme. Every text token is >= 5.4:1 on the darkest AND
   lightest dark surface payroll sits on (checked against ShiftOps surfaces and all Nexus dark cards). */
:is([data-theme="dark"],[data-theme="midnight"],[data-theme="renaissance"],[data-theme="graphite"],[data-theme="evergreen"],[data-theme="ember"],[data-theme="plum"],[data-theme="deepsea"]) #rsec-payroll,
html.pp-so:not([data-theme="light"]) #rsec-payroll{
  --pp-prem:#fbbf24; --pp-prem-ink:#fde68a; --pp-prem-soft:rgba(251,191,74,.10); --pp-prem-bd:rgba(251,191,74,.32);
  --pp-ord:#a3b5ca; --pp-line:#2c3c56; --pp-ink:#e8eef7; --pp-mut:#a3b5ca; --pp-mut2:#94a8be;
  --pp-good:#34d399; --pp-field:rgba(255,255,255,.06);
  --pp-bad:#fca5a5; --pp-bad-ink:#fca5a5; --pp-bad-soft:rgba(239,68,68,.10); --pp-bad-bd:rgba(239,68,68,.35);
  --pp-warn-ink:#fbbf24; --pp-warn-soft:rgba(251,191,74,.08); --pp-warn-bd:rgba(251,191,74,.28);
  --pp-norate-bg:rgba(239,68,68,.16); --pp-norate-ink:#fca5a5; --pp-open-bg:rgba(251,191,36,.14); --pp-open-ink:#fcd34d;
  --pp-hair:rgba(148,163,184,.16); --pp-surf:rgba(148,163,184,.08); --pp-surf-hi:rgba(148,163,184,.14);
  --pp-thumb:rgba(255,255,255,.16); --pp-thumb-sh:0 1px 2px rgba(0,0,0,.4),inset 0 .5px 0 rgba(255,255,255,.18);
  --pp-ring:rgba(96,165,250,.38); --pp-edge:rgba(255,255,255,.07);
  color-scheme:dark;
}
/* Retro 95 (grey surface): darker text tokens */
[data-theme="win95"] #rsec-payroll{ --pp-mut:#1f2937; --pp-mut2:#2b3a4d; --pp-ord:#1f2937; --pp-good:#04503a; --pp-bad:#8a2020; --pp-line:#7b7b7b; --pp-hair:rgba(0,0,0,.28); }

/* controls ─ instant press feedback, springy release */
#rsec-payroll button{ -webkit-tap-highlight-color:transparent; }
.pp-seg{display:inline-flex;background:var(--pp-surf);border-radius:11px;padding:3px;gap:2px;}
.pp-seg button{border:none;background:transparent;font-family:inherit;font-size:12px;font-weight:600;letter-spacing:.005em;color:var(--pp-mut);padding:7px 14px;border-radius:8px;cursor:pointer;
  transition:background .2s var(--pp-ease),color .2s var(--pp-ease),box-shadow .2s var(--pp-ease),transform .18s var(--pp-ease);}
.pp-seg button:hover{color:var(--pp-ink);}
.pp-seg button.on{background:var(--pp-thumb);color:var(--pp-ink);box-shadow:var(--pp-thumb-sh);}
.pp-seg button:active{transform:scale(.95);transition-duration:70ms;}
.pp-controls{display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;}
.pp-field{flex:1;min-width:140px;}
.pp-lab{display:block;font-size:11px;font-weight:600;letter-spacing:.02em;color:var(--pp-mut2);margin:0 0 5px 2px;}
.pp-in{width:100%;box-sizing:border-box;border:1px solid var(--pp-hair);border-radius:10px;padding:9px 12px;font-size:13px;font-family:inherit;font-variant-numeric:tabular-nums;
  outline:none;background:var(--pp-field);color:var(--pp-ink);transition:box-shadow .18s var(--pp-ease),border-color .18s var(--pp-ease);}
.pp-in:focus{border-color:var(--pp-ring);box-shadow:0 0 0 3px var(--pp-ring);}
#rsec-payroll .pp-controls .btn{transition:transform .18s var(--pp-ease),filter .15s,opacity .15s;}
#rsec-payroll .pp-controls .btn:active{transform:scale(.96);transition-duration:70ms;}
#rsec-payroll .pp-controls .btn[disabled]{opacity:.55;cursor:progress;}
/* summary band — premium leads */
.pp-summary{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr) minmax(0,1fr);gap:12px;margin-bottom:22px;}
@media(max-width:660px){.pp-summary{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}.pp-hero{grid-column:1/-1;}.pp-stat{padding:15px 16px;}}
.pp-hero{background:linear-gradient(155deg,var(--pp-prem-soft),transparent 78%),var(--pp-surf);border-radius:18px;padding:20px 22px 19px;position:relative;overflow:hidden;box-shadow:inset 0 1px 0 var(--pp-edge);}
.pp-hero .lbl{font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--pp-prem);}
.pp-hero .val{font-size:clamp(32px,6.4vw,44px);font-weight:800;letter-spacing:-.04em;color:var(--pp-prem-ink);font-variant-numeric:tabular-nums;line-height:1;margin-top:10px;}
.pp-hero .sub{font-size:12.5px;color:var(--pp-mut);margin-top:11px;font-weight:500;line-height:1.5;}
.pp-hero .sub b{color:var(--pp-prem);font-weight:700;}
.pp-stat{background:var(--pp-surf);border-radius:18px;padding:18px 20px;display:flex;flex-direction:column;justify-content:center;box-shadow:inset 0 1px 0 var(--pp-edge);}
.pp-stat .lbl{font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--pp-mut2);}
.pp-stat .val{font-size:clamp(20px,5.6vw,25px);font-weight:700;color:var(--pp-ink);font-variant-numeric:tabular-nums;margin-top:8px;letter-spacing:-.03em;line-height:1.05;}
.pp-stat .val.grand{color:var(--accent-text,var(--accent));}
.pp-stat .note{font-size:11.5px;color:var(--pp-mut2);margin-top:7px;}
/* table — hairlines only, rows are the unit */
.pp-scroll{overflow-x:auto;margin:0 -6px;padding:0 6px;}
.pp-table{width:100%;border-collapse:separate;border-spacing:0;font-size:13px;min-width:660px;}
.pp-table thead th{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--pp-mut2);font-weight:600;padding:10px 12px;border-bottom:1px solid var(--pp-hair);text-align:left;white-space:nowrap;}
.pp-table thead th.r{text-align:right;}
.pp-table tbody td{padding:12px 12px;border-bottom:1px solid var(--pp-hair);transition:background .15s;}
.pp-table tbody tr:last-child td{border-bottom:none;}
.pp-table tbody tr:hover td{background:var(--pp-surf);}
.pp-table tbody tr:hover td.pp-prem-cell{background:var(--pp-surf-hi);}
.pp-table tbody tr:hover td:first-child{border-radius:10px 0 0 10px;}
.pp-table tbody tr:hover td:last-child{border-radius:0 10px 10px 0;}
.pp-table td.r{text-align:right;font-variant-numeric:tabular-nums;}
.pp-name{white-space:nowrap;font-weight:600;color:var(--pp-ink);letter-spacing:-.005em;display:flex;align-items:center;flex-wrap:wrap;gap:6px;}
.pp-struct{white-space:nowrap;font-size:11.5px;color:var(--pp-mut2);margin-top:2px;}
.pp-ord{color:var(--pp-ord);font-size:12.5px;font-variant-numeric:tabular-nums;}
.pp-prem-pill{display:inline-flex;align-items:baseline;gap:7px;background:var(--pp-prem-soft);border-radius:999px;padding:3px 11px;box-shadow:inset 0 0 0 1px var(--pp-prem-bd);}
.pp-prem-pill .h{font-size:11px;font-weight:600;color:var(--pp-prem);font-variant-numeric:tabular-nums;}
.pp-prem-pill .d{font-size:13px;font-weight:700;color:var(--pp-prem-ink);font-variant-numeric:tabular-nums;letter-spacing:-.01em;}
.pp-prem-zero{color:var(--pp-mut2);font-size:12px;opacity:.45;}
.pp-flat-pill{background:transparent;box-shadow:none;padding:3px 4px;}
.pp-flat-pill .h{color:var(--pp-mut2);font-weight:500;}
.pp-flat-pill .d{font-weight:600;color:var(--pp-mut);}
/* Premium columns keep a soft tinted band so Accounts can find them at a glance. */
.pp-table thead th.prem{color:var(--pp-prem);background:var(--pp-prem-soft);}
.pp-table thead th.prem:first-of-type{border-radius:10px 0 0 0;}
.pp-table thead th.prem:last-of-type{border-radius:0 10px 0 0;}
.pp-table td.pp-prem-cell{background:var(--pp-prem-soft);}
.pp-net{font-weight:600;color:var(--pp-ink);}
.pp-total{font-weight:800;color:var(--pp-ink);font-size:14px;font-variant-numeric:tabular-nums;letter-spacing:-.015em;}
.pp-coffee{color:var(--pp-good);font-weight:600;font-variant-numeric:tabular-nums;}
.pp-coffee.zero{color:var(--pp-mut2);font-weight:400;}
.pp-coffee-note{color:var(--pp-good);font-size:11px;font-weight:700;margin-left:4px;}
.pp-drag-th{width:30px;}
.pp-drag{width:30px;text-align:center;color:var(--pp-mut2);cursor:grab;user-select:none;font-size:15px;line-height:1;opacity:.35;transition:opacity .15s;}
.pp-table tbody tr:hover .pp-drag{opacity:.9;}
.pp-drag:active{cursor:grabbing;}
.pp-table tbody tr.pp-dragging{opacity:.96;position:relative;z-index:5;transform:scale(1.008);box-shadow:0 14px 30px -12px rgba(15,23,42,.45),0 0 0 1px var(--pp-hair);}
.pp-table tbody tr.pp-dragging td{background:var(--pp-thumb-solid,var(--pp-prem-soft));}
.pp-table tbody tr{transition:transform .22s var(--pp-ease),box-shadow .22s var(--pp-ease);}
.pp-flagrow td{background:var(--pp-bad-soft);}
.pp-chip{font-size:10px;font-weight:700;letter-spacing:.03em;padding:2px 8px;border-radius:999px;white-space:nowrap;}
.pp-chip.norate{background:var(--pp-norate-bg);color:var(--pp-norate-ink);}
.pp-chip.open{background:var(--pp-open-bg);color:var(--pp-open-ink);}
.pp-foot td{border-top:1px solid var(--pp-hair);border-bottom:none;padding:16px 12px 10px;}
.pp-foot .lbl{font-weight:700;color:var(--pp-ink);}
.pp-foot .prem{font-weight:800;color:var(--pp-prem-ink);background:var(--pp-prem-soft);}
.pp-foot .grand{font-weight:800;color:var(--accent-text,var(--accent));font-size:17px;letter-spacing:-.02em;}
.pp-warn{margin-top:16px;padding:12px 15px;background:var(--pp-warn-soft);border-radius:12px;font-size:12.5px;color:var(--pp-warn-ink);line-height:1.55;box-shadow:inset 0 0 0 1px var(--pp-warn-bd);}
.pp-warn.pp-warn-err{background:var(--pp-bad-soft);color:var(--pp-bad-ink);box-shadow:inset 0 0 0 1px var(--pp-bad-bd);}
.pp-head-row{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px 14px;margin-bottom:14px;}
.pp-head-row .t{font-weight:700;font-size:16px;color:var(--pp-ink);letter-spacing:-.02em;}
.pp-head-row .c{font-size:12px;color:var(--pp-mut2);}
.pp-reset{background:none;border:none;color:var(--accent-text,var(--accent));font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;padding:2px 0 2px 8px;border-radius:6px;transition:opacity .15s,transform .15s var(--pp-ease);}
.pp-reset:active{transform:scale(.94);transition-duration:70ms;}
/* collapsible rates */
#rsec-payroll details>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;font-weight:700;font-size:15px;letter-spacing:-.015em;color:var(--pp-ink);}
#rsec-payroll details>summary::-webkit-details-marker{display:none;}
.pp-chev{display:inline-block;color:var(--pp-mut2);font-size:18px;line-height:1;transition:transform .28s var(--pp-ease);}
#rsec-payroll details[open]>summary .pp-chev{transform:rotate(90deg);}
/* rates editor */
.pp-rates{width:100%;border-collapse:collapse;font-size:12.5px;}
.pp-rates th{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--pp-mut2);font-weight:600;padding:8px 8px;border-bottom:1px solid var(--pp-hair);text-align:left;}
.pp-rates th.prem{color:var(--pp-prem);}
.pp-rates td{padding:7px 8px;border-bottom:1px solid var(--pp-hair);}
.pp-rates tbody tr:last-child td{border-bottom:none;}
.pp-rates input,.pp-rates select{border:1px solid var(--pp-hair);border-radius:9px;padding:6px 9px;font-family:inherit;font-size:12.5px;background:var(--pp-field);color:var(--pp-ink);outline:none;font-variant-numeric:tabular-nums;transition:box-shadow .18s var(--pp-ease),border-color .18s var(--pp-ease),opacity .2s;}
.pp-rates input:focus,.pp-rates select:focus{border-color:var(--pp-ring);box-shadow:0 0 0 3px var(--pp-ring);}
.pp-rates .pr-prem{background:var(--pp-prem-soft);color:var(--pp-prem-ink);font-weight:700;}
.pp-rates tr.is-flat .pr-prem,.pp-rates tr.is-flat .pr-cap{opacity:.35;}
.pp-rates tr.unset td{background:var(--pp-bad-soft);}
.pp-rates tr.unset td:first-child{border-radius:10px 0 0 10px;} .pp-rates tr.unset td:last-child{border-radius:0 10px 10px 0;}
/* loading skeleton */
.pp-load{padding:2px 0;}
.pp-load .msg{font-size:12.5px;color:var(--pp-mut2);margin:0 0 14px 2px;font-variant-numeric:tabular-nums;}
.pp-skel{background:var(--pp-surf);border-radius:12px;position:relative;overflow:hidden;}
.pp-skel::after{content:'';position:absolute;inset:0;background:linear-gradient(100deg,transparent 20%,var(--pp-surf-hi) 50%,transparent 80%);transform:translateX(-100%);animation:ppShine 1.4s ease-in-out infinite;}
.pp-load .row1{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr) minmax(0,1fr);gap:12px;margin-bottom:12px;}
.pp-load .row1 .pp-skel{height:104px;border-radius:18px;}
.pp-load .row2 .pp-skel{height:38px;margin-top:8px;}
@media(max-width:660px){.pp-load .row1{grid-template-columns:repeat(2,minmax(0,1fr));}.pp-load .row1 .pp-skel:first-child{grid-column:1/-1;}}
/* motion — compositor-only, released after the entrance so drags can transform rows */
@keyframes ppRise{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}
@keyframes ppShine{to{transform:translateX(100%);}}
.pp-animate{animation:ppRise .45s var(--pp-ease) backwards;}
.pp-table tbody tr{animation:ppRise .4s var(--pp-ease) backwards;animation-delay:calc(var(--i,0)*16ms);}
/* accessibility signals */
@media (prefers-reduced-motion:reduce){
  .pp-animate,.pp-table tbody tr{animation:ppFade .2s linear backwards;animation-delay:0s;}
  .pp-skel::after{animation:none;}
  .pp-seg button:active,.pp-reset:active,#rsec-payroll .pp-controls .btn:active{transform:none;}
  .pp-table tbody tr.pp-dragging{transform:none;}
  .pp-chev{transition:none;}
}
@keyframes ppFade{from{opacity:0;}to{opacity:1;}}
@media (prefers-contrast:more){
  #rsec-payroll{--pp-hair:rgba(100,116,139,.6);}
  .pp-hero,.pp-stat{box-shadow:inset 0 0 0 1px var(--pp-hair);}
  .pp-prem-pill{box-shadow:inset 0 0 0 1px var(--pp-prem);}
}
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

function _paySegMark(offset){
  try{ document.querySelectorAll('#rsec-payroll .pp-seg button').forEach(function(b){ b.classList.toggle('on', +b.getAttribute('data-off')===offset); }); }catch(e){}
}
function payShiftFortnight(offset){
  const today = new Date();
  const start = _payMondayOf(today);
  start.setDate(start.getDate() + offset*14);
  const end = new Date(start); end.setDate(start.getDate()+13);
  document.getElementById('payStart').value = _payFmt(start);
  document.getElementById('payEnd').value = _payFmt(end);
  _paySegMark(offset);
  runPayroll();
}

function initPayrollTab(){
  const today = new Date();
  const start = _payMondayOf(today);
  const end = new Date(start); end.setDate(start.getDate()+13);
  const s = document.getElementById('payStart'), e = document.getElementById('payEnd');
  if(s && !s.value) s.value = _payFmt(start);
  if(e && !e.value) e.value = _payFmt(end);
  if(s && s.value===_payFmt(start)) _paySegMark(0);   // dates are on this fortnight
  // Load rates + current-staff names (from credentials) before rendering.
  Promise.all([loadPayRates(), _payLoadCredNames()]).then(renderRatesEditor).catch(function(err){
    console.error('[PAYROLL] rates editor failed', err);
    const el=document.getElementById('payRatesEditor');
    if(el) el.innerHTML='<div style="color:var(--pp-bad,#b91c1c);font-size:13px;">Couldn\'t load rates — see console.</div>';
  });
}

async function loadPayRates(){
  // Retry once — a transient failure here used to leave _payRates empty, so
  // EVERYONE showed "NO RATE" and dropped out of the run. Return true/false so
  // runPayroll can stop with a clear message instead of a broken partial table.
  for(let attempt=0; attempt<2; attempt++){
    try{
      const rows = await _pGet('payroll_rates','?select=*');
      _payRates = {};
      (rows||[]).forEach(function(r){ _payRates[r.staff_name] = r; });
      return true;
    }catch(e){
      console.warn('loadPayRates attempt '+attempt, e);
      if(attempt===0){ await new Promise(function(res){ setTimeout(res, 400); }); }
    }
  }
  return false;
}

// Mirrors renderHoursTable pairing exactly → net hours + coffee for one staff.
async function _payHoursFor(staff, startStr, endStr){
  let logs = null;
  // Try up to 2 times — a single expired-token/network blip shouldn't wipe a
  // staff member's hours. If BOTH attempts fail, return an error flag so the
  // caller shows "couldn't load" rather than a silent 0 (the old bug: a failed
  // fetch looked identical to "worked no hours", so rows vanished mid-payrun).
  for(let attempt=0; attempt<2 && logs===null; attempt++){
    try{ logs = await _pGet('clock_log','?staff_name=eq.'+encodeURIComponent(staff)+'&order=ts.asc&limit=2000'); }
    catch(e){ logs = null; if(attempt===0){ await new Promise(function(res){ setTimeout(res, 400); }); } }
  }
  if(logs === null){ return {net:0, coffee:0, raw:0, open:0, days:0, loadError:true}; }
  logs = (logs||[]).filter(function(r){ const k = _tzKey(r.ts); return k >= startStr && k <= endStr; });
  if(!logs.length) return {net:0, coffee:0, raw:0, open:0, days:0};
  logs.sort(function(a,b){ return new Date(a.ts) - new Date(b.ts); });
  // dedupe same action + same minute (historical pileup)
  (function(){
    const seen = {};
    logs = logs.filter(function(r){
      const t = _tzWall(r.ts);
      const k = r.action+'|'+t.getFullYear()+'-'+(t.getMonth()+1)+'-'+t.getDate()+'|'+t.getHours()+':'+t.getMinutes();
      if(seen[k]) return false; seen[k]=1; return true;
    });
  })();
  const byDay = {}; let openIn = null; let openCount = 0;
  logs.forEach(function(r){
    const t = _tzWall(r.ts);
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
    const ex = _pExtras(d.hours, ov.break_hrs, ov.coffee, iso);
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

var _payRunSeq = 0;   // each run gets a ticket; a newer run makes older ones stop
function _payBusy(on){
  try{ document.querySelectorAll('#rsec-payroll button[onclick^="runPayroll"],#rsec-payroll .pp-seg button').forEach(function(b){ b.disabled=!!on; if(b.hasAttribute('onclick') && b.getAttribute('onclick').indexOf('runPayroll')===0) b.textContent = on?'Running…':'Run payrun'; }); }catch(e){}
}
function _payLoadingHtml(msg){
  return '<div class="pp-load"><div class="msg" id="ppProg">'+msg+'</div>'+
    '<div class="row1"><div class="pp-skel"></div><div class="pp-skel"></div><div class="pp-skel"></div></div>'+
    '<div class="row2"><div class="pp-skel"></div><div class="pp-skel"></div><div class="pp-skel"></div><div class="pp-skel"></div></div></div>';
}
async function runPayroll(){
  if(!_canPayroll()){ return; }
  // Guard against overlapping runs. Two runs used to push into the same
  // _payResults list, so a second tap on a slow first load listed everyone twice.
  const myRun = ++_payRunSeq;
  const startStr = document.getElementById('payStart').value;
  const endStr   = document.getElementById('payEnd').value;
  const el = document.getElementById('payResults');
  if(!startStr || !endStr){ el.innerHTML = '<div style="color:var(--pp-bad,#dc2626);">Pick both dates.</div>'; return; }
  el.innerHTML = _payLoadingHtml('Loading rates…');
  _payBusy(true);
  try{ await _payRunInner(myRun, startStr, endStr, el); }
  catch(err){ console.error('[PAYROLL] run failed', err); if(myRun===_payRunSeq) el.innerHTML='<div style="color:var(--pp-bad,#dc2626);padding:20px;text-align:center;"><b>Payrun failed.</b><br>Refresh the page and try again.</div>'; }
  finally{ if(myRun===_payRunSeq) _payBusy(false); }
}

async function _payRunInner(myRun, startStr, endStr, el){
  // Proactively refresh the auth token before a run so a long payrun doesn't
  // fail partway through on an expired session (the "only 3–4 staff show" bug).
  try{
    if(window._soSbClient && window._soSbClient.auth){
      const sess = await window._soSbClient.auth.getSession();
      if(sess && sess.data && sess.data.session && sess.data.session.access_token){
        try{ sessionStorage.setItem('so_sb_at', sess.data.session.access_token); }catch(_e){}
      }
    }
  }catch(_e){}

  const ratesOk = await loadPayRates();
  if(!ratesOk){
    if(myRun!==_payRunSeq) return;
    el.innerHTML = '<div style="color:var(--pp-bad,#dc2626);padding:20px;text-align:center;"><b>Couldn\'t load pay rates.</b><br>Your session may have expired — refresh the page (or log in again) and run the payrun once more.</div>';
    return;
  }

  // Roster = everyone with a rate OR any punches in this range (canonical STAFF).
  // Names are de-duplicated on trimmed, lower-cased text so stray spacing or
  // casing can't list one person twice.
  const _seenN = {};
  const roster = [].concat(Object.keys(_payRates), _pStaffNames().filter(Boolean))
    .map(function(n){ return String(n).trim(); }).filter(function(n){
      const k = n.toLowerCase(); if(!n || _seenN[k]) return false; _seenN[k]=1; return true; })
    .sort(function(a,b){ return a.localeCompare(b); });

  if(myRun!==_payRunSeq) return;
  el.innerHTML = _payLoadingHtml('Running payrun · 0 of '+roster.length);

  const results = [];   // local until the run finishes — never shared between runs
  let _loadErrors = 0, _done = 0;
  for(const name of roster){
    const h = await _payHoursFor(name, startStr, endStr);
    if(myRun!==_payRunSeq) return;   // a newer run took over
    _done++; const pg=document.getElementById('ppProg'); if(pg) pg.textContent='Running payrun · '+_done+' of '+roster.length;
    const rate = _payRates[name] || null;
    if(h.loadError) _loadErrors++;
    // skip people with neither hours nor a rate (not on payroll this run) —
    // BUT never skip someone whose hours failed to load; show them flagged.
    if(!rate && h.net <= 0 && h.open === 0 && !h.loadError) continue;
    const calc = _payCalc(rate, h.net);
    // Keep premium and coffee as DISTINCT figures so the table can show them
    // separately AND combined:
    //   premOnly  = pay for premium hours only (no coffee)
    //   coffee    = daily coffee allowance
    //   premPlus  = premOnly + coffee (the combined column)
    // gross/total include everything (ordinary + premium + coffee).
    const premOnly = calc.premG;
    const premPlus = premOnly + h.coffee;
    const grossAll = calc.ordG + premPlus;
    results.push({
      name:name, rate:rate, net:h.net, coffee:h.coffee, open:h.open,
      structure: rate ? rate.structure : '—',
      ordH:calc.ordH, premH:calc.premH, ordG:calc.ordG,
      premOnly:premOnly, premPlus:premPlus,
      premG:premPlus,  // kept for back-compat (CSV etc.)
      gross:grossAll, total: grossAll, noRate: !rate, loadError: !!h.loadError
    });
  }

  // Row order: use the admin's saved custom order if one exists (manual order
  // wins — flags do NOT jump to the top). Names with no saved position fall to
  // the bottom, alphabetically, until dragged into place. Falls back to the old
  // flag-first / total-desc sort only when no custom order has been set yet.
  await _payLoadOrder();
  if(myRun!==_payRunSeq) return;
  _payResults = results;
  _payApplyOrder();

  let totGross=0, totCoffee=0, totNet=0, totOrdG=0, totPremOnly=0, totPremPlus=0, totPremH=0, paidCount=0, premEarners=0, flatCount=0, flags=0;
  _payResults.forEach(function(r){
    if(!r.noRate){ totGross+=r.gross; totCoffee+=r.coffee; totNet+=r.net; totOrdG+=r.ordG; totPremOnly+=r.premOnly; totPremPlus+=r.premPlus; totPremH+=r.premH; paidCount++; if(r.premH>0) premEarners++; if(r.structure==='flat') flatCount++; }
    if(r.noRate || r.open) flags++;
  });
  const rows = _payRowsHtml();

  const warn = flags ? '<div class="pp-warn"><strong>'+flags+' row(s) need a look.</strong> NO RATE = excluded from totals until you set a rate below. ⚠ OPEN = clocked in with no matching clock-out, so hours may read low — fix the punch in Timesheet Manager, then re-run.</div>' : '';
  const loadWarn = _loadErrors ? '<div class="pp-warn pp-warn-err"><strong>⚠ '+_loadErrors+' staff member(s) failed to load</strong> — their hours may be missing or wrong. This is usually an expired session. <b>Refresh the page and run the payrun again</b> before using these figures.</div>' : '';

  el.innerHTML =
    '<div class="pp-animate">'+
      loadWarn+
      '<div class="pp-summary">'+
        '<div class="pp-hero">'+
          '<div class="lbl">Premium payout</div>'+
          '<div class="val">$'+totPremPlus.toFixed(2)+'</div>'+
          '<div class="sub"><b>'+totPremH.toFixed(1)+' hrs</b> above cap · incl. <b>$'+totCoffee.toFixed(2)+'</b> coffee'+(flatCount?' \u00b7 <b>'+flatCount+'</b> on flat rate':'')+'</div>'+
        '</div>'+
        '<div class="pp-stat"><div class="lbl">Total pay</div><div class="val grand">$'+totGross.toFixed(2)+'</div><div class="note">'+paidCount+' paid · '+totNet.toFixed(1)+'h net</div></div>'+
        '<div class="pp-stat"><div class="lbl">Ordinary</div><div class="val">$'+totOrdG.toFixed(2)+'</div><div class="note">standard-rate hours</div></div>'+
      '</div>'+
      '<div class="pp-head-row"><div class="t">Payrun · '+startStr+' → '+endStr+'</div><div class="c">'+_payResults.length+' listed · <span style="color:var(--pp-mut2,#5a6a7e);">drag ≡ to reorder</span> <button class="pp-reset" onclick="_payResetOrder()">reset</button></div></div>'+
      '<div class="pp-scroll"><table class="pp-table">'+
      '<thead><tr>'+
        '<th class="pp-drag-th"></th>'+
        '<th>Staff</th>'+
        '<th class="r">Net hrs</th>'+
        '<th class="r">Ordinary</th>'+
        '<th class="r">Coffee ☕</th>'+
        '<th class="r prem">Premium ▲</th>'+
        '<th class="r prem">Prem + Coffee</th>'+
        '<th class="r">Total pay</th>'+
      '</tr></thead><tbody id="payTbody">'+rows+'</tbody>'+
      '<tfoot><tr class="pp-foot">'+
        '<td></td>'+
        '<td class="lbl">Totals · '+paidCount+' paid</td>'+
        '<td class="r lbl">'+totNet.toFixed(2)+'h</td>'+
        '<td class="r pp-ord">$'+totOrdG.toFixed(2)+'</td>'+
        '<td class="r pp-coffee">$'+totCoffee.toFixed(2)+'</td>'+
        '<td class="r prem">'+totPremH.toFixed(2)+'h · $'+totPremOnly.toFixed(2)+'</td>'+
        '<td class="r prem">$'+totPremPlus.toFixed(2)+'</td>'+
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
    if(r.loadError) chips += '<span class="pp-chip norate">⚠ LOAD FAILED</span>';
    if(r.noRate) chips += '<span class="pp-chip norate">NO RATE</span>';
    if(r.open)   chips += '<span class="pp-chip open" title="'+r.open+' unclosed clock-in(s) — hours may be understated">⚠ '+r.open+' OPEN</span>';
    var structTxt = r.structure==='tiered' ? ('Tiered · '+(r.rate?parseFloat(r.rate.pay_cap):'')+'h cap') : (r.structure==='flat'?'Flat rate':'—');
    // Three cells: premium-only, coffee-only, and the two combined.
    var premOnlyCell = (r.premOnly>0)
      ? '<span class="pp-prem-pill"><span class="h">'+r.premH.toFixed(2)+'h</span><span class="d">$'+r.premOnly.toFixed(2)+'</span></span>'
      : '<span class="pp-prem-zero">—</span>';
    var coffeeCell = (r.coffee>0)
      ? '<span class="pp-coffee">$'+r.coffee.toFixed(2)+'</span>'
      : '<span class="pp-coffee zero">—</span>';
    var premPlusCell = (r.premPlus>0)
      ? '<span class="pp-prem-pill"><span class="d">$'+r.premPlus.toFixed(2)+'</span></span>'
      : '<span class="pp-prem-zero">—</span>';
    // Flat-rate staff have no premium tier (every hour is paid at the standard rate). Show that explicitly in the
    // Premium columns instead of a faded dash, so they read as part of the section. Display only: no figures change.
    if(r.structure==='flat' && !r.noRate && !(r.premOnly>0)){
      premOnlyCell = '<span class="pp-prem-pill pp-flat-pill" title="Flat rate: every hour is paid at the standard rate, so there is no premium tier"><span class="h">Flat rate</span></span>';
      if(!(r.premPlus>0)) premPlusCell = '<span class="pp-prem-pill pp-flat-pill" title="Flat rate: no premium, no coffee"><span class="d">$0.00</span></span>';
    }
    rows += '<tr'+(r.noRate?' class="pp-flagrow"':'')+' style="--i:'+Math.min(i,14)+'" draggable="true" data-name="'+String(r.name).replace(/"/g,'&quot;')+'">'+
      '<td class="pp-drag" title="Drag to reorder">≡</td>'+
      '<td><div class="pp-name">'+r.name+chips+'</div><div class="pp-struct">'+structTxt+'</div></td>'+
      '<td class="r pp-net">'+r.net.toFixed(2)+'h</td>'+
      '<td class="r pp-ord">'+r.ordH.toFixed(2)+'h · $'+r.ordG.toFixed(2)+'</td>'+
      '<td class="r">'+coffeeCell+'</td>'+
      '<td class="r pp-prem-cell pp-prem-first">'+premOnlyCell+'</td>'+
      '<td class="r pp-prem-cell pp-prem-last">'+premPlusCell+'</td>'+
      '<td class="r"><span class="pp-total">'+(r.noRate?'—':'$'+r.total.toFixed(2))+'</span></td>'+
    '</tr>';
    }catch(e){
      console.warn('[PAYROLL] row render failed for', r&&r.name, e);
      rows += '<tr data-name="'+String((r&&r.name)||'?').replace(/"/g,'&quot;')+'"><td class="pp-drag">≡</td><td>'+((r&&r.name)||'?')+'</td><td class="r">—</td><td class="r">—</td><td class="r">—</td><td class="r">—</td><td class="r">—</td><td class="r">—</td></tr>';
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
  const head = ['Staff','Structure','Cap','Std rate','Prem rate','Net hours','Ordinary hrs','Ordinary $','Premium hrs','Premium $','Coffee $','Prem + Coffee $','Total pay $','Open punches','Note'];
  const esc = function(v){ v = (v==null?'':String(v)); return /[",\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; };
  const lines = [head.join(',')];
  _payResults.forEach(function(r){
    lines.push([
      r.name, r.structure,
      r.rate?parseFloat(r.rate.pay_cap):'', r.rate?parseFloat(r.rate.std_rate):'', r.rate?parseFloat(r.rate.prem_rate):'',
      r.net.toFixed(2), r.ordH.toFixed(2), r.ordG.toFixed(2), r.premH.toFixed(2), r.premOnly.toFixed(2),
      r.coffee.toFixed(2), r.premPlus.toFixed(2), r.noRate?'':r.total.toFixed(2), r.open||0,
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
      '<td style="font-weight:600;color:var(--pp-ink,#0f172a);">'+n+(missing?' <span style="color:var(--pp-bad,#b91c1c);font-size:10px;font-weight:800;">unset</span>':'')+'</td>'+
      '<td><select class="pr-struct" onchange="this.closest(\'tr\').classList.toggle(\'is-flat\', this.value!==\'tiered\')"><option value="tiered"'+(r.structure==='tiered'?' selected':'')+'>Tiered</option><option value="flat"'+(isFlat?' selected':'')+'>Flat</option></select></td>'+
      '<td><input class="pr-std" type="number" step="0.01" value="'+(parseFloat(r.std_rate)||0)+'" style="width:80px;"></td>'+
      '<td><input class="pr-prem" type="number" step="0.01" value="'+(parseFloat(r.prem_rate)||0)+'" style="width:80px;"></td>'+
      "<td>" + (function(){ var cap=parseFloat(r.pay_cap); var isPreset=(cap===48||cap===76); var isCustom=(!isNaN(cap)&&!isPreset); return '<select class="pr-cap" onchange="_prCapToggle(this)"><option value="48"'+(cap===48?' selected':'')+'>48</option><option value="76"'+(cap===76?' selected':'')+'>76</option><option value="__custom"'+(isCustom?' selected':'')+'>Custom\u2026</option></select><input class="pr-cap-custom" type="number" step="0.01" min="0" placeholder="hrs" value="'+(isCustom?cap:'')+'" style="width:80px;margin-left:6px;'+(isCustom?'':'display:none;')+'">'; })() + "</td>" +
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
