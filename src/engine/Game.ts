import { BAND, DEFAULT_SEED, DEFAULT_CREATIVE, PLAYER_W, REACH_TILES, TILE_SIZE, INVENTORY } from "../config";
import { Camera } from "./Camera";
import { Input } from "./Input";
import { Renderer, type CursorInfo } from "./Renderer";
import { Lighting } from "../systems/Lighting";
import { CreatureManager } from "../systems/CreatureManager";
import { Creature, numToKind } from "../entities/Creature";
import type { CreatureState } from "../net/Protocol";
import { ChunkManager } from "../world/ChunkManager";
import { WorldGen } from "../world/WorldGen";
import { Player } from "../entities/Player";
import { RemotePlayer } from "../entities/RemotePlayer";
import { TileId, isSolid, tile } from "../world/Tile";
import type { Profile } from "../Profile";
import type { Net } from "../net/Net";
import { PROTOCOL_VERSION, type NetMessage } from "../net/Protocol";
import { Inventory } from "../player/Inventory";
import { InventoryUI } from "../ui/InventoryUI";
import { itemFromTile } from "../items/Item";

const STEP = 1 / 60;
const MAX_STEPS = 5;
const MINE_SPEED = 1.4;
const STATE_HZ = 15; // how often we broadcast our avatar state
const WELCOME_TIMEOUT = 9000;

// Default hotbar items for new games
const DEFAULT_HOTBAR: readonly TileId[] = [
  TileId.Dirt, TileId.Stone, TileId.Grass, TileId.Torch, TileId.Planks,
  TileId.Cobblestone, TileId.Sand, TileId.OakLog, TileId.Glass, TileId.Lantern
];

export type GameMode = "single" | "host" | "client";

export interface GameOptions {
  mode: GameMode;
  profile: Profile;
  net?: Net;
  seed?: number;
  onStarted?: () => void; // world is live (menu can hide)
  onLeave?: () => void; // returned to menu
  onError?: (msg: string) => void;
}

// Top-level orchestrator: owns the loop, systems, the mine/place interaction, and — in
// multiplayer — broadcasting local edits/state and applying remote peers.
export class Game {
  private input: Input;
  private renderer: Renderer;
  private camera = new Camera();
  private lighting = new Lighting();
  private creatures = new CreatureManager();
  private remoteCreatures = new Map<number, Creature>();
  private creatureTimer = 0;
  private attackCd = 0;
  private hud: HTMLElement;

  private mode: GameMode;
  private profile: Profile;
  private net: Net | null;
  private opts: GameOptions;

  private world!: ChunkManager;
  private player!: Player;
  private seed: number;

  private remote = new Map<string, RemotePlayer>();
  private stateTimer = 0;

  private started = false;
  private rafId = 0;
  private welcomeTimer = 0;

  private accumulator = 0;
  private lastTime = 0;
  private selected = 0;

  private mineX = Number.NaN;
  private mineY = Number.NaN;
  private mineTimer = 0;

  private cursor: CursorInfo = { tileX: 0, tileY: 0, inReach: false, miningProgress: 0, mining: false };
  private fps = 0;
  private hudTimer = 0;

  // Inventory system (its `isCreative` is the single source of truth for game mode)
  private inventory: Inventory;
  private inventoryUI: InventoryUI;

  constructor(canvas: HTMLCanvasElement, opts: GameOptions) {
    this.opts = opts;
    this.mode = opts.mode;
    this.profile = opts.profile;
    this.net = opts.net ?? null;
    this.seed = opts.seed ?? DEFAULT_SEED;

    this.input = new Input(canvas);
    this.renderer = new Renderer(canvas);
    const hud = document.getElementById("hud");
    if (!hud) throw new Error("#hud element missing");
    this.hud = hud;

    // Initialize inventory system
    this.inventory = new Inventory(DEFAULT_CREATIVE);
    this.inventoryUI = new InventoryUI(this.inventory);
    
    // Set up default hotbar
    this.setupDefaultHotbar();

    if (this.net) {
      this.net.onMessage = (m) => this.handleNet(m);
      if (this.mode === "host") {
        this.net.onWelcomeRequest = () => ({
          seed: this.seed,
          hostProfile: this.profile,
          deltas: this.world.exportDeltas(),
        });
      }
    }
  }

