# Trending Controversy System

`scripts/trending/` automatically detects the day's political controversies
from news headlines and publishes them as muted phrases. It runs on GitHub
Actions every 6 hours (`.github/workflows/trending.yml`), commits
`keywords/trending.json` + `keywords/trending-state.json`, and the app fetches
the result from `raw.githubusercontent.com` at startup (see
`js/api/trending.js`), merging the phrases into the existing **New
Developments** category so that context card stays current automatically. If
the upstream category or card is ever missing, the app installs a standalone
fallback card instead.

## Pipeline (each run)

1. **Fetch** — 15 political RSS/Atom feeds, each tagged `left`, `center`, or
   `right` (`FEEDS` in `lib.js`). Failures are tolerated; if fewer than 20
   headlines arrive the run aborts without touching state, so a network outage
   can't wipe the list. With a `BRAVE_API_KEY` secret, Brave News search adds
   extra headlines.
2. **Extract** — headlines from the last 48h are tokenized into 1–3 word
   n-grams. Boundary words must be meaningful (no stopwords), phrases matching
   the evergreen/generic blocklist are dropped. Cross-outlet frequency — not
   capitalization — decides what matters, which stays robust against Title
   Case headlines.
3. **Score** — for each candidate phrase:

   ```
   base            = distinctOutlets + 0.5 * extraMentions
   spectrumFactor  = bipartisan ? 1 + min(leftOutlets, rightOutlets) * 0.25
                                : 0.35
   score           = base * spectrumFactor
   ```

   *bipartisan* means at least one left-leaning AND one right-leaning outlet
   carried it — that's what makes something "the controversy of the day"
   rather than one side's talking point. Shorter phrases are absorbed by
   longer ones that contain them and score comparably ("biden laptop" folds
   into "hunter biden laptop").

## Retention: how long a phrase stays muted

Every tracked phrase carries an exponentially decaying **heat**:

```
heat = heat * 0.75 + todayScore        (per run; ~14h half-life at 4 runs/day)
```

Admission requires `score >= 6` **and** bipartisan coverage. Once in, the
phrase's expiry is:

```
retentionDays = clamp(3 + 2*log2(1 + peakHeat/6) + daysActive/2,  3, 30)
```

- a one-day flap gets the 3-day minimum,
- a story that burns hot (high `peakHeat`) or keeps making headlines on new
  calendar days (`daysActive`) stretches toward the 30-day cap,
- the expiry refreshes on every run where the phrase still scores ≥ 3, so a
  story that stays in the news stays muted indefinitely,
- once coverage stops, the phrase rides out its earned window and is dropped.

The published list is capped at the 60 hottest phrases.

## Output

`keywords/trending.json` uses the same category format as calm-the-chaos.
Weights map heat percentile to the app's filter levels: the top 20% get
weight 3 (visible even at the "Minimal" level), the next 30% weight 2, the
rest weight 1.

## Tuning

All knobs live in `TUNING` in `scripts/trending/lib.js`; false positives go
in `GENERIC_PHRASES`. The logic is pure and covered by
`tests/unit/trending.test.js`.
