// Neighbour analysis for rendering: which faces are exposed to open space (for bevels/overhang)
// and whether an exposed hill edge should render as a smoothed 45° slope instead of a boxy square.

export interface TileShape {
  top: boolean; // face exposed to non-solid above
  right: boolean;
  bottom: boolean;
  left: boolean;
}

/** Which faces of a tile are exposed to open space (drives bevels + overhang). */
export function shapeFrom(
  topSolid: boolean,
  rightSolid: boolean,
  bottomSolid: boolean,
  leftSolid: boolean,
  _canSlope: boolean,
): TileShape {
  return { top: !topSolid, right: !rightSolid, bottom: !bottomSolid, left: !leftSolid };
}

// --- Two-tier organic slopes (45° + 22.5°) with a run "delay" -------------------------------
// Only sustained descents become slopes; flat tops and lone steps stay square. This reads far
// more organic than cutting every exposed edge at 45°.

export type SlopeKind = "none" | "left45" | "right45" | "left22" | "right22";

export interface SlopeInfo {
  kind: SlopeKind;
  roundTL: boolean; // chamfer the top-left corner (cliff/peak edge)
  roundTR: boolean;
}

/**
 * Decide a surface tile's slope from a short run of the neighbouring surface profile.
 * `solid(dx, dy)` = is the neighbour at that offset a connecting solid.
 */
export function computeSlope(solid: (dx: number, dy: number) => boolean, canSlope: boolean): SlopeInfo {
  const none: SlopeInfo = { kind: "none", roundTL: false, roundTR: false };
  if (!canSlope || solid(0, -1)) return none; // must be a surface tile (open above)

  // Relative surface level of column dx: how many tiles LOWER than this tile (−1 = higher).
  const level = (dx: number): number => {
    if (solid(dx, -1)) return -1;
    if (solid(dx, 0)) return 0;
    if (solid(dx, 1)) return 1;
    return 2; // ≥2 lower = cliff
  };
  const l1 = level(-1), r1 = level(1), l2 = level(-2), r2 = level(2);

  // Ground descends to the right (higher/level on the left).
  if (r1 >= 1 && l1 <= 0) {
    if (r1 === 1 && r2 >= 2) return { kind: "right45", roundTL: false, roundTR: false }; // sustained steep
    if (r1 === 1) return { kind: "right22", roundTL: false, roundTR: false }; // gentle single step (delay)
    return { kind: "none", roundTL: false, roundTR: true }; // cliff → round the corner instead
  }
  // Ground descends to the left.
  if (l1 >= 1 && r1 <= 0) {
    if (l1 === 1 && l2 >= 2) return { kind: "left45", roundTL: false, roundTR: false };
    if (l1 === 1) return { kind: "left22", roundTL: false, roundTR: false };
    return { kind: "none", roundTL: true, roundTR: false };
  }
  // Isolated peak (both sides drop) → round both corners, keep flat top.
  if (l1 >= 1 && r1 >= 1) return { kind: "none", roundTL: true, roundTR: true };
  return none;
}
