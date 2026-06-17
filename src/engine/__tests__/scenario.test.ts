import { describe, expect, it } from "vitest";
import { createGame } from "../game.ts";
import { FACTION_POOL } from "../factions.ts";
import { mapInfo } from "../maps/registry.ts";
import { indiaMap } from "../maps/indiaSubcontinent.ts";

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
