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
  chinaMap,
  createGame,
  cultivate,
  currentPlayer,
  develop,
  endTurn,
  executePrisoner,
  fortify,
  march,
  playAITurn,
  proposePact,
  recruit,
  recruitOfficer,
  releasePrisoner,
  scheme,
  train,
  type GameState,
  type PactKind,
  type UnitType,
} from "../engine/index.ts";
import { clearGame, loadGame, saveGame } from "./persistence.ts";

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
  proposePact: (targetPlayerId: string, kind: PactKind) => void;
  endSeason: () => void;
}

export function useGame(): UseGame {
  const [state, setState] = useState<GameState | null>(null);
  const [humanId, setHumanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      commit(g);
    },
    [commit],
  );

  const resume = useCallback(() => {
    const saved = loadGame();
    if (!saved) return false;
    // Re-attach the (large, static) map from the registry.
    const restored: GameState = { ...saved, map: chinaMap };
    const human = restored.players.find((p) => !p.isAI);
    setHumanId(human?.id ?? null);
    setState(restored);
    return true;
  }, []);

  const abandon = useCallback(() => {
    clearGame();
    setState(null);
    setHumanId(null);
    setError(null);
  }, []);

  // Drive AI seasons automatically, one per tick, until it's the human's turn.
  useEffect(() => {
    if (!state || state.phase === "gameover") return;
    const active = currentPlayer(state);
    if (!active.isAI) {
      setAiThinking(false);
      return;
    }
    setAiThinking(true);
    timer.current = setTimeout(() => commit(playAITurn(state)), 450);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [state, commit]);

  const isHumanTurn = !!state && state.phase === "command" && !!humanId && currentPlayer(state).id === humanId;

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
    proposePact: (target, kind) => run(() => proposePact(state!, target, kind)),
    endSeason: () => run(() => endTurn(state!)),
  };
}
