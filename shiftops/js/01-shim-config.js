// ═══════════════════════════════════════════════════════════════
// WEB SHIM — replaces the Electron bridge with Supabase storage
// so ShiftOps runs in the browser as a Nexits app, shared across
// all staff devices. No file I/O, no nodemailer, no Electron.
// ═══════════════════════════════════════════════════════════════
(function(){
  const SB='https://jcfgldqrdbfkgbixszds.supabase.co';
  const KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZmdsZHFyZGJma2diaXhzemRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1Nzc3NzEsImV4cCI6MjA5MDE1Mzc3MX0.Wj8cCpnlsoZOPj5sKWeEdfvgjG4Nc-UuTTYgbcrPfeI';
  const ROW_ID=1; // single shared roster document
  window.shiftops={
    async loadData(){
      try{
        const r=await fetch(SB+'/rest/v1/shiftops_data?id=eq.'+ROW_ID+'&select=payload',{headers:{apikey:KEY,Authorization:'Bearer '+KEY}});
        if(!r.ok)return{ok:true,data:null};
        const rows=await r.json();
        if(rows&&rows.length&&rows[0].payload)return{ok:true,data:rows[0].payload};
        return{ok:true,data:null};
      }catch(e){return{ok:false,error:e.message};}
    },
    async saveData(payload){
      try{
        if(payload===null){
          await fetch(SB+'/rest/v1/shiftops_data?id=eq.'+ROW_ID,{method:'DELETE',headers:{apikey:KEY,Authorization:'Bearer '+KEY}});
          return{ok:true};
        }
        const r=await fetch(SB+'/rest/v1/shiftops_data',{
          method:'POST',
          headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},
          body:JSON.stringify({id:ROW_ID,payload:payload,updated_at:new Date().toISOString()})
        });
        if(r.ok)return{ok:true};
        return{ok:false,error:'HTTP '+r.status};
      }catch(e){return{ok:false,error:e.message};}
    },
    async getDataPath(){ return 'Cloud · Supabase (shared across all staff)'; },
    async getSharedFolder(){ return {ok:true,folder:'Supabase Cloud'}; },
    async setSharedFolder(){ return {ok:false,canceled:true}; },
    async clearSharedFolder(){ return {ok:true}; },
  };
})();

// ── SUPABASE / APPS SCRIPT CONFIG ──────────────────────────────────────────
// MUST be declared before loadData()/loadStaffFromSupabase() run (the INIT IIFE
// at the bottom calls them during this same script evaluation). Declaring these
// further down made them hit the temporal dead zone ->loadStaffFromSupabase
// threw "Cannot access 'SUPABASE_KEY' before initialization", silently failed,
// and the roster fell back to the cached/seed staff — which then wiped Nexus.
const SUPABASE_URL='https://jcfgldqrdbfkgbixszds.supabase.co';
const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZmdsZHFyZGJma2diaXhzemRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1Nzc3NzEsImV4cCI6MjA5MDE1Mzc3MX0.Wj8cCpnlsoZOPj5sKWeEdfvgjG4Nc-UuTTYgbcrPfeI';

