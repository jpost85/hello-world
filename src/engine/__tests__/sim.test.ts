import { describe, expect, it } from "vitest";
import { createGame } from "../game.ts";
import { playAITurn } from "../ai.ts";
import { territoriesOf } from "../map.ts";
import { classicWorld } from "../maps/classicWorld.ts";
import { worldMap } from "../maps/worldMap.ts";
import { caribbeanMap } from "../maps/caribbean.ts";
import { napoleonMap } from "../maps/napoleon.ts";
import { DEFAULT_FACTIONS } from "../factions.ts";
import type { GameMap, GameState } from "../types.ts";

/** Play a full all-AI game to completion (or a turn cap) and report the result. */
function playGame(seed: number, playerCount: number, map: GameMap = classicWorld): {
  state: GameState;
  turns: number;
  finished: boolean;
} {
  let s = createGame({
    map,
    factions: DEFAULT_FACTIONS,
    players: Array.from({ length: playerCount }, (_, i) => ({
      name: `AI ${i + 1}`,
      factionId: DEFAULT_FACTIONS[i].id,
      isAI: true,
    })),
    seed,
  });
  let guard = 0;
  while (s.phase !== "gameover" && guard++ < 2000) {
    s = playAITurn(s);
  }
  return { state: s, turns: s.turn, finished: s.phase === "gameover" };
}

describe("headless simulation (smoke)", () => {
  it("plays AI-vs-AI games to a decisive, valid finish", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const playerCount = 2 + (seed % 5); // cycle 2..6
      const { state, finished } = playGame(seed, playerCount);

      expect(finished, `seed ${seed} did not finish`).toBe(true);
      expect(state.winnerId).not.toBeNull();
      // The winner is a surviving player (by conquest or turn-limit lead).
      expect(state.players.find((p) => p.id === state.winnerId)!.isEliminated).toBe(false);
    }
  });

  it("2-player games end by outright conquest", () => {
    // With only two players a stalemate is implausible — the winner takes all.
    const { state } = playGame(7, 2);
    expect(territoriesOf(state, state.winnerId!)).toHaveLength(classicWorld.territories.length);
  });

  it("is fully reproducible — same seed yields the same winner and length", () => {
    const a = playGame(123, 4);
    const b = playGame(123, 4);
    expect(a.state.winnerId).toBe(b.state.winnerId);
    expect(a.turns).toBe(b.turns);
  });
});

describe("balance report (2-player baseline)", () => {
  it("ends decisively in a sane number of turns and isn't seat-locked", () => {
    const GAMES = 120;
    const winsBySeat: Record<string, number> = {};
    let totalTurns = 0;

    for (let seed = 1; seed <= GAMES; seed++) {
      const { state, turns, finished } = playGame(seed, 2);
      expect(finished).toBe(true);
      winsBySeat[state.winnerId!] = (winsBySeat[state.winnerId!] ?? 0) + 1;
      totalTurns += turns;
    }

    const avgTurns = totalTurns / GAMES;
    const p1 = winsBySeat["p1"] ?? 0;
    const p2 = winsBySeat["p2"] ?? 0;

    // Printed so `npm test` doubles as a tuning dashboard (Liberty's Call habit).
    // eslint-disable-next-line no-console
    console.log(
      `[balance] ${GAMES} games · avg ${avgTurns.toFixed(1)} turns · p1 ${p1} / p2 ${p2} wins`,
    );

    expect(avgTurns).toBeGreaterThan(1);
    expect(avgTurns).toBeLessThan(400);
    // First-move advantage is expected, but neither seat should win literally
    // everything — that would signal a broken/degenerate AI or rules.
    expect(p1).toBeGreaterThan(0);
    expect(p2).toBeGreaterThan(0);
  });
});

describe("world map simulation", () => {
  it("plays full 6-player games on the world map to a valid finish", () => {
    let totalTurns = 0;
    const GAMES = 12;
    for (let seed = 1; seed <= GAMES; seed++) {
      const { state, turns, finished } = playGame(seed, 6, worldMap);
      expect(finished, `world seed ${seed} did not finish`).toBe(true);
      expect(state.winnerId, `world seed ${seed}`).not.toBeNull();
      totalTurns += turns;
    }
    // eslint-disable-next-line no-console
    console.log(`[world] ${GAMES} 6-player games · avg ${(totalTurns / GAMES).toFixed(1)} turns`);
  });
});

describe("Caribbean theatre simulation", () => {
  it("plays full 4-player games on the Caribbean map to a valid finish", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const { state, finished } = playGame(seed, 4, caribbeanMap);
      expect(finished, `caribbean seed ${seed} did not finish`).toBe(true);
      expect(state.winnerId).not.toBeNull();
    }
  });
});

describe("Napoleonic Europe simulation", () => {
  it("plays full 5-player games on the Napoleon map to a valid finish", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const { state, finished } = playGame(seed, 5, napoleonMap);
      expect(finished, `napoleon seed ${seed} did not finish`).toBe(true);
      expect(state.winnerId).not.toBeNull();
    }
  });
});
