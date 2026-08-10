import type { Game } from "../game/Game";
import {
  BARREL_LEN,
  TANK_BODY_H,
  TANK_BODY_W,
  type Tank,
} from "../game/Tank";

/** World→canvas mapping. Solo fills the screen; online letterboxes. */
export interface View {
  sx: number;
  sy: number;
  ox: number;
  oy: number;
}

/** Draws the battlefield to the canvas. All UI chrome lives in the DOM. */
export class Renderer {
  ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;
    this.canvas = canvas;
  }

  /** Fill-the-screen view (solo default). */
  fillView(game: Game): View {
    return {
      sx: this.canvas.width / game.width,
      sy: this.canvas.height / game.height,
      ox: 0,
      oy: 0,
    };
  }

  /** Uniform-scale centered view (online fixed world). */
  fitView(game: Game): View {
    const s = Math.min(this.canvas.width / game.width, this.canvas.height / game.height);
    return {
      sx: s,
      sy: s,
      ox: (this.canvas.width - game.width * s) / 2,
      oy: (this.canvas.height - game.height * s) / 2,
    };
  }

  render(game: Game, view?: View): void {
    const { ctx } = this;
    const { width, height } = game;
    const v = view ?? this.fillView(game);

    // Clear the full buffer first (letterbox bars when the view is inset).
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#05060c";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(v.sx, 0, 0, v.sy, v.ox, v.oy);

    // Screen shake: jitter the whole battlefield (in world units) while it decays.
    if (game.shake > 0) {
      const s = game.shake;
      ctx.translate((Math.random() * 2 - 1) * s, (Math.random() * 2 - 1) * s);
    }

    this.drawSky(width, height);
    this.drawTerrain(game);

    if (game.isHumanTurn) this.drawAimLine(game);

    for (const t of game.tanks) this.drawTank(ctx, t, t === game.current);
    for (const p of game.projectiles) this.drawProjectile(p);
    this.drawFires(game);
    this.drawParticles(game);
    for (const e of game.explosions) this.drawExplosion(e);
    this.drawWalls(game);
  }

  /** Burning napalm blobs clinging to the ground. */
  private drawFires(game: Game): void {
    const { ctx } = this;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const f of game.fires) {
      const fade = Math.max(0, Math.min(1, f.life / (f.maxLife * 0.5)));
      const flicker = 0.75 + Math.sin(performance.now() / 60 + f.x) * 0.25;
      const r = f.r * flicker;
      const g = ctx.createRadialGradient(f.x, f.y - r * 0.3, 0, f.x, f.y, r);
      g.addColorStop(0, `rgba(255, 240, 190, ${0.85 * fade})`);
      g.addColorStop(0.45, `rgba(255, 140, 40, ${0.6 * fade})`);
      g.addColorStop(1, "rgba(180, 40, 0, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y - r * 0.25, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Visual hint for non-open wall modes. */
  private drawWalls(game: Game): void {
    if (game.wallMode === "open") return;
    const { ctx } = this;
    const color =
      game.wallMode === "bounce"
        ? "rgba(120, 200, 255, 0.5)"
        : game.wallMode === "concrete"
          ? "rgba(200, 200, 200, 0.45)"
          : "rgba(180, 130, 255, 0.4)";
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    if (game.wallMode === "wrap") ctx.setLineDash([10, 12]);
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.lineTo(2, game.height);
    ctx.moveTo(game.width - 2, 0);
    ctx.lineTo(game.width - 2, game.height);
    ctx.stroke();
    ctx.restore();
  }

  private drawParticles(game: Game): void {
    const { ctx } = this;
    for (const p of game.particles.items) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  private drawSky(w: number, h: number): void {
    const { ctx } = this;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#0b1030");
    g.addColorStop(0.55, "#241a3a");
    g.addColorStop(1, "#3a2233");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  private drawTerrain(game: Game): void {
    const { ctx } = this;
    const { surface, width, height } = game.terrain;
    const g = ctx.createLinearGradient(0, height * 0.3, 0, height);
    g.addColorStop(0, "#5a8a3c");
    g.addColorStop(0.06, "#3f6b2a");
    g.addColorStop(0.12, "#6b4a2a");
    g.addColorStop(1, "#3a2a1c");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x < width; x++) ctx.lineTo(x, surface[x]);
    ctx.lineTo(width - 1, height);
    ctx.closePath();
    ctx.fill();

    // Grassy highlight along the surface.
    ctx.strokeStyle = "rgba(150, 220, 120, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, surface[0]);
    for (let x = 1; x < width; x++) ctx.lineTo(x, surface[x]);
    ctx.stroke();
  }

  private drawAimLine(game: Game): void {
    const { ctx } = this;
    if (game.aimLine.length < 2) return;
    ctx.save();
    ctx.setLineDash([2, 9]);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "rgba(255, 240, 200, 0.7)";
    ctx.beginPath();
    ctx.moveTo(game.aimLine[0].x, game.aimLine[0].y);
    for (const pt of game.aimLine) ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    ctx.setLineDash([]);
    const end = game.aimLine[game.aimLine.length - 1];
    ctx.fillStyle = "rgba(255, 240, 200, 0.9)";
    ctx.beginPath();
    ctx.arc(end.x, end.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawTank(
    ctx: CanvasRenderingContext2D,
    t: Tank,
    isCurrent: boolean,
  ): void {
    if (!t.alive) {
      // A small scorch mark / wreck.
      ctx.fillStyle = "rgba(20,20,20,0.6)";
      ctx.beginPath();
      ctx.ellipse(t.x, t.y - 2, TANK_BODY_W / 2, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    const px = t.pivotX;
    const py = t.pivotY;

    // Active-player marker.
    if (isCurrent) {
      ctx.fillStyle = "rgba(255, 204, 51, 0.9)";
      ctx.beginPath();
      const ay = py - 30 + Math.sin(performance.now() / 300) * 3;
      ctx.moveTo(px, ay + 10);
      ctx.lineTo(px - 6, ay);
      ctx.lineTo(px + 6, ay);
      ctx.closePath();
      ctx.fill();
    }

    // Barrel.
    const m = t.muzzle();
    ctx.strokeStyle = "#d7d7e0";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(m.x, m.y);
    ctx.stroke();

    // Body + turret. Flashes white briefly when hit.
    ctx.fillStyle = t.hitFlash > 0 ? mixWhite(t.color, t.hitFlash) : t.color;
    roundRect(ctx, t.x - TANK_BODY_W / 2, t.y - TANK_BODY_H, TANK_BODY_W, TANK_BODY_H, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px, py, 6, Math.PI, 0);
    ctx.fill();

    // Health bar.
    const bw = TANK_BODY_W + 6;
    const bx = t.x - bw / 2;
    const by = t.y - TANK_BODY_H - 16;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(bx, by, bw, 4);
    const frac = Math.max(0, t.health / 100);
    ctx.fillStyle = frac > 0.5 ? "#57d977" : frac > 0.25 ? "#ffd24d" : "#ff5a5a";
    ctx.fillRect(bx, by, bw * frac, 4);

    // Shield bubble.
    if (t.shield > 0) {
      const alpha = 0.18 + Math.min(0.4, t.shield / 400);
      ctx.strokeStyle = `rgba(120, 200, 255, ${alpha + 0.25})`;
      ctx.fillStyle = `rgba(120, 200, 255, ${alpha * 0.4})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(t.x, t.y - TANK_BODY_H / 2, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    void BARREL_LEN; // (referenced via muzzle())
  }

  private drawProjectile(p: { pos: { x: number; y: number }; trail: { x: number; y: number }[] }): void {
    const { ctx } = this;
    // Trail.
    for (let i = 0; i < p.trail.length; i++) {
      const a = i / p.trail.length;
      ctx.fillStyle = `rgba(255, 200, 120, ${a * 0.5})`;
      ctx.beginPath();
      ctx.arc(p.trail[i].x, p.trail[i].y, 1.6 + a * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#fff0c2";
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawExplosion(e: {
    x: number;
    y: number;
    r: number;
    maxR: number;
    t: number;
    dur: number;
    color: string;
  }): void {
    const { ctx } = this;
    const fade = 1 - e.t / e.dur;
    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, Math.max(1, e.r));
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.4, e.color);
    grad.addColorStop(1, "rgba(120,40,10,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(e.x, e.y, Math.max(1, e.r), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** Blend a #rrggbb colour toward white by `amount` (0..1). */
function mixWhite(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const k = Math.max(0, Math.min(1, amount));
  const mix = (c: number) => Math.round(c + (255 - c) * k);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
