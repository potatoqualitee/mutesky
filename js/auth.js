import { BrowserOAuthClient } from '@atproto/oauth-client-browser'

export class AuthService {
    constructor() {
        this.client = null;
        this.session = null;
        this.setupPromise = null;
        this.sessionInvalidatedCallbacks = new Set();
    }

    async setup() {
        if (!this.setupPromise) {
            this.setupPromise = this.initialize().catch(error => {
                this.setupPromise = null;
                throw error;
            });
        }
        return this.setupPromise;
    }

    async initialize() {
        try {
            // Initialize the OAuth client with production configuration
            this.client = await BrowserOAuthClient.load({
                clientId: 'https://mutesky.app/client-metadata.json',
                handleResolver: 'https://bsky.social/',
                // Session hooks replaced the old 'deleted' event in @atproto/oauth-client-browser 0.4.x
                onDelete: (sub, cause) => {
                    console.error(`[Auth] Session for ${sub} is no longer available (cause: ${cause})`);
                    // Isolate subscribers so one throwing callback can't starve the rest
                    this.sessionInvalidatedCallbacks.forEach(cb => {
                        try {
                            cb(sub, cause);
                        } catch (err) {
                            console.error('[Auth] Session-invalidated callback failed:', err);
                        }
                    });
                }
            });

            // Let the client handle initialization and callback processing
            const result = await this.client.init();

            if (result?.session) {
                this.session = result.session;
                if (result.state) {
                    console.debug('[Auth] Session established from callback');
                    // Dispatch event for callback page
                    window.dispatchEvent(new CustomEvent('mutesky:auth:complete', {
                        detail: { success: true }
                    }));
                } else {
                    console.debug('[Auth] Session restored from last active session');
                }
                return { success: true, session: this.session };
            }

            // Dispatch event for callback page if we're on the callback page
            if (window.location.pathname.endsWith('callback.html')) {
                window.dispatchEvent(new CustomEvent('mutesky:auth:complete', {
                    detail: { success: false }
                }));
            }
            return { success: false, reason: 'no_session' };
        } catch (error) {
            console.error('[Auth] Failed to initialize Bluesky client', error);
            this.session = null;
            // Dispatch event for callback page if we're on the callback page
            if (window.location.pathname.endsWith('callback.html')) {
                window.dispatchEvent(new CustomEvent('mutesky:auth:complete', {
                    detail: { success: false, error }
                }));
            }
            return { success: false, error, reason: 'error' };
        }
    }

    async signIn(handle) {
        try {
            console.debug('[Auth] Starting sign in for handle:', handle);
            if (!this.client) {
                throw new Error('Client not initialized. Call setup() first.');
            }

            if (!handle?.trim()) {
                throw new Error('Please enter your Bluesky handle');
            }

            // Initiate the OAuth flow
            await this.client.signIn(handle, {
                scope: 'atproto transition:generic'
            });
            // Note: The above line will redirect the user, so we won't reach here
            // unless there's an error or the user navigates back
        } catch (error) {
            console.error('[Auth] Sign in failed:', error);
            throw error;
        }
    }

    async signOut() {
        if (this.session) {
            try {
                console.debug('[Auth] Starting sign out...');
                await this.session.signOut();
                this.session = null;
                this.setupPromise = null;
                console.debug('[Auth] Sign out complete');
                return true;
            } catch (error) {
                console.error('[Auth] Sign out failed:', error);
                throw error;
            }
        }
    }

    async refreshSession() {
        try {
            if (!this.client) {
                throw new Error('Client not initialized');
            }

            // Attempt to refresh the session
            const result = await this.client.init();
            if (result?.session) {
                this.session = result.session;
                console.debug('[Auth] Session refreshed successfully');
                return { success: true, session: this.session };
            }

            return { success: false };
        } catch (error) {
            console.error('[Auth] Session refresh failed:', error);
            return { success: false, error };
        }
    }

    // Register a callback for session invalidation (wired to the onDelete session hook)
    onSessionInvalidated(callback) {
        this.sessionInvalidatedCallbacks.add(callback);
    }
}

// Shared across the landing bootstrap and the authenticated application chunk.
export const authService = new AuthService();
