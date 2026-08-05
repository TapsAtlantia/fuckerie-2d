// Tile catalogue. Tile ids are 16-bit (Uint16Array fg/bg in Chunk.ts) so there is no practical
// ceiling. IMPORTANT: ids are STABLE + APPEND-ONLY — saves, edit deltas, and net messages all
// reference ids by number, so never reorder or renumber existing tiles; only append new ones.

export const enum TileId {
  Air = 0,
  
  // Natural surface blocks
  Grass = 1,
  Dirt = 2,
  Mud = 3,
  Clay = 4,
  Sand = 5,
  Sandstone = 6,
  Gravel = 7,
  Snow = 8,
  SnowyGrass = 9,
  Ice = 10,
  
  // Grass variants for biomes
  JungleGrass = 11,
  Podzol = 12,
  
  // Stone variants
  Stone = 13,
  DeepStone = 14, // caverns
  Hellstone = 15, // underworld
  Granite = 16,
  Basalt = 17,
  Limestone = 18,
  MossyStone = 19,
  Obsidian = 20,
  
  // Sky blocks
  CloudStone = 21,
  SkyStone = 22,
  
  // Ores (rendered as stone-with-coloured-fleck)
  CoalOre = 23,
  CopperOre = 24,
  IronOre = 25,
  GoldOre = 26,
  SilverOre = 27,
  Ruby = 28,
  Sapphire = 29,
  Emerald = 30,
  Diamond = 31,
  Crystal = 32,
  
  // Wood logs
  OakLog = 33,
  BirchLog = 34,
  PineLog = 35,
  JungleLog = 36,
  
  // Leaves
  OakLeaves = 37,
  BirchLeaves = 38,
  PineLeaves = 39,
  JungleLeaves = 40,
  
  // Plants and vegetation
  Cactus = 41,
  Vines = 42,
  TallGrass = 43,
  Flower = 44,
  Mushroom = 45,
  DeadBush = 46,
  Sapling = 47,
  
  // Structure blocks
  Cobblestone = 48,
  StoneBrick = 49,
  Planks = 50,
  Glass = 51,
  Bricks = 52,
  Hay = 53,
  Bookshelf = 54,
  Lantern = 55,
  
  // Light sources
  Torch = 56,

  // --- Phase 2: background walls (bg layer only; non-collidable). Append-only. ---
  DirtWall = 57,
  StoneWall = 58,
  GraniteWall = 59,
  BasaltWall = 60,
  SandstoneWall = 61,
  MudWall = 62,
  SnowWall = 63,
  HellWall = 64,
  WoodWall = 65,
  StoneBrickWall = 66,
  BrickWall = 67,
  GlassWall = 68,

  // --- Phase 4: ore & gem expansion (append-only). Alt metals pair with the originals
  // (copper/tin, iron/lead, silver/tungsten, gold/platinum); a world region uses one of each pair. ---
  TinOre = 69,
  LeadOre = 70,
  TungstenOre = 71,
  PlatinumOre = 72,
  Amethyst = 73,
  Topaz = 74,

  // Hardmode ore ids reserved NOW (generated later, in the Hardmode phase) so the tile-id space
  // stays stable/append-only. Not placed by worldgen yet.
  CobaltOre = 75,
  PalladiumOre = 76,
  MythrilOre = 77,
  OrichalcumOre = 78,
  AdamantiteOre = 79,
  TitaniumOre = 80,

  // --- Phase 6: underground biome tiles (append-only) ---
  Marble = 81, // marble caves (bright banded stone)
  MushroomGrass = 82, // glowing-mushroom biome grass on mud (emits light)
  GlowMushroom = 83, // glowing mushroom plant (emits light)

  // --- Phase 7: evil biomes. Only the seed-chosen evil (corruption OR crimson) generates. ---
  CorruptGrass = 84,
  Ebonstone = 85,
  CrimsonGrass = 86,
  Crimstone = 87,
  DemonAltar = 88, // corruption altar
  CrimsonAltar = 89, // crimson altar
  ShadowOrb = 90, // corruption breakable loot node (glows)
  CrimsonHeart = 91, // crimson breakable loot node (glows)
  // Reserved Hallow (post-hardmode) ids — exist so the id space is stable; not generated yet.
  PearlStone = 92,
  HallowedGrass = 93,
  PearlSand = 94,

  // --- Phase 8: the Dungeon (append-only) ---
  DungeonBrickBlue = 95,
  DungeonBrickGreen = 96,
  DungeonBrickPink = 97,
  DungeonWallBlue = 98, // bg walls
  DungeonWallGreen = 99,
  DungeonWallPink = 100,
  Spike = 101,
  Cobweb = 102,
  GoldChest = 103, // locked dungeon chest (loot filled in Phase 14)
  DungeonDoor = 104, // boss-gated entrance (locked until Skeletron, Phase 51)
}

