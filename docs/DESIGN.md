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

## 9. The civilization layer (corporate → sovereignty)

The defining idea: the game *begins* like Terraforming Mars — a corporation
making a dead world profitable — and *evolves* into Alpha Centauri — a
civilization with its own philosophy and, eventually, its own sovereignty. That
evolution is modeled as a one-way **phase arc** that progressively unlocks
Alpha-Centauri-style systems.

### Phases (`data/phases.ts`, `engine/phases.ts`)

| Phase | Feels like | Unlocks | Reached when |
| --- | --- | --- | --- |
| **Corporate Terraforming** | Terraforming Mars | Projects, research, economy | (start) |
| **The First Settlers** | colony sim | Social engineering, notable colonists, internal politics | habitability ≥ 12% |
| **Ideology Emerges** | Alpha Centauri | Dominant-ideology effects | habitability ≥ 28%, pop ≥ 25 |
| **The Question of Independence** | endgame | Independence decision, Earth as a faction | habitability ≥ 50%, pop ≥ 40 |

Gates use habitability (a broad measure across all five planetary dials) plus
population, so no single terraforming strategy is required to advance.

### Emergent ideology (`data/ideologies.ts`, `engine/ideology.ts`)

Ideology is **not chosen up front** — it accretes. Five leanings
(Technocratic, Ecological, Industrialist, Militarist, Humanist) accumulate
pressure from three sources: the **projects** you complete (each embodies a
leaning), the **policies** you run, and the **people** who rise. The dominant
leaning, *once the Ideology phase begins*, applies real production and stability
effects — the personality of your civilization made mechanical. The founding
faction only supplies a small initial lean.

### Dynamic social engineering (`data/policies.ts`, `engine/policies.ts`)

Five independent policy axes — Economy, Society, Science, Environment, Security —
each with 3–4 options. Every option is a trade-off touching production, morale,
ideological drift, and interest-group satisfaction. There is no strictly-best
row. Policies unlock in the Settlement phase (before there's a society, there's
nothing to engineer) and feed directly into the economy tick via
`combineModifiers`.

### Internal politics (`data/politics.ts`, `engine/politics.ts`)

Five interest groups (Scientists, Workers, Environmentalists, Security,
Shareholders) react to your policies each turn. Govern against your base and
discontent bleeds colony stability — the internal cost of external ambition.

### Notable colonists (`data/characters.ts`, `engine/characters.ts`)

From the Settlement phase on, the society occasionally produces a *named*
individual with traits — a Visionary who boosts research, an Agitator who
speaks for the unheard. Some carry a permanent effect and an ideological
leaning, so the people who rise gradually shape the civilization's identity.
Politics become personal.

### Breakthroughs as world events (`data/breakthroughs.ts`, `engine/breakthroughs.ts`)

Discoveries like Fusion Ignition and Practical AI Governance fire once their
conditions are met, apply a permanent effect, and enter the historical record —
reshaping strategy rather than sitting quietly in a tech list.

### History as the central mechanic (`engine/chronicle.ts`)

The rolling event log is ephemeral chatter; the **Chronicle** is the planet's
permanent record — Landfall, the first ocean, the first forest, each notable
figure, every breakthrough, each phase transition, and the final resolution of
independence. It's surfaced in the History tab and is the connective tissue of
the whole vision. In the full game it would *persist across campaigns* on the
same Mars (see roadmap).

### The independence endgame (`resolveIndependence` in `engine/game.ts`)

In the final phase the world confronts Earth: remain governed, negotiate
autonomy, or declare independence. Each writes a different closing entry to the
history and ends the game as a distinct victory.

### Rival AI & evolving diplomacy — Nemesis-inspired (`data/rivals.ts`, `engine/diplomacy.ts`)

Rivals are the clearest place the two source games disagree: Terraforming Mars
players only compete externally, while Alpha Centauri's diplomacy grows more
personal as the world changes. To make that *personal*, the rival system borrows
the pillars of the Nemesis system:

- **Procedural leaders with personality.** Every non-player faction is a rival
  *leader* with two traits (Vengeful, Honorable, Opportunist, Paranoid,
  Expansionist, Cunning, Ruthless, Stoic, Zealous, Pragmatic) that actually
  drive behavior — how fast grudges form, whether debts are repaid, when they
  turn on you, how fast they grow.
- **Memory.** Each rival keeps a memory of what you've done — sabotage, aid, a
  signed pact, a refused tribute. Memories set disposition, and their overtures
  *quote them back at you* ("They have not forgotten that you sabotaged us…").
- **Grudges & debts, and the Nemesis turn.** Wrong a rival and grudge builds;
  past a threshold they become your **Nemesis** with a vendetta, actively
  raiding and sabotaging your colony. Honorable rivals forgive over time and
  repay favors; vengeful ones never let go.
- **A shifting power hierarchy.** Rivals have `power` and a live `rank`; the
  hegemon preys on the weakest and open wars bleed both sides, so the pecking
  order genuinely churns. A rival driven to collapse is **eliminated** — and a
  fallen faction with a grudge can **resurface** through a procedurally-named
  successor who *inherits the bitterness* (the "they come back" beat).
- **Relationships among the rivals.** Rivals hold opinions of *each other*
  (shared/opposed ideology, resentment of the hegemon), forming alliances and
  rivalries independent of you — surfaced as "allied with… / at odds with…".
- **Evolving with the phases.** In the corporate phase relations are purely
  commercial (capped at competition). From Settlement on, alliances and
  vendettas become possible; in the Ideological phase, alignment with the
  direction *your* society is heading strongly drives whether a rival warms or
  sours; at Independence, **Earth** itself becomes a diplomatic actor reacting
  to your choice.

