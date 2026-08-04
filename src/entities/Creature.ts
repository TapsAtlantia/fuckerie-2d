import { TILE_SIZE } from "../config";
import type { ChunkManager } from "../world/ChunkManager";

export type CreatureKind = "critter" | "slime" | "bat";

const GRAV = 1400;
const MAX_FALL = 900;

// A simple mob with AABB tile physics and lightweight AI. Local-only (not networked in this phase).
export class Creature {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  readonly w: number;
  readonly h: number;
  readonly kind: CreatureKind;
  readonly hostile: boolean;
  readonly flying: boolean;
  health: number;
  readonly maxHealth: number;
  facing = 1;
  onGround = false;
  hurtFlash = 0;

  private timer = Math.random() * 1.5;
  private wanderDir = Math.random() < 0.5 ? -1 : 1;

  constructor(x: number, y: number, kind: CreatureKind) {
    this.x = x;
    this.y = y;
    this.kind = kind;
    this.hostile = kind === "slime";
    this.flying = kind === "bat";
    if (kind === "slime") { this.w = 14; this.h = 12; this.maxHealth = 40; }
    else if (kind === "bat") { this.w = 12; this.h = 9; this.maxHealth = 20; }
    else { this.w = 12; this.h = 10; this.maxHealth = 16; }
    this.health = this.maxHealth;
  }

  get centerX(): number { return this.x + this.w / 2; }
  get centerY(): number { return this.y + this.h / 2; }

  update(dt: number, world: ChunkManager, px: number, py: number): void {
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    this.timer -= dt;
    const dx = px - this.centerX;
    const dy = py - this.centerY;
    const dist = Math.hypot(dx, dy);

    if (this.flying) {
      // Bat: drift, loosely chasing the player, avoiding a straight line.
      if (this.timer <= 0) { this.timer = 0.6 + Math.random(); this.wanderDir = Math.random() < 0.5 ? -1 : 1; }
      const toward = dist < 220 ? Math.sign(dx) : this.wanderDir;
      this.vx += (toward * 70 - this.vx) * Math.min(1, dt * 3);
      this.vy += (Math.sin(performance.now() / 400 + this.x) * 40 - this.vy) * Math.min(1, dt * 2);
      if (dist < 220) this.vy += Math.sign(dy) * 30 * dt * 10;
      this.facing = this.vx >= 0 ? 1 : -1;
      this.moveX(world, dt);
      this.moveY(world, dt);
      return;
    }

    // Ground creatures: gravity.
    this.vy += GRAV * dt;
    if (this.vy > MAX_FALL) this.vy = MAX_FALL;

    if (this.kind === "slime") {
      // Hop toward the player periodically.
      if (this.onGround && this.timer <= 0) {
        this.timer = 1.0 + Math.random() * 0.8;
        this.facing = dist < 260 ? (dx >= 0 ? 1 : -1) : this.wanderDir;
        this.vx = this.facing * (60 + Math.random() * 40);
        this.vy = -300;
      }
    } else {
      // Critter: wander, flee if the player gets close.
      if (this.timer <= 0) {
        this.timer = 1.2 + Math.random() * 1.5;
        this.wanderDir = Math.random() < 0.5 ? -1 : 1;
      }
      let dir = this.wanderDir;
      if (dist < 90) dir = dx >= 0 ? -1 : 1; // flee
      this.facing = dir;
      this.vx += (dir * (dist < 90 ? 120 : 45) - this.vx) * Math.min(1, dt * 6);
      if (this.onGround && dist < 90 && this.timer < 0.3) this.vy = -260; // panic hop
    }

    if (this.onGround) this.vx *= 1 - Math.min(1, dt * 6); // ground friction between hops
    this.moveX(world, dt);
    this.onGround = false;
    this.moveY(world, dt);
  }

  private moveX(world: ChunkManager, dt: number): void {
    this.x += this.vx * dt;
    const dir = Math.sign(this.vx);
    if (dir === 0) return;
    const ty0 = Math.floor(this.y / TILE_SIZE);
    const ty1 = Math.floor((this.y + this.h - 0.001) / TILE_SIZE);
    const tx = dir > 0 ? Math.floor((this.x + this.w - 0.001) / TILE_SIZE) : Math.floor(this.x / TILE_SIZE);
    for (let ty = ty0; ty <= ty1; ty++) {
      if (world.isSolid(tx, ty)) {
        this.x = dir > 0 ? tx * TILE_SIZE - this.w : (tx + 1) * TILE_SIZE;
        this.vx = 0;
        if (!this.flying) this.wanderDir = -this.wanderDir; // turn around at walls
        return;
      }
    }
  }

  private moveY(world: ChunkManager, dt: number): void {
    this.y += this.vy * dt;
    const dir = Math.sign(this.vy);
    if (dir === 0) return;
    const tx0 = Math.floor(this.x / TILE_SIZE);
    const tx1 = Math.floor((this.x + this.w - 0.001) / TILE_SIZE);
    const ty = dir > 0 ? Math.floor((this.y + this.h - 0.001) / TILE_SIZE) : Math.floor(this.y / TILE_SIZE);
    for (let tx = tx0; tx <= tx1; tx++) {
      if (world.isSolid(tx, ty)) {
        if (dir > 0) { this.y = ty * TILE_SIZE - this.h; this.onGround = true; } else { this.y = (ty + 1) * TILE_SIZE; }
        this.vy = 0;
        return;
      }
    }
  }
}
