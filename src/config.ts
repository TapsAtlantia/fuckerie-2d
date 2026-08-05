// Central tunables. Everything that another module might want to tweak lives here
// so the game can be re-balanced without hunting through logic files.

export const TILE_SIZE = 16; // world pixels per tile
export const CHUNK_SIZE = 32; // tiles per chunk side
export const CHUNK_PIXELS = TILE_SIZE * CHUNK_SIZE;

// How many chunks beyond the visible rectangle to keep resident before unloading.
export const VIEW_MARGIN_CHUNKS = 2;

export const DEFAULT_SEED = 1337;

// Rendering / camera --------------------------------------------------------
export const ZOOM = 2.5; // screen pixels per world pixel (tiles look ~40px)
export const CAMERA_LERP = 8; // higher = snappier camera follow

// Physics (units: world pixels, seconds) ------------------------------------
export const GRAVITY = 1500;
export const MAX_FALL_SPEED = 1400;
export const MOVE_ACCEL = 3200;
export const AIR_ACCEL = 1800;
export const MAX_RUN_SPEED = 220;
export const GROUND_FRICTION = 2600;
export const JUMP_SPEED = 470;
export const COYOTE_TIME = 0.09; // seconds after leaving ground you can still jump
export const JUMP_BUFFER = 0.1; // seconds a jump press is remembered

export const PLAYER_W = 12; // pixels
export const PLAYER_H = 22; // pixels

export const FLY_SPEED = 900; // noclip fly speed (debug)

// Interaction ---------------------------------------------------------------
export const REACH_TILES = 7; // max mining/placing distance from player centre

// Depth bands, in absolute world-Y TILES (+Y is down). Surface oscillates near 0.
export const BAND = {
  SKY: -400, // y < SKY  -> space / floating islands
  SURFACE: 0, // surface level
  UNDERGROUND: 0, // 0..CAVERN
  CAVERN: 600,
  UNDERWORLD: 40000,
} as const;

// Lighting ------------------------------------------------------------------
export const LIGHT_MAX = 255;
export const DAYLIGHT: readonly [number, number, number] = [235, 244, 255];
export const TORCH: readonly [number, number, number] = [255, 206, 148];
export const TORCH_STRENGTH = 235;
export const LIGHT_ATTEN_AIR = 22; // light lost per tile through air
export const LIGHT_ATTEN_SOLID = 55; // light lost per tile through solid

// Phase 2: Biome parameters ------------------------------------------------
export const BIOME = {
  TEMPERATURE_SCALE: 0.0008, // scale of temperature noise field
  HUMIDITY_SCALE: 0.0008, // scale of humidity noise field
  AMPLITUDE_SMOOTH_SCALE: 0.001, // scale of amplitude smoothing noise
} as const;

// Phase 2: Cave parameters --------------------------------------------------
export const CAVE = {
  REGION_SCALE: 0.0035, // scale of cave-region mask: ~285-tile 2D pockets that cluster shallow caves
  REGION_THRESHOLD: 0.2, // regionMask (~[-1,1]) must exceed this near the surface → caves cluster
  // into systems with solid rock between (surface reads mostly solid)
  REGION_DEPTH_RELAX: 0.9, // region gate relaxes with depth → the deep is caves-everywhere
  BASE_SCALE: 0.045, // scale of domain-warped tunnel noise
  WARP_SCALE: 0.02, // scale of domain warping

  // Spaghetti: thin, winding worm tunnels (the connective tissue), kept walkable but sparse; they
  // widen with depth to stitch the deep caverns into one network.
  SPAGHETTI_WIDTH: 0.055, // base half-width
  SPAGHETTI_DEPTH_GAIN: 0.05, // tunnels widen with depth

  // Cheese: big open caverns — a low-frequency blob field whose threshold falls with depth, so rooms
  // grow larger and more common the deeper you go (huge in the deep). Fewer/bigger rooms threaded by
  // tunnels read better than many small blobs.
  CHEESE_SCALE: 0.008, // cavern field scale (lower = bigger, fewer, better-connected rooms)
  CHEESE_THRESHOLD: 0.7, // near-surface: high → caverns rare up top
  CHEESE_DEPTH_GAIN: 0.3, // threshold drop by the cavern layer (BAND.CAVERN)
  CHEESE_DEEP_GAIN: 0.14, // further drop in the deep below the cavern layer
  CHEESE_MIN_THRESHOLD: 0.3, // never fully hollow — keep rock between the deep caverns

  SURFACE_CRUST: 6, // solid tiles above any cave on normal ground (no random surface pits)

  // Organic aboveground cave mouths: on steep mountainsides only, an opening is actively carved into
  // the hillside (rounded notch that deepens toward the site centre) and connects to the caves below.
  // Flat ground never gets one, so this is a mountainside entrance, not a random pit.
  MOUTH_MIN_SLOPE: 4, // surface must be at least this steep (tiles rise over the ±2 slope sample)
  MOUTH_SCALE: 0.02, // frequency of the mouth-presence field (~50-tile sites)
  MOUTH_THRESHOLD: 0.38, // presence field must exceed this → occasional but findable
  MOUTH_MIN_OPEN: 7, // every mouth carves at least this deep → always clearly visible
  MOUTH_DEPTH: 18, // tiles carved open at a mouth's centre
  MOUTH_CRUST: 1, // crust drops to this at a mouth so the caves below break through into it
} as const;

