import { state } from '../../state.js';
import { removeKeyword } from '../keywordHandlers.js';

// Helper function to add keyword with case handling
export function addKeywordWithCase(keyword) {
    // First remove any existing case variations
    removeKeyword(keyword);
    // Then add with original case
    state.activeKeywords.add(keyword);
}
