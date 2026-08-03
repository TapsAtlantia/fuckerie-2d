import Peer, { type DataConnection } from "peerjs";
import type { Profile } from "../Profile";
import { RELAYED, type DeltaEntry, type NetMessage, type NetStatus } from "./Protocol";

// Serverless P2P transport over WebRTC (PeerJS default cloud broker for signaling).
// Star topology: the host is the hub; clients connect only to the host, which relays
// broadcast messages between them. The host's peer id IS the shareable game code.
//
// NOTE: this needs real network access, which the Claude Artifact preview blocks (CSP). It works
// on the hosted build (GitHub Pages) and local dev. `host()`/`join()` reject on timeout so the UI
// can explain that clearly instead of hanging.

const CONNECT_TIMEOUT = 9000;
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I/L
const CODE_LEN = 5;

function makeCode(): string {
  let s = "";
  for (let i = 0; i < CODE_LEN; i++) s += CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0];
  return s;
}

export class Net {
  peer: Peer | null = null;
  myId = "";
  isHost = false;

  onMessage: ((m: NetMessage) => void) | null = null;
  onStatus: ((s: NetStatus) => void) | null = null;
  /** Host-only: supplies the welcome payload for a newly joined client. */
  onWelcomeRequest: (() => { seed: number; hostProfile: Profile; deltas: DeltaEntry[] }) | null = null;

  private profile: Profile;
  private conns = new Map<string, DataConnection>();

  constructor(profile: Profile) {
    this.profile = profile;
  }

  /** Create a hosted game. Resolves with the shareable code. */
  host(): Promise<string> {
    return new Promise((resolve, reject) => {
      const attempt = (triesLeft: number): void => {
        const code = makeCode();
        const peer = new Peer(code);
        let settled = false;
        const timer = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          peer.destroy();
          reject(new Error("Couldn't reach the matchmaking network."));
        }, CONNECT_TIMEOUT);

        peer.on("open", (id) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          this.peer = peer;
          this.myId = id;
          this.isHost = true;
          peer.on("connection", (conn) => this.setupHostConn(conn));
          this.emitStatus();
          resolve(id);
        });
        peer.on("error", (err: any) => {
          if (settled) return;
          if (err?.type === "unavailable-id" && triesLeft > 0) {
            peer.destroy();
            attempt(triesLeft - 1);
            return;
          }
          settled = true;
          clearTimeout(timer);
          peer.destroy();
          reject(err instanceof Error ? err : new Error(String(err?.type ?? err)));
        });
      };
      attempt(3);
    });
  }

  /** Join a hosted game by code. Resolves once the data channel opens. */
  join(code: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const peer = new Peer();
      let settled = false;
      const fail = (msg: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        peer.destroy();
        reject(new Error(msg));
      };
      const timer = window.setTimeout(() => fail("No response — check the code, or the host may be offline."), CONNECT_TIMEOUT);

      peer.on("open", (id) => {
        this.peer = peer;
        this.myId = id;
        this.isHost = false;
        const conn = peer.connect(code.toUpperCase(), { reliable: true });
        conn.on("open", () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          this.conns.set(conn.peer, conn);
          this.setupClientConn(conn);
          this.safeSend(conn, { type: "hello", from: id, profile: this.profile });
          this.emitStatus();
          resolve();
        });
        conn.on("error", () => fail("Couldn't connect to that game code."));
      });
      peer.on("error", (err: any) => {
        if (err?.type === "peer-unavailable") fail("No game found with that code.");
        else fail("Couldn't reach the matchmaking network.");
      });
    });
  }

  private setupHostConn(conn: DataConnection): void {
    conn.on("open", () => {
      this.conns.set(conn.peer, conn);
      this.emitStatus();
    });
    conn.on("data", (data) => {
      const msg = data as NetMessage;
      if (msg.type === "hello") {
        const payload = this.onWelcomeRequest?.();
        if (payload) this.safeSend(conn, { type: "welcome", from: this.myId, ...payload });
        this.onMessage?.(msg);
        return;
      }
      this.onMessage?.(msg);
      if (RELAYED.has(msg.type)) this.relay(msg, conn.peer);
      if (msg.type === "leave") {
        this.conns.delete(conn.peer);
        this.emitStatus();
      }
    });
    const drop = () => {
      if (!this.conns.has(conn.peer)) return;
      this.conns.delete(conn.peer);
      const leave: NetMessage = { type: "leave", from: conn.peer };
      this.onMessage?.(leave);
      this.relay(leave, conn.peer);
      this.emitStatus();
    };
    conn.on("close", drop);
    conn.on("error", drop);
  }

  private setupClientConn(conn: DataConnection): void {
    conn.on("data", (data) => this.onMessage?.(data as NetMessage));
    const lost = () => this.onStatus?.({ connected: false, isHost: false, peers: 0, error: "Disconnected from host." });
    conn.on("close", lost);
    conn.on("error", lost);
  }

  broadcast(msg: NetMessage): void {
    if (this.isHost) {
      for (const c of this.conns.values()) this.safeSend(c, msg);
    } else {
      const host = this.conns.values().next().value as DataConnection | undefined;
      if (host) this.safeSend(host, msg);
    }
  }

  private relay(msg: NetMessage, exceptId: string): void {
    for (const [id, c] of this.conns) if (id !== exceptId) this.safeSend(c, msg);
  }

  private safeSend(conn: DataConnection, msg: NetMessage): void {
    try {
      conn.send(msg);
    } catch {
      /* connection dropped mid-send; handled by close/error events */
    }
  }

  peerCount(): number {
    return this.conns.size;
  }

  leave(): void {
    this.broadcast({ type: "leave", from: this.myId });
    this.conns.clear();
    this.peer?.destroy();
    this.peer = null;
  }

  private emitStatus(): void {
    this.onStatus?.({ connected: true, isHost: this.isHost, peers: this.conns.size, error: null });
  }
}
