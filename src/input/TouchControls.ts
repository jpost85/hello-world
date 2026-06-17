import type { Game } from "../game/Game";

/**
 * Pointer-driven aiming. Drag from anywhere on the battlefield toward where you
 * want to lob the shell: the drag *direction* sets the angle and the drag
 * *length* sets the power. Releasing a deliberate drag fires. Works with mouse
 * and touch via Pointer Events.
 */
export class TouchControls {
  private dragging = false;
  private movedEnough = false;
  private startX = 0;
  private startY = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private game: Game,
  ) {}

  attach(): void {
    this.canvas.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    window.addEventListener("pointercancel", this.onUp);
  }

  private screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * this.game.width,
      y: ((clientY - rect.top) / rect.height) * this.game.height,
    };
  }

  private aimFromPointer(clientX: number, clientY: number): void {
    const tank = this.game.current;
    if (!tank) return;
    const w = this.screenToWorld(clientX, clientY);
    const dx = w.x - tank.pivotX;
    const dy = w.y - tank.pivotY;
    const len = Math.hypot(dx, dy);
    const angle = (Math.atan2(-dy, dx) * 180) / Math.PI; // up = +90
    const maxDrag = this.game.width * 0.32;
    const power = Math.min(100, (len / maxDrag) * 100);
    if (len > 6) this.game.setAim(angle, power);
  }

  private onDown = (e: PointerEvent): void => {
    if (!this.game.isHumanTurn) return;
    this.dragging = true;
    this.movedEnough = false;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.aimFromPointer(e.clientX, e.clientY);
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    if (Math.hypot(e.clientX - this.startX, e.clientY - this.startY) > 10) {
      this.movedEnough = true;
    }
    this.aimFromPointer(e.clientX, e.clientY);
  };

  private onUp = (): void => {
    if (!this.dragging) return;
    this.dragging = false;
    // Only fire on a deliberate drag, so accidental taps don't waste a turn.
    if (this.movedEnough && this.game.isHumanTurn) {
      this.game.fire();
    }
  };
}
