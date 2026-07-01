# Aphelion

A hex-based, web-based **prototype** game about terraforming a dead world and
keeping a colony alive long enough to inherit it. Design DNA:
[Sid Meier's Alpha Centauri](https://en.wikipedia.org/wiki/Sid_Meier%27s_Alpha_Centauri)
(ideological factions, a planet you reshape) crossed with
[Terraforming Mars](https://en.wikipedia.org/wiki/Terraforming_Mars_(board_game))
(global parameters you push toward habitable, project engine-building).

This repo is **scaffolding and a systems outline**, not a finished game. The
hex-map rendering is deliberately a placeholder — you already have that
infrastructure elsewhere, so this focuses on the pieces around it: **factions,
terraforming projects, and eking out survival in space.**

## What's here

| System | Where | What it does |
| --- | --- | --- |
| **Factions** | `src/data/factions.ts` | 6 playable factions (SMAC × Terraforming-Mars archetypes), each a distinct economy + survival strategy. |
| **Terraforming projects** | `src/data/projects.ts` | The core loop: spend resources → wait → move a planetary parameter. Repeatable levers + one-shot mega-projects. |
| **Tech tree** | `src/data/technologies.ts` | Small gating DAG that unlocks the stronger projects. |
| **Hazards / events** | `src/data/hazards.ts` | Solar flares, dust storms, breaches — the survival pressure. |
| **Planetary model** | `src/engine/terraforming.ts` | The 5 global dials (temperature, pressure, oxygen, hydrosphere, biomass) and derived habitability. |
| **Colony survival** | `src/engine/survival.ts` | Per-turn economy + life support: production, consumption, starvation, blackouts, population dynamics. |
| **Turn engine** | `src/engine/game.ts` | Ties it together: `createGame` → `startProject`/`setResearch` → `endTurn`. Pure-ish, DOM-free, unit-testable. |
| **Hex seam** | `src/hex/hex.ts` | `HexMapAdapter` — the documented boundary where **your** hex map plugs in. |
| **UI** | `src/ui/*`, `src/main.ts` | Framework-free faction-select + HUD, plus a throwaway canvas hex renderer. |

See **[docs/DESIGN.md](docs/DESIGN.md)** for the full design outline, the core
loop, how the systems interlock, and a roadmap of what to build next.

## Running it

```bash
npm install
npm run dev        # start the Vite dev server
# or
npm run build      # type-check + production build to dist/
npm run typecheck  # types only
```

Open the dev server URL, pick a faction, and play: research tech, start
terraforming projects, and hit **End Turn** to advance. Survive the hazards;
watch the planetary meters climb toward habitable.

## The core loop

```
        ┌─────────────────────────────────────────────────┐
        │                                                  │
   research tech ──► unlock projects ──► spend resources   │
        ▲                                     │            │
        │                                     ▼            │
   colony produces  ◄── population ◄── habitability rises  │
   resources & grows      grows        (planet warms,      │
        │                              gains air/water/life)│
        ▼                                     ▲            │
   life support / hazards ── survive ─────────┘            │
        │                                                  │
        └──────────────► or fail, and the colony dies ─────┘
```

Terraforming and survival are coupled on purpose: a greener planet feeds a
bigger, more resilient colony, which can terraform faster — but every colonist
is also a mouth to feed when the next dust storm hits.

## Plugging in your hex map

The engine knows nothing about tiles. Implement `HexMapAdapter`
(`src/hex/hex.ts`) with your existing infrastructure and construct it in
`mountGameShell()` (`src/main.ts`) in place of `CanvasHexRenderer`. Nothing else
needs to change. See `docs/DESIGN.md` § "Integrating your hex map".

## Status

Prototype / scaffold. The systems work end-to-end and are balanced enough to
play, but the numbers are first-pass and meant to be tuned — see the balance
notes in `docs/DESIGN.md`.
