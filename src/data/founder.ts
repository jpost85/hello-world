import type {
  ColonyStocks,
  Faction,
  FounderProfile,
  GlobalParamKey,
  IdeologyAxis,
  PolicySelection,
  Production,
  ProductionModifiers,
} from "../types";

/**
 * Founder design — the game's opening move.
 *
 * Instead of locking into a pre-made faction, the player composes a founder
 * from three choices:
 *
 *   1. BACKGROUND  — who the founder is (economic identity, small lean)
 *   2. LEADERSHIP  — how the expedition is governed (arrival policy posture,
 *                    stability, medium lean)
 *   3. DOCTRINE    — why it colonizes (the big ideology seed + terraform
 *                    affinity — your relationship to the world itself)
 *
 * The choices compose into a custom Faction; the six canned factions all
 * become rivals. Ideology still *emerges* over the game — the founder only
 * plants the seed the society grows from (or against).
 */

export interface FounderOption {
  id: string;
  name: string;
  blurb: string;
  /** Human-readable effect list for the UI. */
  effects: string[];
  modifiers?: ProductionModifiers;
  /** Additive to the balanced base. */
  stocks?: Partial<ColonyStocks>;
  production?: Partial<Production>;
  stabilityDelta?: number;
  ideologySeed?: Partial<Record<IdeologyAxis, number>>;
  policies?: Partial<PolicySelection>;
  affinity?: Partial<Record<GlobalParamKey, number>>;
  resilience?: number;
  /** Character trait id (data/characters.ts) the founder carries. */
  traitId?: string;
  /** Accent color; the doctrine's color wins. */
  color?: string;
}

// --- 1. Background: who is the founder? ------------------------------------

export const BACKGROUNDS: FounderOption[] = [
  {
    id: "executive",
    name: "Corporate Executive",
    blurb: "Cut their teeth flipping orbital ventures. The expedition is an investment.",
    effects: ["+40 starting credits", "+15% credits"],
    stocks: { credits: 40 },
    modifiers: { credits: 1.15 },
    ideologySeed: { industrialist: 2 },
    traitId: "publishes",
  },
  {
    id: "scientist",
    name: "Chief Scientist",
    blurb: "Wrote the terraforming feasibility study everyone else quotes.",
    effects: ["+20% research", "+1 research/turn"],
    modifiers: { research: 1.2 },
    production: { research: 1 },
    ideologySeed: { technocratic: 2 },
    traitId: "visionary",
  },
  {
    id: "governor",
    name: "Military Governor",
    blurb: "Ran a lunar penal habitat through three blowouts without losing a soul.",
    effects: ["+10% materials", "Hardened: -20% hazard casualties"],
    modifiers: { materials: 1.1 },
    resilience: 0.8,
    ideologySeed: { militarist: 2 },
    traitId: "hardliner",
  },
  {
    id: "organizer",
    name: "Civic Organizer",
    blurb: "Built the dockworker cooperatives that fed three stations through the embargo.",
    effects: ["+10% food", "+8 starting stability"],
    modifiers: { food: 1.1 },
    stabilityDelta: 8,
    ideologySeed: { humanist: 2 },
    traitId: "humanitarian",
  },
];

// --- 2. Leadership: how is the expedition governed? -------------------------

export const LEADERSHIPS: FounderOption[] = [
  {
    id: "charter-corp",
    name: "Charter Corporation",
    blurb: "A board, shareholders, and quarterly targets. Efficient, and cold.",
    effects: ["+10% credits", "-3 stability", "Arrives under Corporate Rule + Free Market"],
    modifiers: { credits: 1.1 },
    stabilityDelta: -3,
    ideologySeed: { industrialist: 3 },
    policies: { society: "corporate", economy: "free-market" },
  },
  {
    id: "expedition-command",
    name: "Expedition Command",
    blurb: "A clear chain of command, drilled for the worst day of everyone's life.",
    effects: ["+10% materials", "Arrives under Martial Administration"],
    modifiers: { materials: 1.1 },
    ideologySeed: { militarist: 3 },
    policies: { security: "martial", economy: "planned" },
  },
  {
    id: "founding-council",
    name: "Founding Council",
    blurb: "Every dome gets a voice. Slower — and nobody riots against themselves.",
    effects: ["+8 stability", "Arrives under Democracy + Civil Liberties"],
    stabilityDelta: 8,
    ideologySeed: { humanist: 3 },
    policies: { society: "democracy", security: "liberties" },
  },
  {
    id: "directorate",
    name: "Research Directorate",
    blurb: "The credentialed decide. Optimal on paper; brittle when the paper burns.",
    effects: ["+15% research", "-2 stability", "Arrives under Technocracy + Open Research"],
    modifiers: { research: 1.15 },
    stabilityDelta: -2,
    ideologySeed: { technocratic: 3 },
    policies: { society: "technocracy", science: "open" },
  },
];

// --- 3. Doctrine: why colonize? ---------------------------------------------

