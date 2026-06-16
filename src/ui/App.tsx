import { useState } from "react";
import { DEFAULT_FACTIONS, currentPlayer } from "../engine/index.ts";
import type { PlayerConfig } from "../engine/index.ts";
import { useGame } from "./useGame.ts";
import { hasSavedGame } from "./persistence.ts";
import { MapView } from "./components/MapView.tsx";
import { ControlPanel } from "./components/ControlPanel.tsx";

export function App() {
  const g = useGame();

  if (!g.state) {
    return <Setup onStart={g.start} onResume={g.resume} />;
  }

  const active = currentPlayer(g.state);

  return (
    <div className="app">
      <div className="topbar">
        <h1>DOMINION · BALANCE OF POWER</h1>
        {g.isAITurn && <span className="badge">🤖 {active.name} is planning…</span>}
        <div className="spacer" />
        {g.state.players.map((p) => {
          const faction = g.state!.factions.find((f) => f.id === p.factionId)!;
          return (
            <span
              key={p.id}
              className="badge"
              style={{
                opacity: p.isEliminated ? 0.4 : 1,
                outline: p.id === active.id ? "1px solid var(--accent)" : "none",
              }}
            >
              <span className="swatch" style={{ background: faction.color }} />
              {p.name}
              {p.isAI && " 🤖"}
              {p.isEliminated && " ✗"}
            </span>
          );
        })}
      </div>
      <MapView
        state={g.state}
        from={g.from}
        to={g.to}
        selectable={g.isAITurn ? new Set() : g.selectable}
        onClick={g.clickTerritory}
      />
      <ControlPanel {...g} />
    </div>
  );
}

function Setup({
  onStart,
  onResume,
}: {
  onStart: (players: PlayerConfig[], seed?: number) => void;
  onResume: () => boolean;
}) {
  const [count, setCount] = useState(3);
  const [names, setNames] = useState<string[]>([
    "You",
    "Player 2",
    "Player 3",
    "Player 4",
    "Player 5",
    "Player 6",
  ]);
  // Default: the first seat is human, the rest are computer opponents.
  const [ai, setAi] = useState<boolean[]>([false, true, true, true, true, true]);
  const savedExists = hasSavedGame();

  const players: PlayerConfig[] = Array.from({ length: count }, (_, i) => ({
    name: names[i] || `Player ${i + 1}`,
    factionId: DEFAULT_FACTIONS[i].id,
    isAI: ai[i],
  }));

  return (
    <div className="setup">
      <h1>Dominion: Balance of Power</h1>
      <p className="hint">
        Dice-based combat with attack and defense styles, mobile generals, and fortresses — against
        the computer or in hot-seat. Play continues from your last move automatically.
      </p>

      {savedExists && (
        <div className="row" style={{ marginBottom: 16 }}>
          <button className="primary" onClick={() => onResume()}>
            ▶ Continue saved game
          </button>
        </div>
      )}

      <label>Number of players</label>
      <div className="row">
        {[2, 3, 4, 5, 6].map((n) => (
          <button key={n} className={n === count ? "primary" : ""} onClick={() => setCount(n)}>
            {n}
          </button>
        ))}
      </div>

      <label>Players</label>
      {Array.from({ length: count }, (_, i) => (
        <div className="player-row" key={i}>
          <span
            className="swatch"
            style={{ background: DEFAULT_FACTIONS[i].color, alignSelf: "center" }}
          />
          <input
            value={names[i]}
            onChange={(e) => {
              const next = names.slice();
              next[i] = e.target.value;
              setNames(next);
            }}
          />
          <button
            onClick={() => {
              const next = ai.slice();
              next[i] = !next[i];
              setAi(next);
            }}
            style={{ minWidth: 86 }}
          >
            {ai[i] ? "🤖 Computer" : "🧑 Human"}
          </button>
        </div>
      ))}

      <div className="row" style={{ marginTop: 20 }}>
        <button className="primary" onClick={() => onStart(players, Date.now() >>> 0)}>
          New game
        </button>
        <button onClick={() => onStart(players, 12345)}>New game (fixed seed)</button>
      </div>
    </div>
  );
}
