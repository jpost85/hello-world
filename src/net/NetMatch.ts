import type { Game } from "../game/Game";
import type { WallMode } from "../types";
import {
  NET_VERSION,
  NET_WORLD_H,
  NET_WORLD_W,
  type Link,
  type Msg,
} from "./protocol";

export interface NetMatchHooks {
  /** Lobby / connection status line for the UI. */
  onStatus(text: string): void;
  /** A match just started (or restarted) — hide lobby overlays. */
  onStarted(): void;
  /** Connection is gone; the game has been reset to menu state. */
  onClosed(reason: string): void;
}

export interface NetConfig {
  rounds: number;
  wallMode: WallMode;
}

/**
 * Drives an online 1v1 over any Link. Both sims run the same seeded
 * simulation and exchange only inputs; the host is authoritative and
 * re-syncs the guest with a snapshot at every turn boundary, so transient
 * drift (frame-rate dependent fire damage, float noise) can never diverge
 * the match.
 */
export class NetMatch {
  readonly role: "host" | "guest";
  otherName = "";

  private link: Link;
  private game: Game;
  private myName: string;
  private cfg: NetConfig;
  private hooks: NetMatchHooks;

  private started = false;
  private myShopDone = false;
  private otherShopDone = false;

  // Aim relay, throttled so drags don't flood the channel.
  private aimDirty: { angle: number; power: number } | null = null;
  private aimCooldown = 0;

  constructor(
    role: "host" | "guest",
    link: Link,
    game: Game,
    myName: string,
    cfg: NetConfig,
    hooks: NetMatchHooks,
  ) {
    this.role = role;
    this.link = link;
    this.game = game;
    this.myName = myName;
    this.cfg = cfg;
    this.hooks = hooks;

    link.onMessage = (m) => this.handle(m);
    link.onClosed = () => this.teardown("Opponent disconnected.");
    this.attachGameHooks();

    if (role === "guest") {
      link.send({ t: "hello", v: NET_VERSION, name: myName });
      hooks.onStatus("Connected — waiting for host…");
    }
  }

  /** Host: begin (or restart) the match and tell the guest to do the same. */
  startMatch(): void {
    if (this.role !== "host") return;
    const seed = Date.now() >>> 0;
    this.link.send({
      t: "start",
      v: NET_VERSION,
      seed,
      hostName: this.myName,
      guestName: this.otherName || "Guest",
      rounds: this.cfg.rounds,
      wallMode: this.cfg.wallMode,
    });
    this.begin(seed, this.myName, this.otherName || "Guest", this.cfg);
  }

  /** Pump throttled sends; call once per frame. */
  update(dt: number): void {
    this.aimCooldown -= dt;
    if (this.aimDirty && this.aimCooldown <= 0) {
      this.link.send({ t: "aim", ...this.aimDirty });
      this.aimDirty = null;
      this.aimCooldown = 0.09;
    }
  }

  /** Local player pressed Continue in the shop. */
  localShopDone(): void {
    if (this.myShopDone) return;
    this.myShopDone = true;
    this.link.send({ t: "shopDone" });
    this.hooks.onStatus("Waiting for opponent…");
    this.tryNextRound();
  }

  leave(): void {
    this.link.send({ t: "bye" });
    this.teardown("You left the match.");
  }

  // ------------------------------------------------------------------ internals

  private begin(seed: number, hostName: string, guestName: string, cfg: NetConfig): void {
    this.started = true;
    this.myShopDone = false;
    this.otherShopDone = false;
    // Fixed world online so both players fight on the identical battlefield.
    this.game.resize(NET_WORLD_W, NET_WORLD_H);
    this.game.newMatch(
      { opponents: 1, difficulty: "normal", rounds: cfg.rounds, wallMode: cfg.wallMode },
      { seed, net: { role: this.role, names: [hostName, guestName] } },
    );
    this.hooks.onStarted();
  }

  private attachGameHooks(): void {
    const g = this.game;
    g.onShot = (tankId, angle, power, weaponId) => {
      if (tankId === g.localId) this.link.send({ t: "fire", angle, power, weaponId });
    };
    g.onAim = (angle, power) => {
      this.aimDirty = { angle, power };
    };
    g.onBuy = (id, item) => this.link.send({ t: "buy", id, item });

    if (this.role === "host") {
      g.onTurnStart = (turnIndex) => {
        if (this.started) {
          this.link.send({ t: "turnStart", turnIndex, snap: g.makeSnapshot() });
        }
      };
      g.onRoundOver = (winnerId) => {
        this.myShopDone = false;
        this.otherShopDone = false;
        this.link.send({ t: "roundOver", winnerId, snap: g.makeSnapshot() });
      };
      g.onMatchEnd = (winnerId) => {
        this.link.send({ t: "matchEnd", winnerId, snap: g.makeSnapshot() });
      };
    }
  }

  private handle(m: Msg): void {
    const g = this.game;
    switch (m.t) {
      case "hello":
        if (m.v !== NET_VERSION) {
          this.link.send({ t: "bye" });
          this.teardown("Your friend is running a different game version.");
          return;
        }
        this.otherName = sanitizeName(m.name);
        if (this.role === "host") this.startMatch();
        break;
      case "start":
        if (this.role !== "guest") break;
        if (m.v !== NET_VERSION) {
          this.teardown("The host is running a different game version.");
          return;
        }
        this.otherName = sanitizeName(m.hostName);
        this.begin(m.seed, sanitizeName(m.hostName), sanitizeName(m.guestName), {
          rounds: m.rounds,
          wallMode: m.wallMode,
        });
        break;
      case "aim":
        g.aimRemote(m.angle, m.power);
        break;
      case "fire":
        g.fireRemote(m.angle, m.power, m.weaponId);
        break;
      case "buy":
        g.buyRemote(m.id, m.item);
        break;
      case "shopDone":
        this.otherShopDone = true;
        this.tryNextRound();
        break;
      case "turnStart":
        g.netForceTurn(m.turnIndex, m.snap);
        break;
      case "roundOver":
        this.myShopDone = false;
        this.otherShopDone = false;
        g.netApplyRoundOver(m.winnerId, m.snap);
        break;
      case "matchEnd":
        g.netApplyMatchEnd(m.snap);
        break;
      case "bye":
        this.teardown("Opponent left the match.");
        break;
    }
  }

  /** Host: leave the shop once both players have confirmed. */
  private tryNextRound(): void {
    if (this.role !== "host") return;
    if (!this.myShopDone || !this.otherShopDone) return;
    this.myShopDone = false;
    this.otherShopDone = false;
    // startRound → beginTurn → onTurnStart relays the sync to the guest.
    this.game.continueFromShop();
  }

  private teardown(reason: string): void {
    if (this.link.onClosed === null && this.link.onMessage === null) return;
    this.link.onMessage = null;
    this.link.onClosed = null;
    this.link.close();
    const g = this.game;
    g.onShot = g.onAim = g.onBuy = null;
    g.onTurnStart = null;
    g.onRoundOver = null;
    g.onMatchEnd = null;
    g.netReset();
    this.hooks.onClosed(reason);
  }
}

export function sanitizeName(raw: string): string {
  const name = raw.trim().slice(0, 12);
  return name.length > 0 ? name : "Player";
}
