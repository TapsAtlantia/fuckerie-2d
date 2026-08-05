import { TileId } from "./Tile";
import { hash2 } from "./Noise";

// Phase 8 — The Dungeon: one large, hand-guided structure per world at a deterministic location near
// spawn. It is defined as a pure function of world coordinates (anchor + local offset), so any chunk
// can stamp its slice independently and identically, no matter which chunk streams first (and every
// peer generates the same dungeon). A grid of brick rooms connected by doorways forms a branching
// maze of corridors and cells going deep, wrapped in coloured dungeon background walls, with locked
// chests, spikes and cobwebs, and a boss-gated entrance door at the surface.

const W = 150; // dungeon width (tiles)
const DEPTH = 430; // how far below the surface it reaches
const RW = 17, RH = 13; // room cell size
const DOOR_H = 4; // entrance door height above the surface
const BRICK = [TileId.DungeonBrickBlue, TileId.DungeonBrickGreen, TileId.DungeonBrickPink];
const WALL = [TileId.DungeonWallBlue, TileId.DungeonWallGreen, TileId.DungeonWallPink];

export class DungeonSystem {
  private readonly seed: number;
  readonly left: number;
  readonly top: number; // surface Y at the dungeon centre (dungeon body starts here)
  private readonly centerLx: number;

  constructor(seed: number, surfaceHeight: (x: number) => number) {
    this.seed = seed;
    const side = hash2(3, 7, seed + 60600) < 0.5 ? -1 : 1;
    const centerX = side * 1800; // findable, but not on top of spawn
    this.left = centerX - (W >> 1);
    this.centerLx = W >> 1;
    this.top = surfaceHeight(centerX);
  }

  /** The dungeon's centre column (for tests / minimap markers). */
  centerX(): number { return this.left + this.centerLx; }

  /** Whether the dungeon's bounding box overlaps a chunk rect — used to skip the overlay cheaply. */
  overlaps(x0: number, y0: number, x1: number, y1: number): boolean {
    return x1 >= this.left && x0 < this.left + W && y1 >= this.top - DOOR_H && y0 < this.top + DEPTH;
  }

  /** The dungeon tile at a world position, or null to leave the surrounding terrain untouched. */
  tileAt(wx: number, wy: number): { fg: number; bg: number } | null {
    const lx = wx - this.left;
    if (lx < 0 || lx >= W) return null;
    const ly = wy - this.top;

    // Entrance door poking above the surface at the centre (the locked, boss-gated way in).
    if (ly < 0) {
      if (ly >= -DOOR_H && Math.abs(lx - this.centerLx) <= 1) {
        return { fg: TileId.DungeonDoor, bg: WALL[0] };
      }
      return null; // leave the sky / surrounding terrain
    }
    if (ly >= DEPTH) return null;

    const cx = Math.floor(lx / RW), cy = Math.floor(ly / RH);
    const ux = lx - cx * RW, uy = ly - cy * RH;
    const zone = Math.floor(hash2(cx >> 2, cy >> 2, this.seed + 71) * 3) % 3;
    const brick = BRICK[zone], wall = WALL[zone];

    // Opening under the entrance door leads into the top room.
    if (cy === 0 && uy === 0 && Math.abs(lx - this.centerLx) <= 1) return { fg: TileId.Air, bg: wall };

    const onWall = ux === 0 || ux === RW - 1 || uy === 0 || uy === RH - 1;
    if (onWall) {
      if (this.isDoorway(cx, cy, ux, uy)) return { fg: TileId.Air, bg: wall };
      return { fg: brick, bg: wall };
    }

    return { fg: this.interior(cx, cy, ux, uy, wx, wy), bg: wall };
  }

  private connectRight(cx: number, cy: number): boolean { return hash2(cx, cy, this.seed + 21) < 0.62; }
  private connectDown(cx: number, cy: number): boolean { return hash2(cx, cy, this.seed + 22) < 0.62; }

  /** Whether a perimeter tile is a doorway (a 3-tile gap in the wall shared with a connected room). */
  private isDoorway(cx: number, cy: number, ux: number, uy: number): boolean {
    const midV = RH >> 1, midH = RW >> 1;
    const bandV = uy >= midV - 1 && uy <= midV + 1;
    const bandH = ux >= midH - 1 && ux <= midH + 1;
    if (ux === RW - 1) return bandV && this.connectRight(cx, cy);
    if (ux === 0) return bandV && this.connectRight(cx - 1, cy);
    if (uy === RH - 1) return bandH && this.connectDown(cx, cy);
    if (uy === 0) return bandH && this.connectDown(cx, cy - 1);
    return false;
  }

  /** Interior contents of a room: mostly air, with occasional chests, spike floors and cobwebs. */
  private interior(cx: number, cy: number, ux: number, uy: number, wx: number, wy: number): number {
    const floorRow = uy === RH - 2;
    if (floorRow && ux === 3 && hash2(cx, cy, this.seed + 32) < 0.16) return TileId.GoldChest;
    if (floorRow && ux % 2 === 1 && hash2(cx, cy, this.seed + 31) < 0.12) return TileId.Spike;
    if (hash2(wx, wy, this.seed + 33) < 0.05) return TileId.Cobweb;
    return TileId.Air;
  }
}
