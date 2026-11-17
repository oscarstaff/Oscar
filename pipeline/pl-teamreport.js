'use strict';
/* pl-teamreport.js · YatraLine · Team report.
   One of the YatraLine files loaded by nex.html (list and order: PL_FILES in the loader). All of them share one global scope. */
/* =========================================================
   YatraLine staff pages, copied from Nexus (15 Nov 2026): Team report and the Pip FAQ helper.
   Team report reads and writes the same tables as Nexus (processing_reports, processing_metrics,
   placement_weekly), so an entry made in either app shows in both.
   ========================================================= */

/* ---------- Team report ---------- */
const TR_SHAPES = { processing: 'metrics', enrolment: 'log', evershine: 'log', placement: 'placement' };
const TR_NO_REPORT = { evershine: true };
const TR_DAYS = 6;   /* Monday to Saturday */
const TR = { team: '', date: '', week: '', metrics: [], editing: null, pl: null };
const tKey = t => String(t || '').trim().toLowerCase();
function trMonday(d) { const x = new Date(d + 'T12:00:00'); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return x.toLocaleDateString('en-CA'); }
function trAdd(d, n) { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toLocaleDateString('en-CA'); }
function trDay(d) { const x = new Date(d + 'T12:00:00'); return x.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }); }
function trLines(v) { return String(v || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean); }
route(/^\/teamreport$/, async () => {
  const me = await loadMe();
  let teams = [];
  if (ME.admin) { const all = await sel('staff_credentials', 'select=team'); teams = Array.from(new Set((all || []).map(r => r.team).filter(Boolean))).filter(t => !TR_NO_REPORT[tKey(t)]).sort(); }
  if (!TR.team || (!ME.admin && tKey(TR.team) !== tKey(me.team))) TR.team = (ME.admin && teams.length && (!me.team || TR_NO_REPORT[tKey(me.team)])) ? teams[0] : (me.team || '');
  const team = TR.team, shape = TR_SHAPES[tKey(team)] || 'log';
  if (!team) return pageHead('chart', 'Team report', 'Team report', '') + '<div class="nx-card">' + empty('You are not in a team yet', 'An admin sets your team in ShiftOps. Once that is done your daily entries and weekly report appear here.') + '</div>';
  if (TR_NO_REPORT[tKey(team)]) return pageHead('chart', team, 'Team report', '') + '<div class="nx-card">' + empty('The ' + team + ' team does not use the team report', 'There is nothing to fill in here.') + '</div>';
  const canEnter = ME.admin || tKey(me.team) === tKey(team);
  const isLead = ME.admin || ((me.shiftAdmin || me.shiftops) && tKey(me.team) === tKey(team));
  const today = sydToday();
  if (!TR.date) TR.date = today; if (!TR.week) TR.week = trMonday(today);
  TR.metrics = shape === 'metrics' ? (await sel('processing_metrics', 'select=metric_key,label,sort_order,archived&team=eq.' + encodeURIComponent(team) + '&order=sort_order.asc')).filter(m => !m.archived) : [];
  const M = TR.metrics;

  afterRender(() => {
    /* --- daily entry --- */
    const dateEl = $('#trDate'), tasksEl = $('#trTasks'), saveBtn = $('#trSave'), msg = $('#trMsg');
    const loadDay = async () => {
      if (!canEnter) return;
      const rows = await sel('processing_reports', 'select=metrics,tasks&staff_name=eq.' + encodeURIComponent(ME.name) + '&report_date=eq.' + TR.date + '&limit=1');
      const row = rows && rows[0], vals = (row && row.metrics) || {};
      M.forEach(m => { const el = document.getElementById('trM_' + m.metric_key); if (el) el.value = row ? (vals[m.metric_key] != null ? vals[m.metric_key] : 0) : ''; });
      tasksEl.value = row ? (row.tasks || '') : '';
      $('#trEntryH').textContent = (row ? 'Edit entry for ' : 'Entry for ') + trDay(TR.date);
    };
    const myWeek = async () => {
      const box = $('#trWeek'); if (!box) return; holdBody(box);
      const mon = TR.week, sun = trAdd(mon, TR_DAYS - 1);
      const rows = await sel('processing_reports', 'select=report_date,metrics,tasks&staff_name=eq.' + encodeURIComponent(ME.name) + '&report_date=gte.' + mon + '&report_date=lte.' + sun + '&order=report_date.asc');
      const by = {}; (rows || []).forEach(r => by[r.report_date] = r);
      $('#trWeekL').textContent = trDay(mon) + ' to ' + trDay(sun);
      const tot = {}; M.forEach(m => tot[m.metric_key] = 0);
      box.innerHTML = '<div class="nx-tablewrap"><table class="nx-table tight auto"><thead><tr><th>Day</th>' + M.map(m => '<th class="nx-right">' + esc(m.label) + '</th>').join('') + '<th>Tasks</th><th></th></tr></thead><tbody>' +
        Array.from({ length: TR_DAYS }, (_, i) => trAdd(mon, i)).map(d => {
          const r = by[d], v = (r && r.metrics) || {};
          M.forEach(m => tot[m.metric_key] += Number(v[m.metric_key] || 0));
          return '<tr><td class="nx-num">' + esc(trDay(d)) + '</td>' + M.map(m => '<td class="nx-right nx-num">' + (r ? Number(v[m.metric_key] || 0) : '<span class="nx-muted">–</span>') + '</td>').join('') + '<td>' + (r && trLines(r.tasks).length ? esc(trLines(r.tasks).join(' · ')) : '<span class="nx-muted">–</span>') + '</td><td class="nx-right">' + (canEnter && d <= today ? '<button class="nx-btn sm" data-ed="' + d + '">' + (r ? 'Edit' : 'Add') + '</button>' : '') + '</td></tr>';
        }).join('') + (M.length ? '<tr class="nx-totrow"><td>Total</td>' + M.map(m => '<td class="nx-right nx-num">' + tot[m.metric_key] + '</td>').join('') + '<td></td><td></td></tr>' : '') + '</tbody></table></div>';
      $$('[data-ed]', box).forEach(b => b.onclick = () => { TR.date = b.dataset.ed; dateEl.value = TR.date; loadDay().then(() => { tasksEl.focus(); }); });
    };
    if (canEnter) {
      dateEl.onchange = () => { if (dateEl.value && dateEl.value <= today) { TR.date = dateEl.value; loadDay(); } else dateEl.value = TR.date; };
      saveBtn.onclick = async () => {
        const vals = {}; M.forEach(m => { const el = document.getElementById('trM_' + m.metric_key); const v = el ? parseInt(el.value, 10) : 0; vals[m.metric_key] = isNaN(v) || v < 0 ? 0 : v; });
        saveBtn.classList.add('busy'); saveBtn.disabled = true; msg.textContent = '';
        try {
          await api('processing_reports?on_conflict=staff_name,report_date', { method: 'POST', body: { staff_name: ME.name, report_date: TR.date, metrics: vals, tasks: tasksEl.value.trim(), updated_at: new Date().toISOString() }, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
          toast('Saved for ' + trDay(TR.date)); TR.week = trMonday(TR.date); await Promise.all([loadDay(), myWeek()]);
        } catch (e) { msg.textContent = 'Not saved. ' + e.message; }
        saveBtn.classList.remove('busy'); saveBtn.disabled = false;
      };
      $('#trPrev').onclick = () => { TR.week = trAdd(TR.week, -7); myWeek(); };
      $('#trNext').onclick = () => { TR.week = trAdd(TR.week, 7); myWeek(); };
      $('#trThis').onclick = () => { TR.week = trMonday(today); myWeek(); };
      viewWait(Promise.all([loadDay(), myWeek()]));
    }
    const tp = $('#trTeam'); if (tp) tp.onchange = () => { TR.team = tp.value; TR.pl = null; render(); };

    /* --- weekly placement sections (Placement team leads) --- */
    const plHost = $('#trPl');
    const PLC = { cancellations: [['student', 'Student'], ['facility', 'Facility'], ['reason', 'Reason'], ['action', 'Action taken']], facility_issues: [['facility', 'Facility'], ['issue', 'Issue'], ['status', 'Status']], student_issues: [['student', 'Student'], ['issue', 'Issue'], ['status', 'Current status']] };
    const PLT = { cancellations: '2. Placement cancellations', facility_issues: '3. Facility issues', student_issues: '4. Student issues' };
    const plHarvest = () => {
      Object.keys(PLC).forEach(k => $$('[data-pl="' + k + '"]', plHost).forEach(el => { const i = +el.dataset.i; TR.pl[k] = TR.pl[k] || []; TR.pl[k][i] = TR.pl[k][i] || {}; TR.pl[k][i][el.dataset.f] = el.value; }));
      const num = id => { const el = $('#' + id, plHost); return el && el.value !== '' ? Math.max(0, +el.value || 0) : null; };
      TR.pl.students = { total: num('plTotal'), within_nsw: num('plIn'), outside_nsw: num('plOut') };
    };
    const plPaint = () => {
      const s = TR.pl.students || {}, nv = v => v != null ? esc(v) : '';
      plHost.innerHTML = '<div class="nx-plsec"><h4>1. Placement students who started this week</h4><div class="nx-form three"><div><label class="nx-lbl" for="plTotal">Total</label><input class="nx-in" type="number" min="0" id="plTotal" value="' + nv(s.total) + '"></div><div><label class="nx-lbl" for="plIn">Within Sydney or NSW</label><input class="nx-in" type="number" min="0" id="plIn" value="' + nv(s.within_nsw) + '"></div><div><label class="nx-lbl" for="plOut">Outside NSW or regional</label><input class="nx-in" type="number" min="0" id="plOut" value="' + nv(s.outside_nsw) + '"></div></div></div>' +
        Object.keys(PLC).map(k => { const arr = Array.isArray(TR.pl[k]) ? TR.pl[k] : []; return '<div class="nx-plsec"><h4>' + PLT[k] + '</h4>' + (arr.length ? '<div class="nx-tablewrap"><table class="nx-table tight auto"><thead><tr>' + PLC[k].map(c => '<th>' + c[1] + '</th>').join('') + '<th></th></tr></thead><tbody>' + arr.map((row, i) => '<tr>' + PLC[k].map(c => '<td><input class="nx-in sm" style="width:100%;min-width:110px" aria-label="' + c[1] + '" data-pl="' + k + '" data-i="' + i + '" data-f="' + c[0] + '" value="' + esc((row || {})[c[0]] || '') + '"></td>').join('') + '<td class="nx-right"><button class="nx-btn sm quiet" data-del="' + k + '" data-i="' + i + '" aria-label="Remove row">' + ico('x') + '</button></td></tr>').join('') + '</tbody></table></div>' : '<div class="nx-muted" style="margin:4px 0 8px">None this week.</div>') + '<button class="nx-btn sm" data-add="' + k + '">' + ico('plus') + 'Add row</button></div>'; }).join('') +
        '<div class="nx-btnrow" style="margin-top:8px"><button class="nx-btn primary" id="plSave">Save weekly sections</button><span class="nx-err" id="plMsg" role="alert"></span></div>';
      $$('[data-add]', plHost).forEach(b => b.onclick = () => { plHarvest(); (TR.pl[b.dataset.add] = TR.pl[b.dataset.add] || []).push({}); plPaint(); });
      $$('[data-del]', plHost).forEach(b => b.onclick = () => { plHarvest(); TR.pl[b.dataset.del].splice(+b.dataset.i, 1); plPaint(); });
      $('#plSave', plHost).onclick = async e => {
        plHarvest(); const btn = e.currentTarget; btn.classList.add('busy'); btn.disabled = true;
        try { await api('placement_weekly?on_conflict=team,week_start', { method: 'POST', body: { team, week_start: trMonday($('#trRepWeek').value || today), students: TR.pl.students || {}, cancellations: TR.pl.cancellations || [], facility_issues: TR.pl.facility_issues || [], student_issues: TR.pl.student_issues || [], updated_by: ME.name, updated_at: new Date().toISOString() }, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } }); toast('Weekly sections saved'); }
        catch (err) { $('#plMsg', plHost).textContent = 'Not saved. ' + err.message; }
        btn.classList.remove('busy'); btn.disabled = false;
      };
    };
    const plLoad = async () => {
      const mon = trMonday($('#trRepWeek').value || today);
      const rows = await sel('placement_weekly', 'select=students,cancellations,facility_issues,student_issues&team=eq.' + encodeURIComponent(team) + '&week_start=eq.' + mon + '&limit=1');
      TR.pl = (rows && rows[0]) || { students: {}, cancellations: [], facility_issues: [], student_issues: [] };
      plPaint();
    };

    /* --- weekly team report (leads and admins) --- */
    const out = $('#trOut'), gen = $('#trGen');
    if (gen) {
      const wk = $('#trRepWeek');
      wk.onchange = () => { if (plHost) plLoad().catch(() => {}); out.innerHTML = ''; $('#trPrint').hidden = true; };
      if (plHost) viewWait(plLoad().catch(() => {}));
      gen.onclick = async () => {
        gen.classList.add('busy'); gen.disabled = true; holdBody(out);
        try { out.innerHTML = await teamReportHtml(team, shape, M, trMonday(wk.value || today)); $('#trPrint').hidden = false; }
        catch (e) { out.innerHTML = empty('Could not build the report', e.message); }
        gen.classList.remove('busy'); gen.disabled = false;
      };
      $('#trPrint').onclick = () => { document.body.classList.add('nx-print-report'); const done = () => { document.body.classList.remove('nx-print-report'); window.removeEventListener('afterprint', done); }; window.addEventListener('afterprint', done); window.print(); };
    }
  });

  const teamPick = ME.admin && teams.length > 1 ? '<select class="nx-sel sm" id="trTeam" aria-label="Team">' + teams.map(t => '<option' + (t === team ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select>' : '';
  return pageHead('chart', team + ' team', 'Team report', teamPick) +
    (canEnter ? '<div class="nx-card nx-noprint"><div class="nx-card-h"><h3 id="trEntryH">Entry for ' + esc(trDay(TR.date)) + '</h3><input class="nx-in sm" type="date" id="trDate" aria-label="Day" max="' + today + '" value="' + esc(TR.date) + '"></div><div class="nx-card-b">' +
      (M.length ? '<div class="nx-form three">' + M.map(m => '<div><label class="nx-lbl" for="trM_' + esc(m.metric_key) + '">' + esc(m.label) + '</label><input class="nx-in" type="number" min="0" inputmode="numeric" id="trM_' + esc(m.metric_key) + '"></div>').join('') + '</div>' : '') +
      '<div style="margin-top:' + (M.length ? '14' : '0') + 'px"><label class="nx-lbl" for="trTasks">' + (shape === 'metrics' ? 'Other tasks' : 'What you worked on') + '</label><textarea class="nx-ta" id="trTasks" rows="5" placeholder="One task per line"></textarea></div>' +
      '<div class="nx-btnrow" style="margin-top:14px"><button class="nx-btn primary" id="trSave">Save entry</button><span class="nx-err" id="trMsg" role="alert"></span></div></div></div>' +
      '<div class="nx-card nx-noprint"><div class="nx-card-h"><div><h3>My week</h3><div class="nx-muted" id="trWeekL"></div></div><span class="nx-btnrow"><button class="nx-btn sm" id="trPrev">Previous</button><button class="nx-btn sm" id="trThis">This week</button><button class="nx-btn sm" id="trNext">Next</button></span></div><div id="trWeek"></div></div>'
      : '<div class="nx-card nx-noprint"><div class="nx-note">' + ico('lock') + 'You are viewing the ' + esc(team) + ' team. Daily entries are made by people in that team.</div></div>') +
    (isLead ? (shape === 'placement' ? '<div class="nx-card nx-noprint"><div class="nx-card-h"><div><h3>Weekly placement sections</h3><div class="nx-muted">Filled in by the team lead for the week chosen below.</div></div></div><div class="nx-card-b" id="trPl"></div></div>' : '') +
      '<div class="nx-card nx-printwrap"><div class="nx-card-h nx-noprint"><div><h3>Weekly team report</h3><div class="nx-muted">Monday to Saturday for everyone in ' + esc(team) + '.</div></div><span class="nx-btnrow"><input class="nx-in sm" type="date" id="trRepWeek" aria-label="Any day in the week" value="' + today + '"><button class="nx-btn primary sm" id="trGen">Generate</button><button class="nx-btn sm" id="trPrint" hidden>' + ico('print') + 'Print or save as PDF</button></span></div><div id="trOut"></div></div>'
      : '');
});
async function teamReportHtml(team, shape, M, mon) {
  const sun = trAdd(mon, TR_DAYS - 1), days = Array.from({ length: TR_DAYS }, (_, i) => trAdd(mon, i));
  const [members, reps] = await Promise.all([
    sel('staff_credentials', 'select=staff_name&team=eq.' + encodeURIComponent(team) + '&order=staff_name.asc'),
    sel('processing_reports', 'select=staff_name,report_date,metrics,tasks&report_date=gte.' + mon + '&report_date=lte.' + sun + '&order=staff_name.asc,report_date.asc')
  ]);
  const names = (members || []).map(m => m.staff_name).filter(Boolean);
  if (!names.length) return empty('No ' + team + ' staff found', 'Team membership is set in ShiftOps.');
  const by = {}; names.forEach(n => by[n] = {}); (reps || []).forEach(r => { if (by[r.staff_name]) by[r.staff_name][r.report_date] = r; });
  const head = '<div class="nx-rephead"><h2>' + esc(team) + ': ' + (shape === 'placement' ? 'weekly report' : shape === 'metrics' ? 'weekly report' : 'daily work log') + '</h2><div class="nx-muted">Week of ' + esc(trDay(mon)) + ' to ' + esc(trDay(sun)) + ' · prepared by ' + esc(ME.name) + '</div></div>';
  const tbl = (cols, rows) => '<div class="nx-tablewrap"><table class="nx-table tight auto"><thead><tr>' + cols.map(c => '<th' + (c[1] ? ' class="nx-right"' : '') + '>' + esc(c[0]) + '</th>').join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  let h = '<div class="nx-report">' + head;
  if (shape === 'placement') {
    const pr = await sel('placement_weekly', 'select=students,cancellations,facility_issues,student_issues&team=eq.' + encodeURIComponent(team) + '&week_start=eq.' + mon + '&limit=1');
    const sec = (pr && pr[0]) || {}, s = sec.students || {}, v = x => x != null ? esc(x) : '–';
    const list = (arr, cols) => Array.isArray(arr) && arr.length ? tbl(cols.map(c => [c[1]]), arr.map(r => '<tr>' + cols.map(c => '<td>' + esc((r || {})[c[0]] || '') + '</td>').join('') + '</tr>')) : '<div class="nx-muted">None this week.</div>';
    h += '<h3>1. Placement students</h3>' + tbl([['Measure'], ['Count', 1]], ['<tr><td>Total started</td><td class="nx-right nx-num">' + v(s.total) + '</td></tr>', '<tr><td>Within Sydney or NSW</td><td class="nx-right nx-num">' + v(s.within_nsw) + '</td></tr>', '<tr><td>Outside NSW or regional</td><td class="nx-right nx-num">' + v(s.outside_nsw) + '</td></tr>']) +
      '<h3>2. Placement cancellations</h3>' + list(sec.cancellations, [['student', 'Student'], ['facility', 'Facility'], ['reason', 'Reason'], ['action', 'Action taken']]) +
      '<h3>3. Facility issues</h3>' + list(sec.facility_issues, [['facility', 'Facility'], ['issue', 'Issue'], ['status', 'Status']]) +
      '<h3>4. Student issues</h3>' + list(sec.student_issues, [['student', 'Student'], ['issue', 'Issue'], ['status', 'Current status']]) +
      '<h3>5. Daily tasks by team member</h3>' + tbl([['Member']].concat(days.map(d => [trDay(d)])), names.map(n => '<tr><td><b>' + esc(n) + '</b></td>' + days.map(d => { const r = by[n][d], t = r ? trLines(r.tasks) : []; return '<td>' + (t.length ? t.map(esc).join('<br>') : '<span class="nx-muted">–</span>') + '</td>'; }).join('') + '</tr>'));
    return h + '</div>';
  }
  let calls = {};
  if (shape === 'metrics') { try { const cl = await sel('call_log', 'select=logged_by&deleted_at=is.null&created_at=gte.' + mon + '&created_at=lt.' + trAdd(mon, TR_DAYS)); (cl || []).forEach(r => { const w = (r.logged_by || '').trim(); if (w) calls[w] = (calls[w] || 0) + 1; }); } catch (e) { calls = {}; } }
  const grand = { calls: 0 }; M.forEach(m => grand[m.metric_key] = 0);
  names.forEach(n => {
    const rows = days.map(d => by[n][d]).filter(Boolean);
    h += '<h3>' + esc(n) + '</h3>';
    if (shape !== 'metrics') {
      h += rows.length ? tbl([['Day'], ['Tasks']], rows.map(r => '<tr><td class="nx-num">' + esc(trDay(r.report_date)) + '</td><td>' + (trLines(r.tasks).length ? trLines(r.tasks).map(esc).join('<br>') : '<span class="nx-muted">–</span>') + '</td></tr>')) : '<div class="nx-muted">No entries this week.</div>';
      return;
    }
    const c = calls[n] || 0; grand.calls += c;
    h += '<div class="nx-repline">Calls logged this week: <b>' + c + '</b></div>';
    if (!rows.length) { h += '<div class="nx-muted">No entries this week.</div>'; return; }
    const tot = {}; M.forEach(m => tot[m.metric_key] = 0);
    const body = rows.map(r => { const v = r.metrics || {}; return '<tr><td class="nx-num">' + esc(trDay(r.report_date)) + '</td>' + M.map(m => { const x = Number(v[m.metric_key] || 0); tot[m.metric_key] += x; return '<td class="nx-right nx-num">' + x + '</td>'; }).join('') + '</tr>'; });
    M.forEach(m => grand[m.metric_key] += tot[m.metric_key]);
    body.push('<tr class="nx-totrow"><td>Total</td>' + M.map(m => '<td class="nx-right nx-num">' + tot[m.metric_key] + '</td>').join('') + '</tr>');
    h += tbl([['Day']].concat(M.map(m => [m.label, 1])), body);
    const notes = []; rows.forEach(r => trLines(r.tasks).forEach(t => notes.push('<li>' + esc(trDay(r.report_date)) + ': ' + esc(t) + '</li>')));
    if (notes.length) h += '<div class="nx-repline">Other tasks</div><ul class="nx-replist">' + notes.join('') + '</ul>';
  });
  if (shape === 'metrics') h += '<h3>Team total</h3>' + tbl([['Measure'], ['Total', 1]], ['<tr><td>Calls logged</td><td class="nx-right nx-num">' + grand.calls + '</td></tr>'].concat(M.map(m => '<tr><td>' + esc(m.label) + '</td><td class="nx-right nx-num">' + grand[m.metric_key] + '</td></tr>')));
  return h + '</div>';
}
