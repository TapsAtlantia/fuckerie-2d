// Collapses the game into a single self-contained HTML fragment for publishing as a
// Claude Artifact (whose CSP blocks any external file). Bundles src/main.ts with esbuild,
// then inlines it plus the page's <style> into one file. Repeatable: re-run after any change.
//
//   node scripts/make-artifact.mjs <output.html>
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = process.argv[2] ?? resolve(root, "artifact/index.html");

// 1. Bundle the whole game to one minified ESM string (no external requests).
const result = await build({
  entryPoints: [resolve(root, "src/main.ts")],
  bundle: true,
  format: "esm",
  minify: true,
  target: "es2022",
  write: false,
});
const js = result.outputFiles[0].text;

// 2. Reuse the exact <style> and body markup from index.html, minus its external script tag.
const html = readFileSync(resolve(root, "index.html"), "utf8");
const style = (html.match(/<style>[\s\S]*?<\/style>/) ?? [""])[0];
let bodyInner = (html.match(/<body>([\s\S]*?)<\/body>/) ?? ["", ""])[1];
bodyInner = bodyInner.replace(/<script[\s\S]*?<\/script>/g, "").trim();

// 3. Emit a fragment (no <!doctype>/<html>/<head>/<body> — the Artifact host adds those).
const fragment = `${style}\n${bodyInner}\n<script type="module">\n${js}\n</script>\n`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, fragment, "utf8");
console.log(`wrote ${outPath} (${(fragment.length / 1024).toFixed(1)} kB)`);
