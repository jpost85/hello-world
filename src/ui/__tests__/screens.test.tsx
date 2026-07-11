/**
 * Render smoke tests for the Court and Diplomacy screens. They mount each screen
 * against a real engine state (including a held prisoner and a standing pact) and
 * assert the key information and verbs are present — cheap insurance that the
 * components stay wired to the engine schema as it evolves.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { chinaMap, createGame, type GameState } from "../../engine/index.ts";
import { OfficerScreen } from "../OfficerScreen.tsx";
import { DiplomacyScreen } from "../DiplomacyScreen.tsx";
import { MapView } from "../MapView.tsx";
import type { UseGame } from "../useGame.ts";

// A no-op stand-in for the action hook — rendering never invokes the verbs.
const noopGame = new Proxy({}, { get: () => () => undefined }) as unknown as UseGame;

function scenario(): GameState {
  const s = createGame({ map: chinaMap, humanFactionId: "dong-zhuo", seed: 7 });
  return {
    ...s,
    officers: s.officers.map((o) =>
      o.id === "guo-jia" ? { ...o, ownerId: null, captiveOf: "dong-zhuo", provinceId: "sili" } : o,
    ),
    pacts: [{ a: "cao-cao", b: "dong-zhuo", kind: "ceasefire", untilTurn: s.turn + 6 }],
    relations: { "cao-cao|dong-zhuo": 25 },
  };
}

describe("OfficerScreen", () => {
  const html = renderToStaticMarkup(
    <OfficerScreen state={scenario()} humanId="dong-zhuo" isHumanTurn game={noopGame} onClose={() => undefined} />,
  );

  it("lists a held prisoner with the recruit/release/execute verbs", () => {
    expect(html).toContain("Guo Jia");
    expect(html).toContain("Recruit");
    expect(html).toContain("Release");
    expect(html).toContain("Execute");
  });

  it("surfaces retainers with their traits and treasures", () => {
    expect(html).toContain("Lü Bu");
    expect(html).toContain("Valiant"); // a trait badge
    expect(html).toContain("Red Hare"); // an item badge
  });
});

describe("MapView", () => {
  const html = renderToStaticMarkup(
    <MapView state={scenario()} humanId="dong-zhuo" selectedId={null} targetIds={[]} onSelect={() => undefined} />,
  );

  it("renders provinces inside a transformable group and offers zoom controls", () => {
    expect(html).toContain("map-stage");
    expect(html).toContain("zoom-controls");
    expect(html).toContain("Zoom in");
    expect(html).toContain("Reset view");
    expect(html).toContain("<path"); // at least one province path
    expect(html).toContain("scale(1)"); // the pan/zoom group transform
  });
});

describe("DiplomacyScreen", () => {
  const html = renderToStaticMarkup(
    <DiplomacyScreen state={scenario()} humanId="dong-zhuo" isHumanTurn game={noopGame} onClose={() => undefined} />,
  );

  it("lists rival warlords and their strength", () => {
    expect(html).toContain("Cao Cao");
    expect(html).toContain("Yuan Shao");
    expect(html).toContain("prov");
  });

  it("shows the standing ceasefire with a way to break it", () => {
    expect(html).toContain("Ceasefire");
    expect(html).toContain("Break Pact");
  });
});
