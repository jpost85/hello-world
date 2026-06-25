# Mister Munchy!

A mobile-first, browser-based Pac-Man style arcade game. No build step, no
dependencies — just open it in a browser.

## Play

Open `index.html` in any modern browser, or serve the folder and visit it:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

It's designed phone-first, so it works great added to a home screen and
played in portrait.

## Controls

- **Swipe** anywhere on the board to steer (primary on touch)
- **On-screen D-pad** below the board, with a pause button in the middle
- **Keyboard:** Arrow keys or WASD to move, `P` to pause, `Space`/`Enter` to start
- **Sound toggle** (speaker icon, top-right) — preference is saved locally

## How it plays

- Munch every dot to clear the level.
- Glowing **power pellets** turn the ghosts blue — chase them down for big,
  escalating points (200 → 400 → 800 → 1600).
- Each ghost hunts with its own personality (the classic Blinky / Pinky /
  Inky / Clyde targeting behaviours), alternating between scatter and chase.
- Grab the bonus **fruit** that appears mid-level for extra points.
- You get 3 lives, plus a bonus life at 10,000 points. Clear the board to
  advance — every level the ghosts get a little faster and a little hungrier.
- High score is saved locally in your browser.

## Sound

All audio is generated procedurally with the Web Audio API — there are no
audio files to download, so it stays tiny and works offline. You get the
"waka-waka" chomp, a power-pellet warble, a rising background siren that
gets more urgent as the maze empties (and speeds up while a power pellet is
active), plus ghost-eaten, fruit, death, and extra-life cues. Mobile devices
also get a haptic buzz on big moments. Tap the speaker icon to mute.

## Files

- `index.html` — markup and HUD
- `style.css` — mobile-first responsive layout (safe-area aware, no scroll/zoom)
- `game.js` — the game engine (maze, movement, ghost AI, rendering)
