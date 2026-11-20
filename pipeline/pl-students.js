'use strict';
/* pl-students.js · YatraLine · Overview, Leads / Students / Search lists, the student record.
   One of the YatraLine files loaded by nex.html (list and order: PL_FILES in the loader). All of them share one global scope. */
/* =========================================================
   Overview, Students list, Student record
   ========================================================= */
const PATH = ['checklist_sent', 'docs_completed', 'processed', 'placement', 'certificate_issued'];

/* ---------- Overview ---------- */
route(/^\/$/, async () => {
  const today = sydToday();
  const [nStu, nLead, nOpenEnr, nQueue, nUnm, nDue, sessions, pmRows, nVer, nCash, nFu] = await Promise.all([
    countKind('student'),
    countKind('lead'),
    count('nex_enrolments', 'deleted_at=is.null&stage=not.in.(certificate_issued,not_interested)'),
    count('nex_payment_queue', 'processing_step=neq.processed'),
    count('nex_payments', 'student_id=is.null'),
    count('nex_tasks', 'status=neq.done&due_on=lte.' + today + '&assigned_to=eq.' + encodeURIComponent(ME.name)),
    sel('nex_class_sessions', 'select=*&kind=neq.renewal&class_date=gte.' + today + '&order=class_date&limit=4'),
    placementMailLoad().catch(() => []),
    canVerify() ? count('nex_payments', 'verify_status=eq.pending_verification') : 0,
    ME.admin ? count('nex_payments', 'handover_status=eq.awaiting') : 0,
    leadFuCount('due').catch(() => 0)
  ]);
  let counts = {};
  if (sessions.length) {
    const bk = await sel('nex_class_bookings', 'select=session_id&session_id=in.' + inList(sessions.map(s => s.id)));
    bk.forEach(b => counts[b.session_id] = (counts[b.session_id] || 0) + 1);
  }
  const att = (href, n, label, sub, tone) => '<a class="nx-att' + (n ? '' : ' zero') + '" href="' + href + '"><span class="nx-big n ' + (n ? tone : '') + '">' + (n ? n : ico('check')) + '</span><span class="t"><b>' + label + '</b><small>' + (n ? sub : 'All clear') + '</small></span>' + ico('next') + '</a>';
  const first = (ME.name || '').split(' ')[0] || 'Overview';
  let tipsGone = false; try { tipsGone = localStorage.getItem('nex_tips_v1') === '1'; } catch (e) {}
  const tips = tipsGone ? '' : '<div class="nx-card nx-tips"><div class="nx-card-h"><h3>Finding your way around</h3><button class="nx-btn quiet sm" id="tipsHide">Hide this</button></div><ul class="nx-tiplist"><li><b>Search from anywhere.</b> Type a name, email or phone number in the bar at the top.</li><li><b>Everything about a person is on their page.</b> Enrolments, payments, bookings, placement and follow-ups, with a history of every change.</li><li><b>Book First Aid seats from First Aid.</b> Pick the day, press a free seat, and the flags show what is still outstanding.</li><li><b>Leads become students at $200.</b> New people start under Leads and move to Students once their payments reach $200.</li></ul></div>';
  afterRender(() => bindPlacementMail(pmRows));
  afterRender(() => { const h = $('#tipsHide'); if (h) h.onclick = () => { try { localStorage.setItem('nex_tips_v1', '1'); } catch (e) {} const c = h.closest('.nx-tips'); if (c) c.remove(); }; });
  return pageHead('home', nStu.toLocaleString('en-AU') + (nStu === 1 ? ' student' : ' students') + ' and ' + nLead.toLocaleString('en-AU') + (nLead === 1 ? ' lead' : ' leads'), 'Welcome back, ' + first, '<a class="nx-btn primary" href="#/leads?new=1">' + ico('plus') + 'New lead</a>') +
    tips + placementMailCard(pmRows) + '<div class="nx-two"><div class="nx-stack"><div class="nx-card"><div class="nx-card-h"><h3>Needs attention</h3></div><div class="nx-attlist">' +
    att('#/tasks', nDue, 'My tasks due', 'today or overdue', 'bad') +
    att('#/leads?fu=due', nFu, 'Lead follow-ups due', '1st, 2nd or 3rd, today or overdue', 'bad') +
    att('#/payments?view=unmatched', nUnm, 'Unmatched payments', 'no student linked', 'warn') +
    att('#/payments', nQueue, 'Payments to process', 'in the processing queue', 'accent') +
    (canVerify() ? att('#/payments?view=verify', nVer, 'Bank payments to verify', 'waiting for Accounts', 'warn') : '') +
    (ME.admin ? att('#/payments?view=cash', nCash, 'Cash receipts to check', 'handover waiting for an admin', 'warn') : '') +
    att('#/students', nOpenEnr, 'Open enrolments', 'not yet issued or closed', 'accent') + '</div></div></div>' +
    '<div class="nx-stack"><div class="nx-card"><div class="nx-card-h"><h3>Upcoming classes</h3><a href="#/firstaid">All classes</a></div>' +
    (sessions.length ? '<ul class="nx-list">' + sessions.map(s => { const d = fmtDay(s.class_date); const n = counts[s.id] || 0; return '<li><a href="#/firstaid/' + s.id + '"><b>' + d.wd + ' ' + d.dm + '</b><small>' + (s.kind === 'renewal' ? 'Renewal / signature' : 'First Aid & CPR') + (s.trainer ? ' · ' + esc(s.trainer) : '') + '</small></a><span class="nx-pill ' + (n >= s.seats ? 'bad' : n >= s.seats - 5 ? 'warn' : 'accent') + '">' + n + ' / ' + s.seats + '</span></li>'; }).join('') + '</ul>' : empty('No classes scheduled', 'Add the next class day in First Aid.')) + '</div></div>' +
    '</div>';
});

const AUD_NAMES = { nex_students: 'student', nex_student_details: 'student details', nex_enrolments: 'enrolment', nex_payments: 'payment', nex_payment_queue: 'payment queue', nex_refunds: 'refund', nex_class_sessions: 'class', nex_placement_profile: 'placement profile', nex_class_bookings: 'booking', nex_placement_requests: 'placement request', nex_placement_doc_mail: 'placement documents email', nex_placements: 'placement', nex_facilities: 'facility', nex_blacklist: 'blacklist entry' };
const SKIP_KEYS = new Set(['updated_at', 'created_at', 'created_by', 'id', 'updated_by']);
function diffHtml(a) {
  if (a.action !== 'UPDATE' || !a.old_row || !a.new_row) return '';
  const ch = Object.keys(a.new_row).filter(k => !SKIP_KEYS.has(k) && JSON.stringify(a.new_row[k]) !== JSON.stringify(a.old_row[k]));
  return ch.slice(0, 6).map(k => '<div class="nx-diff">' + esc(k.replace(/_/g, ' ')) + ': <s>' + esc(a.old_row[k] == null ? 'empty' : a.old_row[k]) + '</s> → <ins>' + esc(a.new_row[k] == null ? 'empty' : a.new_row[k]) + '</ins></div>').join('');
}
function feedItem(a) {
  const what = AUD_NAMES[a.table_name] || a.table_name;
  const verb = a.action === 'INSERT' ? 'Added' : a.action === 'DELETE' ? 'Deleted' : 'Updated';
  return '<li><span class="dot ' + (a.action === 'DELETE' ? 'warn' : a.action === 'INSERT' ? '' : 'info') + '">' + ico(a.action === 'INSERT' ? 'plus' : a.action === 'DELETE' ? 'x' : 'edit') + '</span><div><b>' + esc(a.changed_by || 'Someone') + '</b> ' + verb.toLowerCase() + ' a ' + esc(what) + diffHtml(a) + '<time>' + fmtDT(a.changed_at) + '</time></div></li>';
}

/* ---------- Leads, Students and Search (one list, three pages) ----------
   Leads: paid under $200 in total. Students: paid $200 or more. Search: everyone, labelled. */
/* The lead follow-up cycle: a 1st, 2nd and 3rd follow-up, 2, 4 and 6 days after first contact (nex_start_lead_cycle).
   nex_lead_followup holds one row per lead: the step that is open now, when it is due, and how many steps are still open.
   It is kept up to date by a trigger on nex_followups, so the Leads list can filter and sort on it. */
