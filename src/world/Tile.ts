// Tile catalogue. Kept intentionally small for Phase 1 — depth bands are conveyed by
// distinct stone variants so descending visibly passes through layers. Phase 2 expands
// this into ores, biome blocks, structures, machines, etc.

export const enum TileId {
  Air = 0,
  Grass = 1,
  Dirt = 2,
  Stone = 3,
  DeepStone = 4, // caverns
  Hellstone = 5, // underworld
  CloudStone = 6, // sky islands (Phase 2 content; defined now for palette continuity)
  Torch = 7, // light-emitting placeable
}

export interface TileProps {
  name: string;
  solid: boolean;
  hardness: number; // seconds of mining at tool speed 1
  color: readonly [number, number, number];
  lightEmit: number; // 0 = none; drives point lighting
}

// Indexed by TileId. Order must match the enum.
export const TILE_PROPS: readonly TileProps[] = [
  { name: "air", solid: false, hardness: 0, color: [0, 0, 0], lightEmit: 0 },
  { name: "grass", solid: true, hardness: 0.35, color: [92, 168, 66], lightEmit: 0 },
  { name: "dirt", solid: true, hardness: 0.45, color: [122, 86, 56], lightEmit: 0 },
  { name: "stone", solid: true, hardness: 1.0, color: [116, 116, 128], lightEmit: 0 },
  { name: "deep stone", solid: true, hardness: 1.7, color: [78, 82, 104], lightEmit: 0 },
  { name: "hellstone", solid: true, hardness: 2.6, color: [156, 58, 42], lightEmit: 120 },
  { name: "cloudstone", solid: true, hardness: 0.5, color: [222, 228, 240], lightEmit: 0 },
  { name: "torch", solid: false, hardness: 0.1, color: [240, 180, 90], lightEmit: 230 },
];

export function tile(id: number): TileProps {
  return TILE_PROPS[id] ?? TILE_PROPS[0];
}

export function isSolid(id: number): boolean {
  return TILE_PROPS[id]?.solid ?? false;
}
