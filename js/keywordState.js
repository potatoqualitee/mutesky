import { state } from './state.js';
import { keywordCache } from './stateCache.js';

// Helper to get all keywords from our list with their original case
export function getKeywordsWithCase() {
    const keywordMap = new Map();
    Object.entries(state.keywordGroups).forEach(([category, categoryData]) => {
        const categoryInfo = categoryData[category];
        if (categoryInfo?.keywords) {
            Object.keys(categoryInfo.keywords).forEach(keyword => {
                keywordMap.set(keyword.toLowerCase(), keyword);
            });
        }
    });
    return keywordMap;
}

// Helper to get all keywords from our list
export function getOurKeywords() {
    // Return cached version if valid
    if (keywordCache.ourKeywords && !keywordCache.shouldUpdate()) {
        return keywordCache.ourKeywords;
    }

    const ourKeywords = new Set();
    Object.entries(state.keywordGroups).forEach(([category, categoryData]) => {
        // Get the category info which contains the keywords
        const categoryInfo = categoryData[category];
        if (categoryInfo?.keywords) {
            // Add each keyword to our set
            Object.keys(categoryInfo.keywords).forEach(keyword => {
                ourKeywords.add(keyword.toLowerCase());
            });
        }
    });

    // Cache the result
    keywordCache.ourKeywords = ourKeywords;
    return ourKeywords;
}

// Helper to determine if a keyword can be unmuted
export function canUnmuteKeyword(keyword) {
    // Only allow unmuting if:
    // 1. It's in our list of keywords (case-insensitive)
    // 2. It was previously muted (either originally or this session)
    const ourKeywords = getOurKeywords();
    const lowerKeyword = keyword.toLowerCase();
    return ourKeywords.has(lowerKeyword) &&
           (state.originalMutedKeywords.has(lowerKeyword) || state.sessionMutedKeywords.has(lowerKeyword));
}

// Optimized helper to get mute/unmute counts
export function getMuteUnmuteCounts() {
    const ourKeywords = getOurKeywords();
    let toMute = 0;
    let toUnmute = 0;

    // Create lowercase lookup Set for active keywords
    const activeLowerKeywords = new Set();
    for (const keyword of state.activeKeywords) {
        activeLowerKeywords.add(keyword.toLowerCase());
    }

    // Create lowercase lookup Set for originally muted keywords
    const originalLowerKeywords = new Set();
    for (const keyword of state.originalMutedKeywords) {
        originalLowerKeywords.add(keyword.toLowerCase());
    }

    // Only count keywords from our list
    for (const keyword of ourKeywords) {
        const isActive = activeLowerKeywords.has(keyword);
        const wasOriginallyMuted = originalLowerKeywords.has(keyword);

        if (isActive && !wasOriginallyMuted) {
            // New keyword to mute
            toMute++;
        } else if (!isActive && wasOriginallyMuted) {
            // Existing keyword to unmute
            toUnmute++;
        }
    }

    return { toMute, toUnmute };
}
