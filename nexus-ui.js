const NEXUS_THEMES = [
  {id:'light',    name:'Original', sub:'Soft grey',      swatch:'linear-gradient(135deg,#f5f5f7,#0b7a5c)'},
  {id:'warm',     name:'Warm',     sub:'Amber & cream',  swatch:'linear-gradient(135deg,#fdf6ee,#f5b45a)'},
  {id:'ocean',    name:'Ocean',    sub:'Calm blues',     swatch:'linear-gradient(135deg,#eef6fb,#38b6de)'},
  {id:'rose',     name:'Rose',     sub:'Soft pink',      swatch:'linear-gradient(135deg,#fdf2f6,#db2777)'},
  {id:'lilac',    name:'Lilac',    sub:'Soft lavender',  swatch:'linear-gradient(135deg,#f4f2fb,#7c5cd6)'},
  {id:'midnight', name:'Midnight', sub:'Deep violet',    swatch:'linear-gradient(135deg,#070b14,#8b5cf6)'},
  {id:'graphite', name:'Graphite', sub:'Neutral charcoal', swatch:'linear-gradient(135deg,#141517,#6786b4)'},
  {id:'evergreen',name:'Evergreen',sub:'Forest night',   swatch:'linear-gradient(135deg,#131916,#569f7d)'},
  {id:'ember',    name:'Ember',    sub:'Warm coals',     swatch:'linear-gradient(135deg,#191512,#b6744d)'},
  {id:'plum',     name:'Plum',     sub:'Dusky aubergine', swatch:'linear-gradient(135deg,#191319,#ae6db0)'},
  {id:'deepsea',  name:'Deep Sea', sub:'Dark teal',      swatch:'linear-gradient(135deg,#12181a,#5193a4)'},
  {id:'renaissance', name:'Renaissance', sub:'Old master oils', swatch:'linear-gradient(135deg,#1a1109,#b8860b)'},
  {id:'win95',    name:'Retro 95', sub:'Classic desktop', swatch:'linear-gradient(135deg,#008080,#c0c0c0)'}
];
const THEME_MIGRATE = {dark:'midnight', forest:'light', sand:'warm'};
const THEME_IDS = NEXUS_THEMES.map(t=>t.id);

function setTheme(theme){
  if(THEME_IDS.indexOf(theme) < 0) theme = 'light';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('oscars_theme', theme);
  if(typeof _nxApplyTextColor==='function') _nxApplyTextColor();
  renderAppearancePicker();
  try{
    if(typeof me!=='undefined' && me){
      fetch(SB+'/rest/v1/staff_settings?name=eq.'+encodeURIComponent(me),{
        method:'PATCH',
        headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
        body: JSON.stringify({nexus_theme: theme})
      });
    }
  }catch(e){}
}

function renderAppearancePicker(){
  const wrap = document.getElementById('appearanceGrid');
  if(!wrap) return;
  const cur = document.documentElement.getAttribute('data-theme') || 'light';
  wrap.innerHTML = NEXUS_THEMES.map(function(t){
    return '<button class="appr-card'+(t.id===cur?' active':'')+'" onclick="setTheme(\''+t.id+'\')">'+
      '<div class="appr-swatch" style="background:'+t.swatch+';"></div>'+
      '<div class="appr-name">'+t.name+'</div>'+
      '<div class="appr-sub">'+t.sub+'</div>'+
    '</button>';
  }).join('');
}

function initTheme(){
  let saved = localStorage.getItem('oscars_theme') || 'light';
  saved = THEME_MIGRATE[saved] || saved;
  if(THEME_IDS.indexOf(saved) < 0) saved = 'light';
  document.documentElement.setAttribute('data-theme', saved);
  setTimeout(renderAppearancePicker, 50);
}

async function loadStaffTheme(){
  try{
    if(typeof me==='undefined' || !me) return;
    const rows = await sbGet('staff_settings','?name=eq.'+encodeURIComponent(me)+'&select=nexus_theme');
    const st = rows && rows.length ? (THEME_MIGRATE[rows[0].nexus_theme] || rows[0].nexus_theme) : null;
    if(st && THEME_IDS.indexOf(st)>=0){
      document.documentElement.setAttribute('data-theme', st);
      localStorage.setItem('oscars_theme', st);
      if(typeof _nxApplyTextColor==='function') _nxApplyTextColor();
      renderAppearancePicker();
    }
  }catch(e){}
}
function updateDmSwitch(theme){
  const sw=document.getElementById('dmSwitch');
  const th=document.getElementById('dmSwitchThumb');
  if(sw)sw.style.background=theme==='dark'?'var(--accent)':'#e2e8f0';
  if(th)th.style.left=theme==='dark'?'25px':'3px';
}
initTheme();


function updateAccentSwatches(){
  const cur = localStorage.getItem('oscars_accent') || 'green';
  document.querySelectorAll('#accentSwatches .swatch').forEach(function(s){
    s.classList.toggle('active', s.getAttribute('data-accent') === cur);
  });
}

function setFontSize(size){
  document.documentElement.setAttribute('data-font', size);
  localStorage.setItem('oscars_font', size);
  updateFontChips();
}
function updateFontChips(){
  const cur = localStorage.getItem('oscars_font') || 'medium';
  document.querySelectorAll('#fontChips .font-chip').forEach(function(c){
    c.classList.toggle('active', c.getAttribute('data-font') === cur);
  });
}


function updateSbSwitch(){
  const cur = localStorage.getItem('oscars_sb') === 'collapsed';
  const sw = document.getElementById('sbSwitch');
  const th = document.getElementById('sbSwitchThumb');
  if(sw) sw.style.background = cur ? 'var(--accent)' : '#e2e8f0';
  if(th) th.style.left = cur ? '25px' : '3px';
}

function resetAppearance(){
  if(!confirm('Reset all appearance settings to default?')) return;
  const keys = ['oscars_theme','oscars_accent','oscars_font','oscars_sb','oscars_brightness','nexus_text_color'];
  keys.forEach(function(k){ localStorage.removeItem(k); });
  document.documentElement.setAttribute('data-theme', 'light');
  document.documentElement.setAttribute('data-accent', 'green');
  document.documentElement.setAttribute('data-font', 'medium');
  document.documentElement.setAttribute('data-sb', 'expanded');
  document.documentElement.style.removeProperty('filter');
  document.body.removeAttribute('data-text-color');
  document.body.style.removeProperty('--user-text-color');
  document.documentElement.style.removeProperty('--accent');
  if(typeof updateDmSwitch === 'function') updateDmSwitch('light');
  if(typeof updateAccentSwatches === 'function') updateAccentSwatches();
  if(typeof updateFontChips === 'function') updateFontChips();
  if(typeof updateSbSwitch === 'function') updateSbSwitch();
  document.querySelectorAll('.tc-swatch').forEach(function(s){
    s.classList.toggle('selected', s.dataset.tc === '#0f172a');
  });
  const brightSlider = document.getElementById('brightnessSlider');
  if(brightSlider){ brightSlider.value = 100; }
  const brightVal = document.getElementById('brightnessVal');
  if(brightVal){ brightVal.textContent = '100%'; }
  showToast('Appearance reset to default');
}

function initAppearance(){
  const accent = localStorage.getItem('oscars_accent') || 'green';
  const font = localStorage.getItem('oscars_font') || 'medium';
  const sb = localStorage.getItem('oscars_sb') || 'expanded';
  document.documentElement.setAttribute('data-accent', accent);
  document.documentElement.setAttribute('data-font', font);
  document.documentElement.setAttribute('data-sb', sb);
}
initAppearance();

const _origShowProfileSection = typeof showProfileSection === 'function' ? showProfileSection : null;
setTimeout(function(){
  updateAccentSwatches();
  updateFontChips();
  updateSbSwitch();
}, 200);









async function openGatedApp(ev,app,url){
  if(ev)ev.preventDefault();
  try{
    const token=await makeAppToken(app, me);
    if(['shiftops','formcraft','slip'].indexOf(app)>=0){
      let hasSess=false;
      try{ const pl=JSON.parse(decodeURIComponent(escape(atob(token.split('.')[0])))); hasSess=!!pl.sb_at; }catch(e){}
      if(!hasSess){ showToast('Your sign-in has expired. Sign out and back in, then open the app again.'); return; }
    }
    window.open(url+'#t='+encodeURIComponent(token),'_blank','noopener,noreferrer');
  }catch(e){
    showToast('Could not open app');
    console.warn('openGatedApp',e);
  }
}
function showAuth(s){
  try{ var _bo=document.getElementById('nexusBootOverlay'); if(_bo){ _bo.classList.add('nb-hide'); setTimeout(function(){ _bo.style.display='none'; },400); } }catch(e){}
  ["login","setpass","resetkey","forgot","setnew"].forEach(p=>{var el=document.getElementById("pg-"+p);if(el)el.style.display="none";});
  const pg=document.getElementById("pg-"+s);
  pg.style.display = (s==="login") ? "" : "block";
  try{ document.getElementById("authLayer").classList.toggle("login-edge", s==="login"); }catch(e){}
}

