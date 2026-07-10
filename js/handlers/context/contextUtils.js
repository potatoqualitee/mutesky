import { state } from '../../state.js';

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

// Process keywords synchronously. This used to spread work across animation
// frames in chunks of 100, which let callers' follow-up steps run against a
// half-built keyword set (re-adding manually unchecked keywords, duplicating
// case variants). Set operations on a few thousand strings are sub-millisecond,
// so the chunking bought nothing and cost correctness.
export function processBatchKeywords(keywords, operation) {
    for (const keyword of keywords) {
        operation(keyword);
    }
}
