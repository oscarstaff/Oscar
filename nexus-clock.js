let _clockState = null;
let _clockSinceTs = null;
let _clockTickTimer = null;
let _clockPending = null;

async function checkGpsPermission(){
  if(!navigator.permissions || !navigator.permissions.query){
    return 'prompt';
  }
  try{
    const result = await navigator.permissions.query({name:'geolocation'});
    return result.state;
  }catch(e){
    return 'prompt';
  }
}

async function retryGpsCheck(){
  const ban = document.getElementById('gpsBanner');
  const msg = ban && ban.querySelector('span');
  const b = ban && ban.querySelector('button');
  if(b){ b.disabled = true; b.textContent = 'Checking…'; }
  if(msg) msg.textContent = 'Checking your location…';
  navigator.geolocation.getCurrentPosition(
    function(){
      if(typeof showToast==='function') showToast('Location is on ✓','success');
      applyGpsLock();
    },
    function(err){
      if(msg){
        msg.textContent = (err && err.code===1)
          ? 'Still blocked. Tap the lock icon next to the address bar, set Location to Allow, then check again.'
          : 'Couldn\u2019t get a fix yet. Turn Location on, move near a window, then check again.';
      }
      if(b){ b.disabled = false; b.textContent = 'Check again'; }
    },
    { timeout:10000, maximumAge:0 }
  );
}

document.addEventListener('visibilitychange', function(){
  if(!document.hidden && typeof applyGpsLock === 'function'){
    applyGpsLock();
  }
});

async function applyGpsLock(){
  const btn = document.getElementById('clockBtn');
  if(!btn) return;
  localStorage.removeItem('oscars_gps_bypass');
  const state = await checkGpsPermission();
  if(state === 'denied' && _clockState !== 'in'){
    btn.disabled = true;
    btn.style.opacity = '.45';
    btn.style.cursor = 'not-allowed';
    btn.title = 'GPS required — enable location in your browser settings';
    let banner = document.getElementById('gpsBanner');
    if(!banner){
      banner = document.createElement('div');
      banner.id = 'gpsBanner';
      banner.style.cssText = 'background:#fef3c7;color:#92400e;border:1px solid #fde68a;border-radius:8px;padding:8px 12px;margin-top:10px;font-size:12px;font-weight:600;display:flex;align-items:center;gap:8px;';
      banner.innerHTML = '<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>'+
        '<span style="flex:1;">Location permission denied.</span>'+
        '<button onclick="retryGpsCheck()" style="background:#92400e;color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;">Try again</button>';
      const card = document.getElementById('clockCard');
      if(card) card.appendChild(banner);
    }
    banner.style.display = '';
  } else {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
    btn.title = '';
    const banner = document.getElementById('gpsBanner');
    if(banner) banner.style.display = 'none';
  }
}


async function flushClockSyncQueue(){
  try{
    const sbQ = JSON.parse(localStorage.getItem('clock_supabase_queue') || '[]');
    if(sbQ.length){
      console.log('[clock] retrying '+sbQ.length+' queued supabase writes');
      const remSb = [];
      let _anyFlushed = false;
      for(const item of sbQ){
        if(Date.now() - item.queuedAt > 3*24*3600*1000) continue;
        try{
          let _dupe=false;
          try{ const ex=await sbGet('clock_log','?staff_name=eq.'+encodeURIComponent(item.payload.staff_name)+'&action=eq.'+item.payload.action+'&ts=eq.'+encodeURIComponent(item.payload.ts)+'&limit=1'); _dupe=!!(ex&&ex.length); }catch(_){}
          if(_dupe){ _anyFlushed=true; continue; }
          const res = await sbPost('clock_log', item.payload);
          if(res && res.ok === false){ throw new Error('HTTP '+res.status); }
          _anyFlushed = true;
          console.log('[clock] queued supabase write flushed OK');
        }catch(e){
          remSb.push(item);
        }
      }
      localStorage.setItem('clock_supabase_queue', JSON.stringify(remSb));
      if(_anyFlushed){
        if(remSb.length === 0) _clockPending = null;
        if(typeof loadClockState === 'function'){ try{ loadClockState(); }catch(_){} }
        try{ renderClockCard(); }catch(_){}
      }
    }
  }catch(e){ console.warn('flush supabase queue:', e); }
  
  try{
    const queue = JSON.parse(localStorage.getItem('clock_sync_queue') || '[]');
    if(!queue.length) return;
    console.log('[clock] retrying '+queue.length+' queued sheet syncs');
    const DEFAULT_SHEET_URL = 'https://script.google.com/macros/s/AKfycby0Bq97bCZAsmnruXFuJuCqXQE_kOxhYE2KFuJnVzLXtT5CV0Y12k5176dxZbdaYVGE/exec';
    const sheetUrl = localStorage.getItem('oscars_sheet_url') || DEFAULT_SHEET_URL;
    const remaining = [];
    for(const item of queue){
      if(Date.now() - item.queuedAt > 3*24*3600*1000) continue;
      try{
        const r = await fetch(sheetUrl, {
          method:'POST',
          headers:{'Content-Type':'text/plain;charset=utf-8'},
          body: JSON.stringify(item.payload)
        });
        if(r.ok){
          console.log('[clock] queued sync flushed OK');
        } else {
          remaining.push(item);
        }
      }catch(e){
        remaining.push(item);
      }
    }
    localStorage.setItem('clock_sync_queue', JSON.stringify(remaining));
  }catch(e){ console.warn('flushClockSyncQueue:', e); }
}

let _clockFlushInFlight = false;
async function retryClockQueueSafely(reason){
  if(_clockFlushInFlight) return;
  try{
    const a = localStorage.getItem('clock_supabase_queue') || '[]';
    const b = localStorage.getItem('clock_sync_queue') || '[]';
    if(a === '[]' && b === '[]') return;
  }catch(_){}
  _clockFlushInFlight = true;
  try{ await flushClockSyncQueue(); }
  catch(e){ console.warn('[clock] retry ('+reason+') failed', e); }
  finally{ _clockFlushInFlight = false; }
}
window.addEventListener('online', function(){ retryClockQueueSafely('online'); });
document.addEventListener('visibilitychange', function(){
  if(!document.hidden) retryClockQueueSafely('visible');
});
setInterval(function(){ retryClockQueueSafely('interval'); }, 60000);

async function loadClockState(){
  if(!me) return;
  window._clockSyncing = true;
  try{ const _cb=document.getElementById('clockBtn'); if(_cb) _cb.classList.add('cc-syncing'); }catch(e){}
  applyGpsLock();
  try{
    const cached = localStorage.getItem('clock_state_'+me);
    if(cached){
      const obj = JSON.parse(cached);
      if(obj && obj.state){
        _clockState = obj.state;
        _clockSinceTs = obj.ts ? new Date(obj.ts) : null;
        renderClockCard();
      }
    }
  }catch(e){}
  try{
    let _cachedSaidIn = false;
    try{
      const _c = JSON.parse(localStorage.getItem('clock_state_'+me) || 'null');
      _cachedSaidIn = !!(_c && _c.state === 'in');
    }catch(_){}

    const rows = await sbGet('clock_log','?staff_name=eq.'+encodeURIComponent(me)+'&order=ts.desc&limit=4');
    if(rows && rows.length){
      _clockState = rows[0].action;
      let _k = 0;
      if(rows[0].action === 'out'){ while(_k+1 < rows.length && rows[_k+1].action === 'out') _k++; }
      _clockSinceTs = new Date(rows[_k].ts);
    } else {
      _clockState = 'out';
      _clockSinceTs = null;
    }

    if(_cachedSaidIn && _clockState === 'out'){
      const _warnKey = 'clock_lostwarn_'+me;
      let _alreadyWarned = false;
      try{ _alreadyWarned = localStorage.getItem(_warnKey) === '1'; }catch(_){}
      if(!_alreadyWarned){
        try{ localStorage.setItem(_warnKey, '1'); }catch(_){}
        setTimeout(function(){
          try{ showToast('Your last clock-in didn\u2019t save. If you\u2019re on shift, please tap Clock In again.','warning'); }catch(_){}
        }, 1200);
      }
    } else {
      try{ localStorage.removeItem('clock_lostwarn_'+me); }catch(_){}
    }

    try{
      localStorage.setItem('clock_state_'+me, JSON.stringify({
        state: _clockState,
        ts: _clockSinceTs ? _clockSinceTs.toISOString() : null
      }));
    }catch(e){}
    renderClockCard();
    await maybeAutoClockOut8pm();
    try{ checkAutoClockoutNotice(); }catch(e){}
    window._clockSyncing = false;
    try{ const _cb=document.getElementById('clockBtn'); if(_cb) _cb.classList.remove('cc-syncing'); }catch(e){}
  }catch(e){
    console.warn('loadClock:',e);
    if(_clockState === null){ _clockState='out'; renderClockCard(); }
    window._clockSyncing = false;
    try{ const _cb=document.getElementById('clockBtn'); if(_cb) _cb.classList.remove('cc-syncing'); }catch(e){}
  }
}

