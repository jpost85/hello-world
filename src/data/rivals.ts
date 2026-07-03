import type { IdeologyAxis, RivalTrait, RivalTraitDef, DiplomaticStance } from "../types";

/**
 * Each faction's dominant ideological leaning — mirrors the ideology seeds in
 * engine/game.ts. Used to compute whether a rival aligns with or opposes the
 * direction your society is heading.
 */
export const FACTION_LEAN: Record<string, IdeologyAxis> = {
  "verdant-compact": "ecological",
  "helion-consortium": "industrialist",
  "iron-vanguard": "militarist",
  "cognitum": "technocratic",
  "terran-union": "humanist",
  "ouroboros-cradle": "humanist",
};

/**
 * Rival personality data. Traits drive behavior (see engine/diplomacy.ts):
 * how fast grudges form, whether debts are repaid, when a rival turns on you,
 * how quickly they gain power. Each rival gets two traits.
 */
export const RIVAL_TRAITS: RivalTraitDef[] = [
  { id: "vengeful", label: "Vengeful", description: "Never forgets a slight; grudges fester and rarely fade." },
  { id: "honorable", label: "Honorable", description: "Repays debts and keeps pacts; forgives with time." },
  { id: "opportunist", label: "Opportunist", description: "Warm when you are strong, treacherous when you are weak." },
  { id: "paranoid", label: "Paranoid", description: "Suspicious by nature; slow to trust, quick to feel wronged." },
  { id: "expansionist", label: "Expansionist", description: "Grows power aggressively and resents any who outpace them." },
  { id: "cunning", label: "Cunning", description: "Prefers sabotage and leverage to open confrontation." },
  { id: "ruthless", label: "Ruthless", description: "Strikes hard and preys on the weak." },
  { id: "stoic", label: "Stoic", description: "Even-tempered; disposition changes slowly." },
  { id: "zealous", label: "Zealous", description: "Ideology is everything — loves the aligned, despises the opposed." },
  { id: "pragmatic", label: "Pragmatic", description: "Moved by material interest, not ideology or sentiment." },
];

export const TRAIT_BY_ID: Record<RivalTrait, RivalTraitDef> = Object.fromEntries(
  RIVAL_TRAITS.map((t) => [t.id, t]),
) as Record<RivalTrait, RivalTraitDef>;

/** Epithets a rival can earn, keyed by the flavor of their standing with you. */
export const NEMESIS_EPITHETS = [
  "the Unforgiving", "the Betrayed", "Who Waits", "the Vengeful",
  "the Scarred", "the Relentless", "Oathbreaker's Bane", "the Implacable",
];
export const HEGEMON_TITLES = [
  "Hegemon of the Belt", "First Among Worlds", "the Ascendant", "Dominus of the Reach",
];
export const ALLY_TITLES = ["the Steadfast", "Old Friend", "the Loyal", "Partner of the Dawn"];

/** Successor leader names, drawn on when a fallen faction produces a new leader. */
export const SUCCESSOR_NAMES = [
  "Corwin Vale", "Ines Marchetti", "Bastien Kollár", "Ophelia Ranganathan",
  "Dmitri Abara", "Seline Voss", "Hadrian Okoye", "Marisol Fenn",
  "Terrence Bao", "Anja Sørensen", "Rafael Dumont", "Petra Nawaz",
];

/**
 * Which ideological leanings are natural opposites. Used to compute whether a
 * rival warms to you or sours based on where your society is heading.
 */
export const IDEOLOGY_OPPOSITION: Record<string, string> = {
  ecological: "industrialist",
  industrialist: "ecological",
  militarist: "humanist",
  humanist: "militarist",
};

/** Human-readable stance labels for the UI. */
export const STANCE_LABEL: Record<DiplomaticStance, string> = {
  nemesis: "Nemesis",
  adversary: "Adversary",
  rival: "Rival",
  competitor: "Competitor",
  partner: "Partner",
  ally: "Ally",
};
