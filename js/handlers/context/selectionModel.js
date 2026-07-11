import { state } from '../../state.js';
import { getAllKeywordsForCategory } from '../../utils/categoryUtils.js';
import { isKeywordActive, removeKeyword } from '../keywords/keyword-utils.js';

import { hasRecordedManagedOwnership } from '../../managedKeywords.js';
// Single source of truth for selection state:
//
//   state.activeKeywords     -- the keywords that will be muted on submit
//   state.manuallyUnchecked  -- sticky individual opt-outs from advanced mode
//
// state.selectedContexts and state.selectedExceptions are simple-mode UI
// conveniences DERIVED from the keywords. Nothing in this module (or anywhere
// else) may wipe activeKeywords wholesale and rebuild it from contexts --
// that pattern destroyed advanced-mode partial selections and caused the
// simple/advanced mode confusion this model replaces.

// --- case-insensitive helpers for manuallyUnchecked ---

export function isManuallyUnchecked(keyword) {
    const lower = keyword.toLowerCase();
    for (const unchecked of state.manuallyUnchecked) {
        if (unchecked.toLowerCase() === lower) return true;
    }
    return false;
}

export function clearManuallyUnchecked(keyword) {
    const lower = keyword.toLowerCase();
    for (const unchecked of state.manuallyUnchecked) {
        if (unchecked.toLowerCase() === lower) {
            state.manuallyUnchecked.delete(unchecked);
            return;
        }
    }
}

// Add a keyword, replacing any existing case variation
export function addKeywordWithCase(keyword) {
    removeKeyword(keyword);
    state.activeKeywords.add(keyword);
}

// --- derived selection state (pure reads) ---

export function getContextCategories(contextId) {
    return state.contextGroups[contextId]?.categories ?? [];
}

// 'all' | 'partial' | 'none' for a category at the current filter level
export function getCategorySelectionState(category) {
    const keywords = getAllKeywordsForCategory(category, true);
    if (keywords.length === 0) return 'none';
    let active = 0;
    for (const keyword of keywords) {
        if (isKeywordActive(keyword)) active++;
    }
    if (active === 0) return 'none';
    return active === keywords.length ? 'all' : 'partial';
}

// 'all' | 'partial' | 'none' across a context's non-excepted categories
export function getContextSelectionState(contextId) {
    const allCategories = getContextCategories(contextId);
    const categories = allCategories
        .filter(category => !state.selectedExceptions.has(category));
    if (categories.length === 0) {
        // Every category excepted: keep an explicitly selected context selected,
        // otherwise its exception tags disappear and can never be cleared
        return allCategories.length > 0 && state.selectedContexts.has(contextId)
            ? 'all'
            : 'none';
    }

    let sawAll = true;
    let sawAny = false;
    let sawSelectable = false;
    for (const category of categories) {
        // A category with no keywords at the current filter level (e.g. all
        // weight-0, Complete-only keywords like World Leaders) can never
        // become active, so it must not pin the context below 'all' -- that
        // made the card unselectable AND undeselectable, since deselection
        // requires reaching 'all' first
        if (getAllKeywordsForCategory(category, true).length === 0) continue;
        sawSelectable = true;
        const categoryState = getCategorySelectionState(category);
        if (categoryState !== 'all') sawAll = false;
        if (categoryState !== 'none') sawAny = true;
    }
    if (!sawSelectable) {
        // Nothing selectable at this level: same rule as all-excepted above
        return state.selectedContexts.has(contextId) ? 'all' : 'none';
    }
    if (sawAll) return 'all';
    return sawAny ? 'partial' : 'none';
}

// Keep state.selectedContexts honest: a context is "selected" exactly when
// all of its non-excepted categories are fully active at the current level
export function syncDerivedContexts() {
    for (const contextId of Object.keys(state.contextGroups)) {
        if (getContextSelectionState(contextId) === 'all') {
            state.selectedContexts.add(contextId);
        } else {
            state.selectedContexts.delete(contextId);
        }
    }
}

// --- mutations (always local, always synchronous) ---

// Activate a category's keywords at the current filter level.
// clearUnchecked=true expresses explicit user intent ("select this whole
// topic"), which un-sticks previous individual opt-outs -- without this a
// context containing one manually unchecked keyword could never be selected.
export function activateCategory(category, { clearUnchecked = false, skipUnknownMuted = false } = {}) {
    for (const keyword of getAllKeywordsForCategory(category, true)) {
        const lower = keyword.toLowerCase();
        if (skipUnknownMuted && state.originalMutedKeywords.has(lower)
            && !hasRecordedManagedOwnership(lower)) continue;
        if (clearUnchecked) {
            clearManuallyUnchecked(keyword);
        } else if (isManuallyUnchecked(keyword)) {
            continue;
        }
        addKeywordWithCase(keyword);
    }
}

