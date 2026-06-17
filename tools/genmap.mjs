/**
 * genmap — project real Han-dynasty China geography into the game's map.
 *
 * This is the RoTK sibling of the Dominion branch's `tools/genmap.mjs`. It uses
 * the same geometry pipeline (Natural Earth admin-1 provinces → clipped, projected,
 * simplified SVG paths with derived adjacency), but instead of countries it groups
 * *modern* Chinese provinces into the twelve Han-dynasty provinces (州, zhou) of the
 * Three Kingdoms era. Real coastlines and provincial borders give organic, instantly
 * recognisable territory shapes — no straight clip lines.
 *
 *   node tools/genmap.mjs
 *
 * Output: src/engine/maps/china.ts (a GameMap), committed to the repo so the build
 * never needs network access. Regenerate when the territory grouping changes.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const WIDTH = 1000;
const BASE_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/";

/** Load the admin-1 (states/provinces) dataset, indexed by `${admin}|${name}`. */
async function loadProvinces() {
  const file = "ne_50m_admin_1_states_provinces.geojson";
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
  return idx;
}

// ===========================================================================
// Geometry helpers (shared with the Dominion genmap; pure, generic)
// ===========================================================================

/** Normalise a geometry into a flat list of outer rings ([[lng,lat],...]). */
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

