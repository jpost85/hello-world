import type { Game, MatchConfig } from "../game/Game";
import type { Difficulty } from "../types";
import { PURCHASABLE } from "../game/Weapons";

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

  showMenu(onStart: (config: MatchConfig) => void): void {
    this.card.innerHTML = "";
    const cfg: MatchConfig = { opponents: 1, difficulty: "normal", rounds: 5 };

    const h1 = el("h1");
    h1.innerHTML = `Scorched <span class="flame">Earth</span>`;
    const sub = el("p", "sub");
    sub.textContent = "Drag from your tank to aim — direction sets the angle, length sets the power. Release to fire.";

    const opponents = segmented(
      "Opponents",
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

    const start = el("button", "primary") as HTMLButtonElement;
    start.textContent = "▶ Start Battle";
    start.addEventListener("click", () => {
      this.hide();
      onStart(cfg);
    });

    this.card.append(h1, sub, opponents, difficulty, rounds, start);
    this.show();
  }

  // ------------------------------------------------------------------- shop

  showShop(game: Game, onContinue: () => void): void {
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
    };

    for (const w of PURCHASABLE) {
      const row = el("div", "shop-row");
      const info = el("div", "info");
      const name = el("div", "name");
      name.textContent = `${w.name} — $${w.price}`;
      const desc = el("div", "desc");
      desc.textContent = w.desc;
      info.append(name, desc);

      const owned = el("div", "owned");
      const buy = el("button", "buy") as HTMLButtonElement;

      const sync = () => {
        const count = human?.inventory[w.id] ?? 0;
        owned.textContent = `×${count}`;
        buy.disabled = !human || human.cash < w.price;
      };
      buy.textContent = "Buy";
      buy.addEventListener("click", () => {
        if (game.buyWeapon(w.id)) {
          refresh();
          // Re-sync every row (affordability changes with cash).
          list.querySelectorAll<HTMLElement>(".shop-row").forEach((r) => r.dispatchEvent(new Event("sync")));
        }
      });
      row.addEventListener("sync", sync);
      sync();

      row.append(info, owned, buy);
      list.append(row);
    }

    const cont = el("button", "primary") as HTMLButtonElement;
    cont.textContent = "Continue ▶";
    cont.addEventListener("click", () => {
      this.hide();
      onContinue();
    });

    this.card.append(head, sub, this.scoreboard(game), list, cont);
    refresh();
    this.show();
  }

  // ---------------------------------------------------------------- gameover

  showGameOver(game: Game, onRestart: () => void): void {
    this.card.innerHTML = "";
    const ranked = [...game.tanks].sort((a, b) => b.score - a.score);
    const winner = ranked[0];

    const h1 = el("h1");
    h1.innerHTML = winner && !winner.isAI ? "🏆 Victory!" : "Game Over";
    const sub = el("p", "sub");
    sub.textContent = winner ? `${winner.name} takes the match with ${winner.score} round win(s).` : "";

    this.card.append(h1, sub, this.scoreboard(game));

    const again = el("button", "primary") as HTMLButtonElement;
    again.textContent = "↻ Play Again";
    again.addEventListener("click", () => {
      this.hide();
      onRestart();
    });
    this.card.append(again);
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
