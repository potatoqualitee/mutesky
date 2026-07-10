import { state, saveState } from '../../state.js';
import { updateSimpleModeState } from '../contextHandlers.js';
import { renderInterface } from '../../renderer.js';

// Debounced UI updates with frame timing
export const debouncedUpdate = (() => {
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

// Helper function to notify keyword changes
export function notifyKeywordChanges() {
    document.dispatchEvent(new CustomEvent('keywordsUpdated', {
        detail: { count: state.activeKeywords.size }
    }));
}

// Standard update function used by handlers
export function standardUpdate() {
    updateSimpleModeState();
    renderInterface();
    saveState();
}
