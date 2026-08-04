// Liquids are stored in a per-chunk Uint8Array separate from fg/bg. One byte per tile:
//   0            = empty
//   1..LMAX      = water at that level
//   0x80 | 1..LMAX = lava at that level
// Levels are coarse (0..LMAX) for a stable, cheap cellular-flow simulation.

export const LMAX = 6; // max fill level per tile
export const LAVA_BIT = 0x80;

export function makeLiquid(lava: boolean, level: number): number {
  if (level <= 0) return 0;
  const l = level > LMAX ? LMAX : level;
  return (lava ? LAVA_BIT : 0) | l;
}
export function liquidLevel(v: number): number {
  return v & 0x0f;
}
export function isLava(v: number): boolean {
  return (v & LAVA_BIT) !== 0;
}

// World-gen liquid levels (world-Y tiles; +Y is down).
export const SEA_LEVEL_Y = 18; // basins whose ground sits below this fill with water (oceans/lakes)
export const LAVA_LEVEL_Y = 2000; // deep cave air below this can hold lava

// Rendering
export const WATER_COLOR: readonly [number, number, number] = [54, 118, 214];
export const LAVA_COLOR: readonly [number, number, number] = [232, 96, 24];
export const LAVA_LIGHT = 150; // lava point-light strength
