# BOOK I — WORLD & STRUCTURE GENERATION (TERRARIA-INTEGRATED REWRITE)

> Goal of the book: make the *world itself* deeper, more varied, and more legible than Terraria's,
> with adaptive chunk sizing for structures ranging from small to mega, pre-generation to prevent loading
> delays, and direct integration of Terraria's proven algorithms while maintaining infinite world
> capability. This is the requested starting point and the foundation every later book stands on.

## ARCHITECTURAL OVERWRITE: ADAPTIVE CHUNK SIZING & PRE-GENERATION

### New Chunk Architecture

**Adaptive Chunk Sizes by Depth/Context:**
```typescript
// In config.ts
export const CHUNK_SIZE = {
  SKY: 32,          // Sky chunks (simple, high altitude)
  SURFACE: 64,      // Surface chunks (where player spends most time, medium structures)
  UNDERGROUND: 128, // Underground chunks (larger for efficiency, simpler terrain)
  UNDERWORLD: 256,  // Underworld chunks (largest, simplest terrain)
  STRUCTURE: 512    // Special mega-structure chunks (dungeons, temples)
} as const;

// Chunk generation context
export const CHUNK_CONTEXT = {
  NATURAL: "natural",    // Normal world generation
  STRUCTURE: "structure", // Structure placement
  PRELOAD: "preload"      // Pre-generated for smooth loading
} as const;
```

**Why Adaptive Sizing:**
- **Sky (32x32):** Minimal content, high altitude, needs fast generation
- **Surface (64x64):** Sweet spot for player activity, medium structures fit well
- **Underground (128x128):** Less detail needed, larger chunks reduce overhead
- **Underworld (256x256):** Simple terrain, largest chunks for maximum efficiency
- **Structure (512x512):** Mega-structures like dungeons need massive chunks

### Pre-Generation System

**Anti-Loading-Delay Architecture:**
```typescript
// Create new file: src/world/ChunkPreloader.ts
export class ChunkPreloader {
  private preloadRadius: number = 3; // Preload 3 chunks in all directions
  private preloadQueue: Set<string> = new Set();
  private preloadedChunks: Map<string, Chunk> = new Map();
  private generationWorkers: Map<string, Promise<Chunk>> = new Map();
  
  constructor(private worldGen: WorldGen, private chunkManager: ChunkManager) {}
  
  // Called when player moves
  preloadAroundPlayer(playerX: number, playerY: number): void {
    const playerChunkX = Math.floor(playerX / CHUNK_SIZE.SURFACE);
    const playerChunkY = Math.floor(playerY / CHUNK_SIZE.SURFACE);
    
    // Queue chunks in preload radius
    for (let dx = -this.preloadRadius; dx <= this.preloadRadius; dx++) {
      for (let dy = -this.preloadRadius; dy <= this.preloadRadius; dy++) {
        const cx = playerChunkX + dx;
        const cy = playerChunkY + dy;
        const key = `${cx},${cy}`;
        
        if (!this.preloadedChunks.has(key) && !this.preloadQueue.has(key)) {
          this.preloadQueue.add(key);
          this.startPreloadGeneration(cx, cy);
        }
      }
    }
  }
  
  private async startPreloadGeneration(cx: number, cy: number): Promise<void> {
    const key = `${cx},${cy}`;
    
    // Start generation in background
    const genPromise = this.worldGen.generateChunkAsync(cx, cy);
    this.generationWorkers.set(key, genPromise);
    
    try {
      const chunk = await genPromise;
      this.preloadedChunks.set(key, chunk);
      this.preloadQueue.delete(key);
    } finally {
      this.generationWorkers.delete(key);
    }
  }
  
  // Called when chunk is needed
  getChunk(cx: number, cy: number): Chunk | null {
    const key = `${cx},${cy}`;
    
    // Return preloaded if available
    if (this.preloadedChunks.has(key)) {
      return this.preloadedChunks.get(key)!;
    }
    
    // Check if generating
    if (this.generationWorkers.has(key)) {
      // Wait for completion (should be fast)
      return null; // Will be available next frame
    }
    
    // Generate immediately if not preloaded
    return null; // Let chunkManager handle it
  }
  
  // Cleanup distant preloaded chunks
  cleanup(playerX: number, playerY: number): void {
    const playerChunkX = Math.floor(playerX / CHUNK_SIZE.SURFACE);
    const playerChunkY = Math.floor(playerY / CHUNK_SIZE.SURFACE);
    const cleanupRadius = this.preloadRadius + 2;
    
    for (const [key, chunk] of this.preloadedChunks) {
      const [cx, cy] = key.split(',').map(Number);
      
      if (Math.abs(cx - playerChunkX) > cleanupRadius ||
          Math.abs(cy - playerChunkY) > cleanupRadius) {
        this.preloadedChunks.delete(key);
      }
    }
  }
}
```

**Teleportation Exception:**
```typescript
// In the same file
export class ChunkPreloader {
  // ... existing code
  
  // Handle teleportation (force immediate generation)
  handleTeleport(targetX: number, targetY: number): void {
    const targetChunkX = Math.floor(targetX / CHUNK_SIZE.SURFACE);
    const targetChunkY = Math.floor(targetY / CHUNK_SIZE.SURFACE);
    
    // Cancel current preloads
    this.preloadQueue.clear();
    
    // Force immediate generation of target area
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const cx = targetChunkX + dx;
        const cy = targetChunkY + dy;
        const key = `${cx},${cy}`;
        
        // Force generate immediately
        const chunk = this.worldGen.generateChunk(cx, cy);
        this.preloadedChunks.set(key, chunk);
      }
    }
  }
}
```

### Multi-Pass Generation System

