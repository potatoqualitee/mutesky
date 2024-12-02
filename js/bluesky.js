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
                    // Update session for all services
                    this.profile.setSession(result.session);
                    this.mute.setSession(result.session);
                    this.ui.updateLoginState(true);

                    // Get and update profile
                    const profile = await this.profile.getProfile();
                    if (profile) {
                        this.profile.updateUI(profile);
                    }
                    return result;
                } else {
                    if (result.error?.name === 'OAuthCallbackError') {
                        this.ui.updateLoginState(false, `Failed to connect to Bluesky: ${result.error.message}`);
                    } else if (result.error) {
                        this.ui.updateLoginState(false, `Failed to connect to Bluesky: ${result.error.message || 'Unknown error'}`);
                    }
                    return result;
                }
            } catch (error) {
                console.error('Setup failed:', error);
                this.ui.updateLoginState(false, `Setup failed: ${error.message || 'Unknown error'}`);
                throw error;
            }
        })();

        return this.setupPromise;
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
            console.error('Sign in failed:', error);
            this.ui.updateLoginState(false, `Sign in failed: ${error.message || 'Please try again'}`);
        }
    }

    async signOut() {
        try {
            await this.auth.signOut();
            this.profile.setSession(null);
            this.mute.setSession(null);
            this.profile.resetUI();
            this.ui.updateLoginState(false);
            // Clear setup promise on sign out
            this.setupPromise = null;
        } catch (error) {
            console.error('Sign out failed:', error);
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
