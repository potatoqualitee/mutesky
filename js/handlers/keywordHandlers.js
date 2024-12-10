import { state, saveState } from '../state.js';
import { getAllKeywordsForCategory, filterKeywordGroups } from '../categoryManager.js';
import { renderInterface } from '../renderer.js';
import { updateSimpleModeState } from './contextHandlers.js';

// Enhanced keyword cache with shorter timeout
const keywordCache = {
    categoryKeywords: new Map(),
    lastUpdate: 0,
    updateThreshold: 16, // Reduced to one frame to match state.js

    shouldUpdate() {
        const now = Date.now();
        if (now - this.lastUpdate < this.updateThreshold) return false;
        this.lastUpdate = now;
        return true;
    },

    getKeywordsForCategory(category) {
        if (!this.categoryKeywords.has(category) || this.shouldUpdate()) {
            this.categoryKeywords.set(category, new Set(getAllKeywordsForCategory(category)));
        }
        return this.categoryKeywords.get(category);
    },

    clear() {
        this.categoryKeywords.clear();
        this.lastUpdate = 0;
    }
};

// Debounced UI updates with frame timing
const debouncedUpdate = (() => {
    let timeout;
    let frameRequest;
    return (fn) => {
        if (timeout) clearTimeout(timeout);
        if (frameRequest) cancelAnimationFrame(frameRequest);

        timeout = setTimeout(() => {
            frameRequest = requestAnimationFrame(() => {
                fn();
                notifyKeywordChanges();
            });
        }, 16);
    };
})();

// Batch process keywords
function processBatchKeywords(keywords, operation) {
    const chunkSize = 100;
    const chunks = Array.from(keywords);

    let index = 0;
    function processChunk() {
        const chunk = chunks.slice(index, index + chunkSize);
        if (chunk.length === 0) {
            // Save state after all chunks are processed
            saveState();
            return;
        }

        chunk.forEach(operation);
        index += chunkSize;

        if (index < chunks.length) {
            requestAnimationFrame(processChunk);
        } else {
            // Save state after final chunk
            saveState();
        }
    }

    processChunk();
}

// Helper function to notify keyword changes
function notifyKeywordChanges() {
    document.dispatchEvent(new CustomEvent('keywordsUpdated', {
        detail: { count: state.activeKeywords.size }
    }));
}

// Optimized checkbox update with proper CSS escaping
function updateCheckboxes(category, enabled) {
    requestAnimationFrame(() => {
        const escapedCategory = CSS.escape(category.replace(/\s+/g, '-').toLowerCase());
        // Use more specific selectors for better performance
        const sidebarCheckbox = document.querySelector(`.category-item[data-category="${CSS.escape(category)}"] > input[type="checkbox"]`);
        const mainCheckbox = document.querySelector(`#category-${escapedCategory} > input[type="checkbox"]`);
        const keywordCheckboxes = document.querySelectorAll(`#category-${escapedCategory} .keywords-container input[type="checkbox"]`);

        if (sidebarCheckbox) {
            sidebarCheckbox.checked = enabled;
            sidebarCheckbox.indeterminate = false;
        }
        if (mainCheckbox) {
            mainCheckbox.checked = enabled;
            mainCheckbox.indeterminate = false;
        }
        keywordCheckboxes.forEach(checkbox => {
            checkbox.checked = enabled;
        });
    });
}

// Helper to check if keyword is active (case-insensitive)
export function isKeywordActive(keyword) {
    const lowerKeyword = keyword.toLowerCase();
    for (const activeKeyword of state.activeKeywords) {
        if (activeKeyword.toLowerCase() === lowerKeyword) {
            return true;
        }
    }
    return false;
}

// Helper to remove keyword (case-insensitive)
export function removeKeyword(keyword) {
    const lowerKeyword = keyword.toLowerCase();
    for (const activeKeyword of state.activeKeywords) {
        if (activeKeyword.toLowerCase() === lowerKeyword) {
            state.activeKeywords.delete(activeKeyword);
            break;
        }
    }
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

        // Enable all contexts first
        Object.keys(state.contextGroups).forEach(contextId => {
            state.selectedContexts.add(contextId);
        });

        let processedCount = 0;
        function processNextCategory() {
            if (processedCount >= allCategories.length) {
                debouncedUpdate(() => {
                    updateSimpleModeState();
                    renderInterface();
                    saveState();
                });
                return;
            }

            const category = allCategories[processedCount++];
            const keywords = keywordCache.getKeywordsForCategory(category);
            processBatchKeywords(keywords, keyword => {
                // First remove any existing case variations
                removeKeyword(keyword);
                // Then add with original case if not already active
                if (!isKeywordActive(keyword)) {
                    state.activeKeywords.add(keyword);
                }
            });

            requestAnimationFrame(processNextCategory);
        }

        processNextCategory();
        return; // Early return since updates are handled in processNextCategory
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