// ── SIGNED-IN PROFILE (header chip + popover) ──────────────────────────────
// Identity comes from the verified launch token (so_me). Everything else is read
// from the signed-in session: role flags from the loaded staff array, avatar /
// nickname / email / last sign-in from the user's own rows. Only safe columns are
// selected — never anything credential-related.
let _meProfile=null, _meProfileTries=0;
function _whoStaffRec(){
  try{
    const me=(sessionStorage.getItem('so_me')||'').trim().toLowerCase();
    if(!me||typeof staff==='undefined'||!Array.isArray(staff)) return null;
    return staff.find(function(x){ return ((x.first||'')+' '+(x.last||'')).trim().toLowerCase()===me; })||null;
  }catch(e){ return null; }
}
function _whoRole(rec){
  // The label must never guess. Until the role data has really loaded, show only what
  // the launch token said (Admin) or nothing, so an admin never flashes "Team Lead".
  let hint=false, verdict=''; try{ verdict=sessionStorage.getItem('so_is_admin')||''; hint=verdict==='1'; }catch(e){}
  if(verdict==='0') return 'Team Lead';           // server says: in ShiftOps, not a hub admin
  if(rec && rec.isHubAdmin) return 'Admin';
  let ok=false; try{ ok=!!_roleDataOk; }catch(e){}
  if(!ok || !rec) return hint ? 'Admin' : '';
  try{ if(typeof AM_TEAM_LEAD!=='undefined' && AM_TEAM_LEAD && typeof _tlResolved!=='undefined' && _tlResolved) return 'Team Lead'; }catch(e){}
  if(rec.isTeamLead && !rec.isHubAdmin) return 'Team Lead';
  return hint ? 'Admin' : '';
}
function _whoInk(hex){
  const m=/^#?([0-9a-f]{6})$/i.exec(hex||''); if(!m) return '#fff';
  const n=parseInt(m[1],16), r=n>>16&255, g=n>>8&255, b=n&255;
  return (0.299*r+0.587*g+0.114*b)>165 ? '#1d1d1f' : '#fff';
}
function _whoEsc(v){ return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
function _whoPaintAva(el, name, rec){
  if(!el) return;
  const img=_meProfile&&_meProfile.avatar;
  if(img){
    el.textContent=''; el.style.backgroundImage='url("'+img.replace(/"/g,'%22')+'")'; el.style.backgroundColor='var(--surface3)'; el.style.color='';
  } else {
    const parts=String(name||'?').trim().split(/\s+/);
    const ini=((parts[0]||'?')[0]+((parts.length>1?parts[parts.length-1][0]:'')||'')).toUpperCase();
    const col=(rec&&rec.color)||'#0071e3';
    el.style.backgroundImage='none'; el.style.backgroundColor=col; el.style.color=_whoInk(col); el.textContent=ini;
  }
}
function _renderWhoami(){
  try{
    const me=sessionStorage.getItem('so_me')||'';
    const host=document.getElementById('topbarWhoami');
    if(!host) return;
    if(!me){ host.style.display='none'; return; }
    host.style.display='';
    const rec=_whoStaffRec();
    const nick=(_meProfile&&_meProfile.nickname)||'';
    const display=nick||me;
    const role=_whoRole(rec);
    const team=(rec&&rec.team)||(_meProfile&&_meProfile.team)||'';
    const sub=[role,team].filter(Boolean).join(' · ')||'Signed in';
    const nm=document.getElementById('whoName'), sb=document.getElementById('whoSub');
    if(nm&&nm.textContent!==display) nm.textContent=display;
    if(sb&&sb.textContent!==sub) sb.textContent=sub;
    _whoPaintAva(document.getElementById('whoAva'), me, rec);
    const btn=document.getElementById('whoBtn'); if(btn) btn.setAttribute('aria-label','Profile: '+display+(sub!=='Signed in'?', '+sub:''));
    _whoBuildMenu(me, display, role, team, rec);
  }catch(e){}
}
function _whoBuildMenu(me, display, role, team, rec){
  const m=document.getElementById('whoMenu'); if(!m) return;
  const email=(_meProfile&&_meProfile.email)||(rec&&rec.email)||'';
  let access='';
  if(role==='Admin') access='Full access';
  else if(role==='Roster admin') access='Roster admin';
  else if(role==='Team Lead') access='Read-only'+(team?' · '+team+' team':'');
  let last='';
  try{
    if(_meProfile&&_meProfile.last_login){
      last=new Date(_meProfile.last_login).toLocaleString('en-AU',{timeZone:'Australia/Sydney',weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});
    }
  }catch(e){}
  const dark=document.documentElement.getAttribute('data-theme')!=='light';
  const row=function(k,v){ return v?'<div class="who-row"><span>'+k+'</span><b>'+_whoEsc(v)+'</b></div>':''; };
  m.innerHTML=
    '<div class="who-head"><span class="who-ava who-ava-lg" id="whoAvaLg" aria-hidden="true"></span>'+
      '<div class="who-id"><div class="who-nm">'+_whoEsc(display)+'</div>'+
      (display!==me?'<div class="who-fn">'+_whoEsc(me)+'</div>':'')+
      (role?'<span class="who-badge who-badge-'+role.toLowerCase().replace(/\s+/g,'-')+'">'+_whoEsc(role)+'</span>':'')+
      '</div></div>'+
    '<div class="who-rows">'+row('Team',team||'—')+row('Email',email)+row('Access',access)+row('Last sign-in',last)+'</div>'+
    '<div class="who-sep"></div>'+
    '<button type="button" class="who-act" role="menuitem" onclick="toggleTheme();setTimeout(_renderWhoami,0)"><span>Appearance</span><em>'+(dark?'Dark':'Light')+'</em></button>'+
    '<button type="button" class="who-act" role="menuitem" onclick="whoCloseApp()"><span>Close ShiftOps</span></button>';
  _whoPaintAva(document.getElementById('whoAvaLg'), me, rec);
}
function _whoOpen(){ return document.getElementById('whoMenu')&&document.getElementById('whoMenu').classList.contains('open'); }
function closeWhoMenu(){
  const m=document.getElementById('whoMenu'), b=document.getElementById('whoBtn');
  if(m) m.classList.remove('open'); if(b) b.setAttribute('aria-expanded','false');
}
function toggleWhoMenu(e){
  if(e) e.stopPropagation();
  const m=document.getElementById('whoMenu'), b=document.getElementById('whoBtn'); if(!m||!b) return;
  if(_whoOpen()){ closeWhoMenu(); return; }
  try{ closeToolsMenu(); }catch(_){}
  _renderWhoami();                // refresh contents (role/team may have arrived since)
  m.classList.add('open'); b.setAttribute('aria-expanded','true');
  setTimeout(function(){ document.addEventListener('click',function h(ev){ if(!ev.target.closest('#topbarWhoami')) closeWhoMenu(); else document.addEventListener('click',h,{once:true}); },{once:true}); },0);
  if(!_meProfile) _loadMyProfile();
}
document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&_whoOpen()){ closeWhoMenu(); const b=document.getElementById('whoBtn'); if(b) b.focus(); } });
function whoCloseApp(){
  closeWhoMenu();
  try{ window.close(); }catch(e){}
  setTimeout(function(){ try{ showToast('You can close this tab to leave ShiftOps'); }catch(e){} }, 250);
}
async function _loadMyProfile(){
  if(_meProfile||_meProfileTries>=4) return;
  _meProfileTries++;
  const me=(sessionStorage.getItem('so_me')||'').trim(); if(!me) return;
  try{
    try{ await _soFreshTok(); }catch(e){}
    if(!_soTokAlive()){ setTimeout(_loadMyProfile, 1500*_meProfileTries); return; }
    const q=encodeURIComponent('eq.'+me);
    const H={apikey:SUPABASE_KEY, Authorization:'Bearer '+_soTok()};
    const [cr,ar,au]=await Promise.all([
      fetch(SUPABASE_URL+'/rest/v1/staff_credentials?staff_name='+q+'&select=nickname,email,team,last_login&limit=1',{headers:H}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}),
      fetch(SUPABASE_URL+'/rest/v1/staff_avatars?staff_name='+q+'&select=avatar,avatar_path&limit=1',{headers:H}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}),
      // The sign-in service knows the real last sign-in; staff_credentials.last_login stopped being updated.
      fetch(SUPABASE_URL+'/auth/v1/user',{headers:H}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;})
    ]);
    if(!cr){ setTimeout(_loadMyProfile, 1500*_meProfileTries); return; }
    const c=(cr&&cr[0])||{};
    const a=(ar&&ar[0]&&ar[0].avatar_path)?(SUPABASE_URL+'/storage/v1/object/public/avatars/'+ar[0].avatar_path.split('/').map(encodeURIComponent).join('/')):((ar&&ar[0]&&ar[0].avatar)||'');
    _meProfile={ nickname:(c.nickname||'').trim(), email:c.email||'', team:c.team||'', last_login:(au&&au.last_sign_in_at)||null,
                 avatar:/^(data:image\/|https:\/\/)/.test(a)?a:'' };
    _renderWhoami();
  }catch(e){ console.warn('[whoami] profile load failed', e); }
}
document.addEventListener('DOMContentLoaded', _renderWhoami);
if(document.readyState !== 'loading') setTimeout(_renderWhoami, 0);
document.addEventListener('DOMContentLoaded', function(){ setTimeout(_loadMyProfile, 400); });
if(document.readyState !== 'loading') setTimeout(_loadMyProfile, 400);
const GAS_EXEC_URL='https://script.google.com/macros/s/AKfycby0Bq97bCZAsmnruXFuJuCqXQE_kOxhYE2KFuJnVzLXtT5CV0Y12k5176dxZbdaYVGE/exec';
const GAS_TOKEN='oscars_gas_83235a5f0c1f6ba32b18235e2b2d544ac137167d';

