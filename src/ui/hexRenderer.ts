import type { GameState } from "../types";
import type { HexCoord, HexMapAdapter, Tile, TileTerrain } from "../hex/hex";
import { makeSampleTiles } from "../hex/hex";
import { paramProgress } from "../engine/terraforming";

/**
 * A minimal placeholder implementation of HexMapAdapter using a 2D canvas.
 * It exists purely so the prototype shows *something* map-like; it is NOT the
 * real renderer. Swap it out for an adapter backed by your own hex-map
 * infrastructure — the rest of the app only depends on the HexMapAdapter
 * interface, not on this file.
 *
 * It does show one nice idea worth keeping: terraforming progress visibly
 * changes the world. As hydrosphere/biomass rise, regolith tiles trend from
 * grey -> blue -> green.
 */

const HEX_SIZE = 34; // center-to-corner, in px

const TERRAIN_BASE: Record<TileTerrain, string> = {
  rock: "#4a4744",
  regolith: "#8a6f57",
  ice: "#cfe8f0",
  water: "#2f6fb0",
  vegetation: "#3f9e5a",
  colony: "#e8d44d",
};

export class CanvasHexRenderer implements HexMapAdapter {
  private ctx: CanvasRenderingContext2D;
  private tiles: Tile[];
  private clickHandler?: (coord: HexCoord) => void;

  constructor(private canvas: HTMLCanvasElement, tiles: Tile[] = makeSampleTiles(4)) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;
    this.tiles = tiles;

    canvas.addEventListener("click", (e) => {
      if (!this.clickHandler) return;
      const rect = canvas.getBoundingClientRect();
      const hit = this.pickTile(e.clientX - rect.left, e.clientY - rect.top);
      if (hit) this.clickHandler(hit.coord);
    });
  }

  getTiles(): Tile[] {
    return this.tiles;
  }

  neighbors(coord: HexCoord): HexCoord[] {
    const dirs = [
      { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
      { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
    ];
    return dirs.map((d) => ({ q: coord.q + d.q, r: coord.r + d.r }));
  }

  onTileClick(handler: (coord: HexCoord) => void): void {
    this.clickHandler = handler;
  }

  render(state: GameState): void {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0c1420";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const tile of this.tiles) {
      const { x, y } = this.hexToPixel(tile.coord);
      this.drawHex(x, y, this.terrainColor(tile, state));
    }
  }

  // --- internals ----------------------------------------------------------

  /** Blend a tile's color to reflect planetary progress. */
  private terrainColor(tile: Tile, state: GameState): string {
    if (tile.terrain !== "regolith") return TERRAIN_BASE[tile.terrain];
    const water = paramProgress(state, "hydrosphere");
    const life = paramProgress(state, "biomass");
    if (life > 0.5) return TERRAIN_BASE.vegetation;
    if (life > 0.2) return "#6f8a4f";
    if (water > 0.4) return TERRAIN_BASE.water;
    if (water > 0.15) return "#5a7a86";
    return TERRAIN_BASE.regolith;
  }

  private hexToPixel(coord: HexCoord): { x: number; y: number } {
    // Pointy-top axial -> pixel.
    const x = HEX_SIZE * Math.sqrt(3) * (coord.q + coord.r / 2);
    const y = HEX_SIZE * 1.5 * coord.r;
    return { x: x + this.canvas.width / 2, y: y + this.canvas.height / 2 };
  }

  private drawHex(cx: number, cy: number, fill: string): void {
    const { ctx } = this;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i - 30);
      const px = cx + HEX_SIZE * Math.cos(angle);
      const py = cy + HEX_SIZE * Math.sin(angle);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private pickTile(px: number, py: number): Tile | undefined {
    // Cheap nearest-center pick; fine for a placeholder.
    let best: Tile | undefined;
    let bestDist = Infinity;
    for (const tile of this.tiles) {
      const { x, y } = this.hexToPixel(tile.coord);
      const d = (x - px) ** 2 + (y - py) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = tile;
      }
    }
    return bestDist <= HEX_SIZE * HEX_SIZE ? best : undefined;
  }
}