let _auto8Fired = false;
function eightPmOf(d){
  const e = new Date(d);
  e.setHours(20,0,0,0);
  return e;
}
function maybeAutoClockOut8pm(){
  if(_auto8Fired) return;
  if(_clockState !== 'in' || !_clockSinceTs) return;
  const inDate = new Date(_clockSinceTs);
  const eight = eightPmOf(inDate);
  if(inDate >= eight) return;
  if(Date.now() < eight.getTime()) return;
  _auto8Fired = true;
  return _verifyThenAutoOut8pm(eight, inDate);
}
async function _verifyThenAutoOut8pm(eight, inDate){
  try{
    const since = new Date(inDate.getTime() - 60000).toISOString();
    const rows = await sbGet('clock_log','?staff_name=eq.'+encodeURIComponent(me)+'&ts=gte.'+encodeURIComponent(since)+'&order=ts.desc&limit=1');
    if(rows && rows.length && rows[0].action === 'out'){
      _clockState = 'out';
      _clockSinceTs = new Date(rows[0].ts);
      try{ localStorage.setItem('clock_state_'+me, JSON.stringify({state:'out', ts:new Date(rows[0].ts).toISOString()})); }catch(e){}
      try{ renderClockCard(); }catch(e){}
      const btn = document.getElementById('clockBtn');
      if(btn){ btn.textContent='Clock In'; btn.style.background='var(--accent)'; btn.disabled=false; }
      return;
    }
  }catch(e){
    _auto8Fired = false;
    return;
  }
  return doAutoClockOut8pm(eight);
}

async function doAutoClockOut8pm(outDate){
  try{
    const ts = outDate.toISOString();
    _clockState = 'out';
    _clockSinceTs = outDate;
    try{ localStorage.setItem('clock_state_'+me, JSON.stringify({state:'out', ts:ts})); }catch(e){}
    renderClockCard();
    const btn = document.getElementById('clockBtn');
    if(btn){ btn.textContent='Clock In'; btn.style.background='var(--accent)'; btn.disabled=false; }
    if(typeof showToast === 'function') showToast('Auto clocked-out at 8:00pm (missed clock-out)', 'info');
    sbPost('clock_log', {staff_name: me, action: 'out', ts: ts, notes: 'auto: 8pm missed clock-out'})
      .then(function(){ if(typeof loadAllClockLogs==='function') loadAllClockLogs(); })
      .catch(function(){
        try{ const q=JSON.parse(localStorage.getItem('clock_supabase_queue')||'[]');
          q.push({payload:{staff_name:me,action:'out',ts:ts,notes:'auto: 8pm missed clock-out'},queuedAt:Date.now()});
          localStorage.setItem('clock_supabase_queue',JSON.stringify(q.slice(-20))); }catch(_){}
      });
    const DEFAULT_SHEET_URL='https://script.google.com/macros/s/AKfycby0Bq97bCZAsmnruXFuJuCqXQE_kOxhYE2KFuJnVzLXtT5CV0Y12k5176dxZbdaYVGE/exec';
    const sheetUrl=window.APPS_SCRIPT_URL || localStorage.getItem('oscars_sheet_url') || DEFAULT_SHEET_URL;
    if(sheetUrl){
      const dd=String(outDate.getDate()).padStart(2,'0'), mm=String(outDate.getMonth()+1).padStart(2,'0'), yyyy=outDate.getFullYear();
      const payload={action:'updatePunch',staff:me,date:dd+'/'+mm+'/'+yyyy,timeOut:'20:00',editor:'auto-8pm'};
      fetch(sheetUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)})
        .catch(function(){ try{ const q=JSON.parse(localStorage.getItem('clock_sync_queue')||'[]');
          q.push({payload:payload,queuedAt:Date.now()}); localStorage.setItem('clock_sync_queue',JSON.stringify(q.slice(-20))); }catch(_){}
        });
    }
    if('Notification' in window && Notification.permission === 'granted'){
      navigator.serviceWorker.getRegistration().then(function(reg){
        if(reg) reg.showNotification('Clocked out at 8:00pm', {
          body:'You forgot to clock out — recorded as 8:00pm. Tap to review.',
          icon:'./icon-192.png', badge:'./icon-192.png', tag:'auto-8pm', data:{url:'./#home'}
        });
      }).catch(function(){});
    }
  }catch(e){ console.warn('8pm auto-out failed:',e); _auto8Fired=false; }
}

async function checkAutoClockoutNotice(){
  if(!me) return;
  try{
    const since = new Date(Date.now() - 48*3600*1000).toISOString();
    const rows = await sbGet('clock_log','?staff_name=eq.'+encodeURIComponent(me)+'&action=eq.out&notes=like.'+encodeURIComponent('auto: 8pm*')+'&ts=gte.'+encodeURIComponent(since)+'&order=ts.desc&limit=1');
    if(!rows || !rows.length) return;
    const r = rows[0];
    let seen = null; try{ seen = localStorage.getItem('auto_out_seen_'+me); }catch(e){}
    if(seen === r.id || document.getElementById('autoOutNotice')) return;
    const d = new Date(r.ts).toLocaleDateString('en-AU',{timeZone:'Australia/Sydney',weekday:'long',day:'numeric',month:'long'});
    const el = document.createElement('div');
    el.id = 'autoOutNotice';
    el.style.cssText = 'position:fixed;left:12px;right:12px;top:12px;z-index:99999;background:#fef3c7;color:#78350f;border:1px solid #fde68a;border-radius:14px;padding:14px 16px;box-shadow:0 8px 30px rgba(0,0,0,.18);font-size:14px;line-height:1.45;max-width:520px;margin:0 auto;';
    el.innerHTML = '<b>You were clocked out automatically</b><div style="margin-top:4px;">On '+d+' you forgot to clock out, so the system recorded <b>8:00pm</b>. If your real finish time was earlier, ask your manager to correct it.</div>'+
      '<button type="button" style="margin-top:10px;padding:8px 14px;border:0;border-radius:10px;background:#78350f;color:#fff;font-weight:700;font-family:inherit;cursor:pointer;">Got it</button>';
    el.querySelector('button').onclick = function(){
      try{ localStorage.setItem('auto_out_seen_'+me, r.id); }catch(e){}
      el.remove();
    };
    document.body.appendChild(el);
  }catch(e){ /* informational only */ }
}

setInterval(function(){ try{ maybeAutoClockOut8pm(); }catch(e){} }, 60000);


