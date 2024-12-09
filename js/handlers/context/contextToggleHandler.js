import { renderInterface } from '../../renderer.js';
import { state, saveState } from '../../state.js';
import { cache } from './contextCache.js';
import {
    createDebouncedUpdate,
    notifyKeywordChanges
} from './contextUtils.js';

export async function handleContextToggle(contextId) {
    console.debug('[handleContextToggle] Starting toggle for context:', contextId);
    console.debug('[handleContextToggle] Initial state:', {
        isAuthenticated: state.authenticated,
        mode: state.mode,
        selectedContextsCount: state.selectedContexts.size,
        activeKeywordsCount: state.activeKeywords.size,
        manuallyUncheckedCount: state.manuallyUnchecked.size
    });

    if (!state.authenticated) {
        console.debug('[handleContextToggle] Not authenticated, returning');
        return;
    }

    const isSelected = state.selectedContexts.has(contextId);
    console.debug('[handleContextToggle] Context currently selected:', isSelected);

    const context = state.contextGroups[contextId];
    console.debug('[handleContextToggle] Context categories:', context?.categories);

    // Store currently unchecked keywords before context change
    const uncheckedKeywords = new Set(state.manuallyUnchecked);
    console.debug('[handleContextToggle] Stored unchecked keywords count:', uncheckedKeywords.size);

    if (isSelected) {
        console.debug('[handleContextToggle] Unchecking context');

        // 1. Update UI state first
        state.selectedContexts.delete(contextId);
        console.debug('[handleContextToggle] Removed context from selectedContexts');

        if (context?.categories) {
            context.categories.forEach(category => {
                state.selectedExceptions.delete(category);
                cache.invalidateCategory(category);
                console.debug('[handleContextToggle] Removed exception and invalidated cache for category:', category);
            });
        }

        // 2. Keep keywords in activeKeywords temporarily so getMuteUnmuteCounts works
        const keywordsToRemove = new Set();
        if (context?.categories) {
            for (const category of context.categories) {
                if (!state.selectedExceptions.has(category)) {
                    const keywords = cache.getKeywords(category, true);
                    console.debug(`[handleContextToggle] Found ${keywords.size} keywords in category:`, category);

                    for (const keyword of keywords) {
                        if (!uncheckedKeywords.has(keyword)) {
                            keywordsToRemove.add(keyword);
                            console.debug('[handleContextToggle] Marking keyword for removal:', keyword);
                        }
                    }
                }
            }
        }

        console.debug('[handleContextToggle] Total keywords marked for removal:', keywordsToRemove.size);
        console.debug('[handleContextToggle] Active keywords before removal:', state.activeKeywords.size);

        // 3. Now remove from activeKeywords after getMuteUnmuteCounts has run
        for (const keyword of keywordsToRemove) {
            state.activeKeywords.delete(keyword);
            console.debug('[handleContextToggle] Removed keyword from activeKeywords:', keyword);
        }

        console.debug('[handleContextToggle] Active keywords after removal:', state.activeKeywords.size);

    } else {
        console.debug('[handleContextToggle] Checking context');

        // 1. Update UI state
        state.selectedContexts.add(contextId);
        console.debug('[handleContextToggle] Added context to selectedContexts');

        if (context?.categories) {
            context.categories.forEach(category => {
                cache.invalidateCategory(category);
                console.debug('[handleContextToggle] Invalidated cache for category:', category);
            });
        }

        // 2. Add keywords to activeKeywords
        if (context?.categories) {
            for (const category of context.categories) {
                if (!state.selectedExceptions.has(category)) {
                    const keywords = cache.getKeywords(category, true);
                    console.debug(`[handleContextToggle] Found ${keywords.size} keywords in category:`, category);

                    for (const keyword of keywords) {
                        if (!uncheckedKeywords.has(keyword)) {
                            state.activeKeywords.add(keyword);
                            console.debug('[handleContextToggle] Added keyword to activeKeywords:', keyword);
                        }
                    }
                }
            }
        }

        console.debug('[handleContextToggle] Active keywords after additions:', state.activeKeywords.size);
    }

    // Notify of keyword changes to update mute button
    console.debug('[handleContextToggle] Notifying of keyword changes');
    notifyKeywordChanges();

    // Create a new debounced update for this call
    console.debug('[handleContextToggle] Creating debounced update');
    const debouncedUpdate = createDebouncedUpdate();
    await debouncedUpdate(async () => {
        console.debug('[handleContextToggle] Executing debounced update');
        console.debug('[handleContextToggle] Final state:', {
            selectedContextsCount: state.selectedContexts.size,
            activeKeywordsCount: state.activeKeywords.size,
            manuallyUncheckedCount: state.manuallyUnchecked.size
        });
        renderInterface();
        await saveState();
        console.debug('[handleContextToggle] Completed interface render and state save');
    });

    console.debug('[handleContextToggle] Toggle operation complete');
}
