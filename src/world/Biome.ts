import { Noise, LayeredNoiseSystem, hash2 } from "./Noise";
import { TileId } from "./Tile";
import { BAND, BIOME, EVIL } from "../config";

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
// Evil biomes (Phase 7): one per world, seed-chosen. Purple corruption or red crimson.
const CORRUPTION_BIOME: Biome = {
  name: "corruption",
  topBlock: TileId.CorruptGrass,
  subSurfaceBlock: TileId.Ebonstone,
  subSurfaceDepth: 5,
  stoneVariant: TileId.Ebonstone,
  surfaceAmplitude: 1.0,
  treeType: null,
  treeDensity: 0,
  plants: [TileId.Vines],
  plantDensity: 0.12,
  oreWeighting: [],
  caveStyle: "normal",
  undergroundVariant: TileId.Ebonstone,
  isHybrid: false,
};
const CRIMSON_BIOME: Biome = {
  name: "crimson",
  topBlock: TileId.CrimsonGrass,
  subSurfaceBlock: TileId.Crimstone,
  subSurfaceDepth: 5,
  stoneVariant: TileId.Crimstone,
  surfaceAmplitude: 1.0,
  treeType: null,
  treeDensity: 0,
  plants: [TileId.Vines],
  plantDensity: 0.12,
  oreWeighting: [],
  caveStyle: "normal",
  undergroundVariant: TileId.Crimstone,
  isHybrid: false,
};

export interface UndergroundBiome {
  name: string;
  stoneVariant: TileId; // bulk solid material that replaces generic stone in this region
  caveStyle: CaveStyle;
  grass?: TileId; // grass grown on the material where it meets cave air (jungle/mushroom)
  plant?: TileId; // plant placed in the cave air next to that grass
  glow?: boolean; // biome emits ambient light (glowing mushroom)
}

// Underground biome catalogue. Selection (undergroundBiomeAt) blends surface-biome inheritance
// (jungle above → underground jungle below), 2D region pockets (marble/granite), a rare glowing-
// mushroom region, and depth (crystal caverns deep, underworld deepest).
const UG: Record<string, UndergroundBiome> = {
  normal: { name: "caves", stoneVariant: TileId.Stone, caveStyle: "normal" },
  lush: { name: "lush caves", stoneVariant: TileId.MossyStone, caveStyle: "lush" },
  jungle: { name: "underground jungle", stoneVariant: TileId.Mud, caveStyle: "lush", grass: TileId.JungleGrass, plant: TileId.Vines },
  ice: { name: "ice caves", stoneVariant: TileId.Ice, caveStyle: "frozen" },
  desert: { name: "underground desert", stoneVariant: TileId.Sandstone, caveStyle: "normal" },
  marble: { name: "marble caves", stoneVariant: TileId.Marble, caveStyle: "normal" },
  granite: { name: "granite caves", stoneVariant: TileId.Granite, caveStyle: "crystal" },
  mushroom: { name: "glowing mushroom", stoneVariant: TileId.Mud, caveStyle: "lush", grass: TileId.MushroomGrass, plant: TileId.GlowMushroom, glow: true },
  crystal: { name: "crystal caverns", stoneVariant: TileId.DeepStone, caveStyle: "crystal" },
  underworld: { name: "underworld", stoneVariant: TileId.Hellstone, caveStyle: "underworld" },
  corruption: { name: "underground corruption", stoneVariant: TileId.Ebonstone, caveStyle: "normal" },
  crimson: { name: "underground crimson", stoneVariant: TileId.Crimstone, caveStyle: "normal" },
};

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

  /** The world's evil biome kind, chosen deterministically by seed (Corruption OR Crimson). */
  evilKind(): "corruption" | "crimson" {
    return hash2(0, 0, this.seed + 91117) < 0.5 ? "corruption" : "crimson";
  }

  /** The evil biome definition for this world. */
  evilBiome(): Biome {
    return this.evilKind() === "corruption" ? CORRUPTION_BIOME : CRIMSON_BIOME;
  }

  /** Whether this column lies in an evil-biome band (occasional bands away from spawn). */
  isEvil(worldX: number): boolean {
    return this.noise.fbm2D(worldX * EVIL.SCALE + 5000, 0, 2) > EVIL.THRESHOLD;
  }

  /**
   * Depth of a vertical evil chasm carved from the surface at this column (0 = none). Only inside an
   * evil band, at narrow crevice columns — the corruption/crimson's signature descending chasms.
   */
  evilChasmDepth(worldX: number): number {
    if (!this.isEvil(worldX)) return 0;
    const f = this.noise.fbm2D(worldX * EVIL.CHASM_SCALE + 33, 7.3, 2);
    if (Math.abs(f) >= EVIL.CHASM_WIDTH) return 0;
    const t = 1 - Math.abs(f) / EVIL.CHASM_WIDTH; // 1 at centre → 0 at edge
    return Math.round(10 + t * EVIL.CHASM_DEPTH);
  }

  /** Get surface biome at world X using temperature/humidity Whittaker diagram with blending. */
  surfaceBiomeAt(worldX: number): Biome {
    if (this.isEvil(worldX)) return this.evilBiome(); // evil biome overrides the climate biome
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
  undergroundBiomeAt(worldX: number, worldY: number, surfaceBiome?: Biome): UndergroundBiome {
    const depth = Math.max(0, worldY);
    if (depth >= BAND.UNDERWORLD) return UG.underworld;

    const surface = surfaceBiome ?? this.surfaceBiomeAt(worldX);
    // Evil biomes extend straight down as ebonstone/crimstone (overrides everything but underworld).
    if (surface.name === "corruption") return UG.corruption;
    if (surface.name === "crimson") return UG.crimson;

    if (depth < 48) return UG.normal; // topsoil / near-surface stays plain
    const s = surface.name;

    // Rare glowing-mushroom region (2D low-freq blob) — can appear under any surface, deep-ish.
    if (depth >= 120 && this.noise.fbm2D(worldX * 0.0016 + 400, worldY * 0.0016 + 400, 2) > 0.6) {
      return UG.mushroom;
    }

    // Surface-inherited biomes extend downward (underground jungle/ice/desert run deep, like Terraria).
    if (s === "jungle") return UG.jungle;
    if (s === "snowy" || s === "tundra") return UG.ice;
    if (s === "desert") return UG.desert;

    // Marble & granite pockets — 2D region field, independent of the surface above.
    const pocket = this.noise.fbm2D(worldX * 0.004 + 11, worldY * 0.004 - 7, 2);
    if (depth >= 90) {
      if (pocket > 0.5) return UG.marble;
      if (pocket < -0.5 || s === "mountain" || s === "volcanic") return UG.granite;
    }

    // Deep transition to crystal caverns for ordinary columns.
    if (depth >= BAND.CAVERN + 150) return UG.crystal;

    // Forest/swamp read as lush; everything else plain stone.
    if (depth >= 100 && (s === "forest" || s === "swamp")) return UG.lush;
    return UG.normal;
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
