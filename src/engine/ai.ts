/**
 * A smarter computer opponent.
 *
 * The AI drives the game through the same engine actions a human uses, so it
 * can never break the rules. Key strategic behaviours:
 *
 *  - Region-aware scoring: heavily prioritises attacks that complete a region
 *    for us or deny one to an opponent.
 *  - Multi-front reinforcement: distributes armies across the top-2 springboards
 *    instead of piling everything onto one territory.
 *  - Player elimination targeting: bonuses for finishing off nearly-dead
 *    opponents to seize their conquest cards.
 *  - Maximum advance on capture: moves as many armies as possible into a newly
 *    captured territory rather than leaving a tiny garrison.
 *  - General repositioning: moves our general to the most attack-valuable front
 *    at the start of each reinforce phase.
 *  - Best-pair fortify: evaluates every interior→front transfer and picks the
 *    one that creates the most threat/opportunity.
 */

import {
  attack,
  currentPlayer,
  endAttack,
  endReinforcement,
  endTurn,
  findValidSet,
  fortify,
  moveGeneral,
  placeReinforcements,
  tradeInCards,
} from "./game.ts";
import { connectedByOwnership, getTerritory, territoriesOf } from "./map.ts";
import type { AttackStyle, GameState } from "./types.ts";

/** Minimum army edge (after keeping a reserve) before the AI presses an attack. */
const ATTACK_EDGE = 1;

/** Play out the current (AI) player's entire turn and return the resulting state. */
export function playAITurn(state: GameState): GameState {
  let s = state;
  if (s.phase === "gameover") return s;
  const me = currentPlayer(s).id;

  if (s.phase === "reinforce") {
    s = aiTradeCards(s);
    s = aiPositionGeneral(s, me);
    s = aiReinforce(s, me);
    s = endReinforcement(s);
  }
  if (s.phase === "attack") {
    s = aiAttack(s, me);
    if (s.phase === "attack") s = endAttack(s);
  }
  if (s.phase === "fortify") {
    s = aiFortify(s, me);
    if (s.phase === "fortify") s = endTurn(s);
  }
  return s;
}

/** Trade in every available card set for reinforcements (keeps the AI aggressive). */
function aiTradeCards(s: GameState): GameState {
  for (let guard = 0; guard < 12; guard++) {
    const set = findValidSet(currentPlayer(s).cards);
    if (!set) break;
    s = tradeInCards(s, set);
  }
  return s;
}

/**
 * Reposition our general to the border territory with the highest attack value
 * so it boosts our strongest assault this turn.
 */
function aiPositionGeneral(s: GameState, me: string): GameState {
  const myGenerals = s.generals.filter((g) => g.ownerId === me);
  if (!myGenerals.length) return s;

  const owned = territoriesOf(s, me);
  const borders = owned.filter((id) => isBorder(s, me, id));
  if (!borders.length) return s;

  let result = s;
  for (const general of myGenerals) {
    const best = borders.reduce((bestId, id) =>
      generalPlacementScore(result, me, id) > generalPlacementScore(result, me, bestId)
        ? id
        : bestId,
    );
    if (general.territoryId === best) continue;
    try {
      result = moveGeneral(result, general.id, best);
    } catch {
      // General can't reach target (disconnected territory) — leave in place.
    }
  }
  return result;
}

/**
 * Distribute reinforcements across the top-2 springboards, weighted by score.
 * Focusing on two fronts instead of one prevents being completely blind-sided
 * on a second active front while still concentrating enough to break through.
 */
function aiReinforce(s: GameState, me: string): GameState {
  if (s.reinforcementsRemaining <= 0) return s;
  const owned = territoriesOf(s, me);
  const borders = owned.filter((id) => isBorder(s, me, id));
  const pool = borders.length ? borders : owned;

  const scored = pool
    .map((id) => ({ id, score: Math.max(0.01, reinforceScore(s, me, id)) }))
    .sort((a, b) => b.score - a.score);

  const candidates = scored.slice(0, 2);
  const totalScore = candidates.reduce((sum, x) => sum + x.score, 0);

  let remaining = s.reinforcementsRemaining;
  let result = s;
  for (let i = 0; i < candidates.length && remaining > 0; i++) {
    const isLast = i === candidates.length - 1;
    const share = isLast
      ? remaining
      : Math.max(1, Math.floor((remaining * candidates[i].score) / totalScore));
    const placing = Math.min(share, remaining);
    result = placeReinforcements(result, candidates[i].id, placing);
    remaining -= placing;
  }
  return result;
}

