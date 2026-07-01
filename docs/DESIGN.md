# Aphelion — Design Outline

A working design document for the prototype. It describes the intended game,
the systems as currently scaffolded, and where each one is meant to grow. Treat
the numbers as first-pass and tunable; treat the structure as the thing to
build on.

---

## 1. Pitch

You are one faction among several racing to make a dead world livable. Every
turn you juggle two clocks:

- **Terraforming** — push the planet's five global parameters toward a
  habitable target (the long-term win).
- **Survival** — keep your colony fed, powered, and intact against a hostile
  environment (the short-term fail state).

The tension is that the two compete for the same resources. Over-invest in
terraforming and a dust storm starves you; play it too safe and a rival's
world blooms first.

Inspirations: **Alpha Centauri** (ideological factions, a living planet, a
tech-and-terrain race) and **Terraforming Mars** (global parameters, project
engine-building, event-driven risk).

---

## 2. The five planetary parameters

Defined in `src/engine/terraforming.ts`. Each has a dead-planet `min`, a
habitable `target`, and a hard `max`.

| Parameter | From → target | Raised chiefly by | Gates |
| --- | --- | --- | --- |
| **Temperature** | −55 → 8 °C | mirrors, boreholes, GHG factories | liquid water, most life |
| **Air Pressure** | 1 → 60 kPa | GHG factories, nitrogen freight, comets | breathability, retaining heat |
| **Oxygen** | 0 → 19 % | cyanobacteria, forests | breathable air |
| **Hydrosphere** | 0 → 40 % | comet redirects, aquifer tapping | enables biosphere projects |
| **Biomass** | 0 → 50 idx | cyanobacteria, forests | food, oxygen, morale |

**Habitability** (0–100) is the mean progress of all five toward target. It's
the win metric *and* a survival input: farming output and population capacity
both scale with it, so terraforming literally makes the colony stronger.

There is a natural progression baked into project prerequisites: **warm the
world → thicken the air → import water → seed life.** You can't seed
cyanobacteria before there's water for it to bloom in.

---

## 3. Colony survival

Defined in `src/engine/survival.ts`. Each turn (`runSurvivalTick`):

1. **Produce** — base production × faction modifiers, with **food scaled by
   habitability** (a barren world farms at ~0.85×, a lush one at ~1.35×).
2. **Consume** — every colonist eats food and draws energy (life support).
3. **Deficits bite** — no food → **famine** (colonists die, morale drops);
   no energy → **blackout** (morale drops).
4. **Stability drifts** toward a habitability-linked equilibrium.
5. **Population** grows only when food *production* sustainably supports another
   colonist and morale is high — so population tracks how habitable the world
   is, instead of overshooting into a famine spiral.

Resources: **energy, materials, food, credits** (stored) and **research**
(flows straight into the current tech). Deliberately small; expand as needed.

### Balance notes (known, intentional, tunable)

- Constants live at the top of `survival.ts` (`BASE_FOOD_PER_POP`, etc.), in
  `events.ts` (`HAZARD_CHANCE_PER_TURN`), and in the data files.
- Current tuning target: a starting colony is roughly break-even while idle;
  pressure comes from hazards, growth, and project overreach.
- Factions are intentionally unequal in *survivability* (Verdant / Terran /
  Ouroboros are forgiving; Helion / Cognitum are glass cannons). The exact
  numbers still want a proper balance pass, and reaching 100% habitability is
  currently a very long game — see the roadmap.

---

## 4. Factions

Defined in `src/data/factions.ts`. Six, each a distinct opening and economy:

| Faction | Archetype | Strength | Weakness |
| --- | --- | --- | --- |
| **The Verdant Compact** | Gaian ecologists | Food + biosphere/hydrosphere terraforming | Weak industry |
| **Helion Consortium** | Corporate hegemony | Credits + energy, huge treasury | Fragile morale, thin food |
| **The Iron Vanguard** | Militarized industry | Materials, disaster-hardened | Poor science, burns biosphere |
| **Cognitum Ascendancy** | Research machine-cult | Research, cheap high-tech | Brittle when life support fails |
| **New Terran Union** | Humanist survivors | Balanced, fast growth, stable | No standout strength |
| **Cradle of Ouroboros** | Survivalist ascetics | Low consumption, hazard-proof | Slow science + economy |

Each faction exposes four design levers: production `modifiers`, opening
`startingStocks`/`startingProduction`, `terraformAffinity` (which planetary dial
they push fastest), and a `special` (currently flavor; several are partially
wired into the engine — e.g. Ouroboros rationing, Iron Vanguard hardening,
Terran solidarity, Cognitum fragility).

