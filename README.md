# Scorched Earth — Mobile Web Port

A touch-first browser port of the classic 1990s artillery game *Scorched Earth*.
Take turns adjusting angle, power, and weapon, then lob shells across
destructible terrain under the pull of gravity and wind. Last tank standing wins
the round; spend your winnings in the armoury between rounds.

Built with **vanilla TypeScript + HTML5 Canvas** (no game engine), bundled with
**Vite**. The whole game ships in ~10 KB gzipped.

## Play

```bash
npm install
npm run dev      # http://localhost:5173
```

Open it on a phone (or a narrow browser window) for the intended experience.

```bash
npm run build    # static bundle in dist/, deployable to any static host
npm run preview  # serve the production build
```

## How to play

- **Aim:** drag from your tank toward where you want to fire. Drag *direction*
  sets the angle, drag *length* sets the power. Release to fire.
- **Fine-tune:** use the on-screen Angle/Power steppers (tap-and-hold to repeat).
- **Weapons:** tap the weapon button to cycle through what you own.
- **Wind** (shown top-left) pushes shells sideways — compensate for it.
- Survive the round, then **buy** bigger ordnance and defensive dirt in the shop.

## Architecture

```
src/
  main.ts            bootstrap: canvas sizing, game loop, UI wiring
  types.ts           shared types
  game/
    Game.ts          state machine, turns, collisions, economy glue
    Terrain.ts       destructible height-map terrain (carve/deposit)
    Tank.ts          tank state, inventory, barrel geometry
    Projectile.ts    in-flight munition + MIRV split logic
    Physics.ts       gravity/wind constants, ballistics helpers
    Weapons.ts       data-driven arsenal catalogue
    AI.ts            trajectory-sampling opponent + shop logic
    Economy.ts       payouts and starting cash
  input/TouchControls.ts   drag-to-aim pointer handling
  render/Renderer.ts       canvas drawing
  ui/Hud.ts                top status bar + bottom control panel
  ui/Shop.ts               menu / shop / game-over overlays
```

### Status — current build

Implemented: single-player vs. configurable AI opponents, destructible terrain
with craters and collapse, gravity + per-round wind, drag-to-aim with live
trajectory preview, fall damage, a 6-weapon arsenal (incl. MIRV and terrain-
building Dirt Clod), an economy with a between-rounds shop, and multi-round
matches with a scoreboard.

Planned next: defensive items (shields, parachutes), explosion particles &
sound, smarter weapon-buying AI, and a PWA manifest for offline install.
