/**
 * Holds the single `GameState` for the whole app and exposes actions that
 * mutate it through the engine. In this scaffold the save lives in memory;
 * wiring it to async-storage / a backend is a later step (see README).
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  GameState,
  Rng,
  advanceToNextSeason,
  newGame,
  simulateRestOfSeason,
  simulateRound,
  totalRounds,
} from '@eurobasqet/engine';

interface GameContextValue {
  state: GameState;
  /** Simulate the next unplayed round of fixtures. */
  playNextRound: () => void;
  /** Simulate every remaining fixture in the current season. */
  finishSeason: () => void;
  /** Roll a completed season into the next one. */
  nextSeason: () => void;
  /** Throw away the save and generate a fresh world. */
  reset: (seed?: number) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

function nextUnplayedRound(state: GameState): number | null {
  const total = totalRounds(state.season);
  for (let r = 1; r <= total; r++) {
    const hasUnplayed = state.season.fixtures.some((f) => f.round === r && !f.result);
    if (hasUnplayed) return r;
  }
  return null;
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState>(() =>
    newGame({ seed: 2026, tiers: 3, teamsPerDivision: 8 }),
  );
  // Bump to force a re-render after in-place engine mutations.
  const [, setTick] = useState(0);
  const commit = useCallback(() => setTick((t) => t + 1), []);

  const playNextRound = useCallback(() => {
    const round = nextUnplayedRound(state);
    if (round == null) return;
    const rng = new Rng(state.seed + state.season.index * 1000 + round);
    simulateRound(state, round, rng);
    commit();
  }, [state, commit]);

  const finishSeason = useCallback(() => {
    const rng = new Rng(state.seed + state.season.index * 7);
    simulateRestOfSeason(state, rng);
    commit();
  }, [state, commit]);

  const nextSeason = useCallback(() => {
    if (!state.season.completed) return;
    advanceToNextSeason(state);
    commit();
  }, [state, commit]);

  const reset = useCallback((seed?: number) => {
    setState(newGame({ seed: seed ?? 2026, tiers: 3, teamsPerDivision: 8 }));
  }, []);

  const value = useMemo<GameContextValue>(
    () => ({ state, playNextRound, finishSeason, nextSeason, reset }),
    [state, playNextRound, finishSeason, nextSeason, reset],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside <GameProvider>');
  return ctx;
}
