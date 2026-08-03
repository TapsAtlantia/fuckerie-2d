import { hash2 } from "./Noise";
import { BAND } from "../config";
import type { Biome } from "./Biome";

/**
 * Biome modifiers are procedural mutations that can be applied to standard biomes
 * to create unique, localized variations that break up monotony.
 */

export enum BiomeModifier {
  GRAVITY_DEFYING = "gravity-defying",
  BIOLUMINESCENT = "bioluminescent",
  TOXIC_FLOOD = "toxic-flood",
  RUINED = "ruined",
  CRYSTALLIZED = "crystallized",
  INVERTED = "inverted",
  TIME_DILATED = "time-dilated",
  ELDRITCH = "eldritch",
  OVERGROWN = "overgrown",
  FROZEN_IN_TIME = "frozen-in-time",
}

export interface ModifierConfig {
  chance: number; // 0-1, probability of applying this modifier
  layers: [number, number][]; // Y ranges where this can appear [min, max]
  minDistance: number; // Minimum distance from spawn (in tiles)
  exclusiveWith: BiomeModifier[]; // Modifiers that can't coexist
  effects: ModifierEffect[];
}

export interface ModifierEffect {
  type: "physics" | "visual" | "gameplay";
  [key: string]: any; // Type-specific properties
}

export class BiomeModifierSystem {
  private seed: number;
  
  private readonly MODIFIERS: Record<BiomeModifier, ModifierConfig> = {
    [BiomeModifier.GRAVITY_DEFYING]: {
      chance: 0.02,
      layers: [[BAND.SKY - 400, BAND.SKY]],
      minDistance: 2000,
      exclusiveWith: [BiomeModifier.INVERTED],
      effects: [
        { type: "physics", gravity: 0.3 },
        { type: "visual", floatingBlocks: true },
      ],
    },
    [BiomeModifier.BIOLUMINESCENT]: {
      chance: 0.03,
      layers: [[BAND.UNDERGROUND, BAND.UNDERWORLD]],
      minDistance: 1000,
      exclusiveWith: [],
      effects: [
        { type: "visual", glowIntensity: 0.8 },
        { type: "visual", colorShift: [0, 50, 100] },
      ],
    },
    [BiomeModifier.TOXIC_FLOOD]: {
      chance: 0.015,
      layers: [[BAND.UNDERGROUND, BAND.CAVERN]],
      minDistance: 3000,
      exclusiveWith: [BiomeModifier.FROZEN_IN_TIME],
      effects: [
        { type: "gameplay", damage: 5 },
        { type: "visual", tint: [100, 150, 50] },
      ],
    },
    [BiomeModifier.RUINED]: {
      chance: 0.04,
      layers: [[BAND.SURFACE, BAND.CAVERN]],
      minDistance: 500,
      exclusiveWith: [],
      effects: [
        { type: "visual", debris: true },
        { type: "gameplay", lootMultiplier: 1.5 },
      ],
    },
    [BiomeModifier.CRYSTALLIZED]: {
      chance: 0.025,
      layers: [[BAND.CAVERN, BAND.UNDERWORLD]],
      minDistance: 4000,
      exclusiveWith: [BiomeModifier.RUINED],
      effects: [
        { type: "visual", crystalGrowth: true },
        { type: "gameplay", rareOreChance: 0.1 },
      ],
    },
    [BiomeModifier.INVERTED]: {
      chance: 0.01,
      layers: [[BAND.SKY - 400, BAND.SKY]],
      minDistance: 5000,
      exclusiveWith: [BiomeModifier.GRAVITY_DEFYING],
      effects: [
        { type: "physics", gravity: -0.5 },
        { type: "visual", inverted: true },
      ],
    },
    [BiomeModifier.TIME_DILATED]: {
      chance: 0.008,
      layers: [[BAND.UNDERGROUND, BAND.UNDERWORLD]],
      minDistance: 6000,
      exclusiveWith: [],
      effects: [
        { type: "physics", timeScale: 0.5 },
        { type: "visual", slowParticles: true },
      ],
    },
    [BiomeModifier.ELDRITCH]: {
      chance: 0.005,
      layers: [[BAND.UNDERWORLD, BAND.UNDERWORLD + 10000]],
      minDistance: 8000,
      exclusiveWith: [BiomeModifier.BIOLUMINESCENT],
      effects: [
        { type: "visual", distortion: true },
        { type: "gameplay", confusion: true },
      ],
    },
    [BiomeModifier.OVERGROWN]: {
      chance: 0.05,
      layers: [[BAND.SURFACE, BAND.UNDERGROUND]],
      minDistance: 1000,
      exclusiveWith: [BiomeModifier.CRYSTALLIZED],
      effects: [
        { type: "visual", denseVegetation: true },
        { type: "gameplay", movementSpeed: 0.7 },
      ],
    },
    [BiomeModifier.FROZEN_IN_TIME]: {
      chance: 0.01,
      layers: [[BAND.UNDERGROUND, BAND.CAVERN]],
      minDistance: 7000,
      exclusiveWith: [BiomeModifier.TOXIC_FLOOD],
      effects: [
        { type: "visual", staticParticles: true },
        { type: "gameplay", noMovement: false },
      ],
    },
  };
  
