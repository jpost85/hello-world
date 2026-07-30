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

export type WeaponKind =
  | "standard"
  | "mirv" // splits into warheads at the apex
  | "dirt" // adds terrain instead of removing it
  | "roller" // lands, then flows downhill until it hits something
  | "tunneler" // burrows through terrain before detonating
  | "napalm" // spills burning fire that flows downhill
  | "airburst"; // splits into a downward fan just above the ground

/** How the left/right edges of the battlefield behave. */
export type WallMode = "open" | "wrap" | "bounce" | "concrete";

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
  /** Number of sub-munitions for MIRV / airburst warheads. */
  children?: number;
  /** Height above the terrain at which an airburst splits. */
  fuseHeight?: number;
  /** How far a roller may travel (world px) before it gives up and blows. */
  rollDistance?: number;
  /** How deep a tunneler burrows (world px) before detonating. */
  digDistance?: number;
  /** Number of fire blobs a napalm shell spills. */
  fireCount?: number;
  /** Starting inventory when a new match begins. */
  startCount: number;
  /** Infinite ammo (never decrements, never purchasable). */
  infinite?: boolean;
}
