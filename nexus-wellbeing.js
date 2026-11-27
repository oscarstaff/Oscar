/* ── WELLBEING CHECK-IN ───────────────────────────────────────────────────
   A private, kind nudge for the person who is logged in. After sign-in we look at THEIR OWN last
   two weeks of clock-ins against THEIR OWN roster, and at THEIR OWN same-day sick calls. If a pattern
   shows up, they see one popup with a link to burnout-prevention advice. It is only ever shown on
   their own screen and nothing is sent to anyone. A log row (name, popup type, time) is saved to
   wellbeing_popup_log, which only hub admins can read (ShiftOps > Employees > Wellbeing).
   NOTE: the popup footer (WB_TEXT / _wbRender) still says "Nobody else is told", which is no longer true.
   "popup shown on <date>" is also kept in this browser, so it does not repeat.
   It never blocks anything: "Close" always works, and every failure path just shows nothing.

   Rules (change the numbers here and nowhere else):
     late_some   : 15 to 59 min late on 3 or more shifts in the last 14 days        -> "Everything okay?"
     late_a_lot  : 60 min or more late on 2 or more shifts in the last 7 days        -> "Would a later start help? Is your health okay?"
     sick_calls  : 2 or more APPROVED same-day sick leaves in the last 14 days                -> "Speak to a manager if it is getting worse"
   Only one popup is shown at a time; the most serious comes first (sick_calls, then late_a_lot, then late_some).
   "Late" = first clock-in of the day minus the rostered start, in real minutes (no rounding, no grace).
   Days on approved leave are skipped. A gap over 6 hours is treated as a missed clock-in, not lateness. */
