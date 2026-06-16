import { describe, expect, it } from "vitest";
import { classicWorld } from "../maps/classicWorld.ts";

describe("classic world map", () => {
  const ids = new Set(classicWorld.territories.map((t) => t.id));

  it("has 42 territories and 6 regions", () => {
    expect(classicWorld.territories).toHaveLength(42);
    expect(classicWorld.regions).toHaveLength(6);
  });

  it("references only territories that exist in adjacency lists", () => {
    for (const t of classicWorld.territories) {
      for (const adj of t.adjacentTo) {
        expect(ids.has(adj), `${t.id} -> ${adj}`).toBe(true);
      }
    }
  });

  it("has fully symmetric adjacency", () => {
    const adj = new Map(classicWorld.territories.map((t) => [t.id, new Set(t.adjacentTo)]));
    for (const t of classicWorld.territories) {
      for (const neighbor of t.adjacentTo) {
        expect(adj.get(neighbor)?.has(t.id), `${neighbor} should border ${t.id}`).toBe(true);
      }
    }
  });

  it("assigns every territory to exactly one region", () => {
    const assigned = classicWorld.regions.flatMap((r) => r.territoryIds);
    expect(new Set(assigned).size).toBe(42);
    expect(assigned).toHaveLength(42);
    for (const t of classicWorld.territories) {
      const region = classicWorld.regions.find((r) => r.id === t.regionId);
      expect(region?.territoryIds).toContain(t.id);
    }
  });

  it("keeps positions within the unit square", () => {
    for (const t of classicWorld.territories) {
      expect(t.position.x).toBeGreaterThanOrEqual(0);
      expect(t.position.x).toBeLessThanOrEqual(1);
      expect(t.position.y).toBeGreaterThanOrEqual(0);
      expect(t.position.y).toBeLessThanOrEqual(1);
    }
  });
});
