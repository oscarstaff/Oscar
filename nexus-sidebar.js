/* ════════════════════════════════════════════════════════════════════════
   NEXUS · COLLAPSIBLE SIDEBAR   (nexus-sidebar.js + nexus-sidebar.css)
   Adds a collapse/expand button at the bottom of the desktop sidebar.
   It drives the compact sidebar that index.html already styles:
     <html data-sb="collapsed|expanded">  +  localStorage 'oscars_sb'
   (the same key initAppearance() in nexus-ui.js reads on load and
   resetAppearance() clears), so the choice is remembered per browser.
   Shortcut: press [ to toggle (ignored while typing).
   Does nothing on phones: the sidebar is hidden there (index.html, 900px).
   REVERT: remove the <script> and <link> for these two files.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var KEY = 'oscars_sb';
  /* ids that already have a hover label in index.html's compact-sidebar CSS */
  var HAS_TIP = { 'nav-home':1, 'nav-schedule':1, 'nav-updates':1, 'nav-myreports':1, 'nav-leave':1,
                  'nav-tasks':1, 'nav-documents':1, 'nav-profile':1, 'nav-team':1 };
  var CHEV_L = '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5l-5 5 5 5"/></svg>';
  var CHEV_R = '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 5l5 5-5 5"/></svg>';

  function isCollapsed(){ return document.documentElement.getAttribute('data-sb') === 'collapsed'; }

  function labelOf(el){
    var c = el.cloneNode(true);
    Array.prototype.forEach.call(c.querySelectorAll('svg,.nav-badge,.nav-chev'), function(x){ x.remove(); });
    return (c.textContent || '').replace(/\s+/g, ' ').trim();
  }

  /* Items without a CSS hover label get a native tooltip while collapsed. */
  function syncTitles(){
    var items = document.querySelectorAll('.sidebar .nav-item, .sidebar .nav-child');
    Array.prototype.forEach.call(items, function(el){
      if(el.id && HAS_TIP[el.id]) return;
      if(isCollapsed()){
        if(!el.hasAttribute('title')){ var l = labelOf(el); if(l){ el.setAttribute('title', l); el.setAttribute('data-sb-title', '1'); } }
      }else if(el.getAttribute('data-sb-title')){
        el.removeAttribute('title'); el.removeAttribute('data-sb-title');
      }
    });
  }

  function paint(btn){
    var c = isCollapsed();
    btn.setAttribute('aria-expanded', c ? 'false' : 'true');
    btn.setAttribute('aria-label', c ? 'Expand sidebar' : 'Collapse sidebar');
    btn.setAttribute('title', c ? 'Expand sidebar  [' : 'Collapse sidebar  [');
    btn.innerHTML = (c ? CHEV_R : CHEV_L) + '<span class="sbc-label">Collapse</span>';
    syncTitles();
  }

  function toggle(btn){
    var next = isCollapsed() ? 'expanded' : 'collapsed';
    var sb = document.querySelector('.sidebar');
    try{ localStorage.setItem(KEY, next); }catch(e){}
    document.documentElement.setAttribute('data-sb', next);
    if(sb){ sb.classList.add('sb-animating'); setTimeout(function(){ sb.classList.remove('sb-animating'); }, 450); }
    try{ if(typeof updateSbSwitch === 'function') updateSbSwitch(); }catch(e){}
    paint(btn);
  }

  function mount(){
    var sb = document.querySelector('.sidebar');
    if(!sb || document.getElementById('sbCollapseBtn')) return;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'sbCollapseBtn'; btn.className = 'sb-collapse-btn';
    btn.onclick = function(){ toggle(btn); };
    var foot = sb.querySelector('.sb-foot');
    if(foot) sb.insertBefore(btn, foot); else sb.appendChild(btn);
    paint(btn);
    document.addEventListener('keydown', function(e){
      if(e.key !== '[' || e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target, tag = t && t.tagName;
      if(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
      if(window.innerWidth <= 900) return;
      toggle(btn);
    });
    /* nav items such as the CRM are revealed later; keep their tooltips in step */
    var nav = sb.querySelector('.sb-nav');
    if(nav && window.MutationObserver){
      new MutationObserver(function(){ if(isCollapsed()) syncTitles(); })
        .observe(nav, { attributes: true, attributeFilter: ['style'], subtree: true });
    }
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
  window.nxSidebar = { toggle: function(){ var b = document.getElementById('sbCollapseBtn'); if(b) toggle(b); }, isCollapsed: isCollapsed };
})();
