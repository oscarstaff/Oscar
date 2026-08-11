/* ═══════════════════════════════════════════════════════════════════════
   hubradial.js — REVERTED TO THE ORIGINAL NODES GRID
   Loaded by index.html:  <script src="hubradial.js?v=5"></script>

   The radial diagram is gone. This file does nothing except keep the
   window.hubRadialLayout() call in index.html from throwing.

   WHY A STUB INSTEAD OF DELETING THE FILE
   index.html calls hubRadialLayout() when the Nodes page opens. Removing
   the script without also removing that call throws a ReferenceError, which
   stops whatever function contains it — so the page could break rather than
   simply revert. A no-op keeps the call harmless.

   To remove it properly later: delete the <script src="hubradial.js"> tag
   from index.html AND the hubRadialLayout() call site, then delete this
   file. Order matters — remove the call first.

   It also clears the leftover saved layout so nothing from the radial
   version lingers, and strips any inline positioning left on the cards in
   case this loads over a page that already ran the old version.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  function cleanup(){
    var grid = document.querySelector('#page-hub .hub-grid');
    if(!grid) return;

    // Drop every class and element the radial version added.
    grid.classList.remove('hub-radial','hub-anim-in','hub-reform',
                          'hub-is-dragging','dimmed',
                          'hub-shape-circle','hub-shape-squircle',
                          'hub-shape-hexagon','hub-shape-diamond');
    grid.style.removeProperty('--hub-node-size');

    var svg  = grid.querySelector('.hub-spokes'); if(svg)  svg.remove();
    var core = grid.querySelector('.hub-core');   if(core) core.remove();

    var page = document.getElementById('page-hub');
    var ctl  = page && page.querySelector('.hub-ctl'); if(ctl) ctl.remove();

    var css = document.getElementById('hub-radial-css'); if(css) css.remove();

    // Clear the absolute positioning that pinned each card to the ring.
    Array.prototype.forEach.call(grid.querySelectorAll('.hub-card'), function(c){
      c.style.left = '';
      c.style.top  = '';
      c.style.removeProperty('--hub-i');
      c.classList.remove('hub-dragging');
    });
  }

  // Forget the saved shape, line style, sizes and dragged positions.
  try{ localStorage.removeItem('nexus_hub_layout_v1'); }catch(e){}

  window.hubRadialLayout = function(){ cleanup(); };

  if(document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', cleanup);
  else cleanup();
})();
