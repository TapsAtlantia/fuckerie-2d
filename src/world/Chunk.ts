import { CHUNK_SIZE } from "../config";
import { TileId } from "./Tile";

// A chunk holds a square block of tiles. Foreground = collidable tiles you mine/place;
// background = wall behind them (never collides, drawn dim). Light is computed per frame
// by the lighting system into a screen-space buffer, so it is NOT stored here in Phase 1.

const AREA = CHUNK_SIZE * CHUNK_SIZE;

export function chunkKey(cx: number, cy: number): string {
  return cx + "," + cy;
}

export function tileIndex(lx: number, ly: number): number {
  return ly * CHUNK_SIZE + lx;
}

export class Chunk {
  readonly cx: number;
  readonly cy: number;
  // Tile ids are 16-bit so the world can hold hundreds of blocks/walls/furniture/ores/machines
  // (well past the old 256 ceiling). Liquid stays 8-bit — it encodes a level + type flag, not an id.
  readonly fg: Uint16Array; // foreground tile ids
  readonly bg: Uint16Array; // background wall tile ids
  readonly liquid: Uint8Array; // liquid state (see Liquid.ts encoding)

  constructor(cx: number, cy: number) {
    this.cx = cx;
    this.cy = cy;
    this.fg = new Uint16Array(AREA); // defaults to Air (0)
    this.bg = new Uint16Array(AREA);
    this.liquid = new Uint8Array(AREA);
  }

  getFg(lx: number, ly: number): number {
    return this.fg[tileIndex(lx, ly)];
  }

  getBg(lx: number, ly: number): number {
    return this.bg[tileIndex(lx, ly)];
  }

  setFg(lx: number, ly: number, id: TileId): void {
    this.fg[tileIndex(lx, ly)] = id;
  }

  setBg(lx: number, ly: number, id: TileId): void {
    this.bg[tileIndex(lx, ly)] = id;
  }
}
