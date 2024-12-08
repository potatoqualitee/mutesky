import { loadAppearanceSettings, saveAppearanceSettings } from '../settings/appearanceSettings.js';

export function handleFooterThemeToggle() {
    const settings = loadAppearanceSettings();
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = settings.colorMode === 'dark' || (settings.colorMode === 'system' && prefersDark);
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');

    // Toggle between light and dark
    const newColorMode = currentTheme === 'dim' ? 'light' : 'dark';
    settings.colorMode = newColorMode;

    // Save and apply the new settings
    saveAppearanceSettings(settings);

    // Update footer toggle state
    const toggle = document.getElementById('footer-theme-toggle');
    if (toggle) {
        toggle.classList.toggle('dark', newColorMode === 'dark');
    }
}
