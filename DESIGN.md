# Syndicate Remake — Design Document

A web-based remake of the 1993 isometric tactical game *Syndicate*: control a
squad of cyborg agents on an isometric square grid, in a persistent
world-conquest meta-game.

**Scope:** full game ambition. **Renderer:** PixiJS (WebGL). **Language:**
TypeScript. **Build:** Vite.

---

## 0. Foundational principles (decide once, obey everywhere)

1. **The simulation knows only grid coordinates.** Isometric pixels exist only
   in the render layer. The sim is pure data + pure functions.
2. **The simulation is deterministic and runs on a fixed timestep.** Same
   inputs → same outputs, on every machine. (See §6.)
3. **Verticality is a first-class dimension from day one.** Every coordinate is
   `(col, row, z)`, never `(col, row)`. (See §5.)
4. **Rendering interpolates; it never simulates.** The render clock is
   independent of the sim clock. (See §6.4.)

Principles 2 and 3 are the two things that are cheap to design in now and
brutally expensive to retrofit. They are designed in below.

---

## 1. Layered architecture

```
┌─────────────────────────────────────────────┐
│  META LAYER   research, equipment, world map, │  ← persisted (save files)
│               funds, mission selection        │
├─────────────────────────────────────────────┤
│  MISSION LAYER  objectives, spawns, win/lose, │  ← per-mission state
│                 scripting, persuasion         │
├─────────────────────────────────────────────┤
│  SIM LAYER    ECS: movement, AI, combat,      │  ← fixed timestep, deterministic
│               pathfinding, LOS — pure logic    │
├─────────────────────────────────────────────┤
│  RENDER LAYER  PixiJS: iso projection, sprite │  ← variable timestep, interpolated
│                sorting, camera, UI, FX         │
└─────────────────────────────────────────────┘
```

The SIM layer never imports from RENDER. The RENDER layer reads sim state but
never mutates it. Enforce with module boundaries / lint rules.

---

## 2. Coordinate systems

There are exactly three, and conversions only happen at defined seams.

| Space | Type | Lives in | Notes |
|---|---|---|---|
| **Grid** | `(col, row, z)` integers; entities use floats for sub-tile position | SIM | The only space logic uses |
| **World pixel** | `(x, y)` floats | RENDER | Iso projection of grid; camera-independent |
| **Screen pixel** | `(x, y)` floats | RENDER | World minus camera offset, times zoom |

```ts
const TILE_W = 64;          // diamond width
const TILE_H = 32;          // diamond height (= TILE_W / 2, the 2:1 iso ratio)
const TILE_Z = 24;          // vertical pixels per height level

// grid -> world pixel (anchor = top of the tile diamond)
function gridToWorld(col: number, row: number, z: number) {
  return {
    x: (col - row) * (TILE_W / 2),
    y: (col + row) * (TILE_H / 2) - z * TILE_Z,
  };
}

// world pixel -> grid, at a KNOWN z plane (picking; see §5.5 for multi-level)
function worldToGrid(wx: number, wy: number, z: number) {
  const y = wy + z * TILE_Z;
  const col = (wx / (TILE_W / 2) + y / (TILE_H / 2)) / 2;
  const row = (y / (TILE_H / 2) - wx / (TILE_W / 2)) / 2;
  return { col: Math.floor(col), row: Math.floor(row) };
}
```

---

## 3. Map representation

Struct-of-arrays, cache-friendly, trivially serializable. Indexed as a flat
3D array `idx = z * (W*H) + row * W + col`.

```ts
interface MapData {
  width: number;            // W
  height: number;           // H
  levels: number;           // Z  (e.g. 4: ground, walkway, upper, roof)
  tiles:    Uint16Array;    // tile-type id per cell
  edges:    Uint8Array;     // wall/edge-blocking bitmask per cell (see §4)
  cover:    Uint8Array;     // cover value 0..255 for combat
  ramps:    Uint8Array;     // vertical-connectivity bitmask per cell (see §5)
  objects:  ObjectLayer;    // doors, terminals, destructibles (sparse map)
}
```