Player levers (Diplomacy tab): **Pact**, **Aid**, **Denounce**, **Sabotage** —
plus responding to rivals' **overtures** (taunts, pact/aid offers, tribute
demands, threats, and cunning "betrayal" traps). Hostility has teeth: Nemeses
raid resources and foment unrest, while allies send gifts and partners share
surplus — so where you sit with each rival matters mechanically, not just
narratively. Everything landmark (a new hegemon, a nemesis sworn, a pact signed,
a successor rising) is written into the Chronicle.

### The Stillness — the counter-terraforming antagonist (`data/antagonist.ts`, `engine/antagonist.ts`)

Hazards are random pressure and rivals are social pressure; the Stillness is
**directional** pressure, aimed at the win condition itself. It is not a rival
corporation — it cannot be out-bid or allied with, only fought, appeased, or
outrun.

- **Identity:** zealot-preservationists born of the first failed landings who
  came to worship the dead world's silence. *"The world was perfect before you
  woke it."*
- **Awakening:** hidden until habitability reaches ~15% — success breeds
  opposition. Awakening is a Chronicle event.
- **Threat:** grows each turn with your habitability (the better you do, the
  harder they push), damped by appeasement, the Preservation policy, and an
  ecological dominant ideology; amplified by Industrial Expansion.
- **Actions:** with threat comes action — **quietings** (regress your
  most-advanced global parameter; the event-level form of the razing rule from
  docs/UNITS.md), depot raids, unrest preaching, and project sabotage.
- **Their win condition:** if the planet, having reached real habitability
  (peak ≥ 30%), is dragged back down to near-silence (≤ 12%), the Stillness
  wins — a distinct loss with its own Chronicle ending ("The World Falls
  Silent").
- **Counterplay is ideological:** *Strike cells* (energy + materials; stronger
  under martial policy or militarist ideology; nudges militarist) or *Fund
  preservation enclaves* (credits; buys turns of reduced aggression; nudges
  ecological). How you answer the Stillness shapes who your society becomes.
- **Unit-layer future:** when units land (docs/UNITS.md), the Stillness stops
  acting through abstract events and spawns physical raider parties whose
  razing uses the same parameter-regression rule.

### What's scaffolded vs. deep (honest status)

- **Working & verified:** the full phase arc, emergent ideology with effects,
  all five policy axes feeding the economy, interest-group reactions, character
  emergence with effects, breakthroughs, the chronicle, independence, and the
  full Nemesis-inspired rival/diplomacy system (memory, grudges, the nemesis
  turn, the power hierarchy, eliminations & resurfacing, inter-rival relations,
  overtures, and player actions), the Stillness antagonist (awakening,
  threat, quietings, counteractions, and its silence-victory loss condition),
  and the unit layer's small slice (structures from projects, Warden/Ranger
  forces, raider spawns, interception, assault, and razing-with-regression).
  Deterministic engine tests drive a colony
  through every phase transition and exercise the diplomacy machinery
  (sabotage→nemesis, elimination→successor, hierarchy churn, overtures); browser
  tests confirm the UI reaches Settlement and surfaces every panel including the
  Diplomacy tab.
- **Lighter / hooks:** several faction `special`s remain flavor; Earth's role in
  the endgame is light; "living planet" passive ecosystem spread and
  cross-campaign persistence are described but not implemented.
- **Balance:** first-pass. Crude AI bots reach Settlement in ~60% of games and
  the later phases occasionally; a human plays far better. The later gates are
  reachable but demand sustained, well-managed play. All tuning constants are
  centralized (see § 3) and meant to be iterated.

## 10. Roadmap / what to build next

Rough order of value:

1. **Map ↔ state coupling.** Site colonies, cities, and projects on actual
   tiles; let terrain/adjacency gate or boost projects (build near ice for
   water, etc.). This is where your hex infra earns its keep — and where the
   **living planet** idea lives: warm valleys sprouting forests on their own,
   new rivers, dust storms diminishing, vegetation spreading tile-by-tile as
   biomass rises (the placeholder renderer already hints at this).
2. **Effect/hook system.** Replace the remaining `id ===` special cases (faction
   specials, faction resilience, Cognitum fragility) with a small data-driven
   effect system, so abilities and ideology/policy effects compose uniformly.
3. **Grow the unit layer.** The small slice is live (`engine/units.ts`, see
   **[UNITS.md](UNITS.md)**): structures from projects, Warden/Ranger defense,
   raiders from the Stillness and Nemesis rivals, and razing that regresses
   global parameters. Next: the civilian roster (Terraformers executing
   projects on-site, Prospectors, Convoys), manual movement orders, the raid
   and sabotage verbs for the *player*, rival structures on a shared map, and
   Earth's endgame forces (loyalist landings, blockades, a war of
   independence).
4. **Native life & mysteries.** Subsurface microbial networks, dormant probes,
   ice caverns — terraforming as scientific exploration, surfaced through
   the chronicle and map.
5. **Deeper internal politics.** Characters who become governors/activists and
   can challenge your leadership; group demands that trigger events, not just
   satisfaction drift.
6. **Persistent history.** Serialize `GameState` (it's plain data) for save/load,
   then the headline feature: **campaigns that start centuries later on the same
   Mars**, where an earlier mining outpost is now a capital and a preserve is now
   sacred ground. The Chronicle is already the substrate for this.
7. **Balance pass + difficulty settings.** Tune survival/terraforming/phase rates
   so a well-played game reaches independence in a satisfying arc and every
   faction and ideology is viable.
8. **Tests + polish.** Promote the headless smoke tests into a real suite around
   `endTurn` and the phase arc; add a project queue, tooltips, tutorial, sound,
   and real art.
