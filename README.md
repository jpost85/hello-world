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
  (casualties inflicted/avoided, risk of capture), shown in the region panel.
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

The Crown is a hard opponent by design: it holds little territory but receives
fresh regulars by sea throughout the war and concentrates them to drive on
Philadelphia. You out-produce Britain, but reckless attacks bleed you dry —
defend your capital, mass your forces, pick favourable fights, and time your
push. Against a competent defence the campaign is roughly a one-in-three win.

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

Beyond the colonies lie five **neutral / disputed frontier regions** held by
local militia — Vermont (the New Hampshire Grants), the Ontario peninsula of
British Canada, the Ohio Country, Appalachia (the Kentucky/Tennessee
backcountry), and East Florida. Either side can march in
and claim them for extra income and position. The British, despite their small
holdings, receive periodic shiploads of regulars to offset the colonies'
economic advantage.

## Tests

The logic is testable headlessly under Node (a minimal DOM is stubbed):

```bash
node test-sim.js       # smoke test: core loop runs without errors
node test-balance.js   # balance: competent-player win rate and game length
```
