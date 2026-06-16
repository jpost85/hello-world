# Architecture

This document explains how the engine is structured and where to extend it for
the roadmap features. The guiding idea is a hard boundary between a **pure,
deterministic game engine** and the **React UI** that renders it.

## Layers

```
UI (React)  ──dispatches actions──►  Engine (pure functions)
            ◄────returns new state───
```

The UI never mutates game state directly. It calls an engine action
(`attack`, `placeReinforcements`, `fortify`, …), receives a brand-new
`GameState`, and re-renders. The engine has no knowledge of React, the DOM, or
any I/O.

## The state object

`GameState` (see `src/engine/types.ts`) is a single, serialisable object holding
everything about a game in progress: the map, players, per-territory ownership
and armies, generals, the current phase, the RNG state, and an event log. Because
it is plain data:

- It can be JSON-serialised for save/load or sending over a network.
- Two states can be compared (the tests rely on `toEqual`).
- A sequence of actions replayed from the same starting state and seed yields an
  identical result.

## Determinism & the RNG

`src/engine/rng.ts` implements a small seedable PRNG (mulberry32). Crucially, the
**RNG state is stored inside `GameState`** and threaded through every action that
consumes randomness (territory dealing, dice rolls). Nothing calls `Math.random`.

Consequences:

- Combat is unit-testable: feed a known seed, assert exact dice.
- Games are reproducible from a seed (the setup screen offers a fixed-seed start).
- A future authoritative server can re-run client actions and verify outcomes.

## Combat resolution

`src/engine/combat.ts` is the heart of the game. A single round:

1. Determine each side's dice count from armies present, the style's
   `diceModifier`, and (for the defender) any fortress bonus.
2. Roll the dice (sorted descending) via the seeded RNG.
3. Apply `highRollBonus` from the style and any stationed **general** to each
   side's best die.
4. Compare the top dice pairwise; the loser of each comparison loses one army.
   Ties go to the defender unless the attacker's style sets `winsTies`.

All tunable numbers live in `ATTACK_STYLES`, `DEFENSE_STYLES`, and the
`BASE_MAX_*` / `FORTRESS_DEFENSE_DICE` constants, so balancing is a data change,
not a logic change.

## Turn lifecycle

`src/engine/game.ts` is the state machine. A turn moves through three phases:

- **reinforce** — receive armies (`floor(territories/3)`, min 3, plus region
  bonuses) and place them; may also build fortresses and reposition generals.
- **attack** — repeatedly resolve combat rounds against adjacent enemies;
  capturing a territory advances armies and may eliminate a player.
- **fortify** — one move of armies through connected owned land, then `endTurn`
  hands off to the next non-eliminated player.

Each action validates its preconditions and throws a descriptive `Error` on
misuse, which the UI surfaces to the player.

## Extension points

| Roadmap item | Where it plugs in |
| --- | --- |
| New maps | Add a `GameMap` under `src/engine/maps/` (hand-written or via `tools/genmap.mjs`), then a `registry.ts` entry with a dynamic `import()` so it lazy-loads into its own chunk. The engine is data-driven; no logic changes needed. A unit test should assert adjacency symmetry and connectivity. |
| Faction traits | The `Faction` type already exists. Add trait fields and read them in `combat.ts` / reinforcement math. |
| AI opponents | Write a pure function `chooseActions(state) => actions[]` that calls the same engine actions the UI does. Determinism makes it testable. |
| Conquest cards | Add card state to `GameState` and a trade-in action that boosts reinforcements; tie award to `conqueredThisTurn`. |
| Multiplayer | Serialise `GameState` and replay actions server-side; the seeded RNG makes validation deterministic. |

## Testing

Vitest suites live in `src/engine/__tests__/`:

- `rng.test.ts` — determinism, die range, distribution.
- `map.test.ts` — the classic map's integrity (symmetric adjacency, region
  coverage, layout bounds).
- `combat.test.ts` — dice counts per style, conservation of casualties, and that
  generals/fortresses measurably shift outcomes.
- `game.test.ts` — setup invariants and the full action surface (reinforce,
  attack/capture, fortify, fortress, general movement, elimination, victory,
  turn rotation) on a controlled mini-map.
- `sim.test.ts` — the **headless balance harness**: plays full AI-vs-AI games to
  completion, asserts every game ends decisively and reproducibly, and prints a
  win-rate / game-length report for tuning `config.ts`.

Run with `npm test`. The UI layer is intentionally thin; game correctness is
guaranteed at the engine level.

## Balance configuration

`src/engine/config.ts` holds a single `CONFIG` object with every tunable number
(starting armies, reinforcement formula, dice caps, style profiles, general and
fortress values). `combat.ts` and `game.ts` read from it, so re-balancing is a
data edit in one file — and the simulation harness measures the effect.

## The AI

`src/engine/ai.ts` exposes `playAITurn(state)`, which plays a computer player's
entire turn by calling the same public engine actions a human does. Because it
cannot bypass the rules, the same function powers both single-player mode (the UI
runs it automatically on AI seats) and the balance harness (which runs it for
every seat). Its policy is a simple, competent baseline: mass reinforcements on
the best springboard, press every clearly-winning attack, then rail interior
reserves to the most-threatened front.
