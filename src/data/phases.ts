import type { GamePhase, PhaseDef } from "../types";

/**
 * The defining arc: a corporate terraforming operation slowly becomes a
 * civilization with its own identity, and finally faces the question of its own
 * sovereignty. Phases advance one-way as milestones are reached
 * (see engine/phases.ts for transition logic).
 */
export const PHASES: PhaseDef[] = [
  {
    key: "corporate",
    name: "Corporate Terraforming",
    tagline: "We are a corporation making a dead world profitable.",
    description:
      "Almost pure engine-building. Raise temperature, build oceans, mine, " +
      "research, optimize finances. Politics barely exist; Earth controls " +
      "everything; the only goal is profit.",
    unlocks: ["Terraforming projects", "Research", "Colony economy"],
  },
  {
    key: "settlement",
    name: "The First Settlers",
    tagline: "Cities stop being income and start being people.",
    description:
      "The planet crosses key thresholds — thin but real air, stable " +
      "agriculture — and colonists arrive in earnest. Population brings " +
      "society: policy, notable individuals, and the first interest groups.",
    unlocks: ["Social engineering", "Notable colonists", "Internal politics"],
  },
  {
    key: "ideological",
    name: "Ideology Emerges",
    tagline: "The society develops not a government type, but a philosophy.",
    description:
      "Years of choices harden into identity. A dominant ideology takes hold " +
      "and grants its own advantages and costs. Diplomacy shifts from " +
      "contracts to competing visions of the planet's future.",
    unlocks: ["Dominant ideology effects", "Ideological diplomacy"],
  },
  {
    key: "independence",
    name: "The Question of Independence",
    tagline: "The world is no longer just a colony.",
    description:
      "A mature civilization confronts Earth. Remain governed, negotiate " +
      "autonomy, or declare independence — each answer writes a different end " +
      "to the planet's first history.",
    unlocks: ["Independence decision", "Earth as a faction"],
  },
];

export const PHASE_BY_KEY: Record<GamePhase, PhaseDef> = Object.fromEntries(
  PHASES.map((p) => [p.key, p]),
) as Record<GamePhase, PhaseDef>;

/** Phase order, for one-way advancement. */
export const PHASE_ORDER: GamePhase[] = ["corporate", "settlement", "ideological", "independence"];
