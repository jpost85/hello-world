import type { Enemy } from "../systems/types";

/**
 * Prey and predators, as data. `reward` is the EVO-point payout for eating one;
 * keep it roughly proportional to the enemy's total stats so the economy stays
 * balanced (see EconomySystem).
 */
export const ENEMIES: Enemy[] = [
  {
    id: "plankton",
    name: "Plankton",
    eraId: "era.primordial",
    stats: { attack: 0, defense: 0, maxHealth: 4, speed: 30, size: 1 },
    reward: 5,
    behavior: "drift",
    visual: { color: "#a8e6a1", shape: "circle", radius: 6 },
  },
  {
    id: "microbe",
    name: "Hungry Microbe",
    eraId: "era.primordial",
    stats: { attack: 3, defense: 1, maxHealth: 10, speed: 55, size: 1 },
    reward: 12,
    behavior: "flee",
    visual: { color: "#f2c14e", shape: "circle", radius: 9 },
  },
  {
    id: "predatorcell",
    name: "Predator Cell",
    eraId: "era.primordial",
    stats: { attack: 8, defense: 3, maxHealth: 22, speed: 70, size: 2 },
    reward: 28,
    behavior: "hunt",
    visual: { color: "#e0683c", shape: "triangle", radius: 12 },
  },
  {
    id: "trilobite",
    name: "Trilobite",
    eraId: "era.fish",
    stats: { attack: 6, defense: 9, maxHealth: 30, speed: 50, size: 2 },
    reward: 35,
    behavior: "flee",
    visual: { color: "#9c6b3f", shape: "rect", radius: 14 },
  },
];

export const ENEMY_BY_ID: Readonly<Record<string, Enemy>> = Object.freeze(
  Object.fromEntries(ENEMIES.map((e) => [e.id, e])),
);
