// World state — the complete serializable SIM snapshot (DESIGN.md §6, §12).
// Entities keep both their current position and their position at the start of
// the last tick, so the render layer can interpolate between them (§6.4) without
// the SIM deep-cloning whole states.

import type { MapData } from "../map.js";
import { type Rng, makeRng } from "./rng.js";

export interface Agent {
  id: number;
  // Current (post-tick) sub-tile position, in grid units (floats).
  col: number;
  row: number;
  z: number;
  // Position at the start of the last tick — for render interpolation only.
  prevCol: number;
  prevRow: number;
  prevZ: number;
  // Remaining path waypoints (cell centers), excluding the current cell.
  path: { col: number; row: number; z: number }[];
  speed: number; // tiles per second
}

export interface WorldState {
  map: MapData;
  tick: number;
  rng: Rng;
  agents: Agent[];
  nextEntityId: number;
}

export function createWorld(map: MapData, seed: number): WorldState {
  return { map, tick: 0, rng: makeRng(seed), agents: [], nextEntityId: 1 };
}

export function spawnAgent(
  world: WorldState,
  col: number,
  row: number,
  z = 0,
  speed = 4,
): Agent {
  const agent: Agent = {
    id: world.nextEntityId++,
    col,
    row,
    z,
    prevCol: col,
    prevRow: row,
    prevZ: z,
    path: [],
    speed,
  };
  world.agents.push(agent);
  return agent;
}

export function getAgent(world: WorldState, id: number): Agent | undefined {
  return world.agents.find((a) => a.id === id);
}
