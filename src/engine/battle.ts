/**
 * Battle resolution — "auto-resolve with tactical nudges".
 *
 * A field battle resolves automatically over several rounds of attrition, but
 * the lead officers' stats and a handful of scripted tactical events (fire
 * attack, ambush, single-combat duel) swing the outcome — honouring the iconic
 * moments of the era without trapping a phone player in a 20-minute grid battle.
 *
 * Pure and deterministic: all randomness is threaded through the RNG state, so a
 * battle replays identically from the same inputs and seed (see `battle.test.ts`).
 */
import { CONFIG } from "./config.ts";
import { nextFloat, rollRange } from "./rng.ts";
import type { BattleEvent, BattleResult, Officer } from "./types.ts";

export interface BattleSide {
  playerId: string | null;
  troops: number;
  /** The lead officer (highest WAR) committed by this side, if any. */
  officer?: Officer;
}

export interface BattleInputs {
  provinceId: string;
  attacker: BattleSide;
  defender: BattleSide;
  hasRampart: boolean;
  /** Defender province order 0–100 (rallies the garrison). */
  defenderOrder: number;
}

const B = CONFIG.battle;

/** Combat power of a side: troops amplified by its lead officer's prowess. */
function powerOf(troops: number, officer?: Officer): number {
  if (troops <= 0) return 0;
  const prowess = officer ? (officer.war + officer.leadership) / 200 : 0;
  return troops * (1 + B.officerPowerScale * prowess);
}

/** Defender's standing bonus from ramparts and public order. */
function defenderMultiplier(hasRampart: boolean, order: number): number {
  const rampart = hasRampart ? B.rampartMultiplier : 1;
  const morale = 1 + B.orderMultiplier * (order / 100);
  return rampart * morale;
}

/**
 * Resolve a full battle. Returns the outcome plus the advanced RNG state. The
 * caller (`game.ts`) applies the consequences to `GameState`.
 */
export function resolveBattle(
  inputs: BattleInputs,
  rngState: number,
): { result: BattleResult; rngState: number } {
  const { attacker, defender } = inputs;
  const events: BattleEvent[] = [];
  let state = rngState;
  let atk = attacker.troops;
  let def = defender.troops;
  const atkStart = atk;
  const defStart = def;
  const defMult = defenderMultiplier(inputs.hasRampart, inputs.defenderOrder);

  const draw = () => {
    const r = nextFloat(state);
    state = r.state;
    return r.value;
  };

  // --- Pre-battle tactical events ----------------------------------------
  // Fire attack: a clever attacker burns the enemy camp (Chibi writ small).
  if (attacker.officer && draw() < B.fireAttackChance * (attacker.officer.intellect / 100)) {
    const resisted = defender.officer ? defender.officer.intellect / 100 : 0;
    const damage = Math.round(def * 0.2 * (1 - 0.6 * resisted));
    if (damage > 0) {
      def = Math.max(0, def - damage);
      events.push({ kind: "fire-attack", against: "defender", damage, message: `${attacker.officer.name} sets fire to the enemy camp` });
    }
  }
  // Ambush: a sharp defender catches the marching column in the open.
  if (defender.officer && draw() < B.fireAttackChance * (defender.officer.intellect / 100)) {
    const resisted = attacker.officer ? attacker.officer.intellect / 100 : 0;
    const damage = Math.round(atk * 0.15 * (1 - 0.6 * resisted));
    if (damage > 0) {
      atk = Math.max(0, atk - damage);
      events.push({ kind: "ambush", against: "attacker", damage, message: `${defender.officer.name} springs an ambush` });
    }
  }
  // Duel: two champions meet; the loser's army loses heart (and men).
  if (attacker.officer && defender.officer && draw() < B.duelChance) {
    const a = attacker.officer.war + rollRange(state, 0, 20).value;
    state = rollRange(state, 0, 20).state;
    const d = defender.officer.war + rollRange(state, 0, 20).value;
    state = rollRange(state, 0, 20).state;
    if (a >= d) {
      const damage = Math.round(def * 0.12);
      def = Math.max(0, def - damage);
      events.push({ kind: "duel", against: "defender", damage, message: `${attacker.officer.name} bests ${defender.officer.name} in single combat` });
    } else {
      const damage = Math.round(atk * 0.12);
      atk = Math.max(0, atk - damage);
      events.push({ kind: "duel", against: "attacker", damage, message: `${defender.officer.name} bests ${attacker.officer.name} in single combat` });
    }
  }

  // --- Attrition rounds ---------------------------------------------------
  const routFloor = (start: number) => Math.floor(start * B.routThreshold);
  let rounds = 0;
  while (rounds < B.maxRounds && atk > routFloor(atkStart) && def > routFloor(defStart)) {
    const atkPower = powerOf(atk, attacker.officer);
    const defPower = powerOf(def, defender.officer) * defMult;
    const total = atkPower + defPower || 1;
    // Each side loses a fraction of its own strength, weighted by how much of
    // the battlefield power the *enemy* holds, times a 0.7–1.3 luck factor.
    const atkLuck = 0.7 + draw() * 0.6;
    const defLuck = 0.7 + draw() * 0.6;
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
