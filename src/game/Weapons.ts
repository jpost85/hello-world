import type { Weapon } from "../types";

/**
 * Data-driven arsenal. Adding a weapon is just another entry here — the shop,
 * AI, and firing code all read from this catalogue.
 */
export const WEAPONS: Weapon[] = [
  {
    id: "baby",
    name: "Baby Missile",
    desc: "Reliable, infinite ammo. Small blast.",
    price: 0,
    radius: 26,
    damage: 22,
    kind: "standard",
    startCount: Infinity,
    infinite: true,
  },
  {
    id: "missile",
    name: "Missile",
    desc: "Bigger crater, solid damage.",
    price: 1800,
    radius: 40,
    damage: 38,
    kind: "standard",
    startCount: 5,
  },
  {
    id: "funky",
    name: "Funky Bomb",
    desc: "Wide, messy blast. Reshapes terrain.",
    price: 4000,
    radius: 62,
    damage: 55,
    kind: "standard",
    startCount: 0,
  },
  {
    id: "nuke",
    name: "Nuke",
    desc: "Enormous radius, devastating.",
    price: 9000,
    radius: 95,
    damage: 90,
    kind: "standard",
    startCount: 0,
  },
  {
    id: "mirv",
    name: "MIRV",
    desc: "Splits into 5 warheads at the apex.",
    price: 7500,
    radius: 34,
    damage: 30,
    kind: "mirv",
    children: 5,
    startCount: 0,
  },
  {
    id: "dirt",
    name: "Dirt Clod",
    desc: "Adds terrain — bury foes or rebuild cover.",
    price: 1200,
    radius: 50,
    damage: 0,
    kind: "dirt",
    startCount: 2,
  },
  {
    id: "roller",
    name: "Roller",
    desc: "Lands and rolls downhill — perfect for foes hiding in valleys.",
    price: 2600,
    radius: 42,
    damage: 42,
    kind: "roller",
    rollDistance: 620,
    startCount: 2,
  },
  {
    id: "tunneler",
    name: "Tunneler",
    desc: "Burrows through terrain, then erupts. Digs out dug-in tanks.",
    price: 3400,
    radius: 46,
    damage: 48,
    kind: "tunneler",
    digDistance: 150,
    startCount: 0,
  },
  {
    id: "napalm",
    name: "Napalm",
    desc: "Spills burning fire that pours downhill and clings.",
    price: 5200,
    radius: 30,
    damage: 18,
    kind: "napalm",
    fireCount: 14,
    startCount: 0,
  },
  {
    id: "airburst",
    name: "Airburst",
    desc: "Splits into a raking fan of bomblets just above the ground.",
    price: 6200,
    radius: 30,
    damage: 26,
    kind: "airburst",
    children: 6,
    fuseHeight: 130,
    startCount: 0,
  },
];

const BY_ID = new Map(WEAPONS.map((w) => [w.id, w]));

export function getWeapon(id: string): Weapon {
  const w = BY_ID.get(id);
  if (!w) throw new Error(`Unknown weapon: ${id}`);
  return w;
}

/** Weapons that can be bought in the shop (have a price, not infinite). */
export const PURCHASABLE = WEAPONS.filter((w) => !w.infinite && w.price > 0);
