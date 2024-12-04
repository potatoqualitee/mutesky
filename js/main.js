import { elements } from './dom.js';
import { state, loadState, setTargetKeywordCount, saveState } from './state.js';
import { fetchKeywordGroups, fetchContextGroups, fetchDisplayConfig } from './api.js';
import { renderInterface } from './renderer.js';
import { debounce } from './utils.js';
import { blueskyService } from './bluesky.js';
import { getAllKeywordsForCategory } from './categoryManager.js';
import {
    handleAuth,
    handleLogout,
    handleMuteSubmit,
    switchMode,
    handleEnableAll,
    handleDisableAll,
    handleContextToggle,
    handleExceptionToggle,
    handleCategoryToggle,
    handleKeywordToggle,
    handleRefreshData,
    showApp,
    updateSimpleModeState,
    initializeKeywordState,
    handleSettingsModalToggle,
    handleFooterThemeToggle,
    applyAppearanceSettings
} from './handlers/index.js';

// Initialize Application
async function init() {
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

        console.log('[Main] Starting initialization');
        console.log('[Main] Initial state exceptions:', Array.from(state.selectedExceptions));

        // Load saved state first
        loadState();
        console.log('[Main] After loadState, exceptions:', Array.from(state.selectedExceptions));

        // Load all required data before initializing UI
        await Promise.all([
            fetchDisplayConfig(),
            fetchKeywordGroups(),
            fetchContextGroups()
        ]);

        // Initialize Bluesky service and handle auth
        const result = await blueskyService.setup();
        if (result?.session) {
            state.authenticated = true;
            await showApp();
            // Initialize keyword state after authentication
            await initializeKeywordState();
        }

        // Now that all data is loaded, initialize the UI
        if (state.authenticated) {
            console.log('[Main] User authenticated, preparing UI');
            console.log('[Main] Current exceptions before UI init:', Array.from(state.selectedExceptions));

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
                console.log('[Main] Found SimpleMode component, updating state');
                console.log('[Main] Updating filter level:', state.filterLevel);
                simpleMode.updateLevel(state.filterLevel);
                console.log('[Main] Updating exceptions:', Array.from(state.selectedExceptions));
                simpleMode.updateExceptions(state.selectedExceptions);
            } else {
                console.log('[Main] SimpleMode component not found');
            }
        } else if (elements.landingPage && elements.appInterface) {
            elements.landingPage.classList.remove('hidden');
            elements.appInterface.classList.add('hidden');
        }

        setupEventListeners();

        // Listen for Bluesky login state changes
        window.addEventListener('blueskyLoginStateChanged', async (event) => {
            state.authenticated = event.detail.isLoggedIn;
            if (state.authenticated) {
                console.log('[Main] Auth state changed - authenticated');
                console.log('[Main] Current exceptions before auth update:', Array.from(state.selectedExceptions));

                await showApp();
                // Initialize keyword state after authentication
                await initializeKeywordState();
                // Re-render interface to show checked keywords
                renderInterface();

                // Update SimpleMode component with current state
                const simpleMode = document.querySelector('simple-mode');
                if (simpleMode) {
                    console.log('[Main] Found SimpleMode component after auth, updating state');
                    console.log('[Main] Updating filter level:', state.filterLevel);
                    simpleMode.updateLevel(state.filterLevel);
                    console.log('[Main] Updating exceptions:', Array.from(state.selectedExceptions));
                    simpleMode.updateExceptions(state.selectedExceptions);
                } else {
                    console.log('[Main] SimpleMode component not found after auth');
                }
            } else if (elements.landingPage && elements.appInterface) {
                elements.landingPage.classList.remove('hidden');
                elements.appInterface.classList.add('hidden');
            }
        });

        // Hide loading state
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
            // Remove from DOM after transition
            setTimeout(() => loadingOverlay.remove(), 300);
        }

        // Add js-loaded class to body to show content
        document.body.classList.add('js-loaded');

        console.log('[Main] Initialization complete');
        console.log('[Main] Final state exceptions:', Array.from(state.selectedExceptions));
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

