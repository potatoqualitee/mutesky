// Cache implementation
export const cache = {
    data: new Map(),
    getItem: function(key) {
        const item = this.data.get(key);
        if (!item) return null;
        if (Date.now() > item.expiry) {
            this.data.delete(key);
            return null;
        }
        return item.value;
    },
    setItem: function(key, value, ttl = 3600000) { // 1 hour default TTL
        const expiry = Date.now() + ttl;
        this.data.set(key, { value, expiry });
    }
};
