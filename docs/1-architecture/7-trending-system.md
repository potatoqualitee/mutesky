# Trending Controversy System

The engine that detects the day's political controversies lives in
**calm-the-chaos**, not here. It reads political news feeds on a schedule and
publishes the hot phrases to a gist; MuteSky fetches that gist at startup and
folds the phrases into its existing **New Developments** category, so that
card stays current without a deploy.

For how phrases are detected, scored, retained and shaped — feeds, admission
thresholds, variant collapsing, exclusions, weights, descriptions — see
[the engine doc](https://github.com/potatoqualitee/calm-the-chaos/blob/main/docs/trending-system.md).
This page covers only what MuteSky owns: the fetch and the merge, both in
`js/api/trending.js`.

## Where the payload comes from

`TRENDING_URL` in `js/config.js` points at the raw gist
(`3488593dcc622acc736055fa00a9745e`, file `new-development.json`) rather than
a path in a repo, so new phrases go live without waiting for a Pages
redeploy.

The payload is a single-category object in the same shape as the rest of the
catalog — normally named `New Developments`. The merge reads the category
name off the payload instead of hardcoding it, so a rename upstream doesn't
strand the phrases in a category nothing displays.

## Fetching is pure enrichment

`fetchTrendingKeywords` clears the previous snapshot's bookkeeping up front,
then every failure path — non-`ok` response, non-object `keywords`, a payload
the merge reports as empty, or a thrown error — logs at `console.debug` and
returns without touching state further. `state.trendingSnapshotLoaded` flips
to `true` only after a merge reports it changed something.

That is the whole contract: the app has to work normally when the gist is
unreachable or malformed. Trending is enrichment, never a dependency, so it
gets no user-visible error and no retry.

The fetch uses `cache: 'no-store'`. A snapshot that refreshes every 6 hours
served from an HTTP cache would show phrases that are already expired.

Callers run this **after** the calm-the-chaos catalog and context-group
fetches, so the merge sees every other category's keywords (the overlap dedup
below only excludes what already exists) and can attach its card in one pass.

## What the merge does

`mergeTrendingIntoState(appState, categoryData)` is split out from the fetch
so tests can drive it without network; `tests/unit/trendingMerge.test.js`
covers each of the behaviors below.

### Overlap dedup, as an offline net

Phrases already muted by another category's permanent list are noise here —
muting "Kirk" adds nothing when "Charlie Kirk" is already muted. The engine
excludes catalog names on its side, so this check is the net for a **stale
snapshot**: a phrase that was novel when published but has since been
promoted into the permanent catalog.

Overlap is word-level with singular/plural folding, mirroring `lib.mjs` in
calm-the-chaos: "Trumps" overlaps "Trump" and "data centers" folds with
"data center", but "art" never matches inside "martial law". The folding is
reimplemented rather than imported so the app never loads engine code; if the
engine's rule changes, this copy has to follow.

Every `keywordGroups` category except the trending one is scanned, matched
lowercased.

### Trending wins collisions; curation keeps the description

Collisions are matched **case-insensitively**, like the rest of the mute
pipeline. An incoming `Drone Sightings` replaces a curated `drone sightings`
instead of sitting alongside it — two spellings of one phrase would mute the
same thing twice and show up as a duplicate row.

Trending wins the keyword entry, because its weight and description are
fresher than the catalog's. It does **not** win the category description:
that's the text on the context card, and it stays whatever calm-the-chaos
curated.

Only keywords that weren't already in the category are recorded in
`state.currentTrendingKeywords`; one that collided with a curated entry
belongs to curation, not to this snapshot.

### The fallback card is conditional

Normally an upstream context group already shows New Developments and no card
is needed. When none does, the merge installs its own group under
`TRENDING_CONTEXT_ID` (`trending-controversies`) so the phrases are reachable
in simple mode.

The check ignores its own id and looks for any *other* group listing the
category. When one is found, the fallback card is deleted along with any
persisted selection of it — otherwise the same category would appear as two
cards.

This step runs last for a reason: `fetchContextGroups` replaces the whole
`contextGroups` object, so a card installed earlier would be overwritten.
When `contextGroups` is still empty (the fetches race), the card step is
skipped entirely and a later merge attaches it.

Installing a standalone category also registers it in `selectedCategories`,
but only when that set is already non-empty. An empty set means "no persisted
advanced-mode selection", where everything shows anyway; a populated one
means the user has chosen, and adding to it is how a brand-new category
becomes visible. When the category already existed, the set is left alone —
a user who deliberately deselected New Developments stays deselected.

### `updatedAt` overrides the "Keywords updated" stamp

The sidebar stamp normally tracks the calm-the-chaos catalog, which changes
rarely. Trending refreshes every 6 hours, so a newer `updatedAt` on the
payload wins and is reformatted into the same display string. It only wins
when it parses and is genuinely newer, so a malformed or backdated timestamp
can't roll the stamp backwards.

## Legacy category migration

Before the overhaul this engine installed its own standalone **Trending
Controversies** category, and sessions persisted that selection. The merge
deletes that name from `selectedCategories` and adds the current category
name in its place, so it doesn't linger as a ghost entry pointing at a
category nobody publishes any more.

The context-group id `trending-controversies` is deliberately reused from
that era, which is why the fallback-card branch also has to clear a persisted
selection of it when an upstream card takes over.
