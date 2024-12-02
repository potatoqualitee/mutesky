import { elements } from './dom.js';
import { state, loadState, setTargetKeywordCount } from './state.js';
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

        // Load saved state first
        loadState();

        // Load display config first
        await fetchDisplayConfig();

        // Then load keyword groups and context groups in parallel
        await Promise.all([
            fetchKeywordGroups(),
            fetchContextGroups()
        ]);

        // Initialize mode after loading state
        switchMode(state.mode);

        setupEventListeners();

        // Listen for Bluesky login state changes
        window.addEventListener('blueskyLoginStateChanged', async (event) => {
            state.authenticated = event.detail.isLoggedIn;
            if (state.authenticated) {
                await showApp();
                // Initialize keyword state after authentication
                await initializeKeywordState();
                // Re-render interface to show checked keywords
                renderInterface();
            } else if (elements.landingPage && elements.appInterface) {
                elements.landingPage.classList.remove('hidden');
                elements.appInterface.classList.add('hidden');
            }
        });

        // Initialize Bluesky service
        const result = await blueskyService.setup();
        if (result?.session) {
            state.authenticated = true;
            await showApp();
            // Initialize keyword state after authentication
            await initializeKeywordState();
            // Re-render interface to show checked keywords
            renderInterface();
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
        // Map intensity levels to keyword counts based on performance thresholds
        const levelToCount = {
            0: 100,   // Minimal: ~100 highest weighted keywords
            1: 300,   // Moderate: ~300 keywords
            2: 500,   // Extensive: ~500 keywords
            3: 2000   // Complete: All keywords
        };

        console.log(`Changing filter level to ${level} (target: ${levelToCount[level]} keywords)`);

        // Clear active keywords before updating target count
        state.activeKeywords.clear();

        // Update target keyword count based on intensity level
        setTargetKeywordCount(levelToCount[level]);

        // Re-apply all selected contexts with new weight thresholds
        state.selectedContexts.forEach(contextId => {
            const context = state.contextGroups[contextId];
            if (context && context.categories) {
                context.categories.forEach(category => {
                    if (!state.selectedExceptions.has(category)) {
                        // Get keywords sorted by weight and limited by new target count
                        const keywords = getAllKeywordsForCategory(category, true);
                        console.log(`Re-adding ${keywords.length} keywords from ${category}`);
                        keywords.forEach(keyword => state.activeKeywords.add(keyword));
                    }
                });
            }
        });

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
            loadState();
            // Re-render interface with restored state
            renderInterface();
            // Re-apply mode
            switchMode(state.mode);
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
