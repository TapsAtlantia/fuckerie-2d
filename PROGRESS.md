# PROGRESS — MASTERPLAN execution tracker

Execute `MASTERPLAN.md` **top to bottom, one phase at a time.** After each phase: typecheck clean →
headless logic tests (where applicable) → `npm run build:artifact` → redeploy the Artifact (same URL)
→ run the phase's Definition of Done → tick the box below → update the project memory → tell the owner
what to try. Do **not** batch across the deploy boundary unless the owner says so.

**Legend:** ☐ not started · ◐ in progress · ☑ done · ⤷ note/deferred

**Invariants (never break):** deterministic worldgen (pure fn of seed+coords, no `Math.random` in
gen) · self-contained/CSP-safe (no CDN, inline assets, WebAudio only) · multiplayer host-authoritative
· 60 fps · no regression to streaming/mining/placing/lighting/co-op · tunables in `config.ts` · tile
ids append-only.

---

## Book I — World & Structure Generation
- ☑ 0.5. Adaptive chunks & pre-generation — deployed; chunk **preloader** (view+margin ensured synchronously, larger ring filled in background under a time budget → no streaming hitches, instant teleport); **absolute-coordinate edit deltas** (protocol v3, size-independent → co-op/persistence safe); **variable-size chunks** (32 sky / 64 elsewhere; framework supports more but 128 = ~20ms/chunk so >64 needs Web-Worker gen — deferred). Verified via `scripts/phase05-check.ts`; full suite green.
- ☑ 1. Tile-system foundation & 16-bit tiles (Uint16 fg/bg, tile metadata, protocolVersion) — deployed; verified via `scripts/phase1-check.ts`
- ☑ 2. Background wall system overhaul (distinct walls + wall autotiling + natural wall gen) — deployed; 12 wall tiles, natural gen (caves keep walls, sky none), recessed edge shading, `isEnclosed` helper; verified via `scripts/phase2-check.ts`
- ☑ 3. Surface landform realism & deterministic rivers — deployed; plateau/mesa quantization (flat tops + cliffs), pure-fn-of-x rivers (riverCarve + unified waterTopAt fill), shore beaches; relief 291t, 101 streams, 7.9% wet (no flood); verified via `scripts/phase3-check.ts`
- ☑ 4. Ore & vein rework (tiered, depth-gated, hardmode ids reserved) — deployed; copper/tin→iron/lead→silver/tungsten→gold/platinum depth tiers, region alt-metals, coal + 6 gems in deep pockets, coherent lobed vein blobs (~17t), 6 hardmode ore ids reserved; verified via `scripts/phase4-check.ts`
- ☑ 5. Cave-system deep rework (spaghetti + cheese + caverns) — deployed; smooth 2-oct warped spaghetti tunnels + low-freq cheese caverns, quadratic depth-relax (surface solid ~10% → caverns ~43%), connected network (87% air in caves≥25t), rare steep-mountainside cave mouths re-added; verified via `scripts/phase5-check.ts`
- ☑ 6. Underground biomes (jungle/ice/desert/marble/granite/glowing-mushroom) — deployed; `undergroundBiomeAt` inherits from surface biome (jungle→mud+grass+vines, snow→ice, desert→sandstone) + marble/granite region pockets + rare glowing-mushroom biome (emits light) + deep crystal/underworld; grass grows on exposed mud faces; verified via `scripts/phase6-check.ts`
- ☑ 7. Evil biomes: Corruption & Crimson (+ reserve Hallow) — deployed; seed picks one evil (corruption OR crimson), occasional surface bands with descending chasms, ebonstone/crimstone underground, lattice altars + shadow orbs/crimson hearts; the other evil's ids exist but never generate; Hallow ids reserved; verified via `scripts/phase7-check.ts`
- ☑ 8. The Dungeon (large multi-chunk structure + locked loot + boss gate) — deployed; world-anchored ~150×430 room-grid maze near spawn (blue/green/pink brick + bg walls, doorway-connected rooms, locked gold chests, spikes, cobwebs), boss-gated entrance door (locked until Skeletron/Phase 51); pure-fn-of-coords so seamless across 84 chunks + identical per peer; verified via `scripts/phase8-check.ts`
- ☐ 9. The Underworld / Hell (lava seas, hellstone, ruined houses, hellforge)
- ☐ 10. Sky / floating islands with loot
- ☐ 11. Oceans, beaches & underwater caves
- ☐ 12. River/lake/aquifer integration & water polish
- ☐ 13. Prefab structure library & authoring pipeline (big expansion)
- ☐ 14. Chests, loot tables & pots
- ☐ 15. Life crystals, mana crystals, altars, shrines, gems
- ☐ 16. Micro-biomes & set-pieces (spider caves, bee hives, living trees…)
- ☐ 17. Biome spread & world evolution (world tick, host-authoritative)
- ☐ 18. Spawn region, guaranteed early structures & world identity
- ☐ 19. Worldgen debug & seed-tuning panel
- ☐ 20. World persistence (IndexedDB save/load)

## Book II — Items, Materials & Crafting
- ☐ 21. Item model overhaul & registry (classes/rarity/stats/tooltips/icons)
- ☐ 22. Tools (pickaxe/axe/hammer tiers) & tool-gated mining
- ☐ 23. Coins & the money system
- ☐ 24. Materials, bars & monster/material drops
- ☐ 25. Crafting system & recipe engine
- ☐ 26. Crafting stations & proximity
- ☐ 27. Smelting & the ore→bar→gear chain
- ☐ 28. Storage: chests, banks & the container UI
- ☐ 29. Inventory UX overhaul
- ☐ 30. Consumables & potions (alchemy)

