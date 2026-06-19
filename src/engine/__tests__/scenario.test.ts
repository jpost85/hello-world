import { describe, expect, it } from "vitest";
import { createGame } from "../game.ts";
import { FACTION_POOL } from "../factions.ts";
import { mapInfo } from "../maps/registry.ts";
import { indiaMap } from "../maps/indiaSubcontinent.ts";
import { nearEastMap } from "../maps/nearEast.ts";
import { caribbeanMap } from "../maps/caribbean.ts";
import { crimeaMap } from "../maps/crimea.ts";
import { africaMap } from "../maps/africaScramble.ts";

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
    expect(ownerFaction("egypt-nile")).toBe("mamluks");
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

describe("Crimean War scenario", () => {
  it("entrenches Russia and the Ottomans, with no empty seats", () => {
    const info = mapInfo("crimea");
    const factionIds = info.factionIds!;
    const factions = factionIds.map((id) => FACTION_POOL[id]);
    const game = createGame({
      map: crimeaMap,
      factions,
      players: factionIds.map((id) => ({ name: id, factionId: id, isAI: true })),
      seed: 9,
      startPositions: info.startPositions,
    });
    const ownerFaction = (terr: string) =>
      game.players.find((p) => p.id === game.territories[terr].ownerId)!.factionId;
    expect(ownerFaction("crimea")).toBe("russia");
    expect(ownerFaction("ukraine")).toBe("russia");
    expect(ownerFaction("anatolia")).toBe("ottoman");
    for (const p of game.players) {
      expect(Object.values(game.territories).some((t) => t.ownerId === p.id)).toBe(true);
    }
  });
});

describe("Scramble for Africa scenario", () => {
  it("partitions Africa among the colonial powers", () => {
    const info = mapInfo("africa-scramble");
    const factionIds = info.factionIds!.slice(0, 6); // britain, france, germany, italy, portugal, belgium
    const factions = factionIds.map((id) => FACTION_POOL[id]);
    const game = createGame({
      map: africaMap,
      factions,
      players: factionIds.map((id) => ({ name: id, factionId: id, isAI: true })),
      seed: 4,
      startPositions: info.startPositions,
    });
    const ownerFaction = (terr: string) =>
      game.players.find((p) => p.id === game.territories[terr].ownerId)!.factionId;
    expect(ownerFaction("algeria")).toBe("france");
    expect(ownerFaction("nigeria")).toBe("britain");
    expect(ownerFaction("tanzania")).toBe("germany");
    expect(ownerFaction("congo")).toBe("belgium");
    expect(ownerFaction("angola")).toBe("portugal");
    for (const p of game.players) {
      expect(Object.values(game.territories).some((t) => t.ownerId === p.id)).toBe(true);
    }
  });
});
