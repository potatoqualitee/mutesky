import { state } from '../../state.js';
import { getAllKeywordsForCategory } from '../../categoryManager.js';
import { isKeywordActive } from '../keywordHandlers.js';

// Enhanced cache with memory management and performance optimizations
export const cache = {
    keywords: new Map(),
    categoryStates: new Map(),
    contextKeywords: new Map(),
    activeKeywordsByCategory: new Map(),
    lastUpdate: 0,
    maxCacheSize: 100,
    updateThreshold: 16,

    getKeywords(category, sortByWeight = false) {
        const key = `${category}-${sortByWeight}-${state.filterLevel}`;
        if (!this.keywords.has(key)) {
            this.manageCache(this.keywords);
            const keywords = getAllKeywordsForCategory(category, sortByWeight);
            this.keywords.set(key, new Set(keywords));
        }
        return this.keywords.get(key);
    },

    getActiveKeywordsForCategory(category) {
        const key = `active-${category}-${state.filterLevel}`;
        if (!this.activeKeywordsByCategory.has(key)) {
            this.manageCache(this.activeKeywordsByCategory);
            const keywords = this.getKeywords(category, true);
            const active = new Set();
            for (const k of keywords) {
                if (isKeywordActive(k)) active.add(k);
            }
            this.activeKeywordsByCategory.set(key, active);
        }
        return this.activeKeywordsByCategory.get(key);
    },

    getCategoryState(category) {
        const keywords = this.getKeywords(category, true);
        const activeKeywords = this.getActiveKeywordsForCategory(category);

        if (activeKeywords.size === 0) return 'none';
        if (activeKeywords.size === keywords.size) return 'all';
        return 'partial';
    },

    getContextKeywords(contextId) {
        const key = `${contextId}-${state.filterLevel}`;
        if (!this.contextKeywords.has(key)) {
            this.manageCache(this.contextKeywords);
            const context = state.contextGroups[contextId];
            const keywordSet = new Set();

            if (context?.categories) {
                const nonExceptedCategories = context.categories.filter(
                    category => !state.selectedExceptions.has(category)
                );

                for (const category of nonExceptedCategories) {
                    const keywords = this.getKeywords(category, true);
                    for (const k of keywords) keywordSet.add(k);
                }
            }
            this.contextKeywords.set(key, keywordSet);
        }
        return this.contextKeywords.get(key);
    },

    getContextState(contextId) {
        const context = state.contextGroups[contextId];
        if (!context?.categories) return 'none';

        let allNone = true;
        for (const category of context.categories) {
            if (state.selectedExceptions.has(category)) continue;

            const categoryState = this.getCategoryState(category);
            if (categoryState !== 'none') {
                allNone = false;
                break;
            }
        }
        return allNone ? 'none' : 'partial';
    },

    manageCache(cacheMap) {
        if (cacheMap.size >= this.maxCacheSize) {
            const entriesToRemove = Math.ceil(this.maxCacheSize * 0.2);
            const keys = Array.from(cacheMap.keys());
            for (let i = 0; i < entriesToRemove; i++) {
                cacheMap.delete(keys[i]);
            }
        }
    },

    shouldUpdate() {
        const now = Date.now();
        if (now - this.lastUpdate < this.updateThreshold) return false;
        this.lastUpdate = now;
        return true;
    },

    invalidateCategory(category) {
        if (!this.shouldUpdate()) return;

        const keywordKeys = Array.from(this.keywords.keys())
            .filter(key => key.startsWith(`${category}-`));
        const activeKeys = Array.from(this.activeKeywordsByCategory.keys())
            .filter(key => key.startsWith(`active-${category}-`));

        keywordKeys.forEach(key => this.keywords.delete(key));
        activeKeys.forEach(key => this.activeKeywordsByCategory.delete(key));
        this.contextKeywords.clear();
    },

    clear() {
        this.keywords.clear();
        this.categoryStates.clear();
        this.contextKeywords.clear();
        this.activeKeywordsByCategory.clear();
        this.lastUpdate = 0;
    }
};
