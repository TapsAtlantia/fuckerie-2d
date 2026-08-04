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
  tile,
} from "../world/Tile";
import { hash2 } from "../world/Noise";
import { LAVA_COLOR, LMAX, WATER_COLOR, isLava, liquidLevel } from "../world/Liquid";
import { computeSlope, shapeFrom, type SlopeKind } from "../render/Autotile";
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

    // Liquids (drawn over tiles + players so a submerged player is tinted).
    this.drawLiquids(camera, world, minX, minY, maxX, maxY);

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

  private drawLiquids(
    camera: Camera,
    world: ChunkManager,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): void {
    const ctx = this.ctx;
    const size = TILE_SIZE * camera.zoom;
    for (let ty = minY; ty <= maxY; ty++) {
      const sy = camera.worldToScreenY(ty * TILE_SIZE);
      for (let tx = minX; tx <= maxX; tx++) {
        const v = world.getLiquid(tx, ty);
        const lvl = liquidLevel(v);
        if (lvl === 0) continue;
        const lava = isLava(v);
        const sx = camera.worldToScreenX(tx * TILE_SIZE);
        const h = (lvl / LMAX) * size;
        const [r, g, b] = lava ? LAVA_COLOR : WATER_COLOR;
        ctx.fillStyle = `rgba(${r},${g},${b},${lava ? 0.85 : 0.6})`;
        ctx.fillRect(sx, sy + size - h, size + 1, h + 1);
        // Surface shimmer line.
        ctx.fillStyle = `rgba(255,255,255,${lava ? 0.14 : 0.22})`;
        ctx.fillRect(sx, sy + size - h, size + 1, Math.max(1, size * 0.08));
      }
    }
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

    // Non-solid deco (plants, torches) get their own upright sprites.
    if (!isSolid(fg)) {
      this.drawDeco(ctx, sprite, sx, sy, size, fg);
      return;
    }

    const tS = connectsForAutotile(world.getFg(tx, ty - 1));
    const rS = connectsForAutotile(world.getFg(tx + 1, ty));
    const bS = connectsForAutotile(world.getFg(tx, ty + 1));
    const lS = connectsForAutotile(world.getFg(tx - 1, ty));
    const shape = shapeFrom(tS, rS, bS, lS, false);

    // Two-tier, run-delayed slope (surface terrain tiles only).
    const slope = !tS && canSlope(fg)
      ? computeSlope((dx, dy) => connectsForAutotile(world.getFg(tx + dx, ty + dy)), true)
      : { kind: "none" as SlopeKind, roundTL: false, roundTR: false };

    if (slope.kind !== "none") {
      this.drawSlopeTile(ctx, sprite, sx, sy, size, draw, slope.kind, fg, tx, ty);
      return;
    }

    // Fully-enclosed interior tiles just blit (the common case, fast — and they meld with neighbours).
    if (!shape.top && !shape.left && !shape.right && !shape.bottom) {
      ctx.drawImage(sprite, sx, sy, draw, draw);
      return;
    }

    // Terrain gets an organic silhouette (bumpy top edge + rounded exposed corners) so blocks meld
    // together like Terraria; built structure blocks stay crisp and square.
    if (tile(fg).category !== "structure") {
      this.drawTerrainTile(ctx, camera, sx, sy, size, sprite, shape, tx, ty, fg, draw);
      return;
    }

    ctx.drawImage(sprite, sx, sy, draw, draw);
    const bev = Math.max(1, Math.round(size * 0.14));
    if (shape.top) { ctx.fillStyle = `rgba(255,255,255,${BEVEL_LIGHT})`; ctx.fillRect(sx, sy, size, bev); }
    if (shape.left) { ctx.fillStyle = `rgba(255,255,255,${BEVEL_LIGHT * 0.7})`; ctx.fillRect(sx, sy, bev, size); }
    if (shape.bottom) { ctx.fillStyle = `rgba(0,0,0,${BEVEL_DARK})`; ctx.fillRect(sx, sy + size - bev, size, bev); }
    if (shape.right) { ctx.fillStyle = `rgba(0,0,0,${BEVEL_DARK * 0.7})`; ctx.fillRect(sx + size - bev, sy, bev, size); }
    if (shape.top && hasOverhang(fg)) this.drawOverhang(ctx, fg, tx, ty, sx, sy, size);
  }

  private topBump(wpx: number): number {
    // Continuous (function of absolute world-x) so adjacent tiles' top edges connect seamlessly.
    const s = 5;
    const i = Math.floor(wpx / s);
    const f = wpx / s - i;
    const a = hash2(i, 900, 7);
    const b = hash2(i + 1, 900, 7);
    const t = f * f * (3 - 2 * f);
    return (a + (b - a) * t) * 3; // 0..3 world px of downward "erosion"
  }

  private drawTerrainTile(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    sx: number,
    sy: number,
    size: number,
    sprite: HTMLCanvasElement,
    shape: { top: boolean; right: boolean; bottom: boolean; left: boolean },
    tx: number,
    ty: number,
    fg: number,
    draw: number,
  ): void {
    const z = camera.zoom;
    const cw = TILE_SIZE * 0.3; // rounded-corner inset (world px), only on exposed convex corners
    const rTL = shape.top && shape.left ? cw : 0;
    const rTR = shape.top && shape.right ? cw : 0;
    const rBL = shape.bottom && shape.left ? cw : 0;
    const rBR = shape.bottom && shape.right ? cw : 0;
    const wx0 = tx * TILE_SIZE;
    const topYat = (l: number) => sy + (shape.top ? this.topBump(wx0 + l) : 0) * z;
    const SEG = 5;
    const startL = rTL;
    const endL = TILE_SIZE - rTR;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(sx + startL * z, topYat(startL));
    if (shape.top) {
      for (let i = 1; i <= SEG; i++) { const l = startL + (endL - startL) * (i / SEG); ctx.lineTo(sx + l * z, topYat(l)); }
    } else {
      ctx.lineTo(sx + endL * z, sy);
    }
    if (rTR > 0) ctx.quadraticCurveTo(sx + size, sy, sx + size, sy + rTR * z);
    else ctx.lineTo(sx + size, sy);
    ctx.lineTo(sx + size, sy + size - rBR * z);
    if (rBR > 0) ctx.quadraticCurveTo(sx + size, sy + size, sx + size - rBR * z, sy + size);
    else ctx.lineTo(sx + size, sy + size);
    ctx.lineTo(sx + rBL * z, sy + size);
    if (rBL > 0) ctx.quadraticCurveTo(sx, sy + size, sx, sy + size - rBL * z);
    else ctx.lineTo(sx, sy + size);
    ctx.lineTo(sx, sy + rTL * z);
    if (rTL > 0) ctx.quadraticCurveTo(sx, sy, sx + rTL * z, topYat(rTL));
    else ctx.lineTo(sx, topYat(0));
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(sprite, sx, sy, draw, draw);
    ctx.restore();

    // Light along the bumpy top edge; soft shadow on an exposed underside.
    if (shape.top) {
      ctx.strokeStyle = `rgba(255,255,255,${BEVEL_LIGHT})`;
      ctx.lineWidth = Math.max(1, size * 0.09);
      ctx.beginPath();
      ctx.moveTo(sx + startL * z, topYat(startL));
      for (let i = 1; i <= SEG; i++) { const l = startL + (endL - startL) * (i / SEG); ctx.lineTo(sx + l * z, topYat(l)); }
      ctx.stroke();
    }
    if (shape.bottom) {
      const s = Math.max(1, size * 0.12);
      ctx.fillStyle = `rgba(0,0,0,${BEVEL_DARK * 0.6})`;
      ctx.fillRect(sx, sy + size - s, size, s);
    }
    if (shape.top && hasOverhang(fg)) this.drawOverhang(ctx, fg, tx, ty, sx, sy, size);
  }

  private drawSlopeTile(
    ctx: CanvasRenderingContext2D,
    sprite: HTMLCanvasElement,
    sx: number,
    sy: number,
    size: number,
    draw: number,
    kind: SlopeKind,
    fg: number,
    tx: number,
    ty: number,
  ): void {
    // Clip to the slope polygon, then draw the sprite inside it.
    ctx.save();
    ctx.beginPath();
    let ex1 = sx, ey1 = sy, ex2 = sx + size, ey2 = sy; // slope edge endpoints
    switch (kind) {
      case "right45": // hypotenuse top-left → bottom-right, keep lower-left triangle
        ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + size); ctx.lineTo(sx + size, sy + size);
        ex1 = sx; ey1 = sy; ex2 = sx + size; ey2 = sy + size;
        break;
      case "left45": // hypotenuse bottom-left → top-right, keep lower-right triangle
        ctx.moveTo(sx + size, sy); ctx.lineTo(sx + size, sy + size); ctx.lineTo(sx, sy + size);
        ex1 = sx; ey1 = sy + size; ex2 = sx + size; ey2 = sy;
        break;
      case "right22": // gentle: top-left full, top-right half
        ctx.moveTo(sx, sy); ctx.lineTo(sx + size, sy + size * 0.5);
        ctx.lineTo(sx + size, sy + size); ctx.lineTo(sx, sy + size);
        ex1 = sx; ey1 = sy; ex2 = sx + size; ey2 = sy + size * 0.5;
        break;
      case "left22":
        ctx.moveTo(sx, sy + size * 0.5); ctx.lineTo(sx + size, sy);
        ctx.lineTo(sx + size, sy + size); ctx.lineTo(sx, sy + size);
        ex1 = sx; ey1 = sy + size * 0.5; ex2 = sx + size; ey2 = sy;
        break;
      default:
        break;
    }
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(sprite, sx, sy, draw, draw);
    ctx.restore();

    // Grass/moss/snow draped along the slope face, else a light edge highlight.
    ctx.lineCap = "round";
    if (hasOverhang(fg)) {
      const oc = overhangColor(fg);
      ctx.strokeStyle = `rgb(${oc[0]},${oc[1]},${oc[2]})`;
      ctx.lineWidth = Math.max(2, size * 0.22);
    } else {
      ctx.strokeStyle = `rgba(255,255,255,${BEVEL_LIGHT})`;
      ctx.lineWidth = Math.max(1, size * 0.12);
    }
    ctx.beginPath();
    ctx.moveTo(ex1, ey1);
    ctx.lineTo(ex2, ey2);
    ctx.stroke();
    ctx.lineCap = "butt";
    void tx; void ty;
  }

  private drawOverhang(
    ctx: CanvasRenderingContext2D,
    fg: number,
    tx: number,
    ty: number,
    sx: number,
    sy: number,
    size: number,
  ): void {
    const oc = overhangColor(fg);
    ctx.fillStyle = `rgb(${oc[0]},${oc[1]},${oc[2]})`;
    const ohMax = (OVERHANG_PX / 16) * size;
    const strands = Math.max(4, Math.round(size / 4));
    const sw = Math.max(1, size / (strands * 1.5));
    for (let k = 0; k < strands; k++) {
      const hx = hash2(tx * 13 + k, ty, 51);
      const hh = hash2(tx, ty * 7 + k, 52);
      const px = sx + hx * (size - sw);
      const ph = ohMax * (0.4 + hh * 0.7);
      ctx.fillRect(px, sy - ph, sw, ph);
    }
  }

  private drawDeco(
    ctx: CanvasRenderingContext2D,
    sprite: HTMLCanvasElement,
    sx: number,
    sy: number,
    size: number,
    fg: number,
  ): void {
    // Torches/lanterns fill more of the cell; plants sit on the ground, upright.
    void fg;
    ctx.drawImage(sprite, sx, sy, size, size);
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
