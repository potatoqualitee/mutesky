import { elements } from '../dom.js';
import { state, saveState } from '../state.js';
import { renderInterface } from '../renderer.js';
import { refreshAllData } from '../api.js';
import { updateSimpleModeState } from './contextHandlers.js';
import { updateStatusCounts, updateMuteButton, updateEnableDisableButtons, updateLastUpdate } from '../renderers/uiRenderer.js';

// Single source of truth for mode management
export function switchMode(mode) {
    if (mode !== 'simple' && mode !== 'advanced') {
        mode = 'simple'; // Default to simple mode if invalid
    }

    // Update state
    state.mode = mode;
    saveState();

    // Update ONLY interface mode toggles (not theme mode switches)
    // Use the specific interface-mode-switch class
    document.querySelectorAll('.interface-mode-switch').forEach(toggle => {
        toggle.classList.toggle('active', toggle.dataset.mode === mode);
    });

    // Update mode visibility
    const simpleMode = document.getElementById('simple-mode');
    const advancedMode = document.getElementById('advanced-mode');
    if (simpleMode) simpleMode.classList.toggle('hidden', mode !== 'simple');
    if (advancedMode) advancedMode.classList.toggle('hidden', mode !== 'advanced');

    // Always update simple mode state when switching modes
    // This ensures state is properly initialized regardless of which mode we're switching to
    updateSimpleModeState();

    // Update interface
    renderInterface();
}

export async function handleRefreshData() {
    const refreshButton = document.getElementById('refresh-data');
    if (!refreshButton) return;

    try {
        // Add spinning animation class
        refreshButton.classList.add('spinning');
        refreshButton.textContent = '↻ Refreshing...';
        refreshButton.disabled = true;

        await refreshAllData();

        // Instead of full renderInterface, do targeted updates
        // Update checkbox states without full redraw
        document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            if (checkbox.hasAttribute('onchange')) {
                const keyword = checkbox.parentElement.textContent.trim();
                checkbox.checked = state.activeKeywords.has(keyword);
            }
        });

        // Update counts and status
        updateStatusCounts();
        updateMuteButton();
        updateEnableDisableButtons();
        updateLastUpdate();

        // Show success state briefly
        refreshButton.classList.remove('spinning');
        refreshButton.textContent = '✓  Updated!';

        // Reset button after a delay
        setTimeout(() => {
            refreshButton.textContent = 'Refresh Data';
            refreshButton.disabled = false;
        }, 1000);

    } catch (error) {
        console.error('Failed to refresh data:', error);
        refreshButton.classList.remove('spinning');
        refreshButton.textContent = '✗ Refresh Failed';

        // Reset button after a delay
        setTimeout(() => {
            refreshButton.textContent = '↻ Refresh Data';
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
