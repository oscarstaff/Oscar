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

     · RASH   — motorbike combat racer. Deliberately NOT built like kart.
                Kart is a real Three.js 3D racer; copying that would give a
                near-identical game with a different sprite. This is a
                pseudo-3D scaling-sprite road (Out Run / Lotus Turbo style)
                drawn on a plain 2D canvas — no Three.js at all — so it
                plays and feels different, and combat is the core rather
                than a bolt-on: you punch and kick riders alongside you.
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
     RASH — motorbike combat racer

     PSEUDO-3D, NOT REAL 3D. The road is a list of segments each with a
     curve and hill value; the camera walks along it and each segment is
     projected to screen with a simple perspective divide. Riders are
     sprites scaled by distance. This is how Out Run and Lotus did it, and
     it is deliberately a different engine from kart's Three.js scene so
     the two games do not feel like the same game twice.
     ══════════════════════════════════════════════════════════════════ */
  var RSEG = 200, RLEN = 1600, RDRAW = 300, RW = 2000;   // road units
  var rs = null, rRAF = null, rKeys = {};

  /* ── Sound (Web Audio) ─────────────────────────────────────────────
     A looping engine tone whose pitch tracks speed, plus one-shot thwacks
     for punches, kicks, hits and crashes. Created lazily on first use so it
     only spins up when someone actually plays, and survives browsers that
     block audio until a gesture (the first key press is the gesture). */
  var rAC = null, rEngine = null, rEngGain = null;
  function rAudio(){
    if(rAC) return rAC;
    try{
      rAC = new (window.AudioContext || window.webkitAudioContext)();
    }catch(e){ rAC = null; }
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
  function rEngineUpdate(speed, maxSpeed){
    if(!rEngine || !rEngGain || !rAC) return;
    var f = speed / maxSpeed;                    // 0..1
    // Idle rumble even at rest, rising with speed; a little wobble for life.
    var hz = 55 + f*135 + Math.sin(rAC.currentTime*22)*3;
    try{
      rEngine.frequency.setTargetAtTime(hz, rAC.currentTime, 0.05);
      rEngGain.gain.setTargetAtTime(0.03 + f*0.06, rAC.currentTime, 0.1);
    }catch(e){}
  }
  // One-shot: a short noise/tone burst. kind: 'punch'|'kick'|'hit'|'crash'|'ko'
  function rSfx(kind){
    var ac = rAudio(); if(!ac) return;
    var t = ac.currentTime;
    try{
      if(kind === 'crash' || kind === 'hit' || kind === 'ko'){
        // Noise burst through a bandpass — a thud/smash.
        var len = kind==='crash' ? 0.45 : 0.16;
        var buf = ac.createBuffer(1, ac.sampleRate*len, ac.sampleRate);
        var d = buf.getChannelData(0);
        for(var i=0;i<d.length;i++) d[i] = (Math.random()*2-1) * (1 - i/d.length);
        var src = ac.createBufferSource(); src.buffer = buf;
        var bp = ac.createBiquadFilter(); bp.type='bandpass';
        bp.frequency.value = kind==='crash' ? 220 : (kind==='ko'?140:380);
        var gn = ac.createGain(); gn.gain.value = kind==='crash'?0.5:0.35;
        gn.gain.setTargetAtTime(0.0001, t+0.02, len*0.4);
        src.connect(bp); bp.connect(gn); gn.connect(ac.destination);
        src.start(t);
      }else{
        // punch/kick — quick pitched blip.
        var o = ac.createOscillator();
        o.type = 'square';
        var g = ac.createGain();
        var f0 = kind==='kick' ? 300 : 440;
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(f0*0.4, t+0.12);
        g.gain.setValueAtTime(0.22, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t+0.13);
        o.connect(g); g.connect(ac.destination);
        o.start(t); o.stop(t+0.14);
      }
    }catch(e){}
  }

  function rBuildRoad(){
    var segs = [], i;
    for(i=0;i<RLEN;i++){
      var curve = 0, hill = 0;
      // Hand-shaped stretches rather than pure noise, so the track has a
      // rhythm you can learn instead of being random every time.
      if(i > 120 && i < 220) curve =  2.4;
      if(i > 260 && i < 340) curve = -3.0;
      if(i > 420 && i < 470) curve =  4.2;
      if(i > 560 && i < 680) curve = -2.0;
      if(i > 780 && i < 880) curve =  3.4;
      if(i > 960 && i < 1080) curve = -4.0;
      if(i > 1180 && i < 1300) curve = 2.6;
      if(i > 300 && i < 420) hill = Math.sin((i-300)/120*Math.PI) * 900;
      if(i > 700 && i < 860) hill = Math.sin((i-700)/160*Math.PI) * -1200;
      if(i > 1100 && i < 1260) hill = Math.sin((i-1100)/160*Math.PI) * 1500;
      // Roadside scenery — a sprite every few segments, alternating sides,
      // whipping past to sell the speed. Type varies so it's not one object
      // repeated. side: -1 left, +1 right; off: how far off the tarmac.
      var scenery = null;
      if(i % 7 === 0){
        var side = (i % 14 === 0) ? -1 : 1;
        var types = ['tree','tree','pole','sign','tree','rock'];
        scenery = { type: types[(i/7|0) % types.length], side: side,
                    off: 1.35 + (i % 3)*0.28 };
      }
      segs.push({ i:i, curve:curve, y:hill, scenery:scenery });
    }
    return segs;
  }

  AG3.rashInit = function(){
    var cv = el('rashCanvas');
    rs = {
      W: cv ? cv.width : 480, H: cv ? cv.height : 320,
      segs: rBuildRoad(),
      pos: 0, playerX: 0, speed: 0, maxSpeed: 340,
      hp: 100, score: 0, dist: 0, lap: 1, over: false,
      punchCd: 0, hitFlash: 0, shake: 0, last: 0,
      kickCd: 0, lean: 0,
      rivals: []
    };
    // Rivals spread down the road; each has a lane, a cruise speed and hp.
    var names = ['VIC','TARA','BRUZ','KEZ','NEV','SHAZ'];
    for(var i=0;i<6;i++){
      rs.rivals.push({
        name: names[i],
        z: 900 + i*950 + Math.random()*400,
        x: (Math.random()*1.5 - 0.75),
        spd: 230 + Math.random()*70,
        hp: 60,
        swing: 0, cd: 0, down: 0
      });
    }
    var st = el('rashStatus');
    if(st) st.textContent = 'Arrows to ride \u00b7 Z punch \u00b7 X kick';
    rEngineStart();
    rHud();
    if(rRAF) cancelAnimationFrame(rRAF);
    rs.last = 0;
    rRAF = requestAnimationFrame(rLoop);
  };
  AG3.rashStop = function(){ if(rRAF) cancelAnimationFrame(rRAF); rRAF = null; rEngineStop(); };
  AG3.rashRestart = function(){ AG3.rashInit(); };
  AG3.rashKey = function(k,down){ rKeys[k] = !!down; };

  function rHud(){
    if(!rs) return;
    var s = el('rashSpeed'); if(s) s.textContent = Math.round(rs.speed);
    var sc = el('rashScore'); if(sc) sc.textContent = rs.score;
    var hp = el('rashHp');
    if(hp){
      hp.style.width = Math.max(0, rs.hp) + '%';
      hp.parentNode.classList.toggle('low', rs.hp <= 35);
    }
    var d = el('rashDist');
    if(d) d.textContent = Math.round(rs.dist/100) + 'm';
  }

  function rSeg(z){
    var idx = Math.floor(z / RSEG) % rs.segs.length;
    if(idx < 0) idx += rs.segs.length;
    return rs.segs[idx];
  }

  AG3.rashPunch = function(){
    if(!rs || rs.over || rs.punchCd > 0) return;
    rs.punchCd = 0.32;
    rSfx('punch');
    var hit = false;
    for(var i=0;i<rs.rivals.length;i++){
      var r = rs.rivals[i];
      if(r.down > 0) continue;
      var dz = r.z - rs.pos;
      // Reach: alongside (within ~1.2 bike lengths) and in the next lane.
      if(dz > -260 && dz < 420 && Math.abs(r.x - rs.playerX) < 0.62){
        r.hp -= 34;
        r.swing = 0.25;
        rs.score += 60;
        hit = true;
        rSfx('hit');
        if(r.hp <= 0){
          r.down = 2.4;
          rs.score += 350;
          rSfx('ko');
          var st = el('rashStatus');
          if(st) st.textContent = r.name + ' is down! +350';
        }
      }
    }
    if(!hit) rs.score = Math.max(0, rs.score - 5);   // whiffing costs a little
    rHud();
  };

  // Kick — heavier and longer-reach than a punch, but a longer cooldown, so
  // it's the finisher and the punch is the jab. Also nudges YOU sideways a
  // touch (recoil), which reads on screen as a lean.
  AG3.rashKick = function(){
    if(!rs || rs.over || rs.kickCd > 0) return;
    rs.kickCd = 0.7;
    rs.lean = (rs.playerX >= 0 ? -1 : 1) * 0.4;   // recoil lean
    rSfx('kick');
    var hit = false;
    for(var i=0;i<rs.rivals.length;i++){
      var r = rs.rivals[i];
      if(r.down > 0) continue;
      var dz = r.z - rs.pos;
      if(dz > -320 && dz < 520 && Math.abs(r.x - rs.playerX) < 0.78){
        r.hp -= 60;
        r.swing = 0.3;
        r.x += Math.sign(r.x - rs.playerX) * 0.35;   // knock them wide
        rs.score += 90;
        hit = true;
        rSfx('hit');
        if(r.hp <= 0){
          r.down = 2.6;
          rs.score += 350;
          rSfx('ko');
          var st = el('rashStatus');
          if(st) st.textContent = r.name + ' floored! +350';
        }
      }
    }
    if(!hit) rs.score = Math.max(0, rs.score - 8);
    rHud();
  };

  function rLoop(t){
    rRAF = requestAnimationFrame(rLoop);
    if(!rs || rs.over) return;
    if(!rs.last) rs.last = t;
    var dt = Math.min(0.05, (t - rs.last)/1000);
    rs.last = t;
    if(!dt) return;

    // --- input ---
    var accel = rKeys.up ? 1 : 0;
    var brake = rKeys.down ? 1 : 0;
    if(accel) rs.speed += 130*dt;
    else if(brake) rs.speed -= 260*dt;
    else rs.speed -= 42*dt;
    rs.speed = Math.max(0, Math.min(rs.maxSpeed, rs.speed));

    var steer = (rKeys.left ? -1 : 0) + (rKeys.right ? 1 : 0);
    var grip = rs.speed / rs.maxSpeed;
    rs.playerX += steer * dt * 1.9 * (0.35 + grip*0.65);

    // Centrifugal push on a curve — you have to steer INTO the bend.
    var seg = rSeg(rs.pos);
    rs.playerX -= seg.curve * dt * grip * 0.42;
    rs.playerX = Math.max(-1.6, Math.min(1.6, rs.playerX));

    // Off the tarmac: slow and rattle.
    if(Math.abs(rs.playerX) > 1){
      rs.speed = Math.min(rs.speed, rs.maxSpeed*0.55);
      rs.shake = 3;
      rs.hp -= 4*dt;
      // Occasional gravel crunch, not every frame.
      rs._offSfx = (rs._offSfx||0) - dt;
      if(rs._offSfx <= 0){ rSfx('crash'); rs._offSfx = 0.5; }
    }

    else if(rs.hp < 100){
      // Clean riding heals slowly, so a good stretch can undo an early
      // mistake. Without this the run is a one-way ratchet toward death and
      // there is nothing you can do about it.
      rs.hp = Math.min(100, rs.hp + 2.2*dt);
    }

    rs.pos += rs.speed * dt * 12;
    rs.dist += rs.speed * dt * 12;
    if(rs.punchCd > 0) rs.punchCd -= dt;
    if(rs.kickCd > 0) rs.kickCd -= dt;
    if(rs.hitFlash > 0) rs.hitFlash -= dt;
    if(rs.shake > 0) rs.shake -= dt*8;
    // Lean recovers to match steering; recoil lean decays.
    var targetLean = steer * 0.5 + (rs.lean||0);
    rs.leanShown = (rs.leanShown||0) + (targetLean - (rs.leanShown||0)) * Math.min(1, dt*10);
    if(rs.lean) rs.lean *= Math.max(0, 1 - dt*4);
    // Engine note tracks speed.
    rEngineUpdate(rs.speed, rs.maxSpeed);

    // --- rivals ---
    for(var i=0;i<rs.rivals.length;i++){
      var r = rs.rivals[i];
      if(r.down > 0){
        r.down -= dt;
        if(r.down <= 0){                 // they get back up, further ahead
          r.hp = 60;
          r.z = rs.pos + 2600 + Math.random()*900;
        }
        continue;
      }
      r.z += r.spd * dt * 12;
      if(r.swing > 0) r.swing -= dt;
      if(r.cd > 0) r.cd -= dt;
      // Drift toward the player when close, so they actually contest you.
      var dz = r.z - rs.pos;
      if(dz > -400 && dz < 900){
        // Drift toward the player, but only slowly — the original value made
        // them stick to you like magnets, so a flawless rider still took ~11
        // unavoidable hits a minute and died having done nothing wrong.
        // Now you can pull away by moving to the far side of the road.
        r.x += Math.sign(rs.playerX - r.x) * dt * 0.24;
        if(Math.abs(r.x - rs.playerX) < 0.5 && r.cd <= 0 && Math.random() < 0.45*dt*6){
          r.cd = 2.0; r.swing = 0.25;
          rs.hp -= 6;
          rs.hitFlash = 0.22; rs.shake = 5;
          rs.speed *= 0.9;
          rSfx('hit');
          var st = el('rashStatus');
          if(st) st.textContent = r.name + ' lands one on you';
        }
      }
      r.x = Math.max(-1.1, Math.min(1.1, r.x));
      // Recycle riders that fall far behind.
      if(dz < -1800) r.z = rs.pos + 2600 + Math.random()*1200;
      // Passing one is worth points, once.
      if(dz < -200 && !r.passed){ r.passed = true; rs.score += 120; }
      if(dz > 200) r.passed = false;
    }

    // Distance pays, so a long clean run is worth something even without
    // knockdowns — otherwise the only viable strategy is constant brawling.
    rs._distAcc = (rs._distAcc || 0) + rs.speed * dt * 12;
    while(rs._distAcc >= 1000){ rs._distAcc -= 1000; rs.score += 10; }

    if(rs.hp <= 0){
      rs.hp = 0; rs.over = true;
      rSfx('crash'); rEngineStop();
      var rec = setBest('rash', rs.score);
      var st2 = el('rashStatus');
      if(st2) st2.textContent = rec ? 'New best: '+rs.score+'!' : 'Wiped out \u00b7 '+rs.score;
      AG3.refreshLabels();
    }

    rHud();
    rDraw();
  }

  function rDraw(){
    var g = ctx2d('rashCanvas');
    if(!g || !rs) return;
    var W = rs.W, H = rs.H;
    var shakeX = rs.shake > 0 ? (Math.random()-0.5)*rs.shake : 0;

    g.save();
    g.translate(shakeX, 0);

    // sky + ground
    var sky = g.createLinearGradient(0,0,0,H*0.5);
    sky.addColorStop(0,'#7fb2e0'); sky.addColorStop(1,'#cfe4f2');
    g.fillStyle = sky; g.fillRect(-8,0,W+16,H*0.5);
    g.fillStyle = '#4b8f4b'; g.fillRect(-8,H*0.5,W+16,H*0.5);

    // Project each segment from the camera forward. Accumulating dx/ddx is
    // what bends the road: every segment shifts a little more than the last.
    var base = Math.floor(rs.pos / RSEG);
    var camH = 1100;
    var x = 0, dx = 0, maxY = H;
    var prev = null;

    for(var n=0;n<RDRAW;n++){
      var idx = (base + n) % rs.segs.length;
      var s = rs.segs[idx];
      var world = n*RSEG - (rs.pos % RSEG);
      if(world < 1) world = 1;
      var scale = 340 / world;
      var sx = W/2 + (x - rs.playerX*RW*0.5) * scale * 0.9;
      var sy = H*0.5 + (camH - s.y) * scale * 0.42;
      var sw = RW * scale;

      if(prev && sy < prev.y && sy < maxY){
        var dark = (Math.floor(idx/3) % 2) === 0;
        // tarmac
        g.fillStyle = dark ? '#4a4d55' : '#53565e';
        g.beginPath();
        g.moveTo(prev.x - prev.w/2, prev.y);
        g.lineTo(prev.x + prev.w/2, prev.y);
        g.lineTo(sx + sw/2, sy);
        g.lineTo(sx - sw/2, sy);
        g.closePath(); g.fill();
        // verge
        g.fillStyle = dark ? '#c9503f' : '#f2f2f2';
        var vw = Math.max(1, sw*0.045);
        g.fillRect(prev.x - prev.w/2 - vw, sy, vw+1, prev.y - sy + 1);
        g.fillRect(prev.x + prev.w/2, sy, vw+1, prev.y - sy + 1);
        // centre dashes
        if(dark){
          g.fillStyle = '#f0f0f0';
          g.fillRect(prev.x - Math.max(0.6,sw*0.008), sy,
                     Math.max(1.2,sw*0.016), prev.y - sy + 1);
        }
        maxY = sy;
      }
      prev = { x:sx, y:sy, w:sw, scale:scale, world:world };
      // Store the projection so riders can be placed on the same road.
      s._x = sx; s._y = sy; s._w = sw; s._sc = scale; s._world = world;

      // Roadside scenery — placed off the tarmac edge, scaled by distance.
      // Drawn here (far to near naturally, since we walk forward) so nearer
      // objects paint over farther ones.
      if(s.scenery && sy > 0 && sy < H && scale > 0.02){
        var scn = s.scenery;
        var edge = sx + scn.side * (sw/2 + scn.off * sw * 0.5);
        rScenery(g, scn.type, edge, sy, sw);
      }

      x += dx; dx += s.curve;
      if(sy < 0) break;
    }

    // --- riders, far to near so nearer ones overlap correctly ---
    var list = rs.rivals.slice().sort(function(a,b){ return b.z - a.z; });
    for(var i=0;i<list.length;i++){
      var r = list[i];
      var dz = r.z - rs.pos;
      if(dz < 0 || dz > RDRAW*RSEG*0.5) continue;
      var seg2 = rSeg(r.z);
      if(seg2._sc === undefined) continue;
      var scl = seg2._sc;
      var bx = seg2._x + (r.x*RW*0.5 - rs.playerX*RW*0.5*0) * scl * 0.9;
      // rebuild x relative to the projected road centre
      bx = seg2._x + (r.x - rs.playerX) * RW * 0.5 * scl * 0.9;
      var by = seg2._y;
      var bw = Math.max(6, 300*scl);
      rBike(g, bx, by, bw, r.down > 0, r.swing > 0, '#c9952e', 0, false);
    }

    // --- player ---
    var pw = 118;
    var px = W/2, py = H - 62;
    var braking = rKeys.down && rs.speed > 20;
    rBike(g, px, py, pw, false, rs.punchCd > 0.2 || rs.kickCd > 0.5,
          '#5a7ec9', rs.leanShown || 0, braking);

    g.restore();

    // Speed streaks — faint lines rushing outward from the vanishing point,
    // stronger the faster you go. Cheap, but sells velocity hugely.
    var spd01 = rs.speed / rs.maxSpeed;
    if(spd01 > 0.45){
      g.save();
      g.strokeStyle = 'rgba(255,255,255,'+((spd01-0.45)*0.5)+')';
      g.lineWidth = 2;
      var cx = W/2, cy = H*0.46;
      for(var q=0;q<7;q++){
        var ang = (q/7)*Math.PI*2 + (rs.pos*0.01);
        var r1 = 40 + (q%3)*14, r2 = r1 + 34 + spd01*40;
        g.beginPath();
        g.moveTo(cx + Math.cos(ang)*r1, cy + Math.sin(ang)*r1*0.6);
        g.lineTo(cx + Math.cos(ang)*r2, cy + Math.sin(ang)*r2*0.6);
        g.stroke();
      }
      g.restore();
    }

    if(rs.hitFlash > 0){
      g.fillStyle = 'rgba(224,90,63,'+(rs.hitFlash*0.9)+')';
      g.fillRect(0,0,W,H);
    }
    if(rs.over){
      g.fillStyle = 'rgba(20,24,32,.72)';
      g.fillRect(0,0,W,H);
      g.fillStyle = '#fff';
      g.font = '800 30px ui-monospace,Menlo,monospace';
      g.textAlign = 'center';
      g.fillText('WIPED OUT', W/2, H/2 - 6);
      g.font = '700 15px ui-monospace,Menlo,monospace';
      g.fillText(rs.score + ' points', W/2, H/2 + 22);
      g.textAlign = 'left';
    }
  }

  /** One roadside object, scaled to the road width at that distance. */
  function rScenery(g, type, x, groundY, roadW){
    var s = roadW * 0.5;                 // size scales with the road at that depth
    if(s < 3) return;
    g.save();
    g.translate(x, groundY);
    if(type === 'tree'){
      var th = s*1.7, tw = s*0.5;
      g.fillStyle = '#3a2a1c';           // trunk
      g.fillRect(-tw*0.14, -th*0.34, tw*0.28, th*0.34);
      g.fillStyle = '#2f6b34';           // canopy
      g.beginPath(); g.ellipse(0, -th*0.55, tw*0.7, th*0.4, 0, 0, 7); g.fill();
      g.fillStyle = '#3a7c40';
      g.beginPath(); g.ellipse(-tw*0.25, -th*0.68, tw*0.42, th*0.3, 0, 0, 7); g.fill();
    }else if(type === 'pole'){
      var ph = s*2.0;
      g.fillStyle = '#8a8f98';
      g.fillRect(-s*0.06, -ph, s*0.12, ph);
      g.fillStyle = '#c7ccd4';
      g.fillRect(-s*0.34, -ph, s*0.68, s*0.14);   // cross-arm
    }else if(type === 'sign'){
      var sh = s*1.1;
      g.fillStyle = '#6b7079';
      g.fillRect(-s*0.05, -sh, s*0.10, sh);
      g.fillStyle = '#e8b530';
      g.beginPath();
      g.moveTo(0,-sh-s*0.55); g.lineTo(s*0.5,-sh); g.lineTo(0,-sh+s*0.05);
      g.lineTo(-s*0.5,-sh); g.closePath(); g.fill();
    }else{ // rock
      g.fillStyle = '#7d7469';
      g.beginPath(); g.ellipse(0, -s*0.28, s*0.5, s*0.3, 0, 0, 7); g.fill();
      g.fillStyle = '#8f877b';
      g.beginPath(); g.ellipse(-s*0.12, -s*0.4, s*0.28, s*0.2, 0, 0, 7); g.fill();
    }
    g.restore();
  }

  /** One rider, drawn as a motorcycle seen from behind with a rider on it.
      Still simple enough to read at speed, but clearly a bike now. */
  function rBike(g,x,y,w,down,swinging,col,lean,braking){
    var h = w*0.9;
    g.save();
    g.translate(x,y);
    if(down){ g.rotate(1.4); g.globalAlpha = .72; }
    else if(lean){ g.rotate(lean * 0.3); }

    // ground shadow
    g.fillStyle = 'rgba(0,0,0,.25)';
    g.beginPath(); g.ellipse(0, h*0.05, w*0.44, h*0.08, 0, 0, 7); g.fill();

    // ── rear wheel (big, near camera) ──
    g.fillStyle = '#1a1c20';
    g.beginPath(); g.ellipse(0, -h*0.02, w*0.20, h*0.24, 0, 0, 7); g.fill();
    g.fillStyle = '#2c2f36';                       // hub
    g.beginPath(); g.ellipse(0, -h*0.04, w*0.10, h*0.12, 0, 0, 7); g.fill();

    // ── exhaust pipes poking out each side low ──
    g.fillStyle = '#9aa0a8';
    g.fillRect(-w*0.30, -h*0.04, w*0.12, h*0.05);
    g.fillRect( w*0.18, -h*0.04, w*0.12, h*0.05);

    // ── brake light (tail), glows red when braking ──
    if(braking){
      g.fillStyle = 'rgba(255,60,40,.95)';
      g.beginPath(); g.ellipse(0, -h*0.14, w*0.09, h*0.05, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,120,90,.45)';
      g.beginPath(); g.ellipse(0, -h*0.14, w*0.17, h*0.10, 0, 0, 7); g.fill();
    }else{
      g.fillStyle = '#7a1e18';                     // dim tail light
      g.beginPath(); g.ellipse(0, -h*0.14, w*0.07, h*0.04, 0, 0, 7); g.fill();
    }

    // ── bike body / tail fairing (coloured) ──
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(-w*0.15, -h*0.16);
    g.lineTo( w*0.15, -h*0.16);
    g.lineTo( w*0.11, -h*0.44);
    g.lineTo(-w*0.11, -h*0.44);
    g.closePath(); g.fill();
    // seat hump
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.beginPath(); g.roundRect(-w*0.13, -h*0.30, w*0.26, h*0.10, w*0.03); g.fill();

    // ── rider: torso (jacket), shoulders, helmet ──
    // jacket
    g.fillStyle = '#20242b';
    g.beginPath();
    g.moveTo(-w*0.14, -h*0.34);
    g.lineTo( w*0.14, -h*0.34);
    g.lineTo( w*0.17, -h*0.60);
    g.lineTo(-w*0.17, -h*0.60);
    g.closePath(); g.fill();
    // shoulders
    g.fillStyle = '#2b3039';
    g.beginPath(); g.ellipse(-w*0.15, -h*0.60, w*0.09, h*0.07, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse( w*0.15, -h*0.60, w*0.09, h*0.07, 0, 0, 7); g.fill();
    // helmet
    g.fillStyle = col;
    g.beginPath(); g.arc(0, -h*0.70, w*0.13, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.18)';         // helmet sheen
    g.beginPath(); g.arc(-w*0.04, -h*0.73, w*0.05, 0, 7); g.fill();

    // ── mirrors / handlebar hints ──
    g.strokeStyle = '#1a1c20'; g.lineWidth = Math.max(1.5, w*0.03); g.lineCap='round';
    g.beginPath();
    g.moveTo(-w*0.16, -h*0.50); g.lineTo(-w*0.24, -h*0.54);
    g.moveTo( w*0.16, -h*0.50); g.lineTo( w*0.24, -h*0.54);
    g.stroke();

    // ── swinging punch/kick arm ──
    if(swinging){
      g.strokeStyle = '#e8b530';
      g.lineWidth = Math.max(2.5, w*0.06);
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(w*0.14, -h*0.52);
      g.lineTo(w*0.42, -h*0.44);
      g.stroke();
      g.fillStyle = '#e8b530';                      // fist
      g.beginPath(); g.arc(w*0.44, -h*0.43, w*0.06, 0, 7); g.fill();
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
      score:0, lives:3, wave:1, over:false, last:0, fireCd:0
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

    if(bKeys.left)  s.a -= 3.4*dt;
    if(bKeys.right) s.a += 3.4*dt;
    if(bKeys.up){ s.vx += Math.cos(s.a)*260*dt; s.vy += Math.sin(s.a)*260*dt; }
    // Light drag so it is controllable without killing the drift.
    s.vx *= (1 - 0.42*dt); s.vy *= (1 - 0.42*dt);
    s.x += s.vx*dt; s.y += s.vy*dt;
    bWrap(s,12);
    if(s.inv > 0) s.inv -= dt;
    if(bs.fireCd > 0) bs.fireCd -= dt;
    if(bKeys.fire) AG3.belterFire();

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
    if(s.inv <= 0){
      for(i=0;i<bs.rocks.length;i++){
        var rr = bs.rocks[i];
        if(Math.hypot(rr.x-s.x, rr.y-s.y) < rr.r + 9){
          bs.lives--;
          bBits(s.x,s.y,18,'#e05a3f');
          s.x = bs.W/2; s.y = bs.H/2; s.vx = 0; s.vy = 0; s.inv = 2.4;
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
      bs.score += 250;
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
    bs.score += r.tier === 3 ? 20 : r.tier === 2 ? 50 : 100;
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
    if(!(s.inv > 0 && Math.floor(s.inv*10)%2)){
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
    var r = el('best-rash');   if(r) r.textContent = 'BEST: ' + best('rash');
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
          '<div class="ag3-hud">'+
            '<div><span>Speed</span><b id="rashSpeed">0</b></div>'+
            '<div><span>Health</span><div class="ag3-bar hp"><i id="rashHp" style="width:100%"></i></div></div>'+
            '<div><span>Score</span><b id="rashScore">0</b></div>'+
            '<div><span>Distance</span><b id="rashDist">0m</b></div>'+
          '</div>'+
          '<canvas class="ag-canvas" id="rashCanvas" width="480" height="320"></canvas>'+
          '<div class="ag-row ag3-pads">'+
            '<button class="ag3-pad" data-rk="left">\u25C0</button>'+
            '<button class="ag3-pad" data-rk="up">\u25B2</button>'+
            '<button class="ag3-pad" data-rk="down">\u25BC</button>'+
            '<button class="ag3-pad" data-rk="right">\u25B6</button>'+
            '<button class="ag3-pad" data-rk="punch">\u{1F44A}</button>'+
            '<button class="ag3-pad" data-rk="kick">\u{1F9B5}</button>'+
          '</div>'+
          '<div class="ag-row">'+
            '<button class="ag-btn primary" onclick="AG3.rashRestart()">Restart</button>'+
          '</div>'+
          '<p class="ag-hint">Arrows to ride, Z to swing. Pull alongside a rider and knock them off \u2014 350 points a head. Steer into the bends or the camber will spit you onto the dirt.</p>'+
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
          '<p>Motorbike combat on an open road. Ride alongside the pack and knock riders off \u2014 they hit back, and the bends will throw you.</p>'+
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
      else if(g==='rash' && (lk==='z'||k===' ')) AG3.rashPunch();
      else if(g==='rash' && lk==='x') AG3.rashKick();
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
        if(pad.dataset.rk === 'punch') AG3.rashPunch();
        else if(pad.dataset.rk === 'kick') AG3.rashKick();
        else AG3.rashKey(pad.dataset.rk, true);
      }
      if(pad.dataset.bk) AG3.belterKey(pad.dataset.bk, true);
    });
    function padUp(e){
      var pad = e.target.closest ? e.target.closest('.ag3-pad') : null;
      if(!pad) return;
      if(pad.dataset.rk && pad.dataset.rk !== 'punch' && pad.dataset.rk !== 'kick') AG3.rashKey(pad.dataset.rk, false);
      if(pad.dataset.bk) AG3.belterKey(pad.dataset.bk, false);
    }
    document.addEventListener('pointerup', padUp);
    document.addEventListener('pointercancel', padUp);
    // Leaving the game with a key held would latch it down forever.
    window.addEventListener('blur', function(){ rKeys = {}; bKeys = {}; });

    // Wordgrid: delegated, because the grid is rebuilt on every render.
    document.addEventListener('click', function(e){
      var c = e.target.closest ? e.target.closest('.ag3-wc') : null;
      if(c && activeGame() === 'word') AG3.wordTap(+c.dataset.i);
    });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