/** Press every worthwhile attack until none remain. */
function aiAttack(s: GameState, me: string): GameState {
  let guard = 0;
  while (guard++ < 1000) {
    if (s.phase !== "attack") break;
    const move = bestAttack(s, me);
    if (!move) break;
    s = attack(s, {
      from: move.from,
      to: move.to,
      attackStyle: move.style,
      advance: move.advance,
    }).state;
  }
  return s;
}

/**
 * Evaluate every interior→front pair and pick the most valuable transfer.
 * Prefers reinforcing the front that is most threatened or that would unlock
 * the best attack opportunities after being reinforced.
 */
function aiFortify(s: GameState, me: string): GameState {
  const owned = territoriesOf(s, me);
  const interior = owned.filter((id) => !isBorder(s, me, id) && s.territories[id].armies > 1);
  if (!interior.length) return s;

  let bestFrom: string | null = null;
  let bestTo: string | null = null;
  let bestScore = -Infinity;

  for (const from of interior) {
    const count = s.territories[from].armies - 1;
    if (count < 1) continue;
    const fronts = owned.filter(
      (id) => isBorder(s, me, id) && connectedByOwnership(s, me, from, id),
    );
    for (const to of fronts) {
      const score = fortifyDestScore(s, me, to, count);
      if (score > bestScore) {
        bestScore = score;
        bestFrom = from;
        bestTo = to;
      }
    }
  }

  if (!bestFrom || !bestTo) return s;
  return fortify(s, bestFrom, bestTo, s.territories[bestFrom].armies - 1);
}

// ---------------------------------------------------------------------------
// Evaluation helpers
// ---------------------------------------------------------------------------

interface AttackMove {
  from: string;
  to: string;
  style: AttackStyle;
  advance: number;
}

/**
 * The single highest-value attack available, or null if nothing clears the edge
 * threshold. Combines army advantage, region completion/denial, and player
 * elimination opportunity into one score.
 */
function bestAttack(s: GameState, me: string): AttackMove | null {
  let best: AttackMove | null = null;
  let bestScore = -Infinity;

  for (const from of territoriesOf(s, me)) {
    const fromArmies = s.territories[from].armies;
    if (fromArmies < 2) continue;
    for (const to of getTerritory(s.map, from).adjacentTo) {
      if (s.territories[to].ownerId === me) continue;
      const effective = effectiveDefense(s, to);
      const advantage = fromArmies - 1 - effective;
      if (advantage < ATTACK_EDGE) continue;

      const score =
        advantage +
        regionCompletionBonus(s, me, to) +
        regionDenialBonus(s, me, to) +
        eliminationBonus(s, me, to);

      if (score > bestScore) {
        bestScore = score;
        best = {
          from,
          to,
          // Commit hard with a decisive edge; probe cautiously otherwise.
          style: advantage >= 4 ? "aggressive" : "standard",
          // Advance as many armies as possible to strengthen the beachhead.
          advance: fromArmies - 1,
        };
      }
    }
  }
  return best;
}

/** Score for placing reinforcements at a border territory. */
function reinforceScore(s: GameState, me: string, id: string): number {
  const enemies = getTerritory(s.map, id).adjacentTo.filter(
    (n) => s.territories[n].ownerId !== me,
  );
  if (!enemies.length) return 0;

  const weakest = Math.min(...enemies.map((n) => s.territories[n].armies));
  let score = s.territories[id].armies - weakest;

  for (const enemy of enemies) {
    score += regionCompletionBonus(s, me, enemy) * 0.4;
    score += regionDenialBonus(s, me, enemy) * 0.3;
    score += eliminationBonus(s, me, enemy) * 0.2;
  }

  score += threat(s, me, id) * 0.2;
  return score;
}

