/* ── WELLBEING CHECK-IN ───────────────────────────────────────────────────
   A private, kind nudge for the person who is logged in. After sign-in we look at THEIR OWN last
   two weeks of clock-ins against THEIR OWN roster, and at THEIR OWN same-day sick calls. If a pattern
   shows up, they see one popup with a link to burnout-prevention advice. It is only ever shown on
   their own screen: nothing is sent to anyone, nothing is saved in the database, and managers are
   not told. (The only thing kept is "popup shown on <date>" in this browser, so it does not repeat.)
   It never blocks anything: "Close" always works, and every failure path just shows nothing.

   Rules (change the numbers here and nowhere else):
     late_some   : 10 to 59 min late on 3 or more shifts in the last 14 days        -> "Everything okay?"
     late_a_lot  : 60 min or more late on 2 or more shifts in the last 7 days        -> "Would a later start help? Is your health okay?"
     sick_calls  : 1 or more APPROVED same-day sick leaves in the last 10 days                 -> "Speak to a manager if it is getting worse"
   Only one popup is shown at a time; the most serious comes first (sick_calls, then late_a_lot, then late_some).
   "Late" = first clock-in of the day minus the rostered start, in real minutes (no rounding, no grace).
   Days on approved leave are skipped. A gap over 6 hours is treated as a missed clock-in, not lateness. */
const WB = {
  link: 'https://www.beyondblue.org.au/mental-health/work/burnout',
  linkLabel: 'Burnout prevention advice (Beyond Blue)',
  helpLine: 'Need to talk to someone now? Beyond Blue: 1300 22 4636 (24/7).',
  someMin: 10, someDays: 3, someWindow: 14,
  lotMin: 60, lotDays: 2, lotWindow: 7,
  sickCalls: 1, sickWindow: 10,
  maxLateMin: 360,
  cooldownDays: 7
};

