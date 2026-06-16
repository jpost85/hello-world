/**
 * A baseline computer opponent.
 *
 * Following the pattern from our sister project "Liberty's Call", the AI drives
 * the game through the very same engine actions a human uses (`placeReinforcements`,
 * `attack`, `fortify`, …) rather than a parallel rules path. That keeps it honest
 * — it can never do anything the rules forbid — and lets the headless balance
 * harness play full games by simply calling `playAITurn` for every seat.
 *
 * The policy is intentionally simple but competent: mass reinforcements on the
 * best springboard, press every clearly winning attack, then rail reserves up to
 * the front. It is the baseline a "thinking" player should be able to outplay,
 * and the yardstick the balance numbers are tuned against.
 */

import {
  attack,
  currentPlayer,
  endAttack,
  endReinforcement,
  endTurn,
  fortify,
  placeReinforcements,
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

/** Concentrate all reinforcements on the strongest available springboard. */
function aiReinforce(s: GameState, me: string): GameState {
  if (s.reinforcementsRemaining <= 0) return s;
  const owned = territoriesOf(s, me);
  const borders = owned.filter((id) => isBorder(s, me, id));
  const pool = borders.length ? borders : owned;
  const target = pool.reduce((best, id) =>
    springboardScore(s, me, id) > springboardScore(s, me, best) ? id : best,
  );
  return placeReinforcements(s, target, s.reinforcementsRemaining);
}

/** Press every clearly-winning attack until none remain. */
function aiAttack(s: GameState, me: string): GameState {
  let guard = 0;
  while (guard++ < 1000) {
    if (s.phase !== "attack") break;
    const move = bestAttack(s, me);
    if (!move) break;
    s = attack(s, { from: move.from, to: move.to, attackStyle: move.style }).state;
  }
  return s;
}

/** Rail the largest safe interior stack forward to the most-threatened front. */
function aiFortify(s: GameState, me: string): GameState {
  const owned = territoriesOf(s, me);
  const interior = owned.filter((id) => !isBorder(s, me, id) && s.territories[id].armies > 1);
  if (!interior.length) return s;
  const from = interior.reduce((best, id) =>
    s.territories[id].armies > s.territories[best].armies ? id : best,
  );
  const fronts = owned.filter(
    (id) => isBorder(s, me, id) && connectedByOwnership(s, me, from, id),
  );
  if (!fronts.length) return s;
  const to = fronts.reduce((best, id) =>
    threat(s, me, id) > threat(s, me, best) ? id : best,
  );
  return fortify(s, from, to, s.territories[from].armies - 1);
}

// --- evaluation helpers ----------------------------------------------------

interface AttackMove {
  from: string;
  to: string;
  style: AttackStyle;
}

/** The single best attack available, or null if nothing clears the edge threshold. */
function bestAttack(s: GameState, me: string): AttackMove | null {
  let best: AttackMove | null = null;
  let bestAdvantage = ATTACK_EDGE - 1;

  for (const from of territoriesOf(s, me)) {
    const fromArmies = s.territories[from].armies;
    if (fromArmies < 2) continue;
    for (const to of getTerritory(s.map, from).adjacentTo) {
      const target = s.territories[to];
      if (target.ownerId === me) continue;
      const advantage = fromArmies - 1 - effectiveDefense(s, to);
      if (advantage > bestAdvantage) {
        bestAdvantage = advantage;
        // Commit hard when the edge is decisive; probe cautiously otherwise.
        best = { from, to, style: advantage >= 3 ? "aggressive" : "standard" };
      }
    }
  }
  return best;
}

/** Defender armies plus rough allowances for fortress and general bonuses. */
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

/** How exposed a territory is: total enemy armies sitting on its borders. */
function threat(s: GameState, me: string, id: string): number {
  return getTerritory(s.map, id).adjacentTo
    .filter((n) => s.territories[n].ownerId !== me)
    .reduce((sum, n) => sum + s.territories[n].armies, 0);
}

/** Prefer territories where we already out-number the weakest neighbour. */
function springboardScore(s: GameState, me: string, id: string): number {
  const enemies = getTerritory(s.map, id).adjacentTo.filter(
    (n) => s.territories[n].ownerId !== me,
  );
  if (!enemies.length) return -Infinity;
  const weakest = Math.min(...enemies.map((n) => s.territories[n].armies));
  return s.territories[id].armies - weakest;
}
