import { CHUNK_SIZE, VIEW_MARGIN_CHUNKS } from "../config";
import { Chunk, chunkKey, tileIndex } from "./Chunk";
import { WorldGen } from "./WorldGen";
import { TileId, isSolid } from "./Tile";
import type { DeltaEntry } from "../net/Protocol";

// Integer floor-division / positive modulo, correct for negative coordinates (so the world
// works identically above y=0 and below, left of x=0 and right).
function floorDiv(a: number, b: number): number {
  return Math.floor(a / b);
}
function posMod(a: number, b: number): number {
  return ((a % b) + b) % b;
}

interface TileEdit {
  fg?: number;
  bg?: number;
}

// Owns the set of resident chunks, streams them in/out around the camera, and is the single
// gateway for reading/writing tiles by absolute world-tile coordinates. Player edits are stored
// as per-chunk deltas so a chunk can unload and regenerate later without losing changes
// (in-memory in Phase 1; IndexedDB-backed in a later phase).
export class ChunkManager {
  private chunks = new Map<string, Chunk>();
  private deltas = new Map<string, Map<number, TileEdit>>();
  private worldgen: WorldGen;

  constructor(worldgen: WorldGen) {
    this.worldgen = worldgen;
  }

  get gen(): WorldGen {
    return this.worldgen;
  }

  /** Throw away everything and start a fresh world (used by the debug reseed key). */
  reseed(seed: number): void {
    this.worldgen = new WorldGen(seed);
    this.chunks.clear();
    this.deltas.clear();
  }

  loadedChunks(): IterableIterator<Chunk> {
    return this.chunks.values();
  }

  get loadedCount(): number {
    return this.chunks.size;
  }

  private ensureChunk(cx: number, cy: number): Chunk {
    const key = chunkKey(cx, cy);
    let chunk = this.chunks.get(key);
    if (chunk) return chunk;
    chunk = this.worldgen.generateChunk(cx, cy);
    const edits = this.deltas.get(key);
    if (edits) {
      for (const [idx, edit] of edits) {
        if (edit.fg !== undefined) chunk.fg[idx] = edit.fg;
        if (edit.bg !== undefined) chunk.bg[idx] = edit.bg;
      }
    }
    this.chunks.set(key, chunk);
    return chunk;
  }

