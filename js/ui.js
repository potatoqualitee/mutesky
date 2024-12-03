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

        // Batch DOM updates
        if (loginBtn) loginBtn.style.display = isLoggedIn ? 'none' : 'block';
        if (logoutBtn) logoutBtn.style.display = isLoggedIn ? 'block' : 'none';

        if (handleInput) {
            handleInput.style.display = isLoggedIn ? 'none' : 'block';
            handleInput.classList.toggle('error', !isLoggedIn && !!message);
        }

        if (authMessage && message) {
            authMessage.textContent = message;
        }
    }

    getHandleInput() {
        const handleInput = document.getElementById('bsky-handle-input');
        return handleInput?.value?.trim() || '';
    }

    showError(message) {
        const handleInput = document.getElementById('bsky-handle-input');
        const authMessage = document.getElementById('bsky-auth-message');

        if (handleInput) handleInput.classList.add('error');
        if (authMessage) authMessage.textContent = message;
    }
}
