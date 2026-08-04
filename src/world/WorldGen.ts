import { BAND, CHUNK_SIZE } from "../config";
import { Noise, hash2, LayeredNoiseSystem } from "./Noise";
import { Chunk } from "./Chunk";
import { TileId, tile } from "./Tile";
import { LMAX, LAVA_LEVEL_Y, SEA_LEVEL_Y, makeLiquid } from "./Liquid";
import { BiomeSystem, type Biome } from "./Biome";
import { CaveSystem } from "./Caves";
import { OreSystem } from "./Ores";
import { StructureSystem } from "./Structures";
import { MicroBiomeSystem } from "./MicroBiomes";
import { BiomeModifierSystem } from "./BiomeModifiers";
import { TreeSystem } from "./Trees";

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
  private treeSystem: TreeSystem;
  readonly seed: number;

  constructor(seed: number) {
    this.seed = seed;
    this.noise = new Noise(seed);
    this.layeredNoise = new LayeredNoiseSystem(seed);
    this.biomeSystem = new BiomeSystem(seed);
    this.caveSystem = new CaveSystem(seed);
    this.oreSystem = new OreSystem(seed);
    this.structureSystem = new StructureSystem(seed, this.noise, (x) => this.surfaceHeight(x));
    this.treeSystem = new TreeSystem(
      seed,
      (x) => this.surfaceHeight(x),
      (x) => this.biomeSystem.surfaceBiomeAt(x),
    );
    this.microBiomeSystem = new MicroBiomeSystem(seed);
    this.biomeModifierSystem = new BiomeModifierSystem(seed);
  }

  /** Absolute world-Y (in tiles) of the topmost solid tile at a given column. */
  surfaceHeight(worldX: number): number {
    // Higher elevation → smaller (more negative) world-Y, since +Y is down. The elevation field
    // gives a gentle rolling baseline plus regional mountains/valleys (natural-planet terrain).
    return Math.floor(-this.layeredNoise.surfaceElevation(worldX));
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
    const topBlockCache: TileId[] = new Array(CHUNK_SIZE);
    const caveFloorCache: number[] = new Array(CHUNK_SIZE);
    const microBiomeCache: (ReturnType<typeof this.microBiomeSystem.checkForMicroBiome> | null)[] = new Array(CHUNK_SIZE);

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const worldX = baseX + lx;
      let biome = this.biomeSystem.surfaceBiomeAt(worldX);

      // Apply biome modifiers
      biome = this.biomeModifierSystem.applyModifiers(biome, worldX, baseY, baseY);

      biomeCache[lx] = biome;
      surfaceHeightCache[lx] = this.surfaceHeight(worldX);

      // Realistic stratigraphy: topsoil thins on steep slopes (erosion), and very steep faces
      // expose rock/gravel (talus) instead of the biome's soft top block.
      const slope = Math.abs(this.surfaceHeight(worldX + 2) - this.surfaceHeight(worldX - 2));
      const jitter = Math.floor((this.noise.noise2D(worldX * 0.1, 7.7) + 1) * 2);
      dirtDepthCache[lx] = Math.max(1, biome.subSurfaceDepth + jitter - Math.floor(slope / 2.5));
      if (slope >= 10) topBlockCache[lx] = biome.stoneVariant;
      else if (slope >= 6) topBlockCache[lx] = TileId.Gravel;
      else topBlockCache[lx] = biome.topBlock;

      caveFloorCache[lx] = this.caveSystem.caveFloor(worldX);

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
          fg = topBlockCache[lx];
        } else if (belowSurface < dirtDepth) {
          fg = biome.subSurfaceBlock;
        } else {
          fg = this.stoneForDepth(worldX, worldY);
        }

        // Carve caves below the crust; in rare "entrance" columns the floor drops to 1 so a cave
        // that reaches the surface opens as an organic mouth (only where a tunnel actually exists).
        if (belowSurface >= caveFloorCache[lx] && this.caveSystem.caveAt(worldX, worldY, biome.caveStyle)) {
          fg = TileId.Air;
        }

        // Place ores in stone only (not dirt/sand/grass/cloud).
        if (tile(fg).category === "stone") {
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

    // Liquids: fill air with water in low basins (oceans/lakes) and lava in deep cave pockets.
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const worldX = baseX + lx;
      const surfaceY = surfaceHeightCache[lx];
      for (let ly = 0; ly < CHUNK_SIZE; ly++) {
        const worldY = baseY + ly;
        const idx = ly * CHUNK_SIZE + lx;
        if (chunk.fg[idx] !== TileId.Air) continue;
        if (worldY >= SEA_LEVEL_Y && worldY < surfaceY) {
          chunk.liquid[idx] = makeLiquid(false, LMAX); // ocean/lake column in a basin
        } else if (worldY >= LAVA_LEVEL_Y && worldY > surfaceY) {
          const n = this.noise.fbm2D(worldX * 0.01 + 12, worldY * 0.01 - 8, 2);
          if (n > 0.35) chunk.liquid[idx] = makeLiquid(true, LMAX); // deep lava pocket
        }
      }
    }

    // Per-column deco pass for surface vegetation
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const worldX = baseX + lx;
      const biome = biomeCache[lx];
      const surfaceY = surfaceHeightCache[lx];
      
      // Place deco in the AIR tile directly above the surface block (surfaceY - 1).
      if (surfaceY >= baseY && surfaceY < baseY + CHUNK_SIZE) {
        const ly = surfaceY - baseY;
        const aboveLy = ly - 1; // the air tile above the surface
        if (
          aboveLy >= 0 &&
          biome.plants.length > 0 &&
          biome.plantDensity > 0 &&
          chunk.fg[aboveLy * CHUNK_SIZE + lx] === TileId.Air
        ) {
          const surfaceBlock = chunk.fg[ly * CHUNK_SIZE + lx];
          const rockyTop = surfaceBlock === TileId.Gravel || tile(surfaceBlock).category === "stone";
          const h = hash2(worldX, surfaceY, this.seed + 777);
          if (!rockyTop && h < biome.plantDensity) {
            const plantIndex = Math.floor(h * biome.plants.length * 10) % biome.plants.length;
            const plant = biome.plants[plantIndex];
            const onSand = surfaceBlock === TileId.Sand;
            // Cactus only on sand; leafy plants not on sand.
            const ok = plant === TileId.Cactus ? onSand : !onSand;
            if (ok) chunk.fg[aboveLy * CHUNK_SIZE + lx] = plant;
          }
        }
      }
    }

    // Trees (grow up from the surface; only overwrite air).
    const treeOverrides = this.treeSystem.treeOverridesForChunk(cx, cy);
    for (const [idx, fg] of treeOverrides) {
      if (chunk.fg[idx] === TileId.Air) chunk.fg[idx] = fg;
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
