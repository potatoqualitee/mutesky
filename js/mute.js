import { Agent } from '@atproto/api'
import { loadMuteSettings, getExpirationDate } from './handlers/settingsHandlers.js'

export class MuteService {
    constructor(session) {
        this.agent = session ? new Agent(session) : null;
        this.session = session;
        this.cachedKeywords = null;
        this.cachedPreferences = null;
        console.debug('[MuteService] MuteService initialized, has session:', !!session);
    }

    setSession(session) {
        console.debug('[MuteService] Setting new session in MuteService:', !!session);
        this.agent = session ? new Agent(session) : null;
        this.session = session;
        // Clear caches when session changes
        this.cachedKeywords = null;
        this.cachedPreferences = null;
    }

    async getMutedKeywords(forceRefresh = false) {
        if (!this.session) {
            console.debug('[MuteService] Cannot get muted keywords - not logged in');
            return [];
        }

        // Return cached keywords if available and not forcing refresh
        if (!forceRefresh && this.cachedKeywords !== null) {
            console.debug('[MuteService] Returning cached muted keywords');
            return this.cachedKeywords;
        }

        try {
            // Create fresh agent instance to ensure latest session
            const agent = new Agent(this.session);

            // Get user's preferences from Bluesky
            console.debug('[MuteService] Fetching user preferences...');
            const response = await agent.api.app.bsky.actor.getPreferences();
            this.cachedPreferences = response.data.preferences;

            // Find the muted words preference
            const mutedWordsPref = this.cachedPreferences.find(
                pref => pref.$type === 'app.bsky.actor.defs#mutedWordsPref'
            );

            // Extract just the values from the muted words
            const mutedKeywords = mutedWordsPref?.items?.map(item => item.value) || [];

            // Cache the result
            this.cachedKeywords = mutedKeywords;

            // Log the counts
            console.debug('[MuteService] User muted keywords:', mutedKeywords);

            return mutedKeywords;
        } catch (error) {
            console.error('[MuteService] Failed to get muted keywords:', error);
            // Try to refresh session if we got a 401
            if (error.status === 401) {
                // Dispatch event for session refresh
                const refreshEvent = new CustomEvent('mutesky:session:refresh:needed');
                window.dispatchEvent(refreshEvent);
            }
            // Clear caches on error
            this.cachedKeywords = null;
            this.cachedPreferences = null;
            throw new Error('Failed to fetch muted keywords from Bluesky');
        }
    }

    async updateMutedKeywords(selectedKeywords, ourKeywordsList) {
        // Early validation
        if (!this.session) {
            throw new Error('Cannot update keywords - not logged in');
        }

        if (!Array.isArray(selectedKeywords) || !Array.isArray(ourKeywordsList)) {
            throw new Error('Invalid input: selected keywords must be provided as arrays');
        }

        try {
            // Create fresh agent instance to ensure latest session
            const agent = new Agent(this.session);

            // Always get fresh preferences for updates
            console.debug('[MuteService] Getting current preferences...');
            const response = await agent.api.app.bsky.actor.getPreferences();
            this.cachedPreferences = response.data.preferences;

            // Find current muted words pref
            const mutedWordsIndex = this.cachedPreferences.findIndex(
                pref => pref.$type === 'app.bsky.actor.defs#mutedWordsPref'
            );

            // Create efficient lookup Set for our keywords
            const ourKeywordsSet = new Set(ourKeywordsList.map(k => k.toLowerCase()));

            // Get current muted words or initialize empty
            const currentMutedPref = mutedWordsIndex >= 0 ? this.cachedPreferences[mutedWordsIndex] : {
                $type: 'app.bsky.actor.defs#mutedWordsPref',
                items: []
            };

            // Separate user's custom keywords (those not in our list)
            const userCustomKeywords = currentMutedPref.items
                .filter(item => !ourKeywordsSet.has(item.value.toLowerCase()))
                .map(item => ({
                    value: item.value,
                    targets: item.targets || ['content', 'tag']
                }));

            // Load mute settings
            const settings = loadMuteSettings();
            const expiresAt = getExpirationDate(settings.duration);

            // Create new items for selected keywords with settings applied
            const newManagedItems = selectedKeywords
                .filter(keyword => ourKeywordsSet.has(keyword.toLowerCase()))
                .map(keyword => ({
                    value: keyword,
                    targets: settings.scope === 'tags-only' ? ['tag'] : ['content', 'tag'],
                    ...(settings.excludeFollows && { actorTarget: 'notFollowed' }),
                    ...(expiresAt && { expires: expiresAt.toISOString() })
                }));

            // Log operations for verification
            console.debug('[MuteService] Applied mute settings:', settings);
            console.debug('[MuteService] User custom keywords (will be preserved):', userCustomKeywords.map(i => i.value));
            console.debug('[MuteService] New managed keywords to be set:', newManagedItems.map(i => i.value));

            // Combine user's custom keywords with selected managed keywords
            const updatedItems = [
                ...userCustomKeywords,    // Preserve all user's custom keywords
                ...newManagedItems        // Only include selected keywords from our list
            ];

            // Create updated preference
            const updatedMutedPref = {
                $type: 'app.bsky.actor.defs#mutedWordsPref',
                items: updatedItems
            };

            // Update preferences array
            if (mutedWordsIndex >= 0) {
                this.cachedPreferences[mutedWordsIndex] = updatedMutedPref;
            } else {
                this.cachedPreferences.push(updatedMutedPref);
            }

            // Log final state
            console.debug('[MuteService] Total keywords after update:', updatedItems.length);

            try {
                // Update preferences using fresh agent
                await agent.api.app.bsky.actor.putPreferences({
                    preferences: this.cachedPreferences
                });
            } catch (error) {
                if (error.status === 401) {
                    // Dispatch event for session refresh
                    const refreshEvent = new CustomEvent('mutesky:session:refresh:needed');
                    window.dispatchEvent(refreshEvent);
                    throw error; // Let BlueskyService handle the retry
                }
                throw error;
            }

            // Clear caches after successful update
            this.cachedKeywords = null;
            this.cachedPreferences = null;

            console.debug('[MuteService] Successfully updated muted keywords');
            return true;
        } catch (error) {
            console.error('[MuteService] Failed to update muted keywords:', error);
            // Clear caches on error
            this.cachedKeywords = null;
            this.cachedPreferences = null;
            // Extract API error message if available
            const apiError = error.message || 'Failed to update muted keywords';
            throw new Error(apiError);
        }
    }
}
