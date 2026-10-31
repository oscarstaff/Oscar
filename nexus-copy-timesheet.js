// ── Copy a staff timesheet in the exact Google Sheet tab layout ─────────────────
// Used by Manager Tools > Edit punches (the timesheet manager). Loaded after nexus-hours.js.
// Paste target columns: A Date | B Day | C In | D Break | E Out | F Hours | G Coffee
// Same rows as the staff tabs: WEEK-1 / 7 days / SUB-TOTAL / WEEK-2 / 7 days / SUB-TOTAL / TOTAL=
// Several fortnights are stacked newest first, the same order the live tabs use.
// Hours / SUB-TOTAL / TOTAL= are pasted as formulas, exactly like the live tabs.
//
// Runtime dependencies (all defined elsewhere in Nexus): SB, KEY, _sbBearer (nexus-ui.js), showToast (nexus-notices.js).

// fortStart : 'yyyy-mm-dd' of the fortnight's first Monday
// byDate    : { 'yyyy-mm-dd': { in:'09:45', out:'19:00', brk:0.5, coffee:5 } }  (missing day = blank row)
// startRow  : sheet row the first line (WEEK-1) will be pasted on. Default 3, because the live tabs start at row 3.
//             Hours, SUB-TOTAL and TOTAL= are live FORMULAS (same ones the Apps Script writes), and they point at
//             absolute rows, so the paste must start at that row (the copy message says "paste at A3").
// A fortnight is 19 rows: WEEK-1, 7 days, SUB-TOTAL, WEEK-2, 7 days, SUB-TOTAL, TOTAL=.
// Dates are handled in UTC so the browser's timezone cannot shift a day.
var NX_CS_FORT_ROWS = 19;
function nxTimesheetTSV(fortStart, byDate, startRow){
  var DAY = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
  var p2 = function(n){ return (n < 10 ? '0' : '') + n; };
  var parts = String(fortStart).split('-').map(Number);
  var fmtT = function(s){ if(!s) return ''; var q = String(s).split(':'); return parseInt(q[0], 10) + ':' + q[1]; };
  var rows = [], r = startRow || 3, firstDay = [], lastDay = [], subRows = [];

  for(var w = 0; w < 2; w++){
    rows.push(['', 'WEEK-' + (w + 1), '', '', '', '', '']); r++;
    firstDay[w] = r;
    for(var d = 0; d < 7; d++){
      var dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + w * 7 + d));
      var key = dt.getUTCFullYear() + '-' + p2(dt.getUTCMonth() + 1) + '-' + p2(dt.getUTCDate());
      var rec = byDate && byDate[key];
      var row = [p2(dt.getUTCDate()) + '/' + p2(dt.getUTCMonth() + 1) + '/' + dt.getUTCFullYear(), DAY[dt.getUTCDay()], '', '', '', '', ''];
      if(rec){
        if(rec.in)  row[2] = fmtT(rec.in);
        if(rec.out) row[4] = fmtT(rec.out);
        if(rec.in && rec.out){
          row[3] = Number(rec.brk) || 0;
          row[6] = (rec.coffee === '' || rec.coffee == null) ? '' : Number(rec.coffee);
          // Same formula as applyAutoRules, with a fallback for cells that hold real times after a paste.
          row[5] = '=IFERROR(IF(AND(C' + r + '<>"",E' + r + '<>""),IFERROR(TIMEVALUE(E' + r + ')-TIMEVALUE(C' + r + '),E' + r + '-C' + r + ')*24-IFERROR(D' + r + ',0),""),"")';
        }
      }
      rows.push(row); r++;
    }
    lastDay[w] = r - 1;
    // Same SUMIFS the Apps Script writes in recalcFortnightTotals.
    var f = firstDay[w], l = lastDay[w];
    rows.push(['', '', '', '', 'SUB-TOTAL',
      '=SUMIFS(F' + f + ':F' + l + ',E' + f + ':E' + l + ',"<>SUB-TOTAL")',
      '=SUMIFS(G' + f + ':G' + l + ',E' + f + ':E' + l + ',"<>SUB-TOTAL")']);
    subRows[w] = r; r++;
  }
  var tf = firstDay[0], tl = subRows[1];
  rows.push(['', '', '', '', 'TOTAL=',
    '=SUMIFS(F' + tf + ':F' + tl + ',E' + tf + ':E' + tl + ',"<>SUB-TOTAL")',
    '=SUMIFS(G' + tf + ':G' + tl + ',E' + tf + ':E' + tl + ',"<>SUB-TOTAL")']);
  return rows.map(function(x){ return x.join('\t'); }).join('\n');
}

