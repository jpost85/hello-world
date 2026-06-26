// SIM systems + the pure tick step. Runs in the fixed order from DESIGN.md §6.5
// (step 2 only has command-apply + movement; more systems slot in later).

import type { Command } from "./commands.js";
import { findPath } from "./pathfind.js";
import { getAgent, type WorldState } from "./world.js";

/** Resolve a move command into an A* path for the target agent. */
function applyCommand(world: WorldState, cmd: Command): void {
  if (cmd.type !== "move") return;
  const agent = getAgent(world, cmd.entityId);
  if (!agent) return;
  const start = {
    col: Math.round(agent.col),
    row: Math.round(agent.row),
    z: agent.z,
  };
  const path = findPath(world.map, start, { col: cmd.col, row: cmd.row, z: agent.z });
  if (path) agent.path = path;
}

/** Advance agents along their paths at a fixed sub-tick dt (seconds). */
function movementSystem(world: WorldState, dt: number): void {
  for (const a of world.agents) {
    if (a.path.length === 0) continue;
    let budget = a.speed * dt; // tiles we may travel this tick
    while (budget > 0 && a.path.length > 0) {
      const wp = a.path[0];
      const dx = wp.col - a.col;
      const dy = wp.row - a.row;
      const dist = Math.sqrt(dx * dx + dy * dy); // avoid Math.hypot (DESIGN.md §6.2)
      if (dist <= budget || dist < 1e-9) {
        a.col = wp.col;
        a.row = wp.row;
        a.z = wp.z;
        a.path.shift();
        budget -= dist;
      } else {
        a.col += (dx / dist) * budget;
        a.row += (dy / dist) * budget;
        budget = 0;
      }
    }
  }
}

/**
 * One deterministic simulation step. `commands` are those scheduled for the
 * tick about to run. Snapshots prev-position first so render can interpolate.
 */
export function simTick(world: WorldState, dt: number, commands: Command[]): void {
  for (const a of world.agents) {
    a.prevCol = a.col;
    a.prevRow = a.row;
    a.prevZ = a.z;
  }
  // Stable command order for determinism (DESIGN.md §6.2).
  for (const cmd of commands) applyCommand(world, cmd);
  movementSystem(world, dt);
  world.tick++;
}
