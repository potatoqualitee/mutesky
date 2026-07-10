import { state } from '../../state.js';
import { syncDerivedContexts } from './selectionModel.js';

// Re-derive which context cards show as selected from the actual keyword
// state. Deliberately non-destructive: activeKeywords is the source of truth
// and is never cleared or rebuilt here -- the old clear-and-rebuild version
// silently destroyed advanced-mode partial selections on every mode switch.
//
// Sync-only: every caller follows up with its own render and save, so the
// debounced renderInterface/saveState this used to schedule was a hidden
// second full-grid rebuild behind every toggle, bulk action, and mode switch.
export function updateSimpleModeState() {
    if (!state.authenticated) return;
    syncDerivedContexts();
}
