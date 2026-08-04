// Self-contained, seedable 2D simplex noise + fBm + Worley noise. No external dependencies so the
// prototype runs fully offline on GitHub Pages. Generation is a pure function of the
// seed + coordinates, which is what makes the infinite world deterministic.

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

const GRAD2: ReadonlyArray<readonly [number, number]> = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [1, 0], [-1, 0],
  [0, 1], [0, -1], [0, 1], [0, -1],
];

// Deterministic 32-bit PRNG (mulberry32) — used only to build the permutation table.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Noise {
  private perm = new Uint8Array(512);
  private permMod12 = new Uint8Array(512);
  readonly seed: number;

  constructor(seed: number) {
    this.seed = seed;
    const rand = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    // Fisher-Yates shuffle seeded by the PRNG.
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }

  /** 2D simplex noise in the range [-1, 1]. */
  noise2D(xin: number, yin: number): number {
    const perm = this.perm;
    const permMod12 = this.permMod12;

    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);

    let i1: number, j1: number;
    if (x0 > y0) {
      i1 = 1;
      j1 = 0;
    } else {
      i1 = 0;
      j1 = 1;
    }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;

    const ii = i & 255;
    const jj = j & 255;

    let n0 = 0, n1 = 0, n2 = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      const g = GRAD2[permMod12[ii + perm[jj]]];
      t0 *= t0;
      n0 = t0 * t0 * (g[0] * x0 + g[1] * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      const g = GRAD2[permMod12[ii + i1 + perm[jj + j1]]];
      t1 *= t1;
      n1 = t1 * t1 * (g[0] * x1 + g[1] * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      const g = GRAD2[permMod12[ii + 1 + perm[jj + 1]]];
      t2 *= t2;
      n2 = t2 * t2 * (g[0] * x2 + g[1] * y2);
    }

    // Scale to roughly [-1, 1].
    return 70 * (n0 + n1 + n2);
  }

  /** Fractal Brownian motion: layered octaves of simplex noise, normalised to ~[-1, 1]. */
  fbm2D(x: number, y: number, octaves = 4, lacunarity = 2, gain = 0.5): number {
    let freq = 1;
    let amp = 1;
    let sum = 0;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.noise2D(x * freq, y * freq);
      norm += amp;
      freq *= lacunarity;
      amp *= gain;
    }
    return sum / norm;
  }

  /** Worley noise (cellular noise) for rocky/uneven surfaces - returns distance to nearest feature point. */
  worley2D(x: number, y: number, scale: number): number {
    const cellX = Math.floor(x * scale);
    const cellY = Math.floor(y * scale);
    
    let minDist = Infinity;
    
    // Check 3x3 grid of cells around current position
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = cellX + dx;
        const cy = cellY + dy;
        
        // Generate feature point within this cell
        const h = hash2(cx, cy, this.seed);
        const fx = cx + h;
        const fy = cy + ((h * 7) % 1);
        
        const dist = Math.sqrt((x * scale - fx) ** 2 + (y * scale - fy) ** 2);
        if (dist < minDist) {
          minDist = dist;
        }
      }
    }
    
    return minDist;
  }

  /** Ridged multifractal noise - creates sharp, mountain-like features. */
  ridgedFbm2D(x: number, y: number, octaves = 4, lacunarity = 2, gain = 0.5): number {
    let freq = 1;
    let amp = 1;
    let sum = 0;
    let norm = 0;
    
    for (let o = 0; o < octaves; o++) {
      const n = 1 - Math.abs(this.noise2D(x * freq, y * freq));
      sum += amp * n * n;
      norm += amp;
      freq *= lacunarity;
      amp *= gain;
    }
    
    return sum / norm;
  }
}

/**
 * Stateless integer hash → [0, 1). Used for deterministic per-coordinate decisions
 * (e.g. Phase 2 structure placement) without allocating a Noise instance.
 */
