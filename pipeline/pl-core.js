'use strict';
/* pl-core.js · Yatra · consts, team rules, helpers, sign-in and the api().
   One of the Yatra files loaded by nex.html (list and order: PL_FILES in the loader). All of them share one global scope. */
/* =========================================================
   Yatra core: api, helpers, ui kit, router
   ========================================================= */
const SB = 'https://jcfgldqrdbfkgbixszds.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZmdsZHFyZGJma2diaXhzemRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1Nzc3NzEsImV4cCI6MjA5MDE1Mzc3MX0.Wj8cCpnlsoZOPj5sKWeEdfvgjG4Nc-UuTTYgbcrPfeI';
const TZ = 'Australia/Sydney';
const ss = {
  get(k) { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
};
const ME = { name: '', admin: false, hub: false, team: '', viewOnly: false };   /* admin = Yatra admin (hub admins count too); hub = Nexus hub admin */
/* team rules (the database enforces these too; hiding the buttons just saves people an error)
   delete/archive: hub admins only · class flags on a booking (quiz, paid, plans, signature): Evershine · received payments: Processing and Accounts. Hub admins can do all of it.
   Class statuses (attended, no show, cancelled, rescheduled) are open to everyone. */
const teamIs = (...t) => { const mine = String(ME.team || '').trim().toLowerCase(); return t.some(x => x.toLowerCase() === mine); };
const canFlag = () => !!ME.admin || teamIs('Evershine');
/* who may send (or send again) each email. The edge functions and the database check the same teams; hiding the buttons just saves people an error.
   Enrolment email: Enrolment and Follow-Up. Placement checklist: Placement. First Aid and CPR confirmation: Evershine. Admins can send all of them. */
const canWelcomeMail = () => !!ME.admin || teamIs('Enrolment', 'Follow-Up');
const canPlacementMail = () => !!ME.admin || teamIs('Placement');
const canClassMail = () => !!ME.admin || teamIs('Evershine');
const canPay = () => !!ME.admin || teamIs('Processing', 'Accounts');
const canVerify = () => !!ME.admin || teamIs('Accounts');        /* Accounts check a bank payment against the bank statement (admins can too) */
const canCash = () => true;                                         /* anyone may ADD a payment. Only Processing and Accounts change one, and Accounts verify everything but cash */
/* Only confirmed money counts as received. A bank transfer is Pending verification until Accounts verify it; cash is confirmed as soon as it is entered. */
const payConfirmed = p => !p || !p.verify_status || p.verify_status === 'confirmed';
const sumPaid = list => (list || []).reduce((t, p) => t + (payConfirmed(p) ? Number(p.amount || 0) : 0), 0);
const sumPending = list => (list || []).reduce((t, p) => t + (p && p.verify_status === 'pending_verification' ? Number(p.amount || 0) : 0), 0);
function payStatusHtml(p) {
  if (!p) return '';
  let h = p.verify_status === 'pending_verification' ? '<span class="nx-pill warn">Pending verification</span>'
    : p.verify_status === 'rejected' ? '<span class="nx-pill bad" title="' + esc(p.verify_note || '') + '">Not received</span>' : '<span class="nx-pill ok">Confirmed</span>';
  if (p.handover_status === 'awaiting') h += ' <span class="nx-pill warn" title="An admin checks the cash handover">Cash: admin to check</span>';
  else if (p.handover_status === 'verified') h += ' <span class="nx-pill ok" title="' + esc('Checked by ' + (p.handover_by || 'an admin')) + '">Cash handover checked</span>';
  return h;
}
const PAY_METHODS = ['Bank transfer', 'Cash', 'Card', 'Agent', 'Other'];
const payMethodOpts = () => PAY_METHODS;
const payMethodHelp = () => canPay() ? 'Bank transfer waits as Pending verification until Accounts check it against the bank statement. Cash is confirmed straight away and goes to the admins to check the handover.'
  : 'Cash is confirmed straight away and goes to the admins to check the handover. Anything else waits as Pending verification until Accounts check it.';
function payDoneMsg(method) {
  const m = String(method || '').toLowerCase();
  return m.indexOf('bank') >= 0 || (m && m !== 'cash' && !canPay()) ? 'Payment recorded. It stays Pending verification until Accounts check it.'
    : m === 'cash' ? 'Cash recorded and confirmed. The admins have it in their cash receipts to check the handover.' : 'Payment recorded';
}

/* ---------- tiny helpers ---------- */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function sydToday() { return new Date().toLocaleDateString('en-CA', { timeZone: TZ }); }
function fmtDate(v) {
  if (!v) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T12:00:00') : new Date(v);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ });
}
function fmtDay(v) {
  const d = new Date(v + 'T12:00:00');
  return { wd: d.toLocaleDateString('en-AU', { weekday: 'short', timeZone: TZ }), dm: d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: TZ }) };
}
function fmtDT(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d)) return '';
  return d.toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: TZ });
}
/* Payments towards one fee are instalments. Number them by date and say what is still owed after each one.
   A later payment is never "short": it is the next instalment. */
