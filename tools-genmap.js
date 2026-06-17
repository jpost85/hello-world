/* Build map path data for Liberty's Call from US-state and Canadian-province
   GeoJSON. Outputs /tmp/mapdata.js with a MAPDATA object:
   { viewBox, terrain[], regions{}, annotations[] }

   Inputs (fetch into /tmp before running):
     /tmp/us-states.json   https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json
     /tmp/canada.geojson   https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/canada.geojson

   Dev dependency (not needed to play): npm install polygon-clipping
   (used to dissolve multi-state regions into a single outline).

   - Playable regions use real outlines in their colonial configurations
     (e.g. Massachusetts incl. the District of Maine; Virginia incl. WV).
   - Every other state/province whose bounding box overlaps the visible window
     is emitted as non-interactive terrain, so the whole landmass is filled and
     only real water (Atlantic, Gulf, Great Lakes, St. Lawrence) shows as water.
   - Dense Canadian coastlines are simplified, since they're only backdrop. */
const fs = require("fs");
const polygonClipping = require("polygon-clipping");
const us = JSON.parse(fs.readFileSync("/tmp/us-states.json", "utf8"));
const ca = JSON.parse(fs.readFileSync("/tmp/canada.geojson", "utf8"));
const FEATURES = us.features.concat(ca.features); // names are unique across both

const PLAYABLE = {
  // Original thirteen colonies (Maine was part of Massachusetts; West
  // Virginia was part of Virginia).
  maine: "Maine",            // the District of Maine (administered by Mass.)
  nh:    "New Hampshire",
  mass:  "Massachusetts",
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
  ontario:    "Ontario",                 // the Ontario peninsula (British Canada)
  novascotia: "Nova Scotia",             // British Nova Scotia (Halifax naval base)
  ohio:       "Ohio",                    // the Ohio Country / Northwest frontier
  appalachia: ["Kentucky", "Tennessee"], // trans-Appalachian backcountry
  alabama:    "Alabama",                 // the Alabama / Mississippi Gulf frontier
  florida:    "Florida",                 // East Florida (cropped to its north)
  quebec:     "Quebec",                  // Province of Quebec (cropped to its south)
};
// Regions kept out of the projection bounds so a long tail (Florida's
// peninsula, Kentucky/Tennessee to the Mississippi, Quebec/Ontario to the
// Arctic, Nova Scotia reaching east) doesn't stretch the map; they crop at the
// frame edge instead.
const NO_BOUNDS = new Set(["florida", "appalachia", "quebec", "ontario", "novascotia"]);

function featByName(name) { return FEATURES.find((f) => f.properties.name === name); }
function statesOf(v) { return Array.isArray(v) ? v : [v]; }
function ringsOf(geom) {
  if (geom.type === "Polygon") return geom.coordinates;
  return geom.coordinates.flat(); // MultiPolygon -> all rings
}
function polygonsOf(geom) {
  return geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
}
function bboxOf(geom) {
  let mnx = 9e9, mny = 9e9, mxx = -9e9, mxy = -9e9;
  for (const r of ringsOf(geom)) for (const [x, y] of r) {
    if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y;
  }
  return { mnx, mny, mxx, mxy };
}
// Radial-distance simplification: drop points within `tol` degrees of the last
// kept one. Only worth it for dense rings (Canadian coastlines).
function simplifyRing(ring, tol) {
  if (ring.length <= 120) return ring;
  const out = [ring[0]];
  let [lx, ly] = ring[0];
  for (let i = 1; i < ring.length - 1; i++) {
    const [x, y] = ring[i];
    if (Math.hypot(x - lx, y - ly) >= tol) { out.push(ring[i]); lx = x; ly = y; }
  }
  out.push(ring[ring.length - 1]);
  return out;
}

// --- Projection bounds (from playable regions not flagged NO_BOUNDS) ---
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

