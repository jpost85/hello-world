/**
 * genmap — project Natural Earth country geometry into the game's world map.
 *
 * Reads `tools/data/ne_110m_admin_0_countries.geojson` (public-domain Natural
 * Earth, admin-0, 1:110m) and emits `src/engine/maps/worldMap.ts`: a curated set
 * of territories grouped into real continents, each backed by real country
 * polygons (a few large nations split along meridians), with an equirectangular
 * SVG projection, centroids for unit badges, and adjacency derived from shared
 * borders plus a curated list of sea routes.
 *
 *   node tools/genmap.mjs
 *
 * This is the Dominion equivalent of Liberty's Call's `tools-genmap.js`.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const DATA_PATH = "tools/data/ne_110m_admin_0_countries.geojson";
const DATA_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";

/** Download the public-domain Natural Earth source once if it isn't present. */
async function ensureData() {
  if (existsSync(DATA_PATH)) return;
  console.log(`fetching ${DATA_URL}`);
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  mkdirSync("tools/data", { recursive: true });
  writeFileSync(DATA_PATH, Buffer.from(await res.arrayBuffer()));
}
await ensureData();

const WIDTH = 1000;
const HEIGHT = 500;
/** Two territories are considered land-adjacent if their borders come within this many degrees. */
const LAND_THRESHOLD = 0.2;