export type TileCategory =
  | "natural"
  | "stone"
  | "ore"
  | "wood"
  | "plant"
  | "sand"
  | "ice"
  | "structure"
  | "deco"
  | "gem"
  | "wall"; // background wall tiles (bg layer only, non-collidable)

export type TileTexture = "flat" | "dither" | "twoTone" | "fleck";

// Which tool best/must mine a tile (Phase 22 tool-gated mining consumes this).
export const enum ToolType { None = 0, Pick = 1, Axe = 2, Hammer = 3 }

// Per-tile behaviour flags (bitset). Later phases consume these (falling sand, fire, ladders, …).
export const enum TileFlag {
  Falls = 1 << 0, // affected by gravity (sand/gravel)
  Flammable = 1 << 1, // can burn
  Climbable = 1 << 2, // ladders/vines/ropes
  Platform = 1 << 3, // one-way platform
  Interactive = 1 << 4, // right-click interact (chest/door/station)
  NaturalOnly = 1 << 5, // only generated, not player-placeable
  NoDrop = 1 << 6, // yields nothing when mined
}

export interface TileProps {
  name: string;
  solid: boolean;
  hardness: number; // seconds of mining at tool speed 1
  color: readonly [number, number, number];
  lightEmit: number; // 0 = none; drives point lighting
  category: TileCategory;
  drop: TileId | null; // item yielded when mined; null = nothing, self = itself
  texture: TileTexture;
  tint?: boolean; // if true, apply hash-based brightness variation
  // --- Structured metadata (all optional; sensible defaults derived by the helpers below, so
  //     adding a tile never requires touching every row). Later books read these. ---
  tier?: number; // mining power required to break it (0 = anything)
  mergeGroup?: number; // autotile blend group (default: own id)
  wall?: number; // default background wall id this block forms a natural layer with
  blastResistance?: number; // resistance to explosions (default derived from hardness)
  flags?: number; // TileFlag bitset override
  toolType?: ToolType; // override the tool used to mine it
  soundGroup?: string; // footstep/mining sound bucket
}

