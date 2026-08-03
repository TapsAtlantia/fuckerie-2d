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
  SKY: -400, // y < SKY  -> space / floating islands (Phase 2 content)
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
