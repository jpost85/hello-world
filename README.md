# Risk · 1996 Web Remake

A web-based remake of the 1996 PC game *Risk: The Game of Global Domination*,
built with React + TypeScript + Vite.

This first milestone delivers a **fully tested, deterministic game engine** plus
a **playable hot-seat UI** on the classic 42-territory world map. It is the
foundation for the larger feature set (more maps, factions, AI opponents, online
multiplayer) described in the roadmap below.

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
  connected land.
- **Fortresses** — defensive structures that grant the defender an extra die.
  Captured fortresses are razed.
- **Classic world map** — all 42 territories and 6 continents with authentic
  adjacency and region bonuses.
- **Reinforce → Attack → Fortify** turn structure, region-control bonuses,
  player elimination, and a victory condition.

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
    rng.ts           Seedable PRNG; RNG state lives in GameState for replayability
    combat.ts        Dice resolution, style tables, general/fortress modifiers
    map.ts           Queries: adjacency, ownership, region bonuses, connectivity
    game.ts          State machine: setup + every turn action (immutable updates)
    maps/            Static board data (classic world map)
    __tests__/       Vitest suites (38 tests)
  ui/                React layer that renders state and dispatches engine actions
    useGame.ts       Hook bridging engine actions to component state/selection
    components/      MapView (SVG board), ControlPanel, setup, dice, event log
```

Key principles (carried over from prior projects):

- **Engine purity.** Nothing in `src/engine` imports from `src/ui`. The engine
  is a library you could run on a server or in tests without a browser.
- **Determinism.** All randomness flows through a seeded RNG whose state is part
  of `GameState`. The same actions from the same seed always produce the same
  game — which makes combat unit-testable and enables future replay/netcode.
- **Immutability.** Engine actions return new state instead of mutating, so the
  UI can diff, undo, and reason about transitions cleanly.
- **Data-driven balance.** Combat styles, dice caps, and structure bonuses live
  in tables (`combat.ts`) so tuning never touches resolution logic.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for a deeper tour and the
extension points for the roadmap.

## Roadmap

- [ ] Additional maps and a map-selection screen (the engine is already
      map-agnostic; only data is needed).
- [ ] Faction traits/bonuses (the `Faction` type is the hook).
- [ ] AI opponents (the engine's pure actions make a bot straightforward).
- [ ] Risk cards / set trade-ins for escalating reinforcements.
- [ ] Animations for dice and troop movement.
- [ ] Online multiplayer (deterministic engine + serialisable state enable this).
