/**
 * Balance configuration — every tunable number in one place.
 *
 * `game.ts` and `battle.ts` read from `CONFIG`, so re-balancing is a data edit
 * here, and the simulation harness (`sim.test.ts`) measures the effect. This is
 * the RoTK equivalent of the Dominion branch's `config.ts`.
 */
export const CONFIG = {
  /** Starting state for every province at game setup. */
  start: {
    troops: 8000,
    gold: 1000,
    food: 5000,
    population: 400, // thousands
    order: 70,
    development: 40,
  },

  /**
   * Command points a warlord receives each season: a base plus one per few
   * provinces held (capped). Scaling with territory lets a large realm act more
   * often than a cornered holdout — the political snowball that decides games.
   */
  commandPoints: { base: 2, perProvinces: 2, max: 7 },

  /** Seasonal economy. */
  economy: {
    /** Gold income per province ≈ development * order/100 * goldPerDevelopment. */
    goldPerDevelopment: 8,
    /** Food harvested in autumn ≈ population * order/100 * foodPerPopulation. */
    foodPerPopulation: 12,
    /** Food eaten per 1000 troops each season. */
    foodPerThousandTroops: 100,
    /** Order drifts toward this resting value each season. */
    orderRestingPoint: 50,
    orderDriftPerSeason: 4,
  },

  /** The Develop command. */
  develop: {
    goldCost: 200,
    developmentGain: 8,
    orderGain: 6,
    /** Politics of the stationed officer adds up to this much extra gain. */
    politicsScale: 0.1,
  },

  /** The Recruit command. */
  recruit: {
    goldCost: 150,
    troopsGained: 3000,
    /** Each recruit drafts this many thousand from the population pool. */
    populationCost: 30,
    orderCost: 5,
  },

  /** The Scheme command (incite unrest in an enemy province). */
  scheme: {
    goldCost: 100,
    /** Base order damage, scaled by schemer intellect vs target order. */
    baseOrderDamage: 25,
  },

  /** Fortify command — raise a rampart. */
  rampartGoldCost: 300,

  /** Battle resolution (auto-resolve with tactical nudges). */
  battle: {
    /** Max rounds before the weaker side is declared routed (safety bound). */
    maxRounds: 12,
    /** Fraction of a side's own army lost per round, baseline. */
    baseCasualtyRate: 0.22,
    /**
     * Exponent on each side's enemy-power share. >1 makes battles lopsided in
     * favour of the stronger army, so a dominant force keeps most of its men and
     * can chain conquests — the snowball that drives games to a finish.
     */
    casualtyPowerExponent: 1.6,
    /** WAR/LEADERSHIP of the lead officer scales their army's power by up to this. */
    officerPowerScale: 0.5,
    /** Defender power multiplier from a rampart. */
    rampartMultiplier: 1.4,
    /** Defender power multiplier from full province order. */
    orderMultiplier: 0.4,
    /** A side routs when its troops drop below this fraction of its start. */
    routThreshold: 0.25,
    /** Per-battle chance an intellect-driven fire attack fires for the attacker. */
    fireAttackChance: 0.25,
    /** Per-battle chance a duel occurs when both sides have an officer. */
    duelChance: 0.3,
    /** Chance a defending officer is captured when their province falls. */
    captureChance: 0.5,
  },

  /**
   * Victory by hegemony: hold at least `dominationFraction` of all provinces AND
   * at least `leadMultiple`× the nearest rival — a commanding lead the realm
   * submits to, without grinding out every last holdout. (Last warlord standing
   * also wins.)
   */
  victory: { dominationFraction: 0.5, leadMultiple: 2 },

  /** Safety bound for the headless simulation harness. */
  maxTurns: 400,
} as const;

export type Config = typeof CONFIG;
