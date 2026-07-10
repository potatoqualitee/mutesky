import { state, saveState } from './state.js';
import { keywordCache } from './stateCache.js';
import { addKeywordWithCase, clearManuallyUnchecked } from './handlers/context/selectionModel.js';
import { removeKeyword } from './handlers/keywords/keyword-utils.js';
import { muteCache } from './handlers/mute/muteCache.js';

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

// Matches the Bluesky lexicon cap for a muted word value
const MAX_KEYWORD_LENGTH = 1000;

function findCased(set, keyword) {
    const lower = keyword.toLowerCase();
    for (const entry of set) {
        if (entry.toLowerCase() === lower) return entry;
    }
    return null;
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
        keywords[keyword] = { weight: 3, description: 'Added by you' };
    }
    appState.keywordGroups[MY_KEYWORDS_CATEGORY] = {
        [MY_KEYWORDS_CATEGORY]: {
            description: 'Keywords you added yourself — muted at every filter level',
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
    const result = { added: [], activated: [], duplicates: [] };
    const curated = getCuratedKeywordMap();

    for (const keyword of parseKeywordInput(rawText)) {
        const lower = keyword.toLowerCase();
        state.removedMyKeywords.delete(lower);

        if (findCased(state.myKeywords, keyword)) {
            result.duplicates.push(keyword);
            continue;
        }

        const curatedCase = curated.get(lower);
        if (curatedCase) {
            // Already in a curated list: check that one instead of creating a
            // duplicate entry with a second owner
            clearManuallyUnchecked(curatedCase);
            addKeywordWithCase(curatedCase);
            result.activated.push(curatedCase);
            continue;
        }

        state.myKeywords.add(keyword);
        clearManuallyUnchecked(keyword);
        addKeywordWithCase(keyword);
        result.added.push(keyword);
    }

    if (result.added.length > 0 || result.activated.length > 0) {
        syncMyKeywordsCategory();
        saveState();
    }
    return result;
}

// Delete a keyword from the list. If it ever reached Bluesky it is unmuted on
// the next Mute submit via its tombstone, and the manuallyUnchecked entry
// keeps seedActiveFromMutedKeywords from re-checking it after a reload that
// happens before that submit. A keyword that was never muted gets no
// tombstone: a lingering one could later delete an identical mute the user
// creates in Bluesky itself.
export function removeMyKeyword(keyword) {
    const cased = findCased(state.myKeywords, keyword);
    if (!cased) return false;

    const lower = cased.toLowerCase();
    state.myKeywords.delete(cased);
    removeKeyword(cased);

    if (state.originalMutedKeywords.has(lower) || state.sessionMutedKeywords.has(lower)) {
        state.removedMyKeywords.add(lower);
        state.manuallyUnchecked.add(cased);
    }

    syncMyKeywordsCategory();
    saveState();
    return true;
}

// Selection to submit: active keywords minus tombstoned removals, so a
// removed keyword can never ride along (even if Enable All or mute seeding
// re-activated its string in the meantime)
export function getSubmittableKeywords() {
    return Array.from(state.activeKeywords)
        .filter(keyword => !state.removedMyKeywords.has(keyword.toLowerCase()));
}

// Managed list to submit: everything in our categories plus tombstones, so
// Bluesky drops removed keywords instead of preserving them as unmanaged
export function getManagedKeywordsForSubmit(ourKeywordsLower) {
    return Array.from(new Set([...ourKeywordsLower, ...state.removedMyKeywords]));
}

// After Bluesky accepts an update the removals are real; forget the tombstones
export function clearRemovedMyKeywords() {
    if (state.removedMyKeywords.size > 0) {
        state.removedMyKeywords.clear();
        saveState();
    }
}
