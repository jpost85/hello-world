import { describe, expect, it } from "vitest";
import { DEFAULT_FACTIONS, FACTION_POOL, availableFactions, rosterFor } from "../factions.ts";
import { MAP_REGISTRY, mapInfo } from "../maps/registry.ts";

describe("faction rosters", () => {
  it("uses generic factions for maps without a roster", () => {
    expect(rosterFor(undefined, 4)).toEqual(DEFAULT_FACTIONS.slice(0, 4));
  });

  it("maps roster ids to great powers in order", () => {
    const r = rosterFor(["france", "britain", "russia"], 3);
    expect(r.map((f) => f.id)).toEqual(["france", "britain", "russia"]);
    expect(r[0].name).toBe("French");
  });

  it("tops up a short roster with neutral fillers to reach the player count", () => {
    const r = rosterFor(["britain", "france"], 5);
    expect(r).toHaveLength(5);
    expect(r.slice(0, 2).map((f) => f.id)).toEqual(["britain", "france"]);
    expect(new Set(r.map((f) => f.id)).size).toBe(5); // all distinct
  });

  it("gives every registry roster distinct colours for up to 6 players", () => {
    for (const m of MAP_REGISTRY) {
      const r = rosterFor(m.factionIds, 6);
      const colors = r.map((f) => f.color);
      expect(new Set(colors).size, `${m.id} has duplicate colours`).toBe(colors.length);
    }
  });

  it("exposes minor/regional factions through a map's available list", () => {
    const india = availableFactions(mapInfo("india").factionIds).map((f) => f.id);
    expect(india).toContain("maratha");
    expect(india).toContain("mysore");
    expect(india).toContain("sikh");
    expect(india).toContain("mughal");
    expect(FACTION_POOL["ethiopia"]).toBeDefined();
    expect(FACTION_POOL["mamluks"]).toBeDefined();
  });

  it("references only factions that exist in the pool for every roster", () => {
    for (const m of MAP_REGISTRY) {
      for (const id of m.factionIds ?? []) {
        expect(FACTION_POOL[id], `${m.id} -> ${id}`).toBeDefined();
      }
    }
  });
});
