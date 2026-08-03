// Neighbour analysis for rendering: which faces are exposed to open space (for bevels/overhang)
// and whether an exposed hill edge should render as a smoothed 45° slope instead of a boxy square.

export type SlopeKind = "none" | "left" | "right";

export interface TileShape {
  top: boolean; // face exposed to non-solid above
  right: boolean;
  bottom: boolean;
  left: boolean;
  slope: SlopeKind; // "left" cuts the top-left corner (ground rises to the right), etc.
}

/**
 * Given whether each orthogonal neighbour is a connecting solid, decide which faces are exposed
 * and whether this is a slope edge. Terrain-category tiles turn exposed hill edges into 45° slopes.
 */
export function shapeFrom(
  topSolid: boolean,
  rightSolid: boolean,
  bottomSolid: boolean,
  leftSolid: boolean,
  canSlope: boolean,
): TileShape {
  const top = !topSolid;
  const right = !rightSolid;
  const bottom = !bottomSolid;
  const left = !leftSolid;

  let slope: SlopeKind = "none";
  if (canSlope && top) {
    // A one-sided open top edge = hillside → slope up toward the solid side.
    if (left && !right) slope = "left"; // cut top-left, ground rises to the right
    else if (right && !left) slope = "right"; // cut top-right, ground rises to the left
  }

  return { top, right, bottom, left, slope };
}
