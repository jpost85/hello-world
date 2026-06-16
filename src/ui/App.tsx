import { useState } from "react";
import { DEFAULT_FACTIONS } from "../engine/index.ts";
import type { PlayerConfig } from "../engine/index.ts";
import { useGame } from "./useGame.ts";
import { MapView } from "./components/MapView.tsx";
import { ControlPanel } from "./components/ControlPanel.tsx";

export function App() {
  const g = useGame();

  if (!g.state) {
    return <Setup onStart={g.start} />;
  }

  return (
    <div className="app">
      <div className="topbar">
        <h1>RISK · 1996 WEB REMAKE</h1>
        <div className="spacer" />
        {g.state.players.map((p) => {
          const faction = g.state!.factions.find((f) => f.id === p.factionId)!;
          return (
            <span key={p.id} className="badge" style={{ opacity: p.isEliminated ? 0.4 : 1 }}>
              <span className="swatch" style={{ background: faction.color }} />
              {p.name}
              {p.isEliminated && " ✗"}
            </span>
          );
        })}
      </div>
      <MapView
        state={g.state}
        from={g.from}
        to={g.to}
        selectable={g.selectable}
        onClick={g.clickTerritory}
      />
      <ControlPanel {...g} />
    </div>
  );
}

function Setup({ onStart }: { onStart: (players: PlayerConfig[], seed?: number) => void }) {
  const [count, setCount] = useState(3);
  const [names, setNames] = useState<string[]>([
    "Player 1",
    "Player 2",
    "Player 3",
    "Player 4",
    "Player 5",
    "Player 6",
  ]);

  const players: PlayerConfig[] = Array.from({ length: count }, (_, i) => ({
    name: names[i] || `Player ${i + 1}`,
    factionId: DEFAULT_FACTIONS[i].id,
  }));

  return (
    <div className="setup">
      <h1>Risk · Web Remake</h1>
      <p className="hint">
        Hot-seat play on the classic world map. Dice-based combat with attack and defense styles,
        mobile generals, and fortresses.
      </p>

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
          <span className="swatch" style={{ background: DEFAULT_FACTIONS[i].color, alignSelf: "center" }} />
          <input
            value={names[i]}
            onChange={(e) => {
              const next = names.slice();
              next[i] = e.target.value;
              setNames(next);
            }}
          />
          <span className="badge">{DEFAULT_FACTIONS[i].name}</span>
        </div>
      ))}

      <div className="row" style={{ marginTop: 20 }}>
        <button className="primary" onClick={() => onStart(players, Date.now() >>> 0)}>
          Start game
        </button>
        <button onClick={() => onStart(players, 12345)}>Start with fixed seed</button>
      </div>
    </div>
  );
}
