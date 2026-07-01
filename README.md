# Aphelion

A hex-based, web-based **prototype** game about terraforming a dead world and
keeping a colony alive long enough to inherit it. Design DNA:
[Sid Meier's Alpha Centauri](https://en.wikipedia.org/wiki/Sid_Meier%27s_Alpha_Centauri)
(ideological factions, a planet you reshape) crossed with
[Terraforming Mars](https://en.wikipedia.org/wiki/Terraforming_Mars_(board_game))
(global parameters you push toward habitable, project engine-building).

The defining idea: the game **begins like Terraforming Mars** (a corporation
making a dead world profitable) and **evolves into Alpha Centauri** (a
civilization with its own philosophy, and eventually its own sovereignty). That
evolution is a one-way **phase arc**:

> **Corporate Terraforming** → **The First Settlers** → **Ideology Emerges** → **The Question of Independence**

Each phase unlocks a new layer of systems as the planet — and the society on it —
matures.

This repo is **scaffolding and a systems outline**, not a finished game. The
hex-map rendering is deliberately a placeholder — you already have that
infrastructure elsewhere, so this focuses on the pieces around it.

## What's here

**Terraforming & survival (the opening game):**

| System | Where | What it does |
| --- | --- | --- |
| **Factions** | `src/data/factions.ts` | 6 playable factions (SMAC × Terraforming-Mars archetypes), each a distinct economy + survival strategy. |
| **Terraforming projects** | `src/data/projects.ts` | The core loop: spend resources → wait → move a planetary parameter. Repeatable levers + one-shot mega-projects. |
| **Tech tree** | `src/data/technologies.ts` | Small gating DAG that unlocks the stronger projects. |
| **Hazards / events** | `src/data/hazards.ts` | Solar flares, dust storms, breaches — the survival pressure. |
| **Planetary model** | `src/engine/terraforming.ts` | The 5 global dials (temperature, pressure, oxygen, hydrosphere, biomass) and derived habitability. |
| **Colony survival** | `src/engine/survival.ts` | Per-turn economy + life support: production, consumption, starvation, blackouts, population. |

**Civilization layer (unfolds as the world matures):**

| System | Where | What it does |
| --- | --- | --- |
| **Phase arc** | `src/data/phases.ts`, `src/engine/phases.ts` | Corporate → Settlement → Ideological → Independence; each phase unlocks new systems. |
| **Emergent ideology** | `src/data/ideologies.ts`, `src/engine/ideology.ts` | Ideology is *accrued from choices*, not chosen; the dominant leaning grants effects. |
| **Social engineering** | `src/data/policies.ts`, `src/engine/policies.ts` | 5 tunable policy axes, each a trade-off feeding the economy, morale, and ideology. |
| **Internal politics** | `src/data/politics.ts`, `src/engine/politics.ts` | 5 interest groups that react to policy; discontent costs stability. |
| **Notable colonists** | `src/data/characters.ts`, `src/engine/characters.ts` | Named individuals with traits emerge and shape the society. |
| **Breakthroughs** | `src/data/breakthroughs.ts`, `src/engine/breakthroughs.ts` | World-changing discoveries that fire once and reshape strategy. |
| **The Chronicle** | `src/engine/chronicle.ts` | History as a first-class mechanic — the planet's permanent record. |

**Glue & presentation:**

| System | Where | What it does |
| --- | --- | --- |
| **Turn engine** | `src/engine/game.ts` | Ties it together: `createGame` → `startProject`/`setResearch`/`setPolicy` → `endTurn`. Pure-ish, DOM-free, testable. |
| **Hex seam** | `src/hex/hex.ts` | `HexMapAdapter` — the documented boundary where **your** hex map plugs in. |
| **UI** | `src/ui/*`, `src/main.ts` | Framework-free faction-select + tabbed HUD (Colony / Society / History), plus a throwaway canvas hex renderer. |

See **[docs/DESIGN.md](docs/DESIGN.md)** for the full design outline — the phase
arc, how every system interlocks, an honest scaffolded-vs-deep status, and a
roadmap toward the rest of the vision (living planet, native life, evolving
diplomacy, and a Mars whose history persists across campaigns).

## Running it

```bash
npm install
npm run dev        # start the Vite dev server
# or
npm run build      # type-check + production build to dist/
npm run typecheck  # types only
```

Open the dev server URL, pick a faction, and play. The sidebar has three tabs:

- **Colony** — research tech, start terraforming projects, watch the planetary
  meters climb. Hit **End Turn** to advance.
- **Society** — unlocks once the world is livable enough for settlers (~12%
  habitability): tune social-engineering policies, watch your ideology emerge,
  manage interest groups, and meet the colonists who rise.
- **History** — the Chronicle: the landmark moments as they're written.

Survive the hazards, terraform the planet, and carry a corporate outpost all the
way to the question of independence.

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

Prototype / scaffold. Every system above works end-to-end: a deterministic
engine test drives a colony through all four phases and asserts each subsystem
fires, and a browser test confirms the UI reaches the Settlement phase and
surfaces every panel. The numbers are first-pass and meant to be tuned, and
several pieces of the larger vision (living planet, native life, evolving
diplomacy, cross-campaign persistence) are described in `docs/DESIGN.md` but not
yet implemented. See the "scaffolded vs. deep" status there for an honest map.
