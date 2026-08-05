import { Noise } from "./Noise";
import type { CaveStyle } from "./Biome";
import { BAND, CAVE } from "../config";

/**
 * Phase 5 — Terraria-grade cave networks. Two combined carve fields:
 *   • "spaghetti" — thin, winding, domain-warped worm tunnels (two decorrelated networks so caves
 *     branch and loop); the connective tissue present at every depth.
 *   • "cheese" — big open caverns from a low-frequency blob field whose threshold falls with depth,
 *     so descending goes tunnels → rooms → huge caverns.
 * A region mask keeps the shallow surface mostly solid and clusters caves into systems; it relaxes
 * with depth until the deep is caves-everywhere. Pure function of (seed, x, y, style) — deterministic
 * and seamless. Background walls behind carved caves are preserved by WorldGen (Phase 2).
 */
export class CaveSystem {
  private noise: Noise;
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
    this.noise = new Noise(seed);
  }

  caveAt(worldX: number, worldY: number, style: CaveStyle): boolean {
    const depth = Math.max(0, worldY);
    const dt = Math.min(1, depth / BAND.CAVERN); // 0 surface → 1 at the cavern layer
    const deep = Math.min(1, Math.max(0, (depth - BAND.CAVERN) / 2400)); // extra deepness below that
    const sm = this.styleMul(style);

    // Region gate: clusters shallow caves (solid stretches between systems). Relaxes with depth so
    // low areas are continuously cavey rather than isolated pockets.
    // Relax quadratically so the near-surface stays gated/solid while the deep opens up fully.
    const inRegion =
      this.regionMask(worldX, worldY) >=
      CAVE.REGION_THRESHOLD - dt * dt * CAVE.REGION_DEPTH_RELAX - deep * 0.6;

    // Spaghetti tunnels — thin worms, only where a cave region exists (so they don't riddle the
    // whole surface). Two networks for branching/looping.
    if (inRegion) {
      const tw = (CAVE.SPAGHETTI_WIDTH + CAVE.SPAGHETTI_DEPTH_GAIN * dt) * sm;
      if (Math.abs(this.warp(worldX, worldY, 0)) < tw) return true;
      if (Math.abs(this.warp(worldX, worldY, 137)) < tw * 0.8) return true;
    }

    // Cheese caverns — big rooms; threshold falls with depth (grow & become common), floored so the
    // deep never goes fully hollow. Allowed anywhere once we're past the shallow band.
    if (inRegion || dt > 0.6) {
      const room = this.noise.fbm2D(worldX * CAVE.CHEESE_SCALE + 500, worldY * CAVE.CHEESE_SCALE - 500, 2);
      const roomThresh = Math.max(
        CAVE.CHEESE_MIN_THRESHOLD,
        (CAVE.CHEESE_THRESHOLD - CAVE.CHEESE_DEPTH_GAIN * dt - CAVE.CHEESE_DEEP_GAIN * deep) / sm,
      );
      if (room > roomThresh) return true;
    }

    return false;
  }

  /**
   * Depth-below-surface at which caves may start carving — a solid crust so caves never break the
   * surface as scattered pits. On steep mountainsides a rare mouth field drops the crust to ~1, so a
   * tunnel that happens to reach up there opens as an organic cave mouth (never on flat ground).
   */
  caveFloor(worldX: number, slope: number): number {
    if (slope >= CAVE.MOUTH_MIN_SLOPE) {
      const mouth = this.noise.fbm2D(worldX * CAVE.MOUTH_SCALE + 300, 21.7, 2);
      if (mouth > CAVE.MOUTH_THRESHOLD) return CAVE.MOUTH_CRUST;
    }
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

  /**
   * Domain-warped fBm → organic, winding tunnel bands (the value crosses zero along tunnels). Only
   * two octaves so the field is smooth: distinct, long, walkable tunnels with solid rock between,
   * rather than a high-octave sponge of countless thin cracks.
   */
  private warp(worldX: number, worldY: number, off: number): number {
    const wx = worldX + this.noise.fbm2D(worldX * CAVE.WARP_SCALE + off, worldY * CAVE.WARP_SCALE + off, 2) * 30;
    const wy = worldY + this.noise.fbm2D(worldX * CAVE.WARP_SCALE + off + 50, worldY * CAVE.WARP_SCALE + off + 50, 2) * 30;
    return this.noise.fbm2D(wx * CAVE.BASE_SCALE, wy * CAVE.BASE_SCALE, 2);
  }
}
