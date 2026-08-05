import type { Profile } from "../Profile";

// Bumped whenever the wire format changes (message shapes, tile-id width, delta encoding, …). Peers
// with different versions must not connect. Bump this on any breaking net/protocol change.
// v3: edits/deltas are addressed by ABSOLUTE world-tile coords (tx,ty) instead of chunk-local index,
// so they're independent of chunk size (needed for the adaptive variable-size chunk system).
export const PROTOCOL_VERSION = 3;

// Wire format for peer-to-peer messages. Because world generation is deterministic, peers only
// ever exchange a seed + tile edits + player states — never whole chunks.

export interface DeltaEntry {
  tx: number; // absolute world-tile X
  ty: number; // absolute world-tile Y
  fg?: number;
  bg?: number;
}

// Client → host, right after connecting.
export interface HelloMsg {
  type: "hello";
  from: string;
  profile: Profile;
  protocolVersion: number;
}

// Host → joining client: everything needed to reproduce the host's world.
export interface WelcomeMsg {
  type: "welcome";
  from: string;
  protocolVersion: number;
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

// Host → clients: authoritative creature snapshot (creatures are simulated only on the host).
export interface CreatureState {
  id: number;
  kind: number; // 0 critter, 1 slime, 2 bat
  x: number;
  y: number;
  facing: number;
  hp: number;
  mhp: number;
  hurt: boolean;
}
export interface CreaturesMsg {
  type: "creatures";
  from: string;
  list: CreatureState[];
}

// Client → host: request to damage a creature at a world point.
export interface AttackMsg {
  type: "attack";
  from: string;
  x: number;
  y: number;
}

export type NetMessage =
  | HelloMsg | WelcomeMsg | StateMsg | EditMsg | LeaveMsg | CreaturesMsg | AttackMsg;

// Message types the host relays to the other peers (star topology).
export const RELAYED: ReadonlySet<NetMessage["type"]> = new Set(["state", "edit", "leave"]);

export interface NetStatus {
  connected: boolean;
  isHost: boolean;
  peers: number;
  error: string | null;
}
