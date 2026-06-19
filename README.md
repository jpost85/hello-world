# All-Time World Cup Simulator ⚽🏆

A browser game in the spirit of the viral **82-0**: draft a team of soccer
legends and run a gauntlet of the greatest national sides of all time. Win
every match to be crowned champion of history — **lose once and it's over.**

No build step, no dependencies. Just open `index.html` in a browser.

## How to play

1. **Tier picks** — fill an 11-man 4-3-3 by choosing one legend for each of
   11 themed positions (The Talisman, The Playmaker, The No. 9, …). Every pool
   spans decades, so you're weighing Pelé against Messi, Maldini against Beckenbauer.
2. **The gauntlet** — face 10 all-time great teams in escalating order, from the
   Mighty Magyars of 1954 to the 1970 Brazil side as the final boss.
3. **Win it all** — one defeat ends the run. The match engine rewards a strong,
   balanced XI but always leaves room for an upset.

## How it works

| Concern        | Approach                                                                 |
|----------------|--------------------------------------------------------------------------|
| Player data    | Curated JSON-style dataset of ~58 legends (`js/players.js`). All-time greats are a finite, well-known set, so no flaky stats API is needed. |
| Team building  | "Tier pick" slots defined in `js/slots.js` — one legend per themed position. |
| Opponents      | Legendary national sides with line ratings in `js/opponents.js`.          |
| Match engine   | Rated simulation in `js/engine.js`: line strengths → expected goals → a Poisson draw for the scoreline, so upsets are always possible. |
| UI / flow      | Vanilla JS screens in `js/game.js`, styled in `css/styles.css`.           |

## Project layout

```
index.html          # shell that loads everything (open this)
css/styles.css      # all styling
js/players.js       # the legend database (extend this to add players)
js/slots.js         # draft tiers / positions
js/opponents.js     # the gauntlet of all-time teams
js/engine.js        # match simulation + win-probability
js/game.js          # screens, state and rendering
```

## Extending it

- **Add players:** drop a new entry in `js/players.js` and reference its `id`
  in the relevant slot pool in `js/slots.js`.
- **Add opponents:** append to `js/opponents.js` with `att` / `mid` / `def` ratings.
- **Tune difficulty:** the edge coefficient and baseline in `js/engine.js`
  (`expectedGoals`) control how often the better team wins.

Future ideas: all-decade / single-nation modes, a salary-cap draft variant,
shareable results, and a visual pitch formation view.
