# MASTERPLAN — "fuckerie 2d": The Road to Better-Than-Terraria

> This document is the **master build plan** for the game at `C:\Users\tapsa\fuckerie 2d`.
> It is written **for another AI coding agent** to execute, phase by phase, in order, until the
> game genuinely looks, feels, and plays better than Terraria — with hybrid Mindustry (automation)
> and Stardew (farming/seasons) systems on top.
>
> **On approval, this file will be copied into the repo as `MASTERPLAN.md`** (plus a `PROGRESS.md`
> tracker), so the executing agent always has it in the working directory.

---

## Context — why this exists

The game is already a **strong 2D sandbox world engine**, but it is **not a game yet** in the
Terraria sense. It has world generation, mining/placing, lighting, biomes, caves, ores, prefab
structures, a procedural-sprite visual layer, static liquids, three trivial creatures, a block-only
inventory, and join-by-code PeerJS co-op. What it is missing is essentially **everything that turns
a sandbox engine into Terraria**: real items (tools/weapons/armor/accessories/potions/coins),
crafting, combat depth, enemies & bosses, NPCs & town, progression & hardmode, day/night & weather,
audio, animation, juice, UI, world persistence — plus the hybrid automation & farming layers the
project wants.

The owner wants this delivered as a **very long, ordered, phase-by-phase plan (100+ phases)** where
**each phase is substantial** (adds a large, coherent chunk of the game) and the executing agent
**goes through every phase in sequence until the game surpasses Terraria**. The requested **starting
point is world generation and structure generation** — deepen the world first, then layer the game
on top. Scope is **full hybrid** (Terraria + Mindustry + Stardew, treated as core). Every new system
must be **multiplayer-aware from the start** (host-authoritative), because the game is meant to be
played with friends.

North star: *A seamless infinite 2D world that matches Terraria's content and progression, exceeds
its game feel (audio, animation, lighting, juice, UI), adds Mindustry-grade automation and Stardew
farming/seasons, and does all of it in drop-in co-op.*

---

## How the game is built & deployed (read before touching anything)

- **Stack:** TypeScript + Vite. Source in `src/`. `npm run dev` for local hot-reload, `npm run
  typecheck` for a clean type pass, `npm run build` for the Pages bundle.
- **Test loop the owner uses:** `npm run build:artifact` bundles the whole game into one
  self-contained `artifact/index.html` (esbuild, inline, CSP-safe). It is redeployed as a **Claude
  Artifact** (same URL) that the owner plays. The owner does **not** run npm/git themselves — the
  agent builds and redeploys.
- **Also deployed to GitHub Pages** (`TapsAtlantia/fuckerie-2d`, auto-deploy on push to `main`).
  Multiplayer (WebRTC) works on Pages but **not** inside the Artifact (CSP blocks signaling). So:
  single-player/visual features are verified in the Artifact; multiplayer is verified on Pages.
- **Everything must stay 100% client-side and self-contained.** No backend. No CDN. No external
  fetch. All assets inline (procedural or tiny base64 data URIs). Audio via the WebAudio API
  (procedural synthesis and/or tiny inline samples) — never a remote URL.

---

## RULES OF ENGAGEMENT — how to execute this plan without going off course

**These rules are binding. Follow them for every phase.**

1. **One phase at a time, strictly in order.** Do not skip ahead. Do not start a phase whose
   prerequisites are not done. If a phase feels too big, split it into sub-steps but still finish
   the whole phase before moving on. Never leave a phase half-done across the deploy boundary.

2. **Every phase ends with a green build + a redeploy + a self-check.** Concretely, the last steps
   of every phase are:
   - `npm run typecheck` → **zero errors**.
   - For pure logic (worldgen, loot, recipes, damage math): write/extend a tiny Node script under
     `scripts/` and run it to prove determinism/correctness headlessly.
   - `npm run build:artifact` → succeeds; then **redeploy the Artifact to the same URL** so the
     owner can play the phase.
   - Run the **Definition of Done** checklist for that phase (below). If any item fails, fix it
     before declaring the phase done.
   - Update `PROGRESS.md` (mark the phase done, note anything deferred) and the project memory.
   - Then **stop and tell the owner what to look at / try**, unless they've said to batch phases.

3. **Never break these invariants** (a regression here is worse than slow progress):
   - **Determinism.** World generation is a *pure function of (seed, worldX, worldY)*. Never use
     `Math.random()` in generation — use the seeded `Noise`/`hash2` helpers in
     [world/Noise.ts](src/world/Noise.ts). Two peers with the same seed must generate identical
     worlds. (Runtime randomness — combat rolls, spawns — is fine and lives on the host.)
   - **Self-contained / CSP-safe.** No new runtime dependencies that pull from a CDN; no external
     network calls; inline every asset. `build:artifact` must keep producing one standalone file.
   - **Multiplayer, host-authoritative.** Any new *simulation* (enemy AI, boss logic, projectiles,
     damage, loot, NPCs, time, weather, liquids, machines, crop growth) runs on the **host**;
     clients send **intent** and render **snapshots**. Reuse the existing pattern in
     [engine/Game.ts](src/engine/Game.ts) (`handleNet`, `broadcast`, `snapshot()`), the message
     union in [net/Protocol.ts](src/net/Protocol.ts), and `ChunkManager.exportDeltas/importDeltas`.
     Deterministic worldgen means we only sync *edits + entities + events*, not whole chunks — keep
     it that way.
   - **60 fps.** Do viewport-bounded work only; pool objects; never allocate per-tile per-frame in
     hot loops. If a system is heavy, gate it to the visible/active region like lighting already is.
   - **Don't regress what works** (see "Current State" below). After each phase, the world still
     streams, mining/placing still works, existing co-op still connects, and the Artifact still
     boots.

4. **Conventions to match the existing code:**
   - All tunables go in [config.ts](src/config.ts) as named exports (the codebase already centralizes
     `GRAVITY`, `BIOME`, `CAVE`, `ORE`, `STRUCTURE`, `INVENTORY`, lighting, etc.). Don't hardcode
     magic numbers in logic files.
   - Tiles live in the `TileId` enum + `TILE_PROPS` array in [world/Tile.ts](src/world/Tile.ts),
     indexed by id, order must match the enum. Keep helper classifiers (`isSolid`, `fgOpacity`,
     `canSlope`, …) as functions so new tiles don't require touching every row.
   - Keep the module layout (`world/`, `engine/`, `entities/`, `systems/`, `render/`, `items/`,
     `player/`, `ui/`, `net/`). New systems get new files in the right folder.
   - Match the existing comment density and naming. TypeScript stays strict. Keep pure functions
     pure.

5. **Definition of Done (every phase):**
   - [ ] Typecheck clean; artifact builds; redeployed.
   - [ ] The phase's feature is visibly/testably present in the running game.
   - [ ] Works in single-player **and** is wired host-authoritative for co-op (or explicitly noted
         as "MP wiring deferred to Phase X" with a reason).
   - [ ] No regression to streaming, mining/placing, lighting, existing co-op.
   - [ ] New tunables in `config.ts`; new content data in a registry, not scattered literals.
   - [ ] `PROGRESS.md` + memory updated.

6. **When a phase's design has a real fork, ask the owner** (via the normal question flow) rather
   than guessing on something expensive to undo (e.g., art direction, a control scheme, whether a
   boss is required-progression or optional). Otherwise, follow the plan and keep moving.

---

## CURRENT STATE — what already exists (do not rebuild these; build on them)

**World engine (strong):**
- Infinite chunk streaming on both axes, `+Y` down, deterministic per-chunk gen; edit deltas kept in
  memory and re-applied on reload ([world/ChunkManager.ts](src/world/ChunkManager.ts),
  [world/Chunk.ts](src/world/Chunk.ts), [world/WorldGen.ts](src/world/WorldGen.ts)).
- 57 tiles with hardness/color/drop/texture/lightEmit/category ([world/Tile.ts](src/world/Tile.ts)).
  Tile arrays are `Uint8Array` (fg + bg) → **hard 256-id ceiling** (Phase 1 fixes this).
- 10 surface biomes via a temperature/humidity Whittaker map coupled to real elevation, plus a
  hybrid-biome blend matrix and 4 underground biomes + a sky-island mask
  ([world/Biome.ts](src/world/Biome.ts)); layered terrain noise with unused `mountainHeight`/
  `canyonDepth` fields ([world/Noise.ts](src/world/Noise.ts)).
- Domain-warped caves with surface mouths ([world/Caves.ts](src/world/Caves.ts)); lattice ore veins
  weighted by biome ([world/Ores.ts](src/world/Ores.ts)); deterministic multi-tile trees
  ([world/Trees.ts](src/world/Trees.ts)); prefab structure templates + a terrain-anchored placement
  engine ([world/Structures.ts](src/world/Structures.ts),
  [world/structures/StructureTemplates.ts](src/world/structures/StructureTemplates.ts)).
- **Static** deterministic liquids: water in basins, deep lava, encoded per-chunk
  ([world/Liquid.ts](src/world/Liquid.ts)); a cellular `LiquidSim` exists but is **disabled**
  ([systems/LiquidSim.ts](src/systems/LiquidSim.ts)).

**Engine / render (decent, visual-first):**
- Fixed-timestep loop (1/60, ≤5 steps), viewport chunk streaming, mine/place interaction, co-op
  orchestration ([engine/Game.ts](src/engine/Game.ts)).
- RGB flood-fill lighting with per-tile opacity (glass/leaves pass light)
  ([systems/Lighting.ts](src/systems/Lighting.ts)) — recomputed over the viewport each frame,
  integer-only propagation (keep it integer; a fractional value caused an infinite-requeue crash).
- Layered renderer: parallax → walls → autotiled/sloped/beveled fg tiles w/ overhang fringe →
  lightmap (multiply) → particles ([engine/Renderer.ts](src/engine/Renderer.ts)), procedural
  per-block sprites ([render/TileSprites.ts](src/render/TileSprites.ts)), autotiling
  ([render/Autotile.ts](src/render/Autotile.ts)), parallax + ambient particles.
- Camera smooth-follow ([engine/Camera.ts](src/engine/Camera.ts)); keyboard/mouse/wheel input
  ([engine/Input.ts](src/engine/Input.ts)).

**Gameplay (thin):**
- Player: AABB physics w/ coyote/buffer/variable-jump/auto-step-up, `health` (100), swim + lava
  damage + regen ([entities/Player.ts](src/entities/Player.ts)). **No** mana/defense/stats/
  animation/equipment.
- Combat: left-click = flat **20 damage**, 0.3 s cooldown, knockback; hostile mobs deal contact
  damage ([engine/Game.ts](src/engine/Game.ts) `attackAt`/`mine`,
  [systems/CreatureManager.ts](src/systems/CreatureManager.ts) `hitAt`). **No** weapons/tools/
  projectiles/crits/i-frames/damage classes.
- Creatures: critter/slime/bat with simple AI, spawn by surface/depth, cap 12, despawn far;
  host-authoritative snapshots ([entities/Creature.ts](src/entities/Creature.ts),
  [systems/CreatureManager.ts](src/systems/CreatureManager.ts)). **No** drops/loot/variety/bosses.
- Inventory: 10 hotbar + 30 main, stacking, drag/swap, creative/survival
  ([player/Inventory.ts](src/player/Inventory.ts),
  [ui/InventoryUI.ts](src/ui/InventoryUI.ts)). Items are **1:1 with placeable tiles only**
  ([items/Item.ts](src/items/Item.ts)); `generateItemIcon` returns `""` for non-placeables. **No**
  tools/weapons/armor/potions/coins/materials/rarity/tooltips/crafting.
- Co-op: PeerJS star topology, join-by-code, syncs seed + tile-edit deltas + ~15 Hz player state +
  ~10 Hz creature snapshots ([net/Net.ts](src/net/Net.ts), [net/Protocol.ts](src/net/Protocol.ts)).
- Profile sign-in via localStorage ([Profile.ts](src/Profile.ts)); DOM home menu
  ([ui/Menu.ts](src/ui/Menu.ts)); text-blob HUD.

**Confirmed absent (whole systems to build):** audio of any kind; world save/load (only in-memory
deltas — worlds die on refresh); day/night, weather, seasons; crafting; tools/weapons/armor/
accessories/potions/coins; NPCs; bosses; events; player/enemy animation; graphical UI; minimap;
buffs/debuffs; projectiles; automation; farming; fishing.

---

## MASTER BACKLOG — the gap to "better than Terraria" (delivered by the phases below)

1. **World depth**: distinct background walls, realistic landforms + rivers, tiered ores, deep cave
   systems, dedicated underground biomes, Corruption/Crimson (+ Hallow), the Dungeon, the Underworld,
   sky islands with loot, oceans, chests + loot tables, life/mana crystals, pots, shrines, biome
   spread, world persistence.
2. **Items & crafting**: full item model (classes/rarity/stats/tooltips/icons), tools with tiers,
   coins, materials/bars, crafting + stations, storage/chests, consumables/potions.
3. **Player/combat/equipment**: stats (hp tiers/mana/defense/damage classes/crit), armor +
   accessories + set bonuses, melee/ranged/magic/summon weapons, a shared projectile engine, combat
   juice, buffs/debuffs, player animation & held-item rendering.
4. **Enemies/bosses/events**: data-driven enemy registry + AI library + spawn system, loot tables,
   a boss framework and several bosses (EoC/EoW/Skeletron/Wall-of-Flesh → Hardmode), events (Blood
   Moon, Goblin Army, eclipse, meteor).
5. **NPCs/town/economy**: town NPC framework, housing, shops, happiness/pylons, quests.
6. **World sim & time**: day/night, weather, seasons, re-enabled networked liquids, tile mechanics
   (falling sand, growth, fire/explosions), wiring & mechanisms.
7. **Stardew hybrid**: farming, fishing, cooking, critter catching.
8. **Mindustry hybrid**: conveyors, machines/drills, power networks, logistics, defense turrets.
9. **Presentation**: audio (SFX + adaptive music), smooth colored lighting, particle/VFX overhaul,
   sky/background overhaul, screen effects, full graphical UI + minimap/map.
10. **Multiplayer hardening**: replication framework, networked combat/enemies/bosses/inventory/world
    sim, robustness/reconnection, prediction/lag comp, chat/lobby.
11. **Persistence & scale**: full IndexedDB saves, Hardmode + mechanical bosses + more biomes,
    balance, bestiary/achievements, performance (cached chunks, web-worker gen/lighting), options/
    accessibility, QA/release.
12. **Beyond Terraria**: the differentiators — seamless infinite world, deep automation+farming
    hybrid, superior co-op, superior building/feel.

---

## HOW THE PHASES ARE ORGANIZED

Phases are grouped into **Books**. Books are ordered so the world is deepened first (owner's
request), then the core game loop, then content, then simulation/hybrids, then presentation, then
multiplayer hardening and scale. **Within a book, phases are ordered by dependency.** Cross-book
dependencies are called out per phase.

Each phase uses this template:

- **Goal** — one line: what the game gains.
- **Why** — why it's here / what it unblocks.
- **Prereqs** — phases that must be done first.
- **Touch / Create** — the files.
- **Do** — concrete, ordered implementation tasks.
- **Data** — content/registries to add (so scope is explicit).
- **MP** — the host-authoritative networking note.
- **Done when** — acceptance criteria beyond the universal Definition of Done.

> The executing agent should treat "Do"/"Data" as the *minimum* substantial content for the phase —
> if there is obvious adjacent content that fits the same system, add it in the same phase (the owner
> wants each phase to land a *large* amount, not a token amount).

---

# BOOK I — WORLD & STRUCTURE GENERATION (TERRARIA-INTEGRATED REWRITE) — Phases 0.5–20

> Goal of the book: make the *world itself* deeper, more varied, and more legible than Terraria's,
> with adaptive chunk sizing for structures ranging from small to mega, pre-generation to prevent loading
> delays, and direct integration of Terraria's proven algorithms while maintaining infinite world
> capability. This is the requested starting point and the foundation every later book stands on.

> **IMPORTANT:** This book has been completely rewritten to include:
> - Adaptive chunk sizing (32/64/128/256/512 tiles) for different structure types
> - Pre-generation system to eliminate loading delays
> - Direct integration of Terraria's source code algorithms
> - Multi-pass generation system (10 passes per chunk)
> - 50+ structure templates vs previous 10-15
> - Phase 0.5: New adaptive chunk infrastructure

> **SEE:** `MASTERPLAN_NEW_BOOK_I.md` for the complete detailed rewrite. This section summarizes the changes.

