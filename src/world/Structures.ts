import { hash2 } from "./Noise";
import { TileId } from "./Tile";
import { BAND, CHUNK_SIZE, STRUCTURE } from "../config";
import type { Noise } from "./Noise";

/**
 * Structure system for deterministic cross-chunk building generation.
 * Uses a coarse grid of structure cells, each hashed from the seed to determine
 * structure type, position, and contents. Pure function ensures seamlessness.
 */

export type StructureType = 
  | "none" 
  | "hut" 
  | "house" 
  | "tower" 
  | "castle" 
  | "dungeon" 
  | "mineshaft" 
  | "sky_temple";

interface StructureCell {
  cx: number; // cell X in structure grid
  cy: number; // cell Y in structure grid
  hasStructure: boolean;
  type: StructureType;
  originX: number; // world X of structure origin
  originY: number; // world Y of structure origin
  seed: number; // RNG seed for this structure
}

interface BuildingParams {
  width: number;
  height: number;
  material: TileId;
  roofStyle: "flat" | "peaked" | "dome";
  hasDoor: boolean;
  hasWindows: boolean;
  hasTorches: boolean;
  floors: number;
}

export class StructureSystem {
  private seed: number;
  private noise: Noise;
  
  // Structure cell size (tiles) - coarse grid for structure placement
  private readonly CELL_SIZE = STRUCTURE.CELL_SIZE;
  
  // Settlement field parameters for villages/cities
  private readonly SETTLEMENT_SCALE = STRUCTURE.SETTLEMENT_SCALE;

  constructor(seed: number, noise: Noise) {
    this.seed = seed;
    this.noise = noise;
  }

