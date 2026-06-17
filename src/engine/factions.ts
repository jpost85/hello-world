/** Faction definitions: a shared pool plus per-map roster resolution. */

import type { Faction } from "./types.ts";

/**
 * Generic, era-neutral factions used by the World and Classic maps (and as a
 * fallback). Kept abstract so those boards aren't tied to a historical period.
 */
export const DEFAULT_FACTIONS: Faction[] = [
  { id: "crimson", name: "Crimson Empire", color: "#d64550" },
  { id: "azure", name: "Azure Coalition", color: "#3d7eb5" },
  { id: "emerald", name: "Emerald Pact", color: "#3fa05a" },
  { id: "amber", name: "Amber Dominion", color: "#e0a526" },
  { id: "violet", name: "Violet Syndicate", color: "#8e6bb0" },
  { id: "slate", name: "Slate Legion", color: "#6b7280" },
];

/**
 * The shared pool of historical great powers. A power keeps one signature colour
 * across every theatre it appears on; era name-variants that share a colour
 * (Prussia/German Empire, Italy/Sardinia) never appear on the same map.
 */
export const GREAT_POWERS: Faction[] = [
  { id: "britain", name: "British Empire", color: "#c0392b" },
  { id: "france", name: "French", color: "#2e5cb8" },
  { id: "russia", name: "Russian Empire", color: "#2e7d4f" },
  { id: "austria", name: "Austrian Empire", color: "#d4a017" },
  { id: "prussia", name: "Prussia", color: "#3a4250" },
  { id: "germany", name: "German Empire", color: "#3a4250" },
  { id: "ottoman", name: "Ottoman Empire", color: "#1597a5" },
  { id: "spain", name: "Spanish", color: "#d99a1c" },
  { id: "portugal", name: "Portuguese", color: "#6b8e23" },
  { id: "netherlands", name: "Dutch", color: "#ef7d00" },
  { id: "italy", name: "Italy", color: "#7cb342" },
  { id: "sardinia", name: "Sardinia", color: "#9ccc4f" },
  { id: "belgium", name: "Belgium", color: "#9b6d3a" },
  { id: "persia", name: "Persia", color: "#8e5ba6" },
  { id: "denmark", name: "Denmark", color: "#b33a3a" },
];

export const FACTION_POOL: Record<string, Faction> = Object.fromEntries(
  GREAT_POWERS.map((f) => [f.id, f]),
);

/**
 * Minor / regional powers — the local sides of the colonial-era theatres. Like
 * the great powers these are identity-only (no gameplay modifiers).
 */
export const MINOR_POWERS: Faction[] = [
  { id: "maratha", name: "Maratha Confederacy", color: "#e8841a" },
  { id: "mysore", name: "Sultanate of Mysore", color: "#7b3fa0" },
  { id: "sikh", name: "Sikh Empire", color: "#f0c419" },
  { id: "mughal", name: "Mughal Empire", color: "#2e8b57" },
  { id: "mamluks", name: "Mamluks", color: "#b89968" },
  { id: "egypt", name: "Khedivate of Egypt", color: "#c0913a" },
  { id: "ethiopia", name: "Ethiopia", color: "#146b3a" },
  { id: "boers", name: "Boer Republics", color: "#8a7a45" },
];

for (const f of MINOR_POWERS) FACTION_POOL[f.id] = f;

/** Neutral fillers for themed maps whose roster is shorter than the player count. */
const FILLERS: Faction[] = [
  { id: "neutral-rose", name: "Rose Coalition", color: "#c2569c" },
  { id: "neutral-cyan", name: "Cyan League", color: "#3bb1bf" },
  { id: "neutral-grey", name: "Grey Company", color: "#9aa3ad" },
];

/**
 * Resolve the factions for a game of `count` players. Themed maps pass their
 * `factionIds` roster (great powers, topped up with neutral fillers if short);
 * maps without a roster (World/Classic) use the generic abstract factions.
 */
export function rosterFor(factionIds: string[] | undefined, count: number): Faction[] {
  if (!factionIds || factionIds.length === 0) return DEFAULT_FACTIONS.slice(0, count);
  const out: Faction[] = [];
  for (const id of factionIds) {
    const f = FACTION_POOL[id];
    if (f) out.push(f);
    if (out.length >= count) break;
  }
  for (const f of FILLERS) {
    if (out.length >= count) break;
    out.push(f);
  }
  return out.slice(0, count);
}

/**
 * Every faction a map can field (for the per-seat picker): its full roster of
 * great/minor powers plus neutral fillers, or the generic factions for maps
 * without a roster. Distinct, in priority order.
 */
export function availableFactions(factionIds: string[] | undefined): Faction[] {
  if (!factionIds || factionIds.length === 0) return DEFAULT_FACTIONS;
  const out: Faction[] = [];
  const seen = new Set<string>();
  for (const id of [...factionIds, ...FILLERS.map((f) => f.id)]) {
    const f = FACTION_POOL[id] ?? FILLERS.find((x) => x.id === id);
    if (f && !seen.has(f.id)) {
      out.push(f);
      seen.add(f.id);
    }
  }
  return out;
}