async function sbGet(t,f){
  const url=SB+"/rest/v1/"+t+(f||"");
  const r=await fetch(url,{headers:{"apikey":KEY,"Authorization":"Bearer "+_sbBearer()}});
  if(!r.ok){console.warn("sbGet failed:",t,r.status,await r.text().catch(()=>''));return[];}
  return r.json();
}
async function sbPost(t,b){return fetch(SB+"/rest/v1/"+t,{method:"POST",headers:{"apikey":KEY,"Authorization":"Bearer "+_sbBearer(),"Content-Type":"application/json","Prefer":"return=minimal"},body:JSON.stringify(b)});}
function _sbBearer(){ return window._sbAuthToken || KEY; }
async function refreshSbAuthToken(){
  try{
    const auth = getAuthClient();
    if(auth && auth.getSession){
      const { data } = await auth.getSession();
      window._sbAuthToken = (data && data.session && data.session.access_token) ? data.session.access_token : null;
    }
  }catch(e){ window._sbAuthToken = null; }
  try{
    if(_realtimeClient && _realtimeClient.realtime && _realtimeClient.realtime.setAuth){
      _realtimeClient.realtime.setAuth(window._sbAuthToken || KEY);
    }
  }catch(e){}
  return window._sbAuthToken;
}
async function hmacHex(secret,msg){
  const enc=new TextEncoder();
  const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const sig=await crypto.subtle.sign('HMAC',key,enc.encode(msg));
  return Array.from(new Uint8Array(sig)).map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function makeAppToken(app,name){
  const payload={app:app,name:name||'',is_admin:(typeof myIsAdmin!=='undefined'&&myIsAdmin===true),exp:Date.now()+1000*60*5};
  try{
    const ac = getAuthClient();
    if(ac){
      let session=null;
      try{
        if(ac.refreshSession){
          const { data, error } = await ac.refreshSession();
          if(!error && data && data.session) session=data.session;
        }
      }catch(e){ /* fall through to the cached session */ }
      if(!session && ac.getSession){
        const { data } = await ac.getSession();
        session = (data && data.session) ? data.session : null;
      }
      if(session){
        payload.sb_at = session.access_token || null;
        payload.sb_rt = session.refresh_token || null;
      }
    }
  }catch(e){}
  const json=JSON.stringify(payload);
  const b64=btoa(unescape(encodeURIComponent(json)));
  const sig=await hmacHex(APP_GATE_SECRET, b64);
  return b64+'.'+sig;
}
async function loadHubAccess(){
  try{
    const rows=await sbGet('app_access','?select=app,staff_name');
    const _c={formcraft:[],slip:[],dialtrac:[],borekade:[],shiftops:[],vgc:[]};
    (rows||[]).forEach(r=>{ if(_c[r.app]) _c[r.app].push(r.staff_name); });
    window._accessCache=_c;
  }catch(e){ console.warn('loadHubAccess',e); }
  const _ac = window._accessCache || { formcraft:[], slip:[], dialtrac:[], borekade:[], shiftops:[], vgc:[] };
  const fc=document.getElementById('hubcard-formcraft');
  const sl=document.getElementById('hubcard-slip');
  if(fc) fc.style.display=(_ac.formcraft||[]).includes(me)?'':'none';
  if(sl) sl.style.display=(_ac.slip||[]).includes(me)?'':'none';
  const so=document.getElementById('hubcard-shiftops');
  if(so) so.style.display=(_ac.shiftops||[]).includes(me)?'':'none';
  const bk=document.getElementById('hubcard-borekade');
  if(bk) bk.style.display=(_ac.borekade||[]).includes(me)?'':'none';
  const vg=document.getElementById('hubcard-vgc');
  if(vg) vg.style.display=(_ac.vgc||[]).includes(me)?'':'none';
  gateCallLog();
  try{ if(typeof hubRadialLayout==='function') hubRadialLayout(); }catch(e){}
  const adminArea=document.getElementById('hubAdminArea');
  if(adminArea) adminArea.style.display=(typeof myIsAdmin!=='undefined'&&myIsAdmin)?'block':'none';
}

/**
 * Reveal the Call Log tab. Everyone on the Enrolment team gets it
 * automatically; anyone outside Enrolment can be granted it individually
 * through the dialtrac access list. Runs at login, so the tab is there
 * without anyone having to visit Nodes first.
 */
async function gateCallLog(){
  try{
    const clNav=document.getElementById('nav-calllog');
    if(clNav) clNav.style.display = '';
    window._canCallLog = true;
  }catch(e){ console.warn('gateCallLog',e); }
}
function loadMe(){const n=sessionStorage.getItem("ou");if(n){me=n;return true;}return false;}
function saveMe(n){me=n;sessionStorage.setItem("ou",n);}


async function hash(p){const e=new TextEncoder().encode(p+"oscar_roster_salt_2024"),b=await crypto.subtle.digest("SHA-256",e);return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,"0")).join("");}




let _realtimeClient = null;

async function markReactSeen(){ /* reactions retired */ }
async function markReplySeen(){ /* reply notifications retired */ }





















function toggleCalEventForm(){
  const today = new Date().toISOString().split('T')[0];
  if(typeof openNewEventForDate === 'function'){
    openNewEventForDate(today);
    return;
  }
  const form=document.getElementById('calEventForm');
  if(form){
    const showing=form.style.display!=='none';
    form.style.display=showing?'none':'block';
    if(!showing){
      const dateEl=document.getElementById('calEventDate');
      if(dateEl&&!dateEl.value)dateEl.value=today;
    }
  }
}

async function saveCalEvent(){
  const title=document.getElementById('calEventTitle').value.trim();
  const date=document.getElementById('calEventDate').value;
  const desc=document.getElementById('calEventDesc').value.trim();
  const err=document.getElementById('calEventErr');
  err.classList.remove('show');
  if(!title){err.textContent='Please enter a title.';err.classList.add('show');return;}
  if(!date){err.textContent='Please select a date.';err.classList.add('show');return;}
  const btn=document.getElementById('calEventSaveBtn');
  btn.disabled=true;btn.innerHTML='<span class="sp"></span>';
  try{
    await sbPost('calendar_events',{title,event_date:date,description:desc||null,created_by:me});
    document.getElementById('calEventTitle').value='';
    document.getElementById('calEventDate').value='';
    document.getElementById('calEventDesc').value='';
    document.getElementById('calEventForm').style.display='none';
    await loadBirthdays();
  }catch(e){
    console.warn(e);
    err.textContent='Failed to save event.';err.classList.add('show');
  }finally{
    btn.disabled=false;btn.textContent='Add';
  }
}

async function deleteCalEvent(id){
  if(!confirm('Delete this event?'))return;
  try{
    await fetch(SB+'/rest/v1/calendar_events?id=eq.'+id,{method:'DELETE',headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}});
    await loadBirthdays();
  }catch(e){console.warn(e);}
}




document.addEventListener('click',function(e){
  const pop=document.getElementById('eventQuickPop');
  if(pop && pop.style.display==='block' && !pop.contains(e.target) && !e.target.closest('.cal-pill')){
    closeEventQuickPop();
  }
});

let _editingEventId = null;
let _currentViewEvent = null;

function openDayEventModal(dateStr){
  const d = new Date(dateStr+'T00:00:00');
  const items = (typeof calEventsOnDay === 'function') ? calEventsOnDay(d) : [];

  let bd = document.getElementById('dayEventBackdrop');
  if(!bd){
    bd = document.createElement('div');
    bd.id = 'dayEventBackdrop';
    bd.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(15,23,42,.5);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:flex-end;justify-content:center;padding:0;';
    document.body.appendChild(bd);
    bd.addEventListener('click', function(e){ if(e.target===bd) bd.style.display='none'; });
  }

  const dStr = d.toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const isToday = (function(){ const t=new Date(); t.setHours(0,0,0,0); return d.getTime()===t.getTime(); })();

  function renderRow(it){
    const colors = {event:'var(--accent)', bday:'#db2777', holiday:'#dc2626', task:'#3b82f6'};
    const labels = {event:'Event', bday:'Birthday', holiday:'Public holiday', task:'Task'};
    const c = colors[it.type] || '#64748b';
    const tStr = it.time ? String(it.time).slice(0,5) : (it.type==='holiday' ? 'Holiday' : 'All day');
    const titleEsc = esc(it.title||'');
    const evId = (it.type==='event' && it.ev) ? it.ev.id : null;
    const click = evId ? 'onclick="document.getElementById(\'dayEventBackdrop\').style.display=\'none\';viewEvent(\''+evId+'\',event)" style="cursor:pointer;"' : 'style="cursor:default;"';
    const doneStyle = it.done ? ';opacity:.5;text-decoration:line-through;' : '';
    return '<div '+click+' style="display:flex;align-items:flex-start;gap:12px;padding:12px;border-radius:10px;background:var(--ui-surface-2,#f8fafc);margin-bottom:6px;'+doneStyle+'">'+
      '<div style="width:4px;align-self:stretch;border-radius:4px;background:'+c+';flex-shrink:0;"></div>'+
      '<div style="flex:1;min-width:0;">'+
        '<div style="font-size:14px;font-weight:600;color:var(--ui-ink,#0f172a);">'+titleEsc+'</div>'+
        '<div style="font-size:11.5px;color:var(--ui-ink-3,#64748b);margin-top:3px;">'+labels[it.type]+' · '+tStr+'</div>'+
      '</div>'+
    '</div>';
  }

  bd.innerHTML = '<div style="background:var(--ui-surface,#fff);border-radius:18px 18px 0 0;width:100%;max-width:520px;max-height:85dvh;display:flex;flex-direction:column;box-shadow:0 -10px 40px rgba(15,23,42,.2);" onclick="event.stopPropagation()">'+
    '<div style="padding:14px 16px 8px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--ui-line-soft,#f1f5f9);">'+
      '<div>'+
        '<div style="font-size:11px;font-weight:700;color:'+(isToday?'var(--accent)':'#94a3b8')+';text-transform:uppercase;letter-spacing:.06em;">'+(isToday?'Today':d.toLocaleDateString('en-AU',{weekday:'short'}))+'</div>'+
        '<div style="font-size:17px;font-weight:700;color:var(--ui-ink,#0f172a);letter-spacing:-.01em;margin-top:2px;">'+dStr+'</div>'+
      '</div>'+
      '<button onclick="document.getElementById(\'dayEventBackdrop\').style.display=\'none\'" style="background:var(--ui-surface-3,#f1f5f9);color:var(--ui-ink-3,#64748b);border:none;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:18px;line-height:1;">×</button>'+
    '</div>'+
    '<div style="padding:14px 16px;flex:1;overflow-y:auto;">'+
      (items.length ? items.map(renderRow).join('') :
        '<div style="text-align:center;color:var(--ui-ink-4,#94a3b8);padding:40px 20px;font-size:13px;">Nothing scheduled.</div>')+
    '</div>'+
    '<div style="padding:12px 16px;border-top:1px solid var(--ui-line-soft,#f1f5f9);">'+
      '<button onclick="document.getElementById(\'dayEventBackdrop\').style.display=\'none\';openNewEventForDate(\''+dateStr+'\')" style="width:100%;background:var(--accent);color:#fff;border:none;border-radius:10px;padding:11px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;">+ Add new event</button>'+
    '</div>'+
  '</div>';

  if(document.documentElement.getAttribute('data-theme')==='dark'){
    const inner = bd.firstElementChild;
    inner.style.background = '#131820';
    inner.style.color = '#d4d8e0';
    inner.querySelectorAll('div[style*="background:var(--ui-surface-2,#f8fafc)"]').forEach(function(d){
      d.style.background = '#0d1117';
    });
    inner.querySelectorAll('div[style*="color:var(--ui-ink,#0f172a)"]').forEach(function(d){
      d.style.color = '#f1f5f9';
    });
    inner.querySelectorAll('div[style*="border-bottom:1px solid var(--ui-line-soft,#f1f5f9)"], div[style*="border-top:1px solid var(--ui-line-soft,#f1f5f9)"]').forEach(function(d){
      d.style.borderColor = '#1f2530';
    });
  }

  bd.style.display='flex';
}

