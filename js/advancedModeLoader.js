import { refreshElements } from './dom.js';

let advancedModePromise = null;

export function loadAdvancedMode() {
    if (!advancedModePromise) {
        advancedModePromise = import(
            /* webpackChunkName: "advanced-mode" */
            './advanced-entry.js'
        ).then(module => {
            // Defining <advanced-mode> upgrades the element synchronously and
            // connectedCallback() renders its controls.
            refreshElements();
            return module;
        }).catch(error => {
            advancedModePromise = null;
            throw error;
        });
    }

    return advancedModePromise;
}