function _wbSyd(ts) {
  const f = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = {}; f.formatToParts(new Date(ts)).forEach(function (x) { p[x.type] = x.value; });
  return { ymd: p.year + '-' + p.month + '-' + p.day, min: (+p.hour) * 60 + (+p.minute) };
}
function _wbAddDays(ymd, n) {
  const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function _wbMin(t) { const a = String(t || '').split(':'); return (+a[0]) * 60 + (+a[1] || 0); }
function _wbEsc(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

/* Pure function (easy to test). shifts: [{shift_date,start_time}], ins: [{ts}] clock-ins, leaves: [{from_date,to_date,status,reason_type,submitted_at}].
   today = Sydney date (yyyy-mm-dd). Returns the rule keys that are triggered, most serious first. */
function wbEvaluate(shifts, ins, leaves, today) {
  const firstIn = {};
  (ins || []).forEach(function (r) {
    const s = _wbSyd(r.ts);
    if (firstIn[s.ymd] === undefined || s.min < firstIn[s.ymd]) firstIn[s.ymd] = s.min;
  });
  const start = {};
  (shifts || []).forEach(function (s) {
    const m = _wbMin(s.start_time);
    if (start[s.shift_date] === undefined || m < start[s.shift_date]) start[s.shift_date] = m;
  });
  const onLeave = function (ymd) {
    return (leaves || []).some(function (l) { return l.status === 'approved' && l.from_date && l.to_date && ymd >= l.from_date && ymd <= l.to_date; });
  };
  const someFrom = _wbAddDays(today, -WB.someWindow), lotFrom = _wbAddDays(today, -WB.lotWindow), sickFrom = _wbAddDays(today, -WB.sickWindow);
  let some = 0, lot = 0;
  Object.keys(start).forEach(function (ymd) {
    if (ymd >= today || onLeave(ymd) || firstIn[ymd] === undefined) return;   /* only finished days that they actually worked */
    const late = firstIn[ymd] - start[ymd];
    if (late > WB.maxLateMin) return;
    if (late >= WB.lotMin) { if (ymd >= lotFrom) lot++; }
    else if (late >= WB.someMin && ymd >= someFrom) some++;
  });
  const sick = (leaves || []).filter(function (l) {
    return l.reason_type === 'Sick leave' && l.status === 'approved' && l.from_date >= sickFrom && l.from_date <= today &&
      l.submitted_at && _wbSyd(l.submitted_at).ymd === l.from_date;       /* same-day call: sent on the day the leave starts */
  }).length;
  const out = [];
  if (sick >= WB.sickCalls) out.push({ key: 'sick_calls', n: sick });
  if (lot >= WB.lotDays) out.push({ key: 'late_a_lot', n: lot });
  if (some >= WB.someDays) out.push({ key: 'late_some', n: some });
  return out;
}

function _wbSeenKey(name, rule) { return 'nxwb:' + name + ':' + rule; }
function _wbRecentlyShown(name, rule, today) {
  try {
    const v = localStorage.getItem(_wbSeenKey(name, rule));
    return !!v && v > _wbAddDays(today, -WB.cooldownDays);
  } catch (e) { return false; }
}
function _wbMarkShown(name, rule, today) { try { localStorage.setItem(_wbSeenKey(name, rule), today); } catch (e) { /* private mode: it may repeat, that is fine */ } }

const WB_TEXT = {
  late_some: {
    title: 'Just checking in',
    body: 'We noticed you have been a little late to a few shifts over the last couple of weeks. That happens, and nobody is in trouble. But running late a lot can be a sign you are getting worn out. Is everything okay?',
    ok: 'I\'m okay, thanks'
  },
  late_a_lot: {
    title: 'Would a later start help?',
    body: 'You have been more than an hour late to a couple of shifts this past week. Would starting later suit you better, or is your health okay? If you would like different start times, talk to your manager about your roster. Nobody is in trouble.',
    ok: 'I\'m okay, thanks',
    more: 'I\'d like a later start',
    moreText: 'No problem. Please speak to your manager about changing your start time, or update your availability so the next roster can fit you better.'
  },
  sick_calls: {
    title: 'Take care of yourself',
    body: 'You called in sick recently. We hope you are feeling better. If your health is getting worse, please speak to a manager, and see a doctor if you can.',
    ok: 'Thanks, I\'m okay'
  }
};

function _wbRender(item, name, today, isTest) {
  const t = WB_TEXT[item.key];
  let el = document.getElementById('wbModal'); if (el) el.remove();
  el = document.createElement('div'); el.id = 'wbModal'; el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'wbTitle');
  el.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px';
  el.innerHTML = '<div style="width:min(440px,100%);max-height:86vh;overflow:auto;border-radius:18px;padding:22px;background:var(--ui-surface,#fff);color:var(--ui-ink,#0f172a);box-shadow:0 20px 60px rgba(0,0,0,.4)">' +
    '<div id="wbTitle" style="font-size:18px;font-weight:800;margin:0 0 8px">' + _wbEsc(t.title) + '</div>' +
    '<div style="font-size:14px;line-height:1.55;margin:0 0 14px">' + _wbEsc(t.body) + '</div>' +
    '<div id="wbMore" style="display:none;font-size:13.5px;line-height:1.5;margin:0 0 14px;padding:10px 12px;border-radius:10px;background:var(--ui-surface-2,#f1f5f9)">' + _wbEsc(t.moreText || '') + '</div>' +
    '<a href="' + WB.link + '" target="_blank" rel="noopener noreferrer" style="display:block;text-align:center;padding:12px;border-radius:12px;font-size:14px;font-weight:800;text-decoration:none;background:var(--ui-accent,#2563eb);color:#fff;margin:0 0 8px">' + _wbEsc(WB.linkLabel) + '</a>' +
    (t.more ? '<button type="button" id="wbMoreBtn" style="width:100%;padding:11px;margin:0 0 8px;border:1px solid var(--ui-line,#cbd5e1);border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;background:transparent;color:inherit">' + _wbEsc(t.more) + '</button>' : '') +
    '<button type="button" id="wbOk" style="width:100%;padding:11px;border:1px solid var(--ui-line,#cbd5e1);border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;background:transparent;color:inherit">' + _wbEsc(t.ok) + '</button>' +
    '<div style="font-size:12px;opacity:.7;margin:12px 0 0;line-height:1.45">' + _wbEsc(WB.helpLine) + ' This message is only shown to you. Nobody else is told.</div></div>';
  document.body.appendChild(el);
  const close = function () { const m = document.getElementById('wbModal'); if (m) m.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = function (e) { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  document.getElementById('wbOk').onclick = close;
  const mb = document.getElementById('wbMoreBtn');
  if (mb) mb.onclick = function () { document.getElementById('wbMore').style.display = 'block'; mb.style.display = 'none'; };
  if (!isTest) _wbMarkShown(name, item.key, today);   /* a test popup never counts as "shown" */
  try { document.getElementById('wbOk').focus(); } catch (e) { /* ignore */ }
}

/* Read the test key ONCE, the moment this file loads. Nexus rewrites the address to a plain #home while it starts up,
   which would wipe ?wbtest= before the check runs. Works as index.html?wbtest=x and as index.html#home/?wbtest=x. */
const WB_TEST_KEY = (function () {
  try {
    const q = new URLSearchParams(location.search).get('wbtest');
    if (q) return q;
    const m = /[?&]wbtest=([a-z_]+)/.exec(location.hash || '');
    return m ? m[1] : null;
  } catch (e) { return null; }
})();

let _wbBusy = false;
async function checkWellbeing() {
  const name = (typeof me !== 'undefined' && me) || window.me;
  if (!name || _wbBusy || document.getElementById('wbModal')) return;
  if (document.getElementById('rcnModal')) return;                 /* a roster notice is open: do not stack popups, try again next time */
  _wbBusy = true;
  try {
    /* Admin test link: open Nexus with ?wbtest=late_some, ?wbtest=late_a_lot or ?wbtest=sick_calls to see that popup on your own screen.
       Hub admins only, shows on your screen only, saves nothing, and does not use up the real popup. */
    const want = WB_TEST_KEY;
    if (want && WB_TEXT[want]) {
      const rows = await sbGet('staff_settings', '?name=eq.' + encodeURIComponent(name) + '&select=is_hub_admin&limit=1');
      if (Array.isArray(rows) && rows[0] && rows[0].is_hub_admin === true) _wbRender({ key: want, n: 1 }, name, '2000-01-01', true);
      return;
    }
    const today = _wbSyd(Date.now()).ymd;
    const q = encodeURIComponent(name);
    const from14 = _wbAddDays(today, -WB.someWindow);
    const [shifts, ins, leaves] = await Promise.all([
      sbGet('roster_shifts', '?staff_name=eq.' + q + '&status=eq.assigned&shift_date=gte.' + from14 + '&shift_date=lt.' + today + '&select=shift_date,start_time&limit=200'),
      sbGet('clock_log', '?staff_name=eq.' + q + '&action=eq.in&ts=gte.' + _wbAddDays(from14, -1) + 'T00:00:00Z&select=ts&order=ts.asc&limit=600'),
      sbGet('leave_submissions', '?staff_name=eq.' + q + '&to_date=gte.' + from14 + '&status=eq.approved&select=from_date,to_date,status,reason_type,submitted_at&limit=100')
    ]);
    if (!Array.isArray(shifts) || !Array.isArray(ins) || !Array.isArray(leaves)) return;
    const hit = wbEvaluate(shifts, ins, leaves, today).find(function (h) { return !_wbRecentlyShown(name, h.key, today); });
    if (hit) _wbRender(hit, name, today);
  } catch (e) { console.warn('checkWellbeing', e); }
  finally { _wbBusy = false; }
}
