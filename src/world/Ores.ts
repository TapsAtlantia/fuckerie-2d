import { hash2 } from "./Noise";
import { TileId } from "./Tile";
import { BAND, ORE } from "../config";
import type { Biome } from "./Biome";

interface OreType {
  id: TileId;
  minDepth: number;
  maxDepth: number;
  baseAbundance: number;
}

/**
 * Ore generation using deterministic vein placement on a coarse lattice.
 * Pure function of (seed, x, y, biome) - seamless across chunk borders.
 */
export class OreSystem {
  private seed: number;
  
  // Lattice spacing for vein centers (tiles)
  private readonly LATTICE_SIZE = ORE.LATTICE_SIZE;
  
  // Ore type definitions with depth ranges and base abundances
  private readonly ORE_TYPES: OreType[] = [
    { id: TileId.CoalOre, minDepth: 5, maxDepth: 300, baseAbundance: 0.12 },
    { id: TileId.CopperOre, minDepth: 20, maxDepth: 400, baseAbundance: 0.08 },
    { id: TileId.IronOre, minDepth: 50, maxDepth: 600, baseAbundance: 0.10 },
    { id: TileId.GoldOre, minDepth: 200, maxDepth: 1000, baseAbundance: 0.05 },
    { id: TileId.SilverOre, minDepth: 300, maxDepth: 1200, baseAbundance: 0.04 },
    { id: TileId.Ruby, minDepth: BAND.CAVERN - 100, maxDepth: BAND.UNDERWORLD, baseAbundance: 0.02 },
    { id: TileId.Sapphire, minDepth: BAND.CAVERN - 100, maxDepth: BAND.UNDERWORLD, baseAbundance: 0.02 },
    { id: TileId.Emerald, minDepth: BAND.CAVERN - 50, maxDepth: BAND.UNDERWORLD, baseAbundance: 0.015 },
    { id: TileId.Diamond, minDepth: BAND.CAVERN + 100, maxDepth: BAND.UNDERWORLD, baseAbundance: 0.01 },
    { id: TileId.Crystal, minDepth: BAND.CAVERN, maxDepth: BAND.UNDERWORLD, baseAbundance: 0.025 },
  ];

  constructor(seed: number) {
    this.seed = seed;
  }

  /**
   * Get ore tile at (x, y) if present, otherwise null.
   * Only replaces stone blocks (not dirt, grass, etc.).
   */
  oreAt(worldX: number, worldY: number, biome: Biome): TileId | null {
    const depth = Math.max(0, worldY);
    
    // Get applicable ore types for this depth
    const applicableOres = this.ORE_TYPES.filter(
      ore => depth >= ore.minDepth && depth <= ore.maxDepth
    );
    
    if (applicableOres.length === 0) return null;

    // Check if we're in a vein
    const latticeX = Math.floor(worldX / this.LATTICE_SIZE);
    const latticeY = Math.floor(worldY / this.LATTICE_SIZE);
    
    // Hash the lattice cell to determine vein properties
    const cellHash = hash2(latticeX, latticeY, this.seed);
    
    // Only some lattice cells have veins (hash in [0,1); keep ~14% for sparse ore).
    if (cellHash < 0.86) return null;

    // Determine ore type for this vein (based on cell hash + biome weighting)
    const oreType = this.selectOreType(applicableOres, cellHash, biome);
    if (!oreType) return null;

    // Check if this specific tile is within the vein blob
    const veinHash = hash2(worldX, worldY, this.seed + latticeX * 7 + latticeY * 13);
    const inVein = this.isInVein(worldX, worldY, latticeX, latticeY, veinHash);
    
    if (inVein) {
      return oreType.id;
    }

    return null;
  }

  /** Select ore type based on depth-applicable ores, biome weighting, and random. */
  private selectOreType(
    applicableOres: OreType[],
    cellHash: number,
    biome: Biome
  ): OreType | null {
    // Apply biome ore weighting
    const weighted = applicableOres.map(ore => {
      let weight = ore.baseAbundance;
      
      // Apply biome-specific bonuses
      for (const [oreName, bonus] of biome.oreWeighting) {
        if (this.oreNameMatches(ore.id, oreName)) {
          weight *= bonus;
        }
      }
      
      return { ore, weight };
    });

    // Normalize weights
    const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
    if (totalWeight === 0) return null;

    // Select based on cell hash
    let threshold = cellHash * totalWeight;
    for (const { ore, weight } of weighted) {
      threshold -= weight;
      if (threshold <= 0) return ore;
    }

    return weighted[0]?.ore ?? null;
  }

  /** Check if ore name string matches a TileId. */
  private oreNameMatches(tileId: TileId, name: string): boolean {
    const oreNames: Partial<Record<TileId, string>> = {
      [TileId.CoalOre]: "coal",
      [TileId.CopperOre]: "copper",
      [TileId.IronOre]: "iron",
      [TileId.GoldOre]: "gold",
      [TileId.SilverOre]: "silver",
      [TileId.Ruby]: "ruby",
      [TileId.Sapphire]: "sapphire",
      [TileId.Emerald]: "emerald",
      [TileId.Diamond]: "diamond",
      [TileId.Crystal]: "crystal",
    };
    return oreNames[tileId] === name;
  }

  /** Determine if a tile is within a vein blob using noise-based distance from vein center. */
  private isInVein(
    worldX: number,
    worldY: number,
    latticeX: number,
    latticeY: number,
    veinHash: number
  ): boolean {
    // Vein center offset within the lattice cell
    const centerX = latticeX * this.LATTICE_SIZE + (veinHash * this.LATTICE_SIZE * 0.3 + this.LATTICE_SIZE * 0.35);
    const centerY = latticeY * this.LATTICE_SIZE + ((veinHash * 17 % 1) * this.LATTICE_SIZE * 0.3 + this.LATTICE_SIZE * 0.35);
    
    // Distance from vein center
    const dx = worldX - centerX;
    const dy = worldY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Small vein radius so ore stays a few % of stone (not a rainbow).
    const maxRadius = 1.1 + veinHash * 1.6; // ~1.1-2.7 tiles

    // Noise-jittered shape (not a perfect circle)
    const shapeNoise = hash2(Math.floor(worldX), Math.floor(worldY), this.seed + 999);
    const radius = maxRadius * (0.65 + shapeNoise * 0.45);

    return dist < radius;
  }
}
