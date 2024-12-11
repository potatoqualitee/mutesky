import { state, saveState } from '../../state.js';
import { updateSimpleModeState } from '../contextHandlers.js';
import { renderInterface } from '../../renderer.js';

// Debounced UI updates with frame timing
export const debouncedUpdate = (() => {
    let timeout;
    let frameRequest;
    return (fn) => {
        if (timeout) clearTimeout(timeout);
        if (frameRequest) cancelAnimationFrame(frameRequest);

        timeout = setTimeout(() => {
            frameRequest = requestAnimationFrame(() => {
                fn();
                notifyKeywordChanges();
            });
        }, 16);
    };
})();

// Helper function to notify keyword changes
export function notifyKeywordChanges() {
    document.dispatchEvent(new CustomEvent('keywordsUpdated', {
        detail: { count: state.activeKeywords.size }
    }));
}

// Optimized checkbox update with proper CSS escaping
export function updateCheckboxes(category, enabled) {
    requestAnimationFrame(() => {
        const escapedCategory = CSS.escape(category.replace(/\s+/g, '-').toLowerCase());
        // Use more specific selectors for better performance
        const sidebarCheckbox = document.querySelector(`.category-item[data-category="${CSS.escape(category)}"] > input[type="checkbox"]`);
        const mainCheckbox = document.querySelector(`#category-${escapedCategory} > input[type="checkbox"]`);
        const keywordCheckboxes = document.querySelectorAll(`#category-${escapedCategory} .keywords-container input[type="checkbox"]`);

        if (sidebarCheckbox) {
            sidebarCheckbox.checked = enabled;
            sidebarCheckbox.indeterminate = false;
        }
        if (mainCheckbox) {
            mainCheckbox.checked = enabled;
            mainCheckbox.indeterminate = false;
        }
        keywordCheckboxes.forEach(checkbox => {
            checkbox.checked = enabled;
        });
    });
}

// Standard update function used by handlers
export function standardUpdate() {
    updateSimpleModeState();
    renderInterface();
    saveState();
}
