// Coordinate conversions — the single seam between SIM (grid) and RENDER (pixels).
// See DESIGN.md §2. Logic must never use world/screen pixels; only this module
// and the render layer touch them.

export const TILE_W = 64; // diamond width
export const TILE_H = 32; // diamond height (= TILE_W / 2, the 2:1 iso ratio)
export const TILE_Z = 24; // vertical pixels per height level

export interface GridCoord {
  col: number;
  row: number;
  z: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

/** Grid cell -> world pixel. Anchor = top vertex of the tile diamond. */
export function gridToWorld(col: number, row: number, z = 0): Vec2 {
  return {
    x: (col - row) * (TILE_W / 2),
    y: (col + row) * (TILE_H / 2) - z * TILE_Z,
  };
}

/**
 * World pixel -> grid cell at a KNOWN z plane.
 * Multi-level picking (DESIGN.md §5.5) tests candidate planes top-down using
 * this primitive.
 */
export function worldToGrid(wx: number, wy: number, z = 0): GridCoord {
  const y = wy + z * TILE_Z;
  const col = (wx / (TILE_W / 2) + y / (TILE_H / 2)) / 2;
  const row = (y / (TILE_H / 2) - wx / (TILE_W / 2)) / 2;
  return { col: Math.floor(col), row: Math.floor(row), z };
}
