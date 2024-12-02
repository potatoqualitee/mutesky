import { state, canUnmuteKeyword, getMuteUnmuteCounts } from '../state.js';
import { blueskyService } from '../bluesky.js';
import { renderInterface } from '../renderer.js';
import { showNotification } from '../utils/notifications.js';

export async function handleMuteSubmit() {
    try {
        // Get selected keywords from UI
        const selectedKeywords = Array.from(state.activeKeywords);
        console.debug('Selected keywords from UI:', selectedKeywords);
        console.log('Total selected keywords:', selectedKeywords.length);

        // Create efficient lookup Set for our keywords
        const ourKeywords = new Set();
        Object.entries(state.keywordGroups).forEach(([category, categoryData]) => {
            const categoryInfo = categoryData[category];
            if (categoryInfo?.keywords) {
                Object.keys(categoryInfo.keywords).forEach(keyword => {
                    ourKeywords.add(keyword.toLowerCase());
                });
            }
        });
        console.debug('Our managed keywords list:', Array.from(ourKeywords));

        // Get the counts before update
        const { toMute, toUnmute } = getMuteUnmuteCounts();

        // Update muted keywords
        // This will preserve user's custom keywords and only manage our keywords
        await blueskyService.mute.updateMutedKeywords(selectedKeywords, Array.from(ourKeywords));

        console.log('Mute update completed, refreshing state...');

        // Re-initialize keyword state to get fresh data
        await initializeKeywordState();

        // Re-render interface with fresh data
        renderInterface();

        // Update the mute count in the UI directly
        const handleEl = document.getElementById('bsky-handle');
        if (handleEl) {
            const userKeywords = await blueskyService.mute.getMutedKeywords();
            const profile = handleEl.textContent.split(' - ')[0]; // Preserve the handle part
            handleEl.textContent = `${profile} - ${userKeywords.length} mutes`;
        }

        console.log('State refresh completed');

        // Show appropriate notification based on the action
        if (toMute > 0 && toUnmute > 0) {
            showNotification(`Successfully muted ${toMute} and unmuted ${toUnmute} keywords`);
        } else if (toMute > 0) {
            showNotification(`Successfully muted ${toMute} ${toMute === 1 ? 'keyword' : 'keywords'}`);
        } else if (toUnmute > 0) {
            showNotification(`Successfully unmuted ${toUnmute} ${toUnmute === 1 ? 'keyword' : 'keywords'}`);
        }
    } catch (error) {
        console.error('Failed to process mutes:', error);

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
        // Get user's muted keywords from Bluesky
        const userKeywords = await blueskyService.mute.getMutedKeywords();
        console.debug('Retrieved user keywords from Bluesky:', userKeywords);
        console.log('Total user keywords:', userKeywords.length);

        // Create efficient lookup structures
        const ourKeywordsMap = new Map();
        Object.entries(state.keywordGroups).forEach(([category, categoryData]) => {
            const categoryInfo = categoryData[category];
            if (categoryInfo?.keywords) {
                Object.keys(categoryInfo.keywords).forEach(keyword => {
                    ourKeywordsMap.set(keyword.toLowerCase(), keyword);
                });
            }
        });

        // Clear existing states
        state.activeKeywords.clear();
        state.originalMutedKeywords.clear();
        state.sessionMutedKeywords.clear();

        // Store all user's keywords for safety check
        userKeywords.forEach(keyword => {
            state.originalMutedKeywords.add(keyword.toLowerCase());
        });

        // Efficiently process user keywords using Map lookup
        userKeywords.forEach(keyword => {
            const lowerKeyword = keyword.toLowerCase();
            const originalCase = ourKeywordsMap.get(lowerKeyword);
            if (originalCase) {
                state.activeKeywords.add(originalCase);
                console.debug(`Added existing muted keyword from our list: ${originalCase}`);
            } else {
                console.log(`Ignoring user custom keyword for UI: ${keyword}`);
            }
        });

        // Log the counts for verification
        const { toMute, toUnmute } = getMuteUnmuteCounts();
        console.debug('Initial state:', {
            activeKeywords: state.activeKeywords.size,
            originalMuted: state.originalMutedKeywords.size,
            sessionMuted: state.sessionMutedKeywords.size,
            toMute,
            toUnmute
        });

    } catch (error) {
        console.error('Failed to initialize keyword state:', error);
        showNotification('Failed to load your muted keywords. Please refresh the page.', 'error');
    }
}

// Helper to update button text
export function getButtonText() {
    const { toMute, toUnmute } = getMuteUnmuteCounts();
    const parts = [];

    if (toMute > 0) {
        parts.push(`Mute ${toMute} new`);
    }
    if (toUnmute > 0) {
        parts.push(`Unmute ${toUnmute} existing`);
    }

    return parts.length > 0 ? parts.join(', ') : 'No changes';
}
