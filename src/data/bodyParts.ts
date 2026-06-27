import type { BodyPart } from "../systems/types";

/**
 * The evolution tree, expressed as data.
 *
 * Each slot starts at a tier-1 "starter" part and branches upward. To add a new
 * mutation you add an entry here and wire it into some `evolvesTo` array — no
 * system code changes. Costs and stat mods are the primary balance knobs.
 */
export const BODY_PARTS: BodyPart[] = [
  // --- body (always present; defines core size/health) ---
  {
    id: "body.cell",
    slot: "body",
    name: "Single Cell",
    tier: 1,
    statMods: { maxHealth: 10, size: 1, speed: 60 },
    cost: 0,
    evolvesTo: ["body.colony"],
    visual: { color: "#7fd1c4", shape: "circle" },
  },
  {
    id: "body.colony",
    slot: "body",
    name: "Cell Colony",
    tier: 2,
    statMods: { maxHealth: 25, size: 2, speed: 70 },
    cost: 40,
    evolvesTo: ["body.fish"],
    visual: { color: "#5fb8ab", shape: "circle" },
  },
  {
    id: "body.fish",
    slot: "body",
    name: "Finned Body",
    tier: 3,
    statMods: { maxHealth: 50, size: 3, speed: 90 },
    cost: 120,
    evolvesTo: [],
    visual: { color: "#4a9aa0", shape: "triangle" },
  },

  // --- mouth (primary attack source) ---
  {
    id: "mouth.none",
    slot: "mouth",
    name: "No Mouth",
    tier: 0,
    statMods: { attack: 1 },
    cost: 0,
    evolvesTo: ["mouth.maw"],
    visual: { color: "#888888", shape: "circle" },
  },
  {
    id: "mouth.maw",
    slot: "mouth",
    name: "Engulfing Maw",
    tier: 1,
    statMods: { attack: 6 },
    cost: 30,
    evolvesTo: ["mouth.jaw"],
    visual: { color: "#e0683c", shape: "triangle" },
  },
  {
    id: "mouth.jaw",
    slot: "mouth",
    name: "Bony Jaw",
    tier: 2,
    statMods: { attack: 14 },
    cost: 90,
    evolvesTo: [],
    visual: { color: "#d24a28", shape: "triangle" },
  },

  // --- fins (speed / traversal) ---
  {
    id: "fins.flagella",
    slot: "fins",
    name: "Flagella",
    tier: 1,
    statMods: { speed: 15 },
    cost: 20,
    evolvesTo: ["fins.pectoral"],
    visual: { color: "#9ecae1", shape: "rect" },
  },
  {
    id: "fins.pectoral",
    slot: "fins",
    name: "Pectoral Fins",
    tier: 2,
    statMods: { speed: 40, defense: 2 },
    cost: 70,
    evolvesTo: [],
    visual: { color: "#6baed6", shape: "rect" },
  },

  // --- armor (defense) ---
  {
    id: "armor.membrane",
    slot: "armor",
    name: "Tough Membrane",
    tier: 1,
    statMods: { defense: 4, maxHealth: 10 },
    cost: 35,
    evolvesTo: ["armor.scales"],
    visual: { color: "#bdbdbd", shape: "circle" },
  },
  {
    id: "armor.scales",
    slot: "armor",
    name: "Scales",
    tier: 2,
    statMods: { defense: 10, maxHealth: 25 },
    cost: 100,
    evolvesTo: [],
    visual: { color: "#969696", shape: "rect" },
  },
];

/** Fast id lookup used across systems. */
export const PART_BY_ID: Readonly<Record<string, BodyPart>> = Object.freeze(
  Object.fromEntries(BODY_PARTS.map((p) => [p.id, p])),
);