/** Score for stationing our general at this border territory. */
function generalPlacementScore(s: GameState, me: string, id: string): number {
  const enemies = getTerritory(s.map, id).adjacentTo.filter(
    (n) => s.territories[n].ownerId !== me,
  );
  let score = 0;
  for (const enemy of enemies) {
    const advantage = s.territories[id].armies - 1 - effectiveDefense(s, enemy);
    if (advantage > 0) score += advantage;
    score += regionCompletionBonus(s, me, enemy) * 0.5;
  }
  return score;
}

/** Score for moving a reserve stack to this front during fortify. */
function fortifyDestScore(s: GameState, me: string, id: string, addingArmies: number): number {
  const enemies = getTerritory(s.map, id).adjacentTo.filter(
    (n) => s.territories[n].ownerId !== me,
  );
  let score = threat(s, me, id);
  for (const enemy of enemies) {
    const newAdv = s.territories[id].armies + addingArmies - 1 - effectiveDefense(s, enemy);
    if (newAdv > 0) {
      score += newAdv;
      score += regionCompletionBonus(s, me, enemy) * 0.5;
    }
  }
  return score;
}

// ---------------------------------------------------------------------------
// Value functions
// ---------------------------------------------------------------------------

/**
 * Bonus armies per turn we would gain by completing the region that contains
 * `targetId` — returned only if we are one territory away from full control.
 */
function regionCompletionBonus(s: GameState, me: string, targetId: string): number {
  let bonus = 0;
  for (const region of s.map.regions) {
    if (!region.territoryIds.includes(targetId)) continue;
    const myCount = region.territoryIds.filter((id) => s.territories[id].ownerId === me).length;
    if (myCount === region.territoryIds.length - 1) {
      bonus += region.bonusArmies * 4;
    }
  }
  return bonus;
}

/**
 * Value of stripping a region bonus from an opponent: how many armies per turn
 * the target owner earns from any region where they are one step from completion
 * (or already fully control it).
 */
function regionDenialBonus(s: GameState, me: string, targetId: string): number {
  const targetOwner = s.territories[targetId].ownerId;
  if (!targetOwner || targetOwner === me) return 0;
  let bonus = 0;
  for (const region of s.map.regions) {
    if (!region.territoryIds.includes(targetId)) continue;
    const enemyCount = region.territoryIds.filter(
      (id) => s.territories[id].ownerId === targetOwner,
    ).length;
    if (enemyCount === region.territoryIds.length - 1) {
      bonus += region.bonusArmies * 3;
    } else if (enemyCount === region.territoryIds.length) {
      bonus += region.bonusArmies * 2;
    }
  }
  return bonus;
}

/** Bonus for attacks that would eliminate (or heavily pressurise) a weak opponent. */
function eliminationBonus(s: GameState, me: string, targetId: string): number {
  const targetOwner = s.territories[targetId].ownerId;
  if (!targetOwner || targetOwner === me) return 0;
  const targetPlayer = s.players.find((p) => p.id === targetOwner);
  if (!targetPlayer || targetPlayer.isEliminated) return 0;
  const targetCount = territoriesOf(s, targetOwner).length;
  const targetCards = targetPlayer.cards.length;
  if (targetCount === 1) {
    // Eliminating this player nets us their conquest cards.
    return 8 + targetCards * 3;
  }
  if (targetCount <= 3) return 2;
  return 0;
}

// ---------------------------------------------------------------------------
// Territory helpers
// ---------------------------------------------------------------------------

/** Defender armies plus allowances for fortress and general bonuses. */
function effectiveDefense(s: GameState, id: string): number {
  const ts = s.territories[id];
  let value = ts.armies;
  if (ts.hasFortress) value += 2;
  if (s.generals.some((g) => g.territoryId === id && g.ownerId === ts.ownerId)) value += 1;
  return value;
}

function isBorder(s: GameState, me: string, id: string): boolean {
  return getTerritory(s.map, id).adjacentTo.some((n) => s.territories[n].ownerId !== me);
}

/** Total enemy armies adjacent to this territory. */
function threat(s: GameState, me: string, id: string): number {
  return getTerritory(s.map, id).adjacentTo
    .filter((n) => s.territories[n].ownerId !== me)
    .reduce((sum, n) => sum + s.territories[n].armies, 0);
}
