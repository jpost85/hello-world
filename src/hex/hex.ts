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

import type { GameState } from "../types";

/** Axial hex coordinate (q, r). Swap for your library's coordinate type. */
export interface HexCoord {
  q: number;
  r: number;
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