// Indexed by TileId. Order must match the enum.
export const TILE_PROPS: readonly TileProps[] = [
  { name: "air", solid: false, hardness: 0, color: [0, 0, 0], lightEmit: 0, category: "natural", drop: null, texture: "flat" },
  
  // Natural surface blocks
  { name: "grass", solid: true, hardness: 0.35, color: [92, 168, 66], lightEmit: 0, category: "natural", drop: TileId.Dirt, texture: "twoTone", tint: true },
  { name: "dirt", solid: true, hardness: 0.45, color: [122, 86, 56], lightEmit: 0, category: "natural", drop: TileId.Dirt, texture: "dither", tint: true },
  { name: "mud", solid: true, hardness: 0.3, color: [101, 67, 33], lightEmit: 0, category: "natural", drop: TileId.Mud, texture: "flat", tint: true },
  { name: "clay", solid: true, hardness: 0.5, color: [172, 164, 148], lightEmit: 0, category: "natural", drop: TileId.Clay, texture: "flat" },
  { name: "sand", solid: true, hardness: 0.3, color: [238, 214, 175], lightEmit: 0, category: "sand", drop: TileId.Sand, texture: "dither", tint: true },
  { name: "sandstone", solid: true, hardness: 0.8, color: [206, 186, 140], lightEmit: 0, category: "stone", drop: TileId.Sandstone, texture: "dither", tint: true },
  { name: "gravel", solid: true, hardness: 0.4, color: [132, 126, 118], lightEmit: 0, category: "natural", drop: TileId.Gravel, texture: "fleck" },
  { name: "snow", solid: true, hardness: 0.25, color: [250, 250, 255], lightEmit: 0, category: "ice", drop: TileId.Snow, texture: "flat" },
  { name: "snowy grass", solid: true, hardness: 0.4, color: [210, 230, 210], lightEmit: 0, category: "natural", drop: TileId.Dirt, texture: "twoTone" },
  { name: "ice", solid: true, hardness: 0.6, color: [180, 220, 255], lightEmit: 0, category: "ice", drop: null, texture: "flat" },
  
  // Grass variants for biomes
  { name: "jungle grass", solid: true, hardness: 0.35, color: [68, 140, 48], lightEmit: 0, category: "natural", drop: TileId.Dirt, texture: "twoTone", tint: true },
  { name: "podzol", solid: true, hardness: 0.45, color: [112, 82, 56], lightEmit: 0, category: "natural", drop: TileId.Dirt, texture: "dither", tint: true },
  
  // Stone variants
  { name: "stone", solid: true, hardness: 1.0, color: [116, 116, 128], lightEmit: 0, category: "stone", drop: TileId.Stone, texture: "dither", tint: true },
  { name: "deep stone", solid: true, hardness: 1.7, color: [78, 82, 104], lightEmit: 0, category: "stone", drop: TileId.DeepStone, texture: "dither", tint: true },
  { name: "hellstone", solid: true, hardness: 2.6, color: [156, 58, 42], lightEmit: 120, category: "stone", drop: TileId.Hellstone, texture: "dither", tint: true },
  { name: "granite", solid: true, hardness: 1.3, color: [140, 120, 110], lightEmit: 0, category: "stone", drop: TileId.Granite, texture: "fleck" },
  { name: "basalt", solid: true, hardness: 1.4, color: [60, 56, 70], lightEmit: 0, category: "stone", drop: TileId.Basalt, texture: "dither", tint: true },
  { name: "limestone", solid: true, hardness: 1.1, color: [196, 192, 176], lightEmit: 0, category: "stone", drop: TileId.Limestone, texture: "flat" },
  { name: "mossy stone", solid: true, hardness: 1.0, color: [92, 108, 76], lightEmit: 0, category: "stone", drop: TileId.MossyStone, texture: "fleck" },
  { name: "obsidian", solid: true, hardness: 2.2, color: [32, 28, 44], lightEmit: 0, category: "stone", drop: TileId.Obsidian, texture: "flat" },
  
  // Sky blocks
  { name: "cloudstone", solid: true, hardness: 0.5, color: [222, 228, 240], lightEmit: 0, category: "stone", drop: TileId.CloudStone, texture: "flat" },
  { name: "skystone", solid: true, hardness: 0.8, color: [164, 172, 200], lightEmit: 0, category: "stone", drop: TileId.SkyStone, texture: "dither", tint: true },
  
  // Ores (rendered as stone-with-coloured-fleck)
  { name: "coal ore", solid: true, hardness: 1.2, color: [116, 116, 128], lightEmit: 0, category: "ore", drop: TileId.CoalOre, texture: "fleck" },
  { name: "copper ore", solid: true, hardness: 1.3, color: [116, 116, 128], lightEmit: 0, category: "ore", drop: TileId.CopperOre, texture: "fleck" },
  { name: "iron ore", solid: true, hardness: 1.4, color: [116, 116, 128], lightEmit: 0, category: "ore", drop: TileId.IronOre, texture: "fleck" },
  { name: "gold ore", solid: true, hardness: 1.5, color: [116, 116, 128], lightEmit: 0, category: "ore", drop: TileId.GoldOre, texture: "fleck" },
  { name: "silver ore", solid: true, hardness: 1.5, color: [116, 116, 128], lightEmit: 0, category: "ore", drop: TileId.SilverOre, texture: "fleck" },
  { name: "ruby", solid: true, hardness: 1.8, color: [180, 60, 60], lightEmit: 0, category: "gem", drop: TileId.Ruby, texture: "flat" },
  { name: "sapphire", solid: true, hardness: 1.8, color: [60, 100, 180], lightEmit: 0, category: "gem", drop: TileId.Sapphire, texture: "flat" },
  { name: "emerald", solid: true, hardness: 1.9, color: [60, 160, 80], lightEmit: 0, category: "gem", drop: TileId.Emerald, texture: "flat" },
  { name: "diamond", solid: true, hardness: 2.0, color: [180, 220, 255], lightEmit: 0, category: "gem", drop: TileId.Diamond, texture: "flat" },
  { name: "crystal", solid: true, hardness: 1.7, color: [200, 180, 255], lightEmit: 30, category: "gem", drop: TileId.Crystal, texture: "flat" },
  
  // Wood logs
  { name: "oak log", solid: true, hardness: 0.6, color: [132, 94, 56], lightEmit: 0, category: "wood", drop: TileId.OakLog, texture: "twoTone", tint: true },
  { name: "birch log", solid: true, hardness: 0.5, color: [214, 196, 166], lightEmit: 0, category: "wood", drop: TileId.BirchLog, texture: "twoTone", tint: true },
  { name: "pine log", solid: true, hardness: 0.65, color: [92, 66, 44], lightEmit: 0, category: "wood", drop: TileId.PineLog, texture: "twoTone", tint: true },
  { name: "jungle log", solid: true, hardness: 0.7, color: [108, 78, 48], lightEmit: 0, category: "wood", drop: TileId.JungleLog, texture: "twoTone", tint: true },
  
  // Leaves
  { name: "oak leaves", solid: true, hardness: 0.2, color: [92, 148, 68], lightEmit: 0, category: "plant", drop: TileId.Sapling, texture: "dither", tint: true },
  { name: "birch leaves", solid: true, hardness: 0.15, color: [164, 200, 132], lightEmit: 0, category: "plant", drop: TileId.Sapling, texture: "dither", tint: true },
  { name: "pine leaves", solid: true, hardness: 0.25, color: [56, 92, 48], lightEmit: 0, category: "plant", drop: TileId.Sapling, texture: "dither", tint: true },
  { name: "jungle leaves", solid: true, hardness: 0.2, color: [68, 124, 52], lightEmit: 0, category: "plant", drop: TileId.Sapling, texture: "dither", tint: true },
  
  // Plants and vegetation
  { name: "cactus", solid: true, hardness: 0.4, color: [76, 140, 56], lightEmit: 0, category: "plant", drop: null, texture: "twoTone" },
  { name: "vines", solid: false, hardness: 0.1, color: [68, 108, 52], lightEmit: 0, category: "plant", drop: null, texture: "flat" },
  { name: "tall grass", solid: false, hardness: 0.05, color: [92, 132, 56], lightEmit: 0, category: "deco", drop: null, texture: "flat" },
  { name: "flower", solid: false, hardness: 0.05, color: [220, 100, 140], lightEmit: 0, category: "deco", drop: null, texture: "flat" },
  { name: "mushroom", solid: false, hardness: 0.05, color: [180, 80, 80], lightEmit: 0, category: "deco", drop: null, texture: "flat" },
  { name: "dead bush", solid: false, hardness: 0.05, color: [164, 148, 116], lightEmit: 0, category: "deco", drop: null, texture: "flat" },
  { name: "sapling", solid: false, hardness: 0.05, color: [92, 132, 56], lightEmit: 0, category: "plant", drop: null, texture: "flat" },
  
  // Structure blocks
  { name: "cobblestone", solid: true, hardness: 1.1, color: [108, 108, 116], lightEmit: 0, category: "structure", drop: TileId.Cobblestone, texture: "fleck" },
  { name: "stone brick", solid: true, hardness: 1.2, color: [132, 132, 140], lightEmit: 0, category: "structure", drop: TileId.StoneBrick, texture: "flat" },
  { name: "planks", solid: true, hardness: 0.5, color: [186, 150, 106], lightEmit: 0, category: "structure", drop: TileId.Planks, texture: "flat" },
  { name: "glass", solid: true, hardness: 0.3, color: [200, 220, 240], lightEmit: 0, category: "structure", drop: null, texture: "flat" },
  { name: "bricks", solid: true, hardness: 1.3, color: [164, 80, 76], lightEmit: 0, category: "structure", drop: TileId.Bricks, texture: "flat" },
  { name: "hay", solid: true, hardness: 0.3, color: [222, 200, 116], lightEmit: 0, category: "structure", drop: TileId.Hay, texture: "flat" },
  { name: "bookshelf", solid: true, hardness: 0.6, color: [140, 100, 64], lightEmit: 0, category: "structure", drop: TileId.Planks, texture: "fleck" },
  { name: "lantern", solid: false, hardness: 0.2, color: [200, 180, 140], lightEmit: 200, category: "structure", drop: TileId.Lantern, texture: "flat" },
  
  // Light sources
  { name: "torch", solid: false, hardness: 0.1, color: [240, 180, 90], lightEmit: 230, category: "structure", drop: TileId.Torch, texture: "flat" },

  // Background walls (non-collidable; colours are the dark "behind" tone; drop handled later).
  { name: "dirt wall", solid: false, hardness: 0.5, color: [72, 52, 36], lightEmit: 0, category: "wall", drop: null, texture: "dither" },
  { name: "stone wall", solid: false, hardness: 0.6, color: [58, 58, 68], lightEmit: 0, category: "wall", drop: null, texture: "dither" },
  { name: "granite wall", solid: false, hardness: 0.7, color: [70, 60, 58], lightEmit: 0, category: "wall", drop: null, texture: "dither" },
  { name: "basalt wall", solid: false, hardness: 0.7, color: [34, 32, 42], lightEmit: 0, category: "wall", drop: null, texture: "dither" },
  { name: "sandstone wall", solid: false, hardness: 0.6, color: [120, 104, 74], lightEmit: 0, category: "wall", drop: null, texture: "dither" },
  { name: "mud wall", solid: false, hardness: 0.5, color: [58, 42, 28], lightEmit: 0, category: "wall", drop: null, texture: "dither" },
  { name: "snow wall", solid: false, hardness: 0.5, color: [138, 150, 170], lightEmit: 0, category: "wall", drop: null, texture: "dither" },
  { name: "hell wall", solid: false, hardness: 0.8, color: [70, 30, 26], lightEmit: 0, category: "wall", drop: null, texture: "dither" },
  { name: "wood wall", solid: false, hardness: 0.5, color: [74, 52, 32], lightEmit: 0, category: "wall", drop: null, texture: "flat" },
  { name: "stone brick wall", solid: false, hardness: 0.6, color: [66, 66, 74], lightEmit: 0, category: "wall", drop: null, texture: "flat" },
  { name: "brick wall", solid: false, hardness: 0.6, color: [92, 46, 42], lightEmit: 0, category: "wall", drop: null, texture: "flat" },
  { name: "glass wall", solid: false, hardness: 0.3, color: [120, 150, 180], lightEmit: 0, category: "wall", drop: null, texture: "flat" },

  // Phase 4 ores (stone-base colour; the coloured fleck comes from oreFleckColor) + two more gems.
  { name: "tin ore", solid: true, hardness: 1.3, color: [116, 116, 128], lightEmit: 0, category: "ore", drop: TileId.TinOre, texture: "fleck" },
  { name: "lead ore", solid: true, hardness: 1.4, color: [116, 116, 128], lightEmit: 0, category: "ore", drop: TileId.LeadOre, texture: "fleck" },
  { name: "tungsten ore", solid: true, hardness: 1.5, color: [116, 116, 128], lightEmit: 0, category: "ore", drop: TileId.TungstenOre, texture: "fleck" },
  { name: "platinum ore", solid: true, hardness: 1.6, color: [116, 116, 128], lightEmit: 0, category: "ore", drop: TileId.PlatinumOre, texture: "fleck" },
  { name: "amethyst", solid: true, hardness: 1.7, color: [150, 90, 200], lightEmit: 0, category: "gem", drop: TileId.Amethyst, texture: "flat" },
  { name: "topaz", solid: true, hardness: 1.7, color: [220, 170, 60], lightEmit: 0, category: "gem", drop: TileId.Topaz, texture: "flat" },

  // Hardmode ores (reserved; render like ores if ever placed). Higher hardness (need better tools).
  { name: "cobalt ore", solid: true, hardness: 2.2, color: [116, 116, 128], lightEmit: 0, category: "ore", drop: TileId.CobaltOre, texture: "fleck" },
  { name: "palladium ore", solid: true, hardness: 2.3, color: [116, 116, 128], lightEmit: 0, category: "ore", drop: TileId.PalladiumOre, texture: "fleck" },
  { name: "mythril ore", solid: true, hardness: 2.5, color: [116, 116, 128], lightEmit: 0, category: "ore", drop: TileId.MythrilOre, texture: "fleck" },
  { name: "orichalcum ore", solid: true, hardness: 2.6, color: [116, 116, 128], lightEmit: 0, category: "ore", drop: TileId.OrichalcumOre, texture: "fleck" },
  { name: "adamantite ore", solid: true, hardness: 2.8, color: [116, 116, 128], lightEmit: 0, category: "ore", drop: TileId.AdamantiteOre, texture: "fleck" },
  { name: "titanium ore", solid: true, hardness: 3.0, color: [116, 116, 128], lightEmit: 0, category: "ore", drop: TileId.TitaniumOre, texture: "fleck" },

  // Phase 6 underground-biome tiles.
  { name: "marble", solid: true, hardness: 1.5, color: [212, 216, 226], lightEmit: 0, category: "stone", drop: TileId.Marble, texture: "twoTone" },
  { name: "mushroom grass", solid: true, hardness: 0.5, color: [96, 150, 158], lightEmit: 95, category: "natural", drop: TileId.Mud, texture: "dither", tint: true },
  { name: "glowing mushroom", solid: false, hardness: 0.1, color: [130, 214, 220], lightEmit: 150, category: "plant", drop: TileId.GlowMushroom, texture: "flat" },

  // Phase 7 evil-biome tiles.
  { name: "corrupt grass", solid: true, hardness: 0.5, color: [124, 96, 176], lightEmit: 0, category: "natural", drop: TileId.Ebonstone, texture: "dither", tint: true },
  { name: "ebonstone", solid: true, hardness: 1.6, color: [66, 58, 92], lightEmit: 0, category: "stone", drop: TileId.Ebonstone, texture: "dither", tint: true },
  { name: "crimson grass", solid: true, hardness: 0.5, color: [184, 72, 74], lightEmit: 0, category: "natural", drop: TileId.Crimstone, texture: "dither", tint: true },
  { name: "crimstone", solid: true, hardness: 1.6, color: [104, 48, 54], lightEmit: 0, category: "stone", drop: TileId.Crimstone, texture: "dither", tint: true },
  { name: "demon altar", solid: true, hardness: 3.0, color: [92, 78, 116], lightEmit: 45, category: "deco", drop: null, texture: "fleck" },
  { name: "crimson altar", solid: true, hardness: 3.0, color: [120, 60, 66], lightEmit: 45, category: "deco", drop: null, texture: "fleck" },
  { name: "shadow orb", solid: true, hardness: 1.0, color: [126, 96, 192], lightEmit: 90, category: "gem", drop: null, texture: "flat" },
  { name: "crimson heart", solid: true, hardness: 1.0, color: [210, 66, 84], lightEmit: 90, category: "gem", drop: null, texture: "flat" },
  // Reserved Hallow (not generated yet).
  { name: "pearlstone", solid: true, hardness: 1.6, color: [222, 214, 234], lightEmit: 0, category: "stone", drop: TileId.PearlStone, texture: "dither" },
  { name: "hallowed grass", solid: true, hardness: 0.5, color: [120, 206, 224], lightEmit: 0, category: "natural", drop: TileId.PearlStone, texture: "dither", tint: true },
  { name: "pearlsand", solid: true, hardness: 0.6, color: [232, 222, 238], lightEmit: 0, category: "sand", drop: TileId.PearlSand, texture: "dither" },

  // Phase 8 dungeon tiles.
  { name: "blue dungeon brick", solid: true, hardness: 2.0, color: [58, 66, 104], lightEmit: 0, category: "structure", drop: TileId.DungeonBrickBlue, texture: "flat" },
  { name: "green dungeon brick", solid: true, hardness: 2.0, color: [54, 92, 74], lightEmit: 0, category: "structure", drop: TileId.DungeonBrickGreen, texture: "flat" },
  { name: "pink dungeon brick", solid: true, hardness: 2.0, color: [110, 66, 96], lightEmit: 0, category: "structure", drop: TileId.DungeonBrickPink, texture: "flat" },
  { name: "blue dungeon wall", solid: false, hardness: 1.0, color: [34, 40, 66], lightEmit: 0, category: "wall", drop: null, texture: "flat" },
  { name: "green dungeon wall", solid: false, hardness: 1.0, color: [32, 56, 46], lightEmit: 0, category: "wall", drop: null, texture: "flat" },
  { name: "pink dungeon wall", solid: false, hardness: 1.0, color: [68, 40, 60], lightEmit: 0, category: "wall", drop: null, texture: "flat" },
  { name: "spikes", solid: true, hardness: 1.6, color: [120, 122, 134], lightEmit: 0, category: "structure", drop: null, texture: "flat" },
  { name: "cobweb", solid: false, hardness: 0.1, color: [214, 218, 228], lightEmit: 0, category: "deco", drop: null, texture: "flat" },
  { name: "gold chest", solid: true, hardness: 2.0, color: [214, 180, 74], lightEmit: 20, category: "deco", drop: null, texture: "fleck" },
  { name: "dungeon door", solid: true, hardness: 8.0, color: [96, 84, 128], lightEmit: 0, category: "structure", drop: null, texture: "flat" },
];