  private setupDefaultHotbar(): void {
    for (let i = 0; i < DEFAULT_HOTBAR.length; i++) {
      const tileId = DEFAULT_HOTBAR[i];
      const item = itemFromTile(tileId);
      this.inventory.setHotbarSlot(i, { item, count: this.inventory.isCreative ? INVENTORY.MAX_STACK_SIZE : INVENTORY.DEFAULT_STACK_SIZE });
    }
  }

  /** Host/single boot immediately; client waits for the host's welcome. */
  start(): void {
    if (this.mode === "client") {
      // If the host never sends a welcome, bail out to the menu with a message.
      this.welcomeTimer = window.setTimeout(() => {
        this.opts.onError?.("Joined, but the host never sent the world. Try again.");
        this.leave();
      }, WELCOME_TIMEOUT);
      return;
    }
    this.beginWorld(this.seed);
    this.beginLoop();
  }

  private beginWorld(seed: number): void {
    this.seed = seed;
    this.world = new ChunkManager(new WorldGen(seed));
    this.player = this.spawnPlayer();
    this.camera.snapTo(this.player.centerX, this.player.centerY);
  }

  private spawnPlayer(): Player {
    const surfaceY = this.world.gen.surfaceHeight(0);
    const x = (TILE_SIZE - PLAYER_W) / 2;
    const y = (surfaceY - 5) * TILE_SIZE;
    return new Player(x, y);
  }

  private respawn(): void {
    const spawn = this.spawnPlayer();
    this.player.x = spawn.x;
    this.player.y = spawn.y;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.health = this.player.maxHealth;
    this.camera.snapTo(this.player.centerX, this.player.centerY);
  }

  private beginLoop(): void {
    if (this.started) return;
    this.started = true;
    this.renderer.resize(this.camera);
    this.streamChunks();
    
    // Add hotbar to DOM
    const hotbarEl = this.inventoryUI.getHotbarElement();
    document.body.appendChild(hotbarEl);
    
    this.lastTime = performance.now();
    this.opts.onStarted?.();
    this.rafId = requestAnimationFrame(this.frame);
  }

  /** Stop the loop and close the connection, without any menu callback. */
  dispose(): void {
    if (this.welcomeTimer) clearTimeout(this.welcomeTimer);
    this.started = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.net?.leave();
    this.inventoryUI.close();
    
    // Remove hotbar from DOM
    const hotbarEl = this.inventoryUI.getHotbarElement();
    if (hotbarEl.parentNode) {
      hotbarEl.parentNode.removeChild(hotbarEl);
    }
  }

  /** Tear down and return to the menu. */
  leave(): void {
    this.dispose();
    this.opts.onLeave?.();
  }

  // --- Networking -----------------------------------------------------------

  private handleNet(msg: NetMessage): void {
    switch (msg.type) {
      case "welcome":
        if (this.mode === "client" && !this.started) {
          clearTimeout(this.welcomeTimer);
          if (msg.protocolVersion !== PROTOCOL_VERSION) {
            this.opts.onError?.("Version mismatch — the host is running a different game version.");
            this.leave();
            break;
          }
          this.beginWorld(msg.seed);
          this.world.importDeltas(msg.deltas);
          this.beginLoop();
        }
        break;
      case "state": {
        if (msg.from === this.net?.myId) break;
        let r = this.remote.get(msg.from);
        if (!r) {
          r = new RemotePlayer(msg.x, msg.y, msg.name, msg.color);
          this.remote.set(msg.from, r);
        }
        r.setTarget(msg.x, msg.y, msg.facing, msg.name, msg.color);
        break;
      }
      case "edit":
        if (this.started && msg.from !== this.net?.myId) {
          this.world.setFg(msg.x, msg.y, msg.fg as TileId);
        }
        break;
      case "leave":
        this.remote.delete(msg.from);
        break;
      case "creatures":
        if (this.mode === "client") this.syncRemoteCreatures(msg.list);
        break;
      case "attack":
        if (this.mode !== "client") this.creatures.hitAt(msg.x, msg.y, 20);
        break;
      case "hello":
        break; // host: peer appears on its first state message
    }
  }