// Event Listeners
function setupEventListeners() {
    elements.authButton?.addEventListener('click', handleAuth);
    elements.logoutButton?.addEventListener('click', handleLogout);
    elements.muteButton?.addEventListener('click', handleMuteSubmit);
    elements.navMuteButton?.addEventListener('click', handleMuteSubmit);
    elements.enableAllBtn?.addEventListener('click', handleEnableAll);
    elements.disableAllBtn?.addEventListener('click', handleDisableAll);
    elements.refreshButton?.addEventListener('click', handleRefreshData);

    // Handle filter level changes from simple mode
    document.addEventListener('filterLevelChange', (event) => {
        const level = event.detail.level;
        console.log('[Main] Received filterLevelChange event with level:', level);
        console.log('[Main] Current state filter level:', state.filterLevel);
        console.log('[Main] Current exceptions before level change:', Array.from(state.selectedExceptions));

        // Map intensity levels to keyword counts based on performance thresholds
        const levelToCount = {
            0: 100,   // Minimal: ~100 highest weighted keywords
            1: 300,   // Moderate: ~300 keywords
            2: 500,   // Extensive: ~500 keywords
            3: 2000   // Complete: All keywords
        };

        console.log(`[Main] Changing filter level to ${level} (target: ${levelToCount[level]} keywords)`);

        // Update filter level in state to match event
        state.filterLevel = level;
        console.log('[Main] Updated state filter level to:', state.filterLevel);

        // Store current exceptions
        const currentExceptions = new Set(state.selectedExceptions);
        console.log('[Main] Stored current exceptions:', Array.from(currentExceptions));

        // Update target keyword count based on intensity level
        setTargetKeywordCount(levelToCount[level]);

        // Clear and rebuild active keywords while preserving exceptions
        state.activeKeywords.clear();
        state.selectedContexts.forEach(contextId => {
            const context = state.contextGroups[contextId];
            if (context && context.categories) {
                context.categories.forEach(category => {
                    if (!currentExceptions.has(category)) {
                        // Get keywords sorted by weight and limited by new target count
                        const keywords = getAllKeywordsForCategory(category, true);
                        console.log(`[Main] Adding ${keywords.length} keywords from ${category}`);
                        keywords.forEach(keyword => state.activeKeywords.add(keyword));
                    }
                });
            }
        });

        // Restore exceptions
        state.selectedExceptions = currentExceptions;
        console.log('[Main] Restored exceptions after level change:', Array.from(state.selectedExceptions));

        // Save state after filter level change
        console.log('[Main] Saving state after filter level change');
        saveState();

        // Update interface with new filtered keywords
        renderInterface();
    });

    elements.profileButton?.addEventListener('click', () => {
        state.menuOpen = !state.menuOpen;
        elements.userMenuDropdown?.classList.toggle('visible', state.menuOpen);
    });

    document.addEventListener('click', (event) => {
        if (!event.target.closest('.user-menu') && state.menuOpen && elements.userMenuDropdown) {
            state.menuOpen = false;
            elements.userMenuDropdown.classList.remove('visible');
        }
    });

    elements.sidebarSearch?.addEventListener('input', debounce((e) => {
        state.searchTerm = e.target.value.toLowerCase();
        renderInterface();
    }, 300));

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        applyAppearanceSettings();
    });

    // Handle visibility change to restore state when page becomes visible
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            console.log('[Main] Page became visible');
            console.log('[Main] Exceptions before loadState:', Array.from(state.selectedExceptions));

            loadState();
            console.log('[Main] Exceptions after loadState:', Array.from(state.selectedExceptions));

            // Re-render interface with restored state
            renderInterface();
            // Re-apply mode
            switchMode(state.mode);

            // Update SimpleMode component with current state
            const simpleMode = document.querySelector('simple-mode');
            if (simpleMode) {
                console.log('[Main] Found SimpleMode component after visibility change');
                console.log('[Main] Updating filter level:', state.filterLevel);
                simpleMode.updateLevel(state.filterLevel);
                console.log('[Main] Updating exceptions:', Array.from(state.selectedExceptions));
                simpleMode.updateExceptions(state.selectedExceptions);
            } else {
                console.log('[Main] SimpleMode component not found after visibility change');
            }
        }
    });
}

// Make handlers available globally
window.handleContextToggle = handleContextToggle;
window.handleExceptionToggle = handleExceptionToggle;
window.handleCategoryToggle = handleCategoryToggle;
window.handleKeywordToggle = handleKeywordToggle;
window.settingsHandlers = {
    handleSettingsModalToggle,
    handleFooterThemeToggle
};
window.switchMode = switchMode;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    init();
});
