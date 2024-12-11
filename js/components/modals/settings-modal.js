import { updateWarningVisibility } from '../../handlers/modalHandlers.js';
import { loadAppearanceSettings, saveAppearanceSettings } from '../../settings/appearanceSettings.js';
import { settingsTemplate } from './settings-template.js';
import { setupAppearanceHandlers } from './settings-appearance.js';
import { setupTabHandlers } from './settings-tabs.js';

class SettingsModal extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.innerHTML = settingsTemplate;

        // Add tab switching functionality
        setupTabHandlers.call(this);
        // Add appearance settings handlers
        setupAppearanceHandlers.call(this);
    }
}

customElements.define('settings-modal', SettingsModal);

export { SettingsModal };
