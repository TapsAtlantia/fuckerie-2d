// Tile catalogue. Phase 2 expands to ~50-60 tiles for biomes, ores, structures, vegetation.
// Kept under 256 to fit in Uint8Array fg/bg arrays in Chunk.ts.

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
  | "gem";

export type TileTexture = "flat" | "dither" | "twoTone" | "fleck";

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
];

export function tile(id: number): TileProps {
  return TILE_PROPS[id] ?? TILE_PROPS[0];
}

export function isSolid(id: number): boolean {
  return TILE_PROPS[id]?.solid ?? false;
}

/** Get the fleck colour for ores (coloured specks on stone base). */
export function oreFleckColor(tileId: TileId): readonly [number, number, number] | null {
  switch (tileId) {
    case TileId.CoalOre: return [30, 30, 35];
    case TileId.CopperOre: return [184, 115, 51];
    case TileId.IronOre: return [224, 224, 224];
    case TileId.GoldOre: return [255, 215, 0];
    case TileId.SilverOre: return [220, 220, 230];
    default: return null;
  }
}
