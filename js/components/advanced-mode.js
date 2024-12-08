class AdvancedMode extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.innerHTML = `
            <div class="interface-mode">
                <div class="advanced-layout">
                    <aside class="categories-sidebar">
                        <div class="sidebar-header">
                            <input type="search" class="sidebar-search" id="sidebar-search"
                                placeholder="Search keywords...">
                            <div class="toggle-all-controls">
                                <button id="enable-all" class="toggle-all-btn">Enable All</button>
                                <button id="disable-all" class="toggle-all-btn">Disable All</button>
                            </div>
                        </div>

                        <div class="category-list" id="category-list">
                            <!-- Will be populated by JavaScript -->
                        </div>
                    </aside>

                    <div class="advanced-filter-manager">
                        <main id="categories-grid" class="categories-grid">
                            <!-- Will be populated by JavaScript -->
                        </main>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('advanced-mode', AdvancedMode);

export default AdvancedMode;
