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

    // Shaped props on a transparent canvas (plants, torches) — real objects, not squares.
    if (this.renderShaped(ctx, id, variant)) return cv;

    // Grass-family blocks read as a grassy top over a dirt body.
    if (id === TileId.Grass || id === TileId.JungleGrass || id === TileId.SnowyGrass || id === TileId.Podzol) {
      this.grassBlock(ctx, id, variant);
      return cv;
    }

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
    else if (id === TileId.Cactus) this.cactus(ctx);
    else if (cat === "ore") this.oreFlecks(ctx, id, variant);
    else if (cat === "gem") this.gem(ctx, col);
    else if (cat === "wall") this.wallDetail(ctx, id, col, variant);
    else if (
      id === TileId.Stone || id === TileId.DeepStone || id === TileId.Limestone ||
      id === TileId.Basalt || id === TileId.Sandstone || id === TileId.Hellstone
    ) this.rockClumps(ctx, col, variant);

    return cv;
  }

  /** Draw plants/torches/lanterns as transparent shaped props. Returns true if it handled `id`. */
  private renderShaped(ctx: CanvasRenderingContext2D, id: number, variant: number): boolean {
    switch (id) {
      case TileId.Flower: this.flower(ctx, variant); return true;
      case TileId.TallGrass: this.tallGrass(ctx, variant); return true;
      case TileId.Mushroom: this.mushroom(ctx); return true;
      case TileId.DeadBush: this.deadBush(ctx, variant); return true;
      case TileId.Vines: this.vines(ctx, variant); return true;
      case TileId.Sapling: this.sapling(ctx); return true;
      case TileId.Torch: this.torch(ctx); return true;
      case TileId.Lantern: this.lantern(ctx); return true;
      default: return false;
    }
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

  private wallDetail(ctx: CanvasRenderingContext2D, id: number, col: RGB, variant: number): void {
    if (id === TileId.WoodWall) { this.planks(ctx, col); return; }
    if (id === TileId.StoneBrickWall || id === TileId.BrickWall) { this.brick(ctx, col); return; }
    if (id === TileId.GlassWall) {
      ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},0.35)`;
      ctx.fillRect(0, 0, this.px, this.px);
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath(); ctx.moveTo(3, 12); ctx.lineTo(11, 3); ctx.stroke();
      return;
    }
    // Natural walls: a rough, blotchy "cave wall" look — a few darker/lighter patches.
    for (let k = 0; k < 6; k++) {
      const hx = hash2(k + variant * 3, id, 61);
      const hy = hash2(id, k + variant * 3, 62);
      const x = Math.floor(hx * (this.px - 3));
      const y = Math.floor(hy * (this.px - 3));
      ctx.fillStyle = shade(col, k % 2 === 0 ? 0.78 : 1.14);
      ctx.fillRect(x, y, 3, 2);
    }
  }

  private rockClumps(ctx: CanvasRenderingContext2D, col: RGB, variant: number): void {
    // Rounded pebble clusters so stone reads as organic "cubic" chunks rather than a flat square.
    const spots: Array<[number, number, number]> = [
      [3, 4, 3], [10, 3, 3], [6, 9, 4], [12, 12, 3], [2, 12, 3],
    ];
    for (let k = 0; k < spots.length; k++) {
      const [bx, by, br] = spots[k];
      const jx = (hash2(bx + variant * 5, by, 21) - 0.5) * 2;
      const jy = (hash2(by + variant * 5, bx, 22) - 0.5) * 2;
      const x = bx + jx, y = by + jy;
      ctx.fillStyle = shade(col, 0.8);
      ctx.beginPath(); ctx.arc(x, y, br, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = shade(col, 1.12);
      ctx.beginPath(); ctx.arc(x - 0.7, y - 0.7, br * 0.5, 0, Math.PI * 2); ctx.fill();
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

  private cactus(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "rgb(58,110,44)";
    for (const x of [4, 8, 12]) ctx.fillRect(x, 0, 1, 16);
    ctx.fillStyle = "rgb(96,156,70)";
    for (const x of [2, 6, 10]) ctx.fillRect(x, 0, 1, 16);
    ctx.fillStyle = "rgb(230,230,200)";
    for (const y of [2, 6, 10, 14]) for (const x of [4, 8, 12]) ctx.fillRect(x, y, 1, 1);
  }

  private grassBlock(ctx: CanvasRenderingContext2D, id: number, variant: number): void {
    const dirt: RGB = [122, 86, 56];
    const top: RGB =
      id === TileId.SnowyGrass ? [228, 236, 240]
      : id === TileId.JungleGrass ? [66, 138, 46]
      : id === TileId.Podzol ? [120, 88, 60]
      : [92, 168, 66];
    for (let x = 0; x < 16; x++) {
      const depth = 4 + Math.floor(hash2(x, id * 3 + variant, 88) * 3); // wavy grass/dirt line
      for (let y = 0; y < 16; y++) {
        const n = hash2(x + variant * 11 + id * 7, y * 53 + id, id + variant);
        const base = y < depth ? top : dirt;
        const f = n < 0.22 ? 0.86 : n > 0.82 ? 1.12 : 1;
        ctx.fillStyle = shade(base, f);
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  private flower(ctx: CanvasRenderingContext2D, variant: number): void {
    ctx.fillStyle = "rgb(70,130,50)";
    ctx.fillRect(7, 8, 1, 7);
    ctx.fillRect(8, 9, 1, 6);
    ctx.fillStyle = "rgb(84,152,60)";
    ctx.fillRect(9, 11, 2, 1);
    ctx.fillRect(5, 12, 2, 1);
    const petals: RGB = ([[230, 90, 140], [240, 210, 80], [150, 120, 230], [232, 120, 80]] as RGB[])[variant % 4];
    ctx.fillStyle = `rgb(${petals[0]},${petals[1]},${petals[2]})`;
    ctx.fillRect(6, 4, 4, 3);
    ctx.fillRect(7, 3, 2, 5);
    ctx.fillRect(5, 5, 1, 1);
    ctx.fillRect(10, 5, 1, 1);
    ctx.fillStyle = "rgb(250,230,120)";
    ctx.fillRect(7, 5, 2, 1);
  }

  private tallGrass(ctx: CanvasRenderingContext2D, variant: number): void {
    const greens = ["rgb(80,150,60)", "rgb(98,172,72)", "rgb(68,128,52)"];
    const blades = [[3, 11], [5, 8], [7, 5], [9, 7], [11, 9], [13, 12]];
    for (let i = 0; i < blades.length; i++) {
      const [x, topY] = blades[i];
      ctx.fillStyle = greens[(i + variant) % 3];
      ctx.fillRect(x, topY, 1, 16 - topY);
      if (topY < 8) ctx.fillRect(x + 1, topY + 1, 1, 16 - topY - 1);
    }
  }

  private mushroom(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "rgb(224,214,196)";
    ctx.fillRect(7, 9, 2, 6);
    ctx.fillStyle = "rgb(190,60,55)";
    ctx.fillRect(4, 6, 8, 3);
    ctx.fillRect(5, 5, 6, 1);
    ctx.fillStyle = "rgba(255,245,235,0.9)";
    ctx.fillRect(6, 6, 1, 1);
    ctx.fillRect(9, 7, 1, 1);
    ctx.fillRect(8, 5, 1, 1);
  }

  private deadBush(ctx: CanvasRenderingContext2D, variant: number): void {
    ctx.strokeStyle = "rgb(150,120,80)";
    ctx.lineWidth = 1;
    const twigs = [[-4, -6], [4, -7], [-2, -9], [2, -8], [0, -10]];
    for (let i = 0; i < twigs.length; i++) {
      const t = twigs[(i + variant) % twigs.length];
      ctx.beginPath();
      ctx.moveTo(8, 15);
      ctx.lineTo(8 + t[0], 15 + t[1]);
      ctx.stroke();
    }
  }

  private vines(ctx: CanvasRenderingContext2D, variant: number): void {
    ctx.fillStyle = "rgb(66,110,52)";
    const xs = [4, 7, 10, 13];
    for (let i = 0; i < xs.length; i++) {
      const len = 8 + ((i * 3 + variant) % 6);
      ctx.fillRect(xs[i], 0, 1, len);
      ctx.fillRect(xs[i] - 1, 3 + ((i + variant) % 4), 1, 1);
    }
  }

  private sapling(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "rgb(110,80,50)";
    ctx.fillRect(7, 9, 1, 6);
    ctx.fillStyle = "rgb(90,162,70)";
    ctx.fillRect(5, 5, 6, 4);
    ctx.fillRect(6, 4, 4, 1);
  }

  private torch(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "rgba(255,180,80,0.16)"; // faint glow
    ctx.fillRect(4, 1, 8, 9);
    ctx.fillStyle = "rgb(110,72,40)"; // stick
    ctx.fillRect(7, 7, 2, 8);
    ctx.fillStyle = "rgb(88,56,30)";
    ctx.fillRect(7, 7, 1, 8);
    ctx.fillStyle = "rgb(255,150,40)"; // flame
    ctx.fillRect(6, 3, 4, 4);
    ctx.fillStyle = "rgb(255,214,96)";
    ctx.fillRect(7, 2, 2, 4);
    ctx.fillStyle = "rgba(255,244,190,0.95)";
    ctx.fillRect(7, 3, 1, 2);
  }

  private lantern(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "rgb(70,60,45)";
    ctx.fillRect(7, 2, 2, 1);
    ctx.fillRect(6, 3, 4, 1);
    ctx.fillStyle = "rgb(60,50,38)"; // frame
    ctx.fillRect(5, 4, 6, 9);
    ctx.fillStyle = "rgb(255,214,150)"; // warm core
    ctx.fillRect(6, 5, 4, 7);
    ctx.fillStyle = "rgba(255,244,200,0.95)";
    ctx.fillRect(7, 6, 2, 3);
    ctx.fillStyle = "rgb(60,50,38)"; // bar
    ctx.fillRect(7, 4, 1, 9);
  }
}
