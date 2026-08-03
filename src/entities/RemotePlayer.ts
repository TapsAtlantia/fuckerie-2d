import { PLAYER_H, PLAYER_W } from "../config";

// A networked peer's avatar. We interpolate toward the last received position so movement stays
// smooth between the ~15 Hz state updates.
export class RemotePlayer {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  facing = 1;
  name: string;
  color: string;
  readonly w = PLAYER_W;
  readonly h = PLAYER_H;

  constructor(x: number, y: number, name: string, color: string) {
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
    this.name = name;
    this.color = color;
  }

  setTarget(x: number, y: number, facing: number, name: string, color: string): void {
    this.targetX = x;
    this.targetY = y;
    this.facing = facing;
    this.name = name;
    this.color = color;
  }

  interpolate(dt: number): void {
    const t = 1 - Math.exp(-18 * dt);
    this.x += (this.targetX - this.x) * t;
    this.y += (this.targetY - this.y) * t;
  }

  get centerX(): number {
    return this.x + this.w / 2;
  }
}
