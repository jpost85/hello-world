import type { PolicyAxis, PolicyAxisKey, PolicySelection } from "../types";

/**
 * Dynamic Social Engineering. Five independent policy axes; each option tunes
 * the colony's economy, morale, ideological drift, and which interest groups
 * it pleases or angers. Policies unlock in the Settlement phase — before
 * there's a society, there's nothing to engineer.
 *
 * Effects are intentionally trade-offs: there is no strictly-best row. The
 * `leanings` push emergent ideology; the `groups` deltas feed internal
 * politics (engine/politics.ts).
 */
export const POLICY_AXES: PolicyAxis[] = [
  {
    key: "economy",
    label: "Economy",
    description: "How production and wealth are organized.",
    defaultOption: "cooperative",
    options: [
      {
        id: "free-market",
        label: "Free Market",
        description: "Maximum credits and growth; inequality strains morale.",
        modifiers: { credits: 1.25, research: 1.05 },
        stability: -2,
        leanings: { industrialist: 2, technocratic: 1 },
        groups: { shareholders: 3, workers: -2, environmentalists: -1 },
      },
      {
        id: "cooperative",
        label: "Cooperative",
        description: "Shared ownership; steadier and happier, less lucrative.",
        modifiers: { credits: 0.95, food: 1.1 },
        stability: 2,
        leanings: { humanist: 2 },
        groups: { workers: 3, shareholders: -2 },
      },
      {
        id: "planned",
        label: "Planned Economy",
        description: "Directed output favors materials over innovation.",
        modifiers: { materials: 1.2, research: 0.9 },
        leanings: { industrialist: 1, militarist: 1 },
        groups: { workers: 2, shareholders: -1 },
      },
      {
        id: "automated",
        label: "Automated Economy",
        description: "Machines do the work — efficient, but who is it for?",
        modifiers: { materials: 1.15, research: 1.15, food: 0.95 },
        stability: -1,
        leanings: { technocratic: 3 },
        groups: { scientists: 2, workers: -3, shareholders: 2 },
      },
    ],
  },
  {
    key: "society",
    label: "Society",
    description: "Where legitimacy and decision-making sit.",
    defaultOption: "corporate",
    options: [
      {
        id: "meritocracy",
        label: "Meritocracy",
        description: "Advancement by ability; rewards research and output.",
        modifiers: { research: 1.15, materials: 1.05 },
        leanings: { technocratic: 2 },
        groups: { scientists: 2, workers: -1 },
      },
      {
        id: "democracy",
        label: "Democracy",
        description: "Broad enfranchisement; stable but slower to act.",
        modifiers: { credits: 1.05 },
        stability: 3,
        leanings: { humanist: 2 },
        groups: { workers: 2, environmentalists: 1, shareholders: -1 },
      },
      {
        id: "corporate",
        label: "Corporate Rule",
        description: "The board decides. Profit is efficient; consent is optional.",
        modifiers: { credits: 1.2, materials: 1.05 },
        stability: -1,
        leanings: { industrialist: 2 },
        groups: { shareholders: 3, workers: -2 },
      },
      {
        id: "technocracy",
        label: "Technocracy",
        description: "Experts govern. Optimal on paper, brittle in practice.",
        modifiers: { research: 1.2 },
        stability: -1,
        leanings: { technocratic: 3 },
        groups: { scientists: 3, workers: -1 },
      },
    ],
  },
  {
    key: "science",
    label: "Science",
    description: "What research is oriented toward.",
    defaultOption: "open",
    options: [
      {
        id: "open",
        label: "Open Research",
        description: "Freely shared science compounds fastest.",
        modifiers: { research: 1.2 },
        leanings: { technocratic: 1, humanist: 1 },
        groups: { scientists: 3, shareholders: -1 },
      },
      {
        id: "military",
        label: "Military Research",
        description: "Defense-directed R&D; resilient but insular.",
        modifiers: { research: 1.05, materials: 1.1 },
        leanings: { militarist: 3 },
        groups: { security: 3, scientists: -1 },
      },
      {
        id: "commercial",
        label: "Commercial Innovation",
        description: "Patents and products; research pays its own way.",
        modifiers: { research: 1.05, credits: 1.15 },
        leanings: { industrialist: 2 },
        groups: { shareholders: 2, scientists: -1 },
      },
      {
        id: "academic",
        label: "Academic Freedom",
        description: "Curiosity-driven and content, if less directed.",
        modifiers: { research: 1.1 },
        stability: 2,
        leanings: { humanist: 1, technocratic: 1 },
        groups: { scientists: 2 },
      },
    ],
  },
  {
    key: "environment",
    label: "Environment",
    description: "How hard the planet is pushed.",
    defaultOption: "balanced",
    options: [
      {
        id: "preservation",
        label: "Preservation",
        description: "Protect native systems; the biosphere flourishes.",
        modifiers: { food: 1.2, materials: 0.85 },
        stability: 1,
        leanings: { ecological: 3 },
        groups: { environmentalists: 3, shareholders: -2 },
      },
      {
        id: "balanced",
        label: "Balanced",
        description: "A pragmatic middle path.",
        modifiers: {},
        leanings: { humanist: 1 },
        groups: {},
      },
      {
        id: "industrial",
        label: "Industrial Expansion",
        description: "Extract now, apologize later. Output soars; nature suffers.",
        modifiers: { materials: 1.25, credits: 1.05, food: 0.85 },
        stability: -2,
        leanings: { industrialist: 3 },
        groups: { shareholders: 2, workers: 1, environmentalists: -4 },
      },
    ],
  },
  {
    key: "security",
    label: "Security",
    description: "The balance between liberty and control.",
    defaultOption: "liberties",
    options: [
      {
        id: "liberties",
        label: "Civil Liberties",
        description: "Freedom breeds contentment and creativity.",
        modifiers: { research: 1.05 },
        stability: 2,
        leanings: { humanist: 2 },
        groups: { workers: 2, security: -2 },
      },
      {
        id: "surveillance",
        label: "Surveillance",
        description: "Order through observation; safe, and a little cold.",
        modifiers: { credits: 1.05 },
        leanings: { technocratic: 1, militarist: 1 },
        groups: { security: 3, workers: -2, environmentalists: -1 },
      },
      {
        id: "martial",
        label: "Martial Administration",
        description: "Hard security. The colony endures; the people chafe.",
        modifiers: { materials: 1.1 },
        stability: -2,
        leanings: { militarist: 3 },
        groups: { security: 4, workers: -3 },
      },
    ],
  },
];

export const POLICY_AXIS_BY_KEY: Record<PolicyAxisKey, PolicyAxis> = Object.fromEntries(
  POLICY_AXES.map((a) => [a.key, a]),
) as Record<PolicyAxisKey, PolicyAxis>;

export function defaultPolicySelection(): PolicySelection {
  return Object.fromEntries(
    POLICY_AXES.map((a) => [a.key, a.defaultOption]),
  ) as PolicySelection;
}

export function getPolicyOption(axisKey: PolicyAxisKey, optionId: string) {
  const axis = POLICY_AXIS_BY_KEY[axisKey];
  const opt = axis.options.find((o) => o.id === optionId);
  if (!opt) throw new Error(`Unknown policy option ${axisKey}/${optionId}`);
  return opt;
}
