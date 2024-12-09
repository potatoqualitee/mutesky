import { loadAppearanceSettings, saveAppearanceSettings } from '../settings/appearanceSettings.js';

export function handleFooterThemeToggle() {
    const settings = loadAppearanceSettings();
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');

    // Toggle between light and dark themes
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    settings.colorMode = newTheme;

    // Save and apply the new settings
    saveAppearanceSettings(settings);

    // Apply theme immediately
    html.setAttribute('data-theme', newTheme);

    // Update all theme toggles
    const toggles = document.querySelectorAll('.theme-toggle');
    toggles.forEach(toggle => {
        toggle.classList.toggle('dark', newTheme === 'dark');
    });

    // Dispatch theme change event
    document.dispatchEvent(new CustomEvent('themeChanged', {
        detail: { theme: newTheme }
    }));
}

// Initialize theme on page load
document.addEventListener('DOMContentLoaded', () => {
    const settings = loadAppearanceSettings();
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = settings.colorMode === 'dark' || (settings.colorMode === 'system' && prefersDark) ? 'dark' : 'light';

    document.documentElement.setAttribute('data-theme', theme);

    // Update toggle states
    const toggles = document.querySelectorAll('.theme-toggle');
    toggles.forEach(toggle => {
        toggle.classList.toggle('dark', theme === 'dark');
    });
});

// Add system theme change listener
const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
systemThemeQuery.addEventListener('change', (e) => {
    const settings = loadAppearanceSettings();
    if (settings.colorMode === 'system') {
        const theme = e.matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);

        // Update toggle states
        const toggles = document.querySelectorAll('.theme-toggle');
        toggles.forEach(toggle => {
            toggle.classList.toggle('dark', theme === 'dark');
        });

        // Dispatch theme change event
        document.dispatchEvent(new CustomEvent('themeChanged', {
            detail: { theme }
        }));
    }
});
