# Dominion: Balance of Power

A web-based, turn-based strategy game of global conquest, built with
React + TypeScript + Vite.

This milestone delivers a **fully tested, deterministic game engine**, a
**computer opponent**, and a **playable UI** (single-player vs. AI or hot-seat)
on a **real-world map of 60 territories** drawn from actual geography. It is the
foundation for the larger feature set (more maps, factions, online multiplayer)
described in the roadmap.

> **Sibling to "Liberty's Call".** This project is built as a separate codebase
> from our Revolutionary-War game, but borrows its best habits: a centralised
> `CONFIG` balance layer, an AI that drives the game through the same actions a
> human uses, a headless full-game balance harness, and `localStorage` autosave.
> We keep React + TypeScript for scalability, and improve on Liberty's Call with
> dice-based combat and a **seeded, reproducible** RNG (Liberty's Call has none).

## Features in this build

- **Dice-based combat** — battles are resolved by rolling and comparing dice,
  just like the board game.
- **Attack & defense styles** — each side chooses how to fight, trading dice
  count, per-die strength, and tie-breaking against one another:
  - _Standard_ — classic rules (attacker up to 3 dice, defender up to 2, ties to
    the defender).
  - _Aggressive_ — attackers win tied rolls; defenders add +1 to their best die.
  - _Cautious_ — commit fewer dice for slower but safer exchanges.
- **Generals** — mobile hero units that add +1 to their side's highest die while
  stationed in a territory. They can be moved and reassigned across your
  connected land, and are **captured** (removed) if their territory is overrun.
- **Fortresses** — defensive structures that grant the defender an extra die.
  Captured fortresses are razed.
- **Computer opponents** — any seat can be a baseline AI that masses forces,
  presses winning attacks, and rails reserves to the front. Mix humans and AIs.
- **Real-world map** — 67 territories across 9 continents, projected from
  public-domain **Natural Earth** country geometry (a few large nations split
  along meridians, e.g. US East/West, Russia into three). Adjacency is derived
  from shared borders plus curated sea routes (Bering Strait, Gibraltar, etc.).
  The classic 42-territory board is also retained for tests.
- **Reinforce → Attack → Fortify** turn structure, region-control bonuses,
  player elimination, and a victory condition.
- **Autosave** — every move is persisted to the browser; reload and **Continue**.
- **Centralised balance config** and a **headless simulation harness** that
  plays hundreds of AI-vs-AI games to tune balance and guard against regressions.

## Getting started

```bash
npm install
npm run dev        # start the dev server (http://localhost:5173)
npm test           # run the engine test suite
npm run build      # type-check and produce a production build
```

## How to play (hot-seat)

1. Choose 2–6 players on the setup screen and start a game.
2. **Reinforce:** click your highlighted territories to drop armies until your
   pool is spent. Optionally build a fortress or reposition a general.
3. **Attack:** click one of your territories, then an adjacent enemy. Pick an
   attack/defense style and roll. Capturing a territory advances your armies in.
4. **Fortify:** make one move of armies between connected territories you own,
   then end your turn.
5. Eliminate every opponent to win.

Navigate the map by **scrolling to zoom** and **dragging to pan**, **pinch-to-zoom**
on touchscreens, or the on-screen +/−/reset controls; a short drag or a pinch
won't be mistaken for a territory click. The layout is responsive — on narrow
screens the control panel stacks beneath the map.

## Architecture

The codebase deliberately separates a **pure game engine** from the **UI**:

```
src/
  engine/            Pure TypeScript — no React, no DOM. Deterministic & tested.
    types.ts         Domain model (territories, players, generals, state…)
    config.ts        Central CONFIG: every tunable balance number in one place
    rng.ts           Seedable PRNG; RNG state lives in GameState for replayability
    combat.ts        Dice resolution, style tables, general/fortress modifiers
    map.ts           Queries: adjacency, ownership, region bonuses, connectivity
    game.ts          State machine: setup + every turn action (immutable updates)
    ai.ts            Baseline opponent — drives the game via the same actions
    maps/            registry (lazy loaders) + classicWorld + generated worldMap
    __tests__/       Vitest suites incl. the headless simulation harness (50 tests)
  ui/                React layer that renders state and dispatches engine actions
    useGame.ts       Hook bridging engine actions to state/selection; AI + autosave
    persistence.ts   localStorage save/load/continue
    components/      MapView (SVG board), ControlPanel, setup, dice, event log
tools/
    genmap.mjs       Projects Natural Earth GeoJSON into src/engine/maps/worldMap.ts
```

## Map data pipeline

The real-world board is generated, not hand-placed. `tools/genmap.mjs`
(the Dominion analogue of Liberty's Call's `tools-genmap.js`):

1. Downloads public-domain **Natural Earth** admin-0 country geometry (1:110m).
2. Groups/splits countries into a curated `SPEC` of 60 territories in 9 regions
   (large nations are clipped along meridians via Sutherland-Hodgman).
3. Projects everything to an equirectangular SVG, computes centroids for unit
   badges, derives land adjacency from shared borders, and adds curated sea
   routes — then verifies the graph is fully connected (so every game is winnable).
4. **Derives each continent's bonus from the graph** — `round((territories +
   2 × border-territories) / 3)` — so bonuses reward both size and the defensive
   burden of a continent's chokepoints, and stay balanced if the map changes.
5. **Compresses geometry** — Douglas-Peucker simplification plus integer
   coordinates, ~66% smaller paths with no visible change at world zoom.
   (Adjacency is computed on the full-resolution data, so it is unaffected.)

## Performance & file size

Maps are designed to scale to many boards without bloating the initial load:

- **Lazy-loaded maps.** `src/engine/maps/registry.ts` lists each map with a
  loader; the default (World) is bundled for instant boot, and every other map
  is a dynamic `import()` that Vite code-splits into its own chunk, fetched only
  when selected. Adding maps grows the on-demand chunks, not the main bundle.
- **Compressed geometry** keeps each map small (the World map's paths are ~41 KB,
  ~14 KB gzipped).
- **Single-file build** (`npm run build:single`) inlines everything — including
  the lazy chunks — into one `dist/dominion.html` (~225 KB) that runs offline by
  double-clicking. The hosted build (`npm run build`) keeps the maps split.
- **Graphics guidance for future art:** prefer vector/SVG; keep raster assets
  external, lazy-loaded, and compressed (WebP/AVIF, sprite atlases); never
  base64-inline large images.

Regenerate anytime with `node tools/genmap.mjs`. The output
(`src/engine/maps/worldMap.ts`) is committed; the source GeoJSON is re-fetched
on demand and git-ignored.

Key principles (shared with our sister project "Liberty's Call"):

- **Engine purity.** Nothing in `src/engine` imports from `src/ui`. The engine
  is a library you could run on a server or in tests without a browser.
- **Determinism.** All randomness flows through a seeded RNG whose state is part
  of `GameState`. The same actions from the same seed always produce the same
  game — which makes combat unit-testable and enables future replay/netcode.
- **Immutability.** Engine actions return new state instead of mutating, so the
  UI can diff, undo, and reason about transitions cleanly.
- **Data-driven balance.** All tunable numbers live in `config.ts` so tuning
  never touches resolution logic.
- **The AI plays by the rules.** `ai.ts` calls the same `attack`/`fortify`/… the
  player does — it can't cheat, and the balance harness reuses it to play full
  games headlessly.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for a deeper tour and the
extension points for the roadmap.

## Balance harness

`src/engine/__tests__/sim.test.ts` plays full AI-vs-AI games to completion and
prints a balance line during `npm test`, e.g.:

```
[balance] 120 games · avg 17.2 turns · p1 85 / p2 35 wins
```

`src/engine/__tests__/balance-continents.test.ts` complements it by playing
6-player world games and reporting, per continent, how often it is secured and
whether the first holder wins — the read used to confirm the derived continent
bonuses produce a sensible value gradient (corners are footholds; large central
masses are decisive) with no continent a guaranteed win.

Together these are the dashboard for tuning `CONFIG` and the map. (The 2-player
line still shows a notable first-player advantage — a known item to balance.)

## Roadmap

- [x] Computer opponents (baseline AI).
- [x] Autosave / continue.
- [x] Headless balance harness.
- [x] Real-world map generated from Natural Earth geometry (55 territories).
- [x] Continent bonuses derived from map structure and validated with the harness.
- [x] Antarctica as a non-playable decorative landmass.
- [x] Geometry compression + lazy-loaded maps (scales to many boards).
- [x] Map picker (World / Classic / Caribbean) that lazy-loads the chosen board.
- [x] Multi-map genmap with regional crop + 1:50m detail; **Caribbean theatre** (16 territories).
- [x] Theatres: **Napoleonic Europe**, **Scramble for Africa**, **Egypt & the Near East**, **Crimean War**, **Indian Subcontinent** (8 maps total).
- [ ] More theatres (Southeast Asia, North America, …) — just config blocks now.
- [x] Faction pool (great powers) with per-map era rosters; generic factions for World/Classic.
- [ ] Faction traits (e.g. British naval bonus) layered on the shared faction objects.
- [ ] Tune first-player advantage (e.g. scaling setup or reinforcement curves).
- [ ] Faction traits/bonuses (the `Faction` type is the hook).
- [ ] Smarter AI difficulty levels.
- [ ] Conquest cards / set trade-ins for escalating reinforcements.
- [ ] Animations for dice and troop movement.
- [ ] Online multiplayer (deterministic engine + serialisable state enable this).
