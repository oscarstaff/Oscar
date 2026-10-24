let _hoursPeriod = localStorage.getItem('oscars_hours_period') || 'fortnight';
setTimeout(function(){ const t = document.getElementById('hp-'+_hoursPeriod); if(t){ document.querySelectorAll('.hours-tab').forEach(function(b){b.classList.remove('active');}); t.classList.add('active'); } }, 200);
let _hoursLogs = [];

function setHoursPeriod(p){
  _hoursPeriod = p;
  localStorage.setItem('oscars_hours_period', p);
  document.querySelectorAll('.hours-tab').forEach(function(b){
    b.classList.toggle('active', b.id === 'hp-'+p);
  });
  renderHours();
}

async function loadAllClockLogs(){
  if(!me) return;
  try{
    _hoursLogs = await sbGet('clock_log','?staff_name=eq.'+encodeURIComponent(me)+'&order=ts.asc&limit=2000');
    renderHours();
  }catch(e){console.warn('load logs:',e);}
}

function getPeriodRange(period){
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start, end, label;
  if(period === 'today'){
    start = today;
    end = new Date(today); end.setDate(end.getDate()+1);
    label = today.toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long'});
  } else if(period === 'week'){
    const dow = today.getDay();
    const offset = dow === 0 ? -6 : 1-dow;
    start = new Date(today); start.setDate(today.getDate()+offset);
    end = new Date(start); end.setDate(end.getDate()+7);
    label = 'Week of '+start.toLocaleDateString('en-AU',{day:'numeric',month:'short'});
  } else if(period === 'fortnight'){
    const FORT_ANCHOR = new Date(2026, 4, 4);
    FORT_ANCHOR.setHours(0,0,0,0);
    const MS_DAY = 24*60*60*1000;
    const MS_FORT = 14*MS_DAY;
    const dayDiff = Math.round((today.getTime() - FORT_ANCHOR.getTime()) / MS_DAY);
    const fortIdx = Math.floor(dayDiff / 14);
    start = new Date(FORT_ANCHOR.getFullYear(), FORT_ANCHOR.getMonth(), FORT_ANCHOR.getDate() + fortIdx*14);
    end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 14);
    const startLbl = start.toLocaleDateString('en-AU',{day:'numeric',month:'short'});
    const endLbl = (new Date(end.getFullYear(), end.getMonth(), end.getDate()-1)).toLocaleDateString('en-AU',{day:'numeric',month:'short'});
    label = 'Fortnight: '+startLbl+' - '+endLbl;
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth()+1, 1);
    label = start.toLocaleDateString('en-AU',{month:'long',year:'numeric'});
  }
  return {start, end, label};
}

function calcHoursForRange(start, end){
  const logs = (_hoursLogs||[]).filter(function(r){
    const t = new Date(r.ts);
    return t >= start && t < end;
  });
  logs.sort(function(a,b){ return new Date(a.ts) - new Date(b.ts); });

  let totalMs = 0;
  let openIn = null;
  let sessions = 0;
  const dayMap = {};

  const beforeStart = (_hoursLogs||[]).filter(function(r){return new Date(r.ts) < start;});
  if(beforeStart.length){
    const last = beforeStart[beforeStart.length-1];
    if(last.action === 'in') openIn = new Date(last.ts);
  }

  logs.forEach(function(r){
    const t = new Date(r.ts);
    if(r.action === 'in'){
      openIn = t;
    } else if(r.action === 'out' && openIn){
      const effIn = openIn < start ? start : openIn;
      const span = t - effIn;
      if(span > 0 && span < 24*60*60*1000){
        totalMs += span;
        sessions++;
        const dayKey = effIn.getFullYear()+'-'+String(effIn.getMonth()+1).padStart(2,'0')+'-'+String(effIn.getDate()).padStart(2,'0');
        dayMap[dayKey] = (dayMap[dayKey]||0) + span;
      }
      openIn = null;
    }
  });

  let liveMs = 0;
  if(openIn){
    const now = new Date();
    if(now >= start && now < end){
      const effIn = openIn < start ? start : openIn;
      liveMs = now - effIn;
    }
  }

  return {totalMs, liveMs, sessions, dayMap, openIn};
}

function fmtHours(ms){
  if(ms <= 0) return '0h';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if(h === 0) return m+'m';
  if(m === 0) return h+'h';
  return h+'h '+m+'m';
}

function renderHours(){
  const el = document.getElementById('hoursDisplay');
  if(!el) return;
  if(!_hoursLogs.length){
    el.innerHTML = '<div style="font-size:12px;color:var(--ui-ink-4,#94a3b8);">No clock-ins yet.</div>';
    return;
  }
  const range = getPeriodRange(_hoursPeriod);
  const stats = calcHoursForRange(range.start, range.end);
  const totalWithLive = stats.totalMs + stats.liveMs;
  const totalH = (totalWithLive/3600000).toFixed(1);
  const liveStr = stats.liveMs > 0 ? '<span class="hours-num-sub" style="color:var(--nx-ok,#10b981);"> · clocked in (+'+fmtHours(stats.liveMs)+')</span>' : '';

  const days = Object.keys(stats.dayMap).sort();
  let barsHtml = '';
  if(days.length){
    const max = Math.max.apply(null, days.map(function(d){return stats.dayMap[d];}));
    barsHtml = '<div style="margin-top:10px;display:flex;align-items:flex-end;gap:3px;height:50px;">';
    const dayList = [];
    const cur = new Date(range.start);
    while(cur < range.end){
      const k = cur.getFullYear()+'-'+String(cur.getMonth()+1).padStart(2,'0')+'-'+String(cur.getDate()).padStart(2,'0');
      const ms = stats.dayMap[k] || 0;
      dayList.push({key:k, date:new Date(cur), ms});
      cur.setDate(cur.getDate()+1);
    }
    const list = dayList.length > 14 ? dayList.slice(-14) : dayList;
    list.forEach(function(d){
      const h = max > 0 ? Math.max(2, Math.round(d.ms/max*46)) : 2;
      const tip = d.date.toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'})+': '+fmtHours(d.ms);
      const dn = String(d.date.getDate());
      barsHtml += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0;" title="'+tip+'">'+
        '<div style="width:100%;max-width:24px;height:'+h+'px;background:'+(d.ms>0?'var(--accent)':'var(--m-border,#e2e8f0)')+';border-radius:4px;transition:height .3s;"></div>'+
        '<div style="font-size:9.5px;color:var(--ui-ink-4,#94a3b8);font-weight:600;">'+dn+'</div>'+
      '</div>';
    });
    barsHtml += '</div>';
  }

  const avgPerDay = days.length ? totalWithLive / days.length / 3600000 : 0;
  el.innerHTML =
    '<div class="hours-stat">'+
      '<div class="hours-num">'+totalH+' hrs</div>'+
      liveStr+
    '</div>'+
    '<div class="hours-detail">'+range.label+' · '+stats.sessions+' session'+(stats.sessions===1?'':'s')+(days.length?' · avg '+avgPerDay.toFixed(1)+'h/day':'')+'</div>'+
    barsHtml;
  renderPunctualityNote();
}

const _FORT_ANCHOR_MS = new Date(2026, 4, 4).setHours(0,0,0,0);
const _MS_DAY = 86400000, _MS_FORT = 14*_MS_DAY;

const _SYD_TZ='Australia/Sydney';
const _sydFmt=new Intl.DateTimeFormat('en-GB',{timeZone:_SYD_TZ,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
function _sydParts(ts){
  const p={}; _sydFmt.formatToParts(new Date(ts)).forEach(function(x){ p[x.type]=x.value; });
  return { y:+p.year, m:+p.month, d:+p.day, h:(+p.hour)%24, mi:+p.minute, ymd:p.year+'-'+p.month+'-'+p.day };
}
function _sydMidnightISO(y,m,d){
  const target=new Date(Date.UTC(y,m-1,d));
  const ty=target.getUTCFullYear(), tm=target.getUTCMonth()+1, td=target.getUTCDate();
  const ymd=ty+'-'+String(tm).padStart(2,'0')+'-'+String(td).padStart(2,'0');
  let t=Date.UTC(ty,tm-1,td)-14*3600000;
  for(let i=0;i<120;i++,t+=900000){
    const p=_sydParts(t);
    if(p.ymd===ymd && p.h===0 && p.mi===0) return new Date(t).toISOString();
  }
  return new Date(Date.UTC(ty,tm-1,td)-10*3600000).toISOString();
}
const _PUNCT_GRACE_MIN = 7;



function _onLeave(leaveRows, date){
  const ymd = date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
  return (leaveRows||[]).some(function(l){
    if((l.status||'')!=='approved') return false;
    return l.from_date && l.to_date && ymd >= l.from_date && ymd <= l.to_date;
  });
}

function _punctScore(onTimeDays, measuredDays){
  if(measuredDays<=0) return 0;
  return Math.round(onTimeDays/measuredDays*100);
}
const _PUNCT_MIN_DAYS = 4;
const _CLUB_GOLD = 90, _CLUB_SILVER = 80;
function _hofSort(a,b){
  if(b.onTimeDays!==a.onTimeDays) return b.onTimeDays-a.onTimeDays;
  if(b.score!==a.score) return b.score-a.score;
  if(a.lateDays!==b.lateDays) return a.lateDays-b.lateDays;
  return String(a.name||'').localeCompare(String(b.name||''));
}

/**
 * Snap a clock-in to the same 15-minute block the timesheet records.
 * Mirrors flexTimeStr() in the Apps Script: ≤7 → :00, ≤22 → :15, ≤37 → :30,
 * ≤52 → :45, else the next hour. Punctuality has to use this or it will
 * disagree with payroll about the very same arrival.
 */
function _flexRound(dt){
  const h=dt.getHours(); let m=dt.getMinutes(), hh=h;
  if(m<=7) m=0;
  else if(m<=22) m=15;
  else if(m<=37) m=30;
  else if(m<=52) m=45;
  else { m=0; hh=h+1; }
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), hh, m, 0, 0);
}