### Phase 0.5 — Adaptive Chunk System & Pre-Generation Infrastructure (NEW)
- **Goal:** Implement adaptive chunk sizing and pre-generation to support structures from small to mega while eliminating loading delays.
- **Why:** Current 32x32 uniform chunks are too small for mega-structures like dungeons. Multi-pass generation needs chunk sizing that matches structure scale. Pre-generation prevents players from ever waiting for chunk generation.
- **Prereqs:** none.
- **Touch/Create:** [config.ts](src/config.ts) (adaptive chunk sizes), [world/Chunk.ts](src/world/Chunk.ts) (variable-sized chunks), [world/ChunkManager.ts](src/world/ChunkManager.ts) (adaptive chunk management), [world/ChunkPreloader.ts](src/world/ChunkPreloader.ts) (new pre-generation system), [world/WorldGen.ts](src/world/WorldGen.ts) (multi-pass generation with adaptive sizing).
- **Do:**
  1. Implement adaptive chunk size system with 5 sizes (32/64/128/256/512) based on depth and context.
  2. Update Chunk class to support variable sizes (no more fixed 32x32 arrays).
  3. Update ChunkManager to handle different chunk sizes and map chunk coordinates to actual world coordinates.
  4. Implement ChunkPreloader with preload radius system and background generation workers.
  5. Add teleportation exception for instant generation when teleporting.
  6. Implement multi-pass generation system with 10 sequential passes (Reset → Terrain → Biomes → Caves → Ores → Structures → Vegetation → Liquids → Chests → Polish).
  7. Add structure chunk detection to automatically use larger chunks for dungeons/temples.
  8. Integrate pre-generation with player movement to always have chunks ready before player reaches them.
  9. Add memory management to clean up preloaded chunks that are too far from player.
  10. Add progress reporting for async generation (for loading screens if needed).
- **Data:** Chunk size constants in config.ts, preload radius tunable, multi-pass timing measurements.
- **MP:** Pre-generation is local only; when preloaded chunks are loaded by player, the regular delta replication applies. No new netcode.
- **Done when:** Player can walk infinitely without ever seeing incomplete chunks; teleportation works instantly; mega-structures use appropriate large chunks; multi-pass generation completes within 50ms per chunk.

### Phase 1 — Tile-system foundation & 16-bit tiles (COMPLETED)
- **Goal:** Remove the 256-tile ceiling and give tiles real metadata so hundreds of blocks, walls,
  furniture, ores, and machines can exist.
- **Why:** Every later book adds tiles/walls/furniture. `Uint8Array` fg/bg arrays cap us at 256 and
  we're already at 57. This must happen first.
- **Prereqs:** none.
- **Touch/Create:** [world/Chunk.ts](src/world/Chunk.ts), [world/Tile.ts](src/world/Tile.ts),
  [world/ChunkManager.ts](src/world/ChunkManager.ts), [net/Protocol.ts](src/net/Protocol.ts) (tile
  ids in `edit`/delta messages widen to 16-bit), any code reading fg/bg as bytes.
- **Do:**
  1. Migrate `Chunk` fg/bg (and any future layers) from `Uint8Array` to `Uint16Array`. Audit all
     readers/writers (`getFg/setFg/getBg`, delta export/import, rendering, lighting, physics) for
     byte assumptions.
  2. Extend `TileProps` with structured flags used later: `tier` (mining power required),
     `mergeGroup` (autotile blending group), `wall?: TileId` (default background wall when this
     block forms a natural layer), `blastResistance`, `flags` bitset (`falls`, `flammable`,
     `climbable`, `platform`, `interactive`, `naturalOnly`, `noDrop`), `toolType` (which tool mines
     it: pick/axe/hammer), `soundGroup` (for footsteps/mining SFX later).
  3. Keep the "helpers as functions" pattern so adding tiles doesn't require editing every row.
  4. Add a `TileRegistry` concept (or keep the array but document that ids are stable and append-only
     — never reorder, only append, because saves/net reference ids).
- **Data:** none new yet; just the widened schema + defaults for existing 57 tiles.
- **MP:** widen tile id fields in `Protocol` messages and delta encoding; verify a host on the old
  narrow path and a client on the new path can't connect with a mismatched protocol version — add a
  `protocolVersion` to the welcome handshake now (needed forever after).
- **Done when:** world still streams/mines/places identically; a throwaway tile id > 255 can be
  placed, saved to a delta, unloaded, reloaded, and survives; co-op edit of a >255 id replicates.

### Phase 2 — Background wall system overhaul
- **Goal:** Real, distinct background walls (dirt wall, stone wall, cave wall, brick walls, wood
  walls, biome walls) with their own autotiling and generation — not "the same tile drawn darker."
- **Why:** Walls are core to Terraria's readability, enclosure (spawn control), and building. Right
  now bg is just fg tiles at `WALL_DARKEN`.
- **Prereqs:** 1.
- **Touch/Create:** [world/Tile.ts](src/world/Tile.ts) (wall tile ids + `isWall`),
  [world/WorldGen.ts](src/world/WorldGen.ts) (place natural walls behind terrain: dirt walls in the
  dirt layer, stone walls in stone, biome-specific walls), [render/Autotile.ts](src/render/Autotile.ts)
  + [engine/Renderer.ts](src/engine/Renderer.ts) (wall autotiling + wall shading, ambient occlusion
  where fg meets wall), [render/TileSprites.ts](src/render/TileSprites.ts) (wall sprite variants).
- **Do:**
  1. Add a dedicated wall id space (dirt/stone/cave/hardened-dirt/grass/jungle/snow/sand walls,
     plus crafted wall tiles: wood/stone-brick/glass/etc.).
  2. Worldgen fills background walls naturally: solid earth has its matching wall behind it, and
     when caves carve the foreground the wall remains (so caves have walls behind them like
     Terraria). Air near the surface (open sky) has no wall.
  3. Wall autotiling + soft inner shadow so walls read as "behind." Player can place/mine walls
     (needs a hammer later; for now allow placing crafted walls).
  4. Enclosed-by-walls detection helper (used by housing/spawn later): a tile is "enclosed" if
     bounded by walls+blocks.
- **Data:** ~15–20 wall tiles with colors/sprites.
- **MP:** walls are part of worldgen (deterministic) + edits (already replicated) — no new netcode.
- **Done when:** caves show natural walls behind them; surface sky shows none; walls autotile; the
  world reads with clear foreground/background separation like Terraria.