  private syncRemoteCreatures(list: CreatureState[]): void {
    const seen = new Set<number>();
    for (const s of list) {
      seen.add(s.id);
      let c = this.remoteCreatures.get(s.id);
      if (!c) {
        c = new Creature(s.x, s.y, numToKind(s.kind));
        c.id = s.id;
        this.remoteCreatures.set(s.id, c);
      }
      c.x = s.x;
      c.y = s.y;
      c.facing = s.facing;
      c.health = s.hp;
      c.hurtFlash = s.hurt ? 0.12 : 0;
    }
    for (const id of [...this.remoteCreatures.keys()]) if (!seen.has(id)) this.remoteCreatures.delete(id);
  }

  private attackAt(wx: number, wy: number): boolean {
    if (this.mode === "client") {
      for (const c of this.remoteCreatures.values()) {
        if (wx >= c.x && wx <= c.x + c.w && wy >= c.y && wy <= c.y + c.h) {
          this.net?.broadcast({ type: "attack", from: this.net.myId, x: wx, y: wy });
          return true;
        }
      }
      return false;
    }
    return this.creatures.hitAt(wx, wy, 20);
  }

  private broadcastEdit(x: number, y: number, fg: number): void {
    this.net?.broadcast({ type: "edit", from: this.net.myId, x, y, fg });
  }

  private broadcastState(): void {
    if (!this.net) return;
    this.net.broadcast({
      type: "state",
      from: this.net.myId,
      x: this.player.x,
      y: this.player.y,
      vx: this.player.vx,
      vy: this.player.vy,
      facing: this.player.facing,
      name: this.profile.name,
      color: this.profile.color,
    });
  }

  // --- Loop -----------------------------------------------------------------

  private frame = (now: number): void => {
    if (!this.started) return;
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt > 0.1) dt = 0.1;

