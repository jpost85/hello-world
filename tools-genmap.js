/* Build map path data for Liberty's Call from a US-states GeoJSON.
   Outputs /tmp/mapdata.js with a MAPDATA object: { viewBox, terrain[], regions{} } */
const fs = require("fs");
const gj = JSON.parse(fs.readFileSync("/tmp/us-states.json", "utf8"));

const PLAYABLE = {
  mass: "Massachusetts", conn: "Connecticut", ny: "New York", nj: "New Jersey",
  penn: "Pennsylvania", del: "Delaware", md: "Maryland", va: "Virginia",
  nc: "North Carolina", sc: "South Carolina", ga: "Georgia",
};
const TERRAIN = [
  "Maine", "New Hampshire", "Vermont", "Rhode Island", "West Virginia", "Ohio",
  "Kentucky", "Tennessee", "Indiana", "Michigan", "Alabama", "Mississippi",
  "Florida", "Illinois", "District of Columbia",
];

// Hand-built Province of Quebec (lon, lat), sitting north of NY / New England.
const QUEBEC_RING = [
  [-79.5, 47.6], [-76.5, 48.4], [-72.0, 48.6], [-69.0, 48.2], [-67.5, 47.3],
  [-69.2, 46.4], [-70.0, 45.9], [-71.5, 45.0], [-73.3, 45.0], [-74.7, 45.0],
  [-76.9, 44.2], [-79.0, 43.9], [-79.6, 45.2], [-79.5, 47.6],
];

function featByName(name) { return gj.features.find((f) => f.properties.name === name); }
function ringsOf(geom) {
  if (geom.type === "Polygon") return geom.coordinates;
  return geom.coordinates.flat(); // MultiPolygon -> all rings
}
function polygonsOf(geom) {
  return geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
}

// --- Projection bounds: playable colonies + Quebec ---
let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
function extend(lon, lat) {
  if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon;
  if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
}
for (const name of Object.values(PLAYABLE)) {
  for (const ring of ringsOf(featByName(name).geometry)) for (const [lon, lat] of ring) extend(lon, lat);
}
for (const [lon, lat] of QUEBEC_RING) extend(lon, lat);

const PAD = 0.4; // degrees of margin
minLon -= PAD; maxLon += PAD; minLat -= PAD; maxLat += PAD;
const midLat = (minLat + maxLat) / 2;
const lonScale = Math.cos((midLat * Math.PI) / 180); // horizontal compression

const HEIGHT = 900;
const scale = HEIGHT / (maxLat - minLat);
const WIDTH = (maxLon - minLon) * lonScale * scale;

function px(lon, lat) {
  const x = (lon - minLon) * lonScale * scale;
  const y = (maxLat - lat) * scale;
  return [x, y];
}
function ringPath(ring) {
  let d = "";
  for (let i = 0; i < ring.length; i++) {
    const [x, y] = px(ring[i][0], ring[i][1]);
    d += (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1);
  }
  return d + "Z";
}
function geomPath(geom) { return ringsOf(geom).map(ringPath).join(" "); }
function customPath(ring) { return ringPath(ring); }

// Area-weighted centroid of the largest ring (good label anchor).
function centroid(geom) {
  let best = null, bestArea = -1;
  for (const poly of polygonsOf(geom)) {
    const ring = poly[0];
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x0, y0] = ring[i], [x1, y1] = ring[i + 1];
      const cross = x0 * y1 - x1 * y0;
      a += cross; cx += (x0 + x1) * cross; cy += (y0 + y1) * cross;
    }
    a *= 0.5;
    if (Math.abs(a) > bestArea) { bestArea = Math.abs(a); best = [cx / (6 * a), cy / (6 * a)]; }
  }
  return best;
}
function ringCentroid(ring) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i], [x1, y1] = ring[i + 1];
    const cross = x0 * y1 - x1 * y0;
    a += cross; cx += (x0 + x1) * cross; cy += (y0 + y1) * cross;
  }
  a *= 0.5;
  return [cx / (6 * a), cy / (6 * a)];
}

// Manual label-anchor overrides (lon, lat) where a centroid sits awkwardly.
const ANCHOR = {
  mass: [-71.0, 42.45], conn: [-72.85, 41.5], ny: [-75.3, 42.95], nj: [-74.5, 40.1],
  va: [-78.3, 37.7], md: [-77.2, 39.45], del: [-75.45, 39.05], quebec: [-73.0, 46.7],
};

const regions = {};
for (const id in PLAYABLE) {
  const geom = featByName(PLAYABLE[id]).geometry;
  const c = ANCHOR[id] ? px(...ANCHOR[id]) : px(...centroid(geom));
  regions[id] = { path: geomPath(geom), cx: +c[0].toFixed(1), cy: +c[1].toFixed(1) };
}
// Quebec custom
{
  const c = px(...ANCHOR.quebec);
  regions.quebec = { path: customPath(QUEBEC_RING), cx: +c[0].toFixed(1), cy: +c[1].toFixed(1) };
}

const terrain = TERRAIN.map((n) => { const f = featByName(n); return f ? geomPath(f.geometry) : null; }).filter(Boolean);

const MAPDATA = {
  viewBox: `0 0 ${WIDTH.toFixed(0)} ${HEIGHT.toFixed(0)}`,
  terrain,
  regions,
};

fs.writeFileSync("/tmp/mapdata.js", "var MAPDATA = " + JSON.stringify(MAPDATA) + ";\n");
console.log("viewBox:", MAPDATA.viewBox);
console.log("region anchors:");
for (const id in regions) console.log(" ", id, regions[id].cx, regions[id].cy, "pathlen", regions[id].path.length);
console.log("terrain shapes:", terrain.length);
console.log("file bytes:", fs.statSync("/tmp/mapdata.js").size);
