import { TileId, tile } from "../world/Tile";
import { INVENTORY } from "../config";

/**
 * Item data model. Most items are 1:1 with placeable tiles.
 * Icons are rendered from tile draw routines and cached as data URIs.
 */
export interface Item {
  id: number; // unique item ID (may match TileId for placeables)
  name: string;
  maxStack: number;
  placeable: TileId | null; // null if not placeable
  iconDataUri: string | null; // cached icon, null if not yet generated
}

/** Create an item from a tile (for placeable blocks). */
export function itemFromTile(tileId: TileId): Item {
  const props = tile(tileId);
  return {
    id: tileId,
    name: props.name,
    maxStack: INVENTORY.MAX_STACK_SIZE,
    placeable: tileId,
    iconDataUri: null, // generated on first use
  };
}

/** Generate an icon for an item by rendering the tile to a small canvas. */
export function generateItemIcon(item: Item): string {
  if (item.placeable === null) {
    // Non-placeable items would need custom rendering
    return "";
  }
  
  const props = tile(item.placeable);
  const size = 16;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  
  // Draw the tile
  const [r, g, b] = props.color;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, size, size);
  
  // Simple texture hint
  if (props.texture === "twoTone") {
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(0, 0, size, size * 0.25);
  } else if (props.texture === "fleck") {
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fillRect(size * 0.3, size * 0.3, size * 0.3, size * 0.3);
  }
  
  return canvas.toDataURL();
}

/** Cache of generated item icons. */
const iconCache = new Map<number, string>();

export function getItemIcon(item: Item): string {
  if (item.iconDataUri !== null) return item.iconDataUri;
  
  let cached = iconCache.get(item.id);
  if (cached === undefined) {
    cached = generateItemIcon(item);
    iconCache.set(item.id, cached);
    item.iconDataUri = cached;
  }
  return cached;
}
