import { elements } from './dom.js';
import { state, loadState, saveState, serializeState } from './state.js';
import { renderInterface } from './renderer.js';
import { debounce } from './utils.js';
import { applyFilterLevel } from './handlers/context/selectionModel.js';
import { blueskyService } from './bluesky.js';
import {
    handleAuth,
    handleLogout,
    handleMuteSubmit,
    handleKeywordToggle,
    handleCategoryToggle,
    handleMyKeywordsModalToggle,
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

    // Handle filter level changes from simple mode. Only keywords belonging
    // to selected contexts are re-leveled -- advanced-mode picks and existing
    // Bluesky mutes outside those contexts survive the slider.
    document.addEventListener('filterLevelChange', (event) => {
        state.filterLevel = event.detail.level;

        applyFilterLevel();

        notifyKeywordChanges();
        renderInterface();
        saveState();
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

    // Delegated listeners for the advanced-mode grid and sidebar. Their
    // contents re-render wholesale, so per-checkbox inline handlers would be
    // re-parsed on every render; the two containers themselves are static.
    elements.categoriesGrid?.addEventListener('change', (event) => {
        const keywordCheckbox = event.target.closest('input[data-keyword]');
        if (keywordCheckbox) {
            handleKeywordToggle(keywordCheckbox.dataset.keyword, keywordCheckbox.checked);
        }
    });

    // Category checkboxes read dataset.state, the render-time state, rather
    // than the checked property the browser just flipped -- that keeps the
    // tri-state cycle identical to the old inline handlers, which baked the
    // pre-click state into their arguments at render time
    const handleCategoryCheckboxClick = (event) => {
        const categoryCheckbox = event.target.closest('input.category-checkbox');
        if (!categoryCheckbox) return false;
        handleCategoryToggle(categoryCheckbox.dataset.category, categoryCheckbox.dataset.state);
        return true;
    };

    elements.categoriesGrid?.addEventListener('click', (event) => {
        if (handleCategoryCheckboxClick(event)) return;
        if (event.target.closest('.my-keywords-manage')) {
            handleMyKeywordsModalToggle();
        }
    });

    elements.categoryList?.addEventListener('click', (event) => {
        if (handleCategoryCheckboxClick(event)) return;
        const link = event.target.closest('a.category-name');
        if (link) {
            // Same as the old inline handler: smooth-scroll layered on the
            // default hash navigation, and no-op if the section is filtered out
            const target = document.getElementById(link.getAttribute('href').slice(1));
            target?.scrollIntoView?.({ behavior: 'smooth' });
        }
    });

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        applyAppearanceSettings();
    });

    // Handle visibility change to restore state when page becomes visible
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && state.did) {
            // loadState also re-syncs the projected My Keywords category, so
            // edits made in another tab are picked up here
            const before = serializeState();
            loadState();

            // Refocus happens constantly; a full re-render costs a rebuild of
            // the whole grid plus the user's focus and text selection, so
            // only pay for it when another tab actually changed the state
            if (serializeState() === before) return;

            // switchMode re-applies mode visibility and ends with
            // renderInterface, so it is the single render on this path
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
