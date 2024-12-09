import { ImageHandler } from './image-handler.js';
import { AuthHandler } from './auth-handler.js';
import { landingPageTemplate } from './template.js';

class LandingPage extends HTMLElement {
    constructor() {
        super();
        this.imageHandler = new ImageHandler();
        this.themeObserver = null;
    }

    connectedCallback() {
        this.innerHTML = landingPageTemplate;

        // Initialize theme-aware images after component is mounted
        this.imageHandler.initThemeAwareImages(this);

        // Listen for theme changes
        this.themeObserver = (event) => this.imageHandler.updateThemeAwareImages(this, event?.detail?.theme);
        document.addEventListener('themeChanged', this.themeObserver);

        // Check for auth errors after component is mounted
        AuthHandler.checkAuthErrors();
    }

    disconnectedCallback() {
        // Clean up event listeners and cache
        if (this.themeObserver) {
            document.removeEventListener('themeChanged', this.themeObserver);
        }
        this.imageHandler.cleanup();
    }
}

customElements.define('landing-page', LandingPage);

export default LandingPage;
