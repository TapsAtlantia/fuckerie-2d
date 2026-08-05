import { hash2 } from "./Noise";
import { TileId } from "./Tile";
import { BAND, ORE } from "../config";
import type { Biome } from "./Biome";

// Phase 4 — tiered, depth-gated ore & gem generation.
//
// A real progression: copper/tin shallow → iron/lead → silver/tungsten → gold/platinum deep, coal
// throughout, and gems in deep "gem pockets". Metals come in pairs (like Terraria's alt ores); a
// world region deterministically uses one of each pair. Ores form clustered, irregular vein blobs
// (not single specks), placed on a coarse lattice. Deep areas are richer. Pure function of
// (seed, x, y, biome) → seamless across chunk borders, identical for every peer.

interface MetalEntry {
  name: string; // matches Biome.oreWeighting keys
  primary: TileId;
  alt: TileId; // used in "alt-metal" regions; === primary for coal (no alt)
  minDepth: number;
  maxDepth: number;
  weight: number; // selection weight (also the rough relative abundance)
  vein: number; // vein blob radius multiplier
}

interface GemEntry {
  name: string;
  id: TileId;
  minDepth: number;
  maxDepth: number;
  weight: number;
}

export class OreSystem {
  private seed: number;
  private readonly L = ORE.LATTICE_SIZE;

  // Metal & coal tiers. Shallow tiers taper out with depth (maxDepth), deep tiers gate in (minDepth).
  private readonly METALS: MetalEntry[] = [
    { name: "coal", primary: TileId.CoalOre, alt: TileId.CoalOre, minDepth: 6, maxDepth: 520, weight: 1.1, vein: 1.15 },
    { name: "copper", primary: TileId.CopperOre, alt: TileId.TinOre, minDepth: 8, maxDepth: 320, weight: 1.0, vein: 1.05 },
    { name: "iron", primary: TileId.IronOre, alt: TileId.LeadOre, minDepth: 60, maxDepth: 640, weight: 0.85, vein: 1.0 },
    { name: "silver", primary: TileId.SilverOre, alt: TileId.TungstenOre, minDepth: 240, maxDepth: 1200, weight: 0.6, vein: 0.92 },
    { name: "gold", primary: TileId.GoldOre, alt: TileId.PlatinumOre, minDepth: 430, maxDepth: BAND.UNDERWORLD, weight: 0.45, vein: 0.85 },
  ];

  // Gems live in deep gem pockets; higher-value gems sit deeper.
  private readonly GEMS: GemEntry[] = [
    { name: "amethyst", id: TileId.Amethyst, minDepth: 120, maxDepth: BAND.UNDERWORLD, weight: 1.0 },
    { name: "topaz", id: TileId.Topaz, minDepth: 160, maxDepth: BAND.UNDERWORLD, weight: 0.95 },
    { name: "sapphire", id: TileId.Sapphire, minDepth: 260, maxDepth: BAND.UNDERWORLD, weight: 0.8 },
    { name: "emerald", id: TileId.Emerald, minDepth: 320, maxDepth: BAND.UNDERWORLD, weight: 0.7 },
    { name: "ruby", id: TileId.Ruby, minDepth: 400, maxDepth: BAND.UNDERWORLD, weight: 0.6 },
    { name: "diamond", id: TileId.Diamond, minDepth: 520, maxDepth: BAND.UNDERWORLD, weight: 0.42 },
  ];

  constructor(seed: number) {
    this.seed = seed;
  }

