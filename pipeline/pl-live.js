'use strict';
/* pl-live.js · YatraLine · live updates.
   One of the YatraLine files loaded by nex.html (list and order: PL_FILES in the loader). All of them share one global scope.

   How it works: every write to a main table leaves a one-line "ping" in nex_live_ping (a database trigger). This file keeps one
   WebSocket open to Supabase Realtime, listens for new pings, and refreshes the page you are on when a ping is about a table that page
   shows. No student data travels over the socket: a ping is only "table X changed, by Y". RLS means only people allowed into
   YatraLine receive pings.

   It never refreshes while you are typing, while a dialog is open, or a moment after you click. Your own saves are skipped (the page
   already refreshed itself). If the socket cannot connect (a strict network), the page refreshes itself every minute instead.
   The browser's own WebSocket is used, not a library, because the page's security policy allows no outside scripts. */
const LV = { ws: null, ok: false, tries: 0, tok: '', hb: null, retry: null, due: null, dirty: false, wrote: 0, touched: 0, keyed: 0, ref: 0, quiet: 0, off: 0 };
const LV_TOPIC = 'realtime:yl-live';
const LV_MIN_GAP = 4000;        /* never refresh the page more often than this */
const LV_PLAIN = ['nex_students', 'nex_student_details', 'nex_enrolments', 'nex_enrolment_docs', 'nex_payments', 'nex_payment_queue', 'nex_refunds', 'nex_followups', 'nex_class_bookings', 'nex_tasks', 'nex_placements', 'nex_placement_profile'];
/* which tables each page shows (null = any table). A page that is not listed (admin, calls, quizzes, profile…) is never refreshed. */
const LV_PAGES = [
  [/^\/$/, null],
  [/^\/(students|leads|search)(\?|$)/, LV_PLAIN],
  [/^\/students\/[0-9a-f-]{36}$/, LV_PLAIN.concat(['nex_class_sessions', 'nex_placement_requests', 'nex_batches'])],
  [/^\/payments/, ['nex_payments', 'nex_payment_queue', 'nex_enrolments', 'nex_enrolment_docs', 'nex_refunds', 'nex_students']],
  [/^\/firstaid/, ['nex_class_sessions', 'nex_class_bookings', 'nex_payments', 'nex_followups', 'nex_students']],
  [/^\/placement/, ['nex_placement_profile', 'nex_placements', 'nex_placement_requests', 'nex_batches', 'nex_batch_facilities', 'nex_facilities', 'nex_blacklist', 'nex_enrolments', 'nex_enrolment_docs', 'nex_payments', 'nex_students']],
  [/^\/tasks/, ['nex_tasks', 'nex_students']],
  [/^\/logbooks/, ['nex_logbook_receipts', 'nex_students', 'nex_enrolments']],
  [/^\/followups/, ['nex_followups', 'nex_students', 'nex_enrolments']],
  [/^\/documents/, ['nex_enrolment_docs', 'nex_enrolments', 'nex_students']]
];

/* called by api() after the person saves something */
function lvWrote() { LV.wrote = Date.now(); }

function lvWants(tbl) {
  const h = location.hash.replace(/^#/, '') || '/';
  const p = LV_PAGES.find(x => x[0].test(h));
  if (!p) return false;
  return p[1] === null || p[1].indexOf(tbl) > -1;
}
/* true when refreshing now could get in the person's way */
function lvBusy() {
  if (typeof modalStack !== 'undefined' && modalStack.length) return true;                    /* a dialog is open */
  if (document.body.classList.contains('nx-busy')) return true;                              /* a page is already loading */
  const now = Date.now();
  if (now - LV.touched < 1500) return true;                                                  /* just clicked or pressed something */
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.closest && a.closest('main.nx-main') && now - LV.keyed < 8000) return true;   /* typing in the page */
  return false;
}
/* something changed: refresh the page soon, but only when it is safe and not too often */
function lvChanged() {
  LV.dirty = true;
  if (LV.due) return;
  const wait = Math.max(600, LV_MIN_GAP - (Date.now() - LV.quiet));
  LV.due = setTimeout(lvTry, wait);
}
function lvTry() {
  LV.due = null;
  if (!LV.dirty || locked) return;
  if (document.hidden) return;                       /* refreshed when the tab is shown again */
  if (lvBusy()) { LV.due = setTimeout(lvTry, 1500); return; }
  LV.dirty = false; LV.quiet = Date.now();
  try { render(); } catch (e) { console.warn('[live] refresh failed', e); }
}
function lvPing(rec) {
  if (!rec || !rec.tbl) return;
  if (rec.actor && rec.actor === ME.name && Date.now() - LV.wrote < 6000) return;           /* my own save: the page already refreshed */
  if (lvWants(rec.tbl)) lvChanged();
}

