/* ════════════════════════════════════════════════════════════════════════
   NEXUS · PHONE MOTION + BEHAVIOUR  (v3)       pairs with nexus-mobile.css
   Loaded last. Does nothing on desktop widths. Never changes what a button does.
   · bottom bar: a lens that slides to the active tab (interruptible, from its live position)
   · header: turns to glass on scroll; the page title moves up into it
   · page changes: blocks fade in with a 28ms stagger (opacity only: Nexus has a no-travel rule for entrances)
   · press feedback on pointer-down
   · Profile: Save buttons light up only once something changed
   REVERT: remove the <script> for this file.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var phone  = window.matchMedia('(max-width:700px)');
  var reduce = window.matchMedia('(prefers-reduced-motion:reduce)');
  function $(s,r){ return (r||document).querySelector(s); }
  function $$(s,r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); }

  /* ── 1. Bottom bar lens ─────────────────────────────────────────────── */
  var grid=null, nav=null, lens=null, lensX=null, LENS_W=60;

  function lensTarget(item){
    var g=grid.getBoundingClientRect(), r=item.getBoundingClientRect();
    return (r.left-g.left)+r.width/2-LENS_W/2;
  }
  /* The lens is a critically damped spring (damping 1.0, response .44s): it has no fixed duration,
     so a second tap in mid-flight re-targets from its live position AND its live velocity.
     The stretch comes from the velocity itself, up to 12%. */
  var lx=0, lv=0, lastT=0, raf=0, RESP=.44;
  function paintLens(){
    lens.style.translate=lx.toFixed(2)+'px';
    var st=1+.12*Math.min(1,Math.abs(lv)/900);
    lens.style.scale=(st>1.002?st.toFixed(3):'1')+' 1';
  }
  function stepLens(now){
    var dt=Math.min(.034,(now-lastT)/1000)||.016; lastT=now;
    var w=2*Math.PI/RESP, k=w*w, c=2*w, n=2, h=dt/n;
    for(var i=0;i<n;i++){ lv+=(-k*(lx-lensX)-c*lv)*h; lx+=lv*h; }
    if(Math.abs(lx-lensX)<.08&&Math.abs(lv)<3){ lx=lensX; lv=0; raf=0; paintLens(); return; }
    paintLens(); raf=requestAnimationFrame(stepLens);
  }
  function snapLens(to){ if(raf){ cancelAnimationFrame(raf); raf=0; } lx=lensX=to; lv=0; paintLens(); }

  function placeLens(animate){
    if(!grid||!lens||!phone.matches) return;
    var act=$('.bn-item.active',grid);
    if(!act||!grid.getBoundingClientRect().width){ lens.style.opacity='0'; return; }
    var to=lensTarget(act);
    lens.style.opacity='1';
    if(!animate||reduce.matches||lensX===null){ snapLens(to); return; }
    lensX=to;
    if(!raf){ lastT=performance.now(); raf=requestAnimationFrame(stepLens); }
  }

  function initLens(){
    grid=$('#bottomNavGrid'); nav=$('.bottom-nav');
    if(!grid||!nav||lens) return;
    lens=document.createElement('span'); lens.className='bn-lens'; lens.setAttribute('aria-hidden','true');
    grid.insertBefore(lens,grid.firstChild); nav.classList.add('v3-on');
    new MutationObserver(function(){ placeLens(true); })
      .observe(grid,{attributes:true,attributeFilter:['class'],subtree:true});
    if(window.ResizeObserver){ new ResizeObserver(function(){ placeLens(false); }).observe(grid); }
    window.addEventListener('resize',function(){ placeLens(false); },{passive:true});
    placeLens(false);
  }

  /* ── 2. Header: glass on scroll, title hand-off ─────────────────────── */
  var hdr=null, main=null, rafScroll=0;
  function pageTitle(){
    var t=(document.title||'').replace(/^Nexus\s*[·\-]\s*/,'').trim();
    return t||'Nexus';
  }
  function syncHeader(){
    rafScroll=0;
    if(!hdr||!main) return;
    var y=main.scrollTop||0;
    hdr.classList.toggle('v3-scrolled',y>6);
    var big=$('.page.active .page-hd .page-title');
    var gone=y>6 && (!big || (big.getBoundingClientRect().bottom < (hdr.getBoundingClientRect().bottom+4)));
    hdr.classList.toggle('v3-title',!!gone);
    var lg=$('.mh-logo',hdr); if(lg && lg.textContent!==pageTitle()) lg.textContent=pageTitle();
  }
  function queueHeader(){ if(!rafScroll) rafScroll=requestAnimationFrame(syncHeader); }
  function initHeader(){
    hdr=$('.mobile-header'); main=$('.main'); if(!hdr||!main) return;
    main.addEventListener('scroll',queueHeader,{passive:true});
    syncHeader();
  }

  /* ── 3. Page transitions ────────────────────────────────────────────── */
  var lastPage=null, cleanupT=0, animated=[];
  function activePage(){ return $('.page.active'); }

  function blocksOf(page){
    var level=[page], depth=0, kids=[];
    while(depth<3){
      kids=[];
      level.forEach(function(el){
        Array.prototype.forEach.call(el.children,function(c){
          var tag=c.tagName;
          if(tag==='STYLE'||tag==='SCRIPT'||c.hidden) return;
          if(c.offsetParent===null && getComputedStyle(c).position!=='fixed') return;
          kids.push(c);
        });
      });
      if(kids.length>=3||!kids.length) break;
      level=kids; depth++;
    }
    return kids.slice(0,9);
  }
  function clearBlocks(){
    clearTimeout(cleanupT);
    animated.forEach(function(el){ el.classList.remove('v3-blk'); el.style.removeProperty('--i'); });
    animated=[];
    $$('.v3-in').forEach(function(p){ p.classList.remove('v3-in'); });
  }
  function enter(prev,next){
    var page=activePage(); if(!page||!phone.matches) return;
    clearBlocks();
    var blks=blocksOf(page);
    blks.forEach(function(el,i){ el.style.setProperty('--i',i); el.classList.add('v3-blk'); });
    animated=blks; page.classList.add('v3-in');
    cleanupT=setTimeout(clearBlocks, 300+blks.length*28+80);
  }
  function wrapGoTo(){
    var orig=window.goTo;
    if(typeof orig!=='function'||orig.__v3) return;
    var wrapped=function(p){
      var prev=lastPage, res;
      try{ res=orig.apply(this,arguments); }
      finally{
        var pg=activePage(), id=pg?pg.id.replace(/^page-/,''):null;
        if(id){
          if(prev!==null && id!==prev) enter(prev,id);
          lastPage=id;
          if(id==='profile') document.dispatchEvent(new Event('v3:profile-open'));
        }
        queueHeader();
      }
      return res;
    };
    wrapped.__v3=true; window.goTo=wrapped;
  }

  /* ── 4. Press feedback: instant, on pointer-down ────────────────────── */
  var PRESS='.btn,.cc-btn,.cc-btn2,.cc-btn3,.nx-row,.card-action,.hours-tab,.mh-user,.nx-mh-menu';
  document.addEventListener('pointerdown',function(e){
    if(!phone.matches||e.button>0) return;
    var t=e.target.closest&&e.target.closest(PRESS);
    if(!t||t.disabled||t.classList.contains('v3-save')&&!t.classList.contains('is-ready')) return;
    t.classList.add('v3-press');
    function off(){
      t.classList.remove('v3-press');
      ['pointerup','pointercancel','pointerleave'].forEach(function(n){ t.removeEventListener(n,off); });
    }
    ['pointerup','pointercancel','pointerleave'].forEach(function(n){ t.addEventListener(n,off); });
  },{passive:true});

  /* ── 5. Profile ─────────────────────────────────────────────────────── */
  function val(f){ return f.type==='checkbox'?(f.checked?'1':'0'):String(f.value||''); }
  function bindDirty(btnSel,fieldIds){
    var btn=$(btnSel), fields=fieldIds.map(function(id){ return document.getElementById(id); }).filter(Boolean);
    if(!btn||!fields.length||btn.__v3) return; btn.__v3=true;
    var card=btn.closest('.card')||btn.parentNode, base=null;
    btn.classList.add('v3-save');
    function snap(){ base=fields.map(val); }
    function check(){
      var dirty=base!==null && fields.some(function(f,i){ return val(f)!==base[i]; });
      btn.classList.toggle('is-ready',dirty);
    }
    /* take the baseline when someone starts editing, so values filled in from the server count as clean */
    card.addEventListener('focusin',function(){ if(base===null) snap(); },true);
    card.addEventListener('pointerdown',function(){ if(base===null) snap(); },true);
    card.addEventListener('input',check,true);
    card.addEventListener('change',check,true);
    btn.addEventListener('click',function(){ setTimeout(function(){ snap(); check(); },700); });
    document.addEventListener('v3:profile-open',function(){ base=null; btn.classList.remove('is-ready'); });
  }
  function initProfile(){
    var w=document.getElementById('profAvaWrap'), card=w&&w.closest('.card');
    if(card) card.classList.add('v3-hero');
    bindDirty('button[onclick*="saveMyNickname"]',['profNickname']);
    bindDirty('button[onclick*="saveMyBio"]',['profBio','profShowBio']);
    bindDirty('button[onclick*="saveBirthday"]',['profBirthday']);
  }

  /* ── boot ───────────────────────────────────────────────────────────── */
  function boot(){
    initLens(); initHeader(); initProfile(); wrapGoTo();
    var pg=activePage(); if(pg) lastPage=pg.id.replace(/^page-/,'');
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  /* the hub is hidden until sign-in; place the lens again once it has a size */
  window.addEventListener('load',function(){ placeLens(false); syncHeader(); });
  phone.addEventListener&&phone.addEventListener('change',function(){ placeLens(false); syncHeader(); });
})();