  /**
   * Stream chunks so everything inside the tile rectangle (+ margin) is resident and anything
   * well outside it is dropped. Keeps memory flat no matter how far the player travels.
   */
  update(minTileX: number, minTileY: number, maxTileX: number, maxTileY: number): void {
    const minCx = floorDiv(minTileX, CHUNK_SIZE) - VIEW_MARGIN_CHUNKS;
    const maxCx = floorDiv(maxTileX, CHUNK_SIZE) + VIEW_MARGIN_CHUNKS;
    const minCy = floorDiv(minTileY, CHUNK_SIZE) - VIEW_MARGIN_CHUNKS;
    const maxCy = floorDiv(maxTileY, CHUNK_SIZE) + VIEW_MARGIN_CHUNKS;

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        this.ensureChunk(cx, cy);
      }
    }

    // Unload chunks that drifted outside the (margin-padded) window. Deltas are retained.
    const dropPad = 1;
    for (const [key, chunk] of this.chunks) {
      if (
        chunk.cx < minCx - dropPad ||
        chunk.cx > maxCx + dropPad ||
        chunk.cy < minCy - dropPad ||
        chunk.cy > maxCy + dropPad
      ) {
        this.chunks.delete(key);
      }
    }
  }

  // --- Tile access by absolute world-tile coordinates -----------------------

  getFg(tileX: number, tileY: number): number {
    const chunk = this.chunks.get(chunkKey(floorDiv(tileX, CHUNK_SIZE), floorDiv(tileY, CHUNK_SIZE)));
    if (!chunk) return TileId.Air;
    return chunk.fg[tileIndex(posMod(tileX, CHUNK_SIZE), posMod(tileY, CHUNK_SIZE))];
  }

  getBg(tileX: number, tileY: number): number {
    const chunk = this.chunks.get(chunkKey(floorDiv(tileX, CHUNK_SIZE), floorDiv(tileY, CHUNK_SIZE)));
    if (!chunk) return TileId.Air;
    return chunk.bg[tileIndex(posMod(tileX, CHUNK_SIZE), posMod(tileY, CHUNK_SIZE))];
  }

  isSolid(tileX: number, tileY: number): boolean {
    return isSolid(this.getFg(tileX, tileY));
  }

  // --- Liquids (dynamic; not persisted as deltas — re-seeded from worldgen on reload) ----------

  getLiquid(tileX: number, tileY: number): number {
    const chunk = this.chunks.get(chunkKey(floorDiv(tileX, CHUNK_SIZE), floorDiv(tileY, CHUNK_SIZE)));
    if (!chunk) return 0;
    return chunk.liquid[tileIndex(posMod(tileX, CHUNK_SIZE), posMod(tileY, CHUNK_SIZE))];
  }

  setLiquid(tileX: number, tileY: number, v: number): void {
    const chunk = this.chunks.get(chunkKey(floorDiv(tileX, CHUNK_SIZE), floorDiv(tileY, CHUNK_SIZE)));
    if (!chunk) return;
    chunk.liquid[tileIndex(posMod(tileX, CHUNK_SIZE), posMod(tileY, CHUNK_SIZE))] = v;
  }

  private recordDelta(cx: number, cy: number, idx: number, patch: TileEdit): void {
    const key = chunkKey(cx, cy);
    let edits = this.deltas.get(key);
    if (!edits) {
      edits = new Map();
      this.deltas.set(key, edits);
    }
    const existing = edits.get(idx);
    edits.set(idx, existing ? { ...existing, ...patch } : patch);
  }

  setFg(tileX: number, tileY: number, id: TileId): void {
    const cx = floorDiv(tileX, CHUNK_SIZE);
    const cy = floorDiv(tileY, CHUNK_SIZE);
    const chunk = this.ensureChunk(cx, cy);
    const idx = tileIndex(posMod(tileX, CHUNK_SIZE), posMod(tileY, CHUNK_SIZE));
    chunk.fg[idx] = id;
    this.recordDelta(cx, cy, idx, { fg: id });
  }

  setBg(tileX: number, tileY: number, id: TileId): void {
    const cx = floorDiv(tileX, CHUNK_SIZE);
    const cy = floorDiv(tileY, CHUNK_SIZE);
    const chunk = this.ensureChunk(cx, cy);
    const idx = tileIndex(posMod(tileX, CHUNK_SIZE), posMod(tileY, CHUNK_SIZE));
    chunk.bg[idx] = id;
    this.recordDelta(cx, cy, idx, { bg: id });
  }

  // --- Delta sync (multiplayer join) ----------------------------------------

  /** Serialize all player edits so a joining peer can reproduce the current world state. */
  exportDeltas(): DeltaEntry[] {
    const out: DeltaEntry[] = [];
    for (const [key, edits] of this.deltas) {
      const comma = key.indexOf(",");
      const cx = Number(key.slice(0, comma));
      const cy = Number(key.slice(comma + 1));
      for (const [i, edit] of edits) out.push({ cx, cy, i, fg: edit.fg, bg: edit.bg });
    }
    return out;
  }

  /** Apply a batch of edits received from the host (called before any chunks are streamed in). */
  importDeltas(entries: DeltaEntry[]): void {
    for (const e of entries) {
      const patch: TileEdit = {};
      if (e.fg !== undefined) patch.fg = e.fg;
      if (e.bg !== undefined) patch.bg = e.bg;
      this.recordDelta(e.cx, e.cy, e.i, patch);
      const chunk = this.chunks.get(chunkKey(e.cx, e.cy));
      if (chunk) {
        if (patch.fg !== undefined) chunk.fg[e.i] = patch.fg;
        if (patch.bg !== undefined) chunk.bg[e.i] = patch.bg;
      }
    }
  }
}
