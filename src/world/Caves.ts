import { Noise } from "./Noise";
import type { CaveStyle } from "./Biome";
import { CAVE } from "../config";

/**
 * Cave generation: wide winding tunnels (domain-warped worm noise) that connect open caverns
 * (low-frequency blob rooms, bigger with depth), clustered into systems by a region mask.
 * Pure function of (seed, x, y, style) — deterministic and seamless across chunk borders.
 * Tuned to read as real, walk-in cave systems rather than scattered missing blocks.
 */
export class CaveSystem {
  private noise: Noise;
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
    this.noise = new Noise(seed);
  }

  caveAt(worldX: number, worldY: number, style: CaveStyle): boolean {
    // Cluster caves into systems so there are solid stretches between them (not a uniform sponge).
    if (this.regionMask(worldX, worldY) < CAVE.REGION_THRESHOLD) return false;

    const depth = Math.max(0, worldY);
    const dt = Math.min(1, depth / 900); // 0 shallow → 1 deep
    const sm = this.styleMul(style);

    // Winding tunnels — the connective tissue. Two decorrelated networks so caves branch and loop.
    const tw = (0.11 + 0.05 * dt) * sm;
    if (Math.abs(this.warp(worldX, worldY, 0)) < tw) return true;
    if (Math.abs(this.warp(worldX, worldY, 137)) < tw * 0.82) return true;

    // Open caverns — low-frequency blob rooms, larger and more common with depth.
    const room = this.noise.fbm2D(worldX * 0.018 + 500, worldY * 0.018 - 500, 3);
    const roomThresh = (0.52 - 0.34 * dt) / sm;
    if (room > roomThresh) return true;

    return false;
  }

  /**
   * Depth-below-surface at which caves may start carving for this column — a guaranteed solid crust
   * so caves never break the surface as scattered pits. Caves stay shallow (reachable a few tiles
   * down) but the ground reads as intact. (Organic aboveground cave mouths on steep mountainsides
   * come back in the Phase 5 cave rework, gated properly so they're rare and discovered.)
   */
  caveFloor(_worldX: number): number {
    return CAVE.SURFACE_CRUST;
  }

  private styleMul(style: CaveStyle): number {
    switch (style) {
      case "crystal": return 1.3;
      case "lush": return 1.15;
      case "frozen": return 0.9;
      case "underworld": return 0.78;
      default: return 1;
    }
  }

  /** Very low-frequency 2D mask so caves cluster into systems (varies with depth, not a vertical gate). */
  private regionMask(worldX: number, worldY: number): number {
    return this.noise.fbm2D(worldX * CAVE.REGION_SCALE, worldY * CAVE.REGION_SCALE, 2, 2, 0.5);
  }

  /** Domain-warped fBm → organic, winding tunnel bands (the value crosses zero along tunnels). */
  private warp(worldX: number, worldY: number, off: number): number {
    const wx = worldX + this.noise.fbm2D(worldX * CAVE.WARP_SCALE + off, worldY * CAVE.WARP_SCALE + off, 2) * 24;
    const wy = worldY + this.noise.fbm2D(worldX * CAVE.WARP_SCALE + off + 50, worldY * CAVE.WARP_SCALE + off + 50, 2) * 24;
    return this.noise.fbm2D(wx * CAVE.BASE_SCALE, wy * CAVE.BASE_SCALE, 4);
  }
}