const FU_NTH = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10 > 3 ? 0 : n % 10]);   /* 1st, 2nd, 3rd, 4th ... after the 3rd the staff pick each next date */
const FU_EMBED = 'nex_lead_followup(step,due_at,due_day,assigned_to,open_count,total_count)';
const FU_SORT = {
  newest: 'created_at.desc',
  due: 'nex_lead_followup(due_day).asc.nullslast,created_at.desc',
  step: 'nex_lead_followup(step).desc.nullslast,nex_lead_followup(due_day).asc.nullslast,created_at.desc',
  name: 'first_name.asc,last_name.asc'
};
/* the status tag for one lead: { key, label, tone, sub } */
function fuInfo(raw, today) {
  const fu = Array.isArray(raw) ? raw[0] : raw;
  if (!fu || !fu.total_count) return { key: 'none', label: 'No follow-ups set', tone: '', sub: '' };
  if (!fu.open_count || !fu.step) return { key: 'complete', label: 'Follow-ups finished', tone: 'ok', sub: fu.total_count + ' done · booked, on hold or not interested' };
  const nth = FU_NTH(fu.step), who = fu.assigned_to ? ' · ' + fu.assigned_to : '';
  if (fu.due_day < today) { const n = Math.round((new Date(today + 'T12:00:00') - new Date(fu.due_day + 'T12:00:00')) / 864e5); return { key: 'due' + fu.step, label: nth + ' Follow Up Due', tone: 'bad', sub: n + (n === 1 ? ' day' : ' days') + ' overdue' + who }; }
  if (fu.due_day === today) return { key: 'due' + fu.step, label: nth + ' Follow Up Due', tone: 'warn', sub: 'Due today' + who };
  return { key: 'upcoming', label: nth + ' follow-up', tone: 'info', sub: 'Due ' + fmtDate(fu.due_day) + who };
}
function fuCellHtml(raw, today) {
  const i = fuInfo(raw, today);
  return '<span class="nx-pill ' + i.tone + '">' + esc(i.label) + '</span>' + (i.sub ? '<div class="nx-muted" style="font-size:12px;margin-top:2px">' + esc(i.sub) + '</div>' : '');
}
/* the filter text for one follow-up state, to add to a nex_students query that embeds nex_lead_followup!inner */
function fuFilter(which, today) {
  const E = '&nex_lead_followup.', due = E + 'open_count=gt.0' + E + 'due_day=lte.' + today;
  if (which === 'due') return due;
  if (which === '1' || which === '2') return due + E + 'step=eq.' + which;
  if (which === '3') return due + E + 'step=gte.3';
  if (which === 'upcoming') return E + 'open_count=gt.0' + E + 'due_day=gt.' + today;
  if (which === 'complete') return E + 'open_count=eq.0';
  return '';
}
/* how many leads (under $200, not archived) are in one follow-up state: 'due', '1', '2', '3' */
async function leadFuCount(which) {
  const r = await api('nex_students?select=id,nex_student_paid!inner(paid_total),nex_lead_followup!inner(step)&deleted_at=is.null&nex_student_paid.paid_total=lt.' + STUDENT_MIN + fuFilter(which, sydToday()), { method: 'HEAD', headers: { Prefer: 'count=exact', Range: '0-0', 'Range-Unit': 'items' } });
  const n = parseInt((r.headers.get('Content-Range') || '').split('/')[1], 10);
  return isNaN(n) ? 0 : n;
}
/* the follow-up controls on the Leads toolbar */
function fuControlsHtml() {
  const st = [['due', 'Any follow-up due now'], ['1', '1st Follow Up Due'], ['2', '2nd Follow Up Due'], ['3', '3rd or later Follow Up Due'], ['upcoming', 'Follow-up coming up, not due yet'], ['complete', 'Follow-ups finished'], ['none', 'No follow-ups set']].map(([id, label]) => ({ id, label }));
  const who = [{ id: 'me', label: 'Assigned to me' }].concat((REF.staff || []).filter(n => n !== ME.name).map(n => ({ id: 'n:' + n, label: n })));
  const sorts = [['newest', 'Sort: newest first'], ['due', 'Sort: follow-up due soonest'], ['step', 'Sort: latest follow-up first'], ['name', 'Sort: name A to Z']].map(([id, label]) => ({ id, label }));
  return '<select class="nx-sel sm" id="slFu" aria-label="Follow-up status">' + selectOpts(st, SL.fu, 'All follow-up statuses') + '</select>' +
    '<select class="nx-sel sm" id="slWho" aria-label="Follow-up assigned to">' + selectOpts(who, SL.who, 'Assigned to anyone') + '</select>' +
    '<select class="nx-sel sm" id="slSort" aria-label="Sort leads">' + selectOpts(sorts, SL.sort) + '</select>';
}
const SL = { q: '', stage: '', qual: '', unf: '', fu: '', who: '', sort: 'newest', kind: 'student', view: 'all', page: 0, size: 50 };
route(/^\/(students|leads|search)(?:\?(.*))?$/, async m => {
  const mode = m[1], qs = new URLSearchParams(m[2] || '');
  const kind = mode === 'leads' ? 'lead' : mode === 'students' ? 'student' : 'all';
  if (SL.kind !== kind) { SL.kind = kind; SL.page = 0; SL.view = 'all'; SL.q = SL.stage = SL.qual = SL.unf = SL.fu = SL.who = ''; SL.sort = 'newest'; }
  if (qs.get('view') === 'follow' && kind === 'lead') SL.view = 'follow';
  if (qs.get('fu') && kind === 'lead') { SL.fu = qs.get('fu'); SL.view = 'all'; SL.page = 0; if (SL.sort === 'newest') SL.sort = 'due'; }
  if (qs.get('unf')) { SL.unf = qs.get('unf'); SL.page = 0; }
  if (qs.has('q')) { SL.q = qs.get('q'); SL.page = 0; }
  const openNew = qs.get('new') === '1';
  const noun = kind === 'lead' ? 'leads' : kind === 'student' ? 'students' : 'people';
  afterRender(() => {
    const body = $('#slBody');
    const syncView = () => {
      $$('#slSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === SL.view)));
      $$('#slQ,#slStage,#slQual,#slUnf,#slFu,#slWho,#slSort,#slChips,#slClear').forEach(x => { x.hidden = SL.view === 'follow'; });
    };
    /* the follow-up status tags with a count each; pressing one filters the list to it */
    const drawChips = (n) => {
      const el = $('#slChips'); if (!el) return;
      const items = [['due', 'Due now'], ['1', '1st Follow Up Due'], ['2', '2nd Follow Up Due'], ['3', '3rd Follow Up Due']];
      el.innerHTML = '<span class="nx-muted" style="font-size:12px">Follow-ups due</span>' + items.map(([k, l]) => '<button type="button" class="nx-chip" data-fu="' + k + '" aria-pressed="' + (SL.fu === k) + '">' + esc(l) + ' <b>' + (n[k] != null ? n[k] : '–') + '</b></button>').join('');
      $$('[data-fu]', el).forEach(b => b.onclick = () => { SL.fu = SL.fu === b.dataset.fu ? '' : b.dataset.fu; SL.page = 0; if (SL.fu && SL.sort === 'newest') SL.sort = 'due'; const f = $('#slFu'), so = $('#slSort'); if (f) f.value = SL.fu; if (so) so.value = SL.sort; $$('[data-fu]', el).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.fu === SL.fu))); load(); });
    };
    const refreshChips = async () => {
      if (kind !== 'lead') return;
      const n = {}; await Promise.all(['due', '1', '2', '3'].map(async k => { try { n[k] = await leadFuCount(k); } catch (e) {} }));
      drawChips(n);
    };
    const refreshN = async () => { const n = await leadsFollowupCount(); const c = $('#slFuN'); if (c && n != null) { c.textContent = n; c.hidden = !n; } };
    const load = async () => {
      holdBody(body);
      try {
        if (kind === 'lead' && SL.view === 'follow') { syncView(); await leadsFollowupLoad(body, $('#slFoot'), () => { load(); }); refreshN(); return; }
        if (kind === 'lead') syncView();
        const q = safeQ(SL.q); const digits = cleanPhone(q); const today = sydToday();
        const fuInner = kind === 'lead' && (['due', '1', '2', '3', 'upcoming', 'complete'].includes(SL.fu) || !!SL.who);
        let query = 'select=id,student_no,first_name,last_name,email,phone,agent_id,created_at,needs_details,flagged_to,nex_student_paid!inner(paid_total),nex_enrolments' + (SL.stage || SL.qual ? '!inner' : '') + '(id,stage,qualification_id,fee,year,enrolled_on)' + (kind === 'lead' ? ',' + (fuInner ? FU_EMBED.replace('nex_lead_followup(', 'nex_lead_followup!inner(') : FU_EMBED) : '') + '&deleted_at=is.null&order=' + (kind === 'lead' ? (FU_SORT[SL.sort] || FU_SORT.newest) : 'created_at.desc');
        if (kind !== 'all') query += '&nex_student_paid.paid_total=' + (kind === 'lead' ? 'lt.' : 'gte.') + STUDENT_MIN;
        if (kind === 'lead' && SL.unf) query += '&needs_details=eq.true' + (SL.unf === 'mine' ? '&flagged_to=eq.' + encodeURIComponent(ME.name) : '');
        if (kind === 'lead') {
          query += fuFilter(SL.fu, today);
          if (SL.fu === 'none') query += '&nex_lead_followup=is.null';
          if (SL.who) query += '&nex_lead_followup.assigned_to=eq.' + encodeURIComponent(SL.who === 'me' ? ME.name : SL.who.slice(2));
        }
        if (SL.stage) query += '&nex_enrolments.stage=eq.' + encodeURIComponent(SL.stage);
        if (SL.qual) query += '&nex_enrolments.qualification_id=eq.' + SL.qual;
        if (q) { const parts = ['first_name.ilike.*' + q + '*', 'last_name.ilike.*' + q + '*', 'email.ilike.*' + q + '*']; if (digits.length >= 4) parts.push('phone.ilike.*' + digits + '*'); query += '&or=(' + parts.join(',') + ')'; }
        const { rows, total } = await selPage('nex_students', query, SL.page * SL.size, SL.page * SL.size + SL.size - 1);
        let pays = [];
        if (rows.length) pays = await sel('nex_payments', 'select=student_id,amount,verify_status&student_id=in.' + inList(rows.map(r => r.id)));
        const paid = {}; pays.forEach(p => { if (payConfirmed(p)) paid[p.student_id] = (paid[p.student_id] || 0) + Number(p.amount); });
        const filtered = SL.q || SL.stage || SL.qual || SL.fu || SL.who;
        body.innerHTML = rows.length ? '<div class="nx-tablewrap"><table class="nx-table"><thead><tr><th>' + (kind === 'lead' ? 'Lead' : kind === 'student' ? 'Student' : 'Name') + '</th><th class="nx-c-phone">Phone</th><th class="nx-c-qual">Qualification</th><th class="nx-c-stage">Stage</th><th class="nx-c-fee">Fee and paid</th>' + (kind === 'lead' ? '<th class="nx-c-fu">Follow-up</th>' : '') + '<th class="nx-c-date">Enrolled</th><th class="nx-c-agent">Agent</th>' + (kind === 'lead' ? '<th></th>' : '') + '</tr></thead><tbody>' +
          rows.map(s => {
            const en = (s.nex_enrolments || []).slice().sort((a, b) => String(b.enrolled_on || '').localeCompare(String(a.enrolled_on || '')))[0] || {};
            const fee = (s.nex_enrolments || []).reduce((t, e) => t + Number(e.fee || 0), 0), pd = paid[s.id] || 0;
            const pct = fee ? Math.min(100, Math.round(pd / fee * 100)) : 0;
            const idx = PATH.indexOf(en.stage), isStu = kindOf(s.nex_student_paid) === 'student';
            return '<tr class="nx-tr" data-id="' + s.id + '"><td><div class="nx-who"><span class="nx-avatar">' + esc(initials(fullName(s))) + '</span><div><b>' + esc(fullName(s)) + (s.needs_details ? ' <span class="nx-pill warn" title="Started from a call; details still needed. Flagged to ' + esc(s.flagged_to || 'the logger') + '">Unfinished' + (s.flagged_to ? ' · ' + esc(s.flagged_to) : '') + '</span>' : '') + (kind === 'all' ? ' <span class="nx-pill ' + (isStu ? 'accent' : 'info') + '">' + (isStu ? 'Student' : 'Lead') + '</span>' : '') + '</b><span>' + esc(s.email || 'No email') + (s.nex_enrolments && s.nex_enrolments.length > 1 ? ' · ' + s.nex_enrolments.length + ' enrolments' : '') + '</span></div></div></td>' +
              '<td class="nx-num nx-c-phone">' + esc(fmtPhone(s.phone)) + '</td><td class="nx-c-qual"><span class="nx-clamp">' + esc(qualShort(en.qualification_id) || '–') + '</span></td>' +
              '<td class="nx-c-stage">' + (en.stage ? '<div class="nx-stagecell">' + pill('enrolment', en.stage) + '<div class="nx-mini">' + PATH.map((p, i) => '<i class="' + (idx >= 0 && i <= idx ? 'on' : '') + '"></i>').join('') + '</div></div>' : '<span class="nx-muted">–</span>') + '</td>' +
              '<td class="nx-c-fee">' + (fee || pd ? '<div class="nx-meter"><div class="nx-meter-bar"><i class="' + (pd < fee ? 'warn' : '') + '" style="width:' + pct + '%"></i></div><small>' + money(pd) + ' of ' + money(fee) + '</small></div>' : '<span class="nx-muted">–</span>') + '</td>' +
              (kind === 'lead' ? '<td class="nx-c-fu">' + fuCellHtml(s.nex_lead_followup, today) + '</td>' : '') +
              '<td class="nx-c-date">' + esc(fmtDate(en.enrolled_on) || '–') + '</td><td class="nx-c-agent">' + esc(agentName(s.agent_id) || '–') + '</td>' + (kind === 'lead' ? '<td><button class="nx-btn sm" data-bk="' + s.id + '">Book class</button></td>' : '') + '</tr>';
          }).join('') + '</tbody></table></div>' :
          empty('No ' + noun + ' found', filtered ? 'Try a different search or clear the filters.' : kind === 'lead' ? 'Everyone in YatraLine has paid $200 or more.' : kind === 'student' ? 'Nobody has paid $200 yet. New people start as leads.' : 'Nobody is in YatraLine yet.', kind === 'lead' && !filtered ? '<a class="nx-btn primary" href="#/leads?new=1">' + ico('plus') + 'New lead</a>' : '');
        const from = total ? SL.page * SL.size + 1 : 0, to = SL.page * SL.size + rows.length;
        const more = total != null && to < total;
        $('#slFoot').innerHTML = '<span>' + (total != null ? (total ? from + '–' + to + ' of ' + total.toLocaleString('en-AU') + ' ' + noun : '') : rows.length + ' shown') + '</span>' + (SL.page || more ? '<span class="nx-btnrow"><button class="nx-btn sm" id="slPrev"' + (SL.page ? '' : ' disabled') + '>Previous</button><button class="nx-btn sm" id="slNext"' + (more ? '' : ' disabled') + '>Next</button></span>' : '');
        const pv = $('#slPrev'), nx = $('#slNext');
        if (pv) pv.onclick = () => { SL.page--; load(); }; if (nx) nx.onclick = () => { SL.page++; load(); };
        $$('.nx-tr', body).forEach(tr => tr.onclick = () => go('#/students/' + tr.dataset.id));
        $$('[data-bk]', body).forEach(b => b.onclick = e => { e.stopPropagation(); const p = rows.find(x => x.id === b.dataset.bk); const en = ((p && p.nex_enrolments) || []).slice().sort((a, c) => String(c.enrolled_on || '').localeCompare(String(a.enrolled_on || '')))[0]; if (p) bookClassModal(p, en ? en.id : null, () => { refreshN(); refreshChips(); load(); }); });
        if (kind === 'lead') refreshN();
        if (kind === 'lead') { $$('[data-fu]', $('#slChips')).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.fu === SL.fu))); }
      } catch (e) { body.innerHTML = empty('Could not load ' + noun, e.message); }
    };
    let t = 0;
    $('#slQ').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { SL.q = e.target.value; SL.page = 0; load(); }, 300); });
    $('#slStage').onchange = e => { SL.stage = e.target.value; SL.page = 0; load(); };
    $('#slQual').onchange = e => { SL.qual = e.target.value; SL.page = 0; load(); };
    const un = $('#slUnf'); if (un) un.onchange = e => { SL.unf = e.target.value; SL.page = 0; load(); };
    $$('#slSeg button').forEach(b => b.onclick = () => { SL.view = b.dataset.v; SL.page = 0; load(); });
    [['#slFu', 'fu'], ['#slWho', 'who'], ['#slSort', 'sort']].forEach(([id, key]) => { const el = $(id); if (el) el.onchange = e => { SL[key] = e.target.value; SL.page = 0; if (key === 'fu' && SL.fu && SL.sort === 'newest') { SL.sort = 'due'; $('#slSort').value = 'due'; } load(); }; });
    $('#slClear').onclick = () => { SL.q = SL.stage = SL.qual = SL.unf = SL.fu = SL.who = ''; SL.sort = 'newest'; SL.page = 0; $('#slQ').value = ''; $('#slStage').value = ''; $('#slQual').value = ''; ['#slUnf', '#slFu', '#slWho'].forEach(id => { const el = $(id); if (el) el.value = ''; }); const so = $('#slSort'); if (so) so.value = 'newest'; load(); };
    const nb = $('#slNew'); if (nb) nb.onclick = () => newStudent();
    viewWait(load());
    refreshChips();
    if (openNew) { history.replaceState(null, '', '#/leads'); newStudent(); }
  });
  const head = kind === 'lead' ? pageHead('user', 'Paid less than $200 so far', 'Leads', '<button class="nx-btn primary" id="slNew">' + ico('plus') + 'New lead</button>')
    : kind === 'student' ? pageHead('user', 'Paid $200 or more', 'Students', '')
    : pageHead('search', 'Leads and students', 'Search', '');
  return head +
    '<div class="nx-card"><div class="nx-toolbar" style="border-top:0">' + (kind === 'lead' ? '<div class="nx-seg" id="slSeg" role="group" aria-label="Show"><button type="button" data-v="all" aria-pressed="' + (SL.view === 'all') + '">All leads</button><button type="button" data-v="follow" aria-pressed="' + (SL.view === 'follow') + '">Missed a class <span class="nx-count" id="slFuN" hidden></span></button></div>' : '') + '<input class="nx-in sm" style="min-width:280px" id="slQ" placeholder="Search ' + (kind === 'all' ? 'name, email or phone' : noun + ' by name, email or phone') + '" value="' + esc(SL.q) + '"><select class="nx-sel sm" id="slStage">' + selectOpts(stageFilterOpts(kind), SL.stage, 'Any stage') + '</select><select class="nx-sel sm" id="slQual">' + selectOpts(REF.quals.filter(q => q.active), SL.qual, 'Any qualification') + '</select>' + (kind === 'lead' ? '<select class="nx-sel sm" id="slUnf" aria-label="Unfinished leads"><option value=""' + (SL.unf ? '' : ' selected') + '>All leads</option><option value="mine"' + (SL.unf === 'mine' ? ' selected' : '') + '>Unfinished, flagged to me</option><option value="all"' + (SL.unf === 'all' ? ' selected' : '') + '>Unfinished, anyone</option></select>' : '') + (kind === 'lead' ? fuControlsHtml() : '') + '<button class="nx-btn quiet sm" id="slClear">Clear</button></div>' + (kind === 'lead' ? '<div class="nx-toolbar" id="slChips" role="group" aria-label="Follow-ups due" style="padding-top:0;border-top:0"></div>' : '') +
    '<div id="slBody"></div><div class="nx-foot" id="slFoot"><span></span></div></div>';
});

