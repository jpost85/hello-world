import type { CharacterTrait } from "../types";

/**
 * Notable colonists. Instead of "Population +1", milestones occasionally throw
 * up a named individual with traits — a scientist, a governor, an agitator.
 * Some carry a small mechanical effect and an ideological leaning, so the
 * people who rise gradually shape the society's identity
 * (see engine/characters.ts for generation).
 *
 * These pools are intentionally small and swappable; expand freely.
 */

export const FIRST_NAMES = [
  "Elena", "Kofi", "Mira", "Tomas", "Aiko", "Rashid", "Nadia", "Wei",
  "Sela", "Diego", "Anouk", "Idris", "Priya", "Lars", "Yuki", "Amara",
  "Cyrus", "Freya", "Tariq", "Lucia",
];

export const SURNAMES = [
  "Kovács", "Mensah", "Okafor", "Vance", "Sato", "Haddad", "Reyes", "Zhou",
  "Moon", "Bauer", "Nakamura", "Okonkwo", "Ivanov", "Santos", "Farouk",
  "Lindqvist", "Aguilar", "Bello", "Novak", "Chen",
];

export const ROLES = [
  "Astrobiologist",
  "Chief Engineer",
  "Colony Governor",
  "Labor Organizer",
  "Xeno-Ecologist",
  "Reactor Physicist",
  "Security Marshal",
  "Corporate Liaison",
  "Public Health Director",
  "Orbital Architect",
];

/** Traits carry flavor and, sometimes, a small permanent effect + leaning. */
export const TRAITS: CharacterTrait[] = [
  {
    id: "visionary",
    label: "Visionary",
    effect: "Inspires researchers; permanent +1 research.",
    production: { research: 1 },
    leaning: "technocratic",
  },
  {
    id: "industrialist",
    label: "Industrial Baron",
    effect: "Drives production; permanent +1 materials.",
    production: { materials: 1 },
    leaning: "industrialist",
  },
  {
    id: "green",
    label: "Environmentalist",
    effect: "Champions the biosphere; permanent +1 food.",
    production: { food: 1 },
    leaning: "ecological",
  },
  {
    id: "humanitarian",
    label: "Humanitarian",
    effect: "Beloved by the colony; represents humanist values.",
    leaning: "humanist",
  },
  {
    id: "hardliner",
    label: "Hardliner",
    effect: "Demands security and order.",
    leaning: "militarist",
  },
  {
    id: "agitator",
    label: "Agitator",
    effect: "A thorn in leadership's side — and a voice for the unheard.",
    leaning: "humanist",
  },
  {
    id: "publishes",
    label: "Prolific",
    effect: "Publishes breakthroughs; permanent +1 credits.",
    production: { credits: 1 },
  },
];
