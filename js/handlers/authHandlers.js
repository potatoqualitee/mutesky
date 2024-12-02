import { state, saveState } from '../state.js';
import { elements } from '../dom.js';
import { blueskyService } from '../bluesky.js';

export async function handleAuth() {
    try {
        // Clear any existing state
        state.activeKeywords.clear();
        state.selectedContexts.clear();
        state.selectedExceptions.clear();
        state.selectedCategories.clear();

        // Initiate Bluesky login
        await blueskyService.signIn();

        // The rest will be handled by the OAuth callback and blueskyService's setup
    } catch (error) {
        console.error('Authentication failed:', error);
    }
}

export async function handleLogout() {
    try {
        await blueskyService.signOut();

        state.authenticated = false;
        state.activeKeywords.clear();
        state.selectedContexts.clear();
        state.selectedExceptions.clear();
        state.selectedCategories.clear();
        state.mode = 'simple';
        state.menuOpen = false;

        elements.landingPage.classList.remove('hidden');
        elements.appInterface.classList.add('hidden');
        elements.userMenuDropdown.classList.remove('visible');

        saveState();
    } catch (error) {
        console.error('Logout failed:', error);
    }
}
