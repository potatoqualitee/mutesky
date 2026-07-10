import { state, saveState } from '../../state.js';
import { debouncedUpdate } from './ui-utils.js';
import { keywordCache } from './cache.js';
import { removeKeyword, isKeywordActive, processBatchKeywords } from './keyword-utils.js';
import { updateSimpleModeState } from '../contextHandlers.js';
import { renderInterface } from '../../renderer.js';
import { renderCategorySections, renderCategoryList } from '../../renderers/categoryRenderer.js';
import { updateStatusCounts, updateMuteButton, updateEnableDisableButtons } from '../../renderers/uiRenderer.js';
import { categoriesContainingKeyword } from '../../categoryManager.js';

// Grid sections touched since the last flush. debouncedUpdate cancels and
// replaces its pending callback on every call, so toggles that coalesce into
// one flush must accumulate their categories here, not in a closure — a
// closure would render only the LAST toggle's section and leave the earlier
// ones with stale counts and tri-state headers.
const pendingSections = new Set();

// Scoped counterpart of the old full renderInterface() flush: rebuild only
// the touched grid sections plus everything cheap (sidebar, counts, buttons).
// Toggles can also arrive with the grid not rendered (e.g. My Keywords modal
// in simple mode) — renderCategorySections handles that by doing nothing for
// grid content, and the simple-mode context cards don't reflect individual
// keyword state, so the count/button updates cover what's visible.
function flushToggleUpdate() {
    updateSimpleModeState();
    if (state.mode === 'advanced') {
        renderCategorySections(pendingSections);
        renderCategoryList();
        updateStatusCounts();
        updateMuteButton();
        updateEnableDisableButtons();
    } else {
        renderInterface();
    }
    pendingSections.clear();
    saveState();
}

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

    // The keyword can appear in several categories; all their sections show it
    categoriesContainingKeyword(keyword).forEach(category => pendingSections.add(category));

    debouncedUpdate(flushToggleUpdate);
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

        // Every section showing this keyword must refresh: that covers the
        // toggled category itself, the source sections behind a combined
        // sidebar row, and duplicate-keyword sections in other categories
        categoriesContainingKeyword(keyword).forEach(c => pendingSections.add(c));
    });

    debouncedUpdate(flushToggleUpdate);
}
