import { state, saveState } from '../../state.js';
import { renderInterface } from '../../renderer.js';
import { cache } from './contextCache.js';
import { isKeywordActive, removeKeyword } from '../keywordHandlers.js';
import {
    createDebouncedUpdate,
    activateContextKeywords
} from './contextUtils.js';
import { addKeywordWithCase } from './keywordManager.js';

export async function updateSimpleModeState() {
    if (!state.authenticated) return;

    // Store currently unchecked keywords
    const uncheckedKeywords = new Set(state.manuallyUnchecked);

    if (state.mode === 'simple') {
        // First derive context selections from advanced mode state
        for (const contextId in state.contextGroups) {
            const context = state.contextGroups[contextId];
            if (!context?.categories) continue;

            // Check if all non-excepted categories in this context are fully selected
            let allCategoriesActive = true;
            for (const category of context.categories) {
                if (state.selectedExceptions.has(category)) continue;

                // Get keywords considering filter level
                const keywords = cache.getKeywords(category, true);
                let allActive = true;

                // Check if all keywords at current filter level are active
                for (const keyword of keywords) {
                    if (!isKeywordActive(keyword)) {
                        allActive = false;
                        break;
                    }
                }

                if (!allActive) {
                    allCategoriesActive = false;
                    break;
                }
            }

            // Update context selection based on category states
            if (allCategoriesActive) {
                state.selectedContexts.add(contextId);
            } else {
                state.selectedContexts.delete(contextId);
            }
        }

        // Then check if any selected contexts should be deselected
        for (const contextId of Array.from(state.selectedContexts)) {
            const contextState = cache.getContextState(contextId);
            if (contextState === 'none') {
                state.selectedContexts.delete(contextId);
            }
        }

        cache.clear();

        // Clear and rebuild active keywords from derived contexts
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

    // Create a new debounced update for this call with state
    const debouncedUpdate = createDebouncedUpdate();
    await debouncedUpdate(async () => {
        renderInterface();
        await saveState();
    });
}
