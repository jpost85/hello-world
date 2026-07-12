/**
 * The computer warlord. `playAITurn` plays an entire AI season by calling the
 * same public engine actions a human does — it cannot bypass the rules, so the
 * one function powers both single-player mode and the headless balance harness
 * (`sim.test.ts`). The policy is a simple, competent baseline:
 *
 *   1. Press any clearly-winning attack on the border (never on a sworn friend).
 *   2. Rail idle interior reserves to the most-threatened front.
 *   3. Keep the front fed and manned, raise troops, then grow the economy.
 */
import { CONFIG } from "./config.ts";
import {
  atPeace,
  cultivate,
  currentPlayer,
  deployOfficer,
  develop,
  endTurn,
  leadOfficer,
  march,
  provincesOf,
  recruit,
  train,
} from "./game.ts";
import { effectiveStats } from "./items.ts";
import type { GameState } from "./types.ts";

/** Rough combat power so the AI only commits to favourable attacks. */
function power(troops: number, war = 0, lead = 0, morale = 70, training = 50): number {
  return (
    troops *
    (1 + (CONFIG.battle.officerPowerScale * (war + lead)) / 200) *
    (1 + (CONFIG.battle.moraleScale * (morale - 50)) / 50) *
    (1 + (CONFIG.battle.trainingScale * (training - 50)) / 50)
  );
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
    const fEff = fOff ? effectiveStats(fOff) : null;
    const map = s.map.provinces.find((p) => p.id === from)!;
    for (const to of map.adjacentTo) {
      const tp = s.provinces[to];
      if (tp.ownerId === me) continue;
      if (tp.ownerId && atPeace(s, me, tp.ownerId)) continue; // honour pacts
      const dOff = tp.ownerId ? leadOfficer(s, to, tp.ownerId) : undefined;
      const dEff = dOff ? effectiveStats(dOff) : null;
      const garrison = Math.min(2000, Math.round(fp.troops * 0.2));
      const commit = fp.troops - garrison;
      if (commit <= 0) continue;
      const atk = power(commit, fEff?.war ?? 0, fEff?.leadership ?? 0, fp.morale, fp.training);
      const def =
        power(tp.troops, dEff?.war ?? 0, dEff?.leadership ?? 0, tp.morale, tp.training) *
        (1 + CONFIG.battle.wallBonusPerLevel * tp.wallLevel) *
        (1 + CONFIG.battle.orderMultiplier * (tp.order / 100));
      const advantage = atk / Math.max(1, def);
      if (advantage >= 1.1 && (!best || advantage > best.advantage)) best = { from, to, troops: commit, advantage };
    }
  }
  return best;
}

/** An interior province (no hostile borders) the AI can drain reserves from. */
function safeReserve(s: GameState, towardFront: string): string | null {
  const me = currentPlayer(s).id;
  const frontMap = s.map.provinces.find((p) => p.id === towardFront)!;
  let best: { id: string; troops: number } | null = null;
  for (const id of frontMap.adjacentTo) {
    if (s.provinces[id].ownerId !== me) continue;
    const map = s.map.provinces.find((p) => p.id === id)!;
    const exposed = map.adjacentTo.some((n) => s.provinces[n].ownerId && s.provinces[n].ownerId !== me && !atPeace(s, me, s.provinces[n].ownerId!));
    if (exposed) continue; // keep troops where they're needed
    if (s.provinces[id].troops > 4000 && (!best || s.provinces[id].troops > best.troops)) best = { id, troops: s.provinces[id].troops };
  }
  return best?.id ?? null;
}

/** The owned province on a live border with the slimmest defensive margin. */
function frontierToReinforce(s: GameState): string | null {
  const me = currentPlayer(s).id;
  let worst: { id: string; threat: number } | null = null;
  for (const id of provincesOf(s, me)) {
    const map = s.map.provinces.find((p) => p.id === id)!;
    const enemyTroops = map.adjacentTo
      .map((n) => s.provinces[n])
      .filter((p) => p.ownerId && p.ownerId !== me && !atPeace(s, me, p.ownerId!))
      .reduce((sum, p) => sum + p.troops, 0);
    if (enemyTroops === 0) continue;
    const threat = enemyTroops - s.provinces[id].troops;
    if (!worst || threat > worst.threat) worst = { id, threat };
  }
  return worst?.id ?? null;
}

/** Grain the garrison eats per season — the bar a province must clear to grow. */
function upkeep(troops: number): number {
  return Math.round((troops / 1000) * CONFIG.economy.foodPerThousandTroops);
}

/** A markedly stronger general idling in a safe province, to post to the front. */
function generalForFront(s: GameState, front: string): string | null {
  const me = currentPlayer(s).id;
  const lead = leadOfficer(s, front, me);
  const frontWar = lead ? effectiveStats(lead).war : 0;
  let best: { id: string; war: number } | null = null;
  for (const o of s.officers) {
    if (!o.alive || o.ownerId !== me || o.captiveOf || o.provinceId === front || !o.provinceId) continue;
    const map = s.map.provinces.find((p) => p.id === o.provinceId)!;
    const exposed = map.adjacentTo.some((n) => s.provinces[n].ownerId && s.provinces[n].ownerId !== me && !atPeace(s, me, s.provinces[n].ownerId!));
    if (exposed) continue; // don't strip a general from a live front
    const war = effectiveStats(o).war;
    if (war > frontWar + 12 && (!best || war > best.war)) best = { id: o.id, war };
  }
  return best?.id ?? null;
}

export function playAITurn(s: GameState): GameState {
  let state = s;
  let guard = 0;
  while (state.phase === "command" && state.commandPointsRemaining > 0 && guard++ < 24) {
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
      if (reserve && state.provinces[reserve].troops - 2000 > 0) {
        state = march(state, reserve, front, state.provinces[reserve].troops - 2000);
        continue;
      }
      // Post a stronger idle general to command that front.
      const general = generalForFront(state, front);
      if (general) {
        state = deployOfficer(state, general, front);
        continue;
      }
    }

    // Keep a hungry province fed before it starves (grain matters now).
    const starving = provincesOf(state, me)
      .filter((id) => state.provinces[id].food < upkeep(state.provinces[id].troops) && state.provinces[id].gold >= CONFIG.cultivate.goldCost && state.provinces[id].agriculture < 100)
      .sort((a, b) => state.provinces[b].troops - state.provinces[a].troops)[0];
    if (starving) {
      state = cultivate(state, starving);
      continue;
    }

    // Raise troops on the exposed front — but only where we can feed them.
    if (
      front &&
      state.provinces[front].gold >= CONFIG.recruit.goldCost &&
      state.provinces[front].population >= CONFIG.recruit.populationCost &&
      state.provinces[front].food >= upkeep(state.provinces[front].troops + CONFIG.recruit.troopsGained)
    ) {
      state = recruit(state, front);
      continue;
    }

    // Otherwise grow the economy, or drill green troops on the front.
    const improvable = provincesOf(state, me)
      .filter((id) => state.provinces[id].gold >= CONFIG.develop.goldCost && state.provinces[id].commerce < 100)
      .sort((a, b) => state.provinces[b].gold - state.provinces[a].gold)[0];
    if (improvable) {
      state = develop(state, improvable);
      continue;
    }
    if (front && state.provinces[front].gold >= CONFIG.train.goldCost && state.provinces[front].training < 90) {
      state = train(state, front);
      continue;
    }
    break;
  }
  return endTurn(state);
}
