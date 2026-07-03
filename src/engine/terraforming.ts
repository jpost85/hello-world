import type { GameState, GlobalParamKey, GlobalParams } from "../types";

/**
 * The five planetary dials and the derived habitability of the world.
 *
 * `min`  = the dead-planet starting value (also the floor for progress math)
 * `target` = the value at which this parameter is considered "habitable"
 * `max`  = hard cap
 *
 * Habitability is the mean progress of every parameter toward its target,
 * expressed 0–100. When it hits 100 the planet is self-sustaining — the win
 * condition. Habitability also feeds survival: farming and population capacity
 * scale with how Earthlike the world has become (see engine/survival.ts).
 */
export function createGlobalParams(): GlobalParams {
  return {
    temperature: {
      key: "temperature",
      label: "Temperature",
      unit: "°C",
      value: -55,
      min: -55,
      target: 8,
      max: 20,
      description: "Mean surface temperature. Liquid water needs it above freezing.",
    },
    pressure: {
      key: "pressure",
      label: "Air Pressure",
      unit: "kPa",
      value: 1,
      min: 1,
      target: 60,
      max: 101,
      description: "Atmospheric pressure. Humans need a thick enough column to breathe.",
    },
    oxygen: {
      key: "oxygen",
      label: "Oxygen",
      unit: "%",
      value: 0,
      min: 0,
      target: 19,
      max: 30,
      description: "Free atmospheric oxygen — produced by the biosphere.",
    },
    hydrosphere: {
      key: "hydrosphere",
      label: "Hydrosphere",
      unit: "%",
      value: 0,
      min: 0,
      target: 40,
      max: 70,
      description: "Surface covered by liquid water. Enables oceans, weather, life.",
    },
    biomass: {
      key: "biomass",
      label: "Biomass",
      unit: "idx",
      value: 0,
      min: 0,
      target: 50,
      max: 100,
      description: "Living matter across the planet. Drives oxygen and food.",
    },
  };
}

/** Progress of a single parameter toward its target, clamped 0–1. */
export function paramProgress(state: GameState, key: GlobalParamKey): number {
  const p = state.globalParams[key];
  const denom = p.target - p.min;
  if (denom <= 0) return 1;
  return Math.min(1, Math.max(0, (p.value - p.min) / denom));
}

/** Derived 0–100 habitability index: mean progress across all five dials. */
export function computeHabitability(state: GameState): number {
  const keys = Object.keys(state.globalParams) as GlobalParamKey[];
  const sum = keys.reduce((acc, k) => acc + paramProgress(state, k), 0);
  return Math.round((sum / keys.length) * 100);
}

/**
 * Apply a project's effect to a global parameter, honoring the faction's
 * terraform affinity multiplier and clamping to [min, max]. Returns the actual
 * signed delta applied (useful for logging).
 */
export function applyParamDelta(
  state: GameState,
  key: GlobalParamKey,
  rawDelta: number,
  affinity: number,
): number {
  const p = state.globalParams[key];
  const before = p.value;
  const scaled = rawDelta >= 0 ? rawDelta * affinity : rawDelta;
  p.value = Math.min(p.max, Math.max(p.min, p.value + scaled));
  return Math.round((p.value - before) * 10) / 10;
}
