/* ═══════════════════════════════════════════════════════════════════════
   hubradial.js — the Nodes page as an actual node diagram
   Loaded by index.html:  <script src="hubradial.js?v=3"></script>

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

   ─── v3: CUSTOMIZABLE LAYOUT ────────────────────────────────────────────
   • Drag any node anywhere. Position is remembered per browser and survives
     reload, resize and re-layout (stored as a fraction of the box, so a
     different window size keeps the arrangement rather than the pixels).
   • Cross two spokes and they WEAVE — the lower one is punched out and the
     upper one is redrawn over the gap, so the crossing reads as an over/
     under knot instead of a muddy X. New knots pop as they form. There is a
     live knot count in the control strip because it's funny and also tells
     you when your layout has got messy.
   • Ring size and node size sliders, plus Reset. Both persisted.
   Motion pass from v2 is intact: staggered assembly, hover energize, press
   feedback, ambient float. Entrance only plays on first assembly — it would
   be maddening if every drag replayed it.

   NO TOP-LEVEL DECLARATIONS
   Everything lives inside the IIFE and one window property. Top-level
   let/const in a classic script is global to every other module — a
   duplicate there is a SyntaxError that stops the *other* file executing.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var STORE_KEY = 'nexus_hub_layout_v1';
  var DEFAULTS  = { nodeSize: 84, ringScale: 1, nodes: {} };

  /* ─── prefs ──────────────────────────────────────────────────────────
     localStorage, not the DB. This is a per-device cosmetic arrangement —
     the same person on the office desktop and on a laptop plausibly wants
     different layouts, and it must never block page render on a fetch. */
  function loadPrefs(){
    try{
      var raw = localStorage.getItem(STORE_KEY);
      if(!raw) return JSON.parse(JSON.stringify(DEFAULTS));
      var p = JSON.parse(raw);
      return {
        nodeSize : typeof p.nodeSize  === 'number' ? p.nodeSize  : DEFAULTS.nodeSize,
        ringScale: typeof p.ringScale === 'number' ? p.ringScale : DEFAULTS.ringScale,
        nodes    : (p.nodes && typeof p.nodes === 'object') ? p.nodes : {}
      };
    }catch(e){ return JSON.parse(JSON.stringify(DEFAULTS)); }
  }
  function savePrefs(p){
    try{ localStorage.setItem(STORE_KEY, JSON.stringify(p)); }catch(e){}
  }

  /* Stable key per node. The cards carry id="hubcard-xxx"; fall back to the
     title text so a card without an id still remembers where it was put. */
  function nodeKey(card){
    if(card.id) return card.id;
    var t = card.querySelector('.hub-card-title');
    return 't:' + ((t && t.textContent.trim()) || 'unknown');
  }

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
      --hub-node-size: 84px;
      touch-action: none;
    }
    /* NODES, not cards.
       A 168px rectangle sitting on a ring still reads as a card — which is
       why the ring version looked like the grid version. The node is now a
       circle holding just the icon, with the label sitting outside it. */
    .hub-radial .hub-card{
      position: absolute;
      width: var(--hub-node-size); height: var(--hub-node-size);
      padding: 0;
      margin: 0;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: translate(-50%, -50%);
      transition: box-shadow .28s cubic-bezier(.2,0,0,1),
                  border-color .2s ease,
                  opacity .2s ease;
      z-index: 2;
      overflow: visible;
      cursor: grab;
      user-select: none;
      -webkit-user-select: none;
      --hub-i: 0;
    }
    /* DRAG (state feedback): the node lifts off the page and the ambient
       float stops, so it feels picked up rather than smeared around. */
    .hub-radial .hub-card.hub-dragging{
      cursor: grabbing;
      z-index: 9;
      box-shadow: 0 22px 44px -18px rgba(30,27,75,.6);
      transition: box-shadow .16s cubic-bezier(.2,0,0,1);
    }
    .hub-radial .hub-card.hub-dragging .hub-card-icon svg{
      transform: scale(1.12);
    }
    .hub-radial.hub-is-dragging .hub-card:not(.hub-dragging){ opacity: .5; }

    /* HOVER (secondary layer): lift + scale, shadow lands late. */
    .hub-radial .hub-card:hover{
      border-color: var(--accent, #6366f1);
      z-index: 5;
      box-shadow: 0 14px 30px -14px rgba(30,27,75,.5);
    }
    /* PRESS: quick, firm. Scale lives on the SVG, never on .hub-card-icon —
       see the float note below. */
    .hub-radial .hub-card:active .hub-card-icon svg{
      transform: scale(.9);
      transition: transform .12s cubic-bezier(.3,0,.3,1);
    }
    /* .hub-card-icon carries the ambient float and NOTHING ELSE.
       It must never receive a transform declaration, because a running
       animation's computed value overrides plain declarations — the transform
       would silently do nothing. And it must never be paused, because pausing
       freezes it at whatever phase of the 5.2s cycle it happened to reach,
       snapping the icon up to 3px in a random direction. That was the click
       jump. Hover/press/drag scale goes on the child <svg> instead: the parent
       translates, the child scales, and the two compose without fighting. */
    .hub-radial .hub-card-icon{
      margin: 0;
      width: 48%; height: 48%;
      display: flex; align-items: center; justify-content: center;
      pointer-events: none;
    }
    .hub-radial .hub-card-icon svg{
      width: calc(var(--hub-node-size) * .31);
      height: calc(var(--hub-node-size) * .31);
      transition: transform .2s cubic-bezier(.2,0,0,1);
    }
    /* Label hangs below the circle, outside it. */
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

    /* ── ENTRANCE (primary layer) — first assembly only ─────────────── */
    .hub-radial.hub-anim-in .hub-card{
      animation: hubNodeIn .46s cubic-bezier(.05,.7,.1,1) both;
      animation-delay: calc(var(--hub-i) * 70ms + 60ms);
    }
    @keyframes hubNodeIn{
      0%  { opacity: 0; transform: translate(-50%, -50%) scale(.4); }
      60% { opacity: 1; }
      100%{ opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
    /* AMBIENT float, phase-offset per node. */
    .hub-radial .hub-card .hub-card-icon{
      animation: hubFloat 5.2s ease-in-out infinite;
      animation-delay: calc(var(--hub-i) * -0.9s);
    }
    @keyframes hubFloat{
      0%,100%{ transform: translateY(0)   scale(1); }
      50%    { transform: translateY(-3px) scale(1); }
    }
    .hub-radial .hub-card:hover .hub-card-icon svg{
      transform: scale(1.1);
    }

    /* ── spokes ─────────────────────────────────────────────────────── */
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
    /* Land at 0 and STAY at 0. Nothing on hover may touch dashoffset — when
       a one-shot animation ends the offset snaps back to the declared value,
       and if that value were --len the whole line would vanish. */
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
    .hub-radial .hub-spoke.lit{
      animation: hubLit .3s cubic-bezier(.2,0,0,1) both;
    }
    @keyframes hubLit{
      from{ stroke-width: 2.5; }
      to  { stroke-width: 3.5; }
    }
    /* ── neighbour chain ─────────────────────────────────────────────────
       Links each node to the next one IN ORDER. This is what makes tangling
       possible at all: spokes are rays from a shared centre, and rays from a
       common origin can only ever meet at that origin — a pure hub-and-spoke
       diagram is mathematically incapable of crossing itself. The chain is
       made of chords between nodes, and chords cross constantly once you
       drag a node out of its place in the order.
       Deliberately lighter than the spokes so the hub stays the main read. */
    .hub-chain{
      stroke: var(--border-color, #d8dee9);
      stroke-width: 1.5;
      stroke-linecap: round;
      opacity: .42;
      transition: stroke .28s cubic-bezier(.2,0,0,1), opacity .28s ease;
    }
    .hub-chain.lit{ stroke: var(--accent, #6366f1); opacity: .85; }
    .hub-radial.hub-anim-in .hub-chain{
      animation: hubChainIn .45s cubic-bezier(.05,.7,.1,1) both;
      animation-delay: calc(var(--d) + 260ms);
    }
    @keyframes hubChainIn{
      from{ opacity: 0; } to{ opacity: .42; }
    }
    /* Terminal dot where the spoke meets its node. */
    .hub-node-dot{
      fill: var(--surface, #fff);
      stroke: var(--border-color, #d8dee9);
      stroke-width: 2.5;
      transform-box: fill-box;
      transform-origin: center;
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
      stroke: var(--accent, #6366f1); fill: var(--accent, #6366f1);
      animation: hubDotPop .3s cubic-bezier(.175,.885,.32,1.275);
    }
    @keyframes hubDotPop{
      0%  { transform: scale(1); }
      45% { transform: scale(1.55); }
      100%{ transform: scale(1); }
    }

    /* ── KNOTS ───────────────────────────────────────────────────────────
       Where two spokes cross, the lower one is punched out with a surface-
       coloured gap and the upper one is redrawn across it. That over/under
       weave is what makes a crossing read as a knot rather than a smudge. */
    .hub-knot-gap{
      fill: var(--surface, #fff);
      stroke: none;
      transform-box: fill-box;
      transform-origin: center;
    }
    .hub-knot-over{
      stroke: var(--border-color, #d8dee9);
      stroke-width: 2.5;
      stroke-linecap: round;
    }
    .hub-knot-over.chain{ stroke-width: 1.5; opacity: .42; }
    .hub-knot-ring{
      fill: none;
      stroke: var(--accent, #6366f1);
      stroke-width: 1.5;
      opacity: .3;
      transform-box: fill-box;
      transform-origin: center;
    }
    /* A newly formed knot pops once, then sits still. Playful, not noisy. */
    .hub-knot-ring.fresh{
      animation: hubKnotPop .42s cubic-bezier(.175,.885,.32,1.275);
    }
    @keyframes hubKnotPop{
      0%  { transform: scale(.2); opacity: .9; }
      60% { transform: scale(1.25); opacity: .5; }
      100%{ transform: scale(1); opacity: .3; }
    }

    /* Everything except the hovered node steps back. */
    .hub-radial.dimmed .hub-card:not(:hover){ opacity: .4; }

    /* ── the centre ─────────────────────────────────────────────────── */
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
      pointer-events: none;
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
      color: var(--accent, #6366f1);
      line-height: 1;
      letter-spacing: -.02em;
    }
    .hub-core-sub{
      font-size: 10px; font-weight: 700;
      letter-spacing: .1em; text-transform: uppercase;
      color: var(--text-dim, #94a3b8);
    }
    .hub-radial .hub-card-arrow{ display: none; }

    /* ── control strip ──────────────────────────────────────────────── */
    .hub-ctl{
      display: flex; align-items: center; gap: 18px;
      max-width: 820px;
      margin: 0 auto;
      padding: 9px 14px;
      border: 1px solid var(--border-color, #d8dee9);
      border-radius: 12px;
      background: var(--surface, #fff);
      font-size: 12px;
      color: var(--text-dim, #94a3b8);
      opacity: .55;
      transition: opacity .22s cubic-bezier(.2,0,0,1);
    }
    .hub-ctl:hover{ opacity: 1; }
    .hub-ctl label{
      display: flex; align-items: center; gap: 7px;
      font-weight: 600; letter-spacing: .02em;
      text-transform: uppercase; font-size: 10px;
      white-space: nowrap;
    }
    .hub-ctl input[type=range]{
      width: 96px; height: 3px; cursor: pointer;
      accent-color: var(--accent, #6366f1);
    }
    .hub-ctl-spacer{ flex: 1; }
    .hub-ctl-knots{
      font-weight: 700; font-size: 10px;
      letter-spacing: .08em; text-transform: uppercase;
      transition: color .3s ease;
    }
    .hub-ctl-knots.tangled{ color: var(--accent, #6366f1); }
    .hub-ctl-reset{
      border: 1px solid var(--border-color, #d8dee9);
      background: transparent;
      color: inherit;
      font: inherit;
      font-weight: 600; font-size: 10px;
      letter-spacing: .06em; text-transform: uppercase;
      padding: 5px 11px;
      border-radius: 7px;
      cursor: pointer;
      transition: border-color .2s ease, color .2s ease, transform .14s cubic-bezier(.2,0,0,1);
    }
    .hub-ctl-reset:hover{ border-color: var(--accent, #6366f1); color: var(--accent, #6366f1); }
    .hub-ctl-reset:active{ transform: scale(.94); }
  }
  /* The strip is desktop-only, same as the ring. */
  @media (max-width: 899px){ .hub-ctl{ display: none; } }

  @media (prefers-reduced-motion: reduce){
    .hub-radial .hub-card{ animation: none; }
    .hub-radial .hub-card .hub-card-icon{ animation: none; }
    .hub-radial .hub-card-icon svg{ transition: none; }
    .hub-radial .hub-card:hover .hub-card-icon svg,
    .hub-radial .hub-card:active .hub-card-icon svg,
    .hub-radial .hub-card.hub-dragging .hub-card-icon svg{ transform: none; }
    .hub-radial .hub-card:hover .hub-card-body{ transform: translateX(-50%); }
    .hub-radial .hub-spoke{ animation: none; stroke-dashoffset: 0; }
    .hub-radial .hub-spoke.lit{ animation: none; stroke-width: 3.5; }
    .hub-radial .hub-node-dot{ animation: none; opacity: 1; transform: none; }
    .hub-radial .hub-node-dot.lit{ animation: none; }
    .hub-knot-ring.fresh{ animation: none; }
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

  /* ─── geometry helpers ──────────────────────────────────────────────── */

  /* Segment/segment intersection. Returns the point or null.
     Endpoints are excluded (eps) because every spoke shares the core end —
     without that, all N spokes would "cross" at the hub and we'd draw a
     knot pile in the middle of the diagram. */
  function segIntersect(a1,a2,b1,b2){
    var d1x=a2.x-a1.x, d1y=a2.y-a1.y;
    var d2x=b2.x-b1.x, d2y=b2.y-b1.y;
    var den = d1x*d2y - d1y*d2x;
    if(Math.abs(den) < 1e-6) return null;      // parallel
    var t = ((b1.x-a1.x)*d2y - (b1.y-a1.y)*d2x) / den;
    var u = ((b1.x-a1.x)*d1y - (b1.y-a1.y)*d1x) / den;
    var eps = 0.06;
    if(t < eps || t > 1-eps || u < eps || u > 1-eps) return null;
    return { x: a1.x + t*d1x, y: a1.y + t*d1y };
  }

  function svgEl(name, cls){
    var e = document.createElementNS('http://www.w3.org/2000/svg', name);
    if(cls) e.setAttribute('class', cls);
    return e;
  }

  /* ─── module state (all inside the IIFE — no globals) ───────────────── */
  var prefs      = loadPrefs();
  var knownKnots = {};    // signature -> true, so only NEW knots pop
  var firstRun   = true;
  var dragging   = null;

  /* ─── draw spokes + knots from wherever the nodes currently are ─────── */
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

    var segs = [];
    cards.forEach(function(card, i){
      var x = parseFloat(card.style.left) || cx;
      var y = parseFloat(card.style.top)  || cy;

      // Trim the spoke at both ends along the REAL direction from centre to
      // node, not along the ring angle. On an ellipse those differ, and using
      // the angle pulls spoke ends sideways so they appear to aim at the
      // wrong node. With free dragging there's no angle to use at all.
      var dx = x-cx, dy = y-cy;
      var d  = Math.hypot(dx,dy) || 1;
      var ux = dx/d, uy = dy/d;
      var p1 = { x: cx + 74*ux,        y: cy + 74*uy };
      var p2 = { x: x - (half+4)*ux,   y: y - (half+4)*uy };

      // Node dragged inside the core — nothing sensible to draw.
      if(d < 74 + half + 10){ segs.push(null); return; }

      var line = svgEl('line','hub-spoke');
      line.setAttribute('x1',p1.x); line.setAttribute('y1',p1.y);
      line.setAttribute('x2',p2.x); line.setAttribute('y2',p2.y);
      line.style.setProperty('--len', Math.hypot(p2.x-p1.x, p2.y-p1.y));
      line.style.setProperty('--d', (i*70)+'ms');
      // Stamp the owning node index. Looking edges up by their position in
      // querySelectorAll breaks the moment one is skipped (node dragged into
      // the core, or two nodes overlapping) — every index after it shifts and
      // hovering lights a line belonging to a different app.
      line.dataset.node = i;
      svg.appendChild(line);

      var dot = svgEl('circle','hub-node-dot');
      dot.setAttribute('cx',p2.x); dot.setAttribute('cy',p2.y);
      dot.setAttribute('r',5);
      dot.style.setProperty('--d', (i*70+260)+'ms');
      dot.dataset.node = i;
      svg.appendChild(dot);

      segs.push({ p1:p1, p2:p2, key:nodeKey(card), kind:'spoke' });
    });

    /* ── the neighbour chain ──────────────────────────────────────────
       Node i links to node i+1 IN DOM ORDER, closing the loop. Order is
       fixed on purpose: if the chain re-sorted itself by angle it would
       untangle automatically and could never knot. Because the order is
       fixed, dragging a node past its neighbours drags its two chords
       across the diagram — which is exactly where the knots come from. */
    var centers = [];
    cards.forEach(function(card){
      centers.push({
        x: parseFloat(card.style.left) || cx,
        y: parseFloat(card.style.top)  || cy,
        key: nodeKey(card)
      });
    });
    var chains = [];
    if(centers.length > 2){
      centers.forEach(function(a, i){
        var b = centers[(i+1) % centers.length];
        var ddx = b.x-a.x, ddy = b.y-a.y;
        var dd  = Math.hypot(ddx,ddy) || 1;
        // Two nodes sitting almost on top of each other: no room for a chord.
        if(dd < prefs.nodeSize + 16) { chains.push(null); return; }
        var cux = ddx/dd, cuy = ddy/dd;
        var q1 = { x: a.x + (half+4)*cux, y: a.y + (half+4)*cuy };
        var q2 = { x: b.x - (half+4)*cux, y: b.y - (half+4)*cuy };

        var cl = svgEl('line','hub-chain');
        cl.setAttribute('x1',q1.x); cl.setAttribute('y1',q1.y);
        cl.setAttribute('x2',q2.x); cl.setAttribute('y2',q2.y);
        cl.style.setProperty('--d', (i*70)+'ms');
        cl.dataset.a = i;
        cl.dataset.b = (i+1) % centers.length;
        svg.appendChild(cl);
        chains.push({ p1:q1, p2:q2, key:'c'+a.key+'>'+b.key, kind:'chain' });
      });
    }

    // Knot detection runs over spokes AND chains together.
    var edges = segs.concat(chains);

    /* ── weave the crossings ──────────────────────────────────────────
       Painted after all the lines so the gap + over-stub sit on top. The
       lower-indexed spoke wins and goes over — arbitrary but stable, which
       matters more than which one wins: a crossing that flips its weave as
       you drag looks broken. */
    var knotCount = 0;
    var seen = {};
    for(var i=0;i<edges.length;i++){
      for(var j=i+1;j<edges.length;j++){
        if(!edges[i] || !edges[j]) continue;
        var pt = segIntersect(edges[i].p1, edges[i].p2, edges[j].p1, edges[j].p2);
        if(!pt) continue;
        knotCount++;

        var sig = edges[i].key + '|' + edges[j].key;
        seen[sig] = true;
        var isNew = !knownKnots[sig];
        knownKnots[sig] = true;

        // punch the gap in the UNDER line (j)
        var gap = svgEl('circle','hub-knot-gap');
        gap.setAttribute('cx',pt.x); gap.setAttribute('cy',pt.y);
        gap.setAttribute('r',7);
        svg.appendChild(gap);

        // redraw a stub of the OVER line (i) across the gap
        var ax = edges[i].p2.x - edges[i].p1.x;
        var ay = edges[i].p2.y - edges[i].p1.y;
        var al = Math.hypot(ax,ay) || 1;
        var sx = ax/al, sy = ay/al, L = 10;
        var over = svgEl('line','hub-knot-over' +
                         (edges[i].kind === 'chain' ? ' chain' : ''));
        over.setAttribute('x1', pt.x - L*sx); over.setAttribute('y1', pt.y - L*sy);
        over.setAttribute('x2', pt.x + L*sx); over.setAttribute('y2', pt.y + L*sy);
        svg.appendChild(over);

        var ring = svgEl('circle','hub-knot-ring' + (isNew && !firstRun ? ' fresh' : ''));
        ring.setAttribute('cx',pt.x); ring.setAttribute('cy',pt.y);
        ring.setAttribute('r',9);
        svg.appendChild(ring);
      }
    }
    // forget knots that no longer exist, so re-tangling pops again
    Object.keys(knownKnots).forEach(function(k){ if(!seen[k]) delete knownKnots[k]; });

    var readout = document.querySelector('#page-hub .hub-ctl-knots');
    if(readout){
      readout.textContent = knotCount === 0 ? 'No knots'
                          : knotCount === 1 ? '1 knot' : knotCount + ' knots';
      readout.classList.toggle('tangled', knotCount > 0);
    }
  }

  /* ─── drag ──────────────────────────────────────────────────────────── */
  function bindDrag(card, grid){
    if(card.dataset.hubDragBound) return;
    card.dataset.hubDragBound = '1';

    card.addEventListener('dragstart', function(e){ e.preventDefault(); });

    card.addEventListener('pointerdown', function(e){
      if(e.button !== 0) return;
      if(window.innerWidth < 900) return;
      dragging = {
        card: card,
        moved: false,
        startX: e.clientX, startY: e.clientY,
        originX: parseFloat(card.style.left) || 0,
        originY: parseFloat(card.style.top)  || 0
      };
      card.setPointerCapture(e.pointerId);
    });

    card.addEventListener('pointermove', function(e){
      if(!dragging || dragging.card !== card) return;
      var dx = e.clientX - dragging.startX;
      var dy = e.clientY - dragging.startY;
      // 4px slop so a normal click isn't read as a micro-drag
      if(!dragging.moved && Math.hypot(dx,dy) < 4) return;
      if(!dragging.moved){
        dragging.moved = true;
        card.classList.add('hub-dragging');
        grid.classList.add('hub-is-dragging');
        grid.classList.remove('dimmed');
      }
      var pad = prefs.nodeSize/2 + 6;
      var W = grid.clientWidth, H = grid.clientHeight;
      var nx = Math.max(pad, Math.min(W - pad, dragging.originX + dx));
      // extra bottom padding so the label never clips out of the box
      var ny = Math.max(pad, Math.min(H - pad - 22, dragging.originY + dy));
      card.style.left = nx + 'px';
      card.style.top  = ny + 'px';
      redraw(grid);
    });

    function endDrag(e){
      if(!dragging || dragging.card !== card) return;
      var wasMoved = dragging.moved;
      card.classList.remove('hub-dragging');
      grid.classList.remove('hub-is-dragging');
      try{ card.releasePointerCapture(e.pointerId); }catch(err){}

      if(wasMoved){
        // Store as a FRACTION of the box, not pixels — a different window
        // size then keeps the arrangement instead of shoving nodes off-box.
        var W = grid.clientWidth, H = grid.clientHeight;
        prefs.nodes[nodeKey(card)] = {
          fx: (parseFloat(card.style.left)||0) / W,
          fy: (parseFloat(card.style.top) ||0) / H
        };
        savePrefs(prefs);
        // Suppress the navigation this <a> would otherwise fire on release.
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
  function ensureControls(grid){
    var page = document.getElementById('page-hub');
    if(!page || page.querySelector('.hub-ctl')) return;

    var bar = document.createElement('div');
    bar.className = 'hub-ctl';
    bar.innerHTML =
      '<label>Ring <input type="range" class="hub-ctl-ring" min="60" max="130" step="1"></label>' +
      '<label>Node <input type="range" class="hub-ctl-size" min="64" max="120" step="1"></label>' +
      '<span class="hub-ctl-spacer"></span>' +
      '<span class="hub-ctl-knots">No knots</span>' +
      '<button type="button" class="hub-ctl-reset">Reset</button>';
    grid.parentNode.insertBefore(bar, grid);

    var ring = bar.querySelector('.hub-ctl-ring');
    var size = bar.querySelector('.hub-ctl-size');
    ring.value = Math.round(prefs.ringScale * 100);
    size.value = prefs.nodeSize;

    ring.addEventListener('input', function(){
      prefs.ringScale = parseInt(ring.value,10) / 100;
      savePrefs(prefs);
      // Resizing the ring only moves nodes still ON the ring; anything the
      // user has deliberately placed keeps its spot.
      layout(true);
    });
    size.addEventListener('input', function(){
      prefs.nodeSize = parseInt(size.value,10);
      savePrefs(prefs);
      grid.style.setProperty('--hub-node-size', prefs.nodeSize + 'px');
      redraw(grid);
    });
    bar.querySelector('.hub-ctl-reset').addEventListener('click', function(){
      prefs = JSON.parse(JSON.stringify(DEFAULTS));
      savePrefs(prefs);
      ring.value = 100; size.value = DEFAULTS.nodeSize;
      knownKnots = {};
      layout(true);
    });
  }

  /**
   * Lay the visible cards out and draw the diagram.
   *
   * Recomputed every time the page opens, because access gating decides how
   * many cards are visible — a 2-app user and a 6-app user need different
   * angles, and a ring built for six with four hidden looks broken.
   *
   * @param {boolean} keepPlacement  true when re-running for a slider/reset,
   *                                 so the entrance animation doesn't replay.
   */
  function layout(keepPlacement){
    var grid = document.querySelector('#page-hub .hub-grid');
    if(!grid) return;

    // Below the breakpoint the CSS grid takes over; strip our positioning so
    // nothing is left absolutely placed at a stale coordinate.
    if(window.innerWidth < 900){
      grid.classList.remove('hub-radial','hub-anim-in');
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
    grid.style.setProperty('--hub-node-size', prefs.nodeSize + 'px');
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

    // Start at the top and go clockwise — a ring that starts at 3 o'clock
    // reads as arbitrary; starting at 12 reads as deliberate.
    var n = cards.length;
    cards.forEach(function(card, i){
      var saved = prefs.nodes[nodeKey(card)];
      var x, y;
      if(saved && typeof saved.fx === 'number'){
        x = saved.fx * W;
        y = saved.fy * H;
        var pad = half + 6;
        x = Math.max(pad, Math.min(W - pad, x));
        y = Math.max(pad, Math.min(H - pad - 22, y));
      }else{
        var a = (-Math.PI/2) + (i * 2*Math.PI / n);
        x = cx + rx*Math.cos(a);
        y = cy + ry*Math.sin(a);
      }
      card.style.left = x + 'px';
      card.style.top  = y + 'px';
      card.style.setProperty('--hub-i', i);
      card.dataset.spokeIdx = i;

      bindDrag(card, grid);

      // Light the matching spoke + dot on hover and step the others back.
      if(!card.dataset.spokeBound){
        card.dataset.spokeBound = '1';
        card.addEventListener('mouseenter', function(){
          if(dragging) return;
          var svgNow = grid.querySelector('.hub-spokes');
          if(!svgNow) return;
          var idx = parseInt(card.dataset.spokeIdx,10);
          if(isNaN(idx)) return;
          var l  = svgNow.querySelector('.hub-spoke[data-node="'+idx+'"]');
          var dd = svgNow.querySelector('.hub-node-dot[data-node="'+idx+'"]');
          if(l)  l.classList.add('lit');
          if(dd) dd.classList.add('lit');
          // light both chain links that touch this node, so hovering shows
          // the node's full set of connections rather than just its spoke
          Array.prototype.forEach.call(
            svgNow.querySelectorAll('.hub-chain[data-a="'+idx+'"], .hub-chain[data-b="'+idx+'"]'),
            function(el){ el.classList.add('lit'); });
          grid.classList.add('dimmed');
        });
        card.addEventListener('mouseleave', function(){
          var svgNow = grid.querySelector('.hub-spokes');
          if(svgNow){
            Array.prototype.forEach.call(
              svgNow.querySelectorAll('.hub-spoke,.hub-node-dot,.hub-chain'),
              function(el){ el.classList.remove('lit'); });
          }
          grid.classList.remove('dimmed');
        });
      }
    });

    // Entrance plays on first assembly only — replaying it on every drag,
    // slider nudge or access re-check would be maddening.
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
    // become visible between the first paint and the app_access fetch landing.
    layout();
    setTimeout(function(){ layout(true); }, 400);
    setTimeout(function(){ layout(true); }, 1200);
  };

  window.addEventListener('resize', relayout);
})();
