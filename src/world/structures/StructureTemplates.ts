import { TileId } from "../Tile";

// Hand-authored structure prefabs. The WORLD is procedural, but structures are designed
// tile-by-tile here so they can be detailed and intentional. Each template is a grid of
// row-strings; a char maps (via `legend`) to a foreground + background tile pair. The
// placement engine (Structures.ts) picks a template by context, anchors it to the terrain,
// optionally mirrors it, and blits the tiles that fall in each chunk — deterministic + seamless.

export type StructureContext = "surface" | "underground" | "sky";

export interface StructureTemplate {
  name: string;
  context: StructureContext;
  anchorRow: number; // which row sits on the ground (surface structures)
  rows: readonly string[];
}

export interface CellDef {
  fg: TileId;
  bg: TileId;
}

const A = TileId.Air;
// Legend: char -> { foreground, background wall }.
export function legend(ch: string): CellDef | null {
  switch (ch) {
    case " ": return null; // skip: leave the terrain as-is
    case ".": return { fg: A, bg: TileId.Planks }; // interior air, wood back-wall
    case ",": return { fg: A, bg: TileId.StoneBrick }; // interior air, stone back-wall
    case "#": return { fg: TileId.StoneBrick, bg: TileId.StoneBrick };
    case "%": return { fg: TileId.Cobblestone, bg: TileId.Cobblestone };
    case "=": return { fg: TileId.Planks, bg: TileId.Planks };
    case "_": return { fg: TileId.Planks, bg: TileId.Planks }; // floor
    case "|": return { fg: TileId.OakLog, bg: TileId.Planks }; // post/beam
    case "r": return { fg: TileId.Planks, bg: A }; // wood roof (sky behind)
    case "^": return { fg: TileId.Cobblestone, bg: A }; // stone roof
    case "o": return { fg: TileId.Cobblestone, bg: A }; // exposed stone (well ring, etc.)
    case "s": return { fg: TileId.SkyStone, bg: A };
    case "C": return { fg: TileId.CloudStone, bg: A };
    case "G": return { fg: TileId.Glass, bg: TileId.Planks }; // window
    case "O": return { fg: A, bg: TileId.Glass }; // glass back-pane (lets light in)
    case "D": return { fg: A, bg: TileId.Planks }; // doorway (open)
    case "T": return { fg: TileId.Torch, bg: TileId.Planks };
    case "L": return { fg: TileId.Lantern, bg: TileId.Planks };
    case "H": return { fg: TileId.Hay, bg: TileId.Planks }; // bed
    case "K": return { fg: TileId.Bookshelf, bg: TileId.Planks };
    case "*": return { fg: TileId.Crystal, bg: A };
    default: return null;
  }
}

export const TEMPLATES: readonly StructureTemplate[] = [
  {
    name: "cottage",
    context: "surface",
    anchorRow: 7,
    rows: [
      "   rrr   ",
      "  rrrrr  ",
      " rrrrrrr ",
      " #_____# ",
      " #G...G# ",
      " #.....# ",
      " #H.T.K# ",
      " ##D__## ",
    ],
  },
  {
    name: "watchtower",
    context: "surface",
    anchorRow: 11,
    rows: [
      " ^^^ ",
      " #T# ",
      " #.# ",
      " #G# ",
      " #.# ",
      " #G# ",
      " #.# ",
      " #G# ",
      " #.# ",
      " #K# ",
      " #D# ",
      " ### ",
    ],
  },
  {
    name: "well",
    context: "surface",
    anchorRow: 3,
    rows: [
      "o___o",
      "o,,,o",
      "%,,,%",
      "%%%%%",
    ],
  },
  {
    name: "crypt",
    context: "underground",
    anchorRow: 5,
    rows: [
      "#########",
      "#,,,,,,,#",
      "#,K,T,K,#",
      "#,,,,,,,#",
      "#,H,,,H,#",
      "#########",
    ],
  },
  {
    name: "sky shrine",
    context: "sky",
    anchorRow: 5,
    rows: [
      "  sss  ",
      " s * s ",
      "sO...Os",
      "s.....s",
      "s.L.L.s",
      "sssssss",
    ],
  },
];

/** Deterministically pick a template for a context using a [0,1) hash; null if none exist. */
export function pickTemplate(context: StructureContext, h: number): StructureTemplate | null {
  const list = TEMPLATES.filter((t) => t.context === context);
  if (list.length === 0) return null;
  return list[Math.floor(h * 997) % list.length];
}
