/* Build map path data for Liberty's Call from a US-states GeoJSON.
   Outputs /tmp/mapdata.js with a MAPDATA object:
   { viewBox, terrain[], regions{}, annotations[] }
   A region may be backed by one state name or several (combined geometry),
   reflecting colonial configurations (e.g. Massachusetts incl. the District
   of Maine; Virginia incl. present-day West Virginia). */
const fs = require("fs");
const gj = JSON.parse(fs.readFileSync("/tmp/us-states.json", "utf8"));

const PLAYABLE = {
  // Original thirteen colonies (Maine was part of Massachusetts; West
  // Virginia was part of Virginia).
  nh:    "New Hampshire",
  mass:  ["Massachusetts", "Maine"],
  rhode: "Rhode Island",
  conn:  "Connecticut",
  ny:    "New York",
  nj:    "New Jersey",
  penn:  "Pennsylvania",
  del:   "Delaware",
  md:    "Maryland",
  va:    ["Virginia", "West Virginia"],
  nc:    "North Carolina",
  sc:    "South Carolina",
  ga:    "Georgia",
  // Neutral / disputed lands
  vermont:    "Vermont",                 // New Hampshire Grants / Vermont Republic
  ohio:       "Ohio",                    // the Ohio Country / Northwest frontier
  appalachia: ["Kentucky", "Tennessee"], // trans-Appalachian backcountry
  florida:    "Florida",                 // East Florida (cropped to its north)
};
// Regions kept out of the projection bounds so a long western/southern tail
// (Florida's peninsula, Kentucky/Tennessee reaching the Mississippi) doesn't
// stretch the map; they crop at the frame edge instead.
const NO_BOUNDS = new Set(["florida", "appalachia"]);

const TERRAIN = [
  "Indiana", "Michigan", "Alabama", "Mississippi", "Illinois", "District of Columbia",
];

// Hand-built Province of Quebec (lon, lat). Its southern edge follows the
// real border: the 45th parallel west of New Hampshire, then NE along the
// height of land between Maine and Quebec — so it does not overlap Maine.
const QUEBEC_RING = [
  [-79.5, 47.6], [-76.5, 48.4], [-72.0, 48.6], [-69.8, 48.05],
  [-69.2, 47.45], [-70.3, 46.3], [-70.9, 45.6], [-71.45, 45.05],
  [-73.3, 45.0], [-74.7, 45.0], [-76.9, 44.2], [-79.0, 43.9],
  [-79.6, 45.2], [-79.5, 47.6],
];

function featByName(name) { return gj.features.find((f) => f.properties.name === name); }
function statesOf(v) { return Array.isArray(v) ? v : [v]; }
function ringsOf(geom) {
  if (geom.type === "Polygon") return geom.coordinates;
  return geom.coordinates.flat(); // MultiPolygon -> all rings
}
function polygonsOf(geom) {
  return geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
}

// --- Projection bounds ---
let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
function extend(lon, lat) {
  if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon;
  if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
}
for (const id in PLAYABLE) {
  if (NO_BOUNDS.has(id)) continue;
  for (const name of statesOf(PLAYABLE[id])) {
    for (const ring of ringsOf(featByName(name).geometry)) for (const [lon, lat] of ring) extend(lon, lat);
  }
}
for (const [lon, lat] of QUEBEC_RING) extend(lon, lat);

const PAD = 0.4; // degrees of margin
minLon -= PAD; maxLon += PAD; minLat -= PAD; maxLat += PAD;
minLat = Math.min(minLat, 29.4); // extend south to reveal north Florida
const midLat = (minLat + maxLat) / 2;
const lonScale = Math.cos((midLat * Math.PI) / 180); // horizontal compression

const HEIGHT = 900;
const scale = HEIGHT / (maxLat - minLat);
const WIDTH = (maxLon - minLon) * lonScale * scale;

function px(lon, lat) {
  return [(lon - minLon) * lonScale * scale, (maxLat - lat) * scale];
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
function regionPath(v) { return statesOf(v).map((n) => geomPath(featByName(n).geometry)).join(" "); }
function customPath(ring) { return ringPath(ring); }

// Area-weighted centroid of the largest ring across all states of a region.
function centroidOf(v) {
  let best = null, bestArea = -1;
  for (const name of statesOf(v)) {
    for (const poly of polygonsOf(featByName(name).geometry)) {
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
  }
  return best;
}

// Manual label-anchor overrides (lon, lat) where a centroid sits awkwardly or
// must land on a region's *visible* (un-cropped) portion.
const ANCHOR = {
  nh: [-71.45, 43.6], mass: [-71.7, 42.5], rhode: [-71.45, 41.55], conn: [-73.0, 41.4],
  vermont: [-72.9, 44.35], ny: [-75.3, 42.95], nj: [-74.5, 40.1], del: [-75.45, 39.05],
  md: [-77.2, 39.45], va: [-79.5, 38.3], quebec: [-73.5, 46.9],
  ohio: [-82.7, 40.3], appalachia: [-82.3, 36.3], florida: [-82.0, 30.45],
};

const regions = {};
for (const id in PLAYABLE) {
  const c = ANCHOR[id] ? px(...ANCHOR[id]) : px(...centroidOf(PLAYABLE[id]));
  regions[id] = { path: regionPath(PLAYABLE[id]), cx: +c[0].toFixed(1), cy: +c[1].toFixed(1) };
}
{
  const c = px(...ANCHOR.quebec);
  regions.quebec = { path: customPath(QUEBEC_RING), cx: +c[0].toFixed(1), cy: +c[1].toFixed(1) };
}

const terrain = TERRAIN.map((n) => { const f = featByName(n); return f ? geomPath(f.geometry) : null; }).filter(Boolean);

// Decorative, non-interactive sub-labels (lon, lat).
const ANNOTATIONS = [
  { text: "District of Maine", lonlat: [-69.3, 45.3] },
];
const annotations = ANNOTATIONS.map((a) => {
  const [x, y] = px(...a.lonlat);
  return { text: a.text, x: +x.toFixed(1), y: +y.toFixed(1) };
});

const MAPDATA = {
  viewBox: `0 0 ${WIDTH.toFixed(0)} ${HEIGHT.toFixed(0)}`,
  terrain,
  regions,
  annotations,
};

fs.writeFileSync("/tmp/mapdata.js", "var MAPDATA = " + JSON.stringify(MAPDATA) + ";\n");
console.log("viewBox:", MAPDATA.viewBox);
console.log("region anchors:");
for (const id in regions) console.log(" ", id.padEnd(11), regions[id].cx, regions[id].cy, "pathlen", regions[id].path.length);
console.log("terrain shapes:", terrain.length, "| annotations:", annotations.length);
console.log("file bytes:", fs.statSync("/tmp/mapdata.js").size);
