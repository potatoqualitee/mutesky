import { state, saveState } from './state.js';
import { keywordCache } from './stateCache.js';
import { removeKeyword } from './handlers/keywords/keyword-utils.js';
import { muteCache } from './handlers/mute/muteCache.js';
import {
    getExpiredTrendingKeywordKeys,
    shouldManageCurrentKeyword
} from './managedKeywords.js';

// statePersistence.js imports this file through state.js, so keep this module
// free of imports that pull in the render pipeline or blueskyService. The two
// selectionModel helpers below are reimplemented locally to keep persistence
// cycle-safe and independent of UI/service initialization.

// User-defined keywords live in state.myKeywords and are projected into
// state.keywordGroups as the synthetic category below, so every existing
// pipeline (checkboxes, counts, getOurKeywords, MuteService's managed-keyword
// list) picks them up without special cases. Weight 3 keeps them visible at
// every filter level.
//
// Removal is two-phase because changes only reach Bluesky on Mute submit:
// deleting a keyword tombstones its lowercase form in
// state.removedMyKeywords. The tombstone keeps the keyword in the managed
// list for the next update (so Bluesky actually unmutes it, instead of
// preserving it as an unmanaged word) while getSubmittableKeywords() filters
// it out of the selection. Tombstones clear after a successful submit.
export const MY_KEYWORDS_CATEGORY = 'My Keywords';
export const MY_KEYWORD_ORIGIN_USER = 'user';
export const MY_KEYWORD_ORIGIN_RETIRED_DEFAULT = 'retired-default';

export function getMyKeywordProvenance(keyword, appState = state) {
    const metadata = appState.myKeywordProvenance?.get(keyword.toLowerCase());
    return metadata || { origin: MY_KEYWORD_ORIGIN_USER };
}

function setUserProvenance(keyword) {
    const lower = keyword.toLowerCase();
    const previous = getMyKeywordProvenance(keyword);
    state.myKeywordProvenance.set(lower, { origin: MY_KEYWORD_ORIGIN_USER });
    return previous.origin !== MY_KEYWORD_ORIGIN_USER;
}

// Matches the Bluesky lexicon cap for a muted word value
const MAX_KEYWORD_LENGTH = 1000;

function findCased(set, keyword) {
    const lower = keyword.toLowerCase();
    for (const entry of set) {
        if (entry.toLowerCase() === lower) return entry;
    }
    return null;
}

// Mirrors selectionModel.addKeywordWithCase: replace any case variant
function activateKeyword(keyword) {
    removeKeyword(keyword);
    state.activeKeywords.add(keyword);
}

// Mirrors selectionModel.clearManuallyUnchecked: case-insensitive delete
function clearUncheckedOptOut(keyword) {
    const cased = findCased(state.manuallyUnchecked, keyword);
    if (cased !== null) {
        state.manuallyUnchecked.delete(cased);
    }
}

function clearKeywordCaches() {
    keywordCache.clear();
    muteCache.clear();
}

// Rebuild the synthetic category from state.myKeywords (or drop it when the
// list is empty). Runs after every fetch/refresh because those replace the
// keywordGroups object wholesale.
export function syncMyKeywordsCategory(appState = state) {
    if (appState.myKeywords.size === 0) {
        if (appState.keywordGroups[MY_KEYWORDS_CATEGORY]) {
            delete appState.keywordGroups[MY_KEYWORDS_CATEGORY];
            appState.selectedCategories?.delete(MY_KEYWORDS_CATEGORY);
            clearKeywordCaches();
        }
        return;
    }

    const keywords = {};
    for (const keyword of appState.myKeywords) {
        const provenance = getMyKeywordProvenance(keyword, appState);
        const isRetired = provenance.origin === MY_KEYWORD_ORIGIN_RETIRED_DEFAULT;
        keywords[keyword] = {
            weight: 3,
            description: isRetired ? 'Kept from a retired MuteSky default' : 'Added by you'
        };
    }
    appState.keywordGroups[MY_KEYWORDS_CATEGORY] = {
        [MY_KEYWORDS_CATEGORY]: {
            description: 'Keywords you added or kept — muted at every filter level',
            keywords
        }
    };
    if (appState.selectedCategories?.size > 0) {
        appState.selectedCategories.add(MY_KEYWORDS_CATEGORY);
    }
    clearKeywordCaches();
}

