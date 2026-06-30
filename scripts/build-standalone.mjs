// Builds a single self-contained HTML file (JS + CSS inlined) for one-click
// local play — no server, no build step needed to run the output.
// Usage: npm run standalone  ->  dist-standalone/scorched-earth.html
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const root = new URL("../", import.meta.url);
const outDir = new URL("../dist-standalone/", import.meta.url);
mkdirSync(outDir, { recursive: true });

// Bundle + minify the app; the CSS import is dropped (we inline styles.css).
const result = await build({
  entryPoints: [new URL("src/main.ts", root).pathname],
  bundle: true,
  minify: true,
  format: "esm",
  loader: { ".css": "empty" },
  write: false,
});
const js = result.outputFiles[0].text;
const css = readFileSync(new URL("src/styles.css", root), "utf8");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<meta name="theme-color" content="#0b0d1a" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<title>Scorched Earth — Mobile</title>
<style>
${css}
</style>
</head>
<body>
<div id="app"><canvas id="game"></canvas><div id="ui"></div></div>
<script type="module">
${js}
</script>
</body>
</html>
`;

const outFile = new URL("scorched-earth.html", outDir);
writeFileSync(outFile, html);
const kb = (html.length / 1024).toFixed(1);
console.log(`wrote dist-standalone/scorched-earth.html (${kb} KB) — open it in any browser.`);