export function tile(id: number): TileProps {
  return TILE_PROPS[id] ?? TILE_PROPS[0];
}

export function isSolid(id: number): boolean {
  return TILE_PROPS[id]?.solid ?? false;
}

/** Whether a tile id is a background wall (lives in the bg layer, never collides). */
export function isWall(id: number): boolean {
  return TILE_PROPS[id]?.category === "wall";
}

/** The natural background wall that sits behind a given terrain material (0 = none, e.g. sky). */
export function naturalWall(material: number): number {
  switch (material) {
    case TileId.Dirt: case TileId.Grass: case TileId.Podzol: case TileId.SnowyGrass:
    case TileId.Clay: case TileId.Gravel:
      return TileId.DirtWall;
    case TileId.Mud: case TileId.JungleGrass:
      return TileId.MudWall;
    case TileId.Snow: case TileId.Ice:
      return TileId.SnowWall;
    case TileId.Sand: case TileId.Sandstone:
      return TileId.SandstoneWall;
    case TileId.Granite:
      return TileId.GraniteWall;
    case TileId.Basalt:
      return TileId.BasaltWall;
    case TileId.Hellstone: case TileId.Obsidian:
      return TileId.HellWall;
    case TileId.Stone: case TileId.DeepStone: case TileId.Limestone: case TileId.MossyStone:
      return TileId.StoneWall;
    case TileId.CloudStone: case TileId.SkyStone: case TileId.Air:
      return 0; // sky / floating islands: open, no wall
    default:
      return TileId.StoneWall;
  }
}

