import { state, saveState } from '../../state.js';
import { renderInterface } from '../../renderer.js';
import { createDebouncedUpdate } from './contextUtils.js';
import { syncDerivedContexts } from './selectionModel.js';

// Re-derive which context cards show as selected from the actual keyword
// state. Deliberately non-destructive: activeKeywords is the source of truth
// and is never cleared or rebuilt here -- the old clear-and-rebuild version
// silently destroyed advanced-mode partial selections on every mode switch.
export async function updateSimpleModeState() {
    if (!state.authenticated) return;

    syncDerivedContexts();

    const debouncedUpdate = createDebouncedUpdate();
    await debouncedUpdate(async () => {
        renderInterface();
        await saveState();
    });
}
