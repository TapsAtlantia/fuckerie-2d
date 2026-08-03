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
  readonly fg: Uint8Array; // foreground tile ids
  readonly bg: Uint8Array; // background wall tile ids

  constructor(cx: number, cy: number) {
    this.cx = cx;
    this.cy = cy;
    this.fg = new Uint8Array(AREA); // defaults to Air (0)
    this.bg = new Uint8Array(AREA);
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
