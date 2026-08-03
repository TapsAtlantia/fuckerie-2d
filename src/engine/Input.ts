// Keyboard + mouse state. Tracks both "held" and "just pressed this frame" so per-frame
// actions (jump, block-select, debug warps) fire exactly once. Call endFrame() after each
// game tick to clear the edge-triggered sets.
export class Input {
  private held = new Set<string>();
  private pressed = new Set<string>();

  mouseX = 0; // CSS pixels relative to canvas
  mouseY = 0;
  mouseLeft = false;
  mouseRight = false;
  wheelDelta = 0;

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (!this.held.has(k)) this.pressed.add(k);
      this.held.add(k);
      // Stop Space/arrows from scrolling the page.
      if (k === " " || k.startsWith("arrow")) e.preventDefault();
    });
    window.addEventListener("keyup", (e) => this.held.delete(e.key.toLowerCase()));
    window.addEventListener("blur", () => this.held.clear());

    const updateMouse = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - r.left;
      this.mouseY = e.clientY - r.top;
    };
    canvas.addEventListener("mousemove", updateMouse);
    canvas.addEventListener("mousedown", (e) => {
      updateMouse(e);
      if (e.button === 0) this.mouseLeft = true;
      if (e.button === 2) this.mouseRight = true;
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.mouseLeft = false;
      if (e.button === 2) this.mouseRight = false;
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("wheel", (e) => {
      this.wheelDelta += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
  }

  isDown(key: string): boolean {
    return this.held.has(key);
  }

  /** True only on the frame the key went down. */
  wasPressed(key: string): boolean {
    return this.pressed.has(key);
  }

  consumeWheel(): number {
    const d = this.wheelDelta;
    this.wheelDelta = 0;
    return d;
  }

  endFrame(): void {
    this.pressed.clear();
  }
}
