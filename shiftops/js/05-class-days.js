// ── CLASS DAYS (admin) — ported from Nexus ──────────────────────
function _cdEsc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function _cdStaffNames(){ return (staff||[]).map(s=>(s.first+' '+s.last).trim()).filter(Boolean).sort(); }
async function _cdGet(path){ try{ const r=await fetch(SUPABASE_URL+'/rest/v1/'+path,{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY}}); return r.ok?await r.json():[]; }catch(e){ return []; } }
const _CD_H={apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY};
const _CD_HJ={..._CD_H,'Content-Type':'application/json'};

// ── CLASS DAYS list: upcoming first, older dates tucked away ─────────────
// Upcoming class days (today and later) are shown soonest-first with a "Next" marker
// and how far away each is. Past days are history — reshuffle and auto-fill only ever
// touch upcoming days — so they sit behind a toggle that stays collapsed until asked.
let _cdRows = [];
let _cdPastOpen = (function(){ try{ return localStorage.getItem('so_cd_past_open') === '1'; }catch(e){ return false; } })();
function _cdDayDiff(dateStr){
  const t = _todayIsoSydney().split('-').map(Number), p = String(dateStr).split('-').map(Number);
  return Math.round((Date.UTC(p[0],p[1]-1,p[2]) - Date.UTC(t[0],t[1]-1,t[2])) / 86400000);
}
function _cdRel(n){
  if(n === 0) return 'Today';
  if(n === 1) return 'Tomorrow';
  if(n === -1) return 'Yesterday';
  return n > 0 ? 'in ' + n + ' days' : Math.abs(n) + ' days ago';
}
function _cdLabel(dateStr, withYear){
  const d = new Date(dateStr + 'T00:00:00');
  const o = {weekday:'short', day:'numeric', month:'short'};
  if(withYear || d.getFullYear() !== new Date().getFullYear()) o.year = 'numeric';
  return d.toLocaleDateString('en-AU', o);
}
async function loadClassDays(){
  const list = document.getElementById('classDayList');
  if(!list) return;
  if(!list.children.length) list.innerHTML = '<div class="cd-msg">Loading class days\u2026</div>';
  const rows = await _cdGet('class_days?select=class_date&order=class_date.desc&limit=60');
  _cdRows = rows || [];
  _cdRender();
}
function toggleCdPast(){
  _cdPastOpen = !_cdPastOpen;
  try{ localStorage.setItem('so_cd_past_open', _cdPastOpen ? '1' : '0'); }catch(e){}
  _cdRender();
}
function _cdRender(){
  const list = document.getElementById('classDayList');
  if(!list) return;
  if(!_cdRows.length){ list.innerHTML = '<div class="cd-msg">No class days marked yet.</div>'; return; }
  const today = _todayIsoSydney();
  const up = _cdRows.filter(function(r){ return r.class_date >= today; })
                    .sort(function(a,b){ return a.class_date < b.class_date ? -1 : 1; });
  const past = _cdRows.filter(function(r){ return r.class_date < today; })
                      .sort(function(a,b){ return a.class_date < b.class_date ? 1 : -1; });
  const chip = function(r, cls){
    const n = _cdDayDiff(r.class_date), lbl = _cdLabel(r.class_date);
    return '<div class="cd-chip' + cls + '">' +
      '<div class="cd-chip-main"><span class="cd-chip-date">' + lbl + '</span>' +
      '<span class="cd-chip-rel">' + _cdRel(n) + '</span></div>' +
      '<button type="button" class="cd-chip-x" onclick="removeClassDay(\'' + r.class_date + '\')" aria-label="Remove ' + lbl + '" title="Remove this class day">Remove</button>' +
    '</div>';
  };
  let h = '';
  if(up.length){
    const n0 = _cdDayDiff(up[0].class_date);
    h += '<div class="cd-sum"><span class="cd-sum-k">Next class day</span> ' +
         '<b>' + _cdLabel(up[0].class_date) + '</b> <span class="cd-sum-rel">' + _cdRel(n0) + '</span>' +
         '<span class="cd-sum-n">' + up.length + ' upcoming' + (past.length ? ' \u00b7 ' + past.length + ' past' : '') + '</span></div>';
    h += up.map(function(r, i){ return chip(r, i === 0 ? ' cd-next' : ''); }).join('');
  }else{
    h += '<div class="cd-sum cd-sum-none">No upcoming class days \u2014 add one above.' +
         (past.length ? '<span class="cd-sum-n">' + past.length + ' past</span>' : '') + '</div>';
  }
  if(past.length){
    h += '<button type="button" class="cd-toggle' + (_cdPastOpen ? ' open' : '') + '" aria-expanded="' + _cdPastOpen + '" aria-controls="cdPast" onclick="toggleCdPast()">' +
         '<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>' +
         'Past class days <span class="cd-toggle-n">' + past.length + '</span>' +
         '<span class="cd-toggle-hint">' + (_cdPastOpen ? 'Hide' : 'Show') + '</span></button>' +
         '<div class="cd-past" id="cdPast"' + (_cdPastOpen ? '' : ' hidden') + '>' +
         past.map(function(r){ return chip(r, ' cd-old'); }).join('') + '</div>';
  }
  list.innerHTML = h;
}
async function addClassDay(){
  const inp=document.getElementById('classDayInput');
  if(!inp||!inp.value){ showToast('Pick a date'); return; }
  try{
    await fetch(SUPABASE_URL+'/rest/v1/class_days',{method:'POST',headers:{..._CD_HJ,'Prefer':'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({class_date:inp.value})});
    inp.value=''; showToast('Class day added'); loadClassDays();
    try{ loadHousekeeping(); }catch(e){}   // the roster fills itself for the new day straight away
  }catch(e){ showToast('Could not add (maybe already exists)'); }
}
async function removeClassDay(dateStr){
  // Removing a class day does not remove its housekeeping roster, so say so.
  if(!confirm('Remove ' + _cdLabel(dateStr, true) + ' as a class day?\n\nIts housekeeping roster stays until you remove those names.')) return;
  try{
    await fetch(SUPABASE_URL+'/rest/v1/class_days?class_date=eq.'+encodeURIComponent(dateStr),{method:'DELETE',headers:{..._CD_H,'Prefer':'return=minimal'}});
    showToast('Removed'); loadClassDays();
  }catch(e){ showToast('Remove failed'); }
}

// ── CLASS HOUSEKEEPING ROSTER ──────────────────────
// Auto-generated: one person from each duty team per class day, plus the
// housekeeping head who oversees every session. Picks people who are available
// that day AND who actually stay past cleanup time (judged from their real
// clock-outs), rotating fairly so turns are shared.
// Placement is deliberately absent: the housekeeping head (HK_HEAD) is a
// Placement member, so the team already has someone on every session.
// Adding a second would give Placement two people while others get one.
const HK_TEAMS = ['Enrolment','Processing','Evershine','Education'];
// The Speaker oversees every class day — always rostered, and kept out of their
// own team's rotation so that team's other members still take proper turns.
// Stored in app_settings (key hk_speaker) so an admin can change who it is;
// falls back to this default if the setting is missing.
const HK_SPEAKER_DEFAULT = 'Muhammad Faizan Azim';
let _hkSpeaker = null;
async function _hkGetSpeaker(){
  if(_hkSpeaker) return _hkSpeaker;
  try{
    const rows = await _cdGet("app_settings?key=eq.hk_speaker&select=value");
    _hkSpeaker = (rows && rows.length && rows[0].value) ? rows[0].value : HK_SPEAKER_DEFAULT;
  }catch(e){ _hkSpeaker = HK_SPEAKER_DEFAULT; }
  return _hkSpeaker;
}
let _hkTeamMap=null;

async function _hkLoadTeams(){
  if(_hkTeamMap) return _hkTeamMap;
  const map={};
  try{
    const rows=await _cdGet('staff_credentials?select=staff_name,team');
    rows.forEach(function(r){ if(r.team) map[r.staff_name]=r.team; });
  }catch(e){ console.warn('hk teams',e); }
  _hkTeamMap=map;
  return map;
}

// Excluded people (opt-out) — kept so an admin can still exclude someone via
// the housekeeping_pool table if ever needed.
async function _hkExcluded(){
  const out=new Set();
  try{
    (await _cdGet('housekeeping_pool?select=staff_name,active')).forEach(function(r){
      if(r.active===false) out.add(_normName(r.staff_name));
    });
  }catch(e){}
  return out;
}

// Names on approved leave covering a given ISO date.
async function _hkOnLeave(dateStr){
  const out=new Set();
  try{
    const rows=await _cdGet('leave_submissions?select=staff_name,from_date,to_date,status');
    rows.forEach(function(r){
      if(String(r.status||'').toLowerCase()!=='approved') return;
      const f=r.from_date||'', t=r.to_date||f;
      if(f && dateStr>=f && dateStr<=t) out.add(_normName(r.staff_name));
    });
  }catch(e){ console.warn('hk leave',e); }
  return out;
}

// Class runs to ~5:00–5:30pm and housekeeping takes 15–20 min, so whoever is
// assigned must still be on site until at least this time.
const HK_MIN_END_MIN = 17*60 + 50;   // 17:50

// ── Task allocation, balanced by TIME rather than turns ──────────────
// Chairs (10 min) is over twice the work of water (4-5 min), so equal turns
// isn't equal effort: someone can draw chairs twice in a fortnight while a
// colleague draws water twice — an 11-minute gap. Sorting on cumulative
// minutes holds the spread to ~2 min at any point instead.
//
// The bin (1 min) rides with equipment rather than consuming a person, and
// that is what frees the fifth slot so chairs gets the two it wants.
// Heaviest task first, so it goes to whoever is most owed.
// Two orderings that were previously conflated:
//   essential — how many of a task's slots survive when short-staffed.
//               Water is "needed x2"; the second chairs slot is only
//               "preferable", so that is what drops first.
//   mins      — assignment order, heaviest first, so the biggest job goes to
//               whoever is most owed.
// The bin (1 min) rides with one of the WATER slots rather than equipment.
// Water is the lightest job, so it absorbs the extra minute with the least
// distortion: 10 / 6 / 5.5 / 4.5 instead of 10 / 7 / 4.5 / 4.5.
//
// Order here is survival priority — the first `essential` slots of each task
// are what remain when short-staffed, in this order. The second chairs slot
// is the only optional one, so it drops first.
const HK_TASKS = [
  // Two chairs slots (the second is optional, so it drops first when short-staffed): the Speaker now
  // shares the rotation, so a full day is five people and Chairs is the heaviest job.
  { key:'chairs',    label:'Chairs, boards, papers & pens',   slots:2, mins:10,  essential:1 },
  { key:'equipment', label:"Bed lifter & trainer's table",    slots:1, mins:6,   essential:1 },
  { key:'waterbin',  label:'Water & lollies + bring the bin back from Evershine',
                                                              slots:1, mins:5.5, essential:1 },
  { key:'water',     label:'Water & lollies',                 slots:1, mins:4.5, essential:1 }
];
const HK_MINS = {}; HK_TASKS.forEach(function(t){ HK_MINS[t.key] = t.mins; });

function _hkTaskLabel(key){
  const t=HK_TASKS.find(function(x){ return x.key===key; });
  return t ? t.label : (key||'');
}
// Short chip labels. 'Equipment' alone hid the fact that the bin rides with
// it — at a glance nobody could tell who was bringing it back.
function _hkTaskShort(key){
  return {chairs:'Chairs', equipment:'Equipment', waterbin:'Water + Bin',
          water:'Water'}[key] || key || '';
}

// Slots for `headcount` people: keep the essential ones, spend any spare
// capacity on the optional extras, then order heaviest-first for assignment.
function _hkTaskSlots(headcount){
  const must=[], extra=[];
  HK_TASKS.forEach(function(t){
    for(var i=0;i<t.slots;i++) (i < t.essential ? must : extra).push(t.key);
  });
  var slots;
  if(headcount==null){
    slots = must.concat(extra);
  }else{
    slots = must.slice(0, headcount);
    for(var j=0; j<extra.length && slots.length<headcount; j++) slots.push(extra[j]);
  }
  return slots.sort(function(a,b){ return HK_MINS[b]-HK_MINS[a]; });
}

// Give each rostered person a specific job. Only COMPLETED duties count
// toward someone's minutes, so being rostered and not doing it leaves you
// owed the time — and up first for the heavy job next class day.
// `shuffle` mirrors _hkPick: when people are equally owed — which is always
// true before any history exists — a deterministic tiebreak hands out the same
// shape every time, so the same person draws water two days running. Jitter
// breaks those ties randomly, giving a genuinely different but equally fair
// split on a reshuffle.
function _hkAssignTasks(picks, hist, shuffle){
  // The Speaker is part of the same rotation as everyone else. Nothing is fixed to them:
  // Chairs (like every other job) goes to whoever is most owed, so it can be anyone on the day.
  const people = picks.slice();
  if(!people.length) return picks;

  // Autofill often builds only the teams that are MISSING — e.g. one slot was
  // cleared and needs refilling. Assigning from scratch for that one person
  // hands them the most-essential slot (water) regardless of what the rest of
  // the day already holds, which is how a day ends up with three waters and no
  // chairs. So: find what's already taken today, and only hand out the rest.
  const dayKey = people[0].duty_date;
  const taken = [];
  (hist || []).forEach(function(h){
    if(h.duty_date !== dayKey || !h.task) return;
    if(h.task === 'speak') return; // legacy value from when the Speaker had a fixed role: not a job slot
    if(picks.some(function(p){ return p.staff_name === h.staff_name; })) return; // being re-picked
    taken.push(h.task);
  });

  const mins = {}, last = {}, jitter = {};
  people.forEach(function(p){
    mins[p.staff_name] = 0; last[p.staff_name] = {};
    jitter[p.staff_name] = shuffle ? Math.random() : 0;
  });
  (hist || []).forEach(function(h){
    if(!h.done || !h.task || mins[h.staff_name] === undefined) return;
    mins[h.staff_name] += (HK_MINS[h.task] || 0);
    const cur = last[h.staff_name][h.task];
    if(!cur || h.duty_date > cur) last[h.staff_name][h.task] = h.duty_date;
  });

  // Full slot list for the day, minus what other people already hold.
  const full = _hkTaskSlots(people.length + taken.length);
  const remaining = full.slice();
  taken.forEach(function(t){
    const i = remaining.indexOf(t);
    if(i > -1) remaining.splice(i, 1);
  });

  const pool = people.slice();
  remaining.forEach(function(task){
    if(!pool.length) return;                 // fewer people than slots
    pool.sort(function(a,b){
      if(mins[a.staff_name] !== mins[b.staff_name])
        return mins[a.staff_name] - mins[b.staff_name];      // least work so far
      const la = (last[a.staff_name]||{})[task] || '';
      const lb = (last[b.staff_name]||{})[task] || '';
      if(la !== lb) return la.localeCompare(lb);             // longest since this job
      if(shuffle) return jitter[a.staff_name] - jitter[b.staff_name];
      return a.staff_name.localeCompare(b.staff_name);
    });
    const pick = pool.shift();
    pick.task = task;
    mins[pick.staff_name] += (HK_MINS[task] || 0);           // count it straight away
  });
  return picks;
}

function _hkToMin(t){
  const m=/^(\d{1,2}):(\d{2})/.exec(String(t||''));
  return m ? (parseInt(m[1],10)*60 + parseInt(m[2],10)) : null;
}

// ── ACTUAL leaving behaviour, from the timesheets ──
// Submitted availability says what people intend; the clock log says what they
// actually do. We read ~10 weeks of class-day (Tue/Wed) clock-outs and rank
// people by how reliably they're still around at cleanup time. Someone who
// habitually leaves at 5pm shouldn't be picked even if their availability
// claims 7pm — and vice versa.
let _hkHabitCache=null;
async function _hkLeavingHabits(){
  if(_hkHabitCache) return _hkHabitCache;
  const habits={};   // normName -> {n, avg, pctBefore6, reliable}
  try{
    const since=new Date(Date.now()-70*24*3600*1000).toISOString();
    const rows=await _cdGet('clock_log?select=staff_name,ts,action&action=eq.out&ts=gte.'+since+'&limit=4000');
    const buckets={};
    (rows||[]).forEach(function(r){
      const d=new Date(r.ts);
      // Sydney local parts
      const syd=new Date(d.toLocaleString('en-US',{timeZone:'Australia/Sydney'}));
      const dow=syd.getDay();             // 0=Sun..6=Sat
      if(dow!==2 && dow!==3) return;      // Tue/Wed = class days
      const mins=syd.getHours()*60+syd.getMinutes();
      const k=_normName(r.staff_name);
      (buckets[k]=buckets[k]||[]).push(mins);
    });
    Object.keys(buckets).forEach(function(k){
      const arr=buckets[k];
      if(arr.length<3) return;            // too little data to judge
      const sum=arr.reduce(function(a,b){return a+b;},0);
      const avg=sum/arr.length;
      const before6=arr.filter(function(m){return m<18*60;}).length;
      habits[k]={n:arr.length, avg:avg, pctBefore6:before6/arr.length};
    });
  }catch(e){ console.warn('hk habits',e); }
  _hkHabitCache=habits;
  return habits;
}

// Tier from actual behaviour: 0 = best (reliably stays), higher = leaves earlier.
// Unknown (too few clock-outs) sits in the middle so new staff still get turns.
function _hkTier(h){
  if(!h) return 2;                        // no history yet
  if(h.avg >= 18*60+45 && h.pctBefore6 <= 0.10) return 0;   // stays till ~7
  if(h.avg >= 18*60) return 1;                              // usually past 6
  if(h.avg >= HK_MIN_END_MIN) return 3;                     // marginal
  return 4;                                                 // habitually early
}

// Who is available late enough on the class date, based on submitted
// availability. Returns three sets:
//   ok        — available and staying late enough
//   tooEarly  — available but leaving before cleanup
//   unavail   — explicitly marked unavailable (or no entry for that day)
// The distinction matters: 'unavail' must never fall through to the
// timesheet-based fallback, or someone who marked the day off gets rostered.
async function _hkAvailableLate(dateStr){
  const ok=new Set(), tooEarly=new Map(), unavail=new Set();
  const d=new Date(dateStr+'T00:00:00');
  const dayIdx=(d.getDay()+6)%7;          // Mon=0..Sun=6
  try{
    const rows=await _cdGet('staff_availability?select=staff_name,availability,is_ongoing,valid_from,valid_until');
    (rows||[]).forEach(function(r){
      if(r.is_ongoing===false){
        if(r.valid_from && dateStr < r.valid_from) return;   // window not started
        if(r.valid_until && dateStr > r.valid_until) return;  // window expired
      }
      const av=r.availability||{};
      const a=av[dayIdx]||av[String(dayIdx)];
      const key=_normName(r.staff_name);
      if(!a){ return; }                    // nothing recorded for that weekday
      if(a.type==='no'){ unavail.add(key); return; }          // explicitly off
      if(a.type==='all'){ ok.add(key); return; }              // 9-7 full day
      if(a.type==='custom'){
        const end=_hkToMin(a.end);
        // Weekend full day is 9–16, so 16:00 is a complete weekend shift — don't
        // apply the weekday 17:50 minimum-end rule to it.
        const isWeekend=(dayIdx===5||dayIdx===6);
        if(isWeekend && a.start==='09:00' && a.end==='16:00'){ ok.add(key); return; }
        if(end!=null && end>=HK_MIN_END_MIN) ok.add(key);
        else if(end!=null) tooEarly.set(key, a.end);
        else unavail.add(key);
        return;
      }
      // 'unset' or anything unrecognised → treat as not offered
    });
  }catch(e){ console.warn('hk avail',e); }
  return {ok:ok, tooEarly:tooEarly, unavail:unavail};
}

// Fair pick within one team. Behaviour (tier) is used as a FILTER upstream —
// habitual early leavers never reach here — so ranking is purely fairness:
// fewest turns so far, then whoever went longest ago.
// IMPORTANT: only duties actually marked done count as a turn. Someone who was
// rostered but didn't do it stays "owed" and comes up again, rather than being
// credited for a turn they never took.
// When `shuffle` is set, people who are equally owed a turn are ordered
// randomly, so a reshuffle gives a genuinely different (still fair) roster.
function _hkPick(eligible, hist, habits, shuffle){
  if(!eligible.length) return null;
  const counts={}, last={};
  eligible.forEach(function(nm){ counts[nm]=0; last[nm]=''; });
  hist.forEach(function(h){
    if(!h.done) return;                       // only completed duties count
    const nm=eligible.find(function(e){ return _normName(e)===_normName(h.staff_name); });
    if(!nm) return;
    counts[nm]++;
    if(!last[nm] || h.duty_date>last[nm]) last[nm]=h.duty_date;
  });
  const jitter={};
  eligible.forEach(function(nm){ jitter[nm]=shuffle?Math.random():0; });
  const sorted=eligible.slice().sort(function(a,b){
    if(counts[a]!==counts[b]) return counts[a]-counts[b];     // fewest turns first
    if(last[a]!==last[b]) return (last[a]||'').localeCompare(last[b]||''); // longest since last
    if(shuffle) return jitter[a]-jitter[b];                   // tie → random
    return a.localeCompare(b);
  });
  return sorted[0];
}

// Build the roster for one class day: one person per team. Returns rows to
// insert. Skips teams already covered.
function _hkBuildDay(dateStr, teams, excl, onLeave, avail, habits, hist, doneTeams, shuffle, speaker){
  const picks=[];
  const SPEAKER = speaker || HK_SPEAKER_DEFAULT;
  // The Speaker oversees every session — rostered unless they're on leave or
  // have marked themselves unavailable that day.
  if(!doneTeams || !doneTeams.has('Speaker')){
    const hk=_normName(SPEAKER);
    if(!onLeave.has(hk) && !avail.unavail.has(hk)){
      picks.push({duty_date:dateStr, staff_name:SPEAKER, team:'Speaker'});
    }
  }
  HK_TEAMS.forEach(function(tm){
    if(doneTeams && doneTeams.has(tm)) return;
    const members=Object.keys(teams).filter(function(nm){ return teams[nm]===tm; });
    const eligible=members.filter(function(nm){
      const key=_normName(nm);
      if(key===_normName(SPEAKER)) return false; // speaker has their own slot
      if(excl.has(key)) return false;            // manually excluded
      if(onLeave.has(key)) return false;         // on approved leave
      if(avail.unavail.has(key)) return false;   // marked unavailable that day
      if(avail.tooEarly.has(key)) return false;  // available but gone before cleanup
      if(_hkTier(habits[key])>=4) return false;  // habitually gone before cleanup
      if(avail.ok.has(key)) return true;         // availability says they're here
      return _hkTier(habits[key])<=1;            // no availability on file → trust timesheets
    });
    const teamHist=hist.filter(function(h){ return h.team===tm; });
    const pick=_hkPick(eligible, teamHist, habits, shuffle);
    if(pick) picks.push({duty_date:dateStr, staff_name:pick, team:tm});
  });
  // Who does what, once we know who is on.
  _hkAssignTasks(picks, hist, shuffle);
  return picks;
}

// Generate (and save) the roster for upcoming class days. Runs automatically on
// load for any day that isn't rostered yet. With shuffle=true it clears the
// upcoming days first and rebuilds them in a different (still fair) order.
async function _hkAutoFill(shuffle){
  const today=_todayIsoSydney();
  let days=[];
  try{ days=(await _cdGet('class_days?select=class_date&class_date=gte.'+today+'&order=class_date.asc&limit=8')).map(function(r){return r.class_date;}); }catch(e){}
  if(!days.length){ _hkLastRun = {shuffled:0, skipped:0}; return; }

  // PUBLISHED days are final: staff can already see them, so no automatic step (reshuffle or
  // gap-filling) may change them. If we can't tell what is published, change nothing.
  let pubSet = null;
  try{
    const pr = await fetch(SUPABASE_URL+'/rest/v1/housekeeping_published?select=duty_date', {headers:_CD_H});
    if(pr.ok) pubSet = new Set((await pr.json()).map(function(x){ return x.duty_date; }));
  }catch(e){ console.warn('hk published', e); }
  if(!pubSet){ _hkLastRun = {error:true}; return; }
  _hkPubDays = pubSet;
  const skipped = days.filter(function(d){ return pubSet.has(d); }).length;
  days = days.filter(function(d){ return !pubSet.has(d); });
  _hkLastRun = {shuffled:days.length, skipped:skipped};
  if(!days.length) return;

  if(shuffle){
    // Rebuild the DRAFT upcoming days. Never a duty already marked done (a record of what
    // happened), and never a published day.
    const keep = Array.from(pubSet).filter(function(d){ return d >= today; });
    try{
      await fetch(SUPABASE_URL+'/rest/v1/housekeeping_roster?duty_date=gte.'+today+
        (keep.length ? '&duty_date=not.in.('+keep.join(',')+')' : '')+'&done=is.false',
        {method:'DELETE',headers:{..._CD_H,'Prefer':'return=minimal'}});
    }catch(e){ console.warn('hk clear',e); }
  }

  let hist=[];
  try{ hist=await _cdGet('housekeeping_roster?select=staff_name,duty_date,team,done,task&order=duty_date.desc&limit=600'); }catch(e){}

  const teams=await _hkLoadTeams();
  const excl=await _hkExcluded();
  const habits=await _hkLeavingHabits();
  const speaker=await _hkGetSpeaker();

  const toInsert=[];
  for(const d of days){
    const done=new Set(hist.filter(function(h){ return h.duty_date===d; }).map(function(h){ return h.team; }));
    if(done.size>=HK_TEAMS.length+1) continue;   // speaker + 4 teams already rostered
    const onLeave=await _hkOnLeave(d);
    const avail=await _hkAvailableLate(d);
    const picks=_hkBuildDay(d, teams, excl, onLeave, avail, habits, hist, done, shuffle, speaker);
    picks.forEach(function(p){
      toInsert.push(p);
      hist.push({staff_name:p.staff_name, duty_date:d, team:p.team, task:p.task, done:true});  // provisionally count (incl. task) so one person isn't picked for every upcoming day, nor handed the same job twice
    });
  }
  if(!toInsert.length) return;
  try{
    await fetch(SUPABASE_URL+'/rest/v1/housekeeping_roster',{method:'POST',
      headers:{..._CD_HJ,'Prefer':'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify(toInsert)});
  }catch(e){ console.warn('hk autofill',e); }
}

async function loadHousekeeping(){
  const box=document.getElementById('hkRosterList');
  if(!box) return;
  box.innerHTML='<div style="font-size:12px;color:var(--text-dim);">Building roster…</div>';
  try{ await _hkAutoFill(); }catch(e){ console.warn('hk',e); }
  await _hkRender();
}

async function _hkRender(){
  const box=document.getElementById('hkRosterList');
  if(!box) return;
  await _hkLoadTeams();   // dropdowns need the team → staff map
  await loadHousekeepingPublished();
  await _hkLoadLastDuty();
  let rows=[];
  try{ rows=await _cdGet('housekeeping_roster?select=id,duty_date,staff_name,team,done,task&order=duty_date.desc&limit=80'); }catch(e){}
  _hkRows=rows;   // copy-to-clipboard reads this rather than refetching
  if(!rows.length){ box.innerHTML='<div style="font-size:12px;color:var(--text-dim);">No class days coming up — add one above and the roster fills itself.</div>'; return; }
  const byDate={};
  rows.forEach(function(r){ (byDate[r.duty_date]=byDate[r.duty_date]||[]).push(r); });
  const today=_todayIsoSydney();
  const _hkKeys=Object.keys(byDate).sort();
  const _hkParts=_hkKeys.map(function(d){
    const dd=new Date(d+'T00:00:00');
    const lbl=dd.toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'short'});
    const upcoming=d>=today;
    const list=byDate[d];
    // Every slot can be filled by ANYONE, not just that team.
    //
    // The dropdown used to list only the slot's own team, so when someone was
    // off sick there was no way to cover their duty from another team — the
    // slot just sat empty or you edited the database. Reality doesn't respect
    // team boundaries at 5:30pm.
    //
    // The slot's own team is still listed FIRST and stays the default, so
    // normal use is unchanged; other teams follow in their own groups, which
    // keeps 33 names scannable.
    const teamOptions=function(tm,current){
      const all=Object.keys(_hkTeamMap||{});
      const own=all.filter(function(nm){ return _hkTeamMap[nm]===tm; }).sort();
      // whoever is currently set must always appear, even if they've since
      // changed team or left the pool
      if(current && all.indexOf(current)===-1) own.unshift(current);
      const opt=function(nm){
        return '<option value="'+_cdEsc(nm)+'"'+(nm===current?' selected':'')+'>'+_cdEsc(nm)+(upcoming?_hkAgoSuffix(nm):'')+'</option>';
      };
      let html='<optgroup label="'+_cdEsc(tm)+'">'+own.map(opt).join('')+'</optgroup>';
      const others={};
      all.forEach(function(nm){
        const t=_hkTeamMap[nm];
        if(t===tm) return;
        (others[t||'Other']=others[t||'Other']||[]).push(nm);
      });
      Object.keys(others).sort().forEach(function(t){
        html+='<optgroup label="'+_cdEsc(t)+'">'+others[t].sort().map(opt).join('')+'</optgroup>';
      });
      return html;
    };
    const rowFor=function(r,label,isHead){
      const tick='<input type="checkbox" '+(r.done?'checked':'')+
        ' onchange="setHousekeepingDone(this,\''+r.id+'\')" title="Tick when they\'ve done it"'+
        ' style="width:15px;height:15px;cursor:pointer;flex-shrink:0;">';
      const picker=isHead
        ? '<select onchange="setHousekeepingSpeaker(this,\''+r.id+'\')" title="Change the Speaker"'+
          ' style="flex:1;min-width:0;border:1px solid var(--border);border-radius:7px;padding:4px 7px;font-size:12.5px;font-weight:700;font-family:inherit;background:var(--input-bg,#fff);color:inherit;cursor:pointer;">'+
          _hkAllStaffOptions(r.staff_name)+
          '</select>'
        : '<select onchange="setHousekeepingPerson(this,\''+r.id+'\')" title="Who actually did it"'+
          ' style="flex:1;min-width:0;border:1px solid var(--border);border-radius:7px;padding:4px 7px;font-size:12.5px;font-weight:600;font-family:inherit;background:var(--input-bg,#fff);color:inherit;cursor:pointer;'+(r.done?'':'opacity:.8;')+'">'+
          teamOptions(r.team, r.staff_name)+
          '</select>';
      return '<div style="display:flex;align-items:center;gap:8px;padding:3px 0;'+(isHead?'padding-bottom:5px;margin-bottom:4px;border-bottom:1px dashed var(--border);':'')+'">'+
        tick+
        '<span style="flex-shrink:0;width:74px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:'+(isHead?'var(--accent,#3d9eff)':'var(--text-dim)')+';">'+label+'</span>'+
        picker+
        // Every row, including the Speaker's, has an editable job: nothing is fixed to the Speaker any more.
        '<select onchange="setHousekeepingTask(this,\''+r.id+'\')" title="'+_cdEsc(_hkTaskLabel(r.task))+'"'+
        ' style="flex-shrink:0;border:1px solid var(--border);border-radius:5px;padding:2px 5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;font-family:inherit;background:var(--accent-dim,rgba(61,158,255,.12));color:var(--accent,#3d9eff);cursor:pointer;">'+
        HK_TASKS.map(function(t){
          return '<option value="'+t.key+'"'+(t.key===r.task?' selected':'')+'>'+_cdEsc(_hkTaskShort(t.key))+'</option>';
        }).join('')+
        (r.task && !HK_TASKS.some(function(t){ return t.key===r.task; })
          ? '<option value="'+_cdEsc(r.task)+'" selected>'+_cdEsc(_hkTaskShort(r.task))+'</option>' : '')+
        '<option value=""'+(r.task?'':' selected')+'>&mdash;</option>'+
        '</select>'+
        // Flag a cover from another team. Without this the roster silently
        // reads "Processing — Santosh" and looks like a mistake, when it's a
        // deliberate substitution.
        (!isHead && r.staff_name && _hkTeamMap[r.staff_name] && _hkTeamMap[r.staff_name]!==r.team
          ? '<span title="Covering for '+_cdEsc(r.team)+' — normally '+_cdEsc(_hkTeamMap[r.staff_name])+'" style="flex-shrink:0;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;padding:2px 6px;border-radius:5px;background:rgba(180,116,10,.14);color:#b4740a;">cover</span>'
          : '')+
        (r.done?'<span style="flex-shrink:0;font-size:10px;font-weight:700;color:#22a06b;">done</span>':'')+
        '<button onclick="removeHousekeeping(\''+r.id+'\')" title="Remove from the roster (does NOT pick a replacement — use Reshuffle for that)" class="hk-x" style="background:none;border:none;cursor:pointer;font-size:15px;line-height:1;padding:0 3px;font-family:inherit;">&times;</button>'+
      '</div>';
    };
    const head=list.find(function(x){ return x.team==='Speaker'; });
    // No Speaker row happens when the usual Speaker is on leave or marked unavailable that
    // day (nobody is auto-picked in their place). Show an empty slot, like the team slots do,
    // so a cover can be chosen for just this day without changing the default Speaker.
    const headRow=head?rowFor(head,'Speaker',true):
      '<div style="display:flex;align-items:center;gap:8px;padding:3px 0;padding-bottom:5px;margin-bottom:4px;border-bottom:1px dashed var(--border);">'+
        '<span style="width:15px;flex-shrink:0;"></span>'+
        '<span style="flex-shrink:0;width:74px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--accent,#3d9eff);">Speaker</span>'+
        '<select onchange="addHousekeepingPerson(this,\''+d+'\',\'Speaker\')" title="No Speaker this day (the usual Speaker is on leave or unavailable). Pick a cover for this day only."'+
        ' style="flex:1;min-width:0;border:1px dashed var(--border2,var(--border));border-radius:7px;padding:4px 7px;font-size:12.5px;font-weight:600;font-family:inherit;background:var(--input-bg,#fff);color:var(--text-dim);cursor:pointer;">'+
          '<option value="">No Speaker \u2014 add a cover for this day\u2026</option>'+
          _hkAllStaffOptions(null)+
        '</select>'+
      '</div>';
    const cells=HK_TEAMS.map(function(tm){
      const r=list.find(function(x){ return x.team===tm; });
      if(r) return rowFor(r,tm,false);
      return '<div style="display:flex;align-items:center;gap:8px;padding:3px 0;">'+
        '<span style="width:15px;flex-shrink:0;"></span>'+
        '<span style="flex-shrink:0;width:74px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--text-dim);">'+tm+'</span>'+
        // Renders whenever a team has no ROW (e.g. after the x). Pick someone to add;
        // each name shows how long ago they last went for class.
        '<select onchange="addHousekeepingPerson(this,\''+d+'\',\''+tm+'\')" title="Add someone to this slot"'+
        ' style="flex:1;min-width:0;border:1px dashed var(--border2,var(--border));border-radius:7px;padding:4px 7px;font-size:12.5px;font-weight:600;font-family:inherit;background:var(--input-bg,#fff);color:var(--text-dim);cursor:pointer;">'+
          '<option value="">Not rostered \u2014 add someone\u2026</option>'+
          teamOptions(tm, null)+
        '</select>'+
      '</div>';
    }).join('');
    const isPub=_hkPubDays.has(d);
    return '<div id="hkday-'+d+'" class="hk-day" style="padding:10px 12px;border-radius:10px;background:var(--surface);border:1px solid var(--border);margin-bottom:8px;'+(upcoming?'':'opacity:.62;')+'">'+
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:5px;">'+
        '<div style="font-size:12.5px;font-weight:800;">'+lbl+(upcoming?'':' <span style="font-weight:500;color:var(--text-dim);">(past)</span>')+'</div>'+
        '<span class="hk-state '+(isPub?'hk-state-pub':'hk-state-draft')+'">'+(isPub?'Published':'Draft')+'</span>'+
        '<div style="flex:1;"></div>'+
        '<button onclick="copyHousekeepingDay(\''+d+'\')" title="Copy this day\'s roster to the clipboard" style="background:none;border:1px solid var(--border);border-radius:6px;color:var(--text-dim);cursor:pointer;font-size:10px;font-weight:700;padding:3px 9px;font-family:inherit;">Copy</button>'+
        (upcoming
          ? '<button onclick="toggleHousekeepingPublish(\''+d+'\')" style="border:1px solid '+(isPub?'var(--border)':'transparent')+';border-radius:6px;cursor:pointer;font-size:10px;font-weight:700;padding:3px 9px;font-family:inherit;'+
            (isPub?'background:none;color:var(--text-dim);':'background:var(--accent,#3d9eff);color:#fff;')+'">'+(isPub?'Unpublish':'Publish')+'</button>'
          : '')+
      '</div>'+headRow+cells+'</div>';
  });
  _hkAssemble(box,_hkKeys,_hkParts,today);
}

// Roster layout: upcoming days first (soonest at the top), older days behind a toggle.
let _hkPastOpen = (function(){ try{ return localStorage.getItem('so_hk_past_open') === '1'; }catch(e){ return false; } })();
function toggleHkPast(){
  _hkPastOpen = !_hkPastOpen;
  try{ localStorage.setItem('so_hk_past_open', _hkPastOpen ? '1' : '0'); }catch(e){}
  const p = document.getElementById('hkPast'), b = document.getElementById('hkPastToggle');
  if(p) p.hidden = !_hkPastOpen;
  if(b){
    b.setAttribute('aria-expanded', String(_hkPastOpen));
    b.classList.toggle('open', _hkPastOpen);
    const hint = b.querySelector('.cd-toggle-hint'); if(hint) hint.textContent = _hkPastOpen ? 'Hide' : 'Show';
  }
}
function _hkAssemble(box, keys, parts, today){
  const up = [], past = [];
  keys.forEach(function(d, i){ (d >= today ? up : past).push(parts[i]); });   // keys arrive oldest-first
  past.reverse();                                                             // past: most recent first
  let h = '';
  if(up.length){
    h += '<div class="hk-h">Upcoming <span>' + up.length + '</span></div>' + up.join('');
  }else{
    h += '<div class="hk-h hk-h-none">Nothing upcoming \u2014 add a class day above and the roster fills itself.</div>';
  }
  if(past.length){
    h += '<button type="button" id="hkPastToggle" class="cd-toggle hk-toggle' + (_hkPastOpen ? ' open' : '') + '" aria-expanded="' + _hkPastOpen + '" aria-controls="hkPast" onclick="toggleHkPast()">' +
         '<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>' +
         'Past days <span class="cd-toggle-n">' + past.length + '</span>' +
         '<span class="cd-toggle-hint">' + (_hkPastOpen ? 'Hide' : 'Show') + '</span></button>' +
         '<div class="hk-past" id="hkPast"' + (_hkPastOpen ? '' : ' hidden') + '>' + past.join('') + '</div>';
  }
  box.innerHTML = h;
}

// ── Who has been to class lately ──────────────────────────────────────────
// When choosing someone for an upcoming day it helps to know how long ago they last did class
// housekeeping. Only duties ticked DONE count (same rule the fairness rotation uses).
let _hkLast = {};          // normalised name -> date of the last duty they actually did
let _hkLastRun = null;     // what the last automatic fill did: {shuffled, skipped} or {error}
async function _hkLoadLastDuty(){
  try{
    const rows = await _cdGet('housekeeping_roster?select=staff_name,duty_date&done=is.true&order=duty_date.desc&limit=1000');
    const m = {};
    (rows || []).forEach(function(r){ const k = _normName(r.staff_name); if(!m[k]) m[k] = r.duty_date; });
    _hkLast = m;
  }catch(e){ console.warn('hk last duty', e); }
}
function _hkAgoDays(nm){
  const d = _hkLast[_normName(nm)];
  return d ? Math.max(0, -_cdDayDiff(d)) : null;
}
function _hkAgoShort(n){
  if(n <= 0) return 'today';
  if(n === 1) return 'yesterday';
  if(n < 7) return n + 'd ago';
  if(n < 60) return Math.floor(n / 7) + 'w ago';
  if(n < 365) return Math.round(n / 30) + 'mo ago';
  return '1y+ ago';
}
function _hkAgoSuffix(nm){
  const n = _hkAgoDays(nm);
  return ' \u00b7 ' + (n === null ? 'no class yet' : _hkAgoShort(n));
}
function _hkAgoLong(nm){
  const n = _hkAgoDays(nm);
  if(n === null) return 'no class housekeeping yet';
  const when = n === 0 ? 'today' : n === 1 ? 'yesterday' : n < 14 ? n + ' days ago' : n < 60 ? Math.floor(n / 7) + ' weeks ago' : Math.round(n / 30) + ' months ago';
  return 'last class ' + when + ' (' + _cdLabel(_hkLast[_normName(nm)]) + ')';
}

// Put someone into an empty slot. Gets the job the day still needs (the same fair rule as
// auto-fill); it can be changed from the job dropdown afterwards.
async function addHousekeepingPerson(sel, d, team){
  const nm = sel.value;
  if(!nm) return;
  if((_hkRows || []).some(function(r){ return r.duty_date === d && r.team === team; })){
    showToast('That slot is already filled'); _hkRender(); return;
  }
  let task = null;
  try{
    const pk = [{duty_date:d, staff_name:nm, team:team}];
    _hkAssignTasks(pk, _hkRows || [], false);
    task = pk[0].task || null;
  }catch(e){}
  try{
    const r = await fetch(SUPABASE_URL+'/rest/v1/housekeeping_roster',
      {method:'POST', headers:{..._CD_HJ,'Prefer':'return=minimal'}, body:JSON.stringify({duty_date:d, staff_name:nm, team:team, task:task})});
    if(!r.ok) throw new Error('HTTP ' + r.status);
    showToast(nm.split(' ')[0] + ' added' + (task ? ' \u2014 ' + _hkTaskShort(task) : '') + ' \u00b7 ' + _hkAgoLong(nm));
    _hkRender();
  }catch(e){ console.warn('hk add', e); showToast('Add failed'); _hkRender(); }
}

/* ── Task, copy and publish ───────────────────────────────────────────── */

// Which days staff can see. Absence of a row = draft.
let _hkPubDays = new Set();
let _hkRows = [];

async function loadHousekeepingPublished(){
  try{
    const rows=await _cdGet('housekeeping_published?select=duty_date');
    _hkPubDays=new Set((rows||[]).map(function(r){ return r.duty_date; }));
  }catch(e){ console.warn('loadHousekeepingPublished', e); }
}

async function toggleHousekeepingPublish(d){
  const pub=_hkPubDays.has(d);
  try{
    if(pub){
      const r=await fetch(SUPABASE_URL+'/rest/v1/housekeeping_published?duty_date=eq.'+encodeURIComponent(d),
        {method:'DELETE',headers:{..._CD_HJ,'Prefer':'return=minimal'}});
      if(!r.ok) throw new Error('HTTP '+r.status);
      _hkPubDays.delete(d);
      showToast('Hidden from staff again');
    }else{
      const r=await fetch(SUPABASE_URL+'/rest/v1/housekeeping_published',{
        method:'POST',
        headers:{..._CD_HJ,'Prefer':'resolution=merge-duplicates,return=representation'},
        body:JSON.stringify({duty_date:d,
          published_by:(typeof currentUser!=='undefined'&&currentUser)?currentUser:null})
      });
      if(!r.ok) throw new Error('HTTP '+r.status);
      const rows=await r.json().catch(function(){return null;});
      if(!rows||!rows.length) throw new Error('nothing written');
      _hkPubDays.add(d);
      showToast('Published — staff can see this day');
    }
  }catch(e){
    console.warn('toggleHousekeepingPublish', e);
    showToast('Could not update — check connection');
  }
  _hkRender();
}

// Change the job assigned to a slot.
async function setHousekeepingTask(sel, id){
  const task=sel.value||null;
  try{
    await fetch(SUPABASE_URL+'/rest/v1/housekeeping_roster?id=eq.'+encodeURIComponent(id),
      {method:'PATCH',headers:{..._CD_HJ,'Prefer':'return=minimal'},body:JSON.stringify({task:task})});
    showToast(task?(_hkTaskShort(task)+' assigned'):'Job cleared');
    _hkRender();
  }catch(e){ showToast('Save failed'); _hkRender(); }
}

/**
 * Copy a day's roster as plain text for pasting into a group chat.
 *
 * Deliberately WITHOUT team names — staff need to know who is doing what,
 * and prefixing every line with "Enrolment"/"Processing" just makes the
 * message longer and invites "why am I under Processing?" when someone is
 * covering for another team.
 */
function copyHousekeepingDay(d){
  const list=(_hkRows||[]).filter(function(r){ return r.duty_date===d; });
  if(!list.length){ showToast('Nothing to copy'); return; }
  const dt=new Date(d+'T00:00:00');
  const lines=[dt.toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long'})];
  const head=list.find(function(x){ return x.team==='Speaker'; });
  if(head && head.staff_name) lines.push(head.staff_name+' — Speaker'+(head.task && head.task!=='speak' ? ', '+_hkTaskLabel(head.task) : ''));
  HK_TEAMS.forEach(function(tm){
    const r=list.find(function(x){ return x.team===tm; });
    if(!r || !r.staff_name) return;
    lines.push(r.staff_name + (r.task && r.task!=='speak' ? ' — '+_hkTaskLabel(r.task) : ''));
  });
  const text=lines.join('\n');
  const done=function(){ showToast('Copied'); };
  const fallback=function(){
    // Clipboard API needs a secure context and permission; a hidden textarea
    // works everywhere and is worth keeping as a fallback.
    try{
      const ta=document.createElement('textarea');
      ta.value=text; ta.style.position='fixed'; ta.style.opacity='0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      done();
    }catch(e){ showToast('Copy failed'); }
  };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(done).catch(fallback);
  }else fallback();
}

// Change who actually did the housekeeping for a slot.
async function setHousekeepingPerson(sel, id){
  const nm=sel.value;
  try{
    await fetch(SUPABASE_URL+'/rest/v1/housekeeping_roster?id=eq.'+encodeURIComponent(id),
      {method:'PATCH',headers:{..._CD_HJ,'Prefer':'return=minimal'},body:JSON.stringify({staff_name:nm})});
    const _row=(_hkRows||[]).find(function(x){ return x.id===id; });
    const _upcoming=_row && _row.duty_date >= _todayIsoSydney();
    showToast(nm.split(' ')[0]+' recorded'+(_upcoming ? ' — '+_hkAgoLong(nm) : ''));
    _hkRender();
  }catch(e){ showToast('Save failed'); _hkRender(); }
}

// All staff, as <option>s, for the Speaker picker (selected = current speaker).
function _hkAllStaffOptions(current){
  const names=_cdStaffNames();
  if(current && names.indexOf(current)<0) names.unshift(current);
  return names.map(function(nm){
    return '<option value="'+_cdEsc(nm)+'"'+(nm===current?' selected':'')+'>'+_cdEsc(nm)+'</option>';
  }).join('');
}

// Change the Speaker. Updates this day's row AND saves the new default to
// app_settings so future class days use the new Speaker too.
async function setHousekeepingSpeaker(sel, id){
  const nm=sel.value;
  if(!nm) return;
  try{
    // 1. This day's Speaker row.
    await fetch(SUPABASE_URL+'/rest/v1/housekeeping_roster?id=eq.'+encodeURIComponent(id),
      {method:'PATCH',headers:{..._CD_HJ,'Prefer':'return=minimal'},body:JSON.stringify({staff_name:nm})});
    // 2. Persist as the default Speaker for future days.
    await fetch(SUPABASE_URL+'/rest/v1/app_settings',
      {method:'POST',headers:{..._CD_HJ,'Prefer':'resolution=merge-duplicates,return=minimal'},
       body:JSON.stringify({key:'hk_speaker', value:nm, updated_at:new Date().toISOString()})});
    _hkSpeaker=nm;   // refresh cache so autofill uses the new Speaker
    showToast('Speaker set to '+nm.split(' ')[0]);
    _hkRender();
  }catch(e){ showToast('Save failed'); _hkRender(); }
}

// Tick/untick who actually did the housekeeping. Only completed duties count
// toward the fairness rotation, so an unticked person stays "owed" a turn.
async function setHousekeepingDone(cb, id){
  const val=cb.checked;
  try{
    await fetch(SUPABASE_URL+'/rest/v1/housekeeping_roster?id=eq.'+encodeURIComponent(id),
      {method:'PATCH',headers:{..._CD_HJ,'Prefer':'return=minimal'},body:JSON.stringify({done:val})});
    showToast(val?'Marked done':'Unmarked');
    _hkRender();
  }catch(e){ showToast('Save failed'); cb.checked=!val; }
}

// Rebuild the upcoming roster with a different (still fair) arrangement.
async function reshuffleHousekeeping(){
  if(!confirm('Reshuffle the upcoming housekeeping roster?\n\nThis replaces who is assigned on upcoming class days that are still drafts. Published days and past days are not touched.')) return;
  const btn=document.getElementById('hkShuffleBtn');
  if(btn){ btn.disabled=true; btn.textContent='Reshuffling…'; }
  const box=document.getElementById('hkRosterList');
  if(box) box.innerHTML='<div style="font-size:12px;color:var(--text-dim);">Reshuffling…</div>';
  try{
    await _hkAutoFill(true);
    const _r = _hkLastRun || {};
    if(_r.error) showToast('Couldn\u2019t check which days are published \u2014 nothing was changed');
    else if(!_r.shuffled) showToast(_r.skipped ? 'All upcoming days are published \u2014 nothing to reshuffle' : 'No upcoming class days to reshuffle');
    else showToast('Roster reshuffled' + (_r.skipped ? ' \u00b7 ' + _r.skipped + ' published day' + (_r.skipped > 1 ? 's' : '') + ' left as they were' : ''));
  }catch(e){ console.warn('hk reshuffle',e); showToast('Reshuffle failed'); }
  if(btn){ btn.disabled=false; btn.textContent='Reshuffle'; }
  // re-render without re-running autofill
  await _hkRender();
}

async function removeHousekeeping(id){  try{
    await fetch(SUPABASE_URL+'/rest/v1/housekeeping_roster?id=eq.'+encodeURIComponent(id),{method:'DELETE',headers:{..._CD_H,'Prefer':'return=minimal'}});
    showToast('Removed'); loadHousekeeping();
  }catch(e){ showToast('Remove failed'); }
}

// ── PER-DATE CLASS EXCEPTIONS ──────────────────────
function showAvailTab(tab){
  ['edit','submitted','classdays'].forEach(s=>{
    const sec=document.getElementById('availsec-'+s);
    const t=document.getElementById('subtab-avail-'+s);
    if(sec)sec.style.display=s===tab?'block':'none';
    if(t)t.classList.toggle('active',s===tab);
  });
  if(tab==='submitted')loadSubmittedAvailability().then(function(){ try{ applyTeamLeadLock(); }catch(e){} });
  if(tab==='classdays'){loadClassDays();try{loadHousekeeping();}catch(e){}}
}

let submittedAvailData=[];

// Render one 7-day availability grid. When `compareTo` is supplied, any day
// that differs from it is outlined so admins can see exactly what changed.
function _availDaysDiffer(a,b){
  a=a||{type:'unset'}; b=b||{type:'unset'};
  if(a.type!==b.type) return true;
  if(a.type==='custom') return (a.start!==b.start)||(a.end!==b.end);
  return false;
}
function _renderAvailGrid(avObj,compareTo){
  const DAYS_SHORT=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  let h='<div class="sa-grid">';
  DAYS_SHORT.forEach(function(day,i){
    const a=avObj[i]||avObj[String(i)]||{type:'unset'};
    let changed=false;
    if(compareTo){ const b=compareTo[i]||compareTo[String(i)]||{type:'unset'}; changed=_availDaysDiffer(a,b); }
    const c=_av2Cell(a,i);
    h+='<div class="sa-day '+c.cls+(changed?' sa-changed':'')+'"><span class="sa-d">'+day+'</span>'+c.html+'</div>';
  });
  return h+'</div>';
}

async function loadSubmittedAvailability(){
  const el=document.getElementById('submittedAvailContent');
  if(!el)return;
  el.innerHTML='<div style="text-align:center;padding:32px;color:var(--text-dim);font-size:13px;">Loading...</div>';
  try{
    const rows=await fetch(
      `${SUPABASE_URL}/rest/v1/staff_availability?select=*,availability_reviewed_at&order=updated_at.desc.nullslast`,
      {headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`}}
    ).then(r=>r.ok?r.json():[]);

    // Upcoming one-off weeks, grouped by person (ignore weeks that have fully passed).
    const _ooBy={};
    try{
      const _t=new Date(); _t.setHours(0,0,0,0); _t.setDate(_t.getDate()-((_t.getDay()+6)%7));
      const _cut=_t.getFullYear()+'-'+String(_t.getMonth()+1).padStart(2,'0')+'-'+String(_t.getDate()).padStart(2,'0');
      const _or=await fetch(`${SUPABASE_URL}/rest/v1/availability_oneoffs?select=staff_name,week_start,availability,updated_at&week_start=gte.${_cut}&order=week_start.asc`,
        {headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`}});
      if(_or.ok) (await _or.json()).forEach(function(o){ (_ooBy[String(o.staff_name).toLowerCase()]=_ooBy[String(o.staff_name).toLowerCase()]||[]).push(o); });
    }catch(e){}

    if(!rows.length){
      el.innerHTML='<div style="text-align:center;padding:48px;color:var(--text-dim);"><div style="font-size:36px;margin-bottom:12px;"></div><div style="font-size:14px;font-weight:600;">No availability submitted yet</div><div style="font-size:12px;margin-top:6px;color:var(--muted);">Staff submit availability via the Employee Portal</div></div>';
      return;
    }

    // Sort newest-first by the most recent activity on each row. The server
    // order handles the common case, but a row's freshest signal can be
    // pending_set_at (a future-dated change) rather than updated_at, and some
    // legacy rows may not have had updated_at bumped — so re-sort client-side
    // on the max of both to guarantee the newest change is always on top.
    const _recency = r => Math.max(
      r.updated_at ? new Date(r.updated_at).getTime() : 0,
      r.pending_set_at ? new Date(r.pending_set_at).getTime() : 0
    );
    rows.sort((a,b) => _recency(b) - _recency(a));

    submittedAvailData=rows;
    const DAYS_SHORT=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const today=new Date();today.setHours(0,0,0,0);

    let html='<div class="sa-list">';

    let _needsReviewCount=0;
    rows.forEach(row=>{
      const av=row.availability||{};
      const pend=row.pending_availability||null;
      const hasPending=!!(pend&&row.pending_from);
      // Needs review = staff changed availability after we last marked it
      // reviewed. A future-dated pending submission counts too: its updated_at
      // may be old (only pending_set_at moved), so check that as well —
      // otherwise pending changes stay invisible until they promote.
      const _rev=row.availability_reviewed_at?new Date(row.availability_reviewed_at).getTime():0;
      const _upd=row.updated_at?new Date(row.updated_at).getTime():0;
      const _pset=row.pending_set_at?new Date(row.pending_set_at).getTime():0;
      const _oos=_ooBy[String(row.staff_name).toLowerCase()]||[];
      const _ooUpd=_oos.reduce(function(m,o){ return Math.max(m,o.updated_at?new Date(o.updated_at).getTime():0); },0);
      const needsReview=(_upd>_rev)||(hasPending&&_pset>_rev)||(_ooUpd>_rev);
      if(needsReview)_needsReviewCount++;
      const _nameEsc=String(row.staff_name).replace(/'/g,"\\'").replace(/"/g,'&quot;');
      // Period label
      let period='Ongoing';
      let periodCls='';
      if(row.is_ongoing===false){
        if(row.valid_from&&row.valid_until){
          period='From '+row.valid_from+' – '+row.valid_until;
          // Check if expired
          const until=new Date(row.valid_until+'T00:00:00');
          if(today>until){period+=' (expired)';periodCls=' sa-expired';}
        } else if(row.valid_from){
          period='From '+row.valid_from;
        }
      }

      const _lastTouch = Math.max(
        row.updated_at ? new Date(row.updated_at).getTime() : 0,
        row.pending_set_at ? new Date(row.pending_set_at).getTime() : 0,
        _ooUpd
      );
      const updated=_lastTouch ? new Date(_lastTouch).toLocaleString('en-AU',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}):'';

      const s=staff.find(x=>`${x.first} ${x.last}`.toLowerCase()===row.staff_name.toLowerCase());
      const _cardTeam=(s&&s.team)?String(s.team).replace(/"/g,'&quot;'):'';
      html+='<div class="sa-card" data-team="'+_cardTeam+'" data-availcard="'+_nameEsc+'">';
      const color=s?s.color:'#667';
      const ava=row.staff_name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      html+='<div class="sa-hd"><div class="sa-who">'+
              '<div class="avatar sa-ava" style="background:'+color+'">'+ava+'<span data-availdot class="sa-dot" style="display:'+(needsReview?'block':'none')+'"></span></div>'+
              '<div class="sa-id"><div class="sa-name">'+row.staff_name+'</div><div class="sa-period'+periodCls+'">'+period+'</div></div></div>'+
            '<div class="sa-meta">'+
              '<div data-availreview class="sa-review" style="display:'+(needsReview?'flex':'none')+'"><span class="sa-changed-tag">Changed</span>'+
              '<button class="btn btn-ghost sa-mark" onclick="markAvailReviewed(\''+_nameEsc+'\',this)">Mark reviewed</button></div>'+
              (updated?'<span class="sa-upd">Updated '+updated+'</span>':'')+
            '</div></div>';

      // Current (live) grid. If there's a pending change, label this as current.
      if(hasPending){
        html+='<div class="sa-sub">Current</div>';
      }
      html+=_renderAvailGrid(av,null);

      // Pending (future-dated) grid — the change that hasn't taken effect yet.
      if(hasPending){
        const _pf=row.pending_from;
        let _pfLabel=_pf;
        try{ _pfLabel=new Date(_pf+'T00:00:00').toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'}); }catch(e){}
        html+='<div class="sa-sub sa-sub-new">New from '+_pfLabel+' <span>· highlighted days change</span></div>';
        html+=_renderAvailGrid(pend,av);
      }
      _oos.forEach(function(o){
        let _wl=o.week_start;
        try{ _wl=new Date(o.week_start+'T00:00:00').toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'}); }catch(e){}
        const _oav={}; Object.keys(o.availability||{}).forEach(function(k){ _oav[parseInt(k)]=o.availability[k]; });
        html+='<div class="sa-sub sa-sub-new">One-off · week of '+_wl+' <span>· this week only, then usual hours resume</span></div>';
        html+=_renderAvailGrid(_oav,av);
      });
      html+='</div>';
    });

    html+='</div>';
    el.innerHTML=html;
    setAvailBadge(_needsReviewCount);
  }catch(e){
    console.warn(e);
    el.innerHTML='<div style="color:var(--warn);text-align:center;padding:32px;">Could not load submitted availability.</div>';
  }
}

// Show the count of staff whose availability changed since last reviewed.
function setAvailBadge(n){
  const b=document.getElementById('availNavBadge');
  if(!b)return;
  if(n>0){ b.textContent=n; b.style.display='inline-block'; }
  else { b.style.display='none'; }
}

// Mark one staff's availability as reviewed: stamp reviewed_at=now, clear their dot.
async function markAvailReviewed(name,btn){
  if(btn)btn.disabled=true;
  try{
    const r=await fetch(
      `${SUPABASE_URL}/rest/v1/staff_availability?staff_name=eq.`+encodeURIComponent(name),
      {method:'PATCH',
       headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json','Prefer':'return=minimal'},
       body:JSON.stringify({availability_reviewed_at:new Date().toISOString()})}
    );
    if(!r.ok)throw new Error('patch '+r.status);
    // Clear this card's UI
    const card=document.querySelector('[data-availcard="'+String(name).replace(/"/g,'&quot;')+'"]');
    if(card){
      card.style.borderColor='var(--border)';
      const dot=card.querySelector('[data-availdot]'); if(dot)dot.style.display='none';
      const rev=card.querySelector('[data-availreview]'); if(rev)rev.style.display='none';
    }
    // Decrement badge
    const b=document.getElementById('availNavBadge');
    if(b&&b.style.display!=='none'){
      const n=Math.max(0,(parseInt(b.textContent,10)||1)-1);
      setAvailBadge(n);
    }
    if(typeof showToast==='function')showToast('Marked reviewed');
  }catch(e){
    console.warn(e);
    if(btn)btn.disabled=false;
    if(typeof showToast==='function')showToast('Could not mark reviewed');
  }
}


