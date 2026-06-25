// Map data — struct-of-arrays, the only representation the SIM uses.
// See DESIGN.md §3. Step-1 scaffold only populates `tiles`; edges/cover/ramps
// are allocated now so later steps don't reshape the data.

export const enum TileType {
  Empty = 0,
  Grass = 1,
  Road = 2,
  Pavement = 3,
  Water = 4,
}

export interface MapData {
  width: number;
  height: number;
  levels: number;
  tiles: Uint16Array;
  edges: Uint8Array; // wall/edge-blocking bitmask (DESIGN.md §3)
  cover: Uint8Array;
  ramps: Uint8Array; // vertical connectivity (DESIGN.md §5.2)
}

/** Flat index into the struct-of-arrays: z-major, then row, then col. */
export function idx(map: MapData, col: number, row: number, z = 0): number {
  return z * (map.width * map.height) + row * map.width + col;
}

export function inBounds(map: MapData, col: number, row: number, z = 0): boolean {
  return (
    col >= 0 &&
    row >= 0 &&
    z >= 0 &&
    col < map.width &&
    row < map.height &&
    z < map.levels
  );
}

export function tileAt(map: MapData, col: number, row: number, z = 0): TileType {
  return map.tiles[idx(map, col, row, z)] as TileType;
}

/** Generate a small placeholder city block for the prototype. */
export function makeDemoMap(width = 24, height = 24, levels = 4): MapData {
  const cells = width * height * levels;
  const map: MapData = {
    width,
    height,
    levels,
    tiles: new Uint16Array(cells),
    edges: new Uint8Array(cells),
    cover: new Uint8Array(cells),
    ramps: new Uint8Array(cells),
  };

  // Ground level: a couple of roads crossing pavement/grass, with a water patch.
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      let t: TileType = TileType.Grass;
      if (col === 8 || col === 9 || row === 14 || row === 15) t = TileType.Road;
      else if (col < 7 && row < 7) t = TileType.Pavement;
      else if (col >= 18 && row >= 18) t = TileType.Water;
      map.tiles[idx(map, col, row, 0)] = t;
    }
  }

  return map;
}
