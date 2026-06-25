import { TileType } from "../map.js";

// Placeholder palette — colored diamonds until real art lands (DESIGN.md §13).
export const TILE_COLORS: Record<TileType, number> = {
  [TileType.Empty]: 0x14141c,
  [TileType.Grass]: 0x2f5d3a,
  [TileType.Road]: 0x3a3a42,
  [TileType.Pavement]: 0x6b6b73,
  [TileType.Water]: 0x244a6b,
};

export const TILE_TOP_TINT = 0x101018; // edge line color
export const HOVER_FILL = 0xffe07a;
