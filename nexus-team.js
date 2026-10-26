
let _diaryEditId = null;







let _diaryFlipIndex = 0;




let _diaryNewPageOpen = false;
let _diaryDraft = {};
let _diarySaveTimer = null;



























/* Reports are now separate pages: My Hours (everyone), Manager Tools (admin),
   Team Report (people whose team has one, and admins). */
function nxTeamReportAllowed(){
  return !!(myIsAdmin || (myTeam && typeof trTeamHasReport === 'function' && trTeamHasReport(myTeam)));
}
function nxReportNavApply(mgr, tr){
  var set = function(id, on){ var el = document.getElementById(id); if(el) el.style.display = on ? '' : 'none'; };
  set('nav-myreports', mgr);
  set('homeMenuTeamReport', tr);
  set('homeMenuTimesheet', mgr);
  set('homeReportsMenu', mgr || tr);
  var hd = document.getElementById('homeMenuHd'); if(hd) hd.textContent = mgr ? 'Reports & admin' : 'Reports';
}
function _repMenuKey(){ var n = window.me || (typeof me !== 'undefined' && me) || ''; return n ? 'nx_rep_menu_' + n : ''; }
/* Show the last known answer straight away (before the admin/team flags load) so the Home menu doesn't pop in late. */
function nxApplyReportMenuCache(){
  try{
    var k = _repMenuKey(); if(!k) return;
    var v = localStorage.getItem(k); if(v === null) return;
    nxReportNavApply(v.indexOf('m') >= 0, v.indexOf('t') >= 0);
  }catch(e){}
}
function nxUpdateReportNav(){
  if(!window._nxFlagsLoaded){ nxApplyReportMenuCache(); return; }
  var tr = nxTeamReportAllowed(), mgr = !!myIsAdmin;
  /* myTeam loads a moment after the admin flag. Until it does, keep whatever Team Report
     state is already showing (the cached one) instead of hiding it and re-showing it. */
  var teamUnknown = !myIsAdmin && !myTeam;
  if(teamUnknown){
    try{ var _k0 = _repMenuKey(), _v0 = _k0 ? localStorage.getItem(_k0) : null; tr = !!(_v0 && _v0.indexOf('t') >= 0); }catch(e){ tr = false; }
  }
  nxReportNavApply(mgr, tr);
  if(!teamUnknown){ try{ var k = _repMenuKey(); if(k) localStorage.setItem(k, (mgr ? 'm' : '') + (tr ? 't' : '')); }catch(e){} }
  /* If someone is sitting on a page they can't use, send them home. */
  var onMgr = document.getElementById('page-myreports'), onTr = document.getElementById('page-teamreport');
  if((onMgr && onMgr.classList.contains('active') && !mgr) || (onTr && onTr.classList.contains('active') && !tr)){
    if(typeof goTo === 'function') goTo('home');
  }
  /* myTeam loads lazily — fetch it once so the Team Report entry can appear. */
  if(!myTeam && !myIsAdmin && !window._navTeamFetching && (window.me || (typeof me !== 'undefined' && me))){
    window._navTeamFetching = true;
    sbGet('staff_credentials','?staff_name=eq.'+encodeURIComponent(window.me || me)+'&select=team').then(function(creds){
      if(creds && creds.length && creds[0] && creds[0].team){ myTeam = creds[0].team; nxUpdateReportNav(); }
    }).catch(function(){}).then(function(){ window._navTeamFetching = false; });
  }
}
function _repStore(k, v){ try{ sessionStorage.setItem(k, v); }catch(e){} }
function _repRead(k){ try{ return sessionStorage.getItem(k); }catch(e){ return null; } }
function showMgrView(v){
  if(v !== 'breaks' && v !== 'edit' && v !== 'notices') v = 'breaks';
  ['breaks','edit','notices'].forEach(function(k){
    var sec = document.getElementById('msec-'+k), btn = document.getElementById('mview-'+k);
    if(sec) sec.style.display = (k === v) ? '' : 'none';
    if(btn) btn.classList.toggle('active', k === v);
  });
  _repStore('nx_rep_mgr', v);
  if(v === 'breaks'){
    try{ if(typeof loadExtraBreakRequests === 'function') loadExtraBreakRequests(); }catch(e){}
    try{ if(typeof nxBreakCheckLoad === 'function') nxBreakCheckLoad(); }catch(e){}
  }
  if(v === 'edit'){ try{ populateMgrStaff(); }catch(e){} }
  if(v === 'notices'){ try{ if(typeof loadStaffNoticesAdmin === 'function') loadStaffNoticesAdmin(); }catch(e){} }
}
/* Compat router: the old Reports tabs are separate pages now. */
function showReportsTab(tab){
  if(tab === 'manager') return goTo('myreports');
  if(tab === 'teamreport') return goTo('teamreport');
  return goTo('myhours');
}



var TR_SHAPES = { processing:'metrics', enrolment:'log', evershine:'log', placement:'placement' };
var TR_NO_REPORT = { evershine:true };
function trTeamHasReport(team){ return !TR_NO_REPORT[_teamKey(team||trActiveTeam())]; }
function _teamKey(t){ return String(t||'').trim().toLowerCase(); }
var _trViewTeam = null;
function trActiveTeam(){
  if(myIsAdmin && _trViewTeam) return _trViewTeam;
  return myTeam || 'Processing';
}
function trShape(team){ return TR_SHAPES[_teamKey(team||trActiveTeam())] || 'log'; }
function trIsLead(){
  if(myIsAdmin) return true;
  var lead = (typeof myIsShiftAdmin!=='undefined' && myIsShiftAdmin===true) || (typeof myHasShiftops!=='undefined' && myHasShiftops===true);
  return lead && _teamKey(myTeam)===_teamKey(trActiveTeam());
}
function trCanEnter(){ return myIsAdmin || _teamKey(myTeam)===_teamKey(trActiveTeam()); }

