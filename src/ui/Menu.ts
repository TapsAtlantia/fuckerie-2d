import { Game } from "../engine/Game";
import { Net } from "../net/Net";
import {
  PLAYER_COLORS,
  defaultProfile,
  loadProfile,
  saveProfile,
  type Profile,
} from "../Profile";
import type { NetStatus } from "../net/Protocol";

// DOM overlay that fronts the canvas: home screen, profile ("sign-in"), and host/join-by-code
// multiplayer. It owns the lifecycle of a Game instance and swaps between menu and play.
export class Menu {
  private root: HTMLElement;
  private canvas: HTMLCanvasElement;
  private profile: Profile;
  private game: Game | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const root = document.getElementById("menu");
    if (!root) throw new Error("#menu element missing");
    this.root = root;
    this.profile = loadProfile() ?? this.freshProfile();
    // First run has no saved profile → start on sign-in; otherwise go home.
    if (loadProfile()) this.renderHome();
    else this.renderProfile(true);
  }

  private freshProfile(): Profile {
    const p = defaultProfile();
    saveProfile(p);
    return p;
  }

  private show(): void {
    this.root.style.display = "grid";
  }
  private hide(): void {
    this.root.style.display = "none";
    this.canvas.focus();
  }

  private el<T extends HTMLElement>(id: string): T {
    return this.root.querySelector<T>("#" + id)!;
  }

  // --- Screens --------------------------------------------------------------

  private renderHome(): void {
    this.show();
    this.root.innerHTML = `
      <div class="panel">
        <h1 class="brand">fuckerie <em>2d</em></h1>
        <p class="tagline">an infinite 2D sandbox — dig, build, explore</p>
        <p class="who">signed in as <b id="whoName"></b> <button id="editProfile" class="link">edit</button></p>
        <div class="actions">
          <button id="btnSingle" class="btn primary">Singleplayer</button>
          <button id="btnHost" class="btn">Host multiplayer</button>
          <button id="btnJoin" class="btn">Join by code</button>
        </div>
        <p class="phase">Phase 1.5 · world-generation deep-dive is Phase 2</p>
      </div>`;
    this.el("whoName").textContent = this.profile.name;
    (this.el("whoName") as HTMLElement).style.color = this.profile.color;
    this.el("editProfile").onclick = () => this.renderProfile(false);
    this.el("btnSingle").onclick = () => this.startSingle();
    this.el("btnHost").onclick = () => this.startHost();
    this.el("btnJoin").onclick = () => this.renderJoin();
  }

  private renderProfile(firstRun: boolean): void {
    this.show();
    this.root.innerHTML = `
      <div class="panel">
        <h2>${firstRun ? "Welcome — set up your profile" : "Your profile"}</h2>
        <label class="field"><span>Name</span><input id="nameInput" maxlength="16" autocomplete="off" /></label>
        <div class="field"><span>Color</span><div id="colors" class="colors"></div></div>
        <div class="actions row">
          <button id="saveProfile" class="btn primary">${firstRun ? "Continue" : "Save"}</button>
          ${firstRun ? "" : '<button id="backHome" class="btn ghost">Back</button>'}
        </div>
      </div>`;
    const nameInput = this.el<HTMLInputElement>("nameInput");
    nameInput.value = this.profile.name;
    let color = this.profile.color;

    const colorsWrap = this.el("colors");
    for (const c of PLAYER_COLORS) {
      const b = document.createElement("button");
      b.className = "swatch" + (c === color ? " sel" : "");
      b.style.background = c;
      b.onclick = () => {
        color = c;
        colorsWrap.querySelectorAll(".swatch").forEach((s) => s.classList.remove("sel"));
        b.classList.add("sel");
      };
      colorsWrap.appendChild(b);
    }

    this.el("saveProfile").onclick = () => {
      const name = nameInput.value.trim() || this.profile.name;
      this.profile = { ...this.profile, name, color };
      saveProfile(this.profile);
      this.renderHome();
    };
    if (!firstRun) this.el("backHome").onclick = () => this.renderHome();
  }

  private renderHost(): void {
    this.show();
    this.root.innerHTML = `
      <div class="panel">
        <h2>Host game</h2>
        <p id="hostStatus" class="status">Creating game…</p>
        <div id="codeWrap" class="code-wrap hidden">
          <div id="codeText" class="code">–––––</div>
          <button id="copyCode" class="btn small">Copy</button>
        </div>
        <p class="hint">Share the code — friends choose “Join by code”.</p>
        <div class="actions row">
          <button id="enterWorld" class="btn primary" disabled>Enter world</button>
          <button id="cancelHost" class="btn ghost">Cancel</button>
        </div>
      </div>`;
    this.el("cancelHost").onclick = () => this.abortToHome();
  }

  private renderJoin(): void {
    this.show();
    this.root.innerHTML = `
      <div class="panel">
        <h2>Join game</h2>
        <label class="field"><span>Game code</span>
          <input id="codeInput" maxlength="5" autocomplete="off" placeholder="ABCDE" /></label>
        <p id="joinStatus" class="status"></p>
        <div class="actions row">
          <button id="connectBtn" class="btn primary">Connect</button>
          <button id="backJoin" class="btn ghost">Back</button>
        </div>
      </div>`;
    const input = this.el<HTMLInputElement>("codeInput");
    input.oninput = () => (input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
    input.focus();
    this.el("connectBtn").onclick = () => this.startJoin(input.value.trim());
    this.el("backJoin").onclick = () => this.renderHome();
    input.onkeydown = (e) => {
      if (e.key === "Enter") this.startJoin(input.value.trim());
    };
  }

  // --- Game lifecycle -------------------------------------------------------

  private startSingle(): void {
    this.launch({ mode: "single", seed: (Math.random() * 1e9) | 0 });
    this.hide();
  }

  private async startHost(): Promise<void> {
    this.renderHost();
    const status = this.el("hostStatus");
    const net = new Net(this.profile);
    net.onStatus = (s: NetStatus) => {
      if (this.game) return; // once in-world, HUD shows peer count
      status.textContent = s.peers > 0 ? `${s.peers} player(s) connected` : "Waiting for players…";
    };
    try {
      const code = await net.host();
      // Build the game now so it can answer joiners (supplies seed + world deltas).
      this.launch({ mode: "host", net, seed: (Math.random() * 1e9) | 0 });
      status.textContent = "Waiting for players…";
      const wrap = this.el("codeWrap");
      wrap.classList.remove("hidden");
      this.el("codeText").textContent = code;
      const enter = this.el<HTMLButtonElement>("enterWorld");
      enter.disabled = false;
      enter.onclick = () => this.hide();
      this.el("copyCode").onclick = async () => {
        try {
          await navigator.clipboard.writeText(code);
          this.el("copyCode").textContent = "Copied!";
        } catch {
          this.el("copyCode").textContent = code;
        }
      };
    } catch (err) {
      this.showNetError(status, err);
      this.el<HTMLButtonElement>("enterWorld").disabled = true;
    }
  }

  private async startJoin(code: string): Promise<void> {
    const status = this.el("joinStatus");
    if (code.length < 5) {
      status.textContent = "Enter the 5-character code.";
      return;
    }
    status.textContent = "Connecting…";
    const net = new Net(this.profile);
    net.onStatus = (s: NetStatus) => {
      if (!s.connected) this.onDisconnected(s.error);
    };
    // Game must exist before we connect, so it catches the host's welcome.
    this.launch({ mode: "client", net, onStarted: () => this.hide() });
    try {
      await net.join(code);
      status.textContent = "Loading world…";
    } catch (err) {
      this.game?.dispose();
      this.game = null;
      this.showNetError(status, err);
    }
  }

  private launch(opts: {
    mode: "single" | "host" | "client";
    net?: Net;
    seed?: number;
    onStarted?: () => void;
  }): void {
    this.game = new Game(this.canvas, {
      mode: opts.mode,
      profile: this.profile,
      net: opts.net,
      seed: opts.seed,
      onStarted: opts.onStarted,
      onLeave: () => this.onGameLeave(),
      onError: (m) => this.onGameError(m),
    });
    this.game.start();
  }

  private onGameLeave(): void {
    this.game = null;
    this.renderHome();
  }

  private onGameError(msg: string): void {
    this.game?.dispose();
    this.game = null;
    this.renderHome();
    window.setTimeout(() => alert(msg), 30);
  }

  private onDisconnected(err: string | null): void {
    if (!this.game) return;
    this.onGameError(err ?? "Disconnected.");
  }

  private abortToHome(): void {
    this.game?.dispose();
    this.game = null;
    this.renderHome();
  }

  private showNetError(status: HTMLElement, err: unknown): void {
    const msg = err instanceof Error ? err.message : String(err);
    // The Artifact preview blocks networking — make that the headline when it applies.
    if (/matchmaking network/i.test(msg)) {
      status.innerHTML =
        `<b>Multiplayer can't reach the network from this preview.</b><br>` +
        `The sandbox blocks it. Use the hosted build (GitHub Pages) or local dev to play online.`;
    } else {
      status.textContent = msg;
    }
  }
}
