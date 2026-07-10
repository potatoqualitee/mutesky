import { TRENDING_URL } from '../config.js';
import { state } from '../state.js';

export const TRENDING_CONTEXT_ID = 'trending-controversies';

// Pre-overhaul sessions persisted the standalone category this engine used to
// install; migrate that selection so it doesn't linger as a ghost entry
const LEGACY_CATEGORY_NAME = 'Trending Controversies';

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

    if (appState.selectedCategories?.delete(LEGACY_CATEGORY_NAME)) {
        appState.selectedCategories.add(categoryName);
    }

    // Keywords already muted by another category (the permanent lists) are
    // noise here. The generator excludes them too; this is the offline net
    // for a stale trending.json
    const elsewhere = new Set();
    for (const [name, data] of Object.entries(appState.keywordGroups || {})) {
        if (name === categoryName) continue;
        Object.keys(data?.[name]?.keywords || {})
            .forEach(keyword => elsewhere.add(keyword.toLowerCase()));
    }
    const fresh = Object.entries(category.keywords)
        .filter(([keyword]) => !elsewhere.has(keyword.toLowerCase()));

    const existing = appState.keywordGroups[categoryName]?.[categoryName];
    if (existing?.keywords) {
        // Keep the curated description; trending wins keyword collisions,
        // matched case-insensitively like the rest of the mute pipeline
        const byLower = new Map(
            Object.keys(existing.keywords).map(keyword => [keyword.toLowerCase(), keyword])
        );
        for (const [keyword, entry] of fresh) {
            const current = byLower.get(keyword.toLowerCase());
            if (current && current !== keyword) delete existing.keywords[current];
            existing.keywords[keyword] = entry;
        }
    } else if (fresh.length > 0) {
        appState.keywordGroups[categoryName] = {
            [categoryName]: { ...category, keywords: Object.fromEntries(fresh) }
        };

        // Advanced mode only shows categories in selectedCategories once that
        // set is non-empty (persisted sessions), so register the new category
        if (appState.selectedCategories?.size > 0) {
            appState.selectedCategories.add(categoryName);
        }
    }

    // The sidebar's "Keywords updated" stamp tracks the calm-the-chaos repo,
    // which changes rarely; trending refreshes every 6 hours and should win
    if (category.updatedAt) {
        const updated = new Date(category.updatedAt);
        const current = new Date(appState.lastModified || 0);
        if (!Number.isNaN(updated.getTime())
            && (Number.isNaN(current.getTime()) || updated > current)) {
            appState.lastModified = updated.toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
                hour: 'numeric', minute: '2-digit', hour12: true
            });
        }
    }

    // fetchContextGroups replaces the contextGroups object, so this runs after
    // both fetches (whichever finishes last) to survive the overwrite. A card
    // is only added when no fetched context group already shows the category.
    const groups = appState.contextGroups || {};
    if (Object.keys(groups).length > 0 && appState.keywordGroups[categoryName]) {
        const covered = Object.entries(groups).some(([id, group]) =>
            id !== TRENDING_CONTEXT_ID && group?.categories?.includes(categoryName));
        if (covered) {
            // Upstream card owns the category: drop our fallback card and any
            // persisted ghost selection of it from pre-overhaul sessions
            delete groups[TRENDING_CONTEXT_ID];
            appState.selectedContexts?.delete(TRENDING_CONTEXT_ID);
        } else {
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