/* ── Data: pair clock_log punches per Sydney day, same rules as the Apps Script rebuild ───────────
   earliest 'in' and latest 'out' of each day, both snapped to the 15-minute block (flexTimeStr).
   Break/Coffee come from clock_overrides when set, otherwise the sheet's own defaults:
   break 0.5h on a weekday shift over 5h (0 on weekends), coffee $5 on a shift of 4h or more. */
var _nxCsFmt = null;
function _nxCsParts(ts){
  if(!_nxCsFmt) _nxCsFmt = new Intl.DateTimeFormat('en-GB', {timeZone:'Australia/Sydney', hourCycle:'h23',
    year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'});
  var p = {}; _nxCsFmt.formatToParts(new Date(ts)).forEach(function(x){ p[x.type] = x.value; });
  return { ymd: p.year + '-' + p.month + '-' + p.day, h: (+p.hour) % 24, m: +p.minute };
}
function _nxCsFlex(h, m){
  if(m <= 7) m = 0; else if(m <= 22) m = 15; else if(m <= 37) m = 30; else if(m <= 52) m = 45;
  else { m = 0; h = (h + 1) % 24; }
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}
async function _nxCsGet(table, filter){
  // Own fetch (not sbGet) so a failed request THROWS instead of returning [] — a silent empty
  // result would copy blank rows that then overwrite real data when pasted.
  var all = [], offset = 0;
  while(true){
    var r = await fetch(SB + '/rest/v1/' + table + filter + '&limit=1000&offset=' + offset,
      { headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + _sbBearer() } });
    if(!r.ok) throw new Error(table + ' request failed (' + r.status + ')');
    var batch = await r.json();
    all = all.concat(batch);
    if(batch.length < 1000) break;
    offset += 1000;
    if(offset >= 20000) break;
  }
  return all;
}
function _nxCsShift(ymd, days){
  var p = ymd.split('-').map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + days));
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
}
async function nxSheetDataFor(staff, fromYmd, toYmd){
  var enc = encodeURIComponent(staff);
  // Widen the timestamp window by a day each side; the Sydney-date filter below does the exact cut.
  var logs = await _nxCsGet('clock_log', '?staff_name=eq.' + enc +
    '&ts=gte.' + _nxCsShift(fromYmd, -1) + 'T00:00:00Z&ts=lt.' + _nxCsShift(toYmd, 2) + 'T00:00:00Z&order=ts.asc');
  var ov = {};
  try{
    (await _nxCsGet('clock_overrides', '?staff_name=eq.' + enc + '&date=gte.' + fromYmd + '&date=lte.' + toYmd))
      .forEach(function(r){ if(r.date) ov[String(r.date).slice(0, 10)] = r; });
  }catch(e){ throw new Error('Break/coffee data could not be read (' + e.message + ')'); }

  var seen = {}, byDate = {};
  logs.forEach(function(r){
    var p = _nxCsParts(r.ts);
    if(p.ymd < fromYmd || p.ymd > toYmd) return;
    var dk = r.action + '|' + p.ymd + '|' + p.h + ':' + p.m;
    if(seen[dk]) return; seen[dk] = 1;
    var t = _nxCsFlex(p.h, p.m);
    if(t === '00:00') return;
    var rec = byDate[p.ymd] || (byDate[p.ymd] = { in: null, out: null });
    if(r.action === 'in'  && (!rec.in  || t < rec.in))  rec.in  = t;
    if(r.action === 'out' && (!rec.out || t > rec.out)) rec.out = t;
  });

  var openDays = 0;
  Object.keys(byDate).forEach(function(k){
    var rec = byDate[k];
    if(!rec.in || !rec.out){ openDays++; return; }
    var a = rec.in.split(':'), b = rec.out.split(':');
    var raw = (+b[0] + b[1] / 60) - (+a[0] + a[1] / 60); if(raw < 0) raw += 24;
    var dp = k.split('-').map(Number), dow = new Date(Date.UTC(dp[0], dp[1] - 1, dp[2])).getUTCDay();
    var brk = (dow === 0 || dow === 6) ? 0 : (raw > 5 ? 0.5 : 0);
    var coffee = raw >= 4 ? 5 : '';
    var o = ov[k];
    if(o){
      var ob = (o.break_hrs === null || o.break_hrs === undefined || o.break_hrs === '') ? NaN : parseFloat(o.break_hrs);
      var oc = (o.coffee === null || o.coffee === undefined || o.coffee === '') ? NaN : parseFloat(o.coffee);
      if(!isNaN(ob)) brk = ob;
      if(!isNaN(oc)) coffee = oc;
    }
    rec.brk = brk; rec.coffee = coffee;
  });
  return { byDate: byDate, openDays: openDays, punchCount: logs.length };
}

