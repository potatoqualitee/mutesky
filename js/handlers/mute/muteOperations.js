import { state, saveState, getMuteUnmuteCounts } from '../../state.js';
import { blueskyService } from '../../bluesky.js';
import { renderInterface } from '../../renderer.js';
import { showNotification } from '../../utils/notifications.js';
import { muteCache } from './muteCache.js';
import { debouncedUpdate } from './muteUIUtils.js';
import { getKeywordsWithCase } from '../../keywordState.js';
import { seedActiveFromMutedKeywords, syncDerivedContexts } from '../context/selectionModel.js';
import { getSubmittableKeywords, getManagedKeywordsForSubmit, clearRemovedMyKeywords, scrubStaleTombstones } from '../../myKeywords.js';

// Process all keywords immediately without batching
function processKeywords(keywords, operation) {
    console.debug('[processKeywords] Processing', keywords.length, 'keywords');
    keywords.forEach(operation);
    console.debug('[processKeywords] Finished processing all keywords');
}

export async function handleMuteSubmit() {
    try {
        console.debug('[handleMuteSubmit] Starting mute operation');

        // Get selected keywords efficiently (minus pending My Keywords removals)
        const selectedKeywords = getSubmittableKeywords();
        console.debug('[handleMuteSubmit] Selected keywords:', selectedKeywords.length);

        // Use cached keyword map, extended with removal tombstones so Bluesky
        // drops deleted My Keywords instead of preserving them as unmanaged
        const ourKeywordsMap = muteCache.getOurKeywordsMap();
        const ourKeywords = getManagedKeywordsForSubmit(ourKeywordsMap.keys());
        console.debug('[handleMuteSubmit] Our keywords total:', ourKeywords.length);

        // Get the counts before update
        const { toMute, toUnmute } = getMuteUnmuteCounts();
        console.debug('[handleMuteSubmit] To mute:', toMute, 'To unmute:', toUnmute);

        // Update muted keywords
        console.debug('[handleMuteSubmit] Updating keywords on Bluesky');
        await blueskyService.mute.updateMutedKeywords(selectedKeywords, ourKeywords);
        console.debug('[handleMuteSubmit] Bluesky update complete');

        // Removals are live on Bluesky now; their tombstones are done
        clearRemovedMyKeywords();

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

        // Size errors carry a complete, user-friendly message already
        if (error.name === 'PreferencesSizeError') {
            showNotification(error.message, 'error');
            return;
        }

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

        // With fresh mute state, tombstones that have nothing to unmute can go
        scrubStaleTombstones();

        // Reflect real Bluesky mutes into the pending selection (the old
        // clear-and-rebuild path used to do this as a side effect) and
        // re-derive which context cards show selected
        seedActiveFromMutedKeywords(getKeywordsWithCase());
        syncDerivedContexts();

    } catch (error) {
        console.error('[initializeKeywordState] Failed to initialize keyword state:', error);
        showNotification('Failed to load your muted keywords. Please refresh the page.', 'error');
    }
}
