class TopNav extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.innerHTML = `
            <nav class="top-nav">
                <div class="brand">
                    <h1><img src="images/logo.png" alt="Mutesky Cloud Logo" class="nav-logo"> Mutesky</h1>
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
                            <div class="user-menu-header">
                                <div class="user-handle" id="dropdown-handle">@username.bsky.social</div>
                                <div class="total-mutes" id="total-mute-count">0 muted</div>
                            </div>
                            <div class="mobile-mode-switches">
                                <div class="user-menu-item interface-mode-switch" data-mode="simple">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M4 6h16M4 12h16m-7 6h7"/>
                                    </svg>
                                    Simple Mode
                                </div>
                                <div class="user-menu-item interface-mode-switch" data-mode="advanced">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
                                    </svg>
                                    Advanced Mode
                                </div>
                            </div>
                            <div class="user-menu-item" id="refresh-data">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                                </svg>
                                Refresh Data
                            </div>
                            <div class="user-menu-item" onclick="window.settingsHandlers.handleSettingsModalToggle()">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                                    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                </svg>
                                Settings
                            </div>
                            <a class="user-menu-item moderation-link" href="https://bsky.app/moderation" target="_blank">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                                </svg>
                                Bluesky Moderation
                            </a>
                            <div class="user-menu-item logout" id="bsky-logout-btn">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                                </svg>
                                &nbsp;Logout
                            </div>
                        </div>
                    </div>
                </div>
            </nav>
        `;

        // Add click handler for hamburger menu
        const hamburgerMenu = this.querySelector('.hamburger-menu');
        const userMenu = this.querySelector('.user-menu');

        // Handle hamburger menu clicks
        hamburgerMenu?.addEventListener('click', () => {
            const isActive = hamburgerMenu.classList.contains('active');
            if (isActive) {
                hamburgerMenu.classList.remove('active');
                userMenu.classList.remove('active');
            } else {
                hamburgerMenu.classList.add('active');
                userMenu.classList.add('active');
            }
        });

        // Handle clicks outside menu
        document.addEventListener('click', (e) => {
            // Only handle clicks outside both hamburger and menu
            if (e.target !== hamburgerMenu &&
                !hamburgerMenu?.contains(e.target) &&
                e.target !== userMenu &&
                !userMenu?.contains(e.target)) {
                hamburgerMenu?.classList.remove('active');
                userMenu?.classList.remove('active');
            }
        });

        // Handle all interface mode switches (both desktop and mobile) with the same logic
        this.querySelectorAll('.interface-mode-switch').forEach(button => {
            button.addEventListener('click', () => {
                const mode = button.dataset.mode;
                // Use the centralized switchMode function
                window.switchMode(mode);
                // Close menu if it's in the mobile dropdown
                if (button.closest('.mobile-mode-switches')) {
                    hamburgerMenu?.classList.remove('active');
                    userMenu.classList.remove('active');
                }
            });
        });
    }
}

customElements.define('top-nav', TopNav);

export default TopNav;