export function hash2(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Layered noise system for anti-repetitive terrain generation.
 * Combines multiple noise algorithms at different scales for natural-looking terrain.
 */
export class LayeredNoiseSystem {
  private continental: Noise;
  private regional: Noise;
  private local: Noise;
  private micro: Noise;
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
    this.continental = new Noise(seed);
    this.regional = new Noise(seed + 1);
    this.local = new Noise(seed + 2);
    this.micro = new Noise(seed + 3);
  }

  /**
   * Generate terrain height using layered noise composition.
   * @param x World X coordinate
   * @param y World Y coordinate (for 3D terrain variations)
   * @param amplitude Biome-specific amplitude multiplier
   */
  terrainHeight(x: number, y: number, amplitude: number = 1): number {
    // Continental-scale features (10,000+ tiles)
    const continental = this.continental.fbm2D(x * 0.00005, y * 0.00005, 6) * 200;
    
    // Regional features (1,000-10,000 tiles)
    const regional = this.regional.fbm2D(x * 0.0002, y * 0.0002, 4) * 80;
    
    // Local terrain (10-1,000 tiles)
    const local = this.local.fbm2D(x * 0.002, y * 0.002, 3) * 30;
    
    // Micro-features (1-10 tiles) using Worley noise for rocky surfaces
    const micro = (this.micro.worley2D(x, y, 0.02) - 0.5) * 5;
    
    return (continental + regional + local + micro) * amplitude;
  }

  /**
   * Generate climate data (temperature, humidity, precipitation).
   */
  climate(x: number, y: number): Climate {
    // Higher-frequency climate so biomes actually change as you walk (a biome every ~1-2k tiles),
    // instead of one biome stretching across ~12k tiles.
    const temperature = this.continental.fbm2D(x * 0.0006, y * 0.0006, 4); // -1 (cold) to 1 (hot)
    const humidity = this.regional.fbm2D(x * 0.0005 + 100, y * 0.0005 + 100, 4); // -1 (dry) to 1 (wet)
    const precipitation = Math.max(0, this.local.fbm2D(x * 0.0008, y * 0.0008, 3)); // 0 to 1
    
    return { temperature, humidity, precipitation };
  }

  /**
   * Generate mountain-specific terrain using ridged noise.
   */
  mountainHeight(x: number, y: number, amplitude: number = 1): number {
    const base = this.regional.ridgedFbm2D(x * 0.0003, y * 0.0003, 5);
    const detail = this.local.fbm2D(x * 0.002, y * 0.002, 3) * 20;
    
    return (base * 100 + detail) * amplitude;
  }

  /**
   * Generate canyon/valley features using domain warping.
   */
  canyonDepth(x: number, y: number): number {
    const warpX = x + this.continental.noise2D(x * 0.01, y * 0.01) * 50;
    const warpY = y + this.continental.noise2D(x * 0.01 + 50, y * 0.01 + 50) * 50;
    
    const canyon = this.regional.fbm2D(warpX * 0.002, warpY * 0.002, 3);

    // Create sharp canyon where noise is near zero
    const canyonMask = 1 - Math.abs(canyon);
    return Math.max(0, canyonMask * 50);
  }

  /**
   * Composited surface elevation in tiles (higher value = higher altitude). A gentle rolling
   * baseline everywhere (walking-scale hills for liveliness), plus regional mountain ranges and
   * valleys driven by a smooth "tectonic" field — so the world reads like a real planet where
   * landforms vary by region, not a uniform flat plain.
   */
  surfaceElevation(x: number): number {
    const base = this.continental.fbm2D(x * 0.00006, 0, 4) * 60; // broad continents
    const region = this.regional.fbm2D(x * 0.0004 + 20, 0, 4) * 30; // regional swells

    // Roughness field flattens some stretches (plains) and lets others be hillier — walking-scale
    // liveliness so the ground is never a dead-flat plain.
    const rough = 0.5 + 0.5 * (this.micro.fbm2D(x * 0.0009 + 7, 0, 2) * 0.5 + 0.5);
    const hills =
      (this.local.fbm2D(x * 0.006, 0, 3) * 22 +
        this.local.fbm2D(x * 0.02 + 9, 0, 3) * 12 +
        this.local.fbm2D(x * 0.05 + 3, 0, 2) * 5) * rough;

    // Tectonic field: mostly gentle, but where it's high a ridged mountain range rises, and where
    // it's low the ground sinks into basins/valleys. (fBm output is modest in magnitude, so the
    // threshold is low and the amplitude large to actually produce real peaks.)
    const tect = this.regional.fbm2D(x * 0.00016 + 50, 0, 3);
    let landform = 0;
    if (tect > 0.15) {
      const m = Math.min(1, (tect - 0.15) / 0.35);
      landform += this.regional.ridgedFbm2D(x * 0.0022, 0, 4) * 220 * m;
    } else if (tect < -0.15) {
      const v = Math.min(1, (-0.15 - tect) / 0.35);
      landform -= (1 - Math.abs(this.regional.fbm2D(x * 0.001 + 5, 0, 3))) * 85 * v;
    }

    return base + region + hills + landform;
  }
}

export interface Climate {
  temperature: number; // -1 to 1
  humidity: number; // -1 to 1
  precipitation: number; // 0 to 1
}
