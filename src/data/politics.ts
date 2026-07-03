import type { InterestGroup, InterestGroupDef, InterestGroupKey } from "../types";

/**
 * Internal interest groups. As the colony grows into a society, these factions
 * form and start making demands (via policy `groups` deltas in data/policies.ts).
 * Keep them roughly content or unrest drags down stability
 * (see engine/politics.ts).
 */
export const INTEREST_GROUPS: InterestGroupDef[] = [
  {
    key: "scientists",
    name: "Scientific Community",
    wants: "Research funding and academic freedom.",
  },
  {
    key: "workers",
    name: "Labor Unions",
    wants: "Jobs, civil liberties, a fair share.",
  },
  {
    key: "environmentalists",
    name: "Ecological Movement",
    wants: "A protected biosphere over raw extraction.",
  },
  {
    key: "security",
    name: "Security Apparatus",
    wants: "Authority, defense budgets, order.",
  },
  {
    key: "shareholders",
    name: "Corporate Shareholders",
    wants: "Profit, markets, return on investment.",
  },
];

export const GROUP_BY_KEY: Record<InterestGroupKey, InterestGroupDef> = Object.fromEntries(
  INTEREST_GROUPS.map((g) => [g.key, g]),
) as Record<InterestGroupKey, InterestGroupDef>;

export function initialInterestGroups(): InterestGroup[] {
  // Everyone starts moderately content; policy choices move them from here.
  return INTEREST_GROUPS.map((g) => ({ key: g.key, satisfaction: 60 }));
}
