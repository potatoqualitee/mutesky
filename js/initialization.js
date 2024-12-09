import { elements } from './dom.js';
import { state, loadState } from './state.js';
import { fetchKeywordGroups, fetchContextGroups, fetchDisplayConfig } from './api.js';
import { renderInterface } from './renderer.js';
import { blueskyService } from './bluesky.js';
import {
    showApp,
    updateSimpleModeState,
    initializeKeywordState,
    switchMode,
    applyAppearanceSettings
} from './handlers/index.js';

// Initialize Application
export async function init() {
    try {
        // Show loading state
        const loadingOverlay = document.getElementById('loading-state');

        // Apply appearance settings first
        applyAppearanceSettings();

        // Check if we're on the callback page
        const isCallbackPage = window.location.pathname.includes('callback.html');
        if (isCallbackPage) {
            // Only do auth setup on callback page
            await blueskyService.setup();
            return;
        }

        // Initialize Bluesky service and handle auth first
        const result = await blueskyService.setup();
        if (result?.session) {
            // Set DID in state before loading saved state
            state.did = result.session.did;
            state.authenticated = true;

            // Now load saved state
            loadState();

            // Load all required data
            await Promise.all([
                fetchDisplayConfig(),
                fetchKeywordGroups(),
                fetchContextGroups()
            ]);

            await showApp();
            // Initialize keyword state after authentication
            await initializeKeywordState();
        }

        // Now that all data is loaded, initialize the UI
        if (state.authenticated) {
            // First update simple mode state if needed
            if (state.mode === 'simple') {
                updateSimpleModeState();
            }
            // Then switch to the correct mode
            switchMode(state.mode);
            // Finally render the interface
            renderInterface();

            // Update SimpleMode component with loaded state
            const simpleMode = document.querySelector('simple-mode');
            if (simpleMode) {
                simpleMode.updateLevel(state.filterLevel);
                simpleMode.updateExceptions(state.selectedExceptions);
            }
        } else if (elements.landingPage && elements.appInterface) {
            elements.landingPage.classList.remove('hidden');
            elements.appInterface.classList.add('hidden');
        }

        // Hide loading state
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
            // Remove from DOM after transition
            setTimeout(() => loadingOverlay.remove(), 300);
        }

        // Add js-loaded class to body to show content
        document.body.classList.add('js-loaded');
    } catch (error) {
        console.error('Initialization failed:', error);
        // Hide loading state even on error
        const loadingOverlay = document.getElementById('loading-state');
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
            setTimeout(() => loadingOverlay.remove(), 300);
        }
    }
}
