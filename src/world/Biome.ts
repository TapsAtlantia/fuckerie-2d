import { Noise, LayeredNoiseSystem, hash2 } from "./Noise";
import { TileId } from "./Tile";
import { BAND, BIOME } from "../config";

export type TreeType = "oak" | "birch" | "pine" | "jungle" | null;
export type CaveStyle = "normal" | "lush" | "frozen" | "crystal" | "underworld";

export interface Biome {
  name: string;
  topBlock: TileId;
  subSurfaceBlock: TileId;
  subSurfaceDepth: number; // tiles of sub-surface before stone
  stoneVariant: TileId;
  surfaceAmplitude: number; // height variation multiplier
  treeType: TreeType;
  treeDensity: number; // 0..1 probability per valid column
  plants: readonly TileId[];
  plantDensity: number; // 0..1 probability per valid column
  oreWeighting: readonly [string, number][]; // ore type -> weight multiplier
  caveStyle: CaveStyle;
  undergroundVariant: TileId; // stone variant for underground biomes
  isHybrid: boolean; // whether this is a hybrid biome
  parentBiomes?: string[]; // parent biome names if hybrid
  blendFactor?: number; // 0-1 blend ratio if hybrid
}

// Surface biomes arranged by temperature (X) and humidity (Y) - Whittaker diagram style
const SURFACE_BIOMES: readonly Biome[] = [
  {
    name: "desert",
    topBlock: TileId.Sand,
    subSurfaceBlock: TileId.Sandstone,
    subSurfaceDepth: 5,
    stoneVariant: TileId.Sandstone,
    surfaceAmplitude: 0.6,
    treeType: null,
    treeDensity: 0,
    plants: [TileId.Cactus, TileId.DeadBush],
    plantDensity: 0.15,
    oreWeighting: [["sand", 1.5]],
    caveStyle: "normal",
    undergroundVariant: TileId.Sandstone,
    isHybrid: false,
  },
  {
    name: "savanna",
    topBlock: TileId.Grass,
    subSurfaceBlock: TileId.Dirt,
    subSurfaceDepth: 4,
    stoneVariant: TileId.Stone,
    surfaceAmplitude: 0.8,
    treeType: "oak",
    treeDensity: 0.08,
    plants: [TileId.TallGrass, TileId.DeadBush],
    plantDensity: 0.3,
    oreWeighting: [["iron", 1.2]],
    caveStyle: "normal",
    undergroundVariant: TileId.Stone,
    isHybrid: false,
  },
  {
    name: "plains",
    topBlock: TileId.Grass,
    subSurfaceBlock: TileId.Dirt,
    subSurfaceDepth: 4,
    stoneVariant: TileId.Stone,
    surfaceAmplitude: 1.0,
    treeType: "oak",
    treeDensity: 0.12,
    plants: [TileId.TallGrass, TileId.Flower],
    plantDensity: 0.4,
    oreWeighting: [["coal", 1.3]],
    caveStyle: "normal",
    undergroundVariant: TileId.Stone,
    isHybrid: false,
  },
  {
    name: "forest",
    topBlock: TileId.Grass,
    subSurfaceBlock: TileId.Dirt,
    subSurfaceDepth: 5,
    stoneVariant: TileId.Stone,
    surfaceAmplitude: 1.2,
    treeType: "oak",
    treeDensity: 0.35,
    plants: [TileId.TallGrass, TileId.Flower, TileId.Mushroom],
    plantDensity: 0.5,
    oreWeighting: [["copper", 1.4]],
    caveStyle: "lush",
    undergroundVariant: TileId.MossyStone,
    isHybrid: false,
  },
  {
    name: "jungle",
    topBlock: TileId.JungleGrass,
    subSurfaceBlock: TileId.Dirt,
    subSurfaceDepth: 6,
    stoneVariant: TileId.Stone,
    surfaceAmplitude: 1.1,
    treeType: "jungle",
    treeDensity: 0.5,
    plants: [TileId.TallGrass, TileId.Flower, TileId.Vines],
    plantDensity: 0.6,
    oreWeighting: [["gold", 1.3]],
    caveStyle: "lush",
    undergroundVariant: TileId.MossyStone,
    isHybrid: false,
  },
  {
    name: "swamp",
    topBlock: TileId.Podzol,
    subSurfaceBlock: TileId.Mud,
    subSurfaceDepth: 8,
    stoneVariant: TileId.Stone,
    surfaceAmplitude: 0.7,
    treeType: "oak",
    treeDensity: 0.2,
    plants: [TileId.TallGrass, TileId.Mushroom, TileId.Vines],
    plantDensity: 0.55,
    oreWeighting: [["clay", 2.0]],
    caveStyle: "lush",
    undergroundVariant: TileId.MossyStone,
    isHybrid: false,
  },
  {
    name: "mountain",
    topBlock: TileId.Stone,
    subSurfaceBlock: TileId.Stone,
    subSurfaceDepth: 2,
    stoneVariant: TileId.Granite,
    surfaceAmplitude: 2.0, // very tall
    treeType: null,
    treeDensity: 0,
    plants: [TileId.DeadBush],
    plantDensity: 0.1,
    oreWeighting: [["silver", 2.0], ["gold", 1.5]],
    caveStyle: "normal",
    undergroundVariant: TileId.Granite,
    isHybrid: false,
  },
  {
    name: "volcanic",
    topBlock: TileId.Cobblestone,
    subSurfaceBlock: TileId.Basalt,
    subSurfaceDepth: 3,
    stoneVariant: TileId.Basalt,
    surfaceAmplitude: 1.3,
    treeType: null,
    treeDensity: 0,
    plants: [TileId.DeadBush],
    plantDensity: 0.05,
    oreWeighting: [["gold", 2.5], ["copper", 1.8]],
    caveStyle: "underworld",
    undergroundVariant: TileId.Hellstone,
    isHybrid: false,
  },
  {
    name: "snowy",
    topBlock: TileId.SnowyGrass,
    subSurfaceBlock: TileId.Dirt,
    subSurfaceDepth: 3,
    stoneVariant: TileId.Stone,
    surfaceAmplitude: 1.5, // taller mountains
    treeType: "pine",
    treeDensity: 0.15,
    plants: [TileId.Snow],
    plantDensity: 0.2,
    oreWeighting: [["silver", 1.5]],
    caveStyle: "frozen",
    undergroundVariant: TileId.Ice,
    isHybrid: false,
  },
  {
    name: "tundra",
    topBlock: TileId.Snow,
    subSurfaceBlock: TileId.Dirt,
    subSurfaceDepth: 2,
    stoneVariant: TileId.Stone,
    surfaceAmplitude: 0.9,
    treeType: "pine",
    treeDensity: 0.05,
    plants: [TileId.Snow, TileId.DeadBush],
    plantDensity: 0.15,
    oreWeighting: [["iron", 1.2]],
    caveStyle: "frozen",
    undergroundVariant: TileId.Ice,
    isHybrid: false,
  },
];

