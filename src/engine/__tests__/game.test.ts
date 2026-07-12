import { describe, it, expect } from "vitest";
import {
  areAllied,
  atPeace,
  commandPointsFor,
  createGame,
  cultivate,
  currentPlayer,
  deployOfficer,
  develop,
  endTurn,
  executePrisoner,
  fortify,
  march,
  proposePact,
  provincesOf,
  recruit,
  recruitableIn,
  recruitOfficer,
  relationOf,
  scheme,
  train,
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
  it("develop spends gold and raises commerce and order", () => {
    const s = newGame();
    const prov = provincesOf(s, currentPlayer(s).id)[0];
    const before = s.provinces[prov];
    const after = develop(s, prov).provinces[prov];
    expect(after.gold).toBe(before.gold - CONFIG.develop.goldCost);
    expect(after.commerce).toBeGreaterThan(before.commerce);
    expect(after.order).toBeGreaterThanOrEqual(before.order);
  });

  it("cultivate raises agriculture; train raises troop training", () => {
    const s = newGame();
    const prov = provincesOf(s, currentPlayer(s).id)[0];
    expect(cultivate(s, prov).provinces[prov].agriculture).toBeGreaterThan(s.provinces[prov].agriculture);
    expect(train(s, prov).provinces[prov].training).toBeGreaterThan(s.provinces[prov].training);
  });

  it("fortify raises the wall level toward its cap", () => {
    const s = newGame();
    const prov = provincesOf(s, currentPlayer(s).id)[0];
    const after = fortify(s, prov).provinces[prov];
    expect(after.wallLevel).toBe(s.provinces[prov].wallLevel + 1);
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

  it("deployOfficer reposts a retainer to another owned province", () => {
    const s = newGame(); // Dong Zhuo holds sili + liangzhou; Lü Bu starts in sili
    expect(s.officers.find((o) => o.id === "lu-bu")!.provinceId).toBe("sili");
    const out = deployOfficer(s, "lu-bu", "liangzhou");
    expect(out.officers.find((o) => o.id === "lu-bu")!.provinceId).toBe("liangzhou");
    expect(out.commandPointsRemaining).toBe(s.commandPointsRemaining - 1);
  });

  it("deployOfficer refuses a province you do not hold and a foreign officer", () => {
    const s = newGame();
    expect(() => deployOfficer(s, "lu-bu", "yuzhou")).toThrow(/hold the destination/);
    expect(() => deployOfficer(s, "cao-cao", "sili")).toThrow(/does not serve you/);
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

  it("records a battle report on the state after an attack", () => {
    let s = newGame();
    s = { ...s, provinces: { ...s.provinces, sili: { ...s.provinces["sili"], troops: 60000 } } };
    const out = march(s, "sili", "yuzhou", 55000);
    const r = out.lastBattle!;
    expect(r).not.toBeNull();
    expect(r.attackerId).toBe("dong-zhuo");
    expect(r.defenderId).toBe("cao-cao");
    expect(r.provinceName).toMatch(/Yu/);
    expect(r.captured).toBe(true);
    expect(r.attackerStart).toBe(55000);
  });

  it("rejects marching to a non-adjacent province", () => {
    const s = newGame();
    expect(() => march(s, "sili", "jiaozhou", 1000)).toThrow(/border/);
  });

  it("an unsupplied march outruns its grain and is noted in the log", () => {
    let s = newGame();
    s = { ...s, provinces: { ...s.provinces, sili: { ...s.provinces["sili"], troops: 60000, food: 0 } } };
    const out = march(s, "sili", "yuzhou", 50000);
    expect(out.events.some((e) => /supply/.test(e.message))).toBe(true);
  });
});

describe("prisoners", () => {
  function withCaptive(): ReturnType<typeof newGame> {
    const s = newGame(); // current player is Dong Zhuo
    return {
      ...s,
      officers: s.officers.map((o) =>
        o.id === "guo-jia" ? { ...o, ownerId: null, captiveOf: "dong-zhuo", provinceId: "sili" } : o,
      ),
    };
  }

  it("a held prisoner is recruitable in the holding province", () => {
    const s = withCaptive();
    expect(recruitableIn(s, "sili", "dong-zhuo").some((o) => o.id === "guo-jia")).toBe(true);
    expect(() => recruitOfficer(s, "sili", "guo-jia")).not.toThrow();
  });

  it("executing a prisoner kills them and hardens rivals against you", () => {
    const s = withCaptive();
    const out = executePrisoner(s, "guo-jia");
    expect(out.officers.find((o) => o.id === "guo-jia")!.alive).toBe(false);
    expect(relationOf(out, "dong-zhuo", "yuan-shao")).toBeLessThan(0);
  });
});

describe("diplomacy", () => {
  it("a ceasefire is accepted from neutral relations and forbids attacking", () => {
    const s = newGame(); // Dong Zhuo, neutral (0) relations with all
    const out = proposePact(s, "cao-cao", "ceasefire");
    expect(atPeace(out, "dong-zhuo", "cao-cao")).toBe(true);
    expect(() => march(out, "sili", "yuzhou", 1000)).toThrow(/pact/);
  });

  it("an alliance offer is rebuffed when relations are merely neutral", () => {
    const s = newGame();
    const out = proposePact(s, "cao-cao", "alliance");
    expect(areAllied(out, "dong-zhuo", "cao-cao")).toBe(false);
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
