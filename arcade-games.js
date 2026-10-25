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
    background:var(--panel);cursor:pointer;display:grid;grid-template-columns:1fr 78px;gap:8px;align-items:center;
    font-family:inherit;color:var(--text);font-size:14px;}
  .rm-tx{display:flex;flex-direction:column;gap:2px;min-width:0;}
  .rm-tx b{font-size:14px;}
  .rm-map{width:78px;height:78px;display:block;border-radius:8px;background:rgba(125,138,160,.12);}
  .rm-track.sel{border-color:var(--accent);box-shadow:0 0 0 2px rgba(224,90,63,.25);}
  .rm-track.lock{opacity:.5;cursor:not-allowed;}
  .rm-tx span,.rm-tx em,.rm-tx i{font-size:11.5px;color:var(--text-dim);font-style:normal;}
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
  /* City themes. Each city has its own light: Sydney is a bright morning,
     Ulaanbaatar clear and cold, Shanghai a hazy dusk, Hong Kong night and
     Kathmandu a dusty golden afternoon. */
  R_THEMES.dusk.lit = true;
  R_THEMES.night.lit = true;
  R_THEMES.sydney = { sky:['#3f94dc','#d6ecf8'], grass:['#5e9c55','#589650'], tar:['#4b4e56','#54575f'],
             rum:['#d9d9d9','#c24a4a'], hill:['#a9cadb','#93b9cd'], scen:['palm','lamp','pine'] };
  R_THEMES.ub     = { sky:['#4f9ad6','#e4eff4'], grass:['#b6ae78','#aea670'], tar:['#55575c','#5d6065'],
             rum:['#c9503f','#e8e8e8'], hill:['#a4b4a0','#90a28e'], scen:['tuft','lamp','tuft'] };
  R_THEMES.shanghai = { sky:['#6b6f94','#e3b8a4'], grass:['#4a5a4c','#445347'], tar:['#3d4048','#454851'],
             rum:['#c9503f','#e0e0e0'], hill:['#6e7090','#5d6080'], scen:['lamp','platane','lamp'], lit:true };
  R_THEMES.hk     = { sky:['#06091c','#34235e'], grass:['#142418','#101f15'], tar:['#2b2d36','#32343e'],
             rum:['#c23a5a','#d8d8d8'], hill:['#1a2145','#12183a'], scen:['lamp','tower','lamp'], lit:true, stars:true };
  R_THEMES.ktm    = { sky:['#6aa6d8','#f1dcb4'], grass:['#8a7a4e','#826f46'], tar:['#5a5551','#625c58'],
             rum:['#a63c2a','#e8e0d0'], hill:['#8fa6b8','#7c94a8'], scen:['brick','wirepole','tree'] };

  /* Ground colours that zones switch between. */
  var G_SAND=['#e4d29c','#ddcb92'], G_WATER=['#2f7fb8','#3687c0'], G_STONE=['#b3ada0','#aca698'],
      G_BRICK=['#a65a40','#9f533a'], G_DUST=['#b39a6c','#ab9264'], G_DUSTG=['#9c9462','#948c5a'],
      G_CITY=['#8c8c86','#86867f'], G_NPARK=['#12301c','#0f2917'], G_NSTONE=['#262a38','#222633'],
      G_NWATER=['#0f2a4a','#12315a'], G_ELEV=['#1c1f2e','#181b29'], G_DWATER=['#3a5a78','#40607e'],
      G_BROWN=['#9a8460','#927c58'], G_HILLG=['#8aa064','#829a5c'], G_STEPPE=['#b4b070','#aca868'],
      G_DSTONE=['#6d6a72','#67646c'];

  /* Vehicle kinds: hw is the half-width used for collisions (the bike adds its own). */
  var R_VEH = {
    car  :{ hw:.17, s:[90,160],  f:1 },    taxi :{ hw:.17, s:[100,150], f:1 },
    van  :{ hw:.19, s:[80,130],  f:1.1 },  bus  :{ hw:.25, s:[65,100],  f:1.45 },
    scoot:{ hw:.09, s:[60,115],  f:.8 },   tempo:{ hw:.14, s:[50,85],   f:.85 },
    cow  :{ hw:.14, s:[0,6],     f:.85 },  truck:{ hw:.26, s:[70,105],  f:1.5 }
  };

  var R_TRACKS = [
    { id:'valley', name:'Valley Run',    theme:'valley', tier:0, segs:2600, curve:2.2, hill:800,  top:268, rivals:7, traffic:0.5, weapons:0.10, cops:false, prize:[2500,1500,800],    seed:11 },
    { id:'sydney', name:'Sydney', city:true, theme:'sydney', tier:0.5, curve:2.2, top:280, rivals:7, traffic:0.9, weapons:0.15, cops:false, prize:[3200,1900,950], seed:71,
      kinds:[['car',5],['taxi',2],['bus',1],['van',1]], pal:{ taxi:'#f0efe8', bus:'#2f6fb8', busTop:'#f2f2f2' },
      blurb:'Bondi to the Harbour Bridge',
      zones:[
        { n:'Bondi Beach', len:520, cv:'sweep', amp:.7, hp:'rolling', hill:350, gnd:G_SAND, sc:['palm','palm','lamp','pine','palm'], d:5, off:[1.7,2.5], skyk:'beach', traf:.7 },
        { n:'Oxford Street', len:520, cv:'esses', amp:.9, hp:'rolling', hill:250, gnd:G_CITY, sc:['terrace','terrace','jacaranda','lamp','shop'], both:1, d:4, off:[1.75,2.3], skyk:'cbd', traf:1.3 },
        { n:'Harbour Tunnel', len:320, cv:'sweep', amp:.4, hp:'arch', hill:-400, tun:1, skyk:'cbd', traf:1 },
        { n:'Circular Quay', len:480, cv:'sweep', amp:.8, gnd:G_STONE, sc:['palm','lamp','sail','lamp','sail'], d:4, off:[1.7,2.3], skyk:'harbour', traf:1,
          land:[{u:.42,t:'opera',side:-1,off:2.6}] },
        { n:'Harbour Bridge', len:600, cv:'sweep', amp:.25, hp:'arch', hill:1100, gnd:G_WATER, walls:1, wc:'#8b929c', deco:{t:'truss', every:3, col:'#6f7782'}, skyk:'harbour', traf:1 },
        { n:'North Sydney', len:560, cv:'sweep', amp:.8, hp:'rolling', hill:500, gnd:G_CITY, sc:['tower','tower','palm','lamp','gum'], both:1, d:4, off:[1.9,2.8], skyk:'cbd', traf:1 }
      ] },
    { id:'desert', name:'Red Desert',    theme:'desert', tier:1, segs:3000, curve:2.6, hill:1000, top:290, rivals:8, traffic:0.7, weapons:0.30, cops:true,  prize:[4000,2400,1200],   seed:23 },
    { id:'ub', name:'Ulaanbaatar', city:true, theme:'ub', tier:1.5, curve:2.4, top:300, rivals:8, traffic:0.9, weapons:0.30, cops:true, prize:[5000,3000,1500], seed:83,
      kinds:[['car',5],['bus',1],['truck',1],['van',1]], pal:{ bus:'#d8d2c0', busTop:'#3a6aa8' },
      blurb:'Peace Avenue to the Genghis Khan statue',
      zones:[
        { n:'Peace Avenue', len:560, cv:'sweep', amp:.5, hp:'flat', gnd:G_CITY, sc:['apartment','apartment','lamp','tree','apartment'], both:1, d:4, off:[1.85,2.4], skyk:'ub', traf:1.4,
          land:[{u:.45,t:'bluesky',side:1,off:2.6}] },
        { n:'Sukhbaatar Square', len:480, cv:'sweep', amp:.8, gnd:G_STONE, sc:['lamp','apartment','tree','lamp'], d:4, off:[1.8,2.4], skyk:'ub', traf:1,
          land:[{u:.5,t:'statue',side:-1,off:2.3}] },
        { n:'Ger District', len:560, cv:'esses', amp:1.0, hp:'rolling', hill:900, gnd:G_BROWN, sc:['ger','ger','pole','ger','tuft'], both:1, d:4, off:[1.7,2.6], skyk:'ub', traf:.8,
          land:[{u:.3,t:'chimney',side:-1,off:2.6},{u:.72,t:'chimney',side:1,off:2.6}] },
        { n:'Gandan Monastery', len:440, cv:'sweep', amp:.9, gnd:G_BROWN, sc:['temple','ger','tree','wirepole','ger'], d:5, off:[1.8,2.5], deco:{t:'flags', every:9, pal:['#2f6fd0','#f2f2f2','#d8352c','#2f9a52','#f0c030']}, skyk:'ub', traf:.8 },
        { n:'Zaisan Hill', len:520, cv:'tight', amp:1.1, hp:'rolling', hill:1300, gnd:G_HILLG, sc:['tree','pine','rock','tuft'], d:5, off:[1.7,2.6], skyk:'ub', traf:.6,
          land:[{u:.6,t:'zaisan',side:1,off:2.6}] },
        { n:'The Steppe', len:640, cv:'fast', amp:.7, hp:'rolling', hill:500, gnd:G_STEPPE, sc:['tuft','ger','tuft','ovoo','tuft','pole'], d:7, off:[2.0,3.6], skyk:'steppe', traf:.4 },
        { n:'Genghis Khan', len:400, cv:'sweep', amp:.7, hp:'rolling', hill:300, gnd:G_STEPPE, sc:['tuft','tuft','ovoo','ger'], d:6, off:[2.0,3.4], skyk:'steppe', traf:.3,
          land:[{u:.75,t:'khan',side:-1,off:2.6}] }
      ] },
    { id:'pine', name:'Pine Ridge',    theme:'pine',   tier:2, segs:3400, curve:3.2, hill:1300, top:312, rivals:8, traffic:0.8, weapons:0.45, cops:true,  prize:[6000,3600,1800],   seed:37 },
    { id:'shanghai', name:'Shanghai', city:true, theme:'shanghai', tier:2.5, curve:2.8, top:322, rivals:8, traffic:1.0, weapons:0.45, cops:true, prize:[7500,4500,2250], seed:97,
      kinds:[['car',3],['taxi',2],['scoot',3],['bus',1],['van',1]], pal:{ taxi:'#1fa7a0', bus:'#d9d9d0', busTop:'#c8372d' },
      blurb:'Yu Garden to Lupu Bridge',
      zones:[
        { n:'Yu Garden', len:520, cv:'tight', amp:1.05, hp:'flat', gnd:G_DSTONE, sc:['shikumen','shikumen','platane','lant','shop'], both:1, d:3, off:[1.7,2.1], deco:{t:'lantern', every:4}, gates:[.1,.55], skyk:'oldsh', traf:1.3 },
        { n:'The Bund', len:600, cv:'sweep', amp:.6, gnd:G_STONE, sc:['colonial','colonial','colonial','platane'], sc2:['lamp','platane','lamp'], both:1, d:4, off:[1.8,2.3], skyk:'pudong', traf:1 },
        { n:"Yan'an Elevated", len:520, cv:'sweep', amp:.5, hp:'rolling', hill:300, gnd:G_ELEV, walls:1, wc:'#7c8088', sc:['tower','tower','tower'], both:1, d:3, off:[2.6,3.6], skyk:'pudong', traf:1.2 },
        { n:'Nanpu Bridge', len:560, cv:'sweep', amp:.7, hp:'arch', hill:800, gnd:G_DWATER, walls:1, wc:'#8a8f98', deco:{t:'stay', every:9, col:'#e0a52e'}, skyk:'pudong', traf:1 },
        { n:'Lujiazui', len:640, cv:'esses', amp:.7, gnd:G_DSTONE, sc:['tower','tower','tower','lamp','platane'], both:1, d:3, off:[2.0,3.0], deco:{t:'neon', every:9}, skyk:'pudong', traf:1.2,
          land:[{u:.3,t:'pearl',side:-1,off:2.4},{u:.55,t:'jinmao',side:1,off:2.4},{u:.8,t:'swfc',side:-1,off:2.4}] },
        { n:'Lupu Bridge', len:520, cv:'sweep', amp:.3, hp:'arch', hill:1200, gnd:G_DWATER, walls:1, wc:'#8a8f98', deco:{t:'truss', every:3, col:'#c8372d'}, skyk:'pudong', traf:1 },
        { n:'Xuhui Riverside', len:240, cv:'sweep', amp:.6, hp:'rolling', hill:200, gnd:G_DSTONE, sc:['platane','lamp','tower'], d:4, off:[1.8,2.6], skyk:'pudong', traf:.8 }
      ] },
    { id:'sunset', name:'Sunset Strip',  theme:'dusk',   tier:3, segs:3600, curve:3.6, hill:1200, top:334, rivals:8, traffic:1.0, weapons:0.60, cops:true,  prize:[9000,5400,2700],   seed:41 },
    { id:'hk', name:'Hong Kong', city:true, theme:'hk', tier:3.5, curve:3.0, top:345, rivals:8, traffic:1.1, weapons:0.60, cops:true, prize:[11000,6600,3300], seed:109,
      kinds:[['taxi',4],['bus',2],['car',2],['van',1]], pal:{ taxi:'#d8352c', bus:'#c8372d', busTop:'#f0eee0' },
      blurb:'Victoria Peak to Lantau',
      zones:[
        { n:'Victoria Peak', len:560, cv:'tight', amp:1.15, hp:'rolling', hill:1400, gnd:G_NPARK, sc:['pine','tree','lamp','rock','tree'], d:5, off:[1.7,2.5], skyk:'hk', traf:.4 },
        { n:'Central', len:560, cv:'esses', amp:.8, hp:'flat', gnd:G_NSTONE, sc:['tower','tenement','tower','lamp','tenement'], both:1, d:3, off:[1.8,2.5], deco:{t:'neon', every:6}, skyk:'hk', traf:1.5,
          land:[{u:.35,t:'boc',side:-1,off:2.4},{u:.7,t:'ifc',side:1,off:2.4}] },
        { n:'Cross-Harbour Tunnel', len:420, cv:'sweep', amp:.4, hp:'arch', hill:-450, tun:1, skyk:'hk', traf:1.2 },
        { n:'Nathan Road', len:640, cv:'sweep', amp:.45, hp:'flat', gnd:G_NSTONE, sc:['tenement','tenement','tower','shop'], both:1, d:3, off:[1.75,2.2], deco:{t:'neon', every:4}, skyk:'hk', traf:1.8 },
        { n:'Tsim Sha Tsui', len:440, cv:'sweep', amp:.8, hp:'flat', gnd:G_NSTONE, sc:['palm','lamp','lamp','tower'], d:4, off:[1.7,2.4], skyk:'hkharbour', traf:1 },
        { n:'Tsing Ma Bridge', len:600, cv:'sweep', amp:.3, hp:'arch', hill:500, gnd:G_NWATER, walls:1, wc:'#6a7080', deco:{t:'stay', every:12, col:'#d8d8e0'}, skyk:'hills', traf:.9 },
        { n:'Lantau Island', len:380, cv:'sweep', amp:1.0, hp:'rolling', hill:700, gnd:G_NPARK, sc:['pine','tree','tree','lamp'], d:5, off:[1.7,2.5], skyk:'hills', traf:.4 }
      ] },
    { id:'night', name:'Midnight Mile', theme:'night',  tier:4, segs:4000, curve:4.0, hill:1500, top:356, rivals:8, traffic:1.2, weapons:0.70, cops:true,  prize:[14000,8400,4200],  seed:59 },
    { id:'ktm', name:'Kathmandu', city:true, theme:'ktm', tier:4.5, curve:3.2, top:362, rivals:8, traffic:1.2, weapons:0.70, cops:true, prize:[16000,9600,4800], seed:127,
      kinds:[['tempo',3],['scoot',3],['car',1],['bus',1],['cow',1]], pal:{ bus:'#e0b030', busTop:'#c24a4a', tempo:'#2f8f8a' },
      blurb:'Thamel to the Himalaya Road',
      zones:[
        { n:'Thamel', len:560, cv:'tight', amp:1.15, hp:'rolling', hill:200, gnd:G_DUST, sc:['brick','shop','brick','wirepole','shop'], both:1, d:3, off:[1.7,2.0], deco:{t:'flags', every:6}, skyk:'ktm', traf:1.8 },
        { n:'Durbar Square', len:520, cv:'esses', amp:.9, gnd:G_BRICK, sc:['pagoda','brick','temple','wirepole','brick'], both:1, d:4, off:[1.8,2.4], deco:{t:'flags', every:7}, skyk:'ktm', traf:1.5,
          land:[{u:.4,t:'pagoda',side:-1,off:2.4},{u:.75,t:'temple',side:1,off:2.4}] },
        { n:'Ring Road', len:600, cv:'fast', amp:.7, hp:'rolling', hill:400, gnd:G_DUST, sc:['brick','tree','wirepole','tree','shop'], d:5, off:[1.9,3.0], skyk:'himal', traf:1.3 },
        { n:'Swayambhunath', len:520, cv:'sweep', amp:1.1, hp:'rolling', hill:1300, gnd:G_DUSTG, sc:['tree','pine','tree','rock','wirepole'], d:5, off:[1.8,2.8], deco:{t:'flags', every:10}, skyk:'ktm', traf:.9,
          land:[{u:.55,t:'stupa',side:-1,off:1.9}] },
        { n:'Boudhanath', len:600, cv:'sweep', amp:.9, gnd:G_STONE, sc:['shop','brick','temple','wirepole'], both:1, d:4, off:[1.8,2.3], deco:{t:'flags', every:4}, skyk:'ktm', traf:1.4,
          land:[{u:.5,t:'stupa',side:-1,off:2.0,big:1}] },
        { n:'Bagmati Valley', len:560, cv:'sweep', amp:1.0, hp:'rolling', hill:600, gnd:G_DUST, sc:['tree','temple','tree','wirepole','brick'], d:5, off:[1.8,2.8], skyk:'himal', traf:.9 },
        { n:'Himalaya Road', len:480, cv:'sweep', amp:1.2, hp:'rolling', hill:1500, gnd:G_DUSTG, sc:['pine','pine','rock','tree'], d:5, off:[1.8,3.0], deco:{t:'flags', every:9}, skyk:'himal', traf:.5 }
      ] }
  ];
  /* Zone ranges, and the length of each city circuit. */
  (function(){
    for(var i=0;i<R_TRACKS.length;i++){
      var T = R_TRACKS[i];
      if(!T.zones) continue;
      var a = 0;
      for(var z=0;z<T.zones.length;z++){ var Z = T.zones[z]; Z.i = z; Z.a = a; a += Z.len; Z.b = a; }
      T.segs = a - 90;
    }
  })();
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
  function rIndexOf(id){ for(var i=0;i<R_TRACKS.length;i++) if(R_TRACKS[i].id === id) return i; return 0; }
  function rLoad(){
    var d = { v:2, cash:0, bikes:[0], bike:0, unlocked:0, earned:0, rec:{} }, j = null;
    try{ j = JSON.parse(localStorage.getItem('rash_save_v1') || 'null'); }catch(e){}
    if(j && typeof j === 'object'){
      for(var k in d){ if(j[k] !== undefined) d[k] = j[k]; }
      if(j.v !== 2){
        // Saved before the city roads existed: roads were numbered 0-4 in the old order.
        var old = ['valley','desert','pine','sunset','night'], rec = {}, u = rClamp(j.unlocked|0, 0, 4);
        for(var o=0;o<5;o++) if(j.rec && j.rec[o]) rec[old[o]] = j.rec[o];
        d.rec = rec; d.unlocked = rIndexOf(old[u]); d.v = 2;
      }
    }
    if(!d.rec || typeof d.rec !== 'object') d.rec = {};
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
    if(T.zones) return rBuildZones(T);
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
  /* City circuits are built zone by zone: each zone sets its own bend style,
     hills, ground, walls or tunnel, roadside objects and landmarks. */
  function rPick(list, rnd){ return list[(rnd()*list.length)|0]; }
  function rSprite(list, rnd, side, off){
    return { type:rPick(list, rnd), side:side, off:off[0] + rnd()*(off[1] - off[0]), v:rnd() };
  }
  function rBuildZones(T){
    var N = T.segs + 90, zs = T.zones, curve = new Float32Array(N), hill = new Float32Array(N);
    var segs = [], zi, i, k;
    for(zi=0; zi<zs.length; zi++){
      var Z = zs[zi], rnd = rRng(T.seed*977 + zi*131 + 5), a = Z.a, b = Math.min(N, Z.b), len = b - a;
      var style = Z.cv || 'sweep', amp = T.curve * (Z.amp == null ? 1 : Z.amp);
      var sign = rnd() < 0.5 ? -1 : 1;
      i = a + (zi === 0 ? 160 : 10);
      var endI = b - (zi === zs.length - 1 ? 100 : 10);
      while(style !== 'str' && i < endI - 24){
        var bl, ba, gap;
        if(style === 'esses'){ bl = 36 + rnd()*46; ba = amp*(0.65 + rnd()*0.5); gap = 2 + rnd()*10; sign = -sign; }
        else if(style === 'tight'){ bl = 28 + rnd()*36; ba = amp*(0.8 + rnd()*0.5); gap = 10 + rnd()*30; if(rnd() < 0.8) sign = -sign; }
        else if(style === 'fast'){ bl = 110 + rnd()*150; ba = amp*(0.4 + rnd()*0.5); gap = 40 + rnd()*100; if(rnd() < 0.7) sign = -sign; }
        else{ bl = 60 + rnd()*100; ba = amp*(0.5 + rnd()*0.6); gap = 24 + rnd()*80; if(rnd() < 0.7) sign = -sign; }
        bl = Math.min(bl|0, endI - i); ba = Math.min(ba, 4.6);
        if(bl < 20) break;
        for(k=0;k<bl;k++) curve[i+k] = sign*ba*Math.min(1, Math.sin(Math.PI*k/bl)*2.4);
        i += bl + (gap|0);
      }
      var hp = Z.hp || 'flat', H0 = Z.hill || 0;
      if(hp === 'arch'){
        for(k=0;k<len;k++) hill[a+k] = Math.sin(Math.PI*k/len)*H0;      // one big bump; negative dips under the water
      }else if(hp === 'rolling' && H0){
        var hi = a + (zi === 0 ? 220 : 20);
        while(hi < b - 150){
          var hl = 110 + ((rnd()*130)|0), ha = H0*(0.4 + rnd()*0.7)*(rnd() < 0.5 ? -1 : 1);
          if(hi + hl > b - 10) break;
          for(k=0;k<hl;k++) hill[hi+k] = Math.sin(Math.PI*k/hl)*ha;
          hi += hl + 20 + ((rnd()*120)|0);
        }
      }
    }
    // Landmarks keep a clear gap around them on their side so they can be seen.
    var lmPos = [];
    for(zi=0; zi<zs.length; zi++){
      var lz = zs[zi].land || [];
      for(k=0;k<lz.length;k++) lmPos.push({ i:zs[zi].a + Math.floor(lz[k].u*zs[zi].len), side:lz[k].side });
    }
    function lmGap(idx, side){
      for(var q=0;q<lmPos.length;q++) if(lmPos[q].side === side && Math.abs(lmPos[q].i - idx) < 12) return true;
      return false;
    }
    // Per-segment dressing.
    zi = 0;
    var rn = rRng(T.seed*31 + 3), Zc = zs[0];
    for(i=0;i<N;i++){
      while(zi < zs.length - 1 && i >= zs[zi].b) zi++;
      Zc = zs[zi];
      var seg = { i:i, curve:curve[i], y:hill[i], sc:null, sc2:null, lm:null, deco:null, zn:Zc };
      var rel = i - Zc.a, d = Zc.d || 6;
      if(Zc.sc && !Zc.tun && i > 40 && rel % d === 0 && rel > 4 && Zc.b - i > 4){
        var off = Zc.off || [1.55, 2.1];
        if(Zc.both){
          seg.sc  = rSprite(Zc.sc, rn, -1, off);
          seg.sc2 = rSprite(Zc.sc2 || Zc.sc, rn, 1, off);
          if(lmGap(i, -1)) seg.sc = null;
          if(lmGap(i, 1)) seg.sc2 = null;
        }else{
          seg.sc = rSprite(Zc.sc, rn, ((rel/d|0) % 2) ? 1 : -1, off);
          if(lmGap(i, seg.sc.side)) seg.sc = null;
        }
      }
      if(Zc.deco && !Zc.tun && rel > 8 && Zc.b - i > 8 && rel % Zc.deco.every === 0){
        seg.deco = { t:Zc.deco.t, col:Zc.deco.col, pal:Zc.deco.pal, u:rel/Zc.len, side:((rel/Zc.deco.every|0) % 2) ? 1 : -1, v:rn() };
      }
      segs.push(seg);
    }
    for(zi=0; zi<zs.length; zi++){
      Zc = zs[zi];
      var lms = Zc.land || [], gts = Zc.gates || [];
      for(k=0;k<lms.length;k++){
        var li = Zc.a + Math.floor(lms[k].u*Zc.len);
        segs[li].lm = { type:lms[k].t, side:lms[k].side, off:lms[k].off, v:.5, big:lms[k].big };
      }
      for(k=0;k<gts.length;k++){
        var gi = Zc.a + Math.floor(gts[k]*Zc.len);
        segs[gi].deco = { t:'gate', u:gts[k], side:1, v:.3 };
      }
    }
    return segs;
  }

  function rZoneAt(T, z){
    if(!T.zones) return null;
    var i = Math.max(0, Math.min(T.segs + 89, Math.floor(z / RSEG))), zs = T.zones;
    for(var k=0;k<zs.length;k++) if(i < zs[k].b) return zs[k];
    return zs[zs.length-1];
  }

  /* Heading is the running sum of the bends, so the road map is the real
     shape of the circuit, redrawn to fit a small box. */
  function rRoute(T){
    if(T._route) return T._route;
    var segs = rBuildRoad(T), pts = [], x = 0, y = 0, th = 0, K = 0.0055, i, mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
    for(i=0;i<segs.length;i++){
      th += segs[i].curve * K;
      x += Math.sin(th); y -= Math.cos(th);
      if(i % 4 === 0){
        pts.push([x, y]);
        if(x < mnx) mnx = x; if(x > mxx) mxx = x; if(y < mny) mny = y; if(y > mxy) mxy = y;
      }
    }
    var sw = Math.max(1, mxx - mnx), sh = Math.max(1, mxy - mny), sc = 1 / Math.max(sw, sh);
    var ox = (1 - sw*sc)/2, oy = (1 - sh*sc)/2;
    for(i=0;i<pts.length;i++){ pts[i] = [ox + (pts[i][0] - mnx)*sc, oy + (pts[i][1] - mny)*sc]; }
    T._route = pts;
    return pts;
  }
  function rBuildTraffic(T){
    var rnd = rRng(T.seed + 7), cars = [], z = R_START + 6000, lanes = [-0.6, 0, 0.6], kinds = T.kinds, tot = 0, k;
    if(kinds) for(k=0;k<kinds.length;k++) tot += kinds[k][1];
    var pal = T.pal || {};
    while(z < T.segs*RSEG - 12000){
      var Z = rZoneAt(T, z), dens = T.traffic * (Z && Z.traf != null ? Z.traf : 1);
      z += (3400 + rnd()*5000) / Math.max(0.15, dens);
      if(Z && Z.tun && rnd() < 0.2) continue;
      var kind = 'car';
      if(kinds){
        var pk = rnd()*tot;
        for(k=0;k<kinds.length;k++){ pk -= kinds[k][1]; if(pk <= 0){ kind = kinds[k][0]; break; } }
      }else if(rnd() < 0.25) kind = 'van';
      var V = R_VEH[kind], col = R_CARS[(rnd()*R_CARS.length)|0], top = null;
      if(kind === 'taxi') col = pal.taxi || '#e0b030';
      else if(kind === 'bus'){ col = pal.bus || '#2f6fb8'; top = pal.busTop || '#f2f2f2'; }
      else if(kind === 'tempo') col = pal.tempo || '#2f8f8a';
      else if(kind === 'scoot'){ col = R_COLS[(rnd()*R_COLS.length)|0]; top = R_JACKS[(rnd()*R_JACKS.length)|0]; }
      else if(kind === 'cow') col = rnd() < 0.5 ? '#eee9dc' : '#8a6a4a';
      else if(kind === 'truck') col = rnd() < 0.5 ? '#d8d8d0' : '#3a5a8a';
      cars.push({ z:z, x: kind === 'cow' ? rnd()*1.2 - 0.6 : lanes[(rnd()*3)|0], spd:V.s[0] + rnd()*(V.s[1] - V.s[0]),
                  col:col, top:top, k:kind, hw:V.hw, van:kind === 'van', dd:T.id === 'hk' });
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
    var maxHp = 62 + T.tier*8 + skill*22;
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
      finishOrder:[], place:0, finT:0, banner:'', bannerT:0, pops:[], _sirT:0, _sirHi:false, _gravel:0,
      zi:-1, zb:null, zbT:0, skyA:null, skyB:null, skyMix:1, _scrape:0
    };
    for(var i=0;i<T.rivals;i++){
      var row = 1 + (i >> 1), col = (i & 1) ? 0.38 : -0.38;
      rs.rivals.push(rNewRival(i, T, R_START + row*520, col));
    }
    if(T.zones){ rs.zi = 0; rs.zb = T.zones[0]; rs.zbT = 4.5; }
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
    if(kind === 'busted') fine = Math.min(rSave.cash + rs.bonus, Math.round(400 * (T.tier + 1)));
    var gain = prize + rs.bonus;
    rSave.cash += gain - fine;
    rSave.earned += gain;
    if(kind === 'finish' && place <= 3 && rSave.unlocked < rs.trackIdx + 1 && rs.trackIdx + 1 < R_TRACKS.length){
      rSave.unlocked = rs.trackIdx + 1; unlockedNew = true;
    }
    if(kind === 'finish'){
      var old = rSave.rec[T.id];
      if(!old || place < old.place || (place === old.place && rs.time < old.time)){
        rSave.rec[T.id] = { place:place, time:+rs.time.toFixed(1) };
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
  function rMapSvg(T){
    if(T._svg) return T._svg;
    var pts = rRoute(T), h = '<svg class="rm-map" viewBox="0 0 100 100" aria-hidden="true">', i, st = 3;
    function P(i){ return (6 + pts[i][0]*88).toFixed(1) + ',' + (6 + pts[i][1]*88).toFixed(1); }
    var all = [];
    for(i=0;i<pts.length;i+=st) all.push(P(i));
    all.push(P(pts.length-1));
    h += '<polyline points="' + all.join(' ') + '" fill="none" stroke="#7d8aa0" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>';
    if(T.zones){
      for(var z=0;z<T.zones.length;z++){
        var Z = T.zones[z];
        if(!(Z.tun || Z.walls)) continue;
        var seg = [], a = Math.floor(Z.a/4), b = Math.min(pts.length-1, Math.floor(Z.b/4));
        for(i=a;i<=b;i+=2) seg.push(P(i));
        seg.push(P(b));
        h += '<polyline points="' + seg.join(' ') + '" fill="none" stroke="' + (Z.tun ? '#2b303c' : '#4aa3e0') + '" stroke-width="3" stroke-linejoin="round"' + (Z.tun ? ' stroke-dasharray="1.5 2.5"' : '') + '/>';
        if(Z.land) for(var l=0;l<Z.land.length;l++){
          var li = Math.floor((Z.a + Z.land[l].u*Z.len)/4); h += '<circle cx="' + P(li).split(',')[0] + '" cy="' + P(li).split(',')[1] + '" r="2.6" fill="#f0c030"/>';
        }
      }
      for(z=0;z<T.zones.length;z++){
        var Zq = T.zones[z];
        if(!Zq.land || Zq.tun || Zq.walls) continue;
        for(l=0;l<Zq.land.length;l++){ var lj = Math.floor((Zq.a + Zq.land[l].u*Zq.len)/4); h += '<circle cx="' + P(lj).split(',')[0] + '" cy="' + P(lj).split(',')[1] + '" r="2.6" fill="#f0c030"/>'; }
      }
    }
    var s0 = P(0).split(','), s1 = P(pts.length-1).split(',');
    h += '<circle cx="' + s0[0] + '" cy="' + s0[1] + '" r="3.6" fill="#2d9d94"/><circle cx="' + s1[0] + '" cy="' + s1[1] + '" r="3.6" fill="#e05a3f"/></svg>';
    T._svg = h;
    return h;
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
      var T = R_TRACKS[i], locked = i > rSave.unlocked, rec = rSave.rec[T.id];
      h += '<button class="rm-track' + (i === rSel ? ' sel' : '') + (locked ? ' lock' : '') + '"' +
           (locked ? ' disabled' : '') + ' onclick="AG3.rashTrack(' + i + ')">' +
           '<div class="rm-tx"><b>' + (locked ? '🔒 ' : '') + T.name + '</b>' +
           (T.blurb ? '<span>' + T.blurb + '</span>' : '') +
           '<span>' + (T.rivals + 1) + ' riders · ~' + Math.round(T.segs / 18 / 6) / 10 + ' min' +
           (T.cops ? ' · police' : '') + '</span>' +
           '<em>Prize ' + rMoney(T.prize[0]) + ' / ' + rMoney(T.prize[1]) + ' / ' + rMoney(T.prize[2]) + '</em>' +
           (rec ? '<i>Best: ' + rOrd(rec.place) + ' · ' + rTime(rec.time) + '</i>' : '') + '</div>' +
           rMapSvg(T) +
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
    h += '<p class="ag-hint">Arrows or WASD to ride. Z swings left, X swings right, Space swings at whoever is closest. P pauses. Top three win money and open the next road. Cars, trees and poles will throw you off, and barriers on the bridges and flyovers scrape off speed. Each city road has a route map in the corner.</p>';
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
      if(rs.zbT > 0) rs.zbT -= dt;
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
    if(rs.zbT > 0) rs.zbT -= dt;
    for(i=0;i<rs.pops.length;i++) rs.pops[i].t -= dt;
    while(rs.pops.length && rs.pops[0].t <= 0) rs.pops.shift();
    rs.lastHit += dt;

    /* --- player --- */
    var seg = rSeg(rs.pz);
    if(T.zones && seg.zn && seg.zn.i !== rs.zi){ rs.zi = seg.zn.i; rs.zb = seg.zn; rs.zbT = 3; }
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
      if(seg.zn && seg.zn.walls && Math.abs(rs.playerX) > 0.99){
        // A barrier: it holds you in, and it costs speed and paint.
        rs.playerX = Math.sign(rs.playerX)*0.99;
        if(rs.speed > 70 && !finishing){
          rs.speed -= rs.speed*0.9*dt;
          rs.shake = Math.max(rs.shake, 3);
          rs.hp -= 3*dt;
          rs._scrape -= dt;
          if(rs._scrape <= 0){ rSfx('crash'); rs._scrape = 0.5; }
          if(rs.hp <= 0){ rs.hp = 0; rWipe('fight'); }
        }
      }
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
        for(var k=0;k<3 && rs.state === 'ride';k++){
          var sg3 = rs.segs[(bi + k) % N], os = [sg3.sc, sg3.sc2];
          for(var oi=0;oi<2;oi++){
            var o = os[oi];
            if(o && Math.sign(rs.playerX) === o.side && Math.abs(rs.playerX) > o.off - 0.18){ rWipe('obj'); break; }
          }
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
      if(cdz > -200 && cdz < 260 && Math.abs(car.x - rs.playerX) < car.hw + 0.17 &&
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
      var look = Math.max(2400, 1800 + (r.speed - c.spd)*10);
      if(cd > 0 && cd < look && Math.abs(c.x - r.x) < c.hw + 0.28) want = c.x + (r.x >= c.x ? c.hw + 0.45 : -(c.hw + 0.45));
      // Not everyone sees the car in time.
      if(cd > -60 && cd < 300 && Math.abs(c.x - r.x) < c.hw + 0.13 && r.speed > c.spd + 20 && r.inv <= 0){
        r.state = 'down'; r.downT = 3.5 + Math.random(); r.weapon = null; r.z = c.z - 320;
        r.speed = Math.min(r.speed, 160); rSfx('crash');
        return;
      }
    }
    var dxm = rClamp(want - r.x, -1, 1);
    r.x += dxm * dt * (0.6 + 0.5*r.skill);
    r.x -= sg.curve * dt * (r.speed / r.top) * 0.30 * (1 - 0.5*r.skill);
    var lim = sg.zn && sg.zn.walls ? 0.96 : 1.05;
    r.x = rClamp(r.x, -lim, lim);
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
          var dmg = (6 + rs.track.tier*1.2 + r.skill*3) * (W ? W.mult : 1);
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
        rs.cop = { name:'COP', z:rs.pz - 5200, x:rClamp(rs.playerX, -0.7, 0.7), speed:B.top*0.9, top:B.top*1.04 + rs.track.tier*3,
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
    var cl = rSeg(c.z).zn, lim2 = cl && cl.walls ? 0.96 : 1.05;
    c.x = rClamp(c.x, -lim2, lim2);
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

  /* ── City skylines ─────────────────────────────────────────────────────
     Each one is painted once to a small canvas and then scrolled behind the
     road, so landmarks cost nothing per frame. */
  var SKW = 640, SKH = 150, R_SKY = {};
  function skBlocks(g, x0, x1, hmin, hmax, cols, rnd, win, wmin, wmax, base){
    var x = x0, b = base == null ? SKH : base, wa = wmin || 10, wb = wmax || 26;
    while(x < x1){
      var w = wa + rnd()*(wb - wa), h = hmin + rnd()*(hmax - hmin);
      g.fillStyle = cols[(rnd()*cols.length)|0];
      g.fillRect(x, b - h, w, h);
      if(win){
        for(var yy = b - h + 4; yy < b - 3; yy += 5){
          for(var xx = x + 2; xx < x + w - 2; xx += 4){
            if(rnd() < 0.42){
              g.fillStyle = typeof win === 'string' ? win : win[(rnd()*win.length)|0];
              g.fillRect(xx, yy, 2, 2);
            }
          }
        }
      }
      x += w + rnd()*2;
    }
  }
  function skHills(g, col, base, amp, f1, f2, ph){
    g.fillStyle = col;
    g.beginPath(); g.moveTo(0, SKH);
    for(var x=0; x<=SKW; x+=8){
      g.lineTo(x, SKH - base - amp*(0.55*Math.sin(x*f1 + ph) + 0.45*Math.sin(x*f2 + ph*1.7)));
    }
    g.lineTo(SKW, SKH); g.closePath(); g.fill();
  }
  function skSea(g, h, c1, c2){
    var gr = g.createLinearGradient(0, SKH - h, 0, SKH);
    gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    g.fillStyle = gr; g.fillRect(0, SKH - h, SKW, h);
  }
  function skPeaks(g, pts, base, col, cap){
    g.fillStyle = col;
    g.beginPath(); g.moveTo(pts[0][0] - 90, base);
    for(var i=0;i<pts.length;i++){ g.lineTo(pts[i][0] - 18, base - pts[i][1]*0.55); g.lineTo(pts[i][0], base - pts[i][1]); g.lineTo(pts[i][0] + 24, base - pts[i][1]*0.5); }
    g.lineTo(pts[pts.length-1][0] + 100, base); g.closePath(); g.fill();
    if(cap){
      g.fillStyle = cap;
      for(i=0;i<pts.length;i++){
        var px = pts[i][0], py = base - pts[i][1], d = pts[i][1]*0.3;
        g.beginPath(); g.moveTo(px, py); g.lineTo(px - d*0.55, py + d*0.9); g.lineTo(px - d*0.2, py + d*0.7);
        g.lineTo(px + d*0.05, py + d); g.lineTo(px + d*0.3, py + d*0.7); g.lineTo(px + d*0.62, py + d*0.8); g.closePath(); g.fill();
      }
    }
  }
  function skShell(g, x, b, w, h, col){
    g.fillStyle = col;
    g.beginPath(); g.moveTo(x, b);
    g.quadraticCurveTo(x + w*0.05, b - h*0.95, x + w*0.62, b - h);
    g.quadraticCurveTo(x + w*0.95, b - h*0.45, x + w, b);
    g.closePath(); g.fill();
  }

  var R_SKYP = {
    beach: function(g, lit, rnd){
      skHills(g, '#86b3a4', 60, 22, 0.012, 0.031, 1.2);
      skBlocks(g, 30, 170, 24, 62, ['#ece9e2','#dcd8cf','#cdc9c0'], rnd, '#7f93ab', 12, 22, SKH - 14);
      skHills(g, '#5f9a6c', 30, 14, 0.019, 0.047, 0.4);
      skSea(g, 20, '#4a96d4', '#2f78b8');
      g.fillStyle = 'rgba(255,255,255,.35)';
      for(var i=0;i<26;i++) g.fillRect((i*53)%SKW, SKH - 16 + (i%4)*4, 14 + (i%3)*8, 1);
    },
    cbd: function(g, lit, rnd){
      skBlocks(g, 0, SKW, 22, 100, ['#9fb2c4','#8fa4b8','#b9c6d2','#7f94aa','#c8d0d8'], rnd, '#4b6481', 12, 26);
      // Sydney Tower: a thin shaft with a golden turret
      g.fillStyle = '#c9ced6'; g.fillRect(449, SKH - 138, 3, 138);
      g.fillStyle = '#d8b04a'; g.beginPath(); g.ellipse(450.5, SKH - 108, 9, 6, 0, 0, 7); g.fill();
      g.fillRect(449.5, SKH - 150, 2, 14);
    },
    harbour: function(g, lit, rnd){
      skBlocks(g, 330, SKW, 16, 54, ['#a9b9c8','#94a8bb','#bcc8d3'], rnd, '#546c88', 12, 24, SKH - 14);
      // Harbour Bridge
      g.fillStyle = '#a39a86'; g.fillRect(358, SKH - 62, 9, 50); g.fillRect(596, SKH - 62, 9, 50);
      g.strokeStyle = '#59616d'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(362, SKH - 34); g.quadraticCurveTo(480, SKH - 150, 600, SKH - 34); g.stroke();
      g.lineWidth = 1.5;
      for(var hx = 376; hx < 590; hx += 11){
        var t = (hx - 362)/238, ay = (1 - t)*(1 - t)*(SKH - 34) + 2*t*(1 - t)*(SKH - 150) + t*t*(SKH - 34);
        g.beginPath(); g.moveTo(hx, ay); g.lineTo(hx, SKH - 30); g.stroke();
      }
      g.lineWidth = 4; g.beginPath(); g.moveTo(300, SKH - 30); g.lineTo(SKW, SKH - 30); g.stroke();
      // Opera House
      g.fillStyle = '#d9d3c4'; g.fillRect(40, SKH - 22, 190, 8);
      skShell(g, 50, SKH - 22, 70, 76, '#f6f3ec'); skShell(g, 98, SKH - 22, 56, 58, '#e2ddd0'); skShell(g, 134, SKH - 22, 44, 40, '#f6f3ec');
      skShell(g, 150, SKH - 22, 78, 64, '#ece8de'); skShell(g, 192, SKH - 22, 56, 44, '#f6f3ec');
      skSea(g, 14, '#3f8ccc', '#2c74b2');
    },
    hk: function(g, lit, rnd){
      skHills(g, '#171d3f', 96, 38, 0.011, 0.027, 0.8);
      skBlocks(g, 0, SKW, 30, 90, ['#1b2142','#212850','#171c38'], rnd, ['#6a7aa8','#8aa0c8'], 12, 26);
      skBlocks(g, 0, SKW, 24, 118, ['#242a52','#2a3160','#1e2446','#30386a'], rnd, ['#ffd36a','#ffe9a0','#9fe0ff','#ff9ac0'], 12, 24);
      // Bank of China Tower: stacked prisms
      var bx = 200;
      g.fillStyle = '#2d3566'; g.fillRect(bx, SKH - 128, 16, 128);
      g.fillStyle = '#3a4580'; g.fillRect(bx + 16, SKH - 100, 10, 100); g.fillRect(bx - 8, SKH - 84, 8, 84);
      g.strokeStyle = '#aab6e6'; g.lineWidth = 1;
      for(var k=0;k<5;k++){ g.beginPath(); g.moveTo(bx, SKH - 128 + k*26); g.lineTo(bx + 16, SKH - 102 + k*26); g.stroke(); }
      g.fillStyle = '#e8eeff'; g.fillRect(bx + 7, SKH - 146, 2, 18);
      // IFC: a slim tapered tower
      g.fillStyle = '#2f3a74';
      g.beginPath(); g.moveTo(420, SKH); g.lineTo(424, SKH - 142); g.lineTo(430, SKH - 150); g.lineTo(436, SKH - 142); g.lineTo(440, SKH); g.closePath(); g.fill();
      g.fillStyle = 'rgba(180,200,255,.5)'; g.fillRect(430, SKH - 148, 1, 140);
      var neon = ['#ff3d71','#35e0ff','#ffd23d','#c76bff'];
      for(var n=0;n<22;n++){ g.fillStyle = neon[n%4]; g.globalAlpha = 0.85; g.fillRect((n*29 + 11)%SKW, SKH - 40 - ((n*17)%60), 3, 5); }
      g.globalAlpha = 1;
    },
    hkharbour: function(g, lit, rnd){
      skHills(g, '#171d3f', 70, 24, 0.012, 0.03, 2.2);
      skBlocks(g, 0, SKW, 20, 82, ['#242a52','#2a3160','#1e2446','#30386a'], rnd, ['#ffd36a','#ffe9a0','#9fe0ff','#ff9ac0'], 12, 24, SKH - 22);
      skSea(g, 24, '#0e2a52', '#08142e');
      var neon = ['#ff3d71','#35e0ff','#ffd23d','#c76bff'];
      for(var n=0;n<46;n++){ g.fillStyle = neon[n%4]; g.globalAlpha = 0.45; g.fillRect((n*47 + 5)%SKW, SKH - 22 + (n%5)*4, 2, 9); }
      g.globalAlpha = 1;
    },
    hills: function(g, lit, rnd){
      skHills(g, '#26345f', 92, 30, 0.009, 0.02, 0.6);
      skHills(g, '#1a3a4c', 58, 24, 0.013, 0.033, 2.9);
      skHills(g, '#12301f', 26, 16, 0.02, 0.05, 1.1);
      skSea(g, 12, '#0e2a52', '#08142e');
    },
    pudong: function(g, lit, rnd){
      skBlocks(g, 0, SKW, 22, 74, ['#4b5079','#575c86','#40456b'], rnd, '#ffd98a', 10, 22, SKH - 12);
      // Oriental Pearl
      g.fillStyle = '#8a7fa8'; g.fillRect(124, SKH - 96, 3, 90);
      g.strokeStyle = '#8a7fa8'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(112, SKH - 12); g.lineTo(122, SKH - 64); g.moveTo(140, SKH - 12); g.lineTo(130, SKH - 64); g.stroke();
      var pr = g.createRadialGradient(123, SKH - 70, 2, 125, SKH - 66, 12);
      pr.addColorStop(0, '#ffc8e8'); pr.addColorStop(1, '#c0509c');
      g.fillStyle = pr; g.beginPath(); g.arc(125.5, SKH - 66, 11, 0, 7); g.fill();
      g.beginPath(); g.arc(125.5, SKH - 100, 6, 0, 7); g.fillStyle = '#d870b4'; g.fill();
      g.fillStyle = '#c8bfe0'; g.fillRect(125, SKH - 130, 1.5, 24);
      // Jin Mao: stepped
      var jx = 250;
      for(var s=0;s<8;s++){ g.fillStyle = s%2 ? '#6a6f9a' : '#7a80aa'; var w = 22 - s*2; g.fillRect(jx + (22 - w)/2, SKH - 20 - s*13, w, 14); }
      g.fillRect(jx + 10, SKH - 140, 2, 22);
      // SWFC: the bottle opener
      g.fillStyle = '#5a608c'; g.beginPath(); g.moveTo(330, SKH - 12); g.lineTo(332, SKH - 128); g.lineTo(358, SKH - 128); g.lineTo(362, SKH - 12); g.closePath(); g.fill();
      g.fillStyle = '#c9a8c4'; g.beginPath(); g.ellipse(345, SKH - 112, 6, 7, 0, 0, 7); g.fill();
      // Shanghai Tower: a twisting taper
      g.fillStyle = '#4a5080'; g.beginPath(); g.moveTo(398, SKH - 12); g.quadraticCurveTo(404, SKH - 90, 412, SKH - 150);
      g.quadraticCurveTo(424, SKH - 90, 432, SKH - 12); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,217,138,.5)'; for(var q=0;q<12;q++) g.fillRect(410 + (q%2)*5, SKH - 20 - q*10, 2, 3);
      skBlocks(g, 440, SKW, 24, 90, ['#4b5079','#575c86','#40456b'], rnd, '#ffd98a', 10, 22, SKH - 12);
      skSea(g, 12, '#59628a', '#3a4166');
      g.fillStyle = 'rgba(255,230,180,.4)'; for(var i=0;i<30;i++) g.fillRect((i*37)%SKW, SKH - 10 + (i%3)*3, 10, 1);
    },
    oldsh: function(g, lit, rnd){
      skBlocks(g, 0, SKW, 20, 66, ['#50557c','#5b6088','#454a70'], rnd, '#ffd98a', 10, 20, SKH - 24);
      var x = 0;
      while(x < SKW){
        var w = 34 + rnd()*30, h = 14 + rnd()*14;
        g.fillStyle = rnd() < 0.5 ? '#2c2a44' : '#38355a';
        g.beginPath(); g.moveTo(x - 5, SKH - 22 - h*0.4); g.quadraticCurveTo(x + 2, SKH - 22 - h*0.3, x + w*0.15, SKH - 22 - h);
        g.lineTo(x + w*0.85, SKH - 22 - h); g.quadraticCurveTo(x + w - 2, SKH - 22 - h*0.3, x + w + 5, SKH - 22 - h*0.4);
        g.lineTo(x + w, SKH - 22); g.lineTo(x, SKH - 22); g.closePath(); g.fill();
        x += w + 4 + rnd()*10;
      }
      g.fillStyle = '#2c2a44'; g.fillRect(0, SKH - 22, SKW, 22);
      for(var t=0;t<5;t++){ g.fillStyle = '#3a3760'; g.fillRect(500 - (14 - t*2), SKH - 40 - t*13, 28 - t*4, 10); }
    },
    ktm: function(g, lit, rnd){
      skPeaks(g, [[90,120],[210,150],[340,130],[470,160],[590,118]], SKH - 36, '#a9b8cc', '#f4f6fa');
      skHills(g, '#7d8f78', 46, 20, 0.014, 0.035, 0.9);
      var cols = ['#a24a36','#8d4030','#b5573f','#c9a27a','#d8d0c0'];
      for(var i=0;i<130;i++){
        var hx = rnd()*SKW, hy = SKH - 22 - rnd()*30;
        g.fillStyle = cols[(rnd()*cols.length)|0]; g.fillRect(hx, hy, 4 + rnd()*4, 3 + rnd()*3);
      }
      skHills(g, '#5f7a52', 16, 10, 0.03, 0.07, 2.1);
      // Swayambhunath on its hill
      g.fillStyle = '#f2efe6'; g.beginPath(); g.arc(380, SKH - 58, 11, Math.PI, 0); g.fill();
      g.fillStyle = '#d8b04a'; g.fillRect(377, SKH - 74, 6, 7);
      g.beginPath(); g.moveTo(376, SKH - 74); g.lineTo(380, SKH - 98); g.lineTo(384, SKH - 74); g.closePath(); g.fill();
    },
    himal: function(g, lit, rnd){
      skPeaks(g, [[60,140],[170,118],[280,148],[400,126],[520,146],[610,120]], SKH - 28, '#aab9cd', '#f6f8fc');
      skPeaks(g, [[120,92],[330,100],[470,86]], SKH - 20, '#8094ac', '#e4ebf4');
      skHills(g, '#7d8f78', 30, 16, 0.016, 0.04, 1.4);
      skHills(g, '#5f7a52', 12, 8, 0.03, 0.07, 0.2);
    },
    ub: function(g, lit, rnd){
      skHills(g, '#95a995', 92, 26, 0.009, 0.022, 0.4);
      for(var i=0;i<60;i++){ g.fillStyle = '#f2efe6'; g.fillRect(rnd()*SKW, SKH - 44 - rnd()*30, 3, 2); }
      skBlocks(g, 0, SKW, 22, 64, ['#b9b2a4','#a8a69c','#c8c0b0','#9c9a92'], rnd, '#58687e', 12, 24, SKH - 8);
      // Blue Sky Tower: a curved sail of glass
      var bg = g.createLinearGradient(300, 0, 330, 0);
      bg.addColorStop(0, '#6fb4f0'); bg.addColorStop(1, '#2c68b4');
      g.fillStyle = bg; g.beginPath(); g.moveTo(300, SKH - 8); g.lineTo(300, SKH - 108);
      g.quadraticCurveTo(318, SKH - 90, 332, SKH - 8); g.closePath(); g.fill();
      // power plant chimneys and smoke
      g.fillStyle = '#c85a4a'; g.fillRect(470, SKH - 100, 7, 92); g.fillRect(512, SKH - 112, 7, 104);
      g.fillStyle = '#f0ece0'; for(var s=0;s<4;s++){ g.fillRect(470, SKH - 98 + s*22, 7, 5); g.fillRect(512, SKH - 110 + s*24, 7, 5); }
      g.fillStyle = 'rgba(210,206,200,.55)';
      for(var p=0;p<7;p++){ g.beginPath(); g.ellipse(478 + p*13, SKH - 108 - p*3, 9 + p*2, 6 + p, 0, 0, 7); g.fill(); }
      for(var p2=0;p2<7;p2++){ g.beginPath(); g.ellipse(520 + p2*12, SKH - 120 - p2*3, 9 + p2*2, 6 + p2, 0, 0, 7); g.fill(); }
    },
    steppe: function(g, lit, rnd){
      skHills(g, '#8aa0bc', 64, 24, 0.008, 0.02, 1.9);
      skHills(g, '#a8b27c', 36, 16, 0.012, 0.03, 0.3);
      skHills(g, '#b4b070', 14, 10, 0.02, 0.05, 2.4);
      for(var i=0;i<14;i++){ g.fillStyle = '#f2efe6'; g.beginPath(); g.arc(30 + i*45 + rnd()*20, SKH - 14 - rnd()*18, 2.2, Math.PI, 0); g.fill(); }
    }
  };
  function rSkyCanvas(key){
    if(R_SKY[key]) return R_SKY[key];
    var cv = document.createElement('canvas'); cv.width = SKW; cv.height = SKH;
    var g = cv.getContext('2d'), P = R_SKYP[key];
    if(P && g) P(g, true, rRng(key.length*977 + key.charCodeAt(0)));
    R_SKY[key] = cv;
    return cv;
  }
  /* ── Barriers, tunnels and overhead structures ─────────────────────── */
  function rWall(g, p0, p1, side, band, col){
    var x0 = p0.sx + side*1.1*p0.sw*0.5, x1 = p1.sx + side*1.1*p1.sw*0.5;
    var h0 = 330*p0.sc, h1 = 330*p1.sc, y0 = p0.sy + 1;
    g.fillStyle = col;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, p1.sy); g.lineTo(x1, p1.sy - h1); g.lineTo(x0, y0 - h0); g.closePath(); g.fill();
    if(!band){ g.fillStyle = 'rgba(0,0,0,.14)'; g.fill(); }
    g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = Math.max(1, 26*p1.sc);
    g.beginPath(); g.moveTo(x0, y0 - h0); g.lineTo(x1, p1.sy - h1); g.stroke();
  }
  function rTunnel(g, p0, p1, band, idx){
    var hw0 = 1.1*p0.sw*0.5, hw1 = 1.1*p1.sw*0.5, y0 = p0.sy + 1;
    var c0 = p0.sy - 700*p0.sc, c1 = p1.sy - 700*p1.sc;
    g.fillStyle = band ? '#454a55' : '#3b404a';
    g.beginPath(); g.moveTo(p0.sx - hw0, y0); g.lineTo(p1.sx - hw1, p1.sy); g.lineTo(p1.sx - hw1, c1); g.lineTo(p0.sx - hw0, c0); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(p0.sx + hw0, y0); g.lineTo(p1.sx + hw1, p1.sy); g.lineTo(p1.sx + hw1, c1); g.lineTo(p0.sx + hw0, c0); g.closePath(); g.fill();
    g.fillStyle = band ? '#272a32' : '#20232a';
    g.beginPath(); g.moveTo(p0.sx - hw0, c0); g.lineTo(p0.sx + hw0, c0); g.lineTo(p1.sx + hw1, c1); g.lineTo(p1.sx - hw1, c1); g.closePath(); g.fill();
    // lamp strips on the ceiling and a light band along the walls
    if(idx % 4 < 2){
      g.fillStyle = 'rgba(255,244,200,.95)';
      var l0 = p0.sw*0.5*0.12, l1 = p1.sw*0.5*0.12, cy0 = c0 + 18*p0.sc, cy1 = c1 + 18*p1.sc;
      g.beginPath(); g.moveTo(p0.sx - l0, cy0); g.lineTo(p0.sx + l0, cy0); g.lineTo(p1.sx + l1, cy1); g.lineTo(p1.sx - l1, cy1); g.closePath(); g.fill();
    }
    g.fillStyle = 'rgba(255,214,120,.55)';
    var b0 = 230*p0.sc, b1 = 230*p1.sc, t0 = 40*p0.sc, t1 = 40*p1.sc;
    g.beginPath(); g.moveTo(p0.sx - hw0, y0 - b0); g.lineTo(p1.sx - hw1, p1.sy - b1); g.lineTo(p1.sx - hw1, p1.sy - b1 - t1); g.lineTo(p0.sx - hw0, y0 - b0 - t0); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(p0.sx + hw0, y0 - b0); g.lineTo(p1.sx + hw1, p1.sy - b1); g.lineTo(p1.sx + hw1, p1.sy - b1 - t1); g.lineTo(p0.sx + hw0, y0 - b0 - t0); g.closePath(); g.fill();
  }
  /* The face of the hill the tunnel goes into. */
  function rPortal(g, p, W){
    var hw = 1.1*p.sw*0.5, c = p.sy - 700*p.sc, y0 = p.sy + 1, x0 = p.sx - hw, x1 = p.sx + hw;
    var gr = g.createLinearGradient(0, 0, 0, y0);
    gr.addColorStop(0, '#4e555f'); gr.addColorStop(1, '#7b808a');
    g.fillStyle = gr;
    g.beginPath();
    g.rect(-8, -8, W + 16, y0 + 8);
    g.moveTo(x0, y0); g.lineTo(x0, c); g.lineTo(x1, c); g.lineTo(x1, y0); g.closePath();
    g.fill('evenodd');
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = Math.max(2, 50*p.sc);
    g.strokeRect(x0, c, x1 - x0, y0 - c);
  }

  var R_NEON = ['#ff3d71','#35e0ff','#ffd23d','#7dff6b','#c76bff'];
  var R_FLAGS = ['#2f6fd0','#f2f2f2','#d8352c','#2f9a52','#f0c030'];
  function rDeco(g, d, p, n){
    var sc = p.sc, hw = p.sw*0.5, x = p.sx, y = p.sy, t = d.t, i, k;
    if(hw < 18) return;
    g.save();
    if(t === 'truss'){
      var H = (650 + 700*Math.sin(Math.PI*d.u))*sc, px = 1.14*hw;
      g.strokeStyle = d.col || '#7b838f'; g.lineWidth = Math.max(1.5, 36*sc);
      g.beginPath(); g.moveTo(x - px, y); g.lineTo(x - px, y - H); g.lineTo(x + px, y - H); g.lineTo(x + px, y); g.stroke();
      g.lineWidth = Math.max(1, 20*sc);
      g.beginPath();
      g.moveTo(x - px, y - H*0.45); g.lineTo(x - px*0.45, y - H); g.moveTo(x + px, y - H*0.45); g.lineTo(x + px*0.45, y - H);
      g.moveTo(x - px, y - H*0.1); g.lineTo(x - px*0.55, y - H*0.55); g.moveTo(x + px, y - H*0.1); g.lineTo(x + px*0.55, y - H*0.55);
      g.stroke();
    }else if(t === 'neon'){
      var col = R_NEON[(d.v*5)|0], sd = d.side, bw = 0.32*hw, bh = 0.9*hw, bx = x + sd*0.78*hw - bw/2, by = y - 1.75*hw;
      g.strokeStyle = '#4a4f5a'; g.lineWidth = Math.max(1, 30*sc);
      g.beginPath(); g.moveTo(x + sd*1.3*hw, by + bh*0.15); g.lineTo(bx + bw/2, by + bh*0.15); g.stroke();
      g.fillStyle = col; g.globalAlpha = 0.22; g.fillRect(bx - bw*0.25, by - bh*0.08, bw*1.5, bh*1.16);
      g.globalAlpha = 1; g.fillStyle = '#16181f'; g.fillRect(bx, by, bw, bh);
      g.strokeStyle = col; g.lineWidth = Math.max(1.2, 46*sc);
      g.strokeRect(bx + bw*0.08, by + bh*0.04, bw*0.84, bh*0.92);
      g.fillStyle = col;
      for(i=0;i<4;i++){ g.fillRect(bx + bw*(0.2 + (i%2)*0.3), by + bh*(0.14 + i*0.2), bw*0.4, bh*0.1); }
    }else if(t === 'lantern'){
      var top = y - 1.9*hw, sag = 0.28*hw;
      g.strokeStyle = '#3a2a22'; g.lineWidth = Math.max(1, 34*sc);
      g.beginPath(); g.moveTo(x - 1.22*hw, y); g.lineTo(x - 1.22*hw, top); g.moveTo(x + 1.22*hw, y); g.lineTo(x + 1.22*hw, top); g.stroke();
      g.lineWidth = Math.max(1, 14*sc);
      g.beginPath(); g.moveTo(x - 1.22*hw, top); g.quadraticCurveTo(x, top + sag*2, x + 1.22*hw, top); g.stroke();
      for(i=0;i<7;i++){
        var u = i/6, lx = x - 1.22*hw + u*2.44*hw, ly = top + sag*2*u*(1 - u)*2 + 0.1*hw;
        g.fillStyle = 'rgba(255,90,60,.28)'; g.beginPath(); g.arc(lx, ly + 0.1*hw, 0.2*hw, 0, 7); g.fill();
        g.fillStyle = '#d8352c'; g.beginPath(); g.ellipse(lx, ly + 0.1*hw, 0.11*hw, 0.14*hw, 0, 0, 7); g.fill();
        g.fillStyle = '#f0c030'; g.fillRect(lx - 0.07*hw, ly - 0.04*hw, 0.14*hw, 0.04*hw);
      }
    }else if(t === 'flags'){
      var pal = d.pal || R_FLAGS;
      for(k=0;k<2;k++){
        var ya = y - (k ? 2.35 : 1.8)*hw, yb = y - (k ? 1.85 : 2.3)*hw, sg = 0.22*hw;
        g.strokeStyle = '#3a3030'; g.lineWidth = Math.max(1, 10*sc);
        g.beginPath(); g.moveTo(x - 1.4*hw, ya); g.quadraticCurveTo(x, (ya + yb)/2 + sg*2, x + 1.4*hw, yb); g.stroke();
        for(i=0;i<15;i++){
          var u2 = (i + 0.5)/15, fx = x - 1.4*hw + u2*2.8*hw, fy = ya + (yb - ya)*u2 + sg*4*u2*(1 - u2);
          g.fillStyle = pal[(i + k*2) % pal.length];
          g.fillRect(fx - 0.075*hw, fy, 0.15*hw, 0.19*hw);
        }
      }
    }else if(t === 'stay'){
      var sx2 = x + d.side*1.28*hw, topY = y - 4.6*hw;
      g.strokeStyle = d.col || '#d8d8e0'; g.lineWidth = Math.max(2, 90*sc);
      g.beginPath(); g.moveTo(sx2, y); g.lineTo(sx2, topY); g.stroke();
      g.lineWidth = Math.max(1, 14*sc);
      var ks = [-20,-15,-10,-6,6,10,15,20];
      g.beginPath();
      for(i=0;i<ks.length;i++){
        var q = rs.proj[n + ks[i]];
        if(!q || q.sc < 0.012) continue;
        var ft = 1 - Math.abs(ks[i])/24;
        g.moveTo(sx2, topY + 0.35*hw*(1 - ft)); g.lineTo(q.sx + d.side*1.12*q.sw*0.5, q.sy - 340*q.sc);
      }
      g.stroke();
    }else if(t === 'gate'){
      var gy = y - 2.1*hw;
      g.fillStyle = '#b8322a';
      g.fillRect(x - 1.25*hw, gy, 0.16*hw, 2.1*hw); g.fillRect(x + 1.09*hw, gy, 0.16*hw, 2.1*hw);
      g.fillRect(x - 1.25*hw, gy, 2.5*hw, 0.2*hw);
      g.fillStyle = '#f0c030'; g.fillRect(x - 0.5*hw, gy + 0.03*hw, hw, 0.14*hw);
      g.fillStyle = '#2f6b52';
      g.beginPath(); g.moveTo(x - 1.7*hw, gy - 0.1*hw); g.quadraticCurveTo(x - 1.5*hw, gy - 0.1*hw, x - 1.2*hw, gy - 0.5*hw);
      g.lineTo(x + 1.2*hw, gy - 0.5*hw); g.quadraticCurveTo(x + 1.5*hw, gy - 0.1*hw, x + 1.7*hw, gy - 0.1*hw);
      g.lineTo(x + 1.3*hw, gy + 0.04*hw); g.lineTo(x - 1.3*hw, gy + 0.04*hw); g.closePath(); g.fill();
      g.fillStyle = '#f0c030'; g.fillRect(x - 1.2*hw, gy - 0.54*hw, 2.4*hw, 0.05*hw);
    }
    g.restore();
  }
  /* ── City roadside objects ─────────────────────────────────────────────
     Drawn at (0,0) = the foot of the object, s = one road half-width in
     pixels at that distance. Buildings are anchored by their near edge so
     they never overlap the road. */
  function rWin(g, w, h, rows, cols, v, lit, dark, glow){
    if(h < 24 || w < 12 || rows < 1) return;
    g.lineCap = 'butt';
    var rh = h/(rows + 1.2), cw = w/(cols*2 + 1), x0 = -w/2 + cw, x1 = w/2 - cw*0.9;
    g.lineWidth = Math.max(1, rh*0.46);
    g.setLineDash([cw, cw]);
    for(var r=0;r<rows;r++){
      var yy = -h + rh*(r + 0.9);
      g.strokeStyle = dark; g.lineDashOffset = 0;
      g.beginPath(); g.moveTo(x0, yy); g.lineTo(x1, yy); g.stroke();
      if(lit){
        g.strokeStyle = glow;
        g.setLineDash([cw, cw*(1 + ((r*7 + ((v*97)|0)) % 4))]);
        g.lineDashOffset = -(((r*13 + ((v*53)|0)) % 5)*cw);
        g.beginPath(); g.moveTo(x0, yy); g.lineTo(x1, yy); g.stroke();
        g.setLineDash([cw, cw]);
      }
    }
    g.setLineDash([]);
  }
  var TW_D = ['#9aa8b8','#b9c2cc','#7f8fa3','#c9c4b8','#6f7f93'], TW_N = ['#232a44','#2b2f4d','#1d2440','#33304f'];
  var TN_D = ['#c7b79a','#b9ad94','#a8b0a6','#d4c4a4','#9ea8a0'], TN_N = ['#3a3a4c','#33364a','#403b4a','#2f3446'];

  function rCityObj(g, o, s, lit){
    var t = o.type, v = o.v, v2 = (v*13.7)%1, v3 = (v*7.3)%1, side = o.side, w, h, i, k;
    if(t === 'tower' || t === 'tenement'){
      var tn = t === 'tenement';
      w = s*(tn ? 1.3 + v : 1.2 + v*0.9); h = s*(tn ? 2.4 + v2*2.2 : 3.4 + v2*4.6);
      g.translate(side*w/2, 0);
      g.fillStyle = lit ? (tn ? TN_N : TW_N)[(v*4)|0] : (tn ? TN_D : TW_D)[(v*5)|0];
      g.fillRect(-w/2, -h, w, h);
      g.fillStyle = 'rgba(0,0,0,.17)'; g.fillRect(w*0.16, -h, w*0.34, h);
      if(!tn){ g.fillStyle = lit ? '#2a2f50' : '#8fa0b2'; g.fillRect(-w*0.3, -h*1.1, w*0.6, h*0.1 + 1); g.fillRect(-1, -h*1.1 - s*0.5, 2, s*0.5); }
      rWin(g, w, h, Math.min(16, (h/(s*(tn ? 0.3 : 0.42)))|0), tn ? 4 : 3 + (v3 > .5 ? 1 : 0), v, lit, lit ? '#141a30' : '#34465e', v3 > .6 ? '#9fe0ff' : '#ffd98a');
      if(tn){ // neon sign over the road, and a rooftop water tank
        var nc = R_NEON[(v3*5)|0], ix = side > 0 ? -s*0.3 : 0;
        g.fillStyle = lit ? nc : '#c0392b'; g.fillRect(ix, -h*0.62, s*0.3, h*0.26);
        g.fillStyle = '#fff'; g.globalAlpha = 0.7; g.fillRect(ix + s*0.07, -h*0.58, s*0.16, h*0.04); g.fillRect(ix + s*0.07, -h*0.5, s*0.16, h*0.04); g.globalAlpha = 1;
        g.fillStyle = '#6c7078'; g.fillRect(-w*0.25, -h - s*0.22, w*0.3, s*0.22);
      }
    }else if(t === 'shop'){
      w = s*(1.2 + v*0.8); h = s*(0.9 + v2*0.5);
      g.translate(side*w/2, 0);
      var sh = lit ? ['#4a3a4a','#3a4a4e','#4e4238','#40384e'] : ['#d4a24c','#c96a4a','#6aa3a0','#d8d0b8','#a96ab0'];
      g.fillStyle = sh[(v*4)|0]; g.fillRect(-w/2, -h, w, h);
      g.fillStyle = lit ? '#ffcf70' : '#9bb4c4'; g.fillRect(-w*0.4, -h*0.62, w*0.8, h*0.42);
      g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(-w*0.4, -h*0.62, w*0.8, h*0.06);
      for(i=0;i<6;i++){ g.fillStyle = i%2 ? '#f2f2f2' : R_NEON[(v3*5)|0]; g.fillRect(-w/2 + i*w/6, -h*0.82, w/6, h*0.2); }
    }else if(t === 'terrace'){
      w = s*1.5; h = s*(1.5 + v2*0.3);
      g.translate(side*w/2, 0);
      g.fillStyle = v > .5 ? '#b5654a' : '#d8cfb8'; g.fillRect(-w/2, -h, w, h);
      g.fillStyle = '#4a4650'; g.beginPath(); g.moveTo(-w*0.55, -h); g.lineTo(0, -h - s*0.4); g.lineTo(w*0.55, -h); g.closePath(); g.fill();
      rWin(g, w, h*0.95, 2, 2, v, false, '#34465e', '#fff');
      g.strokeStyle = '#2d2d34'; g.lineWidth = Math.max(1, s*0.03);
      g.beginPath(); g.moveTo(-w/2, -h*0.5); g.lineTo(w/2, -h*0.5); g.stroke();
      for(i=0;i<8;i++){ g.beginPath(); g.moveTo(-w/2 + i*w/7, -h*0.5); g.lineTo(-w/2 + i*w/7, -h*0.38); g.stroke(); }
    }else if(t === 'colonial'){
      w = s*2.1; h = s*(2.1 + v*1.4);
      g.translate(side*w/2, 0);
      g.fillStyle = lit ? '#8a8396' : '#cfc3a8'; g.fillRect(-w/2, -h, w, h);
      g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(w*0.16, -h, w*0.34, h);
      g.fillStyle = lit ? '#6f6a80' : '#e4dac2'; g.fillRect(-w/2 - 2, -h, w + 4, h*0.06);
      for(i=0;i<6;i++){ g.fillStyle = lit ? '#9c96aa' : '#dcd2ba'; g.fillRect(-w/2 + w*(0.08 + i*0.16), -h*0.92, w*0.06, h*0.8); }
      rWin(g, w*0.9, h*0.8, Math.min(8, (h/(s*0.5))|0), 4, v, lit, lit ? '#1c2038' : '#5c6c80', '#ffd98a');
      if(v2 > .55){ g.fillStyle = lit ? '#5a6a60' : '#6f9a84'; g.beginPath(); g.ellipse(0, -h - s*0.1, w*0.22, s*0.38, 0, Math.PI, 0); g.fill(); g.fillRect(-1, -h - s*0.6, 2, s*0.3); }
    }else if(t === 'shikumen'){
      w = s*1.5; h = s*1.1;
      g.translate(side*w/2, 0);
      g.fillStyle = lit ? '#585a68' : '#868a8f'; g.fillRect(-w/2, -h, w, h);
      g.fillStyle = lit ? '#2a2c3a' : '#3b3f46';
      g.beginPath(); g.moveTo(-w*0.58, -h); g.quadraticCurveTo(-w*0.5, -h - s*0.1, -w*0.4, -h - s*0.35); g.lineTo(w*0.4, -h - s*0.35); g.quadraticCurveTo(w*0.5, -h - s*0.1, w*0.58, -h); g.closePath(); g.fill();
      g.fillStyle = lit ? '#161820' : '#2a2c32'; g.beginPath(); g.moveTo(-w*0.14, 0); g.lineTo(-w*0.14, -h*0.5); g.quadraticCurveTo(0, -h*0.75, w*0.14, -h*0.5); g.lineTo(w*0.14, 0); g.fill();
      g.strokeStyle = lit ? '#b8b4c8' : '#f0eee8'; g.lineWidth = Math.max(1, s*0.035);
      g.beginPath(); g.moveTo(-w*0.18, 0); g.lineTo(-w*0.18, -h*0.5); g.quadraticCurveTo(0, -h*0.82, w*0.18, -h*0.5); g.lineTo(w*0.18, 0); g.stroke();
      if(lit){ g.fillStyle = '#ffd98a'; g.fillRect(-w*0.4, -h*0.7, w*0.14, h*0.22); g.fillRect(w*0.26, -h*0.7, w*0.14, h*0.22); }
    }else if(t === 'brick'){
      w = s*(1.1 + v*0.7); h = s*(1.7 + v2*1.5);
      g.translate(side*w/2, 0);
      g.fillStyle = ['#a24a36','#8d4030','#b5573f','#a85a3c'][(v*4)|0]; g.fillRect(-w/2, -h, w, h);
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(w*0.16, -h, w*0.34, h);
      g.fillStyle = '#6a3a28'; g.fillRect(-w/2 - 2, -h - s*0.06, w + 4, s*0.08);
      rWin(g, w, h, Math.min(8, (h/(s*0.5))|0), 2, v, false, '#4a2e1c', '#fff');
      g.fillStyle = '#5a6068'; g.fillRect(-w*0.3, -h - s*0.26, w*0.36, s*0.2);
      g.strokeStyle = '#1c1c20'; g.lineWidth = Math.max(1, s*0.02);
      g.beginPath(); g.moveTo(-side*w/2, -h*0.8); g.quadraticCurveTo(-side*(w/2 + s*0.4), -h*0.7, -side*(w/2 + s*0.7), -h*0.9); g.stroke();
    }else if(t === 'pagoda'){
      w = s*1.8; var tier = s*0.62;
      g.translate(side*w/2, 0);
      for(i=0;i<3;i++){
        var bw = w*(0.78 - i*0.17), by = -(i*tier*1.55);
        g.fillStyle = '#a24a36'; g.fillRect(-bw/2, by - tier, bw, tier);
        g.fillStyle = '#3a2a1c'; g.fillRect(-bw*0.18, by - tier*0.8, bw*0.14, tier*0.5); g.fillRect(bw*0.05, by - tier*0.8, bw*0.14, tier*0.5);
        g.fillStyle = '#5b3a24';
        g.beginPath(); g.moveTo(-bw*0.78, by - tier*0.95); g.lineTo(-bw*0.5, by - tier*1.5); g.lineTo(bw*0.5, by - tier*1.5); g.lineTo(bw*0.78, by - tier*0.95); g.lineTo(bw*0.5, by - tier); g.lineTo(-bw*0.5, by - tier); g.closePath(); g.fill();
        g.fillStyle = '#d8b04a'; g.fillRect(-bw*0.78, by - tier*1.0, bw*1.56, tier*0.06);
      }
      g.fillStyle = '#d8b04a'; g.fillRect(-s*0.025, -tier*4.9, s*0.05, tier*0.9); g.beginPath(); g.arc(0, -tier*4.95, s*0.07, 0, 7); g.fill();
    }else if(t === 'temple'){
      w = s*1.9; h = s*0.9;
      g.translate(side*w/2, 0);
      g.fillStyle = '#efe9db'; g.fillRect(-w/2, -h, w, h);
      g.fillStyle = '#b8322a'; g.fillRect(-w/2, -h*0.62, w, h*0.14);
      g.fillStyle = '#8a2a22'; g.fillRect(-w*0.12, -h*0.55, w*0.24, h*0.55);
      g.fillStyle = '#d8b04a';
      g.beginPath(); g.moveTo(-w*0.62, -h); g.quadraticCurveTo(-w*0.4, -h*1.05, -w*0.32, -h*1.45); g.lineTo(w*0.32, -h*1.45); g.quadraticCurveTo(w*0.4, -h*1.05, w*0.62, -h); g.closePath(); g.fill();
      g.fillStyle = '#b8902e'; g.fillRect(-w*0.62, -h*1.03, w*1.24, h*0.05);
      g.fillStyle = '#d8b04a'; g.fillRect(-s*0.02, -h*1.45 - s*0.3, s*0.04, s*0.3);
    }else if(t === 'stupa'){
      var sz = o.big ? 1.7 : 1.0, dw = s*3.0*sz, dh = s*1.5*sz;
      g.translate(side*dw/2, 0);
      g.fillStyle = '#e8e3d4'; g.fillRect(-dw*0.58, -s*0.18*sz, dw*1.16, s*0.18*sz); g.fillRect(-dw*0.52, -s*0.34*sz, dw*1.04, s*0.16*sz);
      g.fillStyle = '#f6f3ea'; g.beginPath(); g.ellipse(0, -s*0.34*sz, dw*0.5, dh, 0, Math.PI, 0); g.fill();
      g.fillStyle = 'rgba(0,0,0,.1)'; g.beginPath(); g.ellipse(dw*0.14, -s*0.34*sz, dw*0.36, dh*0.96, 0, Math.PI*1.5, 0); g.fill();
      var hy = -s*0.34*sz - dh;
      g.fillStyle = '#d8b04a'; g.fillRect(-dw*0.15, hy - s*0.42*sz, dw*0.3, s*0.42*sz);
      g.fillStyle = '#1c1c24'; g.fillRect(-dw*0.11, hy - s*0.3*sz, dw*0.07, s*0.06*sz); g.fillRect(dw*0.04, hy - s*0.3*sz, dw*0.07, s*0.06*sz);
      g.fillStyle = '#b8322a'; g.fillRect(-dw*0.02, hy - s*0.24*sz, dw*0.04, s*0.1*sz);
      for(i=0;i<7;i++){ var sw2 = dw*(0.12 - i*0.012); g.fillStyle = '#d8b04a'; g.fillRect(-sw2, hy - s*0.42*sz - (i+1)*s*0.09*sz, sw2*2, s*0.075*sz); }
      g.fillStyle = '#d8b04a'; g.fillRect(-s*0.02, hy - s*1.3*sz, s*0.04, s*0.2*sz);
      var fp = R_FLAGS;
      g.lineWidth = Math.max(1, s*0.02);
      for(i=0;i<5;i++){
        g.strokeStyle = fp[i];
        g.beginPath(); g.moveTo(0, hy - s*1.1*sz); g.lineTo(-dw*0.62 + i*dw*0.31, -s*0.02); g.stroke();
      }
    }else if(t === 'apartment'){
      w = s*2.2; h = s*(2.6 + v*1.4);
      g.translate(side*w/2, 0);
      g.fillStyle = ['#b9b2a4','#a8a69c','#c8c0b0','#9c9a92'][(v*4)|0]; g.fillRect(-w/2, -h, w, h);
      g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(w*0.16, -h, w*0.34, h);
      rWin(g, w*0.96, h, Math.min(12, (h/(s*0.36))|0), 5, v, lit, '#4a5a70', '#ffd98a');
      g.fillStyle = v2 > .5 ? '#3a6aa8' : '#c9a030'; g.fillRect(-w/2, -h*0.5, w*0.07, h*0.5); g.fillRect(w/2 - w*0.07, -h*0.5, w*0.07, h*0.5);
      g.fillStyle = '#6a6862'; g.fillRect(-w/2 - 2, -h - s*0.05, w + 4, s*0.07);
    }else if(t === 'ger'){
      w = s*1.2; h = s*0.95;
      g.translate(side*w/2, 0);
      g.fillStyle = '#ece7da'; g.fillRect(-w/2, -h*0.46, w, h*0.46);
      g.fillStyle = '#d9d3c2';
      g.beginPath(); g.moveTo(-w*0.54, -h*0.46); g.lineTo(-w*0.12, -h); g.lineTo(w*0.12, -h); g.lineTo(w*0.54, -h*0.46); g.closePath(); g.fill();
      g.fillStyle = '#3a6aa8'; g.fillRect(-w/2, -h*0.5, w, h*0.05);
      g.fillStyle = '#d8652a'; g.fillRect(-w*0.12, -h*0.4, w*0.24, h*0.4);
      g.fillStyle = '#f0c030'; g.fillRect(-w*0.12, -h*0.3, w*0.24, h*0.04);
      if(v > .45){ g.fillStyle = '#4a4a50'; g.fillRect(w*0.18, -h*1.18, s*0.04, h*0.3);
        g.fillStyle = 'rgba(210,206,200,.5)'; g.beginPath(); g.ellipse(w*0.2, -h*1.3, s*0.1, s*0.07, 0, 0, 7); g.fill(); }
    }else if(t === 'chimney'){
      w = s*0.5; h = s*7;
      g.translate(side*w/2, 0);
      for(i=0;i<7;i++){ g.fillStyle = i%2 ? '#f0ece0' : '#c85a4a'; g.fillRect(-w/2 + i*w*0.02, -h*(i+1)/7, w - i*w*0.04, h/7 + 1); }
      g.fillStyle = 'rgba(205,200,195,.6)';
      for(i=0;i<6;i++){ g.beginPath(); g.ellipse(w*0.3*i + s*0.2*i, -h - s*0.3 - i*s*0.2, s*(0.3 + i*0.12), s*(0.2 + i*0.08), 0, 0, 7); g.fill(); }
      g.fillStyle = '#7a7872'; g.fillRect(-w*1.3, -s*0.7, w*2.6, s*0.7);
    }else if(t === 'bluesky'){
      w = s*2.0; h = s*9;
      g.translate(side*w/2, 0);
      var bgl = g.createLinearGradient(-w/2, 0, w/2, 0);
      bgl.addColorStop(0, '#78baf5'); bgl.addColorStop(1, '#2864b0');
      g.fillStyle = bgl; g.beginPath(); g.moveTo(-w/2, 0); g.lineTo(-w/2, -h); g.quadraticCurveTo(w*0.18, -h*0.78, w/2, 0); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = Math.max(1, s*0.02);
      for(i=1;i<12;i++){ var ly = -h*i/12, rx = -w/2 + (w*(1 - Math.sqrt(Math.max(0, 1 - i/12*i/12)) )); g.beginPath(); g.moveTo(-w/2, ly); g.lineTo(Math.min(w/2, -w/2 + w*(0.96 - i/12*0.9)), ly); g.stroke(); }
    }else if(t === 'statue'){
      w = s*2.2;
      g.translate(side*w/2, 0);
      g.fillStyle = '#8c8a86'; g.fillRect(-w*0.42, -s*0.9, w*0.84, s*0.9);
      g.fillStyle = '#a8a6a0'; g.fillRect(-w*0.46, -s*1.0, w*0.92, s*0.12);
      g.fillStyle = '#6b5a3f';
      g.beginPath(); g.ellipse(0, -s*1.5, w*0.34, s*0.34, 0, 0, 7); g.fill();
      g.fillRect(w*0.18, -s*2.05, w*0.1, s*0.55); g.beginPath(); g.ellipse(w*0.3, -s*2.1, w*0.1, s*0.1, -0.4, 0, 7); g.fill();
      g.fillRect(-w*0.28, -s*1.3, w*0.06, s*0.34); g.fillRect(w*0.2, -s*1.3, w*0.06, s*0.34);
      g.fillStyle = '#4a3c2a'; g.fillRect(-w*0.06, -s*2.0, w*0.14, s*0.5); g.beginPath(); g.arc(w*0.02, -s*2.1, s*0.11, 0, 7); g.fill();
    }else if(t === 'zaisan'){
      w = s*3.2;
      g.translate(side*w/2, 0);
      g.fillStyle = '#b8b2a2'; g.beginPath(); g.ellipse(0, -s*0.1, w*0.52, s*0.2, 0, 0, 7); g.fill();
      g.fillStyle = '#d8d2c0'; g.fillRect(-w*0.4, -s*1.0, w*0.8, s*0.9);
      g.fillStyle = '#c9a030'; g.fillRect(-w*0.4, -s*0.7, w*0.8, s*0.12);
      g.fillStyle = '#3a6aa8'; g.fillRect(-w*0.4, -s*0.55, w*0.8, s*0.1);
      for(i=0;i<9;i++){ g.fillStyle = '#e8e2d2'; g.fillRect(-w*0.38 + i*w*0.093, -s*1.0, w*0.04, s*0.9); }
      g.fillStyle = '#c8c2b0'; g.fillRect(-w*0.45, -s*1.12, w*0.9, s*0.14);
      g.fillStyle = '#e8e2d2'; g.fillRect(-s*0.1, -s*3.2, s*0.2, s*2.1);
      g.fillStyle = '#c9a030'; g.beginPath(); g.moveTo(-s*0.14, -s*3.2); g.lineTo(0, -s*3.55); g.lineTo(s*0.14, -s*3.2); g.closePath(); g.fill();
    }else if(t === 'khan'){
      w = s*3.6;
      g.translate(side*w/2, 0);
      g.fillStyle = '#9c9a96'; g.fillRect(-w/2, -s*2.2, w, s*2.2);
      g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(w*0.12, -s*2.2, w*0.38, s*2.2);
      for(i=0;i<9;i++){ g.fillStyle = '#b8b6b0'; g.fillRect(-w*0.46 + i*w*0.115, -s*2.1, w*0.05, s*1.9); }
      g.fillStyle = '#c0bdb6'; g.fillRect(-w*0.54, -s*2.4, w*1.08, s*0.24);
      g.fillStyle = '#d4d8e0';
      g.beginPath(); g.ellipse(-w*0.02, -s*3.5, w*0.34, s*0.55, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(w*0.3, -s*4.1, w*0.12, s*0.2, -0.5, 0, 7); g.fill();
      g.fillRect(w*0.2, -s*3.9, w*0.09, s*0.7);
      g.fillRect(-w*0.28, -s*3.2, w*0.08, s*0.8); g.fillRect(-w*0.12, -s*3.15, w*0.08, s*0.75); g.fillRect(w*0.1, -s*3.15, w*0.08, s*0.75); g.fillRect(w*0.22, -s*3.2, w*0.08, s*0.8);
      g.fillStyle = '#b4b9c4'; g.fillRect(-w*0.08, -s*4.7, w*0.14, s*1.1); g.beginPath(); g.arc(-w*0.01, -s*4.85, s*0.17, 0, 7); g.fill();
      g.fillStyle = '#e8ecf4'; g.fillRect(w*0.1, -s*4.6, w*0.06, s*0.35);
    }else if(t === 'ovoo'){
      w = s*0.9;
      g.translate(side*w/2, 0);
      g.fillStyle = '#7d7469'; g.beginPath(); g.moveTo(-w*0.5, 0); g.lineTo(-w*0.2, -s*0.55); g.lineTo(w*0.2, -s*0.55); g.lineTo(w*0.5, 0); g.closePath(); g.fill();
      g.fillStyle = '#8f877b'; g.beginPath(); g.moveTo(-w*0.3, -s*0.3); g.lineTo(0, -s*0.7); g.lineTo(w*0.3, -s*0.3); g.closePath(); g.fill();
      g.strokeStyle = '#6a5a40'; g.lineWidth = Math.max(1, s*0.03);
      g.beginPath(); g.moveTo(0, -s*0.6); g.lineTo(0, -s*1.5); g.moveTo(-w*0.2, -s*0.55); g.lineTo(-w*0.35, -s*1.3); g.moveTo(w*0.2, -s*0.55); g.lineTo(w*0.35, -s*1.3); g.stroke();
      g.strokeStyle = '#3a8ae0'; g.lineWidth = Math.max(1.5, s*0.05);
      g.beginPath(); g.moveTo(-w*0.2, -s*1.1); g.lineTo(w*0.2, -s*1.0); g.stroke();
      g.strokeStyle = '#f2f2f2'; g.beginPath(); g.moveTo(-w*0.35, -s*1.3); g.lineTo(-w*0.5, -s*1.0); g.stroke();
    }else if(t === 'tuft'){
      g.strokeStyle = '#8f9a58'; g.lineWidth = Math.max(1, s*0.03); g.lineCap = 'round';
      g.beginPath();
      for(i=-3;i<=3;i++){ g.moveTo(i*s*0.05, 0); g.lineTo(i*s*0.09 + (i%2)*s*0.04, -s*(0.28 + (Math.abs(i)%3)*0.07)); }
      g.stroke();
    }else if(t === 'palm'){
      var ph = s*2.3;
      g.strokeStyle = '#8a6a48'; g.lineWidth = Math.max(2, s*0.1);
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(side*s*0.15, -ph*0.5, -side*s*0.05, -ph); g.stroke();
      g.strokeStyle = '#2f7a3a'; g.lineWidth = Math.max(1.5, s*0.07); g.lineCap = 'round';
      g.beginPath();
      for(i=0;i<7;i++){ var an = -Math.PI/2 + (i - 3)*0.52; g.moveTo(-side*s*0.05, -ph); g.quadraticCurveTo(-side*s*0.05 + Math.cos(an)*s*0.5, -ph + Math.sin(an)*s*0.5 - s*0.2, -side*s*0.05 + Math.cos(an)*s*0.85, -ph + Math.sin(an)*s*0.7 + s*0.3); }
      g.stroke();
    }else if(t === 'gum'){
      var gh = s*2.4;
      g.strokeStyle = '#d8d4c8'; g.lineWidth = Math.max(2, s*0.08);
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(side*s*0.1, -gh*0.5, 0, -gh*0.8); g.stroke();
      g.fillStyle = '#6b8f6a';
      for(i=0;i<4;i++){ g.beginPath(); g.ellipse((i - 1.5)*s*0.22, -gh*(0.82 + (i%2)*0.1), s*0.3, s*0.17, 0, 0, 7); g.fill(); }
    }else if(t === 'jacaranda' || t === 'platane'){
      var jh = s*1.7, tw = s*0.55, ja = t === 'jacaranda';
      g.fillStyle = ja ? '#5a4a3a' : '#c9c4b2'; g.fillRect(-tw*0.1, -jh*0.4, tw*0.2, jh*0.4);
      g.fillStyle = ja ? '#8a5fc0' : (lit ? '#5a7a52' : '#7aa257');
      g.beginPath(); g.ellipse(0, -jh*0.62, tw*0.85, jh*0.36, 0, 0, 7); g.fill();
      g.fillStyle = ja ? '#a47ad6' : (lit ? '#6a8a60' : '#8fb86a');
      g.beginPath(); g.ellipse(-tw*0.25, -jh*0.74, tw*0.5, jh*0.26, 0, 0, 7); g.fill();
    }else if(t === 'sail'){
      var mh = s*3.0;
      g.strokeStyle = '#8a929c'; g.lineWidth = Math.max(1.5, s*0.05);
      g.beginPath(); g.moveTo(0, -s*0.2); g.lineTo(0, -mh); g.stroke();
      g.fillStyle = '#f4f2ea'; g.beginPath(); g.moveTo(s*0.05, -mh*0.97); g.lineTo(s*0.05, -s*0.5); g.lineTo(s*0.75, -s*0.5); g.closePath(); g.fill();
      g.fillStyle = '#e8e4d8'; g.beginPath(); g.moveTo(-s*0.05, -mh*0.85); g.lineTo(-s*0.05, -s*0.5); g.lineTo(-s*0.5, -s*0.5); g.closePath(); g.fill();
      g.fillStyle = '#3a4a68'; g.beginPath(); g.moveTo(-s*0.6, -s*0.2); g.lineTo(s*0.9, -s*0.2); g.lineTo(s*0.7, 0); g.lineTo(-s*0.4, 0); g.closePath(); g.fill();
    }else if(t === 'wirepole'){
      var wh = s*2.2;
      g.fillStyle = '#7a6a58'; g.fillRect(-s*0.04, -wh, s*0.08, wh);
      g.fillRect(-s*0.3, -wh*0.95, s*0.6, s*0.06); g.fillRect(-s*0.22, -wh*0.8, s*0.44, s*0.05);
      g.strokeStyle = '#17171b'; g.lineWidth = Math.max(1, s*0.016);
      g.beginPath();
      for(i=0;i<5;i++){ g.moveTo(-s*0.3 + i*s*0.15, -wh*0.95); g.quadraticCurveTo(-side*s*0.9, -wh*(0.55 + i*0.06), -side*s*1.6, -wh*(0.8 + (i%2)*0.1)); }
      g.stroke();
    }else if(t === 'lant'){
      var lh = s*2.2;
      g.fillStyle = '#5a4a40'; g.fillRect(-s*0.04, -lh, s*0.08, lh); g.fillRect(-side*s*0.02, -lh, side*s*0.4, s*0.06);
      g.fillStyle = 'rgba(255,90,60,.28)'; g.beginPath(); g.arc(side*s*0.34, -lh + s*0.2, s*0.3, 0, 7); g.fill();
      g.fillStyle = '#d8352c'; g.beginPath(); g.ellipse(side*s*0.34, -lh + s*0.2, s*0.12, s*0.16, 0, 0, 7); g.fill();
    }else if(t === 'opera'){
      w = s*9;
      g.translate(side*w/2, 0);
      g.fillStyle = '#d9d3c4'; g.fillRect(-w/2, -s*0.5, w, s*0.5);
      skShell(g, -w*0.45, -s*0.5, w*0.3, s*3.6, '#f6f3ec'); skShell(g, -w*0.27, -s*0.5, w*0.24, s*2.7, '#e2ddd0'); skShell(g, -w*0.1, -s*0.5, w*0.2, s*1.9, '#f6f3ec');
      skShell(g, -w*0.02, -s*0.5, w*0.34, s*3.1, '#ece8de'); skShell(g, w*0.2, -s*0.5, w*0.24, s*2.1, '#f6f3ec');
    }else if(t === 'boc'){
      w = s*1.9;
      g.translate(side*w/2, 0);
      g.fillStyle = lit ? '#4658a8' : '#7a8aa8'; g.fillRect(-w*0.4, -s*8, w*0.45, s*8);
      g.fillStyle = lit ? '#5668b8' : '#93a2bc'; g.fillRect(w*0.05, -s*6.2, w*0.3, s*6.2); g.fillRect(-w*0.5, -s*4.8, w*0.1, s*4.8);
      g.strokeStyle = lit ? '#aab6e6' : '#e8eefa'; g.lineWidth = Math.max(1, s*0.03);
      for(i=0;i<8;i++){ g.beginPath(); g.moveTo(-w*0.4, -s*8 + i*s); g.lineTo(w*0.05, -s*7 + i*s); g.stroke(); }
      g.fillStyle = '#e8eeff'; g.fillRect(-w*0.2, -s*9.4, s*0.05, s*1.4);
    }else if(t === 'ifc'){
      w = s*1.5;
      g.translate(side*w/2, 0);
      g.fillStyle = lit ? '#46549c' : '#8fa0bc';
      g.beginPath(); g.moveTo(-w/2, 0); g.lineTo(-w*0.34, -s*8.8); g.lineTo(0, -s*9.4); g.lineTo(w*0.34, -s*8.8); g.lineTo(w/2, 0); g.closePath(); g.fill();
      rWin(g, w*0.8, s*8.4, 18, 3, v, lit, lit ? '#141a40' : '#5a6c88', '#ffe9a0');
      g.fillStyle = 'rgba(180,200,255,.45)'; g.fillRect(-s*0.02, -s*9.2, s*0.04, s*9.2);
    }else if(t === 'pearl'){
      w = s*2.4;
      g.translate(side*w/2, 0);
      g.strokeStyle = lit ? '#8a7fa8' : '#a8a2b8'; g.lineWidth = Math.max(2, s*0.11);
      g.beginPath(); g.moveTo(-w*0.45, 0); g.lineTo(-s*0.08, -s*4.2); g.moveTo(w*0.45, 0); g.lineTo(s*0.08, -s*4.2); g.moveTo(0, -s*0.2); g.lineTo(0, -s*6.5); g.stroke();
      var prr = g.createRadialGradient(-s*0.3, -s*4.6, s*0.1, 0, -s*4.3, s*1.1);
      prr.addColorStop(0, '#ffd0ec'); prr.addColorStop(1, '#c0509c');
      g.fillStyle = prr; g.beginPath(); g.arc(0, -s*4.3, s*1.0, 0, 7); g.fill();
      g.fillStyle = '#d870b4'; g.beginPath(); g.arc(0, -s*6.6, s*0.55, 0, 7); g.fill();
      g.fillStyle = '#e8e0f4'; g.fillRect(-s*0.04, -s*8.6, s*0.08, s*1.5);
    }else if(t === 'jinmao'){
      w = s*1.6;
      g.translate(side*w/2, 0);
      for(i=0;i<9;i++){ var sw3 = w*(1 - i*0.085); g.fillStyle = lit ? (i%2 ? '#6a6f9a' : '#7a80aa') : (i%2 ? '#aab4c8' : '#c0c8d8'); g.fillRect(-sw3/2, -s*(0.9 + i*0.9), sw3, s*0.95); }
      g.fillStyle = '#d8dcec'; g.fillRect(-s*0.04, -s*9.8, s*0.08, s*1.8);
    }else if(t === 'swfc'){
      w = s*1.7;
      g.translate(side*w/2, 0);
      g.fillStyle = lit ? '#5a608c' : '#a8b4cc';
      g.beginPath(); g.moveTo(-w/2, 0); g.lineTo(-w*0.46, -s*9.2); g.lineTo(w*0.46, -s*9.2); g.lineTo(w/2, 0); g.closePath(); g.fill();
      g.fillStyle = lit ? '#2a2f50' : '#e8ecf6'; g.beginPath(); g.ellipse(0, -s*8.1, w*0.18, s*0.6, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,217,138,.55)'; for(i=0;i<12;i++) g.fillRect(-w*0.3 + (i%3)*w*0.25, -s*0.6 - i*s*0.6, w*0.1, s*0.2);
    }else{
      return false;
    }
    return true;
  }
  /* ── Traffic ───────────────────────────────────────────────────────────
     w is the full width of an ordinary car; each kind scales from that. */
  function rVeh(g, x, y, w, c){
    var k = c.k;
    if(k === 'car' || k === 'van'){ rCar(g, x, y, k === 'van' ? w*1.1 : w, c.col, k === 'van'); return; }
    if(k === 'taxi'){
      rCar(g, x, y, w, c.col, false);
      if(w > 8){ g.fillStyle = '#f6e27a'; g.fillRect(x - w*0.1, y - w*0.7*1.04, w*0.2, w*0.7*0.08); }
      return;
    }
    if(k === 'scoot'){
      rBike(g, x, y, w*0.9, { col:c.col, jacket:c.top || '#2b2f3a', helmet:'#e9e9e4', lean:0 });
      return;
    }
    var bw = w*R_VEH[k].f;
    if(bw < 4) return;
    g.save(); g.translate(x, y);
    var h, i;
    g.fillStyle = 'rgba(0,0,0,.28)';
    g.beginPath(); g.ellipse(0, 0, bw*0.52, bw*0.06, 0, 0, 7); g.fill();
    if(k === 'bus'){
      var dd = c.dd; h = bw*(dd ? 1.0 : 0.8);
      g.fillStyle = '#16181c'; g.fillRect(-bw*0.44, -h*0.12, bw*0.16, h*0.14); g.fillRect(bw*0.28, -h*0.12, bw*0.16, h*0.14);
      g.fillStyle = c.col; g.fillRect(-bw/2, -h*0.96, bw, h*0.86);
      g.fillStyle = c.top || '#f2f2f2'; g.fillRect(-bw/2, -h*0.96, bw, h*0.1); g.fillRect(-bw/2, -h*0.34, bw, h*0.06);
      g.fillStyle = '#1d2733';
      if(dd){ g.fillRect(-bw*0.42, -h*0.82, bw*0.84, h*0.22); g.fillRect(-bw*0.42, -h*0.54, bw*0.84, h*0.17); }
      else g.fillRect(-bw*0.42, -h*0.8, bw*0.84, h*0.3);
      g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(-bw*0.42, -h*0.82, bw*0.14, h*0.22);
      g.fillStyle = '#d83a2e'; g.fillRect(-bw*0.46, -h*0.26, bw*0.1, h*0.1); g.fillRect(bw*0.36, -h*0.26, bw*0.1, h*0.1);
      g.fillStyle = '#e8e8e0'; g.fillRect(-bw*0.1, -h*0.24, bw*0.2, h*0.07);
    }else if(k === 'truck'){
      h = bw*0.9;
      g.fillStyle = '#16181c'; g.fillRect(-bw*0.44, -h*0.12, bw*0.16, h*0.14); g.fillRect(bw*0.28, -h*0.12, bw*0.16, h*0.14);
      g.fillStyle = c.col; g.fillRect(-bw/2, -h*0.98, bw, h*0.84);
      g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(bw*0.1, -h*0.98, bw*0.4, h*0.84);
      g.fillStyle = '#3a3d44'; g.fillRect(-bw/2, -h*0.14, bw, h*0.08);
      g.fillStyle = '#d83a2e'; g.fillRect(-bw*0.46, -h*0.26, bw*0.1, h*0.1); g.fillRect(bw*0.36, -h*0.26, bw*0.1, h*0.1);
      g.fillStyle = '#e8e8e0'; g.fillRect(-bw*0.1, -h*0.24, bw*0.2, h*0.07);
    }else if(k === 'tempo'){
      h = bw*0.95;
      g.fillStyle = '#16181c'; g.fillRect(-bw*0.07, -h*0.2, bw*0.14, h*0.22);
      g.fillStyle = c.col;
      g.beginPath(); g.moveTo(-bw*0.46, -h*0.18); g.lineTo(-bw*0.42, -h*0.78); g.lineTo(-bw*0.3, -h*0.92); g.lineTo(bw*0.3, -h*0.92); g.lineTo(bw*0.42, -h*0.78); g.lineTo(bw*0.46, -h*0.18); g.closePath(); g.fill();
      g.fillStyle = '#e8e2cc'; g.fillRect(-bw*0.36, -h*0.8, bw*0.72, h*0.34);
      g.fillStyle = '#1d2733'; g.fillRect(-bw*0.28, -h*0.74, bw*0.56, h*0.2);
      g.fillStyle = '#d83a2e'; g.fillRect(-bw*0.4, -h*0.36, bw*0.1, h*0.08); g.fillRect(bw*0.3, -h*0.36, bw*0.1, h*0.08);
      g.fillStyle = '#d8b04a'; g.fillRect(-bw*0.3, -h*0.96, bw*0.6, h*0.05);
    }else if(k === 'cow'){
      h = bw*0.95;
      g.fillStyle = c.col;
      g.beginPath(); g.ellipse(0, -h*0.5, bw*0.38, h*0.34, 0, 0, 7); g.fill();
      g.fillRect(-bw*0.3, -h*0.3, bw*0.14, h*0.3); g.fillRect(bw*0.16, -h*0.3, bw*0.14, h*0.3);
      g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(bw*0.12, -h*0.5, bw*0.2, h*0.3, 0, 0, 7); g.fill();
      g.fillStyle = '#c9b8a0'; if(c.col === '#eee9dc'){ g.fillStyle = '#b8a890'; g.beginPath(); g.ellipse(-bw*0.15, -h*0.58, bw*0.14, h*0.12, 0, 0, 7); g.fill(); }
      g.fillStyle = c.col === '#eee9dc' ? '#d8d2c0' : '#6a4a30';
      g.beginPath(); g.ellipse(0, -h*0.86, bw*0.2, h*0.13, 0, 0, 7); g.fill();       // head, from behind
      g.fillRect(-bw*0.32, -h*0.94, bw*0.12, h*0.04); g.fillRect(bw*0.2, -h*0.94, bw*0.12, h*0.04);   // horns
      g.strokeStyle = '#5a4a3a'; g.lineWidth = Math.max(1, bw*0.03);
      g.beginPath(); g.moveTo(0, -h*0.7); g.quadraticCurveTo(bw*0.1, -h*0.45, bw*0.04, -h*0.2); g.stroke();   // tail
    }
    g.restore();
  }

  function rDrawSky(g, W, H, base){
    var N = rs.segs.length, zn = rs.segs[(base + 70) % N].zn, key = zn && zn.skyk;
    if(key && key !== rs.skyB){ rs.skyA = rs.skyB || key; rs.skyB = key; rs.skyMix = rs.skyA === key ? 1 : 0; }
    if(rs.skyMix < 1) rs.skyMix = Math.min(1, rs.skyMix + 0.025);
    var so = (((rs.bg*0.45) % SKW) + SKW) % SKW, y = H*0.5 - SKH + 2;
    function lay(k, a){
      if(!k) return;
      var cv = rSkyCanvas(k);
      g.globalAlpha = a;
      g.drawImage(cv, -so - 8, y); g.drawImage(cv, SKW - so - 8, y);
      if(SKW*2 - so - 8 < W + 8) g.drawImage(cv, SKW*2 - so - 8, y);
    }
    if(rs.skyMix < 1){ lay(rs.skyA, 1); lay(rs.skyB, rs.skyMix); } else lay(rs.skyB, 1);
    g.globalAlpha = 1;
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
    var city = !!rs.track.zones;
    rs._portal = -1;
    if(city) rDrawSky(g, W, H, base);
    else for(var L=0;L<2;L++){
      g.fillStyle = TH.hill[L];
      g.beginPath(); g.moveTo(-10, H*0.5);
      for(var hx=-10; hx<=W+10; hx+=8){
        var o = (hx + rs.bg*(0.5 + L*0.5)) * (L ? 0.017 : 0.011);
        g.lineTo(hx, H*0.5 - (L ? 10 : 26) - (L ? 7 : 14)*Math.sin(o) - (L ? 4 : 9)*Math.sin(o*2.7 + 1.7));
      }
      g.lineTo(W+10, H*0.5); g.closePath(); g.fill();
    }
    var zFar = city ? rs.segs[(base + RDRAW - 1) % N].zn : null;
    g.fillStyle = (zFar && zFar.gnd ? zFar.gnd : TH.grass)[0]; g.fillRect(-8, H*0.5, W+16, H*0.5);

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
    var maxY = H + 1, dress = [];
    proj[0].clip = H + 1;
    for(n=1;n<RDRAW;n++){
      var p0 = proj[n-1], p1 = proj[n];
      if(p1.sy < p0.sy && p1.sy < maxY){
        var seg2 = rs.segs[((p0.idx % N) + N) % N], Zs = seg2.zn;
        var band = (Math.floor(p1.idx/3) % 2) === 0, gc = (Zs && Zs.gnd) || TH.grass;
        g.fillStyle = band ? gc[0] : gc[1];
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
        if(Zs && (Zs.walls || Zs.tun)){
          // Barriers and tunnels stand above the ground, so they are painted after the road, far to near.
          var pz = rs.segs[(((p0.idx - 1) % N) + N) % N].zn;
          dress.push({ p0:p0, p1:p1, band:band, Z:Zs, idx:p0.idx, portal:!!(Zs.tun && pz !== Zs) });
          if(Zs.tun && pz !== Zs){
            var phw = 1.1*p0.sw*0.5;
            rs._portal = p0.idx; rs._ph = { x0:p0.sx - phw, x1:p0.sx + phw, c:p0.sy - 700*p0.sc, y0:p0.sy + 1 };
          }
        }
        maxY = p1.sy;
      }
      p1.clip = maxY;
    }

    for(i=dress.length-1;i>=0;i--){
      var dd = dress[i];
      if(dd.Z.walls){ rWall(g, dd.p0, dd.p1, -1, dd.band, dd.Z.wc || '#9aa0a8'); rWall(g, dd.p0, dd.p1, 1, dd.band, dd.Z.wc || '#9aa0a8'); }
      if(dd.Z.tun){ if(dd.portal) rPortal(g, dd.p0, W); rTunnel(g, dd.p0, dd.p1, dd.band, dd.idx); }
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
    var pIdx = rs._portal, hole = rs._ph, clipped = false;
    if(pIdx >= 0 && proj[RDRAW-1].idx >= pIdx){        // beyond a tunnel mouth you only see through the opening
      g.save(); g.beginPath(); g.rect(hole.x0, hole.c, hole.x1 - hole.x0, hole.y0 - hole.c); g.clip(); clipped = true;
    }
    for(n=RDRAW-1;n>=0;n--){
      var pn = proj[n], sg2 = rs.segs[((pn.idx % N) + N) % N];
      if(clipped && pn.idx < pIdx){ g.restore(); clipped = false; }
      if(pn.sy - pn.clip <= 4 && pn.sy > 0 && pn.sy < H + 80){
        var sw = pn.sw, lt = !!TH.lit;
        if(sg2.lm && pn.sc > 0.008) rScenery(g, sg2.lm, pn.sx + sg2.lm.side*sg2.lm.off*sw*0.5, pn.sy, sw, lt);
        if(pn.sc > 0.02){
          if(sg2.sc)  rScenery(g, sg2.sc,  pn.sx + sg2.sc.side*sg2.sc.off*sw*0.5,   pn.sy, sw, lt);
          if(sg2.sc2) rScenery(g, sg2.sc2, pn.sx + sg2.sc2.side*sg2.sc2.off*sw*0.5, pn.sy, sw, lt);
          if(sg2.deco) rDeco(g, sg2.deco, pn, n);
        }
      }
      var bk = bucket[n];
      if(!bk) continue;
      if(bk.length > 1) bk.sort(function(a,b){ return b.z - a.z; });
      for(var q=0;q<bk.length;q++) rDrawItem(g, bk[q]);
    }
    if(clipped) g.restore();

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
      rVeh(g, a.sx + c.x*1000*sc, a.sy, 700*sc, c);
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

    // Route map: the circuit's real shape with every rider on it.
    var rt = rRoute(rs.track), mw = 74, mh = 60, mx = W - mw - 8, my = 20, side = Math.min(mw, mh) - 12;
    var ox = mx + (mw - side)/2, oy = my + (mh - side)/2;
    g.fillStyle = 'rgba(8,10,16,.5)'; g.beginPath(); g.roundRect(mx - 3, my - 3, mw + 6, mh + 6, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath();
    for(var mi=0;mi<rt.length;mi+=2){ var mxp = ox + rt[mi][0]*side, myp = oy + rt[mi][1]*side; if(mi) g.lineTo(mxp, myp); else g.moveTo(mxp, myp); }
    g.stroke();
    function mdot(z, col, r){
      var k = rClamp(Math.floor(z/RSEG/4), 0, rt.length - 1);
      g.fillStyle = col; g.beginPath(); g.arc(ox + rt[k][0]*side, oy + rt[k][1]*side, r, 0, 7); g.fill();
    }
    mdot(rs.FIN, '#e05a3f', 2.6);
    for(var mr=0;mr<rs.rivals.length;mr++) mdot(rs.rivals[mr].z, rs.rivals[mr].col, 1.8);
    if(rs.cop && rs.cop.state === 'ride') mdot(rs.cop.z, '#3a7be0', 2.4);
    mdot(rs.pz, '#ffffff', 3);

    g.textAlign = 'center';
    if(rs.zb && rs.zbT > 0 && rs.mode !== 'finish'){
      g.save();
      g.globalAlpha = Math.min(1, rs.zbT*1.4, (4.5 - rs.zbT)*3 + 0.2);
      g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.5)'; g.fillStyle = '#fff';
      g.font = '800 11px ui-monospace,Menlo,monospace';
      g.strokeText(rs.track.name.toUpperCase(), W/2, H*0.1); g.fillText(rs.track.name.toUpperCase(), W/2, H*0.1);
      g.font = '800 21px ui-monospace,Menlo,monospace';
      g.strokeText(rs.zb.n, W/2, H*0.1 + 24); g.fillText(rs.zb.n, W/2, H*0.1 + 24);
      g.restore();
    }
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
  function rScenery(g, o, x, groundY, roadW, lit){
    var s = roadW * 0.5, type = o.type;
    if(s < 3) return;
    g.save();
    g.translate(x, groundY);
    if(rCityObj(g, o, s, lit)){ g.restore(); return; }
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