// ── Leave-email relay (SEPARATE Apps Script, personal Gmail sender) ──────
// Its own deployment + own token — deliberately NOT the main Code.gs relay.
// After deploying LeaveEmailRelay.gs, paste its /exec URL below. The token
// Auth for this relay is handled inside the script itself; no secret lives in this file.
const MAIL_EXEC_URL='https://script.google.com/macros/s/AKfycbyfr16rfoX-kj30XxJu53wkJrFz6ZixQOylpIqcfbtjVhZBJUFYpBQ_5i9lZSi8PjI-Zw/exec';

// ── Shift-open notification rules ───────────────────────────────────────
// Who hears about an open shift:
//   • same team as the person giving it up
//   • not on full-time hours (a full-timer at 38h can't take it without OT)
//   • and only if the team is big enough to be worth broadcasting to — in a
//     small team you just ask the person directly, so an email is noise.
// Anyone can still CLAIM an open shift in Nexus; these rules only decide who
// gets told.
const MIN_TEAM_FOR_EMAIL=6;      // teams of this size or smaller are not emailed

// Minimum notice before a shift starts for a pickup email to be worth sending.
// Below this the shift still opens and stays claimable — we just don't email,
// because nobody can realistically rearrange their day at that range and the
// noise devalues every future notification.
const SHIFT_NOTICE_HOURS = 10;

