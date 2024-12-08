class AppFooter extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.innerHTML = `
            <footer class="app-footer">
                <div class="footer-left">
                    <p>Keywords updated: <span id="sidebar-last-update">checking...</span></p>
                </div>
                <div class="footer-center">
                    <p>Made with 🤖 and <a href="https://github.com/sponsors/potatoqualitee" target="_blank"><img src="images/sponsor.svg" alt="Sponsor on GitHub" style="vertical-align: middle; height: 1em;"></a> by <a href="https://bsky.app/profile/funbucket.dev" target="_blank">Chrissy LeMaire</a> </p>
                </div>
                <div class="footer-right">
                    <button class="theme-toggle" id="footer-theme-toggle" onclick="window.settingsHandlers.handleFooterThemeToggle()">
                        <span class="toggle-icon sun-icon">☀️</span>
                        <span class="toggle-icon moon-icon">🌙</span>
                    </button>
                </div>
            </footer>
        `;
    }
}

customElements.define('app-footer', AppFooter);

export default AppFooter;
