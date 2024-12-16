import { state } from '../state.js';

class SimpleMode extends HTMLElement {
    constructor() {
        super();
        this.currentLevel = 0;
        this.currentExceptions = new Set();
        this.activeKeywordCount = 0;
        this.handleKeywordsUpdated = this.handleKeywordsUpdated.bind(this);
    }

    handleKeywordsUpdated(event) {
        this.activeKeywordCount = event.detail.count;
        this.updateFilterUI();
    }

    connectedCallback() {
        this.innerHTML = `
            <div class="interface-mode">
                <div class="context-builder">
                    <div class="context-builder-inner">
                        <p class="intro-text">Select the content types you want to filter, choose your filtering strength, and set any exceptions. Click the blue "Mute" button at the top right to apply your changes. For more detailed control, try Advanced Mode in the top menu.</p>

                        <div class="context-selector">
                            <h2>I want to avoid content about...</h2>
                            <div id="context-options" class="context-options">
                                <!-- Will be populated by contextRenderer.js -->
                            </div>
                        </div>

                        <div class="filter-slider">
                            <h2>Choose your filtering level</h2>
                            <p class="filter-note" style="display: none;">
                            Adding more words to your mute list can make Bluesky run more slowly, especially when reading posts with many comments. You may notice the Bluesky becomes slower when you have more than 200 muted keywords, especially on mobile devices.</p>

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
                            <h2>Keep showing me content about...</h2>
                            <div id="exception-tags" class="exception-tags">
                                <!-- Will be populated by contextRenderer.js -->
                            </div>
                        </div>
                    </div>
                </div>

                <div class="bottom-spacing"></div>
            </div>
        `;

        // Initialize from saved state
        this.currentLevel = state.filterLevel;
        this.currentExceptions = new Set(state.selectedExceptions);

        // Start observing state changes
        document.addEventListener('keywordsUpdated', this.handleKeywordsUpdated);

        // Initial UI update
        this.activeKeywordCount = state.activeKeywords.size;
        this.updateFilterUI();
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

    updateFilterUI() {
        const levels = this.querySelectorAll('.filter-card');
        const warningNote = this.querySelector('.filter-note');
        const keywordCount = this.querySelector('.keyword-count');

        levels.forEach(el => {
            const isActive = parseInt(el.dataset.level) === this.currentLevel;
            el.classList.toggle('active', isActive);
            el.setAttribute('aria-checked', isActive);
        });

        if (warningNote) {
            // Show warning if active keywords exceed 200
            warningNote.style.display = this.activeKeywordCount > 200 ? 'block' : 'none';
            // Update the keyword count
            if (keywordCount) {
                keywordCount.textContent = this.activeKeywordCount;
            }
        }
    }

    setActiveLevel(level) {
        if (level === this.currentLevel) return;
        this.currentLevel = level;
        state.filterLevel = level;
        this.updateFilterUI();

        // Dispatch custom event for level change
        this.dispatchEvent(new CustomEvent('filterLevelChange', {
            detail: { level },
            bubbles: true
        }));
    }

    // Method to update level from outside
    updateLevel(level) {
        if (level === this.currentLevel) return;
        this.currentLevel = level;
        this.updateFilterUI();
    }

    // Method to update exceptions from outside
    updateExceptions(exceptions) {
        const newExceptions = new Set(exceptions);
        if (this.areExceptionsEqual(this.currentExceptions, newExceptions)) return;

        this.currentExceptions = newExceptions;

        // Update exception tags UI if needed
        const exceptionTags = this.querySelector('#exception-tags');
        if (exceptionTags) {
            // Let the contextRenderer handle the actual UI update
            this.dispatchEvent(new CustomEvent('exceptionsUpdated', {
                detail: { exceptions: Array.from(newExceptions) },
                bubbles: true
            }));
        }
    }

    // Helper to compare exception sets
    areExceptionsEqual(set1, set2) {
        if (set1.size !== set2.size) return false;
        for (const item of set1) {
            if (!set2.has(item)) return false;
        }
        return true;
    }

    disconnectedCallback() {
        // Clean up event listeners
        document.removeEventListener('keywordsUpdated', this.handleKeywordsUpdated);
    }
}

customElements.define('simple-mode', SimpleMode);

export default SimpleMode;
