# Syndicate Remake

A web-based isometric tactical remake of the 1993 game *Syndicate*.

See [`DESIGN.md`](./DESIGN.md) for the full architecture and roadmap.

## Status

**Build step 1 of 10** — isometric grid renders with camera pan/zoom and mouse
tile-picking. (See DESIGN.md §14.)

## Stack

- **PixiJS** (WebGL 2D rendering)
- **TypeScript** + **Vite**

## Run

```bash
npm install
npm run dev        # dev server with HMR at http://localhost:5173
npm run build      # typecheck + production build
npm run typecheck  # types only
```

**Controls:** drag to pan · mouse wheel to zoom (about cursor) · hover to pick a
tile (shown in the HUD).

## Layout

```
src/
  coords.ts          grid <-> world/screen pixel conversions (the SIM/RENDER seam)
  map.ts             MapData struct-of-arrays + demo map
  render/
    isoScene.ts      PixiJS iso renderer, camera, tile picking
    colors.ts        placeholder tile palette
  main.ts            app bootstrap
```

The simulation works in grid coordinates only; isometric pixels exist solely in
the render layer (DESIGN.md §0).
