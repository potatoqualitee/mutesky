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

// Batch process keywords
export function processBatchKeywords(keywords, operation) {
    const chunkSize = 100;
    const chunks = Array.from(keywords);

    let index = 0;
    function processChunk() {
        const chunk = chunks.slice(index, index + chunkSize);
        if (chunk.length === 0) {
            // Save state after all chunks are processed
            saveState();
            return;
        }

        chunk.forEach(operation);
        index += chunkSize;

        if (index < chunks.length) {
            requestAnimationFrame(processChunk);
        } else {
            // Save state after final chunk
            saveState();
        }
    }

    processChunk();
}
