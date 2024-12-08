// Optimized keyword cache with shorter timeout
export const keywordCache = {
    ourKeywords: null,
    lastUpdate: 0,

    clear() {
        this.ourKeywords = null;
        this.lastUpdate = 0;
    },

    shouldUpdate() {
        // Reduced throttle time to 16ms (one frame) for more responsive updates
        const now = Date.now();
        if (now - this.lastUpdate < 16) return false;
        this.lastUpdate = now;
        return true;
    }
};
