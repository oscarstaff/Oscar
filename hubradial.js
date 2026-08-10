/* ═══════════════════════════════════════════════════════════════════════
   hubradial.js — the Nodes page as an actual node diagram
   Loaded by index.html:  <script src="hubradial.js?v=1"></script>

   Separate module by convention — see ARCHITECTURE.md.

   WHY
   The page is called "Nodes" and looked like a list of cards. This lays the
   apps out as a hub and spokes: one centre, a line to each app, apps sitting
   on the ring. The name and the picture finally agree.

   IT ENHANCES, IT DOESN'T REPLACE
   The existing .hub-card anchors are reused exactly as they are — same
   onclick, same access gating via style.display, same icons. This only
   positions them and draws the spokes behind. So nothing about who can see
   which app changes, and if this file fails to load the page falls back to
   the original grid on its own.

   NO TOP-LEVEL DECLARATIONS
   Everything lives inside the IIFE and one window property. Top-level
   let/const in a classic script is global to every other module — a
   duplicate there is a SyntaxError that stops the *other* file executing.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var CSS = `
  /* Radial layout only above 900px — below that the original grid is
     genuinely better, and a ring of cards on a phone is unusable. */
  @media (min-width: 900px){
    .hub-grid.hub-radial{
      position: relative;
      display: block;
      height: 600px;
      margin: 8px auto 0;
      max-width: 820px;
    }
    /* NODES, not cards.
       A 168px rectangle sitting on a ring still reads as a card — which is
       why the ring version looked like the grid version. The node is now a
       circle holding just the icon, with the label sitting outside it. That
       is what makes this read as a diagram at a glance. */
    .hub-radial .hub-card{
      position: absolute;
      width: 84px; height: 84px;
      padding: 0;
      margin: 0;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: translate(-50%, -50%);
      transition: transform .22s cubic-bezier(.2,.9,.3,1.15),
                  box-shadow .22s ease, border-color .22s ease, opacity .2s ease;
      z-index: 2;
      overflow: visible;
    }
    .hub-radial .hub-card:hover{
      border-color: var(--accent, #6366f1);
    }
    .hub-radial .hub-card-icon{
      margin: 0;
      width: 40px; height: 40px;
      display: flex; align-items: center; justify-content: center;
    }
    .hub-radial .hub-card-icon svg{ width: 26px; height: 26px; }
    /* Label hangs below the circle, outside it — so the circle stays a
       circle and long names don't squeeze the icon. */
    .hub-radial .hub-card-body{
      position: absolute;
      top: calc(100% + 9px);
      left: 50%;
      transform: translateX(-50%);
      width: 130px;
      text-align: center;
      pointer-events: none;
    }
    .hub-radial .hub-card-title{
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
    }
    .hub-radial .hub-card:hover{
      transform: translate(-50%, -50%) scale(1.045);
      z-index: 3;
    }
    /* The spokes sit behind everything and are purely decorative. */
    .hub-spokes{
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      pointer-events: none;
      z-index: 1;
    }
    .hub-spoke{
      stroke: var(--border-color, #d8dee9);
      stroke-width: 2.5;
      stroke-linecap: round;
      transition: stroke .22s ease, stroke-width .22s ease;
    }
    .hub-spoke.lit{ stroke: var(--accent, #6366f1); stroke-width: 3.5; }
    /* Spokes draw outward from the core when the page opens, so the diagram
       assembles itself instead of just being there. */
    .hub-radial .hub-spoke{
      stroke-dasharray: var(--len);
      stroke-dashoffset: var(--len);
      animation: hubDraw .5s cubic-bezier(.3,.9,.3,1) forwards;
      animation-delay: var(--d);
    }
    @keyframes hubDraw{ to{ stroke-dashoffset: 0; } }
    /* A dot where each spoke meets its node — the reference diagram's
       terminals, and it stops the line ending in mid-air. */
    .hub-node-dot{
      fill: var(--surface, #fff);
      stroke: var(--border-color, #d8dee9);
      stroke-width: 2.5;
      transition: stroke .22s ease, fill .22s ease;
    }
    .hub-node-dot.lit{ stroke: var(--accent, #6366f1); fill: var(--accent, #6366f1); }
    /* Everything except the hovered node steps back. */
    .hub-radial.dimmed .hub-card:not(:hover){ opacity: .45; }
    .hub-radial .hub-card{ opacity: 1; transition: opacity .2s ease, transform .22s cubic-bezier(.2,.9,.3,1.15), box-shadow .22s ease; }

    /* The centre — the thing all the spokes come from. */
    /* A slow halo so the centre reads as live rather than a static blob. */
    .hub-core::before{
      content:'';
      position: absolute; inset: -14px;
      border-radius: 50%;
      border: 2px solid var(--accent, #6366f1);
      opacity: .18;
      animation: hubHalo 3.4s ease-in-out infinite;
    }
    @keyframes hubHalo{
      0%,100%{ transform: scale(1);    opacity: .18; }
      50%    { transform: scale(1.07); opacity: .05; }
    }
    .hub-core{
      position: absolute;
      left: 50%; top: 50%;
      transform: translate(-50%, -50%);
      width: 128px; height: 128px;
      border-radius: 50%;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 2px;
      background: var(--surface, #fff);
      border: 2.5px solid var(--accent, #6366f1);
      box-shadow: 0 6px 28px -12px rgba(30,27,75,.45);
      z-index: 4;
      text-align: center;
    }
    .hub-core-mark{
      font-family: 'Fraunces', Georgia, serif;
      font-size: 30px; font-weight: 600;
      color: var(--accent, #6366f1);
      line-height: 1;
      letter-spacing: -.02em;
    }
    .hub-core-sub{
      font-size: 10px; font-weight: 700;
      letter-spacing: .1em; text-transform: uppercase;
      color: var(--text-dim, #94a3b8);
    }
    /* Hide the arrow glyph — on a ring it points nowhere meaningful. */
    .hub-radial .hub-card-arrow{ display: none; }

  }
  @media (prefers-reduced-motion: reduce){
    .hub-radial .hub-card{ transition: none; }
    .hub-radial .hub-card:hover{ transform: translate(-50%, -50%); }
    .hub-radial .hub-spoke{ animation: none; stroke-dashoffset: 0; }
    .hub-core::before{ animation: none; }
  }`;

  function injectCss(){
    if(document.getElementById('hub-radial-css')) return;
    var st = document.createElement('style');
    st.id = 'hub-radial-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  /**
   * Lay the visible cards on a ring and draw a spoke to each.
   *
   * Recomputed every time the page opens, because access gating decides how
   * many cards are visible — a 2-app user and a 6-app user need different
   * angles, and a ring built for six with four hidden looks broken.
   */
  function layout(){
    var grid = document.querySelector('#page-hub .hub-grid');
    if(!grid) return;

    // Below the breakpoint the CSS grid takes over; strip our positioning so
    // nothing is left absolutely placed at a stale coordinate.
    if(window.innerWidth < 900){
      grid.classList.remove('hub-radial');
      var oldSvg = grid.querySelector('.hub-spokes');
      if(oldSvg) oldSvg.remove();
      var oldCore = grid.querySelector('.hub-core');
      if(oldCore) oldCore.remove();
      Array.prototype.forEach.call(grid.querySelectorAll('.hub-card'), function(c){
        c.style.left = ''; c.style.top = '';
      });
      return;
    }

    var cards = Array.prototype.filter.call(
      grid.querySelectorAll('.hub-card'),
      function(c){ return c.style.display !== 'none'; }
    );
    if(!cards.length) return;

    grid.classList.add('hub-radial');

    // Centre + core
    var core = grid.querySelector('.hub-core');
    if(!core){
      core = document.createElement('div');
      core.className = 'hub-core';
      core.innerHTML = '<span class="hub-core-mark">N</span>' +
                       '<span class="hub-core-sub">Nexus</span>';
      grid.appendChild(core);
    }

    var svg = grid.querySelector('.hub-spokes');
    if(!svg){
      svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('class','hub-spokes');
      grid.insertBefore(svg, grid.firstChild);
    }

    var W = grid.clientWidth, H = grid.clientHeight;
    var cx = W / 2, cy = H / 2;
    // Ring radius: big enough to clear the core, small enough that a card
    // at the edge stays inside the box.
    // Nodes are 84px circles now, so the ring can push much closer to the
    // edges than it could with 168px cards — which is what gives the spokes
    // enough length to actually look like spokes.
    var rx = Math.max(200, Math.min(W/2 - 70, 330));
    var ry = Math.max(150, Math.min(H/2 - 76, 210));

    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.innerHTML = '';

    // Start at the top and go clockwise — a ring that starts at 3 o'clock
    // reads as arbitrary; starting at 12 reads as deliberate.
    var n = cards.length;
    cards.forEach(function(card, i){
      var a = (-Math.PI / 2) + (i * 2 * Math.PI / n);
      var x = cx + rx * Math.cos(a);
      var y = cy + ry * Math.sin(a);

      card.style.left = x + 'px';
      card.style.top  = y + 'px';
      // Stamp the spoke index at layout time. Re-querying on hover meant
      // matching hidden cards with an attribute selector, and the markup
      // writes `display:none` while the selector looked for `display: none`
      // — so hidden cards were counted and every index after them shifted.
      // With all 5 apps visible nothing was hidden and it happened to line
      // up; with 4, hovering lit a spoke belonging to a different app.
      card.dataset.spokeIdx = i;

      // Stop the spoke short of the core and the card so it reads as a
      // connector rather than a line running underneath them.
      // Offset along the REAL direction from centre to node, not along the
      // angle. On an ellipse (rx !== ry) those differ everywhere except the
      // four quarter points, so using the angle pulled spoke ends sideways
      // and made them appear to aim at a neighbouring node.
      var dx = x - cx, dy = y - cy;
      var d  = Math.hypot(dx, dy) || 1;
      var ux = dx / d, uy = dy / d;
      var x1 = cx + 74 * ux, y1 = cy + 74 * uy;
      var x2 = x  - 46 * ux, y2 = y  - 46 * uy;

      var line = document.createElementNS('http://www.w3.org/2000/svg','line');
      line.setAttribute('class','hub-spoke');
      line.setAttribute('x1', x1); line.setAttribute('y1', y1);
      line.setAttribute('x2', x2); line.setAttribute('y2', y2);
      // Dash length must match the real line length or the draw-in either
      // finishes early or never completes.
      var len = Math.hypot(x2-x1, y2-y1);
      line.style.setProperty('--len', len);
      line.style.setProperty('--d', (i * 70) + 'ms');
      svg.appendChild(line);

      // Terminal dot at the node end — the reference diagram's circles.
      var dot = document.createElementNS('http://www.w3.org/2000/svg','circle');
      dot.setAttribute('class','hub-node-dot');
      dot.setAttribute('cx', x2); dot.setAttribute('cy', y2);
      dot.setAttribute('r', 5);
      svg.appendChild(dot);

      // Light the matching spoke + dot on hover and step the others back.
      if(!card.dataset.spokeBound){
        card.dataset.spokeBound = '1';
        card.addEventListener('mouseenter', function(){
          var svgNow = grid.querySelector('.hub-spokes');
          if(!svgNow) return;
          var idx = parseInt(card.dataset.spokeIdx, 10);
          if(isNaN(idx)) return;
          var l = svgNow.querySelectorAll('.hub-spoke')[idx];
          var d = svgNow.querySelectorAll('.hub-node-dot')[idx];
          if(l) l.classList.add('lit');
          if(d) d.classList.add('lit');
          grid.classList.add('dimmed');
        });
        card.addEventListener('mouseleave', function(){
          var svgNow = grid.querySelector('.hub-spokes');
          if(svgNow){
            Array.prototype.forEach.call(
              svgNow.querySelectorAll('.hub-spoke,.hub-node-dot'),
              function(el){ el.classList.remove('lit'); });
          }
          grid.classList.remove('dimmed');
        });
      }
    });
  }

  var _t = null;
  function relayout(){
    clearTimeout(_t);
    _t = setTimeout(layout, 90);
  }

  window.hubRadialLayout = function(){
    injectCss();
    // Access gating runs async, so lay out again shortly after in case cards
    // become visible between the first paint and the app_access fetch landing.
    layout();
    setTimeout(layout, 400);
    setTimeout(layout, 1200);
  };

  window.addEventListener('resize', relayout);
})();
