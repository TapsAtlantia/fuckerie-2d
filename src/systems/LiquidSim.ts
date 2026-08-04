import { LMAX, isLava, liquidLevel, makeLiquid } from "../world/Liquid";
import { TileId } from "../world/Tile";
import type { ChunkManager } from "../world/ChunkManager";

// Cellular liquid flow over the region around the player. Runs at a fixed tick rate (not every
// frame). Water/lava fall, spread to lower neighbours, and water+lava contact makes obsidian.
// Local-only (not networked) — visuals may drift slightly between peers, but both start from the
// same deterministic worldgen fill.
export class LiquidSim {
  private acc = 0;
  private readonly RATE = 1 / 12; // ticks per second

  step(world: ChunkManager, minX: number, minY: number, maxX: number, maxY: number, dt: number): void {
    this.acc += dt;
    let n = 0;
    while (this.acc >= this.RATE && n < 3) {
      this.simulate(world, minX, minY, maxX, maxY);
      this.acc -= this.RATE;
      n++;
    }
  }

  private simulate(world: ChunkManager, minX: number, minY: number, maxX: number, maxY: number): void {
    // Bottom-to-top so a fall resolves in one pass; alternate horizontal scan direction per row.
    for (let y = maxY; y >= minY; y--) {
      const ltr = (y & 1) === 0;
      for (let k = minX; k <= maxX; k++) {
        const x = ltr ? k : maxX - (k - minX);
        this.cell(world, x, y);
      }
    }
  }

  private cell(world: ChunkManager, x: number, y: number): void {
    const v = world.getLiquid(x, y);
    let lvl = liquidLevel(v);
    if (lvl === 0) return;
    const lava = isLava(v);

    if (world.isSolid(x, y)) {
      world.setLiquid(x, y, 0); // a solid was placed here (tree/structure) — remove liquid
      return;
    }

    // Water + lava contact → obsidian.
    const neigh: Array<[number, number]> = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (const [dx, dy] of neigh) {
      const nv = world.getLiquid(x + dx, y + dy);
      if (liquidLevel(nv) > 0 && isLava(nv) !== lava) {
        if (lava) {
          world.setFg(x, y, TileId.Obsidian);
          world.setLiquid(x, y, 0);
          return;
        }
        world.setFg(x + dx, y + dy, TileId.Obsidian);
        world.setLiquid(x + dx, y + dy, 0);
      }
    }

    // Fall down.
    if (!world.isSolid(x, y + 1)) {
      const bv = world.getLiquid(x, y + 1);
      const bl = liquidLevel(bv);
      if (bv === 0 || isLava(bv) === lava) {
        const move = Math.min(lvl, LMAX - bl);
        if (move > 0) {
          world.setLiquid(x, y + 1, makeLiquid(lava, bl + move));
          lvl -= move;
          world.setLiquid(x, y, lvl > 0 ? makeLiquid(lava, lvl) : 0);
          if (lvl === 0) return;
        }
      }
    }

    // Spread sideways toward lower neighbours.
    for (const dx of [-1, 1]) {
      if (lvl <= 1) break;
      if (world.isSolid(x + dx, y)) continue;
      const nv = world.getLiquid(x + dx, y);
      if (nv !== 0 && isLava(nv) !== lava) continue;
      const nl = liquidLevel(nv);
      if (nl < lvl - 1) {
        world.setLiquid(x + dx, y, makeLiquid(lava, nl + 1));
        lvl -= 1;
        world.setLiquid(x, y, makeLiquid(lava, lvl));
      }
    }
  }
}
