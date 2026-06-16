import { describe, expect, it } from "vitest";
import {
  attack,
  buildFortress,
  createGame,
  currentPlayer,
  endAttack,
  endReinforcement,
  endTurn,
  fortify,
  moveGeneral,
  placeReinforcements,
  FORTRESS_BUILD_COST,
} from "../game.ts";
import { territoriesOf } from "../map.ts";
import { classicWorld } from "../maps/classicWorld.ts";
import { DEFAULT_FACTIONS } from "../factions.ts";
import type { GameMap, GameState } from "../types.ts";

const factions = DEFAULT_FACTIONS;

function newGame(seed = 1): GameState {
  return createGame({
    map: classicWorld,
    factions,
    players: [
      { name: "Alice", factionId: "crimson" },
      { name: "Bob", factionId: "azure" },
    ],
    seed,
  });
}

/** A tiny three-territory line map for fully controlled action tests. */
const lineMap: GameMap = {
  id: "line",
  name: "Line",
  regions: [{ id: "r", name: "R", bonusArmies: 2, territoryIds: ["a", "b", "c"] }],
  territories: [
    { id: "a", name: "A", regionId: "r", adjacentTo: ["b"], position: { x: 0, y: 0 } },
    { id: "b", name: "B", regionId: "r", adjacentTo: ["a", "c"], position: { x: 0.5, y: 0 } },
    { id: "c", name: "C", regionId: "r", adjacentTo: ["b"], position: { x: 1, y: 0 } },
  ],
};

/** Build a controlled game on `lineMap` with explicit ownership/armies. */
function controlled(setup: Record<string, { owner: string; armies: number }>): GameState {
  const game = createGame({
    map: lineMap,
    factions,
    players: [
      { name: "Alice", factionId: "crimson" },
      { name: "Bob", factionId: "azure" },
    ],
    seed: 5,
  });
  const territories = { ...game.territories };
  for (const [id, s] of Object.entries(setup)) {
    territories[id] = { ownerId: s.owner, armies: s.armies, hasFortress: false };
  }
  return { ...game, territories, generals: game.generals.map((g) => ({ ...g, territoryId: null })) };
}

describe("game setup", () => {
  it("deals every territory and the full starting army pool", () => {
    const g = newGame();
    expect(Object.keys(g.territories)).toHaveLength(42);
    for (const ts of Object.values(g.territories)) {
      expect(ts.ownerId).not.toBeNull();
      expect(ts.armies).toBeGreaterThanOrEqual(1);
    }
    const total = Object.values(g.territories).reduce((s, t) => s + t.armies, 0);
    expect(total).toBe(40 * 2); // two players, 40 each
  });

  it("gives each player a deployed general and opening reinforcements", () => {
    const g = newGame();
    expect(g.generals).toHaveLength(2);
    for (const general of g.generals) {
      expect(general.territoryId).not.toBeNull();
      expect(g.territories[general.territoryId!].ownerId).toBe(general.ownerId);
    }
    expect(g.phase).toBe("reinforce");
    expect(g.reinforcementsRemaining).toBeGreaterThanOrEqual(3);
  });

  it("is fully reproducible from a seed", () => {
    expect(newGame(77)).toEqual(newGame(77));
  });

  it("rejects fewer than 2 or more than 6 players", () => {
    expect(() => createGame({ map: classicWorld, factions, players: [{ name: "Solo", factionId: "crimson" }] })).toThrow();
  });
});

describe("reinforce phase", () => {
  it("places armies on owned territory and decrements the pool", () => {
    let g = newGame();
    const me = currentPlayer(g).id;
    const mine = territoriesOf(g, me)[0];
    const before = g.territories[mine].armies;
    const pool = g.reinforcementsRemaining;
    g = placeReinforcements(g, mine, 2);
    expect(g.territories[mine].armies).toBe(before + 2);
    expect(g.reinforcementsRemaining).toBe(pool - 2);
  });

  it("rejects reinforcing enemy territory or over-spending", () => {
    const g = newGame();
    const me = currentPlayer(g).id;
    const enemy = Object.keys(g.territories).find((id) => g.territories[id].ownerId !== me)!;
    expect(() => placeReinforcements(g, enemy, 1)).toThrow();
    expect(() => placeReinforcements(g, territoriesOf(g, me)[0], g.reinforcementsRemaining + 1)).toThrow();
  });

  it("advances to the attack phase", () => {
    const g = endReinforcement(newGame());
    expect(g.phase).toBe("attack");
  });
});