**Next step for factions:** finish wiring each `special` into the engine as a
first-class effect rather than an `id ===` check (see roadmap § "Faction
abilities").

---

## 5. Terraforming projects

Defined in `src/data/projects.ts`. A project spends stocks up front, counts down
over `duration` turns, then lands its effects. Two kinds:

- **Repeatable levers** (mirrors, GHG factories, nitrogen freight, comets,
  aquifers, cyanobacteria, forests) — the sustained terraforming engine. Run
  them again and again to keep pushing a parameter.
- **One-shot projects** (fusion grid, self-replicating fabricators, planetary
  magnetic shield) — permanent economy upgrades or capstone mega-projects.

Projects carry `requiresTech` and/or `requiresParams`, plus optional `risk`
(a completion failure chance — comets and nitrogen freight can go wrong).
`productionEffects` permanently change the colony economy; `colonyEffects`
grant one-time stock.

Adding a project is pure data — no engine changes needed.

---

## 6. Tech + hazards

- **Tech** (`src/data/technologies.ts`) — a small `requires` DAG whose only job
  right now is gating the stronger projects. Research points flow from
  production into the currently selected tech.
- **Hazards** (`src/data/hazards.ts`) — weighted random crises rolled each turn
  (`src/engine/events.ts`). Each `apply`s a mutation and returns a log line.
  Casualties are capped as a fraction of colony size and reduced by resilient
  factions, so a single event can't wipe a small colony outright.

---

## 7. Architecture

Three layers with one meeting point (`src/main.ts`):

```
  engine/  (rules)          data/  (content)
  ─ game.ts   turn loop      ─ factions.ts
  ─ terraforming.ts          ─ projects.ts
  ─ survival.ts              ─ technologies.ts
  ─ events.ts                ─ hazards.ts
        │                          │
        └───────────┬──────────────┘
                    ▼
             types.ts  (shared vocabulary)
                    ▲
        ┌───────────┴──────────────┐
   ui/  (DOM + canvas)        hex/  (your infra seam)
   ─ render.ts   HUD           ─ hex.ts   HexMapAdapter
   ─ hexRenderer.ts (stub)
```

Key property: **the engine is DOM-free and content-driven.** Rules are
functions over `GameState`; content is plain data. That's what makes it easy to
test headlessly, drive from your own map, or swap the UI.

---

## 8. Integrating your hex map

The engine deals in colonies, resources, and global parameters — never tiles.
The seam is `HexMapAdapter` in `src/hex/hex.ts`:

```ts
interface HexMapAdapter {
  getTiles(): Tile[];
  neighbors(coord: HexCoord): HexCoord[];
  render(state: GameState): void;
  onTileClick(handler: (coord: HexCoord) => void): void;
}
```

`CanvasHexRenderer` (`src/ui/hexRenderer.ts`) is a throwaway implementation so
the prototype shows *something*. To use your real infrastructure:

1. Implement `HexMapAdapter` backed by your library.
2. In `mountGameShell()` (`src/main.ts`), construct yours instead of
   `CanvasHexRenderer`.

Nothing else changes. One idea from the placeholder worth keeping: it tints
tiles by planetary progress, so terraforming is *visible* on the map (regolith
→ water → vegetation as hydrosphere and biomass rise).

---

## 9. Roadmap / what to build next

Rough order of value:

1. **Map ↔ state coupling.** Site colonies and projects on actual tiles;
   let terrain/adjacency gate or boost projects (build near ice for water,
   etc.). This is where your hex infra earns its keep.
2. **Faction abilities as first-class effects.** Replace the `id ===` special
   cases with a small effect/hook system so abilities are data, not conditionals.
3. **Rival AI.** `rivals` is currently a stub counter. Give rivals their own
   colonies + terraforming so the "race" is real, with a shared planet.
4. **Economy depth.** Buildings/districts on tiles, trade, tech-driven
   production upgrades.
5. **Balance pass.** Tune the survival/terraforming rates so a well-played game
   reaches full habitability in a satisfying arc, and so every faction is
   viable. Add difficulty settings.
6. **Persistence + tests.** Serialize `GameState` (it's plain data) for
   save/load; add unit tests around `endTurn` (the engine is already headless —
   see the smoke tests referenced in the commit history).
7. **Polish.** Project queue, tooltips, tutorial, sound, better art.
