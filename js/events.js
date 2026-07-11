import { elements } from './dom.js';
import { state, loadState, saveState, serializeState } from './state.js';
import { renderInterface } from './renderer.js';
import { debounce } from './utils.js';
import { applyFilterLevel } from './handlers/context/selectionModel.js';
import { blueskyService } from './bluesky.js';
import {
    handleLogout,
    handleMuteSubmit,
    handleMyKeywordsModalToggle,
    switchMode,
    handleRefreshData,
    showApp,
    initializeKeywordState,
    applyAppearanceSettings
} from './handlers/index.js';
import { loadAdvancedMode } from './advancedModeLoader.js';

// Event Listeners
export function setupEventListeners() {
    elements.logoutButton?.addEventListener('click', handleLogout);
    elements.muteButton?.addEventListener('click', handleMuteSubmit);
    elements.navMuteButton?.addEventListener('click', handleMuteSubmit);
    elements.refreshButton?.addEventListener('click', handleRefreshData);


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

    const handleSidebarSearch = debounce(event => {
        state.searchTerm = event.target.value.toLowerCase();
        renderInterface();
    }, 300);

    // Advanced Mode is defined after this listener setup, so delegate from the
    // document and load its renderer/handlers only when those controls exist.
    document.addEventListener('input', event => {
        if (event.target.matches('#sidebar-search')) {
            handleSidebarSearch(event);
        }
    });

    document.addEventListener('change', async event => {
        const keywordCheckbox = event.target.closest('#categories-grid input[data-keyword]');
        if (!keywordCheckbox) return;

        const advanced = await loadAdvancedMode();
        advanced.handleKeywordToggle(
            keywordCheckbox.dataset.keyword,
            keywordCheckbox.checked
        );
    });

    document.addEventListener('click', async event => {
        const bulkButton = event.target.closest('#enable-all, #disable-all');
        if (bulkButton) {
            const advanced = await loadAdvancedMode();
            if (bulkButton.id === 'enable-all') {
                advanced.handleEnableAll();
            } else {
                advanced.handleDisableAll();
            }
            return;
        }

        // Read dataset.state, the render-time state, rather than the checked
        // property the browser has already flipped.
        const categoryCheckbox = event.target.closest(
            '#categories-grid input.category-checkbox, #category-list input.category-checkbox'
        );
        if (categoryCheckbox) {
            const advanced = await loadAdvancedMode();
            advanced.handleCategoryToggle(
                categoryCheckbox.dataset.category,
                categoryCheckbox.dataset.state
            );
            return;
        }

        if (event.target.closest('#categories-grid .my-keywords-manage')) {
            handleMyKeywordsModalToggle();
            return;
        }

        const link = event.target.closest('#category-list a.category-name');
        if (link) {
            const target = document.getElementById(link.getAttribute('href').slice(1));
            target?.scrollIntoView?.({ behavior: 'smooth' });
        }
    });

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        applyAppearanceSettings();
    });

    // Handle visibility change to restore state when page becomes visible
    document.addEventListener('visibilitychange', async () => {
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
            await switchMode(state.mode);

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
