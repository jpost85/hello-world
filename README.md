# Liberty's Call

A browser-based, turn-based strategy game set in the American Revolution,
inspired by the classic Koei title *Liberty or Death*. You command the
Continental Army across a map of the thirteen colonies and fight the British
Crown for independence.

No build step, no dependencies — it's plain HTML, CSS, and JavaScript.

## Play

Open `index.html` directly in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

Click **New Campaign** to begin. Your progress autosaves to the browser, so
**Continue** resumes where you left off.

## How it plays

- **Treasury (gold):** collected each turn from the regions you hold. Spend it
  to recruit troops.
- **Resolve (morale):** each side's will to fight. Win battles and seize ground
  to raise yours and drain the enemy's. If a side's Resolve hits zero, it
  collapses.
- **Recruit:** select one of your regions and press *Recruit* to muster soldiers
  there.
- **March & Attack:** select a region holding troops, then click an adjacent
  region — green to reinforce your own land, red to attack the enemy. Each army
  acts once per turn. A slider lets you choose how many troops to commit.
- **Cities & capitals** produce more gold and defend better; taking or losing
  one swings morale hard.
- **France** may enter the war on your side if your Resolve stays high past
  1776, bringing gold, regulars, and a fleet.

### Winning

Drive every British garrison from the colonies, or break the Crown's Resolve.
Lose your last region or your own Resolve and the rebellion falls. Reckless
attacks bleed you dry — mass your forces, pick favourable fights, and time your
push.

## Project layout

| File | Purpose |
| --- | --- |
| `index.html` | Page structure and screens |
| `styles.css` | Colonial/parchment theme and layout |
| `game.js` | Game state, map, battles, AI, and persistence |
| `liberty-call.html` | Single-file build (CSS + JS inlined) for easy sharing |
| `tools-genmap.js` | Dev tool: projects a US-states GeoJSON into the SVG map paths in `game.js` |
| `test-sim.js` | Headless smoke test (runtime errors, decisive endings) |
| `test-balance.js` | Headless balance check (win rate, game length) |

The map is drawn from real state outlines (projected to SVG), arranged in their
colonial configurations: present-day West Virginia is part of Virginia, all
thirteen colonies (including New Hampshire and Rhode Island) are represented,
and the District of Maine is its own Patriot territory reachable only via New
Hampshire or from Quebec. A hand-built Quebec sits to the north, and distant
states form neutral backdrop terrain.

Beyond the colonies lie four **neutral / disputed frontier regions** held by
local militia — Vermont (the New Hampshire Grants), the Ohio Country, Appalachia
(the Kentucky/Tennessee backcountry), and East Florida. Either side can march in
and claim them for extra income and position. The British, despite their small
holdings, receive periodic shiploads of regulars to offset the colonies'
economic advantage.

## Tests

The logic is testable headlessly under Node (a minimal DOM is stubbed):

```bash
node test-sim.js       # smoke test: core loop runs without errors
node test-balance.js   # balance: competent-player win rate and game length
```