function studentFields(s) {
  s = s || {};
  return [
    { k: 'first_name', label: 'First name', value: s.first_name, required: true }, { k: 'last_name', label: 'Last name', value: s.last_name },
    { k: 'email', label: 'Email', type: 'email', value: s.email }, { k: 'phone', label: 'Phone', type: 'tel', value: s.phone },
    { k: 'phone2', label: 'Second phone', type: 'tel', value: s.phone2 }, { k: 'agent_id', label: 'Agent', type: 'select', options: REF.agents.filter(a => a.active), value: s.agent_id, blank: 'Self / no agent' },
    { k: 'outside_sydney', type: 'check', label: 'Outside Sydney', value: s.outside_sydney, full: true, help: 'Counted in the Outside Sydney row of the Conversion report.' }
  ];
}
function tidyStudent(v) {
  if (v.email) v.email = v.email.toLowerCase();
  if (v.phone) v.phone = cleanPhone(v.phone) || v.phone;
  if (v.phone2) v.phone2 = cleanPhone(v.phone2) || v.phone2;
  return v;
}
async function findDupes(v) {
  const parts = [];
  if (v.email) parts.push('email.eq.' + v.email);
  if (v.phone && v.phone.length >= 8) parts.push('phone.eq.' + v.phone);
  if (!parts.length) return [];
  return sel('nex_students', 'select=id,first_name,last_name,email,phone&deleted_at=is.null&or=(' + parts.join(',') + ')&limit=5');
}
function newStudent() {
  const base = studentFields(), by = k => base.find(x => x.k === k);
  const f = [by('phone'), by('email'), by('first_name'), by('last_name'), by('phone2'), by('agent_id')].concat([
    { k: 'qualification_id', label: 'Qualification', type: 'select', options: REF.quals.filter(q => q.active), blank: 'Add later' },
    { k: 'fee', label: 'Agreed fee ($)', type: 'number' },
    { k: 'stage', label: 'Stage', type: 'select', options: stageOpts(false, 'checklist_sent'), value: 'checklist_sent', blank: 'Not set' },
    { k: 'enrolled_on', label: 'Enrolled on', type: 'date', value: sydToday() },
    { k: 'first_contact_on', label: 'First contact', type: 'date', value: sydToday(), help: 'Follow-ups are set for 2, 4 and 6 days after this date.' }
  ]);
  let warned = false, existing = null, lk = null;
  const save = async (v, m) => {
    existing = lk ? lk.get() : null;
    const { qualification_id, fee, stage, enrolled_on, ...stu } = v;
    if (existing) {
      /* they are already in YatraLine: add the new enrolment to them (if one was filled in) and open their record */
      if (qualification_id || fee != null) await ins('nex_enrolments', { student_id: existing.id, qualification_id, fee, stage, enrolled_on, year: new Date().getFullYear(), created_by: ME.name }, true);
      toast(qualification_id || fee != null ? 'Added to ' + fullName(existing) : 'Opened ' + fullName(existing)); go('#/students/' + existing.id); return;
    }
    if (!stu.first_name) { const e = $('#f_first_name', m.el); if (e) { e.setAttribute('aria-invalid', 'true'); try { e.focus(); } catch (x) {} } throw new Error('First name is required.'); }
    tidyStudent(stu);
    if (!warned) {
      const d = await findDupes(stu);
      if (d.length) {
        warned = true;
        let b = $('.nx-warnbox', m.el); if (!b) { b = document.createElement('div'); b.className = 'nx-warnbox'; b.style.marginBottom = '12px'; $('.modal-b', m.el).prepend(b); }
        b.innerHTML = 'This looks like someone already in YatraLine: ' + d.map(x => '<a href="#/students/' + x.id + '">' + esc(fullName(x)) + '</a>').join(', ') + '. Press Add lead again if this is a different person.';
        return false;
      }
    }
    const s = await ins('nex_students', Object.assign(stu, { created_by: ME.name }));
    if (qualification_id || fee != null || stage) await ins('nex_enrolments', { student_id: s.id, qualification_id, fee, stage, enrolled_on, year: new Date().getFullYear(), created_by: ME.name }, true);
    let cycleErr = false;
    try { await api('rpc/nex_start_lead_cycle', { method: 'POST', body: { p_student: s.id, p_first: stu.first_contact_on || null } }); } catch (e) { cycleErr = true; }
    toast(cycleErr ? 'Lead added, but the follow-ups could not be set. Open the lead and press Start follow-ups.' : 'Lead added with 3 follow-ups', cycleErr); go('#/students/' + s.id);
  };
  /* first name is checked in save() so that picking an existing person does not need it */
  f.find(x => x.k === 'first_name').required = false; f.find(x => x.k === 'first_name').label = 'First name *';
  const m = formModal('New lead', f, save, 'Add lead', idBoxHtml('Start with a phone number or email. If they are already in YatraLine, their details fill in.'));
  standardFee(m, 'f_qualification_id', 'f_fee');
  lk = identityLookup(m, { ids: { phone: 'f_phone', email: 'f_email', first: 'f_first_name', last: 'f_last_name' }, onChange: s => { const b = $('.modal-f .nx-btn.primary', m.el); if (b) b.textContent = s ? 'Add to ' + fullName(s) : 'Add lead'; } });
  return m;
}

