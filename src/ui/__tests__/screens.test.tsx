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
import { BattleReportModal, SeasonReportCard } from "../Reports.tsx";
import type { BattleReport } from "../../engine/index.ts";
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

  it("offers a redeploy control for retainers when you hold more than one province", () => {
    expect(html).toContain("Post to");
    expect(html).toContain("<select");
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

describe("reports", () => {
  const report: BattleReport = {
    turn: 5,
    provinceId: "yuzhou",
    provinceName: "Yu Province",
    attackerId: "dong-zhuo",
    attackerName: "Dong Zhuo",
    defenderId: "cao-cao",
    defenderName: "Cao Cao",
    attackerType: "cavalry",
    defenderType: "spearmen",
    attackerOfficer: "Lü Bu",
    defenderOfficer: "Xiahou Dun",
    attackerStart: 30000,
    attackerEnd: 24000,
    defenderStart: 8000,
    defenderEnd: 0,
    events: [
      { kind: "duel", against: "defender", damage: 900, message: "Lü Bu bests Xiahou Dun in single combat" },
      { kind: "rout", against: "defender", damage: 0, message: "The province falls!" },
    ],
    captured: true,
    capturedOfficer: "Xiahou Dun",
    waterCrossing: false,
  };

  it("battle report modal shows outcome, sides, tactical events and captures", () => {
    const html = renderToStaticMarkup(<BattleReportModal report={report} onClose={() => undefined} />);
    expect(html).toContain("Victory at Yu Province");
    expect(html).toContain("Lü Bu");
    expect(html).toContain("single combat"); // a tactical event (not the rout line)
    expect(html).not.toContain("The province falls!"); // rout line is filtered
    expect(html).toContain("Captured:");
  });

  it("season report card summarises lost/gained land and deltas", () => {
    const html = renderToStaticMarkup(
      <SeasonReportCard
        report={{ year: 194, season: "autumn", lost: [{ id: "sili", name: "Sili (Capital)" }], gained: [], troopsDelta: -3000, goldDelta: 220 }}
        onClose={() => undefined}
      />,
    );
    expect(html).toContain("While you were away");
    expect(html).toContain("Lost: Sili");
    expect(html).toContain("Troops -3,000");
    expect(html).toContain("Gold +220");
  });
});
