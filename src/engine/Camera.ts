import { CAMERA_LERP, TILE_SIZE, ZOOM } from "../config";

// Maps between world pixels and screen (CSS) pixels, and smoothly follows a target.
// Screen origin is top-left; the camera position is the world point shown at screen centre.
export class Camera {
  x = 0; // world pixel at screen centre
  y = 0;
  zoom = ZOOM;
  viewW = 1; // CSS pixels
  viewH = 1;

  setViewport(w: number, h: number): void {
    this.viewW = w;
    this.viewH = h;
  }

  snapTo(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  follow(dt: number, targetX: number, targetY: number): void {
    // Frame-rate-independent exponential smoothing.
    const t = 1 - Math.exp(-CAMERA_LERP * dt);
    this.x += (targetX - this.x) * t;
    this.y += (targetY - this.y) * t;
  }

  worldToScreenX(wx: number): number {
    return (wx - this.x) * this.zoom + this.viewW / 2;
  }
  worldToScreenY(wy: number): number {
    return (wy - this.y) * this.zoom + this.viewH / 2;
  }
  screenToWorldX(sx: number): number {
    return (sx - this.viewW / 2) / this.zoom + this.x;
  }
  screenToWorldY(sy: number): number {
    return (sy - this.viewH / 2) / this.zoom + this.y;
  }

  // Visible world rectangle in tile coordinates (inclusive bounds).
  tileBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
    const halfW = this.viewW / 2 / this.zoom;
    const halfH = this.viewH / 2 / this.zoom;
    return {
      minX: Math.floor((this.x - halfW) / TILE_SIZE),
      minY: Math.floor((this.y - halfH) / TILE_SIZE),
      maxX: Math.floor((this.x + halfW) / TILE_SIZE),
      maxY: Math.floor((this.y + halfH) / TILE_SIZE),
    };
  }
}
