import { state, canUnmuteKeyword, getMuteUnmuteCounts, saveState } from '../state.js';
import { blueskyService } from '../bluesky.js';
import { renderInterface } from '../renderer.js';
import { showNotification } from '../utils/notifications.js';

// Enhanced keyword cache for mute operations
const muteCache = {
    ourKeywordsMap: null,
    lastUpdate: 0,
    updateThreshold: 50,

    shouldUpdate() {
        const now = Date.now();
        if (now - this.lastUpdate < this.updateThreshold) return false;
        this.lastUpdate = now;
        return true;
    },

    getOurKeywordsMap() {
        if (this.ourKeywordsMap && !this.shouldUpdate()) {
            console.debug('[muteCache] Returning cached keyword map');
            return this.ourKeywordsMap;
        }

        console.debug('[muteCache] Building new keyword map');
        const map = new Map();
        Object.entries(state.keywordGroups).forEach(([category, categoryData]) => {
            const categoryInfo = categoryData[category];
            if (categoryInfo?.keywords) {
                Object.keys(categoryInfo.keywords).forEach(keyword => {
                    map.set(keyword.toLowerCase(), keyword);
                });
            }
        });
        this.ourKeywordsMap = map;
        console.debug('[muteCache] New keyword map size:', map.size);
        return map;
    },

    clear() {
        console.debug('[muteCache] Clearing cache');
        this.ourKeywordsMap = null;
        this.lastUpdate = 0;
    }
};

// Debounced UI updates with frame timing
const debouncedUpdate = (() => {
    let timeout;
    let frameRequest;
    return (fn) => {
        if (timeout) clearTimeout(timeout);
        if (frameRequest) cancelAnimationFrame(frameRequest);

        timeout = setTimeout(() => {
            frameRequest = requestAnimationFrame(() => {
                console.debug('[debouncedUpdate] Executing update');
                fn();
            });
        }, 16);
    };
})();

// Process all keywords immediately without batching
function processKeywords(keywords, operation) {
    console.debug('[processKeywords] Processing', keywords.length, 'keywords');
    keywords.forEach(operation);
    console.debug('[processKeywords] Finished processing all keywords');
}

export async function handleMuteSubmit() {
    try {
        console.debug('[handleMuteSubmit] Starting mute operation');

        // Get selected keywords efficiently
        const selectedKeywords = Array.from(state.activeKeywords);
        console.debug('[handleMuteSubmit] Selected keywords:', selectedKeywords.length);

        // Use cached keyword map
        const ourKeywordsMap = muteCache.getOurKeywordsMap();
        const ourKeywords = new Set(Array.from(ourKeywordsMap.keys()));
        console.debug('[handleMuteSubmit] Our keywords total:', ourKeywords.size);

        // Get the counts before update
        const { toMute, toUnmute } = getMuteUnmuteCounts();
        console.debug('[handleMuteSubmit] To mute:', toMute, 'To unmute:', toUnmute);

        // Update muted keywords
        console.debug('[handleMuteSubmit] Updating keywords on Bluesky');
        await blueskyService.mute.updateMutedKeywords(selectedKeywords, Array.from(ourKeywords));
        console.debug('[handleMuteSubmit] Bluesky update complete');

        // If this mute/unmute follows an enable/disable all action, clear exceptions
        if (state.lastBulkAction) {
            console.debug('[handleMuteSubmit] Clearing exceptions after bulk action');
            state.selectedExceptions.clear();
            state.lastBulkAction = null; // Reset the flag
        }

        // Clear all caches and update counts
        console.debug('[handleMuteSubmit] Clearing caches');
        muteCache.clear();
        console.debug('[handleMuteSubmit] Updating mute count in BlueskyService');
        await blueskyService.updateMuteCount();

        // Get fresh muted keywords from Bluesky
        console.debug('[handleMuteSubmit] Reinitializing keyword state');
        await initializeKeywordState();

        // Save state after successful mute/unmute
        console.debug('[handleMuteSubmit] Saving state');
        await saveState();

        // Update UI with debouncing
        console.debug('[handleMuteSubmit] Scheduling UI update');
        debouncedUpdate(async () => {
            console.debug('[handleMuteSubmit] Rendering interface');
            renderInterface();

            // Show appropriate notification
            if (toMute > 0 && toUnmute > 0) {
                showNotification(`Successfully muted ${toMute} and unmuted ${toUnmute} keywords`);
            } else if (toMute > 0) {
                showNotification(`Successfully muted ${toMute} ${toMute === 1 ? 'keyword' : 'keywords'}`);
            } else if (toUnmute > 0) {
                showNotification(`Successfully unmuted ${toUnmute} ${toUnmute === 1 ? 'keyword' : 'keywords'}`);
            }
            console.debug('[handleMuteSubmit] UI update complete');
        });
    } catch (error) {
        console.error('[handleMuteSubmit] Failed to process mutes:', error);

        // Convert technical errors into user-friendly messages
        let userMessage = 'Failed to update mutes. ';
        if (error.message.includes('not logged in')) {
            userMessage += 'Please log in and try again.';
        } else if (error.message.includes('401')) {
            userMessage += 'Your session has expired. Please log in again.';
        } else if (error.message.includes('429')) {
            userMessage += 'Too many requests. Please wait a moment and try again.';
        } else if (error.message.includes('503')) {
            userMessage += 'Bluesky service is temporarily unavailable. Please try again later.';
        } else {
            userMessage += error.message;
        }

        showNotification(userMessage, 'error');
    }
}

export async function initializeKeywordState() {
    try {
        console.debug('[initializeKeywordState] Starting initialization');

        // Get user's muted keywords from Bluesky with force refresh
        const userKeywords = await blueskyService.mute.getMutedKeywords(true);
        console.debug('[initializeKeywordState] Fetched', userKeywords.length, 'keywords from Bluesky');

        // Only clear mute tracking state, leave contexts alone
        console.debug('[initializeKeywordState] Clearing state');
        const beforeOriginal = state.originalMutedKeywords.size;
        const beforeSession = state.sessionMutedKeywords.size;
        state.originalMutedKeywords.clear();
        state.sessionMutedKeywords.clear();
        console.debug('[initializeKeywordState] Cleared originalMutedKeywords (was:', beforeOriginal, ') and sessionMutedKeywords (was:', beforeSession, ')');

        // Track which keywords are muted in Bluesky
        console.debug('[initializeKeywordState] Processing user keywords');
        processKeywords(userKeywords, keyword => {
            const lowerKeyword = keyword.toLowerCase();
            state.originalMutedKeywords.add(lowerKeyword);
        });
        console.debug('[initializeKeywordState] Final originalMutedKeywords size:', state.originalMutedKeywords.size);

    } catch (error) {
        console.error('[initializeKeywordState] Failed to initialize keyword state:', error);
        showNotification('Failed to load your muted keywords. Please refresh the page.', 'error');
    }
}

// Helper to update button text
export function getButtonText() {
    const { toMute, toUnmute } = getMuteUnmuteCounts();
    console.debug('[getButtonText] To mute:', toMute, 'To unmute:', toUnmute);
    const parts = [];

    if (toMute > 0) {
        parts.push(`Mute ${toMute} new`);
    }
    if (toUnmute > 0) {
        parts.push(`Unmute ${toUnmute} existing`);
    }

    const text = parts.length > 0 ? parts.join(', ') : 'No changes';
    console.debug('[getButtonText] Button text:', text);
    return text;
}
