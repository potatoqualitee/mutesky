import { loadState, saveState, resetState, forceRefresh, getStorageKey, serializeState } from './statePersistence.js';
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
    myKeywords: new Set(),              // User-added custom keywords (original case)
    myKeywordProvenance: new Map(),     // lowercase keyword -> ownership/retirement metadata
    removedMyKeywords: new Set(),       // Deleted custom keywords awaiting unmute on next submit (lowercase)
    appliedCatalogMigrations: new Set(),// Per-DID ids for append-only catalog migrations
    managedKeywordLedger: new Map(),    // lowercase keyword -> last submitted MuteSky ownership
    currentTrendingKeywords: new Set(), // Ephemeral lowercase set from the latest successful trending fetch
    trendingSnapshotLoaded: false,      // Never expire ledger entries after a failed/missing fetch
    selectedContexts: new Set(),
    followedContexts: new Set(),        // Explicit context subscriptions for future catalog additions
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
    getStorageKey,
    serializeState
};