const PAD = 0.4; // degrees of margin
minLon -= PAD; maxLon += PAD; minLat -= PAD; maxLat += PAD;
minLon = Math.min(minLon, -89.5); // west crop: just past Alabama; trims the far interior
maxLon = Math.max(maxLon, -62.0); // extend east: Maritimes + Atlantic fill the right
minLat = Math.min(minLat, 29.1);  // extend south to reveal north Florida
maxLat = Math.max(maxLat, 48.8);  // extend north to frame Quebec / Canada
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
function geomPath(geom) { return ringsOf(geom).map((r) => ringPath(simplifyRing(r, 0.12))).join(" "); }
function polygonsOfName(n) {
  const g = featByName(n).geometry;
  return g.type === "Polygon" ? [g.coordinates] : g.coordinates;
}
// Multi-state regions are dissolved into a single outline (shared internal
// borders removed) by unioning their polygons; single states pass through.
function regionPath(v) {
  const names = statesOf(v);
  if (names.length === 1) return geomPath(featByName(names[0]).geometry);
  let acc = polygonsOfName(names[0]);
  for (let i = 1; i < names.length; i++) acc = polygonClipping.union(acc, polygonsOfName(names[i]));
  return acc.flatMap((poly) => poly.map((ring) => ringPath(simplifyRing(ring, 0.12)))).join(" ");
}

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
  maine: [-69.2, 45.25], nh: [-71.45, 43.6], mass: [-71.8, 42.4], rhode: [-71.45, 41.55], conn: [-73.0, 41.4],
  vermont: [-72.9, 44.35], ny: [-75.3, 42.95], nj: [-74.5, 40.1], del: [-75.45, 39.05],
  md: [-77.2, 39.45], va: [-79.5, 38.3], quebec: [-71.5, 47.2],
  ohio: [-82.7, 40.3], appalachia: [-85.8, 36.4], florida: [-83.0, 29.65], ontario: [-80.6, 43.6],
  novascotia: [-64.7, 45.0], alabama: [-86.8, 32.7],
};

const regions = {};
for (const id in PLAYABLE) {
  const c = ANCHOR[id] ? px(...ANCHOR[id]) : px(...centroidOf(PLAYABLE[id]));
  regions[id] = { path: regionPath(PLAYABLE[id]), cx: +c[0].toFixed(1), cy: +c[1].toFixed(1) };
}

// City sub-regions: point markers placed at the real city, inside their colony.
const CITY_POINTS = {
  boston:       [-70.70, 42.15],
  nyc:          [-74.00, 40.71],
  philadelphia: [-75.16, 39.95],
  yorktown:     [-76.51, 37.24],
  charleston:   [-79.93, 32.78],
  savannah:     [-81.10, 32.08],
  halifax:      [-63.57, 44.65],
};
for (const id in CITY_POINTS) {
  const c = px(...CITY_POINTS[id]);
  regions[id] = { point: true, cx: +c[0].toFixed(1), cy: +c[1].toFixed(1) };
}

// Sea zones: offshore nodes in the Atlantic (harbors defined game-side).
const SEA_POINTS = {
  north: [-66.0, 42.8],
  mid:   [-72.0, 36.8],
  south: [-77.2, 32.1],
};
const seaZones = {};
for (const id in SEA_POINTS) {
  const c = px(...SEA_POINTS[id]);
  seaZones[id] = { cx: +c[0].toFixed(1), cy: +c[1].toFixed(1) };
}

// Terrain = every other state/province overlapping the visible window.
const playableNames = new Set();
for (const id in PLAYABLE) for (const n of statesOf(PLAYABLE[id])) playableNames.add(n);
const M = 1.0; // window margin (degrees)
const terrain = [];
for (const f of FEATURES) {
  if (playableNames.has(f.properties.name)) continue;
  const b = bboxOf(f.geometry);
  if (b.mxx < minLon - M || b.mnx > maxLon + M || b.mxy < minLat - M || b.mny > maxLat + M) continue;
  terrain.push(geomPath(f.geometry));
}

const MAPDATA = {
  viewBox: `0 0 ${WIDTH.toFixed(0)} ${HEIGHT.toFixed(0)}`,
  terrain,
  regions,
  seaZones,
  annotations: [],
};

fs.writeFileSync("/tmp/mapdata.js", "var MAPDATA = " + JSON.stringify(MAPDATA) + ";\n");
console.log("viewBox:", MAPDATA.viewBox);
for (const id in regions) console.log(" ", id.padEnd(12), regions[id].cx, regions[id].cy, regions[id].point ? "(city)" : "pathlen " + regions[id].path.length);
console.log("terrain shapes:", terrain.length);
console.log("file bytes:", fs.statSync("/tmp/mapdata.js").size);
