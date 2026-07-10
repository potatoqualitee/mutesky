import { state, saveState } from '../../state.js';
import { filterKeywordGroups } from '../../categoryManager.js';
import { debouncedUpdate } from './ui-utils.js';
import { keywordCache } from './cache.js';
import { removeKeyword, isKeywordActive, processBatchKeywords } from './keyword-utils.js';
import { updateSimpleModeState } from '../contextHandlers.js';
import { renderInterface } from '../../renderer.js';

export function handleEnableAll() {
    // Clear manually unchecked since this is an explicit enable all
    state.manuallyUnchecked.clear();
    // Set flag to indicate enable all was used
    state.lastBulkAction = 'enable';

    if (state.searchTerm) {
        // When searching, only enable filtered keywords
        const filteredGroups = filterKeywordGroups();
        processBatchKeywords(Object.values(filteredGroups).flat(), keyword => {
            // First remove any existing case variations
            removeKeyword(keyword);
            // Then add with original case if not already active
            if (!isKeywordActive(keyword)) {
                state.activeKeywords.add(keyword);
            }
        });
    } else {
        // When not searching, enable all keywords from all categories
        const allCategories = [
            ...Object.keys(state.keywordGroups),
            ...Object.keys(state.displayConfig.combinedCategories || {})
        ];

        // Enable all contexts and drop exceptions -- "enable all" means all
        Object.keys(state.contextGroups).forEach(contextId => {
            state.selectedContexts.add(contextId);
        });
        state.selectedExceptions.clear();

        for (const category of allCategories) {
            const keywords = keywordCache.getKeywordsForCategory(category);
            processBatchKeywords(keywords, keyword => {
                // First remove any existing case variations
                removeKeyword(keyword);
                // Then add with original case if not already active
                if (!isKeywordActive(keyword)) {
                    state.activeKeywords.add(keyword);
                }
            });
        }
    }

    debouncedUpdate(() => {
        updateSimpleModeState();
        renderInterface();
        saveState();
    });
}

export function handleDisableAll() {
    // Clear manually unchecked since this is an explicit disable all
    state.manuallyUnchecked.clear();
    // Set flag to indicate disable all was used
    state.lastBulkAction = 'disable';

    if (state.searchTerm) {
        // When searching, only disable filtered keywords
        const filteredGroups = filterKeywordGroups();
        processBatchKeywords(Object.values(filteredGroups).flat(), keyword => {
            removeKeyword(keyword);
        });
    } else {
        // Clear all contexts first
        state.selectedContexts.clear();
        state.selectedExceptions.clear();

        // When not searching, disable all keywords
        state.activeKeywords.clear();
        keywordCache.clear();
    }

    debouncedUpdate(() => {
        updateSimpleModeState();
        renderInterface();
        saveState();
    });
}
