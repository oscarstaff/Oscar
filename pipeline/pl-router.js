'use strict';
/* pl-router.js · YatraLine · router, tabs, press feedback and boot().
   One of the YatraLine files loaded by nex.html (list and order: PL_FILES in the loader). All of them share one global scope. */
/* ---------- router ---------- */
const ROUTES = [];
function route(re, fn) { ROUTES.push({ re, fn }); }
let navToken = 0, lastRouteH = null, afters = [], viewWaits = [];
/* tabs: Admin is only listed for hub admins. Follow-ups has a page but no tab. */
const NAV = [['#/', 'Overview'], ['#/leads', 'Leads'], ['#/students', 'Students'], ['#/payments', 'Payments'], ['#/firstaid', 'First Aid'], ['#/placement', 'Placement'], ['misc', 'Misc', 'menu'], ['#/admin', 'Admin', 'admin']];
/* the staff pages copied from Nexus sit together under the Misc button */
const NAV_ICO = { '#/': 'home', '#/leads': 'user', '#/students': 'cap', '#/payments': 'cash', '#/firstaid': 'aid', '#/placement': 'pin', '#/admin': 'admin' };
const MISC_ICO = { '#/quizzes': 'book', '#/documents': 'doc', '#/calls': 'phone', '#/logbooks': 'notebook', '#/teamreport': 'users', '#/convreport': 'trend', '#/achievements': 'trophy' };
const MISC = [['#/quizzes', 'Quizzes'], ['#/documents', 'Documents'], ['#/calls', 'Calls'], ['#/logbooks', 'Logbook receipts'], ['#/teamreport', 'Team report'], ['#/convreport', 'Conversion report'], ['#/achievements', 'Achievements']];
/* icon and title per section, so a loading page can show its real heading straight away */
const HEADS = { '/': ['home', 'Overview'], '/leads': ['user', 'Leads'], '/students': ['cap', 'Students'], '/search': ['search', 'Search'], '/payments': ['cash', 'Payment queue'], '/firstaid': ['aid', 'First Aid and CPR'], '/placement': ['pin', 'Placement'], '/followups': ['bell', 'Things to follow up'], '/admin': ['admin', 'Lists and settings'], '/quizzes': ['book', 'Quizzes'], '/documents': ['doc', 'Documents'], '/calls': ['phone', 'Calls'], '/logbooks': ['notebook', 'Logbook receipts'], '/teamreport': ['users', 'Team report'], '/convreport': ['trend', 'Conversion report'], '/profile': ['user', 'Profile'], '/achievements': ['trophy', 'Team achievements'], '/staff': ['user', 'Profile'] };
function baseOf(h) { return '/' + ((h.split('/')[1] || '').split('?')[0]); }
function isRecord(h) { return /^\/students\/[0-9a-f-]{36}$/.test(h); }
/* after a page paints: name it for the browser tab and screen readers, and move keyboard focus to it when the page (not just its data) changed */
function tidyView(v) { v.querySelectorAll('th:not([scope])').forEach(th => th.setAttribute('scope', 'col')); }
function pageArrived(h) {
  const hd = HEADS[baseOf(h)];
  document.title = (hd && !isRecord(h) ? hd[1] + ' · ' : '') + 'YatraLine';
  if (lastRouteH !== null && lastRouteH.split('?')[0] !== h.split('?')[0]) { const v = $('#view'); if (v && !modalStack.length) { try { v.focus({ preventScroll: true }); } catch (e) {} } }
  lastRouteH = h;
}
function go(h) { if (location.hash === h) render(); else location.hash = h; }
/* The tab bar is built once and only the highlight moves, so it never flickers between pages.
   setNav('!/leads') forces a tab; a person's record keeps the Leads or Students tab it was opened from until the record says which it is. */
