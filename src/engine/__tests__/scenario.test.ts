import { describe, expect, it } from "vitest";
import { createGame } from "../game.ts";
import { FACTION_POOL } from "../factions.ts";
import { mapInfo } from "../maps/registry.ts";
import { indiaMap } from "../maps/indiaSubcontinent.ts";
import { nearEastMap } from "../maps/nearEast.ts";
import { caribbeanMap } from "../maps/caribbean.ts";

describe("India colonial scenario", () => {
  it("starts each European enclave under its historical power", () => {
    const info = mapInfo("india");
    // Seat the five colonial powers (plus one Indian power).
    const factionIds = ["britain", "france", "portugal", "netherlands", "denmark", "maratha"];
    const factions = factionIds.map((id) => FACTION_POOL[id]);
    const game = createGame({
      map: indiaMap,
      factions,
      players: factionIds.map((id) => ({ name: id, factionId: id, isAI: true })),
      seed: 7,
      startPositions: info.startPositions,
    });
    const ownerFaction = (terr: string) => {
      const ownerId = game.territories[terr].ownerId;
      return game.players.find((p) => p.id === ownerId)!.factionId;
    };
    expect(ownerFaction("calcutta")).toBe("britain");
    expect(ownerFaction("bombay")).toBe("britain");
    expect(ownerFaction("madras")).toBe("britain");
    expect(ownerFaction("goa")).toBe("portugal");
    expect(ownerFaction("pondicherry")).toBe("france");
    expect(ownerFaction("cochin")).toBe("netherlands");
    expect(ownerFaction("tranquebar")).toBe("denmark");
  });
});

describe("Near East colonial scenario", () => {
  it("starts the Mediterranean and Egyptian enclaves under their powers", () => {
    const info = mapInfo("near-east");
    const factionIds = info.factionIds!;
    const factions = factionIds.map((id) => FACTION_POOL[id]);
    const game = createGame({
      map: nearEastMap,
      factions,
      players: factionIds.map((id) => ({ name: id, factionId: id, isAI: true })),
      seed: 11,
      startPositions: info.startPositions,
    });
    const ownerFaction = (terr: string) =>
      game.players.find((p) => p.id === game.territories[terr].ownerId)!.factionId;
    expect(ownerFaction("malta")).toBe("britain");
    expect(ownerFaction("aden")).toBe("britain");
    expect(ownerFaction("alexandria")).toBe("france");
    expect(ownerFaction("acre")).toBe("ottoman");
    expect(ownerFaction("lower-egypt")).toBe("mamluks");
  });
});

describe("Caribbean colonial scenario", () => {
  it("seats the powers in their historical Caribbean holdings", () => {
    const info = mapInfo("caribbean");
    const factionIds = info.factionIds!;
    const factions = factionIds.map((id) => FACTION_POOL[id]);
    const game = createGame({
      map: caribbeanMap,
      factions,
      players: factionIds.map((id) => ({ name: id, factionId: id, isAI: true })),
      seed: 5,
      startPositions: info.startPositions,
    });
    const ownerFaction = (terr: string) =>
      game.players.find((p) => p.id === game.territories[terr].ownerId)!.factionId;
    expect(ownerFaction("cuba")).toBe("spain");
    expect(ownerFaction("florida")).toBe("spain");
    expect(ownerFaction("jamaica")).toBe("britain");
    expect(ownerFaction("belize")).toBe("britain");
    expect(ownerFaction("haiti")).toBe("france");
    // Every player still receives at least one territory (no empty seats).
    for (const p of game.players) {
      expect(Object.values(game.territories).some((t) => t.ownerId === p.id)).toBe(true);
    }
  });
});
