import { describe, it, expect } from "vitest";
import { createGame, currentPlayer } from "../game.ts";
import { playAITurn } from "../ai.ts";
import { chinaMap } from "../maps/china.ts";
import { CONFIG } from "../config.ts";
import type { GameState } from "../types.ts";

/**
 * Headless balance harness. Plays full AI-vs-AI games to completion, asserting
 * every game ends decisively and reproducibly, and prints a win-rate / length
 * report for tuning `config.ts` — the RoTK counterpart of Dominion's `sim.test`.
 */
function playGame(seed: number): { winner: string | null; turns: number } {
  let s: GameState = createGame({ map: chinaMap, seed });
  let turns = 0;
  while (s.phase !== "gameover" && turns < CONFIG.maxTurns) {
    s = playAITurn(s);
    turns++;
  }
  return { winner: s.winnerId, turns };
}

describe("AI vs AI simulation", () => {
  it("plays many games to a decisive, reproducible finish", () => {
    const wins = new Map<string, number>();
    let totalTurns = 0;
    const N = 20;
    for (let seed = 1; seed <= N; seed++) {
      const a = playGame(seed);
      const b = playGame(seed);
      expect(a).toEqual(b); // determinism
      expect(a.winner, `game ${seed} produced a winner`).not.toBeNull();
      expect(a.turns).toBeLessThan(CONFIG.maxTurns);
      wins.set(a.winner!, (wins.get(a.winner!) ?? 0) + 1);
      totalTurns += a.turns;
    }
    // Report (visible with `vitest --reporter verbose`).
    const report = [...wins.entries()].sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k}:${v}`).join("  ");
    console.log(`avg turns ${(totalTurns / N).toFixed(1)} | wins ${report}`);
    expect([...wins.values()].reduce((a, b) => a + b, 0)).toBe(N);
  });

  it("a single AI turn never throws and always ends the turn", () => {
    let s = createGame({ map: chinaMap, seed: 7 });
    const startTurn = s.turn;
    s = playAITurn(s);
    expect(s.turn).toBeGreaterThan(startTurn);
    expect(currentPlayer(s)).toBeDefined();
  });
});
