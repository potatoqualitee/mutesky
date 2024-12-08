import { elements } from '../dom.js';
import { state } from '../state.js';

export function renderContextCards() {
    if (!elements.contextOptions) return;

    elements.contextOptions.innerHTML = Object.entries(state.contextGroups)
        .map(([id, context]) => {
            // Only check if the context is in selectedContexts
            const isSelected = state.selectedContexts.has(id);
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

    // Show/hide panel based on context selection without clearing exceptions
    if (state.selectedContexts.size > 0) {
        elements.exceptionsPanel.classList.add('visible');
    } else {
        elements.exceptionsPanel.classList.remove('visible');
        elements.muteButton?.classList.remove('visible');
        return;
    }

    // Get categories only from contexts that are actually selected
    const selectedCategories = new Set();
    for (const contextId of state.selectedContexts) {
        const context = state.contextGroups[contextId];
        if (context?.categories) {
            context.categories.forEach(category => {
                // Only add categories from selected contexts
                if (state.selectedContexts.has(contextId)) {
                    selectedCategories.add(category);
                }
            });
        }
    }

    // Render exception tags, preserving selected state
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
