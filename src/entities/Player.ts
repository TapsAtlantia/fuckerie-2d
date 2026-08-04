import {
  AIR_ACCEL,
  COYOTE_TIME,
  FLY_SPEED,
  GRAVITY,
  GROUND_FRICTION,
  JUMP_BUFFER,
  JUMP_SPEED,
  MAX_FALL_SPEED,
  MAX_RUN_SPEED,
  MOVE_ACCEL,
  PLAYER_H,
  PLAYER_W,
  TILE_SIZE,
} from "../config";
import type { Input } from "../engine/Input";
import type { ChunkManager } from "../world/ChunkManager";
import { isLava, liquidLevel } from "../world/Liquid";

// AABB platformer physics with momentum and swept, axis-separated tile collision.
// Movement is sub-stepped so fast falls / fly speed can never tunnel through a tile.
export class Player {
  x: number;
  y: number;
  readonly w = PLAYER_W;
  readonly h = PLAYER_H;
  vx = 0;
  vy = 0;
  onGround = false;
  facing = 1;
  fly = false;

  health = 100;
  readonly maxHealth = 100;
  inLiquid = false; // for a submerged tint / HUD

  private coyote = 0;
  private jumpBuffer = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  get centerX(): number {
    return this.x + this.w / 2;
  }
  get centerY(): number {
    return this.y + this.h / 2;
  }

  update(dt: number, input: Input, world: ChunkManager): void {
    const left = input.isDown("a") || input.isDown("arrowleft");
    const right = input.isDown("d") || input.isDown("arrowright");
    const up = input.isDown("w") || input.isDown("arrowup");
    const down = input.isDown("s") || input.isDown("arrowdown");
    const jumpHeld = input.isDown(" ") || up;
    const jumpPressed = input.wasPressed(" ") || input.wasPressed("w") || input.wasPressed("arrowup");

    const dir = (right ? 1 : 0) - (left ? 1 : 0);
    if (dir !== 0) this.facing = dir;

    if (this.fly) {
      const vdir = (down ? 1 : 0) - (up ? 1 : 0);
      this.vx = dir * FLY_SPEED;
      this.vy = vdir * FLY_SPEED;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.onGround = false;
      return;
    }

    // Horizontal: accelerate toward input, or apply friction when idle on the ground.
    const accel = this.onGround ? MOVE_ACCEL : AIR_ACCEL;
    if (dir !== 0) {
      this.vx += dir * accel * dt;
      if (this.vx > MAX_RUN_SPEED) this.vx = MAX_RUN_SPEED;
      if (this.vx < -MAX_RUN_SPEED) this.vx = -MAX_RUN_SPEED;
    } else if (this.onGround) {
      const drop = GROUND_FRICTION * dt;
      if (Math.abs(this.vx) <= drop) this.vx = 0;
      else this.vx -= Math.sign(this.vx) * drop;
    }

    // Gravity.
    this.vy += GRAVITY * dt;
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;
    // Variable jump height: rising while the jump key is released bleeds upward speed.
    if (this.vy < 0 && !jumpHeld) this.vy += GRAVITY * dt;

    // Jump with coyote-time + input buffering for responsive feel.
    this.coyote = this.onGround ? COYOTE_TIME : Math.max(0, this.coyote - dt);
    this.jumpBuffer = jumpPressed ? JUMP_BUFFER : Math.max(0, this.jumpBuffer - dt);
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = -JUMP_SPEED;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.onGround = false;
    }

    // Liquids: buoyancy/swimming in water; damage + sink in lava.
    const lq = world.getLiquid(Math.floor(this.centerX / TILE_SIZE), Math.floor(this.centerY / TILE_SIZE));
    const lvl = liquidLevel(lq);
    this.inLiquid = lvl > 0;
    const inLava = lvl > 0 && isLava(lq);
    if (lvl > 0) {
      if (inLava) {
        this.vy *= 0.6; if (this.vy > 90) this.vy = 90;
        this.vx *= 0.6;
        this.health -= 25 * dt;
      } else {
        this.vy *= 0.7; if (this.vy > 150) this.vy = 150; // buoyant, slow sink
        if (jumpHeld) this.vy = -150; // swim up
      }
    }
    if (!inLava && this.health < this.maxHealth) this.health = Math.min(this.maxHealth, this.health + 4 * dt);

