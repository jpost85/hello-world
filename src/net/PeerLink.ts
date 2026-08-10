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
  private conn: DataConnection | null = null;
  private closed = false;

  /**
   * Open a room. `onOpen` fires once the code is registered with the broker,
   * `onPeer` when a guest has connected and messages can flow.
   */
  host(
    code: string,
    cb: { onOpen: () => void; onPeer: () => void; onError: (why: string) => void },
  ): void {
    const peer = new Peer(ID_PREFIX + code);
    this.peer = peer;
    peer.on("open", () => cb.onOpen());
    peer.on("connection", (conn) => {
      if (this.conn) {
        // Room already full — turn away extra joiners.
        try {
          conn.close();
        } catch {
          /* ignore */
        }
        return;
      }
      this.adopt(conn, cb.onPeer);
    });
    peer.on("error", (err) => cb.onError(describePeerError(err)));
    peer.on("disconnected", () => {
      // Broker connection dropped (not the peer connection); try to recover.
      if (!this.closed && !this.conn) peer.reconnect();
    });
  }

  /** Join an existing room by code. `onOpen` fires when messages can flow. */
  join(
    code: string,
    cb: { onOpen: () => void; onError: (why: string) => void },
  ): void {
    const peer = new Peer();
    this.peer = peer;
    let opened = false;
    peer.on("open", () => {
      const conn = peer.connect(ID_PREFIX + code, { reliable: true });
      // The broker doesn't error on dialing an absent ID, so time out ourselves.
      const timeout = window.setTimeout(() => {
        if (!opened) cb.onError("No room with that code answered.");
      }, 12000);
      this.adopt(conn, () => {
        opened = true;
        window.clearTimeout(timeout);
        cb.onOpen();
      });
    });
    peer.on("error", (err) => cb.onError(describePeerError(err)));
  }

  private adopt(conn: DataConnection, onReady: () => void): void {
    this.conn = conn;
    conn.on("open", onReady);
    conn.on("data", (data) => this.onMessage?.(data as Msg));
    const closed = () => {
      if (!this.closed) {
        this.closed = true;
        this.onClosed?.();
      }
    };
    conn.on("close", closed);
    conn.on("error", closed);
  }

  send(m: Msg): void {
    if (this.conn?.open) this.conn.send(m);
  }

  close(): void {
    this.closed = true;
    try {
      this.conn?.close();
    } catch {
      /* ignore */
    }
    try {
      this.peer?.destroy();
    } catch {
      /* ignore */
    }
    this.conn = null;
    this.peer = null;
  }
}

function describePeerError(err: unknown): string {
  const type = (err as { type?: string }).type ?? "";
  switch (type) {
    case "unavailable-id":
      return "unavailable-id"; // caller retries with a fresh code
    case "peer-unavailable":
      return "No room with that code was found.";
    case "network":
    case "server-error":
    case "socket-error":
    case "socket-closed":
      return "Couldn't reach the matchmaking server. Check your connection.";
    case "browser-incompatible":
      return "This browser doesn't support peer-to-peer play.";
    default:
      return "Connection failed. Please try again.";
  }
}
