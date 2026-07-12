/**
 * Battle resolution — "auto-resolve with tactical nudges".
 *
 * A field battle resolves automatically over several rounds of attrition, but a
 * lot of RoTK texture rides on top: the lead officers' (item-boosted) stats,
 * troop morale and training, the rock-paper-scissors of branches, walls and
 * sieges, river crossings where navies rule, and scripted tactical events (fire
 * attack, ambush, single-combat duel). It honours the iconic moments without
 * trapping a phone player in a 20-minute grid battle.
 *
 * Pure and deterministic: all randomness is threaded through the RNG state, so a
 * battle replays identically from the same inputs and seed (see `battle.test.ts`).
 */
import { CONFIG, typeMatchup } from "./config.ts";
import { effectiveStats, hasTrait } from "./items.ts";
import { nextFloat, rollRange } from "./rng.ts";
import type { BattleEvent, BattleResult, Officer, UnitType } from "./types.ts";

export interface BattleSide {
  playerId: string | null;
  troops: number;
  /** Branch of the fielded army. */
  unitType: UnitType;
  /** Troop morale 0–100. */
  morale: number;
  /** Troop training 0–100. */
  training: number;
  /** The lead officer (highest WAR) committed by this side, if any. */
  officer?: Officer;
}

export interface BattleInputs {
  provinceId: string;
  attacker: BattleSide;
  defender: BattleSide;
  /** Defender fortification level 0–5. */
  defenderWallLevel: number;
  /** Defender province order 0–100 (rallies the garrison). */
  defenderOrder: number;
  /** True if the march crosses water — navies dominate the crossing. */
  waterCrossing: boolean;
}

const B = CONFIG.battle;

const cond = (v: number) => 1 + (v - 50) / 50; // 0→0, 50→1, 100→2 around resting 50

/** The branch a specialist trait empowers. */
function branchTraitBonus(side: BattleSide): number {
  const o = side.officer;
  if (!o) return 0;
  if (side.unitType === "cavalry" && hasTrait(o, "cavalier")) return B.traitBranchBonus;
  if (side.unitType === "archers" && hasTrait(o, "archer")) return B.traitBranchBonus;
  if (side.unitType === "navy" && hasTrait(o, "admiral")) return B.traitBranchBonus;
  return 0;
}

/** Combat power of a side before the opposed type/terrain matchup. */
function basePower(side: BattleSide): number {
  if (side.troops <= 0) return 0;
  const prowess = side.officer ? (effectiveStats(side.officer).war + effectiveStats(side.officer).leadership) / 200 : 0;
  let p = side.troops * (1 + B.officerPowerScale * prowess);
  p *= 1 + B.moraleScale * (cond(side.morale) - 1);
  p *= 1 + B.trainingScale * (cond(side.training) - 1);
  p *= 1 + branchTraitBonus(side);
  return p;
}

/** Apply the opposed branch / river-crossing multiplier to an attacker side. */
function matchupMultiplier(self: BattleSide, foe: BattleSide, waterCrossing: boolean): number {
  let m = 1 + B.typeAdvantage * typeMatchup(self.unitType, foe.unitType);
  if (waterCrossing) {
    if (self.unitType === "navy" && foe.unitType !== "navy") m *= 1 + B.navalCrossingBonus;
    else if (self.unitType !== "navy" && foe.unitType === "navy") m *= 1 - B.navalCrossingBonus * 0.5;
  }
  return m;
}

/**
 * Resolve a full battle. Returns the outcome plus the advanced RNG state. The
 * caller (`game.ts`) applies the consequences to `GameState`.
 */
