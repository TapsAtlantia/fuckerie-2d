# Phase 3: Anti-Repetitive Infinite World Generation System Architecture

## Executive Summary

This architecture addresses the core challenge of infinite 2D sandbox games: maintaining engagement and variety across potentially infinite exploration distances. By implementing layered generation systems, dynamic modifiers, progression scaling, and emergent tile physics, we ensure that every region feels unique and that late-game exploration remains compelling.

---

## 1. Layered Noise & Biome Blending

### 1.1 Multi-Algorithm Noise Composition

**Primary Terrain Height (Perlin/Simplex Hybrid)**
```typescript
interface TerrainNoise {
  // Continental-scale features (10,000+ tiles)
  continental: SimplexNoise; // Scale: 0.00005, Octaves: 6
  
  // Regional features (1,000-10,000 tiles)
  regional: PerlinNoise; // Scale: 0.0002, Octaves: 4
  
  // Local terrain (10-1,000 tiles)
  local: SimplexNoise; // Scale: 0.002, Octaves: 3
  
  // Micro-features (1-10 tiles)
  micro: WorleyNoise; // Scale: 0.02, for rocky/uneven surfaces
}

function generateTerrainHeight(x: number, y: number): number {
  const continental = this.terrain.continental.fbm2D(x, y, 6) * 200;
  const regional = this.terrain.regional.fbm2D(x, y, 4) * 80;
  const local = this.terrain.local.fbm2D(x, y, 3) * 30;
  const micro = this.terrain.micro.noise2D(x, y) * 5;
  
  // Biome-specific amplitude modulation
  const biome = this.getBiomeAt(x, y);
  const amplitude = biome.terrainAmplitude;
  
  return (continental + regional + local + micro) * amplitude;
}
```

**Climate System (Temperature + Humidity + Precipitation)**
```typescript
interface ClimateNoise {
  temperature: SimplexNoise; // Scale: 0.00008, drives biome selection
  humidity: SimplexNoise; // Scale: 0.00008, secondary biome driver
  precipitation: PerlinNoise; // Scale: 0.0001, affects vegetation density
  seasonality: SimplexNoise; // Scale: 0.00001, for seasonal variations
}

function getClimateAt(x: number, y: number): Climate {
  const temp = this.climate.temperature.fbm2D(x, y, 4); // -1 (cold) to 1 (hot)
  const humidity = this.climate.humidity.fbm2D(x, y, 4); // -1 (dry) to 1 (wet)
  const precip = Math.max(0, this.climate.precipitation.fbm2D(x, y, 3)); // 0 to 1
  
  return { temperature: temp, humidity: humidity, precipitation: precip };
}
```

### 1.2 Biome Overlap Matrix

**Dynamic Hybrid Biome Generation**
```typescript
interface BiomeBlend {
  primary: Biome;
  secondary: Biome;
  blendFactor: number; // 0-1, how much secondary influences the result
  transitionType: "gradient" | "patchwork" | "mixed";
}

class BiomeOverlapMatrix {
  private readonly BLEND_THRESHOLDS = {
    // Temperature difference thresholds for biome blending
    TEMP_BLEND: 0.3,
    HUMIDITY_BLEND: 0.4,
  };
  
  // Matrix defining how biomes blend
  private readonly BLENDS: Record<string, HybridBiome> = {
    "desert+jungle": { result: "oasis", transition: "patchwork" },
    "forest+swamp": { result: "wetland", transition: "gradient" },
    "snowy+mountain": { result: "glacier", transition: "mixed" },
    "plains+volcanic": { result: "ash-lands", transition: "gradient" },
    "ocean+coral": { result: "reef", transition: "patchwork" },
    // ... 30+ hybrid biome combinations
  };
  
  function generateBiomeAt(x: number, y: number): Biome {
    const climate = this.getClimateAt(x, y);
    const primary = this.selectPrimaryBiome(climate);
    
    // Check for nearby biome influences using Voronoi-like regions
    const neighbors = this.getNeighboringBiomeRegions(x, y, 500); // 500-tile radius
    
    if (neighbors.length > 0) {
      const blendFactor = this.calculateBlendFactor(x, y, neighbors);
      
      if (blendFactor > 0.15) { // 15%+ influence from neighboring biome
        const secondary = neighbors[0].biome;
        const blendKey = this.getBlendKey(primary, secondary);
        
        if (this.BLENDS[blendKey]) {
          return this.generateHybridBiome(primary, secondary, blendFactor);
        }
      }
    }
    
    return primary;
  }
  
  private generateHybridBiome(primary: Biome, secondary: Biome, factor: number): Biome {
    const blendConfig = this.BLENDS[this.getBlendKey(primary, secondary)];
    
    // Blend properties based on factor
    return {
      ...primary,
      topBlock: factor > 0.5 ? secondary.topBlock : primary.topBlock,
      subSurfaceBlock: this.lerpBlock(primary.subSurfaceBlock, secondary.subSurfaceBlock, factor),
      structures: this.blendStructureLists(primary.structures, secondary.structures, factor),
      caveStyle: factor > 0.7 ? secondary.caveStyle : primary.caveStyle,
      // ... blend other properties
    };
  }
}
```

### 1.3 Vertical Depth Layers