// Phase 3: Surface landform realism — plateaus/mesas, rivers, beaches (all pure fn of world-x).
export const PLATEAU = {
  SCALE: 0.0009, // frequency of the plateau/mesa field
  THRESHOLD: 0.28, // field must exceed this for a region to become a stepped mesa
  STEP: 12, // elevation is quantized to this many tiles → flat tops + cliff edges
  STRENGTH: 0.82, // how strongly the terrain snaps to the steps (0..1)
} as const;

export const RIVER = {
  PRESENCE_SCALE: 0.0006, // frequency of the "does a river exist here" field
  PRESENCE_THRESHOLD: 0.45, // above this → river region (occasional, not everywhere)
  MEANDER_SCALE: 0.004, // frequency of the meandering channel path
  WIDTH: 0.12, // |meander| below this is inside the channel band
  DEPTH: 11, // max tiles the channel carves down at its center
  MAX_ELEV: 70, // no rivers above this elevation (keeps them off high peaks)
} as const;

export const BEACH = {
  RADIUS: 3, // how many columns out to look for adjacent water
  BAND: 4, // dry ground within this many tiles above a nearby water level becomes sand
  BED_DEPTH: 3, // sand depth for shores/beds
} as const;

export const WATER = {
  SCAN_WIN: 18, // tiles scanned each side for a basin's containing rim; keeps pools narrow & FLAT
  MIN_DEPTH: 4, // a basin must be at least this deep below its spill rim to hold standing water
  MAX_DEPTH: 20, // cap pool depth so narrow chasms don't fill into deep water columns
  LAKE_FIELD_THRESHOLD: 0.25, // natural (non-river) dips also need this lake field to be wet
} as const;

// Ore parameters (Phase 4 rework) -------------------------------------------
export const ORE = {
  LATTICE_SIZE: 14, // tiles between candidate vein centres
  VEIN_DENSITY: 0.2, // fraction of lattice cells that host a metal/coal vein (near surface)
  DEPTH_RICHNESS: 0.6, // extra vein density by the cavern layer (deep areas are richer)
  GEM_DENSITY: 0.05, // fraction of deep cells that host a gem pocket
  VEIN_SIZE: 3.0, // base vein blob radius (tiles); per-ore multipliers in Ores.ts
  BLOB_JITTER: 0.5, // irregularity of vein blob edges (0 = round, 1 = very ragged)
  ALT_METAL_REGION: 6000, // tiles: size of a region that uses tin/lead/tungsten/platinum vs the originals
} as const;

// Phase 7: Evil biome (Corruption OR Crimson, seed-chosen) -------------------
export const EVIL = {
  SCALE: 0.00035, // frequency of the evil-region field (occasional bands)
  THRESHOLD: 0.42, // field must exceed this → evil biome band
  CHASM_SCALE: 0.07, // frequency of the vertical chasm field within an evil band
  CHASM_WIDTH: 0.07, // |field| below this is inside a chasm (narrow crevices)
  CHASM_DEPTH: 55, // how deep chasms carve from the surface
  ORB_LATTICE: 22, // spacing of shadow-orb/crimson-heart nodes underground
  ORB_CHANCE: 0.14, // per-lattice chance of an orb/heart in evil stone
  ALTAR_CHANCE: 0.3, // per-lattice chance of an altar in evil stone
} as const;

// Phase 2: Structure parameters ---------------------------------------------
export const STRUCTURE = {
  CELL_SIZE: 64, // tiles per structure cell (larger = more spread out)
  SETTLEMENT_SCALE: 0.0002, // scale of settlement field for villages/cities
  STRUCTURE_CHANCE: 0.06, // base chance a cell has a structure (further culled by context)
} as const;

// Phase 2: Inventory parameters ---------------------------------------------
export const INVENTORY = {
  HOTBAR_SIZE: 10, // number of hotbar slots
  MAIN_INVENTORY_SIZE: 30, // number of main inventory slots
  MAX_STACK_SIZE: 99, // maximum items per stack
  DEFAULT_STACK_SIZE: 10, // default stack size for hotbar items
} as const;

// Phase 2: Game mode -------------------------------------------------------
export const DEFAULT_CREATIVE = false; // default game mode (false = survival)

// Phase A: Rendering / visual overhaul -------------------------------------
export const SPRITE_PX = 16; // native pixel resolution a tile sprite is drawn at
export const SPRITE_VARIANTS = 4; // procedural texture variants per material
export const WALL_DARKEN = 0.5; // background walls rendered this fraction of full brightness
export const BEVEL_LIGHT = 0.28; // top/left edge highlight strength
export const BEVEL_DARK = 0.34; // bottom/right edge shadow strength
export const OVERHANG_PX = 5; // how far grass/snow fringe hangs over the tile top

// Ambient particles
export const PARTICLE_MAX = 220; // max live ambient particles
export const PARTICLE_DENSITY = 0.00006; // particles spawned per visible px² per second

// Parallax backdrop scroll factors (0 = fixed to camera, 1 = moves with world)
export const PARALLAX_FAR = 0.12;
export const PARALLAX_MID = 0.28;
