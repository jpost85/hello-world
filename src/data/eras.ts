import type { Era } from "../systems/types";

/**
 * Macro progression. Reaching `advanceAtPoints` banked EVO points unlocks the
 * next era and its tougher enemy roster. Only two eras are wired for the
 * prototype; the structure scales to the full Age-of-Fish → Mammal arc.
 */
export const ERAS: Era[] = [
  {
    id: "era.primordial",
    name: "Primordial Soup",
    description: "A single cell in a warm, crowded sea. Eat, or be eaten.",
    enemyIds: ["plankton", "algae", "microbe", "stinger", "predatorcell"],
    advanceAtPoints: 120,
    bossId: "boss.amoeba",
    background: "#0b2a3a",
  },
  {
    id: "era.fish",
    name: "Age of Fish",
    description: "You have a body now. The water is bigger and so are its teeth.",
    enemyIds: ["microbe", "predatorcell", "trilobite", "eel"],
    advanceAtPoints: 320,
    bossId: "boss.leviathan",
    background: "#0a3a44",
  },
];

export const ERA_BY_ID: Readonly<Record<string, Era>> = Object.freeze(
  Object.fromEntries(ERAS.map((e) => [e.id, e])),
);

/** Eras in play order; index drives "what comes next". */
export const ERA_ORDER: string[] = ERAS.map((e) => e.id);
