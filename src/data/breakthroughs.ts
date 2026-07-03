import type { Breakthrough } from "../types";

/**
 * Scientific breakthroughs as world events. Rather than living only in the tech
 * tree, these fire once their conditions are met and permanently change the
 * game — a discovery everyone (eventually) has to reckon with. Each writes a
 * line into the planet's history.
 */
export const BREAKTHROUGHS: Breakthrough[] = [
  {
    id: "fusion-ignition",
    name: "Fusion Ignition",
    description: "Sustained net-positive fusion. Cheap, clean, abundant power.",
    requiresTech: "deep-drilling",
    productionEffects: { energy: 6 },
    chronicle: "The first sustained fusion burn ended the colony's energy scarcity forever.",
  },
  {
    id: "artificial-photosynthesis",
    name: "Artificial Photosynthesis",
    description: "Engineered carbon fixation accelerates the living planet.",
    requiresTech: "xeno-botany",
    productionEffects: { food: 4 },
    chronicle: "Artificial photosynthesis turned barren regolith into farmland at scale.",
  },
  {
    id: "carbon-nanotubes",
    name: "Carbon Nanotube Manufacturing",
    description: "Ultralight megastructures; construction costs plummet.",
    requiresTech: "self-replication",
    productionEffects: { materials: 6 },
    chronicle: "Nanotube fabrication made orbital-scale construction routine.",
  },
  {
    id: "ai-governance",
    name: "Practical AI Governance",
    description: "Machine administration of infrastructure and logistics.",
    requiresPhase: "ideological",
    requiresHabitability: 45,
    productionEffects: { research: 4, credits: 3 },
    chronicle: "Delegating logistics to governance AIs reshaped how the colony was run — and who ran it.",
  },
  {
    id: "quantum-comms",
    name: "Quantum Communications",
    description: "Instantaneous, unbreakable links across the system.",
    requiresPhase: "settlement",
    requiresHabitability: 30,
    productionEffects: { research: 3, credits: 2 },
    chronicle: "Quantum relays severed the colony's dependence on Earth's information networks.",
  },
];