/** Get the fleck colour for ores (coloured specks on stone base). */
export function oreFleckColor(tileId: TileId): readonly [number, number, number] | null {
  switch (tileId) {
    case TileId.CoalOre: return [30, 30, 35];
    case TileId.CopperOre: return [184, 115, 51];
    case TileId.IronOre: return [224, 224, 224];
    case TileId.GoldOre: return [255, 215, 0];
    case TileId.SilverOre: return [220, 220, 230];
    case TileId.TinOre: return [170, 158, 128];
    case TileId.LeadOre: return [96, 100, 120];
    case TileId.TungstenOre: return [196, 205, 196];
    case TileId.PlatinumOre: return [226, 232, 244];
    case TileId.CobaltOre: return [46, 96, 196];
    case TileId.PalladiumOre: return [206, 120, 74];
    case TileId.MythrilOre: return [70, 180, 146];
    case TileId.OrichalcumOre: return [206, 116, 196];
    case TileId.AdamantiteOre: return [204, 72, 96];
    case TileId.TitaniumOre: return [150, 152, 168];
    default: return null;
  }
}

// --- Phase A: rendering + lighting classification helpers ------------------
// Kept as functions (not per-entry fields) so we don't have to touch all 57 TILE_PROPS rows.

/** Light opacity of a foreground tile: 0 = fully transparent, 1 = fully blocking. */
export function fgOpacity(id: number): number {
  if (id === TileId.Air) return 0;
  if (id === TileId.Glass) return 0.1; // windows pass most light
  if (id >= TileId.OakLeaves && id <= TileId.JungleLeaves) return 0.55; // canopies dapple light
  if (!isSolid(id)) return 0.05; // deco/plants barely occlude
  return 1;
}

