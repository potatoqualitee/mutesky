import { state, saveState, loadState } from '../state.js';
import { elements } from '../dom.js';
import { blueskyService } from '../bluesky.js';
import { initializeState } from './contextHandlers.js';

export async function handleAuth() {
    try {
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

        saveState();
        console.debug('[Auth] State saved with exceptions:', Array.from(state.selectedExceptions));
    } catch (error) {
        console.error('Logout failed:', error);
    }
}
