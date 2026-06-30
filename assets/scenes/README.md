# Transition-screen paintings (optional)

Drop public-domain Romantic-era paintings here and rebuild (`node build.js`)
to use them as backgrounds for the title and game-over screens. Missing files
fall back to the parchment gradient — nothing breaks if they're absent.

Expected files (any reasonable size; the build embeds them as-is, so optimise
to ~1280px wide JPEG, ~150–250 KB each, before committing):

| File | Where it shows | Suggested public-domain painting |
| --- | --- | --- |
| `title.jpg`   | Title screen        | Emanuel Leutze, *Washington Crossing the Delaware* (1851) |
| `victory.jpg` | Game over — you won | John Trumbull, *Surrender of Lord Cornwallis* (1820) |
| `defeat.jpg`  | Game over — you lost| John Trumbull, *The Death of General Warren at Bunker's Hill* (1786) |

All three are firmly in the public domain (artists died well over a century
ago). Source them from Wikimedia Commons. A dark scrim is layered over each for
text legibility, so darker/medium reproductions read best.
