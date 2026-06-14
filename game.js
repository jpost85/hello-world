/* ===========================================================================
   Liberty's Call — a turn-based Revolutionary War strategy game.
   Vanilla JS, no dependencies. Player = Patriots, AI = British Crown.
   =========================================================================== */
(function () {
  "use strict";

  /* ----------------------------- Configuration ---------------------------- */
  const CONFIG = {
    startGold: 120,
    crownStartGold: 100,
    crownRecruitCap: 6,     // max soldiers the AI musters per turn
    recruitCost: 14,        // gold per soldier
    recruitBatch: 3,        // soldiers added per Recruit press
    cityDefenseBonus: 1.35, // multiplier to defender strength in cities/capitals
    capitalDefenseBonus: 1.6,
    startMorale: 100,
    maxMorale: 120,
    finalTurn: 32,          // ~1783
    franceTurn: 6,          // earliest France may intervene
    franceMoraleNeeded: 75, // patriot resolve required to draw France in
    seasons: ["Spring", "Summer", "Autumn", "Winter"],
  };

  const SAVE_KEY = "libertys-call-save-v1";

  /* ------------------------------- Map data ------------------------------- */
  // Regions of the colonial seaboard. Positions are SVG coords (viewBox 640x920).
  const REGION_DEFS = [
    { id: "quebec",    name: "Quebec",         x: 300, y: 70,  income: 6,  city: true,  capital: false },
    { id: "mass",      name: "Massachusetts",  x: 470, y: 195, income: 7,  city: true,  capital: false },
    { id: "conn",      name: "Connecticut",    x: 430, y: 275, income: 4,  city: false, capital: false },
    { id: "ny",        name: "New York",       x: 360, y: 300, income: 8,  city: true,  capital: "crown" },
    { id: "nj",        name: "New Jersey",     x: 405, y: 380, income: 4,  city: false, capital: false },
    { id: "penn",      name: "Pennsylvania",   x: 315, y: 400, income: 8,  city: true,  capital: "patriot" },
    { id: "del",       name: "Delaware",       x: 410, y: 455, income: 3,  city: false, capital: false },
    { id: "md",        name: "Maryland",       x: 340, y: 480, income: 5,  city: false, capital: false },
    { id: "va",        name: "Virginia",       x: 295, y: 560, income: 7,  city: true,  capital: false },
    { id: "nc",        name: "North Carolina", x: 330, y: 650, income: 5,  city: false, capital: false },
    { id: "sc",        name: "South Carolina", x: 300, y: 730, income: 6,  city: true,  capital: false },
    { id: "ga",        name: "Georgia",        x: 265, y: 810, income: 4,  city: false, capital: false },
  ];

  const ADJACENCY = {
    quebec: ["mass", "ny"],
    mass:   ["quebec", "conn"],
    conn:   ["mass", "ny"],
    ny:     ["quebec", "conn", "nj", "penn"],
    nj:     ["ny", "penn", "del"],
    penn:   ["ny", "nj", "md", "del"],
    del:    ["nj", "penn", "md"],
    md:     ["penn", "del", "va"],
    va:     ["md", "nc"],
    nc:     ["va", "sc"],
    sc:     ["nc", "ga"],
    ga:     ["sc"],
  };

  // Starting positions: owner + troops.
  const SETUP = {
    quebec: { owner: "crown",   troops: 8 },
    mass:   { owner: "patriot", troops: 6 },
    conn:   { owner: "patriot", troops: 4 },
    ny:     { owner: "crown",   troops: 14 },
    nj:     { owner: "patriot", troops: 4 },
    penn:   { owner: "patriot", troops: 10 },
    del:    { owner: "patriot", troops: 3 },
    md:     { owner: "patriot", troops: 4 },
    va:     { owner: "patriot", troops: 7 },
    nc:     { owner: "patriot", troops: 4 },
    sc:     { owner: "patriot", troops: 5 },
    ga:     { owner: "crown",   troops: 6 },
  };

  /* ------------------------------- Game state ----------------------------- */
  let S = null; // active game state
  let selected = null;      // selected region id
  let pendingAction = null; // info for the troop modal

  function newState() {
    const regions = {};
    for (const def of REGION_DEFS) {
      const setup = SETUP[def.id];
      regions[def.id] = {
        id: def.id,
        owner: setup.owner,
        troops: setup.troops,
        acted: false,
      };
    }
    return {
      turn: 1,
      regions,
      gold: CONFIG.startGold,
      crownGold: CONFIG.crownStartGold,
      morale: { patriot: CONFIG.startMorale, crown: CONFIG.startMorale },
      franceJoined: false,
      over: false,
      log: [],
    };
  }

  /* ------------------------------- Helpers -------------------------------- */
  const def = (id) => REGION_DEFS.find((r) => r.id === id);
  const $ = (sel) => document.querySelector(sel);

  function rng(min, max) { return min + Math.random() * (max - min); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function regionIncome(id) {
    return def(id).income;
  }
  function defenseBonus(id) {
    const d = def(id);
    if (d.capital) return CONFIG.capitalDefenseBonus;
    if (d.city) return CONFIG.cityDefenseBonus;
    return 1;
  }
  function ownedRegions(owner) {
    return Object.values(S.regions).filter((r) => r.owner === owner);
  }
  function incomeFor(owner) {
    let total = ownedRegions(owner).reduce((sum, r) => sum + regionIncome(r.id), 0);
    if (owner === "patriot" && S.franceJoined) total += 10; // French subsidies
    return total;
  }
  function capitalOwner(side) {
    const capId = side === "patriot" ? "penn" : "ny";
    return S.regions[capId].owner;
  }

  function dateLabel(turn) {
    const idx = turn - 1;
    const season = CONFIG.seasons[idx % 4];
    const year = 1775 + Math.floor(idx / 4);
    return `${season} ${year}`;
  }

  /* --------------------------------- Log ---------------------------------- */
  function log(msg, cls) {
    S.log.unshift({ msg, cls: cls || "" });
    if (S.log.length > 60) S.log.pop();
    renderLog();
  }

  function renderLog() {
    const ul = $("#log");
    ul.innerHTML = "";
    for (const entry of S.log) {
      const li = document.createElement("li");
      li.textContent = entry.msg;
      if (entry.cls) li.className = entry.cls;
      ul.appendChild(li);
    }
  }

  /* ------------------------------- Banner --------------------------------- */
  let bannerTimer = null;
  function showBanner(text, ms) {
    const b = $("#banner");
    $("#banner-text").textContent = text;
    b.classList.remove("hidden");
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.classList.add("hidden"), ms || 2600);
  }

  /* ------------------------------ Rendering ------------------------------- */
  const SVGNS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs) {
    const el = document.createElementNS(SVGNS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  function renderMap() {
    const map = $("#map");
    map.innerHTML = "";

    // Connection lines first (drawn beneath nodes).
    const drawn = new Set();
    for (const id in ADJACENCY) {
      for (const other of ADJACENCY[id]) {
        const key = [id, other].sort().join("-");
        if (drawn.has(key)) continue;
        drawn.add(key);
        const a = def(id), b = def(other);
        map.appendChild(svgEl("line", {
          x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: "link-line",
        }));
      }
    }

    const movable = selected ? legalMoves(selected) : { move: [], attack: [] };

    // Region nodes.
    for (const d of REGION_DEFS) {
      const r = S.regions[d.id];
      const g = svgEl("g", { });

      const radius = d.city ? 30 : 24;
      const shape = svgEl("circle", {
        cx: d.x, cy: d.y, r: radius,
        class: "region-shape region-" + r.owner,
        "data-id": d.id,
      });
      if (selected === d.id) shape.classList.add("selected");
      if (movable.move.includes(d.id)) shape.classList.add("movable");
      if (movable.attack.includes(d.id)) shape.classList.add("attackable");
      shape.addEventListener("click", () => onRegionClick(d.id));
      g.appendChild(shape);

      // Capital star
      if (d.capital) {
        g.appendChild(svgEl("path", {
          d: starPath(d.x, d.y - radius - 9, 7, 3.2, 5),
          class: "capital-star",
        }));
      }

      // Region name
      const label = svgEl("text", {
        x: d.x, y: d.y + radius + 15, class: "region-label",
      });
      label.textContent = d.name;
      g.appendChild(label);

      // Troop badge
      const badge = svgEl("circle", {
        cx: d.x + radius - 4, cy: d.y - radius + 4, r: 12, class: "troop-badge",
      });
      g.appendChild(badge);
      const tt = svgEl("text", {
        x: d.x + radius - 4, y: d.y - radius + 8, class: "troop-text",
      });
      tt.textContent = r.troops;
      g.appendChild(tt);

      // "acted" dim marker
      if (r.acted && r.owner === "patriot") {
        g.appendChild(svgEl("circle", {
          cx: d.x, cy: d.y, r: radius, class: "acted-mark",
        }));
      }

      map.appendChild(g);
    }
  }

  function starPath(cx, cy, outer, inner, points) {
    let path = "";
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (Math.PI / points) * i - Math.PI / 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      path += (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1);
    }
    return path + "Z";
  }

  function renderTopbar() {
    $("#stat-date").textContent = dateLabel(S.turn);
    $("#stat-gold").textContent = S.gold;
    $("#stat-income").textContent = "+" + incomeFor("patriot");
    $("#bar-patriot").style.width = (S.morale.patriot / CONFIG.maxMorale * 100) + "%";
    $("#bar-crown").style.width = (S.morale.crown / CONFIG.maxMorale * 100) + "%";
  }

  function renderSidebar() {
    const nameEl = $("#ri-name");
    const ownerEl = $("#ri-owner");
    const actionsEl = $("#ri-actions");
    const hintEl = $("#ri-hint");
    actionsEl.innerHTML = "";

    if (!selected) {
      nameEl.textContent = "Select a region";
      ownerEl.textContent = "";
      ownerEl.className = "ri-owner";
      $("#ri-troops").textContent = "—";
      $("#ri-income").textContent = "—";
      $("#ri-def").textContent = "—";
      hintEl.textContent = "Click a region to inspect it. Click one of your armies to give orders.";
      return;
    }

    const d = def(selected);
    const r = S.regions[selected];
    nameEl.textContent = d.name + (d.capital ? "  ★" : "");
    const ownerName = r.owner === "patriot" ? "Patriot" : r.owner === "crown" ? "British Crown" : "Neutral";
    ownerEl.textContent = ownerName + (d.capital === r.owner ? " — Capital" : "") + (d.city ? " · City" : "");
    ownerEl.className = "ri-owner " + r.owner;

    $("#ri-troops").textContent = r.troops;
    $("#ri-income").textContent = regionIncome(selected);
    const bonus = defenseBonus(selected);
    $("#ri-def").textContent = bonus > 1 ? "+" + Math.round((bonus - 1) * 100) + "%" : "—";

    const moves = legalMoves(selected);

    if (r.owner === "patriot") {
      // Recruit
      const recruitBtn = document.createElement("button");
      const cost = CONFIG.recruitCost * CONFIG.recruitBatch;
      recruitBtn.className = "btn";
      recruitBtn.textContent = `Recruit ${CONFIG.recruitBatch} troops (${cost}g)`;
      recruitBtn.disabled = S.gold < cost;
      recruitBtn.addEventListener("click", () => recruit(selected));
      actionsEl.appendChild(recruitBtn);

      if (r.acted) {
        hintEl.textContent = "This army has already marched this turn.";
      } else if (r.troops <= 0) {
        hintEl.textContent = "No troops stationed here. Recruit or reinforce.";
      } else if (moves.move.length === 0 && moves.attack.length === 0) {
        hintEl.textContent = "No adjacent regions to move into.";
      } else {
        hintEl.textContent = "Click a highlighted region: green to reinforce, red to attack.";
      }
    } else {
      hintEl.textContent = "Enemy-held. Attack from an adjacent army (highlighted).";
    }
  }

  function renderAll() {
    renderMap();
    renderTopbar();
    renderSidebar();
  }

  /* ----------------------------- Move legality ---------------------------- */
  function legalMoves(id) {
    const r = S.regions[id];
    const out = { move: [], attack: [] };
    if (!r || r.owner !== "patriot" || r.acted || r.troops <= 0) return out;
    for (const other of ADJACENCY[id]) {
      if (S.regions[other].owner === "patriot") out.move.push(other);
      else out.attack.push(other);
    }
    return out;
  }

  /* ------------------------------ Interaction ----------------------------- */
  function onRegionClick(id) {
    if (S.over) return;

    // If we have a selected patriot army and clicked a legal target, act.
    if (selected && selected !== id) {
      const moves = legalMoves(selected);
      if (moves.move.includes(id)) {
        openTroopDialog("move", selected, id);
        return;
      }
      if (moves.attack.includes(id)) {
        openTroopDialog("attack", selected, id);
        return;
      }
    }

    // Otherwise just select/inspect.
    selected = id;
    renderAll();
  }

  /* ------------------------------- Recruit -------------------------------- */
  function recruit(id) {
    const cost = CONFIG.recruitCost * CONFIG.recruitBatch;
    if (S.gold < cost) return;
    S.gold -= cost;
    S.regions[id].troops += CONFIG.recruitBatch;
    log(`Mustered ${CONFIG.recruitBatch} troops in ${def(id).name}.`, "");
    save();
    renderAll();
  }

  /* --------------------------- Troop move dialog -------------------------- */
  function openTroopDialog(kind, fromId, toId) {
    const from = S.regions[fromId];
    const max = from.troops;
    if (max <= 0) return;
    pendingAction = { kind, fromId, toId };

    const overlay = $("#modal-overlay");
    const slider = $("#troop-slider");
    slider.min = 1;
    slider.max = max;
    slider.value = max;
    $("#troop-count").textContent = max;

    if (kind === "move") {
      $("#modal-title").textContent = "March to " + def(toId).name;
      $("#modal-text").textContent =
        `Move how many of ${def(fromId).name}'s ${max} troops to reinforce ${def(toId).name}?`;
    } else {
      const enemy = S.regions[toId].troops;
      $("#modal-title").textContent = "Attack " + def(toId).name;
      $("#modal-text").textContent =
        `${def(toId).name} is defended by ${enemy} troops` +
        (defenseBonus(toId) > 1 ? " behind fortifications" : "") +
        `. Commit how many of your ${max}?`;
    }
    overlay.classList.remove("hidden");
  }

  function closeTroopDialog() {
    $("#modal-overlay").classList.add("hidden");
    pendingAction = null;
  }

  function confirmTroopDialog() {
    if (!pendingAction) return;
    const count = parseInt($("#troop-slider").value, 10);
    const { kind, fromId, toId } = pendingAction;
    closeTroopDialog();
    if (kind === "move") doMove(fromId, toId, count);
    else doAttack(fromId, toId, count);
  }

  /* --------------------------------- Move --------------------------------- */
  function doMove(fromId, toId, count) {
    const from = S.regions[fromId];
    const to = S.regions[toId];
    count = clamp(count, 1, from.troops);
    from.troops -= count;
    to.troops += count;
    from.acted = true;
    log(`${count} troops marched from ${def(fromId).name} to ${def(toId).name}.`, "");
    selected = toId;
    save();
    renderAll();
  }

  /* -------------------------------- Battle -------------------------------- */
  // Returns { win, attLoss, defLoss }
  function resolveBattle(attackers, defenders, defBonus) {
    const attPower = attackers * rng(0.75, 1.25);
    const defPower = defenders * rng(0.75, 1.25) * defBonus;
    const win = attPower >= defPower;
    let attLoss, defLoss;
    if (win) {
      // Attacker prevails; casualties scale with how close it was.
      const ratio = clamp(defPower / Math.max(attPower, 1), 0.1, 1);
      attLoss = Math.round(attackers * (0.2 + 0.35 * ratio));
      defLoss = defenders; // defenders routed / region taken
    } else {
      // Assault broken, but survivors retreat — not annihilated.
      const ratio = clamp(attPower / Math.max(defPower, 1), 0.1, 1);
      attLoss = Math.round(attackers * (0.4 + 0.35 * ratio));
      defLoss = Math.round(defenders * (0.15 + 0.3 * ratio));
    }
    attLoss = clamp(attLoss, 1, attackers);
    defLoss = clamp(defLoss, 0, defenders);
    return { win, attLoss, defLoss };
  }

  function doAttack(fromId, toId, count) {
    const from = S.regions[fromId];
    const to = S.regions[toId];
    count = clamp(count, 1, from.troops);
    const defenders = to.troops;
    const defBonus = defenseBonus(toId);
    from.acted = true;

    const result = resolveBattle(count, defenders, defBonus);
    from.troops -= count; // committed troops leave home region

    const attName = def(fromId).name, defName = def(toId).name;

    if (result.win) {
      const survivors = count - result.attLoss;
      const wasCapital = def(toId).capital === to.owner;
      const loser = to.owner;
      to.owner = "patriot";
      to.troops = survivors;
      to.acted = true; // freshly captured army holds position
      log(`Victory at ${defName}! ${defName} falls to the Patriots (lost ${result.attLoss}, enemy ${defenders}).`, "l-good");
      showBanner("⚔  " + defName + " captured!");
      adjustMorale("patriot", def(toId).city ? 8 : 5);
      adjustMorale(loser, def(toId).city ? -8 : -5);
      if (wasCapital) {
        adjustMorale(loser, -30);
        log(`The enemy capital at ${defName} has fallen! A grievous blow to the Crown.`, "l-event");
      }
    } else {
      // Assault repelled; survivors retreat home.
      const survivors = count - result.attLoss;
      from.troops += survivors;
      to.troops -= result.defLoss;
      log(`Assault on ${defName} repelled. We lost ${result.attLoss}; the enemy lost ${result.defLoss}.`, "l-bad");
      showBanner("Assault on " + defName + " repelled");
      adjustMorale("patriot", -3);
    }

    selected = result.win ? toId : fromId;
    save();
    renderAll();
    checkWin();
  }

  /* ------------------------------- Morale --------------------------------- */
  function adjustMorale(side, delta) {
    S.morale[side] = clamp(S.morale[side] + delta, 0, CONFIG.maxMorale);
  }

  /* ------------------------------ End turn -------------------------------- */
  function endTurn() {
    if (S.over) return;
    selected = null;

    // Collect income.
    const income = incomeFor("patriot");
    S.gold += income;
    log(`Treasury collects ${income} gold from the colonies.`, "");

    // AI takes its turn.
    crownTurn();
    if (S.over) return;

    // Advance turn & reset action flags.
    S.turn += 1;
    for (const r of Object.values(S.regions)) r.acted = false;

    // Crown income (internal economy for AI recruiting).
    S.crownGold += incomeFor("crown");

    maybeFranceEvent();

    if (S.turn > CONFIG.finalTurn) {
      endByAttrition();
      return;
    }

    log(`— ${dateLabel(S.turn)} —`, "l-event");
    save();
    renderAll();
    checkWin();
  }

  /* ------------------------------- Crown AI ------------------------------- */
  function crownTurn() {
    // 1) Recruit reinforcements at the strongest front-line city.
    const crownRegions = ownedRegions("crown");
    if (crownRegions.length === 0) return;

    let recruits = Math.floor(S.crownGold / CONFIG.recruitCost);
    recruits = Math.min(recruits, CONFIG.crownRecruitCap); // pace the AI
    if (recruits > 0) {
      // Prefer a city adjacent to a patriot region (the front).
      const front = crownRegions.filter((r) =>
        ADJACENCY[r.id].some((n) => S.regions[n].owner === "patriot"));
      const pool = front.length ? front : crownRegions;
      const target = pool.reduce((best, r) =>
        (def(r.id).city ? 1 : 0) - (best && def(best.id).city ? 1 : 0) >= 0 ? r : best, pool[0]);
      target.troops += recruits;
      S.crownGold -= recruits * CONFIG.recruitCost;
      log(`British reinforcements land at ${def(target.id).name} (+${recruits}).`, "l-bad");
    }

    // 2) Each Crown army acts once: attack a beatable neighbour, else mass toward Philadelphia.
    const acted = new Set();
    // Re-evaluate ownership dynamically as battles change the map.
    const armies = ownedRegions("crown").map((r) => r.id);
    for (const id of armies) {
      const r = S.regions[id];
      if (!r || r.owner !== "crown" || acted.has(id) || r.troops <= 1) continue;

      const targets = ADJACENCY[id].filter((n) => S.regions[n].owner === "patriot");
      // Find a patriot neighbour we can plausibly beat.
      let bestAtk = null, bestScore = -Infinity;
      for (const t of targets) {
        const need = S.regions[t].troops * defenseBonus(t);
        const score = r.troops - need;
        if (score > bestScore) { bestScore = score; bestAtk = t; }
      }

      if (bestAtk && bestScore > -2) {
        crownAttack(id, bestAtk);
        acted.add(id);
        acted.add(bestAtk); // captured/contested region shouldn't act again
      } else {
        // Reinforce toward the front: shift troops to a crown neighbour closer to penn.
        const reinforceTo = ADJACENCY[id]
          .filter((n) => S.regions[n].owner === "crown")
          .sort((a, b) => dist(a, "penn") - dist(b, "penn"))[0];
        if (reinforceTo && dist(reinforceTo, "penn") < dist(id, "penn") && r.troops > 2) {
          const move = Math.floor(r.troops / 2);
          r.troops -= move;
          S.regions[reinforceTo].troops += move;
          acted.add(id);
        }
      }
    }

    renderAll();
    checkWin();
  }

  function crownAttack(fromId, toId) {
    const from = S.regions[fromId];
    const to = S.regions[toId];
    const committed = from.troops; // AI commits its full stack
    const result = resolveBattle(committed, to.troops, defenseBonus(toId));
    const defenders = to.troops;
    from.troops = 0;

    if (result.win) {
      const survivors = committed - result.attLoss;
      const wasCapital = def(toId).capital === to.owner;
      to.owner = "crown";
      to.troops = survivors;
      log(`The British storm ${def(toId).name}! It is lost (we had ${defenders}).`, "l-bad");
      showBanner("✗  " + def(toId).name + " has fallen to the Crown");
      adjustMorale("crown", def(toId).city ? 8 : 5);
      adjustMorale("patriot", def(toId).city ? -8 : -5);
      if (wasCapital) {
        adjustMorale("patriot", -30);
        log(`Our capital at ${def(toId).name} is taken! The cause teeters.`, "l-event");
      }
    } else {
      from.troops = committed - result.attLoss; // survivors hold their ground
      to.troops -= result.defLoss;
      log(`We repulsed a British attack on ${def(toId).name}! Enemy lost ${result.attLoss}.`, "l-good");
      adjustMorale("patriot", 4);
      adjustMorale("crown", -4);
    }
  }

  // BFS distance between regions (in hops).
  const distCache = {};
  function dist(a, b) {
    const key = a + ">" + b;
    if (distCache[key] != null) return distCache[key];
    const seen = new Set([a]);
    let frontier = [a], d = 0;
    while (frontier.length) {
      if (frontier.includes(b)) { distCache[key] = d; return d; }
      const next = [];
      for (const n of frontier) for (const m of ADJACENCY[n]) if (!seen.has(m)) { seen.add(m); next.push(m); }
      frontier = next; d++;
    }
    distCache[key] = 99; return 99;
  }

  /* --------------------------- France intervention ------------------------ */
  function maybeFranceEvent() {
    if (S.franceJoined) return;
    if (S.turn < CONFIG.franceTurn) return;
    if (S.morale.patriot < CONFIG.franceMoraleNeeded) return;

    S.franceJoined = true;
    S.gold += 80;
    adjustMorale("patriot", 12);
    // French regulars land in a Patriot coastal city if available.
    const landing = ["va", "sc", "penn", "mass"].find((id) => S.regions[id].owner === "patriot");
    if (landing) S.regions[landing].troops += 10;
    log("FRANCE ENTERS THE WAR! French gold, regulars, and a fleet bolster the cause.", "l-event");
    showBanner("⚜  France joins the Revolution!", 3800);
  }

  /* ----------------------------- Win checking ----------------------------- */
  function checkWin() {
    if (S.over) return;
    const patriotCount = ownedRegions("patriot").length;
    const crownCount = ownedRegions("crown").length;

    if (crownCount === 0) {
      return gameOver(true, "Every British garrison has been driven into the sea. The United States are free and independent!");
    }
    if (S.morale.crown <= 0) {
      return gameOver(true, "The Crown's will is broken. Weary of an unwinnable war, Britain recognizes American independence!");
    }
    if (patriotCount === 0) {
      return gameOver(false, "The last Continental army is scattered. The rebellion is crushed, and the colonies remain British.");
    }
    if (S.morale.patriot <= 0) {
      return gameOver(false, "Patriot resolve has collapsed. The Congress disbands and the dream of independence dies.");
    }
  }

  function endByAttrition() {
    S.turn = CONFIG.finalTurn; // freeze display
    const holdsCapital = capitalOwner("patriot") === "patriot";
    if (holdsCapital && S.morale.patriot >= S.morale.crown) {
      gameOver(true, "1783: Weary of a war it cannot win, Britain recognizes American independence. You endured!");
    } else if (holdsCapital) {
      gameOver(true, "1783: The war grinds to a close. Bloodied but unbroken, the colonies secure their independence.");
    } else {
      gameOver(false, "1783: With its capital lost, the rebellion could not hold. The crown prevails.");
    }
  }

  function gameOver(patriotWon, text) {
    S.over = true;
    S.winner = patriotWon ? "patriot" : "crown";
    save();
    renderAll();
    $("#go-title").textContent = patriotWon ? "Independence!" : "The Cause is Lost";
    $("#go-title").style.color = patriotWon ? "var(--patriot)" : "var(--crown)";
    $("#go-text").textContent = text;
    $("#gameover").classList.remove("hidden");
  }

  /* ------------------------------ Persistence ----------------------------- */
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function hasSave() { return !!load(); }

  /* ------------------------------- Screens -------------------------------- */
  function show(screenId) {
    for (const s of document.querySelectorAll(".screen")) s.classList.add("hidden");
    $("#" + screenId).classList.remove("hidden");
  }

  function startGame(state) {
    S = state || newState();
    selected = null;
    $("#gameover").classList.add("hidden");
    show("game-screen");
    renderLog();
    renderAll();
    if (!state) log(`The war for independence begins — ${dateLabel(1)}.`, "l-event");
  }

  /* ------------------------------- Wiring --------------------------------- */
  function init() {
    $("#btn-new-game").addEventListener("click", () => startGame(null));
    $("#btn-continue").addEventListener("click", () => {
      const s = load();
      if (s) startGame(s); else showBanner("No saved campaign found");
    });
    $("#btn-how-to").addEventListener("click", () => show("howto-screen"));
    $("#btn-howto-back").addEventListener("click", () => show("title-screen"));
    $("#btn-end-turn").addEventListener("click", endTurn);
    $("#btn-menu").addEventListener("click", () => { save(); show("title-screen"); refreshContinue(); });

    $("#modal-cancel").addEventListener("click", closeTroopDialog);
    $("#modal-confirm").addEventListener("click", confirmTroopDialog);
    $("#troop-slider").addEventListener("input", (e) => {
      $("#troop-count").textContent = e.target.value;
    });
    $("#go-restart").addEventListener("click", () => startGame(null));

    refreshContinue();
  }

  function refreshContinue() {
    $("#btn-continue").disabled = !hasSave();
  }

  document.addEventListener("DOMContentLoaded", init);

  // Test hook: expose core logic for headless simulation (no effect in browser).
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      newState, resolveBattle, dist, incomeFor, checkWin, crownTurn, endTurn,
      doAttack, doMove, legalMoves, maybeFranceEvent, recruit, defenseBonus,
      CONFIG, ADJACENCY,
      getState: () => S,
      setState: (x) => { S = x; },
      setSelected: (x) => { selected = x; },
    };
  }
})();
