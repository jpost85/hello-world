# Architecture

This project deliberately mirrors the Dominion (Risk) branch so the two
troubleshoot the same way. The guiding idea is a hard boundary between a **pure,
deterministic game engine** and the **React UI** that renders it.

## Layers

```
UI (React)  ──dispatches actions──►  Engine (pure functions)
            ◄────returns new state───
```

The UI never mutates game state directly. It calls an engine action (`develop`,
`recruit`, `scheme`, `march`, `endTurn`, …), receives a brand-new `GameState`,
and re-renders. The engine has no knowledge of React, the DOM, or any I/O.

## The state object

`GameState` (see `src/engine/types.ts`) is a single, serialisable object holding
everything about a game in progress: the map, players, per-province ownership /
troops / economy, officers, the season and phase, the RNG state, and an event
log. Because it is plain data it can be JSON-serialised for save/load (see
`src/ui/persistence.ts`), compared in tests with `toEqual`, and replayed
deterministically from a seed.

## Determinism & the RNG

`src/engine/rng.ts` is a seedable mulberry32 PRNG (shared verbatim with
Dominion). The **RNG state lives inside `GameState`** and is threaded through
every action that consumes randomness (battles, schemes). Nothing calls
`Math.random`. Consequences: battles are unit-testable from a known seed, games
are reproducible, and a future authoritative server can re-run client actions to
validate them.

## The organic map

Provinces are not drawn by hand. `tools/genmap.mjs` projects **real Natural Earth
admin-1 geometry** for modern Chinese provinces, groups them into the twelve
Han-dynasty provinces (zhou), clips them to the era's frontier, simplifies the rings
(Douglas–Peucker), and emits `src/engine/maps/china.ts` — each province carrying
a real composite-border SVG `path`, a derived adjacency graph, and region
groupings. Adjacency symmetry and connectivity are asserted in `map.test.ts`.
This is exactly Dominion's map pipeline, pointed at China.

## Turn lifecycle

`src/engine/game.ts` is the state machine. The RoTK reshaping of Dominion's
reinforce→attack→fortify is a **seasonal command loop**:

- **beginTurn** — collect seasonal income (gold/food, autumn harvest, upkeep,
  order drift) and refresh command points (scaled by provinces held).
- **command** — spend command points on develop / recruit / fortify / scheme /
  march. Marching into hostile land triggers a battle.
- **endTurn** — hand off; after the last warlord the season (and, each spring,
  the year) advances.

Each action validates its preconditions and throws a descriptive `Error` on
misuse, which the UI surfaces to the player.

## Battle resolution

`src/engine/battle.ts` auto-resolves a field battle over attrition rounds, but
the lead officers' stats and scripted tactical events (fire attack, ambush,
duel) swing it. All tunable numbers live in `config.ts`, so balancing is a data
change, not a logic change. The `casualtyPowerExponent` controls how lopsided
battles are in favour of the stronger army — the lever that lets a dominant force
chain conquests.

## Victory

A warlord wins by **hegemony** (holding at least `dominationFraction` of all
provinces with at least `leadMultiple`× the nearest rival) or by being the last
standing. Both are checked after every capture and hand-off.

## The AI

`src/engine/ai.ts` exposes `playAITurn(state)`, which plays a computer warlord's
whole season by calling the same public engine actions a human does — it cannot
bypass the rules. The same function powers single-player mode and the balance
harness. Its policy: press any clearly-winning border attack, else rail interior
reserves to the most-threatened front, else raise troops, else develop.

## Testing

Vitest suites live in `src/engine/__tests__/`:

- `rng.test.ts` — determinism and range.
- `map.test.ts` — twelve provinces, symmetric adjacency, connectivity, real paths.
- `battle.test.ts` — determinism, numerical edge, and that ramparts/officers
  measurably shift outcomes.
- `game.test.ts` — setup invariants and the full action surface.
- `sim.test.ts` — the **headless balance harness**: plays full AI-vs-AI games to
  completion, asserts every game ends decisively and reproducibly, and prints a
  win-rate / game-length report for tuning `config.ts`.

Run with `npm test`. The UI layer is intentionally thin; correctness is
guaranteed at the engine level.

## Extension points

| Roadmap item | Where it plugs in |
| --- | --- |
| New scenarios | Add a `Scenario` in `scenario.ts` (warlords, holdings, officers, traits, items). |
| New maps / theatres | Add a `genmap` config and a `registry.ts` entry; the engine is data-driven. |
| New treasures / traits | Add to `items.ts` / the `OfficerTrait` union; `effectiveStats`/`hasTrait` apply them. |
| Deeper diplomacy | Relations, alliances and ceasefires live in `GameState`; extend `proposePact` & AI policy. |
| Deeper battles | `battle.ts` is isolated behind `resolveBattle`; swap the model without touching `game.ts`. |
| Multiplayer | Serialise `GameState`, replay actions server-side; the seeded RNG makes validation deterministic. |

Already implemented on top of the base loop: a **commerce/agriculture + food-supply
economy**, **typed troops** with morale & training, **officer items and traits**,
**prisoners** (recruit/release/execute) and officer **defection**, and
**diplomacy** (alliances, timed ceasefires, relations).
