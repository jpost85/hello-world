/**
 * Dice-based combat resolution.
 *
 * A battle is fought in rounds. Each round both sides roll dice, the dice are
 * compared highest-against-highest, and the loser of each comparison loses one
 * army. This mirrors classic conquest-game dice combat, extended with:
 *
 *   - Attack / defense *styles* that trade dice count, per-die strength, and
 *     tie-breaking against one another.
 *   - Generals, which add a flat bonus to their side's single highest die.
 *   - Fortresses, which grant the defender an extra defending die.
 *
 * All balance values live in the `ATTACK_STYLES` / `DEFENSE_STYLES` tables and
 * the constants below, so they can be tuned without touching resolution logic.
 */

import { CONFIG } from "./config.ts";
import { rollDice } from "./rng.ts";
import type {
  AttackStyle,
  CombatRound,
  DefenseStyle,
  StyleProfile,
} from "./types.ts";

/**
 * Balance values are sourced from the central `CONFIG` table; these aliases keep
 * the names stable for callers and tests.
 *
 * Standard reproduces the classic conquest rules. Aggressive presses harder (wins ties, or
 * strikes harder); cautious commits fewer dice — slower, but exposes fewer
 * armies to loss in a round.
 */
export const BASE_MAX_ATTACK_DICE = CONFIG.combat.baseMaxAttackDice;
export const BASE_MAX_DEFENSE_DICE = CONFIG.combat.baseMaxDefenseDice;

/** Extra defending die granted by a fortress. */
export const FORTRESS_DEFENSE_DICE = CONFIG.fortress.defenseDice;

export const ATTACK_STYLES: Record<AttackStyle, StyleProfile> = CONFIG.combat.attackStyles;
export const DEFENSE_STYLES: Record<DefenseStyle, StyleProfile> = CONFIG.combat.defenseStyles;

export interface CombatContext {
  attackerArmies: number;
  defenderArmies: number;
  attackStyle: AttackStyle;
  defenseStyle: DefenseStyle;
  /** Combat bonus from a general stationed in the attacking territory (0 if none). */
  attackerGeneralBonus: number;
  /** Combat bonus from a general stationed in the defending territory (0 if none). */
  defenderGeneralBonus: number;
  /** Whether the defending territory has a fortress. */
  defenderHasFortress: boolean;
  rngState: number;
}

/**
 * How many dice the attacker may roll: bounded by armies (must keep one army
 * behind, so dice <= armies - 1) and by the style-adjusted cap.
 */
export function attackerDiceCount(armies: number, style: AttackStyle): number {
  const cap = BASE_MAX_ATTACK_DICE + ATTACK_STYLES[style].diceModifier;
  return clamp(Math.min(armies - 1, cap), 0, BASE_MAX_ATTACK_DICE);
}

/**
 * How many dice the defender may roll: bounded by armies present, the
 * style-adjusted cap, and any fortress bonus.
 */
export function defenderDiceCount(
  armies: number,
  style: DefenseStyle,
  hasFortress: boolean,
): number {
  const cap =
    BASE_MAX_DEFENSE_DICE +
    DEFENSE_STYLES[style].diceModifier +
    (hasFortress ? FORTRESS_DEFENSE_DICE : 0);
  return clamp(Math.min(armies, cap), 1, BASE_MAX_DEFENSE_DICE + FORTRESS_DEFENSE_DICE);
}

/**
 * Resolve a single round of combat. Returns the dice rolled (after bonuses, so
 * the UI can show what actually decided the round), the losses each side took,
 * and the advanced RNG state.
 */
export function resolveRound(ctx: CombatContext): {
  round: CombatRound;
  rngState: number;
} {
  const aCount = attackerDiceCount(ctx.attackerArmies, ctx.attackStyle);
  const dCount = defenderDiceCount(
    ctx.defenderArmies,
    ctx.defenseStyle,
    ctx.defenderHasFortress,
  );

  const aRoll = rollDice(ctx.rngState, aCount);
  const dRoll = rollDice(aRoll.state, dCount);

  const attackerDice = applyHighRollBonus(
    aRoll.values,
    ATTACK_STYLES[ctx.attackStyle].highRollBonus + ctx.attackerGeneralBonus,
  );
  const defenderDice = applyHighRollBonus(
    dRoll.values,
    DEFENSE_STYLES[ctx.defenseStyle].highRollBonus + ctx.defenderGeneralBonus,
  );

  // Compare the top dice from each side, one pair at a time.
  const comparisons = Math.min(attackerDice.length, defenderDice.length);
  let attackerLosses = 0;
  let defenderLosses = 0;
  const attackerWinsTies = ATTACK_STYLES[ctx.attackStyle].winsTies;

  for (let i = 0; i < comparisons; i++) {
    const a = attackerDice[i];
    const d = defenderDice[i];
    if (a > d) {
      defenderLosses++;
    } else if (a < d) {
      attackerLosses++;
    } else {
      // Tie: defender wins by default unless the attacker's style presses ties.
      if (attackerWinsTies) defenderLosses++;
      else attackerLosses++;
    }
  }

  return {
    round: { attackerDice, defenderDice, attackerLosses, defenderLosses },
    rngState: dRoll.state,
  };
}

/** Add `bonus` to the highest (already sorted-first) die, keeping order. */
function applyHighRollBonus(diceDesc: number[], bonus: number): number[] {
  if (bonus === 0 || diceDesc.length === 0) return diceDesc;
  const out = diceDesc.slice();
  out[0] = out[0] + bonus;
  return out;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