// Keywords (lowercased) that the current selection still claims: every
// non-excepted category of every selected context, at the current filter
// level. Deactivation must never remove these -- keyword strings can appear
// in more than one category.
export function keywordsClaimedBySelection() {
    const claimed = new Set();
    const claimingContexts = new Set([
        ...state.selectedContexts,
        ...state.followedContexts
    ]);
    for (const contextId of claimingContexts) {
        for (const category of getContextCategories(contextId)) {
            if (state.selectedExceptions.has(category)) continue;
            for (const keyword of getAllKeywordsForCategory(category, true)) {
                claimed.add(keyword.toLowerCase());
            }
        }
    }
    return claimed;
}

// Deactivate ALL of a category's keywords regardless of filter level, so
// keywords activated at a broader level never linger as unremovable orphans.
// Pass protect (a lowercase Set) to spare keywords other categories claim.
// recordUnchecked captures only active, actually-muted words when a user
// explicitly deselects a context. That narrow marker distinguishes deliberate
// unmute intent from an untouched external same-name collision.
export function deactivateCategory(category, {
    protect = null,
    recordUnchecked = false
} = {}) {
    for (const keyword of getAllKeywordsForCategory(category, false)) {
        const lower = keyword.toLowerCase();
        if (protect?.has(lower)) continue;
        if (recordUnchecked && isKeywordActive(keyword)
            && state.originalMutedKeywords.has(lower)) {
            clearManuallyUnchecked(keyword);
            state.manuallyUnchecked.add(keyword);
        }
        removeKeyword(keyword);
    }
}

// Re-align selected contexts' categories with a new filter level: keywords at
// the new level turn on (respecting manual opt-outs), keywords above it turn
// off. Keywords outside selected contexts are untouched, preserving advanced
// mode picks and existing Bluesky mutes.
export function applyFilterLevel() {
    const categories = new Set();
    const levelContexts = new Set([
        ...state.selectedContexts,
        ...state.followedContexts
    ]);
    for (const contextId of levelContexts) {
        for (const category of getContextCategories(contextId)) {
            if (!state.selectedExceptions.has(category)) categories.add(category);
        }
    }

    // Union across categories first: a keyword above the level in one category
    // must survive if a sibling category still includes it at this level
    const atLevelUnion = new Set();
    for (const category of categories) {
        for (const keyword of getAllKeywordsForCategory(category, true)) {
            atLevelUnion.add(keyword.toLowerCase());
        }
    }

    for (const category of categories) {
        for (const keyword of getAllKeywordsForCategory(category, false)) {
            if (atLevelUnion.has(keyword.toLowerCase())) {
                if (!isManuallyUnchecked(keyword)) addKeywordWithCase(keyword);
            } else {
                removeKeyword(keyword);
            }
        }
    }

    syncDerivedContexts();
}

// Stage newly published keywords for contexts the user explicitly follows.
// This mutates local pending state only; Bluesky is untouched until Mute.
// Individual opt-outs and whole-category exceptions remain authoritative.
export function applyFollowedContextUpdates() {
    for (const contextId of state.followedContexts) {
        if (!state.contextGroups[contextId]) continue;
        for (const category of getContextCategories(contextId)) {
            if (state.selectedExceptions.has(category)) continue;
            activateCategory(category, { skipUnknownMuted: true });
        }
    }

    syncDerivedContexts();
}

// Reflect the user's real Bluesky mutes into the pending selection. Runs after
// fetching muted keywords so mutes made elsewhere (or before this session)
// show up checked, unless the user has stickily opted out of them here.
export function seedActiveFromMutedKeywords(keywordCaseMap = null) {
    for (const muted of state.originalMutedKeywords) {
        if (isManuallyUnchecked(muted)) continue;
        if (isKeywordActive(muted)) continue;
        const lower = muted.toLowerCase();
        if (!keywordCaseMap?.has(lower)) continue;
        if (!hasRecordedManagedOwnership(lower)) continue;
        const cased = keywordCaseMap.get(lower);
        state.activeKeywords.add(cased);
    }
}
