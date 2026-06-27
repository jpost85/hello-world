# EVO: Search for Eden — Game Design Document (prototype)

A web game inspired by the 1992 SNES title *EVO: Search for Eden*. You begin as
a single cell and evolve — one mutation at a time — toward a complex creature.

> Status: **prototype scaffold**. The core loop is playable with placeholder
> shape-art; content, polish, and backend are roadmap items.

## 1. Core loop

The whole game is one loop, tuned to feel good in **30–90 second mobile bursts**:

```
        ┌─────────────────────────────────────────────┐
        │                                             ▼
   swim & EAT prey ──► gain EVO POINTS ──► spend points to ──► face a
        ▲                                  MUTATE your body     tougher world
        └──────────────────────────────────────────────────────────┘
```

Macro arc: cross an era's EVO-point threshold to **advance to the next era**
(Primordial Soup → Age of Fish → … → complex creature), each with a tougher
roster.

## 2. Design pillars

- **Every mutation is felt.** A new part visibly changes your creature and
  measurably changes how you play (eat bigger prey, swim faster, survive longer).
- **Short, resumable sessions.** Auto-save constantly; never punish a player for
  closing the tab mid-bite.
- **Eat-or-be-eaten tension.** Size gates what you can eat *and* what eats you.
- **No pay-to-win.** If monetized, sell time/cosmetics, never power.

## 3. Systems (the simulation core)

All rules live in `src/systems` as pure, testable TypeScript — no rendering code.

| System | Responsibility |
|---|---|
| `CreatureModel` | Derive stats by summing equipped parts; build/heal creature |
| `EvolutionSystem` | List affordable mutations; apply one (spend points, swap part) |
| `CombatSystem` | Resolve a bite; gate eating by size; deterministic damage |
| `EconomySystem` | Mint/spend EVO points; reference payout for balancing |
| `EcosystemSystem` | Which enemies spawn this era and how often (weighted) |
| `ProgressionSystem` | Era thresholds and advancement |

## 4. Data-driven content (`src/data`)

A creature is a **composition of part records**, not a fixed sprite. Adding a
mutation, enemy, or era is a data entry — no system code changes.

- `bodyParts.ts` — the evolution tree (slots: body, mouth, fins, limbs, armor, sense)
- `enemies.ts` — prey/predators with stats, reward, behavior
- `eras.ts` — macro stages, rosters, advance thresholds

## 5. Presentation (`src/scenes`, Phaser 3)

Phaser is only a rendering + input shell over the systems:

- `BootScene` — load save or make a starter creature
- `GameScene` — swim/eat loop, spawning, HUD, contact resolution
- `EvolutionScene` — paused overlay menu to spend points

Controls: move toward pointer/touch; `E` opens the evolution menu.

## 6. Persistence (`src/persistence`)

Offline-first. `SaveManager` uses localStorage for the prototype behind a small
interface; swap for IndexedDB (Dexie/`idb`) and add cloud sync
(Supabase/Firebase) at the `syncToCloud` seam without touching callers.

## 7. Tech stack

Phaser 3 · TypeScript · Vite · Vitest · PWA. Wrap with **Capacitor** later for
native iOS/Android store builds (push, IAP) from the same codebase.

## 8. Roadmap

**Now (scaffold):** playable core loop, 2 eras, shape-art, local save, unit tests.

**MVP:** real touch-native controls, art/audio, hunger/survival pressure, a boss
or environmental gate per era, juice (particles, screen feedback), 1 full era of
content.

**v1:** multiple eras with **branching evolution** (carnivore / herbivore /
amphibious), rare "mutation jelly" alternate forms, cloud saves + leaderboards,
daily challenges, PWA install, accessibility pass.

**Later:** Capacitor native builds, optional non-pay-to-win monetization,
analytics-driven economy tuning.
