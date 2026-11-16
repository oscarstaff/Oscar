'use strict';
/* pl-motion.js · Pipe-Line · Motion: sliding tabs and page arrivals.
   One of the Pipe-Line files loaded by nex.html (list and order: PL_FILES in the loader). All of them share one global scope. */
/* ---------- Motion: tabs slide, pages arrive, nothing snaps ----------
   Corporate personality: one easing (ease-out, no overshoot), three speeds (quick 110, standard 260-320, slow 400).
   - The underline under the active tab, and the thumb behind the active pill button, are ONE element that glides to the next one.
     It starts moving on press, not on release, and it can be interrupted: a new press just re-targets it from where it is.
   - A page leaves quickly (110ms, ease-in) and the next one rises into place (280ms, ease-out) top to bottom, 45ms apart.
   - Content inside a page (record tabs, the pill-button lists) does the same short rise when it changes.
   Everything here is progressive: without it, tabs and pages still work, they just do not glide. */
const INK = [
  { box: '.nx-nav', item: 'a[aria-current="page"], #navMisc.on', pad: 10 },
  { box: '.nx-tabs', item: '.nx-tab[aria-selected="true"]', pad: 8 },
  { box: '.nx-seg', item: 'button[aria-pressed="true"]', pad: 0 }
];
function inkPlace(box, it, pad) {
  if (!it || !it.offsetWidth) return;
  const x = it.offsetLeft + pad, w = Math.max(0, it.offsetWidth - pad * 2), y = it.offsetTop, h = it.offsetHeight;
  const s = box.style;
  if (s.getPropertyValue('--ink-x') === x + 'px' && s.getPropertyValue('--ink-w') === w + 'px' && s.getPropertyValue('--ink-y') === y + 'px') return;
  s.setProperty('--ink-x', x + 'px'); s.setProperty('--ink-w', w + 'px'); s.setProperty('--ink-y', y + 'px'); s.setProperty('--ink-h', h + 'px');
  if (!box.dataset.ink) {
    /* first placement: put it there without gliding from nowhere, then allow gliding from the next change on */
    box.dataset.ink = 'set'; void box.offsetWidth;
    requestAnimationFrame(() => { box.dataset.ink = 'on'; });
  }
}
function inkRefresh() {
  INK.forEach(k => document.querySelectorAll(k.box).forEach(box => {
    if (box.closest('[hidden]')) return;
    inkPlace(box, box.querySelector(k.item), k.pad);
  }));
}
/* a short rise for content that has just changed. Restarting it mid-way is fine. */
function swapIn(el) {
  if (!el || window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  el.classList.remove('nx-swapin'); void el.offsetWidth; el.classList.add('nx-swapin');
  setTimeout(() => el.classList.remove('nx-swapin'), 360);
}
let swapWatch = null, inkQueued = false;
function motionInit() {
  if (document.body.dataset.motion) return; document.body.dataset.motion = '1';
  const queue = () => { if (inkQueued) return; inkQueued = true; requestAnimationFrame(() => { inkQueued = false; inkRefresh(); }); };
  /* press: the indicator moves now. If the press turns out not to be a click, the next refresh puts it back. */
  document.addEventListener('pointerdown', e => {
    const t = e.target.closest && e.target.closest('.nx-nav a, .nx-nav #navMisc, .nx-tab, .nx-seg button'); if (!t) return;
    const k = INK.find(x => t.closest(x.box)); if (!k) return;
    const box = t.closest(k.box); if (box.dataset.ink === 'on' || box.dataset.ink === 'set') inkPlace(box, t, k.pad);
    if (!t.matches('.nx-nav a, .nx-nav #navMisc')) {
      const card = t.closest('.nx-card'); if (card) swapWatch = { card, until: Date.now() + 900, seen: new WeakSet() };
    }
  }, true);
  document.addEventListener('pointerup', () => setTimeout(inkRefresh, 450), true);
  document.addEventListener('pointercancel', () => setTimeout(inkRefresh, 50), true);
  new MutationObserver(muts => {
    if (swapWatch && Date.now() < swapWatch.until) {
      for (const m of muts) {
        if (m.type !== 'childList' || !m.addedNodes.length) continue;
        const t = m.target; if (!(t instanceof Element) || !swapWatch.card.contains(t) || t.closest('.nx-toolbar, .nx-tabs, .nx-seg, .nx-card-h')) continue;
        if (swapWatch.seen.has(t)) continue; swapWatch.seen.add(t); swapIn(t);
      }
    }
    queue();
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-pressed', 'aria-selected', 'aria-current', 'class', 'hidden'] });
  let rz = 0;
  window.addEventListener('resize', () => { document.documentElement.classList.add('nx-ink-still'); clearTimeout(rz); rz = setTimeout(() => { inkRefresh(); document.documentElement.classList.remove('nx-ink-still'); }, 160); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { document.documentElement.classList.add('nx-ink-still'); inkRefresh(); setTimeout(() => document.documentElement.classList.remove('nx-ink-still'), 60); });
  queue();
}
