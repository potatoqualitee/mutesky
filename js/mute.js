import { Agent } from '@atproto/api'
import { loadMuteSettings, getExpirationDate } from './handlers/settingsHandlers.js'

// The PDS rejects XRPC JSON bodies larger than 150KB (jsonLimit in
// bluesky-social/atproto packages/pds/src/index.ts). The whole preferences
// document counts against it, not just muted words. Preferences are plain
// JSON (no blobs/CIDs), so JSON.stringify produces the same bytes the atproto
// client puts on the wire; a small margin absorbs any residual difference.
export const PDS_JSON_LIMIT_BYTES = 150 * 1024;
const SIZE_SAFETY_MARGIN_BYTES = 2 * 1024;
export const MAX_PREFERENCES_BYTES = PDS_JSON_LIMIT_BYTES - SIZE_SAFETY_MARGIN_BYTES;

export function measureJsonBytes(value) {
    return new TextEncoder().encode(JSON.stringify(value)).length;
}

export class PreferencesSizeError extends Error {
    constructor({ payloadBytes, limitBytes, mutedWordCount, mutedWordsBytes, serverRejected = false }) {
        const payloadKb = Math.round(payloadBytes / 1024);
        const limitKb = Math.floor(limitBytes / 1024);
        let message;
        let keywordsToRemove = null;
        if (serverRejected) {
            // The pre-flight check passed but the server still said 413, so we
            // cannot honestly compute "N keywords over" -- give generic guidance
            message =
                `Bluesky rejected this update as too large (about ${payloadKb} KB of settings). ` +
                `Try deselecting some keywords or whole categories and muting again.`;
        } else {
            const overBytes = payloadBytes - limitBytes;
            const avgItemBytes = mutedWordCount > 0 ? mutedWordsBytes / mutedWordCount : 60;
            keywordsToRemove = Math.max(1, Math.ceil(overBytes / avgItemBytes));
            message =
                `This selection is too large for Bluesky to store. ` +
                `Your settings would be about ${payloadKb} KB, but Bluesky accepts at most ~${limitKb} KB. ` +
                `Try deselecting roughly ${keywordsToRemove.toLocaleString()} keywords (or whole categories) and muting again.`;
        }
        super(message);
        this.name = 'PreferencesSizeError';
        this.payloadBytes = payloadBytes;
        this.limitBytes = limitBytes;
        this.keywordsToRemove = keywordsToRemove;
        this.serverRejected = serverRejected;
    }
}

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
            const response = await agent.app.bsky.actor.getPreferences();
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
            const response = await agent.app.bsky.actor.getPreferences();
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

            // Pre-flight size check: measure the exact JSON body we are about to
            // send and fail gracefully instead of letting the PDS return a 413
            const payloadBytes = measureJsonBytes({ preferences: this.cachedPreferences });
            if (payloadBytes > MAX_PREFERENCES_BYTES) {
                console.warn(`[MuteService] Preferences payload ${payloadBytes} bytes exceeds safe limit ${MAX_PREFERENCES_BYTES}`);
                throw new PreferencesSizeError({
                    payloadBytes,
                    limitBytes: MAX_PREFERENCES_BYTES,
                    mutedWordCount: updatedItems.length,
                    mutedWordsBytes: measureJsonBytes(updatedItems)
                });
            }

            try {
                // Update preferences using fresh agent
                await agent.app.bsky.actor.putPreferences({
                    preferences: this.cachedPreferences
                });
            } catch (error) {
                if (error.status === 401) {
                    // Dispatch event for session refresh
                    const refreshEvent = new CustomEvent('mutesky:session:refresh:needed');
                    window.dispatchEvent(refreshEvent);
                    throw error; // Let BlueskyService handle the retry
                }
                if (error.status === 413 || /entity too large/i.test(error.message || '')) {
                    // Server-side backstop in case the pre-flight margin was too optimistic
                    throw new PreferencesSizeError({
                        payloadBytes,
                        limitBytes: MAX_PREFERENCES_BYTES,
                        mutedWordCount: updatedItems.length,
                        mutedWordsBytes: measureJsonBytes(updatedItems),
                        serverRejected: true
                    });
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
            // Preserve typed errors so callers can present them properly
            if (error instanceof PreferencesSizeError) {
                throw error;
            }
            // Extract API error message if available
            const apiError = error.message || 'Failed to update muted keywords';
            throw new Error(apiError);
        }
    }
}
