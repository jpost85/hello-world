import type { GameState, InterestGroupKey } from "../types";
import { getPolicyOption, POLICY_AXES } from "../data/policies";
import { GROUP_BY_KEY } from "../data/politics";

/**
 * Internal politics. Each turn the active policies nudge interest-group
 * satisfaction toward the pressure they exert; ideology and environment do too.
 * Groups drift back toward neutral otherwise. Any group that falls into
 * discontent bleeds colony stability — the cost of governing against your base.
 *
 * Active only once there's a society to have politics (Settlement phase on).
 */

const DISCONTENT = 35; // below this, a group actively causes unrest
const NEUTRAL = 55; // groups drift toward here in the absence of pressure

/** Aggregate per-turn satisfaction deltas the current policies apply. */
function policyGroupDeltas(state: GameState): Partial<Record<InterestGroupKey, number>> {
  const totals: Partial<Record<InterestGroupKey, number>> = {};
  for (const axis of POLICY_AXES) {
    const opt = getPolicyOption(axis.key, state.policies[axis.key]);
    if (!opt.groups) continue;
    for (const [k, v] of Object.entries(opt.groups)) {
      const key = k as InterestGroupKey;
      totals[key] = (totals[key] ?? 0) + (v as number);
    }
  }
  return totals;
}

/**
 * Update interest groups and return a stability delta (usually <= 0) plus any
 * unrest log lines. Called from the survival tick.
 */
export function updateInterestGroups(state: GameState): { stability: number; logs: string[] } {
  const logs: string[] = [];
  if (state.phase === "corporate") return { stability: 0, logs };

  const deltas = policyGroupDeltas(state);
  for (const group of state.interestGroups) {
    const push = deltas[group.key] ?? 0;
    // Move toward (neutral + push*scale), clamped — policies set a target, they
    // don't yank satisfaction instantly.
    const target = Math.max(0, Math.min(100, NEUTRAL + push * 6));
    group.satisfaction += (target - group.satisfaction) * 0.25;
    group.satisfaction = Math.max(0, Math.min(100, group.satisfaction));
  }

  // Discontent → stability drain, scaled by how deep the discontent runs.
  let stability = 0;
  for (const group of state.interestGroups) {
    if (group.satisfaction < DISCONTENT) {
      stability -= (DISCONTENT - group.satisfaction) * 0.15;
    }
  }

  // Occasionally surface the angriest group as a flavor log.
  const angriest = [...state.interestGroups].sort((a, b) => a.satisfaction - b.satisfaction)[0];
  if (angriest && angriest.satisfaction < DISCONTENT) {
    logs.push(`${GROUP_BY_KEY[angriest.key].name} are in open discontent.`);
  }

  return { stability: Math.round(stability * 10) / 10, logs };
}

/** Whether any group is currently in open discontent (for UI emphasis). */
export function hasUnrest(state: GameState): boolean {
  return state.interestGroups.some((g) => g.satisfaction < DISCONTENT);
}
