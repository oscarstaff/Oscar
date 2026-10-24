let _staffDirData = [];

async function ensureStaffDirData(force){
  if(!force && _staffDirData && _staffDirData.length) return _staffDirData;
  const [names, creds, settings, quizAccess, quizResults, passedCustom, passedTraining, punctHistory, callMs, teamMoveRows] = await Promise.all([
    sbGet('staff_names','?order=name.asc'),
    sbGet('staff_credentials','?select=staff_name,team,pronouns'),
    sbGet('staff_settings','?select=name,is_hub_admin'),
    myIsAdmin ? sbGet('quiz_access','?quiz_id=eq.checklist_v1') : Promise.resolve([]),
    myIsAdmin ? sbGet('training_quiz_results','?quiz_id=eq.checklist_v1&order=created_at.desc') : Promise.resolve([]),
    sbGet('custom_quiz_results','?select=staff_name,quiz_id&passed=is.true'),
    sbGet('training_quiz_results','?select=staff_name,quiz_id&passed=is.true'),
    sbGet('punctuality_history','?select=staff_name,score,x,fort_start&order=fort_start.desc&limit=2000'),
    sbGet('call_milestones','?select=staff_name,milestone'),
    sbGet('staff_team_history','?select=staff_name,from_team,to_team,changed_at&order=changed_at.desc&limit=500')
  ]);
  const quizAccessSet = new Set((quizAccess||[]).map(function(q){return q.staff_name;}));
  const quizResultMap = {};
  (quizResults||[]).forEach(function(r){ if(!quizResultMap[r.staff_name]) quizResultMap[r.staff_name] = r; });
  window._sdQuizAccess = quizAccessSet;
  window._sdQuizResults = quizResultMap;
  const passedSets = {};
  function _addPass(r){
    if(!r || !r.staff_name || !r.quiz_id) return;
    (passedSets[r.staff_name] = passedSets[r.staff_name] || new Set()).add(r.quiz_id);
  }
  (passedCustom||[]).forEach(_addPass);
  (passedTraining||[]).forEach(_addPass);
  const trainingCountMap = {};
  Object.keys(passedSets).forEach(function(nm){ trainingCountMap[nm] = passedSets[nm].size; });
  window._sdTrainingCount = trainingCountMap;
  const tierMap = {};
  (punctHistory||[]).forEach(function(r){
    if(!r || !r.staff_name || tierMap[r.staff_name]) return;
    const days = Number(r.x)||0, sc = Number(r.score)||0;
    let tier = null;
    if(days >= 4 && sc >= 90) tier = 'gold';
    else if(days >= 4 && sc >= 80) tier = 'silver';
    tierMap[r.staff_name] = { tier: tier, score: sc, days: days, fort: String(r.fort_start||'').slice(0,10) };
  });
  window._sdPunctTier = tierMap;
  const callMsMap = {};
  (callMs||[]).forEach(function(r){
    if(!r || !r.staff_name) return;
    const m=Number(r.milestone)||0;
    if(m > (callMsMap[r.staff_name]||0)) callMsMap[r.staff_name]=m;
  });
  const teamMoves={};
  (teamMoveRows||[]).forEach(function(r){ if(r&&r.staff_name){ (teamMoves[r.staff_name]=teamMoves[r.staff_name]||[]).push(r); } });
  const credMap={};
  (creds||[]).forEach(function(c){ credMap[c.staff_name]=c; });
  const settMap={};
  (settings||[]).forEach(function(s){ settMap[s.name]=s; });
  _staffDirData = (names||[]).map(function(n){
    const nm=n.name;
    const c=credMap[nm]||{};
    const s=settMap[nm]||{};
    return {
      staff_name: nm,
      team: c.team||'',
      pronouns: c.pronouns||'',
      is_admin: s.is_hub_admin===true,
      training_count: trainingCountMap[nm]||0,
      punct: tierMap[nm]||null,
      call_milestone: callMsMap[nm]||0,
      team_moves: teamMoves[nm]||[]
    };
  }).filter(function(p){return p.staff_name;});
  try{ await loadGlowData(); }catch(e){}
  return _staffDirData;
}

async function viewStaffProfileByName(name){
  try{ await ensureStaffDirData(); }catch(e){}
  openProfilePage(name);
}

let _pvReturnPage = 'home';

async function openProfilePage(name){
  try{ await ensureStaffDirData(); }catch(e){}
  const p=_staffDirData.find(function(x){return x.staff_name===name;}) || {staff_name:name};
  const cur=document.querySelector('.page.active');
  _pvReturnPage = (cur && cur.id) ? cur.id.replace('page-','') : 'home';
  const ov=document.getElementById('staffProfileViewOverlay'); if(ov) ov.style.display='none';
  const dov=document.getElementById('staffDirectoryOverlay'); if(dov) dov.style.display='none';

  const ava=document.getElementById('pvAva');
  const img=window.avatarFor&&window.avatarFor(name);
  if(img){ ava.textContent=''; ava.style.backgroundImage='url('+img+')'; ava.style.backgroundSize='cover'; ava.style.backgroundPosition='center'; }
  else { ava.style.backgroundImage=''; ava.textContent=name.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase(); }
  const _nick=(window.nicknameFor?window.nicknameFor(name):null);
  const _hasNick=!!_nick;
  const _nameHtml=renderStaffName(name, esc, name)
    + (_hasNick ? '<span style="font-size:14px;font-weight:600;font-style:italic;color:var(--ui-ink-4,#94a3b8);margin-left:8px;">aka &ldquo;'+esc(_nick)+'&rdquo;</span>' : '');
  document.getElementById('pvName').innerHTML=_nameHtml+(window.achBadgesInline?window.achBadgesInline(name,{size:16}):'');
  const tEl=document.getElementById('pvTitle');
  if(window.isEliteCaller && window.isEliteCaller(name)){ tEl.textContent='The Call-Handler'; tEl.style.display='block'; }
  else tEl.style.display='none';
  const team=document.getElementById('pvTeam');
  if(p.team){ team.textContent=p.team+' team'; team.style.display='inline-block'; } else team.style.display='none';
  const pr=document.getElementById('pvPronouns');
  if(p.pronouns){ pr.textContent=p.pronouns; pr.style.display='inline-block'; } else pr.style.display='none';
  const role=document.getElementById('pvRole');
  if(p.is_admin){ role.innerHTML=(window.adminIcon?window.adminIcon(15):'Admin'); role.style.display='inline-flex'; } else role.style.display='none';
  try{ _pvPaintPersonality(p, name); }catch(e){ console.warn('profile paint', e); }
  const achHtml=(typeof buildAchievementsRows==='function')?buildAchievementsRows(p):'';
  const achCard=document.getElementById('pvAchCard');
  const achList=document.getElementById('pvAchList');
  const noAch=document.getElementById('pvNoAch');
  if(achHtml){ achList.innerHTML=achHtml; achCard.style.display='block'; noAch.style.display='none'; }
  else { achList.innerHTML=''; achCard.style.display='none'; noAch.style.display='block'; }
  const bioCard=document.getElementById('pvBioCard');
  const bioEl=document.getElementById('pvBio');
  bioCard.style.display='none';
  try{
    const rows=await sbGet('staff_credentials','?staff_name=eq.'+encodeURIComponent(name)+'&select=bio,show_bio&limit=1');
    if(rows && rows.length){
      const bio=(rows[0].bio||'').trim();
      const show=rows[0].show_bio!==false;
      if(bio && (name===me || show)){ bioEl.textContent=bio; bioCard.style.display='block'; }
    }
  }catch(e){}
  goTo('profile-view');
}

function closeProfilePage(){
  goTo(_pvReturnPage || 'home');
}

async function openStaffDirectory(){
  document.getElementById('staffDirectoryOverlay').style.display='flex';
  document.getElementById('staffDirList').innerHTML='<div style="text-align:center;color:var(--ui-ink-4,#94a3b8);padding:32px;font-size:13px;">'+nxSkel('list',6)+'</div>';
  const _bb = document.getElementById('sdQuizBulkBar');
  if(_bb) _bb.style.display = "none";
  try{
    await ensureStaffDirData(true);
    console.log('[directory] loaded', _staffDirData.length, 'staff');
    renderStaffDirectory(_staffDirData);
  }catch(e){
    console.warn('[directory] error:', e);
    document.getElementById('staffDirList').innerHTML='<div style="text-align:center;color:#dc2626;padding:32px;font-size:13px;">Could not load directory</div>';
  }
}

function closeStaffDirectory(){
  document.getElementById('staffDirectoryOverlay').style.display='none';
  const s=document.getElementById('staffDirSearch');if(s)s.value='';
}

function _punctPeriod(fort){
  const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(fort||'')); if(!m) return 'last fortnight';
  const a=new Date(+m[1],+m[2]-1,+m[3]), b=new Date(+m[1],+m[2]-1,+m[3]+13);
  const f=function(d){ return d.getDate()+' '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]; };
  return f(a)+' \u2013 '+f(b);
}
function _tierMedal(fill, ring){
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;display:block;">'+
    '<path d="M8.5 2h3l-2.2 7h-3z" fill="'+ring+'"/>'+
    '<path d="M15.5 2h-3l2.2 7h3z" fill="'+ring+'"/>'+
    '<circle cx="12" cy="15" r="6.5" fill="'+fill+'"/>'+
    '<circle cx="12" cy="15" r="6.5" fill="none" stroke="'+ring+'" stroke-width="1.5"/>'+
    '<circle cx="12" cy="15" r="2.6" fill="'+ring+'" opacity=".55"/></svg>';
}
function _achRow(visual, title, sub, bg, bd){
  return '<div style="display:flex;align-items:center;gap:11px;padding:9px 12px;border-radius:10px;'+
    'background:'+(bg||'#f8fafc')+';border:1px solid '+(bd||'#eef2f7')+';">'+
    '<div style="flex-shrink:0;display:flex;align-items:center;justify-content:center;">'+visual+'</div>'+
    '<div style="min-width:0;"><div style="font-size:13px;font-weight:700;color:var(--ui-ink,#0f172a);line-height:1.2;">'+title+'</div>'+
    (sub?'<div style="font-size:11px;color:var(--ui-ink-4,#94a3b8);margin-top:2px;">'+sub+'</div>':'')+'</div></div>';
}

