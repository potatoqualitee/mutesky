// Define and upgrade the Web Components inside the same module graph as the
// application. This replaces the separate native-ESM import from index.html.
import './components/index.js';
import { init } from './initialization.js';
import { setupEventListeners } from './events.js';
import { refreshElements } from './dom.js';
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
    // connectedCallback() has now rendered the component-owned controls.
    // Refresh the shared lookup before initialization or listener setup.
    refreshElements();
    await init();
    setupEventListeners();
});