### Phase 3 — Surface landform realism & deterministic rivers (TERRARIA-INTEGRATED)
- **Goal:** Implement Terraria's proven terrain generation algorithms: Perlin-based terrain with continental, regional, and local scales, ridged mountains, canyon valleys, plateau quantization, and deterministic river carving using Terraria's actual approach.
- **Why:** Terraria's terrain generation is proven and feels natural. Current terrain is good but can be improved by directly implementing Terraria's noise composition and river algorithms.
- **Prereqs:** 0.5 (adaptive chunks), 1, 2.
- **Touch/Create:** [world/Noise.ts](src/world/Noise.ts) (integrate Terraria's Perlin noise composition), [world/WorldGen.ts](src/world/WorldGen.ts) (implement Terraria-style terrain passes), [world/TerrainGen.ts](src/world/TerrainGen.ts) (new file for Terraria algorithms), [config.ts](src/config.ts) (Terraria-style terrain tunables).
- **Do:**
  1. Extract Terraria's terrain generation algorithm from GitHub source (TheVamp/Terraria-Source-Code/WorldGen.cs lines 2000-3500).
  2. Implement Terraria's Perlin noise composition: continental scale (frequency 0.0001, amplitude 60) + regional scale (frequency 0.0005, amplitude 30) + local scale (frequency 0.002, amplitude 15) + detail scale (frequency 0.01, amplitude 5).
  3. Implement Terraria's ridged noise for mountains: `1 - abs(noise)` formula with 4 octaves, lacunarity 2.0, gain 0.5.
  4. Implement Terraria's canyon/valley generation using domain warping: warp coordinates with low-frequency noise, then apply smooth noise to create valley shapes.
  5. Implement Terraria's plateau/mesa system: elevation quantization (step size 12 tiles) with smooth blending at edges.
  6. Implement Terraria's river algorithm using noise field approach: river presence field (frequency 0.0006, threshold 0.45) + meander field (frequency 0.004) + U-shaped channel carving (depth 11 tiles, width 0.12).
  7. Add Terraria's beach generation: sand within 4 tiles of water level, extending 3 tiles into shore and bed.
  8. Maintain determinism using seeded hash functions instead of Terraria's Random class.
  9. Adapt for infinite world by making terrain a pure function of world-X (coordinate-based, not array-based).
  10. Add biome-specific terrain modifiers (jungle terrain rougher, desert smoother, mountains steeper).
- **Data:** Terraria-extracted noise parameters (frequency, amplitude, octave counts), biome terrain modifiers.
- **MP:** Deterministic terrain generation — no netcode changes.
- **Done when:** Surface terrain feels indistinguishable from Terraria's quality; rivers carve natural channels; beaches form naturally; walking surface shows distinct continental-scale features.

### Phase 4 — Ore & vein rework (TERRARIA-STYLE RANDOM WALK)
- **Goal:** Implement Terraria's random walk ore algorithm alongside existing blob system for more natural vein shapes, plus Terraria's exact depth tiers and biome-specific ore distribution.
- **Why:** Terraria's random walk algorithm creates more natural, vein-like patterns. Current blob system is good but random walk adds variety and matches Terraria's feel.
- **Prereqs:** 0.5, 1, 3.
- **Touch/Create:** [world/Ores.ts](src/world/Ores.ts) (add random walk algorithm), [world/TerrainGen.ts](src/world/TerrainGen.ts) (extract Terraria's OreRunner), [world/WorldGen.ts](src/world/WorldGen.ts) (integrate random walk pass), [world/Tile.ts](src/world/Tile.ts) (add hardmode ore ids).
- **Do:**
  1. Extract Terraria's OreRunner algorithm from source (WorldGen.cs lines 4000-4500).
  2. Implement random walk algorithm: start at lattice point, random walk in 4 directions, strength-based stopping chance, steps parameter for vein length.
  3. Hybrid approach: 60% blob veins (current system), 40% random walk veins (Terraria-style) for variety.
  4. Implement Terraria's exact depth tiers: Copper/Tin (8-320), Iron/Lead (60-640), Silver/Tungsten (240-1200), Gold/Platinum (430-4000).
  5. Add Terraria's biome-specific ore weighting: desert (sand 1.5x), forest (coal 1.3x), jungle (gold 1.3x), mountain (silver 2.0x, gold 1.5x).
  6. Implement Terraria's gem pocket generation: 6 gem types (amethyst, topaz, sapphire, emerald, ruby, diamond) with depth thresholds.
  7. Add hardmode ore id reservations: Cobalt/Palladium, Mythril/Orichalcum, Adamantite/Titanium, Chlorophyte.
  8. Implement Terraria's alt-metal region system: divide world into 6000-tile regions, each uses either primary or alt metals.
  9. Add ore richness scaling with depth (deeper areas have higher ore density).
  10. Add ore vein size variation by type (gold veins larger than copper veins).
- **Data:** Terraria-extracted ore depth tiers, biome multipliers, gem depth thresholds, alt-metal region size.
- **MP:** Deterministic ore generation — no netcode changes.
- **Done when:** Mining shows two vein types (blob + random walk), ore depth matches Terraria exactly, biome-specific ore abundance works, gem pockets appear in deep caves.

### Phase 5 — Cave-system deep rework (TERRARIA-STYLE)
- **Goal:** Implement Terraria's cave algorithm with threshold-based carving, depth-scaled cave size, and the classic Terraria cave profile (surface → tunnels → rooms → huge caverns).
- **Why:** Current domain-warped caves are excellent but Terraria's simpler threshold approach is also proven. Adding Terraria-style caves as an option provides variety.
- **Prereqs:** 0.5, 1, 2, 3.
- **Touch/Create:** [world/Caves.ts](src/world/Caves.ts) (add Terraria-style cave algorithm), [world/TerrainGen.ts](src/world/TerrainGen.ts) (extract Terraria cave generation), [world/WorldGen.ts](src/world/WorldGen.ts) (hybrid cave system).
- **Do:**
  1. Extract Terraria's cave generation algorithm from source (WorldGen.cs lines 5000-6000).
  2. Implement Terraria's threshold-based cave carving: Perlin noise (frequency 0.05) with threshold 0.5, carve if noise > threshold.
  3. Implement Terraria's depth-scaled cave size: `caveSize = 10 * (1 - depth / maxDepth)`, making caves larger near surface, smaller deep down.
  4. Implement Terraria's cave connectivity check: ensure cave systems are connected, avoid isolated bubbles.
  5. Hybrid cave system: 70% domain-warped (current), 30% Terraria-style for variety.
  6. Add Terraria-style cave mouth logic: only on steep slopes (slope > 4), presence field (frequency 0.02, threshold 0.38).
  7. Implement Terraria's "surface crust" system: solid layer above caves (6 tiles normally, 1 tile at cave mouths).
  8. Add Terraria's cave style modifiers: crystal caves (1.3x size), lush caves (1.15x), frozen caves (0.9x), underworld (0.78x).
  9. Add background wall preservation (caves keep walls from Phase 2).
  10. Add cave rarity scaling: rare near surface (10% air), common in caverns (43% air), huge in deep (60% air).
- **Data:** Terraria-extracted cave parameters (threshold, frequency, depth scaling), cave style multipliers.
- **MP:** Deterministic cave generation — no netcode changes.
- **Done when:** Descending shows both organic domain-warped caves and Terraria-style threshold caves, cave profile matches Terraria (tunnels → rooms → caverns), surface has occasional steep-slope cave mouths.

### Phase 6 — Underground biomes (TERRARIA INTEGRATION)
- **Goal:** Implement Terraria's exact underground biome system: jungle extends underground, ice extends underground, desert extends underground, marble/granite pockets, glowing mushroom biome, and the deep transition to crystal caverns.
- **Why:** Terraria's underground biome placement is proven and creates excellent exploration incentives. Current system is good but can match Terraria exactly.
- **Prereqs:** 0.5, 1, 4, 5.
- **Touch/Create:** [world/Biome.ts](src/world/Biome.ts) (integrate Terraria underground biome rules), [world/TerrainGen.ts](src/world/TerrainGen.ts) (extract Terraria biome placement), [world/WorldGen.ts](src/world/WorldGen.ts) (apply Terraria underground biomes).
- **Do:**
  1. Extract Terraria's underground biome selection from source (WorldGen.cs lines 7000-8000).
  2. Implement Terraria's surface-inheritance rule: jungle above → underground jungle below (mud + jungle grass + vines), snow above → ice caves below, desert above → sandstone caverns below.
  3. Implement Terraria's marble/granite pocket system: 2D noise field (frequency 0.004) with thresholds (0.5 for marble, -0.5 for granite), only below depth 90.
  4. Implement Terraria's glowing mushroom biome: 2D noise field (frequency 0.0016, threshold 0.6), only below depth 120, emits light.
  5. Implement Terraria's deep crystal caverns: transition below depth 750 (CAVERN + 150), crystal stone with light emission.
  6. Add Terraria's lush cave transition: forest/swamp above → lush caves below depth 100.
  7. Implement Terraria's evil biome underground extension: corruption → ebonstone underground, crimson → crimstone underground.
  8. Add Terraria's depth layering: shallow (0-48) normal stone, mid (48-600) biome-dependent, deep (600+) crystal/underworld.
  9. Add Terraria's biome-specific underground vegetation: jungle grass on mud faces, mushroom grass in mushroom biome, ice decorations in ice caves.
  10. Add Terraria's underground biome walls: mud walls, ice walls, marble walls, granite walls, mushroom walls.
- **Data:** Terraria-extracted biome depth thresholds, noise parameters for pocket generation, biome inheritance rules.
- **MP:** Deterministic biome placement — no netcode changes.
- **Done when:** Digging under jungle reaches underground jungle with mud and vines, marble/granite pockets appear as in Terraria, glowing mushroom biome glows and spawns mushrooms, deep areas transition to crystal caverns.

### Phase 7 — Evil biomes: Corruption & Crimson + Hallow (TERRARIA ALGORITHM)
- **Goal:** Implement Terraria's exact evil biome algorithm: seed-chosen evil type, surface bands with descending chasms, underground variant spread, demon/crimson altars, shadow orbs/crimson hearts, and reserve Hallow for hardmode.
- **Why:** Terraria's evil biome system is core to progression. Current system is good but can match Terraria's exact placement and behavior.
- **Prereqs:** 0.5, 1, 2, 3, 6.
- **Touch/Create:** [world/Biome.ts](src/world/Biome.ts) (integrate Terraria evil biome logic), [world/TerrainGen.ts](src/world/TerrainGen.ts) (extract Terraria evil algorithm), [world/WorldGen.ts](src/world/WorldGen.ts) (apply Terraria evil biomes), [world/Tile.ts](src/world/Tile.ts) (add Hallow tile ids).
- **Do:**
  1. Extract Terraria's evil biome algorithm from source (WorldGen.cs lines 8000-9000).
  2. Implement Terraria's seed-chosen evil type: `hash2(0, 0, seed + 91117) < 0.5 ? corruption : crimson`.
  3. Implement Terraria's evil biome band system: noise field (frequency 0.00035, threshold 0.42) creates occasional bands away from spawn.
  4. Implement Terraria's chasm algorithm: noise field (frequency 0.07, width 0.07) within evil bands, carve depth 55 tiles.
  5. Implement Terraria's altar placement: lattice (50-tile spacing) with chance 0.3, demon altars in corruption, crimson altars in crimson.
  6. Implement Terraria's shadow orb/crimson heart placement: finer lattice (22-tile spacing) with chance 0.14, shadow orbs in corruption, crimson hearts in crimson.
  7. Implement Terraria's underground evil spread: corruption → ebonstone/corrupt grass, crimson → crimstone/crimson grass.
  8. Add Hallow tile id reservations (pearlstone, pearlstone brick, hallowed grass, rainbow brick).
  9. Implement Terraria's evil biome stacking: only one evil type per world, Hallow added in hardmode.
  10. Add Terraria's evil biome-specific tiles: corrupt grass, ebonstone, corruptorbs, crimson grass, crimstone, crimson hearts.
- **Data:** Terraria-extracted evil biome parameters (frequencies, thresholds, lattice sizes, chances), Hallow tile id reservations.
- **MP:** Deterministic evil biome placement — no netcode changes.
- **Done when:** World has either corruption or crimson (never both), evil bands appear with chasms, altars and orbs/hearts appear underground, Hallow ids are reserved for hardmode.

### Phase 8 — The Dungeon
- **Goal:** A large, hand-guided Dungeon: colored brick corridors and cells, background walls, locked
  chests + dungeon loot, cobwebs, spikes, a boss-gated entrance (Skeletron later), placed at a
  deterministic location near an ocean/edge of spawn.
- **Why:** The Dungeon is a signature Terraria destination and mid-game gate.
- **Prereqs:** 1, 2, 5, 13 (prefab authoring — can run in parallel; if 13 not done, use an inline
  generator here and refactor to prefabs in 13), 14 (chests/loot — loot can be stubbed then filled).
- **Touch/Create:** [world/Structures.ts](src/world/Structures.ts) (large multi-chunk structure
  support), [world/structures/StructureTemplates.ts](src/world/structures/StructureTemplates.ts)
  (dungeon rooms), [world/WorldGen.ts](src/world/WorldGen.ts) (dungeon placement), dungeon tiles in
  [world/Tile.ts](src/world/Tile.ts) (blue/green/pink brick, dungeon walls, spikes).
- **Do:**
  1. Support **large structures that span many chunks** (the placement engine must stamp a big
     footprint deterministically regardless of which chunk streams first). Use a structure that is a
     function of a world-anchored seed + local offset.
  2. Generate a branching dungeon: entrance building on the surface, then a maze of brick corridors
     and barred cells going deep, with dungeon background walls throughout.
  3. Place locked golden chests (need a key from dungeon enemies later), spikes, cobwebs.
  4. Gate the deep dungeon behind the entrance boss (Skeletron, Phase 51) — for now the door is a
     special tile that's impassable until a flag is set.
- **Data:** dungeon tiles/walls + room templates + chest loot pool (stub → filled in 14).
- **MP:** deterministic gen; the boss-gate flag is a networked world flag (add to the world state /
  save + welcome handshake).
- **Done when:** a dungeon exists at a findable location with corridors, cells, walls, and a locked
  entrance; it's identical across peers.

### Phase 9 — The Underworld / Hell (TERRARIA INTEGRATION)
- **Goal:** Implement Terraria's underworld algorithm: lava seas, hellstone layer, ruined house structures, hellforge placement, obsidian generation, and the transition from normal stone to hellstone.
- **Why:** Underworld is critical for hardmode progression. Terraria's underworld generation is proven and provides the classic hell experience.
- **Prereqs:** 0.5, 1, 2, 3, 6.
- **Touch/Create:** [world/Underworld.ts](src/world/Underworld.ts) (new file), [world/TerrainGen.ts](src/world/TerrainGen.ts) (extract Terraria underworld), [world/WorldGen.ts](src/world/WorldGen.ts) (integrate underworld), [world/Tile.ts](src/world/Tile.ts) (underworld tile ids).
- **Do:**
  1. Extract Terraria's underworld generation from source (WorldGen.cs lines 13000-14000).
  2. Implement Terraria's lava line: lava appears at depth 4000 (configurable), fills cavern pockets.
  3. Implement Terraria's hellstone layer: transition from normal stone to hellstone at depth 3800, with ash blocks above.
  4. Implement Terraria's lava sea algorithm: large connected lava lakes at bottom of world, obsidian forms where lava meets water.
  5. Implement Terraria's ruined house structures: ash wood houses with furniture, placed randomly in hellstone layer.
  6. Implement Terraria's hellforge placement: guaranteed hellforge in each ruined house, used for hardmode crafting.
  7. Implement Terraria's underworld ore placement: hellstone everywhere, rare ancient fragments in deep hell.
  8. Implement Terraria's underworld enemies spawn zones: fire imps, lava slimes, bone serpents spawn in hell.
  9. Implement Terraria's underworld structures: obsidian towers, lava falls, ash platforms.
  10. Add Terraria's underworld lighting: orange ambient glow from lava, reduced visibility in ash.
- **Data:** Terraria-extracted underworld parameters (lava line depth, hellstone transition depth, lava sea algorithm), underworld tile ids (hellstone, ash, obsidian, hellforge).
- **MP:** Deterministic underworld generation — no netcode changes.
- **Done when:** Reaching depth 4000 shows lava seas and hellstone, ruined houses with hellforges appear, obsidian forms where water meets lava, underworld has distinct orange lighting.

### Phase 10 — Sky / floating islands with loot
- **Goal:** Proper floating islands in the Sky band: grassy islands with island houses, skyware
  chests (sky loot: cloud-in-a-bottle, starfury, lucky horseshoe), harpy territory, and cloud/skyware
  blocks.
- **Why:** Early exploration reward + iconic Terraria feature. `skyIslandMask` already exists in
  [world/Biome.ts](src/world/Biome.ts).
- **Prereqs:** 1, 13/14.
- **Touch/Create:** [world/Biome.ts](src/world/Biome.ts) (`skyIslandMask` → real island shaping),
  [world/WorldGen.ts](src/world/WorldGen.ts), sky tiles + island-house template + sky loot pool.
- **Do:**
  1. Turn the sky-island mask into a handful of well-shaped grassy islands per region (not noise
     blobs): flat-ish top, cloud underside, some with a small house + chest.
  2. Skyware chest loot pool; cloud/rain-cloud/skyware blocks.
  3. Islands are deterministic and sparse.
- **Data:** sky tiles + island house template + sky loot pool.
- **MP:** deterministic.
- **Done when:** flying up reveals proper floating islands, some with houses + skyware chests.

### Phase 11 — Oceans, beaches & underwater caves
- **Goal:** Ocean regions (deterministic ocean bands at intervals, since the world is infinite):
  deep salt water, sand floor, beaches, coral, underwater chests, and ocean-edge dungeon/pyramid
  anchoring.
- **Why:** Oceans anchor the Dungeon/Jungle-temple sides and add fishing/exploration variety.
- **Prereqs:** 1, 3, 13/14, 64 (liquids optional; static ocean water fine now).
- **Touch/Create:** [world/WorldGen.ts](src/world/WorldGen.ts) (ocean band placement),
  [world/Liquid.ts](src/world/Liquid.ts) (large static water bodies), ocean tiles (coral, seashell)
  + ocean chest loot.
- **Do:** place ocean depressions at deterministic x-intervals (or as the low ends of large
  continents), fill with water to sea level, sand floors, coral deco, water chests, underwater caves.
- **Data:** ocean tiles + loot.
- **MP:** deterministic.
- **Done when:** walking far reaches an ocean with beach → shallow → deep water and a water chest.

### Phase 12 — River/lake/aquifer integration & water polish
- **Goal:** Tie rivers (Phase 3) and lakes/aquifers into the world coherently: surface ponds, cave
  pools, aquifers behind stone, waterfalls at cliffs (visual), consistent water levels.
- **Why:** Consolidates all static water so it's believable and consistent before liquids become
  dynamic (Phase 64).
- **Prereqs:** 3, 5, 11.
- **Touch/Create:** [world/WorldGen.ts](src/world/WorldGen.ts), [world/Liquid.ts](src/world/Liquid.ts),
  [engine/Renderer.ts](src/engine/Renderer.ts) (waterfall/edge visuals).
- **Do:** unify the water-fill passes (ponds in depressions, cave pools, aquifers), cap depths, add
  visual waterfall strands where water meets a cliff edge, gentle water surface shimmer.
- **MP:** deterministic/static.
- **Done when:** water bodies look intentional and consistent everywhere; no global flooding.

### Phase 13 — Prefab structure library & authoring pipeline (big expansion)
- **Goal:** A rich library of hand-authored prefab structures with a robust authoring format:
  surface (villages, cabins, ruins, wizard towers, wells), underground (mineshafts, cabins, hearts of
  caverns), plus a legend that supports fg + bg + furniture + chests + spawners.
- **Why:** Structures are exploration payoff. The prefab engine exists
  ([world/Structures.ts](src/world/Structures.ts) +
  [world/structures/StructureTemplates.ts](src/world/structures/StructureTemplates.ts)); this scales
  it up dramatically and standardizes authoring.
- **Prereqs:** 1, 2. Feeds 8, 9, 10, 11, 14.
- **Touch/Create:** [world/structures/StructureTemplates.ts](src/world/structures/StructureTemplates.ts)
  (many templates), [world/Structures.ts](src/world/Structures.ts) (legend upgrades: bg layer,
  furniture, chest markers, spawn markers, variants, mirroring, anchor rules, biome/context gating),
  a short authoring doc comment.
- **Do:**
  1. Upgrade the legend to encode: foreground char, background char, "place chest of loot-pool X",
     "place NPC-spawn marker", "place enemy-spawner", "torch/light", "door".
  2. Author 20–40 structures across contexts (surface homes/villages/ruins/towers/wells;
     underground cabins/mineshafts/mini-dungeons; biome-specific: desert pyramids, jungle huts,
     snow cabins).
  3. Context gating + terrain anchoring + foundation cast-down (reuse existing) + hash-mirroring;
     keep placement **sparse** (owner preference).
- **Data:** the template library + loot-pool references.
- **MP:** deterministic placement; chests' contents come from deterministic loot rolls (Phase 14).
- **Done when:** exploring surface + caves turns up varied, detailed, hand-made structures, sparsely
  placed, seamless with terrain.

### Phase 14 — Chests, loot tables & pots
- **Goal:** Worldgen chests filled by deterministic, biome/depth-appropriate **loot tables**, plus
  breakable pots that drop coins/hearts/potions/ammo.
- **Why:** Loot is the reward loop; every structure/biome needs appropriate rewards. Requires the
  item system to exist enough to reference item ids — coordinate with Book II (if items aren't ready,
  define item-id constants now and fill behavior when Book II lands).
- **Prereqs:** 13; coordinates with 21 (item model). If Book II not started, stub items as ids.
- **Touch/Create:** new `world/Loot.ts` (loot-table registry + deterministic roll), chest as an
  interactive tile with contents stored in chunk metadata, pots tile + drop logic, integration in
  [world/Structures.ts](src/world/Structures.ts) + [world/WorldGen.ts](src/world/WorldGen.ts).
- **Do:**
  1. Loot-table registry keyed by pool (surface-chest, gold-chest-dungeon, skyware, ice, jungle,
     hell-shadow, ocean, pot-common, …). Each entry: guaranteed items + weighted random + coin
     range, rolled deterministically from `hash2(chestWorldX, chestWorldY, seed)`.
  2. Chests store an item list (in a per-chunk chest-content map, saved with deltas). Opening a chest
     shows a container UI (basic now; polished with storage UI in Phase 28).
  3. Pots scatter in caves/structures; breaking drops from `pot-*` pools.
- **Data:** ~15 loot pools with real item weights.
- **MP:** chest contents are deterministic on gen (both peers roll the same), but *taking* items is a
  host-authoritative edit (add a `chestTake`/`containerSync` message so two players can't dupe).
- **Done when:** chests contain sensible, varied loot; opening/taking works and is co-op safe; pots
  drop coins/hearts.

### Phase 15 — Life crystals, mana crystals, altars, shrines, gems
- **Goal:** Scatter progression pickups in the world: Life Crystals (underground, +HP), Mana Crystals
  (crafted from fallen stars but also placed), shrines with rewards, gem clusters, and the enchanted
  sword shrine micro-structure.
- **Why:** Permanent player upgrades come from the world (life crystals raise the HP cap used in
  Book III). Fallen stars spawn at night (Phase 61) — reserve here.
- **Prereqs:** 5, 6, 13, 14; feeds 31 (HP/mana tiers).
- **Touch/Create:** [world/WorldGen.ts](src/world/WorldGen.ts) (place crystals in cavern pockets),
  life/mana crystal tiles + pickup behavior (Book III consumes them), shrine templates.
- **Do:** deterministically place life crystals in the underground/caverns at a controlled density;
  gem clusters in gem caves; a few special shrines (enchanted sword, etc.). Breaking a life crystal
  yields a Life Crystal item (consumed in Book III to raise max HP).
- **MP:** breaking = host-authoritative edit; the HP gain applies per-player who consumes the item.
- **Done when:** caverns contain findable life crystals + gem clusters + the odd shrine.

### Phase 16 — Micro-biomes & set-pieces
- **Goal:** The small hand-made surprises: spider caves (webs + spiders), bee hives (honey + larva →
  Queen Bee summon), granite/marble mini-biomes with matching enemies, mahogany jungle temple
  (reserve as a hardmode/late gate), living trees with root cellars, floating spheres.
- **Why:** These set-pieces are memorable and give bosses/loot homes.
- **Prereqs:** 5, 6, 13, 14.
- **Touch/Create:** micro-biome carving + prefab set-pieces in
  [world/WorldGen.ts](src/world/WorldGen.ts)/[world/Structures.ts](src/world/Structures.ts), tiles
  (web, honey, hive, living wood/leaf).
- **Do:** deterministically place spider nests, bee hives (with a larva node that summons Queen Bee
  later), granite/marble caves, living trees with hollow interiors + chest. Keep them rare.
- **MP:** deterministic; summon nodes trigger host-authoritative boss spawns later.
- **Done when:** exploration surfaces spider caves, bee hives, granite/marble caves, living trees.

### Phase 17 — Biome spread & world evolution (deterministic + networked)
- **Goal:** Living world rules: grass spreads onto dirt, vines grow down, evil biome (Corruption/
  Crimson) and (post-hardmode) Hallow spread through susceptible tiles; mud→jungle grass; all
  host-authoritative and bounded for performance.
- **Why:** Corruption spread is a Terraria signature and a strategic threat. Grass/vine growth makes
  the world feel alive.
- **Prereqs:** 7, plus a world-tick scheduler (introduce here; reused by Phases 61/64/65/68).
- **Touch/Create:** new `systems/WorldTick.ts` (bounded random-tile updates near active players,
  host-only), spread rules keyed by tile adjacency, [net/Protocol.ts](src/net/Protocol.ts) (tile
  updates already replicate as edits — batch them).
- **Do:**
  1. A host-only world-tick that samples N random tiles/second within loaded chunks and applies
     growth/spread rules; broadcast resulting edits (batched) to clients.
  2. Rules: grass→dirt spread, vine growth, evil/hallow spread with the usual susceptibility, mud in
     jungle grows jungle grass. Add "sunflower/blocked" style barriers later (purity items).
  3. Keep it bounded (cap updates/frame) so it never tanks fps.
- **MP:** host runs the tick; edits replicate. Clients never run spread.
- **Done when:** over time, grass creeps, vines grow, and the evil biome slowly spreads into
  adjacent susceptible tiles; co-op stays consistent.

### Phase 18 — Spawn region, guaranteed early structures & world identity
- **Goal:** Make "near spawn" a coherent starting area: a guaranteed safe-ish spawn zone, a nearby
  surface structure or two, guaranteed early ore/wood, and a defined world spawn point the player
  returns to on death.
- **Why:** Terraria worlds have a hand-tuned spawn feel; infinite procedural worlds need a curated
  origin so new games start well.
- **Prereqs:** 3, 13, 14; ties to respawn in [engine/Game.ts](src/engine/Game.ts).
- **Touch/Create:** [world/WorldGen.ts](src/world/WorldGen.ts) (spawn-region shaping),
  [engine/Game.ts](src/engine/Game.ts) (`spawnPlayer` already uses `surfaceHeight(0)` — formalize a
  world spawn point + bed/spawn-point later).
- **Do:** guarantee a walkable, not-underwater, not-evil spawn column; scatter starter trees + a bit
  of surface copper nearby; optionally a small ruined structure to loot immediately.
- **MP:** host defines spawn; clients receive it in the welcome handshake.
- **Done when:** every new seed starts on solid, safe ground with something to do within 30 seconds.

### Phase 19 — Worldgen debug & seed-tuning panel
- **Goal:** A developer overlay to inspect and tune generation: biome map strip, structure/loot
  markers, cave/ore threshold sliders, "teleport to nearest X", seed field, regenerate.
- **Why:** Speeds up all future worldgen tuning and lets the owner validate variety quickly. The game
  already has debug warps (`T`/`Y`) and reseed (`G`).
- **Prereqs:** 1–18 (uses everything).
- **Touch/Create:** new `ui/DebugPanel.ts` (DOM overlay, dev-only toggle), reads from `WorldGen`/
  `BiomeSystem`.
- **Do:** minimap-style biome strip along x; markers for structures/ores/chests/bosses-arenas;
  sliders that live-tweak `config` gen values and reseed; "find nearest dungeon/ocean/evil".
- **MP:** local dev tool only; never affects sim.
- **Done when:** toggling the panel shows the world's structure and lets the owner tune gen live.

### Phase 20 — World persistence (IndexedDB save/load)
- **Goal:** Worlds and progress survive a refresh: save edit deltas + chest contents + world flags +
  entities + time to IndexedDB; load on return; autosave; multiple named worlds.
- **Why:** Right now everything is in-memory (worlds die on refresh). Persistence is mandatory for a
  real game and for hosts to keep a world.
- **Prereqs:** 1, 14, 17 (world flags/time exist). Reuses `ChunkManager.exportDeltas/importDeltas`.
- **Touch/Create:** new `systems/Save.ts` (IndexedDB wrapper), [engine/Game.ts](src/engine/Game.ts)
  (autosave + load), [ui/Menu.ts](src/ui/Menu.ts) (world select/create/delete),
  [Profile.ts](src/Profile.ts) (link characters to saves).
- **Do:**
  1. Serialize: seed, edit deltas, chest contents, world flags (evil type, bosses defeated, dungeon
     unlocked), world time/season, discovered map, entity persistence where relevant.
  2. IndexedDB store keyed by world id; autosave on interval + on leave; load on select.
  3. Menu: create/select/delete worlds; characters (Book III) saved separately (inventory, HP/mana
     tiers, equipment) so a character can enter any world (Terraria-style).
- **MP:** the **host** owns the authoritative save; on host start it loads, on client join it receives
  the current delta set (already in the welcome). Clients don't persist the world, only their own
  character.
- **Done when:** build a base, refresh, and it's still there; multiple worlds/characters selectable
  from the menu.

---

# BOOK II — ITEMS, MATERIALS & CRAFTING (the progression foundation) — Phases 21–30

> Goal of the book: replace the block-only item model with Terraria's full item economy —
> classes, rarity, stats, tooltips, real icons — then tools, coins, materials/bars, crafting +
> stations, storage, and consumables. This is the machinery every weapon/armor/potion needs.

### Phase 21 — Item model overhaul & registry
- **Goal:** A real item system: an item **registry** where every item has id, name, class
  (`block | wall | tool | weapon | ammo | armor | accessory | consumable | material | coin | misc`),
  rarity tier, max stack, value, tooltip lines, stats blob, and a procedurally-rendered icon.
- **Why:** [items/Item.ts](src/items/Item.ts) currently makes items 1:1 with placeable tiles and
  can't represent tools/weapons/potions/coins. Everything in Books II–IV needs this.
- **Prereqs:** 1.
- **Touch/Create:** rewrite [items/Item.ts](src/items/Item.ts) into an item registry + `ItemDef`
  type; keep `itemFromTile` as a helper that registers placeable-block items automatically;
  [player/Inventory.ts](src/player/Inventory.ts) (store item ids/refs), [ui/InventoryUI.ts](src/ui/InventoryUI.ts)
  (render real icons + tooltips).
- **Do:**
  1. Define `ItemDef` (id, name, class, rarity, maxStack, value, tooltip, stats, `placeable?`,
     `iconKind`). Register all placeable blocks from `TILE_PROPS` automatically + non-block items.
  2. Procedural icon generation per class: blocks render from tile sprites (reuse
     [render/TileSprites.ts](src/render/TileSprites.ts)); tools/weapons/etc. get simple procedural
     pixel icons (sword shape, pickaxe shape, coin, bar, potion bottle) cached as data URIs.
  3. Rarity color coding (white/blue/green/orange/…); tooltip renderer (name + stats + value).
- **Data:** the registry scaffolding; a dozen non-block items to prove it (a sword, a pickaxe, a
  potion, a coin, a bar).
- **MP:** items are referenced by id in all net messages; ids must be stable/append-only.
- **Done when:** the inventory shows real icons + hover tooltips with rarity colors; non-block items
  can exist in stacks.

### Phase 22 — Tools (pickaxe/axe/hammer tiers) & tool-gated mining
- **Goal:** Mining requires the right tool and enough **pickaxe power**; axes chop wood faster;
  hammers mine walls + slope tiles. Tools have tiers (copper→…→molten→hardmode reserved).
- **Why:** Tool tiers gate world access (can't mine deep ore without a better pick) — the core
  Terraria gate. Current mining is hardness-only, tool-agnostic.
- **Prereqs:** 21; uses tile `tier`/`toolType` from Phase 1.
- **Touch/Create:** [engine/Game.ts](src/engine/Game.ts) (`mine` uses equipped tool power + type),
  tool item defs, [world/Tile.ts](src/world/Tile.ts) (`tier`/`toolType` filled per tile).
- **Do:** mining speed = f(tool power, tile hardness); if tile `tier` > tool power, can't mine;
  axes required/best for wood, hammers for walls + placing half-blocks/slopes. Selecting a tool in
  the hotbar drives the interaction (left-click uses the held item's behavior).
- **Data:** ~5 tiers × (pick/axe/hammer) tool defs with power/speed.
- **MP:** mining result is already a replicated edit; the *drop* goes to the miner's inventory
  (host-validated in survival).
- **Done when:** a copper pick can't mine deep ore; better picks can; axes chop trees fast; hammers
  mine walls.

### Phase 23 — Coins & the money system
- **Goal:** Copper/Silver/Gold/Platinum coins (100-base conversion), auto-merge, coin drops from
  enemies/pots/chests, a wallet display, and death coin-drop rules.
- **Why:** Currency underpins shops (Book V) and reforging. Reserve now so loot (Phase 14) and
  enemies (Book IV) can pay out.
- **Prereqs:** 21.
- **Touch/Create:** coin item defs, [player/Inventory.ts](src/player/Inventory.ts) (coin stacking +
  auto-convert), HUD wallet (Book IX polishes it).
- **Do:** four coin items; auto-convert 100 copper→1 silver etc.; pickup as world item entities
  (Phase 39 item-drop entities) or direct; display total wealth.
- **MP:** coin drops are host-authoritative world entities; picking up is host-validated.
- **Done when:** killing things / breaking pots yields coins that stack and convert; wallet shows
  total.

### Phase 24 — Materials, bars & monster/material drops
- **Goal:** The crafting materials layer: ore→bar smelting inputs, wood types, gel, cobweb→silk,
  gems, and monster-drop materials — all as registry items with the right drop tables.
- **Why:** Crafting (Phase 25) needs materials to consume. Ties ore (Phase 4) and enemies (Book IV)
  into the economy.
- **Prereqs:** 21, 4.
- **Touch/Create:** material item defs, drop-table hooks in [world/Loot.ts](src/world/Loot.ts) and
  (later) the enemy registry.
- **Do:** define materials (ore items, bars, wood, gel, silk, gems, boss-drop mats); ensure mining
  ore yields the ore *item*; reserve bar ids for smelting.
- **Done when:** the material economy exists as items with sources (mining/loot/enemies).

### Phase 25 — Crafting system & recipe engine
- **Goal:** A data-driven recipe engine + crafting UI: available recipes computed from inventory +
  nearby crafting stations; craft consumes inputs, yields outputs; recipe search/filter.
- **Why:** Crafting is the heart of progression. Nothing exists today.
- **Prereqs:** 21, 24.
- **Touch/Create:** new `systems/Crafting.ts` (recipe registry + `availableRecipes(inventory,
  stations)` + `craft()`), new `ui/CraftingUI.ts`, hook into [ui/InventoryUI.ts](src/ui/InventoryUI.ts).
- **Do:**
  1. Recipe = {inputs[], output, station?, condition?}. `availableRecipes` filters by what the player
     has + which station tiles are within range (Phase 26).
  2. Crafting UI: scrollable recipe list (icon + name), ingredient panel, craft button, craft-all.
  3. Base recipes: wood→planks/workbench/wooden tools/wall; stone→furnace; bars→anvil→armor/tools.
- **Data:** an initial recipe set (~40–60) covering wood/stone/iron tier + torches/platforms/walls +
  a couple potions.
- **MP:** crafting is a **host-validated** action in co-op (inventory is authoritative on... the
  owning client; keep inventory client-owned but validate against dupes via item-drop entities being
  host-authoritative). Simplest: inventory is per-client and trusted (co-op is friends) — document
  that choice; revisit in Phase 90.
- **Done when:** the player can craft their way from wood → workbench → tools → furnace → bars →
  anvil → iron gear, with the UI showing exactly what's craftable now.

### Phase 26 — Crafting stations & proximity
- **Goal:** Placeable crafting stations (workbench, furnace, anvil, sawmill, loom, table+chair,
  alchemy station, hellforge, tinkerer's workshop) that unlock recipes when the player is near.
- **Why:** Stations gate recipe tiers and give the base a purpose.
- **Prereqs:** 25.
- **Touch/Create:** station tiles in [world/Tile.ts](src/world/Tile.ts) (interactive/furniture),
  `systems/Crafting.ts` (nearby-station scan), placement (already exists) + station registry.
- **Do:** each station tile advertises a station type; `availableRecipes` scans a radius around the
  player for station tiles; add multi-tile furniture support if needed (tables). Hellforge from
  Phase 9 counts.
- **Done when:** standing near a furnace unlocks smelting; near an anvil unlocks metal gear; away from
  stations, those recipes hide.

### Phase 27 — Smelting & the ore→bar→gear chain
- **Goal:** Complete the metal progression: ore + furnace → bars; bars + anvil → tools/weapons/armor;
  gem + station → gem items; hellstone + hellforge → hellstone bars (molten tier).
- **Why:** This is the spine of pre-hardmode progression and feeds Book III's gear.
- **Prereqs:** 24, 25, 26.
- **Touch/Create:** recipe data in `systems/Crafting.ts`.
- **Do:** author the full ore→bar and bar→gear recipe chains for all pre-hardmode tiers, matched to
  the ores from Phase 4 and the gear stats in Book III.
- **Done when:** every pre-hardmode ore has a bar and a gear path.

### Phase 28 — Storage: chests, banks & the container UI
- **Goal:** Placeable chests as real containers, plus piggy bank / safe (personal storage), with a
  proper container UI (open, transfer, quick-stack, loot-all), integrated with worldgen chests
  (Phase 14).
- **Why:** Storage is essential once the item economy exists. Worldgen chests already store contents;
  this makes player-placed chests first-class.
- **Prereqs:** 14, 21.
- **Touch/Create:** chest tile interaction, container UI (extend the worldgen-chest UI from Phase 14),
  chest-content persistence in deltas (Phase 20).
- **Do:** place/mine chests (mining a non-empty chest fails or drops contents), open UI with the
  player inventory beside it, transfer/quick-stack/loot-all; piggy bank/safe shared across a
  character.
- **MP:** container mutations are host-authoritative (`containerSync`) to prevent dupes.
- **Done when:** the player can build a base with chests, store/retrieve items, and it persists +
  syncs.

### Phase 29 — Inventory UX overhaul
- **Goal:** A polished, graphical inventory: tooltips with full stats, sort, trash slot, quick-stack
  to nearby chests, item drag with stack-splitting, mouse + keyboard + basic controller/touch.
- **Why:** The current inventory works but is minimal; UX quality is a big part of "feels better."
- **Prereqs:** 21, 28. (Full HUD/theme polish is Phase 84.)
- **Touch/Create:** [ui/InventoryUI.ts](src/ui/InventoryUI.ts), [engine/Input.ts](src/engine/Input.ts)
  (right-click split, shift-move, controller/touch scaffolding).
- **Do:** stack split (right-click), shift-click move, sort button, trash slot, quick-stack-to-chests
  button, tooltips, keyboard nav; groundwork for touch (big hit targets).
- **Done when:** managing items feels smooth and modern.

### Phase 30 — Consumables & potions (alchemy)
- **Goal:** Consumable items: healing/mana potions, buff potions, food; an alchemy recipe set at the
  alchemy station using herbs (farming hook, Book VII) + bottled water; use-cooldowns + potion
  sickness.
- **Why:** Potions are core survivability + the payoff of farming/fishing. Buffs need the buff system
  (Phase 41) — build the item + consumption here, wire buffs in 41.
- **Prereqs:** 21, 25, 26; buffs finalized in 41.
- **Touch/Create:** consumable item defs + `use` behavior in [engine/Game.ts](src/engine/Game.ts)
  (right-click/use consumes + applies effect), alchemy recipes.
- **Do:** healing potion (heal + potion sickness debuff), mana potion, a few buff potions, basic
  foods (well-fed buff); herbs/bottled-water as ingredients (herbs stubbed until farming).
- **MP:** consumption + heal applied to the using player; host validates in co-op (revisit Phase 90).
- **Done when:** drinking a healing potion heals with a cooldown; buff potions grant a timed buff
  once Phase 41 lands.

---

# BOOK III — PLAYER, COMBAT & EQUIPMENT — Phases 31–42

> Goal of the book: turn the player from "a moving AABB with an HP number" into a full action-RPG
> character — stats, equipment, all four damage classes, a shared projectile engine, buffs, combat
> juice, and animation. This is where "feels better than Terraria" is won or lost.

### Phase 31 — Player stats & attributes
- **Goal:** Real player stats: max-HP tiers (Life Crystals raise it to 400, Life Fruit later), mana
  (Mana Crystals, 20→200), defense, per-class damage/crit/knockback, movement stats (run speed,
  accel, jump height) — all aggregated from base + equipment + buffs.
- **Why:** Everything combat depends on stats. Player currently has only `health`/`maxHealth`.
- **Prereqs:** 15 (life/mana crystals exist as items), 21.
- **Touch/Create:** [entities/Player.ts](src/entities/Player.ts) (stat block + recompute), consume
  life/mana crystals (from Phase 15), HUD (hearts/stars — Phase 84 polishes).
- **Do:** add `PlayerStats` (maxHp, mana/maxMana, defense, damage mults per class, crit, moveSpeed,
  jumpHeight, misc); a `recomputeStats()` that sums base + armor + accessories + buffs; consuming a
  Life/Mana Crystal permanently raises the cap; mana regen (faster when idle).
- **MP:** stats are per-player, computed client-side from that player's equipment; damage dealt is
  host-validated. Broadcast max-HP so other players' health bars render right.
- **Done when:** using life crystals raises max HP; mana exists and regenerates; defense reduces
  incoming damage; the HUD shows HP + mana.

### Phase 32 — Equipment slots, armor/accessory framework & set bonuses
- **Goal:** Equipment UI + slots: 3 armor (head/chest/legs), 5+ accessory slots, vanity slots, dye
  slots; equipping recomputes stats; armor sets grant set bonuses.
- **Why:** The equipment layer is how progression is felt. None exists.
- **Prereqs:** 31.
- **Touch/Create:** [player/Inventory.ts](src/player/Inventory.ts) (equipment slots),
  [ui/InventoryUI.ts](src/ui/InventoryUI.ts) (equip panel), armor/accessory item defs with stat
  contributions + set-bonus ids.
- **Do:** equipment slots + equip/unequip (drag or right-click); `recomputeStats` reads equipment;
  set-bonus detection (all-3 matching → bonus). Vanity overrides appearance only.
- **MP:** each client owns its equipment; broadcast enough (armor ids) for other players' rendering
  (Phase 42/86).
- **Done when:** equipping armor changes defense/appearance; wearing a full set triggers its bonus.

### Phase 33 — Armor content (pre-hardmode sets)
- **Goal:** Full pre-hardmode armor sets (wood, ore tiers copper→…→molten, plus class sets like
  jungle/necro/meteor) with defense + class bonuses + set bonuses, all craftable.
- **Why:** Concrete goals for the ore/crafting chain.
- **Prereqs:** 27, 32.
- **Touch/Create:** armor item defs + recipes (`systems/Crafting.ts`) + render layers (Phase 42).
- **Do:** author ~12–15 armor sets with stats/bonuses tuned to a difficulty curve; recipes at the
  anvil/loom/hellforge.
- **Done when:** the player can craft a visible armor progression from wood to molten.

### Phase 34 — Accessories & movement kit (grappling hook, wings, boots)
- **Goal:** The accessory content that transforms movement/combat: grappling hook (a hook projectile
  + reel physics), cloud/blizzard-in-a-bottle (double jump), hermes boots (run speed), lucky
  horseshoe (no fall damage), wings (flight), shackle/band-of-regen (combat/utility).
- **Why:** Movement accessories are the single biggest "feel" upgrade in Terraria. The grappling hook
  needs the projectile engine (Phase 39) — build the hook here, generalize in 39, or build a minimal
  hook now and refactor.
- **Prereqs:** 32; grappling uses projectile engine (39) — acceptable to implement hook first.
- **Touch/Create:** accessory defs + effects applied in [entities/Player.ts](src/entities/Player.ts)
  (double jump, run speed, fall immunity, flight), grappling-hook mechanic (new
  `entities/Grapple.ts`), input binding for hook + jump.
- **Do:** implement each accessory's effect through the stat/effect system; grappling hook: fire to a
  tile, attach, reel/swing, release; wings: hold-jump flight timer.
- **MP:** movement is client-side for the local player; broadcast position (already done) — hook
  visuals for remote players are cosmetic snapshots.
- **Done when:** grappling hook, double jump, speed boots, no-fall-damage, and wings all work and feel
  great.

### Phase 35 — Melee weapons & the swing system
- **Goal:** Melee weapons with animated swing arcs and hitboxes: broadswords (arc swing), shortswords
  (stab), spears (thrust), plus damage/knockback/crit/use-time; auto-swing option.
- **Why:** Melee is the starting combat class; the swing arc + hit feedback is core game feel.
- **Prereqs:** 31, 21.
- **Touch/Create:** new `systems/Combat.ts` (damage application, crit, knockback, i-frames), melee
  weapon defs, swing animation + hitbox in [engine/Game.ts](src/engine/Game.ts)/render, held-item
  rendering (Phase 42).
- **Do:** using a melee weapon plays a swing (arc for broadswords), generates a moving hitbox for the
  use-time, applies damage once per enemy per swing with knockback + crit + i-frames on the target;
  auto-swing weapons repeat while held.
- **Data:** ~15 melee weapons across tiers.
- **MP:** melee hits are sent as host-validated hit events (attacker → host → damage + broadcast);
  reuse/extend the existing `attack` message. Local swing animation is immediate (predicted).
- **Done when:** swinging a sword shows an arc, hits enemies in range, deals class damage with crit +
  knockback + i-frames, and syncs in co-op.

### Phase 36 — Ranged weapons, ammo & the projectile engine (shared)
- **Goal:** A pooled, networked **projectile engine** + ranged weapons: bows/arrows, guns/bullets,
  throwing; ammo consumption; projectile-tile/enemy/player collision; gravity/pierce/velocity per
  projectile.
- **Why:** Projectiles are shared by ranged, magic, summons, boss attacks, and the grappling hook —
  a foundational system.
- **Prereqs:** 35 (combat/damage). Feeds 37, 38, 48+ (bosses), 34 (refactor hook onto it).
- **Touch/Create:** new `entities/Projectile.ts` + `systems/ProjectileManager.ts` (pooled),
  [net/Protocol.ts](src/net/Protocol.ts) (spawn/despawn/sync projectiles), ranged weapon + ammo defs.
- **Do:**
  1. Projectile pool with per-type behavior (velocity, gravity, drag, pierce count, bounce, homing,
     lifetime, tile collision, on-hit effect).
  2. Ranged weapons consume ammo, spawn projectiles with spread/velocity; damage via `systems/Combat`.
  3. Refactor the grappling hook (Phase 34) to ride this engine if practical.
- **Data:** bows/guns + arrow/bullet ammo types.
- **MP:** projectiles are **host-authoritative** (host spawns/simulates, broadcasts; clients render
  interpolated). Client fire = intent → host spawns. Local muzzle flash predicted.
- **Done when:** firing a bow/gun spawns projectiles that arc/collide/damage and are synced in co-op.

### Phase 37 — Magic weapons & mana
- **Goal:** Magic class: staves/spellbooks that cost mana and fire magic projectiles (bolts, homing,
  area), mana cost/regen, mana-star pickups, magic accessories.
- **Why:** Second ranged class; showcases the projectile engine + mana.
- **Prereqs:** 31 (mana), 36 (projectiles).
- **Touch/Create:** magic weapon defs, mana consumption in `systems/Combat`/`Game`, magic projectile
  behaviors, star/mana pickups.
- **Do:** a handful of magic weapons with distinct projectile behaviors; mana gating + regen; "out of
  mana" feedback; star pickups restore mana.
- **Done when:** magic weapons fire distinct spells at mana cost and feel good.

### Phase 38 — Summoner class: minions & sentries
- **Goal:** Summon weapons that spawn persistent minions (follow the player, attack nearby enemies)
  and sentries (stationary); minion slots (stat), whips (summon-tag melee).
- **Why:** Fourth damage class; unique AI-driven combat.
- **Prereqs:** 36 (projectiles for minion attacks), 32 (minion-slot stat).
- **Touch/Create:** `entities/Minion.ts` + management in `systems/ProjectileManager` or a new
  `systems/MinionManager.ts`, summon weapon defs, whip defs.
- **Do:** minions orbit/follow the player, pick targets, attack via projectiles/contact; sentries
  stay put; minion-slot cap from armor/accessories; whips tag enemies for +minion damage.
- **MP:** minions are host-authoritative but owned/attributed to a player; broadcast their state.
- **Done when:** summoning a minion gives an autonomous helper that fights alongside the player in
  co-op.

### Phase 39 — Item drops as world entities (loot pickup)
- **Goal:** Dropped items exist as physical world entities (bob, get sucked toward players, stack,
  despawn) — enemy drops, thrown items, coins, tile drops that don't fit inventory.
- **Why:** The connective tissue between combat/mining and inventory; also the anti-dupe boundary in
  co-op.
- **Prereqs:** 21, 23.
- **Touch/Create:** `entities/ItemDrop.ts` + `systems/DropManager.ts`, [net/Protocol.ts](src/net/Protocol.ts)
  (drop spawn/pickup), hook into mining/enemy death/pots.
- **Do:** physical item drops with AABB gravity, magnet-to-nearby-player, auto-stack on ground,
  timed despawn; pickup adds to inventory.
- **MP:** drops are **host-authoritative**; only the host grants a pickup (prevents two players
  grabbing the same drop). Reconcile the item→inventory add via a pickup ack.
- **Done when:** killing an enemy / mining ore spawns a physical item that flies into the player and
  stacks; co-op can't dupe a single drop.

### Phase 40 — Combat feel & juice
- **Goal:** Make hits *feel*: floating damage numbers (crit styled), hit-stop/frame-freeze, knockback,
  screen shake, hurt flashes, blood/dust burst particles, enemy death effects, low-HP screen vignette,
  kill/critical feedback.
- **Why:** Juice is the difference between "functional combat" and "better than Terraria." Terraria's
  own hit feedback is fairly flat — this is a place to exceed it.
- **Prereqs:** 35 (combat), particles exist ([render/Particles.ts](src/render/Particles.ts)).
- **Touch/Create:** `systems/Combat.ts` (emit feedback events), [render/Particles.ts](src/render/Particles.ts)
  (gore/dust/spark presets), a `render/DamageText.ts`, [engine/Renderer.ts](src/engine/Renderer.ts)
  (screen shake/flash hooks), [engine/Camera.ts](src/engine/Camera.ts) (shake).
- **Do:** damage numbers rise + fade (crit bigger/colored); brief hit-stop on impactful hits; camera
  shake scaled to hit; particle bursts on hit + death; low-HP vignette + heartbeat cue (audio in
  Book IX).
- **MP:** feedback is client-side cosmetic driven by replicated damage events.
- **Done when:** combat is punchy — numbers pop, screen reacts, enemies burst on death.

### Phase 41 — Buffs & debuffs (status effects)
- **Goal:** A timed status-effect system: buffs (regen, ironskin, swiftness, well-fed, mana regen)
  and debuffs (poison, on-fire, frostburn, bleeding, slow, confusion) with icons, timers, and
  per-tick effects; buff bar UI.
- **Why:** Potions (Phase 30), campfires, food, and enemy attacks all need this; it deepens combat.
- **Prereqs:** 30 (consumables apply buffs), 31 (stats).
- **Touch/Create:** `systems/Buffs.ts` (registry + per-entity active-buff list + tick), apply from
  potions/food/campfires/enemy hits, buff-bar UI (Phase 84 polishes).
- **Do:** buff registry (id, duration, stat mods, per-tick callback, icon); attach to player/enemies;
  tick effects (dot damage, regen); station buffs (campfire = regen near it, heart lantern, etc.).
- **MP:** buffs on the local player are client-side; debuffs applied by host-validated hits are
  broadcast; enemy buffs/debuffs are host-side.
- **Done when:** potions/food grant visible timed buffs; poison/fire tick damage over time; a campfire
  grants regen nearby.

### Phase 42 — Player animation, held items & armor rendering
- **Goal:** Replace the static player rectangle with an animated rig: idle/walk/run/jump/fall/swim
  frames, held-item rendering (tool/weapon in hand, swing/use poses), layered armor/vanity rendering,
  facing, and remote-player animation.
- **Why:** Animation is a massive "looks/feels better" lever and is entirely absent.
- **Prereqs:** 32 (equipment to render), 35 (swing poses).
- **Touch/Create:** `render/PlayerSprite.ts` (procedural or spritesheet rig, layered),
  [engine/Renderer.ts](src/engine/Renderer.ts) (draw player rig + held item + armor layers),
  [entities/RemotePlayer.ts](src/entities/RemotePlayer.ts) (animate from synced state).
- **Do:** an animation state machine driven by velocity/onGround/using; layered body/armor/held-item
  compositing; use-item poses (swing arc, aim, cast); apply to remote players from their synced
  facing/velocity/armor.
- **MP:** broadcast the small extra state (using-item id, swing phase) so remote players animate
  correctly; already broadcasting position/facing.
- **Done when:** the player and remote players animate (walk/jump/swing/swim) and visibly hold their
  equipped items + wear their armor.

---

# BOOK IV — ENEMIES, BOSSES & EVENTS — Phases 43–54

> Goal of the book: a data-driven enemy ecosystem, an AI library, a spawn director, loot, and a boss
> framework carrying several full boss fights up to the Wall of Flesh → **Hardmode** trigger, plus
> world events. Replaces the three hardcoded creatures with real content.

### Phase 43 — Enemy framework (data-driven registry)
- **Goal:** Replace hardcoded `Creature` kinds with an **enemy registry**: each enemy is data (id,
  stats, AI type, size, sprite, drops, spawn conditions, damage, defense, knockback resistance).
- **Why:** [entities/Creature.ts](src/entities/Creature.ts) hardcodes 3 kinds; every later phase adds
  enemies — they must be data, not code branches.
- **Prereqs:** 39 (drops), 21 (items for drops).
- **Touch/Create:** refactor [entities/Creature.ts](src/entities/Creature.ts) into a generic
  `Enemy` entity driven by an `EnemyDef`; new `entities/enemies/EnemyRegistry.ts`;
  [systems/CreatureManager.ts](src/systems/CreatureManager.ts) → generalized spawn/manage;
  [net/Protocol.ts](src/net/Protocol.ts) (enemy snapshot carries enemy-def id).
- **Do:** define `EnemyDef` + registry; port critter/slime/bat into it; enemy uses an AI-type
  reference (Phase 44) instead of inline `if kind===`.
- **MP:** keep the existing host-authoritative snapshot model; snapshots now include the def id.
- **Done when:** the 3 existing creatures run through the registry with no behavior change; adding a
  new enemy is a data entry + optional new AI.

### Phase 44 — AI behavior library
- **Goal:** Reusable AI behaviors: `walker` (ground chase, jump ledges), `slime` (hop), `flyer`
  (hover/dive), `caster` (keep distance + shoot), `worm` (segmented follow), `swimmer`, `passive`,
  `bouncer` — composable per enemy.
- **Why:** Enemy variety comes from reusing a handful of solid AIs.
- **Prereqs:** 43, 36 (projectiles for casters/worms).
- **Touch/Create:** `entities/enemies/ai/*.ts` (one per behavior) + a dispatcher on `Enemy.update`.
- **Do:** implement each behavior with tile-aware movement (reuse the AABB stepping from
  [entities/Creature.ts](src/entities/Creature.ts)); casters fire host-authoritative projectiles;
  worms are multi-segment entities.
- **MP:** all AI runs on host; clients render snapshots (worm segments included).
- **Done when:** the library supports ground/flying/casting/segmented/swimming enemies cleanly.

### Phase 45 — Spawn director
- **Goal:** A proper spawn system: weighted by biome + depth + time-of-day + events + player danger;
  spawn-rate/cap tuning; no spawns in town/near NPCs or on player-lit safe areas; off-screen spawn +
  despawn.
- **Why:** Current spawning is a naive off-screen slime/bat/critter picker. Real spawns drive pacing.
- **Prereqs:** 43, 44; time-of-day from Phase 61 (gate night spawns then); events from Phase 53.
- **Touch/Create:** rework [systems/CreatureManager.ts](src/systems/CreatureManager.ts) into a
  `systems/SpawnDirector.ts` with a spawn-pool query by context.
- **Do:** context → candidate enemy pool + weights; spawn rate + cap scale with biome/depth/event;
  suppress near town/light; keep the "prime a few on start" behavior.
- **MP:** host-only spawning; clients receive enemies via snapshots (already).
- **Done when:** surface at night, caves, evil biome, and hell each spawn their own appropriate
  enemies at sane rates; towns are safe.

### Phase 46 — Enemy content wave 1 (pre-boss roster)
- **Goal:** A broad pre-hardmode enemy roster with sprites, stats, and drops across biomes/depths:
  zombies, demon eyes (night), slimes (many), cave bats, giant worms, skeletons, cave crawlers,
  antlions (desert), piranhas (water), hornets (jungle), fire imps/lava slimes (hell), corruptors/
  crimson enemies (evil), spiders, etc.
- **Why:** Populates the world with recognizable threats + drop sources.
- **Prereqs:** 43, 44, 47 (drops), 45 (spawns).
- **Touch/Create:** many `EnemyDef` entries + sprites ([render/](src/render/) procedural or small
  spritesheets).
- **Data:** ~30–40 enemies with drops mapped to loot (Phase 47).
- **Done when:** each biome/time/depth feels distinctly populated.

### Phase 47 — Loot & drop tables (enemies)
- **Goal:** Per-enemy drop tables: coins, common mats, rare weapons/accessories, banners (kill-count),
  event/boss-gated drops; global drop rules (hearts/mana stars, coin portions).
- **Why:** Enemies must reward the player and feed crafting.
- **Prereqs:** 39, 24, 23. Reuses [world/Loot.ts](src/world/Loot.ts).
- **Touch/Create:** enemy drop tables in the registry + `world/Loot.ts`; hearts/stars pickups.
- **Do:** author drop tables; on death roll drops → spawn item-drop entities; enemies occasionally
  drop hearts (heal) / stars (mana) as pickups.
- **MP:** rolled + spawned by host.
- **Done when:** kills pay out coins/mats/occasional gear; hearts/stars drop and heal/restore.

### Phase 48 — Boss framework
- **Goal:** A reusable boss controller: multi-phase state machines, boss HP bar UI, arena/leash rules,
  music trigger (Book IX), enrage/despawn, summon items, "boss defeated" world flags.
- **Why:** Bosses are the backbone of Terraria progression; they need shared infrastructure.
- **Prereqs:** 36 (projectiles), 43/44 (enemy tech), 40 (juice), 20 (world flags for defeats).
- **Touch/Create:** `entities/bosses/Boss.ts` + `systems/BossManager.ts`, boss-bar UI, summon item
  handling, world-flag integration.
- **Do:** boss base with phases, attack scheduling, target selection (nearest/most players in co-op),
  HP-bar UI, arena leash + despawn when players leave/die, defeat → set world flag + drops.
- **MP:** bosses are host-authoritative; the HP bar + attacks sync to all clients; a boss targets/
  scales to the number of players (co-op HP scaling).
- **Done when:** the framework can run a scripted multi-phase fight with a synced HP bar in co-op.

### Phase 49 — Boss 1: the Eye (first boss)
- **Goal:** An Eye-of-Cthulhu-style first boss: summon item (or random night spawn after conditions),
  two phases (hover+charge → split servants → aggressive charges), a real drop (demonite/crimtane
  equivalent + boss mask/trophy).
- **Why:** The first "you beat a boss" milestone; validates the framework end-to-end.
- **Prereqs:** 48.
- **Touch/Create:** the boss def + attack scripts; summon item recipe; drop table.
- **Done when:** the player can summon and defeat a full two-phase boss (solo and co-op) and get its
  drops + world flag.

### Phase 50 — Boss 2: the Devourer / Brain (evil-biome boss)
- **Goal:** The evil-biome boss: a segmented worm (Eater of Worlds) *or* a Brain-of-Cthulhu-style
  fight, summoned by breaking orbs/hearts (Phase 7) or a crafted summon; drops the evil ore/scales
  needed for the next gear tier.
- **Why:** Gates the shadow/crimson armor + demonite/crimtane tools; showcases worm AI.
- **Prereqs:** 48, 44 (worm AI), 7 (orbs/hearts).
- **Done when:** breaking the 3rd orb/heart (or using the summon) triggers and the fight drops evil
  ore/materials.

### Phase 51 — Boss 3: Skeletron (dungeon guardian) & dungeon unlock
- **Goal:** The dungeon-entrance boss that, on defeat, unlocks the deep dungeon (clears the Phase 8
  gate flag); an old-man NPC at the entrance who summons it at night.
- **Why:** Gates the dungeon's mid-game loot; ties NPC + world-flag systems together.
- **Prereqs:** 48, 8 (dungeon + gate flag), 55 (NPC framework — the old man).
- **Done when:** defeating Skeletron flips the dungeon-unlock flag (synced + saved), and the dungeon
  becomes enterable for all players.

### Phase 52 — Boss 4: Wall of Flesh → Hardmode trigger
- **Goal:** The underworld boss that ends pre-hardmode: summoned by an item in hell, moves across the
  world, and on death triggers **Hardmode** world conversion (implemented fully in Phase 96) — for
  now flip the `hardmode` world flag + spawn the first hardmode changes stub.
- **Why:** The pre-hardmode capstone and the gateway to the back half of the game.
- **Prereqs:** 48, 9 (underworld arena).
- **Do:** WoF fight (two eyes + mouth, speed ramps, hungry minions); on death set `hardmode=true`
  (saved + synced), broadcast the world-changing event; the heavy conversion is Phase 96.
- **Done when:** defeating WoF flips the world into (stub) Hardmode and drops the first hardmode-tier
  reward.

### Phase 53 — World events (Blood Moon, Goblin Army, Eclipse, invasions)
- **Goal:** Timed/triggered events with their own spawn pools + rewards: Blood Moon (night, boosted
  spawns + special enemies), Goblin Army (progress-gated invasion wave from world edge), Solar
  Eclipse (hardmode day event), plus an event framework for later invasions.
- **Why:** Events are core to Terraria's rhythm and co-op fun.
- **Prereqs:** 45 (spawns), 61 (time), 48 (mini-boss-like scaling), 20 (flags).
- **Touch/Create:** `systems/EventManager.ts` (event registry, triggers, progress bars, rewards),
  integrate with the spawn director.
- **Do:** each event: trigger condition, duration/progress, spawn-pool override, unique enemies +
  drops, on-complete reward; a HUD progress bar.
- **MP:** host runs events; broadcast event state + progress bar to clients.
- **Done when:** a Blood Moon at night ramps spawns with special enemies; a Goblin Army marches in and
  can be beaten for loot.

### Phase 54 — Meteors & dynamic world events
- **Goal:** Dynamic world changes: meteorite impacts (after boss 1) that create a meteor biome with
  meteorite ore + meteor heads, plus hooks for future dynamic changes (comet, etc.).
- **Why:** Makes the world feel reactive and gives a mid-game ore/biome.
- **Prereqs:** 49 (post-boss trigger), 17 (world tick to place the impact), 20 (flags).
- **Do:** after conditions, host places a meteorite crater (deterministic-ish, recorded as edits +
  a flag), meteor-head enemies spawn there, meteorite ore → space-gun/meteor armor.
- **MP:** host places + broadcasts the impact edits.
- **Done when:** post-first-boss, a meteor lands somewhere and becomes a mineable meteor biome.

---

# BOOK V — NPCs, TOWN & ECONOMY — Phases 55–60

> Goal of the book: living town NPCs with housing, shops, happiness/pylons, and quests — the social
> and economic layer that gives a base meaning and spends the coins from combat.

### Phase 55 — NPC framework & housing
- **Goal:** Town-NPC entities that walk/idle/flee at night, need valid houses, and move in when
  conditions are met; a housing-validation system (enclosed by walls + door + light + furniture +
  size); the Guide as the first NPC (spawns at world start).
- **Why:** NPCs anchor progression hints, shops, and services. None exist. Housing reuses the
  wall/enclosure detection (Phase 2).
- **Prereqs:** 2 (walls/enclosure), 26 (furniture tiles), 20 (NPC persistence).
- **Touch/Create:** `entities/NPC.ts` + `systems/TownManager.ts` (housing query + move-in),
  `ui/HousingUI.ts` (query valid house), NPC AI (walk within house/town, flee to house at night).
- **Do:** housing validation (walls, door, light source, flat furniture, min area); NPC spawn/move-in
  when its condition holds and a house is free; NPC daily behavior; Guide spawns first and gives
  crafting/recipe hints.
- **MP:** NPCs are host-authoritative entities synced like enemies; housing is a world state.
- **Done when:** building a valid room lets the Guide move in; NPCs wander by day, shelter at night.

### Phase 56 — NPC roster & move-in conditions
- **Goal:** The core town NPCs with their unlock conditions: Merchant (own 50 silver), Nurse (life
  crystal used), Demolitionist (own a bomb), Arms Dealer (own a gun), Dryad (boss defeated), Dye
  Trader, Painter, Stylist, Goblin Tinkerer (from Goblin Army), Wizard, Mechanic (dungeon), etc.
- **Why:** Each NPC is a service/shop; unlock conditions tie into the whole progression.
- **Prereqs:** 55, and the systems each condition references.
- **Data:** ~12–18 NPCs with conditions, dialogue, and shop stock (Phase 57).
- **Done when:** meeting conditions makes each NPC available to house.

### Phase 57 — Shops & the coin economy
- **Goal:** Buy/sell UI per NPC with stock, prices, buyback; coin spending/earning loop; some NPCs
  sell services (Nurse heal-for-coins, Dryad purity check, Stylist haircut).
- **Why:** Closes the money loop from Phase 23.
- **Prereqs:** 23, 55, 56.
- **Touch/Create:** `ui/ShopUI.ts`, shop stock data on NPC defs, sell = coin gain, buy = coin spend +
  buyback slots.
- **MP:** shop transactions are per-client (friends) but validated against coin balance; document the
  trust model (revisit Phase 90).
- **Done when:** the player can buy/sell with NPCs and services work.

### Phase 58 — Happiness, biome preferences & pylons
- **Goal:** Terraria-1.4-style NPC happiness (liked/disliked neighbors + biomes) affecting prices and
  unlocking **pylons** for a fast-travel network between distant towns.
- **Why:** Deepens town-building strategy and solves travel in an infinite world (a differentiator).
- **Prereqs:** 55–57, 84 (map for pylon travel UI).
- **Do:** happiness score from neighbor/biome rules → price modifier + pylon-sell threshold; pylons
  as placeable tiles that form a network the player can teleport between (in-biome, ≥2 happy NPCs).
- **MP:** pylon travel is a client action validated by host (world state).
- **Done when:** well-placed NPCs get happy, sell pylons, and the player fast-travels between towns.

### Phase 59 — Quests & the bulletin board
- **Goal:** A quest system: Angler-style daily fishing quests, guide/mechanic tasks, and a bulletin
  board for repeatable bounties (kill X, deliver Y) with coin/item rewards.
- **Why:** Directed goals + reasons to explore, especially for co-op sessions.
- **Prereqs:** 57 (rewards), 69 (fishing for angler), 55 (NPCs).
- **Touch/Create:** `systems/Quests.ts` + `ui/QuestUI.ts`, quest-giver NPCs.
- **Done when:** the player can accept, complete, and turn in quests for rewards.

### Phase 60 — Player home base tools (bed/spawn, flags, respawn)
- **Goal:** Bed as a spawn point, respawn timers (esp. in co-op), teleporters, storage-room quality,
  and base-building QoL (banners suppressing enemies, peace candles, etc.).
- **Why:** A real base needs a spawn point + safety tools; co-op needs respawn rules.
- **Prereqs:** 55, 18 (spawn), 41 (buff-station tiles).
- **Do:** bed sets spawn (per player in co-op); respawn timer scales with bosses; safety furniture;
  teleporter pads (wired, ties to Phase 67).
- **MP:** per-player spawn points synced; respawn handled host-side.
- **Done when:** sleeping sets your spawn; dying returns you there on a timer; base tools work in
  co-op.

---

# BOOK VI — WORLD SIMULATION & TIME — Phases 61–67

> Goal of the book: bring the world to life over time — day/night, weather, seasons, dynamic liquids,
> tile mechanics (falling/growing/burning), and wiring/mechanisms — all host-authoritative and
> bounded for performance.

### Phase 61 — Day/night cycle & game clock
- **Goal:** A networked game clock with day/night: sun/moon arc, sky-color gradient over time,
  ambient light modulation, moon phases, fallen-stars at night, and time-gated spawns/events.
- **Why:** Lighting is currently static daylight; time is the backbone of spawns, events, farming,
  and NPC behavior. A huge "feels alive" upgrade.
- **Prereqs:** lighting exists ([systems/Lighting.ts](src/systems/Lighting.ts)); feeds 45/53/55/62/68.
- **Touch/Create:** `systems/Time.ts` (clock, day/night, phase), [systems/Lighting.ts](src/systems/Lighting.ts)
  (ambient sky color/intensity from time), [render/Parallax.ts](src/render/Parallax.ts) + sky
  rendering (sun/moon/stars), [net/Protocol.ts](src/net/Protocol.ts) (time sync).
- **Do:** clock with configurable day length; sky gradient + sun/moon sprites tracking time; ambient
  light drops at night (surface only; underground already dark); fallen stars spawn at night as
  pickups (mana). Time is authoritative on host, broadcast to clients.
- **MP:** host owns time; clients sync + interpolate.
- **Done when:** the sky transitions dawn→day→dusk→night with a moving sun/moon and darker nights,
  synced across co-op.

### Phase 62 — Weather (rain, storms, snow, sandstorms)
- **Goal:** Weather systems: rain (visual + gameplay: fishing power, some enemies), thunderstorms,
  blizzards in snow, sandstorms in deserts, wind affecting particles; weather forecast/transition.
- **Why:** Atmosphere + gameplay hooks (fishing, events, farming).
- **Prereqs:** 61, particles ([render/Particles.ts](src/render/Particles.ts)).
- **Touch/Create:** `systems/Weather.ts` (host-authoritative weather state + transitions), rendering
  of precipitation + overlays, wind param for particles/parallax.
- **MP:** host picks weather; broadcasts state; clients render.
- **Done when:** it rains/snows/storms with visuals and at least one gameplay effect, synced in co-op.

### Phase 63 — Seasons (Stardew hybrid)
- **Goal:** A season cycle (spring/summer/fall/winter) that tints biomes, shifts weather odds, gates
  crop growth (Book VII), and changes some spawns/loot — a differentiator vs Terraria.
- **Why:** Core to the Stardew hybrid identity and gives long-term rhythm.
- **Prereqs:** 61, 62; feeds 68 (farming).
- **Touch/Create:** extend `systems/Time.ts` with seasons; season tints in the renderer; season
  hooks in weather/spawns/farming.
- **MP:** host owns the season; synced.
- **Done when:** the world visibly cycles seasons that affect weather + growth.

### Phase 64 — Dynamic liquids (re-enable, networked)
- **Goal:** Re-enable flowing liquids (water/lava/honey) with settling, spread, waterfalls, and
  water+lava→obsidian — but host-authoritative + bounded so it stays co-op-consistent and cheap.
- **Why:** Static liquids were a deliberate stopgap ([systems/LiquidSim.ts](src/systems/LiquidSim.ts)
  exists but is disabled to avoid flooding + desync). Dynamic liquids unlock pumps, farming, traps,
  and building — but must not repeat the flooding/desync problems.
- **Prereqs:** 17 (world tick), 20 (persistence), robust MP.
- **Touch/Create:** re-integrate/rewrite [systems/LiquidSim.ts](src/systems/LiquidSim.ts) as a
  **host-only**, active-region-bounded cellular sim writing liquid deltas; broadcast liquid deltas
  batched; render flow + waterfalls.
- **Do:** only simulate liquid cells near active players and only when disturbed (dirty-cell queue);
  cap updates/frame; obsidian on water+lava contact; persist liquid state in the save.
- **MP:** **host authoritative**, liquid changes broadcast as batched deltas; clients never simulate.
- **Done when:** breaking a wall lets water flow and settle realistically, synced across co-op, with
  no global flooding and no fps collapse.

### Phase 65 — Tile mechanics: gravity, growth, farming-hooks
- **Goal:** Active tile behaviors: sand/gravel/silt fall; grass/vines/mushrooms grow; saplings grow
  into trees; plants regrow; cactus/coral grow; bamboo/herbs — all via the bounded world tick.
- **Why:** A living, growing world (and the substrate for farming/fishing).
- **Prereqs:** 17 (world tick), 61 (time for growth rates).
- **Touch/Create:** growth/gravity rules in `systems/WorldTick.ts`, tree growth from saplings
  (reuse [world/Trees.ts](src/world/Trees.ts) shapes).
- **MP:** host ticks; edits replicate.
- **Done when:** sand falls when undermined; planted saplings grow into trees; grass/vines spread
  naturally.

### Phase 66 — Fire, explosions & environmental hazards
- **Goal:** Explosives (bombs/dynamite/TNT) that blast terrain (respecting blast resistance from
  Phase 1), fire that spreads on flammable tiles, lava ignition, and hazard tiles (spikes, thorns,
  hellstone burn).
- **Why:** Mining tools, traps, combat, and dungeon/hell hazards all need this.
- **Prereqs:** 1 (blast resistance/flags), 64 (lava), 39 (item drops from blasted tiles).
- **Touch/Create:** `systems/Explosions.ts` (radius blast → edits), fire spread in the world tick,
  hazard-tile contact damage in physics.
- **MP:** host resolves explosions/fire → replicated edits + damage events.
- **Done when:** a bomb clears a crater (tough tiles resist), fire spreads on wood, and spike/lava
  hazards hurt.

### Phase 67 — Wiring & mechanisms (Terraria logic layer)
- **Goal:** A wiring layer: wires (colored), switches/levers, pressure plates, timers, logic gates,
  actuators (toggle tile solidity), and triggerable devices (doors, traps, teleporters, lights,
  spawners) — a wire view mode.
- **Why:** Wiring is a huge Terraria depth sink and the bridge to the Mindustry automation book.
- **Prereqs:** 1 (extra tile layer for wires), 66 (traps), 60 (teleporters).
- **Touch/Create:** a wire layer on `Chunk` (like liquids), `systems/Wiring.ts` (signal propagation),
  wire-view rendering, device tiles + behaviors.
- **MP:** host resolves signals/device activations; broadcasts resulting edits/states.
- **Done when:** a lever wired to a door/trap/teleporter/light actuates it; a pressure plate + timer
  builds a simple contraption, working in co-op.

---

# BOOK VII — FARMING, FISHING & LIFE-SIM (Stardew hybrid) — Phases 68–71

> Goal of the book: the calm, productive counter-loop to combat — crops, fishing, cooking, and
> critter collecting — tied to the day/season clock. A core hybrid differentiator.

### Phase 68 — Farming (crops, soil, growth)
- **Goal:** Tilled soil (hoe tool), plantable seeds, multi-stage crop growth gated by time/season/
  water/light, harvest yields + replant, herbs for alchemy, and Terraria-style plant blocks (herbs
  in clay pots).
- **Why:** Feeds potions/cooking and the Stardew loop; herbs were stubbed in Phase 30.
- **Prereqs:** 65 (tile growth), 61/63 (time/seasons), 64 (watering), 30 (herb consumers).
- **Touch/Create:** hoe tool + tilled-soil tile, seed items, crop tiles + growth stages in the world
  tick, planter boxes/clay pots, harvest → drops.
- **MP:** host ticks growth; planting/harvesting are edits + host-validated drops.
- **Done when:** the player tills soil, plants seeds, waters, and harvests crops that grew over
  day/season cycles.

### Phase 69 — Fishing
- **Goal:** Fishing rod + bobber physics, catch tables by liquid/biome/depth/time/weather, catch UI
  (bite → reel), crates + junk + quest fish, and the Angler NPC + daily fishing quests (Phase 59).
- **Why:** A whole relaxed activity + a major loot/potion source in Terraria.
- **Prereqs:** 36 (bobber as a projectile-ish entity), 64 (real liquid bodies), 62 (weather affects
  bite), 30 (fish → potions/cooking).
- **Touch/Create:** `systems/Fishing.ts`, fishing rod items, bobber entity, catch tables, crate loot.
- **MP:** the bite roll + catch is host-authoritative to prevent luck manipulation; document the
  trust model.
- **Done when:** fishing in different water yields biome/time-appropriate catches, crates, and quest
  fish.

### Phase 70 — Cooking & food buffs
- **Goal:** A cooking station + recipes turning crops/fish/meat into food that grants tiered
  well-fed/plenty/exquisite buffs; ingredient variety.
- **Why:** Closes the farming/fishing loop into a real combat benefit.
- **Prereqs:** 30 (consumables/buffs), 68/69 (ingredients), 41 (buffs).
- **Do:** cooking-pot station + food recipes + food buff tiers; drinks.
- **Done when:** cooking ingredients yields foods that grant meaningful timed buffs.

### Phase 71 — Critters, nets & terrariums
- **Goal:** Catchable critters (bunnies, birds, fireflies, worms, butterflies) via a bug net, usable
  as bait (fishing) or décor (terrariums/cages), plus glowing critters for light — a small collector
  loop.
- **Why:** Charm, bait economy for fishing, and ambient life.
- **Prereqs:** 43 (passive-critter enemies), 69 (bait).
- **Do:** bug-net tool, critter capture → item, cage/terrarium furniture, bait quality for fishing.
- **Done when:** the player can net critters, cage them as décor, and use them as fishing bait.

---

# BOOK VIII — AUTOMATION & INDUSTRY (Mindustry hybrid) — Phases 72–76

> Goal of the book: factory-style automation layered on the world — conveyors, machines, power, and
> logistics — so late-game bases can mine/smelt/craft/defend themselves. The second big hybrid
> differentiator. All host-authoritative.

### Phase 72 — Item transport: conveyors & item logistics
- **Goal:** Conveyor belts that carry item entities in a direction, junctions/routers, and
  insert/extract from chests/machines — the backbone of automation.
- **Why:** Transport is the substrate for every machine.
- **Prereqs:** 39 (item entities), 67 (a tile-device layer + tick), 28 (chests as endpoints).
- **Touch/Create:** conveyor tiles + a transport layer/tick in `systems/Automation.ts`, item-on-belt
  entities, chest/machine I/O ports.
- **MP:** host simulates transport; broadcasts belt item states (compactly / interest-managed).
- **Done when:** items placed on a belt travel and load into a chest; routers split flows.

### Phase 73 — Machines: drills, smelters, assemblers
- **Goal:** Automated machines: drills that mine adjacent ore over time, auto-smelters (ore→bar),
  assemblers/auto-crafters (recipe → output) fed by belts, all consuming power (Phase 74).
- **Why:** Turns crafting into a buildable factory.
- **Prereqs:** 72 (transport), 27 (recipes), 74 (power — build stubbed then wire).
- **Touch/Create:** machine tiles + machine logic in `systems/Automation.ts`, recipe binding for
  auto-crafters.
- **MP:** host-authoritative processing; broadcast machine states.
- **Done when:** a drill→belt→smelter→belt→chest line produces bars automatically.

### Phase 74 — Power networks
- **Goal:** A power system: generators (burner, solar tied to day, later reactors), power nodes/wires,
  consumption/storage (batteries), and machine power-gating.
- **Why:** Gives automation a resource cost + a build challenge (Mindustry's core tension).
- **Prereqs:** 67 (wire layer), 73 (consumers).
- **Touch/Create:** power graph in `systems/Automation.ts` (nodes/edges, generation/consumption/
  storage solve per tick), generator/battery tiles.
- **MP:** host solves the power graph; broadcasts node states for rendering.
- **Done when:** machines only run when powered; a generator + battery network sustains a factory.

### Phase 75 — Logistics & full factory loop
- **Goal:** Sorters/filters, storage networks/logistic chests, overflow/underflow control, and a
  complete "dig → transport → smelt → craft → store" automated loop with a factory-status view.
- **Why:** Completes the automation fantasy.
- **Prereqs:** 72–74.
- **Do:** sorters route by item type; logistic/storage links; a debug overlay for flows; balance
  throughput vs power.
- **Done when:** a self-running factory can produce mid-tier gear from raw resources with no manual
  input.

### Phase 76 — Turrets & automated defense (tower-defense flavor)
- **Goal:** Buildable turrets (powered, ammo-fed) that auto-target enemies — especially valuable
  during invasions/events — bridging automation with combat.
- **Why:** Makes bases defensible in co-op events and unifies the hybrid systems.
- **Prereqs:** 36 (projectiles), 74 (power), 53 (events to defend against).
- **Touch/Create:** turret tiles + targeting logic in `systems/Automation.ts` firing host-authoritative
  projectiles.
- **MP:** host runs turret targeting/firing.
- **Done when:** powered, ammo-fed turrets defend a base during a Goblin Army/Blood Moon in co-op.

---

# BOOK IX — PRESENTATION, AUDIO & JUICE (make it FEEL better than Terraria) — Phases 77–86

> Goal of the book: the sensory layer. Audio (entirely absent today), smooth colored lighting,
> particle/VFX overhaul, sky/background overhaul, screen effects, and a full graphical UI + map.
> This book, together with combat juice (Phase 40) and animation (Phase 42), is where the game
> visibly and audibly surpasses Terraria. **All audio is WebAudio, procedural or tiny inline samples
> — CSP-safe, no remote URLs.**

### Phase 77 — Audio engine
- **Goal:** A WebAudio-based sound engine: a master mixer with buses (SFX/music/ambient), volume
  settings, positional/volume-by-distance playback, voice pooling/limiting, and a small procedural
  synth for effect generation — the foundation for all sound.
- **Why:** The game is **completely silent**. Audio is possibly the single biggest "feels
  professional" gap.
- **Prereqs:** none (independent); integrates with events across all books.
- **Touch/Create:** new `systems/Audio.ts` (AudioContext graph, buses, `play(sfxId, {pos, pitch,
  gain})`, unlock-on-first-gesture), settings hook.
- **Do:** init AudioContext on first user gesture (browser policy); buses + master; distance/pan from
  world pos vs camera; voice cap; a tiny procedural tone/noise generator for synthesized SFX.
- **Done when:** a test sound plays positionally with working volume controls; silent until the
  player interacts (autoplay-policy safe).

### Phase 78 — SFX content & hookup
- **Goal:** A full SFX set wired to game events: mining/placing (per material), footsteps (per
  surface), jump/land, hurt/death (player+enemy), swing/hit/crit, projectile fire/impact, pickup,
  UI clicks, door/chest, liquid splash, ambient loops (cave drips, wind, lava rumble).
- **Why:** Sound makes every action feel responsive.
- **Prereqs:** 77; hooks into combat/mining/UI/liquids across earlier phases.
- **Touch/Create:** an SFX registry (procedural params or tiny base64 samples) + `Audio.play` calls
  at each event site; footstep/material mapping via tile `soundGroup` (Phase 1).
- **MP:** each client plays its own SFX from local + replicated events.
- **Done when:** mining, walking, jumping, fighting, and UI all sound distinct and satisfying.

### Phase 79 — Adaptive music
- **Goal:** A layered/adaptive music system: tracks per context (day/night/underground/biome/boss/
  event), smooth crossfades, and boss/event stingers — CSP-safe (procedural generative music and/or
  compact loops).
- **Why:** Music is core to atmosphere and identity; Terraria's soundtrack is iconic — match the
  *dynamic* behavior and exceed adaptivity.
- **Prereqs:** 77, 61 (time), 48/53 (boss/event triggers).
- **Touch/Create:** `systems/Music.ts` (track selection by context, crossfade, stinger queue); if
  fully procedural, a small generative music module (scales/patterns per biome mood).
- **Done when:** music shifts smoothly by biome/time and swells for bosses/events.

### Phase 80 — Lighting overhaul (smooth, colored, day/night-integrated)
- **Goal:** Upgrade lighting from blocky per-tile to **smooth sub-tile** light with **colored**
  sources, gradual falloff, torch flicker, bloom on bright emitters, and full day/night ambient
  integration.
- **Why:** Lighting is one of the most-seen systems; smooth colored light is a giant visual leap.
  Keep propagation integer (a fractional value previously caused an infinite-requeue crash — see
  [systems/Lighting.ts](src/systems/Lighting.ts)).
- **Prereqs:** 61 (ambient by time). Builds on [systems/Lighting.ts](src/systems/Lighting.ts).
- **Touch/Create:** [systems/Lighting.ts](src/systems/Lighting.ts) (colored channels already RGB;
  add smoothing/interpolation), [engine/Renderer.ts](src/engine/Renderer.ts) (bilinear lightmap
  upsample instead of hard tiles; additive bloom pass for emitters), torch flicker.
- **Do:** render the lightmap at tile resolution but **sample it bilinearly** per pixel/quad for
  smooth gradients; colored emitters tint; emitters get a soft additive bloom; torches flicker
  subtly; integrate day/night ambient color. Keep it within the 60fps budget (viewport-bounded).
- **Done when:** caves glow smoothly, torches cast soft colored pools with gentle flicker, and the
  surface tints with the day/night sky.

### Phase 81 — Particle & VFX overhaul
- **Goal:** A rich particle system beyond ambient dust: tile-break shards (tinted per material),
  footstep/landing dust, gore/blood, magic sparkles, weather precipitation, liquid splashes/ripples,
  torch embers, explosion smoke/fire, boss telegraph VFX — pooled and cheap.
- **Why:** Particles sell impact and life; current particles are just ambient motes.
- **Prereqs:** [render/Particles.ts](src/render/Particles.ts) exists; combat juice (40) started it.
- **Touch/Create:** extend [render/Particles.ts](src/render/Particles.ts) with an emitter/preset
  system + pooling; call sites at break/land/hit/cast/splash/explosion.
- **Done when:** every meaningful action emits fitting particles without fps cost.

### Phase 82 — Sky & background overhaul
- **Goal:** A layered, biome-aware background: gradient sky by time/weather, sun/moon/stars, drifting
  clouds, distant parallax mountains/trees per biome, and distinct underground/cavern/hell backdrops
  — deeper than the current 2-layer parallax.
- **Why:** Backgrounds set mood and depth; a big "looks better" lever.
- **Prereqs:** 61 (time), 62 (weather), 63 (season tint). Builds on
  [render/Parallax.ts](src/render/Parallax.ts).
- **Touch/Create:** [render/Parallax.ts](src/render/Parallax.ts) + a `render/Sky.ts` (sky gradient,
  celestial bodies, clouds, stars), per-biome background layer sets, underground/hell backdrops.
- **Done when:** each biome + time + weather has a distinct, layered, moving backdrop.

### Phase 83 — Screen effects
- **Goal:** Full-screen post effects: shake (combat/explosions), hit flash, low-HP vignette + pulse,
  underwater blur/tint, lava heat-haze tint, biome color grading, boss-intro letterbox/zoom, damage
  direction indicator.
- **Why:** Screen feedback amplifies every moment; ties the juice together.
- **Prereqs:** 40 (shake/flash started), 80 (lighting), 82 (sky).
- **Touch/Create:** a post-effect layer in [engine/Renderer.ts](src/engine/Renderer.ts) (Canvas2D
  composite passes + [engine/Camera.ts](src/engine/Camera.ts) shake).
- **Done when:** taking damage, diving underwater, entering lava, and fighting bosses each have a
  clear screen response.

### Phase 84 — Full HUD & UI overhaul
- **Goal:** Replace the text-blob HUD with a graphical, themed UI: heart/mana rows (or bars) with
  animation, buff/debuff bar, hotbar with icons/hotkeys/selection glow, coin wallet, boss/event bars,
  wired settings menu, consistent pixel-art UI theme + fonts, and controller/touch layouts.
- **Why:** The HUD is currently a monospace text dump ([engine/Game.ts](src/engine/Game.ts)
  `updateHud`); UI polish is central to "looks/feels better."
- **Prereqs:** 21/29 (item UI), 31 (stats), 41 (buffs), 48/53 (boss/event bars).
- **Touch/Create:** a UI framework pass across [ui/](src/ui/) (`ui/HUD.ts`, theme CSS/canvas),
  replace `updateHud`; settings menu ([ui/Menu.ts](src/ui/Menu.ts)) with audio/video/control options.
- **Done when:** the HUD is a polished graphical interface (hearts/mana/buffs/hotbar/wallet/boss bar)
  with a settings menu — no raw text blob.

### Phase 85 — Minimap & world map
- **Goal:** A live minimap corner + a full-screen explored map (fog-of-war reveal as you explore),
  with markers (spawn, NPCs, bosses, pylons, player pings in co-op) and pylon fast-travel from the
  map.
- **Why:** Navigation in an infinite world is essential; a differentiator done well.
- **Prereqs:** 20 (persist discovered map), 58 (pylons), 55 (NPC markers).
- **Touch/Create:** `systems/MapData.ts` (per-world discovered tile cache, downsampled) + `ui/Map.ts`
  (minimap + fullscreen), marker registry.
- **MP:** each player has their own explored map; co-op player pings sync.
- **Done when:** exploring reveals the map, the minimap tracks position + markers, and pylon travel
  works from the map.

### Phase 86 — Character render polish & dyes
- **Goal:** Final character presentation: layered armor/vanity rendering with dyes, held-item glow,
  wings/accessory visuals, hair/skin/clothing customization at creation + Stylist, and remote-player
  nameplates/emotes.
- **Why:** Ties equipment (Book III) to a customizable, expressive avatar — the co-op face of the
  game.
- **Prereqs:** 42 (rig), 32/33 (armor), 84 (UI).
- **Touch/Create:** `render/PlayerSprite.ts` (dye/layer system), character-creation UI, emote wheel.
- **Done when:** players look distinct + customizable, wear visible dyed armor + accessories, and can
  emote in co-op.

---

# BOOK X — MULTIPLAYER HARDENING — Phases 87–94

> Every prior system was built host-authoritative from the start (the binding rule). This book turns
> that into a **robust** networking layer: a real replication framework, reconciliation, interest
> management, robustness/reconnection, and social features — so co-op is not just present but *good*.
> Verify this book on **GitHub Pages** (WebRTC is blocked in the Artifact).

### Phase 87 — Replication framework & interest management
- **Goal:** Generalize the ad-hoc `broadcast`/snapshot code into an **entity replication framework**:
  a registry of networked entity types, per-entity delta snapshots, interest management (only
  replicate entities in a peer's loaded region), and bandwidth-aware tick rates.
- **Why:** The current netcode ([engine/Game.ts](src/engine/Game.ts) `handleNet`,
  [net/Protocol.ts](src/net/Protocol.ts)) hand-syncs players + creatures; dozens of new entity types
  (projectiles, drops, NPCs, minions, bosses, belt items) need a scalable pattern.
- **Prereqs:** all entity systems exist; refactors, doesn't rebuild, [net/](src/net/).
- **Touch/Create:** `net/Replication.ts` (entity replication registry + delta encode/decode),
  refactor `Game.handleNet`/snapshots to use it, [net/Protocol.ts](src/net/Protocol.ts) (versioned,
  compact binary-ish encoding).
- **Do:** register each networked entity type with (serialize, deserialize, interpolate); host sends
  per-peer only entities in that peer's interest region; delta-compress; tune per-type rates.
- **Done when:** all entity types replicate through one framework; bandwidth scales with visible
  entities, not world size; existing co-op still works on Pages.

### Phase 88 — Networked combat, projectiles & hit reconciliation
- **Goal:** Robust networked combat: client fire/swing = intent → host spawns/validates → broadcasts;
  local prediction for the shooter's own projectile visuals; server-reconciled hits + damage; lag
  compensation for melee/hitscan.
- **Why:** Combat must feel responsive without desync or cheating in co-op.
- **Prereqs:** 35/36/48, 87.
- **Do:** intent messages for swing/fire/use; host is authoritative on spawn + damage; clients
  predict their own muzzle/swing then reconcile; simple lag comp (rewind target positions a little
  for hit checks).
- **Done when:** two players fighting the same enemies see consistent damage/HP/deaths with
  responsive local feedback.

### Phase 89 — Networked enemies, bosses & events
- **Goal:** Full replication of the enemy/boss/event layer: host simulates all AI + boss phases +
  event waves; clients render synced snapshots + HP bars + event progress; co-op boss HP scaling.
- **Why:** Bosses/events are the co-op highlight; they must be flawless across peers.
- **Prereqs:** 48/53, 87, 88.
- **Done when:** a boss fight or Goblin Army with 2+ players is fully synced (positions, phases, HP,
  drops, defeat flags).

### Phase 90 — Networked inventory, chests, crafting & the trust model
- **Goal:** Decide and implement the co-op item trust model: host-validated container/craft/trade
  operations to prevent dupes on shared chests, while keeping personal inventory responsive; item
  drops already host-authoritative (Phase 39).
- **Why:** Shared storage + trading is where co-op economies dupe/break; nail it down.
- **Prereqs:** 28 (chests), 25 (crafting), 39 (drops), 87.
- **Do:** shared containers are host-authoritative (`containerSync` acks); crafting from personal
  inventory stays client-side (friends-trust), but any shared-resource craft goes through host;
  optional player-to-player trade UI with host escrow.
- **Done when:** two players sharing chests cannot dupe items; trades are safe.

### Phase 91 — Networked world simulation
- **Goal:** Ensure all world-sim systems (time, weather, seasons, liquids, tile growth, fire, wiring,
  automation, biome spread) run host-only and replicate compactly — no client-side sim drift.
- **Why:** The world must be identical for everyone; client sim = desync.
- **Prereqs:** Books VI + VIII, 87.
- **Do:** audit every `WorldTick`/`Automation`/`LiquidSim`/`Weather`/`Time` writer to confirm
  host-only + batched-delta replication; add interest-managed liquid/belt updates.
- **Done when:** all dynamic world state is host-driven and consistent across peers with bounded
  bandwidth.

### Phase 92 — Join/leave robustness, state transfer & reconnection
- **Goal:** Rock-solid session lifecycle: full world+entity state transfer on join (beyond the
  current seed+deltas welcome), mid-session join, graceful leave, reconnection after a drop, and a
  host-migration strategy (or a clear "host leaves = session ends, world saved").
- **Why:** The current welcome only sends seed + deltas; a live session has entities, time, events,
  and NPC state a joiner needs.
- **Prereqs:** 20 (save/serialize), 87.
- **Touch/Create:** extend the welcome/handshake ([net/Net.ts](src/net/Net.ts),
  [net/Protocol.ts](src/net/Protocol.ts)) to transfer full world state (deltas + chests + flags +
  time + weather + active entities), reconnection tokens.
- **Done when:** a friend can join mid-session and see the exact live world; a dropped player can
  rejoin; a leaving host saves the world.

### Phase 93 — Latency handling: interpolation, prediction, lag comp
- **Goal:** Smooth remote motion (entity interpolation — already partial for players), local-player
  prediction (already local), and lag compensation for hit registration; a netgraph/ping debug.
- **Why:** Feel across real-world latency; polish the co-op experience.
- **Prereqs:** 87, 88.
- **Do:** interpolation buffers for all replicated entities; jitter buffering; a small netgraph
  overlay; tune send rates.
- **Done when:** co-op feels smooth at typical WebRTC latencies; a netgraph confirms healthy sync.

### Phase 94 — Social layer: identity, chat, emotes, lobby
- **Goal:** The social wrapper: persistent friend codes, in-game text chat, emote wheel, player
  nameplates, a lobby/invite flow, and player list — making sessions with friends easy to start and
  fun to be in.
- **Why:** The game's stated purpose is playing with friends; the social UX matters as much as the
  netcode.
- **Prereqs:** 86 (emotes), 84 (UI), existing profile/menu ([Profile.ts](src/Profile.ts),
  [ui/Menu.ts](src/ui/Menu.ts), [net/Net.ts](src/net/Net.ts) join-by-code).
- **Do:** chat overlay, emote wheel, nameplates, player list, invite/lobby polish on the existing
  join-by-code system.
- **Done when:** starting/joining a session with friends is easy, and chat/emotes/nameplates work.

---

# BOOK XI — PERSISTENCE, SCALE, HARDMODE & POLISH — Phases 95–103

> Goal of the book: complete the game's back half (Hardmode + mechanical bosses + more biomes),
> harden persistence and performance, and add the meta layer (bestiary/achievements/options) that a
> shipped, better-than-Terraria game needs.

### Phase 95 — Full save/character system
- **Goal:** Complete, robust saves: multiple worlds + multiple characters (Terraria-style separation),
  autosave + manual save, export/import (JSON/blob), save-version migration, and cloud-free local
  durability.
- **Why:** Phase 20 established world saves; this completes characters, migration, and portability.
- **Prereqs:** 20, 31/32 (character data).
- **Touch/Create:** extend `systems/Save.ts` (character store, versioning/migration, export/import),
  [ui/Menu.ts](src/ui/Menu.ts) (character + world selectors).
- **Done when:** any character can enter any world; saves survive schema changes; export/import works.

### Phase 96 — Hardmode: world conversion & new tiers
- **Goal:** The real Hardmode from Phase 52's trigger: world conversion (Hallow + evil biome stripes
  spread across the world), hardmode ores appear (from broken altars, Phase 7), new hardmode enemies,
  and the next armor/tool/weapon tiers (cobalt→mythril→adamantite→…).
- **Why:** The entire second half of Terraria's content; the biggest single scale-up.
- **Prereqs:** 52 (trigger), 7 (altars/hallow tiles), 17 (spread), 4 (reserved hardmode ore ids),
  27/33 (gear chains to extend).
- **Do:** on Hardmode start, host performs the world conversion (V-of-Hallow+evil, seeded), enables
  hardmode ore generation on altar-break, adds hardmode enemy pools + spawn changes, and the new gear
  tiers/recipes.
- **MP:** conversion is host-authoritative (big batched edits + flags, saved).
- **Done when:** beating WoF visibly transforms the world and unlocks the hardmode progression tier.

### Phase 97 — Mechanical & late bosses
- **Goal:** The hardmode boss ladder using the boss framework: mechanical bosses (twins/destroyer/
  prime analogues), a Plantera-analogue gating the post-Plantera dungeon, a Golem-analogue in a
  jungle temple, and a final endgame boss — each dropping the next tier.
- **Why:** Hardmode progression + endgame goals.
- **Prereqs:** 48/89 (boss framework + net), 96 (hardmode).
- **Data:** ~5–8 late bosses with attack scripts, arenas, drops, and summon items.
- **Done when:** a full hardmode boss progression exists, co-op-synced, with tiered rewards.

### Phase 98 — Biome & content breadth (the 4D biome matrix + more)
- **Goal:** Broaden the world per roadmap "C": a larger biome set via a 4D climate matrix (add a
  "weirdness"/humidity-variance axis), mushroom biome surface, Hallow biome, more micro-biomes, and
  more structures/enemies/loot to fill the world's variety ceiling above Terraria's.
- **Why:** "Better than Terraria" includes *more* to discover.
- **Prereqs:** Book I, 96 (hallow).
- **Do:** extend [world/Biome.ts](src/world/Biome.ts) climate selection to 4 axes; add biomes +
  their tiles/enemies/structures/loot; keep placement coherent + deterministic.
- **Done when:** the world has noticeably more distinct biomes + set-pieces than Terraria, coherently
  placed.

### Phase 99 — Balance, difficulty modes & progression pass
- **Goal:** A holistic balance pass: tune HP/damage/defense/spawn/loot curves across the whole
  progression; add difficulty modes (normal/expert/master — expert AI + loot); enrage/cheese-guards
  on bosses; economy tuning.
- **Why:** Content without a tuned curve feels flat; difficulty modes add replay.
- **Prereqs:** most content books.
- **Touch/Create:** centralize balance constants in `config.ts` / a `data/balance.ts`; per-mode
  multipliers.
- **Done when:** the game has a smooth difficulty curve and selectable difficulty modes.

### Phase 100 — Bestiary, achievements & in-game guide
- **Goal:** The meta layer: a bestiary (enemies/bosses encountered + drops), achievements, an item
  catalog, and an in-game guide/tips system (the Guide NPC hint engine, plus tooltips for mechanics).
- **Why:** Discovery aids + goals + long-tail engagement; helps new players and co-op groups.
- **Prereqs:** 43/47 (enemy data), 21 (items), 55 (Guide).
- **Touch/Create:** `systems/Bestiary.ts` + `systems/Achievements.ts` + `ui/Bestiary.ts`/`ui/Guide.ts`.
- **Done when:** encountering enemies/items fills a bestiary/catalog and achievements unlock with
  notifications.

### Phase 101 — Performance & scale (the 60fps-everywhere pass)
- **Goal:** Systematic performance: cached/offscreen chunk canvases (stop per-tile-per-frame draws),
  Web-Worker world generation + lighting, object pooling everywhere, memory budgeting, and profiling
  under heavy scenes (bosses/events/factories) — hold 60fps on modest hardware + mobile.
- **Why:** The renderer draws per-tile each frame and lighting recomputes over the viewport; big
  scenes + all the new systems need headroom. Memory noted "direct per-tile rendering (no cached
  ChunkRenderer)" as a deliberate simplicity choice — revisit now.
- **Prereqs:** most systems (optimize what exists).
- **Touch/Create:** a cached chunk renderer (offscreen canvas per chunk, redraw on dirty),
  Web-Worker for `WorldGen`/`Lighting` (careful: keep determinism), pooling audit, perf overlay.
- **Done when:** heavy scenes hold ~60fps; worldgen/lighting off the main thread; memory stays flat
  while streaming.

### Phase 102 — Controls, input & accessibility
- **Goal:** Full input + accessibility: rebindable keys, gamepad support, refined touch controls
  (virtual stick + buttons) for mobile, colorblind-safe options, UI scaling, screen-shake/flash
  toggles, and a language/i18n scaffold.
- **Why:** Broadens the audience and is table-stakes for a polished release; the game currently has
  fixed keyboard/mouse only.
- **Prereqs:** 84 (settings menu), 29 (touch scaffolding).
- **Touch/Create:** [engine/Input.ts](src/engine/Input.ts) (rebind + gamepad + touch), settings UI,
  i18n string table.
- **Done when:** the game is playable with keyboard/mouse, gamepad, and touch, with remappable
  controls + accessibility options.

### Phase 103 — QA, deterministic tests & release pipeline
- **Goal:** Confidence to ship: headless Node tests for pure systems (worldgen determinism, loot
  rolls, recipe resolution, damage math, save round-trips), a smoke-test build check, and a clean
  deploy pipeline for both the Artifact and GitHub Pages, with versioning + changelog.
- **Why:** Locks in correctness/determinism as the codebase gets large and protects the invariants.
- **Prereqs:** everything; formalizes the per-phase testing already required.
- **Touch/Create:** `scripts/test-*.mjs` (determinism/loot/recipe/damage/save), a CI check,
  version + changelog.
- **Done when:** `npm test`-style scripts pass, and both deploy targets build cleanly from a single
  command.

---

# BOOK XII — BEYOND TERRARIA (the differentiators) — Phases 104–110

> Goal of the book: the reasons a player picks this over Terraria. These lean into the hybrid
> identity + co-op + the seamless infinite world — the things Terraria structurally *can't* do.

### Phase 104 — Truly seamless infinite world identity
- **Goal:** Lean into the engine's core advantage (unbounded both axes, no world size cap): "the sky
  really goes to space, the underworld really goes forever," deterministic far-flung wonder biomes,
  and long-haul expeditions with waypoints — framed as a headline feature Terraria lacks.
- **Prereqs:** Book I, 85 (map/waypoints), 20 (persistence).
- **Done when:** the infinite world is a celebrated, navigable feature (deep-space + deep-hell
  content, waypoint travel), not just a technical fact.

### Phase 105 — Deep automation × survival fusion
- **Goal:** Make the Mindustry automation layer (Book VIII) a first-class endgame that Terraria has
  no equivalent to: fully automated resource → gear → defense chains, factory blueprints, and
  automation-gated late content.
- **Prereqs:** Book VIII, 97 (late content to automate toward).
- **Done when:** automation is a compelling, deep endgame pillar, not a gimmick.

### Phase 106 — Farming/seasons life-sim depth
- **Goal:** Grow the Stardew hybrid (Book VII) into a real parallel progression: greenhouses,
  animals/ranching, artisan goods, a seasonal festival/event, and NPC relationships — a calm pillar
  alongside combat.
- **Prereqs:** Book VII, 63 (seasons), 55–59 (NPCs/quests).
- **Done when:** a player can meaningfully progress via farming/life-sim, not only combat.

### Phase 107 — Superior building & creativity tools
- **Goal:** Beat Terraria on building: smart block placement, copy/paste/blueprint tools, symmetry,
  more furniture/decor/paint, in-world signs, and shareable builds — great creative + co-op building.
- **Prereqs:** 21/26 (items/furniture), 90 (co-op safety), 20 (persistence for blueprints).
- **Done when:** building is faster and more expressive than Terraria, especially in co-op.

### Phase 108 — Co-op-first content
- **Goal:** Content designed *for* groups: scaling dungeons/events, shared objectives, roles
  (someone farms/automates/fights), co-op bosses tuned for teams, and drop-in/out friend sessions —
  making this the better couch/online co-op sandbox.
- **Prereqs:** Book X, 89 (net bosses/events).
- **Done when:** playing with friends is clearly better here than in Terraria.

### Phase 109 — Modding / data-driven content hooks
- **Goal:** Expose the registries (tiles/items/recipes/enemies/loot/biomes) as data so content can be
  added/shared without touching engine code — a growth engine Terraria only has via tModLoader.
- **Prereqs:** all registries (built data-driven throughout).
- **Done when:** new blocks/items/recipes/enemies can be added via data definitions alone.

### Phase 110 — Endgame, "the last update" & living-world features
- **Goal:** The long tail: post-endgame challenges, an infinite-scaling deep-descent mode, seasonal
  live events, and a final polish/marketing-quality pass across audio/visual/feel — the sign-off that
  the game is, holistically, better than Terraria.
- **Prereqs:** everything.
- **Done when:** a fresh player, and a group of friends, would choose this over Terraria on looks,
  feel, content, and co-op — the north star is met.

---

## VERIFICATION — how to prove each phase (and the whole game) works

Because there is **no browser automation** here, verification is a layered discipline:

1. **Typecheck** — `npm run typecheck` must be clean after every phase.
2. **Headless logic tests** (`scripts/*.mjs`, run with Node) for anything pure or rule-based:
   - Worldgen **determinism**: same seed+coords → identical tiles across two runs (and simulate two
     "peers").
   - Loot/recipe/damage/spawn math: given inputs → expected distributions/outputs.
   - Save **round-trip**: serialize → deserialize → deep-equal.
   - Net protocol encode/decode round-trips + `protocolVersion` mismatch handling.
   Add to these each phase; they are the regression safety net as the codebase grows.
3. **Artifact build + play** — `npm run build:artifact`, redeploy the Artifact (same URL), and the
   owner plays the new feature. This is the primary check for anything visual/interactive
   (single-player). Give the owner a short "try this" list each phase.
4. **GitHub Pages** — for **multiplayer** verification (WebRTC is blocked in the Artifact), the owner
   (or the agent, if git auth is set up) deploys to Pages and two clients test co-op. Every MP-touching
   phase must be smoke-tested with 2 peers on Pages.
5. **Performance** — keep an fps overlay on; heavy phases (liquids, factories, bosses, events)
   include an explicit "held ~60fps with N entities" check.

**Global regression checklist (run mentally every phase):** world still streams; mining/placing
works; lighting renders; existing co-op connects; the Artifact boots; no console errors; determinism
intact; 60fps.

---

## HOW TO EXECUTE & REPORT PROGRESS (for the executing agent)

- **On approval of this plan, first copy it into the repo** as `C:\Users\tapsa\fuckerie 2d\MASTERPLAN.md`
  and create `C:\Users\tapsa\fuckerie 2d\PROGRESS.md` seeded with the phase checklist (☐ per phase,
  grouped by book). These are the executing agent's working documents.
- **Work strictly top-to-bottom.** Before each phase: re-read the phase, read the exact files it
  names, and check its prereqs are ☑. After each phase: run the Definition of Done, redeploy, tick
  `PROGRESS.md`, update the project memory, and tell the owner what to try.
- **Never batch across the deploy boundary** unless the owner says "do the next N phases without
  stopping." Default is: finish a phase, deploy, hand off for a playtest.
- **If reality diverges from the plan** (a phase is bigger than expected, an earlier assumption was
  wrong, a better ordering appears): note it in `PROGRESS.md`, keep the invariants, and — if the
  change is expensive or user-facing — ask the owner before deviating. Do **not** silently skip
  content; the whole point is to go through every phase until the game surpasses Terraria.
- **Keep the memory file updated** (`fuckerie-2d-project.md`) so a future session can resume mid-plan
  without re-deriving everything.

## Files this plan will create (new modules), for orientation
`world/Loot.ts`, `systems/WorldTick.ts`, `systems/Save.ts`, `systems/Crafting.ts`, `ui/CraftingUI.ts`,
`systems/Combat.ts`, `entities/Projectile.ts`, `systems/ProjectileManager.ts`, `entities/Minion.ts`
(or `systems/MinionManager.ts`), `entities/ItemDrop.ts`, `systems/DropManager.ts`, `systems/Buffs.ts`,
`render/PlayerSprite.ts`, `render/DamageText.ts`, `entities/enemies/EnemyRegistry.ts`,
`entities/enemies/ai/*`, `systems/SpawnDirector.ts`, `entities/bosses/Boss.ts`, `systems/BossManager.ts`,
`systems/EventManager.ts`, `entities/NPC.ts`, `systems/TownManager.ts`, `ui/HousingUI.ts`, `ui/ShopUI.ts`,
`systems/Quests.ts`, `ui/QuestUI.ts`, `systems/Time.ts`, `systems/Weather.ts`, `systems/Explosions.ts`,
`systems/Wiring.ts`, `systems/Fishing.ts`, `systems/Automation.ts`, `systems/Audio.ts`, `systems/Music.ts`,
`render/Sky.ts`, `ui/HUD.ts`, `systems/MapData.ts`, `ui/Map.ts`, `net/Replication.ts`, `systems/Bestiary.ts`,
`systems/Achievements.ts`, `ui/DebugPanel.ts`. (Plus heavy extensions to existing files.)

---

*End of MASTERPLAN. 110 phases across 12 books. Execute in order; keep the invariants; deploy and
playtest each phase; do not stop until a fresh player and a group of friends would pick this over
Terraria on looks, feel, content, and co-op.*
