import type { Game, MatchConfig } from "../game/Game";
import type { Difficulty, WallMode } from "../types";
import { PURCHASABLE } from "../game/Weapons";
import { ITEMS } from "../game/Items";

/**
 * Full-screen modal overlays: the start menu, the between-rounds shop, and the
 * end-of-match results. One container, contents swapped per screen.
 */
export class Overlays {
  private root: HTMLElement;
  private card: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = el("div", "overlay hidden");
    this.card = el("div", "card");
    this.root.append(this.card);
    parent.append(this.root);
  }

  hide(): void {
    this.root.classList.add("hidden");
  }

  private show(): void {
    this.root.classList.remove("hidden");
    this.card.scrollTop = 0;
  }

  // ------------------------------------------------------------------- menu

  showMenu(handlers: {
    onSolo: (config: MatchConfig, name: string) => void;
    onHost: (name: string, cfg: { rounds: number; wallMode: WallMode }) => void;
    onJoin: (name: string, code: string) => void;
  }): void {
    this.card.innerHTML = "";
    const cfg: MatchConfig = { opponents: 1, difficulty: "normal", rounds: 5, wallMode: "open" };

    const h1 = el("h1");
    h1.innerHTML = `Over<span class="flame">shot</span>`;
    const sub = el("p", "sub");
    sub.textContent = "Drag from your tank to aim — direction sets the angle, length sets the power. Release to fire.";

    // Commander name, remembered across visits.
    const nameField = el("div", "field");
    const nameLab = el("span");
    nameLab.textContent = "Your name";
    const nameInput = el("input", "text-input") as HTMLInputElement;
    nameInput.type = "text";
    nameInput.maxLength = 12;
    nameInput.placeholder = "Commander";
    nameInput.value = localStorage.getItem("overshot-name") ?? "";
    nameInput.addEventListener("input", () => {
      localStorage.setItem("overshot-name", nameInput.value);
    });
    nameField.append(nameLab, nameInput);
    const myName = () => (nameInput.value.trim() || "Commander").slice(0, 12);

    const opponents = segmented(
      "Opponents (solo)",
      ["1", "2", "3"],
      0,
      (i) => (cfg.opponents = i + 1),
    );
    const difficulty = segmented(
      "Difficulty",
      ["Easy", "Normal", "Hard"],
      1,
      (i) => (cfg.difficulty = (["easy", "normal", "hard"] as Difficulty[])[i]),
    );
    const rounds = segmented(
      "Rounds",
      ["3", "5", "7"],
      1,
      (i) => (cfg.rounds = [3, 5, 7][i]),
    );
    const walls = segmented(
      "Walls",
      ["Open", "Wrap", "Bounce", "Solid"],
      0,
      (i) =>
        (cfg.wallMode = (["open", "wrap", "bounce", "concrete"] as WallMode[])[i]),
    );

    const start = el("button", "primary") as HTMLButtonElement;
    start.textContent = "▶ Start Solo Battle";
    start.addEventListener("click", () => {
      this.hide();
      handlers.onSolo(cfg, myName());
    });

    // ---- Online 1v1 ----
    const divider = el("div", "divider");
    divider.textContent = "Online 1v1 — play a friend";

    const hostBtn = el("button", "netbtn") as HTMLButtonElement;
    hostBtn.textContent = "🌐 Host a Room";
    hostBtn.addEventListener("click", () => {
      handlers.onHost(myName(), {
        rounds: cfg.rounds,
        wallMode: cfg.wallMode ?? "open",
      });
    });

    const joinRow = el("div", "join-row");
    const codeInput = el("input", "text-input code") as HTMLInputElement;
    codeInput.type = "text";
    codeInput.maxLength = 4;
    codeInput.placeholder = "CODE";
    codeInput.autocapitalize = "characters";
    codeInput.addEventListener("input", () => {
      codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z]/g, "");
    });
    const joinBtn = el("button", "netbtn") as HTMLButtonElement;
    joinBtn.textContent = "Join";
    joinBtn.addEventListener("click", () => {
      if (codeInput.value.length === 4) handlers.onJoin(myName(), codeInput.value);
    });
    joinRow.append(codeInput, joinBtn);

    const netHint = el("p", "hint");
    netHint.textContent = "Rounds & Walls above apply to rooms you host.";

    this.card.append(
      h1, sub, nameField, opponents, difficulty, rounds, walls, start,
      divider, hostBtn, joinRow, netHint,
    );
    this.show();
  }

  // ---------------------------------------------------------------- net lobby

  private netStatusEl: HTMLElement | null = null;

  /** Waiting/connecting screen with a live status line. */
  showNetWait(title: string, status: string, onCancel: () => void): void {
    this.card.innerHTML = "";
    const h1 = el("h1");
    h1.innerHTML = title;
    const stat = el("p", "net-status");
    stat.textContent = status;
    this.netStatusEl = stat;
    const cancel = el("button", "primary cancel") as HTMLButtonElement;
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", onCancel);
    this.card.append(h1, stat, cancel);
    this.show();
  }

  updateNetStatus(status: string): void {
    if (this.netStatusEl) this.netStatusEl.textContent = status;
  }

  /** Waiting screen variant that shows the shareable room code big. */
  showRoomCode(code: string, status: string, onCancel: () => void): void {
    this.card.innerHTML = "";
    const h1 = el("h1");
    h1.textContent = "Room open";
    const codeEl = el("div", "room-code");
    codeEl.textContent = code;
    const stat = el("p", "net-status");
    stat.textContent = status;
    this.netStatusEl = stat;
    const hint = el("p", "hint");
    hint.textContent = "Share this code — your friend taps Join and types it in.";
    const cancel = el("button", "primary cancel") as HTMLButtonElement;
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", onCancel);
    this.card.append(h1, codeEl, hint, stat, cancel);
    this.show();
  }

  // ------------------------------------------------------------------- shop

  showShop(game: Game, onContinue: () => void, online = false): void {
    this.card.innerHTML = "";
    const human = game.humanTank();

    const head = el("div");
    head.style.cssText = "display:flex;justify-content:space-between;align-items:center";
    const h = el("h1");
    h.textContent = "Armoury";
    const cash = el("span", "shop-cash");
    head.append(h, cash);

    const sub = el("p", "sub");
    sub.textContent = `Round ${game.round} complete. Spend your winnings, then fight on.`;

    const list = el("div", "shop-list");
    const refresh = () => {
      if (human) cash.textContent = `$${human.cash}`;
      list.querySelectorAll<HTMLElement>(".shop-row").forEach((r) => r.dispatchEvent(new Event("sync")));
    };

    // Generic buyable row: `owned` reports the current stock, `buy` returns
    // whether the purchase succeeded.
    const makeRow = (
      label: string,
      desc: string,
      price: number,
      owned: () => string,
      affordable: () => boolean,
      buy: () => boolean,
    ): HTMLElement => {
      const row = el("div", "shop-row");
      const info = el("div", "info");
      const name = el("div", "name");
      name.textContent = `${label} — $${price}`;
      const d = el("div", "desc");
      d.textContent = desc;
      info.append(name, d);

      const ownedEl = el("div", "owned");
      const buyBtn = el("button", "buy") as HTMLButtonElement;
      buyBtn.textContent = "Buy";
      const sync = () => {
        ownedEl.textContent = owned();
        buyBtn.disabled = !affordable();
      };
      buyBtn.addEventListener("click", () => {
        if (buy()) refresh();
      });
      row.addEventListener("sync", sync);
      sync();
      row.append(info, ownedEl, buyBtn);
      return row;
    };

    for (const w of PURCHASABLE) {
      list.append(
        makeRow(
          w.name,
          w.desc,
          w.price,
          () => `×${human?.inventory[w.id] ?? 0}`,
          () => !!human && human.cash >= w.price,
          () => game.buyWeapon(w.id),
        ),
      );
    }

    const defHead = el("div", "desc");
    defHead.style.cssText = "margin:6px 2px 0;text-transform:uppercase;letter-spacing:.05em";
    defHead.textContent = "Defensive";
    list.append(defHead);

    for (const it of ITEMS) {
      list.append(
        makeRow(
          it.name,
          it.desc,
          it.price,
          () => (it.kind === "shield" ? `⛨${Math.ceil(human?.shield ?? 0)}` : `×${human?.parachutes ?? 0}`),
          () => {
            if (!human || human.cash < it.price) return false;
            const cur = it.kind === "shield" ? human.shield : human.parachutes;
            return cur < it.cap;
          },
          () => game.buyItem(it.id),
        ),
      );
    }

    const cont = el("button", "primary") as HTMLButtonElement;
    cont.textContent = online ? "Ready ▶" : "Continue ▶";
    cont.addEventListener("click", () => {
      if (online) {
        // Stay visible until the host starts the next round; disable buying
        // further so both players' inventories stay settled.
        cont.disabled = true;
        cont.textContent = "Waiting for opponent…";
        onContinue();
      } else {
        this.hide();
        onContinue();
      }
    });

    this.card.append(head, sub, this.scoreboard(game), list, cont);
    refresh();
    this.show();
  }

  // ---------------------------------------------------------------- gameover

  showGameOver(
    game: Game,
    onRestart: () => void,
    net?: { isHost: boolean; onLeave: () => void },
  ): void {
    this.card.innerHTML = "";
    const ranked = [...game.tanks].sort((a, b) => b.score - a.score);
    const winner = ranked[0];
    const localWon = winner && winner.id === game.localId && !winner.isAI;

    const h1 = el("h1");
    h1.innerHTML = localWon ? "🏆 Victory!" : "Game Over";
    const sub = el("p", "sub");
    sub.textContent = winner ? `${winner.name} takes the match with ${winner.score} round win(s).` : "";

    this.card.append(h1, sub, this.scoreboard(game));

    if (net) {
      if (net.isHost) {
        const again = el("button", "primary") as HTMLButtonElement;
        again.textContent = "↻ Rematch";
        again.addEventListener("click", onRestart);
        this.card.append(again);
      } else {
        const hint = el("p", "hint");
        hint.textContent = "The host can start a rematch — hang tight, or leave.";
        this.card.append(hint);
      }
      const leave = el("button", "primary cancel") as HTMLButtonElement;
      leave.textContent = "Leave Match";
      leave.addEventListener("click", net.onLeave);
      this.card.append(leave);
    } else {
      const again = el("button", "primary") as HTMLButtonElement;
      again.textContent = "↻ Play Again";
      again.addEventListener("click", () => {
        this.hide();
        onRestart();
      });
      this.card.append(again);
    }
    this.show();
  }

  private scoreboard(game: Game): HTMLElement {
    const box = el("div", "results");
    const ranked = [...game.tanks].sort((a, b) => b.score - a.score);
    for (const t of ranked) {
      const line = el("div", "line");
      const name = el("span");
      name.innerHTML = `<span style="color:${t.color}">●</span> ${t.name}${t.isAI ? " (CPU)" : ""}`;
      const pts = el("span", "pts");
      pts.textContent = `${t.score} win${t.score === 1 ? "" : "s"}`;
      line.append(name, pts);
      box.append(line);
    }
    return box;
  }
}

function el(tag: string, className = ""): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

function segmented(
  label: string,
  options: string[],
  initial: number,
  onPick: (index: number) => void,
): HTMLElement {
  const field = el("div", "field");
  const lab = el("span");
  lab.textContent = label;
  const seg = el("div", "segmented");
  const btns: HTMLButtonElement[] = [];
  options.forEach((opt, i) => {
    const b = el("button") as HTMLButtonElement;
    b.textContent = opt;
    if (i === initial) b.classList.add("sel");
    b.addEventListener("click", () => {
      btns.forEach((x) => x.classList.remove("sel"));
      b.classList.add("sel");
      onPick(i);
    });
    btns.push(b);
    seg.append(b);
  });
  field.append(lab, seg);
  return field;
}
