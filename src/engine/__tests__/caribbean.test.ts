import { describe, expect, it } from "vitest";
import { caribbeanMap } from "../maps/caribbean.ts";

describe("Caribbean theatre map", () => {
  const ids = new Set(caribbeanMap.territories.map((t) => t.id));

  it("is a compact regional board with 5 regions", () => {
    expect(caribbeanMap.territories.length).toBeGreaterThanOrEqual(12);
    expect(caribbeanMap.territories.length).toBeLessThanOrEqual(28);
    expect(caribbeanMap.regions).toHaveLength(5);
    expect(caribbeanMap.viewBox).toMatch(/^0 0 1000 \d+$/);
  });

  it("gives every territory real geometry and an in-bounds centroid", () => {
    const [, , w, h] = caribbeanMap.viewBox!.split(" ").map(Number);
    for (const t of caribbeanMap.territories) {
      expect(t.path, t.id).toMatch(/^M.*Z$/);
      expect(t.position.x).toBeGreaterThanOrEqual(0);
      expect(t.position.x).toBeLessThanOrEqual(w);
      expect(t.position.y).toBeGreaterThanOrEqual(0);
      expect(t.position.y).toBeLessThanOrEqual(h);
    }
  });

  it("has symmetric adjacency referencing only real territories", () => {
    const adj = new Map(caribbeanMap.territories.map((t) => [t.id, new Set(t.adjacentTo)]));
    for (const t of caribbeanMap.territories) {
      for (const n of t.adjacentTo) {
        expect(ids.has(n), `${t.id} -> ${n}`).toBe(true);
        expect(adj.get(n)?.has(t.id), `${n} should border ${t.id}`).toBe(true);
      }
    }
  });

  it("is fully connected (so the theatre is winnable)", () => {
    const adj = new Map(caribbeanMap.territories.map((t) => [t.id, t.adjacentTo]));
    const seen = new Set([caribbeanMap.territories[0].id]);
    const queue = [caribbeanMap.territories[0].id];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const n of adj.get(cur)!) if (!seen.has(n)) (seen.add(n), queue.push(n));
    }
    expect(seen.size).toBe(caribbeanMap.territories.length);
  });

  it("links the island chain and mainland by expected sea routes", () => {
    const borders = (a: string, b: string) =>
      caribbeanMap.territories.find((t) => t.id === a)?.adjacentTo.includes(b);
    expect(borders("florida", "cuba")).toBe(true);
    expect(borders("trinidad-tobago", "venezuela")).toBe(true);
    expect(borders("dominican-republic", "puerto-rico")).toBe(true);
    expect(borders("haiti", "dominican-republic")).toBe(true); // land border on Hispaniola
  });
});
