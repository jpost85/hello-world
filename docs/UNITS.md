# Aphelion — Unit & Combat Design

A working design for the unit layer. Nothing here is implemented yet; this is
the outline to build against. It is written to slot into the existing systems
(phases, ideology, diplomacy/Nemesis, interest groups, chronicle) and into the
hex-map seam (`HexMapAdapter`), which is where units will actually live.

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
| **Prospector** | Exploration and discovery. Reveals map, finds salvage caches, ice deposits, and — later — native-life mysteries. Spots rival activity. | `survey`, `scout` |
| **Convoy** | Logistics. Moves stockpiles between settlements and maintains supply routes (production links). The thing raiders want to hit. | `haul`, `establish route` |
| **Settler pod** *(Settlement phase)* | Expansion. Converts population into a new settlement. | `found settlement` |

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

Recommendations marked; all are cheap to change before implementation:

1. **Stacking** — slot-based *(recommended)* vs. strict 1UPT vs. capped stacks.
2. **Combat determinism** — deterministic ± small variance *(recommended)* vs.
   dice-heavy. Small unit counts argue for legibility.
3. **Unit death** — retreat-at-threshold *(recommended)* vs. fight-to-death.
4. **Razing regresses global params** — ✅ **decided: yes.** Infrastructure
   warfare is planetary. The rule already has its first consumer: the
   Stillness antagonist's "quietings" (`engine/antagonist.ts`) are the
   event-level form of razing, regressing the parameter the destroyed works
   served. When units land, razing (by anyone, including Stillness raider
   units) uses the same rule.
5. **Scope of the first implementation** — full shared-map with rival
   structures, or a smaller first step where only *your* territory is real and
   Nemesis raids arrive as spawned raider units at your border. The smaller
   step ships sooner and still proves the combat loop.
