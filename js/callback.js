class CallbackHandler {
    constructor() {
        console.debug('[Callback] Initializing callback handler...');
        this.container = document.querySelector('.callback-container');
        this.errorElement = document.getElementById('error');
        this.titleElement = document.querySelector('h2');
        this.statusElement = document.querySelector('.status-text');
        this.homeLink = document.querySelector('.home-link');

        // Hide the home link initially
        if (this.homeLink) {
            this.homeLink.style.display = 'none';
        }
    }

    init() {
        console.debug('[Callback] Starting callback processing...');
        this.showLoading();

        // Listen for auth completion
        window.addEventListener('mutesky:auth:complete', (event) => {
            const { success } = event.detail || {};
            if (success) {
                this.showKeywordLoading();
            } else {
                // Show error and manual return link on failure
                this.showError('Authentication failed. Please try again.');
                if (this.homeLink) {
                    this.homeLink.style.display = 'block';
                }
            }
        });

        // Listen for setup completion
        window.addEventListener('mutesky:setup:complete', () => {
            // Redirect back to app
            window.location.href = '/';
        });
    }

    showLoading() {
        console.debug('[Callback] Processing auth callback...');
        this.titleElement.textContent = 'Authentication Successful';
        this.statusElement.textContent = 'Verifying credentials';
    }

    showKeywordLoading() {
        console.debug('[Callback] Showing keyword loading state');
        this.titleElement.textContent = 'Loading Keywords';
        this.statusElement.textContent = 'This may take a moment';
    }

    showError(message) {
        console.debug('[Callback] Showing error:', message);
        this.container.classList.add('error');
        this.titleElement.textContent = 'Authentication Failed';
        this.errorElement.textContent = message;
    }
}

// Initialize when page loads
window.addEventListener('load', () => {
    console.debug('[Callback] Page loaded, initializing handler...');
    const handler = new CallbackHandler();
    handler.init();
});
