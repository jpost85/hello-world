import "./styles.css";
import { Game, type MatchConfig } from "./game/Game";
import { makeRng } from "./game/Terrain";
import { WORLD_HEIGHT } from "./game/Physics";
import { Renderer } from "./render/Renderer";
import { TouchControls } from "./input/TouchControls";
import { Hud } from "./ui/Hud";
import { Overlays } from "./ui/Shop";
import { Sound } from "./audio/Sound";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const uiRoot = document.getElementById("ui") as HTMLElement;

/** Virtual world width for the current viewport: fixed height, aspect-matched. */
function worldWidthFor(vw: number, vh: number): number {
  return Math.max(240, Math.round(WORLD_HEIGHT * (vw / vh)));
}

/**
 * Size the canvas buffer to the viewport (capped DPI for perf) and return the
 * matching virtual world dimensions. The buffer fills the screen exactly, so
 * there is never any letterboxing — the world just gets wider or narrower.
 */
function sizeCanvas(): { w: number; h: number } {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  canvas.width = Math.max(1, Math.round(vw * dpr));
  canvas.height = Math.max(1, Math.round(vh * dpr));
  canvas.style.width = `${vw}px`;
  canvas.style.height = `${vh}px`;
  return { w: worldWidthFor(vw, vh), h: WORLD_HEIGHT };
}

const initial = sizeCanvas();
const game = new Game(initial.w, initial.h);
game.terrain.generate(makeRng(Date.now() >>> 0)); // backdrop behind the menu

// Re-fit on resize / rotation: rescale the buffer and reflow the live match.
let resizeTimer = 0;
function onViewportChange(): void {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    const { w, h } = sizeCanvas();
    game.resize(w, h);
  }, 80);
}
window.addEventListener("resize", onViewportChange);
window.addEventListener("orientationchange", onViewportChange);

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
