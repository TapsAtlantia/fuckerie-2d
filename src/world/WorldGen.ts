import { BAND, CHUNK_SIZE } from "../config";
import { Noise, hash2, LayeredNoiseSystem } from "./Noise";
import { Chunk } from "./Chunk";
import { TileId } from "./Tile";
import { BiomeSystem, type Biome } from "./Biome";
import { CaveSystem } from "./Caves";
import { OreSystem } from "./Ores";
import { StructureSystem } from "./Structures";
import { MicroBiomeSystem } from "./MicroBiomes";
import { BiomeModifierSystem } from "./BiomeModifiers";

// Procedural terrain. Pure function of (seed, worldX, worldY): the same coordinate always
// generates the same tile no matter how the player reached it, which is what lets the world
// be infinite in every direction — including tens of thousands of tiles down (+Y) and up (-Y).
//
// Phase 2 integrates biomes, worm caves, ores, and sky islands while preserving determinism
// and seamlessness. The public API (surfaceHeight / generateChunk) stays stable.

export class WorldGen {
  private noise: Noise;
  private layeredNoise: LayeredNoiseSystem;
  private biomeSystem: BiomeSystem;
  private caveSystem: CaveSystem;
  private oreSystem: OreSystem;
  private structureSystem: StructureSystem;
  private microBiomeSystem: MicroBiomeSystem;
  private biomeModifierSystem: BiomeModifierSystem;
  readonly seed: number;

  constructor(seed: number) {
    this.seed = seed;
    this.noise = new Noise(seed);
    this.layeredNoise = new LayeredNoiseSystem(seed);
    this.biomeSystem = new BiomeSystem(seed);
    this.caveSystem = new CaveSystem(seed);
    this.oreSystem = new OreSystem(seed);
    this.structureSystem = new StructureSystem(seed, this.noise);
    this.microBiomeSystem = new MicroBiomeSystem(seed);
    this.biomeModifierSystem = new BiomeModifierSystem(seed);
  }

  /** Absolute world-Y (in tiles) of the topmost solid tile at a given column. */
  surfaceHeight(worldX: number): number {
    // Biome-aware elevation with continuous amplitude transitions
    const amplitude = this.biomeSystem.surfaceAmplitudeAt(worldX);
    
    // Use layered noise for more varied terrain
    const terrain = this.layeredNoise.terrainHeight(worldX, 0, amplitude);
    
    return Math.floor(terrain);
  }

  /** Get the appropriate stone variant for a given depth and position. */
  private stoneForDepth(worldX: number, worldY: number): TileId {
    if (worldY >= BAND.UNDERWORLD) return TileId.Hellstone;
    
    // Check underground biome for stone variant
    const undergroundBiome = this.biomeSystem.undergroundBiomeAt(worldX, worldY);
    return undergroundBiome.stoneVariant;
  }

  /** Fill a chunk's foreground + background tiles. */
  generateChunk(cx: number, cy: number): Chunk {
    const chunk = new Chunk(cx, cy);
    const baseX = cx * CHUNK_SIZE;
    const baseY = cy * CHUNK_SIZE;

    // Per-column caches for performance
    const biomeCache: (Biome & { appliedModifiers?: string[] })[] = new Array(CHUNK_SIZE);
    const surfaceHeightCache: number[] = new Array(CHUNK_SIZE);
    const dirtDepthCache: number[] = new Array(CHUNK_SIZE);
    const microBiomeCache: (ReturnType<typeof this.microBiomeSystem.checkForMicroBiome> | null)[] = new Array(CHUNK_SIZE);

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const worldX = baseX + lx;
      let biome = this.biomeSystem.surfaceBiomeAt(worldX);
      
      // Apply biome modifiers
      biome = this.biomeModifierSystem.applyModifiers(biome, worldX, baseY, baseY);
      
      biomeCache[lx] = biome;
      surfaceHeightCache[lx] = this.surfaceHeight(worldX);
      dirtDepthCache[lx] = biomeCache[lx].subSurfaceDepth + Math.floor(
        (this.noise.noise2D(worldX * 0.1, 7.7) + 1) * 2
      );
      
      // Check for micro-biomes (coarse check per column)
      microBiomeCache[lx] = null; // Will be checked per-tile for precision
    }

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const worldX = baseX + lx;
      const biome = biomeCache[lx];
      const surfaceY = surfaceHeightCache[lx];
      const dirtDepth = dirtDepthCache[lx];

