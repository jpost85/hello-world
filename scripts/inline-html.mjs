/**
 * Inline the Vite build into a single, self-contained HTML file that runs by
 * double-clicking it — no server, no network. Run after the SINGLE_FILE build;
 * reads from `dist/` and writes `dist/three-kingdoms.html`.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dist = "dist";
const assets = join(dist, "assets");

const files = readdirSync(assets);
const jsFiles = files.filter((f) => f.endsWith(".js"));
const cssFile = files.find((f) => f.endsWith(".css"));
if (jsFiles.length !== 1 || !cssFile) {
  throw new Error(
    `Expected exactly one JS chunk and one CSS file in dist/assets (found ${jsFiles.length} JS). ` +
      "Build with SINGLE_FILE=1 (npm run build:single) so dynamic imports are inlined.",
  );
}

const js = readFileSync(join(assets, jsFiles[0]), "utf8");
const css = readFileSync(join(assets, cssFile), "utf8");
let html = readFileSync(join(dist, "index.html"), "utf8");

html = html
  .replace(/<script\b[^>]*src="[^"]*"[^>]*><\/script>/, () => `<script type="module">\n${js}\n</script>`)
  .replace(/<link\b[^>]*rel="stylesheet"[^>]*>/, () => `<style>\n${css}\n</style>`);

const out = join(dist, "three-kingdoms.html");
writeFileSync(out, html);
console.log(`Wrote ${out} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB, fully self-contained).`);
