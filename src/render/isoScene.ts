import { Application, Container, Graphics } from "pixi.js";
import { gridToWorld, worldToGrid, TILE_W, TILE_H } from "../coords.js";
import { inBounds, tileAt, TileType, type MapData } from "../map.js";
import type { WorldState } from "../sim/world.js";
import {
  TILE_COLORS,
  TILE_TOP_TINT,
  HOVER_FILL,
  AGENT_BODY,
  AGENT_OUTLINE,
  AGENT_SHADOW,
  PATH_LINE,
} from "./colors.js";

export interface SceneCallbacks {
  onHover?: (cell: { col: number; row: number } | null) => void;
  onTileClick?: (cell: { col: number; row: number }) => void;
}

const HW = TILE_W / 2;
const HH = TILE_H / 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Renders an isometric map + agents and handles camera and tile picking.
 * RENDER layer only — reads sim state, never mutates it (DESIGN.md §1).
 */
export class IsoScene {
  readonly world = new Container(); // panned/zoomed by the camera
  private readonly tileLayer = new Container();
  private readonly agentLayer = new Container();
  private readonly hover = new Graphics();
  private readonly pathGfx = new Graphics();
  private readonly agentGfx = new Map<number, Graphics>();
  private hovered: { col: number; row: number } | null = null;

  constructor(
    private readonly app: Application,
    private readonly map: MapData,
    private readonly cb: SceneCallbacks = {},
  ) {
    this.world.sortableChildren = true;
    this.tileLayer.zIndex = 0;
    this.hover.zIndex = 5;
    this.agentLayer.zIndex = 10;
    this.agentLayer.sortableChildren = true;
    this.pathGfx.zIndex = -1; // under agents, over tiles
    this.agentLayer.addChild(this.pathGfx);
    this.world.addChild(this.tileLayer, this.hover, this.agentLayer);
    this.app.stage.addChild(this.world);

    this.buildTiles();
    this.centerCamera();
    this.installInput();
  }

  /** Draw one diamond per ground-level cell with painter's-order zIndex. */
  private buildTiles(): void {
    for (let row = 0; row < this.map.height; row++) {
      for (let col = 0; col < this.map.width; col++) {
        const t = tileAt(this.map, col, row, 0);
        if (t === TileType.Empty) continue;
        const { x, y } = gridToWorld(col, row, 0);
        const g = new Graphics();
        g.poly([x + HW, y, x + TILE_W, y + HH, x + HW, y + TILE_H, x, y + HH])
          .fill(TILE_COLORS[t])
          .stroke({ width: 1, color: TILE_TOP_TINT, alpha: 0.5 });
        g.zIndex = col + row; // back-to-front within the level (DESIGN.md §7.2)
        this.tileLayer.addChild(g);
      }
    }
  }

  /** Called every render frame with the current interpolation factor. */
  drawAgents(state: WorldState, alpha: number): void {
    this.pathGfx.clear();
    for (const a of state.agents) {
      // Interpolate between last two sim positions (DESIGN.md §6.4).
      const ic = lerp(a.prevCol, a.col, alpha);
      const ir = lerp(a.prevRow, a.row, alpha);
      const iz = lerp(a.prevZ, a.z, alpha);
      const { x, y } = gridToWorld(ic, ir, iz);
      const cx = x + HW;
      const cy = y + HH;

      // Remaining-path preview line through cell centers.
      if (a.path.length > 0) {
        this.pathGfx.moveTo(cx, cy);
        for (const wp of a.path) {
          const p = gridToWorld(wp.col, wp.row, wp.z);
          this.pathGfx.lineTo(p.x + HW, p.y + HH);
        }
        this.pathGfx.stroke({ width: 2, color: PATH_LINE, alpha: 0.45 });
      }

      let g = this.agentGfx.get(a.id);
      if (!g) {
        g = new Graphics();
        this.agentLayer.addChild(g);
        this.agentGfx.set(a.id, g);
      }
      g.clear();
      g.ellipse(0, 0, 9, 5).fill({ color: AGENT_SHADOW, alpha: 0.35 }); // ground shadow
      g.circle(0, -13, 7)
        .fill(AGENT_BODY)
        .stroke({ width: 1.5, color: AGENT_OUTLINE });
      g.rect(-4, -11, 8, 10).fill(AGENT_BODY); // little body below the head
      g.position.set(cx, cy);
      g.zIndex = ic + ir;
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
    const { x, y } = gridToWorld(this.hovered.col, this.hovered.row, 0);
    this.hover
      .poly([x + HW, y, x + TILE_W, y + HH, x + HW, y + TILE_H, x, y + HH])
      .fill({ color: HOVER_FILL, alpha: 0.28 })
      .stroke({ width: 2, color: HOVER_FILL, alpha: 0.9 });
  }

  /** Screen pixel -> grid cell (camera-aware), or null if off the map. */
  private pickCell(clientX: number, clientY: number): { col: number; row: number } | null {
    const rect = this.app.canvas.getBoundingClientRect();
    const wx = (clientX - rect.left - this.world.position.x) / this.world.scale.x;
    const wy = (clientY - rect.top - this.world.position.y) / this.world.scale.y;
    const { col, row } = worldToGrid(wx, wy, 0);
    return inBounds(this.map, col, row, 0) ? { col, row } : null;
  }

  private installInput(): void {
    const canvas = this.app.canvas;

    let dragging = false;
    let dragDist = 0;
    let lastX = 0;
    let lastY = 0;

    canvas.addEventListener("pointerdown", (e) => {
      dragging = true;
      dragDist = 0;
      lastX = e.clientX;
      lastY = e.clientY;
    });

    window.addEventListener("pointerup", (e) => {
      if (dragging && dragDist < 5) {
        // A click, not a drag → issue a tile command.
        const cell = this.pickCell(e.clientX, e.clientY);
        if (cell) this.cb.onTileClick?.(cell);
      }
      dragging = false;
    });

    canvas.addEventListener("pointermove", (e) => {
      if (dragging) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        dragDist += Math.abs(dx) + Math.abs(dy);
        this.world.position.x += dx;
        this.world.position.y += dy;
        lastX = e.clientX;
        lastY = e.clientY;
      }
      this.updateHover(e.clientX, e.clientY);
    });

    canvas.addEventListener("pointerleave", () => {
      this.hovered = null;
      this.drawHover();
      this.cb.onHover?.(null);
    });

    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        const next = Math.min(4, Math.max(0.35, this.world.scale.x * factor));
        const k = next / this.world.scale.x;
        this.world.position.x = e.clientX - (e.clientX - this.world.position.x) * k;
        this.world.position.y = e.clientY - (e.clientY - this.world.position.y) * k;
        this.world.scale.set(next);
      },
      { passive: false },
    );
  }

  private updateHover(clientX: number, clientY: number): void {
    const cell = this.pickCell(clientX, clientY);
    const changed =
      (cell?.col ?? -1) !== (this.hovered?.col ?? -1) ||
      (cell?.row ?? -1) !== (this.hovered?.row ?? -1);
    if (!changed) return;
    this.hovered = cell;
    this.drawHover();
    this.cb.onHover?.(cell);
  }
}
