import {
  BEVEL_DARK,
  BEVEL_LIGHT,
  OVERHANG_PX,
  SPRITE_VARIANTS,
  TILE_SIZE,
  WALL_DARKEN,
} from "../config";
import {
  TileId,
  canSlope,
  connectsForAutotile,
  hasOverhang,
  isSolid,
  overhangColor,
} from "../world/Tile";
import { hash2 } from "../world/Noise";
import { shapeFrom } from "../render/Autotile";
import { TileSprites } from "../render/TileSprites";
import { Parallax } from "../render/Parallax";
import { Particles } from "../render/Particles";
import type { Camera } from "./Camera";
import type { ChunkManager } from "../world/ChunkManager";
import type { Player } from "../entities/Player";
import type { RemotePlayer } from "../entities/RemotePlayer";
import type { Lighting } from "../systems/Lighting";

export interface CursorInfo {
  tileX: number;
  tileY: number;
  inReach: boolean;
  miningProgress: number;
  mining: boolean;
}

// Draws the world as a 5-tier composite: parallax backdrop → background walls → foreground
// tiles (auto-tiled, sloped, beveled, with overhang fringe) → players → lightmap (multiply) →
// ambient particles + cursor/UI. Foreground/wall tiles use procedurally generated pixel sprites.
export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;

  private sprites = new TileSprites();
  private parallax = new Parallax();
  private particles = new Particles();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;
  }

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
    dt = 0,
  ): void {
    const ctx = this.ctx;
    const zoom = camera.zoom;
    const size = TILE_SIZE * zoom;
    const draw = Math.ceil(size) + 1;

    // TIER 1: parallax backdrop.
    this.parallax.draw(ctx, camera);

    const b = camera.tileBounds();
    const minX = b.minX - 1, minY = b.minY - 1, maxX = b.maxX + 1, maxY = b.maxY + 1;

    ctx.imageSmoothingEnabled = false;

    // TIER 2: background walls (only where the foreground doesn't already cover them).
    for (let ty = minY; ty <= maxY; ty++) {
      const sy = camera.worldToScreenY(ty * TILE_SIZE);
      for (let tx = minX; tx <= maxX; tx++) {
        const bg = world.getBg(tx, ty);
        if (bg === TileId.Air) continue;
        const fg = world.getFg(tx, ty);
        if (fg !== TileId.Air && fg !== TileId.Glass) continue; // wall hidden behind a block
        const sx = camera.worldToScreenX(tx * TILE_SIZE);
        const sprite = this.sprites.get(bg, this.variantAt(tx, ty));
        if (sprite) ctx.drawImage(sprite, sx, sy, draw, draw);
        ctx.fillStyle = `rgba(6,8,16,${1 - WALL_DARKEN})`;
        ctx.fillRect(sx, sy, draw, draw);
      }
    }

    // TIER 3: foreground tiles.
    for (let ty = minY; ty <= maxY; ty++) {
      const sy = camera.worldToScreenY(ty * TILE_SIZE);
      for (let tx = minX; tx <= maxX; tx++) {
        const fg = world.getFg(tx, ty);
        if (fg === TileId.Air) continue;
        this.drawFg(ctx, camera, world, tx, ty, fg, sy, size, draw);
      }
    }

    // Players.
    for (const r of remotes) this.drawAvatar(camera, r.x, r.y, r.w, r.h, r.facing, r.color);
    this.drawPlayer(camera, player);

    // TIER 4: lightmap (multiply).
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

    // TIER 5: ambient particles + overlays (full brightness, above lighting).
    if (dt > 0) this.particles.update(dt, camera);
    this.particles.draw(ctx, camera);
    for (const r of remotes) this.drawNameTag(camera, r);
    this.drawCursor(camera, cursor);
  }

  private variantAt(tx: number, ty: number): number {
    return (hash2(tx, ty, 0) * SPRITE_VARIANTS) | 0;
  }

  private drawFg(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    world: ChunkManager,
    tx: number,
    ty: number,
    fg: number,
    sy: number,
    size: number,
    draw: number,
  ): void {
    const sx = camera.worldToScreenX(tx * TILE_SIZE);
    const sprite = this.sprites.get(fg, this.variantAt(tx, ty));
    if (!sprite) return;

    // Non-solid deco (plants, torches): draw inset so they read as small props, no bevels.
    if (!isSolid(fg)) {
      const inx = size * 0.16;
      const iny = size * 0.28;
      ctx.drawImage(sprite, sx + inx, sy + iny, size - inx * 2, size - iny);
      return;
    }

    const tS = connectsForAutotile(world.getFg(tx, ty - 1));
    const rS = connectsForAutotile(world.getFg(tx + 1, ty));
    const bS = connectsForAutotile(world.getFg(tx, ty + 1));
    const lS = connectsForAutotile(world.getFg(tx - 1, ty));
    const shape = shapeFrom(tS, rS, bS, lS, canSlope(fg));

    if (shape.slope !== "none") {
      ctx.save();
      ctx.beginPath();
      if (shape.slope === "left") {
        // keep lower-right triangle (cut top-left)
        ctx.moveTo(sx, sy + size);
        ctx.lineTo(sx + size, sy + size);
        ctx.lineTo(sx + size, sy);
      } else {
        // keep lower-left triangle (cut top-right)
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx, sy + size);
        ctx.lineTo(sx + size, sy + size);
      }
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(sprite, sx, sy, draw, draw);
      ctx.restore();
      // Highlight the sloped edge.
      ctx.strokeStyle = `rgba(255,255,255,${BEVEL_LIGHT})`;
      ctx.lineWidth = Math.max(1, size * 0.1);
      ctx.beginPath();
      if (shape.slope === "left") { ctx.moveTo(sx, sy + size); ctx.lineTo(sx + size, sy); }
      else { ctx.moveTo(sx, sy); ctx.lineTo(sx + size, sy + size); }
      ctx.stroke();
      return;
    }

    ctx.drawImage(sprite, sx, sy, draw, draw);

    // Edge bevels where exposed to open space.
    const bev = Math.max(1, Math.round(size * 0.14));
    if (shape.top) {
      ctx.fillStyle = `rgba(255,255,255,${BEVEL_LIGHT})`;
      ctx.fillRect(sx, sy, size, bev);
    }
    if (shape.left) {
      ctx.fillStyle = `rgba(255,255,255,${BEVEL_LIGHT * 0.7})`;
      ctx.fillRect(sx, sy, bev, size);
    }
    if (shape.bottom) {
      ctx.fillStyle = `rgba(0,0,0,${BEVEL_DARK})`;
      ctx.fillRect(sx, sy + size - bev, size, bev);
    }
    if (shape.right) {
      ctx.fillStyle = `rgba(0,0,0,${BEVEL_DARK * 0.7})`;
      ctx.fillRect(sx + size - bev, sy, bev, size);
    }

    // Overhang fringe over an exposed grassy/snowy/mossy top.
    if (shape.top && hasOverhang(fg)) {
      const oc = overhangColor(fg);
      ctx.fillStyle = `rgb(${oc[0]},${oc[1]},${oc[2]})`;
      const ohMax = (OVERHANG_PX / 16) * size;
      const strands = Math.max(3, Math.round(size / 5));
      const sw = Math.max(1, size / (strands * 1.6));
      for (let k = 0; k < strands; k++) {
        const hx = hash2(tx * 13 + k, ty, 51);
        const hh = hash2(tx, ty * 7 + k, 52);
        const px = sx + hx * (size - sw);
        const ph = ohMax * (0.45 + hh * 0.55);
        ctx.fillRect(px, sy - ph, sw, ph);
      }
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
    ctx.fillRect(x, y, w, h * 0.32);
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
