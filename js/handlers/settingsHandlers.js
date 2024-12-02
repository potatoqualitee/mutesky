// Re-export all settings-related functionality from their new modules
import { loadMuteSettings, saveMuteSettings, getExpirationDate } from '../settings/muteSettings.js';
import { loadAppearanceSettings, saveAppearanceSettings, applyAppearanceSettings } from '../settings/appearanceSettings.js';
import { handleSettingsModalToggle } from './modalHandlers.js';
import { handleFooterThemeToggle } from './themeHandlers.js';
import { initializeSettings } from '../settings/init.js';

// Expose handlers to window for HTML onclick handlers
if (typeof window !== 'undefined') {
    window.settingsHandlers = {
        handleSettingsModalToggle,
        handleFooterThemeToggle,
        saveAppearanceSettings,
        saveMuteSettings
    };
}

// Export for module usage
export {
    loadMuteSettings,
    saveMuteSettings,
    getExpirationDate,
    loadAppearanceSettings,
    saveAppearanceSettings,
    applyAppearanceSettings,
    handleSettingsModalToggle,
    handleFooterThemeToggle,
    initializeSettings
};
