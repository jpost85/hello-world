import type {
  DiplomaticAction,
  DiplomaticEvent,
  DiplomaticEventKind,
  GameState,
  IdeologyAxis,
  MemoryKind,
  Rival,
  RivalTrait,
} from "../types";
import { FACTIONS, getFaction } from "../data/factions";
import {
  FACTION_LEAN,
  IDEOLOGY_OPPOSITION,
  NEMESIS_EPITHETS,
  HEGEMON_TITLES,
  ALLY_TITLES,
  SUCCESSOR_NAMES,
  RIVAL_TRAITS,
} from "../data/rivals";
import { PHASE_ORDER } from "../data/phases";
import { dominantIdeology } from "./ideology";
import { recordChronicle } from "./chronicle";

/**
 * Nemesis-inspired rival AI + evolving diplomacy.
 *
 * Every non-player faction is a rival LEADER with personality traits and a
 * memory of what you've done to them. Each turn rivals grow in power, jockey in
 * a shifting hierarchy, warm to or sour on you (driven by ideology, your
 * strength, and their traits), form relationships with each other, and
 * occasionally make overtures or strike. Wrong a rival badly and grudge tips it
 * into becoming your Nemesis; a fallen leader can resurface through a successor
 * who inherits the faction's bitterness.
 *
 * Design note: this is a self-contained social simulation over GameState. It
 * touches the colony economy only through explicit aid/sabotage effects, so it
 * stays easy to reason about and test.
 */

// --- tuning knobs ---------------------------------------------------------
const BASE_POWER_MIN = 22;
const BASE_POWER_SPAN = 16;
const NEMESIS_GRUDGE = 40;
const MAX_MEMORIES = 8;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function phaseIdx(state: GameState): number {
  return PHASE_ORDER.indexOf(state.phase);
}