const NEPALI_BS_MONTHS = {
  2000:[30,32,31,32,31,30,30,30,29,30,29,31],
  2001:[31,31,32,31,31,31,30,29,30,29,30,30],
  2002:[31,31,32,32,31,30,30,29,30,29,30,30],
  2003:[31,32,31,32,31,30,30,30,29,29,30,31],
  2004:[30,32,31,32,31,30,30,30,29,30,29,31],
  2005:[31,31,32,31,31,31,30,29,30,29,30,30],
  2006:[31,31,32,32,31,30,30,29,30,29,30,30],
  2007:[31,32,31,32,31,30,30,30,29,29,30,31],
  2008:[31,31,31,32,31,31,29,30,30,29,29,31],
  2009:[31,31,32,31,31,31,30,29,30,29,30,30],
  2010:[31,31,32,32,31,30,30,29,30,29,30,30],
  2011:[31,32,31,32,31,30,30,30,29,29,30,31],
  2012:[31,31,31,32,31,31,29,30,30,29,30,30],
  2013:[31,31,32,31,31,31,30,29,30,29,30,30],
  2014:[31,31,32,32,31,30,30,29,30,29,30,30],
  2015:[31,32,31,32,31,30,30,30,29,29,30,31],
  2016:[31,31,31,32,31,31,29,30,30,29,30,30],
  2017:[31,31,32,31,31,31,30,29,30,29,30,30],
  2018:[31,32,31,32,31,30,30,29,30,29,30,30],
  2019:[31,32,31,32,31,30,30,30,29,30,29,31],
  2020:[31,31,31,32,31,31,30,29,30,29,30,30],
  2021:[31,31,32,31,31,31,30,29,30,29,30,30],
  2022:[31,32,31,32,31,30,30,30,29,29,30,30],
  2023:[31,32,31,32,31,30,30,30,29,30,29,31],
  2024:[31,31,31,32,31,31,30,29,30,29,30,30],
  2025:[31,31,32,31,31,31,30,29,30,29,30,30],
  2026:[31,32,31,32,31,30,30,30,29,29,30,31],
  2027:[30,32,31,32,31,30,30,30,29,30,29,31],
  2028:[31,31,32,31,31,31,30,29,30,29,30,30],
  2029:[31,31,32,31,32,30,30,29,30,29,30,30],
  2030:[31,32,31,32,31,30,30,30,29,29,30,31],
  2031:[30,32,31,32,31,30,30,30,29,30,29,31],
  2032:[31,31,32,31,31,31,30,29,30,29,30,30],
  2033:[31,31,32,32,31,30,30,29,30,29,30,30],
  2034:[31,32,31,32,31,30,30,30,29,29,30,31],
  2035:[30,32,31,32,31,31,29,30,30,29,29,31],
  2036:[31,31,32,31,31,31,30,29,30,29,30,30],
  2037:[31,31,32,32,31,30,30,29,30,29,30,30],
  2038:[31,32,31,32,31,30,30,30,29,29,30,31],
  2039:[31,31,31,32,31,31,29,30,30,29,30,30],
  2040:[31,31,32,31,31,31,30,29,30,29,30,30],
  2041:[31,31,32,32,31,30,30,29,30,29,30,30],
  2042:[31,32,31,32,31,30,30,30,29,29,30,31],
  2043:[31,31,31,32,31,31,29,30,30,29,30,30],
  2044:[31,31,32,31,31,31,30,29,30,29,30,30],
  2045:[31,32,31,32,31,30,30,29,30,29,30,30],
  2046:[31,32,31,32,31,30,30,30,29,29,30,31],
  2047:[31,31,31,32,31,31,30,29,30,29,30,30],
  2048:[31,31,32,31,31,31,30,29,30,29,30,30],
  2049:[31,32,31,32,31,30,30,30,29,29,30,30],
  2050:[31,32,31,32,31,30,30,30,29,30,29,31],
  2051:[31,31,31,32,31,31,30,29,30,29,30,30],
  2052:[31,31,32,31,31,31,30,29,30,29,30,30],
  2053:[31,32,31,32,31,30,30,30,29,29,30,30],
  2054:[31,32,31,32,31,30,30,30,29,30,29,31],
  2055:[31,31,32,31,31,31,30,29,30,29,30,30],
  2056:[31,31,32,31,32,30,30,29,30,29,30,30],
  2057:[31,32,31,32,31,30,30,30,29,29,30,31],
  2058:[30,32,31,32,31,30,30,30,29,30,29,31],
  2059:[31,31,32,31,31,31,30,29,30,29,30,30],
  2060:[31,31,32,32,31,30,30,29,30,29,30,30],
  2061:[31,32,31,32,31,30,30,30,29,29,30,31],
  2062:[30,32,31,32,31,31,29,30,29,30,29,31],
  2063:[31,31,32,31,31,31,30,29,30,29,30,30],
  2064:[31,31,32,32,31,30,30,29,30,29,30,30],
  2065:[31,32,31,32,31,30,30,30,29,29,30,31],
  2066:[31,31,31,32,31,31,29,30,30,29,29,31],
  2067:[31,31,32,31,31,31,30,29,30,29,30,30],
  2068:[31,31,32,32,31,30,30,29,30,29,30,30],
  2069:[31,32,31,32,31,30,30,30,29,29,30,31],
  2070:[31,31,31,32,31,31,29,30,30,29,30,30],
  2071:[31,31,32,31,31,31,30,29,30,29,30,30],
  2072:[31,32,31,32,31,30,30,29,30,29,30,30],
  2073:[31,32,31,32,31,30,30,30,29,29,30,31],
  2074:[31,31,31,32,31,31,30,29,30,29,30,30],
  2075:[31,31,32,31,31,31,30,29,30,29,30,30],
  2076:[31,32,31,32,31,30,30,30,29,29,30,30],
  2077:[31,32,31,32,31,30,30,30,29,30,29,31],
  2078:[31,31,31,32,31,31,30,29,30,29,30,30],
  2079:[31,31,32,31,31,31,30,29,30,29,30,30],
  2080:[31,32,31,32,31,30,30,30,29,29,30,30],
  2081:[31,32,31,32,31,30,30,30,29,30,29,31],
  2082:[31,31,32,31,31,31,30,29,30,29,30,30],
  2083:[31,31,32,31,31,31,30,29,30,29,30,30],
  2084:[31,31,32,31,31,30,30,30,29,30,30,30],
  2085:[31,32,31,32,30,31,30,30,29,30,30,30],
  2086:[30,32,31,32,31,30,30,30,29,30,30,30],
  2087:[31,31,32,31,31,31,30,30,29,30,30,30],
  2088:[30,31,32,32,30,31,30,30,29,30,30,30],
  2089:[30,32,31,32,31,30,30,30,29,30,30,30],
  2090:[30,32,31,32,31,30,30,30,29,30,30,30]
};
const NEPALI_BS_MONTH_NAMES = ['Baisakh','Jestha','Ashadh','Shrawan','Bhadra','Ashwin','Kartik','Mangsir','Poush','Magh','Falgun','Chaitra'];
const NEPALI_BS_MONTH_NEP = ['बैशाख','जेठ','असार','साउन','भदौ','असोज','कार्तिक','मंसिर','पुष','माघ','फागुन','चैत'];
const NEPALI_DIGITS = ['०','१','२','३','४','५','६','७','८','९'];

const _BS_ANCHOR_AD = new Date(2017, 2, 28);
const _BS_ANCHOR_YEAR = 2073;
const _BS_ANCHOR_MONTH = 11;
const _BS_ANCHOR_DAY = 15;

function adToBs(adDate){
  if(!(adDate instanceof Date) || isNaN(adDate.getTime())) return null;
  const ad = new Date(adDate.getFullYear(), adDate.getMonth(), adDate.getDate());
  const diffDays = Math.round((ad - _BS_ANCHOR_AD) / (1000*60*60*24));
  let bsYear = _BS_ANCHOR_YEAR;
  let bsMonth = _BS_ANCHOR_MONTH;
  let bsDay = _BS_ANCHOR_DAY;
  
  if(diffDays >= 0){
    let remaining = diffDays;
    while(remaining > 0){
      const monthsInYear = NEPALI_BS_MONTHS[bsYear];
      if(!monthsInYear) return null;
      const daysInMonth = monthsInYear[bsMonth];
      const daysLeftInMonth = daysInMonth - bsDay;
      if(remaining <= daysLeftInMonth){
        bsDay += remaining;
        remaining = 0;
      } else {
        remaining -= (daysLeftInMonth + 1);
        bsDay = 1;
        bsMonth++;
        if(bsMonth > 11){ bsMonth = 0; bsYear++; }
      }
    }
  } else {
    let remaining = -diffDays;
    while(remaining > 0){
      if(remaining < bsDay){
        bsDay -= remaining;
        remaining = 0;
      } else {
        remaining -= bsDay;
        bsMonth--;
        if(bsMonth < 0){ bsMonth = 11; bsYear--; }
        const monthsInYear = NEPALI_BS_MONTHS[bsYear];
        if(!monthsInYear) return null;
        bsDay = monthsInYear[bsMonth];
      }
    }
  }
  
  return { year: bsYear, month: bsMonth, day: bsDay };
}

