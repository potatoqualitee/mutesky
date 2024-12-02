import { KEYWORDS_BASE_URL, CONTEXT_GROUPS_URL, DISPLAY_CONFIG_URL } from './config.js';

export const state = {
    authenticated: false,
    mode: 'simple',
    keywordGroups: {},
    contextGroups: {},
    displayConfig: {},
    activeKeywords: new Set(),          // Currently checked keywords (only from our list)
    originalMutedKeywords: new Set(),   // All user's muted keywords (for safety check)
    sessionMutedKeywords: new Set(),    // New keywords muted this session
    selectedContexts: new Set(),
    selectedExceptions: new Set(),
    selectedCategories: new Set(),
    searchTerm: '',
    filterMode: 'all',
    menuOpen: false,
    lastModified: null,                 // Last-Modified header from keywords file
    targetKeywordCount: 100             // Default to minimal keywords since default mode is simple
};

// Helper to get all keywords from our list
function getOurKeywords() {
    const ourKeywords = new Set();
    Object.entries(state.keywordGroups).forEach(([category, categoryData]) => {
        // Get the category info which contains the keywords
        const categoryInfo = categoryData[category];
        if (categoryInfo?.keywords) {
            // Add each keyword to our set
            Object.keys(categoryInfo.keywords).forEach(keyword => {
                ourKeywords.add(keyword.toLowerCase());
            });
        }
    });
    return ourKeywords;
}

// Helper to determine if a keyword can be unmuted
export function canUnmuteKeyword(keyword) {
    // Only allow unmuting if:
    // 1. It's in our list of keywords (case-insensitive)
    // 2. It was previously muted (either originally or this session)
    const ourKeywords = getOurKeywords();
    const lowerKeyword = keyword.toLowerCase();
    return ourKeywords.has(lowerKeyword) &&
           (state.originalMutedKeywords.has(lowerKeyword) || state.sessionMutedKeywords.has(lowerKeyword));
}

// Helper to get mute/unmute counts
export function getMuteUnmuteCounts() {
    const ourKeywords = getOurKeywords();
    let toMute = 0;
    let toUnmute = 0;

    // Only count keywords from our list
    ourKeywords.forEach(keyword => {
        const isActive = Array.from(state.activeKeywords)
            .some(active => active.toLowerCase() === keyword);
        const wasOriginallyMuted = state.originalMutedKeywords.has(keyword);

        if (isActive && !wasOriginallyMuted) {
            // New keyword to mute
            toMute++;
        } else if (!isActive && wasOriginallyMuted) {
            // Existing keyword to unmute
            toUnmute++;
        }
    });

    return { toMute, toUnmute };
}

// Helper to set target keyword count and trigger refresh
export function setTargetKeywordCount(count) {
    const validCounts = [100, 300, 500, 2000];
    if (!validCounts.includes(count)) {
        throw new Error('Invalid target keyword count. Must be one of: 100, 300, 500, 2000');
    }
    state.targetKeywordCount = count;
    saveState();
}

export function saveState() {
    const saveData = {
        activeKeywords: Array.from(state.activeKeywords),
        selectedCategories: Array.from(state.selectedCategories),
        mode: state.mode,
        lastModified: state.lastModified,
        targetKeywordCount: state.targetKeywordCount
    };

    console.debug('Saving state with active keywords:', saveData.activeKeywords);
    localStorage.setItem('calmChaosState', JSON.stringify(saveData));
}

export function loadState() {
    try {
        console.debug('Loading state');
        // Clear all selections first
        state.activeKeywords.clear();
        state.selectedContexts.clear();
        state.selectedExceptions.clear();
        state.selectedCategories.clear();

        const saved = localStorage.getItem('calmChaosState');
        if (saved) {
            const data = JSON.parse(saved);
            state.activeKeywords = new Set(data.activeKeywords || []);
            state.selectedCategories = new Set(data.selectedCategories || []);
            state.mode = data.mode || 'simple';
            state.lastModified = data.lastModified || null;
            state.targetKeywordCount = data.targetKeywordCount || (state.mode === 'simple' ? 100 : 2000);
            console.debug('Loaded active keywords:', Array.from(state.activeKeywords));
            console.debug('Loaded selected categories:', Array.from(state.selectedCategories));
        } else {
            console.log('No saved state found');
            // If no saved state, ensure targetKeywordCount matches mode
            state.targetKeywordCount = state.mode === 'simple' ? 100 : 2000;
        }
    } catch (error) {
        console.error('Error loading saved state:', error);
        // If there's an error, ensure state is clean
        resetState();
    }
}

export function resetState() {
    console.log('Resetting state...');
    state.authenticated = false;
    state.mode = 'simple';
    state.activeKeywords.clear();
    state.originalMutedKeywords.clear();
    state.sessionMutedKeywords.clear();
    state.selectedContexts.clear();
    state.selectedExceptions.clear();
    state.selectedCategories.clear();
    state.searchTerm = '';
    state.filterMode = 'all';
    state.menuOpen = false;
    state.lastModified = null;
    // Set targetKeywordCount to 100 since default mode is simple
    state.targetKeywordCount = 100;
    saveState();
}

export function forceRefresh() {
    // Clear all cached data
    console.log('Force refreshing data...');
    localStorage.clear();
    state.keywordGroups = {};
    state.contextGroups = {};
    state.displayConfig = {};
    resetState();

    // Force browser to skip cache when fetching
    const cacheBuster = `?t=${new Date().getTime()}`;
    return {
        keywordsBaseUrl: `${KEYWORDS_BASE_URL}${cacheBuster}`,
        contextGroupsUrl: `${CONTEXT_GROUPS_URL}${cacheBuster}`,
        displayConfigUrl: `${DISPLAY_CONFIG_URL}${cacheBuster}`
    };
}
