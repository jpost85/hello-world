import type { GameState, Production, ProductionModifiers } from "../types";
import { getPolicyOption, POLICY_AXES } from "../data/policies";

/**
 * Turns the active social-engineering selection into concrete economic effects.
 * Policies only take mechanical effect once the Settlement phase unlocks social
 * engineering — in the pure-corporate opening there is no society to tune.
 */

const PRODUCTION_KEYS: (keyof Production)[] = [
  "energy",
  "materials",
  "food",
  "credits",
  "research",
];

/** Multiply any number of modifier maps together (missing keys default to 1). */
export function combineModifiers(...mods: ProductionModifiers[]): ProductionModifiers {
  const out: ProductionModifiers = {};
  for (const key of PRODUCTION_KEYS) {
    let v = 1;
    for (const m of mods) v *= m[key] ?? 1;
    if (v !== 1) out[key] = v;
  }
  return out;
}

export function socialEngineeringActive(state: GameState): boolean {
  return state.phase !== "corporate";
}

/** Combined production multipliers from all policy axes. */
export function policyModifiers(state: GameState): ProductionModifiers {
  if (!socialEngineeringActive(state)) return {};
  const mods = POLICY_AXES.map((a) => getPolicyOption(a.key, state.policies[a.key]).modifiers);
  return combineModifiers(...mods);
}

/** Total flat per-turn stability delta imposed by current policies. */
export function policyStability(state: GameState): number {
  if (!socialEngineeringActive(state)) return 0;
  return POLICY_AXES.reduce(
    (sum, a) => sum + (getPolicyOption(a.key, state.policies[a.key]).stability ?? 0),
    0,
  );
}
