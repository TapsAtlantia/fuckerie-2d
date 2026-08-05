import { TileId } from "./Tile";

// A chunk holds a square block of tiles. Foreground = collidable tiles you mine/place;
// background = wall behind them (never collides, drawn dim). Light is computed per frame
// by the lighting system into a screen-space buffer, so it is NOT stored here.
//
// Chunks are variable-sized (Phase 0.5 adaptive sizing): a chunk is identified by its top-left
// WORLD-tile origin (x0, y0) plus its side length `size`, so the same key scheme works no matter
// how big the chunk is. Because a tile's value is a pure function of its world coordinate, chunk
// size only affects batching, never content.

/** Key a chunk by its world-tile origin (x0,y0). */
export function chunkKey(x0: number, y0: number): string {
  return x0 + "," + y0;
}

export class Chunk {
  readonly x0: number; // world-tile X of the chunk's left edge
  readonly y0: number; // world-tile Y of the chunk's top edge
  readonly size: number; // side length in tiles
  // Tile ids are 16-bit so the world can hold hundreds of blocks/walls/furniture/ores/machines
  // (well past the old 256 ceiling). Liquid stays 8-bit — it encodes a level + type flag, not an id.
  readonly fg: Uint16Array; // foreground tile ids
  readonly bg: Uint16Array; // background wall tile ids
  readonly liquid: Uint8Array; // liquid state (see Liquid.ts encoding)

  constructor(x0: number, y0: number, size: number) {
    this.x0 = x0;
    this.y0 = y0;
    this.size = size;
    const area = size * size;
    this.fg = new Uint16Array(area); // defaults to Air (0)
    this.bg = new Uint16Array(area);
    this.liquid = new Uint8Array(area);
  }

  /** Chunk-index compatibility (used only where a fixed grid is assumed, e.g. dev tests). */
  get cx(): number { return Math.floor(this.x0 / this.size); }
  get cy(): number { return Math.floor(this.y0 / this.size); }

  idx(lx: number, ly: number): number {
    return ly * this.size + lx;
  }

  getFg(lx: number, ly: number): number { return this.fg[this.idx(lx, ly)]; }
  getBg(lx: number, ly: number): number { return this.bg[this.idx(lx, ly)]; }
  setFg(lx: number, ly: number, id: TileId): void { this.fg[this.idx(lx, ly)] = id; }
  setBg(lx: number, ly: number, id: TileId): void { this.bg[this.idx(lx, ly)] = id; }
}
