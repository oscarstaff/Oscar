/* ═══════════════════════════════════════════════════════════════════════
   arcade-games2.js — Minesweeper, Tetris and Connect 4 for Bore-KADE
   Loaded by arcade.html:  <script src="arcade-games2.js?v=1"></script>
   Load AFTER arcade-games.js.

   WHY A SECOND FILE, AND WHY IT NEEDS NO arcade.html EDIT
   The first batch was wired in by patching openGame(), closeGame() and
   refreshBests() by hand. That works, but it means arcade.html has to be
   edited every single time a game is added, and each edit is a chance to
   break the two originals.

   This file instead WRAPS those three functions once. The originals are
   called first and their behaviour is untouched; the wrapper then looks the
   game up in the GAMES registry below. Adding a fourth, fifth or tenth game
   is now one registry entry and nothing else. If this file fails to load,
   arcade.html is byte-for-byte a working arcade with the five existing games.

   PICKED TO FILL GAPS, NOT TO PAD THE COUNT
   Existing: pool + kart (physics), snake + brick (reflex), slide (puzzle).
     · MINESWEEPER — deduction. No timer pressure unless you want it.
     · TETRIS      — spatial under pressure. 7-bag, SRS kicks, hold, ghost.
     · CONNECT 4   — an actual opponent. Alpha-beta minimax, three depths.

   ONE GLOBAL
   Everything hangs off window.AG2. The onclick attributes in the injected
   markup call AG2.something(), so this adds exactly one name to the global
   scope rather than a dozen — the same collision discipline the Nexus
   modules follow.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var AG2 = {};
  window.AG2 = AG2;

  /* ── storage ─────────────────────────────────────────────────────────
     Reuses the existing arcade_best_* keys so the host's own refreshBests
     keeps working. Minesweeper is stored as a TIME, where lower is better —
     handled by its own comparator rather than bending the shared one. */
  function best(key){
    try{ return parseInt(localStorage.getItem('arcade_best_'+key)) || 0; }
    catch(e){ return 0; }
  }
  function setBest(key, v){
    if(v <= best(key)) return false;
    try{ localStorage.setItem('arcade_best_'+key, String(v)); }catch(e){}
    return true;
  }
  function setBestLow(key, v){
    var cur = best(key);
    if(cur && v >= cur) return false;
    try{ localStorage.setItem('arcade_best_'+key, String(v)); }catch(e){}
    return true;
  }
  function mmss(s){
    if(!s) return '--';
    var m = Math.floor(s/60), r = s%60;
    return m ? m+':'+(r<10?'0':'')+r : r+'s';
  }

  function screen(id, title, statusId, inner){
    return '<div class="screen" id="screen-'+id+'">'+
      '<div class="topbar">'+
        '<button class="back-btn" onclick="closeGame()">\u2190 Back</button>'+
        '<span class="game-title">'+title+'</span>'+
        '<span class="status-pill" id="'+statusId+'">\u2014</span>'+
      '</div>'+ inner +
    '</div>';
  }

  var CSS = `
  /* Base .ag-* rules. arcade-games.js defines these too, and the values here
     are identical, so loading both is harmless. They are repeated because
     this file must render correctly on its own — if only this module is
     installed, the screens below would otherwise be completely unstyled. */
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
  .ag-hint{font-size:12px;color:var(--text-dim);text-align:center;max-width:44ch;
    line-height:1.5;}
  .ag-btn{font-family:inherit;font-size:13px;font-weight:700;padding:9px 18px;
    border-radius:10px;border:1px solid var(--border);background:var(--panel);
    color:var(--text);cursor:pointer;transition:all .15s;}
  .ag-btn:hover{border-color:var(--accent);color:var(--accent);}
  .ag-btn.primary{background:var(--accent);border-color:var(--accent);color:#fff;}
  .ag-btn.primary:hover{filter:brightness(1.08);color:#fff;}
  .ag2-seg{display:flex;gap:0;border:1px solid var(--border);border-radius:9px;
    overflow:hidden;}
  .ag2-seg button{font-family:inherit;font-size:12px;font-weight:700;
    padding:7px 13px;border:0;background:var(--panel);color:var(--text-dim);
    cursor:pointer;transition:all .15s;}
  .ag2-seg button+button{border-left:1px solid var(--border);}
  .ag2-seg button.on{background:var(--accent);color:#fff;}
  /* minesweeper */
  .ag2-mines{display:grid;gap:2px;background:var(--border);padding:5px;
    border-radius:10px;touch-action:manipulation;user-select:none;
    -webkit-user-select:none;}
  .ag2-cell{width:100%;aspect-ratio:1;display:flex;align-items:center;
    justify-content:center;background:var(--panel);border-radius:3px;
    font-family:ui-monospace,Menlo,monospace;font-weight:800;
    font-size:clamp(10px,2.6vw,15px);cursor:pointer;color:var(--text);
    transition:background .1s;}
  .ag2-cell:hover{background:var(--bg);}
  .ag2-cell.open{background:var(--bg);cursor:default;}
  .ag2-cell.open:hover{background:var(--bg);}
  .ag2-cell.boom{background:#e05a3f;color:#fff;}
  .ag2-cell.flag{color:#e05a3f;}
  .ag2-n1{color:#5a7ec9;} .ag2-n2{color:#2d9d94;} .ag2-n3{color:#e05a3f;}
  .ag2-n4{color:#8b5cc9;} .ag2-n5{color:#c9952e;} .ag2-n6{color:#2d9d94;}
  .ag2-n7{color:#1d2530;} .ag2-n8{color:#8a94a6;}
  /* tetris */
  .ag2-tetris{display:flex;gap:14px;align-items:flex-start;}
  .ag2-side{display:flex;flex-direction:column;gap:10px;min-width:78px;}
  .ag2-box{border:1px solid var(--border);border-radius:10px;padding:8px;
    background:var(--panel);}
  .ag2-box h4{margin:0 0 6px;font-size:9px;letter-spacing:.12em;
    text-transform:uppercase;color:var(--text-dim);font-weight:800;}
  .ag2-stat{font-family:ui-monospace,Menlo,monospace;font-size:14px;
    font-weight:800;color:var(--accent);}
  /* connect 4 */
  .ag2-c4{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;
    background:var(--border);padding:7px;border-radius:12px;
    width:min(370px,88vw);touch-action:manipulation;}
  .ag2-slot{aspect-ratio:1;border-radius:50%;background:var(--bg);
    cursor:pointer;transition:transform .12s,background .15s;}
  .ag2-slot.p1{background:#e05a3f;} .ag2-slot.p2{background:#c9952e;}
  .ag2-slot.win{transform:scale(1.14);box-shadow:0 0 0 2px var(--accent);}
  .ag2-c4.busy .ag2-slot{cursor:default;}
  @media (max-width:520px){ .ag2-tetris{gap:8px;} .ag2-side{min-width:62px;} }
  @media (prefers-reduced-motion: reduce){
    .ag2-slot,.ag2-cell{transition:none;}
  }`;

  /* ══════════════════════════════════════════════════════════════════
     MINESWEEPER
     First click is always safe — the board is generated after it, with the
     clicked cell and its neighbours excluded. Opening on a mine because you
     had to guess first is the single thing that makes people quit.
     ══════════════════════════════════════════════════════════════════ */
  var LEVELS = {
    easy  : { w:9,  h:9,  m:10, key:'mines_e', name:'Easy'   },
    medium: { w:12, h:12, m:22, key:'mines',   name:'Medium' },
    hard  : { w:16, h:16, m:45, key:'mines_h', name:'Hard'   }
  };
  var mn = null, mnTimer = null;

  AG2.minesInit = function(lvl){
    var L = LEVELS[lvl || (mn && mn.lvl) || 'medium'];
    mn = {
      lvl: lvl || (mn && mn.lvl) || 'medium',
      w:L.w, h:L.h, m:L.m,
      cells: [], seeded:false, dead:false, won:false,
      flags:0, opened:0, t:0, flagMode:false
    };
    for(var i=0;i<L.w*L.h;i++) mn.cells.push({mine:false,adj:0,open:false,flag:false});
    mnStopTimer();
    mnRender();
    mnStatus();
    var seg = document.getElementById('minesSeg');
    if(seg) Array.prototype.forEach.call(seg.children, function(b){
      b.classList.toggle('on', b.dataset.lvl === mn.lvl);
    });
  };
  AG2.minesStop = function(){ mnStopTimer(); };
  AG2.minesLevel = function(l){ AG2.minesInit(l); };
  AG2.minesRestart = function(){ AG2.minesInit(mn ? mn.lvl : 'medium'); };
  AG2.minesFlagMode = function(){
    if(!mn) return;
    mn.flagMode = !mn.flagMode;
    var b = document.getElementById('minesFlagBtn');
    if(b){ b.classList.toggle('primary', mn.flagMode);
           b.textContent = mn.flagMode ? '\u{1F6A9} Flag mode ON' : '\u{1F6A9} Flag mode'; }
  };

  function mnStopTimer(){ if(mnTimer) clearInterval(mnTimer); mnTimer = null; }
  function mnStartTimer(){
    mnStopTimer();
    mnTimer = setInterval(function(){
      if(!mn || mn.dead || mn.won) return;
      mn.t++; mnStatus();
    }, 1000);
  }
  function mnIdx(x,y){ return y*mn.w + x; }
  function mnNeighbours(x,y){
    var out = [];
    for(var dy=-1;dy<=1;dy++)for(var dx=-1;dx<=1;dx++){
      if(!dx && !dy) continue;
      var nx=x+dx, ny=y+dy;
      if(nx>=0 && ny>=0 && nx<mn.w && ny<mn.h) out.push([nx,ny]);
    }
    return out;
  }
  /** Lay the mines, avoiding the first-clicked cell and its ring. */
  function mnSeed(sx,sy){
    var safe = {};
    safe[mnIdx(sx,sy)] = 1;
    mnNeighbours(sx,sy).forEach(function(p){ safe[mnIdx(p[0],p[1])] = 1; });
    var spots = [];
    for(var i=0;i<mn.w*mn.h;i++) if(!safe[i]) spots.push(i);
    // Fisher-Yates, then take the first m.
    for(var j=spots.length-1;j>0;j--){
      var k = Math.floor(Math.random()*(j+1));
      var tmp = spots[j]; spots[j] = spots[k]; spots[k] = tmp;
    }
    var count = Math.min(mn.m, spots.length);
    for(var n=0;n<count;n++) mn.cells[spots[n]].mine = true;
    for(var y=0;y<mn.h;y++)for(var x=0;x<mn.w;x++){
      var c = mn.cells[mnIdx(x,y)];
      if(c.mine){ c.adj = -1; continue; }
      c.adj = mnNeighbours(x,y).filter(function(p){
        return mn.cells[mnIdx(p[0],p[1])].mine; }).length;
    }
    mn.seeded = true;
    mnStartTimer();
  }
  /** Iterative flood fill — recursion blows the stack on a big empty board. */
  function mnOpen(x,y){
    var stack = [[x,y]];
    while(stack.length){
      var p = stack.pop(), c = mn.cells[mnIdx(p[0],p[1])];
      if(c.open || c.flag) continue;
      c.open = true; mn.opened++;
      if(c.adj === 0) mnNeighbours(p[0],p[1]).forEach(function(q){
        var n = mn.cells[mnIdx(q[0],q[1])];
        if(!n.open && !n.flag) stack.push(q);
      });
    }
  }
  AG2.minesClick = function(x,y,forceFlag){
    if(!mn || mn.dead || mn.won) return;
    var c = mn.cells[mnIdx(x,y)];
    if(forceFlag || mn.flagMode){
      if(c.open) return;
      c.flag = !c.flag;
      mn.flags += c.flag ? 1 : -1;
      mnRender(); mnStatus();
      return;
    }
    if(c.flag) return;
    if(!mn.seeded) mnSeed(x,y);
    if(c.open){ mnChord(x,y); mnRender(); mnCheck(); return; }
    if(c.mine){
      mn.dead = true; mnStopTimer();
      mn.cells.forEach(function(k){ if(k.mine) k.open = true; });
      c.boom = true;
      mnRender();
      document.getElementById('minesStatus').textContent = 'Boom \u00b7 ' + mmss(mn.t);
      return;
    }
    mnOpen(x,y);
    mnRender(); mnCheck();
  };
  /** Click a satisfied number to open its unflagged neighbours. */
  function mnChord(x,y){
    var c = mn.cells[mnIdx(x,y)];
    if(!c.open || c.adj < 1) return;
    var ns = mnNeighbours(x,y);
    var flagged = ns.filter(function(p){ return mn.cells[mnIdx(p[0],p[1])].flag; }).length;
    if(flagged !== c.adj) return;
    for(var i=0;i<ns.length;i++){
      var n = mn.cells[mnIdx(ns[i][0],ns[i][1])];
      if(n.flag || n.open) continue;
      if(n.mine){
        mn.dead = true; mnStopTimer();
        mn.cells.forEach(function(k){ if(k.mine) k.open = true; });
        n.boom = true;
        document.getElementById('minesStatus').textContent = 'Boom \u00b7 ' + mmss(mn.t);
        return;
      }
      mnOpen(ns[i][0], ns[i][1]);
    }
  }
  function mnCheck(){
    if(mn.dead || mn.won) return;
    if(mn.opened >= mn.w*mn.h - mn.m){
      mn.won = true; mnStopTimer();
      mn.cells.forEach(function(k){ if(k.mine && !k.flag){ k.flag = true; mn.flags++; } });
      mnRender();
      var rec = setBestLow(LEVELS[mn.lvl].key, mn.t);
      document.getElementById('minesStatus').textContent =
        (rec ? 'Best time! ' : 'Cleared \u00b7 ') + mmss(mn.t);
      AG2.refreshLabels();
    }
  }
  function mnStatus(){
    var el = document.getElementById('minesStatus');
    if(!el || !mn || mn.dead || mn.won) return;
    el.textContent = (mn.m - mn.flags) + ' left \u00b7 ' + mmss(mn.t);
  }
  function mnRender(){
    var host = document.getElementById('minesGrid');
    if(!host || !mn) return;
    host.style.gridTemplateColumns = 'repeat('+mn.w+',1fr)';
    host.style.width = 'min('+(mn.w*30)+'px, 90vw)';
    var out = '';
    for(var y=0;y<mn.h;y++)for(var x=0;x<mn.w;x++){
      var c = mn.cells[mnIdx(x,y)], cls = 'ag2-cell', txt = '';
      if(c.open){
        cls += ' open';
        if(c.mine){ cls += c.boom ? ' boom' : ''; txt = '\u2739'; }
        else if(c.adj > 0){ cls += ' ag2-n'+c.adj; txt = c.adj; }
      }else if(c.flag){ cls += ' flag'; txt = '\u25B6'; }
      out += '<div class="'+cls+'" data-x="'+x+'" data-y="'+y+'">'+txt+'</div>';
    }
    host.innerHTML = out;
  }

  /* ══════════════════════════════════════════════════════════════════
     TETRIS
     7-bag randomiser (you never wait twenty pieces for an I), SRS wall
     kicks so T-spins and tight fits behave the way muscle memory expects,
     hold slot, and a ghost piece.
     ══════════════════════════════════════════════════════════════════ */
  var SHAPES = {
    I:{c:'#2d9d94', m:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]]},
    O:{c:'#c9952e', m:[[1,1],[1,1]]},
    T:{c:'#8b5cc9', m:[[0,1,0],[1,1,1],[0,0,0]]},
    S:{c:'#5cc98b', m:[[0,1,1],[1,1,0],[0,0,0]]},
    Z:{c:'#e05a3f', m:[[1,1,0],[0,1,1],[0,0,0]]},
    J:{c:'#5a7ec9', m:[[1,0,0],[1,1,1],[0,0,0]]},
    L:{c:'#e8a05c', m:[[0,0,1],[1,1,1],[0,0,0]]}
  };
  // SRS kick offsets. Written in SRS space (y up); flipped to screen y below.
  var KICK = {
    '0>1':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '1>0':[[0,0],[1,0],[1,-1],[0,2],[1,2]],
    '1>2':[[0,0],[1,0],[1,-1],[0,2],[1,2]],
    '2>1':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '2>3':[[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    '3>2':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '3>0':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '0>3':[[0,0],[1,0],[1,1],[0,-2],[1,-2]]
  };
  var KICK_I = {
    '0>1':[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
    '1>0':[[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
    '1>2':[[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
    '2>1':[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
    '2>3':[[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
    '3>2':[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
    '3>0':[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
    '0>3':[[0,0],[-1,0],[2,0],[-1,2],[2,-1]]
  };
  var COLS = 10, ROWS = 20, tt = null, ttRAF = null;

  function rotCW(m){
    var n = m.length, r = [];
    for(var y=0;y<n;y++){ r.push([]); for(var x=0;x<n;x++) r[y].push(m[n-1-x][y]); }
    return r;
  }
  function newBag(){
    var b = ['I','O','T','S','Z','J','L'];
    for(var i=b.length-1;i>0;i--){
      var j = Math.floor(Math.random()*(i+1));
      var t = b[i]; b[i] = b[j]; b[j] = t;
    }
    return b;
  }
  function spawn(){
    if(tt.bag.length < 2) tt.bag = tt.bag.concat(newBag());
    var id = tt.bag.shift();
    tt.p = { id:id, m:SHAPES[id].m.map(function(r){ return r.slice(); }),
             r:0, x:Math.floor((COLS - SHAPES[id].m.length)/2), y:0 };
    tt.held = false;
    if(collides(tt.p.m, tt.p.x, tt.p.y)){
      tt.over = true;
      var rec = setBest('tetris', tt.score);
      document.getElementById('tetrisStatus').textContent =
        rec ? 'New best: '+tt.score+'!' : 'Game over \u00b7 '+tt.score;
      AG2.refreshLabels();
    }
  }
  function collides(m,px,py){
    for(var y=0;y<m.length;y++)for(var x=0;x<m[y].length;x++){
      if(!m[y][x]) continue;
      var bx = px+x, by = py+y;
      if(bx<0 || bx>=COLS || by>=ROWS) return true;
      if(by>=0 && tt.grid[by][bx]) return true;
    }
    return false;
  }
  function lock(){
    var p = tt.p;
    for(var y=0;y<p.m.length;y++)for(var x=0;x<p.m[y].length;x++){
      if(p.m[y][x] && p.y+y >= 0) tt.grid[p.y+y][p.x+x] = SHAPES[p.id].c;
    }
    var cleared = 0;
    for(var r=ROWS-1;r>=0;r--){
      if(tt.grid[r].every(function(v){ return v; })){
        tt.grid.splice(r,1);
        tt.grid.unshift(new Array(COLS).fill(0));
        cleared++; r++;
      }
    }
    if(cleared){
      tt.lines += cleared;
      tt.score += [0,100,300,500,800][cleared] * tt.level;
      tt.level = Math.floor(tt.lines/10) + 1;
      document.getElementById('tetrisStatus').textContent =
        cleared === 4 ? 'TETRIS!' : cleared+' line'+(cleared>1?'s':'');
    }
    spawn();
  }
  function tryRotate(dir){
    var p = tt.p;
    if(p.id === 'O') return;
    var from = p.r, to = (p.r + (dir>0?1:3)) % 4;
    var m = p.m;
    var turns = dir>0 ? 1 : 3;
    for(var i=0;i<turns;i++) m = rotCW(m);
    var table = (p.id === 'I' ? KICK_I : KICK)[from+'>'+to] || [[0,0]];
    for(var k=0;k<table.length;k++){
      var dx = table[k][0], dy = -table[k][1];   // SRS y is up; screen y is down
      if(!collides(m, p.x+dx, p.y+dy)){
        p.m = m; p.x += dx; p.y += dy; p.r = to;
        return;
      }
    }
  }
  function ghostY(){
    var y = tt.p.y;
    while(!collides(tt.p.m, tt.p.x, y+1)) y++;
    return y;
  }

  AG2.tetrisInit = function(){
    tt = { grid:[], bag:newBag(), p:null, hold:null, held:false,
           score:0, lines:0, level:1, over:false, last:0, acc:0, paused:false };
    for(var r=0;r<ROWS;r++) tt.grid.push(new Array(COLS).fill(0));
    spawn();
    document.getElementById('tetrisStatus').textContent = '\u2190\u2192 move \u00b7 \u2191 rotate \u00b7 space drop';
    ttDraw();
    if(ttRAF) cancelAnimationFrame(ttRAF);
    ttLoop(0);
  };
  AG2.tetrisStop = function(){ if(ttRAF) cancelAnimationFrame(ttRAF); ttRAF = null; };
  AG2.tetrisRestart = function(){ AG2.tetrisInit(); };
  AG2.tetrisHold = function(){
    if(!tt || tt.over || tt.held) return;
    var cur = tt.p.id;
    if(tt.hold){ tt.bag.unshift(tt.hold); }
    tt.hold = cur;
    spawn();
    tt.held = true;
    ttDraw();
  };
  AG2.tetrisMove = function(dx){
    if(!tt || tt.over) return;
    if(!collides(tt.p.m, tt.p.x+dx, tt.p.y)) tt.p.x += dx;
    ttDraw();
  };
  AG2.tetrisRotate = function(d){ if(tt && !tt.over){ tryRotate(d); ttDraw(); } };
  AG2.tetrisSoft = function(){
    if(!tt || tt.over) return;
    if(!collides(tt.p.m, tt.p.x, tt.p.y+1)){ tt.p.y++; tt.score += 1; }
    ttDraw();
  };
  AG2.tetrisHard = function(){
    if(!tt || tt.over) return;
    var g = ghostY();
    tt.score += (g - tt.p.y) * 2;
    tt.p.y = g;
    lock();
    ttDraw();
  };

  function ttLoop(t){
    ttRAF = requestAnimationFrame(ttLoop);
    if(!tt || tt.over || tt.paused) return;
    // Gravity: 800ms at level 1, floor of 80ms.
    var step = Math.max(80, 800 - (tt.level-1)*70);
    if(t - tt.last < step) return;
    tt.last = t;
    if(!collides(tt.p.m, tt.p.x, tt.p.y+1)) tt.p.y++;
    else lock();
    ttDraw();
  }

  function ttDraw(){
    var cv = document.getElementById('tetrisCanvas');
    if(!cv || !tt) return;
    var g = cv.getContext('2d');
    var CELL = cv.width / COLS;
    var css = getComputedStyle(document.documentElement);
    g.fillStyle = css.getPropertyValue('--bg').trim() || '#eef1f5';
    g.fillRect(0,0,cv.width,cv.height);
    // settled blocks
    for(var y=0;y<ROWS;y++)for(var x=0;x<COLS;x++){
      if(!tt.grid[y][x]) continue;
      g.fillStyle = tt.grid[y][x];
      g.beginPath(); g.roundRect(x*CELL+1, y*CELL+1, CELL-2, CELL-2, 3); g.fill();
    }
    if(tt.p && !tt.over){
      var gy = ghostY();
      // ghost first, so the live piece paints over it
      g.globalAlpha = .22;
      g.fillStyle = SHAPES[tt.p.id].c;
      drawPiece(g, tt.p.m, tt.p.x, gy, CELL);
      g.globalAlpha = 1;
      g.fillStyle = SHAPES[tt.p.id].c;
      drawPiece(g, tt.p.m, tt.p.x, tt.p.y, CELL);
    }
    var sc = document.getElementById('tetrisScore');
    if(sc) sc.textContent = tt.score;
    var ln = document.getElementById('tetrisLines');
    if(ln) ln.textContent = tt.lines;
    var lv = document.getElementById('tetrisLevel');
    if(lv) lv.textContent = tt.level;
    drawMini('tetrisHoldCv', tt.hold);
    drawMini('tetrisNextCv', tt.bag[0]);
  }
  function drawPiece(g,m,px,py,CELL){
    for(var y=0;y<m.length;y++)for(var x=0;x<m[y].length;x++){
      if(!m[y][x] || py+y < 0) continue;
      g.beginPath();
      g.roundRect((px+x)*CELL+1, (py+y)*CELL+1, CELL-2, CELL-2, 3);
      g.fill();
    }
  }
  function drawMini(id, pieceId){
    var cv = document.getElementById(id);
    if(!cv) return;
    var g = cv.getContext('2d');
    g.clearRect(0,0,cv.width,cv.height);
    if(!pieceId) return;
    var m = SHAPES[pieceId].m, C = cv.width/5;
    g.fillStyle = SHAPES[pieceId].c;
    var off = (5 - m.length)/2;
    for(var y=0;y<m.length;y++)for(var x=0;x<m[y].length;x++){
      if(!m[y][x]) continue;
      g.beginPath();
      g.roundRect((x+off)*C+1, (y+off)*C+1, C-2, C-2, 2);
      g.fill();
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     CONNECT 4
     Alpha-beta minimax. Depth is the difficulty: 2 is beatable while
     distracted, 6 will punish a careless centre give-away.
     ══════════════════════════════════════════════════════════════════ */
  var C4W = 7, C4H = 6, c4 = null;
  var C4DEPTH = { easy:2, normal:4, hard:6 };

  AG2.connectInit = function(diff){
    c4 = { g:[], turn:1, over:false, busy:false, win:null,
           diff: diff || (c4 && c4.diff) || 'normal',
           streak: c4 ? c4.streak : 0 };
    for(var r=0;r<C4H;r++) c4.g.push(new Array(C4W).fill(0));
    c4Render();
    document.getElementById('connectStatus').textContent = 'Your move \u00b7 red';
    var seg = document.getElementById('connectSeg');
    if(seg) Array.prototype.forEach.call(seg.children, function(b){
      b.classList.toggle('on', b.dataset.diff === c4.diff);
    });
  };
  AG2.connectStop = function(){};
  AG2.connectRestart = function(){ AG2.connectInit(c4 ? c4.diff : 'normal'); };
  AG2.connectDiff = function(d){
    var s = c4 ? c4.streak : 0;
    AG2.connectInit(d);
    c4.streak = s;
  };

  function c4Drop(g,col,player){
    for(var r=C4H-1;r>=0;r--) if(!g[r][col]){ g[r][col] = player; return r; }
    return -1;
  }
  function c4Valid(g){
    var out = [];
    for(var c=0;c<C4W;c++) if(!g[0][c]) out.push(c);
    return out;
  }
  /** Returns the four winning cells, or null. */
  function c4Win(g,player){
    var dirs = [[0,1],[1,0],[1,1],[1,-1]];
    for(var r=0;r<C4H;r++)for(var c=0;c<C4W;c++){
      if(g[r][c] !== player) continue;
      for(var d=0;d<dirs.length;d++){
        var cells = [[r,c]], ok = true;
        for(var k=1;k<4;k++){
          var nr = r+dirs[d][0]*k, nc = c+dirs[d][1]*k;
          if(nr<0||nr>=C4H||nc<0||nc>=C4W||g[nr][nc]!==player){ ok = false; break; }
          cells.push([nr,nc]);
        }
        if(ok) return cells;
      }
    }
    return null;
  }
  function c4Score(g,me){
    var them = me === 1 ? 2 : 1, s = 0;
    function win4(cells){
      var mine = 0, theirs = 0, empty = 0;
      cells.forEach(function(v){ v===me?mine++ : v===them?theirs++ : empty++; });
      if(mine===4) return 100000;
      if(theirs===4) return -100000;
      if(mine===3 && empty===1) return 60;
      if(mine===2 && empty===2) return 8;
      if(theirs===3 && empty===1) return -75;   // block slightly harder than build
      if(theirs===2 && empty===2) return -8;
      return 0;
    }
    var r,c,k;
    for(r=0;r<C4H;r++)for(c=0;c<C4W;c++){
      if(c+3<C4W) s += win4([g[r][c],g[r][c+1],g[r][c+2],g[r][c+3]]);
      if(r+3<C4H) s += win4([g[r][c],g[r+1][c],g[r+2][c],g[r+3][c]]);
      if(r+3<C4H && c+3<C4W) s += win4([g[r][c],g[r+1][c+1],g[r+2][c+2],g[r+3][c+3]]);
      if(r+3<C4H && c-3>=0)  s += win4([g[r][c],g[r+1][c-1],g[r+2][c-2],g[r+3][c-3]]);
    }
    // Centre control is worth real tempo in Connect 4.
    for(r=0;r<C4H;r++) if(g[r][3]===me) s += 6; else if(g[r][3]===them) s -= 6;
    return s;
  }
  function c4Minimax(g,depth,alpha,beta,maxing){
    var valid = c4Valid(g);
    var over = c4Win(g,2) || c4Win(g,1);
    if(depth === 0 || over || !valid.length){
      if(c4Win(g,2)) return [null, 1000000 + depth];
      if(c4Win(g,1)) return [null, -1000000 - depth];
      if(!valid.length) return [null, 0];
      return [null, c4Score(g,2)];
    }
    // Centre-first ordering makes alpha-beta prune far more.
    valid.sort(function(a,b){ return Math.abs(3-a) - Math.abs(3-b); });
    var bestCol = valid[0], v;
    if(maxing){
      v = -Infinity;
      for(var i=0;i<valid.length;i++){
        var gg = g.map(function(r){ return r.slice(); });
        c4Drop(gg, valid[i], 2);
        var sc = c4Minimax(gg, depth-1, alpha, beta, false)[1];
        if(sc > v){ v = sc; bestCol = valid[i]; }
        alpha = Math.max(alpha, v);
        if(alpha >= beta) break;
      }
    }else{
      v = Infinity;
      for(var j=0;j<valid.length;j++){
        var g2 = g.map(function(r){ return r.slice(); });
        c4Drop(g2, valid[j], 1);
        var s2 = c4Minimax(g2, depth-1, alpha, beta, true)[1];
        if(s2 < v){ v = s2; bestCol = valid[j]; }
        beta = Math.min(beta, v);
        if(alpha >= beta) break;
      }
    }
    return [bestCol, v];
  }

  AG2.connectPlay = function(col){
    if(!c4 || c4.over || c4.busy) return;
    if(c4.g[0][col]) return;                    // column full
    c4Drop(c4.g, col, 1);
    c4Render();
    if(c4End(1)) return;
    c4.busy = true;
    document.getElementById('connectStatus').textContent = 'Thinking\u2026';
    // Yield so the player's disc paints before the search blocks the thread.
    setTimeout(function(){
      var mv = c4Minimax(c4.g, C4DEPTH[c4.diff], -Infinity, Infinity, true)[0];
      if(mv === null || mv === undefined) mv = c4Valid(c4.g)[0];
      if(mv !== undefined) c4Drop(c4.g, mv, 2);
      c4.busy = false;
      c4Render();
      if(!c4End(2)) document.getElementById('connectStatus').textContent = 'Your move \u00b7 red';
    }, 60);
  };
  function c4End(player){
    var cells = c4Win(c4.g, player);
    if(cells){
      c4.over = true; c4.win = cells;
      c4Render();
      if(player === 1){
        c4.streak++;
        var rec = setBest('connect', c4.streak);
        document.getElementById('connectStatus').textContent =
          rec ? 'You win! Best streak: '+c4.streak : 'You win \u00b7 streak '+c4.streak;
        AG2.refreshLabels();
      }else{
        c4.streak = 0;
        document.getElementById('connectStatus').textContent = 'Beaten \u00b7 streak reset';
      }
      return true;
    }
    if(!c4Valid(c4.g).length){
      c4.over = true;
      document.getElementById('connectStatus').textContent = 'Draw';
      return true;
    }
    return false;
  }
  function c4Render(){
    var host = document.getElementById('connectGrid');
    if(!host || !c4) return;
    host.classList.toggle('busy', !!c4.busy);
    var winKey = {};
    if(c4.win) c4.win.forEach(function(p){ winKey[p[0]+','+p[1]] = 1; });
    var out = '';
    for(var r=0;r<C4H;r++)for(var c=0;c<C4W;c++){
      var v = c4.g[r][c];
      var cls = 'ag2-slot' + (v===1?' p1':v===2?' p2':'') +
                (winKey[r+','+c]?' win':'');
      out += '<div class="'+cls+'" data-col="'+c+'"></div>';
    }
    host.innerHTML = out;
  }

  /* ══════════════════════════════════════════════════════════════════
     REGISTRY + HOST WIRING
     ══════════════════════════════════════════════════════════════════ */
  var GAMES = {
    mines  : { init:function(){ AG2.minesInit(); },   stop:function(){ AG2.minesStop(); } },
    tetris : { init:function(){ AG2.tetrisInit(); },  stop:function(){ AG2.tetrisStop(); } },
    connect: { init:function(){ AG2.connectInit(); }, stop:function(){ AG2.connectStop(); } }
  };

  /* The first batch (arcade-games.js) expects arcade.html's own openGame to
     call snakeInit/brickInit/slideInit. Rather than make you hand-edit
     arcade.html for those too, the wrapper can dispatch them — but ONLY if
     arcade.html isn't already doing it. Double-dispatch is not harmless here:
     snakeInit starts a requestAnimationFrame loop, so calling it twice runs
     two loops at once and the snake moves at double speed.
     So: read the original openGame's source and skip any game it already
     names. Crude, but it is the one signal that is actually reliable. */
  function adoptFirstBatch(origOpen){
    var src = '';
    try{ src = String(origOpen || ''); }catch(e){}
    ['snake','brick','slide'].forEach(function(id){
      if(src.indexOf(id + 'Init') !== -1) return;          // host already does it
      if(typeof window[id + 'Init'] !== 'function') return; // module not loaded
      GAMES[id] = {
        init: function(){ window[id+'Init'](); },
        stop: function(){ if(typeof window[id+'Stop']==='function') window[id+'Stop'](); }
      };
    });
  }

  AG2.refreshLabels = function(){
    var e = document.getElementById('best-mines');
    if(e){ var t = best(LEVELS.medium.key); e.textContent = 'BEST: ' + (t ? mmss(t) : '\u2014'); }
    var t2 = document.getElementById('best-tetris');
    if(t2) t2.textContent = 'BEST: ' + best('tetris');
    var c = document.getElementById('best-connect');
    if(c) c.textContent = 'STREAK: ' + best('connect');
  };

  /** Wrap the host's three entry points instead of editing arcade.html. */
  function installHooks(){
    if(window.__ag2Hooked) return;
    window.__ag2Hooked = true;

    var origOpen = window.openGame;
    adoptFirstBatch(origOpen);
    window.openGame = function(g){
      if(typeof origOpen === 'function') origOpen.apply(this, arguments);
      if(GAMES[g]){
        try{ GAMES[g].init(); }catch(err){ console.error('[AG2] init '+g, err); }
      }
    };

    var origClose = window.closeGame;
    window.closeGame = function(){
      if(typeof origClose === 'function') origClose.apply(this, arguments);
      Object.keys(GAMES).forEach(function(k){
        try{ GAMES[k].stop(); }catch(err){}
      });
    };

    var origRefresh = window.refreshBests;
    window.refreshBests = function(){
      if(typeof origRefresh === 'function') origRefresh.apply(this, arguments);
      AG2.refreshLabels();
    };
  }

  function mount(){
    if(document.getElementById('arcade-games2-css')) return;
    var st = document.createElement('style');
    st.id = 'arcade-games2-css';
    st.textContent = CSS;
    document.head.appendChild(st);

    var wrap = document.querySelector('.wrap');
    if(!wrap) return;

    var html =
      screen('mines','MINESWEEPER','minesStatus',
        '<div class="ag-stage">'+
          '<div class="ag-row">'+
            '<div class="ag2-seg" id="minesSeg">'+
              '<button data-lvl="easy"   onclick="AG2.minesLevel(\'easy\')">9\u00d79</button>'+
              '<button data-lvl="medium" class="on" onclick="AG2.minesLevel(\'medium\')">12\u00d712</button>'+
              '<button data-lvl="hard"   onclick="AG2.minesLevel(\'hard\')">16\u00d716</button>'+
            '</div>'+
          '</div>'+
          '<div class="ag2-mines" id="minesGrid"></div>'+
          '<div class="ag-row">'+
            '<button class="ag-btn" id="minesFlagBtn" onclick="AG2.minesFlagMode()">\u{1F6A9} Flag mode</button>'+
            '<button class="ag-btn primary" onclick="AG2.minesRestart()">New board</button>'+
          '</div>'+
          '<p class="ag-hint">Right-click to flag, or use flag mode on touch. Click a satisfied number to open its neighbours. The first click is always safe.</p>'+
        '</div>') +
      screen('tetris','TETRIS','tetrisStatus',
        '<div class="ag-stage">'+
          '<div class="ag2-tetris">'+
            '<canvas class="ag-canvas" id="tetrisCanvas" width="250" height="500"></canvas>'+
            '<div class="ag2-side">'+
              '<div class="ag2-box"><h4>Score</h4><div class="ag2-stat" id="tetrisScore">0</div></div>'+
              '<div class="ag2-box"><h4>Next</h4><canvas id="tetrisNextCv" width="70" height="70"></canvas></div>'+
              '<div class="ag2-box"><h4>Hold</h4><canvas id="tetrisHoldCv" width="70" height="70"></canvas></div>'+
              '<div class="ag2-box"><h4>Lines</h4><div class="ag2-stat" id="tetrisLines">0</div></div>'+
              '<div class="ag2-box"><h4>Level</h4><div class="ag2-stat" id="tetrisLevel">1</div></div>'+
            '</div>'+
          '</div>'+
          '<div class="ag-row">'+
            '<button class="ag-btn" onclick="AG2.tetrisHold()">Hold</button>'+
            '<button class="ag-btn primary" onclick="AG2.tetrisRestart()">Restart</button>'+
          '</div>'+
          '<p class="ag-hint">\u2190\u2192 move \u00b7 \u2191 or X rotate \u00b7 Z rotate back \u00b7 \u2193 soft drop \u00b7 space hard drop \u00b7 C hold. On touch: swipe to move, tap to rotate, swipe up to drop.</p>'+
        '</div>') +
      screen('connect','CONNECT 4','connectStatus',
        '<div class="ag-stage">'+
          '<div class="ag-row">'+
            '<div class="ag2-seg" id="connectSeg">'+
              '<button data-diff="easy"   onclick="AG2.connectDiff(\'easy\')">Easy</button>'+
              '<button data-diff="normal" class="on" onclick="AG2.connectDiff(\'normal\')">Normal</button>'+
              '<button data-diff="hard"   onclick="AG2.connectDiff(\'hard\')">Hard</button>'+
            '</div>'+
          '</div>'+
          '<div class="ag2-c4" id="connectGrid"></div>'+
          '<div class="ag-row">'+
            '<button class="ag-btn primary" onclick="AG2.connectRestart()">New game</button>'+
          '</div>'+
          '<p class="ag-hint">You are red and move first. Click a column to drop. Hard searches six moves ahead \u2014 it will take the centre if you leave it.</p>'+
        '</div>');

    wrap.insertAdjacentHTML('beforeend', html);

    var menu = document.querySelector('.menu');
    if(menu){
      menu.insertAdjacentHTML('beforeend',
        '<div class="game-card" style="--accent:#8b5cc9;" onclick="openGame(\'mines\')">'+
          '<span class="ico">\u{1F4A3}</span><h3>MINESWEEPER</h3>'+
          '<p>Pure deduction, three board sizes, and a first click that is always safe. Chording included, so it plays like the real thing.</p>'+
          '<div class="best" id="best-mines" style="color:#8b5cc9;">BEST: \u2014</div>'+
        '</div>'+
        '<div class="game-card" style="--accent:#2d9d94;" onclick="openGame(\'tetris\')">'+
          '<span class="ico">\u{1F9E9}</span><h3>TETRIS</h3>'+
          '<p>Seven-bag randomiser, wall kicks, hold slot and a ghost piece. It gets faster every ten lines.</p>'+
          '<div class="best" id="best-tetris" style="color:#2d9d94;">BEST: 0</div>'+
        '</div>'+
        '<div class="game-card" style="--accent:#e05a3f;" onclick="openGame(\'connect\')">'+
          '<span class="ico">\u{1F534}</span><h3>CONNECT 4</h3>'+
          '<p>An opponent that actually thinks \u2014 alpha-beta search at three depths. Beat it on Hard and keep the streak alive.</p>'+
          '<div class="best" id="best-connect" style="color:#e05a3f;">STREAK: 0</div>'+
        '</div>');
    }

    bindInput();
    installHooks();
    AG2.refreshLabels();
  }

  function activeGame(){
    var el = document.querySelector('.screen.active');
    if(!el) return null;
    var m = /^screen-(.+)$/.exec(el.id);
    return m ? m[1] : null;
  }

  function bindInput(){
    /* Delegated clicks — the grids are re-rendered constantly, so per-cell
       listeners would have to be rebound on every single render. */
    document.addEventListener('click', function(e){
      var cell = e.target.closest ? e.target.closest('.ag2-cell') : null;
      if(cell && activeGame() === 'mines'){
        AG2.minesClick(+cell.dataset.x, +cell.dataset.y, false);
        return;
      }
      var slot = e.target.closest ? e.target.closest('.ag2-slot') : null;
      if(slot && activeGame() === 'connect'){
        AG2.connectPlay(+slot.dataset.col);
      }
    });
    document.addEventListener('contextmenu', function(e){
      var cell = e.target.closest ? e.target.closest('.ag2-cell') : null;
      if(cell && activeGame() === 'mines'){
        e.preventDefault();
        AG2.minesClick(+cell.dataset.x, +cell.dataset.y, true);
      }
    });

    document.addEventListener('keydown', function(e){
      if(activeGame() !== 'tetris') return;
      var k = e.key;
      if(k==='ArrowLeft')  { e.preventDefault(); AG2.tetrisMove(-1); }
      else if(k==='ArrowRight'){ e.preventDefault(); AG2.tetrisMove(1); }
      else if(k==='ArrowDown') { e.preventDefault(); AG2.tetrisSoft(); }
      else if(k==='ArrowUp' || k==='x' || k==='X'){ e.preventDefault(); AG2.tetrisRotate(1); }
      else if(k==='z' || k==='Z'){ e.preventDefault(); AG2.tetrisRotate(-1); }
      else if(k===' '){ e.preventDefault(); AG2.tetrisHard(); }
      else if(k==='c' || k==='C'){ e.preventDefault(); AG2.tetrisHold(); }
    });

    // Touch: swipe to move/drop, tap to rotate.
    var sx=0, sy=0, st=0, tracking=false;
    document.addEventListener('touchstart', function(e){
      if(activeGame() !== 'tetris') return;
      tracking = true; st = Date.now();
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    }, {passive:true});
    document.addEventListener('touchend', function(e){
      if(!tracking || activeGame() !== 'tetris') return;
      tracking = false;
      var t = e.changedTouches[0];
      var dx = t.clientX - sx, dy = t.clientY - sy;
      if(Math.abs(dx) < 22 && Math.abs(dy) < 22){
        if(Date.now() - st < 300) AG2.tetrisRotate(1);   // tap
        return;
      }
      if(Math.abs(dx) > Math.abs(dy)){
        var steps = Math.min(4, Math.round(Math.abs(dx)/34));
        for(var i=0;i<Math.max(1,steps);i++) AG2.tetrisMove(dx>0?1:-1);
      }else if(dy > 0) AG2.tetrisSoft();
      else AG2.tetrisHard();
    }, {passive:true});
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
