import { state } from '../../state.js';
import { isKeywordActive, removeKeyword } from '../keywordHandlers.js';

// Helper function to notify keyword changes
export function notifyKeywordChanges() {
    document.dispatchEvent(new CustomEvent('keywordsUpdated', {
        detail: { count: state.activeKeywords.size }
    }));
}

// Enhanced debounced UI updates with frame timing
export const createDebouncedUpdate = () => {
    let timeout;
    let frameRequest;
    return async (fn) => {
        if (timeout) clearTimeout(timeout);
        if (frameRequest) cancelAnimationFrame(frameRequest);

        timeout = setTimeout(() => {
            frameRequest = requestAnimationFrame(async () => {
                await fn();
                notifyKeywordChanges();
            });
        }, 16);
    };
};

// Batch process keywords
export function processBatchKeywords(keywords, operation) {
    const chunkSize = 100;
    const chunks = Array.from(keywords);

    let index = 0;
    function processChunk() {
        const chunk = chunks.slice(index, index + chunkSize);
        if (chunk.length === 0) return;

        chunk.forEach(operation);
        index += chunkSize;

        if (index < chunks.length) {
            requestAnimationFrame(processChunk);
        }
    }

    processChunk();
}

// Helper function to add keyword with case handling
function addKeywordWithCase(keyword) {
    // First remove any existing case variations
    removeKeyword(keyword);
    // Then add with original case
    state.activeKeywords.add(keyword);
}

// Helper function to activate context keywords
export function activateContextKeywords(contextId, cache) {
    const context = state.contextGroups[contextId];
    if (!context?.categories) return;

    for (const category of context.categories) {
        if (state.selectedExceptions.has(category)) continue;
        // Get keywords considering filter level (sortByWeight = true)
        const keywords = cache.getKeywords(category, true);
        processBatchKeywords(keywords, keyword => {
            // Only activate if not manually unchecked
            if (!state.manuallyUnchecked.has(keyword)) {
                addKeywordWithCase(keyword);
            }
        });
    }
}

// Helper function to rebuild active keywords
export function rebuildActiveKeywords(cache) {
    // Only rebuild keywords in simple mode
    if (state.mode === 'simple') {
        // Store currently unchecked keywords
        const uncheckedKeywords = new Set(state.manuallyUnchecked);

        // Clear and rebuild active keywords
        state.activeKeywords.clear();
        for (const contextId of state.selectedContexts) {
            activateContextKeywords(contextId, cache);
        }

        // Add only original muted keywords that aren't already active and weren't manually unchecked
        for (const keyword of state.originalMutedKeywords) {
            if (!isKeywordActive(keyword) && !state.manuallyUnchecked.has(keyword)) {
                addKeywordWithCase(keyword);
            }
        }

        // Re-apply unchecked status
        for (const keyword of uncheckedKeywords) {
            removeKeyword(keyword);
            state.manuallyUnchecked.add(keyword);
        }
    }
}