**Layer-Specific Generation Algorithms**
```typescript
enum WorldLayer {
  SKY_UPPER = -2000,        // High altitude: floating cities, cloud temples
  SKY_LOWER = -400,         // Low altitude: floating islands, sky ships
  SURFACE = 0,              // Main surface layer
  UNDERGROUND_SHALLOW = 100, // Shallow caves, basic ores
  UNDERGROUND_DEEP = 600,    // Deep caves, rare ores, crystal formations
  UNDERWORLD = 40000,       // Hell-like layer, unique resources
  CORE = 80000,             // Ultra-deep, extreme hazards, legendary resources
}

interface LayerConfig {
  name: string;
  heightRange: [number, number];
  terrainAlgorithm: "simplex" | "perlin" | "worley" | "hybrid";
  noiseScale: number;
  structureTypes: StructureType[];
  biomeOverrides: Partial<Biome>;
  specialModifiers: LayerModifier[];
}

const LAYER_CONFIGS: Record<WorldLayer, LayerConfig> = {
  [WorldLayer.SKY_UPPER]: {
    name: "High Sky",
    heightRange: [-2000, -400],
    terrainAlgorithm: "worley", // Cellular patterns for floating structures
    noiseScale: 0.00001,
    structureTypes: ["sky-city", "cloud-temple", "floating-fortress"],
    biomeOverrides: { gravity: 0.3, atmosphere: "thin" },
    specialModifiers: ["anti-gravity", "ether-currents"],
  },
  [WorldLayer.SKY_LOWER]: {
    name: "Low Sky",
    heightRange: [-400, 0],
    terrainAlgorithm: "simplex",
    noiseScale: 0.00005,
    structureTypes: ["floating-island", "sky-ship", "roost"],
    biomeOverrides: { gravity: 0.7 },
    specialModifiers: ["wind-currents"],
  },
  // ... other layer configs
};
```

---

## 2. Anti-Monotony Modifiers & Micro-Biomes

### 2.1 Dynamic Biome Modifier System

**Modifier Application Pipeline**
```typescript
enum BiomeModifier {
  GRAVITY_DEFYING = "gravity-defying",      // Blocks float upward
  BIOLUMINESCENT = "bioluminescent",        // Glowing flora/fauna
  TOXIC_FLOOD = "toxic-flood",             // Poisonous liquid pools
  RUINED = "ruined",                       // Crumbled structures, overgrown
  CRYSTALLIZED = "crystallized",           // Crystal growths on everything
  INVERTED = "inverted",                   // Upside-down terrain
  TIME_DILATED = "time-dilated",           // Slow/fast particle effects
  ELDRITCH = "eldritch",                   // Distorted geometry, weird colors
  OVERGROWN = "overgrown",                 // Massive vegetation
  FROZEN_IN_TIME = "frozen-in-time",       // Static mid-action scenes
}

interface ModifierConfig {
  chance: number; // 0-1, probability of applying this modifier
  layers: WorldLayer[]; // Which layers this can appear in
  minDistance: number; // Minimum distance from spawn
  exclusiveWith: BiomeModifier[]; // Modifiers that can't coexist
  effects: ModifierEffect[];
}

class BiomeModifierSystem {
  private readonly MODIFIERS: Record<BiomeModifier, ModifierConfig> = {
    [BiomeModifier.GRAVITY_DEFYING]: {
      chance: 0.02,
      layers: [WorldLayer.SKY_LOWER, WorldLayer.UNDERGROUND_DEEP],
      minDistance: 5000,
      exclusiveWith: [BiomeModifier.INVERTED],
      effects: [
        { type: "physics", gravity: -0.5 },
        { type: "block", floating: true },
        { type: "structure", orientation: "random" },
      ],
    },
    // ... other modifier configs
  };
  
  function applyModifiers(biome: Biome, x: number, y: number, layer: WorldLayer): Biome {
    const distance = Math.sqrt(x * x + y * y);
    let modifiedBiome = { ...biome };
    
    for (const [modifier, config] of Object.entries(this.MODIFIERS)) {
      if (this.shouldApplyModifier(config, distance, layer, modifiedBiome.appliedModifiers)) {
        modifiedBiome = this.applyModifierEffects(modifiedBiome, config.effects);
        modifiedBiome.appliedModifiers.push(modifier as BiomeModifier);
      }
    }
    
    return modifiedBiome;
  }
  
  private shouldApplyModifier(config: ModifierConfig, distance: number, layer: WorldLayer, current: BiomeModifier[]): boolean {
    if (distance < config.minDistance) return false;
    if (!config.layers.includes(layer)) return false;
    if (config.exclusiveWith.some(m => current.includes(m))) return false;
    
    const hash = hash2(Math.floor(x / 100), Math.floor(y / 100), this.seed);
    return hash < config.chance;
  }
}
```

### 2.2 Ultra-Rare Micro-Biomes

