import { state, saveState } from '../../state.js';
import { debouncedUpdate, updateCheckboxes } from './ui-utils.js';
import { keywordCache } from './cache.js';
import { removeKeyword, isKeywordActive, processBatchKeywords } from './keyword-utils.js';
import { updateSimpleModeState } from '../contextHandlers.js';
import { renderInterface } from '../../renderer.js';

export function handleKeywordToggle(keyword, enabled) {
    if (enabled) {
        // If manually checking, remove from unchecked list
        state.manuallyUnchecked.delete(keyword);
        // First remove any existing case variations
        removeKeyword(keyword);
        // Then add with original case
        state.activeKeywords.add(keyword);
    } else {
        // If manually unchecking, add to unchecked list
        state.manuallyUnchecked.add(keyword);
        removeKeyword(keyword);
    }

    debouncedUpdate(() => {
        updateSimpleModeState();
        renderInterface();
        saveState();
    });
}

export function handleCategoryToggle(category, currentState) {
    const keywords = keywordCache.getKeywordsForCategory(category);
    const shouldEnable = currentState !== 'all';

    processBatchKeywords(keywords, keyword => {
        if (shouldEnable) {
            // If enabling category, remove keywords from unchecked list
            state.manuallyUnchecked.delete(keyword);
            // First remove any existing case variations
            removeKeyword(keyword);
            // Then add with original case if not already active
            if (!isKeywordActive(keyword)) {
                state.activeKeywords.add(keyword);
            }
        } else {
            // If disabling category, add keywords to unchecked list
            state.manuallyUnchecked.add(keyword);
            removeKeyword(keyword);
        }
    });

    updateCheckboxes(category, shouldEnable);

    debouncedUpdate(() => {
        updateSimpleModeState();
        renderInterface();
        saveState();
    });
}
