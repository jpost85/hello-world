import type { GamePhase, GameState } from "../types";
import { PHASE_BY_KEY, PHASE_ORDER } from "../data/phases";
import { recordChronicle } from "./chronicle";
import { maybeEmergeCharacter } from "./characters";

/**
 * The one-way phase arc. Each turn we test whether the colony has grown enough
 * to cross into the next phase; crossings are landmark history and unlock whole
 * subsystems (social engineering, ideology effects, the independence decision).
 */

/** Has the colony met the bar to leave its current phase? */
function readyToAdvance(state: GameState, to: GamePhase): boolean {
  const pop = state.colony.population;
  // Gates use habitability (a broad measure of planetary progress across all
  // five dials) plus population, so any terraforming strategy can advance —
  // the arc shouldn't hinge on one specific parameter.
  switch (to) {
    case "settlement":
      // A thawing, marginally livable world: settlers arrive in earnest.
      return state.habitability >= 12;
    case "ideological":
      // A society large and settled enough to develop a genuine identity.
      return state.habitability >= 28 && pop >= 25;
    case "independence":
      // A mature civilization that could plausibly stand on its own.
      return state.habitability >= 50 && pop >= 40;
    default:
      return false;
  }
}

export function phaseIndex(phase: GamePhase): number {
  return PHASE_ORDER.indexOf(phase);
}

/** Advance the phase if the colony qualifies. Returns log lines. */
export function advancePhase(state: GameState): string[] {
  const logs: string[] = [];
  const idx = phaseIndex(state.phase);
  const next = PHASE_ORDER[idx + 1];
  if (!next || !readyToAdvance(state, next)) return logs;

  state.phase = next;
  const def = PHASE_BY_KEY[next];
  recordChronicle(state, "phase", def.name, def.tagline);
  logs.push(`A new era begins — ${def.name}: ${def.tagline}`);

  // Phase-entry effects.
  if (next === "settlement") {
    // The first wave of settlers brings notable individuals and a population bump.
    state.colony.population += 6;
    const line = maybeEmergeCharacter(state, true);
    if (line) logs.push(line);
  }
  if (next === "independence") {
    // Earth starts paying real attention.
    state.earthRelations = Math.min(state.earthRelations, 55);
  }
  return logs;
}
