// Web-Worker entry: generates chunks off the main thread so streaming never costs render-thread
// time. It is bundled to a string by scripts/build-worker.mjs and instantiated as a blob Worker at
// runtime (with a synchronous fallback if Workers/CSP don't allow it). Tile values are a pure
// function of (seed, coords), so a worker-generated chunk is identical to a main-thread one; player
// edits (deltas) are applied on the main thread after the chunk arrives.
import { WorldGen } from "./WorldGen";

const ctx: any = self;
let gen: WorldGen | null = null;

ctx.onmessage = (e: MessageEvent) => {
  const m = e.data;
  if (m.type === "init") {
    gen = new WorldGen(m.seed);
    return;
  }
  if (m.type === "gen" && gen) {
    const c = gen.generateChunkAt(m.x0, m.y0, m.size);
    // Transfer the backing buffers (zero-copy). The worker's Chunk is discarded afterwards.
    ctx.postMessage(
      { type: "chunk", x0: m.x0, y0: m.y0, size: m.size, fg: c.fg.buffer, bg: c.bg.buffer, liquid: c.liquid.buffer },
      [c.fg.buffer, c.bg.buffer, c.liquid.buffer],
    );
  }
};