## Book III — Player, Combat & Equipment
- ☐ 31. Player stats & attributes (HP tiers/mana/defense/damage classes/crit)
- ☐ 32. Equipment slots, armor/accessory framework & set bonuses
- ☐ 33. Armor content (pre-hardmode sets)
- ☐ 34. Accessories & movement kit (grappling hook, wings, boots)
- ☐ 35. Melee weapons & the swing system
- ☐ 36. Ranged weapons, ammo & the projectile engine (shared)
- ☐ 37. Magic weapons & mana
- ☐ 38. Summoner class: minions & sentries
- ☐ 39. Item drops as world entities (loot pickup)
- ☐ 40. Combat feel & juice (damage numbers, hit-stop, shake, gore)
- ☐ 41. Buffs & debuffs (status effects)
- ☐ 42. Player animation, held items & armor rendering

## Book IV — Enemies, Bosses & Events
- ☐ 43. Enemy framework (data-driven registry)
- ☐ 44. AI behavior library
- ☐ 45. Spawn director
- ☐ 46. Enemy content wave 1 (pre-boss roster)
- ☐ 47. Loot & drop tables (enemies)
- ☐ 48. Boss framework
- ☐ 49. Boss 1: the Eye (first boss)
- ☐ 50. Boss 2: the Devourer / Brain (evil-biome boss)
- ☐ 51. Boss 3: Skeletron (dungeon guardian) & dungeon unlock
- ☐ 52. Boss 4: Wall of Flesh → Hardmode trigger
- ☐ 53. World events (Blood Moon, Goblin Army, Eclipse, invasions)
- ☐ 54. Meteors & dynamic world events

## Book V — NPCs, Town & Economy
- ☐ 55. NPC framework & housing
- ☐ 56. NPC roster & move-in conditions
- ☐ 57. Shops & the coin economy
- ☐ 58. Happiness, biome preferences & pylons
- ☐ 59. Quests & the bulletin board
- ☐ 60. Player home base tools (bed/spawn, flags, respawn)

## Book VI — World Simulation & Time
- ☐ 61. Day/night cycle & game clock
- ☐ 62. Weather (rain, storms, snow, sandstorms)
- ☐ 63. Seasons (Stardew hybrid)
- ☐ 64. Dynamic liquids (re-enable, networked)
- ☐ 65. Tile mechanics: gravity, growth, farming-hooks
- ☐ 66. Fire, explosions & environmental hazards
- ☐ 67. Wiring & mechanisms (Terraria logic layer)

## Book VII — Farming, Fishing & Life-sim (Stardew hybrid)
- ☐ 68. Farming (crops, soil, growth)
- ☐ 69. Fishing
- ☐ 70. Cooking & food buffs
- ☐ 71. Critters, nets & terrariums

## Book VIII — Automation & Industry (Mindustry hybrid)
- ☐ 72. Item transport: conveyors & item logistics
- ☐ 73. Machines: drills, smelters, assemblers
- ☐ 74. Power networks
- ☐ 75. Logistics & full factory loop
- ☐ 76. Turrets & automated defense

## Book IX — Presentation, Audio & Juice
- ☐ 77. Audio engine (WebAudio, CSP-safe)
- ☐ 78. SFX content & hookup
- ☐ 79. Adaptive music
- ☐ 80. Lighting overhaul (smooth, colored, day/night-integrated)
- ☐ 81. Particle & VFX overhaul
- ☐ 82. Sky & background overhaul
- ☐ 83. Screen effects
- ☐ 84. Full HUD & UI overhaul
- ☐ 85. Minimap & world map
- ☐ 86. Character render polish & dyes

## Book X — Multiplayer Hardening  (verify on GitHub Pages, not the Artifact)
- ☐ 87. Replication framework & interest management
- ☐ 88. Networked combat, projectiles & hit reconciliation
- ☐ 89. Networked enemies, bosses & events
- ☐ 90. Networked inventory, chests, crafting & the trust model
- ☐ 91. Networked world simulation
- ☐ 92. Join/leave robustness, state transfer & reconnection
- ☐ 93. Latency handling: interpolation, prediction, lag comp
- ☐ 94. Social layer: identity, chat, emotes, lobby

## Book XI — Persistence, Scale, Hardmode & Polish
- ☐ 95. Full save/character system
- ☐ 96. Hardmode: world conversion & new tiers
- ☐ 97. Mechanical & late bosses
- ☐ 98. Biome & content breadth (4D biome matrix + more)
- ☐ 99. Balance, difficulty modes & progression pass
- ☐ 100. Bestiary, achievements & in-game guide
- ☐ 101. Performance & scale (60fps-everywhere pass)
- ☐ 102. Controls, input & accessibility
- ☐ 103. QA, deterministic tests & release pipeline

## Book XII — Beyond Terraria (differentiators)
- ☐ 104. Truly seamless infinite world identity
- ☐ 105. Deep automation × survival fusion
- ☐ 106. Farming/seasons life-sim depth
- ☐ 107. Superior building & creativity tools
- ☐ 108. Co-op-first content
- ☐ 109. Modding / data-driven content hooks
- ☐ 110. Endgame, "the last update" & living-world features

---

### Deviation log
_Record here any place reality diverged from the plan (a phase split, a reorder, a wrong assumption).
Keep the invariants; ask the owner before expensive/user-facing deviations._

- (none yet)
