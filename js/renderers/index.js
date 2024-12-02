import { updateBlueskyUI, updateEnableDisableButtons, updateLastUpdate, updateStatusCounts, updateMuteButton } from './uiRenderer.js';
import { renderContextCards, renderExceptions } from './contextRenderer.js';
import { renderAdvancedMode, renderCategoryList } from './categoryRenderer.js';
import { state } from '../state.js';

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

    updateStatusCounts();
    updateMuteButton();
    updateEnableDisableButtons();
    updateLastUpdate();
}
