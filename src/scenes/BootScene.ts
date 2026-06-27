import Phaser from "phaser";
import type { CreatureState } from "../systems/types";
import { createStarterCreature } from "../systems/CreatureModel";
import { load } from "../persistence/SaveManager";
import { ERA_ORDER } from "../data/eras";

/**
 * Loads the save (or makes a starter creature) and hands a creature to the
 * GameScene via the registry, then starts gameplay. No assets to preload yet —
 * everything is drawn with Phaser graphics — so this is fast.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    const saved = load();
    const creature: CreatureState = saved?.creature ?? createStarterCreature(ERA_ORDER[0]);
    this.registry.set("creature", creature);
    this.scene.start("Game");
  }
}
