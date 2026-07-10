import { init } from './initialization.js';
import { setupEventListeners } from './events.js';
import {
    handleContextToggle,
    handleExceptionToggle,
    handleSettingsModalToggle,
    handleFooterThemeToggle,
    handleMyKeywordsModalToggle,
    handleMyKeywordsAdd,
    handleMyKeywordsRemove,
    switchMode
} from './handlers/index.js';

// Make handlers available globally for the remaining inline-handler markup
// (context cards, modals, top-nav). The grid/sidebar keyword and category
// toggles moved to delegated listeners in events.js.
window.handleContextToggle = handleContextToggle;
window.handleExceptionToggle = handleExceptionToggle;
window.settingsHandlers = {
    handleSettingsModalToggle,
    handleFooterThemeToggle
};
window.myKeywordsHandlers = {
    handleMyKeywordsModalToggle,
    handleMyKeywordsAdd,
    handleMyKeywordsRemove
};
window.switchMode = switchMode;

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    await init();
    setupEventListeners();
});
