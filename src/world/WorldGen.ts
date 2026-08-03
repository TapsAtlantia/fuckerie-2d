import { BAND, CHUNK_SIZE } from "../config";
import { Noise } from "./Noise";
import { Chunk } from "./Chunk";
import { TileId } from "./Tile";

// Procedural terrain. Pure function of (seed, worldX, worldY): the same coordinate always
// generates the same tile no matter how the player reached it, which is what lets the world
// be infinite in every direction — including tens of thousands of tiles down (+Y) and up (-Y).
//
// Phase 1 keeps this deliberately simple (surface height + dirt/stone bands + threshold caves +
// depth-tinted stone). Phase 2 replaces the internals with worm caves, biomes, cross-chunk
// structures and sky islands — the public surface (surfaceHeight / generateChunk) stays stable.

export class WorldGen {
  private noise: Noise;
  readonly seed: number;

  constructor(seed: number) {
    this.seed = seed;
    this.noise = new Noise(seed);
  }

  /** Absolute world-Y (in tiles) of the topmost solid tile at a given column. */
  surfaceHeight(worldX: number): number {
    // Two octaves of scale: broad landmass sweeps + smaller rolling hills.
    const broad = this.noise.fbm2D(worldX * 0.0012, 41.7, 3) * 42;
    const hills = this.noise.fbm2D(worldX * 0.012, 12.3, 4) * 16;
    return Math.floor(broad + hills);
  }

  // Cave half-width by depth: caves are the minority of tiles (winding tunnels near surface,
  // more open caverns deeper). A cheap stand-in for the Phase 2 worm-cave system.
  private caveWidth(worldY: number): number {
    if (worldY >= BAND.UNDERWORLD) return 0.09; // dense hellstone
    if (worldY >= BAND.CAVERN) return 0.12; // open caverns
    if (worldY >= 200) return 0.08;
    return 0.055; // shallow: sparse, thin caves
  }

  private isCave(worldX: number, worldY: number): boolean {
    // Carve tiles near the zero-crossings of two decorrelated noise fields. |n| < w selects a
    // thin band that follows the crossings → connected, winding tunnels rather than blobs.
    const f = 0.05;
    const w = this.caveWidth(worldY);
    const n1 = this.noise.fbm2D(worldX * f, worldY * f, 4);
    if (Math.abs(n1) < w) return true;
    const n2 = this.noise.fbm2D(worldX * f + 31.7, worldY * f - 51.3, 4);
    return Math.abs(n2) < w;
  }

  private stoneForDepth(worldY: number): TileId {
    if (worldY >= BAND.UNDERWORLD) return TileId.Hellstone;
    if (worldY >= BAND.CAVERN) return TileId.DeepStone;
    return TileId.Stone;
  }

  /** Fill a chunk's foreground + background tiles. */
  generateChunk(cx: number, cy: number): Chunk {
    const chunk = new Chunk(cx, cy);
    const baseX = cx * CHUNK_SIZE;
    const baseY = cy * CHUNK_SIZE;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const worldX = baseX + lx;
      const surfaceY = this.surfaceHeight(worldX);
      const dirtDepth = 4 + Math.floor((this.noise.noise2D(worldX * 0.1, 7.7) + 1) * 2); // 4..8

      for (let ly = 0; ly < CHUNK_SIZE; ly++) {
        const worldY = baseY + ly;

        // Above the surface: open air / sky (Phase 2 puts floating islands up here).
        if (worldY < surfaceY) {
          continue; // fg + bg already Air
        }

        // Background wall exists everywhere below the surface, so caves read as carved-out
        // pockets with a wall behind them rather than see-through holes.
        const belowSurface = worldY - surfaceY;
        chunk.bg[ly * CHUNK_SIZE + lx] =
          belowSurface < dirtDepth ? TileId.Dirt : this.stoneForDepth(worldY);

        // Foreground material by depth.
        let fg: TileId;
        if (worldY === surfaceY) {
          fg = TileId.Grass;
        } else if (belowSurface < dirtDepth) {
          fg = TileId.Dirt;
        } else {
          fg = this.stoneForDepth(worldY);
        }

        // Carve caves below a few tiles under the surface (keeps the surface crust intact).
        if (belowSurface > 3 && this.isCave(worldX, worldY)) {
          fg = TileId.Air;
        }

        chunk.fg[ly * CHUNK_SIZE + lx] = fg;
      }
    }

    return chunk;
  }
}
