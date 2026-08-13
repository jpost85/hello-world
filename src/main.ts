import "./styles.css";
import { Game, type MatchConfig } from "./game/Game";
import { makeRng } from "./game/Terrain";
import { WORLD_HEIGHT } from "./game/Physics";
import { Renderer, type View } from "./render/Renderer";
import { TouchControls } from "./input/TouchControls";
import { Hud } from "./ui/Hud";
import { Overlays } from "./ui/Shop";
import { Sound } from "./audio/Sound";
import { NetMatch, sanitizeName } from "./net/NetMatch";
import { PeerLink, makeCode, normalizeCode } from "./net/PeerLink";
import type { WallMode } from "./types";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const uiRoot = document.getElementById("ui") as HTMLElement;

/** Virtual world width for the current viewport: fixed height, aspect-matched. */
function worldWidthFor(vw: number, vh: number): number {
  return Math.max(240, Math.round(WORLD_HEIGHT * (vw / vh)));
}

/** Size the canvas buffer to the viewport (capped DPI for perf). */
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

const sound = new Sound();
// Browsers require a user gesture before audio can start.
window.addEventListener("pointerdown", () => sound.unlock(), { once: true });

const renderer = new Renderer(canvas);
const hud = new Hud(uiRoot, game, () => sound.toggleMute());
const overlays = new Overlays(uiRoot);

// Online matches play in a fixed-size world (both peers must see the same
// field), letterboxed to the screen; solo fills the screen edge-to-edge.
let netMatch: NetMatch | null = null;
let pendingLink: PeerLink | null = null;

function currentView(): View {
  return netMatch ? renderer.fitView(game) : renderer.fillView(game);
}

new TouchControls(canvas, game, currentView).attach();

// Re-fit on resize / rotation. Solo reflows the world; online only re-fits
// the view (the shared battlefield must not change size mid-match).
let resizeTimer = 0;
function onViewportChange(): void {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    const { w, h } = sizeCanvas();
    if (!netMatch) game.resize(w, h);
  }, 80);
}
window.addEventListener("resize", onViewportChange);
window.addEventListener("orientationchange", onViewportChange);

game.onBanner = (text) => hud.showBanner(text);
game.onSound = (type, intensity) => sound.play(type, intensity);
game.onStateChange = (next) => {
  if (next === "aiming" || next === "firing") {
    overlays.hide(); // a turn began (net rounds start via host message)
  } else if (next === "roundover") {
    overlays.showShop(
      game,
      () => (netMatch ? netMatch.localShopDone() : game.continueFromShop()),
      netMatch !== null,
    );
  } else if (next === "gameover") {
    if (netMatch) {
      overlays.showGameOver(game, () => netMatch?.startMatch(), {
        isHost: netMatch.role === "host",
        onLeave: () => netMatch?.leave(),
      });
    } else {
      overlays.showGameOver(game, () => openMenu());
    }
  }
};

function openMenu(): void {
  overlays.showMenu({
    onSolo: (cfg: MatchConfig, name: string) => {
      const human = name || "You";
      game.newMatch(cfg);
      const me = game.humanTank();
      if (me) me.name = human;
    },
    onHost: hostRoom,
    onJoin: joinRoom,
  });
}

function netHooks() {
  return {
    onStatus: (text: string) => overlays.updateNetStatus(text),
    onStarted: () => {
      overlays.hide();
      hud.showBanner("Opponent connected — battle!");
    },
    onClosed: (reason: string) => {
      netMatch = null;
      hud.showBanner(reason);
      const { w, h } = sizeCanvas();
      game.resize(w, h);
      openMenu();
    },
  };
}

function attachDiag(link: PeerLink): void {
  link.onDiag = (line) => {
    overlays.updateNetDiag(line);
    // The final verdict is worth surfacing in-game too (the overlay is
    // usually hidden by the time the match starts).
    if (line.startsWith("Connected —") || line.startsWith("Failed —")) {
      hud.showBanner(line);
    }
  };
}

function hostRoom(name: string, cfg: { rounds: number; wallMode: WallMode }): void {
  cancelPending();
  const tryHost = (attempt: number): void => {
    const code = makeCode();
    const link = new PeerLink();
    pendingLink = link;
    attachDiag(link);
    overlays.showNetWait("Opening room…", "Contacting matchmaking server…", cancelPending);
    link.host(code, {
      onOpen: () =>
        overlays.showRoomCode(code, "Waiting for your friend to join…", cancelPending),
      onPeer: () => {
        pendingLink = null;
        netMatch = new NetMatch("host", link, game, sanitizeName(name), cfg, netHooks());
        overlays.updateNetStatus("Friend connected — starting…");
        // Match starts when the guest's hello arrives (handled in NetMatch).
      },
      onIssue: (why) => overlays.updateNetStatus(why),
      onError: (why) => {
        if (why === "unavailable-id" && attempt < 5) {
          link.close();
          tryHost(attempt + 1); // code collision — roll a new one
        } else {
          link.close();
          pendingLink = null;
          overlays.updateNetStatus(why);
        }
      },
    });
  };
  tryHost(0);
}

function joinRoom(name: string, rawCode: string): void {
  cancelPending();
  const code = normalizeCode(rawCode);
  const link = new PeerLink();
  pendingLink = link;
  attachDiag(link);
  overlays.showNetWait(
    `Joining <span class="flame">${code}</span>…`,
    "Contacting matchmaking server…",
    cancelPending,
  );
  link.join(code, {
    onStatus: (text) => overlays.updateNetStatus(text),
    onOpen: () => {
      pendingLink = null;
      netMatch = new NetMatch(
        "guest",
        link,
        game,
        sanitizeName(name),
        { rounds: 5, wallMode: "open" }, // host's settings arrive with "start"
        netHooks(),
      );
    },
    onError: (why) => {
      link.close();
      pendingLink = null;
      overlays.updateNetStatus(why);
    },
  });
}

function cancelPending(): void {
  if (pendingLink) {
    pendingLink.close();
    pendingLink = null;
  }
  if (netMatch) {
    netMatch.leave(); // triggers onClosed → menu; guard against double-open
    netMatch = null;
  } else {
    openMenu();
  }
}

openMenu();

let last = performance.now();
function frame(now: number): void {
  const dt = (now - last) / 1000;
  last = now;
  game.update(dt);
  netMatch?.update(dt);
  renderer.render(game, currentView());
  hud.update(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
