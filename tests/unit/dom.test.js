import { describe, it, expect, beforeEach } from 'vitest';
import { elements, refreshElements } from '../../js/dom.js';

describe('refreshElements', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        refreshElements();
    });

    it('updates one stable object after component-owned controls render', () => {
        const importedReference = elements;

        document.body.innerHTML =
            '<div id="landing-page"></div>' +
            '<button id="bsky-login-btn">Connect to Bluesky</button>' +
            '<main id="categories-grid"></main>';

        const refreshed = refreshElements();

        expect(refreshed).toBe(importedReference);
        expect(elements.landingPage).toBe(document.getElementById('landing-page'));
        expect(elements.authButton).toBe(document.getElementById('bsky-login-btn'));
        expect(elements.categoriesGrid).toBe(document.getElementById('categories-grid'));
    });

    it('clears stale references when component markup is replaced', () => {
        document.body.innerHTML = '<button id="bsky-login-btn">Connect</button>';
        refreshElements();
        const oldButton = elements.authButton;

        document.body.innerHTML = '<button id="bsky-login-btn">Replacement</button>';
        refreshElements();

        expect(elements.authButton).not.toBe(oldButton);
        expect(elements.authButton.textContent).toBe('Replacement');
        expect(elements.categoriesGrid).toBeNull();
    });
});