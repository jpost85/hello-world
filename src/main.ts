import Phaser from "phaser";
import { GAME_CONFIG } from "./config";
import { BootScene } from "./scenes/BootScene";
import { TitleScene } from "./scenes/TitleScene";
import { GameScene } from "./scenes/GameScene";
import { EvolutionScene } from "./scenes/EvolutionScene";
import { GameOverScene } from "./scenes/GameOverScene";

/**
 * Entry point. Phaser is only ever wired up here and in `src/scenes`; the
 * simulation in `src/systems` stays renderer-agnostic and unit-testable.
 */
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#0b1d2a",
  width: GAME_CONFIG.width,
  height: GAME_CONFIG.height,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: { debug: false },
  },
  scene: [BootScene, TitleScene, GameScene, EvolutionScene, GameOverScene],
});

// Debug handle: lets you poke at scenes from the devtools console
// (e.g. `game.scene.getScene('Game')`). Harmless in production.
(window as unknown as { game: Phaser.Game }).game = game;
