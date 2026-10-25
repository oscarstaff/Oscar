/* ═══════════════════════════════════════════════════════════════════════
   arcade-games3.js — Rash, Belter and Wordgrid for Bore-KADE
   Loaded by arcade.html:  <script src="arcade-games3.js?v=1"></script>
   Load AFTER arcade-games2.js.

   NO arcade.html EDIT NEEDED
   arcade-games2.js already wraps openGame/closeGame/refreshBests. This file
   registers into the same wrapper if it is present, and installs its own
   copy of the wrapper if it is not — so it works whether or not the second
   batch is installed, and never double-wraps.

   WHY THESE THREE
   The arcade already has: pool + kart (physics), snake + brick (reflex),
   slide (puzzle), minesweeper (deduction), tetris (spatial), connect4 (AI
   opponent). Genuinely missing: a combat racer, a free-flight shooter, and
   a word game.

     · RASH   — motorbike racing and street fighting. Deliberately NOT built
                like kart: a pseudo-3D scaling-sprite road (Out Run / Lotus
                Turbo style) on a plain 2D canvas, no Three.js. A real race
                with a pack, traffic, police, prize money and a garage.
     · BELTER — Asteroids with thrust, inertia and splitting rocks. The only
                game here with real momentum, which nothing else has.
     · WORDGRID — find words in a letter grid against the clock. The arcade
                had no word game at all, and it is the one people can play
                for ninety seconds between calls.

   ONE GLOBAL
   Everything hangs off window.AG3. The onclick attributes call AG3.x(), so
   this adds one name to the global scope rather than a dozen — the same
   collision discipline the Nexus modules follow.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var AG3 = {};
  window.AG3 = AG3;

  function best(k){
    try{ return parseInt(localStorage.getItem('arcade_best_'+k)) || 0; }catch(e){ return 0; }
  }
  function setBest(k,v){
    if(v <= best(k)) return false;
    try{ localStorage.setItem('arcade_best_'+k, String(v)); }catch(e){}
    return true;
  }
  function screen(id,title,statusId,inner){
    return '<div class="screen" id="screen-'+id+'">'+
      '<div class="topbar">'+
        '<button class="back-btn" onclick="closeGame()">\u2190 Back</button>'+
        '<span class="game-title">'+title+'</span>'+
        '<span class="status-pill" id="'+statusId+'">\u2014</span>'+
      '</div>'+ inner +'</div>';
  }
  function el(id){ return document.getElementById(id); }
  function ctx2d(id){
    var c = el(id);
    return c ? c.getContext('2d') : null;
  }

  var CSS = `
  /* Base .ag-* rules, repeated from the earlier batches so this file renders
     correctly on its own if either of them is missing. Values are identical,
     so loading all three together is harmless. */
  .ag-stage{flex:1;display:flex;flex-direction:column;align-items:center;
    justify-content:center;gap:14px;padding:18px;min-height:0;}
  .ag-canvas{background:var(--panel);border:1px solid var(--border);
    border-radius:14px;box-shadow:0 8px 30px -18px rgba(20,30,50,.5);
    touch-action:none;max-width:100%;height:auto;}
  .ag-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;
    justify-content:center;}
  .ag-score{font-family:ui-monospace,Menlo,monospace;font-size:15px;
    font-weight:700;color:var(--text);letter-spacing:.02em;}
  .ag-score b{color:var(--accent);}
  .ag-hint{font-size:12px;color:var(--text-dim);text-align:center;max-width:46ch;
    line-height:1.5;}
  .ag-btn{font-family:inherit;font-size:13px;font-weight:700;padding:9px 18px;
    border-radius:10px;border:1px solid var(--border);background:var(--panel);
    color:var(--text);cursor:pointer;transition:all .15s;}
  .ag-btn:hover{border-color:var(--accent);color:var(--accent);}
  .ag-btn.primary{background:var(--accent);border-color:var(--accent);color:#fff;}
  .ag-btn.primary:hover{filter:brightness(1.08);color:#fff;}
  /* rash HUD */
  .ag3-hud{display:flex;gap:18px;align-items:center;font-family:ui-monospace,Menlo,monospace;
    font-size:13px;font-weight:700;flex-wrap:wrap;justify-content:center;}
  .ag3-hud span{color:var(--text-dim);font-size:10px;letter-spacing:.1em;
    text-transform:uppercase;display:block;font-weight:800;}
  .ag3-hud b{color:var(--accent);font-size:17px;}
  .ag3-bar{width:110px;height:7px;border-radius:4px;background:var(--border);
    overflow:hidden;}
  .ag3-bar i{display:block;height:100%;background:var(--accent);
    transition:width .18s ease;}
  .ag3-bar.hp i{background:#2d9d94;}
  .ag3-bar.hp.low i{background:#e05a3f;}
  /* rash menu + play */
  .ag3-rmenu{width:min(580px,94vw);display:flex;flex-direction:column;gap:12px;}
  .ag3-rmenu h4{margin:6px 0 0;font-size:11px;letter-spacing:.14em;text-transform:uppercase;
    color:var(--text-dim);}
  .rm-head{display:flex;gap:28px;justify-content:center;font-family:ui-monospace,Menlo,monospace;}
  .rm-head span{display:block;color:var(--text-dim);font-size:10px;letter-spacing:.1em;
    text-transform:uppercase;font-weight:800;}
  .rm-head b{color:var(--accent);font-size:20px;}
  .rm-tracks{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px;}
  .rm-track{text-align:left;padding:10px 12px;border-radius:12px;border:1px solid var(--border);
    background:var(--panel);cursor:pointer;display:flex;flex-direction:column;gap:2px;
    font-family:inherit;color:var(--text);font-size:14px;}
  .rm-track.sel{border-color:var(--accent);box-shadow:0 0 0 2px rgba(224,90,63,.25);}
  .rm-track.lock{opacity:.5;cursor:not-allowed;}
  .rm-track span,.rm-track em,.rm-track i{font-size:11.5px;color:var(--text-dim);font-style:normal;}
  .rm-bikes{display:flex;flex-direction:column;gap:8px;}
  .rm-bike{display:grid;grid-template-columns:130px 1fr auto;gap:12px;align-items:center;
    padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--panel);}
  .rm-bike.sel{border-color:var(--accent);}
  .rb-name{display:flex;flex-direction:column;}
  .rb-name span{font-size:11.5px;color:var(--text-dim);}
  .rb-stats{display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;}
  .rb-stats label{font-size:10px;letter-spacing:.08em;text-transform:uppercase;
    color:var(--text-dim);display:flex;flex-direction:column;gap:3px;font-weight:700;}
  .rb-stats .ag3-bar{width:100%;}
  .rm-result{border:1px solid var(--border);border-radius:14px;padding:14px;background:var(--panel);
    text-align:center;}
  .rm-result.good{border-color:#2d9d94;} .rm-result.bad{border-color:#e05a3f;}
  .rm-result h3{margin:0 0 2px;font-size:22px;}
  .rm-result p{margin:0;font-size:13px;color:var(--text-dim);}
  .rm-result ul{list-style:none;padding:0;margin:10px auto 0;max-width:320px;display:flex;
    flex-direction:column;gap:4px;}
  .rm-result li{display:flex;justify-content:space-between;font-size:13px;}
  .rm-result .rm-note{color:#2d9d94;font-weight:700;margin-top:8px;}
  .ag-btn[disabled]{opacity:.45;cursor:not-allowed;}
  .ag3-rplay{display:flex;flex-direction:column;align-items:center;gap:14px;}
  #rashCanvas{width:min(96vw,720px);height:auto;}
  .ag3-hud > div.alert b{color:#e05a3f;}
  @media (max-width:520px){ .rm-bike{grid-template-columns:1fr auto;} .rb-stats{grid-column:1/-1;order:3;} }
  /* touch pads */
  .ag3-pads{display:none;gap:8px;}
  .ag3-pad{width:56px;height:44px;border-radius:10px;border:1px solid var(--border);
    background:var(--panel);color:var(--text);font-weight:800;font-size:15px;
    cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none;}
  .ag3-pad:active{background:var(--accent);color:#fff;}
  @media (pointer:coarse){ .ag3-pads{display:flex;} }
  /* wordgrid */
  .ag3-wg{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;
    width:min(320px,84vw);aspect-ratio:1;touch-action:none;user-select:none;
    -webkit-user-select:none;}
  .ag3-wc{display:flex;align-items:center;justify-content:center;
    border-radius:10px;background:var(--panel);border:1px solid var(--border);
    font-family:ui-monospace,Menlo,monospace;font-weight:800;
    font-size:clamp(17px,5.4vw,26px);cursor:pointer;color:var(--text);
    transition:background .12s,transform .12s,color .12s;}
  .ag3-wc.on{background:var(--accent);color:#fff;transform:scale(.94);}
  .ag3-wc.good{background:#2d9d94;color:#fff;}
  .ag3-wc.bad{background:#e05a3f;color:#fff;}
  .ag3-cur{font-family:ui-monospace,Menlo,monospace;font-weight:800;
    font-size:19px;letter-spacing:.16em;min-height:26px;color:var(--accent);}
  .ag3-found{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;
    max-width:340px;min-height:22px;}
  .ag3-tag{font-family:ui-monospace,Menlo,monospace;font-size:10.5px;
    font-weight:700;padding:2px 7px;border-radius:5px;background:var(--panel);
    border:1px solid var(--border);color:var(--text-dim);}
  @media (prefers-reduced-motion: reduce){ .ag3-wc{transition:none;} }`;

  /* ══════════════════════════════════════════════════════════════════
     RASH — motorbike racing and street fighting

     A point-to-point race against a pack of riders on a public road, in the
     spirit of the old street-racing brawlers. Finish in the top three to
     win prize money and open the next road. Spend it in the garage on a
     faster bike.

       · Fight from the saddle: Z swings left, X swings right. Hit a rider
         alongside you enough times and they come off. Riders who carry a
         club or a chain hit harder; knock one and you may snatch it.
       · Traffic is real. Clip a car, a tree or a pole and you are thrown off
         and have to run back to the bike while the pack goes by.
       · From the second road on, brawling draws the police. A cop who stays
         alongside you long enough busts you: you lose the race and pay a
         fine. Knock the cop off and the heat is gone.
       · Progress (cash, bikes, unlocked roads, best finishes) is saved on
         this device.

     PSEUDO-3D, NOT REAL 3D. The road is a list of segments each with a
     curve and hill value; the camera sits behind the player and each
     segment is projected with a perspective divide. Riders, cars and
     scenery are sprites scaled by distance and drawn far to near. A
     different engine from kart's Three.js scene on purpose.
     ══════════════════════════════════════════════════════════════════ */
  var RSEG = 200, RDRAW = 240, RW = 2000;      // road units
  var R_CAM = 1600;      // how far behind the player the camera sits
  var R_STEP = 12;       // speed to road units per second
  var R_CAMH = 1100;     // camera height above the road
  var R_START = 3000;    // z of the start line
  var rs = null, rRAF = null, rKeys = {}, rSave = null, rSel = 0, rResult = null, rPlaying = false;

  /* ── Data ──────────────────────────────────────────────────────────── */
  var R_BIKES = [
    { name:'Rat 250',      price:0,     top:300, acc:115, grip:1.75, tough:90,  col:'#5a7ec9' },
    { name:'Viper 500',    price:3500,  top:335, acc:135, grip:1.95, tough:105, col:'#c24a4a' },
    { name:'Hornet 750',   price:9000,  top:370, acc:158, grip:2.10, tough:120, col:'#e0a52e' },
    { name:'Phantom 1000', price:20000, top:410, acc:182, grip:2.25, tough:140, col:'#2b2e36' }
  ];
  var R_WEAP = {
    club : { name:'Club',  dmg:27, reach:1.00, uses:7, mult:1.9 },
    chain: { name:'Chain', dmg:22, reach:1.30, uses:9, mult:1.6 }
  };
  var R_THEMES = {
    valley:{ sky:['#7fb2e0','#cfe4f2'], grass:['#4b8f4b','#468748'], tar:['#4a4d55','#53565e'],
             rum:['#c9503f','#f2f2f2'], hill:['#8fb0c4','#7a9fb6'], scen:['tree','tree','pole','sign','tree','rock'] },
    desert:{ sky:['#e8a96a','#f6dcae'], grass:['#c9a46a','#c19c62'], tar:['#575258','#605a60'],
             rum:['#8a3b2a','#e0d8c8'], hill:['#d49a68','#c98a5a'], scen:['cactus','rock','cactus','pole','rock','sign'] },
    pine  :{ sky:['#8fb0d0','#d6e3ee'], grass:['#3d6b4a','#386346'], tar:['#4a4f58','#535963'],
             rum:['#b33a3a','#e6e6e6'], hill:['#7c97ac','#6d8aa0'], scen:['pine','pine','rock','pine','sign','pine'] },
    dusk  :{ sky:['#3a2f6b','#e08a6a'], grass:['#2f5a3a','#2a5235'], tar:['#3c3f48','#44474f'],
             rum:['#c9503f','#e8e8e8'], hill:['#4d3f73','#3c3a5e'], scen:['tree','lamp','pole','lamp','rock','sign'] },
    night :{ sky:['#070b1d','#1c2a52'], grass:['#14301f','#112a1b'], tar:['#2d3037','#33363e'],
             rum:['#b33a3a','#d0d0d0'], hill:['#18203c','#10172e'], scen:['lamp','tree','lamp','pole','lamp','sign'], stars:true }
  };
  var R_TRACKS = [
    { name:'Valley Run',    theme:'valley', segs:2600, curve:2.2, hill:800,  top:268, rivals:7, traffic:0.5, weapons:0.10, cops:false, prize:[2500,1500,800],    seed:11 },
    { name:'Red Desert',    theme:'desert', segs:3000, curve:2.6, hill:1000, top:290, rivals:8, traffic:0.7, weapons:0.30, cops:true,  prize:[4000,2400,1200],   seed:23 },
    { name:'Pine Ridge',    theme:'pine',   segs:3400, curve:3.2, hill:1300, top:312, rivals:8, traffic:0.8, weapons:0.45, cops:true,  prize:[6000,3600,1800],   seed:37 },
    { name:'Sunset Strip',  theme:'dusk',   segs:3600, curve:3.6, hill:1200, top:334, rivals:8, traffic:1.0, weapons:0.60, cops:true,  prize:[9000,5400,2700],   seed:41 },
    { name:'Midnight Mile', theme:'night',  segs:4000, curve:4.0, hill:1500, top:356, rivals:8, traffic:1.2, weapons:0.70, cops:true,  prize:[14000,8400,4200],  seed:59 }
  ];
  var R_NAMES = ['VIC','TARA','BRUZ','KEZ','NEV','SHAZ','DOZ','MAXX'];
  var R_COLS  = ['#c24a4a','#4aa36c','#9a5fc4','#d9772b','#2f9db0','#c9952e','#d46a9b','#7a8a3c'];
  var R_JACKS = ['#2b2f3a','#e8e8e2','#3b3f4a','#d9d9d0','#242830','#cfd2d8','#30343f','#e2e0d6'];
  var R_CARS  = ['#b8bcc4','#8a2f2f','#2f4f8a','#d8d8d0','#3a3d44','#c9a22e','#2f7a5a'];
  var R_KO_BONUS = 150, R_COP_BONUS = 300;

  function rClamp(v,a,b){ return v < a ? a : (v > b ? b : v); }
  function rRng(seed){
    var a = seed >>> 0;
    return function(){
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rMoney(n){ return '$' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function rTime(s){
    var m = Math.floor(s/60), r = s - m*60;
    return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1);
  }
  function rOrd(n){ return n + (n===1?'st':n===2?'nd':n===3?'rd':'th'); }

  /* ── Save ──────────────────────────────────────────────────────────── */
  function rLoad(){
    var d = { cash:0, bikes:[0], bike:0, unlocked:0, earned:0, rec:{} };
    try{
      var j = JSON.parse(localStorage.getItem('rash_save_v1') || 'null');
      if(j && typeof j === 'object'){ for(var k in d){ if(j[k] !== undefined) d[k] = j[k]; } }
    }catch(e){}
    if(!Array.isArray(d.bikes) || d.bikes.indexOf(0) < 0) d.bikes = [0];
    if(!R_BIKES[d.bike] || d.bikes.indexOf(d.bike) < 0) d.bike = 0;
    d.unlocked = rClamp(d.unlocked|0, 0, R_TRACKS.length-1);
    rSave = d;
    return d;
  }
  function rPersist(){ try{ localStorage.setItem('rash_save_v1', JSON.stringify(rSave)); }catch(e){} }

  /* ── Sound (Web Audio) ─────────────────────────────────────────────
     Engine note tracks speed; short tones and noise bursts for everything
     else. Created lazily so it only spins up when someone plays, and so a
     browser that blocks audio until a gesture is fine (the first key press
     or tap is the gesture). */
  var rAC = null, rEngine = null, rEngGain = null;
  function rAudio(){
    if(rAC) return rAC;
    try{ rAC = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ rAC = null; }
    return rAC;
  }
  function rEngineStart(){
    var ac = rAudio(); if(!ac || rEngine) return;
    try{
      rEngine = ac.createOscillator();
      rEngine.type = 'sawtooth';
      var lp = ac.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 620;
      rEngGain = ac.createGain(); rEngGain.gain.value = 0.0;
      rEngine.connect(lp); lp.connect(rEngGain); rEngGain.connect(ac.destination);
      rEngine.frequency.value = 60;
      rEngine.start();
    }catch(e){ rEngine = null; }
  }
  function rEngineStop(){
    try{ if(rEngine){ rEngine.stop(); rEngine.disconnect(); } }catch(e){}
    rEngine = null; rEngGain = null;
  }
  function rEngineUpdate(speed, top){
    if(!rEngine || !rEngGain || !rAC) return;
    var f = rClamp(speed / top, 0, 1.1);
    var hz = 55 + f*135 + Math.sin(rAC.currentTime*22)*3;
    try{
      rEngine.frequency.setTargetAtTime(hz, rAC.currentTime, 0.05);
      rEngGain.gain.setTargetAtTime(0.03 + f*0.06, rAC.currentTime, 0.1);
    }catch(e){}
  }
  function rTone(f0, f1, dur, type, vol){
    var ac = rAudio(); if(!ac) return;
    try{
      var t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(f0, t);
      if(f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(vol || 0.12, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(ac.destination);
      o.start(t); o.stop(t + dur + 0.02);
    }catch(e){}
  }
  function rNoise(len, hz, vol, q){
    var ac = rAudio(); if(!ac) return;
    try{
      var t = ac.currentTime;
      var buf = ac.createBuffer(1, Math.max(1, ac.sampleRate*len), ac.sampleRate);
      var d = buf.getChannelData(0);
      for(var i=0;i<d.length;i++) d[i] = (Math.random()*2-1) * (1 - i/d.length);
      var src = ac.createBufferSource(); src.buffer = buf;
      var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = hz; if(q) bp.Q.value = q;
      var gn = ac.createGain(); gn.gain.value = vol;
      gn.gain.setTargetAtTime(0.0001, t + 0.02, len*0.4);
      src.connect(bp); bp.connect(gn); gn.connect(ac.destination);
      src.start(t);
    }catch(e){}
  }
  function rSfx(kind){
    switch(kind){
      case 'punch': rTone(440, 176, 0.12, 'square', 0.18); break;
      case 'swish': rNoise(0.09, 2200, 0.10, 1.2); break;
      case 'hit':   rNoise(0.16, 380, 0.35); break;
      case 'ko':    rNoise(0.22, 140, 0.40); break;
      case 'crash': rNoise(0.45, 220, 0.50); break;
      case 'beep':  rTone(660, 0, 0.12, 'square', 0.10); break;
      case 'go':    rTone(990, 0, 0.40, 'square', 0.12); break;
      case 'siren': rTone(rs && rs._sirHi ? 960 : 720, 0, 0.18, 'sawtooth', 0.05); break;
      case 'cash':  rTone(880, 1320, 0.16, 'triangle', 0.14); break;
    }
  }

  /* ── Track ─────────────────────────────────────────────────────────── */
  function rBuildRoad(T){
    var rnd = rRng(T.seed), N = T.segs + 90, i, k;
    var curve = new Float32Array(N), hill = new Float32Array(N);
    // Curves: hand-weighted sections with straights between them, so there
    // is room to fight on the straights and a rhythm to learn on the bends.
    i = 160;
    var sign = rnd() < 0.5 ? -1 : 1;
    while(i < T.segs - 100){
      if(rnd() < 0.30){ i += 50 + ((rnd()*110)|0); continue; }
      var len = 50 + ((rnd()*90)|0), amp = T.curve * (0.45 + rnd()*0.65);
      if(rnd() < 0.7) sign = -sign;
      for(k=0;k<len && i+k<N;k++){
        var u = k/len;
        curve[i+k] = sign * amp * Math.min(1, Math.sin(Math.PI*u) * 2.4);
      }
      i += len + 20;
    }
    // Hills: smooth bumps that return to the baseline.
    i = 220;
    while(i < T.segs - 160){
      var hl = 120 + ((rnd()*160)|0), ha = T.hill * (0.4 + rnd()*0.7) * (rnd() < 0.5 ? -1 : 1);
      for(k=0;k<hl && i+k<N;k++) hill[i+k] = Math.sin(Math.PI*k/hl) * ha;
      i += hl + 40 + ((rnd()*180)|0);
    }
    var scen = R_THEMES[T.theme].scen, segs = [];
    for(i=0;i<N;i++){
      var sc = null;
      if(i > 40 && i % 6 === 0){
        sc = { type: scen[(rnd()*scen.length)|0],
               side: (((i/6)|0) % 2) ? 1 : -1,
               off: 1.55 + rnd()*0.55 };
      }
      segs.push({ i:i, curve:curve[i], y:hill[i], sc:sc });
    }
    return segs;
  }
  function rBuildTraffic(T){
    var rnd = rRng(T.seed + 7), cars = [], z = R_START + 6000;
    var lanes = [-0.6, 0, 0.6];
    while(z < T.segs*RSEG - 12000){
      z += (3400 + rnd()*5000) / T.traffic;
      cars.push({ z:z, x:lanes[(rnd()*3)|0], spd:90 + rnd()*70,
                  col:R_CARS[(rnd()*R_CARS.length)|0], van: rnd() < 0.25 });
    }
    return cars;
  }
  function rSeg(z){
    var N = rs.segs.length, idx = Math.floor(z / RSEG) % N;
    if(idx < 0) idx += N;
    return rs.segs[idx];
  }
  function rHeightAt(z){
    var N = rs.segs.length, f = z / RSEG, i = Math.floor(f), t = f - i;
    var a = rs.segs[((i % N) + N) % N], b = rs.segs[(((i+1) % N) + N) % N];
    return a.y + (b.y - a.y) * t;
  }

  /* ── Riders ────────────────────────────────────────────────────────── */
  function rNewRival(i, T, z, x){
    var skill = 0.1 + Math.random()*0.85;
    var weaponed = Math.random() < T.weapons;
    var wt = Math.random() < 0.6 ? 'club' : 'chain';
    var maxHp = 62 + R_TRACKS.indexOf(T)*8 + skill*22;
    return {
      name:R_NAMES[i % R_NAMES.length], col:R_COLS[i % R_COLS.length], jacket:R_JACKS[i % R_JACKS.length], num:i + 2,
      z:z, x:x, top:T.top + skill*40, skill:skill, aggro:0.3 + Math.random()*0.7,
      speed:0, hp:maxHp, maxHp:maxHp, state:'ride', downT:0, inv:0,
      weapon: weaponed ? { type:wt, uses:R_WEAP[wt].uses } : null,
      atkCd:1 + Math.random(), atkT:0, atkSide:1, hitT:0, want:0, laneT:0, fin:false, lean:0
    };
  }
  function rSay(txt){ var st = el('rashStatus'); if(st) st.textContent = txt; }
  function rPop(txt){ rs.pops.push({ txt:txt, t:1.8 }); if(rs.pops.length > 4) rs.pops.shift(); }

  /* ── Race set-up and teardown ──────────────────────────────────────── */
  function rStartRace(){
    var T = R_TRACKS[rSel], B = R_BIKES[rSave.bike];
    var cv = el('rashCanvas');
    rs = {
      W: cv ? cv.width : 480, H: cv ? cv.height : 320,
      track:T, trackIdx:rSel, bike:B, theme:R_THEMES[T.theme],
      segs:rBuildRoad(T), cars:rBuildTraffic(T), rivals:[], cop:null,
      FIN:(T.segs - 40) * RSEG,
      mode:'grid', count:3.99, last:0, paused:false, time:0,
      pz:R_START, py:0, playerX:0.38, speed:0, hpMax:B.tough, hp:B.tough,
      state:'ride', downT:0, inv:0, weapon:null, atkCd:0, atkT:0, atkSide:1,
      hitFlash:0, shake:0, lastHit:9, bg:0, lean:0,
      heat:0, bust:0, copCd:12, kos:0, hits:0, wipes:0, bonus:0,
      finishOrder:[], place:0, finT:0, banner:'', bannerT:0, pops:[], _sirT:0, _sirHi:false, _gravel:0
    };
    for(var i=0;i<T.rivals;i++){
      var row = 1 + (i >> 1), col = (i & 1) ? 0.38 : -0.38;
      rs.rivals.push(rNewRival(i, T, R_START + row*520, col));
    }
    rPlaying = true;
    rResult = null;
    rShow(true);
    rSay(T.name + ' · get ready');
    rEngineStart();
    if(rRAF) cancelAnimationFrame(rRAF);
    rs.last = 0;
    rRAF = requestAnimationFrame(rLoop);
  }

  function rEnd(kind){
    if(!rs || rs.ended) return;
    rs.ended = true;
    var T = rs.track, place = rs.place || (rs.finishOrder.length + 1);
    var prize = 0, fine = 0, unlockedNew = false;
    if(kind === 'finish' && place <= 3) prize = T.prize[place-1];
    if(kind === 'busted') fine = Math.min(rSave.cash + rs.bonus, 400 * (rs.trackIdx + 1));
    var gain = prize + rs.bonus;
    rSave.cash += gain - fine;
    rSave.earned += gain;
    if(kind === 'finish' && place <= 3 && rSave.unlocked < rs.trackIdx + 1 && rs.trackIdx + 1 < R_TRACKS.length){
      rSave.unlocked = rs.trackIdx + 1; unlockedNew = true;
    }
    if(kind === 'finish'){
      var old = rSave.rec[rs.trackIdx];
      if(!old || place < old.place || (place === old.place && rs.time < old.time)){
        rSave.rec[rs.trackIdx] = { place:place, time:+rs.time.toFixed(1) };
      }
    }
    rPersist();
    setBest('rash', rSave.earned);
    AG3.refreshLabels();
    rResult = { kind:kind, place:place, prize:prize, bonus:rs.bonus, fine:fine, time:rs.time,
                kos:rs.kos, wipes:rs.wipes, unlockedNew:unlockedNew, track:T.name, trackIdx:rs.trackIdx };
    if(unlockedNew) rSel = rs.trackIdx + 1;
    rEngineStop();
    if(rRAF) cancelAnimationFrame(rRAF);
    rRAF = null;
    rPlaying = false;
    rShow(false);
    rMenu();
    rSay(kind === 'busted' ? 'Busted' : rOrd(place) + ' place');
  }

  AG3.rashInit = function(){
    rLoad();
    rSel = Math.min(rSel, rSave.unlocked);
    rResult = null;
    rs = null; rPlaying = false;
    rShow(false);
    rMenu();
    rSay('Pick a road');
  };
  AG3.rashStop = function(){
    if(rRAF) cancelAnimationFrame(rRAF);
    rRAF = null; rEngineStop(); rPlaying = false; rKeys = {};
  };
  AG3.rashKey = function(k, down){ rKeys[k] = !!down; };
  AG3.rashStart = function(){ if(rSel <= rSave.unlocked) rStartRace(); };
  AG3.rashQuit = function(){
    if(!rPlaying) return;
    AG3.rashStop(); rs = null; rResult = null;
    rShow(false); rMenu(); rSay('Pick a road');
  };
  AG3.rashPause = function(){
    if(!rs || !rPlaying || rs.mode === 'finish') return;
    rs.paused = !rs.paused;
    var b = el('rashPauseBtn'); if(b) b.textContent = rs.paused ? 'Resume' : 'Pause';
    if(!rs.paused) rs.last = 0;
    if(rEngGain && rAC){ try{ rEngGain.gain.setTargetAtTime(rs.paused ? 0 : 0.05, rAC.currentTime, 0.05); }catch(e){} }
  };
  AG3.rashTrack = function(i){ if(i <= rSave.unlocked){ rSel = i; rMenu(); } };
  AG3.rashBike = function(i){
    var B = R_BIKES[i]; if(!B) return;
    if(rSave.bikes.indexOf(i) < 0){
      if(rSave.cash < B.price) return;
      rSave.cash -= B.price; rSave.bikes.push(i); rSfx('cash');
    }
    rSave.bike = i; rPersist(); rMenu();
  };
  AG3.rashDismiss = function(){ rResult = null; rMenu(); };

  /* ── Menu (garage and road list) ───────────────────────────────────── */
  function rShow(play){
    var m = el('rashMenu'), p = el('rashPlay');
    if(m) m.style.display = play ? 'none' : '';
    if(p) p.style.display = play ? '' : 'none';
    var b = el('rashPauseBtn'); if(b) b.textContent = 'Pause';
  }
  function rBar(v, max, lo, hi){
    var p = Math.round(100 * (v - lo) / (hi - lo));
    return '<i style="width:' + rClamp(p, 8, 100) + '%"></i>';
  }
  function rMenu(){
    var m = el('rashMenu'); if(!m || !rSave) return;
    var h = '', i;
    h += '<div class="rm-head"><div><span>Cash</span><b>' + rMoney(rSave.cash) + '</b></div>' +
         '<div><span>Career</span><b>' + rMoney(rSave.earned) + '</b></div></div>';
    if(rResult){
      var R = rResult, cls = R.kind === 'busted' ? 'bad' : (R.place <= 3 ? 'good' : '');
      h += '<div class="rm-result ' + cls + '">';
      if(R.kind === 'busted'){
        h += '<h3>Busted</h3><p>The police pulled you over on ' + R.track + '.</p>';
      }else{
        h += '<h3>' + rOrd(R.place) + ' place</h3><p>' + R.track + ' · ' + rTime(R.time) + '</p>';
      }
      h += '<ul>';
      if(R.kind === 'finish') h += '<li><span>Prize</span><b>' + (R.prize ? '+' + rMoney(R.prize) : 'none (top 3 only)') + '</b></li>';
      h += '<li><span>Knockdowns (' + R.kos + ')</span><b>+' + rMoney(R.bonus) + '</b></li>';
      if(R.fine) h += '<li><span>Fine</span><b>−' + rMoney(R.fine) + '</b></li>';
      h += '<li><span>Wipe-outs</span><b>' + R.wipes + '</b></li></ul>';
      if(R.unlockedNew) h += '<p class="rm-note">New road unlocked: ' + R_TRACKS[R.trackIdx + 1].name + '</p>';
      h += '</div>';
    }
    h += '<h4>Roads</h4><div class="rm-tracks">';
    for(i=0;i<R_TRACKS.length;i++){
      var T = R_TRACKS[i], locked = i > rSave.unlocked, rec = rSave.rec[i];
      h += '<button class="rm-track' + (i === rSel ? ' sel' : '') + (locked ? ' lock' : '') + '"' +
           (locked ? ' disabled' : '') + ' onclick="AG3.rashTrack(' + i + ')">' +
           '<b>' + (locked ? '🔒 ' : '') + T.name + '</b>' +
           '<span>' + (T.rivals + 1) + ' riders · ~' + Math.round(T.segs / 18 / 6) / 10 + ' min' +
           (T.cops ? ' · police' : '') + '</span>' +
           '<em>Prize ' + rMoney(T.prize[0]) + ' / ' + rMoney(T.prize[1]) + ' / ' + rMoney(T.prize[2]) + '</em>' +
           (rec ? '<i>Best: ' + rOrd(rec.place) + ' · ' + rTime(rec.time) + '</i>' : '') +
           '</button>';
    }
    h += '</div><h4>Garage</h4><div class="rm-bikes">';
    for(i=0;i<R_BIKES.length;i++){
      var B = R_BIKES[i], owned = rSave.bikes.indexOf(i) >= 0, cur = rSave.bike === i;
      h += '<div class="rm-bike' + (cur ? ' sel' : '') + '"><div class="rb-name"><b>' + B.name + '</b>' +
           '<span>' + (owned ? (cur ? 'Riding' : 'Owned') : rMoney(B.price)) + '</span></div>' +
           '<div class="rb-stats">' +
             '<label>Speed<div class="ag3-bar">' + rBar(B.top, 0, 270, 420) + '</div></label>' +
             '<label>Accel<div class="ag3-bar">' + rBar(B.acc, 0, 100, 185) + '</div></label>' +
             '<label>Grip<div class="ag3-bar">' + rBar(B.grip, 0, 1.6, 2.3) + '</div></label>' +
             '<label>Tough<div class="ag3-bar">' + rBar(B.tough, 0, 80, 145) + '</div></label>' +
           '</div>';
      if(owned) h += '<button class="ag-btn" ' + (cur ? 'disabled' : '') + ' onclick="AG3.rashBike(' + i + ')">' + (cur ? 'Riding' : 'Ride') + '</button>';
      else h += '<button class="ag-btn" ' + (rSave.cash < B.price ? 'disabled' : '') + ' onclick="AG3.rashBike(' + i + ')">Buy ' + rMoney(B.price) + '</button>';
      h += '</div>';
    }
    h += '</div><div class="ag-row"><button class="ag-btn primary" onclick="AG3.rashStart()">Race ' + R_TRACKS[rSel].name + '</button></div>';
    h += '<p class="ag-hint">Arrows or WASD to ride. Z swings left, X swings right, Space swings at whoever is closest. P pauses. Top three win money and open the next road. Cars, trees and poles will throw you off.</p>';
    m.innerHTML = h;
  }

  /* ── Player actions ────────────────────────────────────────────────── */
  function rHurtPlayer(dmg){
    if(rs.inv > 0 || rs.state !== 'ride' || rs.mode === 'finish') return;
    rs.hp -= dmg; rs.hitFlash = 0.22; rs.shake = 5; rs.lastHit = 0;
    rs.speed *= 0.97;
    if(rs.hp <= 0){ rs.hp = 0; rWipe('fight'); }
  }
  function rWipe(why){
    if(rs.state === 'down' || rs.mode === 'finish') return;
    rs.state = 'down'; rs.downT = 2.8; rs.weapon = null; rs.shake = 9; rs.hitFlash = 0.3;
    rs.wipes++; rs.bust = 0;
    if(why !== 'fight') rs.hp = Math.max(1, rs.hp - 18);
    rSfx('crash');
    rSay(why === 'car' ? 'You hit a car' : why === 'obj' ? 'You hit the roadside' : 'Knocked off your bike');
  }
  function rKnock(t, isCop){
    t.state = 'down'; t.downT = 4 + Math.random()*1.5; t.weapon = null;
    rs.kos++;
    var gain = isCop ? R_COP_BONUS : R_KO_BONUS;
    rs.bonus += gain;
    rSfx('ko');
    rPop((isCop ? 'COP DOWN' : t.name + ' DOWN') + '  +' + rMoney(gain));
    if(isCop){ rs.heat = 0; rs.copCd = 22; rs.bust = 0; rSay('Cop down. Heat cleared'); }
    else rSay(t.name + ' is off the bike');
  }

  /* Z/X swing at the side given (-1 left, 1 right). side 0 = nearest. */
  function rAttack(side){
    if(!rs || rs.ended || rs.mode !== 'race' || rs.state !== 'ride' || rs.paused || rs.atkCd > 0) return;
    var W = rs.weapon ? R_WEAP[rs.weapon.type] : null;
    var reach = W ? W.reach : 1, dmg = W ? W.dmg : 13;
    var pool = rs.rivals.slice();
    if(rs.cop) pool.push(rs.cop);
    var sides = side ? [side] : [-1, 1], best = null, bestS = 0, bestScore = 1e9;
    for(var s=0;s<sides.length;s++){
      for(var i=0;i<pool.length;i++){
        var t = pool[i];
        if(t.state !== 'ride' || (t.inv > 0)) continue;
        var dz = t.z - rs.pz, dx = (t.x - rs.playerX) * sides[s];
        if(dx > 0.05 && dx < 0.78*reach && dz > -330 && dz < 300){
          var sc = Math.abs(dz) + dx*400;
          if(sc < bestScore){ bestScore = sc; best = t; bestS = sides[s]; }
        }
      }
    }
    var useSide = best ? bestS : (side || rs.atkSide);
    rs.atkCd = W ? 0.46 : 0.36; rs.atkT = 0.3; rs.atkSide = useSide;
    if(!best){ rSfx('swish'); return; }
    best.hp -= dmg; best.hitT = 0.22; best.x += useSide * 0.12;
    best.speed = Math.max(0, best.speed - 8);
    rs.hits++;
    if(rs.track.cops) rs.heat = Math.min(1, rs.heat + 0.13);
    rSfx(W ? 'hit' : 'punch');
    if(W){
      rs.weapon.uses--;
      if(rs.weapon.uses <= 0){ rSay('Your ' + W.name.toLowerCase() + ' broke'); rs.weapon = null; }
    }else if(best.weapon && Math.random() < 0.5){
      var wt = best.weapon.type;
      rs.weapon = { type:wt, uses:Math.ceil(R_WEAP[wt].uses * 0.7) };
      best.weapon = null;
      rSay('You snatched their ' + R_WEAP[wt].name.toLowerCase());
      rPop('GOT THE ' + R_WEAP[wt].name.toUpperCase());
    }
    if(best.hp <= 0) rKnock(best, best === rs.cop);
  }
  AG3.rashAtk = rAttack;

  /* ── Simulation ────────────────────────────────────────────────────── */
  function rUpdate(dt){
    var T = rs.track, B = rs.bike, i, r;

    if(rs.mode === 'grid'){
      var c0 = Math.ceil(rs.count);
      rs.count -= dt;
      if(rs.count > 0 && Math.ceil(rs.count) !== c0) rSfx('beep');
      if(rs.count <= 0){
        rs.mode = 'race'; rs.banner = 'GO!'; rs.bannerT = 1.1; rSfx('go');
        rSay(T.name + ' · Z/X swing · top 3 win');
      }
      rEngineUpdate(rKeys.up ? B.top*0.5 : 0, B.top);
      return;
    }

    var finishing = rs.mode === 'finish';
    if(!finishing) rs.time += dt;
    if(rs.atkCd > 0) rs.atkCd -= dt;
    if(rs.atkT > 0) rs.atkT -= dt;
    if(rs.inv > 0) rs.inv -= dt;
    if(rs.hitFlash > 0) rs.hitFlash -= dt;
    if(rs.shake > 0) rs.shake -= dt*8;
    if(rs.bannerT > 0) rs.bannerT -= dt;
    for(i=0;i<rs.pops.length;i++) rs.pops[i].t -= dt;
    while(rs.pops.length && rs.pops[0].t <= 0) rs.pops.shift();
    rs.lastHit += dt;

    /* --- player --- */
    var seg = rSeg(rs.pz);
    if(rs.state === 'ride'){
      var up = rKeys.up && !finishing, dn = rKeys.down || finishing;
      var off = Math.abs(rs.playerX) > 1.0;
      var cap = B.top * (off ? 0.55 : 1);
      if(up) rs.speed += B.acc * dt * (1.15 - 0.45*rs.speed/B.top);
      else if(dn) rs.speed -= (finishing ? 160 : 300) * dt;
      else rs.speed -= 38*dt;
      if(rs.speed > cap) rs.speed = Math.max(cap, rs.speed - 220*dt);
      rs.speed = Math.max(0, rs.speed);

      var steer = finishing ? rClamp(-rs.playerX*2, -1, 1) : ((rKeys.left ? -1 : 0) + (rKeys.right ? 1 : 0));
      var g = rs.speed / B.top;
      rs.playerX += steer * dt * B.grip * (0.35 + g*0.65);
      rs.playerX -= seg.curve * dt * g * 0.42;       // steer into the bend
      rs.playerX = rClamp(rs.playerX, -1.5, 1.5);
      rs.lean += ((steer*0.5) - rs.lean) * Math.min(1, dt*10);

      if(off){
        rs.shake = Math.max(rs.shake, 2.5);
        rs.hp -= 2.0*dt;
        rs._gravel -= dt;
        if(rs._gravel <= 0){ rSfx('crash'); rs._gravel = 0.55; }
        if(rs.hp <= 0){ rs.hp = 0; rWipe('fight'); }
      }else if(rs.lastHit > 3 && rs.hp < rs.hpMax && !finishing){
        rs.hp = Math.min(rs.hpMax, rs.hp + 0.9*dt);   // slow recovery when nobody is hitting you
      }
      // Roadside objects are solid.
      if(rs.speed > 110 && !finishing && rs.inv <= 0){
        var bi = Math.floor(rs.pz / RSEG), N = rs.segs.length;
        for(var k=0;k<3;k++){
          var o = rs.segs[(bi + k) % N].sc;
          if(o && Math.sign(rs.playerX) === o.side && Math.abs(rs.playerX) > o.off - 0.18){ rWipe('obj'); break; }
        }
      }
    }else{
      // Down: the bike skids to a stop and the rider runs back to it.
      rs.speed = Math.max(0, rs.speed - 420*dt);
      rs.downT -= dt;
      if(rs.downT <= 0){
        rs.state = 'ride'; rs.inv = 1.8;
        rs.hp = Math.max(rs.hp, rs.hpMax*0.4);
        rs.speed = 0;
      }
    }
    rs.pz += rs.speed * dt * R_STEP;
    rs.py = rHeightAt(rs.pz);
    rs.bg -= seg.curve * rs.speed * dt * 0.012;
    rEngineUpdate(rs.speed, B.top);

    // Crossing the line.
    if(rs.mode === 'race' && rs.pz >= rs.FIN){
      rs.mode = 'finish';
      rs.place = rs.finishOrder.length + 1;
      rs.finT = 2.6;
      rs.banner = 'FINISH · ' + rOrd(rs.place); rs.bannerT = 2.6;
      rSfx('go');
      rSay('Finished ' + rOrd(rs.place));
    }
    if(finishing){
      rs.finT -= dt;
      if(rs.finT <= 0){ rEnd('finish'); return; }
    }

    /* --- traffic --- */
    for(i=0;i<rs.cars.length;i++){
      var car = rs.cars[i];
      car.z += car.spd * dt * R_STEP;
      var cdz = car.z - rs.pz;
      if(cdz > -200 && cdz < 260 && Math.abs(car.x - rs.playerX) < 0.34 &&
         rs.state === 'ride' && rs.inv <= 0 && !finishing){
        rWipe('car');
      }
    }

    /* --- rivals --- */
    for(i=0;i<rs.rivals.length;i++) rRival(rs.rivals[i], dt);
    // Keep riders from sitting inside each other.
    for(i=0;i<rs.rivals.length;i++){
      for(var j=i+1;j<rs.rivals.length;j++){
        var a = rs.rivals[i], b = rs.rivals[j];
        if(a.state !== 'ride' || b.state !== 'ride') continue;
        if(Math.abs(a.z - b.z) < 230 && Math.abs(a.x - b.x) < 0.26){
          var sg = (a.x >= b.x) ? 1 : -1;
          a.x += sg*dt*0.9; b.x -= sg*dt*0.9;
          var lead = a.z > b.z ? a : b, tail = lead === a ? b : a;
          tail.speed = Math.min(tail.speed, lead.speed);
        }
      }
    }
    // The player and a rival touching: shove apart, rear-ender slows to match.
    if(rs.state === 'ride' && !finishing){
      for(i=0;i<rs.rivals.length;i++){
        r = rs.rivals[i];
        if(r.state !== 'ride') continue;
        var dz2 = r.z - rs.pz;
        if(Math.abs(dz2) < 230 && Math.abs(r.x - rs.playerX) < 0.28){
          var s2 = (rs.playerX >= r.x) ? 1 : -1;
          rs.playerX += s2*dt*1.4; r.x -= s2*dt*1.4;
          if(dz2 > 0) rs.speed = Math.min(rs.speed, r.speed + 10);
          else r.speed = Math.min(r.speed, rs.speed + 10);
        }
      }
    }

    /* --- police --- */
    if(T.cops && !finishing) rCop(dt);

    // Place for the HUD.
    var ahead = 0;
    for(i=0;i<rs.rivals.length;i++) if(rs.rivals[i].z > rs.pz) ahead++;
    rs.posNow = rs.mode === 'finish' ? rs.place : ahead + 1;
  }

  function rRival(r, dt){
    var T = rs.track;
    if(r.hitT > 0) r.hitT -= dt;
    if(r.atkT > 0) r.atkT -= dt;
    if(r.inv > 0) r.inv -= dt;
    if(r.state === 'down'){
      r.downT -= dt;
      r.speed = Math.max(0, r.speed - 420*dt);
      r.z += r.speed*dt*R_STEP;
      if(r.downT <= 0){ r.state = 'ride'; r.hp = r.maxHp*0.5; r.speed = 0; r.inv = 1.4; }
      return;
    }
    var d = r.z - rs.pz, sg = rSeg(r.z);
    var tgt = r.top * (1 - Math.min(0.2, Math.abs(sg.curve) * 0.035 * (1.2 - r.skill)));
    if(r.z >= rs.FIN) tgt = 110;
    else if(d < -3000) tgt *= 1 + Math.min(0.2, (-d - 3000) / 40000);   // the pack hauls back anyone who gets away
    else if(d > 11000 && r.z < rs.FIN - 20000) tgt *= 0.94;            // leaders ease so a crash is not the end of the race
    var dv = tgt - r.speed;
    r.speed += Math.max(-250*dt, Math.min(150*dt, dv));
    r.z += r.speed*dt*R_STEP;

    // Where to be on the road.
    r.laneT -= dt;
    if(r.laneT <= 0){ r.laneT = 1.5 + Math.random()*2.5; r.want = Math.random()*1.4 - 0.7; }
    var want = r.want;
    if(r.aggro > 0.35 && Math.abs(d) < 1500 && rs.state === 'ride' && r.z < rs.FIN)
      want = rs.playerX + (r.x > rs.playerX ? 0.42 : -0.42);
    for(var i=0;i<rs.cars.length;i++){
      var c = rs.cars[i], cd = c.z - r.z;
      if(cd > 0 && cd < 2400 && Math.abs(c.x - r.x) < 0.45) want = c.x + (r.x >= c.x ? 0.62 : -0.62);
      // Not everyone sees the car in time.
      if(cd > -60 && cd < 300 && Math.abs(c.x - r.x) < 0.3 && r.speed > c.spd + 20 && r.inv <= 0){
        r.state = 'down'; r.downT = 3.5 + Math.random(); r.weapon = null; r.z = c.z - 320;
        r.speed = Math.min(r.speed, 160); rSfx('crash');
        return;
      }
    }
    var dxm = rClamp(want - r.x, -1, 1);
    r.x += dxm * dt * (0.6 + 0.5*r.skill);
    r.x -= sg.curve * dt * (r.speed / r.top) * 0.30 * (1 - 0.5*r.skill);
    r.x = rClamp(r.x, -1.05, 1.05);
    r.lean += (rClamp(dxm, -1, 1)*0.5 - r.lean) * Math.min(1, dt*8);

    // Finishing.
    if(!r.fin && r.z >= rs.FIN){ r.fin = true; rs.finishOrder.push(r); }

    // Fighting the player.
    if(rs.state === 'ride' && rs.inv <= 0 && rs.mode === 'race' && Math.abs(d) < 340 && Math.abs(r.x - rs.playerX) < 0.6){
      r.atkCd -= dt;
      if(r.atkCd <= 0){
        r.atkCd = (2.3 - 1.0*r.aggro) + Math.random()*0.8;
        r.atkSide = (rs.playerX >= r.x) ? 1 : -1;
        r.atkT = 0.3;
        if(Math.random() < 0.8){
          var W = r.weapon ? R_WEAP[r.weapon.type] : null;
          var dmg = (6 + rs.trackIdx*1.2 + r.skill*3) * (W ? W.mult : 1);
          rHurtPlayer(dmg);
          rSfx(W ? 'hit' : 'punch');
          if(W){ r.weapon.uses--; if(r.weapon.uses <= 0) r.weapon = null; }
          rSay(r.name + (W ? ' clubs you' : ' lands one on you'));
        }else rSfx('swish');
      }
    }
  }

  function rCop(dt){
    var B = rs.bike, c = rs.cop;
    if(!c){
      if(rs.copCd > 0) rs.copCd -= dt;
      if(rs.heat > 0 && rs.heat < 1) rs.heat = Math.max(0, rs.heat - 0.025*dt);   // brawling has to be sustained
      if(rs.heat >= 1 && rs.copCd <= 0 && rs.state === 'ride'){
        rs.cop = { name:'COP', z:rs.pz - 5200, x:rClamp(rs.playerX, -0.7, 0.7), speed:B.top*0.9, top:B.top*1.04 + rs.trackIdx*3,
                   hp:80, maxHp:80, state:'ride', downT:0, inv:0, atkCd:1.2, atkT:0, atkSide:1, hitT:0, weapon:null, light:0 };
        rSay('Police on your tail. Knock the cop off or get busted');
        rPop('POLICE');
      }
      return;
    }
    c.light += dt;
    if(c.hitT > 0) c.hitT -= dt;
    if(c.atkT > 0) c.atkT -= dt;
    if(c.state === 'down'){
      c.downT -= dt; c.speed = Math.max(0, c.speed - 420*dt); c.z += c.speed*dt*R_STEP;
      if(c.downT <= 0 || c.z < rs.pz - 9000){ rs.cop = null; rs.heat = 0; }
      return;
    }
    // Siren while the cop is on you.
    rs._sirT -= dt;
    if(rs._sirT <= 0){ rs._sirT = 0.22; rs._sirHi = !rs._sirHi; rSfx('siren'); }
    var d = c.z - rs.pz;
    var tgt = Math.abs(d) < 500 ? rs.speed*1.02 + 6 : c.top;
    if(rs.state === 'down') tgt = Math.max(tgt, 60);
    var dv = tgt - c.speed;
    c.speed += Math.max(-260*dt, Math.min(170*dt, dv));
    c.z += c.speed*dt*R_STEP;
    var want = rs.playerX + (c.x > rs.playerX ? 0.42 : -0.42);
    c.x += rClamp(want - c.x, -1, 1) * dt * 0.9;
    c.x = rClamp(c.x, -1.05, 1.05);
    if(rs.state === 'ride' && Math.abs(d) < 430 && Math.abs(c.x - rs.playerX) < 0.7){
      rs.bust += dt;
      c.atkCd -= dt;
      if(c.atkCd <= 0){
        c.atkCd = 1.5; c.atkT = 0.3; c.atkSide = (rs.playerX >= c.x) ? 1 : -1;
        if(Math.abs(c.x - rs.playerX) < 0.6){ rHurtPlayer(9); rSfx('hit'); }
      }
      if(rs.bust >= 5){ rEnd('busted'); }
    }else{
      rs.bust = Math.max(0, rs.bust - dt*0.6);
    }
  }

  /* ── HUD (DOM) ─────────────────────────────────────────────────────── */
  function rHud(){
    if(!rs) return;
    var s = el('rashSpeed'); if(s) s.textContent = Math.round(rs.speed * 0.8);
    var p = el('rashPos'); if(p) p.textContent = (rs.posNow || (rs.rivals.length + 1)) + '/' + (rs.rivals.length + 1);
    var hp = el('rashHp');
    if(hp){
      hp.style.width = Math.max(0, 100*rs.hp/rs.hpMax) + '%';
      hp.parentNode.classList.toggle('low', rs.hp <= rs.hpMax*0.3);
    }
    var w = el('rashWeapon');
    if(w) w.textContent = rs.weapon ? R_WEAP[rs.weapon.type].name + ' ×' + rs.weapon.uses : '—';
    var t = el('rashTime'); if(t) t.textContent = rTime(rs.time);
    var c = el('rashCop');
    if(c){
      if(!rs.track.cops) c.textContent = 'n/a';
      else if(rs.cop && rs.cop.state === 'ride') c.textContent = rs.bust > 0.2 ? 'BUST ' + Math.min(99, Math.round(rs.bust/5*100)) + '%' : 'CHASED';
      else c.textContent = rs.heat > 0.02 ? 'heat ' + Math.round(rs.heat*100) + '%' : 'clear';
      c.parentNode.classList.toggle('alert', !!(rs.cop && rs.cop.state === 'ride'));
    }
  }

  /* ── Frame loop ────────────────────────────────────────────────────── */
  function rLoop(t){
    rRAF = requestAnimationFrame(rLoop);
    if(!rs) return;
    if(!rs.last) rs.last = t;
    var dt = Math.min(0.05, (t - rs.last)/1000);
    rs.last = t;
    if(rs.paused){ rDraw(); return; }
    if(!dt) return;
    rUpdate(dt);
    if(!rs || rs.ended) return;
    rHud();
    rDraw();
  }

  /* ── Drawing ───────────────────────────────────────────────────────── */
  function rStrip(g, p0, p1, l0, l1, col){
    var a = p0.sw*0.5, b = p1.sw*0.5;
    g.fillStyle = col;
    g.beginPath();
    var y0 = p0.sy + 1;                      // 1px of overlap hides the seam between segments
    g.moveTo(p0.sx + l0*a, y0); g.lineTo(p0.sx + l1*a, y0);
    g.lineTo(p1.sx + l1*b, p1.sy); g.lineTo(p1.sx + l0*b, p1.sy);
    g.closePath(); g.fill();
  }

  /* Projection at an arbitrary z between the projected segments. Returns
     null when the point is out of range or behind a crest. */
  function rAt(z, force){
    var wz = z - rs.camz;
    if(wz < 60) return null;
    var nf = (wz + rs.camOff) / RSEG, n0 = Math.floor(nf), f = nf - n0;
    if(n0 < 0 || n0 + 1 >= RDRAW) return null;
    var a = rs.proj[n0], b = rs.proj[n0+1];
    var sy = a.sy + (b.sy - a.sy)*f;
    if(!force && sy - b.clip > 4) return null;
    return { sx:a.sx + (b.sx - a.sx)*f, sy:sy, sc:340/wz, n:n0 };
  }

  function rDraw(){
    var g = ctx2d('rashCanvas');
    if(!g || !rs) return;
    var W = rs.W, H = rs.H, TH = rs.theme, i, n;
    var camz = rs.pz - R_CAM;
    var base = Math.floor(camz / RSEG), camOff = camz - base*RSEG, N = rs.segs.length;
    rs.camz = camz; rs.camOff = camOff;
    var camY = R_CAMH + rs.py;
    var shakeX = rs.shake > 0 ? (Math.random()-0.5)*rs.shake : 0;

    g.save();
    g.translate(shakeX, 0);

    // Sky, stars, far hills (they drift against the bends).
    var sky = g.createLinearGradient(0, 0, 0, H*0.5);
    sky.addColorStop(0, TH.sky[0]); sky.addColorStop(1, TH.sky[1]);
    g.fillStyle = sky; g.fillRect(-8, 0, W+16, H*0.5 + 1);
    if(TH.stars){
      g.fillStyle = 'rgba(255,255,255,.8)';
      for(i=0;i<46;i++){
        var stx = ((i*97.3 + rs.bg*0.25) % (W+20) + (W+20)) % (W+20) - 10;
        g.fillRect(stx, (i*53.7) % (H*0.4), i%5===0 ? 2 : 1, i%5===0 ? 2 : 1);
      }
    }
    for(var L=0;L<2;L++){
      g.fillStyle = TH.hill[L];
      g.beginPath(); g.moveTo(-10, H*0.5);
      for(var hx=-10; hx<=W+10; hx+=8){
        var o = (hx + rs.bg*(0.5 + L*0.5)) * (L ? 0.017 : 0.011);
        g.lineTo(hx, H*0.5 - (L ? 10 : 26) - (L ? 7 : 14)*Math.sin(o) - (L ? 4 : 9)*Math.sin(o*2.7 + 1.7));
      }
      g.lineTo(W+10, H*0.5); g.closePath(); g.fill();
    }
    g.fillStyle = TH.grass[0]; g.fillRect(-8, H*0.5, W+16, H*0.5);

    // Project every segment from the camera forward. Accumulating dx/ddx is
    // what bends the road. Starting dx from the camera segment's own curve
    // (scaled by how far through it we are) stops the road snapping as the
    // camera crosses a segment boundary.
    var baseSeg = rs.segs[((base % N) + N) % N];
    var x = 0, dx = -(baseSeg.curve * (camOff / RSEG));
    var proj = rs.proj || (rs.proj = new Array(RDRAW));
    for(n=0;n<RDRAW;n++){
      var idx = base + n, s = rs.segs[((idx % N) + N) % N];
      var world = n*RSEG - camOff; if(world < 1) world = 1;
      var sc = 340 / world;
      var p = proj[n] || (proj[n] = {});
      p.sx = W/2 + (x*0.9 - rs.playerX*1000) * sc;
      p.sy = H*0.5 + (camY - s.y) * sc * 0.42;
      p.sw = RW * sc; p.sc = sc; p.world = world; p.idx = idx; p.clip = 0;
      x += dx; dx += s.curve;
    }
    // Road, near to far, clipped against hill crests.
    var maxY = H + 1;
    proj[0].clip = H + 1;
    for(n=1;n<RDRAW;n++){
      var p0 = proj[n-1], p1 = proj[n];
      if(p1.sy < p0.sy && p1.sy < maxY){
        var seg2 = rs.segs[((p1.idx % N) + N) % N];
        var band = (Math.floor(p1.idx/3) % 2) === 0;
        g.fillStyle = band ? TH.grass[0] : TH.grass[1];
        g.fillRect(-8, p1.sy, W+16, Math.min(p0.sy, maxY) - p1.sy);
        rStrip(g, p0, p1, -1, 1, band ? TH.tar[0] : TH.tar[1]);
        rStrip(g, p0, p1, -1.06, -1.0, band ? TH.rum[0] : TH.rum[1]);
        rStrip(g, p0, p1,  1.0,  1.06, band ? TH.rum[0] : TH.rum[1]);
        if(band){
          rStrip(g, p0, p1, -0.315, -0.285, 'rgba(240,240,240,.85)');
          rStrip(g, p0, p1,  0.285,  0.315, 'rgba(240,240,240,.85)');
        }
        rStrip(g, p0, p1, -0.97, -0.94, 'rgba(240,240,240,.7)');
        rStrip(g, p0, p1,  0.94,  0.97, 'rgba(240,240,240,.7)');
        if(p1.idx === 15 || p1.idx === rs.track.segs - 40){   // start and finish lines
          for(var cc=0;cc<8;cc++){
            rStrip(g, p0, p1, -1 + cc*0.25, -0.75 + cc*0.25, (cc % 2) ? '#f2f2f2' : '#1a1a1a');
          }
        }
        maxY = p1.sy;
      }
      p1.clip = maxY;
    }

    // Bucket the moving things by the segment they are on.
    var bucket = rs._bk || (rs._bk = []);
    for(n=0;n<RDRAW;n++) bucket[n] = null;
    function put(z, item){
      var wz = z - camz;
      if(wz < 60) return;
      var nn = Math.floor((wz + camOff)/RSEG);
      if(nn < 0 || nn >= RDRAW) return;
      item.z = z;
      (bucket[nn] || (bucket[nn] = [])).push(item);
    }
    for(i=0;i<rs.cars.length;i++){
      var cr = rs.cars[i];
      if(cr.z > camz && cr.z < camz + RDRAW*RSEG) put(cr.z, { k:'car', o:cr });
    }
    for(i=0;i<rs.rivals.length;i++){
      var rv = rs.rivals[i];
      if(rv.z > camz && rv.z < camz + RDRAW*RSEG) put(rv.z, { k:'rider', o:rv });
    }
    if(rs.cop) put(rs.cop.z, { k:'cop', o:rs.cop });
    put(rs.pz, { k:'me', o:null });
    put(rs.FIN, { k:'gate', o:null });

    // Sprites, far to near.
    for(n=RDRAW-1;n>=0;n--){
      var pn = proj[n], sg2 = rs.segs[((pn.idx % N) + N) % N];
      if(sg2.sc && pn.sy - pn.clip <= 4 && pn.sy > 0 && pn.sy < H + 80 && pn.sc > 0.02){
        var sn = sg2.sc, sw = pn.sw;
        rScenery(g, sn.type, pn.sx + sn.side*sn.off*sw*0.5, pn.sy, sw, TH.stars || TH === R_THEMES.dusk);
      }
      var bk = bucket[n];
      if(!bk) continue;
      if(bk.length > 1) bk.sort(function(a,b){ return b.z - a.z; });
      for(var q=0;q<bk.length;q++) rDrawItem(g, bk[q]);
    }

    g.restore();

    // Speed lines.
    var spd01 = rs.speed / rs.bike.top;
    if(spd01 > 0.55){
      g.save();
      g.strokeStyle = 'rgba(255,255,255,' + ((spd01-0.55)*0.45) + ')';
      g.lineWidth = 2;
      var cx = W/2, cy = H*0.46;
      for(var qq=0;qq<7;qq++){
        var ang = (qq/7)*Math.PI*2 + rs.pz*0.01;
        var r1 = 46 + (qq%3)*14, r2 = r1 + 30 + spd01*34;
        g.beginPath();
        g.moveTo(cx + Math.cos(ang)*r1, cy + Math.sin(ang)*r1*0.6);
        g.lineTo(cx + Math.cos(ang)*r2, cy + Math.sin(ang)*r2*0.6);
        g.stroke();
      }
      g.restore();
    }

    if(rs.hitFlash > 0){
      g.fillStyle = 'rgba(224,90,63,' + (rs.hitFlash*0.9) + ')';
      g.fillRect(0, 0, W, H);
    }

    rOverlay(g, W, H);
  }

  function rDrawItem(g, it){
    var a = rAt(it.z, it.k === 'me');
    if(!a) return;
    var sc = a.sc, bw = 560*sc;
    if(it.k === 'me'){
      var px = a.sx + rs.playerX*1000*sc, py = a.sy;
      if(rs.state === 'down'){
        rBike(g, px, py, bw, { col:rs.bike.col, helmet:'#e9e9e4', down:true });
        // The rider, running back to the bike.
        var k = 1 - rs.downT/2.8, off = (1 - k) * (rs.playerX >= 0 ? -1 : 1) * bw*1.4;
        rRunner(g, px + off, py, bw, rs.time*14, '#262a33', rs.bike.col);
      }else{
        if(rs.inv > 0 && Math.floor(rs.inv*10) % 2 === 0) g.globalAlpha = 0.55;
        rBike(g, px, py, bw, { col:rs.bike.col, helmet:'#e9e9e4', lean:rs.lean, braking:rKeys.down && rs.speed > 20,
                               atkSide:rs.atkSide, atkP:rs.atkT > 0 ? 1 - rs.atkT/0.3 : -1,
                               weapon:rs.weapon ? rs.weapon.type : null, flash:rs.hitFlash > 0.1, me:true });
        g.globalAlpha = 1;
      }
    }else if(it.k === 'rider' || it.k === 'cop'){
      var r = it.o, rx = a.sx + r.x*1000*sc;
      var w2 = bw * 0.96;
      if(a.sc*560 < 5) return;
      rBike(g, rx, a.sy, w2, { col:it.k === 'cop' ? '#f1f3f6' : r.col, jacket:r.jacket, helmet:it.k === 'cop' ? '#f1f3f6' : (r.jacket === '#e8e8e2' || r.jacket === '#d9d9d0' || r.jacket === '#cfd2d8' || r.jacket === '#e2e0d6' ? '#20242b' : '#e9e9e4'),
                               down:r.state === 'down', lean:r.lean || 0,
                               atkSide:r.atkSide, atkP:r.atkT > 0 ? 1 - r.atkT/0.3 : -1,
                               weapon:r.weapon ? r.weapon.type : null, flash:r.hitT > 0,
                               cop:it.k === 'cop', light:r.light || 0, num:it.k === 'rider' ? r.num : 0 });
    }else if(it.k === 'car'){
      var c = it.o;
      rCar(g, a.sx + c.x*1000*sc, a.sy, 700*sc*(c.van ? 1.1 : 1), c.col, c.van);
    }else if(it.k === 'gate'){
      rGate(g, a.sx, a.sy, a.sc);
    }
  }

  function rOverlay(g, W, H){
    // Progress strip along the top.
    var bx = 22, bw = W - 44, by = 9, span = rs.FIN - R_START;
    g.fillStyle = 'rgba(0,0,0,.38)'; g.fillRect(bx, by, bw, 4);
    function dot(z, col, r){
      var f = rClamp((z - R_START)/span, 0, 1);
      g.fillStyle = col; g.beginPath(); g.arc(bx + f*bw, by + 2, r, 0, 7); g.fill();
    }
    for(var i=0;i<rs.rivals.length;i++) dot(rs.rivals[i].z, rs.rivals[i].col, 2.6);
    if(rs.cop && rs.cop.state === 'ride') dot(rs.cop.z, '#e03a3a', 3);
    dot(rs.pz, '#ffffff', 4);
    g.fillStyle = '#fff'; g.fillRect(bx + bw - 1, by - 3, 2, 10);

    g.textAlign = 'center';
    if(rs.mode === 'grid'){
      var n = Math.ceil(rs.count);
      g.font = '800 64px ui-monospace,Menlo,monospace';
      g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.45)'; g.fillStyle = '#fff';
      g.strokeText(String(n), W/2, H*0.36); g.fillText(String(n), W/2, H*0.36);
    }
    if(rs.bannerT > 0){
      g.save();
      g.globalAlpha = Math.min(1, rs.bannerT * 1.5);
      g.font = '800 34px ui-monospace,Menlo,monospace';
      g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,.45)'; g.fillStyle = '#fff';
      g.strokeText(rs.banner, W/2, H*0.34); g.fillText(rs.banner, W/2, H*0.34);
      g.restore();
    }
    g.font = '800 13px ui-monospace,Menlo,monospace';
    for(var p=0;p<rs.pops.length;p++){
      var pp = rs.pops[p];
      g.globalAlpha = Math.min(1, pp.t);
      g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.5)'; g.fillStyle = '#ffd24a';
      g.strokeText(pp.txt, W/2, H*0.46 + p*17); g.fillText(pp.txt, W/2, H*0.46 + p*17);
      g.globalAlpha = 1;
    }
    if(rs.cop && rs.cop.state === 'ride' && rs.bust > 0.2){
      var f = rClamp(rs.bust/5, 0, 1);
      g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(W/2 - 60, H - 16, 120, 7);
      g.fillStyle = ((rs.cop.light*4)|0) % 2 ? '#3a7be0' : '#e03a3a';
      g.fillRect(W/2 - 60, H - 16, 120*f, 7);
    }
    if(rs.paused){
      g.fillStyle = 'rgba(20,24,32,.6)'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#fff'; g.font = '800 28px ui-monospace,Menlo,monospace';
      g.fillText('PAUSED', W/2, H/2);
    }
    g.textAlign = 'left';
  }

  /* One roadside object, scaled to the road width at that distance. */
  function rScenery(g, type, x, groundY, roadW, lit){
    var s = roadW * 0.5;
    if(s < 3) return;
    g.save();
    g.translate(x, groundY);
    if(type === 'tree'){
      var th = s*1.7, tw = s*0.5;
      g.fillStyle = '#3a2a1c';
      g.fillRect(-tw*0.14, -th*0.34, tw*0.28, th*0.34);
      g.fillStyle = '#2f6b34';
      g.beginPath(); g.ellipse(0, -th*0.55, tw*0.7, th*0.4, 0, 0, 7); g.fill();
      g.fillStyle = '#3a7c40';
      g.beginPath(); g.ellipse(-tw*0.25, -th*0.68, tw*0.42, th*0.3, 0, 0, 7); g.fill();
    }else if(type === 'pine'){
      var ph2 = s*2.1;
      g.fillStyle = '#3a2a1c'; g.fillRect(-s*0.04, -ph2*0.2, s*0.08, ph2*0.2);
      for(var t=0;t<3;t++){
        g.fillStyle = t % 2 ? '#2c5c3a' : '#24503a';
        var yy = -ph2*(0.16 + t*0.26), ww = s*(0.52 - t*0.12);
        g.beginPath(); g.moveTo(-ww, yy); g.lineTo(ww, yy); g.lineTo(0, yy - ph2*0.4); g.closePath(); g.fill();
      }
    }else if(type === 'cactus'){
      var ch = s*1.5;
      g.fillStyle = '#4c8a4a';
      g.fillRect(-s*0.07, -ch, s*0.14, ch);
      g.fillRect(-s*0.3, -ch*0.62, s*0.23, s*0.1); g.fillRect(-s*0.3, -ch*0.62 - s*0.34, s*0.1, s*0.44);
      g.fillRect(s*0.07, -ch*0.5, s*0.23, s*0.1);  g.fillRect(s*0.2, -ch*0.5 - s*0.3, s*0.1, s*0.4);
    }else if(type === 'lamp'){
      var lh = s*2.2;
      g.fillStyle = '#7a808a'; g.fillRect(-s*0.04, -lh, s*0.08, lh);
      g.fillRect(-s*0.04, -lh, s*0.34, s*0.07);
      if(lit){
        g.fillStyle = 'rgba(255,230,150,.28)';
        g.beginPath(); g.arc(s*0.3, -lh + s*0.1, s*0.42, 0, 7); g.fill();
      }
      g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(s*0.3, -lh + s*0.1, s*0.08, 0, 7); g.fill();
    }else if(type === 'pole'){
      var ph = s*2.0;
      g.fillStyle = '#8a8f98'; g.fillRect(-s*0.06, -ph, s*0.12, ph);
      g.fillStyle = '#c7ccd4'; g.fillRect(-s*0.34, -ph, s*0.68, s*0.14);
    }else if(type === 'sign'){
      var sh = s*1.1;
      g.fillStyle = '#6b7079'; g.fillRect(-s*0.05, -sh, s*0.10, sh);
      g.fillStyle = '#e8b530';
      g.beginPath();
      g.moveTo(0, -sh - s*0.55); g.lineTo(s*0.5, -sh); g.lineTo(0, -sh + s*0.05);
      g.lineTo(-s*0.5, -sh); g.closePath(); g.fill();
    }else{
      g.fillStyle = '#7d7469';
      g.beginPath(); g.ellipse(0, -s*0.28, s*0.5, s*0.3, 0, 0, 7); g.fill();
      g.fillStyle = '#8f877b';
      g.beginPath(); g.ellipse(-s*0.12, -s*0.4, s*0.28, s*0.2, 0, 0, 7); g.fill();
    }
    g.restore();
  }

  /* Finish gantry over the road. */
  function rGate(g, x, y, sc){
    var hw = 1.12*1000*sc, ph = 900*sc, bh = 150*sc;
    if(ph < 6) return;
    g.fillStyle = '#9aa0a8';
    g.fillRect(x - hw - 5*sc*10, y - ph, 10*sc*1.2 + 2, ph);
    g.fillRect(x + hw - 1, y - ph, 10*sc*1.2 + 2, ph);
    var cols = 16, cw = (2*hw)/cols;
    for(var r=0;r<2;r++) for(var c=0;c<cols;c++){
      g.fillStyle = ((r + c) % 2) ? '#f2f2f2' : '#1a1a1a';
      g.fillRect(x - hw + c*cw, y - ph + r*bh/2, cw + 0.5, bh/2 + 0.5);
    }
  }

  /* A car seen from behind. w is its full width in pixels. */
  function rCar(g, x, y, w, col, van){
    if(w < 4) return;
    var h = w * (van ? 0.95 : 0.7);
    g.save(); g.translate(x, y);
    g.fillStyle = 'rgba(0,0,0,.28)';
    g.beginPath(); g.ellipse(0, 0, w*0.52, h*0.09, 0, 0, 7); g.fill();
    g.fillStyle = '#16181c';                                   // wheels
    g.fillRect(-w*0.47, -h*0.18, w*0.16, h*0.2); g.fillRect(w*0.31, -h*0.18, w*0.16, h*0.2);
    g.fillStyle = col;                                         // body
    g.beginPath(); g.roundRect(-w*0.5, -h*0.62, w, h*0.46, w*0.05); g.fill();
    g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(-w*0.5, -h*0.36, w, h*0.06);
    if(van){ g.fillStyle = col; g.fillRect(-w*0.46, -h*0.98, w*0.92, h*0.4); }
    else{                                                       // cabin
      g.fillStyle = col;
      g.beginPath(); g.moveTo(-w*0.40, -h*0.62); g.lineTo(-w*0.30, -h*0.96); g.lineTo(w*0.30, -h*0.96); g.lineTo(w*0.40, -h*0.62); g.closePath(); g.fill();
    }
    g.fillStyle = '#1d2733';                                    // rear window
    if(van) g.fillRect(-w*0.34, -h*0.92, w*0.68, h*0.22);
    else{ g.beginPath(); g.moveTo(-w*0.33, -h*0.64); g.lineTo(-w*0.25, -h*0.9); g.lineTo(w*0.25, -h*0.9); g.lineTo(w*0.33, -h*0.64); g.closePath(); g.fill(); }
    g.fillStyle = '#d83a2e';                                    // tail lights
    g.fillRect(-w*0.47, -h*0.52, w*0.16, h*0.1); g.fillRect(w*0.31, -h*0.52, w*0.16, h*0.1);
    g.fillStyle = '#e8e8e0'; g.fillRect(-w*0.12, -h*0.44, w*0.24, h*0.09);   // plate
    g.restore();
  }

  /* The rider on foot, running back to the fallen bike. */
  function rRunner(g, x, y, w, ph, jc, hc){
    var h = w*0.82, bob = Math.abs(Math.sin(ph))*h*0.04, sw = Math.sin(ph)*w*0.08;
    g.save(); g.translate(x, y - bob);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(0, bob, w*0.15, h*0.04, 0, 0, 7); g.fill();
    g.lineCap = 'round';
    g.strokeStyle = '#1a1d24'; g.lineWidth = Math.max(2.5, w*0.065);          // legs
    g.beginPath(); g.moveTo(-w*0.035, -h*0.30); g.lineTo(-w*0.06 + sw, -h*0.02);
    g.moveTo(w*0.035, -h*0.30); g.lineTo(w*0.06 - sw, -h*0.02); g.stroke();
    g.strokeStyle = '#0e1013'; g.lineWidth = Math.max(3, w*0.075);            // boots
    g.beginPath(); g.moveTo(-w*0.06 + sw, -h*0.05); g.lineTo(-w*0.06 + sw, -h*0.0);
    g.moveTo(w*0.06 - sw, -h*0.05); g.lineTo(w*0.06 - sw, -h*0.0); g.stroke();
    g.fillStyle = jc;                                                          // jacket
    g.beginPath(); g.roundRect(-w*0.11, -h*0.62, w*0.22, h*0.36, w*0.05); g.fill();
    g.strokeStyle = jc; g.lineWidth = Math.max(2.5, w*0.06);                   // arms swing
    g.beginPath(); g.moveTo(-w*0.11, -h*0.58); g.lineTo(-w*0.16 - sw*0.7, -h*0.38);
    g.moveTo(w*0.11, -h*0.58); g.lineTo(w*0.16 + sw*0.7, -h*0.38); g.stroke();
    g.fillStyle = hc; g.beginPath(); g.ellipse(0, -h*0.72, w*0.10, h*0.11, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.ellipse(-w*0.03, -h*0.76, w*0.035, h*0.04, 0, 0, 7); g.fill();
    g.restore();
  }

  /** One rider on a motorcycle seen from behind, sport-bike proportions:
      narrow tyre, tail section, twin cans, then a broad rider with elbows
      out to the bars. Drawn bottom-centre at (x, y).
      o: col (bike), jacket, helmet, down, lean, braking, atkSide (-1/1),
         atkP (0..1 progress or -1), weapon ('club'|'chain'|null), flash,
         cop, light, num */
  function rBike(g, x, y, w, o){
    if(w < 5) return;
    var h = w*0.9, col = o.col;
    var jc = o.jacket || (o.cop ? '#1f3a68' : '#262a33');
    var hc = o.helmet || col;
    var lod = w < 30;                                 // far away: skip the small details
    g.save();
    g.translate(x, y);
    if(o.down){ g.rotate(1.4); g.globalAlpha = Math.min(g.globalAlpha, 0.85); }
    else if(o.lean){ g.rotate(o.lean * 0.3); }

    // ground shadow
    g.fillStyle = 'rgba(0,0,0,.28)';
    g.beginPath(); g.ellipse(0, h*0.02, w*0.46, h*0.07, 0, 0, 7); g.fill();

    // rear tyre: tall and narrow from behind, with tread and a sheen
    g.fillStyle = '#14161a';
    g.beginPath(); g.roundRect(-w*0.088, -h*0.31, w*0.176, h*0.31, w*0.06); g.fill();
    if(!lod){
      g.fillStyle = '#23272e';
      for(var t=0;t<6;t++) g.fillRect(-w*0.075, -h*0.285 + t*h*0.045, w*0.15, Math.max(1, h*0.012));
      g.fillStyle = 'rgba(255,255,255,.07)';
      g.fillRect(-w*0.02, -h*0.30, w*0.04, h*0.29);
    }
    // swingarm
    g.fillStyle = '#30343c';
    g.fillRect(-w*0.115, -h*0.30, w*0.03, h*0.17);
    g.fillRect( w*0.085, -h*0.30, w*0.03, h*0.17);
    // twin exhaust cans tucked under the tail
    g.fillStyle = '#3d424b';
    g.beginPath(); g.moveTo(-w*0.145, -h*0.07); g.lineTo(-w*0.105, -h*0.07); g.lineTo(-w*0.125, -h*0.28); g.lineTo(-w*0.175, -h*0.27); g.closePath(); g.fill();
    g.beginPath(); g.moveTo( w*0.145, -h*0.07); g.lineTo( w*0.105, -h*0.07); g.lineTo( w*0.125, -h*0.28); g.lineTo( w*0.175, -h*0.27); g.closePath(); g.fill();
    g.fillStyle = '#c4cad2';
    g.beginPath(); g.ellipse(-w*0.125, -h*0.07, w*0.026, h*0.018, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse( w*0.125, -h*0.07, w*0.026, h*0.018, 0, 0, 7); g.fill();

    // tail section and fender
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(-w*0.075, -h*0.30); g.lineTo(w*0.075, -h*0.30);
    g.lineTo(w*0.16, -h*0.52); g.lineTo(-w*0.16, -h*0.52);
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,.22)';                                     // shade the lower half
    g.beginPath(); g.moveTo(-w*0.075, -h*0.30); g.lineTo(w*0.075, -h*0.30); g.lineTo(w*0.115, -h*0.40); g.lineTo(-w*0.115, -h*0.40); g.closePath(); g.fill();
    if(!lod){ g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(-w*0.012, -h*0.50, w*0.024, h*0.18); }   // centre ridge
    // tail light
    if(o.braking){
      g.fillStyle = 'rgba(255,70,50,.28)'; g.beginPath(); g.ellipse(0, -h*0.37, w*0.20, h*0.09, 0, 0, 7); g.fill();
      g.fillStyle = '#ff4a34';
    }else g.fillStyle = '#a3241c';
    g.beginPath(); g.roundRect(-w*0.075, -h*0.40, w*0.15, h*0.04, w*0.015); g.fill();
    // number plate
    if(!lod){
      g.fillStyle = '#eceae2'; g.fillRect(-w*0.055, -h*0.345, w*0.11, h*0.06);
      if(o.num && w > 38){
        g.fillStyle = '#16181c'; g.font = '800 ' + Math.max(6, Math.round(w*0.052)) + 'px ui-monospace,Menlo,monospace';
        g.textAlign = 'center'; g.fillText(String(o.num), 0, -h*0.296); g.textAlign = 'left';
      }
    }
    // seat
    g.fillStyle = '#14161a';
    g.beginPath(); g.ellipse(0, -h*0.53, w*0.17, h*0.04, 0, 0, 7); g.fill();

    // legs: trousers flaring out from the hips to the boots either side of the tail
    g.fillStyle = '#1b1e25';
    g.beginPath(); g.moveTo(-w*0.09, -h*0.54); g.lineTo(-w*0.20, -h*0.52); g.lineTo(-w*0.215, -h*0.37); g.lineTo(-w*0.165, -h*0.33); g.lineTo(-w*0.12, -h*0.42); g.closePath(); g.fill();
    g.beginPath(); g.moveTo( w*0.09, -h*0.54); g.lineTo( w*0.20, -h*0.52); g.lineTo( w*0.215, -h*0.37); g.lineTo( w*0.165, -h*0.33); g.lineTo( w*0.12, -h*0.42); g.closePath(); g.fill();
    g.fillStyle = '#0f1115';
    g.beginPath(); g.ellipse(-w*0.19, -h*0.345, w*0.032, h*0.028, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse( w*0.19, -h*0.345, w*0.032, h*0.028, 0, 0, 7); g.fill();

    // torso: hips narrow, shoulders broad, hunched forward over the tank
    g.fillStyle = jc;
    g.beginPath();
    g.moveTo(-w*0.125, -h*0.50); g.lineTo(w*0.125, -h*0.50);
    g.quadraticCurveTo(w*0.20, -h*0.60, w*0.215, -h*0.74);
    g.quadraticCurveTo(w*0.19, -h*0.84, 0, -h*0.84);
    g.quadraticCurveTo(-w*0.19, -h*0.84, -w*0.215, -h*0.74);
    g.quadraticCurveTo(-w*0.20, -h*0.60, -w*0.125, -h*0.50);
    g.closePath(); g.fill();
    // colour panels across the shoulders and a spine stripe
    g.fillStyle = col;
    g.beginPath(); g.moveTo(-w*0.215, -h*0.74); g.quadraticCurveTo(-w*0.19, -h*0.84, -w*0.05, -h*0.84); g.lineTo(-w*0.07, -h*0.70); g.quadraticCurveTo(-w*0.15, -h*0.66, -w*0.215, -h*0.74); g.closePath(); g.fill();
    g.beginPath(); g.moveTo( w*0.215, -h*0.74); g.quadraticCurveTo( w*0.19, -h*0.84,  w*0.05, -h*0.84); g.lineTo( w*0.07, -h*0.70); g.quadraticCurveTo( w*0.15, -h*0.66,  w*0.215, -h*0.74); g.closePath(); g.fill();
    if(!lod){
      g.fillStyle = 'rgba(255,255,255,.13)'; g.fillRect(-w*0.011, -h*0.70, w*0.022, h*0.20);
      if(o.num && w > 60){
        g.fillStyle = 'rgba(240,240,232,.92)'; g.beginPath(); g.arc(0, -h*0.60, w*0.048, 0, 7); g.fill();
        g.fillStyle = '#16181c'; g.font = '800 ' + Math.round(w*0.058) + 'px ui-monospace,Menlo,monospace';
        g.textAlign = 'center'; g.fillText(String(o.num), 0, -h*0.58); g.textAlign = 'left';
      }
    }
    // elbows out to the bars; grips and mirror stalks
    var swinging = !o.down && o.atkP >= 0, sd = o.atkSide || 1;
    var ext = swinging ? Math.sin(o.atkP*Math.PI) : 0;
    var armL = swinging && sd < 0, armR = swinging && sd > 0;
    g.lineCap = 'round'; g.strokeStyle = jc; g.lineWidth = Math.max(2.5, w*0.062);
    g.beginPath();
    if(armL){ g.moveTo(-w*0.19, -h*0.72); g.lineTo(-w*(0.25 + 0.30*ext), -h*0.66); }
    else{ g.moveTo(-w*0.19, -h*0.72); g.lineTo(-w*0.275, -h*0.62); }
    if(armR){ g.moveTo(w*0.19, -h*0.72); g.lineTo(w*(0.25 + 0.30*ext), -h*0.66); }
    else{ g.moveTo(w*0.19, -h*0.72); g.lineTo(w*0.275, -h*0.62); }
    g.stroke();
    g.fillStyle = '#15171b';
    if(!armL){ g.beginPath(); g.ellipse(-w*0.29, -h*0.605, w*0.028, h*0.03, 0, 0, 7); g.fill(); }
    if(!armR){ g.beginPath(); g.ellipse( w*0.29, -h*0.605, w*0.028, h*0.03, 0, 0, 7); g.fill(); }
    if(!lod){
      g.fillStyle = '#2a2f38';
      if(!armL){ g.beginPath(); g.ellipse(-w*0.335, -h*0.655, w*0.028, h*0.02, -0.5, 0, 7); g.fill(); }
      if(!armR){ g.beginPath(); g.ellipse( w*0.335, -h*0.655, w*0.028, h*0.02,  0.5, 0, 7); g.fill(); }
    }

    // helmet from behind: oval shell tucked into the shoulders, stripe, rear vent
    g.fillStyle = o.flash ? '#ffffff' : hc;
    g.beginPath(); g.ellipse(0, -h*0.865, w*0.108, h*0.1, 0, 0, 7); g.fill();
    if(!lod){
      g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(0, -h*0.80, w*0.07, h*0.022, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(-w*0.016, -h*0.96, w*0.032, h*0.15);
      g.fillStyle = col; g.fillRect(-w*0.016, -h*0.96, w*0.032, h*0.04);
      g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.ellipse(-w*0.045, -h*0.905, w*0.03, h*0.04, -0.5, 0, 7); g.fill();
    }
    if(o.cop){
      var on = ((o.light*5)|0) % 2;                                  // light bar on a rear mount
      g.fillStyle = on ? '#e03a3a' : '#3a7be0'; g.beginPath(); g.roundRect(-w*0.17, -h*0.50, w*0.075, h*0.05, w*0.012); g.fill();
      g.fillStyle = on ? '#3a7be0' : '#e03a3a'; g.beginPath(); g.roundRect( w*0.095, -h*0.50, w*0.075, h*0.05, w*0.012); g.fill();
      g.fillStyle = on ? 'rgba(224,58,58,.16)' : 'rgba(58,123,224,.16)';
      g.beginPath(); g.arc(0, -h*0.52, w*0.26, 0, 7); g.fill();
      g.fillStyle = '#f1f3f6'; g.fillRect(-w*0.11, -h*0.435, w*0.22, h*0.018);   // reflective band
    }

    // weapon: carried when idle, swung to the side on an attack
    if(o.weapon && !o.down){
      var hx = swinging ? sd*w*(0.25 + 0.30*ext) : w*0.29, hy = swinging ? -h*0.66 : -h*0.605;
      g.lineCap = 'round';
      if(o.weapon === 'club'){
        g.strokeStyle = '#8a5a2b'; g.lineWidth = Math.max(3, w*0.06);
        g.beginPath(); g.moveTo(hx, hy);
        if(swinging){ var k = o.atkP; g.lineTo(sd*w*(0.34 + 0.40*Math.sin(k*3.1)), -h*(0.66 + 0.36*Math.cos(k*3.1))); }
        else g.lineTo(hx + w*0.03, -h*1.02);
        g.stroke();
        g.strokeStyle = '#5e3b1b'; g.lineWidth = Math.max(1.5, w*0.025);          // grip tape
        g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + (swinging ? 0 : w*0.005), hy - h*0.05); g.stroke();
      }else{
        g.strokeStyle = '#c3c8d0'; g.lineWidth = Math.max(1.8, w*0.04);
        g.setLineDash([Math.max(2, w*0.04), Math.max(1.5, w*0.025)]);
        g.beginPath(); g.moveTo(hx, hy);
        if(swinging){ var k2 = o.atkP; g.quadraticCurveTo(sd*w*0.75, -h*(0.95 - 0.35*k2), sd*w*(0.30 + 0.55*k2), -h*0.52); }
        else g.quadraticCurveTo(w*0.40, -h*0.50, w*0.34, -h*0.32);
        g.stroke(); g.setLineDash([]);
      }
    }
    if(swinging && !o.weapon){
      g.fillStyle = '#15171b'; g.beginPath(); g.arc(sd*w*(0.27 + 0.31*ext), -h*0.66, w*0.05, 0, 7); g.fill();   // fist
    }
    if(o.flash){                                   // impact star
      g.fillStyle = 'rgba(255,230,120,.92)';
      var sx2 = (o.atkSide || 1) * w*0.52;
      g.beginPath();
      for(var i=0;i<8;i++){
        var rr = (i % 2 ? w*0.07 : w*0.17), an = i/8*Math.PI*2;
        g.lineTo(sx2 + Math.cos(an)*rr, -h*0.7 + Math.sin(an)*rr);
      }
      g.closePath(); g.fill();
    }
    g.restore();
  }

  /* ══════════════════════════════════════════════════════════════════
     BELTER — asteroids with real inertia
     ══════════════════════════════════════════════════════════════════ */
  var bs = null, bRAF = null, bKeys = {};

  AG3.belterInit = function(){
    var cv = el('belterCanvas');
    bs = {
      W: cv ? cv.width : 460, H: cv ? cv.height : 460,
      ship:{ x:(cv?cv.width:460)/2, y:(cv?cv.height:460)/2, vx:0, vy:0, a:-Math.PI/2, inv:2 },
      rocks:[], shots:[], bits:[],
      score:0, lives:3, wave:1, over:false, last:0, fireCd:0, nextLife:B_EXTRA_LIFE
    };
    bSpawnWave();
    var st = el('belterStatus');
    if(st) st.textContent = 'Arrows to fly \u00b7 Space to fire';
    if(bRAF) cancelAnimationFrame(bRAF);
    bs.last = 0;
    bRAF = requestAnimationFrame(bLoop);
  };
  AG3.belterStop = function(){ if(bRAF) cancelAnimationFrame(bRAF); bRAF = null; };
  AG3.belterRestart = function(){ AG3.belterInit(); };
  AG3.belterKey = function(k,down){ bKeys[k] = !!down; };

  // An extra ship every B_EXTRA_LIFE points, so a long run is not capped at three lives.
  var B_EXTRA_LIFE = 5000;
  function bScore(n){
    bs.score += n;
    while(bs.score >= bs.nextLife){
      bs.nextLife += B_EXTRA_LIFE; bs.lives++;
      var st = el('belterStatus'); if(st) st.textContent = 'Extra ship! ' + bs.lives + ' now';
    }
  }
  // After a crash the ship waits off-screen until the middle of the field is clear, so it
  // never comes back on top of a rock it cannot escape.
  function bCentreClear(){
    for(var i=0;i<bs.rocks.length;i++){
      var r = bs.rocks[i];
      if(Math.hypot(r.x-bs.W/2, r.y-bs.H/2) < r.r + 70) return false;
    }
    return true;
  }
  function bSpawnWave(){
    var n = Math.min(9, 3 + bs.wave);
    for(var i=0;i<n;i++){
      // Never spawn on top of the ship.
      var x,y,tries=0;
      do{
        x = Math.random()*bs.W; y = Math.random()*bs.H; tries++;
      }while(tries<40 && Math.hypot(x-bs.ship.x, y-bs.ship.y) < 130);
      var a = Math.random()*Math.PI*2;
      var sp = 22 + Math.random()*26 + bs.wave*3;
      bs.rocks.push({ x:x, y:y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, r:34,
                      spin:(Math.random()-0.5)*1.6, rot:0, tier:3,
                      shape: bRockShape() });
    }
  }
  function bRockShape(){
    var pts=[], n=9;
    for(var i=0;i<n;i++) pts.push(0.72 + Math.random()*0.42);
    return pts;
  }
  function bWrap(o,pad){
    pad = pad || 0;
    if(o.x < -pad) o.x += bs.W + pad*2;
    if(o.x > bs.W+pad) o.x -= bs.W + pad*2;
    if(o.y < -pad) o.y += bs.H + pad*2;
    if(o.y > bs.H+pad) o.y -= bs.H + pad*2;
  }
  AG3.belterFire = function(){
    if(!bs || bs.over || bs.fireCd > 0) return;
    bs.fireCd = 0.17;
    var s = bs.ship;
    bs.shots.push({ x:s.x + Math.cos(s.a)*14, y:s.y + Math.sin(s.a)*14,
                    vx:Math.cos(s.a)*430 + s.vx, vy:Math.sin(s.a)*430 + s.vy, life:0.85 });
  };

  function bLoop(t){
    bRAF = requestAnimationFrame(bLoop);
    if(!bs || bs.over) return;
    if(!bs.last) bs.last = t;
    var dt = Math.min(0.05,(t - bs.last)/1000);
    bs.last = t;
    if(!dt) return;
    var s = bs.ship, i, j;

    if(s.dead > 0){
      s.dead -= dt;
      if(s.dead <= 0){
        if(bCentreClear()){ s.dead = 0; s.inv = 2; }
        else s.dead = 0.12;                                   // keep waiting for a gap
      }
    }else{
      if(bKeys.left)  s.a -= 3.4*dt;
      if(bKeys.right) s.a += 3.4*dt;
      if(bKeys.up){ s.vx += Math.cos(s.a)*260*dt; s.vy += Math.sin(s.a)*260*dt; }
    }
    // Light drag so it is controllable without killing the drift.
    s.vx *= (1 - 0.42*dt); s.vy *= (1 - 0.42*dt);
    s.x += s.vx*dt; s.y += s.vy*dt;
    bWrap(s,12);
    if(s.inv > 0) s.inv -= dt;
    if(bs.fireCd > 0) bs.fireCd -= dt;
    if(bKeys.fire && !(s.dead > 0)) AG3.belterFire();

    for(i=bs.shots.length-1;i>=0;i--){
      var sh = bs.shots[i];
      sh.x += sh.vx*dt; sh.y += sh.vy*dt; sh.life -= dt;
      bWrap(sh,4);
      if(sh.life <= 0) bs.shots.splice(i,1);
    }
    for(i=0;i<bs.rocks.length;i++){
      var r = bs.rocks[i];
      r.x += r.vx*dt; r.y += r.vy*dt; r.rot += r.spin*dt;
      bWrap(r, r.r);
    }
    for(i=bs.bits.length-1;i>=0;i--){
      var b = bs.bits[i];
      b.x += b.vx*dt; b.y += b.vy*dt; b.life -= dt;
      if(b.life <= 0) bs.bits.splice(i,1);
    }

    // shot vs rock
    for(i=bs.rocks.length-1;i>=0;i--){
      var rk = bs.rocks[i];
      for(j=bs.shots.length-1;j>=0;j--){
        var st2 = bs.shots[j];
        if(Math.hypot(rk.x-st2.x, rk.y-st2.y) < rk.r){
          bs.shots.splice(j,1);
          bBreak(i);
          break;
        }
      }
    }
    // rock vs ship
    if(s.inv <= 0 && !(s.dead > 0)){
      for(i=0;i<bs.rocks.length;i++){
        var rr = bs.rocks[i];
        if(Math.hypot(rr.x-s.x, rr.y-s.y) < rr.r + 9){
          bs.lives--;
          bBits(s.x,s.y,18,'#e05a3f');
          s.x = bs.W/2; s.y = bs.H/2; s.vx = 0; s.vy = 0; s.inv = 0; s.dead = 1;
          var stt = el('belterStatus');
          if(bs.lives <= 0){
            bs.over = true;
            var rec = setBest('belter', bs.score);
            if(stt) stt.textContent = rec ? 'New best: '+bs.score+'!' : 'Game over \u00b7 '+bs.score;
            AG3.refreshLabels();
          }else if(stt){
            stt.textContent = bs.lives + ' ship'+(bs.lives===1?'':'s')+' left';
          }
          break;
        }
      }
    }

    if(!bs.rocks.length){
      bs.wave++;
      bScore(250);
      bSpawnWave();
      var st3 = el('belterStatus');
      if(st3) st3.textContent = 'Wave ' + bs.wave;
    }

    var sc = el('belterScore');
    if(sc) sc.innerHTML = 'SCORE <b>'+bs.score+'</b> \u00b7 SHIPS <b>'+Math.max(0,bs.lives)+'</b>';
    bDraw();
  }

  function bBreak(idx){
    var r = bs.rocks[idx];
    bs.rocks.splice(idx,1);
    bScore(r.tier === 3 ? 20 : r.tier === 2 ? 50 : 100);
    bBits(r.x, r.y, 10, '#8a94a6');
    if(r.tier <= 1) return;
    for(var k=0;k<2;k++){
      var a = Math.random()*Math.PI*2;
      var sp = 34 + Math.random()*40;
      bs.rocks.push({ x:r.x, y:r.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
                      r:r.r*0.55, spin:(Math.random()-0.5)*2.4, rot:0,
                      tier:r.tier-1, shape:bRockShape() });
    }
  }
  function bBits(x,y,n,col){
    for(var i=0;i<n;i++){
      var a = Math.random()*Math.PI*2, sp = 40+Math.random()*130;
      bs.bits.push({ x:x, y:y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
                     life:0.4+Math.random()*0.4, col:col });
    }
  }
  function bDraw(){
    var g = ctx2d('belterCanvas');
    if(!g || !bs) return;
    var css = getComputedStyle(document.documentElement);
    g.fillStyle = (css.getPropertyValue('--bg')||'').trim() || '#eef1f5';
    g.fillRect(0,0,bs.W,bs.H);

    g.strokeStyle = '#8a94a6'; g.lineWidth = 1.8;
    bs.rocks.forEach(function(r){
      g.save(); g.translate(r.x,r.y); g.rotate(r.rot);
      g.beginPath();
      for(var i=0;i<r.shape.length;i++){
        var a = i/r.shape.length*Math.PI*2;
        var rad = r.r*r.shape[i];
        if(i) g.lineTo(Math.cos(a)*rad, Math.sin(a)*rad);
        else  g.moveTo(Math.cos(a)*rad, Math.sin(a)*rad);
      }
      g.closePath(); g.stroke(); g.restore();
    });

    g.fillStyle = '#2d9d94';
    bs.shots.forEach(function(s){
      g.beginPath(); g.arc(s.x,s.y,2.6,0,7); g.fill();
    });
    bs.bits.forEach(function(b){
      g.fillStyle = b.col; g.globalAlpha = Math.max(0,b.life*2);
      g.fillRect(b.x-1.4,b.y-1.4,2.8,2.8);
    });
    g.globalAlpha = 1;

    var s = bs.ship;
    if(!(s.dead > 0) && !(s.inv > 0 && Math.floor(s.inv*10)%2)){
      g.save(); g.translate(s.x,s.y); g.rotate(s.a);
      g.strokeStyle = '#1d2530'; g.lineWidth = 2.2; g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(15,0); g.lineTo(-10,-9); g.lineTo(-5,0); g.lineTo(-10,9);
      g.closePath(); g.stroke();
      if(bKeys.up){
        g.strokeStyle = '#e05a3f';
        g.beginPath(); g.moveTo(-6,-4); g.lineTo(-15-Math.random()*7,0); g.lineTo(-6,4);
        g.stroke();
      }
      g.restore();
    }
    if(bs.over){
      g.fillStyle = 'rgba(20,24,32,.72)'; g.fillRect(0,0,bs.W,bs.H);
      g.fillStyle = '#fff'; g.textAlign = 'center';
      g.font = '800 28px ui-monospace,Menlo,monospace';
      g.fillText('GAME OVER', bs.W/2, bs.H/2 - 4);
      g.font = '700 15px ui-monospace,Menlo,monospace';
      g.fillText(bs.score + ' points', bs.W/2, bs.H/2 + 24);
      g.textAlign = 'left';
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     WORDGRID — trace words through adjacent letters, 90 seconds

     The dictionary is embedded and small on purpose: a real word list is
     megabytes, and this file has to stay a drop-in script. ~600 common
     words is enough for a 90-second break game, and the grid is generated
     from letter frequencies so vowels actually appear.
     ══════════════════════════════════════════════════════════════════ */
  var WORDS = ('able about above acid across act add afraid after again age agree ahead aid aim air all allow almost alone along already also always among and anger angry animal ankle answer any apart apple area arm army around arrive art ash ask asleep attack aunt away baby back bad bag bake ball band bank bar bare bark barn base basket bath be bean bear beat beauty bed bee been beer before begin behind believe bell belong below belt bench bend berry beside best better between big bill bird birth bit bite bitter black blade blame blank blanket bleed bless blind block blood blow blue board boat body boil bomb bone book boot border born borrow both bottle bottom bowl box boy brain branch brave bread break breast breath brick bride bridge brief bright bring broad broken brother brown brush bucket build bull bunch burn burst bury bus bush business busy but butter button buy cake call calm camp can cap car card care carry case cash cat catch cause cave cell cent chain chair chalk chance change cheap cheat check cheek cheese chest chicken chief child chin choose church circle city claim class clay clean clear clerk clever climb clock close cloth cloud coal coast coat coffee coin cold collar collect colour comb come common company compare cook cool copper copy corn corner correct cost cotton cough count country course court cover cow crack crash cream crime crop cross crowd crown cruel crush cry cup cure curl curse curtain curve custom cut daily damage damp dance danger dark date daughter day dead deaf deal dear death debt decide deep deer defeat degree delay demand depend desert desk destroy detail develop die diet differ dig dinner direct dirt dirty discover dish divide do doctor dog doll door double doubt down dozen drag draw dream dress drink drive drop drown drug drum dry duck dust duty each ear early earn earth east easy eat edge egg eight either elbow elect empty end enemy engine enjoy enough enter equal escape even evening event ever every exact examine example except excite excuse exist expect explain eye face fact fail fair fall false family famous fan far farm fast fat fate father fault fear feast feather feed feel fellow female fence fever few field fight fill film find fine finger finish fire firm first fish fit five fix flag flame flat float floor flour flow flower fly fold follow food fool foot for force forest forget fork form former forward four free fresh friend from front fruit full fun funny fur future gain game garden gas gate gather general gentle get gift girl give glad glass glory glove go goat god gold good grade grain grand grass grave gray great green grey grind ground group grow guard guess guest guide gun hair half hall hammer hand hang happen happy hard harm hat hate have head health hear heart heat heavy help hen her here hide high hill him hire his hit hold hole holy home honest honey hook hope horn horse hospital hot hotel hour house how huge human hunt hurry hurt ice idea if ill in inch include income increase indeed industry insect inside instead into iron island issue it jaw job join joke joy judge juice jump just keep key kick kill kind king kiss kitchen knee knife knock know labour lack ladder lady lake lamp land language large last late laugh law lay lazy lead leaf learn least leather leave left leg lend length less let letter level library lie life lift light like limit line lion lip list listen little live load loaf local lock lonely long look loose lord lose loss lot loud love low luck lunch machine mad mail main make male man many map march mark market marry mass master match may meal mean measure meat medicine meet melt member memory mend mention metal method middle might mile milk mind mine minute mirror miss mistake mix model modern moment money monkey month moon more morning most mother mountain mouse mouth move much mud music must nail name narrow nation native nature near neat neck need needle neighbour neither nerve nest net never new news next nice night nine no noble noise none noon nor north nose not note nothing notice now number nurse nut obey object ocean odd of off offer office often oil old on once one only open opinion or orange order other our out outside oven over owe own pack page pain paint pair palace pale pan paper parcel pardon parent park part party pass past path pay peace pen pencil people pepper per perfect perhaps period person pick picture piece pig pile pin pink pipe pity place plain plan plant plate play please plenty pocket point poison police polish poor popular port position possible post pot potato pound pour power praise pray prefer prepare present press pretty prevent price pride print prison private prize problem produce promise proper protect proud prove public pull pump punish pupil pure purple purpose push put quality quarter queen question quick quiet quite race radio rail rain raise rank rapid rare rate rather reach read ready real reason receive record red reduce refuse regard remain remember remove rent repair repeat reply report rest result return rice rich ride right ring rise risk river road rock roll roof room root rope rough round row rub rule run rush sad safe sail salt same sand save say scale school science scissors search seat second secret see seed seem sell send sense separate serious serve set settle seven several sew shade shake shall shame shape share sharp she sheep sheet shelf shell shine ship shirt shock shoe shoot shop short should shoulder shout show shut sick side sight sign silence silk silver similar simple since sing single sink sir sister sit six size skin skirt sky sleep slide slip slow small smell smile smoke smooth snake snow so soap social sock soft soil soldier solid some son song soon sore sorry sort soul sound soup south space speak special speed spell spend spirit spoon sport spot spread spring square stage stamp stand star start state station stay steal steam steel step stick still stomach stone stop store storm story straight strange street strength stretch strike string strong student study stupid subject success such sudden suffer sugar suit summer sun supply support suppose sure surface surprise sweet swim sword table tail take talk tall taste tax tea teach team tear tell ten tent term test than thank that the their them then there these they thick thin thing think third this those though thread three throat through throw thumb thus ticket tie tight time tin tiny tire title to today toe together tomorrow tongue tonight too tool tooth top total touch towards towel tower town toy trade train travel tree trip trouble trousers truck true trust try tube turn twice twin two type ugly umbrella uncle under understand unit until up upon upper upset urge use usual valley value various very view village visit voice wait wake walk wall want war warm wash waste watch water wave way weak wear weather week weight welcome well west wet what wheel when where which while white who whole why wide wife wild will win wind window wine wing winter wire wise wish with woman wonder wood wool word work world worry worse worth would wound write wrong yard year yellow yes yesterday yet you young').split(' ');
  var WSET = {};
  WORDS.forEach(function(w){ if(w.length >= 3) WSET[w] = 1; });

  var wg = null, wgTimer = null;
  // Weighted so vowels turn up often enough for words to exist.
  var WPOOL = 'AAAAAAEEEEEEEEIIIIIOOOOOUUNNNNRRRRTTTTLLLSSSSDDGGBBCCMMPPFFHHVVWWYYKJXQZ';

  AG3.wordInit = function(){
    wg = { grid:[], sel:[], found:{}, score:0, t:90, over:false };
    // Regenerate until the board has a decent number of findable words.
    var tries = 0;
    do{
      wg.grid = [];
      for(var i=0;i<16;i++) wg.grid.push(WPOOL[Math.floor(Math.random()*WPOOL.length)]);
      tries++;
    }while(tries < 60 && wgSolveCount() < 6);
    wgRender();
    el('wordStatus').textContent = '90s \u00b7 drag or tap letters';
    if(wgTimer) clearInterval(wgTimer);
    wgTimer = setInterval(function(){
      if(!wg || wg.over) return;
      wg.t--;
      if(wg.t <= 0){
        wg.t = 0; wg.over = true;
        clearInterval(wgTimer); wgTimer = null;
        var rec = setBest('word', wg.score);
        el('wordStatus').textContent = rec ? 'New best: '+wg.score+'!' : "Time \u00b7 "+wg.score;
        AG3.refreshLabels();
      }else{
        el('wordStatus').textContent = wg.t + 's \u00b7 ' + wg.score + ' pts';
      }
      wgRender();
    }, 1000);
  };
  AG3.wordStop = function(){ if(wgTimer) clearInterval(wgTimer); wgTimer = null; };
  AG3.wordRestart = function(){ AG3.wordInit(); };

  function wgAdj(a,b){
    var ax=a%4, ay=Math.floor(a/4), bx=b%4, by=Math.floor(b/4);
    return Math.abs(ax-bx) <= 1 && Math.abs(ay-by) <= 1 && a !== b;
  }
  /** Can this word be traced through touching cells? Depth-first over the
      same adjacency rule the player is bound by. */
  function wgTraceable(word){
    var W2 = word.toUpperCase();
    function dfs(from, idx, used){
      if(idx === W2.length) return true;
      for(var n=0;n<16;n++){
        if(used[n] || wg.grid[n] !== W2[idx]) continue;
        if(from >= 0 && !wgAdj(from,n)) continue;
        used[n] = 1;
        if(dfs(n, idx+1, used)) return true;
        used[n] = 0;
      }
      return false;
    }
    return dfs(-1, 0, {});
  }
  /** How many words are ACTUALLY findable — used to reject a dud board.

      This must trace real paths, not just check that the letters exist
      somewhere on the grid. Counting available letters passes boards whose
      letters are scattered to opposite corners and cannot be joined, which
      produced roughly one unwinnable board in every three hundred. */
  function wgSolveCount(){
    var n = 0;
    for(var i=0;i<WORDS.length && n<10;i++){
      var w = WORDS[i];
      if(w.length < 3 || w.length > 6) continue;
      if(wgTraceable(w)) n++;
    }
    return n;
  }
  AG3.wordTap = function(idx){
    if(!wg || wg.over) return;
    var last = wg.sel[wg.sel.length-1];
    if(wg.sel.indexOf(idx) > -1){
      // tapping the last letter again submits
      if(idx === last) AG3.wordSubmit();
      return;
    }
    if(wg.sel.length && !wgAdj(last, idx)) return;
    wg.sel.push(idx);
    wgRender();
  };
  AG3.wordClear = function(){ if(wg){ wg.sel = []; wgRender(); } };
  AG3.wordSubmit = function(){
    if(!wg || wg.over || wg.sel.length < 3){ AG3.wordClear(); return; }
    var w = wg.sel.map(function(i){ return wg.grid[i]; }).join('').toLowerCase();
    var host = el('wordGrid');
    if(WSET[w] && !wg.found[w]){
      wg.found[w] = 1;
      var pts = [0,0,0,10,25,50,90,150][Math.min(7,w.length)] || 200;
      wg.score += pts;
      wg.t += 3;                              // a correct word buys time
      flash('good');
    }else{
      flash('bad');
      wg.score = Math.max(0, wg.score - 5);
    }
    wg.sel = [];
    setTimeout(wgRender, 190);
    function flash(cls){
      if(!host) return;
      Array.prototype.forEach.call(host.children, function(c){
        if(c.classList.contains('on')) c.classList.add(cls);
      });
    }
  };
  function wgRender(){
    var host = el('wordGrid');
    if(!host || !wg) return;
    host.innerHTML = wg.grid.map(function(ch,i){
      return '<div class="ag3-wc'+(wg.sel.indexOf(i)>-1?' on':'')+'" data-i="'+i+'">'+ch+'</div>';
    }).join('');
    var cur = el('wordCur');
    if(cur) cur.textContent = wg.sel.map(function(i){ return wg.grid[i]; }).join('');
    var fo = el('wordFound');
    if(fo){
      var ks = Object.keys(wg.found);
      fo.innerHTML = ks.length
        ? ks.map(function(w){ return '<span class="ag3-tag">'+w+'</span>'; }).join('')
        : '<span class="ag3-tag" style="opacity:.55">no words yet</span>';
    }
    var sc = el('wordScore');
    if(sc) sc.innerHTML = 'SCORE <b>'+wg.score+'</b> \u00b7 '+wg.t+'s';
  }

  /* ══════════════════════════════════════════════════════════════════
     REGISTRY + HOST WIRING
     ══════════════════════════════════════════════════════════════════ */
  var GAMES = {
    rash  : { init:function(){ AG3.rashInit(); },   stop:function(){ AG3.rashStop(); } },
    belter: { init:function(){ AG3.belterInit(); }, stop:function(){ AG3.belterStop(); } },
    word  : { init:function(){ AG3.wordInit(); },   stop:function(){ AG3.wordStop(); } }
  };

  AG3.refreshLabels = function(){
    var r = el('best-rash');   if(r) r.textContent = 'CAREER: $' + best('rash');
    var b = el('best-belter'); if(b) b.textContent = 'BEST: ' + best('belter');
    var w = el('best-word');   if(w) w.textContent = 'BEST: ' + best('word');
  };

  /* Register with arcade-games2's wrapper if it exists; otherwise install an
     equivalent one. Guarded so the two never both wrap openGame — a double
     wrap would call every init twice, and two requestAnimationFrame loops on
     one game run it at double speed. */
  function installHooks(){
    if(window.__ag3Hooked) return;
    window.__ag3Hooked = true;

    var origOpen = window.openGame;
    window.openGame = function(g){
      if(typeof origOpen === 'function') origOpen.apply(this, arguments);
      if(GAMES[g]){
        try{ GAMES[g].init(); }catch(e){ console.error('[AG3] init '+g, e); }
      }
    };
    var origClose = window.closeGame;
    window.closeGame = function(){
      if(typeof origClose === 'function') origClose.apply(this, arguments);
      Object.keys(GAMES).forEach(function(k){
        try{ GAMES[k].stop(); }catch(e){}
      });
    };
    var origRefresh = window.refreshBests;
    window.refreshBests = function(){
      if(typeof origRefresh === 'function') origRefresh.apply(this, arguments);
      AG3.refreshLabels();
    };
  }

  function mount(){
    if(el('arcade-games3-css')) return;
    var st = document.createElement('style');
    st.id = 'arcade-games3-css';
    st.textContent = CSS;
    document.head.appendChild(st);

    var wrap = document.querySelector('.wrap');
    if(!wrap) return;

    var html =
      screen('rash','RASH','rashStatus',
        '<div class="ag-stage">'+
          '<div class="ag3-rmenu" id="rashMenu"></div>'+
          '<div class="ag3-rplay" id="rashPlay" style="display:none">'+
            '<div class="ag3-hud">'+
              '<div><span>km/h</span><b id="rashSpeed">0</b></div>'+
              '<div><span>Position</span><b id="rashPos">9/9</b></div>'+
              '<div><span>Stamina</span><div class="ag3-bar hp"><i id="rashHp" style="width:100%"></i></div></div>'+
              '<div><span>Weapon</span><b id="rashWeapon">\u2014</b></div>'+
              '<div><span>Time</span><b id="rashTime">0:00.0</b></div>'+
              '<div><span>Police</span><b id="rashCop">clear</b></div>'+
            '</div>'+
            '<canvas class="ag-canvas" id="rashCanvas" width="480" height="320"></canvas>'+
            '<div class="ag-row ag3-pads">'+
              '<button class="ag3-pad" data-rk="left">\u25C0</button>'+
              '<button class="ag3-pad" data-rk="up">\u25B2</button>'+
              '<button class="ag3-pad" data-rk="down">\u25BC</button>'+
              '<button class="ag3-pad" data-rk="right">\u25B6</button>'+
              '<button class="ag3-pad" data-rk="atkl">\u25C0\u{1F44A}</button>'+
              '<button class="ag3-pad" data-rk="atkr">\u{1F44A}\u25B6</button>'+
            '</div>'+
            '<div class="ag-row">'+
              '<button class="ag-btn" id="rashPauseBtn" onclick="AG3.rashPause()">Pause</button>'+
              '<button class="ag-btn" onclick="AG3.rashQuit()">Quit race</button>'+
            '</div>'+
            '<p class="ag-hint">Z swings left, X swings right, Space swings at whoever is closest, P pauses. Stay out of the cars and the trees.</p>'+
          '</div>'+
        '</div>') +
      screen('belter','BELTER','belterStatus',
        '<div class="ag-stage">'+
          '<div class="ag-score" id="belterScore">SCORE <b>0</b> \u00b7 SHIPS <b>3</b></div>'+
          '<canvas class="ag-canvas" id="belterCanvas" width="460" height="460"></canvas>'+
          '<div class="ag-row ag3-pads">'+
            '<button class="ag3-pad" data-bk="left">\u21BA</button>'+
            '<button class="ag3-pad" data-bk="up">\u25B2</button>'+
            '<button class="ag3-pad" data-bk="right">\u21BB</button>'+
            '<button class="ag3-pad" data-bk="fire">\u25C9</button>'+
          '</div>'+
          '<div class="ag-row">'+
            '<button class="ag-btn primary" onclick="AG3.belterRestart()">Restart</button>'+
          '</div>'+
          '<p class="ag-hint">Arrows to turn and thrust, space to fire. You keep your momentum \u2014 thrusting does not stop you, it only changes where you are going. Big rocks split into smaller, faster ones.</p>'+
        '</div>') +
      screen('word','WORDGRID','wordStatus',
        '<div class="ag-stage">'+
          '<div class="ag-score" id="wordScore">SCORE <b>0</b> \u00b7 90s</div>'+
          '<div class="ag3-cur" id="wordCur"></div>'+
          '<div class="ag3-wg" id="wordGrid"></div>'+
          '<div class="ag-row">'+
            '<button class="ag-btn" onclick="AG3.wordClear()">Clear</button>'+
            '<button class="ag-btn primary" onclick="AG3.wordSubmit()">Submit</button>'+
            '<button class="ag-btn" onclick="AG3.wordRestart()">New grid</button>'+
          '</div>'+
          '<div class="ag3-found" id="wordFound"></div>'+
          '<p class="ag-hint">Tap letters that touch each other to build a word, then Submit. Three letters minimum. Every word found adds three seconds to the clock.</p>'+
        '</div>');

    wrap.insertAdjacentHTML('beforeend', html);

    var menu = document.querySelector('.menu');
    if(menu){
      menu.insertAdjacentHTML('beforeend',
        '<div class="game-card" style="--accent:#e05a3f;" onclick="openGame(\'rash\')">'+
          '<span class="ico">\u{1F3CD}\uFE0F</span><h3>RASH</h3>'+
          '<p>Race a pack of riders down five roads, fight from the saddle, dodge traffic and the police, and spend the prize money in the garage.</p>'+
          '<div class="best" id="best-rash" style="color:#e05a3f;">BEST: 0</div>'+
        '</div>'+
        '<div class="game-card" style="--accent:#5a7ec9;" onclick="openGame(\'belter\')">'+
          '<span class="ico">\u{1F680}</span><h3>BELTER</h3>'+
          '<p>Drifting, splitting rocks and no brakes. The only game here where momentum is the whole problem.</p>'+
          '<div class="best" id="best-belter" style="color:#5a7ec9;">BEST: 0</div>'+
        '</div>'+
        '<div class="game-card" style="--accent:#2d9d94;" onclick="openGame(\'word\')">'+
          '<span class="ico">\u{1F524}</span><h3>WORDGRID</h3>'+
          '<p>Ninety seconds, sixteen letters. Every word you find buys three more seconds \u2014 a good run keeps itself alive.</p>'+
          '<div class="best" id="best-word" style="color:#2d9d94;">BEST: 0</div>'+
        '</div>');
    }

    bindInput();
    installHooks();
    AG3.refreshLabels();
  }

  function activeGame(){
    var e = document.querySelector('.screen.active');
    if(!e) return null;
    var m = /^screen-(.+)$/.exec(e.id);
    return m ? m[1] : null;
  }

  function bindInput(){
    document.addEventListener('keydown', function(e){
      var g = activeGame();
      if(g !== 'rash' && g !== 'belter') return;
      var k = e.key, set = g === 'rash' ? AG3.rashKey : AG3.belterKey;
      var lk = (k && k.length===1) ? k.toLowerCase() : k;   // normalise letters
      var hit = true;
      if(k==='ArrowLeft'  || lk==='a') set('left',true);
      else if(k==='ArrowRight' || lk==='d') set('right',true);
      else if(k==='ArrowUp'    || lk==='w') set('up',true);
      else if(k==='ArrowDown'  || lk==='s') set('down',true);
      else if(g==='rash' && lk==='z') AG3.rashAtk(-1);
      else if(g==='rash' && lk==='x') AG3.rashAtk(1);
      else if(g==='rash' && k===' ') AG3.rashAtk(0);
      else if(g==='rash' && lk==='p'){ if(!e.repeat) AG3.rashPause(); }
      else if(g==='belter' && k===' ') set('fire',true);
      else hit = false;
      if(hit) e.preventDefault();
    });
    document.addEventListener('keyup', function(e){
      var g = activeGame();
      if(g !== 'rash' && g !== 'belter') return;
      var k = e.key, set = g === 'rash' ? AG3.rashKey : AG3.belterKey;
      var lk = (k && k.length===1) ? k.toLowerCase() : k;
      if(k==='ArrowLeft'  || lk==='a') set('left',false);
      if(k==='ArrowRight' || lk==='d') set('right',false);
      if(k==='ArrowUp'    || lk==='w') set('up',false);
      if(k==='ArrowDown'  || lk==='s') set('down',false);
      if(g==='belter' && k===' ') set('fire',false);
    });

    // Touch pads. pointerdown/up so a held button keeps the key down.
    document.addEventListener('pointerdown', function(e){
      var pad = e.target.closest ? e.target.closest('.ag3-pad') : null;
      if(!pad) return;
      e.preventDefault();
      if(pad.dataset.rk){
        if(pad.dataset.rk === 'atkl') AG3.rashAtk(-1);
        else if(pad.dataset.rk === 'atkr') AG3.rashAtk(1);
        else AG3.rashKey(pad.dataset.rk, true);
      }
      if(pad.dataset.bk) AG3.belterKey(pad.dataset.bk, true);
    });
    function padUp(e){
      var pad = e.target.closest ? e.target.closest('.ag3-pad') : null;
      if(!pad) return;
      if(pad.dataset.rk && pad.dataset.rk.slice(0,3) !== 'atk') AG3.rashKey(pad.dataset.rk, false);
      if(pad.dataset.bk) AG3.belterKey(pad.dataset.bk, false);
    }
    document.addEventListener('pointerup', padUp);
    document.addEventListener('pointercancel', padUp);
    // Leaving the game with a key held would latch it down forever.
    window.addEventListener('blur', function(){
      rKeys = {}; bKeys = {};
      if(rs && rPlaying && !rs.paused && rs.mode === 'race') AG3.rashPause();
    });

    // Wordgrid: delegated, because the grid is rebuilt on every render.
    document.addEventListener('click', function(e){
      var c = e.target.closest ? e.target.closest('.ag3-wc') : null;
      if(c && activeGame() === 'word') AG3.wordTap(+c.dataset.i);
    });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
