/* Render a static PNG preview of the opening position, derived directly from
   the game's own data (so it can't drift). Dev/visual-check tool; needs cairosvg. */
const fs = require("fs");
const { execSync } = require("child_process");
function makeEl() {
  return { style: {}, classList: { add(){}, remove(){}, contains(){return false;} },
    _value:"1", set textContent(v){this._tc=v;}, get textContent(){return this._tc;},
    set innerHTML(v){this._h=v;}, get innerHTML(){return this._h;},
    get value(){return this._value;}, set value(v){this._value=v;},
    appendChild(){}, addEventListener(){}, setAttribute(){} };
}
const cache = {};
global.document = { querySelector: s => cache[s] || (cache[s]=makeEl()),
  querySelectorAll: () => [], createElement: makeEl, createElementNS: makeEl, addEventListener(){} };
global.localStorage = { _d:{}, getItem(k){return this._d[k]||null;}, setItem(k,v){this._d[k]=v;} };

const game = require("./game.js");
const MAP = game.MAPDATA;
const DEF = {};
for (const d of game.REGION_DEFS) DEF[d.id] = d;
game.setState(game.newState());
const S = game.getState();
function menShort(m) { m = Math.round(m); if (m < 1000) return String(m); const k = m / 1000; return (Number.isInteger(k) ? k.toFixed(0) : k.toFixed(1)) + "k"; }

const fill = { patriot: "rgba(31,78,121,0.74)", crown: "rgba(140,43,43,0.76)", neutral: "rgba(154,140,110,0.55)" };
const cityFill = { patriot: "#1f4e79", crown: "#8c2b2b", neutral: "#9a8c6e" };
const stroke = { patriot: "#1f4e79", crown: "#8c2b2b", neutral: "#9a8c6e" };
const [, , W, H] = MAP.viewBox.split(" ").map(Number);

let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MAP.viewBox}" width="${W}" height="${H}">`;
s += `<rect width="${W}" height="${H}" fill="#9cc0ca"/>`;
for (const d of MAP.terrain) s += `<path d="${d}" fill="#d9c79c" stroke="#b7a276" stroke-width="0.8"/>`;
// land base under polygons
for (const id in MAP.regions) if (!MAP.regions[id].point) s += `<path d="${MAP.regions[id].path}" fill="#e3d3a8"/>`;
// territory polygons tinted by owner
for (const id in MAP.regions) {
  const g = MAP.regions[id], r = S.regions[id];
  if (g.point) continue;
  s += `<path d="${g.path}" fill="${fill[r.owner]}" stroke="#4a3a22" stroke-width="1.4"/>`;
}
// city markers (squares) on top
for (const id in MAP.regions) {
  const g = MAP.regions[id], r = S.regions[id];
  if (!g.point) continue;
  s += `<rect x="${g.cx-11}" y="${g.cy-11}" width="22" height="22" rx="3" fill="${cityFill[r.owner]}" stroke="#14100a" stroke-width="2"/>`;
}
// sea zones: dashed routes + navy-coloured anchor nodes
const seaStroke = { crown: "#b94b4b", patriot: "#3a6ea5" };
const seaPos = MAP.seaZones || {};
for (const zid in game.SEA_ZONES) {
  const sea = seaPos[zid]; if (!sea) continue;
  const navy = S.regions[zid].owner;
  for (const n of game.SEA_ZONES[zid].links) {
    if (zid < n && seaPos[n]) s += `<line x1="${sea.cx}" y1="${sea.cy}" x2="${seaPos[n].cx}" y2="${seaPos[n].cy}" stroke="${seaStroke[navy]}" stroke-width="1.5" stroke-dasharray="5 5" opacity="0.45"/>`;
  }
  for (const c of game.SEA_ZONES[zid].cities) {
    const cg = MAP.regions[c]; if (!cg) continue;
    s += `<line x1="${sea.cx}" y1="${sea.cy}" x2="${cg.cx}" y2="${cg.cy}" stroke="${seaStroke[navy]}" stroke-width="1.5" stroke-dasharray="5 5" opacity="0.45"/>`;
  }
}
const SHIP_W = 63, SHIP_H = SHIP_W * (1024 / 1536);
const shipB64 = { crown: require("fs").readFileSync("assets/ships/british.png").toString("base64"),
                  patriot: require("fs").readFileSync("assets/ships/american.png").toString("base64") };
