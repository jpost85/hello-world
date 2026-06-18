# Liberty Calls

A browser-based, turn-based strategy game set in the American Revolution.
**Play either side** — fight for independence as the Patriots, or wield the
Royal Navy and an army of regulars as the British Crown to crush the rebellion —
with the AI commanding your opponent across a map of the thirteen colonies.

No build step, no dependencies — it's plain HTML, CSS, and JavaScript.

## Play

Open `index.html` directly in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

Click **New Campaign** to begin. Your progress autosaves to the browser, so
**Continue** resumes where you left off.

**On a phone** the map fills the screen and the region/dispatch panel becomes a
bottom sheet (tap a region to open it, or use the grip handle). Pinch, double-tap,
or use the on-screen **+ / −** buttons to zoom, and drag to pan the map. The
desktop layout is unchanged.

## How it plays

- **Treasury (gold):** collected each turn from the regions you hold. Spend it
  to recruit troops.
- **Resolve (morale):** each side's will to fight. Win battles and seize ground
  to raise yours and drain the enemy's. If a side's Resolve hits zero, it
  collapses.
- **Recruit:** select one of your regions and press *Muster* to raise soldiers
  there (costs gold).
- **Manpower:** each region has a finite pool of musterable young men, scaled to
  its ~1775 population. Mustering depletes it and the fallen never return, so a
  long war drains the colonies dry — populous regions can field armies while the
  frontier cannot. Gold is no use without men. The British, by contrast, ship
  regulars from overseas, unconstrained by colonial population.
- **March & Attack:** select a region holding troops, then click an adjacent
  region — green to reinforce your own land, red to attack the enemy. Each army
  acts once per turn. A slider lets you choose how many troops to commit.
- **Generals (✦):** historical commanders, each with their own character.
  Washington is a peerless defender who spares his men; Greene retreats with his
  army intact; Gates mauls whoever assaults him. Cornwallis hits devastatingly
  hard but bleeds his ranks; Burgoyne is bold but courts disaster; Howe is a
  steady all-rounder. Each has separate attack/defense ratings and traits
  (casualties inflicted/avoided, risk of capture), shown — with a period
  portrait — in the region panel.
  They ride with their army on a march or assault; a general whose region is
  overrun — or whose shattered assault is run down — is captured: a heavy morale
  blow with no replacement, so guard them.
- **Cities** (Boston, New York City, Philadelphia, Charleston, and British
  Halifax in Nova Scotia) are fortified port sub-regions inside their colony's
  countryside; New York City and Philadelphia are the capitals. A city can be
  held even when its countryside is enemy (the British supply New York City and
  Halifax by sea), so taking one means besieging it through the surrounding
  countryside. Nova Scotia is a British northern bastion reachable overland from
  Maine or by sea.
- **Sea zones (⚓)** link the harbours out in the Atlantic. Whoever's navy holds
  a zone can sail armies between its harbours in one move, mount amphibious
  assaults, and blockade enemy ports there (halving their income). Britain rules
  the waves at the start; France's entry seizes the mid-Atlantic and southern
  seas, opening Patriot sea movement and blockading New York.
- **Winter** thins sizable armies left in the open each year — some winters far
  worse than others — while armies sheltering in a city are spared. Don't keep a
  great host in the field through the winter.
- **France** may enter the war on your side if your Resolve stays high past
  1776, bringing gold, regulars, and a fleet.

### Winning

Drive every British garrison from the colonies, or break the Crown's Resolve.
Failing an outright victory, you must reach 1783 still holding Philadelphia
**and** winning the war of will — a passive defence is not enough, as the Crown
holds on unless the rebellion has the upper hand. Lose your last region, lose
your capital with broken morale, or let your own Resolve hit zero, and the
rebellion falls.

The Crown is a formidable opponent by design: it holds little territory but
receives fresh regulars by sea throughout the war, commands the coast with the
Royal Navy, and concentrates its forces to drive on Philadelphia. You
out-produce Britain, but reckless attacks bleed you dry — defend your capital,
mass your forces, pick favourable fights, blunt the blockade when France comes,
and time your push. It is a genuinely hard war to win: the simple defensive AI
used for tuning prevails only about one game in ten, so a thinking commander
has real room to outplay it.

## Project layout

| File | Purpose |
| --- | --- |
| `index.html` | Page structure and screens |
| `styles.css` | Colonial/parchment theme and layout |
| `game.js` | Game state, map, battles, AI, and persistence |
| `assets/generals/` | General portrait art, keyed to each commander |
| `assets/ships/` | Tall-ship art for the sea nodes (British / American) |
| `liberty-call.html` | Single-file build (CSS + JS + portraits inlined) for easy sharing |
| `build.js` | Builds `liberty-call.html`: inlines the CSS/JS and base64-embeds the portraits |
| `tools-genmap.js` | Dev tool: projects a US-states GeoJSON into the SVG map paths in `game.js` |
| `test-sim.js` | Headless smoke test (runtime errors, decisive endings) |
| `test-balance.js` | Headless balance check (win rate, game length) |

The map is drawn from real state outlines (projected to SVG), arranged in their
colonial configurations: present-day West Virginia is part of Virginia, all
thirteen colonies (including New Hampshire and Rhode Island) are represented,
and the District of Maine is its own Patriot territory reachable only via New
Hampshire or from Quebec. A hand-built Quebec sits to the north, and distant
states form neutral backdrop terrain. Regions made of more than one modern
state (Virginia with West Virginia, Appalachia with Kentucky and Tennessee) are
dissolved into a single outline, so no internal state border shows.

Beyond the colonies lie six **neutral / disputed frontier regions** held by
local militia — Vermont (the New Hampshire Grants), the Ontario peninsula of
British Canada, the Ohio Country, Appalachia (the Kentucky/Tennessee
backcountry), the Alabama country of the Gulf frontier, and East Florida.
Either side can march in
and claim them for extra income and position. The British, despite their small
holdings, receive periodic shiploads of regulars to offset the colonies'
economic advantage.

## Tests

The logic is testable headlessly under Node (a minimal DOM is stubbed):

```bash
node test-sim.js       # smoke test: core loop runs without errors
node test-balance.js   # balance: competent-player win rate and game length
```
