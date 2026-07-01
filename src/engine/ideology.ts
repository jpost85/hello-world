import type {
  GameState,
  IdeologyAxis,
  ProductionModifiers,
  ProjectCategory,
  TerraformProject,
} from "../types";
import { IDEOLOGY_BY_KEY } from "../data/ideologies";
import { getPolicyOption, POLICY_AXES } from "../data/policies";

/**
 * Emergent ideology. Nothing is chosen up front — instead, ideological pressure
 * accumulates from three sources every turn/decision:
 *   1. the policies currently in force (data/policies.ts `leanings`)
 *   2. the terraforming projects completed (their lean or category)
 *   3. the notable people who rise (engine/characters.ts)
 * The dominant leaning, once the game reaches the Ideological phase, applies the
 * effects defined in data/ideologies.ts.
 */

/** Which leaning a completed project reinforces (explicit override or category). */
const CATEGORY_LEAN: Record<ProjectCategory, IdeologyAxis> = {
  thermal: "technocratic",
  atmosphere: "industrialist",
  hydrosphere: "ecological",
  biosphere: "ecological",
  infrastructure: "technocratic",
};

export function projectLean(project: TerraformProject): IdeologyAxis {
  return project.ideologyLean ?? CATEGORY_LEAN[project.category];
}

/** Add ideological pressure along one axis. */
export function nudgeIdeology(state: GameState, axis: IdeologyAxis, amount: number): void {
  state.ideology[axis] += amount;
}

/** Per-turn drift from the active policy selection. Identity only forms once
 *  there is a society to shape it (settlement phase onward). */
export function applyPolicyIdeologyDrift(state: GameState): void {
  if (state.phase === "corporate") return;
  for (const axis of POLICY_AXES) {
    const opt = getPolicyOption(axis.key, state.policies[axis.key]);
    if (!opt.leanings) continue;
    for (const [k, v] of Object.entries(opt.leanings)) {
      state.ideology[k as IdeologyAxis] += v as number;
    }
  }
}

/** The current strongest leaning, or null if nothing has accumulated yet. */
export function dominantIdeology(state: GameState): IdeologyAxis | null {
  let best: IdeologyAxis | null = null;
  let bestVal = 0;
  for (const [k, v] of Object.entries(state.ideology)) {
    if (v > bestVal) {
      bestVal = v;
      best = k as IdeologyAxis;
    }
  }
  return best;
}

/**
 * Production modifiers contributed by the dominant ideology — but only once the
 * society is ideological. Before that, identity is still forming and has no
 * mechanical grip.
 */
export function ideologyModifiers(state: GameState): ProductionModifiers {
  if (state.phase !== "ideological" && state.phase !== "independence") return {};
  const dom = dominantIdeology(state);
  if (!dom) return {};
  return IDEOLOGY_BY_KEY[dom].modifiers;
}

/** Flat per-turn stability delta from the dominant ideology (ideological phase). */
export function ideologyStability(state: GameState): number {
  if (state.phase !== "ideological" && state.phase !== "independence") return 0;
  const dom = dominantIdeology(state);
  return dom ? IDEOLOGY_BY_KEY[dom].stability : 0;
}
