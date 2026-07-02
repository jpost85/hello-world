import type {
  ActiveProject,
  Colony,
  GameState,
  LogEntry,
  LogKind,
  TerraformProject,
} from "../types";
import { getFaction } from "../data/factions";
import { PROJECTS, getProject } from "../data/projects";
import { TECHNOLOGIES, getTech } from "../data/technologies";
import {
  createGlobalParams,
  computeHabitability,
  applyParamDelta,
} from "./terraforming";
import { runSurvivalTick, computeMaxPopulation } from "./survival";
import { maybeTriggerHazard } from "./events";
import { emptyIdeologyVector } from "../data/ideologies";
import { defaultPolicySelection, POLICY_AXIS_BY_KEY } from "../data/policies";
import { initialInterestGroups } from "../data/politics";
import {
  applyPolicyIdeologyDrift,
  nudgeIdeology,
  projectLean,
} from "./ideology";
import { advancePhase } from "./phases";
import { checkBreakthroughs } from "./breakthroughs";
import { checkMilestones, recordChronicle } from "./chronicle";
import { maybeEmergeCharacter } from "./characters";
import {
  createRivals,
  rivalTick,
  applyDiplomaticAction,
  respondToDiplomacy,
} from "./diplomacy";
import {
  initialAntagonist,
  antagonistTick,
  strikeStillness,
  fundStillnessEnclaves,
} from "./antagonist";
import type { PolicyAxisKey, IndependenceOutcome, DiplomaticAction } from "../types";

/** Win when the planet is fully habitable; lose if the colony dies out. */
const HABITABILITY_WIN = 100;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export function createGame(factionId: string): GameState {
  const faction = getFaction(factionId);

  const colony: Colony = {
    id: "colony-1",
    name: `${faction.name} Prime`,
    factionId,
    population: 12,
    maxPopulation: 24,
    stability: 65,
    stocks: { ...faction.startingStocks },
    production: { ...faction.startingProduction },
  };

  const state: GameState = {
    turn: 1,
    playerFactionId: factionId,
    colony,
    globalParams: createGlobalParams(),
    activeProjects: [],
    completedProjects: [],
    researchedTech: [],
    currentResearch: undefined,
    habitability: 0,
    terraformRating: 0,
    // Every other faction is a rival leader with a personality and a memory.
    rivals: createRivals(factionId),
    pendingDiplomacy: [],
    earth: { stance: 0, present: false },
    antagonist: initialAntagonist(),
    log: [],

    // Civilization layer — begins dormant in the corporate phase.
    phase: "corporate",
    ideology: emptyIdeologyVector(),
    policies: defaultPolicySelection(),
    interestGroups: initialInterestGroups(),
    characters: [],
    breakthroughs: [],
    chronicle: [],
    milestones: {},
  };

  // A faction's identity gives ideology a small initial lean.
  seedFactionIdeology(state);

  state.habitability = computeHabitability(state);
  state.colony.maxPopulation = computeMaxPopulation(state);
  pushLog(state, "info", `${faction.name} colony established. Survive, and make this world ours.`);
  recordChronicle(
    state,
    "phase",
    "Landfall",
    `${faction.name} establishes the first foothold on a dead world.`,
  );
  return state;
}

