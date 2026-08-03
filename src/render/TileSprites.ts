import { SPRITE_PX, SPRITE_VARIANTS } from "../config";
import { TILE_PROPS, TileId, oreFleckColor, tile } from "../world/Tile";
import { hash2 } from "../world/Noise";

// Procedurally renders each block into a set of small pixel-art sprite canvases (once, at
// startup) from its palette. Interior faces get a subtle dithered texture + material detail
// (brick courses, wood grain, ore flecks, glass sheen); edge bevels and overhang fringe are
// drawn at render time by the Renderer based on neighbours, so a solid mass reads as one
// surface rather than a grid of separate blocks.

type RGB = readonly [number, number, number];

function shade([r, g, b]: RGB, f: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

export class TileSprites {
  readonly px = SPRITE_PX;
  private variants: (HTMLCanvasElement | null)[][] = [];

  constructor() {
    for (let id = 0; id < TILE_PROPS.length; id++) {
      const set: (HTMLCanvasElement | null)[] = [];
      if (id === TileId.Air) {
        this.variants.push([null, null, null, null]);
        continue;
      }
      for (let v = 0; v < SPRITE_VARIANTS; v++) set.push(this.render(id, v));
      this.variants.push(set);
    }
  }

  /** A cached sprite canvas for a tile id + variant index (wraps around). */
  get(id: number, variant: number): HTMLCanvasElement | null {
    const set = this.variants[id] ?? this.variants[0];
    return set[((variant % set.length) + set.length) % set.length];
  }

  private render(id: number, variant: number): HTMLCanvasElement {
    const px = this.px;
    const cv = document.createElement("canvas");
    cv.width = px;
    cv.height = px;
    const ctx = cv.getContext("2d")!;
    const props = tile(id);
    const col = props.color;
    const cat = props.category;
    const rough = cat === "stone" || cat === "ore" || cat === "natural" || cat === "sand";

    // 1) Base dithered texture.
    for (let y = 0; y < px; y++) {
      for (let x = 0; x < px; x++) {
        const n = hash2(x + variant * 37 + id * 13, y * 101 + id * 5, id * 7 + variant * 3);
        let f = 1;
        if (rough) f = n < 0.24 ? 0.84 : n > 0.83 ? 1.12 : 1;
        else f = n < 0.14 ? 0.9 : n > 0.9 ? 1.08 : 1;
        ctx.fillStyle = shade(col, f);
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // 2) Material detail.
    if (id >= TileId.OakLog && id <= TileId.JungleLog) this.woodGrain(ctx, col);
    else if (id === TileId.Planks || id === TileId.Bookshelf || id === TileId.Hay) this.planks(ctx, col);
    else if (id === TileId.Cobblestone || id === TileId.StoneBrick || id === TileId.Bricks) this.brick(ctx, col);
    else if (id === TileId.Glass) this.glass(ctx, col);
    else if (cat === "ore") this.oreFlecks(ctx, id, variant);
    else if (cat === "gem") this.gem(ctx, col);

    return cv;
  }

  private woodGrain(ctx: CanvasRenderingContext2D, col: RGB): void {
    ctx.fillStyle = shade(col, 0.72);
    for (const x of [3, 4, 10, 11]) ctx.fillRect(x, 0, 1, this.px);
    ctx.fillStyle = shade(col, 1.14);
    ctx.fillRect(7, 0, 1, this.px);
  }

  private planks(ctx: CanvasRenderingContext2D, col: RGB): void {
    ctx.fillStyle = shade(col, 0.68);
    for (let y = 0; y < this.px; y += 5) ctx.fillRect(0, y, this.px, 1);
    ctx.fillStyle = shade(col, 0.8);
    ctx.fillRect(8, 0, 1, 5);
    ctx.fillRect(4, 5, 1, 5);
    ctx.fillRect(12, 10, 1, 6);
  }

  private brick(ctx: CanvasRenderingContext2D, col: RGB): void {
    const mortar = shade(col, 0.6);
    ctx.fillStyle = mortar;
    for (let y = 0; y < this.px; y += 4) ctx.fillRect(0, y, this.px, 1); // courses
    // offset vertical joints per course
    let off = 0;
    for (let y = 0; y < this.px; y += 4) {
      for (let x = off; x < this.px; x += 8) ctx.fillRect(x, y, 1, 4);
      off = off === 0 ? 4 : 0;
    }
  }

  private glass(ctx: CanvasRenderingContext2D, col: RGB): void {
    ctx.clearRect(1, 1, this.px - 2, this.px - 2);
    ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},0.28)`;
    ctx.fillRect(1, 1, this.px - 2, this.px - 2);
    ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},0.9)`;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, this.px - 1, this.px - 1);
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.moveTo(3, 12);
    ctx.lineTo(11, 3);
    ctx.stroke();
  }

  private oreFlecks(ctx: CanvasRenderingContext2D, id: number, variant: number): void {
    const fleck = oreFleckColor(id) ?? [255, 255, 255];
    ctx.fillStyle = `rgb(${fleck[0]},${fleck[1]},${fleck[2]})`;
    for (let k = 0; k < 5; k++) {
      const hx = hash2(id * 3 + k, variant * 9 + 1, id + 17);
      const hy = hash2(id * 5 + k, variant * 7 + 2, id + 31);
      const x = 2 + Math.floor(hx * (this.px - 5));
      const y = 2 + Math.floor(hy * (this.px - 5));
      ctx.fillRect(x, y, 2, 2);
    }
  }

  private gem(ctx: CanvasRenderingContext2D, col: RGB): void {
    ctx.fillStyle = shade(col, 1.5);
    ctx.fillRect(6, 5, 3, 3);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(7, 6, 1, 1);
    ctx.fillStyle = shade(col, 0.6);
    ctx.fillRect(9, 9, 2, 2);
  }
}