/** Opacity contribution of a background wall (when the foreground is empty). */
export const WALL_OPACITY = 0.15;

/** Blocks that grow a fringe of strands/moss/snow over their top edge. */
export function hasOverhang(id: number): boolean {
  return (
    id === TileId.Grass ||
    id === TileId.SnowyGrass ||
    id === TileId.JungleGrass ||
    id === TileId.Podzol ||
    id === TileId.MossyStone
  );
}

/** Colour of the overhang fringe for a given top block. */
export function overhangColor(id: number): readonly [number, number, number] {
  if (id === TileId.SnowyGrass) return [250, 250, 255];
  if (id === TileId.JungleGrass) return [78, 156, 54];
  if (id === TileId.MossyStone) return [96, 128, 72];
  return [104, 186, 74]; // grass / podzol green
}

/** Tiles that should render as smoothed 45° slopes on exposed hill edges. */
export function canSlope(id: number): boolean {
  if (!isSolid(id)) return false;
  const c = TILE_PROPS[id]?.category;
  return c === "natural" || c === "stone" || c === "sand" || c === "ice";
}

/** Whether a tile connects (for auto-tiling edge detection) — any solid block. */
export function connectsForAutotile(id: number): boolean {
  return isSolid(id);
}

// --- Phase 1: structured metadata accessors (value from the row, else a category-derived default) ---

