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
    "#............##............#",
    "#.####.#####.##.#####.####.#",
    "#o####.#####.##.#####.####o#",
    "#.####.#####.##.#####.####.#",
    "#..........................#",
    "#.####.##.########.##.####.#",
    "#.####.##.########.##.####.#",
    "#......##....##....##......#",
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
    "#............##............#",
    "#.####.#####.##.#####.####.#",
    "#o..##.......  .......##..o#",
    "###.##.##.########.##.##.###",
    "###.##.##.########.##.##.###",
    "#......##....##....##......#",
    "#.##########.##.##########.#",
    "#..........................#",
    "############################",
  ];

  const COLS = 28;
  const ROWS = MAZE.length;
  const TILE = 16;
  const W = COLS * TILE;
  const H = ROWS * TILE;

  const canvas = document.getElementById("board");
  canvas.width = W;
  canvas.height = H;
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
  let popups = [];

  const MODE_SCHEDULE = [
    { mode: "scatter", t: 7000 }, { mode: "chase", t: 20000 },
    { mode: "scatter", t: 7000 }, { mode: "chase", t: 20000 },
    { mode: "scatter", t: 5000 }, { mode: "chase", t: 20000 },
    { mode: "scatter", t: 5000 }, { mode: "chase", t: Infinity },
  ];

  const HOME = { col: 13, row: 14 };
  const PAC_START = { col: 13.5, row: 22 };
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

  // ---- Setup ----------------------------------------------------------------
  function resetGrid() {
    grid = MAZE.map((row) => row.split(""));
    dotsLeft = DOT_TOTAL;
  }

  function startLevel() {
    resetGrid();
    fruit = null; fruitCount = 0;
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
    state = "ready";
  }

  function startGame() {
    score = 0; lives = 3; level = 1;
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
    if (ch === ".") { grid[r][c] = " "; dotsLeft--; addScore(10); checkFruit(); checkWin(); }
    else if (ch === "o") { grid[r][c] = " "; dotsLeft--; addScore(50); enterFrightened(); checkFruit(); checkWin(); }
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
          ghostChain++; addScore(pts); popups.push({ x: g.x, y: g.y, txt: pts, life: 800 });
        } else if (g.mode !== "eyes") {
          state = "dying"; dyingTimer = 1100; return;
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
  function addScore(n) { score += n; if (score > high) high = score; updateHUD(); }
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

    if (state === "ready") {
      readyTimer -= ms;
      if (readyTimer <= -500) state = "playing";
      return;
    }
    if (state === "dying") {
      dyingTimer -= ms;
      if (dyingTimer <= 0) loseLife();
      decayPopups(dt); return;
    }
    if (state !== "playing") { decayPopups(dt); return; }

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
        addScore(fruit.value); popups.push({ x: pac.x, y: pac.y, txt: fruit.value, life: 800 });
        fruitCount++; fruit = null;
      }
    }
    decayPopups(dt);
  }

  function decayPopups(dt) {
    for (const p of popups) { p.life -= dt * (1000 / 60); p.y -= 0.3 * dt; }
    popups = popups.filter((p) => p.life > 0);
  }

  // ---- Rendering ------------------------------------------------------------
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // walls + door
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const ch = grid[r][c], x = c * TILE, y = r * TILE;
      if (ch === "#") {
        ctx.fillStyle = "#1414b8"; roundRect(x + 1.5, y + 1.5, TILE - 3, TILE - 3, 4); ctx.fill();
        ctx.strokeStyle = "#3b3bff"; ctx.lineWidth = 1.5; roundRect(x + 1.5, y + 1.5, TILE - 3, TILE - 3, 4); ctx.stroke();
      } else if (ch === "-") {
        ctx.fillStyle = "#ff7bd5"; ctx.fillRect(x, y + TILE / 2 - 2, TILE, 4);
      }
    }
    // pellets
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const ch = grid[r][c];
      if (ch === ".") { ctx.fillStyle = "#ffe6b3"; ctx.beginPath(); ctx.arc(px(c), px(r), 2, 0, 7); ctx.fill(); }
      else if (ch === "o") {
        const pulse = 3 + Math.sin(animTick * 0.18) * 1.3;
        ctx.fillStyle = "#ffd24d"; ctx.beginPath(); ctx.arc(px(c), px(r), pulse, 0, 7); ctx.fill();
      }
    }
    if (fruit) drawFruit();
    drawPac();
    for (const g of ghosts) drawGhost(g);
    drawPopups();
    if (state === "ready") drawCenterText(readyTimer > 0 ? "READY!" : "GO!", "#ffcc00");
    if (state === "levelclear") drawCenterText("LEVEL CLEAR!", "#7bff7b");
  }

  function drawPac() {
    if (!pac) return;
    let open;
    if (state === "dying") open = Math.min(0.99, (1100 - dyingTimer) / 1100); // chomp shut
    else open = (Math.sin(animTick * 0.35) * 0.5 + 0.5) * 0.32 + 0.04;
    const a = open * Math.PI;
    const base = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[pac.dir] || 0;
    ctx.save(); ctx.translate(pac.x, pac.y); ctx.rotate(base);
    ctx.fillStyle = "#ffe000";
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.arc(0, 0, TILE * 0.46, a, Math.PI * 2 - a); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawGhost(g) {
    const x = g.x, y = g.y, rad = TILE * 0.46;
    const flashing = g.mode === "frightened" && frightTimer < 2000 && Math.floor(animTick / 6) % 2 === 0;
    let body = g.color;
    if (g.mode === "frightened") body = flashing ? "#ffffff" : "#2121de";
    if (g.mode === "eyes") body = null;

    if (body) {
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(x, y - 1, rad, Math.PI, 0);
      ctx.lineTo(x + rad, y + rad - 2);
      const feet = 3, step = (rad * 2) / feet;
      for (let i = 0; i < feet; i++) {
        const fx = x + rad - i * step;
        ctx.lineTo(fx - step / 2, y + rad - 6);
        ctx.lineTo(fx - step, y + rad - 2);
      }
      ctx.closePath(); ctx.fill();
    }

    if (g.mode === "frightened" && !flashing) {
      ctx.fillStyle = "#ffd2e8";
      ctx.fillRect(x - 4, y - 3, 2, 3); ctx.fillRect(x + 2, y - 3, 2, 3);
      ctx.strokeStyle = "#ffd2e8"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - 5, y + 4); ctx.lineTo(x - 2, y + 2);
      ctx.lineTo(x + 1, y + 4); ctx.lineTo(x + 4, y + 2); ctx.stroke();
    } else if (g.mode !== "frightened") {
      const dx = DIRS[g.dir].x, dy = DIRS[g.dir].y;
      for (const off of [-4, 4]) {
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x + off, y - 1, 3.2, 0, 7); ctx.fill();
        ctx.fillStyle = "#1414c8"; ctx.beginPath(); ctx.arc(x + off + dx * 1.6, y - 1 + dy * 1.6, 1.6, 0, 7); ctx.fill();
      }
    }
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
    if (state === "menu" || state === "gameover") startGame();
    else if (state === "paused") { hideOverlay(); state = "playing"; }
  }
  function togglePause() {
    if (state === "playing") { state = "paused"; showOverlay("Paused", "Catch your breath.", "Resume"); }
    else if (state === "paused") { hideOverlay(); state = "playing"; }
  }

  const KEYMAP = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" };
  window.addEventListener("keydown", (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (KEYMAP[k]) { e.preventDefault(); steer(KEYMAP[k]); }
    else if (k === "p") togglePause();
    else if (k === " " || k === "Enter") { e.preventDefault(); primaryAction(); }
  }, { passive: false });

  // Swipe on the board (primary touch input)
  let touchStart = null;
  const SWIPE_MIN = 16;
  canvas.addEventListener("touchstart", (e) => {
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
      const dir = btn.dataset.dir;
      if (dir === "pause") togglePause(); else steer(dir);
    });
  });

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
