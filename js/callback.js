class CallbackHandler {
    constructor() {
        this.container = document.querySelector('.callback-container');
        this.errorElement = document.getElementById('error');
        this.titleElement = document.querySelector('h2');
        this.redirectTimeout = null;
        this.initialized = false;
        this.hasError = false;
        this.errorMessage = '';
    }

    init() {
        // Clear any existing redirect timeout
        if (this.redirectTimeout) {
            clearTimeout(this.redirectTimeout);
        }

        // Listen for console errors to detect auth failures
        const originalError = console.error;
        console.error = (...args) => {
            const errorMessage = args.join(' ');
            if (errorMessage.includes('Failed to initialize Bluesky client')) {
                this.hasError = true;
                this.errorMessage = errorMessage;
                this.handleError();
            }
            originalError.apply(console, args);
        };

        // Ignore 401/403 errors as they are transient
        window.addEventListener('unhandledrejection', (event) => {
            if (event.reason?.toString().includes('401') ||
                event.reason?.toString().includes('403')) {
                event.preventDefault();
            }
        });

        // Set a timeout to show success if no error occurs
        setTimeout(() => {
            if (!this.initialized && !this.hasError) {
                this.showSuccess();
            }
        }, 2000);
    }

    showSuccess() {
        if (this.hasError) return;

        this.initialized = true;
        this.titleElement.textContent = 'Authentication Successful';
        this.errorElement.textContent = '';

        // Set auth flag before redirect
        sessionStorage.setItem('auth_redirect', 'true');

        // Set redirect timeout
        this.redirectTimeout = setTimeout(() => {
            window.location.href = '/';
        }, 2000);
    }

    handleError() {
        this.initialized = true;
        this.hasError = true;

        // Clear any existing redirect timeout
        if (this.redirectTimeout) {
            clearTimeout(this.redirectTimeout);
            this.redirectTimeout = null;
        }

        this.container.classList.add('error');
        this.titleElement.textContent = 'Authentication Failed';
        this.errorElement.textContent = this.errorMessage || 'Unknown error occurred';
    }
}

// Initialize when page loads
window.addEventListener('load', () => {
    const handler = new CallbackHandler();
    handler.init();
});
