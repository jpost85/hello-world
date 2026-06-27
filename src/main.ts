import "./styles.css";
import { Game, type MatchConfig } from "./game/Game";
import { makeRng } from "./game/Terrain";
import { Renderer } from "./render/Renderer";
import { TouchControls } from "./input/TouchControls";
import { Hud } from "./ui/Hud";
import { Overlays } from "./ui/Shop";
import { Sound } from "./audio/Sound";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const uiRoot = document.getElementById("ui") as HTMLElement;

// Fixed drawing buffer chosen at load; the element is scaled to fit the
// viewport (preserving aspect) on resize/rotate.
const dpr = Math.min(window.devicePixelRatio || 1, 2);
const cssW = window.innerWidth;
const cssH = window.innerHeight;
canvas.width = Math.round(cssW * dpr);
canvas.height = Math.round(cssH * dpr);

function fitToViewport(): void {
  const scale = Math.min(window.innerWidth / cssW, window.innerHeight / cssH);
  canvas.style.width = `${cssW * scale}px`;
  canvas.style.height = `${cssH * scale}px`;
}
fitToViewport();
window.addEventListener("resize", fitToViewport);
window.addEventListener("orientationchange", fitToViewport);

const game = new Game(canvas.width, canvas.height);
game.terrain.generate(makeRng(Date.now() >>> 0)); // backdrop behind the menu

const sound = new Sound();
// Browsers require a user gesture before audio can start.
window.addEventListener("pointerdown", () => sound.unlock(), { once: true });

const renderer = new Renderer(canvas);
const hud = new Hud(uiRoot, game, () => sound.toggleMute());
const overlays = new Overlays(uiRoot);
new TouchControls(canvas, game).attach();

game.onBanner = (text) => hud.showBanner(text);
game.onSound = (type, intensity) => sound.play(type, intensity);
game.onStateChange = (next) => {
  if (next === "roundover") {
    overlays.showShop(game, () => game.continueFromShop());
  } else if (next === "gameover") {
    overlays.showGameOver(game, () => openMenu());
  }
};

function startMatch(config: MatchConfig): void {
  game.newMatch(config);
}

function openMenu(): void {
  overlays.showMenu(startMatch);
}

openMenu();

let last = performance.now();
function frame(now: number): void {
  const dt = (now - last) / 1000;
  last = now;
  game.update(dt);
  renderer.render(game);
  hud.update(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
