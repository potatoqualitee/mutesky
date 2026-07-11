import { renderInterface } from '../../renderer.js';
import { state, saveState } from '../../state.js';
import { cache } from './contextCache.js';
import {
    createDebouncedUpdate,
    notifyKeywordChanges
} from './contextUtils.js';
import {
    getContextCategories,
    getContextSelectionState,
    activateCategory,
    deactivateCategory,
    keywordsClaimedBySelection,
    syncDerivedContexts
} from './selectionModel.js';

export async function handleContextToggle(contextId) {
    console.debug('[handleContextToggle] Toggle for context:', contextId, {
        mode: state.mode,
        activeKeywords: state.activeKeywords.size
    });

    if (!state.authenticated) return;

    const categories = getContextCategories(contextId);

    // A context card acts on its full topic: anything but fully-selected
    // selects the whole context; fully-selected deselects it. This keeps a
    // partially-selected card's next click predictable.
    const isFullySelected = getContextSelectionState(contextId) === 'all'
        && state.selectedContexts.has(contextId);

    if (isFullySelected) {
        state.followedContexts.delete(contextId);
        state.selectedContexts.delete(contextId);

        // Categories any OTHER selected context claims (even excepted ones):
        // their keywords and exception status belong to the sibling now
        const claimedElsewhere = new Set();
        const otherContexts = new Set([
            ...state.selectedContexts,
            ...state.followedContexts
        ]);
        for (const otherId of otherContexts) {
            for (const other of getContextCategories(otherId)) claimedElsewhere.add(other);
        }

        // Individual keyword strings can appear in several categories, so also
        // spare any keyword the remaining selection still claims
        const protect = keywordsClaimedBySelection();
        for (const category of categories) {
            if (!claimedElsewhere.has(category)) {
                state.selectedExceptions.delete(category);
                deactivateCategory(category, { protect, recordUnchecked: true });
            }
            cache.invalidateCategory(category);
        }
    } else {
        state.followedContexts.add(contextId);
        state.selectedContexts.add(contextId);

        // Selecting a whole context is explicit intent: activate everything at
        // the current filter level and clear sticky individual opt-outs so the
        // card doesn't immediately snap back to partial
        for (const category of categories) {
            if (!state.selectedExceptions.has(category)) {
                activateCategory(category, { clearUnchecked: true });
            }
            cache.invalidateCategory(category);
        }
    }

    syncDerivedContexts();
    notifyKeywordChanges();

    const debouncedUpdate = createDebouncedUpdate();
    await debouncedUpdate(async () => {
        renderInterface();
        await saveState();
    });
}