const WB = {
  link: 'https://www.beyondblue.org.au/mental-health/work/burnout',
  linkLabel: 'Burnout prevention advice',
  helpLine: 'Advice is from Beyond Blue. Need to talk to someone now? Call them on 1300 22 4636 (24/7).',
  someMin: 15, someDays: 3, someWindow: 14,
  lotMin: 60, lotDays: 2, lotWindow: 7,
  sickCalls: 2, sickWindow: 14,
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

const WB_ICON = {
  late_some: '<circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 0 0 5 0"/>',
  late_a_lot: '<path d="M3 17h1m16 0h1M5.6 10.6l.7.7m12.1-.7l-.7.7M8 17a4 4 0 0 1 8 0M3 21h18M12 9V3l3 3m-6 0l3-3"/>',
  sick_calls: '<path d="M19.5 12.572L12 20l-7.5-7.428a5 5 0 1 1 7.5-6.566a5 5 0 1 1 7.5 6.572"/>'
};

const WB_CSS = '' +
  '@keyframes wbFade{from{opacity:0}to{opacity:1}}@keyframes wbFadeOut{from{opacity:1}to{opacity:0}}' +
  '@keyframes wbPop{0%{opacity:0;transform:translateY(28px) scale(.94)}100%{opacity:1;transform:none}}' +
  '@keyframes wbPopOut{to{opacity:0;transform:translateY(14px) scale(.97)}}' +
  '@keyframes wbSheet{from{transform:translateY(100%)}to{transform:none}}@keyframes wbSheetOut{to{transform:translateY(100%)}}' +
  '@keyframes wbUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}' +
  '@keyframes wbIcon{0%{opacity:0;transform:scale(.4) rotate(-12deg)}60%{transform:scale(1.12) rotate(2deg)}100%{opacity:1;transform:none}}' +
  '@keyframes wbRing{0%{opacity:.5;transform:scale(1)}100%{opacity:0;transform:scale(1.75)}}' +
  '#wbModal{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.52);animation:wbFade .24s ease-out both}' +
  '#wbModal.wb-out{animation:wbFadeOut .2s ease-in both}' +
  '#wbModal .wb-card{position:relative;box-sizing:border-box;width:min(420px,100%);max-height:90vh;overflow:auto;border-radius:22px;padding:30px 24px 22px;background:var(--ui-surface,#fff);color:var(--ui-ink,#0f172a);box-shadow:0 28px 80px rgba(15,23,42,.38);outline:none;animation:wbPop .5s cubic-bezier(.16,1,.3,1) both}' +
  '#wbModal.wb-out .wb-card{animation:wbPopOut .2s ease-in both}' +
  '#wbModal .wb-card.late_some{--wb:#0f766e}#wbModal .wb-card.late_a_lot{--wb:#b45309}#wbModal .wb-card.sick_calls{--wb:#be123c}' +
  '#wbModal .wb-ico{position:relative;width:60px;height:60px;border-radius:50%;margin:0 0 16px;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--wb) 14%,transparent);color:var(--wb);animation:wbIcon .6s .12s cubic-bezier(.34,1.4,.64,1) both}' +
  '#wbModal .wb-ico:after{content:"";position:absolute;inset:0;border-radius:50%;border:2px solid var(--wb);opacity:0;animation:wbRing 1.1s .45s ease-out 1 both}' +
  '#wbModal .wb-ico svg{width:30px;height:30px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}' +
  '#wbModal .wb-i{animation:wbUp .55s cubic-bezier(.16,1,.3,1) both;animation-delay:calc(.18s + var(--i,0) * .07s)}' +
  '#wbModal .wb-t{font-size:21px;line-height:1.25;font-weight:800;margin:0 0 8px;letter-spacing:-.01em}' +
  '#wbModal .wb-d{font-size:15px;line-height:1.6;margin:0 0 18px;color:var(--ui-ink-2,#334155)}' +
  '#wbModal .wb-more{display:none;font-size:14px;line-height:1.55;margin:0 0 16px;padding:12px 14px;border-radius:12px;background:color-mix(in srgb,var(--wb) 10%,transparent);animation:wbUp .4s cubic-bezier(.16,1,.3,1) both}' +
  '#wbModal .wb-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;box-sizing:border-box;min-height:48px;padding:12px 16px;margin:0 0 10px;border:0;border-radius:14px;font:inherit;font-size:15px;font-weight:700;cursor:pointer;text-decoration:none;transition:transform .15s ease,background-color .15s ease,box-shadow .15s ease}' +
  '#wbModal .wb-btn:active{transform:scale(.98)}' +
  '#wbModal .wb-main{background:var(--wb);color:#fff}#wbModal .wb-main:hover{box-shadow:0 6px 18px color-mix(in srgb,var(--wb) 40%,transparent);transform:translateY(-1px)}' +
  '#wbModal .wb-alt{background:color-mix(in srgb,var(--wb) 10%,transparent);color:inherit}#wbModal .wb-alt:hover{background:color-mix(in srgb,var(--wb) 18%,transparent)}' +
  '#wbModal .wb-btn:focus-visible,#wbModal .wb-x:focus-visible{outline:3px solid color-mix(in srgb,var(--wb) 45%,transparent);outline-offset:2px}' +
  '#wbModal .wb-btn svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
  '#wbModal .wb-x{position:absolute;top:12px;right:12px;width:36px;height:36px;border:0;border-radius:50%;background:transparent;color:var(--ui-ink-3,#64748b);font-size:22px;line-height:1;cursor:pointer;transition:background-color .15s}' +
  '#wbModal .wb-x:hover{background:color-mix(in srgb,var(--wb) 12%,transparent)}' +
  '#wbModal .wb-f{font-size:12.5px;line-height:1.5;margin:6px 0 0;color:var(--ui-ink-3,#64748b)}' +
  '@media (max-width:520px){#wbModal{align-items:flex-end;padding:0}#wbModal .wb-card{width:100%;border-radius:24px 24px 0 0;padding:28px 22px calc(22px + env(safe-area-inset-bottom,0px));animation:wbSheet .5s cubic-bezier(.16,1,.3,1) both}#wbModal.wb-out .wb-card{animation:wbSheetOut .22s ease-in both}}' +
  '@media (prefers-reduced-motion:reduce){#wbModal,#wbModal .wb-card,#wbModal .wb-i,#wbModal .wb-ico,#wbModal .wb-ico:after,#wbModal .wb-more{animation-duration:.01s!important;animation-delay:0s!important}#wbModal .wb-btn{transition:none}}';

function _wbRender(item, name, today, isTest) {
  const t = WB_TEXT[item.key];
  let el = document.getElementById('wbModal'); if (el) el.remove();
  if (!document.getElementById('wbStyle')) { const st = document.createElement('style'); st.id = 'wbStyle'; st.textContent = WB_CSS; document.head.appendChild(st); }
  el = document.createElement('div'); el.id = 'wbModal'; el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'wbTitle');
  el.innerHTML = '<div class="wb-card ' + item.key + '" tabindex="-1">' +
    '<button type="button" class="wb-x" id="wbX" aria-label="Close">&times;</button>' +
    '<div class="wb-ico" aria-hidden="true"><svg viewBox="0 0 24 24">' + WB_ICON[item.key] + '</svg></div>' +
    '<div class="wb-i wb-t" id="wbTitle" style="--i:0">' + _wbEsc(t.title) + '</div>' +
    '<div class="wb-i wb-d" style="--i:1">' + _wbEsc(t.body) + '</div>' +
    '<div class="wb-more" id="wbMore">' + _wbEsc(t.moreText || '') + '</div>' +
    '<a class="wb-i wb-btn wb-main" style="--i:2" href="' + WB.link + '" target="_blank" rel="noopener noreferrer">' + _wbEsc(WB.linkLabel) +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6M11 13l9-9M15 4h5v5"/></svg></a>' +
    (t.more ? '<button type="button" class="wb-i wb-btn wb-alt" style="--i:3" id="wbMoreBtn">' + _wbEsc(t.more) + '</button>' : '') +
    '<button type="button" class="wb-i wb-btn wb-alt" style="--i:4" id="wbOk">' + _wbEsc(t.ok) + '</button>' +
    '<div class="wb-i wb-f" style="--i:5">' + _wbEsc(WB.helpLine) + ' This message is only shown to you. Nobody else is told.</div></div>';
  document.body.appendChild(el);
  const onKey = function (e) { if (e.key === 'Escape') close(); };
  const close = function () {
    document.removeEventListener('keydown', onKey);
    const m = document.getElementById('wbModal'); if (!m) return;
    m.classList.add('wb-out');
    setTimeout(function () { const x = document.getElementById('wbModal'); if (x) x.remove(); }, 230);
  };
  document.addEventListener('keydown', onKey);
  document.getElementById('wbOk').onclick = close;
  document.getElementById('wbX').onclick = close;
  el.addEventListener('click', function (e) { if (e.target === el) close(); });
  const mb = document.getElementById('wbMoreBtn');
  if (mb) mb.onclick = function () { document.getElementById('wbMore').style.display = 'block'; mb.style.display = 'none'; };
  if (!isTest) {                                       /* a test popup never counts as "shown" and is never logged */
    _wbMarkShown(name, item.key, today);
    try { if (typeof sbPost === 'function') Promise.resolve(sbPost('wellbeing_popup_log', { staff_name: name, rule: item.key, n: item.n || null })).catch(function () {}); } catch (e) { /* the log never blocks the popup */ }
  }
  try { el.querySelector('.wb-card').focus({ preventScroll: true }); } catch (e) { /* ignore */ }
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