**Spatial Anomaly Generation**
```typescript
interface MicroBiome {
  id: string;
  name: string;
  size: number; // tiles radius
  spawnChance: number; // extremely low, e.g., 0.00001
  requiredLayer: WorldLayer;
  requiredBiomes: string[]; // parent biomes this can appear in
  uniqueBlocks: TileId[];
  uniqueStructures: StructureType[];
  specialEffects: string[];
}

class MicroBiomeSystem {
  private readonly MICRO_BIOMES: MicroBiome[] = [
    {
      id: "singing-crystals",
      name: "Singing Crystals",
      size: 50,
      spawnChance: 0.000005, // 1 in 200,000
      requiredLayer: WorldLayer.UNDERGROUND_DEEP,
      requiredBiomes: ["crystal-caverns"],
      uniqueBlocks: [TileId.SingingCrystal, TileId.ResonantOre],
      uniqueStructures: ["crystal-organ"],
      specialEffects: ["ambient-music", "light-refraction"],
    },
    {
      id: "time-frozen-battlefield",
      name: "Time-Frozen Battlefield",
      size: 80,
      spawnChance: 0.000003,
      requiredLayer: WorldLayer.SURFACE,
      requiredBiomes: ["plains", "forest"],
      uniqueBlocks: [TileId.FrozenSoldier, TileId.PetriedWeapon],
      uniqueStructures: ["ancient-fortress"],
      specialEffects: ["suspended-particles", "ghost-echoes"],
    },
    {
      id: "void-pocket",
      name: "Void Pocket",
      size: 30,
      spawnChance: 0.000002,
      requiredLayer: WorldLayer.UNDERWORLD,
      requiredBiomes: ["hellstone-caves"],
      uniqueBlocks: [TileId.VoidMatter, TileId.RealityFragment],
      uniqueStructures: ["void-shrine"],
      specialEffects: ["reality-distortion", "color-inversion"],
    },
    // ... 20+ micro-biomes
  ];
  
  function checkForMicroBiome(x: number, y: number, layer: WorldLayer, parentBiome: Biome): MicroBiome | null {
    // Use a very coarse grid to avoid checking every tile
    const gridX = Math.floor(x / 100);
    const gridY = Math.floor(y / 100);
    const hash = hash2(gridX, gridY, this.seed + 9999);
    
    for (const micro of this.MICRO_BIOMES) {
      if (micro.requiredLayer !== layer) continue;
      if (!micro.requiredBiomes.includes(parentBiome.name)) continue;
      
      // Each micro-biome gets a slice of the hash space
      const chance = micro.spawnChance;
      const threshold = this.getMicroBiomeThreshold(micro.id);
      
      if (hash >= threshold && hash < threshold + chance) {
        // Check if we're within the micro-biome's radius
        const centerX = gridX * 100 + (hash * 50);
        const centerY = gridY * 100 + ((hash * 13 % 1) * 50);
        const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        
        if (dist < micro.size) {
          return micro;
        }
      }
    }
    
    return null;
  }
}
```

---

## 3. Cave Systems & Modular Dungeons

### 3.1 Hybrid Cave Generation (Cellular Automata + WFC)

**Natural Cave Networks (Cellular Automata)**
```typescript
class CellularCaveGenerator {
  // Generates organic, connected cave networks
  function generateCaveChunk(seed: number, width: number, height: number): boolean[][] {
    // Initialize with random noise
    let grid = this.initializeNoiseGrid(seed, width, height, 0.45);
    
    // Run cellular automata iterations
    for (let i = 0; i < 5; i++) {
      grid = this.smoothCaveGrid(grid);
    }
    
    // Ensure connectivity
    grid = this.ensureConnectivity(grid);
    
    return grid;
  }
  
  private smoothCaveGrid(grid: boolean[][]): boolean[][] {
    const newGrid = grid.map(row => [...row]);
    
    for (let y = 1; y < grid.length - 1; y++) {
      for (let x = 1; x < grid[0].length - 1; x++) {
        const walls = this.countNeighborWalls(grid, x, y);
        
        if (walls > 4) newGrid[y][x] = true;  // Become wall
        else if (walls < 4) newGrid[y][x] = false; // Become air
      }
    }
    
    return newGrid;
  }
}
```

**Structural Dungeons (Wave Function Collapse)**
```typescript
class WFCDungeonGenerator {
  // Generates structured dungeons with rooms, corridors, and specific layouts
  function generateDungeon(seed: number, size: number, theme: DungeonTheme): DungeonLayout {
    const constraints = this.generateConstraints(seed, size, theme);
    const layout = this.wfcCollapse(constraints);
    
    return {
      rooms: layout.rooms,
      corridors: layout.corridors,
      specialRooms: this.placeSpecialRooms(layout, seed),
      loot: this.generateLootTables(layout, theme),
      traps: this.placeTraps(layout, theme),
    };
  }
  
  private wfcCollapse(constraints: WFCConstraints): WFCLayout {
    // Simplified WFC implementation
    const cells = this.initializeCells(constraints);
    
    while (!this.isCollapsed(cells)) {
      const cell = this.selectCellWithLowestEntropy(cells);
      const tile = this.selectValidTile(cell, constraints);
      this.propagateConstraints(cell, tile, cells);
    }
    
    return this.extractLayout(cells);
  }
}
```

### 3.2 Points of Interest (POI) Dynamic Room-Stitching

