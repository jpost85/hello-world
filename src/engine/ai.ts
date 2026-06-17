/**
 * The computer warlord. `playAITurn` plays an entire AI season by calling the
 * same public engine actions a human does — it cannot bypass the rules, so the
 * one function powers both single-player mode and the headless balance harness
 * (`sim.test.ts`). The policy is a simple, competent baseline:
 *
 *   1. Press any clearly-winning attack on the border.
 *   2. Otherwise raise troops on the most-threatened front.
 *   3. Otherwise develop the safest, richest province.
 */
import { CONFIG } from "./config.ts";
import { currentPlayer, develop, endTurn, leadOfficer, march, provincesOf, recruit } from "./game.ts";
import type { GameState } from "./types.ts";

/** An interior province (no hostile borders) the AI can drain reserves from. */
function safeReserve(s: GameState, towardFront: string): string | null {
  const me = currentPlayer(s).id;
  const frontMap = s.map.provinces.find((p) => p.id === towardFront)!;
  let best: { id: string; troops: number } | null = null;
  for (const id of frontMap.adjacentTo) {
    if (s.provinces[id].ownerId !== me) continue;
    const map = s.map.provinces.find((p) => p.id === id)!;
    const exposed = map.adjacentTo.some((n) => s.provinces[n].ownerId && s.provinces[n].ownerId !== me);
    if (exposed) continue; // keep troops where they're needed
    if (s.provinces[id].troops > 4000 && (!best || s.provinces[id].troops > best.troops))
      best = { id, troops: s.provinces[id].troops };
  }
  return best?.id ?? null;
}

/** Rough combat power so the AI only commits to favourable attacks. */
function power(troops: number, war = 0, lead = 0): number {
  return troops * (1 + CONFIG.battle.officerPowerScale * (war + lead) / 200);
}

interface AttackPlan {
  from: string;
  to: string;
  troops: number;
  advantage: number;
}

function bestAttack(s: GameState): AttackPlan | null {
  const me = currentPlayer(s).id;
  let best: AttackPlan | null = null;
  for (const from of provincesOf(s, me)) {
    const fp = s.provinces[from];
    if (fp.troops < 4000) continue;
    const fOff = leadOfficer(s, from, me);
    const map = s.map.provinces.find((p) => p.id === from)!;
    for (const to of map.adjacentTo) {
      const tp = s.provinces[to];
      if (tp.ownerId === me) continue;
      const dOff = tp.ownerId ? leadOfficer(s, to, tp.ownerId) : undefined;
      const garrison = Math.min(2000, Math.round(fp.troops * 0.2));
      const commit = fp.troops - garrison;
      if (commit <= 0) continue;
      const atk = power(commit, fOff?.war ?? 0, fOff?.leadership ?? 0);
      const def =
        power(tp.troops, dOff?.war ?? 0, dOff?.leadership ?? 0) *
        (tp.hasRampart ? CONFIG.battle.rampartMultiplier : 1) *
        (1 + CONFIG.battle.orderMultiplier * (tp.order / 100));
      const advantage = atk / Math.max(1, def);
      if (advantage >= 1.2 && (!best || advantage > best.advantage)) best = { from, to, troops: commit, advantage };
    }
  }
  return best;
}

/** The owned province on a hostile border with the slimmest defensive margin. */
function frontierToReinforce(s: GameState): string | null {
  const me = currentPlayer(s).id;
  let worst: { id: string; threat: number } | null = null;
  for (const id of provincesOf(s, me)) {
    const map = s.map.provinces.find((p) => p.id === id)!;
    const enemyTroops = map.adjacentTo
      .map((n) => s.provinces[n])
      .filter((p) => p.ownerId && p.ownerId !== me)
      .reduce((sum, p) => sum + p.troops, 0);
    if (enemyTroops === 0) continue;
    const threat = enemyTroops - s.provinces[id].troops;
    if (!worst || threat > worst.threat) worst = { id, threat };
  }
  return worst?.id ?? null;
}

export function playAITurn(s: GameState): GameState {
  let state = s;
  let guard = 0;
  while (state.phase === "command" && state.commandPointsRemaining > 0 && guard++ < 20) {
    const me = currentPlayer(state).id;

    const attack = bestAttack(state);
    if (attack) {
      state = march(state, attack.from, attack.to, attack.troops);
      continue;
    }

    // Rail idle interior reserves up to the most-threatened front.
    const front = frontierToReinforce(state);
    if (front) {
      const reserve = safeReserve(state, front);
      if (reserve) {
        const move = state.provinces[reserve].troops - 2000;
        if (move > 0) {
          state = march(state, reserve, front, move);
          continue;
        }
      }
    }

    // Raise troops where we are most exposed and can pay.
    if (front && state.provinces[front].gold >= CONFIG.recruit.goldCost && state.provinces[front].population >= CONFIG.recruit.populationCost) {
      state = recruit(state, front);
      continue;
    }

    // Otherwise grow the economy in the richest improvable province.
    const improvable = provincesOf(state, me)
      .filter((id) => state.provinces[id].gold >= CONFIG.develop.goldCost && state.provinces[id].development < 100)
      .sort((a, b) => state.provinces[b].gold - state.provinces[a].gold)[0];
    if (improvable) {
      state = develop(state, improvable);
      continue;
    }
    break;
  }
  return endTurn(state);
}
