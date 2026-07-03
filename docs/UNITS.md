# Aphelion — Unit & Combat Design

A working design for the unit layer, written to slot into the existing systems
(phases, ideology, diplomacy/Nemesis, interest groups, chronicle) and into the
hex-map seam (`HexMapAdapter`).

**Implementation status:** the decided *very small slice* (§8) is live in
`src/engine/units.ts` + `src/data/units.ts`: structures placed by completed
projects, slot-based garrisons, Warden/Ranger player forces, enemy raiders
spawned by the Stillness and Nemesis rivals, interception, assault, and razing
with parameter regression. The rest of this document (full roster, manual
orders, shared map) is the outline to build next.

---

## 1. Design pillars

1. **Units serve the terraforming fantasy.** Most units are workers, scouts,
   and haulers. Military units exist to protect and threaten *infrastructure*,
   not to win field battles for their own sake.
2. **Infrastructure is the battlefield.** Buildings are what you attack and
   what you defend. Unit-vs-unit combat exists mainly as *interception* — the
   fight that happens on the way to the real target.
3. **Few units, each meaningful.** SMAC-early-game scale: single-digit unit
   counts for most of the game. Units are expensive, have real upkeep, and
   losing one hurts. No carpets, no doom-stacks.
4. **Everything feeds the existing layers.** Building an army drifts your
   ideology. A raid writes a memory into a rival's head. A razed dome enters
   the Chronicle. The security apparatus loves garrisons; environmentalists
   hate razing.

---

## 2. Unit roster

Seven classes, phase-gated so the corporate era stays a business dispute and
militarization is a *choice the society makes* (and is seen making).

### Civilian (available from the corporate phase)

| Unit | Role | Key actions |
| --- | --- | --- |
| **Terraformer** ("Former") | The core unit. Executes terraforming projects *on-site* and builds hex improvements (extractors, condensers, sensor arrays). | `terraform`, `build`, `repair` |
| **Prospector** | Exploration and discovery. Surveys seeded sites — salvage caches, ice deposits, and native-life mysteries. Early warning on incoming raiders. | `survey`, `scout` |
| **Convoy** | Logistics. Moves stockpiles between settlements and maintains supply routes (production links). The thing raiders want to hit. | `haul`, `establish route` |
| **Settler pod** *(Settlement phase)* | Expansion. Converts population into a new settlement. | `found settlement` |

### Civilian roster — full spec

The detailed design for each civilian class: what it does turn-to-turn, what it
changes about systems already built, and the guardrails. Recommended build
order is Former → Prospector → Convoy → Settler (rationale at the end).

#### Terraformer ("Former") — the flagship

**The big idea: projects stop being abstract timers and become work happening
at a place, done by a crew you can lose.**

Today `startProject` deducts stocks and counts down invisibly, with the
finished works appearing when the timer ends. With Formers:

- Starting a project requires an **idle Former**. It travels to a site hex,
  enters status `working`, and the countdown runs only while it is alive
  on-site. The finished works rise on that hex.
- **Former count becomes the natural throttle on parallel terraforming**,
  replacing "start anything you can afford." Terraforming faster means
  building more Formers — which means more upkeep and more soft targets in
  the open.
- **Interruption, not loss:** if raiders kill or drive off the crew, the
  project *pauses* at its current progress until a Former resumes it. This is
  what makes escort gameplay a real ongoing decision — a Ranger standing on
  the work site (field slot + works slot sharing the hex, exactly what the
  slot system exists for) rather than a one-off.
- **The Stillness gets its best target.** In the current slice, raiders can
  only attack *finished* works. Formers let them strike the terraforming
  *before it lands* — thematically ideal for a movement whose purpose is
  stopping the project. Nemesis rivals hitting crews also makes the existing
  "their raiders struck our supply lines" memory flavor literal.
- **Site choice** is where real terrain earns its keep: aquifer taps sited
  near ice, boreholes on rock, cyanobacteria adjacent to water. On the
  placeholder disc, auto-siting with a stub biome bonus keeps friction low
  until the real hex map is wired in.
- Secondary kit: **repair** — Formers restore Integrity to damaged
  structures, giving the crews a wartime job.

**UX guardrail:** Formers must add *stakes, not chores*. Auto-siting and
auto-walking by default; manual placement optional. The player decision is
"how many crews, and do I guard them" — never babysitting pathing.

#### Prospector — discovery and the mystery hook

