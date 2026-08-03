import { Noise } from "./Noise";
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

export class BiomeSystem {
  private noise: Noise;
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
    this.noise = new Noise(seed);
  }

  /** Get surface biome at world X using temperature/humidity Whittaker diagram. */
  surfaceBiomeAt(worldX: number): Biome {
    // Temperature: -1 (cold) to 1 (hot)
    const temp = this.noise.fbm2D(worldX * BIOME.TEMPERATURE_SCALE, 17.3, 3);
    // Humidity: -1 (dry) to 1 (wet)
    const humidity = this.noise.fbm2D(worldX * BIOME.HUMIDITY_SCALE + 100, 42.7, 3);

    // Whittaker diagram mapping
    if (temp > 0.4) {
      // Hot
      if (humidity < -0.3) return SURFACE_BIOMES[0]; // desert
      if (humidity < 0.2) return SURFACE_BIOMES[1]; // savanna
      return SURFACE_BIOMES[4]; // jungle
    } else if (temp > -0.2) {
      // Temperate
      if (humidity < -0.2) return SURFACE_BIOMES[1]; // savanna
      if (humidity < 0.3) return SURFACE_BIOMES[2]; // plains
      if (humidity < 0.7) return SURFACE_BIOMES[3]; // forest
      return SURFACE_BIOMES[5]; // swamp
    } else {
      // Cold
      if (humidity < 0) return SURFACE_BIOMES[7]; // tundra
      return SURFACE_BIOMES[6]; // snowy
    }
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
    // Smooth amplitude transitions using another noise layer
    const smooth = this.noise.fbm2D(worldX * BIOME.AMPLITUDE_SMOOTH_SCALE, 123.4, 2) * 0.3 + 1;
    return biome.surfaceAmplitude * smooth;
  }
}
