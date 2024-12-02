import { applyAppearanceSettings, loadAppearanceSettings, saveAppearanceSettings } from './appearanceSettings.js';
import { handleSettingsModalToggle } from '../handlers/modalHandlers.js';
import { handleFooterThemeToggle } from '../handlers/themeHandlers.js';

export function initializeSettings() {
    // Apply initial appearance settings
    applyAppearanceSettings();

    // Add click handlers for appearance settings
    document.querySelectorAll('.mode-switch[data-theme]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const settings = loadAppearanceSettings();
            settings.colorMode = e.target.dataset.theme;
            saveAppearanceSettings(settings);
        });
    });

    document.querySelectorAll('.font-switch[data-font]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const settings = loadAppearanceSettings();
            settings.font = e.target.dataset.font;
            saveAppearanceSettings(settings);
        });
    });

    document.querySelectorAll('.font-switch[data-size]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const settings = loadAppearanceSettings();
            settings.fontSize = e.target.dataset.size;
            saveAppearanceSettings(settings);
        });
    });

    // Add system theme change listener
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        const settings = loadAppearanceSettings();
        if (settings.colorMode === 'system') {
            applyAppearanceSettings(settings);
        }
    });

    // Add footer theme toggle handler
    document.getElementById('footer-theme-toggle')?.addEventListener('click', handleFooterThemeToggle);
}