    this.renderer.resize(this.camera);
    this.streamChunks();

    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= STEP && steps < MAX_STEPS) {
      this.fixedUpdate(STEP);
      this.accumulator -= STEP;
      steps++;
    }
    if (steps === MAX_STEPS) this.accumulator = 0;

    for (const r of this.remote.values()) r.interpolate(dt);

    // Broadcast our state at a fixed rate.
    if (this.net) {
      this.stateTimer += dt;
      if (this.stateTimer >= 1 / STATE_HZ) {
        this.broadcastState();
        this.stateTimer = 0;
      }
    }

    // Creatures: host/single simulate; the host broadcasts snapshots; clients render remotes.
    if (this.mode !== "client") {
      this.creatures.update(dt, this.world, this.player, (x) => this.world.gen.surfaceHeight(x));
      if (this.net && this.mode === "host") {
        this.creatureTimer += dt;
        if (this.creatureTimer >= 0.1) {
          this.creatureTimer = 0;
          this.net.broadcast({ type: "creatures", from: this.net.myId, list: this.creatures.snapshot() });
        }
      }
    }

    // Death → respawn.
    if (this.player.health <= 0) this.respawn();

    this.computeLighting();
    this.renderer.render(
      this.camera,
      this.world,
      this.player,
      this.lighting,
      this.cursor,
      [...this.remote.values()],
      this.mode === "client" ? [...this.remoteCreatures.values()] : this.creatures.creatures,
      dt,
    );

    this.fps += (1 / Math.max(dt, 1e-4) - this.fps) * 0.1;
    this.hudTimer += dt;
    if (this.hudTimer > 0.2) {
      this.updateHud();
      this.hudTimer = 0;
    }

    this.rafId = requestAnimationFrame(this.frame);
  };

  private streamChunks(): void {
    const b = this.camera.tileBounds();
    this.world.update(b.minX, b.minY, b.maxX, b.maxY);
  }

  private fixedUpdate(dt: number): void {
    this.handleDiscreteInput();
    this.player.update(dt, this.input, this.world);
    this.handleInteraction(dt);
    this.camera.follow(dt, this.player.centerX, this.player.centerY);
    this.input.endFrame();
  }

  private handleDiscreteInput(): void {
    const inp = this.input;
    if (inp.wasPressed("f")) this.player.fly = !this.player.fly;
    if (inp.wasPressed("t")) this.player.warp(0, 2000);
    if (inp.wasPressed("y")) this.player.warp(0, -2000);
    // Reseed only makes sense in singleplayer — it would desync a shared world.
    if (inp.wasPressed("g") && this.mode === "single") this.reseed();
    if (inp.wasPressed("escape")) {
      this.inventoryUI.close();
      this.leave();
    }
    
    // Toggle inventory
    if (inp.wasPressed("e")) {
      this.inventoryUI.toggle();
      this.inventoryUI.updateFullInventory();
    }

    // Hotbar selection
    for (let i = 0; i < 10; i++) {
      if (inp.wasPressed(String(i === 9 ? 0 : i + 1))) {
        this.inventory.setSelectedIndex(i);
        this.inventoryUI.updateHotbar();
      }
    }
    const wheel = inp.consumeWheel();
    if (wheel !== 0) {
      const newIndex = (this.inventory.getSelectedIndex() + wheel + 10) % 10;
      this.inventory.setSelectedIndex(newIndex);
      this.inventoryUI.updateHotbar();
    }
  }

  private reseed(): void {
    this.seed = (Math.random() * 1e9) | 0;
    this.beginWorld(this.seed);
  }

  private handleInteraction(dt: number): void {
    const wx = this.camera.screenToWorldX(this.input.mouseX);
    const wy = this.camera.screenToWorldY(this.input.mouseY);
    const tileX = Math.floor(wx / TILE_SIZE);
    const tileY = Math.floor(wy / TILE_SIZE);

    const pcx = this.player.centerX / TILE_SIZE;
    const pcy = this.player.centerY / TILE_SIZE;
    const inReach = Math.hypot(tileX + 0.5 - pcx, tileY + 0.5 - pcy) <= REACH_TILES;

    this.cursor.tileX = tileX;
    this.cursor.tileY = tileY;
    this.cursor.inReach = inReach;
    this.cursor.mining = false;
    this.cursor.miningProgress = 0;

    if (this.attackCd > 0) this.attackCd -= dt;
    if (inReach && this.input.mouseLeft) {
      // Swing at a creature under the cursor first; otherwise mine.
      if (this.attackCd <= 0 && this.attackAt(wx, wy)) {
        this.attackCd = 0.3;
        this.mineTimer = 0;
      } else {
        this.mine(tileX, tileY, dt);
      }
    } else {
      this.mineTimer = 0;
      this.mineX = Number.NaN;
    }

    if (inReach && this.input.mouseRight) this.place(tileX, tileY);
  }

  private mine(tileX: number, tileY: number, dt: number): void {
    const fg = this.world.getFg(tileX, tileY);
    if (fg === TileId.Air) {
      this.mineTimer = 0;
      return;
    }
    const hardness = tile(fg).hardness;
    if (tileX !== this.mineX || tileY !== this.mineY) {
      this.mineX = tileX;
      this.mineY = tileY;
      this.mineTimer = 0;
    }
    this.mineTimer += MINE_SPEED * dt;
    this.cursor.mining = true;
    this.cursor.miningProgress = Math.min(1, this.mineTimer / hardness);
    if (this.mineTimer >= hardness) {
      // Survival: add drop to inventory
      if (!this.inventory.isCreative) {
        const props = tile(fg);
        const dropTileId = props.drop ?? fg;
        if (dropTileId !== null) {
          const item = itemFromTile(dropTileId);
          this.inventory.addItem(item, 1);
          this.inventoryUI.updateHotbar();
        }
      }
      
      this.world.setFg(tileX, tileY, TileId.Air);
      this.broadcastEdit(tileX, tileY, TileId.Air);
      this.mineTimer = 0;
      this.mineX = Number.NaN;
    }
  }

  private place(tileX: number, tileY: number): void {
    if (this.world.getFg(tileX, tileY) !== TileId.Air) return;
    
    const tileId = this.inventory.getSelectedTile();
    if (tileId === null) return;
    
    // Survival: check if we have the item
    if (!this.inventory.isCreative) {
      if (!this.inventory.hasSelected(tileId, 1)) return;
    }
    
    const supported =
      this.world.isSolid(tileX - 1, tileY) ||
      this.world.isSolid(tileX + 1, tileY) ||
      this.world.isSolid(tileX, tileY - 1) ||
      this.world.isSolid(tileX, tileY + 1) ||
      this.world.getBg(tileX, tileY) !== TileId.Air;
    if (!supported) return;
    if (isSolid(tileId) && this.tileOverlapsPlayer(tileX, tileY)) return;

    // Survival: consume the item
    if (!this.inventory.isCreative) {
      this.inventory.consumeSelected(1);
      this.inventoryUI.updateHotbar();
    }

    this.world.setFg(tileX, tileY, tileId);
    this.broadcastEdit(tileX, tileY, tileId);
  }

  private tileOverlapsPlayer(tileX: number, tileY: number): boolean {
    const tx = tileX * TILE_SIZE;
    const ty = tileY * TILE_SIZE;
    return (
      tx < this.player.x + this.player.w &&
      tx + TILE_SIZE > this.player.x &&
      ty < this.player.y + this.player.h &&
      ty + TILE_SIZE > this.player.y
    );
  }

  private computeLighting(): void {
    const b = this.camera.tileBounds();
    const m = 4;
    this.lighting.compute(
      this.world,
      b.minX - m,
      b.minY - m,
      b.maxX + m,
      b.maxY + m,
      Math.floor(this.player.centerX / TILE_SIZE),
      Math.floor(this.player.centerY / TILE_SIZE),
      1,
    );
  }

  private bandName(tileY: number): string {
    if (tileY < BAND.SKY) return "Space";
    if (tileY < -30) return "Sky";
    if (tileY < 30) return "Surface";
    if (tileY < BAND.CAVERN) return "Underground";
    if (tileY < BAND.UNDERWORLD) return "Caverns";
    return "Underworld";
  }

  private updateHud(): void {
    const px = Math.floor(this.player.centerX / TILE_SIZE);
    const py = Math.floor(this.player.centerY / TILE_SIZE);
    
    const selectedSlot = this.inventory.getSelected();
    const selName = selectedSlot ? selectedSlot.item.name : "empty";
    const selCount = selectedSlot ? selectedSlot.count : 0;
    
    let netLine = "solo";
    if (this.net) {
      const label = this.mode === "host" ? "hosting" : "joined";
      netLine = `${label} · ${this.net.peerCount()} peer(s)`;
    }
    
    const modeLabel = this.inventory.isCreative ? "CREATIVE" : "SURVIVAL";
    const hp = Math.ceil(this.player.health);
    const hpBar = "#".repeat(Math.round(hp / 10)) + "-".repeat(10 - Math.round(hp / 10));
    const water = this.player.inLiquid ? "   ~water~" : "";
    
    this.hud.textContent =
      `fuckerie 2d — Phase 2\n` +
      `${this.profile.name}   [${netLine}]\n` +
      `fps ${this.fps.toFixed(0)}   chunks ${this.world.loadedCount}\n` +
      `pos ${px}, ${py}   band ${this.bandName(py)}${water}\n` +
      `HP [${hpBar}] ${hp}\n` +
      `${modeLabel}   [${this.inventory.getSelectedIndex() + 1}] ${selName} (${selCount})${this.player.fly ? "   FLY" : ""}   ·  Esc: menu`;
  }
}
