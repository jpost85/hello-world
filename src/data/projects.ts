import type { TerraformProject } from "../types";

/**
 * The terraforming project catalog — the heart of the game loop.
 *
 * Each project spends stocks now, ticks down over `duration` turns, then lands
 * its `effects` on the global planetary parameters (and optionally changes the
 * colony's economy). Projects gate on tech and/or on the planet already being
 * far enough along (`requiresParams`) so there's a natural tech-and-terraform
 * progression: warm the world -> thicken the air -> add water -> seed life.
 *
 * Categories map to the five global dials in engine/terraforming.ts.
 */
export const PROJECTS: TerraformProject[] = [
  // --- Thermal: warming the planet ------------------------------------------
  {
    id: "orbital-mirrors",
    name: "Orbital Mirror Array",
    category: "thermal",
    description:
      "A constellation of reflectors focuses sunlight on the poles, nudging " +
      "global temperature upward. Cheap, fast, foundational.",
    cost: { materials: 30, energy: 40 },
    duration: 3,
    repeatable: true,
    effects: { temperature: 8 },
    requiresTech: "orbital-engineering",
  },
  {
    id: "thermal-boreholes",
    name: "Geothermal Boreholes",
    category: "thermal",
    description:
      "Deep shafts vent planetary heat and drive turbines — warming the crust " +
      "while boosting energy output. The energy boost is permanent.",
    cost: { materials: 60, energy: 20 },
    duration: 4,
    repeatable: true,
    effects: { temperature: 10 },
    productionEffects: { energy: 4 },
    requiresTech: "deep-drilling",
  },

  // --- Atmosphere: pressure & oxygen ----------------------------------------
  {
    id: "ghg-factories",
    name: "Greenhouse-Gas Factories",
    category: "atmosphere",
    description:
      "Fluorinated-gas plants trap heat and thicken the air, raising both " +
      "temperature and pressure. The classic terraforming workhorse.",
    cost: { materials: 45, energy: 55 },
    duration: 5,
    repeatable: true,
    effects: { temperature: 5, pressure: 9 },
    requiresTech: "atmospheric-chemistry",
    requiresParams: { temperature: -20 },
  },
  {
    id: "nitrogen-import",
    name: "Nitrogen Sky-Freight",
    category: "atmosphere",
    description:
      "Redirected ammonia-rich bodies bleed nitrogen into the atmosphere, " +
      "building the inert buffer a breathable mix needs.",
    cost: { materials: 40, energy: 60, credits: 40 },
    duration: 5,
    repeatable: true,
    effects: { pressure: 14 },
    requiresTech: "orbital-engineering",
    risk: {
      chance: 0.15,
      description: "A capture burn misfires and the payload is lost.",
    },
  },
  {
    id: "magnetic-shield",
    name: "Planetary Magnetic Shield",
    category: "atmosphere",
    description:
      "An orbital dynamo generates an artificial magnetosphere, ending " +
      "atmospheric stripping and locking in every future gain. A mega-project.",
    cost: { materials: 120, energy: 160, credits: 120 },
    duration: 9,
    effects: { pressure: 6, oxygen: 2 },
    productionEffects: { research: 3 },
    requiresTech: "planetary-magnetics",
    requiresParams: { pressure: 20 },
    ideologyLean: "militarist",
  },

  // --- Hydrosphere: liquid water --------------------------------------------
  {
    id: "comet-redirect",
    name: "Cometary Redirect",
    category: "hydrosphere",
    description:
      "Nudge an icy body into a controlled impact. Massive water and pressure " +
      "gains — if the trajectory holds.",
    cost: { materials: 50, energy: 90, credits: 60 },
    duration: 6,
    repeatable: true,
    effects: { hydrosphere: 16, pressure: 7, temperature: -2 },
    requiresTech: "orbital-engineering",
    risk: {
      chance: 0.25,
      description: "The impactor fragments off-target; quakes rattle the colony.",
    },
  },
  {
    id: "aquifer-tap",
    name: "Deep Aquifer Tapping",
    category: "hydrosphere",
    description:
      "Pumps liberate frozen subsurface water into surface basins, seeding " +
      "the first true oceans and shoring up colony water.",
    cost: { materials: 55, energy: 45 },
    duration: 5,
    repeatable: true,
    effects: { hydrosphere: 10 },
    productionEffects: { food: 3 },
    requiresTech: "deep-drilling",
    requiresParams: { temperature: -10 },
  },

  // --- Biosphere: oxygen & life ---------------------------------------------
  {
    id: "cyanobacteria",
    name: "Cyanobacterial Seeding",
    category: "biosphere",
    description:
      "Engineered microbes bloom across new shallows, exhaling oxygen and the " +
      "first flicker of a living world. Needs water to work.",
    cost: { materials: 25, energy: 30 },
    duration: 6,
    repeatable: true,
    effects: { oxygen: 8, biomass: 7 },
    requiresTech: "xeno-botany",
    requiresParams: { hydrosphere: 10, temperature: -5 },
  },
  {
    id: "engineered-forests",
    name: "Engineered Forests",
    category: "biosphere",
    description:
      "Fast-growing extremophile canopies lock carbon, pump oxygen, and feed " +
      "the colony. The payoff project of a maturing biosphere.",
    cost: { materials: 40, energy: 40, credits: 30 },
    duration: 7,
    repeatable: true,
    effects: { oxygen: 9, biomass: 12, temperature: 1 },
    productionEffects: { food: 5, credits: 2 },
    requiresTech: "xeno-botany",
    requiresParams: { hydrosphere: 20, oxygen: 5, temperature: 0 },
  },

  // --- Infrastructure: colony economy, minimal planetary effect -------------
  {
    id: "fusion-grid",
    name: "Fusion Power Grid",
    category: "infrastructure",
    description:
      "A backbone reactor network. Little terraforming value directly, but the " +
      "energy surplus powers everything that does.",
    cost: { materials: 70, credits: 40 },
    duration: 4,
    effects: {},
    productionEffects: { energy: 10 },
  },
  {
    id: "autofab-swarm",
    name: "Self-Replicating Fabricators",
    category: "infrastructure",
    description:
      "Autonomous fabricator swarms compound your industry, multiplying " +
      "materials output for every project that follows.",
    cost: { materials: 90, energy: 80 },
    duration: 6,
    effects: {},
    productionEffects: { materials: 8, research: 2 },
    requiresTech: "self-replication",
  },
];

export const PROJECTS_BY_ID: Record<string, TerraformProject> = Object.fromEntries(
  PROJECTS.map((p) => [p.id, p]),
);

export function getProject(id: string): TerraformProject {
  const p = PROJECTS_BY_ID[id];
  if (!p) throw new Error(`Unknown project: ${id}`);
  return p;
}
