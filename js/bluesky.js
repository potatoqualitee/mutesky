import { AuthService } from './auth.js'
import { ProfileService } from './profile.js'
import { MuteService } from './mute.js'
import { UIService } from './ui.js'

class BlueskyService {
    constructor() {
        this.auth = new AuthService();
        this.profile = new ProfileService(null);
        this.mute = new MuteService(null);
        this.ui = new UIService();
        this.setupPromise = null;
        this.isRefreshing = false;
    }

    async setup() {
        // Return existing setup promise if it exists
        if (this.setupPromise) {
            return this.setupPromise;
        }

        // Create new setup promise
        this.setupPromise = (async () => {
            try {
                const result = await this.auth.setup();

                if (result.success && result.session) {
                    // Update services with active session
                    this.profile.setSession(result.session);
                    this.mute.setSession(result.session);
                    this.ui.updateLoginState(true);

                    // Set up session refresh handler
                    this.setupSessionRefreshHandler();

                    // Only fetch profile initially
                    await this.updateProfile();

                    // Start mute count update
                    await this.updateMuteCount();

                    // Dispatch setup complete event
                    window.dispatchEvent(new CustomEvent('mutesky:setup:complete'));

                    return result;
                } else {
                    // Handle different reasons for no session
                    if (result.reason === 'no_session') {
                        this.ui.updateLoginState(false);
                    } else if (result.error?.name === 'OAuthCallbackError') {
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

    setupSessionRefreshHandler() {
        window.addEventListener('mutesky:session:refresh:needed', async () => {
            if (this.isRefreshing) return; // Prevent multiple simultaneous refreshes

            try {
                this.isRefreshing = true;
                console.debug('[Bluesky] Attempting to refresh session...');

                const result = await this.auth.refreshSession();

                if (result.success && result.session) {
                    console.debug('[Bluesky] Session refreshed successfully');
                    // Update services with new session
                    this.profile.setSession(result.session);
                    this.mute.setSession(result.session);

                    // Retry the failed operations
                    await this.updateProfile();
                    await this.updateMuteCount();
                } else {
                    console.error('[Bluesky] Session refresh failed');
                    // If refresh fails, sign out user
                    await this.signOut();
                }
            } catch (error) {
                console.error('[Bluesky] Session refresh error:', error);
                await this.signOut();
            } finally {
                this.isRefreshing = false;
            }
        });
    }

    async updateProfile() {
        try {
            const profile = await this.profile.getProfile();
            if (profile) {
                this.profile.updateUI(profile);
            }
        } catch (error) {
            console.error('[Bluesky] Profile update failed:', error);
        }
    }

    async updateMuteCount() {
        try {
            const keywords = await this.mute.getMutedKeywords();
            this.profile.updateMuteCount(keywords.length);
        } catch (error) {
            console.error('[Bluesky] Mute count update failed:', error);
        }
    }

    async signIn() {
        try {
            const handle = this.ui.getHandleInput();
            if (!handle) {
                this.ui.showError('Please enter your Bluesky handle');
                return;
            }
            await this.auth.signIn(handle);
        } catch (error) {
            console.error('[Bluesky] Sign in failed:', error);

            // Check for common service availability errors
            if (error.message && (
                error.message.includes('invalid_client_metadata') ||
                error.message.includes('Failed to resolve OAuth server metadata for issuer: bsky.social')
            )) {
                this.ui.updateLoginState(false, 'Bluesky service appears to be down. Please try again in a few minutes.');
            } else {
                this.ui.updateLoginState(false, `Sign in failed: ${error.message || 'Please try again'}`);
            }
        }
    }

    async signOut() {
        try {
            await this.auth.signOut();

            // Update services for sign out
            this.profile.setSession(null);
            this.mute.setSession(null);
            this.profile.resetUI();
            this.ui.updateLoginState(false);

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
blueskyService.setup().catch(console.error);

export { blueskyService };
