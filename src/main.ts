import { Application } from "pixi.js";
import { makeDemoMap } from "./map.js";
import { IsoScene } from "./render/isoScene.js";

async function main(): Promise<void> {
  const app = new Application();
  await app.init({
    resizeTo: window,
    background: "#0a0a0f",
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  });

  const root = document.getElementById("app")!;
  root.appendChild(app.canvas);

  const map = makeDemoMap();
  const hud = document.getElementById("hud-tile")!;
  new IsoScene(app, map, (cell) => {
    hud.textContent = cell ? `(${cell.col}, ${cell.row})` : "—";
  });
}

void main();
