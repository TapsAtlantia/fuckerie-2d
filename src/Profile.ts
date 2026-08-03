// Local player identity ("sign-in"). Serverless by design: this lives in the browser, not on
// a backend. Persisted to localStorage when available, falling back to memory (the Artifact
// preview sandbox can block storage) so the game never crashes over it.

export interface Profile {
  id: string; // stable local id
  name: string;
  color: string; // hex, used for the player avatar + name tag
}

const KEY = "fk2d.profile";

export const PLAYER_COLORS: readonly string[] = [
  "#e9edff", // default pale
  "#6cc4ff", // sky
  "#7ee787", // green
  "#ffd166", // gold
  "#ff8fab", // pink
  "#c39bff", // violet
  "#ff9f68", // orange
  "#4dd9c0", // teal
];

let memoryFallback: Profile | null = null;

function randomId(): string {
  return "p" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

function randomName(): string {
  return "Player" + Math.floor(1000 + Math.random() * 9000);
}

export function defaultProfile(): Profile {
  return { id: randomId(), name: randomName(), color: PLAYER_COLORS[0] };
}

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Profile;
  } catch {
    if (memoryFallback) return memoryFallback;
  }
  return memoryFallback;
}

export function saveProfile(p: Profile): void {
  memoryFallback = p;
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage unavailable (sandboxed preview) — memoryFallback keeps it for the session.
  }
}

/** Whether the user has completed sign-in (has a saved profile). */
export function hasProfile(): boolean {
  return loadProfile() !== null;
}
