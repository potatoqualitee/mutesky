import { elements } from '../dom.js';
import { state } from '../state.js';
import { getContextSelectionState } from '../handlers/context/selectionModel.js';
import { escapeHtml, escapeJsAttr } from '../utils/escape.js';

const TRAILING_CONTEXT_ORDER = [
    'New Developments',
    'US Holidays',
    'Sports Events',
    'Technology'
];

export function getOrderedContextEntries(contextGroups) {
    const entries = Object.entries(contextGroups);
    const trailingTitles = new Set(TRAILING_CONTEXT_ORDER);
    const regular = entries.filter(([, context]) => !trailingTitles.has(context.title));
    const trailing = TRAILING_CONTEXT_ORDER.flatMap(title =>
        entries.filter(([, context]) => context.title === title));
    return [...regular, ...trailing];
}

export function renderContextCards() {
    if (!elements.contextOptions) return;

    elements.contextOptions.innerHTML = getOrderedContextEntries(state.contextGroups)
        .map(([id, context]) => {
            // Honest tri-state display derived from actual keyword state:
            // fully selected, partially selected (some keywords active), or off
            const selectionState = getContextSelectionState(id);
            const stateClass = selectionState === 'all' ? 'selected'
                : selectionState === 'partial' ? 'partial'
                : '';
            return `
                <div class="context-card ${stateClass}"
                     data-context="${escapeHtml(id)}"
                     onclick="handleContextToggle('${escapeJsAttr(id)}')">
                    <h3>${escapeHtml(context.title)}</h3>
                    <p>${escapeHtml(context.description)}</p>
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
                        onclick="handleExceptionToggle('${escapeJsAttr(category)}')">
                    ${escapeHtml(category)}
                </button>
            `;
        }).join('');
}
