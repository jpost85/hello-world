# All-Time World Cup Simulator ⚽🏆

A browser game in the spirit of the viral **82-0**: draft a team of soccer
legends and run a gauntlet of the greatest national sides of all time. Win
every match to be crowned champion of history — **lose once and it's over.**

No build step, no dependencies. Just open `index.html` in a browser.

## How to play

1. **Pick a squad style:**
   - **All-Time** — themed tiers (The Talisman, The Playmaker, The No. 9, …),
     each spanning every era, so you weigh Pelé against Messi.
   - **By Decade** — field the greatest XI of a single decade (1960s–2020s).
   - **By Nation** — build an all-time team from one of 20 nations across six continents.
   - **By Region** — an all-time XI from a whole confederation (South America,
     Europe, Africa, North America, Asia).
2. **Draft your 4-3-3** — one legend per position. Your XI is laid out on a
   visual pitch with line-by-line attack / midfield / defence ratings.
3. **Run the cup** — a freshly drawn 10-match bracket every time: a 3-game
   **group stage** against good-but-beatable sides (eased in, easiest first),
   then a 7-game **knockout** drawn from the all-time greats and shuffled, with
   the strongest side you drew saved for the final. No two runs are alike.
4. **Win it all** — one defeat ends the run. The match engine rewards a strong,
   balanced XI but always leaves room for an upset. **Share** your result as an
   emoji scorecard from the win or defeat screen.

> Constrained modes (Decade / Nation / Region) scale the gauntlet to the
> *ceiling* of your chosen pool, so they're winnable rather than hopeless while
> drafting well within a mode still matters. All-Time is left unscaled. The
> per-round win probability is always shown.

## How it works

| Concern        | Approach                                                                 |
|----------------|--------------------------------------------------------------------------|
| Player data    | Curated JSON-style dataset of ~330 legends from 30+ countries (`js/players.js`). All-time greats are a finite, well-known set, so no flaky stats API is needed. |
| Team building  | All-time "tier pick" slots in `js/slots.js`; decade/nation/region modes generate position-filtered pools in `js/modes.js`. |
| Modes          | `js/modes.js` builds mode-aware, de-duplicated draft pools, derives each nation's confederation, and only offers a decade/nation/region that can actually field a full XI. |
| Opponents      | ~37 legendary sides in `js/opponents.js`, split into `group` and `knockout` tiers; each run draws a random bracket (`buildBracket` in `js/game.js`). |
| Match engine   | Rated simulation in `js/engine.js`: line strengths → expected goals → a Poisson draw for the scoreline, so upsets are always possible. |
| UI / flow      | Vanilla JS screens in `js/game.js` (incl. the visual pitch + share card), styled in `css/styles.css`. |

## Project layout

```
index.html          # shell that loads everything (open this)
css/styles.css      # all styling
js/players.js       # the legend database (extend this to add players)
js/slots.js         # all-time draft tiers
js/modes.js         # all-time / decade / nation modes + pool generation
js/opponents.js     # the gauntlet of all-time teams
js/engine.js        # match simulation + win-probability
js/game.js          # screens, state and rendering
```

## Extending it

- **Add players:** drop a new entry in `js/players.js`. Decade/nation modes pick
  it up automatically from its `pos` / `decade` / `nation`; reference its `id` in
  `js/slots.js` to also add it to an all-time tier. Add enough at a position and
  a new decade/nation becomes playable on its own (modes self-validate).
- **Add opponents:** append to `js/opponents.js` with `att` / `mid` / `def` ratings.
- **Tune difficulty:** the edge coefficient and baseline in `js/engine.js`
  (`expectedGoals`) control how often the better team wins.

Future ideas: a salary-cap draft variant, an image (canvas) export of the share
card, and online opponents / leaderboards.