function parseNaturalEvent(input){
  if(!input) return null;
  let text = String(input).trim();
  let time = null;
  let date = null;

  const timeRe = /\b(at\s+)?(\d{1,2})(:(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b/i;
  const time24Re = /\bat\s+(\d{1,2}):(\d{2})\b/;
  const namedTime = /\b(noon|midnight|midday)\b/i;

  let m = text.match(timeRe);
  if(m){
    let h = parseInt(m[2]);
    const mm = m[4] ? parseInt(m[4]) : 0;
    const ampm = m[5].toLowerCase().replace(/\./g,'');
    if(ampm.startsWith('p') && h < 12) h += 12;
    if(ampm.startsWith('a') && h === 12) h = 0;
    time = String(h).padStart(2,'0')+':'+String(mm).padStart(2,'0');
    text = text.replace(m[0], '').trim();
  } else if((m = text.match(time24Re))){
    const h = parseInt(m[1]);
    const mm = parseInt(m[2]);
    if(h>=0 && h<24){
      time = String(h).padStart(2,'0')+':'+String(mm).padStart(2,'0');
      text = text.replace(m[0], '').trim();
    }
  } else if((m = text.match(namedTime))){
    const w = m[1].toLowerCase();
    if(w === 'midnight') time = '00:00';
    else time = '12:00';
    text = text.replace(m[0], '').trim();
  }

  const today = new Date();
  const tomorrowRe = /\b(tomorrow|tmrw|tmw)\b/i;
  const todayRe = /\b(today)\b/i;
  const dayRe = /\b(this\s+|next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thurs|fri|sat|sun)\b/i;
  const months = {jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,sept:8,september:8,oct:9,october:9,nov:10,november:10,dec:11,december:11};
  const dayMonthRe = /\b(\d{1,2})(st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b/i;
  const monthDayRe = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\s+(\d{1,2})(st|nd|rd|th)?\b/i;
  const slashRe = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;
  const isoRe = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/;

  if((m = text.match(todayRe))){
    date = today;
    text = text.replace(m[0], '').trim();
  } else if((m = text.match(tomorrowRe))){
    date = new Date(today); date.setDate(date.getDate()+1);
    text = text.replace(m[0], '').trim();
  } else if((m = text.match(isoRe))){
    const y = parseInt(m[1]), mo = parseInt(m[2])-1, d = parseInt(m[3]);
    if(y > 1900 && mo>=0 && mo<12 && d>=1 && d<=31){
      date = new Date(y, mo, d);
      text = text.replace(m[0], '').trim();
    }
  } else if((m = text.match(dayMonthRe))){
    const d = parseInt(m[1]);
    const mo = months[m[3].toLowerCase()];
    if(mo !== undefined && d>=1 && d<=31){
      let y = today.getFullYear();
      const candidate = new Date(y, mo, d);
      if(candidate < new Date(today.getFullYear(), today.getMonth(), today.getDate()-1)){
        y++;
      }
      date = new Date(y, mo, d);
      text = text.replace(m[0], '').trim();
    }
  } else if((m = text.match(monthDayRe))){
    const mo = months[m[1].toLowerCase()];
    const d = parseInt(m[2]);
    if(mo !== undefined && d>=1 && d<=31){
      let y = today.getFullYear();
      const candidate = new Date(y, mo, d);
      if(candidate < new Date(today.getFullYear(), today.getMonth(), today.getDate()-1)){
        y++;
      }
      date = new Date(y, mo, d);
      text = text.replace(m[0], '').trim();
    }
  } else if((m = text.match(slashRe))){
    const a = parseInt(m[1]), b = parseInt(m[2]);
    let y = m[3] ? parseInt(m[3]) : today.getFullYear();
    if(y < 100) y += 2000;
    let dd, mo;
    if(a > 12 && b <= 12){ dd=a; mo=b-1; }
    else if(b > 12 && a <= 12){ dd=b; mo=a-1; }
    else { dd=a; mo=b-1; }
    if(dd>=1 && dd<=31 && mo>=0 && mo<12){
      const candidate = new Date(y, mo, dd);
      if(!m[3] && candidate < new Date(today.getFullYear(), today.getMonth(), today.getDate()-1)){
        y++;
      }
      date = new Date(y, mo, dd);
      text = text.replace(m[0], '').trim();
    }
  } else if((m = text.match(dayRe))){
    const days = ['sun','mon','tue','wed','thu','fri','sat'];
    const longDays = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    let target = m[2].toLowerCase();
    let idx = longDays.indexOf(target);
    if(idx<0) idx = days.indexOf(target.slice(0,3));
    if(idx<0) idx = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].indexOf(target);
    if(idx>=0){
      const dow = today.getDay();
      let diff = idx - dow;
      const isNext = m[1] && /next/i.test(m[1]);
      if(diff<=0 || isNext) diff += 7;
      date = new Date(today); date.setDate(date.getDate()+diff);
      text = text.replace(m[0], '').trim();
    }
  }

  text = text.replace(/^(at|on)\s+/i,'').replace(/\s+(at|on)$/i,'').trim();
  text = text.replace(/\s{2,}/g, ' ');

  return {
    title: text || '(Untitled)',
    time: time,
    date: date ? (date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0')) : null
  };
}

function openNewEventForDate(dateStr){
  _editingEventId = null;
  document.getElementById('eventModalTitle').textContent = 'New Event';
  document.getElementById('eventModalSaveBtn').textContent = 'Add';
  document.getElementById('evmTitle').value = '';
  document.getElementById('evmDesc').value = '';
  document.getElementById('evmDate').value = dateStr;
  document.getElementById('evmTime').value = '09:00';
  document.getElementById('evmAllDay').checked = true;
  document.getElementById('evmTimeRow').style.display = 'none';
  document.getElementById('evmDeleteBtn').style.display = 'none';
  document.getElementById('eventModal').style.display = 'flex';
  const titleEl = document.getElementById('evmTitle');
  titleEl.placeholder = 'e.g. Lunch with Mom at 1pm';
  if(!titleEl._nlBound){
    titleEl._nlBound = true;
    let nlTimer = null;
    titleEl.addEventListener('input', function(){
      clearTimeout(nlTimer);
      nlTimer = setTimeout(function(){
        const parsed = parseNaturalEvent(titleEl.value);
        if(!parsed) return;
        if(parsed.time){
          document.getElementById('evmTime').value = parsed.time;
          document.getElementById('evmAllDay').checked = false;
          document.getElementById('evmTimeRow').style.display = 'block';
        }
        if(parsed.date){
          document.getElementById('evmDate').value = parsed.date;
        }
        let hint = document.getElementById('nlHint');
        if(!hint){
          hint = document.createElement('div');
          hint.id = 'nlHint';
          hint.style.cssText = 'font-size:11px;color:var(--accent);margin-top:4px;font-weight:600;display:flex;align-items:center;gap:5px;';
          titleEl.parentNode.appendChild(hint);
        }
        const parts = [];
        if(parsed.time){
          const [hh,mm] = parsed.time.split(':');
          const h = parseInt(hh);
          const ampm = h<12?'am':'pm';
          const h12 = h%12 || 12;
          parts.push(h12+(mm!=='00'?':'+mm:'')+ampm);
        }
        if(parsed.date){
          const dd = new Date(parsed.date+'T00:00:00');
          parts.push(dd.toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'}));
        }
        if(parts.length){
          hint.textContent = 'Detected: '+parts.join(' · ');
          hint.style.display = '';
        } else {
          hint.style.display = 'none';
        }
      }, 350);
    });
  }
  setTimeout(function(){ document.getElementById('evmTitle').focus(); }, 100);
}

function viewEvent(evId, clickEvt){
  if(clickEvt && clickEvt.stopPropagation) clickEvt.stopPropagation();
  const ev = calEvents.find(function(e){return String(e.id)===String(evId);});
  if(!ev){
    if(typeof showToast==='function') showToast('Event not found');
    return;
  }
  _currentViewEvent = ev;

  let bd = document.getElementById('eventViewBackdrop');
  if(!bd){
    bd = document.createElement('div');
    bd.id = 'eventViewBackdrop';
    bd.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(15,23,42,.5);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:16px;';
    document.body.appendChild(bd);
    bd.addEventListener('click', function(e){ if(e.target===bd) closeEventQuickPop(); });
  }
  const d = new Date((ev.event_date||'')+'T00:00:00');
  const dateStr = isNaN(d)?'':d.toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const timeStr = ev.event_time ? ev.event_time.slice(0,5) : 'All day';
  const canEdit = myIsAdmin || (ev.created_by === me);
  const titleSafe = String(ev.title||'(No title)').replace(/</g,'&lt;');
  const descSafe = esc(ev.description||'');
  const whoLine = ev.created_by ? ('<div style="font-size:11.5px;color:var(--ui-ink-4,#94a3b8);margin-top:8px;">Added by '+esc(ev.created_by)+'</div>') : '';

  bd.innerHTML = '<div style="background:var(--ui-surface,#fff);border-radius:14px;width:100%;max-width:380px;padding:20px 22px;box-shadow:0 24px 60px rgba(15,23,42,.3);position:relative;" onclick="event.stopPropagation()">'+
    '<button onclick="closeEventQuickPop()" style="position:absolute;top:10px;right:12px;background:none;border:none;font-size:22px;line-height:1;color:var(--ui-ink-4,#94a3b8);cursor:pointer;padding:4px 8px;border-radius:6px;" aria-label="Close">×</button>'+
    '<div style="font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Event</div>'+
    '<div style="font-size:18px;font-weight:700;color:var(--ui-ink,#0f172a);letter-spacing:-.01em;margin-bottom:6px;padding-right:30px;">'+titleSafe+'</div>'+
    '<div style="font-size:13px;color:var(--ui-ink-2b,#475569);margin-bottom:'+(descSafe?'12px':'4px')+';">'+dateStr+' · '+timeStr+'</div>'+
    (descSafe?'<div style="font-size:13.5px;color:var(--ui-ink,#0f172a);margin-top:10px;line-height:1.5;white-space:pre-wrap;background:var(--ui-surface-2,#f8fafc);padding:10px 12px;border-radius:8px;">'+descSafe+'</div>':'')+
    whoLine+
    (canEdit ? '<div style="display:flex;gap:8px;margin-top:16px;">'+
      '<button onclick="editEventFromPop()" style="flex:1;background:var(--accent);color:#fff;border:none;border-radius:8px;padding:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">Edit</button>'+
      '<button onclick="deleteEventFromPop()" style="background:#fef2f2;color:#dc2626;border:none;border-radius:8px;padding:10px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">Delete</button>'+
    '</div>' : '')+
  '</div>';

  if(document.documentElement.getAttribute('data-theme')==='dark'){
    const inner = bd.firstElementChild;
    inner.style.background = '#131820';
    inner.style.boxShadow = '0 24px 60px rgba(0,0,0,.5),0 0 0 1px #1f2530';
    const head = inner.querySelectorAll('div');
    if(head[1]) head[1].style.color='#f1f5f9';
    const desc = inner.querySelector('div[style*="background:var(--ui-surface-2,#f8fafc)"]');
    if(desc){ desc.style.background='#0d1117'; desc.style.color='#d4d8e0'; }
  }

  bd.style.display='flex';
}

function closeEventQuickPop(){
  const bd = document.getElementById('eventViewBackdrop');
  if(bd) bd.style.display='none';
  const pop = document.getElementById('eventQuickPop');
  if(pop){ pop.style.display='none'; pop.style.transform=''; }
  _currentViewEvent = null;
}

document.addEventListener('keydown', function(e){
  if(e.key === 'Escape'){
    const bd = document.getElementById('eventViewBackdrop');
    if(bd && bd.style.display !== 'none') closeEventQuickPop();
  }
});

function editEventFromPop(){
  const ev = _currentViewEvent;
  closeEventQuickPop();
  if(!ev) return;
  _editingEventId = ev.id;
  document.getElementById('eventModalTitle').textContent = 'Edit Event';
  document.getElementById('eventModalSaveBtn').textContent = 'Save';
  document.getElementById('evmTitle').value = ev.title || '';
  document.getElementById('evmDesc').value = ev.description || '';
  document.getElementById('evmDate').value = ev.event_date || '';
  document.getElementById('evmTime').value = ev.event_time || '09:00';
  document.getElementById('evmAllDay').checked = !ev.event_time;
  document.getElementById('evmTimeRow').style.display = ev.event_time ? 'none' : 'flex';
  document.getElementById('evmDeleteBtn').style.display = 'block';
  document.getElementById('eventModalSaveBtn').style.display = 'block';
  document.getElementById('eventModal').style.display = 'flex';
}

async function deleteEventFromPop(){
  const ev = _currentViewEvent;
  if(!ev) return;
  if(!confirm('Delete this event?')) return;
  closeEventQuickPop();
  try{
    await fetch(SB+'/rest/v1/calendar_events?id=eq.'+ev.id,{
      method:'DELETE',headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}
    });
    await loadBirthdays();
    showToast('Event deleted');
  }catch(e){ showToast('Failed to delete'); }
}

function closeEventModal(){
  document.getElementById('eventModal').style.display = 'none';
  _editingEventId = null;
  ['evmTitle','evmDesc','evmDate','evmTime','evmAllDay'].forEach(function(id){
    const el = document.getElementById(id);
    if(el){ el.readOnly = false; el.disabled = false; }
  });
  document.getElementById('eventModalSaveBtn').style.display = 'block';
}

function toggleEventTimeFields(){
  const allDay = document.getElementById('evmAllDay').checked;
  document.getElementById('evmTimeRow').style.display = allDay ? 'none' : 'flex';
}

async function saveEventFromModal(){
  let title = document.getElementById('evmTitle').value.trim();
  if(typeof parseNaturalEvent === 'function'){
    const parsed = parseNaturalEvent(title);
    if(parsed && parsed.title) title = parsed.title;
  }
  const desc = document.getElementById('evmDesc').value.trim();
  const date = document.getElementById('evmDate').value;
  const allDay = document.getElementById('evmAllDay').checked;
  const time = document.getElementById('evmTime').value;
  if(!title){ showToast('Please enter a title'); return; }
  if(!date){ showToast('Please select a date'); return; }
  const btn = document.getElementById('eventModalSaveBtn');
  btn.disabled = true; btn.textContent = 'Saving...';
  try{
    const payload = {
      title: title,
      event_date: date,
      description: desc || null,
      event_time: allDay ? null : (time || null)
    };
    if(_editingEventId){
      await fetch(SB+'/rest/v1/calendar_events?id=eq.'+_editingEventId, {
        method:'PATCH',
        headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
        body:JSON.stringify(payload)
      });
    } else {
      payload.created_by = me;
      await sbPost('calendar_events', payload);
    }
    closeEventModal();
    await loadBirthdays();
    showToast(_editingEventId ? 'Event updated' : 'Event added');
  }catch(e){
    showToast('Failed to save');
  }finally{
    btn.disabled = false;
    btn.textContent = _editingEventId ? 'Save' : 'Add';
  }
}

async function deleteEventFromModal(){
  if(!_editingEventId) return;
  if(!confirm('Delete this event?')) return;
  try{
    await fetch(SB+'/rest/v1/calendar_events?id=eq.'+_editingEventId, {
      method:'DELETE',
      headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}
    });
    closeEventModal();
    await loadBirthdays();
    showToast('Event deleted');
  }catch(e){
    showToast('Failed to delete');
  }
}


let bdayData=[], bdayViewDate=new Date(), calEvents=[];

const AU_HOLIDAYS={
  '2025-01-01':'New Year\'s Day',
  '2025-01-27':'Australia Day (observed)',
  '2025-04-18':'Good Friday',
  '2025-04-19':'Easter Saturday',
  '2025-04-20':'Easter Sunday',
  '2025-04-21':'Easter Monday',
  '2025-04-25':'Anzac Day',
  '2025-06-09':'King\'s Birthday',
  '2025-08-04':'Bank Holiday',
  '2025-10-06':'Labour Day',
  '2025-12-25':'Christmas Day',
  '2025-12-26':'Boxing Day',
  '2026-01-01':'New Year\'s Day',
  '2026-01-26':'Australia Day',
  '2026-04-03':'Good Friday',
  '2026-04-04':'Easter Saturday',
  '2026-04-05':'Easter Sunday',
  '2026-04-06':'Easter Monday',
  '2026-04-25':'Anzac Day',
  '2026-06-08':'King\'s Birthday',
  '2026-08-03':'Bank Holiday',
  '2026-10-05':'Labour Day',
  '2026-12-25':'Christmas Day',
  '2026-12-26':'Boxing Day',
  '2027-01-01':'New Year\'s Day',
  '2027-01-26':'Australia Day',
  '2027-03-26':'Good Friday',
  '2027-03-27':'Easter Saturday',
  '2027-03-28':'Easter Sunday',
  '2027-03-29':'Easter Monday',
  '2027-04-25':'Anzac Day',
  '2027-06-14':'King\'s Birthday',
  '2027-08-02':'Bank Holiday',
  '2027-10-04':'Labour Day',
  '2027-12-25':'Christmas Day',
  '2027-12-27':'Boxing Day (observed)',
};

async function loadBirthdays(){
  const el=document.getElementById('birthdayList');
  if(!el)return;
  bdayViewDate=new Date();
  try{
    const [bdRows, evRows]=await Promise.all([
      sbGet('staff_credentials','?select=staff_name,birthday&birthday=not.is.null'),
      sbGet('calendar_events','?order=event_date.asc')
    ]);
    bdayData=bdRows;
    calEvents=evRows||[];
  }catch(e){console.warn(e);}
  const addBtn=document.getElementById('calAddEventBtn');
  if(addBtn)addBtn.style.display='inline';
  renderBdayCalendar();
  renderCalPreview();
}

let calView = localStorage.getItem('oscars_calview') || 'month';

function setCalView(v){
  calView = v;
  localStorage.setItem('oscars_calview', v);
  document.querySelectorAll('.cal-view-btn').forEach(function(b){
    b.classList.toggle('active', b.getAttribute('data-view')===v);
  });
  renderBdayCalendar();
}

function calPrev(){
  if(calView==='day') bdayViewDate=new Date(bdayViewDate.getFullYear(),bdayViewDate.getMonth(),bdayViewDate.getDate()-1);
  else if(calView==='week') bdayViewDate=new Date(bdayViewDate.getFullYear(),bdayViewDate.getMonth(),bdayViewDate.getDate()-7);
  else if(calView==='year') bdayViewDate=new Date(bdayViewDate.getFullYear()-1,0,1);
  else bdayViewDate=new Date(bdayViewDate.getFullYear(),bdayViewDate.getMonth()-1,1);
  renderBdayCalendar();
}
function calNext(){
  if(calView==='day') bdayViewDate=new Date(bdayViewDate.getFullYear(),bdayViewDate.getMonth(),bdayViewDate.getDate()+1);
  else if(calView==='week') bdayViewDate=new Date(bdayViewDate.getFullYear(),bdayViewDate.getMonth(),bdayViewDate.getDate()+7);
  else if(calView==='year') bdayViewDate=new Date(bdayViewDate.getFullYear()+1,0,1);
  else bdayViewDate=new Date(bdayViewDate.getFullYear(),bdayViewDate.getMonth()+1,1);
  renderBdayCalendar();
}
function calToday(){
  bdayViewDate=new Date();
  if(typeof updateCalendarNepaliLabel==='function') setTimeout(updateCalendarNepaliLabel,50);
  if(calView==='month') bdayViewDate.setDate(1);
  if(calView==='year') bdayViewDate=new Date(bdayViewDate.getFullYear(),0,1);
  renderBdayCalendar();
}





setTimeout(function(){
  document.querySelectorAll('.cal-view-btn').forEach(function(b){
    b.classList.toggle('active', b.getAttribute('data-view')===calView);
  });
}, 0);

function calEventsOnDay(d){
  const items=[];
  const yyyy = d.getFullYear();
  const mm = d.getMonth();
  const dd = d.getDate();
  (calEvents||[]).forEach(function(ev){
    if(!ev.event_date) return;
    const ed = new Date(ev.event_date+'T00:00:00');
    if(ed.getFullYear()===yyyy && ed.getMonth()===mm && ed.getDate()===dd){
      items.push({type:'event', title:ev.title, time:ev.event_time, ev:ev});
    }
  });
  (bdayData||[]).forEach(function(r){
    if(!r.birthday) return;
    const b = new Date(r.birthday+'T00:00:00');
    if(b.getMonth()===mm && b.getDate()===dd){
      items.push({type:'bday', title:r.staff_name+"'s birthday"});
    }
  });
  const dateStr = yyyy+'-'+String(mm+1).padStart(2,'0')+'-'+String(dd).padStart(2,'0');
  if(AU_HOLIDAYS[dateStr]){
    items.push({type:'holiday', title:AU_HOLIDAYS[dateStr]});
  }
  return items;
}

function renderCalPreview(){
  const el = document.getElementById('calPreviewList');
  if(!el) return;
  const today = new Date(); today.setHours(0,0,0,0);
  const horizon = new Date(today); horizon.setDate(horizon.getDate()+30);

  const items = [];
  (calEvents||[]).forEach(function(ev){
    if(!ev.event_date) return;
    const d = new Date(ev.event_date+'T00:00:00');
    if(d >= today && d <= horizon){
      items.push({date:d, type:'event', title:ev.title, desc:ev.description});
    }
  });
  (bdayData||[]).forEach(function(r){
    if(!r.birthday) return;
    const b = new Date(r.birthday+'T00:00:00');
    const thisYear = new Date(today.getFullYear(), b.getMonth(), b.getDate());
    if(thisYear >= today && thisYear <= horizon){
      items.push({date:thisYear, type:'bday', title:r.staff_name.split(' ')[0]+"'s birthday"});
    }
  });
  Object.entries(AU_HOLIDAYS).forEach(function(e){
    const d = new Date(e[0]+'T00:00:00');
    if(d >= today && d <= horizon){
      items.push({date:d, type:'holiday', title:e[1]});
    }
  });

  items.sort(function(a,b){return a.date - b.date;});
  const top = items.slice(0,5);

  if(!top.length){
    el.innerHTML = '<div style="color:var(--ui-ink-4,#94a3b8);font-size:13px;padding:12px 0;">Nothing upcoming in the next 30 days.</div>';
    return;
  }

  const colorMap = {event:'var(--accent)', bday:'#db2777', holiday:'#dc2626'};
  const iconMap = {event:'●', bday:'●', holiday:'●'};
  el.innerHTML = top.map(function(it){
    const dateStr = it.date.toLocaleDateString('en-AU',{weekday:'short', day:'numeric', month:'short'});
    const c = colorMap[it.type];
    const isBday = it.type === 'bday';
    return '<div style="display:flex;align-items:center;gap:10px;padding:9px 2px;border-bottom:1px solid var(--ui-line-soft,#f1f5f9);">'+
      '<div style="width:4px;height:32px;border-radius:4px;background:'+c+';flex-shrink:0;"></div>'+
      '<div style="flex:1;min-width:0;">'+
        '<div style="font-size:13px;font-weight:600;color:var(--text, var(--ui-ink,#0f172a));white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+it.title.replace('🎂 ','')+'</div>'+
        '<div style="font-size:11.5px;color:var(--ui-ink-3,#64748b);margin-top:1px;">'+dateStr+'</div>'+
      '</div>'+
      '</div>';
  }).join('');
  el.querySelector('div:last-child').style.borderBottom = 'none';
}

function renderDayView(el, lbl){
  if(typeof updateCalendarNepaliLabel==='function') setTimeout(updateCalendarNepaliLabel,0);
  const d = new Date(bdayViewDate);
  const today = new Date(); today.setHours(0,0,0,0);
  const isToday = today.getTime() === new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
  if(lbl) lbl.textContent = d.toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric'});

  const items = calEventsOnDay(d);
  const byHour = {};
  const allDay = [];
  items.forEach(function(it){
    if(it.time){
      const h = parseInt(String(it.time).slice(0,2), 10);
      if(!byHour[h]) byHour[h] = [];
      byHour[h].push(it);
    } else {
      allDay.push(it);
    }
  });

  let html = '<div class="cal-day-view">';
  html += '<div class="cal-day-hd"><div class="cal-day-hd-date">'+d.toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long'})+'</div>';
  html += '<div class="cal-day-hd-sub">'+(isToday?'Today · ':'')+items.length+' event'+(items.length!==1?'s':'')+'</div></div>';

  html += '<div class="cal-day-hours">';
  if(allDay.length){
    html += '<div class="cal-day-hour"><div class="cal-day-hour-label">All day</div><div class="cal-day-hour-events">';
    allDay.forEach(function(it){
      html += renderDayEvent(it);
    });
    html += '</div></div>';
  }
  for(let h=0; h<=23; h++){
    const evs = byHour[h] || [];
    let hourLbl;
    if(h===0) hourLbl = '12 AM';
    else if(h===12) hourLbl = '12 PM';
    else if(h<12) hourLbl = h + ' AM';
    else hourLbl = (h-12) + ' PM';
    html += '<div class="cal-day-hour"><div class="cal-day-hour-label">'+hourLbl+'</div><div class="cal-day-hour-events">';
    evs.forEach(function(it){ html += renderDayEvent(it); });
    html += '</div></div>';
  }
  html += '</div>';
  if(!items.length){
    html += '<div class="cal-day-empty" style="padding:24px 16px;">Nothing scheduled today. Tap + Event to add one.</div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

function renderDayEvent(it){
  const cls = 'cal-day-event' + (it.type==='bday' ? ' bday' : '') + (it.type==='holiday' ? ' holiday' : '') + (it.type==='task' ? ' task' : '') + (it.done ? ' done' : '');
  const tStr = it.time ? '<div class="cal-day-event-time">'+String(it.time).slice(0,5)+'</div>' : '';
  const titleEsc = esc(it.title||'');
  const evId = (it.type==='event' && it.ev) ? it.ev.id : null;
  const click = evId ? ' data-ev-id="'+evId+'" onclick="viewEvent(this.dataset.evId,event)"' : '';
  return '<div class="'+cls+'"'+click+'>'+tStr+titleEsc+'</div>';
}

function renderWeekView(el, lbl){
  if(typeof updateCalendarNepaliLabel==='function') setTimeout(updateCalendarNepaliLabel,0);
  const start = new Date(bdayViewDate);
  const dow = start.getDay();
  const offset = dow===0 ? -6 : 1-dow;
  start.setDate(start.getDate()+offset);
  start.setHours(0,0,0,0);
  const end = new Date(start); end.setDate(end.getDate()+6);

  if(lbl){
    const sameMonth = start.getMonth()===end.getMonth();
    if(sameMonth){
      lbl.textContent = start.toLocaleDateString('en-AU',{day:'numeric'})+'–'+end.toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric'});
    } else {
      lbl.textContent = start.toLocaleDateString('en-AU',{day:'numeric',month:'short'})+' - '+end.toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'});
    }
  }

  const today = new Date(); today.setHours(0,0,0,0);
  let html = '<div class="cal-week-view"><div class="cal-week-grid">';
  for(let i=0;i<7;i++){
    const d = new Date(start); d.setDate(start.getDate()+i);
    const isToday = d.getTime() === today.getTime();
    const items = calEventsOnDay(d);
    html += '<div class="cal-week-col'+(isToday?' today':'')+'">';
    html += '<div class="cal-week-col-hd"><div class="day-name">'+d.toLocaleDateString('en-AU',{weekday:'short'})+'</div><div class="day-num">'+d.getDate()+'</div></div>';
    html += '<div class="cal-week-col-events">';
    items.forEach(function(it){
      const cls = 'cal-week-event' + (it.type==='bday' ? ' bday' : '') + (it.type==='holiday' ? ' holiday' : '') + (it.type==='task' ? ' task' : '');
      const tStr = it.time ? String(it.time).slice(0,5)+' ' : '';
      const titleEsc = esc(it.title||'');
      const evId = (it.type==='event' && it.ev) ? it.ev.id : null;
      const click = evId ? ' data-ev-id="'+evId+'" onclick="viewEvent(this.dataset.evId,event)"' : '';
      html += '<div class="'+cls+'"'+click+' title="'+titleEsc+'">'+tStr+titleEsc+'</div>';
    });
    html += '</div></div>';
  }
  html += '</div></div>';
  el.innerHTML = html;
}

function renderYearView(el, lbl){
  if(typeof updateCalendarNepaliLabel==='function') setTimeout(updateCalendarNepaliLabel,0);
  const yr = bdayViewDate.getFullYear();
  if(lbl) lbl.textContent = String(yr);
  const today = new Date(); today.setHours(0,0,0,0);

  let html = '<div class="cal-year-view">';
  for(let m=0;m<12;m++){
    const monthName = new Date(yr,m,1).toLocaleDateString('en-AU',{month:'long'});
    const firstDay = new Date(yr,m,1).getDay();
    const startOff = firstDay===0 ? 6 : firstDay-1;
    const daysInMonth = new Date(yr,m+1,0).getDate();
    html += '<div class="cal-year-month" onclick="bdayViewDate=new Date('+yr+','+m+',1);setCalView(\'month\')">';
    html += '<div class="cal-year-month-name">'+monthName+'</div>';
    html += '<div class="cal-year-grid">';
    ['M','T','W','T','F','S','S'].forEach(function(d){html+='<div class="cal-year-wd">'+d+'</div>';});
    for(let i=0;i<startOff;i++) html+='<div class="cal-year-d empty">·</div>';
    for(let d=1;d<=daysInMonth;d++){
      const dt = new Date(yr,m,d);
      const isToday = dt.getTime() === today.getTime();
      const evs = calEventsOnDay(dt);
      const has = evs.length > 0;
      html+='<div class="cal-year-d'+(isToday?' today':'')+(has?' has-event':'')+'">'+d+'</div>';
    }
    html += '</div></div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

function renderBdayCalendar(){
  const el=document.getElementById('birthdayList');
  const lbl=document.getElementById('bdayMonthLabel');
  if(!el)return;
  if(_calSystem !== 'bs' && typeof updateCalendarNepaliLabel==='function') setTimeout(updateCalendarNepaliLabel,0);

  if(calView==='day'){ return renderDayView(el, lbl); }
  if(calView==='week'){ return renderWeekView(el, lbl); }
  if(calView==='year'){ return renderYearView(el, lbl); }

  const today=new Date(); today.setHours(0,0,0,0);
  const yr=bdayViewDate.getFullYear(), mo=bdayViewDate.getMonth();
  if(lbl)lbl.textContent=new Date(yr,mo,1).toLocaleDateString('en-AU',{month:'long',year:'numeric'});
  if(typeof updateCalendarNepaliLabel === 'function') setTimeout(updateCalendarNepaliLabel, 0);

  const bdayMap={};
  bdayData.forEach(function(r){
    if(!r.birthday)return;
    const d=new Date(r.birthday+'T00:00:00');
    if(d.getMonth()===mo){
      if(!bdayMap[d.getDate()])bdayMap[d.getDate()]=[];
      bdayMap[d.getDate()].push({name:r.staff_name});
    }
  });

  const holidayMap={};
  Object.entries(AU_HOLIDAYS).forEach(function(e){
    const d=new Date(e[0]+'T00:00:00');
    if(d.getFullYear()===yr&&d.getMonth()===mo) holidayMap[d.getDate()]=e[1];
  });

  const eventMap={};
  calEvents.forEach(function(ev){
    if(!ev.event_date)return;
    const d=new Date(ev.event_date+'T00:00:00');
    if(d.getFullYear()===yr&&d.getMonth()===mo){
      if(!eventMap[d.getDate()])eventMap[d.getDate()]=[];
      eventMap[d.getDate()].push(ev);
    }
  });

  const firstDay=new Date(yr,mo,1).getDay();
  const startOffset=(firstDay===0?6:firstDay-1);
  const daysInMonth=new Date(yr,mo+1,0).getDate();
  const prevMonthDays=new Date(yr,mo,0).getDate();

  let html='';

  html+='<div class="cal-week-header">';
  ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(function(d){
    html+='<div class="cal-weekday">'+d+'</div>';
  });
  html+='</div>';

  html+='<div class="cal-grid">';

  for(let i=startOffset;i>0;i--){
    const pd=prevMonthDays-i+1;
    html+='<div class="cal-day cal-day-prev"><div class="cal-date">'+pd+'</div></div>';
  }

  for(let d=1;d<=daysInMonth;d++){
    const isToday=today.getFullYear()===yr&&today.getMonth()===mo&&today.getDate()===d;
    const bdays=bdayMap[d]||[];
    const holiday=holidayMap[d];
    const events=eventMap[d]||[];
    const isWeekend=((startOffset+d-1)%7)>=5;

    const classes=['cal-day'];
    if(isToday)classes.push('cal-day-today');
    if(isWeekend)classes.push('cal-day-weekend');

    const dateStr=yr+'-'+String(mo+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    const clickHandler='onclick="openDayEventModal(\''+dateStr+'\')" style="cursor:pointer;"';
    html+='<div class="'+classes.join(' ')+'" '+clickHandler+'>';
    const _adDateObj_$ = new Date(yr, mo, d);
    const _bsDate_$ = (typeof adToBs === 'function') ? adToBs(_adDateObj_$) : null;
    const _bsDayNep_$ = _bsDate_$ ? String(_bsDate_$.day) : '';
    html+='<div class="cal-date">'+(isToday?'<span class="cal-date-today">'+d+'</span>':d);
    if(_bsDayNep_$) html += '<span class="cal-bs-day" title="'+(_bsDate_$.day+' '+NEPALI_BS_MONTH_NAMES[_bsDate_$.month]+' '+_bsDate_$.year+' BS')+'">'+_bsDayNep_$+'</span>';
    html += '</div>';
    html+='<div class="cal-pills">';

    if(holiday){
      html+='<div class="cal-pill cal-pill-holiday" title="'+holiday+'">'+holiday+'</div>';
    }
    events.forEach(function(ev,evIdx){
      const timeStr=ev.event_time?ev.event_time.slice(0,5)+' ':'';
      const colorIdx=(String(ev.id||'').split('').reduce(function(a,c){return a+c.charCodeAt(0);},0)%6)+1;
      const canDelete=myIsAdmin||(ev.created_by===me);
      const deleteBtn=canDelete?'<span class="cal-pill-x" data-id="'+ev.id+'" onclick="event.stopPropagation();deleteCalEvent(this.dataset.id)">×</span>':'';
      html+='<div class="cal-pill cal-pill-event-'+colorIdx+'" data-ev-id="'+ev.id+'" onclick="event.stopPropagation();viewEvent(this.dataset.evId,event)" style="cursor:pointer;" title="'+esc(ev.title)+(ev.description?' — '+ev.description:'')+'">'+timeStr+esc(ev.title)+deleteBtn+'</div>';
    });
    bdays.forEach(function(b){
      html+='<div class="cal-pill cal-pill-bday" title="'+esc(b.name)+'\'s birthday">'+b.name.split(' ')[0]+'</div>';
    });
    html+='</div></div>';
  }

  const totalCells=startOffset+daysInMonth;
  const trailing=(7-(totalCells%7))%7;
  for(let i=1;i<=trailing;i++){
    html+='<div class="cal-day cal-day-next"><div class="cal-date">'+i+'</div></div>';
  }

  html+='</div>';

  const upcoming=[];
  calEvents.forEach(function(ev){
    if(!ev.event_date)return;
    const d=new Date(ev.event_date+'T00:00:00');
    const diff=Math.round((d-today)/(1000*60*60*24));
    if(diff>=0&&diff<=30)upcoming.push({label:ev.title,diff,date:d,type:'event',desc:ev.description,id:ev.id});
  });
  bdayData.forEach(function(r){
    if(!r.birthday)return;
    const d=new Date(r.birthday+'T00:00:00');
    const thisYear=new Date(today.getFullYear(),d.getMonth(),d.getDate());
    if(thisYear<today)thisYear.setFullYear(today.getFullYear()+1);
    const diff=Math.round((thisYear-today)/(1000*60*60*24));
    if(diff<=30)upcoming.push({label:r.staff_name,diff,date:thisYear,type:'birthday'});
  });
  Object.entries(AU_HOLIDAYS).forEach(function(e){
    const d=new Date(e[0]+'T00:00:00');
    const diff=Math.round((d-today)/(1000*60*60*24));
    if(diff>=0&&diff<=30)upcoming.push({label:e[1],diff,date:d,type:'holiday'});
  });
  upcoming.sort(function(a,b){return a.diff-b.diff;});

  if(upcoming.length){
    html+='<div class="cal-upcoming">';
    html+='<div class="cal-upcoming-hd">Up next</div>';
    upcoming.slice(0,8).forEach(function(u){
      const lbl=u.diff===0?'Today':u.diff===1?'Tomorrow':u.date.toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'});
      const dotCls=u.type==='birthday'?'cal-dot-bday':u.type==='event'?'cal-dot-event':'cal-dot-holiday';
      const icon=u.type==='birthday'?'':u.type==='event'?'':'';
      html+='<div class="cal-upcoming-item">';
      if(u.type==='birthday' && window.renderStaffAvatar){
        html+='<div style="flex-shrink:0;">'+window.renderStaffAvatar(u.label, 26)+'</div>';
      }else{
        html+='<div class="cal-dot '+dotCls+'"></div>';
      }
      html+='<div class="cal-upcoming-main"><div class="cal-upcoming-title">'+icon+' '+u.label+'</div><div class="cal-upcoming-when">'+lbl+'</div></div>';
      html+='</div>';
    });
    html+='</div>';
  }

  el.innerHTML=html;
}


async function loadOnboardingChecklist(){
  const card=document.getElementById('onboardCard');
  if(card)card.style.display='none';
  return;
}










let _audioUnlocked = false;
function _unlockAudio(){
  if(_audioUnlocked) return;
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(0); osc.stop(0.01);
    _audioUnlocked = true;
    setTimeout(function(){ try{ ctx.close(); }catch(e){} }, 100);
  }catch(e){}
}
document.addEventListener('touchstart', _unlockAudio, {once:true});
document.addEventListener('click', _unlockAudio, {once:true});
document.addEventListener('keydown', _unlockAudio, {once:true});







let _audioCtx = null;
function playNotifSound(typeKey){
  try{
    if(!_audioCtx){
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if(_audioCtx.state === 'suspended') _audioCtx.resume();

    const tones = {
      'leave-approved':     [{f:660, t:0}, {f:880, t:0.10}, {f:1100, t:0.20}],
      'leave-declined':     [{f:660, t:0}, {f:520, t:0.12}],
      'availability-expiry':[{f:740, t:0}, {f:740, t:0.14}],
      quiz:                 [{f:880, t:0}, {f:1175, t:0.10}],
      announcements:        [{f:880, t:0}, {f:1100, t:0.12}],
      default:              [{f:880, t:0}]
    };
    const seq = tones[typeKey] || tones.default;
    const now = _audioCtx.currentTime;
    seq.forEach(function(n){
      const osc = _audioCtx.createOscillator();
      const gain = _audioCtx.createGain();
      osc.frequency.value = n.f;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, now + n.t);
      gain.gain.linearRampToValueAtTime(.18, now + n.t + .01);
      gain.gain.exponentialRampToValueAtTime(.001, now + n.t + .15);
      osc.connect(gain).connect(_audioCtx.destination);
      osc.start(now + n.t);
      osc.stop(now + n.t + .2);
    });
  }catch(e){console.warn('sound:', e);}
}

const _sysNotifFired = new Set();
function parseSupabaseTs(s){
  if(!s) return Date.now();
  if(typeof s === 'string' && !/Z$|[+-]\d{2}:?\d{2}$/.test(s)){
    s = s + 'Z';
  }
  const t = new Date(s).getTime();
  return isNaN(t) ? Date.now() : t;
}

function triggerBellPulse(){
  ['mhBellBtn','sbBellWrap'].forEach(function(id){
    const el = document.getElementById(id);
    const btn = el ? (el.tagName === 'BUTTON' ? el : el.querySelector('button')) : null;
    if(btn){
      btn.classList.remove('bell-pulsing');
      void btn.offsetWidth;
      btn.classList.add('bell-pulsing');
      setTimeout(function(){ btn.classList.remove('bell-pulsing'); }, 6200);
    }
  });
}

function showSystemNotification(title, body, taskId, typeKey){
  triggerBellPulse();

  const sigKey = (typeKey||'gen')+':'+(taskId||title||'');
  if(_sysNotifFired.has(sigKey)) return;
  _sysNotifFired.add(sigKey);

  if(typeof window.Notification === 'undefined'){
    return null;
  }
  if(Notification.permission !== 'granted'){
    return null;
  }
  if(typeKey && typeof notifAllowed === 'function' && !notifAllowed(typeKey)){
    return null;
  }
  const dedupeKey = 'sys_notif_fired_'+(me||'');
  let firedList = [];
  try{ firedList = JSON.parse(localStorage.getItem(dedupeKey)||'[]'); }catch(e){}
  const tag = String(taskId || (title+'-'+body)).slice(0,200);
  if(firedList.includes(tag)) return null;
  firedList.push(tag);
  if(firedList.length > 500) firedList = firedList.slice(-500);
  try{ localStorage.setItem(dedupeKey, JSON.stringify(firedList)); }catch(e){}
  if(localStorage.getItem('oscars_notif_sound') !== '0'){
    playNotifSound(typeKey);
  }
  if(typeof NotifManager !== 'undefined'){
    let link = null;
    if(typeKey === 'announcements') link = 'announcements';
    else if(typeKey === 'quiz') link = 'learning';
    else if(typeKey === 'leave-approved' || typeKey === 'leave-declined') link = 'schedule';
    else if(typeKey === 'availability-expiry') link = 'availability';
    NotifManager.push({
      id: tag,
      type: typeKey || 'general',
      title: title,
      body: body,
      ts: Date.now(),
      link: link
    });
  }
  try{
    const opts = {
      body: body,
      tag: 'task-reminder-' + (taskId||Date.now()),
      requireInteraction: true,
      silent: false
    };
    const n = new Notification(title, opts);
    n.onclick = function(){
      window.focus();
      if(typeof goTo === 'function') goTo('home');
      n.close();
    };
    n.onerror = function(e){ console.error('Notification error:', e); };
    return n;
  }catch(e){
    console.error('Failed to create Notification:', e);
    if(typeof showToast==='function') showToast('Notification failed: '+e.message);
    return null;
  }
}

var _NX_DARK_THEMES=['dark','midnight','renaissance','graphite','evergreen','ember','plum','deepsea'];
function _nxHexRgb(h){ var m=/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(h||'').trim()); if(!m) return null; var x=m[1]; if(x.length===3) x=x.split('').map(function(c){return c+c;}).join(''); return [parseInt(x.slice(0,2),16),parseInt(x.slice(2,4),16),parseInt(x.slice(4,6),16)]; }
function _nxLum(c){ var f=function(v){ v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4); }; return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2]); }
function _nxContrast(a,b){ var la=_nxLum(a), lb=_nxLum(b); return (Math.max(la,lb)+0.05)/(Math.min(la,lb)+0.05); }
function _nxRgbHsl(c){ var r=c[0]/255,g=c[1]/255,b=c[2]/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),h=0,s=0,l=(mx+mn)/2,d=mx-mn;
  if(d){ s=l>0.5 ? d/(2-mx-mn) : d/(mx+mn); if(mx===r) h=((g-b)/d+(g<b?6:0)); else if(mx===g) h=(b-r)/d+2; else h=(r-g)/d+4; h/=6; } return [h,s,l]; }
function _nxHslRgb(h,s,l){ function q(p,qq,t){ if(t<0)t+=1; if(t>1)t-=1; if(t<1/6) return p+(qq-p)*6*t; if(t<1/2) return qq; if(t<2/3) return p+(qq-p)*(2/3-t)*6; return p; }
  if(!s){ var v=Math.round(l*255); return [v,v,v]; } var qq=l<0.5 ? l*(1+s) : l+s-l*s, p=2*l-qq; return [Math.round(q(p,qq,h+1/3)*255),Math.round(q(p,qq,h)*255),Math.round(q(p,qq,h-1/3)*255)]; }
function _nxReadableTextColor(hex){
  var dark=_NX_DARK_THEMES.indexOf(document.documentElement.getAttribute('data-theme')||'light')>=0;
  var bgRaw=''; try{ bgRaw=getComputedStyle(document.documentElement).getPropertyValue('--m-card'); }catch(e){}
  var bg=_nxHexRgb(bgRaw) || (dark ? [19,24,32] : [255,255,255]);
  var rgb=_nxHexRgb(hex); if(!rgb) return hex;
  var target=5.0;
  if(_nxContrast(rgb,bg)>=target) return hex;
  var hsl=_nxRgbHsl(rgb);
  if(dark && (hsl[1]<0.15 || String(hex).toLowerCase()==='#0f172a')) return 'var(--m-ink,#f1f5f9)';
  var l=hsl[2], step=dark ? 0.02 : -0.02;
  for(var i=0;i<46;i++){ l=Math.min(0.95,Math.max(0.05,l+step)); var c=_nxHslRgb(hsl[0],hsl[1],l);
    if(_nxContrast(c,bg)>=target) return '#'+c.map(function(v){ return ('0'+v.toString(16)).slice(-2); }).join(''); }
  return dark ? '#f1f5f9' : '#0f172a';
}
function _nxApplyTextColor(){
  var saved=localStorage.getItem('nexus_text_color'); if(!saved) return;
  document.body.setAttribute('data-text-color', saved);
  document.body.style.setProperty('--user-text-color', _nxReadableTextColor(saved));
}
function setTextColor(hex, label){
  localStorage.setItem('nexus_text_color', hex);
  _nxApplyTextColor();
  document.querySelectorAll('.tc-swatch').forEach(function(s){
    s.classList.toggle('selected', s.dataset.tc === hex);
  });
  if(label && typeof showToast === 'function') showToast('Text colour: '+label);
}

function applySavedTextColor(){
  const saved = localStorage.getItem('nexus_text_color');
  if(!saved) return;
  _nxApplyTextColor();
  setTimeout(function(){
    document.querySelectorAll('.tc-swatch').forEach(function(s){
      s.classList.toggle('selected', s.dataset.tc === saved);
    });
  }, 100);
}

let _geofenceSaveTimer = null;
async function onGeofenceSliderInput(val){
  const v = parseInt(val,10);
  document.getElementById('geofenceVal').textContent = v + ' m';
  _globalGeofenceM = v;
  clearTimeout(_geofenceSaveTimer);
  _geofenceSaveTimer = setTimeout(async function(){
    console.log('[geofence] saving', v, 'm to supabase');
    try{
      const existing = await sbGet('app_settings','?key=eq.geofence_radius_m');
      console.log('[geofence] existing row:', existing);
      let res;
      if(existing && existing.length){
        res = await fetch(SB+'/rest/v1/app_settings?key=eq.geofence_radius_m',{
          method:'PATCH',
          headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'return=representation'},
          body: JSON.stringify({value: String(v), updated_by: me, updated_at: new Date().toISOString()})
        });
      } else {
        res = await fetch(SB+'/rest/v1/app_settings',{
          method:'POST',
          headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'return=representation'},
          body: JSON.stringify({key:'geofence_radius_m', value: String(v), updated_by: me})
        });
      }
      const txt = await res.text().catch(function(){return '?';});
      console.log('[geofence] save status:', res.status, 'body:', txt.slice(0,200));
      if(!res.ok){
        showToast('⚠ Geofence save failed: '+res.status+' — see console', 'error');
        return;
      }
      const verify = await sbGet('app_settings','?key=eq.geofence_radius_m');
      if(verify && verify.length && parseInt(verify[0].value,10) === v){
        showToast('Geofence saved: '+v+' m for all staff', 'success');
      } else {
        showToast('⚠ Save did not persist — check supabase RLS', 'error');
        console.error('[geofence] verify failed:', verify);
      }
    }catch(e){
      console.error('[geofence] save exception:', e);
      showToast('Save error: '+e.message, 'error');
    }
  }, 600);
  if(typeof applyGpsLock === 'function') applyGpsLock();
}

