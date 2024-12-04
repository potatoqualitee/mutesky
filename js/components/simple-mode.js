import { state } from '../state.js';

class SimpleMode extends HTMLElement {
    constructor() {
        super();
        this.currentLevel = 0;
        this.currentExceptions = new Set();
        console.log('[SimpleMode] Constructor called, initial exceptions:', Array.from(this.currentExceptions));
    }

    connectedCallback() {
        console.log('[SimpleMode] Connected callback starting');
        console.log('[SimpleMode] State exceptions at connect:', Array.from(state.selectedExceptions));

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

        // Initialize from saved state
        console.log('[SimpleMode] Initializing with filter level:', state.filterLevel);
        console.log('[SimpleMode] Initializing with exceptions:', Array.from(state.selectedExceptions));
        this.currentLevel = state.filterLevel;
        this.currentExceptions = new Set(state.selectedExceptions);
        console.log('[SimpleMode] After initialization, currentExceptions:', Array.from(this.currentExceptions));
        this.updateFilterUI();
        this.setupEventListeners();
        console.log('[SimpleMode] Connected callback complete');
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

        levels.forEach(el => {
            const isActive = parseInt(el.dataset.level) === this.currentLevel;
            el.classList.toggle('active', isActive);
            el.setAttribute('aria-checked', isActive);
        });

        if (warningNote) {
            warningNote.style.display = this.currentLevel > 0 ? 'block' : 'none';
        }
    }

    setActiveLevel(level) {
        if (level === this.currentLevel) return;

        console.log('[SimpleMode] Changing filter level from', this.currentLevel, 'to', level);
        this.currentLevel = level;
        state.filterLevel = level; // Update global state
        console.log('[SimpleMode] Updated state filter level to:', state.filterLevel);
        this.updateFilterUI();

        // Dispatch custom event for level change
        console.log('[SimpleMode] Dispatching filterLevelChange event with level:', level);
        this.dispatchEvent(new CustomEvent('filterLevelChange', {
            detail: { level },
            bubbles: true
        }));
    }

    // Method to update level from outside
    updateLevel(level) {
        if (level === this.currentLevel) return;
        console.log('[SimpleMode] External update changing level from', this.currentLevel, 'to', level);
        this.currentLevel = level;
        this.updateFilterUI();
    }

    // Method to update exceptions from outside
    updateExceptions(exceptions) {
        console.log('[SimpleMode] updateExceptions called with:', exceptions);
        console.log('[SimpleMode] Current exceptions before update:', Array.from(this.currentExceptions));
        console.log('[SimpleMode] State exceptions:', Array.from(state.selectedExceptions));

        const newExceptions = new Set(exceptions);
        if (this.areExceptionsEqual(this.currentExceptions, newExceptions)) {
            console.log('[SimpleMode] Exceptions unchanged, skipping update');
            return;
        }

        console.log('[SimpleMode] Exceptions changed, updating from',
            Array.from(this.currentExceptions), 'to', Array.from(newExceptions));
        this.currentExceptions = newExceptions;

        // Update exception tags UI if needed
        const exceptionTags = this.querySelector('#exception-tags');
        if (exceptionTags) {
            console.log('[SimpleMode] Found exception tags container, dispatching update event');
            // Let the contextRenderer handle the actual UI update
            // This will trigger a re-render through the existing system
            this.dispatchEvent(new CustomEvent('exceptionsUpdated', {
                detail: { exceptions: Array.from(newExceptions) },
                bubbles: true
            }));
        } else {
            console.log('[SimpleMode] Exception tags container not found');
        }

        console.log('[SimpleMode] Exception update complete. Current exceptions:', Array.from(this.currentExceptions));
    }

    // Helper to compare exception sets
    areExceptionsEqual(set1, set2) {
        console.log('[SimpleMode] Comparing exception sets:',
            'set1:', Array.from(set1),
            'set2:', Array.from(set2));

        if (set1.size !== set2.size) {
            console.log('[SimpleMode] Sets have different sizes:', set1.size, 'vs', set2.size);
            return false;
        }

        for (const item of set1) {
            if (!set2.has(item)) {
                console.log('[SimpleMode] Set2 missing item:', item);
                return false;
            }
        }

        console.log('[SimpleMode] Sets are equal');
        return true;
    }
}

customElements.define('simple-mode', SimpleMode);

export default SimpleMode;
