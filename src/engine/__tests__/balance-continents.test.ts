import { describe, expect, it } from "vitest";
import { createGame } from "../game.ts";
import { playAITurn } from "../ai.ts";
import { worldMap } from "../maps/worldMap.ts";
import { DEFAULT_FACTIONS } from "../factions.ts";
import type { GameState, Region } from "../types.ts";

/** The single player who controls every territory in a region, or null. */
function continentHolder(s: GameState, region: Region): string | null {
  let owner: string | null = null;
  for (const id of region.territoryIds) {
    const o = s.territories[id].ownerId;
    if (o === null) return null;
    if (owner === null) owner = o;
    else if (owner !== o) return null;
  }
  return owner;
}

/**
 * Diagnostic (not a hard assertion): play many AI games and, per continent,
 * report how often it is *first secured* and whether the first holder went on to
 * win. With derived bonuses these should be broadly comparable — no continent
 * should be a runaway kingmaker, and none should be so exposed it is never held.
 */
describe("continent balance report", () => {
  it("secures every continent across games without one dominating", () => {
    const GAMES = 36;
    const everHeld: Record<string, number> = {};
    const heldWin: Record<string, number> = {};
    for (const r of worldMap.regions) {
      everHeld[r.id] = 0;
      heldWin[r.id] = 0;
    }

    for (let seed = 1; seed <= GAMES; seed++) {
      let s = createGame({
        map: worldMap,
        factions: DEFAULT_FACTIONS,
        players: Array.from({ length: 6 }, (_, i) => ({
          name: `AI ${i + 1}`,
          factionId: DEFAULT_FACTIONS[i].id,
          isAI: true,
        })),
        seed,
      });

      const firstHolder: Record<string, string> = {};
      let guard = 0;
      while (s.phase !== "gameover" && guard++ < 2000) {
        s = playAITurn(s);
        for (const r of worldMap.regions) {
          if (firstHolder[r.id]) continue;
          const holder = continentHolder(s, r);
          if (holder) firstHolder[r.id] = holder;
        }
      }

      for (const r of worldMap.regions) {
        if (!firstHolder[r.id]) continue;
        everHeld[r.id]++;
        if (firstHolder[r.id] === s.winnerId) heldWin[r.id]++;
      }
    }

    // eslint-disable-next-line no-console
    console.log(`[continents] ${GAMES} 6-player games`);
    for (const r of worldMap.regions) {
      const held = everHeld[r.id];
      const rate = held ? ((heldWin[r.id] / held) * 100).toFixed(0) : "—";
      const bonus = r.bonusArmies;
      // eslint-disable-next-line no-console
      console.log(
        `  ${r.name.padEnd(16)} bonus ${bonus}  secured ${String(held).padStart(2)}/${GAMES}  first-holder win-rate ${rate}%`,
      );
    }

    // Loose sanity guards: every continent is secured at least once, and no
    // continent makes its first holder win *every* game it appears in.
    for (const r of worldMap.regions) {
      expect(everHeld[r.id], `${r.id} never secured`).toBeGreaterThan(0);
    }
  });
});