/* ---------- Student record ---------- */
const SR = { tab: 'details' };
route(/^\/students\/([0-9a-f-]{36})$/, async m => {
  const id = m[1];
  const [stu, det, enr, pays, books, followups, tasks, calls, logs, ppRows, facs] = await Promise.all([
    sel('nex_students', 'select=*&id=eq.' + id), api('rpc/nex_get_details', { method: 'POST', body: { p_student: id } }).then(r => r.json()),
    sel('nex_enrolments', 'select=*&student_id=eq.' + id + '&deleted_at=is.null&order=enrolled_on.desc.nullslast'),
    sel('nex_payments', 'select=*&student_id=eq.' + id + '&order=paid_on.desc.nullslast'),
    sel('nex_class_bookings', 'select=*,nex_class_sessions(class_date,kind)&student_id=eq.' + id),
    sel('nex_followups', 'select=*&student_id=eq.' + id + '&order=created_at.desc'),
    sel('nex_tasks', 'select=*&student_id=eq.' + id + '&status=neq.done&order=due_on.asc.nullslast').catch(() => []),
    sel('call_log', 'select=id,caller_name,phone_e164,reason,note,direction,logged_by,created_at,resolved_at,for_team&student_id=eq.' + id + '&deleted_at=is.null&order=created_at.desc&limit=40').catch(() => []),
    sel('nex_logbook_receipts', 'select=id,received_on,receiver,comments,created_at&student_id=eq.' + id + '&order=received_on.desc&limit=20').catch(() => []),
    sel('nex_placement_profile', 'select=*&student_id=eq.' + id).catch(() => []),
    facilityOptions().catch(() => [])
  ]);
  const s = stu[0]; if (!s) return empty('Student not found', 'They may have been archived.');
  /* the sensitive details come through a function that logs who looked (admins see this) and stops bulk opening */
  const limited = !!(det && det.limited), d = (det && det.details) || {};
  const eids = enr.map(e => e.id);
  const [queue, refunds, reqs, plcs, hist, aud, docs] = await Promise.all([
    eids.length ? sel('nex_payment_queue', 'select=*&enrolment_id=in.' + inList(eids)) : [],
    eids.length ? sel('nex_refunds', 'select=*&enrolment_id=in.' + inList(eids) + '&order=refunded_on.desc') : [],
    eids.length ? sel('nex_placement_requests', 'select=*,nex_facilities(name)&enrolment_id=in.' + inList(eids) + '&order=created_at.desc') : [],
    eids.length ? sel('nex_placements', 'select=*,nex_facilities(name)&enrolment_id=in.' + inList(eids) + '&order=created_at.desc') : [],
    eids.length ? sel('nex_status_history', 'select=*&entity_id=in.' + inList(eids) + '&order=changed_at.desc&limit=40') : [],
    sel('nex_audit', 'select=*&row_id=in.' + inList([id].concat(eids, pays.map(p => p.id))) + '&order=changed_at.desc&limit=40'),
    eids.length ? sel('nex_enrolment_docs', 'select=*&enrolment_id=in.' + inList(eids)).catch(() => []) : []
  ]);
  const main = enr[0] || {};
  const idx = PATH.indexOf(main.stage);
  const totalFee = enr.reduce((t, e) => t + Number(e.fee || 0), 0);
  const grossPaid = sumPaid(pays);
  const isStudent = grossPaid >= STUDENT_MIN;
  const totalPaid = grossPaid - refunds.reduce((t, r) => t + Number(r.amount), 0);
  const ctx = { pp: ppRows[0] || null, facs, s, d, limited, enr, pays, books, followups: followups.filter(f => f.kind !== 'moved_to_task'), tasks, queue, refunds, reqs, plcs, hist, aud, docs, calls, logs, isStudent };

  afterRender(() => { bindStudent(ctx); setNav(isStudent ? '!/students' : '!/leads'); });
  const fact = (k, v) => '<div><dt>' + k + '</dt><dd>' + (v || '<span class="nx-muted">–</span>') + '</dd></div>';
  return '<div class="nx-crumbs"><a href="' + (isStudent ? '#/students">Students' : '#/leads">Leads') + '</a> / <span>' + esc(fullName(s)) + '</span></div>' +
    (s.needs_details ? '<div class="nx-card nx-unfbar"><div class="nx-note">' + ico('bell') + '<span><b>Unfinished lead.</b> Started from a call' + (s.flagged_to ? ' logged by <b>' + esc(s.flagged_to) + '</b>' : '') + '. Add their email, course and any other details, then mark it complete.</span> <button class="nx-btn sm primary" data-a="doneDetails">' + ico('check') + 'Mark complete</button></div></div>' : '') +
    '<div class="nx-card"><div class="nx-hl"><span class="nx-avatar">' + esc(initials(fullName(s))) + '</span><div><div class="nx-eyebrow">' + (isStudent ? 'Student ' : 'Lead ') + esc(String(s.student_no || '')) + '</div><h1 class="nx-title">' + esc(fullName(s)) + ' <span class="nx-pill ' + (isStudent ? 'accent' : 'info') + '">' + (isStudent ? 'Student' : 'Lead') + '</span></h1></div>' +
    '<dl class="nx-facts">' + fact('Email', esc(s.email || '')) + fact('Phone', esc(fmtPhone(s.phone))) + fact('Agent', esc(agentName(s.agent_id))) + fact('Fee and paid', totalFee || totalPaid ? money(totalPaid) + ' of ' + money(totalFee) : '') + fact('Added', esc(fmtDate(s.created_at))) + '</dl>' +
    '<div class="nx-btnrow"><button class="nx-btn" data-a="editStu">' + ico('edit') + 'Edit</button><button class="nx-btn" data-a="addEnr">' + ico('plus') + 'Enrolment</button>' + (isStudent ? '' : '<button class="nx-btn primary" data-a="bookFA">' + ico('aid') + 'Book class</button>') + '' + (ME.admin ? '<button class="nx-btn quiet" data-a="archive">' + ico('archive') + 'Archive</button>' : '') + '</div></div>' +
    (main.id ? '<div style="padding:0 16px 16px"><ol class="nx-path">' + PATH.map((p, i) => '<li class="' + (i < idx ? 'done' : i === idx ? 'now' : '') + '">' + (i < idx ? ico('check') : '') + esc(statusLabel('enrolment', p)) + '</li>').join('') + '</ol>' + (idx < 0 && main.stage ? '<div style="margin-top:8px">Current stage: ' + pill('enrolment', main.stage) + '</div>' : '') + '</div>' : '') + '</div>' +
    '<div class="nx-cols"><div class="nx-colmain"><div class="nx-card"><div class="nx-tabs" role="tablist">' +
    [['details', 'Details'], ['money', 'Enrolments and payments'], ['docs', 'Documents' + docsBadge(ctx)], ['placement', 'Placement' + ppBadge(ctx)], ['activity', 'Activity']].map(([k, l]) => '<button class="nx-tab" role="tab" data-tab="' + k + '" aria-selected="' + (SR.tab === k) + '">' + l + '</button>').join('') + '</div><div id="srTab"></div></div></div>' +
    '<div class="nx-colside">' + sideCards(ctx) + '</div></div>';
});


