import { TRENDING_URL } from '../config.js';
import { state } from '../state.js';

export const TRENDING_CONTEXT_ID = 'trending-controversies';

// Pure merge so tests can exercise it without network: folds the fetched
// keywords into the same-named category from calm-the-chaos (normally
// "New Developments", which already has its own simple-mode card). If the
// category or card is missing upstream, installs a standalone fallback so
// trending still surfaces.
export function mergeTrendingIntoState(appState, categoryData) {
    const categoryName = Object.keys(categoryData || {})[0];
    const category = categoryName ? categoryData[categoryName] : null;
    if (!category?.keywords || Object.keys(category.keywords).length === 0) {
        return false;
    }

    const existing = appState.keywordGroups[categoryName]?.[categoryName];
    if (existing?.keywords) {
        // Keep the curated description; trending wins on keyword collisions
        Object.assign(existing.keywords, category.keywords);
    } else {
        appState.keywordGroups[categoryName] = categoryData;

        // Advanced mode only shows categories in selectedCategories once that
        // set is non-empty (persisted sessions), so register the new category
        if (appState.selectedCategories?.size > 0) {
            appState.selectedCategories.add(categoryName);
        }
    }

    // fetchContextGroups replaces the contextGroups object, so this runs after
    // both fetches (whichever finishes last) to survive the overwrite. A card
    // is only added when no fetched context group already shows the category.
    const groups = appState.contextGroups || {};
    if (Object.keys(groups).length > 0) {
        const covered = Object.values(groups)
            .some(group => group?.categories?.includes(categoryName));
        if (!covered) {
            groups[TRENDING_CONTEXT_ID] = {
                title: categoryName,
                description: category.description
                    || "Today's controversies from across the news spectrum, updated automatically",
                categories: [categoryName]
            };
        }
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
