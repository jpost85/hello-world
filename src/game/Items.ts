export type ItemKind = "shield" | "parachute";

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  price: number;
  kind: ItemKind;
  /** Amount granted per purchase (shield points, or parachute count). */
  amount: number;
  /** Maximum the tank can stockpile. */
  cap: number;
}

export const ITEMS: ItemDef[] = [
  {
    id: "shield",
    name: "Shield",
    desc: "Absorbs incoming blast damage before your hull takes it.",
    price: 1600,
    kind: "shield",
    amount: 55,
    cap: 165,
  },
  {
    id: "parachute",
    name: "Parachute",
    desc: "Auto-deploys on a long fall to cancel impact damage.",
    price: 700,
    kind: "parachute",
    amount: 1,
    cap: 5,
  },
];

const BY_ID = new Map(ITEMS.map((i) => [i.id, i]));

export function getItem(id: string): ItemDef {
  const it = BY_ID.get(id);
  if (!it) throw new Error(`Unknown item: ${id}`);
  return it;
}
