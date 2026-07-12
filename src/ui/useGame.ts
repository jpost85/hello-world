/**
 * The single stateful hook bridging React and the pure engine. It holds the
 * `GameState`, wraps each engine action (persisting after every change), and
 * auto-runs AI seasons until control returns to the human or the game ends.
 *
 * All rules live in the engine; this hook only sequences calls and catches the
 * descriptive errors the engine throws, surfacing them to the player.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  breakPact,
  chinaMap,
  createGame,
  cultivate,
  currentPlayer,
  deployOfficer,
  develop,
  endTurn,
  executePrisoner,
  fortify,
  march,
  playAITurn,
  proposePact,
  provincesOf,
  recruit,
  recruitOfficer,
  releasePrisoner,
  scheme,
  train,
  type BattleReport,
  type GameState,
  type PactKind,
  type UnitType,
} from "../engine/index.ts";
import { clearGame, loadGame, saveGame } from "./persistence.ts";

/** What changed for the human while the other warlords took their turns. */
export interface SeasonReport {
  year: number;
  season: string;
  lost: { id: string; name: string }[];
  gained: { id: string; name: string }[];
  troopsDelta: number;
  goldDelta: number;
}

interface Snapshot {
  turn: number;
  provinces: Set<string>;
  troops: number;
  gold: number;
}

function snapshotOf(s: GameState, playerId: string): Snapshot {
  const ids = provincesOf(s, playerId);
  return {
    turn: s.turn,
    provinces: new Set(ids),
    troops: ids.reduce((t, id) => t + s.provinces[id].troops, 0),
    gold: ids.reduce((t, id) => t + s.provinces[id].gold, 0),
  };
}

export interface UseGame {
  state: GameState | null;
  humanId: string | null;
  error: string | null;
  isHumanTurn: boolean;
  aiThinking: boolean;
  start: (factionId: string, seed: number) => void;
  resume: () => boolean;
  abandon: () => void;
  develop: (provinceId: string) => void;
  cultivate: (provinceId: string) => void;
  train: (provinceId: string) => void;
  recruit: (provinceId: string, type?: UnitType) => void;
  fortify: (provinceId: string) => void;
  scheme: (provinceId: string) => void;
  march: (from: string, to: string, troops: number) => void;
  recruitOfficer: (provinceId: string, officerId: string) => void;
  releasePrisoner: (officerId: string) => void;
  executePrisoner: (officerId: string) => void;
  deployOfficer: (officerId: string, toProvinceId: string) => void;
  proposePact: (targetPlayerId: string, kind: PactKind) => void;
  breakPact: (targetPlayerId: string) => void;
  endSeason: () => void;
  /** The player's most recent attack, for the battle-report modal. */
  battleReport: BattleReport | null;
  dismissBattle: () => void;
  /** What happened to the player between their turns. */
  seasonReport: SeasonReport | null;
  dismissSeason: () => void;
}

export function useGame(): UseGame {
  const [state, setState] = useState<GameState | null>(null);
  const [humanId, setHumanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [shownBattleSeq, setShownBattleSeq] = useState(0);
  const [seasonReport, setSeasonReport] = useState<SeasonReport | null>(null);
  const snapshot = useRef<Snapshot | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The next unshown battle involving the human (as attacker OR defender).
  const battleReport =
    state?.battles.find((b) => b.seq > shownBattleSeq && (b.attackerId === humanId || b.defenderId === humanId)) ?? null;

  const commit = useCallback((next: GameState) => {
    setState(next);
    saveGame(next);
  }, []);

  const run = useCallback(
    (fn: () => GameState) => {
      try {
        setError(null);
        commit(fn());
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [commit],
  );

  const start = useCallback(
    (factionId: string, seed: number) => {
      const g = createGame({ map: chinaMap, humanFactionId: factionId, seed });
      setHumanId(factionId);
      setShownBattleSeq(0);
      commit(g);
    },
    [commit],
  );

  const resume = useCallback(() => {
    const saved = loadGame();
    if (!saved) return false;
    // Re-attach the (large, static) map; drop stale battles so no report pops.
    // Coerce the battle fields in case the save predates them.
    const restored: GameState = { ...saved, map: chinaMap, battles: [], battleSeq: saved.battleSeq ?? 0 };
    const human = restored.players.find((p) => !p.isAI);
    setHumanId(human?.id ?? null);
    setShownBattleSeq(restored.battleSeq);
    setState(restored);
    return true;
  }, []);

  const abandon = useCallback(() => {
    clearGame();
    setState(null);
    setHumanId(null);
    setError(null);
    setShownBattleSeq(0);
  }, []);

  // Drive AI seasons automatically, one per tick — but pause while the player
  // still has an unacknowledged battle recap, so attacks on them never slip by.
  useEffect(() => {
    if (!state || state.phase === "gameover") return;
    const active = currentPlayer(state);
    if (!active.isAI) {
      setAiThinking(false);
      return;
    }
    if (battleReport) {
      setAiThinking(false);
      return; // wait for the player to dismiss the report
    }
    setAiThinking(true);
    timer.current = setTimeout(() => commit(playAITurn(state)), 450);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [state, commit, battleReport]);

  const isHumanTurn = !!state && state.phase === "command" && !!humanId && currentPlayer(state).id === humanId;

  // On the boundary into a fresh human turn, diff against the last snapshot to
  // report what the other warlords did (provinces won/lost, troop/gold swings).
  useEffect(() => {
    if (!state || !humanId || !isHumanTurn) return;
    const cur = snapshotOf(state, humanId);
    const prev = snapshot.current;
    if (prev && prev.turn !== cur.turn) {
      const nameOf = (id: string) => ({ id, name: state.map.provinces.find((p) => p.id === id)?.name ?? id });
      const lost = [...prev.provinces].filter((id) => !cur.provinces.has(id)).map(nameOf);
      const gained = [...cur.provinces].filter((id) => !prev.provinces.has(id)).map(nameOf);
      if (lost.length || gained.length) {
        setSeasonReport({ year: 189 + state.year, season: state.season, lost, gained, troopsDelta: cur.troops - prev.troops, goldDelta: cur.gold - prev.gold });
      }
    }
    snapshot.current = cur;
  }, [state, humanId, isHumanTurn]);

  return {
    state,
    humanId,
    error,
    isHumanTurn,
    aiThinking,
    start,
    resume,
    abandon,
    develop: (p) => run(() => develop(state!, p)),
    cultivate: (p) => run(() => cultivate(state!, p)),
    train: (p) => run(() => train(state!, p)),
    recruit: (p, type) => run(() => recruit(state!, p, type)),
    fortify: (p) => run(() => fortify(state!, p)),
    scheme: (p) => run(() => scheme(state!, p)),
    march: (from, to, troops) => run(() => march(state!, from, to, troops)),
    recruitOfficer: (p, officerId) => run(() => recruitOfficer(state!, p, officerId)),
    releasePrisoner: (officerId) => run(() => releasePrisoner(state!, officerId)),
    executePrisoner: (officerId) => run(() => executePrisoner(state!, officerId)),
    deployOfficer: (officerId, toProvinceId) => run(() => deployOfficer(state!, officerId, toProvinceId)),
    proposePact: (target, kind) => run(() => proposePact(state!, target, kind)),
    breakPact: (target) => run(() => breakPact(state!, target)),
    endSeason: () => run(() => endTurn(state!)),
    battleReport,
    dismissBattle: () => setShownBattleSeq(battleReport?.seq ?? shownBattleSeq),
    seasonReport,
    dismissSeason: () => setSeasonReport(null),
  };
}
