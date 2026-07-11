import { state } from '../../js/state.js';

// A small but realistic dataset:
// - "Gun Policy" is shared by two contexts (violence + politics)
// - "assault weapon" appears in BOTH Gun Policy and Political Rhetoric
//   (cross-category keyword overlap)
// - weights span 0..3 so filter levels matter
// - "World Leaders" is all weight 0, mirroring the real category that only
//   surfaces at the Complete level (empty at every other level)
export const KEYWORD_GROUPS = {
    'Gun Policy': {
        'Gun Policy': {
            description: 'Gun policy debates',
            keywords: {
                'gun control': { weight: 3 },
                'second amendment': { weight: 2 },
                'assault weapon': { weight: 3 },
                'open carry': { weight: 1 }
            }
        }
    },
    'Political Rhetoric': {
        'Political Rhetoric': {
            description: 'Partisan rhetoric',
            keywords: {
                'culture war': { weight: 3 },
                'assault weapon': { weight: 2 },
                'talking points': { weight: 1 }
            }
        }
    },
    'Healthcare and Public Health': {
        'Healthcare and Public Health': {
            description: 'Health policy',
            keywords: {
                'single payer': { weight: 3 },
                'medicare for all': { weight: 2 },
                'public option': { weight: 1 }
            }
        }
    },
    'World Leaders': {
        'World Leaders': {
            description: 'Heads of state',
            keywords: {
                'president exemplar': { weight: 0 },
                'chancellor exemplar': { weight: 0 }
            }
        }
    }
};

export const CONTEXT_GROUPS = {
    'violence': {
        title: 'Violence & Security',
        description: 'Violence and weapons',
        categories: ['Gun Policy']
    },
    'politics': {
        title: 'Political Discord',
        description: 'Partisan conflict',
        categories: ['Political Rhetoric', 'Gun Policy']
    },
    'health': {
        title: 'Healthcare',
        description: 'Health policy debates',
        categories: ['Healthcare and Public Health']
    },
    // Mirrors the real Global Affairs context: one category is empty at
    // every level below Complete
    'world': {
        title: 'Global Affairs',
        description: 'International disputes',
        categories: ['Political Rhetoric', 'World Leaders']
    }
};

export function keywordsOf(category) {
    return Object.keys(KEYWORD_GROUPS[category][category].keywords);
}

// Reset the singleton state object to a known baseline with fixture data
export function resetStateWithFixtures({
    mode = 'simple',
    filterLevel = 3,
    authenticated = true
} = {}) {
    state.authenticated = authenticated;
    state.did = 'did:plc:test-user';
    state.mode = mode;
    // Clone so tests mutating state never pollute the shared fixtures
    state.keywordGroups = structuredClone(KEYWORD_GROUPS);
    state.contextGroups = structuredClone(CONTEXT_GROUPS);
    state.displayConfig = { displayNames: {}, combinedCategories: {} };
    state.activeKeywords = new Set();
    state.originalMutedKeywords = new Set();
    state.sessionMutedKeywords = new Set();
    state.manuallyUnchecked = new Set();
    state.myKeywords = new Set();
    state.myKeywordProvenance = new Map();
    state.removedMyKeywords = new Set();
    state.appliedCatalogMigrations = new Set();
    state.managedKeywordLedger = new Map();
    state.currentTrendingKeywords = new Set();
    state.trendingSnapshotLoaded = false;
    state.selectedContexts = new Set();
    state.selectedExceptions = new Set();
    state.selectedCategories = new Set();
    state.followedContexts = new Set();
    state.searchTerm = '';
    state.filterMode = 'all';
    state.menuOpen = false;
    state.lastModified = null;
    state.filterLevel = filterLevel;
    state.lastBulkAction = null;
    localStorage.clear();
    return state;
}

// Let debounced renders/saves (16ms timeout + rAF shim) settle
export function flushUpdates() {
    return new Promise(resolve => setTimeout(resolve, 60));
}
