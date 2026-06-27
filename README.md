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
    Items.ts         defensive items (shields, parachutes)
    Particles.ts     spark + debris particle field
    AI.ts            trajectory-sampling opponent + shop logic
    Economy.ts       payouts and starting cash
  input/TouchControls.ts   drag-to-aim pointer handling
  render/Renderer.ts       canvas drawing
  audio/Sound.ts           WebAudio-synthesized SFX (no asset files)
  ui/Hud.ts                top status bar + bottom control panel
  ui/Shop.ts               menu / shop / game-over overlays
```

### Status — current build

Implemented: single-player vs. configurable AI opponents, destructible terrain
with craters and collapse, gravity + per-round wind, drag-to-aim with live
trajectory preview, fall damage, a 6-weapon arsenal (incl. MIRV and terrain-
building Dirt Clod), an economy with a between-rounds shop, and multi-round
matches with a scoreboard.

Polish pass: explosion particles + flying debris, decaying screen shake,
fully synthesized sound effects (fire / explosion / death, with a mute
toggle), and the two iconic defensive items — **shields** (absorb blast
damage, with a bubble visual) and **parachutes** (auto-deploy to cancel fall
damage). The AI buys defences between rounds too.

Planned next: a PWA manifest + service worker for offline install, smarter
AI weapon selection, and optional local hotseat play.
