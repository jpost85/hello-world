/**
 * Balance configuration — every tunable number in one place.
 *
 * `game.ts` and `battle.ts` read from `CONFIG`, so re-balancing is a data edit
 * here, and the simulation harness (`sim.test.ts`) measures the effect. This is
 * the RoTK equivalent of the Dominion branch's `config.ts`.
 */
import type { UnitType } from "./types.ts";

export const CONFIG = {
  /** Starting state for every province at game setup. */
  start: {
    troops: 8000,
    gold: 1000,
    food: 8000,
    population: 400, // thousands
    order: 70,
    commerce: 40,
    agriculture: 45,
    morale: 70,
    training: 50,
    wallLevel: 1,
  },

  /**
   * Command points a warlord receives each season: a base plus one per few
   * provinces held (capped). Scaling with territory lets a large realm act more
   * often than a cornered holdout — the political snowball that decides games.
   */
  commandPoints: { base: 2, perProvinces: 2, max: 7 },

  /** Seasonal economy & the food-supply loop. */
  economy: {
    /** Gold income ≈ commerce/10 * order/100 * goldPerCommerce. */
    goldPerCommerce: 8,
    /** Seasonal grain ≈ agriculture * order/100 * foodPerAgriculture (×harvest in autumn). */
    foodPerAgriculture: 30,
    /** Autumn harvest multiplier on the agriculture grain figure. */
    harvestMultiplier: 6,
    /** Grain eaten per 1000 troops each season. */
    foodPerThousandTroops: 220,
    /** When grain runs out, this fraction of the garrison deserts per season. */
    starvationDesertion: 0.08,
    /** Order/morale lost to a starving garrison each season. */
    starvationOrderLoss: 8,
    starvationMoraleLoss: 12,
    /** Order drifts toward this resting value each season. */
    orderRestingPoint: 50,
    orderDriftPerSeason: 4,
    /** Morale drifts toward (order)·moraleFromOrder when fed. */
    moraleFromOrder: 0.9,
    moraleDriftPerSeason: 6,
  },

  /** The Develop command (commerce). */
  develop: {
    goldCost: 200,
    gain: 8,
    orderGain: 4,
    /** Politics of the stationed officer adds up to this much extra gain. */
    politicsScale: 0.1,
  },

  /** The Cultivate command (agriculture). */
  cultivate: {
    goldCost: 180,
    gain: 8,
    politicsScale: 0.1,
  },

  /** The Train command (raises troop training). */
  train: {
    goldCost: 120,
    gain: 12,
    /** Leadership of the stationed officer adds up to this much extra gain. */
    leadershipScale: 0.15,
  },

  /** The Recruit command. */
  recruit: {
    goldCost: 150,
    troopsGained: 3000,
    /** Each recruit drafts this many thousand from the population pool. */
    populationCost: 30,
    orderCost: 5,
    /** Fresh conscripts dilute training/morale toward these levels. */
    rawTraining: 20,
    rawMorale: 50,
  },

  /** The Scheme command (incite unrest in an enemy province). */
  scheme: {
    goldCost: 100,
    /** Base order damage, scaled by schemer intellect vs target order. */
    baseOrderDamage: 25,
    /** A strategist trait multiplies the damage by this. */
    strategistMultiplier: 1.3,
  },

  /** Fortify command — raise the wall by one level. */
  fortify: { goldCostPerLevel: 250, maxLevel: 5 },

  /** Officer management. */
  officers: {
    /** Below this loyalty, an officer may defect at the start of a season. */
    defectionLoyalty: 20,
    /** Per-season defection chance at zero loyalty (scaled by how low it is). */
    defectionChance: 0.5,
    /** Recruiting a wandering/captive officer costs a command point + gold. */
    recruitGoldCost: 120,
    /** Base success of a recruit attempt before charisma/loyalty adjustment. */
    recruitBase: 0.35,
    /** Recruiter charisma and target loyalty each shift success by up to this. */
    recruitCharismaScale: 0.5,
    /** Loyalty a freshly recruited officer starts at. */
    recruitedLoyalty: 60,
    /** Executing a prisoner costs you standing with everyone, by this much. */
    executeRelationsHit: 20,
    /** Releasing a prisoner mends relations with their old lord by this much. */
    releaseRelationsGain: 15,
  },

  /** Diplomacy. */
  diplomacy: {
    /** A ceasefire lasts this many season-turns, then the front may reignite. */
    ceasefireTurns: 8,
    /** Minimum relations for an AI to accept an alliance / ceasefire offer. */
    allianceThreshold: 30,
    ceasefireThreshold: -20,
    /** Relations gained by proposing (and granted on signing) a pact. */
    pactRelationsGain: 10,
  },

  /** Battle resolution (auto-resolve with tactical nudges). */
  battle: {
    /** Max rounds before the weaker side is declared routed (safety bound). */
    maxRounds: 12,
    /** Fraction of a side's own army lost per round, baseline. */
    baseCasualtyRate: 0.22,
    /** Per-round random swing on casualties (±). Some spread lets a bold attack
     * break a stalemate; too little and near-even fronts freeze into deadlock. */
    luckSpread: 0.3,
    /**
     * Exponent on each side's enemy-power share. >1 makes battles lopsided in
     * favour of the stronger army, so a dominant force keeps most of its men and
     * can chain conquests — the snowball that drives games to a finish.
     */
    casualtyPowerExponent: 1.6,
    /** WAR/LEADERSHIP of the lead officer scales their army's power by up to this. */
    officerPowerScale: 0.45,
    /** Morale & training each scale a side's power by up to this. */
    moraleScale: 0.3,
    trainingScale: 0.25,
    /** Per wall level, the defender's power is multiplied by (1 + this). */
    wallBonusPerLevel: 0.12,
    /** Siege attackers negate this fraction of the wall bonus. */
    siegeWallNegation: 0.6,
    /** Defender power multiplier from full province order. */
    orderMultiplier: 0.3,
    /** Rock-paper-scissors edge (spear>cav>arch>spear) as a power multiplier. */
    typeAdvantage: 0.2,
    /** A specialist trait (cavalier/archer/admiral) adds this to its branch. */
    traitBranchBonus: 0.15,
    /** Navy crossing water multiplies power by this for/against land branches. */
    navalCrossingBonus: 0.25,
    /** A side routs when its troops drop below this fraction of its start. */
    routThreshold: 0.25,
    /** Per-battle chance an intellect-driven fire attack fires for the attacker. */
    fireAttackChance: 0.25,
    /** Per-battle chance a duel occurs when both sides have an officer. */
    duelChance: 0.3,
    /** Chance a defending officer is captured when their province falls. */
    captureChance: 0.5,
  },

  /** Marching & campaign supply. */
  march: {
    /** Grain an attacking column draws from its staging province for the campaign. */
    foodPerThousandTroops: 90,
    /** Worst-case morale multiplier when the column marches unsupplied. */
    minSupplyMorale: 0.55,
  },

  /**
   * Victory by hegemony: hold at least `dominationFraction` of all provinces AND
   * at least `leadMultiple`× the nearest rival — a commanding lead the realm
   * submits to, without grinding out every last holdout. (Last warlord standing
   * also wins.) If the chronicle ever reaches `turnLimit` season-turns with no
   * hegemon — a far horizon meant only as a backstop against a deadlocked AI
   * stalemate — the largest realm is declared the winner.
   */
  victory: { dominationFraction: 0.45, leadMultiple: 1.3, turnLimit: 160 },

  /** Safety bound for the headless simulation harness. */
  maxTurns: 400,
} as const;

export type Config = typeof CONFIG;

/**
 * Rock-paper-scissors among the three land branches. Value is the attacker's
 * multiplier sign: +1 strong, -1 weak, 0 neutral. Navy/siege are neutral here
 * (their edge comes from terrain/walls, handled separately).
 */
export function typeMatchup(attacker: UnitType, defender: UnitType): number {
  const beats: Partial<Record<UnitType, UnitType>> = {
    spearmen: "cavalry",
    cavalry: "archers",
    archers: "spearmen",
  };
  if (beats[attacker] === defender) return 1;
  if (beats[defender] === attacker) return -1;
  return 0;
}
