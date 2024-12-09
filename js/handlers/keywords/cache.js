import { getAllKeywordsForCategory } from '../../categoryManager.js';

// Enhanced keyword cache with shorter timeout
export const keywordCache = {
    categoryKeywords: new Map(),
    lastUpdate: 0,
    updateThreshold: 16, // Reduced to one frame to match state.js

    shouldUpdate() {
        const now = Date.now();
        if (now - this.lastUpdate < this.updateThreshold) return false;
        this.lastUpdate = now;
        return true;
    },

    getKeywordsForCategory(category) {
        if (!this.categoryKeywords.has(category) || this.shouldUpdate()) {
            this.categoryKeywords.set(category, new Set(getAllKeywordsForCategory(category)));
        }
        return this.categoryKeywords.get(category);
    },

    clear() {
        this.categoryKeywords.clear();
        this.lastUpdate = 0;
    }
};
