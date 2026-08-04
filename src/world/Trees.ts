import { hash2 } from "./Noise";
import { CHUNK_SIZE } from "../config";
import { TileId } from "./Tile";
import type { Biome } from "./Biome";

// Deterministic multi-tile trees (trunk + leaf canopy), placed on grassy surfaces by biome.
// Like structures, canopies can straddle chunk borders, so each chunk stamps the slice of every
// nearby tree that overlaps it — pure function of (seed, x), so it's seamless. Trees only overwrite
// air (they grow up from the surface) and are applied before structures (buildings clear them).

const SPACING = 5; // one candidate tree per 5-tile cell → natural spacing, canopies rarely merge

export class TreeSystem {
  private seed: number;
  private surfaceHeight: (x: number) => number;
  private biomeAt: (x: number) => Biome;

  constructor(seed: number, surfaceHeight: (x: number) => number, biomeAt: (x: number) => Biome) {
    this.seed = seed;
    this.surfaceHeight = surfaceHeight;
    this.biomeAt = biomeAt;
  }

  /** Map of local tile index (ly*CHUNK_SIZE + lx) → foreground tile for tree parts in this chunk. */
  treeOverridesForChunk(cx: number, cy: number): Map<number, TileId> {
    const out = new Map<number, TileId>();
    const baseX = cx * CHUNK_SIZE;
    const baseY = cy * CHUNK_SIZE;

    const minCell = Math.floor((baseX - 6) / SPACING);
    const maxCell = Math.floor((baseX + CHUNK_SIZE + 6) / SPACING);
    for (let cell = minCell; cell <= maxCell; cell++) {
      const tx = cell * SPACING + Math.floor(hash2(cell, 0, this.seed + 3) * SPACING);
      const biome = this.biomeAt(tx);
      if (!biome.treeType || biome.treeDensity <= 0) continue;
      if (hash2(cell, 1, this.seed + 3) > biome.treeDensity * 1.5) continue;

      const sy = this.surfaceHeight(tx);
      // Only on fairly flat grassy ground (skip cliffs/steep faces).
      if (Math.abs(this.surfaceHeight(tx - 1) - sy) > 2 || Math.abs(this.surfaceHeight(tx + 1) - sy) > 2) continue;

      this.stampTree(tx, sy, biome.treeType, cell, baseX, baseY, out);
    }
    return out;
  }

  private stampTree(
    tx: number,
    sy: number,
    type: NonNullable<Biome["treeType"]>,
    cell: number,
    baseX: number,
    baseY: number,
    out: Map<number, TileId>,
  ): void {
    const h = hash2(cell, 2, this.seed + 3);
    const pine = type === "pine";
    const trunkH = pine ? 6 + Math.floor(h * 4) : 4 + Math.floor(h * 3);
    const log = this.logFor(type);
    const leaf = this.leafFor(type);
    const topY = sy - trunkH; // top of the trunk

    const put = (x: number, y: number, id: TileId) => {
      const lx = x - baseX;
      const ly = y - baseY;
      if (lx < 0 || lx >= CHUNK_SIZE || ly < 0 || ly >= CHUNK_SIZE) return;
      out.set(ly * CHUNK_SIZE + lx, id);
    };

    // Trunk (from just above the ground up to the top).
    for (let y = sy - 1; y >= topY; y--) put(tx, y, log);

    // Canopy.
    if (pine) {
      for (let i = 0; i < 4; i++) {
        const ry = topY + 1 + i;
        for (let dx = -i; dx <= i; dx++) put(tx + dx, ry, leaf);
      }
      put(tx, topY - 1, leaf); // tip
    } else {
      const r = type === "jungle" ? 3 : 2;
      for (let dy = -r; dy <= r - 1; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy <= r * r + 1) put(tx + dx, topY + dy, leaf);
        }
      }
    }
  }

  private logFor(type: NonNullable<Biome["treeType"]>): TileId {
    return type === "birch" ? TileId.BirchLog : type === "pine" ? TileId.PineLog : type === "jungle" ? TileId.JungleLog : TileId.OakLog;
  }
  private leafFor(type: NonNullable<Biome["treeType"]>): TileId {
    return type === "birch" ? TileId.BirchLeaves : type === "pine" ? TileId.PineLeaves : type === "jungle" ? TileId.JungleLeaves : TileId.OakLeaves;
  }
}
