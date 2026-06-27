/** Tunable presentation-layer constants. Game-balance numbers live in `src/data`. */
export const GAME_CONFIG = {
  /**
   * Logical design resolution — PORTRAIT, sized to a modern phone aspect
   * (~19.5:9). Phaser's Scale.FIT scales this to the device and centers it; the
   * page background matches the game, so any letterbox on off-ratio screens is
   * nearly invisible. Tall, narrow play area that fills a phone held upright.
   */
  width: 540,
  height: 1170,
  /** Vertical padding (px) kept clear of the top edge for notches/status bars. */
  safeTop: 40,
  /** Seconds between enemy spawns. Tuned for the tall portrait field's density. */
  spawnIntervalSec: 0.8,
  /** Max concurrent enemies on screen. */
  maxEnemies: 14,
  /** Prey present in the world the moment a run begins (so there's food at t=0). */
  initialPrey: 7,
  /** Distance (px) within which a bite connects. */
  biteRange: 28,
} as const;
