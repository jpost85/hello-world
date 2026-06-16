/** Default selectable factions. Cosmetic today; a hook for traits/bonuses later. */

import type { Faction } from "./types.ts";

export const DEFAULT_FACTIONS: Faction[] = [
  { id: "crimson", name: "Crimson Empire", color: "#d64550" },
  { id: "azure", name: "Azure Coalition", color: "#3d7eb5" },
  { id: "emerald", name: "Emerald Pact", color: "#3fa05a" },
  { id: "amber", name: "Amber Dominion", color: "#e0a526" },
  { id: "violet", name: "Violet Syndicate", color: "#8e6bb0" },
  { id: "slate", name: "Slate Legion", color: "#6b7280" },
];
