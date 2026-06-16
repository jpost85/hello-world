import { describe, expect, it } from "vitest";
import { napoleonMap } from "../maps/napoleon.ts";

describe("Napoleonic Europe map", () => {
  const ids = new Set(napoleonMap.territories.map((t) => t.id));

  it("is a 24-territory European theatre with 6 regions", () => {
    expect(napoleonMap.territories.length).toBeGreaterThanOrEqual(20);
    expect(napoleonMap.territories.length).toBeLessThanOrEqual(32);
    expect(napoleonMap.regions).toHaveLength(6);
    expect(napoleonMap.viewBox).toMatch(/^0 0 1000 \d+$/);
  });

  it("gives every territory real geometry and an in-bounds centroid", () => {
    const [, , w, h] = napoleonMap.viewBox!.split(" ").map(Number);
    for (const t of napoleonMap.territories) {
      expect(t.path, t.id).toMatch(/^M.*Z$/);
      expect(t.position.x).toBeGreaterThanOrEqual(0);
      expect(t.position.x).toBeLessThanOrEqual(w);
      expect(t.position.y).toBeGreaterThanOrEqual(0);
      expect(t.position.y).toBeLessThanOrEqual(h);
    }
  });

  it("has symmetric adjacency referencing only real territories", () => {
    const adj = new Map(napoleonMap.territories.map((t) => [t.id, new Set(t.adjacentTo)]));
    for (const t of napoleonMap.territories) {
      for (const n of t.adjacentTo) {
        expect(ids.has(n), `${t.id} -> ${n}`).toBe(true);
        expect(adj.get(n)?.has(t.id), `${n} should border ${t.id}`).toBe(true);
      }
    }
  });

  it("is fully connected so the campaign is winnable", () => {
    const adj = new Map(napoleonMap.territories.map((t) => [t.id, t.adjacentTo]));
    const seen = new Set([napoleonMap.territories[0].id]);
    const queue = [napoleonMap.territories[0].id];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const n of adj.get(cur)!) if (!seen.has(n)) (seen.add(n), queue.push(n));
    }
    expect(seen.size).toBe(napoleonMap.territories.length);
  });

  it("models key theatres of the war", () => {
    const borders = (a: string, b: string) =>
      napoleonMap.territories.find((t) => t.id === a)?.adjacentTo.includes(b);
    expect(borders("britain", "france")).toBe(true); // English Channel
    expect(borders("france", "spain")).toBe(true); // Peninsular War
    expect(borders("duchy-of-warsaw", "russia-north")).toBe(true); // 1812 invasion route
    expect(borders("ottoman", "greece")).toBe(true);
  });
});
