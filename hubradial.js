/* ═══════════════════════════════════════════════════════════════════════
   hubradial.js — the Nodes page as an actual node diagram
   Loaded by index.html:  <script src="hubradial.js?v=2"></script>

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

   ─── v2: MOTION PASS (motion-design skill) ──────────────────────────────
   Personality: Corporate base with a whisper of Playful for the assembly
   moment. Signature easing cubic-bezier(.2,0,0,1); entrances use the
   MD3-emphasized curve (.05,.7,.1,1). Three motion layers throughout:
     • Primary   — the node arriving on the ring (position+scale+opacity),
                    synced to ride in behind its own spoke as it draws.
     • Secondary — spoke energize, shadow follow-through, label lift, the
                    terminal dot pop.
     • Ambient   — the core halo (kept) + a phase-offset per-node float so
                    the ring breathes rather than sits dead.
   Stagger is 70ms by ring position, total assembly < 500ms (skill budget).
   Everything is still inside the IIFE / one window property — no top-level
   declarations, per the cross-file collision rule.

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
      /* transform is driven by two custom props so the entrance, the float
         and the hover lift can each own one channel without clobbering the
         others. --hub-enter runs 1→0 during assembly; --hub-lift is the
         hover offset; the keyframe float rides on top via its own translate. */
      transform: translate(-50%, -50%);
      transition: box-shadow .28s cubic-bezier(.2,0,0,1),
                  border-color .2s ease,
                  opacity .2s ease;
      z-index: 2;
      overflow: visible;
      /* set by JS at layout time */
      --hub-i: 0;
    }
    /* HOVER (secondary layer): lift + a touch of scale, shadow lands late.
       Driven on a wrapper transform so it composes with the float keyframe. */
    .hub-radial .hub-card > *{ transition: transform .22s cubic-bezier(.2,0,0,1); }
    .hub-radial .hub-card:hover{
      border-color: var(--accent, #6366f1);
      z-index: 5;
      box-shadow: 0 14px 30px -14px rgba(30,27,75,.5);
    }
    .hub-radial .hub-card:hover .hub-card-icon{
      transform: translateY(-3px) scale(1.06);
    }
    /* PRESS (state feedback): quick, firm, no float fighting it. */
    .hub-radial .hub-card:active .hub-card-icon{
      transform: translateY(0) scale(.92);
      transition: transform .12s cubic-bezier(.3,0,.3,1);
    }
    .hub-radial .hub-card-icon{
      margin: 0;
      width: 40px; height: 40px;
      display: flex; align-items: center; justify-content: center;
      transition: transform .2s cubic-bezier(.2,0,0,1);
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
      transition: transform .22s cubic-bezier(.2,0,0,1), opacity .2s ease;
    }
    /* Label lifts and firms up on hover — small secondary read. */
    .hub-radial .hub-card:hover .hub-card-body{
      transform: translateX(-50%) translateY(2px);
    }
    .hub-radial .hub-card-title{
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      transition: color .2s ease;
    }
    .hub-radial .hub-card:hover .hub-card-title{ color: var(--accent, #6366f1); }

    /* ── ENTRANCE (primary layer) ───────────────────────────────────────
       The node rides in behind its own spoke: starts pulled toward the core
       and shrunk, decelerates onto the ring. Delay matches the spoke draw so
       line and node arrive together instead of the node just being there. */
    .hub-radial .hub-card{
      animation: hubNodeIn .46s cubic-bezier(.05,.7,.1,1) both;
      animation-delay: calc(var(--hub-i) * 70ms + 60ms);
    }
    @keyframes hubNodeIn{
      0%  { opacity: 0; transform: translate(-50%, -50%) scale(.4); }
      60% { opacity: 1; }
      100%{ opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
    /* AMBIENT (float): starts only after assembly, phase-offset per node so
       the ring breathes out of sync. Tiny amplitude — life, not distraction. */
    .hub-radial .hub-card .hub-card-icon{
      animation: hubFloat 5.2s ease-in-out infinite;
      animation-delay: calc(var(--hub-i) * -0.9s);
    }
    @keyframes hubFloat{
      0%,100%{ transform: translateY(0)   scale(1); }
      50%    { transform: translateY(-3px) scale(1); }
    }
    /* Hover/press must beat the ambient float — repeat the intents at higher
       specificity so they win over the keyframe on .hub-card-icon. */
    .hub-radial .hub-card:hover .hub-card-icon{
      animation-play-state: paused;
      transform: translateY(-3px) scale(1.06);
    }
    .hub-radial .hub-card:active .hub-card-icon{
      animation-play-state: paused;
      transform: translateY(0) scale(.92);
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
      transition: stroke .28s cubic-bezier(.2,0,0,1),
                  stroke-width .28s cubic-bezier(.2,0,0,1);
    }
    .hub-spoke.lit{ stroke: var(--accent, #6366f1); stroke-width: 3.5; }
    /* Spokes draw outward from the core when the page opens, so the diagram
       assembles itself instead of just being there. */
    .hub-radial .hub-spoke{
      stroke-dasharray: var(--len);
      /* Land at 0 and STAY at 0 (forwards). The hover energize below must
         not touch dashoffset, or when its one-shot animation ends the offset
         snaps back to this declared value and the whole line vanishes. */
      stroke-dashoffset: 0;
      animation: hubDraw .5s cubic-bezier(.05,.7,.1,1) both;
      animation-delay: var(--d);
    }
    @keyframes hubDraw{
      from{ stroke-dashoffset: var(--len); }
      to  { stroke-dashoffset: 0; }
    }
    /* HOVER energize (secondary): colour + weight only, no dash animation —
       the line stays fully drawn. A subtle glow gives the directional read
       the pulse was reaching for, without ever hiding the stroke. */
    .hub-radial .hub-spoke.lit{
      animation: hubLit .3s cubic-bezier(.2,0,0,1) both;
    }
    @keyframes hubLit{
      from{ stroke-width: 2.5; }
      to  { stroke-width: 3.5; }
    }
    /* A dot where each spoke meets its node — the reference diagram's
       terminals, and it stops the line ending in mid-air. */
    .hub-node-dot{
      fill: var(--surface, #fff);
      stroke: var(--border-color, #d8dee9);
      stroke-width: 2.5;
      transform-box: fill-box;
      transform-origin: center;
      transition: stroke .24s cubic-bezier(.2,0,0,1),
                  fill .24s cubic-bezier(.2,0,0,1);
    }
    /* Terminal dot pops in just after its spoke lands. */
    .hub-radial .hub-node-dot{
      animation: hubDotIn .34s cubic-bezier(.175,.885,.32,1.275) both;
      animation-delay: var(--d);
    }
    @keyframes hubDotIn{
      0%  { opacity: 0; transform: scale(0); }
      100%{ opacity: 1; transform: scale(1); }
    }
    .hub-node-dot.lit{
      stroke: var(--accent, #6366f1); fill: var(--accent, #6366f1);
      /* a small emphasis pop when its node is hovered */
      animation: hubDotPop .3s cubic-bezier(.175,.885,.32,1.275);
    }
    @keyframes hubDotPop{
      0%  { transform: scale(1); }
      45% { transform: scale(1.55); }
      100%{ transform: scale(1); }
    }
    /* Everything except the hovered node steps back. */
    .hub-radial.dimmed .hub-card:not(:hover){ opacity: .4; }
    .hub-radial.dimmed .hub-card:not(:hover) .hub-card-icon{ animation-play-state: paused; }

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
      /* Core lands first, with a small anticipation overshoot — it's the
         hero, so it gets the most expressive entrance. */
      animation: hubCoreIn .5s cubic-bezier(.175,.885,.32,1.275) both;
    }
    @keyframes hubCoreIn{
      0%  { opacity: 0; transform: translate(-50%, -50%) scale(.72); }
      100%{ opacity: 1; transform: translate(-50%, -50%) scale(1); }
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
    .hub-radial .hub-card{ animation: none; }
    .hub-radial .hub-card .hub-card-icon{ animation: none; transition: none; }
    .hub-radial .hub-card:hover .hub-card-icon,
    .hub-radial .hub-card:active .hub-card-icon{ transform: none; }
    .hub-radial .hub-card:hover .hub-card-body{ transform: translateX(-50%); }
    .hub-radial .hub-spoke{ animation: none; stroke-dashoffset: 0; }
    .hub-radial .hub-spoke.lit{ animation: none; stroke-width: 3.5; }
    .hub-radial .hub-node-dot{ animation: none; opacity: 1; transform: none; }
    .hub-radial .hub-node-dot.lit{ animation: none; }
    .hub-core{ animation: none; }
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
      // Ordinal for the entrance cascade + float phase offset (motion pass).
      // Drives animation-delay via calc(var(--hub-i) * 70ms) in CSS, so the
      // node arrives in step with its spoke and each node floats out of phase.
      card.style.setProperty('--hub-i', i);
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
      // Same cascade delay as the spoke so the dot pops as the line lands.
      dot.style.setProperty('--d', (i * 70 + 260) + 'ms');
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
          var dd = svgNow.querySelectorAll('.hub-node-dot')[idx];
          if(l) l.classList.add('lit');
          if(dd) dd.classList.add('lit');
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