function ordinal(n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
function instalmentOf(fee, pays, id) {
  const list = (pays || []).filter(payConfirmed).sort((a, b) => String(a.paid_on || '').localeCompare(String(b.paid_on || '')) || String(a.created_at || '').localeCompare(String(b.created_at || '')));
  const i = list.findIndex(p => p.id === id); if (i < 0) return null;
  const paidTo = list.slice(0, i + 1).reduce((t, p) => t + Number(p.amount || 0), 0), f = Number(fee || 0);
  const full = f > 0 && paidTo >= f, bal = f > 0 ? Math.max(0, f - paidTo) : null;
  const label = full ? (i ? ordinal(i + 1) + ' instalment · paid in full' : 'Paid in full') : ordinal(i + 1) + ' instalment' + (bal != null ? ' · ' + money(bal) + ' to go' : '');
  return { n: i + 1, paidTo, fee: f, balance: bal, full, label };
}
function money(n) {
  if (n == null || n === '') return '';
  const v = Number(n);
  return (v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString('en-AU', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
}
function initials(s) { return String(s || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?'; }
function fullName(s) { return [s && s.first_name, s && s.last_name].filter(Boolean).join(' ') || '(no name)'; }
function cleanPhone(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.startsWith('61') && d.length === 11) d = '0' + d.slice(2);
  if (d.length === 9 && /^[45]/.test(d)) d = '0' + d;
  return d;
}
function fmtPhone(p) { p = String(p || ''); return /^04\d{8}$/.test(p) ? p.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3') : p; }
function ico(name) {
  const P = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
    doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    chart: '<path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9z"/>',
    print: '<path d="M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="6" rx="1"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8M12 17h.01"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="m5 12 5 5L20 7"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
    chev: '<path d="m6 9 6 6 6-6"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', back: '<path d="M15 6l-6 6 6 6"/>', next: '<path d="M9 6l6 6-6 6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>', cash: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>', pin: '<path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    bell: '<path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7z"/><path d="M10 20a2 2 0 0 0 4 0"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>', cog: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', refresh: '<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
    send: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>', calendar: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
    download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>', upload: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>',
    filter: '<path d="M4 5h16l-6 8v6l-4-2v-4z"/>', flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>', warn: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17h.01"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', clipboard: '<rect x="6" y="5" width="12" height="16" rx="2"/><path d="M9 5V3h6v2M9 11h6M9 15h4"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5M16 5a3.5 3.5 0 0 1 0 6.5M18.5 15c2 .7 3 2.3 3 5"/>', building: '<path d="M5 21V4h9v17M14 9h5v12M3 21h18M8 8h3M8 12h3M8 16h3"/>',
    cap: '<path d="m2 9 10-5 10 5-10 5z"/><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5M22 9v6"/>', shield: '<path d="M12 3 5 6v5c0 5 3 8.5 7 10 4-1.5 7-5 7-10V6z"/><path d="m9 12 2 2 4-4"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.5 0l3-3a4 4 0 0 0-5.5-5.5L12 7M14 10a4 4 0 0 0-5.5 0l-3 3a4 4 0 0 0 5.5 5.5L12 17"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>', dots: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    trophy: '<path d="M8 4h8v6a4 4 0 0 1-8 0zM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 14v4M8 21h8M9 18h6"/>', receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    trend: '<path d="M3 17 9 11l4 4 8-8M15 7h6v6"/>', headset: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/><path d="M19 20a4 4 0 0 1-4 2h-2"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1"/>', archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4"/>',
    sort: '<path d="M7 4v16M3.5 16 7 19.5 10.5 16M17 20V4M13.5 8 17 4.5 20.5 8"/>', hourglass: '<path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9"/>',
    aid: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M12 10.5v6M9 13.5h6"/>',
    admin: '<path d="M12 3 5 6v5c0 5 3 8.5 7 10 4-1.5 7-5 7-10V6z"/><circle cx="12" cy="10.5" r="2"/><path d="M8.5 16c.6-1.8 2-2.5 3.5-2.5s2.9.7 3.5 2.5"/>',
    sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9M4 12h5M13 12h7"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/><circle cx="11" cy="12" r="2"/>',
    notebook: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v18M12.5 8.5h3M12.5 12.5h3"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 018 0v3"/>', home: '<path d="M4 11l8-7 8 7v9H4z"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="M5.7 5.7l12.6 12.6"/>'
  };
  return '<svg class="nx-ico" viewBox="0 0 24 24" aria-hidden="true">' + (P[name] || '') + '</svg>';
}

/* ---------- auth + api ---------- */
function tokenPayload(t) {
  try { const p = t.split('.'); let b = p[1].replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '='; return JSON.parse(atob(b)); } catch (e) { return null; }
}
function tokenAlive(t, slack) { const c = tokenPayload(t); return !!(c && c.exp && c.exp * 1000 > Date.now() + (slack || 30000)); }
/* Yatra never holds the Nexus refresh token (two tabs spending one refresh token ends the whole Nexus session).
   When the access token runs low it asks the open Nexus tab for a fresh one over a same-origin BroadcastChannel. */
let hubBC = null;
try { if (typeof BroadcastChannel !== 'undefined') hubBC = new BroadcastChannel('nexus-auth'); } catch (e) { hubBC = null; }
let hubWhy = '';   /* why the last refresh failed: 'signed_out' (Nexus says so), 'silent' (no Nexus tab answered), 'failed' */
function askHub(minLife) {
  return new Promise(resolve => {
    if (!hubBC) return resolve({ why: 'silent' });
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    let done = false;
    const finish = r => { if (done) return; done = true; clearTimeout(to); hubBC.removeEventListener('message', on); resolve(r); };
    const on = ev => { const m = ev && ev.data; if (m && m.id === id) finish(m.t === 'tok' ? { at: m.at } : { why: m.why || 'failed' }); };
    const to = setTimeout(() => finish({ why: 'silent' }), 5000);
    hubBC.addEventListener('message', on);
    try { hubBC.postMessage({ t: 'req', id, app: 'nex', minLife: minLife || 0 }); } catch (e) { finish({ why: 'silent' }); }
  });
}
if (hubBC) hubBC.addEventListener('message', ev => {
  const m = ev && ev.data; if (!m || m.id) return;
  if (m.t === 'out') { if (!locked) endSession('gone'); }                                  /* signed out of Nexus: lock straight away */
  else if (m.t === 'tok' && m.at && tokenAlive(m.at, 30000) && !locked) { ss.set('nex_sb_at', m.at); sessionWarn(false); }   /* Nexus refreshed: take the new token */
});
let refreshing = null;
async function refreshToken() {
  if (locked) return false;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const r = await askHub(20 * 60 * 1000);
        if (!r.at || !tokenAlive(r.at, 30000)) { hubWhy = r.why || 'failed'; return false; }
        ss.set('nex_sb_at', r.at); hubWhy = ''; sessionWarn(false);
        return true;
      } catch (e) { hubWhy = 'failed'; return false; } finally { setTimeout(() => { refreshing = null; }, 0); }
    })();
  }
  return refreshing;
}
/* A banner while the sign-in is about to run out and Nexus can't hand over a fresh one (Nexus tab closed or signed out). */
function sessionWarn(on, mins) {
  let el = document.getElementById('sessWarn');
  if (!on) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement('div'); el.id = 'sessWarn'; el.setAttribute('role', 'alert');
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99990;padding:9px 16px;text-align:center;font-size:13px;font-weight:700;background:#3a2410;color:#fdba74;border-bottom:1px solid #f59e0b';
    document.body.appendChild(el);
  }
  el.textContent = 'Your Yatra sign-in ends in about ' + Math.max(1, mins) + ' minute' + (mins === 1 ? '' : 's') + '. ' +
    (hubWhy === 'signed_out' ? 'Nexus has been signed out. ' : 'Nexus is not open in another tab. ') + 'Finish what you are saving, then open Yatra again from Nexus.';
}
/* checked every minute: top up the token early, warn if it can't be topped up */
async function keepToken() {
  if (locked) return;
  const t = ss.get('nex_sb_at'); if (!t) return;
  if (tokenAlive(t, 10 * 60 * 1000)) { sessionWarn(false); return; }
  const ok = await refreshToken();
  if (ok || locked) return;
  const c = tokenPayload(ss.get('nex_sb_at')), left = c && c.exp ? c.exp * 1000 - Date.now() : 0;
  if (left > 0 && left < 5 * 60 * 1000) sessionWarn(true, Math.ceil(left / 60000)); else if (left <= 0) endSession(hubWhy === 'signed_out' ? 'gone' : 'ran_out');
}
async function bearer() {
  let t = ss.get('nex_sb_at');
  if (!tokenAlive(t, 60000)) { if (await refreshToken()) t = ss.get('nex_sb_at'); }
  if (!tokenAlive(t, 0)) { endSession(hubWhy === 'signed_out' ? 'gone' : 'ran_out'); throw new Error('session'); }
  return t;
}
/* Ending a session wipes the tokens and everything on screen, so a walk-away or shared computer shows no student data. */
const IDLE_MS = 60 * 60 * 1000, MAX_SESSION_MS = 12 * 60 * 60 * 1000;
let locked = false, lastActive = Date.now();
function endSession(why) {
  if (locked) return; locked = true;
  ['nex_sb_at', 'nex_sb_rt', 'ngate_nex', 'nex_user', 'nex_is_admin', 'nex_is_hub', 'nex_t0'].forEach(k => { try { sessionStorage.removeItem(k); } catch (e) {} });
  const v = $('#view'); if (v) v.innerHTML = '';
  const m = $('#modalRoot'); if (m) m.innerHTML = '';
  const d = $('#drawerRoot'); if (d) d.innerHTML = '';
  const mf = $('#mfa'); if (mf) { mf.hidden = true; const mc = $('#mfaCard'); if (mc) mc.innerHTML = ''; }
  const a = $('#app'); if (a) a.hidden = true;
  const msg = $('#lockMsg'), head = $('#lockHead');
  const M = {
    idle: ['Yatra locked', 'Yatra locked after 1 hour without activity, so student details are hidden. Open Nexus and launch Yatra again.'],
    gone: ['Your session ended', 'You were signed out of Nexus, so Yatra closed and hid student details. Sign in to Nexus again, then open Yatra.'],
    old: ['Your session ended', 'For safety Yatra closes after 12 hours. Open Nexus and launch Yatra again.'],
    ran_out: ['Your session ended', 'Your sign-in lasts about an hour and Nexus was not open to renew it. Open Nexus (sign in again if it asks), then launch Yatra.']
  };
  const mm = M[why] || ['Your session ended', 'Your sign-in has run out. Open Nexus (sign in again if it asks), then launch Yatra.'];
  if (head) head.textContent = mm[0];
  if (msg) msg.textContent = mm[1];
  sessionWarn(false);
  const l = $('#lock'); if (l) l.hidden = false;
}
function watchSession() {
  ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(ev => window.addEventListener(ev, () => { lastActive = Date.now(); }, { passive: true, capture: true }));
  const check = () => {
    if (locked) return;
    const t0 = Number(ss.get('nex_t0')) || 0;
    if (Date.now() - lastActive > IDLE_MS) endSession('idle');
    else if (t0 && Date.now() - t0 > MAX_SESSION_MS) endSession('old');
  };
  setInterval(check, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
}
function offlineError() { const e = new Error("Can't reach the server. Check your internet connection and try again."); e.offline = true; return e; }
/* view-only lock (24 Nov 2026): while the database switch nex_config.view_only is on, staff who are not admins can look but not change anything.
   The database refuses the changes too; this check just stops them early with a clear message. These few paths stay open: reads sent as POST, view logging, and a person's own profile and quiz results. */
const VIEW_ONLY_MSG = 'Yatra is view-only right now. You can look around, but changes are switched off.';
const VO_OPEN = /^(rpc\/(nex_can_act|nex_view_allowed|nex_get_details|nex_placement_min_paid|nex_mfa_[a-z_]+)|nex_view_log|nex_live_ping|staff_credentials|staff_avatars|training_quiz_results|custom_quiz_results)(\?|$)/;
async function api(path, opt) {
  opt = opt || {};
  if (ME.viewOnly && opt.method && !/^(GET|HEAD)$/.test(opt.method) && !VO_OPEN.test(path)) throw new Error(VIEW_ONLY_MSG);
  const doFetch = async () => fetch(SB + '/rest/v1/' + path, {
    method: opt.method || 'GET',
    headers: Object.assign({ apikey: KEY, Authorization: 'Bearer ' + await bearer(), 'Content-Type': 'application/json' }, opt.headers || {}),
    body: opt.body == null ? undefined : JSON.stringify(opt.body)
  });
  let r;
  if (opt.method && opt.method !== 'GET' && typeof lvWrote === 'function') lvWrote();   /* live updates: skip the echo of my own save */
  if (/^rpc\//.test(path)) undoBad();   /* a server procedure can do anything (send an email, queue a job), so a toast after one never offers Undo */
  try { r = await doFetch(); } catch (e) { if (e && e.message === 'session') throw e; throw offlineError(); }
  if (r.status === 401) { if (await refreshToken()) r = await doFetch(); else { endSession(); throw new Error('session'); } }
  if (!r.ok) {
    let m = ''; try { const j = await r.json(); m = j.message || j.hint || j.details || ''; } catch (e) {}
    if (/row-level security|permission denied/i.test(m)) m = "You don't have permission to do that.";
    else if (r.status >= 500) m = 'Yatra had a problem saving or loading that. Try again in a moment.';
    const err = new Error(m || ('Request failed (' + r.status + ')')); err.status = r.status; throw err;
  }
  return r;
}
/* call a Yatra edge function as the signed-in person; failures keep the function's own message and code */
async function fn(name, body) {
  if (ME.viewOnly && !(body && (body.preview || body.quota))) throw new Error(VIEW_ONLY_MSG);
  undoBad();   /* an edge function sends emails and the like: that cannot be undone */
  const doFetch = async () => fetch(SB + '/functions/v1/' + name, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + await bearer(), 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  let r;
  try { r = await doFetch(); } catch (e) { if (e && e.message === 'session') throw e; throw offlineError(); }
  if (r.status === 401 && await refreshToken()) r = await doFetch();
  let j = null; try { j = await r.json(); } catch (e) {}
  if (!r.ok) { const err = new Error((j && (j.message || j.error)) || 'Request failed (' + r.status + ')'); err.status = r.status; err.code = j && j.error; throw err; }
  return j;
}
async function sel(table, q) { const r = await api(table + (q ? '?' + q : '')); return r.json(); }
async function selPage(table, q, from, to) {
  const r = await api(table + (q ? '?' + q : ''), { headers: { Range: from + '-' + to, 'Range-Unit': 'items', Prefer: 'count=exact' } });
  const cr = r.headers.get('Content-Range') || '';
  const total = parseInt(cr.split('/')[1], 10);
  return { rows: await r.json(), total: isNaN(total) ? null : total };
}
async function count(table, q, col) {
  const r = await api(table + '?select=' + (col || 'id') + (q ? '&' + q : ''), { method: 'HEAD', headers: { Prefer: 'count=exact', Range: '0-0', 'Range-Unit': 'items' } });
  const cr = r.headers.get('Content-Range') || '';
  const n = parseInt(cr.split('/')[1], 10);
  return isNaN(n) ? 0 : n;
}
/* a person is a student once they have paid $200 or more in total; before that they are a lead */
const STUDENT_MIN = 200;
function kindOf(sp) { if (Array.isArray(sp)) sp = sp[0]; return sp && Number(sp.paid_total) >= STUDENT_MIN ? 'student' : 'lead'; }
async function countKind(kind) {
  const r = await api('nex_students?select=id,nex_student_paid!inner(paid_total)&deleted_at=is.null&nex_student_paid.paid_total=' + (kind === 'lead' ? 'lt.' : 'gte.') + STUDENT_MIN, { method: 'HEAD', headers: { Prefer: 'count=exact', Range: '0-0', 'Range-Unit': 'items' } });
  const n = parseInt((r.headers.get('Content-Range') || '').split('/')[1], 10);
  return isNaN(n) ? 0 : n;
}
async function selAll(table, q) {
  let out = [], from = 0; const step = 1000;
  for (;;) {
    const r = await api(table + (q ? '?' + q : ''), { headers: { Range: from + '-' + (from + step - 1), 'Range-Unit': 'items' } });
    const rows = await r.json(); out = out.concat(rows);
    if (rows.length < step) break;
    from += step;
  }
  return out;
}
async function ins(table, row, noReturn) {
  const r = await api(table, { method: 'POST', body: row, headers: { Prefer: noReturn ? 'return=minimal' : 'return=representation' } });
  if (noReturn) { if (row && !Array.isArray(row) && row.id) undoNote({ t: 'ins', table, id: row.id }); else undoBad(); return null; }
  const j = await r.json(); if (Array.isArray(j) && j.length && j.every(x => x && x.id)) j.forEach(x => undoNote({ t: 'ins', table, id: x.id })); else undoBad();
  return Array.isArray(j) ? j[0] : j;
}
async function upd(table, match, patch) {
  const before = await undoSnap(table, match, patch);   /* the old values, so the change can be put back */
  const r = await api(table + '?' + match, { method: 'PATCH', body: patch, headers: { Prefer: 'return=representation' } });
  const j = await r.json();
  if (!j.length) throw new Error('Nothing was changed. You may not have permission for that.');
  if (before) undoNote({ t: 'upd', table, rows: before.filter(o => j.some(n => n.id === o.id)) }); else undoBad();
  return j[0];
}
async function del(table, match) {
  const r = await api(table + '?' + match, { method: 'DELETE', headers: { Prefer: 'return=representation' } });
  const j = await r.json();
  if (!j.length) throw new Error('Nothing was deleted. Only admins can delete.');
  undoNote({ t: 'del', table, rows: j });
}
/* ---------- Undo: every change a person makes is remembered for a few seconds so its toast can offer Undo ----------
   upd, ins and del note what they did and how to put it back. A new click, change or submit starts a clean list. A server procedure or an
   edge function (emails, queued jobs) marks the action as not undoable, so a toast after one never offers Undo. */
const UNDO = { ops: [], bad: false, at: 0, mute: 0 };
function undoFresh() { UNDO.ops = []; UNDO.bad = false; UNDO.at = 0; }
function undoNote(op) { if (UNDO.mute) return; UNDO.ops.push(op); UNDO.at = Date.now(); }
function undoBad() { if (UNDO.mute) return; UNDO.bad = true; UNDO.at = Date.now(); }
async function undoSnap(table, match, patch) {
  if (UNDO.mute) return null;
  try {
    const rows = await sel(table, match + '&select=' + ['id'].concat(Object.keys(patch)).join(',') + '&limit=201');
    return rows.length && rows.length <= 200 && rows.every(r => r.id) ? rows : null;
  } catch (e) { return null; }
}
/* the Undo for the changes noted since the last click, or null when there is nothing safe to put back */
function undoTake() {
  const ops = UNDO.ops, ok = ops.length && !UNDO.bad && Date.now() - UNDO.at < 6000 && ops.length <= 40;
  undoFresh();
  if (!ok) return null;
  return async () => {
    let missed = 0;
    UNDO.mute++;
    try {
      for (const op of ops.slice().reverse()) {
        const hit = async r => { const j = await r.json(); if (!j.length) missed++; };
        if (op.t === 'upd') for (const o of op.rows) { const { id, ...old } = o; await hit(await api(op.table + '?id=eq.' + id, { method: 'PATCH', body: old, headers: { Prefer: 'return=representation' } })); }
        else if (op.t === 'ins') await hit(await api(op.table + '?id=eq.' + op.id, { method: 'DELETE', headers: { Prefer: 'return=representation' } }));
        else if (op.t === 'del') await api(op.table, { method: 'POST', body: op.rows, headers: { Prefer: 'return=minimal' } });
      }
    } finally { UNDO.mute--; }
    if (missed) { if (typeof render === 'function') render(); throw new Error(missed === ops.length ? "Could not undo that. You may not have permission to." : 'Part of that could not be undone. You may not have permission for the rest.'); }
    if (typeof render === 'function') render();
  };
}
['click', 'change', 'submit'].forEach(ev => document.addEventListener(ev, () => { if (!UNDO.mute) undoFresh(); }, true));
function inList(ids) { return '(' + ids.map(i => '"' + String(i).replace(/"/g, '') + '"').join(',') + ')'; }
/* the parts of an or=(...) filter that find a person by what was typed: the whole text in first name, last name or email, and, when several words
   were typed, every word somewhere in first name, last name or email (so "Aabiskar Thapa Magar" finds first name "Aabiskar Thapa" + last name "Magar") */
function personSearchParts(q, digits) {
  const toks = String(q || '').split(/\s+/).filter(Boolean), one = t => 'or(first_name.ilike.*' + t + '*,last_name.ilike.*' + t + '*,email.ilike.*' + t + '*)';
  const parts = ['first_name.ilike.*' + q + '*', 'last_name.ilike.*' + q + '*', 'email.ilike.*' + q + '*'];
  if (toks.length > 1) parts.push('and(' + toks.map(one).join(',') + ')');
  if (digits && digits.length >= 4) parts.push('phone.ilike.*' + digits + '*');
  return parts;
}
/* strip what would break a search: , ( ) * % \ : " for the filter itself, and & # + = ? ; which would cut or change the web address the search travels in (a payer name like "A & B" used to give "failed to parse logic tree") */
function safeQ(q) { return String(q || '').replace(/[,()*%\\:"&#+=?;]/g, ' ').replace(/\s+/g, ' ').trim(); }
