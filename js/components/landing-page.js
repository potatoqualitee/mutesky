class LandingPage extends HTMLElement {
    constructor() {
        super();
        // Store preloaded images
        this.imageCache = new Map();
        // Store theme observer
        this.themeObserver = null;
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

                        <!-- Detailed Features Section -->
                        <div class="detailed-features">
                            <div class="section-intro">
                                <h2>How It Works</h2>
                                <p>Take control of your Bluesky experience with Mutesky's intuitive filtering system</p>
                            </div>

                            <div class="feature-blocks">
                                <div class="feature-block">
                                    <div class="feature-image theme-aware-image" data-light-src="images/screenshots/light-simple-mode.png" data-dark-src="images/screenshots/dark-simple-mode.png"></div>
                                    <div class="feature-description">
                                        <h3>Start with Simple Mode</h3>
                                        <p>Quickly filter content across major topics like politics, healthcare, and global affairs. Choose what you don't want to see with just a few clicks.</p>
                                    </div>
                                </div>

                                <div class="feature-block">
                                    <div class="feature-image theme-aware-image" data-light-src="images/screenshots/light-search.png" data-dark-src="images/screenshots/dark-search.png"></div>
                                    <div class="feature-description">
                                        <h3>Extensive Categories</h3>
                                        <p>Select from over 20 content categories, from climate to international coverage. Each category comes pre-populated with carefully curated keywords, continuously updated to reflect current events.</p>
                                    </div>
                                </div>

                                <div class="feature-block">
                                    <div class="feature-image theme-aware-image" data-light-src="images/screenshots/light-advanced-mode.png" data-dark-src="images/screenshots/dark-advanced-mode.png"></div>
                                    <div class="feature-description">
                                        <h3>Advanced Control</h3>
                                        <p>Need more control? Switch to Advanced Mode for direct access to over 1,400 keywords. Fine-tune your filters with individual toggles or bulk actions.</p>
                                    </div>
                                </div>

                                <div class="feature-block">
                                    <div class="feature-description">
                                        <h3>Perfect Balance</h3>
                                        <p>Choose your perfect balance with four filtering levels:</p>
                                        <ul>
                                            <li>Minimal for light touch filtering</li>
                                            <li>Moderate for balanced content management</li>
                                            <li>Extensive for comprehensive filtering</li>
                                            <li>Complete for maximum control</li>
                                        </ul>
                                        <p>Changes take effect instantly on your feed, and you can adjust your settings anytime.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Built by Section -->
                        <div class="built-by-section">
                            <div class="built-by-content">
                                <p>Made with 🤖 and <a href="https://github.com/sponsors/potatoqualitee" target="_blank"><img src="images/sponsor.svg" alt="Sponsor on GitHub" style="vertical-align: middle; height: 1em;"></a> by <a href="https://bsky.app/profile/funbucket.dev" target="_blank">Chrissy LeMaire</a></p>
                                <button class="theme-toggle" id="landing-theme-toggle" onclick="window.settingsHandlers.handleFooterThemeToggle()">
                                    <span class="toggle-icon sun-icon">☀️</span>
                                    <span class="toggle-icon moon-icon">🌙</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        `;

        // Initialize theme-aware images after component is mounted
        this.initThemeAwareImages();

        // Listen for theme changes
        this.themeObserver = (event) => this.updateThemeAwareImages(event?.detail?.theme);
        document.addEventListener('themeChanged', this.themeObserver);

        // Check for auth errors after component is mounted
        this.checkAuthErrors();
    }

    disconnectedCallback() {
        // Clean up event listeners and cache
        if (this.themeObserver) {
            document.removeEventListener('themeChanged', this.themeObserver);
        }
        this.imageCache.clear();
    }

    async initThemeAwareImages() {
        const images = this.querySelectorAll('.theme-aware-image');
        const preloadPromises = [];

        // Preload all images
        images.forEach(img => {
            const lightSrc = img.dataset.lightSrc;
            const darkSrc = img.dataset.darkSrc;

            if (lightSrc && !this.imageCache.has(lightSrc)) {
                preloadPromises.push(this.preloadImage(lightSrc));
            }
            if (darkSrc && !this.imageCache.has(darkSrc)) {
                preloadPromises.push(this.preloadImage(darkSrc));
            }
        });

        try {
            await Promise.all(preloadPromises);
            this.updateThemeAwareImages();
        } catch (error) {
            console.error('Error preloading images:', error);
        }
    }

    async preloadImage(src) {
        if (!src || this.imageCache.has(src)) return;

        try {
            const img = new Image();
            const loadPromise = new Promise((resolve, reject) => {
                img.onload = () => resolve(src);
                img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
            });

            img.src = src;
            await loadPromise;
            this.imageCache.set(src, true);
        } catch (error) {
            console.error(`Error preloading image ${src}:`, error);
            // Cache the failure to avoid repeated attempts
            this.imageCache.set(src, false);
        }
    }

    updateThemeAwareImages(theme = null) {
        if (!theme) {
            theme = document.documentElement.getAttribute('data-theme');
        }
        const isDarkMode = theme === 'dark';

        requestAnimationFrame(() => {
            this.querySelectorAll('.theme-aware-image').forEach(async (img) => {
                const src = isDarkMode ? img.dataset.darkSrc : img.dataset.lightSrc;

                // Skip if image hasn't been preloaded or failed to preload
                if (!this.imageCache.has(src)) {
                    await this.preloadImage(src);
                }

                if (this.imageCache.get(src)) {
                    img.style.backgroundImage = `url('${src}')`;
                } else {
                    // Use fallback image or add error class
                    img.classList.add('image-load-error');
                }
            });
        });
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
