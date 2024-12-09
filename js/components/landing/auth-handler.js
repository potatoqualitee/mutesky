export class AuthHandler {
    static checkAuthErrors() {
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
