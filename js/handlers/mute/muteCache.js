// Enhanced keyword cache for mute operations
const muteCache = {
    ourKeywordsMap: null,
    lastUpdate: 0,
    updateThreshold: 50,

    shouldUpdate() {
        const now = Date.now();
        if (now - this.lastUpdate < this.updateThreshold) return false;
        this.lastUpdate = now;
        return true;
    },

    getOurKeywordsMap() {
        if (this.ourKeywordsMap && !this.shouldUpdate()) {
            console.debug('[muteCache] Returning cached keyword map');
            return this.ourKeywordsMap;
        }

        console.debug('[muteCache] Building new keyword map');
        const map = new Map();
        Object.entries(state.keywordGroups).forEach(([category, categoryData]) => {
            const categoryInfo = categoryData[category];
            if (categoryInfo?.keywords) {
                Object.keys(categoryInfo.keywords).forEach(keyword => {
                    map.set(keyword.toLowerCase(), keyword);
                });
            }
        });
        this.ourKeywordsMap = map;
        console.debug('[muteCache] New keyword map size:', map.size);
        return map;
    },

    clear() {
        console.debug('[muteCache] Clearing cache');
        this.ourKeywordsMap = null;
        this.lastUpdate = 0;
    }
};

import { state } from '../../state.js';

export { muteCache };
