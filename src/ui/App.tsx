import { useState } from "react";
import {
  DEFAULT_MAP_ID,
  MAP_REGISTRY,
  availableFactions,
  currentPlayer,
  mapInfo,
} from "../engine/index.ts";
import type { Faction, GameMap, PlayerConfig } from "../engine/index.ts";

/** Assign a distinct faction to each seat: honour explicit picks, else next free. */
function resolveSeats(avail: Faction[], picks: Record<number, string>, count: number): string[] {
  const taken = new Set<string>();
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    let id = picks[i];
    if (!id || taken.has(id) || !avail.some((f) => f.id === id)) {
      id = avail.find((f) => !taken.has(f.id))?.id ?? avail[0].id;
    }
    taken.add(id);
    result.push(id);
  }
  return result;
}
import { useGame } from "./useGame.ts";
import { hasSavedGame } from "./persistence.ts";
import { isMuted, setMuted } from "./sound.ts";
import { MapView } from "./components/MapView.tsx";
import { ControlPanel } from "./components/ControlPanel.tsx";
import { HowToPlay } from "./components/HowToPlay.tsx";
import { Flag } from "./components/Flag.tsx";

function phaseShort(phase: string): string {
  switch (phase) {
    case "reinforce": return "Reinforce";
    case "attack":   return "Attack";
    case "fortify":  return "Fortify";
    case "gameover": return "Game Over";
    default:         return phase;
  }
}

export function App() {
  const g = useGame();
  const [panelOpen, setPanelOpen] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [muted, setMutedState] = useState(isMuted());

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  if (!g.state) {
    return (
      <>
        <Setup onStart={g.start} onResume={g.resume} onHelp={() => setShowRules(true)} />
        {showRules && <HowToPlay onClose={() => setShowRules(false)} />}
      </>
    );
  }

  const active = currentPlayer(g.state);
  const faction = g.state.factions.find((f) => f.id === active.factionId)!;

  return (
    <div className={`app${panelOpen ? "" : " panel-collapsed"}`}>
      <div className="topbar">
        <button title="Return to the main menu" onClick={g.quit}>
          ☰<span className="btn-label"> Menu</span>
        </button>
        <button title="How to play" onClick={() => setShowRules(true)}>
          ?<span className="btn-label"> Help</span>
        </button>
        <button title={muted ? "Unmute sound" : "Mute sound"} onClick={toggleMute}>
          {muted ? "🔇" : "🔊"}
        </button>
        {/* Phase chip — visible on mobile so players know their status without
            opening the panel. Hidden on desktop where the panel is always open. */}
        <span className="phase-chip">
          <Flag id={active.factionId} color={faction.color} size={14} />
          {" T"}{g.state.turn} · {phaseShort(g.state.phase)}
        </span>
        <h1>DOMINION · BALANCE OF POWER</h1>
        {g.isAITurn && <span className="badge ai-badge">🤖 {active.name}…</span>}
        <div className="spacer" />
        <div className="players">
          {g.state.players.map((p) => {
            const f = g.state!.factions.find((x) => x.id === p.factionId)!;
            return (
              <span
                key={p.id}
                className="badge"
                style={{
                  opacity: p.isEliminated ? 0.35 : 1,
                  outline: p.id === active.id ? "2px solid var(--accent)" : "none",
                  outlineOffset: "1px",
                }}
              >
                <Flag id={p.factionId} color={f.color} size={18} />
                <span className="player-label">
                  {p.name}
                  {p.isAI && " 🤖"}
                  {p.isEliminated && " ✗"}
                </span>
              </span>
            );
          })}
        </div>
        {/* Panel toggle — visible on mobile, hidden on desktop */}
        <button
          className="panel-toggle"
          onClick={() => setPanelOpen((o) => !o)}
          title="Show or hide the controls"
        >
          {panelOpen ? "▾" : "▴"}<span className="btn-label"> {panelOpen ? "Map" : "Controls"}</span>
        </button>
      </div>
      <MapView
        state={g.state}
        from={g.from}
        to={g.to}
        selectable={g.isAITurn ? new Set() : g.selectable}
        onClick={g.clickTerritory}
      />
      <ControlPanel {...g} />
      {showRules && <HowToPlay onClose={() => setShowRules(false)} />}
    </div>
  );
}

function Setup({
  onStart,
  onResume,
  onHelp,
}: {
  onStart: (
    map: GameMap,
    players: PlayerConfig[],
    factions: Faction[],
    seed?: number,
    startPositions?: Record<string, string>,
  ) => void;
  onResume: () => boolean;
  onHelp: () => void;
}) {
  const [count, setCount] = useState(3);
  const [mapId, setMapId] = useState(DEFAULT_MAP_ID);
  const [loadingMap, setLoadingMap] = useState(false);
  // Per-seat faction overrides, keyed by seat index.
  const [picks, setPicks] = useState<Record<number, string>>({});
  // Default: the first seat is human, the rest are computer opponents.
  const [ai, setAi] = useState<boolean[]>([false, true, true, true, true, true]);
  const savedExists = hasSavedGame();

  // All factions this map can field, and a distinct assignment per seat.
  const avail = availableFactions(mapInfo(mapId).factionIds);
  const byId = new Map(avail.map((f) => [f.id, f]));
  const seatFactionIds = resolveSeats(avail, picks, count);
  const seatFactions = seatFactionIds.map((id) => byId.get(id)!);

  const players: PlayerConfig[] = seatFactions.map((f, i) => ({
    name: f.name,
    factionId: f.id,
    isAI: ai[i],
  }));

  // Loads the chosen map (lazily for non-default maps) before starting.
  const begin = async (seed?: number) => {
    setLoadingMap(true);
    try {
      const info = mapInfo(mapId);
      const map = await info.load();
      onStart(map, players, seatFactions, seed, info.startPositions);
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

      <label>Players & factions</label>
      {Array.from({ length: count }, (_, i) => {
        const usedByOthers = new Set(seatFactionIds.filter((_, j) => j !== i));
        return (
          <div className="player-row" key={i}>
            <span style={{ alignSelf: "center", display: "flex" }}>
              <Flag id={seatFactions[i].id} color={seatFactions[i].color} size={28} />
            </span>
            <select
              style={{ flex: 1 }}
              value={seatFactionIds[i]}
              onChange={(e) => setPicks({ ...picks, [i]: e.target.value })}
            >
              {avail
                .filter((f) => f.id === seatFactionIds[i] || !usedByOthers.has(f.id))
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
            </select>
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
        );
      })}

      <div className="row" style={{ marginTop: 20 }}>
        <button className="primary" disabled={loadingMap} onClick={() => begin(Date.now() >>> 0)}>
          {loadingMap ? "Loading map…" : "New game"}
        </button>
        <button disabled={loadingMap} onClick={() => begin(12345)}>
          New game (fixed seed)
        </button>
        <button disabled={loadingMap} onClick={onHelp}>
          ? How to play
        </button>
      </div>
    </div>
  );
}