// --- Curated territory specification ---------------------------------------
// region bonus values are set in REGIONS below.
const SPEC = [
  // North America
  { id: "alaska", name: "Alaska", region: "north-america", countries: ["United States of America"], clip: { lngMax: -141 } },
  { id: "western-canada", name: "Western Canada", region: "north-america", countries: ["Canada"], clip: { lngMax: -95 } },
  { id: "eastern-canada", name: "Eastern Canada", region: "north-america", countries: ["Canada"], clip: { lngMin: -95 } },
  { id: "greenland", name: "Greenland", region: "north-america", countries: ["Greenland"] },
  { id: "western-us", name: "Western United States", region: "north-america", countries: ["United States of America"], clip: { lngMin: -141, lngMax: -100 } },
  { id: "eastern-us", name: "Eastern United States", region: "north-america", countries: ["United States of America"], clip: { lngMin: -100 } },
  { id: "mexico", name: "Mexico", region: "north-america", countries: ["Mexico"] },
  { id: "central-america", name: "Central America", region: "north-america", countries: ["Guatemala", "Belize", "Honduras", "El Salvador", "Nicaragua", "Costa Rica", "Panama"] },
  { id: "caribbean", name: "Caribbean", region: "north-america", countries: ["Cuba", "Haiti", "Dominican Republic", "Jamaica", "The Bahamas", "Puerto Rico", "Trinidad and Tobago"] },

  // South America
  { id: "venezuela", name: "Venezuela", region: "south-america", countries: ["Venezuela", "Guyana", "Suriname"] },
  { id: "colombia", name: "Colombia", region: "south-america", countries: ["Colombia", "Ecuador"], keepBounds: { lngMin: -82, lngMax: -66, latMin: -6, latMax: 13 } },
  { id: "brazil", name: "Brazil", region: "south-america", countries: ["Brazil"] },
  { id: "peru", name: "Peru", region: "south-america", countries: ["Peru", "Bolivia"] },
  { id: "argentina", name: "Argentina", region: "south-america", countries: ["Argentina", "Paraguay", "Uruguay"] },
  { id: "chile", name: "Chile", region: "south-america", countries: ["Chile"], keepBounds: { lngMin: -77, lngMax: -66, latMin: -56, latMax: -17 } },

  // Western Europe
  { id: "iceland", name: "Iceland", region: "western-europe", countries: ["Iceland"] },
  { id: "united-kingdom", name: "British Isles", region: "western-europe", countries: ["United Kingdom", "Ireland"] },
  { id: "france", name: "France", region: "western-europe", countries: ["France", "Netherlands", "Belgium", "Luxembourg"], keepBounds: { lngMin: -6, lngMax: 10, latMin: 41, latMax: 54 } },
  { id: "iberia", name: "Iberia", region: "western-europe", countries: ["Spain", "Portugal"], keepBounds: { lngMin: -10, lngMax: 4, latMin: 35, latMax: 44 } },
  { id: "germany", name: "Germany", region: "western-europe", countries: ["Germany", "Denmark", "Switzerland", "Austria", "Czechia", "Slovenia"], keepBounds: { lngMin: 5, lngMax: 20, latMin: 45, latMax: 58 } },
  { id: "italy", name: "Italy", region: "western-europe", countries: ["Italy"] },

  // Eastern Europe
  { id: "scandinavia", name: "Scandinavia", region: "eastern-europe", countries: ["Norway", "Sweden", "Finland"], keepBounds: { lngMin: 4, lngMax: 32, latMin: 54, latMax: 72 } },
  { id: "poland", name: "Poland & Baltics", region: "eastern-europe", countries: ["Poland", "Estonia", "Latvia", "Lithuania", "Slovakia", "Hungary"] },
  { id: "ukraine", name: "Ukraine & Belarus", region: "eastern-europe", countries: ["Ukraine", "Belarus", "Moldova"] },
  { id: "balkans", name: "Balkans", region: "eastern-europe", countries: ["Croatia", "Bosnia and Herzegovina", "Republic of Serbia", "Montenegro", "Kosovo", "North Macedonia", "Albania", "Romania", "Bulgaria", "Greece"] },

  // North Asia
  { id: "western-russia", name: "Western Russia", region: "north-asia", countries: ["Russia"], clip: { lngMax: 60 }, normalizeRussia: true },
  { id: "siberia", name: "Siberia", region: "north-asia", countries: ["Russia"], clip: { lngMin: 60, lngMax: 115 }, normalizeRussia: true },
  { id: "far-east-russia", name: "Far East Russia", region: "north-asia", countries: ["Russia"], clip: { lngMin: 115, lngMax: 180 }, normalizeRussia: true },
  { id: "central-asia", name: "Central Asia", region: "north-asia", countries: ["Kazakhstan", "Uzbekistan", "Turkmenistan", "Tajikistan", "Kyrgyzstan"] },

  // Middle East
  { id: "turkey", name: "Turkey", region: "middle-east", countries: ["Turkey", "Cyprus", "Northern Cyprus"] },
  { id: "caucasus", name: "Caucasus", region: "middle-east", countries: ["Georgia", "Armenia", "Azerbaijan"] },
  { id: "levant", name: "Levant & Iraq", region: "middle-east", countries: ["Syria", "Lebanon", "Jordan", "Israel", "Palestine", "Iraq"] },
  { id: "iran", name: "Iran", region: "middle-east", countries: ["Iran"] },
  { id: "arabia", name: "Arabia", region: "middle-east", countries: ["Saudi Arabia", "Yemen", "Oman", "United Arab Emirates", "Qatar", "Kuwait"] },

  // South & East Asia
  { id: "china", name: "China", region: "asia", countries: ["China", "Taiwan", "Mongolia"] },
  { id: "korea", name: "Korea", region: "asia", countries: ["North Korea", "South Korea"] },
  { id: "japan", name: "Japan", region: "asia", countries: ["Japan"] },
  { id: "afghanistan-pakistan", name: "Afghanistan & Pakistan", region: "asia", countries: ["Afghanistan", "Pakistan"] },
  { id: "india", name: "India", region: "asia", countries: ["India", "Nepal", "Bhutan", "Bangladesh", "Sri Lanka"] },
  { id: "indochina", name: "Indochina", region: "asia", countries: ["Myanmar", "Thailand", "Laos", "Cambodia", "Vietnam"] },
  { id: "indonesia", name: "Indonesia", region: "asia", countries: ["Indonesia", "East Timor", "Malaysia", "Brunei"] },
  { id: "philippines", name: "Philippines", region: "asia", countries: ["Philippines"] },

  // Africa
  { id: "maghreb", name: "Maghreb", region: "africa", countries: ["Morocco", "Western Sahara", "Algeria", "Tunisia"] },
  { id: "libya", name: "Libya", region: "africa", countries: ["Libya"] },
  { id: "egypt", name: "Egypt", region: "africa", countries: ["Egypt"] },
  { id: "west-africa", name: "West Africa", region: "africa", countries: ["Mauritania", "Mali", "Niger", "Senegal", "Gambia", "Guinea-Bissau", "Guinea", "Sierra Leone", "Liberia", "Ivory Coast", "Burkina Faso", "Ghana", "Togo", "Benin", "Nigeria"] },
  { id: "central-africa", name: "Central Africa", region: "africa", countries: ["Chad", "Cameroon", "Central African Republic", "Equatorial Guinea", "Gabon", "Republic of the Congo", "Democratic Republic of the Congo", "Angola"] },
  { id: "horn-africa", name: "Horn of Africa", region: "africa", countries: ["Sudan", "South Sudan", "Eritrea", "Ethiopia", "Djibouti", "Somalia", "Somaliland"] },
  { id: "east-africa", name: "East Africa", region: "africa", countries: ["Kenya", "Uganda", "Rwanda", "Burundi", "United Republic of Tanzania"] },
  { id: "southern-africa", name: "Southern Africa", region: "africa", countries: ["Namibia", "Botswana", "Zimbabwe", "Zambia", "Malawi", "Mozambique", "South Africa", "Lesotho", "eSwatini"] },
  { id: "madagascar", name: "Madagascar", region: "africa", countries: ["Madagascar"] },

  // Oceania
  { id: "western-australia", name: "Western Australia", region: "oceania", countries: ["Australia"], clip: { lngMax: 135 } },
  { id: "eastern-australia", name: "Eastern Australia", region: "oceania", countries: ["Australia"], clip: { lngMin: 135 } },
  { id: "new-guinea", name: "New Guinea", region: "oceania", countries: ["Papua New Guinea", "Solomon Islands"] },
  { id: "new-zealand", name: "New Zealand", region: "oceania", countries: ["New Zealand"] },
];

