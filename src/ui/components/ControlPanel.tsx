import {
  currentPlayer,
  regionBonus,
  territoriesOf,
} from "../../engine/index.ts";
import type { AttackStyle, DefenseStyle } from "../../engine/index.ts";
import type { UseGame } from "../useGame.ts";

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
            <span className="swatch" style={{ background: faction.color }} />
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
            disabled={!g.selectedGeneralId || !g.from || (state.phase !== "reinforce" && state.phase !== "fortify")}
          >
            Move here
          </button>
        </div>
        <div className="row">
          <button
            onClick={g.doBuildFortress}
            disabled={!g.from || (state.phase !== "reinforce" && state.phase !== "fortify")}
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
    return (
      <section>
        <h2>Reinforce</h2>
        <p className="hint">
          Armies to place: <b>{state.reinforcementsRemaining}</b>. Click any of your highlighted
          territories to drop one army.
        </p>
        <button
          className="primary"
          onClick={g.nextPhase}
          disabled={state.reinforcementsRemaining > 0}
        >
          {state.reinforcementsRemaining > 0
            ? `Place ${state.reinforcementsRemaining} more`
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

function DiceResult({ g }: { g: UseGame }) {
  if (!g.lastResult) return null;
  const { round, captured } = g.lastResult;
  return (
    <div style={{ marginTop: 12 }}>
      <div className="row">
        <span className="hint" style={{ width: 60 }}>Attack</span>
        <div className="dice">
          {round.attackerDice.map((d, i) => (
            <span key={i} className="die atk">{d}</span>
          ))}
        </div>
      </div>
      <div className="row">
        <span className="hint" style={{ width: 60 }}>Defend</span>
        <div className="dice">
          {round.defenderDice.map((d, i) => (
            <span key={i} className="die def">{d}</span>
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
