import type { AntagonistState, GameState, GlobalParamKey } from "../types";
import { ANTAGONIST, STILLNESS_TUNING as T } from "../data/antagonist";
import { computeHabitability } from "./terraforming";
import { dominantIdeology, nudgeIdeology } from "./ideology";
import { recordChronicle } from "./chronicle";
import { PROJECTS_BY_ID } from "../data/projects";

/**
 * The Stillness simulation: directional pressure against the win condition.
 *
 * Once terraforming visibly succeeds, the movement awakens. Each turn its
 * threat grows with your success; with enough threat it acts — "quieting" your
 * most-advanced global parameter (the event-level form of razing terraforming
 * infrastructure), raiding stores, preaching unrest, or stalling projects.
 *
 * If the planet, having reached real habitability, is dragged back down to
 * near-silence, the Stillness wins and the game is lost.
 *
 * Counterplay: strike their cells (militarist answer), fund their enclaves to
 * buy quiet (ecological answer), or terraform faster than they can unmake.
 */

export function initialAntagonist(): AntagonistState {
  return { awakened: false, threat: 0, appeasedTurns: 0, peakHabitability: 0, quietings: 0 };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** How hard they currently push, given policy, ideology, and appeasement. */
export function stillnessAggression(state: GameState): number {
  const a = state.antagonist;
  let mult = 1;
  if (a.appeasedTurns > 0) mult *= T.appeasedMult;
  if (state.policies.environment === "preservation") mult *= T.preservationMult;
  if (state.policies.environment === "industrial") mult *= T.industrialMult;
  if (dominantIdeology(state) === "ecological") mult *= T.ecologicalMult;
  return mult;
}

/** UI-facing mood word for the current threat level. */
export function stillnessMood(threat: number): string {
  if (threat < 20) return "stirring";
  if (threat < 45) return "restless";
  if (threat < 70) return "hunting";
  return "ascendant";
}

// ---------------------------------------------------------------------------
// Per-turn tick
// ---------------------------------------------------------------------------

export function antagonistTick(state: GameState): string[] {
  const logs: string[] = [];
  const a = state.antagonist;
  a.peakHabitability = Math.max(a.peakHabitability, state.habitability);

  // Dormant until the terraforming is impossible to ignore.
  if (!a.awakened) {
    if (state.habitability >= T.awakenHabitability) {
      a.awakened = true;
      a.awakenedTurn = state.turn;
      a.threat = 10;
      logs.push(
        `${ANTAGONIST.name} reveals itself — "${ANTAGONIST.creed}" They have begun to unmake your work.`,
      );
      recordChronicle(state, "crisis", "The Stillness Awakens",
        "As the world stirred to life, a movement rose to return it to silence.");
    }
    return logs;
  }

  // Threat grows with your success; appeasement and gentle policy slow it.
  if (a.appeasedTurns > 0) a.appeasedTurns -= 1;
  const aggression = stillnessAggression(state);
  const growth = (T.baseGrowth + state.habitability * T.growthPerHabitability) * aggression;
  a.threat = clamp(a.threat + growth, 0, 100);

  // Possibly act.
  const chance = Math.min(T.actionChanceCap, (a.threat / T.actionChanceDivisor) * aggression);
  if (Math.random() < chance) {
    logs.push(act(state));
  }

  // Their victory: a woken world dragged back toward silence.
  if (a.peakHabitability >= T.winRequiresPeak && state.habitability <= T.winFallsTo && !state.gameOver) {
    state.gameOver = "lost";
    logs.push("The Stillness has won. The world you woke returns to silence.");
    recordChronicle(state, "crisis", "The World Falls Silent",
      "The Stillness unmade the great work. The planet, once stirring, is quiet again.");
  }

  return logs;
}

// ---------------------------------------------------------------------------
// Their actions
// ---------------------------------------------------------------------------

function act(state: GameState): string {
  const roll = Math.random();
  if (roll < 0.4) return quieting(state);
  if (roll < 0.65) return raidStores(state);
  if (roll < 0.85) return preachSilence(state);
  return stallProject(state) ?? raidStores(state);
}

/**
 * A quieting: regress the most-advanced global parameter. This is the
 * event-level form of the razing rule (razing terraforming infrastructure
 * regresses the parameter it served — docs/UNITS.md).
 */
function quieting(state: GameState): string {
  const a = state.antagonist;
  const keys = Object.keys(state.globalParams) as GlobalParamKey[];
  // Target the dial with the most absolute progress from its floor.
  const target = keys.reduce((best, k) =>
    state.globalParams[k].value - state.globalParams[k].min >
    state.globalParams[best].value - state.globalParams[best].min
      ? k
      : best,
  );
  const p = state.globalParams[target];
  const amount = 2 + a.threat / 25; // 2 .. 6
  const before = p.value;
  p.value = Math.max(p.min, p.value - amount);
  const applied = Math.round((before - p.value) * 10) / 10;
  state.habitability = computeHabitability(state);
  a.quietings += 1;
  if (a.quietings === 1) {
    recordChronicle(state, "crisis", "The First Quieting",
      `The Stillness struck the terraforming works; ${p.label.toLowerCase()} slipped backward.`);
  }
  return `A quieting — Stillness cells unmake your work: ${p.label} -${applied} ${p.unit}.`;
}

function raidStores(state: GameState): string {
  const s = state.colony.stocks;
  const mat = Math.min(s.materials, 20);
  const cred = Math.min(s.credits, 15);
  s.materials -= mat;
  s.credits -= cred;
  return `Stillness raiders strip your depots (-${Math.round(mat)} materials, -${Math.round(cred)} credits).`;
}

function preachSilence(state: GameState): string {
  const hit = 6;
  state.colony.stability = Math.max(0, state.colony.stability - hit);
  return `Preachers of the Stillness spread the creed of silence in your domes (-${hit} stability).`;
}

function stallProject(state: GameState): string | null {
  const active = state.activeProjects[0];
  if (!active) return null;
  active.turnsRemaining += 1;
  const name = PROJECTS_BY_ID[active.projectId]?.name ?? "a project";
  return `Stillness saboteurs stall "${name}" (+1 turn).`;
}

// ---------------------------------------------------------------------------
// Player counteractions
// ---------------------------------------------------------------------------

/** Strike their cells: the militarist answer. Costs resources, cuts threat. */
export function strikeStillness(state: GameState): string | null {
  const a = state.antagonist;
  if (!a.awakened || state.gameOver) return null;
  const s = state.colony.stocks;
  const c = T.strike;
  if (s.energy < c.energy || s.materials < c.materials) {
    return `Not enough resources to strike the Stillness (need ${c.energy} energy, ${c.materials} materials).`;
  }
  s.energy -= c.energy;
  s.materials -= c.materials;
  const martial =
    state.policies.security === "martial" || dominantIdeology(state) === "militarist";
  const cut = martial ? c.threatMartial : c.threatBase;
  a.threat = clamp(a.threat - cut, 0, 100);
  nudgeIdeology(state, "militarist", 2);
  return `Security forces sweep the Stillness cells (threat -${cut}).`;
}

/** Fund their enclaves: the ecological answer. Buys quiet, not peace. */
export function fundStillnessEnclaves(state: GameState): string | null {
  const a = state.antagonist;
  if (!a.awakened || state.gameOver) return null;
  const s = state.colony.stocks;
  const c = T.fund;
  if (s.credits < c.credits) {
    return `Not enough credits to fund preservation enclaves (need ${c.credits}).`;
  }
  s.credits -= c.credits;
  a.appeasedTurns += c.appeaseTurns;
  a.threat = clamp(a.threat - c.threatRelief, 0, 100);
  nudgeIdeology(state, "ecological", 2);
  return `You fund protected preservation enclaves. The Stillness quiets — for a while.`;
}
