import { PARTICLE_DENSITY, PARTICLE_MAX } from "../config";
import type { Camera } from "../engine/Camera";

interface Particle {
  x: number; // world px
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  alpha: number;
}

// Lightweight ambient particle field (drifting dust motes) that fills the visible area and
// gives the world a sense of atmosphere/depth. Biome-specific emitters (snow, embers, smoke)
// hook in here in later phases.
export class Particles {
  private parts: Particle[] = [];
  private spawnAcc = 0;

  update(dt: number, camera: Camera): void {
    const halfW = camera.viewW / 2 / camera.zoom;
    const halfH = camera.viewH / 2 / camera.zoom;
    const left = camera.x - halfW;
    const top = camera.y - halfH;
    const wWorld = halfW * 2;
    const hWorld = halfH * 2;

    // Drift + age existing particles.
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      const margin = 40;
      if (
        p.life <= 0 ||
        p.x < left - margin || p.x > left + wWorld + margin ||
        p.y < top - margin || p.y > top + hWorld + margin
      ) {
        this.parts[i] = this.parts[this.parts.length - 1];
        this.parts.pop();
      }
    }

    // Spawn to fill the visible area.
    this.spawnAcc += wWorld * hWorld * PARTICLE_DENSITY * dt;
    while (this.spawnAcc >= 1 && this.parts.length < PARTICLE_MAX) {
      this.spawnAcc -= 1;
      const maxLife = 4 + Math.random() * 6;
      this.parts.push({
        x: left + Math.random() * wWorld,
        y: top + Math.random() * hWorld,
        vx: (Math.random() - 0.5) * 8,
        vy: -4 - Math.random() * 8, // drift gently upward
        life: maxLife,
        maxLife,
        size: Math.random() < 0.3 ? 2 : 1,
        alpha: 0.15 + Math.random() * 0.35,
      });
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    ctx.save();
    ctx.fillStyle = "#ffffff";
    for (const p of this.parts) {
      // Fade in/out over lifetime.
      const t = p.life / p.maxLife;
      const fade = t > 0.8 ? (1 - t) * 5 : t < 0.2 ? t * 5 : 1;
      ctx.globalAlpha = p.alpha * fade;
      const sx = camera.worldToScreenX(p.x);
      const sy = camera.worldToScreenY(p.y);
      const s = p.size * camera.zoom * 0.5;
      ctx.fillRect(sx, sy, s, s);
    }
    ctx.restore();
  }
}