export const DOCTRINES: FounderOption[] = [
  {
    id: "ecopoiesis",
    name: "Ecopoiesis",
    blurb: "Become native to the world. Don't cage it — grow into it.",
    effects: ["Biosphere/hydrosphere projects +", "+10% food", "-10% materials"],
    modifiers: { food: 1.1, materials: 0.9 },
    ideologySeed: { ecological: 8 },
    affinity: { biomass: 1.4, hydrosphere: 1.25 },
    traitId: "green",
    color: "#4caf7d",
  },
  {
    id: "dominion",
    name: "Dominion",
    blurb: "The planet is raw material. Tame it, plate it, put it to work.",
    effects: ["Thermal/atmosphere projects +", "+15% materials", "-5% food"],
    modifiers: { materials: 1.15, food: 0.95 },
    ideologySeed: { industrialist: 8 },
    affinity: { temperature: 1.25, pressure: 1.2 },
    traitId: "industrialist",
    color: "#e0a63a",
  },
  {
    id: "sanctuary",
    name: "Sanctuary",
    blurb: "Keep everyone alive. Everything else is commentary.",
    effects: ["+15% food", "+5 stability", "-5% research"],
    modifiers: { food: 1.15, research: 0.95 },
    stabilityDelta: 5,
    ideologySeed: { humanist: 8 },
    traitId: "humanitarian",
    color: "#9b7fd4",
  },
  {
    id: "ascension",
    name: "Ascension",
    blurb: "The colony is a laboratory; the species is the experiment.",
    effects: ["+20% research", "Oxygen projects +", "-5% credits"],
    modifiers: { research: 1.2, credits: 0.95 },
    ideologySeed: { technocratic: 8 },
    affinity: { oxygen: 1.15 },
    traitId: "visionary",
    color: "#5b8dd6",
  },
  {
    id: "vigil",
    name: "Vigil",
    blurb: "The dark is full of things that end colonies. Build the wall first.",
    effects: ["+10% materials", "Hardened: -30% hazard casualties"],
    modifiers: { materials: 1.1 },
    resilience: 0.7,
    ideologySeed: { militarist: 8 },
    traitId: "hardliner",
    color: "#c65b4e",
  },
];

export const FOUNDER_OPTION_SETS = [
  { key: "backgroundId" as const, title: "Background", question: "Who leads the expedition?", options: BACKGROUNDS },
  { key: "leadershipId" as const, title: "Leadership", question: "How is it governed?", options: LEADERSHIPS },
  { key: "doctrineId" as const, title: "Doctrine", question: "Why colonize at all?", options: DOCTRINES },
];

// --- Name pools ---------------------------------------------------------------

export const FOUNDER_NAMES = [
  "Adaeze Kirin", "Marcus Voss", "Ilya Renata", "Tomasz Adeyemi", "Sable Marchand",
  "Rin Okabe", "Cassian Holt", "Amara Ekwueme", "Dario Lengyel", "Yusra Nadir",
];

export const COLONY_NAMES = [
  "First Light", "Meridian", "New Providence", "Halcyon", "Argent Reach",
  "Kestrel Station", "Cinder Gate", "Aphelion Base", "Vantage", "Solace",
];

/** The player-built faction id (never collides with canned factions). */
export const FOUNDER_FACTION_ID = "founders-charter";

// --- Composition ---------------------------------------------------------------

function findOption(pool: FounderOption[], id: string): FounderOption {
  const o = pool.find((x) => x.id === id);
  if (!o) throw new Error(`Unknown founder option: ${id}`);
  return o;
}

/** Compose the three choices into a playable custom Faction. */
export function buildFounderFaction(profile: FounderProfile): Faction {
  const picks = [
    findOption(BACKGROUNDS, profile.backgroundId),
    findOption(LEADERSHIPS, profile.leadershipId),
    findOption(DOCTRINES, profile.doctrineId),
  ];
  const doctrine = picks[2];

  // Balanced base (Terran-Union-ish), then the choices layer on.
  const stocks: ColonyStocks = { energy: 55, materials: 55, food: 55, credits: 70 };
  const production: Production = { energy: 7, materials: 6, food: 7, credits: 6, research: 6 };
  const modifiers: ProductionModifiers = {};
  const ideologySeed: Partial<Record<IdeologyAxis, number>> = {};
  const affinity: Partial<Record<GlobalParamKey, number>> = {};
  const policies: Partial<PolicySelection> = {};
  let stabilityDelta = 0;
  let resilience = 1;

  const PROD_KEYS = ["energy", "materials", "food", "credits", "research"] as const;
  for (const pick of picks) {
    if (pick.modifiers) {
      for (const k of PROD_KEYS) {
        if (pick.modifiers[k] !== undefined) modifiers[k] = (modifiers[k] ?? 1) * pick.modifiers[k]!;
      }
    }
    if (pick.stocks) for (const [k, v] of Object.entries(pick.stocks)) stocks[k as keyof ColonyStocks] += v as number;
    if (pick.production) for (const [k, v] of Object.entries(pick.production)) production[k as keyof Production] += v as number;
    if (pick.ideologySeed) for (const [k, v] of Object.entries(pick.ideologySeed)) {
      const key = k as IdeologyAxis;
      ideologySeed[key] = (ideologySeed[key] ?? 0) + (v as number);
    }
    if (pick.affinity) for (const [k, v] of Object.entries(pick.affinity)) {
      const key = k as GlobalParamKey;
      affinity[key] = Math.max(affinity[key] ?? 1, v as number);
    }
    if (pick.policies) Object.assign(policies, pick.policies);
    stabilityDelta += pick.stabilityDelta ?? 0;
    resilience = Math.min(resilience, pick.resilience ?? 1);
  }

  return {
    id: FOUNDER_FACTION_ID,
    name: profile.colonyName,
    leader: profile.name,
    agenda: `${doctrine.name} — ${doctrine.blurb}`,
    blurb: `A founding charter composed by ${profile.name}.`,
    color: doctrine.color ?? "#5b8dd6",
    modifiers,
    bonuses: picks.flatMap((p) => p.effects),
    startingStocks: stocks,
    startingProduction: production,
    special: `Founder's Charter: ${picks.map((p) => p.name).join(" · ")}.`,
    terraformAffinity: affinity,
    resilience: resilience < 1 ? resilience : undefined,
    ideologySeed,
    startingPolicies: policies,
    startingStabilityDelta: stabilityDelta,
  };
}
