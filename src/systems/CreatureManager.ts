import { TILE_SIZE } from "../config";
import { Creature, type CreatureKind } from "../entities/Creature";
import { liquidLevel } from "../world/Liquid";
import { TileId } from "../world/Tile";
import type { ChunkManager } from "../world/ChunkManager";
import type { Player } from "../entities/Player";

// Spawns/despawns simple mobs around the player and applies contact damage. Local-only for now
// (creatures are not networked); each client runs its own population.
export class CreatureManager {
  readonly creatures: Creature[] = [];
  private spawnTimer = 1;
  private readonly CAP = 10;

  update(dt: number, world: ChunkManager, player: Player, surfaceHeight: (x: number) => number): void {
    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const c = this.creatures[i];
      c.update(dt, world, player.centerX, player.centerY);
      if (c.hostile && this.overlaps(c, player)) player.health -= 22 * dt;
      const far = Math.abs(c.centerX - player.centerX) > 1000 || Math.abs(c.centerY - player.centerY) > 800;
      if (c.health <= 0 || far) this.creatures.splice(i, 1);
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.creatures.length < this.CAP) {
      this.spawnTimer = 1.5 + Math.random() * 2.5;
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
    const dir = Math.random() < 0.5 ? -1 : 1;
    const tx = Math.floor(player.centerX / TILE_SIZE) + dir * (22 + Math.floor(Math.random() * 12));
    const pTileY = Math.floor(player.centerY / TILE_SIZE);
    const air = (x: number, y: number) => world.getFg(x, y) === TileId.Air && liquidLevel(world.getLiquid(x, y)) === 0;

    if (pTileY > 40) {
      // Underground: find a nearby cave-air tile at this column.
      for (let dy = -6; dy <= 6; dy++) {
        const y = pTileY + dy;
        if (!air(tx, y)) continue;
        const floored = world.isSolid(tx, y + 1);
        const kind: CreatureKind = floored ? (Math.random() < 0.6 ? "slime" : "bat") : "bat";
        this.spawn(tx, y, kind);
        return;
      }
    } else {
      const sy = surfaceHeight(tx);
      if (air(tx, sy - 1) && air(tx, sy - 2)) {
        const kind: CreatureKind = Math.random() < 0.3 ? "slime" : "critter";
        this.spawn(tx, sy - 2, kind);
      }
    }
  }

  private spawn(tx: number, ty: number, kind: CreatureKind): void {
    this.creatures.push(new Creature(tx * TILE_SIZE + 1, ty * TILE_SIZE, kind));
  }

  private overlaps(c: Creature, p: Player): boolean {
    return c.x < p.x + p.w && c.x + c.w > p.x && c.y < p.y + p.h && c.y + c.h > p.y;
  }
}
