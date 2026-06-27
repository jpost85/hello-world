import { describe, it, expect } from "vitest";
import { createStarterCreature, computeStats } from "../CreatureModel";
import { availableEvolutions, evolve } from "../EvolutionSystem";
import { awardForEating } from "../EconomySystem";
import { resolveBite, canEat } from "../CombatSystem";
import {
  isBossReady,
  bossForEra,
  defeatBoss,
  canAdvanceEra,
  advanceEra,
} from "../ProgressionSystem";
import { pickSpawn, enemiesForEra } from "../EcosystemSystem";
import { tickSurvival, feed, maxHunger } from "../SurvivalSystem";
import { ENEMY_BY_ID } from "../../data/enemies";

describe("CreatureModel", () => {
  it("derives stats by summing equipped parts", () => {
    const c = createStarterCreature("era.primordial");
    const stats = computeStats(c);
    expect(stats.maxHealth).toBe(10); // body.cell only
    expect(c.currentHealth).toBe(stats.maxHealth);
  });
});

describe("EvolutionSystem", () => {
  it("offers tier-1 starters for empty slots", () => {
    const c = createStarterCreature("era.primordial");
    const ids = availableEvolutions(c).map((o) => o.part.id);
    expect(ids).toContain("fins.flagella");
    expect(ids).toContain("armor.membrane");
  });

  it("rejects evolutions you cannot afford and deducts cost when you can", () => {
    let c = createStarterCreature("era.primordial");
    expect(evolve(c, "mouth.maw").ok).toBe(false); // 0 points

    c = awardForEating(c, ENEMY_BY_ID["predatorcell"]); // +28
    const res = evolve(c, "mouth.maw"); // cost 30 -> still too expensive
    expect(res.ok).toBe(false);

    c = awardForEating(c, ENEMY_BY_ID["predatorcell"]); // +28 => 56
    const ok = evolve(c, "mouth.maw");
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.creature.evoPoints).toBe(56 - 30);
      expect(ok.creature.parts.mouth).toBe("mouth.maw");
      expect(computeStats(ok.creature).attack).toBe(6);
    }
  });
});

describe("CombatSystem", () => {
  it("lets a stronger mouth defeat prey and resolves bite-back", () => {
    let c = createStarterCreature("era.primordial");
    // give it a real mouth via two feeds + evolve
    c = awardForEating(c, ENEMY_BY_ID["predatorcell"]);
    c = awardForEating(c, ENEMY_BY_ID["predatorcell"]);
    const evolved = evolve(c, "mouth.maw");
    if (!evolved.ok) throw new Error("setup failed");

    const enemy = ENEMY_BY_ID["plankton"];
    const out = resolveBite(evolved.creature, enemy, enemy.stats.maxHealth);
    expect(out.enemyDefeated).toBe(true);
    expect(out.damageToPlayer).toBe(0);
  });

  it("gates eating by size", () => {
    const c = createStarterCreature("era.primordial");
    expect(canEat(computeStats(c), ENEMY_BY_ID["plankton"])).toBe(true);
    expect(canEat(computeStats(c), ENEMY_BY_ID["predatorcell"])).toBe(false);
  });
});

describe("ProgressionSystem (boss-gated)", () => {
  it("summons a boss at threshold and only advances after it's beaten", () => {
    let c = createStarterCreature("era.primordial");
    expect(isBossReady(c)).toBe(false);
    expect(canAdvanceEra(c)).toBe(false);

    c = { ...c, evoPoints: 120 }; // era.primordial advanceAtPoints
    expect(isBossReady(c)).toBe(true);
    expect(canAdvanceEra(c)).toBe(false); // boss not yet beaten
    expect(bossForEra(c.eraId)?.id).toBe("boss.amoeba");

    c = defeatBoss(c);
    expect(isBossReady(c)).toBe(false); // boss is down
    expect(canAdvanceEra(c)).toBe(true);

    c = advanceEra(c);
    expect(c.eraId).toBe("era.fish");
    expect(c.bossDefeated).toBe(false); // gate resets for the new era
  });
});

describe("SurvivalSystem", () => {
  it("drains hunger over time and refills on eating", () => {
    const c = createStarterCreature("era.primordial");
    expect(c.hunger).toBe(maxHunger(c));

    const hungry = tickSurvival(c, 2);
    expect(hungry.hunger).toBeLessThan(c.hunger);

    const fed = feed(hungry, ENEMY_BY_ID["predatorcell"]);
    expect(fed.hunger).toBeGreaterThan(hungry.hunger);
    expect(fed.hunger).toBeLessThanOrEqual(maxHunger(fed));
  });

  it("starves health once hunger hits zero", () => {
    const c = { ...createStarterCreature("era.primordial"), hunger: 0 };
    const after = tickSurvival(c, 1);
    expect(after.currentHealth).toBeLessThan(c.currentHealth);
  });
});

describe("EcosystemSystem", () => {
  it("only spawns enemies from the current era", () => {
    const roster = enemiesForEra("era.primordial").map((e) => e.id);
    expect(roster).not.toContain("trilobite");
    for (let roll = 0; roll < 1; roll += 0.1) {
      expect(roster).toContain(pickSpawn("era.primordial", roll)!.id);
    }
  });
});
