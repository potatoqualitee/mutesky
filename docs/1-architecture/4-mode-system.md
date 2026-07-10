# Mode System Architecture

## Overview

MuteSky operates in two distinct modes:
- Simple Mode: Context-based filtering with filter levels (0-3)
- Advanced Mode: Direct keyword management

Both modes are views over the same underlying state. There is exactly one
source of truth:

- `state.activeKeywords` — the keywords that will be muted on submit
- `state.manuallyUnchecked` — sticky individual opt-outs made in advanced mode

`state.selectedContexts` and `state.selectedExceptions` are simple-mode UI
conveniences **derived from the keywords**, never the other way around. No
code path may clear `activeKeywords` and rebuild it from contexts — that
pattern (used before the 2026 rework) destroyed advanced-mode partial
selections on every mode switch and made context cards "unclick themselves."

All of this logic lives in `js/handlers/context/selectionModel.js`.

## Weight System

### Filter Level → Weight Threshold
```javascript
// js/utils/weightManager.js
case 0: return 3;  // Minimal (most restrictive)
case 1: return 2;  // Moderate
case 2: return 1;  // Extensive
case 3: return 0;  // Complete (most inclusive)
```

`getAllKeywordsForCategory(category, true)` returns the category's keywords
at the current filter level; `(category, false)` returns all of them.

## Derived Selection State

Every category and context has a tri-state derived from `activeKeywords`:

- `all` — every keyword (at the current filter level) is active
- `partial` — some keywords are active
- `none` — no keywords are active

Context cards render this honestly: `selected` when `all`, a dashed `partial`
style when partially selected, unstyled when `none`.

`syncDerivedContexts()` recomputes `state.selectedContexts` (a context is
selected exactly when its derived state is `all`). It runs after every
mutation and never touches keywords.

## Mutations

All mutations are local (they only touch the keywords they are about) and
synchronous (no chunking across animation frames — the old chunked processing
let follow-up steps race against a half-built keyword set).

### Context toggle (`contextToggleHandler.js`)
- **Selecting** (card was `none` or `partial`): activate every non-excepted
  category at the current filter level, clearing `manuallyUnchecked` for those
  keywords. Clearing is what makes the click predictable — without it, a
  context containing one manually unchecked keyword could never stay selected.
- **Deselecting** (card was `all`): deactivate its categories — except
  categories that another selected context still claims, so deselecting one
  context never silently flips a sibling to partial.

### Exception toggle (`exceptionToggleHandler.js`)
- **Adding**: deactivate exactly that category's keywords.
- **Removing**: if any selected context claims the category, activate it
  (clearing opt-outs, same explicit-intent rule as context selection).

### Keyword / category toggle (advanced mode, `keywords/core-handlers.js`)
- Checking removes the keyword from `manuallyUnchecked` and activates it.
- Unchecking adds it to `manuallyUnchecked` and deactivates it.
- Afterwards `updateSimpleModeState()` re-derives the context cards.

### Filter level change (`events.js` → `applyFilterLevel()`)
For each non-excepted category of each selected context: keywords at the new
level turn on (respecting `manuallyUnchecked`), keywords above it turn off.
Keywords outside selected contexts — advanced-mode picks, existing Bluesky
mutes — are untouched.

### Deactivation always uses the unfiltered list
Deactivating a category removes keywords at **all** weights, not just the
current level, so keywords activated at a broader level can never linger as
unremovable orphans.

## Startup and Sync

1. `loadState()` restores the persisted sets for the current DID.
2. `initializeKeywordState()` fetches the user's real muted words from
   Bluesky into `originalMutedKeywords`, then `seedActiveFromMutedKeywords()`
   adds them to the pending selection (unless manually unchecked) so mutes
   made elsewhere show up checked.
3. `syncDerivedContexts()` derives the simple-mode view.

## Caching

`contextCache` memoizes keyword lists and per-category active counts keyed by
filter level. **Invalidation is never throttled** — the old 16ms gate dropped
all but the first invalidation when handlers looped over categories, leaving
stale keyword sets that mis-rendered checkboxes.

## Best Practices

- Mutate keywords through `selectionModel.js` helpers.
- After any mutation: invalidate affected cache categories, call
  `syncDerivedContexts()`, then render/save (debounced).
- Never rebuild `activeKeywords` from `selectedContexts`.
- Case-insensitive comparisons for anything that may have come from Bluesky
  (`isKeywordActive`, `removeKeyword`, `isManuallyUnchecked`).