/* ── UI ─────────────────────────────────────────────────────────────────────────────────────── */
var NX_CS_ANCHOR = '2026-05-04';          // Monday of fortnight 0 (same anchor as the Apps Script)
var NX_CS_MAX_FORTNIGHTS = 13;            // 26 weeks, enough for any normal range

function _nxCsFortnights(startYmd, endYmd){
  var u = function(s){ var p = s.split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); };
  var idx = function(s){ return Math.floor((u(s) - u(NX_CS_ANCHOR)) / 86400000 / 14); };
  var i0 = idx(startYmd), i1 = idx(endYmd), out = [];
  for(var i = i1; i >= i0 && out.length < NX_CS_MAX_FORTNIGHTS; i--) out.push(_nxCsShift(NX_CS_ANCHOR, i * 14));
  return out;   // newest first
}

function nxCopySheetsBar(staff, startStr, endStr){
  var esc = function(s){ return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); };
  return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px;">' +
    '<span style="font-size:11.5px;color:var(--ui-ink-3,#64748b);">Copies whole fortnights in the Google Sheet tab layout, ready to paste.</span>' +
    '<button type="button" data-staff="' + esc(staff) + '" data-start="' + esc(startStr) + '" data-end="' + esc(endStr) + '" ' +
    'onclick="nxCopyForSheets(this)" style="background:var(--ui-surface-3,#f1f5f9);border:1px solid var(--ui-line,#e2e8f0);font-size:12px;padding:7px 12px;border-radius:8px;cursor:pointer;font-family:inherit;font-weight:700;color:var(--accent);">Copy for Sheets</button>' +
    '</div>';
}

// Click handler. The clipboard write is started inside the click so Safari keeps the user gesture
// while the data loads; browsers without ClipboardItem fall back to writing after the fetch.
async function nxCopyForSheets(btn){
  if(!btn || btn.dataset.busy === '1') return;
  var staff = btn.dataset.staff, forts = _nxCsFortnights(btn.dataset.start, btn.dataset.end);
  if(!staff || !forts.length){ showToast('Pick a staff member and dates first'); return; }
  var label = btn.textContent;
  btn.dataset.busy = '1'; btn.textContent = 'Copying…';
  var first = forts[forts.length - 1], last = _nxCsShift(forts[0], 13), info = null;

  var build = (async function(){
    info = await nxSheetDataFor(staff, first, last);
    return forts.map(function(f, i){ return nxTimesheetTSV(f, info.byDate, 3 + i * NX_CS_FORT_ROWS); }).join('\n');
  })();

  try{
    var done = false;
    if(window.ClipboardItem && navigator.clipboard && navigator.clipboard.write){
      try{
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': build.then(function(t){ return new Blob([t], { type: 'text/plain' }); }) })]);
        done = true;
      }catch(e){ if(e && /request failed|could not be read/.test(e.message || '')) throw e; }
    }
    var tsv = await build;
    if(!done){
      try{ await navigator.clipboard.writeText(tsv); }
      catch(e){
        var ta = document.createElement('textarea'); ta.value = tsv; ta.style.cssText = 'position:fixed;opacity:0;';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      }
    }
    var msg = 'Copied ' + forts.length + ' fortnight' + (forts.length === 1 ? '' : 's') + ' for ' + staff + '. Paste with cell A3 selected (formulas included).';
    if(info && info.openDays) msg += ' ' + info.openDays + ' day(s) have a missing clock in/out.';
    showToast(msg);
  }catch(e){
    showToast('Copy failed: ' + ((e && e.message) || e));
  }finally{
    btn.dataset.busy = '0'; btn.textContent = label;
  }
}