**Modular Room System**
```typescript
interface RoomModule {
  id: string;
  size: [number, number];
  entrances: Point[]; // Possible connection points
  requiredModules: string[]; // Prerequisite rooms
  incompatibleModules: string[]; // Rooms that can't connect
  theme: DungeonTheme;
  content: RoomContent;
}

interface RoomContent {
  blocks: TilePlacement[];
  enemies: EnemySpawn[];
  loot: LootTable[];
  traps: TrapPlacement[];
  secrets: SecretPassage[];
  atmosphere: AtmosphereEffect;
}

class POISystem {
  private readonly ROOM_MODULES: RoomModule[] = [
    // Entrance rooms
    { id: "entrance-cave", size: [10, 8], entrances: [{x: 5, y: 8}], theme: "cave", content: {...} },
    { id: "entrance-ruin", size: [12, 10], entrances: [{x: 6, y: 10}], theme: "ancient", content: {...} },
    
    // Challenge rooms
    { id: "arena", size: [20, 20], entrances: [{x: 2, y: 10}, {x: 18, y: 10}], theme: "combat", content: {...} },
    { id: "puzzle-room", size: [15, 15], entrances: [{x: 7, y: 15}], theme: "puzzle", content: {...} },
    
    // Reward rooms
    { id: "treasure-vault", size: [12, 12], entrances: [{x: 6, y: 12}], theme: "wealth", content: {...} },
    { id: "artifact-shrine", size: [10, 10], entrances: [{x: 5, y: 10}], theme: "mystical", content: {...} },
    
    // Connector rooms
    { id: "corridor-straight", size: [6, 15], entrances: [{x: 3, y: 0}, {x: 3, y: 15}], theme: "passage", content: {...} },
    { id: "corridor-L", size: [10, 10], entrances: [{x: 0, y: 5}, {x: 10, y: 5}], theme: "passage", content: {...} },
    // ... 50+ room modules
  ];
  
  function generatePOI(seed: number, location: Point, type: POIType): POI {
    const theme = this.selectTheme(seed, location, type);
    const graph = this.buildRoomGraph(seed, type, theme);
    const layout = this.stitchRooms(graph);
    const populated = this.populateRooms(layout, seed);
    
    return {
      location,
      type,
      theme,
      layout: populated,
      exterior: this.generateExterior(seed, type, theme),
    };
  }
  
  private buildRoomGraph(seed: number, type: POIType, theme: DungeonTheme): RoomGraph {
    const size = this.getPOISize(type);
    const roomCount = Math.floor(size / 50); // Approximate room count
    
    const graph: RoomGraph = {
      nodes: [],
      edges: [],
    };
    
    // Start with entrance
    const entrance = this.selectRoomModule("entrance", theme);
    graph.nodes.push({ module: entrance, position: {x: 0, y: 0} });
    
    // Grow the graph
    for (let i = 1; i < roomCount; i++) {
      const lastNode = graph.nodes[graph.nodes.length - 1];
      const nextModule = this.selectNextRoom(lastNode.module, type, theme);
      const position = this.calculateNextPosition(lastNode, nextModule);
      
      graph.nodes.push({ module: nextModule, position });
      graph.edges.push({ from: lastNode, to: graph.nodes[graph.nodes.length - 1] });
    }
    
    return graph;
  }
}
```

---

## 4. Distance-Based & Temporal Progression

### 4.1 World Metrics & Scaling

**Distance-Based Difficulty Scaling**
```typescript
interface WorldMetrics {
  distanceFromSpawn: number;
  explorationTier: number; // 0-10, based on distance
  bossDefeated: Set<string>;
  era: WorldEra;
  timeElapsed: number;
}

class ProgressionSystem {
  private readonly TIER_THRESHOLDS = [0, 1000, 5000, 15000, 40000, 100000, 250000, 500000, 1000000, Infinity];
  
  function calculateExplorationTier(distance: number): number {
    for (let i = 0; i < this.TIER_THRESHOLDS.length - 1; i++) {
      if (distance >= this.TIER_THRESHOLDS[i] && distance < this.TIER_THRESHOLDS[i + 1]) {
        return i;
      }
    }
    return this.TIER_THRESHOLDS.length - 1;
  }
  
  function getScaledParameters(metrics: WorldMetrics): ScaledWorldParams {
    const tier = metrics.explorationTier;
    const distance = metrics.distanceFromSpawn;
    
    return {
      // Resource quality improves with distance
      oreQuality: 1 + tier * 0.15,
      rareOreChance: 0.01 + tier * 0.02,
      
      // Hazards increase
      enemyDamage: 1 + tier * 0.2,
      trapFrequency: 0.05 + tier * 0.03,
      environmentalDamage: tier * 5,
      
      // Structure complexity
      structureSize: 1 + tier * 0.3,
      structureDensity: 0.3 + tier * 0.05,
      
      // Environmental effects
      lightingLevel: Math.max(0, 1 - tier * 0.08),
      weatherSeverity: tier * 0.1,
      
      // Loot quality
      lootRarity: tier,
      artifactChance: 0.001 * Math.pow(2, tier),
    };
  }
}
```

### 4.2 World Mutation Triggers

