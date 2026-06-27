/* =========================================================================
   Mister Munchy!  —  a mobile-first Pac-Man style game
   Input priority on touch: swipe (primary) + on-screen D-pad. Keyboard too.
   ========================================================================= */
(() => {
  "use strict";

  // ---- Maze layout ----------------------------------------------------------
  // # wall   . dot   o power pellet   - ghost-house door   (space) empty path
  // T tunnel mouth (walkable + wraps horizontally)
  const MAZE = [
    "############################",
    "#o........................o#",
    "#.####.##.##.##.##.##.####.#",
    "#.####.##.##.##.##.##.####.#",
    "#..........................#",
    "#.##.###.##.#..#.##.###.##.#",
    "#..........................#",
    "#.####.##.##.##.##.##.####.#",
    "#..........................#",
    "######.##### ## #####.######",
    "######.##### ## #####.######",
    "######.##          ##.######",
    "######.## ###--### ##.######",
    "######.## #      # ##.######",
    "T     .   #      #   .     T",
    "######.## #      # ##.######",
    "######.## ######## ##.######",
    "######.##          ##.######",
    "######.##### ## #####.######",
    "######.##### ## #####.######",
    "#..........................#",
    "#.####.##.##.##.##.##.####.#",
    "#o........................o#",
    "#.####.##..........##.####.#",
    "#.####.##.##.##.##.##.####.#",
    "#.####.##.##.##.##.##.####.#",
    "#..........................#",
    "#.####.##.##.##.##.##.####.#",
    "############################",
  ];

  const COLS = 28;
  const ROWS = MAZE.length;
  const TILE = 16;
  const W = COLS * TILE;
  const H = ROWS * TILE;

  const canvas = document.getElementById("board");
  // Render at device resolution for crisp neon lines on retina screens.
  const DPR = Math.min(2.5, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  const ctx = canvas.getContext("2d");

  const DOT_TOTAL = (() => {
    let n = 0;
    for (const row of MAZE) for (const ch of row) if (ch === "." || ch === "o") n++;
    return n;
  })();

  // ---- Directions -----------------------------------------------------------
  const DIRS = {
    up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
    left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, none: { x: 0, y: 0 },
  };
  const OPP = { up: "down", down: "up", left: "right", right: "left", none: "none" };

  // ---- Haptics --------------------------------------------------------------
  function buzz(pattern) {
    if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) {} }
  }

  // ---- Audio (procedural Web Audio — no asset files) ------------------------
  const Sound = {
    ctx: null, master: null, siren: null, chompFlip: false,
    muted: localStorage.getItem("munchy_muted") === "1",

    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);
    },
    resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); },
    setMuted(m) {
      this.muted = m;
      localStorage.setItem("munchy_muted", m ? "1" : "0");
      if (this.master) this.master.gain.value = m ? 0 : 0.9;
      if (m) this.stopSiren();
    },

    // one-shot tone with an exponential decay; optional pitch slide
    blip(freq, dur, type = "square", vol = 0.2, slideTo = null) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    },
    seq(notes, gap, dur, type, vol) {
      notes.forEach((f, i) => setTimeout(() => this.blip(f, dur, type, vol), i * gap));
    },

    chomp() { this.chompFlip = !this.chompFlip; this.blip(this.chompFlip ? 200 : 130, 0.05, "square", 0.14); },
    power() { this.blip(110, 0.3, "square", 0.22, 260); },
    eatGhost() { this.blip(180, 0.3, "square", 0.26, 920); buzz(45); },
    fruit() { this.seq([523, 659, 784, 1047], 65, 0.12, "triangle", 0.2); },
    extraLife() { this.seq([784, 988, 1319], 90, 0.16, "triangle", 0.22); },
    ready() { this.seq([392, 523, 659, 784], 150, 0.14, "square", 0.17); },
    death() { this.stopSiren(); this.seq([440, 392, 349, 311, 277, 233, 196, 165], 110, 0.16, "sawtooth", 0.24); buzz([70, 40, 130]); },

    startSiren() {
      if (!this.ctx || this.muted || this.siren) return;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      const lfo = this.ctx.createOscillator(), lg = this.ctx.createGain();
      o.type = "sawtooth"; o.frequency.value = 380;
      g.gain.value = 0.03;
      lfo.type = "sine"; lfo.frequency.value = 6; lg.gain.value = 60;
      lfo.connect(lg); lg.connect(o.frequency);
      o.connect(g); g.connect(this.master);
      o.start(); lfo.start();
      this.siren = { o, g, lfo, lg };
    },
    stopSiren() {
      if (!this.siren) return;
      try { this.siren.o.stop(); this.siren.lfo.stop(); } catch (e) {}
      this.siren = null;
    },
    // progress 0..1 (maze emptiness); mode "normal" | "frightened"
    updateSiren(mode, progress) {
      if (!this.siren) return;
      const s = this.siren;
      if (mode === "frightened") {
        s.o.type = "square"; s.o.frequency.value = 300; s.lfo.frequency.value = 15; s.lg.gain.value = 130;
      } else {
        s.o.type = "sawtooth"; s.o.frequency.value = 360 + progress * 240;
        s.lfo.frequency.value = 5 + progress * 5; s.lg.gain.value = 60;
      }
    },
  };

  function audioUnlock() { Sound.init(); Sound.resume(); }

  // ---- State ----------------------------------------------------------------
  let grid, dotsLeft;
  let score = 0;
  let high = Number(localStorage.getItem("munchy_high") || 0);
  let lives = 3, level = 1;
  let state = "menu"; // menu | ready | playing | paused | dying | levelclear | gameover
  let pac, ghosts, fruit = null, fruitCount = 0;
  let frightTimer = 0, ghostChain = 0;
  let modePhase = 0, modeTimer = 0, globalMode = "scatter";
  let animTick = 0, readyTimer = 0, dyingTimer = 0;
  let enemyKind = 0; // index into ENEMY_FN / ENEMY_NAMES — varies per level
  let popups = [];
  let particles = [];   // {x,y,vx,vy,life,decay,color,size}
  let pops = [];        // {x,y,r,maxR,life,color}  expanding rings
  let shake = 0;        // screen-shake magnitude (px), decays each frame
  let flash = 0;        // brief full-board flash alpha, decays
  let extraAwarded = false;

  const MODE_SCHEDULE = [
    { mode: "scatter", t: 7000 }, { mode: "chase", t: 20000 },
    { mode: "scatter", t: 7000 }, { mode: "chase", t: 20000 },
    { mode: "scatter", t: 5000 }, { mode: "chase", t: 20000 },
    { mode: "scatter", t: 5000 }, { mode: "chase", t: Infinity },
  ];

  const HOME = { col: 13, row: 14 };
  const PAC_START = { col: 13.5, row: 23 };
  const ENEMY_NAMES = ["Jellies", "Cyclopes", "Spiders", "Bats"];
  const eaten = () => DOT_TOTAL - dotsLeft;

  // ---- Tile helpers ---------------------------------------------------------
  const tileChar = (c, r) => {
    if (r < 0 || r >= ROWS) return "#";
    if (c < 0 || c >= COLS) return " ";
    return grid[r][c];
  };
  const isWall = (c, r, ghost) => {
    const ch = tileChar(c, r);
    if (ch === "#") return true;
    if (ch === "-") return !ghost; // door blocks Pac-Man only
    return false;
  };
  const px = (col) => col * TILE + TILE / 2;
  const colOf = (x) => Math.round((x - TILE / 2) / TILE);
  const rowOf = (y) => Math.round((y - TILE / 2) / TILE);

  // ---- Maze pre-render (classic thin neon walls) ----------------------------
  // Walls never change, so we trace them once into an offscreen canvas and blit
  // it each frame. Each wall edge that faces open space becomes a thin glowing
  // line, inset slightly so corners round and corridors read wide and open.
  const mazeChar = (c, r) => {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return "#"; // off-grid = wall
    return MAZE[r][c];
  };
  const wallCanvas = (() => {
    const cvs = document.createElement("canvas");
    cvs.width = Math.round(W * DPR);
    cvs.height = Math.round(H * DPR);
    const g = cvs.getContext("2d");
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.lineCap = "round";
    g.lineJoin = "round";
    const open = (c, r) => mazeChar(c, r) !== "#"; // door counts as open for outlining
    const M = 3.2; // inset from tile boundary into the wall
    // glowing neon stroke
    g.shadowColor = "#4f6bff";
    g.shadowBlur = 6;
    g.strokeStyle = "#3550ff";
    g.lineWidth = 2.4;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (mazeChar(c, r) !== "#") continue;
        const x0 = c * TILE, y0 = r * TILE, x1 = x0 + TILE, y1 = y0 + TILE;
        const U = open(c, r - 1), D = open(c, r + 1), L = open(c - 1, r), R = open(c + 1, r);
        g.beginPath();
        if (U) { g.moveTo(L ? x0 + M : x0, y0 + M); g.lineTo(R ? x1 - M : x1, y0 + M); }
        if (D) { g.moveTo(L ? x0 + M : x0, y1 - M); g.lineTo(R ? x1 - M : x1, y1 - M); }
        if (L) { g.moveTo(x0 + M, U ? y0 + M : y0); g.lineTo(x0 + M, D ? y1 - M : y1); }
        if (R) { g.moveTo(x1 - M, U ? y0 + M : y0); g.lineTo(x1 - M, D ? y1 - M : y1); }
        g.stroke();
      }
    }
    // ghost-house door (pink bar)
    g.shadowColor = "#ff7bd5";
    g.shadowBlur = 5;
    g.strokeStyle = "#ff7bd5";
    g.lineWidth = 3;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (MAZE[r][c] !== "-") continue;
        g.beginPath();
        g.moveTo(c * TILE, r * TILE + TILE / 2);
        g.lineTo(c * TILE + TILE, r * TILE + TILE / 2);
        g.stroke();
      }
    }
    return cvs;
  })();

  // ---- Setup ----------------------------------------------------------------
  function resetGrid() {
    grid = MAZE.map((row) => row.split(""));
    dotsLeft = DOT_TOTAL;
  }

  function startLevel() {
    resetGrid();
    fruit = null; fruitCount = 0;
    enemyKind = (level - 1) % ENEMY_FN.length; // a different creature each level
    modePhase = 0; modeTimer = 0; globalMode = MODE_SCHEDULE[0].mode;
  }

  function makeGhost(name, color, col, row, scatter, releaseAt) {
    return {
      name, color, x: px(col), y: px(row), dir: "up", scatter,
      mode: "house", released: releaseAt === 0, releaseAt,
    };
  }

  function beginRound() {
    pac = { x: px(PAC_START.col), y: px(PAC_START.row), dir: "left", want: "left" };
    ghosts = [
      makeGhost("blinky", "#ff2d2d", 13, 11, { col: 25, row: 0 }, 0),
      makeGhost("pinky", "#ff9ce0", 13, 14, { col: 2, row: 0 }, 0),
      makeGhost("inky", "#3cf0ff", 11, 14, { col: 27, row: ROWS - 1 }, 12),
      makeGhost("clyde", "#ffb852", 16, 14, { col: 0, row: ROWS - 1 }, 32),
    ];
    frightTimer = 0; ghostChain = 0;
    readyTimer = 1500;
    particles = []; pops = []; shake = 0; flash = 0;
    state = "ready";
    Sound.stopSiren();
    Sound.ready();
  }

  function startGame() {
    score = 0; lives = 3; level = 1; extraAwarded = false;
    startLevel(); beginRound(); hideOverlay(); updateHUD();
  }

  function nextLevel() {
    level++; startLevel(); beginRound(); updateHUD();
  }

  function loseLife() {
    lives--; updateHUD();
    if (lives <= 0) {
      state = "gameover";
      if (score > high) { high = score; localStorage.setItem("munchy_high", String(high)); }
      updateHUD();
      showOverlay("Game Over", `You scored ${score}.` + (score >= high ? " New high score! ⭐" : " Try again?"), "Play Again");
    } else {
      beginRound();
    }
  }

  // ---- Movement: advance to the next tile centre, decide there --------------
  function tunnelWrap(e) {
    if (e.x < -TILE / 2) e.x = W + TILE / 2 - 1;
    else if (e.x > W + TILE / 2) e.x = -TILE / 2 + 1;
  }

  function canStep(e, dir, ghost) {
    return !isWall(colOf(e.x) + DIRS[dir].x, rowOf(e.y) + DIRS[dir].y, ghost);
  }

  // Move `e` forward by `dist`, invoking onCenter() each time it lands exactly
  // on a tile centre. onCenter returns false to halt (wall ahead).
  function advance(e, dist, onCenter) {
    let move = dist, guard = 0;
    while (move > 1e-6 && guard++ < 64) {
      const cx = px(colOf(e.x)), cy = px(rowOf(e.y));
      if (Math.abs(e.x - cx) < 1e-4 && Math.abs(e.y - cy) < 1e-4) {
        e.x = cx; e.y = cy;
        if (!onCenter(e)) return;
      }
      const d = DIRS[e.dir];
      if (d.x === 0 && d.y === 0) return;
      // distance to the next centre along travel axis
      let gap;
      if (d.x !== 0) {
        const k = (e.x - TILE / 2) / TILE;
        gap = Math.abs(((d.x > 0 ? Math.floor(k) + 1 : Math.ceil(k) - 1) * TILE + TILE / 2) - e.x);
      } else {
        const k = (e.y - TILE / 2) / TILE;
        gap = Math.abs(((d.y > 0 ? Math.floor(k) + 1 : Math.ceil(k) - 1) * TILE + TILE / 2) - e.y);
      }
      if (gap < 1e-9) gap = TILE;
      const m = Math.min(move, gap);
      e.x += d.x * m; e.y += d.y * m; move -= m;
      tunnelWrap(e);
      if (m < gap - 1e-9) break; // stopped between centres
    }
  }

  // ---- Pac-Man --------------------------------------------------------------
  function pacSpeed() { return 1.55 + Math.min(level - 1, 5) * 0.04; }

  function pacCenter(p) {
    const c = colOf(p.x), r = rowOf(p.y);
    const ch = grid[r][c];
    if (ch === ".") { grid[r][c] = " "; dotsLeft--; addScore(10); Sound.chomp(); spawnPop(px(c), px(r), "rgba(255,235,180,A)", 7); checkFruit(); checkWin(); }
    else if (ch === "o") {
      grid[r][c] = " "; dotsLeft--; addScore(50); Sound.power();
      spawnPop(px(c), px(r), "rgba(255,210,77,A)", 26); addShake(2.5); addFlash(0.18);
      enterFrightened(); checkFruit(); checkWin();
    }
    if (state !== "playing") return false;
    if (p.want !== p.dir && canStep(p, p.want, false)) p.dir = p.want;
    return canStep(p, p.dir, false);
  }

  function checkWin() {
    if (dotsLeft <= 0 && state === "playing") {
      state = "levelclear";
      setTimeout(() => { if (state === "levelclear") nextLevel(); }, 1000);
    }
  }

  // ---- Ghost AI -------------------------------------------------------------
  function ghostTarget(g) {
    if (g.mode === "eyes") return HOME;
    if (g.mode === "house") return { col: 13.5, row: 11 };
    if (globalMode === "scatter") return g.scatter;
    const pc = colOf(pac.x), pr = rowOf(pac.y), d = DIRS[pac.dir];
    if (g.name === "blinky") return { col: pc, row: pr };
    if (g.name === "pinky") return { col: pc + d.x * 4, row: pr + d.y * 4 };
    if (g.name === "inky") {
      const b = ghosts[0], bc = colOf(b.x), br = rowOf(b.y);
      const ax = pc + d.x * 2, ay = pr + d.y * 2;
      return { col: ax + (ax - bc), row: ay + (ay - br) };
    }
    const dist = Math.hypot(pc - colOf(g.x), pr - rowOf(g.y));
    return dist > 8 ? { col: pc, row: pr } : g.scatter;
  }

  function ghostCenter(g) {
    const c = colOf(g.x), r = rowOf(g.y);
    let opts = ["up", "left", "down", "right"].filter(
      (dir) => dir !== OPP[g.dir] && canStep(g, dir, true)
    );
    if (!opts.length) opts = [OPP[g.dir]];
    if (g.mode === "frightened") {
      g.dir = opts[Math.floor(Math.random() * opts.length)];
    } else {
      const t = ghostTarget(g);
      let best = opts[0], bd = Infinity;
      for (const dir of opts) {
        const dd = (c + DIRS[dir].x - t.col) ** 2 + (r + DIRS[dir].y - t.row) ** 2;
        if (dd < bd) { bd = dd; best = dir; }
      }
      g.dir = best;
    }
    return true;
  }

  function ghostSpeed(g) {
    let s = 1.4 + Math.min(level - 1, 4) * 0.05;
    if (g.mode === "frightened") s = 0.92;
    else if (g.mode === "eyes") s = 3.4;
    else if (g.mode === "house") s = 0.95;
    if (rowOf(g.y) === 14 && (g.x < TILE * 5 || g.x > W - TILE * 5)) s *= 0.55; // tunnel
    return s;
  }

  function updateGhostMode(g) {
    if (!g.released && eaten() >= g.releaseAt) g.released = true;
    if (g.mode === "eyes") {
      if (Math.abs(g.x - px(HOME.col)) < 6 && Math.abs(g.y - px(HOME.row)) < 6) {
        g.mode = "house"; g.released = true; g.dir = "up";
      }
    } else if (g.mode === "house" && g.released) {
      if (rowOf(g.y) <= 11) { g.mode = globalMode; g.dir = "up"; } // emerged above the door
    }
  }

  // ---- Frightened -----------------------------------------------------------
  function enterFrightened() {
    frightTimer = Math.max(2000, 7000 - (level - 1) * 600);
    ghostChain = 0;
    for (const g of ghosts) if (g.mode === "scatter" || g.mode === "chase") {
      g.mode = "frightened"; g.dir = OPP[g.dir];
    }
  }

  // ---- Collisions -----------------------------------------------------------
  function checkCollisions() {
    for (const g of ghosts) {
      if (Math.hypot(g.x - pac.x, g.y - pac.y) < TILE * 0.72) {
        if (g.mode === "frightened") {
          g.mode = "eyes";
          const pts = [200, 400, 800, 1600][Math.min(ghostChain, 3)];
          ghostChain++; addScore(pts); Sound.eatGhost(); popups.push({ x: g.x, y: g.y, txt: pts, life: 1000 });
          spawnBurst(g.x, g.y, "#3cf0ff", 16, 2.6); spawnPop(g.x, g.y, "rgba(120,200,255,A)", 22); addShake(3);
        } else if (g.mode !== "eyes") {
          state = "dying"; dyingTimer = 1100; Sound.death();
          spawnBurst(pac.x, pac.y, "#22d6a2", 22, 3); addShake(7); addFlash(0.25);
          return;
        }
      }
    }
  }

  // ---- Fruit ----------------------------------------------------------------
  function checkFruit() {
    if (fruit || fruitCount >= 2) return;
    const e = eaten();
    if (e === 70 || e === 170) {
      const values = [100, 300, 500, 700, 1000];
      fruit = { col: 13.5, row: 17, value: values[Math.min(level - 1, 4)], timer: 9000 };
    }
  }

  // ---- Scoring / HUD --------------------------------------------------------
  function addScore(n) {
    score += n;
    if (score > high) high = score;
    if (!extraAwarded && score >= 10000) { extraAwarded = true; lives++; Sound.extraLife(); }
    updateHUD();
  }
  const el = (id) => document.getElementById(id);
  function updateHUD() {
    el("score").textContent = score;
    el("highscore").textContent = high;
    el("level").textContent = level;
    const box = el("lives"); box.innerHTML = "";
    for (let i = 0; i < Math.max(0, lives - 1); i++) {
      const d = document.createElement("span"); d.className = "life-dot"; box.appendChild(d);
    }
  }

  // ---- Loop -----------------------------------------------------------------
  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / (1000 / 60);
    last = now;
    if (dt > 3) dt = 3;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function update(dt) {
    animTick += dt;
    const ms = dt * (1000 / 60);
    decayEffects(dt); // visual effects animate in every state

    if (state === "ready") {
      readyTimer -= ms;
      if (readyTimer <= -500) state = "playing";
      return;
    }
    if (state === "dying") {
      Sound.stopSiren();
      dyingTimer -= ms;
      if (dyingTimer <= 0) loseLife();
      return;
    }
    if (state !== "playing") { Sound.stopSiren(); return; }

    // Background siren: starts with play, rises as the maze empties, warbles
    // faster while a power pellet is active.
    Sound.startSiren();
    Sound.updateSiren(frightTimer > 0 ? "frightened" : "normal", eaten() / DOT_TOTAL);

    // scatter / chase scheduling (paused while frightened)
    if (frightTimer > 0) {
      frightTimer -= ms;
      if (frightTimer <= 0) { frightTimer = 0; for (const g of ghosts) if (g.mode === "frightened") g.mode = globalMode; }
    } else {
      modeTimer += ms;
      const phase = MODE_SCHEDULE[modePhase];
      if (modeTimer >= phase.t && modePhase < MODE_SCHEDULE.length - 1) {
        modePhase++; modeTimer = 0;
        const nm = MODE_SCHEDULE[modePhase].mode;
        if (nm !== globalMode) {
          globalMode = nm;
          for (const g of ghosts) if (g.mode === "scatter" || g.mode === "chase") { g.mode = globalMode; g.dir = OPP[g.dir]; }
        }
      }
    }

    advance(pac, pacSpeed() * dt, pacCenter);
    for (const g of ghosts) {
      updateGhostMode(g);
      advance(g, ghostSpeed(g) * dt, ghostCenter);
    }
    checkCollisions();

    if (fruit) {
      fruit.timer -= ms;
      if (fruit.timer <= 0) fruit = null;
      else if (Math.hypot(px(fruit.col) - pac.x, px(fruit.row) - pac.y) < TILE * 0.9) {
        addScore(fruit.value); Sound.fruit(); popups.push({ x: pac.x, y: pac.y, txt: fruit.value, life: 800 });
        spawnBurst(pac.x, pac.y, "#ff2d2d", 10, 2.2); spawnBurst(pac.x, pac.y, "#2fbf2f", 6, 2);
        fruitCount++; fruit = null;
      }
    }
  }

  // ---- Juice: shake, particles, pops ---------------------------------------
  function addShake(m) { shake = Math.min(9, shake + m); }
  function addFlash(a) { flash = Math.min(1, flash + a); }
  function spawnBurst(x, y, color, count, speed) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.6);
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 1, decay: 0.03 + Math.random() * 0.03,
        color, size: 1.5 + Math.random() * 2.5,
      });
    }
  }
  function spawnPop(x, y, color, maxR) { pops.push({ x, y, r: 1, maxR, life: 1, color }); }

  function decayEffects(dt) {
    for (const p of popups) { p.life -= dt * (1000 / 60); p.y -= 0.3 * dt; }
    popups = popups.filter((p) => p.life > 0);
    for (const p of particles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.pow(0.92, dt); p.vy *= Math.pow(0.92, dt);
      p.life -= p.decay * dt;
    }
    particles = particles.filter((p) => p.life > 0);
    for (const p of pops) { p.r += (p.maxR - p.r) * 0.22 * dt; p.life -= 0.07 * dt; }
    pops = pops.filter((p) => p.life > 0);
    if (shake > 0) shake = Math.max(0, shake - 0.5 * dt);
    if (flash > 0) flash = Math.max(0, flash - 0.06 * dt);
  }

  // ---- Rendering ------------------------------------------------------------
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  }

  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shake > 0.15) ctx.translate((Math.random() * 2 - 1) * shake, (Math.random() * 2 - 1) * shake);

    // pre-rendered neon walls + door
    ctx.drawImage(wallCanvas, 0, 0, W, H);

    // pellets
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const ch = grid[r][c];
      if (ch === ".") {
        ctx.fillStyle = "#ffe6c2"; ctx.beginPath(); ctx.arc(px(c), px(r), 2.1, 0, 7); ctx.fill();
      } else if (ch === "o") {
        const pulse = 3.4 + Math.sin(animTick * 0.18) * 1.4;
        ctx.save();
        ctx.shadowColor = "#ffd24d"; ctx.shadowBlur = 10;
        ctx.fillStyle = "#ffe27a"; ctx.beginPath(); ctx.arc(px(c), px(r), pulse, 0, 7); ctx.fill();
        ctx.restore();
      }
    }
    drawPops();
    if (fruit) drawFruit();
    drawPlayer();
    for (const g of ghosts) drawGhost(g);
    drawParticles();
    drawPopups();
    if (state === "ready") {
      drawCenterText(readyTimer > 0 ? "READY!" : "GO!", "#ffcc00");
      if (readyTimer > 0) {
        ctx.fillStyle = "#cdd6ff"; ctx.textAlign = "center";
        ctx.font = "bold 11px Trebuchet MS, sans-serif";
        ctx.fillText(`Level ${level} · ${ENEMY_NAMES[enemyKind]}`, W / 2, px(17) + 22);
      }
    }
    if (state === "levelclear") drawCenterText("LEVEL CLEAR!", "#7bff7b");
    ctx.restore();
    if (flash > 0.01) { ctx.fillStyle = `rgba(255,255,255,${flash})`; ctx.fillRect(0, 0, W, H); }
  }

  function drawPops() {
    ctx.lineWidth = 2;
    for (const p of pops) {
      ctx.strokeStyle = p.color.replace("A", Math.max(0, p.life).toFixed(2));
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.stroke();
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Mister Munchy: an original teal slime-critter — googly eyes that track
  // movement, two antennae, and a chomping tongue-out mouth that leans into
  // the travel direction. Deliberately distinct from a certain yellow circle.
  function drawPlayer() {
    if (!pac) return;
    const x = pac.x, y = pac.y, R = TILE * 0.47;
    const d = DIRS[pac.dir] || DIRS.left;
    const dying = state === "dying";
    const chomp = Math.sin(animTick * 0.32) * 0.5 + 0.5; // 0..1
    const lx = d.x * 1.3, ly = d.y * 1.3;                // lean toward travel

    // body
    ctx.save();
    ctx.shadowColor = "#1fe0a8"; ctx.shadowBlur = 8;
    const grd = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, R * 1.15);
    grd.addColorStop(0, "#8effdd"); grd.addColorStop(0.6, "#22d6a2"); grd.addColorStop(1, "#0f9e78");
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill();
    ctx.restore();

    // antennae
    ctx.strokeStyle = "#0f9e78"; ctx.lineWidth = 1.6; ctx.lineCap = "round";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + s * 2.6, y - R * 0.88);
      ctx.lineTo(x + s * 3.8, y - R * 1.4);
      ctx.stroke();
      ctx.fillStyle = "#ffe27a";
      ctx.beginPath(); ctx.arc(x + s * 3.9, y - R * 1.45, 1.5, 0, 7); ctx.fill();
    }

    // mouth (opens vertically with a little tongue)
    const mY = y + R * 0.24 + ly * 0.5;
    const mW = R * 1.02;
    const mH = dying ? R * 0.95 : 1.2 + chomp * R * 0.72;
    ctx.fillStyle = "#06372f";
    ctx.beginPath(); ctx.ellipse(x + lx * 0.5, mY, mW * 0.5, mH * 0.5, 0, 0, 7); ctx.fill();
    if (mH > 4) {
      ctx.fillStyle = "#ff5d7a";
      ctx.beginPath(); ctx.ellipse(x + lx * 0.5, mY + mH * 0.16, mW * 0.3, mH * 0.24, 0, 0, 7); ctx.fill();
    }

    // eyes
    const eY = y - R * 0.32 + ly;
    const eXoff = R * 0.44;
    for (const s of [-1, 1]) {
      const ex = x + s * eXoff + lx;
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(ex, eY, R * 0.34, 0, 7); ctx.fill();
      if (dying) {
        ctx.strokeStyle = "#1a3a2f"; ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(ex - 1.8, eY - 1.8); ctx.lineTo(ex + 1.8, eY + 1.8);
        ctx.moveTo(ex + 1.8, eY - 1.8); ctx.lineTo(ex - 1.8, eY + 1.8);
        ctx.stroke();
      } else {
        ctx.fillStyle = "#15324a";
        ctx.beginPath(); ctx.arc(ex + d.x * 1.5, eY + d.y * 1.5, R * 0.17, 0, 7); ctx.fill();
      }
    }
  }

  // ---- Enemies --------------------------------------------------------------
  // Each level features a different creature type (all four enemies share the
  // type but keep their own colour). Designs support three states: normal
  // (coloured + direction-tracking eyes), frightened (blue + scared face), and
  // eyes (eaten, floating home).
  function enemyEyes(x, y, R, fr, dir, spread) {
    const sp = spread != null ? spread : R * 0.42;
    for (const s of [-1, 1]) {
      const ex = x + s * sp, ey = y;
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex, ey, R * 0.3, 0, 7); ctx.fill();
      if (fr) { ctx.fillStyle = "#cdd6ff"; ctx.beginPath(); ctx.arc(ex, ey, R * 0.15, 0, 7); ctx.fill(); }
      else { ctx.fillStyle = "#15324a"; ctx.beginPath(); ctx.arc(ex + dir.x * 1.4, ey + dir.y * 1.4, R * 0.16, 0, 7); ctx.fill(); }
    }
  }
  function scaredMouth(x, y, R) {
    ctx.strokeStyle = "#cdd6ff"; ctx.lineWidth = 1.2; ctx.lineJoin = "round";
    ctx.beginPath(); const w = R * 0.7; let sx = x - w; ctx.moveTo(sx, y);
    for (let i = 0; i < 4; i++) { sx += w / 2; ctx.lineTo(sx, y + (i % 2 ? 2 : -2)); }
    ctx.stroke();
  }
  function drawEyesOnly(x, y, dir) {
    for (const s of [-1, 1]) {
      const ex = x + s * 3.4;
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex, y - 1, 3.2, 0, 7); ctx.fill();
      ctx.fillStyle = "#1414c8"; ctx.beginPath(); ctx.arc(ex + dir.x * 1.6, y - 1 + dir.y * 1.6, 1.6, 0, 7); ctx.fill();
    }
  }

  function eJelly(x, y, R, col, fr, dir) {
    ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 7;
    const g = ctx.createLinearGradient(x, y - R, x, y + R);
    g.addColorStop(0, "#ffffff"); g.addColorStop(0.3, col); g.addColorStop(1, col);
    ctx.globalAlpha = 0.95; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, R, Math.PI, 0);
    let bx = x + R; const bumps = 4, step = (2 * R) / bumps;
    for (let i = 0; i < bumps; i++) { ctx.quadraticCurveTo(bx - step / 2, y + R * 0.25, bx - step, y); bx -= step; }
    ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; ctx.restore();
    ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.lineCap = "round";
    for (let i = -2; i <= 2; i++) {
      const tx = x + i * R * 0.4, wob = Math.sin(animTick * 0.2 + i) * 2;
      ctx.beginPath(); ctx.moveTo(tx, y);
      ctx.quadraticCurveTo(tx + 3 + wob, y + R * 0.7, tx - 2, y + R * 1.0);
      ctx.quadraticCurveTo(tx - 4 - wob, y + R * 1.3, tx + 1, y + R * 1.5);
      ctx.stroke();
    }
    enemyEyes(x, y - R * 0.2, R * 0.85, fr, dir);
    if (fr) scaredMouth(x, y + R * 0.2, R * 0.7);
  }

  function eCyclops(x, y, R, col, fr, dir) {
    ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 8;
    const g = ctx.createRadialGradient(x - R * 0.3, y - R * 0.3, 1, x, y, R * 1.1);
    g.addColorStop(0, "#ffffff"); g.addColorStop(0.4, col); g.addColorStop(1, col);
    ctx.fillStyle = g; ctx.beginPath(); const n = 10;
    for (let i = 0; i <= n; i++) { const a = Math.PI * 2 * i / n, rr = R * (1 + (i % 2 ? 0.06 : -0.04)); const px2 = x + Math.cos(a) * rr, py2 = y + Math.sin(a) * rr * 1.04; i ? ctx.lineTo(px2, py2) : ctx.moveTo(px2, py2); }
    ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y - R * 0.1, R * 0.5, 0, 7); ctx.fill();
    if (fr) { ctx.strokeStyle = "#15324a"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x, y - R * 0.1, R * 0.22, 0, 7); ctx.stroke(); scaredMouth(x, y + R * 0.55, R * 0.6); }
    else {
      ctx.fillStyle = "#15324a"; ctx.beginPath(); ctx.arc(x + dir.x * 1.6, y - R * 0.1 + dir.y * 1.6, R * 0.24, 0, 7); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x + dir.x * 1.6 - 1, y - R * 0.1 + dir.y * 1.6 - 1, R * 0.08, 0, 7); ctx.fill();
      ctx.strokeStyle = "#0a3a30"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x, y + R * 0.4, R * 0.28, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    }
  }

  function eSpider(x, y, R, col, fr, dir) {
    ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 4;
    ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.lineCap = "round";
    const wob = Math.sin(animTick * 0.4) * 1.5;
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      const ay = y - R * 0.5 + i * R * 0.4, k = R * (1.1 + (i === 0 || i === 3 ? 0.1 : 0.3));
      ctx.beginPath(); ctx.moveTo(x + s * R * 0.6, ay);
      ctx.lineTo(x + s * (R * 0.6 + k * 0.6), ay - 4 + i * 2 + (i % 2 ? wob : -wob));
      ctx.lineTo(x + s * (R * 0.6 + k), ay + 5 + i * 2);
      ctx.stroke();
    }
    ctx.restore();
    const g = ctx.createRadialGradient(x - R * 0.3, y - R * 0.2, 1, x, y, R * 1.1);
    g.addColorStop(0, "#ffffff"); g.addColorStop(0.4, col); g.addColorStop(1, col);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, y + R * 0.15, R * 0.85, R * 0.95, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y - R * 0.55, R * 0.5, 0, 7); ctx.fill();
    if (fr) enemyEyes(x, y - R * 0.5, R * 0.55, true, dir);
    else {
      for (const s of [-1, 1]) {
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x + s * R * 0.2, y - R * 0.6, R * 0.16, 0, 7); ctx.fill();
        ctx.fillStyle = "#15324a"; ctx.beginPath(); ctx.arc(x + s * R * 0.2 + dir.x, y - R * 0.6 + dir.y, R * 0.08, 0, 7); ctx.fill();
      }
      for (const s of [-1, 1]) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x + s * R * 0.42, y - R * 0.48, R * 0.09, 0, 7); ctx.fill(); }
    }
  }

  function eBat(x, y, R, col, fr, dir) {
    ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 6; ctx.fillStyle = col;
    const flap = Math.sin(animTick * 0.3) * R * 0.12;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(x + s * R * 0.5, y);
      ctx.quadraticCurveTo(x + s * R * 1.6, y - R * 0.9 + flap, x + s * R * 1.85, y - R * 0.1);
      ctx.lineTo(x + s * R * 1.4, y + R * 0.05);
      ctx.lineTo(x + s * R * 1.5, y + R * 0.5);
      ctx.lineTo(x + s * R * 1.0, y + R * 0.2);
      ctx.lineTo(x + s * R * 1.05, y + R * 0.65);
      ctx.quadraticCurveTo(x + s * R * 0.7, y + R * 0.45, x + s * R * 0.5, y + R * 0.3);
      ctx.closePath(); ctx.fill();
    }
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * R * 0.45, y - R * 0.5); ctx.lineTo(x + s * R * 0.2, y - R * 0.6); ctx.lineTo(x + s * R * 0.18, y - R * 0.95); ctx.closePath(); ctx.fill(); }
    const g = ctx.createRadialGradient(x - R * 0.3, y - R * 0.3, 1, x, y, R);
    g.addColorStop(0, "#ffffff"); g.addColorStop(0.45, col); g.addColorStop(1, col);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 0.8, 0, 7); ctx.fill(); ctx.restore();
    enemyEyes(x, y - R * 0.1, R * 0.7, fr, dir);
    if (!fr) { ctx.fillStyle = "#fff"; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * R * 0.12, y + R * 0.25); ctx.lineTo(x + s * R * 0.24, y + R * 0.25); ctx.lineTo(x + s * R * 0.18, y + R * 0.5); ctx.closePath(); ctx.fill(); } }
    else scaredMouth(x, y + R * 0.35, R * 0.6);
  }

  const ENEMY_FN = [eJelly, eCyclops, eSpider, eBat];

  function drawGhost(g) {
    const x = g.x, y = g.y, R = TILE * 0.47;
    const dir = DIRS[g.dir] || DIRS.left;
    if (g.mode === "eyes") { drawEyesOnly(x, y, dir); return; }
    const flashing = g.mode === "frightened" && frightTimer < 2000 && Math.floor(animTick / 6) % 2 === 0;
    const fr = g.mode === "frightened";
    const col = fr ? (flashing ? "#ffffff" : "#2b3bff") : g.color;
    ENEMY_FN[enemyKind](x, y, R, col, fr, dir);
  }

  function drawFruit() {
    const x = px(fruit.col), y = px(fruit.row);
    ctx.fillStyle = "#ff2d2d";
    ctx.beginPath(); ctx.arc(x - 3, y + 2, 4, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 3, y + 2, 4, 0, 7); ctx.fill();
    ctx.strokeStyle = "#2fbf2f"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y - 1); ctx.lineTo(x + 2, y - 6); ctx.stroke();
  }

  function drawPopups() {
    ctx.textAlign = "center"; ctx.font = "bold 11px Trebuchet MS, sans-serif";
    for (const p of popups) {
      ctx.fillStyle = `rgba(0,255,255,${Math.max(0, p.life / 800)})`;
      ctx.fillText(p.txt, p.x, p.y);
    }
  }

  function drawCenterText(txt, color) {
    ctx.fillStyle = color; ctx.textAlign = "center";
    ctx.font = "bold 18px Trebuchet MS, sans-serif";
    ctx.fillText(txt, W / 2, px(17) + 5);
  }

  // ---- Overlay --------------------------------------------------------------
  const overlay = el("overlay"), oTitle = el("overlay-title"), oText = el("overlay-text"), oBtn = el("overlay-btn");
  function showOverlay(title, text, btn) { oTitle.textContent = title; oText.textContent = text; oBtn.textContent = btn; overlay.classList.remove("hidden"); }
  function hideOverlay() { overlay.classList.add("hidden"); }

  // ---- Input ----------------------------------------------------------------
  function steer(dir) { if ((state === "playing" || state === "ready") && pac) pac.want = dir; }
  function primaryAction() {
    audioUnlock();
    if (state === "menu" || state === "gameover") startGame();
    else if (state === "paused") { hideOverlay(); state = "playing"; }
  }
  function togglePause() {
    if (state === "playing") { state = "paused"; showOverlay("Paused", "Catch your breath.", "Resume"); }
    else if (state === "paused") { hideOverlay(); state = "playing"; }
  }

  const KEYMAP = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" };
  window.addEventListener("keydown", (e) => {
    audioUnlock();
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (KEYMAP[k]) { e.preventDefault(); steer(KEYMAP[k]); }
    else if (k === "p") togglePause();
    else if (k === " " || k === "Enter") { e.preventDefault(); primaryAction(); }
  }, { passive: false });

  // Swipe on the board (primary touch input)
  let touchStart = null;
  const SWIPE_MIN = 16;
  canvas.addEventListener("touchstart", (e) => {
    audioUnlock();
    const t = e.changedTouches[0]; touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  canvas.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
  canvas.addEventListener("touchend", (e) => {
    if (!touchStart) return;
    const t = e.changedTouches[0], dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    if (Math.max(adx, ady) < SWIPE_MIN) primaryAction();
    else if (adx > ady) steer(dx > 0 ? "right" : "left");
    else steer(dy > 0 ? "down" : "up");
    touchStart = null;
  }, { passive: false });

  // On-screen D-pad
  document.querySelectorAll(".dpad").forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      audioUnlock();
      const dir = btn.dataset.dir;
      if (dir === "pause") togglePause(); else steer(dir);
    });
  });

  // Mute toggle
  const muteBtn = el("mute-btn");
  function refreshMuteBtn() {
    muteBtn.innerHTML = Sound.muted ? "&#128263;" : "&#128266;"; // muted vs speaker
    muteBtn.classList.toggle("muted", Sound.muted);
  }
  muteBtn.addEventListener("click", (e) => {
    e.preventDefault();
    audioUnlock();
    Sound.setMuted(!Sound.muted);
    refreshMuteBtn();
  });
  refreshMuteBtn();

  oBtn.addEventListener("click", primaryAction);

  // Block page-level gestures (scroll / pinch / double-tap zoom)
  document.addEventListener("touchmove", (e) => { if (e.target === canvas) e.preventDefault(); }, { passive: false });
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  let lastTouch = 0;
  document.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTouch < 300) e.preventDefault();
    lastTouch = now;
  }, { passive: false });

  // ---- Boot -----------------------------------------------------------------
  resetGrid();
  pac = { x: px(PAC_START.col), y: px(PAC_START.row), dir: "left", want: "left" };
  ghosts = [];
  updateHUD();
  showOverlay("Mister Munchy!", "Swipe to munch every dot, dodge the ghosts, and grab a glowing power pellet to chase them down!", "Tap to Start");
  requestAnimationFrame(frame);
})();
