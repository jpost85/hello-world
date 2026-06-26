// Fixed-timestep loop with an accumulator (DESIGN.md §6.1). The SIM advances in
// discrete 60Hz ticks; the render callback receives an interpolation factor
// `alpha` so motion is smooth at any display refresh rate (§6.4).

import type { Command } from "./commands.js";
import { simTick } from "./systems.js";
import type { WorldState } from "./world.js";

export const SIM_HZ = 60;
export const SIM_DT_MS = 1000 / SIM_HZ;
export const SIM_DT_S = 1 / SIM_HZ;

export type RenderFn = (world: WorldState, alpha: number) => void;

export class SimLoop {
  private accumulator = 0;
  private last = 0;
  private running = false;
  private pending: Command[] = [];

  constructor(
    private readonly world: WorldState,
    private readonly render: RenderFn,
  ) {}

  /** Queue a command to apply on the next tick that runs. */
  queue(cmd: Omit<Command, "tick">): void {
    this.pending.push({ ...cmd, tick: this.world.tick + 1 } as Command);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    this.accumulator += now - this.last;
    this.last = now;
    // Clamp to avoid a spiral of death after a tab stall (DESIGN.md §6.1).
    if (this.accumulator > 250) this.accumulator = 250;

    while (this.accumulator >= SIM_DT_MS) {
      const commands = this.pending;
      this.pending = [];
      simTick(this.world, SIM_DT_S, commands);
      this.accumulator -= SIM_DT_MS;
    }

    const alpha = this.accumulator / SIM_DT_MS;
    this.render(this.world, alpha);
    requestAnimationFrame(this.frame);
  };
}
