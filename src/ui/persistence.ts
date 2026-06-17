/**
 * Save/load to localStorage. `GameState` is plain serialisable data, so this is
 * a one-liner each way — the same property the Dominion branch relies on. The
 * map is re-attached from the registry on load so we don't store it twice.
 */
import type { GameState } from "../engine/index.ts";

const KEY = "three-kingdoms.save.v1";

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage full / unavailable — non-fatal for a session in progress.
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as GameState) : null;
  } catch {
    return null;
  }
}

export function clearGame(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
