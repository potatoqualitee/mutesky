import { elements } from '../dom.js';
import { state } from '../state.js';

export function renderContextCards() {
    if (!elements.contextOptions) return;

    // Check if there are any active keywords
    const hasActiveKeywords = state.activeKeywords.size > 0;

    elements.contextOptions.innerHTML = Object.entries(state.contextGroups)
        .map(([id, context]) => {
            // Only show as selected if we have active keywords and this context is selected
            const isSelected = hasActiveKeywords && state.selectedContexts.has(id);
            return `
                <div class="context-card ${isSelected ? 'selected' : ''}"
                     data-context="${id}"
                     onclick="handleContextToggle('${id}')">
                    <h3>${context.title}</h3>
                    <p>${context.description}</p>
                </div>
            `;
        }).join('');
}

export function renderExceptions() {
    if (!elements.exceptionsPanel || !elements.exceptionTags) return;

    if (state.selectedContexts.size > 0) {
        elements.exceptionsPanel.classList.add('visible');
    } else {
        elements.exceptionsPanel.classList.remove('visible');
        state.selectedExceptions.clear();
        elements.muteButton?.classList.remove('visible');
        return;
    }

    const selectedCategories = new Set();
    state.selectedContexts.forEach(contextId => {
        const context = state.contextGroups[contextId];
        if (context && context.categories) {
            context.categories.forEach(category => selectedCategories.add(category));
        }
    });

    elements.exceptionTags.innerHTML = Array.from(selectedCategories)
        .map(category => {
            return `
                <button class="exception-tag ${state.selectedExceptions.has(category) ? 'selected' : ''}"
                        onclick="handleExceptionToggle('${category}')">
                    ${category}
                </button>
            `;
        }).join('');
}
