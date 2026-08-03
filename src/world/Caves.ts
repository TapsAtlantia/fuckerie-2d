import { Noise, hash2 } from "./Noise";
import type { CaveStyle } from "./Biome";
import { BAND, CAVE } from "../config";

/**
 * Cave generation using multiple techniques for organic, connected cave systems.
 * Pure function of (seed, x, y, style) - deterministic and seamless across chunk borders.
 */
export class CaveSystem {
  private noise: Noise;
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
    this.noise = new Noise(seed);
  }

  /**
   * Determine if a tile at (x, y) should be carved as a cave.
   * Combines domain-warped fBm, worm tunnels, open caverns, and cave-region masks.
   */
  caveAt(worldX: number, worldY: number, style: CaveStyle): boolean {
    // Cave-region mask: very low frequency to cluster caves into systems
    const regionMask = this.regionMask(worldX, worldY);
    if (regionMask < 0.2) return false; // solid stretches between cave systems

    // Base cave width varies by depth and style
    const baseWidth = this.baseCaveWidth(worldY, style);
    
    // Domain-warped fBm for organic walls
    const warped = this.domainWarpedNoise(worldX, worldY);
    if (Math.abs(warped) < baseWidth * 0.7) return true;

    // Worm tunnels: long connected tunnel networks
    if (this.wormTunnel(worldX, worldY, baseWidth)) return true;

    // Open caverns in deeper layers
    if (worldY >= BAND.CAVERN - 50 && this.openCavern(worldX, worldY, style)) return true;

    // Surface entrances: occasional breaches near surface
    if (this.surfaceEntrance(worldX, worldY)) return true;

    return false;
  }

  /** Very low-frequency mask so caves cluster into systems. */
  private regionMask(worldX: number, worldY: number): number {
    return this.noise.fbm2D(worldX * CAVE.REGION_SCALE, worldY * CAVE.REGION_SCALE, 2, 2, 0.5);
  }

  /** Base cave width by depth and biome style. */
  private baseCaveWidth(worldY: number, style: CaveStyle): number {
    const depth = Math.max(0, worldY);
    
    // Caves get larger with depth
    let width = 0.05 + depth * 0.000015;
    
    // Style modifiers
    switch (style) {
      case "crystal":
        width *= 1.4; // bigger caverns for crystals
        break;
      case "underworld":
        width *= 0.6; // denser, smaller caves in underworld
        break;
      case "lush":
        width *= 1.1;
        break;
      case "frozen":
        width *= 0.9;
        break;
      default:
        break;
    }

    // Cap maximum width
    return Math.min(width, 0.25);
  }

  /** Domain-warped fBm for organic, non-blobby cave walls. */
  private domainWarpedNoise(worldX: number, worldY: number): number {
    // Warp coordinates
    const warpX = worldX + this.noise.fbm2D(worldX * CAVE.WARP_SCALE, worldY * CAVE.WARP_SCALE, 2) * 20;
    const warpY = worldY + this.noise.fbm2D(worldX * CAVE.WARP_SCALE + 50, worldY * CAVE.WARP_SCALE + 50, 2) * 20;
    
    return this.noise.fbm2D(warpX * CAVE.BASE_SCALE, warpY * CAVE.BASE_SCALE, 4);
  }

  /** Worm tunnels: several ridged fBm bands at different frequencies. */
  private wormTunnel(worldX: number, worldY: number, baseWidth: number): boolean {
    // Primary tunnel network
    const n1 = Math.abs(this.noise.fbm2D(worldX * CAVE.WORM_SCALE, worldY * CAVE.WORM_SCALE, 3, 2, 0.6));
    if (n1 < baseWidth * 0.8) return true;

    // Secondary smaller tunnels
    const n2 = Math.abs(this.noise.fbm2D(worldX * CAVE.WORM_SCALE * 1.7 + 30, worldY * CAVE.WORM_SCALE * 1.7 + 30, 3, 2, 0.6));
    if (n2 < baseWidth * 0.5) return true;

    // Tertiary micro-tunnels
    const n3 = Math.abs(this.noise.fbm2D(worldX * CAVE.WORM_SCALE * 2.5 + 60, worldY * CAVE.WORM_SCALE * 2.5 + 60, 2, 2, 0.6));
    if (n3 < baseWidth * 0.3) return true;

    return false;
  }

  /** Open caverns in the Caverns band - big rooms with depth-scaled threshold. */
  private openCavern(worldX: number, worldY: number, style: CaveStyle): boolean {
    const depth = Math.max(0, worldY);
    const cavernProgress = Math.min(1, (depth - (BAND.CAVERN - 200)) / 400);
    
    if (cavernProgress <= 0) return false;

    const threshold = 0.4 - cavernProgress * 0.25; // threshold decreases with depth
    
    const n = this.noise.fbm2D(worldX * CAVE.OPEN_CAVERN_SCALE, worldY * CAVE.OPEN_CAVERN_SCALE, 3);
    return n > threshold;
  }

  /** Surface entrances: occasional breaches near the surface. */
  private surfaceEntrance(worldX: number, worldY: number): boolean {
    // Only near surface (5-20 tiles below)
    if (worldY < 5 || worldY > 20) return false;

    // Deterministic check using hash
    const h = hash2(worldX, worldY, this.seed);
    if (h > (1 - CAVE.SURFACE_ENTRANCE_CHANCE)) { // 3% chance per column
      // Check if this column has a cave below
      const belowCave = this.caveAt(worldX, worldY + 5, "normal");
      return belowCave;
    }

    return false;
  }
}
