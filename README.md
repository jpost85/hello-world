# EVO: Search for Eden (web prototype)

A browser game inspired by the 1992 SNES title *EVO: Search for Eden*. Evolve
from a single cell to a complex creature: **eat prey → earn EVO points → spend
them to mutate your body → survive a tougher world → repeat.**

Built as a **web app** (works on mobile and desktop) with Phaser 3 + TypeScript +
Vite. The simulation core is renderer-agnostic and unit-tested; Phaser is only a
rendering/input shell on top of it.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm run build      # type-check + production bundle into dist/
npm run preview    # serve the production build
npm run test       # run the systems unit tests (Vitest)
npm run typecheck  # tsc --noEmit
```

## How to play

- **Move:** point/tap where you want to swim.
- **Dash:** **Space** (or the on-screen DASH button) for a short burst — to catch
  fast prey or escape a predator. Has a cooldown.
- **Eat:** touch smaller prey to bite it; defeating it grants EVO points *and*
  refills your FOOD meter.
- **Survive:** your FOOD meter drains over time; if it empties you starve and lose
  health. Keep eating.
- **Evolve:** press **E** (or the on-screen button) to open the mutation menu and
  spend points across six body slots (body, mouth, fins, armor, sense, limbs).
- **Boss gate:** bank enough EVO and the era's **boss** appears — beat it to evolve
  onward to the next era.
- Bigger creatures will damage you — out-grow them before you pick a fight. Die and
  you respawn in the same era at a small EVO cost (a setback, not a wipe).

## Architecture

```
src/
├─ systems/        Pure TS simulation core (NO Phaser). Unit-testable.
│  ├─ CreatureModel · EvolutionSystem · CombatSystem
│  ├─ EconomySystem · EcosystemSystem · ProgressionSystem
│  └─ __tests__/   Vitest coverage of the rules
├─ data/           Data-driven content: bodyParts, enemies, eras
├─ persistence/    Offline-first SaveManager (localStorage → IndexedDB/cloud seam)
├─ scenes/         Phaser rendering + input shell (Boot, Game, Evolution)
├─ config.ts       Presentation-layer tunables
└─ main.ts         Phaser bootstrap
```

Key idea: **a creature is a composition of part records, not a fixed sprite.**
Adding a mutation/enemy/era is a data entry in `src/data` — no system code
changes. See [`docs/GDD.md`](docs/GDD.md) for the full design and roadmap.

## Roadmap (short)

Prototype → MVP (touch-native controls, art/audio, survival pressure, one full
era) → v1 (branching evolution, cloud saves, leaderboards, PWA install) →
Capacitor native iOS/Android builds. Details in the GDD.
