import { AuthService } from './auth.js'
import { ProfileService } from './profile.js'
import { MuteService } from './mute.js'
import { UIService } from './ui.js'

class BlueskyService {
    constructor() {
        console.log('[Bluesky] Initializing services...');
        this.auth = new AuthService();
        this.profile = new ProfileService(null);
        this.mute = new MuteService(null);
        this.ui = new UIService();
        this.setupPromise = null;
    }

    async setup() {
        // Return existing setup promise if it exists
        if (this.setupPromise) {
            console.log('[Bluesky] Returning existing setup promise');
            return this.setupPromise;
        }

        console.log('[Bluesky] Starting new setup...');
        // Create new setup promise
        this.setupPromise = (async () => {
            try {
                console.log('[Bluesky] Awaiting auth setup...');
                const result = await this.auth.setup();
                console.log('[Bluesky] Auth setup complete:', result.success ? 'success' : 'failed');

                if (result.success && result.session) {
                    console.log('[Bluesky] Updating services with new session...');

                    // All synchronous operations
                    this.profile.setSession(result.session);
                    this.mute.setSession(result.session);
                    this.ui.updateLoginState(true);

                    console.log('[Bluesky] All services updated');

                    // Only fetch profile initially
                    await this.updateProfile();

                    // Start mute count update
                    console.log('[Bluesky] Loading keywords...');
                    await this.updateMuteCount();

                    // Dispatch setup complete event
                    window.dispatchEvent(new CustomEvent('mutesky:setup:complete'));

                    return result;
                } else {
                    console.log('[Bluesky] Auth setup did not return success');
                    if (result.error?.name === 'OAuthCallbackError') {
                        this.ui.updateLoginState(false, `Failed to connect to Bluesky: ${result.error.message}`);
                    } else if (result.error) {
                        this.ui.updateLoginState(false, `Failed to connect to Bluesky: ${result.error.message || 'Unknown error'}`);
                    }
                    return result;
                }
            } catch (error) {
                console.error('[Bluesky] Setup failed:', error);
                this.ui.updateLoginState(false, `Setup failed: ${error.message || 'Unknown error'}`);
                throw error;
            }
        })();

        return this.setupPromise;
    }

    async updateProfile() {
        try {
            console.log('[Bluesky] Loading keywords...');
            const profile = await this.profile.getProfile();
            if (profile) {
                console.log('[Bluesky] Updating keywords...');
                this.profile.updateUI(profile);
            }
        } catch (error) {
            console.error('[Bluesky] Profile update failed:', error);
        }
    }

    async updateMuteCount() {
        try {
            console.log('[Bluesky] Fetching mute count...');
            const keywords = await this.mute.getMutedKeywords();
            console.log('[Bluesky] Updating mute count in UI...');
            this.profile.updateMuteCount(keywords.length);
        } catch (error) {
            console.error('[Bluesky] Mute count update failed:', error);
        }
    }

    async signIn() {
        try {
            console.log('[Bluesky] Starting sign in...');
            const handle = this.ui.getHandleInput();
            if (!handle) {
                this.ui.showError('Please enter your Bluesky handle');
                return;
            }
            await this.auth.signIn(handle);
        } catch (error) {
            console.error('[Bluesky] Sign in failed:', error);
            this.ui.updateLoginState(false, `Sign in failed: ${error.message || 'Please try again'}`);
        }
    }

    async signOut() {
        try {
            console.log('[Bluesky] Starting sign out...');
            await this.auth.signOut();

            console.log('[Bluesky] Updating services for sign out...');
            // All synchronous operations
            this.profile.setSession(null);
            this.mute.setSession(null);
            this.profile.resetUI();
            this.ui.updateLoginState(false);

            console.log('[Bluesky] Sign out complete');

            // Clear setup promise on sign out
            this.setupPromise = null;
        } catch (error) {
            console.error('[Bluesky] Sign out failed:', error);
            this.ui.updateLoginState(false, `Sign out failed: ${error.message || 'Please try again'}`);
        }
    }

    // Mute operations
    async muteKeyword(keyword) {
        return this.mute.muteKeyword(keyword);
    }

    async unmuteKeyword(keyword) {
        return this.mute.unmuteKeyword(keyword);
    }

    async muteActor(actor) {
        return this.mute.muteActor(actor);
    }

    async unmuteActor(actor) {
        return this.mute.unmuteActor(actor);
    }
}

// Export singleton instance
const blueskyService = new BlueskyService();

// Initialize the service when the module loads
console.log('[Bluesky] Starting initial setup...');
blueskyService.setup().catch(console.error);

export { blueskyService };
