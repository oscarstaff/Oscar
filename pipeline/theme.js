/* Yatra appearance: glass look, Bright (default) or Dark.
   Loaded from <head> so the mode is set before first paint. Self-contained: no globals, no app helpers. */
(function () {
  var KEY = 'yl_theme', MODES = ['glass', 'glass-dark'], DEFAULT = 'glass';
  var LEGACY = { light: 'glass', dark: 'glass-dark' };   /* earlier saved choices carry over to the glass equivalent */
  var BAR = { 'glass': '#1d3a78', 'glass-dark': '#070d1a' };
  var root = document.documentElement;
  function saved() { try { var v = localStorage.getItem(KEY); v = LEGACY[v] || v; return MODES.indexOf(v) > -1 ? v : DEFAULT; } catch (e) { return DEFAULT; } }
  function apply(mode) {
    root.setAttribute('data-theme', mode);
    var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', BAR[mode]);
    var bs = document.querySelectorAll('[data-theme-set]');
    for (var i = 0; i < bs.length; i++) bs[i].setAttribute('aria-pressed', bs[i].getAttribute('data-theme-set') === mode ? 'true' : 'false');
  }
  /* Lite effects (no blur or gradients): the saved choice, otherwise automatic on low-end machines */
  var FXKEY = 'yl_fx';
  function lowEnd() { try { var n = navigator; return !!((n.hardwareConcurrency && n.hardwareConcurrency <= 4) || (n.deviceMemory && n.deviceMemory <= 4)); } catch (e) { return false; } }
  function fxLite() { try { var v = localStorage.getItem(FXKEY); if (v === 'lite') return true; if (v === 'full') return false; } catch (e) {} return lowEnd(); }
  function applyFx() {
    var lite = fxLite(); root.setAttribute('data-fx', lite ? 'lite' : 'full');
    var bs = document.querySelectorAll('[data-fx-toggle]'); for (var i = 0; i < bs.length; i++) bs[i].setAttribute('aria-pressed', lite ? 'true' : 'false');
  }
  applyFx();
  apply(saved());
  document.addEventListener('DOMContentLoaded', function () { apply(root.getAttribute('data-theme') || DEFAULT); applyFx(); });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-fx-toggle]'); if (!b) return;
    try { localStorage.setItem(FXKEY, fxLite() ? 'full' : 'lite'); } catch (er) {}
    applyFx();
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-theme-set]'); if (!b) return;
    var mode = b.getAttribute('data-theme-set'); if (MODES.indexOf(mode) < 0) return;
    try { localStorage.setItem(KEY, mode); } catch (er) {}
    if (root.getAttribute('data-theme') === mode) return;
    var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (calm) { apply(mode); return; }
    /* Cross-fade the whole page so a gradient or backdrop blur never pops. View Transitions where supported,
       otherwise a short colour transition on everything. */
    if (document.startViewTransition) { document.startViewTransition(function () { apply(mode); }); return; }
    root.classList.add('yl-fade'); apply(mode);
    setTimeout(function () { root.classList.remove('yl-fade'); }, 520);
  });
  window.addEventListener('storage', function (e) { if (e.key === KEY) apply(saved()); if (e.key === FXKEY) applyFx(); }); /* other tab changed it */
})();
