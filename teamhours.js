/* ═══════════════════════════════════════════════════════════════════════
   teamhours.js — all-staff hours summary (My Reports → Manager)
   Loaded by index.html:  <script src="teamhours.js?v=1"></script>

   Separate module by convention — see ARCHITECTURE.md.

   WHY THIS EXISTS
   The Manager tab could only ever show ONE person at a time, chosen from a
   dropdown. The only whole-team view of hours was inside the payroll
   calculator, which is Accounts-only and mixes in pay rates — so an admin who
   just wanted "how many hours did everyone do this fortnight" had to click
   through 33 people one by one.

   RECONCILIATION
   Uses the SAME rules as renderHoursTable() and the payrun: first in / last
   out per day, flex-rounded, clock_overrides applied where present, and
   calcDayExtras() for the break deduction. If those numbers disagreed with
   the timesheet, the summary would be worse than useless — people would
   trust whichever they saw first.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  function _esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function _dayKey(d){
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function _fmtHrs(h){
    if(!h) return '0';
    return (Math.round(h*100)/100).toFixed(2).replace(/\.00$/,'').replace(/(\.\d)0$/,'$1');
  }

  window._teamHoursRows = [];   // kept for CSV export

  /**
   * Pull every punch in the range in ONE query rather than 33, then pair them
   * per staff/day. Thirty-three sequential round trips would make this feel
   * broken on a slow connection.
   */
  async function runTeamHours(){
    const startStr = (document.getElementById('thStart')||{}).value;
    const endStr   = (document.getElementById('thEnd')||{}).value;
    const el = document.getElementById('thResults');
    if(!el) return;
    if(!startStr || !endStr){ el.innerHTML = '<div style="color:#dc2626;font-size:13px;">Pick both dates.</div>'; return; }

    el.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:22px;font-size:13px;">Loading…</div>';

    const start = new Date(startStr+'T00:00:00');
    const end   = new Date(endStr+'T23:59:59');

    let logs = [], overrides = {};
    try{
      logs = await sbGet('clock_log',
        '?ts=gte.'+encodeURIComponent(start.toISOString())+
        '&ts=lte.'+encodeURIComponent(end.toISOString())+
        '&order=staff_name.asc,ts.asc&limit=20000');
    }catch(e){
      console.warn('[teamhours] clock_log', e);
      el.innerHTML = '<div style="color:#dc2626;font-size:13px;">Couldn\'t load punches. Check your connection and try again.</div>';
      return;
    }
    if(!logs || !logs.length){
      el.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:26px;font-size:13px;">No clock-ins in this range.</div>';
      window._teamHoursRows = [];
      return;
    }
    try{
      const ov = await sbGet('clock_overrides','?date=gte.'+startStr+'&date=lte.'+endStr);
      (ov||[]).forEach(function(r){ overrides[r.staff_name+'|'+r.date] = r; });
    }catch(e){ /* overrides are optional — raw hours still beat nothing */ }

    // Teams, so the summary can be grouped. Read from staff_credentials (the
    // authoritative team source); grouping is a nicety, so a failure here
    // degrades to one ungrouped list rather than no report.
    const teamOf = {};
    try{
      const cr = await sbGet('staff_credentials','?select=staff_name,team');
      (cr||[]).forEach(function(r){ if(r.staff_name) teamOf[r.staff_name] = r.team || ''; });
    }catch(e){ /* ungrouped is fine */ }

    // ── pair punches per staff per day ──
    const byStaff = {};
    const seen = {};
    logs.forEach(function(r){
      const t = new Date(r.ts);
      const dk = _dayKey(t);
      // Dedupe same action in the same minute — historical pileup exists.
      const sig = r.staff_name+'|'+r.action+'|'+dk+'|'+t.getHours()+':'+t.getMinutes();
      if(seen[sig]) return;
      seen[sig] = 1;

      if(!byStaff[r.staff_name]) byStaff[r.staff_name] = {};
      const days = byStaff[r.staff_name];
      if(!days[dk]) days[dk] = { date: t, in: null, out: null };
      const ft = (typeof flexClockTime === 'function') ? flexClockTime(t) : t;
      if(r.action === 'in'){
        if(!days[dk].in || ft < days[dk].in) days[dk].in = ft;
      }else if(r.action === 'out'){
        if(!days[dk].out || ft > days[dk].out) days[dk].out = ft;
      }
    });

    // ── net hours per person ──
    const rows = [];
    Object.keys(byStaff).forEach(function(name){
      const days = byStaff[name];
      let net = 0, worked = 0, openDays = 0;
      Object.keys(days).forEach(function(dk){
        const d = days[dk];
        if(!d.in || !d.out){ if(d.in) openDays++; return; }
        const span = (d.out - d.in) / 3600000;
        if(!(span > 0 && span < 24)) return;
        const ovr = overrides[name+'|'+dk];
        let hrs = span;
        if(typeof calcDayExtras === 'function'){
          // calcDayExtras returns { netHours, breakHrs, coffee } — NOT .hours.
          // Reading the wrong key silently yielded undefined and fell back to
          // gross hours, so the summary disagreed with the timesheet.
          const ex = calcDayExtras(span, ovr ? ovr.break_hrs : undefined,
                                   ovr ? ovr.coffee : undefined, d.date);
          if(ex && typeof ex.netHours === 'number') hrs = ex.netHours;
        }
        net += hrs;
        worked++;
      });
      rows.push({
        name: name,
        team: teamOf[name] || '',
        hours: net, days: worked, open: openDays
      });
    });

    rows.sort(function(a,b){
      if(a.team !== b.team) return a.team.localeCompare(b.team);
      return b.hours - a.hours;
    });
    window._teamHoursRows = rows;
    renderTeamHours(rows, startStr, endStr);
  }

  function renderTeamHours(rows, startStr, endStr){
    const el = document.getElementById('thResults');
    if(!el) return;

    const grand = rows.reduce(function(s,r){ return s + r.hours; }, 0);
    const anyOpen = rows.some(function(r){ return r.open > 0; });

    let html = '<div style="display:flex;justify-content:space-between;align-items:baseline;'+
               'flex-wrap:wrap;gap:8px;margin-bottom:12px;">'+
               '<div style="font-size:13px;color:#64748b;">'+rows.length+' staff · '+
                 _esc(startStr)+' to '+_esc(endStr)+'</div>'+
               '<div style="font-size:19px;font-weight:800;color:#0f172a;">'+_fmtHrs(grand)+'h total</div>'+
               '</div>';

    if(anyOpen){
      html += '<div style="font-size:12px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;'+
              'border-radius:9px;padding:9px 12px;margin-bottom:12px;">'+
              'Some days have a clock-in with no clock-out. Those days are excluded from the totals '+
              'and flagged below — fix them in the punch editor so the figures are complete.</div>';
    }

    let lastTeam = null, teamSum = 0, teamRows = [];
    function flushTeam(){
      if(lastTeam === null) return;
      html += '<div style="display:flex;justify-content:space-between;align-items:center;'+
              'padding:7px 12px;background:#f8fafc;border-radius:8px;margin:14px 0 6px;">'+
              '<div style="font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;'+
                'color:#64748b;">'+_esc(lastTeam || 'No team')+'</div>'+
              '<div style="font-size:12.5px;font-weight:800;color:#334155;">'+_fmtHrs(teamSum)+'h</div>'+
              '</div>' + teamRows.join('');
      teamRows = []; teamSum = 0;
    }

    rows.forEach(function(r){
      if(r.team !== lastTeam){ flushTeam(); lastTeam = r.team; }
      teamSum += r.hours;
      teamRows.push(
        '<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;'+
          'border-bottom:1px solid #f1f5f9;">'+
          '<div style="flex:1;min-width:0;">'+
            '<div style="font-size:13.5px;font-weight:650;color:#0f172a;">'+_esc(r.name)+'</div>'+
            '<div style="font-size:11px;color:#94a3b8;margin-top:1px;">'+r.days+' day'+(r.days===1?'':'s')+
              (r.open ? ' · <span style="color:#b45309;font-weight:700;">'+r.open+' unclosed</span>' : '')+
            '</div>'+
          '</div>'+
          '<div style="font-size:14.5px;font-weight:800;color:#0f172a;font-variant-numeric:tabular-nums;">'+
            _fmtHrs(r.hours)+'h</div>'+
        '</div>');
    });
    flushTeam();

    el.innerHTML = html;
  }

  function exportTeamHoursCsv(){
    const rows = window._teamHoursRows || [];
    if(!rows.length){ if(typeof showToast==='function') showToast('Run the report first'); return; }
    const lines = [['Staff','Team','Days worked','Net hours','Unclosed days'].join(',')];
    rows.forEach(function(r){
      lines.push(['"'+String(r.name).replace(/"/g,'""')+'"',
                  '"'+String(r.team).replace(/"/g,'""')+'"',
                  r.days, (Math.round(r.hours*100)/100), r.open].join(','));
    });
    const blob = new Blob([lines.join('\n')], {type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'staff-hours.csv';
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 2000);
  }

  /** Default the range to the last fortnight the first time the tab opens. */
  function initTeamHours(){
    const s = document.getElementById('thStart'), e = document.getElementById('thEnd');
    if(!s || !e || s.value) return;
    const today = new Date();
    const from = new Date(today); from.setDate(today.getDate()-13);
    const fmt = function(d){ return _dayKey(d); };
    s.value = fmt(from); e.value = fmt(today);
  }

  window.runTeamHours       = runTeamHours;
  window.exportTeamHoursCsv = exportTeamHoursCsv;
  window.initTeamHours      = initTeamHours;
})();
