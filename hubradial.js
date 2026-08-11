/* ═══════════════════════════════════════════════════════════════════════
   hubradial.js — the Nodes page as an actual node diagram
   Loaded by index.html:  <script src="hubradial.js?v=4"></script>

   Separate module by convention — see ARCHITECTURE.md.

   WHY
   The page is called "Nodes" and looked like a list of cards. This lays the
   apps out as a hub and spokes: one centre, a line to each app, apps sitting
   on the ring. The name and the picture finally agree.

   IT ENHANCES, IT DOESN'T REPLACE
   The existing .hub-card anchors are reused exactly as they are — same
   onclick, same access gating via style.display, same icons. This only
   positions them and draws the connectors behind. Nothing about who can see
   which app changes, and if this file fails to load the page falls back to
   the original grid on its own.

   ─── v4 ─────────────────────────────────────────────────────────────────
   REMOVED: tangling / knots, and the neighbour chain with it. The chain
   existed for one reason — spokes are rays from a shared centre and rays
   from a common origin can only meet AT that origin, so a pure hub cannot
   cross itself. The chain supplied the crossings. With knots gone the chain
   has no job, so both are out and the diagram is a clean hub and spokes.

   ADDED: node SHAPE (circle / squircle / hexagon / diamond) and connector
   STYLE (straight / curved / elbow), both persisted alongside the existing
   drag positions and size sliders.

   THEME: every colour is now a Nexus CSS variable. There are no hardcoded
   hexes left in the drawing path, so switching the Nexus theme restyles the
   diagram with no redraw and no JS — and the colour transitions below make
   that switch cross-fade rather than snap.

   SHAPE LIVES ON .hub-card-icon, NOT .hub-card
   clip-path clips every descendant, and .hub-card-body (the label) is a
   CHILD of .hub-card positioned below it. Putting a hexagon clip on the
   card would cut the label off. The icon is a sibling of the label, so the
   shape goes there and the label survives.

   NO TOP-LEVEL DECLARATIONS
   Everything lives inside the IIFE and one window property. Top-level
   let/const in a classic script is global to every other module — a
   duplicate there is a SyntaxError that stops the *other* file executing.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var STORE_KEY = 'nexus_hub_layout_v1';
  var DEFAULTS  = { nodeSize:84, ringScale:1, shape:'circle', line:'straight', nodes:{} };

  function loadPrefs(){
    try{
      var raw = localStorage.getItem(STORE_KEY);
      if(!raw) return JSON.parse(JSON.stringify(DEFAULTS));
      var p = JSON.parse(raw);
      return {
        nodeSize : typeof p.nodeSize  === 'number' ? p.nodeSize  : DEFAULTS.nodeSize,
        ringScale: typeof p.ringScale === 'number' ? p.ringScale : DEFAULTS.ringScale,
        shape    : SHAPES[p.shape] ? p.shape : DEFAULTS.shape,
        line     : LINES[p.line]   ? p.line  : DEFAULTS.line,
        nodes    : (p.nodes && typeof p.nodes === 'object') ? p.nodes : {}
      };
    }catch(e){ return JSON.parse(JSON.stringify(DEFAULTS)); }
  }
  function savePrefs(p){
    try{ localStorage.setItem(STORE_KEY, JSON.stringify(p)); }catch(e){}
  }
  function nodeKey(card){
    if(card.id) return card.id;
    var t = card.querySelector('.hub-card-title');
    return 't:' + ((t && t.textContent.trim()) || 'unknown');
  }

  /* ─── shapes ─────────────────────────────────────────────────────────
     Each shape knows its own outline so the spoke can stop exactly at the
     edge. A diamond is much narrower on the diagonal than a circle, so a
     fixed trim distance would leave the line floating in space on one axis
     and buried under the node on another. radius() returns how far the
     edge sits from the centre along a given direction, as a multiple of
     half the node size. */
  var SHAPES = {
    circle:   { label:'Circle',   radius:function(){ return 1; } },
    squircle: { label:'Squircle', radius:function(ux,uy){
                  // superellipse |x|^4 + |y|^4 = 1
                  var d = Math.pow(Math.pow(Math.abs(ux),4) + Math.pow(Math.abs(uy),4), 0.25);
                  return d < 1e-6 ? 1 : 1/d; } },
    hexagon:  { label:'Hexagon',  poly:[[-0.5,-0.9],[0.5,-0.9],[1,0],[0.5,0.9],[-0.5,0.9],[-1,0]] },
    diamond:  { label:'Diamond',  radius:function(ux,uy){
                  var d = Math.abs(ux) + Math.abs(uy);
                  return d < 1e-6 ? 1 : 1/d; } }
  };
  /** Ray from the origin along (ux,uy) to the polygon edge. */
  function polyRadius(poly, ux, uy){
    var bestT = 1;
    for(var i=0;i<poly.length;i++){
      var a = poly[i], b = poly[(i+1)%poly.length];
      var ex = b[0]-a[0], ey = b[1]-a[1];
      var den = ux*ey - uy*ex;
      if(Math.abs(den) < 1e-9) continue;
      var t = (a[0]*ey - a[1]*ex) / den;         // distance along the ray
      var s = (a[0]*uy - a[1]*ux) / den;         // position along the edge
      if(t > 0 && s >= 0 && s <= 1) bestT = t;
    }
    return bestT;
  }
  function shapeRadius(name, ux, uy){
    var s = SHAPES[name] || SHAPES.circle;
    return s.poly ? polyRadius(s.poly, ux, uy) : s.radius(ux, uy);
  }

  /* ─── connector styles ───────────────────────────────────────────────
     Each returns an SVG path. Straight is the honest default; curved gives
     the diagram a softer, organic read; elbow makes it look like a circuit
     board. All three start at the core edge and end at the node edge. */
  var LINES = {
    straight: { label:'Straight', path:function(p1,p2){
                  return 'M'+p1.x+' '+p1.y+' L'+p2.x+' '+p2.y; } },
    curved:   { label:'Curved',   path:function(p1,p2){
                  var mx = (p1.x+p2.x)/2, my = (p1.y+p2.y)/2;
                  var dx = p2.x-p1.x, dy = p2.y-p1.y;
                  var len = Math.hypot(dx,dy) || 1;
                  // bow perpendicular to the run, 14% of its length
                  var bow = len * 0.14;
                  var cx = mx + (-dy/len)*bow, cy = my + (dx/len)*bow;
                  return 'M'+p1.x+' '+p1.y+' Q'+cx+' '+cy+' '+p2.x+' '+p2.y; } },
    elbow:    { label:'Elbow',    path:function(p1,p2){
                  var dx = Math.abs(p2.x-p1.x), dy = Math.abs(p2.y-p1.y);
                  // travel the dominant axis first, then turn once
                  if(dx > dy){
                    var mx = (p1.x+p2.x)/2;
                    return 'M'+p1.x+' '+p1.y+' L'+mx+' '+p1.y+
                           ' L'+mx+' '+p2.y+' L'+p2.x+' '+p2.y;
                  }
                  var my = (p1.y+p2.y)/2;
                  return 'M'+p1.x+' '+p1.y+' L'+p1.x+' '+my+
                         ' L'+p2.x+' '+my+' L'+p2.x+' '+p2.y; } }
  };

  var CSS = `
  @media (min-width: 900px){
    .hub-grid.hub-radial{
      position: relative;
      display: block;
      height: 600px;
      margin: 8px auto 0;
      max-width: 820px;
      --hub-node-size: 84px;
      touch-action: none;
    }
    /* The card is now only a hit target and a positioner. All the visible
       node body moved to .hub-card-icon so hexagon/diamond clip-paths can
       be used without cutting off the label below. */
    .hub-radial .hub-card{
      position: absolute;
      width: var(--hub-node-size); height: var(--hub-node-size);
      padding: 0; margin: 0;
      background: transparent;
      border: 0;
      box-shadow: none;
      display: flex; align-items: center; justify-content: center;
      transform: translate(-50%, -50%);
      transition: opacity .2s ease;
      z-index: 2;
      overflow: visible;
      cursor: grab;
      user-select: none; -webkit-user-select: none;
      --hub-i: 0;
    }
    /* THE NODE BODY.
       Outer background is the outline colour; ::before is inset to give the
       fill. Two layers because clip-path clips a border away to nothing, so
       a hexagon cannot be outlined with border at all. */
    .hub-radial .hub-card-icon{
      position: relative;
      margin: 0;
      width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      background: var(--border-color);
      transition: background .28s cubic-bezier(.2,0,0,1);
    }
    .hub-radial .hub-card-icon::before{
      content:'';
      position: absolute; inset: 2.5px;
      background: var(--surface);
      transition: background .28s cubic-bezier(.2,0,0,1);
    }
    .hub-radial .hub-card-icon svg{
      position: relative; z-index: 1;
      width: calc(var(--hub-node-size) * .31);
      height: calc(var(--hub-node-size) * .31);
      transition: transform .2s cubic-bezier(.2,0,0,1);
    }
    /* ── shapes ───────────────────────────────────────────────────── */
    .hub-shape-circle   .hub-card-icon,
    .hub-shape-circle   .hub-card-icon::before{ border-radius: 50%; }
    .hub-shape-squircle .hub-card-icon,
    .hub-shape-squircle .hub-card-icon::before{ border-radius: 28%; }
    .hub-shape-hexagon  .hub-card-icon,
    .hub-shape-hexagon  .hub-card-icon::before{
      clip-path: polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%);
    }
    .hub-shape-diamond  .hub-card-icon,
    .hub-shape-diamond  .hub-card-icon::before{
      clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
    }
    /* hover / press / drag — colour on the body, scale on the glyph */
    .hub-radial .hub-card:hover .hub-card-icon{ background: var(--accent); }
    .hub-radial .hub-card:hover .hub-card-icon svg{ transform: scale(1.1); }
    .hub-radial .hub-card:active .hub-card-icon svg{
      transform: scale(.9);
      transition: transform .12s cubic-bezier(.3,0,.3,1);
    }
    .hub-radial .hub-card.hub-dragging{ z-index: 9; cursor: grabbing; }
    .hub-radial .hub-card.hub-dragging .hub-card-icon{ background: var(--accent); }
    .hub-radial .hub-card.hub-dragging .hub-card-icon svg{ transform: scale(1.12); }
    .hub-radial.hub-is-dragging .hub-card:not(.hub-dragging){ opacity: .5; }

    .hub-radial .hub-card-body{
      position: absolute;
      top: calc(100% + 9px);
      left: 50%;
      transform: translateX(-50%);
      width: 130px;
      text-align: center;
      pointer-events: none;
      transition: transform .22s cubic-bezier(.2,0,0,1);
    }
    .hub-radial .hub-card:hover .hub-card-body{ transform: translateX(-50%) translateY(2px); }
    .hub-radial .hub-card-title{
      font-size: 13px; font-weight: 600; white-space: nowrap;
      transition: color .2s ease;
    }
    .hub-radial .hub-card:hover .hub-card-title{ color: var(--accent); }
    .hub-radial .hub-card-arrow{ display: none; }

    /* ── entrance, first assembly only ────────────────────────────── */
    .hub-radial.hub-anim-in .hub-card{
      animation: hubNodeIn .46s cubic-bezier(.05,.7,.1,1) both;
      animation-delay: calc(var(--hub-i) * 70ms + 60ms);
    }
    @keyframes hubNodeIn{
      0%  { opacity: 0; transform: translate(-50%, -50%) scale(.4); }
      60% { opacity: 1; }
      100%{ opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
    /* ── RE-FORM: shape or connector style changed ─────────────────────
       Neither clip-path nor an SVG path command list can tween between two
       different geometries — a hexagon has no meaningful halfway point to a
       diamond. So instead of faking a morph, the change is STAGED: the node
       dips and springs back while the new shape swaps in underneath. Micro
       cascade, 28ms apart, so five nodes finish inside the 200ms budget. */
    /* NOTE: this animation goes on .hub-card, NOT .hub-card-icon. The icon
       already carries the ambient float, and two rules both setting the
       'animation' property on one element do not stack — the later one wins
       outright and the other never runs. The card is free, so the dip lives
       there. Its keyframes must repeat translate(-50%,-50%) because an
       animation replaces the element's transform entirely, and dropping the
       centring offset would fling every node down-right by half its size. */
    .hub-radial.hub-reform .hub-card{
      animation: hubReform .3s cubic-bezier(.175,.885,.32,1.275) both;
      animation-delay: calc(var(--hub-i) * 28ms);
    }
    @keyframes hubReform{
      0%  { transform: translate(-50%, -50%) scale(1); }
      35% { transform: translate(-50%, -50%) scale(.84); }
      100%{ transform: translate(-50%, -50%) scale(1); }
    }
    /* Connectors redraw with the same cascade so line and node agree. */
    .hub-radial.hub-reform .hub-spoke{
      animation: hubDraw .34s cubic-bezier(.05,.7,.1,1) both;
      animation-delay: calc(var(--hub-i) * 28ms);
    }
    /* ── ambient float ────────────────────────────────────────────────
       Lives on .hub-card-icon and is NEVER paused and NEVER given a
       transform declaration elsewhere: a running animation outranks a plain
       declaration, and pausing freezes it at a random phase, which snaps the
       node several pixels. Scale therefore lives on the svg. */
    .hub-radial .hub-card .hub-card-icon{
      animation: hubFloat 5.2s ease-in-out infinite;
      animation-delay: calc(var(--hub-i) * -0.9s);
    }
    @keyframes hubFloat{
      0%,100%{ transform: translateY(0); }
      50%    { transform: translateY(-3px); }
    }

    /* ── connectors ───────────────────────────────────────────────── */
    .hub-spokes{
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      pointer-events: none;
      z-index: 1;
    }
    .hub-spoke{
      fill: none;
      stroke: var(--border-color);
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
      transition: stroke .28s cubic-bezier(.2,0,0,1),
                  stroke-width .28s cubic-bezier(.2,0,0,1);
    }
    .hub-spoke.lit{ stroke: var(--accent); stroke-width: 3.5; }
    /* Draw-in on first assembly. Offset lands at 0 and STAYS there — a
       one-shot animation that ended on a non-zero offset would snap the
       whole line back to invisible. */
    .hub-radial.hub-anim-in .hub-spoke{
      stroke-dasharray: var(--len);
      stroke-dashoffset: 0;
      animation: hubDraw .5s cubic-bezier(.05,.7,.1,1) both;
      animation-delay: var(--d);
    }
    @keyframes hubDraw{
      from{ stroke-dashoffset: var(--len); }
      to  { stroke-dashoffset: 0; }
    }
    .hub-node-dot{
      fill: var(--surface);
      stroke: var(--border-color);
      stroke-width: 2.5;
      transform-box: fill-box; transform-origin: center;
      transition: stroke .24s cubic-bezier(.2,0,0,1),
                  fill .24s cubic-bezier(.2,0,0,1);
    }
    .hub-radial.hub-anim-in .hub-node-dot{
      animation: hubDotIn .34s cubic-bezier(.175,.885,.32,1.275) both;
      animation-delay: var(--d);
    }
    @keyframes hubDotIn{
      0%  { opacity: 0; transform: scale(0); }
      100%{ opacity: 1; transform: scale(1); }
    }
    .hub-node-dot.lit{
      stroke: var(--accent); fill: var(--accent);
      animation: hubDotPop .3s cubic-bezier(.175,.885,.32,1.275);
    }
    @keyframes hubDotPop{
      0%{ transform: scale(1); } 45%{ transform: scale(1.55); } 100%{ transform: scale(1); }
    }
    .hub-radial.dimmed .hub-card:not(:hover){ opacity: .4; }

    /* ── the centre ───────────────────────────────────────────────── */
    .hub-core::before{
      content:'';
      position: absolute; inset: -14px;
      border-radius: 50%;
      border: 2px solid var(--accent);
      opacity: .18;
      animation: hubHalo 3.4s ease-in-out infinite;
    }
    @keyframes hubHalo{
      0%,100%{ transform: scale(1); opacity: .18; }
      50%    { transform: scale(1.07); opacity: .05; }
    }
    .hub-core{
      position: absolute; left: 50%; top: 50%;
      transform: translate(-50%, -50%);
      width: 128px; height: 128px;
      border-radius: 50%;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 2px;
      background: var(--surface);
      border: 2.5px solid var(--accent);
      z-index: 4; text-align: center; pointer-events: none;
      transition: background .28s cubic-bezier(.2,0,0,1),
                  border-color .28s cubic-bezier(.2,0,0,1);
    }
    .hub-radial.hub-anim-in .hub-core{
      animation: hubCoreIn .5s cubic-bezier(.175,.885,.32,1.275) both;
    }
    @keyframes hubCoreIn{
      0%  { opacity: 0; transform: translate(-50%, -50%) scale(.72); }
      100%{ opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
    .hub-core-mark{
      font-family: 'Fraunces', Georgia, serif;
      font-size: 30px; font-weight: 600;
      color: var(--accent); line-height: 1; letter-spacing: -.02em;
      transition: color .28s cubic-bezier(.2,0,0,1);
    }
    .hub-core-sub{
      font-size: 10px; font-weight: 700;
      letter-spacing: .1em; text-transform: uppercase;
      color: var(--text-dim);
    }

    /* ── control strip ────────────────────────────────────────────── */
    .hub-ctl{
      display: flex; align-items: center; gap: 16px;
      max-width: 820px; margin: 0 auto;
      padding: 9px 14px;
      border: 1px solid var(--border-color);
      border-radius: 12px;
      background: var(--surface);
      font-size: 12px; color: var(--text-dim);
      opacity: .55;
      transition: opacity .22s cubic-bezier(.2,0,0,1),
                  background .28s cubic-bezier(.2,0,0,1),
                  border-color .28s cubic-bezier(.2,0,0,1);
      flex-wrap: wrap;
    }
    .hub-ctl:hover{ opacity: 1; }
    .hub-ctl label{
      display: flex; align-items: center; gap: 7px;
      font-weight: 600; letter-spacing: .02em;
      text-transform: uppercase; font-size: 10px; white-space: nowrap;
    }
    .hub-ctl input[type=range]{
      width: 82px; height: 3px; cursor: pointer; accent-color: var(--accent);
    }
    .hub-ctl select{
      font: inherit; font-size: 11px; font-weight: 700;
      color: var(--text); background: var(--surface);
      border: 1px solid var(--border-color);
      border-radius: 7px; padding: 4px 6px; cursor: pointer;
      transition: border-color .2s ease;
    }
    .hub-ctl select:hover{ border-color: var(--accent); }
    .hub-ctl-spacer{ flex: 1; }
    .hub-ctl-reset{
      border: 1px solid var(--border-color);
      background: transparent; color: inherit; font: inherit;
      font-weight: 600; font-size: 10px;
      letter-spacing: .06em; text-transform: uppercase;
      padding: 5px 11px; border-radius: 7px; cursor: pointer;
      transition: border-color .2s ease, color .2s ease,
                  transform .14s cubic-bezier(.2,0,0,1);
    }
    .hub-ctl-reset:hover{ border-color: var(--accent); color: var(--accent); }
    .hub-ctl-reset:active{ transform: scale(.94); }
  }
  @media (max-width: 899px){ .hub-ctl{ display: none; } }

  @media (prefers-reduced-motion: reduce){
    .hub-radial .hub-card{ animation: none; }
    .hub-radial .hub-card .hub-card-icon{ animation: none; }
    .hub-radial.hub-reform .hub-card{ animation: none; }
    .hub-radial .hub-card-icon svg{ transition: none; }
    .hub-radial .hub-card:hover .hub-card-icon svg,
    .hub-radial .hub-card:active .hub-card-icon svg,
    .hub-radial .hub-card.hub-dragging .hub-card-icon svg{ transform: none; }
    .hub-radial .hub-card:hover .hub-card-body{ transform: translateX(-50%); }
    .hub-radial .hub-spoke{ animation: none; stroke-dashoffset: 0; }
    .hub-radial.hub-reform .hub-spoke{ animation: none; }
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

  function svgEl(name, cls){
    var e = document.createElementNS('http://www.w3.org/2000/svg', name);
    if(cls) e.setAttribute('class', cls);
    return e;
  }

  var prefs    = loadPrefs();
  var firstRun = true;
  var dragging = null;

  /* ─── draw the connectors from wherever the nodes currently are ─────── */
  function redraw(grid){
    var svg = grid.querySelector('.hub-spokes');
    if(!svg) return;

    var W = grid.clientWidth, H = grid.clientHeight;
    var cx = W/2, cy = H/2;
    var half = prefs.nodeSize / 2;

    var cards = Array.prototype.filter.call(
      grid.querySelectorAll('.hub-card'),
      function(c){ return c.style.display !== 'none'; }
    );

    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.innerHTML = '';

    cards.forEach(function(card, i){
      var x = parseFloat(card.style.left) || cx;
      var y = parseFloat(card.style.top)  || cy;

      // Trim along the REAL direction from centre to node, not the ring
      // angle: on an ellipse those differ, and with free dragging there is
      // no ring angle at all.
      var dx = x-cx, dy = y-cy;
      var d  = Math.hypot(dx,dy) || 1;
      var ux = dx/d, uy = dy/d;

      // Stop at the node's actual edge for the CURRENT shape. A diamond is
      // far narrower on the diagonal than a circle, so one fixed trim would
      // float the line off one node and bury it under another.
      var edge = half * shapeRadius(prefs.shape, ux, uy) + 4;
      if(d < 74 + edge + 6) return;             // dragged inside the core

      var p1 = { x: cx + 74*ux,  y: cy + 74*uy };
      var p2 = { x: x - edge*ux, y: y - edge*uy };

      var path = svgEl('path','hub-spoke');
      path.setAttribute('d', (LINES[prefs.line] || LINES.straight).path(p1,p2));
      // Dash length must be the path's real length or the draw-in finishes
      // early (elbow and curve are longer than the straight line between
      // the same two points).
      var len;
      try{ len = path.getTotalLength(); }catch(e){ len = 0; }
      if(!len) len = Math.hypot(p2.x-p1.x, p2.y-p1.y);
      path.style.setProperty('--len', len);
      path.style.setProperty('--d', (i*70)+'ms');
      path.style.setProperty('--hub-i', i);
      path.dataset.node = i;
      svg.appendChild(path);

      var dot = svgEl('circle','hub-node-dot');
      dot.setAttribute('cx',p2.x); dot.setAttribute('cy',p2.y);
      dot.setAttribute('r',5);
      dot.style.setProperty('--d', (i*70+260)+'ms');
      dot.dataset.node = i;
      svg.appendChild(dot);
    });
  }

  /** Replay the staged shape/style swap. */
  function reform(grid){
    // Both hubNodeIn and hubReform target .hub-card's transform, and two
    // animations on one property do not stack — whichever wins cancels the
    // other. If the entrance is still running (someone changed the shape
    // within a second of opening the page), let it finish rather than
    // truncating it with a dip.
    if(grid.classList.contains('hub-anim-in')) return;
    grid.classList.remove('hub-reform');
    void grid.offsetWidth;               // force reflow so the animation restarts
    grid.classList.add('hub-reform');
    setTimeout(function(){ grid.classList.remove('hub-reform'); }, 600);
  }

  /* ─── drag ──────────────────────────────────────────────────────────── */
  function bindDrag(card, grid){
    if(card.dataset.hubDragBound) return;
    card.dataset.hubDragBound = '1';

    card.addEventListener('dragstart', function(e){ e.preventDefault(); });

    card.addEventListener('pointerdown', function(e){
      if(e.button !== 0) return;
      if(window.innerWidth < 900) return;
      dragging = { card:card, moved:false,
                   startX:e.clientX, startY:e.clientY,
                   originX:parseFloat(card.style.left)||0,
                   originY:parseFloat(card.style.top)||0 };
      card.setPointerCapture(e.pointerId);
    });

    card.addEventListener('pointermove', function(e){
      if(!dragging || dragging.card !== card) return;
      var dx = e.clientX - dragging.startX;
      var dy = e.clientY - dragging.startY;
      if(!dragging.moved && Math.hypot(dx,dy) < 4) return;   // click slop
      if(!dragging.moved){
        dragging.moved = true;
        card.classList.add('hub-dragging');
        grid.classList.add('hub-is-dragging');
        grid.classList.remove('dimmed');
      }
      var pad = prefs.nodeSize/2 + 6;
      var W = grid.clientWidth, H = grid.clientHeight;
      card.style.left = Math.max(pad, Math.min(W - pad, dragging.originX + dx)) + 'px';
      card.style.top  = Math.max(pad, Math.min(H - pad - 22, dragging.originY + dy)) + 'px';
      redraw(grid);
    });

    function endDrag(e){
      if(!dragging || dragging.card !== card) return;
      var wasMoved = dragging.moved;
      card.classList.remove('hub-dragging');
      grid.classList.remove('hub-is-dragging');
      try{ card.releasePointerCapture(e.pointerId); }catch(err){}
      if(wasMoved){
        // Fractions, not pixels — a different window size keeps the
        // arrangement instead of shoving nodes off the box.
        var W = grid.clientWidth, H = grid.clientHeight;
        prefs.nodes[nodeKey(card)] = {
          fx:(parseFloat(card.style.left)||0)/W,
          fy:(parseFloat(card.style.top) ||0)/H
        };
        savePrefs(prefs);
        card.dataset.hubJustDragged = '1';
        setTimeout(function(){ delete card.dataset.hubJustDragged; }, 0);
      }
      dragging = null;
      redraw(grid);
    }
    card.addEventListener('pointerup', endDrag);
    card.addEventListener('pointercancel', endDrag);

    // Capture phase so we beat the inline onclick that opens the app.
    card.addEventListener('click', function(e){
      if(card.dataset.hubJustDragged){
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true);
  }

  /* ─── control strip ─────────────────────────────────────────────────── */
  function opts(map, sel){
    return Object.keys(map).map(function(k){
      return '<option value="'+k+'"'+(k===sel?' selected':'')+'>'+map[k].label+'</option>';
    }).join('');
  }
  function ensureControls(grid){
    var page = document.getElementById('page-hub');
    if(!page || page.querySelector('.hub-ctl')) return;

    var bar = document.createElement('div');
    bar.className = 'hub-ctl';
    bar.innerHTML =
      '<label>Shape <select class="hub-ctl-shape">'+opts(SHAPES, prefs.shape)+'</select></label>'+
      '<label>Lines <select class="hub-ctl-line">'+opts(LINES, prefs.line)+'</select></label>'+
      '<label>Ring <input type="range" class="hub-ctl-ring" min="60" max="130" step="1"></label>'+
      '<label>Node <input type="range" class="hub-ctl-size" min="64" max="120" step="1"></label>'+
      '<span class="hub-ctl-spacer"></span>'+
      '<button type="button" class="hub-ctl-reset">Reset</button>';
    grid.parentNode.insertBefore(bar, grid);

    var ring  = bar.querySelector('.hub-ctl-ring');
    var size  = bar.querySelector('.hub-ctl-size');
    var shape = bar.querySelector('.hub-ctl-shape');
    var line  = bar.querySelector('.hub-ctl-line');
    ring.value = Math.round(prefs.ringScale * 100);
    size.value = prefs.nodeSize;

    shape.addEventListener('change', function(){
      prefs.shape = SHAPES[shape.value] ? shape.value : 'circle';
      savePrefs(prefs);
      applyShape(grid);
      redraw(grid);          // the spoke trim depends on the shape outline
      reform(grid);
    });
    line.addEventListener('change', function(){
      prefs.line = LINES[line.value] ? line.value : 'straight';
      savePrefs(prefs);
      redraw(grid);
      reform(grid);
    });
    ring.addEventListener('input', function(){
      prefs.ringScale = parseInt(ring.value,10)/100;
      savePrefs(prefs);
      layout(true);
    });
    size.addEventListener('input', function(){
      prefs.nodeSize = parseInt(size.value,10);
      savePrefs(prefs);
      grid.style.setProperty('--hub-node-size', prefs.nodeSize+'px');
      redraw(grid);
    });
    bar.querySelector('.hub-ctl-reset').addEventListener('click', function(){
      prefs = JSON.parse(JSON.stringify(DEFAULTS));
      savePrefs(prefs);
      ring.value = 100; size.value = DEFAULTS.nodeSize;
      shape.value = DEFAULTS.shape; line.value = DEFAULTS.line;
      layout(true);
      reform(grid);
    });
  }

  function applyShape(grid){
    Object.keys(SHAPES).forEach(function(k){
      grid.classList.toggle('hub-shape-'+k, k === prefs.shape);
    });
  }

  /**
   * Lay the visible cards out and draw the diagram.
   * @param {boolean} keepPlacement  true for slider/reset re-runs, so the
   *                                 entrance animation doesn't replay.
   */
  function layout(keepPlacement){
    var grid = document.querySelector('#page-hub .hub-grid');
    if(!grid) return;

    // Below the breakpoint the original CSS grid takes over.
    if(window.innerWidth < 900){
      grid.classList.remove('hub-radial','hub-anim-in','hub-reform');
      Object.keys(SHAPES).forEach(function(k){ grid.classList.remove('hub-shape-'+k); });
      var oldSvg = grid.querySelector('.hub-spokes');  if(oldSvg) oldSvg.remove();
      var oldCore = grid.querySelector('.hub-core');   if(oldCore) oldCore.remove();
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
    grid.style.setProperty('--hub-node-size', prefs.nodeSize + 'px');
    applyShape(grid);
    ensureControls(grid);

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
      svg = svgEl('svg','hub-spokes');
      grid.insertBefore(svg, grid.firstChild);
    }

    var W = grid.clientWidth, H = grid.clientHeight;
    var cx = W/2, cy = H/2;
    var half = prefs.nodeSize/2;
    var rx = Math.max(190, Math.min(W/2 - half - 14, 330)) * prefs.ringScale;
    var ry = Math.max(140, Math.min(H/2 - half - 34, 210)) * prefs.ringScale;

    var n = cards.length;
    cards.forEach(function(card, i){
      var saved = prefs.nodes[nodeKey(card)];
      var x, y;
      if(saved && typeof saved.fx === 'number'){
        var pad = half + 6;
        x = Math.max(pad, Math.min(W - pad, saved.fx * W));
        y = Math.max(pad, Math.min(H - pad - 22, saved.fy * H));
      }else{
        // Start at the top and go clockwise — a ring starting at 3 o'clock
        // reads as arbitrary; starting at 12 reads as deliberate.
        var a = (-Math.PI/2) + (i * 2*Math.PI / n);
        x = cx + rx*Math.cos(a);
        y = cy + ry*Math.sin(a);
      }
      card.style.left = x + 'px';
      card.style.top  = y + 'px';
      card.style.setProperty('--hub-i', i);
      card.dataset.spokeIdx = i;

      bindDrag(card, grid);

      if(!card.dataset.spokeBound){
        card.dataset.spokeBound = '1';
        card.addEventListener('mouseenter', function(){
          if(dragging) return;
          var s = grid.querySelector('.hub-spokes');
          if(!s) return;
          var idx = parseInt(card.dataset.spokeIdx,10);
          if(isNaN(idx)) return;
          // Look up by stamped index, never by position in the NodeList —
          // a skipped connector shifts every index after it.
          var l = s.querySelector('.hub-spoke[data-node="'+idx+'"]');
          var d = s.querySelector('.hub-node-dot[data-node="'+idx+'"]');
          if(l) l.classList.add('lit');
          if(d) d.classList.add('lit');
          grid.classList.add('dimmed');
        });
        card.addEventListener('mouseleave', function(){
          var s = grid.querySelector('.hub-spokes');
          if(s) Array.prototype.forEach.call(
            s.querySelectorAll('.hub-spoke,.hub-node-dot'),
            function(el){ el.classList.remove('lit'); });
          grid.classList.remove('dimmed');
        });
      }
    });

    if(firstRun && !keepPlacement){
      grid.classList.add('hub-anim-in');
      setTimeout(function(){ grid.classList.remove('hub-anim-in'); }, 1400);
    }

    redraw(grid);
    if(firstRun) setTimeout(function(){ firstRun = false; }, 1500);
  }

  var _t = null;
  function relayout(){
    clearTimeout(_t);
    _t = setTimeout(function(){ layout(true); }, 90);
  }

  window.hubRadialLayout = function(){
    injectCss();
    // Access gating runs async, so lay out again shortly after in case cards
    // become visible between first paint and the app_access fetch landing.
    layout();
    setTimeout(function(){ layout(true); }, 400);
    setTimeout(function(){ layout(true); }, 1200);
  };

  window.addEventListener('resize', relayout);
})();
