import Phaser from "phaser";

/**
 * One-time setup: generate the few textures we draw from code (no art assets
 * yet), then go to the title screen. Particle emitters need a real texture key,
 * so we bake a soft white dot here and tint it per effect.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    this.makeSparkTexture();
    this.scene.start("Title");
  }

  /** A small radial-ish white dot used for all particle effects. */
  private makeSparkTexture(): void {
    if (this.textures.exists("spark")) return;
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 8);
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(8, 8, 4);
    g.generateTexture("spark", 16, 16);
    g.destroy();
  }
}