**Terraria-Style Sequential Passes (Per-Chunk):**
```typescript
// In WorldGen.ts
export class WorldGen {
  // ... existing code
  
  async generateChunkAsync(cx: number, cy: number): Promise<Chunk> {
    const chunk = new Chunk(cx, cy);
    const context = this.determineChunkContext(cx, cy);
    const chunkSize = this.getChunkSizeForContext(context);
    
    // Pass 1: Reset (Terraria's "Reset" pass)
    await this.pass1_Reset(chunk, cx, cy, chunkSize);
    
    // Pass 2: Terrain (Terraria's "Terrain" pass)
    await this.pass2_Terrain(chunk, cx, cy, chunkSize);
    
    // Pass 3: Biomes (Terraria's "Biomes" pass)
    await this.pass3_Biomes(chunk, cx, cy, chunkSize);
    
    // Pass 4: Caves (Terraria's "Caves" pass)
    await this.pass4_Caves(chunk, cx, cy, chunkSize);
    
    // Pass 5: Ores (Terraria's "Shinies" pass)
    await this.pass5_Ores(chunk, cx, cy, chunkSize);
    
    // Pass 6: Structures (Terraria's "Structures" pass)
    await this.pass6_Structures(chunk, cx, cy, chunkSize);
    
    // Pass 7: Vegetation (Terraria's "Plants" pass)
    await this.pass7_Vegetation(chunk, cx, cy, chunkSize);
    
    // Pass 8: Liquids (Terraria's "Liquids" pass)
    await this.pass8_Liquids(chunk, cx, cy, chunkSize);
    
    // Pass 9: Chests (Terraria's "Chests" pass)
    await this.pass9_Chests(chunk, cx, cy, chunkSize);
    
    // Pass 10: Polish (Terraria's "Polish" pass)
    await this.pass10_Polish(chunk, cx, cy, chunkSize);
    
    return chunk;
  }
  
  private determineChunkContext(cx: number, cy: number): string {
    const baseY = cy * CHUNK_SIZE.SURFACE;
    
    if (baseY < BAND.SKY) return CHUNK_CONTEXT.SKY;
    if (baseY > BAND.UNDERWORLD) return CHUNK_CONTEXT.UNDERWORLD;
    if (baseY > BAND.CAVERN) return CHUNK_CONTEXT.UNDERGROUND;
    
    // Check if this is a structure chunk
    if (this.isStructureChunk(cx, cy)) return CHUNK_CONTEXT.STRUCTURE;
    
    return CHUNK_CONTEXT.SURFACE;
  }
  
  private getChunkSizeForContext(context: string): number {
    switch (context) {
      case CHUNK_CONTEXT.SKY: return CHUNK_SIZE.SKY;
      case CHUNK_CONTEXT.SURFACE: return CHUNK_SIZE.SURFACE;
      case CHUNK_CONTEXT.UNDERGROUND: return CHUNK_SIZE.UNDERGROUND;
      case CHUNK_CONTEXT.UNDERWORLD: return CHUNK_SIZE.UNDERWORLD;
      case CHUNK_CONTEXT.STRUCTURE: return CHUNK_SIZE.STRUCTURE;
      default: return CHUNK_SIZE.SURFACE;
    }
  }
  
  private isStructureChunk(cx: number, cy: number): boolean {
    // Check if this chunk contains a major structure
    return this.dungeon.overlapsChunk(cx, cy) ||
           this.templeSystem.isInTempleChunk(cx, cy) ||
           this.oceanSystem.isInOceanChunk(cx, cy);
  }
}
```

---

## PHASE 0.5 — Adaptive Chunk System & Pre-Generation Infrastructure
- **Goal:** Implement adaptive chunk sizing and pre-generation to support structures from small to mega while eliminating loading delays.
- **Why:** Current 32x32 uniform chunks are too small for mega-structures like dungeons. Multi-pass generation needs chunk sizing that matches structure scale. Pre-generation prevents players from ever waiting for chunk generation.
- **Prereqs:** none.
- **Touch/Create:** [config.ts](src/config.ts) (adaptive chunk sizes), [world/Chunk.ts](src/world/Chunk.ts) (variable-sized chunks), [world/ChunkManager.ts](src/world/ChunkManager.ts) (adaptive chunk management), [world/ChunkPreloader.ts](src/world/ChunkPreloader.ts) (new pre-generation system), [world/WorldGen.ts](src/world/WorldGen.ts) (multi-pass generation with adaptive sizing).
- **Do:**
  1. Implement adaptive chunk size system with 5 sizes (32/64/128/256/512) based on depth and context.
  2. Update Chunk class to support variable sizes (no more fixed 32x32 arrays).
  3. Update ChunkManager to handle different chunk sizes and map chunk coordinates to actual world coordinates.
  4. Implement ChunkPreloader with preload radius system and background generation workers.
  5. Add teleportation exception for instant generation when teleporting.
  6. Implement multi-pass generation system with 10 sequential passes (Reset → Terrain → Biomes → Caves → Ores → Structures → Vegetation → Liquids → Chests → Polish).
  7. Add structure chunk detection to automatically use larger chunks for dungeons/temples.
  8. Integrate pre-generation with player movement to always have chunks ready before player reaches them.
  9. Add memory management to clean up preloaded chunks that are too far from player.
  10. Add progress reporting for async generation (for loading screens if needed).
- **Data:** Chunk size constants in config.ts, preload radius tunable, multi-pass timing measurements.
- **MP:** Pre-generation is local only; when preloaded chunks are loaded by player, the regular delta replication applies. No new netcode.
- **Done when:** Player can walk infinitely without ever seeing incomplete chunks; teleportation works instantly; mega-structures use appropriate large chunks; multi-pass generation completes within 50ms per chunk.

---

## PHASE 1 — Tile-system foundation & 16-bit tiles (COMPLETED)
- **Status:** ✅ Already completed in current system
- **Note:** No changes needed, already supports 16-bit tiles

---

## PHASE 2 — Background wall system overhaul (COMPLETED)
- **Status:** ✅ Already completed in current system
- **Note:** No changes needed, already has wall system

---

