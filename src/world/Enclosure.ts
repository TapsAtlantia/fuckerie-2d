import { isSolid, isWall } from "./Tile";
import type { ChunkManager } from "./ChunkManager";

// A tile is "enclosed" (used by valid-housing / spawn-control checks in later phases) if you cannot
// reach the open outdoors from it without crossing a solid block — i.e. the interior air is fully
// backed by background walls and bounded by blocks. Bounded flood fill through non-solid tiles:
// it "leaks" (→ not enclosed) if it reaches a passable tile with no wall behind it (open sky), or
// if the region exceeds the tile budget.
export function isEnclosed(world: ChunkManager, tx: number, ty: number, maxTiles = 400): boolean {
  if (isSolid(world.getFg(tx, ty))) return false; // must start in open interior space
  const seen = new Set<string>();
  const stack: Array<[number, number]> = [[tx, ty]];
  seen.add(tx + "," + ty);
  let count = 0;

  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    if (++count > maxTiles) return false; // unbounded → treat as open

    // A passable tile with no wall behind it is "outdoors" → the room leaks.
    if (!isSolid(world.getFg(x, y)) && !isWall(world.getBg(x, y))) return false;

    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      const k = nx + "," + ny;
      if (seen.has(k)) continue;
      seen.add(k);
      if (!isSolid(world.getFg(nx, ny))) stack.push([nx, ny]); // flood through open space only
    }
  }
  return true; // stayed bounded and walled → enclosed
}