function setNav(h) {
  const nav = $('#nav'); if (!nav) return;
  if (!nav.dataset.built) {
    nav.innerHTML = NAV.filter(n => n[2] !== 'admin' || ME.admin).map(([href, label, tag]) => tag === 'menu' ? '<button type="button" class="nx-navbtn" id="navMisc" aria-haspopup="menu" aria-expanded="false" aria-controls="miscMenu">' + ico('grid') + label + ico('chev') + '</button>' : '<a href="' + href + '" data-k="/' + (href.split('/')[1] || '') + '">' + ico(NAV_ICO[href] || 'list') + label + '</a>').join('');
    miscInit();
    nav.dataset.built = '1';
  }
  let cur;
  if (h[0] === '!') cur = h.slice(1);
  else if (isRecord(h)) { const on = $('a[aria-current="page"]', nav); cur = on && (on.dataset.k === '/leads' || on.dataset.k === '/students') ? on.dataset.k : ''; }
  else cur = baseOf(h);
  $$('a', nav).forEach(a => { if (a.dataset.k === cur) { if (a.getAttribute('aria-current') !== 'page') a.setAttribute('aria-current', 'page'); } else a.removeAttribute('aria-current'); });
  const mb = $('#navMisc'); if (mb) { const on = MISC.some(x => x[0] === '#' + cur); if (on) { if (!mb.classList.contains('on')) mb.classList.add('on'); } else mb.classList.remove('on'); }
  miscClose();
}
/* Misc menu. It is fixed to the page (not inside the scrolling tab bar, which would clip it) and opens from the button it belongs to. */
function miscClose(refocus) {
  const m = $('#miscMenu'), b = $('#navMisc'); if (!m || m.hidden) return;
  m.hidden = true; if (b) { b.setAttribute('aria-expanded', 'false'); if (refocus) b.focus(); }
}
function miscInit() {
  const b = $('#navMisc'); if (!b || b.dataset.bound) return; b.dataset.bound = '1';
  let m = $('#miscMenu');
  if (!m) { m = document.createElement('div'); m.id = 'miscMenu'; m.className = 'nx-menu nx-noprint'; m.setAttribute('role', 'menu'); m.setAttribute('aria-label', 'Misc'); m.hidden = true; document.body.appendChild(m); }
  const items = () => $$('a', m);
  const open = focusLast => {
    const cur = '#' + baseOf(location.hash.replace(/^#/, '') || '/');
    m.innerHTML = MISC.map(x => '<a role="menuitem" tabindex="-1" href="' + x[0] + '"' + (x[0] === cur ? ' aria-current="page"' : '') + '>' + ico(MISC_ICO[x[0]] || 'list') + x[1] + '</a>').join('');
    const r = b.getBoundingClientRect();
    m.hidden = false; m.style.top = Math.round(r.bottom + 4) + 'px';
    m.style.left = Math.round(Math.max(8, Math.min(r.left, window.innerWidth - m.offsetWidth - 8))) + 'px';
    b.setAttribute('aria-expanded', 'true');
    const it = items(); if (it.length) it[focusLast ? it.length - 1 : 0].focus({ preventScroll: true });
  };
  b.addEventListener('click', () => { if (m.hidden) open(); else miscClose(true); });
  b.addEventListener('keydown', e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(e.key === 'ArrowUp'); } });
  m.addEventListener('keydown', e => {
    const it = items(), i = it.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); it[(i + 1) % it.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); it[(i - 1 + it.length) % it.length].focus(); }
    else if (e.key === 'Home') { e.preventDefault(); it[0].focus(); }
    else if (e.key === 'End') { e.preventDefault(); it[it.length - 1].focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); miscClose(true); }
    else if (e.key === 'Tab') miscClose();
  });
  m.addEventListener('click', e => { if (e.target.closest('a')) miscClose(); });
  document.addEventListener('pointerdown', e => { if (!m.hidden && !m.contains(e.target) && !b.contains(e.target)) miscClose(); });
  window.addEventListener('resize', () => miscClose());
  window.addEventListener('scroll', () => miscClose(), { passive: true });
}
/* placeholder shaped like the page that is coming: real heading, then rows */
function skelRows(n) { return Array.from({ length: n }, (_, i) => '<div class="nx-skrow"><div class="nx-skel" style="width:' + [34, 52, 41, 60, 38, 47, 55, 36][i % 8] + '%"></div></div>').join(''); }
function skeleton(h) {
  if (isRecord(h) || baseOf(h) === '/staff') return '<div class="nx-skel" style="width:160px;height:12px"></div><div class="nx-card"><div class="nx-hl"><span class="nx-avatar"></span><div style="flex:1"><div class="nx-skel" style="width:90px"></div><div class="nx-skel" style="width:260px;height:28px;margin-top:10px"></div></div></div></div><div class="nx-card">' + skelRows(6) + '</div>';
  const base = baseOf(h), hd = HEADS[base];
  const title = base === '/' ? 'Welcome back, ' + ((ME.name || '').split(' ')[0] || '') : hd ? hd[1] : '';
  return (hd ? pageHead(hd[0], ' ', title, '') : '') + '<div class="nx-card"><div class="nx-toolbar" style="border-top:0"><div class="nx-skel" style="width:240px;height:28px"></div></div>' + skelRows(8) + '</div>';
}
/* a page registers the data it is still fetching; the page is only shown once that has arrived, so it appears whole instead of piece by piece */
function viewWait(p) { if (p && p.then) viewWaits.push(Promise.resolve(p).catch(() => {})); return p; }
/* while a list reloads (filter, next page) keep the old rows dimmed in place instead of collapsing the table */
function holdBody(el) {
  if (!el) return;
  if (el.children.length && !el.querySelector('.nx-skrow')) {
    el.classList.add('nx-reloading');
    if (window.MutationObserver) { const mo = new MutationObserver(() => { el.classList.remove('nx-reloading'); mo.disconnect(); }); mo.observe(el, { childList: true }); }
  } else el.innerHTML = skelRows(6);
}
let firstPaint = true;
async function render() {
  const h = location.hash.replace(/^#/, '') || '/';
  const tok = ++navToken;
  const r = ROUTES.find(x => x.re.test(h));
  if (!r) return go('#/');
  const m = h.match(r.re), same = lastRouteH === h, sk = $('#viewSkel');
  document.body.classList.add('nx-busy'); setNav(h);
  /* the page you are on stays put for a moment; only a slow load swaps to the placeholder. A refresh of the same page never does. */
  let skShown = false, fin = false;   /* fin: this render is over, so a placeholder that was still waiting its 110ms must not appear */
  const skT = same ? 0 : setTimeout(() => {
    if (tok !== navToken) return;
    const cur = $$('main.nx-main').filter(el => el !== sk && !el.hidden);
    const show = () => { if (tok !== navToken || fin) { cur.forEach(el => el.classList.remove('nx-leaving')); return; } skShown = true; sk.innerHTML = skeleton(h); sk.hidden = false; cur.forEach(el => { el.hidden = true; el.classList.remove('nx-leaving'); }); window.scrollTo(0, 0); };
    if (cur.length && !firstPaint) { cur.forEach(el => el.classList.add('nx-leaving')); setTimeout(show, 110); } else show();
  }, firstPaint ? 0 : 450);
  const done = () => { fin = true; clearTimeout(skT); sk.hidden = true; sk.innerHTML = ''; document.body.classList.remove('nx-busy'); firstPaint = false; };
  try {
    await loadRef();
    afters = []; viewWaits = [];
    const html = await r.fn(m, tok);
    if (tok !== navToken) return;
    if (html == null) { done(); const cur = $('#viewOld') || $('#view'); if (cur) cur.hidden = false; return; }
    /* build the new page off screen, in front of the old one in the document so its ids win, and swap when its first data is in */
    const old = $('#view');
    const nv = document.createElement('main'); nv.className = 'nx-main'; nv.tabIndex = -1; nv.hidden = true; nv.innerHTML = html;
    old.id = 'viewOld'; nv.id = 'view'; old.parentNode.insertBefore(nv, old);
    tidyView(nv);
    const fs = afters; afters = [];
    fs.forEach(f => { try { f(); } catch (e) { console.warn('after', e); } });
    const ws = viewWaits; viewWaits = [];
    if (ws.length) await Promise.race([Promise.all(ws), new Promise(res => setTimeout(res, 4000))]);
    if (!same && !firstPaint && !skShown && old && !old.hidden) { old.classList.add('nx-leaving'); await new Promise(res => setTimeout(res, 110)); }
    if (tok !== navToken) { old.classList.remove('nx-leaving'); nv.remove(); if (!$('#view')) { const o = $('#viewOld'); if (o) o.id = 'view'; } return; }
    const y = same ? window.scrollY : 0;
    done();
    $$('main.nx-main').forEach(el => { if (el !== nv && el !== sk) el.remove(); });
    nv.hidden = false; if (!same) { nv.classList.add('nx-enter'); if (skShown) nv.classList.add('nx-enter-sk'); }
    try { motionInit(); } catch (e) {}
    window.scrollTo(0, y); pageArrived(h);
  } catch (e) {
    if (tok !== navToken || e.message === 'session') return;
    done();
    $$('main.nx-main').forEach((el, i) => { if (el !== sk && el.id !== 'view') el.remove(); });
    const v = $('#view'); v.hidden = false;
    v.innerHTML = '<div class="nx-card"><div class="nx-empty" role="alert"><b>Could not load this page</b>' + esc(e.message) + '<div style="margin-top:14px"><button class="nx-btn" id="retryLoad">Try again</button></div></div></div>';
    const rb = $('#retryLoad', v); if (rb) rb.onclick = () => { lastRouteH = null; render(); };
  }
}
function afterRender(fn) { afters.push(fn); }
function pageHead(icon, eyebrow, title, actions) {
  return '<div class="nx-card nx-pagehead"><div class="nx-objico">' + ico(icon) + '</div><div><div class="nx-eyebrow">' + esc(eyebrow) + '</div><h1 class="nx-title">' + esc(title) + '</h1></div><div class="nx-grow"></div><div class="nx-btnrow">' + (actions || '') + '</div></div>';
}
function empty(t, s, act) { return '<div class="nx-empty"><b>' + esc(t) + '</b>' + esc(s || '') + (act ? '<div class="nx-empty-act">' + act + '</div>' : '') + '</div>'; }

/* ---------- press feedback ----------
   A control reacts the moment it is pressed (not on release) and holds the pressed look long enough to be seen on a quick tap. */
function pressFeedback() {
  const SEL = '.nx-btn,.nx-chip,.nx-seg button,.nx-tab,.nx-nav a,.nx-navbtn,.nx-menu a,.nx-att,.nx-day,.nx-pick,.nx-sec-h';
  let el = null, t0 = 0;
  const up = () => { if (!el) return; const e = el, wait = Math.max(0, 90 - (performance.now() - t0)); el = null; setTimeout(() => e.classList.remove('is-down'), wait); };
  document.addEventListener('pointerdown', e => { if (e.button) return; const t = e.target.closest && e.target.closest(SEL); if (!t || t.disabled) return; up(); el = t; t0 = performance.now(); t.classList.add('is-down'); }, true);
  ['pointerup', 'pointercancel', 'dragend'].forEach(n => document.addEventListener(n, up, true));
  document.addEventListener('pointerout', e => { if (el && e.target === el) up(); }, true);
}

/* ---------- boot ---------- */
async function boot() {
  ME.name = ss.get('nex_user'); ME.admin = ss.get('nex_is_admin') === '1';
  watchSession();
  setInterval(() => { const t = ss.get('nex_sb_at'); if (!locked && t && !tokenAlive(t, 120000)) refreshToken(); }, 60000);
  await sessionAlive();
  if (locked) return;
  setInterval(sessionAlive, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sessionAlive(); });
  await mfaGate();
  if (locked) return;
  $('#whoName').textContent = ME.name || 'Signed in'; $('#whoAva').textContent = initials(ME.name);
  $('#app').hidden = false;
  { const sk = $('#skipLink'); if (sk) sk.addEventListener('click', () => { const v = $('#view'); if (v) v.focus(); }); }
  $('#gSearch').addEventListener('submit', e => { e.preventDefault(); const q = $('#gSearchIn').value.trim(); go('#/search' + (q ? '?q=' + encodeURIComponent(q) : '')); });
  window.addEventListener('hashchange', render);
  pressFeedback();
  nexiInit();
  try { await loadMe(); ME.team = STAFF.team || ''; } catch (e) { ME.team = ''; }   /* the team decides who may mark attendance and handle payments */
  render();
}

/* press / to jump to search */
document.addEventListener('keydown', e => {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target, tag = t && t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable) || modalStack.length) return;
  const i = document.querySelector('#gSearch input'); if (i) { e.preventDefault(); i.focus(); i.select(); }
});