**Retroactive Terrain Changes**
```typescript
enum WorldEra {
  PRE_AWAKENING = "pre-awakening",
  POST_AWAKENING = "post-awakening",
  CORRUPTION_SPREAD = "corruption-spread",
  PURIFICATION = "purification",
  ASCENSION = "ascension",
}

interface MutationTrigger {
  event: string; // Boss defeated, milestone reached, etc.
  era: WorldEra;
  changes: TerrainChange[];
}

interface TerrainChange {
  type: "biome" | "structure" | "block" | "modifier";
  affectedArea: Area;
  from: any;
  to: any;
  transition: "instant" | "gradual" | "wave";
}

class WorldMutationSystem {
  private readonly MUTATIONS: Record<string, MutationTrigger> = {
    "boss-ancient-warden-defeated": {
      event: "boss-ancient-warden-defeated",
      era: WorldEra.POST_AWAKENING,
      changes: [
        {
          type: "modifier",
          affectedArea: { type: "global" },
          from: null,
          to: BiomeModifier.OVERGROWN,
          transition: "gradual",
        },
        {
          type: "biome",
          affectedArea: { type: "circle", center: {x: 0, y: 0}, radius: 5000 },
          from: "barren-wastes",
          to: "rejuvenated-lands",
          transition: "wave",
        },
      ],
    },
    "corruption-core-destroyed": {
      event: "corruption-core-destroyed",
      era: WorldEra.PURIFICATION,
      changes: [
        {
          type: "modifier",
          affectedArea: { type: "region", biome: "corrupted" },
          from: BiomeModifier.ELDRITCH,
          to: null,
          transition: "wave",
        },
      ],
    },
    // ... more mutation triggers
  };
  
  function applyMutation(triggerId: string, world: World): void {
    const mutation = this.MUTATIONS[triggerId];
    if (!mutation) return;
    
    world.currentEra = mutation.era;
    
    for (const change of mutation.changes) {
      this.applyTerrainChange(change, world);
    }
    
    // Regenerate affected chunks
    this.regenerateAffectedChunks(world, mutation.changes);
  }
  
  private applyTerrainChange(change: TerrainChange, world: World): void {
    switch (change.transition) {
      case "instant":
        this.applyInstantChange(change, world);
        break;
      case "gradual":
        this.scheduleGradualChange(change, world);
        break;
      case "wave":
        this.scheduleWaveChange(change, world);
        break;
    }
  }
}
```

---

## 5. Environmental Physics & Emergent Tile Systems

### 5.1 Dynamic Tile Interaction Rules

**Fluid Dynamics System**
```typescript
interface FluidTile {
  type: "water" | "lava" | "acid" | "gas";
  level: number; // 0-255, fill level
  pressure: number; // For flow calculations
  temperature: number;
  properties: FluidProperties;
}

class FluidSystem {
  function updateFluids(world: World, dt: number): void {
    for (const chunk of world.loadedChunks) {
      this.updateChunkFluids(chunk, dt);
    }
  }
  
  private updateChunkFluids(chunk: Chunk, dt: number): void {
    const updates: FluidUpdate[] = [];
    
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const tile = chunk.getFluid(x, y);
        if (!tile) continue;
        
        // Calculate flow based on pressure and gravity
        const flow = this.calculateFlow(chunk, x, y, tile);
        
        // Apply fluid interactions
        const interactions = this.calculateInteractions(chunk, x, y, tile);
        
        updates.push({ x, y, flow, interactions });
      }
    }
    
    // Apply updates atomically
    for (const update of updates) {
      this.applyFluidUpdate(chunk, update);
    }
  }
  
  private calculateInteractions(chunk: Chunk, x: number, y: number, fluid: FluidTile): FluidInteraction[] {
    const interactions: FluidInteraction[] = [];
    const neighbors = this.getNeighborTiles(chunk, x, y);
    
    for (const neighbor of neighbors) {
      const reaction = this.getReaction(fluid.type, neighbor.type);
      if (reaction) {
        interactions.push({
          with: neighbor,
          result: reaction.result,
          byproduct: reaction.byproduct,
          heatChange: reaction.heatChange,
        });
      }
    }
    
    return interactions;
  }
  
  private getReaction(fluidA: string, fluidB: string): Reaction | null {
    const reactions: Record<string, Reaction> = {
      "water+lava": { result: "obsidian", byproduct: "steam", heatChange: 100 },
      "water+acid": { result: null, byproduct: "gas", heatChange: -20 },
      "lava+ice": { result: "water", byproduct: "obsidian", heatChange: -50 },
      // ... more reactions
    };
    
    const key = [fluidA, fluidB].sort().join('+');
    return reactions[key] || null;
  }
}
```

**Heat/Cold Propagation**
```typescript
class ThermalSystem {
  function updateTemperature(world: World, dt: number): void {
    for (const chunk of world.loadedChunks) {
      this.updateChunkTemperature(chunk, dt);
    }
  }
  
  private updateChunkTemperature(chunk: Chunk, dt: number): void {
    const newTemperatures = new Map<string, number>();
    
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const currentTemp = chunk.getTemperature(x, y);
        const neighbors = this.getNeighborTemperatures(chunk, x, y);
        
        // Heat transfer: q = k * A * (T2 - T1) / d
        const thermalConductivity = this.getThermalConductivity(chunk, x, y);
        const tempChange = this.calculateHeatTransfer(currentTemp, neighbors, thermalConductivity, dt);
        
        // Apply heat sources/sinks
        const ambientEffect = this.calculateAmbientEffect(chunk, x, y, currentTemp);
        
        newTemperatures.set(`${x},${y}`, currentTemp + tempChange + ambientEffect);
      }
    }
    
    // Apply temperature changes
    for (const [key, newTemp] of newTemperatures) {
      const [x, y] = key.split(',').map(Number);
      chunk.setTemperature(x, y, newTemp);
      
      // Check for phase changes
      this.checkPhaseChange(chunk, x, y, newTemp);
    }
  }
  
  private checkPhaseChange(chunk: Chunk, x: number, y: number, temp: number): void {
    const tile = chunk.getTile(x, y);
    
    // Ice melting
    if (tile === TileId.Ice && temp > 0) {
      chunk.setTile(x, y, TileId.Water);
    }
    // Water freezing
    else if (tile === TileId.Water && temp < 0) {
      chunk.setTile(x, y, TileId.Ice);
    }
    // Block destruction from extreme heat
    else if (temp > 1000 && this.isFlammable(tile)) {
      chunk.setTile(x, y, TileId.Ash);
    }
    // ... more phase changes
  }
}
```

