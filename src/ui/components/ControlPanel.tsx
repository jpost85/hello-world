import {
  currentPlayer,
  regionBonus,
  territoriesOf,
  setValue,
  isValidSet,
  FORCED_TRADE_AT,
} from "../../engine/index.ts";
import type { AttackStyle, CardSymbol, DefenseStyle } from "../../engine/index.ts";
import type { UseGame } from "../useGame.ts";
import { Flag } from "./Flag.tsx";

const CARD_GLYPH: Record<CardSymbol, string> = {
  infantry: "🪖",
  cavalry: "🐎",
  artillery: "💣",
  wild: "⭐",
};

const CARD_LABEL: Record<CardSymbol, string> = {
  infantry: "Infantry",
  cavalry: "Cavalry",
  artillery: "Artillery",
  wild: "Wild",
};

const ATTACK_STYLES: { value: AttackStyle; label: string }[] = [
  { value: "standard", label: "Standard — up to 3 dice, ties to defender" },
  { value: "aggressive", label: "Aggressive — press ties in your favour" },
  { value: "cautious", label: "Cautious — fewer dice, fewer losses" },
];

const DEFENSE_STYLES: { value: DefenseStyle; label: string }[] = [
  { value: "standard", label: "Standard — up to 2 dice" },
  { value: "aggressive", label: "Aggressive — +1 to your best die" },
  { value: "cautious", label: "Cautious — commit a single die" },
];

export function ControlPanel(g: UseGame) {
  const state = g.state!;
  const player = currentPlayer(state);
  const faction = state.factions.find((f) => f.id === player.factionId)!;
  const myGenerals = state.generals.filter((gen) => gen.ownerId === player.id);

  const name = (id: string | null) =>
    id ? state.map.territories.find((t) => t.id === id)!.name : "—";

  return (
    <div className="panel">
      <section>
        <h2>
          Turn {state.turn} · {phaseLabel(state.phase)}
        </h2>
        <div className="row">
          <span className="badge">
            <Flag id={player.factionId} color={faction.color} size={20} />
            {player.name}
          </span>
          <span className="badge">{territoriesOf(state, player.id).length} territories</span>
          {state.phase === "reinforce" && (
            <span className="badge">+{regionBonus(state, player.id)} region bonus</span>
          )}
        </div>
        {g.error && <p className="hint" style={{ color: "#e0738a" }}>{g.error}</p>}
      </section>

      {state.phase === "gameover" ? (
        <section>
          <h2>Game Over</h2>
          <p>
            🏆 <b>{state.players.find((p) => p.id === state.winnerId)?.name}</b> conquered the world.
          </p>
        </section>
      ) : g.isAITurn ? (
        <section>
          <h2>{phaseLabel(state.phase)}</h2>
          <p className="hint">🤖 {player.name} (computer) is taking its turn…</p>
        </section>
      ) : (
        <PhaseControls g={g} />
      )}

      <section>
        <h2>Generals & Fortresses</h2>
        <div className="row">
          <select
            value={g.selectedGeneralId ?? ""}
            onChange={(e) => g.setSelectedGeneralId(e.target.value || null)}
          >
            <option value="">Select a general…</option>
            {myGenerals.map((gen) => (
              <option key={gen.id} value={gen.id}>
                {gen.name} ({name(gen.territoryId)})
              </option>
            ))}
          </select>
          <button
            onClick={g.doMoveGeneral}
            disabled={g.isAITurn || !g.selectedGeneralId || !g.from || (state.phase !== "reinforce" && state.phase !== "fortify")}
          >
            Move here
          </button>
        </div>
        <div className="row">
          <button
            onClick={g.doBuildFortress}
            disabled={g.isAITurn || !g.from || (state.phase !== "reinforce" && state.phase !== "fortify")}
          >
            🏰 Build fortress at {name(g.from)}
          </button>
        </div>
        <p className="hint">
          Generals add +1 to their side's best die. Fortresses give the defender an extra die.
        </p>
      </section>

      <section style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <h2>Battle Log</h2>
        <EventLog g={g} />
      </section>
    </div>
  );
}