// Split pasted text into candidate keywords: one per line or comma-separated,
// whitespace collapsed, leading '#' dropped (muting "word" already covers the
// tag). Case is preserved for display; matching stays case-insensitive.
export function parseKeywordInput(text) {
    const seen = new Set();
    const keywords = [];
    for (const piece of String(text || '').split(/[\n,]+/)) {
        const keyword = piece.replace(/^[#\s]+/, '').replace(/\s+/g, ' ').trim();
        if (!keyword || keyword.length > MAX_KEYWORD_LENGTH) continue;
        const lower = keyword.toLowerCase();
        if (seen.has(lower)) continue;
        seen.add(lower);
        keywords.push(keyword);
    }
    return keywords;
}

// Map of lowercase -> original case across curated (non-synthetic) categories,
// used to route additions that MuteSky already covers to the existing keyword
function getCuratedKeywordMap() {
    const map = new Map();
    Object.entries(state.keywordGroups).forEach(([category, categoryData]) => {
        if (category === MY_KEYWORDS_CATEGORY) return;
        const categoryInfo = categoryData[category];
        if (!categoryInfo?.keywords) return;
        Object.keys(categoryInfo.keywords).forEach(keyword => {
            map.set(keyword.toLowerCase(), keyword);
        });
    });
    return map;
}

// Add keywords from raw user input. Everything added or re-activated becomes
// checked immediately (the user's intent is to mute it); nothing reaches
// Bluesky until the Mute button is pressed, like every other selection.
export function addMyKeywords(rawText) {
    const result = { added: [], activated: [], duplicates: [], provenanceChanged: [] };
    const curated = getCuratedKeywordMap();

    for (const keyword of parseKeywordInput(rawText)) {
        const lower = keyword.toLowerCase();
        state.removedMyKeywords.delete(lower);

        const existing = findCased(state.myKeywords, keyword);
        const curatedCase = curated.get(lower);
        const isLiveTrend = state.currentTrendingKeywords.has(lower);

        // Typing a live trend into My Keywords is an explicit request to keep
        // it after the feed expires. Give it user ownership instead of merely
        // checking the temporary curated appearance.
        if (isLiveTrend) {
            const displayKeyword = existing || curatedCase || keyword;
            const wasActive = Boolean(findCased(state.activeKeywords, displayKeyword));
            if (!existing) {
                state.myKeywords.add(displayKeyword);
                result.added.push(displayKeyword);
            } else {
                result.duplicates.push(keyword);
            }
            if (setUserProvenance(displayKeyword)) {
                result.provenanceChanged.push(displayKeyword);
            }
            clearUncheckedOptOut(displayKeyword);
            activateKeyword(displayKeyword);
            if (existing && !wasActive) result.activated.push(displayKeyword);
            continue;
        }

        if (existing) {
            if (setUserProvenance(existing)) {
                result.provenanceChanged.push(existing);
            }
            result.duplicates.push(keyword);
            continue;
        }

        if (curatedCase) {
            // Already in a curated list: check that one instead of creating a
            // duplicate entry with a second owner
            clearUncheckedOptOut(curatedCase);
            activateKeyword(curatedCase);
            result.activated.push(curatedCase);
            continue;
        }

        state.myKeywords.add(keyword);
        setUserProvenance(keyword);
        clearUncheckedOptOut(keyword);
        activateKeyword(keyword);
        result.added.push(keyword);
    }

    if (result.added.length > 0 || result.activated.length > 0
        || result.provenanceChanged.length > 0) {
        syncMyKeywordsCategory();
        saveState();
    }
    return result;
}

// Delete a keyword from the list. It always tombstones: deciding from
// originalMutedKeywords here would be a race (the UI is usable before the
// mute-state fetch finishes, and the fetch can fail), and a lost tombstone
// strands the keyword muted-but-invisible on Bluesky. The manuallyUnchecked
// entry keeps seedActiveFromMutedKeywords from re-checking it after a reload
// that happens before the next submit. scrubStaleTombstones() below disposes
// of tombstones that turn out to have nothing to unmute.
export function removeMyKeyword(keyword) {
    const cased = findCased(state.myKeywords, keyword);
    if (!cased) return false;

    state.myKeywords.delete(cased);
    state.myKeywordProvenance.delete(cased.toLowerCase());
    removeKeyword(cased);
    state.removedMyKeywords.add(cased.toLowerCase());
    state.manuallyUnchecked.add(cased);

    syncMyKeywordsCategory();
    saveState();
    return true;
}

// Drop tombstones for keywords that are not actually muted on Bluesky. Runs
// whenever fresh mute state arrives (initializeKeywordState): there is
// nothing for such a tombstone to unmute, and letting one linger could later
// delete an identical mute the user creates in Bluesky's own UI. The
// manuallyUnchecked entry created alongside the tombstone goes with it,
// otherwise it would survive as a hidden opt-out that could suppress a
// same-named keyword a curated list ships later.
export function scrubStaleTombstones() {
    let changed = false;
    for (const tombstone of state.removedMyKeywords) {
        if (!state.originalMutedKeywords.has(tombstone)) {
            state.removedMyKeywords.delete(tombstone);
            clearUncheckedOptOut(tombstone);
            changed = true;
        }
    }
    if (changed) {
        saveState();
    }
}

// Selection to submit: active keywords minus tombstoned removals, so a
// removed keyword can never ride along (even if Enable All or mute seeding
// re-activated its string in the meantime)
export function getSubmittableKeywords() {
    const expiredTrending = getExpiredTrendingKeywordKeys();
    return Array.from(state.activeKeywords)
        .filter(keyword => !state.removedMyKeywords.has(keyword.toLowerCase()))
        .filter(keyword => !expiredTrending.has(keyword.toLowerCase()));
}

// Managed list to submit: everything in our categories plus tombstones, so
// Bluesky drops removed keywords instead of preserving them as unmanaged
export function getManagedKeywordsForSubmit(ourKeywordsLower) {
    const expiredTrending = getExpiredTrendingKeywordKeys();
    const currentManaged = Array.from(ourKeywordsLower)
        .filter(keyword => shouldManageCurrentKeyword(keyword));
    return Array.from(new Set([...currentManaged, ...state.removedMyKeywords, ...expiredTrending]));
}

// After Bluesky accepts an update the removals are real; forget the tombstones
export function clearRemovedMyKeywords() {
    if (state.removedMyKeywords.size > 0) {
        state.removedMyKeywords.clear();
        saveState();
    }
}
