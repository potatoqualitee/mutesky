export class ImageHandler {
    constructor() {
        this.imageCache = new Map();
        this.themeObserver = null;
    }

    async initThemeAwareImages(component) {
        const images = component.querySelectorAll('.theme-aware-image');
        const preloadPromises = [];

        // Preload all images
        images.forEach(img => {
            const lightSrc = img.dataset.lightSrc;
            const darkSrc = img.dataset.darkSrc;

            if (lightSrc && !this.imageCache.has(lightSrc)) {
                preloadPromises.push(this.preloadImage(lightSrc));
            }
            if (darkSrc && !this.imageCache.has(darkSrc)) {
                preloadPromises.push(this.preloadImage(darkSrc));
            }
        });

        try {
            await Promise.all(preloadPromises);
            this.updateThemeAwareImages(component);
        } catch (error) {
            console.error('Error preloading images:', error);
        }
    }

    async preloadImage(src) {
        if (!src || this.imageCache.has(src)) return;

        try {
            const img = new Image();
            const loadPromise = new Promise((resolve, reject) => {
                img.onload = () => resolve(src);
                img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
            });

            img.src = src;
            await loadPromise;
            this.imageCache.set(src, true);
        } catch (error) {
            console.error(`Error preloading image ${src}:`, error);
            // Cache the failure to avoid repeated attempts
            this.imageCache.set(src, false);
        }
    }

    updateThemeAwareImages(component, theme = null) {
        if (!theme) {
            theme = document.documentElement.getAttribute('data-theme');
        }
        const isDarkMode = theme === 'dark';

        requestAnimationFrame(() => {
            component.querySelectorAll('.theme-aware-image').forEach(async (img) => {
                const src = isDarkMode ? img.dataset.darkSrc : img.dataset.lightSrc;

                // Skip if image hasn't been preloaded or failed to preload
                if (!this.imageCache.has(src)) {
                    await this.preloadImage(src);
                }

                if (this.imageCache.get(src)) {
                    img.style.backgroundImage = `url('${src}')`;
                } else {
                    // Use fallback image or add error class
                    img.classList.add('image-load-error');
                }
            });
        });
    }

    cleanup() {
        this.imageCache.clear();
    }
}
