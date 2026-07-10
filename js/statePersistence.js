import { KEYWORDS_BASE_URL, CONTEXT_GROUPS_URL, DISPLAY_CONFIG_URL } from './config.js';
import { state } from './state.js';
import { keywordCache } from './stateCache.js';
import { getKeywordsWithCase } from './keywordState.js';
import { syncMyKeywordsCategory } from './myKeywords.js';

// Helper to get storage key for current user
export function getStorageKey() {
    if (!state.did) {
        throw new Error('No DID set in state');
    }
    return `muteskyState-${state.did}`;
}

// Everything debouncedSave persists, as a comparable string. Set-derived
// arrays are sorted so two snapshots of the same logical state always
// compare equal: Set iteration order depends on insertion history, which
// loadState resets when it rebuilds the sets from storage.
export function serializeState() {
    return JSON.stringify({
        activeKeywords: Array.from(state.activeKeywords).sort(),
        selectedCategories: Array.from(state.selectedCategories).sort(),
        selectedContexts: Array.from(state.selectedContexts).sort(),
        selectedExceptions: Array.from(state.selectedExceptions).sort(),
        manuallyUnchecked: Array.from(state.manuallyUnchecked).sort(),
        myKeywords: Array.from(state.myKeywords).sort(),
        removedMyKeywords: Array.from(state.removedMyKeywords).sort(),
        mode: state.mode,
        lastModified: state.lastModified,
        filterLevel: state.filterLevel,
        lastBulkAction: state.lastBulkAction
    });
}

// Debounced save state with shorter delay
const debouncedSave = (() => {
    let timeout;
    return () => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
            try {
                localStorage.setItem(getStorageKey(), serializeState());
            } catch (error) {
                console.error('Error saving state:', error);
            }
        }, 16); // One frame delay for more responsive saves
    };
})();

export function saveState() {
    debouncedSave();
}

export function loadState() {
    try {
        // Clear all selections first
        state.activeKeywords.clear();
        state.selectedContexts.clear();
        state.selectedExceptions.clear();
        state.selectedCategories.clear();
        // Don't clear manuallyUnchecked - let it persist
        // My Keywords are per-DID: clear before loading so an account with no
        // saved state never inherits (or tombstone-unmutes) another account's
        state.myKeywords.clear();
        state.removedMyKeywords.clear();

        const saved = localStorage.getItem(getStorageKey());
        if (saved) {
            const data = JSON.parse(saved);

            // Get map of lowercase -> original case keywords
            const keywordMap = getKeywordsWithCase();

            // Ensure we're working with Sets and proper case
            state.activeKeywords = new Set(
                (data.activeKeywords || []).map(keyword => {
                    // Use original case from keyword map if available
                    return keywordMap.get(keyword.toLowerCase()) || keyword;
                })
            );
            state.selectedCategories = new Set(data.selectedCategories || []);
            state.selectedContexts = new Set(data.selectedContexts || []);
            state.selectedExceptions = new Set(data.selectedExceptions || []);
            state.manuallyUnchecked = new Set(
                (data.manuallyUnchecked || []).map(keyword => {
                    // Use original case from keyword map if available
                    return keywordMap.get(keyword.toLowerCase()) || keyword;
                })
            );
            // Kept as saved: user case for their own keywords, lowercase tombstones
            state.myKeywords = new Set(data.myKeywords || []);
            state.removedMyKeywords = new Set(
                (data.removedMyKeywords || []).map(keyword => keyword.toLowerCase())
            );

            // Load other state properties
            state.mode = data.mode || 'simple';
            state.lastModified = data.lastModified || null;
            state.filterLevel = typeof data.filterLevel === 'number' ? data.filterLevel : 0;
            state.lastBulkAction = data.lastBulkAction || null;

            // Force cache refresh
            keywordCache.clear();
        }
    } catch (error) {
        console.error('Error loading saved state:', error);
        // If there's an error, ensure state is clean but preserve manuallyUnchecked
        const unchecked = new Set(state.manuallyUnchecked);
        resetState();
        state.manuallyUnchecked = unchecked;
    }

    // Rebuild (or drop) the projected My Keywords category and its cache
    // entries for whatever DID just loaded, so a previous account's list
    // never lingers in keywordGroups or the managed-keyword caches
    syncMyKeywordsCategory();
}

export function resetState() {
    // Preserve auth state
    const did = state.did;
    const authenticated = state.authenticated;
    // Preserve mute state
    const originalMutedKeywords = new Set(state.originalMutedKeywords);
    const sessionMutedKeywords = new Set(state.sessionMutedKeywords);

    // Reset all other state
    state.mode = 'simple';
    state.activeKeywords.clear();
    state.originalMutedKeywords.clear();
    state.sessionMutedKeywords.clear();
    // Don't clear manuallyUnchecked or myKeywords/removedMyKeywords - the
    // user's own list and sticky opt-outs survive resets and data refreshes
    state.selectedContexts.clear();
    state.selectedExceptions.clear();
    state.selectedCategories.clear();
    state.searchTerm = '';
    state.filterMode = 'all';
    state.menuOpen = false;
    state.lastModified = null;
    state.filterLevel = 0;
    state.lastBulkAction = null;
    keywordCache.clear();

    // Restore auth state
    state.did = did;
    state.authenticated = authenticated;
    // Restore mute state
    state.originalMutedKeywords = originalMutedKeywords;
    state.sessionMutedKeywords = sessionMutedKeywords;

    saveState();
}

export function forceRefresh() {
    // Preserve auth state
    const did = state.did;
    const authenticated = state.authenticated;
    // Preserve mute state
    const originalMutedKeywords = new Set(state.originalMutedKeywords);
    const sessionMutedKeywords = new Set(state.sessionMutedKeywords);

    // Clear all cached data
    localStorage.removeItem(getStorageKey());
    state.keywordGroups = {};
    state.contextGroups = {};
    state.displayConfig = {};
    keywordCache.clear();
    resetState();

    // Restore auth state
    state.did = did;
    state.authenticated = authenticated;
    // Restore mute state
    state.originalMutedKeywords = originalMutedKeywords;
    state.sessionMutedKeywords = sessionMutedKeywords;

    // Force browser to skip cache when fetching
    const cacheBuster = `?t=${new Date().getTime()}`;
    return {
        keywordsBaseUrl: `${KEYWORDS_BASE_URL}${cacheBuster}`,
        contextGroupsUrl: `${CONTEXT_GROUPS_URL}${cacheBuster}`,
        displayConfigUrl: `${DISPLAY_CONFIG_URL}${cacheBuster}`
    };
}
