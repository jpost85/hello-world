/** Tunable presentation-layer constants. Game-balance numbers live in `src/data`. */
export const GAME_CONFIG = {
  /** Logical design resolution; Phaser's Scale.FIT letterboxes to the device. */
  width: 960,
  height: 540,
  /** Seconds between enemy spawns. */
  spawnIntervalSec: 1.4,
  /** Max concurrent enemies on screen. */
  maxEnemies: 8,
  /** Distance (px) within which a bite connects. */
  biteRange: 28,
} as const;
