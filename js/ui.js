export class UIService {
    updateLoginState(isLoggedIn, message = '') {
        const loginBtn = document.getElementById('bsky-login-btn');
        const logoutBtn = document.getElementById('bsky-logout-btn');
        const handleInput = document.getElementById('bsky-handle-input');
        const authMessage = document.getElementById('bsky-auth-message');

        if (loginBtn && logoutBtn) {
            loginBtn.style.display = isLoggedIn ? 'none' : 'block';
            logoutBtn.style.display = isLoggedIn ? 'block' : 'none';
        }

        if (handleInput) {
            handleInput.style.display = isLoggedIn ? 'none' : 'block';
            if (isLoggedIn) {
                handleInput.classList.remove('error');
            } else if (message) {
                handleInput?.classList.add('error');
            }
        }

        if (authMessage) {
            authMessage.textContent = message || '';
        }

        // Dispatch event for other parts of the app
        window.dispatchEvent(new CustomEvent('blueskyLoginStateChanged', {
            detail: { isLoggedIn, message }
        }));
    }

    getHandleInput() {
        const handleInput = document.getElementById('bsky-handle-input');
        return handleInput?.value?.trim() || '';
    }

    showError(message) {
        const handleInput = document.getElementById('bsky-handle-input');
        const authMessage = document.getElementById('bsky-auth-message');

        if (handleInput) {
            handleInput.classList.add('error');
        }
        if (authMessage) {
            authMessage.textContent = message;
        }
    }
}
