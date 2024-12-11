import { elements } from './dom.js';
import { state, loadState } from './state.js';
import { renderInterface } from './renderer.js';
import { debounce } from './utils.js';
import { getAllKeywordsForCategory } from './categoryManager.js';
import { blueskyService } from './bluesky.js';
import {
    handleAuth,
    handleLogout,
    handleMuteSubmit,
    switchMode,
    handleEnableAll,
    handleDisableAll,
    handleRefreshData,
    showApp,
    initializeKeywordState,
    applyAppearanceSettings
} from './handlers/index.js';

// Event Listeners
export function setupEventListeners() {
    elements.authButton?.addEventListener('click', handleAuth);
    elements.logoutButton?.addEventListener('click', handleLogout);
    elements.muteButton?.addEventListener('click', handleMuteSubmit);
    elements.navMuteButton?.addEventListener('click', handleMuteSubmit);
    elements.enableAllBtn?.addEventListener('click', handleEnableAll);
    elements.disableAllBtn?.addEventListener('click', handleDisableAll);
    elements.refreshButton?.addEventListener('click', handleRefreshData);

    // Add Enter key handler for login input
    const handleInput = document.getElementById('bsky-handle-input');
    if (handleInput) {
        handleInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleAuth();
            }
        });
    }

    // Set up intersection observer for auth button visibility
    if (elements.authButton) {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    // Check if the button is being intersected (covered) by other elements
                    const isVisible = entry.intersectionRatio === 1.0;
                    elements.authButton.style.visibility = isVisible ? 'visible' : 'hidden';
                });
            },
            {
                threshold: 1.0, // Only trigger when button is fully visible/invisible
                root: null // Use viewport as root
            }
        );

        observer.observe(elements.authButton);
    }

    // Helper function to notify keyword changes
    function notifyKeywordChanges() {
        document.dispatchEvent(new CustomEvent('keywordsUpdated', {
            detail: { count: state.activeKeywords.size }
        }));
    }

    // Handle filter level changes from simple mode
    document.addEventListener('filterLevelChange', (event) => {
        const level = event.detail.level;

        // Update filter level in state
        state.filterLevel = level;

        // Store current exceptions
        const currentExceptions = new Set(state.selectedExceptions);

        // Clear and rebuild active keywords while preserving exceptions
        state.activeKeywords.clear();
        state.selectedContexts.forEach(contextId => {
            const context = state.contextGroups[contextId];
            if (context && context.categories) {
                context.categories.forEach(category => {
                    if (!currentExceptions.has(category)) {
                        // Get keywords sorted by weight
                        const keywords = getAllKeywordsForCategory(category, true);
                        keywords.forEach(keyword => state.activeKeywords.add(keyword));
                    }
                });
            }
        });

        // Notify about keyword changes
        notifyKeywordChanges();

        // Restore exceptions
        state.selectedExceptions = currentExceptions;

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
        if (document.visibilityState === 'visible' && state.did) {
            loadState();

            // Re-render interface with restored state
            renderInterface();
            // Re-apply mode
            switchMode(state.mode);

            // Update SimpleMode component with current state
            const simpleMode = document.querySelector('simple-mode');
            if (simpleMode) {
                simpleMode.updateLevel(state.filterLevel);
                simpleMode.updateExceptions(state.selectedExceptions);
            }
        }
    });

    // Listen for Bluesky login state changes
    window.addEventListener('blueskyLoginStateChanged', async (event) => {
        state.authenticated = event.detail.isLoggedIn;
        if (state.authenticated) {
            // Set DID in state when user logs in
            state.did = blueskyService.auth.session?.did;
            await showApp();
            // Initialize keyword state after authentication
            await initializeKeywordState();
            // Re-render interface to show checked keywords
            renderInterface();

            // Update SimpleMode component with current state
            const simpleMode = document.querySelector('simple-mode');
            if (simpleMode) {
                simpleMode.updateLevel(state.filterLevel);
                simpleMode.updateExceptions(state.selectedExceptions);
            }
        } else {
            // Clear DID when user logs out
            state.did = null;
            if (elements.landingPage && elements.appInterface) {
                elements.landingPage.classList.remove('hidden');
                elements.appInterface.classList.add('hidden');
            }
        }
    });
}
