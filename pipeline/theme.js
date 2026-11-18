/* YatraLine colour modes: light (default), dark, glass (translucent).
   Loaded from <head> so the mode is set before first paint. Self-contained: no globals, no app helpers. */
(function () {
  var KEY = 'yl_theme', MODES = ['light', 'dark', 'glass'];
  var BAR = { light: '#0b1f4b', dark: '#070d1a', glass: '#1d3a78' };
  var root = document.documentElement;
  function saved() { try { var v = localStorage.getItem(KEY); return MODES.indexOf(v) > -1 ? v : 'light'; } catch (e) { return 'light'; } }
  function apply(mode) {
    root.setAttribute('data-theme', mode);
    var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', BAR[mode]);
    var bs = document.querySelectorAll('[data-theme-set]');
    for (var i = 0; i < bs.length; i++) bs[i].setAttribute('aria-pressed', bs[i].getAttribute('data-theme-set') === mode ? 'true' : 'false');
  }
  apply(saved());
  document.addEventListener('DOMContentLoaded', function () { apply(root.getAttribute('data-theme') || 'light'); });
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
  window.addEventListener('storage', function (e) { if (e.key === KEY) apply(saved()); }); /* other tab changed it */
})();
