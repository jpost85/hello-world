# Syndicate Remake

A web-based isometric tactical remake of the 1993 game *Syndicate*.

See [`DESIGN.md`](./DESIGN.md) for the full architecture and roadmap.

## Status

**Build step 2 of 10** — deterministic fixed-timestep sim with a seeded PRNG and
tick-stamped commands; one agent moves via click-to-move (grid A\* pathfinding)
with smooth render interpolation. (See DESIGN.md §6, §14.)

**Controls:** drag to pan · wheel to zoom · hover to pick a tile · **click a tile
to send the agent there**.

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
  sim/               deterministic simulation (grid coords only, no pixels)
    rng.ts           seeded PRNG carried in world state
    world.ts         WorldState + agents
    commands.ts      tick-stamped input commands
    pathfind.ts      grid A* (binary heap, deterministic tie-break)
    systems.ts       command-apply + movement + the pure simTick step
    loop.ts          fixed-timestep accumulator loop with interpolation alpha
  render/
    isoScene.ts      PixiJS iso renderer, camera, picking, interpolated agents
    colors.ts        placeholder palette
  main.ts            app bootstrap (wires sim loop + scene)
```

The simulation works in grid coordinates only; isometric pixels exist solely in
the render layer (DESIGN.md §0).
