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
    stats: { attack: 2, defense: 1, maxHealth: 7, speed: 52, size: 1 },
    reward: 12,
    behavior: "flee",
    visual: { color: "#f2c14e", shape: "circle", radius: 9 },
  },
  {
    id: "predatorcell",
    name: "Predator Cell",
    eraId: "era.primordial",
    stats: { attack: 6, defense: 3, maxHealth: 22, speed: 60, size: 2 },
    reward: 28,
    behavior: "hunt",
    appearsAtPoints: 75,
    visual: { color: "#e0683c", shape: "triangle", radius: 12 },
  },
  {
    id: "algae",
    name: "Algae Bloom",
    eraId: "era.primordial",
    stats: { attack: 0, defense: 1, maxHealth: 6, speed: 12, size: 1 },
    reward: 7,
    behavior: "drift",
    visual: { color: "#7cc47c", shape: "rect", radius: 8 },
  },
  {
    id: "stinger",
    name: "Stinger",
    eraId: "era.primordial",
    stats: { attack: 4, defense: 2, maxHealth: 12, speed: 62, size: 1 },
    reward: 18,
    behavior: "hunt",
    appearsAtPoints: 45,
    visual: { color: "#d36fc0", shape: "triangle", radius: 10 },
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
  {
    id: "eel",
    name: "Snapping Eel",
    eraId: "era.fish",
    stats: { attack: 12, defense: 5, maxHealth: 40, speed: 88, size: 3 },
    reward: 50,
    behavior: "hunt",
    appearsAtPoints: 190,
    visual: { color: "#5a7d4a", shape: "triangle", radius: 16 },
  },

  // --- bosses (era gates) ---
  {
    id: "boss.amoeba",
    name: "Elder Amoeba",
    eraId: "era.primordial",
    stats: { attack: 10, defense: 6, maxHealth: 120, speed: 45, size: 3 },
    reward: 60,
    behavior: "hunt",
    visual: { color: "#caa0ff", shape: "circle", radius: 30 },
    isBoss: true,
  },
  {
    id: "boss.leviathan",
    name: "Juvenile Leviathan",
    eraId: "era.fish",
    stats: { attack: 22, defense: 12, maxHealth: 260, speed: 70, size: 5 },
    reward: 140,
    behavior: "hunt",
    visual: { color: "#4f74d0", shape: "triangle", radius: 38 },
    isBoss: true,
  },
];

export const ENEMY_BY_ID: Readonly<Record<string, Enemy>> = Object.freeze(
  Object.fromEntries(ENEMIES.map((e) => [e.id, e])),
);
