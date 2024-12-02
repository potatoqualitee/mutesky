class TopNav extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.innerHTML = `
            <nav class="top-nav">
                <div class="brand">
                    <h1>😌 Mutesky</h1>
                </div>
                <div class="mode-toggle">
                    <button class="mode-switch interface-mode-switch" data-mode="simple">Simple Mode</button>
                    <button class="mode-switch interface-mode-switch" data-mode="advanced">Advanced Mode</button>
                </div>
                <div class="nav-group">
                    <button class="btn-mute-keywords nav-mute-button hidden">Mute 0 keywords</button>
                    <button class="hamburger-menu">
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>
                    <div class="user-menu">
                        <button class="profile-button">
                            <span class="user-name" id="user-display-name"></span>
                            <div class="profile-pic" id="profile-pic"></div>
                            <span class="profile-tooltip" id="bsky-handle">@username.bsky.social</span>
                        </button>
                        <div class="user-menu-dropdown">
                            <!-- Mobile-only mode switches -->
                            <div class="mobile-mode-switches">
                                <div class="user-menu-item mode-switch-mobile interface-mode-switch" data-mode="simple">
                                    Simple Mode
                                </div>
                                <div class="user-menu-item mode-switch-mobile interface-mode-switch" data-mode="advanced">
                                    Advanced Mode
                                </div>
                            </div>
                            <div class="user-menu-item refresh" id="refresh-data">
                                Refresh Data
                            </div>
                            <div class="user-menu-item" onclick="window.settingsHandlers.handleSettingsModalToggle()">
                                Settings
                            </div>
                            <a class="user-menu-item moderation-link" href="https://bsky.app/moderation" target="_blank">
                                Bluesky Moderation
                            </a>
                            <div class="user-menu-item logout" id="bsky-logout-btn">
                                Logout
                            </div>
                        </div>
                    </div>
                </div>
            </nav>
        `;

        // Add click handler for hamburger menu
        const hamburgerMenu = this.querySelector('.hamburger-menu');
        const userMenu = this.querySelector('.user-menu');

        hamburgerMenu?.addEventListener('click', (e) => {
            e.stopPropagation();
            hamburgerMenu.classList.toggle('active');
            userMenu.classList.toggle('active');
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!userMenu.contains(e.target) && !hamburgerMenu.contains(e.target)) {
                hamburgerMenu?.classList.remove('active');
                userMenu.classList.remove('active');
            }
        });

        // Handle all interface mode switches (both desktop and mobile) with the same logic
        this.querySelectorAll('.interface-mode-switch').forEach(button => {
            button.addEventListener('click', () => {
                const mode = button.dataset.mode;
                // Use the centralized switchMode function
                window.switchMode(mode);
                // Close menu if it's a mobile button
                if (button.classList.contains('mode-switch-mobile')) {
                    hamburgerMenu?.classList.remove('active');
                    userMenu.classList.remove('active');
                }
            });
        });
    }
}

customElements.define('top-nav', TopNav);

export default TopNav;
