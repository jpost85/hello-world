/**
 * Treasures of the era and the helpers that apply them. Items are static
 * definitions held by officers (`Officer.items` stores ids); a holder's
 * *effective* stats are their base stats plus the sum of their items' bonuses.
 * Traits are innate and queried directly.
 */
import type { Item, Officer, OfficerTrait } from "./types.ts";

/** The treasure catalogue. Famed weapons, horses, and strategy texts. */
export const ITEMS: Item[] = [
  { id: "red-hare", name: "Red Hare", kind: "horse", war: 5, leadership: 4 },
  { id: "green-dragon", name: "Green Dragon Blade", kind: "weapon", war: 6 },
  { id: "serpent-spear", name: "Serpent Spear", kind: "weapon", war: 5 },
  { id: "sky-piercer", name: "Sky Piercer", kind: "weapon", war: 6, leadership: 2 },
  { id: "shadow-runner", name: "Shadow Runner", kind: "horse", war: 3, leadership: 3 },
  { id: "art-of-war", name: "Sun Tzu's Art of War", kind: "book", intellect: 6, leadership: 3 },
  { id: "mengde-xinshu", name: "Mengde's New Book", kind: "book", intellect: 5, politics: 3 },
  { id: "seven-star", name: "Seven Star Blade", kind: "treasure", war: 2, charisma: 4 },
];

const BY_ID = new Map(ITEMS.map((i) => [i.id, i]));

export function getItem(id: string): Item | undefined {
  return BY_ID.get(id);
}

/** Officer stats after their carried items are applied. */
export interface EffectiveStats {
  war: number;
  intellect: number;
  politics: number;
  charisma: number;
  leadership: number;
}

const clamp100 = (n: number) => Math.max(1, Math.min(120, n));

/** Compute an officer's effective stats (base + item bonuses). */
export function effectiveStats(officer: Officer): EffectiveStats {
  const s: EffectiveStats = {
    war: officer.war,
    intellect: officer.intellect,
    politics: officer.politics,
    charisma: officer.charisma,
    leadership: officer.leadership,
  };
  for (const id of officer.items) {
    const it = BY_ID.get(id);
    if (!it) continue;
    s.war += it.war ?? 0;
    s.intellect += it.intellect ?? 0;
    s.politics += it.politics ?? 0;
    s.charisma += it.charisma ?? 0;
    s.leadership += it.leadership ?? 0;
  }
  s.war = clamp100(s.war);
  s.intellect = clamp100(s.intellect);
  s.politics = clamp100(s.politics);
  s.charisma = clamp100(s.charisma);
  s.leadership = clamp100(s.leadership);
  return s;
}

export function hasTrait(officer: Officer | undefined, trait: OfficerTrait): boolean {
  return !!officer && officer.traits.includes(trait);
}