function _flexRoundMin(mins){
  let h=Math.floor(mins/60), m=mins%60;
  if(m<=7) m=0; else if(m<=22) m=15; else if(m<=37) m=30; else if(m<=52) m=45; else { m=0; h++; }
  return h*60+m;
}
function _computePunctuality(shiftsByYmd, logs, leaveRows, start, end){
  shiftsByYmd = shiftsByYmd || {};
  const firstInByYmd={};
  (logs||[]).forEach(function(r){
    if(r.action!=='in') return;
    const sp=_sydParts(r.ts), mins=sp.h*60+sp.mi;
    if(firstInByYmd[sp.ymd]===undefined || mins<firstInByYmd[sp.ymd]) firstInByYmd[sp.ymd]=mins;
  });
  let measuredDays=0, onTimeDays=0, lateDays=0, totalLateMin=0, worstMin=0, worstDay='',
      leaveDays=0, absentDays=0;
  const cur=new Date(start);
  while(cur<end){
    if(_onLeave(leaveRows, cur)){ leaveDays++; cur.setDate(cur.getDate()+1); continue; }
    const ymd = cur.getFullYear()+'-'+String(cur.getMonth()+1).padStart(2,'0')+'-'+String(cur.getDate()).padStart(2,'0');
    const expStart = shiftsByYmd[ymd] || null;

    if(expStart){
      const firstInMin=firstInByYmd[ymd];
      if(firstInMin!==undefined){
        measuredDays++;
        const pp=String(expStart).split(':');
        const expMin=(+pp[0])*60+(+pp[1]||0);
        const lateMin=_flexRoundMin(firstInMin)-expMin;
        if(lateMin>_PUNCT_GRACE_MIN){
          lateDays++; totalLateMin+=lateMin;
          if(lateMin>worstMin){ worstMin=lateMin; worstDay=cur.toLocaleDateString('en-AU',{weekday:'long'}); }
        }else{
          onTimeDays++;
        }
      }else{
        absentDays++;
      }
    }
    cur.setDate(cur.getDate()+1);
  }
  return { measuredDays, onTimeDays, lateDays, totalLateMin, worstMin, worstDay, leaveDays,
           absentDays, score:_punctScore(onTimeDays, measuredDays) };
}

let _rosterShiftCache=null;
async function _loadRosterShifts(fw){
  if(_rosterShiftCache) return _rosterShiftCache;
  const byName={};
  const startYmd = fw.start.getFullYear()+'-'+String(fw.start.getMonth()+1).padStart(2,'0')+'-'+String(fw.start.getDate()).padStart(2,'0');
  const endD = new Date(fw.end.getFullYear(), fw.end.getMonth(), fw.end.getDate()-1);
  const endYmd = endD.getFullYear()+'-'+String(endD.getMonth()+1).padStart(2,'0')+'-'+String(endD.getDate()).padStart(2,'0');
  try{
    const rows=await sbGet('roster_shifts',
      '?status=eq.assigned&shift_date=gte.'+startYmd+'&shift_date=lte.'+endYmd+
      '&select=staff_name,shift_date,start_time&order=shift_date.asc&limit=5000')||[];
    rows.forEach(function(r){
      if(!r.staff_name || !r.shift_date || !r.start_time) return;
      const m=(byName[r.staff_name]=byName[r.staff_name]||{});
      if(!m[r.shift_date] || r.start_time < m[r.shift_date]) m[r.shift_date]=r.start_time;
    });
  }catch(e){}
  _rosterShiftCache=byName;
  return _rosterShiftCache;
}

async function _computeMyStreak(){
  const todayYmd = _sydParts(Date.now()).ymd;

  let shifts=[];
  try{
    shifts=await sbGet('roster_shifts',
      '?status=eq.assigned&staff_name=eq.'+encodeURIComponent(me)+
      '&shift_date=lte.'+todayYmd+
      '&select=shift_date&order=shift_date.asc&limit=2000')||[];
  }catch(e){ shifts=[]; }
  const dates=Array.from(new Set(shifts.map(function(r){return r.shift_date;}).filter(Boolean))).sort();
  if(!dates.length) return { current:0, best:0, lastYmd:null };

  const firstD=dates[0];
  let inDays=new Set();
  try{
    const logs=await sbGet('clock_log',
      '?staff_name=eq.'+encodeURIComponent(me)+'&action=eq.in'+
      '&ts=gte.'+_sydMidnightISO(+firstD.slice(0,4), +firstD.slice(5,7), +firstD.slice(8,10))+
      '&select=ts&order=ts.asc&limit=5000')||[];
    logs.forEach(function(r){ inDays.add(_sydParts(r.ts).ymd); });
  }catch(e){}

  let leave=[];
  try{ leave=await sbGet('leave_submissions','?staff_name=eq.'+encodeURIComponent(me)+'&status=eq.approved&select=from_date,to_date&limit=200')||[]; }catch(e){}
  function onLeave(ymd){
    return leave.some(function(l){ return l.from_date && l.to_date && ymd>=l.from_date && ymd<=l.to_date; });
  }

  const kept=[];
  dates.forEach(function(ymd){
    if(ymd===todayYmd && !inDays.has(ymd)) return;
    if(onLeave(ymd)){ kept.push(false); return; }
    kept.push(inDays.has(ymd));
  });

  let best=0, run=0, current=0;
  for(let i=0;i<kept.length;i++){
    if(kept[i]){ run++; if(run>best) best=run; }
    else run=0;
  }
  for(let i=kept.length-1;i>=0;i--){ if(kept[i]) current++; else break; }

  return { current, best, lastYmd:dates[dates.length-1] };
}

window.GLOW_SKINS = window.GLOW_SKINS || ['gold','ocean','sunset','molten','holographic','emerald','rosegold','galaxy'];
window.ELITE_SKINS = window.ELITE_SKINS || ['darkemerald'];
window.GLOW_SKIN_LABELS = window.GLOW_SKIN_LABELS || {
  gold:'Gold', ocean:'Ocean', sunset:'Sunset', molten:'Molten',
  holographic:'Holographic', emerald:'Emerald', rosegold:'Rose gold', galaxy:'Galaxy',
  darkemerald:'Forest Gold'
};
window._earnedGlow = window._earnedGlow || null;
window._eliteCallers = window._eliteCallers || null;
window._nameSkins  = window._nameSkins  || null;
window._avatars    = window._avatars    || null;
window._myNickname = (typeof window._myNickname === 'undefined') ? null : window._myNickname;
window._glowLoading = window._glowLoading || null;

window.loadGlowData = window.loadGlowData || async function(force){
  if(!force && window._earnedGlow && window._nameSkins && window._avatars) return true;
  if(window._glowLoading) return window._glowLoading;
  window._glowLoading = (async function(){
    const earned=new Set(), skins={}, avs={}, elite=new Set(), nicks={};
    const callMs={};
    const trainCt={};
    try{
      const rows=await sbGet('punctuality_history',
        '?select=staff_name,score,x,fort_start&order=fort_start.desc&limit=2000')||[];
      const DAY=86400000, now=Date.now();
      const hasEnded=function(fs){ return new Date(fs+'T00:00:00').getTime() + 14*DAY <= now; };
      const starts=[];
      rows.forEach(function(r){ if(r.fort_start && starts.indexOf(r.fort_start)<0) starts.push(r.fort_start); });
      starts.sort();
      let target=null;
      for(let i=starts.length-1;i>=0;i--){ if(hasEnded(starts[i])){ target=starts[i]; break; } }
      if(target){
        rows.forEach(function(r){
          if(r.fort_start===target && Number(r.score)===100 && Number(r.x)>=4 && r.staff_name){
            earned.add(r.staff_name);
          }
        });
      }
    }catch(e){}
    try{
      const cm=await sbGet('call_milestones','?select=staff_name,milestone&limit=1000')||[];
      cm.forEach(function(r){
        if(!r.staff_name) return;
        const m=Number(r.milestone)||0;
        if(m > (callMs[r.staff_name]||0)) callMs[r.staff_name]=m;
        if(m>=1000) elite.add(r.staff_name);
      });
    }catch(e){}
    try{
      const sets={};
      const add=function(r){ if(r&&r.staff_name&&r.quiz_id){ (sets[r.staff_name]=sets[r.staff_name]||new Set()).add(r.quiz_id); } };
      (await sbGet('custom_quiz_results','?select=staff_name,quiz_id&passed=is.true&limit=5000')||[]).forEach(add);
      (await sbGet('training_quiz_results','?select=staff_name,quiz_id&passed=is.true&limit=5000')||[]).forEach(add);
      Object.keys(sets).forEach(function(nm){ trainCt[nm]=sets[nm].size; });
    }catch(e){}
    try{
      const sk=await sbGet('staff_credentials','?select=staff_name,name_skin,nickname&limit=500')||[];
      sk.forEach(function(r){
        if(r.staff_name){
          skins[r.staff_name]=r.name_skin||null;
          if(r.nickname && r.nickname.trim()) nicks[r.staff_name]=r.nickname.trim();
        }
      });
    }catch(e){}
    try{
      const av=await sbGet('staff_avatars','?select=staff_name,avatar,avatar_path&limit=500')||[];
      av.forEach(function(a){ var u=_avatarUrl(a.avatar_path)||a.avatar; if(a.staff_name && u) avs[a.staff_name]=u; });
    }catch(e){}
    window._earnedGlow=earned; window._nameSkins=skins; window._avatars=avs; window._eliteCallers=elite;
    window._callMsMap=callMs; window._trainCtMap=trainCt; window._nickNames=nicks;
    window._glowLoading=null;
    return true;
  })();
  return window._glowLoading;
};

