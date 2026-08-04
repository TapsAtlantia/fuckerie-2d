import {
  DAYLIGHT,
  LIGHT_ATTEN_AIR,
  LIGHT_ATTEN_SOLID,
  TORCH,
  TORCH_STRENGTH,
} from "../config";
import { TILE_PROPS, TileId, WALL_OPACITY, fgOpacity } from "../world/Tile";
import type { ChunkManager } from "../world/ChunkManager";

// Smooth 2D light propagation over the visible tile region, recomputed each frame.
//
// Model: sky-exposed air columns are seeded with ambient daylight; the player and any
// light-emitting tiles are point sources. A flood fill relaxes light outward, losing more
// per tile through solids than through air (shadow attenuation). Result is written to a
// tile-resolution offscreen canvas which the renderer upscales with bilinear smoothing and
// composites with "multiply" for a soft gradient look.
export class Lighting {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private image: ImageData | null = null;

  originTileX = 0;
  originTileY = 0;
  width = 0;
  height = 0;

  private r = new Int16Array(0);
  private g = new Int16Array(0);
  private b = new Int16Array(0);
  private opacity = new Float32Array(0); // 0 = transparent, 1 = fully blocking
  // Fixed-capacity flood-fill work queue (never grows → can't overflow).
  private q = new Int32Array(0);
  private qCap = 0;
  private qTail = 0;

  constructor() {
    this.canvas = document.createElement("canvas");
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("2D context unavailable for lightmap");
    this.ctx = ctx;
  }

  private ensureSize(w: number, h: number): void {
    if (w === this.width && h === this.height && this.image) return;
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    const area = w * h;
    this.r = new Int16Array(area);
    this.g = new Int16Array(area);
    this.b = new Int16Array(area);
    this.opacity = new Float32Array(area);
    // Each cell can be enqueued a small bounded number of times; 6× area is ample headroom.
    this.qCap = area * 6 + 64;
    this.q = new Int32Array(this.qCap);
    this.image = this.ctx.createImageData(w, h);
  }

