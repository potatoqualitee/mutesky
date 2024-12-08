import { state, loadState } from '../state.js';
import { elements } from '../dom.js';
import { blueskyService } from '../bluesky.js';
import { initializeState } from './contextHandlers.js';

export async function handleAuth() {
    try {
        // Clear any previous error states first
        if (elements.handleInput) {
            elements.handleInput.classList.remove('error');
        }
        const messageEl = document.getElementById('bsky-auth-message');
        if (messageEl) {
            messageEl.classList.remove('error');
            messageEl.textContent = 'The next page will prompt for your username and Bluesky account password, not your app password. Your credentials are securely handled by Bluesky\'s official authentication service.';
        }

        // Validate handle before attempting auth
        const handle = elements.handleInput?.value?.trim();
        if (!handle) {
            if (elements.handleInput) {
                elements.handleInput.classList.add('error');
            }
            throw new Error('Please enter your Bluesky handle');
        }

        // Disable input and button during authentication
        if (elements.handleInput) {
            elements.handleInput.disabled = true;
        }
        if (elements.authButton) {
            elements.authButton.disabled = true;
            elements.authButton.textContent = 'Connecting...';
        }

        // Store current state before clearing
        const savedContexts = new Set(state.selectedContexts);
        const savedExceptions = new Set(state.selectedExceptions);
        const filterLevel = state.filterLevel;

        // Clear active state
        state.activeKeywords.clear();
        state.selectedContexts.clear();
        state.selectedExceptions.clear();
        state.selectedCategories.clear();

        // Initiate Bluesky login
        await blueskyService.signIn();

        // Restore saved state after login
        state.selectedContexts = savedContexts;
        state.selectedExceptions = savedExceptions;
        state.filterLevel = filterLevel;

        // Initialize state to restore context keywords
        initializeState();

        // The rest will be handled by the OAuth callback and blueskyService's setup
    } catch (error) {
        console.error('Authentication failed:', error);

        // Re-enable input and button on error
        if (elements.handleInput) {
            elements.handleInput.disabled = false;
            elements.handleInput.classList.add('error');
        }
        if (elements.authButton) {
            elements.authButton.disabled = false;
            elements.authButton.textContent = 'Connect to Bluesky';
        }

        // Update auth message with error
        const messageEl = document.getElementById('bsky-auth-message');
        if (messageEl) {
            messageEl.textContent = error.message || 'Authentication failed. Please try again.';
            messageEl.classList.add('error');
        }

        // Ensure UI service is updated
        blueskyService.ui.updateLoginState(false, error.message || 'Authentication failed. Please try again.');
    }
}

export async function handleLogout() {
    try {
        console.debug('[Auth] Starting logout, current exceptions:', Array.from(state.selectedExceptions));
        await blueskyService.signOut();

        // Store exceptions and contexts before clearing state
        const exceptions = new Set(state.selectedExceptions);
        const contexts = new Set(state.selectedContexts);
        const filterLevel = state.filterLevel;
        console.debug('[Auth] Preserved exceptions for logout:', Array.from(exceptions));

        // Clear state but preserve mode
        state.authenticated = false;
        state.activeKeywords.clear();
        state.selectedContexts.clear();
        state.selectedCategories.clear();
        state.mode = 'simple';
        state.menuOpen = false;

        // Restore preserved values
        state.selectedExceptions = exceptions;
        state.selectedContexts = contexts;
        state.filterLevel = filterLevel;
        console.debug('[Auth] Restored exceptions after state clear:', Array.from(state.selectedExceptions));

        // Initialize state to restore context keywords
        initializeState();

        elements.landingPage.classList.remove('hidden');
        elements.appInterface.classList.add('hidden');
        elements.userMenuDropdown.classList.remove('visible');

        // Reset UI elements to initial state
        if (elements.handleInput) {
            elements.handleInput.disabled = false;
            elements.handleInput.classList.remove('error');
            elements.handleInput.value = '';
        }
        if (elements.authButton) {
            elements.authButton.disabled = false;
            elements.authButton.textContent = 'Connect to Bluesky';
        }

        // Reset auth message
        const messageEl = document.getElementById('bsky-auth-message');
        if (messageEl) {
            messageEl.classList.remove('error');
            messageEl.textContent = 'The next page will prompt for your username and Bluesky account password, not your app password. Your credentials are securely handled by Bluesky\'s official authentication service.';
        }

        // Removed saveState() call since we only want to save during mute/unmute
        console.debug('[Auth] Logout complete with exceptions:', Array.from(state.selectedExceptions));
    } catch (error) {
        console.error('Logout failed:', error);
        blueskyService.ui.updateLoginState(false, `Logout failed: ${error.message || 'Please try again'}`);
    }
}
