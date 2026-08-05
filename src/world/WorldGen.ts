import { BAND, CHUNK_SIZE, RIVER, BEACH } from "../config";
import { Noise, hash2, LayeredNoiseSystem } from "./Noise";
import { Chunk } from "./Chunk";
import { TileId, naturalWall, tile } from "./Tile";
import { LMAX, LAVA_LEVEL_Y, makeLiquid } from "./Liquid";
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
    // gives a gentle rolling baseline plus regional mountains/valleys/plateaus (natural-planet
    // terrain); rivers then carve a channel down into that surface.
    const elev = this.layeredNoise.surfaceElevation(worldX);
    return Math.floor(-elev) + this.riverCarve(worldX, elev);
  }

  /** The un-carved land height (river banks) at a column — used as the river's water-surface level. */
  private bankHeight(worldX: number): number {
    return Math.floor(-this.layeredNoise.surfaceElevation(worldX));
  }

  /**
   * How many tiles a deterministic river carves down at column x (0 = none). Rivers are occasional
   * (gated by a low-frequency presence field), meander via a mid-frequency path field, and only cut
   * into lowlands — never high peaks. A U-shaped channel: deepest at the centerline, shallow at the
   * banks. Pure function of x, so every peer carves the identical river.
   */
  private riverCarve(worldX: number, elev: number): number {
    if (elev > RIVER.MAX_ELEV) return 0; // no rivers on high mountains
    const presence = this.noise.fbm2D(worldX * RIVER.PRESENCE_SCALE + 900, 0, 2);
    if (presence < RIVER.PRESENCE_THRESHOLD) return 0; // this stretch has no river
    const meander = this.noise.fbm2D(worldX * RIVER.MEANDER_SCALE + 12, 0, 3); // channel path
    const d = RIVER.WIDTH - Math.abs(meander);
    if (d <= 0) return 0; // outside the channel band
    const t = d / RIVER.WIDTH; // 0 at bank → 1 at centerline
    return Math.round(t * RIVER.DEPTH);
  }

  /**
   * The world-Y of the water surface at column x (rivers + depression lakes), or +Infinity if the
   * column holds no standing water. One source of truth for both the liquid fill and beach placement.
   */
  private waterTopAt(worldX: number): number {
    const elev = this.layeredNoise.surfaceElevation(worldX);
    const bank = Math.floor(-elev);
    const carve = this.riverCarve(worldX, elev);
    if (carve > 1) return bank + 1; // river: water sits just below the banks

    // Depression lake: this column is a basin only if both sides are meaningfully higher ground,
    // gated by a low-frequency lake field so most dips stay dry.
    const here = bank + carve;
    const W = 16;
    const rimL = this.surfaceHeight(worldX - W);
    const rimR = this.surfaceHeight(worldX + W);
    if (here > rimL + 3 && here > rimR + 3 && this.noise.fbm2D(worldX * 0.0025 + 88, 3.1, 2) > 0.1) {
      let level = Math.max(rimL, rimR) + 1; // water surface just below the lower spill rim
      if (here - level > 24) level = here - 24; // cap lake depth
      return level;
    }
    return Infinity;
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
    const waterTopCache: number[] = new Array(CHUNK_SIZE); // water-surface Y per column (Infinity = dry)
    const beachCache: boolean[] = new Array(CHUNK_SIZE); // shore/bed column → sandy top
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
      waterTopCache[lx] = this.waterTopAt(worldX);

      // Check for micro-biomes (coarse check per column)
      microBiomeCache[lx] = null; // Will be checked per-tile for precision
    }

    // Beaches: a column is sandy if it is a lake/river bed (underwater) or a dry shore whose ground
    // sits just above a nearby water level. Uses the per-column water cache (with direct lookups for
    // the few neighbours beyond the chunk edge), so it stays a pure function of x.
    const waterTopNear = (lx: number, k: number): number => {
      const j = lx + k;
      return j >= 0 && j < CHUNK_SIZE ? waterTopCache[j] : this.waterTopAt(baseX + j);
    };
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const here = surfaceHeightCache[lx];
      let beach = waterTopCache[lx] !== Infinity; // underwater bed
      if (!beach) {
        for (let k = -BEACH.RADIUS; k <= BEACH.RADIUS; k++) {
          const wt = waterTopNear(lx, k);
          if (wt !== Infinity && here - wt >= 0 && here - wt <= BEACH.BAND) { beach = true; break; }
        }
      }
      beachCache[lx] = beach;
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

        // Natural background WALL behind the terrain (stays when caves carve the foreground, so
        // caves read as carved-out rooms with a wall behind them like Terraria).
        const belowSurface = worldY - surfaceY;
        const wallMaterial = belowSurface < dirtDepth ? biome.subSurfaceBlock : this.stoneForDepth(worldX, worldY);
        chunk.bg[ly * CHUNK_SIZE + lx] = naturalWall(wallMaterial);

        // Foreground material by depth and biome
        let fg: TileId;
        if (worldY === surfaceY) {
          fg = topBlockCache[lx];
        } else if (belowSurface < dirtDepth) {
          fg = biome.subSurfaceBlock;
        } else {
          fg = this.stoneForDepth(worldX, worldY);
        }

        // Beach: the top band of shore/bed columns is sand.
        if (beachCache[lx] && belowSurface < BEACH.BED_DEPTH) {
          fg = TileId.Sand;
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

    // Liquids: STATIC + deterministic (identical for every peer — no runtime flow sim, so no
    // multiplayer desync). Water only pools in genuine surface depressions (lakes/ponds), never a
    // global flood; lava sits in occasional deep cave pockets.
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const worldX = baseX + lx;
      const here = surfaceHeightCache[lx];

      // Standing water — both carved river channels and depression lakes — fills from its water
      // surface (waterTopAt) down to the ground. One unified fill; all deterministic.
      const waterTop = waterTopCache[lx];
      if (waterTop !== Infinity && waterTop < here) {
        for (let wy = waterTop; wy < here; wy++) {
          const ly = wy - baseY;
          if (ly < 0 || ly >= CHUNK_SIZE) continue;
          const idx = ly * CHUNK_SIZE + lx;
          if (chunk.fg[idx] === TileId.Air && chunk.liquid[idx] === 0) chunk.liquid[idx] = makeLiquid(false, LMAX);
        }
      }

      // Deep lava pockets in cave air.
      for (let ly = 0; ly < CHUNK_SIZE; ly++) {
        const worldY = baseY + ly;
        if (worldY < LAVA_LEVEL_Y) continue;
        const idx = ly * CHUNK_SIZE + lx;
        if (chunk.fg[idx] !== TileId.Air || chunk.liquid[idx] !== 0) continue;
        if (this.noise.fbm2D(worldX * 0.02 + 12, worldY * 0.02 - 8, 2) > 0.5) {
          chunk.liquid[idx] = makeLiquid(true, LMAX);
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