window.isEliteCaller = window.isEliteCaller || function(name){
  return !!(window._eliteCallers && name && window._eliteCallers.has(name));
};
window.hasEarnedGlow = window.hasEarnedGlow || function(name){
  return !!(name && ((window._earnedGlow && window._earnedGlow.has(name)) || window.isEliteCaller(name)));
};
window.allowedSkinsFor = window.allowedSkinsFor || function(name){
  const list = [];
  if(window._earnedGlow && name && window._earnedGlow.has(name)) list.push.apply(list, (window.GLOW_SKINS||[]));
  if(window.isEliteCaller(name)) list.push.apply(list, (window.ELITE_SKINS||[]));
  return list;
};
window.glowSkinFor = window.glowSkinFor || function(name){
  const s = window._nameSkins && window._nameSkins[name];
  const allowed = window.allowedSkinsFor(name);
  if(s && allowed.indexOf(s)>=0) return s;
  return window.isEliteCaller(name) ? 'darkemerald' : 'gold';
};

window.ACH_BADGE_ICONS = window.ACH_BADGE_ICONS || {
  phone:'<path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>',
  cap:'<path d="M10 2 1 6l9 4 7.36-3.27V11a1 1 0 1 0 1 0V6L10 2Z"/><path d="M4 10.3V13c0 1.66 2.69 3 6 3s6-1.34 6-3v-2.7l-6 2.67-6-2.67Z"/>',
  medal:'<path d="M6.5 1h2.2L6.9 6.2 4.7 5.4 6.5 1Zm7 0-1.8 4.4-2.2.8L11.3 1h2.2Z"/><circle cx="10" cy="13" r="6"/><path d="M10 9.6l1.3 2.6 2.9.42-2.1 2.05.5 2.88L10 16.2l-2.6 1.35.5-2.88-2.1-2.05 2.9-.42L10 9.6Z" fill="#fff"/>'
};
window._achFlowSeq = window._achFlowSeq || 0;
window.achFlowIcon = function(paths, stops, title, sizePx){
  const id='agf'+(window._achFlowSeq++);
  const sz=sizePx||14;
  const grad='<defs><linearGradient id="'+id+'" x1="0" y1="0" x2="1" y2="0">'+
    stops+
    '<animate attributeName="x1" values="-1;1" dur="4s" repeatCount="indefinite"/>'+
    '<animate attributeName="x2" values="0;2" dur="4s" repeatCount="indefinite"/>'+
    '</linearGradient></defs>';
  return '<svg viewBox="0 0 20 20" width="'+sz+'" height="'+sz+'" style="vertical-align:-2px;flex-shrink:0;" '+
    (title?'aria-label="'+String(title).replace(/"/g,'')+'"':'')+'>'+grad+
    '<g fill="url(#'+id+')">'+paths+'</g></svg>';
};
window.achBadgesInline = function(name, opts){
  if(!name) return '';
  opts=opts||{};
  const gap=opts.gap||4, sz=opts.size||14;
  const out=[];
  const cm=(window._callMsMap && window._callMsMap[name])||0;
  const _emeraldStops='<stop offset="0%" stop-color="#0b6b4f"/><stop offset="35%" stop-color="#0f8a62"/><stop offset="60%" stop-color="#e0b020"/><stop offset="100%" stop-color="#0b6b4f"/>';
  if(cm>=1000){
    out.push('<span title="1000 calls logged — The Call-Handler" style="display:inline-flex;align-items:center;">'+window.achFlowIcon(window.ACH_BADGE_ICONS.medal, _emeraldStops, 'The Call-Handler', sz)+'</span>');
  } else {
    const _cmTiers=[
      {t:100, stops:'<stop offset="0%" stop-color="#1e40af"/><stop offset="40%" stop-color="#3b82f6"/><stop offset="60%" stop-color="#93c5fd"/><stop offset="100%" stop-color="#1e40af"/>', tip:'100 calls logged'},
      {t:500, stops:'<stop offset="0%" stop-color="#78350f"/><stop offset="35%" stop-color="#d4a017"/><stop offset="55%" stop-color="#fff2c2"/><stop offset="100%" stop-color="#78350f"/>', tip:'500 calls logged'}
    ];
    _cmTiers.forEach(function(k){
      if(cm<k.t) return;
      out.push('<span title="'+k.tip+'" style="display:inline-flex;align-items:center;">'+window.achFlowIcon(window.ACH_BADGE_ICONS.phone, k.stops, k.tip, sz)+'</span>');
    });
  }
  const tc=(window._trainCtMap && window._trainCtMap[name])||0;
  if(tc>0 && !opts.noTraining){
    out.push('<span title="'+tc+' training'+(tc===1?'':'s')+' passed" style="display:inline-flex;align-items:center;gap:1px;color:#047857;font-weight:800;font-size:'+(sz-2)+'px;">'+
      '<svg viewBox="0 0 20 20" width="'+sz+'" height="'+sz+'" fill="#047857" style="vertical-align:-2px;">'+window.ACH_BADGE_ICONS.cap+'</svg>'+tc+'</span>');
  }
  if(!out.length) return '';
  return '<span class="ach-inline" style="display:inline-flex;align-items:center;gap:'+gap+'px;margin-left:6px;vertical-align:middle;">'+out.join('')+'</span>';
};


window.loadAchievementFeed = async function(force){
  if(!force && window._achFeed) return window._achFeed;
  if(window._achFeedLoading) return window._achFeedLoading;
  window._achFeedLoading = (async function(){
    const events=[];
    try{
      const pc=await sbGet('custom_quiz_results','?select=staff_name,created_at&passed=is.true&order=created_at.desc&limit=200')||[];
      pc.forEach(function(r){
        if(r.staff_name && r.created_at) events.push({name:r.staff_name,type:'training',date:r.created_at});
      });
    }catch(e){}
    try{
      const pt=await sbGet('training_quiz_results','?select=staff_name,created_at&passed=is.true&order=created_at.desc&limit=200')||[];
      pt.forEach(function(r){
        if(r.staff_name && r.created_at) events.push({name:r.staff_name,type:'training',date:r.created_at});
      });
    }catch(e){}
    try{
      const gr=await sbGet('punctuality_history','?select=staff_name,fort_start&score=eq.100&x=gte.4&order=fort_start.asc&limit=2000')||[];
      const firstGlow={};
      gr.forEach(function(r){
        if(r.staff_name && r.fort_start && !firstGlow[r.staff_name]) firstGlow[r.staff_name]=r.fort_start;
      });
      Object.keys(firstGlow).forEach(function(nm){
        events.push({name:nm,type:'glow',date:firstGlow[nm]});
      });
    }catch(e){}
    try{
      const cm=await sbGet('call_milestones','?select=staff_name,milestone,reached_at&order=reached_at.desc&limit=500')||[];
      cm.forEach(function(r){
        if(r.staff_name && r.milestone && r.reached_at){
          events.push({name:r.staff_name,type:'calls',milestone:Number(r.milestone),date:r.reached_at});
        }
      });
    }catch(e){}
    events.sort(function(a,b){ return new Date(b.date) - new Date(a.date); });
    window._achFeed=events; window._achFeedLoading=null;
    return events;
  })();
  return window._achFeedLoading;
};

window.achAgo = function(iso){
  const then=new Date(iso), now=new Date();
  const days=Math.floor((now-then)/86400000);
  if(days<=0) return 'today';
  if(days===1) return 'yesterday';
  if(days<7) return days+'d ago';
  if(days<30) return Math.floor(days/7)+'w ago';
  if(days<365) return Math.floor(days/30)+'mo ago';
  return Math.floor(days/365)+'y ago';
};

window.achRowHTML = function(ev, esc, opts){
  const e=(esc||function(s){return s;});
  opts=opts||{};
  const rich=!!opts.rich;
  const nm=window.renderStaffName(ev.name, e);
  let badgeSvg, badgeBg, action;
  if(ev.type==='glow'){
    badgeBg='#e6b422';
    badgeSvg='<svg width="10" height="10" viewBox="0 0 20 20" fill="#fff"><path d="M10 1.5l2.6 5.27 5.82.845-4.21 4.105.994 5.795L10 14.77l-5.204 2.735.994-5.795L1.58 7.615l5.82-.845z"/></svg>';
    action='earned <b>Glow</b>, a perfect fortnight';
  }else if(ev.type==='calls'){
    badgeBg='#2563eb';
    badgeSvg='<svg width="10" height="10" viewBox="0 0 20 20" fill="#fff"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/></svg>';
    action='logged <b>'+(ev.milestone||0)+' calls</b>';
  }else{
    badgeBg='#047857';
    badgeSvg='<svg width="10" height="10" viewBox="0 0 20 20" fill="#fff"><path d="M10 2 1 6l9 4 7.36-3.27V11a1 1 0 1 0 1 0V6L10 2Z"/><path d="M4 10.3V13c0 1.66 2.69 3 6 3s6-1.34 6-3v-2.7l-6 2.67-6-2.67Z"/></svg>';
    action='passed a <b>training</b>';
  }
  const avSize=rich?42:30;
  const bDim=rich?18:15;
  const avatar=
    '<div style="position:relative;flex-shrink:0;width:'+avSize+'px;height:'+avSize+'px;">'+
      (window.renderStaffAvatar?window.renderStaffAvatar(ev.name, avSize):'')+
      '<span style="position:absolute;right:-2px;bottom:-2px;width:'+bDim+'px;height:'+bDim+'px;border-radius:50%;'+
      'background:'+badgeBg+';border:2px solid #fff;display:flex;align-items:center;justify-content:center;">'+badgeSvg+'</span>'+
    '</div>';
  return '<div onclick="viewStaffProfileByName(\''+String(ev.name).replace(/'/g,"\\'")+'\')" '+
    'style="display:flex;align-items:center;gap:'+(rich?'14px':'11px')+';padding:'+(rich?'12px 14px':'10px 12px')+';border-radius:'+(rich?'12px':'10px')+';cursor:pointer;'+
    'transition:background .12s;'+(rich?'border:1px solid var(--ui-line-soft,#f1f5f9);margin-bottom:8px;':'')+'" onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\''+(rich?'#fff':'transparent')+'\'">'+
    avatar+
    '<div style="flex:1;min-width:0;font-size:'+(rich?'14px':'13px')+';color:var(--ui-ink-2b,#475569);line-height:1.35;">'+
    '<span style="font-weight:700;color:var(--ui-ink,#0f172a);">'+nm+'</span> '+action+'</div>'+
    '<div style="font-size:11px;color:var(--ui-ink-4,#94a3b8);flex-shrink:0;">'+window.achAgo(ev.date)+'</div></div>';
};

window.loadHomeAchievements = async function(){
  const card=document.getElementById('homeAchievements');
  const list=document.getElementById('homeAchList');
  if(!card||!list) return;
  try{
    const feed=await window.loadAchievementFeed();
    if(!feed || !feed.length){ card.style.display='none'; return; }
    list.innerHTML=feed.slice(0,3).map(function(ev){return window.achRowHTML(ev, esc);}).join('');
    card.style.display='block';
  }catch(e){ card.style.display='none'; }
};

window.loadAchievementsPage = async function(){
  const feedEl=document.getElementById('achFeedList');
  const stripCard=document.getElementById('achGlowStrip');
  const stripList=document.getElementById('achGlowList');
  try{ await ensureStaffDirData(); }catch(e){}
  try{
    await loadGlowData();
    const glowing=[];
    if(window._earnedGlow) window._earnedGlow.forEach(function(n){ glowing.push(n); });
    glowing.sort();
    if(glowing.length && stripCard && stripList){
      stripList.innerHTML=glowing.map(function(n){
        const skin=window.glowSkinFor(n);
        return '<span onclick="viewStaffProfileByName(\''+String(n).replace(/'/g,"\\'")+'\')" '+
          'style="cursor:pointer;display:inline-block;padding:4px 11px;border:1px solid #f6e9c8;'+
          'border-radius:999px;background:#fffdf5;">'+
          '<span class="glow-name glow-'+skin+'" style="font-size:14px;font-weight:800;">'+esc(n)+'</span></span>';
      }).join('');
      stripCard.style.display='block';
    }else if(stripCard){ stripCard.style.display='none'; }
  }catch(e){ if(stripCard) stripCard.style.display='none'; }
  try{
    const feed=await window.loadAchievementFeed(true);
    if(!feedEl) return;
    if(!feed || !feed.length){
      feedEl.innerHTML='<div style="text-align:center;color:#cbd5e1;padding:28px;font-size:13px;font-style:italic;">No achievements yet — early days.</div>';
      return;
    }
    feedEl.innerHTML=feed.map(function(ev){return window.achRowHTML(ev, esc, {rich:true});}).join('');
  }catch(e){
    if(feedEl) feedEl.innerHTML='<div style="text-align:center;color:var(--ui-ink-4,#94a3b8);padding:28px;font-size:13px;">Couldn\'t load achievements.</div>';
  }
};


window.adminIcon = window.adminIcon || function(size){
  const s=size||14;
  return '<svg viewBox="0 0 552 552" width="'+s+'" height="'+s+'" fill="currentColor" '+
    'style="vertical-align:-2px;flex-shrink:0;" role="img" aria-label="Admin">'+
    '<path d="M197 236a99 99 0 1 0 0-198 99 99 0 0 0 0 198zm0-49a50 50 0 1 1 0-100 50 50 0 0 1 0 100z"/>'+
    '<path d="M356 314 251 419a86 86 0 1 0 34 34l43-43 34 34 41-41-34-34 26-26 41 41 41-41-90-90-31 31zM251 484a37 37 0 1 1 0-74 37 37 0 0 1 0 74z"/>'+
    '<path d="M197 246c-92 0-166 74-166 166v100h148v-49H80v-51a117 117 0 0 1 175-101l35-35a165 165 0 0 0-93-30z"/>'+
    '</svg>';
};
window.displayNameFor = window.displayNameFor || function(name){
  return name;
};
window.nicknameFor = window.nicknameFor || function(name){
  const n = window._nickNames && window._nickNames[name];
  return (n && n.trim()) ? n.trim() : null;
};
window.renderStaffName = window.renderStaffName || function(name, escFn, plainOverride){
  const e = (escFn||function(s){return s;});
  const text = plainOverride!=null ? plainOverride : window.displayNameFor(name);
  const shown = e(text||'');
  if(window.hasEarnedGlow(name)){
    return '<span class="glow-name glow-'+window.glowSkinFor(name)+'" title="Earned a perfect fortnight">'+shown+'</span>';
  }
  return shown;
};

window.avatarFor = window.avatarFor || function(name){
  return (window._avatars && window._avatars[name]) || null;
};
window.renderStaffAvatar = window.renderStaffAvatar || function(name, size, extraStyle){
  size = size||36; extraStyle = extraStyle||'';
  const img = window.avatarFor(name);
  const base='width:'+size+'px;height:'+size+'px;border-radius:50%;flex-shrink:0;'+extraStyle;
  if(img){
    return '<div style="'+base+'background-image:url('+img+');background-size:cover;background-position:center;"></div>';
  }
  const initials=String(name||'?').split(' ').map(function(w){return w[0]||'';}).join('').slice(0,2).toUpperCase();
  return '<div style="'+base+'background:linear-gradient(135deg,var(--accent),#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:'+Math.round(size*0.36)+'px;">'+initials+'</div>';
};

window.loadMyNickname = window.loadMyNickname || async function(){
  try{
    const rows=await sbGet('staff_credentials','?staff_name=eq.'+encodeURIComponent(me)+'&select=nickname&limit=1');
    window._myNickname=(rows&&rows.length)?(rows[0].nickname||null):null;
  }catch(e){ window._myNickname=null; }
  return window._myNickname;
};
window.myDisplayName = window.myDisplayName || function(){
  return me;
};
window.paintMyNickLine = window.paintMyNickLine || function(){
  const el=document.getElementById('profNick'); if(!el) return;
  const nk=(window._myNickname && window._myNickname.trim()) ? window._myNickname.trim() : '';
  if(nk){ el.textContent='Goes by "'+nk+'"'; el.style.display='block'; }
  else { el.textContent=''; el.style.display='none'; }
};


const _IMPROVE_MIN_DAYS = 4;

let _histWritten=false;
async function _writeFortnightHistory(fw, board){
  if(_histWritten) return;
  _histWritten=true;
  if(!fw || !board || !board.length) return;
  const fortKey = fw.start.getFullYear()+String(fw.start.getMonth()+1).padStart(2,'0')+String(fw.start.getDate()).padStart(2,'0');
  const fortStart = fw.start.getFullYear()+'-'+String(fw.start.getMonth()+1).padStart(2,'0')+'-'+String(fw.start.getDate()).padStart(2,'0');
  const rows=board.filter(function(b){return b.measuredDays>0;}).map(function(b){
    return { fort_key:fortKey, staff_name:b.name, score:b.score, y:b.onTimeDays, x:b.measuredDays, fort_start:fortStart };
  });
  if(!rows.length) return;
  try{
    await fetch(SB+"/rest/v1/punctuality_history?on_conflict=fort_key,staff_name",{
      method:"POST",
      headers:{ "apikey":KEY, "Authorization":"Bearer "+_sbBearer(),
                "Content-Type":"application/json",
                "Prefer":"resolution=merge-duplicates,return=minimal" },
      body:JSON.stringify(rows)
    });
  }catch(e){}
}

async function _computeMyImprovement(fw, curScore, curX){
  if(!(curX>=_IMPROVE_MIN_DAYS)) return null;
  const curStart = fw.start.getFullYear()+'-'+String(fw.start.getMonth()+1).padStart(2,'0')+'-'+String(fw.start.getDate()).padStart(2,'0');
  let hist=[];
  try{
    hist=await sbGet('punctuality_history',
      '?staff_name=eq.'+encodeURIComponent(me)+
      '&x=gte.'+_IMPROVE_MIN_DAYS+
      '&fort_start=lt.'+curStart+
      '&select=score,fort_start&order=fort_start.desc&limit=1')||[];
  }catch(e){ return null; }
  if(!hist.length) return null;
  const prev=hist[0];
  return { delta: curScore - prev.score, cur: curScore, prev: prev.score };
}

function _lastFortnight(){
  const sp=_sydParts(Date.now());
  const curIdx=Math.floor((Date.UTC(sp.y,sp.m-1,sp.d)-Date.UTC(2026,4,4))/_MS_FORT);
  if(curIdx<1) return null;
  const base=4+(curIdx-1)*14;
  const start=new Date(2026,4,base);
  const end=new Date(2026,4,base+14);
  const key='oscars_fortreport_seen_'+start.getFullYear()+String(start.getMonth()+1).padStart(2,'0')+String(start.getDate()).padStart(2,'0');
  const period=start.toLocaleDateString('en-AU',{day:'numeric',month:'short'})+' \u2013 '+new Date(2026,4,base+13).toLocaleDateString('en-AU',{day:'numeric',month:'short'});
  return { start, end, key, period,
    startIso:_sydMidnightISO(start.getFullYear(),start.getMonth()+1,start.getDate()),
    endIso:_sydMidnightISO(end.getFullYear(),end.getMonth()+1,end.getDate()) };
}

function _fortReportShowable(fw){
  if(!fw) return false;
  const now=Date.now();
  if(now<Date.parse(fw.endIso)) return false;
  const fridayEnd=Date.parse(_sydMidnightISO(fw.end.getFullYear(),fw.end.getMonth()+1,fw.end.getDate()+5))-1;
  if(now>fridayEnd) return false;
  return true;
}


let _myFortCache=null;
async function _computeMyFortnight(){
  if(_myFortCache) return _myFortCache;
  const fw=_lastFortnight();
  if(!fw) return null;

  let myLeave=[], myLogs=[];
  try{ myLeave=await sbGet('leave_submissions','?staff_name=eq.'+encodeURIComponent(me)+'&status=eq.approved&limit=100')||[]; }catch(e){ myLeave=[]; }
  myLogs=(_hoursLogs||[]).filter(function(r){ const t=new Date(r.ts).getTime(); return t>=Date.parse(fw.startIso) && t<Date.parse(fw.endIso); });
  if(!myLogs.length){
    try{ myLogs=await sbGet('clock_log','?staff_name=eq.'+encodeURIComponent(me)+'&ts=gte.'+fw.startIso+'&ts=lt.'+fw.endIso+'&order=ts.asc&limit=1000')||[]; }catch(e){ myLogs=[]; }
  }

  const rosterBy=await _loadRosterShifts(fw);
  const mine=_computePunctuality(rosterBy[me]||{}, myLogs, myLeave, fw.start, fw.end);

  let amendedCount=0, autoCount=0;
  try{
    const stamped=await sbGet('clock_log','?staff_name=eq.'+encodeURIComponent(me)+
      '&ts=gte.'+fw.startIso+'&ts=lt.'+fw.endIso+
      '&select=origin,edited_at&limit=500')||[];
    stamped.forEach(function(r){
      if(r.origin==='manual'||r.edited_at) amendedCount++;
      else if(r.origin==='auto') autoCount++;
    });
  }catch(e){}
  const myFortLeaves=(myLeave||[]).filter(function(l){
    if((l.status||'')!=='approved'||!l.from_date||!l.to_date) return false;
    const f=new Date(l.from_date+'T00:00:00'), t=new Date(l.to_date+'T23:59:59');
    return f<fw.end && t>=fw.start;
  }).length;
  const lostH=Math.floor(mine.totalLateMin/60), lostM=mine.totalLateMin%60;
  const lostStr = mine.totalLateMin<=0 ? '0 min' : (lostH>0?(lostH+'h '+(lostM?lostM+'m':'')).trim():mine.totalLateMin+' min');
  const onTimeDays = mine.measuredDays - mine.lateDays;
  const onTimePct = mine.measuredDays ? Math.round(onTimeDays/mine.measuredDays*100) : null;

  let streak={ current:0, best:0, lastYmd:null };
  try{ streak=await _computeMyStreak(); }catch(e){}

  let improvement=null;
  try{ improvement=await _computeMyImprovement(fw, mine.score, mine.measuredDays); }catch(e){}

  _myFortCache={ fw, mine, myFortLeaves, lostStr, onTimePct, amendedCount, autoCount, streak, improvement };
  return _myFortCache;
}

let _fortReportDone=false, _fortReportBusy=false;
async function renderPunctualityNote(){
  const el=document.getElementById('punctualityNote');
  if(!el || _fortReportDone || _fortReportBusy) return;
  _fortReportBusy=true;
  let data=null;
  try{ data=await _computeMyFortnight(); }catch(e){ console.warn('fortnight banner',e); }
  _fortReportBusy=false;
  if(!data) return;
  if(!_fortReportShowable(data.fw)) return;
  _fortReportDone=true;

  el.innerHTML=
    '<button onclick="openFortReport()" class="fr-tap">'+
      '<div class="fr-tap-ic">'+
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><rect x="7" y="10" width="3" height="7"/><rect x="14" y="6" width="3" height="11"/></svg>'+
      '</div>'+
      '<div class="fr-tap-tx">'+
        '<div class="fr-tap-t">Tap to see your fortnightly report</div>'+
        '<div class="fr-tap-s">'+data.fw.period+'</div>'+
      '</div>'+
      '<div class="fr-tap-arrow">\u203A</div>'+
    '</button>';
}



function _leaderboardHTML(board){
  if(!board || !board.length) return '<div style="font-size:12.5px;color:var(--ui-ink-4,#94a3b8);">No punctuality data for this fortnight yet.</div>';

  const club=board.filter(function(b){ return b.measuredDays>=_PUNCT_MIN_DAYS && b.score>=_CLUB_SILVER; })
                  .slice().sort(function(a,b){ return b.score-a.score || b.onTimeDays-a.onTimeDays || String(a.name).localeCompare(String(b.name)); });
  const gold=club.filter(function(b){ return b.score>=_CLUB_GOLD; });
  const silver=club.filter(function(b){ return b.score>=_CLUB_SILVER && b.score<_CLUB_GOLD; });

  function medal(fill, ring){
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;display:block;">'+
      '<path d="M8.5 2h3l-2.2 7h-3z" fill="'+ring+'"/>'+
      '<path d="M15.5 2h-3l2.2 7h3z" fill="'+ring+'"/>'+
      '<circle cx="12" cy="15" r="6.5" fill="'+fill+'"/>'+
      '<circle cx="12" cy="15" r="6.5" fill="none" stroke="'+ring+'" stroke-width="1.5"/>'+
      '<circle cx="12" cy="15" r="2.6" fill="'+ring+'" opacity=".55"/>'+
    '</svg>';
  }
  const GOLD_C  = { bg:'#faeeda', bd:'#ef9f27', disc:'#efa927', ring:'#633806' };
  const SILV_C  = { bg:'#f4f4f2', bd:'#c9c8c1', disc:'#c2c1ba', ring:'#4a4a46' };
  function chip(b, C){
    const isMe=b.name===me;
    const bg = isMe ? 'var(--accent-dim,#eef2ff)' : C.bg;
    const bd = isMe ? 'var(--accent-bd,#c7d2fe)' : C.bd;
    const nameCol = isMe ? 'var(--accent-text,#4f46e5)' : '#0f172a';
    const scoreCol = isMe ? 'var(--accent-text,#4f46e5)' : C.ring;
    return '<span class="fr-hof-chip'+(isMe?' me':'')+'" style="display:inline-flex;align-items:center;gap:7px;padding:6px 12px 6px 8px;border-radius:999px;margin:0 7px 7px 0;background:'+bg+';border:1px solid '+bd+';">'+
      medal(C.disc, C.ring)+
      '<span class="fr-hof-nm" style="font-size:13px;font-weight:'+(isMe?'800':'600')+';color:'+nameCol+';">'+esc(b.name)+(isMe?' (you)':'')+'</span>'+
      '<span class="fr-hof-sc" style="font-size:12px;font-weight:800;color:'+scoreCol+';font-variant-numeric:tabular-nums;">'+b.score+'%</span></span>';
  }

  let html='';

  if(gold.length || silver.length){
    html+='<div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--ui-ink-3,#64748b);margin:2px 0 10px;">On-Time Club</div>';
    if(gold.length){
      html+='<div style="display:flex;align-items:center;gap:7px;font-size:11px;font-weight:700;color:#854f0b;margin:0 0 7px;">'+medal(GOLD_C.disc,GOLD_C.ring)+'Gold \u00b7 '+_CLUB_GOLD+'%+</div>';
      html+='<div style="margin-bottom:14px;">'+gold.map(function(b){return chip(b,GOLD_C);}).join('')+'</div>';
    }
    if(silver.length){
      html+='<div style="display:flex;align-items:center;gap:7px;font-size:11px;font-weight:700;color:#5f5e5a;margin:0 0 7px;">'+medal(SILV_C.disc,SILV_C.ring)+'Silver \u00b7 '+_CLUB_SILVER+'\u2013'+(_CLUB_GOLD-1)+'%</div>';
      html+='<div style="margin-bottom:10px;">'+silver.map(function(b){return chip(b,SILV_C);}).join('')+'</div>';
    }
  }else{
    html+='<div style="font-size:12.5px;color:var(--ui-ink-4,#94a3b8);margin-bottom:10px;">No On-Time Club members this fortnight \u2014 next one\u2019s yours.</div>';
  }

  const vol=board.filter(function(b){ return b.onTimeDays>0; }).slice(0,5);
  if(vol.length){
    html+='<div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--ui-ink-3,#64748b);margin:6px 0 8px;">Most on-time shifts</div>';
    const maxY=vol[0].onTimeDays||1;
    html+=vol.map(function(b){
      const isMe=b.name===me;
      const pct=Math.round((b.onTimeDays/maxY)*100);
      return '<div style="display:flex;align-items:center;gap:10px;padding:6px 4px;">'+
        '<div style="flex:1;min-width:0;">'+
          '<div style="font-size:13px;font-weight:'+(isMe?'800':'600')+';color:var(--ui-ink,#0f172a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px;">'+esc(b.name)+(isMe?' (you)':'')+'</div>'+
          '<div style="height:6px;border-radius:4px;background:#eef1f6;overflow:hidden;"><div style="height:100%;width:'+pct+'%;border-radius:4px;background:'+(isMe?'var(--accent,#4f46e5)':'#9aa6c4')+';"></div></div>'+
        '</div>'+
        '<div style="flex-shrink:0;font-size:13px;font-weight:800;color:var(--ui-ink-2b,#475569);font-variant-numeric:tabular-nums;">'+b.onTimeDays+'</div>'+
      '</div>';
    }).join('');
  }

  html+='<div style="font-size:10.5px;color:var(--ui-ink-4,#94a3b8);margin-top:12px;line-height:1.4;">On-time means clocking in within '+_PUNCT_GRACE_MIN+' minutes of your rostered shift start (or early). Expected start comes from the published roster. The On-Time Club needs at least '+_PUNCT_MIN_DAYS+' shifts worked to qualify. Approved leave days are skipped.</div>';
  return html;
}

async function loadFortLeaderboard(){
  const card=document.getElementById('fortReportCard');
  const mount=document.getElementById('fortLeaderboardMount');
  if(!mount) return;
  const fw=_lastFortnight();
  if(!fw || !_fortReportShowable(fw)){ if(card) card.style.display='none'; return; }
  if(card) card.style.display='';
  mount.innerHTML='<div style="font-size:12px;color:var(--ui-ink-4,#94a3b8);">'+nxSkel('list',4)+'</div>';

  const streakEl=document.getElementById('fortStreakMount');
  if(streakEl){
    try{
      const d=await _computeMyFortnight();
      const st=d&&d.streak;
      if(st && (st.current>0 || st.best>0)){
        const cur=st.current, best=st.best;
        const sub = (cur>0 && cur===best && cur>1) ? 'your best run yet'
                  : (cur>0 ? 'consecutive shift'+(cur===1?'':'s')+' clocked in'+(best>cur?' \u00b7 best '+best:'')
                           : 'best run '+best+' \u2014 start a new one');
        streakEl.innerHTML=
          '<div style="display:flex;align-items:center;gap:12px;padding:11px 13px;border-radius:10px;background:linear-gradient(135deg,#fff7ed,#ffedd5);border:1px solid #fed7aa;">'+
            '<div style="font-size:26px;line-height:1;">'+(cur>0?'\uD83D\uDD25':'\u2728')+'</div>'+
            '<div style="flex:1;min-width:0;">'+
              '<div style="font-size:15px;font-weight:800;color:#9a3412;">'+(cur>0?cur+' shift'+(cur===1?'':'s')+' on a roll':'No active streak')+'</div>'+
              '<div style="font-size:11.5px;color:#b45309;margin-top:1px;">'+sub+'</div>'+
            '</div>'+
          '</div>';
      }else{ streakEl.innerHTML=''; }
      const imp=d&&d.improvement;
      if(imp && imp.delta>0){
        streakEl.innerHTML+=
          '<div style="display:flex;align-items:center;gap:12px;padding:11px 13px;border-radius:10px;margin-top:8px;background:linear-gradient(135deg,#ecfdf5,#d1fae5);border:1px solid #a7f3d0;">'+
            '<div style="font-size:24px;line-height:1;">\uD83D\uDCC8</div>'+
            '<div style="flex:1;min-width:0;">'+
              '<div style="font-size:15px;font-weight:800;color:#065f46;">Most improved \u00b7 +'+imp.delta+' pts</div>'+
              '<div style="font-size:11.5px;color:#047857;margin-top:1px;">on-time rate '+imp.prev+'% \u2192 '+imp.cur+'% since last fortnight</div>'+
            '</div>'+
          '</div>';
      }
    }catch(e){ streakEl.innerHTML=''; }
  }

  const board=await _buildLeaderboard(fw);
  mount.innerHTML=
    '<div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--ui-ink-3,#64748b);margin-bottom:8px;">Hall of Fame \u00b7 '+fw.period+'</div>'+
    _leaderboardHTML(board);
}



let _fortAudio=null;
function _fortSound(kind){
  try{
    _fortAudio = _fortAudio || new (window.AudioContext||window.webkitAudioContext)();
    const ctx=_fortAudio; if(ctx.state==='suspended') ctx.resume();
    const now=ctx.currentTime;
    if(kind==='tap'){
      const o=ctx.createOscillator(), g=ctx.createGain();
      o.type='sine'; o.frequency.setValueAtTime(520, now); o.frequency.exponentialRampToValueAtTime(660, now+0.06);
      g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.09, now+0.01); g.gain.exponentialRampToValueAtTime(0.0001, now+0.14);
      o.connect(g); g.connect(ctx.destination); o.start(now); o.stop(now+0.16);
    }else if(kind==='whoosh'){
      const o=ctx.createOscillator(), g=ctx.createGain();
      o.type='triangle'; o.frequency.setValueAtTime(300, now); o.frequency.exponentialRampToValueAtTime(760, now+0.28);
      g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.11, now+0.05); g.gain.exponentialRampToValueAtTime(0.0001, now+0.4);
      o.connect(g); g.connect(ctx.destination); o.start(now); o.stop(now+0.42);
      const o2=ctx.createOscillator(), g2=ctx.createGain();
      o2.type='sine'; o2.frequency.setValueAtTime(523, now+0.12); o2.frequency.setValueAtTime(784, now+0.24);
      g2.gain.setValueAtTime(0.0001, now+0.12); g2.gain.exponentialRampToValueAtTime(0.08, now+0.16); g2.gain.exponentialRampToValueAtTime(0.0001, now+0.5);
      o2.connect(g2); g2.connect(ctx.destination); o2.start(now+0.12); o2.stop(now+0.52);
    }
  }catch(e){}
}

async function openFortReport(){
  const data=await _computeMyFortnight();
  if(!data){ showToast('No completed fortnight yet'); return; }
  const board=await _buildLeaderboard(data.fw);
  const m=data.mine, fw=data.fw;

  const slides=[];
  slides.push({kind:'hero', label:'Fortnight report', big:'Your two weeks', sub:fw.period});

  if(m.measuredDays>0){
    slides.push({label:'Rostered shifts you worked', big:m.measuredDays+'', sub:'clocked-in shift'+(m.measuredDays===1?'':'s')+' this fortnight'});
    slides.push({label:'On time', big:(data.onTimePct!=null?data.onTimePct+'%':'\u2014'),
      sub:(m.measuredDays-m.lateDays)+' of '+m.measuredDays+' shifts \u00b7 arriving early counts as on time'});
    if(m.lateDays>0){
      slides.push({label:'Late starts', big:m.lateDays+'', sub:'shift'+(m.lateDays===1?'':'s')+' after your rostered start'});
      slides.push({kind:'timelost', label:'Time lost to lateness', big:data.lostStr,
        totalMin:m.totalLateMin, worstMin:m.worstMin, worstDay:m.worstDay});
    }else{
      slides.push({label:'Late starts', big:'0', sub:'a flawless fortnight'});
    }
  }else{
    slides.push({label:'Punctuality', big:'\u2014', sub:'no rostered shifts worked this fortnight'});
  }
  if(m.measuredDays>=_PUNCT_MIN_DAYS && m.score===100){
    const k=window.glowSkinFor?window.glowSkinFor(me):'gold';
    slides.push({kind:'achieve', label:'Achievement unlocked', skin:((window.GLOW_SKINS||[]).indexOf(k)>=0?k:'gold'), name:me});
  }
  if(data.streak && (data.streak.current>0 || data.streak.best>0)){
    const cur=data.streak.current, best=data.streak.best;
    let sub;
    if(cur>0 && cur===best && cur>1) sub='your best run yet \u2014 keep it going';
    else if(cur>0) sub='consecutive rostered shift'+(cur===1?'':'s')+' clocked in'+(best>cur?' \u00b7 best: '+best:'');
    else sub='best run: '+best+' shift'+(best===1?'':'s')+' \u2014 start a new one';
    slides.push({kind:'streak', label:'Work streak', big:(cur>0?'\uD83D\uDD25 '+cur:'0'), sub:sub});
  }

  if(data.improvement && data.improvement.delta>0){
    const imp=data.improvement;
    slides.push({label:'Most improved', big:'+'+imp.delta+' pts',
      sub:'on-time rate up from '+imp.prev+'% to '+imp.cur+'% since last fortnight'});
  }

  slides.push({label:'Leave taken', big:data.myFortLeaves+'', sub:data.myFortLeaves===0?'no leave this fortnight':'approved request'+(data.myFortLeaves===1?'':'s')});

  const amend=data.amendedCount||0, auto=data.autoCount||0;
  if(amend>0 || auto>0){
    let sub;
    if(amend>0 && auto>0) sub='clock time'+(amend===1?'':'s')+' fixed up by an admin, plus '+auto+' auto clock-out'+(auto===1?'':'s')+'. Doesn\u2019t affect your score.';
    else if(amend>0) sub='of your clock times were added or amended by an admin. Doesn\u2019t affect your score.';
    else sub='auto clock-out'+(auto===1?'':'s')+' when you forgot. Doesn\u2019t affect your score.';
    slides.push({label:'Fun fact', big:(amend>0?amend:auto)+'', sub:sub});
  }

  slides.push({kind:'leaderboard', board:board, label:'On-Time Club'});

  slides.push({kind:'thanks', big:'Thank you', sub:'for your presence at the workplace this week.'});

  let bd=document.getElementById('fortShow'); if(bd) bd.remove();
  bd=document.createElement('div');
  bd.id='fortShow';
  bd.className='fr-back';

  let idx=0;
  const svgCal='<svg class="fr-svg" viewBox="0 0 48 48" fill="none" stroke="#6b6f86" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect class="d1" x="8" y="10" width="32" height="30" rx="4"/><path class="d2" d="M8 18h32"/><path class="d3" d="M16 6v8M32 6v8"/><path class="d4" d="M16 27l4 4 8-8"/></svg>';
  const svgStar='<svg class="fr-svg" viewBox="0 0 48 48" fill="none" stroke="#3a9e78" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path class="d1" d="M24 7L28.7 17.5L40.2 18.7L31.6 26.5L34 37.8L24 32L14 37.8L16.4 26.5L7.8 18.7L19.3 17.5z"/><path class="d4" d="M18 24l4 4 8-8"/></svg>';

  function slideInner(s){
    if(s.kind==='leaderboard'){
      const club=(s.board||[]).filter(function(b){ return b.measuredDays>=_PUNCT_MIN_DAYS && b.score>=_CLUB_SILVER; })
        .slice().sort(function(a,b){ return b.score-a.score || b.onTimeDays-a.onTimeDays || String(a.name).localeCompare(String(b.name)); });
      const rows=club.length? club.slice(0,8).map(function(b,i){
        const isMe=b.name===me;
        const isGold=b.score>=_CLUB_GOLD;
        const disc=isGold?'#efa927':'#c2c1ba', ring=isGold?'#633806':'#4a4a46';
        const dot='<div class="fr-lb-rank" style="background:transparent;padding:0;width:20px;height:20px;display:flex;align-items:center;justify-content:center;">'+
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M8.5 2h3l-2.2 7h-3z" fill="'+ring+'"/><path d="M15.5 2h-3l2.2 7h3z" fill="'+ring+'"/><circle cx="12" cy="15" r="6.5" fill="'+disc+'"/><circle cx="12" cy="15" r="2.6" fill="'+ring+'" opacity=".55"/></svg></div>';
        return '<div class="fr-lb-row fr-stagger'+(isMe?' me':'')+'" style="--d:'+(i*70)+'ms;">'+
          dot+
          '<div class="fr-lb-name">'+esc(b.name)+(isMe?' (you)':'')+'</div>'+
          '<div class="fr-lb-score">'+b.score+'%</div>'+
        '</div>';
      }).join('') : '<div class="fr-muted">No On-Time Club members this fortnight \u2014 next one\u2019s yours.</div>';
      return '<div class="fr-label">'+s.label+'</div><div class="fr-lb">'+rows+'</div>';
    }
    if(s.kind==='timelost'){
      let context='';
      const h=s.totalMin/60;
      if(h>=7.6) context='about '+(Math.round(h/7.6*10)/10)+' full shifts';
      else if(h>=3.8) context='most of a shift';
      else if(s.totalMin>=60) context='over an hour';
      else context='across the fortnight';
      const worst = s.worstMin ? (s.worstDay+' was the latest, '+s.worstMin+' min after your start') : '';
      return '<div class="fr-label">'+s.label+'</div>'+
        '<div class="fr-timelost">'+
          '<svg class="fr-tl-ic" width="30" height="30" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="13" r="8" fill="none" stroke="#e24b4a" stroke-width="2"/><path d="M12 9v4.5" stroke="#e24b4a" stroke-width="2" stroke-linecap="round"/><path d="M9.5 3h5" stroke="#e24b4a" stroke-width="2" stroke-linecap="round"/><path d="M15.5 6.5l1.5-1.5" stroke="#e24b4a" stroke-width="2" stroke-linecap="round"/></svg>'+
          '<div class="fr-tl-big">'+s.big+'</div>'+
          '<div class="fr-tl-ctx">'+context+' not at your desk</div>'+
        '</div>'+
        (worst?'<div class="fr-sub" style="margin-top:14px;">'+worst+'</div>':'');
    }
    if(s.kind==='achieve'){
      return '<div class="fr-ach"><canvas class="fr-ach-fx"></canvas>'+
        '<div class="fr-ach-pill">\u2605 '+s.label+'</div>'+
        '<div class="fr-ach-name glow-name glow-'+s.skin+'">'+esc(s.name)+'</div>'+
        '<div class="fr-sub">You earned a glowing name \u2014 a perfect fortnight, every shift on time.</div></div>';
    }
    if(s.kind==='hero'){
      return '<div class="fr-icon fr-draw">'+svgCal+'</div><div class="fr-label">'+s.label+'</div><div class="fr-hero">'+s.big+'</div><div class="fr-sub">'+s.sub+'</div>';
    }
    if(s.kind==='thanks'){
      return '<div class="fr-confetti">'+Array.from({length:16}).map(function(_,i){return '<span style="--i:'+i+';"></span>';}).join('')+'</div>'+
        '<div class="fr-icon fr-draw">'+svgStar+'</div><div class="fr-hero fr-thanks-title">'+s.big+'</div><div class="fr-thanks-sub">'+s.sub+'</div>';
    }
    const isNum = /^\d+%?$/.test(s.big);
    const bigHtml = isNum
      ? '<div class="fr-big fr-count" data-target="'+parseInt(s.big,10)+'" data-suffix="'+(s.big.indexOf('%')>=0?'%':'')+'">0'+(s.big.indexOf('%')>=0?'%':'')+'</div>'
      : '<div class="fr-big">'+s.big+'</div>';
    return '<div class="fr-label">'+s.label+'</div>'+bigHtml+(s.sub?'<div class="fr-sub">'+s.sub+'</div>':'');
  }
  function runCountUp(el){
    const target=parseInt(el.getAttribute('data-target'),10)||0;
    const suffix=el.getAttribute('data-suffix')||'';
    if(target<=0){ el.textContent='0'+suffix; return; }
    const dur=650, t0=performance.now();
    function step(now){
      const p=Math.min((now-t0)/dur,1);
      const eased=1-Math.pow(1-p,3);
      el.textContent=Math.round(target*eased)+suffix;
      if(p<1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function paint(playSound){
    const s=slides[idx];
    const card=bd.querySelector('.fr-card');
    card.setAttribute('data-kind', s.kind||'stat');
    const inner=bd.querySelector('#frInner');
    _fortAchieveStop();
    inner.style.animation='none'; void inner.offsetWidth; inner.style.animation='';
    inner.innerHTML=slideInner(s);
    if(s.kind==='achieve') _fortAchieveFx(inner);
    const cnt=inner.querySelector('.fr-count'); if(cnt) runCountUp(cnt);
    bd.querySelector('#frDots').innerHTML=slides.map(function(_,i){return '<span class="'+(i===idx?'on':'')+'"></span>';}).join('');
    bd.querySelector('#frNext').textContent = idx===slides.length-1 ? 'Done' : 'Next';
    bd.querySelector('#frPrev').style.visibility = idx===0 ? 'hidden' : 'visible';
    if(playSound){ _fortSound(idx===slides.length-1 ? 'whoosh' : 'tap'); }
  }
  function next(){ if(idx<slides.length-1){ idx++; paint(true); } else { closeFortReport(); } }
  function prev(){ if(idx>0){ idx--; paint(true); } }

  bd.innerHTML=
    '<div class="fr-card" data-kind="hero">'+
      '<button id="frClose" aria-label="Close" class="fr-close">\u00d7</button>'+
      '<div id="frDots" class="fr-dots"></div>'+
      '<div id="frInner" class="fr-inner"></div>'+
      '<div class="fr-nav">'+
        '<button id="frPrev" class="fr-btn-ghost">Back</button>'+
        '<button id="frNext" class="fr-btn-solid">Next</button>'+
      '</div>'+
    '</div>';
  document.body.appendChild(bd);
  document.body.style.overflow='hidden';
  bd.querySelector('#frClose').onclick=closeFortReport;
  bd.querySelector('#frNext').onclick=next;
  bd.querySelector('#frPrev').onclick=prev;
  bd.querySelector('#frInner').onclick=next;
  bd.onclick=function(e){ if(e.target===bd) closeFortReport(); };
  paint(false);
}

let _fortAchRaf=0;
function _fortAchieveStop(){ if(_fortAchRaf){ cancelAnimationFrame(_fortAchRaf); _fortAchRaf=0; } }
function _fortAchieveFx(root){
  const cv=root.querySelector('.fr-ach-fx'); if(!cv) return;
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box=cv.parentNode, dpr=Math.min(window.devicePixelRatio||1,2);
  const W=box.clientWidth||320, H=box.clientHeight||200;
  cv.width=W*dpr; cv.height=H*dpr;
  const g=cv.getContext('2d'); g.scale(dpr,dpr);
  const cols=['#e6b422','#fff2c2','#fbbf24','#ffffff'];
  const ps=Array.from({length:46},function(){ return { x:Math.random()*W, y:H*Math.random(), r:1+Math.random()*2.2, v:.35+Math.random()*.9, p:Math.random()*6.28, c:cols[(Math.random()*cols.length)|0] }; });
  function frame(t){
    g.clearRect(0,0,W,H);
    ps.forEach(function(q){
      q.y-=q.v; if(q.y<-6){ q.y=H+6; q.x=Math.random()*W; }
      g.globalAlpha=.25+.75*Math.abs(Math.sin(t/420+q.p)); g.fillStyle=q.c;
      g.beginPath(); g.arc(q.x+Math.sin(t/900+q.p)*6,q.y,q.r,0,6.283); g.fill();
    });
    _fortAchRaf=requestAnimationFrame(frame);
  }
  _fortAchRaf=requestAnimationFrame(frame);
}

function closeFortReport(){
  _fortAchieveStop();
  const bd=document.getElementById('fortShow');
  if(bd){ bd.classList.add('closing'); setTimeout(function(){ bd.remove(); }, 180); }
  document.body.style.overflow='';
}

let _leaderboardCache=null;
async function _buildLeaderboard(fw){
  if(_leaderboardCache) return _leaderboardCache;
  const rosterBy=await _loadRosterShifts(fw);
  if(!Object.keys(rosterBy).length) return null;

  let allLeave=[], allLogs=[];
  try{ allLeave=await sbGet('leave_submissions','?status=eq.approved&select=staff_name,from_date,to_date,status&limit=2000')||[]; }catch(e){}
  try{ allLogs=await sbGet('clock_log','?ts=gte.'+fw.startIso+'&ts=lt.'+fw.endIso+'&select=staff_name,action,ts&order=ts.asc&limit=5000')||[]; }catch(e){}

  const leaveBy={}, logsBy={};
  allLeave.forEach(function(l){ (leaveBy[l.staff_name]=leaveBy[l.staff_name]||[]).push(l); });
  allLogs.forEach(function(r){ (logsBy[r.staff_name]=logsBy[r.staff_name]||[]).push(r); });

  const board=[];
  Object.keys(rosterBy).forEach(function(nm){
    const res=_computePunctuality(rosterBy[nm], logsBy[nm]||[], leaveBy[nm]||[], fw.start, fw.end);
    if(res.measuredDays>0){
      board.push({ name:nm, score:res.score, onTimeDays:res.onTimeDays, measuredDays:res.measuredDays, lateDays:res.lateDays, leaveDays:res.leaveDays, absentDays:res.absentDays });
    }
  });
  board.sort(_hofSort);
  _leaderboardCache=board;
  _writeFortnightHistory(fw, board);
  return board;
}













function goToOnboarding(){
  const overlay=document.getElementById('onboardLockOverlay');
  if(overlay)overlay.style.display='none';
  goTo('schedule');
  setTimeout(function(){
    if(typeof showSchedTab==='function') showSchedTab('availability');
  },60);
}



async function recheckOnboarding(){
  try{
    const avail=await sbGet('staff_availability','?staff_name=eq.'+encodeURIComponent(me)+'&order=updated_at.desc&limit=5');
    const hasAvail=_hasValidAvailability(avail);
    const overlay=document.getElementById('onboardLockOverlay');
    if(hasAvail){
      if(overlay)overlay.dataset.locked='';
      dismissOnboardLock();
      sessionStorage.setItem('onboard_checked_'+me,'done');
      if(typeof maybeShowTour==='function') maybeShowTour();
    } else {
      showOnboardLock(true,true,false,(Array.isArray(avail)&&avail.length>0));
    }
  }catch(e){}
}










let _wwStaffData = [];

async function loadWhosWorking(){
  return;
  const card = document.getElementById('whoWorkingCard');
  const list = document.getElementById('whoWorkingList');
  const cnt = document.getElementById('wwOnlineCount');
  if(!card || !list){ return; }



  try{
    const since = new Date(Date.now() - 30*3600*1000).toISOString();
    const myToday = await sbGet('clock_log','?staff_name=eq.'+encodeURIComponent(me)+'&ts=gte.'+encodeURIComponent(since)+'&order=ts.asc&limit=20');
    let amIIn = false;
    if(myToday && myToday.length){
      const sorted = myToday.slice().sort(function(a,b){ return (a.ts||'').localeCompare(b.ts||''); });
      const lastAction = sorted[sorted.length-1].action || sorted[sorted.length-1].type;
      amIIn = lastAction === 'in';
    }
    if(!amIIn && !myIsAdmin){
      card.style.display = 'none';
      return;
    }
    card.style.display = '';
  }catch(e){ console.warn('[ww] my status check failed:', e); card.style.display = 'none'; return; }

  try{
    const since = new Date(Date.now() - 30*3600*1000).toISOString();
    const allToday = await sbGet('clock_log','?ts=gte.'+encodeURIComponent(since)+'&order=ts.asc&limit=500');
    
    const latestAction = {};
    (allToday||[]).forEach(function(r){
      const act = r.action || r.type;
      if(act === 'in' || act === 'out'){
        latestAction[r.staff_name] = act;
      }
    });
    const onlineStaff = Object.keys(latestAction).filter(function(s){
      return latestAction[s] === 'in';
    });
    onlineStaff.sort();
    
    _wwStaffData = onlineStaff;
    cnt.textContent = onlineStaff.length;
    try{
      const teamRows = await sbGet('staff_credentials','?select=staff_name,team&staff_name=in.('+onlineStaff.map(function(n){return '"'+n.replace(/"/g,'\\"')+'"';}).join(',')+')');
      _wwTeams = {};
      (teamRows||[]).forEach(function(r){ if(r.team) _wwTeams[r.staff_name] = r.team; });
    }catch(e){ _wwTeams = {}; }
    renderWwFilters();
    renderWhosWorking(_wwStaffData);
  }catch(e){
    list.innerHTML = '<div class="ww-empty">Could not load team list.</div>';
  }
}

let _wwTeams = {};
let _wwActiveTeam = 'all';

function renderWwFilters(){
  const el = document.getElementById('wwTeamFilters');
  if(!el) return;
  const teams = [...new Set(Object.values(_wwTeams).filter(Boolean))].sort();
  if(!teams.length){ el.innerHTML = ''; el.style.display = 'none'; return; }
  el.style.display = 'flex';
  let html = '<button class="ww-chip'+(_wwActiveTeam==='all'?' active':'')+'" onclick="setWwTeam(\'all\')">All</button>';
  teams.forEach(function(t){
    html += '<button class="ww-chip'+(_wwActiveTeam===t?' active':'')+'" onclick="setWwTeam(\''+t.replace(/'/g,"\\'")+'\')">'+t+'</button>';
  });
  el.innerHTML = html;
}

function setWwTeam(t){
  _wwActiveTeam = t;
  renderWwFilters();
  filterWhosWorking();
}

function renderWhosWorking(names){
  const list = document.getElementById('whoWorkingList');
  if(!list) return;
  if(!names || !names.length){
    list.innerHTML = '<div class="ww-empty">No one else is clocked in right now.</div>';
    return;
  }
  const palette = ['#1e293b','#0f172a','#334155','#475569','#1e3a8a','#1e40af'];
  let html = '';
  names.forEach(function(n,i){
    const initials = String(n||'').split(/\s+/).map(function(p){return p[0]||'';}).join('').slice(0,2).toUpperCase();
    const bg = palette[i % palette.length];
    html += '<div class="ww-card">'+
      '<div class="ww-avatar" style="background:'+bg+'">'+initials+'</div>'+
      '<div class="ww-name">'+(n === me ? 'You' : n)+'</div>'+
    '</div>';
  });
  list.innerHTML = html;
}

function filterWhosWorking(){
  const qEl = document.getElementById('wwSearch');
  const q = qEl ? qEl.value.toLowerCase().trim() : '';
  let filtered = _wwStaffData.slice();
  if(_wwActiveTeam && _wwActiveTeam !== 'all'){
    filtered = filtered.filter(function(n){ return _wwTeams[n] === _wwActiveTeam; });
  }
  if(q){
    filtered = filtered.filter(function(n){ return String(n).toLowerCase().includes(q); });
  }
  renderWhosWorking(filtered);
}

