import type { Character, GameState } from "../types";
import { FIRST_NAMES, SURNAMES, ROLES, TRAITS } from "../data/characters";
import { recordChronicle } from "./chronicle";
import { nudgeIdeology } from "./ideology";

/**
 * Notable colonists. From the Settlement phase on, the society occasionally
 * produces a named individual with traits — applying a small permanent effect,
 * nudging ideology, and writing themselves into history. Politics become
 * personal.
 */

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Build (but do not yet register) a character appropriate to the moment. */
export function generateCharacter(state: GameState): Character {
  const name = `${pick(FIRST_NAMES)} ${pick(SURNAMES)}`;
  const role = pick(ROLES);
  const age = 28 + Math.floor(Math.random() * 40);

  // One or two distinct traits.
  const traits = [pick(TRAITS)];
  if (Math.random() < 0.4) {
    const second = pick(TRAITS);
    if (second.id !== traits[0].id) traits.push(second);
  }

  const bio = `${role}, age ${age}. ${traits.map((t) => t.effect).join(" ")}`;
  return {
    id: `char-${state.turn}-${state.characters.length}`,
    name,
    role,
    age,
    bornTurn: state.turn,
    traits,
    bio,
  };
}

/** Register a character: apply effects, nudge ideology, record in history. */
export function addCharacter(state: GameState, character: Character): void {
  state.characters.push(character);
  for (const trait of character.traits) {
    if (trait.production) {
      for (const [k, v] of Object.entries(trait.production)) {
        state.colony.production[k as keyof typeof state.colony.production] += v as number;
      }
    }
    if (trait.leaning) nudgeIdeology(state, trait.leaning, 3);
  }
  recordChronicle(
    state,
    "person",
    character.name,
    `${character.role} — ${character.traits.map((t) => t.label).join(", ")}.`,
  );
}

const EMERGENCE_CHANCE = 0.12;

/** Possibly surface a new notable colonist this turn. Returns a log line or null. */
export function maybeEmergeCharacter(state: GameState, force = false): string | null {
  if (state.phase === "corporate") return null;
  // Larger populations produce more notable figures.
  const chance = force ? 1 : EMERGENCE_CHANCE * Math.min(2, state.colony.population / 30);
  if (Math.random() > chance) return null;

  const c = generateCharacter(state);
  addCharacter(state, c);
  return `${c.name} rises to prominence — ${c.role} (${c.traits.map((t) => t.label).join(", ")}).`;
}