const _ACH_ICONS = {
  cap:  '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2 1 6l9 4 7.36-3.27V11a1 1 0 1 0 1 0V6L10 2Z"/><path d="M4 10.3V13c0 1.66 2.69 3 6 3s6-1.34 6-3v-2.7l-6 2.67-6-2.67Z"/></svg>',
  phone:'<svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/></svg>',
  medal:'<svg viewBox="0 0 20 20" fill="currentColor"><path d="M7 1h2l-1.4 4.5h-2zM11 1h2l1.4 4.5h-2z"/><circle cx="10" cy="13" r="5.2"/><circle cx="10" cy="13" r="2.1" fill="rgba(255,255,255,.55)"/></svg>',
  star: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 1.5l2.6 5.27 5.82.845-4.21 4.105.994 5.795L10 14.77l-5.204 2.735.994-5.795L1.58 7.615l5.82-.845z"/></svg>'
};

function buildAchievementBadges(p){
  const badges=[];
  if(window.hasEarnedGlow && window.hasEarnedGlow(p.staff_name)){
    const skin=(window.glowSkinFor?window.glowSkinFor(p.staff_name):'gold');
    const skinLabel=(window.GLOW_SKIN_LABELS&&window.GLOW_SKIN_LABELS[skin])||skin;
    const elite=window.isEliteCaller && window.isEliteCaller(p.staff_name);
    badges.push({
      cls:'flow flow-emerald',
      inner:_ACH_ICONS.star,
      title: elite ? 'The Call-Handler' : 'Perfect Fortnight',
      sub:   elite ? 'Elite glow — 1000 calls logged' : (skinLabel+' glow earned')
    });
  }
  const top=Number(p.call_milestone)||0;
  if(top>=1000){
    badges.push({ cls:'flow flow-emerald', inner:(_ACH_ICONS.medal||_ACH_ICONS.phone), title:'The Call-Handler', sub:'Elite — 1000 calls logged' });
  } else {
    [{t:100, cls:'flow flow-blue', sub:'Call volume milestone'},
     {t:500, cls:'flow flow-gold', sub:'Gold — consistent dedication'}].forEach(function(k){
      if(top<k.t) return;
      badges.push({ cls:k.cls, inner:_ACH_ICONS.phone, title:k.t+' Calls Logged', sub:k.sub });
    });
  }
  if(p.punct && p.punct.tier){
    const isGold=p.punct.tier==='gold';
    badges.push({
      cls: isGold?'solid-gold':'solid-slate',
      inner:_ACH_ICONS.medal,
      title:(isGold?'Gold':'Silver')+' — On-Time Club',
      sub:_punctPeriod(p.punct.fort)+' · '+p.punct.score+'% on time ('+(p.punct.days||'?')+' days)'
    });
  }
  if(p.training_count>0){
    badges.push({
      cls:'solid-green',
      inner:'<span class="ach-num">'+p.training_count+'</span>',
      title:p.training_count+' Training'+(p.training_count===1?'':'s')+' Passed',
      sub:'Completed assigned quizzes'
    });
  }
  return badges;
}

