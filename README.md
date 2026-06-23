# Three Kingdoms — mobile web strategy

A mobile-web port of the classic *Romance of the Three Kingdoms* strategy game,
built on the same architecture as our Dominion (Risk) branch: a **pure,
deterministic TypeScript engine** behind a thin **React UI**, with a seeded RNG
threaded through state so every game is reproducible and unit-testable.

Set in 189 AD as the Han dynasty collapses, you take one of six warlords and
contend for China across an **organic map** whose twelve provinces are drawn from
real Han-era geography (Natural Earth provincial borders, grouped into the
historical 州/*zhou*).

## Gameplay loop

A turn is one **season**. On your turn you receive **command points** (more if you
hold more provinces) and spend them on:

- **Develop / Cultivate** — grow a province's commerce (gold) and agriculture
  (grain).
- **Recruit / Train** — raise typed troops from the population and drill them.
- **Fortify** — raise the province walls (levels 0–5) to strengthen defenders.
- **Scheme** — foment unrest in an adjacent rival province.
- **March** — move troops; into hostile land this triggers a **battle**.
- **Officers & Diplomacy** — recruit wandering heroes, take/recruit/release/
  execute prisoners, and propose alliances or ceasefires.

**Supply matters**: armies eat grain every season — a starving garrison deserts —
and a campaign that outruns its supply lines fights at reduced morale.

**Troops have branches** (spear ▸ cavalry ▸ archer ▸ spear, with navies ruling
water crossings and siege battering walls), plus morale and training that swing
the odds.

Battles **auto-resolve with tactical nudges**: the lead officers' item-boosted
stats and traits, plus scripted events (fire attacks, ambushes, single-combat
duels), shape the outcome. Win by becoming **hegemon** — holding at least half of
China with a commanding lead — or by being the last warlord standing.

Officers are the heart of the game: famous figures (Cao Cao, Lü Bu, Zhuge Liang…)
fight, administer, and scheme, carry treasures and traits, and can defect, be
captured, or be recruited.

## Develop

```bash
npm install
npm run dev          # play locally
npm test             # engine unit tests + AI-vs-AI balance harness
npm run typecheck
npm run build        # production build
npm run build:single # one self-contained offline HTML file
npm run genmap       # regenerate the China map from Natural Earth data
```

## Structure

```
src/engine/      pure, deterministic game engine (no UI/DOM)
  types.ts         the serialisable domain model
  config.ts        every tunable balance number
  rng.ts           seeded mulberry32 PRNG
  scenario.ts      the 189 AD warlords + officer roster (traits, items)
  items.ts         treasure catalogue + effective-stat helpers
  battle.ts        auto-resolve battle with tactical events
  game.ts          setup, season loop, and all player actions
  ai.ts            the computer warlord (calls the same public actions)
  maps/china.ts    AUTO-GENERATED organic map of the twelve provinces
  __tests__/       vitest suites incl. the headless balance simulation
src/ui/          thin React layer (map, command sheet, persistence)
tools/genmap.mjs project real geography into the game map
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the engine/UI contract and
extension points.
