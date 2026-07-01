import type { Technology } from "../types";

/**
 * A deliberately small tech tree. Each node primarily exists to gate the more
 * powerful terraforming projects (see data/projects.ts, `requiresTech`).
 * Expand this into a proper DAG later; the engine already supports `requires`.
 *
 * Suggested tiers:
 *   Tier 1 (foundational): closed-loop-ecology, orbital-engineering
 *   Tier 2: atmospheric-chemistry, deep-drilling, xeno-botany
 *   Tier 3: planetary-magnetics, self-replication
 */
export const TECHNOLOGIES: Technology[] = [
  {
    id: "closed-loop-ecology",
    name: "Closed-Loop Ecology",
    description: "Sealed recycling that stops the colony bleeding air and water.",
    cost: 30,
  },
  {
    id: "orbital-engineering",
    name: "Orbital Engineering",
    description: "Cheap access to orbit: mirrors, tethers, and impactor capture.",
    cost: 35,
  },
  {
    id: "atmospheric-chemistry",
    name: "Atmospheric Chemistry",
    description: "Industrial greenhouse-gas and nitrogen management.",
    cost: 55,
    requires: ["orbital-engineering"],
  },
  {
    id: "deep-drilling",
    name: "Deep Drilling",
    description: "Tap subsurface heat and frozen aquifers.",
    cost: 55,
    requires: ["closed-loop-ecology"],
  },
  {
    id: "xeno-botany",
    name: "Xeno-Botany",
    description: "Engineered extremophile flora that survive a thin atmosphere.",
    cost: 60,
    requires: ["closed-loop-ecology"],
  },
  {
    id: "planetary-magnetics",
    name: "Planetary Magnetics",
    description: "An artificial magnetosphere to stop the sun stripping the air.",
    cost: 110,
    requires: ["atmospheric-chemistry", "orbital-engineering"],
  },
  {
    id: "self-replication",
    name: "Self-Replicating Systems",
    description: "Von Neumann fabricators that scale industry without labor.",
    cost: 120,
    requires: ["deep-drilling"],
  },
];

export const TECH_BY_ID: Record<string, Technology> = Object.fromEntries(
  TECHNOLOGIES.map((t) => [t.id, t]),
);

export function getTech(id: string): Technology {
  const t = TECH_BY_ID[id];
  if (!t) throw new Error(`Unknown technology: ${id}`);
  return t;
}
