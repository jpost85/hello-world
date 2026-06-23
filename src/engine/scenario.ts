/**
 * The default historical scenario: "Dong Zhuo Controls the Court", 189 AD.
 *
 * Where Dominion deals territories at random, Romance of the Three Kingdoms is
 * historical — warlords start in fixed provinces with their real retainers,
 * traits and treasures. This file is pure data; `game.ts` turns it into a
 * `GameState`. Add more scenarios here later (each is just another `Scenario`).
 */
import type { Faction, Officer, OfficerTrait, UnitType } from "./types.ts";

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
  traits: OfficerTrait[];
  items: string[];
}

export interface Scenario {
  id: string;
  name: string;
  factions: Faction[];
  /** factionId → provinces the faction starts holding. */
  holdings: Record<string, string[]>;
  /** Optional per-province garrison branch (defaults to spearmen). */
  garrisonTypes?: Record<string, UnitType>;
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

// Two provinces apiece — a balanced six-way opening across the realm.
const HOLDINGS: Record<string, string[]> = {
  "dong-zhuo": ["sili", "liangzhou"],
  "yuan-shao": ["jizhou", "bingzhou"],
  "gongsun-zan": ["youzhou", "qingzhou"],
  "cao-cao": ["yuzhou", "xuzhou"],
  "liu-biao": ["jingzhou", "yizhou"],
  "sun-jian": ["yangzhou", "jiaozhou"],
};

// Frontier and capital provinces field characteristic branches.
const GARRISON_TYPES: Record<string, UnitType> = {
  liangzhou: "cavalry", // the horse country of the northwest
  bingzhou: "cavalry",
  youzhou: "cavalry", // Gongsun Zan's famed White Horse riders
  qingzhou: "archers",
  jiaozhou: "navy",
  yangzhou: "navy", // the riverlands of Jiangdong
};

// stats: war, int, pol, cha, lead, loyalty, traits, items
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
  traits: OfficerTrait[] = [],
  items: string[] = [],
): ScenarioOfficer => ({ id, name, factionId, provinceId, war, intellect, politics, charisma, leadership, loyalty, traits, items });

const OFFICERS: ScenarioOfficer[] = [
  // Dong Zhuo — the tyrant holding Luoyang.
  o("dong-zhuo", "Dong Zhuo", "dong-zhuo", "sili", 80, 62, 24, 40, 86, 100, ["cavalier"]),
  o("lu-bu", "Lü Bu", "dong-zhuo", "sili", 100, 26, 13, 42, 90, 28, ["valiant", "cavalier"], ["red-hare", "sky-piercer"]),
  o("li-ru", "Li Ru", "dong-zhuo", "liangzhou", 38, 92, 80, 60, 50, 90, ["strategist", "administrator"]),
  o("hua-xiong", "Hua Xiong", "dong-zhuo", "liangzhou", 89, 30, 22, 38, 76, 82, ["valiant"]),
  // Yuan Shao — the great northern coalition lord.
  o("yuan-shao", "Yuan Shao", "yuan-shao", "jizhou", 66, 75, 78, 92, 82, 100, ["orator"]),
  o("yan-liang", "Yan Liang", "yuan-shao", "jizhou", 92, 38, 30, 46, 80, 84, ["valiant"]),
  o("wen-chou", "Wen Chou", "yuan-shao", "bingzhou", 91, 36, 28, 44, 79, 84, ["valiant", "cavalier"]),
  o("tian-feng", "Tian Feng", "yuan-shao", "jizhou", 40, 94, 88, 66, 58, 76, ["strategist", "administrator"]),
  // Cao Cao — the cunning hero of chaos.
  o("cao-cao", "Cao Cao", "cao-cao", "yuzhou", 76, 96, 94, 97, 92, 100, ["strategist", "orator"], ["seven-star", "mengde-xinshu"]),
  o("xiahou-dun", "Xiahou Dun", "cao-cao", "yuzhou", 90, 58, 60, 72, 86, 95, ["valiant"]),
  o("xun-yu", "Xun Yu", "cao-cao", "xuzhou", 38, 98, 96, 88, 60, 92, ["administrator"]),
  o("guo-jia", "Guo Jia", "cao-cao", "yuzhou", 32, 99, 84, 86, 56, 90, ["strategist"]),
  // Gongsun Zan — the White Horse general of the frontier.
  o("gongsun-zan", "Gongsun Zan", "gongsun-zan", "youzhou", 84, 54, 50, 66, 80, 100, ["cavalier"]),
  o("zhao-yun", "Zhao Yun", "gongsun-zan", "youzhou", 96, 76, 70, 84, 88, 70, ["valiant", "cavalier"], ["shadow-runner"]),
  // Sun Jian — the Tiger of Jiangdong.
  o("sun-jian", "Sun Jian", "sun-jian", "yangzhou", 91, 70, 66, 84, 90, 100, ["valiant", "admiral"]),
  o("sun-ce", "Sun Ce", "sun-jian", "yangzhou", 93, 68, 64, 90, 89, 96, ["valiant", "admiral"]),
  o("zhou-yu", "Zhou Yu", "sun-jian", "yangzhou", 72, 96, 86, 92, 94, 90, ["strategist", "admiral"], ["art-of-war"]),
  o("huang-gai", "Huang Gai", "sun-jian", "jiaozhou", 80, 64, 60, 62, 78, 92, ["admiral"]),
  // Liu Biao — the scholarly governor of Jing.
  o("liu-biao", "Liu Biao", "liu-biao", "jingzhou", 58, 72, 78, 80, 70, 100, ["administrator"]),
  o("huang-zhong", "Huang Zhong", "liu-biao", "jingzhou", 93, 60, 52, 70, 84, 80, ["valiant", "archer"]),
  o("kuai-liang", "Kuai Liang", "liu-biao", "jingzhou", 36, 90, 88, 70, 54, 86, ["administrator", "farmer"]),
  o("liu-zhang", "Liu Zhang", "liu-biao", "yizhou", 40, 50, 60, 58, 56, 74, ["farmer"]),

  // Wandering heroes — not yet sworn to any lord (ownerId resolves to null).
  o("liu-bei", "Liu Bei", null, "youzhou", 73, 78, 80, 99, 82, 100, ["orator", "pacifier"]),
  o("guan-yu", "Guan Yu", null, "youzhou", 97, 75, 62, 88, 94, 100, ["valiant", "archer"], ["green-dragon"]),
  o("zhang-fei", "Zhang Fei", null, "youzhou", 98, 44, 30, 58, 86, 100, ["valiant"], ["serpent-spear"]),
  o("zhuge-liang", "Zhuge Liang", null, "jingzhou", 38, 100, 98, 92, 90, 100, ["strategist", "administrator", "farmer"]),
  o("sima-yi", "Sima Yi", null, "sili", 64, 98, 94, 88, 88, 100, ["strategist", "administrator"]),
  o("zhang-liao", "Zhang Liao", null, "bingzhou", 94, 78, 70, 76, 90, 100, ["valiant", "cavalier"]),
  o("taishi-ci", "Taishi Ci", null, "qingzhou", 93, 66, 58, 72, 84, 100, ["valiant", "archer"]),
];

export const DEFAULT_SCENARIO: Scenario = {
  id: "han-collapse-189",
  name: "Dong Zhuo Controls the Court (189 AD)",
  factions: FACTIONS,
  holdings: HOLDINGS,
  garrisonTypes: GARRISON_TYPES,
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
    traits: s.traits,
    items: s.items,
    captiveOf: null,
    alive: true,
  }));
}
