import '../css/landing-entry.css';
import './components/landing-page.js';

import { authService } from './auth.js';
import { elements, refreshElements } from './dom.js';
import { handleFooterThemeToggle } from './handlers/themeHandlers.js';

window.settingsHandlers = { handleFooterThemeToggle };

function finishLandingLoad() {
    const loadingOverlay = document.getElementById('loading-state');
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
        setTimeout(() => loadingOverlay.remove(), 300);
    }
    document.body.classList.add('js-loaded');
}

function showLandingAuthError(message) {
    const authMessage = document.getElementById('bsky-auth-message');

    elements.handleInput?.classList.add('error');
    if (elements.handleInput) elements.handleInput.disabled = false;

    if (elements.authButton) {
        elements.authButton.disabled = false;
        elements.authButton.textContent = 'Connect to Bluesky';
    }

    if (authMessage) {
        authMessage.textContent = message;
        authMessage.classList.add('error');
    }
}

async function handleLandingAuth() {
    // Once the authenticated chunk has loaded, preserve its richer state
    // transition behavior when signing in again after logout.
    if (window.muteskyAuthenticatedAuth?.handleAuth) {
        return window.muteskyAuthenticatedAuth.handleAuth();
    }

    const handle = elements.handleInput?.value?.replace(/^@/, '').trim();
    if (!handle) {
        showLandingAuthError('Please enter your Bluesky handle');
        return;
    }

    const authMessage = document.getElementById('bsky-auth-message');
    elements.handleInput?.classList.remove('error');
    if (authMessage) authMessage.classList.remove('error');

    if (elements.handleInput) elements.handleInput.disabled = true;
    if (elements.authButton) {
        elements.authButton.disabled = true;
        elements.authButton.textContent = 'Connecting...';
    }

    try {
        await authService.signIn(handle);
    } catch (error) {
        const unavailable = error.message?.includes('invalid_client_metadata')
            || error.message?.includes('Failed to resolve OAuth server metadata');
        showLandingAuthError(unavailable
            ? 'Bluesky service appears to be down. Please try again in a few minutes.'
            : error.message || 'Authentication failed. Please try again.');
    }
}

function wireLandingAuthentication() {
    if (elements.authButton && !elements.authButton.dataset.authWired) {
        elements.authButton.dataset.authWired = 'true';
        elements.authButton.addEventListener('click', handleLandingAuth);
    }

    if (elements.handleInput && !elements.handleInput.dataset.authWired) {
        elements.handleInput.dataset.authWired = 'true';
        elements.handleInput.addEventListener('keypress', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleLandingAuth();
            }
        });
    }
}

async function loadAuthenticatedApplication() {
    const module = await import(
        /* webpackChunkName: "app" */
        './authenticatedApp.js'
    );
    await module.startAuthenticatedApp();
}

async function bootstrap() {
    refreshElements();
    wireLandingAuthentication();

    try {
        const result = await authService.setup();
        if (result?.session) {
            await loadAuthenticatedApplication();
            return;
        }

        if (result?.error && elements.landingPage) {
            showLandingAuthError(result.error.message || 'Authentication failed. Please try again.');
        }
    } catch (error) {
        console.error('[Bootstrap] Failed to load the authenticated application', error);
        showLandingAuthError('MuteSky could not finish loading. Please refresh and try again.');
    }

    if (elements.landingPage && elements.appInterface) {
        elements.landingPage.classList.remove('hidden');
        elements.appInterface.classList.add('hidden');
    }
    finishLandingLoad();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
    bootstrap();
}