export function resolveBattle(
  inputs: BattleInputs,
  rngState: number,
): { result: BattleResult; rngState: number } {
  const { attacker, defender, waterCrossing } = inputs;
  const events: BattleEvent[] = [];
  let state = rngState;
  let atk = attacker.troops;
  let def = defender.troops;
  const atkStart = atk;
  const defStart = def;

  // Standing multipliers that don't change as troops fall.
  const atkMatch = matchupMultiplier(attacker, defender, waterCrossing);
  const defMatch = matchupMultiplier(defender, attacker, waterCrossing);
  const wall = 1 + B.wallBonusPerLevel * inputs.defenderWallLevel * (attacker.unitType === "siege" ? 1 - B.siegeWallNegation : 1);
  const defStanding = defMatch * wall * (1 + B.orderMultiplier * (inputs.defenderOrder / 100));

  const atkEff = attacker.officer ? effectiveStats(attacker.officer) : null;
  const defEff = defender.officer ? effectiveStats(defender.officer) : null;

  const draw = () => {
    const r = nextFloat(state);
    state = r.state;
    return r.value;
  };

  // --- Pre-battle tactical events ----------------------------------------
  // Fire attack: a clever attacker burns the enemy camp (Chibi writ small).
  if (atkEff && draw() < B.fireAttackChance * (atkEff.intellect / 100) * (hasTrait(attacker.officer, "strategist") ? 1.4 : 1)) {
    const resisted = defEff ? defEff.intellect / 100 : 0;
    const damage = Math.round(def * 0.2 * (1 - 0.6 * resisted));
    if (damage > 0) {
      def = Math.max(0, def - damage);
      events.push({ kind: "fire-attack", against: "defender", damage, message: `${attacker.officer!.name} sets fire to the enemy camp` });
    }
  }
  // Ambush: a sharp defender catches the marching column in the open.
  if (defEff && draw() < B.fireAttackChance * (defEff.intellect / 100) * (hasTrait(defender.officer, "strategist") ? 1.4 : 1)) {
    const resisted = atkEff ? atkEff.intellect / 100 : 0;
    const damage = Math.round(atk * 0.15 * (1 - 0.6 * resisted));
    if (damage > 0) {
      atk = Math.max(0, atk - damage);
      events.push({ kind: "ambush", against: "attacker", damage, message: `${defender.officer!.name} springs an ambush` });
    }
  }
  // Duel: two champions meet; the loser's army loses heart (and men).
  if (atkEff && defEff && draw() < B.duelChance) {
    const aBonus = hasTrait(attacker.officer, "valiant") ? 10 : 0;
    const dBonus = hasTrait(defender.officer, "valiant") ? 10 : 0;
    const a = atkEff.war + aBonus + rollRange(state, 0, 20).value;
    state = rollRange(state, 0, 20).state;
    const d = defEff.war + dBonus + rollRange(state, 0, 20).value;
    state = rollRange(state, 0, 20).state;
    if (a >= d) {
      const damage = Math.round(def * 0.12);
      def = Math.max(0, def - damage);
      events.push({ kind: "duel", against: "defender", damage, message: `${attacker.officer!.name} bests ${defender.officer!.name} in single combat` });
    } else {
      const damage = Math.round(atk * 0.12);
      atk = Math.max(0, atk - damage);
      events.push({ kind: "duel", against: "attacker", damage, message: `${defender.officer!.name} bests ${attacker.officer!.name} in single combat` });
    }
  }

  // --- Attrition rounds ---------------------------------------------------
  const routFloor = (start: number) => Math.floor(start * B.routThreshold);
  let rounds = 0;
  while (rounds < B.maxRounds && atk > routFloor(atkStart) && def > routFloor(defStart)) {
    const atkPower = basePower({ ...attacker, troops: atk }) * atkMatch;
    const defPower = basePower({ ...defender, troops: def }) * defStanding;
    const total = atkPower + defPower || 1;
    const atkLuck = 1 - B.luckSpread + draw() * 2 * B.luckSpread;
    const defLuck = 1 - B.luckSpread + draw() * 2 * B.luckSpread;
    const atkLoss = Math.round(atk * B.baseCasualtyRate * (defPower / total) ** B.casualtyPowerExponent * atkLuck);
    const defLoss = Math.round(def * B.baseCasualtyRate * (atkPower / total) ** B.casualtyPowerExponent * defLuck);
    atk = Math.max(0, atk - atkLoss);
    def = Math.max(0, def - defLoss);
    rounds++;
  }

  // --- Outcome ------------------------------------------------------------
  const atkFrac = atkStart > 0 ? atk / atkStart : 0;
  const defFrac = defStart > 0 ? def / defStart : 1;
  const captured = atkFrac > defFrac && def <= routFloor(defStart);
  const loser = captured ? "defender" : atk <= routFloor(atkStart) ? "attacker" : atkFrac < defFrac ? "attacker" : "defender";
  events.push({
    kind: "rout",
    against: loser,
    damage: 0,
    message: captured ? "The province falls!" : `The ${loser === "attacker" ? "attackers withdraw" : "defenders hold but are broken"}`,
  });

  let capturedOfficerId: string | null = null;
  if (captured && defender.officer && draw() < B.captureChance) {
    capturedOfficerId = defender.officer.id;
  }

  const result: BattleResult = {
    provinceId: inputs.provinceId,
    attackerId: attacker.playerId!,
    defenderId: defender.playerId,
    attackerTroopsStart: atkStart,
    defenderTroopsStart: defStart,
    attackerTroopsEnd: atk,
    defenderTroopsEnd: def,
    events,
    captured,
    capturedOfficerId,
  };
  return { result, rngState: state };
}
