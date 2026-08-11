import Peer, { type DataConnection } from "peerjs";
import type { Link, Msg } from "./protocol";

/**
 * WebRTC transport via the free public PeerJS cloud broker. The broker only
 * introduces the two browsers (signaling); once connected, gameplay flows
 * peer-to-peer, so the game itself needs no server and stays a static page.
 *
 * A room code is just a short suffix on a namespaced peer ID: the host
 * registers "overshot-v1-KWZP", the guest dials the same ID.
 */

const ID_PREFIX = "overshot-v1-";
// No I/L/O/0/1 so codes survive being read aloud or scribbled on a napkin.
const CODE_LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * STUN discovers a direct path between the two browsers; TURN relays traffic
 * when NATs (very common on cellular networks) make a direct path impossible.
 * Without TURN, two phones on different carriers often cannot connect at all.
 * Open Relay is a free public TURN service; :443 + TCP variants also help
 * escape restrictive firewalls.
 */
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
    { urls: "stun:stun.cloudflare.com:3478" },
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turns:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

const PEER_OPTS = { debug: 1, config: RTC_CONFIG };

export function makeCode(): string {
  let c = "";
  for (let i = 0; i < 4; i++) {
    c += CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)];
  }
  return c;
}

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z]/g, "");
}

export class PeerLink implements Link {
  onMessage: ((m: Msg) => void) | null = null;
  onClosed: (() => void) | null = null;

  private peer: Peer | null = null;
  /** The established, open connection carrying the match. */
  private conn: DataConnection | null = null;
  /** A join attempt whose channel hasn't opened yet. Replaceable. */
  private pending: DataConnection | null = null;
  private closed = false;

  /**
   * Open a room. `onOpen` fires once the code is registered with the broker,
   * `onPeer` when a guest's channel is fully open. `onIssue` reports a failed
   * join attempt — the room stays open so the guest can simply retry.
   */
  host(
    code: string,
    cb: {
      onOpen: () => void;
      onPeer: () => void;
      onError: (why: string) => void;
      onIssue?: (why: string) => void;
    },
  ): void {
    const peer = new Peer(ID_PREFIX + code, PEER_OPTS);
    this.peer = peer;
    peer.on("open", () => cb.onOpen());
    peer.on("connection", (conn) => {
      if (this.conn) {
        // Room already has an active opponent — turn away extra joiners.
        try {
          conn.close();
        } catch {
          /* ignore */
        }
        return;
      }
      // A newer attempt replaces any stale half-open one (e.g. the guest's
      // first try died mid-handshake and they hit Join again).
      if (this.pending && this.pending !== conn) {
        try {
          this.pending.close();
        } catch {
          /* ignore */
        }
      }
      this.pending = conn;
      this.watch(
        conn,
        () => cb.onPeer(),
        (why) => cb.onIssue?.(why),
      );
    });
    peer.on("error", (err) => {
      const why = describePeerError(err);
      // peer-unavailable and similar per-connection errors shouldn't kill
      // an open room; only surface fatal broker problems.
      if (why === "unavailable-id" || isFatalPeerError(err)) cb.onError(why);
    });
    peer.on("disconnected", () => {
      // Broker connection dropped (not the peer connection); try to recover.
      if (!this.closed && !this.conn) peer.reconnect();
    });
  }

  /** Join an existing room by code. `onOpen` fires when messages can flow. */
  join(
    code: string,
    cb: {
      onStatus: (text: string) => void;
      onOpen: () => void;
      onError: (why: string) => void;
    },
  ): void {
    const peer = new Peer(PEER_OPTS);
    this.peer = peer;
    let opened = false;
    let failed = false;
    const fail = (why: string): void => {
      if (opened || failed) return;
      failed = true;
      cb.onError(why);
    };
    const timeout = window.setTimeout(() => {
      fail(
        "Couldn't reach the room. Check the code, make sure your friend's room screen is still open, and try again.",
      );
    }, 25000);

    peer.on("open", () => {
      cb.onStatus("Found the matchmaking server — dialing the room…");
      const conn = peer.connect(ID_PREFIX + code, { reliable: true });
      this.pending = conn;
      this.watch(
        conn,
        () => {
          opened = true;
          window.clearTimeout(timeout);
          cb.onOpen();
        },
        (why) => fail(why),
      );
    });
    peer.on("error", (err) => {
      if (!opened) {
        window.clearTimeout(timeout);
        fail(describePeerError(err));
      }
    });
  }

  /**
   * Track a connection through its handshake: promote it to the active match
   * channel when it opens; report failure (and unlatch it) if it dies first.
   */
  private watch(
    conn: DataConnection,
    onReady: () => void,
    onFail: (why: string) => void,
  ): void {
    let opened = false;
    conn.on("open", () => {
      opened = true;
      this.pending = null;
      this.conn = conn;
      onReady();
    });
    conn.on("data", (data) => this.onMessage?.(data as Msg));
    // Surface ICE trouble while still connecting — this is where "we both see
    // the room but never connect" lives (NATs blocking a direct path).
    conn.on("iceStateChanged", (state) => {
      if (!opened && (state === "failed" || state === "closed")) {
        if (this.pending === conn) this.pending = null;
        onFail(
          "The direct connection failed — one of your networks is blocking peer-to-peer. Try switching Wi-Fi/cellular and rejoin.",
        );
      }
    });
    const dead = (): void => {
      if (!opened) {
        if (this.pending === conn) this.pending = null;
        onFail("The connection attempt was interrupted — try joining again.");
        return;
      }
      if (this.conn === conn && !this.closed) {
        this.closed = true;
        this.onClosed?.();
      }
    };
    conn.on("close", dead);
    conn.on("error", dead);
  }

  send(m: Msg): void {
    if (this.conn?.open) this.conn.send(m);
  }

  close(): void {
    this.closed = true;
    for (const c of [this.conn, this.pending]) {
      try {
        c?.close();
      } catch {
        /* ignore */
      }
    }
    try {
      this.peer?.destroy();
    } catch {
      /* ignore */
    }
    this.conn = null;
    this.pending = null;
    this.peer = null;
  }
}

function describePeerError(err: unknown): string {
  const type = (err as { type?: string }).type ?? "";
  switch (type) {
    case "unavailable-id":
      return "unavailable-id"; // caller retries with a fresh code
    case "peer-unavailable":
      return "No room with that code was found — double-check it and make sure the host's room screen is open.";
    case "network":
    case "server-error":
    case "socket-error":
    case "socket-closed":
      return "Couldn't reach the matchmaking server. Check your connection and try again.";
    case "browser-incompatible":
      return "This browser doesn't support peer-to-peer play.";
    default:
      return "Connection failed. Please try again.";
  }
}

function isFatalPeerError(err: unknown): boolean {
  const type = (err as { type?: string }).type ?? "";
  return (
    type === "network" ||
    type === "server-error" ||
    type === "socket-error" ||
    type === "socket-closed" ||
    type === "browser-incompatible"
  );
}