function sideCards(c) {
  const bk = c.books.slice().sort((a, b) => String((b.nex_class_sessions || {}).class_date || '').localeCompare(String((a.nex_class_sessions || {}).class_date || '')));
  const open = c.followups.filter(f => !f.done_at);
  return '<div class="nx-card"><div class="nx-card-h"><h3>First Aid and CPR</h3><button class="nx-btn sm" data-a="bookFA">Book</button></div>' +
    (bk.length ? '<div class="nx-related">' + bk.slice(0, 4).map(b => { const ss_ = b.nex_class_sessions || {}; return '<div><span><a href="#/firstaid/' + b.session_id + '"><b>' + esc(fmtDate(ss_.class_date)) + '</b></a><small>' + (ss_.kind === 'renewal' ? 'Renewal' : 'Full class') + (b.seat_no && canFlag() ? ' · seat ' + b.seat_no : '') + (b.attendance_by && BK_WORD[b.status] ? ' · marked by ' + esc(b.attendance_by) : '') + '</small></span>' + (b.status ? pill('booking', b.status) : '') + '</div>'; }).join('') + '</div>' : empty('No class booked')) + '</div>' +
    '<div class="nx-card"><div class="nx-card-h"><h3>Placement</h3></div>' +
    (c.plcs.length || c.reqs.length ? '<div class="nx-related">' + c.plcs.slice(0, 3).map(p => '<div><span><b>' + esc((p.nex_facilities || {}).name || p.facility_text || 'Placement') + '</b><small>' + (p.start_date ? 'Starts ' + esc(fmtDate(p.start_date)) : 'No start date') + '</small></span>' + pill('placement_stage', p.status) + '</div>').join('') +
      c.reqs.slice(0, 3).map(r => '<div><span><b>' + esc((r.nex_facilities || {}).name || r.facility_text || 'Request') + '</b><small>' + (r.self_placement ? 'Self placement' : 'Request') + (r.emailed_on ? ' · emailed ' + esc(fmtDate(r.emailed_on)) : '') + '</small></span>' + pill('placement', r.status) + '</div>').join('') + '</div>' : empty('No placement yet')) + '</div>' +
    '<div class="nx-card"><div class="nx-card-h"><h3>Follow-ups</h3><span class="nx-btnrow">' + (!c.isStudent && !c.followups.some(f => f.kind === 'lead_cycle') ? '<button class="nx-btn sm" data-a="startCycle">Start follow-ups</button>' : '') + '</span></div>' +
    (open.length ? '<div class="nx-related">' + open.slice().sort((a, b) => String(a.due_at || '9').localeCompare(String(b.due_at || '9'))).map(f => { const late = f.due_at && new Date(f.due_at).toLocaleDateString('en-CA', { timeZone: TZ }) < sydToday(); return '<div><span><b>' + esc(f.note) + '</b><small' + (late ? ' class="nx-neg"' : '') + '>' + (f.due_at ? 'Due ' + esc(fmtDate(f.due_at)) + (late ? ' (overdue)' : '') : 'No date') + (f.assigned_to ? ' · ' + esc(f.assigned_to) : '') + '</small></span><span class="nx-btnrow">' + (f.kind === 'lead_cycle' && f.step ? '<button class="nx-btn sm" data-a="emailFu" data-step="' + f.step + '">' + ico('mail') + 'Send email</button>' : '') + '<button class="nx-btn sm" data-a="doneFu" data-id="' + f.id + '">Done</button></span></div>'; }).join('') + '</div>' : empty('Nothing to follow up')) + '</div>' +
    '<div class="nx-card"><div class="nx-card-h"><h3>Tasks</h3><button class="nx-btn sm" data-a="addTask">Add</button></div>' +
    (c.tasks.length ? '<div class="nx-related">' + c.tasks.map(t => { const late = t.due_on && t.due_on < sydToday(); return '<div><span><b>' + esc(t.title) + '</b><small' + (late ? ' class="nx-neg"' : '') + '>' + (t.due_on ? 'Due ' + esc(fmtDate(t.due_on)) + (late ? ' (overdue)' : '') : 'No date') + ' · ' + esc(tkLabel(TK_PRI, t.priority)) + (t.assigned_to ? ' · ' + esc(t.assigned_to) : '') + '</small></span><button class="nx-btn sm" data-a="doneTask" data-id="' + t.id + '">Done</button></div>'; }).join('') + '</div>' : empty('No open tasks')) + '</div>';
}


/* send a lead follow-up email (lists the documents not received yet) through the workspace mail script.
   The dialog opens at once at a fixed size and everything happens inside it: the preview loads in place, the mailbox's remaining sends
   load in the background, and "already sent" is a line in the dialog, not another dialog on top. */
/* Mark a follow-up done. After the 3rd follow-up a lead who has not booked a class, or been put on hold or not interested, stays in the cycle:
   the database asks for the date of the next one (NEXT_DATE_NEEDED) and this box collects it. */