function lvSend(o) { try { if (LV.ws && LV.ws.readyState === 1) LV.ws.send(JSON.stringify(o)); } catch (e) {} }
function lvRef() { return String(++LV.ref); }
function lvClose() { const w = LV.ws; LV.ws = null; LV.ok = false; if (w) { try { w.onclose = w.onerror = w.onmessage = w.onopen = null; w.close(); } catch (e) {} } }
function lvLater() {
  clearTimeout(LV.retry);
  const wait = Math.min(30000, 1000 * Math.pow(2, Math.min(LV.tries, 5))) + Math.random() * 800;
  LV.tries++;
  LV.retry = setTimeout(lvOpen, wait);
}
async function lvOpen() {
  if (locked || LV.ws) return;
  let tok = '';
  try { tok = await bearer(); } catch (e) { return lvLater(); }
  if (locked) return;
  let ws;
  try { ws = new WebSocket(SB.replace(/^http/, 'ws') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(KEY) + '&vsn=1.0.0'); } catch (e) { return lvLater(); }
  LV.ws = ws; LV.tok = tok;
  ws.onopen = () => {
    const r = lvRef();
    lvSend({ topic: LV_TOPIC, event: 'phx_join', ref: r, join_ref: r, payload: {
      config: { broadcast: { ack: false, self: false }, presence: { key: '' }, postgres_changes: [{ event: 'INSERT', schema: 'public', table: 'nex_live_ping' }] },
      access_token: tok } });
  };
  ws.onmessage = ev => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (!m) return;
    LV.off = 0;
    if (m.event === 'postgres_changes') { const d = m.payload && m.payload.data; if (d && d.type === 'INSERT') lvPing(d.record); return; }
    if (m.event === 'phx_reply' && m.topic === LV_TOPIC) {
      if (m.payload && m.payload.status === 'ok') {
        const gap = LV.tries > 0 || LV.dirty;   /* we were away: anything could have changed */
        LV.ok = true; LV.tries = 0;
        if (gap && LV.wasDown) lvChanged();
        LV.wasDown = false;
      } else { console.warn('[live] join refused', m.payload); lvClose(); lvLater(); }
      return;
    }
    if (m.event === 'system' && m.payload && m.payload.status === 'error') { console.warn('[live]', m.payload.message); return; }
    if (m.event === 'phx_close' || m.event === 'phx_error') { lvClose(); LV.wasDown = true; lvLater(); }
  };
  ws.onerror = () => {};
  ws.onclose = () => { LV.ws = null; LV.ok = false; LV.wasDown = true; if (!locked) lvLater(); };
}
/* every 25 s: keep the socket alive, pass on a renewed sign-in token, and refresh by timer when there is no socket */
function lvBeat() {
  if (locked) { lvClose(); clearTimeout(LV.retry); return; }
  if (LV.ws && LV.ws.readyState === 1) {
    lvSend({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: lvRef() });
    const t = ss.get('nex_sb_at');
    if (t && t !== LV.tok && tokenAlive(t, 30000)) { LV.tok = t; lvSend({ topic: LV_TOPIC, event: 'access_token', payload: { access_token: t }, ref: lvRef() }); }
  }
  if (!LV.ok) { if (++LV.off >= 3) { LV.off = 0; lvChanged(); } }   /* no live socket for ~75 s: refresh the page by timer instead */
  else LV.off = 0;
}
function liveStart() {
  if (LV.started) return; LV.started = true;
  const touch = () => { LV.touched = Date.now(); };
  ['pointerdown', 'pointerup', 'keydown', 'touchstart'].forEach(e => document.addEventListener(e, touch, { capture: true, passive: true }));
  document.addEventListener('input', () => { LV.keyed = Date.now(); LV.touched = Date.now(); }, true);
  document.addEventListener('keydown', () => { LV.keyed = Date.now(); }, true);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (!LV.ws && !locked) { clearTimeout(LV.retry); lvOpen(); }
    if (LV.dirty || LV.wasDown) lvChanged();
  });
  window.addEventListener('online', () => { if (!LV.ws && !locked) { clearTimeout(LV.retry); lvOpen(); } });
  LV.hb = setInterval(lvBeat, 25000);
  lvOpen();
}