No fog of war (and none planned yet). Instead the map is seeded with **survey
sites** — salvage caches, ice deposits, geothermal vents, and ruins. A
Prospector travels to one, surveys for a turn or two, and yields one of:

- a **one-time windfall** (the Derelict Salvage hazard becomes something you
  *earn*),
- a permanent **site modifier** — a hex where future projects are cheaper or
  works produce more, feeding directly into Former site choice, or
- a **mystery** — the doorway to the native-life roadmap item: subsurface
  microbial networks, dormant probes, bioluminescent caverns. Each discovery
  is a Chronicle entry plus a three-way choice that feeds existing systems:
  *study* (research; the Stillness calms — you are finally listening),
  *exploit* (production; environmentalists sour), or *protect* (ecological
  ideology nudge; possibly a permanent preserve tile).

Cheap, fragile, unarmed — the second reason escorts matter. Secondary role:
a Prospector working the rim provides **early warning**, revealing incoming
raiders' targets a turn before they would otherwise be seen.

#### Convoy — logistics that works with one settlement

"Moves stockpiles between settlements" needs multiple settlements to mean
anything, so the Convoy's first role is slice-sized: **supply lines to remote
works**. Assign a Convoy to a structure and it runs a route from the
settlement; the works produce a bonus (~+50% of their production effects), or
a project on that hex works faster. The catch: the route is a moving target
on the map — raiders that intercept the Convoy steal cargo and cut the line.

This creates the classic logistics decision: the best sites are far from
home, and distance is risk. It is also the smallest unit to build (mostly a
modifier plus an interceptable dot).

#### Settler pod — expansion without a rewrite

The engine has a singular `state.colony`; keep it. A new settlement is a
**special structure, not a second colony**. Founding costs heavy stocks
*plus population* (colonists leave the domes), and the settlement structure
grants:

- +max population,
- a production aura for nearby works,
- a second staging/heal hex,
- a wider ring where structures can be placed.

Stocks and population stay unified colony-wide, so the survival engine is
untouched. Strategically it buys risk-spreading (works are no longer one
raidable cluster), a faster route to the Ideological phase's population gate,
and — most important to the vision — every founding is a **named Chronicle
event**: the seed of "a mining outpost founded in one era grows into a
capital" for persistent-history campaigns.

#### Cost profiles and the decisions they create

| Unit | Cost profile | Creates the decision… | Build size |
| --- | --- | --- | --- |
| **Former** | expensive, energy upkeep | how many crews vs. how guarded | medium — touches the project loop |
| **Prospector** | cheap, fragile | explore now vs. safe later | small-medium — needs a sites system |
| **Convoy** | mid | rich remote sites vs. exposed routes | small |
| **Settler** | very expensive + population | concentrate vs. spread | medium — settlement-as-structure |

Cross-cutting: civilians occupy the **works slot**; civilian-heavy economies
nudge **ecological/technocratic** while armies nudge militarist — the
workers-vs-warriors budget literally becomes the society's identity. Interest
groups align the same way: workers like Convoys, scientists like Prospectors,
environmentalists like biosphere Formers.

**Build order: Former first.** It transforms the core loop rather than adding
to it, and it retroactively improves everything already built — escorts
matter more, the Stillness gets smarter targets, structures get repairers.
Then Prospector (discovery + mysteries), Convoy, Settler.

### Security / military (unlock at Settlement phase; cheaper under militarist ideology / martial policies)

| Unit | Role | Key actions |
| --- | --- | --- |
| **Warden** | Defensive specialist. Occupies a building's garrison slot; intercepts hostiles within radius 1. Cheap upkeep while garrisoned. | `garrison`, `intercept` |
| **Ranger** | Mobile field unit. Escorts civilians, raids enemy improvements, screens territory. | `escort`, `raid`, `assault` |
| **Saboteur** | Covert ops. Strikes buildings *without* open war — the map-level expression of the diplomacy `sabotage` action. Deniable until caught. | `infiltrate`, `sabotage` |

Late-game orbital assets (dropships, orbital strike) are deliberately left to
the independence-era roadmap.

### Stats — kept deliberately flat

One **Strength** number per unit plus situational modifiers, not separate
attack/defense stats. Each unit has:

- **HP** (integrity), **Strength**, **Moves**
- **Upkeep** (credits and/or energy per turn — drains the same stocks
  projects want, which is the point)
- **Kit** (the special actions above)
- Optional gates: `requiresPhase`, `requiresTech`
- **ideologyLean** — producing the unit nudges emergent ideology (military
  units push militarist; Formers push ecological/technocratic)

