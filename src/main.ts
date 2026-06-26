import { Application } from "pixi.js";
import { makeDemoMap } from "./map.js";
import { IsoScene } from "./render/isoScene.js";
import { createWorld, spawnAgent } from "./sim/world.js";
import { SimLoop } from "./sim/loop.js";

async function main(): Promise<void> {
  const app = new Application();
  await app.init({
    resizeTo: window,
    background: "#0a0a0f",
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  });
  document.getElementById("app")!.appendChild(app.canvas);

  const map = makeDemoMap();
  const world = createWorld(map, 0x5eed1cad); // fixed seed → reproducible
  const agent = spawnAgent(world, 4, 4);

  const hud = document.getElementById("hud-tile")!;
  const scene = new IsoScene(app, map, {
    onHover: (cell) => {
      hud.textContent = cell ? `(${cell.col}, ${cell.row})` : "—";
    },
    onTileClick: (cell) => {
      // Click-to-move: queue a tick-stamped command (DESIGN.md §6.3).
      loop.queue({ type: "move", entityId: agent.id, col: cell.col, row: cell.row });
    },
  });

  const loop = new SimLoop(world, (w, alpha) => scene.drawAgents(w, alpha));
  loop.start();
}

void main();
