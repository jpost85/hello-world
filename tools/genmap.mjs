/**
 * genmap — project Natural Earth country geometry into the game's maps.
 *
 * Generates every map in the MAPS list below into `src/engine/maps/<file>.ts`.
 * Each map config picks a dataset (1:110m world / 1:50m regional detail), an
 * optional regional `crop` (so a theatre fills the screen and mainland coasts
 * are trimmed to the region), a curated territory `spec`, `regions`, and curated
 * sea routes. Continent bonuses are derived from the graph (size + chokepoints).
 *
 *   node tools/genmap.mjs
 *
 * This is the Dominion equivalent of Liberty's Call's `tools-genmap.js`.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const WIDTH = 1000;
const SIMPLIFY_DECOR = 1.5;

const DATASETS = {
  "110m": "ne_110m_admin_0_countries.geojson",
  "50m": "ne_50m_admin_0_countries.geojson",
};
const BASE_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/";

/** Download a Natural Earth dataset once if absent, and index it by ADMIN name. */
const datasetCache = new Map();
async function loadDataset(key) {
  if (datasetCache.has(key)) return datasetCache.get(key);
  const file = DATASETS[key];
  const path = `tools/data/${file}`;
  if (!existsSync(path)) {
    console.log(`fetching ${BASE_URL}${file}`);
    const res = await fetch(`${BASE_URL}${file}`);
    if (!res.ok) throw new Error(`download failed: ${res.status}`);
    mkdirSync("tools/data", { recursive: true });
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  const fc = JSON.parse(readFileSync(path, "utf8"));
  const byName = new Map();
  for (const f of fc.features) byName.set(f.properties.ADMIN ?? f.properties.NAME, f);
  datasetCache.set(key, byName);
  return byName;
}

/**
 * Load an admin-1 (states/provinces) dataset and index it by `${admin}|${name}`,
 * so territories can be built from real sub-national borders (e.g. Indian states
 * grouped into historical regions) instead of straight clip lines.
 */
const provinceCache = new Map();
async function loadProvinces(key) {
  if (provinceCache.has(key)) return provinceCache.get(key);
  const file = `ne_${key}_admin_1_states_provinces.geojson`;
  const path = `tools/data/${file}`;
  if (!existsSync(path)) {
    console.log(`fetching ${BASE_URL}${file}`);
    const res = await fetch(`${BASE_URL}${file}`);
    if (!res.ok) throw new Error(`download failed: ${res.status}`);
    mkdirSync("tools/data", { recursive: true });
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  const fc = JSON.parse(readFileSync(path, "utf8"));
  const idx = new Map();
  for (const f of fc.features) idx.set(`${f.properties.admin}|${f.properties.name}`, f);
  provinceCache.set(key, idx);
  return idx;
}

// ===========================================================================
// Shared geometry helpers
// ===========================================================================

/** Normalise a geometry into a flat list of rings ([[lng,lat],...]); outer rings only. */
function ringsOf(geometry) {
  const rings = [];
  if (geometry.type === "Polygon") rings.push(geometry.coordinates[0]);
  else if (geometry.type === "MultiPolygon") for (const poly of geometry.coordinates) rings.push(poly[0]);
  return rings.map((r) => r.map(([lng, lat]) => [lng, lat]));
}

/** Clip a ring to one side of an axis line (Sutherland-Hodgman half-plane). */
function clipAxis(ring, axis, c, keepGreater) {
  const out = [];
  const inside = (p) => (keepGreater ? p[axis] >= c : p[axis] <= c);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const ain = inside(a);
    const bin = inside(b);
    if (ain) out.push(a);
    if (ain !== bin) {
      const t = (c - a[axis]) / (b[axis] - a[axis]);
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}

function clipRing(ring, clip) {
  let r = ring;
  if (clip.lngMin !== undefined) r = clipAxis(r, 0, clip.lngMin, true);
  if (r.length && clip.lngMax !== undefined) r = clipAxis(r, 0, clip.lngMax, false);
  if (r.length && clip.latMin !== undefined) r = clipAxis(r, 1, clip.latMin, true);
  if (r.length && clip.latMax !== undefined) r = clipAxis(r, 1, clip.latMax, false);
  return r;
}

/** Clip a ring to a lng/lat bounding box (used to trim coasts to a theatre). */
function clipToBox(ring, box) {
  let r = clipAxis(ring, 0, box.lngMin, true);
  if (r.length) r = clipAxis(r, 0, box.lngMax, false);
  if (r.length) r = clipAxis(r, 1, box.latMin, true);
  if (r.length) r = clipAxis(r, 1, box.latMax, false);
  return r;
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

const round = (n) => Math.round(n);

function perpDist(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Douglas-Peucker simplification (endpoints kept, so closed rings stay closed). */
function simplify(points, eps) {
  if (points.length < 4) return points;
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDist(points[i], points[s], points[e]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > eps && idx !== -1) {
      keep[idx] = true;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

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

/** Build an SVG path from projected rings: simplify, integer-round, M/L/Z. */
function buildPath(projectedRings, eps) {
  let best = null;
  const d = projectedRings
    .map((pts) => {
      const simplified = simplify(pts, eps);
      const ring = simplified.length >= 3 ? simplified : pts;
      const c = ringCentroid(ring);
      if (!best || c.area > best.area) best = c;
      return "M" + ring.map(([x, y]) => `${round(x)} ${round(y)}`).join("L") + "Z";
    })
    .join("");
  return { d, centroid: best };
}

function minDegDistance(ringsA, ringsB) {
  let min = Infinity;
  for (const ra of ringsA)
    for (const pa of ra)
      for (const rb of ringsB)
        for (const pb of rb) {
          const dx = pa[0] - pb[0];
          const dy = pa[1] - pb[1];
          const d = dx * dx + dy * dy;
          if (d < min) min = d;
        }
  return Math.sqrt(min);
}

// ===========================================================================
// Per-map generation
// ===========================================================================

function generateMap(cfg, byName, provIndex) {
  const W = WIDTH;
  let H;
  let project;
  if (cfg.crop) {
    // Territories are clipped to `crop`; the viewBox adds `pad` degrees of ocean
    // buffer around it so the map isn't tight against the edges.
    const pad = cfg.pad ?? 0;
    const lngMin = cfg.crop.lngMin - pad;
    const lngMax = cfg.crop.lngMax + pad;
    const latMin = cfg.crop.latMin - pad;
    const latMax = cfg.crop.latMax + pad;
    const s = W / (lngMax - lngMin);
    H = Math.round((latMax - latMin) * s);
    project = ([lng, lat]) => [(lng - lngMin) * s, (latMax - lat) * s];
  } else {
    H = 500;
    project = ([lng, lat]) => [((lng + 180) / 360) * W, ((90 - lat) / 180) * H];
  }
  const simplifyT = cfg.simplifyTerritory ?? 0.7;
  const landThreshold = cfg.landThreshold ?? 0.2;

  const territories = [];
  const geoRings = new Map(); // id -> lng/lat rings (for adjacency)

  for (const spec of cfg.spec) {
    const rings = [];
    // A territory is built from whole countries (admin-0) and/or provinces
    // (admin-1, for organic sub-national borders).
    const features = [];
    for (const country of spec.countries ?? []) {
      const f = byName.get(country);
      if (f) features.push(f);
      else console.warn(`!! [${cfg.id}] missing country: ${country} (${spec.id})`);
    }
    for (const province of spec.provinces ?? []) {
      const f = provIndex?.get(`${spec.admin}|${province}`);
      if (f) features.push(f);
      else console.warn(`!! [${cfg.id}] missing province: ${spec.admin}/${province} (${spec.id})`);
    }
    for (const feature of features) {
      for (let ring of ringsOf(feature.geometry)) {
        if (spec.keepBounds && !ringInBounds(ring, spec.keepBounds)) continue;
        if (spec.normalizeRussia) ring = ring.map(([lng, lat]) => [lng < -100 ? lng + 360 : lng, lat]);
        if (spec.clip) ring = clipRing(ring, spec.clip);
        if (ring.length >= 3 && cfg.crop) ring = clipToBox(ring, cfg.crop);
        if (ring.length < 3) continue;
        rings.push(ring);
      }
    }
    // Point enclave (e.g. a colonial port): a small disc at a coordinate.
    if (spec.point) {
      const [lng, lat] = spec.point;
      const rad = spec.radiusDeg ?? 0.45;
      const ring = [];
      for (let a = 0; a < 18; a++) {
        const th = (a / 18) * 2 * Math.PI;
        ring.push([lng + rad * Math.cos(th), lat + rad * Math.sin(th)]);
      }
      rings.push(cfg.crop ? clipToBox(ring, cfg.crop) : ring);
    }
    if (!rings.length) {
      console.warn(`!! [${cfg.id}] no geometry for ${spec.id}`);
      continue;
    }
    const { d: path, centroid: best } = buildPath(rings.map((r) => r.map(project)), simplifyT);
    territories.push({
      id: spec.id,
      name: spec.name,
      regionId: spec.region,
      position: { x: round(best.cx), y: round(best.cy) },
      path,
    });
    geoRings.set(spec.id, rings);
  }

  // Adjacency: shared borders (within the region) + curated sea routes.
  const adj = new Map(territories.map((t) => [t.id, new Set()]));
  const link = (a, b) => {
    if (a === b || !adj.has(a) || !adj.has(b)) return;
    adj.get(a).add(b);
    adj.get(b).add(a);
  };
  const ids = territories.map((t) => t.id);
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++)
      if (minDegDistance(geoRings.get(ids[i]), geoRings.get(ids[j])) < landThreshold) link(ids[i], ids[j]);
  for (const [a, b] of cfg.seaLinks) link(a, b);
  // Non-drawn adjacency (e.g. a colonial enclave to its hinterland region).
  for (const [a, b] of cfg.links ?? []) link(a, b);
  for (const t of territories) t.adjacentTo = [...adj.get(t.id)].sort();

  const haveId = new Set(ids);
  const connectors = cfg.seaLinks.filter(([a, b]) => haveId.has(a) && haveId.has(b));

  // Connectivity (BFS) — every game must be winnable.
  const seen = new Set([ids[0]]);
  const queue = [ids[0]];
  while (queue.length) {
    const cur = queue.shift();
    for (const n of adj.get(cur)) if (!seen.has(n)) (seen.add(n), queue.push(n));
  }
  const isolated = ids.filter((id) => !seen.has(id));

  // Decorative (non-playable) landmasses.
  const decorations = [];
  for (const d of cfg.decor ?? []) {
    const feature = byName.get(d.country);
    if (!feature) {
      console.warn(`!! [${cfg.id}] missing decoration: ${d.country}`);
      continue;
    }
    let rings = ringsOf(feature.geometry);
    if (cfg.crop) rings = rings.map((r) => clipToBox(r, cfg.crop));
    const projected = rings.map((r) => r.map(project)).filter((r) => r.length >= 3);
    if (!projected.length) continue;
    const { d: path, centroid: best } = buildPath(projected, SIMPLIFY_DECOR);
    decorations.push({ name: d.name, fill: d.fill, path, position: { x: round(best.cx), y: round(best.cy) } });
  }

  // Continent bonuses derived from size + chokepoint burden.
  const regionOf = new Map(territories.map((t) => [t.id, t.regionId]));
  const regionsOut = cfg.regions.map((r) => {
    const members = territories.filter((t) => t.regionId === r.id);
    const borders = members.filter((t) => t.adjacentTo.some((n) => regionOf.get(n) !== r.id)).length;
    return {
      id: r.id,
      name: r.name,
      bonusArmies: Math.max(2, Math.round((members.length + 2 * borders) / 3)),
      territoryIds: members.map((t) => t.id),
    };
  });

  console.log(`\n[${cfg.id}] territories: ${territories.length}, regions: ${regionsOut.length}`);
  console.log(`  graph connected: ${isolated.length === 0}${isolated.length ? " — isolated: " + isolated.join(", ") : ""}`);
  console.log(`  degree<=1: ${ids.filter((id) => adj.get(id).size <= 1).join(", ") || "none"}`);
  for (const r of regionsOut) console.log(`  ${r.name.padEnd(18)} ${String(r.territoryIds.length).padStart(2)} terr  bonus ${r.bonusArmies}`);

  const map = { id: cfg.id, name: cfg.name, viewBox: `0 0 ${W} ${H}`, regions: regionsOut, territories, connectors };
  if (decorations.length) map.decorations = decorations;

  const out = `// AUTO-GENERATED by tools/genmap.mjs — do not edit by hand.
// Source: Natural Earth admin-0 countries, 1:${cfg.dataset} (public domain).
// Regenerate with: node tools/genmap.mjs

import type { GameMap } from "../types.ts";

export const ${cfg.exportName}: GameMap = ${JSON.stringify(map, null, 0)};
`;
  writeFileSync(`src/engine/maps/${cfg.outFile}`, out);
  console.log(`  wrote src/engine/maps/${cfg.outFile} (${(out.length / 1024).toFixed(0)} KB)`);
}

// ===========================================================================
// Map definitions
// ===========================================================================

const WORLD = {
  id: "world",
  name: "World",
  dataset: "110m",
  exportName: "worldMap",
  outFile: "worldMap.ts",
  regions: [
    { id: "north-america", name: "North America" },
    { id: "south-america", name: "South America" },
    { id: "western-europe", name: "Western Europe" },
    { id: "eastern-europe", name: "Eastern Europe" },
    { id: "north-asia", name: "North Asia" },
    { id: "middle-east", name: "Middle East" },
    { id: "asia", name: "South & East Asia" },
    { id: "africa", name: "Africa" },
    { id: "oceania", name: "Oceania" },
  ],
  decor: [{ name: "Antarctica", country: "Antarctica", fill: "#eef4fa" }],
  spec: [
    { id: "alaska", name: "Alaska", region: "north-america", countries: ["United States of America"], clip: { lngMax: -141 } },
    { id: "western-canada", name: "Western Canada", region: "north-america", countries: ["Canada"], clip: { lngMax: -95 } },
    { id: "eastern-canada", name: "Eastern Canada", region: "north-america", countries: ["Canada"], clip: { lngMin: -95 } },
    { id: "greenland", name: "Greenland", region: "north-america", countries: ["Greenland"] },
    { id: "western-us", name: "Western United States", region: "north-america", countries: ["United States of America"], clip: { lngMin: -141, lngMax: -100 } },
    { id: "eastern-us", name: "Eastern United States", region: "north-america", countries: ["United States of America"], clip: { lngMin: -100 } },
    { id: "mexico", name: "Mexico", region: "north-america", countries: ["Mexico"] },
    { id: "central-america", name: "Central America", region: "north-america", countries: ["Guatemala", "Belize", "Honduras", "El Salvador", "Nicaragua", "Costa Rica", "Panama"] },
    { id: "caribbean", name: "Caribbean", region: "north-america", countries: ["Cuba", "Haiti", "Dominican Republic", "Jamaica", "The Bahamas", "Puerto Rico", "Trinidad and Tobago"] },

    { id: "venezuela", name: "Venezuela", region: "south-america", countries: ["Venezuela", "Guyana", "Suriname"] },
    { id: "colombia", name: "Colombia", region: "south-america", countries: ["Colombia", "Ecuador"], keepBounds: { lngMin: -82, lngMax: -66, latMin: -6, latMax: 13 } },
    { id: "brazil", name: "Brazil", region: "south-america", countries: ["Brazil"] },
    { id: "peru", name: "Peru", region: "south-america", countries: ["Peru", "Bolivia"] },
    { id: "argentina", name: "Argentina", region: "south-america", countries: ["Argentina", "Paraguay", "Uruguay"] },
    { id: "chile", name: "Chile", region: "south-america", countries: ["Chile"], keepBounds: { lngMin: -77, lngMax: -66, latMin: -56, latMax: -17 } },

    { id: "iceland", name: "Iceland", region: "western-europe", countries: ["Iceland"] },
    { id: "united-kingdom", name: "British Isles", region: "western-europe", countries: ["United Kingdom", "Ireland"] },
    { id: "france", name: "France", region: "western-europe", countries: ["France", "Netherlands", "Belgium", "Luxembourg"], keepBounds: { lngMin: -6, lngMax: 10, latMin: 41, latMax: 54 } },
    { id: "iberia", name: "Iberia", region: "western-europe", countries: ["Spain", "Portugal"], keepBounds: { lngMin: -10, lngMax: 4, latMin: 35, latMax: 44 } },
    { id: "germany", name: "Germany", region: "western-europe", countries: ["Germany", "Denmark", "Switzerland", "Austria", "Czechia", "Slovenia"], keepBounds: { lngMin: 5, lngMax: 20, latMin: 45, latMax: 58 } },
    { id: "italy", name: "Italy", region: "western-europe", countries: ["Italy"] },

    { id: "scandinavia", name: "Scandinavia", region: "eastern-europe", countries: ["Norway", "Sweden", "Finland"], keepBounds: { lngMin: 4, lngMax: 32, latMin: 54, latMax: 72 } },
    { id: "poland", name: "Poland & Baltics", region: "eastern-europe", countries: ["Poland", "Estonia", "Latvia", "Lithuania", "Slovakia", "Hungary"] },
    { id: "ukraine", name: "Ukraine & Belarus", region: "eastern-europe", countries: ["Ukraine", "Belarus", "Moldova"] },
    { id: "balkans", name: "Balkans", region: "eastern-europe", countries: ["Croatia", "Bosnia and Herzegovina", "Republic of Serbia", "Montenegro", "Kosovo", "North Macedonia", "Albania", "Romania", "Bulgaria", "Greece"] },

    { id: "western-russia", name: "Western Russia & Caucasus", region: "north-asia", countries: ["Russia", "Georgia", "Armenia", "Azerbaijan"], clip: { lngMax: 60 }, normalizeRussia: true },
    { id: "siberia", name: "Siberia", region: "north-asia", countries: ["Russia"], clip: { lngMin: 60, lngMax: 115 }, normalizeRussia: true },
    { id: "far-east-russia", name: "Far East Russia", region: "north-asia", countries: ["Russia"], clip: { lngMin: 115, lngMax: 180 }, normalizeRussia: true },
    { id: "central-asia", name: "Central Asia", region: "north-asia", countries: ["Kazakhstan", "Uzbekistan", "Turkmenistan", "Tajikistan", "Kyrgyzstan"] },

    { id: "turkey", name: "Turkey", region: "middle-east", countries: ["Turkey", "Cyprus", "Northern Cyprus"] },
    { id: "levant", name: "Levant & Iraq", region: "middle-east", countries: ["Syria", "Lebanon", "Jordan", "Israel", "Palestine", "Iraq"] },
    { id: "iran", name: "Iran", region: "middle-east", countries: ["Iran"] },
    { id: "arabia", name: "Arabia", region: "middle-east", countries: ["Saudi Arabia", "Yemen", "Oman", "United Arab Emirates", "Qatar", "Kuwait"] },

    { id: "china", name: "China", region: "asia", countries: ["China", "Taiwan", "Mongolia"] },
    { id: "korea", name: "Korea", region: "asia", countries: ["North Korea", "South Korea"] },
    { id: "japan", name: "Japan", region: "asia", countries: ["Japan"] },
    { id: "afghanistan-pakistan", name: "Afghanistan & Pakistan", region: "asia", countries: ["Afghanistan", "Pakistan"] },
    { id: "india", name: "India", region: "asia", countries: ["India", "Nepal", "Bhutan", "Bangladesh", "Sri Lanka"] },
    { id: "indochina", name: "Indochina", region: "asia", countries: ["Myanmar", "Thailand", "Laos", "Cambodia", "Vietnam"] },
    { id: "indonesia", name: "Indonesia", region: "asia", countries: ["Indonesia", "East Timor", "Malaysia", "Brunei"] },
    { id: "philippines", name: "Philippines", region: "asia", countries: ["Philippines"] },

    { id: "maghreb", name: "Maghreb", region: "africa", countries: ["Morocco", "Western Sahara", "Algeria", "Tunisia"] },
    { id: "north-africa", name: "North Africa", region: "africa", countries: ["Egypt", "Libya"] },
    { id: "west-africa", name: "West Africa", region: "africa", countries: ["Mauritania", "Mali", "Niger", "Senegal", "Gambia", "Guinea-Bissau", "Guinea", "Sierra Leone", "Liberia", "Ivory Coast", "Burkina Faso", "Ghana", "Togo", "Benin", "Nigeria"] },
    { id: "central-africa", name: "Central Africa", region: "africa", countries: ["Chad", "Cameroon", "Central African Republic", "Equatorial Guinea", "Gabon", "Republic of the Congo", "Democratic Republic of the Congo", "Angola"] },
    { id: "horn-africa", name: "Horn of Africa", region: "africa", countries: ["Sudan", "South Sudan", "Eritrea", "Ethiopia", "Djibouti", "Somalia", "Somaliland"] },
    { id: "east-africa", name: "East Africa", region: "africa", countries: ["Kenya", "Uganda", "Rwanda", "Burundi", "United Republic of Tanzania"] },
    { id: "southern-africa", name: "Southern Africa", region: "africa", countries: ["Namibia", "Botswana", "Zimbabwe", "Zambia", "Malawi", "Mozambique", "South Africa", "Lesotho", "eSwatini"] },
    { id: "madagascar", name: "Madagascar", region: "africa", countries: ["Madagascar"] },

    { id: "western-australia", name: "Western Australia", region: "oceania", countries: ["Australia"], clip: { lngMax: 135 } },
    { id: "eastern-australia", name: "Eastern Australia", region: "oceania", countries: ["Australia"], clip: { lngMin: 135 } },
    { id: "new-guinea", name: "New Guinea", region: "oceania", countries: ["Papua New Guinea", "Solomon Islands"] },
    { id: "new-zealand", name: "New Zealand", region: "oceania", countries: ["New Zealand"] },
  ],
  seaLinks: [
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
    ["north-africa", "arabia"],
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
  ],
};

// Caribbean theatre — a regional, island-heavy board using 1:50m detail.
const CARIBBEAN = {
  id: "caribbean",
  name: "Caribbean",
  dataset: "50m",
  exportName: "caribbeanMap",
  outFile: "caribbean.ts",
  crop: { lngMin: -93, lngMax: -58, latMin: 6.5, latMax: 31 },
  pad: 2,
  landThreshold: 0.15,
  simplifyTerritory: 0.45,
  regions: [
    { id: "northern-rim", name: "Northern Rim" },
    { id: "greater-antilles", name: "Greater Antilles" },
    { id: "lesser-antilles", name: "Lesser Antilles" },
    { id: "central-america", name: "Central America" },
    { id: "spanish-main", name: "Spanish Main" },
  ],
  spec: [
    { id: "florida", name: "Florida", region: "northern-rim", countries: ["United States of America"] },
    { id: "bahamas", name: "Bahamas", region: "northern-rim", countries: ["The Bahamas"] },
    { id: "cuba", name: "Cuba", region: "northern-rim", countries: ["Cuba"] },

    { id: "jamaica", name: "Jamaica", region: "greater-antilles", countries: ["Jamaica"] },
    { id: "haiti", name: "Haiti", region: "greater-antilles", countries: ["Haiti"] },
    { id: "dominican-republic", name: "Santo Domingo", region: "greater-antilles", countries: ["Dominican Republic"] },
    { id: "puerto-rico", name: "Puerto Rico", region: "greater-antilles", countries: ["Puerto Rico"] },

    { id: "leeward-islands", name: "Leeward Islands", region: "lesser-antilles", countries: ["Antigua and Barbuda", "Saint Kitts and Nevis", "Dominica"] },
    { id: "windward-islands", name: "Windward Islands", region: "lesser-antilles", countries: ["Saint Lucia", "Saint Vincent and the Grenadines", "Grenada"] },
    { id: "barbados", name: "Barbados", region: "lesser-antilles", countries: ["Barbados"] },
    { id: "trinidad-tobago", name: "Trinidad & Tobago", region: "lesser-antilles", countries: ["Trinidad and Tobago"] },

    { id: "yucatan", name: "Yucatán", region: "central-america", countries: ["Mexico"] },
    { id: "belize", name: "Belize", region: "central-america", countries: ["Belize"] },
    { id: "guatemala", name: "Guatemala", region: "central-america", countries: ["Guatemala"] },
    { id: "el-salvador", name: "El Salvador", region: "central-america", countries: ["El Salvador"] },
    { id: "honduras", name: "Honduras", region: "central-america", countries: ["Honduras"], clip: { lngMax: -84.5 } },
    { id: "mosquito-coast", name: "Mosquito Coast", region: "central-america", countries: ["Nicaragua", "Honduras"], clip: { lngMin: -84.5 } },
    { id: "nicaragua", name: "Nicaragua", region: "central-america", countries: ["Nicaragua"], clip: { lngMax: -84.5 } },
    { id: "costa-rica", name: "Costa Rica", region: "central-america", countries: ["Costa Rica"] },
    { id: "panama", name: "Panama", region: "central-america", countries: ["Panama"] },

    { id: "colombia", name: "Colombia", region: "spanish-main", countries: ["Colombia"] },
    { id: "venezuela", name: "Venezuela", region: "spanish-main", countries: ["Venezuela"] },
  ],
  seaLinks: [
    ["florida", "bahamas"],
    ["florida", "cuba"],
    ["florida", "yucatan"],
    ["bahamas", "cuba"],
    ["bahamas", "dominican-republic"],
    ["cuba", "jamaica"],
    ["cuba", "haiti"],
    ["cuba", "yucatan"],
    ["jamaica", "haiti"],
    ["jamaica", "honduras"],
    ["jamaica", "mosquito-coast"],
    ["jamaica", "colombia"],
    ["dominican-republic", "puerto-rico"],
    ["puerto-rico", "leeward-islands"],
    ["leeward-islands", "windward-islands"],
    ["windward-islands", "barbados"],
    ["windward-islands", "trinidad-tobago"],
    ["trinidad-tobago", "venezuela"],
  ],
};

// Napoleonic Europe (~1809-1812). Modern geometry subdivided/regrouped into the
// era's states — Germany split into Prussia/Rhineland/Bavaria, Italy into the
// Kingdom of Italy and Naples, the Duchy of Warsaw and Illyria carved out, etc.
const NAPOLEON = {
  id: "napoleon",
  name: "Napoleonic Europe",
  dataset: "50m",
  exportName: "napoleonMap",
  outFile: "napoleon.ts",
  crop: { lngMin: -11, lngMax: 46, latMin: 36, latMax: 62 },
  landThreshold: 0.2,
  simplifyTerritory: 0.5,
  regions: [
    { id: "western-europe", name: "Western Europe" },
    { id: "italy", name: "Italy" },
    { id: "central-europe", name: "Central Europe" },
    { id: "northern-europe", name: "Northern Europe" },
    { id: "russia", name: "Russia" },
    { id: "balkans", name: "The Balkans" },
  ],
  spec: [
    // Western Europe
    { id: "france", name: "France", region: "western-europe", countries: ["France"], keepBounds: { lngMin: -6, lngMax: 10, latMin: 41, latMax: 52 } },
    { id: "low-countries", name: "Low Countries", region: "western-europe", countries: ["Netherlands", "Belgium", "Luxembourg"] },
    { id: "switzerland", name: "Switzerland", region: "western-europe", countries: ["Switzerland"] },
    { id: "spain", name: "Spain", region: "western-europe", countries: ["Spain"], keepBounds: { lngMin: -10, lngMax: 4, latMin: 36, latMax: 44 } },
    { id: "portugal", name: "Portugal", region: "western-europe", countries: ["Portugal"], keepBounds: { lngMin: -10, lngMax: -6, latMin: 36, latMax: 42 } },

    // Italy
    { id: "north-italy", name: "Kingdom of Italy", region: "italy", countries: ["Italy"], clip: { latMin: 43 } },
    { id: "south-italy", name: "Naples & Sicily", region: "italy", countries: ["Italy"], clip: { latMax: 43 } },

    // Central Europe (German & Polish states)
    { id: "prussia", name: "Prussia", region: "central-europe", countries: ["Germany"], clip: { latMin: 51.5 } },
    { id: "rhineland", name: "Rhineland", region: "central-europe", countries: ["Germany"], clip: { latMax: 51.5, lngMax: 11 } },
    { id: "bavaria", name: "Bavaria & Saxony", region: "central-europe", countries: ["Germany"], clip: { latMax: 51.5, lngMin: 11 } },
    { id: "austria", name: "Austria & Bohemia", region: "central-europe", countries: ["Austria", "Czechia"] },
    { id: "hungary", name: "Hungary", region: "central-europe", countries: ["Hungary", "Slovakia"] },
    { id: "duchy-of-warsaw", name: "Duchy of Warsaw", region: "central-europe", countries: ["Poland"] },
    { id: "illyria", name: "Illyria", region: "central-europe", countries: ["Slovenia", "Croatia"] },

    // Northern Europe
    { id: "britain", name: "Great Britain", region: "northern-europe", countries: ["United Kingdom", "Ireland"] },
    { id: "denmark-norway", name: "Denmark-Norway", region: "northern-europe", countries: ["Denmark", "Norway"] },
    { id: "sweden", name: "Sweden", region: "northern-europe", countries: ["Sweden"] },

    // Russia
    { id: "lithuania", name: "Lithuania", region: "russia", countries: ["Lithuania", "Latvia", "Estonia", "Belarus"] },
    { id: "russia-north", name: "Russia", region: "russia", countries: ["Russia", "Finland"], clip: { lngMax: 46, latMin: 53 } },
    { id: "russia-south", name: "Southern Russia", region: "russia", countries: ["Russia"], clip: { lngMax: 46, latMax: 53 } },
    { id: "ukraine", name: "Ukraine", region: "russia", countries: ["Ukraine", "Moldova"] },

    // The Balkans (Ottoman Europe)
    { id: "balkans", name: "Balkans", region: "balkans", countries: ["Romania", "Bulgaria", "Republic of Serbia", "Bosnia and Herzegovina", "Montenegro", "Kosovo", "North Macedonia", "Albania"] },
    { id: "greece", name: "Greece", region: "balkans", countries: ["Greece"] },
    { id: "ottoman", name: "Ottoman Empire", region: "balkans", countries: ["Turkey"], clip: { lngMax: 46 } },
  ],
  seaLinks: [
    ["britain", "france"],
    ["britain", "low-countries"],
    ["britain", "portugal"],
    ["britain", "denmark-norway"],
    ["sweden", "lithuania"],
    ["sweden", "prussia"],
    ["south-italy", "greece"],
    ["south-italy", "balkans"],
  ],
};

// Scramble for Africa (~1880-1900). Modern borders ≈ the colonial partition.
const AFRICA = {
  id: "africa-scramble",
  name: "Scramble for Africa",
  dataset: "50m",
  exportName: "africaMap",
  outFile: "africaScramble.ts",
  crop: { lngMin: -19, lngMax: 52, latMin: -36, latMax: 38 },
  landThreshold: 0.2,
  simplifyTerritory: 0.6,
  regions: [
    { id: "north-africa", name: "North Africa" },
    { id: "west-africa", name: "West Africa" },
    { id: "central-africa", name: "Central Africa" },
    { id: "east-africa", name: "East Africa" },
    { id: "southern-africa", name: "Southern Africa" },
  ],
  spec: [
    { id: "morocco", name: "Morocco", region: "north-africa", countries: ["Morocco", "Western Sahara"] },
    { id: "algeria", name: "Algeria", region: "north-africa", countries: ["Algeria"] },
    { id: "tunisia", name: "Tunisia", region: "north-africa", countries: ["Tunisia"] },
    { id: "libya", name: "Libya", region: "north-africa", countries: ["Libya"] },
    { id: "egypt", name: "Egypt", region: "north-africa", countries: ["Egypt"] },
    { id: "mauritania", name: "Mauritania", region: "west-africa", countries: ["Mauritania"] },
    { id: "mali", name: "Mali", region: "west-africa", countries: ["Mali"] },
    { id: "niger", name: "Niger", region: "west-africa", countries: ["Niger"] },
    { id: "senegambia", name: "Senegambia", region: "west-africa", countries: ["Senegal", "Gambia", "Guinea-Bissau", "Guinea", "Sierra Leone", "Liberia"] },
    { id: "gold-coast", name: "Gold Coast", region: "west-africa", countries: ["Ivory Coast", "Ghana", "Togo", "Benin", "Burkina Faso"] },
    { id: "nigeria", name: "Nigeria", region: "west-africa", countries: ["Nigeria"] },
    { id: "chad", name: "Chad", region: "west-africa", countries: ["Chad"] },
    { id: "cameroon", name: "Cameroon", region: "central-africa", countries: ["Cameroon", "Equatorial Guinea", "Gabon", "Republic of the Congo", "Central African Republic"] },
    { id: "congo", name: "Congo", region: "central-africa", countries: ["Democratic Republic of the Congo"] },
    { id: "angola", name: "Angola", region: "central-africa", countries: ["Angola"] },
    { id: "sudan", name: "Sudan", region: "east-africa", countries: ["Sudan", "South Sudan"] },
    { id: "ethiopia", name: "Ethiopia", region: "east-africa", countries: ["Ethiopia", "Eritrea", "Djibouti"] },
    { id: "somalia", name: "Somalia", region: "east-africa", countries: ["Somalia", "Somaliland"] },
    { id: "great-lakes", name: "Great Lakes", region: "east-africa", countries: ["Uganda", "Kenya", "Rwanda", "Burundi"] },
    { id: "tanzania", name: "Tanganyika", region: "east-africa", countries: ["United Republic of Tanzania"] },
    { id: "zambezi", name: "Zambezi", region: "southern-africa", countries: ["Zambia", "Malawi"] },
    { id: "mozambique", name: "Mozambique", region: "southern-africa", countries: ["Mozambique", "Zimbabwe"] },
    { id: "kalahari", name: "Kalahari", region: "southern-africa", countries: ["Namibia", "Botswana"] },
    { id: "south-africa", name: "South Africa", region: "southern-africa", countries: ["South Africa", "Lesotho", "eSwatini"] },
    { id: "madagascar", name: "Madagascar", region: "southern-africa", countries: ["Madagascar"] },
  ],
  seaLinks: [
    ["madagascar", "mozambique"],
    ["madagascar", "tanzania"],
  ],
};

// Egypt & the Near East (Napoleon's 1798 campaign + the Ottoman/Persian Near East).
const NEAR_EAST = {
  id: "near-east",
  name: "Egypt & the Near East",
  dataset: "50m",
  exportName: "nearEastMap",
  outFile: "nearEast.ts",
  crop: { lngMin: 13, lngMax: 60, latMin: 12, latMax: 42 },
  landThreshold: 0.2,
  simplifyTerritory: 0.5,
  regions: [
    { id: "egypt-sudan", name: "Egypt & Sudan" },
    { id: "levant", name: "The Levant" },
    { id: "anatolia", name: "Anatolia" },
    { id: "mediterranean", name: "The Mediterranean" },
    { id: "arabia", name: "Arabia" },
    { id: "persia", name: "Persia" },
  ],
  spec: [
    { id: "lower-egypt", name: "Lower Egypt", region: "egypt-sudan", countries: ["Egypt"], clip: { latMin: 27 } },
    { id: "upper-egypt", name: "Upper Egypt", region: "egypt-sudan", countries: ["Egypt"], clip: { latMax: 27 } },
    { id: "cyrenaica", name: "Cyrenaica", region: "egypt-sudan", countries: ["Libya"] },
    { id: "sudan", name: "Sudan", region: "egypt-sudan", countries: ["Sudan", "South Sudan"] },
    { id: "alexandria", name: "Alexandria", region: "egypt-sudan", point: [29.92, 31.2], radiusDeg: 0.55 },
    { id: "palestine", name: "Palestine", region: "levant", countries: ["Israel", "Palestine", "Jordan"] },
    { id: "syria", name: "Syria", region: "levant", countries: ["Syria", "Lebanon"] },
    { id: "mesopotamia", name: "Mesopotamia", region: "levant", countries: ["Iraq"] },
    { id: "acre", name: "Acre", region: "levant", point: [35.07, 32.92], radiusDeg: 0.45 },
    { id: "anatolia-west", name: "Anatolia", region: "anatolia", countries: ["Turkey"], clip: { lngMax: 35 } },
    { id: "anatolia-east", name: "Eastern Anatolia", region: "anatolia", countries: ["Turkey"], clip: { lngMin: 35 } },
    { id: "caucasus", name: "Caucasus", region: "anatolia", countries: ["Georgia", "Armenia", "Azerbaijan"] },
    { id: "greece", name: "Greece", region: "mediterranean", countries: ["Greece"] },
    { id: "cyprus", name: "Cyprus", region: "mediterranean", countries: ["Cyprus", "Northern Cyprus"] },
    { id: "malta", name: "Malta", region: "mediterranean", point: [14.45, 35.9], radiusDeg: 0.55 },
    { id: "hejaz", name: "Hejaz", region: "arabia", countries: ["Saudi Arabia"], clip: { lngMax: 44 } },
    { id: "nejd", name: "Nejd", region: "arabia", countries: ["Saudi Arabia"], clip: { lngMin: 44 } },
    { id: "yemen", name: "Yemen", region: "arabia", countries: ["Yemen"] },
    { id: "oman", name: "Oman", region: "arabia", countries: ["Oman", "United Arab Emirates"] },
    { id: "gulf", name: "Persian Gulf", region: "arabia", countries: ["Kuwait", "Qatar"] },
    { id: "aden", name: "Aden", region: "arabia", point: [45.03, 12.85], radiusDeg: 0.5 },
    { id: "persia-west", name: "Persia", region: "persia", countries: ["Iran"], clip: { lngMax: 54 } },
    { id: "persia-east", name: "Eastern Persia", region: "persia", countries: ["Iran"], clip: { lngMin: 54 } },
  ],
  seaLinks: [
    ["lower-egypt", "hejaz"],
    ["upper-egypt", "hejaz"],
    ["greece", "anatolia-west"],
    ["cyprus", "syria"],
    ["cyprus", "anatolia-west"],
    ["oman", "persia-east"],
    ["malta", "greece"],
    ["malta", "alexandria"],
    ["malta", "cyprus"],
    ["alexandria", "acre"],
    ["acre", "cyprus"],
    ["aden", "sudan"],
    ["aden", "oman"],
  ],
  links: [
    ["alexandria", "lower-egypt"],
    ["acre", "palestine"],
    ["acre", "syria"],
    ["aden", "yemen"],
  ],
};

// Crimean War (1853-56) — the Black Sea littoral.
const CRIMEA = {
  id: "crimea",
  name: "Crimean War",
  dataset: "50m",
  exportName: "crimeaMap",
  outFile: "crimea.ts",
  crop: { lngMin: 22, lngMax: 50, latMin: 38, latMax: 52 },
  landThreshold: 0.25,
  simplifyTerritory: 0.4,
  regions: [
    { id: "danube", name: "The Danube" },
    { id: "south-russia", name: "South Russia" },
    { id: "caucasus", name: "The Caucasus" },
    { id: "ottoman", name: "Ottoman Lands" },
  ],
  spec: [
    { id: "wallachia", name: "Wallachia", region: "danube", countries: ["Romania"] },
    { id: "bulgaria", name: "Bulgaria", region: "danube", countries: ["Bulgaria"] },
    { id: "moldavia", name: "Moldavia", region: "danube", countries: ["Moldova"] },
    { id: "serbia", name: "Serbia", region: "danube", countries: ["Republic of Serbia"] },
    { id: "ukraine", name: "Ukraine", region: "south-russia", countries: ["Ukraine"], clip: { latMin: 46.3 } },
    { id: "crimea", name: "Crimea", region: "south-russia", countries: ["Ukraine"], clip: { latMax: 46.3, lngMin: 32.5 } },
    { id: "don", name: "Don Steppe", region: "south-russia", countries: ["Russia"], clip: { lngMin: 36, lngMax: 50, latMin: 46 } },
    { id: "circassia", name: "Circassia", region: "caucasus", countries: ["Russia"], clip: { lngMin: 36, lngMax: 50, latMax: 46 } },
    { id: "georgia", name: "Georgia", region: "caucasus", countries: ["Georgia"] },
    { id: "armenia", name: "Armenia", region: "caucasus", countries: ["Armenia", "Azerbaijan"] },
    { id: "thrace", name: "Thrace", region: "ottoman", countries: ["Turkey"], clip: { lngMax: 30 } },
    { id: "anatolia", name: "Anatolia", region: "ottoman", countries: ["Turkey"], clip: { lngMin: 30, lngMax: 37 } },
    { id: "eastern-anatolia", name: "Eastern Anatolia", region: "ottoman", countries: ["Turkey"], clip: { lngMin: 37 } },
    { id: "greece", name: "Greece", region: "ottoman", countries: ["Greece"] },
  ],
  seaLinks: [
    ["crimea", "anatolia"],
    ["crimea", "circassia"],
    ["greece", "anatolia"],
  ],
};

// Indian Subcontinent — India grouped from real states (admin-1) into historical
// regions, so internal borders are organic rather than straight clip lines.
const INDIA = {
  id: "india",
  name: "Indian Subcontinent",
  dataset: "50m",
  provinceDataset: "50m",
  exportName: "indiaMap",
  outFile: "indiaSubcontinent.ts",
  crop: { lngMin: 60, lngMax: 97, latMin: 5, latMax: 37 },
  landThreshold: 0.2,
  simplifyTerritory: 0.5,
  regions: [
    { id: "northwest", name: "The Northwest" },
    { id: "hindustan", name: "Hindustan" },
    { id: "the-ganges", name: "The Ganges" },
    { id: "western-india", name: "Western India" },
    { id: "the-deccan", name: "The Deccan" },
    { id: "coromandel", name: "The Coromandel Coast" },
  ],
  spec: [
    { id: "afghanistan", name: "Afghanistan", region: "northwest", countries: ["Afghanistan"] },
    { id: "indus", name: "The Indus", region: "northwest", countries: ["Pakistan"] },
    { id: "punjab", name: "Punjab", region: "northwest", admin: "India", provinces: ["Punjab", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Chandigarh", "Ladakh"] },
    { id: "hindustan", name: "Hindustan", region: "hindustan", admin: "India", provinces: ["Uttar Pradesh", "Delhi", "Uttarakhand"] },
    { id: "rajputana", name: "Rajputana", region: "hindustan", admin: "India", provinces: ["Rajasthan"] },
    { id: "himalaya", name: "Nepal & Bhutan", region: "hindustan", countries: ["Nepal", "Bhutan"] },
    { id: "central-india", name: "Central India", region: "the-ganges", admin: "India", provinces: ["Madhya Pradesh", "Chhattisgarh"] },
    { id: "bengal", name: "Bengal", region: "the-ganges", admin: "India", provinces: ["West Bengal", "Bihar", "Jharkhand", "Odisha", "Assam", "Sikkim", "Meghalaya", "Tripura", "Manipur", "Mizoram", "Nagaland", "Arunachal Pradesh"] },
    { id: "bangladesh", name: "Bengal Delta", region: "the-ganges", countries: ["Bangladesh"] },
    { id: "calcutta", name: "Calcutta", region: "the-ganges", point: [88.36, 22.57], radiusDeg: 0.55 },
    { id: "gujarat", name: "Gujarat", region: "western-india", admin: "India", provinces: ["Gujarat"] },
    { id: "maratha", name: "Maratha", region: "western-india", admin: "India", provinces: ["Maharashtra"] },
    { id: "goa", name: "Goa", region: "western-india", admin: "India", provinces: ["Goa", "Dadra and Nagar Haveli and Daman and Diu"] },
    { id: "bombay", name: "Bombay", region: "western-india", point: [72.83, 18.96], radiusDeg: 0.55 },
    { id: "hyderabad", name: "Hyderabad", region: "the-deccan", admin: "India", provinces: ["Telangana", "Andhra Pradesh"] },
    { id: "mysore", name: "Mysore", region: "the-deccan", admin: "India", provinces: ["Karnataka"] },
    { id: "carnatic", name: "Carnatic", region: "the-deccan", admin: "India", provinces: ["Tamil Nadu", "Kerala"] },
    { id: "ceylon", name: "Ceylon", region: "coromandel", countries: ["Sri Lanka"] },
    { id: "madras", name: "Madras", region: "coromandel", point: [80.27, 13.08], radiusDeg: 0.5 },
    { id: "pondicherry", name: "Pondicherry", region: "coromandel", admin: "India", provinces: ["Puducherry"] },
    { id: "tranquebar", name: "Tranquebar", region: "coromandel", point: [79.85, 11.03], radiusDeg: 0.45 },
    { id: "cochin", name: "Cochin", region: "coromandel", point: [76.27, 9.97], radiusDeg: 0.45 },
  ],
  // Drawn sea crossings.
  seaLinks: [
    ["ceylon", "carnatic"],
    ["ceylon", "madras"],
    ["madras", "pondicherry"],
    ["pondicherry", "tranquebar"],
    ["tranquebar", "ceylon"],
    ["cochin", "ceylon"],
    ["calcutta", "madras"],
  ],
  // Enclaves to their hinterland (adjacency only, not drawn as lines).
  links: [
    ["goa", "maratha"],
    ["goa", "mysore"],
    ["bombay", "maratha"],
    ["calcutta", "bengal"],
    ["calcutta", "bangladesh"],
    ["madras", "carnatic"],
    ["pondicherry", "carnatic"],
    ["tranquebar", "carnatic"],
    ["cochin", "carnatic"],
  ],
};

const MAPS = [WORLD, CARIBBEAN, NAPOLEON, AFRICA, NEAR_EAST, CRIMEA, INDIA];

for (const cfg of MAPS) {
  const byName = await loadDataset(cfg.dataset);
  const provIndex = cfg.provinceDataset ? await loadProvinces(cfg.provinceDataset) : null;
  generateMap(cfg, byName, provIndex);
}
