import { state } from '../state.js';
import usHolidaysData from '../../keywords/us-holidays.json';

export const HOLIDAYS_CONTEXT_ID = 'us-holidays';

// The holidays list ships inside the bundle (unlike calm-the-chaos categories,
// which are fetched at runtime): it is static, seasonal muting must work even
// if GitHub is unreachable, and issue #1 asked for it in this repo. If
// calm-the-chaos ever grows a category with the same name, upstream wins and
// this module only supplies the simple-mode card if no upstream card covers it.
export function mergeHolidaysIntoState(appState, categoryData = usHolidaysData) {
    const categoryName = Object.keys(categoryData || {})[0];
    const category = categoryName ? categoryData[categoryName] : null;
    if (!category?.keywords || Object.keys(category.keywords).length === 0) {
        return false;
    }

    if (!appState.keywordGroups[categoryName]) {
        // Copy so state mutations never write back into the imported JSON,
        // which is shared across re-merges (refresh data re-runs this)
        appState.keywordGroups[categoryName] = {
            [categoryName]: { ...category, keywords: { ...category.keywords } }
        };

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
        const covered = Object.entries(groups).some(([id, group]) =>
            id !== HOLIDAYS_CONTEXT_ID && group?.categories?.includes(categoryName));
        if (covered) {
            delete groups[HOLIDAYS_CONTEXT_ID];
            appState.selectedContexts?.delete(HOLIDAYS_CONTEXT_ID);
        } else {
            groups[HOLIDAYS_CONTEXT_ID] = {
                title: categoryName,
                description: category.description
                    || 'American holiday chatter and seasonal creep',
                categories: [categoryName]
            };
        }
    }
    return true;
}

// Re-apply after keyword/context groups load or refresh (they replace the
// objects this merge writes into)
export function ensureHolidaysCategory() {
    mergeHolidaysIntoState(state);
}
