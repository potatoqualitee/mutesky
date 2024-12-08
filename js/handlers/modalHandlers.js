import { loadMuteSettings, saveMuteSettings } from '../settings/muteSettings.js';
import { loadAppearanceSettings, saveAppearanceSettings, updateAppearanceUI } from '../settings/appearanceSettings.js';
import { getStorageKey } from '../state.js';

export function updateWarningVisibility() {
    const duration = document.querySelector('input[name="duration"]:checked')?.value;
    const warningElement = document.getElementById('settings-warning');
    if (duration) {
        warningElement.classList.toggle('visible', duration !== 'forever');
    }
}

function setupMuteSettingsListeners() {
    // Duration radio buttons
    document.querySelectorAll('input[name="duration"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const settings = {
                duration: document.querySelector('input[name="duration"]:checked').value,
                scope: document.querySelector('input[name="scope"]:checked').value,
                excludeFollows: document.getElementById('exclude-follows').checked
            };
            saveMuteSettings(settings);
            updateWarningVisibility();
        });
    });

    // Scope radio buttons
    document.querySelectorAll('input[name="scope"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const settings = {
                duration: document.querySelector('input[name="duration"]:checked').value,
                scope: document.querySelector('input[name="scope"]:checked').value,
                excludeFollows: document.getElementById('exclude-follows').checked
            };
            saveMuteSettings(settings);
        });
    });

    // Exclude follows checkbox
    const excludeFollows = document.getElementById('exclude-follows');
    excludeFollows.addEventListener('change', () => {
        const settings = {
            duration: document.querySelector('input[name="duration"]:checked').value,
            scope: document.querySelector('input[name="scope"]:checked').value,
            excludeFollows: excludeFollows.checked
        };
        saveMuteSettings(settings);
    });
}

function setupAppearanceSettingsListeners() {
    // Theme mode switches
    document.querySelectorAll('.theme-mode-switch').forEach(btn => {
        btn.addEventListener('click', () => {
            const settings = window.appearanceSettings || loadAppearanceSettings();
            settings.colorMode = btn.dataset.theme;
            saveAppearanceSettings(settings);
        });
    });

    // Font switches
    document.querySelectorAll('.font-switch[data-font]').forEach(btn => {
        btn.addEventListener('click', () => {
            const settings = window.appearanceSettings || loadAppearanceSettings();
            settings.font = btn.dataset.font;
            saveAppearanceSettings(settings);
        });
    });

    // Font size switches
    document.querySelectorAll('.font-switch[data-size]').forEach(btn => {
        btn.addEventListener('click', () => {
            const settings = window.appearanceSettings || loadAppearanceSettings();
            settings.fontSize = btn.dataset.size;
            saveAppearanceSettings(settings);
        });
    });
}

export function handleSettingsModalToggle() {
    const modal = document.getElementById('settings-modal');
    modal.classList.toggle('visible');

    if (modal.classList.contains('visible')) {
        // Load mute settings
        const muteSettings = loadMuteSettings();
        document.querySelector(`input[name="duration"][value="${muteSettings.duration}"]`).checked = true;
        document.querySelector(`input[name="scope"][value="${muteSettings.scope}"]`).checked = true;
        document.getElementById('exclude-follows').checked = muteSettings.excludeFollows;

        // Load appearance settings
        const appearanceSettings = loadAppearanceSettings();
        updateAppearanceUI(appearanceSettings);
        window.appearanceSettings = appearanceSettings;

        // Setup all change listeners
        setupMuteSettingsListeners();
        setupAppearanceSettingsListeners();
        updateWarningVisibility();
    } else {
        // When modal is closed, use the centralized switchMode function
        // to ensure consistent state management
        const savedState = localStorage.getItem(getStorageKey());
        const currentMode = savedState ? JSON.parse(savedState).mode || 'simple' : 'simple';
        window.switchMode(currentMode);
    }
}
