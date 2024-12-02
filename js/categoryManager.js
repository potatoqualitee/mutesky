import { state } from './state.js';
import { getDisplayName, getCategoryState, getCheckboxClass, getAllKeywordsForCategory } from './utils/categoryUtils.js';
import { filterKeywordGroups } from './utils/keywordFilters.js';

function calculateKeywordsToMute() {
    const keywordsToMute = new Set();

    if (state.mode === 'simple') {
        state.selectedContexts.forEach(contextId => {
            const context = state.contextGroups[contextId];
            if (context && context.categories) {
                context.categories.forEach(category => {
                    if (!state.selectedExceptions.has(category)) {
                        // Get keywords sorted by weight and limited by target count
                        const keywords = getAllKeywordsForCategory(category, true);
                        console.log(`Adding ${keywords.length} keywords from ${category} to mute list`);
                        keywords.forEach(keyword => keywordsToMute.add(keyword));
                    }
                });
            }
        });
    } else {
        state.activeKeywords.forEach(keyword => keywordsToMute.add(keyword));
    }

    return keywordsToMute;
}

function calculateKeywordCount() {
    return calculateKeywordsToMute().size;
}

export {
    getDisplayName,
    getCategoryState,
    getCheckboxClass,
    filterKeywordGroups,
    getAllKeywordsForCategory,
    calculateKeywordsToMute,
    calculateKeywordCount
};