// Continent bonuses are derived from the graph below (size + chokepoint burden),
// not hand-set, so they stay balanced as the territory set changes.
const REGIONS = [
  { id: "north-america", name: "North America" },
  { id: "south-america", name: "South America" },
  { id: "western-europe", name: "Western Europe" },
  { id: "eastern-europe", name: "Eastern Europe" },
  { id: "north-asia", name: "North Asia" },
  { id: "middle-east", name: "Middle East" },
  { id: "asia", name: "South & East Asia" },
  { id: "africa", name: "Africa" },
  { id: "oceania", name: "Oceania" },
];

/** Curated sea/strait routes (undirected). Land borders are derived automatically. */
const SEA_LINKS = [
  ["alaska", "far-east-russia"],
  ["greenland", "eastern-canada"],
  ["greenland", "iceland"],
  ["iceland", "united-kingdom"],
  ["iceland", "scandinavia"],
  ["united-kingdom", "france"],
  ["caribbean", "central-america"],
  ["caribbean", "eastern-us"],
  ["caribbean", "mexico"],
  ["caribbean", "venezuela"],
  ["brazil", "west-africa"],
  ["iberia", "maghreb"],
  ["italy", "maghreb"],
  ["italy", "balkans"],
  ["egypt", "arabia"],
  ["arabia", "horn-africa"],
  ["madagascar", "southern-africa"],
  ["madagascar", "east-africa"],
  ["china", "philippines"],
  ["china", "japan"],
  ["korea", "japan"],
  ["japan", "far-east-russia"],
  ["philippines", "indonesia"],
  ["indonesia", "western-australia"],
  ["indonesia", "new-guinea"],
  ["new-guinea", "eastern-australia"],
  ["new-zealand", "eastern-australia"],
  ["india", "arabia"],
];

// --- Geometry helpers ------------------------------------------------------