// Underground biomes by depth and region
interface UndergroundBiome {
  name: string;
  stoneVariant: TileId;
  caveStyle: CaveStyle;
  minDepth: number;
}

const UNDERGROUND_BIOMES: readonly UndergroundBiome[] = [
  { name: "normal caves", stoneVariant: TileId.Stone, caveStyle: "normal", minDepth: 0 },
  { name: "lush caves", stoneVariant: TileId.MossyStone, caveStyle: "lush", minDepth: 100 },
  { name: "crystal caverns", stoneVariant: TileId.DeepStone, caveStyle: "crystal", minDepth: BAND.CAVERN - 100 },
  { name: "underworld", stoneVariant: TileId.Hellstone, caveStyle: "underworld", minDepth: BAND.UNDERWORLD },
];

// Hybrid biome configurations
interface HybridBiomeConfig {
  result: string;
  transition: "gradient" | "patchwork" | "mixed";
  overrides?: Partial<Biome>;
}

const BIOME_BLEND_MATRIX: Record<string, HybridBiomeConfig> = {
  "desert+jungle": { result: "oasis", transition: "patchwork" },
  "forest+swamp": { result: "wetland", transition: "gradient" },
  "snowy+mountain": { result: "glacier", transition: "mixed" },
  "plains+volcanic": { result: "ash-lands", transition: "gradient" },
  "desert+forest": { result: "savanna-edge", transition: "gradient" },
  "jungle+mountain": { result: "rainforest-highlands", transition: "mixed" },
  "snowy+forest": { result: "taiga", transition: "gradient" },
  "swamp+ocean": { result: "mangrove", transition: "patchwork" },
  "mountain+volcanic": { result: "volcanic-peak", transition: "mixed" },
  "desert+mountain": { result: "mesa", transition: "gradient" },
  "forest+mountain": { result: "highland-forest", transition: "mixed" },
};

export class BiomeSystem {
  private noise: Noise;
  private layeredNoise: LayeredNoiseSystem;
  private seed: number;
  
  // Biome region configuration for overlap detection
  private readonly REGION_SIZE = 500; // tiles
  private readonly TRANSITION_WIDTH = 100; // tiles

