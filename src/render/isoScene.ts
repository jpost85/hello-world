import { Application, Container, Graphics } from "pixi.js";
import { gridToWorld, worldToGrid, TILE_W, TILE_H } from "../coords.js";
import { inBounds, tileAt, TileType, type MapData } from "../map.js";
import { TILE_COLORS, TILE_TOP_TINT, HOVER_FILL } from "./colors.js";

/**
 * Renders an isometric map and handles camera + tile picking.
 * RENDER layer only — reads MapData, never mutates sim state (DESIGN.md §1).
 */
export class IsoScene {
  readonly world = new Container(); // panned/zoomed by the camera
  private readonly tileLayer = new Container();
  private readonly hover = new Graphics();
  private hovered: { col: number; row: number } | null = null;

  constructor(
    private readonly app: Application,
    private readonly map: MapData,
    private readonly onHover?: (cell: { col: number; row: number } | null) => void,
  ) {
    this.world.sortableChildren = true;
    this.world.addChild(this.tileLayer);
    this.world.addChild(this.hover);
    app.stage.addChild(this.world);

    this.buildTiles();
    this.centerCamera();
    this.installInput();
  }

  /** Draw one diamond per ground-level cell with painter's-order zIndex. */
  private buildTiles(): void {
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;
    for (let row = 0; row < this.map.height; row++) {
      for (let col = 0; col < this.map.width; col++) {
        const t = tileAt(this.map, col, row, 0);
        if (t === TileType.Empty) continue;
        const { x, y } = gridToWorld(col, row, 0);
        const g = new Graphics();
        // Diamond, anchored so (x,y) is the top vertex.
        g.poly([x + hw, y, x + TILE_W, y + hh, x + hw, y + TILE_H, x, y + hh])
          .fill(TILE_COLORS[t])
          .stroke({ width: 1, color: TILE_TOP_TINT, alpha: 0.5 });
        g.zIndex = col + row; // back-to-front within the level (DESIGN.md §7.2)
        this.tileLayer.addChild(g);
      }
    }
  }

  private centerCamera(): void {
    const mid = gridToWorld(this.map.width / 2, this.map.height / 2, 0);
    this.world.position.set(
      this.app.renderer.width / 2 - mid.x,
      this.app.renderer.height / 2 - mid.y,
    );
  }

  private drawHover(): void {
    this.hover.clear();
    if (!this.hovered) return;
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;
    const { x, y } = gridToWorld(this.hovered.col, this.hovered.row, 0);
    this.hover
      .poly([x + hw, y, x + TILE_W, y + hh, x + hw, y + TILE_H, x, y + hh])
      .fill({ color: HOVER_FILL, alpha: 0.28 })
      .stroke({ width: 2, color: HOVER_FILL, alpha: 0.9 });
    this.hover.zIndex = 1e6; // always on top of tiles
  }

  private installInput(): void {
    const canvas = this.app.canvas;

    // Pan via drag.
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    canvas.addEventListener("pointerdown", (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });
    window.addEventListener("pointerup", () => (dragging = false));
    canvas.addEventListener("pointermove", (e) => {
      if (dragging) {
        this.world.position.x += e.clientX - lastX;
        this.world.position.y += e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
      }
      this.updateHover(e.clientX, e.clientY);
    });
    canvas.addEventListener("pointerleave", () => {
      this.hovered = null;
      this.drawHover();
      this.onHover?.(null);
    });

    // Zoom about the cursor.
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        const next = Math.min(4, Math.max(0.35, this.world.scale.x * factor));
        const k = next / this.world.scale.x;
        // Keep the point under the cursor stationary.
        this.world.position.x = e.clientX - (e.clientX - this.world.position.x) * k;
        this.world.position.y = e.clientY - (e.clientY - this.world.position.y) * k;
        this.world.scale.set(next);
      },
      { passive: false },
    );
  }

  /** Screen pixel -> grid cell, accounting for camera pan/zoom. */
  private updateHover(clientX: number, clientY: number): void {
    const rect = this.app.canvas.getBoundingClientRect();
    const wx = (clientX - rect.left - this.world.position.x) / this.world.scale.x;
    const wy = (clientY - rect.top - this.world.position.y) / this.world.scale.y;
    const { col, row } = worldToGrid(wx, wy, 0);
    const cell = inBounds(this.map, col, row, 0) ? { col, row } : null;

    const changed =
      (cell?.col ?? -1) !== (this.hovered?.col ?? -1) ||
      (cell?.row ?? -1) !== (this.hovered?.row ?? -1);
    if (!changed) return;
    this.hovered = cell;
    this.drawHover();
    this.onHover?.(cell);
  }
}
