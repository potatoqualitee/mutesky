import { state, saveState } from '../../state.js';

// Helper to check if keyword is active (case-insensitive)
export function isKeywordActive(keyword) {
    const lowerKeyword = keyword.toLowerCase();
    for (const activeKeyword of state.activeKeywords) {
        if (activeKeyword.toLowerCase() === lowerKeyword) {
            return true;
        }
    }
    return false;
}

// Helper to remove keyword (case-insensitive)
export function removeKeyword(keyword) {
    const lowerKeyword = keyword.toLowerCase();
    for (const activeKeyword of state.activeKeywords) {
        if (activeKeyword.toLowerCase() === lowerKeyword) {
            state.activeKeywords.delete(activeKeyword);
            break;
        }
    }
}

// Process keywords synchronously, then persist. Chunking across animation
// frames caused races: callers continued before all keywords were processed.
export function processBatchKeywords(keywords, operation) {
    for (const keyword of keywords) {
        operation(keyword);
    }
    saveState();
}
