import { loadAppearanceSettings, saveAppearanceSettings } from '../../settings/appearanceSettings.js';

export function setupAppearanceHandlers() {
    // Load current settings from localStorage
    const settings = loadAppearanceSettings();

    // Set initial active states
    this.querySelector(`.theme-mode-switch[data-theme="${settings.colorMode}"]`)?.classList.add('active');
    this.querySelector(`.font-switch[data-font="${settings.font}"]`)?.classList.add('active');
    this.querySelector(`.font-switch[data-size="${settings.fontSize}"]`)?.classList.add('active');

    // Theme buttons
    this.querySelectorAll('.theme-mode-switch[data-theme]').forEach(button => {
        button.addEventListener('click', () => {
            this.querySelectorAll('.theme-mode-switch[data-theme]').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            settings.colorMode = button.dataset.theme;
            saveAppearanceSettings(settings);
        });
    });

    // Font buttons
    this.querySelectorAll('.font-switch[data-font]').forEach(button => {
        button.addEventListener('click', () => {
            this.querySelectorAll('.font-switch[data-font]').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            settings.font = button.dataset.font;
            saveAppearanceSettings(settings);
        });
    });

    // Font size buttons
    this.querySelectorAll('.font-switch[data-size]').forEach(button => {
        button.addEventListener('click', () => {
            this.querySelectorAll('.font-switch[data-size]').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            settings.fontSize = button.dataset.size;
            saveAppearanceSettings(settings);
        });
    });
}
