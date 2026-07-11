import {
    updateBlueskyUI,
    updateEnableDisableButtons,
    updateLastUpdate,
    updateStatusCounts,
    updateMuteButton
} from './uiRenderer.js';
import { renderContextCards, renderExceptions } from './contextRenderer.js';
import { state } from '../state.js';
import { updateModeToggles } from '../handlers/uiHandlers.js';
import { loadAdvancedMode } from '../advancedModeLoader.js';

export async function renderInterface() {
    updateBlueskyUI();

    if (state.mode === 'simple') {
        renderContextCards();
        renderExceptions();
    } else {
        const advanced = await loadAdvancedMode();
        advanced.renderAdvancedMode();
        advanced.renderCategoryList();
    }

    updateModeToggles();
    updateStatusCounts();
    updateMuteButton();
    updateEnableDisableButtons();
    updateLastUpdate();
}