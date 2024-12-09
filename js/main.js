import { init } from './initialization.js';
import { setupEventListeners } from './events.js';
import {
    handleContextToggle,
    handleExceptionToggle,
    handleCategoryToggle,
    handleKeywordToggle,
    handleSettingsModalToggle,
    handleFooterThemeToggle,
    switchMode
} from './handlers/index.js';

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
document.addEventListener('DOMContentLoaded', async () => {
    await init();
    setupEventListeners();
});