describe("attack phase", () => {
  it("captures a territory when the defender is wiped out", () => {
    let g = controlled({
      a: { owner: "p1", armies: 30 },
      b: { owner: "p2", armies: 1 },
      c: { owner: "p2", armies: 5 },
    });
    g = endReinforcement(g);
    let captured = false;
    // Hammer B from A until it falls (A has overwhelming force).
    for (let i = 0; i < 50 && !captured; i++) {
      const res = attack(g, { from: "a", to: "b" });
      g = res.state;
      captured = res.result.captured || g.territories["b"].ownerId === "p1";
      if (g.territories["a"].armies < 2) break;
    }
    expect(g.territories["b"].ownerId).toBe("p1");
    expect(g.conqueredThisTurn).toBe(true);
    expect(g.territories["b"].armies).toBeGreaterThanOrEqual(1);
  });

  it("rejects attacking non-adjacent or own territory", () => {
    let g = controlled({
      a: { owner: "p1", armies: 10 },
      b: { owner: "p1", armies: 10 },
      c: { owner: "p2", armies: 10 },
    });
    g = endReinforcement(g);
    expect(() => attack(g, { from: "a", to: "c" })).toThrow(); // not adjacent
    expect(() => attack(g, { from: "a", to: "b" })).toThrow(); // own territory
  });

  it("declares a winner when the last opponent is eliminated", () => {
    let g = controlled({
      a: { owner: "p1", armies: 60 },
      b: { owner: "p2", armies: 1 },
      c: { owner: "p1", armies: 5 },
    });
    g = endReinforcement(g);
    for (let i = 0; i < 80; i++) {
      if (g.phase === "gameover") break;
      if (g.territories["a"].armies < 2) break;
      g = attack(g, { from: "a", to: "b" }).state;
    }
    expect(g.phase).toBe("gameover");
    expect(g.winnerId).toBe("p1");
    expect(g.players.find((p) => p.id === "p2")!.isEliminated).toBe(true);
  });
});

describe("fortify phase", () => {
  it("moves armies between connected owned territories", () => {
    let g = controlled({
      a: { owner: "p1", armies: 10 },
      b: { owner: "p1", armies: 1 },
      c: { owner: "p2", armies: 1 },
    });
    g = endAttack(endReinforcement(g));
    g = fortify(g, "a", "b", 5);
    expect(g.territories["a"].armies).toBe(5);
    expect(g.territories["b"].armies).toBe(6);
  });

  it("rejects leaving zero armies behind or crossing enemy land", () => {
    let g = controlled({
      a: { owner: "p1", armies: 3 },
      b: { owner: "p2", armies: 1 },
      c: { owner: "p1", armies: 3 },
    });
    g = endAttack(endReinforcement(g));
    expect(() => fortify(g, "a", "a", 1)).toThrow();
    expect(() => fortify(g, "a", "c", 1)).toThrow(); // blocked by enemy B
    expect(() => fortify(g, "a", "b", 1)).toThrow(); // B is enemy-owned
  });
});

describe("fortresses", () => {
  it("builds a fortress, paying the army cost", () => {
    let g = controlled({ a: { owner: "p1", armies: 5 }, b: { owner: "p2", armies: 1 }, c: { owner: "p2", armies: 1 } });
    g = buildFortress(g, "a");
    expect(g.territories["a"].hasFortress).toBe(true);
    expect(g.territories["a"].armies).toBe(5 - FORTRESS_BUILD_COST);
  });

  it("refuses without enough armies", () => {
    const g = controlled({ a: { owner: "p1", armies: FORTRESS_BUILD_COST }, b: { owner: "p2", armies: 1 }, c: { owner: "p2", armies: 1 } });
    expect(() => buildFortress(g, "a")).toThrow();
  });
});

describe("generals", () => {
  it("redeploys a general across owned, connected land", () => {
    let g = controlled({ a: { owner: "p1", armies: 5 }, b: { owner: "p1", armies: 5 }, c: { owner: "p2", armies: 1 } });
    const general = g.generals.find((gen) => gen.ownerId === "p1")!;
    g = moveGeneral({ ...g, generals: g.generals.map((x) => (x.id === general.id ? { ...x, territoryId: "a" } : x)) }, general.id, "b");
    expect(g.generals.find((x) => x.id === general.id)!.territoryId).toBe("b");
  });

  it("refuses to move a general onto enemy territory", () => {
    const g = controlled({ a: { owner: "p1", armies: 5 }, b: { owner: "p2", armies: 5 }, c: { owner: "p2", armies: 1 } });
    const general = g.generals.find((gen) => gen.ownerId === "p1")!;
    const placed = { ...g, generals: g.generals.map((x) => (x.id === general.id ? { ...x, territoryId: "a" } : x)) };
    expect(() => moveGeneral(placed, general.id, "b")).toThrow();
  });
});

describe("turn rotation", () => {
  it("hands off to the next active player and re-enters reinforce", () => {
    const g = newGame();
    const first = currentPlayer(g).id;
    const next = endTurn(g);
    expect(currentPlayer(next).id).not.toBe(first);
    expect(next.phase).toBe("reinforce");
    expect(next.reinforcementsRemaining).toBeGreaterThan(0);
  });
});
