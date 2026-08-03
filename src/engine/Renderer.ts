import { TILE_SIZE } from "../config";
import { TILE_PROPS, TileId, tile, oreFleckColor } from "../world/Tile";
import { hash2 } from "../world/Noise";
import type { Camera } from "./Camera";
import type { ChunkManager } from "../world/ChunkManager";
import type { Player } from "../entities/Player";
import type { RemotePlayer } from "../entities/RemotePlayer";
import type { Lighting } from "../systems/Lighting";

export interface CursorInfo {
  tileX: number;
  tileY: number;
  inReach: boolean;
  miningProgress: number; // 0..1, only meaningful while mining
  mining: boolean;
}

const SKY_COLOR = "#6ba7ec";

// Draws the world in ordered layers: sky → background walls (dim) → foreground tiles →
// player → lightmap (multiply) → cursor/mining overlay (full brightness, on top of light).
export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;

  // Precomputed colour strings so we don't build "rgb(...)" per tile per frame.
  private fgColors: string[] = [];
  private bgColors: string[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;

    for (const p of TILE_PROPS) {
      const [r, g, b] = p.color;
      this.fgColors.push(`rgb(${r},${g},${b})`);
      // Background walls are the same material rendered darker for depth separation.
      this.bgColors.push(`rgb(${(r * 0.42) | 0},${(g * 0.42) | 0},${(b * 0.46) | 0})`);
    }
  }

  /** Match the drawing buffer to the CSS size × device pixel ratio. */
  resize(camera: Camera): void {
    const dpr = window.devicePixelRatio || 1;
    const cssW = this.canvas.clientWidth;
    const cssH = this.canvas.clientHeight;
    const bw = Math.round(cssW * dpr);
    const bh = Math.round(cssH * dpr);
    if (this.canvas.width !== bw || this.canvas.height !== bh || this.dpr !== dpr) {
      this.canvas.width = bw;
      this.canvas.height = bh;
      this.dpr = dpr;
    }
    // Draw in CSS-pixel space regardless of DPR.
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    camera.setViewport(cssW, cssH);
  }

  render(
    camera: Camera,
    world: ChunkManager,
    player: Player,
    lighting: Lighting,
    cursor: CursorInfo,
    remotes: RemotePlayer[] = [],
  ): void {
    const ctx = this.ctx;
    const zoom = camera.zoom;
    const size = TILE_SIZE * zoom + 1; // +1 hides sub-pixel seams between tiles

    // Sky backdrop (only visible where nothing is drawn over it, i.e. open air).
    ctx.fillStyle = SKY_COLOR;
    ctx.fillRect(0, 0, camera.viewW, camera.viewH);

    const b = camera.tileBounds();
    const minX = b.minX - 1;
    const minY = b.minY - 1;
    const maxX = b.maxX + 1;
    const maxY = b.maxY + 1;

    // Background walls.
    for (let ty = minY; ty <= maxY; ty++) {
      const sy = camera.worldToScreenY(ty * TILE_SIZE);
      for (let tx = minX; tx <= maxX; tx++) {
        const bg = world.getBg(tx, ty);
        if (bg === TileId.Air) continue;
        const sx = camera.worldToScreenX(tx * TILE_SIZE);
        ctx.fillStyle = this.bgColors[bg];
        ctx.fillRect(sx, sy, size, size);
        
        // Simple texture for background walls (dither only)
        const props = tile(bg);
        if (props.texture === "dither") {
          const h = hash2(tx, ty, 4);
          if (h > 0.5) {
            ctx.fillStyle = `rgba(0,0,0,0.05)`;
            ctx.fillRect(sx, sy, size / 2, size / 2);
            ctx.fillRect(sx + size / 2, sy + size / 2, size / 2, size / 2);
          }
        }
      }
    }

    // Foreground tiles.
    for (let ty = minY; ty <= maxY; ty++) {
      const sy = camera.worldToScreenY(ty * TILE_SIZE);
      for (let tx = minX; tx <= maxX; tx++) {
        const fg = world.getFg(tx, ty);
        if (fg === TileId.Air) continue;
        this.drawTile(ctx, camera, tx, ty, fg, this.fgColors[fg], size, sy);
      }
    }

    // Players (remote peers, then the local player on top).
    for (const r of remotes) this.drawAvatar(camera, r.x, r.y, r.w, r.h, r.facing, r.color);
    this.drawPlayer(camera, player);

    // Lightmap: multiply the lit region over everything drawn so far.
    const lm = lighting.canvas;
    if (lm.width > 0 && lm.height > 0) {
      ctx.imageSmoothingEnabled = true;
      ctx.globalCompositeOperation = "multiply";
      ctx.drawImage(
        lm,
        camera.worldToScreenX(lighting.originTileX * TILE_SIZE),
        camera.worldToScreenY(lighting.originTileY * TILE_SIZE),
        lm.width * TILE_SIZE * zoom,
        lm.height * TILE_SIZE * zoom,
      );
      ctx.globalCompositeOperation = "source-over";
    }

    // Overlays drawn on top of lighting so they stay readable in the dark:
    // remote name tags, then the cursor.
    for (const r of remotes) this.drawNameTag(camera, r);
    this.drawCursor(camera, cursor);
  }

  private drawTile(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    tx: number,
    ty: number,
    tileId: TileId,
    colorStr: string,
    size: number,
    sy: number,
  ): void {
    const props = tile(tileId);
    const sx = camera.worldToScreenX(tx * TILE_SIZE);
    
    // Apply hash-based tint if enabled
    let baseColor = colorStr;
    if (props.tint) {
      const h = hash2(tx, ty, 0);
      const tintFactor = 0.85 + h * 0.3; // 0.85..1.15
      const [r, g, b] = props.color;
      const tr = Math.min(255, Math.floor(r * tintFactor));
      const tg = Math.min(255, Math.floor(g * tintFactor));
      const tb = Math.min(255, Math.floor(b * tintFactor));
      baseColor = `rgb(${tr},${tg},${tb})`;
    }

    ctx.fillStyle = baseColor;
    ctx.fillRect(sx, sy, size, size);

    // Apply texture style
    switch (props.texture) {
      case "dither": {
        const h = hash2(tx, ty, 1);
        if (h > 0.5) {
          ctx.fillStyle = `rgba(0,0,0,0.08)`;
          ctx.fillRect(sx, sy, size / 2, size / 2);
          ctx.fillRect(sx + size / 2, sy + size / 2, size / 2, size / 2);
        }
        break;
      }
      case "twoTone": {
        // Top highlight for logs/grass
        ctx.fillStyle = `rgba(255,255,255,0.15)`;
        ctx.fillRect(sx, sy, size, size * 0.25);
        break;
      }
      case "fleck": {
        const fleckColor = oreFleckColor(tileId);
        if (fleckColor) {
          const h = hash2(tx, ty, 2);
          const fx = sx + (h * size * 0.6 + size * 0.2);
          const fy = sy + ((h * 7 % 1) * size * 0.6 + size * 0.2);
          const fsize = size * 0.25;
          ctx.fillStyle = `rgb(${fleckColor[0]},${fleckColor[1]},${fleckColor[2]})`;
          ctx.fillRect(fx, fy, fsize, fsize);
        } else {
          // Generic fleck for non-ore blocks
          const h = hash2(tx, ty, 3);
          if (h > 0.6) {
            ctx.fillStyle = `rgba(0,0,0,0.12)`;
            const fx = sx + (h * size * 0.7 + size * 0.15);
            const fy = sy + ((h * 11 % 1) * size * 0.7 + size * 0.15);
            ctx.fillRect(fx, fy, size * 0.2, size * 0.2);
          }
        }
        break;
      }
      case "flat":
      default:
        // Already drawn as flat fill
        break;
    }
  }

  private drawPlayer(camera: Camera, player: Player): void {
    this.drawAvatar(camera, player.x, player.y, player.w, player.h, player.facing, "#e9edff");
  }

  private drawAvatar(
    camera: Camera,
    wx: number,
    wy: number,
    ww: number,
    wh: number,
    facing: number,
    color: string,
  ): void {
    const ctx = this.ctx;
    const zoom = camera.zoom;
    const x = camera.worldToScreenX(wx);
    const y = camera.worldToScreenY(wy);
    const w = ww * zoom;
    const h = wh * zoom;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(20,24,48,0.75)";
    ctx.fillRect(x, y, w, h * 0.32); // head band
    ctx.fillStyle = "#0e1330";
    const eyeW = Math.max(2, w * 0.16);
    const eyeX = facing >= 0 ? x + w - eyeW - w * 0.12 : x + w * 0.12;
    ctx.fillRect(eyeX, y + h * 0.12, eyeW, Math.max(2, h * 0.1));
  }

  private drawNameTag(camera: Camera, r: RemotePlayer): void {
    const ctx = this.ctx;
    const cx = camera.worldToScreenX(r.x + r.w / 2);
    const top = camera.worldToScreenY(r.y) - 8;
    ctx.font = "600 12px ui-monospace, Consolas, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    const tw = ctx.measureText(r.name).width;
    ctx.fillStyle = "rgba(8,10,20,0.72)";
    ctx.fillRect(cx - tw / 2 - 5, top - 15, tw + 10, 16);
    ctx.fillStyle = r.color;
    ctx.fillText(r.name, cx, top);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  private drawCursor(camera: Camera, cursor: CursorInfo): void {
    const ctx = this.ctx;
    const zoom = camera.zoom;
    const px = camera.worldToScreenX(cursor.tileX * TILE_SIZE);
    const py = camera.worldToScreenY(cursor.tileY * TILE_SIZE);
    const s = TILE_SIZE * zoom;

    if (cursor.mining && cursor.miningProgress > 0) {
      ctx.fillStyle = `rgba(255,255,255,${0.12 + cursor.miningProgress * 0.5})`;
      ctx.fillRect(px, py, s, s);
    }

    ctx.lineWidth = 2;
    ctx.strokeStyle = cursor.inReach ? "rgba(120,255,150,0.9)" : "rgba(255,110,110,0.85)";
    ctx.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
  }
}
