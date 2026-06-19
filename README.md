# All-Time World Cup Simulator ⚽🏆

A browser game in the spirit of the viral **82-0**: draft a team of soccer
legends and run a gauntlet of the greatest national sides of all time. Win
every match to be crowned champion of history — **lose once and it's over.**

No build step, no dependencies. Just open `index.html` in a browser.

## How to play

1. **Pick a squad style:**
   - **All-Time** — themed tiers (The Talisman, The Playmaker, The No. 9, …),
     each spanning every era, so you weigh Pelé against Messi.
   - **By Decade** — field the greatest XI of a single decade (1960s–2010s).
   - **By Nation** — build an all-time team from one of 8 powerhouse nations.
2. **Draft your 4-3-3** — one legend per position. Your XI is laid out on a
   visual pitch with line-by-line attack / midfield / defence ratings.
3. **The gauntlet** — face 10 all-time great teams in escalating order, from the
   Mighty Magyars of 1954 to the 1970 Brazil side as the final boss.
4. **Win it all** — one defeat ends the run. The match engine rewards a strong,
   balanced XI but always leaves room for an upset. **Share** your result as an
   emoji scorecard from the win or defeat screen.

> Decade and Nation modes are deliberately harder: a constrained XI can't
> cherry-pick the best at every position the way an all-time XI can, while the
> opponents stay fixed. The per-round win probability is always shown.

## How it works

| Concern        | Approach                                                                 |
|----------------|--------------------------------------------------------------------------|
| Player data    | Curated JSON-style dataset of ~160 legends (`js/players.js`). All-time greats are a finite, well-known set, so no flaky stats API is needed. |
| Team building  | All-time "tier pick" slots in `js/slots.js`; decade/nation modes generate position-filtered pools in `js/modes.js`. |
| Modes          | `js/modes.js` builds mode-aware, de-duplicated draft pools and only offers decades/nations that can actually field a full XI. |
| Opponents      | Legendary national sides with line ratings in `js/opponents.js`.          |
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