  constructor(seed: number) {
    this.seed = seed;
    this.noise = new Noise(seed);
    this.layeredNoise = new LayeredNoiseSystem(seed);
  }

  /** Get surface biome at world X using temperature/humidity Whittaker diagram with blending. */
  surfaceBiomeAt(worldX: number): Biome {
    // Use layered noise for more detailed climate
    const climate = this.layeredNoise.climate(worldX, 0);
    const temp = climate.temperature;
    const humidity = climate.humidity;

    // Get primary biome from climate
    const primary = this.selectPrimaryBiome(temp, humidity, worldX);
    
    // Check for biome overlap with neighboring regions
    const blendInfo = this.checkBiomeOverlap(worldX, primary);
    
    if (blendInfo) {
      return this.generateHybridBiome(primary, blendInfo.secondary, blendInfo.factor, blendInfo.config);
    }
    
    return primary;
  }
  
  private selectPrimaryBiome(temp: number, humidity: number, worldX: number): Biome {
    // Whittaker diagram mapping, coupled to the real elevation field so mountains sit on high
    // ground — coherent, planet-like biome placement. Named indices avoid the earlier mismatch
    // between SURFACE_BIOMES order and the returned biome.
    const DESERT = 0, SAVANNA = 1, PLAINS = 2, FOREST = 3, JUNGLE = 4, SWAMP = 5;
    const MOUNTAIN = 6, VOLCANIC = 7, SNOWY = 8, TUNDRA = 9;
    const elevation = this.layeredNoise.surfaceElevation(worldX);

    if (temp > 0.6) {
      // Very hot
      if (elevation > 85) return SURFACE_BIOMES[VOLCANIC]; // scorched peaks
      if (humidity < -0.4) return SURFACE_BIOMES[DESERT];
      if (humidity < 0.1) return SURFACE_BIOMES[SAVANNA];
      return SURFACE_BIOMES[JUNGLE];
    } else if (temp > 0.4) {
      // Hot
      if (elevation > 90) return SURFACE_BIOMES[MOUNTAIN]; // rocky peaks
      if (humidity < -0.3) return SURFACE_BIOMES[DESERT];
      if (humidity < 0.2) return SURFACE_BIOMES[SAVANNA];
      return SURFACE_BIOMES[JUNGLE];
    } else if (temp > -0.2) {
      // Temperate
      if (elevation > 70) return SURFACE_BIOMES[MOUNTAIN];
      if (humidity < -0.2) return SURFACE_BIOMES[SAVANNA];
      if (humidity < 0.3) return SURFACE_BIOMES[PLAINS];
      if (humidity < 0.7) return SURFACE_BIOMES[FOREST];
      return SURFACE_BIOMES[SWAMP];
    } else if (temp > -0.5) {
      // Cool
      if (elevation > 60) return SURFACE_BIOMES[MOUNTAIN];
      if (humidity < 0) return SURFACE_BIOMES[TUNDRA];
      return SURFACE_BIOMES[SNOWY];
    } else {
      // Cold
      if (elevation > 70) return SURFACE_BIOMES[MOUNTAIN]; // snowy peaks
      if (humidity < 0) return SURFACE_BIOMES[TUNDRA];
      return SURFACE_BIOMES[SNOWY];
    }
  }
  
  private checkBiomeOverlap(worldX: number, primary: Biome): { secondary: Biome; factor: number; config: HybridBiomeConfig } | null {
    // Calculate region coordinates
    const regionX = Math.floor(worldX / this.REGION_SIZE);
    const regionY = Math.floor(0 / this.REGION_SIZE); // Y is less relevant for surface biomes
    
    // Get region's dominant biome
    const regionHash = hash2(regionX, regionY, this.seed + 100);
    const regionBiomeIndex = Math.floor(regionHash * SURFACE_BIOMES.length);
    const regionBiome = SURFACE_BIOMES[regionBiomeIndex % SURFACE_BIOMES.length];
    
    // If different from primary, check if we're in transition zone
    if (regionBiome.name !== primary.name) {
      const positionInRegion = worldX % this.REGION_SIZE;
      const distFromCenter = Math.abs(positionInRegion - this.REGION_SIZE / 2);
      
      if (distFromCenter > (this.REGION_SIZE / 2 - this.TRANSITION_WIDTH)) {
        // In transition zone - calculate blend factor
        const factor = (distFromCenter - (this.REGION_SIZE / 2 - this.TRANSITION_WIDTH)) / this.TRANSITION_WIDTH;
        const smoothFactor = this.smoothstep(0, 1, factor);
        
        // Check if this combination has a hybrid biome
        const blendKey = this.getBlendKey(primary.name, regionBiome.name);
        const config = BIOME_BLEND_MATRIX[blendKey];
        
        if (config) {
          return { secondary: regionBiome, factor: smoothFactor, config };
        }
      }
    }
    
    return null;
  }
  
