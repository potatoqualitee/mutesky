import { renderInterface } from '../../renderer.js';
import { state, saveState } from '../../state.js';
import { cache } from './contextCache.js';
import {
    activateContextKeywords,
    createDebouncedUpdate,
    notifyKeywordChanges
} from './contextUtils.js';

export async function handleExceptionToggle(category) {
    console.debug('[handleExceptionToggle] Starting toggle for category:', category);
    if (!state.authenticated) return;

    // Store currently unchecked keywords before exception change
    const uncheckedKeywords = new Set(state.manuallyUnchecked);

    const wasException = state.selectedExceptions.has(category);
    console.debug('[handleExceptionToggle] Was exception:', wasException);

    if (wasException) {
        state.selectedExceptions.delete(category);
        console.debug('[handleExceptionToggle] Removed exception');
    } else {
        state.selectedExceptions.add(category);
        console.debug('[handleExceptionToggle] Added exception');

        // Check if any keywords in this category are currently muted
        if (state.mode === 'simple') {
            const categoryKeywords = cache.getKeywords(category, true);
            for (const keyword of categoryKeywords) {
                if (state.originalMutedKeywords.has(keyword)) {
                    state.activeKeywords.delete(keyword);
                }
            }
            // Notify immediately of keyword changes to update mute button
            notifyKeywordChanges();
        }
    }

    cache.invalidateCategory(category);
    console.debug('[handleExceptionToggle] Invalidated category cache');

    // Only rebuild keywords in simple mode
    if (state.mode === 'simple') {
        console.debug('[handleExceptionToggle] Rebuilding keywords in simple mode');

        // Clear and rebuild active keywords
        state.activeKeywords.clear();
        for (const contextId of state.selectedContexts) {
            activateContextKeywords(contextId, cache);
        }

        // Add only original muted keywords that aren't in excepted categories
        for (const keyword of state.originalMutedKeywords) {
            if (!state.activeKeywords.has(keyword)) {
                let isExcepted = false;
                for (const exceptedCategory of state.selectedExceptions) {
                    const exceptedKeywords = cache.getKeywords(exceptedCategory, true);
                    if (exceptedKeywords.has(keyword)) {
                        isExcepted = true;
                        break;
                    }
                }
                if (!isExcepted) {
                    state.activeKeywords.add(keyword);
                }
            }
        }

        // Re-apply unchecked status
        for (const keyword of uncheckedKeywords) {
            state.activeKeywords.delete(keyword);
            state.manuallyUnchecked.add(keyword);
        }

        console.debug('[handleExceptionToggle] Keyword counts after rebuild:', {
            activeKeywords: state.activeKeywords.size,
            manuallyUnchecked: state.manuallyUnchecked.size
        });
    }

    // Create a new debounced update for this call
    console.debug('[handleExceptionToggle] Creating debounced update');
    const debouncedUpdate = createDebouncedUpdate();
    await debouncedUpdate(async () => {
        console.debug('[handleExceptionToggle] Executing debounced update');
        renderInterface();
        await saveState();
        console.debug('[handleExceptionToggle] Completed interface render and state save');
    });
}
