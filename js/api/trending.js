import { TRENDING_URL } from '../config.js';
import { state } from '../state.js';

export const TRENDING_CONTEXT_ID = 'trending-controversies';

// Pure merge so tests can exercise it without network: installs the fetched
// category into keywordGroups and (when context groups are loaded) exposes it
// as a simple-mode context card
export function mergeTrendingIntoState(appState, categoryData) {
    const categoryName = Object.keys(categoryData || {})[0];
    const category = categoryName ? categoryData[categoryName] : null;
    if (!category?.keywords || Object.keys(category.keywords).length === 0) {
        return false;
    }

    appState.keywordGroups[categoryName] = categoryData;

    // Advanced mode only shows categories in selectedCategories once that set
    // is non-empty (persisted sessions), so register the new category there
    if (appState.selectedCategories?.size > 0) {
        appState.selectedCategories.add(categoryName);
    }

    // fetchContextGroups replaces the contextGroups object, so this runs after
    // both fetches (whichever finishes last) to survive the overwrite
    if (Object.keys(appState.contextGroups || {}).length > 0) {
        appState.contextGroups[TRENDING_CONTEXT_ID] = {
            title: 'Trending Now',
            description: "Today's controversies from across the news spectrum, updated automatically",
            categories: [categoryName]
        };
    }
    return true;
}

let lastFetched = null;

export async function fetchTrendingKeywords() {
    try {
        const response = await fetch(TRENDING_URL, { cache: 'no-store' });
        if (!response.ok) {
            console.debug('[Trending] No trending keywords available:', response.status);
            return;
        }
        lastFetched = await response.json();
        mergeTrendingIntoState(state, lastFetched);
    } catch (error) {
        // Trending is enrichment: the app must work fine without it
        console.debug('[Trending] Failed to fetch trending keywords:', error);
    }
}

// Re-apply the merge after context groups load (they may overwrite the object)
export function ensureTrendingContext() {
    if (lastFetched) {
        mergeTrendingIntoState(state, lastFetched);
    }
}
