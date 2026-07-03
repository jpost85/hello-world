import "./style.css";
import type { GameState } from "./types";
import {
  createGame,
  createFoundedGame,
  startProject,
  setResearch,
  setPolicy,
  resolveIndependence,
  diplomaticAction,
  answerDiplomacy,
  antagonistAction,
  recruit,
  setGarrison,
  endTurn,
} from "./engine/game";
import { CanvasHexRenderer } from "./ui/hexRenderer";
import { renderFactionSelect, renderGame, type UIController } from "./ui/render";
import type { HexMapAdapter } from "./hex/hex";

/**
 * App bootstrap + controller.
 *
 * This is the only place the three layers meet:
 *   engine (rules)  <->  UI (DOM/canvas)  <->  hex map (your infrastructure)
 *
 * To integrate your real hex map, construct your own HexMapAdapter in
 * `mountGameShell()` in place of CanvasHexRenderer — nothing else changes.
 */

const app = document.querySelector<HTMLDivElement>("#app")!;

let state: GameState | null = null;
let hexMap: HexMapAdapter | null = null;

// Elements that only exist once the game shell is mounted.
let els: {
  topbar: HTMLElement;
  sidebar: HTMLElement;
  logbar: HTMLElement;
  canvas: HTMLCanvasElement;
} | null = null;

const controller: UIController = {
  onSelectFaction(factionId) {
    state = createGame(factionId);
    mountGameShell();
    draw();
  },
  onFoundColony(profile) {
    state = createFoundedGame(profile);
    mountGameShell();
    draw();
  },
  onStartProject(projectId) {
    if (!state) return;
    startProject(state, projectId);
    draw();
  },
  onSetResearch(techId) {
    if (!state) return;
    setResearch(state, techId);
    draw();
  },
  onSetPolicy(axis, optionId) {
    if (!state) return;
    setPolicy(state, axis, optionId);
    draw();
  },
  onResolveIndependence(outcome) {
    if (!state) return;
    resolveIndependence(state, outcome);
    draw();
  },
  onDiplomaticAction(rivalId, action) {
    if (!state) return;
    diplomaticAction(state, rivalId, action);
    draw();
  },
  onDiplomacyResponse(eventId, optionId) {
    if (!state) return;
    answerDiplomacy(state, eventId, optionId);
    draw();
  },
  onAntagonistAction(action) {
    if (!state) return;
    antagonistAction(state, action);
    draw();
  },
  onRecruit(cls) {
    if (!state) return;
    recruit(state, cls);
    draw();
  },
  onSetGarrison(unitId, structureId) {
    if (!state) return;
    setGarrison(state, unitId, structureId);
    draw();
  },
  onRerender() {
    draw();
  },
  onEndTurn() {
    if (!state) return;
    endTurn(state);
    draw();
  },
  onRestart() {
    state = null;
    hexMap = null;
    els = null;
    boot();
  },
};

/** Build the in-game DOM shell and wire up the hex renderer. */
function mountGameShell(): void {
  app.classList.add("in-game");
  app.innerHTML = `
    <header id="topbar"></header>
    <main>
      <section id="map-panel">
        <canvas id="hexmap" width="720" height="560"></canvas>
        <p class="hint">
          Placeholder hex renderer — swap in your existing hex-map
          infrastructure via the <code>HexMapAdapter</code> seam
          (see <code>src/hex/hex.ts</code>).
        </p>
      </section>
      <aside id="sidebar"></aside>
    </main>
    <footer id="logbar"></footer>`;

  els = {
    topbar: app.querySelector<HTMLElement>("#topbar")!,
    sidebar: app.querySelector<HTMLElement>("#sidebar")!,
    logbar: app.querySelector<HTMLElement>("#logbar")!,
    canvas: app.querySelector<HTMLCanvasElement>("#hexmap")!,
  };

  // Swap this for your own adapter to use real map infrastructure.
  hexMap = new CanvasHexRenderer(els.canvas);
  hexMap.onTileClick((coord) => console.log("tile clicked", coord));
}

function draw(): void {
  if (!state || !els) return;
  renderGame(state, controller, els);
  hexMap?.render(state);
}

function boot(): void {
  app.classList.remove("in-game");
  renderFactionSelect(app, controller);
}

boot();
