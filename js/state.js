import { loadState, saveState, resetState, forceRefresh, getStorageKey } from './statePersistence.js';
import { setUser } from './userState.js';
import { canUnmuteKeyword, getMuteUnmuteCounts } from './keywordState.js';

// Core state object
export const state = {
    authenticated: false,
    did: null,                          // Track current user's DID
    mode: 'simple',
    keywordGroups: {},
    contextGroups: {},
    displayConfig: {},
    activeKeywords: new Set(),          // Currently checked keywords (only from our list)
    originalMutedKeywords: new Set(),   // All user's muted keywords (for safety check)
    sessionMutedKeywords: new Set(),    // New keywords muted this session
    manuallyUnchecked: new Set(),       // Keywords that user has manually unchecked
    selectedContexts: new Set(),
    selectedExceptions: new Set(),
    selectedCategories: new Set(),
    searchTerm: '',
    filterMode: 'all',
    menuOpen: false,
    lastModified: null,                 // Last-Modified header from keywords file
    filterLevel: 0,                     // Track current filter level (0=Minimal to 3=Complete)
    lastBulkAction: null                // Track when enable/disable all is used
};

// Re-export core functionality
export {
    loadState,
    saveState,
    resetState,
    forceRefresh,
    setUser,
    canUnmuteKeyword,
    getMuteUnmuteCounts,
    getStorageKey
};