### 5.2 Growing Flora & Block Erosion

**Dynamic Flora System**
```typescript
interface FloraGrowth {
  tileId: TileId;
  growthStage: number; // 0-1
  growthRate: number; // per second
  requiredConditions: GrowthConditions;
  nextStage: TileId | null;
}

class FloraSystem {
  private readonly FLORA_GROWTH: Record<TileId, FloraGrowth> = {
    [TileId.Sapling]: {
      tileId: TileId.Sapling,
      growthStage: 0,
      growthRate: 0.001, // ~17 minutes to full growth
      requiredConditions: { light: 0.3, water: 0.2, temperature: [5, 35] },
      nextStage: TileId.OakLog, // Will grow into a tree
    },
    [TileId.Moss]: {
      tileId: TileId.Moss,
      growthStage: 0,
      growthRate: 0.0005,
      requiredConditions: { light: 0.1, water: 0.5, temperature: [0, 25] },
      nextStage: null, // Spreads to adjacent blocks
    },
    // ... more flora
  };
  
  function updateFlora(world: World, dt: number): void {
    for (const chunk of world.loadedChunks) {
      this.updateChunkFlora(chunk, dt);
    }
  }
  
  private updateChunkFlora(chunk: Chunk, dt: number): void {
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const tile = chunk.getTile(x, y);
        const growth = this.FLORA_GROWTH[tile];
        
        if (!growth) continue;
        
        const conditions = this.checkGrowthConditions(chunk, x, y, growth.requiredConditions);
        
        if (conditions.met) {
          growth.growthStage += growth.growthRate * dt * conditions.multiplier;
          
          if (growth.growthStage >= 1) {
            this.triggerGrowthEvent(chunk, x, y, growth);
          }
        } else {
          // Die back if conditions not met
          growth.growthStage -= growth.growthRate * dt * 0.5;
          if (growth.growthStage < 0) {
            chunk.setTile(x, y, TileId.DeadPlant);
          }
        }
      }
    }
  }
  
  private triggerGrowthEvent(chunk: Chunk, x: number, y: number, growth: FloraGrowth): void {
    if (growth.nextStage) {
      // Transform into next stage (e.g., sapling → tree)
      this.growTree(chunk, x, y, growth.nextStage);
    } else {
      // Spread to adjacent blocks (e.g., moss)
      this.spreadFlora(chunk, x, y, growth.tileId);
    }
    
    growth.growthStage = 0;
  }
}
```

**Block Erosion System**
```typescript
class ErosionSystem {
  function updateErosion(world: World, dt: number): void {
    for (const chunk of world.loadedChunks) {
      this.updateChunkErosion(chunk, dt);
    }
  }
  
  private updateChunkErosion(chunk: Chunk, dt: number): void {
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const tile = chunk.getTile(x, y);
        const erosionRate = this.getErosionRate(tile);
        
        if (erosionRate === 0) continue;
        
        const exposure = this.calculateExposure(chunk, x, y);
        const weatherFactor = this.getWeatherFactor(chunk);
        
        const erosionChance = erosionRate * exposure * weatherFactor * dt;
        
        if (Math.random() < erosionChance) {
          this.erodeBlock(chunk, x, y, tile);
        }
      }
    }
  }
  
  private erodeBlock(chunk: Chunk, x: number, y: number, tile: TileId): void {
    // Replace with eroded version or remove entirely
    const erodedVersion = this.getErodedVersion(tile);
    
    if (erodedVersion) {
      chunk.setTile(x, y, erodedVersion);
    } else {
      chunk.setTile(x, y, TileId.Air);
      // Drop particles/sediment
      this.spawnErosionParticles(chunk, x, y, tile);
    }
  }
}
```

---

## Algorithm Pseudocode

### Biome Blending Logic

```typescript
function generateBlendedBiome(x: number, y: number, seed: number): Biome {
  // Sample climate at multiple scales
  const climate = {
    temperature: sampleNoise(x, y, seed, 0.00008, 4),
    humidity: sampleNoise(x, y, seed + 1, 0.00008, 4),
    elevation: sampleNoise(x, y, seed + 2, 0.0001, 5),
  };
  
  // Get primary biome from climate
  const primary = selectPrimaryBiome(climate);
  
  // Sample biome region map (Voronoi-like)
  const regionSize = 500;
  const regionX = floor(x / regionSize);
  const regionY = floor(y / regionSize);
  const regionHash = hash2(regionX, regionY, seed + 100);
  
  // Determine if we're in a transition zone
  const distToRegionCenter = distanceToRegionCenter(x, y, regionX, regionY, regionHash);
  const transitionWidth = 100;
  
  if (distToRegionCenter < regionSize - transitionWidth) {
    return primary; // Core of biome region
  }
  
  // In transition zone - sample neighboring regions
  const neighbors = getNeighboringRegions(regionX, regionY, seed);
  const nearestNeighbor = findNearestNeighbor(x, y, neighbors);
  
  // Calculate blend factor based on distance
  const blendFactor = smoothstep(
    regionSize - transitionWidth,
    regionSize,
    distToRegionCenter
  );
  
  // Look up hybrid biome in matrix
  const blendKey = getBlendKey(primary.name, nearestNeighbor.biome.name);
  const hybridConfig = BIOME_BLEND_MATRIX[blendKey];
  
  if (hybridConfig) {
    return generateHybridBiome(primary, nearestNeighbor.biome, blendFactor, hybridConfig);
  }
  
  // Fallback: linear interpolation of properties
  return interpolateBiomes(primary, nearestNeighbor.biome, blendFactor);
}

function generateHybridBiome(
  primary: Biome,
  secondary: Biome,
  factor: number,
  config: HybridConfig
): Biome {
  const result = { ...primary };
  
  // Apply blending based on configuration
  switch (config.transition) {
    case "gradient":
      // Smooth interpolation of all properties
      result.topBlock = factor > 0.5 ? secondary.topBlock : primary.topBlock;
      result.structures = interpolateLists(primary.structures, secondary.structures, factor);
      result.caveStyle = factor > 0.7 ? secondary.caveStyle : primary.caveStyle;
      break;
      
    case "patchwork":
      // Random mixture based on factor
      result.topBlock = random() < factor ? secondary.topBlock : primary.topBlock;
      result.structures = shuffleAndMerge(primary.structures, secondary.structures, factor);
      break;
      
    case "mixed":
      // Some properties from primary, some from secondary
      result.topBlock = secondary.topBlock;
      result.subSurfaceBlock = primary.subSurfaceBlock;
      result.structures = [...primary.structures, ...secondary.structures];
      break;
  }
  
  // Apply hybrid-specific overrides
  if (config.overrides) {
    Object.assign(result, config.overrides);
  }
  
  return result;
}
```