    this.stepX(world, dt);
    // Auto step-up: if walking into a low ledge/stair while grounded, climb it smoothly instead
    // of stopping dead (so gentle slopes and single steps are walkable, not jump-required).
    if (dir !== 0 && this.onGround && this.vx === 0) this.stepUp(world, dir);
    this.stepY(world, dt);
  }

  /** Try to rise onto a ledge (up to ~1 tile) directly ahead so the player keeps walking. */
  private stepUp(world: ChunkManager, dir: number): void {
    const maxLift = TILE_SIZE + 2; // at most ~1 tile high
    const savedY = this.y;
    for (let lift = 2; lift <= maxLift; lift += 2) {
      const testX = this.x + dir * 3;
      const testY = savedY - lift;
      if (!this.aabbCollides(world, testX, testY)) {
        // There's a clear foothold up here — hop onto it and keep moving.
        this.x = testX;
        this.y = testY;
        return;
      }
    }
    this.y = savedY;
  }

  private aabbCollides(world: ChunkManager, x: number, y: number): boolean {
    const tx0 = Math.floor(x / TILE_SIZE);
    const tx1 = Math.floor((x + this.w - 0.001) / TILE_SIZE);
    const ty0 = Math.floor(y / TILE_SIZE);
    const ty1 = Math.floor((y + this.h - 0.001) / TILE_SIZE);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (world.isSolid(tx, ty)) return true;
      }
    }
    return false;
  }

  /** Teleport (debug warp). Zeroes velocity so we don't inherit a huge fall speed. */
  warp(dxTiles: number, dyTiles: number): void {
    this.x += dxTiles * TILE_SIZE;
    this.y += dyTiles * TILE_SIZE;
    this.vx = 0;
    this.vy = 0;
  }

  private stepX(world: ChunkManager, dt: number): void {
    const disp = this.vx * dt;
    const steps = Math.max(1, Math.ceil(Math.abs(disp) / (TILE_SIZE * 0.9)));
    const inc = disp / steps;
    for (let s = 0; s < steps; s++) {
      this.x += inc;
      this.resolveX(world);
      if (this.vx === 0) break;
    }
  }

  private stepY(world: ChunkManager, dt: number): void {
    const disp = this.vy * dt;
    const steps = Math.max(1, Math.ceil(Math.abs(disp) / (TILE_SIZE * 0.9)));
    const inc = disp / steps;
    this.onGround = false;
    for (let s = 0; s < steps; s++) {
      this.y += inc;
      this.resolveY(world);
      if (this.vy === 0) break;
    }
  }

  private tileTop(): number {
    return Math.floor(this.y / TILE_SIZE);
  }
  private tileBottom(): number {
    return Math.floor((this.y + this.h - 0.001) / TILE_SIZE);
  }

  private resolveX(world: ChunkManager): void {
    const ty0 = this.tileTop();
    const ty1 = this.tileBottom();
    if (this.vx > 0) {
      const tx = Math.floor((this.x + this.w - 0.001) / TILE_SIZE);
      for (let ty = ty0; ty <= ty1; ty++) {
        if (world.isSolid(tx, ty)) {
          this.x = tx * TILE_SIZE - this.w;
          this.vx = 0;
          return;
        }
      }
    } else if (this.vx < 0) {
      const tx = Math.floor(this.x / TILE_SIZE);
      for (let ty = ty0; ty <= ty1; ty++) {
        if (world.isSolid(tx, ty)) {
          this.x = (tx + 1) * TILE_SIZE;
          this.vx = 0;
          return;
        }
      }
    }
  }

  private resolveY(world: ChunkManager): void {
    const tx0 = Math.floor(this.x / TILE_SIZE);
    const tx1 = Math.floor((this.x + this.w - 0.001) / TILE_SIZE);
    if (this.vy > 0) {
      const ty = Math.floor((this.y + this.h - 0.001) / TILE_SIZE);
      for (let tx = tx0; tx <= tx1; tx++) {
        if (world.isSolid(tx, ty)) {
          this.y = ty * TILE_SIZE - this.h;
          this.vy = 0;
          this.onGround = true;
          return;
        }
      }
    } else if (this.vy < 0) {
      const ty = Math.floor(this.y / TILE_SIZE);
      for (let tx = tx0; tx <= tx1; tx++) {
        if (world.isSolid(tx, ty)) {
          this.y = (ty + 1) * TILE_SIZE;
          this.vy = 0;
          return;
        }
      }
    }
  }
}
