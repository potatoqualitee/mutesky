import { state, saveState, setTargetKeywordCount } from '../state.js';
import { getAllKeywordsForCategory } from '../categoryManager.js';
import { renderInterface } from '../renderer.js';

// Optimized cache with memoization
const cache = {
    keywords: new Map(),
    categoryStates: new Map(),
    contextKeywords: new Map(),
    activeKeywordsByCategory: new Map(),
    lastUpdate: 0,

    getKeywords(category, sortByWeight = false) {
        const key = `${category}-${sortByWeight}`;
        if (!this.keywords.has(key)) {
            const keywords = getAllKeywordsForCategory(category, sortByWeight);
            this.keywords.set(key, new Set(keywords));
        }
        return this.keywords.get(key);
    },

    getActiveKeywordsForCategory(category) {
        if (!this.activeKeywordsByCategory.has(category)) {
            const keywords = this.getKeywords(category);
            const active = new Set([...keywords].filter(k => state.activeKeywords.has(k)));
            this.activeKeywordsByCategory.set(category, active);
        }
        return this.activeKeywordsByCategory.get(category);
    },

    getCategoryState(category) {
        const keywords = this.getKeywords(category);
        const activeKeywords = this.getActiveKeywordsForCategory(category);

        if (activeKeywords.size === 0) return 'none';
        if (activeKeywords.size === keywords.size) return 'all';
        return 'partial';
    },

    getContextKeywords(contextId, isSelected) {
        const key = `${contextId}-${isSelected}`;
        if (!this.contextKeywords.has(key)) {
            const context = state.contextGroups[contextId];
            const keywordSet = new Set();

            if (context?.categories) {
                for (const category of context.categories) {
                    if (!isSelected || !state.selectedExceptions.has(category)) {
                        const keywords = this.getKeywords(category, !isSelected);
                        for (const k of keywords) keywordSet.add(k);
                    }
                }
            }
            this.contextKeywords.set(key, keywordSet);
        }
        return this.contextKeywords.get(key);
    },

    invalidateCategory(category) {
        const now = Date.now();
        if (now - this.lastUpdate < 50) return;
        this.lastUpdate = now;

        const patterns = [`${category}-true`, `${category}-false`];
        patterns.forEach(p => this.keywords.delete(p));
        this.activeKeywordsByCategory.delete(category);

        for (const [key] of this.contextKeywords) {
            const [contextId] = key.split('-');
            const context = state.contextGroups[contextId];
            if (context?.categories?.includes(category)) {
                this.contextKeywords.delete(key);
            }
        }
    },

    clear() {
        this.keywords.clear();
        this.categoryStates.clear();
        this.contextKeywords.clear();
        this.activeKeywordsByCategory.clear();
    }
};

// Debounced UI updates
const debouncedUpdate = (() => {
    let timeout;
    return (fn) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(fn, 16);
    };
})();

// Activate keywords for a context
function activateContextKeywords(contextId) {
    const context = state.contextGroups[contextId];
    if (!context?.categories) return;

    for (const category of context.categories) {
        if (state.selectedExceptions.has(category)) continue;
        const keywords = cache.getKeywords(category);
        for (const keyword of keywords) {
            state.activeKeywords.add(keyword);
        }
    }
}

export function handleContextToggle(contextId) {
    const isSelected = state.selectedContexts.has(contextId);
    const context = state.contextGroups[contextId];
    const keywords = cache.getContextKeywords(contextId, isSelected);

    if (isSelected) {
        state.selectedContexts.delete(contextId);
        if (context.categories) {
            context.categories.forEach(category => {
                state.selectedExceptions.delete(category);
                cache.invalidateCategory(category);
            });
        }
        keywords.forEach(k => state.activeKeywords.delete(k));
    } else {
        state.selectedContexts.add(contextId);
        keywords.forEach(k => state.activeKeywords.add(k));
        if (context.categories) {
            context.categories.forEach(category => cache.invalidateCategory(category));
        }
    }

    debouncedUpdate(() => {
        saveState();
        renderInterface();
    });
}

export function handleExceptionToggle(category) {
    const wasException = state.selectedExceptions.has(category);
    const keywords = cache.getKeywords(category, !wasException);

    if (wasException) {
        state.selectedExceptions.delete(category);
        keywords.forEach(k => state.activeKeywords.add(k));
    } else {
        state.selectedExceptions.add(category);
        keywords.forEach(k => state.activeKeywords.delete(k));
    }

    cache.invalidateCategory(category);

    debouncedUpdate(() => {
        saveState();
        renderInterface();
    });
}

export function updateSimpleModeState() {
    if (state.targetKeywordCount === 2000) {
        setTargetKeywordCount(100);
    }

    debouncedUpdate(() => {
        saveState();
        renderInterface();
    });
}

// Export for use during initial state load
export function initializeState() {
    const saved = localStorage.getItem('calmChaosState');
    if (saved) {
        const data = JSON.parse(saved);

        // First restore contexts
        if (data.selectedContexts) {
            state.selectedContexts = new Set(data.selectedContexts);
        }

        // Then restore exceptions
        if (data.selectedExceptions) {
            state.selectedExceptions = new Set(data.selectedExceptions);
        }

        // Activate keywords for all selected contexts
        for (const contextId of state.selectedContexts) {
            activateContextKeywords(contextId);
        }

        // Finally restore any additional active keywords
        if (data.activeKeywords) {
            data.activeKeywords.forEach(k => state.activeKeywords.add(k));
        }
    }
}
