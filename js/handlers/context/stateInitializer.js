import { state, saveState, loadState } from '../../state.js';
import { renderInterface } from '../../renderer.js';
import { cache } from './contextCache.js';
import { createDebouncedUpdate } from './contextUtils.js';
import { syncDerivedContexts } from './selectionModel.js';

// Restore persisted selections for the current user and re-derive the
// simple-mode view from them. Keywords are restored exactly as saved --
// context selection is derived from keywords, never the other way around.
export async function initializeState() {
    if (!state.authenticated) return;

    loadState();
    cache.clear();
    syncDerivedContexts();

    const debouncedUpdate = createDebouncedUpdate();
    await debouncedUpdate(async () => {
        renderInterface();
        await saveState();
    });
}
