class SimpleMode extends HTMLElement {
    constructor() {
        super();
        this.currentLevel = 0;
    }

    connectedCallback() {
        this.innerHTML = `
            <div class="interface-mode">
                <div class="context-builder">
                    <div class="context-builder-inner">
                        <div class="context-selector">
                            <h2>I want to avoid content about...</h2>
                            <div id="context-options" class="context-options">
                                <!-- Will be populated by contextRenderer.js -->
                            </div>
                        </div>

                        <div class="filter-slider">
                            <h2>Choose your filtering level</h2>
                            <p class="filter-note" style="display: none;">Adding more keywords can impact Bluesky's performance, especially when loading threads with many comments. Choose an intensity level that balances your filtering needs with browsing speed.</p>

                            <div class="filter-grid">
                                <div class="filter-card active" role="radio" aria-checked="true" tabindex="0" data-level="0">
                                    <h3>Minimal</h3>
                                    <p>Focus on highest impact content</p>
                                </div>
                                <div class="filter-card" role="radio" aria-checked="false" tabindex="0" data-level="1">
                                    <h3>Moderate</h3>
                                    <p>Balanced content management</p>
                                </div>
                                <div class="filter-card" role="radio" aria-checked="false" tabindex="0" data-level="2">
                                    <h3>Extensive</h3>
                                    <p>Comprehensive filtering</p>
                                </div>
                                <div class="filter-card" role="radio" aria-checked="false" tabindex="0" data-level="3">
                                    <h3>Complete</h3>
                                    <p>Maximum filtering capability</p>
                                </div>
                            </div>
                        </div>

                        <div id="exceptions-panel" class="exceptions-panel">
                            <h2>Keep Showing me content about...</h2>
                            <div id="exception-tags" class="exception-tags">
                                <!-- Will be populated by contextRenderer.js -->
                            </div>
                        </div>
                    </div>
                </div>

                <div class="bottom-spacing"></div>
            </div>
        `;

        this.setupEventListeners();
    }

    setupEventListeners() {
        const levels = this.querySelectorAll('.filter-card');

        levels.forEach(level => {
            // Click handler
            level.addEventListener('click', (e) => {
                this.setActiveLevel(parseInt(level.dataset.level));
            });

            // Keyboard handler
            level.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.setActiveLevel(parseInt(level.dataset.level));
                }
            });
        });
    }

    setActiveLevel(level) {
        if (level === this.currentLevel) return;

        this.currentLevel = level;
        const levels = this.querySelectorAll('.filter-card');

        levels.forEach(el => {
            const isActive = parseInt(el.dataset.level) === level;
            el.classList.toggle('active', isActive);
            el.setAttribute('aria-checked', isActive);
        });

        // Show warning for non-minimal levels, hide for minimal
        const warningNote = this.querySelector('.filter-note');
        if (warningNote) {
            warningNote.style.display = level > 0 ? 'block' : 'none';
        }

        // Dispatch custom event for level change
        this.dispatchEvent(new CustomEvent('filterLevelChange', {
            detail: { level },
            bubbles: true
        }));
    }
}

customElements.define('simple-mode', SimpleMode);

export default SimpleMode;
