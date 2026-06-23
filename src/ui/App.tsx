/**
 * App shell: a start screen to pick a warlord, then the live game — a status
 * bar, the organic map, a bottom-sheet command panel, an event log, and the
 * end-of-season hand-off. Portrait-first and thumb-reachable.
 */
import { useMemo, useState } from "react";
import {
  currentPlayer,
  provincesOf,
  DEFAULT_SCENARIO,
  type GameState,
} from "../engine/index.ts";
import { useGame } from "./useGame.ts";
import { MapView } from "./MapView.tsx";
import { ControlPanel } from "./ControlPanel.tsx";
import { OfficerScreen } from "./OfficerScreen.tsx";
import { DiplomacyScreen } from "./DiplomacyScreen.tsx";

type Drawer = "log" | "court" | "diplomacy" | null;

const SEASON_LABEL: Record<string, string> = { spring: "Spring", summer: "Summer", autumn: "Autumn", winter: "Winter" };

export function App() {
  const game = useGame();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<Drawer>(null);

  if (!game.state) return <StartScreen onStart={game.start} canResume={game.resume} />;

  const state = game.state;
  const human = state.players.find((p) => p.id === game.humanId);
  const targetIds = selectedId && state.provinces[selectedId]?.ownerId === game.humanId
    ? state.map.provinces.find((p) => p.id === selectedId)!.adjacentTo
    : [];

  return (
    <div className="app">
      <StatusBar
        state={state}
        humanId={game.humanId}
        aiThinking={game.aiThinking}
        onCourt={() => setDrawer("court")}
        onDiplomacy={() => setDrawer("diplomacy")}
        onLog={() => setDrawer("log")}
      />

      <div className="map-wrap">
        <MapView
          state={state}
          humanId={game.humanId}
          selectedId={selectedId}
          targetIds={targetIds}
          onSelect={setSelectedId}
        />
      </div>

      {game.error && <div className="error" onClick={() => undefined}>{game.error}</div>}

      <ControlPanel
        state={state}
        humanId={game.humanId}
        isHumanTurn={game.isHumanTurn}
        selectedId={selectedId}
        game={game}
        onPickTarget={() => undefined}
      />

      {game.isHumanTurn && (
        <button className="end-season" onClick={game.endSeason}>
          End Season · {state.commandPointsRemaining} CP
        </button>
      )}

      {state.phase === "gameover" && (
        <Victory state={state} onNewGame={game.abandon} />
      )}

      {drawer === "log" && <LogDrawer state={state} onClose={() => setDrawer(null)} />}
      {drawer === "court" && game.humanId && (
        <OfficerScreen state={state} humanId={game.humanId} isHumanTurn={game.isHumanTurn} game={game} onClose={() => setDrawer(null)} />
      )}
      {drawer === "diplomacy" && game.humanId && (
        <DiplomacyScreen state={state} humanId={game.humanId} isHumanTurn={game.isHumanTurn} game={game} onClose={() => setDrawer(null)} />
      )}

      {human && <FactionRibbon name={human.name} held={provincesOf(state, human.id).length} eliminated={human.isEliminated} />}
    </div>
  );
}

function StatusBar({
  state,
  humanId,
  aiThinking,
  onCourt,
  onDiplomacy,
  onLog,
}: {
  state: GameState;
  humanId: string | null;
  aiThinking: boolean;
  onCourt: () => void;
  onDiplomacy: () => void;
  onLog: () => void;
}) {
  const active = currentPlayer(state);
  const human = state.players.find((p) => p.id === humanId);
  const faction = state.factions.find((f) => f.id === active.id);
  const gold = humanId ? provincesOf(state, humanId).reduce((s, id) => s + state.provinces[id].gold, 0) : 0;
  const prisoners = humanId ? state.officers.filter((o) => o.alive && o.captiveOf === humanId).length : 0;
  return (
    <header className="status">
      <div className="status-left">
        <span className="year">{189 + state.year} AD</span>
        <span className="season">{SEASON_LABEL[state.season]}</span>
      </div>
      <div className="status-mid" style={{ color: faction?.color }}>
        {aiThinking ? `${active.name} is plotting…` : `${active.name}'s command`}
      </div>
      <div className="status-right">
        {human && <span className="gold">⛀ {gold}</span>}
        {human && (
          <button className="log-btn" onClick={onCourt}>
            Court{prisoners > 0 ? ` ·${prisoners}` : ""}
          </button>
        )}
        {human && <button className="log-btn" onClick={onDiplomacy}>Pacts</button>}
        <button className="log-btn" onClick={onLog}>Log</button>
      </div>
    </header>
  );
}

function FactionRibbon({ name, held, eliminated }: { name: string; held: number; eliminated: boolean }) {
  return (
    <div className="ribbon">
      You lead <strong>{name}</strong> · {eliminated ? "fallen" : `${held} province${held === 1 ? "" : "s"}`}
    </div>
  );
}

function LogDrawer({ state, onClose }: { state: GameState; onClose: () => void }) {
  const recent = state.events.slice(-40).reverse();
  return (
    <div className="drawer-scrim" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">Chronicle <button onClick={onClose}>✕</button></div>
        <ul className="log">
          {recent.map((e, i) => (
            <li key={i}>{e.message}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Victory({ state, onNewGame }: { state: GameState; onNewGame: () => void }) {
  const winner = state.players.find((p) => p.id === state.winnerId);
  return (
    <div className="modal-scrim">
      <div className="modal">
        <h1>{winner?.name}</h1>
        <p>commands the realm.</p>
        <button onClick={onNewGame}>New Game</button>
      </div>
    </div>
  );
}

function StartScreen({ onStart, canResume }: { onStart: (factionId: string, seed: number) => void; canResume: () => boolean }) {
  const [resumed, setResumed] = useState(false);
  const seed = useMemo(() => Math.floor(Math.random() * 1e9), []);
  if (resumed) return null;
  return (
    <div className="start">
      <h1>Three Kingdoms</h1>
      <p className="subtitle">189 AD — the Han collapses. Choose your warlord.</p>
      <div className="faction-grid">
        {DEFAULT_SCENARIO.factions.map((f) => (
          <button key={f.id} className="faction-card" style={{ borderColor: f.color }} onClick={() => onStart(f.id, seed)}>
            <span className="swatch" style={{ background: f.color }} />
            {f.name}
          </button>
        ))}
      </div>
      <button
        className="resume"
        onClick={() => {
          if (canResume()) setResumed(true);
        }}
      >
        Resume saved game
      </button>
    </div>
  );
}
