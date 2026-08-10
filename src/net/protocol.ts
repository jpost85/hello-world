import type { WallMode } from "../types";

/** Bump when the wire format or sim rules change incompatibly. */
export const NET_VERSION = 1;

/** Online matches run in a fixed world so both players see the same field. */
export const NET_WORLD_W = 1280;
export const NET_WORLD_H = 720;

export interface SnapTank {
  id: number;
  x: number;
  y: number;
  health: number;
  shield: number;
  parachutes: number;
  cash: number;
  score: number;
  alive: boolean;
  angle: number;
  power: number;
  /** Inventory with Infinity encoded as -1 (JSON-safe). */
  inv: Record<string, number>;
}

export interface Snapshot {
  round: number;
  wind: number;
  startingPlayer: number;
  tanks: SnapTank[];
  /** Terrain surface heights, rounded to 0.1 px. */
  terrain: number[];
  fires: {
    x: number;
    y: number;
    vx: number;
    life: number;
    maxLife: number;
    r: number;
    ownerId: number;
  }[];
}

export type Msg =
  | { t: "hello"; v: number; name: string }
  | {
      t: "start";
      v: number;
      seed: number;
      hostName: string;
      guestName: string;
      rounds: number;
      wallMode: WallMode;
    }
  | { t: "aim"; angle: number; power: number }
  | { t: "fire"; angle: number; power: number; weaponId: string }
  | { t: "buy"; id: string; item: boolean }
  | { t: "shopDone" }
  | { t: "turnStart"; turnIndex: number; snap: Snapshot }
  | { t: "roundOver"; winnerId: number | null; snap: Snapshot }
  | { t: "matchEnd"; winnerId: number | null; snap: Snapshot }
  | { t: "bye" };

/** Minimal transport the match logic needs; PeerLink and tests implement it. */
export interface Link {
  send(m: Msg): void;
  onMessage: ((m: Msg) => void) | null;
  onClosed: (() => void) | null;
  close(): void;
}
