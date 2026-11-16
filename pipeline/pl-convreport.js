'use strict';
/* pl-convreport.js · Pipe-Line · Conversion report.
   One of the Pipe-Line files loaded by nex.html (list and order: PL_FILES in the loader). All of them share one global scope. */
/* ---------- Conversion report: the enrolment team's weekly numbers, worked out from Pipe-Line ----------
   Status table and pie: enrolments created in the range (enrolment date, else the day it was added), by stage now.
   Follow-ups: follow-ups marked done in the range, by step. Class: see the note printed under the block. */
const CR = { from: '', to: '' };
const CR_ORDER = ['processed', 'placement', 'not_interested', 'hold', 'docs_completed', 'blended', 'incomplete_docs', 'issue', 'checklist_sent', 'certificate_issued'];
const CR_COLORS = ['#2f6fed', '#e5484d', '#8b5e3c', '#f5a524', '#8e4ec6', '#12a594', '#d6409f', '#6e7787', '#30a46c', '#3a8eca', '#9aa3b2'];
function crOffset(d) {
  try {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' }).formatToParts(new Date(d + 'T12:00:00Z')).find(x => x.type === 'timeZoneName');
    const m = /GMT([+-])(\d\d):?(\d\d)?/.exec(p ? p.value : '');
    return m ? m[1] + m[2] + ':' + (m[3] || '00') : '+10:00';
  } catch (e) { return '+10:00'; }
}
function crStart(d) { return d + 'T00:00:00' + crOffset(d); }
function crNext(d) { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); }
function crShift(d, n) { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
function crPreset(k) {
  const t = sydToday(), mon = trMonday(t);
  if (k === 'week') return [mon, t];
  if (k === 'last') return [crShift(mon, -7), crShift(mon, -1)];
  if (k === '7') return [crShift(t, -6), t];
  return [t.slice(0, 8) + '01', t];
}
function crLong(d) { const x = new Date(d + 'T12:00:00'); return x.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-'); }

async function crData(from, to) {
  const A = crStart(from), B = crStart(crNext(to));
  const orQ = encodeURIComponent('(and(enrolled_on.gte.' + from + ',enrolled_on.lte.' + to + '),and(enrolled_on.is.null,created_at.gte.' + A + ',created_at.lt.' + B + '))');
  const [enr, fus, bks] = await Promise.all([
    sel('nex_enrolments', 'select=id,stage,student_id,nex_students!inner(outside_sydney)&nex_students.deleted_at=is.null&deleted_at=is.null&or=' + orQ + '&limit=1000'),
    sel('nex_followups', 'select=step,kind&done_at=gte.' + encodeURIComponent(A) + '&done_at=lt.' + encodeURIComponent(B) + '&limit=1000'),
    sel('nex_class_bookings', 'select=student_id,name&created_at=gte.' + encodeURIComponent(A) + '&created_at=lt.' + encodeURIComponent(B) + '&status=not.in.(cancelled,info_only)&limit=1000')
  ]);
  const people = Array.from(new Set(enr.map(e => e.student_id)));
  const booked = new Set();
  for (let i = 0; i < people.length; i += 80) {
    const rows = await sel('nex_class_bookings', 'select=student_id&status=not.in.(cancelled,info_only)&student_id=in.(' + people.slice(i, i + 80).join(',') + ')&limit=1000');
    rows.forEach(r => booked.add(r.student_id));
  }
  const byStage = {}; enr.forEach(e => { const k = e.stage || ''; byStage[k] = (byStage[k] || 0) + 1; });
  const steps = {}; let other = 0;
  fus.forEach(f => { if (f.kind === 'lead_cycle' && f.step) steps[f.step] = (steps[f.step] || 0) + 1; else other++; });
  const outside = new Set(enr.filter(e => e.nex_students && e.nex_students.outside_sydney).map(e => e.student_id)).size;
  const classBooked = new Set(bks.map(b => b.student_id || ('n:' + String(b.name || '').toLowerCase()))).size;
  return { total: enr.length, byStage, steps, other, fuTotal: fus.length, without: people.filter(p => !booked.has(p)).length, classBooked, outside, capped: enr.length >= 1000 || fus.length >= 1000 };
}

function crPie(rows, total) {
  const live = rows.filter(r => r.n > 0);
  if (!total || !live.length) return '<div class="nx-muted" style="padding:40px 0;text-align:center">Nothing in this range yet.</div>';
  let a0 = -Math.PI / 2, out = '';
  const pt = a => (100 + 90 * Math.cos(a)).toFixed(2) + ' ' + (100 + 90 * Math.sin(a)).toFixed(2);
  live.forEach(r => {
    const f = r.n / total, tip = '<title>' + esc(r.label) + ': ' + r.n + ' (' + Math.round(f * 1000) / 10 + '%)</title>';
    if (f >= 0.9999) { out += '<circle cx="100" cy="100" r="90" fill="' + r.color + '">' + tip + '</circle>'; return; }
    const a1 = a0 + f * 2 * Math.PI;
    out += '<path d="M100 100 L' + pt(a0) + ' A90 90 0 ' + (f > 0.5 ? 1 : 0) + ' 1 ' + pt(a1) + ' Z" fill="' + r.color + '">' + tip + '</path>'; a0 = a1;
  });
  return '<svg class="nx-pie" viewBox="0 0 200 200" role="img" aria-label="Share of each stage: ' + esc(live.map(r => r.label + ' ' + r.n).join(', ')) + '">' + out + '</svg>';
}

function crHtml(d, from, to) {
  const known = CR_ORDER.filter(k => (REF.status.enrolment || []).some(o => o.key === k));
  const extra = (REF.status.enrolment || []).map(o => o.key).filter(k => !known.includes(k) && d.byStage[k]);
  const keys = known.concat(extra);
  const rows = keys.map((k, i) => ({ label: statusLabel('enrolment', k), n: d.byStage[k] || 0, color: CR_COLORS[i % CR_COLORS.length] }));
  const none = d.byStage[''] || 0; if (none) rows.push({ label: 'No stage set', n: none, color: CR_COLORS[10] });
  const pct = n => d.total ? (Math.round(n / d.total * 1000) / 10) + '%' : '–';
  const statusTable = '<div class="nx-tablewrap"><table class="nx-table auto tight"><thead><tr><th>Status</th><th class="nx-num">Number</th><th class="nx-num">Share</th></tr></thead><tbody>' +
    rows.map(r => '<tr><td><span class="nx-swatch" style="background:' + r.color + '"></span>' + esc(r.label) + '</td><td class="nx-num">' + r.n + '</td><td class="nx-num">' + (r.n ? pct(r.n) : '–') + '</td></tr>').join('') +
    '<tr class="nx-totrow"><td>Total</td><td class="nx-num">' + d.total + '</td><td class="nx-num"></td></tr></tbody></table></div>';
  const ord = n => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
  let fu = '<tr class="nx-totrow"><td>Follow-ups done</td><td class="nx-num">' + d.fuTotal + '</td></tr>';
  for (let i = 1; i <= 9; i++) fu += '<tr><td>' + ord(i) + ' follow-up</td><td class="nx-num">' + (d.steps[i] || 0) + '</td></tr>';
  fu += '<tr><td>Other (added by hand)</td><td class="nx-num">' + d.other + '</td></tr>';
  const cls = '<tr><td>Without First Aid and CPR</td><td class="nx-num">' + d.without + '</td></tr><tr><td>Class booked</td><td class="nx-num">' + d.classBooked + '</td></tr><tr><td>Outside Sydney</td><td class="nx-num">' + d.outside + '</td></tr>';
  return '<div class="nx-report nx-crep">' +
    '<div class="nx-crhead"><div><span class="nx-muted">From</span><b>' + esc(crLong(from)) + '</b></div><div><span class="nx-muted">To</span><b>' + esc(crLong(to)) + '</b></div></div>' +
    (d.capped ? '<div class="nx-note">This range has more rows than Pipe-Line can count in one go (1,000). Pick a shorter range for exact numbers.</div>' : '') +
    '<div class="nx-crgrid"><div><h3>Student conversion</h3>' + statusTable + '</div><div class="nx-crpie">' + crPie(rows, d.total) + '</div></div>' +
    '<div class="nx-crgrid2"><div><h3>Follow-ups</h3><div class="nx-tablewrap"><table class="nx-table auto tight"><thead><tr><th>Follow-up</th><th class="nx-num">Number</th></tr></thead><tbody>' + fu + '</tbody></table></div></div>' +
    '<div><h3>Class status</h3><div class="nx-tablewrap"><table class="nx-table auto tight"><thead><tr><th>Class status</th><th class="nx-num">Number</th></tr></thead><tbody>' + cls + '</tbody></table></div>' +
    '<p class="nx-muted nx-crnote">Status: enrolments added in these dates, by the stage they are in now. Follow-ups: marked done in these dates. Class booked: people with a First Aid and CPR booking made in these dates. Without: people added in these dates with no booking yet. Outside Sydney: added in these dates and ticked Outside Sydney on their record.</p></div></div></div>';
}

route(/^\/convreport$/, async () => {
  if (!CR.from) { const p = crPreset('week'); CR.from = p[0]; CR.to = p[1]; }
  afterRender(() => {
    const out = $('#crOut'), f = $('#crFrom'), t = $('#crTo'), pr = $('#crPrint');
    let seq = 0;
    const run = async () => {
      if (!f.value || !t.value) return;
      if (f.value > t.value) { out.innerHTML = empty('Check the dates', 'The From date is after the To date.'); pr.hidden = true; return; }
      CR.from = f.value; CR.to = t.value;
      const my = ++seq; out.setAttribute('aria-busy', 'true');
      try { const d = await crData(CR.from, CR.to); if (my !== seq) return; out.innerHTML = crHtml(d, CR.from, CR.to); pr.hidden = false; }
      catch (e) { if (my === seq) { out.innerHTML = empty('Could not build the report', e.message); pr.hidden = true; } }
      out.removeAttribute('aria-busy');
    };
    f.onchange = t.onchange = run;
    $$('[data-crp]').forEach(b => { b.onclick = () => { const p = crPreset(b.dataset.crp); f.value = p[0]; t.value = p[1]; run(); }; });
    pr.onclick = () => { document.body.classList.add('nx-print-report'); const done = () => { document.body.classList.remove('nx-print-report'); window.removeEventListener('afterprint', done); }; window.addEventListener('afterprint', done); window.print(); };
    run();
  });
  const today = sydToday();
  return pageHead('chart', 'Enrolment team', 'Conversion report', '') +
    '<div class="nx-card nx-noprint"><div class="nx-card-h"><div><h3>Dates</h3><div class="nx-muted">Numbers are worked out from Pipe-Line for the dates you pick.</div></div><span class="nx-btnrow"><button class="nx-btn sm" data-crp="week">This week</button><button class="nx-btn sm" data-crp="last">Last week</button><button class="nx-btn sm" data-crp="7">Last 7 days</button><button class="nx-btn sm" data-crp="month">This month</button></span></div>' +
    '<div class="nx-card-b"><div class="nx-form"><div><label class="nx-lbl" for="crFrom">From</label><input class="nx-in" type="date" id="crFrom" max="' + today + '" value="' + esc(CR.from) + '"></div><div><label class="nx-lbl" for="crTo">To</label><input class="nx-in" type="date" id="crTo" max="' + today + '" value="' + esc(CR.to) + '"></div></div></div></div>' +
    '<div class="nx-card nx-printwrap"><div class="nx-card-h nx-noprint"><div><h3>Report</h3></div><span class="nx-btnrow"><button class="nx-btn sm" id="crPrint" hidden>' + ico('print') + 'Print or save as PDF</button></span></div><div id="crOut"><div class="nx-skel" style="height:240px;margin:16px"></div></div></div>';
});
