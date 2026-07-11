import { renderInterface } from '../../renderer.js';
import { state, saveState } from '../../state.js';
import { cache } from './contextCache.js';
import {
    createDebouncedUpdate,
    notifyKeywordChanges
} from './contextUtils.js';
import {
    getContextCategories,
    activateCategory,
    deactivateCategory,
    keywordsClaimedBySelection,
    syncDerivedContexts
} from './selectionModel.js';

export async function handleExceptionToggle(category) {
    console.debug('[handleExceptionToggle] Toggle for category:', category);
    if (!state.authenticated) return;

    const wasException = state.selectedExceptions.has(category);

    if (wasException) {
        // Re-including a topic the user had excepted: activate it if any
        // selected context claims it. Explicit intent clears sticky opt-outs.
        state.selectedExceptions.delete(category);
        const claimingContexts = new Set([
            ...state.selectedContexts,
            ...state.followedContexts
        ]);
        const claimed = Array.from(claimingContexts).some(contextId =>
            getContextCategories(contextId).includes(category)
        );
        if (claimed) {
            activateCategory(category, { clearUnchecked: true });
        }
    } else {
        // Excepting a topic: deactivate exactly that category's keywords,
        // sparing any keyword other claimed categories share. No wholesale
        // rebuild -- other selections stay untouched.
        state.selectedExceptions.add(category);
        deactivateCategory(category, { protect: keywordsClaimedBySelection() });
    }

    cache.invalidateCategory(category);
    syncDerivedContexts();
    notifyKeywordChanges();

    const debouncedUpdate = createDebouncedUpdate();
    await debouncedUpdate(async () => {
        renderInterface();
        await saveState();
    });
}
