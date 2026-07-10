import { state, forceRefresh } from '../state.js';
import { fetchKeywordGroups, fetchContextGroups, fetchDisplayConfig } from './fetchers.js';
import { fetchTrendingKeywords, ensureTrendingContext } from './trending.js';
import { ensureHolidaysCategory } from './holidays.js';
import { syncMyKeywordsCategory } from '../myKeywords.js';

export { fetchKeywordGroups, fetchContextGroups, fetchDisplayConfig, fetchTrendingKeywords };

export async function refreshAllData() {
    try {
        // Store current state before refresh
        const activeKeywords = new Set(state.activeKeywords);
        const selectedContexts = new Set(state.selectedContexts);
        const selectedExceptions = new Set(state.selectedExceptions);
        const selectedCategories = new Set(state.selectedCategories);
        const currentMode = state.mode;
        const menuOpen = state.menuOpen;
        const filterLevel = state.filterLevel;
        // Preserve auth state
        const did = state.did;
        const authenticated = state.authenticated;
        // Preserve mute state
        const originalMutedKeywords = new Set(state.originalMutedKeywords);
        const sessionMutedKeywords = new Set(state.sessionMutedKeywords);

        // Fetch fresh data
        await Promise.all([
            fetchKeywordGroups(true),
            fetchContextGroups(true),
            fetchDisplayConfig(true),
            fetchTrendingKeywords()
        ]);

        // Restore previous state
        state.activeKeywords = activeKeywords;
        state.selectedContexts = selectedContexts;
        state.selectedExceptions = selectedExceptions;
        state.selectedCategories = selectedCategories;
        state.mode = currentMode;
        state.menuOpen = menuOpen;
        state.filterLevel = filterLevel;
        // Restore auth state
        state.did = did;
        state.authenticated = authenticated;
        // Restore mute state
        state.originalMutedKeywords = originalMutedKeywords;
        state.sessionMutedKeywords = sessionMutedKeywords;

        // AFTER restoring the snapshots: re-attach the bundled/user categories
        // and the trending context, registering them in the (restored)
        // selectedCategories set -- doing this earlier would be clobbered by
        // the restore above
        ensureHolidaysCategory();
        syncMyKeywordsCategory();
        ensureTrendingContext();

        console.debug('Data refreshed successfully');
    } catch (error) {
        console.error('Failed to refresh data:', error);
        throw error;
    }
}
