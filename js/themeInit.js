// Early theme initialization to prevent flash
(function() {
    try {
        const html = document.documentElement;
        let theme = 'light';

        // Try to load saved settings
        const savedSettings = localStorage.getItem('appearanceSettings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

            if (settings.colorMode === 'system') {
                theme = prefersDark ? 'dark' : 'light';
            } else if (settings.colorMode === 'dark') {
                theme = 'dark';
            }
        } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            theme = 'dark';
        }

        // Apply theme immediately
        html.setAttribute('data-theme', theme);

        // Show content only after theme is set
        window.addEventListener('DOMContentLoaded', () => {
            document.body.classList.add('js-loaded');

            // Set initial footer toggle state
            const footerToggle = document.getElementById('footer-theme-toggle');
            if (footerToggle) {
                footerToggle.classList.toggle('dark', theme === 'dark');
            }
        });

        // Listen for theme changes from system
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            const currentSettings = localStorage.getItem('appearanceSettings');
            if (currentSettings) {
                const settings = JSON.parse(currentSettings);
                if (settings.colorMode === 'system') {
                    const newTheme = e.matches ? 'dark' : 'light';
                    html.setAttribute('data-theme', newTheme);

                    // Update footer toggle
                    const footerToggle = document.getElementById('footer-theme-toggle');
                    if (footerToggle) {
                        footerToggle.classList.toggle('dark', e.matches);
                    }
                }
            }
        });

        // Listen for storage changes (theme updates from other tabs)
        window.addEventListener('storage', (e) => {
            if (e.key === 'appearanceSettings' && e.newValue) {
                const settings = JSON.parse(e.newValue);
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                let newTheme = 'light';

                if (settings.colorMode === 'system') {
                    newTheme = prefersDark ? 'dark' : 'light';
                } else if (settings.colorMode === 'dark') {
                    newTheme = 'dark';
                }

                html.setAttribute('data-theme', newTheme);

                // Update footer toggle
                const footerToggle = document.getElementById('footer-theme-toggle');
                if (footerToggle) {
                    footerToggle.classList.toggle('dark', newTheme === 'dark');
                }
            }
        });
    } catch (error) {
        console.error('Error in early theme initialization:', error);
        // Fallback to light theme if something goes wrong
        document.documentElement.setAttribute('data-theme', 'light');
    }
})();
