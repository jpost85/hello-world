import { useState } from "react";
import {
  DEFAULT_MAP_ID,
  MAP_REGISTRY,
  currentPlayer,
  mapInfo,
  rosterFor,
} from "../engine/index.ts";
import type { Faction, GameMap, PlayerConfig } from "../engine/index.ts";
import { useGame } from "./useGame.ts";
import { hasSavedGame } from "./persistence.ts";
import { MapView } from "./components/MapView.tsx";
import { ControlPanel } from "./components/ControlPanel.tsx";
import { Flag } from "./components/Flag.tsx";

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
              <Flag id={p.factionId} color={faction.color} size={20} />
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
  onStart: (map: GameMap, players: PlayerConfig[], factions: Faction[], seed?: number) => void;
  onResume: () => boolean;
}) {
  const [count, setCount] = useState(3);
  const [mapId, setMapId] = useState(DEFAULT_MAP_ID);
  const [loadingMap, setLoadingMap] = useState(false);
  // Custom name overrides, keyed by seat index; otherwise the faction's name.
  const [custom, setCustom] = useState<Record<number, string>>({});
  // Default: the first seat is human, the rest are computer opponents.
  const [ai, setAi] = useState<boolean[]>([false, true, true, true, true, true]);
  const savedExists = hasSavedGame();

  // The era roster for the selected map (great powers + neutral fillers).
  const roster = rosterFor(mapInfo(mapId).factionIds, count);
  const seatName = (i: number) => custom[i] ?? roster[i].name;

  const players: PlayerConfig[] = Array.from({ length: count }, (_, i) => ({
    name: seatName(i),
    factionId: roster[i].id,
    isAI: ai[i],
  }));

  // Loads the chosen map (lazily for non-default maps) before starting.
  const begin = async (seed?: number) => {
    setLoadingMap(true);
    try {
      const map = await mapInfo(mapId).load();
      onStart(map, players, roster, seed);
    } finally {
      setLoadingMap(false);
    }
  };

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

      <label>Map</label>
      <div className="row">
        <select value={mapId} onChange={(e) => setMapId(e.target.value)}>
          {MAP_REGISTRY.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <span className="hint" style={{ flex: 1 }}>
          {mapInfo(mapId).description}
        </span>
      </div>

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
          <span style={{ alignSelf: "center", display: "flex" }}>
            <Flag id={roster[i].id} color={roster[i].color} size={26} />
          </span>
          <input
            value={seatName(i)}
            onChange={(e) => setCustom({ ...custom, [i]: e.target.value })}
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
        <button className="primary" disabled={loadingMap} onClick={() => begin(Date.now() >>> 0)}>
          {loadingMap ? "Loading map…" : "New game"}
        </button>
        <button disabled={loadingMap} onClick={() => begin(12345)}>
          New game (fixed seed)
        </button>
      </div>
    </div>
  );
}