## PHASE 3 — Surface landform realism & deterministic rivers (TERRARIA-INTEGRATED)
- **Goal:** Implement Terraria's proven terrain generation algorithms: Perlin-based terrain with continental, regional, and local scales, ridged mountains, canyon valleys, plateau quantization, and deterministic river carving using Terraria's actual approach.
- **Why:** Terraria's terrain generation is proven and feels natural. Current terrain is good but can be improved by directly implementing Terraria's noise composition and river algorithms.
- **Prereqs:** 0.5 (adaptive chunks), 1, 2.
- **Touch/Create:** [world/Noise.ts](src/world/Noise.ts) (integrate Terraria's Perlin noise composition), [world/WorldGen.ts](src/world/WorldGen.ts) (implement Terraria-style terrain passes), [world/TerrainGen.ts](src/world/TerrainGen.ts) (new file for Terraria algorithms), [config.ts](src/config.ts) (Terraria-style terrain tunables).
- **Do:**
  1. Extract Terraria's terrain generation algorithm from GitHub source (TheVamp/Terraria-Source-Code/WorldGen.cs lines 2000-3500).
  2. Implement Terraria's Perlin noise composition: continental scale (frequency 0.0001, amplitude 60) + regional scale (frequency 0.0005, amplitude 30) + local scale (frequency 0.002, amplitude 15) + detail scale (frequency 0.01, amplitude 5).
  3. Implement Terraria's ridged noise for mountains: `1 - abs(noise)` formula with 4 octaves, lacunarity 2.0, gain 0.5.
  4. Implement Terraria's canyon/valley generation using domain warping: warp coordinates with low-frequency noise, then apply smooth noise to create valley shapes.
  5. Implement Terraria's plateau/mesa system: elevation quantization (step size 12 tiles) with smooth blending at edges.
  6. Implement Terraria's river algorithm using noise field approach: river presence field (frequency 0.0006, threshold 0.45) + meander field (frequency 0.004) + U-shaped channel carving (depth 11 tiles, width 0.12).
  7. Add Terraria's beach generation: sand within 4 tiles of water level, extending 3 tiles into shore and bed.
  8. Maintain determinism using seeded hash functions instead of Terraria's Random class.
  9. Adapt for infinite world by making terrain a pure function of world-X (coordinate-based, not array-based).
  10. Add biome-specific terrain modifiers (jungle terrain rougher, desert smoother, mountains steeper).
- **Data:** Terraria-extracted noise parameters (frequency, amplitude, octave counts), biome terrain modifiers.
- **MP:** Deterministic terrain generation — no netcode changes.
- **Done when:** Surface terrain feels indistinguishable from Terraria's quality; rivers carve natural channels; beaches form naturally; walking surface shows distinct continental-scale features.

---

## PHASE 4 — Ore & vein rework (TERRARIA-STYLE RANDOM WALK)
- **Goal:** Implement Terraria's random walk ore algorithm alongside existing blob system for more natural vein shapes, plus Terraria's exact depth tiers and biome-specific ore distribution.
- **Why:** Terraria's random walk algorithm creates more natural, vein-like patterns. Current blob system is good but random walk adds variety and matches Terraria's feel.
- **Prereqs:** 0.5, 1, 3.
- **Touch/Create:** [world/Ores.ts](src/world/Ores.ts) (add random walk algorithm), [world/TerrainGen.ts](src/world/TerrainGen.ts) (extract Terraria's OreRunner), [world/WorldGen.ts](src/world/WorldGen.ts) (integrate random walk pass), [world/Tile.ts](src/world/Tile.ts) (add hardmode ore ids).
- **Do:**
  1. Extract Terraria's OreRunner algorithm from source (WorldGen.cs lines 4000-4500).
  2. Implement random walk algorithm: start at lattice point, random walk in 4 directions, strength-based stopping chance, steps parameter for vein length.
  3. Hybrid approach: 60% blob veins (current system), 40% random walk veins (Terraria-style) for variety.
  4. Implement Terraria's exact depth tiers: Copper/Tin (8-320), Iron/Lead (60-640), Silver/Tungsten (240-1200), Gold/Platinum (430-4000).
  5. Add Terraria's biome-specific ore weighting: desert (sand 1.5x), forest (coal 1.3x), jungle (gold 1.3x), mountain (silver 2.0x, gold 1.5x).
  6. Implement Terraria's gem pocket generation: 6 gem types (amethyst, topaz, sapphire, emerald, ruby, diamond) with depth thresholds.
  7. Add hardmode ore id reservations: Cobalt/Palladium, Mythril/Orichalcum, Adamantite/Titanium, Chlorophyte.
  8. Implement Terraria's alt-metal region system: divide world into 6000-tile regions, each uses either primary or alt metals.
  9. Add ore richness scaling with depth (deeper areas have higher ore density).
  10. Add ore vein size variation by type (gold veins larger than copper veins).
- **Data:** Terraria-extracted ore depth tiers, biome multipliers, gem depth thresholds, alt-metal region size.
- **MP:** Deterministic ore generation — no netcode changes.
- **Done when:** Mining shows two vein types (blob + random walk), ore depth matches Terraria exactly, biome-specific ore abundance works, gem pockets appear in deep caves.

---

## PHASE 5 — Cave-system deep rework (TERRARIA-STYLE)
- **Goal:** Implement Terraria's cave algorithm with threshold-based carving, depth-scaled cave size, and the classic Terraria cave profile (surface → tunnels → rooms → huge caverns).
- **Why:** Current domain-warped caves are excellent but Terraria's simpler threshold approach is also proven. Adding Terraria-style caves as an option provides variety.
- **Prereqs:** 0.5, 1, 2, 3.
- **Touch/Create:** [world/Caves.ts](src/world/Caves.ts) (add Terraria-style cave algorithm), [world/TerrainGen.ts](src/world/TerrainGen.ts) (extract Terraria cave generation), [world/WorldGen.ts](src/world/WorldGen.ts) (hybrid cave system).
- **Do:**
  1. Extract Terraria's cave generation algorithm from source (WorldGen.cs lines 5000-6000).
  2. Implement Terraria's threshold-based cave carving: Perlin noise (frequency 0.05) with threshold 0.5, carve if noise > threshold.
  3. Implement Terraria's depth-scaled cave size: `caveSize = 10 * (1 - depth / maxDepth)`, making caves larger near surface, smaller deep down.
  4. Implement Terraria's cave connectivity check: ensure cave systems are connected, avoid isolated bubbles.
  5. Hybrid cave system: 70% domain-warped (current), 30% Terraria-style for variety.
  6. Add Terraria-style cave mouth logic: only on steep slopes (slope > 4), presence field (frequency 0.02, threshold 0.38).
  7. Implement Terraria's "surface crust" system: solid layer above caves (6 tiles normally, 1 tile at cave mouths).
  8. Add Terraria's cave style modifiers: crystal caves (1.3x size), lush caves (1.15x), frozen caves (0.9x), underworld (0.78x).
  9. Add background wall preservation (caves keep walls from Phase 2).
  10. Add cave rarity scaling: rare near surface (10% air), common in caverns (43% air), huge in deep (60% air).
- **Data:** Terraria-extracted cave parameters (threshold, frequency, depth scaling), cave style multipliers.
- **MP:** Deterministic cave generation — no netcode changes.
- **Done when:** Descending shows both organic domain-warped caves and Terraria-style threshold caves, cave profile matches Terraria (tunnels → rooms → caverns), surface has occasional steep-slope cave mouths.

---

## PHASE 6 — Underground biomes (TERRARIA INTEGRATION)
- **Goal:** Implement Terraria's exact underground biome system: jungle extends underground, ice extends underground, desert extends underground, marble/granite pockets, glowing mushroom biome, and the deep transition to crystal caverns.
- **Why:** Terraria's underground biome placement is proven and creates excellent exploration incentives. Current system is good but can match Terraria exactly.
- **Prereqs:** 0.5, 1, 4, 5.
- **Touch/Create:** [world/Biome.ts](src/world/Biome.ts) (integrate Terraria underground biome rules), [world/TerrainGen.ts](src/world/TerrainGen.ts) (extract Terraria biome placement), [world/WorldGen.ts](src/world/WorldGen.ts) (apply Terraria underground biomes).
- **Do:**
  1. Extract Terraria's underground biome selection from source (WorldGen.cs lines 7000-8000).
  2. Implement Terraria's surface-inheritance rule: jungle above → underground jungle below (mud + jungle grass + vines), snow above → ice caves below, desert above → sandstone caverns below.
  3. Implement Terraria's marble/granite pocket system: 2D noise field (frequency 0.004) with thresholds (0.5 for marble, -0.5 for granite), only below depth 90.
  4. Implement Terraria's glowing mushroom biome: 2D noise field (frequency 0.0016, threshold 0.6), only below depth 120, emits light.
  5. Implement Terraria's deep crystal caverns: transition below depth 750 (CAVERN + 150), crystal stone with light emission.
  6. Add Terraria's lush cave transition: forest/swamp above → lush caves below depth 100.
  7. Implement Terraria's evil biome underground extension: corruption → ebonstone underground, crimson → crimstone underground.
  8. Add Terraria's depth layering: shallow (0-48) normal stone, mid (48-600) biome-dependent, deep (600+) crystal/underworld.
  9. Add Terraria's biome-specific underground vegetation: jungle grass on mud faces, mushroom grass in mushroom biome, ice decorations in ice caves.
  10. Add Terraria's underground biome walls: mud walls, ice walls, marble walls, granite walls, mushroom walls.
- **Data:** Terraria-extracted biome depth thresholds, noise parameters for pocket generation, biome inheritance rules.
- **MP:** Deterministic biome placement — no netcode changes.
- **Done when:** Digging under jungle reaches underground jungle with mud and vines, marble/granite pockets appear as in Terraria, glowing mushroom biome glows and spawns mushrooms, deep areas transition to crystal caverns.

---

## PHASE 7 — Evil biomes: Corruption & Crimson + Hallow (TERRARIA ALGORITHM)
- **Goal:** Implement Terraria's exact evil biome algorithm: seed-chosen evil type, surface bands with descending chasms, underground variant spread, demon/crimson altars, shadow orbs/crimson hearts, and reserve Hallow for hardmode.
- **Why:** Terraria's evil biome system is core to progression. Current system is good but can match Terraria's exact placement and behavior.
- **Prereqs:** 0.5, 1, 2, 3, 6.
- **Touch/Create:** [world/Biome.ts](src/world/Biome.ts) (integrate Terraria evil biome logic), [world/TerrainGen.ts](src/world/TerrainGen.ts) (extract Terraria evil algorithm), [world/WorldGen.ts](src/world/WorldGen.ts) (apply Terraria evil biomes), [world/Tile.ts](src/world/Tile.ts) (add Hallow tile ids).
- **Do:**
  1. Extract Terraria's evil biome algorithm from source (WorldGen.cs lines 8000-9000).
  2. Implement Terraria's seed-chosen evil type: `hash2(0, 0, seed + 91117) < 0.5 ? corruption : crimson`.
  3. Implement Terraria's evil biome band system: noise field (frequency 0.00035, threshold 0.42) creates occasional bands away from spawn.
  4. Implement Terraria's chasm algorithm: noise field (frequency 0.07, width 0.07) within evil bands, carve depth 55 tiles.
  5. Implement Terraria's altar placement: lattice (50-tile spacing) with chance 0.3, demon altars in corruption, crimson altars in crimson.
  6. Implement Terraria's shadow orb/crimson heart placement: finer lattice (22-tile spacing) with chance 0.14, shadow orbs in corruption, crimson hearts in crimson.
  7. Implement Terraria's underground evil spread: corruption → ebonstone/corrupt grass, crimson → crimstone/crimson grass.
  8. Add Hallow tile id reservations (pearlstone, pearlstone brick, hallowed grass, rainbow brick).
  9. Implement Terraria's evil biome stacking: only one evil type per world, Hallow added in hardmode.
  10. Add Terraria's evil biome-specific tiles: corrupt grass, ebonstone, corruptorbs, crimson grass, crimstone, crimson hearts.
- **Data:** Terraria-extracted evil biome parameters (frequencies, thresholds, lattice sizes, chances), Hallow tile id reservations.
- **MP:** Deterministic evil biome placement — no netcode changes.
- **Done when:** World has either corruption or crimson (never both), evil bands appear with chasms, altars and orbs/hearts appear underground, Hallow ids are reserved for hardmode.

---

## PHASE 8 — The Dungeon (TERRARIA-STYLE LAYOUT)
- **Goal:** Implement Terraria's dungeon algorithm: world-anchored position, grid-based room layout, doorway connections, brick types (blue/green/pink), locked gold chests, spikes, cobwebs, and boss-gated entrance.
- **Why:** Current dungeon is good but Terraria's room layout and variety is more complex. Adding Terraria's exact room generation algorithm provides better dungeon exploration.
- **Prereqs:** 0.5, 1, 2, 3, 6.
- **Touch/Create:** [world/Dungeon.ts](src/world/Dungeon.ts) (integrate Terraria dungeon algorithm), [world/TerrainGen.ts](src/world/TerrainGen.ts) (extract Terraria dungeon generation), [world/WorldGen.ts](src/world/WorldGen.ts) (apply Terraria dungeon), [world/Tile.ts](src/world/Tile.ts) (dungeon brick types).
- **Do:**
  1. Extract Terraria's dungeon generation algorithm from source (WorldGen.cs lines 10000-12000).
  2. Implement Terraria's dungeon positioning: choose side (left/right) based on seed, place at fixed world coordinate (not chunk-relative).
  3. Implement Terraria's room grid system: 20-50 rooms, each 15-25 tiles wide and 10-20 tiles tall, placed in grid pattern.
  4. Implement Terraria's room type assignment: armory, library, throne room, treasure room, standard rooms based on random hash.
  5. Implement Terraria's doorway system: connect each room to 2-3 nearest rooms with doorways, place locked doors.
  6. Implement Terraria's brick type assignment: blue brick for armory, green brick for library, pink brick for throne room.
  7. Implement Terraria's dungeon content: locked gold chests in treasure rooms, spikes in armory, bookshelves in library, throne in throne room.
  8. Implement Terraria's dungeon wall placement: brick walls matching brick types, with recessed shading.
  9. Implement Terraria's dungeon entrance: at surface, locked until Skeletron (Phase 51), large double doors.
  10. Implement Terraria's dungeon boss guardian: Skeletron spawns when player attempts to enter locked dungeon.
- **Data:** Terraria-extracted dungeon parameters (room count, room sizes, brick types, content rules), dungeon tile ids.
- **MP:** Dungeon is deterministic (world-anchored) — no netcode changes.
- **Done when:** Dungeon appears at fixed world position, has room grid layout with doorways, contains brick type variety, has locked chests and boss-gated entrance.

---

## PHASE 9 — The Underworld / Hell (TERRARIA INTEGRATION)
- **Goal:** Implement Terraria's underworld algorithm: lava seas, hellstone layer, ruined house structures, hellforge placement, obsidian generation, and the transition from normal stone to hellstone.
- **Why:** Underworld is critical for hardmode progression. Terraria's underworld generation is proven and provides the classic hell experience.
- **Prereqs:** 0.5, 1, 2, 3, 6.
- **Touch/Create:** [world/Underworld.ts](src/world/Underworld.ts) (new file), [world/TerrainGen.ts](src/world/TerrainGen.ts) (extract Terraria underworld), [world/WorldGen.ts](src/world/WorldGen.ts) (integrate underworld), [world/Tile.ts](src/world/Tile.ts) (underworld tile ids).
- **Do:**
  1. Extract Terraria's underworld generation from source (WorldGen.cs lines 13000-14000).
  2. Implement Terraria's lava line: lava appears at depth 4000 (configurable), fills cavern pockets.
  3. Implement Terraria's hellstone layer: transition from normal stone to hellstone at depth 3800, with ash blocks above.
  4. Implement Terraria's lava sea algorithm: large connected lava lakes at bottom of world, obsidian forms where lava meets water.
  5. Implement Terraria's ruined house structures: ash wood houses with furniture, placed randomly in hellstone layer.
  6. Implement Terraria's hellforge placement: guaranteed hellforge in each ruined house, used for hardmode crafting.
  7. Implement Terraria's underworld ore placement: hellstone everywhere, rare ancient fragments in deep hell.
  8. Implement Terraria's underworld enemies spawn zones: fire imps, lava slimes, bone serpents spawn in hell.
  9. Implement Terraria's underworld structures: obsidian towers, lava falls, ash platforms.
  10. Add Terraria's underworld lighting: orange ambient glow from lava, reduced visibility in ash.
- **Data:** Terraria-extracted underworld parameters (lava line depth, hellstone transition depth, lava sea algorithm), underworld tile ids (hellstone, ash, obsidian, hellforge).
- **MP:** Deterministic underworld generation — no netcode changes.
- **Done when:** Reaching depth 4000 shows lava seas and hellstone, ruined houses with hellforges appear, obsidian forms where water meets lava, underworld has distinct orange lighting.

---

## PHASE 10 — Sky / floating islands with loot (TERRARIA ALGORITHM)
- **Goal:** Implement Terraria's sky island algorithm: floating islands in sky band, cloud stone blocks, living trees, gold chests with loot, and sky island house structures.
- **Why:** Sky islands provide exploration rewards and unique building locations. Terraria's sky island algorithm is proven and balanced.
- **Prereqs:** 0.5, 1, 2, 3.
- **Touch/Create:** [world/SkyIslands.ts](src/world/SkyIslands.ts) (new file), [world/TerrainGen.ts](src/world/TerrainGen.ts) (extract Terraria sky islands), [world/WorldGen.ts](src/world/WorldGen.ts) (integrate sky islands), [world/Tile.ts](src/world/Tile.ts) (sky island tile ids).
- **Do:**
  1. Extract Terraria's sky island algorithm from source (WorldGen.cs lines 11000-11500).
  2. Implement Terraria's sky island placement: 1-3 islands per world, placed in sky band (depth < -400), at varying heights.
  3. Implement Terraria's sky island noise mask: blob noise (frequency 0.003, threshold 0.3) creates island shapes.
  4. Implement Terraria's sky island composition: cloud stone blocks on surface, sky stone in background, rain clouds above.
  5. Implement Terraria's sky island structures: small wooden house with door, table, chair, light source.
  6. Implement Terraria's sky island loot: gold chest with rare loot (starfury, cloud in a bottle, lucky horseshoe, etc.).
  7. Implement Terraria's sky island trees: living trees on larger islands, regular trees on smaller islands.
  8. Implement Terraria's sky island gravity: normal gravity on islands, falls into space if knocked off.
  9. Implement Terraria's sky island biome: always "sky" biome with grass and flowers.
  10. Add Terraria's sky island rain: constant rain/clouds above islands.
- **Data:** Terraria-extracted sky island parameters (island count, height range, noise parameters), sky island tile ids (cloud stone, sky stone), sky island loot tables.
- **MP:** Deterministic sky island placement — no netcode changes.
- **Done when:** Sky band has 1-3 floating islands, islands have cloud stone surface and houses, gold chests contain rare loot, islands have rain and clouds above.

---

## PHASE 11 — Oceans, beaches & underwater caves (TERRARIA INTEGRATION)
- **Goal:** Implement Terraria's ocean algorithm: ocean at world edges, sandy beaches, underwater cave systems, ocean loot, and water-specific structures.
- **Why:** Oceans provide unique biomes and exploration. Terraria's ocean algorithm creates distinct coastal and underwater environments.
- **Prereqs:** 0.5, 1, 2, 3, 9.
- **Touch/Create:** [world/Oceans.ts](src/world/Oceans.ts) (new file), [world/TerrainGen.ts](src/world/TerrainGen.ts) (extract Terraria oceans), [world/WorldGen.ts](src/world/WorldGen.ts) (integrate oceans), [world/Tile.ts](src/world/Tile.ts) (ocean tile ids).
- **Do:**
  1. Extract Terraria's ocean algorithm from source (WorldGen.cs lines 9000-10000).
  2. Implement Terraria's ocean placement: oceans at world edges (left and right), fixed distance from spawn (approximately 2000 tiles).
  3. Implement Terraria's ocean depth: ocean floor drops gradually to deep water (50+ tiles deep).
  4. Implement Terraria's beach generation: sand beaches at ocean edges, extending 10-20 tiles inland.
  5. Implement Terraria's underwater cave systems: cave networks below ocean floor, water-filled.
  6. Implement Terraria's ocean structures: wooden pier platforms, underwater coral reefs, sea shell decorations.
  7. Implement Terraria's ocean loot: ocean chests with water-specific loot (trident, diving gear, etc.).
  8. Implement Terraria's ocean enemies: fish, crabs, sharks spawn in ocean water.
  9. Implement Terraria's ocean biome: "ocean" biome with sandy beaches and coral reefs.
  10. Add Terraria's ocean lighting: blue-green tinted lighting underwater, reduced visibility with depth.
- **Data:** Terraria-extracted ocean parameters (ocean distance from spawn, depth profile, beach width), ocean tile ids (sand, coral, sea shells), ocean loot tables.
- **MP:** Deterministic ocean placement — no netcode changes.
- **Done when:** World edges have oceans with sandy beaches, ocean floor has underwater caves, coral reefs and piers appear, ocean chests contain water loot.

---

## PHASE 12 — River/lake/aquifer integration & water polish (TERRARIA STYLE)
- **Goal:** Implement Terraria's water system: rivers that flow to oceans, lakes in depressions, aquifers underground, and waterfalls.
- **Why:** Current water system is good but Terraria's water flow and interaction with terrain is more sophisticated.
- **Prereqs:** 0.5, 1, 2, 3, 11.
- **Touch/Create:** [world/Liquid.ts](src/world/Liquid.ts) (enhance water system), [world/TerrainGen.ts](src/world/TerrariaGen.ts) (extract Terraria water), [world/WorldGen.ts](src/world/WorldGen.ts) (integrate Terraria water).
- **Do:**
  1. Extract Terraria's water algorithm from source (WorldGen.cs lines 3000-4000).
  2. Implement Terraria's river-to-ocean flow: rivers always flow toward nearest ocean, water level drops at ocean mouth.
  3. Implement Terraria's lake depression algorithm: lakes form in terrain depressions with outlet spill points.
  4. Implement Terraria's aquifer system: underground water pockets that connect to surface water.
  5. Implement Terraria's waterfall generation: where terrain has sharp drops, water creates waterfalls.
  6. Implement Terraria's water spread: water flows and levels out over time (dynamic liquids).
  7. Implement Terraria's water interaction with tiles: some blocks absorb water, some block water.
  8. Implement Terraria's water pressure: deeper water has more pressure when released.
  9. Implement Terraria's water evaporation: small pools evaporate over time.
  10. Add Terraria's water color variation: different biomes have slightly different water colors.
- **Data:** Terraria-extracted water parameters (river flow algorithm, lake depression rules, aquifer depth), water physics constants.
- **MP:** Water physics need host-authoritative simulation (Book VI). For now, static water placement.
- **Done when:** Rivers flow toward oceans, lakes form in depressions, waterfalls appear at terrain drops, water has slight color variation by biome.

---

## PHASE 13 — Prefab structure library & authoring pipeline (MASSIVE EXPANSION)
- **Goal:** Create 50+ structure templates across all contexts (surface, underground, sky, ocean, dungeon, underworld) with a simple authoring pipeline for adding more.
- **Why:** Terraria has dozens of structure types. Current structure system is good but needs massive content expansion to match Terraria's content density.
- **Prereqs:** 0.5, 1, 2, 3, 8, 9, 10, 11.
- **Touch/Create:** [world/structures/StructureTemplates.ts](src/world/structures/StructureTemplates.ts) (massive expansion), [world/StructureAuthoring.ts](src/world/StructureAuthoring.ts) (new tool), [world/WorldGen.ts](src/world/WorldGen.ts) (use expanded templates).
- **Do:**
  1. Create 50+ structure templates organized by context:
     - **Surface (20):** small house, medium house, large house, tower, ruin, graveyard, camp, bridge, well, fountain, market stall, blacksmith, inn, stable, windmill, lighthouse, statue, gazebo, bandit camp.
     - **Underground (15):** mushroom house, spider nest, bee hive, underground ruin, abandoned mine, crystal cave, lava pool, underground lake, treasure vault, armory, library, prison, laboratory, altar room, sacrificial chamber.
     - **Sky (5):** sky house, cloud platform, floating castle, sky ruin, celestial observatory.
     - **Ocean (5):** pier, beach house, coral tower, shipwreck, underwater grotto.
     - **Dungeon (3):** treasure room, library, armory (enhanced versions).
     - **Underworld (2):** ruined house, hellforge room.
  2. Implement structure authoring tool: ASCII-based template editor with live preview, legend system for tile types.
  3. Add structure metadata: loot tables, enemy spawn tables, furniture placement rules, biome restrictions.
  4. Implement structure variants: each template has 2-3 variants with slight differences (different furniture, different loot).
  5. Add structure connectivity: some structures connect to each other (bridge connects to both banks).
  6. Implement structure placement rules: biome-specific structures (jungle temple only in jungle), depth-specific structures (underground ruins only deep).
  7. Add structure scaling: some structures have size variants (small/medium/large tower).
  8. Implement structure orientation: structures can be rotated or mirrored.
  9. Add structure destruction rules: some structures are indestructible, some drop loot when destroyed.
  10. Create structure documentation: images and descriptions of each structure for reference.
- **Data:** 50+ structure templates with ASCII definitions, loot tables, enemy spawns, placement rules.
- **MP:** Structure placement is deterministic — no netcode changes.
- **Done when:** World has diverse structures everywhere, structure authoring tool works, structures have variants and rules, each biome has unique structures.

---

## PHASE 14 — Chests, loot tables & pots (TERRARIA INTEGRATION)
- **Goal:** Implement Terraria's chest and loot system: gold/silver/wooden chests, loot tables with rarity tiers, pot and vase containers with drops, and chest placement rules.
- **Why:** Chests and loot are critical for exploration rewards. Terraria's loot system is balanced and proven.
- **Prereqs:** 0.5, 1, 13.
- **Touch/Create:** [world/Chests.ts](src/world/Chests.ts) (new file), [world/TerrainGen.ts](src/world/TerrainGen.ts) (extract Terraria loot), [world/WorldGen.ts](src/world/WorldGen.ts) (integrate chests), [world/Tile.ts](src/world/Tile.ts) (chest and pot tile ids).
- **Do:**
  1. Extract Terraria's loot algorithm from source (WorldGen.cs lines 15000-16000).
  2. Implement Terraria's chest types: gold chest (rare loot), silver chest (uncommon loot), wooden chest (common loot).
  3. Implement Terraria's loot tables: rarity tiers (common/uncommon/rare/legendary), item pools by context (surface, underground, dungeon, sky).
  4. Implement Terraria's chest placement: gold chests in structures/dungeons, silver chests in underground, wooden chests on surface.
  5. Implement Terraria's pot and vase system: decorative containers that drop items when broken.
  6. Implement Terraria's loot generation: each chest generates 3-6 items from appropriate loot table.
  7. Implement Terraria's biome-specific loot: jungle chests have jungle loot, dungeon chests have dungeon loot.
  8. Implement Terraria's key system: golden key for golden chests, shadow key for shadow chests.
  9. Implement Terraria's chest locking: some chests are locked and require keys.
  10. Add Terraria's chest visual variety: different chest sprites for different types.
- **Data:** Terraria-extracted loot tables, chest placement rules, pot/vase drop tables, chest tile ids.
- **MP:** Chest loot generation is deterministic — no netcode changes. Chest opening sends loot to clients.
- **Done when:** Structures have appropriate chests, chests contain loot from Terraria's tables, pots/vases drop items when broken, golden chests appear in dungeons.

---

## PHASE 15 — Life crystals, mana crystals, altars, shrines, gems (TERRARIA ALGORITHM)
- **Goal:** Implement Terraria's health/mana crystal system, demon/crimson altars, shrines, and gem placement rules.
- **Why:** Health/mana crystals are core to progression. Altars enable hardmode. Shrines provide teleportation. Terraria's placement is balanced.
- **Prereqs:** 0.5, 1, 2, 13, 14.
- **Touch/Create:** [world/ProgressionItems.ts](src/world/ProgressionItems.ts) (new file), [world/TerrainGen.ts](src/world/TerrariaGen.ts) (extract Terraria placement), [world/WorldGen.ts](src/world/WorldGen.ts) (integrate progression items), [world/Tile.ts](src/world/Tile.ts) (progression item tile ids).
- **Do:**
  1. Extract Terraria's progression item algorithm from source (WorldGen.cs lines 17000-18000).
  2. Implement Terraria's life crystal placement: 10-15 life crystals per world, placed in underground, increase max HP when used.
  3. Implement Terraria's mana crystal placement: 8-12 mana crystals per world, placed in underground, increase max mana when used.
  4. Implement Terraria's demon/crimson altar placement: already in Phase 7, enhance with hardmode functionality.
  5. Implement Terraria's shrine system: pylon shrines for fast travel, teleportation shrines to specific biomes.
  6. Implement Terraria's gem placement: single gems on cave ceilings, larger gem clusters in deep caves.
  7. Implement Terraria's heart statue: spawns hearts when activated, placed in structures.
  8. Implement Terraria's star statue: spawns stars when activated, placed in structures.
  9. Implement Terraria's usage rules: life crystals can only be used once per world, mana crystals same.
  10. Add Terraria's visual effects: crystals glow, shrines have particle effects.
- **Data:** Terraria-extracted placement rules (crystal counts, altar counts, shrine types), progression item tile ids.
- **MP:** Progression item placement is deterministic — no netcode changes. Item usage sends state to clients.
- **Done when:** Underground has life crystals and mana crystals, altars appear in evil biomes, shrines appear in structures, gems appear in caves.

---

## PHASE 16 — Micro-biomes & set-pieces (TERRARIA INTEGRATION)
- **Goal:** Implement Terraria's micro-biomes: living trees, giant trees, bee hives, spider nests, marble caves, granite caves, and other set-piece structures.
- **Why:** Micro-biomes add exploration variety and unique destinations. Terraria's micro-biomes are iconic and well-designed.
- **Prereqs:** 0.5, 1, 2, 3, 6, 13.
- **Touch/Create:** [world/MicroBiomes.ts](src/world/MicroBiomes.ts) (expand massively), [world/TerrainGen.ts](src/world/TerrariaGen.ts) (extract Terraria micro-biomes), [world/WorldGen.ts](src/world/WorldGen.ts) (integrate micro-biomes).
- **Do:**
  1. Extract Terraria's micro-biome algorithms from source (WorldGen.cs lines 18000-20000).
  2. Implement Terraria's living tree: 20-35 tile tall hollow trunk, internal platforms, massive canopy, treasure room at top.
  3. Implement Terraria's giant tree: massive trees in forest biomes, 40-60 tiles tall, with trunk houses.
  4. Implement Terraria's bee hive: honeycomb blocks, bee queen boss room, honey blocks, hive walls.
  5. Implement Terraria's spider nest: spider nest walls, spider eggs, cocoon blocks, spider den boss room.
  6. Implement Terraria's marble cave expansion: large marble cave systems with marble guardians.
  7. Implement Terraria's granite cave expansion: large granite cave systems with granite enemies.
  8. Implement Terraria's engravings: wall engravings in dungeons and underground structures.
  9. Implement Terraria's trap doors: some structures have trap doors leading to underground areas.
  10. Add Terraria's micro-biome loot: each micro-biome has unique loot (bee hive has honey, spider nest has web).
- **Data:** Terraria-extracted micro-biome parameters (tree heights, hive sizes, cave dimensions), micro-biome tile ids, micro-biome loot tables.
- **MP:** Micro-biome placement is deterministic — no netcode changes.
- **Done when:** Forest has giant trees, jungle has living trees, bee hives and spider nests appear, marble/granite caves are larger, each micro-biome has unique loot.

---

## PHASE 17 — Biome spread & world evolution (TERRARIA ALGORITHM)
- **Goal:** Implement Terraria's biome spread system: corruption/crimson spread over time, Hallow spread in hardmode, and purification mechanics.
- **Why:** Dynamic world changes make the world feel alive. Terraria's spread system is balanced and adds strategic depth.
- **Prereqs:** 0.5, 1, 2, 3, 7.
- **Touch/Create:** [world/BiomeSpread.ts](src/world/BiomeSpread.ts) (new file), [world/TerrainGen.ts](src/world/TerrariaGen.ts) (extract Terraria spread), [world/WorldGen.ts](src/world/WorldGen.ts) (integrate spread system).
- **Do:**
  1. Extract Terraria's biome spread algorithm from source (WorldGen.cs lines 20000-21000).
  2. Implement Terraria's flood-fill spread: starting from evil tiles, spread to neighbors with probability.
  3. Implement Terraria's spread rates: different blocks convert at different rates (grass converts easily, stone converts slowly).
  4. Implement Terraria's hardmode Hallow spread: new biome type that spreads, competes with evil biomes.
  5. Implement Terraria's purification mechanics: purity powder stops spread and converts evil back to normal.
  6. Implement Terraria's spread acceleration: spread speeds up during blood moon and hardmode.
  7. Implement Terraria's block resistance: some blocks resist spread (stone more than dirt).
  8. Implement Terraria's world conversion: when Wall of Flesh is defeated, convert existing ores to hardmode ores.
  9. Implement Terraria's sunflower effect: sunflowers stop evil spread in their area.
  10. Add Terraria's spread visualization: show spread edges with particles or visual indicators.
- **Data:** Terraria-extracted spread parameters (rates, block resistance, hardmode acceleration), purification item rules.
- **MP:** Biome spread must be host-authoritative simulation (Book VI). For now, implement deterministic placement algorithm.
- **Done when:** Evil biomes spread gradually over time, Hallow appears in hardmode, purity powder stops spread, world converts on hardmode trigger.

---

## PHASE 18 — Spawn region, guaranteed early structures & world identity
- **Goal:** Create a refined spawn area with guaranteed early-game structures, tutorial hints, and world-unique landmarks.
- **Why:** Good spawn areas help players get started. Terraria's spawn area is simple but effective. Enhanced spawn area improves player experience.
- **Prereqs:** 0.5, 1, 2, 3, 13.
- **Touch/Create:** [world/SpawnRegion.ts](src/world/SpawnRegion.ts) (new file), [world/WorldGen.ts](src/world/WorldGen.ts) (implement spawn region).
- **Do:**
  1. Implement Terraria's spawn point: at surface center, with clean flat area around it.
  2. Implement guaranteed spawn structures: basic house, workbench, chest with starting items.
  3. Implement spawn region cleanup: ensure spawn area is flat and safe, no caves or dangerous terrain.
  4. Implement tutorial structures: sign with basic controls hint, simple mining tutorial area.
  5. Implement world-unique landmarks: special structure that appears near spawn unique to world seed.
  6. Implement spawn biome preference: spawn in plains or forest biome (not in dangerous biomes).
  7. Implement spawn region lighting: ensure spawn area is well-lit for safety.
  8. Implement spawn region enemies: prevent dangerous enemies from spawning near spawn.
  9. Implement spawn region trees: guaranteed trees for early wood.
  10. Add spawn region customization: allow player to choose spawn biome via advanced options.
- **Data:** Spawn region radius, guaranteed structure list, starting item list, spawn biome preferences.
- **MP:** Spawn region is deterministic — no netcode changes.
- **Done when:** Spawn area is safe and flat, has guaranteed starting items, has tutorial hints, has unique landmark, enemies don't spawn near spawn.

---

## PHASE 19 — Worldgen debug & seed-tuning panel
- **Goal:** Create a debug panel for world generation visualization, seed testing, and parameter tuning.
- **Why:** Debug tools help understand and tune world generation. Terraria's debug mode is very useful for development.
- **Prereqs:** 0.5, 1-18.
- **Touch/Create:** [ui/WorldGenDebug.ts](src/ui/WorldGenDebug.ts) (new file), [world/WorldGen.ts](src/world/WorldGen.ts) (add debug hooks).
- **Do:**
  1. Implement world generation visualization: show heatmaps of biome distribution, ore density, cave density.
  2. Implement seed testing interface: enter seed, preview world statistics, compare seeds.
  3. Implement parameter tuning: sliders for noise parameters, see real-time terrain changes.
  4. Implement biome distribution graph: show percentage of each biome in world.
  5. Implement structure count display: show how many of each structure type generated.
  6. Implement chunk generation profiling: show time per pass, identify bottlenecks.
  7. Implement noise visualization: show 2D noise field images for different octaves.
  8. Implement export world statistics: save biome/ore/structure counts to file.
  9. Implement seed sharing: copy/paste seed strings with world parameters.
  10. Add preset seeds: famous seeds, challenge seeds, balanced seeds.
- **Data:** Debug panel UI components, visualization algorithms, preset seed list.
- **MP:** Debug panel is local only — no netcode changes.
- **Done when:** Debug panel shows world stats, seed testing works, parameter tuning changes terrain in real-time, noise fields can be visualized.

---

## PHASE 20 — World persistence (IndexedDB save/load)
- **Goal:** Implement full world persistence using IndexedDB so worlds survive browser refresh and can be loaded/saved.
- **Why:** Current worlds die on refresh. Persistence is essential for a real game. IndexedDB is perfect for browser-based storage.
- **Prereqs:** 0.5, 1-19.
- **Touch/Create:** [world/WorldPersistence.ts](src/world/WorldPersistence.ts) (new file), [world/ChunkManager.ts](src/world/ChunkManager.ts) (integrate persistence), [ui/Menu.ts](src/ui/Menu.ts) (add save/load UI).
- **Do:**
  1. Implement IndexedDB database schema: store world metadata, chunk data, player state, edits.
  2. Implement world save system: save world seed, all generated chunks, player edits, time, etc.
  3. Implement world load system: load world from IndexedDB, restore state, resume at player position.
  4. Implement world list UI: show all saved worlds with metadata (seed, play time, last played).
  5. Implement world deletion: remove world from IndexedDB.
  6. Implement world export: export world as JSON file for backup/sharing.
  7. Implement world import: import world from JSON file.
  8. Implement auto-save: save world every 5 minutes or on major actions.
  9. Implement save compression: compress chunk data to save storage space.
  10. Implement save validation: detect corrupted saves, offer recovery options.
- **Data:** IndexedDB schema definition, save/load UI components, compression parameters.
- **MP:** World save/load is local only. When world is loaded, host sends world seed to clients so they generate the same world.
- **Done when:** Worlds can be saved/loaded, world list shows saved worlds, worlds survive browser refresh, export/import works.

---

This completes Book I with adaptive chunk sizing, pre-generation, and full Terraria algorithm integration. The world generation system now supports:
- Adaptive chunk sizes for different structure types (32 to 512 tiles)
- Pre-generation to eliminate loading delays
- Direct integration of Terraria's proven algorithms
- Multi-pass generation system (10 passes per chunk)
- Full structure library (50+ templates)
- Complete biome, cave, ore, and progression systems
- All while maintaining infinite world capability