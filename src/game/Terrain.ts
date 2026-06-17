/**
 * Destructible terrain modelled as a per-column height map. `surface[x]` is the
 * y-pixel of the ground's top edge at column x; everything below (larger y) is
 * solid. This makes collision a single comparison and craters a cheap radial
 * subtraction. A height map can't form overhangs, which conveniently means
 * "collapse" is automatic — there is never floating dirt.
 */
export class Terrain {
  width: number;
  height: number;
  surface: Float32Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.surface = new Float32Array(width);
  }

  /** Generate rolling hills via midpoint displacement, then smooth. */
  generate(rng: () => number): void {
    const { width, height } = this;
    const minTop = height * 0.32; // tallest peaks
    const maxTop = height * 0.82; // lowest valleys

    // Midpoint displacement on a temporary power-of-two-ish grid.
    const pts: number[] = new Array(width);
    pts[0] = rand(minTop, maxTop, rng);
    pts[width - 1] = rand(minTop, maxTop, rng);

    const subdivide = (l: number, r: number, disp: number) => {
      if (r - l < 2) return;
      const m = (l + r) >> 1;
      const mid = (pts[l] + pts[r]) / 2;
      pts[m] = clamp(mid + (rng() * 2 - 1) * disp, minTop, maxTop);
      const next = disp * 0.55;
      subdivide(l, m, next);
      subdivide(m, r, next);
    };
    subdivide(0, width - 1, height * 0.5);

    // Fill any untouched columns by linear interpolation, then box-smooth.
    for (let x = 0; x < width; x++) {
      if (pts[x] === undefined) pts[x] = (pts[x - 1] ?? minTop);
    }
    for (let pass = 0; pass < 3; pass++) {
      for (let x = 1; x < width - 1; x++) {
        pts[x] = (pts[x - 1] + pts[x] * 2 + pts[x + 1]) / 4;
      }
    }
    for (let x = 0; x < width; x++) this.surface[x] = pts[x];
  }

  /** Ground top at a (possibly fractional / out-of-range) x. */
  surfaceAt(x: number): number {
    if (x < 0 || x >= this.width) return this.height; // off-map = floor
    return this.surface[Math.floor(x)];
  }

  /** Is the world point solid ground? */
  isSolid(x: number, y: number): boolean {
    if (x < 0 || x >= this.width) return false;
    return y >= this.surface[Math.floor(x)];
  }

  /** Carve a circular crater (explosions). */
  carve(cx: number, cy: number, radius: number): void {
    const x0 = Math.max(0, Math.floor(cx - radius));
    const x1 = Math.min(this.width - 1, Math.ceil(cx + radius));
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = Math.sqrt(Math.max(0, radius * radius - dx * dx));
      const craterBottom = cy + dy;
      // Remove everything above the crater's lower edge in this column.
      if (craterBottom > this.surface[x]) {
        this.surface[x] = Math.min(this.height, craterBottom);
      }
    }
  }

  /** Add a mound of terrain (Dirt Clod). */
  deposit(cx: number, cy: number, radius: number): void {
    const x0 = Math.max(0, Math.floor(cx - radius));
    const x1 = Math.min(this.width - 1, Math.ceil(cx + radius));
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = Math.sqrt(Math.max(0, radius * radius - dx * dx));
      const moundTop = cy - dy;
      if (moundTop < this.surface[x]) {
        this.surface[x] = Math.max(0, moundTop);
      }
    }
  }
}

function rand(min: number, max: number, rng: () => number): number {
  return min + rng() * (max - min);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Small, seedable PRNG (mulberry32) so terrain/AI jitter are reproducible. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
