import type { CreatureState, SaveState } from "../systems/types";

/**
 * Offline-first persistence. Saves live in localStorage for the prototype
 * (synchronous, simple, ~5MB is plenty for a JSON save). The interface is
 * deliberately small so it can be swapped for IndexedDB (via `idb`/Dexie) and
 * then layered with cloud sync (Supabase/Firebase) without touching callers.
 */

const SAVE_KEY = "evo.save.v1";
const SAVE_VERSION = 2;

export function buildSave(creature: CreatureState, unlockedParts: string[]): SaveState {
  return {
    version: SAVE_VERSION,
    creature,
    unlockedParts,
    // Caller stamps real time; kept here for a self-contained payload.
    updatedAt: Date.now(),
  };
}

export function save(state: SaveState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (err) {
    // Storage can be disabled (private mode). Fail soft — the game still runs.
    console.warn("[SaveManager] save failed:", err);
  }
}

export function load(): SaveState | undefined {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as SaveState;
    if (parsed.version !== SAVE_VERSION) return undefined; // migrate here later
    return parsed;
  } catch (err) {
    console.warn("[SaveManager] load failed:", err);
    return undefined;
  }
}

export function clear(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Cloud sync seam. When you add Supabase/Firebase, implement this to push the
 * local save and reconcile by `updatedAt`. Left unimplemented on purpose.
 */
export async function syncToCloud(_state: SaveState): Promise<void> {
  // TODO: POST to backend; last-write-wins on updatedAt, or merge as needed.
}
