class CallbackHandler {
    constructor() {
        console.log('[Callback] Initializing callback handler...');
        this.container = document.querySelector('.callback-container');
        this.errorElement = document.getElementById('error');
        this.titleElement = document.querySelector('h2');
        this.statusElement = document.querySelector('.status-text');
        this.initialized = false;
    }

    init() {
        console.log('[Callback] Starting callback processing...');
        // Get the current URL's query parameters or hash fragment
        const params = new URLSearchParams(
            window.location.search || window.location.hash.slice(1)
        );

        // Check for error in OAuth response
        if (params.has('error')) {
            console.log('[Callback] Error found in OAuth response');
            const error = params.get('error');
            const errorDescription = params.get('error_description');
            this.handleError(error, errorDescription);
            return;
        }

        // Check for required OAuth response parameters
        if (!params.has('code') || !params.has('state')) {
            console.log('[Callback] Missing required OAuth parameters');
            this.handleError(
                'invalid_response',
                'Missing required OAuth parameters'
            );
            return;
        }

        console.log('[Callback] OAuth parameters found, storing auth state...');
        // Store auth state before redirect
        sessionStorage.setItem('auth_state', params.get('state'));
        sessionStorage.setItem('auth_code', params.get('code'));

        this.showSuccess();
    }

    showSuccess() {
        console.log('[Callback] Processing successful auth...');
        this.initialized = true;

        // Show auth success for 2 seconds
        this.titleElement.textContent = 'Authentication Successful';
        this.statusElement.textContent = 'Verifying credentials';

        // Then show keyword loading for 2 seconds
        setTimeout(() => {
            console.log('[Callback] Showing keyword loading state');
            this.titleElement.textContent = 'Loading Keywords';
            this.statusElement.textContent = 'This may take a moment';

            // Then redirect
            setTimeout(() => {
                console.log('[Callback] Redirecting to app');
                window.location.href = '/';
            }, 2000);
        }, 2000);
    }

    handleError(error, description = '') {
        console.log('[Callback] Handling error:', error, description);
        this.initialized = true;
        this.container.classList.add('error');
        this.titleElement.textContent = 'Authentication Failed';

        // Store error state for landing page
        sessionStorage.setItem('auth_error', error);
        sessionStorage.setItem('auth_error_description', description);

        const errorMessage = description || error || 'Unknown error occurred';
        this.errorElement.textContent = errorMessage;

        console.log('[Callback] Redirecting after error...');
        // Redirect after brief pause to ensure error is visible
        setTimeout(() => {
            window.location.href = '/';
        }, 500);
    }
}

// Initialize when page loads
window.addEventListener('load', () => {
    console.log('[Callback] Page loaded, initializing handler...');
    const handler = new CallbackHandler();
    handler.init();
});