Sketch types (for when we build it):

```ts
type UnitClass =
  | "terraformer" | "prospector" | "convoy" | "settler"
  | "warden" | "ranger" | "saboteur";

type SlotKind = "works" | "field" | "garrison";

interface UnitDef {
  id: UnitClass;
  name: string;
  slot: SlotKind;                 // which hex slot it occupies
  strength: number;
  hp: number;
  moves: number;
  upkeep: Partial<ColonyStocks>;
  kit: string[];                  // action ids
  requiresPhase?: GamePhase;
  requiresTech?: string;
  ideologyLean?: IdeologyAxis;
}

interface Unit {
  id: string;
  defId: UnitClass;
  ownerId: string;                // "player" or a rival id
  coord: HexCoord;
  hp: number;
  status: "ready" | "working" | "garrisoned" | "retreating";
  taskTurnsLeft?: number;         // for terraform/build/sabotage tasks
}
```

Units are produced at settlements using the same stocks projects use, via a
build queue that mirrors the `ActiveProject` pattern — army vs. terraforming is
a genuine budget tension, not two separate economies.

---

## 3. Stacking: slot-based (recommended)

Neither free stacking (doom-stacks, unreadable fights) nor strict one-unit-per-
tile (painful on a small map, punishes escorts). Instead, **each hex has typed
slots**:

- **1 works slot** — one civilian unit
- **1 field slot** — one military unit
- **+1 garrison slot** on hexes with a settlement or defensible building

So an ordinary hex holds at most a Ranger escorting a Former; a settlement hex
holds garrison + field + civilian (3 max). Friendly units may pass through
freely; the limit applies at end of turn.

Why this rule:

- **Escorts emerge naturally.** Guarding a Former means *standing on its hex*,
  which reads instantly on the map.
- **Defense is about the garrison,** not a tower of units — which keeps the
  focus on buildings, per pillar 2.
- **AI and UX stay simple.** One fight per hex, one defender to resolve.

No zone-of-control in the prototype. Garrisons instead have an **interception
radius of 1**: enter it with hostile intent and the garrison gets a free
engagement before you reach the building.

---

## 4. Attacking buildings — the primary focus

Buildings get two defensive stats:

- **Integrity** — hit points. At 0 the building is **Disabled**.
- **Hardness** — flat damage reduction (walls, bunkering, burrowed
  construction). Also shields the garrison.

And there are exactly **three attack verbs**, escalating in commitment:

### Raid — hit-and-run (cheap, fast, deniable-ish)

Steal a chunk of stored resources and suppress the building's output for a few
turns. Minimal integrity damage. The raider is exposed to interception on the
way in and out. This is the bread-and-butter harassment verb — and every raid
writes a `slight`/`clash` memory into the victim's head (Nemesis fuel).

### Assault — sustained siege (open war)

Grind Integrity down over turns: `damage = max(1, strength − hardness)`,
mutual damage with the garrison first (garrison fights with the Hardness
bonus). At Integrity 0 the building is Disabled — production stops, any hosted
terraforming project halts. The attacker then chooses:

- **Capture** — take the building intact (requires holding the hex; only
  possible for things that make sense to own), or
- **Raze** — destroy it permanently. Chronicle entry, massive grudge, and —
  the spicy part — **razing terraforming infrastructure regresses the global
  parameter it served** (a small amount). Burn a GHG factory chain and the sky
  literally thins. Infrastructure warfare matters to the *planet*, not just
  the owner.

### Sabotage — covert strike (no declaration of war)

A Saboteur mission, resolved as a skill check rather than combat: success odds
vs. the target's **security level** (garrison present? surveillance policy?
paranoid owner?). Success: building Disabled for N turns, saboteur exfiltrates,
victim gets a memory but no proof. Failure: the agent is captured —
diplomatic incident, big grudge, public shame ("we caught your saboteur"
becomes an overture that quotes the event). This makes the existing diplomacy
`sabotage` action a physical act with a unit, a route, and a risk.

**Resolution order when a building is defended:** attacker → garrison duel
first; only after the garrison routs or falls does damage reach Integrity.
Defense of a building is therefore always a *unit* question first, which keeps
Wardens employed.

Sketch structure type:

```ts
interface Structure {
  id: string;
  kind: string;                   // extractor, dome, ghg-factory, ...
  coord: HexCoord;
  ownerId: string;
  integrity: number;
  hardness: number;
  disabledTurns?: number;
  garrisonUnitId?: string;
  /** Which global param this serves; razing regresses it slightly. */
  servesParam?: GlobalParamKey;
}
```