### Module Stitching System

```typescript
function stitchModules(graph: RoomGraph, seed: number): StitchedLayout {
  const layout: StitchedLayout = {
    rooms: [],
    corridors: [],
    bounds: { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  };
  
  // Position rooms using force-directed layout
  const positionedRooms = forceDirectedLayout(graph);
  
  // Connect rooms with corridors
  for (const edge of graph.edges) {
    const from = positionedRooms.get(edge.from);
    const to = positionedRooms.get(edge.to);
    
    if (from && to) {
      const corridor = generateCorridor(from, to, seed);
      layout.corridors.push(corridor);
    }
  }
  
  // Resolve overlaps
  resolveOverlaps(positionedRooms, layout);
  
  // Update bounds
  for (const room of positionedRooms.values()) {
    layout.bounds.minX = min(layout.bounds.minX, room.x);
    layout.bounds.minY = min(layout.bounds.minY, room.y);
    layout.bounds.maxX = max(layout.bounds.maxX, room.x + room.width);
    layout.bounds.maxY = max(layout.bounds.maxY, room.y + room.height);
  }
  
  layout.rooms = Array.from(positionedRooms.values());
  
  return layout;
}

function generateCorridor(from: PositionedRoom, to: PositionedRoom, seed: number): Corridor {
  const fromPoint = getRandomEntrance(from, seed);
  const toPoint = getRandomEntrance(to, seed + 1);
  
  // Generate path using A* or direct line with noise
  const path = generatePath(fromPoint, toPoint, seed);
  
  // Carve corridor along path
  const corridor: Corridor = {
    path,
    width: 3,
    type: selectCorridorType(from.module.theme, to.module.theme, seed),
    features: generateCorridorFeatures(path, seed),
  };
  
  return corridor;
}

function generateCorridorFeatures(path: Point[], seed: number): CorridorFeature[] {
  const features: CorridorFeature[] = [];
  
  // Add side passages
  for (let i = 0; i < path.length; i += 10) {
    if (random(seed + i) < 0.1) {
      features.push({
        type: "side-passage",
        position: path[i],
        direction: randomDirection(seed + i + 1),
        length: 5 + floor(random(seed + i + 2) * 10),
      });
    }
  }
  
  // Add traps
  for (let i = 0; i < path.length; i += 15) {
    if (random(seed + i + 100) < 0.05) {
      features.push({
        type: "trap",
        position: path[i],
        trapType: selectTrapType(seed + i + 101),
      });
    }
  }
  
  return features;
}
```

---

## Performance Optimization Strategies

### Chunk Loading & Seam Stitching

```typescript
class OptimizedChunkManager {
  private readonly CHUNK_POOL_SIZE = 100;
  private chunkPool: Chunk[] = [];
  
  private readonly LOAD_PRIORITY = {
    visible: 1.0,
    adjacent: 0.5,
    distant: 0.1,
  };
  
  function loadChunk(cx: number, cy: number, priority: number): Chunk {
    // Try to reuse from pool
    const chunk = this.chunkPool.pop() || new Chunk(cx, cy);
    
    // Generate with thread worker if available
    if (this.workerAvailable) {
      return this.generateAsync(chunk, cx, cy);
    } else {
      return this.generateSync(chunk, cx, cy);
    }
  }
  
  function stitchSeams(chunk: Chunk): void {
    const neighbors = this.getLoadedNeighbors(chunk.cx, chunk.cy);
    
    // Stitch with each neighbor
    for (const neighbor of neighbors) {
      this.stitchSeam(chunk, neighbor);
    }
  }
  
  private stitchSeam(a: Chunk, b: Chunk): void {
    // Determine overlap direction
    const dx = a.cx - b.cx;
    const dy = a.cy - b.cy;
    
    if (dx === 1) {
      // A is to the right of B - stitch left edge of A with right edge of B
      this.stitchVerticalSeam(a, b, 0);
    } else if (dx === -1) {
      // A is to the left of B - stitch right edge of A with left edge of B
      this.stitchVerticalSeam(a, b, CHUNK_SIZE - 1);
    } else if (dy === 1) {
      // A is below B - stitch top edge of A with bottom edge of B
      this.stitchHorizontalSeam(a, b, 0);
    } else if (dy === -1) {
      // A is above B - stitch bottom edge of A with top edge of B
      this.stitchHorizontalSeam(a, b, CHUNK_SIZE - 1);
    }
  }
  
  private stitchVerticalSeam(a: Chunk, b: Chunk, ax: number): void {
    const bx = ax === 0 ? CHUNK_SIZE - 1 : 0;
    
    for (let y = 0; y < CHUNK_SIZE; y++) {
      const worldY = a.cy * CHUNK_SIZE + y;
      
      // Use average of both chunks for seamless transition
      const aTile = a.getFg(ax, y);
      const bTile = b.getFg(bx, y);
      
      // If they differ, use a transition based on noise
      if (aTile !== bTile) {
        const noise = this.seamNoise.noise2D(a.cx + ax, worldY);
        const blendedTile = noise > 0 ? aTile : bTile;
        
        a.setFg(ax, y, blendedTile);
        b.setFg(bx, y, blendedTile);
      }
    }
  }
}
```

