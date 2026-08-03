import { PARALLAX_FAR, PARALLAX_MID, TILE_SIZE } from "../config";
import { hash2 } from "../world/Noise";
import type { Camera } from "../engine/Camera";

type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const css = (c: RGB) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Distant, slow-scrolling backdrop: depth-aware sky gradient, stars up high, and two parallax
// hill silhouettes near the horizon. Purely decorative; drawn before the world tiles.
export class Parallax {
  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const w = camera.viewW;
    const h = camera.viewH;
    const depth = camera.y / TILE_SIZE; // tiles below surface (surface ≈ 0)

    const under = clamp01(depth / 240); // 0 surface → 1 deep underground
    const up = clamp01(-depth / 420); // 0 surface → 1 high sky

    const surfaceTop: RGB = [96, 152, 226];
    const surfaceBot: RGB = [168, 202, 240];
    const deep: RGB = [10, 12, 20];
    const space: RGB = [4, 5, 12];

    let top = mix(surfaceTop, deep, under);
    let bot = mix(surfaceBot, deep, under);
    top = mix(top, space, up);
    bot = mix(bot, mix(surfaceTop, space, up), up);

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, css(top));
    grad.addColorStop(1, css(bot));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    if (up > 0.05) this.stars(ctx, camera, up);
    if (under < 0.9) this.hills(ctx, camera, 1 - under);
  }

  private stars(ctx: CanvasRenderingContext2D, camera: Camera, up: number): void {
    ctx.save();
    ctx.globalAlpha = up * 0.9;
    ctx.fillStyle = "#ffffff";
    const ox = camera.x * PARALLAX_FAR;
    const oy = camera.y * PARALLAX_FAR;
    const cell = 90;
    const startX = Math.floor((ox - 50) / cell);
    const startY = Math.floor((oy - 50) / cell);
    for (let gx = 0; gx <= camera.viewW / cell + 2; gx++) {
      for (let gy = 0; gy <= camera.viewH / cell + 2; gy++) {
        const cx = startX + gx;
        const cy = startY + gy;
        const hh = hash2(cx, cy, 9001);
        if (hh > 0.5) continue;
        const sx = cx * cell - ox + hash2(cx, cy, 3) * cell;
        const sy = cy * cell - oy + hash2(cx, cy, 7) * cell;
        const size = hh < 0.12 ? 2 : 1;
        ctx.globalAlpha = up * (0.4 + hash2(cx, cy, 11) * 0.6);
        ctx.fillRect(sx, sy, size, size);
      }
    }
    ctx.restore();
  }

  private hills(ctx: CanvasRenderingContext2D, camera: Camera, vis: number): void {
    const horizon = camera.worldToScreenY(6 * TILE_SIZE); // just below average surface
    const layers: Array<{ p: number; amp: number; base: number; col: string }> = [
      { p: PARALLAX_FAR, amp: 70, base: 40, col: "rgba(60,80,120," + (0.5 * vis).toFixed(3) + ")" },
      { p: PARALLAX_MID, amp: 110, base: 10, col: "rgba(38,54,86," + (0.7 * vis).toFixed(3) + ")" },
    ];
    for (const L of layers) {
      const yBase = horizon + L.base;
      if (yBase > camera.viewH) continue;
      ctx.fillStyle = L.col;
      ctx.beginPath();
      ctx.moveTo(0, camera.viewH);
      const step = 24;
      for (let x = 0; x <= camera.viewW + step; x += step) {
        const wx = (camera.x * L.p + x) * 0.004;
        const hgt = (Math.sin(wx) * 0.5 + Math.sin(wx * 2.3 + 1.7) * 0.3 + Math.sin(wx * 0.6) * 0.2);
        ctx.lineTo(x, yBase - hgt * L.amp);
      }
      ctx.lineTo(camera.viewW, camera.viewH);
      ctx.closePath();
      ctx.fill();
    }
  }
}
