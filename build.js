/* Build the self-contained liberty-call.html from index.html + styles.css +
   game.js, inlining the stylesheet and script and base64-embedding the general
   portraits and the tall-ship art so the single file needs no external assets.
   Run: node build.js */
const fs = require("fs");

const ART_KEYS = ["washington", "greene", "gates", "howe", "cornwallis", "burgoyne"];
const SHIP_FILES = { crown: "assets/ships/british.png", patriot: "assets/ships/american.png" };

function dataUri(key) {
  const b64 = fs.readFileSync(`assets/generals/${key}.png`).toString("base64");
  return `data:image/png;base64,${b64}`;
}
function pngDataUri(file) {
  return `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;
}

let html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("styles.css", "utf8");
let js = fs.readFileSync("game.js", "utf8");

// Swap the file-path PORTRAITS registry for inline data URIs in the bundled JS.
const embedded = ART_KEYS.map(k => `    ${k}: "${dataUri(k)}",`).join("\n");
js = js.replace(/  const PORTRAITS = \{[\s\S]*?\n  \};/,
  `  const PORTRAITS = {\n${embedded}\n  };`);

// Swap the tall-ship file paths for inline data URIs in the bundled JS.
const ships = Object.entries(SHIP_FILES).map(([side, f]) => `    ${side}: "${pngDataUri(f)}",`).join("\n");
js = js.replace(/  const SHIP_ART = \{[\s\S]*?\n  \};/, `  const SHIP_ART = {\n${ships}\n  };`);

html = html.replace(/  <link rel="stylesheet" href="styles.css" \/>/, `  <style>\n${css}\n  </style>`);
html = html.replace(/  <script src="game.js"><\/script>/, `  <script>\n${js}\n  </script>`);

fs.writeFileSync("liberty-call.html", html);
console.log(`wrote liberty-call.html (${(html.length / 1024).toFixed(0)} KB, ${ART_KEYS.length} portraits + ship embedded)`);
