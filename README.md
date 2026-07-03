# 🏀 Eurobasqet

A **web + mobile-first basketball GM simulation**. Build a winning club from the
bottom of a European league pyramid to the top flight — scouting, developing
youth through a reserve/academy squad, and surviving **promotion & relegation**
season after season.

> Status: **scaffolding**. The simulation engine runs end-to-end (see the demo
> below) and the Expo app renders the core GM screens against it. Persistence,
> transfers, and finances are stubbed for the next milestone — see the
> [roadmap](#roadmap).

## Stack

Universal **Expo (React Native + Web)** — one codebase ships to iOS, Android,
and the web — on top of a platform-agnostic TypeScript simulation core.

```
eurobasqet/
├─ apps/
│  └─ mobile/            Expo Router app (iOS · Android · Web)
│     ├─ app/            file-based routes (dashboard, roster, standings…)
│     ├─ components/     GameProvider (state) + shared UI kit
│     └─ constants/      design tokens
└─ packages/
   ├─ data/             domain schema, seeded RNG, procedural generation
   └─ engine/           simulation: ratings, game & season sim, dev, pyramid
```

The engine and data packages have **zero UI/native dependencies**, so the same
logic can later back a server, a bot, or automated tests.

## Getting started

```bash
npm install          # install workspaces

npm run sim:demo     # headless: simulate 3 seasons, print champions & churn
npm run typecheck    # type-check the engine + data packages

npm run web          # run the app in a browser
npm run mobile       # Expo dev server (scan QR for iOS/Android)
```

> The Expo dev dependencies are only needed for the app targets. `sim:demo` and
> `typecheck` run against the engine alone.

## Core concepts

| Concept | Where | Notes |
|---|---|---|
| **League pyramid** | `data/generate.ts`, `engine/league/pyramid.ts` | N tiers; top teams promote, bottom teams relegate each season. |
| **Developmental teams** | `data/generate.ts`, `engine/league/development.ts` | Every top-flight club owns a reserve squad of prospects. Reserves can't promote past their seniors; call up prospects with `callUpProspects`. |
| **Player development** | `engine/league/development.ts` | Youth grow toward `potential` (morale- & minutes-gated); veterans decline. Runs each off-season. |
| **Game simulation** | `engine/sim/game.ts` | Ratings-driven scoring with home edge, variance, and a box score. |
| **Season** | `engine/sim/season.ts` | Double round-robin fixtures, standings (2 pts win / 1 pt loss). |
| **Reproducibility** | `data/rng.ts` | A single integer `seed` deterministically generates the whole world. |

## Roadmap

- [ ] **Persistence** — save/load `GameState` via async-storage (device) + optional cloud sync.
- [ ] **Transfers & free agency** — offers, negotiations, a summer window.
- [ ] **Finances** — gate/broadcast income, wage caps, promotion prize money.
- [ ] **Richer sim** — possession-level model, injuries, fatigue across a season.
- [ ] **Tactics & lineups** — set rotations, styles, and matchup planning.
- [ ] **Cup competitions** — continental knockout alongside the league.
- [ ] **Tests** — engine unit tests + a determinism (same-seed) golden test.

## License

UNLICENSED — private project scaffold.
