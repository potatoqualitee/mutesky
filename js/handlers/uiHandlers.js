import { elements } from '../dom.js';
import { state, saveState } from '../state.js';
import { renderInterface } from '../renderer.js';
import { refreshAllData } from '../api.js';
import { updateSimpleModeState } from './contextHandlers.js';
import { updateStatusCounts, updateMuteButton, updateEnableDisableButtons, updateLastUpdate } from '../renderers/uiRenderer.js';
import { isKeywordActive } from './keywordHandlers.js';

// Function to ensure mode toggles always reflect current state
export function updateModeToggles() {
    document.querySelectorAll('.interface-mode-switch').forEach(toggle => {
        toggle.classList.toggle('active', toggle.dataset.mode === state.mode);
    });
}

// Single source of truth for mode management
export function switchMode(mode) {
    if (mode !== 'simple' && mode !== 'advanced') {
        mode = 'simple'; // Default to simple mode if invalid
    }

    // Update state
    const previousMode = state.mode;
    state.mode = mode;

    // Ensure mode toggles reflect current state
    updateModeToggles();

    // Update mode visibility
    const simpleMode = document.getElementById('simple-mode');
    const advancedMode = document.getElementById('advanced-mode');
    if (simpleMode) simpleMode.classList.toggle('hidden', mode !== 'simple');
    if (advancedMode) advancedMode.classList.toggle('hidden', mode !== 'advanced');

    // Only update state when switching TO simple mode
    // This ensures contexts drive keyword selection in simple mode
    // But allows direct keyword selection in advanced mode
    if (mode === 'simple' && previousMode === 'advanced') {
        updateSimpleModeState();
    }

    // Always save state and update interface
    saveState();
    renderInterface();
}

export async function handleRefreshData() {
    const refreshButton = document.getElementById('refresh-data');
    if (!refreshButton) return;

    // Store the original SVG content
    const svgIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
    </svg>`;

    const updateButtonContent = (svg, text) => {
        refreshButton.innerHTML = `${svg}<span>${text}</span>`;
    };

    try {
        // Add spinning animation class
        refreshButton.classList.add('spinning');
        updateButtonContent(svgIcon, 'Refreshing...');
        refreshButton.disabled = true;

        await refreshAllData();

        // Instead of full renderInterface, do targeted updates
        // Update checkbox states without full redraw
        document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            if (checkbox.hasAttribute('onchange')) {
                const keyword = checkbox.parentElement.textContent.trim();
                checkbox.checked = isKeywordActive(keyword);
            }
        });

        // Update counts and status
        updateStatusCounts();
        updateMuteButton();
        updateEnableDisableButtons();
        updateLastUpdate();
        // Ensure mode toggles stay in sync
        updateModeToggles();

        // Show success state briefly
        refreshButton.classList.remove('spinning');
        updateButtonContent(svgIcon, 'Updated!');

        // Reset button after a delay
        setTimeout(() => {
            updateButtonContent(svgIcon, 'Refresh Data');
            refreshButton.disabled = false;
        }, 1000);

    } catch (error) {
        console.error('Failed to refresh data:', error);
        refreshButton.classList.remove('spinning');
        updateButtonContent(svgIcon, 'Refresh Failed');

        // Reset button after a delay
        setTimeout(() => {
            updateButtonContent(svgIcon, 'Refresh Data');
            refreshButton.disabled = false;
        }, 2000);
    }
}

export function showApp() {
    elements.landingPage.classList.add('hidden');
    elements.appInterface.classList.remove('hidden');

    // Ensure mode is set properly when showing app
    switchMode(state.mode);
}

// Expose refreshData function to window object for use in settings modal
window.refreshData = handleRefreshData;