  constructor(seed: number) {
    this.seed = seed;
  }
  
  /**
   * Apply modifiers to a biome at a given position.
   * Returns the modified biome with applied modifiers.
   */
  applyModifiers(biome: Biome, worldX: number, worldY: number, layer: number): Biome & { appliedModifiers: BiomeModifier[] } {
    const distance = Math.sqrt(worldX * worldX + worldY * worldY);
    const modifiedBiome = { ...biome, appliedModifiers: [] as BiomeModifier[] };
    
    // Use coarse grid for modifier checks (every 50 tiles)
    const gridX = Math.floor(worldX / 50);
    const gridY = Math.floor(worldY / 50);
    
    for (const [modifier, config] of Object.entries(this.MODIFIERS)) {
      if (this.shouldApplyModifier(config, distance, layer, modifiedBiome.appliedModifiers, gridX, gridY)) {
        modifiedBiome.appliedModifiers.push(modifier as BiomeModifier);
        
        // Apply modifier effects to biome properties
        this.applyModifierEffects(modifiedBiome, config.effects);
      }
    }
    
    return modifiedBiome;
  }
  
  /**
   * Determine if a modifier should be applied.
   */
  private shouldApplyModifier(
    config: ModifierConfig,
    distance: number,
    layer: number,
    currentModifiers: BiomeModifier[],
    gridX: number,
    gridY: number
  ): boolean {
    // Check distance requirement
    if (distance < config.minDistance) return false;
    
    // Check layer requirement
    const inLayer = config.layers.some(([min, max]) => layer >= min && layer < max);
    if (!inLayer) return false;
    
    // Check exclusivity
    if (config.exclusiveWith.some(m => currentModifiers.includes(m))) return false;
    
    // Check chance using hash
    const hash = hash2(gridX, gridY, this.seed + 7777);
    return hash < config.chance;
  }
  
  /**
   * Apply modifier effects to biome properties.
   */
  private applyModifierEffects(biome: Biome & { appliedModifiers: BiomeModifier[] }, effects: ModifierEffect[]): void {
    for (const effect of effects) {
      switch (effect.type) {
        case "visual":
          // Visual effects don't change biome properties directly
          // They're handled by the renderer
          break;
        case "physics":
          // Physics effects handled by game engine
          break;
        case "gameplay":
          // Gameplay effects handled by game engine
          break;
      }
    }
  }
  
  /**
   * Get all modifiers that could apply at a given location.
   */
  getPossibleModifiers(worldX: number, worldY: number, layer: number): BiomeModifier[] {
    const distance = Math.sqrt(worldX * worldX + worldY * worldY);
    const possible: BiomeModifier[] = [];
    
    for (const [modifier, config] of Object.entries(this.MODIFIERS)) {
      if (distance >= config.minDistance) {
        const inLayer = config.layers.some(([min, max]) => layer >= min && layer < max);
        if (inLayer) {
          possible.push(modifier as BiomeModifier);
        }
      }
    }
    
    return possible;
  }
  
  /**
   * Get modifier configuration by ID.
   */
  getModifierConfig(modifier: BiomeModifier): ModifierConfig | null {
    return this.MODIFIERS[modifier] || null;
  }
}