import { describe, expect, it } from "vitest";
import { createGame } from "../game.ts";
import { playAITurn } from "../ai.ts";
import { territoriesOf } from "../map.ts";
import { DEFAULT_FACTIONS } from "../factions.ts";
import { africaMap } from "../maps/africaScramble.ts";
import { nearEastMap } from "../maps/nearEast.ts";
import { crimeaMap } from "../maps/crimea.ts";
import { indiaMap } from "../maps/indiaSubcontinent.ts";
import type { GameMap } from "../types.ts";

const THEATRES: GameMap[] = [africaMap, nearEastMap, crimeaMap, indiaMap];

describe.each(THEATRES)("theatre map: $name", (map) => {
  const ids = new Set(map.territories.map((t) => t.id));

  it("has territories, regions, and a regional viewBox", () => {
    expect(map.territories.length).toBeGreaterThanOrEqual(12);
    expect(map.regions.length).toBeGreaterThanOrEqual(3);
    expect(map.viewBox).toMatch(/^0 0 1000 \d+$/);
  });

  it("gives every territory real geometry and an in-bounds centroid", () => {
    const [, , w, h] = map.viewBox!.split(" ").map(Number);
    for (const t of map.territories) {
      expect(t.path, t.id).toMatch(/^M.*Z$/);
      expect(t.position.x).toBeGreaterThanOrEqual(0);
      expect(t.position.x).toBeLessThanOrEqual(w);
      expect(t.position.y).toBeGreaterThanOrEqual(0);
      expect(t.position.y).toBeLessThanOrEqual(h);
    }
  });

  it("has symmetric adjacency over real territories, every region populated", () => {
    const adj = new Map(map.territories.map((t) => [t.id, new Set(t.adjacentTo)]));
    for (const t of map.territories) {
      for (const n of t.adjacentTo) {
        expect(ids.has(n), `${t.id} -> ${n}`).toBe(true);
        expect(adj.get(n)?.has(t.id), `${n} should border ${t.id}`).toBe(true);
      }
    }
    for (const r of map.regions) {
      expect(r.territoryIds.length, `region ${r.id}`).toBeGreaterThan(0);
    }
  });

  it("is fully connected", () => {
    const adj = new Map(map.territories.map((t) => [t.id, t.adjacentTo]));
    const seen = new Set([map.territories[0].id]);
    const queue = [map.territories[0].id];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const n of adj.get(cur)!) if (!seen.has(n)) (seen.add(n), queue.push(n));
    }
    expect(seen.size).toBe(map.territories.length);
  });

  it("plays AI games to a decisive finish", () => {
    for (let seed = 1; seed <= 5; seed++) {
      let s = createGame({
        map,
        factions: DEFAULT_FACTIONS,
        players: Array.from({ length: 4 }, (_, i) => ({
          name: `AI ${i + 1}`,
          factionId: DEFAULT_FACTIONS[i].id,
          isAI: true,
        })),
        seed,
      });
      let guard = 0;
      while (s.phase !== "gameover" && guard++ < 4000) s = playAITurn(s);
      expect(s.phase, `${map.id} seed ${seed}`).toBe("gameover");
      expect(territoriesOf(s, s.winnerId!)).toHaveLength(map.territories.length);
    }
  });
});
