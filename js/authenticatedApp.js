import '../css/app-entry.css';
import './components/app-components.js';

import { init } from './initialization.js';
import { setupEventListeners } from './events.js';
import { refreshElements } from './dom.js';
import { handleAuth } from './handlers/authHandlers.js';
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

let startPromise = null;

export function startAuthenticatedApp() {
    if (!startPromise) {
        startPromise = start();
    }
    return startPromise;
}

async function start() {
    // App components have upgraded their existing elements at this point.
    refreshElements();

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

    // The landing bootstrap owns the form listeners. After logout it delegates
    // back to the full state-preserving handler through this bridge.
    window.muteskyAuthenticatedAuth = { handleAuth };

    await init();
    setupEventListeners();
}