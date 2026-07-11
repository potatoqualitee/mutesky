import { state, saveState } from '../../state.js';
import { filterKeywordGroups } from '../../categoryManager.js';
import { debouncedUpdate } from './ui-utils.js';
import { keywordCache } from './cache.js';
import { removeKeyword, isKeywordActive, processBatchKeywords } from './keyword-utils.js';
import { updateSimpleModeState } from '../contextHandlers.js';
import { renderInterface } from '../../renderer.js';
import { clearManuallyUnchecked } from '../context/selectionModel.js';

export function handleEnableAll() {
    // Search-scoped actions must not erase unrelated sticky opt-outs.
    if (!state.searchTerm) state.manuallyUnchecked.clear();
    state.lastBulkAction = state.searchTerm ? null : 'enable';

    if (state.searchTerm) {
        // When searching, only enable filtered keywords
        const filteredGroups = filterKeywordGroups();
        processBatchKeywords(Object.values(filteredGroups).flat(), keyword => {
            clearManuallyUnchecked(keyword);
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
            state.followedContexts.add(contextId);
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
    // Search-scoped actions preserve unrelated opt-outs and record their own.
    if (!state.searchTerm) state.manuallyUnchecked.clear();
    state.lastBulkAction = state.searchTerm ? null : 'disable';

    if (state.searchTerm) {
        // When searching, only disable filtered keywords
        const filteredGroups = filterKeywordGroups();
        processBatchKeywords(Object.values(filteredGroups).flat(), keyword => {
            clearManuallyUnchecked(keyword);
            state.manuallyUnchecked.add(keyword);
            removeKeyword(keyword);
        });
    } else {
        // Clear all contexts first
        state.selectedContexts.clear();
        state.followedContexts.clear();
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
