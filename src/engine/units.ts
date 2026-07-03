import type {
  GameState,
  GlobalParamKey,
  HexCoord,
  MapUnit,
  Structure,
  TerraformProject,
  UnitClass,
} from "../types";
import { UNIT_DEFS, MILITARY_TUNING as T } from "../data/units";
import { MAP_RADIUS, axialNeighbors, hexDistance, ringCoords } from "../hex/hex";
import { computeHabitability } from "./terraforming";
import { recordChronicle } from "./chronicle";
import { rivalName } from "./diplomacy";
import { getFaction } from "../data/factions";

/**
 * The unit layer, very-small-slice edition (docs/UNITS.md §8, decided):
 *
 * - Only the player's territory is real. Completed projects place physical
 *   STRUCTURES on hexes near the settlement.
 * - Enemy RAIDERS (Stillness cells, Nemesis strike parties) spawn on the map
 *   rim and path toward your structures. Reaching one, they assault its
 *   Integrity; at zero they RAZE it — removing its production and regressing
 *   the global parameter it served (the decided razing rule).
 * - Player forces: WARDENS garrison structures (defend with a hardness
 *   bonus); RANGERS auto-patrol, hunting the nearest raider. Manual orders,
 *   civilian units, and rival territory come later (docs/UNITS.md).
 * - Slot rule (slice form): one field unit per hex, except the settlement
 *   staging hex; one garrison per structure.
 *
 * Combat is mutual-damage with small variance; Rangers retreat to the
 * settlement below 30% HP rather than dying (retreat-over-death rule).
 */

const CENTER: HexCoord = { q: 0, r: 0 };