**Edge blocking, not tile blocking.** A wall sits *between* two tiles. Each cell
stores 4 bits for which of its N/E/S/W edges block movement and bullets, so a
thin wall blocks along one edge without consuming a whole tile. This is the most
important map-data decision for tactical fidelity.

```
edges bitmask:  0b0000_WSEN
  bit 0 (N): edge to (col,   row-1)
  bit 1 (E): edge to (col+1, row  )
  bit 2 (S): edge to (col,   row+1)
  bit 3 (W): edge to (col-1, row  )
```

---

## 4. Movement adjacency & blocking

A move from cell A to neighbor B is legal iff:
- B is in-bounds and its tile type is walkable, AND
- the shared edge is not blocked in `edges` for either A or B, AND
- the z-transition is legal per §5.

Diagonal moves additionally require that **both** orthogonal corners are open
(no cutting through wall corners).

---

## 5. Verticality — designed in

Verticality is the signature of Syndicate's cityscapes (roof snipers, elevated
walkways, bridges, multi-floor buildings). It is **not** an afterthought layer;
it is the `z` axis of every coordinate.

### 5.1 What `z` means
`z` is a discrete height *level*, not free 3D. Level 0 = street. Higher levels =
walkways, building floors, rooftops. `TILE_Z` pixels of vertical screen offset
per level. Entities have a float `z` only while traversing ramps/stairs;
otherwise integer.

### 5.2 Vertical connectivity (`ramps`)
Most cells connect only to the 8 horizontal neighbors at the same `z`. Vertical
movement is allowed **only** through cells flagged in the `ramps` array:

```
ramps bitmask per cell:
  bit 0  RAMP_UP      this cell slopes up to (col,row,z+1) in its facing dir
  bit 1  RAMP_DOWN    this cell slopes down to (col,row,z-1)
  bit 2  STAIR        stepwise vertical link (interior stairs)
  bit 3  ELEVATOR     scripted vertical teleport (object-driven)
  bits 4-5  facing direction of the ramp/stair (N/E/S/W)
```

Pathfinding treats a flagged cell as having extra neighbors at `z±1`. This keeps
the graph sparse (99% of cells are purely horizontal) while making roofs and
walkways genuinely reachable.

### 5.3 Occlusion & "see-through" upper levels
Upper floors will hide the action beneath them. Two mechanisms:
- **Roof fade:** when an agent is under a roof/upper level, fade that level's
  tiles to translucent (the original used a similar cutaway). Driven by tracking
  which cells are "occupied-below" by a controlled agent.
- **Per-level layer toggles:** the renderer groups sprites by `z` into separate
  PixiJS containers, so a level can be dimmed/hidden wholesale cheaply.

### 5.4 Combat across levels
LOS and projectiles operate in 3D-on-the-grid: the supercover ray (§8) steps
through `(col,row,z)` cells. A sniper on a roof has LOS to the street below if no
intervening cell/edge blocks the ray. Falling damage and grenades arcing between
levels become possible later but reuse the same z-aware ray.

### 5.5 Picking with multiple levels
A screen click maps to multiple candidate `(col,row,z)` cells (one per level,
since higher levels shift up-screen). Resolve by testing candidates from the
**topmost visible level downward**, returning the first whose tile is solid and
actually rendered (respecting roof-fade). This makes clicking a rooftop vs. the
street under it unambiguous.

### 5.6 Render sort with height — see §7.2.

---

## 6. Determinism & the fixed-timestep loop — designed in

Determinism is required for: reproducible pathfinding/combat, save/replay,
debugging ("it desynced on tick 4012"), and any future multiplayer/spectator
mode. It constrains how *every* system is written, so it is fixed now.

