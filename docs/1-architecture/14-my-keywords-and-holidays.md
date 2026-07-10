# My Keywords and US Holidays (Issue #1)

Two features answer issue #1: a user-defined mute list ("My Keywords") and a
bundled "US Holidays" category for seasonal creep.

## US Holidays

`keywords/us-holidays.json` ships inside the bundle (same single-category
shape as calm-the-chaos files) and `js/api/holidays.js` merges it into state
after every fetch/refresh, mirroring the trending merge:

- Installs the `US Holidays` category into `state.keywordGroups` **only when
  upstream doesn't already ship one** — if calm-the-chaos ever adds the same
  category name, upstream wins and the bundled copy backs off.
- Installs a simple-mode card (`us-holidays`) unless an upstream context group
  already shows the category.
- Weights control the filter slider: the seasonal-creep flagships (Christmas,
  Thanksgiving, Halloween...) are weight 3 (visible at Minimal), while broad
  or ambiguous words ("turkey" the country, "holiday", "Lent") are weight 0 so
  they only mute at Complete.

Call sites: `js/initialization.js` (after the initial fetches, before
`ensureTrendingContext()` so trending's overlap dedup sees holiday keywords)
and `refreshAllData()` in `js/api/index.js` (after the state restore).

## My Keywords

User-added keywords live in two persisted per-DID sets on state:

- `state.myKeywords` — the list itself, original case.
- `state.removedMyKeywords` — lowercase tombstones for deletions that have not
  reached Bluesky yet.

`js/myKeywords.js` projects the list into `state.keywordGroups` as a synthetic
`My Keywords` category (every keyword weight 3, so it survives all filter
levels). Because the category looks exactly like a fetched one, everything
downstream — checkboxes, counts, `getOurKeywords()`,
`muteCache.getOurKeywordsMap()`, MuteService's managed list — picks the
keywords up with no special cases. The projection is rebuilt after anything
that replaces the `keywordGroups` object (initial load, refresh, tab
visibility restore).

### Add semantics

`addMyKeywords(rawText)` accepts bulk paste (newline- or comma-separated,
leading `#` stripped). Each keyword is checked immediately (added to
`activeKeywords`); nothing reaches Bluesky until the Mute button, like every
other selection. A keyword that already exists in a curated category is
**activated there instead of duplicated** — one string, one owner.

### Remove semantics (tombstones)

Deleting a chip must eventually *unmute* the keyword, but
`MuteService.updateMutedKeywords()` preserves any muted word not in
`ourKeywordsList`. Simply dropping the keyword from the category would strand
it muted-forever on Bluesky. So removal:

1. deletes it from `myKeywords` (and the synthetic category),
2. adds a lowercase tombstone to `removedMyKeywords`,
3. adds it to `manuallyUnchecked` (so `seedActiveFromMutedKeywords()` cannot
   re-check it after a reload that happens before the next submit),
4. removes it from `activeKeywords`.

On submit, `getSubmittableKeywords()` filters tombstoned strings out of the
selection and `getManagedKeywordsForSubmit()` appends the tombstones to the
managed list, so Bluesky drops them. After a successful update
`clearRemovedMyKeywords()` forgets the tombstones. `getMuteUnmuteCounts()`
counts pending tombstoned unmutes so the Mute button stays honest.

### UI

The `<my-keywords-modal>` component is a dumb shell (like the settings modal):
`index.html` loads `js/components/**` **unbundled** as native ESM, so
component files must not import app state or anything that pulls bare
specifiers like `@atproto/api`. All behavior lives in
`js/handlers/myKeywordsHandlers.js` inside the bundle, reached via
`window.myKeywordsHandlers`. The handler renders the chip list (escaped with
`escapeHtml`/`escapeJsAttr` — user keywords are hostile input) and a storage
meter that estimates the next submit's muted-words payload against the PDS's
~150KB preferences cap (`MAX_PREFERENCES_BYTES` from `js/mute.js`).

Entry points: user-menu item in the top nav, "Add My Keywords" link under the
simple-mode context cards, "+ My Keywords" button in the advanced-mode
sidebar, and a "Manage" button on the synthetic category's card.

### Interactions worth knowing

- **Enable/Disable All** treat My Keywords like any category: Disable All
  unchecks (but never deletes) the user's list.
- The filter slider never touches custom keywords: `applyFilterLevel()` only
  re-levels categories inside selected contexts, and My Keywords belongs to no
  context.
- `resetState()`/`forceRefresh()` preserve `myKeywords`/`removedMyKeywords`
  the same way they preserve `manuallyUnchecked` — Refresh Data must not eat
  the user's list.
- mute.js already used the phrase "custom keywords" for *pre-existing Bluesky
  mutes the app never manages*; that concept is unchanged. My Keywords are
  managed keywords with a user-owned source of truth.

Tests: `tests/unit/myKeywords.test.js`, `tests/unit/holidaysMerge.test.js`,
`tests/integration/myKeywordsUI.test.js`.
