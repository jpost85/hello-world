/**
 * Browser persistence (Liberty's Call's autosave pattern).
 *
 * `GameState` is plain serialisable data, so a game round-trips through JSON
 * cleanly — including the embedded map and RNG state, so a resumed game
 * continues deterministically. Failures (private mode, quota) are swallowed.
 */

import type { GameState } from "../engine/index.ts";

const SAVE_KEY = "risk-1996-save-v2";

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — ignore */
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? (JSON.parse(raw) as GameState) : null;
  } catch {
    return null;
  }
}

export function clearGame(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

export function hasSavedGame(): boolean {
  return loadGame() !== null;
}