const shipTint = { crown: "#ef9a9a", patriot: "#8fc0ee", neutral: "#f7efd9" };
for (const zid in game.SEA_ZONES) {
  const sea = seaPos[zid]; if (!sea) continue;
  const node = S.regions[zid];
  const cx = sea.cx, cy = sea.cy;
  const art = shipB64[node.owner] || shipB64.crown;
  s += `<image x="${(cx - SHIP_W / 2).toFixed(1)}" y="${(cy - SHIP_H / 2).toFixed(1)}" width="${SHIP_W}" height="${SHIP_H.toFixed(1)}" href="data:image/png;base64,${art}"/>`;
  s += `<text x="${cx}" y="${cy - SHIP_H / 2 - 5}" font-family="Georgia,serif" font-size="10" font-weight="bold" text-anchor="middle" fill="${shipTint[node.owner]}" stroke="rgba(20,12,4,0.8)" stroke-width="2.4" paint-order="stroke">${node.ships.crown}–${node.ships.patriot}</text>`;
  s += `<text x="${cx}" y="${cy + SHIP_H / 2 + 13}" font-family="Georgia,serif" font-size="9" font-style="italic" font-weight="bold" text-anchor="middle" fill="#21424c" stroke="rgba(247,242,226,0.7)" stroke-width="2" paint-order="stroke">${game.SEA_ZONES[zid].name}</text>`;
}
// labels, badges, stars
function star(cx, cy, o, i, fillc) { let p=""; for (let k=0;k<10;k++){const rr=k%2?i:o;const a=Math.PI/5*k-Math.PI/2;p+=(k?"L":"M")+(cx+Math.cos(a)*rr).toFixed(1)+" "+(cy+Math.sin(a)*rr).toFixed(1);} return `<path d="${p}Z" fill="${fillc}" stroke="#2b2118" stroke-width="0.7"/>`; }
for (const id in MAP.regions) {
  const g = MAP.regions[id], r = S.regions[id], d = DEF[id];
  const isCity = g.point;
  const label = d.label || d.name;
  const lx = g.cx + (d.labelDx || 0);
  const ly = (d.labelDy != null) ? g.cy + d.labelDy : g.cy + (isCity ? 23 : -13);
  s += `<text x="${lx}" y="${ly}" font-family="Georgia,serif" font-size="11" font-weight="bold" text-anchor="middle" fill="#f7efd9" stroke="rgba(20,12,4,0.75)" stroke-width="2.6" paint-order="stroke">${label}</text>`;
  if (d.capital) s += star(g.cx, g.cy - (isCity ? 18 : 28), 6.5, 2.8, "#ffd24a");
  if (isCity) {
    s += `<text x="${g.cx}" y="${g.cy+4.5}" font-family="Georgia,serif" font-size="10.5" font-weight="bold" text-anchor="middle" fill="#f7f2e2" stroke="rgba(15,9,4,0.85)" stroke-width="3" paint-order="stroke">${menShort(r.troops)}</text>`;
    if (r.general) s += star(g.cx-11, g.cy-11, 5, 2.2, "#fff3cf");
  } else {
    s += `<circle cx="${g.cx}" cy="${g.cy+6}" r="13" fill="#f7f2e2" stroke="${stroke[r.owner]}" stroke-width="2"/>`;
    s += `<text x="${g.cx}" y="${g.cy+10.5}" font-family="Georgia,serif" font-size="10.5" font-weight="bold" text-anchor="middle" fill="#2b2118">${menShort(r.troops)}</text>`;
    if (r.general) s += star(g.cx+12, g.cy-4, 5.5, 2.4, "#fff3cf");
  }
}
s += `<text x="${W-150}" y="${H-120}" font-family="Georgia,serif" font-size="17" font-style="italic" letter-spacing="4" text-anchor="middle" fill="rgba(30,60,70,0.55)" font-weight="bold">ATLANTIC OCEAN</text></svg>`;
fs.writeFileSync("map-preview.svg", s);
execSync("python3 -c \"import cairosvg; cairosvg.svg2png(url='map-preview.svg', write_to='map-preview.png', output_width=560)\"");
console.log("wrote map-preview.png");