  private generateHybridBiome(primary: Biome, secondary: Biome, factor: number, config: HybridBiomeConfig): Biome {
    const result: Biome = { ...primary, isHybrid: true, parentBiomes: [primary.name, secondary.name], blendFactor: factor };
    
    switch (config.transition) {
      case "gradient":
        // Smooth interpolation of properties
        result.topBlock = factor > 0.5 ? secondary.topBlock : primary.topBlock;
        result.subSurfaceBlock = this.lerpBlock(primary.subSurfaceBlock, secondary.subSurfaceBlock, factor);
        result.surfaceAmplitude = this.lerp(primary.surfaceAmplitude, secondary.surfaceAmplitude, factor);
        result.caveStyle = factor > 0.7 ? secondary.caveStyle : primary.caveStyle;
        break;
        
      case "patchwork":
        // Random mixture based on factor
        const h = hash2(Math.floor(primary.surfaceAmplitude * 100), Math.floor(secondary.surfaceAmplitude * 100), this.seed);
        result.topBlock = h < factor ? secondary.topBlock : primary.topBlock;
        result.plants = this.shuffleAndMerge(primary.plants, secondary.plants, factor);
        break;
        
      case "mixed":
        // Some properties from primary, some from secondary
        result.topBlock = secondary.topBlock;
        result.subSurfaceBlock = primary.subSurfaceBlock;
        result.plants = [...primary.plants, ...secondary.plants];
        result.treeType = secondary.treeType !== null ? secondary.treeType : primary.treeType;
        break;
    }
    
    // Apply hybrid-specific overrides
    if (config.overrides) {
      Object.assign(result, config.overrides);
    }
    
    return result;
  }
  
  private lerpBlock(a: TileId, b: TileId, t: number): TileId {
    return t > 0.5 ? b : a;
  }
  
  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
  
  private smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }
  
  private getBlendKey(a: string, b: string): string {
    return [a, b].sort().join('+');
  }
  
  private shuffleAndMerge<T>(a: readonly T[], b: readonly T[], factor: number): T[] {
    const result: T[] = [...a];
    const takeCount = Math.floor(b.length * factor);
    
    for (let i = 0; i < takeCount; i++) {
      const h = hash2(i, factor, this.seed);
      const index = Math.floor(h * b.length);
      if (!result.includes(b[index])) {
        result.push(b[index]);
      }
    }
    
    return result;
  }

  /** Get underground biome at world X, Y based on depth and region. */
  undergroundBiomeAt(worldX: number, worldY: number): UndergroundBiome {
    const depth = Math.max(0, worldY);
    
    // Region noise for underground variation
    const region = this.noise.fbm2D(worldX * 0.0003, worldY * 0.0001, 2);
    
    // Select by depth, with region-based variation
    for (let i = UNDERGROUND_BIOMES.length - 1; i >= 0; i--) {
      const ub = UNDERGROUND_BIOMES[i];
      if (depth >= ub.minDepth) {
        // Add some variation: crystal caverns can appear earlier in high-region areas
        if (ub.name === "crystal caverns" && region > 0.3 && depth >= BAND.CAVERN - 200) {
          return ub;
        }
        return ub;
      }
    }
    return UNDERGROUND_BIOMES[0];
  }

  /** Sky island mask: returns true if (x,y) is part of a floating island. */
  skyIslandMask(worldX: number, worldY: number): boolean {
    if (worldY > BAND.SKY + 100) return false; // only in sky band
    
    // Blob noise for island shapes
    const scale = 0.003;
    const noise = this.noise.fbm2D(worldX * scale, worldY * scale, 3);
    const threshold = 0.3;
    
    // Carve islands from air: noise > threshold means solid
    return noise > threshold;
  }

  /** Get continuous surface amplitude at X (biome-modulated height variation). */
  surfaceAmplitudeAt(worldX: number): number {
    const biome = this.surfaceBiomeAt(worldX);
    // Use layered noise for more natural amplitude variation
    const climate = this.layeredNoise.climate(worldX, 0);
    const smooth = 1 + climate.precipitation * 0.3; // More precipitation = more variation
    return biome.surfaceAmplitude * smooth;
  }
}