  compute(
    world: ChunkManager,
    minTileX: number,
    minTileY: number,
    maxTileX: number,
    maxTileY: number,
    playerTileX: number,
    playerTileY: number,
    dayLevel = 1,
  ): void {
    // Safety clamp: never let the lit region explode (guards against any bad camera/zoom state
    // that would otherwise allocate huge buffers and stall the flood fill).
    const MAX_W = 260;
    const MAX_H = 200;
    if (maxTileX - minTileX + 1 > MAX_W) maxTileX = minTileX + MAX_W - 1;
    if (maxTileY - minTileY + 1 > MAX_H) maxTileY = minTileY + MAX_H - 1;

    const w = maxTileX - minTileX + 1;
    const h = maxTileY - minTileY + 1;
    if (w <= 0 || h <= 0) return;
    this.ensureSize(w, h);
    this.originTileX = minTileX;
    this.originTileY = minTileY;

    const { r, g, b, opacity } = this;
    r.fill(0);
    g.fill(0);
    b.fill(0);
    this.qTail = 0;

    const dayR = DAYLIGHT[0] * dayLevel;
    const dayG = DAYLIGHT[1] * dayLevel;
    const dayB = DAYLIGHT[2] * dayLevel;

    // Single scan per column: compute per-tile opacity, pour skylight down (attenuating through
    // glass/walls, blocked by solids), and seed emitter tiles.
    for (let x = 0; x < w; x++) {
      let skyLevel = 1; // fraction of daylight still reaching down this column
      for (let y = 0; y < h; y++) {
        const i = y * w + x;
        const fg = world.getFg(minTileX + x, minTileY + y);

        // Opacity: foreground tile, or the background wall if the foreground is empty.
        let o: number;
        if (fg === TileId.Air) {
          o = world.getBg(minTileX + x, minTileY + y) !== TileId.Air ? WALL_OPACITY : 0;
        } else {
          o = fgOpacity(fg);
        }
        opacity[i] = o;

        if (skyLevel > 0.03) {
          r[i] = dayR * skyLevel;
          g[i] = dayG * skyLevel;
          b[i] = dayB * skyLevel;
          this.enqueue(i);
        }
        skyLevel *= 1 - o; // light passing to the tile below

        const emit = TILE_PROPS[fg]?.lightEmit ?? 0;
        if (emit > 0) {
          const er = (TILE_PROPS[fg].color[0] / 255) * emit;
          const eg = (TILE_PROPS[fg].color[1] / 255) * emit;
          const eb = (TILE_PROPS[fg].color[2] / 255) * emit;
          if (er > r[i]) r[i] = er;
          if (eg > g[i]) g[i] = eg;
          if (eb > b[i]) b[i] = eb;
          this.enqueue(i);
        }
      }
    }

    // Player torch.
    const px = playerTileX - minTileX;
    const py = playerTileY - minTileY;
    if (px >= 0 && px < w && py >= 0 && py < h) {
      const i = py * w + px;
      const tr = (TORCH[0] / 255) * TORCH_STRENGTH;
      const tg = (TORCH[1] / 255) * TORCH_STRENGTH;
      const tb = (TORCH[2] / 255) * TORCH_STRENGTH;
      if (tr > r[i]) r[i] = tr;
      if (tg > g[i]) g[i] = tg;
      if (tb > b[i]) b[i] = tb;
      this.enqueue(i);
    }

    // Flood-fill relaxation. Light only decreases per hop and dim light isn't re-queued, so the
    // number of enqueues is bounded by the region size — no runaway.
    const q = this.q;
    let head = 0;
    while (head < this.qTail) {
      const i = q[head++];
      const x = i % w;
      const y = (i / w) | 0;
      const cr = r[i];
      const cg = g[i];
      const cb = b[i];

      if (x > 0) this.spread(i - 1, cr, cg, cb);
      if (x < w - 1) this.spread(i + 1, cr, cg, cb);
      if (y > 0) this.spread(i - w, cr, cg, cb);
      if (y < h - 1) this.spread(i + w, cr, cg, cb);
    }

    // Write to the lightmap image.
    const img = this.image!;
    const data = img.data;
    for (let i = 0; i < r.length; i++) {
      const p = i * 4;
      data[p] = r[i] < 0 ? 0 : r[i];
      data[p + 1] = g[i] < 0 ? 0 : g[i];
      data[p + 2] = b[i] < 0 ? 0 : b[i];
      data[p + 3] = 255;
    }
    this.ctx.putImageData(img, 0, 0);
  }

  private spread(ni: number, cr: number, cg: number, cb: number): void {
    // Light loses more entering an opaque tile: air ≈ base loss, solid ≈ full loss, glass/walls
    // in between (so windows and rooms glow rather than going pitch black).
    const loss = LIGHT_ATTEN_AIR + this.opacity[ni] * (LIGHT_ATTEN_SOLID - LIGHT_ATTEN_AIR);
    // Floor to an integer: values are stored in an Int16Array, so a fractional result (from
    // fractional opacity on walls/glass) would compare `>` the truncated stored value forever
    // and never converge — an infinite re-queue. Integers strictly decrease → the fill terminates.
    const nr = Math.floor(cr - loss);
    const ng = Math.floor(cg - loss);
    const nb = Math.floor(cb - loss);
    let improved = false;
    let mx = 0;
    if (nr > this.r[ni]) { this.r[ni] = nr; improved = true; if (nr > mx) mx = nr; }
    if (ng > this.g[ni]) { this.g[ni] = ng; improved = true; if (ng > mx) mx = ng; }
    if (nb > this.b[ni]) { this.b[ni] = nb; improved = true; if (nb > mx) mx = nb; }
    // Only re-queue if this cell still has enough light to reach a neighbour (one more hop loses
    // at least LIGHT_ATTEN_AIR). This bounds the flood fill tightly.
    if (improved && mx > LIGHT_ATTEN_AIR) this.enqueue(ni);
  }

  private enqueue(i: number): void {
    if (this.qTail < this.qCap) this.q[this.qTail++] = i;
  }
}