  /**
   * Get structure tile overrides for a chunk.
   * Returns a map of local (lx, ly) -> (fg, bg) tile IDs that should be overwritten.
   */
  structureOverridesForChunk(
    chunkCx: number,
    chunkCy: number
  ): Map<string, { fg: TileId; bg: TileId }> {
    const overrides = new Map<string, { fg: TileId; bg: TileId }>();
    
    const chunkWorldX = chunkCx * CHUNK_SIZE;
    const chunkWorldY = chunkCy * CHUNK_SIZE;
    
    // Calculate which structure cells could intersect this chunk
    const minCellX = Math.floor((chunkWorldX - this.CELL_SIZE) / this.CELL_SIZE);
    const maxCellX = Math.floor((chunkWorldX + CHUNK_SIZE + this.CELL_SIZE) / this.CELL_SIZE);
    const minCellY = Math.floor((chunkWorldY - this.CELL_SIZE) / this.CELL_SIZE);
    const maxCellY = Math.floor((chunkWorldY + CHUNK_SIZE + this.CELL_SIZE) / this.CELL_SIZE);
    
    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
        const cell = this.getStructureCell(cellX, cellY);
        if (cell.hasStructure) {
          this.stampStructure(cell, chunkWorldX, chunkWorldY, overrides);
        }
      }
    }
    
    return overrides;
  }

  /** Get structure cell properties from deterministic hash. */
  private getStructureCell(cx: number, cy: number): StructureCell {
    const h = hash2(cx, cy, this.seed);
    
    // Determine if this cell has a structure
    const hasStructure = h > (1 - STRUCTURE.STRUCTURE_CHANCE); // 30% of cells have structures
    
    if (!hasStructure) {
      return { cx, cy, hasStructure: false, type: "none", originX: 0, originY: 0, seed: 0 };
    }
    
    // Determine structure type based on depth and random
    const worldY = cy * this.CELL_SIZE;
    const type = this.selectStructureType(worldY, h);
    
    // Jittered origin within the cell
    const originX = cx * this.CELL_SIZE + (h * this.CELL_SIZE * 0.4 + this.CELL_SIZE * 0.3);
    const originY = cy * this.CELL_SIZE + ((h * 17 % 1) * this.CELL_SIZE * 0.4 + this.CELL_SIZE * 0.3);
    
    return {
      cx,
      cy,
      hasStructure: true,
      type,
      originX: Math.floor(originX),
      originY: Math.floor(originY),
      seed: this.seed + cx * 7 + cy * 13,
    };
  }

  /** Select structure type based on depth and biome context. */
  private selectStructureType(worldY: number, h: number): StructureType {
    if (worldY < BAND.SKY) {
      return "sky_temple";
    }
    
    if (worldY >= BAND.UNDERWORLD) {
      // Underground: obsidian fortress (use castle type with hellstone)
      return "castle";
    }
    
    if (worldY >= BAND.CAVERN - 100) {
      // Deep underground: dungeons
      return h > 0.85 ? "dungeon" : "mineshaft";
    }
    
    if (worldY >= 50) {
      // Underground: mineshafts
      return "mineshaft";
    }
    
    // Surface: check settlement field for villages/cities
    const settlement = this.noise.fbm2D(worldY * this.SETTLEMENT_SCALE, 0, 2);
    
    if (settlement > 0.4) {
      // High settlement = city-like (larger buildings)
      return h > 0.8 ? "castle" : "house";
    } else if (settlement > 0.2) {
      // Medium settlement = village
      return h > 0.7 ? "house" : "hut";
    } else {
      // Low settlement = isolated structures
      return h > 0.8 ? "tower" : "hut";
    }
  }

  /** Stamp a structure's tiles into the overrides map if they fall within the chunk. */
  private stampStructure(
    cell: StructureCell,
    chunkWorldX: number,
    chunkWorldY: number,
    overrides: Map<string, { fg: TileId; bg: TileId }>
  ): void {
    switch (cell.type) {
      case "hut":
        this.stampBuilding(cell, chunkWorldX, chunkWorldY, overrides, {
          width: 5,
          height: 4,
          material: TileId.Planks,
          roofStyle: "peaked",
          hasDoor: true,
          hasWindows: false,
          hasTorches: true,
          floors: 1,
        });
        break;
      case "house":
        this.stampBuilding(cell, chunkWorldX, chunkWorldY, overrides, {
          width: 7,
          height: 6,
          material: TileId.StoneBrick,
          roofStyle: "peaked",
          hasDoor: true,
          hasWindows: true,
          hasTorches: true,
          floors: 2,
        });
        break;
      case "tower":
        this.stampBuilding(cell, chunkWorldX, chunkWorldY, overrides, {
          width: 4,
          height: 10,
          material: TileId.Cobblestone,
          roofStyle: "flat",
          hasDoor: true,
          hasWindows: true,
          hasTorches: true,
          floors: 3,
        });
        break;
      case "castle":
        this.stampBuilding(cell, chunkWorldX, chunkWorldY, overrides, {
          width: 12,
          height: 8,
          material: cell.originY >= BAND.UNDERWORLD ? TileId.Obsidian : TileId.StoneBrick,
          roofStyle: "flat",
          hasDoor: true,
          hasWindows: true,
          hasTorches: true,
          floors: 2,
        });
        break;
      case "dungeon":
        this.stampDungeon(cell, chunkWorldX, chunkWorldY, overrides);
        break;
      case "mineshaft":
        this.stampMineshaft(cell, chunkWorldX, chunkWorldY, overrides);
        break;
      case "sky_temple":
        this.stampSkyTemple(cell, chunkWorldX, chunkWorldY, overrides);
        break;
      case "none":
        break;
    }
  }

  /** Stamp a basic building structure. */
  private stampBuilding(
    cell: StructureCell,
    chunkWorldX: number,
    chunkWorldY: number,
    overrides: Map<string, { fg: TileId; bg: TileId }>,
    params: BuildingParams
  ): void {
    const { width, height, material, roofStyle, hasDoor, hasWindows, hasTorches, floors } = params;
    const ox = cell.originX;
    const oy = cell.originY;
    
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const worldX = ox + dx;
        const worldY = oy + dy;
        
        // Check if this tile is within the chunk
        if (worldX < chunkWorldX || worldX >= chunkWorldX + CHUNK_SIZE ||
            worldY < chunkWorldY || worldY >= chunkWorldY + CHUNK_SIZE) {
          continue;
        }
        
        const lx = worldX - chunkWorldX;
        const ly = worldY - chunkWorldY;
        const key = `${lx},${ly}`;
        
        const isWall = dx === 0 || dx === width - 1 || dy === 0 || dy === height - 1;
        const isDoor = hasDoor && dy === height - 1 && dx === Math.floor(width / 2);
        const isWindow = hasWindows && !isDoor && !isWall && 
                         (dx === 1 || dx === width - 2) && dy > 0 && dy < height - 1;
        
        if (isDoor) {
          overrides.set(key, { fg: TileId.Air, bg: TileId.Planks });
        } else if (isWindow) {
          overrides.set(key, { fg: TileId.Glass, bg: material });
        } else if (isWall) {
          overrides.set(key, { fg: material, bg: TileId.Air });
        } else {
          overrides.set(key, { fg: TileId.Air, bg: material });
        }
      }
    }
    
    // Roof
    if (roofStyle === "peaked") {
      for (let i = 0; i <= Math.floor(width / 2); i++) {
        const roofY = oy - 1 - i;
        for (let dx = i; dx < width - i; dx++) {
          const worldX = ox + dx;
          const worldY = roofY;
          
          if (worldX >= chunkWorldX && worldX < chunkWorldX + CHUNK_SIZE &&
              worldY >= chunkWorldY && worldY < chunkWorldY + CHUNK_SIZE) {
            const lx = worldX - chunkWorldX;
            const ly = worldY - chunkWorldY;
            overrides.set(`${lx},${ly}`, { fg: material, bg: TileId.Air });
          }
        }
      }
    }
    
    // Torches
    if (hasTorches) {
      const torchPositions = [
        { x: 1, y: height - 2 },
        { x: width - 2, y: height - 2 },
      ];
      
      for (const pos of torchPositions) {
        const worldX = ox + pos.x;
        const worldY = oy + pos.y;
        
        if (worldX >= chunkWorldX && worldX < chunkWorldX + CHUNK_SIZE &&
            worldY >= chunkWorldY && worldY < chunkWorldY + CHUNK_SIZE) {
          const lx = worldX - chunkWorldX;
          const ly = worldY - chunkWorldY;
          overrides.set(`${lx},${ly}`, { fg: TileId.Torch, bg: material });
        }
      }
    }
  }

  /** Stamp a simple dungeon room. */
  private stampDungeon(
    cell: StructureCell,
    chunkWorldX: number,
    chunkWorldY: number,
    overrides: Map<string, { fg: TileId; bg: TileId }>
  ): void {
    const ox = cell.originX;
    const oy = cell.originY;
    const width = 8;
    const height = 6;
    
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const worldX = ox + dx;
        const worldY = oy + dy;
        
        if (worldX < chunkWorldX || worldX >= chunkWorldX + CHUNK_SIZE ||
            worldY < chunkWorldY || worldY >= chunkWorldY + CHUNK_SIZE) {
          continue;
        }
        
        const lx = worldX - chunkWorldX;
        const ly = worldY - chunkWorldY;
        const key = `${lx},${ly}`;
        
        const isWall = dx === 0 || dx === width - 1 || dy === 0 || dy === height - 1;
        const isDoor = dy === height - 1 && dx === Math.floor(width / 2);
        
        if (isDoor) {
          overrides.set(key, { fg: TileId.Air, bg: TileId.StoneBrick });
        } else if (isWall) {
          overrides.set(key, { fg: TileId.StoneBrick, bg: TileId.Air });
        } else {
          overrides.set(key, { fg: TileId.Air, bg: TileId.StoneBrick });
        }
      }
    }
    
    // Add a torch
    const torchX = ox + 1;
    const torchY = oy + 1;
    if (torchX >= chunkWorldX && torchX < chunkWorldX + CHUNK_SIZE &&
        torchY >= chunkWorldY && torchY < chunkWorldY + CHUNK_SIZE) {
      const lx = torchX - chunkWorldX;
      const ly = torchY - chunkWorldY;
      overrides.set(`${lx},${ly}`, { fg: TileId.Torch, bg: TileId.StoneBrick });
    }
  }

  /** Stamp a mineshaft corridor. */
  private stampMineshaft(
    cell: StructureCell,
    chunkWorldX: number,
    chunkWorldY: number,
    overrides: Map<string, { fg: TileId; bg: TileId }>
  ): void {
    const ox = cell.originX;
    const oy = cell.originY;
    const length = 20;
    const direction = hash2(cell.cx, cell.cy, cell.seed) > 0.5 ? "horizontal" : "vertical";
    
    if (direction === "horizontal") {
      for (let dx = 0; dx < length; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const worldX = ox + dx;
          const worldY = oy + dy;
          
          if (worldX < chunkWorldX || worldX >= chunkWorldX + CHUNK_SIZE ||
              worldY < chunkWorldY || worldY >= chunkWorldY + CHUNK_SIZE) {
            continue;
          }
          
          const lx = worldX - chunkWorldX;
          const ly = worldY - chunkWorldY;
          const key = `${lx},${ly}`;
          
          const isWall = dy === -1 || dy === 1;
          if (isWall) {
            overrides.set(key, { fg: TileId.Planks, bg: TileId.Air });
          } else {
            overrides.set(key, { fg: TileId.Air, bg: TileId.Planks });
          }
        }
      }
    } else {
      for (let dy = 0; dy < length; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const worldX = ox + dx;
          const worldY = oy + dy;
          
          if (worldX < chunkWorldX || worldX >= chunkWorldX + CHUNK_SIZE ||
              worldY < chunkWorldY || worldY >= chunkWorldY + CHUNK_SIZE) {
            continue;
          }
          
          const lx = worldX - chunkWorldX;
          const ly = worldY - chunkWorldY;
          const key = `${lx},${ly}`;
          
          const isWall = dx === -1 || dx === 1;
          if (isWall) {
            overrides.set(key, { fg: TileId.Planks, bg: TileId.Air });
          } else {
            overrides.set(key, { fg: TileId.Air, bg: TileId.Planks });
          }
        }
      }
    }
    
    // Add torches periodically
    const torchInterval = 5;
    for (let i = 0; i < length; i += torchInterval) {
      let torchX, torchY;
      if (direction === "horizontal") {
        torchX = ox + i;
        torchY = oy;
      } else {
        torchX = ox;
        torchY = oy + i;
      }
      
      if (torchX >= chunkWorldX && torchX < chunkWorldX + CHUNK_SIZE &&
          torchY >= chunkWorldY && torchY < chunkWorldY + CHUNK_SIZE) {
        const lx = torchX - chunkWorldX;
        const ly = torchY - chunkWorldY;
        overrides.set(`${lx},${ly}`, { fg: TileId.Torch, bg: TileId.Planks });
      }
    }
  }

  /** Stamp a sky temple on floating islands. */
  private stampSkyTemple(
    cell: StructureCell,
    chunkWorldX: number,
    chunkWorldY: number,
    overrides: Map<string, { fg: TileId; bg: TileId }>
  ): void {
    const ox = cell.originX;
    const oy = cell.originY;
    const width = 10;
    const height = 8;
    
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const worldX = ox + dx;
        const worldY = oy + dy;
        
        if (worldX < chunkWorldX || worldX >= chunkWorldX + CHUNK_SIZE ||
            worldY < chunkWorldY || worldY >= chunkWorldY + CHUNK_SIZE) {
          continue;
        }
        
        const lx = worldX - chunkWorldX;
        const ly = worldY - chunkWorldY;
        const key = `${lx},${ly}`;
        
        const isWall = dx === 0 || dx === width - 1 || dy === 0 || dy === height - 1;
        const isPillar = (dx === 2 || dx === width - 3) && dy < height - 1;
        
        if (isPillar) {
          overrides.set(key, { fg: TileId.SkyStone, bg: TileId.Air });
        } else if (isWall) {
          overrides.set(key, { fg: TileId.CloudStone, bg: TileId.Air });
        } else {
          overrides.set(key, { fg: TileId.Air, bg: TileId.CloudStone });
        }
      }
    }
    
    // Add lanterns
    const lanternPositions = [
      { x: 1, y: height - 2 },
      { x: width - 2, y: height - 2 },
    ];
    
    for (const pos of lanternPositions) {
      const worldX = ox + pos.x;
      const worldY = oy + pos.y;
      
      if (worldX >= chunkWorldX && worldX < chunkWorldX + CHUNK_SIZE &&
          worldY >= chunkWorldY && worldY < chunkWorldY + CHUNK_SIZE) {
        const lx = worldX - chunkWorldX;
        const ly = worldY - chunkWorldY;
        overrides.set(`${lx},${ly}`, { fg: TileId.Lantern, bg: TileId.CloudStone });
      }
    }
  }
}
