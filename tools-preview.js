/* Render a static PNG preview of the opening position from /tmp/mapdata.js.
   Dev/visual-check tool only. Requires cairosvg (python). */
const fs = require("fs");
const { execSync } = require("child_process");
eval(fs.readFileSync("/tmp/mapdata.js", "utf8")); // defines MAPDATA

const OWN = {
  maine: "patriot", nh: "patriot", mass: "patriot", rhode: "patriot", conn: "patriot", ny: "crown",
  nj: "patriot", penn: "patriot", del: "patriot", md: "patriot", va: "patriot",
  nc: "patriot", sc: "patriot", ga: "crown", quebec: "crown",
  vermont: "neutral", ohio: "neutral", appalachia: "neutral", florida: "neutral",
};
const TR = {
  maine: 2, nh: 4, mass: 6, rhode: 3, conn: 4, ny: 16, nj: 4, penn: 10, del: 3, md: 4,
  va: 7, nc: 4, sc: 5, ga: 8, quebec: 10, vermont: 2, ohio: 3, appalachia: 3, florida: 5,
};
const NM = {
  maine: "Maine", nh: "New Hampshire", mass: "Massachusetts", rhode: "Rhode Island", conn: "Connecticut",
  ny: "New York", nj: "New Jersey", penn: "Pennsylvania", del: "Delaware", md: "Maryland",
  va: "Virginia", nc: "North Carolina", sc: "South Carolina", ga: "Georgia", quebec: "Quebec", rhode: "R.I.",
  vermont: "Vermont", ohio: "Ohio Country", appalachia: "Appalachia", florida: "East Florida",
};
const CAP = { ny: 1, penn: 1 };
const fill = { patriot: "rgba(31,78,121,0.74)", crown: "rgba(140,43,43,0.76)", neutral: "rgba(154,140,110,0.55)" };
const stroke = { patriot: "#1f4e79", crown: "#8c2b2b", neutral: "#9a8c6e" };
const [, , W, H] = MAPDATA.viewBox.split(" ").map(Number);

let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MAPDATA.viewBox}" width="${W}" height="${H}">`;
s += `<rect width="${W}" height="${H}" fill="#9cc0ca"/>`;
for (const d of MAPDATA.terrain) s += `<path d="${d}" fill="#d9c79c" stroke="#b7a276" stroke-width="0.8"/>`;
for (const id in MAPDATA.regions) s += `<path d="${MAPDATA.regions[id].path}" fill="#e3d3a8"/>`;
for (const id in MAPDATA.regions) s += `<path d="${MAPDATA.regions[id].path}" fill="${fill[OWN[id]]}" stroke="#4a3a22" stroke-width="1.4"/>`;
for (const a of (MAPDATA.annotations || [])) {
  s += `<text x="${a.x}" y="${a.y}" font-family="Georgia,serif" font-size="11" font-style="italic" text-anchor="middle" fill="#f7efd9" stroke="rgba(20,12,4,0.6)" stroke-width="2.5" paint-order="stroke">${a.text}</text>`;
}
for (const id in MAPDATA.regions) {
  const g = MAPDATA.regions[id];
  s += `<text x="${g.cx}" y="${g.cy - 13}" font-family="Georgia,serif" font-size="13" font-weight="bold" text-anchor="middle" fill="#f7efd9" stroke="rgba(20,12,4,0.75)" stroke-width="3" paint-order="stroke">${NM[id]}</text>`;
  if (CAP[id]) s += `<circle cx="${g.cx}" cy="${g.cy - 28}" r="5" fill="#ffd24a" stroke="#2b2118"/>`;
  s += `<circle cx="${g.cx}" cy="${g.cy + 6}" r="13" fill="#f7f2e2" stroke="${stroke[OWN[id]]}" stroke-width="2"/>`;
  s += `<text x="${g.cx}" y="${g.cy + 10.5}" font-family="Georgia,serif" font-size="13" font-weight="bold" text-anchor="middle" fill="#2b2118">${TR[id]}</text>`;
}
s += `<text x="${W - 150}" y="${H - 120}" font-family="Georgia,serif" font-size="17" font-style="italic" letter-spacing="4" text-anchor="middle" fill="rgba(30,60,70,0.55)" font-weight="bold">ATLANTIC OCEAN</text></svg>`;
fs.writeFileSync("map-preview.svg", s);
execSync("python3 -c \"import cairosvg; cairosvg.svg2png(url='map-preview.svg', write_to='map-preview.png', output_width=540)\"");
console.log("wrote map-preview.png");
