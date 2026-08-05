import { BAND, CHUNK_SIZE, RIVER, BEACH, WATER, EVIL, CAVE } from "../config";
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
import { DungeonSystem } from "./Dungeon";

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
  private dungeon: DungeonSystem;
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
    this.dungeon = new DungeonSystem(seed, (x) => this.surfaceHeight(x));
  }

  /** Debug/UI: the Dungeon's surface location (centre column X, top Y — both in tiles). */
  dungeonCenter(): { x: number; y: number } {
    return { x: this.dungeon.centerX(), y: this.dungeon.top };
  }

  /** Absolute world-Y (in tiles) of the topmost solid tile at a given column. */
  surfaceHeight(worldX: number): number {
    // Higher elevation → smaller (more negative) world-Y, since +Y is down. The elevation field
    // gives a gentle rolling baseline plus regional mountains/valleys/plateaus (natural-planet
    // terrain); rivers then carve a channel down into that surface.
    const elev = this.layeredNoise.surfaceElevation(worldX);
    return Math.floor(-elev) + this.riverCarve(worldX, elev);
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
   * The world-Y of the water surface at column x, or +Infinity if the column holds no standing
   * water. ALL water — depression lakes and carved river channels alike — is a FLAT pool sitting at
   * its basin's spill level, never water clinging to a slope. Uses the classic "trapping water"
   * rule over the surface profile: scan out to WATER.SCAN_WIN each side for the containing rim; the
   * pool level is the LOWER of the two rims, and the column only holds water if its floor is at
   * least MIN_DEPTH below that rim. A river channel running down a slope has no uphill+downhill rim
   * pair, so it correctly stays a dry ravine instead of holding diagonal water.
   *
   * `heightAt` supplies the surface height (a cached array during chunk gen, so the wide scan costs
   * no extra noise) and keeps the whole thing a pure function of x.
   */
  private waterTopAt(worldX: number, heightAt: (x: number) => number): number {
    const here = heightAt(worldX);

    // Walk each direction to the first enclosing ridge CREST (highest ground, i.e. smallest Y, before
    // the terrain crests and descends the far side). A crest is a fixed terrain feature, so every
    // column in the basin between the same two crests computes the identical spill level → the pool
    // surface is perfectly FLAT (unlike a sliding window-min, which drifts along sloped banks).
    const ridge = (dir: number): { y: number; crested: boolean } => {
      let rim = here; // highest ground seen (min Y)
      let crested = false;
      for (let d = 1; d <= WATER.SCAN_WIN; d++) {
        const h = heightAt(worldX + dir * d);
        if (h < rim) rim = h; // higher ground → raise the rim
        else if (h > rim + 2) { crested = true; break; } // descended past the crest → real rim
      }
      return { y: rim, crested };
    };
    const L = ridge(-1), R = ridge(1);
    const spill = L.y >= R.y ? L : R; // water escapes over the LOWER crest (the larger Y)
    // The limiting side must be a genuine crest within range: a broad open basin (rim beyond the
    // scan window) is rejected as dry rather than filled with drifting, non-flat water.
    if (!spill.crested || here - spill.y < WATER.MIN_DEPTH) return Infinity;
    const spillY = spill.y;

    // A carved river channel that actually pools counts as water; otherwise require the lake field so
    // most ordinary dips stay dry (no global ponding).
    const isRiver = this.riverCarve(worldX, this.layeredNoise.surfaceElevation(worldX)) > 1;
    if (!isRiver && this.noise.fbm2D(worldX * 0.0025 + 88, 3.1, 2) <= WATER.LAKE_FIELD_THRESHOLD) {
      return Infinity;
    }

    let level = spillY; // flush with the shoreline
    if (here - level > WATER.MAX_DEPTH) level = here - WATER.MAX_DEPTH;
    return level;
  }

  /** The bulk underground material for a position — the underground biome's stone/mud/ice/etc. */
  private stoneForDepth(worldX: number, worldY: number, surfaceBiome?: Biome): TileId {
    if (worldY >= BAND.UNDERWORLD) return TileId.Hellstone;
    return this.biomeSystem.undergroundBiomeAt(worldX, worldY, surfaceBiome).stoneVariant;
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
    const mouthOpenCache: number[] = new Array(CHUNK_SIZE); // tiles carved open for a cave mouth
    const chasmOpenCache: number[] = new Array(CHUNK_SIZE); // tiles carved open for an evil chasm
    const waterTopCache: number[] = new Array(CHUNK_SIZE); // water-surface Y per column (Infinity = dry)
    const beachCache: boolean[] = new Array(CHUNK_SIZE); // shore/bed column → sandy top
    const microBiomeCache: (ReturnType<typeof this.microBiomeSystem.checkForMicroBiome> | null)[] = new Array(CHUNK_SIZE);

    // Padded surface-height profile so the wide water-basin scan (and slope/beach lookups) read a
    // cached array instead of recomputing terrain noise. Covers the chunk plus SCAN_WIN + beach
    // radius on each side.
    const PAD = WATER.SCAN_WIN + BEACH.RADIUS;
    const shPad: number[] = new Array(CHUNK_SIZE + 2 * PAD);
    for (let k = 0; k < shPad.length; k++) shPad[k] = this.surfaceHeight(baseX - PAD + k);
    const heightAt = (x: number): number => shPad[x - baseX + PAD];

    // Water surface per column, computed once for the chunk plus a beach-radius margin so beach
    // neighbour lookups are just array reads. Indexed by (relative-x + BEACH.RADIUS).
    const waterTopExt: number[] = new Array(CHUNK_SIZE + 2 * BEACH.RADIUS);
    for (let e = 0; e < waterTopExt.length; e++) {
      waterTopExt[e] = this.waterTopAt(baseX + e - BEACH.RADIUS, heightAt);
    }

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const worldX = baseX + lx;
      let biome = this.biomeSystem.surfaceBiomeAt(worldX);

      // Apply biome modifiers
      biome = this.biomeModifierSystem.applyModifiers(biome, worldX, baseY, baseY);

      biomeCache[lx] = biome;
      surfaceHeightCache[lx] = shPad[lx + PAD];

      // Realistic stratigraphy: topsoil thins on steep slopes (erosion), and very steep faces
      // expose rock/gravel (talus) instead of the biome's soft top block.
      const slope = Math.abs(shPad[lx + PAD + 2] - shPad[lx + PAD - 2]);
      const jitter = Math.floor((this.noise.noise2D(worldX * 0.1, 7.7) + 1) * 2);
      dirtDepthCache[lx] = Math.max(1, biome.subSurfaceDepth + jitter - Math.floor(slope / 2.5));
      if (slope >= 10) topBlockCache[lx] = biome.stoneVariant;
      else if (slope >= 6) topBlockCache[lx] = TileId.Gravel;
      else topBlockCache[lx] = biome.topBlock;

      caveFloorCache[lx] = this.caveSystem.caveFloor(worldX, slope);
      // Cave mouth: the visible notch, extended down as a throat to meet an actual cave. A mouth is
      // only opened where it REACHES a cave within range — otherwise it would dead-end as a hole in
      // the ground, so we don't carve it at all.
      const notch = this.caveSystem.mouthOpening(worldX, slope);
      let mouthCarve = 0;
      if (notch > 0) {
        const surfaceY = surfaceHeightCache[lx];
        for (let d = notch; d <= CAVE.MOUTH_REACH; d++) {
          if (this.caveSystem.caveAt(worldX, surfaceY + d, biome.caveStyle)) { mouthCarve = d + 2; break; }
        }
      }
      mouthOpenCache[lx] = mouthCarve;
      chasmOpenCache[lx] = this.biomeSystem.evilChasmDepth(worldX);
      waterTopCache[lx] = waterTopExt[lx + BEACH.RADIUS];

      // Check for micro-biomes (coarse check per column)
      microBiomeCache[lx] = null; // Will be checked per-tile for precision
    }

    // Beaches: a column is sandy if it is a lake/river bed (underwater) or a dry shore whose ground
    // sits just above a nearby water level. All reads come from the cached water profile.
    const waterTopNear = (lx: number, k: number): number => waterTopExt[lx + k + BEACH.RADIUS];
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
        const wallMaterial = belowSurface < dirtDepth ? biome.subSurfaceBlock : this.stoneForDepth(worldX, worldY, biome);
        chunk.bg[ly * CHUNK_SIZE + lx] = naturalWall(wallMaterial);

        // Foreground material by depth and biome
        let fg: TileId;
        if (worldY === surfaceY) {
          fg = topBlockCache[lx];
        } else if (belowSurface < dirtDepth) {
          fg = biome.subSurfaceBlock;
        } else {
          fg = this.stoneForDepth(worldX, worldY, biome);
        }

        // Beach: the top band of shore/bed columns is sand.
        if (beachCache[lx] && belowSurface < BEACH.BED_DEPTH) {
          fg = TileId.Sand;
        }

        // Carve an organic cave mouth into steep hillsides (a rounded notch that connects to the
        // caves below via the lowered crust). Only at mouth sites on steep slopes — never flat ground.
        if (belowSurface < mouthOpenCache[lx]) {
          fg = TileId.Air;
        }

        // Carve caves below the crust; at a mouth the crust is 1, so the cave breaks into the notch.
        if (belowSurface >= caveFloorCache[lx] && this.caveSystem.caveAt(worldX, worldY, biome.caveStyle)) {
          fg = TileId.Air;
        }

        // Evil chasm: the corruption/crimson's signature vertical crevice descending from the surface.
        if (belowSurface < chasmOpenCache[lx]) {
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

        // Evil-biome underground features (embedded in solid evil stone): rare altars, plus glowing
        // shadow-orb / crimson-heart loot nodes. Each on its own lattice → deterministic single tiles.
        const evilCorrupt = biome.name === "corruption";
        if ((evilCorrupt || biome.name === "crimson") && fg !== TileId.Air && belowSurface >= 40) {
          // Altars (coarse lattice, mid-depth).
          const AL = 50;
          const acx = Math.floor(worldX / AL), acy = Math.floor(worldY / AL);
          if (belowSurface <= 200 && hash2(acx, acy, this.seed + 4800) < EVIL.ALTAR_CHANCE) {
            const axc = acx * AL + Math.floor(hash2(acx, acy, this.seed + 73) * AL);
            const ayc = acy * AL + Math.floor(hash2(acx, acy, this.seed + 74) * AL);
            if (worldX === axc && worldY === ayc) fg = evilCorrupt ? TileId.DemonAltar : TileId.CrimsonAltar;
          }
          // Shadow orbs / crimson hearts (finer lattice).
          const L = EVIL.ORB_LATTICE;
          const cxg = Math.floor(worldX / L), cyg = Math.floor(worldY / L);
          if (fg !== TileId.DemonAltar && fg !== TileId.CrimsonAltar && hash2(cxg, cyg, this.seed + 4700) < EVIL.ORB_CHANCE) {
            const ox = cxg * L + Math.floor(hash2(cxg, cyg, this.seed + 71) * L);
            const oy = cyg * L + Math.floor(hash2(cxg, cyg, this.seed + 72) * L);
            if (worldX === ox && worldY === oy) fg = evilCorrupt ? TileId.ShadowOrb : TileId.CrimsonHeart;
          }
        }

        chunk.fg[ly * CHUNK_SIZE + lx] = fg;
      }
    }

    // Underground-biome vegetation: where a mud-based underground biome (jungle / glowing mushroom)
    // meets cave air, grow its grass on the exposed face and hang/stand its plant in the air. Ice,
    // desert, marble and granite biomes are just their bulk material (placed above) — no grass.
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const worldX = baseX + lx;
      const biome = biomeCache[lx];
      for (let ly = 0; ly < CHUNK_SIZE; ly++) {
        const idx = ly * CHUNK_SIZE + lx;
        if (chunk.fg[idx] !== TileId.Mud) continue; // only mud-based UG biomes grow grass here
        const up = ly > 0 ? chunk.fg[idx - CHUNK_SIZE] : -1;
        const down = ly < CHUNK_SIZE - 1 ? chunk.fg[idx + CHUNK_SIZE] : -1;
        const left = lx > 0 ? chunk.fg[idx - 1] : -1;
        const right = lx < CHUNK_SIZE - 1 ? chunk.fg[idx + 1] : -1;
        if (up !== TileId.Air && down !== TileId.Air && left !== TileId.Air && right !== TileId.Air) continue;
        const ub = this.biomeSystem.undergroundBiomeAt(worldX, baseY + ly, biome);
        if (!ub.grass) continue;
        chunk.fg[idx] = ub.grass;
        if (ub.plant === TileId.Vines && down === TileId.Air) {
          const h = hash2(worldX, baseY + ly, this.seed + 321);
          if (h < 0.5) {
            chunk.fg[idx + CHUNK_SIZE] = TileId.Vines;
            if (ly + 2 < CHUNK_SIZE && chunk.fg[idx + 2 * CHUNK_SIZE] === TileId.Air && h < 0.2) {
              chunk.fg[idx + 2 * CHUNK_SIZE] = TileId.Vines;
            }
          }
        } else if (ub.plant === TileId.GlowMushroom && up === TileId.Air) {
          if (hash2(worldX, baseY + ly, this.seed + 654) < 0.4) chunk.fg[idx - CHUNK_SIZE] = TileId.GlowMushroom;
        }
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

    // The Dungeon: a large world-anchored structure overlaid last (takes priority over terrain). Each
    // tile is a pure function of world coords, so the footprint stamps identically across chunks/peers.
    if (this.dungeon.overlaps(baseX, baseY, baseX + CHUNK_SIZE - 1, baseY + CHUNK_SIZE - 1)) {
      for (let ly = 0; ly < CHUNK_SIZE; ly++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const t = this.dungeon.tileAt(baseX + lx, baseY + ly);
          if (t) {
            const idx = ly * CHUNK_SIZE + lx;
            chunk.fg[idx] = t.fg;
            chunk.bg[idx] = t.bg;
            chunk.liquid[idx] = 0; // dungeon interiors are dry
          }
        }
      }
    }

    return chunk;
  }
}
