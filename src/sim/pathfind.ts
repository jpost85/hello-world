// A* over the grid. Step 2 pathfinds on the ground plane (z=0); the z-aware
// `ramps` neighbors (DESIGN.md §5.2) plug into `neighbors()` in step 3.
// Tie-breaking is by cell index so paths are deterministic (DESIGN.md §6.2).

import {
  idx,
  inBounds,
  tileAt,
  TileType,
  type MapData,
} from "../map.js";

export interface Cell {
  col: number;
  row: number;
  z: number;
}

const SQRT2 = 1.4142135623730951;

export function isWalkable(map: MapData, col: number, row: number, z = 0): boolean {
  if (!inBounds(map, col, row, z)) return false;
  const t = tileAt(map, col, row, z);
  return t !== TileType.Empty && t !== TileType.Water;
}

// 8-connected neighbors. Diagonals require both orthogonal corners open so paths
// never cut through a wall corner (DESIGN.md §4).
const DIRS: [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, SQRT2],
  [1, -1, SQRT2],
  [-1, 1, SQRT2],
  [-1, -1, SQRT2],
];

function octile(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
}

/**
 * Returns the path from `start` to `goal` as waypoints EXCLUDING the start cell
 * and INCLUDING the goal, or null if unreachable.
 */
export function findPath(map: MapData, start: Cell, goal: Cell): Cell[] | null {
  if (!isWalkable(map, goal.col, goal.row, goal.z)) return null;
  if (start.col === goal.col && start.row === goal.row) return [];

  const w = map.width;
  const startI = idx(map, start.col, start.row, start.z);
  const goalI = idx(map, goal.col, goal.row, goal.z);

  const gScore = new Map<number, number>();
  const cameFrom = new Map<number, number>();
  gScore.set(startI, 0);

  // Binary heap of cell indices, ordered by f then by index (deterministic).
  const heap: { i: number; f: number }[] = [{ i: startI, f: 0 }];
  const push = (i: number, f: number) => {
    heap.push({ i, f });
    let c = heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (less(heap[c], heap[p])) {
        [heap[c], heap[p]] = [heap[p], heap[c]];
        c = p;
      } else break;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let c = 0;
      for (;;) {
        const l = 2 * c + 1;
        const r = 2 * c + 2;
        let m = c;
        if (l < heap.length && less(heap[l], heap[m])) m = l;
        if (r < heap.length && less(heap[r], heap[m])) m = r;
        if (m === c) break;
        [heap[c], heap[m]] = [heap[m], heap[c]];
        c = m;
      }
    }
    return top;
  };
  const less = (a: { i: number; f: number }, b: { i: number; f: number }) =>
    a.f < b.f || (a.f === b.f && a.i < b.i);

  const plane = w * map.height;
  while (heap.length > 0) {
    const cur = pop();
    if (cur.i === goalI) return reconstruct(cameFrom, goalI, w, plane, goal.z);

    const cCol = (cur.i % plane) % w;
    const cRow = Math.floor((cur.i % plane) / w);
    const g = gScore.get(cur.i)!;
    // Skip stale heap entries (we allow duplicates instead of decrease-key).
    if (cur.f - octile(cCol, cRow, goal.col, goal.row) > g + 1e-9) continue;

    for (const [dc, dr, cost] of DIRS) {
      const nc = cCol + dc;
      const nr = cRow + dr;
      if (!isWalkable(map, nc, nr, start.z)) continue;
      // No corner-cutting on diagonals.
      if (dc !== 0 && dr !== 0) {
        if (!isWalkable(map, cCol + dc, cRow, start.z)) continue;
        if (!isWalkable(map, cCol, cRow + dr, start.z)) continue;
      }
      const ni = idx(map, nc, nr, start.z);
      const tentative = g + cost;
      const known = gScore.get(ni);
      if (known === undefined || tentative < known) {
        cameFrom.set(ni, cur.i);
        gScore.set(ni, tentative);
        push(ni, tentative + octile(nc, nr, goal.col, goal.row));
      }
    }
  }
  return null;
}

function reconstruct(
  cameFrom: Map<number, number>,
  goalI: number,
  w: number,
  plane: number,
  z: number,
): Cell[] {
  const cells: Cell[] = [];
  let cur: number | undefined = goalI;
  while (cur !== undefined) {
    const planar = cur % plane; // strip the z offset
    cells.push({ col: planar % w, row: Math.floor(planar / w), z });
    cur = cameFrom.get(cur);
  }
  cells.reverse();
  cells.shift(); // drop the start cell
  return cells;
}