async function doneFollowup(id) {
  const done = next => api('rpc/nex_done_followup', { method: 'POST', body: { p_id: id, p_next: next || null } });
  try { await done(); toast('Done'); return render(); }
  catch (err) {
    if (!/NEXT_DATE_NEEDED/.test(err.message || '')) throw err;
    return formModal('When is the next follow-up?', [{ k: 'next', label: 'Next follow-up date', type: 'date', required: true, full: true, help: 'This lead has not booked a class and is not on hold or not interested, so they stay on the follow-up list. They leave it when a class is booked or their enrolment is put on hold or not interested.' }],
      async v => { await done(v.next); toast('Done. Next follow-up on ' + fmtDate(v.next)); render(); }, 'Save and mark done');
  }
}
async function emailFollowup(s, step) {
  if (!s.email) { toast('Add an email address on the Details tab first.', true); return; }
  let force = false, sending = false;
  const m = openModal({ title: 'Email ' + FU_NTH(step) + ' follow-up', wide: true, noFocus: true,
    body: '<div class="nx-md"><div class="nx-muted" data-ef="top">Preparing the email…</div><div data-ef="note"></div><div><label class="nx-lbl" for="efSub">Subject</label><input class="nx-in" id="efSub" disabled></div><div style="flex:1;display:flex;flex-direction:column"><label class="nx-lbl" for="efBody">Message</label><textarea class="nx-ta" id="efBody" style="flex:1;min-height:250px" disabled></textarea><div class="nx-help">You can edit this before it goes. Replies come to you.</div></div><div class="nx-err" data-ef="err" role="alert" hidden></div></div>' });
  const q = k => $('[data-ef="' + k + '"]', m.el), foot = $('.modal-f', m.el);
  const cancel = document.createElement('button'); cancel.className = 'nx-btn'; cancel.textContent = 'Cancel'; cancel.onclick = () => m.close();
  const go = document.createElement('button'); go.className = 'nx-btn primary'; go.textContent = 'Send email'; go.disabled = true;
  foot.appendChild(cancel); foot.appendChild(go);
  let pv, left = null;
  try { pv = await fn('nex-send-followup', { student_id: s.id, step, preview: true }); }
  catch (e) { if (!m.gone) { q('top').textContent = e.code === 'no_email' ? 'There is no valid email address on file.' : e.message; q('top').classList.add('nx-neg'); } return; }
  if (m.gone) return;
  const miss = (pv.missing || []).reduce((n, g) => n + g.docs.length, 0);
  const topText = () => 'To ' + pv.to + ' · ' + (miss ? miss + ' document' + (miss === 1 ? '' : 's') + ' still missing' : 'no documents missing') + (pv.last_sent ? ' · sent before by ' + (pv.last_sent.sent_by || 'someone') + ' on ' + fmtDate(pv.last_sent.sent_at) : '') + (typeof left === 'number' ? ' · ' + left + ' more can be sent today' : '');
  q('top').textContent = topText();
  $('#efSub', m.el).value = pv.subject; $('#efBody', m.el).value = pv.body;
  $('#efSub', m.el).disabled = false; $('#efBody', m.el).disabled = false; go.disabled = false;
  fn('nex-send-followup', { quota: true }).then(r => { if (typeof r.remaining === 'number') { left = r.remaining; if (!m.gone) { q('top').textContent = topText(); if (left <= 0) { go.disabled = true; q('err').hidden = false; q('err').textContent = 'The enrolment mailbox has reached its daily sending limit. Try again tomorrow.'; } } } }).catch(() => {});
  go.onclick = async () => {
    if (sending) return;
    const subject = $('#efSub', m.el).value.trim(), body = $('#efBody', m.el).value.trim();
    q('err').hidden = true;
    if (!subject || !body) { q('err').hidden = false; q('err').textContent = 'The subject and message cannot be empty.'; return; }
    sending = true; go.disabled = true; cancel.disabled = true; go.classList.add('busy'); go.textContent = 'Sending…';
    try {
      const r = await fn('nex-send-followup', { student_id: s.id, step, subject, body, force });
      toast('Email sent to ' + pv.to + (r && typeof r.remaining === 'number' && r.remaining <= 20 ? '. ' + r.remaining + ' more can be sent today.' : ''));
      m.close(); render();
      if (step >= 3 && !(r && r.ticked)) {   /* the 3rd and later follow-ups are finished here, so the date of the next one is asked for */
        try { const o = await sel('nex_followups', 'select=id&student_id=eq.' + s.id + '&kind=eq.lead_cycle&step=eq.' + step + '&done_at=is.null&limit=1'); if (o[0]) await doneFollowup(o[0].id); } catch (e2) { toast(e2.message, true); }
      }
    } catch (e) {
      if (e.code === 'recent' && !force) { force = true; q('note').innerHTML = '<div class="nx-pill warn" style="white-space:normal;height:auto;padding:6px 10px">' + esc(e.message) + ' Press Send again to send it anyway.</div>'; go.textContent = 'Send again'; }
      else { q('err').hidden = false; q('err').textContent = e.message; go.textContent = force ? 'Send again' : 'Send email'; }
      sending = false; go.disabled = false; cancel.disabled = false; go.classList.remove('busy');
    }
  };
}
function bindStudent(c) {
  const view = $('#view');
  const tabBody = $('#srTab');
  const showTab = () => {
    $$('.nx-tab', view).forEach(t => { t.setAttribute('aria-selected', String(t.dataset.tab === SR.tab)); if (t.dataset.tab === 'docs') t.textContent = 'Documents' + docsBadge(c); if (t.dataset.tab === 'placement') t.textContent = 'Placement' + ppBadge(c); });
    tabBody.innerHTML = SR.tab === 'details' ? tabDetails(c) : SR.tab === 'money' ? tabMoney(c) : SR.tab === 'docs' ? tabDocs(c) : SR.tab === 'placement' ? tabPlacement(c) : tabActivity(c);
    if (SR.tab === 'placement') ppBindTab(c, tabBody, showTab);
  };
  showTab();
  view.onclick = async e => {
    const tb = e.target.closest('.nx-tab'); if (tb) { SR.tab = tb.dataset.tab; showTab(); return; }
    const sh = e.target.closest('.nx-sec-h'); if (sh) { const open = sh.getAttribute('aria-expanded') !== 'false'; sh.setAttribute('aria-expanded', String(!open)); sh.nextElementSibling.hidden = open; return; }
    const b = e.target.closest('[data-a]'); if (!b) return;
    try { await studentAction(b.dataset.a, b.dataset, c); } catch (err) { toast(err.message, true); }
  };
  view.onchange = async e => {
    const dc = e.target.closest('[data-doc]');
    if (dc) {
      dc.disabled = true;
      try {
        if (dc.checked) c.docs.push(await ins('nex_enrolment_docs', { enrolment_id: dc.dataset.enr, doc_type_id: dc.dataset.doc, created_by: ME.name }));
        else { await del('nex_enrolment_docs', 'enrolment_id=eq.' + dc.dataset.enr + '&doc_type_id=eq.' + dc.dataset.doc); c.docs = c.docs.filter(x => !(x.enrolment_id === dc.dataset.enr && x.doc_type_id === dc.dataset.doc)); }
      } catch (err) { toast(err.message, true); }
      showTab(); return;
    }
    const sel_ = e.target.closest('[data-stage]'); if (!sel_) return;
    try { await upd('nex_enrolments', 'id=eq.' + sel_.dataset.stage, { stage: sel_.value || null }); toast('Stage updated'); render(); } catch (err) { toast(err.message, true); }
  };
}

function field(k, v) { return '<div class="nx-field"><dt>' + k + '</dt><dd>' + (v || '<span class="nx-muted">–</span>') + '</dd></div>'; }
function section(title, inner, action) {
  return '<div class="nx-sec"><button class="nx-sec-h" aria-expanded="true">' + ico('chev') + esc(title) + (action ? '<span class="nx-edit" role="presentation"></span>' : '') + '</button><div>' + inner + '</div></div>';
}
function tabDetails(c) {
  const s = c.s, d = c.d;
  const sens = c.limited ? section('Personal and sensitive', '<div class="nx-note">' + ico('lock') + ' You have opened a lot of student records in a short time, so personal details are paused for now. Try again later, or ask an admin.</div>') : section('Personal and sensitive', '<div class="nx-note">' + ico('lock') + ' Visible to all YatraLine staff. Every look and every change is logged.</div><dl class="nx-fields">' + field('Date of birth', esc(fmtDate(d.dob))) + field('USI', esc(d.usi)) + field('Address', esc([d.address, d.suburb, d.state, d.postcode].filter(Boolean).join(', '))) +
      field('Emergency contact', esc([d.emergency_name, d.emergency_relation && '(' + d.emergency_relation + ')', fmtPhone(d.emergency_phone)].filter(Boolean).join(' '))) + field('Disability', esc(d.disability)) + field('Indigenous status', esc(d.indigenous_status)) + '</dl><div style="padding:0 16px 16px"><button class="nx-btn sm" data-a="editDet">' + ico('edit') + 'Edit personal details</button></div>');
  return section('Contact', '<dl class="nx-fields">' + field('First name', esc(s.first_name)) + field('Last name', esc(s.last_name)) + field('Email', esc(s.email)) + field('Phone', esc(fmtPhone(s.phone))) + field('Second phone', esc(fmtPhone(s.phone2))) + field('Agent', esc(agentName(s.agent_id))) + field('Outside Sydney', s.outside_sydney ? 'Yes' : 'No') + '</dl><div style="padding:0 16px 16px"><button class="nx-btn sm" data-a="editStu">' + ico('edit') + 'Edit contact</button></div>') +
    sens +
    (c.s.source_note ? section('Source note', '<div style="padding:16px">' + esc(c.s.source_note) + '</div>') : '');
}
/* the document list for an enrolment comes from its course (nex_qualifications.doc_group) */
function docTypesFor(e) {
  const q = REF.quals.find(x => x.id === e.qualification_id);
  return q && q.doc_group ? (REF.docTypes || []).filter(t => t.group_key === q.doc_group) : [];
}
function docsBadge(c) {
  let miss = 0, any = false;
  c.enr.forEach(e => { const ts = docTypesFor(e); if (!ts.length) return; any = true; const got = new Set(c.docs.filter(d => d.enrolment_id === e.id).map(d => d.doc_type_id)); miss += ts.filter(t => !got.has(t.id)).length; });
  return any ? (miss ? ' · ' + miss + ' missing' : ' · complete') : '';
}
function tabDocs(c) {
  if (!c.enr.length) return empty('No enrolments', 'Add an enrolment to track the documents it needs.');
  return c.enr.map(e => {
    const types = docTypesFor(e), title = (qualName(e.qualification_id) || 'Enrolment') + (e.year ? ' · ' + e.year : '');
    if (!types.length) return section(title, '<div style="padding:16px" class="nx-muted">' + (e.qualification_id ? 'There is no document list for this course yet.' : 'Choose a qualification on this enrolment to see its document list.') + '</div>');
    const got = {}; c.docs.filter(d => d.enrolment_id === e.id).forEach(d => { got[d.doc_type_id] = d; });
    const n = types.filter(t => got[t.id]).length;
    return section(title + ' · ' + n + ' of ' + types.length + ' received',
      '<ul class="nx-list nx-doclist">' + types.map(t => { const g = got[t.id];
        return '<li><label class="nx-check"><input type="checkbox" data-doc="' + t.id + '" data-enr="' + e.id + '"' + (g ? ' checked' + (ME.admin ? '' : ' disabled title="Only hub admins can untick a document"') : '') + '> <span><b>' + esc(t.name) + '</b>' + (t.note ? '<small>' + esc(t.note) + '</small>' : '') + '</span></label>' +
          (g ? '<span class="nx-muted">' + esc(fmtDate(g.received_on)) + (g.created_by ? ' · ' + esc(g.created_by) : '') + '</span>' : '<span class="nx-pill warn">Missing</span>') + '</li>'; }).join('') + '</ul>');
  }).join('');
}
/* the documents needed before placement (doc group 'placement'). Passport and Visa copy also count when ticked in the course list above,
   the same way the database rule counts them */
