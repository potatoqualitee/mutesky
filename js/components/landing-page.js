class LandingPage extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.innerHTML = `
            <div class="split-layout">
                <!-- Left Section - Branding -->
                <section class="branding-section">
                    <div class="branding-content">
                        <div class="logo"><img src="images/logo.png" alt="Mutesky Cloud Logo"></div>
                        <h1>Mutesky</h1>
                        <p class="tagline">Bulk manage Bluesky mutes with <br/>pre-populated keyword lists</p>
                    </div>
                </section>

                <!-- Right Section - Features & Auth -->
                <section class="content-section">
                    <div class="content-wrapper">
                        <!-- Features Grid -->
                        <div class="feature-grid">
                            <div class="landing-feature-card">
                                <span class="feature-icon">✨</span>
                                <div class="feature-text">
                                    <h3>1,400+ Keywords</h3>
                                    <p>Continuously updated by AI to reflect current events</p>
                                </div>
                            </div>
                            <div class="landing-feature-card">
                                <span class="feature-icon">🎯</span>
                                <div class="feature-text">
                                    <h3>20+ Categories</h3>
                                    <p>From politics to climate, choose what you want to see</p>
                                </div>
                            </div>
                            <div class="landing-feature-card">
                                <span class="feature-icon">🎚️</span>
                                <div class="feature-text">
                                    <h3>Easy Management</h3>
                                    <p>Simple toggles or advanced keyword controls</p>
                                </div>
                            </div>
                            <div class="landing-feature-card">
                                <span class="feature-icon">⚡</span>
                                <div class="feature-text">
                                    <h3>Instant Updates</h3>
                                    <p>Changes take effect immediately on your feed</p>
                                </div>
                            </div>
                        </div>

                        <!-- Auth Section -->
                        <div class="bsky-connect">
                            <h2 class="sign-in-title">Sign in</h2>

                            <div class="bsky-auth-container">
                                <div class="auth-section">
                                    <div id="bsky-auth-message" class="bsky-auth-message">The next page will prompt for your username and Bluesky account password, not your app password. Your credentials are securely handled by Bluesky's official authentication service.</div>
                                    <div class="input-wrapper">
                                        <input type="text"
                                               id="bsky-handle-input"
                                               class="bsky-handle-input"
                                               placeholder="username.bsky.social"
                                               spellcheck="false"
                                               autocomplete="off">
                                    </div>
                                </div>

                                <div class="auth-section">
                                    <button id="bsky-login-btn" class="btn-auth">Connect to Bluesky</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        `;

        // Check for auth errors after component is mounted
        this.checkAuthErrors();
    }

    checkAuthErrors() {
        const error = sessionStorage.getItem('auth_error');
        const errorDescription = sessionStorage.getItem('auth_error_description');

        if (error) {
            const messageEl = document.getElementById('bsky-auth-message');
            const errorText = errorDescription || error;

            messageEl.innerHTML = `
                <div class="auth-error">
                    Authentication failed: ${errorText}
                    <br>
                    Please try again.
                </div>
            `;
            messageEl.classList.add('error');

            // Clear error state
            sessionStorage.removeItem('auth_error');
            sessionStorage.removeItem('auth_error_description');
        }
    }
}

customElements.define('landing-page', LandingPage);

export default LandingPage;
