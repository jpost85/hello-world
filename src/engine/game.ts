import type {
  ActiveProject,
  Colony,
  GameState,
  LogEntry,
  LogKind,
  TerraformProject,
} from "../types";
import { getFaction, FACTIONS } from "../data/factions";
import { PROJECTS, getProject } from "../data/projects";
import { TECHNOLOGIES, getTech } from "../data/technologies";
import {
  createGlobalParams,
  computeHabitability,
  applyParamDelta,
} from "./terraforming";
import { runSurvivalTick, computeMaxPopulation } from "./survival";
import { maybeTriggerHazard } from "./events";

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
    // Everyone else is a rival racing to terraform their own patch.
    rivals: FACTIONS.filter((f) => f.id !== factionId).map((f) => ({
      factionId: f.id,
      progress: 0,
    })),
    log: [],
  };

  state.habitability = computeHabitability(state);
  state.colony.maxPopulation = computeMaxPopulation(state);
  pushLog(state, "info", `${faction.name} colony established. Survive, and make this world ours.`);
  return state;
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

  // 4. Economy + life support.
  for (const line of runSurvivalTick(state)) pushLog(state, "bad", line);

  // 5. Random hazard.
  const hazardLine = maybeTriggerHazard(state);
  if (hazardLine) pushLog(state, "event", hazardLine);

  // 6. Rivals inch forward (stub AI).
  advanceRivals(state);

  // 7. Win / loss.
  checkEndConditions(state);

  // 8. Next turn.
  if (!state.gameOver) state.turn += 1;
}

function effectiveResearch(state: GameState): number {
  const faction = getFaction(state.colony.factionId);
  return Math.max(0, state.colony.production.research * (faction.modifiers.research ?? 1));
}

function advanceRivals(state: GameState): void {
  for (const rival of state.rivals) {
    rival.progress += 0.4 + Math.random() * 0.6;
  }
}

function checkEndConditions(state: GameState): void {
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