---

## 5. Unit-vs-unit combat — deliberately shallow

Field combat exists as the *gatekeeper* to buildings (interception, escort
duels, contesting a hex), and it's kept simple:

- **Mutual-damage exchange**, deterministic with small variance (±15%), so
  plans are legible and a fight's outcome is roughly predictable before you
  commit.
- **Modifiers, not stats**: terrain (from the hex map), garrison Hardness,
  faction traits (Iron Vanguard hits harder), ideology (militarist societies
  +strength), rival personality (ruthless rivals press wounded units).
- **Retreat over death**: a unit that drops below ~30% HP disengages to an
  adjacent friendly hex instead of dying, unless cornered (no valid hex) or
  the attacker is `ruthless`. With single-digit unit counts, permadeath on
  every skirmish would be swingy and feel-bad; losing units should be the
  result of overreach, not a coin flip.

---

## 6. Integration with existing systems

| System | Interaction |
| --- | --- |
| **Phases** | Corporate: civilians + Wardens only — no open assault (matches the diplomacy stance cap; corporate disputes are raids-at-most and lawsuits). Settlement+: full military. Independence: Earth can embargo unit production or land loyalist forces (roadmap). |
| **Ideology** | Producing military units and razing nudge `militarist`; heavy Former economies nudge `ecological`/`technocratic`. Dominant militarist ideology discounts unit costs; humanist raises unit upkeep tolerance for defenders but hates offensive war. |
| **Policies** | Security axis: Martial Administration cheapens units and boosts sabotage defense; Civil Liberties raises the stability cost of long wars. Surveillance directly counters Saboteurs. |
| **Diplomacy / Nemesis** | Every raid/assault/raze/sabotage writes a memory with weight — this becomes the main *source* of grudges. A Nemesis stops rolling abstract sabotage events and instead **spawns raider units** targeting your highest-value infrastructure. Allies may send a Warden to garrison your settlement (a gift with teeth). |
| **Interest groups** | Security apparatus satisfaction tracks garrison coverage. Environmentalists sour on razing. Workers sour on extended wars (war weariness → stability drain). |
| **Survival economy** | Upkeep drains the same stocks as projects. A big army is turns of terraforming you didn't do. |
| **Chronicle** | First blood, first raze, a heroic garrison stand, a captured saboteur — all landmark entries. |
| **Hazards** | Units caught in the open during a dust storm / flare take damage; garrisoned and settled units are safe. Another reason bases matter. |

---

## 7. Hex-map seam implications

Units finally give the map real work to do. The `HexMapAdapter` contract grows
by a few read/render hooks — no engine logic moves into the map:

```ts
interface HexMapAdapter {
  // existing…
  getTiles(): Tile[];
  neighbors(coord: HexCoord): HexCoord[];
  render(state: GameState): void;
  onTileClick(handler: (coord: HexCoord) => void): void;

  // unit-era additions
  moveCost(from: HexCoord, to: HexCoord): number;  // terrain-aware pathing input
  onUnitSelect?(handler: (unitId: string) => void): void;
}
```

The engine owns units, structures, and combat; the map owns terrain, adjacency,
movement cost, and presentation. Rival structures on the *shared* map is the
follow-on step that makes the diplomacy power struggle territorial.

---

## 8. Open decision points

Recommendations marked; decisions recorded as they're made:

1. **Stacking** — ✅ **decided: slot-based.** Implemented in slice form: one
   field unit per hex (except the settlement staging hex), one garrison per
   structure.
2. **Combat determinism** — deterministic ± small variance *(recommended;
   implemented as ±15%)*.
3. **Unit death** — retreat-at-threshold *(recommended; implemented: Rangers
   fall back to the settlement below 30% HP)*.
4. **Razing regresses global params** — ✅ **decided: yes.** Infrastructure
   warfare is planetary. The rule already has its first consumer: the
   Stillness antagonist's "quietings" (`engine/antagonist.ts`) are the
   event-level form of razing, regressing the parameter the destroyed works
   served. When units land, razing (by anyone, including Stillness raider
   units) uses the same rule.
5. **Scope of the first implementation** — ✅ **decided: the very small
   slice.** Only your territory is real; Stillness cells and Nemesis strike
   parties spawn at the map rim and path toward your works. Implemented in
   `engine/units.ts`. The full shared map with rival structures is the
   follow-on step.
