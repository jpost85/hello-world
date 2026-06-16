/**
 * Inline the Vite build into a single, self-contained HTML file that runs by
 * double-clicking it — no server, no network, like our sister project's
 * `liberty-call.html`. Run after `vite build`; reads from `dist/` and writes
 * `dist/risk-1996.html`.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dist = "dist";
const assets = join(dist, "assets");

const files = readdirSync(assets);
const jsFile = files.find((f) => f.endsWith(".js"));
const cssFile = files.find((f) => f.endsWith(".css"));
if (!jsFile || !cssFile) {
  throw new Error("Could not find built JS/CSS in dist/assets — run `vite build` first.");
}

const js = readFileSync(join(assets, jsFile), "utf8");
const css = readFileSync(join(assets, cssFile), "utf8");
let html = readFileSync(join(dist, "index.html"), "utf8");

// Replace the external <script> and <link> with inline <script>/<style>.
html = html
  .replace(/<script\b[^>]*src="[^"]*"[^>]*><\/script>/, () =>
    `<script type="module">\n${js}\n</script>`,
  )
  .replace(/<link\b[^>]*rel="stylesheet"[^>]*>/, () => `<style>\n${css}\n</style>`);

const out = join(dist, "risk-1996.html");
writeFileSync(out, html);

const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`Wrote ${out} (${kb} KB, fully self-contained).`);