function same(a: HexCoord, b: HexCoord): boolean {
  return a.q === b.q && a.r === b.r;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

let unitSeq = 0;
function newId(prefix: string): string {
  unitSeq += 1;
  return `${prefix}-${unitSeq}-${Math.floor(Math.random() * 1e6)}`;
}

// ---------------------------------------------------------------------------
// Structures — projects made physical
// ---------------------------------------------------------------------------

/** First free hex closest to the settlement (never the settlement itself). */
function freeHexNear(state: GameState): HexCoord | null {
  for (let radius = 1; radius <= MAP_RADIUS; radius++) {
    const ring = ringCoords(radius).filter(
      (c) => !state.structures.some((s) => same(s.coord, c)),
    );
    if (ring.length) return pick(ring);
  }
  return null;
}

/**
 * Called when a project completes: place its works on the map (or harden the
 * existing works for repeatable projects). Returns a log line or null.
 */
export function placeStructureForProject(
  state: GameState,
  project: TerraformProject,
): string | null {
  const existing = state.structures.find((s) => s.projectId === project.id);
  if (existing) {
    existing.integrity = Math.min(existing.maxIntegrity * 2, existing.integrity + T.reinforceIntegrity);
    existing.maxIntegrity = Math.max(existing.maxIntegrity, existing.integrity);
    return null; // hardening is quiet; the project completion already logged
  }
  const coord = freeHexNear(state);
  if (!coord) return null; // map is full; the works exist "off-map"

  // The parameter this structure serves = the project's largest positive effect.
  let servesParam: GlobalParamKey | undefined;
  let servesAmount = 0;
  for (const [k, v] of Object.entries(project.effects)) {
    if ((v as number) > servesAmount) {
      servesAmount = v as number;
      servesParam = k as GlobalParamKey;
    }
  }

  const structure: Structure = {
    id: newId("st"),
    projectId: project.id,
    name: project.name,
    coord,
    integrity: T.structureIntegrity,
    maxIntegrity: T.structureIntegrity,
    hardness: T.structureHardness,
    servesParam,
    servesAmount: servesAmount || undefined,
    productionEffects: project.productionEffects,
  };
  state.structures.push(structure);
  return `The ${project.name} works rise on the map — defend them.`;
}

/** Raze a structure: remove it, strip its production, regress its parameter. */
function raze(state: GameState, structure: Structure, byOwner: string): string {
  state.structures = state.structures.filter((s) => s.id !== structure.id);
  // Evict any garrison assignment pointing at it.
  for (const u of state.units) if (u.garrisonOf === structure.id) u.garrisonOf = undefined;

  if (structure.productionEffects) {
    for (const [k, v] of Object.entries(structure.productionEffects)) {
      const key = k as keyof typeof state.colony.production;
      state.colony.production[key] = Math.max(0, state.colony.production[key] - (v as number));
    }
  }

  let regressNote = "";
  if (structure.servesParam && structure.servesAmount) {
    const p = state.globalParams[structure.servesParam];
    const amount = Math.max(2, structure.servesAmount * T.razeParamFraction);
    const before = p.value;
    p.value = Math.max(p.min, p.value - amount);
    const applied = Math.round((before - p.value) * 10) / 10;
    state.habitability = computeHabitability(state);
    if (applied > 0) regressNote = ` ${p.label} slips back -${applied}${p.unit}.`;
    if (byOwner === "stillness") state.antagonist.quietings += 1;
  }

  const who = ownerLabel(state, byOwner);
  recordChronicle(state, "crisis", `${structure.name} Razed`,
    `${who} burned the ${structure.name} works to the ground.${regressNote}`);
  return `${who} raze the ${structure.name}!${regressNote}`;
}

function ownerLabel(state: GameState, ownerId: string): string {
  if (ownerId === "stillness") return "Stillness raiders";
  const rival = state.rivals.find((r) => r.id === ownerId);
  if (rival) return `${getFaction(rival.factionId).name} raiders`;
  return "Raiders";
}

// ---------------------------------------------------------------------------
// Player forces
// ---------------------------------------------------------------------------

export function playerUnits(state: GameState): MapUnit[] {
  return state.units.filter((u) => u.ownerId === "player");
}

export function enemyUnits(state: GameState): MapUnit[] {
  return state.units.filter((u) => u.ownerId !== "player");
}

/** Why recruitment is blocked right now, or null if it can proceed. */
export function recruitBlockedReason(state: GameState, cls: UnitClass): string | null {
  if (cls === "raider") return "Not recruitable";
  if (state.phase === "corporate") return "Requires the Settlement era";
  if (playerUnits(state).length >= T.forceCap) return `Force cap reached (${T.forceCap})`;
  const def = UNIT_DEFS[cls];
  const s = state.colony.stocks;
  for (const [k, v] of Object.entries(def.cost)) {
    if (s[k as keyof typeof s] < (v as number)) return "Insufficient resources";
  }
  return null;
}

export function recruitUnit(state: GameState, cls: UnitClass): string | null {
  if (recruitBlockedReason(state, cls)) return null;
  const def = UNIT_DEFS[cls];
  for (const [k, v] of Object.entries(def.cost)) {
    state.colony.stocks[k as keyof typeof state.colony.stocks] -= v as number;
  }
  state.units.push({
    id: newId(cls),
    defId: cls,
    ownerId: "player",
    coord: { ...CENTER },
    hp: def.hp,
  });
  return `A ${def.name} musters at the settlement.`;
}

/** Assign (or clear) a Warden's garrison post. */
export function assignGarrison(state: GameState, unitId: string, structureId: string | null): boolean {
  const unit = state.units.find((u) => u.id === unitId && u.ownerId === "player" && u.defId === "warden");
  if (!unit) return false;
  if (!structureId) {
    unit.garrisonOf = undefined;
    unit.coord = { ...CENTER };
    return true;
  }
  const structure = state.structures.find((s) => s.id === structureId);
  if (!structure) return false;
  // One garrison per structure (the garrison slot).
  if (state.units.some((u) => u.id !== unitId && u.garrisonOf === structureId)) return false;
  unit.garrisonOf = structureId;
  unit.coord = { ...structure.coord };
  return true;
}

// ---------------------------------------------------------------------------
// Raider spawning — the Stillness and Nemesis rivals field strike parties
// ---------------------------------------------------------------------------

export function spawnRaider(state: GameState, ownerId: string, targetId?: string): MapUnit | null {
  if (!state.structures.length) return null;
  if (enemyUnits(state).length >= T.enemyCap) return null;
  const target =
    (targetId && state.structures.find((s) => s.id === targetId)) ||
    mostAdvancedStructure(state) ||
    pick(state.structures);
  const rim = ringCoords(MAP_RADIUS);
  const unit: MapUnit = {
    id: newId("raider"),
    defId: "raider",
    ownerId,
    coord: { ...pick(rim) },
    hp: UNIT_DEFS.raider.hp,
    targetId: target.id,
  };
  state.units.push(unit);
  return unit;
}

/** Raiders prefer the structure serving the most-advanced parameter. */
function mostAdvancedStructure(state: GameState): Structure | undefined {
  const serving = state.structures.filter((s) => s.servesParam);
  if (!serving.length) return undefined;
  return serving.reduce((best, s) => {
    const prog = (k: GlobalParamKey) => state.globalParams[k].value - state.globalParams[k].min;
    return prog(s.servesParam!) > prog(best.servesParam!) ? s : best;
  });
}

// ---------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------

/** Mutual-damage exchange. Returns log fragments; removes the dead. */
function fight(state: GameState, a: MapUnit, b: MapUnit): string {
  const defBonus = (u: MapUnit) => (u.garrisonOf ? T.garrisonHardnessBonus : 0);
  const swing = () => 0.85 + Math.random() * 0.3;
  const dmgTo = (from: MapUnit, to: MapUnit) =>
    Math.max(1, Math.round(UNIT_DEFS[from.defId].strength * swing()) - defBonus(to));
  a.hp -= dmgTo(b, a);
  b.hp -= dmgTo(a, b);

  const notes: string[] = [];
  for (const u of [a, b]) {
    if (u.hp <= 0) {
      state.units = state.units.filter((x) => x.id !== u.id);
      notes.push(`${sideLabel(state, u)} is destroyed`);
    } else if (
      u.ownerId === "player" &&
      u.defId === "ranger" &&
      u.hp < UNIT_DEFS.ranger.hp * T.retreatAt
    ) {
      // Retreat over death: the wounded Ranger falls back to the settlement.
      u.coord = { ...CENTER };
      notes.push(`your wounded Ranger falls back to the settlement`);
    }
  }
  return notes.length ? ` — ${notes.join("; ")}` : "";
}

function sideLabel(state: GameState, u: MapUnit): string {
  return u.ownerId === "player" ? `your ${UNIT_DEFS[u.defId].name}` : ownerLabel(state, u.ownerId);
}

/** One greedy step toward a goal, honoring the one-field-unit-per-hex rule. */
function stepToward(state: GameState, unit: MapUnit, goal: HexCoord): void {
  const options = axialNeighbors(unit.coord)
    .filter((c) => hexDistance(c, CENTER) <= MAP_RADIUS)
    .sort((x, y) => hexDistance(x, goal) - hexDistance(y, goal));
  for (const c of options) {
    if (hexDistance(c, goal) >= hexDistance(unit.coord, goal)) break;
    const blockedByFriend = state.units.some(
      (u) =>
        u.id !== unit.id &&
        u.ownerId === unit.ownerId &&
        !u.garrisonOf &&
        same(u.coord, c) &&
        !same(c, CENTER),
    );
    if (!blockedByFriend) {
      unit.coord = { ...c };
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// The per-turn military tick
// ---------------------------------------------------------------------------

export function unitTick(state: GameState): string[] {
  const logs: string[] = [];

  // 1. Upkeep — an army drains the same stocks projects want.
  for (const u of playerUnits(state)) {
    for (const [k, v] of Object.entries(UNIT_DEFS[u.defId].upkeep)) {
      const key = k as keyof typeof state.colony.stocks;
      state.colony.stocks[key] = Math.max(0, state.colony.stocks[key] - (v as number));
    }
  }

  // 2. Healing at the settlement or on garrison duty.
  for (const u of playerUnits(state)) {
    if (same(u.coord, CENTER) || u.garrisonOf) {
      u.hp = Math.min(UNIT_DEFS[u.defId].hp, u.hp + T.healPerTurn);
    }
  }

  // 3. Spawns: the Stillness fields cells; Nemesis rivals field strike parties.
  if (state.structures.length) {
    const a = state.antagonist;
    if (a.awakened && Math.random() < Math.min(T.stillnessSpawnCap, a.threat / T.stillnessSpawnDivisor)) {
      if (spawnRaider(state, "stillness")) {
        logs.push("Stillness raiders cross the rim of your territory.");
      }
    }
    for (const rival of state.rivals) {
      if (rival.alive && rival.stance === "nemesis" && Math.random() < T.nemesisSpawnChance) {
        if (spawnRaider(state, rival.id)) {
          logs.push(`${rivalName(rival)} sends a strike party into your territory.`);
        }
      }
    }
  }

  // 4. Enemy raiders move and attack.
  for (const raider of [...enemyUnits(state)]) {
    if (!state.units.includes(raider)) continue; // died earlier this tick
    const target = state.structures.find((s) => s.id === raider.targetId);
    if (!target) {
      const next = mostAdvancedStructure(state) ?? state.structures[0];
      if (!next) {
        state.units = state.units.filter((u) => u.id !== raider.id);
        continue; // nothing left to unmake; they melt back into the wastes
      }
      raider.targetId = next.id;
      continue;
    }

    for (let step = 0; step < UNIT_DEFS.raider.moves; step++) {
      if (!state.units.includes(raider)) break;
      // Interception: a player field unit on this hex fights the raider.
      const blocker = playerUnits(state).find((u) => !u.garrisonOf && same(u.coord, raider.coord));
      if (blocker) {
        logs.push(`Your ${UNIT_DEFS[blocker.defId].name} engages raiders${fight(state, blocker, raider)}.`);
        break;
      }
      if (same(raider.coord, target.coord)) {
        // At the works: garrison first, then Integrity.
        const garrison = state.units.find((u) => u.garrisonOf === target.id);
        if (garrison) {
          logs.push(`Raiders assault the ${target.name}; the garrison holds${fight(state, garrison, raider)}.`);
        } else {
          target.integrity -= Math.max(1, UNIT_DEFS.raider.strength - target.hardness);
          if (target.integrity <= 0) {
            logs.push(raze(state, target, raider.ownerId));
            state.units = state.units.filter((u) => u.id !== raider.id); // vanish into the wastes
          } else {
            logs.push(`Raiders batter the ${target.name} (integrity ${Math.max(0, target.integrity)}/${target.maxIntegrity}).`);
          }
        }
        break;
      }
      stepToward(state, raider, target.coord);
    }
  }

  // 5. Rangers auto-patrol: hunt the nearest raider.
  for (const ranger of playerUnits(state).filter((u) => u.defId === "ranger" && !u.garrisonOf)) {
    if (!state.units.includes(ranger)) continue;
    const foes = enemyUnits(state);
    if (!foes.length) continue;
    const prey = foes.reduce((best, f) =>
      hexDistance(f.coord, ranger.coord) < hexDistance(best.coord, ranger.coord) ? f : best,
    );
    for (let step = 0; step < UNIT_DEFS.ranger.moves; step++) {
      if (!state.units.includes(ranger) || !state.units.includes(prey)) break;
      if (same(ranger.coord, prey.coord)) {
        logs.push(`Your Ranger runs raiders down${fight(state, ranger, prey)}.`);
        break;
      }
      // Step onto the prey's hex if adjacent (engagement), else close distance.
      if (hexDistance(ranger.coord, prey.coord) === 1) {
        ranger.coord = { ...prey.coord };
      } else {
        stepToward(state, ranger, prey.coord);
      }
    }
  }

  return logs;
}