### 6.1 The loop
```ts
const SIM_HZ = 60;
const SIM_DT = 1000 / SIM_HZ;     // fixed ms per sim tick
let accumulator = 0;
let prevState, curState;          // double-buffered for interpolation

function frame(now: number) {
  accumulator += now - lastFrame;
  lastFrame = now;
  // clamp to avoid spiral-of-death after a tab-stall
  if (accumulator > 250) accumulator = 250;

  while (accumulator >= SIM_DT) {
    prevState = curState;
    curState = simTick(curState, inputForTick(simClock));   // pure step
    simClock++;
    accumulator -= SIM_DT;
  }

  const alpha = accumulator / SIM_DT;       // 0..1 interpolation factor
  render(prevState, curState, alpha);        // RENDER reads, never mutates
  requestAnimationFrame(frame);
}
```

### 6.2 Determinism rules (enforced)
- **No wall-clock or `Math.random()` in SIM.** Time is `simClock` (tick count).
- **Seeded PRNG** threaded through sim state; every random draw advances it.
  A mulberry32/xoshiro-style PRNG stored in the world state, not a global.
- **No floating-point nondeterminism across engines:** prefer integer or fixed-
  point grid math for anything that affects logic; reserve floats for
  render-only interpolation. (Practical compromise: keep sim float math simple
  and identical-order; avoid `Math.hypot`-style platform variance in logic —
  use squared distances and integer comparisons where possible.)
- **Stable iteration order.** Entities processed in a deterministic order
  (by entity id), never hash-map insertion order.
- **Systems run in a fixed sequence each tick** (see §7.3 order is for render;
  sim order below).

### 6.3 Input model
Input is captured as discrete **commands** stamped with the target tick
(`{tick, type, payload}`). The sim consumes commands for the current tick only.
This is what makes replays (record the command stream + seed) and netplay
(exchange command streams) drop-in later. Even single-player records commands.

### 6.4 Render decoupling
Render interpolates entity positions between `prevState` and `curState` by
`alpha`, so 60Hz sim looks smooth at any display refresh. Render may run faster
or slower than sim without affecting logic.

### 6.5 Sim system order (per tick)
```
1. apply commands for this tick
2. AISystem        (decisions; reads last tick's vision)
3. PathSystem      (A* requests, path repair)
4. MovementSystem  (advance along paths, incl. z via ramps)
5. CombatSystem    (fire, projectile advance, damage)
6. PersuasionSystem(faction flips)
7. VisionSystem    (recompute LOS sets — throttled, see §8)
8. DeathSystem     (remove dead, drop items)
9. advance PRNG bookkeeping / mission triggers
```

---

## 7. Rendering (PixiJS)

### 7.1 Projection
2:1 diamonds, conversions per §2. Anchor every sprite at the bottom-center of
its tile diamond so placement math is uniform.

### 7.2 Sort order with height — the thing everyone gets wrong
One merged back-to-front pass over tiles **and** entities, keyed by a single
depth value so a pillar correctly occludes an agent behind it:

```ts
depth = z * Z_BAND + (col + row) * COL_ROW_BAND + tieBreaker;
//   Z_BAND      large enough that any higher z always draws after lower z
//   COL_ROW_BAND orders within a level back-to-front
//   tieBreaker   stable per-entity to avoid z-fighting flicker
```

In PixiJS: `container.sortableChildren = true`, set each sprite's
`zIndex = depth`. Static tiles are pre-baked into chunk `RenderTexture`s (§7.4)
so only moving entities are re-sorted each frame, against fixed tile anchors.

### 7.3 Layered-by-z containers
One PixiJS container per `z` level enables cheap roof-fade / level toggles
(§5.3) and bounds the sort cost per level.

### 7.4 Performance
- **Frustum culling:** build sprites only for cells inside the camera's diamond
  view. A city is 256×256×4 — never iterate the whole map per frame.
- **Chunking:** 16×16-tile chunks pre-rendered to `RenderTexture`; a chunk is
  redrawn only when a tile in it changes (door opens, explosion).
- **Atlases + batching:** shared texture atlases per faction/tileset so WebGL
  batches draw calls. Target: hundreds of pedestrians + agents at 60fps.

