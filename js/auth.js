import { BrowserOAuthClient } from '@atproto/oauth-client-browser'

export class AuthService {
    constructor() {
        this.client = null;
        this.session = null;
        this.initialSetupComplete = false;
    }

    async setup() {
        try {
            // Initialize the OAuth client with production configuration
            this.client = await BrowserOAuthClient.load({
                clientId: 'https://mutesky.app/client-metadata.json',
                handleResolver: 'https://bsky.social/'
            });

            // Check if we're already authenticated or just got redirected back
            const result = await this.client.init();

            if (result) {
                if ('state' in result) {
                    console.log('User was just redirected back from authorization');
                }
                this.session = result.session;
                return { success: true, session: this.session };
            } else {
                if (!this.initialSetupComplete) {
                    return { success: false };
                }
            }
            this.initialSetupComplete = true;
        } catch (error) {
            console.error('Failed to initialize Bluesky client:', error);
            this.session = null;
            return { success: false, error };
        }
    }

    async signIn(handle) {
        try {
            if (!this.client) {
                throw new Error('Client not initialized. Call setup() first.');
            }

            if (!handle?.trim()) {
                throw new Error('Please enter your Bluesky handle');
            }

            // Get the authorization URL with explicit scopes
            const url = await this.client.authorize(handle, {
                scope: 'atproto transition:generic',
                prompt: 'consent' // Force consent to ensure all scopes are requested
            });

            // Redirect to the authorization URL
            window.location.href = url.href;
        } catch (error) {
            console.error('Sign in failed:', error);
            throw error;
        }
    }

    async signOut() {
        if (this.session) {
            try {
                await this.session.signOut();
                this.session = null;
                return true;
            } catch (error) {
                console.error('Sign out failed:', error);
                throw error;
            }
        }
    }
}
