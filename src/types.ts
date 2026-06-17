export interface Vec2 {
  x: number;
  y: number;
}

export type Difficulty = "easy" | "normal" | "hard";

export type GameState =
  | "menu"
  | "aiming" // human's turn, awaiting input
  | "firing" // projectile(s) in flight
  | "resolving" // explosions settling, applying fall damage
  | "roundover" // shop / results overlay shown
  | "gameover";

export type WeaponKind = "standard" | "mirv" | "dirt";

export interface Weapon {
  id: string;
  name: string;
  desc: string;
  price: number;
  /** Explosion radius in world px. */
  radius: number;
  /** Max damage applied at the centre of the blast. */
  damage: number;
  kind: WeaponKind;
  /** Number of sub-munitions for MIRV warheads. */
  children?: number;
  /** Starting inventory when a new match begins. */
  startCount: number;
  /** Infinite ammo (never decrements, never purchasable). */
  infinite?: boolean;
}
