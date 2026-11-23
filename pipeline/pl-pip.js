'use strict';
/* pl-pip.js · Yatra · Pip, the pixel Tibetan mastiff.
   One of the Yatra files loaded by nex.html (list and order: PL_FILES in the loader). All of them share one global scope. */
/* =========================================================
   Pip: the pixel Tibetan mastiff who answers "how do I...".
   Alive on purpose: blinks, watches the pointer, perks up and pants when hovered,
   gets petted, barks when opened, nods at answers, falls asleep when nobody is around,
   and offers one short tip per page, once a session.
   ========================================================= */
const PIP_MAP = [
  '......KKKKKK', '....KKBBBBBB', '..KKBBBBBBBB', '.KMKBBBBBBBB', 'KMMKBBBBBBBB', 'KMMKBBBBBBBB',
  'KMMKBBBBBBBB', 'KMMKBBTTBBBB', 'KMBKBBTTBBBB', 'KMBKBBEEBBBB', 'KBBKBBEEBBBB', '.KBKBBBBLLNN',
  '..KKBBBLLLNN', '..KKBBBLLLLK', '..KKBBLLLLLL', '.KMKBBLLLLPP', 'KMMKKBLLLTPP', 'KMMMMBBTTTTT',
  'KMBMMBBBBBTT', '.KMBMMBMBBBB', '..KMBMMBMBBB', '...KKMMKMKKK', '....KK.KK..K', '............'
];
const PIP_COL = { K: '#14110f', M: '#4e4038', B: '#28211e', T: '#c48642', L: '#e2b573', N: '#0a0a0c', P: '#ff7894', E: '#0a0a0c' };
let PIP_BODY = '';
function pipBuild() {
  const layers = { earL: [], earR: [], base: [], tongue: [], eyes: [] };
  const grid = [];
  PIP_MAP.forEach((r, y) => { const row = []; for (let x = 0; x < 12; x++) row[x] = r[x]; for (let x = 0; x < 12; x++) row[23 - x] = r[x]; grid.push(row); });
  const runs = (list) => {                                   /* merge horizontal runs of one colour into single rects */
    const by = {}; list.forEach(p => { (by[p.y + ':' + p.c] = by[p.y + ':' + p.c] || []).push(p.x); });
    return Object.keys(by).map(k => { const [y, c] = k.split(':'); const xs = by[k].sort((a, b) => a - b); let out = '', s = xs[0], prev = xs[0];
      for (let i = 1; i <= xs.length; i++) { if (xs[i] !== prev + 1) { out += '<rect x="' + s + '" y="' + y + '" width="' + (prev - s + 1) + '" height="1" fill="' + PIP_COL[c] + '"/>'; s = xs[i]; } prev = xs[i]; } return out; }).join('');
  };
  grid.forEach((row, y) => row.forEach((c, x) => {
    if (!c || c === '.') return;
    if (c === 'E') { layers.eyes.push({ x, y, c }); layers.base.push({ x, y, c: 'B' }); return; }
    if (c === 'P') { layers.tongue.push({ x, y, c }); layers.base.push({ x, y, c: 'L' }); return; }
    const ear = y >= 3 && y <= 12 && (x <= 3 || x >= 20);
    (ear ? (x <= 3 ? layers.earL : layers.earR) : layers.base).push({ x, y, c });
  }));
  const glint = '<rect x="6" y="9" width="1" height="1" fill="#fff"/><rect x="17" y="9" width="1" height="1" fill="#fff"/>';
  const shut = '<rect x="6" y="10" width="2" height="1" fill="#14110f"/><rect x="16" y="10" width="2" height="1" fill="#14110f"/>';
  PIP_BODY = '<g class="pip-b"><g transform="translate(4 5)"><g class="pip-earL">' + runs(layers.earL) + '</g><g class="pip-earR">' + runs(layers.earR) + '</g>' + runs(layers.base) +
    '<g class="pip-tongue">' + runs(layers.tongue) + '</g><g class="pip-eyes">' + runs(layers.eyes) + glint + '</g><g class="pip-shut">' + shut + '</g></g></g>';
}
function pipSVG(extra) {
  if (!PIP_BODY) pipBuild();
  return '<svg class="pip ' + (extra || '') + '" viewBox="2 2.5 28 28" aria-hidden="true" focusable="false" shape-rendering="crispEdges">' + PIP_BODY + '</svg>';
}