/** Clip a ring to a lng/lat bounding box (trims coasts/frontiers to the theatre). */
function clipToBox(ring, box) {
  let r = clipAxis(ring, 0, box.lngMin, true);
  if (r.length) r = clipAxis(r, 0, box.lngMax, false);
  if (r.length) r = clipAxis(r, 1, box.latMin, true);
  if (r.length) r = clipAxis(r, 1, box.latMax, false);
  return r;
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

/** Smallest distance (in degrees) between any pair of vertices of two ring sets. */
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
// Map definition: the twelve Han provinces, built from modern provinces
// ===========================================================================

const CHINA = {
  id: "china",
  name: "The Middle Kingdom — 189 AD",
  // Crop to the Han heartland; trims the western/northern sprawl of Inner Mongol,
  // Gansu and Liaoning down to the era's effective frontier.
  crop: { lngMin: 101, lngMax: 125, latMin: 17, latMax: 43 },
  pad: 1,
  simplifyTerritory: 0.6,
  landThreshold: 0.35,
  admin: "China",
  regions: [
    { id: "hebei", name: "Hebei (North)" },
    { id: "zhongyuan", name: "Central Plains" },
    { id: "xiliang", name: "Liang (Northwest)" },
    { id: "jiangnan", name: "Jiangnan (South)" },
    { id: "bashu", name: "Bashu (West)" },
  ],
  // Each Han province (zhou) is the union of whole modern provinces, so its
  // border is a real composite of provincial coastlines and boundaries.
  spec: [
    { id: "sili", name: "Sili (Capital)", region: "zhongyuan", provinces: ["Shaanxi"] },
    { id: "liangzhou", name: "Liang Province", region: "xiliang", provinces: ["Gansu", "Ningxia"] },
    { id: "bingzhou", name: "Bing Province", region: "hebei", provinces: ["Shanxi", "Inner Mongol"] },
    { id: "youzhou", name: "You Province", region: "hebei", provinces: ["Beijing", "Tianjin", "Liaoning"] },
    { id: "jizhou", name: "Ji Province", region: "hebei", provinces: ["Hebei"] },
    { id: "qingzhou", name: "Qing Province", region: "zhongyuan", provinces: ["Shandong"] },
    { id: "yuzhou", name: "Yu Province", region: "zhongyuan", provinces: ["Henan"] },
    { id: "xuzhou", name: "Xu Province", region: "zhongyuan", provinces: ["Jiangsu", "Shanghai", "Anhui"] },
    { id: "jingzhou", name: "Jing Province", region: "jiangnan", provinces: ["Hubei", "Hunan"] },
    { id: "yizhou", name: "Yi Province", region: "bashu", provinces: ["Sichuan", "Chongqing", "Guizhou", "Yunnan"] },
    { id: "yangzhou", name: "Yang Province", region: "jiangnan", provinces: ["Zhejiang", "Jiangxi", "Fujian"] },
    { id: "jiaozhou", name: "Jiao Province", region: "jiangnan", provinces: ["Guangdong", "Guangxi", "Hainan"] },
  ],
  // Sea/strait routes drawn as connectors and treated as adjacency, for hops
  // that the land-border test won't catch.
  seaLinks: [
    ["qingzhou", "youzhou"], // across the Bohai Gulf
    ["xuzhou", "yangzhou"], // coastal Jiangsu ↔ Zhejiang
    ["yangzhou", "jiaozhou"], // Fujian ↔ Guangdong coast
  ],
};

function generateMap(cfg, provIndex) {
  const W = WIDTH;
  const pad = cfg.pad ?? 0;
  const lngMin = cfg.crop.lngMin - pad;
  const lngMax = cfg.crop.lngMax + pad;
  const latMin = cfg.crop.latMin - pad;
  const latMax = cfg.crop.latMax + pad;
  const s = W / (lngMax - lngMin);
  const H = Math.round((latMax - latMin) * s);
  const project = ([lng, lat]) => [(lng - lngMin) * s, (latMax - lat) * s];
  const simplifyT = cfg.simplifyTerritory ?? 0.7;
  const landThreshold = cfg.landThreshold ?? 0.2;

  const territories = [];
  const geoRings = new Map(); // id -> lng/lat rings (for adjacency)

  for (const spec of cfg.spec) {
    const rings = [];
    for (const province of spec.provinces) {
      const f = provIndex.get(`${cfg.admin}|${province}`);
      if (!f) {
        console.warn(`!! [${cfg.id}] missing province: ${cfg.admin}/${province} (${spec.id})`);
        continue;
      }
      for (let ring of ringsOf(f.geometry)) {
        ring = clipToBox(ring, cfg.crop);
        if (ring.length < 3) continue;
        rings.push(ring);
      }
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

  // Adjacency: shared borders + curated sea routes.
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
  for (const t of territories) t.adjacentTo = [...adj.get(t.id)].sort();

  const haveId = new Set(ids);
  const connectors = cfg.seaLinks.filter(([a, b]) => haveId.has(a) && haveId.has(b));

  // Connectivity (BFS) — every game must be winnable from any start.
  const seen = new Set([ids[0]]);
  const queue = [ids[0]];
  while (queue.length) {
    const cur = queue.shift();
    for (const n of adj.get(cur)) if (!seen.has(n)) (seen.add(n), queue.push(n));
  }
  const isolated = ids.filter((id) => !seen.has(id));

  // Region prosperity bonus derived from size + exposed (border) provinces.
  const regionOf = new Map(territories.map((t) => [t.id, t.regionId]));
  const regionsOut = cfg.regions.map((r) => {
    const members = territories.filter((t) => t.regionId === r.id);
    const borders = members.filter((t) => t.adjacentTo.some((n) => regionOf.get(n) !== r.id)).length;
    return {
      id: r.id,
      name: r.name,
      bonusGold: Math.max(2, Math.round((members.length + 2 * borders) / 2)),
      provinceIds: members.map((t) => t.id),
    };
  });

  console.log(`\n[${cfg.id}] provinces: ${territories.length}, regions: ${regionsOut.length}`);
  console.log(`  graph connected: ${isolated.length === 0}${isolated.length ? " — isolated: " + isolated.join(", ") : ""}`);
  console.log(`  degree<=1: ${ids.filter((id) => adj.get(id).size <= 1).join(", ") || "none"}`);
  for (const t of territories) console.log(`  ${t.id.padEnd(11)} → ${t.adjacentTo.join(", ")}`);
  for (const r of regionsOut) console.log(`  ${r.name.padEnd(20)} ${String(r.provinceIds.length).padStart(2)} prov  bonus ${r.bonusGold}`);

  const map = {
    id: cfg.id,
    name: cfg.name,
    viewBox: `0 0 ${W} ${H}`,
    regions: regionsOut,
    provinces: territories,
    connectors,
  };

  const out = `// AUTO-GENERATED by tools/genmap.mjs — do not edit by hand.
// Source: Natural Earth admin-1 states/provinces, 1:50m (public domain),
// grouped into the twelve Han-dynasty provinces (州) of the Three Kingdoms era.
// Regenerate with: node tools/genmap.mjs

import type { GameMap } from "../types.ts";

export const chinaMap: GameMap = ${JSON.stringify(map, null, 0)};
`;
  mkdirSync("src/engine/maps", { recursive: true });
  writeFileSync(`src/engine/maps/china.ts`, out);
  console.log(`  wrote src/engine/maps/china.ts (${(out.length / 1024).toFixed(0)} KB)`);
  if (isolated.length) throw new Error(`map graph not connected: ${isolated.join(", ")}`);
}

const provIndex = await loadProvinces();
generateMap(CHINA, provIndex);