/** Normalise a geometry into a flat list of rings ([[lng,lat],...]); outer rings only. */
function ringsOf(geometry) {
  const rings = [];
  if (geometry.type === "Polygon") {
    rings.push(geometry.coordinates[0]);
  } else if (geometry.type === "MultiPolygon") {
    for (const poly of geometry.coordinates) rings.push(poly[0]);
  }
  return rings.map((r) => r.map(([lng, lat]) => [lng, lat]));
}

/** Clip a ring to one side of a vertical line x=c (Sutherland-Hodgman half-plane). */
function clipHalf(ring, c, keepGreater) {
  const out = [];
  const inside = (p) => (keepGreater ? p[0] >= c : p[0] <= c);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const ain = inside(a);
    const bin = inside(b);
    if (ain) out.push(a);
    if (ain !== bin) {
      const t = (c - a[0]) / (b[0] - a[0]);
      out.push([c, a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}

/** True if a ring's average position lies within the given lng/lat bounds. */
function ringInBounds(ring, b) {
  let lng = 0;
  let lat = 0;
  for (const p of ring) {
    lng += p[0];
    lat += p[1];
  }
  lng /= ring.length;
  lat /= ring.length;
  return lng >= b.lngMin && lng <= b.lngMax && lat >= b.latMin && lat <= b.latMax;
}

function clipRing(ring, clip) {
  let r = ring;
  if (clip.lngMin !== undefined) r = clipHalf(r, clip.lngMin, true);
  if (r.length && clip.lngMax !== undefined) r = clipHalf(r, clip.lngMax, false);
  return r;
}

const project = ([lng, lat]) => [
  ((lng + 180) / 360) * WIDTH,
  ((90 - lat) / 180) * HEIGHT,
];

const round = (n) => Math.round(n * 10) / 10;

/** Area-weighted centroid + signed area of a projected ring. */
function ringCentroid(points) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  area /= 2;
  if (Math.abs(area) < 1e-6) {
    const avg = points.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
    return { cx: avg[0] / points.length, cy: avg[1] / points.length, area: 0 };
  }
  return { cx: cx / (6 * area), cy: cy / (6 * area), area: Math.abs(area) };
}

// --- Build territories -----------------------------------------------------

const fc = JSON.parse(readFileSync(DATA_PATH, "utf8"));
const byName = new Map();
for (const f of fc.features) byName.set(f.properties.ADMIN, f);

const territories = [];
const geoRings = new Map(); // id -> array of rings in lng/lat (for adjacency)

for (const spec of SPEC) {
  const projectedRings = [];
  const lngLatRings = [];

  for (const country of spec.countries) {
    const feature = byName.get(country);
    if (!feature) {
      console.warn(`!! missing country: ${country} (territory ${spec.id})`);
      continue;
    }
    for (let ring of ringsOf(feature.geometry)) {
      // Drop far-flung overseas rings (e.g. French Guiana, Canary Islands) that
      // would otherwise create spurious adjacency or stray dots in the ocean.
      if (spec.keepBounds && !ringInBounds(ring, spec.keepBounds)) continue;
      if (spec.normalizeRussia) ring = ring.map(([lng, lat]) => [lng < -100 ? lng + 360 : lng, lat]);
      if (spec.clip) ring = clipRing(ring, spec.clip);
      if (ring.length < 3) continue;
      lngLatRings.push(ring);
      projectedRings.push(ring.map(project));
    }
  }

  if (!projectedRings.length) {
    console.warn(`!! no geometry for territory ${spec.id}`);
    continue;
  }

  // Path string + largest-ring centroid for the unit badge.
  let best = null;
  const path = projectedRings
    .map((pts) => {
      const c = ringCentroid(pts);
      if (!best || c.area > best.area) best = c;
      return "M" + pts.map(([x, y]) => `${round(x)} ${round(y)}`).join("L") + "Z";
    })
    .join("");

  territories.push({
    id: spec.id,
    name: spec.name,
    regionId: spec.region,
    position: { x: round(best.cx), y: round(best.cy) },
    path,
  });
  geoRings.set(spec.id, lngLatRings);
}

// --- Derive adjacency ------------------------------------------------------

function minDegDistance(ringsA, ringsB) {
  let min = Infinity;
  for (const ra of ringsA) {
    for (const pa of ra) {
      for (const rb of ringsB) {
        for (const pb of rb) {
          const dx = pa[0] - pb[0];
          const dy = pa[1] - pb[1];
          const d = dx * dx + dy * dy;
          if (d < min) min = d;
        }
      }
    }
  }
  return Math.sqrt(min);
}

const adj = new Map(territories.map((t) => [t.id, new Set()]));
const link = (a, b) => {
  if (a === b || !adj.has(a) || !adj.has(b)) return;
  adj.get(a).add(b);
  adj.get(b).add(a);
};

const ids = territories.map((t) => t.id);
for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    if (minDegDistance(geoRings.get(ids[i]), geoRings.get(ids[j])) < LAND_THRESHOLD) {
      link(ids[i], ids[j]);
    }
  }
}
for (const [a, b] of SEA_LINKS) link(a, b);