/**
 * Hours from now until a shift starts, in Sydney time.
 *
 * Resolves the offset for that specific date rather than assuming +10:00 —
 * Sydney is +11 under daylight saving (Oct–Apr), and a one-hour error either
 * side of a 10-hour threshold is exactly the case that would email the whole
 * team about a shift starting imminently.
 */
function _hoursUntilShift(dateStr, startTime){
  try{
    const hhmm=String(startTime||'09:00').slice(0,5);
    let start=new Date(dateStr+'T'+hhmm+':00+10:00');
    if(isNaN(start)) return 999;
    // How far is Sydney from UTC on that date? 600 (AEST) or 660 (AEDT).
    const asUtc=new Date(start.toLocaleString('en-US',{timeZone:'UTC'}));
    const asSyd=new Date(start.toLocaleString('en-US',{timeZone:'Australia/Sydney'}));
    const offMin=Math.round((asSyd-asUtc)/60000);
    if(offMin===660) start=new Date(dateStr+'T'+hhmm+':00+11:00');
    return (start.getTime()-Date.now())/3600000;
  }catch(e){ return 999; }   // unknown → treat as plenty of notice
}

// Set to a staff name to send shift-available emails to ONLY that person
// (useful when testing). Empty = normal rules apply.
const SHIFT_MAIL_TEST_ONLY='';

const COLORS=['#00e5a0','#0066ff','#ff6b35','#ffd700','#ff69b4','#00bcd4','#9c27b0','#8bc34a','#ff5722','#607d8b'];
const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DAYS_FULL=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