/** Seed emergent ideology from the founding faction's leanings. */
function seedFactionIdeology(state: GameState): void {
  const seeds: Record<string, Partial<GameState["ideology"]>> = {
    "verdant-compact": { ecological: 8, humanist: 3 },
    "helion-consortium": { industrialist: 8, technocratic: 3 },
    "iron-vanguard": { militarist: 8, industrialist: 3 },
    "cognitum": { technocratic: 10 },
    "terran-union": { humanist: 8, ecological: 2 },
    "ouroboros-cradle": { humanist: 5, ecological: 4 },
  };
  const seed = seeds[state.playerFactionId] ?? {};
  for (const [k, v] of Object.entries(seed)) {
    state.ideology[k as keyof GameState["ideology"]] += v as number;
  }
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

export function pushLog(state: GameState, kind: LogKind, message: string): void {
  const entry: LogEntry = { turn: state.turn, kind, message };
  state.log.push(entry);
  // Keep the log bounded for a long-running prototype session.
  if (state.log.length > 200) state.log.shift();
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

function canAfford(state: GameState, project: TerraformProject): boolean {
  const s = state.colony.stocks;
  const c = project.cost;
  return (
    (c.energy ?? 0) <= s.energy &&
    (c.materials ?? 0) <= s.materials &&
    (c.food ?? 0) <= s.food &&
    (c.credits ?? 0) <= s.credits
  );
}

function meetsParamRequirements(state: GameState, project: TerraformProject): boolean {
  if (!project.requiresParams) return true;
  return Object.entries(project.requiresParams).every(
    ([key, min]) => state.globalParams[key as keyof typeof state.globalParams].value >= (min as number),
  );
}

function techUnlocked(state: GameState, project: TerraformProject): boolean {
  return !project.requiresTech || state.researchedTech.includes(project.requiresTech);
}

/** Why a project can't be started right now (or null if it can). */
export function projectBlockedReason(state: GameState, project: TerraformProject): string | null {
  if (!project.repeatable && state.completedProjects.includes(project.id)) return "Already completed";
  if (state.activeProjects.some((a) => a.projectId === project.id)) return "In progress";
  if (!techUnlocked(state, project)) return `Requires tech: ${getTech(project.requiresTech!).name}`;
  if (!meetsParamRequirements(state, project)) return "Planet not ready";
  if (!canAfford(state, project)) return "Insufficient resources";
  return null;
}

/** Projects the player could theoretically pursue (tech + planet gating met). */
export function availableProjects(state: GameState): TerraformProject[] {
  return PROJECTS.filter(
    (p) =>
      (p.repeatable || !state.completedProjects.includes(p.id)) &&
      !state.activeProjects.some((a) => a.projectId === p.id) &&
      techUnlocked(state, p) &&
      meetsParamRequirements(state, p),
  );
}

export function startProject(state: GameState, projectId: string): boolean {
  const project = getProject(projectId);
  if (projectBlockedReason(state, project)) return false;

  const s = state.colony.stocks;
  s.energy -= project.cost.energy ?? 0;
  s.materials -= project.cost.materials ?? 0;
  s.food -= project.cost.food ?? 0;
  s.credits -= project.cost.credits ?? 0;

  const active: ActiveProject = { projectId, turnsRemaining: project.duration };
  state.activeProjects.push(active);
  pushLog(state, "project", `Started "${project.name}" (${project.duration} turns).`);
  return true;
}

/** Apply a completed project's effects to the planet and colony. */
function completeProject(state: GameState, project: TerraformProject): void {
  const faction = getFaction(state.colony.factionId);

  // Risk roll.
  if (project.risk && Math.random() < project.risk.chance) {
    state.colony.stability = Math.max(0, state.colony.stability - 8);
    pushLog(state, "bad", `"${project.name}" failed: ${project.risk.description}`);
    return;
  }

  const changes: string[] = [];
  for (const [key, delta] of Object.entries(project.effects)) {
    const affinity = faction.terraformAffinity[key as keyof typeof faction.terraformAffinity] ?? 1;
    const applied = applyParamDelta(state, key as keyof typeof state.globalParams, delta as number, affinity);
    if (applied) changes.push(`${key} ${applied > 0 ? "+" : ""}${applied}`);
  }

  if (project.productionEffects) {
    for (const [key, delta] of Object.entries(project.productionEffects)) {
      state.colony.production[key as keyof typeof state.colony.production] += delta as number;
    }
  }
  if (project.colonyEffects) {
    for (const [key, delta] of Object.entries(project.colonyEffects)) {
      state.colony.stocks[key as keyof typeof state.colony.stocks] += delta as number;
    }
  }

  // One-shot projects are recorded so they can't be re-run; repeatable levers
  // stay available. Either way they count toward the terraform rating.
  if (!project.repeatable && !state.completedProjects.includes(project.id)) {
    state.completedProjects.push(project.id);
  }
  state.terraformRating += 1;
  // Completing a project reinforces the ideology it embodies.
  nudgeIdeology(state, projectLean(project), 2);
  const detail = changes.length ? ` (${changes.join(", ")})` : "";
  pushLog(state, "good", `"${project.name}" complete${detail}.`);
}

// ---------------------------------------------------------------------------
// Research
// ---------------------------------------------------------------------------

export function canResearch(state: GameState, techId: string): boolean {
  if (state.researchedTech.includes(techId)) return false;
  const tech = getTech(techId);
  return (tech.requires ?? []).every((r) => state.researchedTech.includes(r));
}

export function availableTech(state: GameState) {
  return TECHNOLOGIES.filter((t) => canResearch(state, t.id));
}

export function setResearch(state: GameState, techId: string): boolean {
  if (!canResearch(state, techId)) return false;
  state.currentResearch = { techId, progress: 0 };
  pushLog(state, "info", `Research focus: ${getTech(techId).name}.`);
  return true;
}

// ---------------------------------------------------------------------------
// Social engineering
// ---------------------------------------------------------------------------

/** Change one policy axis. Available once social engineering unlocks (settlement+). */
export function setPolicy(state: GameState, axis: PolicyAxisKey, optionId: string): boolean {
  if (state.phase === "corporate") return false;
  const ax = POLICY_AXIS_BY_KEY[axis];
  const opt = ax?.options.find((o) => o.id === optionId);
  if (!opt) return false;
  if (state.policies[axis] === optionId) return false;
  state.policies[axis] = optionId;
  pushLog(state, "info", `Policy — ${ax.label}: ${opt.label}.`);
  return true;
}

// ---------------------------------------------------------------------------
// Independence endgame
// ---------------------------------------------------------------------------

/** Resolve the independence question. Only in the independence phase, once. */
export function resolveIndependence(state: GameState, outcome: IndependenceOutcome): boolean {
  if (state.phase !== "independence" || state.independenceOutcome || state.gameOver) return false;
  state.independenceOutcome = outcome;

  const endings: Record<IndependenceOutcome, { title: string; detail: string }> = {
    colony: {
      title: "Continued Union",
      detail: "The world remained under Earth's authority — prosperous, and not quite its own.",
    },
    autonomy: {
      title: "Negotiated Autonomy",
      detail: "A charter of self-governance was signed. Earth and the colony, partners at last.",
    },
    independent: {
      title: "Declaration of Independence",
      detail: "The world declared itself sovereign. A new civilization, no longer under Earth's control.",
    },
  };
  const e = endings[outcome];
  // Earth's sentiment reflects the choice.
  state.earth.stance = outcome === "independent" ? -80 : outcome === "autonomy" ? 25 : 65;
  recordChronicle(state, "phase", e.title, e.detail);
  pushLog(state, "good", `${e.title} — ${e.detail}`);
  state.gameOver = "won";
  return true;
}

// ---------------------------------------------------------------------------
// Turn loop
// ---------------------------------------------------------------------------

export function endTurn(state: GameState): void {
  if (state.gameOver) return;

  // 1. Advance active projects; resolve any that finish (production-affecting
  //    projects resolve before the survival tick so their output counts).
  const finished: TerraformProject[] = [];
  for (const active of state.activeProjects) {
    active.turnsRemaining -= 1;
    if (active.turnsRemaining <= 0) finished.push(getProject(active.projectId));
  }
  state.activeProjects = state.activeProjects.filter((a) => a.turnsRemaining > 0);
  for (const project of finished) completeProject(state, project);

  // 2. Recompute habitability now that the planet may have changed.
  state.habitability = computeHabitability(state);

  // 3. Research progress.
  if (state.currentResearch) {
    const tech = getTech(state.currentResearch.techId);
    state.currentResearch.progress += effectiveResearch(state);
    if (state.currentResearch.progress >= tech.cost) {
      state.researchedTech.push(tech.id);
      pushLog(state, "good", `Researched ${tech.name}.`);
      state.currentResearch = undefined;
    }
  }

  // 4. Ideological drift from the policies currently in force.
  applyPolicyIdeologyDrift(state);

  // 5. Economy + life support (incl. policy/ideology/interest-group effects).
  for (const line of runSurvivalTick(state)) pushLog(state, "bad", line);

  // 6. Random hazard.
  const hazardLine = maybeTriggerHazard(state);
  if (hazardLine) pushLog(state, "event", hazardLine);

  // 7. Civilization layer: milestones, breakthroughs, notable people, and the
  //    corporate-to-civilization phase arc.
  for (const line of checkMilestones(state)) pushLog(state, "good", line);
  for (const line of checkBreakthroughs(state)) pushLog(state, "event", line);
  const characterLine = maybeEmergeCharacter(state);
  if (characterLine) pushLog(state, "info", characterLine);
  for (const line of advancePhase(state)) pushLog(state, "good", line);

  // 8. Rival AI + evolving diplomacy (Nemesis-inspired).
  for (const line of rivalTick(state)) pushLog(state, "event", line);

  // 9. The Stillness — the counter-terraforming antagonist. Runs last among
  //    actors so it reacts to this turn's true habitability, and may itself
  //    end the game (a woken world dragged back to silence).
  for (const line of antagonistTick(state)) pushLog(state, "bad", line);

  // 10. Win / loss.
  checkEndConditions(state);

  // 11. Next turn.
  if (!state.gameOver) state.turn += 1;
}

function effectiveResearch(state: GameState): number {
  const faction = getFaction(state.colony.factionId);
  return Math.max(0, state.colony.production.research * (faction.modifiers.research ?? 1));
}

// ---------------------------------------------------------------------------
// Diplomacy (player-facing entry points; logic lives in engine/diplomacy.ts)
// ---------------------------------------------------------------------------

/** Player initiates a diplomatic action toward a rival. */
export function diplomaticAction(
  state: GameState,
  rivalId: string,
  action: DiplomaticAction,
): boolean {
  const msg = applyDiplomaticAction(state, rivalId, action);
  if (msg) pushLog(state, "info", msg);
  return !!msg;
}

/** Player responds to a queued diplomatic overture. */
export function answerDiplomacy(state: GameState, eventId: string, optionId: string): boolean {
  const msg = respondToDiplomacy(state, eventId, optionId);
  if (msg) pushLog(state, "event", msg);
  return !!msg;
}

/** Player acts against (or accommodates) the Stillness. */
export function antagonistAction(state: GameState, action: "strike" | "fund"): boolean {
  const msg = action === "strike" ? strikeStillness(state) : fundStillnessEnclaves(state);
  if (msg) pushLog(state, "info", msg);
  return !!msg;
}

function checkEndConditions(state: GameState): void {
  if (state.gameOver) return;
  if (state.colony.population <= 0) {
    state.gameOver = "lost";
    pushLog(state, "bad", "The last colonist is gone. The colony is dead.");
    return;
  }
  if (state.habitability >= HABITABILITY_WIN) {
    state.gameOver = "won";
    pushLog(state, "good", "The planet is self-sustaining. You made a world.");
  }
}
