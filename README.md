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
- **Eat:** touch smaller prey to bite it; defeating it grants EVO points.
- **Evolve:** press **E** (or the on-screen button) to open the mutation menu and
  spend points. Bank enough points to advance to the next era.
- Bigger creatures will damage you — out-grow them before you pick a fight.

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
