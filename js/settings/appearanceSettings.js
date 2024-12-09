const DEFAULT_APPEARANCE = {
    colorMode: 'system',
    font: 'system',
    fontSize: 'default'
};

const FONT_SCALES = {
    'smaller': 0.867,  // 13px equivalent
    'default': 1,      // 15px base
    'larger': 1.133    // 17px equivalent
};

export function loadAppearanceSettings() {
    try {
        const saved = localStorage.getItem('appearanceSettings');
        if (saved) {
            const settings = JSON.parse(saved);
            return { ...DEFAULT_APPEARANCE, ...settings };
        }
    } catch (error) {
        console.error('Error loading appearance settings:', error);
    }
    return { ...DEFAULT_APPEARANCE };
}

export function saveAppearanceSettings(settings) {
    try {
        const newSettings = {
            ...DEFAULT_APPEARANCE,
            ...settings
        };
        localStorage.setItem('appearanceSettings', JSON.stringify(newSettings));
        applyAppearanceSettings(newSettings);
    } catch (error) {
        console.error('Error saving appearance settings:', error);
    }
}

export function applyAppearanceSettings(settings = null) {
    if (!settings) {
        settings = loadAppearanceSettings();
    }

    const html = document.documentElement;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Apply theme
    const theme = settings.colorMode === 'dark' || (settings.colorMode === 'system' && prefersDark) ? 'dark' : 'light';

    // Apply theme immediately
    html.setAttribute('data-theme', theme);

    // Update footer toggle state
    const footerToggle = document.getElementById('footer-theme-toggle');
    if (footerToggle) {
        footerToggle.classList.toggle('dark', theme === 'dark');
    }

    // Update landing page toggle state
    const landingToggle = document.getElementById('landing-theme-toggle');
    if (landingToggle) {
        landingToggle.classList.toggle('dark', theme === 'dark');
    }

    // Apply font settings
    html.style.fontFamily = settings.font === 'theme'
        ? 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
        : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

    // Apply font scale using CSS variable
    html.style.setProperty('--font-scale', FONT_SCALES[settings.fontSize]);

    // Dispatch theme change event
    document.dispatchEvent(new CustomEvent('themeChanged', {
        detail: { theme }
    }));

    updateAppearanceUI(settings);
}

export function updateAppearanceUI(settings) {
    requestAnimationFrame(() => {
        document.querySelectorAll('.mode-switch, .theme-switch, .font-switch').forEach(btn => {
            btn.classList.remove('active');
        });

        document.querySelector(`.mode-switch[data-theme="${settings.colorMode}"]`)?.classList.add('active');
        document.querySelector(`.font-switch[data-font="${settings.font}"]`)?.classList.add('active');
        document.querySelector(`.font-switch[data-size="${settings.fontSize}"]`)?.classList.add('active');
    });
}