function placementDocState(c, e) {
  const types = (REF.docTypes || []).filter(t => t.group_key === 'placement');
  const nameOf = id => { const t = (REF.docTypes || []).find(x => x.id === id); return t ? t.name.trim().toLowerCase() : ''; };
  const mine = c.docs.filter(d => d.enrolment_id === e.id);
  const rows = types.map(t => {
    const own = mine.find(d => d.doc_type_id === t.id), other = own ? null : mine.find(d => nameOf(d.doc_type_id) === t.name.trim().toLowerCase());
    return { t, own, other, on: (own || other || {}).received_on || null };
  });
  const miss = rows.filter(r => !r.on).length, last = !miss && rows.length ? rows.map(r => r.on).sort().pop() : null;
  return { rows, miss, last };
}
function placementDocsSection(c, e, title) {
  const st = placementDocState(c, e); if (!st.rows.length) return '';
  return section('Placement documents' + (c.enr.length > 1 ? ' (' + title + ')' : '') + ' · ' + (st.rows.length - st.miss) + ' of ' + st.rows.length + ' received' + (st.last ? ' · complete ' + fmtDate(st.last) : ''),
    '<div class="nx-help" style="padding:10px 16px 0">All of these are needed before a placement request is sent or a student goes in a batch. The 3-week wait counts from the day the last one arrives.</div>' +
    '<ul class="nx-list nx-doclist">' + st.rows.map(r => {
      const dis = r.other || (r.own && !ME.admin);
      return '<li><label class="nx-check"><input type="checkbox" data-doc="' + r.t.id + '" data-enr="' + e.id + '"' + (r.on ? ' checked' : '') + (dis ? ' disabled title="' + (r.other ? 'Ticked in the course list above' : 'Only hub admins can untick a document') + '"' : '') + '> <span><b>' + esc(r.t.name) + '</b>' + (r.t.note ? '<small>' + esc(r.t.note) + '</small>' : '') + '</span></label>' +
        (r.on ? '<span class="nx-muted">' + esc(fmtDate(r.on)) + (r.own && r.own.created_by ? ' · ' + esc(r.own.created_by) : (r.other ? ' · from the course list' : '')) + '</span>' : '<span class="nx-pill warn">Missing</span>') + '</li>'; }).join('') + '</ul>');
}
function tabMoney(c) {
  if (!c.enr.length) return empty('No enrolments', 'Add an enrolment to track the fee, stage and payments.') + '<div style="padding:0 16px 16px;text-align:center"><button class="nx-btn primary" data-a="addEnr">' + ico('plus') + 'Add enrolment</button></div>';
  const linked = new Set();
  const cards = c.enr.map(e => {
    const ps = c.pays.filter(p => p.enrolment_id === e.id); ps.forEach(p => linked.add(p.id));
    const rf = c.refunds.filter(r => r.enrolment_id === e.id);
    const paid = sumPaid(ps) - rf.reduce((t, r) => t + Number(r.amount), 0), pend = sumPending(ps);
    const fee = Number(e.fee || 0); const bal = fee - paid;
    return section((qualName(e.qualification_id) || 'Enrolment') + (e.year ? ' · ' + e.year : ''),
      '<div style="padding:16px;display:flex;flex-wrap:wrap;gap:16px;align-items:center"><div><label class="nx-lbl">Stage</label><select class="nx-sel sm" data-stage="' + e.id + '">' + selectOpts(stageOpts(c.isStudent, e.stage), e.stage, 'Not set') + '</select>' + (c.isStudent ? '<div class="nx-muted" style="margin-top:4px;font-size:11px">Incomplete docs and Placement set themselves.</div>' : '<div class="nx-muted" style="margin-top:4px;font-size:11px">Leads can be at Checklist sent or Docs completed until $200 is paid.</div>') + '</div>' +
      '<div><div class="nx-lbl">Agreed fee</div><div class="nx-money">' + (fee ? money(fee) : '–') + '</div></div><div><div class="nx-lbl">Paid</div><div class="nx-money">' + money(paid) + '</div>' + (pend ? '<div class="nx-muted" style="font-size:11px">' + money(pend) + ' pending verification</div>' : '') + '</div><div><div class="nx-lbl">Balance</div><div class="nx-money ' + (bal > 0 ? 'nx-neg' : 'nx-pos') + '">' + (fee ? money(bal) : '–') + '</div></div><div class="nx-grow"></div>' +
      '<div class="nx-btnrow">' + (canCash() ? '<button class="nx-btn sm" data-a="addPay" data-id="' + e.id + '">' + ico('plus') + 'Payment</button>' : '') + '<button class="nx-btn sm" data-a="refund" data-id="' + e.id + '">Refund</button><button class="nx-btn sm" data-a="editEnr" data-id="' + e.id + '">' + ico('edit') + 'Edit</button></div></div>' +
      (e.notes || e.follow_up_note ? '<div style="padding:0 16px 12px" class="nx-muted">' + esc(e.notes || '') + '</div>' : '') +
      (ps.length || rf.length ? '<div class="nx-tablewrap"><table class="nx-table auto tight"><thead><tr><th>Date</th><th>Amount</th><th>Instalment</th><th>Method</th><th>Reference</th><th>Status</th><th>Processing</th></tr></thead><tbody>' +
        ps.map(p => { const q = c.queue.find(x => x.payment_id === p.id); return '<tr><td>' + esc(fmtDate(p.paid_on)) + '</td><td class="nx-money">' + money(p.amount) + '</td><td>' + (x => x ? esc(x.label) : '–')(instalmentOf(e.fee, ps, p.id)) + '</td><td>' + esc(p.method || '–') + '</td><td>' + esc(p.reference || p.payer_name || '–') + '</td><td>' + payStatusHtml(p) + '</td><td>' + (q ? pill('payment_queue', q.queue_status) + ' ' + pill('processing', q.processing_step) : '<span class="nx-muted">–</span>') + '</td></tr>'; }).join('') +
        rf.map(r => '<tr><td>' + esc(fmtDate(r.refunded_on)) + '</td><td class="nx-money nx-neg">-' + money(r.amount).replace('-', '') + '</td><td></td><td>Refund</td><td>' + esc(r.reason || '–') + '</td><td></td><td>Approved by ' + esc(r.approved_by || '–') + '</td></tr>').join('') + '</tbody></table></div>' : '<div style="padding:0 16px 16px" class="nx-muted">No payments recorded.</div>'));
  }).join('');
  const orphan = c.pays.filter(p => !linked.has(p.id));
  return cards + (orphan.length ? section('Payments not linked to an enrolment', '<div class="nx-tablewrap"><table class="nx-table auto tight"><tbody>' + orphan.map(p => '<tr><td>' + esc(fmtDate(p.paid_on)) + '</td><td class="nx-money">' + money(p.amount) + '</td><td>' + esc(p.reference || p.payer_name || '–') + '</td><td>' + payStatusHtml(p) + '</td></tr>').join('') + '</tbody></table></div>') : '');
}
function tabActivity(c) {
  const items = [];
  c.hist.forEach(h => items.push({ t: h.changed_at, html: '<li><span class="dot">' + ico('list') + '</span><div><b>' + esc(h.changed_by || 'Someone') + '</b> moved ' + esc(h.context.replace(/_/g, ' ')) + (h.from_status ? ' from <b>' + esc(statusLabel(h.context, h.from_status)) + '</b>' : '') + ' to <b>' + esc(statusLabel(h.context, h.to_status)) + '</b><time>' + fmtDT(h.changed_at) + '</time></div></li>' }));
  c.aud.forEach(a => { if (a.action === 'UPDATE' && !diffHtml(a)) return; items.push({ t: a.changed_at, html: feedItem(a) }); });
  (c.logs || []).forEach(k => items.push({ t: k.created_at, html: '<li><span class="dot ok">' + ico('notebook') + '</span><div><b>' + esc(k.receiver || 'Someone') + '</b> received their logbook on ' + esc(fmtDate(k.received_on)) + (k.comments ? '<div class="nx-diff">' + esc(k.comments) + '</div>' : '') + '<time>' + fmtDT(k.created_at) + '</time></div></li>' }));
  (c.calls || []).forEach(k => items.push({ t: k.created_at, html: '<li><span class="dot info">' + ico('bell') + '</span><div><b>' + esc(k.logged_by || 'Someone') + '</b> logged a call (' + (k.direction === 'out' ? 'out' : 'in') + '): ' + esc(k.reason) + (k.resolved_at ? '' : ' <span class="nx-pill warn">Waiting for a callback</span>') + (k.note ? '<div class="nx-diff">' + esc(k.note) + '</div>' : '') + '<time>' + fmtDT(k.created_at) + '</time></div></li>' }));
  (c.books || []).forEach(b => { if (!b.attendance_at || !BK_WORD[b.status]) return; const cd = (b.nex_class_sessions || {}).class_date; items.push({ t: b.attendance_at, html: '<li><span class="dot ' + (b.status === 'attended' ? 'ok' : 'warn') + '">' + ico('aid') + '</span><div><b>' + esc(b.attendance_by || 'Someone') + '</b> marked <b>' + BK_WORD[b.status] + '</b> for First Aid and CPR' + (cd ? ' on ' + esc(fmtDate(cd)) : '') + '<time>' + fmtDT(b.attendance_at) + '</time></div></li>' }); });
  items.sort((a, b) => String(b.t).localeCompare(String(a.t)));
  return items.length ? '<ul class="nx-feed">' + items.slice(0, 60).map(i => i.html).join('') + '</ul>' : empty('No activity yet');
}

