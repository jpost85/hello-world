import type { IdeologyAxis, IdeologyDef } from "../types";

/**
 * The five ideological leanings a society can drift toward. Unlike Alpha
 * Centauri's fixed factions, ideology here is *emergent*: it accumulates from
 * the projects you build, the policies you run, and the people who rise
 * (see engine/ideology.ts). Once a leaning dominates, it grants the effects
 * below — the personality of your civilization made mechanical.
 */
export const IDEOLOGIES: IdeologyDef[] = [
  {
    key: "technocratic",
    name: "Technocratic",
    blurb: "Research and automation govern everything; expertise is authority.",
    advantages: ["Faster innovation", "Superior automation"],
    disadvantages: ["Public unrest", "Environmental neglect"],
    modifiers: { research: 1.3, materials: 1.1, food: 0.9 },
    stability: -1,
  },
  {
    key: "ecological",
    name: "Ecological",
    blurb: "Terraform gently; the living planet is the point, not the profit.",
    advantages: ["Thriving biosphere", "High citizen contentment"],
    disadvantages: ["Slower heavy industry"],
    modifiers: { food: 1.25, materials: 0.85 },
    stability: 2,
  },
  {
    key: "industrialist",
    name: "Industrialist",
    blurb: "Maximum production, gigantic cities, and the pollution to match.",
    advantages: ["Economic powerhouse", "Rapid construction"],
    disadvantages: ["Environmental backlash", "Restive workforce"],
    modifiers: { materials: 1.3, credits: 1.15, food: 0.9 },
    stability: -1,
  },
  {
    key: "militarist",
    name: "Militarist",
    blurb: "Security and deterrence above all; the frontier is dangerous.",
    advantages: ["Hazard resilience", "Orbital defense"],
    disadvantages: ["Strained civil society", "Costly upkeep"],
    modifiers: { materials: 1.15, credits: 0.95, research: 0.95 },
    stability: 1,
  },
  {
    key: "humanist",
    name: "Humanist",
    blurb: "Welfare, education, art, medicine — the long, stable growth.",
    advantages: ["High stability", "Strong population growth"],
    disadvantages: ["Less raw output"],
    modifiers: { credits: 1.05, materials: 0.95 },
    stability: 3,
  },
];

export const IDEOLOGY_BY_KEY: Record<IdeologyAxis, IdeologyDef> = Object.fromEntries(
  IDEOLOGIES.map((i) => [i.key, i]),
) as Record<IdeologyAxis, IdeologyDef>;

export function emptyIdeologyVector(): Record<IdeologyAxis, number> {
  return { technocratic: 0, ecological: 0, industrialist: 0, militarist: 0, humanist: 0 };
}
