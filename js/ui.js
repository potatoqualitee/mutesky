export class UIService {
    updateLoginState(isLoggedIn, message = '') {
        // Update DOM synchronously
        this.updateDOMElements(isLoggedIn, message);

        // Dispatch event in background
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('blueskyLoginStateChanged', {
                detail: { isLoggedIn, message }
            }));
        }, 0);
    }

    updateDOMElements(isLoggedIn, message) {
        const loginBtn = document.getElementById('bsky-login-btn');
        const logoutBtn = document.getElementById('bsky-logout-btn');
        const handleInput = document.getElementById('bsky-handle-input');
        const authMessage = document.getElementById('bsky-auth-message');

        // Clear error states if logging in successfully
        if (isLoggedIn) {
            if (handleInput) {
                handleInput.classList.remove('error');
            }
            if (authMessage) {
                authMessage.classList.remove('error');
            }
        }

        // Batch DOM updates
        if (loginBtn) {
            loginBtn.style.display = isLoggedIn ? 'none' : 'block';
            loginBtn.disabled = false;
            loginBtn.textContent = 'Connect to Bluesky';
        }
        if (logoutBtn) logoutBtn.style.display = isLoggedIn ? 'block' : 'none';

        if (handleInput) {
            handleInput.style.display = isLoggedIn ? 'none' : 'block';
            handleInput.disabled = false;
            handleInput.classList.toggle('error', !isLoggedIn && !!message);
        }

        if (authMessage) {
            if (message) {
                authMessage.textContent = message;
                authMessage.classList.toggle('error', !isLoggedIn && !!message);
            } else if (isLoggedIn) {
                // Clear error message on successful login
                authMessage.textContent = 'The next page will prompt for your username and Bluesky account password, not your app password. Your credentials are securely handled by Bluesky\'s official authentication service.';
                authMessage.classList.remove('error');
            }
        }
    }

    getHandleInput() {
        const handleInput = document.getElementById('bsky-handle-input');
        // Strip @ symbol if present and trim whitespace
        return (handleInput?.value?.replace('@', '') || '').trim();
    }

    showError(message) {
        const handleInput = document.getElementById('bsky-handle-input');
        const authMessage = document.getElementById('bsky-auth-message');
        const loginBtn = document.getElementById('bsky-login-btn');

        if (handleInput) {
            handleInput.classList.add('error');
            handleInput.disabled = false;
        }
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Connect to Bluesky';
        }
        if (authMessage) {
            authMessage.textContent = message;
            authMessage.classList.add('error');
        }
    }
}
