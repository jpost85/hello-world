import { describe, expect, it } from "vitest";
import { worldMap } from "../maps/worldMap.ts";

describe("world map (generated from Natural Earth)", () => {
  const ids = new Set(worldMap.territories.map((t) => t.id));

  it("has a curated set of territories across 9 continents", () => {
    expect(worldMap.territories.length).toBeGreaterThanOrEqual(50);
    expect(worldMap.territories.length).toBeLessThanOrEqual(90);
    expect(worldMap.regions).toHaveLength(9);
    expect(worldMap.viewBox).toBe("0 0 1000 500");
  });

  it("gives every territory real geometry and an in-bounds centroid", () => {
    for (const t of worldMap.territories) {
      expect(t.path, t.id).toMatch(/^M.*Z$/);
      expect(t.position.x).toBeGreaterThanOrEqual(0);
      expect(t.position.x).toBeLessThanOrEqual(1000);
      expect(t.position.y).toBeGreaterThanOrEqual(0);
      expect(t.position.y).toBeLessThanOrEqual(500);
    }
  });

  it("references only real territories in adjacency lists", () => {
    for (const t of worldMap.territories) {
      for (const adj of t.adjacentTo) {
        expect(ids.has(adj), `${t.id} -> ${adj}`).toBe(true);
      }
    }
  });

  it("has fully symmetric adjacency", () => {
    const adj = new Map(worldMap.territories.map((t) => [t.id, new Set(t.adjacentTo)]));
    for (const t of worldMap.territories) {
      for (const n of t.adjacentTo) {
        expect(adj.get(n)?.has(t.id), `${n} should border ${t.id}`).toBe(true);
      }
    }
  });

  it("assigns every territory to exactly one region", () => {
    const assigned = worldMap.regions.flatMap((r) => r.territoryIds);
    expect(new Set(assigned).size).toBe(worldMap.territories.length);
    for (const t of worldMap.territories) {
      const region = worldMap.regions.find((r) => r.id === t.regionId);
      expect(region?.territoryIds, t.id).toContain(t.id);
    }
  });

  it("is a fully connected graph (every territory reachable — so winnable)", () => {
    const adj = new Map(worldMap.territories.map((t) => [t.id, t.adjacentTo]));
    const start = worldMap.territories[0].id;
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const n of adj.get(cur)!) if (!seen.has(n)) (seen.add(n), queue.push(n));
    }
    expect(seen.size).toBe(worldMap.territories.length);
  });

  it("connects continents via expected sea routes", () => {
    const borders = (a: string, b: string) =>
      worldMap.territories.find((t) => t.id === a)?.adjacentTo.includes(b);
    expect(borders("alaska", "far-east-russia")).toBe(true); // Bering Strait
    expect(borders("united-kingdom", "france")).toBe(true); // English Channel
    expect(borders("indonesia", "western-australia")).toBe(true);
    expect(borders("iberia", "maghreb")).toBe(true); // Strait of Gibraltar
  });
});