---

## 8. Combat, line-of-sight, projectiles

- **LOS:** z-aware supercover ray (Bresenham variant in 3D-on-grid) from shooter
  to target, checking `edges` and accumulating `cover` along the ray. Use
  squared distances / integer steps to stay deterministic (§6.2).
- **Vision throttling:** recompute each agent's visible set a few times per
  second (e.g. every 6 ticks), staggered by entity id, not every tick.
- **Projectiles** are entities with their own movement (laser, minigun, Gauss,
  flamethrower) — one system, different speed/damage/area params.
- **Destructible environment:** explosions mutate `tiles`/`edges`/`cover` and
  mark affected render chunks dirty; fleeing burning civilians = emergent chaos,
  free once entities + tile-damage exist.

---

## 9. ECS — entity model

```
Components:
  Transform(col,row,z + float subpos) · Path · Health · Weapon ·
  Faction · Sprite · Selectable · Persuadable · AIState ·
  Vehicle · Vision · Modifiers(drug sliders)

Systems: see §6.5 (sim) and §7 (render).
```

Signature mechanics that fall out cleanly:
- **Persuadertron:** `PersuasionSystem` flips a target's `Faction` to yours in
  range — the snowballing follower crowd.
- **Drug sliders** (IPA / Perception / Adrenaline): `Modifiers` adjust speed,
  accuracy, vision in real time.
- **Vehicles:** an entity others can enter, swapping their movement for the
  vehicle's; cars follow road-tile splines.

---

## 10. Pathfinding

- **A\*** over the 3D-on-grid graph (8 horizontal neighbors + z-neighbors via
  `ramps`), binary-heap open set, deterministic tie-breaking by cell index.
- **Path caching + repair:** recompute only when blocked; local repair before
  full replan.
- **Crowds:** pedestrians use cheap flow-fields / random-walk + local avoidance,
  not full A*. Reserve A* for agents, police, rival syndicates.

---

## 11. Meta-game layer

- **World map:** territory conquest mission-by-mission; conquered regions yield
  tax income.
- **Research tree:** dependency DAG with timed completion; unlocks weapons,
  mods, cybernetics (limb/eye/chest/heart upgrades boosting stats).
- **Loadout:** assign weapons/mods to the 4 agents pre-mission.
- **Cyborg agents:** persistent stats/upgrades across missions; permanent death.

---

## 12. Persistence

- **Save format:** versioned JSON (or compact binary) of meta state + in-mission
  ECS snapshot. Deterministic pure-data sim makes serialization "dump the
  component arrays + PRNG state + simClock."
- **Replays:** seed + command stream (§6.3) — tiny, and reproduce a mission
  exactly.
- **Storage:** IndexedDB for local saves (handles large blobs); optional cloud
  save later. **Version every schema from day one.**

---

## 13. Art pipeline

- **8-direction** agent sprites (iso movement needs N/NE/E/.../NW).
- **Atlases** per faction/animation + a tile atlas, consistent bottom-center
  anchor.
- Build the whole engine on **colored-diamond placeholders** first; swap real
  art (pre-rendered 3D→sprite, the original's look) in last.

---

## 14. Build order (each step runnable)

1. Iso grid renders + camera pan/zoom + mouse tile-picking (highlight hover).
2. One agent, click-to-move with A* + smooth interpolation.
3. **Multi-level height** + correct sort/occlusion + roof-fade. *(verticality)*
4. **Fixed-timestep deterministic loop + command/replay plumbing.** *(determinism)*
5. Squad of 4: selection, group move.
6. Enemies + LOS + shooting + health/death.
7. Persuadertron + pedestrian crowds + vehicles.
8. Mission objectives + win/lose + one full playable mission.
9. Meta layer: world map, research, loadout, save/load.
10. Art pass + audio + polish.

Steps 3 and 4 are pulled early on purpose: verticality and determinism are the
two retrofit-expensive systems, so the engine is built around them before the
gameplay surface grows.