function formatNepaliDate(adDate, opts){
  opts = opts || {};
  const useNep = opts.nepali !== false;
  const bs = adToBs(adDate || new Date());
  if(!bs) return '';
  const monthName = useNep ? NEPALI_BS_MONTH_NEP[bs.month] : NEPALI_BS_MONTH_NAMES[bs.month];
  let dayStr = String(bs.day);
  let yearStr = String(bs.year);
  if(useNep){
    dayStr = dayStr.split('').map(function(d){return NEPALI_DIGITS[parseInt(d,10)]||d;}).join('');
    yearStr = yearStr.split('').map(function(d){return NEPALI_DIGITS[parseInt(d,10)]||d;}).join('');
  }
  if(opts.short){
    return dayStr + ' ' + monthName.slice(0,3);
  }
  return dayStr + ' ' + monthName + ' ' + yearStr;
}


function _refreshNepaliBadge(){
  try{
    const npd = document.getElementById('nepaliDateBadge');
    if(npd) npd.textContent = formatNepaliDate(new Date());
  }catch(e){}
}
setInterval(_refreshNepaliBadge, 60000);
function _scheduleNepaliMidnight(){
  const now = new Date();
  const mid = new Date(now);
  mid.setHours(24, 0, 5, 0);
  setTimeout(function(){
    _refreshNepaliBadge();
    _scheduleNepaliMidnight();
  }, mid.getTime() - now.getTime());
}
_scheduleNepaliMidnight();
document.addEventListener('visibilitychange', function(){
  if(!document.hidden) _refreshNepaliBadge();
});



let _calSystem = 'ad';
let _bsViewYear = null;
let _bsViewMonth = null;














function updateCalendarNepaliLabel(){
  try{
    const npLbl = document.getElementById('bdayNepaliLabel');
    if(!npLbl) return;
    let d = (typeof bdayViewDate !== 'undefined' && bdayViewDate) ? bdayViewDate : new Date();
    const view = (typeof calView !== 'undefined') ? calView : 'month';
    
    function toDev(n){
      if(typeof NEPALI_DIGITS === 'undefined') return String(n);
      return String(n).split('').map(function(c){return NEPALI_DIGITS[parseInt(c,10)]||c;}).join('');
    }
    
    if(view === 'day'){
      const bs = adToBs(d);
      if(!bs){ npLbl.textContent = ''; return; }
      const nepMonth = (typeof NEPALI_BS_MONTH_NEP !== 'undefined') ? NEPALI_BS_MONTH_NEP[bs.month] : NEPALI_BS_MONTH_NAMES[bs.month];
      npLbl.textContent = toDev(bs.day) + ' ' + nepMonth + ' ' + toDev(bs.year);
      return;
    }
    if(view === 'year'){
      const firstDay = new Date(d.getFullYear(), 0, 1);
      const lastDay = new Date(d.getFullYear(), 11, 31);
      const bs1 = adToBs(firstDay);
      const bs2 = adToBs(lastDay);
      if(!bs1 || !bs2){ npLbl.textContent = ''; return; }
      if(bs1.year === bs2.year){ npLbl.textContent = toDev(bs1.year); }
      else { npLbl.textContent = toDev(bs1.year) + '/' + toDev(bs2.year); }
      return;
    }
    let firstDay, lastDay;
    if(view === 'week'){
      const dow = d.getDay();
      firstDay = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
      lastDay = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() + 6);
    } else {
      firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
      lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    }
    const bs1 = adToBs(firstDay);
    const bs2 = adToBs(lastDay);
    if(!bs1 || !bs2){ npLbl.textContent = ''; return; }
    const nepM1 = (typeof NEPALI_BS_MONTH_NEP !== 'undefined') ? NEPALI_BS_MONTH_NEP[bs1.month] : NEPALI_BS_MONTH_NAMES[bs1.month];
    const nepM2 = (typeof NEPALI_BS_MONTH_NEP !== 'undefined') ? NEPALI_BS_MONTH_NEP[bs2.month] : NEPALI_BS_MONTH_NAMES[bs2.month];
    if(bs1.month === bs2.month && bs1.year === bs2.year){
      npLbl.textContent = nepM1 + ' ' + toDev(bs1.year);
    } else {
      npLbl.textContent = nepM1 + '/' + nepM2 + ' ' + toDev(bs2.year);
    }
  }catch(e){ console.warn('nepali label:', e); }
}


const CC_WORLDS = [];

function applyClockCardTheme(){ /* worlds removed — card uses --m-* like every card */ }
function ccBurst(){ /* celebratory burst removed */ }



