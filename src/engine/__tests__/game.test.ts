import { describe, it, expect } from "vitest";
import {
  commandPointsFor,
  createGame,
  currentPlayer,
  develop,
  endTurn,
  march,
  provincesOf,
  recruit,
  scheme,
} from "../game.ts";
import { chinaMap } from "../maps/china.ts";
import { CONFIG } from "../config.ts";
import type { GameState } from "../types.ts";

function newGame(seed = 1): GameState {
  return createGame({ map: chinaMap, seed });
}

describe("setup", () => {
  it("seats all six warlords and assigns all twelve provinces", () => {
    const s = newGame();
    expect(s.players).toHaveLength(6);
    const owned = Object.values(s.provinces).filter((p) => p.ownerId).length;
    expect(owned).toBe(12);
  });

  it("starts in spring of the command phase with command points", () => {
    const s = newGame();
    expect(s.phase).toBe("command");
    expect(s.season).toBe("spring");
    // Dong Zhuo opens holding two provinces.
    expect(s.commandPointsRemaining).toBe(commandPointsFor(2));
  });

  it("places officers in provinces", () => {
    const s = newGame();
    expect(s.officers.length).toBeGreaterThan(20);
    const lordHeld = s.officers.filter((o) => o.ownerId).length;
    expect(lordHeld).toBeGreaterThan(0);
  });
});

describe("commands", () => {
  it("develop spends gold and raises development and order", () => {
    const s = newGame();
    const prov = provincesOf(s, currentPlayer(s).id)[0];
    const before = s.provinces[prov];
    const after = develop(s, prov).provinces[prov];
    expect(after.gold).toBe(before.gold - CONFIG.develop.goldCost);
    expect(after.development).toBeGreaterThan(before.development);
    expect(after.order).toBeGreaterThanOrEqual(before.order);
  });

  it("recruit trades gold and population for troops", () => {
    const s = newGame();
    const prov = provincesOf(s, currentPlayer(s).id)[0];
    const before = s.provinces[prov];
    const after = recruit(s, prov).provinces[prov];
    expect(after.troops).toBe(before.troops + CONFIG.recruit.troopsGained);
    expect(after.gold).toBe(before.gold - CONFIG.recruit.goldCost);
    expect(after.population).toBe(before.population - CONFIG.recruit.populationCost);
  });

  it("consumes a command point per action and forbids overspending", () => {
    let s = newGame();
    const prov = provincesOf(s, currentPlayer(s).id)[0];
    const cp = s.commandPointsRemaining;
    for (let i = 0; i < cp; i++) s = develop(s, prov);
    expect(s.commandPointsRemaining).toBe(0);
    expect(() => develop(s, prov)).toThrow(/command points/);
  });

  it("rejects acting on a province you do not own", () => {
    const s = newGame();
    const me = currentPlayer(s).id;
    const enemyProv = provincesOf(s, s.players.find((p) => p.id !== me)!.id)[0];
    expect(() => develop(s, enemyProv)).toThrow(/not yours/);
  });

  it("scheme lowers an adjacent enemy province's order", () => {
    const s = newGame(); // Dong Zhuo holds sili, adjacent to Cao Cao's yuzhou
    const before = s.provinces["yuzhou"].order;
    const after = scheme(s, "yuzhou");
    expect(after.provinces["yuzhou"].order).toBeLessThan(before);
  });
});

describe("marching", () => {
  it("reinforces friendly land without a battle", () => {
    const s = newGame(); // Dong Zhuo holds sili + liangzhou (adjacent)
    const out = march(s, "liangzhou", "sili", 2000);
    expect(out.provinces["sili"].troops).toBe(s.provinces["sili"].troops + 2000);
    expect(out.provinces["liangzhou"].troops).toBe(s.provinces["liangzhou"].troops - 2000);
  });

  it("an overwhelming attack captures an enemy province", () => {
    let s = newGame();
    // Stack troops into sili, then storm Cao Cao's yuzhou.
    s = { ...s, provinces: { ...s.provinces, sili: { ...s.provinces["sili"], troops: 60000 } } };
    const out = march(s, "sili", "yuzhou", 55000);
    expect(out.provinces["yuzhou"].ownerId).toBe("dong-zhuo");
  });

  it("rejects marching to a non-adjacent province", () => {
    const s = newGame();
    expect(() => march(s, "sili", "jiaozhou", 1000)).toThrow(/border/);
  });
});

describe("turn rotation", () => {
  it("hands off to the next warlord and advances the season after a full round", () => {
    let s = newGame();
    const first = currentPlayer(s).id;
    s = endTurn(s);
    expect(currentPlayer(s).id).not.toBe(first);
    expect(s.season).toBe("spring");
    for (let i = 0; i < 5; i++) s = endTurn(s);
    expect(currentPlayer(s).id).toBe(first);
    expect(s.season).toBe("summer");
  });
});
