import type { GameState } from "../types";
import { BREAKTHROUGHS } from "../data/breakthroughs";
import { recordChronicle } from "./chronicle";
import { phaseIndex } from "./phases";

/**
 * Scientific breakthroughs fire once their conditions are met, apply a
 * permanent effect, and enter the historical record. They reshape strategy
 * rather than sit quietly in a tech list.
 */
export function checkBreakthroughs(state: GameState): string[] {
  const logs: string[] = [];
  for (const b of BREAKTHROUGHS) {
    if (state.breakthroughs.includes(b.id)) continue;
    if (b.requiresTech && !state.researchedTech.includes(b.requiresTech)) continue;
    if (b.requiresPhase && phaseIndex(state.phase) < phaseIndex(b.requiresPhase)) continue;
    if (b.requiresHabitability && state.habitability < b.requiresHabitability) continue;

    state.breakthroughs.push(b.id);
    if (b.productionEffects) {
      for (const [k, v] of Object.entries(b.productionEffects)) {
        state.colony.production[k as keyof typeof state.colony.production] += v as number;
      }
    }
    recordChronicle(state, "breakthrough", b.name, b.chronicle);
    logs.push(`Breakthrough — ${b.name}: ${b.description}`);
  }
  return logs;
}