function has(rival: Rival, trait: RivalTrait): boolean {
  return rival.traits.includes(trait);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

/** Build the rival roster from the non-player factions. */
export function createRivals(playerFactionId: string): Rival[] {
  const others = FACTIONS.filter((f) => f.id !== playerFactionId);
  const rivals: Rival[] = others.map((f) => {
    const traits = rollTraits();
    return {
      id: `rival-${f.id}`,
      factionId: f.id,
      leaderName: f.leader,
      title: shortTitle(f.leader),
      traits,
      ideologyLean: FACTION_LEAN[f.id] ?? "humanist",
      power: BASE_POWER_MIN + Math.floor(Math.random() * BASE_POWER_SPAN),
      rank: 0,
      disposition: 0,
      stance: "competitor",
      grudge: 0,
      debt: 0,
      memories: [],
      relations: {},
      alive: true,
    };
  });
  // Seed inter-rival relations (each pair starts mildly random).
  for (const a of rivals) {
    for (const b of rivals) {
      if (a.id !== b.id) a.relations[b.id] = Math.floor(Math.random() * 40) - 20;
    }
  }
  return rivals;
}

function rollTraits(): RivalTrait[] {
  const pool = RIVAL_TRAITS.map((t) => t.id);
  const first = pick(pool);
  let second = pick(pool);
  let guard = 0;
  while (second === first && guard++ < 8) second = pick(pool);
  return second === first ? [first] : [first, second];
}

/** The leader's honorific before any epithet is earned. */
function shortTitle(_leader: string): string {
  return "";
}

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

/** Record something the player did (or that happened) into a rival's memory. */
export function recordMemory(
  rival: Rival,
  kind: MemoryKind,
  text: string,
  weight: number,
): void {
  rival.memories.push({ turn: 0, kind, text, weight });
  if (rival.memories.length > MAX_MEMORIES) rival.memories.shift();
  rival.disposition = clamp(rival.disposition + weight, -100, 100);
  if (weight < 0) rival.grudge = clamp(rival.grudge - weight, 0, 100);
  if (weight > 0) rival.debt = clamp(rival.debt + weight * 0.5, 0, 100);
}

// ---------------------------------------------------------------------------
// Stance
// ---------------------------------------------------------------------------

function computeStance(rival: Rival, state: GameState): Rival["stance"] {
  const idx = phaseIdx(state);
  if (rival.grudge >= NEMESIS_GRUDGE && rival.disposition <= -30 && idx >= 1) return "nemesis";
  let s: Rival["stance"];
  if (rival.disposition <= -55) s = "adversary";
  else if (rival.disposition <= -20) s = "rival";
  else if (rival.disposition < 25) s = "competitor";
  else if (rival.disposition < 60) s = "partner";
  else s = "ally";
  // The corporate phase is pure economic competition — no alliances, no wars.
  if (idx === 0) {
    if (s === "ally" || s === "partner") s = "competitor";
    if (s === "adversary") s = "rival";
  }
  return s;
}

/** The player's current ideological leaning (seeded from turn 1). */
function playerLean(state: GameState): IdeologyAxis | null {
  return dominantIdeology(state);
}

function playerStrength(state: GameState): number {
  return state.colony.stability * 0.5 + state.habitability * 0.5;
}

// ---------------------------------------------------------------------------
// Titles / epithets — a rival's name evolves with their standing
// ---------------------------------------------------------------------------

function updateTitle(rival: Rival): void {
  if (rival.stance === "nemesis") {
    if (!NEMESIS_EPITHETS.includes(rival.title)) rival.title = pick(NEMESIS_EPITHETS);
  } else if (rival.rank === 1) {
    if (!HEGEMON_TITLES.includes(rival.title)) rival.title = pick(HEGEMON_TITLES);
  } else if (rival.stance === "ally") {
    if (!ALLY_TITLES.includes(rival.title)) rival.title = pick(ALLY_TITLES);
  } else {
    rival.title = "";
  }
}

// ---------------------------------------------------------------------------
// The per-turn rival simulation
// ---------------------------------------------------------------------------

export function rivalTick(state: GameState): string[] {
  const logs: string[] = [];
  const pLean = playerLean(state);
  const strength = playerStrength(state);

  // 1. The rivals' own power struggle — the hegemon preys on the weak, and
  //    open wars between rivals bleed both sides. This keeps the hierarchy
  //    genuinely dynamic (Nemesis-style rise and fall).
  if (phaseIdx(state) >= 1) powerStruggle(state.rivals.filter((r) => r.alive));

  // 2. Anyone driven to collapse falls from the game.
  logs.push(...checkEliminations(state));

  // 3. Survivors grow and their feelings toward you drift.
  const living = state.rivals.filter((r) => r.alive);
  for (const rival of living) {
    growPower(rival);
    driftDisposition(rival, state, pLean, strength);
  }

  // Recompute the hierarchy and note a change of hegemon.
  const prevHegemon = living.find((r) => r.rank === 1)?.id;
  const ranked = [...living].sort((a, b) => b.power - a.power);
  ranked.forEach((r, i) => (r.rank = i + 1));
  const newHegemon = ranked[0];
  if (newHegemon && newHegemon.id !== prevHegemon && phaseIdx(state) >= 1) {
    logs.push(`${rivalName(newHegemon)} now dominates the interstellar order.`);
    recordChronicle(state, "politics", "A New Hegemon",
      `${rivalName(newHegemon)} rose to dominance among the rival powers.`);
  }

  evolveRelations(living);

  for (const rival of living) {
    const before = rival.stance;
    rival.stance = computeStance(rival, state);
    updateTitle(rival);
    if (rival.stance !== before && rival.stance === "nemesis") {
      logs.push(`${rivalName(rival)} has sworn a vendetta against you.`);
      recordChronicle(state, "politics", "A Nemesis Rises",
        `${rivalName(rival)} turned your rivalry into a personal war.`);
    }
    // Passive consequences of the current stance.
    logs.push(...applyStanceEffects(rival, state));
    // Occasionally the rival makes an overture (queued for the player).
    maybeGenerateEvent(rival, state);
  }

  // Fallen leaders may resurface with a successor who inherits the grudge.
  logs.push(...maybeResurface(state));

  return logs;
}

function growPower(rival: Rival): void {
  let g = 0.8 + Math.random() * 1.2;
  if (has(rival, "expansionist")) g += 1.2;
  if (has(rival, "ruthless")) g += 0.4;
  rival.power = Math.max(0, rival.power + g);
}

/** The strong prey on the weak, and rivals at war bleed each other. */
function powerStruggle(living: Rival[]): void {
  if (living.length < 3) return;
  const ranked = [...living].sort((a, b) => b.power - a.power);
  const hegemon = ranked[0];
  const weakest = ranked[ranked.length - 1];
  // The hegemon preys on the weakest only when the gap is wide.
  if (weakest.power < hegemon.power * 0.55) {
    const drain = has(hegemon, "ruthless") ? 3.2 : 2.2;
    weakest.power = Math.max(0, weakest.power - drain);
    hegemon.power += drain * 0.25;
  }
  // Open wars (mutual deep hostility) sap both sides.
  for (const a of living) {
    for (const b of living) {
      if (a.id < b.id && (a.relations[b.id] ?? 0) < -60 && (b.relations[a.id] ?? 0) < -60) {
        a.power = Math.max(0, a.power - 1.2);
        b.power = Math.max(0, b.power - 1.2);
      }
    }
  }
}

/** Rivals driven to collapse fall from the game (their bitterness may outlive them). */
function checkEliminations(state: GameState): string[] {
  const logs: string[] = [];
  for (const r of state.rivals) {
    if (r.alive && r.power <= 3) {
      r.alive = false;
      r.eliminatedTurn = state.turn;
      r.power = 0;
      logs.push(`${rivalName(r)} has been broken and cast down.`);
      recordChronicle(state, "politics", "A Power Falls",
        `${rivalName(r)} was broken — but the bitterness may outlive them.`);
    }
  }
  return logs;
}

function driftDisposition(
  rival: Rival,
  state: GameState,
  pLean: IdeologyAxis | null,
  strength: number,
): void {
  const idx = phaseIdx(state);
  let delta = 0;

  // Ideological alignment (stronger once ideology matters; muted for pragmatists).
  if (pLean && !has(rival, "pragmatic")) {
    let align = 0;
    if (rival.ideologyLean === pLean) align = 1;
    else if (IDEOLOGY_OPPOSITION[rival.ideologyLean] === pLean) align = -1;
    if (has(rival, "zealous")) align *= 2;
    const scale = idx >= 2 ? 1.2 : idx >= 1 ? 0.6 : 0.2;
    delta += align * scale;
  }

  // Opportunists smell blood: they sour when you are weak, warm when strong.
  if (has(rival, "opportunist")) delta += (strength - 50) / 25;
  // Paranoia is a slow negative pull.
  if (has(rival, "paranoid")) delta -= 0.4;

  // Grudges and debts decay differently by temperament.
  const forgive = has(rival, "honorable") ? 1.2 : has(rival, "vengeful") ? 0.2 : 0.6;
  rival.grudge = clamp(rival.grudge - forgive, 0, 100);
  rival.debt = clamp(rival.debt - 0.5, 0, 100);

  // Stoics resist change; everyone drifts gently toward neutral otherwise.
  const inertia = has(rival, "stoic") ? 0.3 : 1;
  delta *= inertia;
  if (Math.abs(rival.disposition) < 3) rival.disposition = 0;
  else rival.disposition += rival.disposition > 0 ? -0.2 : 0.2; // mild regression

  rival.disposition = clamp(rival.disposition + delta, -100, 100);
}

/** Rivals build their own relationships; all resent the hegemon a little. */
function evolveRelations(living: Rival[]): void {
  for (const a of living) {
    for (const b of living) {
      if (a.id === b.id) continue;
      let d = 0;
      if (a.ideologyLean === b.ideologyLean) d += 0.4;
      else if (IDEOLOGY_OPPOSITION[a.ideologyLean] === b.ideologyLean) d -= 0.4;
      if (b.rank === 1) d -= 0.5; // nobody loves the leader
      a.relations[b.id] = clamp((a.relations[b.id] ?? 0) + d, -100, 100);
    }
  }
}

// ---------------------------------------------------------------------------
// Stance consequences — allies help, enemies strike
// ---------------------------------------------------------------------------

function applyStanceEffects(rival: Rival, state: GameState): string[] {
  const logs: string[] = [];
  const idx = phaseIdx(state);
  if (idx < 1) return logs;

  if (rival.stance === "ally" && Math.random() < 0.15) {
    const gift = 20 + Math.floor(Math.random() * 20);
    state.colony.stocks.credits += gift;
    rival.debt = clamp(rival.debt - 10, 0, 100);
    logs.push(`${rivalName(rival)} sends a gift of solidarity (+${gift} credits).`);
  } else if (rival.stance === "partner" && Math.random() < 0.1) {
    state.colony.stocks.materials += 12;
    logs.push(`${rivalName(rival)} shares surplus materials (+12).`);
  } else if ((rival.stance === "nemesis" || rival.stance === "adversary")) {
    const chance = rival.stance === "nemesis" ? 0.28 : 0.15;
    if (Math.random() < chance) logs.push(sabotagePlayer(rival, state));
  }
  return logs;
}

/** A hostile rival strikes at the colony, feeding the cycle of vendetta. */
function sabotagePlayer(rival: Rival, state: GameState): string {
  const cunning = has(rival, "cunning") || has(rival, "ruthless");
  const roll = Math.random();
  if (roll < 0.4) {
    const stolen = cunning ? 30 : 18;
    state.colony.stocks.materials = Math.max(0, state.colony.stocks.materials - stolen);
    recordMemory(rival, "clash", "Their raiders struck our supply lines", 0);
    return `${rivalName(rival)}'s agents raid your stockpiles (-${stolen} materials).`;
  } else if (roll < 0.75) {
    const hit = cunning ? 8 : 5;
    state.colony.stability = Math.max(0, state.colony.stability - hit);
    return `${rivalName(rival)} foments unrest in the domes (-${hit} stability).`;
  } else {
    const stolen = cunning ? 35 : 20;
    state.colony.stocks.energy = Math.max(0, state.colony.stocks.energy - stolen);
    return `${rivalName(rival)} sabotages your grid (-${stolen} energy).`;
  }
}

// ---------------------------------------------------------------------------
// Overtures — rivals reach out (queued for the player to answer)
// ---------------------------------------------------------------------------

function maybeGenerateEvent(rival: Rival, state: GameState): void {
  if (phaseIdx(state) < 1) return;
  if (state.pendingDiplomacy.some((e) => e.rivalId === rival.id)) return;
  if (state.pendingDiplomacy.length >= 3) return;

  // Extreme stances speak up more often.
  const base =
    rival.stance === "nemesis" || rival.stance === "ally" ? 0.14 :
    rival.stance === "adversary" || rival.stance === "partner" ? 0.1 : 0.06;
  if (Math.random() > base) return;

  const kind = chooseEventKind(rival);
  const event = buildEvent(rival, kind, state);
  if (event) state.pendingDiplomacy.push(event);
}

function chooseEventKind(rival: Rival): DiplomaticEventKind {
  switch (rival.stance) {
    case "nemesis":
      return has(rival, "cunning") ? "betrayal" : "threat";
    case "adversary":
      return Math.random() < 0.5 ? "demand_tribute" : "threat";
    case "partner":
    case "ally":
      return Math.random() < 0.5 ? "offer_pact" : "offer_aid";
    default:
      return "taunt";
  }
}

function recentMemory(rival: Rival): string | null {
  const m = rival.memories[rival.memories.length - 1];
  return m ? m.text.toLowerCase() : null;
}

function buildEvent(
  rival: Rival,
  kind: DiplomaticEventKind,
  _state: GameState,
): DiplomaticEvent | null {
  const who = rivalName(rival);
  const mem = recentMemory(rival);
  const memClause = mem ? ` They have not forgotten that ${mem}.` : "";
  const id = `dip-${rival.id}-${kind}-${rival.memories.length}-${Math.floor(Math.random() * 9999)}`;

  const evt = (text: string, options: [string, string][]): DiplomaticEvent => ({
    id,
    rivalId: rival.id,
    kind,
    text,
    options: options.map(([oid, label]) => ({ id: oid, label })),
  });

  switch (kind) {
    case "taunt":
      return evt(
        `${who} mocks your efforts, boasting their world will bloom first.${memClause}`,
        [["shrug", "Ignore them"], ["retort", "Answer the insult"]],
      );
    case "offer_pact":
      return evt(
        `${who} proposes a formal pact — shared orbital infrastructure and open borders.`,
        [["accept", "Sign the pact"], ["decline", "Politely decline"]],
      );
    case "offer_aid":
      return evt(
        `${who} offers a shipment of aid, asking nothing obvious in return.`,
        [["accept", "Accept the aid"], ["refuse", "Refuse — nothing is free"]],
      );
    case "demand_tribute":
      return evt(
        `${who} demands tribute — 40 credits — or there will be "consequences."${memClause}`,
        [["pay", "Pay the tribute"], ["refuse", "Refuse them"]],
      );
    case "threat":
      return evt(
        `${who} threatens open hostility unless you back away from their claims.${memClause}`,
        [["concede", "Concede ground"], ["defy", "Defy them"]],
      );
    case "betrayal":
      return evt(
        `${who} extends a hand of peace — but something about it feels like a trap.${memClause}`,
        [["trust", "Take the offered hand"], ["reject", "Trust nothing they say"]],
      );
    default:
      return null;
  }
}

/** Apply the player's response to a queued overture. */
export function respondToDiplomacy(state: GameState, eventId: string, optionId: string): string | null {
  const idx = state.pendingDiplomacy.findIndex((e) => e.id === eventId);
  if (idx < 0) return null;
  const event = state.pendingDiplomacy[idx];
  state.pendingDiplomacy.splice(idx, 1);
  const rival = state.rivals.find((r) => r.id === event.rivalId);
  if (!rival) return null;
  const who = rivalName(rival);
  let msg = "";

  const bought = (k: "credits" | "materials" | "energy", amt: number): boolean => {
    if (state.colony.stocks[k] < amt) return false;
    state.colony.stocks[k] -= amt;
    return true;
  };

  switch (`${event.kind}:${optionId}`) {
    case "taunt:shrug":
      msg = `You ignore ${who}'s taunt.`;
      break;
    case "taunt:retort":
      recordMemory(rival, "slight", "you answered our insult in kind", -6);
      msg = `You trade barbs with ${who}. Relations cool.`;
      break;
    case "offer_pact:accept":
      recordMemory(rival, "pact", "we signed a pact together", 22);
      recordChronicle(state, "politics", "A Pact Signed", `A formal pact bound your world to ${who}.`);
      msg = `You sign a pact with ${who}.`;
      break;
    case "offer_pact:decline":
      recordMemory(rival, "slight", "you spurned our offered pact", -8);
      msg = `You decline ${who}'s pact.`;
      break;
    case "offer_aid:accept": {
      const gift = 30;
      state.colony.stocks.materials += gift;
      recordMemory(rival, "boon", "we sent you aid in your need", 6);
      rival.debt = Math.min(100, rival.debt + 10); // they now feel owed goodwill
      msg = `You accept ${who}'s aid (+${gift} materials).`;
      break;
    }
    case "offer_aid:refuse":
      recordMemory(rival, "slight", "you refused our generosity", -4);
      msg = `You refuse ${who}'s aid.`;
      break;
    case "demand_tribute:pay":
      if (bought("credits", 40)) {
        recordMemory(rival, "boon", "you paid the tribute we demanded", 12);
        msg = `You pay ${who}'s tribute (-40 credits). They are appeased, for now.`;
      } else {
        recordMemory(rival, "slight", "you could not pay what we demanded", -8);
        msg = `You cannot cover ${who}'s tribute. They take it as an insult.`;
      }
      break;
    case "demand_tribute:refuse":
      recordMemory(rival, "slight", "you refused our demand for tribute", -14);
      msg = `You refuse ${who}. Their grudge deepens.`;
      break;
    case "threat:concede":
      recordMemory(rival, "boon", "you backed down from our claims", 8);
      msg = `You concede ground to ${who}.`;
      break;
    case "threat:defy":
      recordMemory(rival, "clash", "you defied our threats openly", -12);
      msg = `You defy ${who}. This will not be forgotten.`;
      break;
    case "betrayal:trust":
      if (has(rival, "cunning") && Math.random() < 0.6) {
        const loss = 25;
        state.colony.stocks.credits = Math.max(0, state.colony.stocks.credits - loss);
        recordMemory(rival, "betrayal", "we made a fool of your trust", -6);
        msg = `${who}'s "peace" was a swindle (-${loss} credits). You should have known.`;
      } else {
        recordMemory(rival, "pact", "we found unexpected peace", 16);
        msg = `Against the odds, ${who} meant it. A wary peace holds.`;
      }
      break;
    case "betrayal:reject":
      recordMemory(rival, "slight", "you rejected our hand of peace", -6);
      msg = `You reject ${who}'s overture.`;
      break;
    default:
      msg = `You respond to ${who}.`;
  }
  rival.stance = computeStance(rival, state);
  return msg;
}

// ---------------------------------------------------------------------------
// Player-initiated diplomacy
// ---------------------------------------------------------------------------

export function applyDiplomaticAction(
  state: GameState,
  rivalId: string,
  action: DiplomaticAction,
): string | null {
  const rival = state.rivals.find((r) => r.id === rivalId);
  if (!rival || !rival.alive || phaseIdx(state) < 1) return null;
  const who = rivalName(rival);
  const s = state.colony.stocks;

  switch (action) {
    case "pact": {
      if (s.credits < 40) return `Not enough credits to broker a pact with ${who} (need 40).`;
      if (rival.stance === "nemesis") return `${who} will never treat with you now.`;
      s.credits -= 40;
      if (rival.disposition >= 0 && !has(rival, "paranoid")) {
        recordMemory(rival, "pact", "you brokered a pact with us", 24);
        recordChronicle(state, "politics", "A Pact Brokered", `You brokered a pact with ${who}.`);
        rival.stance = computeStance(rival, state);
        return `${who} accepts your pact.`;
      }
      recordMemory(rival, "slight", "you presumed to court us uninvited", -6);
      return `${who} rebuffs your overture.`;
    }
    case "aid": {
      if (s.materials < 30 || s.credits < 20) return `Not enough resources to aid ${who} (need 30 materials, 20 credits).`;
      s.materials -= 30;
      s.credits -= 20;
      recordMemory(rival, "boon", "you aided us when it counted", 22);
      rival.stance = computeStance(rival, state);
      return `You send aid to ${who}. They will remember it.`;
    }
    case "denounce": {
      recordMemory(rival, "slight", "you denounced us before the worlds", -22);
      // Their enemies warm to you a little (reflected via inter-rival relations).
      for (const other of state.rivals) {
        if (other.id !== rival.id && (other.relations[rival.id] ?? 0) < -20) {
          other.disposition = clamp(other.disposition + 6, -100, 100);
        }
      }
      rival.stance = computeStance(rival, state);
      return `You denounce ${who}. Their rivals take note.`;
    }
    case "sabotage": {
      if (s.energy < 30 || s.materials < 20) return `Not enough resources to sabotage ${who} (need 30 energy, 20 materials).`;
      s.energy -= 30;
      s.materials -= 20;
      const dmg = has(rival, "paranoid") ? 10 : 16; // the paranoid guard themselves
      rival.power = Math.max(0, rival.power - dmg);
      recordMemory(rival, "betrayal", "you sabotaged us from the shadows", -40);
      recordChronicle(state, "politics", "An Act of Sabotage", `You struck secretly at ${who}.`);
      rival.stance = computeStance(rival, state);
      const nem = rival.stance === "nemesis" ? ` ${who} now hunts you.` : "";
      return `Your agents cripple ${who}'s operations (-${dmg} power).${nem}`;
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Elimination + resurfacing
// ---------------------------------------------------------------------------

function maybeResurface(state: GameState): string[] {
  const logs: string[] = [];
  for (const rival of state.rivals) {
    // Resurfacing: a fallen faction with a grudge produces a successor who
    // inherits the vendetta (the Nemesis "they come back" beat).
    if (!rival.alive && !rival.resurfaced && rival.grudge > 15 && Math.random() < 0.06) {
      rival.alive = true;
      rival.resurfaced = true;
      rival.power = BASE_POWER_MIN;
      const heir = pick(SUCCESSOR_NAMES);
      const old = rivalName(rival);
      rival.leaderName = heir;
      rival.disposition = clamp(rival.disposition - 20, -100, 100);
      rival.grudge = clamp(rival.grudge + 20, 0, 100);
      recordMemory(rival, "clash", `we inherited the grudge you earned against ${old}`, 0);
      rival.stance = computeStance(rival, state);
      logs.push(`${heir} rises to lead ${getFaction(rival.factionId).name}, inheriting an old grudge.`);
      recordChronicle(state, "politics", "A Successor Rises",
        `${heir} took up the mantle of the fallen — and their enmity.`);
    }
  }
  return logs;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Full display name including any earned epithet. */
export function rivalName(rival: Rival): string {
  const faction = getFaction(rival.factionId);
  const base = `${rival.leaderName} of ${faction.name}`;
  return rival.title ? `${rival.leaderName} ${rival.title}` : base;
}
