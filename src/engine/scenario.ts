/**
 * The default historical scenario: "Dong Zhuo Controls the Court", 189 AD.
 *
 * Where Dominion deals territories at random, Romance of the Three Kingdoms is
 * historical — warlords start in fixed provinces with their real retainers. This
 * file is pure data; `game.ts` turns it into a `GameState`. Add more scenarios
 * here later (each is just another `Scenario`).
 */
import type { Faction, Officer } from "./types.ts";

export interface ScenarioOfficer {
  id: string;
  name: string;
  /** Owning faction id, or null for a free (wandering) officer. */
  factionId: string | null;
  /** Province the officer starts in. */
  provinceId: string;
  war: number;
  intellect: number;
  politics: number;
  charisma: number;
  leadership: number;
  loyalty: number;
}

export interface Scenario {
  id: string;
  name: string;
  factions: Faction[];
  /** factionId → provinces the faction starts holding. */
  holdings: Record<string, string[]>;
  officers: ScenarioOfficer[];
}

const f = (id: string, name: string, color: string): Faction => ({ id, name, color });

// Six contending warlords spanning the twelve provinces.
const FACTIONS: Faction[] = [
  f("dong-zhuo", "Dong Zhuo", "#b3322c"),
  f("yuan-shao", "Yuan Shao", "#2f6fb0"),
  f("cao-cao", "Cao Cao", "#d4a72c"),
  f("gongsun-zan", "Gongsun Zan", "#2f9e8f"),
  f("sun-jian", "Sun Jian", "#3f9e4d"),
  f("liu-biao", "Liu Biao", "#7a4fb0"),
];

const HOLDINGS: Record<string, string[]> = {
  "dong-zhuo": ["sili", "liangzhou"],
  "yuan-shao": ["jizhou", "bingzhou"],
  "cao-cao": ["yuzhou", "qingzhou"],
  "gongsun-zan": ["youzhou"],
  "sun-jian": ["xuzhou", "yangzhou", "jiaozhou"],
  "liu-biao": ["jingzhou", "yizhou"],
};

// stats: war, int, pol, cha, lead, loyalty
const o = (
  id: string,
  name: string,
  factionId: string | null,
  provinceId: string,
  war: number,
  intellect: number,
  politics: number,
  charisma: number,
  leadership: number,
  loyalty: number,
): ScenarioOfficer => ({ id, name, factionId, provinceId, war, intellect, politics, charisma, leadership, loyalty });

const OFFICERS: ScenarioOfficer[] = [
  // Dong Zhuo — the tyrant holding Luoyang.
  o("dong-zhuo", "Dong Zhuo", "dong-zhuo", "sili", 80, 62, 24, 40, 86, 100),
  o("lu-bu", "Lü Bu", "dong-zhuo", "sili", 100, 26, 13, 42, 90, 28),
  o("li-ru", "Li Ru", "dong-zhuo", "liangzhou", 38, 92, 80, 60, 50, 90),
  o("hua-xiong", "Hua Xiong", "dong-zhuo", "liangzhou", 89, 30, 22, 38, 76, 82),
  // Yuan Shao — the great northern coalition lord.
  o("yuan-shao", "Yuan Shao", "yuan-shao", "jizhou", 66, 75, 78, 92, 82, 100),
  o("yan-liang", "Yan Liang", "yuan-shao", "jizhou", 92, 38, 30, 46, 80, 84),
  o("wen-chou", "Wen Chou", "yuan-shao", "bingzhou", 91, 36, 28, 44, 79, 84),
  o("tian-feng", "Tian Feng", "yuan-shao", "jizhou", 40, 94, 88, 66, 58, 76),
  // Cao Cao — the cunning hero of chaos.
  o("cao-cao", "Cao Cao", "cao-cao", "yuzhou", 76, 96, 94, 97, 92, 100),
  o("xiahou-dun", "Xiahou Dun", "cao-cao", "yuzhou", 90, 58, 60, 72, 86, 95),
  o("xun-yu", "Xun Yu", "cao-cao", "qingzhou", 38, 98, 96, 88, 60, 92),
  o("guo-jia", "Guo Jia", "cao-cao", "yuzhou", 32, 99, 84, 86, 56, 90),
  // Gongsun Zan — the White Horse general of the frontier.
  o("gongsun-zan", "Gongsun Zan", "gongsun-zan", "youzhou", 84, 54, 50, 66, 80, 100),
  o("zhao-yun", "Zhao Yun", "gongsun-zan", "youzhou", 96, 76, 70, 84, 88, 70),
  // Sun Jian — the Tiger of Jiangdong.
  o("sun-jian", "Sun Jian", "sun-jian", "yangzhou", 91, 70, 66, 84, 90, 100),
  o("sun-ce", "Sun Ce", "sun-jian", "yangzhou", 93, 68, 64, 90, 89, 96),
  o("zhou-yu", "Zhou Yu", "sun-jian", "xuzhou", 72, 96, 86, 92, 94, 90),
  o("huang-gai", "Huang Gai", "sun-jian", "jiaozhou", 80, 64, 60, 62, 78, 92),
  // Liu Biao — the scholarly governor of Jing.
  o("liu-biao", "Liu Biao", "liu-biao", "jingzhou", 58, 72, 78, 80, 70, 100),
  o("huang-zhong", "Huang Zhong", "liu-biao", "jingzhou", 93, 60, 52, 70, 84, 80),
  o("kuai-liang", "Kuai Liang", "liu-biao", "jingzhou", 36, 90, 88, 70, 54, 86),
  o("liu-zhang", "Liu Zhang", "liu-biao", "yizhou", 40, 50, 60, 58, 56, 74),

  // Wandering heroes — not yet sworn to any lord (ownerId resolves to null).
  o("liu-bei", "Liu Bei", null, "youzhou", 73, 78, 80, 99, 82, 100),
  o("guan-yu", "Guan Yu", null, "youzhou", 97, 75, 62, 88, 94, 100),
  o("zhang-fei", "Zhang Fei", null, "youzhou", 98, 44, 30, 58, 86, 100),
  o("zhuge-liang", "Zhuge Liang", null, "jingzhou", 38, 100, 98, 92, 90, 100),
  o("sima-yi", "Sima Yi", null, "sili", 64, 98, 94, 88, 88, 100),
  o("zhang-liao", "Zhang Liao", null, "bingzhou", 94, 78, 70, 76, 90, 100),
  o("taishi-ci", "Taishi Ci", null, "qingzhou", 93, 66, 58, 72, 84, 100),
];

export const DEFAULT_SCENARIO: Scenario = {
  id: "han-collapse-189",
  name: "Dong Zhuo Controls the Court (189 AD)",
  factions: FACTIONS,
  holdings: HOLDINGS,
  officers: OFFICERS,
};

/** Build runtime `Officer` records from the scenario (engine-internal helper). */
export function buildOfficers(scenario: Scenario): Officer[] {
  return scenario.officers.map((s) => ({
    id: s.id,
    name: s.name,
    war: s.war,
    intellect: s.intellect,
    politics: s.politics,
    charisma: s.charisma,
    leadership: s.leadership,
    loyalty: s.loyalty,
    ownerId: s.factionId, // player ids equal faction ids in this setup
    provinceId: s.provinceId,
  }));
}