function PhaseControls({ g }: { g: UseGame }) {
  const state = g.state!;
  const name = (id: string | null) =>
    id ? state.map.territories.find((t) => t.id === id)!.name : "—";

  if (state.phase === "reinforce") {
    const hand = currentPlayer(state).cards;
    const mustTrade = hand.length >= FORCED_TRADE_AT;
    const blocked = state.reinforcementsRemaining > 0 || mustTrade;
    return (
      <section>
        <h2>Reinforce</h2>
        <p className="hint">
          Armies to place: <b>{state.reinforcementsRemaining}</b>. Click any of your highlighted
          territories to drop one army.
        </p>
        <ConquestCards g={g} />
        <button className="primary" onClick={g.nextPhase} disabled={blocked}>
          {state.reinforcementsRemaining > 0
            ? `Place ${state.reinforcementsRemaining} more`
            : mustTrade
              ? "Trade a set first"
              : "Begin attacks →"}
        </button>
      </section>
    );
  }

  if (state.phase === "attack") {
    const canAttack = g.from && g.to;
    return (
      <section>
        <h2>Attack</h2>
        <p className="hint">
          From <b>{name(g.from)}</b> → <b>{name(g.to)}</b>. Click one of your territories, then an
          adjacent enemy.
        </p>
        <label className="hint">Attack style</label>
        <div className="row">
          <select value={g.attackStyle} onChange={(e) => g.setAttackStyle(e.target.value as AttackStyle)}>
            {ATTACK_STYLES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <label className="hint">Defender style</label>
        <div className="row">
          <select value={g.defenseStyle} onChange={(e) => g.setDefenseStyle(e.target.value as DefenseStyle)}>
            {DEFENSE_STYLES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="primary" onClick={g.doAttack} disabled={!canAttack}>
            🎲 Roll attack
          </button>
          <button onClick={g.nextPhase}>End attacks →</button>
        </div>
        <DiceResult g={g} />
      </section>
    );
  }

  // fortify
  const canMove = g.from && g.to && g.from !== g.to;
  const maxMove = g.from ? Math.max(1, state.territories[g.from].armies - 1) : 1;
  return (
    <section>
      <h2>Fortify</h2>
      <p className="hint">
        Move armies from <b>{name(g.from)}</b> → <b>{name(g.to)}</b> through connected land.
      </p>
      <div className="row">
        <input
          type="range"
          min={1}
          max={maxMove}
          value={Math.min(g.fortifyCount, maxMove)}
          onChange={(e) => g.setFortifyCount(Number(e.target.value))}
        />
        <span className="badge">{Math.min(g.fortifyCount, maxMove)}</span>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="primary" onClick={g.doFortify} disabled={!canMove}>
          Move armies
        </button>
        <button onClick={g.nextPhase}>End turn →</button>
      </div>
    </section>
  );
}

function ConquestCards({ g }: { g: UseGame }) {
  const state = g.state!;
  const hand = currentPlayer(state).cards;
  const reward = setValue(state.setsTradedIn);
  const selected = g.selectedCards;
  const picked = selected.map((i) => hand[i]).filter(Boolean);
  const canTrade = selected.length === 3 && isValidSet(picked);
  const mustTrade = hand.length >= FORCED_TRADE_AT;

  const territoryName = (id: string | null) =>
    id ? state.map.territories.find((t) => t.id === id)?.name ?? "" : "";

  return (
    <div className="cards">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: "8px 0 4px" }}>Conquest Cards ({hand.length})</h3>
        <span className="badge">next set +{reward}</span>
      </div>
      {hand.length === 0 ? (
        <p className="hint">
          Win at least one territory this turn to earn a card. Collect a matching set of three to
          cash in for armies.
        </p>
      ) : (
        <>
          <div className="card-hand">
            {hand.map((card, i) => {
              const on = selected.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  className={`conquest-card${on ? " selected" : ""}`}
                  onClick={() => g.toggleCard(i)}
                  disabled={g.isAITurn}
                  title={territoryName(card.territoryId)}
                >
                  <span className="card-glyph">{CARD_GLYPH[card.symbol]}</span>
                  <span className="card-name">{CARD_LABEL[card.symbol]}</span>
                  <span className="card-terr">{territoryName(card.territoryId) || "—"}</span>
                </button>
              );
            })}
          </div>
          <div className="row" style={{ marginTop: 6 }}>
            <button onClick={g.tradeSelected} disabled={g.isAITurn || !canTrade}>
              Trade set (+{reward})
            </button>
            <span className="hint">
              {mustTrade
                ? "You hold 5+ cards — you must trade a set this turn."
                : "Pick 3 alike, 3 different, or any with a ⭐ wild."}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function DiceResult({ g }: { g: UseGame }) {
  if (!g.lastResult) return null;
  const { round, captured } = g.lastResult;
  return (
    <div style={{ marginTop: 12 }}>
      <div className="row">
        <span className="hint" style={{ width: 60 }}>Attack</span>
        <div className="dice">
          {round.attackerDice.map((d, i) => (
            <span
              key={`${g.rollNonce}-a${i}`}
              className="die atk rolling"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              {d}
            </span>
          ))}
        </div>
      </div>
      <div className="row">
        <span className="hint" style={{ width: 60 }}>Defend</span>
        <div className="dice">
          {round.defenderDice.map((d, i) => (
            <span
              key={`${g.rollNonce}-d${i}`}
              className="die def rolling"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              {d}
            </span>
          ))}
        </div>
      </div>
      <p className="hint">
        Attacker lost {round.attackerLosses}, defender lost {round.defenderLosses}.
        {captured && " Territory captured!"}
      </p>
    </div>
  );
}

function EventLog({ g }: { g: UseGame }) {
  const events = g.state!.events;
  const recent = events.slice(-60).reverse();
  return (
    <div className="log">
      {recent.map((e, i) => (
        <div className="entry" key={events.length - i}>
          <b>T{e.turn}</b> {e.message}
        </div>
      ))}
    </div>
  );
}

function phaseLabel(phase: string): string {
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}
