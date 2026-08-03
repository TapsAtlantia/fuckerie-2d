import { hash2 } from "./Noise";
import { TileId } from "./Tile";
import { BAND } from "../config";
import type { Biome } from "./Biome";

/**
 * Micro-biomes are ultra-rare localized anomalies that break up long travel distances.
 * They have tiny spawn chances and unique blocks, structures, and effects.
 */

export interface MicroBiome {
  id: string;
  name: string;
  size: number; // tiles radius
  spawnChance: number; // extremely low, e.g., 0.000005
  requiredLayer: number[]; // Y ranges where this can appear
  requiredBiomes: string[]; // parent biomes this can appear in
  uniqueBlocks: TileId[];
  uniqueStructures: string[];
  specialEffects: string[];
  atmosphereColor: readonly [number, number, number]; // RGB for visual effect
}

export class MicroBiomeSystem {
  private seed: number;
  
  // Grid size for micro-biome placement (coarse to avoid checking every tile)
  private readonly GRID_SIZE = 100;
  
  private readonly MICRO_BIOMES: readonly MicroBiome[] = [
    {
      id: "singing-crystals",
      name: "Singing Crystals",
      size: 50,
      spawnChance: 0.000005, // 1 in 200,000
      requiredLayer: [BAND.CAVERN - 100, BAND.UNDERWORLD],
      requiredBiomes: ["forest"],
      uniqueBlocks: [TileId.Crystal], // Using existing crystal for now
      uniqueStructures: ["crystal-shrine"],
      specialEffects: ["ambient-music", "light-refraction"],
      atmosphereColor: [200, 180, 255],
    },
    {
      id: "time-frozen-battlefield",
      name: "Time-Frozen Battlefield",
      size: 80,
      spawnChance: 0.000003, // 1 in 333,333
      requiredLayer: [BAND.UNDERGROUND, BAND.CAVERN - 100],
      requiredBiomes: ["plains"],
      uniqueBlocks: [TileId.Cobblestone, TileId.StoneBrick], // Using existing blocks
      uniqueStructures: ["ancient-fortress"],
      specialEffects: ["suspended-particles", "ghost-echoes"],
      atmosphereColor: [200, 200, 220],
    },
    {
      id: "void-pocket",
      name: "Void Pocket",
      size: 30,
      spawnChance: 0.000002, // 1 in 500,000
      requiredLayer: [BAND.UNDERWORLD],
      requiredBiomes: ["volcanic"],
      uniqueBlocks: [TileId.Obsidian, TileId.DeepStone],
      uniqueStructures: ["void-shrine"],
      specialEffects: ["reality-distortion", "color-inversion"],
      atmosphereColor: [50, 0, 80],
    },
    {
      id: "mushroom-grove",
      name: "Giant Mushroom Grove",
      size: 60,
      spawnChance: 0.000008, // 1 in 125,000
      requiredLayer: [BAND.UNDERGROUND, BAND.CAVERN],
      requiredBiomes: ["forest"],
      uniqueBlocks: [TileId.Mushroom],
      uniqueStructures: ["mushroom-house"],
      specialEffects: ["spore-particles", "soft-glow"],
      atmosphereColor: [150, 100, 200],
    },
    {
      id: "sky-palace",
      name: "Sky Palace",
      size: 70,
      spawnChance: 0.000004, // 1 in 250,000
      requiredLayer: [BAND.SKY - 400, BAND.SKY],
      requiredBiomes: ["sky"],
      uniqueBlocks: [TileId.CloudStone, TileId.SkyStone],
      uniqueStructures: ["sky-temple"],
      specialEffects: ["ethereal-glow", "floating-particles"],
      atmosphereColor: [255, 240, 200],
    },
    {
      id: "ancient-library",
      name: "Ancient Library",
      size: 45,
      spawnChance: 0.000006, // 1 in 166,666
      requiredLayer: [BAND.UNDERGROUND, BAND.CAVERN],
      requiredBiomes: ["plains"],
      uniqueBlocks: [TileId.Bookshelf, TileId.Planks],
      uniqueStructures: ["underground-library"],
      specialEffects: ["dust-motes", "ancient-aura"],
      atmosphereColor: [220, 200, 150],
    },
  ];
  
  constructor(seed: number) {
    this.seed = seed;
  }
  
  /**
   * Check if a position has a micro-biome.
   * Returns the micro-biome if present, null otherwise.
   */
  checkForMicroBiome(worldX: number, worldY: number, parentBiome: Biome): MicroBiome | null {
    // Use coarse grid to avoid checking every tile
    const gridX = Math.floor(worldX / this.GRID_SIZE);
    const gridY = Math.floor(worldY / this.GRID_SIZE);
    const gridHash = hash2(gridX, gridY, this.seed + 9999);
    
    for (const micro of this.MICRO_BIOMES) {
      // Check if this micro-biome can appear here
      if (!this.canAppearAt(micro, worldY, parentBiome)) continue;
      
      // Each micro-biome gets a slice of the hash space
      const threshold = this.getMicroBiomeThreshold(micro.id);
      
      if (gridHash >= threshold && gridHash < threshold + micro.spawnChance) {
        // Check if we're within the micro-biome's radius
        const centerX = gridX * this.GRID_SIZE + (gridHash * 50);
        const centerY = gridY * this.GRID_SIZE + ((gridHash * 13 % 1) * 50);
        const dist = Math.sqrt((worldX - centerX) ** 2 + (worldY - centerY) ** 2);
        
        if (dist < micro.size) {
          return micro;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Check if a micro-biome can appear at the given location.
   */
  private canAppearAt(micro: MicroBiome, worldY: number, parentBiome: Biome): boolean {
    // Check layer requirements
    const inLayer = micro.requiredLayer.some((min, max) => worldY >= min && worldY < max);
    if (!inLayer) return false;
    
    // Check parent biome requirements
    const parentMatches = micro.requiredBiomes.includes(parentBiome.name) || 
                         parentBiome.isHybrid && parentBiome.parentBiomes?.some(b => micro.requiredBiomes.includes(b));
    if (!parentMatches) return false;
    
    return true;
  }
  
  /**
   * Get the threshold in hash space for a micro-biome.
   * Ensures micro-biomes don't overlap in the hash space.
   */
  private getMicroBiomeThreshold(microId: string): number {
    // Simple hash-based threshold assignment
    let hash = 0;
    for (let i = 0; i < microId.length; i++) {
      hash = ((hash << 5) - hash) + microId.charCodeAt(i);
      hash |= 0;
    }
    
    // Spread thresholds evenly across the hash space
    return (hash >>> 0) / 4294967296;
  }
  
  /**
   * Get all unique blocks from all micro-biomes.
   * Useful for rendering and inventory systems.
   */
  getAllUniqueBlocks(): TileId[] {
    const blocks = new Set<TileId>();
    
    for (const micro of this.MICRO_BIOMES) {
      for (const block of micro.uniqueBlocks) {
        blocks.add(block);
      }
    }
    
    return Array.from(blocks);
  }
  
  /**
   * Get micro-biome by ID.
   */
  getMicroBiomeById(id: string): MicroBiome | null {
    return this.MICRO_BIOMES.find(m => m.id === id) || null;
  }
}