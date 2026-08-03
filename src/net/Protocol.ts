import type { Profile } from "../Profile";

// Wire format for peer-to-peer messages. Because world generation is deterministic, peers only
// ever exchange a seed + tile edits + player states — never whole chunks.

export interface DeltaEntry {
  cx: number;
  cy: number;
  i: number; // tile index within the chunk
  fg?: number;
  bg?: number;
}

// Client → host, right after connecting.
export interface HelloMsg {
  type: "hello";
  from: string;
  profile: Profile;
}

// Host → joining client: everything needed to reproduce the host's world.
export interface WelcomeMsg {
  type: "welcome";
  from: string;
  seed: number;
  hostProfile: Profile;
  deltas: DeltaEntry[];
}

// Broadcast: a peer's current avatar state (sent ~15 Hz).
export interface StateMsg {
  type: "state";
  from: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  name: string;
  color: string;
}

// Broadcast: a single tile was mined or placed.
export interface EditMsg {
  type: "edit";
  from: string;
  x: number;
  y: number;
  fg: number;
}

// A peer left the session.
export interface LeaveMsg {
  type: "leave";
  from: string;
}

export type NetMessage = HelloMsg | WelcomeMsg | StateMsg | EditMsg | LeaveMsg;

// Message types the host relays to the other peers (star topology).
export const RELAYED: ReadonlySet<NetMessage["type"]> = new Set(["state", "edit", "leave"]);

export interface NetStatus {
  connected: boolean;
  isHost: boolean;
  peers: number;
  error: string | null;
}
