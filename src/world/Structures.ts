import { hash2, type Noise } from "./Noise";
import { TileId } from "./Tile";
import { BAND, CHUNK_SIZE, STRUCTURE } from "../config";
import {
  legend,
  pickTemplate,
  type StructureContext,
  type StructureTemplate,
} from "./structures/StructureTemplates";

/**
 * Structure placement engine. The world is procedural, but structures are hand-authored prefab
 * templates (StructureTemplates.ts). A coarse grid of cells is hashed from the seed to decide,
 * rarely and by context, whether a structure spawns, which template, where, and mirrored or not.
 * Templates anchor to the terrain surface (with a foundation cast-down) and are stamped per-chunk,
 * so placement is deterministic and seamless across chunk borders.
 */

interface StructureCell {
  has: boolean;
  template: StructureTemplate | null;
  originX: number; // world tile of the template's top-left
  originY: number;
  mirror: boolean;
  surface: boolean;
}

const EMPTY: StructureCell = { has: false, template: null, originX: 0, originY: 0, mirror: false, surface: false };

export class StructureSystem {
  private seed: number;
  private noise: Noise;
  private surfaceHeightFn: ((x: number) => number) | null;
  private readonly CELL = STRUCTURE.CELL_SIZE;

  constructor(seed: number, noise: Noise, surfaceHeightFn?: (x: number) => number) {
    this.seed = seed;
    this.noise = noise;
    this.surfaceHeightFn = surfaceHeightFn ?? null;
  }

  /** Tile overrides (fg+bg) contributed by structures overlapping this chunk. */
  structureOverridesForChunk(chunkCx: number, chunkCy: number): Map<string, { fg: TileId; bg: TileId }> {
    const overrides = new Map<string, { fg: TileId; bg: TileId }>();
    const cwX = chunkCx * CHUNK_SIZE;
    const cwY = chunkCy * CHUNK_SIZE;

    // Templates fit within ~one cell of their origin, so scanning a 2-cell margin is ample.
    const pad = 2;
    const minCX = Math.floor(cwX / this.CELL) - pad;
    const maxCX = Math.floor((cwX + CHUNK_SIZE) / this.CELL) + pad;
    const minCY = Math.floor(cwY / this.CELL) - pad;
    const maxCY = Math.floor((cwY + CHUNK_SIZE) / this.CELL) + pad;

    for (let cellX = minCX; cellX <= maxCX; cellX++) {
      for (let cellY = minCY; cellY <= maxCY; cellY++) {
        const cell = this.cellAt(cellX, cellY);
        if (cell.has) this.stamp(cell, cwX, cwY, overrides);
      }
    }
    return overrides;
  }

  private cellAt(cx: number, cy: number): StructureCell {
    const h = hash2(cx, cy, this.seed);
    if (h >= STRUCTURE.STRUCTURE_CHANCE) return EMPTY; // sparse base rate

    const worldY = cy * this.CELL;
    const context: StructureContext = worldY < BAND.SKY ? "sky" : worldY >= 40 ? "underground" : "surface";

    // Context culling so nothing feels crowded.
    const h2 = hash2(cx, cy, this.seed + 555);
    if (context === "sky") {
      if (h2 > 0.14) return EMPTY; // very rare
    } else if (context === "underground") {
      if (h2 > 0.5) return EMPTY; // occasional
    } else {
      // Surface: cluster into settlements (villages) with a few scattered elsewhere.
      const settlement = this.noise.fbm2D(cx * this.CELL * STRUCTURE.SETTLEMENT_SCALE, 0, 2);
      if (settlement < 0.25 && h2 > 0.4) return EMPTY;
    }

    const template = pickTemplate(context, hash2(cx, cy, this.seed + 71));
    if (!template) return EMPTY;

    const width = template.rows[0].length;
    const originX = Math.floor(cx * this.CELL + (h * 0.5 + 0.25) * this.CELL - width / 2);

    let originY: number;
    if (context === "surface" && this.surfaceHeightFn) {
      const centerX = originX + Math.floor(width / 2);
      originY = this.surfaceHeightFn(centerX) - template.anchorRow; // anchor row sits on the ground
    } else {
      originY = Math.floor(cy * this.CELL + (((h * 17) % 1) * 0.5 + 0.25) * this.CELL);
    }

    return {
      has: true,
      template,
      originX,
      originY,
      mirror: hash2(cx, cy, this.seed + 9) < 0.5,
      surface: context === "surface",
    };
  }

  private stamp(
    cell: StructureCell,
    cwX: number,
    cwY: number,
    overrides: Map<string, { fg: TileId; bg: TileId }>,
  ): void {
    const t = cell.template!;
    const rows = t.rows;
    const w = rows[0].length;

    for (let row = 0; row < rows.length; row++) {
      const line = rows[row];
      for (let col = 0; col < w; col++) {
        const ch = cell.mirror ? line[w - 1 - col] : line[col];
        const def = legend(ch);
        if (!def) continue;
        const worldX = cell.originX + col;
        const worldY = cell.originY + row;
        if (worldX < cwX || worldX >= cwX + CHUNK_SIZE || worldY < cwY || worldY >= cwY + CHUNK_SIZE) continue;
        overrides.set(`${worldX - cwX},${worldY - cwY}`, { fg: def.fg, bg: def.bg });
      }
    }

    // Foundation cast-down: keep surface structures anchored on uneven ground.
    if (cell.surface && this.surfaceHeightFn) {
      const floorY = cell.originY + t.anchorRow;
      for (let col = 0; col < w; col++) {
        const worldX = cell.originX + col;
        const colGround = this.surfaceHeightFn(worldX);
        for (let wy = floorY + 1; wy <= colGround; wy++) {
          if (worldX < cwX || worldX >= cwX + CHUNK_SIZE || wy < cwY || wy >= cwY + CHUNK_SIZE) continue;
          overrides.set(`${worldX - cwX},${wy - cwY}`, { fg: TileId.Cobblestone, bg: TileId.Cobblestone });
        }
      }
    }
  }
}
