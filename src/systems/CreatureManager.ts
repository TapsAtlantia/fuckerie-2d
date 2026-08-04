import { TILE_SIZE } from "../config";
import { Creature, kindToNum, type CreatureKind } from "../entities/Creature";
import { liquidLevel } from "../world/Liquid";
import { TileId } from "../world/Tile";
import type { ChunkManager } from "../world/ChunkManager";
import type { Player } from "../entities/Player";
import type { CreatureState } from "../net/Protocol";

// Spawns/despawns simple mobs around the player and applies contact damage. Local-only for now
// (creatures are not networked); each client runs its own population.
export class CreatureManager {
  readonly creatures: Creature[] = [];
  private spawnTimer = 0.5;
  private primed = false;
  private nextId = 1;
  private readonly CAP = 12;

  /** Compact state of all creatures, for host→client sync. */
  snapshot(): CreatureState[] {
    return this.creatures.map((c) => ({
      id: c.id,
      kind: kindToNum(c.kind),
      x: c.x,
      y: c.y,
      facing: c.facing,
      hp: c.health,
      mhp: c.maxHealth,
      hurt: c.hurtFlash > 0,
    }));
  }

  update(dt: number, world: ChunkManager, player: Player, surfaceHeight: (x: number) => number): void {
    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const c = this.creatures[i];
      c.update(dt, world, player.centerX, player.centerY);
      if (c.hostile && this.overlaps(c, player)) player.health -= 22 * dt;
      const far = Math.abs(c.centerX - player.centerX) > 1000 || Math.abs(c.centerY - player.centerY) > 800;
      if (c.health <= 0 || far) this.creatures.splice(i, 1);
    }

    // Populate the area immediately so the world isn't empty.
    if (!this.primed) {
      this.primed = true;
      for (let i = 0; i < 4; i++) this.trySpawn(world, player, surfaceHeight);
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.creatures.length < this.CAP) {
      this.spawnTimer = 1.0 + Math.random() * 1.5;
      this.trySpawn(world, player, surfaceHeight);
    }
  }

  /** Damage the first creature whose body contains the world point. Returns true if one was hit. */
  hitAt(worldX: number, worldY: number, dmg: number): boolean {
    for (const c of this.creatures) {
      if (worldX >= c.x && worldX <= c.x + c.w && worldY >= c.y && worldY <= c.y + c.h) {
        c.health -= dmg;
        c.hurtFlash = 0.15;
        c.vx += Math.sign(c.centerX - worldX || 1) * 130;
        c.vy -= 130;
        return true;
      }
    }
    return false;
  }

  private trySpawn(world: ChunkManager, player: Player, surfaceHeight: (x: number) => number): void {
    const air = (x: number, y: number) => world.getFg(x, y) === TileId.Air && liquidLevel(world.getLiquid(x, y)) === 0;
    const pTileX = Math.floor(player.centerX / TILE_SIZE);
    const pTileY = Math.floor(player.centerY / TILE_SIZE);

    // Try a few candidate spots just off-screen; spawn at the first valid one.
    for (let attempt = 0; attempt < 6; attempt++) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      const tx = pTileX + dir * (16 + Math.floor(Math.random() * 16));
      if (pTileY > 40) {
        for (let dy = -6; dy <= 6; dy++) {
          const y = pTileY + dy;
          if (!air(tx, y)) continue;
          const floored = world.isSolid(tx, y + 1);
          this.spawn(tx, y, floored ? (Math.random() < 0.6 ? "slime" : "bat") : "bat");
          return;
        }
      } else {
        const sy = surfaceHeight(tx);
        if (air(tx, sy - 1) && air(tx, sy - 2)) {
          this.spawn(tx, sy - 2, Math.random() < 0.35 ? "slime" : "critter");
          return;
        }
      }
    }
  }

  private spawn(tx: number, ty: number, kind: CreatureKind): void {
    const c = new Creature(tx * TILE_SIZE + 1, ty * TILE_SIZE, kind);
    c.id = this.nextId++;
    this.creatures.push(c);
  }

  private overlaps(c: Creature, p: Player): boolean {
    return c.x < p.x + p.w && c.x + c.w > p.x && c.y < p.y + p.h && c.y + c.h > p.y;
  }
}
