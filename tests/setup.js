// jsdom doesn't always provide requestAnimationFrame; the app only uses it
// for debounced rendering, so a timeout-based shim is fine for tests
if (typeof globalThis.requestAnimationFrame !== 'function') {
    globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
    globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}

if (typeof globalThis.CSS === 'undefined') {
    globalThis.CSS = { escape: (s) => s.replace(/[^a-zA-Z0-9_-]/g, '\\$&') };
}

// jsdom has no matchMedia; themeHandlers registers a system-theme listener at import
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
    window.matchMedia = () => ({
        matches: false,
        media: '',
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {}
    });
}