### Memory Pooling

```typescript
class MemoryPool {
  private pools: Map<string, Pool<any>> = new Map();
  
  function get<T>(type: string, factory: () => T): T {
    let pool = this.pools.get(type);
    
    if (!pool) {
      pool = new Pool(factory);
      this.pools.set(type, pool);
    }
    
    return pool.acquire();
  }
  
  function release<T>(type: string, item: T): void {
    const pool = this.pools.get(type);
    if (pool) {
      pool.release(item);
    }
  }
}

class Pool<T> {
  private available: T[] = [];
  private factory: () => T;
  private maxSize: number;
  
  constructor(factory: () => T, maxSize: number = 50) {
    this.factory = factory;
    this.maxSize = maxSize;
  }
  
  acquire(): T {
    if (this.available.length > 0) {
      return this.available.pop()!;
    }
    return this.factory();
  }
  
  release(item: T): void {
    if (this.available.length < this.maxSize) {
      // Reset item state if needed
      this.reset(item);
      this.available.push(item);
    }
  }
  
  private reset(item: T): void {
    // Type-specific reset logic
    if (item instanceof Chunk) {
      item.clear();
    }
    // ... other types
  }
}
```

### Incremental Generation

```typescript
class IncrementalGenerator {
  function generateChunkIncremental(chunk: Chunk, budget: number): GenerationProgress {
    const progress: GenerationProgress = {
      completed: 0,
      total: CHUNK_SIZE * CHUNK_SIZE,
      stages: [],
    };
    
    // Stage 1: Base terrain (highest priority)
    const terrainBudget = Math.floor(budget * 0.4);
    progress.stages.push(this.generateBaseTerrain(chunk, terrainBudget));
    
    // Stage 2: Caves (if budget remains)
    if (budget > terrainBudget) {
      const caveBudget = Math.floor((budget - terrainBudget) * 0.3);
      progress.stages.push(this.generateCaves(chunk, caveBudget));
    }
    
    // Stage 3: Structures (if budget remains)
    if (budget > terrainBudget + caveBudget) {
      const structureBudget = budget - terrainBudget - caveBudget;
      progress.stages.push(this.generateStructures(chunk, structureBudget));
    }
    
    // Stage 4: Vegetation (low priority, can be deferred)
    progress.stages.push({ stage: "vegetation", completed: false, priority: 0.1 });
    
    return progress;
  }
  
  function continueGeneration(chunk: Chunk, progress: GenerationProgress, budget: number): GenerationProgress {
    // Continue from where we left off
    for (const stage of progress.stages) {
      if (!stage.completed && stage.priority > 0) {
        if (budget > 0) {
          this.completeStage(chunk, stage, budget);
          budget -= stage.cost;
        } else {
          break; // Out of budget
        }
      }
    }
    
    return progress;
  }
}
```

---

## Implementation Priority

### Phase 3a: Core Anti-Repetition (Immediate)
1. Layered noise composition (terrain height, climate)
2. Biome overlap matrix for hybrid biomes
3. Micro-biome system (3-4 rare biomes)
4. Basic biome modifiers (2-3 modifiers)

### Phase 3b: Cave & Structure Diversity (Short-term)
1. Cellular automata cave generation
2. Basic WFC dungeon generation
3. Modular room system (10-15 room modules)
4. POI dynamic stitching

### Phase 3c: Progression & Scaling (Medium-term)
1. Distance-based tier system
2. Scaled world parameters
3. Basic world mutation triggers
4. Environmental physics foundations

### Phase 3d: Advanced Systems (Long-term)
1. Full fluid dynamics
2. Thermal system
3. Dynamic flora growth
4. Block erosion
5. Advanced modifiers (10+)
6. Extensive micro-biomes (20+)
7. Complex dungeon modules (50+)

---

## Conclusion

This architecture provides a comprehensive framework for infinite world generation that avoids monotony through:

1. **Layered complexity**: Multiple noise algorithms create natural-looking terrain
2. **Dynamic blending**: Biomes transition smoothly with hybrid formations
3. **Rare anomalies**: Micro-biomes and modifiers break up long travel distances
4. **Structural variety**: Modular dungeons and POIs ensure unique experiences
5. **Progression scaling**: World evolves with player advancement
6. **Emergent systems**: Environmental physics create organic, player-driven interactions

The system is designed to be incrementally implementable, with each phase providing immediate value while building toward the ultimate goal of an endlessly engaging infinite world.
