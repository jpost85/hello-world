// Generates the PWA icon set procedurally — no image libraries, just a small
// hand-rolled PNG encoder over Node's built-in zlib. Run: `npm run icons`.
import zlib from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

// ---------- minimal PNG encoder (8-bit RGBA) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  // 10,11,12 = compression, filter, interlace = 0
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- tiny software rasteriser ----------
class Canvas {
  constructor(size) {
    this.size = size;
    this.buf = Buffer.alloc(size * size * 4);
  }
  px(x, y, r, g, b, a = 1) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return;
    const i = (y * this.size + x) * 4;
    const ia = 1 - a;
    this.buf[i] = r * a + this.buf[i] * ia;
    this.buf[i + 1] = g * a + this.buf[i + 1] * ia;
    this.buf[i + 2] = b * a + this.buf[i + 2] * ia;
    this.buf[i + 3] = Math.min(255, this.buf[i + 3] + a * 255);
  }
  disc(cx, cy, rad, r, g, b, a = 1) {
    for (let y = cy - rad; y <= cy + rad; y++) {
      for (let x = cx - rad; x <= cx + rad; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= rad) this.px(x, y, r, g, b, a * Math.min(1, rad - d + 0.5));
      }
    }
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Draw the Scorched-Earth icon at the given size, with optional safe-zone inset. */
function drawIcon(size, inset = 0) {
  const c = new Canvas(size);
  const S = size;
  const pad = S * inset;
  const innerY = (v) => lerp(pad, S - pad, v); // map 0..1 into safe zone
  const innerX = (v) => lerp(pad, S - pad, v);

  // Sky gradient background (full bleed for maskable).
  for (let y = 0; y < S; y++) {
    const t = y / S;
    const r = lerp(11, 42, t);
    const g = lerp(16, 24, t);
    const b = lerp(48, 56, t);
    for (let x = 0; x < S; x++) c.px(x, y, r, g, b, 1);
  }

  // Rolling ground.
  for (let x = 0; x < S; x++) {
    const u = x / S;
    const surf = innerY(0.66 + Math.sin(u * Math.PI * 1.6) * 0.06 + Math.sin(u * 9) * 0.015);
    for (let y = surf; y < S - (S < 128 ? 0 : pad * 0.0); y++) {
      const depth = (y - surf) / (S - surf);
      c.px(x, y, lerp(74, 58, depth) * 0.9 + 20 * (1 - depth), lerp(110, 42, depth), lerp(60, 28, depth), 1);
    }
  }

  // Dotted trajectory arc.
  for (let i = 0; i <= 26; i++) {
    const t = i / 26;
    const x = innerX(lerp(0.12, 0.86, t));
    const y = innerY(0.7 - Math.sin(t * Math.PI) * 0.52);
    c.disc(x, y, Math.max(1.5, S * 0.012), 255, 224, 130, 0.9);
  }

  // Flaming shell along the arc.
  const st = 0.6;
  const sx = innerX(lerp(0.12, 0.86, st));
  const sy = innerY(0.7 - Math.sin(st * Math.PI) * 0.52);
  for (let k = 4; k >= 1; k--) {
    const tt = st - k * 0.03;
    const fx = innerX(lerp(0.12, 0.86, tt));
    const fy = innerY(0.7 - Math.sin(tt * Math.PI) * 0.52);
    c.disc(fx, fy, S * 0.02 * (k / 4 + 0.4), 255, lerp(80, 180, k / 4), 40, 0.5);
  }
  c.disc(sx, sy, S * 0.055, 255, 150, 60, 1);
  c.disc(sx, sy, S * 0.03, 255, 240, 200, 1);

  return c;
}

mkdirSync(new URL("../public/", import.meta.url), { recursive: true });
const out = (name) => new URL(`../public/${name}`, import.meta.url);

const targets = [
  { name: "icon-192.png", size: 192, inset: 0 },
  { name: "icon-512.png", size: 512, inset: 0 },
  { name: "icon-maskable-512.png", size: 512, inset: 0.14 },
  { name: "apple-touch-icon.png", size: 180, inset: 0.06 },
];

for (const t of targets) {
  const c = drawIcon(t.size, t.inset);
  writeFileSync(out(t.name), encodePNG(t.size, t.size, c.buf));
  console.log("wrote", t.name, `${t.size}x${t.size}`);
}
