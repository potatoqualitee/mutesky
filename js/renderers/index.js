import { updateBlueskyUI, updateEnableDisableButtons, updateLastUpdate, updateStatusCounts, updateMuteButton } from './uiRenderer.js';
import { renderContextCards, renderExceptions } from './contextRenderer.js';
import { renderAdvancedMode, renderCategoryList } from './categoryRenderer.js';
import { state } from '../state.js';

// Import the updateModeToggles function from uiHandlers
import { updateModeToggles } from '../handlers/uiHandlers.js';

export function renderInterface() {
    // Update Bluesky-specific UI elements
    updateBlueskyUI();

    if (state.mode === 'simple') {
        renderContextCards();
        renderExceptions();
    } else {
        renderAdvancedMode();
        renderCategoryList();
    }

    // Ensure mode toggles always reflect current state
    updateModeToggles();

    updateStatusCounts();
    updateMuteButton();
    updateEnableDisableButtons();
    updateLastUpdate();
}
