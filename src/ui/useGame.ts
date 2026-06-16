import { useCallback, useMemo, useState } from "react";
import {
  attack,
  buildFortress,
  createGame,
  currentPlayer,
  endAttack,
  endReinforcement,
  endTurn,
  fortify,
  moveGeneral,
  placeReinforcements,
  areAdjacent,
  connectedByOwnership,
  classicWorld,
  DEFAULT_FACTIONS,
} from "../engine/index.ts";
import type {
  AttackResult,
  AttackStyle,
  DefenseStyle,
  GameState,
  PlayerConfig,
} from "../engine/index.ts";

export interface UseGame {
  state: GameState | null;
  from: string | null;
  to: string | null;
  error: string | null;
  lastResult: AttackResult | null;
  attackStyle: AttackStyle;
  defenseStyle: DefenseStyle;
  fortifyCount: number;
  selectedGeneralId: string | null;
  setAttackStyle: (s: AttackStyle) => void;
  setDefenseStyle: (s: DefenseStyle) => void;
  setFortifyCount: (n: number) => void;
  setSelectedGeneralId: (id: string | null) => void;
  start: (players: PlayerConfig[], seed?: number) => void;
  clickTerritory: (id: string) => void;
  doAttack: () => void;
  doFortify: () => void;
  doBuildFortress: () => void;
  doMoveGeneral: () => void;
  nextPhase: () => void;
  /** Territory ids the player may currently click as a valid action target. */
  selectable: Set<string>;
}

export function useGame(): UseGame {
  const [state, setState] = useState<GameState | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<AttackResult | null>(null);
  const [attackStyle, setAttackStyle] = useState<AttackStyle>("standard");
  const [defenseStyle, setDefenseStyle] = useState<DefenseStyle>("standard");
  const [fortifyCount, setFortifyCount] = useState(1);
  const [selectedGeneralId, setSelectedGeneralId] = useState<string | null>(null);

  const run = useCallback((fn: () => GameState) => {
    try {
      setState(fn());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const start = useCallback((players: PlayerConfig[], seed?: number) => {
    const game = createGame({
      map: classicWorld,
      factions: DEFAULT_FACTIONS,
      players,
      seed,
    });
    setState(game);
    setFrom(null);
    setTo(null);
    setLastResult(null);
    setError(null);
  }, []);

  const selectable = useMemo<Set<string>>(() => {
    const set = new Set<string>();
    if (!state || state.phase === "gameover") return set;
    const me = currentPlayer(state).id;
    const mine = (id: string) => state.territories[id]?.ownerId === me;

    if (state.phase === "reinforce") {
      for (const id of Object.keys(state.territories)) if (mine(id)) set.add(id);
    } else if (state.phase === "attack") {
      if (from && mine(from)) {
        for (const adj of state.map.territories.find((t) => t.id === from)!.adjacentTo) {
          if (!mine(adj)) set.add(adj);
        }
      }
      for (const id of Object.keys(state.territories)) {
        if (mine(id) && state.territories[id].armies >= 2) set.add(id);
      }
    } else if (state.phase === "fortify") {
      if (from && mine(from)) {
        for (const id of Object.keys(state.territories)) {
          if (mine(id) && connectedByOwnership(state, me, from, id)) set.add(id);
        }
      }
      for (const id of Object.keys(state.territories)) if (mine(id)) set.add(id);
    }
    return set;
  }, [state, from]);

  const clickTerritory = useCallback(
    (id: string) => {
      if (!state || state.phase === "gameover") return;
      setError(null);
      const me = currentPlayer(state).id;
      const owner = state.territories[id]?.ownerId;
      const mine = owner === me;

      if (state.phase === "reinforce") {
        setFrom(id);
        if (mine && state.reinforcementsRemaining > 0) {
          run(() => placeReinforcements(state, id, 1));
        }
        return;
      }

      if (state.phase === "attack") {
        if (mine) {
          setFrom(id);
          setTo(null);
        } else if (from && areAdjacent(state.map, from, id)) {
          setTo(id);
        }
        return;
      }

      if (state.phase === "fortify") {
        if (mine && (!from || id === from)) {
          setFrom(id);
          setTo(null);
        } else if (mine && from) {
          setTo(id);
        }
        return;
      }
    },
    [state, from, run],
  );

  const doAttack = useCallback(() => {
    if (!state || !from || !to) return;
    try {
      const res = attack(state, { from, to, attackStyle, defenseStyle });
      setState(res.state);
      setLastResult(res.result);
      setError(null);
      // If the target was captured, anchor on it for follow-up moves.
      if (res.result.captured) {
        setFrom(to);
        setTo(null);
      } else if (res.state.territories[from].armies < 2) {
        setTo(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [state, from, to, attackStyle, defenseStyle]);

  const doFortify = useCallback(() => {
    if (!state || !from || !to) return;
    run(() => fortify(state, from, to, fortifyCount));
    setTo(null);
  }, [state, from, to, fortifyCount, run]);

  const doBuildFortress = useCallback(() => {
    if (!state || !from) return;
    run(() => buildFortress(state, from));
  }, [state, from, run]);

  const doMoveGeneral = useCallback(() => {
    if (!state || !from || !selectedGeneralId) return;
    run(() => moveGeneral(state, selectedGeneralId, from));
  }, [state, from, selectedGeneralId, run]);

  const nextPhase = useCallback(() => {
    if (!state) return;
    setFrom(null);
    setTo(null);
    setLastResult(null);
    if (state.phase === "reinforce") run(() => endReinforcement(state));
    else if (state.phase === "attack") run(() => endAttack(state));
    else if (state.phase === "fortify") run(() => endTurn(state));
  }, [state, run]);

  return {
    state,
    from,
    to,
    error,
    lastResult,
    attackStyle,
    defenseStyle,
    fortifyCount,
    selectedGeneralId,
    setAttackStyle,
    setDefenseStyle,
    setFortifyCount,
    setSelectedGeneralId,
    start,
    clickTerritory,
    doAttack,
    doFortify,
    doBuildFortress,
    doMoveGeneral,
    nextPhase,
    selectable,
  };
}
