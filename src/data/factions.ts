import type { Faction } from "../types";

/**
 * Playable factions. Each is a distinct survival + terraforming strategy,
 * blending Alpha Centauri's ideological factions with Terraforming Mars'
 * corporate archetypes.
 *
 * Design levers per faction:
 *  - modifiers: multiply base production (economy identity)
 *  - startingStocks / startingProduction: opening tempo
 *  - terraformAffinity: which planetary dial they push fastest
 *  - special: the signature ability (currently flavor; wire into engine later)
 *
 * Balance note: these numbers are first-pass and meant to be tuned. Keep the
 * sum of a faction's advantages roughly matched by its weaknesses.
 */
export const FACTIONS: Faction[] = [
  {
    id: "verdant-compact",
    name: "The Verdant Compact",
    leader: "Arbiter Sela Moon",
    agenda: "Ecopoiesis — the planet is the colony.",
    blurb:
      "Gene-priests and soil-wrights who believe survival means becoming " +
      "native to the world rather than caging it in domes. They terraform " +
      "the biosphere faster than anyone but industrialize slowly.",
    color: "#4caf7d",
    modifiers: { materials: 0.8, research: 1.1, food: 1.25 },
    bonuses: [
      "+25% food production",
      "Biosphere & hydrosphere projects are far more effective",
      "-20% materials output",
    ],
    startingStocks: { energy: 40, materials: 30, food: 60, credits: 50 },
    startingProduction: { energy: 6, materials: 4, food: 8, credits: 4, research: 5 },
    special:
      "Living Soil: biomass gains from projects are amplified and passively " +
      "raise the colony's max population.",
    terraformAffinity: { biomass: 1.5, hydrosphere: 1.3, oxygen: 1.2 },
  },
  {
    id: "helion-consortium",
    name: "Helion Consortium",
    leader: "Director Kael Ndiaye",
    agenda: "Terraforming is a market, and markets clear.",
    blurb:
      "A corporate hegemony that treats a dead planet as an undervalued " +
      "asset. Cash-rich and energy-rich, but its people are shareholders, " +
      "not citizens — morale is always one bad quarter from collapse.",
    color: "#e0a63a",
    modifiers: { credits: 1.4, energy: 1.2, food: 0.9 },
    bonuses: [
      "+40% credits, +20% energy",
      "Large starting treasury",
      "Lower baseline stability",
    ],
    startingStocks: { energy: 70, materials: 40, food: 55, credits: 140 },
    startingProduction: { energy: 9, materials: 5, food: 6, credits: 10, research: 4 },
    special:
      "Leverage: may rush-buy the remaining duration of a project with credits.",
    terraformAffinity: { pressure: 1.2, temperature: 1.1 },
  },
  {
    id: "iron-vanguard",
    name: "The Iron Vanguard",
    leader: "Marshal Voss Karr",
    agenda: "Discipline is life support.",
    blurb:
      "A militarized industrial order forged in the early die-offs. They " +
      "out-build every rival and shrug off disasters, but disdain pure " +
      "science and burn through the biosphere.",
    color: "#c65b4e",
    modifiers: { materials: 1.35, research: 0.8, energy: 1.05 },
    bonuses: [
      "+35% materials production",
      "Colony resists population loss from disasters",
      "-20% research",
    ],
    startingStocks: { energy: 50, materials: 90, food: 45, credits: 40 },
    startingProduction: { energy: 7, materials: 10, food: 5, credits: 4, research: 3 },
    special:
      "Hardened: hazard casualties and stability hits are halved.",
    terraformAffinity: { temperature: 1.3, pressure: 1.2, biomass: 0.7 },
  },
  {
    id: "cognitum",
    name: "Cognitum Ascendancy",
    leader: "Prime Analyst Iyari-9",
    agenda: "Knowledge first; the body is a temporary constraint.",
    blurb:
      "A research collective bordering on machine-cult. They unlock the tech " +
      "tree at breakneck speed, but their thin, over-specialized colonies are " +
      "brittle when the reactors falter.",
    color: "#5b8dd6",
    modifiers: { research: 1.5, credits: 1.05, food: 0.85 },
    bonuses: [
      "+50% research output",
      "Cheaper high-tier terraforming tech",
      "Fragile: harsher penalties when life support fails",
    ],
    startingStocks: { energy: 55, materials: 35, food: 55, credits: 60 },
    startingProduction: { energy: 6, materials: 4, food: 6, credits: 5, research: 9 },
    special:
      "Foresight: sees the next incoming hazard one turn early (UI hook).",
    terraformAffinity: { oxygen: 1.2, biomass: 1.1 },
  },
  {
    id: "terran-union",
    name: "New Terran Union",
    leader: "Chancellor Mira Okonkwo",
    agenda: "Keep everyone alive. Everything else follows.",
    blurb:
      "The closest thing to old Earth's humanism — a balanced, resilient " +
      "colony that excels at nothing and fails at nothing. The forgiving " +
      "faction for learning the systems.",
    color: "#9b7fd4",
    modifiers: {},
    bonuses: [
      "Balanced production across the board",
      "+ Faster population growth and higher stability",
      "No glaring weaknesses",
    ],
    startingStocks: { energy: 55, materials: 55, food: 55, credits: 70 },
    startingProduction: { energy: 7, materials: 6, food: 7, credits: 6, research: 6 },
    special:
      "Solidarity: population grows faster and stability recovers each turn.",
    terraformAffinity: {},
  },
  {
    id: "ouroboros-cradle",
    name: "Cradle of Ouroboros",
    leader: "Elder-Custodian Tamsin Reyes",
    agenda: "We endure the dark so our children inherit the dawn.",
    blurb:
      "Survivalist ascetics who mastered scarcity. They need less to live and " +
      "weather the deadliest events, but their suspicion of grand science " +
      "leaves them terraforming the hard, slow way.",
    color: "#b0855b",
    modifiers: { food: 1.15, research: 0.85, credits: 0.9 },
    bonuses: [
      "Population consumes less food and energy",
      "Weathers hazards with minimal losses",
      "Slower research and weaker economy",
    ],
    startingStocks: { energy: 45, materials: 50, food: 70, credits: 45 },
    startingProduction: { energy: 6, materials: 6, food: 7, credits: 4, research: 4 },
    special:
      "Rationing: per-capita life-support demand is reduced by ~25%.",
    terraformAffinity: { hydrosphere: 1.1, biomass: 1.1 },
  },
];

export const FACTIONS_BY_ID: Record<string, Faction> = Object.fromEntries(
  FACTIONS.map((f) => [f.id, f]),
);

export function getFaction(id: string): Faction {
  const f = FACTIONS_BY_ID[id];
  if (!f) throw new Error(`Unknown faction: ${id}`);
  return f;
}
