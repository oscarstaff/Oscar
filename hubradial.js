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
      height: 560px;
      margin: 8px auto 0;
      max-width: 760px;
    }
    .hub-radial .hub-card{
      position: absolute;
      width: 168px;
      margin: 0;
      transform: translate(-50%, -50%);
      transition: transform .22s cubic-bezier(.2,.9,.3,1.15), box-shadow .22s ease;
      z-index: 2;
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
      transition: stroke .22s ease;
    }
    .hub-spoke.lit{ stroke: var(--accent, #6366f1); }

    /* The centre — the thing all the spokes come from. */
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
    .hub-radial .hub-card{ flex-direction: column; text-align: center; gap: 8px; padding: 16px 12px; }
    .hub-radial .hub-card-body{ text-align: center; }
  }
  @media (prefers-reduced-motion: reduce){
    .hub-radial .hub-card{ transition: none; }
    .hub-radial .hub-card:hover{ transform: translate(-50%, -50%); }
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
    var rx = Math.max(180, Math.min(W/2 - 96, 300));
    var ry = Math.max(150, Math.min(H/2 - 62, 220));

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

      // Stop the spoke short of the core and the card so it reads as a
      // connector rather than a line running underneath them.
      var line = document.createElementNS('http://www.w3.org/2000/svg','line');
      line.setAttribute('class','hub-spoke');
      line.setAttribute('x1', cx + 66 * Math.cos(a));
      line.setAttribute('y1', cy + 66 * Math.sin(a));
      line.setAttribute('x2', x - 46 * Math.cos(a));
      line.setAttribute('y2', y - 46 * Math.sin(a));
      svg.appendChild(line);

      // Light the matching spoke on hover, so the connection is legible.
      if(!card.dataset.spokeBound){
        card.dataset.spokeBound = '1';
        card.addEventListener('mouseenter', function(){
          var l = svg.querySelectorAll('.hub-spoke')[i];
          if(l) l.classList.add('lit');
        });
        card.addEventListener('mouseleave', function(){
          Array.prototype.forEach.call(svg.querySelectorAll('.hub-spoke'), function(l){
            l.classList.remove('lit');
          });
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
