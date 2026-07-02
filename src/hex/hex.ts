/**
 * Hex-map integration seam.
 *
 * You already have hex-map infrastructure elsewhere — this file is the
 * boundary where it plugs in. The game engine (src/engine/*) is deliberately
 * map-agnostic: it deals in colonies, resources, and global parameters, not
 * tiles. When you're ready to hook up the real map, implement `HexMapAdapter`
 * with your library and pass it to the UI instead of the placeholder renderer.
 *
 * The stub types below (axial coordinates + a minimal Tile) exist only so the
 * placeholder renderer has something to draw. Replace or delete them once your
 * own coordinate system is wired in.
 */

import type { GameState, HexCoord } from "../types";

/** Axial hex coordinate (q, r) — canonical definition lives in types.ts so the
 *  engine's unit layer can use it without importing the map seam. */
export type { HexCoord } from "../types";

/** Radius of the playable disc in the placeholder map. */
export const MAP_RADIUS = 4;

/** The six axial directions. */
export const HEX_DIRS: ReadonlyArray<HexCoord> = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];

/** Axial hex distance. */
export function hexDistance(a: HexCoord, b: HexCoord): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/** The six neighbors of a coordinate (pure; no map needed). */
export function axialNeighbors(coord: HexCoord): HexCoord[] {
  return HEX_DIRS.map((d) => ({ q: coord.q + d.q, r: coord.r + d.r }));
}

/** All coordinates at exactly `radius` from the origin (the map rim). */
export function ringCoords(radius: number): HexCoord[] {
  const out: HexCoord[] = [];
  let c: HexCoord = { q: -radius, r: radius };
  for (let side = 0; side < 6; side++) {
    for (let i = 0; i < radius; i++) {
      out.push({ ...c });
      c = { q: c.q + HEX_DIRS[side].q, r: c.r + HEX_DIRS[side].r };
    }
  }
  return out;
}

/** Terrain/feature a tile can hold. Extend to match your world model. */
export type TileTerrain =
  | "rock"
  | "regolith"
  | "ice"
  | "water"
  | "vegetation"
  | "colony";

export interface Tile {
  coord: HexCoord;
  terrain: TileTerrain;
  /** Optional: a colony/structure sitting on this tile. */
  ownerFactionId?: string;
}

/**
 * The contract the rest of the app relies on. Your existing infrastructure
 * should be adaptable to these few methods; nothing here assumes a particular
 * rendering or storage strategy.
 */
export interface HexMapAdapter {
  /** All tiles in the current map. */
  getTiles(): Tile[];
  /** Neighbors of a coordinate (for adjacency rules, spread of vegetation…). */
  neighbors(coord: HexCoord): HexCoord[];
  /**
   * Render the map for the given game state. Terraforming progress can be
   * reflected here (e.g. tint tiles by temperature, spread water/vegetation as
   * the hydrosphere and biomass rise).
   */
  render(state: GameState): void;
  /** Wire a click handler for tile selection, build orders, etc. */
  onTileClick(handler: (coord: HexCoord) => void): void;
}

// ---------------------------------------------------------------------------
// Throwaway sample map so the placeholder renderer has data to draw.
// ---------------------------------------------------------------------------

/** Generate a small hex-disc of tiles centered on the origin. */
export function makeSampleTiles(radius = 4): Tile[] {
  const tiles: Tile[] = [];
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      const dist = (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
      let terrain: TileTerrain = "regolith";
      if (dist > radius - 1) terrain = "rock";
      if (q === 0 && r === 0) terrain = "colony";
      tiles.push({ coord: { q, r }, terrain });
    }
  }
  return tiles;
}
