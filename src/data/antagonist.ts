/**
 * The Stillness — the counter-terraforming antagonist.
 *
 * Descendants of the first, failed landings who survived the die-offs by
 * embracing the dead world as it was — and came to worship its silence.
 * To them, every degree of warming, every drop of open water, every green
 * thing is desecration. They are not a rival corporation; they cannot be
 * out-bid or out-built, only fought, appeased, or outrun.
 *
 * Their win condition is the inverse of everyone else's: if the planet, once
 * woken, is dragged back down toward silence, the Stillness wins and the game
 * is lost.
 *
 * Design intent: hazards are random pressure, rivals are social pressure —
 * the Stillness is *directional* pressure, aimed at the win condition itself.
 * They also pre-figure the unit layer's razing rule (razing regresses global
 * parameters, docs/UNITS.md): their "quietings" are the event-level form of
 * razing, and once units exist they will spawn physical raiders instead.
 */
export const ANTAGONIST = {
  id: "the-stillness",
  name: "The Stillness",
  leader: "First Custodian Sere Adhan",
  creed: "The world was perfect before you woke it.",
  blurb:
    "Zealot-preservationists born of the first failed landings, who found " +
    "meaning in the silence of the dead world. They move through the wastes " +
    "and the vents, unmaking what the factions build — patient, distributed, " +
    "and certain.",
} as const;

/** Tuning constants for the Stillness simulation (engine/antagonist.ts). */
export const STILLNESS_TUNING = {
  /** Habitability at which the movement reveals itself. */
  awakenHabitability: 15,
  /** Base threat growth per turn once awake. */
  baseGrowth: 0.7,
  /** Extra growth per point of habitability (success breeds opposition). */
  growthPerHabitability: 1 / 70,
  /** Aggression multiplier while appeased / under Preservation policy /
   *  under an ecological dominant ideology. */
  appeasedMult: 0.4,
  preservationMult: 0.6,
  ecologicalMult: 0.75,
  /** Aggression multiplier under Industrial Expansion (they hate it). */
  industrialMult: 1.4,
  /** Action chance per turn = min(cap, threat/divisor * aggression). */
  actionChanceDivisor: 150,
  actionChanceCap: 0.45,
  /** Their win: the planet reached this much habitability… */
  winRequiresPeak: 30,
  /** …and was dragged back down to this. */
  winFallsTo: 12,
  /** Player counteractions. */
  strike: { energy: 40, materials: 30, threatBase: 14, threatMartial: 20 },
  fund: { credits: 50, appeaseTurns: 6, threatRelief: 4 },
} as const;