let _geofencePending = null;
function setGeofencePreset(m){
  _geofencePending = m;
  document.querySelectorAll('.gfp-btn').forEach(function(b){
    b.classList.toggle('pending', parseInt(b.dataset.radius,10) === m);
    b.classList.remove('active');
  });
  const val = document.getElementById('geofenceVal');
  if(val){
    val.textContent = m + ' m (pending)';
    val.style.color = '#f59e0b';
  }
  const saveBar = document.getElementById('geofenceSaveBar');
  if(saveBar) saveBar.style.display = '';
}

function cancelGeofenceChange(){
  _geofencePending = null;
  const saveBar = document.getElementById('geofenceSaveBar');
  if(saveBar) saveBar.style.display = 'none';
  document.querySelectorAll('.gfp-btn').forEach(function(b){
    b.classList.remove('pending');
  });
  maybeShowGeofenceAdjuster();
}

async function commitGeofenceChange(){
  if(_geofencePending === null) return;
  const m = _geofencePending;
  const btn = document.getElementById('geofenceCommitBtn');
  if(btn){ btn.disabled = true; btn.textContent = 'Saving...'; }
  onGeofenceSliderInput(m);
  setTimeout(function(){
    _geofencePending = null;
    const saveBar = document.getElementById('geofenceSaveBar');
    if(saveBar) saveBar.style.display = 'none';
    document.querySelectorAll('.gfp-btn').forEach(function(b){
      b.classList.remove('pending');
      b.classList.toggle('active', parseInt(b.dataset.radius,10) === m);
    });
    const val = document.getElementById('geofenceVal');
    if(val){
      val.textContent = m + ' m';
      val.style.color = '';
    }
    if(btn){ btn.disabled = false; btn.textContent = 'Save'; }
  }, 800);
}