function renderProfileBadges(p){
  const strip=document.getElementById('svProfBadges');
  const pop=document.getElementById('svBadgePop');
  const noAch=document.getElementById('svProfNoAch');
  if(!strip) return;
  const badges=buildAchievementBadges(p);
  if(pop) pop.style.display='none';
  if(!badges.length){
    strip.style.display='none'; strip.innerHTML='';
    if(noAch) noAch.style.display='block';
    return;
  }
  if(noAch) noAch.style.display='none';
  window._svBadgeData=badges;
  strip.innerHTML=badges.map(function(b,i){
    return '<button class="ach-badge '+b.cls+'" data-i="'+i+'" onclick="showBadgeInfo('+i+')" '+
      'aria-label="'+(b.title||'').replace(/"/g,'')+'">'+b.inner+'</button>';
  }).join('');
  strip.style.display='flex';
}

function showBadgeInfo(i){
  const badges=window._svBadgeData||[];
  const b=badges[i]; if(!b) return;
  const pop=document.getElementById('svBadgePop');
  const t=document.getElementById('svBadgePopTitle');
  const s=document.getElementById('svBadgePopSub');
  const strip=document.getElementById('svProfBadges');
  if(strip){ strip.querySelectorAll('.ach-badge').forEach(function(el){
    el.classList.toggle('sel', String(el.getAttribute('data-i'))===String(i)); }); }
  const already = pop && pop.style.display!=='none' && t && t.textContent===b.title;
  if(already){ pop.style.display='none';
    if(strip) strip.querySelectorAll('.ach-badge').forEach(function(el){el.classList.remove('sel');});
    return; }
  if(t) t.textContent=b.title||'';
  if(s) s.textContent=b.sub||'';
  if(pop) pop.style.display='block';
}



const _PV_THEMES = {
  'Enrolment':  {a:'#0ea5e9', b:'#6366f1'},
  'Processing': {a:'#f97316', b:'#db2777'},
  'Placement':  {a:'#10b981', b:'#0ea5e9'},
  'Evershine':  {a:'#8b5cf6', b:'#ec4899'},
  'Accounts':   {a:'#334155', b:'#b45309'},
  'Education':  {a:'#4f46e5', b:'#06b6d4'},
  'Office':     {a:'#0f766e', b:'#65a30d'}
};
function _pvTheme(team){ return _PV_THEMES[team] || {a:'#059669', b:'#7c3aed'}; }

function _pvKnownFor(p){
  const t=[];
  const elite=window.isEliteCaller&&window.isEliteCaller(p.staff_name);
  const calls=Number(p.call_milestone)||0, tr=Number(p.training_count)||0;
  if(elite) t.push({t:'The Call-Handler', c:'#047857', bg:'#ecfdf5', bd:'#a7f3d0'});
  else if(calls>=500) t.push({t:'Phone legend', c:'#92400e', bg:'#fffbeb', bd:'#fde68a'});
  else if(calls>=100) t.push({t:'Dial-ready', c:'#1d4ed8', bg:'#eff6ff', bd:'#bfdbfe'});
  if(p.punct&&p.punct.tier==='gold') t.push({t:'Never late', c:'#92400e', bg:'#fffbeb', bd:'#fde68a'});
  else if(p.punct&&p.punct.tier==='silver') t.push({t:'Reliably on time', c:'#475569', bg:'#f8fafc', bd:'#e2e8f0'});
  if(tr>=10) t.push({t:'Walking handbook', c:'#065f46', bg:'#f0fdf9', bd:'#cdeee3'});
  else if(tr>=5) t.push({t:'Quiz champion', c:'#065f46', bg:'#f0fdf9', bd:'#cdeee3'});
  else if(tr>=1) t.push({t:'Always learning', c:'#065f46', bg:'#f0fdf9', bd:'#cdeee3'});
  if(window.hasEarnedGlow&&window.hasEarnedGlow(p.staff_name)&&!elite) t.push({t:'Perfect fortnight', c:'#6d28d9', bg:'#f5f3ff', bd:'#ddd6fe'});
  { const mv=(p.team_moves||[])[0]; if(mv && (Date.now()-new Date(mv.changed_at).getTime())<30*864e5) t.unshift({t:'New to '+(mv.to_team||'the team'), c:'#6d28d9', bg:'#f5f3ff', bd:'#ddd6fe'}); }
  if(p.is_admin) t.push({t:'Behind the scenes', c:'#92400e', bg:'#fef3c7', bd:'#fde68a'});
  return t.slice(0,4);
}
function _pvStatTile(value, label, color){
  return '<div style="border-radius:14px;padding:12px 12px 11px;background:var(--ui-surface-3,#f1f5f9);text-align:left;">'+
    '<div style="font-size:24px;font-weight:800;line-height:1;letter-spacing:-.02em;color:'+color+';">'+value+'</div>'+
    '<div style="font-size:11px;font-weight:600;color:var(--ui-ink-3,#64748b);margin-top:5px;">'+label+'</div></div>';
}
function _pvPerks(p){
  const pu=p.punct||{}, d=Number(pu.days)||0, sc=(pu.score!=null)?Number(pu.score):null;
  const tier=(d>=4&&sc!=null)?(sc>=90?'gold':(sc>=80?'silver':(sc>=70?'bronze':''))):'';
  const tc=Number(p.training_count)||0, calls=Number(p.call_milestone)||0;
  return [
    {id:'ring', name:'Medal avatar ring', on:!!tier, how:'Reach Bronze, Silver or Gold in the On-Time Club', tier:tier, sub:tier?('Your avatar ring is '+tier+' while you hold the tier'):''},
    {id:'cap', name:'Scholar cap', on:tc>=1, how:'Pass your first training', sub:'A cap sits on your avatar'},
    {id:'phone', name:'Phone-line badge', on:calls>=100, how:'Log 100 calls', sub:'A phone badge sits on your avatar (replaces the cap)'},
    {id:'dots', name:'Scholar banner', on:tc>=5, how:'Pass 5 trainings', sub:'Dotted pattern on your profile banner'},
    {id:'stripe', name:'Team-hopper stripe', on:(p.team_moves||[]).length>=1, how:'Move to a new team', sub:'Diagonal stripe on your banner'}
  ];
}
function _pvApplyPerks(p){
  const perks=_pvPerks(p), on=function(i){return perks.filter(function(x){return x.id===i&&x.on;})[0];};
  const ring=document.getElementById('pvAvaRing'), band=document.getElementById('pvBand');
  const old=document.getElementById('pvAvaPerk'); if(old) old.remove();
  const r=on('ring');
  if(ring && r){
    const m={gold:'linear-gradient(135deg,#fde68a,#f59e0b,#b45309)',silver:'linear-gradient(135deg,#f8fafc,#94a3b8,#64748b)',bronze:'linear-gradient(135deg,#fed7aa,#c2410c,#7c2d12)'};
    ring.style.background=m[r.tier];
  }
  if(ring){
    const kind=on('phone')?'phone':(on('cap')?'cap':'');
    if(kind){
      ring.style.position='relative';
      const ic=kind==='phone'?'<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>':'<path d="M12 4 2 9l10 5 8-4v6h2V9L12 4zm-6 9v4c0 1.7 2.7 3 6 3s6-1.3 6-3v-4l-6 3-6-3z"/>';
      ring.insertAdjacentHTML('beforeend','<span id="pvAvaPerk" title="'+(kind==='phone'?'100+ calls logged':'Training passed')+'" style="position:absolute;right:-2px;bottom:-2px;width:30px;height:30px;border-radius:50%;background:'+(kind==='phone'?'#2563eb':'#059669')+';border:3px solid var(--ui-surface,#fff);display:flex;align-items:center;justify-content:center;"><svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">'+ic+'</svg></span>');
    }
  }
  if(band){
    const layers=[];
    if(on('dots')) layers.push('radial-gradient(rgba(255,255,255,.28) 1.5px,transparent 1.6px) 0 0/14px 14px');
    if(on('stripe')) layers.push('repeating-linear-gradient(135deg,rgba(255,255,255,.14) 0 10px,transparent 10px 24px)');
    if(layers.length){ const cur=band.style.background; band.style.background=layers.join(',')+','+cur; }
  }
}

function _pvPaintPersonality(p, name){
  const th=_pvTheme(p.team||'');
  const grad='linear-gradient(120deg,'+th.a+','+th.b+')';
  const band=document.getElementById('pvBand'); if(band) band.style.background=grad;
  const ring=document.getElementById('pvAvaRing'); if(ring) ring.style.background='linear-gradient(135deg,'+th.a+','+th.b+')';
  const ava=document.getElementById('pvAva'); if(ava && !ava.style.backgroundImage) ava.style.background='linear-gradient(135deg,'+th.a+','+th.b+')';
  const word=document.getElementById('pvBandWord'); if(word) word.textContent=(p.team||'').toUpperCase();
  const team=document.getElementById('pvTeam'); if(team && p.team){ team.style.background='linear-gradient(120deg,'+th.a+','+th.b+')'; }
  const q=document.getElementById('pvBioQuote'); if(q) q.style.borderLeftColor=th.a;
  const tm=document.getElementById('pvTeamMoves');
  if(tm){
    const mv=(p.team_moves||[]).slice(0,3);
    const fmt=function(iso){ const d=new Date(iso); return isNaN(d)?'':d.toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'}); };
    tm.innerHTML=mv.map(function(r){
      return '<div style="display:flex;align-items:center;gap:6px;"><svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor" style="flex-shrink:0;opacity:.7"><path d="M3 10a1 1 0 0 1 1-1h9.59l-2.3-2.29a1 1 0 1 1 1.42-1.42l4 4a1 1 0 0 1 0 1.42l-4 4a1 1 0 0 1-1.42-1.42L13.59 11H4a1 1 0 0 1-1-1Z"/></svg>'+
        '<span>Moved from <b>'+esc(r.from_team||'?')+'</b> to <b>'+esc(r.to_team||'?')+'</b> &middot; '+fmt(r.changed_at)+'</span></div>';
    }).join('');
    tm.style.display=mv.length?'block':'none';
  }
  const kn=document.getElementById('pvKnown'), kc=document.getElementById('pvKnownChips');
  const tags=_pvKnownFor(p);
  if(kn&&kc){
    kc.innerHTML=tags.map(function(x){
      return '<span style="font-size:12px;font-weight:700;padding:5px 12px;border-radius:999px;color:'+x.c+';background:'+x.bg+';border:1px solid '+x.bd+';">'+x.t+'</span>';
    }).join('');
    kn.style.display=tags.length?'block':'none';
  }
  const st=document.getElementById('pvStats');
  if(st){
    const tiles=[];
    const calls=Number(p.call_milestone)||0;
    if(calls>0) tiles.push(_pvStatTile(calls+'+','Calls logged',th.a));
    if(Number(p.training_count)>0) tiles.push(_pvStatTile(p.training_count,'Trainings passed',th.a));
    if(p.punct && p.punct.score!=null) tiles.push(_pvStatTile(p.punct.score+'%','On time · '+_punctPeriod(p.punct.fort),th.a));
    st.innerHTML=tiles.join('');
    st.style.display=tiles.length?'grid':'none';
  }
  try{ _pvApplyPerks(p); }catch(e){}
}

const _ACH_TONES = {
  gold:    {disc:'linear-gradient(145deg,#fde68a,#f59e0b)', ink:'#78350f', bg:'#fffbeb', bd:'#fde68a'},
  silver:  {disc:'linear-gradient(145deg,#f8fafc,#94a3b8)', ink:'#334155', bg:'#f8fafc', bd:'#e2e8f0'},
  bronze:  {disc:'linear-gradient(145deg,#fed7aa,#c2410c)', ink:'#7c2d12', bg:'#fff7ed', bd:'#fed7aa'},
  blue:    {disc:'linear-gradient(145deg,#bfdbfe,#2563eb)', ink:'#1e3a8a', bg:'#eff6ff', bd:'#dbeafe'},
  green:   {disc:'linear-gradient(145deg,#a7f3d0,#047857)', ink:'#064e3b', bg:'#f0fdf9', bd:'#cdeee3'},
  emerald: {disc:'linear-gradient(145deg,#6ee7b7,#059669)', ink:'#064e3b', bg:'#ecfdf5', bd:'#a7f3d0'},
  violet:  {disc:'linear-gradient(145deg,#ddd6fe,#7c3aed)', ink:'#4c1d95', bg:'#f5f3ff', bd:'#ddd6fe'},
  platinum:{disc:'linear-gradient(145deg,#a5f3fc,#7c3aed)', ink:'#312e81', bg:'#f0f9ff', bd:'#c7d2fe'}
};
function _achDisc(inner, tone, locked){
  const t=_ACH_TONES[tone]||_ACH_TONES.silver;
  return '<div style="width:38px;height:38px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;'+
    (locked ? 'background:#eef2f7;color:#94a3b8;border:1.5px dashed #cbd5e1;'
            : 'background:'+t.disc+';color:#fff;box-shadow:0 1px 2px rgba(15,23,42,.18),inset 0 1px 0 rgba(255,255,255,.45);')+
    'font-size:15px;font-weight:800;line-height:1;">'+inner+'</div>';
}
function _achRow2(inner, title, sub, tone, locked, tag){
  const t=_ACH_TONES[tone]||_ACH_TONES.silver;
  return '<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;'+
    (locked ? 'background:#fafbfc;border:1px dashed #dbe2ea;' : 'background:'+t.bg+';border:1px solid '+t.bd+';')+'">'+
    _achDisc(inner,tone,locked)+
    '<div style="min-width:0;flex:1;"><div style="font-size:13.5px;font-weight:700;line-height:1.2;color:'+(locked?'#94a3b8':'var(--ui-ink,#0f172a)')+';">'+title+'</div>'+
    (sub?'<div style="font-size:11.5px;margin-top:2px;color:'+(locked?'#a3adbb':'var(--ui-ink-3,#64748b)')+';">'+sub+'</div>':'')+'</div>'+
    (tag?'<span style="flex-shrink:0;font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;padding:3px 8px;border-radius:999px;'+
         (locked?'background:#eef2f7;color:#94a3b8;':'background:rgba(255,255,255,.75);color:'+t.ink+';')+'">'+tag+'</span>':'')+
    '</div>';
}
function _achSection(title, rowsHtml){
  if(!rowsHtml) return '';
  return '<div style="margin-top:4px;"><div style="font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--ui-ink-4,#94a3b8);margin:6px 2px 8px;">'+title+'</div>'+
         '<div style="display:flex;flex-direction:column;gap:8px;">'+rowsHtml+'</div></div>';
}

function buildAchievementsRows(p){
  const I=_ACH_ICONS;
  let earned=0;
  const sec={recog:'',calls:'',punct:'',learn:'',team:'',perks:''};

  if(window.hasEarnedGlow && window.hasEarnedGlow(p.staff_name)){
    const skin=(window.glowSkinFor?window.glowSkinFor(p.staff_name):'gold');
    const skinLabel=(window.GLOW_SKIN_LABELS&&window.GLOW_SKIN_LABELS[skin])||skin;
    const elite=window.isEliteCaller&&window.isEliteCaller(p.staff_name);
    sec.recog+=_achRow2('<span class="glow-name glow-'+skin+'" style="font-size:12px;font-weight:800;">'+(elite?'Elite':'Glow')+'</span>',
      elite?'The Call-Handler':'Perfect Fortnight', elite?'Elite glow — 1000 calls logged':(skinLabel+' glow earned'), elite?'emerald':'gold', false, elite?'Elite':'Glow');
    earned++;
  }

  const top=Number(p.call_milestone)||0;
  if(top>=1000){
    sec.calls+=_achRow2(I.medal.replace('<svg','<svg width="20" height="20"'),'The Call-Handler','Elite — 1000 calls logged','emerald',false,'1000');
    earned++;
  } else {
    [{t:100,sub:'Call volume milestone',tone:'blue'},{t:500,sub:'Consistent dedication',tone:'gold'}].forEach(function(k){
      if(top<k.t) return;
      sec.calls+=_achRow2(I.phone.replace('<svg','<svg width="19" height="19"'),k.t+' Calls Logged',k.sub,k.tone,false,String(k.t));
      earned++;
    });
    const nx=top<100?100:(top<500?500:1000);
    sec.calls+=_achRow2(I.phone.replace('<svg','<svg width="19" height="19"'),'Next: '+nx+' Calls Logged',nx===1000?'Unlocks the Call-Handler glow':'Keep logging calls','blue',true,'Locked');
  }

  const pu=p.punct||null, pd=pu?(Number(pu.days)||0):0, ps=(pu&&pu.score!=null)?Number(pu.score):null;
  if(ps!=null){
    const per=_punctPeriod(pu.fort)+' · '+ps+'% on time ('+(pd||'?')+' days)';
    const medal=function(fg,bg){return _tierMedal(fg,bg).replace(/width="18" height="18"/,'width="22" height="22"');};
    if(pd>=4 && ps>=90){ sec.punct+=_achRow2(medal('#fff7d6','#633806'),'Gold — On-Time Club',per,'gold',false,'Gold'); earned++; }
    else if(pd>=4 && ps>=80){ sec.punct+=_achRow2(medal('#ffffff','#4a4a46'),'Silver — On-Time Club',per,'silver',false,'Silver'); earned++; }
    else if(pd>=4 && ps>=70){ sec.punct+=_achRow2(medal('#fde7d3','#7c3a12'),'Bronze — On-Time Club',per,'bronze',false,'Bronze'); earned++; }
    if(pd>=4 && ps>=100){ sec.punct+=_achRow2(I.medal.replace('<svg','<svg width="19" height="19"'),'Spotless Fortnight','Every measured day on time · '+_punctPeriod(pu.fort),'emerald',false,'100%'); earned++; }
    if(!(pd>=4 && ps>=90)){
      const nxt=(pd>=4 && ps>=80)?['Gold',90]:((pd>=4 && ps>=70)?['Silver',80]:['Bronze',70]);
      sec.punct+=_achRow2(I.medal.replace('<svg','<svg width="19" height="19"'),'Next: '+nxt[0]+' — On-Time Club',pd<4?'Needs 4+ measured days':('Reach '+nxt[1]+'% on time (now '+ps+'%)'),'silver',true,'Locked');
    }
  }

  const tc=Number(p.training_count)||0;
  const steps=[{n:1,t:'First Quiz Passed',s:'Your first training is done'},{n:3,t:'Getting Into It',s:'3 trainings passed'},{n:5,t:'Quiz Regular',s:'5 trainings passed'},{n:10,t:'Walking Handbook',s:'10 trainings passed'},{n:20,t:'Training Master',s:'20 trainings passed'}];
  let topStep=null; steps.forEach(function(k){ if(tc>=k.n) topStep=k; });
  if(topStep){
    sec.learn+=_achRow2(I.cap.replace('<svg','<svg width="20" height="20"'),topStep.t,tc+' training'+(tc===1?'':'s')+' passed',tc>=10?'gold':(tc>=5?'emerald':'green'),false,String(tc));
    earned++;
  }
  const nxs=steps.filter(function(k){return tc<k.n;})[0];
  if(nxs) sec.learn+=_achRow2(I.cap.replace('<svg','<svg width="19" height="19"'),'Next: '+nxs.t,(nxs.n-tc)+' more training'+((nxs.n-tc)===1?'':'s')+' to go','green',true,'Locked');

  const moves=(p.team_moves||[]).length;
  if(moves>=1){
    sec.team+=_achRow2(I.cap.replace('<svg','<svg width="19" height="19"'),moves>=2?'Team Explorer':'Fresh Start',moves>=2?'Worked across '+(moves+1)+' teams':'Moved to a new team','blue',false,moves>=2?String(moves+1):'New');
    earned++;
  }

  _pvPerks(p).forEach(function(k){
    sec.perks+=_achRow2(I.medal.replace('<svg','<svg width="19" height="19"'),k.name,k.on?k.sub:k.how,k.on?'violet':'silver',!k.on,k.on?'On':'Locked');
  });

  const head='<div style="display:flex;align-items:baseline;justify-content:space-between;margin:0 2px 2px;"><span style="font-size:13px;font-weight:700;color:var(--ui-ink,#0f172a);">'+
    earned+(earned===1?' badge earned':' badges earned')+'</span><span style="font-size:10px;color:#94a3b8;">perks v2</span></div>';
  return head+_achSection('Recognition',sec.recog)+_achSection('Calls',sec.calls)+
         _achSection('Reliability',sec.punct)+_achSection('Learning',sec.learn)+_achSection('Team',sec.team)+_achSection('Perks',sec.perks);
}



function renderStaffDirectory(list){
  const el=document.getElementById('staffDirList');
  if(!list.length){
    el.innerHTML='<div style="text-align:center;color:var(--ui-ink-4,#94a3b8);padding:32px;font-size:13px;">No matches</div>';
    return;
  }
  const byTeam={};
  list.forEach(function(p){
    const t=p.team||'No team';
    if(!byTeam[t])byTeam[t]=[];
    byTeam[t].push(p);
  });
  const teams=Object.keys(byTeam).sort();
  el.innerHTML=teams.map(function(team){
    const members=byTeam[team].sort(function(a,b){return a.staff_name.localeCompare(b.staff_name);});
    return '<div style="padding:8px 4px 4px;font-size:10px;font-weight:700;color:var(--ui-ink-4,#94a3b8);text-transform:uppercase;letter-spacing:.8px;">'+team+'</div>'+
      members.map(function(p){
        const ava=p.staff_name.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
        const pron=p.pronouns?' <span style="font-size:10px;color:var(--ui-ink-4,#94a3b8);font-weight:400;">('+esc(p.pronouns)+')</span>':'';
        const badge=p.is_admin?' <span title="Admin" style="color:#92400e;display:inline-flex;vertical-align:middle;">'+(window.adminIcon?window.adminIcon(13):'ADMIN')+'</span>':'';
        let quizBlock = '';
        if(false && myIsAdmin){
          const hasAccess = (window._sdQuizAccess && window._sdQuizAccess.has(p.staff_name));
          const result = (window._sdQuizResults && window._sdQuizResults[p.staff_name]);
          let statusBadge = '';
          if(result){
            const badgeStyle = result.passed
              ? 'font-size:9px;font-weight:700;color:#059669;background:#d1fae5;padding:2px 6px;border-radius:8px;margin-left:4px;cursor:pointer;border:none;font-family:inherit;'
              : 'font-size:9px;font-weight:700;color:#991b1b;background:#fee2e2;padding:2px 6px;border-radius:8px;margin-left:4px;cursor:pointer;border:none;font-family:inherit;';
            statusBadge = '<button onclick="event.stopPropagation();viewQuizAttemptDetail(\''+p.staff_name.replace(/'/g,"\\'")+'\','+result.id+')" title="Review this attempt" style="'+badgeStyle+'">'+(result.passed?'✓ ':'✕ ')+result.score+'/'+result.total+'</button>';
          }
          const toggleBtn = '<button onclick="event.stopPropagation();toggleQuizAccess(\''+p.staff_name.replace(/'/g,"\\'")+'\',\'checklist_v1\','+(!hasAccess)+');setTimeout(openStaffDirectory,400);" title="'+(hasAccess?'Revoke quiz access':'Grant quiz access')+'" style="background:'+(hasAccess?'#dc2626':'#10b981')+';color:#fff;border:none;border-radius:6px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit;flex-shrink:0;">'+(hasAccess?'Revoke quiz':'Give quiz')+'</button>';
          quizBlock = '<div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">'+statusBadge+toggleBtn+'</div>';
        }
        return '<div onclick="openProfilePage(\''+p.staff_name.replace(/'/g,"&#39;")+'\')" style="display:flex;align-items:center;gap:10px;padding:8px 8px;border-radius:8px;cursor:pointer;transition:background .1s;" onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'\'" >'+
          renderStaffAvatar(p.staff_name, 32)+
          '<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:600;color:var(--ui-ink,#0f172a);">'+renderStaffName(p.staff_name, esc)+pron+badge+(window.achBadgesInline?window.achBadgesInline(p.staff_name):'')+'</div></div>'+
          quizBlock+
          (myIsAdmin?'':'<svg width="14" height="14" viewBox="0 0 20 20" fill="#cbd5e1"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>')+
          '</div>';
      }).join('');
  }).join('');
}

function filterStaffDirectory(){
  const q=document.getElementById('staffDirSearch').value.trim().toLowerCase();
  if(!q){renderStaffDirectory(_staffDirData);return;}
  const filtered=_staffDirData.filter(function(p){
    return (p.staff_name||'').toLowerCase().includes(q)||(p.team||'').toLowerCase().includes(q);
  });
  renderStaffDirectory(filtered);
}

function viewStaffProfile(name){
  const p=_staffDirData.find(function(x){return x.staff_name===name;});
  if(!p)return;
  const avaEl=document.getElementById('svProfAva');
  const img=window.avatarFor&&window.avatarFor(name);
  if(img){ avaEl.textContent=''; avaEl.style.backgroundImage='url('+img+')'; avaEl.style.backgroundSize='cover'; avaEl.style.backgroundPosition='center'; }
  else { avaEl.style.backgroundImage=''; avaEl.textContent=name.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase(); }
  document.getElementById('svProfName').innerHTML=renderStaffName(name, esc)+(window.achBadgesInline?window.achBadgesInline(name):'');
  const titleEl=document.getElementById('svProfTitle');
  if(titleEl){
    if(window.isEliteCaller && window.isEliteCaller(name)){
      titleEl.textContent='The Call-Handler';
      titleEl.style.display='block';
    }else{ titleEl.style.display='none'; }
  }
  const pronEl=document.getElementById('svProfPronouns');
  if(p.pronouns){pronEl.textContent=p.pronouns;pronEl.style.display='block';}
  else pronEl.style.display='none';
  const teamEl=document.getElementById('svProfTeam');
  if(p.team){teamEl.textContent=p.team+' team';teamEl.style.display='inline-block';}
  else teamEl.style.display='none';
  const roleEl=document.getElementById('svProfRole');
  if(p.is_admin){roleEl.innerHTML=(window.adminIcon?window.adminIcon(14):'Admin');roleEl.style.display='inline-flex';}
  else roleEl.style.display='none';
  document.getElementById('staffProfileViewOverlay').style.display='flex';
}

function closeStaffProfileView(){
  document.getElementById('staffProfileViewOverlay').style.display='none';
}

function fillMyNickname(){
  const el=document.getElementById('profNickname'); if(!el) return;
  el.value=(window._myNickname||'');
}

async function fillMyBio(){
  const ta=document.getElementById('profBio'); const chk=document.getElementById('profShowBio');
  if(!ta) return;
  try{
    const rows=await sbGet('staff_credentials','?staff_name=eq.'+encodeURIComponent(me)+'&select=bio,show_bio&limit=1');
    if(rows && rows.length){
      ta.value=rows[0].bio||'';
      if(chk) chk.checked = rows[0].show_bio!==false;
    }
  }catch(e){}
}

async function saveMyBio(){
  const ta=document.getElementById('profBio'); const chk=document.getElementById('profShowBio');
  if(!ta) return;
  const bio=(ta.value||'').trim();
  const show=chk ? !!chk.checked : true;
  try{
    await fetch(SB+"/rest/v1/staff_credentials?staff_name=eq."+encodeURIComponent(me),{
      method:"PATCH",
      headers:{ "apikey":KEY, "Authorization":"Bearer "+_sbBearer(),
                "Content-Type":"application/json", "Prefer":"return=minimal" },
      body:JSON.stringify({ bio: bio||null, show_bio: show })
    });
    showToast&&showToast('Bio saved');
  }catch(e){ showToast&&showToast('Could not save bio'); }
}

const BANNED_NICK_WORDS = [
  'fuck','fucker','motherfucker','fuk','fuc','shit','bitch','cunt','dick','pussy',
  'asshole','bastard','whore','slut','nigger','nigga','fag','faggot','cock','wank',
  'machikne','mathsikne','machikni','randi','radi','bhalu','sala','saala','khate',
  'muji','mooji','mujhi','muzi','lado','lauda','laado','puti','gadha','gu','chikne'
];
function _normNick(s){
  return String(s||'')
    .toLowerCase()
    .replace(/[013457@$]/g, function(c){ return {'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','@':'a','$':'s'}[c]; })
    .replace(/[^a-z]/g,'')
    .replace(/(.)\1+/g,'$1');
}
function nicknameIsBanned(nick){
  const n=_normNick(nick);
  if(!n) return false;
  return BANNED_NICK_WORDS.some(function(w){ return n.indexOf(_normNick(w))!==-1; });
}

async function saveMyNickname(){
  const el=document.getElementById('profNickname'); if(!el) return;
  const nick=(el.value||'').trim();
  if(nick && nicknameIsBanned(nick)){
    showToast && showToast("That nickname isn't allowed — please choose another");
    el.focus();
    return;
  }
  window._myNickname=nick||null;
  if(window._nickNames){ if(nick) window._nickNames[me]=nick; else delete window._nickNames[me]; }
  const disp=(window.myDisplayName?window.myDisplayName():me);
  const first=disp.split(' ')[0];
  const set=function(id,val){ const e=document.getElementById(id); if(e) e.textContent=val; };
  set('sbName',disp); set('mhName',first); set('mhNameInline',first);
  const pn=document.getElementById('profName'); if(pn) pn.innerHTML=renderStaffName(me, esc, disp)+(window.achBadgesInline?window.achBadgesInline(me):''); if(window.paintMyNickLine)window.paintMyNickLine();
  try{
    await fetch(SB+"/rest/v1/staff_credentials?staff_name=eq."+encodeURIComponent(me),{
      method:"PATCH",
      headers:{ "apikey":KEY, "Authorization":"Bearer "+_sbBearer(),
                "Content-Type":"application/json", "Prefer":"return=minimal" },
      body:JSON.stringify({ nickname: nick||null })
    });
    showToast&&showToast(nick?'Nickname saved':'Nickname cleared');
  }catch(e){ showToast&&showToast('Could not save nickname'); }
}

function renderMySkinPicker(){
  const card=document.getElementById('profGlowCard');
  const wrap=document.getElementById('profSkinSwatches');
  if(!card||!wrap) return;
  if(!(window.hasEarnedGlow&&window.hasEarnedGlow(me))){ card.style.display='none'; return; }
  card.style.display='';
  const cur=(window.glowSkinFor?window.glowSkinFor(me):'gold');
  const skins=(window.allowedSkinsFor?window.allowedSkinsFor(me):(window.GLOW_SKINS||[]));
  const eliteSet=new Set(window.ELITE_SKINS||[]);
  wrap.innerHTML=skins.map(function(sk){
    const sel=(sk===cur);
    const label=(window.GLOW_SKIN_LABELS&&window.GLOW_SKIN_LABELS[sk])||sk;
    const isElite=eliteSet.has(sk);
    const border=sel?'var(--accent,#4f46e5)':(isElite?'#047857':'#e5e7eb');
    return '<button onclick="pickMySkin(\''+sk+'\')" title="'+label+(isElite?' — elite, unlocked at 1000 calls':'')+'" '+
      'style="cursor:pointer;border-radius:10px;padding:8px 12px;font-family:inherit;font-size:13px;font-weight:800;'+
      'background:var(--ui-surface,#fff);border:2px solid '+border+';">'+
      '<span class="glow-name glow-'+sk+'">'+label+'</span></button>';
  }).join('');
}

async function pickMySkin(skin){
  const allowed=(window.allowedSkinsFor?window.allowedSkinsFor(me):(window.GLOW_SKINS||[]));
  if(allowed.indexOf(skin)<0) return;
  if(!(window.hasEarnedGlow&&window.hasEarnedGlow(me))) return;
  window._nameSkins=window._nameSkins||{};
  window._nameSkins[me]=skin;
  renderMySkinPicker();
  const disp=(window.myDisplayName?window.myDisplayName():me);
  const pn=document.getElementById('profName'); if(pn) pn.innerHTML=renderStaffName(me, esc, disp)+(window.achBadgesInline?window.achBadgesInline(me):''); if(window.paintMyNickLine)window.paintMyNickLine();
  try{
    await fetch(SB+"/rest/v1/staff_credentials?staff_name=eq."+encodeURIComponent(me),{
      method:"PATCH",
      headers:{ "apikey":KEY, "Authorization":"Bearer "+_sbBearer(),
                "Content-Type":"application/json", "Prefer":"return=minimal" },
      body:JSON.stringify({ name_skin:skin })
    });
  }catch(e){ showToast&&showToast('Could not save glow'); }
}

function _avatarUrl(path){
  if(!path) return null;
  return SB+'/storage/v1/object/public/avatars/'+String(path).split('/').map(encodeURIComponent).join('/');
}
function _dataUrlToBlob(d){
  var m=/^data:([^;]+);base64,(.*)$/.exec(d); if(!m) return null;
  var bin=atob(m[2]), u=new Uint8Array(bin.length);
  for(var i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i);
  return new Blob([u],{type:m[1]});
}
function _myAuthUid(){
  try{ var t=_sbBearer().split('.')[1].replace(/-/g,'+').replace(/_/g,'/'); return JSON.parse(atob(t)).sub||null; }catch(e){ return null; }
}
async function uploadMyAvatar(ev){
  const file=ev && ev.target && ev.target.files && ev.target.files[0];
  if(ev&&ev.target) ev.target.value='';
  if(!file) return;
  if(!/^image\//.test(file.type)){ showToast&&showToast('Please choose an image'); return; }
  try{
    const dataUrl=await _readFileAsDataURL(file);
    openAvatarCrop(dataUrl);
  }catch(e){ showToast&&showToast('Could not read image'); }
}

window._crop = window._crop || null;
function openAvatarCrop(dataUrl){
  const img=new Image();
  img.onload=function(){
    const V=260;
    const base=Math.max(V/img.width, V/img.height);
    window._crop={ img:img, V:V, base:base, zoom:1,
                   x:0, y:0, drag:false, lx:0, ly:0 };
    document.getElementById('avatarCropOverlay').style.display='flex';
    const z=document.getElementById('avatarCropZoom'); if(z) z.value='1';
    _cropClamp(); _cropDraw();
  };
  img.onerror=function(){ showToast&&showToast('Could not load image'); };
  img.src=dataUrl;
}
function _cropDraw(){
  const c=window._crop; if(!c) return;
  const cv=document.getElementById('avatarCropCanvas'); if(!cv) return;
  cv.width=c.V; cv.height=c.V;
  const ctx=cv.getContext('2d');
  ctx.clearRect(0,0,c.V,c.V);
  const s=c.base*c.zoom;
  const w=c.img.width*s, h=c.img.height*s;
  ctx.drawImage(c.img, c.x, c.y, w, h);
  ctx.save();
  ctx.globalCompositeOperation='destination-in';
  ctx.beginPath(); ctx.arc(c.V/2,c.V/2,c.V/2,0,Math.PI*2); ctx.fill();
  ctx.restore();
}
function _cropClamp(){
  const c=window._crop; if(!c) return;
  const s=c.base*c.zoom;
  const w=c.img.width*s, h=c.img.height*s;
  if(c.x>0) c.x=0; if(c.y>0) c.y=0;
  if(c.x < c.V-w) c.x=c.V-w;
  if(c.y < c.V-h) c.y=c.V-h;
}
function cropZoom(v){
  const c=window._crop; if(!c) return;
  const cx=c.V/2, cy=c.V/2;
  const oldS=c.base*c.zoom;
  c.zoom=parseFloat(v)||1;
  const newS=c.base*c.zoom;
  const k=newS/oldS;
  c.x=cx-(cx-c.x)*k; c.y=cy-(cy-c.y)*k;
  _cropClamp(); _cropDraw();
}
function _cropStart(e){
  const c=window._crop; if(!c) return;
  c.drag=true;
  const p=e.touches?e.touches[0]:e;
  c.lx=p.clientX; c.ly=p.clientY;
}
function _cropMove(e){
  const c=window._crop; if(!c||!c.drag) return;
  const p=e.touches?e.touches[0]:e;
  c.x+=(p.clientX-c.lx); c.y+=(p.clientY-c.ly);
  c.lx=p.clientX; c.ly=p.clientY;
  _cropClamp(); _cropDraw();
  if(e.cancelable) e.preventDefault();
}
function _cropEnd(){ if(window._crop) window._crop.drag=false; }
function closeAvatarCrop(){
  const o=document.getElementById('avatarCropOverlay'); if(o) o.style.display='none';
  window._crop=null;
}
async function saveAvatarCrop(){
  const c=window._crop; if(!c) return;
  const OUT=256;
  const out=document.createElement('canvas'); out.width=OUT; out.height=OUT;
  const ctx=out.getContext('2d');
  const s=c.base*c.zoom, k=OUT/c.V;
  ctx.drawImage(c.img, c.x*k, c.y*k, c.img.width*s*k, c.img.height*s*k);
  const compressed=out.toDataURL('image/jpeg',0.82);
  closeAvatarCrop();
  window._avatars=window._avatars||{};
  window._avatars[me]=compressed;
  ['profAvaWrap','sbAvatar','mhAva'].forEach(function(id){
    const el=document.getElementById(id); if(!el) return;
    if(id==='profAvaWrap'){ const sp=document.getElementById('profAva'); if(sp) sp.textContent=''; }
    else el.textContent='';
    el.classList.add('has-photo');
    el.style.setProperty('background-image','url('+compressed+')','important');
    el.style.setProperty('background-size','cover','important');
    el.style.setProperty('background-position','center','important');
  });
  const H={ "apikey":KEY, "Authorization":"Bearer "+_sbBearer() };
  const saveRow=function(fields){
    return fetch(SB+"/rest/v1/staff_avatars?on_conflict=staff_name",{
      method:"POST",
      headers:Object.assign({ "Content-Type":"application/json", "Prefer":"resolution=merge-duplicates,return=minimal" },H),
      body:JSON.stringify([Object.assign({ staff_name:me, updated_at:new Date().toISOString() },fields)])
    });
  };
  try{
    var uid=_myAuthUid(), blob=_dataUrlToBlob(compressed), path=null;
    if(uid && blob){
      const p=uid+'/'+Date.now()+'-'+Math.random().toString(36).slice(2,8)+'.jpg';
      const up=await fetch(SB+'/storage/v1/object/avatars/'+p,{ method:'POST', headers:Object.assign({'Content-Type':'image/jpeg','cache-control':'max-age=31536000'},H), body:blob });
      if(up.ok) path=p;
    }
    if(path){
      var oldPath=null;
      try{ const o=await sbGet('staff_avatars','?staff_name=eq.'+encodeURIComponent(me)+'&select=avatar_path'); oldPath=(o&&o[0]&&o[0].avatar_path)||null; }catch(e){}
      const r=await saveRow({ avatar_path:path, avatar:null });
      if(!r.ok) throw new Error('row '+r.status);
      window._avatars[me]=_avatarUrl(path);
      if(oldPath && oldPath!==path){ fetch(SB+'/storage/v1/object/avatars/'+oldPath,{ method:'DELETE', headers:H }).catch(function(){}); }
    } else {
      const r=await saveRow({ avatar:compressed, avatar_path:null });
      if(!r.ok) throw new Error('row '+r.status);
    }
    showToast&&showToast('Photo updated');
  }catch(e){ showToast&&showToast('Could not save photo'); }
}

function _readFileAsDataURL(file){
  return new Promise(function(res,rej){
    const r=new FileReader();
    r.onload=function(){res(r.result);}; r.onerror=rej;
    r.readAsDataURL(file);
  });
}

async function loadProfilePronouns(){
  try{
    const rows=await sbGet('staff_credentials','?staff_name=eq.'+encodeURIComponent(me)+'&select=pronouns');
    const val=(rows.length&&rows[0].pronouns)?rows[0].pronouns:'';
    const inlineEl=document.getElementById('profNamePronouns');
    if(inlineEl){
      if(val){inlineEl.textContent='('+val+')';inlineEl.style.display='inline';}
      else inlineEl.style.display='none';
    }
    const currentEl=document.getElementById('profPronounsCurrent');
    if(currentEl) currentEl.textContent=val?val:'Not set';
    const sel=document.getElementById('profPronouns');
    const custom=document.getElementById('profPronounsCustom');
    if(!sel)return;
    const presets=['she/her','he/him','they/them','she/they','he/they'];
    if(val&&!presets.includes(val)){
      sel.value='custom';
      if(custom){custom.style.display='block';custom.value=val;}
    } else {
      sel.value=val||'';
      if(custom)custom.style.display='none';
    }
    sel.onchange=function(){
      if(this.value==='custom'){custom.style.display='block';custom.focus();}
      else if(custom)custom.style.display='none';
    };
  }catch(e){console.warn(e);}
}

async function savePronouns(){
  const sel=document.getElementById('profPronouns');
  const custom=document.getElementById('profPronounsCustom');
  const ok=document.getElementById('profPronounsOk');
  let val=sel.value;
  if(val==='custom') val=custom.value.trim();
  try{
    await fetch(SB+'/rest/v1/staff_credentials?staff_name=eq.'+encodeURIComponent(me),{
      method:'PATCH',
      headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify({pronouns:val||null})
    });
    if(ok){ok.textContent='Pronouns saved';ok.classList.add('show');setTimeout(()=>ok.classList.remove('show'),2000);}
    const inlineEl=document.getElementById('profNamePronouns');
    if(inlineEl){
      if(val){inlineEl.textContent='('+val+')';inlineEl.style.display='inline';}
      else inlineEl.style.display='none';
    }
    const currentEl=document.getElementById('profPronounsCurrent');
    if(currentEl) currentEl.textContent=val?val:'Not set';
    toggleSection('profPronounsSection');
  }catch(e){
    if(ok){ok.textContent='Failed to save';ok.classList.add('show');}
  }
}


async function loadProfileBirthday(){
  try{
    const rows=await sbGet('staff_credentials','?staff_name=eq.'+encodeURIComponent(me)+'&select=birthday');
    const el=document.getElementById('profBirthday');
    if(el&&rows.length&&rows[0].birthday)el.value=rows[0].birthday;
  }catch(e){console.warn(e);}
}

async function saveBirthday(){
  const val=document.getElementById('profBirthday').value;
  const err=document.getElementById('profBdayErr'),ok=document.getElementById('profBdayOk');
  err.classList.remove('show');ok.classList.remove('show');
  try{
    await fetch(SB+'/rest/v1/staff_credentials?staff_name=eq.'+encodeURIComponent(me),{
      method:'PATCH',headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify({birthday:val||null})
    });
    ok.textContent='Birthday saved!';ok.classList.add('show');
    setTimeout(()=>ok.classList.remove('show'),2000);
    loadOnboardingChecklist();
  }catch(e){err.textContent='Failed to save.';err.classList.add('show');}
}


function toggleSection(id){
  const el=document.getElementById(id);
  if(el)el.style.display=el.style.display==="none"?"block":"none";
}

async function loadProfilePage(){
  try{ const _pn=document.getElementById("profName"); if(_pn && !_pn.textContent.trim()) _pn.innerHTML=nxSkel('inline'); }catch(e){}
  const ava=me.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  try{ await loadGlowData(); }catch(e){}
  if(window._myNickname===null || typeof window._myNickname==='undefined'){ try{ await loadMyNickname(); }catch(e){} }
  const profAvaEl=document.getElementById("profAva");
  const _pImg=(window.avatarFor&&window.avatarFor(me))||null;
  const _pWrap=document.getElementById("profAvaWrap");
  if(_pImg){ if(profAvaEl)profAvaEl.textContent=''; if(_pWrap)_pWrap.style.backgroundImage='url('+_pImg+')'; }
  else { if(profAvaEl)profAvaEl.textContent=ava; if(_pWrap)_pWrap.style.backgroundImage=''; }
  const profNameEl=document.getElementById("profName");if(profNameEl)profNameEl.innerHTML=renderStaffName(me, esc, (window.myDisplayName?window.myDisplayName():me))+(window.achBadgesInline?window.achBadgesInline(me):""); if(window.paintMyNickLine)window.paintMyNickLine();
  const profRoleEl=document.getElementById("profRole");if(profRoleEl)profRoleEl.textContent=myIsAdmin?"Admin":"Staff";
  fillMyNickname();
  fillMyBio();
  renderMySkinPicker();
  try{
    const teamRows=await sbGet('staff_credentials','?staff_name=eq.'+encodeURIComponent(me)+'&select=team');
    const teamName=(teamRows.length&&teamRows[0].team)?teamRows[0].team:'';
    const teamEl=document.getElementById('profTeam');
    if(teamEl){
      if(teamName){teamEl.textContent=teamName+' team';teamEl.style.display='block';}
      else teamEl.style.display='none';
    }
  }catch(e){console.warn(e);}
  loadProfileBirthday();
  loadProfilePronouns();
  loadOnboardingChecklist();
  try{
    const rows=await sbGet("staff_credentials","?staff_name=eq."+encodeURIComponent(me)+"&select=sq1_question,sq2_question");
    const statusEl=document.getElementById("profSqStatus");
    if(statusEl){
      if(rows.length&&rows[0].sq1_question&&rows[0].sq2_question){
        statusEl.innerHTML='<span style="color:#16a34a;font-size:12px;font-weight:600;">✓ Two security questions set</span>';
      }else{
        statusEl.innerHTML='<span style="color:#d97706;font-size:12px;font-weight:600;">⚠ No security questions set — add them so you can reset your password</span>';
      }
    }
  }catch(e){console.warn(e);}
}

async function loadCurrentQuestions(){
  try{
    const rows=await sbGet("staff_credentials","?staff_name=eq."+encodeURIComponent(me)+"&select=sq1_question,sq2_question");
    if(!rows.length)return;
    const q1=document.getElementById("profQ1"),q2=document.getElementById("profQ2");
    if(q1&&rows[0].sq1_question){
      for(let o of q1.options)if(o.value===rows[0].sq1_question){o.selected=true;break;}
    }
    if(q2&&rows[0].sq2_question){
      for(let o of q2.options)if(o.value===rows[0].sq2_question){o.selected=true;break;}
    }
  }catch(e){console.warn(e);}
}

async function changePassword(){
  const curr=document.getElementById("profPassCurrent").value;
  const newp=document.getElementById("profPassNew").value;
  const conf=document.getElementById("profPassConfirm").value;
  const err=document.getElementById("profPassErr"),ok=document.getElementById("profPassOk");
  err.classList.remove("show");ok.classList.remove("show");
  if(!curr){err.textContent="Please enter your current password.";err.classList.add("show");return;}
  if(!newp||newp.length<8){err.textContent="New password must be at least 8 characters.";err.classList.add("show");return;}
  if(newp!==conf){err.textContent="Passwords do not match.";err.classList.add("show");return;}
  const btn=document.getElementById("profPassBtn");btn.disabled=true;btn.innerHTML='<span class="sp"></span> Saving...';
  try{
    const auth=getAuthClient();
    if(!auth){ err.textContent="Can't reach the sign-in service. Please try again."; err.classList.add("show"); return; }

    const { error: reauthErr } = await auth.signInWithPassword({
      email: synthEmailFromName(me),
      password: curr
    });
    if(reauthErr){
      err.textContent="Current password is incorrect.";
      err.classList.add("show");
      return;
    }

    const { error: updErr } = await auth.updateUser({ password: newp });
    if(updErr){
      err.textContent=updErr.message||"Couldn't update your password. Please try again.";
      err.classList.add("show");
      return;
    }
    await refreshSbAuthToken();

    try{
      await fetch(SB+"/rest/v1/staff_credentials?staff_name=eq."+encodeURIComponent(me),{
        method:"PATCH",
        headers:{"apikey":KEY,"Authorization":"Bearer "+_sbBearer(),"Content-Type":"application/json","Prefer":"return=minimal"},
        body:JSON.stringify({must_reset:false})
      });
    }catch(e){ /* password already changed; flag cleanup is best-effort */ }

    ok.textContent="Password updated successfully!";ok.classList.add("show");
    document.getElementById("profPassCurrent").value="";
    document.getElementById("profPassNew").value="";
    document.getElementById("profPassConfirm").value="";
  }catch(e){
    console.warn('changePassword',e);
    err.textContent="Something went wrong. Please try again.";err.classList.add("show");
  }
  finally{btn.disabled=false;btn.textContent="Update";}
}

async function saveSecurityQuestions(){
  const q1=document.getElementById("profQ1").value;
  const a1=document.getElementById("profA1").value.trim().toLowerCase();
  const q2=document.getElementById("profQ2").value;
  const a2=document.getElementById("profA2").value.trim().toLowerCase();
  const err=document.getElementById("profSqErr"),ok=document.getElementById("profSqOk");
  err.classList.remove("show");ok.classList.remove("show");
  if(!q1){err.textContent="Please select your first security question.";err.classList.add("show");return;}
  if(!a1){err.textContent="Please answer your first security question.";err.classList.add("show");return;}
  if(!q2){err.textContent="Please select your second security question.";err.classList.add("show");return;}
  if(!a2){err.textContent="Please answer your second security question.";err.classList.add("show");return;}
  if(q1===q2){err.textContent="Please choose two different questions.";err.classList.add("show");return;}
  const btn=document.getElementById("profSqBtn");btn.disabled=true;btn.innerHTML='<span class="sp"></span> Saving...';
  try{
    const [h1,h2]=await Promise.all([hash(a1),hash(a2)]);
    const res=await fetch(SB+"/rest/v1/staff_credentials?staff_name=eq."+encodeURIComponent(me),{
      method:"PATCH",
      headers:{"apikey":KEY,"Authorization":"Bearer "+KEY,"Content-Type":"application/json","Prefer":"return=minimal"},
      body:JSON.stringify({sq1_question:q1,sq1_answer_hash:h1,sq2_question:q2,sq2_answer_hash:h2})
    });
    if(res.ok||res.status===204){
      ok.textContent="Security questions saved!";ok.classList.add("show");
      document.getElementById("profA1").value="";
      document.getElementById("profA2").value="";
      setTimeout(()=>{toggleSection("profSqSection");loadProfilePage();},1500);
    }else throw new Error();
  }catch(e){err.textContent="Failed. Please try again.";err.classList.add("show");}
  finally{btn.disabled=false;btn.textContent="Save Questions";}
}





async function ensureStaffSettingsRow(){
  if(!me) return;
  try{
    const rows = await sbGet('staff_settings','?name=eq.'+encodeURIComponent(me)+'&select=name');
    if(rows && rows.length) return;
    await fetch(SB+'/rest/v1/staff_settings',{
      method:'POST',
      headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
      body: JSON.stringify({name: me})
    });
  }catch(e){ /* non-critical — PATCH fallbacks still write localStorage */ }
}

function _hasValidAvailability(rows){
  if(!Array.isArray(rows)||!rows.length) return false;
  const today=new Date(); today.setHours(0,0,0,0);
  return rows.some(function(r){
    if(r.is_ongoing) return true;
    if(!r.valid_until) return true;
    const until=new Date(r.valid_until+'T00:00:00');
    return until>=today;
  });
}

async function maybeShowOnboarding(){
  if(sessionStorage.getItem('onboard_checked_'+me)==='done'){renderTimesheetPreview();maybeShowTour();return;}
  try{
    const avail=await sbGet('staff_availability','?staff_name=eq.'+encodeURIComponent(me)+'&order=updated_at.desc&limit=5');
    const hasAvail=_hasValidAvailability(avail);
    const card=document.getElementById('onboardCard');
    if(card)card.style.display='none';
    if(!hasAvail){
      showOnboardLock(true,true,false, (Array.isArray(avail)&&avail.length>0));
    } else {
      sessionStorage.setItem('onboard_checked_'+me,'done');
      maybeShowTour();
    }
    renderTimesheetPreview();
  }catch(e){renderTimesheetPreview();}
}

function showOnboardLock(hasSQ,hasDOB,hasAvail,isExpired){
  const overlay=document.getElementById('onboardLockOverlay');
  if(overlay){
    const msg=document.getElementById('onboardLockMsg');
    if(msg){
      msg.textContent=isExpired
        ? 'Your availability has expired. Please submit your updated weekly availability before using the portal.'
        : 'Please submit your weekly availability before using the portal.';
    }
    overlay.style.display='flex';
    overlay.dataset.locked='1';
  }
}

function dismissOnboardLock(){
  const overlay=document.getElementById('onboardLockOverlay');
  if(overlay && overlay.dataset.locked==='1') return;
  if(overlay)overlay.style.display='none';
}




function rtAvaColor(name){
  const colors = ['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#06b6d4','#14b8a6'];
  let h = 0;
  for(let i=0;i<name.length;i++) h = (h*31 + name.charCodeAt(i)) & 0xffffffff;
  return colors[Math.abs(h) % colors.length];
}







function updateBellBadge(count){
  const els = ['mhBellBadge','sbBellBadge'].map(function(id){return document.getElementById(id);}).filter(Boolean);
  els.forEach(function(el){
    if(!count || count <= 0){
      el.style.display = 'none';
      el.textContent = '';
    } else {
      el.style.display = 'flex';
      el.textContent = count > 4 ? '4+' : String(count);
    }
  });
}


let _searchCache = null;
let _searchCacheTime = 0;
const _searchTtl = 30000;


async function buildSearchCache(){
  if(_searchCache && (Date.now()-_searchCacheTime) < _searchTtl) return _searchCache;
  const out = {events:[], staff:[]};
  try{
    const evRows = await sbGet('calendar_events','?order=event_date.desc&limit=100');
    out.events = evRows||[];
    out.staff = (typeof STAFF !== 'undefined') ? STAFF : [];
  }catch(e){console.warn('search cache:',e);}
  _searchCache = out;
  _searchCacheTime = Date.now();
  return out;
}



function searchHighlight(text, query){
  if(!text || !query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if(idx < 0) return text.replace(/</g,'&lt;');
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx+query.length);
  const after = text.slice(idx+query.length);
  return before.replace(/</g,'&lt;') + '<mark>'+match.replace(/</g,'&lt;')+'</mark>' + after.replace(/</g,'&lt;');
}

async function performSearch(query){
  const q = String(query||'').trim().toLowerCase();
  if(!q) return null;
  const cache = await buildSearchCache();
  const out = {events:[], staff:[]};

  cache.events.forEach(function(e){
    const t = (e.title||'').toLowerCase();
    const d = (e.description||'').toLowerCase();
    if(t.indexOf(q)>=0 || d.indexOf(q)>=0) out.events.push(e);
  });
  out.staff = cache.staff.filter(function(name){
    return name && name.toLowerCase().indexOf(q)>=0;
  }).slice(0,8);

  return out;
}

function openSearch(){
  if(document.getElementById('searchBack')) return;
  const back = document.createElement('div');
  back.id = 'searchBack';
  back.className = 'search-back';
  back.innerHTML =
    '<div class="search-modal" onclick="event.stopPropagation()">'+
      '<div class="search-input-wrap">'+
        '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/></svg>'+
        '<input class="search-input" id="searchInput" type="text" placeholder="Search events and staff..." autocomplete="off">'+
        '<span class="search-kbd">Esc</span>'+
      '</div>'+
      '<div id="searchResults" class="search-results"><div class="search-empty">Start typing to search…</div></div>'+
    '</div>';
  document.body.appendChild(back);

  const input = document.getElementById('searchInput');
  setTimeout(function(){ input.focus(); }, 30);

  let timer = null;
  input.addEventListener('input', function(){
    clearTimeout(timer);
    timer = setTimeout(function(){ doSearchAndRender(input.value); }, 120);
  });
  input.addEventListener('keydown', function(e){
    const list = document.querySelectorAll('.search-item');
    let active = document.querySelector('.search-item.active');
    let idx = active ? Array.prototype.indexOf.call(list, active) : -1;
    if(e.key==='ArrowDown'){
      e.preventDefault();
      idx = (idx+1) % list.length;
      list.forEach(function(it){it.classList.remove('active');});
      if(list[idx]){ list[idx].classList.add('active'); list[idx].scrollIntoView({block:'nearest'}); }
    } else if(e.key==='ArrowUp'){
      e.preventDefault();
      idx = (idx-1+list.length) % list.length;
      list.forEach(function(it){it.classList.remove('active');});
      if(list[idx]){ list[idx].classList.add('active'); list[idx].scrollIntoView({block:'nearest'}); }
    } else if(e.key==='Enter' && active){
      e.preventDefault();
      active.click();
    } else if(e.key==='Escape'){
      e.preventDefault();
      closeSearch();
    }
  });
  back.addEventListener('click', function(){ closeSearch(); });
}

function closeSearch(){
  const back = document.getElementById('searchBack');
  if(back) back.remove();
}

async function doSearchAndRender(query){
  const el = document.getElementById('searchResults');
  const q = (query||'').trim();
  if(!q){
    el.innerHTML = '<div class="search-empty">Start typing to search…</div>';
    return;
  }
  const r = await performSearch(q);
  let html = '';
  let firstActive = false;
  function row(icon, title, sub, onclick){
    const cls = 'search-item' + (firstActive ? '' : ' active');
    firstActive = true;
    return '<div class="'+cls+'" onclick="'+onclick+'">'+
      '<div class="search-item-icon">'+icon+'</div>'+
      '<div class="search-item-body">'+
        '<div class="search-item-title">'+title+'</div>'+
        (sub ? '<div class="search-item-sub">'+sub+'</div>' : '')+
      '</div>'+
    '</div>';
  }
  const evIcon = '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>';
  const staffIcon = '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/></svg>';

  if(r.events.length){
    html += '<div class="search-section-hd">Calendar · '+r.events.length+'</div>';
    r.events.slice(0,5).forEach(function(e){
      const dStr = e.event_date ? new Date(e.event_date).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'}) : '';
      html += row(evIcon, searchHighlight(e.title||'(untitled)', q), dStr, 'closeSearch();goTo(\'calendar\')');
    });
  }
  if(r.staff.length){
    html += '<div class="search-section-hd">Staff · '+r.staff.length+'</div>';
    r.staff.forEach(function(name){
      html += row(staffIcon, searchHighlight(name, q), 'Team member', 'closeSearch();goTo(\'profile\')');
    });
  }
  if(!html){
    html = '<div class="search-empty">No matches for "'+q.replace(/</g,'&lt;')+'"</div>';
  }
  el.innerHTML = html;
}

document.addEventListener('keydown', function(e){
  const k = (e.key||'').toLowerCase();
  if((e.ctrlKey||e.metaKey) && k==='k' && !e.shiftKey && !e.altKey){
    e.preventDefault();
    openSearch();
  }
});

let _pollBaselined = false;

async function pollForNewActivity(){
  if(!me) return;
  if(document.hidden){
    const _t = Date.now();
    if(_t - (window._pollLastHidden || 0) < 5*60*1000) return;
    window._pollLastHidden = _t;
  }
  console.log('[poll] tick at', new Date().toISOString());
  if(typeof showSystemNotification !== 'function') return;
  if(!_pollBaselined){ _pollBaselined = true; return; }
  try{

    if(!_lastQuizSeen){
      try{
        const q = await sbGet('quiz_access','?staff_name=eq.'+encodeURIComponent(me)+'&order=granted_at.desc&limit=1');
        _lastQuizSeen = (q && q[0] && q[0].granted_at) ? new Date(q[0].granted_at).getTime() + 1 : Date.now();
      }catch(e){ _lastQuizSeen = Date.now(); }
    } else {
      try{
        const since = new Date(_lastQuizSeen).toISOString();
        let newQ = await sbGet('quiz_access','?staff_name=eq.'+encodeURIComponent(me)+
                                 '&granted_at=gt.'+encodeURIComponent(since)+'&order=granted_at.asc&limit=5') || [];
        const _qsKey = 'quiz_notified_'+me;
        let _qSeen = [];
        try{ _qSeen = JSON.parse(localStorage.getItem(_qsKey)||'[]'); }catch(e){}
        newQ = newQ.filter(function(q){ return _qSeen.indexOf(q.id) < 0 && q.granted_by !== me; });
        if(newQ.length){
          newQ.forEach(function(q){ _qSeen.push(q.id); });
          try{ localStorage.setItem(_qsKey, JSON.stringify(_qSeen.slice(-200))); }catch(e){}
        }
        let titles = {};
        if(newQ.length){
          try{
            const qz = await sbGet('custom_quizzes','?select=id,title') || [];
            qz.forEach(function(x){ titles[String(x.id)] = x.title; });
          }catch(e){}
        }
        newQ.forEach(function(q){
          _lastQuizSeen = Math.max(_lastQuizSeen, new Date(q.granted_at).getTime() + 1);
          const nice = titles[String(q.quiz_id)] || 'A new quiz';
          NotifManager.push({
            id: 'quiz-'+q.id,
            type: 'quiz',
            title: 'New training assigned',
            body: nice + (q.granted_by ? ' — assigned by '+q.granted_by : ''),
            ts: new Date(q.granted_at).getTime(),
            link: 'learning'
          });
        });
      }catch(e){}
    }

    if(!_lastLeaveSeen){
      try{
        const l = await sbGet('leave_submissions','?staff_name=eq.'+encodeURIComponent(me)+'&status=in.(approved,declined)&order=submitted_at.desc&limit=1');
        if(l && l[0]) _lastLeaveSeen = parseSupabaseTs(l[0].submitted_at);
        else _lastLeaveSeen = Date.now();
      }catch(e){ _lastLeaveSeen = Date.now(); }
    }

    try{
      const av = await sbGet('staff_availability','?staff_name=eq.'+encodeURIComponent(me)+'&limit=1');
      if(av && av[0] && av[0].updated_at){
        const lastUpdate = new Date(av[0].updated_at).getTime();
        const daysOld = (Date.now() - lastUpdate) / (1000*60*60*24);
        if(daysOld > 30){
          const expKey = 'avail_expiry_warned_'+me;
          if(!sessionStorage.getItem(expKey)){
            sessionStorage.setItem(expKey, '1');
            NotifManager.push({
              id: 'avail-expiry-'+Math.floor(lastUpdate/86400000),
              type: 'availability-expiry',
              title: 'Update your availability',
              body: 'Your availability hasn\'t been updated in over '+Math.floor(daysOld)+' days. Please refresh it.',
              ts: Date.now(),
              link: 'availability'
            });
          }
        }
      }
    }catch(e){}
  }catch(e){}
}

let _lastQuizSeen = null;
let _lastLeaveSeen = null;
let _activityPollTimer = null;
function startActivityPolling(){
  pollForNewActivity();
  if(_activityPollTimer) clearInterval(_activityPollTimer);
  _activityPollTimer = setInterval(pollForNewActivity, 60000);
}


let _deferredPwaPrompt = null;
window.addEventListener('beforeinstallprompt', function(e){
  e.preventDefault();
  _deferredPwaPrompt = e;
  const btn = document.getElementById('pwaInstallBtn');
  if(btn) btn.style.display = 'inline-flex';
});

async function triggerPwaInstall(){
  if(!_deferredPwaPrompt){
    showToast('Use your browser menu: "Add to Home Screen"');
    return;
  }
  _deferredPwaPrompt.prompt();
  const result = await _deferredPwaPrompt.userChoice;
  _deferredPwaPrompt = null;
  const btn = document.getElementById('pwaInstallBtn');
  if(btn) btn.style.display = 'none';
  if(result.outcome === 'accepted') showToast('App installed!');
}

