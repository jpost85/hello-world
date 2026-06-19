/**
 * Centralised balance configuration.
 *
 * Inspired by the `CONFIG` table in our sister project "Liberty's Call": every
 * tunable number lives here so the game can be re-balanced in one place without
 * touching resolution logic. As the game grows (more factions, maps, unit
 * types) this is the single knob-board for designers.
 */

import type { AttackStyle, DefenseStyle, StyleProfile } from "./types.ts";

export const CONFIG = {
  /** Starting army pool by player count (classic conquest-game values). */
  startingArmies: { 2: 40, 3: 35, 4: 30, 5: 25, 6: 20 } as Record<number, number>,

  reinforcements: {
    /** Minimum armies granted at the start of a turn. */
    minPerTurn: 3,
    /** Owned territories required per extra reinforcement (floor division). */
    territoriesPerArmy: 3,
  },

  /**
   * If nobody has achieved world domination by this many rounds, the player
   * holding the most territories wins. A safety cap against endless games.
   */
  maxTurns: 250,

  generals: {
    /** Bonus a general adds to its side's highest die while stationed. */
    combatBonus: 1,
    /** Generals each player starts with. */
    startingPerPlayer: 1,
  },

  fortress: {
    /** Armies removed from a territory's garrison to raise a fortress. */
    buildCost: 2,
    /** Extra dice the defender rolls while holding a fortress. */
    defenseDice: 1,
  },

  combat: {
    /** Base dice caps before style / structure modifiers. */
    baseMaxAttackDice: 3,
    baseMaxDefenseDice: 2,
    /** Numeric profiles each combat style resolves to. */
    attackStyles: {
      standard: { diceModifier: 0, highRollBonus: 0, winsTies: false },
      aggressive: { diceModifier: 0, highRollBonus: 0, winsTies: true },
      cautious: { diceModifier: -1, highRollBonus: 0, winsTies: false },
    } satisfies Record<AttackStyle, StyleProfile>,
    defenseStyles: {
      standard: { diceModifier: 0, highRollBonus: 0, winsTies: false },
      aggressive: { diceModifier: 0, highRollBonus: 1, winsTies: false },
      cautious: { diceModifier: -1, highRollBonus: 0, winsTies: false },
    } satisfies Record<DefenseStyle, StyleProfile>,
  },
} as const;