      for (let ly = 0; ly < CHUNK_SIZE; ly++) {
        const worldY = baseY + ly;

        // Sky islands (above SKY band)
        if (worldY < BAND.SKY) {
          if (this.biomeSystem.skyIslandMask(worldX, worldY)) {
            // Sky island generation
            chunk.bg[ly * CHUNK_SIZE + lx] = TileId.SkyStone;
            chunk.fg[ly * CHUNK_SIZE + lx] = TileId.CloudStone;
          }
          continue;
        }

        // Above the surface: open air
        if (worldY < surfaceY) {
          continue;
        }

        // Background wall exists everywhere below the surface
        const belowSurface = worldY - surfaceY;
        chunk.bg[ly * CHUNK_SIZE + lx] =
          belowSurface < dirtDepth ? biome.subSurfaceBlock : this.stoneForDepth(worldX, worldY);

        // Foreground material by depth and biome
        let fg: TileId;
        if (worldY === surfaceY) {
          fg = biome.topBlock;
        } else if (belowSurface < dirtDepth) {
          fg = biome.subSurfaceBlock;
        } else {
          fg = this.stoneForDepth(worldX, worldY);
        }

        // Carve caves using the new cave system
        if (belowSurface > 3) {
          const caveStyle = biome.caveStyle;
          if (this.caveSystem.caveAt(worldX, worldY, caveStyle)) {
            fg = TileId.Air;
          }
        }

        // Place ores in stone only
        if (fg !== TileId.Air && fg !== TileId.CloudStone) {
          const ore = this.oreSystem.oreAt(worldX, worldY, biome);
          if (ore !== null) {
            fg = ore;
          }
        }

        // Check for micro-biomes (override blocks if in micro-biome)
        const microBiome = this.microBiomeSystem.checkForMicroBiome(worldX, worldY, biome);
        if (microBiome) {
          // Apply micro-biome effects (simplified for now)
          if (microBiome.uniqueBlocks.length > 0) {
            const blockIndex = Math.floor(hash2(worldX, worldY, this.seed + 8888) * microBiome.uniqueBlocks.length);
            fg = microBiome.uniqueBlocks[blockIndex % microBiome.uniqueBlocks.length];
          }
        }

        chunk.fg[ly * CHUNK_SIZE + lx] = fg;
      }
    }

    // Per-column deco pass for surface vegetation
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const worldX = baseX + lx;
      const biome = biomeCache[lx];
      const surfaceY = surfaceHeightCache[lx];
      
      // Only place deco if we have the surface block in this chunk
      if (surfaceY >= baseY && surfaceY < baseY + CHUNK_SIZE) {
        const ly = surfaceY - baseY;
        const surfaceBlock = chunk.fg[ly * CHUNK_SIZE + lx];
        
        // Check if this biome supports plants and if we should place one
        if (biome.plants.length > 0 && biome.plantDensity > 0) {
          const h = hash2(worldX, surfaceY, this.seed + 777);
          if (h < biome.plantDensity) {
            // Select a plant type
            const plantIndex = Math.floor(h * biome.plants.length * 10) % biome.plants.length;
            const plant = biome.plants[plantIndex];
            
            // Check if the tile above is air (space for plant)
            if (ly + 1 < CHUNK_SIZE && chunk.fg[(ly + 1) * CHUNK_SIZE + lx] === TileId.Air) {
              // Special cases
              if (plant === TileId.Cactus && surfaceBlock !== TileId.Sand) continue; // cactus only on sand
              if (plant === TileId.TallGrass && surfaceBlock === TileId.Sand) continue; // no grass on sand
              
              chunk.fg[(ly + 1) * CHUNK_SIZE + lx] = plant;
            }
          }
        }
      }
    }

    // Apply structure overrides
    const structureOverrides = this.structureSystem.structureOverridesForChunk(cx, cy);
    for (const [key, tiles] of structureOverrides) {
      const [lx, ly] = key.split(',').map(Number);
      if (lx >= 0 && lx < CHUNK_SIZE && ly >= 0 && ly < CHUNK_SIZE) {
        chunk.fg[ly * CHUNK_SIZE + lx] = tiles.fg;
        chunk.bg[ly * CHUNK_SIZE + lx] = tiles.bg;
      }
    }

    return chunk;
  }
}