async function resetGeofence(){
  if(!confirm('Reset geofence to default 15 m for all staff?')) return;
  localStorage.removeItem('oscars_geofence_m');
  _globalGeofenceM = null;
  try{
    await fetch(SB+'/rest/v1/app_settings?key=eq.geofence_radius_m',{
      method:'DELETE',
      headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Prefer':'return=minimal'}
    });
  }catch(e){}
  document.getElementById('geofenceVal').textContent = '15 m (default)';
  document.querySelectorAll('.gfp-btn').forEach(function(b){
    b.classList.toggle('active', parseInt(b.dataset.radius,10) === 15);
  });
  showToast('Reset to default 15 m for all staff', 'success');
  if(typeof applyGpsLock === 'function') applyGpsLock();
}

async function maybeShowGeofenceAdjuster(){
  const el = document.getElementById('geofenceAdjuster');
  if(el) el.style.display = 'none';
  return;
  /* old code below kept for reference, never reached */
  const _disabled = false;
  if(_disabled){
    const globalV = await loadGlobalGeofence();
    const cur = globalV || 15;
    const val = document.getElementById('geofenceVal');
    if(val) val.textContent = cur + ' m' + (globalV ? '' : ' (default)');
    document.querySelectorAll('.gfp-btn').forEach(function(b){
      b.classList.toggle('active', parseInt(b.dataset.radius,10) === cur);
    });
  } else {
    el.style.display = 'none';
  }
}