function initReportsPage(){
  nxUpdateReportNav();
  const _fr = (typeof nxFortCurrent === 'function') ? nxFortCurrent() : null;
  const today = new Date();
  const start = new Date(today); start.setDate(today.getDate()-13);
  const fmt = function(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
  ['reportPageStart','mgrStart'].forEach(function(id){
    const el = document.getElementById(id);
    if(el && !el.value) el.value = _fr ? _fr.from : fmt(start);
  });
  ['reportPageEnd','mgrEnd'].forEach(function(id){
    const el = document.getElementById(id);
    if(el && !el.value) el.value = _fr ? _fr.to : fmt(today);
  });
  if(typeof nxInitReportPeriods === 'function') nxInitReportPeriods();
}

var TR_WEEK_DAYS = 6;
var _trMetrics = [];
var _trMetricsAll = [];
var _trWeekOffset = 0;
var _trEditingDate = null;

function _trHeaders(){
  return { 'apikey':KEY, 'Authorization':'Bearer '+KEY, 'Content-Type':'application/json' };
}
function _trToday(){
  var d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function _trYMD(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function _trMonday(dStr){
  var d = new Date(dStr + 'T00:00:00');
  var dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return _trYMD(d);
}
function _trAddDays(dStr, n){
  var d = new Date(dStr + 'T00:00:00'); d.setDate(d.getDate()+n);
  return _trYMD(d);
}
function _trFmtDay(dStr){
  return new Date(dStr+'T00:00:00').toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'});
}
function _trEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function _trFieldId(key){ return 'trm_' + key; }

async function trLoadMetrics(){
  try{
    var url = SB + '/rest/v1/processing_metrics?team=eq.' + encodeURIComponent(trActiveTeam()) + '&order=sort_order.asc';
    var r = await fetch(url, { headers:_trHeaders() });
    var rows = await r.json();
    _trMetricsAll = Array.isArray(rows) ? rows : [];
    _trMetrics = _trMetricsAll.filter(function(m){ return !m.archived; });
  }catch(e){ _trMetricsAll = _trMetrics = []; }
  return _trMetrics;
}

function trRenderMetricFields(){
  var host = document.getElementById('trMetricFields');
  if(!host) return;
  if(!_trMetrics.length){
    host.innerHTML = '<div style="font-size:12px;color:var(--ui-ink-4,#94a3b8);">No metrics set up yet.' + (myIsAdmin ? ' Add some under \u201CManage metrics\u201D below.' : '') + '</div>';
    return;
  }
  host.innerHTML = _trMetrics.map(function(m){
    return '<div><label class="tr-lbl">'+_trEsc(m.label)+'</label>'+
      '<input type="number" min="0" id="'+_trFieldId(m.metric_key)+'" class="tr-num" placeholder="0"></div>';
  }).join('');
}

var _trInited = false;
async function initTeamReport(){
  if(!trTeamHasReport(trActiveTeam())){
    if(myIsAdmin){
      var first = ['Processing','Enrolment','Placement','Accounts','Education'].filter(trTeamHasReport)[0];
      if(first) _trViewTeam = first;
    }
  }
  var team = trActiveTeam();
  var shape = trShape(team);
  if(shape!=='metrics'){ _trMetrics = []; _trMetricsAll = []; }
  var _hint = document.getElementById('trEntryHint');
  if(_hint) _hint.textContent = (shape==='metrics')
    ? 'Log your work for the day. You can update it any time during the week; the totals roll up into the weekly report.'
    : 'Log your work for the day. You can update it any time during the week; it feeds into the weekly report.';

  trRenderTeamPicker();

  var adminCard   = document.getElementById('trAdminCard');
  var metricAdmin = document.getElementById('trMetricAdminCard');
  if(adminCard)   adminCard.style.display   = trIsLead() ? '' : 'none';
  if(metricAdmin) metricAdmin.style.display = (myIsAdmin && shape==='metrics') ? '' : 'none';

  var entryCard = document.getElementById('trEntryCard');
  var weekCard  = document.getElementById('trMyWeekCard');
  var showEntry = trCanEnter();
  if(entryCard) entryCard.style.display = showEntry ? '' : 'none';
  if(weekCard)  weekCard.style.display  = showEntry ? '' : 'none';

  var metricFields = document.getElementById('trMetricFields');
  if(metricFields) metricFields.style.display = (shape==='metrics') ? '' : 'none';

  trRenderPlacementSections();
  trRenderThemePicker();

  if(!_trInited){
    _trInited = true;
    var dEl = document.getElementById('trDate');   if(dEl && !dEl.value) dEl.value = _trToday();
    var wEl = document.getElementById('trWeekPick'); if(wEl && !wEl.value) wEl.value = _trToday();
  }

  if(shape==='metrics'){ await trLoadMetrics(); if(myIsAdmin) trRenderMetricAdmin(); }
  if(showEntry){ if(shape==='metrics') trRenderMetricFields(); await trLoadDay(); trRenderMyWeek(); }
}

var _trLoadedSnapshot = null;
var _trLoadedDate = null;
function _trFormSnapshot(){
  var parts = _trMetrics.map(function(m){ var el=document.getElementById(_trFieldId(m.metric_key)); return el?String(el.value||''):''; });
  var t=document.getElementById('tr_tasks'); parts.push(t?String(t.value||''):'');
  return parts.join('\u0001');
}
function _trIsDirty(){ return _trLoadedSnapshot !== null && _trFormSnapshot() !== _trLoadedSnapshot; }

async function trDateChanged(){
  if(_trIsDirty()){
    var ok = await nxConfirm("Switch day and discard them?\n\nChoose Cancel, then click “Save” first to keep them.",{title:"Unsaved changes for " + (_trLoadedDate||'this day'),okText:'Discard changes',danger:true});
    if(!ok){ if(_trLoadedDate) document.getElementById('trDate').value = _trLoadedDate; return; }
  }
  var d = document.getElementById('trDate').value || _trToday();
  _trEditingDate = (d === _trToday()) ? null : d;
  trLoadDay().then(trUpdateEntryHeader);
}

async function trLoadDay(){
  if(!trCanEnter()) return;
  var date = document.getElementById('trDate').value || _trToday();
  var msg=document.getElementById('trSaveMsg'); if(msg) msg.textContent='';
  try{
    var url = SB + '/rest/v1/processing_reports?staff_name=eq.' + encodeURIComponent(me) +
              '&report_date=eq.' + encodeURIComponent(date) + '&limit=1';
    var r = await fetch(url, { headers:_trHeaders() });
    var rows = await r.json();
    var row = (Array.isArray(rows) && rows.length) ? rows[0] : null;
    var vals = (row && row.metrics) ? row.metrics : {};
    _trMetrics.forEach(function(m){
      var el = document.getElementById(_trFieldId(m.metric_key));
      if(el) el.value = row ? (vals[m.metric_key] != null ? vals[m.metric_key] : 0) : '';
    });
    var t=document.getElementById('tr_tasks'); if(t) t.value = row ? (row.tasks || '') : '';
    _trLoadedSnapshot = _trFormSnapshot();
    _trLoadedDate = date;
  }catch(e){ /* leave form as-is */ }
}

async function trSaveDay(btnEl){
  if(!trCanEnter()) return;
  var date = document.getElementById('trDate').value || _trToday();
  var btn = btnEl || document.getElementById('trSaveBtn'); var msg = document.getElementById('trSaveMsg');
  btn.disabled = true; var orig = btn.textContent; btn.textContent = 'Saving…'; if(msg) msg.textContent='';
  var vals = {};
  _trMetrics.forEach(function(m){
    var el = document.getElementById(_trFieldId(m.metric_key));
    var v = el ? parseInt(el.value,10) : 0;
    vals[m.metric_key] = (isNaN(v)||v<0) ? 0 : v;
  });
  var body = { staff_name: me, report_date: date,
    metrics: vals,
    tasks: (document.getElementById('tr_tasks').value||'').trim(),
    updated_at: new Date().toISOString() };
  try{
    var r = await fetch(SB + '/rest/v1/processing_reports?on_conflict=staff_name,report_date', {
      method:'POST',
      headers: Object.assign({ 'Prefer':'resolution=merge-duplicates,return=minimal' }, _trHeaders()),
      body: JSON.stringify(body)
    });
    if(r.ok){ msg.style.color='#059669'; msg.textContent='✓ Saved';
      _trMetrics.forEach(function(m){
        var el = document.getElementById(_trFieldId(m.metric_key));
        if(el) el.value = '';
      });
      var _tt = document.getElementById('tr_tasks'); if(_tt) _tt.value = '';
      _trLoadedSnapshot=_trFormSnapshot(); _trLoadedDate=date;
      _trEditingDate = null;
      var _dp=document.getElementById('trDate'); if(_dp) _dp.value=_trToday();
      trUpdateEntryHeader();
      trRenderMyWeek(); }
    else { msg.style.color='#dc2626'; msg.textContent='Save failed — try again'; }
  }catch(e){ msg.style.color='#dc2626'; msg.textContent='Network error'; }
  finally{ btn.disabled=false; trUpdateEntryHeader(); if(btn.textContent==='Saving…') btn.textContent=orig; setTimeout(function(){ if(msg.textContent==='✓ Saved') msg.textContent=''; }, 2500); }
}

function _trTaskCell(row){
  if(!row || !row.tasks || !String(row.tasks).trim()) return '<td><span style="color:#cbd5e1;">–</span></td>';
  var items = String(row.tasks).split(/\r?\n/).map(function(x){return x.trim();}).filter(Boolean);
  var txt = items.join(' · ');
  if(txt.length > 110) txt = txt.slice(0,107) + '…';
  return '<td style="font-size:12px;color:var(--ui-ink-2b,#475569);">'+_trEsc(txt)+'</td>';
}

async function trRenderMyWeek(){
  var isLog = trShape(trActiveTeam()) !== 'metrics';
  var mount = document.getElementById('trMyWeek');
  if(!mount) return;
  var baseMon = _trMonday(document.getElementById('trDate').value || _trToday());
  var mon = _trAddDays(baseMon, _trWeekOffset*7);
  var sun = _trAddDays(mon, TR_WEEK_DAYS-1);
  var thisMon = _trMonday(_trToday());
  var isCurrentWeek = (mon === thisMon);
  mount.innerHTML = '<div style="font-size:12px;color:var(--ui-ink-4,#94a3b8);">'+nxSkel('lines',3)+'</div>';
  try{
    var url = SB + '/rest/v1/processing_reports?staff_name=eq.' + encodeURIComponent(me) +
              '&report_date=gte.' + mon + '&report_date=lte.' + sun + '&order=report_date.asc';
    var r = await fetch(url, { headers:_trHeaders() });
    var rows = await r.json();
    var byDate = {};
    (Array.isArray(rows)?rows:[]).forEach(function(row){ byDate[row.report_date] = row; });

    var tot = {}; _trMetrics.forEach(function(m){ tot[m.metric_key]=0; });
    var todayStr = _trToday();
    var bodyRows = '';
    for(var i=0;i<TR_WEEK_DAYS;i++){
      var dStr = _trAddDays(mon, i);
      var row = byDate[dStr];
      var isFuture = dStr > todayStr;
      var isToday = dStr === todayStr;
      var logged = !!row;
      var cells = isLog ? _trTaskCell(logged ? row : null) : _trMetrics.map(function(m){
        var v = logged ? (row.metrics && row.metrics[m.metric_key] || 0) : 0;
        if(logged) tot[m.metric_key]+=v;
        return '<td class="num">'+(logged? v : '<span style="color:#cbd5e1;">–</span>')+'</td>';
      }).join('');
      var action;
      if(isFuture){
        action = '<span style="font-size:11px;color:#cbd5e1;">—</span>';
      }else if(logged){
        action = '<button class="tr-day-btn tr-edit" onclick="event.stopPropagation();trEditDay(\''+dStr+'\')">✎ Edit</button>';
      }else{
        action = '<button class="tr-day-btn tr-add" onclick="event.stopPropagation();trEditDay(\''+dStr+'\')">＋ Add</button>';
      }
      var dayLabel = _trFmtDay(dStr) + (isToday?' <span style="color:#6366f1;font-weight:700;">· Today</span>':'');
      var statusDot = logged
        ? '<span class="tr-dot tr-dot-ok" title="Logged"></span>'
        : (isFuture ? '' : '<span class="tr-dot tr-dot-miss" title="Not logged"></span>');
      var rowCls = 'tr-wk-row' + (logged?'':' tr-wk-empty') + (isToday?' tr-wk-today':'');
      bodyRows += '<tr class="'+rowCls+'"'+(isFuture?'':' style="cursor:pointer;" onclick="trEditDay(\''+dStr+'\')"')+'>'+
        '<td style="white-space:nowrap;">'+statusDot+dayLabel+'</td>'+cells+
        '<td style="text-align:right;">'+action+'</td></tr>';
    }
    var head = '<th>Day</th>' + _trMetrics.map(function(m){ return '<th class="num">'+_trEsc(m.label)+'</th>'; }).join('') + '<th></th>';
    var totRow = '<tr class="tot"><td>Total</td>' + _trMetrics.map(function(m){ return '<td class="num">'+tot[m.metric_key]+'</td>'; }).join('') + '<td></td></tr>';
    if(isLog){ head = '<th>Day</th><th>Tasks</th><th></th>'; totRow = ''; }

    var weekLabel = isCurrentWeek ? 'This week' :
      (_trWeekOffset === -1 ? 'Last week' : 'Week of '+_trFmtDay(mon));
    var nav = '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;flex-wrap:wrap;">'+
      '<div style="display:flex;align-items:center;gap:6px;">'+
        '<button class="tr-nav-btn" onclick="trWeekNav(-1)" title="Previous week">‹</button>'+
        '<span style="font-size:12.5px;font-weight:700;color:var(--ui-ink-2,#334155);min-width:110px;text-align:center;">'+weekLabel+'</span>'+
        '<button class="tr-nav-btn" onclick="trWeekNav(1)" '+(isCurrentWeek?'disabled':'')+' title="Next week">›</button>'+
      '</div>'+
      (isCurrentWeek?'':'<button class="tr-nav-btn tr-nav-today" onclick="trWeekToday()">Jump to this week</button>')+
      '</div>';

    var hint = '<div style="font-size:11.5px;color:var(--ui-ink-4,#94a3b8);margin-bottom:10px;">Tap any day to edit it, or use the Edit / ＋ Add buttons.</div>';

    mount.innerHTML = nav + hint + '<div style="overflow-x:auto;"><table class="tr-table"><thead><tr>'+head+'</tr></thead><tbody>'+bodyRows+totRow+'</tbody></table></div>';
  }catch(e){ mount.innerHTML = '<div style="font-size:12px;color:#dc2626;">Could not load your week.</div>'; }
}

function trWeekNav(delta){
  var next = _trWeekOffset + delta;
  if(next > 0) next = 0;
  _trWeekOffset = next;
  trRenderMyWeek();
}
function trWeekToday(){ _trWeekOffset = 0; trRenderMyWeek(); }

async function trEditDay(date){
  if(!trCanEnter()) return;
  if(_trIsDirty()){
    var ok = await nxConfirm("Switch day and discard them?\n\nChoose Cancel, then click “Save” first to keep them.",{title:"Unsaved changes for " + (_trLoadedDate||'this day'),okText:'Discard changes',danger:true});
    if(!ok) return;
  }
  var dp = document.getElementById('trDate'); if(dp) dp.value = date;
  _trEditingDate = (date === _trToday()) ? null : date;
  await trLoadDay();
  trUpdateEntryHeader();
  var card = document.getElementById('trEntryCard');
  if(card){
    card.classList.add('tr-editing-flash');
    setTimeout(function(){ card.classList.remove('tr-editing-flash'); }, 900);
    if(card.scrollIntoView) card.scrollIntoView({behavior:'smooth', block:'start'});
  }
}

function trUpdateEntryHeader(){
  var title = document.getElementById('trEntryTitle');
  var btn   = document.getElementById('trSaveBtn');
  var back  = document.getElementById('trBackToday');
  var editing = _trEditingDate && _trEditingDate !== _trToday();
  if(title){
    title.innerHTML = editing
      ? 'Editing <span style="color:#6366f1;">'+_trFmtDay(_trEditingDate)+'</span>'
      : 'Daily work log';
  }
  if(btn){ btn.textContent = editing ? 'Update this day' : "Save today's log"; }
  if(back){ back.style.display = editing ? '' : 'none'; }
}

async function trNewToday(){
  if(_trIsDirty()){
    var ok = await nxConfirm("Discard them and start today’s log?",{title:'Unsaved changes',okText:'Discard changes',danger:true});
    if(!ok) return;
  }
  _trEditingDate = null;
  var dp = document.getElementById('trDate'); if(dp) dp.value = _trToday();
  await trLoadDay();
  trUpdateEntryHeader();
}

function trRenderMetricAdmin(){
  var host = document.getElementById('trMetricList');
  if(!host) return;
  if(!_trMetricsAll.length){ host.innerHTML = '<div style="font-size:12px;color:var(--ui-ink-4,#94a3b8);">No metrics yet. Add your first below.</div>'; return; }
  var active = _trMetricsAll.filter(function(m){return !m.archived;}).sort(function(a,b){return a.sort_order-b.sort_order;});
  var archived = _trMetricsAll.filter(function(m){return m.archived;});
  var rows = active.map(function(m, i){
    return '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #eef2f7;">'+
      '<span style="font-family:var(--mono);font-size:11px;color:var(--ui-ink-4,#94a3b8);width:20px;">'+(i+1)+'</span>'+
      '<span style="flex:1;font-size:13px;color:var(--ui-ink,#0f172a);">'+_trEsc(m.label)+'</span>'+
      '<button title="Move up" onclick="trMoveMetric(\''+m.metric_key+'\',-1)" style="border:1px solid var(--ui-line,#e2e8f0);background:var(--ui-surface,#fff);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:12px;"'+(i===0?' disabled':'')+'>↑</button>'+
      '<button title="Move down" onclick="trMoveMetric(\''+m.metric_key+'\',1)" style="border:1px solid var(--ui-line,#e2e8f0);background:var(--ui-surface,#fff);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:12px;"'+(i===active.length-1?' disabled':'')+'>↓</button>'+
      '<button title="Rename" onclick="trRenameMetric(\''+m.metric_key+'\')" style="border:1px solid var(--ui-line,#e2e8f0);background:var(--ui-surface,#fff);border-radius:6px;padding:3px 10px;cursor:pointer;font-size:12px;">Rename</button>'+
      '<button title="Archive" onclick="trArchiveMetric(\''+m.metric_key+'\',true)" style="border:1px solid #fecaca;color:#dc2626;background:var(--ui-surface,#fff);border-radius:6px;padding:3px 10px;cursor:pointer;font-size:12px;">Archive</button>'+
      '</div>';
  }).join('');
  var arch = archived.length ? ('<div style="margin-top:12px;font-size:11px;font-weight:700;color:var(--ui-ink-4,#94a3b8);text-transform:uppercase;letter-spacing:.04em;">Archived</div>' +
    archived.map(function(m){
      return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;">'+
        '<span style="flex:1;font-size:13px;color:var(--ui-ink-4,#94a3b8);text-decoration:line-through;">'+_trEsc(m.label)+'</span>'+
        '<button onclick="trArchiveMetric(\''+m.metric_key+'\',false)" style="border:1px solid #bbf7d0;color:#059669;background:var(--ui-surface,#fff);border-radius:6px;padding:3px 10px;cursor:pointer;font-size:12px;">Restore</button>'+
        '</div>';
    }).join('')) : '';
  host.innerHTML = rows + arch;
}

function _trMetricMsg(txt, ok){
  var m=document.getElementById('trMetricMsg'); if(!m) return;
  m.style.color = ok ? '#059669' : '#dc2626'; m.textContent = txt;
  setTimeout(function(){ if(m.textContent===txt) m.textContent=''; }, 3000);
}

function _trSlug(label){
  return String(label).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40) || ('metric_'+Date.now());
}

async function trAddMetric(){
  if(!myIsAdmin) return;
  var input = document.getElementById('trNewMetric');
  var label = (input.value||'').trim();
  if(!label){ _trMetricMsg('Enter a metric name.', false); return; }
  var key = _trSlug(label);
  var existing = _trMetricsAll.find(function(m){ return m.metric_key===key; });
  try{
    if(existing){
      if(existing.archived){ await trArchiveMetric(key, false); input.value=''; _trMetricMsg('Restored existing metric.', true); return; }
      _trMetricMsg('A metric with that name already exists.', false); return;
    }
    var maxOrder = _trMetricsAll.reduce(function(a,m){ return Math.max(a, m.sort_order||0); }, 0);
    var r = await fetch(SB + '/rest/v1/processing_metrics', {
      method:'POST',
      headers: Object.assign({ 'Prefer':'return=minimal' }, _trHeaders()),
      body: JSON.stringify({ team:trActiveTeam(), metric_key:key, label:label, sort_order:maxOrder+1 })
    });
    if(!r.ok){ _trMetricMsg('Could not add metric.', false); return; }
    input.value='';
    await trLoadMetrics(); trRenderMetricAdmin(); if(trShape()==="metrics") trRenderMetricFields();
    _trMetricMsg('Metric added.', true);
  }catch(e){ _trMetricMsg('Network error.', false); }
}

async function trRenameMetric(key){
  if(!myIsAdmin) return;
  var m = _trMetricsAll.find(function(x){return x.metric_key===key;});
  if(!m) return;
  var nl = await nxPrompt('Enter the new name for this metric.', m.label, {title:'Rename metric',okText:'Rename',validate:function(v){ return v.trim()?'':'Name cannot be empty.'; }});
  if(nl===null) return;
  nl = nl.trim(); if(!nl){ _trMetricMsg('Name cannot be empty.', false); return; }
  try{
    var r = await fetch(SB + '/rest/v1/processing_metrics?team=eq.'+encodeURIComponent(trActiveTeam())+'&metric_key=eq.'+encodeURIComponent(key), {
      method:'PATCH', headers: Object.assign({ 'Prefer':'return=minimal' }, _trHeaders()),
      body: JSON.stringify({ label:nl })
    });
    if(!r.ok){ _trMetricMsg('Rename failed.', false); return; }
    await trLoadMetrics(); trRenderMetricAdmin(); if(trShape()==="metrics") trRenderMetricFields();
    _trMetricMsg('Renamed.', true);
  }catch(e){ _trMetricMsg('Network error.', false); }
}

async function trArchiveMetric(key, archived){
  if(!myIsAdmin) return;
  if(archived && !(await nxConfirm('Staff will stop logging it and it will drop out of future reports. Past data is kept.',{title:'Archive this metric?',okText:'Archive',danger:true}))) return;
  try{
    var r = await fetch(SB + '/rest/v1/processing_metrics?team=eq.'+encodeURIComponent(trActiveTeam())+'&metric_key=eq.'+encodeURIComponent(key), {
      method:'PATCH', headers: Object.assign({ 'Prefer':'return=minimal' }, _trHeaders()),
      body: JSON.stringify({ archived: !!archived })
    });
    if(!r.ok){ _trMetricMsg('Update failed.', false); return; }
    await trLoadMetrics(); trRenderMetricAdmin(); if(trShape()==="metrics"){ trRenderMetricFields(); trLoadDay(); }
    _trMetricMsg(archived?'Archived.':'Restored.', true);
  }catch(e){ _trMetricMsg('Network error.', false); }
}

async function trMoveMetric(key, dir){
  if(!myIsAdmin) return;
  var active = _trMetricsAll.filter(function(m){return !m.archived;}).sort(function(a,b){return a.sort_order-b.sort_order;});
  var idx = active.findIndex(function(m){return m.metric_key===key;});
  var swap = idx + dir;
  if(idx<0 || swap<0 || swap>=active.length) return;
  var a = active[idx], b = active[swap];
  try{
    await fetch(SB + '/rest/v1/processing_metrics?team=eq.'+encodeURIComponent(trActiveTeam())+'&metric_key=eq.'+encodeURIComponent(a.metric_key), {
      method:'PATCH', headers: Object.assign({ 'Prefer':'return=minimal' }, _trHeaders()), body: JSON.stringify({ sort_order: b.sort_order }) });
    await fetch(SB + '/rest/v1/processing_metrics?team=eq.'+encodeURIComponent(trActiveTeam())+'&metric_key=eq.'+encodeURIComponent(b.metric_key), {
      method:'PATCH', headers: Object.assign({ 'Prefer':'return=minimal' }, _trHeaders()), body: JSON.stringify({ sort_order: a.sort_order }) });
    await trLoadMetrics(); trRenderMetricAdmin(); if(trShape()==="metrics") trRenderMetricFields();
  }catch(e){ _trMetricMsg('Reorder failed.', false); }
}

async function trGenerateReport(){
  if(!trIsLead()) return;
  if(trShape(trActiveTeam())==='placement'){ return trGeneratePlacementReport(); }
  var isLog = trShape(trActiveTeam()) !== 'metrics';
  if(isLog){ _trMetrics = []; _trMetricsAll = []; }
  var out = document.getElementById('trReportOut');
  var pick = document.getElementById('trWeekPick').value || _trToday();
  var mon = _trMonday(pick), sun = _trAddDays(mon,TR_WEEK_DAYS-1);
  _trOutState('loading');
  _trPdf(false);
  try{
    if(!isLog && !_trMetrics.length) await trLoadMetrics();
    var teamResp = await fetch(SB + '/rest/v1/staff_credentials?team=eq.'+encodeURIComponent(trActiveTeam())+'&select=staff_name&order=staff_name.asc', { headers:_trHeaders() });
    var teamRows = await teamResp.json();
    var team = (Array.isArray(teamRows)?teamRows:[]).map(function(x){ return x.staff_name; }).filter(Boolean);

    var repResp = await fetch(SB + '/rest/v1/processing_reports?report_date=gte.' + mon + '&report_date=lte.' + sun + '&order=staff_name.asc,report_date.asc', { headers:_trHeaders() });
    var reps = await repResp.json(); reps = Array.isArray(reps) ? reps : [];

    var callsByStaff = {};
    if(!isLog) try{
      var sunNext = _trAddDays(mon, TR_WEEK_DAYS);
      var clUrl = SB + '/rest/v1/call_log?created_at=gte.' + mon + '&created_at=lt.' + sunNext + '&deleted_at=is.null&select=logged_by';
      var clResp = await fetch(clUrl, { headers:_trHeaders() });
      var clRows = await clResp.json();
      (Array.isArray(clRows)?clRows:[]).forEach(function(r){ var w=(r.logged_by||'').trim(); if(w) callsByStaff[w]=(callsByStaff[w]||0)+1; });
    }catch(e){}

    var byStaff = {};
    var _teamSet = {}; team.forEach(function(n){ _teamSet[n]=true; });
    reps.forEach(function(r){ if(_teamSet[r.staff_name]) (byStaff[r.staff_name]=byStaff[r.staff_name]||[]).push(r); });
    team.forEach(function(n){ if(!byStaff[n]) byStaff[n]=[]; });
    var names = Object.keys(byStaff).sort();
    if(!names.length){ out.innerHTML = '<div style="font-size:13px;color:var(--ui-ink-4,#94a3b8);">No '+trActiveTeam()+' staff found.</div>'; return; }

    var mkeys = _trMetrics.map(function(m){return m.metric_key;});
    var mlabels = _trMetrics.map(function(m){return m.label;});

    var weekDates=[]; for(var wi=0;wi<TR_WEEK_DAYS;wi++) weekDates.push(_trAddDays(mon,wi));
    var pdfMetrics=[], pdfTasks=[];
    var grand={calls:0}; mkeys.forEach(function(k){ grand[k]=0; });

    var html = '<div id="trPrintable">';
    html += '<div style="margin-bottom:14px;"><div style="font-size:16px;font-weight:800;color:var(--ui-ink,#0f172a);">'+trActiveTeam()+' — '+(isLog?'Daily Work Log':'Weekly Report')+'</div>'+
            '<div style="font-size:12.5px;color:var(--ui-ink-3,#64748b);">Week of '+_trFmtDay(mon)+' – '+_trFmtDay(sun)+'</div></div>';

    names.forEach(function(name){
      var rows = byStaff[name];
      var t={}; mkeys.forEach(function(k){t[k]=0;});
      var byDate={}; var notes=[];
      var dayRows = rows.map(function(row){
        var vals=row.metrics||{};
        byDate[row.report_date]=row;
        var cells = mkeys.map(function(k){ var v=vals[k]||0; t[k]+=v; return '<td class="num">'+v+'</td>'; }).join('');
        if(row.tasks && row.tasks.trim()){
          row.tasks.split(/\r?\n/).map(function(x){return x.trim();}).filter(Boolean).forEach(function(tk){ notes.push(_trFmtDay(row.report_date)+': '+_trEsc(tk)); });
        }
        return '<tr><td>'+_trFmtDay(row.report_date)+'</td>'+cells+'</tr>';
      }).join('');
      var calls = callsByStaff[name]||0;
      mkeys.forEach(function(k){ grand[k]+=t[k]; }); grand.calls+=calls;

      pdfMetrics.push(Object.assign({name:name, calls:calls}, (function(){var o={};mkeys.forEach(function(k){o[k]=t[k];});return o;})()));
      pdfTasks.push({ name:name, days: weekDates.map(function(d){ var rr=byDate[d]; return (rr&&rr.tasks&&rr.tasks.trim())? rr.tasks.split(/\r?\n/).map(function(x){return x.trim();}).filter(Boolean):[]; }) });

      html += '<div class="tr-person-h">'+_trEsc(name)+'</div>';
      if(isLog){
        if(!rows.length){ html += '<div style="font-size:12px;color:#cbd5e1;margin-bottom:8px;">No entries this week.</div>'; }
        else {
          var logRows = rows.map(function(row){
            var items = (row.tasks||'').split(/\r?\n/).map(function(x){return x.trim();}).filter(Boolean);
            var cell = items.length ? items.map(function(x){return '\u2022 '+_trEsc(x);}).join('<br>') : '<span style="color:#cbd5e1;">\u2014</span>';
            return '<tr><td style="white-space:nowrap;vertical-align:top;">'+_trFmtDay(row.report_date)+'</td><td>'+cell+'</td></tr>';
          }).join('');
          html += '<div style="overflow-x:auto;"><table class="tr-table"><thead><tr><th>Day</th><th>Tasks</th></tr></thead><tbody>'+logRows+'</tbody></table></div>';
        }
        return;
      }
      html += '<div style="font-size:12.5px;color:var(--ui-ink-2b,#475569);margin:0 0 8px;"><strong>Calls made this week:</strong> '+calls+'</div>';
      if(!rows.length){ html += '<div style="font-size:12px;color:#cbd5e1;margin-bottom:8px;">No report entries this week.</div>'; }
      else {
        var head='<th>Day</th>'+mlabels.map(function(l){return '<th class="num">'+_trEsc(l)+'</th>';}).join('');
        var totRow='<tr class="tot"><td>Total</td>'+mkeys.map(function(k){return '<td class="num">'+t[k]+'</td>';}).join('')+'</tr>';
        html += '<div style="overflow-x:auto;"><table class="tr-table"><thead><tr>'+head+'</tr></thead><tbody>'+dayRows+totRow+'</tbody></table></div>';
        if(notes.length){ html += '<div style="font-size:12px;color:var(--ui-ink-2b,#475569);margin:8px 0 4px;"><strong>Tasks:</strong></div><ul style="margin:0 0 6px;padding-left:18px;font-size:12px;color:var(--ui-ink-2b,#475569);line-height:1.6;">'+notes.map(function(c){return '<li>'+c+'</li>';}).join('')+'</ul>'; }
      }
    });

    if(!isLog) html += '<div class="tr-person-h" style="margin-top:20px;">Team total</div>'+
      '<div style="overflow-x:auto;"><table class="tr-table"><thead><tr><th>Metric</th><th class="num">Total</th></tr></thead><tbody>'+
      '<tr><td>Calls Made</td><td class="num">'+grand.calls+'</td></tr>'+
      _trMetrics.map(function(m){ return '<tr><td>'+_trEsc(m.label)+'</td><td class="num">'+grand[m.metric_key]+'</td></tr>'; }).join('')+
      '</tbody></table></div>';
    html += '</div>';
    _trOutState('report', html);

    window._trReportData = { mon:mon, sun:sun, weekDates:weekDates, metricKeys:mkeys, metricLabels:mlabels,
      metrics:pdfMetrics, tasks:pdfTasks, shape:(isLog?'log':'metrics'), preparedBy:(window.me||me||'') };
    _trPdf(true);
  }catch(e){ _trOutState('error'); }
}


var TR_TEAM_COLORS = {
  placement:  { head:[71,85,105],   accent:[100,116,139], zebra:[243,245,248], total:[224,228,234], line:[210,216,224] },
  evershine:  { head:[7,89,133],    accent:[14,165,233],  zebra:[240,249,255], total:[207,232,250], line:[204,226,242] },
  processing: { head:[6,95,70],     accent:[5,150,105],   zebra:[240,250,246], total:[209,250,229], line:[210,228,222] },
  enrolment:  { head:[49,46,129],   accent:[79,70,229],   zebra:[243,243,255], total:[224,222,252], line:[214,214,240] },
  accounts:   { head:[146,64,14],   accent:[217,119,6],   zebra:[255,248,237], total:[253,230,201], line:[246,222,195] },
  education:  { head:[17,75,85],    accent:[13,148,136],  zebra:[240,249,249], total:[204,242,241], line:[208,228,228] }
};
var _DEF_COLORS = { head:[30,58,95], accent:[37,99,235], zebra:[240,244,250], total:[219,234,254], line:[210,220,235] };
function _trPal(){ return TR_TEAM_COLORS[_teamKey(trActiveTeam())] || _DEF_COLORS; }

function trRenderTeamPicker(){
  var host = document.getElementById('trTeamPicker');
  if(!host) return;
  if(!myIsAdmin){ host.style.display='none'; return; }
  host.style.display='';
  var teams = ['Processing','Enrolment','Placement','Evershine','Accounts','Education'].filter(trTeamHasReport);
  if(!_trViewTeam) _trViewTeam = trActiveTeam();
  host.innerHTML = '<label class="tr-lbl" style="margin-right:8px;">Viewing team</label>'+
    '<select id="trTeamSel" class="tr-num" style="width:auto;min-width:150px;" onchange="trSwitchTeam(this.value)">'+
    teams.map(function(t){ return '<option value="'+t+'"'+(_teamKey(t)===_teamKey(_trViewTeam)?' selected':'')+'>'+_trEsc(t)+'</option>'; }).join('')+
    '</select>';
}
async function trSwitchTeam(t){
  _trViewTeam = t; _trInited = false;
  _trOutState('empty'); _trPdf(false);
  await initTeamReport();
}

function trRenderThemePicker(){
  var host = document.getElementById('trThemePicker');
  if(host){ host.style.display='none'; host.innerHTML=''; }
}

var _plWeek = null;
function _plMonday(){ return _trMonday((document.getElementById('trWeekPick') && document.getElementById('trWeekPick').value) || _trToday()); }

function trRenderPlacementSections(){
  var host = document.getElementById('trPlacementCard');
  if(!host) return;
  if(trShape(trActiveTeam())!=='placement' || !trIsLead()){ host.style.display='none'; return; }
  host.style.display='';
  trLoadPlacementWeek();
}
async function trLoadPlacementWeek(){
  var host = document.getElementById('trPlacementBody');
  if(!host) return;
  var mon = _plMonday();
  try{
    var r = await fetch(SB + '/rest/v1/placement_weekly?team=eq.'+encodeURIComponent(trActiveTeam())+'&week_start=eq.'+mon+'&limit=1', { headers:_trHeaders() });
    var rows = await r.json();
    _plWeek = (Array.isArray(rows) && rows.length) ? rows[0] : { students:{}, cancellations:[], facility_issues:[], student_issues:[] };
  }catch(e){ _plWeek = { students:{}, cancellations:[], facility_issues:[], student_issues:[] }; }
  trRenderPlacementForm();
}
function _plRowsHtml(arr, cols, key){
  arr = Array.isArray(arr)?arr:[];
  var head = '<tr>'+cols.map(function(c){return '<th>'+c.label+'</th>';}).join('')+'<th></th></tr>';
  var body = arr.map(function(row,i){
    return '<tr>'+cols.map(function(c){
      return '<td><input class="tr-num" style="width:100%;min-width:90px;" data-pl="'+key+'" data-i="'+i+'" data-f="'+c.f+'" value="'+_trEsc(row[c.f]||'')+'"></td>';
    }).join('')+'<td><button class="tr-x" title="Remove row" onclick="plDelRow(\''+key+'\','+i+')">×</button></td></tr>';
  }).join('');
  if(!arr.length) body = '<tr><td colspan="'+(cols.length+1)+'" style="color:var(--ui-ink-4,#94a3b8);font-size:12px;">None — click Add row to log one.</td></tr>';
  return '<div style="overflow-x:auto;"><table class="tr-table"><thead>'+head+'</thead><tbody>'+body+'</tbody></table></div>'+
    '<button class="tr-addrow" onclick="plAddRow(\''+key+'\')">+ Add row</button>';
}
function trRenderPlacementForm(){
  var host = document.getElementById('trPlacementBody');
  if(!host) return;
  var s = _plWeek.students||{};
  host.innerHTML =
    '<div class="pl-sec"><div class="pl-h">1 · Placement students (commenced this week)</div>'+
      '<div class="pl-grid3">'+
        '<div><label class="tr-lbl">Total</label><input type="number" min="0" class="tr-num" id="pl_total" value="'+_trEsc(s.total!=null?s.total:'')+'"></div>'+
        '<div><label class="tr-lbl">Within Sydney/NSW</label><input type="number" min="0" class="tr-num" id="pl_within" value="'+_trEsc(s.within_nsw!=null?s.within_nsw:'')+'"></div>'+
        '<div><label class="tr-lbl">Outside NSW / Regional</label><input type="number" min="0" class="tr-num" id="pl_outside" value="'+_trEsc(s.outside_nsw!=null?s.outside_nsw:'')+'"></div>'+
      '</div></div>'+
    '<div class="pl-sec"><div class="pl-h">2 · Placement cancellations</div>'+
      _plRowsHtml(_plWeek.cancellations, [{label:'Student',f:'student'},{label:'Facility',f:'facility'},{label:'Reason',f:'reason'},{label:'Action taken',f:'action'}], 'cancellations')+'</div>'+
    '<div class="pl-sec"><div class="pl-h">3 · Facility issues</div>'+
      _plRowsHtml(_plWeek.facility_issues, [{label:'Facility',f:'facility'},{label:'Issue',f:'issue'},{label:'Status',f:'status'}], 'facility_issues')+'</div>'+
    '<div class="pl-sec"><div class="pl-h">4 · Student issues</div>'+
      _plRowsHtml(_plWeek.student_issues, [{label:'Student',f:'student'},{label:'Issue',f:'issue'},{label:'Current status',f:'status'}], 'student_issues')+'</div>'+
    '<div style="display:flex;align-items:center;gap:12px;margin-top:6px;">'+
      '<button class="btn-primary" style="padding:8px 16px;" onclick="plSaveWeek(this)">Save weekly sections</button>'+
      '<span id="plSaveMsg" style="font-size:12px;"></span></div>';
}
function _plHarvest(){
  ['cancellations','facility_issues','student_issues'].forEach(function(key){
    (document.querySelectorAll('[data-pl="'+key+'"]')||[]).forEach(function(el){
      var i=+el.getAttribute('data-i'), f=el.getAttribute('data-f');
      _plWeek[key] = _plWeek[key]||[]; _plWeek[key][i] = _plWeek[key][i]||{}; _plWeek[key][i][f] = el.value;
    });
  });
  var t=document.getElementById('pl_total'), w=document.getElementById('pl_within'), o=document.getElementById('pl_outside');
  _plWeek.students = { total:t&&t.value!==''?+t.value:null, within_nsw:w&&w.value!==''?+w.value:null, outside_nsw:o&&o.value!==''?+o.value:null };
}
function plAddRow(key){ _plHarvest(); _plWeek[key]=_plWeek[key]||[]; _plWeek[key].push({}); trRenderPlacementForm(); }
function plDelRow(key,i){ _plHarvest(); _plWeek[key].splice(i,1); trRenderPlacementForm(); }
async function plSaveWeek(btn){
  if(!trIsLead()) return;
  _plHarvest();
  var msg=document.getElementById('plSaveMsg'); if(btn) btn.disabled=true;
  var mon=_plMonday();
  try{
    var r = await fetch(SB + '/rest/v1/placement_weekly?on_conflict=team,week_start', {
      method:'POST',
      headers: Object.assign({ 'Prefer':'resolution=merge-duplicates,return=minimal' }, _trHeaders()),
      body: JSON.stringify({ team:trActiveTeam(), week_start:mon, students:_plWeek.students||{}, cancellations:_plWeek.cancellations||[], facility_issues:_plWeek.facility_issues||[], student_issues:_plWeek.student_issues||[], updated_by:(window.me||me||''), updated_at:new Date().toISOString() })
    });
    if(!r.ok) throw new Error(r.status);
    if(msg){ msg.textContent='Saved'; msg.style.color='var(--ui-success,#0e8a5f)'; setTimeout(function(){msg.textContent='';},1500); }
  }catch(e){ if(msg){ msg.textContent='Could not save'; msg.style.color='#dc2626'; } }
  if(btn) btn.disabled=false;
}

async function trGeneratePlacementReport(){
  if(!trIsLead()) return;
  var out = document.getElementById('trReportOut');
  var pick = document.getElementById('trWeekPick').value || _trToday();
  var mon = _trMonday(pick), sun = _trAddDays(mon,TR_WEEK_DAYS-1);
  _trOutState('loading');
  _trPdf(false);
  try{
    var pr = await fetch(SB + '/rest/v1/placement_weekly?team=eq.'+encodeURIComponent(trActiveTeam())+'&week_start=eq.'+mon+'&limit=1', { headers:_trHeaders() });
    var prRows = await pr.json();
    var sec = (Array.isArray(prRows)&&prRows.length)?prRows[0]:{ students:{}, cancellations:[], facility_issues:[], student_issues:[] };
    var teamResp = await fetch(SB + '/rest/v1/staff_credentials?team=eq.'+encodeURIComponent(trActiveTeam())+'&select=staff_name&order=staff_name.asc', { headers:_trHeaders() });
    var teamRows = await teamResp.json();
    var members = (Array.isArray(teamRows)?teamRows:[]).map(function(x){return x.staff_name;}).filter(Boolean);
    var repResp = await fetch(SB + '/rest/v1/processing_reports?report_date=gte.'+mon+'&report_date=lte.'+sun+'&order=staff_name.asc,report_date.asc', { headers:_trHeaders() });
    var reps = await repResp.json(); reps = Array.isArray(reps)?reps:[];
    var weekDates=[]; for(var wi=0;wi<TR_WEEK_DAYS;wi++) weekDates.push(_trAddDays(mon,wi));
    var _memSet={}; members.forEach(function(n){ _memSet[n]=true; });
    var byName={}; reps.forEach(function(r){ if(_memSet[r.staff_name]) (byName[r.staff_name]=byName[r.staff_name]||{})[r.report_date]=r; });
    members.forEach(function(n){ if(!byName[n]) byName[n]={}; });
    function esc(x){ return _trEsc(x); }
    function tbl(rows, cols, emptyLabel){
      if(!rows || !rows.length) return '<div style="font-size:12.5px;color:var(--ui-ink-4,#94a3b8);margin:2px 0 6px;">'+emptyLabel+'</div>';
      return '<div style="overflow-x:auto;"><table class="tr-table"><thead><tr>'+cols.map(function(c){return '<th>'+c.label+'</th>';}).join('')+'</tr></thead><tbody>'+
        rows.map(function(r){ return '<tr>'+cols.map(function(c){return '<td>'+esc(r[c.f]||'')+'</td>';}).join('')+'</tr>'; }).join('')+'</tbody></table></div>';
    }
    var s=sec.students||{};
    var html='<div id="trPrintable">';
    html+='<div style="margin-bottom:14px;"><div style="font-size:16px;font-weight:800;color:var(--ui-ink,#0f172a);">Placement Team — Weekly Report</div>'+
          '<div style="font-size:12.5px;color:var(--ui-ink-3,#64748b);">Week of '+_trFmtDay(mon)+' – '+_trFmtDay(sun)+'</div></div>';
    html+='<div class="tr-person-h">1 · Placement students</div><div style="overflow-x:auto;"><table class="tr-table"><tbody>'+
      '<tr><td>Total commenced</td><td class="num">'+(s.total!=null?s.total:'—')+'</td></tr>'+
      '<tr><td>Within Sydney/NSW</td><td class="num">'+(s.within_nsw!=null?s.within_nsw:'—')+'</td></tr>'+
      '<tr><td>Outside NSW / Regional</td><td class="num">'+(s.outside_nsw!=null?s.outside_nsw:'—')+'</td></tr></tbody></table></div>';
    html+='<div class="tr-person-h">2 · Placement cancellations</div>'+tbl(sec.cancellations,[{label:'Student',f:'student'},{label:'Facility',f:'facility'},{label:'Reason',f:'reason'},{label:'Action taken',f:'action'}],'None this week.');
    html+='<div class="tr-person-h">3 · Facility issues</div>'+tbl(sec.facility_issues,[{label:'Facility',f:'facility'},{label:'Issue',f:'issue'},{label:'Status',f:'status'}],'None this week.');
    html+='<div class="tr-person-h">4 · Student issues</div>'+tbl(sec.student_issues,[{label:'Student',f:'student'},{label:'Issue',f:'issue'},{label:'Current status',f:'status'}],'None this week.');
    var dayHeads = weekDates.map(function(d){ return _trFmtDay(d); });
    html+='<div class="tr-person-h">5 · Team member daily task summary</div><div style="overflow-x:auto;"><table class="tr-table"><thead><tr><th>Member</th>'+dayHeads.map(function(h){return '<th>'+h+'</th>';}).join('')+'</tr></thead><tbody>';
    var gridRows=[];
    Object.keys(byName).sort().forEach(function(n){
      var cells=weekDates.map(function(d){ var rr=byName[n][d]; return (rr&&rr.tasks&&rr.tasks.trim())?rr.tasks.trim():''; });
      gridRows.push({ name:n, cells:cells });
      html+='<tr><td style="font-weight:700;">'+esc(n)+'</td>'+cells.map(function(c){ return '<td>'+(c?esc(c):'<span style="color:#cbd5e1;">—</span>')+'</td>'; }).join('')+'</tr>';
    });
    html+='</tbody></table></div></div>';
    _trOutState('report', html);
    window._trReportData = { placement:true, mon:mon, sun:sun, weekDates:weekDates, dayHeads:dayHeads, sections:sec, grid:gridRows, preparedBy:(window.me||me||''), team:trActiveTeam() };
    _trPdf(true);
  }catch(e){ _trOutState('error'); }
}

function trDownloadPlacementPdf(D){
  var JsPDF = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : window.jsPDF;
  if(!JsPDF){ nxAlert('Please refresh the page and try again.',{title:'PDF library not loaded'}); return; }
  var P=_trPal(), HEAD=P.head, ACC=P.accent, ZEBRA=P.zebra, LINE=P.line;
  var INK=[15,23,42], MUTED=[100,116,139];
  var doc = new JsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  var PW=doc.internal.pageSize.getWidth(), PH=doc.internal.pageSize.getHeight(), M=14;
  function fmtDay(dStr){ return new Date(dStr+'T00:00:00').toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'}); }
  function footer(){
    doc.setFontSize(7.5); doc.setTextColor.apply(doc,MUTED); doc.setFont(undefined,'normal');
    doc.text('Prepared by: '+(D.preparedBy||''), M, PH-8);
    doc.text('Placement · Oscars Training Centre', PW/2, PH-8, {align:'center'});
    doc.text('Page '+doc.internal.getNumberOfPages(), PW-M, PH-8, {align:'right'});
  }
  doc.setFillColor.apply(doc,HEAD); doc.rect(0,0,PW,26,'F');
  doc.setTextColor(255,255,255); doc.setFont(undefined,'bold'); doc.setFontSize(15);
  doc.text('Weekly Placement Team Report', M, 12);
  doc.setFont(undefined,'normal'); doc.setFontSize(9.5);
  doc.text('Reporting period: '+fmtDay(D.mon)+' – '+fmtDay(D.sun), M, 19);
  doc.text('Oscars Training Centre', PW-M, 12, {align:'right'});
  var s=D.sections.students||{};
  var y=34;
  function secTitle(t){ doc.setTextColor.apply(doc,ACC); doc.setFont(undefined,'bold'); doc.setFontSize(11); doc.text(t, M, y); y+=2.5; doc.setDrawColor.apply(doc,ACC); doc.setLineWidth(0.5); doc.line(M,y,PW-M,y); y+=5; }
  var tableOpts=function(head,body,colStyles){ return { startY:y, head:[head], body:body, theme:'grid',
    styles:{ fontSize:8.6, cellPadding:2.2, textColor:INK, lineColor:LINE, lineWidth:0.15, valign:'top', overflow:'linebreak' },
    headStyles:{ fillColor:HEAD, textColor:[255,255,255], fontStyle:'bold', fontSize:8.4 },
    alternateRowStyles:{ fillColor:ZEBRA }, columnStyles:colStyles||{}, margin:{left:M,right:M} }; };

  secTitle('1 · Placement students');
  doc.autoTable(tableOpts(['Measure','Count'],[
    ['Total commenced', s.total!=null?String(s.total):'—'],
    ['Within Sydney/NSW', s.within_nsw!=null?String(s.within_nsw):'—'],
    ['Outside NSW / Regional', s.outside_nsw!=null?String(s.outside_nsw):'—']
  ], {0:{cellWidth:70,fontStyle:'bold'},1:{halign:'center'}}));
  y=doc.lastAutoTable.finalY+8;

  function rowsOrNone(title, rows, cols){
    secTitle(title);
    if(!rows || !rows.length){ doc.setTextColor.apply(doc,MUTED); doc.setFont(undefined,'italic'); doc.setFontSize(9); doc.text('None this week.', M, y); y+=8; doc.setFont(undefined,'normal'); return; }
    doc.autoTable(tableOpts(cols.map(function(c){return c.label;}), rows.map(function(r){ return cols.map(function(c){ return r[c.f]||''; }); })));
    y=doc.lastAutoTable.finalY+8;
  }
  rowsOrNone('2 · Placement cancellations', D.sections.cancellations, [{label:'Student',f:'student'},{label:'Facility',f:'facility'},{label:'Reason',f:'reason'},{label:'Action taken',f:'action'}]);
  rowsOrNone('3 · Facility issues', D.sections.facility_issues, [{label:'Facility',f:'facility'},{label:'Issue',f:'issue'},{label:'Status',f:'status'}]);
  rowsOrNone('4 · Student issues', D.sections.student_issues, [{label:'Student',f:'student'},{label:'Issue',f:'issue'},{label:'Current status',f:'status'}]);
  footer();

  doc.addPage('a4','landscape');
  var LW=doc.internal.pageSize.getWidth(), LH=doc.internal.pageSize.getHeight();
  doc.setFillColor.apply(doc,HEAD); doc.rect(0,0,LW,20,'F');
  doc.setTextColor(255,255,255); doc.setFont(undefined,'bold'); doc.setFontSize(13);
  doc.text('5 · Team member daily task summary', M, 9);
  doc.setFont(undefined,'normal'); doc.setFontSize(9);
  doc.text(fmtDay(D.mon)+' – '+fmtDay(D.sun), M, 15.5);
  var gHead=[['Member'].concat(D.dayHeads)];
  var gBody=D.grid.map(function(p){ return [p.name].concat(p.cells.map(function(c){ return c?c:'—'; })); });
  var usable=LW-2*M, cName=32, cDay=(usable-cName)/D.dayHeads.length;
  var gCol={0:{cellWidth:cName,fontStyle:'bold'}}; for(var i=1;i<=D.dayHeads.length;i++) gCol[i]={cellWidth:cDay};
  doc.autoTable({ startY:24, head:gHead, body:gBody, theme:'grid',
    styles:{ fontSize:7.2, cellPadding:1.8, textColor:INK, lineColor:LINE, lineWidth:0.2, valign:'top', overflow:'linebreak' },
    headStyles:{ fillColor:HEAD, textColor:[255,255,255], fontStyle:'bold', fontSize:7.4, halign:'center' },
    columnStyles:gCol, alternateRowStyles:{ fillColor:ZEBRA }, margin:{left:M,right:M},
    didParseCell:function(data){ if(data.section==='body' && data.cell.raw==='—'){ data.cell.styles.textColor=[203,213,225]; data.cell.styles.halign='center'; } }
  });
  doc.setFontSize(7.5); doc.setTextColor.apply(doc,MUTED);
  doc.text('Task summary is compiled from each member\u2019s daily work log.', M, doc.lastAutoTable.finalY+6);
  footer();
  doc.save('Placement_Weekly_Report_'+D.mon+'.pdf');
}

function trDownloadPdf(){
  var D = window._trReportData;
  if(!D){ nxAlert('Generate the report first, then download it.',{title:'No report yet'}); return; }
  if(D.placement){ return trDownloadPlacementPdf(D); }
  var JsPDF = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : window.jsPDF;
  if(!JsPDF){ nxAlert('Please refresh the page and try again.',{title:'PDF library not loaded'}); return; }
  var doc = new JsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
  var PW = doc.internal.pageSize.getWidth();
  var PH = doc.internal.pageSize.getHeight();
  var M = 12;
  var _P=_trPal(); var GREEN=_P.accent, HEAD=_P.head, INK=[15,23,42], MUTED=[100,116,139], LINE=_P.line, ZEBRA=_P.zebra;
  function fmtDay(dStr){ return new Date(dStr+'T00:00:00').toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'}); }
  function rangeStr(){ return fmtDay(D.mon)+' – '+fmtDay(D.sun); }
  function footer(){
    var pageStr='Page '+doc.internal.getNumberOfPages();
    doc.setFontSize(7.5); doc.setTextColor.apply(doc, MUTED); doc.setFont(undefined,'normal');
    doc.text('Prepared by: '+(D.preparedBy||''), M, PH-7);
    doc.text(trActiveTeam()+' · Oscars Training Centre', PW/2, PH-7, {align:'center'});
    doc.text(pageStr, PW-M, PH-7, {align:'right'});
  }

  var isLog = (D.shape === 'log');
  if(!isLog){
  doc.setFont(undefined,'bold'); doc.setFontSize(15); doc.setTextColor.apply(doc, INK);
  doc.text('Oscars Training Centre — Weekly Performance Report', M, M+4);
  doc.setFont(undefined,'normal'); doc.setFontSize(9.5); doc.setTextColor.apply(doc, MUTED);
  doc.text('Team Metrics: '+trActiveTeam()+' · '+rangeStr(), M, M+10);

  var headRow = ['Staff','Calls'].concat(D.metricLabels);
  var mBody = D.metrics.map(function(r){ return [r.name, r.calls].concat(D.metricKeys.map(function(k){ return r[k]||0; })); });
  var g={calls:0}; D.metricKeys.forEach(function(k){g[k]=0;});
  D.metrics.forEach(function(r){ g.calls+=r.calls; D.metricKeys.forEach(function(k){ g[k]+=r[k]||0; }); });
  mBody.push(['Team total', g.calls].concat(D.metricKeys.map(function(k){ return g[k]; })));

  var colStyles={0:{halign:'left',cellWidth:52,fontStyle:'bold'}};
  for(var ci=1; ci<headRow.length; ci++) colStyles[ci]={halign:'center'};
  doc.autoTable({ startY:M+16, head:[headRow], body:mBody, theme:'plain',
    styles:{ fontSize:9, cellPadding:2.4, textColor:INK, lineColor:LINE, lineWidth:0.15 },
    headStyles:{ fillColor:HEAD, textColor:[255,255,255], fontStyle:'bold', fontSize:8.5, halign:'center' },
    columnStyles: colStyles, alternateRowStyles:{ fillColor:ZEBRA }, margin:{ left:M, right:M },
    didParseCell:function(data){ if(data.row.index===mBody.length-1){ data.cell.styles.fontStyle='bold'; data.cell.styles.fillColor=_P.total; data.cell.styles.lineColor=GREEN; data.cell.styles.lineWidth=0.4; } }
  });
  var afterY=doc.lastAutoTable.finalY+6;
  doc.setFontSize(7.5); doc.setTextColor.apply(doc, MUTED); doc.setFont(undefined,'normal');
  doc.text('Calls are counted automatically from the call log. Other metrics are self-reported daily by staff.', M, afterY);
  footer();
  doc.addPage('a4','landscape');
  }

  doc.setFont(undefined,'bold'); doc.setFontSize(15); doc.setTextColor.apply(doc, INK);
  doc.text((isLog ? 'Daily Work Log: ' : 'Weekly Task Report: ')+trActiveTeam(), M, M+4);
  doc.setFont(undefined,'normal'); doc.setFontSize(9.5); doc.setTextColor.apply(doc, MUTED);
  doc.text(rangeStr(), M, M+10);
  var dayHeads = D.weekDates.map(function(d){ return fmtDay(d); });
  var gHead = [['#','Staff'].concat(dayHeads)];
  var gBody = D.tasks.map(function(p, idx){
    var row=[String(idx+1), p.name];
    p.days.forEach(function(items){ row.push(items.length ? items.map(function(t){return '• '+t;}).join('\n') : '—'); });
    return row;
  });
  var usable=PW-2*M, cNum=7, cName=30, cDay=(usable-cNum-cName)/TR_WEEK_DAYS;
  var gCol={0:{cellWidth:cNum,halign:'center'},1:{cellWidth:cName,fontStyle:'bold'}};
  for(var i=2;i<2+TR_WEEK_DAYS;i++) gCol[i]={cellWidth:cDay};
  doc.autoTable({ startY:M+15, head:gHead, body:gBody, theme:'grid',
    styles:{ fontSize:7.4, cellPadding:1.8, textColor:INK, lineColor:LINE, lineWidth:0.2, valign:'top', overflow:'linebreak' },
    headStyles:{ fillColor:HEAD, textColor:[255,255,255], fontStyle:'bold', fontSize:7.5, halign:'center', valign:'middle' },
    columnStyles:gCol, alternateRowStyles:{ fillColor:ZEBRA }, margin:{ left:M, right:M },
    didDrawPage:function(){ if(isLog) footer(); },
    didParseCell:function(data){ if(data.section==='body' && data.cell.raw==='—'){ data.cell.styles.textColor=[203,213,225]; data.cell.styles.halign='center'; } }
  });
  var afterY2=doc.lastAutoTable.finalY+6;
  doc.setFontSize(7.5); doc.setTextColor.apply(doc, MUTED);
  doc.text('Note: Tasks summarised here are arranged from records provided by staff in the daily work log.', M, afterY2);
  if(!isLog) footer();

  doc.save(trActiveTeam()+(isLog?'_Daily_Work_Log_':'_Weekly_Report_')+D.mon+'.pdf');
}

function populateMgrStaff(){
  const sel = document.getElementById('mgrStaffSel');
  if(!sel) return;
  if(sel.options.length > 1) return;
  const opts = ['<option value="">— Pick staff —</option>'].concat(
    (STAFF||[]).filter(Boolean).map(function(n){
      return '<option value="'+n.replace(/"/g,'&quot;')+'">'+n+(n===me?' (me)':'')+'</option>';
    })
  );
  sel.innerHTML = opts.join('');
}

async function runHoursReport(){
  const startStr = document.getElementById('reportPageStart').value;
  const endStr = document.getElementById('reportPageEnd').value;
  const el = document.getElementById('hoursReportResults');
  if(!startStr || !endStr){ el.innerHTML = '<div style="color:#dc2626;">Pick both dates.</div>'; return; }
  /* Only swap in a skeleton when the range changed and one isn't already showing. Re-opening the
     page keeps the old table in place while it refreshes, instead of flashing and re-sizing. */
  const rangeKey = startStr + '|' + endStr;
  if(el.dataset.range !== rangeKey && !el.querySelector('.nx-sk')){
    el.innerHTML = '<div style="color:var(--ui-ink-4,#94a3b8);text-align:center;padding:20px;">'+nxSkel('table',5)+'</div>';
  }
  el.dataset.range = rangeKey;
  await renderHoursTable(me, startStr, endStr, el, false);
}

async function runManagerReport(){
  const staff = document.getElementById('mgrStaffSel').value;
  const startStr = document.getElementById('mgrStart').value;
  const endStr = document.getElementById('mgrEnd').value;
  const el = document.getElementById('mgrReportResults');
  if(!staff){ el.innerHTML = '<div style="color:var(--ui-ink-4,#94a3b8);text-align:center;padding:20px;">Pick a staff member to view their punches.</div>'; return; }
  if(!startStr || !endStr){ el.innerHTML = '<div style="color:#dc2626;">Pick both dates.</div>'; return; }
  el.innerHTML = '<div style="color:var(--ui-ink-4,#94a3b8);text-align:center;padding:20px;">'+nxSkel('table',5)+'</div>';
  await renderHoursTable(staff, startStr, endStr, el, true);
}

function calcDayExtras(rawHours, customBreak, customCoffee, dateObj){
  let isWeekend = false;
  if(dateObj){
    const d = (dateObj instanceof Date) ? dateObj : new Date(dateObj);
    let dow;
    try{
      const wd = d.toLocaleDateString('en-US', {timeZone:'Australia/Sydney', weekday:'short'});
      const map = {Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6};
      dow = (wd in map) ? map[wd] : d.getDay();
    }catch(e){ dow = d.getDay(); }
    isWeekend = (dow === 0 || dow === 6);
  }
  const autoBreak = isWeekend ? 0 : (rawHours > 5 ? 0.5 : 0);
  let breakHrs = (customBreak !== undefined && customBreak !== null && customBreak !== '') ? parseFloat(customBreak) : autoBreak;
  let coffee = (customCoffee !== undefined && customCoffee !== null && customCoffee !== '') ? parseFloat(customCoffee) : (rawHours >= 4 ? 5 : 0);
  if(isNaN(breakHrs)) breakHrs = 0;
  if(isNaN(coffee)) coffee = 0;
  const netHours = Math.max(0, rawHours - breakHrs);
  return {netHours, breakHrs, coffee};
}

async function renderHoursTable(targetStaff, startStr, endStr, el, allowEdit){
  const start = new Date(startStr+'T00:00:00');
  const end = new Date(endStr+'T23:59:59');
  let logs = [];
  try{
    logs = await sbGet('clock_log','?staff_name=eq.'+encodeURIComponent(targetStaff)+'&order=ts.asc&limit=2000');
  }catch(e){}
  logs = (logs||[]).filter(function(r){ const t = new Date(r.ts); return t >= start && t <= end; });
  if(!logs.length){ el.innerHTML = '<div style="color:var(--ui-ink-4,#94a3b8);text-align:center;padding:30px;">No clock-ins in this range.</div>'; return; }
  logs.sort(function(a,b){return new Date(a.ts) - new Date(b.ts);});
  (function(){
    const seen = {};
    logs = logs.filter(function(r){
      const t = new Date(r.ts);
      const k = r.action+'|'+t.getFullYear()+'-'+(t.getMonth()+1)+'-'+t.getDate()+'|'+t.getHours()+':'+t.getMinutes();
      if(seen[k]) return false; seen[k]=1; return true;
    });
  })();
  const byDay = {};
  let openIn = null;
  logs.forEach(function(r){
    const t = new Date(r.ts);
    const ft = flexClockTime(t);
    const dayKey = t.toLocaleDateString('en-AU',{day:'2-digit',month:'2-digit',year:'numeric'});
    if(!byDay[dayKey]) byDay[dayKey] = {date:t, in:null, out:null, hours:0, in_id:'', out_id:''};
    if(r.action === 'in'){
      if(!byDay[dayKey].in || ft < byDay[dayKey].in){ byDay[dayKey].in = ft; byDay[dayKey].in_id = r.id; }
      if(!openIn) openIn = ft;
    }
    else if(r.action === 'out'){
      if(!byDay[dayKey].out || ft > byDay[dayKey].out){ byDay[dayKey].out = ft; byDay[dayKey].out_id = r.id; }
      if(openIn){
        const span = ft - openIn;
        if(span > 0 && span < 24*60*60*1000){ byDay[dayKey].hours += span/3600000; }
        openIn = null;
      }
    }
  });
  const days = Object.keys(byDay).sort(function(a,b){return byDay[a].date - byDay[b].date;});
  let totalHours = 0;
  let overrides = {};
  try{
    const ov = await sbGet('clock_overrides','?staff_name=eq.'+encodeURIComponent(targetStaff)+'&date=gte.'+startStr+'&date=lte.'+endStr);
    (ov||[]).forEach(function(r){ overrides[r.date] = r; });
  }catch(e){}

  const editCol = allowEdit ? '<th style="padding:8px 6px;border-bottom:1px solid var(--ui-line,#e2e8f0);text-align:right;"></th>' : '';
  let html = '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">'+
    '<thead><tr style="text-align:left;color:var(--ui-ink-4,#94a3b8);font-size:11px;text-transform:uppercase;letter-spacing:.05em;">'+
      '<th style="padding:8px 6px;border-bottom:1px solid var(--ui-line,#e2e8f0);">Date</th>'+
      '<th style="padding:8px 6px;border-bottom:1px solid var(--ui-line,#e2e8f0);">Day</th>'+
      '<th style="padding:8px 6px;border-bottom:1px solid var(--ui-line,#e2e8f0);">In</th>'+
      '<th style="padding:8px 6px;border-bottom:1px solid var(--ui-line,#e2e8f0);">Out</th>'+
      '<th style="padding:8px 6px;border-bottom:1px solid var(--ui-line,#e2e8f0);text-align:right;">Break</th>'+
      '<th style="padding:8px 6px;border-bottom:1px solid var(--ui-line,#e2e8f0);text-align:right;">Hours</th>'+
      '<th style="padding:8px 6px;border-bottom:1px solid var(--ui-line,#e2e8f0);text-align:right;">Coffee</th>'+editCol+
    '</tr></thead><tbody>';
  let totalNet = 0;
  let totalCoffee = 0;
  days.forEach(function(k){
    const d = byDay[k];
    const day = d.date.toLocaleDateString('en-AU',{weekday:'short'});
    const inS = d.in ? d.in.toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Australia/Sydney'}) : '—';
    const outS = d.out ? d.out.toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Australia/Sydney'}) : '—';
    const isoDate = (function(dt){ return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0'); })(d.date);
    const ov = overrides[isoDate] || {};
    const extras = calcDayExtras(d.hours, ov.break_hrs, ov.coffee, d.date);
    totalNet += extras.netHours;
    totalCoffee += extras.coffee;
    const inHHMM = d.in ? (String(d.in.getHours()).padStart(2,'0')+':'+String(d.in.getMinutes()).padStart(2,'0')) : '';
    const outHHMM = d.out ? (String(d.out.getHours()).padStart(2,'0')+':'+String(d.out.getMinutes()).padStart(2,'0')) : '';
    const _rowId = 'mrow_'+isoDate.replace(/-/g,'');
    const editBtn = allowEdit ? '<td style="padding:7px 6px;border-bottom:1px solid var(--ui-line-soft,#f1f5f9);text-align:right;white-space:nowrap;">'+
      '<button onclick="openPunchEdit(\''+targetStaff.replace(/\'/g,"\\'")+'\',\''+isoDate+'\',\''+inHHMM+'\',\''+outHHMM+'\',\''+d.in_id+'\',\''+d.out_id+'\')" style="background:var(--ui-surface-3,#f1f5f9);border:none;font-size:11px;padding:4px 10px;border-radius:6px;cursor:pointer;font-family:inherit;font-weight:600;color:var(--accent);">Edit</button>'+
      ' <button onclick="toggleRowAdvanced(\''+_rowId+'\')" title="Advanced" style="background:none;border:none;font-size:11px;padding:4px 6px;border-radius:6px;cursor:pointer;font-family:inherit;font-weight:600;color:var(--ui-ink-4,#94a3b8);">⋯</button>'+
      '</td>' : '';
    html += '<tr><td style="padding:7px 6px;border-bottom:1px solid var(--ui-line-soft,#f1f5f9);">'+k+'</td>'+
      '<td style="padding:7px 6px;border-bottom:1px solid var(--ui-line-soft,#f1f5f9);color:var(--ui-ink-3,#64748b);">'+day+'</td>'+
      '<td style="padding:7px 6px;border-bottom:1px solid var(--ui-line-soft,#f1f5f9);">'+inS+'</td>'+
      '<td style="padding:7px 6px;border-bottom:1px solid var(--ui-line-soft,#f1f5f9);">'+outS+'</td>'+
      '<td style="padding:7px 6px;border-bottom:1px solid var(--ui-line-soft,#f1f5f9);text-align:right;font-variant-numeric:tabular-nums;color:var(--ui-ink-3,#64748b);">'+(extras.breakHrs?extras.breakHrs.toFixed(2)+'h':'—')+'</td>'+
      '<td style="padding:7px 6px;border-bottom:1px solid var(--ui-line-soft,#f1f5f9);text-align:right;font-weight:600;font-variant-numeric:tabular-nums;">'+extras.netHours.toFixed(2)+'h</td>'+
      '<td style="padding:7px 6px;border-bottom:1px solid var(--ui-line-soft,#f1f5f9);text-align:right;color:'+(extras.coffee?'#10b981':'#cbd5e1')+';font-weight:600;font-variant-numeric:tabular-nums;">'+(extras.coffee?'$'+extras.coffee:'—')+'</td>'+editBtn+'</tr>';
    if(allowEdit){
      const sEsc = targetStaff.replace(/\'/g,"\\'");
      html += '<tr id="'+_rowId+'" style="display:none;"><td colspan="8" style="padding:0 6px 10px;border-bottom:1px solid var(--ui-line-soft,#f1f5f9);background:#fafbfc;">'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap;padding:8px 4px;align-items:center;">'+
          '<span style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--ui-ink-4,#94a3b8);font-weight:700;margin-right:2px;">Advanced · '+isoDate+'</span>'+
          '<button onclick="rowInspect(\''+sEsc+'\',\''+isoDate+'\')" style="padding:5px 11px;font-size:11px;font-weight:600;background:var(--ui-surface-3,#f1f5f9);border:1px solid var(--ui-line,#e2e8f0);color:var(--ui-ink-2b,#475569);border-radius:6px;cursor:pointer;font-family:inherit;">Inspect</button>'+
          '<button onclick="rowNukeBreaks(\''+sEsc+'\',\''+isoDate+'\')" style="padding:5px 11px;font-size:11px;font-weight:600;background:#fef9c3;border:1px solid #fde68a;color:#854d0e;border-radius:6px;cursor:pointer;font-family:inherit;">Nuke breaks</button>'+
          '<button onclick="rowDeletePunch(\''+sEsc+'\',\''+isoDate+'\')" style="padding:5px 11px;font-size:11px;font-weight:600;background:#fee2e2;border:1px solid #fecaca;color:#991b1b;border-radius:6px;cursor:pointer;font-family:inherit;">Delete punch</button>'+
        '</div></td></tr>';
    }
  });
  const totalEditCell = allowEdit ? '<td></td>' : '';
  html += '<tr><td colspan="5" style="padding:10px 6px;font-weight:700;color:var(--ui-ink,#0f172a);">Total</td>'+
    '<td style="padding:10px 6px;text-align:right;font-weight:800;color:var(--accent);font-size:15px;">'+totalNet.toFixed(2)+'h</td>'+
    '<td style="padding:10px 6px;text-align:right;font-weight:700;color:#10b981;">$'+totalCoffee.toFixed(2)+'</td>'+totalEditCell+'</tr>';
  html += '</tbody></table></div>';
  el.innerHTML = html;
}

function toggleRowAdvanced(rowId){
  const r=document.getElementById(rowId);
  if(r) r.style.display = (r.style.display==='none'||!r.style.display) ? 'table-row' : 'none';
}
function _rowSetTarget(staff,isoDate){
  let s=document.getElementById('peStaff');
  if(!s){ s=document.createElement('input'); s.type='hidden'; s.id='peStaff'; document.body.appendChild(s); }
  let d=document.getElementById('peDate');
  if(!d){ d=document.createElement('input'); d.type='hidden'; d.id='peDate'; document.body.appendChild(d); }
  s.value=staff; d.value=isoDate;
}
function rowDeletePunch(staff,isoDate){ _rowSetTarget(staff,isoDate); if(typeof deletePunch==='function') deletePunch(); }
function rowNukeBreaks(staff,isoDate){ _rowSetTarget(staff,isoDate); if(typeof nukeBreakOnly==='function') nukeBreakOnly(); }
async function rowInspect(staff,isoDate){
  try{
    const [y,mo,dd]=isoDate.split('-');
    const start=new Date(+y,+mo-1,+dd,0,0,0), end=new Date(+y,+mo-1,+dd,23,59,59);
    const wideStart=new Date(start.getTime()-864e5).toISOString(), wideEnd=new Date(end.getTime()+864e5).toISOString();
    const rows=(await sbGet('clock_log','?staff_name=eq.'+encodeURIComponent(staff)+'&ts=gte.'+wideStart+'&ts=lte.'+wideEnd+'&order=ts.asc'))||[];
    const same=rows.filter(function(r){ const t=new Date(r.ts); return (t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0'))===isoDate; });
    let ebr=[];
    try{ ebr=(await sbGet('extra_break_requests','?staff_name=eq.'+encodeURIComponent(staff)+'&request_date=eq.'+isoDate+'&order=created_at.asc'))||[]; }catch(e){}
    _showInspectDialog(staff, isoDate, same, ebr);
  }catch(e){ nxAlert(String((e&&e.message)||e),{title:'Inspect failed'}); }
}
function _showInspectDialog(staff, isoDate, rows, ebr){
  const esc=function(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };
  const fmt=function(iso){ try{ return new Date(iso).toLocaleString('en-AU',{timeZone:'Australia/Sydney',day:'2-digit',month:'short',hour:'numeric',minute:'2-digit'}); }catch(e){ return iso||''; } };
  let bd=document.getElementById('inspectBack');
  if(!bd){
    bd=document.createElement('div'); bd.id='inspectBack';
    bd.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:flex-start;justify-content:center;z-index:10000;padding:40px 16px;overflow:auto;';
    bd.addEventListener('click',function(e){ if(e.target===bd) bd.style.display='none'; });
    document.body.appendChild(bd);
  }
  let rowsHtml;
  if(rows && rows.length){
    rowsHtml=rows.map(function(r){
      const t=new Date(r.ts).toLocaleString('en-AU',{timeZone:'Australia/Sydney'});
      const act=(r.action||'').toUpperCase();
      const col=act==='IN'?'#16a34a':(act==='OUT'?'#dc2626':'#64748b');
      return '<div style="display:flex;gap:10px;align-items:baseline;padding:6px 0;border-bottom:1px solid var(--ui-line-soft,#f1f5f9);">'+
        '<span style="font-weight:800;font-size:11px;color:'+col+';min-width:32px;">'+esc(act)+'</span>'+
        '<span style="font-size:12.5px;color:var(--ui-ink,#0f172a);flex:1;">'+esc(t)+(r.notes?(' <span style="color:var(--ui-ink-4,#94a3b8);">— '+esc(r.notes)+'</span>'):'')+'</span>'+
        '<span style="font-size:10px;color:#cbd5e1;font-family:monospace;">'+esc(r.id)+'</span>'+
      '</div>';
    }).join('');
  } else {
    rowsHtml='<div style="padding:8px 0;color:var(--ui-ink-4,#94a3b8);font-size:13px;">No raw clock rows for this day.</div>';
  }
  let ebrHtml='';
  if(ebr && ebr.length){
    const badge=function(st){ st=(st||'pending').toLowerCase(); let fg='#854d0e',bg='#fef9c3'; if(st==='approved'){fg='#065f46';bg='#d1fae5';} else if(st==='rejected'||st==='denied'){fg='#991b1b';bg='#fee2e2';} return '<span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;padding:2px 7px;border-radius:999px;color:'+fg+';background:'+bg+';">'+esc(st)+'</span>'; };
    ebrHtml='<div style="margin-top:16px;">'+
      '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--ui-ink-4,#94a3b8);font-weight:700;margin-bottom:6px;">Extra break history</div>'+
      ebr.map(function(b){
        const meta='req '+esc(fmt(b.created_at))+(b.resolved_by?(' · '+esc(b.status||'')+' by '+esc(b.resolved_by)):'');
        return '<div style="padding:7px 0;border-bottom:1px solid var(--ui-line-soft,#f1f5f9);">'+
          '<div style="display:flex;gap:10px;align-items:center;">'+
            '<span style="font-weight:800;font-size:13px;color:var(--ui-ink,#0f172a);min-width:54px;">'+esc(b.minutes)+' min</span>'+
            badge(b.status)+
            '<span style="flex:1;font-size:12px;color:var(--ui-ink-3,#64748b);text-align:right;">'+esc(meta)+'</span>'+
          '</div>'+
          (b.reason?'<div style="font-size:12px;color:var(--ui-ink-4,#94a3b8);margin-top:2px;">'+esc(b.reason)+'</div>':'')+
        '</div>';
      }).join('')+
    '</div>';
  }
  bd.innerHTML='<div id="inspectCard" style="background:var(--ui-surface,#fff);border-radius:14px;width:min(560px,100%);max-height:86vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.3);">'+
    '<div style="display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid var(--ui-line,#e2e8f0);">'+
      '<div style="flex:1;"><div style="font-size:15px;font-weight:800;color:var(--ui-ink,#0f172a);">Inspect · '+esc(staff)+'</div><div style="font-size:11.5px;color:var(--ui-ink-3,#64748b);margin-top:2px;">'+esc(isoDate)+'</div></div>'+
      '<button id="inspectCloseBtn" style="background:var(--ui-surface-3,#f1f5f9);border:none;font-size:13px;font-weight:600;color:var(--ui-ink-2b,#475569);padding:6px 12px;border-radius:8px;cursor:pointer;font-family:inherit;">Close</button>'+
    '</div>'+
    '<div style="overflow:auto;padding:14px 18px 18px;">'+
      '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--ui-ink-4,#94a3b8);font-weight:700;margin-bottom:6px;">Raw clock rows</div>'+
      rowsHtml+ebrHtml+
    '</div>'+
  '</div>';
  const card=document.getElementById('inspectCard'); if(card) card.addEventListener('click',function(e){ e.stopPropagation(); });
  const cb=document.getElementById('inspectCloseBtn'); if(cb) cb.addEventListener('click',function(){ bd.style.display='none'; });
  bd.style.display='flex';
}
async function openCreateEntry(){
  const sel = document.getElementById('mgrStaffSel');
  let staff = sel ? sel.value : '';
  if(!staff){
    const names = (STAFF||[]).filter(Boolean);
    if(!names.length){ showToast('No staff loaded'); return; }
    const choice = await nxPrompt('Choose who this punch is for.', names.indexOf(me)>=0?me:names[0], {title:'Add manual entry',okText:'Continue',choices:names});
    if(!choice) return;
    staff = choice;
    if(sel){
      const opt = Array.from(sel.options).find(function(o){return o.value === choice;});
      if(opt) sel.value = choice;
    }
  }
  const today = new Date().toISOString().split('T')[0];
  if(typeof openPunchEdit === 'function'){
    openPunchEdit(staff, today, '', '', '', '');
  } else {
    showToast('Edit modal not loaded');
  }
}

async function nukeDay(){
  const sel = document.getElementById('mgrStaffSel');
  const staff = sel ? sel.value : '';
  if(!staff){ showToast('Pick a staff member first'); return; }
  if(!(await nxConfirm('This will permanently delete clock-in/out records from the portal database. Use only to fix corrupted entries.\n\nGoogle Sheet data is NOT affected.',{title:'Destructive action',okText:'Continue',danger:true}))) return;
  const date = await nxPrompt('Wipe rows for '+staff+' on which date?', new Date().toISOString().split('T')[0], {title:'Pick a date',okText:'Next',inputType:'date',validate:function(v){ return /^\d{4}-\d{2}-\d{2}$/.test(v)?'':'Pick a date (YYYY-MM-DD).'; }});
  if(!date) return;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){ showToast('Invalid date format. Use YYYY-MM-DD'); return; }
  if(!(await nxConfirm('Delete ALL clock-in/out rows for:\n   Staff: '+staff+'\n   Date: '+date+'\n\nThis cannot be undone. The Google Sheet will NOT be touched.',{title:'Final confirmation',okText:'Delete rows',danger:true}))) return;
  try{
    const [y,mo,d] = date.split('-');
    const localMidnight = new Date(parseInt(y), parseInt(mo)-1, parseInt(d), 0, 0, 0);
    const localEnd = new Date(parseInt(y), parseInt(mo)-1, parseInt(d), 23, 59, 59);
    const wideStart = new Date(localMidnight.getTime() - 24*60*60*1000).toISOString();
    const wideEnd = new Date(localEnd.getTime() + 24*60*60*1000).toISOString();
    const allCandidate = await sbGet('clock_log','?staff_name=eq.'+encodeURIComponent(staff)+'&ts=gte.'+wideStart+'&ts=lte.'+wideEnd);
    const toDelete = (allCandidate||[]).filter(function(r){
      const t = new Date(r.ts);
      const localStr = t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');
      return localStr === date;
    });
    if(!toDelete.length){ showToast('Nothing to delete'); return; }
    let success = 0, failed = 0;
    for(const r of toDelete){
      const res = await fetch(SB+'/rest/v1/clock_log?id=eq.'+encodeURIComponent(r.id),{
        method:'DELETE',
        headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Prefer':'return=minimal'}
      });
      if(res.ok) success++; else failed++;
    }
    showToast('Deleted '+success+' rows'+(failed?' · '+failed+' failed (RLS issue)':''));
    if(failed){
      nxAlert(failed+' deletes failed. Run this SQL in supabase:\n\ndrop policy if exists "anyone delete" on clock_log;\ncreate policy "anyone delete" on clock_log for delete to anon, authenticated using (true);',{title:'Some deletes were blocked'});
    }
    debugClockLog();
    if(typeof runManagerReport === 'function') runManagerReport();
  }catch(e){
    showToast('Nuke failed: '+e.message);
  }
}

async function debugClockLog(){
  const out = document.getElementById('debugOut');
  if(!out) return;
  out.style.display = '';
  const staff = document.getElementById('mgrStaffSel').value || me;
  const startStr = document.getElementById('mgrStart').value || new Date().toISOString().split('T')[0];
  const endStr = document.getElementById('mgrEnd').value || new Date().toISOString().split('T')[0];
  out.innerHTML = '<div style="color:var(--ui-ink-4,#94a3b8);">'+nxSkel('lines',3)+'</div>';
  try{
    const rows = await sbGet('clock_log','?staff_name=eq.'+encodeURIComponent(staff)+'&order=ts.desc&limit=50');
    if(!rows.length){ out.innerHTML = '<div>No clock_log rows for '+staff+'.</div>'; return; }
    let html = '<div style="margin-bottom:6px;font-weight:700;">'+rows.length+' rows for '+staff+':</div>';
    html += '<div style="max-height:400px;overflow-y:auto;background:var(--ui-surface,#fff);padding:8px;border-radius:6px;border:1px solid #fde68a;">';
    rows.forEach(function(r){
      const t = new Date(r.ts);
      const localStr = t.toLocaleString('en-AU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
      const action = r.action;
      const color = action === 'in' ? '#10b981' : '#dc2626';
      html += '<div style="padding:3px 0;border-bottom:1px solid var(--ui-line-soft,#f1f5f9);">'+
        '<span style="color:'+color+';font-weight:700;">'+action.toUpperCase()+'</span> · '+
        localStr+' · <span style="color:var(--ui-ink-4,#94a3b8);">id='+r.id.slice(0,8)+'...</span> '+
        '<button onclick="deleteClockLogRow(\''+r.id+'\')" style="background:#dc2626;border:none;color:#fff;font-size:10px;padding:2px 6px;border-radius:4px;cursor:pointer;font-family:inherit;margin-left:6px;">delete</button>'+
      '</div>';
    });
    html += '</div>';
    out.innerHTML = html;
  }catch(e){
    out.innerHTML = '<div style="color:#dc2626;">Error: '+esc(e.message)+'</div>';
  }
}

async function deleteClockLogRow(id){
  if(!(await nxConfirm('This can’t be undone.',{title:'Delete this clock-log row?',okText:'Delete',danger:true}))) return;
  try{
    await fetch(SB+'/rest/v1/clock_log?id=eq.'+encodeURIComponent(id),{
      method:'DELETE',
      headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Prefer':'return=minimal'}
    });
    showToast('Row deleted');
    debugClockLog();
    if(typeof runManagerReport === 'function') runManagerReport();
  }catch(e){ showToast('Delete failed'); }
}



async function openPunchEdit(staff, isoDate, timeIn, timeOut, inId, outId){
  let bd = document.getElementById('punchEditBack');
  if(!bd){
    bd = document.createElement('div');
    bd.id = 'punchEditBack';
    bd.style.cssText = 'position:fixed;inset:0;z-index:9560;background:rgba(15,23,42,.55);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:16px;';
    document.body.appendChild(bd);
    bd.addEventListener('click', function(e){ if(e.target===bd) bd.style.display='none'; });
    document.addEventListener('keydown', function(e){
      if(e.key==='Escape' && bd.style.display!=='none') bd.style.display='none';
    });
  }
  document.querySelectorAll('#peStaff,#peDate').forEach(function(el){ if(!bd.contains(el)) el.remove(); });

  const dateObj = new Date(isoDate+'T00:00:00');
  const dateStr = isNaN(dateObj) ? '' : dateObj.toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const hasRows = !!(inId || outId);
  const q = function(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/"/g,'&quot;'); };

  bd.innerHTML =
  '<div class="pe-card" role="dialog" aria-modal="true" aria-labelledby="peTitle" onclick="event.stopPropagation()">'+
    '<div class="pe-hd">'+
      '<div class="pe-hd-text">'+
        '<div class="pe-kicker">Edit punch</div>'+
        '<div class="pe-title" id="peTitle">'+esc(staff)+'</div>'+
        (dateStr ? '<div class="pe-sub">'+esc(dateStr)+'</div>' : '')+
      '</div>'+
      '<button type="button" class="pe-x" aria-label="Close" onclick="document.getElementById(\'punchEditBack\').style.display=\'none\'">'+
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'+
      '</button>'+
    '</div>'+
    '<div class="pe-body">'+
      '<input type="hidden" id="peStaff" value="'+q(staff)+'">'+
      '<input type="hidden" id="peInId" value="'+q(inId||'')+'">'+
      '<input type="hidden" id="peOutId" value="'+q(outId||'')+'">'+
      '<div class="pe-field">'+
        '<label class="pe-lbl" for="peDate">Date</label>'+
        '<input type="date" id="peDate" class="pe-in" value="'+q(isoDate)+'" oninput="_pePreview()">'+
      '</div>'+
      '<div class="pe-row">'+
        '<div class="pe-field"><label class="pe-lbl" for="peTimeIn">Clock in</label>'+
          '<input type="time" id="peTimeIn" class="pe-in" value="'+q(timeIn||'')+'" oninput="_pePreview()"></div>'+
        '<div class="pe-field"><label class="pe-lbl" for="peTimeOut">Clock out</label>'+
          '<input type="time" id="peTimeOut" class="pe-in" value="'+q(timeOut||'')+'" oninput="_pePreview()"></div>'+
      '</div>'+
      '<div class="pe-row">'+
        '<div class="pe-field"><label class="pe-lbl" for="peBreak">Break <span class="pe-unit">hours</span></label>'+
          '<input type="number" step="0.25" min="0" id="peBreak" class="pe-in" placeholder="Auto" inputmode="decimal" oninput="_pePreview()"></div>'+
        '<div class="pe-field"><label class="pe-lbl" for="peCoffee">Coffee <span class="pe-unit">$</span></label>'+
          '<input type="text" id="peCoffee" class="pe-in" placeholder="Auto" inputmode="decimal" oninput="_pePreview()"></div>'+
      '</div>'+
      '<div class="pe-preview" id="pePreview" aria-live="polite"></div>'+
      '<div class="pe-note">'+
        '<svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M8.26 3.1c.77-1.36 2.71-1.36 3.48 0l5.58 9.92c.75 1.33-.21 2.98-1.74 2.98H4.42c-1.53 0-2.49-1.65-1.74-2.98L8.26 3.1zM10 7a1 1 0 00-1 1v3a1 1 0 102 0V8a1 1 0 00-1-1zm0 7.5a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>'+
        '<span>Saving updates both the portal log and the Google Sheet for this person. Leave break or coffee blank to auto-fill.</span>'+
      '</div>'+
    '</div>'+
    '<div class="pe-ft">'+
      (hasRows
        ? '<div class="pe-danger"><button type="button" class="pe-link pe-link-warn" onclick="nukeBreakOnly()">Nuke breaks</button>'+
          '<button type="button" class="pe-link pe-link-danger" onclick="deletePunch()">Delete punch</button></div>'
        : '<div></div>')+
      '<div class="pe-actions">'+
        '<button type="button" onclick="document.getElementById(\'punchEditBack\').style.display=\'none\'" class="btn btn-outline">Cancel</button>'+
        '<button type="button" onclick="savePunchEdit()" class="btn btn-green" id="peSaveBtn">Save changes</button>'+
      '</div>'+
    '</div>'+
  '</div>';
  bd.style.display='flex';
  _pePreview();
}

function _pePreview(){
  const box = document.getElementById('pePreview');
  if(!box) return;
  const tin = (document.getElementById('peTimeIn')||{}).value || '';
  const tout = (document.getElementById('peTimeOut')||{}).value || '';
  const brk = (document.getElementById('peBreak')||{}).value || '';
  const cof = (document.getElementById('peCoffee')||{}).value || '';
  const iso = (document.getElementById('peDate')||{}).value || '';
  if(!tin && !tout){ box.innerHTML=''; box.style.display='none'; return; }
  box.style.display='';
  if(!tin || !tout){
    box.innerHTML = '<span class="pe-pv-main">'+(tin ? 'Clock-in only — no clock-out' : 'Clock-out only — no clock-in')+'</span>';
    return;
  }
  const a = tin.split(':'), b = tout.split(':');
  let mins = (parseInt(b[0],10)*60 + parseInt(b[1],10)) - (parseInt(a[0],10)*60 + parseInt(a[1],10));
  if(isNaN(mins)){ box.innerHTML=''; box.style.display='none'; return; }
  if(mins < 0) mins += 24*60;
  const raw = mins/60;
  let weekend = false;
  try{ const p = iso.split('-'); const dow = new Date(+p[0], +p[1]-1, +p[2]).getDay(); weekend = (dow===0 || dow===6); }catch(e){}
  const brkVal = brk !== '' ? brk : (weekend ? '0' : (raw > 5 ? '0.5' : '0'));
  const brkShown = (parseFloat(brkVal) ? brkVal+'h break' : 'no break') + (brk !== '' ? '' : ' (auto)');
  const cofAuto = raw >= 4 ? '5' : '';
  const cofShown = cof !== '' ? '$'+cof+' coffee' : (cofAuto ? '$'+cofAuto+' coffee (auto)' : 'no coffee (auto)');
  const h = Math.floor(mins/60), m = mins%60;
  box.innerHTML =
    '<span class="pe-pv-main">'+h+'h'+(m ? ' '+m+'m' : '')+' on the clock</span>'+
    '<span class="pe-pv-item">'+esc(brkShown)+'</span>'+
    '<span class="pe-pv-item">'+esc(cofShown)+'</span>';
}

async function nukeBreakOnly(){
  const staff = document.getElementById('peStaff').value;
  const isoDate = document.getElementById('peDate').value;
  if(!(await nxConfirm(staff+' on '+isoDate+'\n\nThis:\n• Wipes break override in portal\n• Resets approved extra-break requests for this day\n• Sets sheet break cell to default auto-rule\n\nClock-in/out times are NOT touched.',{title:'Nuke ALL break data?',okText:'Nuke break data',danger:true}))) return;
  try{
    await fetch(SB+'/rest/v1/clock_overrides?staff_name=eq.'+encodeURIComponent(staff)+'&date=eq.'+isoDate,{
      method:'DELETE',
      headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Prefer':'return=minimal'}
    });
    await fetch(SB+'/rest/v1/extra_break_requests?staff_name=eq.'+encodeURIComponent(staff)+'&request_date=eq.'+isoDate+'&status=eq.approved',{
      method:'PATCH',
      headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
      body: JSON.stringify({status:'voided', resolved_by:me+' (cleared on edit)'})
    });
    const [y,mo,d] = isoDate.split('-');
    const sheetDateStr = d+'/'+mo+'/'+y;
    fetch('https://script.google.com/macros/s/AKfycby0Bq97bCZAsmnruXFuJuCqXQE_kOxhYE2KFuJnVzLXtT5CV0Y12k5176dxZbdaYVGE/exec', {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify({
        action:'updatePunch',
        staff: staff,
        date: sheetDateStr,
        breakHrs: '',
        editor: me + ' (nuke breaks)'
      })
    }).catch(function(){});
    showToast('Break data wiped for '+isoDate);
    var _peb2=document.getElementById('punchEditBack'); if(_peb2) _peb2.style.display='none';
    if(typeof runHoursReport === 'function') runHoursReport();
    if(typeof runManagerReport === 'function') runManagerReport();
    if(staff === me){
      await loadAllClockLogs();
      if(typeof renderHours === 'function') renderHours();
    }
  }catch(e){
    showToast('Nuke failed: '+e.message);
  }
}

async function deletePunch(){
  const staff = document.getElementById('peStaff').value;
  const isoDate = document.getElementById('peDate').value;
  if(!(await nxConfirm(staff+' on '+isoDate+'\n\nWipes:\n• Clock-in/out times\n• Break + coffee data\n• Approved extra-break requests\n• Pending extra-break requests\n• Sheet row content\n\nCannot be undone.',{title:'Delete EVERYTHING for this day?',okText:'Delete everything',danger:true}))) return;
  const btn = document.getElementById('peSaveBtn');
  if(btn){ btn.disabled = true; btn.textContent = 'Deleting...'; }
  try{
    const [y,mo,d] = isoDate.split('-');
    const localMidnight = new Date(parseInt(y), parseInt(mo)-1, parseInt(d), 0, 0, 0);
    const localEnd = new Date(parseInt(y), parseInt(mo)-1, parseInt(d), 23, 59, 59);
    const wideStart = new Date(localMidnight.getTime() - 24*60*60*1000).toISOString();
    const wideEnd = new Date(localEnd.getTime() + 24*60*60*1000).toISOString();
    const allCandidate = await sbGet('clock_log','?staff_name=eq.'+encodeURIComponent(staff)+'&ts=gte.'+wideStart+'&ts=lte.'+wideEnd);
    const existing = (allCandidate||[]).filter(function(r){
      const t = new Date(r.ts);
      const localStr = t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');
      return localStr === isoDate;
    });
    if(existing && existing.length){
      const dels = existing.map(function(r){
        return fetch(SB+'/rest/v1/clock_log?id=eq.'+encodeURIComponent(r.id),{
          method:'DELETE',
          headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Prefer':'return=minimal'}
        });
      });
      await Promise.all(dels);
      try{
        const stillCl = await sbGet('clock_log','?staff_name=eq.'+encodeURIComponent(staff)+'&ts=gte.'+wideStart+'&ts=lte.'+wideEnd);
        const survivors = (stillCl||[]).filter(function(r){
          const t = new Date(r.ts);
          const localStr = t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');
          return localStr === isoDate;
        });
        if(survivors.length){
          console.error('[deletePunch] CRITICAL: clock_log rows survived delete — RLS likely blocking DELETE:', survivors);
          showToast('⚠ Delete blocked by database — punch will reappear. Run the clock_log delete policy (see console).');
          console.error('FIX: run this SQL in Supabase →\n  create policy clocklog_delete on public.clock_log for delete to anon using (true);');
          if(btn){ btn.disabled=false; btn.textContent='Delete punch'; }
          return;
        }
      }catch(e){ console.warn('[deletePunch] clock_log verify failed:', e); }
    }
    try{
      const ovRes = await fetch(SB+'/rest/v1/clock_overrides?staff_name=eq.'+encodeURIComponent(staff)+'&date=eq.'+isoDate,{
        method:'DELETE',
        headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Prefer':'return=minimal'}
      });
      console.log('[deletePunch] overrides deleted, status:', ovRes.status);
    }catch(e){ console.warn('[deletePunch] override delete failed:', e); }
    try{
      const ebrRes = await fetch(SB+'/rest/v1/extra_break_requests?staff_name=eq.'+encodeURIComponent(staff)+'&request_date=eq.'+isoDate,{
        method:'DELETE',
        headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Prefer':'return=minimal'}
      });
      console.log('[deletePunch] extra_break_requests deleted, status:', ebrRes.status);
    }catch(e){ console.warn('[deletePunch] ebr delete failed:', e); }
    try{
      const stillOv = await sbGet('clock_overrides','?staff_name=eq.'+encodeURIComponent(staff)+'&date=eq.'+isoDate);
      if(stillOv && stillOv.length){
        console.error('[deletePunch] CRITICAL: clock_overrides still has rows after delete:', stillOv);
        showToast('⚠ Override delete failed — check RLS policy');
      }
      const stillEbr = await sbGet('extra_break_requests','?staff_name=eq.'+encodeURIComponent(staff)+'&request_date=eq.'+isoDate);
      if(stillEbr && stillEbr.length){
        console.error('[deletePunch] CRITICAL: extra_break_requests still has rows:', stillEbr);
      }
    }catch(e){}
    const sheetDateStr = d+'/'+mo+'/'+y;
    const sheetUrl = 'https://script.google.com/macros/s/AKfycby0Bq97bCZAsmnruXFuJuCqXQE_kOxhYE2KFuJnVzLXtT5CV0Y12k5176dxZbdaYVGE/exec';
    fetch(sheetUrl, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify({
        action:'updatePunch',
        staff: staff,
        date: sheetDateStr,
        timeIn: '',
        timeOut: '',
        breakHrs: '',
        coffee: '',
        clearAll: true,
        editor: me + ' (delete)'
      })
    });
    showToast('Punch deleted · all data wiped');
    var _peb=document.getElementById('punchEditBack'); if(_peb) _peb.style.display='none';
    setTimeout(async function(){
      if(typeof runHoursReport === 'function'){ try{ await runHoursReport(); }catch(e){} }
      if(typeof runManagerReport === 'function'){ try{ await runManagerReport(); }catch(e){} }
      if(staff === me){
        if(typeof loadAllClockLogs === 'function') await loadAllClockLogs();
        if(typeof loadClockState === 'function') await loadClockState();
        if(typeof renderHours === 'function') renderHours();
      }
    }, 500);
  }catch(e){
    console.warn('delete punch:', e);
    showToast('Delete failed');
    if(btn){ btn.disabled = false; btn.textContent = 'Save changes'; }
  }
}

async function savePunchEdit(){
  const staff = document.getElementById('peStaff').value;
  const isoDate = document.getElementById('peDate').value;
  const timeIn = document.getElementById('peTimeIn').value;
  const timeOut = document.getElementById('peTimeOut').value;
  let breakHrs = document.getElementById('peBreak').value;
  let coffee = document.getElementById('peCoffee').value;
  try{
    if(staff && isoDate){
      await fetch(SB+'/rest/v1/clock_overrides?staff_name=eq.'+encodeURIComponent(staff)+'&date=eq.'+isoDate,{
        method:'DELETE',
        headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Prefer':'return=minimal'}
      });
      await fetch(SB+'/rest/v1/extra_break_requests?staff_name=eq.'+encodeURIComponent(staff)+'&request_date=eq.'+isoDate+'&status=eq.approved',{
        method:'PATCH',
        headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
        body: JSON.stringify({status:'voided', resolved_by: me+' (cleared on edit)'})
      });
    }
  }catch(e){ console.warn('pre-clear:',e); }
  const inId = document.getElementById('peInId').value;
  const outId = document.getElementById('peOutId').value;

  if(timeIn && timeOut && (breakHrs === '' || coffee === '')){
    const inP = timeIn.split(':');
    const outP = timeOut.split(':');
    if(inP.length >= 2 && outP.length >= 2){
      const inH = parseInt(inP[0]) + parseInt(inP[1])/60;
      const outH = parseInt(outP[0]) + parseInt(outP[1])/60;
      let raw = outH - inH;
      if(raw < 0) raw += 24;
      let _isWeekend = false;
      try{
        const _p = isoDate.split('-');
        const _dow = new Date(parseInt(_p[0],10), parseInt(_p[1],10)-1, parseInt(_p[2],10)).getDay();
        _isWeekend = (_dow === 0 || _dow === 6);
      }catch(_e){}
      if(breakHrs === '') breakHrs = _isWeekend ? '0' : (raw > 5 ? '0.5' : '0');
      if(coffee === '') coffee = raw >= 4 ? '5' : '';
    }
  }

  const btn = document.getElementById('peSaveBtn');
  btn.disabled = true; btn.textContent = 'Saving...';

  const [y,mo,d] = isoDate.split('-');
  const sheetDateStr = d+'/'+mo+'/'+y;

  try{
    const localMidnight = new Date(parseInt(y), parseInt(mo)-1, parseInt(d), 0, 0, 0);
    const localEnd = new Date(parseInt(y), parseInt(mo)-1, parseInt(d), 23, 59, 59);
    const wideStart = new Date(localMidnight.getTime() - 24*60*60*1000).toISOString();
    const wideEnd = new Date(localEnd.getTime() + 24*60*60*1000).toISOString();
    const allCandidate = await sbGet('clock_log','?staff_name=eq.'+encodeURIComponent(staff)+'&ts=gte.'+wideStart+'&ts=lte.'+wideEnd);
    const targetIsoDate = isoDate;
    const toDelete = (allCandidate||[]).filter(function(r){
      const t = new Date(r.ts);
      const localStr = t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');
      return localStr === targetIsoDate;
    });
    if(toDelete.length){
      const idList = toDelete.map(function(r){return r.id;}).join(',');
      const delRes = await fetch(SB+'/rest/v1/clock_log?id=in.('+idList+')&staff_name=eq.'+encodeURIComponent(staff),{
        method:'DELETE',
        headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Prefer':'return=representation'}
      });
      const delJson = await delRes.json().catch(function(){return null;});
      if(!delRes.ok){
        console.error('[savePunch] DELETE FAILED', delRes.status, delJson);
        showToast('⚠ Delete failed: '+delRes.status);
      }
      await new Promise(function(r){setTimeout(r, 300);});
      const verifyAll = await sbGet('clock_log','?staff_name=eq.'+encodeURIComponent(staff)+'&ts=gte.'+wideStart+'&ts=lte.'+wideEnd);
      const stillThere = (verifyAll||[]).filter(function(r){
        const t = new Date(r.ts);
        const localStr = t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');
        return localStr === targetIsoDate;
      });
      if(stillThere.length){
        for(const r of stillThere){
          await fetch(SB+'/rest/v1/clock_log?id=eq.'+encodeURIComponent(r.id),{
            method:'DELETE',
            headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Prefer':'return=minimal'}
          });
        }
      }
    }
    const _editStamp = { origin:'manual', edited_at:new Date().toISOString(), edited_by: me };
    const inserts = [];
    if(timeIn){
      const inTs = new Date(isoDate+'T'+timeIn+':00').toISOString();
      inserts.push(sbPost('clock_log', {staff_name: staff, action: 'in', ts: inTs, ..._editStamp}));
    }
    if(timeOut){
      const outTs = new Date(isoDate+'T'+timeOut+':00').toISOString();
      inserts.push(sbPost('clock_log', {staff_name: staff, action: 'out', ts: outTs, ..._editStamp}));
    }
    if(inserts.length) await Promise.all(inserts);

    if(breakHrs !== '' || coffee !== ''){
      try{
        await fetch(SB+'/rest/v1/clock_overrides?staff_name=eq.'+encodeURIComponent(staff)+'&date=eq.'+isoDate,{
          method:'DELETE',
          headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Prefer':'return=minimal'}
        });
        await fetch(SB+'/rest/v1/clock_overrides',{
          method:'POST',
          headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
          body: JSON.stringify({
            staff_name: staff,
            date: isoDate,
            break_hrs: breakHrs===''?null:parseFloat(breakHrs),
            coffee: coffee===''?null:parseFloat(coffee),
            edited_by: me
          })
        });
      }catch(e){console.warn('override save:',e);}
    } else {
      try{
        await fetch(SB+'/rest/v1/clock_overrides?staff_name=eq.'+encodeURIComponent(staff)+'&date=eq.'+isoDate,{
          method:'DELETE',
          headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Prefer':'return=minimal'}
        });
      }catch(e){}
    }

    const sheetUrl = 'https://script.google.com/macros/s/AKfycby0Bq97bCZAsmnruXFuJuCqXQE_kOxhYE2KFuJnVzLXtT5CV0Y12k5176dxZbdaYVGE/exec';
    fetch(sheetUrl, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify({
        action:'updatePunch',
        staff: staff,
        date: sheetDateStr,
        timeIn: timeIn,
        timeOut: timeOut,
        breakHrs: breakHrs,
        coffee: coffee,
        editor: me
      })
    });
    showToast('Saved · Sheet updated');
    document.getElementById('punchEditBack').style.display='none';
    if(typeof loadWhosWorking === 'function') setTimeout(loadWhosWorking, 300);
    setTimeout(function(){
      if(typeof runReport === 'function' && document.getElementById('reportsBack') && document.getElementById('reportsBack').style.display !== 'none') runReport();
      if(typeof runHoursReport === 'function' && document.getElementById('rsec-hours')) runHoursReport();
      if(typeof runManagerReport === 'function' && document.getElementById('rsec-manager') && document.getElementById('mgrStaffSel') && document.getElementById('mgrStaffSel').value) runManagerReport();
    }, 800);
    if(staff === me){
      await loadAllClockLogs();
      await loadClockState();
      if(typeof renderHours === 'function') renderHours();
    }
  }catch(e){
    console.warn('save punch:', e);
    showToast('Save failed');
    btn.disabled = false; btn.textContent = 'Save changes';
  }
}