const PIP_TIPS = [
  [/^#\/leads/, 'Tip: the Follow-up tag shows who is due a 1st, 2nd or 3rd follow-up. The Need to follow up tab lists everyone who missed, cancelled or moved a class.'],
  [/^#\/firstaid/, 'Tip: press Attended on a booking and your name is kept against it.'],
  [/^#\/calls/, 'Tip: log every call. A number we do not know becomes a lead flagged to you.'],
  [/^#\/payments/, 'Tip: a lead who pays $200 or more becomes a student on their own.'],
  [/^#\/logbooks/, 'Tip: add the receipt here and it shows in their Activity.']
];
function pipLife(fab, panel, first) {
  const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const all = () => $$('.pip');
  const mark = (cls, on) => all().forEach(s => s.classList.toggle(cls, on));
  const fx = document.createElement('div'); fx.id = 'pipFx'; fx.className = 'nx-noprint'; fx.setAttribute('aria-hidden', 'true'); document.body.appendChild(fx);
  let last = Date.now(), asleep = false, say = null, sayT = 0, lastTip = 0, dwell = 0;

  /* eyes follow the pointer, a pixel at a time */
  const look = (cx, cy) => {
    const r = fab.getBoundingClientRect(); const dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
    const nx = dx < -70 ? -1 : dx > 70 ? 1 : 0, ny = dy < -50 ? -1 : dy > 50 ? 1 : 0;
    $$('.pip-eyes').forEach(g => g.setAttribute('transform', 'translate(' + nx + ' ' + ny + ')'));
  };
  /* blinking, now and then twice */
  const blinkLoop = () => {
    setTimeout(() => {
      if (!asleep) { mark('blink', true); setTimeout(() => mark('blink', false), 130); if (Math.random() < 0.25) setTimeout(() => { mark('blink', true); setTimeout(() => mark('blink', false), 110); }, 280); }
      blinkLoop();
    }, 2300 + Math.random() * 4200);
  };
  const hearts = () => {
    for (let i = 0; i < 3; i++) setTimeout(() => {
      const h = document.createElement('span'); h.className = 'pip-heart'; h.style.setProperty('--dx', (i - 1) * 16 + 'px');
      h.innerHTML = '<svg viewBox="0 0 7 6" shape-rendering="crispEdges"><g fill="#ff5a7a"><rect x="1" y="0" width="2" height="1"/><rect x="4" y="0" width="2" height="1"/><rect x="0" y="1" width="7" height="2"/><rect x="1" y="3" width="5" height="1"/><rect x="2" y="4" width="3" height="1"/><rect x="3" y="5" width="1" height="1"/></g></svg>';
      fx.appendChild(h); setTimeout(() => h.remove(), 1200);
    }, i * 140);
  };
  const hush = () => { clearTimeout(sayT); if (say) { say.remove(); say = null; } };
  const speak = (text, ms) => {
    if (!panel.hidden || modalStack.length) return;
    hush(); say = document.createElement('div'); say.id = 'pipSay'; say.className = 'nx-noprint'; say.setAttribute('role', 'status');
    say.innerHTML = '<span></span><button type="button" aria-label="Dismiss">' + ico('x') + '</button>'; say.firstChild.textContent = text;
    say.onclick = e => { const dismiss = e.target.closest('button'); hush(); if (!dismiss) fab.click(); };
    document.body.appendChild(say); sayT = setTimeout(hush, ms || 7000);
  };
  const wake = () => { last = Date.now(); if (asleep) { asleep = false; mark('sleep', false); fab.classList.remove('sleep'); perk(); } };
  const perk = () => { mark('perk', true); setTimeout(() => { if (!fab.matches(':hover')) mark('perk', false); }, 900); };

  document.addEventListener('pointermove', e => { wake(); look(e.clientX, e.clientY); }, { passive: true });
  document.addEventListener('keydown', wake); document.addEventListener('pointerdown', wake);
  fab.addEventListener('pointerenter', () => { mark('perk', true); dwell = setTimeout(hearts, 900); });
  fab.addEventListener('pointerleave', () => { clearTimeout(dwell); mark('perk', false); });
  fab.addEventListener('click', () => { if (panel.hidden) return; hush(); fab.classList.remove('bark'); void fab.offsetWidth; fab.classList.add('bark'); setTimeout(() => fab.classList.remove('bark'), 560); hearts(); });
  panel.addEventListener('click', e => { if (e.target.closest('[data-q]')) { const s = panel.querySelector('.pip'); if (s) { s.classList.add('nod'); setTimeout(() => s.classList.remove('nod'), 600); } } });
  setInterval(() => { if (!asleep && Date.now() - last > 90000 && panel.hidden) { asleep = true; mark('sleep', true); fab.classList.add('sleep'); hush(); } }, 5000);
  fab.classList.toggle('pip-calm', reduce);

  window.addEventListener('hashchange', () => {
    const h = location.hash || ''; const t = PIP_TIPS.find(x => x[0].test(h)); if (!t) return;
    const seen = (sessionStorage.getItem('pip_tips') || '').split('|'); if (seen.indexOf(t[1]) >= 0 || Date.now() - lastTip < 45000) return;
    setTimeout(() => { if (!panel.hidden || modalStack.length || (location.hash || '') !== h) return; seen.push(t[1]); try { sessionStorage.setItem('pip_tips', seen.join('|')); } catch (e) { } lastTip = Date.now(); speak(t[1], 8000); }, 1400);
  });
  if (!sessionStorage.getItem('pip_hi')) { try { sessionStorage.setItem('pip_hi', '1'); } catch (e) { } setTimeout(() => { lastTip = Date.now(); speak('Hi' + (first ? ' ' + first : '') + '! I am Pip. Tap me if you get stuck.', 6500); }, 2500); }
  blinkLoop();
}
