# Risk · 1996 Web Remake

A web-based remake of the 1996 PC game *Risk: The Game of Global Domination*,
built with React + TypeScript + Vite.

This milestone delivers a **fully tested, deterministic game engine**, a
**computer opponent**, and a **playable UI** (single-player vs. AI or hot-seat)
on the classic 42-territory world map. It is the foundation for the larger
feature set (more maps, factions, online multiplayer) described in the roadmap.

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
- **Classic world map** — all 42 territories and 6 continents with authentic
  adjacency and region bonuses.
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
    maps/            Static board data (classic world map)
    __tests__/       Vitest suites incl. the headless simulation harness (41 tests)
  ui/                React layer that renders state and dispatches engine actions
    useGame.ts       Hook bridging engine actions to state/selection; AI + autosave
    persistence.ts   localStorage save/load/continue
    components/      MapView (SVG board), ControlPanel, setup, dice, event log
```

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

This is the dashboard for tuning `CONFIG`. (It currently shows a notable
first-player advantage — a known item to balance, see roadmap.)

## Roadmap

- [x] Computer opponents (baseline AI).
- [x] Autosave / continue.
- [x] Headless balance harness.
- [ ] Tune first-player advantage (e.g. scaling setup or reinforcement curves).
- [ ] Additional maps and a map-selection screen (the engine is already
      map-agnostic; only data is needed).
- [ ] Faction traits/bonuses (the `Faction` type is the hook).
- [ ] Smarter AI difficulty levels.
- [ ] Risk cards / set trade-ins for escalating reinforcements.
- [ ] Animations for dice and troop movement.
- [ ] Online multiplayer (deterministic engine + serialisable state enable this).