for (const t of territories) t.adjacentTo = [...adj.get(t.id)].sort();

// Sea routes are drawn as explicit connecting lines (land borders are visible
// where shapes touch). Keep only links whose endpoints both exist.
const haveId = new Set(territories.map((t) => t.id));
const connectors = SEA_LINKS.filter(([a, b]) => haveId.has(a) && haveId.has(b));

// --- Connectivity check (BFS) ---------------------------------------------

const seen = new Set([ids[0]]);
const queue = [ids[0]];
while (queue.length) {
  const cur = queue.shift();
  for (const n of adj.get(cur)) if (!seen.has(n)) (seen.add(n), queue.push(n));
}
const isolated = ids.filter((id) => !seen.has(id));
console.log(`territories: ${territories.length}, regions: ${REGIONS.length}`);
console.log(`graph connected: ${isolated.length === 0}${isolated.length ? " — isolated: " + isolated.join(", ") : ""}`);
console.log("degree<=1:", ids.filter((id) => adj.get(id).size <= 1).join(", ") || "none");

// --- Emit worldMap.ts ------------------------------------------------------

const regionOf = new Map(territories.map((t) => [t.id, t.regionId]));
const regionsOut = REGIONS.map((r) => {
  const members = territories.filter((t) => t.regionId === r.id);
  // Border territories (chokepoints) = those adjacent to another continent.
  const borders = members.filter((t) =>
    t.adjacentTo.some((n) => regionOf.get(n) !== r.id),
  ).length;
  // Bonus rewards size and the defensive burden of holding the borders.
  const bonusArmies = Math.max(2, Math.round((members.length + 2 * borders) / 3));
  return {
    id: r.id,
    name: r.name,
    bonusArmies,
    territoryIds: members.map((t) => t.id),
  };
});

console.log("continent        T  B  bonus");
for (const r of regionsOut) {
  const T = r.territoryIds.length;
  const B = r.territoryIds.filter((id) =>
    territories.find((t) => t.id === id).adjacentTo.some((n) => regionOf.get(n) !== r.id),
  ).length;
  console.log(r.name.padEnd(16), String(T).padStart(2), String(B).padStart(2), String(r.bonusArmies).padStart(5));
}

const out = `// AUTO-GENERATED by tools/genmap.mjs — do not edit by hand.
// Source: Natural Earth admin-0 countries, 1:110m (public domain).
// Regenerate with: node tools/genmap.mjs

import type { GameMap } from "../types.ts";

export const worldMap: GameMap = ${JSON.stringify(
  {
    id: "world",
    name: "World",
    viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
    regions: regionsOut,
    territories,
    connectors,
  },
  null,
  0,
)};
`;

writeFileSync("src/engine/maps/worldMap.ts", out);
console.log(`wrote src/engine/maps/worldMap.ts (${(out.length / 1024).toFixed(0)} KB)`);
