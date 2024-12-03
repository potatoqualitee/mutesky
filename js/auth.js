import { BrowserOAuthClient } from '@atproto/oauth-client-browser'

export class AuthService {
    constructor() {
        this.client = null;
        this.session = null;
    }

    async setup() {
        try {
            console.log('[Auth] Starting setup...');
            // Initialize the OAuth client with production configuration
            this.client = await BrowserOAuthClient.load({
                clientId: 'https://mutesky.app/client-metadata.json',
                handleResolver: 'https://bsky.social/'
            });
            console.log('[Auth] OAuth client loaded');

            // Check if we have auth state from callback
            const authState = sessionStorage.getItem('auth_state');
            const authCode = sessionStorage.getItem('auth_code');

            if (authState && authCode) {
                console.log('[Auth] Found stored auth state, processing callback...');
                // Clear auth state immediately to prevent replay
                sessionStorage.removeItem('auth_state');
                sessionStorage.removeItem('auth_code');

                try {
                    // Process the callback with the stored auth code
                    const result = await this.client.callback({
                        code: authCode,
                        state: authState
                    });
                    console.log('[Auth] Callback processed successfully');

                    if (result?.session) {
                        this.session = result.session;
                        console.log('[Auth] Session established from callback');
                        return { success: true, session: this.session };
                    }
                } catch (error) {
                    console.error('[Auth] Failed to process auth callback:', error);
                    return {
                        success: false,
                        error: new Error('Failed to complete authentication')
                    };
                }
            }

            console.log('[Auth] No stored auth state, trying normal init');
            // No callback data, try to initialize normally
            const result = await this.client.init();
            console.log('[Auth] Init result:', result ? 'has result' : 'no result');

            if (result?.session) {
                this.session = result.session;
                console.log('[Auth] Session established from init');
                return { success: true, session: this.session };
            }

            console.log('[Auth] No session established');
            return { success: false };
        } catch (error) {
            console.error('[Auth] Failed to initialize Bluesky client', error);
            this.session = null;
            return { success: false, error: new Error('[Auth] Failed to initialize Bluesky client') };
        }
    }

    async signIn(handle) {
        try {
            console.log('[Auth] Starting sign in for handle:', handle);
            if (!this.client) {
                throw new Error('Client not initialized. Call setup() first.');
            }

            if (!handle?.trim()) {
                throw new Error('Please enter your Bluesky handle');
            }

            // Get the authorization URL - allow silent auth when possible
            const url = await this.client.authorize(handle, {
                scope: 'atproto transition:generic'
            });
            console.log('[Auth] Got authorization URL, redirecting...');

            // Redirect to the authorization URL
            window.location.href = url.href;
        } catch (error) {
            console.error('[Auth] Sign in failed:', error);
            throw error;
        }
    }

    async signOut() {
        if (this.session) {
            try {
                console.log('[Auth] Starting sign out...');
                await this.session.signOut();
                this.session = null;
                console.log('[Auth] Sign out complete');
                return true;
            } catch (error) {
                console.error('[Auth] Sign out failed:', error);
                throw error;
            }
        }
    }
}