/** Which tool mines this tile best/required. */
export function tileToolType(id: number): ToolType {
  const p = TILE_PROPS[id];
  if (!p) return ToolType.None;
  if (p.toolType !== undefined) return p.toolType;
  if (p.category === "wood") return ToolType.Axe;
  return ToolType.Pick; // dirt/sand/stone/ore/gem/ice all mine with a pick in Terraria
}

/** Mining power required to break the tile (Phase 22 gates deep ore behind better picks). */
export function tileTier(id: number): number {
  const p = TILE_PROPS[id];
  if (!p) return 0;
  if (p.tier !== undefined) return p.tier;
  const h = p.hardness;
  return h < 1 ? 0 : h < 1.5 ? 1 : h < 2 ? 2 : 3;
}

/** Behaviour flags for the tile (falling sand, flammable, climbable, …). */
export function tileFlags(id: number): number {
  const p = TILE_PROPS[id];
  if (!p) return 0;
  if (p.flags !== undefined) return p.flags;
  let f = 0;
  if (id === TileId.Sand || id === TileId.Gravel) f |= TileFlag.Falls;
  if (p.category === "wood" || id === TileId.Planks || id === TileId.Bookshelf || id === TileId.Hay) f |= TileFlag.Flammable;
  if (id === TileId.Vines) f |= TileFlag.Climbable;
  if (p.drop === null && !p.solid) f |= TileFlag.NoDrop;
  return f;
}
export function hasTileFlag(id: number, flag: TileFlag): boolean {
  return (tileFlags(id) & flag) !== 0;
}

/** Auto-tile blend group (defaults to the tile's own id — only same-group tiles merge). */
export function tileMergeGroup(id: number): number {
  return TILE_PROPS[id]?.mergeGroup ?? id;
}

/** Default background wall this block forms a natural layer with (0 = none). */
export function tileWall(id: number): number {
  return TILE_PROPS[id]?.wall ?? 0;
}

/** Explosion resistance (defaults to a multiple of hardness). */
export function tileBlastResistance(id: number): number {
  const p = TILE_PROPS[id];
  if (!p) return 0;
  return p.blastResistance ?? p.hardness * 10;
}

/** Footstep/mining sound bucket. */
export function tileSoundGroup(id: number): string {
  const p = TILE_PROPS[id];
  if (!p) return "generic";
  if (p.soundGroup !== undefined) return p.soundGroup;
  switch (p.category) {
    case "stone": case "ore": case "gem": return "stone";
    case "wood": return "wood";
    case "sand": return "sand";
    case "ice": return "ice";
    case "plant": case "deco": return "grass";
    default: return "generic";
  }
}
