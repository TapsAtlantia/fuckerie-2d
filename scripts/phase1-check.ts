// Phase 1 headless check: the 16-bit tile widening preserves determinism, and tile ids > 255 can be
// placed, replicated via edit deltas, and survive chunk unload/reload.
// Run: npx esbuild scripts/phase1-check.ts --bundle --platform=node --format=esm --outfile=tmp.mjs && node tmp.mjs
import { WorldGen } from "../src/world/WorldGen";
import { ChunkManager } from "../src/world/ChunkManager";

let fails = 0;
const check = (n: string, c: boolean, e = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${e ? "  (" + e + ")" : ""}`); if (!c) fails++; };
const eq = (a: Uint16Array, b: Uint16Array) => a.length === b.length && a.every((v, i) => v === b[i]);

{
  const a = new WorldGen(909), b = new WorldGen(909);
  let s = true;
  for (const [cx, cy] of [[0, 0], [4, 7], [-3, 20]] as const) {
    const x = a.generateChunk(cx, cy), y = b.generateChunk(cx, cy);
    if (!eq(x.fg, y.fg) || !eq(x.bg, y.bg)) s = false;
  }
  check("determinism preserved (Uint16 fg/bg)", s);
}
{
  const h = new ChunkManager(new WorldGen(909)); h.update(0, 0, 40, 40);
  h.setFg(5, 5, 300); h.setFg(6, 6, 511); h.setBg(7, 7, 400);
  check("place >255 id reads back", h.getFg(5, 5) === 300 && h.getFg(6, 6) === 511 && h.getBg(7, 7) === 400);
  const c = new ChunkManager(new WorldGen(909)); c.importDeltas(h.exportDeltas()); c.update(0, 0, 40, 40);
  check(">255 id replicates via deltas", c.getFg(5, 5) === 300 && c.getFg(6, 6) === 511 && c.getBg(7, 7) === 400);
}
{
  const w = new ChunkManager(new WorldGen(909)); w.update(0, 0, 40, 40);
  w.setFg(10, 10, 499);
  w.update(90000, 90000, 90040, 90040);
  w.update(0, 0, 40, 40);
  check(">255 id survives unload/reload", w.getFg(10, 10) === 499);
}
console.log(`\n${fails === 0 ? "ALL PASSED" : fails + " FAILED"}`);
if (fails > 0) process.exit(1);
