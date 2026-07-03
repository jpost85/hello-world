import type { ChronicleCategory, GameState } from "../types";

/**
 * History as a first-class mechanic. The rolling event log (engine/game.ts) is
 * ephemeral chatter; the chronicle is the planet's permanent record — the
 * landmark moments that, in the full vision, would persist across campaigns on
 * the same Mars. Everything worth remembering routes through `recordChronicle`.
 */
export function recordChronicle(
  state: GameState,
  category: ChronicleCategory,
  title: string,
  detail: string,
): void {
  state.chronicle.push({ turn: state.turn, phase: state.phase, category, title, detail });
}

/** One-time planetary milestones. Each fires a permanent history entry once. */
const MILESTONES: {
  flag: string;
  test: (s: GameState) => boolean;
  title: string;
  detail: string;
}[] = [
  {
    flag: "firstWarmth",
    test: (s) => s.globalParams.temperature.value >= 0,
    title: "The Thaw",
    detail: "Mean surface temperature rose above freezing for the first time.",
  },
  {
    flag: "firstOcean",
    test: (s) => s.globalParams.hydrosphere.value >= 15,
    title: "The First Ocean",
    detail: "Liquid water pooled into the planet's first true sea.",
  },
  {
    flag: "firstBreath",
    test: (s) => s.globalParams.oxygen.value >= 10 && s.globalParams.pressure.value >= 30,
    title: "First Breath",
    detail: "The atmosphere thickened enough, with enough oxygen, to sustain unaided life outdoors — briefly.",
  },
  {
    flag: "firstForest",
    test: (s) => s.globalParams.biomass.value >= 20,
    title: "The First Forest",
    detail: "Engineered woodland took root and spread on its own.",
  },
  {
    flag: "livingWorld",
    test: (s) => s.habitability >= 60,
    title: "A Living World",
    detail: "The planet crossed into broad habitability — self-sustaining ecosystems, weather, seasons.",
  },
];

/** Detect and record any newly-reached milestones. Returns log lines. */
export function checkMilestones(state: GameState): string[] {
  const logs: string[] = [];
  for (const m of MILESTONES) {
    if (!state.milestones[m.flag] && m.test(state)) {
      state.milestones[m.flag] = true;
      recordChronicle(state, "milestone", m.title, m.detail);
      logs.push(`Milestone — ${m.title}: ${m.detail}`);
    }
  }
  return logs;
}
