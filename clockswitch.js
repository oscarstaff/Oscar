/* ═══════════════════════════════════════════════════════════════════════
   clockswitch.js — physical clock-in controls for Nexus
   Loaded by index.html:  <script src="clockswitch.js?v=1"></script>
   Load AFTER the inline clock code (it references toggleClock / _clockState).

   WHAT THIS DOES
   Replaces the plain Clock In / Clock Out button with a physical control the
   staff member chooses: Plain, Lever, Wheel or Light switch. The choice is
   saved per-device (localStorage), so each person picks their own and it
   sticks on the machine they use.

   WHY A SEPARATE FILE
   index.html is ~1.2 MB and the rule is no more inline growth — new features
   are their own file on the dialtrac.js pattern. This adds ONE global,
   window.ClockSwitch, and everything else lives inside the IIFE.

   HOW IT STAYS IN SYNC — the important bit
   It does NOT replace toggleClock() and does NOT track state itself. The
   inline renderClockCard() already runs on every state change (load from
   cache, fresh fetch from clock_log, after a toggle) and sets the button's
   text/background. This module wraps renderClockCard: after the original
   runs, it reads the single source of truth — window._clockState — and moves
   the control to match. So the control can never disagree with the real
   clock state, because it's driven by the same function and the same variable
   the rest of the app uses.

   FAILSAFE
   If anything here throws, the original Clock In button is untouched and
   fully functional underneath. Clocking in never depends on this file.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var LS_KEY = 'nexus_clock_control_v1';
  var STYLES = ['plain','lever','wheel','switch'];
  var STYLE_LABEL = { plain:'Plain button', lever:'Lever', wheel:'Wheel', 'switch':'Light switch' };

  function getStyle(){
    try{
      var v = localStorage.getItem(LS_KEY);
      return STYLES.indexOf(v) > -1 ? v : 'plain';
    }catch(e){ return 'plain'; }
  }
  function setStyle(v){
    try{ localStorage.setItem(LS_KEY, v); }catch(e){}
  }

  // Read the app's live clock state. Never cache it here — always ask.
  function isIn(){
    try{ return window._clockState === 'in'; }catch(e){ return false; }
  }
  // The real toggle. We call this and nothing else — all clock logic,
  // geofence, session lock, DB write lives inside it.
  function fireToggle(){
    if(typeof window.toggleClock === 'function'){
      try{ window.toggleClock(); }catch(e){ console.error('[ClockSwitch] toggleClock', e); }
    }
  }
  // Respect the app's own "don't tap yet" guard used while state syncs.
  function locked(){
    return !!window._clockSyncing;
  }

  var CSS = `
  /* The control sits where the plain #clockBtn used to. Everything is themed
     off Nexus --m-* / --accent so it recolours with the active theme, the
     same as every other card. No bespoke per-theme art. */
  .cs-wrap{ display:inline-flex; align-items:center; }
  .cs-host{ display:inline-flex; align-items:center; justify-content:center; }

  /* the plain button just reuses the app's own .cc-btn look via inheritance;
     we only style the physical ones here. */

  /* ── LEVER ── */
  .cs-lever{ --throw:0deg; width:70px; height:84px; position:relative; cursor:pointer;
    user-select:none; -webkit-user-select:none; touch-action:none; }
  .cs-lever[aria-disabled="true"]{ opacity:.5; cursor:default; }
  .cs-lever-slot{ position:absolute; inset:0; border-radius:12px;
    background:linear-gradient(180deg,#2a2d35,#3a3e48); border:1px solid #1c1f26;
    overflow:hidden; box-shadow:inset 0 2px 5px rgba(0,0,0,.5); }
  .cs-lever-track{ position:absolute; left:50%; top:10px; bottom:10px; width:12px;
    transform:translateX(-50%); background:#15171d; border-radius:7px;
    box-shadow:inset 0 0 5px rgba(0,0,0,.7); }
  .cs-lever-mark{ position:absolute; left:0; right:0; text-align:center; font-size:8px;
    font-weight:800; letter-spacing:.06em; font-family:ui-monospace,Menlo,monospace; }
  .cs-lever-mark.up{ top:6px; color:#9aa0aa; }
  .cs-lever-mark.dn{ bottom:6px; color:#9aa0aa; }
  .cs-lever[data-in="0"] .cs-lever-mark.up{ color:#dc2626; }
  .cs-lever[data-in="1"] .cs-lever-mark.dn{ color:#10b981; }
  .cs-lever-arm{ position:absolute; left:50%; top:50%; width:16px; height:40px;
    transform-origin:bottom center; transform:translate(-50%,-100%) rotate(var(--throw));
    transition:transform .34s cubic-bezier(.34,1.56,.64,1); }
  .cs-lever-stick{ position:absolute; left:50%; bottom:0; width:7px; height:100%;
    transform:translateX(-50%); background:linear-gradient(90deg,#7a808b,#aeb4be,#7a808b);
    border-radius:4px; }
  .cs-lever-knob{ position:absolute; left:50%; top:-5px; width:24px; height:24px;
    transform:translateX(-50%); border-radius:50%;
    background:radial-gradient(circle at 35% 30%,#fff,var(--accent) 62%,#2c2e63);
    box-shadow:0 2px 6px rgba(0,0,0,.4); border:2px solid rgba(255,255,255,.3); }
  .cs-lever[data-in="1"] .cs-lever-knob{ background:radial-gradient(circle at 35% 30%,#eafff5,#10b981 62%,#0d5c42); }

  /* ── WHEEL ── */
  .cs-wheel{ width:78px; height:78px; position:relative; cursor:pointer;
    user-select:none; -webkit-user-select:none; touch-action:none; }
  .cs-wheel[aria-disabled="true"]{ opacity:.5; cursor:default; }
  .cs-wheel-face{ position:absolute; inset:0; border-radius:50%;
    background:conic-gradient(from 135deg,#3a3e48,#5a5f6b 25%,#3a3e48 50%,#5a5f6b 75%,#3a3e48);
    border:3px solid #22252c; box-shadow:0 5px 12px -6px rgba(0,0,0,.5), inset 0 0 0 5px rgba(255,255,255,.04); }
  .cs-wheel-grip{ --rot:0deg; position:absolute; inset:11px; border-radius:50%;
    background:radial-gradient(circle at 40% 35%,#aeb4be,#6c727c 70%,#4a4f58);
    box-shadow:0 2px 5px rgba(0,0,0,.4), inset 0 2px 3px rgba(255,255,255,.3);
    transform:rotate(var(--rot)); transition:transform .4s cubic-bezier(.34,1.56,.64,1);
    display:flex; align-items:flex-start; justify-content:center; }
  .cs-wheel-grip::after{ content:''; width:5px; height:22px; margin-top:7px; border-radius:3px;
    background:linear-gradient(180deg,#fff,#c7ccd4); box-shadow:0 1px 2px rgba(0,0,0,.3); }
  .cs-wheel-lbl{ position:absolute; left:0; right:0; bottom:-16px; text-align:center;
    font-size:8px; font-weight:800; letter-spacing:.08em; font-family:ui-monospace,Menlo,monospace;
    color:#94a3b8; }
  .cs-wheel[data-in="1"] .cs-wheel-lbl{ color:#10b981; }

  /* ── LIGHT SWITCH ── */
  .cs-switch{ width:54px; height:84px; position:relative; cursor:pointer;
    user-select:none; -webkit-user-select:none; touch-action:none; }
  .cs-switch[aria-disabled="true"]{ opacity:.5; cursor:default; }
  .cs-switch-plate{ position:absolute; inset:0; border-radius:9px;
    background:linear-gradient(180deg,#f2f3f5,#dfe1e5); border:1px solid #c8cbd1;
    box-shadow:0 3px 9px -5px rgba(0,0,0,.35), inset 0 1px 0 #fff; }
  .cs-switch-screw{ position:absolute; width:5px; height:5px; border-radius:50%; left:50%;
    transform:translateX(-50%); background:radial-gradient(circle at 40% 35%,#c7ccd4,#8b909a); }
  .cs-switch-screw.t{ top:6px; } .cs-switch-screw.b{ bottom:6px; }
  .cs-switch-rocker{ position:absolute; left:50%; top:50%; width:28px; height:46px;
    transform:translate(-50%,-50%); border-radius:6px; overflow:hidden; background:#c4c8ce;
    box-shadow:inset 0 0 0 1px rgba(0,0,0,.12); }
  .cs-switch-toggle{ position:absolute; left:2px; right:2px; height:22px; border-radius:5px;
    background:linear-gradient(180deg,#fdfdfd,#e2e4e8); box-shadow:0 2px 4px rgba(0,0,0,.25);
    transition:top .2s cubic-bezier(.34,1.56,.64,1); display:flex; align-items:center;
    justify-content:center; font-size:7px; font-weight:800; letter-spacing:.05em;
    font-family:ui-monospace,Menlo,monospace; color:#6c727c; }
  .cs-switch[data-in="1"] .cs-switch-toggle{ top:calc(50% - 11px - 11px); }
  .cs-switch[data-in="0"] .cs-switch-toggle{ top:calc(50% - 11px + 11px); }
  .cs-switch-led{ position:absolute; left:50%; bottom:-14px; transform:translateX(-50%);
    width:7px; height:7px; border-radius:50%; background:#c9ccd1;
    transition:background .25s, box-shadow .25s; }
  .cs-switch[data-in="1"] .cs-switch-led{ background:#10b981; box-shadow:0 0 8px #10b981; }

  .cs-flash{ animation:csFlash .4s cubic-bezier(.2,0,0,1); }
  @keyframes csFlash{ 0%{ filter:brightness(1.35); } 100%{ filter:brightness(1); } }

  /* settings picker */
  .cs-pick{ display:flex; gap:8px; flex-wrap:wrap; }
  .cs-pick-opt{ flex:1; min-width:120px; border:1.5px solid var(--m-line,#e2e8f0);
    border-radius:12px; background:var(--m-surface,#fff); padding:14px 12px; cursor:pointer;
    display:flex; flex-direction:column; align-items:center; gap:10px; transition:border-color .15s;
    font-family:inherit; }
  .cs-pick-opt:hover{ border-color:var(--accent,#4b4fa6); }
  .cs-pick-opt.sel{ border-color:var(--accent,#4b4fa6); box-shadow:0 0 0 3px rgba(75,79,166,.12); }
  .cs-pick-name{ font-size:12.5px; font-weight:700; color:var(--m-ink,#0f172a); }
  .cs-pick-stage{ height:90px; display:flex; align-items:center; justify-content:center; pointer-events:none; }
  @media (prefers-reduced-motion:reduce){
    .cs-lever-arm,.cs-wheel-grip,.cs-switch-toggle{ transition:none; }
    .cs-flash{ animation:none; }
  }`;

  // ── control builders: each returns the host element and exposes .paint(in) ──
  function buildLever(){
    var el = document.createElement('div');
    el.className = 'cs-lever'; el.setAttribute('role','button'); el.tabIndex = 0;
    el.setAttribute('aria-label','Clock lever');
    el.innerHTML =
      '<div class="cs-lever-slot"><div class="cs-lever-track"></div>'+
      '<span class="cs-lever-mark up">OUT</span><span class="cs-lever-mark dn">IN</span></div>'+
      '<div class="cs-lever-arm"><div class="cs-lever-stick"></div><div class="cs-lever-knob"></div></div>';
    el._paint = function(inNow){
      el.setAttribute('data-in', inNow ? '1' : '0');
      el.querySelector('.cs-lever-arm').style.setProperty('--throw', inNow ? '150deg' : '0deg');
    };
    el._drag = { axis:'y', dir:function(d){ return d > 0 ? 'in' : 'out'; } };  // down = in
    return el;
  }
  function buildWheel(){
    var el = document.createElement('div');
    el.className = 'cs-wheel'; el.setAttribute('role','button'); el.tabIndex = 0;
    el.setAttribute('aria-label','Clock dial');
    el.innerHTML =
      '<div class="cs-wheel-face"></div><div class="cs-wheel-grip"></div>'+
      '<div class="cs-wheel-lbl">OUT</div>';
    el._paint = function(inNow){
      el.setAttribute('data-in', inNow ? '1' : '0');
      el.querySelector('.cs-wheel-grip').style.setProperty('--rot', inNow ? '150deg' : '0deg');
      el.querySelector('.cs-wheel-lbl').textContent = inNow ? 'IN' : 'OUT';
    };
    el._drag = { axis:'x', dir:function(d){ return d > 0 ? 'in' : 'out'; } };  // clockwise = in
    return el;
  }
  function buildSwitch(){
    var el = document.createElement('div');
    el.className = 'cs-switch'; el.setAttribute('role','button'); el.tabIndex = 0;
    el.setAttribute('aria-label','Clock switch');
    el.innerHTML =
      '<div class="cs-switch-plate"><span class="cs-switch-screw t"></span><span class="cs-switch-screw b"></span></div>'+
      '<div class="cs-switch-rocker"><div class="cs-switch-toggle">OUT</div></div>'+
      '<div class="cs-switch-led"></div>';
    el._paint = function(inNow){
      el.setAttribute('data-in', inNow ? '1' : '0');
      el.querySelector('.cs-switch-toggle').textContent = inNow ? 'IN' : 'OUT';
    };
    el._drag = { axis:'y', dir:function(d){ return d < 0 ? 'in' : 'out'; } };  // up = in
    return el;
  }
  function buildControl(style){
    if(style === 'lever')  return buildLever();
    if(style === 'wheel')  return buildWheel();
    if(style === 'switch') return buildSwitch();
    return null;  // plain => no physical control, keep the button
  }

  // ── wiring a physical control: click + keyboard flip, plus drag ──
  function wireControl(el){
    function flip(){
      // keep the disabled cue honest even if no render happened since sync began
      el.setAttribute('aria-disabled', locked() ? 'true' : 'false');
      if(locked()) return;                 // app is still confirming state
      el.classList.remove('cs-flash'); void el.offsetWidth; el.classList.add('cs-flash');
      fireToggle();                        // the app flips _clockState + re-renders
    }
    el.addEventListener('click', function(){ flip(); });
    el.addEventListener('keydown', function(e){
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); flip(); }
    });
    // drag: only flips if you drag toward the state you're NOT in
    var start = null;
    el.addEventListener('pointerdown', function(e){
      start = el._drag.axis === 'y' ? e.clientY : e.clientX;
      try{ el.setPointerCapture(e.pointerId); }catch(_){}
    });
    el.addEventListener('pointerup', function(e){
      if(start === null) return;
      var now = el._drag.axis === 'y' ? e.clientY : e.clientX;
      var d = now - start; start = null;
      if(Math.abs(d) < 10) return;         // a tap — let click handle it
      var want = el._drag.dir(d);          // 'in' | 'out'
      var nowIn = isIn();
      if((want === 'in') !== nowIn) flip(); // only flip if it changes state
    });
    el.addEventListener('lostpointercapture', function(){ start = null; });
  }

  // ── mount: swap the plain button for the chosen control, or leave it ──
  var _host = null, _control = null, _mountedStyle = null;

  function mount(){
    if(document.getElementById('clockswitch-css')){ /* css already in */ }
    else{
      var st = document.createElement('style');
      st.id = 'clockswitch-css'; st.textContent = CSS;
      document.head.appendChild(st);
    }
    applyStyle(getStyle());
  }

  function applyStyle(style){
    var btn = document.getElementById('clockBtn');
    if(!btn) return;

    // ensure a host wrapper next to the button
    if(!_host){
      _host = document.createElement('span');
      _host.className = 'cs-wrap';
      btn.parentNode.insertBefore(_host, btn);
    }
    // remove any previous physical control
    if(_control){ _control.remove(); _control = null; }

    if(style === 'plain'){
      btn.style.display = '';          // show the real button
      _host.style.display = 'none';
    }else{
      btn.style.display = 'none';      // hide it, but keep it in the DOM & working
      _host.style.display = '';
      _control = buildControl(style);
      if(_control){
        wireControl(_control);
        _host.appendChild(_control);
      }else{
        // unknown style: fall back to the button
        btn.style.display = ''; _host.style.display = 'none';
      }
    }
    _mountedStyle = style;
    paint();   // set initial position from live state
  }

  // ── paint: called after renderClockCard so the control matches _clockState ──
  function paint(){
    if(!_control || !_control._paint) return;
    var inNow = isIn();
    _control._paint(inNow);
    _control.setAttribute('aria-disabled', locked() ? 'true' : 'false');
  }

  // Wrap renderClockCard so every state change repaints the control too.
  function hookRender(){
    if(window.__clockSwitchHooked) return;
    var orig = window.renderClockCard;
    if(typeof orig !== 'function'){
      // inline code not ready yet — try again shortly
      return false;
    }
    window.renderClockCard = function(){
      var r;
      try{ r = orig.apply(this, arguments); }catch(e){ console.error('[ClockSwitch] renderClockCard', e); }
      try{ paint(); }catch(e){}
      return r;
    };
    window.__clockSwitchHooked = true;
    return true;
  }

  // ── public API for the settings picker ──
  window.ClockSwitch = {
    styles: STYLES.slice(),
    label: function(s){ return STYLE_LABEL[s] || s; },
    current: getStyle,
    set: function(style){
      if(STYLES.indexOf(style) < 0) return;
      setStyle(style);
      applyStyle(style);
      if(typeof window.showToast === 'function'){
        window.showToast('Clock control: ' + STYLE_LABEL[style]);
      }
      // refresh any open picker
      renderPicker();
    },
    // Renders a chooser into a container id. Called by the settings page.
    renderPickerInto: function(containerId){
      ClockSwitch._pickTarget = containerId;
      renderPicker();
    }
  };

  function renderPicker(){
    var id = window.ClockSwitch && window.ClockSwitch._pickTarget;
    if(!id) return;
    var box = document.getElementById(id);
    if(!box) return;
    var cur = getStyle();
    box.className = 'cs-pick';
    box.innerHTML = '';
    STYLES.forEach(function(style){
      var opt = document.createElement('button');
      opt.type = 'button';
      opt.className = 'cs-pick-opt' + (style === cur ? ' sel' : '');
      var stage = document.createElement('span');
      stage.className = 'cs-pick-stage';
      if(style === 'plain'){
        var b = document.createElement('span');
        b.textContent = 'Clock In';
        b.style.cssText = 'background:var(--accent,#4b4fa6);color:#fff;font-weight:800;font-size:13px;padding:11px 20px;border-radius:11px;box-shadow:0 4px 0 rgba(0,0,0,.15);';
        stage.appendChild(b);
      }else{
        var demo = buildControl(style);
        if(demo){ demo._paint(false); demo.style.pointerEvents = 'none'; stage.appendChild(demo); }
      }
      var name = document.createElement('span');
      name.className = 'cs-pick-name';
      name.textContent = STYLE_LABEL[style];
      opt.appendChild(stage); opt.appendChild(name);
      opt.addEventListener('click', function(){ window.ClockSwitch.set(style); });
      box.appendChild(opt);
    });
  }

  // ── boot ──
  // Self-healing reconcile. Wrapping renderClockCard is the primary sync path,
  // but it is fragile: the inline clock code calls renderClockCard from inside
  // an async toggleClock (after the clock-out confirm popup resolves), and load
  // ordering can mean an early render runs before the wrap is installed. Rather
  // than depend on the wrap catching every path, this cheaply checks a few times
  // a second whether the control's shown state matches the real _clockState, and
  // repaints if they drifted. So even if a render call is ever missed — popup,
  // race, future refactor — the control corrects itself within ~250ms and can
  // never sit stuck showing the wrong state.
  function reconcile(){
    if(!_control || !_control._paint) return;
    var shouldBeIn = isIn();
    var showsIn = _control.getAttribute('data-in') === '1';
    if(shouldBeIn !== showsIn) paint();
    // keep the disabled cue honest even if no render fired
    var dis = _control.getAttribute('aria-disabled') === 'true';
    if(locked() !== dis) _control.setAttribute('aria-disabled', locked() ? 'true' : 'false');
  }

  function boot(){
    mount();
    // hook render; if the inline code isn't defined yet, poll briefly
    if(!hookRender()){
      var tries = 0;
      var iv = setInterval(function(){
        tries++;
        if(hookRender() || tries > 40){ clearInterval(iv); paint(); }
      }, 100);
    }
    paint();
    // Safety net regardless of hook timing (see reconcile). 250ms is invisible
    // to a person but instant enough that the control never looks stuck.
    setInterval(reconcile, 250);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();
