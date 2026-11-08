/* ════════════════════════════════════════════════════════════════════════
   NEXUS · NEXI, a little pet that lives in the header (phones)         pairs with nexus-mobile.js
   · sits in an island-shaped pill at the top centre; shrinks to a round bubble once the page title scrolls in
   · asleep when you're clocked out, awake (with the time on the clock) when clocked in, tired after 10h
   · jumps for joy when YOU clock in or out; tap = hearts + a kind line; long-press = rename
   · purely cosmetic: never touches clock logic. Off switch: Profile > Notifications > "Nexi, your pet".
   REVERT: remove the <script> for this file (and the Nexi row in Profile).
   ════════════════════════════════════════════════════════════════════════ */
var nxPet = (function(){
  'use strict';
  var phone = window.matchMedia('(max-width:700px)');
  var root=null, state='', prevClock=null, msgT=0, tickT=0, pressT=0, longFired=false;

  function who(){ try{ return typeof me!=='undefined' && me ? me : ''; }catch(e){ return ''; } }
  function key(s){ return 'nx_pet_'+s+'_'+who(); }
  function get(s){ try{ return localStorage.getItem(key(s)); }catch(e){ return null; } }
  function put(s,v){ try{ if(v==null) localStorage.removeItem(key(s)); else localStorage.setItem(key(s),v); }catch(e){} }
  function on(){ return get('off') !== '1'; }
  function first(){ var n=(who().split(/\s+/)[0]||'').trim(); return n||'friend'; }
  function petName(){ return get('name') || 'Nexi'; }

  var SVG =
   '<svg class="np-svg" viewBox="0 0 64 64" aria-hidden="true">'+
   '<ellipse class="np-shadow" cx="32" cy="59" rx="15" ry="2.6"/>'+
   '<g class="np-body">'+
     '<path class="np-leaf" d="M32 13c-1.5-5.5 1.5-9.5 7-10-.5 5-2.5 8.5-7 10z"/>'+
     '<path class="np-blob" d="M9 39c0-15.5 10.5-27 23-27s23 11.500 23 27c0 9.500-9.500 17-23 17S9 48.500 9 39z"/>'+
     '<ellipse class="np-cheek" cx="17.500" cy="43.500" rx="3.600" ry="2.300"/><ellipse class="np-cheek" cx="46.500" cy="43.500" rx="3.600" ry="2.300"/>'+
     '<g class="np-eyes"><ellipse cx="24" cy="37" rx="3.300" ry="4.400"/><ellipse cx="40" cy="37" rx="3.300" ry="4.400"/>'+
       '<circle class="np-gl" cx="25.200" cy="35.200" r="1.200"/><circle class="np-gl" cx="41.200" cy="35.200" r="1.200"/></g>'+
     '<g class="np-shut"><path d="M19.500 38.500q4.500 3.200 9 0M35.500 38.500q4.500 3.200 9 0"/></g>'+
     '<path class="np-mouth" d="M28.500 46q3.500 3.600 7 0"/>'+
   '</g></svg>';

  function css(){
    if(document.getElementById('nxPetCss')) return;
    var s=document.createElement('style'); s.id='nxPetCss';
    s.textContent=
'.nx-pet{display:none}'+
'@media (max-width:700px){:root:not([data-theme="win95"]) .nx-pet{display:block;position:absolute;z-index:3;top:calc(env(safe-area-inset-top,0px) + 8px);height:36px;'+
  'left:calc(50% - 68px);width:136px;transition:left 240ms cubic-bezier(.2,.8,.2,1),width 240ms cubic-bezier(.2,.8,.2,1),opacity 160ms ease-out}'+
 ':root:not([data-theme="win95"]) .nx-pet.is-bubble{left:calc(100% - 106px);width:36px}'+
 ':root:not([data-theme="win95"]) .nx-pet.is-msg:not(.is-bubble){left:calc(50% - 104px);width:208px}'+
 ':root:not([data-theme="win95"]) .nx-pet.is-off{display:none}'+
 '.np-btn{all:unset;box-sizing:border-box;width:100%;height:100%;border-radius:18px;background:#0a0a0c;color:#fff;display:flex;align-items:center;gap:6px;padding:0 12px 0 4px;overflow:hidden;cursor:pointer;'+
   'box-shadow:0 0 0 1px rgba(255,255,255,.07),0 6px 16px -8px rgba(0,0,0,.55);-webkit-tap-highlight-color:transparent;transition:transform 120ms ease-out}'+
 '.np-btn:active{transform:scale(.97)}.np-btn:focus-visible{outline:2px solid var(--accent,#10b981);outline-offset:2px}'+
 '.nx-pet.is-bubble .np-btn{padding:0;justify-content:center;border-radius:50%}'+
 '.np-pet{flex:0 0 28px;width:28px;height:28px;margin-left:2px;display:block}'+
 '.nx-pet.is-bubble .np-pet{margin-left:0}'+
 '.np-tx{font:600 12.5px/1 var(--font,system-ui);letter-spacing:.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;opacity:1;transition:opacity 140ms ease-out;font-variant-numeric:tabular-nums}'+
 '.nx-pet.is-bubble .np-tx{display:none}'+
 '.np-svg{width:100%;height:100%;overflow:visible}'+
 '.np-blob{fill:var(--pet,var(--accent,#10b981))}.np-leaf{fill:#86efac}.np-cheek{fill:#fda4af;opacity:.55}'+
 '.np-eyes ellipse{fill:#0a0a0c}.np-eyes .np-gl{fill:#fff}.np-shut path{fill:none;stroke:#0a0a0c;stroke-width:2.2;stroke-linecap:round}.np-mouth{fill:none;stroke:#0a0a0c;stroke-width:2;stroke-linecap:round}'+
 '.np-shadow{fill:rgba(255,255,255,.12)}'+
 '.nx-pet [data-s="asleep"] .np-eyes{display:none}.nx-pet [data-s="awake"] .np-shut,.nx-pet [data-s="happy"] .np-shut,.nx-pet [data-s="tired"] .np-shut{display:none}'+
 '.nx-pet [data-s="tired"] .np-mouth{d:path("M28.500 48q3.500 -3 7 0")}'+
 '.nx-pet [data-s="happy"] .np-eyes{display:none}.nx-pet [data-s="happy"] .np-shut{display:block}'+
 '.nx-pet [data-s="happy"] .np-shut path{d:path("M19.500 40q4.500 -4.500 9 0M35.500 40q4.500 -4.500 9 0")}'+
 '.np-body{transform-origin:32px 56px;transform-box:view-box}'+
 '[data-s="asleep"] .np-body{animation:npBreathe 3.6s ease-in-out infinite}'+
 '[data-s="awake"] .np-body,[data-s="tired"] .np-body{animation:npBob 2.8s ease-in-out infinite}'+
 '[data-s="awake"] .np-eyes{animation:npBlink 4.6s infinite}'+
 '[data-s="happy"] .np-body{animation:npJump .9s cubic-bezier(.3,.7,.3,1) 1}'+
 '@keyframes npBreathe{0%,100%{transform:scale(1,1)}50%{transform:scale(1.04,.96)}}'+
 '@keyframes npBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.5px)}}'+
 '@keyframes npBlink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}'+
 '.np-eyes{transform-origin:32px 37px;transform-box:view-box}'+
 '@keyframes npJump{0%{transform:scale(1,1)}18%{transform:scale(1.08,.9)}45%{transform:translateY(-10px) scale(.95,1.08)}70%{transform:translateY(0) scale(1.06,.94)}100%{transform:scale(1,1)}}'+
 '.np-hearts{position:absolute;left:0;top:0;width:100%;height:0;pointer-events:none}'+
 '.np-heart{position:absolute;top:18px;width:11px;height:11px;fill:#fb7185;opacity:0;animation:npHeart 1s ease-out forwards}'+
 '@keyframes npHeart{0%{opacity:0;transform:translateY(0) scale(.6)}20%{opacity:1}100%{opacity:0;transform:translateY(34px) scale(1)}}'+
 '@media (prefers-reduced-motion:reduce){.np-body,.np-eyes{animation:none !important}.nx-pet{transition:none !important}.np-heart{animation-duration:.01s}}'+
'}';
    document.head.appendChild(s);
  }

  function elapsedTxt(){
    try{
      if(typeof _clockSinceTs==='undefined'||!_clockSinceTs) return 'Clocked in';
      var m=Math.max(0,Math.round((Date.now()-new Date(_clockSinceTs).getTime())/60000));
      return m<60 ? m+'m' : Math.floor(m/60)+'h '+('0'+(m%60)).slice(-2)+'m';
    }catch(e){ return 'Clocked in'; }
  }
  function clockState(){ try{ return (typeof _clockState!=='undefined') ? _clockState : null; }catch(e){ return null; } }
  function hoursIn(){ try{ return (Date.now()-new Date(_clockSinceTs).getTime())/3600000; }catch(e){ return 0; } }

  function setState(s){ state=s; var p=root&&root.querySelector('.np-pet'); if(p) p.setAttribute('data-s',s); }
  function setText(t){ var el=root&&root.querySelector('.np-tx'); if(el) el.textContent=t; }

  function idleLine(){
    var cs=clockState();
    if(cs==='in') return hoursIn()>10 ? 'Long day…' : elapsedTxt();
    return 'Zzz';
  }
  function paint(){
    if(!root) return;
    if(msgT) return;                       /* a message is showing; it repaints itself when done */
    var cs=clockState();
    setState(cs==='in' ? (hoursIn()>10?'tired':'awake') : 'asleep');
    setText(idleLine());
    root.setAttribute('aria-label',petName()+', your Nexus pet. '+idleLine());
  }
  function say(text,face,ms){
    if(!root) return;
    clearTimeout(msgT);
    root.classList.add('is-msg'); setText(text); if(face) setState(face);
    msgT=setTimeout(function(){ msgT=0; root.classList.remove('is-msg'); paint(); }, ms||2600);
  }
  function hearts(){
    var h=root.querySelector('.np-hearts'); if(!h) return;
    for(var i=0;i<3;i++){
      (function(i){ setTimeout(function(){
        var s=document.createElementNS('http://www.w3.org/2000/svg','svg'); s.setAttribute('viewBox','0 0 24 24'); s.setAttribute('class','np-heart');
        s.style.left=(10+i*9+Math.random()*6)+'px'; s.innerHTML='<path d="M12 21s-7.500-4.700-9.500-9.200C1.200 8.500 3 5.500 6 5.500c2 0 3.500 1.200 4.200 2.700.4.800.8.800 1.600 0 .7-1.500 2.200-2.700 4.200-2.700 3 0 4.800 3 3.500 6.300C19.500 16.300 12 21 12 21z"/>';
        h.appendChild(s); setTimeout(function(){ s.remove(); },1100); }, i*130);
    })(i);
    }
  }
  var LINES_IN=['You’ve got this, ','Nice work, ','Proud of you, ','Water break soon, '];
  var LINES_OUT=['Mm? Morning, ','Hi ','Five more minutes, '];
  function pet(){
    var d=new Date().toISOString().slice(0,10), c=0;
    try{ var o=JSON.parse(get('pets')||'{}'); c=(o.d===d?o.n:0)+1; put('pets',JSON.stringify({d:d,n:c})); }catch(e){}
    hearts();
    var cs=clockState(), L=cs==='in'?LINES_IN:LINES_OUT;
    say(L[Math.floor(Math.random()*L.length)]+first(), 'happy', 2400);
  }

  function onPress(){
    longFired=false; clearTimeout(pressT);
    pressT=setTimeout(function(){
      longFired=true;
      if(typeof nxPrompt==='function'){
        nxPrompt('Give your pet a name',petName(),{title:'Rename',okText:'Save',validate:function(v){ return (v||'').trim().length>0&&(v||'').length<=14 ? null : 'Up to 14 letters'; }})
          .then(function(v){ if(v){ put('name',v.trim().slice(0,14)); say('Hi, I’m '+v.trim().slice(0,14),'happy',2400); } });
      }
    },650);
  }
  function onRelease(){ clearTimeout(pressT); }
  function onClick(){ if(longFired){ longFired=false; return; } pet(); }

  /* the page title slides into the header on scroll: shrink to a bubble beside it */
  function watchHeader(hdr){
    function sync(){ if(root) root.classList.toggle('is-bubble', hdr.classList.contains('v3-title')); }
    new MutationObserver(sync).observe(hdr,{attributes:true,attributeFilter:['class']}); sync();
  }

  /* celebrate only when the person just pressed the clock button (not when the app loads the state) */
  function wrapRender(){
    var orig=window.renderClockCard;
    if(typeof orig!=='function'||orig.__pet) return;
    var w=function(){
      var r=orig.apply(this,arguments);
      try{
        var cs=clockState(), recent=window._lastClockAnyToggle && (Date.now()-window._lastClockAnyToggle)<20000;
        if(prevClock!==null && cs!==prevClock && recent && root && on()){
          say(cs==='in' ? 'Let’s go, '+first()+'!' : 'Great shift, '+first()+'!','happy',3000);
        } else paint();
        prevClock=cs;
      }catch(e){}
      return r;
    };
    w.__pet=true; window.renderClockCard=w;
  }

  function build(){
    var hdr=document.querySelector('.mobile-header'); if(!hdr||root) return false;
    css();
    root=document.createElement('div'); root.className='nx-pet';
    root.innerHTML='<button type="button" class="np-btn"><span class="np-pet" data-s="asleep">'+SVG+'</span><span class="np-tx">Zzz</span></button><div class="np-hearts"></div>';
    hdr.appendChild(root);
    var b=root.querySelector('.np-btn');
    b.addEventListener('pointerdown',onPress); ['pointerup','pointercancel','pointerleave'].forEach(function(n){ b.addEventListener(n,onRelease); });
    b.addEventListener('click',onClick);
    b.addEventListener('contextmenu',function(e){ e.preventDefault(); });
    watchHeader(hdr);
    return true;
  }

  function apply(){ if(root) root.classList.toggle('is-off',!on()); }
  function toggle(el){ put('off', el.checked?null:'1'); apply(); if(el.checked){ paint(); } }
  function sync(){ var el=document.getElementById('petToggle'); if(el) el.checked=on(); }

  function boot(){
    if(!build()) return;
    clockInit();
    apply(); paint();
    clearInterval(tickT); tickT=setInterval(function(){ if(!document.hidden) paint(); },30000);
    document.addEventListener('visibilitychange',function(){ if(!document.hidden) paint(); });
  }
  function clockInit(){ prevClock=clockState(); wrapRender(); }

  var og=window.goTo;
  if(typeof og==='function'&&!og.__petg){ var wg=function(p){ var r=og.apply(this,arguments); if(p==='profile') setTimeout(sync,0); if(p==='home') setTimeout(paint,0); return r; }; wg.__petg=true; window.goTo=wg; }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  window.addEventListener('load',function(){ if(!root) boot(); paint(); });
  return { toggle:toggle, sync:sync, paint:paint, say:say };
})();