  /** Ore/gem tile at (x, y) if present, else null. Only meaningful where the caller has stone. */
  oreAt(worldX: number, worldY: number, biome: Biome): TileId | null {
    const depth = Math.max(0, worldY);
    const latX = Math.floor(worldX / this.L);
    const latY = Math.floor(worldY / this.L);

    // Deeper cells are richer (more of them host a vein).
    const richness = 1 + Math.min(1, depth / BAND.CAVERN) * ORE.DEPTH_RICHNESS;
    const density = Math.min(0.6, ORE.VEIN_DENSITY * richness);

    // --- Metal / coal veins ---
    if (hash2(latX, latY, this.seed) < density) {
      const sel = hash2(latX * 2 + 11, latY * 2 + 3, this.seed + 101);
      const m = this.pickMetal(depth, biome, sel);
      if (m) {
        const id = this.useAltMetals(worldX) ? m.alt : m.primary;
        if (this.inBlob(worldX, worldY, latX, latY, ORE.VEIN_SIZE * m.vein, this.seed + id * 31)) {
          return id;
        }
      }
    }

    // --- Gem pockets (independent gate, deep) ---
    if (hash2(latX + 7, latY + 13, this.seed + 555) < ORE.GEM_DENSITY) {
      const gsel = hash2(latX * 5 + 2, latY * 5 + 9, this.seed + 777);
      const g = this.pickGem(depth, gsel);
      if (g && this.inBlob(worldX, worldY, latX, latY, ORE.VEIN_SIZE * 0.7, this.seed + g.id * 53)) {
        return g.id;
      }
    }

    return null;
  }

  /** Whether this region uses the alternate metals (tin/lead/tungsten/platinum). Coarse regions. */
  private useAltMetals(worldX: number): boolean {
    return hash2(Math.floor(worldX / ORE.ALT_METAL_REGION), 7, this.seed + 4242) > 0.5;
  }

  private pickMetal(depth: number, biome: Biome, selHash: number): MetalEntry | null {
    const applicable = this.METALS.filter((o) => depth >= o.minDepth && depth <= o.maxDepth);
    if (applicable.length === 0) return null;
    const weighted = applicable.map((o) => ({ o, w: o.weight * this.biomeBias(biome, o.name) }));
    return this.weightedPick(weighted, selHash);
  }

  private pickGem(depth: number, selHash: number): GemEntry | null {
    const applicable = this.GEMS.filter((g) => depth >= g.minDepth && depth <= g.maxDepth);
    if (applicable.length === 0) return null;
    const weighted = applicable.map((g) => ({ o: g, w: g.weight }));
    return this.weightedPick(weighted, selHash);
  }

  private biomeBias(biome: Biome, name: string): number {
    let bias = 1;
    for (const [oreName, mult] of biome.oreWeighting) {
      if (oreName === name) bias *= mult;
    }
    return bias;
  }

  private weightedPick<T>(weighted: { o: T; w: number }[], selHash: number): T | null {
    const total = weighted.reduce((s, x) => s + x.w, 0);
    if (total <= 0) return null;
    let t = selHash * total;
    for (const { o, w } of weighted) {
      t -= w;
      if (t <= 0) return o;
    }
    return weighted[weighted.length - 1]?.o ?? null;
  }

  /** Irregular vein blob centred (jittered) in the lattice cell — clustered, not a single speck. */
  private inBlob(worldX: number, worldY: number, latX: number, latY: number, radius: number, salt: number): boolean {
    const h = hash2(latX, latY, salt);
    const h2 = hash2(latX + 3, latY + 5, salt);
    const cx = latX * this.L + this.L * (0.3 + h * 0.4);
    const cy = latY * this.L + this.L * (0.3 + h2 * 0.4);
    const dx = worldX - cx;
    const dy = worldY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const r = radius * (0.75 + h * 0.5); // per-cell size variation
    // Coherent lobed edge: the radius varies smoothly with angle (organic "potato" outline) so the
    // blob is irregular like a real vein but always a single connected clump — no isolated specks.
    const ang = Math.atan2(dy, dx);
    const lobe =
      Math.sin(ang * 3 + h * 6.283) * ORE.BLOB_JITTER * 0.5 +
      Math.sin(ang * 5 + h2 * 6.283) * ORE.BLOB_JITTER * 0.3;
    return dist < r * (1 + lobe);
  }
}
