import { describe, it, expect } from "vitest";
import { chinaMap } from "../maps/china.ts";

describe("china map", () => {
  it("has the twelve Han provinces", () => {
    expect(chinaMap.provinces).toHaveLength(12);
  });

  it("has symmetric adjacency", () => {
    const byId = new Map(chinaMap.provinces.map((p) => [p.id, p]));
    for (const p of chinaMap.provinces) {
      for (const n of p.adjacentTo) {
        const neighbour = byId.get(n);
        expect(neighbour, `${n} (neighbour of ${p.id}) exists`).toBeDefined();
        expect(neighbour!.adjacentTo, `${n} lists ${p.id} back`).toContain(p.id);
      }
    }
  });

  it("is fully connected", () => {
    const adj = new Map(chinaMap.provinces.map((p) => [p.id, p.adjacentTo]));
    const seen = new Set([chinaMap.provinces[0].id]);
    const queue = [chinaMap.provinces[0].id];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const n of adj.get(cur) ?? []) if (!seen.has(n)) (seen.add(n), queue.push(n));
    }
    expect(seen.size).toBe(chinaMap.provinces.length);
  });

  it("assigns every province to a declared region", () => {
    const regionIds = new Set(chinaMap.regions.map((r) => r.id));
    for (const p of chinaMap.provinces) expect(regionIds).toContain(p.regionId);
    const provIds = new Set(chinaMap.provinces.map((p) => p.id));
    for (const r of chinaMap.regions) for (const id of r.provinceIds) expect(provIds).toContain(id);
  });

  it("renders an organic (path-based) shape for every province", () => {
    for (const p of chinaMap.provinces) {
      expect(p.path, `${p.id} has a path`).toBeTruthy();
      expect(p.path!.length, `${p.id} path is non-trivial`).toBeGreaterThan(20);
    }
  });
});