function toggleNotifSound(on){
  localStorage.setItem('oscars_notif_sound', on ? '1' : '0');
  if(on){
    setTimeout(function(){ playNotifSound('quiz'); }, 100);
    showToast('Notification sounds enabled');
  } else {
    showToast('Notification sounds muted');
  }
}

function notifAllowed(){
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

function renderNotifPanel(){
  const status = document.getElementById('notifPermStatus');
  if(!status) return;

  const supported = typeof Notification !== 'undefined';
  const perm = supported ? Notification.permission : 'unsupported';
  const isHttps = (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1');

  if(!supported){
    status.innerHTML = '<div style="color:var(--ui-ink,#0f172a);">Your browser does not support notifications.</div>';
  } else if(!isHttps){
    status.innerHTML = '<div style="color:#dc2626;font-weight:600;">⚠ HTTPS required</div>'+
      '<div style="font-size:11.5px;color:var(--ui-ink-3,#64748b);margin-top:4px;">Notifications need a secure connection. Open this site over HTTPS.</div>';
  } else if(perm === 'granted'){
    status.innerHTML = '<div style="display:flex;align-items:center;gap:8px;">'+
      '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#10b981;"></span>'+
      '<span style="font-weight:600;color:var(--ui-ink,#0f172a);">System notifications enabled</span>'+
      '</div>'+
      '<div style="font-size:11.5px;color:var(--ui-ink-3,#64748b);margin-top:4px;">You\'ll be alerted about leave decisions, new training, and availability reminders. To disable, use your browser settings.</div>';
  } else if(perm === 'denied'){
    status.innerHTML = '<div style="color:#dc2626;font-weight:600;">⚠ Notifications blocked</div>'+
      '<div style="font-size:11.5px;color:var(--ui-ink-3,#64748b);margin-top:4px;line-height:1.5;">You blocked notifications. To allow them: click the lock icon to the left of the URL → Notifications → Allow → reload this page.</div>';
  } else {
    status.innerHTML = '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'+
      '<span style="font-weight:600;color:var(--ui-ink,#0f172a);">Notifications are off</span>'+
      '<button onclick="requestNotifyFromProfile()" class="btn btn-green" style="font-size:12px;padding:6px 14px;">Turn on</button>'+
      '</div>'+
      '<div style="font-size:11.5px;color:var(--ui-ink-3,#64748b);margin-top:6px;line-height:1.5;">Get a desktop popup when there\'s new activity. Browser will ask once. <strong>If your browser is asking but the page still says off,</strong> click "Turn on" again or reload the page.</div>';
  }

}

async function requestNotifyFromProfile(){
  if(typeof Notification === 'undefined'){
    if(typeof showToast==='function') showToast('Browser does not support notifications');
    return;
  }
  if(Notification.permission === 'granted'){
    renderNotifPanel();
    if(typeof showToast === 'function') showToast('Notifications already enabled');
    return;
  }
  if(Notification.permission === 'denied'){
    if(typeof showToast === 'function') showToast('Blocked. Use browser settings to allow.');
    renderNotifPanel();
    return;
  }
  try{
    let result;
    try{
      result = await Notification.requestPermission();
    }catch(e){
      result = await new Promise(function(resolve){ Notification.requestPermission(resolve); });
    }
    setTimeout(renderNotifPanel, 50);
    setTimeout(renderNotifPanel, 500);
    if(result === 'granted'){
      if(typeof showToast === 'function') showToast('Notifications enabled');
      try{ new Notification('Notifications on', {body:'You will now receive alerts.', tag:'test-ping'}); }catch(e){}
    } else if(result === 'denied'){
      if(typeof showToast === 'function') showToast('Permission denied');
    }
  }catch(e){
    console.error('Permission request failed:', e);
    if(typeof showToast === 'function') showToast('Permission request failed');
  }
}


















const STATUS_COLORS = {online:'#2eb67d', sleep:'#ecb22e', unavailable:'#e01e5a', none:'transparent'};
const STATUS_LABELS = {online:'Online', sleep:'Away', unavailable:'Busy', none:'Status'};






































let _convoMenuPeer = null;