async function studentAction(a, ds, c) {
  const s = c.s;
  if (a === 'editStu') return formModal('Edit contact', studentFields(s), async v => { tidyStudent(v); await upd('nex_students', 'id=eq.' + s.id, v); toast('Saved'); render(); });
  if (a === 'editDet') {
    const d = c.d;
    const f = [{ k: 'dob', label: 'Date of birth', type: 'date', value: d.dob }, { k: 'usi', label: 'USI', value: d.usi, help: 'Unique Student Identifier, 10 characters' },
      { k: 'address', label: 'Street address', value: d.address, full: true }, { k: 'suburb', label: 'Suburb', value: d.suburb }, { k: 'state', label: 'State', value: d.state }, { k: 'postcode', label: 'Postcode', value: d.postcode },
      { k: 'emergency_name', label: 'Emergency contact', value: d.emergency_name }, { k: 'emergency_phone', label: 'Emergency phone', type: 'tel', value: d.emergency_phone }, { k: 'emergency_relation', label: 'Relationship', value: d.emergency_relation },
      { k: 'disability', label: 'Disability', value: d.disability }, { k: 'indigenous_status', label: 'Indigenous status', value: d.indigenous_status }];
    return formModal('Edit personal details', f, async v => {
      if (v.usi) v.usi = v.usi.replace(/\s/g, '').toUpperCase();
      await api('rpc/nex_save_details', { method: 'POST', body: { p_student: s.id, p: v } });
      toast('Saved'); render();
    });
  }
  if (a === 'archive') { if (!ME.admin) return toast('Only hub admins can archive records.', true); if (await confirmBox(c.isStudent ? 'Archive student' : 'Archive lead', fullName(s) + ' will be hidden from lists. Their records are kept.', 'Archive', true)) { await upd('nex_students', 'id=eq.' + s.id, { deleted_at: new Date().toISOString() }); toast('Archived'); go(c.isStudent ? '#/students' : '#/leads'); } return; }
  if (a === 'addEnr') return enrolmentForm(s, null, c.isStudent);
  if (a === 'editEnr') return enrolmentForm(s, c.enr.find(e => e.id === ds.id), c.isStudent);
  if (a === 'addPay') return paymentForm({ student: s, enrolment: c.enr.find(e => e.id === ds.id) });
  if (a === 'refund') return refundForm(c.enr.find(e => e.id === ds.id), c.pays);
  if (a === 'addTask') return taskForm(null, () => render(), s);
  if (a === 'doneTask') { await upd('nex_tasks', 'id=eq.' + ds.id, { status: 'done' }); toast('Task done'); return render(); }
  if (a === 'startCycle') return formModal('Start follow-ups', [{ k: 'first', label: 'First contact', type: 'date', value: s.first_contact_on || new Date(s.created_at).toLocaleDateString('en-CA', { timeZone: TZ }), required: true, full: true, help: 'The 1st follow-up is 2 days after this date, the 2nd 4 days after, the 3rd 6 days after.' }], async v => { await api('rpc/nex_start_lead_cycle', { method: 'POST', body: { p_student: s.id, p_first: v.first } }); toast('3 follow-ups set'); render(); }, 'Start');
  if (a === 'doneFu') return doneFollowup(ds.id);
  if (a === 'emailFu') return emailFollowup(s, Number(ds.step));
  if (a === 'doneDetails') { await upd('nex_students', 'id=eq.' + s.id, { needs_details: false, flagged_to: null }); toast('Marked complete'); return render(); }
  if (a === 'bookFA') return bookClassModal(s, (c.enr.find(e => e.id === ds.id) || c.enr[0] || {}).id || null, () => render());
}

/* picking a qualification fills the agreed fee with that course's standard fee, unless someone typed a different one */
function standardFee(m, qSel, feeSel) {
  const q = $('#' + qSel, m.el), fe = $('#' + feeSel, m.el); if (!q || !fe) return;
  let auto = fe.value === '' ? true : (REF.quals.some(x => x.default_fee != null && String(Number(x.default_fee)) === fe.value));
  fe.addEventListener('input', () => { auto = false; });
  const apply = () => { const c = REF.quals.find(x => x.id === q.value); if (c && c.default_fee != null && (auto || fe.value === '')) { fe.value = String(Number(c.default_fee)); auto = true; } };
  q.addEventListener('change', apply);
  if (fe.value === '') apply();
}
function enrolmentForm(s, e, isStudent) {
  e = e || {};
  const f = [{ k: 'qualification_id', label: 'Qualification', type: 'select', options: REF.quals.filter(q => q.active || q.id === e.qualification_id), value: e.qualification_id, blank: 'Not set' },
    { k: 'year', label: 'Year', type: 'number', value: e.year || new Date().getFullYear() }, { k: 'stage', label: 'Stage', type: 'select', options: stageOpts(isStudent, e.stage), value: e.stage, blank: 'Not set' },
    { k: 'fee', label: 'Agreed fee ($)', type: 'number', value: e.fee }, { k: 'enrolled_on', label: 'Enrolled on', type: 'date', value: e.enrolled_on || sydToday() },
    { k: 'agent_id', label: 'Agent', type: 'select', options: REF.agents.filter(a => a.active), value: e.agent_id, blank: 'Self / no agent' },
    { k: 'owner', label: 'Looked after by', type: 'select', options: REF.staff, value: e.owner, blank: 'Nobody yet' }, { k: 'fee_note', label: 'Fee note', value: e.fee_note },
    { k: 'notes', label: 'Notes', type: 'textarea', value: e.notes, full: true }];
  const em = formModal(e.id ? 'Edit enrolment' : 'New enrolment', f, async v => {
    if (e.id) await upd('nex_enrolments', 'id=eq.' + e.id, v); else await ins('nex_enrolments', Object.assign({ student_id: s.id, created_by: ME.name }, v), true);
    toast('Saved'); render();
  });
  if (!e.id) standardFee(em, 'f_qualification_id', 'f_fee');
  return em;
}
/* shared: payment form. opts {student, enrolment} or none (global add with picker) */
function paymentForm(o) {
  o = o || {};
  const f = [{ k: 'amount', label: 'Amount ($)', type: 'number', required: true }, { k: 'paid_on', label: 'Payment date', type: 'date', value: sydToday(), required: true },
    { k: 'method', label: 'Method', type: 'select', options: payMethodOpts(), value: canPay() ? '' : 'Cash', blank: 'Choose', required: true }, { k: 'reference', label: 'Reference', placeholder: 'Bank reference or receipt' },
    { k: 'method_help', type: 'help', text: PAY_METHOD_HELP },
    { k: 'payer_name', label: 'Paid by', value: o.student ? fullName(o.student) : '' }, { k: 'note', label: 'Note' }];
  const extra = o.student ? '' : '<div class="full" style="margin-bottom:12px"><div class="nx-warnbox">You will pick the student after you save this form. You can also leave the payment unmatched and link it later.</div></div>';
  return formModal(o.student ? 'Record payment for ' + fullName(o.student) : 'Record payment', f, async (v, m) => {
    const row = Object.assign({ student_id: o.student ? o.student.id : null, enrolment_id: o.enrolment ? o.enrolment.id : null, created_by: ME.name }, v);
    const p = await ins('nex_payments', row);
    if (o.enrolment && o.addToQueue !== false) await queuePayment(o.enrolment.id, p.id);
    toast(payDoneMsg(v.method)); render();
  }, 'Save payment', extra);
}
function refundForm(e, pays) {
  if (!e) return;
  const mine = pays.filter(p => p.enrolment_id === e.id);
  const f = [{ k: 'amount', label: 'Refund amount ($)', type: 'number', required: true }, { k: 'refunded_on', label: 'Refund date', type: 'date', value: sydToday(), required: true },
    { k: 'payment_id', label: 'Payment being refunded', type: 'select', options: mine.map(p => ({ id: p.id, label: fmtDate(p.paid_on) + ' · ' + money(p.amount) })), blank: 'Not linked' },
    { k: 'approved_by', label: 'Approved by', type: 'select', options: REF.staff, required: true, blank: 'Choose' }, { k: 'reason', label: 'Reason', type: 'textarea', full: true, required: true }];
  return formModal('Record refund', f, async v => { await ins('nex_refunds', Object.assign({ enrolment_id: e.id, created_by: ME.name }, v), true); toast('Refund recorded'); render(); });
}