function _fmtClockRounded15(dateObj){
  try{
    const syd = new Date(dateObj.toLocaleString('en-US',{timeZone:'Australia/Sydney'}));
    const rounded = new Date(syd);
    rounded.setSeconds(0,0);
    const m = syd.getMinutes();
    rounded.setMinutes(Math.round(m/15)*15);
    return rounded.toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit'});
  }catch(e){
    return dateObj.toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit',timeZone:'Australia/Sydney'});
  }
}
/* ── Clock sync strip: always-visible state of the last punch (saving / slow / saved on phone / done) ── */
var ccSync = (function(){
  var el=null, mode='', hideT=0, slowT=0;
  function css(){
    if(document.getElementById('ccSyncCss')) return;
    var st=document.createElement('style'); st.id='ccSyncCss';
    st.textContent=
      '.cc-sync{display:flex;align-items:center;gap:10px;margin:10px 0 2px;padding:10px 12px;border-radius:14px;font-size:13px;line-height:1.35;'+
        'background:var(--m-card-2,#f1f5f9);color:var(--m-ink,var(--text,#0f172a));animation:ccSyncIn .18s ease-out both}'+
      '.cc-sync[hidden]{display:none}'+
      '.cc-sync .cs-ic{flex:0 0 auto;width:20px;height:20px;display:grid;place-items:center}'+
      '.cc-sync .cs-tx{flex:1 1 auto;min-width:0}'+
      '.cc-sync .cs-tx b{display:block;font-weight:700}'+
      '.cc-sync .cs-tx span{display:block;opacity:.75;font-size:12px}'+
      '.cc-sync button{flex:0 0 auto;font:inherit;font-weight:700;font-size:13px;padding:8px 14px;border-radius:11px;border:0;cursor:pointer;background:#f59e0b;color:#1f1300;min-height:36px}'+
      '.cc-sync.is-slow{background:color-mix(in srgb,#f59e0b 16%,var(--m-card-2,#f1f5f9))}'+
      '.cc-sync.is-queued{background:color-mix(in srgb,#f59e0b 20%,var(--m-card-2,#f1f5f9));box-shadow:inset 0 0 0 1px color-mix(in srgb,#f59e0b 55%,transparent)}'+
      '.cc-sync.is-done{background:color-mix(in srgb,#10b981 16%,var(--m-card-2,#f1f5f9))}'+
      '.cc-sync .cs-spin{width:16px;height:16px;border-radius:50%;border:2.5px solid color-mix(in srgb,currentColor 25%,transparent);border-top-color:currentColor;animation:ccSyncSpin .8s linear infinite}'+
      '.cc-sync.is-geo{background:color-mix(in srgb,#f59e0b 20%,var(--m-card-2,#f1f5f9));box-shadow:inset 0 0 0 1px color-mix(in srgb,#f59e0b 55%,transparent);align-items:flex-start;flex-wrap:wrap}'+
      '.cc-sync.is-geo .cs-tx{flex:1 1 180px}'+
      '.cc-sync.is-geo button{margin-left:30px}'+
      '.cc-sync.is-pulse{animation:ccSyncPulse .5s ease-out}'+
      '@keyframes ccSyncPulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,#f59e0b 55%,transparent)}100%{box-shadow:0 0 0 10px transparent}}'+
      '@keyframes ccSyncSpin{to{transform:rotate(360deg)}}'+
      '@keyframes ccSyncIn{from{opacity:0}to{opacity:1}}'+
      '@media (prefers-reduced-motion:reduce){.cc-sync .cs-spin{animation-duration:2s}.cc-sync{animation:none}}';
    document.head.appendChild(st);
  }
  function node(){
    if(el && document.body.contains(el)) return el;
    var sub=document.getElementById('clockSubStatus'); if(!sub||!sub.parentNode) return null;
    css();
    el=document.createElement('div'); el.id='ccSyncStrip'; el.className='cc-sync'; el.hidden=true;
    el.setAttribute('role','status'); el.setAttribute('aria-live','polite');
    sub.parentNode.insertBefore(el,sub.nextSibling);
    el.addEventListener('click',function(e){
      if(e.target.closest('[data-cs-geo]')){ try{ toggleClock({resume:true}); }catch(_){} return; }
      if(!e.target.closest('[data-cs-retry]')) return;
      set('saving',_clockPending&&_clockPending.action);
      var p; try{ p=retryClockQueueSafely('banner'); }catch(_){}
      Promise.resolve(p).then(function(){ setTimeout(function(){ try{ renderClockCard(); }catch(_){} if(_clockPending) set('queued'); },400); });
    });
    return el;
  }
  var SPIN='<span class="cs-spin" aria-hidden="true"></span>';
  var TICK='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var WARN='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/></svg>';
  var geoInfo=null, noteText='', noteSpin=false;
  function label(a){ return a==='out'?'clock-out':'clock-in'; }
  function whenTxt(ts){ try{ return flexClockTime(ts).toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit',timeZone:'Australia/Sydney'}); }catch(e){ return ''; } }
  function set(m,action){
    var n=node(); if(!n) return;
    clearTimeout(hideT); clearTimeout(slowT);
    mode=m; if(m==='') { n.hidden=true; return; }
    var a=action|| (_clockPending&&_clockPending.action) || 'out';
    if(m!=='geo') geoInfo=m==='geo'?geoInfo:null;
    n.hidden=false; n.className='cc-sync';
    if(m==='saving'){
      n.innerHTML='<span class="cs-ic">'+SPIN+'</span><div class="cs-tx"><b>Saving your '+label(a)+'…</b></div>';
      slowT=setTimeout(function(){ if(mode==='saving'){ n.className='cc-sync is-slow';
        n.innerHTML='<span class="cs-ic">'+SPIN+'</span><div class="cs-tx"><b>Taking longer than usual</b><span>Still trying. Your time is safe, keep this open.</span></div>'; } },4000);
    } else if(m==='locating'){
      n.innerHTML='<span class="cs-ic">'+SPIN+'</span><div class="cs-tx"><b>Finding your location…</b><span>Needed to '+label(a).replace('-',' ')+'. This can take a few seconds.</span></div>';
      slowT=setTimeout(function(){ if(mode==='locating'){ n.className='cc-sync is-slow';
        n.innerHTML='<span class="cs-ic">'+SPIN+'</span><div class="cs-tx"><b>Still looking for a signal</b><span>Standing near a window or outside helps. Waiting up to 30 seconds.</span></div>'; } },6000);
    } else if(m==='geo'){
      var g=geoInfo||{}; n.className='cc-sync is-geo';
      n.innerHTML='<span class="cs-ic">'+WARN+'</span><div class="cs-tx"><b>'+g.title+'</b><span>'+g.body+'</span></div><button type="button" data-cs-geo>'+(g.btn||'Try again')+'</button>';
    } else if(m==='note'){
      n.className='cc-sync';
      n.innerHTML='<span class="cs-ic">'+(noteSpin?SPIN:WARN)+'</span><div class="cs-tx"><b>'+noteText+'</b></div>';
      hideT=setTimeout(function(){ if(mode==='note') set(''); },3200);
    } else if(m==='queued'){
      var w=_clockPending?whenTxt(_clockPending.ts):'';
      n.className='cc-sync is-queued';
      n.innerHTML='<span class="cs-ic">'+WARN+'</span><div class="cs-tx"><b>'+(a==='out'?'Clock-out':'Clock-in')+' not saved yet</b><span>Kept on your phone'+(w?' as '+w:'')+'. It will finish by itself when you’re online.</span></div><button type="button" data-cs-retry>Retry</button>';
    } else if(m==='done'){
      n.className='cc-sync is-done';
      n.innerHTML='<span class="cs-ic">'+TICK+'</span><div class="cs-tx"><b>'+(a==='out'?'Clock-out':'Clock-in')+' saved</b></div>';
      hideT=setTimeout(function(){ if(mode==='done') set(''); },2600);
    }
  }
  /* classify a location failure into something a person can act on */
  function geo(a,err,extra){
    var code=err&&err.code, msg=String((err&&err.message)||''), act=(a==='out'?'clock out':'clock in');
    if(extra&&extra.far){
      geoInfo={title:'You\u2019re '+extra.far+' from the office',body:'You need to be within '+extra.radius+'m to '+act+'. Walk closer and check again.'+(a==='out'?' If you have already left, you will be clocked out automatically at 8:00pm.':''),btn:'Check again'};
    } else if(code===1){
      geoInfo={title:'Location is blocked',body:'Nexus can\u2019t see where you are. Tap the lock icon next to the address bar, set Location to Allow, then check again.',btn:'Check again'};
    } else {
      geoInfo={title:'Couldn\u2019t get your location',body:'Make sure Location is turned on and move near a window or outside, then try again.'+(a==='out'?' If it keeps failing you will be clocked out automatically at 8:00pm.':''),btn:'Try again'};
    }
    set('geo',a);
  }
  /* a tap that would otherwise do nothing: say why. If a state strip is already up, just draw the eye to it. */
  function note(text,spin){
    var n=node(); if(!n) return;
    if(mode==='saving'||mode==='queued'||mode==='geo'||mode==='locating'){
      n.classList.remove('is-pulse'); void n.offsetWidth; n.classList.add('is-pulse'); return;
    }
    noteText=text; noteSpin=!!spin; set('note');
  }
  return { set:set, geo:geo, note:note, mode:function(){ return mode; } };
})();

function renderClockCard(){
  try{ applyClockCardTheme(); }catch(e){}
  try{
    const npd = document.getElementById('nepaliDateBadge');
    if(npd) npd.textContent = formatNepaliDate(new Date());
  }catch(e){}
  const status = document.getElementById('clockStatus');
  const sub = document.getElementById('clockSubStatus');
  const btn = document.getElementById('clockBtn');
  const now = document.getElementById('clockNow');
  if(!status || !btn) return;

  if(_clockPending){
    const _pAct = _clockPending.action === 'out' ? 'Clock-out' : 'Clock-in';
    status.textContent = _pAct + ' not synced yet';
    try{ if(ccSync.mode()!=='saving') ccSync.set('queued'); }catch(_){}
    status.style.color = '#f59e0b';
    btn.textContent = (_clockPending.action === 'in') ? 'Clock Out' : 'Clock In';
    btn.style.background = (_clockPending.action === 'in') ? '#dc2626' : 'var(--accent)';
    if(sub){
      var _pWhen = '';
      try{ _pWhen = flexClockTime(_clockPending.ts).toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit',timeZone:'Australia/Sydney'}); }catch(e){}
      sub.textContent = 'Saved on your phone' + (_pWhen ? ' at '+_pWhen : '') +
        ' — will finish when you\u2019re back online. Tap to retry now.';
    }
    if(now){
      function _tickP(){ now.textContent = new Date().toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Australia/Sydney'}); }
      _tickP();
      if(_clockTickTimer) clearInterval(_clockTickTimer);
      _clockTickTimer = setInterval(_tickP, 1000);
    }
    return;
  }

  try{ if(ccSync.mode()==='queued') ccSync.set('done'); }catch(_){}
  if(_clockState === 'in'){
    status.textContent = 'Clocked in';
    status.style.color = '#10b981';
    btn.textContent = 'Clock Out';
    btn.style.background = '#dc2626';
    if(_clockSinceTs){
      var _shownIn = flexClockTime(_clockSinceTs);
      sub.textContent = 'Since '+_fmtClockRounded15(_shownIn)+' · '+_shownIn.toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short',timeZone:'Australia/Sydney'});
    }
  } else {
    status.textContent = 'Not clocked in';
    status.style.color = '#94a3b8';
    btn.textContent = 'Clock In';
    btn.style.background = 'var(--accent)';
    if(_clockSinceTs){
      var _shownOut = flexClockTime(_clockSinceTs);
      sub.textContent = 'Last clock-out: '+_fmtClockRounded15(_shownOut)+' · '+_shownOut.toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short',timeZone:'Australia/Sydney'});
    } else {
      sub.textContent = 'You haven\'t clocked in yet today.';
    }
  }
  if(now){
    function tick(){
      const t = new Date();
      now.textContent = t.toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Australia/Sydney'});
    }
    tick();
    if(_clockTickTimer) clearInterval(_clockTickTimer);
    _clockTickTimer = setInterval(tick, 1000);
  }
}

const OFFICE_LAT = -33.95245;
const OFFICE_LNG = 151.13856;
const OFFICES = [
  { name: 'Sydney', lat: -33.95245, lng: 151.13856, radiusM: 30 }
];
const OFFICE_RADIUS_DEFAULT = 30;
const CLOCKOUT_RADIUS_M = 100;
const GEOFENCE_DISABLED = false;
let _globalGeofenceM = null;

async function loadGlobalGeofence(){
  try{
    const rows = await sbGet('app_settings','?key=eq.geofence_radius_m&select=value');
    if(rows && rows.length){
      const v = parseInt(rows[0].value, 10);
      if(v && v >= 5 && v <= 5000){
        _globalGeofenceM = v;
        return v;
      }
    }
  }catch(e){}
  return null;
}



function distanceMeters(lat1, lng1, lat2, lng2){
  const R = 6371000;
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLng = (lng2-lng1) * Math.PI/180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) *
            Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function nearestOffice(lat, lng){
  let best = null;
  for(const o of OFFICES){
    const d = distanceMeters(lat, lng, o.lat, o.lng);
    if(!best || d < best.dist){ best = { office:o, dist:d }; }
  }
  return best;
}

let _bgPosition = null;
let _bgWatchId = null;

function startBackgroundLocation(){
  if(!navigator.geolocation) return;
  if(_bgWatchId !== null) return;
  if(!me) return;
  _bgWatchId = navigator.geolocation.watchPosition(
    function(pos){
      const hadPrior = !!_bgPosition;
      const wasInside = hadPrior && checkInsideGeofence(_bgPosition.coords);
      if(pos.coords.accuracy <= 50){
        _bgPosition = { coords: pos.coords, ts: Date.now() };
      } else if(!_bgPosition || (Date.now() - _bgPosition.ts) > 60000){
        _bgPosition = { coords: pos.coords, ts: Date.now() };
      }
      const nowInside = checkInsideGeofence(_bgPosition.coords);
      if(hadPrior && !wasInside && nowInside && _clockState === 'out'){
        maybeShowClockInPrompt();
      }
    },
    function(err){ console.warn('[gps bg]', err.message); },
    { enableHighAccuracy:true, timeout:20000, maximumAge:30000 }
  );
}

function checkInsideGeofence(coords){
  if(!coords) return false;
  const near = nearestOffice(coords.latitude, coords.longitude);
  if(!near) return false;
  const acc = coords.accuracy || 0;
  return Math.max(0, near.dist - acc) <= near.office.radiusM;
}

function maybeShowClockInPrompt(){
  if(_clockState !== 'out') return;
  const lastKey = 'gf_clockin_prompt_'+me;
  const last = parseInt(sessionStorage.getItem(lastKey)||'0', 10);
  if(Date.now() - last < 30*60*1000) return;
  sessionStorage.setItem(lastKey, String(Date.now()));
  if('Notification' in window && Notification.permission === 'granted'){
    navigator.serviceWorker.getRegistration().then(function(reg){
      if(reg){
        reg.showNotification('You\'re at the office', {
          body: 'Tap to clock in now',
          icon: './icon-192.png',
          badge: './icon-192.png',
          tag: 'clockin-prompt',
          data: { url: './#home' },
          vibrate: [200, 100, 200],
          actions: [
            { action: 'clockin', title: 'Clock in' }
          ]
        });
      }
    });
  }
  if(typeof showToast === 'function'){
    showToast('You\'re inside the office. Tap Clock In to start your shift.', 'info');
  }
  const btn = document.getElementById('clockBtn');
  if(btn){
    btn.style.animation = 'pulse 2s ease-in-out 3';
    setTimeout(function(){ if(btn) btn.style.animation = ''; }, 6500);
  }
}




const _origToggleClock = (typeof toggleClock === 'function') ? toggleClock : null;



function getCurrentPosition(){
  return new Promise(function(resolve, reject){
    if(!navigator.geolocation){ reject(new Error('GPS not available')); return; }
    
    if(_bgPosition && _bgPosition.coords.accuracy <= 30 && (Date.now() - _bgPosition.ts) < 8000){
      console.log('[gps] using cached bg position, accuracy:', _bgPosition.coords.accuracy+'m');
      resolve({ coords: _bgPosition.coords });
      return;
    }
    
    const readings = [];
    let attempts = 0;
    const maxAttempts = 3;
    let timer = null;
    
    function tryRead(){
      attempts++;
      navigator.geolocation.getCurrentPosition(
        function(pos){
          readings.push(pos);
          console.log('[gps] attempt', attempts, 'accuracy:', pos.coords.accuracy+'m');
          
          if(pos.coords.accuracy <= 15){
            if(timer) clearTimeout(timer);
            resolve(pos);
            return;
          }
          
          if(attempts >= maxAttempts){
            if(timer) clearTimeout(timer);
            readings.sort(function(a,b){ return a.coords.accuracy - b.coords.accuracy; });
            resolve(readings[0]);
            return;
          }
          
          setTimeout(tryRead, 800);
        },
        function(err){
          console.warn('[gps] attempt', attempts, 'failed:', err.message);
          if(attempts >= maxAttempts){
            if(readings.length > 0){
              readings.sort(function(a,b){ return a.coords.accuracy - b.coords.accuracy; });
              resolve(readings[0]);
            } else {
              reject(err);
            }
          } else {
            setTimeout(tryRead, 800);
          }
        },
        { enableHighAccuracy:true, timeout:18000, maximumAge:30000 }
      );
    }
    
    timer = setTimeout(function(){
      if(readings.length > 0){
        readings.sort(function(a,b){ return a.coords.accuracy - b.coords.accuracy; });
        resolve(readings[0]);
        return;
      }
      console.log('[gps] falling back to low-accuracy network location...');
      navigator.geolocation.getCurrentPosition(
        function(pos){
          console.log('[gps] network fallback succeeded, accuracy:', pos.coords.accuracy+'m');
          resolve(pos);
        },
        function(err2){
          reject(new Error('GPS timeout — please ensure location services are enabled and accurate'));
        },
        { enableHighAccuracy:false, timeout:8000, maximumAge:300000 }
      );
    }, 28000);
    
    tryRead();
  });
}

function flexClockTime(date){
  const d = new Date(date);
  const min = d.getMinutes();
  let newMin;
  if(min <= 7) newMin = 0;
  else if(min <= 22) newMin = 15;
  else if(min <= 37) newMin = 30;
  else if(min <= 52) newMin = 45;
  else { newMin = 0; d.setHours(d.getHours()+1); }
  d.setMinutes(newMin);
  d.setSeconds(0);
  d.setMilliseconds(0);
  return d;
}

function clockOutConfirm(){
  return new Promise(function(resolve){
    let ov = document.getElementById('clockOutConfirmOverlay');
    if(!ov){
      ov = document.createElement('div');
      ov.id = 'clockOutConfirmOverlay';
      ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(8,16,26,.72);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:24px;animation:coFade .15s ease;';
      document.body.appendChild(ov);
    }
    ov.style.display = 'flex';
    ov.innerHTML =
      '<div style="max-width:330px;width:100%;background:var(--card);border:1px solid var(--border-hi);border-radius:16px;padding:26px 24px;box-shadow:0 20px 60px rgba(0,0,0,.5);text-align:center;">'+
        
        '<div style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:7px;letter-spacing:-0.2px;">Clock out now?</div>'+
        '<div style="font-size:13px;color:var(--text2);margin-bottom:22px;line-height:1.5;">This records your finish time for today.</div>'+
        '<div style="display:flex;gap:10px;">'+
          '<button id="coCancel" style="flex:1;padding:12px;border:1px solid var(--border-hi);border-radius:12px;background:transparent;color:var(--text2);font-weight:600;font-size:14px;cursor:pointer;font-family:inherit;">Cancel</button>'+
          '<button id="coYes" style="flex:1;padding:12px;border:none;border-radius:12px;background:var(--warn);color:#fff;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit;">Clock Out</button>'+
        '</div>'+
      '</div>';
    const close = function(val){ ov.style.display='none'; resolve(val); };
    document.getElementById('coCancel').onclick = function(){ close(false); };
    document.getElementById('coYes').onclick = function(){ close(true); };
    ov.onclick = function(e){ if(e.target===ov) close(false); };
  });
}

function openShiftBlockedDialog(sinceTs){
  return new Promise(function(resolve){
    let since = '';
    try{
      const d = new Date(sinceTs);
      since = d.toLocaleDateString([], {weekday:'short', day:'numeric', month:'short'}) +
              ' at ' + d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    }catch(e){}
    let ov = document.getElementById('openShiftOverlay');
    if(!ov){
      ov = document.createElement('div');
      ov.id = 'openShiftOverlay';
      ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(8,16,26,.72);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:24px;';
      document.body.appendChild(ov);
    }
    ov.style.display = 'flex';
    ov.innerHTML =
      '<div style="max-width:340px;width:100%;background:var(--card);border:1px solid var(--border-hi);border-radius:16px;padding:26px 24px;box-shadow:0 20px 60px rgba(0,0,0,.5);text-align:center;">'+
        
        '<div style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:7px;letter-spacing:-0.2px;">You\'re still clocked in</div>'+
        '<div style="font-size:13px;color:var(--text2);margin-bottom:22px;line-height:1.55;">You have an open shift'+(since?(' from <b style="color:var(--text)">'+since+'</b>'):'')+' that was never clocked out. Please clock OUT first to close it before starting a new shift.</div>'+
        '<button id="osOk" style="width:100%;padding:12px;border:none;border-radius:12px;background:var(--accent);color:#fff;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit;">Got it</button>'+
      '</div>';
    const close = function(){ ov.style.display='none'; resolve(); };
    document.getElementById('osOk').onclick = close;
    ov.onclick = function(e){ if(e.target===ov) close(); };
  });
}

function _ccNudge(btn){
  if(!btn) return;
  btn.classList.remove('cc-btn--nudge');
  void btn.offsetWidth;
  btn.classList.add('cc-btn--nudge');
  setTimeout(function(){ btn.classList.remove('cc-btn--nudge'); }, 340);
}

async function toggleClock(opts){
  const btn = document.getElementById('clockBtn');
  if(!btn) return;
  const _ctx = window._ccGeoCtx || null;
  const _nextAction = (_clockState === 'in') ? 'out' : 'in';
  const resume = !!(opts && opts.resume === true && _ctx && _ctx.action === _nextAction && (Date.now() - _ctx.at) < 10*60*1000);
  window._ccGeoCtx = null;
  if(window._clockSyncing){
    _ccNudge(btn);
    try{ ccSync.note('Checking your clock status, one moment…', true); }catch(_){}
    return;
  }
  const _now = Date.now();
  if(!resume && window._lastClockAnyToggle && (_now - window._lastClockAnyToggle) < 8000){
    console.warn('[clock] hard lockout — punch ignored (', _now - window._lastClockAnyToggle, 'ms since last)');
    _ccNudge(btn);
    try{
      var _la = window._lastClockAction === 'out' ? 'clock-out' : 'clock-in';
      ccSync.note('Your '+_la+' is already being sent, no need to tap again.', true);
    }catch(_){}
    return;
  }
  if(!resume && window._lastClockToggle && window._lastClockAction === _nextAction
     && (_now - window._lastClockToggle) < 4000){
    console.warn('[clock] ignored rapid duplicate', _nextAction, '(', _now - window._lastClockToggle, 'ms)');
    return;
  }
  window._lastClockAnyToggle = _now;
  window._lastClockToggle = _now;
  window._lastClockAction = _nextAction;
  if(_clockPending){
    _ccNudge(btn);
    try{ ccSync.set('queued'); }catch(_){}
    showToast('Still syncing your last punch — retrying now…','info');
    try{ if(typeof retryClockQueueSafely === 'function') retryClockQueueSafely('manual-retap'); }catch(_){}
    return;
  }
  const next = (_clockState === 'in') ? 'out' : 'in';
  if(next === 'in' && !resume){
    try{
      const last = await sbGet('clock_log','?staff_name=eq.'+encodeURIComponent(me)+'&order=ts.desc&limit=1');
      if(last && last.length && last[0].action === 'in'){
        _clockState = 'in';
        renderClockCard();
        await openShiftBlockedDialog(last[0].ts);
        return;
      }
    }catch(e){ /* if the check fails, fall through (don't hard-block on a network blip) */ }
  }
  let _earlyNotice = null;
  let _breakNote = null;
  if(resume){ _earlyNotice = _ctx.early || null; _breakNote = _ctx.breakNote || null; }
  if(next === 'in' && !resume && typeof nxEarlyClockCheck === 'function'){
    try{ _earlyNotice = await nxEarlyClockCheck(); }catch(e){ _earlyNotice = null; }
    if(_earlyNotice === false){ window._lastClockToggle = 0; window._lastClockAnyToggle = 0; window._lastClockAnyToggle = 0; return; }
  }
  if(next === 'out' && !resume){
    try{
      const last = await sbGet('clock_log','?staff_name=eq.'+encodeURIComponent(me)+'&order=ts.desc&limit=1');
      if(last && last.length && last[0].action === 'out'){
        _clockState = 'out';
        try{ localStorage.setItem('clock_state_'+me, JSON.stringify({state:'out', ts:last[0].ts})); }catch(e){}
        renderClockCard();
        showToast("You're already clocked out");
        window._lastClockToggle = 0; window._lastClockAnyToggle = 0;
        return;
      }
      if(last && (!last.length)){
        _clockState = 'out';
        renderClockCard();
        showToast("You're not clocked in");
        window._lastClockToggle = 0; window._lastClockAnyToggle = 0;
        return;
      }
    }catch(e){ /* network blip — fall through, don't hard-block a genuine clock-out */ }

    let ok;
    let _short = null;
    try{ _short = (typeof nxShortShiftInfo === 'function') ? await nxShortShiftInfo() : null; }catch(e){ _short = null; }
    if(_short && typeof nxBreakQuestion === 'function'){
      const _ans = await nxBreakQuestion(_short);
      ok = !!_ans;
      if(_ans) _breakNote = 'break-check: ' + _ans + ' (' + _short.label + ' worked)';
    } else {
      ok = await clockOutConfirm();
    }
    if(!ok){
      window._lastClockToggle = 0; window._lastClockAnyToggle = 0;
      return;
    }
  }
  btn.disabled = true;
  btn.classList.add('cc-btn--working');
  const prevText = btn.textContent;
  btn.textContent = _bgPosition ? 'Verifying...' : 'Locating GPS...';
  try{ ccSync.set('locating', next); }catch(_){}
  const _geoCtx = { action: next, breakNote: _breakNote, early: _earlyNotice, at: Date.now() };
  const _geoFail = function(err, extra){
    btn.disabled = false; btn.classList.remove('cc-btn--working'); btn.textContent = prevText;
    window._lastClockToggle = 0; window._lastClockAnyToggle = 0;
    window._ccGeoCtx = _geoCtx;
    try{ ccSync.geo(next, err, extra); }catch(_){ showToast('Location needed: turn on Location and try again','warning'); }
  };

  let lat = null, lng = null;
  if(next === 'out'){
    if(GEOFENCE_DISABLED){
      try{ const pos = await getCurrentPosition(); lat = pos.coords.latitude; lng = pos.coords.longitude; }catch(e){}
    } else {
      try{
        const pos = await getCurrentPosition();
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        const near = nearestOffice(lat, lng);
        const effectiveDist = Math.max(0, near.dist - (pos.coords.accuracy || 0));
        if(effectiveDist > CLOCKOUT_RADIUS_M){
          const distFmt = near.dist > 1000 ? (near.dist/1000).toFixed(1)+'km' : Math.round(near.dist)+'m';
          _geoFail(null, {far:distFmt, radius:CLOCKOUT_RADIUS_M});
          return;
        }
      }catch(e){
        console.warn('GPS error (clock-out):', e);
        _geoFail(e);
        return;
      }
    }
  } else if(GEOFENCE_DISABLED){
    try{
      const pos = await getCurrentPosition();
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    }catch(e){ /* ignore */ }
  } else {
    try{
      const pos = await getCurrentPosition();
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
      const near = nearestOffice(lat, lng);
      const dist = near.dist;
      const acc = pos.coords.accuracy;
      const effectiveDist = Math.max(0, dist - acc);
      if(effectiveDist > near.office.radiusM){
        const distFmt = dist > 1000 ? (dist/1000).toFixed(1)+'km' : Math.round(dist)+'m';
        const accFmt = Math.round(acc)+'m';
        _geoFail(null, {far:distFmt, radius:near.office.radiusM});
        return;
      }
    }catch(e){
      console.warn('GPS error:', e);
      _geoFail(e);
      return;
    }
  }

  btn.textContent = '...';
  try{
    const realDate = new Date();
    const realTs = realDate.toISOString();
    const flexedDate = flexClockTime(realDate);
    
    _clockState = next;
    _clockSinceTs = flexedDate;
    if(next === 'in'){ window._autoClockOutFired = false; _auto8Fired = false; }
    
    try{
      localStorage.setItem('clock_state_'+me, JSON.stringify({
        state: next,
        ts: _clockSinceTs.toISOString()
      }));
    }catch(e){}
    
    btn.textContent = (next === 'in') ? 'Clock Out' : 'Clock In';
    btn.style.background = (next === 'in') ? '#dc2626' : 'var(--accent)';
    btn.disabled = false;
    btn.classList.remove('cc-btn--working');
    renderClockCard();
    if(next === 'in'){ try{ ccBurst(); }catch(e){} }
    showToast(next==='in' ? 'Clocking in…' : 'Clocking out…');
    applyGpsLock();

    const _punchRow = { staff_name: me, action: next, ts: realTs };
    if(next === 'out' && _breakNote) _punchRow.notes = _breakNote;
    if(_earlyNotice && next === 'in' && typeof nxEarlyFileNotice === 'function'){
      try{ nxEarlyFileNotice(Object.assign({}, _earlyNotice, { clock_ts: realTs })); }catch(_){}
    }
    try{ ccSync.set('saving', next); }catch(_){}
    var _writeP = Promise.race([
      sbPost('clock_log', _punchRow),
      new Promise(function(_,rej){ setTimeout(function(){ rej(new Error('timed out after 10s')); }, 10000); })
    ]);
    _writeP
      .then(function(res){
        if(res && res.ok === false){ throw new Error('HTTP '+res.status); }
        _clockPending = null;
        showToast(next==='in' ? 'Clocked in ✓' : 'Clocked out ✓','success');
        try{ localStorage.removeItem('clock_pending_'+me); }catch(_){}
        renderClockCard();
        try{ ccSync.set('done', next); }catch(_){}
        if(typeof loadAllClockLogs === 'function') loadAllClockLogs();
      })
      .catch(function(err){
        console.warn('[clock] write failed:', err && err.message);
        _clockPending = { action: next, ts: realTs };
        _clockState = next;
        try{ localStorage.setItem('clock_state_'+me, JSON.stringify({state:_clockState, ts:realTs})); }catch(_){}
        showToast(next==='in'
          ? 'Clock-in saved on your phone — will finish when you\u2019re back online'
          : 'Clock-out saved on your phone — will finish when you\u2019re back online','warning');
        renderClockCard();
        try{ ccSync.set('queued', next); }catch(_){}
        try{
          const q = JSON.parse(localStorage.getItem('clock_supabase_queue') || '[]');
          q.push({payload: Object.assign({}, _punchRow), queuedAt: Date.now()});
          localStorage.setItem('clock_supabase_queue', JSON.stringify(q.slice(-20)));
        }catch(_){}
      });
    
    const DEFAULT_SHEET_URL = 'https://script.google.com/macros/s/AKfycby0Bq97bCZAsmnruXFuJuCqXQE_kOxhYE2KFuJnVzLXtT5CV0Y12k5176dxZbdaYVGE/exec';
    const sheetUrl = localStorage.getItem('oscars_sheet_url') || DEFAULT_SHEET_URL;
    if(sheetUrl){
      const dd = String(flexedDate.getDate()).padStart(2,'0');
      const mm = String(flexedDate.getMonth()+1).padStart(2,'0');
      const yyyy = flexedDate.getFullYear();
      const sheetDateStr = dd+'/'+mm+'/'+yyyy;
      const hh = String(flexedDate.getHours()).padStart(2,'0');
      const mn = String(flexedDate.getMinutes()).padStart(2,'0');
      const timeStr = hh+':'+mn;
      const payload = {
        action: 'updatePunch',
        staff: me,
        date: sheetDateStr,
        editor: me + ' (auto-clock)'
      };
      if(next === 'in') payload.timeIn = timeStr;
      else payload.timeOut = timeStr;
      
      fetch(sheetUrl, {
        method:'POST',
        headers:{'Content-Type':'text/plain;charset=utf-8'},
        body: JSON.stringify(payload)
      }).then(function(r){
        if(!r.ok) throw new Error('HTTP '+r.status);
        return r.text();
      }).then(function(txt){
        console.log('[clock] sheets sync OK:', txt.slice(0,120));
      }).catch(function(e){
        console.warn('[clock] sheets sync attempt 1 failed:', e.message);
        return fetch(sheetUrl, {
          method:'POST',
          mode:'no-cors',
          headers:{'Content-Type':'text/plain;charset=utf-8'},
          body: JSON.stringify(payload)
        }).then(function(){
          console.log('[clock] sheets sync attempt 2 (no-cors) sent');
        }).catch(function(e2){
          console.error('[clock] both sheets sync attempts failed:', e2.message);
          try{
            const queue = JSON.parse(localStorage.getItem('clock_sync_queue') || '[]');
            queue.push({payload: payload, queuedAt: Date.now()});
            localStorage.setItem('clock_sync_queue', JSON.stringify(queue.slice(-20)));
          }catch(_){}
        });
      });
    }
    
  }catch(e){
    showToast('Failed to record');
    window._lastClockToggle = 0; window._lastClockAnyToggle = 0;
    try{ ccSync.set(''); }catch(_){}
    btn.textContent = prevText;
    btn.disabled = false;
    btn.classList.remove('cc-btn--working');
  }
}

