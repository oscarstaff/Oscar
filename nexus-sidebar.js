/* ════════════════════════════════════════════════════════════════════════
   NEXUS · COLLAPSIBLE SIDEBAR   (nexus-sidebar.js + nexus-sidebar.css)
   Adds a collapse/expand button beside the profile row at the top of the desktop sidebar
   (right end of the row when open, under the avatar when collapsed) and, when collapsed,
   opens Library / My Time as a small flyout so their labels are not clipped.
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
    btn.innerHTML = c ? CHEV_R : CHEV_L;
    syncTitles();
  }

  function toggle(btn){
    var next = isCollapsed() ? 'expanded' : 'collapsed';
    var sb = document.querySelector('.sidebar');
    try{ localStorage.setItem(KEY, next); }catch(e){}
    document.documentElement.setAttribute('data-sb', next);
    if(sb){ sb.classList.add('sb-animating'); setTimeout(function(){ sb.classList.remove('sb-animating'); }, 450); }
    try{ if(typeof updateSbSwitch === 'function') updateSbSwitch(); }catch(e){}
    clearFly();
    paint(btn);
  }

  function clearFly(){
    Array.prototype.forEach.call(document.querySelectorAll('.nav-group.sb-fly'), function(g){ g.classList.remove('sb-fly'); });
  }

  /* Collapsed rail: a group parent (My Time, Library) opens its children as a flyout beside the rail. */
  function wrapGroups(){
    var orig = window.toggleNavGroup;
    if(typeof orig !== 'function' || orig._sbWrapped) return;
    var wrapped = function(id){
      if(!isCollapsed()) return orig.apply(this, arguments);
      var g = document.getElementById('navg-' + id);
      if(!g) return;
      var was = g.classList.contains('sb-fly');
      clearFly();
      if(was) return;
      var parent = g.querySelector('.nav-parent'), kids = g.querySelector('.nav-children');
      if(parent && kids){ var r = parent.getBoundingClientRect(); kids.style.top = Math.max(8, r.top) + 'px'; }
      g.classList.add('sb-fly');
    };
    wrapped._sbWrapped = true;
    window.toggleNavGroup = wrapped;
    document.addEventListener('click', function(e){
      if(!isCollapsed()) return;
      if(e.target.closest && e.target.closest('.nav-parent')) return;
      clearFly();
    });
    window.addEventListener('resize', clearFly);
  }

  function mount(){
    var sb = document.querySelector('.sidebar');
    if(!sb || document.getElementById('sbCollapseBtn')) return;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'sbCollapseBtn'; btn.className = 'sb-collapse-btn';
    btn.onclick = function(e){ e.stopPropagation(); toggle(btn); };   /* the profile row opens Profile; this must not */
    var who = sb.querySelector('.sb-user');
    if(who){ who.classList.add('has-sbc'); who.appendChild(btn); }
    else{ var nav0 = sb.querySelector('.sb-nav'); sb.insertBefore(btn, nav0 || null); }
    paint(btn);
    wrapGroups();
    document.addEventListener('keydown', function(e){
      if(e.key !== '[' || e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target, tag = t && t.tagName;
      if(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
      if(window.innerWidth <= 900) return;
      toggle(btn);
    });
    /* nav items revealed later (e.g. Manager Tools for admins) get their tooltips too */
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
