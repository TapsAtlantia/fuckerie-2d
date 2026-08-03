# fuckerie 2d

A browser-based 2D sandbox game engine — **Terraria-style core** (90%) with hybrid elements
(10%) from Mindustry (automation), Minecraft (infinite chunks / depth) and Stardew Valley
(farming & day/night cycles). Pure client-side, runs on GitHub Pages, no backend.

This repo is currently at **Phase 1: the engine prototype**.

## Run it

```bash
npm install
npm run dev        # local dev server with hot reload → open the printed URL
```

Build the static site for GitHub Pages:

```bash
npm run build      # type-checks, then bundles to dist/
npm run preview    # serve the production build locally to sanity-check
```

Deploying: publish the `dist/` folder to GitHub Pages. `vite.config.ts` uses `base: "./"` so it
works from any project subpath, and `public/.nojekyll` stops Pages mangling the bundle. If you push
this to GitHub, name the **repo** without spaces (e.g. `fuckerie-2d`).

## Controls

| Input | Action |
|---|---|
| `WASD` / arrows | move |
| `Space` / `W` / `Up` | jump (coyote-time + buffered) |
| Left click | mine the highlighted tile (harder tiles take longer) |
| Right click | place the selected block (only on empty tiles with support) |
| `1`–`4` / mouse wheel | select block (dirt / stone / grass / torch) |
| `F` | toggle noclip fly (debug) |
| `T` / `Y` | warp 2000 tiles down / up (debug deep-descent) |
| `G` | regenerate the world with a new random seed |

## Phase 1 architecture

### World scale & coordinates
The world is **unbounded on both axes**. Chunk coordinates are signed integers with no clamp;
**+Y is down**. There is no floor or ceiling — streaming logic is identical everywhere and only
`WorldGen` varies its output by *absolute* world-Y, so tens of thousands of tiles down (or up) is
a real, reachable place. JS float64 represents these tile/pixel coordinates exactly well past the
target depth, and memory stays flat because only chunks near the camera are resident.

### Modules (`src/`)
- `config.ts` — all tunables (tile/chunk size, physics, depth bands, lighting).
- `world/Noise.ts` — self-contained seedable simplex noise + fBm (no CDN).
- `world/Tile.ts` — tile catalogue (id → solidity, hardness, colour, light emission).
- `world/Chunk.ts` — one chunk's foreground + background tile arrays.
- `world/WorldGen.ts` — deterministic per-chunk terrain: surface height, dirt/stone bands,
  threshold caves, depth-tinted stone. Pure function of `(seed, x, y)`.
- `world/ChunkManager.ts` — streams chunks around the camera, reads/writes tiles by world
  coordinate, stores player edits as per-chunk deltas that survive unload/reload.
- `engine/Camera.ts` — smooth follow + world↔screen transforms + viewport scaling.
- `engine/Input.ts` — keyboard/mouse state (held + edge-triggered).
- `engine/Renderer.ts` — layered draw passes (sky → walls → tiles → player → lightmap → cursor),
  DPR-aware, composites the lightmap with `multiply`.
- `systems/Lighting.ts` — RGB flood-fill light propagation: sky ambient + player torch +
  emitter tiles, attenuating more through solids than air.
- `entities/Player.ts` — AABB physics with momentum and swept, sub-stepped tile collision.
- `engine/Game.ts` — fixed-timestep loop, chunk streaming, and the mine/place interaction.

### Chunk loading data flow
1. Each frame the camera's visible tile rectangle is computed.
2. `ChunkManager.update` generates any chunk inside that rectangle (+ margin) and unloads chunks
   that drift outside it; edit deltas are retained.
3. Generation is deterministic from `seed + (cx, cy)`, then stored deltas are re-applied on top.
4. Mining/placing writes the tile and records a delta.
5. The renderer draws only the visible tiles, per layer, then multiplies the lightmap over them.

### Multiplayer (designed, implemented later)
Serverless WebRTC via PeerJS, host-authoritative: host runs chunk generation + physics; clients
send input packets and receive entity/tile snapshots. Message types: `join`, `input`, `chunk`,
`entitySync`, `tileEdit`. Not implemented in Phase 1.

## Roadmap
**Phase 2 — World Generation deep-dive** (the priority): layered depth generation across the full
vertical range, worm/warped caves, temperature-humidity biomes, deterministic cross-chunk
structures, sky islands, plus a visual seed/threshold debug panel.
**Phase 3+**: inventory & IndexedDB persistence, Mindustry automation, WebRTC multiplayer, combat &
enemies, Stardew farming tied to the day/night + season/weather cycle.
