import type { Game } from "../game/Game";
import { getWeapon } from "../game/Weapons";

/** Top status bar + bottom control panel, built as DOM over the canvas. */
export class Hud {
  private turnDot: HTMLElement;
  private turnName: HTMLElement;
  private windEl: HTMLElement;
  private roundEl: HTMLElement;
  private hpEl: HTMLElement;
  private cashEl: HTMLElement;

  private controls: HTMLElement;
  private angleVal: HTMLElement;
  private angleBar: HTMLElement;
  private powerVal: HTMLElement;
  private powerBar: HTMLElement;
  private weaponBtn: HTMLButtonElement;
  private fireBtn: HTMLButtonElement;

  private banner: HTMLElement;
  private bannerTimer = 0;

  constructor(
    root: HTMLElement,
    private game: Game,
  ) {
    // ---- Top status bar ----
    const bar = el("div", "statusbar");
    const turn = el("div", "chip turn");
    this.turnDot = el("span", "dot");
    this.turnDot.style.cssText =
      "width:10px;height:10px;border-radius:50%;display:inline-block";
    this.turnName = el("span");
    turn.append(this.turnDot, this.turnName);

    this.windEl = el("div", "chip wind");
    this.roundEl = el("div", "chip");
    const spacer = el("div", "spacer");
    this.hpEl = el("div", "chip");
    this.cashEl = el("div", "chip");
    bar.append(turn, this.windEl, this.roundEl, spacer, this.hpEl, this.cashEl);

    // ---- Center banner ----
    this.banner = el("div", "banner");
    this.banner.style.cssText =
      "position:fixed;top:46%;left:0;right:0;text-align:center;font-size:22px;" +
      "font-weight:800;color:#ffcc33;text-shadow:0 2px 8px #000;pointer-events:none;" +
      "opacity:0;transition:opacity .25s";

    // ---- Bottom controls ----
    this.controls = el("div", "controls");
    const dials = el("div", "dials");

    const angle = this.buildDial("Angle", () => this.game.nudgeAngle(-1), () => this.game.nudgeAngle(1));
    this.angleVal = angle.value;
    this.angleBar = angle.bar;

    const power = this.buildDial("Power", () => this.game.nudgePower(-1), () => this.game.nudgePower(1));
    this.powerVal = power.value;
    this.powerBar = power.bar;

    const weaponRow = el("div", "dial");
    this.weaponBtn = el("button", "weaponbtn") as HTMLButtonElement;
    this.weaponBtn.addEventListener("click", () => this.game.cycleWeapon(1));
    weaponRow.append(this.weaponBtn);

    dials.append(angle.row, power.row, weaponRow);

    this.fireBtn = el("button", "fire") as HTMLButtonElement;
    this.fireBtn.textContent = "FIRE";
    this.fireBtn.addEventListener("click", () => this.game.fire());

    this.controls.append(dials, this.fireBtn);

    root.append(bar, this.banner, this.controls);
  }

  showBanner(text: string): void {
    this.banner.textContent = text;
    this.banner.style.opacity = "1";
    this.bannerTimer = 1.8;
  }

  update(dt: number): void {
    const g = this.game;
    const cur = g.current;

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.banner.style.opacity = "0";
    }

    const inGame = g.state !== "menu" && g.state !== "gameover";
    if (cur && inGame) {
      this.turnDot.style.background = cur.color;
      this.turnName.textContent = cur.isAI ? `${cur.name} (CPU)` : cur.name;
    }

    const w = Math.round(g.wind);
    const arrow = w === 0 ? "•" : w > 0 ? "→" : "←";
    this.windEl.innerHTML = `Wind <span class="arrow">${arrow}</span> ${Math.abs(w)}`;
    this.roundEl.textContent = `Round ${g.round}/${g.config.rounds}`;

    const human = g.humanTank();
    if (human) {
      this.hpEl.textContent = `❤ ${Math.ceil(human.health)}`;
      this.cashEl.textContent = `$${human.cash}`;
    }

    // Bottom controls only while it's the human's turn.
    const showControls = g.isHumanTurn;
    this.controls.classList.toggle("hidden", !showControls);
    if (showControls && cur) {
      this.angleVal.textContent = `${Math.round(cur.angle)}°`;
      this.angleBar.style.width = `${(cur.angle / 180) * 100}%`;
      this.powerVal.textContent = `${Math.round(cur.power)}`;
      this.powerBar.style.width = `${cur.power}%`;

      const wpn = getWeapon(cur.selectedWeapon);
      const ammo = cur.ammoOf(wpn.id);
      const ammoStr = ammo === Infinity ? "∞" : `${ammo}`;
      this.weaponBtn.textContent = `◀ ${wpn.name} ×${ammoStr} ▶`;
      this.fireBtn.disabled = false;
    } else {
      this.fireBtn.disabled = true;
    }
  }

  private buildDial(
    label: string,
    onMinus: () => void,
    onPlus: () => void,
  ): { row: HTMLElement; value: HTMLElement; bar: HTMLElement } {
    const row = el("div", "dial");
    const lab = el("span", "label");
    lab.textContent = label;
    const minus = el("button", "step") as HTMLButtonElement;
    minus.textContent = "−";
    const value = el("span", "value");
    const barWrap = el("div", "bar");
    const bar = el("i");
    barWrap.append(bar);
    const plus = el("button", "step") as HTMLButtonElement;
    plus.textContent = "+";
    holdRepeat(minus, onMinus);
    holdRepeat(plus, onPlus);
    row.append(lab, minus, value, barWrap, plus);
    return { row, value, bar };
  }
}

function el(tag: string, className = ""): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

/** Fire once on tap, then auto-repeat while the button is held down. */
function holdRepeat(btn: HTMLElement, fn: () => void): void {
  let timer: number | undefined;
  let interval: number | undefined;
  const start = (e: Event) => {
    e.preventDefault();
    fn();
    timer = window.setTimeout(() => {
      interval = window.setInterval(fn, 60);
    }, 320);
  };
  const stop = () => {
    window.clearTimeout(timer);
    window.clearInterval(interval);
  };
  btn.addEventListener("pointerdown", start);
  btn.addEventListener("pointerup", stop);
  btn.addEventListener("pointerleave", stop);
  btn.addEventListener("pointercancel", stop);
}
